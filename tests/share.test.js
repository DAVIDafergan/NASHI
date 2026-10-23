// WhatsApp share with a preview: /s/event/:id (Open Graph page), /s/img/event/:id (flyer), the message text.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eventPreview, page, imageInfo } from '../server/share.js';
import { shareMessage, factsLine, whenText } from '../shared/eventShare.js';
import { FAKE_PNG } from './helpers/fakeTickchak.js';

const BASE = 'https://nashi-co.com';
const future = new Date(Date.now() + 10 * 864e5);
const day = (d) => new Date(d.toISOString().slice(0, 10) + 'T00:00:00.000Z');
const EV = { _id: '6650a1b2c3d4e5f6a7b8c9d0', title: 'מופע "אמא" <לנשים>', date: day(future), time: '20:30', location: 'היכל התרבות', city: 'בית שמש', price: 49, hebrewDate: 'י״א כסלו', description: 'מופע מרגש לנשים בלבד.\nעוד שורה', image: 'data:image/jpeg;base64,/9j/AAAA' };

describe('message + preview text', () => {
  test('when: weekday d.m · Hebrew date · hour (Israel time)', () => {
    assert.equal(whenText({ startAt: '2026-11-02T18:30:00Z', hebrewDate: 'כ״א חשון' }), 'יום שני 2.11 · כ״א חשון · 20:30');
    assert.equal(whenText({ date: '2026-12-15T00:00:00.000Z', time: '20:00' }), 'יום שלישי 15.12 · 20:00');
  });
  test('facts line: date, place (venue + city), price / חינם', () => {
    assert.equal(factsLine({ startAt: '2026-11-02T18:30:00Z', location: 'היכל התרבות', city: 'בית שמש', price: 49 }, 'כ״א חשון'), '📅 יום שני 2.11 · כ״א חשון · 20:30 · 📍 היכל התרבות, בית שמש · 🎟️ ₪49');
    assert.match(factsLine({ startAt: '2026-11-02T18:30:00Z', location: 'בית שמש', city: 'בית שמש', price: 0 }), /📍 בית שמש · 🎟️ חינם$/);
  });
  test('the WhatsApp message ends with the link (so WhatsApp builds the preview)', () => {
    const m = shareMessage({ ...EV, startAt: '2026-11-02T18:30:00Z' }, `${BASE}/s/event/${EV._id}`);
    const lines = m.split('\n');
    assert.equal(lines[0], '*מופע "אמא" <לנשים>*');
    assert.equal(lines[lines.length - 1], `${BASE}/s/event/${EV._id}`);
    assert.ok(lines.some(l => l.startsWith('📍 היכל התרבות, בית שמש')));
  });
});

describe('/s/event preview page', () => {
  test('fields: title, facts + first line, absolute image, canonical url, deep link', () => {
    const p = eventPreview(EV, BASE);
    assert.equal(p.title, 'מופע "אמא" <לנשים> · נשי');
    assert.match(p.description, /^📅 יום .+ · י״א כסלו · 20:30 · 📍 היכל התרבות, בית שמש · 🎟️ ₪49 — מופע מרגש לנשים בלבד\.$/);
    assert.equal(p.image, `${BASE}/s/img/event/${EV._id}`);
    assert.equal(p.url, `${BASE}/s/event/${EV._id}`);
    assert.equal(p.redirect, `/#/events?e=${EV._id}`);
  });
  test('HTML is escaped (quotes, angle brackets) and has the WhatsApp tags', () => {
    const html = page({ ...eventPreview(EV, BASE), imageMeta: { type: 'image/jpeg', width: 900, height: 600 } });
    assert.ok(html.includes('<meta property="og:title" content="מופע &quot;אמא&quot; &lt;לנשים&gt; · נשי">'));
    assert.ok(!html.includes('<לנשים>'));
    assert.ok(html.includes('<meta property="og:image" content="https://nashi-co.com/s/img/event/6650a1b2c3d4e5f6a7b8c9d0">'));
    assert.ok(html.includes('<meta property="og:image:width" content="900">'));
    assert.ok(html.includes('<meta property="og:image:type" content="image/jpeg">'));
    assert.ok(html.includes('location.replace("/#/events?e=6650a1b2c3d4e5f6a7b8c9d0")'));
  });
  test('an event that ended (past its 48h, archived or hidden) gets an "ended" preview with the site image', () => {
    for (const ev of [{ ...EV, date: new Date('2026-01-01'), time: '20:00' }, { ...EV, archived: true }, { ...EV, hidden: true }]) {
      const p = eventPreview(ev, BASE);
      assert.match(p.title, /^האירוע הסתיים · /);
      assert.equal(p.image, `${BASE}/og-image.jpg`);
      assert.equal(p.redirect, `/#/events?e=${EV._id}`, 'the site explains it ended and links to the region');
    }
  });
  test('generated SVG placeholder flyers are not used as og:image (WhatsApp ignores SVG)', () => {
    assert.equal(eventPreview({ ...EV, image: 'data:image/svg+xml;base64,PHN2Zz4=' }, BASE).image, `${BASE}/og-image.jpg`);
  });
  test('image size sniffing (JPEG SOF / PNG IHDR)', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x84, 0x03, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(imageInfo(jpeg), { type: 'image/jpeg', width: 900, height: 600 });
    const png = Buffer.from(FAKE_PNG); png.writeUInt32BE(800, 16); png.writeUInt32BE(1000, 20);
    assert.deepEqual(imageInfo(png), { type: 'image/png', width: 800, height: 1000 });
  });
});

const MONGO = process.env.MONGO_TEST_URI;
describe('share routes over HTTP (MongoDB)', { skip: !MONGO && 'set MONGO_TEST_URI to run' }, () => {
  let mongoose, Event, server, base, ids = {};
  before(async () => {
    mongoose = (await import('mongoose')).default;
    await mongoose.connect(MONGO.replace(/\/[^/]*$/, '/nashi_test_share'));
    ({ Event } = await import('../server/models.js'));
    await Event.deleteMany({});
    const png = Buffer.from(FAKE_PNG); png.writeUInt32BE(800, 16); png.writeUInt32BE(1000, 20);
    ids.live = (await Event.create({ ...EV, _id: undefined, image: `data:image/png;base64,${png.toString('base64')}` }))._id;
    ids.old = (await Event.create({ ...EV, _id: undefined, date: new Date('2026-01-01'), time: '20:00' }))._id;
    const express = (await import('express')).default;
    const share = (await import('../server/share.js')).default;
    const routes = (await import('../server/routes.js')).default;
    const { restGuard } = await import('../server/calendar.js');
    const app = express(); app.use('/api', restGuard); app.use('/api', routes); app.use(share);
    await new Promise(r => { server = app.listen(0, r); });
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => { server?.close(); await mongoose.disconnect(); });

  test('GET /s/event/:id — preview page with image size; no auth needed', async () => {
    const r = await fetch(`${base}/s/event/${ids.live}`, { headers: { 'User-Agent': 'WhatsApp/2.23.20.0 A' } });
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.ok(html.includes(`<meta property="og:image" content="${base}/s/img/event/${ids.live}">`));
    assert.ok(html.includes('<meta property="og:image:width" content="800">'));
    assert.ok(html.includes('<meta property="og:image:height" content="1000">'));
    assert.match(r.headers.get('cache-control'), /max-age/);
  });
  test('GET /s/img/event/:id — the flyer bytes', async () => {
    const r = await fetch(`${base}/s/img/event/${ids.live}`);
    assert.equal(r.headers.get('content-type'), 'image/png');
    assert.equal((await r.arrayBuffer()).byteLength, FAKE_PNG.length);
  });
  test('ended / unknown events', async () => {
    assert.match(await (await fetch(`${base}/s/event/${ids.old}`)).text(), /האירוע הסתיים/);
    assert.match(await (await fetch(`${base}/s/event/000000000000000000000000`)).text(), /אירועים לנשים · נשי/);
    const r = await fetch(`${base}/s/img/event/${ids.old}`, { redirect: 'manual' });
    assert.equal(r.status, 200, 'the stored flyer still serves (only the preview switches to the site image)');
  });
  test('GET /api/events/:id — the event, or 410 with a summary when it ended', async () => {
    const ok = await fetch(`${base}/api/events/${ids.live}`);
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).title, EV.title);
    const gone = await fetch(`${base}/api/events/${ids.old}`);
    assert.equal(gone.status, 410);
    assert.deepEqual(Object.keys(await gone.json()).sort(), ['city', 'ended', 'region', 'scope', 'title']);
  });
});
