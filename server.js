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
const slugify = s => String(s || '').toLowerCase().replace(/[^a-z0-9֐-׿]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || crypto.randomBytes(3).toString('hex');
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
  const mult = c.multiplier || 1;
  return { count: r.n, raised: r.s, total: Math.round(r.s * mult), goal: c.goal, bonus_goal: c.bonus_goal, multiplier: mult, pct: c.goal ? Math.min(999, Math.round(r.s * mult / c.goal * 1000) / 10) : 0 };
}
function publicDonation(d) { return { id: d.id, name: d.anonymous ? '' : d.name, amount: d.amount, currency: d.currency, dedication: d.dedication, team_id: d.team_id, anonymous: !!d.anonymous, created: d.paid_at || d.created, monthly: !!d.monthly }; }
function markPaid(id, { ref = '', meta = {}, amount } = {}) {
  const d = db.prepare('SELECT * FROM donations WHERE id=?').get(id); if (!d) return null;
  if (d.status === 'paid') return d;
  db.prepare("UPDATE donations SET status='paid', ref=?, meta=?, amount=COALESCE(?,amount), paid_at=datetime('now') WHERE id=?").run(String(ref), JSON.stringify(meta).slice(0, 4000), amount || null, id);
  const nd = db.prepare('SELECT * FROM donations WHERE id=?').get(id);
  const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(d.campaign_id);
  emit(c.id, 'donation', { donation: publicDonation(nd), stats: stats(c, nd.test), teams: teamStats(c, nd.test) });
  return nd;
}
function teamStats(c, test) {
  return db.prepare("SELECT t.id,t.slug,t.name,t.goal,t.photo,t.descr, COUNT(d.id) n, COALESCE(SUM(d.amount),0) s FROM teams t LEFT JOIN donations d ON d.team_id=t.id AND d.status='paid' AND d.test=? WHERE t.campaign_id=? GROUP BY t.id ORDER BY s DESC, t.pos, t.id").all(test ? 1 : 0, c.id).map(t => ({ ...t, total: Math.round(t.s * (c.multiplier || 1)) }));
}
const isTest = c => c.status !== 'live' && c.status !== 'ended';

// ---------- auth ----------
app.post('/api/register', limit(5, 600000), (req, res) => {
  const { email, password, name, phone, org } = req.body || {};
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) return bad(res, 'אימייל לא תקין');
  if (String(password || '').length < 6) return bad(res, 'סיסמה: לפחות 6 תווים');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email.toLowerCase())) return bad(res, 'האימייל כבר רשום, התחברו');
  const first = db.prepare('SELECT COUNT(*) c FROM users').get().c === 0;
  const role = first || (process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL.toLowerCase() === email.toLowerCase()) ? 'admin' : 'user';
  const r = db.prepare('INSERT INTO users(email,pass,name,phone,org,role) VALUES(?,?,?,?,?,?)').run(email.toLowerCase(), hashPw(password), String(name || '').slice(0, 60), String(phone || '').slice(0, 20), String(org || '').slice(0, 80), role);
  res.cookie('sid', sign({ uid: r.lastInsertRowid, exp: Date.now() + 90 * 864e5 }), { httpOnly: true, sameSite: 'lax', maxAge: 90 * 864e5, secure: !!process.env.RAILWAY_ENVIRONMENT });
  res.json({ ok: true });
});
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
  const j = await fetchJson(`https://data.gov.il/api/3/action/datastore_search?resource_id=${AMUTOT_RES}&filters=${encodeURIComponent(JSON.stringify({ 'מספר עמותה': n }))}&limit=1`);
  const rec = j?.result?.records?.[0]; if (!rec) return null;
  const pick = re => { const k = Object.keys(rec).find(k => re.test(k)); return k ? String(rec[k] ?? '') : ''; };
  return { number: n, name: pick(/שם.*עברית|שם עמותה/), status: pick(/סטטוס/), goals: pick(/מטרות/).slice(0, 500), city: pick(/ישוב|עיר/), proper: pick(/ניהול תקין/), raw: rec };
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
app.get('/api/me', (req, res) => { const u = user(req); if (!u) return res.json({ user: null }); const x = db.prepare('SELECT org_number,org_name,org_verified,org_status FROM users WHERE id=?').get(u.id); res.json({ user: { ...u, ...x } }); });
app.put('/api/me', auth, (req, res) => { const b = req.body || {}; db.prepare('UPDATE users SET name=?,phone=?,org=? WHERE id=?').run(String(b.name || '').slice(0, 60), String(b.phone || '').slice(0, 20), String(b.org || '').slice(0, 80), req.user.id); if (b.password && b.password.length >= 6) db.prepare('UPDATE users SET pass=? WHERE id=?').run(hashPw(b.password), req.user.id); res.json({ ok: true }); });

// ---------- uploads ----------
const upload = multer({ storage: multer.diskStorage({ destination: path.join(DATA_DIR, 'uploads'), filename: (_, f, cb) => cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + path.extname(f.originalname).toLowerCase()) }), limits: { fileSize: 10e6 }, fileFilter: (_, f, cb) => cb(null, /image\/(jpeg|png|webp|gif|svg\+xml)/.test(f.mimetype)) });
app.post('/api/upload', auth, upload.single('file'), (req, res) => req.file ? res.json({ url: '/u/' + req.file.filename }) : bad(res, 'no file'));
app.use('/u', express.static(path.join(DATA_DIR, 'uploads'), { maxAge: '30d', immutable: true }));

// ---------- campaigns (owner) ----------
const campaignOut = c => ({ ...c, settings: J(c.settings), provider: { ...J(c.provider), _hasSecret: undefined }, levels: db.prepare('SELECT * FROM levels WHERE campaign_id=? ORDER BY pos,id').all(c.id), teams: db.prepare('SELECT * FROM teams WHERE campaign_id=? ORDER BY pos,id').all(c.id), matchers: db.prepare('SELECT * FROM matchers WHERE campaign_id=? ORDER BY pos,id').all(c.id) });
app.get('/api/campaigns', auth, (req, res) => {
  const rows = req.user.role === 'admin' && req.query.all ? db.prepare('SELECT c.*, u.email owner FROM campaigns c JOIN users u ON u.id=c.user_id ORDER BY c.id DESC').all() : db.prepare('SELECT * FROM campaigns WHERE user_id=? ORDER BY id DESC').all(req.user.id);
  res.json(rows.map(c => ({ id: c.id, slug: c.slug, title: c.title, status: c.status, goal: c.goal, multiplier: c.multiplier, end_at: c.end_at, cover: c.cover, owner: c.owner, stats: stats(c, isTest(c)) })));
});
app.post('/api/campaigns', auth, (req, res) => {
  if (req.user.role !== 'admin' && req.user.org_verified !== 1) return bad(res, 'כדי לפתוח קמפיין צריך עמותה מאומתת. אמתו את מספר העמותה בהגדרות החשבון.', 403);
  const b = req.body || {}; const title = String(b.title || 'קמפיין חדש').slice(0, 120);
  let slug = slugify(b.slug || title); while (db.prepare('SELECT 1 FROM campaigns WHERE slug=?').get(slug)) slug = slug + '-' + crypto.randomBytes(2).toString('hex');
  const end = b.end_at || new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 16);
  const r = db.prepare('INSERT INTO campaigns(user_id,slug,title,subtitle,goal,multiplier,start_at,end_at,currency,settings) VALUES(?,?,?,?,?,?,?,?,?,?)').run(req.user.id, slug, title, String(b.subtitle || '').slice(0, 200), +b.goal || 100000, +b.multiplier || 1, b.start_at || new Date().toISOString().slice(0, 16), end, b.currency === 'USD' ? 'USD' : 'ILS', JSON.stringify({ showDonors: true, allowAnon: true, allowMonthly: true, installments: 12, minAmount: 10, presets: [100, 180, 360, 500, 1000, 1800], thanks: 'תודה רבה! התרומה שלך התקבלה.' }));
  const id = r.lastInsertRowid;
  [[180, 'ידיד'], [500, 'שותף'], [1000, 'תומך'], [1800, 'מייסד']].forEach(([a, n], i) => db.prepare('INSERT INTO levels(campaign_id,name,amount,pos) VALUES(?,?,?,?)').run(id, n, a, i));
  res.json(campaignOut(db.prepare('SELECT * FROM campaigns WHERE id=?').get(id)));
});
app.get('/api/campaigns/:id', auth, own, (req, res) => res.json({ ...campaignOut(req.c), stats: stats(req.c, isTest(req.c)), teamStats: teamStats(req.c, isTest(req.c)) }));
app.put('/api/campaigns/:id', auth, own, (req, res) => {
  const b = req.body || {}; const c = req.c;
  const f = {
    title: String(b.title ?? c.title).slice(0, 120), subtitle: String(b.subtitle ?? c.subtitle).slice(0, 200), story: String(b.story ?? c.story).slice(0, 20000),
    goal: +(b.goal ?? c.goal) || 0, bonus_goal: +(b.bonus_goal ?? c.bonus_goal) || 0, currency: (b.currency ?? c.currency) === 'USD' ? 'USD' : 'ILS', multiplier: Math.max(1, +(b.multiplier ?? c.multiplier) || 1),
    start_at: b.start_at ?? c.start_at, end_at: b.end_at ?? c.end_at, cover: String(b.cover ?? c.cover).slice(0, 300), logo: String(b.logo ?? c.logo).slice(0, 300), video: String(b.video ?? c.video).slice(0, 300),
    color: /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : c.color, lang: b.lang === 'en' ? 'en' : 'he',
    settings: JSON.stringify({ ...J(c.settings), ...(b.settings || {}) }), provider: b.provider ? JSON.stringify({ ...J(c.provider), ...b.provider }) : c.provider
  };
  if (b.slug && b.slug !== c.slug) { const s = slugify(b.slug); if (db.prepare('SELECT 1 FROM campaigns WHERE slug=? AND id!=?').get(s, c.id)) return bad(res, 'הכתובת תפוסה'); f.slug = s; } else f.slug = c.slug;
  db.prepare('UPDATE campaigns SET title=@title,subtitle=@subtitle,story=@story,goal=@goal,bonus_goal=@bonus_goal,currency=@currency,multiplier=@multiplier,start_at=@start_at,end_at=@end_at,cover=@cover,logo=@logo,video=@video,color=@color,lang=@lang,settings=@settings,provider=@provider,slug=@slug WHERE id=@id').run({ ...f, id: c.id });
  if (Array.isArray(b.levels)) { db.prepare('DELETE FROM levels WHERE campaign_id=?').run(c.id); b.levels.forEach((l, i) => db.prepare('INSERT INTO levels(id,campaign_id,name,amount,descr,stock,pos) VALUES(?,?,?,?,?,?,?)').run(l.id || null, c.id, String(l.name || '').slice(0, 60), +l.amount || 0, String(l.descr || '').slice(0, 200), +l.stock || 0, i)); }
  if (Array.isArray(b.matchers)) { db.prepare('DELETE FROM matchers WHERE campaign_id=?').run(c.id); b.matchers.forEach((m, i) => db.prepare('INSERT INTO matchers(campaign_id,name,logo,pos) VALUES(?,?,?,?)').run(c.id, String(m.name || '').slice(0, 80), String(m.logo || '').slice(0, 300), i)); }
  res.json(campaignOut(db.prepare('SELECT * FROM campaigns WHERE id=?').get(c.id)));
});
app.post('/api/campaigns/:id/status', auth, own, (req, res) => {
  const s = req.body?.status; if (!['draft', 'test', 'live', 'ended'].includes(s)) return bad(res, 'status');
  if (s === 'live' && J(req.c.provider).type === 'test') return bad(res, 'כדי לעלות לאוויר צריך לחבר ספק סליקה אמיתי');
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
app.post('/api/campaigns/:id/teams', auth, own, (req, res) => { const b = req.body || {}; let slug = slugify(b.slug || b.name); while (db.prepare('SELECT 1 FROM teams WHERE campaign_id=? AND slug=?').get(req.c.id, slug)) slug += crypto.randomBytes(1).toString('hex'); const r = db.prepare('INSERT INTO teams(campaign_id,slug,name,goal,phone,photo,descr,pos) VALUES(?,?,?,?,?,?,?,?)').run(req.c.id, slug, String(b.name || '').slice(0, 80), +b.goal || 0, String(b.phone || '').slice(0, 20), String(b.photo || '').slice(0, 300), String(b.descr || '').slice(0, 300), +b.pos || 0); res.json({ id: r.lastInsertRowid, slug }); });
app.put('/api/campaigns/:id/teams/:tid', auth, own, (req, res) => { const b = req.body || {}; db.prepare('UPDATE teams SET name=?,goal=?,phone=?,photo=?,descr=?,pos=? WHERE id=? AND campaign_id=?').run(String(b.name || '').slice(0, 80), +b.goal || 0, String(b.phone || '').slice(0, 20), String(b.photo || '').slice(0, 300), String(b.descr || '').slice(0, 300), +b.pos || 0, req.params.tid, req.c.id); res.json({ ok: true }); });
app.delete('/api/campaigns/:id/teams/:tid', auth, own, (req, res) => { db.prepare('DELETE FROM teams WHERE id=? AND campaign_id=?').run(req.params.tid, req.c.id); db.prepare('UPDATE donations SET team_id=NULL WHERE team_id=?').run(req.params.tid); res.json({ ok: true }); });
// donations (owner)
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
  const csv = '﻿' + ['מזהה', 'תאריך', 'שם', 'טלפון', 'אימייל', 'סכום', 'מטבע', 'תשלומים', 'הו"ק', 'הקדשה', 'שגריר', 'סטטוס', 'ספק', 'אסמכתא', 'אנונימי'].map(esc).join(',') + '\n' + rows.map(d => [d.id, d.paid_at || d.created, d.name, d.phone, d.email, d.amount, d.currency, d.installments, d.monthly ? 'כן' : '', d.dedication, d.team, d.status, d.provider, d.ref, d.anonymous ? 'כן' : ''].map(esc).join(',')).join('\n');
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
  if (b.status === 'paid' && d.status !== 'paid') markPaid(d.id, { ref: b.ref || d.ref || 'manual' });
  else db.prepare('UPDATE donations SET status=COALESCE(?,status), name=COALESCE(?,name), phone=COALESCE(?,phone), email=COALESCE(?,email), dedication=COALESCE(?,dedication), anonymous=COALESCE(?,anonymous), team_id=? , amount=COALESCE(?,amount) WHERE id=?').run(b.status || null, b.name ?? null, b.phone ?? null, b.email ?? null, b.dedication ?? null, b.anonymous === undefined ? null : (b.anonymous ? 1 : 0), b.team_id === undefined ? d.team_id : (+b.team_id || null), b.amount ? Math.round(+b.amount) : null, d.id);
  emit(req.c.id, 'refresh', { stats: stats(req.c, d.test), teams: teamStats(req.c, d.test) }); res.json({ ok: true });
});
app.delete('/api/campaigns/:id/donations/:did', auth, own, (req, res) => { const d = db.prepare('SELECT test FROM donations WHERE id=? AND campaign_id=?').get(req.params.did, req.c.id); db.prepare('DELETE FROM donations WHERE id=? AND campaign_id=?').run(req.params.did, req.c.id); if (d) emit(req.c.id, 'refresh', { stats: stats(req.c, d.test), teams: teamStats(req.c, d.test) }); res.json({ ok: true }); });
app.post('/api/campaigns/:id/clear-test', auth, own, (req, res) => { db.prepare('DELETE FROM donations WHERE campaign_id=? AND test=1').run(req.c.id); emit(req.c.id, 'refresh', { stats: stats(req.c, true), teams: teamStats(req.c, true) }); res.json({ ok: true }); });
app.get('/api/providers', (_, res) => res.json(Object.entries(providers).map(([k, v]) => ({ type: k, label: v.label, fields: v.fields }))));

// ---------- superadmin ----------
const adm = (req, res, next) => req.user.role === 'admin' ? next() : bad(res, 'auth', 403);
app.get('/api/admin/overview', auth, adm, (req, res) => res.json({
  users: db.prepare('SELECT id,email,name,org,org_number,org_name,org_verified,org_status,phone,role,created,(SELECT COUNT(*) FROM campaigns WHERE user_id=users.id) campaigns FROM users ORDER BY id DESC').all(),
  campaigns: db.prepare("SELECT c.id,c.slug,c.title,c.status,c.goal,c.multiplier,c.end_at,c.created,u.email owner,u.org_name, (SELECT COUNT(*) FROM donations d WHERE d.campaign_id=c.id AND d.status='paid' AND d.test=0) n, (SELECT COALESCE(SUM(amount),0) FROM donations d WHERE d.campaign_id=c.id AND d.status='paid' AND d.test=0) raised FROM campaigns c JOIN users u ON u.id=c.user_id ORDER BY c.id DESC").all(),
  totals: db.prepare("SELECT COUNT(*) donations, COALESCE(SUM(amount),0) raised FROM donations WHERE status='paid' AND test=0").get(),
  live: db.prepare("SELECT COUNT(*) c FROM campaigns WHERE status='live'").get().c,
  today: db.prepare("SELECT COUNT(*) n, COALESCE(SUM(amount),0) s FROM donations WHERE status='paid' AND test=0 AND date(paid_at)=date('now')").get(),
  daily: db.prepare("SELECT date(paid_at) d, COUNT(*) n, SUM(amount) s FROM donations WHERE status='paid' AND test=0 AND paid_at>=date('now','-30 day') GROUP BY d ORDER BY d").all()
}));
app.patch('/api/admin/users/:id', auth, adm, (req, res) => { const b = req.body || {}; db.prepare("UPDATE users SET role=COALESCE(?,role), org_verified=COALESCE(?,org_verified), org_status=CASE WHEN ? IS NULL THEN org_status ELSE 'אומת ידנית' END, org_name=COALESCE(?,org_name) WHERE id=?").run(b.role || null, b.org_verified ?? null, b.org_verified ?? null, b.org_name || null, req.params.id); res.json({ ok: true }); });
app.delete('/api/admin/users/:id', auth, adm, (req, res) => { if (+req.params.id === req.user.id) return bad(res, 'self'); db.prepare('DELETE FROM users WHERE id=?').run(req.params.id); res.json({ ok: true }); });
app.post('/api/admin/campaigns/:id/status', auth, adm, (req, res) => { db.prepare('UPDATE campaigns SET status=? WHERE id=?').run(['draft', 'test', 'live', 'ended'].includes(req.body?.status) ? req.body.status : 'draft', req.params.id); res.json({ ok: true }); });

// ---------- public campaign API ----------
const getC = slug => db.prepare('SELECT * FROM campaigns WHERE slug=?').get(slug);
app.get('/api/c/:slug', (req, res) => {
  const c = getC(req.params.slug); if (!c) return bad(res, 'not found', 404);
  const test = isTest(c); const s = J(c.settings);
  const t = req.query.team ? db.prepare('SELECT id,slug,name,goal,photo,descr FROM teams WHERE campaign_id=? AND slug=?').get(c.id, req.query.team) : null;
  res.json({
    campaign: { id: c.id, slug: c.slug, title: c.title, subtitle: c.subtitle, story: c.story, goal: c.goal, bonus_goal: c.bonus_goal, currency: c.currency, multiplier: c.multiplier, start_at: c.start_at, end_at: c.end_at, status: c.status, cover: c.cover, logo: c.logo, video: c.video, color: c.color, lang: c.lang, settings: s, test, providerType: J(c.provider).type || 'test' },
    levels: db.prepare('SELECT id,name,amount,descr,stock,(SELECT COUNT(*) FROM donations WHERE level_id=levels.id AND status=\'paid\' AND test=?) used FROM levels WHERE campaign_id=? ORDER BY pos,id').all(test ? 1 : 0, c.id),
    teams: teamStats(c, test), team: t, matchers: db.prepare('SELECT name,logo FROM matchers WHERE campaign_id=? ORDER BY pos,id').all(c.id),
    stats: stats(c, test),
    donations: db.prepare("SELECT * FROM donations WHERE campaign_id=? AND status='paid' AND test=? ORDER BY paid_at DESC, id DESC LIMIT 60").all(c.id, test ? 1 : 0).map(publicDonation)
  });
});
app.get('/api/c/:slug/donations', (req, res) => { const c = getC(req.params.slug); if (!c) return bad(res, 'not found', 404); const off = +req.query.offset || 0; const team = +req.query.team || 0; res.json(db.prepare(`SELECT * FROM donations WHERE campaign_id=? AND status='paid' AND test=? ${team ? 'AND team_id=' + team : ''} ORDER BY paid_at DESC, id DESC LIMIT 60 OFFSET ?`).all(c.id, isTest(c) ? 1 : 0, off).map(publicDonation)); });
app.get('/api/c/:slug/stream', (req, res) => {
  const c = getC(req.params.slug); if (!c) return res.status(404).end();
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' }); res.write(':ok\n\n');
  if (!subs.has(c.id)) subs.set(c.id, new Set()); subs.get(c.id).add(res);
  const ping = setInterval(() => { try { res.write(':p\n\n'); } catch { } }, 25000);
  req.on('close', () => { clearInterval(ping); subs.get(c.id)?.delete(res); });
});
const hits = new Map();
const limit = (n, win) => (req, res, next) => { const k = req.ip + req.path; const now = Date.now(); const a = (hits.get(k) || []).filter(t => now - t < win); a.push(now); hits.set(k, a); if (a.length > n) return bad(res, 'יותר מדי ניסיונות, נסו שוב בעוד דקה', 429); next(); };
setInterval(() => { const now = Date.now(); for (const [k, a] of hits) if (!a.some(t => now - t < 60000)) hits.delete(k); }, 60000).unref();
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
  const prov = J(c.provider); const type = isTest(c) ? 'test' : (prov.type || 'test'); const P = providers[type]; if (!P) return bad(res, 'ספק סליקה לא מוגדר');
  const inst = Math.min(Math.max(1, +b.installments || 1), s.installments || 1);
  const token = crypto.randomBytes(16).toString('hex');
  const r = db.prepare('INSERT INTO donations(campaign_id,team_id,level_id,amount,currency,name,phone,email,dedication,anonymous,status,test,provider,installments,monthly,token) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(c.id, team ? team.id : null, level ? level.id : null, amount, c.currency, name, phone, email, String(b.dedication || '').slice(0, 300), b.anonymous && s.allowAnon !== false ? 1 : 0, 'pending', isTest(c) ? 1 : 0, type, inst, b.monthly && s.allowMonthly !== false ? 1 : 0, token);
  const donation = db.prepare('SELECT * FROM donations WHERE id=?').get(r.lastInsertRowid);
  try {
    const out = await P.start({ base: base(req), donation, campaign: c, cfg: prov });
    if (out.ref) db.prepare('UPDATE donations SET ref=? WHERE id=?').run(String(out.ref), donation.id);
    res.json({ ...out, donationId: donation.id, token, returnUrl: `${base(req)}/pay/return/${token}` });
  } catch (e) { db.prepare("UPDATE donations SET status='failed', meta=? WHERE id=?").run(JSON.stringify({ error: e.message }), donation.id); bad(res, 'שגיאה בחיבור לספק הסליקה: ' + e.message, 502); }
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
app.all('/pay/nedarim/callback', (req, res) => {
  const b = { ...req.query, ...req.body }; const r = providers.nedarim.callback(b);
  const d = r.donationId ? db.prepare('SELECT * FROM donations WHERE id=?').get(r.donationId) : (r.token ? db.prepare('SELECT * FROM donations WHERE token=?').get(r.token) : null);
  if (!d) return res.status(404).send('no donation');
  if (r.paid) markPaid(d.id, { ref: r.ref, meta: r.meta, amount: b.Amount ? Math.round(+b.Amount) : undefined }); else db.prepare("UPDATE donations SET status='failed', meta=? WHERE id=?").run(JSON.stringify(r.meta).slice(0, 4000), d.id);
  res.send('OK');
});
app.all('/pay/meshulam/webhook', (req, res) => {
  const b = { ...req.query, ...req.body }; const r = providers.meshulam.callback(b);
  const d = r.donationId ? db.prepare('SELECT * FROM donations WHERE id=?').get(r.donationId) : (r.token ? db.prepare('SELECT * FROM donations WHERE token=?').get(r.token) : null);
  if (!d) return res.status(404).send('no donation');
  if (r.paid) markPaid(d.id, { ref: r.ref, meta: r.meta }); else db.prepare("UPDATE donations SET status='failed', meta=? WHERE id=?").run(JSON.stringify(r.meta).slice(0, 4000), d.id);
  res.send('OK');
});
app.post('/pay/paypal/capture', async (req, res) => {
  const { token, orderId } = req.body || {}; const d = db.prepare('SELECT * FROM donations WHERE token=?').get(token); if (!d) return bad(res, 'not found', 404);
  const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(d.campaign_id);
  try { const r = await providers.paypal.capture({ cfg: J(c.provider), orderId }); if (!r.paid) return bad(res, 'התשלום לא הושלם'); markPaid(d.id, { ref: r.ref, meta: { orderId, captured: r.ref }, amount: r.amount ? Math.round(r.amount) : undefined }); res.json({ ok: true }); } catch (e) { bad(res, e.message, 502); }
});
app.post('/pay/iframe-done/:token', (req, res) => { // Nedarim Plus iframe reports success via postMessage; server trusts callback, this only acknowledges
  const d = db.prepare('SELECT status FROM donations WHERE token=?').get(req.params.token); res.json({ status: d?.status || 'unknown' });
});

// ---------- AI guide ----------
function ctxFor(uid, cid) {
  const c = cid ? db.prepare('SELECT * FROM campaigns WHERE id=? AND user_id=?').get(cid, uid) : null; if (!c) return '';
  const st = stats(c, isTest(c)); const last = db.prepare("SELECT name,amount,created FROM donations WHERE campaign_id=? AND status='paid' ORDER BY id DESC LIMIT 5").all(c.id);
  const lastHour = db.prepare("SELECT COUNT(*) n FROM donations WHERE campaign_id=? AND status='paid' AND paid_at>=datetime('now','-1 hour')").get(c.id).n;
  return `\nקמפיין נוכחי: "${c.title}" (${c.status}), יעד ${c.goal} ${c.currency}, מכפיל ${c.multiplier}, מסתיים ${c.end_at}. גויסו ${st.total} (${st.pct}%) מ-${st.count} תורמים. תרומות בשעה האחרונה: ${lastHour}. ספק סליקה: ${J(c.provider).type}. שגרירים: ${db.prepare('SELECT COUNT(*) n FROM teams WHERE campaign_id=?').get(c.id).n}. רמות: ${db.prepare('SELECT name,amount FROM levels WHERE campaign_id=?').all(c.id).map(l => l.name + ' ' + l.amount).join(', ')}. סיפור: ${(c.story || '').slice(0, 600)}. תרומות אחרונות: ${last.map(d => d.name + ' ' + d.amount).join(', ')}`;
}
const SYS = `אתה "המדריך" של Tatzil (תציל), פלטפורמת גיוס תרומות ישראלית לעמותות. אתה עוזר למנהלי קמפיינים: כתיבת סיפור קמפיין, כותרות, רמות תרומה, הודעות וואטסאפ לשגרירים ולתורמים, טיפים לקמפיין מאצ'ינג, הסבר על המערכת (אשף קמפיין, מצב בדיקה, חיבור סליקה: נדרים פלוס, משולם/Grow, PayPal, דף תשלום חיצוני; שגרירים עם קישור אישי; מסך אירוע חי; ייצוא CSV; רב-לשוניות). ענה בשפה של המשתמש, קצר, מעשי, עם דוגמאות מוכנות להעתקה. כשמבקשים טקסט, תן את הטקסט עצמו. אל תמציא נתונים שאינם בהקשר.`;
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
app.get(['/c/:slug', '/c/:slug/:team'], (req, res) => {
  const c = getC(req.params.slug); if (!c) return res.status(404).sendFile(pub('404.html'));
  let html = fs.readFileSync(pub('c.html'), 'utf8');
  const esc = s => String(s || '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const img = c.cover ? (c.cover.startsWith('http') ? c.cover : base(req) + c.cover) : '';
  html = html.replace('<!--META-->', `<title>${esc(c.title)}</title><meta name="description" content="${esc(c.subtitle)}"><meta property="og:title" content="${esc(c.title)}"><meta property="og:description" content="${esc(c.subtitle)}"><meta property="og:image" content="${esc(img)}"><meta property="og:type" content="website"><meta name="theme-color" content="${esc(c.color)}">`).replace('<html lang="he" dir="rtl">', `<html lang="${c.lang}" dir="${c.lang === 'en' ? 'ltr' : 'rtl'}">`);
  res.setHeader('Cache-Control', 'no-cache'); res.send(html);
});
app.get(['/app', '/app/*'], (_, res) => res.sendFile(pub('app.html')));
app.get('/', (_, res) => res.sendFile(pub('index.html')));
app.get('/robots.txt', (_, res) => res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /pay/\nDisallow: /api/\n'));
app.use((_, res) => res.status(404).sendFile(pub('404.html')));
app.listen(process.env.PORT || 3000, () => console.log('tatzil up'));
