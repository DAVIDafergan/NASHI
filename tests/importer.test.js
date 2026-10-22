// Events agent: parsing, classification, completeness, city→region, dedupe/update.
// Run: npm test   (the DB part runs only when MONGO_TEST_URI points at a throwaway MongoDB)
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { phpUnserialize, phpSerialize } from '../server/importer/php.js';
import { parseWhen, israelParts, nashiDate } from '../server/importer/time.js';
import { resolveCity } from '../server/importer/city.js';
import { classifyEvent, missingFields, categoryFor, audienceFor } from '../server/importer/classify.js';
import { parseRobots, createHttp, USER_AGENT } from '../server/importer/http.js';
import { parseEventLinks, normalizeTickchak, findEventHash, findEventScript, isEid, createTickchakAdapter } from '../server/importer/adapters/tickchak.js';
import { toEventFields, planUpdate } from '../server/importer/pipeline.js';
import { createFakeFetch } from './helpers/fakeTickchak.js';

const FX = new URL('./fixtures/tickchak/', import.meta.url);
const fx = (f) => fs.readFileSync(new URL(f, FX), 'utf8');
const NOW = new Date('2026-10-22T10:00:00Z');

describe('php unserialize (location_map)', () => {
  test('Hebrew strings use byte lengths', () => {
    const v = { title: 'היכל התרבות בני ברק', cleanTitle: "רחוב ז'בוטינסקי 120, בני ברק", lat: 32.08, zoom: 16, ok: true, n: null };
    assert.deepEqual(phpUnserialize(phpSerialize(v)), v);
  });
  test('the fixture location_map parses', () => {
    const init = JSON.parse(fx('init/h1a2b3c4d5e6.json'));
    const m = phpUnserialize(init.event.location_map);
    assert.equal(m.cleanTitle, "רחוב ז'בוטינסקי 120, בני ברק, ישראל");
  });
  test('malformed input → undefined (never throws)', () => {
    assert.equal(phpUnserialize('a:2:{s:5:"title";s:99:"short";}'), undefined);
    assert.equal(phpUnserialize(''), undefined);
    assert.equal(phpUnserialize(null), undefined);
  });
});

describe('dates (Israel time)', () => {
  test('unix seconds / ms / google format / local strings', () => {
    const winter = parseWhen('1797357600'); // 2026-12-15 18:00Z
    assert.deepEqual(israelParts(winter), { date: '2026-12-15', time: '20:00' });
    assert.equal(+parseWhen(1797357600000), +winter);
    assert.equal(+parseWhen('20261215T200000'), +winter);          // Israel local (UTC+2 in December)
    assert.equal(+parseWhen('20261215T180000Z'), +winter);
    assert.equal(+parseWhen('2026-12-15 20:00:00'), +winter);
    assert.equal(+parseWhen('15/12/2026 20:00'), +winter);
    const summer = parseWhen('2026-07-01 20:00');                 // UTC+3 in summer
    assert.equal(summer.toISOString(), '2026-07-01T17:00:00.000Z');
  });
  test('missing / zero / date-only → null', () => {
    for (const v of [null, '', '0', 0, '2026-12-15', 'מחר']) assert.equal(parseWhen(v), null, String(v));
  });
  test('NASHI date = midnight UTC of the Israeli day', () => {
    assert.equal(nashiDate(new Date('2026-12-15T23:30:00Z')).toISOString(), '2026-12-16T00:00:00.000Z'); // 01:30 local next day
  });
});

describe('city → region', () => {
  const cases = [
    ["רחוב ז'בוטינסקי 120, בני ברק, ישראל", 'בני ברק', 'center'],
    ['שדרות שזר 1, ירושלים', 'ירושלים', 'jerusalem'],
    ['רמות, ירושלים', 'ירושלים', 'jerusalem'],
    ['אבני נזר 4, קרית ספר', 'מודיעין עילית', 'shomron'],
    ['הירקון 1, תל אביב-יפו', 'תל אביב', 'center'],
    ['30600 ת"ד 52, הנשיא 80, אור עקיבא, ישראל', 'אור עקיבא', 'haifa'],
    ['אולם שמחות בבני ברק', 'בני ברק', 'center'],
    ['מתנ"ס, קרית גת', 'קריית גת', 'south'],
    ['היכל התרבות - מגדל העמק', 'מגדל העמק', 'north'],
    ['בית הכנסת, רכסים', 'רכסים', 'haifa'],
  ];
  for (const [text, city, region] of cases) test(text, () => {
    const r = resolveCity(text);
    assert.ok(r, `no city for ${text}`);
    assert.equal(r.city, city);
    assert.equal(r.region, region);
  });
  test('unknown place → null', () => {
    assert.equal(resolveCity('אולם הגן הקסום, ישראל'), null);
    assert.equal(resolveCity(''), null);
  });
  test('structured city field wins over the free text', () => {
    assert.equal(resolveCity(['ירושלים'], 'אולם בבני ברק').city, 'ירושלים');
  });
});

describe('women + Haredi/religious classification', () => {
  const yes = [
    { title: 'ערב נשים לחנוכה', description: 'לנשים ולנערות בלבד, בהפרדה מלאה' },
    { title: 'המחזמר "אמא"', description: 'מחזמר לנשים ולנערות בלבד' },
    { title: 'שיעור עם הרבנית ימימה לנשים' },
    { title: 'הופעה של זמרת', description: 'לנשים', strong: true },        // Glatticket
  ];
  const no = [
    [{ title: 'ערב סטנדאפ לנשים בבר' }, /סטנדאפ|בבר/],
    [{ title: 'הצגת חנוכה לכל המשפחה' }, /לכל המשפחה/],
    [{ title: 'ערב בנות עם קוקטיילים', description: 'לנשים בלבד' }, /קוקטיילים/],
    [{ title: 'הופעה של אריאל זילבר' }, /לנשים/],
    [{ title: 'ערב נשים בתל אביב', description: 'ערב כיף עם מוזיקה וריקודים' }, /דתי\/חרדי/],
    [{ title: 'כנס', description: 'גברים ונשים מוזמנים' }, /מעורב/],
    [{ title: 'ערב לנשים', description: 'קהל מעורב' }, /מעורב/],
    [{ title: 'הופעה לגברים בלבד', strong: true }, /גברים/],
  ];
  for (const e of yes) test(`✓ ${e.title}`, () => assert.equal(classifyEvent(e).ok, true, JSON.stringify(classifyEvent(e))));
  for (const [e, why] of no) test(`✗ ${e.title}`, () => {
    const r = classifyEvent(e);
    assert.equal(r.ok, false);
    assert.match(r.reason, why);
  });
  test('niqqud does not hide a marker', () => assert.equal(classifyEvent({ title: 'עֶרֶב לְנָשִׁים בִּלְבַד' }).ok, true));
  test('category + audience mapping', () => {
    assert.equal(categoryFor('שיעור עם הרבנית'), 'תורה ויהדות');
    assert.equal(categoryFor('סדנת שזירת חלות'), 'סדנאות');
    assert.equal(categoryFor('מופע עם הזמרת'), 'מוזיקה');
    assert.equal(categoryFor('המחזמר אמא'), 'בידור');
    assert.equal(categoryFor('משהו אחר'), 'אחר');
    assert.deepEqual(audienceFor('לנשים ולנערות'), ['נשים ובנות']);
    assert.deepEqual(audienceFor('לנשים בלבד'), ['נשים בלבד']);
  });
});

describe('completeness', () => {
  const full = { title: 'ערב נשים', startAt: new Date('2026-12-01T18:00:00Z'), venue: 'היכל', city: 'בני ברק', priceMin: 60, isFree: false, ticketUrl: 'https://tickchak.co.il/eX', imageUrl: 'https://static.tickchak.co.il/u/f.jpg' };
  test('complete event has nothing missing', () => assert.deepEqual(missingFields(full, NOW), []));
  test('free counts as a price', () => assert.deepEqual(missingFields({ ...full, priceMin: 0, isFree: true }, NOW), []));
  const each = [
    [{ title: '' }, 'שם'], [{ startAt: null }, 'תאריך ושעה'], [{ startAt: new Date('2026-01-01') }, 'עבר'],
    [{ venue: '' }, 'מקום'], [{ city: '' }, 'עיר מוכרת'], [{ priceMin: NaN }, 'מחיר'], [{ priceMin: 0 }, 'מחיר'],
    [{ ticketUrl: '' }, 'קישור לרכישה'], [{ ticketUrl: 'http://insecure' }, 'קישור לרכישה'],
    [{ imageUrl: '' }, 'פלייר'], [{ imageUrl: 'https://static.tickchak.co.il/images/live/more/eventNew.jpg' }, 'פלייר'],
  ];
  for (const [patch, field] of each) test(`missing ${field} (${JSON.stringify(patch)})`, () => assert.ok(missingFields({ ...full, ...patch }, NOW).includes(field)));
});

describe('robots.txt + polite client', () => {
  test('rules', () => {
    const ok = parseRobots('User-agent: *\nDisallow: /admin\nAllow: /admin/public\n\nUser-agent: OtherBot\nDisallow: /');
    assert.equal(ok('/event/1'), true);
    assert.equal(ok('/admin/x'), false);
    assert.equal(ok('/admin/public/x'), true);
    assert.equal(parseRobots('User-agent: NashiEventsBot\nDisallow: /')('/x'), false);
    assert.equal(parseRobots('')('/x'), true);
  });
  test('sends our User-Agent, respects robots, caches GETs', async () => {
    const { fetchImpl, calls } = createFakeFetch();
    const http = createHttp({ fetchImpl, minIntervalMs: 0 });
    await http.getText('https://home.glatticket.co.il/');
    await http.getText('https://home.glatticket.co.il/');
    await assert.rejects(http.getText('https://tickchak.co.il/admin/secret'), /robots/);
    const pages = calls.filter(c => c.url === 'https://home.glatticket.co.il/');
    assert.equal(pages.length, 1, 'second GET came from the cache');
    assert.ok(calls.every(c => c.ua === USER_AGENT));
  });
  test('rate limit spaces requests to the same host', async () => {
    const { fetchImpl } = createFakeFetch();
    const http = createHttp({ fetchImpl, minIntervalMs: 120, respectRobots: false });
    const t0 = Date.now();
    await Promise.all([http.getText('https://tickchak.co.il/a1'), http.getText('https://tickchak.co.il/a2'), http.getText('https://tickchak.co.il/a3')].map(p => p.catch(() => {})));
    assert.ok(Date.now() - t0 >= 230, 'three requests take at least two intervals');
  });
});

describe('Tickchak / Glatticket parsing', () => {
  test('event ids', () => {
    for (const ok of ['eGlt7Hnk2', 'eMnvDANlx', 'eWjYbgpon']) assert.ok(isEid(ok), ok);
    for (const bad of ['events', 'eventsxx', 'about', 'e12', 'terms']) assert.ok(!isEid(bad), bad);
  });
  test('Glatticket home: links + "הופעות לנשים" section', () => {
    const links = parseEventLinks(fx('glatticket-home.html'));
    assert.deepEqual(links.map(l => l.eid).sort(), ['eGen5Xx9g', 'eGlt7Hnk2']);
    assert.equal(links.find(l => l.eid === 'eGlt7Hnk2').women, true);
    assert.equal(links.find(l => l.eid === 'eGen5Xx9g').women, false);
  });
  test('LIVE hub links (/…/event/<id>)', () => {
    assert.deepEqual(parseEventLinks(fx('live-women-hub.html')).map(l => l.eid).sort(), ['eLiv4Ww8x', 'eWmn4Kq8z']);
  });
  test('event_hash from the ev_ script', () => {
    const html = fx('page-eGlt7Hnk2.html');
    assert.equal(findEventScript(html), 'https://static.tickchak.co.il/js/ev_eGlt7Hnk2.js?v=1729');
    assert.equal(findEventHash(fx('ev_eGlt7Hnk2.js')), 'h1a2b3c4d5e6');
    assert.equal(findEventHash(html), '');
  });
  test('normalize: prices (active tickets only), city, time, flyer, Glatticket attribution', () => {
    const n = normalizeTickchak({ init: JSON.parse(fx('init/h1a2b3c4d5e6.json')), pageUrl: 'https://glatticket.co.il/eGlt7Hnk2', pageHtml: fx('page-eGlt7Hnk2.html'), listItem: { eid: 'eGlt7Hnk2' } });
    assert.equal(n.title, 'ערב נשים לחנוכה עם הזמרת חני ויס');
    assert.equal(n.priceMin, 60); assert.equal(n.priceMax, 90); assert.equal(n.isFree, false);
    assert.equal(n.tickets.length, 2);
    assert.equal(n.city, 'בני ברק'); assert.equal(n.region, 'center');
    assert.equal(n.venue, 'היכל התרבות בני ברק');
    assert.deepEqual(israelParts(n.startAt), { date: '2026-12-15', time: '20:00' });
    assert.equal(n.imageUrl, 'https://static.tickchak.co.il/uploads/events/eGlt7Hnk2/flyer.jpg');
    assert.equal(n.sourceName, 'גלאטיקט'); assert.equal(n.strong, true);
    assert.equal(n.soldOut, false); assert.equal(n.closed, false);
    assert.match(n.description, /לנשים ולנערות בלבד/);
    assert.doesNotMatch(n.description, /<b>/);
  });
  test('normalize: free event, google time, structured city', () => {
    const n = normalizeTickchak({ init: JSON.parse(fx('init/h7f8e9d0c1b2.json')), pageUrl: 'https://tickchak.co.il/eWmn4Kq8z', pageHtml: fx('page-eWmn4Kq8z.html'), listItem: { eid: 'eWmn4Kq8z' } });
    assert.equal(n.isFree, true); assert.equal(n.priceMin, 0);
    assert.equal(n.city, 'ירושלים');
    assert.deepEqual(israelParts(n.startAt), { date: '2027-01-10', time: '19:30' });
    assert.equal(n.sourceName, "טיקצ'אק");
  });
  test('normalize: sold out (flag or all tickets inactive)', () => {
    const n = normalizeTickchak({ init: JSON.parse(fx('init/h7777eeee.json')), pageUrl: 'https://tickchak.co.il/eSld2Uu6e', pageHtml: fx('page-eSld2Uu6e.html') });
    assert.equal(n.soldOut, true);
  });
  test('discover + details end to end on fixtures', async () => {
    const { fetchImpl } = createFakeFetch();
    const http = createHttp({ fetchImpl, minIntervalMs: 0 });
    const errors = [];
    const ad = createTickchakAdapter({ searchTerms: ['נשים', 'הצגה'] });
    const cands = await ad.discover(http, { channel: async (n, fn) => { try { await fn(); } catch (e) { errors.push(n + e.message); } } });
    assert.deepEqual(errors, []);
    const ids = cands.map(c => c.sourceId).sort();
    assert.ok(ids.includes('eGlt7Hnk2') && ids.includes('eWmn4Kq8z') && ids.includes('eLiv4Ww8x'));
    assert.equal(cands.find(c => c.sourceId === 'eGlt7Hnk2').strong, true);
    assert.equal(cands.find(c => c.sourceId === 'eWmn4Kq8z').women, true, 'listed on the women hub too');
    assert.equal(ad.prefilter(cands.find(c => c.sourceId === 'ePst1Tt5d'), NOW), 'עבר');
    assert.match(ad.prefilter(cands.find(c => c.sourceId === 'eMix5Qq2a'), NOW), /לא מתאים/);
    const n = await ad.details(cands.find(c => c.sourceId === 'eWmn4Kq8z'), http);
    assert.equal(n.isFree, true);
    await assert.rejects(ad.details(cands.find(c => c.sourceId === 'eLiv4Ww8x'), http), (e) => e.skip === true);
  });
});

describe('mapping to NASHI events + update plan', () => {
  const n = normalizeTickchak({ init: JSON.parse(fx('init/h1a2b3c4d5e6.json')), pageUrl: 'https://glatticket.co.il/eGlt7Hnk2', pageHtml: fx('page-eGlt7Hnk2.html'), listItem: { eid: 'eGlt7Hnk2' } });
  const f = toEventFields(n);
  test('fields', () => {
    assert.equal(f.date.toISOString(), '2026-12-15T00:00:00.000Z');
    assert.equal(f.time, '20:00');
    assert.equal(f.city, 'בני ברק'); assert.equal(f.region, 'center'); assert.equal(f.scope, 'local');
    assert.equal(f.price, 60);
    assert.equal(f.category, 'מוזיקה');
    assert.deepEqual(f.audience, ['נשים ובנות']);
    assert.equal(f.ticketLink, 'https://glatticket.co.il/eGlt7Hnk2');
    assert.match(f.notes, /כרטיס רגיל ₪60 · שורות ראשונות ₪90/);
    assert.ok(f.hebrewDate.length > 3);
  });
  test('no change → nothing to write', () => {
    assert.equal(planUpdate({ ...f }, f).changed, false);
  });
  test('price / sold-out change → written', () => {
    const p = planUpdate({ ...f }, { ...f, price: 70, soldOut: true });
    assert.deepEqual(Object.keys(p.set).sort(), ['price', 'soldOut']);
  });
  test('a manager edited it → her text stays, facts still update', () => {
    const p = planUpdate({ ...f, importEdited: true, title: 'הכותרת שלה' }, { ...f, title: 'כותרת מהמקור', soldOut: true });
    assert.equal(p.set.title, undefined);
    assert.equal(p.set.soldOut, true);
    assert.equal(p.imageChanged, false);
  });
  test('gone event that is back → unhidden; admin-hidden stays hidden', () => {
    assert.equal(planUpdate({ ...f, hidden: true, hiddenReason: 'gone' }, f).set.hidden, false);
    assert.equal(planUpdate({ ...f, hidden: true, hiddenReason: 'admin' }, f).set.hidden, undefined);
  });
});

// ---------------- with a real (throwaway) MongoDB ----------------
const MONGO = process.env.MONGO_TEST_URI;
describe('pipeline against MongoDB (dedupe, update, hide, never touch manual events)', { skip: !MONGO && 'set MONGO_TEST_URI to run' }, () => {
  let mongoose, Event, ImportRun, ImportBlock, runImport;
  before(async () => {
    mongoose = (await import('mongoose')).default;
    await mongoose.connect(MONGO);
    ({ Event, ImportRun, ImportBlock } = await import('../server/models.js'));
    ({ runImport } = await import('../server/importer/pipeline.js'));
    await Promise.all([Event.deleteMany({}), ImportRun.deleteMany({}), ImportBlock.deleteMany({})]);
    await Event.syncIndexes();
  });
  after(async () => { await mongoose.disconnect(); });

  // the clock moves forward a minute per call, like real time between runs
  let tick = 0;
  const clock = () => new Date(NOW.getTime() + 60000 * tick++);
  const go = (overrides) => {
    const { fetchImpl } = createFakeFetch(overrides);
    return runImport({ adapters: [createTickchakAdapter({ searchTerms: ['נשים', 'הצגה'] })], http: createHttp({ fetchImpl, minIntervalMs: 0 }), models: { Event, ImportRun, ImportBlock }, now: clock, trigger: 'test', log: () => {} });
  };

  test('run 1: only complete women/religious events are created', async () => {
    const manual = await Event.create({ title: 'אירוע ידני', date: new Date('2026-12-01'), location: 'מתנ"ס', city: 'עפולה' });
    const run = await go();
    assert.equal(run.status, 'done');
    const created = await Event.find({ source: 'tickchak' }).lean();
    assert.deepEqual(created.map(e => e.sourceId).sort(), ['eGlt7Hnk2', 'eWmn4Kq8z']);
    const glatt = created.find(e => e.sourceId === 'eGlt7Hnk2');
    assert.match(glatt.image, /^data:image\/jpeg;base64,/);
    assert.equal(glatt.region, 'center');
    assert.equal(glatt.sourceName, 'גלאטיקט');
    assert.equal(glatt.hidden, false);
    const reasons = Object.fromEntries(run.skipped.map(s => [s.sourceId, s.reason]));
    assert.match(reasons.eMix5Qq2a, /לא מתאים/);
    assert.match(reasons.eNoP7Rr3b, /מחיר/);
    assert.match(reasons.eCty8Ss4c, /עיר/);
    assert.equal(reasons.ePst1Tt5d, 'עבר');
    assert.equal(reasons.eSld2Uu6e, 'אזלו הכרטיסים');
    assert.match(reasons.eImg3Vv7f, /פלייר/);
    assert.match(reasons.eLiv4Ww8x, /event_hash/);
    assert.match(reasons.eSec6Yy0h, /דתי\/חרדי/);
    assert.equal(run.counts.created, 2);
    assert.ok(run.errorMessages.some(e => /eGen5Xx9g/.test(e)), 'a broken event page is an error, not a crash');
    assert.equal((await Event.findById(manual._id).lean()).title, 'אירוע ידני');
  });

  test('run 2 (same data): dedupe — nothing new, nothing changed', async () => {
    const run = await go();
    assert.equal(run.counts.created, 0);
    assert.equal(run.counts.updated, 0);
    assert.equal(await Event.countDocuments({ source: 'tickchak' }), 2);
  });

  test('run 3: price change + sold out are updated; removed event is hidden; manual event untouched', async () => {
    const run = await go({
      init: (hash, json) => hash === 'h1a2b3c4d5e6' ? { ...json, event: { ...json.event, issoldout: '1' }, tickets: json.tickets.map(t => ({ ...t, price: t.price === '60' ? '65' : t.price })) } : json,
      search: (term, json) => ({ ...json, events: json.events.filter(e => e.eid !== 'eWmn4Kq8z') }),
      handle: ({ u }) => (u.host === 'live.tickchak.co.il' && u.pathname === '/performances-for-women') ? new Response('<html><body></body></html>', { headers: { 'content-type': 'text/html' } }) : null,
    });
    const g = await Event.findOne({ sourceId: 'eGlt7Hnk2' }).lean();
    assert.equal(g.price, 65);
    assert.equal(g.soldOut, true);
    const gone = await Event.findOne({ sourceId: 'eWmn4Kq8z' }).lean();
    assert.equal(gone.hidden, true); assert.equal(gone.hiddenReason, 'gone');
    assert.ok(run.counts.updated >= 1);
    assert.equal(await Event.countDocuments({ source: { $exists: false } }), 1);
  });

  test('back on the source → visible again; admin-hidden and deleted stay out', async () => {
    await Event.updateOne({ sourceId: 'eGlt7Hnk2' }, { hidden: true, hiddenReason: 'admin' });
    const run = await go();
    assert.equal((await Event.findOne({ sourceId: 'eWmn4Kq8z' }).lean()).hidden, false);
    assert.equal((await Event.findOne({ sourceId: 'eGlt7Hnk2' }).lean()).hidden, true);
    // delete + block
    const ev = await Event.findOne({ sourceId: 'eWmn4Kq8z' });
    await ImportBlock.create({ source: 'tickchak', sourceId: 'eWmn4Kq8z' });
    await ev.deleteOne();
    const run2 = await go();
    assert.equal(await Event.countDocuments({ sourceId: 'eWmn4Kq8z' }), 0);
    assert.ok(run2.skipped.some(s => s.sourceId === 'eWmn4Kq8z' && /נמחק/.test(s.reason)));
    assert.equal(run.status, 'done');
  });

  test('past imported events are hidden', async () => {
    await Event.updateOne({ sourceId: 'eGlt7Hnk2' }, { hidden: false, hiddenReason: null, startAt: new Date('2026-10-01T18:00:00Z') });
    const { fetchImpl } = createFakeFetch({ search: () => ({ events: [] }), handle: ({ u }) => (u.host.includes('glatticket') || u.host.startsWith('live.')) ? new Response('<html></html>') : null });
    await runImport({ adapters: [createTickchakAdapter({ searchTerms: ['נשים'] })], http: createHttp({ fetchImpl, minIntervalMs: 0 }), models: { Event, ImportRun, ImportBlock }, now: clock, trigger: 'test', log: () => {} });
    const g = await Event.findOne({ sourceId: 'eGlt7Hnk2' }).lean();
    assert.equal(g.hidden, true);
  });
});

describe('robots.txt unavailable', () => {
  test('network error on robots.txt → the site is skipped, not crawled', async () => {
    let pages = 0;
    const fetchImpl = async (url) => { if (url.endsWith('/robots.txt')) throw new Error('ECONNRESET'); pages++; return new Response('x'); };
    const http = createHttp({ fetchImpl, minIntervalMs: 0 });
    await assert.rejects(http.getText('https://tickchak.co.il/eGlt7Hnk2'), /לא זמין/);
    assert.equal(pages, 0);
  });
  test('404 robots.txt → allowed', async () => {
    const fetchImpl = async (url) => url.endsWith('/robots.txt') ? new Response('', { status: 404 }) : new Response('ok');
    const http = createHttp({ fetchImpl, minIntervalMs: 0 });
    assert.equal((await http.getText('https://tickchak.co.il/x')).text, 'ok');
  });
});
