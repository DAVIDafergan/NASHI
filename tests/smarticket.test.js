// SmarTicket adapter against REAL captures from betshemesh.smarticket.co.il (tests/fixtures/smarticket).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHttp } from '../server/importer/http.js';
import { createSmarticketAdapter, normalizeSmarticket, parseListing, parseCategories, resolveHref, parseHebrewDate, VENUE_CITY, DEFAULT_VENUES } from '../server/importer/adapters/smarticket.js';
import { liveRegionPages } from '../server/importer/adapters/tickchak.js';
import { classifyEvent, missingFields } from '../server/importer/classify.js';
import { israelParts } from '../server/importer/time.js';
import { regionOfCity } from '../shared/regions.js';
import { createSmarticketFetch, readSmart, SMART_NOW } from './helpers/fakeSmarticket.js';

const norm = (id) => normalizeSmarticket({ html: readSmart(`betshemesh-${id}.html`), url: '', venue: 'betshemesh' });
const ok = (n) => classifyEvent({ title: n.title, description: `${n.rawDescription}\n${n.extraText}`, location: n.location, city: n.city, category: n.category, organizer: n.sourceName, strong: n.strong });

describe('SmarTicket pages', () => {
  test('relative links (no leading slash, Hebrew) resolve against the venue', () => {
    assert.equal(resolveHref('betshemesh', 'מיכל_לויטין_-_מופע_חדש_733/?id=786'), 'https://betshemesh.smarticket.co.il/%D7%9E%D7%99%D7%9B%D7%9C_%D7%9C%D7%95%D7%99%D7%98%D7%99%D7%9F_-_%D7%9E%D7%95%D7%A4%D7%A2_%D7%97%D7%93%D7%A9_733/?id=786');
    assert.equal(resolveHref('betshemesh', 'https://evil.example/x?id=1'), '');
  });
  test('categories from the home nav; women category detected', () => {
    const cats = parseCategories('betshemesh', readSmart('betshemesh-home.html'));
    assert.deepEqual(cats.map(c => c.name).sort(), ['בידור', 'הרצאות', 'ילדים', 'מוזיקה', 'נשים', 'תיאטרון'].sort());
    assert.deepEqual(cats.filter(c => c.women).map(c => c.name), ['נשים']);
  });
  test('women category page: its 7 events only (header links that repeat on every page are skipped)', () => {
    const items = parseListing('betshemesh', readSmart('betshemesh-cat-women.html'));
    assert.deepEqual(items.map(i => i.id), ['786', '790', '791', '792', '793', '794', '795']);
    assert.equal(items[0].title, 'מיכל לויטין - מופע חדש');
  });
  test('home page items carry their category', () => {
    const items = parseListing('betshemesh', readSmart('betshemesh-home.html'));
    assert.ok(items.length >= 25);
    assert.equal(items.find(i => i.id === '786').category, 'נשים');
  });
  test('Hebrew date sentence fallback', () => {
    assert.equal(parseHebrewDate('ביום שני, 2 בנובמבר 2026 בשעה 20:30').toISOString(), '2026-11-02T18:30:00.000Z');
    assert.equal(parseHebrewDate('ביום שני, 2 בנובמבר 2026'), null, 'no hour → incomplete');
  });
});

describe('SmarTicket events (real)', () => {
  test('786 "מיכל לויטין - מופע חדש" → בית שמש, 2.11.2026 20:30, women/Haredi, ₪49, flyer', () => {
    const n = norm('786');
    assert.equal(n.title, 'מיכל לויטין - מופע חדש');
    assert.equal(n.sourceId, 'betshemesh:786');
    assert.equal(n.city, 'בית שמש'); assert.equal(n.region, 'jerusalem');
    assert.deepEqual(israelParts(n.startAt), { date: '2026-11-02', time: '20:30' });
    assert.equal(n.priceMin, 49);
    assert.equal(n.imageUrl, 'https://betshemesh.smarticket.co.il/uploads/thumbs/thmb6a784a843ca1c213991048.jpeg');
    assert.match(n.ticketUrl, /^https:\/\/betshemesh\.smarticket\.co\.il\/.+\/\?id=786$/);
    assert.equal(n.sourceName, 'היכל התרבות בית שמש');
    assert.equal(n.strong, true, 'category "חרדיוות"');
    assert.equal(n.soldOut, false); assert.equal(n.closed, false);
    assert.deepEqual(missingFields(n, SMART_NOW), []);
    assert.equal(ok(n).ok, true, 'a stand-up show is fine when the venue lists it as Haredi women');
    assert.match(n.description, /מיכל לויטין במופע סטנד-אפ חדש/);
  });
  test('791 "וכאן אישה גדולה" → 6.1.2027 20:30; single tickets not on sale yet → not imported', () => {
    const n = norm('791');
    assert.deepEqual(israelParts(n.startAt), { date: '2027-01-06', time: '20:30' });
    assert.equal(n.city, 'בית שמש');
    assert.equal(n.closed, true, '"טרם נפתחה רכישת הכרטיסים הבודדים"');
    assert.equal(n.soldOut, false);
    assert.ok(missingFields(n, SMART_NOW, { requirePrice: true }).includes('מחיר'));
    assert.equal(ok(n).ok, true);
  });
  test('price ranges "מחיר 65 עד 70 ₪"', () => {
    const n = norm('742');
    assert.equal(n.priceMin, 65); assert.equal(n.priceMax, 70);
  });
  test('every venue has a city mapping, and mapped cities are real NASHI localities', () => {
    for (const v of DEFAULT_VENUES) assert.ok(v in VENUE_CITY, v);
    for (const [v, c] of Object.entries(VENUE_CITY)) if (c) assert.ok(regionOfCity(c), `${v} → ${c}`);
    assert.equal(VENUE_CITY.betshemesh, 'בית שמש');
  });
});

describe('LIVE regional women pages', () => {
  test('region slugs from the main women page', () => {
    const html = '<a href="https://live.tickchak.co.il/performances-for-women/central">מרכז</a><a href="/performances-for-women/jerusalem-district/">ירושלים</a><a href="/performances-for-women/event/eAbc">x</a><a href="/performances-for-women/central">dup</a>';
    assert.deepEqual(liveRegionPages(html), ['https://live.tickchak.co.il/performances-for-women/central', 'https://live.tickchak.co.il/performances-for-women/jerusalem-district']);
  });
});

const MONGO = process.env.MONGO_TEST_URI;
describe('SmarTicket through the pipeline (MongoDB)', { skip: !MONGO && 'set MONGO_TEST_URI to run' }, () => {
  let mongoose, Event, ImportRun, ImportBlock, runImport;
  before(async () => {
    mongoose = (await import('mongoose')).default;
    await mongoose.connect(MONGO.replace(/\/[^/]*$/, '/nashi_test_smarticket'));
    ({ Event, ImportRun, ImportBlock } = await import('../server/models.js'));
    ({ runImport } = await import('../server/importer/pipeline.js'));
    await Promise.all([Event.deleteMany({}), ImportRun.deleteMany({}), ImportBlock.deleteMany({})]);
    await Event.syncIndexes();
  });
  after(async () => { await mongoose.disconnect(); });
  test('one venue: listing → women candidates → 786 imported; 791 skipped (sales not open)', async () => {
    const { fetchImpl, calls } = createSmarticketFetch();
    const run = await runImport({ adapters: [createSmarticketAdapter({ venues: ['betshemesh'] })], http: createHttp({ fetchImpl, minIntervalMs: 0 }), models: { Event, ImportRun, ImportBlock }, now: () => SMART_NOW, trigger: 'test', log: () => {}, audience: 'broad', allowNoFlyer: true });
    const evs = await Event.find({ source: 'smarticket' }).lean();
    assert.deepEqual(evs.map(e => e.sourceId), ['betshemesh:786']);
    assert.equal(evs[0].city, 'בית שמש'); assert.equal(evs[0].region, 'jerusalem'); assert.equal(evs[0].price, 49);
    assert.match(evs[0].image, /^data:image\/jpeg;base64,/);
    assert.ok(run.skipped.some(s => s.sourceId === 'betshemesh:791'));
    assert.equal(calls.filter(u => /\?id=/.test(u)).length <= 15, true, 'per-venue page cap');
    assert.equal(calls.filter(u => /_page_/.test(decodeURIComponent(u))).length, 1, 'one women category page');
  });
});
