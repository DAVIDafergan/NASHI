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
// ---- one public address: everything on giveil.com, never the raw railway.app host ----
const CANON = (() => { const b = (process.env.PUBLIC_URL || process.env.BASE_URL || '').replace(/\/$/, ''); return !b || /\.up\.railway\.app/i.test(b) ? 'https://giveil.com' : b; })();
const isRailHost = h => /\.up\.railway\.app$/i.test(String(h || '').split(':')[0]);
app.use((req, res, next) => { if (isRailHost(req.get('host')) && (req.method === 'GET' || req.method === 'HEAD') && process.env.RAILWAY_ENVIRONMENT) return res.redirect(301, CANON + req.originalUrl); next(); });
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.RAILWAY_ENVIRONMENT) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (!/^\/c\/[^/]+\/(widget|screen)/.test(req.path) && !req.path.startsWith('/pay/')) res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});
const mail = require('./lib/mail');
const contract = require('./lib/contract');
const sumit = require('./lib/sumit');
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// cross-site write protection: a logged-in browser may only change things from our own pages
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || !req.path.startsWith('/api/') || !req.cookies.sid) return next();
  const o = req.get('origin'); if (!o) return next();
  try { const h = new URL(o).host; if (h === req.get('host') || h === req.get('x-forwarded-host') || (process.env.BASE_URL && h === new URL(process.env.BASE_URL).host) || h.replace(/^www\./, '') === String(req.get('host')).replace(/^www\./, '')) return next(); } catch { }
  logEvent('security.origin', { level: 'warn', ip: req.ip, msg: req.method + ' ' + req.path + ' ← ' + String(o).slice(0, 80) }); return bad(res, 'origin', 403);
});

// ---------- helpers ----------
const SECRET = process.env.SECRET || (() => { const f = path.join(DATA_DIR, 'secret.txt'); try { return fs.readFileSync(f, 'utf8'); } catch { const s = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(f, s); return s; } })();
const hmac = v => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
const sign = o => { const p = Buffer.from(JSON.stringify(o)).toString('base64url'); return p + '.' + hmac(p); };
const verify = t => { if (!t || typeof t !== 'string') return null; const [p, s] = t.split('.'); if (!p || !s) return null; const h = hmac(p); if (h.length !== s.length || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(s))) return null; try { const o = JSON.parse(Buffer.from(p, 'base64url')); return o.exp > Date.now() ? o : null; } catch { return null; } };
const hashPw = pw => { const salt = crypto.randomBytes(16).toString('hex'); return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex'); };
const checkPw = (pw, h) => { const [salt, k] = (h || '').split(':'); if (!salt || !k || k.length !== 64) return false; try { return crypto.timingSafeEqual(Buffer.from(k, 'hex'), crypto.scryptSync(pw, salt, 32)); } catch { return false; } };
const J = s => { try { return JSON.parse(s || '{}'); } catch { return {}; } };
// ---------- processor secrets: AES-256-GCM at rest, only last 4 chars ever leave the server ----------
const DATA_KEYS = (() => { const ks = []; if (process.env.DATA_KEY) ks.push(crypto.createHash('sha256').update(process.env.DATA_KEY).digest()); const f = path.join(DATA_DIR, 'data.key'); let fk; try { fk = Buffer.from(fs.readFileSync(f, 'utf8').trim(), 'hex'); } catch { } if (!fk || fk.length !== 32) { fk = crypto.randomBytes(32); try { fs.writeFileSync(f, fk.toString('hex'), { mode: 0o600 }); } catch { } } ks.push(fk); return ks; })();
const ENC = 'enc1:';
const encS = v => { const iv = crypto.randomBytes(12), ci = crypto.createCipheriv('aes-256-gcm', DATA_KEYS[0], iv); const e = Buffer.concat([ci.update(String(v), 'utf8'), ci.final()]); return ENC + Buffer.concat([iv, ci.getAuthTag(), e]).toString('base64'); };
const decS = v => { if (typeof v !== 'string' || !v.startsWith(ENC)) return v; const b = Buffer.from(v.slice(ENC.length), 'base64'); for (const k of DATA_KEYS) { try { const d = crypto.createDecipheriv('aes-256-gcm', k, b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'); } catch { } } return ''; };
const SECRET_KEYS = new Set(['apiPassword', 'apiKey', 'secretKey', 'secret', 'password', 'key', 'passp', 'token', 'sellerId', 'apiSecret', 'pw', ...Object.values(providers).flatMap(p => p.fields || []).filter(f => f.secret).map(f => f.k)]);
const MASK = '••••';
const isMasked = v => typeof v === 'string' && v.startsWith(MASK);
// read: decrypted provider config (used everywhere the server talks to a processor)
const PV_ = s => { const o = J(s); for (const k of Object.keys(o)) if (SECRET_KEYS.has(k)) o[k] = decS(o[k]); return o; };
// write: encrypt secret fields
const provEnc = o => { const r = { ...(o || {}) }; for (const k of Object.keys(r)) if (SECRET_KEYS.has(k) && r[k] && !String(r[k]).startsWith(ENC)) r[k] = encS(r[k]); return JSON.stringify(r); };
// out: mask secrets for the browser
const provMask = o => { const r = { ...(o || {}) }; for (const k of Object.keys(r)) if (SECRET_KEYS.has(k) && r[k]) { const s = String(r[k]); r[k] = MASK + (s.length > 6 ? s.slice(-4) : ''); } return r; };
try { const up = db.prepare('UPDATE campaigns SET provider=? WHERE id=?'); let n = 0; for (const r of db.prepare("SELECT id, provider FROM campaigns WHERE provider IS NOT NULL AND provider!='' AND provider!='{}'").all()) { const o = J(r.provider); if (Object.keys(o).some(k => SECRET_KEYS.has(k) && o[k] && !String(o[k]).startsWith(ENC))) { up.run(provEnc(o), r.id); n++; } } if (n) console.log('encrypted processor secrets in', n, 'campaigns'); } catch (e) { console.error('secret migration', e.message); }
const slugify = s => { const t = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); return t.length >= 2 ? t : 'p-' + crypto.randomBytes(2).toString('hex'); };
const base = req => (process.env.RAILWAY_ENVIRONMENT || process.env.BASE_URL || process.env.PUBLIC_URL) ? CANON : `${req.protocol}://${req.get('host')}`;
const bad = (res, m, c = 400) => res.status(c).json({ error: m });

// ---------- activity log (everything that moves on the site) ----------
db.exec("CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT DEFAULT (datetime('now')), type TEXT, level TEXT DEFAULT 'info', user_id INTEGER, campaign_id INTEGER, ip TEXT DEFAULT '', msg TEXT DEFAULT '', meta TEXT DEFAULT '{}')");
db.exec("CREATE TABLE IF NOT EXISTS visitors(vid TEXT PRIMARY KEY, first_at TEXT DEFAULT (datetime('now')), last_at TEXT DEFAULT (datetime('now')), src TEXT DEFAULT '', landing TEXT DEFAULT '', ref TEXT DEFAULT '', device TEXT DEFAULT '', ua TEXT DEFAULT '', ip TEXT DEFAULT '', uid INTEGER, stage INTEGER DEFAULT 1, pages INTEGER DEFAULT 0, acts INTEGER DEFAULT 0)");
db.exec("CREATE INDEX IF NOT EXISTS vis_last ON visitors(last_at)"); db.exec("CREATE INDEX IF NOT EXISTS vis_uid ON visitors(uid)");
db.exec("CREATE TABLE IF NOT EXISTS vev(id INTEGER PRIMARY KEY AUTOINCREMENT, vid TEXT, at TEXT DEFAULT (datetime('now')), type TEXT, label TEXT DEFAULT '', path TEXT DEFAULT '')");
db.exec("CREATE INDEX IF NOT EXISTS vev_vid ON vev(vid, id)");
db.exec("CREATE INDEX IF NOT EXISTS ev_type ON events(type, id)"); db.exec("CREATE INDEX IF NOT EXISTS ev_at ON events(at)");
for (const col of ["blocked INTEGER DEFAULT 0", "block_note TEXT DEFAULT ''", "tv INTEGER DEFAULT 0", "last_seen TEXT DEFAULT ''", "last_ip TEXT DEFAULT ''", "logins INTEGER DEFAULT 0"]) { try { db.exec('ALTER TABLE users ADD COLUMN ' + col); } catch { } }
try { db.exec('ALTER TABLE donations ADD COLUMN resumed_from INTEGER'); } catch { }
try { db.exec('CREATE INDEX IF NOT EXISTS d_team ON donations(team_id, status, test)'); db.exec('CREATE INDEX IF NOT EXISTS d_camp ON donations(campaign_id, status, test)'); db.exec('CREATE INDEX IF NOT EXISTS t_camp ON teams(campaign_id)'); } catch { }
const EVT = db.prepare('INSERT INTO events(type,level,user_id,campaign_id,ip,msg,meta) VALUES(?,?,?,?,?,?,?)');
function logEvent(type, o = {}) { try { EVT.run(type, o.level || 'info', o.uid || null, o.cid || null, String(o.ip || '').slice(0, 64), String(o.msg || '').slice(0, 300), JSON.stringify(o.meta || {}).slice(0, 2000)); } catch { } if (NOTIFY_T[type]) setImmediate(() => adminNotify(type, o).catch(e => console.error('notify', e.message))); }
// ---- email to the platform owner on important events (super-admin → הגדרות → "עדכונים למייל") ----
const NOTIFY_T = { 'user.signup': '🆕 נרשמה עמותה חדשה', 'campaign.create': '📣 נפתח קמפיין חדש', 'campaign.status': '🔄 שינוי סטטוס קמפיין', 'contract.sign': '✍️ נחתם הסכם', 'billing.claim': '💰 עמותה דיווחה על תשלום', 'billing.paid': '💳 התקבל תשלום בכרטיס', 'billing.renew': '🔁 חידוש מנוי' };
const NOTIFY_DEF = { 'user.signup': true, 'campaign.create': true, 'campaign.status': true, 'contract.sign': true, 'billing.claim': true, 'billing.paid': true, 'billing.renew': false };
async function adminNotify(type, o) {
  if (!mail.enabled()) return; const cfg = getKV('notify'); const on = { ...NOTIFY_DEF, ...(cfg.types || {}) };
  if (cfg.off || !on[type]) return; if (type === 'campaign.status' && !/→ (live|ended)/.test(o.msg || '')) return; // only going live / ending
  const to = String(cfg.email || '').split(/[,\s;]+/).filter(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  const list = to.length ? to : db.prepare("SELECT email FROM users WHERE role='admin' AND blocked=0").all().map(r => r.email);
  if (!list.length) return null;
  const u = o.uid ? db.prepare('SELECT id,name,email,phone,org_name,org,org_number FROM users WHERE id=?').get(o.uid) : null;
  const c = o.cid ? db.prepare('SELECT id,title,slug,goal,status FROM campaigns WHERE id=?').get(o.cid) : null;
  const site = CANON; const e = mail.esc;
  const msg = String(o.msg || '').replace(/: test → live/, ': עלה לאוויר 🟢').replace(/: live → ended/, ': הסתיים').replace(/: (\w+) → (\w+)/, ': $1 ← $2');
  const rows = [['מה קרה', msg], u && ['עמותה', u.org_name || u.org || '—'], u?.org_number && ['מספר עמותה', u.org_number], u && ['איש קשר', `${u.name || ''} · ${u.email}${u.phone ? ' · ' + u.phone : ''}`], c && ['קמפיין', `${c.title} · יעד ₪${(+c.goal || 0).toLocaleString('he-IL')}`]].filter(Boolean);
  const body = `<table style="width:100%;border-collapse:collapse;font-size:15px">${rows.map(([k, v]) => `<tr><td style="padding:8px 0;color:#64748b;width:110px;vertical-align:top">${e(k)}</td><td style="padding:8px 0"><b>${e(v)}</b></td></tr>`).join('')}</table>
  <p style="margin-top:18px">${c ? `<a href="${site}/c/${encodeURIComponent(c.slug)}" style="margin-left:14px">לדף הקמפיין</a> <a href="${site}/app#/admin/camp/${c.id}" style="margin-left:14px">בדיקת תקינות</a>` : ''}${u ? `<a href="${site}/app#/admin/users">למשתמשים בניהול</a>` : ''}</p>`;
  const org = u ? (u.org_name || u.org || u.email) : ''; const subject = `${NOTIFY_T[type]} – ${c ? c.title + (org ? ' · ' + org : '') : org}`;
  return mail.send({ to: list, subject, html: mail.layout(NOTIFY_T[type], body, 'קיבלת את ההודעה כי את/ה מנהל/ת GiveIL. אפשר לשנות בניהול-על ← הגדרות ← עדכונים למייל.') });
}
const ev = (req, type, o = {}) => { if (!req.user?.imp) { vLink(req, req.user?.id); const vt = type === 'campaign.status' && /→ live/.test(o.msg || '') ? 'campaign.live' : type === 'campaign.create' ? type : null; if (vt) vEvent(req.cookies?.gv, vt, o.msg || ''); } return logEvent(type, { uid: req.user?.imp ? req.user.imp : req.user?.id, ip: req.ip, ...o, meta: { ...(o.meta || {}), ...(req.user?.imp ? { as: req.user.id } : {}) } }); };
setInterval(() => { try { db.prepare("DELETE FROM events WHERE at < datetime('now','-120 day')").run(); db.prepare("DELETE FROM vev WHERE at < datetime('now','-60 day')").run(); db.prepare("DELETE FROM visitors WHERE last_at < datetime('now','-60 day') AND uid IS NULL").run(); } catch { } }, 6 * 3600e3).unref();
const setSid = (res, uid, extra = {}) => { const tv = (db.prepare('SELECT tv FROM users WHERE id=?').get(uid) || {}).tv || 0; res.cookie('sid', sign({ uid, tv, exp: Date.now() + 90 * 864e5, ...extra }), { httpOnly: true, sameSite: 'lax', maxAge: 90 * 864e5, secure: !!process.env.RAILWAY_ENVIRONMENT }); };
const seen = new Map();
const user = req => {
  const s = verify(req.cookies.sid); if (!s) return null;
  const u = db.prepare('SELECT id,email,name,phone,org,role,org_verified,blocked,tv,parent_id,perms FROM users WHERE id=?').get(s.uid);
  if (!u || u.blocked || (u.tv || 0) !== (s.tv || 0)) return null; // blocked users and sessions from before a password change are out
  if (u.parent_id) { // team member: acts inside the owner's account, limited by perms
    const o = db.prepare('SELECT id,blocked,org_verified,org,role FROM users WHERE id=?').get(u.parent_id); if (!o || o.blocked) return null;
    u.oid = o.id; u.org_verified = o.org_verified; u.org = o.org; u.role = 'user'; u.sub = subPerms(u.perms);
  } else u.oid = u.id;
  delete u.parent_id; delete u.perms;
  const now = Date.now(); if (!(seen.get(u.id) > now - 60000)) { seen.set(u.id, now); try { db.prepare("UPDATE users SET last_seen=datetime('now'), last_ip=? WHERE id=?").run(String(req.ip || '').slice(0, 64), u.id); } catch { } }
  delete u.blocked; delete u.tv; if (s.imp) u.imp = s.imp; return u;
};
// ---- team members: which permission each authenticated API needs ('' = any member, missing = owner only) ----
const PERM_KEYS = ['edit', 'donations', 'teams', 'messages'];
const subPerms = s => { const o = J(s); return { camps: Array.isArray(o.camps) ? o.camps.map(Number).filter(Boolean) : 'all', ...Object.fromEntries(PERM_KEYS.map(k => [k, !!o[k]])) }; };
const SUB_RULES = [
  ['GET', /^\/api\/campaigns$/, ''], ['GET', /^\/api\/home$/, ''], ['GET', /^\/api\/campaigns\/\d+$/, ''], ['PUT', /^\/api\/campaigns\/\d+$/, 'edit'],
  ['GET', /^\/api\/campaigns\/\d+\/(channels|updates)$/, ''],
  ['POST|DELETE', /^\/api\/campaigns\/\d+\/updates(\/\d+)?$/, 'messages'],
  ['GET', /^\/api\/campaigns\/\d+\/donations$/, ''],
  ['GET|POST|PATCH|DELETE', /^\/api\/campaigns\/\d+\/(donations(\.xlsx|\.csv|\/import|\/bulk|\/\d+)?|unfinished|clear-test|reconcile)$/, 'donations'],
  ['GET|POST|PUT|DELETE', /^\/api\/campaigns\/\d+\/teams(\.xlsx|\/\d+)?$/, 'teams'],
  ['GET|POST', /^\/api\/campaigns\/\d+\/(recipients|messages|messages\/log|mail-preview|mail-test)$/, 'messages'], ['GET', /^\/api\/msg-channels$/, 'messages'],
  ['GET|POST|PUT|DELETE', /^\/api\/campaigns\/\d+\/events(\/\d+(\/(pledges(\.xlsx|\/\d+(\/show)?)?|screen|duplicate))?)?$/, 'donations'],
  ['POST', /^\/api\/assist$/, ''], ['POST', /^\/api\/me\/password$/, ''], ['POST', /^\/api\/me\/logout-all$/, ''], ['PUT', /^\/api\/me$/, ''], ['POST', /^\/api\/upload$/, '']
];
const subAllowed = (u, method, p) => { const r = SUB_RULES.find(([m, re]) => m.split('|').includes(method) && re.test(p)); if (!r) return false; return !r[2] || r[2].split('|').some(k => u.sub[k]); };
const auth = (req, res, next) => { req.user = user(req); if (!req.user) return bad(res, 'auth', 401); if (req.user.sub && !subAllowed(req.user, req.method, req.path)) return bad(res, 'אין לך הרשאה לפעולה הזו. פנו למנהל החשבון בעמותה.', 403); next(); };
const subOut = (req, o) => { if (!req.user.sub || !o) return o; o.provider = { type: o.provider?.type || 'test' }; if (!req.user.sub.teams && Array.isArray(o.teams)) o.teams = o.teams.map(t => ({ ...t, phone: '', email: '', key: '' })); return o; };
const own = (req, res, next) => {
  const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(req.params.id);
  if (!c || (c.user_id !== req.user.oid && req.user.role !== 'admin')) return bad(res, 'not found', 404);
  if (req.user.sub && req.user.sub.camps !== 'all' && !req.user.sub.camps.includes(c.id)) return bad(res, 'not found', 404);
  req.c = c; next();
};

// SSE hub per campaign
const subs = new Map(); const sseIp = new Map();
let evHook = null; // set by lib/events.js: live donations also go to connected event screens
const emit = (cid, ev, data) => { if (ev === 'donation' && data && data.donation && evHook) evHook(cid, data); const set = subs.get(cid); if (!set || !set.size) return; const msg = `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`; for (const r of set) { try { r.write(msg); } catch { } } };
// the full ambassadors leaderboard is heavy: during a donation rush send it at most once every 2s per campaign
const teamTimers = new Map();
const emitTeams = (c, test) => { if (!subs.get(c.id)?.size || teamTimers.has(c.id)) return; teamTimers.set(c.id, setTimeout(() => { teamTimers.delete(c.id); try { const cc = db.prepare('SELECT * FROM campaigns WHERE id=?').get(c.id); if (cc) emit(c.id, 'refresh', { stats: stats(cc, test), teams: teamStats(cc, test) }); } catch { } }, 2000)); };

function stats(c, test) {
  const t = test ? 1 : 0;
  const r = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(amount),0) s FROM donations WHERE campaign_id=? AND status='paid' AND test=?").get(c.id, t);
  const mult = 1; // multipliers removed from the product
  return { count: r.n, raised: r.s, total: Math.round(r.s * mult), goal: c.goal, bonus_goal: c.bonus_goal, multiplier: mult, pct: c.goal ? Math.min(999, Math.round(r.s * mult / c.goal * 1000) / 10) : 0 };
}
function publicDonation(d) { return { id: d.id, name: d.anonymous ? '' : d.name, amount: d.amount, currency: d.currency, dedication: d.dedication, team_id: d.team_id, anonymous: !!d.anonymous, created: d.paid_at || d.created, monthly: !!d.monthly, months: d.monthly && d.installments > 1 ? d.installments : undefined }; }
function markPaid(id, { ref = '', meta = {}, amount } = {}) {
  const d = db.prepare('SELECT * FROM donations WHERE id=?').get(id); if (!d) return null;
  if (d.status === 'paid') return d;
  const verified = meta.verified === undefined ? 1 : (meta.verified ? 1 : 0);
  db.prepare("UPDATE donations SET status='paid', ref=?, meta=?, amount=COALESCE(?,amount), verified=?, paid_at=datetime('now') WHERE id=?").run(String(ref), JSON.stringify(meta).slice(0, 4000), amount || null, verified, id);
  const nd = db.prepare('SELECT * FROM donations WHERE id=?').get(id);
  const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(d.campaign_id);
  emit(c.id, 'donation', { donation: publicDonation(nd), stats: stats(c, nd.test) }); emitTeams(c, nd.test);
  logEvent(nd.test ? 'donation.test' : 'donation.paid', { cid: c.id, msg: `${nd.anonymous ? 'אנונימי' : nd.name} · ₪${nd.amount}${nd.monthly ? ' (הו״ק)' : ''} · ${c.title}`, meta: { did: nd.id, provider: nd.provider } });
  if (nd.resumed_from) { db.prepare("UPDATE donations SET status='recovered' WHERE id=? AND status IN ('pending','failed')").run(nd.resumed_from); logEvent('donation.recovered', { cid: c.id, msg: `${nd.name} · ₪${nd.amount} · ${c.title}`, meta: { did: nd.id, from: nd.resumed_from } }); }
  thankMail(c, nd).catch(() => { });
  ambassadorFlow(c, nd).catch(e => logEvent('wa.error', { level: 'warn', cid: c.id, msg: String(e?.message || e).slice(0, 200) }));
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
// a campaign is over when it was marked ended, or when a live campaign's end time (Israel time) has passed
const isEnded = c => { if (c.status === 'ended') return true; if (c.status !== 'live' || !c.end_at) return false; const u = ilToUtc(c.end_at); return !!u && Date.parse(u.replace(' ', 'T') + 'Z') <= Date.now(); };
// payment methods offered on the public page: main provider ("card") + optional app links (bit / paybox)
function payMethods(c) {
  const p = PV_(c.provider); const mainType = isTest(c) ? 'test' : (p.type || 'test'); const out = [{ k: 'card' }];
  const can = providers[mainType]?.wallets || []; const on = p.wallets || {};
  for (const k of can) if (on[k]) out.push({ k });
  return out;
}

try { db.prepare('UPDATE campaigns SET multiplier=1 WHERE multiplier!=1').run(); } catch { }
const hits = new Map();
const limit = (n, win) => (req, res, next) => { const k = req.ip + req.path; const now = Date.now(); const a = (hits.get(k)?.a || []).filter(t => now - t < win); a.push(now); hits.set(k, { a, win }); if (a.length > n) { if (a.length === n + 1) logEvent('security.ratelimit', { level: 'warn', ip: req.ip, msg: req.method + ' ' + req.path }); return bad(res, 'יותר מדי ניסיונות, נסו שוב בעוד דקה', 429); } next(); };
setInterval(() => { const now = Date.now(); for (const [k, h] of hits) if (!h.a.some(t => now - t < h.win)) hits.delete(k); }, 60000).unref();
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
  const uid = r.lastInsertRowid; vLink(req, uid); vEvent(req.cookies?.gv, 'reg.done', email, '', false, uid); const src = String(req.cookies?.src || '').split(':')[0]; if (src === 'ads') pageView(req, 'ads:signup'); logEvent('user.signup', { uid, ip: req.ip, msg: `${email.toLowerCase()} · ${S(org, 80) || ''}${src === 'ads' ? ' · מגוגל' : ''}`, meta: { org_number: S(b.org_number, 12), src } });
  if (mail.enabled()) { sendCode(uid).catch(() => { }); res.json({ ok: true, verify: true, email: email.toLowerCase() }); }
  else { setSid(res, uid); res.json({ ok: true }); }
  // verify the NGO number in the background so the account is ready when they land in the dashboard
  if (b.org_number) lookupOrg(b.org_number).then(o => {
    if (!o) return db.prepare("UPDATE users SET org_verified=2, org_status='לא נמצא ברשם העמותות' WHERE id=?").run(uid);
    const active = /פעיל|רשומ/.test(o.status) && !/מחוק|פירוק|בוטל/.test(o.status);
    db.prepare('UPDATE users SET org_name=?, org_verified=?, org_status=?, org_data=?, org=COALESCE(NULLIF(org,\'\'),?) WHERE id=?').run(o.name, active ? 1 : 2, o.status, JSON.stringify(o).slice(0, 6000), o.name, uid);
  }).catch(() => db.prepare("UPDATE users SET org_verified=2, org_status='ממתין לאימות ידני' WHERE id=? AND org_verified!=1").run(uid));
});
// ---- email verification by 6-digit code (signup, and login of an account that was never verified) ----
const codeHash = (uid, code) => crypto.createHmac('sha256', SECRET).update(uid + ':' + code).digest('hex');
async function sendCode(uid) {
  const u = db.prepare('SELECT id,email,name,email_verified FROM users WHERE id=?').get(uid); if (!u || u.email_verified) return false;
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
  db.prepare('UPDATE users SET vcode=?, vcode_exp=?, vcode_tries=0 WHERE id=?').run(codeHash(uid, code), Date.now() + 15 * 60e3, uid);
  const r = await mail.send({ to: u.email, subject: `קוד האימות שלך ב-GiveIL: ${code}`, html: mail.layout('אימות כתובת המייל', `<p>שלום ${mail.esc(u.name || '')},</p><p>זה קוד האימות שלך:</p><p style="font-size:34px;font-weight:800;letter-spacing:8px;direction:ltr;text-align:center;background:#f5f4f1;border-radius:14px;padding:14px 0;margin:10px 0">${code}</p><p style="color:#6b6762;font-size:13px">הקוד בתוקף ל-15 דקות. אם לא ביקשתם – התעלמו מהמייל.</p>`) });
  return r.ok;
}
const needsCode = u => mail.enabled() && u && !u.email_verified && !u.parent_id && u.role !== 'admin';
app.post('/api/verify-code', limit(10, 600000), (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim(); const code = String(req.body?.code || '').replace(/\D/g, '');
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email); if (!u) return bad(res, 'הקוד שגוי');
  if (u.email_verified) { setSid(res, u.id); return res.json({ ok: true }); }
  if (!u.vcode || u.vcode_exp < Date.now()) return bad(res, 'תוקף הקוד פג. שלחו קוד חדש.');
  if (u.vcode_tries >= 6) return bad(res, 'יותר מדי ניסיונות. שלחו קוד חדש.');
  const ok = code.length === 6 && crypto.timingSafeEqual(Buffer.from(codeHash(u.id, code)), Buffer.from(u.vcode));
  if (!ok) { db.prepare('UPDATE users SET vcode_tries=vcode_tries+1 WHERE id=?').run(u.id); return bad(res, 'הקוד שגוי, נסו שוב'); }
  db.prepare("UPDATE users SET email_verified=1, vcode='', vcode_exp=0, verify_token='' WHERE id=?").run(u.id);
  logEvent('user.verified', { uid: u.id, ip: req.ip, msg: u.email }); vEvent(req.cookies?.gv, 'reg.verified', u.email, '', false, u.id);
  setSid(res, u.id); res.json({ ok: true });
});
app.post('/api/verify-code/resend', limit(4, 600000), async (req, res) => { const u = db.prepare('SELECT id,email_verified FROM users WHERE email=?').get(String(req.body?.email || '').toLowerCase().trim()); if (u && !u.email_verified) await sendCode(u.id).catch(() => { }); res.json({ ok: true }); });
async function sendVerify(uid) {
  const u = db.prepare('SELECT id,email,name,email_verified FROM users WHERE id=?').get(uid); if (!u || u.email_verified || !mail.enabled()) return false;
  const token = crypto.randomBytes(20).toString('hex'); db.prepare('UPDATE users SET verify_token=? WHERE id=?').run(token, uid);
  const url = `${process.env.BASE_URL || ''}/verify-email?t=${token}`;
  const r = await mail.send({ to: u.email, subject: 'אימות האימייל שלך ב-GiveIL', html: mail.layout('ברוכים הבאים ל-GiveIL', `<p>שלום ${mail.esc(u.name || '')}, לחצו כדי לאמת את כתובת האימייל ולהפעיל את החשבון:</p><p><a href="${url}" style="background:#1c1917;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;display:inline-block;font-weight:600">אימות האימייל</a></p><p style="color:#6b6762;font-size:13px">אם לא נרשמתם – התעלמו מהמייל.</p>`) });
  return r.ok;
}
app.get('/verify-email', (req, res) => { const t = String(req.query.t || ''); const u = t && db.prepare('SELECT id FROM users WHERE verify_token=?').get(t); if (!u) return res.redirect('/app#/?verified=0'); db.prepare("UPDATE users SET email_verified=1, verify_token='' WHERE id=?").run(u.id); setSid(res, u.id); res.redirect('/app#/?verified=1'); });
app.post('/api/me/resend-verify', auth, limit(3, 600000), async (req, res) => { res.json({ ok: await sendVerify(req.user.id), mail: mail.enabled() }); });
// ---- service agreement (signed before the first campaign) ----
const PRICING_DEF = { campaign: 790, monthly: 440, vat: 'incl', payCampaignUrl: '', payMonthlyUrl: '' };
const pricing = () => ({ ...PRICING_DEF, ...getKV('pricing') });
// per-organization price set by the superadmin (null = regular price; 0 = free)
const pricingFor = uid => { const p = pricing(); const u = uid ? db.prepare('SELECT price_campaign,price_monthly FROM users WHERE id=?').get(uid) : null; if (u?.price_campaign != null) p.campaign = u.price_campaign; if (u?.price_monthly != null) p.monthly = u.price_monthly; p.custom = u?.price_campaign != null || u?.price_monthly != null; return p; };
app.get('/api/pricing', (_, res) => { const p = pricing(); res.json({ campaign: p.campaign, monthly: p.monthly, vat: p.vat }); });
const privDir = path.join(DATA_DIR, 'private');
const privUpload = multer({ storage: multer.diskStorage({ destination: privDir, filename: (req, f, cb) => cb(null, req.user.id + '-' + Date.now() + '-' + crypto.randomBytes(6).toString('hex') + ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic', 'image/heif': '.heif', 'application/pdf': '.pdf' }[f.mimetype] || '.bin')) }), limits: { fileSize: 15e6 }, fileFilter: (_, f, cb) => cb(null, /image\/(jpeg|png|webp|heic|heif)|application\/pdf/.test(f.mimetype)) });
app.post('/api/doc', auth, privUpload.single('file'), (req, res) => req.file ? res.json({ name: req.file.filename }) : bad(res, 'קובץ לא נתמך – אפשר תמונה (JPG/PNG) או PDF עד 15MB'));
app.get('/api/doc/:name', auth, (req, res) => { const n = path.basename(req.params.name); if (req.user.role !== 'admin' && !n.startsWith(req.user.id + '-')) return res.status(404).end(); const f = path.join(privDir, n); if (!fs.existsSync(f)) return res.status(404).end(); res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; object-src 'self'; plugin-types application/pdf; sandbox allow-same-origin"); if (!/\.(jpe?g|png|webp|heic|heif|pdf)$/i.test(n)) res.setHeader('Content-Disposition', 'attachment'); res.sendFile(f); });
const ownDoc = (uid, n) => typeof n === 'string' && /^[\w.-]+$/.test(n) && n.startsWith(uid + '-') && fs.existsSync(path.join(privDir, n));
app.get('/api/contract/preview', auth, (req, res) => { const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id); const q = req.query; res.type('html').send(contract.render({ date: new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' }), org: u.org_name || u.org, orgNumber: u.org_number, name: String(q.name || u.name || '').slice(0, 80), idNumber: String(q.idNumber || '').replace(/\D/g, '').slice(0, 9) || '________', roleTitle: String(q.role || u.role_title || '').slice(0, 60), email: u.email, phone: u.phone, pricing: pricing(), printBar: q.print === '1' })); });
app.post('/api/contract', auth, limit(8, 600000), async (req, res) => {
  const b = req.body || {}; const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  const name = String(b.name || '').trim().slice(0, 80), idn = String(b.idNumber || '').replace(/\D/g, ''), role = String(b.role || u.role_title || '').trim().slice(0, 60); const method = b.method === 'manual' ? 'manual' : 'digital'; const sig = String(b.signature || '');
  { const ou = db.prepare('SELECT org_number FROM users WHERE id=?').get(req.user.id); if (String(ou?.org_number || '').replace(/\D/g, '').length < 8) return bad(res, 'לפני החתימה צריך להשלים את מספר העמותה / ח.פ. – ב"החשבון שלי" ← העמותה ואימות'); }
  if (name.length < 2) return bad(res, 'נא להזין שם מלא של החותם'); if (idn.length < 8 || idn.length > 9) return bad(res, 'מספר ת.ז. לא תקין'); if (role.length < 2) return bad(res, 'נא לציין את תפקיד החותם בעמותה');
  if (!b.agree) return bad(res, 'יש לאשר את ההסכם');
  const docs = { id: b.docs?.id, auth: b.docs?.auth };
  if (!ownDoc(u.id, docs.id)) return bad(res, 'נא לצרף צילום תעודת זהות של החותם');
  if (!ownDoc(u.id, docs.auth)) return bad(res, 'נא לצרף מסמך הסמכה (פרוטוקול מורשי חתימה / אישור עו"ד או רו"ח)');
  let file = '';
  if (method === 'digital') { if (!/^data:image\/png;base64,[A-Za-z0-9+/=]{200,}$/.test(sig) || sig.length > 200000) return bad(res, 'נא לחתום בתיבת החתימה'); }
  else { file = b.file; if (!ownDoc(u.id, file)) return bad(res, 'נא להעלות את ההסכם החתום (צילום/סריקה)'); }
  if (role !== u.role_title) db.prepare('UPDATE users SET role_title=? WHERE id=?').run(role, u.id);
  const p = { date: new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }), org: u.org_name || u.org, orgNumber: u.org_number, name, idNumber: idn, roleTitle: role, email: u.email, phone: u.phone, signature: method === 'digital' ? sig : '', manual: method === 'manual', ip: req.ip, ua: req.headers['user-agent'] || '', pricing: pricing() };
  const r = db.prepare("INSERT INTO contracts(user_id,version,name,id_number,role_title,org,org_number,email,phone,signature,ip,ua,html,method,file,docs,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')").run(u.id, contract.VERSION, name, idn, role, p.org, u.org_number, u.email, u.phone, p.signature, p.ip, p.ua, '', method, file, JSON.stringify(docs));
  p.id = r.lastInsertRowid; const html = contract.render(p); db.prepare('UPDATE contracts SET html=? WHERE id=?').run(html, p.id);
  ev(req, 'contract.sign', { msg: `${String(b.name || '').slice(0, 60)} · ${u.org_name || u.org || ''}` });
  res.json({ ok: true, id: p.id });
  if (mail.enabled()) {
    const admin = process.env.ADMIN_EMAIL || contract.OPERATOR.email; const B = process.env.BASE_URL || ''; const link = `${B}/contract/${p.id}`;
    const body = `<p>הסכם חדש ממתין לאישור שלך (${method === 'manual' ? 'חתימה ידנית' : 'חתימה דיגיטלית'}):</p><p><b>${mail.esc(p.org)}</b> (${mail.esc(u.org_number || '')})<br>חותם: ${mail.esc(name)}, ת.ז. ${mail.esc(idn)}, ${mail.esc(role)}<br>${mail.esc(u.email)} · ${mail.esc(u.phone || '')}<br>${mail.esc(p.date)}</p><p><a href="${link}">ההסכם</a> · <a href="${B}/api/doc/${docs.id}">ת.ז.</a> · <a href="${B}/api/doc/${docs.auth}">מסמך הסמכה</a>${file ? ` · <a href="${B}/api/doc/${file}">ההסכם החתום</a>` : ''}</p><p>לאישור: ניהול-על ← הסכמים. מומלץ לוודא מול רשם העמותות/גיידסטאר שהחותם מופיע כבעל תפקיד, ולהתקשר למספר הטלפון הרשום של העמותה.</p>`;
    const ok = await mail.send({ to: admin, subject: `הסכם לאישור – ${p.org}`, html: mail.layout('הסכם ממתין לאישור', body), replyTo: u.email }).then(x => x.ok).catch(() => false);
    db.prepare('UPDATE contracts SET sent=? WHERE id=?').run(ok ? 1 : 0, p.id);
    mail.send({ to: u.email, subject: 'קיבלנו את ההסכם – GiveIL', html: mail.layout('ההסכם התקבל', `<p>שלום ${mail.esc(name)}, ההסכם והמסמכים התקבלו ונבדקים (בדרך כלל עד יום עסקים). בינתיים אפשר לבנות את הקמפיין ולעבוד במצב בדיקה. <a href="${link}">לצפייה בהסכם</a>.</p>`) }).catch(() => { });
  }
});
app.post('/api/admin/contracts/:id/review', auth, (req, res, next) => req.user.role === 'admin' ? next() : bad(res, 'auth', 403), (req, res) => {
  const st = req.body?.status; if (!['approved', 'rejected', 'pending'].includes(st)) return bad(res, 'status');
  const c = db.prepare('SELECT * FROM contracts WHERE id=?').get(req.params.id); if (!c) return bad(res, 'not found', 404);
  const note = String(req.body?.note || '').slice(0, 500);
  db.prepare("UPDATE contracts SET status=?, review_note=?, reviewed_at=datetime('now') WHERE id=?").run(st, note, c.id); ev(req, 'admin.contract', { msg: `${c.org || ''} · ${st}`, meta: { target: c.user_id } });
  if (mail.enabled() && st !== 'pending') mail.send({ to: c.email, subject: st === 'approved' ? 'ההסכם אושר – אפשר לעלות לאוויר' : 'נדרש תיקון בהסכם – GiveIL', html: mail.layout(st === 'approved' ? 'ההסכם אושר ✓' : 'נדרש תיקון', st === 'approved' ? `<p>שלום ${mail.esc(c.name)}, האימות הושלם וההסכם של ${mail.esc(c.org)} אושר. אפשר להעלות קמפיינים לאוויר.</p>` : `<p>שלום ${mail.esc(c.name)}, לא הצלחנו לאשר את ההסכם${note ? ': ' + mail.esc(note) : ''}. נא להיכנס לחשבון ולשלוח שוב.</p>`) }).catch(() => { });
  res.json({ ok: true });
});
// ---- billing: campaign fee / annual plan (paid to the operator, separate from donations) ----
const planActive = u => !!(u.plan_until && u.plan_until >= new Date().toISOString().slice(0, 10));
app.get('/api/billing', auth, (req, res) => {
  const u = db.prepare('SELECT plan,plan_until FROM users WHERE id=?').get(req.user.id); const p = pricingFor(req.user.id); const cid = +req.query.campaignId || 0;
  const c = cid ? db.prepare('SELECT id,title,paid,user_id FROM campaigns WHERE id=?').get(cid) : null; if (c && c.user_id !== req.user.id && req.user.role !== 'admin') return bad(res, 'not found', 404);
  const ct = db.prepare('SELECT id,status,review_note,method FROM contracts WHERE user_id=? ORDER BY id DESC LIMIT 1').get(req.user.id);
  const fill = (url, amount) => String(url || '').replace(/\{(amount|campaign|org|email)\}/g, (_, k) => encodeURIComponent(k === 'amount' ? amount : k === 'campaign' ? (c?.title || '') : k === 'org' ? (req.user.org || '') : req.user.email));
  res.json({ card: billOn(), pricing: { campaign: p.campaign, monthly: p.monthly, vat: p.vat, custom: p.custom }, links: { campaign: fill(p.payCampaignUrl, p.campaign), monthly: fill(p.payMonthlyUrl, p.monthly) }, plan: u.plan, planUntil: u.plan_until, planActive: planActive(u), campaignPaid: !!c?.paid || p.campaign === 0, contract: ct || null, pending: db.prepare("SELECT id,kind,amount,campaign_id,created FROM payments WHERE user_id=? AND status='pending' AND ref!='SUMIT' ORDER BY id DESC").all(req.user.id) });
});
app.post('/api/billing/claim', auth, limit(10, 600000), async (req, res) => {
  const kind = req.body?.kind === 'monthly' ? 'monthly' : 'campaign'; const cid = +req.body?.campaignId || null; const p = pricingFor(req.user.id);
  if (kind === 'campaign') { const c = cid && db.prepare('SELECT user_id FROM campaigns WHERE id=?').get(cid); if (!c || c.user_id !== req.user.id) return bad(res, 'קמפיין לא נמצא'); }
  if (db.prepare("SELECT 1 FROM payments WHERE user_id=? AND kind=? AND IFNULL(campaign_id,0)=IFNULL(?,0) AND status='pending'").get(req.user.id, kind, cid)) return res.json({ ok: true, dup: true });
  const amount = kind === 'monthly' ? p.monthly : p.campaign; const ref = String(req.body?.ref || '').slice(0, 120);
  db.prepare('INSERT INTO payments(user_id,campaign_id,kind,amount,ref) VALUES(?,?,?,?,?)').run(req.user.id, cid, kind, amount, ref);
  ev(req, 'billing.claim', { cid, msg: `${req.user.org || req.user.email} · ${kind === 'monthly' ? 'מנוי' : 'קמפיין'} ₪${amount}` });
  res.json({ ok: true });
  if (mail.enabled()) mail.send({ to: process.env.ADMIN_EMAIL || contract.OPERATOR.email, subject: `תשלום לאישור – ${req.user.org || req.user.email}`, html: mail.layout('דיווח על תשלום', `<p>${mail.esc(req.user.org || '')} (${mail.esc(req.user.email)}) דיווח/ה על תשלום ${kind === 'monthly' ? 'מנוי שנתי – חודש' : 'קמפיין'}: ₪${amount}${ref ? ' · אסמכתא: ' + mail.esc(ref) : ''}.</p><p>בדקו שהכסף התקבל ואשרו בניהול-על ← תשלומים.</p>`) }).catch(() => { });
});
const admOnly = (req, res, next) => req.user.role === 'admin' ? next() : bad(res, 'auth', 403);
const addMonth = (from) => { const d = new Date(Math.max(Date.now(), from ? Date.parse(from) || 0 : 0)); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); };
app.get('/api/admin/payments', auth, admOnly, (_, res) => res.json(db.prepare("SELECT p.*, u.email, u.org_name, u.org, c.title FROM payments p LEFT JOIN users u ON u.id=p.user_id LEFT JOIN campaigns c ON c.id=p.campaign_id ORDER BY p.status='pending' DESC, p.id DESC LIMIT 200").all()));
app.post('/api/admin/payments/:id', auth, admOnly, (req, res) => {
  const pay = db.prepare('SELECT * FROM payments WHERE id=?').get(req.params.id); if (!pay) return bad(res, 'not found', 404);
  const st = req.body?.status === 'rejected' ? 'rejected' : 'approved';
  db.prepare("UPDATE payments SET status=?, note=?, approved_at=datetime('now') WHERE id=?").run(st, String(req.body?.note || '').slice(0, 300), pay.id); ev(req, 'admin.payment', { cid: pay.campaign_id, msg: `#${pay.id} ${st === 'approved' ? 'אושר' : 'נדחה'} · ₪${pay.amount}`, meta: { target: pay.user_id } });
  if (st === 'approved') { if (pay.kind === 'campaign' && pay.campaign_id) db.prepare('UPDATE campaigns SET paid=1 WHERE id=?').run(pay.campaign_id); else { const u = db.prepare('SELECT plan_until FROM users WHERE id=?').get(pay.user_id); db.prepare("UPDATE users SET plan='annual', plan_until=? WHERE id=?").run(addMonth(u.plan_until), pay.user_id); } }
  if (st === 'approved' && mail.enabled()) { const u = db.prepare('SELECT email,name FROM users WHERE id=?').get(pay.user_id); const B = process.env.BASE_URL || ''; if (u) mail.send({ to: u.email, subject: 'התשלום אושר – אפשר לעלות לאוויר 🚀', html: mail.layout('התשלום אושר ✓', `<p>שלום ${mail.esc(u.name || '')}, התשלום התקבל ואושר. אפשר להעלות את הקמפיין לאוויר: <a href="${B}/app${pay.campaign_id ? '#/c/' + pay.campaign_id + '/overview' : ''}">כניסה לחשבון</a>.</p>`) }).catch(() => { }); }
  res.json({ ok: true });
});
app.get('/api/admin/providers', auth, admOnly, (_, res) => { const rows = db.prepare("SELECT c.id,c.title,c.slug,c.status,c.provider,c.settings,u.email,u.org_name,u.org,u.org_number,u.phone FROM campaigns c LEFT JOIN users u ON u.id=c.user_id WHERE c.settings LIKE '%providerReview%' ORDER BY c.id DESC LIMIT 100").all(); res.json(rows.map(r => { const st = J(r.settings), cfg = PV_(r.provider); return { id: r.id, title: r.title, slug: r.slug, status: r.status, email: r.email, org: r.org_name || r.org, orgNumber: r.org_number, phone: r.phone, provider: provSummary(cfg), review: st.providerReview, approved: st.providerOk === provFp(cfg) }; })); });
app.post('/api/admin/campaigns/:id/provider', auth, admOnly, (req, res) => { const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(req.params.id); if (!c) return bad(res, 'not found', 404); const st = J(c.settings), cfg = PV_(c.provider); const ok = req.body?.status !== 'rejected'; st.providerOk = ok ? provFp(cfg) : ''; st.providerReview = { ...(st.providerReview || {}), fp: provFp(cfg), status: ok ? 'approved' : 'rejected', note: String(req.body?.note || '').slice(0, 300), by: new Date().toISOString() }; db.prepare('UPDATE campaigns SET settings=? WHERE id=?').run(JSON.stringify(st), c.id); const u = db.prepare('SELECT email,name FROM users WHERE id=?').get(c.user_id); if (mail.enabled() && u) mail.send({ to: u.email, subject: ok ? 'פרטי הסליקה אושרו – אפשר לעלות לאוויר' : 'פרטי הסליקה לא אושרו', html: mail.layout(ok ? 'הסליקה אושרה ✓' : 'נדרש תיקון בסליקה', ok ? `<p>שלום ${mail.esc(u.name || '')}, חשבון הסליקה של "${mail.esc(c.title)}" אומת. אפשר להעלות את הקמפיין לאוויר.</p>` : `<p>שלום ${mail.esc(u.name || '')}, לא הצלחנו לאמת שחשבון הסליקה שייך לעמותה${st.providerReview.note ? ': ' + mail.esc(st.providerReview.note) : ''}. נא לבדוק את הפרטים או לפנות אלינו.</p>`) }).catch(() => { }); ev(req, 'admin.provider', { cid: c.id, msg: `${c.title}: ${ok ? 'אושר' : 'נדחה'}` }); res.json({ ok: true }); });
app.post('/api/admin/users/:id/pricing', auth, admOnly, (req, res) => {
  const num = v => (v === '' || v === null || v === undefined) ? null : Math.max(0, Math.round(+v || 0));
  const pc = num(req.body?.campaign), pm = num(req.body?.monthly);
  db.prepare('UPDATE users SET price_campaign=?, price_monthly=? WHERE id=?').run(pc, pm, req.params.id);
  ev(req, 'admin.pricing', { msg: `#${req.params.id} · קמפיין ${pc ?? 'רגיל'} · מנוי ${pm ?? 'רגיל'}` }); res.json({ ok: true });
});
app.post('/api/admin/campaigns/:id/free', auth, admOnly, (req, res) => {
  const c = db.prepare('SELECT id,user_id,title,paid FROM campaigns WHERE id=?').get(req.params.id); if (!c) return bad(res, 'not found', 404);
  const on = req.body?.free !== false; db.prepare('UPDATE campaigns SET paid=? WHERE id=?').run(on ? 1 : 0, c.id);
  if (on) db.prepare("INSERT INTO payments(user_id,campaign_id,kind,amount,status,ref,note,approved_at) VALUES(?,?,'campaign',0,'approved','admin','שוחרר בחינם על ידי מנהל',datetime('now'))").run(c.user_id, c.id);
  ev(req, 'admin.free_campaign', { cid: c.id, msg: `${c.title} · ${on ? 'שוחרר בחינם' : 'בוטל השחרור'}` }); res.json({ ok: true });
});
app.post('/api/admin/campaigns/:id/paid', auth, admOnly, (req, res) => { db.prepare('UPDATE campaigns SET paid=? WHERE id=?').run(req.body?.paid ? 1 : 0, req.params.id); res.json({ ok: true }); });
app.post('/api/admin/users/:id/plan', auth, admOnly, (req, res) => { const until = String(req.body?.until || '').slice(0, 10); if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) return bad(res, 'תאריך לא תקין'); db.prepare('UPDATE users SET plan=?, plan_until=? WHERE id=?').run(until ? 'annual' : '', until, req.params.id); res.json({ ok: true }); });
app.get('/api/admin/pricing', auth, admOnly, (_, res) => res.json(pricing()));
app.put('/api/admin/pricing', auth, admOnly, (req, res) => { const b = req.body || {}; setKV('pricing', { campaign: Math.max(0, Math.round(+b.campaign || 0)), monthly: Math.max(0, Math.round(+b.monthly || 0)), vat: b.vat === 'plus' ? 'plus' : 'incl', payCampaignUrl: String(b.payCampaignUrl || '').slice(0, 500), payMonthlyUrl: String(b.payMonthlyUrl || '').slice(0, 500) }); res.json({ ok: true }); });
app.get('/contract/:id', auth, (req, res) => { const c = db.prepare('SELECT * FROM contracts WHERE id=?').get(req.params.id); if (!c || (c.user_id !== req.user.id && req.user.role !== 'admin')) return res.status(404).send('not found'); res.type('html').send(c.html); });
// public lookup used by the signup form (no save)
app.get('/api/org-lookup', limit(20, 60000), async (req, res) => { try { const o = await lookupOrg(req.query.number); if (!o) return res.json({ found: false }); const active = /פעיל|רשומ/.test(o.status) && !/מחוק|פירוק|בוטל/.test(o.status); res.json({ found: true, active, name: o.name, status: o.status, city: o.city, field: o.field }); } catch (e) { bad(res, e.message); } });
app.post('/api/login', limit(10, 60000), (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim().slice(0, 160); const fk = 'fail:' + email; const now = Date.now();
  const fails = (hits.get(fk)?.a || []).filter(t => now - t < 900000);
  if (fails.length >= 8) { if (fails.length === 8) { logEvent('auth.locked', { level: 'warn', ip: req.ip, msg: email }); fails.push(now); hits.set(fk, { a: fails, win: 900000 }); } return bad(res, 'יותר מדי ניסיונות כושלים לחשבון הזה. נסו שוב בעוד רבע שעה, או אפסו סיסמה.', 429); }
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!u || !checkPw(String(req.body?.password || ''), u.pass)) { fails.push(now); hits.set(fk, { a: fails, win: 900000 }); logEvent('auth.fail', { level: 'warn', uid: u?.id, ip: req.ip, msg: email + (u ? '' : ' (לא קיים)') }); return bad(res, 'אימייל או סיסמה שגויים', 401); }
  if (u.blocked) { logEvent('auth.blocked', { level: 'warn', uid: u.id, ip: req.ip, msg: email }); return bad(res, 'החשבון מושעה. לפרטים פנו לתמיכה.', 403); }
  hits.delete(fk);
  if (needsCode(u)) { if (!(u.vcode && u.vcode_exp - 14 * 60e3 > Date.now())) sendCode(u.id).catch(() => { }); return res.json({ ok: true, verify: true, email: u.email }); }
  db.prepare('UPDATE users SET logins=COALESCE(logins,0)+1 WHERE id=?').run(u.id);
  vLink(req, u.id); vEvent(req.cookies?.gv, 'login.ok', '', '', false, u.id);
  logEvent('auth.login', { uid: u.id, ip: req.ip, msg: email, meta: { ua: String(req.get('user-agent') || '').slice(0, 160) } });
  setSid(res, u.id);
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
    const token = crypto.randomBytes(24).toString('hex'); db.prepare('INSERT INTO resets(token,user_id,exp) VALUES(?,?,?)').run(token, u.id, Date.now() + 3600e3); logEvent('auth.forgot', { uid: u.id, ip: req.ip, msg: u.email });
    const url = `${base(req)}/app#reset=${token}`;
    await mail.send({ to: u.email, subject: 'איפוס סיסמה ל-GiveIL', html: mail.layout('איפוס סיסמה', `<p>שלום ${mail.esc(u.name || '')}, לחצו על הקישור כדי לבחור סיסמה חדשה (תקף לשעה):</p><p><a href="${url}" style="background:#1c1917;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;display:inline-block;font-weight:600">בחירת סיסמה חדשה</a></p><p style="color:#6b6762;font-size:13px">אם לא ביקשתם איפוס – התעלמו מהמייל.</p>`) }).catch(() => { });
  }
  res.json({ ok: true, mail: mail.enabled() });
});
app.post('/api/reset', limit(10, 600000), (req, res) => {
  const r = db.prepare('SELECT * FROM resets WHERE token=?').get(String(req.body?.token || '')); if (!r || r.exp < Date.now()) return bad(res, 'הקישור פג תוקף. בקשו איפוס חדש.');
  if (String(req.body?.password || '').length < 6) return bad(res, 'סיסמה: לפחות 6 תווים');
  db.prepare('UPDATE users SET pass=?, tv=COALESCE(tv,0)+1, email_verified=1 WHERE id=?').run(hashPw(req.body.password), r.user_id); db.prepare('DELETE FROM resets WHERE user_id=?').run(r.user_id); logEvent('auth.reset', { uid: r.user_id, ip: req.ip });
  setSid(res, r.user_id); res.json({ ok: true });
});
app.post('/api/me/password', auth, (req, res) => { const u = db.prepare('SELECT pass FROM users WHERE id=?').get(req.user.id); if (!checkPw(String(req.body?.current || ''), u.pass)) return bad(res, 'הסיסמה הנוכחית שגויה'); if (String(req.body?.password || '').length < 6) return bad(res, 'סיסמה: לפחות 6 תווים'); db.prepare('UPDATE users SET pass=?, tv=COALESCE(tv,0)+1 WHERE id=?').run(hashPw(req.body.password), req.user.id); setSid(res, req.user.id); ev(req, 'auth.password'); res.json({ ok: true }); });
app.get('/api/me', (req, res) => { const u = user(req); if (!u) return res.json({ user: null }); const x = db.prepare('SELECT org_number,org_name,org_verified,org_status,phone,role_title,org,avatar,website,s46,address,city,marketing,created,plan,plan_until FROM users WHERE id=?').get(u.oid); { const me = db.prepare('SELECT email_verified,avatar FROM users WHERE id=?').get(u.id); x.email_verified = me.email_verified; x.avatar = me.avatar || ''; } if (u.sub) { delete x.phone; delete x.role_title; const o = db.prepare('SELECT name,email FROM users WHERE id=?').get(u.oid); x.owner = { name: o.name, email: o.email }; x.email_verified = 1; } const ct = db.prepare('SELECT id,created,status,review_note,method FROM contracts WHERE user_id=? ORDER BY id DESC LIMIT 1').get(u.oid); res.json({ user: { ...u, ...x, contract: ct || null, mailEnabled: mail.enabled() } }); });
// ---- team members: the NGO owner gives colleagues their own login with chosen permissions ----
const ownerOnly = (req, res, next) => req.user.sub ? bad(res, 'רק מנהל החשבון יכול לנהל הרשאות', 403) : next();
const memberOut = m => ({ id: m.id, email: m.email, name: m.name, perms: subPerms(m.perms), created: m.created, last_seen: m.last_seen || '', blocked: !!m.blocked });
const cleanPerms = (b, oid) => { const p = {}; for (const k of PERM_KEYS) p[k] = !!b?.[k]; const mine = db.prepare('SELECT id FROM campaigns WHERE user_id=?').all(oid).map(r => r.id); p.camps = Array.isArray(b?.camps) ? b.camps.map(Number).filter(id => mine.includes(id)) : 'all'; return JSON.stringify(p); };
app.get('/api/members', auth, ownerOnly, (req, res) => res.json(db.prepare('SELECT * FROM users WHERE parent_id=? ORDER BY id').all(req.user.id).map(memberOut)));
app.post('/api/members', auth, ownerOnly, limit(20, 600000), (req, res) => {
  const b = req.body || {}; const email = String(b.email || '').toLowerCase().trim().slice(0, 160); const name = String(b.name || '').trim().slice(0, 60);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad(res, 'אימייל לא תקין'); if (name.length < 2) return bad(res, 'נא להזין שם');
  if (String(b.password || '').length < 8) return bad(res, 'סיסמה: לפחות 8 תווים');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return bad(res, 'האימייל הזה כבר רשום במערכת. בחרו אימייל אחר.');
  const r = db.prepare("INSERT INTO users(email,pass,name,role,parent_id,perms,email_verified,consent_at) VALUES(?,?,?,'user',?,?,1,datetime('now'))").run(email, hashPw(String(b.password)), name, req.user.id, cleanPerms(b.perms, req.user.id));
  ev(req, 'member.add', { msg: email });
  if (mail.enabled()) { const o = db.prepare('SELECT name,org_name,org FROM users WHERE id=?').get(req.user.id) || {}; mail.send({ to: email, subject: `קיבלת גישה לניהול הקמפיינים של ${o.org_name || o.org || 'העמותה'}`, html: mail.layout('קיבלת גישה ל-GiveIL', `<p>שלום ${mail.esc(name)},</p><p>${mail.esc(o.name || '')} פתח/ה לך גישה לניהול הקמפיינים של <b>${mail.esc(o.org_name || o.org || '')}</b> ב-GiveIL.</p><p>נכנסים עם כתובת המייל הזו והסיסמה שקיבלת ממנו/ממנה.</p><p><a href="${SITE()}/app" style="background:#1c1917;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;display:inline-block;font-weight:600">כניסה למערכת</a></p>`) }).catch(() => { }); }
  res.json(memberOut(db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid)));
});
app.put('/api/members/:mid', auth, ownerOnly, (req, res) => {
  const m = db.prepare('SELECT * FROM users WHERE id=? AND parent_id=?').get(req.params.mid, req.user.id); if (!m) return bad(res, 'not found', 404); const b = req.body || {};
  if (b.password !== undefined && b.password !== '') { if (String(b.password).length < 8) return bad(res, 'סיסמה: לפחות 8 תווים'); db.prepare('UPDATE users SET pass=?, tv=COALESCE(tv,0)+1 WHERE id=?').run(hashPw(String(b.password)), m.id); }
  if (b.perms) db.prepare('UPDATE users SET perms=?, tv=COALESCE(tv,0)+? WHERE id=?').run(cleanPerms(b.perms, req.user.id), 0, m.id);
  if (b.name) db.prepare('UPDATE users SET name=? WHERE id=?').run(String(b.name).trim().slice(0, 60), m.id);
  if (b.blocked !== undefined) db.prepare('UPDATE users SET blocked=? WHERE id=?').run(b.blocked ? 1 : 0, m.id);
  ev(req, 'member.update', { msg: m.email }); res.json(memberOut(db.prepare('SELECT * FROM users WHERE id=?').get(m.id)));
});
app.delete('/api/members/:mid', auth, ownerOnly, (req, res) => { const m = db.prepare('SELECT id,email FROM users WHERE id=? AND parent_id=?').get(req.params.mid, req.user.id); if (!m) return bad(res, 'not found', 404); db.prepare('DELETE FROM users WHERE id=?').run(m.id); ev(req, 'member.remove', { msg: m.email }); res.json({ ok: true }); });
app.put('/api/me', auth, (req, res) => {
  const b = req.body || {}; const S = (v, n) => String(v ?? '').trim().slice(0, n); const cur = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (b.name !== undefined && S(b.name, 60).length < 2) return bad(res, 'נא להזין שם מלא');
  const av = b.avatar === undefined ? cur.avatar : (b.avatar === '' ? '' : (/^\/u\/[\w.-]+$/.test(String(b.avatar)) ? String(b.avatar) : cur.avatar));
  db.prepare('UPDATE users SET name=?,phone=?,avatar=?,role_title=?,marketing=? WHERE id=?').run(b.name !== undefined ? S(b.name, 60) : cur.name, b.phone !== undefined ? S(b.phone, 20) : cur.phone, av, b.role_title !== undefined ? S(b.role_title, 40) : cur.role_title, b.marketing !== undefined ? (b.marketing ? 1 : 0) : cur.marketing, req.user.id);
  if (!req.user.sub) db.prepare('UPDATE users SET org=?,website=?,s46=?,address=?,city=? WHERE id=?').run(b.org !== undefined ? S(b.org, 80) : cur.org, b.website !== undefined ? S(b.website, 160) : cur.website, b.s46 !== undefined ? S(b.s46, 10) : cur.s46, b.address !== undefined ? S(b.address, 120) : cur.address, b.city !== undefined ? S(b.city, 60) : cur.city, req.user.id);
  res.json({ ok: true });
});
// sign out everywhere: bump the session version so every other device is logged out
app.post('/api/me/logout-all', auth, (req, res) => { db.prepare('UPDATE users SET tv=COALESCE(tv,0)+1 WHERE id=?').run(req.user.id); ev(req, 'user.logout_all', {}); res.clearCookie('sid'); res.json({ ok: true }); });
// delete account: password + typed confirmation; blocked while a campaign is live. Personal details are wiped; donation records stay with the campaigns for the NGO's legal bookkeeping.
app.post('/api/me/delete', auth, limit(5, 600000), (req, res) => {
  const b = req.body || {}; const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!checkPw(String(b.password || ''), u.pass)) return bad(res, 'הסיסמה שגויה');
  if (String(b.confirm || '').trim() !== 'מחיקה') return bad(res, 'כדי לאשר, הקלידו את המילה "מחיקה"');
  if (u.role === 'admin') return bad(res, 'אי אפשר למחוק חשבון מנהל');
  if (!req.user.sub && db.prepare("SELECT 1 FROM campaigns WHERE user_id=? AND status='live'").get(u.id)) return bad(res, 'יש קמפיין באוויר. סיימו או עצרו אותו לפני מחיקת החשבון.');
  if (!req.user.sub) { db.prepare("UPDATE campaigns SET status='draft' WHERE user_id=?").run(u.id); db.prepare('DELETE FROM users WHERE parent_id=?').run(u.id); }
  db.prepare("UPDATE users SET email=?, name='חשבון שנמחק', phone='', avatar='', pass=?, blocked=1, tv=COALESCE(tv,0)+1, marketing=0 WHERE id=?").run(`deleted-${u.id}-${Date.now()}@deleted.giveil`, hashPw(crypto.randomBytes(24).toString('hex')), u.id);
  logEvent('user.deleted', { uid: u.id, ip: req.ip, level: 'warn', msg: `${u.email} · ${u.org_name || u.org || ''}` });
  res.clearCookie('sid'); res.json({ ok: true });
});

// ---------- uploads ----------
const UP_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };
const upload = multer({ storage: multer.diskStorage({ destination: path.join(DATA_DIR, 'uploads'), filename: (_, f, cb) => cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + UP_EXT[f.mimetype]) }), limits: { fileSize: 80e6 }, fileFilter: (_, f, cb) => cb(null, !!UP_EXT[f.mimetype]) });
const SANDBOX = (req, res, next) => { res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox"); res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); next(); };
app.post('/api/upload', auth, limit(60, 600000), upload.single('file'), (req, res) => { if (!req.file) return bad(res, 'קובץ לא נתמך – תמונה (JPG/PNG/WebP/GIF/SVG) או וידאו (MP4/WebM/MOV)'); ev(req, 'upload', { msg: req.file.mimetype + ' · ' + Math.round(req.file.size / 1024) + 'KB' }); res.json({ url: '/u/' + req.file.filename, type: req.file.mimetype }); });
app.use('/u', SANDBOX, express.static(path.join(DATA_DIR, 'uploads'), { maxAge: '30d', immutable: true }));

// ---------- campaigns (owner) ----------
// ---- one-time campaign plan: up to 45 days live; an active subscription (or admin) has no limit ----
const CAMP_DAYS = 45;
const ilLocal = ms => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms)).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; };
const campLimit = c => { const u = db.prepare('SELECT role,plan_until FROM users WHERE id=?').get(c.user_id) || {}; if (u.role === 'admin' || planActive(u)) return null; const from = c.live_at ? Date.parse(c.live_at.replace(' ', 'T') + (c.live_at.endsWith('Z') ? '' : 'Z')) : Date.now(); return { days: CAMP_DAYS, maxEnd: ilLocal(from + CAMP_DAYS * 864e5), live: !!c.live_at }; };
try { db.prepare("UPDATE campaigns SET live_at=datetime('now') WHERE status IN ('live','ended') AND (live_at IS NULL OR live_at='')").run(); } catch { }
const campaignOut = c => ({ ...c, limit: campLimit(c), settings: J(c.settings), provider: provMask(PV_(c.provider)), lastPaid: (db.prepare("SELECT paid_at FROM donations WHERE campaign_id=? AND status='paid' AND test=0 ORDER BY paid_at DESC LIMIT 1").get(c.id) || {}).paid_at || null, levels: db.prepare('SELECT * FROM levels WHERE campaign_id=? ORDER BY pos,id').all(c.id), teams: db.prepare('SELECT * FROM teams WHERE campaign_id=? ORDER BY pos,id').all(c.id).map(t => ({ ...t, key: teamKey(t) })), matchers: db.prepare('SELECT * FROM matchers WHERE campaign_id=? ORDER BY pos,id').all(c.id) });
// ---- NGO home: everything happening across all my campaigns, at a glance ----
app.get('/api/home', auth, (req, res) => {
  const camps = db.prepare('SELECT * FROM campaigns WHERE user_id=? ORDER BY id DESC').all(req.user.oid).filter(c => !req.user.sub || req.user.sub.camps === 'all' || req.user.sub.camps.includes(c.id));
  const names = !req.user.sub || req.user.sub.donations; const now = Date.now();
  const H = Array(24).fill(0); let hour = { n: 0, s: 0 }, day = { n: 0, s: 0 }, total = 0, donors = 0, pending = 0; const feed = []; const ending = [];
  const out = camps.map(c => {
    const test = isTest(c) ? 1 : 0; const st = stats(c, test); total += st.total; donors += st.count;
    const rows = db.prepare("SELECT d.id,d.name,d.anonymous,d.amount,d.dedication,d.paid_at,d.created,d.monthly,t.name team FROM donations d LEFT JOIN teams t ON t.id=d.team_id WHERE d.campaign_id=? AND d.status='paid' AND d.test=? AND COALESCE(d.paid_at,d.created) > datetime('now','-1 day') ORDER BY d.id DESC").all(c.id, test);
    let cd = { n: 0, s: 0 }, ch = { n: 0, s: 0 };
    for (const d of rows) { const t = Date.parse((d.paid_at || d.created).replace(' ', 'T') + 'Z'); const ago = now - t; cd.n++; cd.s += d.amount; if (ago < 36e5) { ch.n++; ch.s += d.amount; } const hi = 23 - Math.min(23, Math.floor(ago / 36e5)); H[hi] += d.amount; }
    day.n += cd.n; day.s += cd.s; hour.n += ch.n; hour.s += ch.s;
    for (const d of db.prepare("SELECT d.id,d.name,d.anonymous,d.amount,d.dedication,d.paid_at,d.created,d.monthly,t.name team FROM donations d LEFT JOIN teams t ON t.id=d.team_id WHERE d.campaign_id=? AND d.status='paid' AND d.test=? ORDER BY COALESCE(d.paid_at,d.created) DESC LIMIT 12").all(c.id, test))
      feed.push({ id: d.id, cid: c.id, ctitle: c.title, name: names ? (d.anonymous ? '' : d.name) : '', anonymous: !!d.anonymous, amount: d.amount, dedication: names ? (d.dedication || '') : '', team: d.team || '', monthly: !!d.monthly, at: d.paid_at || d.created, test: !!test });
    if (c.status === 'live') { const p = db.prepare("SELECT COUNT(*) n FROM donations WHERE campaign_id=? AND status='pending' AND test=0 AND created > datetime('now','-2 day') AND created < datetime('now','-10 minutes')").get(c.id).n; pending += p;
      const end = c.end_at ? Date.parse((ilToUtc(c.end_at) || '').replace(' ', 'T') + 'Z') : 0; if (end && end > now && end - now < 48 * 36e5) ending.push({ id: c.id, title: c.title, hours: Math.round((end - now) / 36e5) }); }
    return { id: c.id, slug: c.slug, title: c.title, status: c.status, goal: c.goal, cover: c.cover || ((J(c.settings).media?.default?.desktop || [])[0]) || '', end_at: c.end_at, currency: c.currency, test: !!test, stats: st, today: cd, hour: ch, ended: isEnded(c) };
  });
  feed.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  res.json({ campaigns: out, hour, day, total, donors, hourly: H, feed: feed.slice(0, 15), pending, ending, anyLive: camps.some(c => c.status === 'live'), names });
});
app.get('/api/campaigns', auth, (req, res) => {
  const rows = req.user.role === 'admin' && req.query.all ? db.prepare('SELECT c.*, u.email owner FROM campaigns c JOIN users u ON u.id=c.user_id ORDER BY c.id DESC').all() : db.prepare('SELECT * FROM campaigns WHERE user_id=? ORDER BY id DESC').all(req.user.oid).filter(c => !req.user.sub || req.user.sub.camps === 'all' || req.user.sub.camps.includes(c.id));
  res.json(rows.map(c => ({ id: c.id, slug: c.slug, title: c.title, status: c.status, goal: c.goal, multiplier: c.multiplier, end_at: c.end_at, cover: c.cover, owner: c.owner, stats: stats(c, isTest(c)) })));
});
app.post('/api/campaigns', auth, (req, res) => {
  const b = req.body || {}; const title = String(b.title || 'קמפיין חדש').slice(0, 120);
  let slug = slugify(b.slug || title); while (db.prepare('SELECT 1 FROM campaigns WHERE slug=?').get(slug)) slug = slug + '-' + crypto.randomBytes(2).toString('hex');
  const end = b.end_at || new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 16);
  const r = db.prepare('INSERT INTO campaigns(user_id,slug,title,subtitle,goal,multiplier,start_at,end_at,currency,settings) VALUES(?,?,?,?,?,?,?,?,?,?)').run(req.user.id, slug, title, String(b.subtitle || '').slice(0, 200), +b.goal || 100000, 1, b.start_at || new Date().toISOString().slice(0, 16), end, b.currency === 'USD' ? 'USD' : 'ILS', JSON.stringify({ showDonors: true, allowAnon: true, allowMonthly: true, installments: 12, minAmount: 10, presets: [100, 180, 360, 500, 1000, 1800], thanks: 'תודה רבה! התרומה שלך התקבלה.' }));
  const id = r.lastInsertRowid;
  ev(req, 'campaign.create', { cid: id, msg: title });
  [[180, 'ידיד'], [500, 'שותף'], [1000, 'תומך'], [1800, 'מייסד']].forEach(([a, n], i) => db.prepare('INSERT INTO levels(campaign_id,name,amount,pos) VALUES(?,?,?,?)').run(id, n, a, i));
  res.json(campaignOut(db.prepare('SELECT * FROM campaigns WHERE id=?').get(id)));
});
app.get('/api/campaigns/:id', auth, own, (req, res) => res.json(subOut(req, { ...campaignOut(req.c), stats: stats(req.c, isTest(req.c)), teamStats: teamStats(req.c, isTest(req.c)) })));
const ADMIN_KEYS = ['providerOk', 'providerReview', 'adminPaused', 'adminNote', 'msg'];
// which messaging services the super-admin opened for this campaign (connections are platform-level)
const chAllowed = (c, ch) => { const m = J(c.settings).msg || {}; return ch === 'email' ? m.email !== false : !!m[ch]; };
const chReady = ch => ch === 'email' ? mail.enabled() : !!((getKV('msg')[ch] || {}).type);
const chOn = (c, ch) => chAllowed(c, ch) && chReady(ch);
const provFp = cfg => { const o = { ...(cfg || {}) }; delete o._hasSecret; return crypto.createHash('sha256').update(JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]))).digest('hex').slice(0, 24); };
// only API-verified processors: no external/manual-confirmation payment page (cash is added by the NGO from the dashboard)
const NO_MANUAL = ['link'];
const PROV_ID_KEYS = ['companyId', 'mosadId', 'apiValid', 'pageCode', 'userId', 'terminal', 'terminalName', 'clientId', 'email', 'url', 'link', 'phone', 'businessId'];
const provSummary = cfg => Object.entries(cfg || {}).filter(([k, v]) => v && (PROV_ID_KEYS.includes(k) || k === 'type')).map(([k, v]) => k + ': ' + String(v).slice(0, 80)).join(' · ');
app.put('/api/campaigns/:id', auth, own, (req, res) => {
  const b = req.body || {}; const c = req.c; if (req.user.sub) delete b.provider;
  if (b.provider && NO_MANUAL.includes(b.provider.type)) return bad(res, 'אפשר לחבר רק ספק סליקה עם חיבור API מאומת. תרומות במזומן מוסיפים מהניהול (תרומות ← הוספת תרומה).');
  if (b.end_at && c.live_at && (c.status === 'live')) { const L = campLimit(c); if (L && String(b.end_at).slice(0, 16) > L.maxEnd) return bad(res, `בתוכנית קמפיין חד-פעמי הקמפיין יכול להיות באוויר עד ${CAMP_DAYS} יום – כלומר עד ${L.maxEnd.slice(8, 10)}.${L.maxEnd.slice(5, 7)}.${L.maxEnd.slice(0, 4)}. במנוי שנתי אין הגבלה.`); }
  if (req.user.role !== 'admin' && b.settings && typeof b.settings === 'object') { for (const k of ADMIN_KEYS) delete b.settings[k]; }
  if (b.settings && typeof b.settings === 'object' && 'fbPixel' in b.settings) { const px = String(b.settings.fbPixel || '').replace(/\D/g, ''); if (px && (px.length < 10 || px.length > 20)) return bad(res, 'מזהה הפיקסל צריך להיות מספר של 10–20 ספרות (מ-Events Manager)'); b.settings.fbPixel = px; }
  if (b.provider && typeof b.provider === 'object') { for (const k of Object.keys(b.provider)) if (isMasked(b.provider[k])) delete b.provider[k]; }
  if (b.provider && req.user.role !== 'admin') {
    const cur = PV_(c.provider), next = { ...cur, ...b.provider };
    if (provFp(next) !== provFp(cur) && next.type !== 'test') {
      if (c.status === 'live') return bad(res, 'מטעמי אבטחה אי אפשר לשנות פרטי סליקה בקמפיין שבאוויר. פנו אלינו ונעדכן יחד.');
      ev(req, 'provider.change', { level: 'warn', cid: c.id, msg: `${c.title}: ${provSummary(next)}` });
      const st = J(c.settings); st.providerReview = { fp: provFp(next), status: 'pending', at: new Date().toISOString() }; b.settings = { ...(b.settings || {}), providerReview: st.providerReview };
      if (mail.enabled()) { const u = db.prepare('SELECT email,org_name,org,org_number FROM users WHERE id=?').get(c.user_id) || {}; mail.send({ to: process.env.ADMIN_EMAIL || contract.OPERATOR.email, subject: `סליקה לאישור – ${u.org_name || u.org || ''}`, html: mail.layout('פרטי סליקה ממתינים לאישור', `<p><b>${mail.esc(u.org_name || u.org || '')}</b> (ע"ר ${mail.esc(u.org_number || '—')}) · ${mail.esc(u.email || '')}<br>קמפיין: ${mail.esc(c.title)}<br>${mail.esc(provSummary(next))}</p><p>ודאו שחשבון הסליקה רשום על שם העמותה (שם המוטב בדף התשלום / אישור מהספק), ואשרו בניהול-על ← סליקות לאישור.</p>`) }).catch(() => { }); }
    }
  }
  const f = {
    title: String(b.title ?? c.title).slice(0, 120), subtitle: String(b.subtitle ?? c.subtitle).slice(0, 200), story: String(b.story ?? c.story).slice(0, 20000),
    goal: +(b.goal ?? c.goal) || 0, bonus_goal: +(b.bonus_goal ?? c.bonus_goal) || 0, currency: (b.currency ?? c.currency) === 'USD' ? 'USD' : 'ILS', multiplier: 1,
    start_at: b.start_at ?? c.start_at, end_at: b.end_at ?? c.end_at, cover: safeUrl(b.cover ?? c.cover), logo: safeUrl(b.logo ?? c.logo), video: safeUrl(b.video ?? c.video),
    color: /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : c.color, lang: b.lang === 'en' ? 'en' : 'he',
    settings: JSON.stringify({ ...J(c.settings), ...(b.settings || {}) }), provider: b.provider ? provEnc({ ...PV_(c.provider), ...b.provider }) : c.provider
  };
  if (b.slug && b.slug !== c.slug) { const s = slugify(b.slug); if (db.prepare('SELECT 1 FROM campaigns WHERE slug=? AND id!=?').get(s, c.id)) return bad(res, 'הכתובת תפוסה'); f.slug = s; } else f.slug = c.slug;
  db.prepare('UPDATE campaigns SET title=@title,subtitle=@subtitle,story=@story,goal=@goal,bonus_goal=@bonus_goal,currency=@currency,multiplier=@multiplier,start_at=@start_at,end_at=@end_at,cover=@cover,logo=@logo,video=@video,color=@color,lang=@lang,settings=@settings,provider=@provider,slug=@slug WHERE id=@id').run({ ...f, id: c.id });
  if (Array.isArray(b.levels)) { db.prepare('DELETE FROM levels WHERE campaign_id=?').run(c.id); b.levels.forEach((l, i) => db.prepare('INSERT INTO levels(id,campaign_id,name,amount,descr,stock,pos,icon,monthly,months) VALUES(?,?,?,?,?,?,?,?,?,?)').run(l.id || null, c.id, String(l.name || '').slice(0, 60), +l.amount || 0, String(l.descr || '').slice(0, 200), +l.stock || 0, i, String(l.icon || '').slice(0, 8), l.monthly ? 1 : 0, Math.min(120, Math.max(1, +l.months || 12)))); }
  if (Array.isArray(b.matchers)) { db.prepare('DELETE FROM matchers WHERE campaign_id=?').run(c.id); b.matchers.forEach((m, i) => db.prepare('INSERT INTO matchers(campaign_id,name,logo,pos) VALUES(?,?,?,?)').run(c.id, String(m.name || '').slice(0, 80), String(m.logo || '').slice(0, 300), i)); }
  res.json(subOut(req, campaignOut(db.prepare('SELECT * FROM campaigns WHERE id=?').get(c.id))));
});
const safeUrl = v => { const u = String(v || '').trim().slice(0, 500); return /^(https?:\/\/|\/u\/)[^\s"'<>`\\]*$/i.test(u) ? u : ''; };
const NO_PAY_OK = c => c.slug === 'nyalchun' || /נחלים\s*מהלכים/.test(String(c.title || ''));
app.post('/api/campaigns/:id/status', auth, own, (req, res) => {
  const s = req.body?.status; if (!['draft', 'test', 'live', 'ended'].includes(s)) return bad(res, 'status');
  const force = req.user.role === 'admin' && req.body?.force === true && NO_PAY_OK(req.c); // one specific campaign may go live without payments (donations closed)
  if (s === 'live' && !force && (PV_(req.c.provider).type || 'test') === 'test') return bad(res, 'כדי לעלות לאוויר צריך לחבר ספק סליקה אמיתי');
  if (s === 'live' && !force && NO_MANUAL.includes(PV_(req.c.provider).type)) return bad(res, 'דף תשלום חיצוני עם אישור ידני כבר לא נתמך. חברו ספק סליקה עם API (בטאב סליקה), ותרומות במזומן הוסיפו מהניהול.');
  if (s === 'live' && !force && PV_(req.c.provider).type === 'nedarim' && !PV_(req.c.provider).apiPassword) return bad(res, 'נדרים פלוס: חובה להזין ApiPassword לפני העלייה לאוויר – בלעדיו אי אפשר לאמת תרומות');
  if (s === 'live' && req.user.role !== 'admin' && db.prepare('SELECT org_verified FROM users WHERE id=?').get(req.user.oid)?.org_verified !== 1) return res.status(409).json({ error: 'כדי לעלות לאוויר צריך לאמת את העמותה – ב"החשבון שלי" ← העמותה ואימות. בניית הקמפיין והבדיקות פתוחות גם בלי.', code: 'org' });
  if (s === 'live' && req.user.role !== 'admin') { const u = db.prepare('SELECT email_verified FROM users WHERE id=?').get(req.user.id); if (mail.enabled() && !u.email_verified) return bad(res, 'כדי לעלות לאוויר יש לאמת את כתובת האימייל (בדקו את תיבת הדואר)'); const ct = db.prepare('SELECT status FROM contracts WHERE user_id=? ORDER BY id DESC LIMIT 1').get(req.user.id); if (!ct || ct.status === 'rejected') return bad(res, 'כדי לעלות לאוויר יש לחתום על הסכם השימוש'); if (ct.status !== 'approved') return bad(res, 'ההסכם והמסמכים בבדיקה אצלנו (בדרך כלל עד יום עסקים). נעדכן במייל כשאפשר לעלות לאוויר.'); const uu = db.prepare('SELECT plan_until FROM users WHERE id=?').get(req.user.id); if (!req.c.paid && !planActive(uu)) return res.status(402).json({ error: 'כדי לעלות לאוויר יש להסדיר תשלום עבור הקמפיין', code: 'billing' }); }
  if (s === 'live' && req.user.role !== 'admin') { const st = J(req.c.settings); if (st.providerOk !== provFp(PV_(req.c.provider))) return res.status(409).json({ error: 'פרטי הסליקה בבדיקה אצלנו: מוודאים שחשבון הסליקה רשום על שם העמותה. בדרך כלל עד יום עסקים, ונעדכן במייל.', code: 'provider' }); }
  if (s === 'live' && req.body?.clearTest) db.prepare('DELETE FROM donations WHERE campaign_id=? AND test=1').run(req.c.id);
  let clamped = '';
  if (s === 'live') { if (!req.c.live_at) { req.c.live_at = new Date().toISOString().slice(0, 19).replace('T', ' '); db.prepare('UPDATE campaigns SET live_at=? WHERE id=?').run(req.c.live_at, req.c.id); }
    const L = campLimit(req.c); if (L && (!req.c.end_at || String(req.c.end_at).slice(0, 16) > L.maxEnd)) { db.prepare('UPDATE campaigns SET end_at=? WHERE id=?').run(L.maxEnd, req.c.id); clamped = L.maxEnd; } }
  db.prepare('UPDATE campaigns SET status=? WHERE id=?').run(s, req.c.id); if (s !== req.c.status) ev(req, 'campaign.status', { cid: req.c.id, msg: `${req.c.title}: ${req.c.status} → ${s}${force ? ' (בלי סליקה)' : ''}` }); res.json({ ok: true, clamped });
});
app.delete('/api/campaigns/:id', auth, own, (req, res) => { const real = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(amount),0) s FROM donations WHERE campaign_id=? AND test=0 AND status='paid'").get(req.c.id); if (real.n && req.user.role !== 'admin') return bad(res, `בקמפיין יש ${real.n} תרומות אמיתיות, ולכן אי אפשר למחוק אותו. אפשר לסיים אותו, או לפנות אלינו.`); db.prepare('DELETE FROM campaigns WHERE id=?').run(req.c.id); ev(req, 'campaign.delete', { level: real.n ? 'warn' : 'info', cid: req.c.id, msg: `${req.c.title}${real.n ? ` (${real.n} תרומות, ₪${real.s})` : ''}` }); res.json({ ok: true }); });
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
  sql += ' ORDER BY d.id DESC LIMIT 2000'; const lite = req.user.sub && !req.user.sub.donations; // members without donor access get amounts & times only (for the live charts)
  res.json(db.prepare(sql).all(...p).map(d => lite ? { id: d.id, amount: d.amount, status: d.status, test: d.test, created: d.created, paid_at: d.paid_at, monthly: d.monthly, team_id: d.team_id } : ({ ...d, meta: undefined })));
});
const XLSX = require('./lib/xlsx');
const ST_HE = { paid: 'שולם', pending: 'ממתין', failed: 'נכשל', refunded: 'הוחזר', cancelled: 'בוטל' };
const PROV_HE = { manual: 'ידני', import: 'ייבוא', test: 'בדיקה', nedarim: 'נדרים פלוס', meshulam: 'Grow', paypal: 'PayPal', link: 'דף תשלום', bit: 'ביט', paybox: 'PayBox' };
const xlsxSend = (res, name, buf) => { res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}.xlsx`); res.send(buf); };
const today = () => new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
app.get('/api/campaigns/:id/donations.xlsx', auth, own, (req, res) => {
  const c = req.c; const all = db.prepare("SELECT d.*, t.name team FROM donations d LEFT JOIN teams t ON t.id=d.team_id WHERE d.campaign_id=? AND (d.test=? OR d.provider='import') ORDER BY COALESCE(d.paid_at,d.created), d.id").all(c.id, isTest(c) ? 1 : 0);
  const kind = d => d.monthly ? 'הוראת קבע' : (d.installments > 1 ? 'תשלומים' : 'חד-פעמי');
  const cols = [{ h: '#', t: 'int', w: 6, count: 1 }, { h: 'תאריך', t: 'date', w: 17 }, { h: 'שם התורם', w: 24 }, { h: 'סכום כולל', t: 'money', w: 13, sum: 1 }, { h: 'סוג', w: 12 }, { h: 'לחודש', t: 'money', w: 11 }, { h: 'חודשים / תשלומים', t: 'int', w: 11 }, { h: 'הקדשה', t: 'wrap', w: 28 }, { h: 'שגריר', w: 16 }, { h: 'טלפון', w: 14 }, { h: 'אימייל', w: 24 }, { h: 'ת.ז.', w: 11 }, { h: 'אמצעי', w: 11 }, { h: 'סטטוס', w: 9 }, { h: 'אסמכתא', w: 14 }, { h: 'אנונימי', w: 8 }];
  const row = (d, i) => [i + 1, d.paid_at || d.created, d.name, d.amount, kind(d), d.monthly && d.installments > 1 ? Math.round(d.amount / d.installments * 100) / 100 : '', d.installments > 1 ? d.installments : '', d.dedication, d.team || '', d.phone, d.email, d.id_number || '', PROV_HE[d.provider] || d.provider, ST_HE[d.status] || d.status, d.ref && !/^import:/.test(d.ref) ? d.ref : '', d.anonymous ? 'כן' : ''];
  const paid = all.filter(d => d.status === 'paid'), other = all.filter(d => d.status !== 'paid');
  const teams = teamStats(c, isTest(c)); const noTeam = paid.filter(d => !d.team_id);
  const sheets = [{ name: 'תרומות', title: `תרומות – ${c.title} · הופק ${today()}`, cols, rows: paid.map(row), totals: { label: 'סה"כ' } }];
  if (teams.length) sheets.push({ name: 'לפי שגריר', title: `סיכום לפי שגריר – ${c.title}`, cols: [{ h: 'שגריר', w: 24, count: 0 }, { h: 'תרומות', t: 'int', w: 10, sum: 1 }, { h: 'גויס', t: 'money', w: 14, sum: 1 }, { h: 'יעד', t: 'money', w: 14, sum: 1 }, { h: '% מהיעד', t: 'pct', w: 10 }], rows: [...teams.map(t => [t.name, t.n, t.total, t.goal || '', t.goal ? t.total / t.goal : '']), ...(noTeam.length ? [['ללא שגריר', noTeam.length, noTeam.reduce((a, d) => a + d.amount, 0), '', '']] : [])], totals: { label: 'סה"כ' } });
  if (other.length) sheets.push({ name: 'לא הושלמו', title: 'תרומות שלא הושלמו (ממתינות / נכשלו)', cols, rows: other.map(row) });
  xlsxSend(res, `${c.title} - תרומות`, XLSX.build(sheets));
});
app.get('/api/campaigns/:id/teams.xlsx', auth, own, (req, res) => {
  const c = req.c; const B = base(req); const teams = teamStats(c, isTest(c));
  const rows = teams.map((t, i) => [i + 1, t.name, t.phone || '', `${B}/c/${c.slug}/${t.slug}`, t.goal || '', t.total, t.n, t.goal ? t.total / t.goal : '']);
  xlsxSend(res, `${c.title} - שגרירים`, XLSX.build([{ name: 'שגרירים', title: `שגרירים – ${c.title} · הופק ${today()}`, cols: [{ h: 'דירוג', t: 'int', w: 7 }, { h: 'שגריר', w: 24, count: 1 }, { h: 'טלפון', w: 14 }, { h: 'קישור אישי', w: 44 }, { h: 'יעד', t: 'money', w: 13, sum: 1 }, { h: 'גויס', t: 'money', w: 13, sum: 1 }, { h: 'תרומות', t: 'int', w: 10, sum: 1 }, { h: '% מהיעד', t: 'pct', w: 10 }], rows, totals: { label: 'סה"כ' } }]));
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
  emit(req.c.id, 'donation', { donation: publicDonation(d), stats: stats(req.c, d.test) }); emitTeams(req.c, d.test); res.json({ id: d.id });
});
// "YYYY-MM-DD HH:MM[:SS]" in Israel local time → UTC "YYYY-MM-DD HH:MM:SS" (DST-aware)
const ilToUtc = v => { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/); if (!m) return null; const guess = Date.UTC(+m[1], m[2] - 1, +m[3], +(m[4] || 12), +(m[5] || 0), +(m[6] || 0)); const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(guess)).map(x => [x.type, x.value])); const asIL = Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute, +p.second); return new Date(guess - (asIL - guess)).toISOString().slice(0, 19).replace('T', ' '); };
app.post('/api/campaigns/:id/donations/import', auth, own, limit(10, 60000), (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 5000) : []; const months = Math.min(120, Math.max(0, Math.round(+req.body?.months || 0)));
  if (!rows.length) return bad(res, 'לא נמצאו שורות לייבוא');
  const ins = db.prepare("INSERT INTO donations(campaign_id,amount,currency,name,dedication,anonymous,status,test,provider,ref,installments,monthly,token,created,paid_at) VALUES(?,?,?,?,?,?,'paid',0,'import',?,?,?,?,?,?)");
  const has = db.prepare("SELECT 1 FROM donations WHERE campaign_id=? AND ref=?");
  let added = 0, skipped = 0, sum = 0;
  db.transaction(() => { for (const r of rows) {
    const amt = Math.round(+String(r.amount || '').replace(/[^\d.]/g, '') || 0); if (amt <= 0) { skipped++; continue; }
    const ref = String(r.ref || '').slice(0, 80); if (ref && has.get(req.c.id, ref)) { skipped++; continue; }
    const dt = ilToUtc(r.date) || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const anon = r.anonymous ? 1 : 0; const name = anon ? 'אנונימי' : String(r.name || 'תורם').trim().slice(0, 80);
    ins.run(req.c.id, amt, req.c.currency, name, String(r.dedication || '').slice(0, 300), anon, ref, months || 1, months ? 1 : 0, crypto.randomBytes(12).toString('hex'), dt, dt); added++; sum += amt;
  } })();
  ev(req, 'donation.import', { cid: req.c.id, msg: `${req.c.title}: ${added} תרומות · ₪${sum}${skipped ? ` · ${skipped} דולגו` : ''}` });
  res.json({ ok: true, added, skipped, sum, live: !isTest(req.c) });
});
app.get('/api/campaigns/:id/donations/:did', auth, own, (req, res) => { const d = db.prepare('SELECT d.*, t.name team FROM donations d LEFT JOIN teams t ON t.id=d.team_id WHERE d.id=? AND d.campaign_id=?').get(req.params.did, req.c.id); if (!d) return bad(res, 'not found', 404); res.json(d); });
function donUpdate(c, d, b, user) {
  if (b.status === 'paid' && d.status !== 'paid') { markPaid(d.id, { ref: b.ref || d.ref || 'manual', meta: { ...J(d.meta), manualBy: user.email, manualAt: new Date().toISOString(), verified: 1 } }); if (!b.note) b.note = `אושר ידנית על ידי ${user.email}`; delete b.status; }
  const f = {};
  if (b.name !== undefined) f.name = String(b.name).trim().slice(0, 80) || 'תורם';
  if (b.amount !== undefined && +b.amount > 0) f.amount = Math.round(+b.amount);
  for (const [k, n] of [['phone', 20], ['email', 120], ['dedication', 300], ['ref', 80], ['note', 300], ['id_number', 12]]) if (b[k] !== undefined) f[k] = String(b[k] ?? '').trim().slice(0, n);
  if (b.anonymous !== undefined) f.anonymous = b.anonymous ? 1 : 0;
  if (b.team_id !== undefined) f.team_id = +b.team_id && db.prepare('SELECT 1 FROM teams WHERE id=? AND campaign_id=?').get(+b.team_id, c.id) ? +b.team_id : null;
  if (b.status !== undefined && ['paid', 'pending', 'failed', 'refunded', 'cancelled'].includes(b.status)) f.status = b.status;
  if (b.kind !== undefined) { const n = Math.min(120, Math.max(1, Math.round(+b.months || 1))); if (b.kind === 'monthly') { f.monthly = 1; f.installments = Math.max(2, n); } else if (b.kind === 'installments') { f.monthly = 0; f.installments = Math.max(2, n); } else { f.monthly = 0; f.installments = 1; } }
  if (b.date !== undefined && b.date) { const u = ilToUtc(b.date); if (u) { f.paid_at = u; } }
  const keys = Object.keys(f); if (keys.length) db.prepare(`UPDATE donations SET ${keys.map(k => k + '=@' + k).join(',')} WHERE id=@id`).run({ ...f, id: d.id });
}
app.patch('/api/campaigns/:id/donations/:did', auth, own, (req, res) => {
  const d = db.prepare('SELECT * FROM donations WHERE id=? AND campaign_id=?').get(req.params.did, req.c.id); if (!d) return bad(res, 'not found', 404);
  donUpdate(req.c, d, { ...(req.body || {}) }, req.user);
  emit(req.c.id, 'refresh', { stats: stats(req.c, d.test), teams: teamStats(req.c, d.test) }); res.json({ ok: true });
});
app.post('/api/campaigns/:id/donations/bulk', auth, own, (req, res) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Boolean).slice(0, 5000); const act = req.body?.action; const v = req.body?.value || {};
  if (!ids.length) return bad(res, 'לא נבחרו תרומות');
  const rows = db.prepare(`SELECT * FROM donations WHERE campaign_id=? AND id IN (${ids.map(() => '?').join(',')})`).all(req.c.id, ...ids); let n = 0;
  db.transaction(() => { for (const d of rows) {
    if (act === 'delete') db.prepare('DELETE FROM donations WHERE id=?').run(d.id);
    else if (act === 'team') donUpdate(req.c, d, { team_id: v.team_id }, req.user);
    else if (act === 'kind') donUpdate(req.c, d, { kind: v.kind, months: v.months }, req.user);
    else if (act === 'status') donUpdate(req.c, d, { status: v.status }, req.user);
    else if (act === 'anonymous') donUpdate(req.c, d, { anonymous: !!v.anonymous }, req.user);
    else continue; n++;
  } })();
  emit(req.c.id, 'refresh', { stats: stats(req.c, isTest(req.c)), teams: teamStats(req.c, isTest(req.c)) }); res.json({ ok: true, n });
});

app.delete('/api/campaigns/:id/donations/:did', auth, own, (req, res) => { const d = db.prepare('SELECT test FROM donations WHERE id=? AND campaign_id=?').get(req.params.did, req.c.id); db.prepare('DELETE FROM donations WHERE id=? AND campaign_id=?').run(req.params.did, req.c.id); if (d) emit(req.c.id, 'refresh', { stats: stats(req.c, d.test), teams: teamStats(req.c, d.test) }); res.json({ ok: true }); });
app.post('/api/campaigns/:id/clear-test', auth, own, (req, res) => { db.prepare('DELETE FROM donations WHERE campaign_id=? AND test=1').run(req.c.id); emit(req.c.id, 'refresh', { stats: stats(req.c, true), teams: teamStats(req.c, true) }); res.json({ ok: true }); });
app.get('/api/providers', (_, res) => res.json(Object.entries(providers).filter(([k]) => !NO_MANUAL.includes(k)).map(([k, v]) => ({ type: k, label: v.label, fields: v.fields, manual: !!v.manual, wallets: v.wallets || [], noMonthly: !!v.noMonthly, unverified: ['tranzila', 'morning'].includes(k) }))));

// ---------- superadmin ----------
const adm = (req, res, next) => req.user.role === 'admin' ? next() : bad(res, 'auth', 403);
app.get('/api/admin/overview', auth, adm, (req, res) => res.json({
  users: db.prepare('SELECT id,email,name,org,org_number,org_name,org_verified,org_status,phone,role,created,role_title,address,city,website,s46,consent_at,marketing,email_verified,plan_until,blocked,block_note,last_seen,logins,(SELECT COUNT(*) FROM contracts WHERE user_id=users.id) contracts,(SELECT status FROM contracts WHERE user_id=users.id ORDER BY id DESC LIMIT 1) contract_status,(SELECT COUNT(*) FROM campaigns WHERE user_id=users.id) campaigns FROM users ORDER BY id DESC').all(),
  campaigns: db.prepare("SELECT c.id,c.slug,c.title,c.status,c.paid,c.user_id,c.settings,(SELECT COALESCE(SUM(n),0) FROM pv WHERE k='c:'||c.id AND day>=date('now','-6 day')) views7,u.plan_until,c.goal,c.multiplier,c.end_at,c.created,u.email owner,u.org_name, (SELECT COUNT(*) FROM donations d WHERE d.campaign_id=c.id AND d.status='paid' AND d.test=0) n, (SELECT COALESCE(SUM(amount),0) FROM donations d WHERE d.campaign_id=c.id AND d.status='paid' AND d.test=0) raised FROM campaigns c JOIN users u ON u.id=c.user_id ORDER BY c.id DESC").all().map(c => { const st = J(c.settings); return { ...c, settings: undefined, paused: !!st.adminPaused, providerOk: !!st.providerOk, msg: { email: (st.msg || {}).email !== false, wa: !!(st.msg || {}).wa, sms: !!(st.msg || {}).sms } }; }),
  totals: db.prepare("SELECT COUNT(*) donations, COALESCE(SUM(amount),0) raised FROM donations WHERE status='paid' AND test=0").get(),
  live: db.prepare("SELECT COUNT(*) c FROM campaigns WHERE status='live'").get().c,
  today: db.prepare("SELECT COUNT(*) n, COALESCE(SUM(amount),0) s FROM donations WHERE status='paid' AND test=0 AND date(paid_at)=date('now')").get(),
  daily: db.prepare("SELECT date(paid_at) d, COUNT(*) n, SUM(amount) s FROM donations WHERE status='paid' AND test=0 AND paid_at>=date('now','-30 day') GROUP BY d ORDER BY d").all()
}));
app.get('/api/admin/contracts', auth, adm, (_, res) => res.json(db.prepare("SELECT id,user_id,name,id_number,role_title,org,org_number,email,phone,sent,created,method,file,docs,status,review_note FROM contracts ORDER BY status='pending' DESC, id DESC").all().map(c => ({ ...c, docs: J(c.docs) }))));
app.post('/api/admin/users/:id/reset', auth, adm, (req, res) => { const pw = 'Ttm' + crypto.randomBytes(3).toString('hex') + '!'; db.prepare('UPDATE users SET pass=?, tv=COALESCE(tv,0)+1 WHERE id=?').run(hashPw(pw), req.params.id); ev(req, 'admin.reset_pw', { meta: { target: +req.params.id } }); res.json({ ok: true, password: pw }); });
app.get('/api/admin/mail', auth, adm, (_, res) => res.json({ enabled: mail.enabled(), from: process.env.MAIL_FROM || '' }));
app.post('/api/admin/mail/test', auth, adm, limit(5, 600000), async (req, res) => {
  const r = await mail.send({ to: req.user.email, subject: 'בדיקת מייל מ-GiveIL ✓', html: mail.layout('זה עובד 🎉', '<p>אם קיבלת את המייל הזה – מיילי התודה לתורמים ואיפוס הסיסמה פועלים.</p>'), text: 'זה עובד – מיילים מ-GiveIL פועלים.' }).catch(e => ({ ok: false, error: e.message }));
  ev(req, 'mail.test', { level: r.ok ? 'info' : 'error', msg: (r.ok ? 'נשלח ל-' : 'נכשל: ') + (r.ok ? req.user.email : (r.error || JSON.stringify(r).slice(0, 200))) });
  res.json({ ok: !!r.ok, to: req.user.email, error: r.ok ? '' : (r.error || r.body || 'שליחה נכשלה') });
});
app.patch('/api/admin/users/:id', auth, adm, (req, res) => {
  if (req.body?.email_verified !== undefined) db.prepare('UPDATE users SET email_verified=? WHERE id=?').run(req.body.email_verified ? 1 : 0, req.params.id); const b = req.body || {}; db.prepare("UPDATE users SET role=COALESCE(?,role), org_verified=COALESCE(?,org_verified), org_status=CASE WHEN ? IS NULL THEN org_status ELSE 'אומת ידנית' END, org_name=COALESCE(?,org_name) WHERE id=?").run(b.role || null, b.org_verified ?? null, b.org_verified ?? null, b.org_name || null, req.params.id); res.json({ ok: true }); });
app.delete('/api/admin/users/:id', auth, adm, (req, res) => { if (+req.params.id === req.user.id) return bad(res, 'self'); db.prepare('DELETE FROM users WHERE id=?').run(req.params.id); res.json({ ok: true }); });
app.post('/api/admin/campaigns/:id/status', auth, adm, (req, res) => { const st = ['draft', 'test', 'live', 'ended'].includes(req.body?.status) ? req.body.status : 'draft'; db.prepare('UPDATE campaigns SET status=? WHERE id=?').run(st, req.params.id); ev(req, 'admin.campaign_status', { cid: +req.params.id, msg: '→ ' + st }); res.json({ ok: true }); });

// ---------- superadmin: live control room ----------
db.exec("CREATE TABLE IF NOT EXISTS pv(day TEXT, k TEXT, n INTEGER DEFAULT 0, PRIMARY KEY(day,k))");
const PV = db.prepare("INSERT INTO pv(day,k,n) VALUES(date('now'),?,1) ON CONFLICT(day,k) DO UPDATE SET n=n+1");
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|curl|wget|python|headless|lighthouse/i;
const pageView = (req, k) => { if (!BOT.test(req.get('user-agent') || '')) try { PV.run(k); } catch { } };
const BOOT = Date.now();
const BK_DIR = path.join(DATA_DIR, 'backups'); try { fs.mkdirSync(BK_DIR, { recursive: true }); } catch { }
async function backupDb(kind) {
  const f = path.join(BK_DIR, `${kind}-${new Date().toISOString().slice(0, kind === 'daily' ? 10 : 13).replace(/[:T]/g, '-')}.db`);
  if (fs.existsSync(f)) return; const t0 = Date.now();
  try { await db.backup(f); const keep = kind === 'daily' ? 30 : 48; const old = fs.readdirSync(BK_DIR).filter(x => x.startsWith(kind + '-')).sort(); for (const x of old.slice(0, Math.max(0, old.length - keep))) fs.unlinkSync(path.join(BK_DIR, x)); logEvent('backup', { msg: `${kind} · ${Math.round(fs.statSync(f).size / 1024)}KB · ${Date.now() - t0}ms` }); }
  catch (e) { logEvent('backup.error', { level: 'error', msg: String(e.message).slice(0, 200) }); }
}
setTimeout(() => backupDb('hourly'), 60e3).unref(); setInterval(() => { backupDb('hourly'); backupDb('daily'); }, 30 * 60e3).unref();
let sizeCache = { at: 0 };
function dirSize(d) { let n = 0, f = 0; try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { const r = dirSize(p); n += r.n; f += r.f; } else { n += fs.statSync(p).size; f++; } } } catch { } return { n, f }; }
function sizes() { if (Date.now() - sizeCache.at < 10 * 60e3) return sizeCache; const fsz = f => { try { return fs.statSync(f).size; } catch { return 0; } }; const db0 = path.join(DATA_DIR, 'givex.db'); sizeCache = { at: Date.now(), db: fsz(db0) + fsz(db0 + '-wal'), uploads: dirSize(path.join(DATA_DIR, 'uploads')), priv: dirSize(privDir) }; return sizeCache; }
const evRows = (where, params, lim) => db.prepare(`SELECT e.*, u.email, u.name uname, c.title ctitle, c.slug cslug FROM events e LEFT JOIN users u ON u.id=e.user_id LEFT JOIN campaigns c ON c.id=e.campaign_id ${where} ORDER BY e.id DESC LIMIT ?`).all(...params, lim).map(r => ({ ...r, meta: J(r.meta) }));
app.get('/api/admin/live', auth, adm, (req, res) => {
  const q1 = (sql, ...p) => db.prepare(sql).get(...p);
  const m = process.memoryUsage(); const z = sizes();
  const viewers = []; for (const [cid, set] of subs) if (set.size) { const c = db.prepare('SELECT id,title,slug,status FROM campaigns WHERE id=?').get(cid); if (c) viewers.push({ ...c, n: set.size }); }
  viewers.sort((a, b) => b.n - a.n);
  const dayCount = (type, mod = "'-0 day'") => q1(`SELECT COUNT(*) n FROM events WHERE type=? AND at>=datetime('now','start of day')`, type).n;
  res.json({
    now: new Date().toISOString(),
    health: { uptime: Math.round((Date.now() - BOOT) / 1000), rss: m.rss, heap: m.heapUsed, node: process.version, db: z.db, uploads: z.uploads, priv: z.priv, commit: (process.env.RAILWAY_GIT_COMMIT_SHA || '').slice(0, 7), backups: (() => { try { const l = fs.readdirSync(BK_DIR).sort(); return { n: l.length, last: l.filter(x => x.startsWith('hourly')).pop() || '' }; } catch { return { n: 0, last: '' }; } })(), mail: mail.enabled(), sse: [...subs.values()].reduce((a, s) => a + s.size, 0) },
    today: {
      signups: dayCount('user.signup'), logins: dayCount('auth.login'), failed: dayCount('auth.fail'), created: dayCount('campaign.create'),
      donations: q1("SELECT COUNT(*) n, COALESCE(SUM(amount),0) s FROM donations WHERE status='paid' AND test=0 AND paid_at>=datetime('now','start of day')"),
      pending: q1("SELECT COUNT(*) n FROM donations WHERE status='pending' AND test=0 AND created>=datetime('now','start of day')").n,
      recovered: q1("SELECT COUNT(*) n, COALESCE(SUM(amount),0) s FROM donations WHERE status='paid' AND test=0 AND resumed_from IS NOT NULL AND paid_at>=datetime('now','start of day')"),
      failedPay: q1("SELECT COUNT(*) n FROM donations WHERE status='failed' AND test=0 AND created>=datetime('now','start of day')").n,
      views: db.prepare("SELECT k, n FROM pv WHERE day=date('now') ORDER BY n DESC").all(),
      errors: q1("SELECT COUNT(*) n FROM events WHERE level='error' AND at>=datetime('now','-1 day')").n,
      warns: q1("SELECT COUNT(*) n FROM events WHERE level='warn' AND at>=datetime('now','-1 day')").n
    },
    ads: (() => { const since = '2026-11-21'; const pv = k => q1("SELECT COALESCE(SUM(n),0) n FROM pv WHERE k=? AND day>=?", k, since).n; const users = db.prepare("SELECT user_id FROM events WHERE type='user.signup' AND json_extract(meta,'$.src')='ads' AND at>=?").all(since).map(r => r.user_id).filter(Boolean); const inList = users.length ? users.join(',') : '0'; return { since, visits: pv('ads:visit'), signups: pv('ads:signup'), campaigns: q1(`SELECT COUNT(*) n FROM campaigns WHERE user_id IN (${inList})`).n, live: q1(`SELECT COUNT(*) n FROM campaigns WHERE status IN ('live','ended') AND user_id IN (${inList})`).n, list: db.prepare(`SELECT u.email, COALESCE(u.org_name,u.org) org, u.created FROM users u WHERE u.id IN (${inList}) ORDER BY u.id DESC LIMIT 20`).all() }; })(),
    views7: db.prepare("SELECT day, SUM(n) n FROM pv WHERE day>=date('now','-13 day') AND k NOT LIKE 'src:%' AND k NOT LIKE 'ads:%' GROUP BY day ORDER BY day").all(),
    sources: db.prepare("SELECT substr(k,5) src, SUM(n) n, SUM(CASE WHEN day=date('now') THEN n ELSE 0 END) today FROM pv WHERE k LIKE 'src:%' AND k!='src:internal' AND day>=date('now','-13 day') GROUP BY k ORDER BY n DESC LIMIT 15").all(),
    homeToday: (db.prepare("SELECT COALESCE(SUM(n),0) n FROM pv WHERE k='home' AND day=date('now')").get() || {}).n,
    online: db.prepare("SELECT id,email,name,org_name,org,role,last_seen,last_ip FROM users WHERE last_seen>=datetime('now','-15 minute') ORDER BY last_seen DESC LIMIT 50").all(),
    viewers,
    todo: {
      contracts: q1("SELECT COUNT(*) n FROM contracts WHERE status='pending'").n,
      payments: q1("SELECT COUNT(*) n FROM payments WHERE status='pending'").n,
      providers: db.prepare("SELECT settings FROM campaigns WHERE settings LIKE '%providerReview%'").all().filter(r => { const st = J(r.settings); return st.providerReview?.status === 'pending'; }).length,
      orgs: q1("SELECT COUNT(*) n FROM users WHERE org_verified=2").n,
      mails: q1("SELECT COUNT(*) n FROM users WHERE email_verified=0 AND role!='admin' AND created>=datetime('now','-14 day')").n,
      liveUnpaid: q1("SELECT COUNT(*) n FROM campaigns c JOIN users u ON u.id=c.user_id WHERE c.status='live' AND c.paid=0 AND (u.plan_until='' OR u.plan_until<date('now'))").n,
      endingSoon: db.prepare("SELECT id,title,slug,end_at FROM campaigns WHERE status='live' AND end_at!='' AND end_at<=strftime('%Y-%m-%dT%H:%M','now','+2 day') ORDER BY end_at LIMIT 10").all()
    },
    alerts: evRows("WHERE e.level IN ('error','warn')", [], 12),
    feed: evRows("WHERE e.type NOT IN ('donation.test')", [], 40)
  });
});
app.get('/api/admin/events', auth, adm, (req, res) => {
  const w = [], p = []; const Q = req.query;
  if (Q.type) { const t = String(Q.type); if (t.endsWith('.')) { w.push('e.type LIKE ?'); p.push(t + '%'); } else { w.push('e.type=?'); p.push(t); } }
  if (['info', 'warn', 'error'].includes(Q.level)) { w.push('e.level=?'); p.push(Q.level); }
  if (+Q.uid) { w.push('e.user_id=?'); p.push(+Q.uid); }
  if (+Q.cid) { w.push('e.campaign_id=?'); p.push(+Q.cid); }
  if (+Q.before) { w.push('e.id<?'); p.push(+Q.before); }
  if (Q.q) { const s = '%' + String(Q.q).slice(0, 60) + '%'; w.push('(e.msg LIKE ? OR e.ip LIKE ? OR u.email LIKE ? OR c.title LIKE ?)'); p.push(s, s, s, s); }
  if (Q.hideTest !== '0') w.push("e.type!='donation.test'");
  res.json(evRows(w.length ? 'WHERE ' + w.join(' AND ') : '', p, Math.min(500, +Q.limit || 100)));
});
app.get('/api/admin/search', auth, adm, (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60); if (q.length < 2) return res.json({ users: [], campaigns: [], donations: [] });
  const s = '%' + q + '%', dg = q.replace(/\D/g, ''), ds = dg.length >= 4 ? '%' + dg + '%' : '@@none@@';
  res.json({
    users: db.prepare("SELECT id,email,name,phone,org,org_name,org_number,org_verified,blocked,last_seen,role FROM users WHERE email LIKE ? OR name LIKE ? OR org LIKE ? OR org_name LIKE ? OR phone LIKE ? OR org_number LIKE ? OR id=? ORDER BY id DESC LIMIT 15").all(s, s, s, s, ds, ds, +q || -1),
    campaigns: db.prepare("SELECT c.id,c.title,c.slug,c.status,c.settings,u.org_name,u.email FROM campaigns c LEFT JOIN users u ON u.id=c.user_id WHERE c.title LIKE ? OR c.slug LIKE ? OR c.id=? ORDER BY c.id DESC LIMIT 15").all(s, s, +q || -1).map(c => ({ ...c, paused: !!J(c.settings).adminPaused, settings: undefined })),
    donations: db.prepare("SELECT d.id,d.campaign_id,d.name,d.amount,d.status,d.test,d.phone,d.email,d.ref,d.created,d.paid_at,d.monthly,d.installments,c.title FROM donations d JOIN campaigns c ON c.id=d.campaign_id WHERE d.name LIKE ? OR d.email LIKE ? OR d.ref LIKE ? OR d.phone LIKE ? OR d.id_number LIKE ? OR d.id=? ORDER BY d.id DESC LIMIT 25").all(s, s, s, ds, ds, +q || -1)
  });
});
app.get('/api/admin/donations', auth, adm, (req, res) => {
  const w = ['d.test=?'], p = [req.query.test === '1' ? 1 : 0]; const Q = req.query;
  if (['paid', 'pending', 'failed'].includes(Q.status)) { w.push('d.status=?'); p.push(Q.status); }
  if (+Q.cid) { w.push('d.campaign_id=?'); p.push(+Q.cid); }
  if (+Q.before) { w.push('d.id<?'); p.push(+Q.before); }
  res.json(db.prepare(`SELECT d.id,d.campaign_id,d.name,d.amount,d.status,d.test,d.phone,d.email,d.ref,d.provider,d.created,d.paid_at,d.monthly,d.installments,d.anonymous,d.meta,c.title,c.slug FROM donations d JOIN campaigns c ON c.id=d.campaign_id WHERE ${w.join(' AND ')} ORDER BY d.id DESC LIMIT ?`).all(...p, Math.min(300, +Q.limit || 100)).map(d => ({ ...d, error: J(d.meta).error || '', meta: undefined })));
});
app.get('/api/admin/users/:id', auth, adm, (req, res) => {
  const u = db.prepare('SELECT id,email,name,phone,org,org_name,org_number,org_verified,org_status,role,role_title,city,website,created,email_verified,plan_until,blocked,block_note,last_seen,last_ip,logins,price_campaign,price_monthly FROM users WHERE id=?').get(req.params.id); if (!u) return bad(res, 'not found', 404);
  res.json({ user: u, base: pricing(), campaigns: db.prepare("SELECT c.id,c.title,c.slug,c.status,c.paid,(SELECT COUNT(*) FROM donations d WHERE d.campaign_id=c.id AND d.status='paid' AND d.test=0) n,(SELECT COALESCE(SUM(amount),0) FROM donations d WHERE d.campaign_id=c.id AND d.status='paid' AND d.test=0) raised FROM campaigns c WHERE c.user_id=? ORDER BY c.id DESC").all(u.id), payments: db.prepare('SELECT id,kind,amount,status,created FROM payments WHERE user_id=? ORDER BY id DESC LIMIT 20').all(u.id), contracts: db.prepare('SELECT id,status,created,method FROM contracts WHERE user_id=? ORDER BY id DESC LIMIT 5').all(u.id), events: evRows('WHERE e.user_id=?', [u.id], 60) });
});
app.post('/api/admin/users/:id/block', auth, adm, (req, res) => {
  const id = +req.params.id; if (id === req.user.id) return bad(res, 'אי אפשר להשעות את עצמכם');
  const on = !!req.body?.blocked; const note = String(req.body?.note || '').slice(0, 300);
  db.prepare('UPDATE users SET blocked=?, block_note=?, tv=COALESCE(tv,0)+1 WHERE id=?').run(on ? 1 : 0, note, id); // tv bump signs them out everywhere
  ev(req, on ? 'admin.block' : 'admin.unblock', { level: on ? 'warn' : 'info', msg: note, meta: { target: id } }); res.json({ ok: true });
});
app.post('/api/admin/campaigns/:id/channels', auth, adm, (req, res) => {
  const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(req.params.id); if (!c) return bad(res, 'not found', 404);
  const st = J(c.settings); const b = req.body || {}; st.msg = { email: b.email !== false, wa: !!b.wa, sms: !!b.sms }; db.prepare('UPDATE campaigns SET settings=? WHERE id=?').run(JSON.stringify(st), c.id);
  ev(req, 'admin.channels', { cid: c.id, msg: `${c.title}: ${['email', 'wa', 'sms'].filter(k => st.msg[k]).join(', ') || 'הכול סגור'}` }); res.json({ ok: true, msg: st.msg });
});
app.post('/api/admin/campaigns/:id/pause', auth, adm, (req, res) => {
  const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(req.params.id); if (!c) return bad(res, 'not found', 404);
  const st = J(c.settings); st.adminPaused = !!req.body?.paused; db.prepare('UPDATE campaigns SET settings=? WHERE id=?').run(JSON.stringify(st), c.id);
  emit(c.id, 'refresh', { stats: stats(c, isTest(c)), teams: teamStats(c, isTest(c)) });
  ev(req, st.adminPaused ? 'admin.pause' : 'admin.resume', { level: 'warn', cid: c.id, msg: c.title }); res.json({ ok: true, paused: st.adminPaused });
});
app.post('/api/admin/users/:id/impersonate', auth, adm, (req, res) => {
  if (req.user.imp) return bad(res, 'כבר במצב צפייה כמשתמש');
  const u = db.prepare('SELECT id,email,role,blocked FROM users WHERE id=?').get(req.params.id); if (!u) return bad(res, 'not found', 404); if (u.role === 'admin') return bad(res, 'לא נכנסים כמנהל אחר');
  ev(req, 'admin.impersonate', { level: 'warn', msg: u.email, meta: { target: u.id } });
  const s = verify(req.cookies.sid); res.cookie('sid_adm', req.cookies.sid, { httpOnly: true, sameSite: 'lax', maxAge: 4 * 36e5, secure: !!process.env.RAILWAY_ENVIRONMENT });
  setSid(res, u.id, { imp: req.user.id, exp: Date.now() + 4 * 36e5 }); res.json({ ok: true });
});
app.post('/api/impersonate/stop', (req, res) => {
  const a = verify(req.cookies.sid_adm); const me = verify(req.cookies.sid);
  if (!a || !me?.imp || a.uid !== me.imp) return bad(res, 'no');
  res.cookie('sid', req.cookies.sid_adm, { httpOnly: true, sameSite: 'lax', maxAge: 90 * 864e5, secure: !!process.env.RAILWAY_ENVIRONMENT }); res.clearCookie('sid_adm'); res.json({ ok: true });
});
// ---------- public campaign API ----------
const getC = slug => db.prepare('SELECT * FROM campaigns WHERE slug=?').get(slug);
app.get('/api/c/:slug', (req, res) => {
  const c = getC(req.params.slug); if (!c) return bad(res, 'not found', 404);
  const test = isTest(c); const s = J(c.settings); const paused = !!s.adminPaused; for (const k of ADMIN_KEYS) delete s[k];
  const t = req.query.team ? db.prepare('SELECT id,slug,name,goal,photo,descr FROM teams WHERE campaign_id=? AND slug=?').get(c.id, req.query.team) : null;
  res.json({
    campaign: { closed: (!isTest(c) && (PV_(c.provider).type || 'test') === 'test') || paused || isEnded(c), paused, ended: isEnded(c), payMethods: payMethods(c), updates: db.prepare('SELECT id,title,body,image,created FROM updates WHERE campaign_id=? ORDER BY id DESC LIMIT 20').all(c.id), id: c.id, slug: c.slug, title: c.title, subtitle: c.subtitle, story: c.story, goal: c.goal, bonus_goal: c.bonus_goal, currency: c.currency, multiplier: c.multiplier, start_at: c.start_at, end_at: c.end_at, status: c.status, cover: c.cover, logo: c.logo, video: c.video, color: c.color, lang: c.lang, settings: s, test, providerType: PV_(c.provider).type || 'test', noMonthly: !isTest(c) && !!providers[PV_(c.provider).type || 'test']?.noMonthly },
    levels: db.prepare('SELECT id,name,amount,descr,stock,icon,monthly,months,(SELECT COUNT(*) FROM donations WHERE level_id=levels.id AND status=\'paid\' AND test=?) used FROM levels WHERE campaign_id=? ORDER BY pos,id').all(test ? 1 : 0, c.id),
    teams: teamStats(c, test), team: t, matchers: db.prepare('SELECT name,logo FROM matchers WHERE campaign_id=? ORDER BY pos,id').all(c.id),
    stats: stats(c, test),
    donations: db.prepare("SELECT * FROM donations WHERE campaign_id=? AND status='paid' AND test=? ORDER BY paid_at DESC, id DESC LIMIT 60").all(c.id, test ? 1 : 0).map(publicDonation)
  });
});
app.get('/api/c/:slug/donations', (req, res) => { const c = getC(req.params.slug); if (!c) return bad(res, 'not found', 404); const off = +req.query.offset || 0; const team = +req.query.team || 0; const q = String(req.query.q || '').slice(0, 60); const p = [c.id, isTest(c) ? 1 : 0]; let w = ''; if (team) { w += ' AND team_id=?'; p.push(team); } if (q) { w += " AND anonymous=0 AND (name LIKE ? OR dedication LIKE ?)"; p.push('%' + q + '%', '%' + q + '%'); } p.push(off); res.json(db.prepare(`SELECT * FROM donations WHERE campaign_id=? AND status='paid' AND test=?${w} ORDER BY ${req.query.sort === 'top' ? 'amount DESC, id DESC' : 'paid_at DESC, id DESC'} LIMIT 60 OFFSET ?`).all(...p).map(publicDonation)); });
app.get('/api/c/:slug/stream', (req, res) => {
  const c = getC(req.params.slug); if (!c) return res.status(404).end();
  const ipN = sseIp.get(req.ip) || 0; if (ipN >= 1500) return res.status(429).end(); sseIp.set(req.ip, ipN + 1);
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' }); res.write(':ok\n\n');
  if (!subs.has(c.id)) subs.set(c.id, new Set()); res.__ip = req.ip; subs.get(c.id).add(res); viewersSoon(c.id);
  const ping = setInterval(() => { try { res.write(':p\n\n'); } catch { } }, 25000);
  req.on('close', () => { clearInterval(ping); subs.get(c.id)?.delete(res); viewersSoon(c.id); const n = (sseIp.get(req.ip) || 1) - 1; if (n > 0) sseIp.set(req.ip, n); else sseIp.delete(req.ip); });
});
// live "people viewing now" (unique IPs on the campaign stream), throttled
const viewerTimers = new Map();
function viewersSoon(cid) {
  if (viewerTimers.has(cid)) return;
  viewerTimers.set(cid, setTimeout(() => { viewerTimers.delete(cid); const set = subs.get(cid); if (!set) return; const n = new Set([...set].map(r => r.__ip)).size; emit(cid, 'viewers', { n }); }, 3000));
}
app.post('/api/c/:slug/donate', limit(600, 60000), async (req, res) => {
  const c = getC(req.params.slug); if (!c) return bad(res, 'not found', 404);
  if (isEnded(c)) return bad(res, 'הקמפיין הסתיים – תודה לכל מי שתרם!');
  const s = J(c.settings); const b = req.body || {};
  if (s.adminPaused) return bad(res, 'התרומות בקמפיין מושהות זמנית');
  const amount = Math.round(+b.amount || 0); if (amount < (s.minAmount || 1)) return bad(res, `סכום מינימלי ₪${s.minAmount || 1}`); if (amount > 5000000) return bad(res, 'סכום גבוה מדי');
  const name = String(b.name || '').trim().slice(0, 80); if (name.length < 2) return bad(res, 'נא להזין שם');
  const phone = String(b.phone || '').replace(/[^\d+]/g, '').slice(0, 20); const email = String(b.email || '').trim().slice(0, 120);
  if (phone.replace(/\D/g, '').length < 9 && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad(res, 'נא להזין טלפון או אימייל');
  const level = b.level_id ? db.prepare('SELECT * FROM levels WHERE id=? AND campaign_id=?').get(b.level_id, c.id) : null;
  if (level && level.stock > 0) { const used = db.prepare("SELECT COUNT(*) n FROM donations WHERE level_id=? AND status='paid' AND test=?").get(level.id, isTest(c) ? 1 : 0).n; if (used >= level.stock) return bad(res, 'הרמה הזו אזלה'); }
  if (level && !level.monthly && amount < level.amount) return bad(res, `הסכום ברמה הזו הוא לפחות ₪${level.amount}`);
  const team = b.team_id ? db.prepare('SELECT id FROM teams WHERE id=? AND campaign_id=?').get(b.team_id, c.id) : null;
  const prov = PV_(c.provider); const method = ['card', 'bit', 'paybox', 'applepay', 'googlepay'].includes(b.method) ? b.method : 'card';
  const type = isTest(c) ? 'test' : (prov.type || 'test'); const cfg = prov;
  if (!isTest(c) && type === 'test') return bad(res, 'התרומות בקמפיין זה סגורות');
  const P = providers[type]; if (!P) return bad(res, 'ספק סליקה לא מוגדר');
  let inst = Math.min(Math.max(1, +b.installments || 1), (s.installments === undefined || s.installments === '' ? 12 : +s.installments) || 1);
  // monthly quick button: the donor pledges amount × months; the processor charges `amount` every month for `months` months
  let finalAmount = amount, isMonthly = !!(b.monthly || (level && level.monthly)) && s.allowMonthly !== false;
  if (level && level.monthly) { inst = Math.max(1, +level.months || 12); finalAmount = level.amount * inst; isMonthly = true; }
  else if (isMonthly) { inst = Math.min(Math.max(1, +b.months || 12), 120); finalAmount = amount * inst; }
  if (finalAmount > 20000000) return bad(res, 'סכום גבוה מדי');
  if (isMonthly && !isTest(c) && providers[PV_(c.provider).type || 'test']?.noMonthly) return bad(res, 'הוראת קבע עדיין לא נתמכת בספק הסליקה של הקמפיין – אפשר לתרום חד-פעמי או בתשלומים');
  const resumed = b.resume ? db.prepare("SELECT id FROM donations WHERE token=? AND campaign_id=? AND status IN ('pending','failed')").get(String(b.resume), c.id) : null;
  const token = crypto.randomBytes(16).toString('hex');
  if (s.idField === 'required') { const z = String(b.id_number || '').replace(/\D/g, ''); if (z.length < 8 || z.length > 9) return bad(res, 'נא להזין מספר תעודת זהות תקין'); }
  const r = db.prepare('INSERT INTO donations(campaign_id,team_id,level_id,amount,currency,name,phone,email,id_number,dedication,anonymous,status,test,provider,installments,monthly,token) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(c.id, team ? team.id : null, level ? level.id : null, finalAmount, c.currency, name, phone, email, String(b.id_number || '').replace(/\D/g, '').slice(0, 9), String(b.dedication || '').slice(0, 300), b.anonymous && s.allowAnon !== false ? 1 : 0, 'pending', isTest(c) ? 1 : 0, type, inst, isMonthly ? 1 : 0, token);
  if (resumed) db.prepare('UPDATE donations SET resumed_from=? WHERE id=?').run(resumed.id, r.lastInsertRowid);
  const donation = db.prepare('SELECT * FROM donations WHERE id=?').get(r.lastInsertRowid);
  try {
    const out = await P.start({ base: base(req), donation, campaign: c, cfg, method });
    if (method !== 'card') db.prepare('UPDATE donations SET meta=? WHERE id=?').run(JSON.stringify({ method }), donation.id);
    if (out.ref) db.prepare('UPDATE donations SET ref=? WHERE id=?').run(String(out.ref), donation.id);
    res.json({ ...out, donationId: donation.id, token, returnUrl: `${base(req)}/pay/return/${token}` });
  } catch (e) { db.prepare("UPDATE donations SET status='failed', meta=? WHERE id=?").run(JSON.stringify({ error: e.message }), donation.id); logEvent('payment.error', { level: 'error', cid: c.id, ip: req.ip, msg: `${c.title} · ${type}: ${e.message}`.slice(0, 300) }); bad(res, 'שגיאה בחיבור לספק הסליקה: ' + e.message, 502); }
});
app.post('/api/c/:slug/join', limit(40, 600000), (req, res) => {
  const c = getC(req.params.slug); if (!c) return bad(res, 'not found', 404); const s = J(c.settings); if (s.allowJoin === false || isEnded(c)) return bad(res, 'ההצטרפות סגורה');
  const b = req.body || {}; const name = String(b.name || '').trim().slice(0, 80); const phone = String(b.phone || '').replace(/[^\d+]/g, '').slice(0, 20);
  if (name.length < 2) return bad(res, 'נא להזין שם'); if (phone.replace(/\D/g, '').length < 9) return bad(res, 'נא להזין טלפון תקין');
  if (db.prepare('SELECT 1 FROM teams WHERE campaign_id=? AND phone=?').get(c.id, phone)) { const t = db.prepare('SELECT * FROM teams WHERE campaign_id=? AND phone=?').get(c.id, phone); return res.json({ ok: true, slug: t.slug, existed: true, area: `/c/${c.slug}/${t.slug}` }); }
  const nt = newTeam(c, { name, phone, email: String(b.email || '').trim().slice(0, 120), goal: b.goal, descr: String(b.descr || '').slice(0, 300) }); const slug = nt.slug; welcomeAmbassador(c, nt).catch(() => { });
  const em = String(b.email || '').trim().toLowerCase(); if (mail.enabled() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { try { const { subject, html } = renderMail(c, 'ambassador', { name, amount: 0, email: em, link: '/c/' + c.slug + '/' + slug }, base(req)); mail.send({ to: em, subject, html }).catch(() => { }); } catch { } }
  emit(c.id, 'refresh', { stats: stats(c, isTest(c)), teams: teamStats(c, isTest(c)) }); logEvent('team.join', { cid: c.id, ip: req.ip, msg: `${name} הצטרף/ה כשגריר/ה · ${c.title}` });
  res.json({ ok: true, slug, area: `/c/${c.slug}/${slug}` });
});
app.get('/api/public/campaigns', (_, res) => {
  const rows = db.prepare("SELECT * FROM campaigns WHERE status IN ('live','ended') OR (status='test' AND settings LIKE '%\"demo\":true%') ORDER BY status='live' DESC, id DESC LIMIT 30").all().map(c => ({ c, e: isEnded(c) })).sort((a, b) => a.e - b.e).slice(0, 9).map(x => x.c);
  res.json(rows.map(c => { const st = stats(c, isTest(c)); const s = J(c.settings); return { slug: c.slug, title: c.title, subtitle: c.subtitle, cover: c.cover || (s.media?.default?.desktop || [])[0] || '', currency: c.currency, goal: c.goal, total: st.total, pct: st.pct, count: st.count, end_at: c.end_at, demo: !!s.demo, ended: isEnded(c), live: c.status === 'live' && !isEnded(c) }; }));
});
app.get('/api/d/:token', (req, res) => { const d = db.prepare('SELECT d.*, c.slug, c.title, c.settings FROM donations d JOIN campaigns c ON c.id=d.campaign_id WHERE d.token=?').get(req.params.token); if (!d) return bad(res, 'not found', 404); res.json({ id: d.id, status: d.status, amount: d.amount, currency: d.currency, name: d.name, slug: d.slug, title: d.title, thanks: J(d.settings).thanks, test: !!d.test, provider: d.provider }); });

// ---------- WhatsApp ambassador network ----------
// every donor is invited (WhatsApp + thank-you screen) to become an ambassador with one tap;
// every ambassador gets a personal campaign page (/c/<slug>/<team>) and a WhatsApp/email ping on each donation through them
for (const col of ["key TEXT DEFAULT ''", "from_donation INTEGER", "created TEXT DEFAULT ''", "visits INTEGER DEFAULT 0"]) { try { db.exec('ALTER TABLE teams ADD COLUMN ' + col); } catch { } }
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS t_key ON teams(key) WHERE key!=''"); } catch { }
const SITE = () => CANON;
const teamKey = t => { if (t.key) return t.key; const k = crypto.randomBytes(12).toString('base64url'); db.prepare('UPDATE teams SET key=? WHERE id=?').run(k, t.id); t.key = k; return k; };
const first = n => String(n || '').trim().split(/\s+/)[0] || '';
const nis = (n, c) => (c?.currency === 'USD' ? '$' : '₪') + Math.round(+n || 0).toLocaleString('he-IL');
const WA_T = {
  thanks: '{name}, תודה רבה! 💙\nתרומתך בסך {amount} ל{campaign} התקבלה.\n\nרוצים לעזור לנו להגיע ליעד? הצטרפו למערך השגרירים – בלחיצה אחת מקבלים קישור אישי, וכל תרומה דרכו נזקפת לזכותכם:\n{join}',
  welcome: 'ברוכים הבאים למערך השגרירים של {campaign} 🙌\n\nזה הקישור האישי שלכם – כל מי שתורם דרכו נספר לזכותכם:\n{link}\n\nבדף שלכם רואים את היעד, כמה גייסתם ומי תרם דרככם.',
  donation: '🎉 {donor} תרם/ה {amount} דרך הקישור שלכם!\nעד עכשיו גייסתם {raised}{ofgoal} מ-{count} תורמים.\n\nממשיכים? הקישור שלכם: {link}'
};
const waTpl = (c, k) => { const t = J(c.settings).waT || {}; return (t[k] && String(t[k]).trim()) || WA_T[k]; };
const waFill = (tpl, v) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => v[k] ?? '');
const waOn = c => J(c.settings).waFlow !== false && chAllowed(c, 'wa');
async function waSend(c, phone, text, kind) {
  const cfg = getKV('msg').wa || {}; const p = String(phone || '').replace(/[^\d+]/g, '');
  if (!cfg.type || p.replace(/\D/g, '').length < 9) return false;
  try { await sendSms(cfg, p, text); logEvent('wa.sent', { cid: c.id, msg: `${kind} → ${p.slice(0, 4)}…${p.slice(-3)}` }); return true; }
  catch (e) { logEvent('wa.error', { level: 'warn', cid: c.id, msg: `${kind}: ${e.message}`.slice(0, 200) }); return false; }
}
function teamProgress(t, test) { return db.prepare("SELECT COUNT(*) n, COALESCE(SUM(amount),0) s FROM donations WHERE team_id=? AND status='paid' AND test=?").get(t.id, test ? 1 : 0); }
async function ambassadorFlow(c, d) { // called after a donation is paid
  if (!waOn(c)) return;
  const pre = d.test ? '[בדיקה] ' : '';
  if (d.phone && J(c.settings).allowJoin !== false && !isEnded(c) && !db.prepare('SELECT 1 FROM teams WHERE campaign_id=? AND (phone=? OR from_donation=?)').get(c.id, d.phone, d.id))
    await waSend(c, d.phone, pre + waFill(waTpl(c, 'thanks'), { name: first(d.name), amount: nis(d.amount, c), campaign: c.title, join: `${SITE()}/j/${d.token}`, link: `${SITE()}/c/${c.slug}` }), 'תודה לתורם');
  if (d.team_id) {
    const t = db.prepare('SELECT * FROM teams WHERE id=?').get(d.team_id); if (!t) return;
    const p = teamProgress(t, d.test); const v = { donor: d.anonymous ? 'תורם/ת אנונימי/ת' : first(d.name), amount: nis(d.amount, c), raised: nis(p.s, c), ofgoal: t.goal ? ` מתוך ${nis(t.goal, c)}` : '', count: p.n, link: `${SITE()}/c/${c.slug}/${t.slug}`, area: `${SITE()}/c/${c.slug}/${t.slug}`, name: first(t.name), campaign: c.title };
    if (t.phone) await waSend(c, t.phone, pre + waFill(waTpl(c, 'donation'), v), 'עדכון לשגריר');
    if (t.email && mail.enabled() && !d.test) mail.send({ to: t.email, subject: `🎉 ${v.donor} תרם/ה ${v.amount} דרככם – ${c.title}`, html: mail.layout(`${v.donor} תרם/ה ${v.amount} דרככם! 🎉`, `<p>עד עכשיו גייסתם <b>${v.raised}</b>${v.ofgoal} מ-${v.count} תורמים.</p><p>הדף שלכם בקמפיין: <a href="${v.link}">${v.link}</a></p>`) }).catch(() => { });
  }
}
async function welcomeAmbassador(c, t) {
  const v = { name: first(t.name), campaign: c.title, link: `${SITE()}/c/${c.slug}/${t.slug}`, area: `${SITE()}/c/${c.slug}/${t.slug}` };
  if (t.phone && waOn(c)) await waSend(c, t.phone, waFill(waTpl(c, 'welcome'), v), 'ברוכים הבאים לשגריר');
}
function newTeam(c, { name, phone, email = '', goal = 0, descr = '', fromDonation = null }) {
  let slug = slugify(name); while (db.prepare('SELECT 1 FROM teams WHERE campaign_id=? AND slug=?').get(c.id, slug)) slug += crypto.randomBytes(1).toString('hex');
  const k = crypto.randomBytes(12).toString('base64url');
  const r = db.prepare("INSERT INTO teams(campaign_id,slug,name,goal,phone,email,descr,pos,key,from_donation,created) VALUES(?,?,?,?,?,?,?,99,?,?,datetime('now'))").run(c.id, slug, name, Math.max(0, +goal || 0), phone, email, descr, k, fromDonation);
  return db.prepare('SELECT * FROM teams WHERE id=?').get(r.lastInsertRowid);
}
// donor → ambassador in one tap (from the thank-you screen or the WhatsApp link)
app.post('/api/d/:token/ambassador', limit(10, 600000), (req, res) => {
  const d = db.prepare('SELECT * FROM donations WHERE token=?').get(req.params.token); if (!d) return bad(res, 'not found', 404);
  const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(d.campaign_id); if (!c) return bad(res, 'not found', 404);
  if (J(c.settings).allowJoin === false || isEnded(c)) return bad(res, 'ההצטרפות לשגרירים בקמפיין הזה סגורה');
  let t = db.prepare('SELECT * FROM teams WHERE campaign_id=? AND (from_donation=? OR (phone!=\'\' AND phone=?))').get(c.id, d.id, d.phone || '#');
  const name = String(req.body?.name || d.name || '').trim().slice(0, 80); if (name.length < 2) return bad(res, 'נא להזין שם');
  if (!t) { t = newTeam(c, { name, phone: d.phone || '', email: d.email || '', goal: Math.max(0, +req.body?.goal || 0), fromDonation: d.id }); emit(c.id, 'refresh', { stats: stats(c, isTest(c)), teams: teamStats(c, isTest(c)) }); logEvent('team.join', { cid: c.id, ip: req.ip, msg: `${name} – תורם/ת שהפך/ה לשגריר/ה · ${c.title}` }); welcomeAmbassador(c, t).catch(() => { }); }
  res.json({ ok: true, slug: t.slug, key: teamKey(t), link: `/c/${c.slug}/${t.slug}`, area: `/c/${c.slug}/${t.slug}` });
});
app.get('/r/:token', (req, res) => {
  const d = db.prepare('SELECT d.status, d.token, d.team_id, c.slug FROM donations d JOIN campaigns c ON c.id=d.campaign_id WHERE d.token=?').get(req.params.token); if (!d) return res.redirect('/');
  if (d.status === 'paid') return res.redirect(`/c/${d.slug}?thanks=${d.token}`);
  const t = d.team_id ? db.prepare('SELECT slug FROM teams WHERE id=?').get(d.team_id) : null;
  res.redirect(`/c/${d.slug}${t ? '/' + t.slug : ''}?resume=${d.token}`);
});
app.get('/api/resume/:token', (req, res) => {
  const d = db.prepare('SELECT * FROM donations WHERE token=?').get(req.params.token); if (!d || d.status === 'paid') return bad(res, 'not found', 404);
  res.json({ name: d.name, phone: d.phone, email: d.email, dedication: d.dedication, anonymous: !!d.anonymous, team_id: d.team_id, level_id: d.level_id, monthly: !!d.monthly, months: d.installments, amount: d.monthly && d.installments > 1 ? Math.round(d.amount / d.installments) : d.amount });
});
app.get('/a/:key', (req, res) => { const x = ambGet(req.params.key); res.redirect(x ? `/c/${encodeURIComponent(x.c.slug)}/${encodeURIComponent(x.t.slug)}` : '/'); });
app.get('/j/:token', (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex'); res.sendFile(pub('amb.html')); });
const ambGet = key => { const t = key && db.prepare('SELECT * FROM teams WHERE key=?').get(String(key)); if (!t) return null; const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(t.campaign_id); return c ? { t, c } : null; };
app.get('/api/amb/:key', (req, res) => {
  const x = ambGet(req.params.key); if (!x) return bad(res, 'not found', 404); const { t, c } = x; const test = isTest(c); const s = J(c.settings);
  const p = teamProgress(t, test); const all = teamStats(c, test); const rank = all.findIndex(a => a.id === t.id) + 1;
  const donors = db.prepare("SELECT name, anonymous, amount, dedication, paid_at FROM donations WHERE team_id=? AND status='paid' AND test=? ORDER BY id DESC LIMIT 200").all(t.id, test ? 1 : 0).map(d => ({ name: d.anonymous ? '' : d.name, amount: d.amount, dedication: d.dedication || '', at: d.paid_at }));
  res.json({ team: { name: t.name, slug: t.slug, goal: t.goal, descr: t.descr, phone: t.phone ? t.phone.slice(0, 3) + '•••' + t.phone.slice(-3) : '' }, campaign: { title: c.title, slug: c.slug, goal: c.goal, currency: c.currency, end_at: c.end_at, cover: c.cover || (s.media?.default?.desktop || [])[0] || '', color: c.color, ended: isEnded(c), test, stats: stats(c, test) }, me: { raised: p.s, count: p.n, rank, of: all.length }, top: all.slice(0, 5).map(a => ({ name: a.name, s: a.s, me: a.id === t.id })), donors, link: `${SITE()}/c/${c.slug}/${t.slug}`, waAuto: !!(getKV('msg').wa || {}).type && waOn(c) });
});
app.put('/api/amb/:key', limit(20, 600000), (req, res) => {
  const x = ambGet(req.params.key); if (!x) return bad(res, 'not found', 404); const b = req.body || {};
  const name = String(b.name ?? x.t.name).trim().slice(0, 80); if (name.length < 2) return bad(res, 'נא להזין שם');
  db.prepare('UPDATE teams SET name=?, goal=?, descr=? WHERE id=?').run(name, Math.max(0, Math.min(1e8, +b.goal || 0)), String(b.descr ?? x.t.descr).slice(0, 300), x.t.id);
  emit(x.c.id, 'refresh', { stats: stats(x.c, isTest(x.c)), teams: teamStats(x.c, isTest(x.c)) }); res.json({ ok: true });
});
app.get('/api/j/:token', (req, res) => { const d = db.prepare('SELECT d.name, d.amount, d.campaign_id, c.title, c.slug, c.settings, c.status, c.end_at, c.cover, c.color, c.currency FROM donations d JOIN campaigns c ON c.id=d.campaign_id WHERE d.token=?').get(req.params.token); if (!d) return bad(res, 'not found', 404); const c = { status: d.status, end_at: d.end_at }; res.json({ name: d.name, title: d.title, slug: d.slug, cover: d.cover, color: d.color, open: J(d.settings).allowJoin !== false && !isEnded(c) }); });
// ---------- payment pages & callbacks ----------
app.get('/pay/test/:token', (req, res) => res.sendFile(path.join(__dirname, 'public', 'paytest.html')));
app.post('/pay/test/:token', (req, res) => {
  const d = db.prepare('SELECT * FROM donations WHERE token=? AND test=1').get(req.params.token); if (!d) return bad(res, 'not found', 404);
  if (req.body?.result === 'fail') { db.prepare("UPDATE donations SET status='failed' WHERE id=?").run(d.id); return res.json({ ok: false }); }
  markPaid(d.id, { ref: 'TEST-' + d.id, meta: { simulated: true } }); res.json({ ok: true });
});
app.get('/pay/return/:token', (req, res) => { const d = db.prepare('SELECT d.*, c.slug FROM donations d JOIN campaigns c ON c.id=d.campaign_id WHERE d.token=?').get(req.params.token); if (!d) return res.redirect('/'); if (d.status === 'pending' && d.provider === 'link') { /* manual providers: keep pending, owner confirms */ } res.redirect(`/c/${d.slug}?thanks=${d.token}`); });
// ---------- generic hosted-page processors (lib/gateways.js) ----------
async function gwSettle(d, c, input, raw = '') {
  const cfg = PV_(c.provider); const P = providers[cfg.type]; if (!P?.gateway || P !== providers[d.provider] || d.status === 'paid') return d.status === 'paid';
  const r = await P.verify({ cfg, donation: d, input, rawQuery: raw });
  const note = n => n && db.prepare('UPDATE donations SET note=? WHERE id=?').run(String(n).slice(0, 300), d.id);
  if (r.state === 'failed') { db.prepare("UPDATE donations SET status='failed' WHERE id=? AND status='pending'").run(d.id); note(r.note); return false; }
  if (r.state !== 'paid') { note(r.note); return false; }
  const per = d.monthly && d.installments > 1 ? d.amount / d.installments : d.amount;
  if (r.amount !== undefined && r.amount !== null && r.amount !== '' && Math.abs(+r.amount - per) > 1) { note(`⚠ סכום לא תואם (${r.amount} מול ${per}) – לא נספר`); logEvent('pay.mismatch', { level: 'warn', cid: c.id, msg: `${cfg.type} תרומה #${d.id}: ${r.amount}≠${per}` }); return false; }
  markPaid(d.id, { ref: r.ref || '', meta: { ...(r.meta || {}), gateway: cfg.type, verified: r.verified ? 1 : 0 } });
  if (r.verified) db.prepare("UPDATE donations SET note='' WHERE id=?").run(d.id);
  if (!r.verified) { note(r.note || 'לא אומת מול הספק – בדקו שהתשלום התקבל'); logEvent('pay.unverified', { level: 'warn', cid: c.id, msg: `${providers[cfg.type].label}: תרומה #${d.id} נספרה בלי אימות שרת` }); }
  return true;
}
const gwFind = (type, token) => db.prepare('SELECT d.*, c.slug FROM donations d JOIN campaigns c ON c.id=d.campaign_id WHERE d.token=? AND d.provider=?').get(String(token), String(type));
app.all('/pay/g/:type/return/:token', limit(60, 60000), async (req, res) => {
  const d = gwFind(req.params.type, req.params.token); if (!d) return res.redirect('/');
  const raw = (req.originalUrl.split('?')[1] || '');
  try { const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(d.campaign_id); await gwSettle(d, c, { ...req.query, ...(req.body || {}) }, raw); } catch (e) { logEvent('pay.error', { level: 'error', cid: d.campaign_id, msg: `${req.params.type} return: ${e.message}` }); }
  res.redirect(`/c/${d.slug}?thanks=${d.token}`);
});
app.all('/pay/g/:type/notify/:token', limit(240, 60000), async (req, res) => {
  const d = gwFind(req.params.type, req.params.token); if (!d) return res.status(404).send('no donation');
  res.send('OK');
  try { const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(d.campaign_id); await gwSettle(d, c, { ...req.query, ...(req.body || {}) }, req.originalUrl.split('?')[1] || ''); } catch (e) { logEvent('pay.error', { level: 'error', cid: d.campaign_id, msg: `${req.params.type} notify: ${e.message}` }); }
});
// donors who paid and closed the tab: poll the processors that have a lookup by our stored session id
async function reconcileGateways() {
  const rows = db.prepare("SELECT d.* FROM donations d WHERE d.status='pending' AND d.test=0 AND d.ref!='' AND d.provider IN ('cardcom','payplus','payme','zcredit') AND d.created > datetime('now','-2 days') AND d.created < datetime('now','-3 minutes') LIMIT 200").all();
  for (const d of rows) { try { const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(d.campaign_id); await gwSettle(d, c, {}); } catch (e) { console.error('gw reconcile', d.id, e.message); } }
}
setInterval(() => reconcileGateways().catch(() => { }), 15 * 60e3).unref();

// SUMIT → donor comes back with OG-PaymentID. We re-read the payment from SUMIT (with the NGO's key) before counting it.
async function sumitSettle(d, c, paymentId) {
  const cfg = PV_(c.provider); if (cfg.type !== 'sumit' || !paymentId) return false;
  const p = await sumit.getPayment(cfg, paymentId); if (!sumit.isPaid(p)) { db.prepare("UPDATE donations SET note=? WHERE id=?").run('SUMIT: התשלום לא אושר' + (p?.StatusDescription ? ' – ' + p.StatusDescription : ''), d.id); return false; }
  if (p.ExternalIdentifier && p.ExternalIdentifier !== 'gx-d-' + d.id) { logEvent('pay.mismatch', { level: 'warn', cid: c.id, msg: `SUMIT: מזהה לא תואם לתרומה #${d.id}` }); return false; }
  const per = d.monthly && d.installments > 1 ? d.amount / d.installments : d.amount;
  if (Math.abs((+p.Amount || 0) - per) > 1) { db.prepare("UPDATE donations SET note=? WHERE id=?").run(`⚠ SUMIT: סכום לא תואם (${p.Amount} מול ${per}) – לא נספר`, d.id); return false; }
  markPaid(d.id, { ref: String(p.ID), meta: { verified: 1, sumit: { payment: p.ID, customer: p.CustomerID, document: p.DocumentID, auth: p.AuthNumber } } });
  if (d.monthly && d.installments > 1 && p.CustomerID) { // remaining months as a standing order on the saved card
    const fresh = db.prepare('SELECT meta FROM donations WHERE id=?').get(d.id); const m = J(fresh.meta);
    if (!m.sumitRecurring) {
      m.sumitRecurring = 'starting'; db.prepare('UPDATE donations SET meta=? WHERE id=?').run(JSON.stringify(m), d.id);
      try { const docType = { receipt: sumit.DOC.receipt, invoice: sumit.DOC.invoiceReceipt }[String(cfg.docType || '').trim()] ?? sumit.DOC.donationReceipt; const r = await sumit.startRecurring(cfg, { customerId: p.CustomerID, amount: per, currency: d.currency, count: d.installments - 1, start: sumit.nextMonth(), itemName: `תרומה חודשית – ${c.title}`.slice(0, 120), docType }); m.sumitRecurring = r.itemId || 'ok'; }
      catch (e) { m.sumitRecurring = 'error: ' + e.message; logEvent('pay.recurring', { level: 'error', cid: c.id, msg: `SUMIT הו״ק לתרומה #${d.id}: ${e.message}` }); }
      db.prepare('UPDATE donations SET meta=? WHERE id=?').run(JSON.stringify(m), d.id);
    }
  }
  return true;
}
app.get('/pay/sumit/return/:token', limit(60, 60000), async (req, res) => {
  const d = db.prepare('SELECT d.*, c.slug FROM donations d JOIN campaigns c ON c.id=d.campaign_id WHERE d.token=?').get(req.params.token); if (!d) return res.redirect('/');
  if (d.status !== 'paid') { try { const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(d.campaign_id); await sumitSettle(d, c, String(req.query['OG-PaymentID'] || '').replace(/\D/g, '')); } catch (e) { logEvent('pay.error', { level: 'error', cid: d.campaign_id, msg: 'SUMIT return: ' + e.message }); } }
  res.redirect(`/c/${d.slug}?thanks=${d.token}`);
});
// donors who paid but closed the tab before coming back: every 10 min match recent SUMIT payments by our reference
async function reconcileSumit() {
  const camps = db.prepare("SELECT c.* FROM campaigns c WHERE c.provider LIKE '%\"sumit\"%' AND EXISTS(SELECT 1 FROM donations d WHERE d.campaign_id=c.id AND d.provider='sumit' AND d.status='pending' AND d.test=0 AND d.created > datetime('now','-2 days'))").all();
  for (const c of camps) {
    try {
      const from = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 19), to = new Date(Date.now() + 864e5).toISOString().slice(0, 19);
      const list = await sumit.listPayments(PV_(c.provider), from, to);
      for (const p of list) { const m = /^gx-d-(\d+)$/.exec(p.ExternalIdentifier || ''); if (!m) continue; const d = db.prepare("SELECT * FROM donations WHERE id=? AND campaign_id=? AND status='pending'").get(+m[1], c.id); if (d) await sumitSettle(d, c, p.ID); }
    } catch (e) { console.error('sumit reconcile', c.id, e.message); }
  }
}
setInterval(() => reconcileSumit().catch(() => { }), 20 * 60e3).unref();

// ---- platform billing through GiveIL's own SUMIT account (campaign fee / monthly plan, automatic invoice-receipt) ----
const billCfg = () => { const k = getKV('billing'); return { companyId: k.companyId || process.env.SUMIT_COMPANY_ID || '', apiKey: k.apiKey || process.env.SUMIT_API_KEY || '', docType: k.docType || 'receipt', months: +(k.months ?? 12) }; };
const billOn = () => { const b = billCfg(); return !!(b.companyId && b.apiKey); };
app.post('/api/billing/pay', auth, limit(10, 600000), async (req, res) => {
  if (!billOn()) return bad(res, 'תשלום בכרטיס עדיין לא מחובר');
  const kind = req.body?.kind === 'monthly' ? 'monthly' : 'campaign'; const cid = +req.body?.campaignId || null; const p = pricingFor(req.user.id); const b = billCfg();
  let c = null; if (kind === 'campaign') { c = cid && db.prepare('SELECT id,title,user_id,paid FROM campaigns WHERE id=?').get(cid); if (!c || c.user_id !== req.user.id) return bad(res, 'קמפיין לא נמצא'); if (c.paid) return bad(res, 'הקמפיין כבר שולם'); }
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id); const amount = kind === 'monthly' ? p.monthly : p.campaign;
  const gross = p.vat === 'plus' ? Math.round(amount * 1.18 * 100) / 100 : amount;
  const id = db.prepare("INSERT INTO payments(user_id,campaign_id,kind,amount,ref,note) VALUES(?,?,?,?,?,?)").run(u.id, cid, kind, amount, 'SUMIT', 'ממתין לתשלום בכרטיס').lastInsertRowid;
  try {
    const r = await sumit.beginRedirect(b, { name: u.org_name || u.org || u.name, email: u.email, phone: u.phone, companyNumber: u.org_number || null, customerRef: 'gx-u-' + u.id, amount: gross,
      itemName: kind === 'monthly' ? 'מנוי GiveIL – חודש ראשון' : `GiveIL – קמפיין: ${c.title}`.slice(0, 120), docType: { receipt: sumit.DOC.receipt, donation: sumit.DOC.donationReceipt }[b.docType] ?? sumit.DOC.invoiceReceipt,
      ref: 'gx-p-' + id, returnUrl: `${base(req)}/billing/sumit/return/${id}`, cancelUrl: `${base(req)}/app${cid ? '#/c/' + cid + '/payment' : ''}`, saveCard: kind === 'monthly' });
    ev(req, 'billing.start', { cid, msg: `${u.org_name || u.email} · ${kind === 'monthly' ? 'מנוי' : 'קמפיין'} ₪${gross} (SUMIT)` });
    res.json({ url: r.url });
  } catch (e) { db.prepare("UPDATE payments SET status='rejected', note=? WHERE id=?").run(e.message.slice(0, 300), id); logEvent('billing.error', { level: 'error', uid: u.id, msg: e.message }); bad(res, e.message, 502); }
});
async function billSettle(pay, paymentId) {
  if (pay.status === 'approved') return true; const b = billCfg(); const p = await sumit.getPayment(b, paymentId);
  if (!sumit.isPaid(p) || (p.ExternalIdentifier && p.ExternalIdentifier !== 'gx-p-' + pay.id)) return false;
  const pr = pricing(); const gross = pr.vat === 'plus' ? pay.amount * 1.18 : pay.amount; if (Math.abs((+p.Amount || 0) - gross) > 1) { logEvent('billing.mismatch', { level: 'warn', uid: pay.user_id, msg: `SUMIT ${p.Amount} מול ${gross}` }); return false; }
  db.prepare("UPDATE payments SET status='approved', ref=?, note=?, approved_at=datetime('now') WHERE id=? AND status='pending'").run('SUMIT ' + p.ID, 'שולם בכרטיס · מסמך ' + (p.DocumentID || ''), pay.id);
  if (pay.kind === 'campaign' && pay.campaign_id) db.prepare('UPDATE campaigns SET paid=1 WHERE id=?').run(pay.campaign_id);
  else {
    const u = db.prepare('SELECT plan_until,sms FROM users WHERE id=?').get(pay.user_id); db.prepare("UPDATE users SET plan='annual', plan_until=? WHERE id=?").run(addMonth(u.plan_until), pay.user_id);
    if (p.CustomerID && !getKV('sub:' + pay.user_id).item) { // following months: SUMIT charges the saved card and issues the document automatically
      try { const r = await sumit.startRecurring(b, { customerId: p.CustomerID, amount: gross, count: b.months > 1 ? b.months - 1 : null, start: sumit.nextMonth(), itemName: 'מנוי GiveIL חודשי', docType: { receipt: sumit.DOC.receipt }[b.docType] ?? sumit.DOC.invoiceReceipt }); setKV('sub:' + pay.user_id, { customer: p.CustomerID, item: r.itemId, amount: gross, since: new Date().toISOString() }); }
      catch (e) { logEvent('billing.error', { level: 'error', uid: pay.user_id, msg: 'הו״ק מנוי: ' + e.message }); }
    }
  }
  logEvent('billing.paid', { uid: pay.user_id, cid: pay.campaign_id, msg: `${pay.kind === 'monthly' ? 'מנוי' : 'קמפיין'} ₪${Math.round(gross)} · SUMIT ${p.ID}` });
  return true;
}
app.get('/billing/sumit/return/:id', limit(60, 60000), async (req, res) => {
  const pay = db.prepare('SELECT * FROM payments WHERE id=?').get(+req.params.id); if (!pay) return res.redirect('/app');
  let ok = false; try { ok = await billSettle(pay, String(req.query['OG-PaymentID'] || '').replace(/\D/g, '')); } catch (e) { logEvent('billing.error', { level: 'error', uid: pay.user_id, msg: e.message }); }
  res.redirect(`/app${pay.campaign_id ? '#/c/' + pay.campaign_id + '/payment' : '#/account'}${ok ? '' : ''}`);
});
// monthly plans: each renewal SUMIT charges by itself → extend plan_until when we see the payment
async function billRenewals() {
  if (!billOn()) return; const b = billCfg();
  const hasSubs = db.prepare("SELECT 1 FROM kv WHERE k LIKE 'sub:%' LIMIT 1").get(); const hasPend = db.prepare("SELECT 1 FROM payments WHERE ref='SUMIT' AND status='pending' AND created > datetime('now','-3 days') LIMIT 1").get();
  if (!hasSubs && !hasPend) return; // nothing to look for – save API calls (SUMIT keys have a call quota)
  const from = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 19), to = new Date(Date.now() + 864e5).toISOString().slice(0, 19);
  const list = await sumit.listPayments(b, from, to); const seen = getKV('billSeen'); const ids = new Set(seen.ids || []);
  for (const p of list) {
    if (ids.has(p.ID)) continue; const pend = /^gx-p-(\d+)$/.exec(p.ExternalIdentifier || '');
    if (pend) { const pay = db.prepare("SELECT * FROM payments WHERE id=? AND status='pending'").get(+pend[1]); if (pay) await billSettle(pay, p.ID); ids.add(p.ID); continue; }
    const subs = db.prepare("SELECT k, v FROM kv WHERE k LIKE 'sub:%'").all().map(r => ({ uid: +r.k.slice(4), ...J(r.v) })).filter(x => +x.customer === +p.CustomerID && ((p.RecurringCustomerItemIDs || []).length ? p.RecurringCustomerItemIDs.map(Number).includes(+x.item) : !p.ExternalIdentifier && Math.abs((+p.Amount || 0) - x.amount) <= 1));
    for (const sub of subs) { const u = db.prepare('SELECT plan_until FROM users WHERE id=?').get(sub.uid); db.prepare("UPDATE users SET plan='annual', plan_until=? WHERE id=?").run(addMonth(u?.plan_until), sub.uid); db.prepare("INSERT INTO payments(user_id,kind,amount,status,ref,note,approved_at) VALUES(?,'monthly',?,'approved',?,'חידוש אוטומטי – SUMIT',datetime('now'))").run(sub.uid, Math.round(+p.Amount || sub.amount), 'SUMIT ' + p.ID); logEvent('billing.renew', { uid: sub.uid, msg: `חידוש מנוי ₪${p.Amount}` }); }
    ids.add(p.ID);
  }
  setKV('billSeen', { ids: [...ids].slice(-2000) });
}
setInterval(() => billRenewals().catch(e => console.error('billRenewals', e.message)), 3 * 3600e3).unref();
app.get('/api/admin/notify', auth, adm, (_, res) => { const k = getKV('notify'); res.json({ email: k.email || '', off: !!k.off, types: { ...NOTIFY_DEF, ...(k.types || {}) }, labels: NOTIFY_T, admins: db.prepare("SELECT email FROM users WHERE role='admin' AND blocked=0").all().map(r => r.email), mail: mail.enabled() }); });
app.put('/api/admin/notify', auth, adm, (req, res) => { const x = req.body || {}; const types = {}; for (const k of Object.keys(NOTIFY_T)) types[k] = !!x.types?.[k]; setKV('notify', { email: String(x.email || '').slice(0, 300), off: !!x.off, types }); ev(req, 'admin.notify', { msg: x.off ? 'כובה' : String(x.email || 'למנהלים') }); res.json({ ok: true }); });
app.post('/api/admin/notify/test', auth, adm, limit(5, 60000), async (req, res) => { try { if (!mail.enabled()) return res.json({ ok: false, msg: 'שליחת מיילים לא מחוברת בשרת' }); const k = getKV('notify'); if (k.off) return res.json({ ok: false, msg: 'העדכונים כבויים' }); const r = await adminNotify('user.signup', { uid: req.user.id, msg: 'זו הודעת בדיקה – ככה ייראה עדכון על נרשם חדש' }); res.json(r?.ok ? { ok: true } : { ok: false, msg: r ? 'Resend: ' + (r.body || r.status) : 'העדכון על נרשמים כבוי בהגדרות' }); } catch (e) { res.json({ ok: false, msg: e.message }); } });
app.get('/api/admin/billing', auth, adm, (_, res) => { const b = billCfg(); res.json({ companyId: b.companyId, apiKey: b.apiKey ? '••••' + b.apiKey.slice(-4) : '', docType: b.docType, months: b.months, fromEnv: !getKV('billing').apiKey && !!process.env.SUMIT_API_KEY, subs: db.prepare("SELECT k, v FROM kv WHERE k LIKE 'sub:%'").all().length }); });
app.put('/api/admin/billing', auth, adm, (req, res) => { const cur = getKV('billing'); const x = req.body || {}; const next = { companyId: String(x.companyId ?? cur.companyId ?? '').replace(/\D/g, '').slice(0, 12), apiKey: x.apiKey && !String(x.apiKey).startsWith('••••') ? String(x.apiKey).trim().slice(0, 200) : cur.apiKey || '', docType: ['invoice', 'receipt'].includes(x.docType) ? x.docType : 'invoice', months: Math.max(0, Math.min(120, +x.months || 0)) }; setKV('billing', next); ev(req, 'admin.billing', { msg: `SUMIT חברה ${next.companyId}` }); res.json({ ok: true }); });
// ---- גשר SUMIT לאתרים נוספים של DA פרויקטים (למשל קנית·זכית). אימות במפתח משותף EXT_KEY ----
const extAuth = (req, res, next) => { const k = String(req.headers['x-ext-key'] || ''); const e = process.env.EXT_KEY || ''; if (!e || k.length !== e.length || !crypto.timingSafeEqual(Buffer.from(k), Buffer.from(e))) return res.status(401).json({ error: 'unauthorized' }); next(); };
app.post('/api/ext/sumit/ping', extAuth, limit(20, 60000), async (_, res) => { const b = billCfg(); if (!b.apiKey) return res.json({ ok: false, msg: 'SUMIT לא מוגדר ב-GiveIL' }); try { await sumit.ping(b); res.json({ ok: true }); } catch (e) { res.json({ ok: false, msg: e.message }); } });
app.post('/api/ext/sumit/begin', extAuth, limit(60, 60000), async (req, res) => {
  const b = billCfg(), o = req.body || {}; if (!b.apiKey) return res.status(503).json({ error: 'SUMIT לא מוגדר' });
  const amount = +o.amount; if (!(amount > 0 && amount < 100000) || !/^https:\/\//.test(o.returnUrl || '')) return res.status(400).json({ error: 'פרטים חסרים' });
  try { const r = await sumit.beginRedirect(b, { name: String(o.name || 'לקוח').slice(0, 80), phone: o.phone || null, email: o.email || null, customerRef: o.customerRef ? String(o.customerRef).slice(0, 60) : null, amount, itemName: String(o.itemName || 'תשלום').slice(0, 120), docType: { receipt: sumit.DOC.receipt }[b.docType] ?? sumit.DOC.invoiceReceipt, ref: String(o.ref || '').slice(0, 60), returnUrl: o.returnUrl, cancelUrl: o.cancelUrl || null });
    logEvent('ext.sumit.begin', { msg: String(o.ref || '') + ' ' + amount }); res.json({ url: r.url }); } catch (e) { res.status(502).json({ error: e.message }); }
});
app.post('/api/ext/notify', extAuth, limit(30, 60000), async (req, res) => {
  const to = process.env.ADMIN_EMAIL || 'da@101.org.il'; const subj = String(req.body.subject || 'הודעה').slice(0, 150); const text = String(req.body.text || '').slice(0, 5000);
  try { await mail.send({ to, subject: subj, html: mail.template({ title: subj, body: text, btnText: req.body.btnText || '', btnUrl: req.body.btnUrl || '' }) }); res.json({ ok: true }); } catch (e) { res.status(502).json({ error: e.message }); }
});
app.post('/api/ext/sumit/verify', extAuth, limit(60, 60000), async (req, res) => {
  const b = billCfg(); try { const p = await sumit.getPayment(b, +req.body.paymentId); const ok = sumit.isPaid(p) && (!req.body.ref || p.ExternalIdentifier === req.body.ref);
    res.json({ paid: ok, amount: p ? p.Amount : null, ref: p ? p.ExternalIdentifier : null }); } catch (e) { res.status(502).json({ error: e.message }); }
});
app.post('/api/admin/billing/test', auth, adm, limit(10, 60000), async (_, res) => { try { await sumit.ping(billCfg()); res.json({ ok: true, msg: 'SUMIT אישר את המפתחות ✓' }); } catch (e) { res.json({ ok: false, msg: e.message }); } });

// Nedarim Plus → our server. Trust model: the donation is matched by id+token, the amount must equal what the
// donor asked for, Mosad (if sent) must be ours, a TransactionId is required, and when ApiPassword is set we
// re-read the transaction from Nedarim's own history before counting it. Anything short of that is logged, not counted.
app.all('/pay/nedarim/callback', limit(120, 60000), async (req, res) => {
  const b = { ...req.query, ...req.body }; const r = providers.nedarim.callback(b);
  const d = r.donationId ? db.prepare('SELECT * FROM donations WHERE id=? AND token=?').get(r.donationId, String(r.token || '')) : null;
  if (!d) return res.status(404).send('no donation');
  res.send('OK'); // answer Nedarim immediately; the work below is idempotent
  if (d.status === 'paid') return;
  const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(d.campaign_id); const cfg = PV_(c.provider);
  const log = (note, extra = {}) => db.prepare("UPDATE donations SET note=?, meta=? WHERE id=?").run(note, JSON.stringify({ ...r.meta, ...extra, at: new Date().toISOString() }).slice(0, 4000), d.id);
  if (!r.paid) { db.prepare("UPDATE donations SET status='failed' WHERE id=? AND status='pending'").run(d.id); return log('נדרים: העסקה נדחתה (' + String(b.Status || '') + ')'); }
  if (!r.ref) return log('⚠ התקבל אישור ללא מספר עסקה – לא נספר. בדקו בנדרים.');
  if (r.mosad && cfg.mosadId && r.mosad !== String(cfg.mosadId)) return log('⚠ מספר מוסד לא תואם – לא נספר.');
  const perPay = d.installments > 1 ? d.amount / d.installments : d.amount; // Nedarim may report the per-installment amount
  const amtOk = !r.amount || Math.abs(r.amount - d.amount) <= 1 || Math.abs(r.amount - perPay) <= 1;
  if (!amtOk) return log(`⚠ סכום לא תואם (נדרים: ${r.amount}, בקשה: ${d.amount}) – לא נספר.`);
  const isHK = !!d.monthly || String(b.PaymentType || '').toUpperCase() === 'HK' || (!!b.KevaId && !b.TransactionId);
  db.prepare('UPDATE donations SET ref=? WHERE id=? AND ref=\'\'').run(r.ref, d.id);
  console.log('nedarim callback', d.id, JSON.stringify({ Status: b.Status, TransactionId: b.TransactionId, KevaId: b.KevaId, Amount: b.Amount, Mosad: b.Mosad, PaymentType: b.PaymentType }));
  // STRICT: a one-time charge is counted only after we read it back from Nedarim's own history (ApiPassword).
  if (!cfg.apiPassword) return log('⏳ ממתין לאימות: חסר ApiPassword בהגדרות הסליקה. הוסיפו אותו ולחצו "סנכרון מול נדרים" – התרומה תאומת ותיספר.');
  if (isHK) {
    markPaid(d.id, { ref: r.ref, meta: { ...r.meta, verified: 1, hk: true }, amount: d.amount });
    return db.prepare('UPDATE donations SET verified=1, note=? WHERE id=?').run(`הוראת קבע נרשמה בנדרים (מזהה ${r.ref}). החיובים החודשיים מתבצעים ומנוהלים בנדרים פלוס.`, d.id);
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const v = await providers.nedarim.verify({ cfg, transactionId: r.ref });
      if (v.found) {
        if (Math.abs(v.amount - d.amount) > 1 && Math.abs(v.amount - perPay) > 1) return log(`⚠ סכום בנדרים (${v.amount}) שונה מהבקשה (${d.amount}) – לא נספר.`);
        markPaid(d.id, { ref: r.ref, meta: { ...r.meta, verified: 1, nedarim: v.record }, amount: d.amount });
        return db.prepare('UPDATE donations SET verified=1, note=? WHERE id=?').run('אומת מול שרת נדרים ✓', d.id);
      }
      return log('⏳ נדרים דיווחו OK אבל העסקה עדיין לא מופיעה בהיסטוריה שלהם – לא נספרה. נבדוק שוב אוטומטית כל 5 דקות.');
    } catch (e) { r.meta._verifyError = e.message; if (attempt < 2) await new Promise(x => setTimeout(x, [2000, 6000][attempt])); }
  }
  return log('⏳ ממתין לאימות מול נדרים (שגיאת תקשורת: ' + String(r.meta._verifyError || '').slice(0, 80) + '). נבדוק שוב אוטומטית כל 5 דקות.');
});
// Reconcile: pull Nedarim history and match it against our donations (missed callbacks, unverified rows)
async function reconcileNedarim(c) {
  const cfg = PV_(c.provider); if (cfg.type !== 'nedarim' || !cfg.apiPassword) throw new Error('סנכרון דורש נדרים פלוס עם ApiPassword');
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
async function provTest(c, req) {
  const res = { json: o => o };
  const cfg = PV_(c.provider); const t = cfg.type || 'test';
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
      try { await providers.meshulam.start({ base: base(req), donation: { id: 0, amount: 1, name: 'בדיקה', phone: '', email: '', installments: 1, token: 'test' }, campaign: c, cfg }); return res.json({ ok: true, msg: 'Grow יצר דף תשלום בהצלחה – המזהים נכונים.' }); } catch (e) { return res.json({ ok: false, msg: e.message }); }
    }
    if (t === 'paypal') {
      if (!cfg.clientId || !cfg.secret) return res.json({ ok: false, msg: 'חסר Client ID או Secret' });
      const host = String(cfg.sandbox) === 'true' ? 'api-m.sandbox.paypal.com' : 'api-m.paypal.com';
      const https = require('https'); const auth = Buffer.from(cfg.clientId + ':' + cfg.secret).toString('base64');
      const r = await new Promise((resolve, reject) => { const q = https.request({ hostname: host, path: '/v1/oauth2/token', method: 'POST', headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': 29 } }, rs => { let d = ''; rs.on('data', c => d += c); rs.on('end', () => resolve({ status: rs.statusCode, body: d })); }); q.on('error', reject); q.write('grant_type=client_credentials'); q.end(); });
      return res.json({ ok: r.status === 200, msg: r.status === 200 ? 'PayPal אישר את המפתחות.' : 'PayPal דחה את המפתחות (' + r.status + ')' });
    }
    if (providers[t]?.gateway) { try { return await providers[t].ping(cfg); } catch (e) { return { ok: false, msg: e.message }; } }
    if (t === 'sumit') {
      if (!cfg.companyId || !cfg.apiKey) return res.json({ ok: false, msg: 'חסר מספר חברה או מפתח API' });
      try { await sumit.ping(cfg); return res.json({ ok: true, msg: `SUMIT אישר את המפתחות (חברה ${cfg.companyId}).` }); } catch (e) { return res.json({ ok: false, msg: e.message }); }
    }
    if (t === 'link') { const ok = /^https:\/\//.test(cfg.url || ''); return res.json({ ok, msg: ok ? 'הקישור תקין. זכרו: אישור התרומות ידני.' : 'הקישור חייב להתחיל ב-https://' }); }
    return { ok: false, msg: 'ספק לא מוכר' };
  } catch (e) { return { ok: false, msg: e.message }; }
}
app.post('/api/campaigns/:id/provider/test', auth, own, limit(10, 60000), async (req, res) => res.json(await provTest(req.c, req)));

// ---------- super-admin: full health check of one campaign ----------
const selfGet = pth => new Promise(resolve => { const t0 = Date.now(); const q = require('http').get({ host: '127.0.0.1', port: process.env.PORT || 3000, path: pth, headers: { 'User-Agent': 'GiveIL-health' } }, r => { let n = 0; r.on('data', d => n += d.length); r.on('end', () => resolve({ status: r.statusCode, ms: Date.now() - t0, bytes: n })); }); q.on('error', e => resolve({ status: 0, ms: Date.now() - t0, err: e.message })); q.setTimeout(8000, () => q.destroy(new Error('timeout'))); });
app.get('/api/admin/campaigns/:id/health', auth, adm, async (req, res) => {
  const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(req.params.id); if (!c) return bad(res, 'not found', 404);
  const q1 = (sql, ...p) => db.prepare(sql).get(...p); const st = J(c.settings), prov = PV_(c.provider), type = prov.type || 'test';
  const u = q1('SELECT id,email,name,phone,org_name,org,org_verified,email_verified,plan_until,blocked,last_seen FROM users WHERE id=?', c.user_id) || {};
  const ct = q1('SELECT id,status,created FROM contracts WHERE user_id=? ORDER BY id DESC LIMIT 1', c.user_id);
  const test = isTest(c), live = c.status === 'live' && !isEnded(c), ended = isEnded(c);
  const G = []; const add = (group, label, state, detail = '', fix = null) => { let g = G.find(x => x.group === group); if (!g) G.push(g = { group, items: [] }); g.items.push({ label, state, detail, fix }); };
  const fmtD = d => d ? d.replace('T', ' ').slice(0, 16) : '—';
  // page
  const [pg, ap, sc] = await Promise.all([selfGet('/c/' + encodeURIComponent(c.slug)), selfGet('/api/c/' + encodeURIComponent(c.slug)), selfGet('/c/' + encodeURIComponent(c.slug) + '/screen')]);
  const P = 'דף הקמפיין';
  add(P, 'הדף נטען', pg.status === 200 ? (pg.ms > 2000 ? 'warn' : 'ok') : 'bad', pg.status === 200 ? `${pg.ms}ms` : `שגיאה ${pg.status || pg.err}`);
  add(P, 'נתוני הדף (API)', ap.status === 200 ? (ap.ms > 1500 ? 'warn' : 'ok') : 'bad', ap.status === 200 ? `${ap.ms}ms` : `שגיאה ${ap.status || ap.err}`);
  add(P, 'מסך אירוע', sc.status === 200 ? 'ok' : 'bad', sc.status === 200 ? 'תקין' : `שגיאה ${sc.status || sc.err}`);
  add(P, 'סטטוס', st.adminPaused ? 'bad' : ended ? 'off' : live ? 'ok' : 'warn', st.adminPaused ? '⏸ מושהה ע״י מנהל – אי אפשר לתרום' : ended ? 'הסתיים' : live ? 'באוויר' : 'במצב בדיקה', st.adminPaused ? 'unpause' : null);
  const endU = c.end_at ? ilToUtc(c.end_at) : null, startU = c.start_at ? ilToUtc(c.start_at) : null;
  add(P, 'תאריכים', !c.end_at ? 'warn' : (startU && endU && startU >= endU) ? 'bad' : 'ok', `התחלה ${fmtD(c.start_at)} · סיום ${fmtD(c.end_at)}${!c.end_at ? ' – אין תאריך סיום' : ''}${startU && endU && startU >= endU ? ' – הסיום לפני ההתחלה!' : ''}`);
  const lv = db.prepare('SELECT amount,stock FROM levels WHERE campaign_id=?').all(c.id);
  add(P, 'כפתורי תרומה', lv.length ? 'ok' : 'bad', lv.length ? `${lv.length} רמות` : 'אין אף כפתור תרומה');
  add(P, 'יעד, סיפור ותמונה', c.goal > 0 && (c.story || c.cover) ? 'ok' : 'warn', `יעד ${c.goal}${c.story ? ' · יש סיפור' : ' · אין סיפור'}${c.cover ? ' · יש תמונה' : ' · אין תמונה'}`);
  // payments
  const S = 'סליקה'; const pdef = providers[type];
  add(S, 'ספק סליקה', type === 'test' ? (live ? 'bad' : 'warn') : 'ok', pdef ? pdef.label.split('(')[0].trim() : type);
  if (type !== 'test' && pdef) { const miss = (pdef.fields || []).filter(f => !/sandbox|group/i.test(f.k) && !prov[f.k] && !(f.secret && prov._hasSecret)).map(f => f.k); add(S, 'פרטי הספק מלאים', miss.length ? 'bad' : 'ok', miss.length ? 'חסר: ' + miss.join(', ') : 'כל השדות הוזנו'); }
  if (type !== 'test') add(S, 'אישור GiveIL לחשבון', st.providerOk === provFp(prov) ? 'ok' : st.providerReview?.status === 'rejected' ? 'bad' : 'warn', st.providerOk === provFp(prov) ? 'אושר' : st.providerReview?.status === 'rejected' ? 'נדחה' : 'ממתין לאישור', st.providerOk === provFp(prov) ? null : 'approve');
  let pt = { ok: true, msg: 'מצב בדיקה' }; if (type !== 'test') { try { pt = await Promise.race([provTest(c, req), new Promise(r => setTimeout(() => r({ ok: false, msg: 'הספק לא ענה תוך 10 שניות' }), 10000))]); } catch (e) { pt = { ok: false, msg: e.message }; } }
  add(S, 'בדיקת חיבור חיה לספק', type === 'test' ? 'off' : pt.ok ? 'ok' : 'bad', pt.msg);
  const lastPaid = q1("SELECT MAX(paid_at) t, COUNT(*) n FROM donations WHERE campaign_id=? AND status='paid' AND test=?", c.id, test ? 1 : 0);
  add(S, 'תרומה אחרונה ששולמה', lastPaid.n ? 'ok' : live ? 'warn' : 'off', lastPaid.n ? `${fmtD(lastPaid.t)} (${lastPaid.n} תרומות${test ? ' בדיקה' : ''})` : 'עוד אין');
  const d24 = q1("SELECT SUM(status='paid') p, SUM(status='failed') f, SUM(status='pending' AND created<datetime('now','-1 hour')) s FROM donations WHERE campaign_id=? AND test=? AND created>=datetime('now','-1 day')", c.id, test ? 1 : 0);
  const fr = (d24.p || 0) + (d24.f || 0) ? Math.round(100 * (d24.f || 0) / ((d24.p || 0) + (d24.f || 0))) : 0;
  add(S, 'תשלומים שנכשלו (24 שעות)', fr > 30 ? 'bad' : fr > 10 ? 'warn' : 'ok', `${d24.f || 0} נכשלו · ${d24.p || 0} הצליחו${fr ? ` (${fr}% כישלון)` : ''}`);
  add(S, 'תקועות בהמתנה מעל שעה (24 שעות)', (d24.s || 0) > 20 ? 'warn' : 'ok', `${d24.s || 0} – לרוב תורמים שלא סיימו`);
  if (providers[type]?.gateway) { const uv = q1("SELECT COUNT(*) n FROM donations WHERE campaign_id=? AND status='paid' AND test=0 AND provider=? AND verified=0", c.id, type).n; add(S, 'תרומות שלא אומתו מול הספק', uv ? 'warn' : 'ok', uv ? `${uv} תרומות נספרו לפי הודעת הספק בלבד – כדאי להשוות לדוח של הספק` : 'כל התרומות אומתו'); }
  if (type === 'nedarim') { const nv = q1("SELECT COUNT(*) n FROM donations WHERE campaign_id=? AND status='paid' AND test=0 AND provider='nedarim' AND verified=0", c.id).n; add(S, 'אימות מול נדרים', nv ? 'warn' : 'ok', nv ? `${nv} תרומות עוד לא אומתו מול נדרים` : 'כל התרומות אומתו'); }
  if (live) { const lt = q1('SELECT COUNT(*) n FROM donations WHERE campaign_id=? AND test=1', c.id).n; if (lt) add(S, 'תרומות בדיקה שנשארו', 'warn', `${lt} תרומות בדיקה (לא נספרות בדף)`); }
  // messages
  const M = 'הודעות'; const kv = getKV('msg');
  add(M, 'מייל – חיבור בפלטפורמה', mail.enabled() ? 'ok' : 'bad', mail.enabled() ? (process.env.MAIL_FROM || 'מחובר') : 'שליחת מיילים לא מחוברת');
  add(M, 'מייל – פתוח לקמפיין', chAllowed(c, 'email') ? 'ok' : 'off', chAllowed(c, 'email') ? 'כן' : 'סגור', 'ch');
  for (const [k, l] of [['wa', 'וואטסאפ אוטומטי'], ['sms', 'SMS']]) { const al = chAllowed(c, k), rd = chReady(k); add(M, l, al && rd ? 'ok' : al && !rd ? 'bad' : 'off', al ? (rd ? `פתוח · ספק ${kv[k].type}` : 'פתוח לקמפיין אבל אין ספק מחובר בפלטפורמה') : rd ? 'הספק מחובר – סגור לקמפיין הזה' : 'לא מחובר', 'ch'); }
  add(M, 'תודה + הזמנה לשגרירים בוואטסאפ', waOn(c) ? 'ok' : 'off', waOn(c) ? 'פעיל' : st.waFlow === false ? 'כובה בהגדרות הקמפיין' : 'וואטסאפ אוטומטי לא פתוח');
  const lm = db.prepare('SELECT channel,audience,total,sent,failed,created FROM messages WHERE campaign_id=? ORDER BY id DESC LIMIT 5').all(c.id);
  const mf = lm.reduce((a, m) => a + (m.failed || 0), 0);
  add(M, 'שליחות אחרונות', mf ? 'warn' : lm.length ? 'ok' : 'off', lm.length ? lm.map(m => `${fmtD(m.created)} ${m.channel}: ${m.sent}/${m.total}${m.failed ? ` (${m.failed} נכשלו)` : ''}`).join(' · ') : 'עוד לא נשלחו הודעות');
  const mev = q1("SELECT COUNT(*) n FROM events WHERE campaign_id=? AND type LIKE 'mail.%' AND level IN ('warn','error') AND at>=datetime('now','-7 day')", c.id).n;
  if (mev) add(M, 'תקלות שליחה (7 ימים)', 'warn', `${mev} תקלות ביומן`);
  // owner
  const O = 'בעלים והסכם';
  add(O, 'חשבון הבעלים', u.blocked ? 'bad' : 'ok', `${u.org_name || u.org || ''} · ${u.email || ''}${u.blocked ? ' · 🚫 מושעה' : ''}`);
  add(O, 'מייל מאומת', u.email_verified ? 'ok' : 'warn', u.email_verified ? 'כן' : 'לא');
  add(O, 'הסכם', ct?.status === 'approved' ? 'ok' : !ct || ct.status === 'rejected' ? (live ? 'bad' : 'warn') : 'warn', ct ? ({ approved: 'אושר', pending: 'ממתין לאישור', rejected: 'נדחה' }[ct.status] || ct.status) : 'לא נחתם');
  add(O, 'תשלום לפלטפורמה', c.paid || planActive(u) ? 'ok' : live ? 'bad' : 'warn', c.paid ? 'הקמפיין שולם' : planActive(u) ? `מנוי עד ${u.plan_until}` : 'לא שולם', c.paid || planActive(u) ? null : 'paid');
  // ambassadors & data
  const A = 'שגרירים ונתונים';
  const tm = q1("SELECT COUNT(*) n, SUM(phone='' OR phone IS NULL) np FROM teams WHERE campaign_id=?", c.id);
  add(A, 'שגרירים', tm.n ? 'ok' : 'off', tm.n ? `${tm.n} שגרירים${tm.np ? ` · ${tm.np} בלי טלפון` : ''}` : 'אין שגרירים');
  const s1 = stats(c, test);
  const orphan = q1("SELECT COUNT(*) n FROM donations d WHERE d.campaign_id=? AND d.team_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM teams t WHERE t.id=d.team_id)", c.id).n;
  add(A, 'גויס', 'ok', `₪${Math.round(s1.total).toLocaleString('he-IL')} מתוך ₪${(c.goal || 0).toLocaleString('he-IL')} (${s1.pct}%) · ${s1.count} תרומות`);
  if (orphan) add(A, 'תרומות של שגרירים שנמחקו', 'warn', `${orphan} תרומות משויכות לשגריר שכבר לא קיים`);
  const unf = (() => { try { return recipients(c, 'unfinished', false).length; } catch { return 0; } })();
  add(A, 'התחילו ולא סיימו', unf ? 'warn' : 'ok', unf ? `${unf} תורמים – אפשר לשלוח תזכורת` : 'אין');
  // system
  const Y = 'מערכת';
  const er = q1("SELECT COUNT(*) n FROM events WHERE campaign_id=? AND level='error' AND at>=datetime('now','-1 day')", c.id).n;
  add(Y, 'שגיאות בקמפיין (24 שעות)', er ? 'bad' : 'ok', er ? `${er} שגיאות ביומן` : 'אין', er ? 'log' : null);
  let bk = ''; try { bk = fs.readdirSync(BK_DIR).filter(x => x.startsWith('hourly')).sort().pop() || ''; } catch { }
  const bkAge = bk ? (Date.now() - fs.statSync(path.join(BK_DIR, bk)).mtimeMs) / 36e5 : 99;
  add(Y, 'גיבוי אחרון', bkAge < 2 ? 'ok' : 'warn', bk ? `לפני ${bkAge < 1 ? Math.round(bkAge * 60) + ' דק׳' : bkAge.toFixed(1) + ' שעות'}` : 'אין גיבוי');
  add(Y, 'צופים עכשיו', 'ok', String((subs.get(c.id) || new Set()).size));
  const all = G.flatMap(g => g.items); const score = { bad: all.filter(i => i.state === 'bad').length, warn: all.filter(i => i.state === 'warn').length, ok: all.filter(i => i.state === 'ok').length };
  ev(req, 'admin.health', { cid: c.id, msg: `${c.title}: ${score.bad} תקלות, ${score.warn} אזהרות` });
  res.json({ at: new Date().toISOString(), campaign: { id: c.id, title: c.title, slug: c.slug, status: c.status, ended, paused: !!st.adminPaused, user_id: c.user_id, msg: { email: chAllowed(c, 'email'), wa: chAllowed(c, 'wa'), sms: chAllowed(c, 'sms') } }, owner: { id: u.id, name: u.name, email: u.email, phone: u.phone, org: u.org_name || u.org }, stats: s1, score, groups: G,
    events: db.prepare('SELECT id,at,type,level,msg FROM events WHERE campaign_id=? ORDER BY id DESC LIMIT 15').all(c.id) });
});
app.post('/api/campaigns/:id/reconcile', auth, own, async (req, res) => { try { res.json(await reconcileNedarim(req.c)); } catch (e) { bad(res, e.message, 502); } });
// every 10 minutes: reconcile live Nedarim campaigns that have unverified/pending donations in the last 2 days
setInterval(async () => {
  for (const c of db.prepare("SELECT c.* FROM campaigns c WHERE c.provider LIKE '%nedarim%' AND EXISTS(SELECT 1 FROM donations d WHERE d.campaign_id=c.id AND d.provider='nedarim' AND d.test=0 AND (d.status='pending' OR d.verified=0) AND d.created > datetime('now','-2 days'))").all()) {
    try { await reconcileNedarim(c); } catch (e) { console.error('reconcile', c.id, e.message); }
  }
}, 5 * 60000).unref();
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
  try { const r = await providers.paypal.capture({ cfg: PV_(c.provider), orderId }); if (!r.paid) return bad(res, 'התשלום לא הושלם'); markPaid(d.id, { ref: r.ref, meta: { orderId, captured: r.ref }, amount: r.amount ? Math.round(r.amount) : undefined }); res.json({ ok: true }); } catch (e) { bad(res, e.message, 502); }
});
app.post('/pay/iframe-done/:token', (req, res) => { // Nedarim Plus iframe reports success via postMessage; server trusts callback, this only acknowledges
  const d = db.prepare('SELECT status FROM donations WHERE token=?').get(req.params.token); res.json({ status: d?.status || 'unknown' });
});

// ---------- messaging (SMS / WhatsApp lists) ----------
const recipients = (c, audience, byEmail = false, opts = {}) => {
  const test = isTest(c) ? 1 : 0; const seen = new Set(); const out = [];
  const push = r => { const ph = String(r.phone || '').replace(/\D/g, ''); const em = String(r.email || '').trim().toLowerCase(); const k = byEmail ? em : ph; if (byEmail ? !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em) : ph.length < 9) return; if (seen.has(k)) return; seen.add(k); out.push({ name: r.name, phone: ph, email: em, amount: r.amount || 0, link: r.link || '' }); };
  if (audience === 'ambassadors') db.prepare('SELECT name,phone,email,slug FROM teams WHERE campaign_id=? ORDER BY pos,id').all(c.id).forEach(t => push({ ...t, link: '/c/' + c.slug + '/' + t.slug }));
  else if (audience === 'pending' || audience === 'unfinished' || audience === 'selected') {
    const paid = new Set(db.prepare("SELECT phone,email FROM donations WHERE campaign_id=? AND status='paid' AND test=?").all(c.id, test).flatMap(d => [String(d.phone || '').replace(/\D/g, ''), String(d.email || '').toLowerCase()]).filter(x => x.length > 4));
    const ids = audience === 'selected' ? String(opts.ids || '').split(',').map(Number).filter(Boolean) : null;
    db.prepare(`SELECT id,name,phone,email,amount,monthly,installments,token,status FROM donations WHERE campaign_id=? AND test=? AND status IN ('pending','failed') ${ids ? `AND id IN (${ids.map(() => '?').join(',') || 'NULL'})` : ''} ORDER BY id DESC`).all(c.id, test, ...(ids || []))
      .filter(d => ids || !(paid.has(String(d.phone || '').replace(/\D/g, '')) || paid.has(String(d.email || '').toLowerCase())))
      .forEach(d => push({ ...d, amount: d.monthly && d.installments > 1 ? Math.round(d.amount / d.installments) : d.amount, link: '/r/' + d.token }));
  }
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
app.get('/api/support', (_, res) => { const s = getKV('support'); if (!s.phone) s.phone = process.env.SUPPORT_PHONE || '0556674329'; const adm = s.phone ? null : db.prepare("SELECT phone FROM users WHERE role='admin' AND phone!='' ORDER BY id LIMIT 1").get(); res.json({ phone: s.phone || adm?.phone || '', email: s.email || process.env.ADMIN_EMAIL || '', text: s.text || 'שלום, אני צריך עזרה עם GiveIL' }); });
app.put('/api/admin/support', auth, adm, (req, res) => { const b = req.body || {}; setKV('support', { phone: String(b.phone || '').replace(/[^\d+]/g, '').slice(0, 20), email: String(b.email || '').slice(0, 120), text: String(b.text || '').slice(0, 200) }); res.json({ ok: true }); });
app.get('/api/campaigns/:id/unfinished', auth, own, (req, res) => {
  const test = isTest(req.c) ? 1 : 0; const list = recipients(req.c, 'unfinished', false);
  const all = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(amount),0) s FROM donations WHERE campaign_id=? AND test=? AND status IN ('pending','failed')").get(req.c.id, test);
  const rec = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(amount),0) s FROM donations WHERE campaign_id=? AND test=? AND status='paid' AND resumed_from IS NOT NULL").get(req.c.id, test);
  res.json({ n: all.n, sum: all.s, reachable: list.length, reachableSum: list.reduce((a, r) => a + (r.amount || 0), 0), recovered: rec });
});
app.get('/api/campaigns/:id/channels', auth, own, (req, res) => res.json(Object.fromEntries(['email', 'wa', 'sms'].map(ch => [ch, { allowed: chAllowed(req.c, ch), ready: chReady(ch) }]))));
app.get('/api/msg-channels', auth, (_, res) => { const m = getKV('msg'); res.json({ sms: !!(m.sms && m.sms.type), wa: !!(m.wa && m.wa.type) }); });
app.get('/api/me/sms', auth, (req, res) => { const u = db.prepare('SELECT sms FROM users WHERE id=?').get(req.user.id); const c = J(u.sms); res.json({ ...c, token: c.token ? '••••' : '' }); });
app.put('/api/me/sms', auth, (req, res) => { const b = req.body || {}; const cur = J(db.prepare('SELECT sms FROM users WHERE id=?').get(req.user.id).sms); const next = { type: b.type || '', sid: b.sid || '', token: b.token && b.token !== '••••' ? b.token : cur.token || '', from: b.from || '', url: b.url || '', method: b.method || 'GET', intl: !!b.intl }; db.prepare('UPDATE users SET sms=? WHERE id=?').run(JSON.stringify(next), req.user.id); res.json({ ok: true }); });
app.get('/api/campaigns/:id/recipients', auth, own, (req, res) => res.json(recipients(req.c, req.query.audience, req.query.channel === 'email', { ids: req.query.ids }).map(r => ({ ...r, text: fill(req.query.text || '', r, req.c, base(req)) }))));
app.get('/api/campaigns/:id/messages', auth, own, (req, res) => res.json(db.prepare('SELECT * FROM messages WHERE campaign_id=? ORDER BY id DESC LIMIT 50').all(req.c.id)));
app.post('/api/campaigns/:id/messages', auth, own, async (req, res) => {
  const b = req.body || {}; const text = String(b.text || '').trim().slice(0, 600); if (!text && b.channel !== 'email') return bad(res, 'טקסט');
  if (b.channel === 'email') {
    if (!chOn(req.c, 'email')) return bad(res, mail.enabled() ? 'שליחת מיילים לא פתוחה לקמפיין הזה – פנו אלינו' : 'שליחת מייל עדיין לא מופעלת במערכת');
    const list = recipients(req.c, b.audience, true, { ids: b.ids }); if (!list.length) return bad(res, 'אין נמענים עם אימייל'); if (list.length > 2000) return bad(res, 'עד 2000 נמענים בשליחה אחת');
    const m = db.prepare('INSERT INTO messages(campaign_id,user_id,channel,audience,text,total) VALUES(?,?,?,?,?,?)').run(req.c.id, req.user.id, 'email', b.audience || 'donors', text, list.length);
    ev(req, 'message.send', { cid: req.c.id, msg: `אימייל ל-${list.length} נמענים · ${req.c.title}` });
    res.json({ ok: true, queued: list.length });
    let sent = 0, failed = 0; const owner = db.prepare('SELECT email FROM users WHERE id=?').get(req.user.id) || {};
    const remind = ['unfinished', 'selected', 'pending'].includes(b.audience) && text;
    for (const r of list) { try { const { subject, html } = remind ? { subject: `השלמת התרומה ל${req.c.title}`, html: mail.layout(`${(r.name || '').split(' ')[0] || 'שלום'}, נשאר רק עוד צעד קטן 💙`, `<p style="white-space:pre-line">${mail.esc(fill(text, r, req.c, base(req)).replace(base(req) + r.link, '').trim())}</p><p><a href="${base(req)}${r.link}" style="display:inline-block;background:#1c1917;color:#fff;padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:700">להשלמת התרומה ←</a></p>`) } : renderMail(req.c, b.kind || 'update', r, base(req)); const o = await mail.send({ to: r.email, subject, html, replyTo: owner.email }); if (o.ok) sent++; else failed++; } catch { failed++; } await new Promise(x => setTimeout(x, 120)); }
    return db.prepare('UPDATE messages SET sent=?,failed=? WHERE id=?').run(sent, failed, m.lastInsertRowid);
  }
  const list = recipients(req.c, b.audience, false, { ids: b.ids }); if (!list.length) return bad(res, 'אין נמענים');
  const ch = b.channel === 'wa' ? 'wa' : 'sms'; const cfg = (getKV('msg')[ch]) || {}; if (!chAllowed(req.c, ch)) return bad(res, (ch === 'wa' ? 'וואטסאפ אוטומטי' : 'SMS') + ' לא פתוח לקמפיין הזה – פנו אלינו להפעלה'); if (!cfg.type) return bad(res, ch === 'wa' ? 'שליחת וואטסאפ אוטומטית עדיין לא הופעלה במערכת' : 'שליחת SMS עדיין לא הופעלה במערכת');
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

// ---------- guide (built-in knowledge, no AI) ----------
const guide = require('./lib/guide');
function guideCtx(uid, cid, req) {
  const adminU = db.prepare('SELECT role FROM users WHERE id=?').get(uid)?.role === 'admin'; const c = cid ? (adminU ? db.prepare('SELECT * FROM campaigns WHERE id=?').get(cid) : db.prepare('SELECT * FROM campaigns WHERE id=? AND user_id=?').get(cid, uid)) : null; if (!c) return null; uid = c.user_id;
  const st = stats(c, isTest(c)); const u = db.prepare('SELECT org_name,org,email_verified,plan_until FROM users WHERE id=?').get(uid) || {};
  const prov = PV_(c.provider), sett = J(c.settings); const ct = db.prepare('SELECT status FROM contracts WHERE user_id=? ORDER BY id DESC LIMIT 1').get(uid);
  const top = db.prepare("SELECT t.name FROM teams t JOIN donations d ON d.team_id=t.id AND d.status='paid' WHERE t.campaign_id=? GROUP BY t.id ORDER BY SUM(d.amount) DESC LIMIT 1").get(c.id);
  let unfinished = 0; try { unfinished = recipients(c, 'unfinished', false).length; } catch { }
  const levels = db.prepare('SELECT COUNT(*) n FROM levels WHERE campaign_id=?').get(c.id).n;
  const paidTest = db.prepare("SELECT COUNT(*) n FROM donations WHERE campaign_id=? AND status='paid'").get(c.id).n;
  const checklist = [[!!(c.title && c.goal), 'שם ויעד לקמפיין'], [!!(c.story || c.cover), 'סיפור או תמונה'], [levels > 0, 'לפחות כפתור תרומה אחד'], [(prov.type || 'test') !== 'test', 'חיבור ספק סליקה'], [!!prov.type && prov.type !== 'test' && sett.providerOk === provFp(prov), 'אישור GiveIL לחשבון הסליקה'], [paidTest > 0, 'תרומת בדיקה אחת לפחות'], [!mail.enabled() || !!u.email_verified, 'אימות כתובת האימייל'], [!!ct && ct.status === 'approved', 'הסכם חתום ומאושר'], [!!c.paid || planActive(u), 'תשלום לפלטפורמה (קמפיין או מנוי)']];
  return { c, stats: st, org: u.org_name || u.org, link: base(req) + '/c/' + c.slug, teams: db.prepare('SELECT COUNT(*) n FROM teams WHERE campaign_id=?').get(c.id).n, topTeam: top?.name, unfinished, checklist, lastHour: db.prepare("SELECT COUNT(*) n FROM donations WHERE campaign_id=? AND status='paid' AND paid_at>=datetime('now','-1 hour')").get(c.id).n };
}
app.post('/api/assist', auth, limit(60, 60000), (req, res) => {
  let cx = null; try { cx = guideCtx(req.user.oid, +req.body?.campaignId || 0, req); } catch (e) { console.error('guide ctx', e.message); }
  if (req.body?.kind) { const t = guide.write(String(req.body.kind), cx, String(req.body.text || '').slice(0, 8000)); return t ? res.json({ reply: t, ai: true }) : bad(res, 'kind'); }
  const msgs = (req.body?.messages || []).slice(-12); if (!msgs.length) return bad(res, 'messages');
  const q = String(msgs[msgs.length - 1].content || '').slice(0, 3000);
  const out = guide.answer(q, cx); if (out.go && out.go[1].startsWith('c/')) out.go = cx ? [out.go[0], `#/c/${cx.c.id}/${out.go[1].slice(2)}`] : null;
  res.json({ ...out, ai: !!out.filled });
});

// ---------- pages ----------
const pub = f => path.join(__dirname, 'public', f);
// where a visit came from (shown to the super-admin): ads / facebook / google / whatsapp / direct / other site
function visitSource(req) {
  const q = req.query || {}; if (adSrc(q)) return 'ads'; if (q.fbclid || /facebook|fb\b|instagram/i.test(q.utm_source || '')) return 'facebook'; if (/whatsapp/i.test(q.utm_source || '')) return 'whatsapp';
  let h = ''; try { h = new URL(req.get('referer') || '').hostname.replace(/^www\./, ''); } catch { }
  if (!h) return 'direct'; if (h === req.hostname || h.endsWith('giveil.com')) return 'internal';
  if (/facebook|fb\.|instagram/.test(h)) return 'facebook'; if (/whatsapp|wa\.me/.test(h)) return 'whatsapp'; if (/google\./.test(h)) return 'google'; if (/bing|duckduckgo|yahoo/.test(h)) return 'search';
  if (/linkedin|lnkd/.test(h)) return 'linkedin'; if (/t\.co$|twitter|x\.com/.test(h)) return 'twitter'; if (/t\.me|telegram/.test(h)) return 'telegram'; return 'site:' + h.slice(0, 40);
}
// visits from Google Ads (auto-tagging adds gclid) are remembered for 30 days so signups can be attributed
const adSrc = q => q.gclid || q.gbraid || q.wbraid ? 'ads' : /^google$/i.test(q.utm_source || '') && /cpc|ppc|paid/i.test(q.utm_medium || '') ? 'ads' : '';
// ---------- visitor journeys (super-admin → "מבקרים"): every visitor of the main site, how far they got in signing up, and what they did ----------
// stages: 1 entered · 2 opened signup · 3 started filling · 4 step 2 · 5 step 3 · 6 step 4 · 7 sent the form · 8 registered · 9 opened a campaign · 10 campaign live
const VSTAGE = { 'reg.open': 2, 'reg.start': 3, 'reg.step2': 4, 'reg.step3': 5, 'reg.step4': 6, 'reg.submit': 7, 'reg.done': 8, 'campaign.create': 9, 'campaign.live': 10 };
const deviceOf = ua => /iphone|android.+mobile|mobile/i.test(ua) ? 'נייד' : /ipad|tablet|android/i.test(ua) ? 'טאבלט' : 'מחשב';
const VUP = db.prepare("UPDATE visitors SET last_at=datetime('now'), stage=MAX(stage,?), pages=pages+?, acts=acts+?, uid=COALESCE(?,uid) WHERE vid=?");
const VEV = db.prepare('INSERT INTO vev(vid,type,label,path) VALUES(?,?,?,?)');
function vEvent(vid, type, label = '', path = '', isPage = false, uid = null) { if (!vid) return; try { VUP.run(VSTAGE[type] || 1, isPage ? 1 : 0, isPage ? 0 : 1, uid, vid); VEV.run(vid, type, String(label).slice(0, 160), String(path).slice(0, 160)); } catch { } }
function vLink(req, uid) { const vid = req.cookies?.gv; if (!vid || !uid) return; try { db.prepare('UPDATE visitors SET uid=? WHERE vid=? AND (uid IS NULL OR uid!=?)').run(uid, vid, uid); } catch { } }
const vValid = v => /^[a-f0-9]{24}$/.test(String(v || ''));
app.use((req, res, next) => {
  if (req.method !== 'GET' || !/^\/(index\.html|app|terms|privacy|accessibility)?$/.test(req.path) || BOT.test(req.get('user-agent') || '')) return next();
  let vid = req.cookies?.gv; if (!vValid(vid)) { vid = require('crypto').randomBytes(12).toString('hex'); res.cookie('gv', vid, { maxAge: 365 * 864e5, httpOnly: false, sameSite: 'lax', secure: req.secure }); }
  try {
    const ua = String(req.get('user-agent') || '').slice(0, 200); let ref = ''; try { ref = new URL(req.get('referer') || '').hostname; } catch { }
    db.prepare("INSERT OR IGNORE INTO visitors(vid,src,landing,ref,device,ua,ip) VALUES(?,?,?,?,?,?,?)").run(vid, visitSource(req), req.originalUrl.slice(0, 160), ref.slice(0, 80), deviceOf(ua), ua, req.ip);
    vEvent(vid, 'page', '', req.path === '/index.html' ? '/' : req.path, true, null);
  } catch { }
  next();
});
// actions from the browser (no field values are ever sent – only which step/field/button)
const VT = new Set(['reg.open', 'reg.start', 'reg.step2', 'reg.step3', 'reg.step4', 'reg.submit', 'reg.error', 'reg.back', 'login.open', 'login.try', 'login.error', 'forgot', 'click', 'plan.use', 'scroll', 'leave']);
app.post('/api/t', limit(120, 60000), (req, res) => {
  const vid = req.cookies?.gv; const b = typeof req.body === 'object' ? req.body : {}; const t = String(b.t || '');
  if (vValid(vid) && VT.has(t) && !BOT.test(req.get('user-agent') || '')) { if (!db.prepare('SELECT 1 FROM visitors WHERE vid=?').get(vid)) db.prepare("INSERT OR IGNORE INTO visitors(vid,src,device,ua,ip) VALUES(?,?,?,?,?)").run(vid, 'direct', deviceOf(req.get('user-agent') || ''), String(req.get('user-agent') || '').slice(0, 200), req.ip); vEvent(vid, t, b.l || '', b.p || ''); }
  res.status(204).end();
});
// admin: list + funnel
app.get('/api/admin/visitors', auth, adm, (req, res) => {
  const days = Math.min(60, Math.max(1, +req.query.days || 1)); const since = `-${days} day`; const st = +req.query.stage || 0;
  const funnel = db.prepare(`SELECT SUM(stage>=1) s1, SUM(stage>=2) s2, SUM(stage>=3) s3, SUM(stage>=4) s4, SUM(stage>=5) s5, SUM(stage>=6) s6, SUM(stage>=7) s7, SUM(stage>=8) s8, SUM(stage>=9) s9, SUM(stage>=10) s10 FROM visitors WHERE last_at >= datetime('now',?)`).get(since);
  const rows = db.prepare(`SELECT v.vid, v.first_at, v.last_at, v.src, v.landing, v.device, v.stage, v.pages, v.acts, v.uid, u.email, COALESCE(u.org_name,u.org) org, u.name,
     (SELECT label FROM vev WHERE vid=v.vid AND type='reg.error' ORDER BY id DESC LIMIT 1) lastErr,
     (SELECT COUNT(*) FROM visitors w WHERE w.ip=v.ip AND w.vid!=v.vid) sameIp
     FROM visitors v LEFT JOIN users u ON u.id=v.uid WHERE v.last_at >= datetime('now',?) ${st ? 'AND v.stage = ' + st : ''} ORDER BY v.last_at DESC LIMIT 400`).all(since);
  res.json({ funnel, rows, live: db.prepare("SELECT COUNT(*) n FROM visitors WHERE last_at >= datetime('now','-5 minutes')").get().n });
});
app.get('/api/admin/visitors/:vid', auth, adm, (req, res) => {
  const v = db.prepare('SELECT v.*, u.email, COALESCE(u.org_name,u.org) org, u.name, u.phone FROM visitors v LEFT JOIN users u ON u.id=v.uid WHERE vid=?').get(req.params.vid); if (!v) return bad(res, 'not found', 404);
  const a = db.prepare('SELECT at, type, label, path FROM vev WHERE vid=? ORDER BY id DESC LIMIT 400').all(v.vid).map(x => ({ ...x, k: 'v' }));
  const b = v.uid ? db.prepare('SELECT at, type, msg label, campaign_id FROM events WHERE user_id=? ORDER BY id DESC LIMIT 300').all(v.uid).map(x => ({ ...x, k: 'e' })) : [];
  res.json({ v, tl: [...a, ...b].sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0)).slice(0, 600) });
});
app.use((req, res, next) => { if (req.method === 'GET' && (req.path === '/' || req.path === '/index.html' || req.path === '/login.html' || req.path.startsWith('/c/'))) { const src = adSrc(req.query); if (src) { if (!req.cookies?.src) pageView(req, 'ads:visit'); res.cookie('src', src + ':' + new Date().toISOString().slice(0, 10), { maxAge: 30 * 864e5, httpOnly: true, sameSite: 'lax', secure: req.secure }); } if (req.path === '/' || req.path === '/index.html') pageView(req, 'home'); pageView(req, 'src:' + visitSource(req)); } next(); });
// share preview image for a campaign: its share/cover image cropped to 1200×630 JPEG (WhatsApp/Facebook need a small raster image)
const ogVer = c => { const sh = J(c.settings).share || c.cover || ''; return require('crypto').createHash('md5').update(sh).digest('hex').slice(0, 8); };
app.get('/og/c/:slug.jpg', async (req, res) => {
  const c = getC(req.params.slug); if (!c) return res.sendFile(pub('og.jpg'));
  const sh = J(c.settings).share || c.cover || ''; const local = /^\/u\/[\w.-]+$/.test(sh) ? path.join(DATA_DIR, 'uploads', path.basename(sh)) : null;
  if (!local && /^https:\/\//.test(sh)) { let u = sh; try { const x = new URL(sh); if (x.hostname === 'images.unsplash.com') { for (const [k, v] of Object.entries({ w: '1200', h: '630', fit: 'crop', q: '80', fm: 'jpg' })) x.searchParams.set(k, v); x.searchParams.delete('crop'); u = x.toString(); } } catch { } return res.redirect(302, u); }
  if (!local || !fs.existsSync(local)) return res.sendFile(pub('og.jpg'), { maxAge: '1h' });
  const dir = path.join(DATA_DIR, 'og'); const out = path.join(dir, `${c.id}-${ogVer(c)}.jpg`);
  try { if (!fs.existsSync(out)) { fs.mkdirSync(dir, { recursive: true }); await require('sharp')(local).rotate().resize(1200, 630, { fit: 'cover', position: 'attention' }).jpeg({ quality: 80, mozjpeg: true }).toFile(out); } res.setHeader('Cache-Control', 'public, max-age=86400'); res.type('jpg').sendFile(out); }
  catch (e) { console.error('og', e.message); res.sendFile(pub('og.jpg')); }
});
{ const ev = require('./lib/events')(app, { db, J, bad, auth, own, stats, isTest, safeUrl, SITE, pub }); evHook = ev.forward; }
app.use(express.static(pub(''), { maxAge: '1h', setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
app.get('/c/:slug/screen', (_, res) => res.sendFile(pub('screen.html')));
app.get('/c/:slug/widget', (_, res) => res.sendFile(pub('widget.html')));
let cHtmlC = { m: 0, v: '' }; const cHtml = () => { const m = fs.statSync(pub('c.html')).mtimeMs; if (m !== cHtmlC.m) cHtmlC = { m, v: fs.readFileSync(pub('c.html'), 'utf8') }; return cHtmlC.v; };
app.get(['/c/:slug', '/c/:slug/:team'], (req, res) => {
  const c = getC(req.params.slug); if (!c) return res.status(404).sendFile(pub('404.html'));
  pageView(req, 'c:' + c.id);
  if (req.params.team && !BOT.test(req.get('user-agent') || '')) try { // ambassador link: count each visitor once (per browser)
    const t = db.prepare('SELECT id FROM teams WHERE campaign_id=? AND slug=?').get(c.id, String(req.params.team));
    const seen = String(req.cookies?.tv || '').split('.').filter(Boolean);
    if (t && !seen.includes(String(t.id))) { db.prepare('UPDATE teams SET visits=COALESCE(visits,0)+1 WHERE id=?').run(t.id); res.cookie('tv', [...seen.slice(-40), t.id].join('.'), { maxAge: 365 * 864e5, httpOnly: true, sameSite: 'lax', secure: req.secure }); }
  } catch { }
  let html = cHtml();
  const esc = s => String(s || '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const img = `${base(req)}/og/c/${encodeURIComponent(c.slug)}.jpg?v=${ogVer(c)}`;
  const st = J(c.settings); const langs = st.langs && st.langs.length ? st.langs : [c.lang || 'he'];
  let auto = c.lang || 'he'; if (st.autoLang !== false) { const al = String(req.headers['accept-language'] || '').toLowerCase().split(',').map(x => x.split(';')[0].trim().slice(0, 2)); const hit = al.find(l => langs.includes(l)); if (hit) auto = hit; } if (!/^[a-z]{2}$/.test(auto)) auto = 'he';
  html = html.replace('<html lang="he" dir="rtl">', `<html lang="he" dir="rtl" data-auto-lang="${auto}">`);
  html = html.replace('<!--META-->', `<title>${esc(c.title)}</title><meta name="description" content="${esc(c.subtitle || 'הצטרפו לקמפיין – כל תרומה מקרבת אותנו ליעד')}"><meta property="og:title" content="${esc(c.title)}"><meta property="og:description" content="${esc(c.subtitle || 'הצטרפו לקמפיין – כל תרומה מקרבת אותנו ליעד')}"><meta property="og:image" content="${esc(img)}"><meta property="og:image:secure_url" content="${esc(img)}"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:url" content="${esc(base(req) + '/c/' + c.slug)}"><meta property="og:site_name" content="GiveIL"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(img)}"><meta property="og:type" content="website"><meta name="theme-color" content="${esc(c.color)}">`).replace('<html lang="he" dir="rtl">', `<html lang="${c.lang}" dir="${c.lang === 'en' ? 'ltr' : 'rtl'}" data-auto-lang="${auto}">`);
  res.setHeader('Cache-Control', 'no-cache'); res.send(html);
});
app.get(['/app', '/app/*'], (_, res) => res.sendFile(pub('app.html')));
app.get('/', (req, res) => res.sendFile(pub('index.html')));
app.get(['/terms', '/privacy', '/accessibility'], (_, res) => res.sendFile(pub('legal.html')));
// ---- public guides hub (/madrich): helpful answers for nonprofits – also what search & AI answers cite ----
const ARTICLES = require('./lib/articles');
const hx = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function guidePage(req, a) {
  const b = base(req), url = b + (a ? '/madrich/' + a.slug : '/madrich');
  const title = a ? a.title : 'מדריכים לגיוס תרומות וקמפיינים לעמותות';
  const desc = a ? a.desc : 'מדריכים מעשיים לעמותות: קמפיין גיוס המונים, בחירת פלטפורמה לגיוס תרומות, שגרירים, ערב רתימה, תרומות חודשיות וגיוס בלי עמלה.';
  const ld = a ? [
    { '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.desc, inLanguage: 'he', datePublished: a.updated, dateModified: a.updated, mainEntityOfPage: url, image: b + '/og.jpg', author: { '@type': 'Organization', name: 'GiveIL', url: b }, publisher: { '@type': 'Organization', name: 'GiveIL', logo: { '@type': 'ImageObject', url: b + '/apple-touch-icon.png' } } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: a.faq.map(([q, ans]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: ans } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'GiveIL', item: b + '/' }, { '@type': 'ListItem', position: 2, name: 'מדריכים', item: b + '/madrich' }, { '@type': 'ListItem', position: 3, name: a.short, item: url }] }
  ] : [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description: desc, inLanguage: 'he', url, hasPart: ARTICLES.map(x => ({ '@type': 'Article', headline: x.title, url: b + '/madrich/' + x.slug })) }];
  const more = ARTICLES.filter(x => !a || x.slug !== a.slug);
  const main = a ? `<nav class="bc"><a href="/">GiveIL</a> › <a href="/madrich">מדריכים</a></nav><article><h1>${hx(a.title)}</h1><div class="meta">עודכן ${a.updated.split('-').reverse().join('.')} · צוות GiveIL</div>${a.body}
    <section class="faq"><h2>שאלות נפוצות</h2>${a.faq.map(([q, ans]) => `<details><summary>${hx(q)}</summary><p>${hx(ans)}</p></details>`).join('')}</section></article>`
    : `<nav class="bc"><a href="/">GiveIL</a> › מדריכים</nav><h1>${hx(title)}</h1><p class="lead">${hx(desc)}</p>`;
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${hx(title)} | GiveIL</title><meta name="description" content="${hx(desc)}"><link rel="canonical" href="${url}">
<meta property="og:type" content="${a ? 'article' : 'website'}"><meta property="og:title" content="${hx(title)}"><meta property="og:description" content="${hx(desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${b}/og.jpg"><meta property="og:locale" content="he_IL"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/icon.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;800&display=swap" rel="stylesheet">
${ld.map(x => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, '\\u003c')}</script>`).join('')}
<style>:root{--ink:#1c1917;--mut:#6b6762;--line:#e7e5e4;--p:#5b3df5}*{box-sizing:border-box}body{margin:0;font-family:Rubik,system-ui,sans-serif;color:var(--ink);background:#fafaf9;line-height:1.75;font-size:17px}a{color:var(--p)}
header{background:#fff;border-bottom:1px solid var(--line)}header .w{display:flex;align-items:center;justify-content:space-between;height:64px}.logo{display:flex;align-items:center;gap:8px;text-decoration:none;color:var(--ink);font-weight:800;font-size:20px}.logo img{width:30px}.logo b{color:#0038b8}
.w{max-width:820px;margin:0 auto;padding:0 20px}.btn{display:inline-flex;align-items:center;min-height:42px;padding:0 18px;border-radius:999px;background:var(--ink);color:#fff;text-decoration:none;font-weight:600;font-size:15px}.btn.wa{background:#25d366}
main{padding:28px 0 60px}.bc{font-size:13px;color:var(--mut)}.bc a{color:var(--mut)}h1{font-size:clamp(28px,4.5vw,40px);line-height:1.2;margin:14px 0 8px;letter-spacing:-.01em}.meta{font-size:13px;color:var(--mut);margin-bottom:22px}
.lead{font-size:19px;color:#44403c}h2{font-size:23px;margin:34px 0 8px;line-height:1.3}ul{padding-inline-start:22px}li{margin:4px 0}
.faq{margin-top:40px;border-top:1px solid var(--line);padding-top:8px}details{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin:10px 0}summary{font-weight:600;cursor:pointer}details p{margin:8px 0 0;color:#44403c}
.cta{margin:44px 0 0;padding:26px;border-radius:22px;background:linear-gradient(135deg,#14161f,#1f2340);color:#fff}.cta h2{margin:0 0 6px;color:#fff}.cta p{color:#c7cbe0;margin:0 0 16px}.cta .row{display:flex;gap:10px;flex-wrap:wrap}.cta .btn{background:#fff;color:#14161f}.cta .btn.wa{background:#25d366;color:#fff}
.list{display:grid;gap:12px;margin-top:22px}.list a{display:block;background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px 20px;text-decoration:none;color:var(--ink)}.list a:hover{border-color:#c7bfff}.list b{display:block;font-size:18px;margin-bottom:4px}.list span{font-size:15px;color:var(--mut)}
.more{margin-top:40px}.more h2{font-size:19px}footer{border-top:1px solid var(--line);padding:22px 0;font-size:13px;color:var(--mut)}footer .w{display:flex;gap:16px;flex-wrap:wrap}footer a{color:var(--mut)}</style></head><body>
<header><div class="w"><a class="logo" href="/"><img src="/logo.svg" alt=""><span dir="ltr">Give<b>IL</b></span></a><a class="btn" href="/app#reg">פתיחת קמפיין</a></div></header>
<main><div class="w">${main}
${a ? '' : `<div class="list">${ARTICLES.map(x => `<a href="/madrich/${x.slug}"><b>${hx(x.title)}</b><span>${hx(x.desc)}</span></a>`).join('')}</div>`}
<div class="cta"><h2>רוצים לפתוח קמפיין?</h2><p>בונים ובודקים חינם, משלמים רק כשעולים לאוויר – בלי עמלה מהתרומות. אפשר גם ניהול קמפיין מלא בליווי צוות וחמ״ל.</p><div class="row"><a class="btn" href="/app#reg">פתיחת קמפיין</a><a class="btn wa" href="/#managed">ליווי מלא – דברו איתנו</a></div></div>
${a ? `<div class="more"><h2>עוד מדריכים</h2><div class="list">${more.slice(0, 4).map(x => `<a href="/madrich/${x.slug}"><b>${hx(x.title)}</b></a>`).join('')}</div></div>` : ''}
</div></main><footer><div class="w"><a href="/">GiveIL – פלטפורמה לגיוס תרומות לעמותות</a><a href="/madrich">מדריכים</a><a href="/terms">תקנון</a><a href="/privacy">פרטיות</a><a href="/accessibility">נגישות</a></div></footer>
<script>(()=>{try{navigator.sendBeacon('/api/t',new Blob([JSON.stringify({t:'view',l:document.title.slice(0,120),p:location.pathname})],{type:'application/json'}))}catch{}})()</script></body></html>`;
}
app.get('/madrich', (req, res) => { pageView(req, 'madrich'); res.set('Cache-Control', 'public, max-age=600').type('html').send(guidePage(req, null)); });
app.get('/madrich/:slug', (req, res) => { const a = ARTICLES.find(x => x.slug === req.params.slug); if (!a) return res.redirect(301, '/madrich'); pageView(req, 'madrich:' + a.slug); res.set('Cache-Control', 'public, max-age=600').type('html').send(guidePage(req, a)); });
// llms.txt – a plain summary for AI assistants and answer engines
app.get('/llms.txt', (req, res) => { const b = base(req); res.type('text/plain; charset=utf-8').send(`# GiveIL\n\n> GiveIL (giveil.com) היא פלטפורמה ישראלית לגיוס תרומות וגיוס המונים לעמותות וארגונים: דף קמפיין חי בכמה שפות, שגרירים עם קישור אישי, מסך אירוע לערבי רתימה, תרומות חודשיות והוראות קבע, והכסף נכנס ישירות לחשבון העמותה דרך חברת הסליקה שלה – בלי עמלה מהתרומות. אפשר גם ניהול קמפיין מלא בליווי צוות וחמ״ל מקצועי.\n\n## עיקרי השירות\n- מחיר קבוע, 0% מהתרומות; בונים ובודקים חינם ומשלמים רק כשעולים לאוויר\n- חיבור לחברת הסליקה של העמותה: קארדקום, PayPlus, Hyp, פלאקארד, iCredit, PayMe, Z-Credit, טרנזילה, SUMIT, Morning, משולם, PayPal ועוד\n- שגרירים ללא הגבלה, דף אישי לכל שגריר, טבלת שגרירים\n- 4 שפות (עברית, אנגלית, צרפתית, ספרדית), מסך אירוע חי, תרומה חודשית, הקדשות, תרומה אנונימית\n- דף בית לעמותה עם כל התרומות מכל הקמפיינים, הרשאות לאנשי צוות, פיקסל פייסבוק\n- ליווי מלא: תכנון, בניית הדף, שגרירים, חמ״ל בזמן הקמפיין והפקת ערבי רתימה\n\n## מדריכים\n${ARTICLES.map(x => `- [${x.title}](${b}/madrich/${x.slug}): ${x.desc}`).join('\n')}\n\n## קישורים\n- [דף הבית](${b}/)\n- [פתיחת קמפיין](${b}/app)\n- [תקנון](${b}/terms)\n`); });
app.get('/sitemap.xml', (req, res) => { const b = base(req); const slugs = db.prepare("SELECT slug FROM campaigns WHERE status='live'").all().map(x => x.slug); res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + [...new Set(['', '/madrich', ...ARTICLES.map(a => '/madrich/' + a.slug), '/terms', '/privacy', '/accessibility', ...slugs.map(x => '/c/' + x)])].map(u => `<url><loc>${b}${u || "/"}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod><changefreq>${u ? 'weekly' : 'daily'}</changefreq><priority>${u ? (u.startsWith('/c/') || u.startsWith('/madrich') ? '0.8' : '0.3') : '1.0'}</priority></url>`).join('') + '</urlset>'); });
app.get('/googlea5465d57b3c11b70.html', (_, res) => res.type('text/html').send('google-site-verification: googlea5465d57b3c11b70.html'));
app.get('/googlee6bc6aded989c64d.html', (_, res) => res.type('text/html').send('google-site-verification: googlee6bc6aded989c64d.html'));
app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nAllow: /\nSitemap: ' + base(req) + '/sitemap.xml\nDisallow: /app\nDisallow: /pay/\nDisallow: /api/\n'));
app.use((err, req, res, next) => { // anything that throws inside a route lands here instead of crashing
  if (err && (err.code === 'LIMIT_FILE_SIZE' || err.name === 'MulterError')) return bad(res, err.code === 'LIMIT_FILE_SIZE' ? 'הקובץ גדול מדי' : 'שגיאה בהעלאת הקובץ');
  if (err?.type === 'entity.too.large') return bad(res, 'הבקשה גדולה מדי', 413);
  if (err?.type === 'entity.parse.failed') return bad(res, 'בקשה לא תקינה');
  logEvent('server.error', { level: 'error', ip: req.ip, uid: (() => { try { return verify(req.cookies?.sid)?.uid; } catch { return null; } })(), msg: `${req.method} ${req.path}: ${err?.message || err}`.slice(0, 300), meta: { stack: String(err?.stack || '').split('\n').slice(0, 5).join(' | ') } });
  console.error(err); if (res.headersSent) return; res.status(500).json({ error: 'שגיאה זמנית בשרת. נסו שוב, ואם זה חוזר – פנו אלינו.' });
});
app.get(['/favicon.ico', '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png'], (_, res) => { res.setHeader('Cache-Control', 'public, max-age=604800'); res.type('image/svg+xml').sendFile(pub('icon.svg')); });
const SCAN = /(\.env|\.git|\.ssh|\.svn|wp-|phpinfo|\.php$|\.sql$|backup|dump|secrets|actuator|\.npmrc|docker-compose|\.bash_history|server\.key|config\.(xml|php|json))/i; const scanSeen = new Map();
app.use((req, res) => { if (SCAN.test(req.path)) { const t = scanSeen.get(req.ip) || 0; if (Date.now() - t > 10 * 60e3) { if (scanSeen.size > 5000) scanSeen.clear(); scanSeen.set(req.ip, Date.now()); logEvent('security.scan', { level: 'warn', ip: req.ip, msg: 'סריקת פרצות אוטומטית (נחסמה): ' + req.path.slice(0, 80) }); } } res.status(404).sendFile(pub('404.html')); });
process.on('unhandledRejection', e => { logEvent('server.error', { level: 'error', msg: 'unhandled: ' + String(e?.message || e).slice(0, 280) }); console.error(e); });
process.on('uncaughtException', e => { logEvent('server.crash', { level: 'error', msg: String(e?.message || e).slice(0, 280), meta: { stack: String(e?.stack || '').split('\n').slice(0, 5).join(' | ') } }); console.error(e); process.exit(1); });

// ---- demo campaign shown in the landing-page phone (test data, clearly labelled "קמפיין לדוגמה") ----
(function ensureDemo() {
  try {
    const COVER = 'https://images.unsplash.com/photo-1593113616828-6f22bca04804?auto=format&fit=crop&w=1400&q=80';
    let c = db.prepare("SELECT * FROM campaigns WHERE slug='demo'").get();
    const end = new Date(Date.now() + 9 * 864e5 + 5 * 36e5).toISOString().slice(0, 16);
    const story = 'לקראת החג, 500 משפחות בפריפריה מחכות לחבילת מזון מלאה – עוף, ירקות, מוצרי יסוד ומתוק לילדים.\n\nכל חבילה נארזת בידי מתנדבים ומגיעה עד הבית, בצנעה ובכבוד. ₪180 = חבילה אחת למשפחה אחת.\n\nהמטרה: 500 חבילות עד ערב החג. כל שקל נכנס ישירות לחשבון העמותה.\n\n(צילום: Joel Muniz, Unsplash)';
    if (!c) {
      const adm = db.prepare("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1").get();
      const r = db.prepare("INSERT INTO campaigns(user_id,slug,title,subtitle,story,goal,currency,status,cover,color,lang,settings,end_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(adm ? adm.id : null, 'demo', 'חבילות מזון לחג – 500 משפחות', 'כל ₪180 = חבילה מלאה למשפחה אחת', story, 90000, 'ILS', 'test', COVER, '#0f766e', 'he', JSON.stringify({ demo: true }), end);
      c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(r.lastInsertRowid);
    } else {
      const s = J(c.settings); s.demo = true;
      db.prepare('UPDATE campaigns SET cover=CASE WHEN cover=\'\' THEN ? ELSE cover END, story=CASE WHEN story=\'\' THEN ? ELSE story END, settings=?, end_at=? WHERE id=?').run(COVER, story, JSON.stringify(s), end, c.id);
    }
    if (!db.prepare('SELECT 1 FROM levels WHERE campaign_id=?').get(c.id)) [['חבילה למשפחה', 180], ['שתי משפחות', 360], ['סל חג לחודש', 1000], ['שותף/ה מרכזי/ת', 5000]].forEach(([n, a], i) => db.prepare('INSERT INTO levels(campaign_id,name,amount,pos) VALUES(?,?,?,?)').run(c.id, n, a, i));
    if (!db.prepare('SELECT 1 FROM teams WHERE campaign_id=?').get(c.id)) [['הרב יוסי', 'yossi', 20000], ['משפחת לוי', 'levi', 12000], ['נועה – שגרירה', 'noa', 8000], ['ישיבת אור', 'or', 15000]].forEach(([n, sl, g], i) => db.prepare('INSERT INTO teams(campaign_id,slug,name,goal,pos) VALUES(?,?,?,?,?)').run(c.id, sl, n, g, i));
    if (db.prepare("SELECT COUNT(*) n FROM donations WHERE campaign_id=? AND test=1 AND status='paid'").get(c.id).n < 10) {
      const teams = db.prepare('SELECT id FROM teams WHERE campaign_id=? ORDER BY pos').all(c.id).map(t => t.id);
      const D = [['משפחת כהן', 1800, 'לעילוי נשמת סבא משה'], ['דוד ושרה', 360, ''], ['', 180, ''], ['אבי מזרחי', 540, 'לרפואת רחל בת לאה'], ['יעל ב.', 180, 'שיהיה חג שמח לכולם ❤️'], ['משפחת פרץ', 5000, ''], ['רונית', 250, ''], ['', 1000, ''], ['איתי ונועם', 360, 'מהכיתה של ד׳2'], ['שמעון', 180, ''], ['משפחת אזולאי', 2600, 'להצלחת הילדים'], ['תמר', 100, ''], ['חברת אור-טק', 10000, 'בשם כל העובדים'], ['מיכל ויוני', 720, ''], ['', 180, ''], ['הדס', 180, 'בזכות הסבתא שלי'], ['משפחת ביטון', 1800, ''], ['אריאל', 360, ''], ['', 500, 'לזכות עם ישראל'], ['שירה', 180, ''], ['משה ורבקה', 3600, 'לעילוי נשמת אמא'], ['נתנאל', 180, ''], ['משפחת שלום', 1000, ''], ['אורית', 360, 'לרפואת יעקב בן שושנה'], ['ליאור', 250, ''], ['', 18000, ''], ['בני ומאיה', 540, ''], ['גלית', 180, ''], ['משפחת דהן', 1800, 'לזיווג הגון לבת'], ['עמית', 180, ''], ['קהילת נווה', 7200, ''], ['יוסי ש.', 360, ''], ['', 180, ''], ['רחל', 720, 'שנה טובה ומתוקה'], ['משפחת גבאי', 1000, ''], ['אלון', 180, ''], ['חן ודניאל', 360, ''], ['משפחת וקנין', 5400, ''], ['נעמה', 180, ''], ['שלמה', 1800, 'להצלחה בעסקים']];
      const now = Date.now(); const ins = db.prepare("INSERT INTO donations(campaign_id,team_id,amount,currency,name,dedication,anonymous,status,test,provider,created,paid_at) VALUES(?,?,?,?,?,?,?,'paid',1,'test',?,?)");
      D.forEach(([n, a, ded], i) => { const t = new Date(now - (D.length - i) * (2.6 * 36e5) - (i % 5) * 7e5).toISOString().replace('T', ' ').slice(0, 19); ins.run(c.id, i % 3 === 0 ? teams[i % teams.length] || null : null, a, 'ILS', n || 'אנונימי', ded, n ? 0 : 1, t, t); });
    }
  } catch (e) { console.error('demo seed', e.message); }
})();
const server = app.listen(process.env.PORT || 3000, () => { console.log('ttm up'); logEvent('server.start', { msg: (process.env.RAILWAY_GIT_COMMIT_SHA || 'local').slice(0, 7) }); });
server.keepAliveTimeout = 65000; server.headersTimeout = 66000;
