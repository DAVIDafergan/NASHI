// The events agent against REAL captures from tickchak.co.il / glatticket.co.il (tests/fixtures/real, 2026-10-22).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHttp } from '../server/importer/http.js';
import { createTickchakAdapter, parseEventLinks, findEventScript, findEventHash, isSoldOut, normalizeTickchak } from '../server/importer/adapters/tickchak.js';
import { classifyEvent, missingFields } from '../server/importer/classify.js';
import { phpUnserialize } from '../server/importer/php.js';
import { israelParts } from '../server/importer/time.js';
import { toEventFields } from '../server/importer/pipeline.js';
import { createRealFetch, readReal, REAL_NOW } from './helpers/fakeReal.js';

const http = () => createHttp({ fetchImpl: createRealFetch().fetchImpl, minIntervalMs: 0 });
const details = (eid, url) => createTickchakAdapter({ hubs: [] }).details({ sourceId: eid, url, listItem: { eid } }, http());
const verdict = (n) => classifyEvent({ title: n.title, description: `${n.description}\n${n.extraText}`, location: n.location, strong: n.strong });

describe('real page formats', () => {
  test('robots.txt that is really the HTML homepage (200 text/html) = no rules, the site is crawled', async () => {
    const { text } = await http().getText('https://tickchak.co.il/113538');
    assert.match(text, /og:image/);
  });
  test('ev_ script URL (long token + uuid) and event_hash', () => {
    assert.equal(findEventScript(readReal('tc-113538.html')).replace(/^(https?:)?\/\//, 'https://'), readReal('tc-113538.ev-url.txt').trim());
    assert.equal(findEventScript(readReal('glatt-113204.html')).replace(/^(https?:)?\/\//, 'https://'), readReal('glatt-113204.ev-url.txt').trim());
    assert.equal(findEventHash(readReal('tc-113538.ev.js')), 'F90TUxFjSJZ1RQVUVnR2K6llcuV1MphFe');
  });
  test('location_map (PHP-serialized, Hebrew byte lengths)', () => {
    const m = phpUnserialize(JSON.parse(readReal('glatt-113204.form-init.json')).event.location_map);
    assert.equal(m.cleanTitle, 'שדרות מנחם בגין, 51, גדרה');
    assert.equal(m.title, 'שדרות מנחם בגין 51, גדרה, ישראל');
  });
  test('issoldout is a remaining-tickets COUNT ("41"), not a flag', () => {
    const tc = JSON.parse(readReal('tc-113538.form-init.json'));
    assert.equal(tc.event.issoldout, '41');
    assert.equal(isSoldOut(tc.event, tc.tickets), false);
    assert.equal(isSoldOut({ ...tc.event, issoldout: '1' }, tc.tickets), false, '"1" = one ticket left');
    assert.equal(isSoldOut({ ...tc.event, issoldout: '0' }, tc.tickets), true);
    assert.equal(isSoldOut(tc.event, tc.tickets.map(t => ({ ...t, active: 0 }))), true);
    assert.equal(isSoldOut(tc.event, tc.tickets.map(t => ({ ...t, amount_avaliable: 0 }))), true);
  });
  test('Glatticket home: JSON-LD events with numeric sale-page ids, women + sold-out hints', () => {
    const links = parseEventLinks(readReal('glatt-home.html'));
    assert.ok(links.length >= 20);
    assert.ok(links.every(l => /^\d+$/.test(l.eid)));
    const n = links.find(l => l.eid === '113204');
    assert.equal(n.title, 'הצגה נעדרות');
    assert.equal(n.women, true);
    assert.equal(links.find(l => l.eid === '113282').soldOut, true);
  });
});

describe('real events', () => {
  test('113204 "הצגה נעדרות" (Glatticket) → complete, גדרה, center, ₪40, flyer', async () => {
    const n = await details('113204', 'https://glatticket.co.il/113204');
    assert.equal(n.title, 'הצגה נעדרות');
    assert.equal(n.city, 'גדרה');
    assert.equal(n.region, 'center');
    assert.equal(n.priceMin, 40);
    assert.equal(n.isFree, false);
    assert.equal(n.imageUrl, 'https://static.tickchak.co.il/caps/113204_screenshot-1788836894922.jpeg');
    assert.equal(n.ticketUrl, 'https://glatticket.co.il/113204');
    assert.equal(n.venue, 'אולם רמון');
    assert.equal(n.sourceName, 'גלאטיקט');
    assert.equal(n.strong, true, 'glatticket_index = 1');
    assert.equal(n.soldOut, false);
    assert.deepEqual(israelParts(n.startAt), { date: '2026-11-17', time: '20:00' }); // time_start (show); time_google_openstart 19:00 = doors
    assert.deepEqual(missingFields(n, REAL_NOW), []);
    const v = verdict(n);
    assert.equal(v.ok, true, JSON.stringify(v)); // its only marker is the typo "לנשיםנבלבד"
    assert.equal(toEventFields(n).price, 40);
  });
  test('113538 "שרות קרליבך" (Tickchak) → ירושלים, ₪50, women only', async () => {
    const n = await details('113538', 'https://tickchak.co.il/113538');
    assert.equal(n.title, 'שרות קרליבך');
    assert.equal(n.city, 'ירושלים');
    assert.equal(n.region, 'jerusalem');
    assert.equal(n.priceMin, 50);
    assert.equal(n.sourceName, "טיקצ'אק");
    assert.equal(n.imageUrl, 'https://static.tickchak.co.il/caps/113538_screenshot-1790094494137.jpeg');
    assert.deepEqual(israelParts(n.startAt), { date: '2026-10-22', time: '20:15' });
    assert.deepEqual(missingFields(n, REAL_NOW), []);
    assert.equal(verdict(n).womenOnly, true);
  });
});

describe('real search results ("לנשים", 60 events)', () => {
  const list = JSON.parse(readReal('search-lanashim.json')).events;
  const ad = createTickchakAdapter({ hubs: [] });
  const pre = (eid) => { const e = list.find(x => String(x.eid) === eid); return ad.prefilter({ sourceId: eid, listItem: e }, REAL_NOW); };
  test('shape: numeric eid, link without scheme, in_stock boolean, unix times (null for some series)', () => {
    assert.equal(list.length, 60);
    assert.ok(list.every(e => Number.isInteger(e.eid) && typeof e.in_stock === 'boolean' && (e.time_start === null || Number.isInteger(e.time_start))));
    assert.match(list[0].link, /^tickchak\.co\.il\/\d+\?ref=/);
  });
  test('past events are dropped before any page is fetched', () => {
    assert.equal(list.filter(e => pre(String(e.eid)) === 'עבר').length, 45);
  });
  test('upcoming women/religious events pass the list check; mixed / men / family events do not', () => {
    for (const ok of ['113538', '115386', '96242']) assert.equal(pre(ok), '', ok);
    assert.match(pre('66750'), /לגברים/);
    assert.match(pre('86796'), /לכל המשפחה/);
  });
});

// ---------------- full pipeline over the real captures (throwaway MongoDB) ----------------
const MONGO = process.env.MONGO_TEST_URI;
describe('pipeline over real captures', { skip: !MONGO && 'set MONGO_TEST_URI to run' }, () => {
  let mongoose, Event, ImportRun, ImportBlock, runImport;
  before(async () => {
    mongoose = (await import('mongoose')).default;
    await mongoose.connect(MONGO.replace(/\/[^/]*$/, '/nashi_test_real'));
    ({ Event, ImportRun, ImportBlock } = await import('../server/models.js'));
    ({ runImport } = await import('../server/importer/pipeline.js'));
    await Promise.all([Event.deleteMany({}), ImportRun.deleteMany({}), ImportBlock.deleteMany({})]);
    await Event.syncIndexes();
  });
  after(async () => { await mongoose.disconnect(); });

  test('imports exactly the two complete real events, with region and stored flyer', async () => {
    const run = await runImport({
      adapters: [createTickchakAdapter({ searchTerms: ['לנשים'], hubs: [] })],
      http: http(), models: { Event, ImportRun, ImportBlock }, now: () => REAL_NOW, trigger: 'test', log: () => {},
    });
    const evs = await Event.find({ source: 'tickchak' }).lean();
    assert.deepEqual(evs.map(e => e.sourceId).sort(), ['113204', '113538']);
    const g = evs.find(e => e.sourceId === '113204');
    assert.equal(g.city, 'גדרה'); assert.equal(g.region, 'center'); assert.equal(g.price, 40);
    assert.equal(g.ticketLink, 'https://glatticket.co.il/113204');
    assert.match(g.image, /^data:image\/jpeg;base64,/);
    assert.equal(evs.find(e => e.sourceId === '113538').region, 'jerusalem');
    assert.equal(run.status, 'done');
  });
});
