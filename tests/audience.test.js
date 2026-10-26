// Audience (men / women / all): shared helpers, and the API — public ?audience= filter, legacy documents read as
// women's, regional managers must pick an audience and keep their region / regionOnly rules.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { audienceOf, matchesAudience, audienceQuery, normAudienceFilter, g } from '../shared/audience.js';
import { BRAND } from '../shared/brand.js';
import jwt from 'jsonwebtoken';

describe('shared/audience.js', () => {
  test('missing / legacy tag array / unknown → women', () => {
    assert.equal(audienceOf({}), 'women');
    assert.equal(audienceOf({ audience: ['נשים בלבד'] }), 'women');
    assert.equal(audienceOf({ audience: 'x' }), 'women');
    assert.equal(audienceOf({ audience: 'men' }), 'men');
    assert.equal(audienceOf('all'), 'all');
  });
  test('filter chips: men / women include items for everyone, never the other audience', () => {
    const men = { audience: 'men' }, women = { audience: 'women' }, all = { audience: 'all' }, old = {};
    assert.deepEqual([men, women, all, old].map(i => matchesAudience(i, 'any')), [true, true, true, true]);
    assert.deepEqual([men, women, all, old].map(i => matchesAudience(i, 'men')), [true, false, true, false]);
    assert.deepEqual([men, women, all, old].map(i => matchesAudience(i, 'women')), [false, true, true, true]);
    assert.deepEqual([men, women, all, old].map(i => matchesAudience(i, 'all')), [false, false, true, false]);
    assert.equal(normAudienceFilter('bogus'), 'any');
    assert.deepEqual(audienceQuery('any'), {});
  });
  test('wording by the person\'s own gender, neutral when unknown', () => {
    const v = { male: 'ברוך הבא', female: 'ברוכה הבאה', neutral: 'ברוכים הבאים' };
    assert.equal(g('male', v), 'ברוך הבא');
    assert.equal(g('female', v), 'ברוכה הבאה');
    assert.equal(g(undefined, v), 'ברוכים הבאים');
    assert.equal(g(null, { male: 'מנהל', female: 'מנהלת' }), 'מנהל/מנהלת');
  });
  test('the brand lives in one place', () => {
    assert.equal(BRAND.name, 'ספוט');
    assert.equal(BRAND.latin, 'SPOT');
  });
});

const MONGO = process.env.MONGO_TEST_URI;
describe('audience over the API (MongoDB)', { skip: !MONGO && 'set MONGO_TEST_URI to run' }, () => {
  let mongoose, M, server, base, adminTok, mgrTok, mgr;

  const call = async (method, path, body, tok) => {
    const r = await fetch(`${base}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  before(async () => {
    mongoose = (await import('mongoose')).default;
    await mongoose.connect(MONGO.replace(/\/[^/]*$/, '/nashi_test_audience'));
    M = await import('../server/models.js');
    await Promise.all([M.Event, M.Class, M.Community, M.Lottery, M.User].map(m => m.deleteMany({})));
    const admin = await M.User.create({ name: 'מנהל ראשי', email: 'a@x.il', password: 'x', isAdmin: true });
    mgr = await M.User.create({ name: 'מנהל אזור', email: 'm@x.il', password: 'x', role: 'regionAdmin', adminRegion: 'jerusalem', gender: 'male' });
    const secret = process.env.JWT_SECRET || 'secret_key_123';
    adminTok = jwt.sign({ id: admin._id, isAdmin: true }, secret);
    mgrTok = jwt.sign({ id: mgr._id, isAdmin: false }, secret);
    // a document from before the field existed, and one with the old tag array (written raw, like old data)
    const d = new Date('2027-01-10T00:00:00Z');
    await M.Event.collection.insertMany([
      { title: 'ישן בלי קהל', date: d, location: 'אולם', city: 'בני ברק', region: 'center', scope: 'local' },
      { title: 'ישן עם תגיות', date: d, location: 'אולם', city: 'בני ברק', region: 'center', scope: 'local', audience: ['נשים בלבד'] },
    ]);
    await M.Event.create([
      { title: 'כנס אברכים', date: d, location: 'היכל', city: 'ירושלים', audience: 'men' },
      { title: 'הצגת ילדים', date: d, location: 'היכל', city: 'ירושלים', audience: 'all' },
    ]);
    const express = (await import('express')).default;
    const routes = (await import('../server/routes.js')).default;
    const app = express(); app.use(express.json({ limit: '5mb' })); app.use('/api', routes);
    await new Promise(r => { server = app.listen(0, r); });
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => { server?.close(); await mongoose.disconnect(); });

  test('GET /events: everything by default; ?audience= narrows (legacy documents count as women\'s)', async () => {
    const titles = async (q) => (await call('GET', `/events${q}`)).body.map(e => e.title).sort();
    assert.equal((await titles('')).length, 4);
    assert.deepEqual(await titles('?audience=men'), ['הצגת ילדים', 'כנס אברכים'].sort());
    assert.deepEqual(await titles('?audience=women'), ['הצגת ילדים', 'ישן בלי קהל', 'ישן עם תגיות'].sort());
    assert.deepEqual(await titles('?audience=all'), ['הצגת ילדים']);
    const old = (await call('GET', '/events')).body.find(e => e.title === 'ישן בלי קהל');
    assert.equal(old.audience, 'women', 'missing audience reads as women (schema default)');
  });

  test('regional manager: audience is required, his/her region and regionOnly are kept', async () => {
    const ev = { title: 'שיעור שבועי', date: '2027-02-01', location: 'בית כנסת', city: 'בית שמש' };
    const none = await call('POST', '/events', ev, mgrTok);
    assert.equal(none.status, 400);
    assert.match(none.body.error, /קהל יעד/);
    assert.equal((await call('POST', '/events', { ...ev, audience: 'boys' }, mgrTok)).status, 400);
    const ok = await call('POST', '/events', { ...ev, audience: 'men', scope: 'national' }, mgrTok);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.audience, 'men');
    assert.equal(ok.body.region, 'jerusalem');
    assert.equal(ok.body.scope, 'local');
    assert.equal(ok.body.regionOnly, true);
    assert.equal(String(ok.body.createdBy), String(mgr._id));
    // other region → refused, as before
    assert.equal((await call('POST', '/events', { ...ev, city: 'חיפה', audience: 'all' }, mgrTok)).status, 403);
    // edit: may switch the audience (to 'all', 'women'…) of an item in the region
    const upd = await call('PUT', `/events/${ok.body._id}`, { audience: 'all' }, mgrTok);
    assert.equal(upd.body.audience, 'all');
  });

  test('classes / community / lotteries take the same field; an old client sending tag arrays is understood', async () => {
    const cls = await call('POST', '/classes', { title: 'חוג גמרא', city: 'ירושלים', audience: 'men' }, mgrTok);
    assert.equal(cls.body.audience, 'men');
    const com = await call('POST', '/community', { title: 'גמ"ח כלים', category: 'גמ"חים', city: 'ירושלים', audience: 'all' }, mgrTok);
    assert.equal(com.body.audience, 'all');
    const lot = await call('POST', '/lotteries', { title: 'הגרלה', drawDate: '2027-03-01', city: 'ירושלים', audience: 'women' }, mgrTok);
    assert.equal(lot.body.audience, 'women');
    // admin, old client: the tag array goes to audienceTags, audience falls back to women
    const legacy = await call('POST', '/classes', { title: 'חוג ישן', city: 'עפולה', audience: ['נשים ובנות'] }, adminTok);
    assert.equal(legacy.status, 200);
    assert.equal(legacy.body.audience, 'women');
    assert.deepEqual(legacy.body.audienceTags, ['נשים ובנות']);
    assert.deepEqual((await call('GET', '/classes?audience=men')).body.map(c => c.title), ['חוג גמרא']);
  });

  test('users can set an optional gender (for wording); junk is ignored', async () => {
    const tok = jwt.sign({ id: mgr._id }, process.env.JWT_SECRET || 'secret_key_123');
    const r = await call('PUT', `/users/${mgr._id}`, { gender: 'female' }, tok);
    assert.equal(r.body.gender, 'female');
    const r2 = await call('PUT', `/users/${mgr._id}`, { gender: 'robot', name: 'מנהל אזור' }, tok);
    assert.equal(r2.body.gender, 'female');
    const r3 = await call('PUT', `/users/${mgr._id}`, { gender: '' }, tok);
    assert.equal(r3.body.gender, undefined);
  });
});
