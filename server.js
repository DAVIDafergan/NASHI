const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const { db, DATA_DIR } = require('./lib/db');
const providers = require('./lib/providers');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.RAILWAY_ENVIRONMENT) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (!/^\/c\/[^/]+\/(widget|screen)/.test(req.path) && !req.path.startsWith('/pay/')) res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});
const mail = require('./lib/mail');
const contract = require('./lib/contract');
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ---------- helpers ----------
const SECRET = process.env.SECRET || (() => { const f = path.join(DATA_DIR, 'secret.txt'); try { return fs.readFileSync(f, 'utf8'); } catch { const s = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(f, s); return s; } })();
const hmac = v => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
const sign = o => { const p = Buffer.from(JSON.stringify(o)).toString('base64url'); return p + '.' + hmac(p); };
const verify = t => { if (!t) return null; const [p, s] = t.split('.'); if (!p || hmac(p) !== s) return null; try { const o = JSON.parse(Buffer.from(p, 'base64url')); return o.exp > Date.now() ? o : null; } catch { return null; } };
const hashPw = pw => { const salt = crypto.randomBytes(16).toString('hex'); return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex'); };
const checkPw = (pw, h) => { const [salt, k] = (h || '').split(':'); if (!salt) return false; return crypto.timingSafeEqual(Buffer.from(k, 'hex'), crypto.scryptSync(pw, salt, 32)); };
const J = s => { try { return JSON.parse(s || '{}'); } catch { return {}; } };
const slugify = s => { const t = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); return t.length >= 2 ? t : 'p-' + crypto.randomBytes(2).toString('hex'); };
const base = req => process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
const bad = (res, m, c = 400) => res.status(c).json({ error: m });

const user = req => { const s = verify(req.cookies.sid); if (!s) return null; return db.prepare('SELECT id,email,name,phone,org,role,org_verified FROM users WHERE id=?').get(s.uid) || null; };
const auth = (req, res, next) => { req.user = user(req); if (!req.user) return bad(res, 'auth', 401); next(); };
const own = (req, res, next) => {
  const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(req.params.id);
  if (!c || (c.user_id !== req.user.id && req.user.role !== 'admin')) return bad(res, 'not found', 404);
  req.c = c; next();
};

// SSE hub per campaign
const subs = new Map();
const emit = (cid, ev, data) => { for (const r of subs.get(cid) || []) { try { r.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`); } catch { } } };

function stats(c, test) {
  const t = test ? 1 : 0;
  const r = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(amount),0) s FROM donations WHERE campaign_id=? AND status='paid' AND test=?").get(c.id, t);
  const mult = 1; // multipliers removed from the product
  return { count: r.n, raised: r.s, total: Math.round(r.s * mult), goal: c.goal, bonus_goal: c.bonus_goal, multiplier: mult, pct: c.goal ? Math.min(999, Math.round(r.s * mult / c.goal * 1000) / 10) : 0 };
}
function publicDonation(d) { return { id: d.id, name: d.anonymous ? '' : d.name, amount: d.amount, currency: d.currency, dedication: d.dedication, team_id: d.team_id, anonymous: !!d.anonymous, created: d.paid_at || d.created, monthly: !!d.monthly }; }
function markPaid(id, { ref = '', meta = {}, amount } = {}) {
  const d = db.prepare('SELECT * FROM donations WHERE id=?').get(id); if (!d) return null;
  if (d.status === 'paid') return d;
  const verified = meta.verified === undefined ? 1 : (meta.verified ? 1 : 0);
  db.prepare("UPDATE donations SET status='paid', ref=?, meta=?, amount=COALESCE(?,amount), verified=?, paid_at=datetime('now') WHERE id=?").run(String(ref), JSON.stringify(meta).slice(0, 4000), amount || null, verified, id);
  const nd = db.prepare('SELECT * FROM donations WHERE id=?').get(id);
  const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(d.campaign_id);
  emit(c.id, 'donation', { donation: publicDonation(nd), stats: stats(c, nd.test), teams: teamStats(c, nd.test) });
  thankMail(c, nd).catch(() => { });
  return nd;
}
async function thankMail(c, d) {
  if (!mail.enabled() || !d.email || d.test) return;
  const owner = db.prepare('SELECT email FROM users WHERE id=?').get(c.user_id) || {};
  const r = { name: d.name, amount: d.amount, email: d.email, link: '/c/' + c.slug };
  const { subject, html } = renderMail(c, 'thanks', r, process.env.BASE_URL || '');
  await mail.send({ to: d.email, subject, html, replyTo: owner.email });
}
function teamStats(c, test) {
  return db.prepare("SELECT t.id,t.slug,t.name,t.goal,t.photo,t.descr, COUNT(d.id) n, COALESCE(SUM(d.amount),0) s FROM teams t LEFT JOIN donations d ON d.team_id=t.id AND d.status='paid' AND d.test=? WHERE t.campaign_id=? GROUP BY t.id ORDER BY s DESC, t.pos, t.id").all(test ? 1 : 0, c.id).map(t => ({ ...t, total: Math.round(t.s) }));
}
const isTest = c => c.status !== 'live' && c.status !== 'ended';
// payment methods offered on the public page: main provider ("card") + optional app links (bit / paybox)
function payMethods(c) {
  const p = J(c.provider); const mainType = isTest(c) ? 'test' : (p.type || 'test'); const out = [{ k: 'card' }];
  const can = providers[mainType]?.wallets || []; const on = p.wallets || {};
  for (const k of can) if (on[k]) out.push({ k });
  return out;
}

try { db.prepare('UPDATE campaigns SET multiplier=1 WHERE multiplier!=1').run(); } catch { }
const hits = new Map();
const limit = (n, win) => (req, res, next) => { const k = req.ip + req.path; const now = Date.now(); const a = (hits.get(k) || []).filter(t => now - t < win); a.push(now); hits.set(k, a); if (a.length > n) return bad(res, 'יותר מדי ניסיונות, נסו שוב בעוד דקה', 429); next(); };
setInterval(() => { const now = Date.now(); for (const [k, a] of hits) if (!a.some(t => now - t < 60000)) hits.delete(k); }, 60000).unref();
// ---------- auth ----------
app.post('/api/register', limit(5, 600000), (req, res) => {
  const { email, password, name, phone, org } = req.body || {};
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) return bad(res, 'אימייל לא תקין');
  if (String(password || '').length < 6) return bad(res, 'סיסמה: לפחות 6 תווים');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email.toLowerCase())) return bad(res, 'האימייל כבר רשום, התחברו');
  const first = db.prepare('SELECT COUNT(*) c FROM users').get().c === 0;
  const role = first || (process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL.toLowerCase() === email.toLowerCase()) ? 'admin' : 'user';
  const b = req.body || {};
  if (String(name || '').trim().length < 2) return bad(res, 'נא להזין שם מלא');
  if (String(phone || '').replace(/\D/g, '').length < 9) return bad(res, 'נא להזין טלפון נייד תקין');
  if (!b.consent) return bad(res, 'יש לאשר את התקנון ומדיניות הפרטיות');
  const S = (v, n) => String(v || '').trim().slice(0, n);
  const r = db.prepare('INSERT INTO users(email,pass,name,phone,org,role,role_title,address,city,website,s46,consent_at,marketing,org_number) VALUES(?,?,?,?,?,?,?,?,?,?,?,datetime(\'now\'),?,?)').run(email.toLowerCase(), hashPw(password), S(name, 60), S(phone, 20), S(org, 80), role, S(b.role_title, 40), S(b.address, 120), S(b.city, 60), S(b.website, 160), S(b.s46, 10), b.marketing ? 1 : 0, S(b.org_number, 12).replace(/\D/g, ''));
  const uid = r.lastInsertRowid;
  sendVerify(uid).catch(() => { });
  res.cookie('sid', sign({ uid, exp: Date.now() + 90 * 864e5 }), { httpOnly: true, sameSite: 'lax', maxAge: 90 * 864e5, secure: !!process.env.RAILWAY_ENVIRONMENT });
  res.json({ ok: true });
  // verify the NGO number in the background so the account is ready when they land in the dashboard
  if (b.org_number) lookupOrg(b.org_number).then(o => {
    if (!o) return db.prepare("UPDATE users SET org_verified=2, org_status='לא נמצא ברשם העמותות' WHERE id=?").run(uid);
    const active = /פעיל|רשומ/.test(o.status) && !/מחוק|פירוק|בוטל/.test(o.status);
    db.prepare('UPDATE users SET org_name=?, org_verified=?, org_status=?, org_data=?, org=COALESCE(NULLIF(org,\'\'),?) WHERE id=?').run(o.name, active ? 1 : 2, o.status, JSON.stringify(o).slice(0, 6000), o.name, uid);
  }).catch(() => db.prepare("UPDATE users SET org_verified=2, org_status='ממתין לאימות ידני' WHERE id=? AND org_verified!=1").run(uid));
});
async function sendVerify(uid) {
  const u = db.prepare('SELECT id,email,name,email_verified FROM users WHERE id=?').get(uid); if (!u || u.email_verified || !mail.enabled()) return false;
  const token = crypto.randomBytes(20).toString('hex'); db.prepare('UPDATE users SET verify_token=? WHERE id=?').run(token, uid);
  const url = `${process.env.BASE_URL || ''}/verify-email?t=${token}`;
  const r = await mail.send({ to: u.email, subject: 'אימות האימייל שלך ב-GiveIL', html: mail.layout('ברוכים הבאים ל-GiveIL', `<p>שלום ${mail.esc(u.name || '')}, לחצו כדי לאמת את כתובת האימייל ולהפעיל את החשבון:</p><p><a href="${url}" style="background:#1c1917;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;display:inline-block;font-weight:600">אימות האימייל</a></p><p style="color:#6b6762;font-size:13px">אם לא נרשמתם – התעלמו מהמייל.</p>`) });
  return r.ok;
}
app.get('/verify-email', (req, res) => { const t = String(req.query.t || ''); const u = t && db.prepare('SELECT id FROM users WHERE verify_token=?').get(t); if (!u) return res.redirect('/app#/?verified=0'); db.prepare("UPDATE users SET email_verified=1, verify_token='' WHERE id=?").run(u.id); res.cookie('sid', sign({ uid: u.id, exp: Date.now() + 90 * 864e5 }), { httpOnly: true, sameSite: 'lax', maxAge: 90 * 864e5, secure: !!process.env.RAILWAY_ENVIRONMENT }); res.redirect('/app#/?verified=1'); });
app.post('/api/me/resend-verify', auth, limit(3, 600000), async (req, res) => { res.json({ ok: await sendVerify(req.user.id), mail: mail.enabled() }); });
// ---- service agreement (signed before the first campaign) ----
app.get('/api/contract/preview', auth, (req, res) => { const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id); res.type('html').send(contract.render({ date: new Date().toLocaleDateString('he-IL'), org: u.org_name || u.org, orgNumber: u.org_number, name: u.name, idNumber: '________', roleTitle: u.role_title, email: u.email, phone: u.phone })); });
app.post('/api/contract', auth, limit(5, 600000), async (req, res) => {
  const b = req.body || {}; const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  const name = String(b.name || '').trim(), idn = String(b.idNumber || '').replace(/\D/g, ''); const sig = String(b.signature || '');
  if (name.length < 2) return bad(res, 'נא להזין שם מלא של החותם'); if (idn.length < 8 || idn.length > 9) return bad(res, 'מספר ת.ז. לא תקין'); if (!b.agree) return bad(res, 'יש לאשר את ההסכם');
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]{200,}$/.test(sig) || sig.length > 200000) return bad(res, 'נא לחתום בתיבת החתימה');
  const p = { date: new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }), org: u.org_name || u.org, orgNumber: u.org_number, name, idNumber: idn, roleTitle: u.role_title, email: u.email, phone: u.phone, signature: sig, ip: req.ip, ua: req.headers['user-agent'] || '' };
  const r = db.prepare('INSERT INTO contracts(user_id,version,name,id_number,role_title,org,org_number,email,phone,signature,ip,ua,html) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(u.id, contract.VERSION, name, idn, u.role_title, p.org, u.org_number, u.email, u.phone, sig, p.ip, p.ua, '');
  p.id = r.lastInsertRowid; const html = contract.render(p); db.prepare('UPDATE contracts SET html=? WHERE id=?').run(html, p.id);
  res.json({ ok: true, id: p.id });
  // auto-send to the platform admin + a copy to the signer
  if (mail.enabled()) {
    const admin = process.env.ADMIN_EMAIL || contract.OPERATOR.email; const link = `${process.env.BASE_URL || ''}/contract/${p.id}`;
    const body = `<p>נחתם הסכם שימוש חדש:</p><p><b>${mail.esc(p.org)}</b> (${mail.esc(u.org_number || '')})<br>חותם: ${mail.esc(name)}, ת.ז. ${mail.esc(idn)}, ${mail.esc(u.role_title || '')}<br>${mail.esc(u.email)} · ${mail.esc(u.phone || '')}<br>${mail.esc(p.date)} · IP ${mail.esc(p.ip)}</p><p><a href="${link}">לצפייה והדפסה של ההסכם החתום</a></p><p><img src="${sig}" style="max-width:260px;border:1px solid #e9e6e2;border-radius:8px"></p>`;
    const ok = await mail.send({ to: admin, subject: `הסכם חתום – ${p.org}`, html: mail.layout('הסכם שימוש חתום', body), replyTo: u.email }).then(x => x.ok).catch(() => false);
    db.prepare('UPDATE contracts SET sent=? WHERE id=?').run(ok ? 1 : 0, p.id);
    mail.send({ to: u.email, subject: 'עותק ההסכם החתום שלך – GiveIL', html: mail.layout('ההסכם נחתם', `<p>שלום ${mail.esc(name)}, תודה! ההסכם נחתם ונשמר. <a href="${link}">לצפייה ולהדפסה</a>.</p>`) }).catch(() => { });
  }
});
app.get('/contract/:id', auth, (req, res) => { const c = db.prepare('SELECT * FROM contracts WHERE id=?').get(req.params.id); if (!c || (c.user_id !== req.user.id && req.user.role !== 'admin')) return res.status(404).send('not found'); res.type('html').send(c.html); });
// public lookup used by the signup form (no save)
app.get('/api/org-lookup', limit(20, 60000), async (req, res) => { try { const o = await lookupOrg(req.query.number); if (!o) return res.json({ found: false }); const active = /פעיל|רשומ/.test(o.status) && !/מחוק|פירוק|בוטל/.test(o.status); res.json({ found: true, active, name: o.name, status: o.status, city: o.city, field: o.field }); } catch (e) { bad(res, e.message); } });
app.post('/api/login', limit(10, 60000), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body?.email || '').toLowerCase());
  if (!u || !checkPw(String(req.body?.password || ''), u.pass)) return bad(res, 'אימייל או סיסמה שגויים', 401);
  res.cookie('sid', sign({ uid: u.id, exp: Date.now() + 90 * 864e5 }), { httpOnly: true, sameSite: 'lax', maxAge: 90 * 864e5, secure: !!process.env.RAILWAY_ENVIRONMENT });
  res.json({ ok: true });
});
// ---------- NGO verification (רשם העמותות via data.gov.il) ----------
const https = require('https');
function fetchJson(url) { return new Promise((resolve, reject) => { https.get(url, { headers: { 'User-Agent': 'givex/1.0' } }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('bad json')); } }); }).on('error', reject).setTimeout(12000, function () { this.destroy(new Error('timeout')); }); }); }
const AMUTOT_RES = process.env.AMUTOT_RESOURCE || 'be5b7935-3922-45d4-9638-08871b17ec95';
async function lookupOrg(number) {
  const n = String(number).replace(/\D/g, ''); if (!/^5[0-9]{8}$/.test(n)) throw new Error('מספר עמותה לא תקין (9 ספרות, מתחיל ב-5)');
  const j = await fetchJson(`https://data.gov.il/api/3/action/datastore_search?resource_id=${AMUTOT_RES}&filters=${encodeURIComponent(JSON.stringify({ 'מספר עמותה': Number(n) }))}&limit=1`);
  const rec = j?.result?.records?.[0]; if (!rec) return null;
  const g = k => String(rec[k] ?? '');
  return { number: n, name: g('שם עמותה בעברית') || g('שם עמותה באנגלית'), status: g('סטטוס עמותה'), goals: g('מטרות עמותה').slice(0, 500), city: g('כתובת - ישוב'), field: g('סיווג פעילות ענפי'), registered: g('תאריך רישום עמותה'), raw: { ...rec, 'מטרות עמותה': undefined } };
}
app.post('/api/verify-org', auth, async (req, res) => {
  try {
    const o = await lookupOrg(req.body?.number);
    if (!o) { db.prepare("UPDATE users SET org_number=?, org_verified=2, org_status='לא נמצא ברשם העמותות' WHERE id=?").run(String(req.body?.number || '').replace(/\D/g, ''), req.user.id); return res.json({ found: false }); }
    const active = /פעיל|רשומ/.test(o.status) && !/מחוק|פירוק|בוטל/.test(o.status);
    db.prepare('UPDATE users SET org_number=?, org_name=?, org_verified=?, org_status=?, org_data=?, org=COALESCE(NULLIF(org,\'\'),?) WHERE id=?').run(o.number, o.name, active ? 1 : 2, o.status, JSON.stringify(o).slice(0, 6000), o.name, req.user.id);
    res.json({ found: true, verified: active, org: o });
  } catch (e) {
    db.prepare("UPDATE users SET org_number=?, org_verified=2, org_status='ממתין לאימות ידני' WHERE id=? AND org_verified!=1").run(String(req.body?.number || '').replace(/\D/g, ''), req.user.id);
    res.status(502).json({ error: 'לא הצלחנו להתחבר לרשם העמותות כרגע: ' + e.message + '. הבקשה הועברה לאימות ידני.' });
  }
});
app.post('/api/logout', (_, res) => { res.clearCookie('sid'); res.json({ ok: true }); });
app.post('/api/forgot', limit(5, 600000), async (req, res) => {
  const u = db.prepare('SELECT id,email,name FROM users WHERE email=?').get(String(req.body?.email || '').toLowerCase());
  if (u && mail.enabled()) {
    const token = crypto.randomBytes(24).toString('hex'); db.prepare('INSERT INTO resets(token,user_id,exp) VALUES(?,?,?)').run(token, u.id, Date.now() + 3600e3);
    const url = `${base(req)}/app#reset=${token}`;
    await mail.send({ to: u.email, subject: 'איפוס סיסמה ל-GiveIL', html: mail.layout('איפוס סיסמה', `<p>שלום ${mail.esc(u.name || '')}, לחצו על הקישור כדי לבחור סיסמה חדשה (תקף לשעה):</p><p><a href="${url}" style="background:#1c1917;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;display:inline-block;font-weight:600">בחירת סיסמה חדשה</a></p><p style="color:#6b6762;font-size:13px">אם לא ביקשתם איפוס – התעלמו מהמייל.</p>`) }).catch(() => { });
  }
  res.json({ ok: true, mail: mail.enabled() });
});
app.post('/api/reset', limit(10, 600000), (req, res) => {
  const r = db.prepare('SELECT * FROM resets WHERE token=?').get(String(req.body?.token || '')); if (!r || r.exp < Date.now()) return bad(res, 'הקישור פג תוקף. בקשו איפוס חדש.');
  if (String(req.body?.password || '').length < 6) return bad(res, 'סיסמה: לפחות 6 תווים');
  db.prepare('UPDATE users SET pass=? WHERE id=?').run(hashPw(req.body.password), r.user_id); db.prepare('DELETE FROM resets WHERE user_id=?').run(r.user_id);
  res.cookie('sid', sign({ uid: r.user_id, exp: Date.now() + 90 * 864e5 }), { httpOnly: true, sameSite: 'lax', maxAge: 90 * 864e5, secure: !!process.env.RAILWAY_ENVIRONMENT }); res.json({ ok: true });
});
app.post('/api/me/password', auth, (req, res) => { const u = db.prepare('SELECT pass FROM users WHERE id=?').get(req.user.id); if (!checkPw(String(req.body?.current || ''), u.pass)) return bad(res, 'הסיסמה הנוכחית שגויה'); if (String(req.body?.password || '').length < 6) return bad(res, 'סיסמה: לפחות 6 תווים'); db.prepare('UPDATE users SET pass=? WHERE id=?').run(hashPw(req.body.password), req.user.id); res.json({ ok: true }); });
app.get('/api/me', (req, res) => { const u = user(req); if (!u) return res.json({ user: null }); const x = db.prepare('SELECT org_number,org_name,org_verified,org_status,email_verified,phone,role_title,org FROM users WHERE id=?').get(u.id); const ct = db.prepare('SELECT id,created FROM contracts WHERE user_id=? ORDER BY id DESC LIMIT 1').get(u.id); res.json({ user: { ...u, ...x, contract: ct || null, mailEnabled: mail.enabled() } }); });
app.put('/api/me', auth, (req, res) => { const b = req.body || {}; db.prepare('UPDATE users SET name=?,phone=?,org=? WHERE id=?').run(String(b.name || '').slice(0, 60), String(b.phone || '').slice(0, 20), String(b.org || '').slice(0, 80), req.user.id); if (b.password && b.password.length >= 6) db.prepare('UPDATE users SET pass=? WHERE id=?').run(hashPw(b.password), req.user.id); res.json({ ok: true }); });

// ---------- uploads ----------
const upload = multer({ storage: multer.diskStorage({ destination: path.join(DATA_DIR, 'uploads'), filename: (_, f, cb) => cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + path.extname(f.originalname).toLowerCase()) }), limits: { fileSize: 80e6 }, fileFilter: (_, f, cb) => cb(null, /image\/(jpeg|png|webp|gif|svg\+xml)|video\/(mp4|webm|quicktime)/.test(f.mimetype)) });
app.post('/api/upload', auth, upload.single('file'), (req, res) => req.file ? res.json({ url: '/u/' + req.file.filename, type: req.file.mimetype }) : bad(res, 'no file'));
app.use('/u', express.static(path.join(DATA_DIR, 'uploads'), { maxAge: '30d', immutable: true }));

// ---------- campaigns (owner) ----------
const campaignOut = c => ({ ...c, settings: J(c.settings), provider: { ...J(c.provider), _hasSecret: undefined }, lastPaid: (db.prepare("SELECT paid_at FROM donations WHERE campaign_id=? AND status='paid' AND test=0 ORDER BY paid_at DESC LIMIT 1").get(c.id) || {}).paid_at || null, levels: db.prepare('SELECT * FROM levels WHERE campaign_id=? ORDER BY pos,id').all(c.id), teams: db.prepare('SELECT * FROM teams WHERE campaign_id=? ORDER BY pos,id').all(c.id), matchers: db.prepare('SELECT * FROM matchers WHERE campaign_id=? ORDER BY pos,id').all(c.id) });
app.get('/api/campaigns', auth, (req, res) => {
  const rows = req.user.role === 'admin' && req.query.all ? db.prepare('SELECT c.*, u.email owner FROM campaigns c JOIN users u ON u.id=c.user_id ORDER BY c.id DESC').all() : db.prepare('SELECT * FROM campaigns WHERE user_id=? ORDER BY id DESC').all(req.user.id);
  res.json(rows.map(c => ({ id: c.id, slug: c.slug, title: c.title, status: c.status, goal: c.goal, multiplier: c.multiplier, end_at: c.end_at, cover: c.cover, owner: c.owner, stats: stats(c, isTest(c)) })));
});
app.post('/api/campaigns', auth, (req, res) => {
  if (req.user.role !== 'admin' && !db.prepare('SELECT 1 FROM contracts WHERE user_id=?').get(req.user.id)) return res.status(403).json({ error: 'לפני פתיחת קמפיין יש לחתום על הסכם השימוש', code: 'contract' });
  if (req.user.role !== 'admin' && req.user.org_verified !== 1) return bad(res, 'כדי לפתוח קמפיין צריך עמותה מאומתת. אמתו את מספר העמותה בהגדרות החשבון.', 403);
  const b = req.body || {}; const title = String(b.title || 'קמפיין חדש').slice(0, 120);
  let slug = slugify(b.slug || title); while (db.prepare('SELECT 1 FROM campaigns WHERE slug=?').get(slug)) slug = slug + '-' + crypto.randomBytes(2).toString('hex');
  const end = b.end_at || new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 16);
  const r = db.prepare('INSERT INTO campaigns(user_id,slug,title,subtitle,goal,multiplier,start_at,end_at,currency,settings) VALUES(?,?,?,?,?,?,?,?,?,?)').run(req.user.id, slug, title, String(b.subtitle || '').slice(0, 200), +b.goal || 100000, 1, b.start_at || new Date().toISOString().slice(0, 16), end, b.currency === 'USD' ? 'USD' : 'ILS', JSON.stringify({ showDonors: true, allowAnon: true, allowMonthly: true, installments: 12, minAmount: 10, presets: [100, 180, 360, 500, 1000, 1800], thanks: 'תודה רבה! התרומה שלך התקבלה.' }));
  const id = r.lastInsertRowid;
  [[180, 'ידיד'], [500, 'שותף'], [1000, 'תומך'], [1800, 'מייסד']].forEach(([a, n], i) => db.prepare('INSERT INTO levels(campaign_id,name,amount,pos) VALUES(?,?,?,?)').run(id, n, a, i));
  res.json(campaignOut(db.prepare('SELECT * FROM campaigns WHERE id=?').get(id)));
});
app.get('/api/campaigns/:id', auth, own, (req, res) => res.json({ ...campaignOut(req.c), stats: stats(req.c, isTest(req.c)), teamStats: teamStats(req.c, isTest(req.c)) }));
app.put('/api/campaigns/:id', auth, own, (req, res) => {
  const b = req.body || {}; const c = req.c;
  const f = {
    title: String(b.title ?? c.title).slice(0, 120), subtitle: String(b.subtitle ?? c.subtitle).slice(0, 200), story: String(b.story ?? c.story).slice(0, 20000),
    goal: +(b.goal ?? c.goal) || 0, bonus_goal: +(b.bonus_goal ?? c.bonus_goal) || 0, currency: (b.currency ?? c.currency) === 'USD' ? 'USD' : 'ILS', multiplier: 1,
    start_at: b.start_at ?? c.start_at, end_at: b.end_at ?? c.end_at, cover: String(b.cover ?? c.cover).slice(0, 300), logo: String(b.logo ?? c.logo).slice(0, 300), video: String(b.video ?? c.video).slice(0, 300),
    color: /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : c.color, lang: b.lang === 'en' ? 'en' : 'he',
    settings: JSON.stringify({ ...J(c.settings), ...(b.settings || {}) }), provider: b.provider ? JSON.stringify({ ...J(c.provider), ...b.provider }) : c.provider
  };
  if (b.slug && b.slug !== c.slug) { const s = slugify(b.slug); if (db.prepare('SELECT 1 FROM campaigns WHERE slug=? AND id!=?').get(s, c.id)) return bad(res, 'הכתובת תפוסה'); f.slug = s; } else f.slug = c.slug;
  db.prepare('UPDATE campaigns SET title=@title,subtitle=@subtitle,story=@story,goal=@goal,bonus_goal=@bonus_goal,currency=@currency,multiplier=@multiplier,start_at=@start_at,end_at=@end_at,cover=@cover,logo=@logo,video=@video,color=@color,lang=@lang,settings=@settings,provider=@provider,slug=@slug WHERE id=@id').run({ ...f, id: c.id });
  if (Array.isArray(b.levels)) { db.prepare('DELETE FROM levels WHERE campaign_id=?').run(c.id); b.levels.forEach((l, i) => db.prepare('INSERT INTO levels(id,campaign_id,name,amount,descr,stock,pos,icon,monthly,months) VALUES(?,?,?,?,?,?,?,?,?,?)').run(l.id || null, c.id, String(l.name || '').slice(0, 60), +l.amount || 0, String(l.descr || '').slice(0, 200), +l.stock || 0, i, String(l.icon || '').slice(0, 8), l.monthly ? 1 : 0, Math.min(120, Math.max(1, +l.months || 12)))); }
  if (Array.isArray(b.matchers)) { db.prepare('DELETE FROM matchers WHERE campaign_id=?').run(c.id); b.matchers.forEach((m, i) => db.prepare('INSERT INTO matchers(campaign_id,name,logo,pos) VALUES(?,?,?,?)').run(c.id, String(m.name || '').slice(0, 80), String(m.logo || '').slice(0, 300), i)); }
  res.json(campaignOut(db.prepare('SELECT * FROM campaigns WHERE id=?').get(c.id)));
});
app.post('/api/campaigns/:id/status', auth, own, (req, res) => {
  const s = req.body?.status; if (!['draft', 'test', 'live', 'ended'].includes(s)) return bad(res, 'status');
  if (s === 'live' && J(req.c.provider).type === 'test') return bad(res, 'כדי לעלות לאוויר צריך לחבר ספק סליקה אמיתי');
  if (s === 'live' && req.user.role !== 'admin') { const u = db.prepare('SELECT email_verified FROM users WHERE id=?').get(req.user.id); if (mail.enabled() && !u.email_verified) return bad(res, 'כדי לעלות לאוויר יש לאמת את כתובת האימייל (בדקו את תיבת הדואר)'); if (!db.prepare('SELECT 1 FROM contracts WHERE user_id=?').get(req.user.id)) return bad(res, 'כדי לעלות לאוויר יש לחתום על הסכם השימוש'); }
  if (s === 'live' && req.body?.clearTest) db.prepare('DELETE FROM donations WHERE campaign_id=? AND test=1').run(req.c.id);
  db.prepare('UPDATE campaigns SET status=? WHERE id=?').run(s, req.c.id); res.json({ ok: true });
});
app.delete('/api/campaigns/:id', auth, own, (req, res) => { db.prepare('DELETE FROM campaigns WHERE id=?').run(req.c.id); res.json({ ok: true }); });
app.post('/api/campaigns/:id/duplicate', auth, own, (req, res) => {
  const c = req.c; let slug = c.slug + '-copy'; while (db.prepare('SELECT 1 FROM campaigns WHERE slug=?').get(slug)) slug += crypto.randomBytes(1).toString('hex');
  const r = db.prepare('INSERT INTO campaigns(user_id,slug,title,subtitle,story,goal,bonus_goal,currency,multiplier,start_at,end_at,cover,logo,video,color,lang,settings,provider) SELECT user_id,?,title||\' (עותק)\',subtitle,story,goal,bonus_goal,currency,multiplier,start_at,end_at,cover,logo,video,color,lang,settings,provider FROM campaigns WHERE id=?').run(slug, c.id);
  const id = r.lastInsertRowid;
  db.prepare('INSERT INTO levels(campaign_id,name,amount,descr,stock,pos) SELECT ?,name,amount,descr,stock,pos FROM levels WHERE campaign_id=?').run(id, c.id);
  db.prepare('INSERT INTO teams(campaign_id,slug,name,goal,phone,photo,descr,pos) SELECT ?,slug,name,goal,phone,photo,descr,pos FROM teams WHERE campaign_id=?').run(id, c.id);
  res.json({ id });
});
// teams
app.post('/api/campaigns/:id/teams', auth, own, (req, res) => { const b = req.body || {}; let slug = slugify(b.slug || b.name); while (db.prepare('SELECT 1 FROM teams WHERE campaign_id=? AND slug=?').get(req.c.id, slug)) slug += crypto.randomBytes(1).toString('hex'); const r = db.prepare('INSERT INTO teams(campaign_id,slug,name,goal,phone,email,photo,descr,pos) VALUES(?,?,?,?,?,?,?,?,?)').run(req.c.id, slug, String(b.name || '').slice(0, 80), +b.goal || 0, String(b.phone || '').slice(0, 20), String(b.email || '').trim().slice(0, 120), String(b.photo || '').slice(0, 300), String(b.descr || '').slice(0, 300), +b.pos || 0); res.json({ id: r.lastInsertRowid, slug }); });
app.put('/api/campaigns/:id/teams/:tid', auth, own, (req, res) => { const b = req.body || {}; db.prepare('UPDATE teams SET name=?,goal=?,phone=?,email=?,photo=?,descr=?,pos=? WHERE id=? AND campaign_id=?').run(String(b.name || '').slice(0, 80), +b.goal || 0, String(b.phone || '').slice(0, 20), String(b.email || '').trim().slice(0, 120), String(b.photo || '').slice(0, 300), String(b.descr || '').slice(0, 300), +b.pos || 0, req.params.tid, req.c.id); res.json({ ok: true }); });
app.delete('/api/campaigns/:id/teams/:tid', auth, own, (req, res) => { db.prepare('DELETE FROM teams WHERE id=? AND campaign_id=?').run(req.params.tid, req.c.id); db.prepare('UPDATE donations SET team_id=NULL WHERE team_id=?').run(req.params.tid); res.json({ ok: true }); });
// donations (owner)
app.get('/api/campaigns/:id/updates', auth, own, (req, res) => res.json(db.prepare('SELECT * FROM updates WHERE campaign_id=? ORDER BY id DESC').all(req.c.id)));
app.post('/api/campaigns/:id/updates', auth, own, (req, res) => { const b = req.body || {}; if (!String(b.title || b.body || '').trim()) return bad(res, 'נא להזין תוכן'); const r = db.prepare('INSERT INTO updates(campaign_id,title,body,image) VALUES(?,?,?,?)').run(req.c.id, String(b.title || '').slice(0, 120), String(b.body || '').slice(0, 4000), String(b.image || '').slice(0, 300)); emit(req.c.id, 'update', { id: r.lastInsertRowid }); res.json({ ok: true, id: r.lastInsertRowid }); });
app.delete('/api/campaigns/:id/updates/:uid', auth, own, (req, res) => { db.prepare('DELETE FROM updates WHERE id=? AND campaign_id=?').run(req.params.uid, req.c.id); res.json({ ok: true }); });
app.get('/api/campaigns/:id/donations', auth, own, (req, res) => {
  const { q, status, test } = req.query; let sql = 'SELECT d.*, t.name team FROM donations d LEFT JOIN teams t ON t.id=d.team_id WHERE d.campaign_id=?'; const p = [req.c.id];
  if (status) { sql += ' AND d.status=?'; p.push(status); }
  if (test !== undefined && test !== '') { sql += ' AND d.test=?'; p.push(test === '1' ? 1 : 0); }
  if (q) { sql += ' AND (d.name LIKE ? OR d.phone LIKE ? OR d.email LIKE ? OR d.dedication LIKE ?)'; p.push(...Array(4).fill('%' + q + '%')); }
  sql += ' ORDER BY d.id DESC LIMIT 2000'; res.json(db.prepare(sql).all(...p).map(d => ({ ...d, meta: undefined })));
});
app.get('/api/campaigns/:id/donations.csv', auth, own, (req, res) => {
  const rows = db.prepare("SELECT d.*, t.name team FROM donations d LEFT JOIN teams t ON t.id=d.team_id WHERE d.campaign_id=? AND d.test=? ORDER BY d.id").all(req.c.id, isTest(req.c) ? 1 : 0);
  const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = '﻿' + ['מזהה', 'תאריך', 'שם', 'טלפון', 'אימייל', 'ת.ז.', 'סכום', 'מטבע', 'תשלומים', 'הו"ק', 'הקדשה', 'שגריר', 'סטטוס', 'ספק', 'אסמכתא', 'אנונימי'].map(esc).join(',') + '\n' + rows.map(d => [d.id, d.paid_at || d.created, d.name, d.phone, d.email, d.id_number, d.amount, d.currency, d.installments, d.monthly ? 'כן' : '', d.dedication, d.team, d.status, d.provider, d.ref, d.anonymous ? 'כן' : ''].map(esc).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${req.c.slug}-donations.csv"`); res.send(csv);
});
app.post('/api/campaigns/:id/donations', auth, own, (req, res) => {
  const b = req.body || {}; const amt = Math.round(+b.amount || 0); if (amt <= 0) return bad(res, 'סכום');
  const r = db.prepare("INSERT INTO donations(campaign_id,team_id,amount,currency,name,phone,email,dedication,anonymous,status,test,provider,ref,installments,monthly,token,paid_at) VALUES(?,?,?,?,?,?,?,?,?,'paid',?,'manual',?,?,?,?,datetime('now'))").run(req.c.id, +b.team_id || null, amt, req.c.currency, String(b.name || 'תורם').slice(0, 80), String(b.phone || '').slice(0, 20), String(b.email || '').slice(0, 120), String(b.dedication || '').slice(0, 300), b.anonymous ? 1 : 0, isTest(req.c) ? 1 : 0, String(b.ref || '').slice(0, 80), +b.installments || 1, b.monthly ? 1 : 0, crypto.randomBytes(12).toString('hex'));
  const d = db.prepare('SELECT * FROM donations WHERE id=?').get(r.lastInsertRowid);
  emit(req.c.id, 'donation', { donation: publicDonation(d), stats: stats(req.c, d.test), teams: teamStats(req.c, d.test) }); res.json({ id: d.id });
});
app.patch('/api/campaigns/:id/donations/:did', auth, own, (req, res) => {
  const d = db.prepare('SELECT * FROM donations WHERE id=? AND campaign_id=?').get(req.params.did, req.c.id); if (!d) return bad(res, 'not found', 404);
  const b = req.body || {};
  if (b.status === 'paid' && d.status !== 'paid') { markPaid(d.id, { ref: b.ref || d.ref || 'manual', meta: { ...J(d.meta), manualBy: req.user.email, manualAt: new Date().toISOString(), verified: 1 } }); db.prepare('UPDATE donations SET note=? WHERE id=?').run(`אושר ידנית על ידי ${req.user.email}`, d.id); }
  else db.prepare('UPDATE donations SET status=COALESCE(?,status), name=COALESCE(?,name), phone=COALESCE(?,phone), email=COALESCE(?,email), dedication=COALESCE(?,dedication), anonymous=COALESCE(?,anonymous), team_id=? , amount=COALESCE(?,amount) WHERE id=?').run(b.status || null, b.name ?? null, b.phone ?? null, b.email ?? null, b.dedication ?? null, b.anonymous === undefined ? null : (b.anonymous ? 1 : 0), b.team_id === undefined ? d.team_id : (+b.team_id || null), b.amount ? Math.round(+b.amount) : null, d.id);
  emit(req.c.id, 'refresh', { stats: stats(req.c, d.test), teams: teamStats(req.c, d.test) }); res.json({ ok: true });
});
app.delete('/api/campaigns/:id/donations/:did', auth, own, (req, res) => { const d = db.prepare('SELECT test FROM donations WHERE id=? AND campaign_id=?').get(req.params.did, req.c.id); db.prepare('DELETE FROM donations WHERE id=? AND campaign_id=?').run(req.params.did, req.c.id); if (d) emit(req.c.id, 'refresh', { stats: stats(req.c, d.test), teams: teamStats(req.c, d.test) }); res.json({ ok: true }); });
app.post('/api/campaigns/:id/clear-test', auth, own, (req, res) => { db.prepare('DELETE FROM donations WHERE campaign_id=? AND test=1').run(req.c.id); emit(req.c.id, 'refresh', { stats: stats(req.c, true), teams: teamStats(req.c, true) }); res.json({ ok: true }); });
app.get('/api/providers', (_, res) => res.json(Object.entries(providers).map(([k, v]) => ({ type: k, label: v.label, fields: v.fields, manual: !!v.manual, wallets: v.wallets || [] }))));

// ---------- superadmin ----------
const adm = (req, res, next) => req.user.role === 'admin' ? next() : bad(res, 'auth', 403);
app.get('/api/admin/overview', auth, adm, (req, res) => res.json({
  users: db.prepare('SELECT id,email,name,org,org_number,org_name,org_verified,org_status,phone,role,created,role_title,address,city,website,s46,consent_at,marketing,email_verified,(SELECT COUNT(*) FROM contracts WHERE user_id=users.id) contracts,(SELECT COUNT(*) FROM campaigns WHERE user_id=users.id) campaigns FROM users ORDER BY id DESC').all(),
  campaigns: db.prepare("SELECT c.id,c.slug,c.title,c.status,c.goal,c.multiplier,c.end_at,c.created,u.email owner,u.org_name, (SELECT COUNT(*) FROM donations d WHERE d.campaign_id=c.id AND d.status='paid' AND d.test=0) n, (SELECT COALESCE(SUM(amount),0) FROM donations d WHERE d.campaign_id=c.id AND d.status='paid' AND d.test=0) raised FROM campaigns c JOIN users u ON u.id=c.user_id ORDER BY c.id DESC").all(),
  totals: db.prepare("SELECT COUNT(*) donations, COALESCE(SUM(amount),0) raised FROM donations WHERE status='paid' AND test=0").get(),
  live: db.prepare("SELECT COUNT(*) c FROM campaigns WHERE status='live'").get().c,
  today: db.prepare("SELECT COUNT(*) n, COALESCE(SUM(amount),0) s FROM donations WHERE status='paid' AND test=0 AND date(paid_at)=date('now')").get(),
  daily: db.prepare("SELECT date(paid_at) d, COUNT(*) n, SUM(amount) s FROM donations WHERE status='paid' AND test=0 AND paid_at>=date('now','-30 day') GROUP BY d ORDER BY d").all()
}));
app.get('/api/admin/contracts', auth, adm, (_, res) => res.json(db.prepare('SELECT id,user_id,name,id_number,role_title,org,org_number,email,phone,sent,created FROM contracts ORDER BY id DESC').all()));
app.post('/api/admin/users/:id/reset', auth, adm, (req, res) => { const pw = 'Ttm' + crypto.randomBytes(3).toString('hex') + '!'; db.prepare('UPDATE users SET pass=? WHERE id=?').run(hashPw(pw), req.params.id); res.json({ ok: true, password: pw }); });
app.get('/api/admin/mail', auth, adm, (_, res) => res.json({ enabled: mail.enabled(), from: process.env.MAIL_FROM || '' }));
app.patch('/api/admin/users/:id', auth, adm, (req, res) => {
  if (req.body?.email_verified !== undefined) db.prepare('UPDATE users SET email_verified=? WHERE id=?').run(req.body.email_verified ? 1 : 0, req.params.id); const b = req.body || {}; db.prepare("UPDATE users SET role=COALESCE(?,role), org_verified=COALESCE(?,org_verified), org_status=CASE WHEN ? IS NULL THEN org_status ELSE 'אומת ידנית' END, org_name=COALESCE(?,org_name) WHERE id=?").run(b.role || null, b.org_verified ?? null, b.org_verified ?? null, b.org_name || null, req.params.id); res.json({ ok: true }); });
app.delete('/api/admin/users/:id', auth, adm, (req, res) => { if (+req.params.id === req.user.id) return bad(res, 'self'); db.prepare('DELETE FROM users WHERE id=?').run(req.params.id); res.json({ ok: true }); });
app.post('/api/admin/campaigns/:id/status', auth, adm, (req, res) => { db.prepare('UPDATE campaigns SET status=? WHERE id=?').run(['draft', 'test', 'live', 'ended'].includes(req.body?.status) ? req.body.status : 'draft', req.params.id); res.json({ ok: true }); });

// ---------- public campaign API ----------
const getC = slug => db.prepare('SELECT * FROM campaigns WHERE slug=?').get(slug);
app.get('/api/c/:slug', (req, res) => {
  const c = getC(req.params.slug); if (!c) return bad(res, 'not found', 404);
  const test = isTest(c); const s = J(c.settings);
  const t = req.query.team ? db.prepare('SELECT id,slug,name,goal,photo,descr FROM teams WHERE campaign_id=? AND slug=?').get(c.id, req.query.team) : null;
  res.json({
    campaign: { payMethods: payMethods(c), updates: db.prepare('SELECT id,title,body,image,created FROM updates WHERE campaign_id=? ORDER BY id DESC LIMIT 20').all(c.id), id: c.id, slug: c.slug, title: c.title, subtitle: c.subtitle, story: c.story, goal: c.goal, bonus_goal: c.bonus_goal, currency: c.currency, multiplier: c.multiplier, start_at: c.start_at, end_at: c.end_at, status: c.status, cover: c.cover, logo: c.logo, video: c.video, color: c.color, lang: c.lang, settings: s, test, providerType: J(c.provider).type || 'test' },
    levels: db.prepare('SELECT id,name,amount,descr,stock,icon,monthly,months,(SELECT COUNT(*) FROM donations WHERE level_id=levels.id AND status=\'paid\' AND test=?) used FROM levels WHERE campaign_id=? ORDER BY pos,id').all(test ? 1 : 0, c.id),
    teams: teamStats(c, test), team: t, matchers: db.prepare('SELECT name,logo FROM matchers WHERE campaign_id=? ORDER BY pos,id').all(c.id),
    stats: stats(c, test),
    donations: db.prepare("SELECT * FROM donations WHERE campaign_id=? AND status='paid' AND test=? ORDER BY paid_at DESC, id DESC LIMIT 60").all(c.id, test ? 1 : 0).map(publicDonation)
  });
});
app.get('/api/c/:slug/donations', (req, res) => { const c = getC(req.params.slug); if (!c) return bad(res, 'not found', 404); const off = +req.query.offset || 0; const team = +req.query.team || 0; const q = String(req.query.q || '').slice(0, 60); const p = [c.id, isTest(c) ? 1 : 0]; let w = ''; if (team) { w += ' AND team_id=?'; p.push(team); } if (q) { w += " AND anonymous=0 AND (name LIKE ? OR dedication LIKE ?)"; p.push('%' + q + '%', '%' + q + '%'); } p.push(off); res.json(db.prepare(`SELECT * FROM donations WHERE campaign_id=? AND status='paid' AND test=?${w} ORDER BY ${req.query.sort === 'top' ? 'amount DESC, id DESC' : 'paid_at DESC, id DESC'} LIMIT 60 OFFSET ?`).all(...p).map(publicDonation)); });
app.get('/api/c/:slug/stream', (req, res) => {
  const c = getC(req.params.slug); if (!c) return res.status(404).end();
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' }); res.write(':ok\n\n');
  if (!subs.has(c.id)) subs.set(c.id, new Set()); subs.get(c.id).add(res);
  const ping = setInterval(() => { try { res.write(':p\n\n'); } catch { } }, 25000);
  req.on('close', () => { clearInterval(ping); subs.get(c.id)?.delete(res); });
});
app.post('/api/c/:slug/donate', limit(20, 60000), async (req, res) => {
  const c = getC(req.params.slug); if (!c) return bad(res, 'not found', 404);
  if (c.status === 'ended') return bad(res, 'הקמפיין הסתיים');
  const s = J(c.settings); const b = req.body || {};
  const amount = Math.round(+b.amount || 0); if (amount < (s.minAmount || 1)) return bad(res, `סכום מינימלי ₪${s.minAmount || 1}`); if (amount > 5000000) return bad(res, 'סכום גבוה מדי');
  const name = String(b.name || '').trim().slice(0, 80); if (name.length < 2) return bad(res, 'נא להזין שם');
  const phone = String(b.phone || '').replace(/[^\d+]/g, '').slice(0, 20); const email = String(b.email || '').trim().slice(0, 120);
  if (phone.replace(/\D/g, '').length < 9 && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad(res, 'נא להזין טלפון או אימייל');
  const level = b.level_id ? db.prepare('SELECT * FROM levels WHERE id=? AND campaign_id=?').get(b.level_id, c.id) : null;
  if (level && level.stock > 0) { const used = db.prepare("SELECT COUNT(*) n FROM donations WHERE level_id=? AND status='paid' AND test=?").get(level.id, isTest(c) ? 1 : 0).n; if (used >= level.stock) return bad(res, 'הרמה הזו אזלה'); }
  const team = b.team_id ? db.prepare('SELECT id FROM teams WHERE id=? AND campaign_id=?').get(b.team_id, c.id) : null;
  const prov = J(c.provider); const method = ['card', 'bit', 'paybox', 'applepay', 'googlepay'].includes(b.method) ? b.method : 'card';
  const type = isTest(c) ? 'test' : (prov.type || 'test'); const cfg = prov;
  const P = providers[type]; if (!P) return bad(res, 'ספק סליקה לא מוגדר');
  let inst = Math.min(Math.max(1, +b.installments || 1), s.installments || 1);
  // monthly quick button: the donor pledges amount × months; the processor charges `amount` every month for `months` months
  let finalAmount = amount, isMonthly = !!(b.monthly || (level && level.monthly)) && s.allowMonthly !== false;
  if (level && level.monthly) { inst = Math.max(1, +level.months || 12); finalAmount = level.amount * inst; isMonthly = true; }
  else if (isMonthly) { inst = Math.min(Math.max(1, +b.months || 12), 120); finalAmount = amount * inst; }
  const token = crypto.randomBytes(16).toString('hex');
  if (s.idField === 'required') { const z = String(b.id_number || '').replace(/\D/g, ''); if (z.length < 8 || z.length > 9) return bad(res, 'נא להזין מספר תעודת זהות תקין'); }
  const r = db.prepare('INSERT INTO donations(campaign_id,team_id,level_id,amount,currency,name,phone,email,id_number,dedication,anonymous,status,test,provider,installments,monthly,token) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(c.id, team ? team.id : null, level ? level.id : null, finalAmount, c.currency, name, phone, email, String(b.id_number || '').replace(/\D/g, '').slice(0, 9), String(b.dedication || '').slice(0, 300), b.anonymous && s.allowAnon !== false ? 1 : 0, 'pending', isTest(c) ? 1 : 0, type, inst, isMonthly ? 1 : 0, token);
  const donation = db.prepare('SELECT * FROM donations WHERE id=?').get(r.lastInsertRowid);
  try {
    const out = await P.start({ base: base(req), donation, campaign: c, cfg, method });
    if (method !== 'card') db.prepare('UPDATE donations SET meta=? WHERE id=?').run(JSON.stringify({ method }), donation.id);
    if (out.ref) db.prepare('UPDATE donations SET ref=? WHERE id=?').run(String(out.ref), donation.id);
    res.json({ ...out, donationId: donation.id, token, returnUrl: `${base(req)}/pay/return/${token}` });
  } catch (e) { db.prepare("UPDATE donations SET status='failed', meta=? WHERE id=?").run(JSON.stringify({ error: e.message }), donation.id); bad(res, 'שגיאה בחיבור לספק הסליקה: ' + e.message, 502); }
});
app.post('/api/c/:slug/join', limit(5, 600000), (req, res) => {
  const c = getC(req.params.slug); if (!c) return bad(res, 'not found', 404); const s = J(c.settings); if (s.allowJoin === false || c.status === 'ended') return bad(res, 'ההצטרפות סגורה');
  const b = req.body || {}; const name = String(b.name || '').trim().slice(0, 80); const phone = String(b.phone || '').replace(/[^\d+]/g, '').slice(0, 20);
  if (name.length < 2) return bad(res, 'נא להזין שם'); if (phone.replace(/\D/g, '').length < 9) return bad(res, 'נא להזין טלפון תקין');
  if (db.prepare('SELECT 1 FROM teams WHERE campaign_id=? AND phone=?').get(c.id, phone)) { const t = db.prepare('SELECT slug FROM teams WHERE campaign_id=? AND phone=?').get(c.id, phone); return res.json({ ok: true, slug: t.slug, existed: true }); }
  let slug = slugify(b.slug || name); while (db.prepare('SELECT 1 FROM teams WHERE campaign_id=? AND slug=?').get(c.id, slug)) slug += crypto.randomBytes(1).toString('hex');
  db.prepare('INSERT INTO teams(campaign_id,slug,name,goal,phone,email,descr,pos) VALUES(?,?,?,?,?,?,?,99)').run(c.id, slug, name, Math.max(0, +b.goal || 0), phone, String(b.email || '').trim().slice(0, 120), String(b.descr || '').slice(0, 300));
  const em = String(b.email || '').trim().toLowerCase(); if (mail.enabled() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { try { const { subject, html } = renderMail(c, 'ambassador', { name, amount: 0, email: em, link: '/c/' + c.slug + '/' + slug }, base(req)); mail.send({ to: em, subject, html }).catch(() => { }); } catch { } }
  emit(c.id, 'refresh', { stats: stats(c, isTest(c)), teams: teamStats(c, isTest(c)) });
  res.json({ ok: true, slug });
});
app.get('/api/public/campaigns', (_, res) => {
  const rows = db.prepare("SELECT * FROM campaigns WHERE status='live' OR (status='test' AND settings LIKE '%\"demo\":true%') ORDER BY status='live' DESC, id DESC LIMIT 9").all();
  res.json(rows.map(c => { const st = stats(c, isTest(c)); const s = J(c.settings); return { slug: c.slug, title: c.title, subtitle: c.subtitle, cover: c.cover || (s.media?.default?.desktop || [])[0] || '', currency: c.currency, goal: c.goal, total: st.total, pct: st.pct, count: st.count, end_at: c.end_at, demo: !!s.demo, live: c.status === 'live' }; }));
});
app.get('/api/d/:token', (req, res) => { const d = db.prepare('SELECT d.*, c.slug, c.title, c.settings FROM donations d JOIN campaigns c ON c.id=d.campaign_id WHERE d.token=?').get(req.params.token); if (!d) return bad(res, 'not found', 404); res.json({ id: d.id, status: d.status, amount: d.amount, currency: d.currency, name: d.name, slug: d.slug, title: d.title, thanks: J(d.settings).thanks, test: !!d.test, provider: d.provider }); });

// ---------- payment pages & callbacks ----------
app.get('/pay/test/:token', (req, res) => res.sendFile(path.join(__dirname, 'public', 'paytest.html')));
app.post('/pay/test/:token', (req, res) => {
  const d = db.prepare('SELECT * FROM donations WHERE token=? AND test=1').get(req.params.token); if (!d) return bad(res, 'not found', 404);
  if (req.body?.result === 'fail') { db.prepare("UPDATE donations SET status='failed' WHERE id=?").run(d.id); return res.json({ ok: false }); }
  markPaid(d.id, { ref: 'TEST-' + d.id, meta: { simulated: true } }); res.json({ ok: true });
});
app.get('/pay/return/:token', (req, res) => { const d = db.prepare('SELECT d.*, c.slug FROM donations d JOIN campaigns c ON c.id=d.campaign_id WHERE d.token=?').get(req.params.token); if (!d) return res.redirect('/'); if (d.status === 'pending' && d.provider === 'link') { /* manual providers: keep pending, owner confirms */ } res.redirect(`/c/${d.slug}?thanks=${d.token}`); });
// Nedarim Plus → our server. Trust model: the donation is matched by id+token, the amount must equal what the
// donor asked for, Mosad (if sent) must be ours, a TransactionId is required, and when ApiPassword is set we
// re-read the transaction from Nedarim's own history before counting it. Anything short of that is logged, not counted.
app.all('/pay/nedarim/callback', limit(120, 60000), async (req, res) => {
  const b = { ...req.query, ...req.body }; const r = providers.nedarim.callback(b);
  const d = r.donationId ? db.prepare('SELECT * FROM donations WHERE id=? AND token=?').get(r.donationId, String(r.token || '')) : null;
  if (!d) return res.status(404).send('no donation');
  res.send('OK'); // answer Nedarim immediately; the work below is idempotent
  if (d.status === 'paid') return;
  const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(d.campaign_id); const cfg = J(c.provider);
  const log = (note, extra = {}) => db.prepare("UPDATE donations SET note=?, meta=? WHERE id=?").run(note, JSON.stringify({ ...r.meta, ...extra, at: new Date().toISOString() }).slice(0, 4000), d.id);
  if (!r.paid) { db.prepare("UPDATE donations SET status='failed' WHERE id=? AND status='pending'").run(d.id); return log('נדרים: העסקה נדחתה (' + String(b.Status || '') + ')'); }
  if (!r.ref) return log('⚠ התקבל אישור ללא מספר עסקה – לא נספר. בדקו בנדרים.');
  if (r.mosad && cfg.mosadId && r.mosad !== String(cfg.mosadId)) return log('⚠ מספר מוסד לא תואם – לא נספר.');
  const perPay = d.installments > 1 ? d.amount / d.installments : d.amount; // Nedarim may report the per-installment amount
  const amtOk = !r.amount || Math.abs(r.amount - d.amount) <= 1 || Math.abs(r.amount - perPay) <= 1;
  if (!amtOk) return log(`⚠ סכום לא תואם (נדרים: ${r.amount}, בקשה: ${d.amount}) – לא נספר.`);
  const isHK = !!d.monthly || String(b.PaymentType || '').toUpperCase() === 'HK' || (!!b.KevaId && !b.TransactionId);
  let verified = 0;
  if (cfg.apiPassword && !isHK) {
    try { const v = await providers.nedarim.verify({ cfg, transactionId: r.ref }); if (v.checked && !v.found) return log('⚠ העסקה לא נמצאה בהיסטוריית נדרים – לא נספר. לחצו "סנכרון מול נדרים".'); if (v.found && Math.abs(v.amount - d.amount) > 1 && Math.abs(v.amount - perPay) > 1) return log(`⚠ סכום בנדרים (${v.amount}) שונה מהבקשה (${d.amount}) – לא נספר.`); verified = v.found ? 1 : 0; }
    catch (e) { verified = 0; r.meta._verifyError = e.message; }
  }
  markPaid(d.id, { ref: r.ref, meta: { ...r.meta, verified, hk: isHK }, amount: d.amount });
  const note = isHK ? `הוראת קבע נרשמה בנדרים (מזהה ${r.ref}). החיובים החודשיים מתבצעים ומנוהלים בנדרים פלוס.` : verified ? 'אומת מול שרת נדרים ✓' : (cfg.apiPassword ? 'שולם; אימות מול נדרים נכשל זמנית – יושלם בסנכרון' : 'שולם לפי הודעת נדרים (הוסיפו ApiPassword לאימות מלא)');
  db.prepare('UPDATE donations SET verified=?, note=? WHERE id=?').run(isHK ? 1 : verified, note, d.id);
});
// Reconcile: pull Nedarim history and match it against our donations (missed callbacks, unverified rows)
async function reconcileNedarim(c) {
  const cfg = J(c.provider); if (cfg.type !== 'nedarim' || !cfg.apiPassword) throw new Error('סנכרון דורש נדרים פלוס עם ApiPassword');
  {
    const rows = await providers.nedarim.fetchHistory({ cfg, max: 300 });
    const byRef = new Map(rows.map(x => [String(x.TransactionId), x]));
    let verified = 0, recovered = 0;
    for (const d of db.prepare("SELECT * FROM donations WHERE campaign_id=? AND provider='nedarim' AND test=0 AND monthly=0 AND (status='pending' OR verified=0) AND created > datetime('now','-14 days')").all(c.id)) {
      let rec = d.ref && byRef.get(String(d.ref));
      if (!rec && d.status === 'pending') { // match a missed callback by phone+amount within 2h
        const ph = String(d.phone || '').replace(/\D/g, '').slice(-9); const t0 = new Date(d.created + 'Z').getTime();
        rec = rows.find(x => Math.abs(+x.Amount - d.amount) <= 1 && String(x.Phone || '').replace(/\D/g, '').slice(-9) === ph && ph && Math.abs(new Date(x.TransactionTime).getTime() - t0) < 2 * 3600e3 && !db.prepare("SELECT 1 FROM donations WHERE ref=? AND status='paid'").get(String(x.TransactionId)));
        if (rec) recovered++;
      }
      if (!rec) continue;
      if (d.status !== 'paid') markPaid(d.id, { ref: String(rec.TransactionId), meta: { fromHistory: rec, verified: 1 }, amount: Math.round(+rec.Amount) });
      db.prepare("UPDATE donations SET verified=1, note='אומת מול שרת נדרים ✓ (סנכרון)', ref=COALESCE(NULLIF(ref,''),?) WHERE id=?").run(String(rec.TransactionId), d.id); verified++;
    }
    return { ok: true, pulled: rows.length, verified, recovered };
  }
}
app.post('/api/campaigns/:id/provider/test', auth, own, limit(10, 60000), async (req, res) => {
  const cfg = J(req.c.provider); const t = cfg.type || 'test';
  try {
    if (t === 'test') return res.json({ ok: true, msg: 'מצב בדיקה – אין ספק אמיתי' });
    if (t === 'nedarim') {
      if (!cfg.mosadId || !cfg.apiValid) return res.json({ ok: false, msg: 'חסר מספר מוסד או ApiValid' });
      if (!cfg.apiPassword) return res.json({ ok: true, msg: 'מספר מוסד ו-ApiValid הוזנו. בלי ApiPassword אי אפשר לבדוק את החיבור מראש – מומלץ להוסיף.' });
      const rows = await providers.nedarim.fetchHistory({ cfg, max: 3 });
      return res.json({ ok: true, msg: `החיבור לנדרים עובד (מוסד ${cfg.mosadId}). נמצאו ${rows.length} עסקאות אחרונות בהיסטוריה.` });
    }
    if (t === 'meshulam') {
      if (!cfg.pageCode || !cfg.userId) return res.json({ ok: false, msg: 'חסר Page code או User ID' });
      try { await providers.meshulam.start({ base: base(req), donation: { id: 0, amount: 1, name: 'בדיקה', phone: '', email: '', installments: 1, token: 'test' }, campaign: req.c, cfg }); return res.json({ ok: true, msg: 'Grow יצר דף תשלום בהצלחה – המזהים נכונים.' }); } catch (e) { return res.json({ ok: false, msg: e.message }); }
    }
    if (t === 'paypal') {
      if (!cfg.clientId || !cfg.secret) return res.json({ ok: false, msg: 'חסר Client ID או Secret' });
      const host = String(cfg.sandbox) === 'true' ? 'api-m.sandbox.paypal.com' : 'api-m.paypal.com';
      const https = require('https'); const auth = Buffer.from(cfg.clientId + ':' + cfg.secret).toString('base64');
      const r = await new Promise((resolve, reject) => { const q = https.request({ hostname: host, path: '/v1/oauth2/token', method: 'POST', headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': 29 } }, rs => { let d = ''; rs.on('data', c => d += c); rs.on('end', () => resolve({ status: rs.statusCode, body: d })); }); q.on('error', reject); q.write('grant_type=client_credentials'); q.end(); });
      return res.json({ ok: r.status === 200, msg: r.status === 200 ? 'PayPal אישר את המפתחות.' : 'PayPal דחה את המפתחות (' + r.status + ')' });
    }
    if (t === 'link') { const ok = /^https:\/\//.test(cfg.url || ''); return res.json({ ok, msg: ok ? 'הקישור תקין. זכרו: אישור התרומות ידני.' : 'הקישור חייב להתחיל ב-https://' }); }
    res.json({ ok: false, msg: 'ספק לא מוכר' });
  } catch (e) { res.json({ ok: false, msg: e.message }); }
});
app.post('/api/campaigns/:id/reconcile', auth, own, async (req, res) => { try { res.json(await reconcileNedarim(req.c)); } catch (e) { bad(res, e.message, 502); } });
// every 10 minutes: reconcile live Nedarim campaigns that have unverified/pending donations in the last 2 days
setInterval(async () => {
  for (const c of db.prepare("SELECT c.* FROM campaigns c WHERE c.status='live' AND c.provider LIKE '%nedarim%' AND EXISTS(SELECT 1 FROM donations d WHERE d.campaign_id=c.id AND d.provider='nedarim' AND d.test=0 AND (d.status='pending' OR d.verified=0) AND d.created > datetime('now','-2 days'))").all()) {
    try { await reconcileNedarim(c); } catch (e) { console.error('reconcile', c.id, e.message); }
  }
}, 10 * 60000).unref();
app.all('/pay/meshulam/webhook', (req, res) => {
  const b = { ...req.query, ...req.body }; const r = providers.meshulam.callback(b);
  // must match BOTH our id and the secret token; amount must equal what the donor asked for; a transaction id is required
  const d = r.donationId && r.token ? db.prepare('SELECT * FROM donations WHERE id=? AND token=?').get(r.donationId, String(r.token)) : null;
  if (!d) return res.status(404).send('no donation');
  res.send('OK'); if (d.status === 'paid') return;
  const log = (note) => db.prepare('UPDATE donations SET note=?, meta=? WHERE id=?').run(note, JSON.stringify({ ...r.meta, at: new Date().toISOString() }).slice(0, 4000), d.id);
  if (!r.paid) { db.prepare("UPDATE donations SET status='failed' WHERE id=? AND status='pending'").run(d.id); return log('משולם: העסקה לא אושרה'); }
  if (!r.ref) return log('⚠ אישור ללא מספר עסקה – לא נספר');
  const amt = +(b.sum || b.data?.sum || b.amount || b.data?.amount || 0);
  if (amt && Math.abs(amt - d.amount) > 1 && !(d.installments > 1 && Math.abs(amt * d.installments - d.amount) <= d.installments)) return log(`⚠ סכום לא תואם (משולם: ${amt}, בקשה: ${d.amount}) – לא נספר`);
  markPaid(d.id, { ref: r.ref, meta: { ...r.meta, verified: 1 } });
});
app.post('/pay/paypal/capture', async (req, res) => {
  const { token, orderId } = req.body || {}; const d = db.prepare('SELECT * FROM donations WHERE token=?').get(token); if (!d) return bad(res, 'not found', 404);
  const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(d.campaign_id);
  try { const r = await providers.paypal.capture({ cfg: J(c.provider), orderId }); if (!r.paid) return bad(res, 'התשלום לא הושלם'); markPaid(d.id, { ref: r.ref, meta: { orderId, captured: r.ref }, amount: r.amount ? Math.round(r.amount) : undefined }); res.json({ ok: true }); } catch (e) { bad(res, e.message, 502); }
});
app.post('/pay/iframe-done/:token', (req, res) => { // Nedarim Plus iframe reports success via postMessage; server trusts callback, this only acknowledges
  const d = db.prepare('SELECT status FROM donations WHERE token=?').get(req.params.token); res.json({ status: d?.status || 'unknown' });
});

// ---------- messaging (SMS / WhatsApp lists) ----------
const recipients = (c, audience, byEmail = false) => {
  const test = isTest(c) ? 1 : 0; const seen = new Set(); const out = [];
  const push = r => { const ph = String(r.phone || '').replace(/\D/g, ''); const em = String(r.email || '').trim().toLowerCase(); const k = byEmail ? em : ph; if (byEmail ? !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em) : ph.length < 9) return; if (seen.has(k)) return; seen.add(k); out.push({ name: r.name, phone: ph, email: em, amount: r.amount || 0, link: r.link || '' }); };
  if (audience === 'ambassadors') db.prepare('SELECT name,phone,email,slug FROM teams WHERE campaign_id=? ORDER BY pos,id').all(c.id).forEach(t => push({ ...t, link: '/c/' + c.slug + '/' + t.slug }));
  else if (audience === 'pending') db.prepare("SELECT name,phone,email,amount FROM donations WHERE campaign_id=? AND status='pending' AND test=? ORDER BY id DESC").all(c.id, test).forEach(push);
  else db.prepare("SELECT name,phone,email,amount FROM donations WHERE campaign_id=? AND status='paid' AND test=? ORDER BY id DESC").all(c.id, test).forEach(push);
  return out;
};
// campaign email templates (settings.emails.{thanks,ambassador,update}) with defaults
function emailTpl(c, kind) {
  const s = J(c.settings); const e = (s.emails || {})[kind] || {}; const url = `${process.env.BASE_URL || ''}/c/${c.slug}`;
  const D = {
    thanks: { subject: 'תודה על התרומה לקמפיין "{campaign}"', title: 'תודה רבה, {name}! 💜', body: (s.thanks || 'התרומה שלך התקבלה.') + '\n\nסכום התרומה: ₪{amount}\nהקבלה תישלח על ידי העמותה דרך מערכת הסליקה.', btnText: 'שתפו את הקמפיין', btnUrl: url },
    ambassador: { subject: 'הקישור האישי שלך לקמפיין "{campaign}"', title: '{name}, הדף שלך מוכן 🚀', body: 'תודה שהצטרפת כשגריר/ה! זה הקישור האישי שלך – כל תרומה דרכו נזקפת לזכותך:\n{link}\n\nשתפו אותו עם חברים ומשפחה.', btnText: 'לדף האישי שלי', btnUrl: '{link}' },
    update: { subject: 'עדכון מהקמפיין "{campaign}"', title: 'עברנו ₪{raised}! תודה 🙏', body: 'תודה לכל מי שתרם ושיתף. אנחנו ממשיכים – עזרו לנו להגיע ליעד.', btnText: 'לדף הקמפיין', btnUrl: url }
  }[kind] || {};
  return { ...D, ...Object.fromEntries(Object.entries(e).filter(([, v]) => v !== '' && v != null)), image: e.image || '', color: e.color || c.color || '#7c5cff' };
}
function renderMail(c, kind, r, baseUrl) {
  const t = emailTpl(c, kind); const f = x => fill(x || '', r, c, baseUrl);
  const owner = db.prepare('SELECT org_name, org FROM users WHERE id=?').get(c.user_id) || {};
  return { subject: f(t.subject), html: mail.template({ title: f(t.title), body: f(t.body), image: t.image, btnText: f(t.btnText), btnUrl: f(t.btnUrl), color: t.color, logo: c.logo ? (baseUrl + c.logo) : '', org: owner.org_name || owner.org || '' }) };
}
const fill = (tpl, r, c, baseUrl) => String(tpl).replace(/\{name\}/g, (r.name || '').split(' ')[0]).replace(/\{fullname\}/g, r.name || '').replace(/\{amount\}/g, r.amount ? String(r.amount) : '').replace(/\{link\}/g, baseUrl + (r.link || '/c/' + c.slug)).replace(/\{campaign\}/g, c.title).replace(/\{raised\}/g, String(stats(c, isTest(c)).total));
async function sendSms(cfg, phone, text) {
  const to = phone.startsWith('0') ? '+972' + phone.slice(1) : (phone.startsWith('+') ? phone : '+' + phone);
  if (cfg.type === 'twilio') {
    const body = form({ To: to, From: cfg.from, Body: text });
    const r = await new Promise((resolve, reject) => { const q = https.request({ hostname: 'api.twilio.com', path: `/2010-04-01/Accounts/${cfg.sid}/Messages.json`, method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(cfg.sid + ':' + cfg.token).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, res => { let d = ''; res.on('data', x => d += x); res.on('end', () => resolve({ s: res.statusCode, d })); }); q.on('error', reject); q.write(body); q.end(); });
    if (r.s >= 300) throw new Error('Twilio ' + r.s); return true;
  }
  if (cfg.type === 'http') {
    const url = String(cfg.url || '').replace('{phone}', encodeURIComponent(cfg.intl ? to : phone)).replace('{text}', encodeURIComponent(text));
    const r = await new Promise((resolve, reject) => { const u = new URL(url); const q = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: cfg.method === 'POST' ? 'POST' : 'GET' }, res => { let d = ''; res.on('data', x => d += x); res.on('end', () => resolve({ s: res.statusCode, d })); }); q.on('error', reject); q.end(); });
    if (r.s >= 300) throw new Error('HTTP ' + r.s); return true;
  }
  throw new Error('ספק SMS לא מוגדר');
}
const form = (o) => Object.entries(o).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
const getKV = k => J(db.prepare('SELECT v FROM kv WHERE k=?').get(k)?.v);
const setKV = (k, v) => db.prepare('INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k, JSON.stringify(v));
const mask = o => ({ ...o, token: o.token ? '••••' : '', secret: o.secret ? '••••' : '' });
app.get('/api/admin/msg', auth, adm, (_, res) => { const m = getKV('msg'); res.json({ sms: mask(m.sms || {}), wa: mask(m.wa || {}) }); });
app.put('/api/admin/msg', auth, adm, (req, res) => { const cur = getKV('msg'); const b = req.body || {}; const merge = (o = {}, n = {}) => { const x = { ...o, ...n }; if (n.token === '••••') x.token = o.token; if (n.secret === '••••') x.secret = o.secret; return x; }; setKV('msg', { sms: merge(cur.sms, b.sms), wa: merge(cur.wa, b.wa) }); res.json({ ok: true }); });
// platform support contact (shown as a help button everywhere)
app.get('/api/support', (_, res) => { const s = getKV('support'); const adm = s.phone ? null : db.prepare("SELECT phone FROM users WHERE role='admin' AND phone!='' ORDER BY id LIMIT 1").get(); res.json({ phone: s.phone || adm?.phone || '', email: s.email || process.env.ADMIN_EMAIL || '', text: s.text || 'שלום, אני צריך עזרה עם GiveIL' }); });
app.put('/api/admin/support', auth, adm, (req, res) => { const b = req.body || {}; setKV('support', { phone: String(b.phone || '').replace(/[^\d+]/g, '').slice(0, 20), email: String(b.email || '').slice(0, 120), text: String(b.text || '').slice(0, 200) }); res.json({ ok: true }); });
app.get('/api/msg-channels', auth, (_, res) => { const m = getKV('msg'); res.json({ sms: !!(m.sms && m.sms.type), wa: !!(m.wa && m.wa.type) }); });
app.get('/api/me/sms', auth, (req, res) => { const u = db.prepare('SELECT sms FROM users WHERE id=?').get(req.user.id); const c = J(u.sms); res.json({ ...c, token: c.token ? '••••' : '' }); });
app.put('/api/me/sms', auth, (req, res) => { const b = req.body || {}; const cur = J(db.prepare('SELECT sms FROM users WHERE id=?').get(req.user.id).sms); const next = { type: b.type || '', sid: b.sid || '', token: b.token && b.token !== '••••' ? b.token : cur.token || '', from: b.from || '', url: b.url || '', method: b.method || 'GET', intl: !!b.intl }; db.prepare('UPDATE users SET sms=? WHERE id=?').run(JSON.stringify(next), req.user.id); res.json({ ok: true }); });
app.get('/api/campaigns/:id/recipients', auth, own, (req, res) => res.json(recipients(req.c, req.query.audience).map(r => ({ ...r, text: fill(req.query.text || '', r, req.c, base(req)) }))));
app.get('/api/campaigns/:id/messages', auth, own, (req, res) => res.json(db.prepare('SELECT * FROM messages WHERE campaign_id=? ORDER BY id DESC LIMIT 50').all(req.c.id)));
app.post('/api/campaigns/:id/messages', auth, own, async (req, res) => {
  const b = req.body || {}; const text = String(b.text || '').trim().slice(0, 600); if (!text && b.channel !== 'email') return bad(res, 'טקסט');
  if (b.channel === 'email') {
    if (!mail.enabled()) return bad(res, 'שליחת מייל עדיין לא מופעלת במערכת');
    const list = recipients(req.c, b.audience, true); if (!list.length) return bad(res, 'אין נמענים עם אימייל'); if (list.length > 2000) return bad(res, 'עד 2000 נמענים בשליחה אחת');
    const m = db.prepare('INSERT INTO messages(campaign_id,user_id,channel,audience,text,total) VALUES(?,?,?,?,?,?)').run(req.c.id, req.user.id, 'email', b.audience || 'donors', text, list.length);
    res.json({ ok: true, queued: list.length });
    let sent = 0, failed = 0; const owner = db.prepare('SELECT email FROM users WHERE id=?').get(req.user.id) || {};
    for (const r of list) { try { const { subject, html } = renderMail(req.c, b.kind || 'update', r, base(req)); const o = await mail.send({ to: r.email, subject, html, replyTo: owner.email }); if (o.ok) sent++; else failed++; } catch { failed++; } await new Promise(x => setTimeout(x, 120)); }
    return db.prepare('UPDATE messages SET sent=?,failed=? WHERE id=?').run(sent, failed, m.lastInsertRowid);
  }
  const list = recipients(req.c, b.audience); if (!list.length) return bad(res, 'אין נמענים');
  const ch = b.channel === 'wa' ? 'wa' : 'sms'; const cfg = (getKV('msg')[ch]) || {}; if (!cfg.type) return bad(res, ch === 'wa' ? 'שליחת וואטסאפ אוטומטית עדיין לא הופעלה במערכת' : 'שליחת SMS עדיין לא הופעלה במערכת');
  if (list.length > 5000) return bad(res, 'עד 5000 נמענים בשליחה אחת');
  const m = db.prepare('INSERT INTO messages(campaign_id,user_id,channel,audience,text,total) VALUES(?,?,?,?,?,?)').run(req.c.id, req.user.id, ch, b.audience || 'donors', text, list.length);
  let sent = 0, failed = 0, firstErr = '';
  for (const r of list) { try { await sendSms(cfg, r.phone, fill(text, r, req.c, base(req))); sent++; } catch (e) { failed++; if (!firstErr) firstErr = e.message; } }
  db.prepare('UPDATE messages SET sent=?,failed=? WHERE id=?').run(sent, failed, m.lastInsertRowid);
  res.json({ ok: true, sent, failed, error: firstErr });
});
app.get('/api/campaigns/:id/mail-preview', auth, own, (req, res) => { const r = { name: 'ישראל ישראלי', amount: 180, email: req.user.email, link: '/c/' + req.c.slug }; res.type('html').send(renderMail(req.c, String(req.query.kind || 'thanks'), r, base(req)).html); });
app.post('/api/campaigns/:id/mail-test', auth, own, limit(10, 600000), async (req, res) => { if (!mail.enabled()) return bad(res, 'שליחת מייל עדיין לא מופעלת – נפעיל אותה בקרוב'); const r = { name: req.user.name || 'ישראל', amount: 180, email: req.user.email, link: '/c/' + req.c.slug }; const { subject, html } = renderMail(req.c, String(req.body?.kind || 'thanks'), r, base(req)); const o = await mail.send({ to: req.user.email, subject: '[בדיקה] ' + subject, html }); res.json({ ok: o.ok, to: req.user.email, err: o.ok ? '' : o.body }); });
app.post('/api/campaigns/:id/messages/log', auth, own, (req, res) => { const b = req.body || {}; db.prepare('INSERT INTO messages(campaign_id,user_id,channel,audience,text,total,sent) VALUES(?,?,?,?,?,?,?)').run(req.c.id, req.user.id, 'manual', b.audience || 'donors', String(b.text || '').slice(0, 600), +b.total || 0, +b.sent || 0); res.json({ ok: true }); });

// ---------- AI guide ----------
function ctxFor(uid, cid) {
  const c = cid ? db.prepare('SELECT * FROM campaigns WHERE id=? AND user_id=?').get(cid, uid) : null; if (!c) return '';
  const st = stats(c, isTest(c)); const last = db.prepare("SELECT name,amount,created FROM donations WHERE campaign_id=? AND status='paid' ORDER BY id DESC LIMIT 5").all(c.id);
  const lastHour = db.prepare("SELECT COUNT(*) n FROM donations WHERE campaign_id=? AND status='paid' AND paid_at>=datetime('now','-1 hour')").get(c.id).n;
  return `\nקמפיין נוכחי: "${c.title}" (${c.status}), יעד ${c.goal} ${c.currency}, מסתיים ${c.end_at}. גויסו ${st.total} (${st.pct}%) מ-${st.count} תורמים. תרומות בשעה האחרונה: ${lastHour}. ספק סליקה: ${J(c.provider).type}. שגרירים: ${db.prepare('SELECT COUNT(*) n FROM teams WHERE campaign_id=?').get(c.id).n}. רמות: ${db.prepare('SELECT name,amount FROM levels WHERE campaign_id=?').all(c.id).map(l => l.name + ' ' + l.amount).join(', ')}. סיפור: ${(c.story || '').slice(0, 600)}. תרומות אחרונות: ${last.map(d => d.name + ' ' + d.amount).join(', ')}`;
}
const SYS = `אתה "המדריך" של GiveIL (ראשי תיבות: צדקה תציל ממות), פלטפורמת גיוס תרומות ישראלית לעמותות. אתה עוזר למנהלי קמפיינים: כתיבת סיפור קמפיין, כותרות, רמות תרומה, הודעות וואטסאפ לשגרירים ולתורמים, טיפים לקמפיין גיוס, הסבר על המערכת (אשף קמפיין, מצב בדיקה, חיבור סליקה: נדרים פלוס, משולם/Grow, PayPal, דף תשלום חיצוני; שגרירים עם קישור אישי; מסך אירוע חי; ייצוא CSV; רב-לשוניות). ענה בשפה של המשתמש, קצר, מעשי, עם דוגמאות מוכנות להעתקה. כשמבקשים טקסט, תן את הטקסט עצמו. אל תמציא נתונים שאינם בהקשר.`;
async function llm(messages, context) {
  const sys = SYS + (context || '');
  if (process.env.ANTHROPIC_API_KEY) {
    const body = JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 1200, system: sys, messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 6000) })) });
    const r = await new Promise((resolve, reject) => { const q = https.request({ hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(body) } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); }); q.on('error', reject); q.write(body); q.end(); });
    const j = JSON.parse(r); if (j.error) throw new Error(j.error.message); return j.content?.map(x => x.text || '').join('') || '';
  }
  if (process.env.GEMINI_API_KEY) {
    const body = JSON.stringify({ system_instruction: { parts: [{ text: sys }] }, contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content).slice(0, 6000) }] })) });
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const r = await new Promise((resolve, reject) => { const q = https.request({ hostname: 'generativelanguage.googleapis.com', path: `/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); }); q.on('error', reject); q.write(body); q.end(); });
    const j = JSON.parse(r); if (j.error) throw new Error(j.error.message); return j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  }
  return null;
}
const FAQ = [[/סליקה|נדרים|משולם|paypal|תשלום/i, 'חיבור סליקה: בקמפיין → "סליקה" בחרו ספק והזינו את הפרטים שקיבלתם ממנו (נדרים פלוס: מספר מוסד + ApiValid; משולם: Page code + User ID; PayPal: Client ID + Secret). עד שתעלו לאוויר, הקמפיין במצב בדיקה ואפשר לתרגל תרומות מדומות.'], [/שגריר|צוות|קישור אישי/i, 'שגרירים: בקמפיין → "שגרירים" → הוספה. לכל שגריר נוצר קישור אישי (כתובת הקמפיין + שם), יעד אישי ודירוג חי בדף הקמפיין. שלחו לו את הקישור בוואטסאפ מהכפתור ליד שמו.'], [/בדיקה|לאוויר|live|test/i, 'מצב בדיקה: כל קמפיין מתחיל בבדיקה. תרמו דרך "עמוד הבדיקה", ראו איך הדף, המסך וההודעות נראים. כשמוכנים: "עלייה לאוויר" — המערכת מוחקת תרומות בדיקה ומפעילה את הסליקה האמיתית.'], [/מסך|טלוויזיה|אירוע/i, 'מסך אירוע: לכל קמפיין יש כתובת /c/<כתובת>/screen. פתחו אותה בטלוויזיה/מקרן באירוע, והיא מציגה תורמים וסכום בזמן אמת.'], [/ייצוא|אקסל|csv/i, 'ייצוא: בעמוד התרומות של הקמפיין → "ייצוא CSV". הקובץ נפתח באקסל עם כל הפרטים, כולל אסמכתאות.'], [/שפה|אנגלית|english/i, 'שפות: בהגדרות הקמפיין בחרו אילו שפות להציע (עברית, אנגלית, צרפתית, ספרדית). בדף הקמפיין יופיע מתג שפה, והקישור ?lang=en פותח ישירות באנגלית.']];
app.post('/api/assist', auth, async (req, res) => {
  const msgs = (req.body?.messages || []).slice(-12); if (!msgs.length) return bad(res, 'messages');
  try { const out = await llm(msgs, ctxFor(req.user.id, req.body?.campaignId)); if (out) return res.json({ reply: out, ai: true }); }
  catch (e) { return res.json({ reply: 'המדריך החכם לא זמין כרגע (' + e.message + '). ' , ai: false }); }
  const q = String(msgs[msgs.length - 1].content || '');
  const hit = FAQ.find(([re]) => re.test(q));
  res.json({ reply: hit ? hit[1] : 'אני יכול לעזור עם: חיבור סליקה, שגרירים, מצב בדיקה ועלייה לאוויר, מסך אירוע, ייצוא, שפות. (כדי לקבל מדריך AI מלא, הגדירו ANTHROPIC_API_KEY או GEMINI_API_KEY בשרת.)', ai: false });
});

// ---------- pages ----------
const pub = f => path.join(__dirname, 'public', f);
app.use(express.static(pub(''), { maxAge: '1h', setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
app.get('/c/:slug/screen', (_, res) => res.sendFile(pub('screen.html')));
app.get('/c/:slug/widget', (_, res) => res.sendFile(pub('widget.html')));
app.get(['/c/:slug', '/c/:slug/:team'], (req, res) => {
  const c = getC(req.params.slug); if (!c) return res.status(404).sendFile(pub('404.html'));
  let html = fs.readFileSync(pub('c.html'), 'utf8');
  const esc = s => String(s || '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const sh = J(c.settings).share || c.cover; const img = sh ? (sh.startsWith('http') ? sh : base(req) + sh) : base(req) + '/icon.svg';
  const st = J(c.settings); const langs = st.langs && st.langs.length ? st.langs : [c.lang || 'he'];
  let auto = c.lang || 'he'; if (st.autoLang !== false) { const al = String(req.headers['accept-language'] || '').toLowerCase().split(',').map(x => x.split(';')[0].trim().slice(0, 2)); const hit = al.find(l => langs.includes(l)); if (hit) auto = hit; }
  html = html.replace('<html lang="he" dir="rtl">', `<html lang="he" dir="rtl" data-auto-lang="${auto}">`);
  html = html.replace('<!--META-->', `<title>${esc(c.title)}</title><meta name="description" content="${esc(c.subtitle)}"><meta property="og:title" content="${esc(c.title)}"><meta property="og:description" content="${esc(c.subtitle)}"><meta property="og:image" content="${esc(img)}"><meta property="og:type" content="website"><meta name="theme-color" content="${esc(c.color)}">`).replace('<html lang="he" dir="rtl">', `<html lang="${c.lang}" dir="${c.lang === 'en' ? 'ltr' : 'rtl'}" data-auto-lang="${auto}">`);
  res.setHeader('Cache-Control', 'no-cache'); res.send(html);
});
app.get(['/app', '/app/*'], (_, res) => res.sendFile(pub('app.html')));
app.get('/', (_, res) => res.sendFile(pub('index.html')));
app.get(['/terms', '/privacy', '/accessibility'], (_, res) => res.sendFile(pub('legal.html')));
app.get('/sitemap.xml', (req, res) => { const b = base(req); const slugs = db.prepare("SELECT slug FROM campaigns WHERE status='live'").all().map(x => x.slug); res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ['', '/terms', '/privacy', '/accessibility', '/c/demo', ...slugs.map(x => '/c/' + x)].map(u => `<url><loc>${b}${u}</loc></url>`).join('') + '</urlset>'); });
app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nAllow: /\nSitemap: ' + base(req) + '/sitemap.xml\nDisallow: /app\nDisallow: /pay/\nDisallow: /api/\n'));
app.use((_, res) => res.status(404).sendFile(pub('404.html')));
app.listen(process.env.PORT || 3000, () => console.log('ttm up'));
