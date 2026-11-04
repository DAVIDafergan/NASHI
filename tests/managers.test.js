import test from 'node:test';
import assert from 'node:assert/strict';
import { permsOf, canDo, normType, cleanPerms, SECTIONS } from '../shared/managers.js';
import { managerWelcomeEmail } from '../server/emails/managerWelcome.js';

test('main admin can do everything', () => {
  assert.deepEqual(permsOf({ isAdmin: true }), SECTIONS);
});
test('a plain member can do nothing', () => {
  assert.deepEqual(permsOf({ role: 'member' }), []);
  assert.equal(canDo(null, 'events'), false);
});
test('culture manager (and legacy managers without a type) get everything', () => {
  assert.deepEqual(permsOf({ role: 'regionAdmin', managerType: 'culture' }), SECTIONS);
  assert.deepEqual(permsOf({ role: 'regionAdmin' }), SECTIONS);
  assert.equal(normType('nonsense'), 'culture');
});
test('municipal / other: events and vacations only — no lotteries, classes, community', () => {
  for (const managerType of ['municipal', 'other']) {
    const u = { role: 'regionAdmin', managerType };
    assert.deepEqual(permsOf(u).sort(), ['events', 'vacations']);
    assert.equal(canDo(u, 'lotteries'), false);
    assert.equal(canDo(u, 'classes'), false);
    assert.equal(canDo(u, 'vacations'), true);
  }
});
test('a per-person list overrides the type default and ignores unknown sections', () => {
  const u = { role: 'regionAdmin', managerType: 'other', managerPerms: ['events', 'classes', 'bogus'] };
  assert.deepEqual(permsOf(u), ['events', 'classes']);
  assert.deepEqual(cleanPerms(['events', 'events', 'x']), ['events']);
});
test('the approval email lists only what the role allows', () => {
  const full = managerWelcomeEmail({ name: 'דנה', gender: 'female', regionLabel: 'ירושלים', managerType: 'culture' });
  assert.match(full.text, /הגרלות/);
  const lim = managerWelcomeEmail({ name: 'אסתי', gender: 'female', regionLabel: 'ירושלים', managerType: 'municipal' });
  assert.match(lim.text, /נופשים/);
  assert.doesNotMatch(lim.text, /הגרלות:/);
  assert.doesNotMatch(lim.text, /חוגים:/);
  assert.match(lim.subject, /אושרת/);
});
