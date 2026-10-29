// The welcome email a culture manager gets when approved: gendered wording, region, admin link, rules,
// HTML-escaped name, and the sender never throws (Resend returns {error}).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { managerWelcomeEmail, sendManagerWelcome } from '../server/emails/managerWelcome.js';

test('female wording, region, link, rules', () => {
  const { subject, html, text } = managerWelcomeEmail({ name: 'רחל כהן', gender: 'female', regionLabel: 'ירושלים' });
  assert.match(subject, /ברוכה הבאה/);
  assert.match(html, /מזל טוב, רחל/);
  assert.match(html, /מנהלת תרבות באזור ירושלים/);
  assert.match(html, /#\/admin/);
  assert.match(html, /בלי תמונות נשים/);
  assert.match(text, /איך מתחילים/);
});

test('male and neutral wording', () => {
  assert.match(managerWelcomeEmail({ name: 'משה', gender: 'male', regionLabel: 'מרכז' }).html, /מעכשיו אתה/);
  assert.match(managerWelcomeEmail({ name: 'כהן' }).subject, /ברוכים הבאים/);
});

test('name is escaped', () => {
  assert.doesNotMatch(managerWelcomeEmail({ name: '<script>x</script>' }).html, /<script>/);
});

test('sender: Resend error is reported, not thrown; replyTo passed', async () => {
  process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 're_test';
  let sent;
  const ok = await sendManagerWelcome({ emails: { send: async (m) => { sent = m; return { data: { id: 1 } }; } } }, { to: 'a@b.c', name: 'א', replyTo: 'admin@x.y' });
  assert.equal(ok.ok, true); assert.equal(sent.replyTo, 'admin@x.y');
  const bad = await sendManagerWelcome({ emails: { send: async () => ({ error: { message: 'domain' } }) } }, { to: 'a@b.c' });
  assert.ok(bad.error);
});
