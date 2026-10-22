// Supplier directory: who may see it (culture managers only), validation, subscription lifecycle.
// Run: npm test   (the HTTP part runs only when MONGO_TEST_URI points at a throwaway MongoDB)
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeCultureManager, isCultureManagerUser } from '../server/auth.js';
import { cleanSupplierInput, servedRegionsOf } from '../server/suppliers.js';
import { extendPeriod, isListed, paymentProvider, monthlyPrice } from '../server/payments/index.js';

const run = async (mw, req) => {
  const out = { status: 200, body: null, next: false };
  const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
  await mw(req, res, () => { out.next = true; });
  return out;
};

describe('culture-manager gate (unit)', () => {
  const users = {
    member: { role: 'member' },
    manager: { role: 'regionAdmin', adminRegion: 'north' },
    managerNoRegion: { role: 'regionAdmin' },
    admin: { role: 'member', isAdmin: true },
  };
  const mw = makeCultureManager(async (id) => users[id] || null);
  test('member → 403', async () => { const r = await run(mw, { user: { id: 'member' } }); assert.equal(r.status, 403); assert.equal(r.next, false); });
  test('unknown user → 403', async () => assert.equal((await run(mw, { user: { id: 'ghost' } })).status, 403));
  test('no user on the request → 403', async () => assert.equal((await run(mw, {})).status, 403));
  test('a token that claims isAdmin is not enough — the DB decides', async () => assert.equal((await run(mw, { user: { id: 'member', isAdmin: true } })).status, 403));
  test('regional culture manager → allowed', async () => assert.equal((await run(mw, { user: { id: 'manager' } })).next, true));
  test('culture manager without a region yet → allowed (directory is national)', async () => assert.equal((await run(mw, { user: { id: 'managerNoRegion' } })).next, true));
  test('main admin → allowed', async () => assert.equal((await run(mw, { user: { id: 'admin' } })).next, true));
  test('helper', () => { assert.equal(isCultureManagerUser(null), false); assert.equal(isCultureManagerUser({ role: 'regionAdmin' }), true); });
});

const GOOD = {
  businessName: 'הפקות שירה', contactName: 'שירה כהן', phone: '052-1234567', email: 'Shira@Example.com',
  website: 'shira-events.co.il', regions: ['north'], cities: ['בני ברק', 'עיר שלא קיימת'], categories: ['singers', 'nope'],
  styles: ['זמרת יחידה', 'סגנון מומצא'], description: 'מופעי שירה לנשים בלבד, עם להקה מלאה והגברה.', priceRange: 'mid', terms: true,
};

describe('supplier input validation', () => {
  test('cleans and keeps only known values', () => {
    const { data, errors } = cleanSupplierInput(GOOD);
    assert.deepEqual(errors, []);
    assert.equal(data.email, 'shira@example.com');
    assert.equal(data.website, 'https://shira-events.co.il/');
    assert.deepEqual(data.cities, ['בני ברק']);
    assert.deepEqual(data.categories, ['singers']);
    assert.deepEqual(data.styles, ['זמרת יחידה']);
    assert.deepEqual(data.servedRegions.sort(), ['center', 'north']);
  });
  test('required fields', () => {
    const { errors } = cleanSupplierInput({ businessName: 'x', phone: '12', email: 'bad', categories: [], description: 'קצר' });
    for (const f of ['שם העסק', 'טלפון תקין', 'מייל תקין', 'קטגוריה', 'אזורי שירות']) assert.ok(errors.some(e => e.startsWith(f)), f);
  });
  test('images must be data:image within size', () => {
    const big = 'data:image/jpeg;base64,' + 'A'.repeat(4 * 1024 * 1024);
    assert.ok(cleanSupplierInput({ ...GOOD, gallery: [big] }).errors.some(e => e.startsWith('תמונות')));
    assert.ok(cleanSupplierInput({ ...GOOD, logo: 'https://evil/x.png' }).errors.some(e => e.startsWith('לוגו')));
  });
  test('nationwide serves every region', () => assert.equal(servedRegionsOf({ nationwide: true }).length, 7));
  test('partial edit only touches what was sent', () => {
    const { data, errors } = cleanSupplierInput({ priceNote: 'החל מ-₪1,500' }, { partial: true });
    assert.deepEqual(errors, []); assert.deepEqual(Object.keys(data), ['priceNote']);
  });
});

describe('subscription periods', () => {
  const now = new Date('2026-10-22T10:00:00Z');
  test('extends from now, or from a future end', () => {
    assert.equal(extendPeriod(null, now).toISOString(), '2026-11-22T10:00:00.000Z');
    assert.equal(extendPeriod(new Date('2026-11-01T00:00:00Z'), now).toISOString(), '2026-12-01T00:00:00.000Z');
    assert.equal(extendPeriod(new Date('2026-01-01'), now).toISOString(), '2026-11-22T10:00:00.000Z');
  });
  test('listed only when active and paid up', () => {
    const future = new Date('2026-12-01');
    assert.equal(isListed({ status: 'active', subscription: { currentPeriodEnd: future } }, now), true);
    assert.equal(isListed({ status: 'active', subscription: { currentPeriodEnd: new Date('2026-10-01') } }, now), false);
    assert.equal(isListed({ status: 'pending_payment', subscription: { currentPeriodEnd: future } }, now), false);
    assert.equal(isListed({ status: 'suspended', subscription: { currentPeriodEnd: future } }, now), false);
  });
  test('provider falls back to manual when cardcom is not configured', () => {
    process.env.PAYMENT_PROVIDER = 'cardcom';
    assert.equal(paymentProvider().id, 'manual');
    delete process.env.PAYMENT_PROVIDER;
  });
  test('price from env', () => {
    process.env.SUPPLIER_MONTHLY_PRICE = '149'; assert.equal(monthlyPrice(), 149);
    process.env.SUPPLIER_MONTHLY_PRICE = 'abc'; assert.equal(monthlyPrice(), null);
    delete process.env.SUPPLIER_MONTHLY_PRICE;
  });
});

// ---------------- HTTP, with a throwaway MongoDB ----------------
const MONGO = process.env.MONGO_TEST_URI;
describe('supplier API (signup → pay → directory, access control)', { skip: !MONGO && 'set MONGO_TEST_URI to run' }, () => {
  let mongoose, server, base, tokens = {}, Supplier, User, expireLapsedSuppliers;
  before(async () => {
    mongoose = (await import('mongoose')).default;
    const express = (await import('express')).default;
    const jwt = (await import('jsonwebtoken')).default;
    await mongoose.connect(MONGO.replace(/\/[^/]*$/, '/nashi_test_suppliers'));
    ({ Supplier, User } = await import('../server/models.js'));
    const s = await import('../server/suppliers.js');
    expireLapsedSuppliers = s.expireLapsedSuppliers;
    await Promise.all([Supplier.deleteMany({}), User.deleteMany({})]);
    const mk = async (name, extra) => (await User.create({ name, email: `${name}@t.co`, password: 'x', ...extra }))._id;
    const ids = { member: await mk('member', {}), manager: await mk('manager', { role: 'regionAdmin', adminRegion: 'north' }), admin: await mk('admin', { isAdmin: true }) };
    for (const [k, id] of Object.entries(ids)) tokens[k] = jwt.sign({ id, isAdmin: k === 'admin' }, process.env.JWT_SECRET || 'secret_key_123');
    const app = express(); app.use(express.json({ limit: '10mb' })); app.use('/api', s.createSuppliersRouter());
    await new Promise(r => { server = app.listen(0, r); });
    base = `http://127.0.0.1:${server.address().port}/api`;
    process.env.SUPPLIER_MONTHLY_PRICE = '149';
  });
  after(async () => { server?.close(); await mongoose.disconnect(); });

  const call = (path, { method = 'GET', as, body, supplierToken } = {}) => fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...(as ? { Authorization: `Bearer ${tokens[as]}` } : {}), ...(supplierToken ? { 'X-Supplier-Token': supplierToken } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => ({ status: r.status, json: await r.json().catch(() => null) }));

  let supplierId, editToken;
  test('signup → pending_payment + edit token', async () => {
    const r = await call('/suppliers/signup', { method: 'POST', body: GOOD });
    assert.equal(r.status, 201);
    assert.equal(r.json.supplier.status, 'pending_payment');
    assert.ok(r.json.token.length >= 40);
    supplierId = r.json.supplier.id; editToken = r.json.token;
    const doc = await Supplier.findById(supplierId).lean();
    assert.notEqual(doc.editTokenHash, editToken, 'token is stored hashed');
  });
  test('signup without accepting terms → 400', async () => assert.equal((await call('/suppliers/signup', { method: 'POST', body: { ...GOOD, terms: false, businessName: 'אחר' } })).status, 400));

  test('directory: anonymous 401, member 403, manager + admin 200', async () => {
    assert.equal((await call('/suppliers')).status, 401);
    const m = await call('/suppliers', { as: 'member' });
    assert.equal(m.status, 403);
    assert.equal(m.json.suppliers, undefined);
    assert.equal((await call(`/suppliers/${supplierId}`, { as: 'member' })).status, 403);
    assert.equal((await call('/suppliers', { as: 'manager' })).status, 200);
    assert.equal((await call('/suppliers', { as: 'admin' })).status, 200);
  });
  test('unpaid supplier is not listed', async () => {
    const r = await call('/suppliers', { as: 'manager' });
    assert.equal(r.json.suppliers.length, 0);
    assert.equal((await call(`/suppliers/${supplierId}`, { as: 'manager' })).status, 404);
  });
  test('checkout (manual provider) shows the price and instructions', async () => {
    const r = await call('/suppliers/me/checkout', { method: 'POST', supplierToken: editToken });
    assert.equal(r.status, 200);
    assert.equal(r.json.provider.id, 'manual');
    assert.equal(r.json.monthlyPrice, 149);
    assert.equal(r.json.checkout.kind, 'manual');
  });
  test('admin-only actions are refused to managers', async () => {
    assert.equal((await call(`/admin/suppliers/${supplierId}/mark-paid`, { method: 'POST', as: 'manager' })).status, 403);
    assert.equal((await call('/admin/suppliers', { as: 'member' })).status, 403);
  });
  test('admin marks paid → listed, with filters', async () => {
    const r = await call(`/admin/suppliers/${supplierId}/mark-paid`, { method: 'POST', as: 'admin', body: { months: 1 } });
    assert.equal(r.status, 200);
    assert.equal(r.json.supplier.status, 'active');
    assert.equal(r.json.supplier.payments.length, 1);
    const all = await call('/suppliers', { as: 'manager' });
    assert.equal(all.json.suppliers.length, 1);
    assert.equal(all.json.suppliers[0].email, 'shira@example.com');
    assert.equal(all.json.suppliers[0].payments, undefined, 'no billing data in the directory');
    const f = async (q) => (await call(`/suppliers?${q}`, { as: 'manager' })).json.suppliers.length;
    assert.equal(await f('category=singers'), 1);
    assert.equal(await f('category=catering'), 0);
    assert.equal(await f('region=north'), 1);
    assert.equal(await f('region=center'), 1);           // via the city בני ברק
    assert.equal(await f('region=south'), 0);
    assert.equal(await f(`city=${encodeURIComponent('עפולה')}`), 1);  // a north town
    assert.equal(await f(`city=${encodeURIComponent('אילת')}`), 0);
    assert.equal(await f(`style=${encodeURIComponent('זמרת יחידה')}`), 1);
    assert.equal(await f(`q=${encodeURIComponent('להקה')}`), 1);
    assert.equal(await f(`q=${encodeURIComponent('(')}`), 0, 'regex characters are escaped');
    assert.equal((await call(`/suppliers/${supplierId}`, { as: 'manager' })).status, 200);
  });
  test('supplier edits her listing with the magic-link token; bad token 401', async () => {
    assert.equal((await call('/suppliers/me', { supplierToken: 'x'.repeat(48) })).status, 401);
    const r = await call('/suppliers/me', { method: 'PUT', supplierToken: editToken, body: { priceNote: 'החל מ-₪1,500', email: 'hacker@x.com', status: 'active' } });
    assert.equal(r.status, 200);
    assert.equal(r.json.supplier.priceNote, 'החל מ-₪1,500');
    assert.equal(r.json.supplier.email, 'shira@example.com', 'email cannot be changed by the supplier');
  });
  test('suspend hides it; activate brings it back', async () => {
    await call(`/admin/suppliers/${supplierId}/suspend`, { method: 'POST', as: 'admin', body: { note: 'בדיקה' } });
    assert.equal((await call('/suppliers', { as: 'manager' })).json.suppliers.length, 0);
    assert.equal((await call(`/admin/suppliers/${supplierId}/activate`, { method: 'POST', as: 'admin' })).status, 200);
    assert.equal((await call('/suppliers', { as: 'manager' })).json.suppliers.length, 1);
  });
  test('expiry job: lapsed subscription is no longer listed', async () => {
    await Supplier.updateOne({ _id: supplierId }, { 'subscription.currentPeriodEnd': new Date(Date.now() - 1000) });
    assert.equal(await expireLapsedSuppliers(), 1);
    assert.equal((await Supplier.findById(supplierId).lean()).status, 'expired');
    assert.equal((await call('/suppliers', { as: 'manager' })).json.suppliers.length, 0);
  });
});
