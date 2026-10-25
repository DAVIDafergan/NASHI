import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFlyer } from '../server/importer/modesty.js';
import { classifyEvent } from '../server/importer/classify.js';

const fake = (text, ok = true) => async () => ({ ok, status: ok ? 200 : 500, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });

test('checkFlyer parses the verdict; unsure/false → not modest', async () => {
  process.env.GEMINI_API_KEY = 'x';
  const img = 'data:image/jpeg;base64,' + Buffer.from('abc').toString('base64');
  assert.deepEqual(await checkFlyer(img, { fetchImpl: fake('{"modest": true, "reason": "ציור"}') }), { modest: true, reason: 'ציור' });
  assert.equal((await checkFlyer(img, { fetchImpl: fake('```json\n{"modest": false, "reason": "בגדי ספורט"}\n```') })).modest, false);
  await assert.rejects(() => checkFlyer(img, { fetchImpl: fake('', false) }), /HTTP 500/);
  delete process.env.GEMINI_API_KEY;
});

test('zumba / yoga / dance and owner-removed titles are always out', () => {
  for (const title of ['זומבה לנשים', 'קורס מורות ליוגה', 'מחול טלאים - 4 יוצרות', 'כשפולק פוגשות אפרו - מופע לנשים בלבד']) {
    const r = classifyEvent({ title, description: 'לנשים בלבד', city: 'צפת', location: 'צפת', strong: true });
    assert.equal(r.ok, false, title);
  }
});
