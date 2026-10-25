import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseBinaaList, normalizeBinaa, filterPages, parseSite, DEFAULT_BINAA_SITES } from '../server/importer/adapters/binaa.js';
import { classifyEvent } from '../server/importer/classify.js';

const dir = new URL('./fixtures/binaa/', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, dir), 'utf8');

test('real modil.org.il list: <base href> + ./events/<id>/ cards', () => {
  const items = parseBinaaList(read('modil-list.html'), 'https://www.modil.org.il/events/');
  assert.equal(items.length, 24);
  const it = items.find(i => i.id === '306');
  assert.equal(it.url, 'https://www.modil.org.il/events/306/');
  assert.equal(it.title, 'מגע הקסם של פוטושופ להפוך תמונה ליצירה');
  assert.equal(it.sessions[0].startAt.toISOString(), '2026-10-25T18:30:00.000Z');
  assert.ok(it.tags.includes('נשים'));
  assert.ok(filterPages(read('modil-list.html'), 'https://www.modil.org.il/events/').some(f => /audience=4/.test(f.url)));
});

test('real modil.org.il event page → strict Haredi women event', () => {
  const items = parseBinaaList(read('modil-list.html'), 'https://www.modil.org.il/events/');
  const site = parseSite(DEFAULT_BINAA_SITES.find(s => /modil/.test(s)));
  const n = normalizeBinaa({ html: read('modil-event-306.html'), url: 'https://www.modil.org.il/events/306/', site, item: items.find(i => i.id === '306') });
  assert.equal(n.city, 'מודיעין עילית');
  assert.equal(n.imageUrl, 'https://www.modil.org.il/uploads/n/1791271368.8839.png');
  assert.equal(n.startAt.toISOString(), '2026-10-25T18:30:00.000Z');
  const v = classifyEvent({ title: n.title, description: `${n.description}\n${n.extraText}`, location: n.location, city: n.city, category: n.category, strong: n.strong });
  assert.equal(v.ok, true, JSON.stringify(v));
});
