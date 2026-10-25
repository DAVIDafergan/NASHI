// Glatticket as a strong Haredi source (all sections / sub-sites), the false-reject fixes, multi-date events and the
// Tickchak bulk scan.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { strictHaredi, classifyEvent } from '../server/importer/classify.js';
import { parseEventLinks, sectionPages, jsonLdEvents, splitDates, eventDates, createTickchakAdapter, WOMEN_SECTION } from '../server/importer/adapters/tickchak.js';
import { readReal } from './helpers/fakeReal.js';

const drop = (e) => { const r = strictHaredi(e); assert.equal(r.ok, false, `${e.title}: ${JSON.stringify(r)}`); return r; };
const keep = (e) => { const r = strictHaredi(e); assert.equal(r.ok, true, `${e.title}: ${JSON.stringify(r)}`); return r; };

describe('Glatticket home (real capture)', () => {
  const html = readReal('glatt-home.html');
  const links = parseEventLinks(html, { womenHeading: WOMEN_SECTION });
  const byId = Object.fromEntries(links.map(l => [l.key, l]));

  test('every JSON-LD event is found, with title, date and sold-out hint', () => {
    assert.equal(links.length, 22);
    for (const id of ['114965', '115184', '115191', '115192', '115193', '115247', '115644', '113282']) assert.ok(byId[id], id);
    assert.equal(byId['114965'].title, 'עולות לאמא רחל - נשות לוד');
    assert.equal(byId['113282'].soldOut, true);
    assert.equal(byId['115184'].dates.length, 1);
  });

  test('strong source: women-titled events, women on stage and screenings pass; male line-ups do not', () => {
    const verdicts = Object.fromEntries(jsonLdEvents(html).map(e => {
      const id = /\/(\d+)/.exec(e['@id'])[1];
      return [id, strictHaredi({ title: e.name, description: e.description || '', location: e.location?.name || '', strong: true })];
    }));
    // עולות לאמא רחל - נשות לוד · אקסטרוז צהריים/ערב · אחותי ×2 · אמא רחל (נאוה ביבי) · אבודות בדרך לעלמא דחלמא
    for (const id of ['114965', '115184', '115191', '115192', '115193', '115247', '115644', '113282', '114487']) assert.equal(verdicts[id].ok, true, `${id} ${JSON.stringify(verdicts[id])}`);
    // ערב שכולו קרליבך (male singers), no women mark at all
    assert.equal(verdicts['114981'].ok, false);
  });

  test('a women section counts as women-only even without "נשים" in the title', () => {
    keep({ title: 'קומי וצאי', location: 'היכל התרבות רמות', strong: true, womenSection: true });
    drop({ title: 'קומי וצאי', location: 'היכל התרבות רמות', strong: true });
    // the section survives a later re-check through the stored source category
    assert.equal(classifyEvent({ mode: 'haredi', title: 'קומי וצאי', category: 'הופעות לנשים', strong: true }).ok, true);
    // men-only stays out, even in a women's section
    drop({ title: 'ערב ניגונים לגברים', strong: true, womenSection: true });
    drop({ title: 'מופע גברים', strong: true });
  });
});

describe('Glatticket sections and sub-sites', () => {
  const page = `<h2>הופעות לנשים</h2>
    <a href="https://tiferet.glatticket.co.il/AbC123x">תפארת</a>
    <a href="https://home.glatticket.co.il/women-shows">הצג הכל</a>
    <a href="https://live.tickchak.co.il/performances-for-women">כל ההופעות לנשים</a>
    <h2>סרטים</h2><a href="https://restart.glatticket.co.il/Zz9_88">ריסטארט</a><a href="https://home.glatticket.co.il/movies">הצג הכל</a>
    <h2>לגברים</h2><a href="https://glatticket.co.il/123456">x</a>
    <a href="https://home.glatticket.co.il/logo.png">x</a><a href="https://home.glatticket.co.il/privacy">x</a>`;

  test('hash sale pages on tiferet./restart. and the heading each sits under', () => {
    const l = Object.fromEntries(parseEventLinks(page, { womenHeading: WOMEN_SECTION }).map(x => [x.key, x]));
    assert.equal(l['tiferet.glatticket.co.il/AbC123x'].url, 'https://tiferet.glatticket.co.il/AbC123x');
    assert.equal(l['tiferet.glatticket.co.il/AbC123x'].womenSection, true);
    assert.equal(l['restart.glatticket.co.il/Zz9_88'].womenSection, false);
    assert.equal(l['123456'].womenSection, false);
  });

  test('"הצג הכל" / LIVE pages are followed; files and policy pages are not', () => {
    const s = sectionPages(page);
    assert.deepEqual(s.map(x => x.url).sort(), ['https://home.glatticket.co.il/movies', 'https://home.glatticket.co.il/women-shows', 'https://live.tickchak.co.il/performances-for-women']);
    assert.equal(s.find(x => x.url.endsWith('women-shows')).women, true);
    assert.equal(s.find(x => x.url.endsWith('movies')).women, false);
  });

  test('discover: everything reached from the Glatticket home is strong; women pages mark their events', async () => {
    const pages = {
      'https://home.glatticket.co.il/': page,
      'https://home.glatticket.co.il/women-shows': '<h1>הופעות</h1><a href="https://glatticket.co.il/777001">מופע</a><a href="https://live.tickchak.co.il/performances-for-women/bnei-brak">בני ברק</a>',
      'https://home.glatticket.co.il/movies': '<h1>סרטים</h1><a href="https://glatticket.co.il/777002">סרט</a>',
      'https://live.tickchak.co.il/performances-for-women': '<a href="https://tickchak.co.il/777003">x</a>',
      'https://live.tickchak.co.il/performances-for-women/bnei-brak': '<a href="https://tickchak.co.il/777004">x</a>',
    };
    const http = { async getText(u) { if (!(u in pages)) throw new Error(`404 ${u}`); return { text: pages[u], url: u }; }, async postForm() { return { events: [] }; } };
    const errors = [];
    const ctx = { async channel(name, fn) { try { await fn(); } catch (e) { errors.push(`${name}: ${e.message}`); } } };
    const ad = createTickchakAdapter({ searchTerms: [], hubs: [], softHubs: [], detectCategories: false, bulkMax: 0 });
    const c = Object.fromEntries((await ad.discover(http, ctx)).map(x => [x.sourceId, x]));
    assert.deepEqual(errors, []);
    for (const id of ['777001', '777002', '777003', '777004', 'tiferet.glatticket.co.il/AbC123x', 'restart.glatticket.co.il/Zz9_88']) assert.equal(c[id]?.strong, true, id);
    for (const id of ['777001', '777003', '777004', 'tiferet.glatticket.co.il/AbC123x']) assert.equal(c[id].womenSection, true, id);
    assert.equal(c['777002'].womenSection, false);
    assert.equal(c['123456'].womenSection, false);
    assert.equal(c['777001'].url, 'https://glatticket.co.il/777001');
  });
});

describe('false rejects fixed (strict rules kept)', () => {
  test('strict: women-only without a Haredi sign stays out; Glatticket source passes', () => {
    drop({ title: 'מופע לנשים "אבודות בדרך לעלמא דחלמא"', location: 'בית מזי"א, ירושלים' });
    drop({ title: 'פעם שלישית גדילה - הצגה לנשים', location: 'אשכול פיס אריאל' });
    keep({ title: 'הצגה נעדרות', description: 'הצגה קומית לנשים בלבד', location: 'אולם רמון', city: 'גדרה', strong: true });
    drop({ title: 'שרות', description: 'המופע לנשים בלבד! לכבוד הילולת רבי שלמה זצ״ל', location: 'התיאטרון', city: 'תל אביב' });
  });
  test('a Haredi city named only in the location text counts', () => {
    const r = keep({ title: 'המחזמר - מרים הכובסת', location: 'היכל התרבות בית שמש', category: 'נשים' });
    assert.ok(r.reasons.some(x => x.includes('בית שמש')));
  });
  test('still out: bare "נשים", no religious context, hard rejects', () => {
    drop({ title: 'ערב נשים בתל אביב', city: 'תל אביב' });
    drop({ title: 'מופע לנשים', city: 'תל אביב', location: 'הבארבי' });
    drop({ title: 'הצגה נעדרות', description: 'הצגה קומית לנשים בלבד', location: 'אולם רמון', city: 'גדרה' });
    drop({ title: 'מסיבת רווקות לנשים בלבד', location: 'בית מזי"א, ירושלים' });
    drop({ title: 'נשים כובשות עולם', city: 'נתניה', category: 'ערבי נשים' });
  });
});

describe('multi-date events', () => {
  const base = { sourceId: '115000', title: 'צמאה - מופע נשים', startAt: new Date('2026-11-10T18:00:00Z'), endAt: new Date('2026-11-10T20:00:00Z') };

  test('one event per date, same link; the first keeps the plain id', () => {
    const out = splitDates(base, { listDates: ['2026-11-10T20:00:00+02:00', '2026-11-17T20:00:00+02:00', '2026-11-24T20:00:00+02:00'] });
    assert.equal(out.length, 3);
    assert.deepEqual(out.map(e => e.sourceId), ['115000', '115000@2026-11-17T18:00:00.000Z', '115000@2026-11-24T18:00:00.000Z']);
    assert.equal(+out[2].endAt - +out[2].startAt, 2 * 3600e3);
  });

  test('dates from form/init sessions and JSON-LD subEvents; near-identical times merge', () => {
    const init = { event: { sessions: [{ time_start: 1794333600 }, { time_start: 1794938400 }] } };
    const html = '<script type="application/ld+json">{"@type":"Event","name":"x","startDate":"2026-11-10T20:30:00+02:00","subEvent":[{"@type":"Event","startDate":"2026-12-01T20:00:00+02:00"}]}</script>';
    assert.equal(eventDates({ init, pageHtml: html }).length, 4);
    const out = splitDates(base, { pageHtml: html }); // 20:30 is the same show as 20:00 → 2 events
    assert.equal(out.length, 2);
    assert.equal(splitDates(base, {}), base);
  });
});

describe('Tickchak bulk scan', () => {
  test('pages the empty search until it runs dry; bulk-only finds need a women mark at list level', async () => {
    const calls = [];
    const mk = (i, title, extra = {}) => ({ eid: 880000 + i, title, description: '', location: 'אולם', time_start: 1796000000, link: `tickchak.co.il/${880000 + i}`, ...extra });
    const pagesOf = [
      [mk(1, 'ערב נשים בבני ברק'), mk(2, 'הרצאה על כלכלה'), ...Array.from({ length: 98 }, (_, i) => mk(10 + i, `אירוע ${i}`))],
      [mk(200, 'מסיבת ריקודים לנשים'), mk(201, 'קונצרט', { link: 'glatticket.co.il/880201' })],
      [],
    ];
    const http = {
      async getText() { throw new Error('no pages'); },
      async postForm(url, body) { calls.push(body); return { events: body.search === '' ? pagesOf[Number(body.offset) / 100] || [] : [] }; },
    };
    const ctx = { async channel(name, fn) { try { await fn(); } catch { /* the Glatticket home is not served here */ } } };
    const ad = createTickchakAdapter({ searchTerms: [], hubs: [], softHubs: [], detectCategories: false, glatticketHome: 'https://example.invalid/' });
    const cands = await ad.discover(http, ctx);
    assert.equal(calls.length, 3); // 100, 2, then empty
    assert.ok(cands.every(c => c.bulk));
    const now = new Date(1795000000 * 1000);
    const pre = Object.fromEntries(cands.map(c => [c.sourceId, ad.prefilter(c, now, 'haredi')]));
    assert.equal(pre['880001'], '');          // women + Haredi city in the listing → details
    assert.match(pre['880002'], /סריקה מלאה/); // nothing women-ish → no request spent
    assert.match(pre['880200'], /מסיבה/);      // hard reject
    assert.equal(pre['880201'], '');          // Glatticket link → details decide
  });
});

describe('IMPORTER_ALL_CITIES_HAREDI=1 (every city counts as Haredi)', () => {
  test('explicit women-only events anywhere pass; bare "נשות" in a lecture title and hard rejects do not', () => {
    process.env.IMPORTER_ALL_CITIES_HAREDI = '1';
    try {
      keep({ title: 'ערב נשים: סדנת נרות', location: 'מתנ"ס גן', city: 'נתניה' });
      keep({ title: 'הלל ראש חודש – תפילה מוזיקלית לנשים', description: 'לנשים בלבד', city: 'צפת' });
      drop({ title: 'נשות הפנתיאון מרצה סבין יעקובוביץ', location: 'בית אבא חושי', city: 'חיפה' });
      drop({ title: 'מסיבת בחירות לנשים בלבד', city: 'כרמים' });
      drop({ title: 'מופע לנשים', description: 'לנשים בלבד', location: 'קיבוץ עלומים' });
    } finally { delete process.env.IMPORTER_ALL_CITIES_HAREDI; }
  });
});
