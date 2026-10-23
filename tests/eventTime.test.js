// "אירועים שעברו יופיע עליהם 'עבר' ל-48 שעות ואז ייעלמו לתמיד"
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eventEndMs, eventStartMs, isEventPast, isEventExpired } from '../shared/eventTime.js';

const H = 3600e3;
describe('when an event ends', () => {
  test('manual event: date (midnight UTC of the day) + "HH:MM" in Israel time, +3h', () => {
    const e = { date: '2026-12-15T00:00:00.000Z', time: '20:00' };            // 20:00 Israel = 18:00Z in winter
    assert.equal(new Date(eventStartMs(e)).toISOString(), '2026-12-15T18:00:00.000Z');
    assert.equal(new Date(eventEndMs(e)).toISOString(), '2026-12-15T21:00:00.000Z');
    const summer = { date: '2026-07-01T00:00:00.000Z', time: '20:00' };     // UTC+3
    assert.equal(new Date(eventStartMs(summer)).toISOString(), '2026-07-01T17:00:00.000Z');
  });
  test('imported: endAt wins; startAt + 3h without it', () => {
    assert.equal(new Date(eventEndMs({ startAt: '2026-11-17T18:00:00Z', endAt: '2026-11-17T20:30:00Z' })).toISOString(), '2026-11-17T20:30:00.000Z');
    assert.equal(new Date(eventEndMs({ startAt: '2026-11-17T18:00:00Z' })).toISOString(), '2026-11-17T21:00:00.000Z');
    assert.equal(new Date(eventEndMs({ startAt: '2026-11-17T18:00:00Z', endAt: '2026-11-17T10:00:00Z' })).toISOString(), '2026-11-17T21:00:00.000Z', 'an end before the start is ignored');
  });
  test('no time → end of its day (Israel); a series ends with its last session', () => {
    assert.equal(new Date(eventEndMs({ date: '2026-12-15T00:00:00.000Z' })).toISOString(), '2026-12-15T21:59:00.000Z');
    const series = { date: '2026-11-01T00:00:00.000Z', time: '10:00', sessions: [{ date: '2026-11-08' }, { date: '2026-11-22' }] };
    assert.equal(new Date(eventEndMs(series)).toISOString(), '2026-11-22T21:59:00.000Z');
  });
  test('past → "עבר" for 48 hours → expired', () => {
    const e = { startAt: '2026-11-17T18:00:00Z' }; // ends 21:00Z
    const at = (iso) => Date.parse(iso);
    assert.equal(isEventPast(e, at('2026-11-17T20:59:00Z')), false);
    assert.equal(isEventPast(e, at('2026-11-17T21:01:00Z')), true);
    assert.equal(isEventExpired(e, at('2026-11-19T20:59:00Z')), false, 'still inside the 48h window');
    assert.equal(isEventExpired(e, at('2026-11-19T21:01:00Z')), true);
    assert.equal(isEventPast({}, Date.now()), false, 'no dates → never treated as past');
  });
});

const MONGO = process.env.MONGO_TEST_URI;
describe('hourly cleanup (MongoDB)', { skip: !MONGO && 'set MONGO_TEST_URI to run' }, () => {
  let mongoose, Event, ImportBlock, cleanupPastEvents, express, server, base;
  before(async () => {
    mongoose = (await import('mongoose')).default;
    await mongoose.connect(MONGO.replace(/\/[^/]*$/, '/nashi_test_cleanup'));
    ({ Event, ImportBlock } = await import('../server/models.js'));
    ({ cleanupPastEvents } = await import('../server/eventCleanup.js'));
    await Promise.all([Event.deleteMany({}), ImportBlock.deleteMany({})]);
    express = (await import('express')).default;
    const routes = (await import('../server/routes.js')).default;
    const app = express(); app.use(express.json()); app.use('/api', routes);
    await new Promise(r => { server = app.listen(0, r); });
    base = `http://127.0.0.1:${server.address().port}/api`;
  });
  after(async () => { server?.close(); await mongoose.disconnect(); });

  test('imported → deleted + blocked; manual → archived; recent and future untouched; public API agrees', async () => {
    const now = Date.now();
    const day = (ms) => new Date(new Date(ms).toISOString().slice(0, 10) + 'T00:00:00.000Z');
    const old = now - 4 * 24 * H;
    await Event.create([
      { title: 'מיובא ישן', date: day(old), startAt: new Date(old), location: 'x', source: 'tickchak', sourceId: '1' },
      { title: 'ידני ישן', date: day(old), time: '10:00', location: 'x' },
      { title: 'מיובא שעבר עכשיו', date: day(now - 4 * H), startAt: new Date(now - 4 * H), location: 'x', source: 'tickchak', sourceId: '2' },
      { title: 'סדרה שעוד לא נגמרה', date: day(old), time: '10:00', location: 'x', sessions: [{ name: 'ב', date: new Date(now + 5 * 24 * H) }] },
      { title: 'עתידי', date: day(now + 3 * 24 * H), time: '20:00', location: 'x' },
    ]);
    // GET /events already leaves out what's past the 48h window, before the job runs
    const before = (await (await fetch(`${base}/events`)).json()).map(e => e.title).sort();
    assert.deepEqual(before, ['מיובא שעבר עכשיו', 'סדרה שעוד לא נגמרה', 'עתידי'].sort());

    const r = await cleanupPastEvents(new Date(now));
    assert.equal(r.deleted, 1); assert.equal(r.archived, 1);
    assert.equal(await Event.countDocuments({ title: 'מיובא ישן' }), 0);
    assert.ok(await ImportBlock.findOne({ source: 'tickchak', sourceId: '1' }), 'blocked so it never comes back');
    assert.equal((await Event.findOne({ title: 'ידני ישן' }).lean()).archived, true);
    assert.equal((await Event.findOne({ title: 'מיובא שעבר עכשיו' }).lean()).archived, false, 'inside its 48h "עבר" window');
    const again = await cleanupPastEvents(new Date(now));
    assert.equal(again.deleted + again.archived, 0, 'idempotent');
    const after = (await (await fetch(`${base}/events`)).json()).map(e => e.title);
    assert.ok(!after.includes('ידני ישן'));
  });
});
