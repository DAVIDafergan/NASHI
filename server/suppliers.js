import express from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Supplier } from './models.js';
import { REGIONS, ALL_CITIES, regionOfCity } from '../shared/regions.js';
import { SUPPLIER_CATEGORIES, SUPPLIER_PRICE_RANGES, CATEGORY_IDS, ALL_STYLES, supplierCategoryName } from '../shared/suppliers.js';
import { authenticate, isAdmin as defaultIsAdmin, cultureManager as defaultCultureManager } from './auth.js';
import { paymentProvider, getProvider, monthlyPrice, extendPeriod, isListed } from './payments/index.js';

/**
 * מאגר ספקים
 *   public:   GET /suppliers/meta · POST /suppliers/signup · POST /suppliers/magic-link · webhook
 *   supplier: GET/PUT /suppliers/me · POST /suppliers/me/checkout · POST /suppliers/me/cancel   (header X-Supplier-Token)
 *   managers: GET /suppliers · GET /suppliers/:id            (culture managers only — 403 for everyone else)
 *   admin:    GET /admin/suppliers · mark-paid · suspend · activate · send-link · DELETE
 */

const REGION_IDS = REGIONS.map(r => r.id);
const CITY_SET = new Set(ALL_CITIES.map(c => c.city));
const STYLE_SET = new Set(ALL_STYLES);
const PRICE_IDS = SUPPLIER_PRICE_RANGES.map(p => p.id);

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const newToken = () => crypto.randomBytes(24).toString('hex');
const url = (v) => {
  const s = str(v, 200);
  if (!s) return '';
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`;
  try { const u = new URL(withProto); return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.toString() : ''; } catch { return ''; }
};
const phone = (v) => { const s = str(v, 30); const digits = s.replace(/\D/g, ''); return digits.length >= 9 && digits.length <= 13 ? s : ''; };
const IMG_RE = /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i;
const imageOk = (v, maxBytes) => typeof v === 'string' && IMG_RE.test(v) && (v.length * 3) / 4 <= maxBytes * 1.02;

export const servedRegionsOf = ({ nationwide, regions = [], cities = [] }) =>
  nationwide ? [...REGION_IDS] : [...new Set([...regions, ...cities.map(c => regionOfCity(c)).filter(Boolean)])];

/** Validates and cleans a signup / edit body. Returns { data, errors }. Pure — used by tests. */
export function cleanSupplierInput(b = {}, { partial = false } = {}) {
  const errors = [];
  const data = {};
  const want = (k) => !partial || b[k] !== undefined;
  if (want('businessName')) { data.businessName = str(b.businessName, 80); if (data.businessName.length < 2) errors.push('שם העסק'); }
  if (want('contactName')) { data.contactName = str(b.contactName, 60); if (data.contactName.length < 2) errors.push('שם איש/אשת הקשר'); }
  if (want('phone')) { data.phone = phone(b.phone); if (!data.phone) errors.push('טלפון תקין'); }
  if (want('whatsapp')) data.whatsapp = phone(b.whatsapp);
  if (want('email')) { data.email = str(b.email, 120).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('מייל תקין'); }
  for (const k of ['website', 'instagram', 'facebook']) if (want(k)) data[k] = url(b[k]);
  if (want('nationwide')) data.nationwide = b.nationwide === true;
  if (want('regions')) data.regions = (Array.isArray(b.regions) ? b.regions : []).filter(r => REGION_IDS.includes(r));
  if (want('cities')) data.cities = [...new Set((Array.isArray(b.cities) ? b.cities : []).filter(c => CITY_SET.has(c)))].slice(0, 60);
  if (!partial || ['nationwide', 'regions', 'cities'].some(k => b[k] !== undefined)) {
    if (!data.nationwide && !(data.regions || []).length && !(data.cities || []).length) errors.push('אזורי שירות');
  }
  if (want('categories')) { data.categories = [...new Set((Array.isArray(b.categories) ? b.categories : []).filter(c => CATEGORY_IDS.includes(c)))].slice(0, 5); if (!data.categories.length) errors.push('קטגוריה'); }
  if (want('styles')) data.styles = [...new Set((Array.isArray(b.styles) ? b.styles : []).filter(s => STYLE_SET.has(s)))].slice(0, 20);
  if (want('description')) { data.description = str(b.description, 1500); if (data.description.length < 20) errors.push('תיאור (לפחות 20 תווים)'); }
  if (want('priceRange')) data.priceRange = PRICE_IDS.includes(b.priceRange) ? b.priceRange : '';
  if (want('priceNote')) data.priceNote = str(b.priceNote, 120);
  if (want('logo')) { data.logo = b.logo ? (imageOk(b.logo, 1.5 * 1024 * 1024) ? b.logo : null) : ''; if (data.logo === null) { errors.push('לוגו (תמונה עד 1.5MB)'); delete data.logo; } }
  if (want('gallery')) {
    const g = (Array.isArray(b.gallery) ? b.gallery : []).slice(0, 6);
    if (g.some(x => !imageOk(x, 2.5 * 1024 * 1024))) errors.push('תמונות (עד 6, כל אחת עד 2.5MB)');
    data.gallery = g.filter(x => imageOk(x, 2.5 * 1024 * 1024));
  }
  if (data.nationwide !== undefined || data.regions || data.cities) data.servedRegions = servedRegionsOf({ nationwide: data.nationwide, regions: data.regions || [], cities: data.cities || [] });
  return { data, errors };
}

// what culture managers see
export const directoryView = (s) => ({
  id: String(s._id), businessName: s.businessName, contactName: s.contactName, phone: s.phone, whatsapp: s.whatsapp || '', email: s.email,
  website: s.website || '', instagram: s.instagram || '', facebook: s.facebook || '',
  nationwide: !!s.nationwide, regions: s.regions || [], cities: s.cities || [], servedRegions: s.servedRegions || [],
  categories: s.categories || [], styles: s.styles || [], description: s.description || '', priceRange: s.priceRange || '', priceNote: s.priceNote || '',
  logo: s.logo || '', gallery: s.gallery || [], createdAt: s.createdAt,
});
// what the supplier sees about herself
const ownView = (s) => ({
  ...directoryView(s), status: s.status, statusNote: s.statusNote || '', listed: isListed(s),
  subscription: { provider: s.subscription?.provider || 'manual', currentPeriodEnd: s.subscription?.currentPeriodEnd || null, lastPaymentAt: s.subscription?.lastPaymentAt || null, cancelAtPeriodEnd: !!s.subscription?.cancelAtPeriodEnd },
});
const adminView = (s) => ({ ...ownView(s), payments: s.payments || [], views: s.views || 0, updatedAt: s.updatedAt });

const publicBase = (req) => process.env.PUBLIC_URL || process.env.FRONTEND_URL || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;
const editLink = (req, token) => `${publicBase(req)}/#/suppliers/edit?t=${token}`;

async function sendEditLink(req, s, token) {
  const link = editLink(req, token);
  if (!req.resend || !process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV !== 'production') console.log(`[suppliers] edit link for ${s.email}: ${link}`);
    return false;
  }
  try {
    await req.resend.emails.send({
      from: 'נשי <updates@nashi-co.com>',
      to: s.email,
      subject: 'הקישור לניהול הכרטיס שלך במאגר הספקים של נשי',
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.7;color:#2B2027">
        <h2 style="color:#8A5058">שלום ${s.contactName || ''},</h2>
        <p>זה הקישור האישי לעריכת הכרטיס של <b>${s.businessName}</b> במאגר הספקים של נשי. שמרו אותו — הוא מחליף סיסמה.</p>
        <p><a href="${link}" style="background:#8A5058;color:#fff;padding:10px 22px;border-radius:999px;text-decoration:none">לעריכת הכרטיס</a></p>
        <p style="color:#888;font-size:13px">אם לא ביקשתם את הקישור, אפשר להתעלם מהמייל.</p></div>`,
    });
    return true;
  } catch (e) { console.warn('supplier link email failed:', e?.message); return false; }
}

const rateLimit = (limit, windowMs) => {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const k = `${req.ip}:${req.path}`;
    const h = hits.get(k);
    if (!h || now > h.reset) { hits.set(k, { n: 1, reset: now + windowMs }); return next(); }
    if (h.n >= limit) return res.status(429).json({ error: 'יותר מדי ניסיונות. נסו שוב מאוחר יותר.' });
    h.n++; next();
  };
};

export function createSuppliersRouter({ isAdmin = defaultIsAdmin, cultureManager = defaultCultureManager } = {}) {
  const r = express.Router();

  // supplier session by magic-link token
  const supplierAuth = async (req, res, next) => {
    const t = req.headers['x-supplier-token'] || req.query.t;
    if (!t || typeof t !== 'string' || t.length < 20) return res.status(401).json({ error: 'הקישור לא תקין' });
    const s = await Supplier.findOne({ editTokenHash: hashToken(t) });
    if (!s) return res.status(401).json({ error: 'הקישור לא תקף. אפשר לבקש קישור חדש.' });
    req.supplier = s;
    next();
  };

  r.get('/suppliers/meta', (req, res) => {
    const p = paymentProvider();
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ categories: SUPPLIER_CATEGORIES, priceRanges: SUPPLIER_PRICE_RANGES, monthlyPrice: monthlyPrice(), currency: 'ILS', provider: { id: p.id, label: p.label } });
  });

  r.post('/suppliers/signup', rateLimit(6, 60 * 60 * 1000), async (req, res) => {
    try {
      const { data, errors } = cleanSupplierInput(req.body || {});
      if (errors.length) return res.status(400).json({ error: `חסר או לא תקין: ${errors.join(', ')}`, fields: errors });
      if (req.body?.terms !== true) return res.status(400).json({ error: 'יש לאשר את תנאי ההצטרפות' });
      const dup = await Supplier.findOne({ email: data.email, businessName: data.businessName });
      if (dup) return res.status(409).json({ error: 'העסק הזה כבר רשום. אפשר לבקש קישור עריכה למייל.' });
      const token = newToken();
      const provider = paymentProvider();
      const s = await Supplier.create({ ...data, status: 'pending_payment', subscription: { provider: provider.id }, editTokenHash: hashToken(token), editTokenAt: new Date() });
      sendEditLink(req, s, token);
      const notify = process.env.SUPPLIERS_NOTIFY_EMAIL;
      if (notify && req.resend && process.env.RESEND_API_KEY) {
        req.resend.emails.send({ from: 'נשי <updates@nashi-co.com>', to: notify, subject: `ספק חדש נרשם: ${s.businessName}`, html: `<div dir="rtl">${s.businessName} · ${s.contactName} · ${s.phone} · ${(s.categories || []).map(supplierCategoryName).join(', ')}</div>` }).catch(() => {});
      }
      res.status(201).json({ supplier: ownView(s), token });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  r.post('/suppliers/magic-link', rateLimit(5, 60 * 60 * 1000), async (req, res) => {
    try {
      const email = str(req.body?.email, 120).toLowerCase();
      if (email) {
        const list = await Supplier.find({ email }).limit(5);
        for (const s of list) {
          const token = newToken();
          s.editTokenHash = hashToken(token); s.editTokenAt = new Date();
          await s.save();
          await sendEditLink(req, s, token);
        }
      }
      res.json({ success: true }); // same answer whether or not the email exists
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  r.get('/suppliers/me', supplierAuth, (req, res) => res.json({ supplier: ownView(req.supplier) }));

  r.put('/suppliers/me', supplierAuth, async (req, res) => {
    try {
      const { data, errors } = cleanSupplierInput(req.body || {}, { partial: true });
      if (errors.length) return res.status(400).json({ error: `חסר או לא תקין: ${errors.join(', ')}`, fields: errors });
      delete data.email; // the email is the account; changes go through the admin
      Object.assign(req.supplier, data, { updatedAt: new Date() });
      await req.supplier.save();
      res.json({ supplier: ownView(req.supplier) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  r.post('/suppliers/me/checkout', supplierAuth, async (req, res) => {
    try {
      const s = req.supplier;
      if (s.status === 'suspended') return res.status(403).json({ error: 'הכרטיס מושהה. צרו קשר עם הנהלת נשי.' });
      const provider = paymentProvider();
      const base = publicBase(req);
      const checkout = await provider.createCheckout({
        supplier: s, amount: monthlyPrice(), currency: 'ILS',
        successUrl: `${base}/#/suppliers/edit?paid=1`, cancelUrl: `${base}/#/suppliers/edit`,
        webhookUrl: `${base}/api/suppliers/payments/webhook/${provider.id}`,
      });
      if (s.subscription?.provider !== provider.id) { s.subscription = { ...(s.subscription?.toObject?.() || s.subscription || {}), provider: provider.id }; await s.save(); }
      res.json({ provider: { id: provider.id, label: provider.label }, monthlyPrice: monthlyPrice(), checkout });
    } catch (err) { res.status(502).json({ error: err.message }); }
  });

  r.post('/suppliers/me/cancel', supplierAuth, async (req, res) => {
    try {
      const s = req.supplier;
      const provider = getProvider(s.subscription?.provider) || paymentProvider();
      const result = await provider.cancel(s);
      s.subscription.cancelAtPeriodEnd = true;
      await s.save();
      res.json({ ...result, supplier: ownView(s) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // provider → us. The provider adapter must verify the notification itself.
  r.post('/suppliers/payments/webhook/:provider', async (req, res) => {
    try {
      const provider = getProvider(req.params.provider);
      if (!provider || !provider.configured()) return res.status(404).json({ error: 'unknown provider' });
      const ev = await provider.handleWebhook(req);
      if (!ev?.ok || !mongoose.Types.ObjectId.isValid(ev.supplierId)) return res.status(400).json({ error: ev?.error || 'not verified' });
      const s = await Supplier.findById(ev.supplierId);
      if (!s) return res.status(404).json({ error: 'supplier not found' });
      if (ev.event === 'paid') {
        const now = new Date();
        s.status = s.status === 'suspended' ? 'suspended' : 'active';
        s.subscription.provider = provider.id;
        s.subscription.currentPeriodEnd = ev.periodEnd ? new Date(ev.periodEnd) : extendPeriod(s.subscription.currentPeriodEnd, now);
        s.subscription.lastPaymentAt = now;
        s.subscription.lastPaymentAmount = ev.amount;
        if (ev.customerId) s.subscription.customerId = ev.customerId;
        if (ev.subscriptionId) s.subscription.subscriptionId = ev.subscriptionId;
        s.payments.push({ at: now, amount: ev.amount, provider: provider.id, reference: ev.reference });
      } else if (ev.event === 'cancelled') {
        s.subscription.cancelAtPeriodEnd = true;
      }
      await s.save();
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ---------- culture managers ----------
  r.get('/suppliers', authenticate, cultureManager, async (req, res) => {
    try {
      const now = new Date();
      const q = { status: 'active', 'subscription.currentPeriodEnd': { $gt: now } };
      const and = [];
      if (CATEGORY_IDS.includes(req.query.category)) q.categories = req.query.category;
      if (typeof req.query.style === 'string' && STYLE_SET.has(req.query.style)) q.styles = req.query.style;
      if (typeof req.query.city === 'string' && CITY_SET.has(req.query.city)) {
        and.push({ $or: [{ nationwide: true }, { cities: req.query.city }, { regions: regionOfCity(req.query.city) }] });
      } else if (REGION_IDS.includes(req.query.region)) {
        q.servedRegions = req.query.region;
      }
      const text = str(req.query.q, 60);
      if (text) {
        const re = new RegExp(escapeRe(text), 'i');
        and.push({ $or: [{ businessName: re }, { description: re }, { styles: re }, { contactName: re }, { cities: re }] });
      }
      if (and.length) q.$and = and;
      const list = await Supplier.find(q).select('-editTokenHash -payments').sort({ businessName: 1 }).limit(300).lean();
      res.json({ suppliers: list.map(directoryView), total: list.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  r.get('/suppliers/:id', authenticate, cultureManager, async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'not found' });
      const s = await Supplier.findById(req.params.id).select('-editTokenHash -payments');
      if (!s || !isListed(s)) return res.status(404).json({ error: 'הספק לא נמצא במאגר' });
      Supplier.updateOne({ _id: s._id }, { $inc: { views: 1 } }).catch(() => {});
      res.json({ supplier: directoryView(s) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ---------- admin ----------
  r.get('/admin/suppliers', authenticate, isAdmin, async (req, res) => {
    try {
      const q = ['pending_payment', 'active', 'expired', 'suspended'].includes(req.query.status) ? { status: req.query.status } : {};
      const list = await Supplier.find(q).select('-editTokenHash').sort({ createdAt: -1 }).limit(500);
      res.json({ suppliers: list.map(adminView), provider: paymentProvider().id, monthlyPrice: monthlyPrice() });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  const byId = async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) { res.status(404).json({ error: 'not found' }); return null; }
    const s = await Supplier.findById(req.params.id);
    if (!s) { res.status(404).json({ error: 'not found' }); return null; }
    return s;
  };

  r.post('/admin/suppliers/:id/mark-paid', authenticate, isAdmin, async (req, res) => {
    try {
      const s = await byId(req, res); if (!s) return;
      const months = Math.min(12, Math.max(1, parseInt(req.body?.months, 10) || 1));
      const amount = Number(req.body?.amount) || (monthlyPrice() ? monthlyPrice() * months : undefined);
      const now = new Date();
      s.status = 'active';
      s.statusNote = '';
      s.subscription.currentPeriodEnd = extendPeriod(s.subscription.currentPeriodEnd, now, months);
      s.subscription.lastPaymentAt = now;
      s.subscription.lastPaymentAmount = amount;
      s.subscription.cancelAtPeriodEnd = false;
      s.payments.push({ at: now, amount, provider: 'manual', by: req.user.id, note: str(req.body?.note, 200) || `${months} חודשים` });
      s.updatedAt = now;
      await s.save();
      res.json({ supplier: adminView(s) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  r.post('/admin/suppliers/:id/suspend', authenticate, isAdmin, async (req, res) => {
    try {
      const s = await byId(req, res); if (!s) return;
      s.status = 'suspended'; s.statusNote = str(req.body?.note, 200); s.updatedAt = new Date();
      await s.save();
      res.json({ supplier: adminView(s) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  r.post('/admin/suppliers/:id/activate', authenticate, isAdmin, async (req, res) => {
    try {
      const s = await byId(req, res); if (!s) return;
      const end = s.subscription?.currentPeriodEnd;
      if (!end || new Date(end) <= new Date()) return res.status(400).json({ error: 'אין תקופה בתוקף — יש לסמן תשלום' });
      s.status = 'active'; s.statusNote = ''; s.updatedAt = new Date();
      await s.save();
      res.json({ supplier: adminView(s) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  r.post('/admin/suppliers/:id/send-link', authenticate, isAdmin, async (req, res) => {
    try {
      const s = await byId(req, res); if (!s) return;
      const token = newToken();
      s.editTokenHash = hashToken(token); s.editTokenAt = new Date();
      await s.save();
      const sent = await sendEditLink(req, s, token);
      res.json({ sent, link: editLink(req, token) }); // admin can copy the link and send it on WhatsApp
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  r.delete('/admin/suppliers/:id', authenticate, isAdmin, async (req, res) => {
    try {
      const s = await byId(req, res); if (!s) return;
      await s.deleteOne();
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return r;
}

/** Daily-ish job: subscriptions whose paid period ended are no longer listed. */
export async function expireLapsedSuppliers(now = new Date()) {
  const r = await Supplier.updateMany({ status: 'active', 'subscription.currentPeriodEnd': { $lte: now } }, { $set: { status: 'expired', updatedAt: now } });
  return r.modifiedCount || 0;
}

export function startSupplierJobs() {
  if (process.env.SUPPLIERS_EXPIRY_JOB === '0') return;
  const tick = () => {
    if (mongoose.connection.readyState !== 1) return;
    expireLapsedSuppliers().then(n => { if (n) console.log(`[suppliers] ${n} subscriptions expired`); }).catch(e => console.warn('[suppliers] expiry failed', e.message));
  };
  setTimeout(tick, 60 * 1000).unref?.();
  setInterval(tick, 6 * 3600 * 1000).unref?.();
}

