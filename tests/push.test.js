import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mapHttp } from '../server/importer/push.js';

const dir = new URL('./fixtures/binaa/', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, dir), 'utf8');

test('mapHttp serves only pushed pages (www-insensitive)', async () => {
  const h = mapHttp({ 'https://www.modil.org.il/events/': { text: 'x' }, 'https://www.modil.org.il/i.png': { b64: Buffer.from('ab').toString('base64'), type: 'image/png' } });
  assert.equal((await h.getText('https://modil.org.il/events/')).text, 'x');
  assert.equal((await h.getBuffer('https://www.modil.org.il/i.png')).buf.toString(), 'ab');
  await assert.rejects(() => h.getText('https://www.modil.org.il/other/'), /404/);
});

const MONGO = process.env.MONGO_TEST_URI;
describe('push import over real modil.org.il pages', { skip: !MONGO && 'set MONGO_TEST_URI to run' }, () => {
  let mongoose, Event, ImportRun, ImportBlock, runPushImport;
  before(async () => {
    mongoose = (await import('mongoose')).default;
    await mongoose.connect(MONGO.replace(/\/[^/]*$/, '/nashi_test_push'));
    ({ Event, ImportRun, ImportBlock } = await import('../server/models.js'));
    ({ runPushImport } = await import('../server/importer/push.js'));
    await Promise.all([Event.deleteMany({}), ImportRun.deleteMany({}), ImportBlock.deleteMany({})]);
  });
  after(async () => { await mongoose.disconnect(); });
  test('women events in Modiin Illit are imported; nothing is hidden as gone', async () => {
    const pages = {
      'https://www.modil.org.il/events/': { text: read('modil-list.html') },
      'https://www.modil.org.il/events/306/': { text: read('modil-event-306.html') },
      'https://www.modil.org.il/events/311/': { text: read('modil-event-311.html') },
    };
    const run = await runPushImport({ pages, sites: ['www.modil.org.il|מודיעין עילית|1'], models: { Event, ImportRun, ImportBlock }, log: () => {}, now: () => new Date('2026-10-25T08:00:00Z') });
    const evs = await Event.find({ source: 'binaa' }).lean();
    assert.ok(evs.some(e => e.sourceId === 'modil.org.il:306'), JSON.stringify(run.counts) + JSON.stringify(run.skipped?.slice(0, 5)));
    assert.equal(evs.find(e => e.sourceId === 'modil.org.il:306').city, 'מודיעין עילית');
  });
});

test('normalizePushed: a visit-tzfat card → event in Safed, Israel time', async () => {
  const { normalizePushed } = await import('../server/importer/push.js');
  const n = normalizePushed({ id: '2083', title: 'סדנת כתיבה לנשים', date: "ג' 27.10.26", time: '20', place: 'מיליא, גלריית הספרים, רחוב ט"ו 1, צפת', price: '', audience: 'נשים בלבד', description: 'ארבעה מפגשים', link: 'https://visit-tzfat.co.il/events/x/' }, { id: 'visit-tzfat.co.il', city: 'צפת' });
  assert.equal(n.city, 'צפת');
  assert.equal(n.startAt.toISOString(), '2026-10-27T18:00:00.000Z');
  assert.equal(n.ticketUrl, 'https://visit-tzfat.co.il/events/x/');
});
