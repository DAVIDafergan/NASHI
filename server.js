// רבינו שלי – קופת שקל ליום. Express + SQLite.
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const cookieParser = require('cookie-parser');
const Database = require('better-sqlite3');
const CITY = require('./public/cities');
const { HebrewCalendar, flags: HF } = require('@hebcal/core');
// ---- mornings calendar: Shabbat & Yom Tov (Israel) are not counted ----
const isoD = d => d.toISOString().slice(0, 10);
const OFF = new Map(); // 'YYYY-MM-DD' -> name
(() => { const loc = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  for (const e of HebrewCalendar.calendar({ start: new Date(2024, 0, 1), end: new Date(2033, 11, 31), il: true })) if (e.getFlags() & HF.CHAG) OFF.set(loc(e.getDate().greg()), e.render('he').replace(/[\u0591-\u05C7]/g, '').replace(/ \d{4}$/, '')); })();
const offName = ds => OFF.get(ds) || (new Date(ds + 'T12:00:00Z').getUTCDay() === 6 ? 'שבת' : null);
const CUM = new Map(); (() => { let n = 0; for (let d = new Date('2024-01-01T12:00:00Z'); d < new Date('2034-01-01T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) { const k = isoD(d); if (!offName(k)) n++; CUM.set(k, n); } })();
const cum = ds => CUM.get(ds) ?? (ds < '2024-01-01' ? 0 : CUM.get('2033-12-31'));
const addDay = (ds, n) => { const d = new Date(ds + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return isoD(d); };
const mornings = (a, b) => (a > b ? 0 : cum(b) - cum(addDay(a, -1))); // inclusive count of counted mornings

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'rabeinu.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS members(id INTEGER PRIMARY KEY AUTOINCREMENT, box_no INTEGER UNIQUE, first TEXT, last TEXT, phone TEXT UNIQUE, email TEXT DEFAULT '', street TEXT DEFAULT '', house TEXT DEFAULT '', apt TEXT DEFAULT '', city TEXT DEFAULT '', region TEXT DEFAULT '', lat REAL, lng REAL, notes TEXT DEFAULT '', pin TEXT, amount INTEGER DEFAULT 1, prayer TEXT DEFAULT 'ויברך דוד', start_date TEXT, last_empty TEXT DEFAULT '', box_status TEXT DEFAULT 'new', courier TEXT DEFAULT '', delivered_at TEXT DEFAULT '', remind_channel TEXT DEFAULT 'none', remind_time TEXT DEFAULT '07:30', remind_days TEXT DEFAULT '012345', ref_code TEXT UNIQUE, referred_by INTEGER, public INTEGER DEFAULT 1, source TEXT DEFAULT '', created TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS checkins(member_id INTEGER, day TEXT, PRIMARY KEY(member_id, day));
CREATE TABLE IF NOT EXISTS collections(id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER, kind TEXT, amount_est INTEGER DEFAULT 0, amount_actual INTEGER DEFAULT 0, kavana TEXT DEFAULT '', status TEXT DEFAULT 'requested', preferred TEXT DEFAULT '', note TEXT DEFAULT '', created TEXT DEFAULT (datetime('now')), done_at TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS reminders(id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER, channel TEXT, day TEXT, status TEXT, info TEXT DEFAULT '', created TEXT DEFAULT (datetime('now')), UNIQUE(member_id, day));
CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT);
CREATE INDEX IF NOT EXISTS m_city ON members(city); CREATE INDEX IF NOT EXISTS m_status ON members(box_status);
`);

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); res.setHeader('X-Frame-Options', 'SAMEORIGIN'); if (process.env.RAILWAY_ENVIRONMENT) res.setHeader('Strict-Transport-Security', 'max-age=31536000'); next(); });
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());

// ---------- helpers ----------
const SECRET = process.env.SECRET || (() => { const f = path.join(DATA_DIR, 'secret.txt'); try { return fs.readFileSync(f, 'utf8'); } catch { const s = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(f, s); return s; } })();
const hmac = v => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
const sign = o => { const p = Buffer.from(JSON.stringify(o)).toString('base64url'); return p + '.' + hmac(p); };
const unsign = t => { if (!t) return null; const [p, s] = String(t).split('.'); if (!p || !s || hmac(p) !== s) return null; try { const o = JSON.parse(Buffer.from(p, 'base64url')); return o.exp > Date.now() ? o : null; } catch { return null; } };
const hashPw = pw => { const salt = crypto.randomBytes(16).toString('hex'); return salt + ':' + crypto.scryptSync(String(pw), salt, 32).toString('hex'); };
const checkPw = (pw, h) => { const [salt, k] = String(h || '').split(':'); if (!salt || !k) return false; const a = Buffer.from(k, 'hex'), b = crypto.scryptSync(String(pw), salt, 32); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const bad = (res, m, c = 400) => res.status(c).json({ error: m });
const J = s => { try { return JSON.parse(s || '{}'); } catch { return {}; } };
const getKV = k => { const r = db.prepare('SELECT v FROM kv WHERE k=?').get(k); return r ? J(r.v) : {}; };
const setKV = (k, v) => db.prepare('INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k, JSON.stringify(v));
const DEF = { ticketPrice: 3800, targetDate: '2027-09-30', goal: 1000, donateUrl: '', whatsapp: '', orgName: 'רבינו שלי', showRecent: true };
const S = () => ({ ...DEF, ...getKV('settings') });
const cookieOpts = { httpOnly: true, sameSite: 'lax', maxAge: 365 * 864e5, secure: !!process.env.RAILWAY_ENVIRONMENT };
const phoneNorm = p => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('972')) d = '0' + d.slice(3); return d; };
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' }); // YYYY-MM-DD
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const hits = new Map();
const limit = (n, ms) => (req, res, next) => { const k = req.ip + req.path; const now = Date.now(); const a = (hits.get(k) || []).filter(t => now - t < ms); a.push(now); hits.set(k, a); if (a.length > n) return bad(res, 'יותר מדי ניסיונות, נסו שוב בעוד כמה דקות', 429); next(); };

const member = req => { const s = unsign(req.cookies.rm); return s?.m ? db.prepare('SELECT * FROM members WHERE id=?').get(s.m) : null; };
const mAuth = (req, res, next) => { req.m = member(req); if (!req.m) return bad(res, 'auth', 401); next(); };
const isAdmin = req => !!unsign(req.cookies.ra)?.a;
const aAuth = (req, res, next) => isAdmin(req) ? next() : bad(res, 'auth', 401);

function boxState(m) {
  const t = today(); const emptied = m.last_empty && m.last_empty >= m.start_date;
  const days = emptied ? mornings(addDay(m.last_empty, 1), t) : mornings(m.start_date, t);
  const total = mornings(m.start_date, t);
  const checks = db.prepare('SELECT day FROM checkins WHERE member_id=? ORDER BY day DESC LIMIT 400').all(m.id).map(r => r.day);
  const set = new Set(checks); let streak = 0; let d = set.has(t) || offName(t) ? t : addDay(t, -1);
  for (let i = 0; i < 800; i++) { if (offName(d)) { d = addDay(d, -1); continue; } if (!set.has(d)) break; streak++; d = addDay(d, -1); }
  const s = S(); const left = mornings(addDay(t, 1), s.targetDate);
  const off = []; for (let i = 0; i < 28; i++) { const k = addDay(t, -i); const n = offName(k); if (n) off.push({ day: k, name: n }); }
  return { balance: days * m.amount, days, totalDays: total, checkedToday: set.has(t), todayOff: offName(t), tomorrowOff: offName(addDay(t, 1)), streak, checkins: checks.length, untilTarget: left, projected: (days + left) * m.amount, recent: checks.slice(0, 60), off };
}
const pubMember = m => ({ id: m.id, box_no: m.box_no, first: m.first, last: m.last, phone: m.phone, email: m.email, street: m.street, house: m.house, apt: m.apt, city: m.city, amount: m.amount, prayer: m.prayer, start_date: m.start_date, box_status: m.box_status, remind_channel: m.remind_channel, remind_time: m.remind_time, remind_days: m.remind_days, ref_code: m.ref_code, public: m.public, refs: db.prepare('SELECT COUNT(*) n FROM members WHERE referred_by=?').get(m.id).n });

// ---------- public ----------
let statsCache = { t: 0, v: null };
function stats() {
  if (Date.now() - statsCache.t < 20000 && statsCache.v) return statsCache.v;
  const s = S(); const t = today();
  const all = db.prepare("SELECT city,lat,lng,amount,start_date FROM members WHERE box_status!='cancelled'").all();
  let daily = 0, projected = 0; const byCity = {};
  for (const m of all) { daily += m.amount; projected += mornings(m.start_date, s.targetDate) * m.amount; if (m.lat) { const k = m.city; (byCity[k] ||= { c: k, lat: m.lat, lng: m.lng, n: 0 }).n++; } }
  const recent = s.showRecent ? db.prepare("SELECT first, city, created FROM members WHERE public=1 AND box_status!='cancelled' ORDER BY id DESC LIMIT 12").all() : [];
  const v = { boxes: all.length, cities: Object.keys(byCity).length, daily, projected, tickets: Math.floor(projected / s.ticketPrice), ticketPrice: s.ticketPrice, targetDate: s.targetDate, daysLeft: mornings(addDay(t, 1), s.targetDate), calDaysLeft: Math.max(0, dayDiff(t, s.targetDate)), yearMornings: mornings(t, addDay(t, 364)), todayOff: offName(t), goal: s.goal, points: Object.values(byCity), recent, whatsapp: s.whatsapp };
  statsCache = { t: Date.now(), v }; return v;
}
app.get('/api/stats', (_, res) => res.json(stats()));

app.post('/api/join', limit(6, 600000), (req, res) => {
  const b = req.body || {}; const str = (v, n) => String(v ?? '').trim().slice(0, n);
  const first = str(b.first, 40), last = str(b.last, 40), phone = phoneNorm(b.phone), email = str(b.email, 120).toLowerCase();
  if (first.length < 2) return bad(res, 'נא להזין שם פרטי'); if (last.length < 2) return bad(res, 'נא להזין שם משפחה');
  if (!/^05\d{8}$/.test(phone)) return bad(res, 'נא להזין מספר נייד ישראלי תקין');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad(res, 'כתובת המייל לא תקינה');
  const city = str(b.city, 60), street = str(b.street, 80), house = str(b.house, 10);
  if (city.length < 2 || street.length < 2 || !house) return bad(res, 'נא להשלים כתובת מלאה – לשם נביא את הקופה');
  const pin = String(b.pin || ''); if (!/^\d{4,6}$/.test(pin)) return bad(res, 'קוד אישי: 4–6 ספרות');
  if (!b.consent) return bad(res, 'נא לאשר את התנאים');
  if (db.prepare('SELECT 1 FROM members WHERE phone=?').get(phone)) return bad(res, 'המספר הזה כבר רשום – היכנסו לאזור האישי', 409);
  const amount = Math.min(100, Math.max(1, Math.round(+b.amount || 1)));
  const c = CITY.find(city); const ref = b.ref ? db.prepare('SELECT id FROM members WHERE ref_code=?').get(str(b.ref, 20)) : null;
  const ch = ['sms', 'whatsapp', 'email', 'call', 'none'].includes(b.remind_channel) ? b.remind_channel : 'none';
  const time = /^\d{2}:\d{2}$/.test(b.remind_time || '') ? b.remind_time : '07:30';
  const boxNo = (db.prepare('SELECT MAX(box_no) m FROM members').get().m || 0) + 1;
  let code; do code = crypto.randomBytes(4).toString('base64url').replace(/[-_]/g, 'x').slice(0, 6); while (db.prepare('SELECT 1 FROM members WHERE ref_code=?').get(code));
  const r = db.prepare('INSERT INTO members(box_no,first,last,phone,email,street,house,apt,city,region,lat,lng,pin,amount,prayer,start_date,remind_channel,remind_time,ref_code,referred_by,public,source) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(boxNo, first, last, phone, email, street, house, str(b.apt, 10), c ? c.name : city, c ? c.region : 'אחר', c?.lat ?? null, c?.lng ?? null, hashPw(pin), amount, str(b.prayer, 40) || 'ויברך דוד', today(), ch, time, code, ref?.id || null, b.public === false ? 0 : 1, str(b.source, 40));
  statsCache.t = 0;
  res.cookie('rm', sign({ m: r.lastInsertRowid, exp: Date.now() + 365 * 864e5 }), cookieOpts);
  res.json({ ok: true, box_no: boxNo, ref_code: code });
  notifyAdmin(`קופה חדשה #${boxNo}`, `${first} ${last} · ${c ? c.name : city} · ₪${amount} ליום`);
});
app.post('/api/login', limit(10, 600000), (req, res) => {
  const m = db.prepare('SELECT * FROM members WHERE phone=?').get(phoneNorm(req.body?.phone));
  if (!m || !checkPw(req.body?.pin, m.pin)) return bad(res, 'מספר הטלפון או הקוד לא נכונים');
  res.cookie('rm', sign({ m: m.id, exp: Date.now() + 365 * 864e5 }), cookieOpts); res.json({ ok: true });
});
app.post('/api/logout', (_, res) => { res.clearCookie('rm'); res.clearCookie('ra'); res.json({ ok: true }); });

// ---------- member ----------
app.get('/api/me', mAuth, (req, res) => res.json({ member: pubMember(req.m), box: boxState(req.m), settings: { ticketPrice: S().ticketPrice, targetDate: S().targetDate, donate: !!S().donateUrl, whatsapp: S().whatsapp }, collections: db.prepare('SELECT id,kind,amount_est,amount_actual,kavana,status,preferred,created,done_at FROM collections WHERE member_id=? ORDER BY id DESC LIMIT 20').all(req.m.id) }));
app.post('/api/me/checkin', mAuth, (req, res) => { const off = offName(today()); if (off) return bad(res, off === 'שבת' ? 'שבת שלום! בשבת לא שמים – נתראה במוצאי שבת' : `${off} – חג שמח! היום לא שמים`); db.prepare('INSERT OR IGNORE INTO checkins(member_id,day) VALUES(?,?)').run(req.m.id, today()); res.json({ ok: true, box: boxState(req.m) }); });
app.put('/api/me', mAuth, (req, res) => {
  const b = req.body || {}; const m = req.m; const str = (v, n) => String(v ?? '').trim().slice(0, n);
  const ch = ['sms', 'whatsapp', 'email', 'call', 'none'].includes(b.remind_channel) ? b.remind_channel : m.remind_channel;
  const time = /^\d{2}:\d{2}$/.test(b.remind_time || '') ? b.remind_time : m.remind_time;
  const days = typeof b.remind_days === 'string' ? b.remind_days.replace(/[^0-6]/g, '').slice(0, 7) : m.remind_days;
  const email = b.email !== undefined ? str(b.email, 120).toLowerCase() : m.email; if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad(res, 'כתובת המייל לא תקינה');
  if (ch === 'email' && !email) return bad(res, 'לתזכורת במייל צריך להזין כתובת מייל');
  const city = b.city !== undefined ? str(b.city, 60) : m.city; const c = CITY.find(city);
  db.prepare('UPDATE members SET remind_channel=?, remind_time=?, remind_days=?, email=?, amount=?, prayer=?, street=?, house=?, apt=?, city=?, region=?, lat=?, lng=?, public=? WHERE id=?').run(ch, time, days, email, b.amount ? Math.min(100, Math.max(1, Math.round(+b.amount))) : m.amount, b.prayer ? str(b.prayer, 40) : m.prayer, b.street !== undefined ? str(b.street, 80) : m.street, b.house !== undefined ? str(b.house, 10) : m.house, b.apt !== undefined ? str(b.apt, 10) : m.apt, c ? c.name : city, c ? c.region : m.region, c?.lat ?? m.lat, c?.lng ?? m.lng, b.public === undefined ? m.public : (b.public ? 1 : 0), m.id);
  statsCache.t = 0; res.json({ ok: true });
});
app.post('/api/me/pickup', mAuth, (req, res) => {
  if (db.prepare("SELECT 1 FROM collections WHERE member_id=? AND kind='pickup' AND status IN ('requested','scheduled')").get(req.m.id)) return bad(res, 'כבר יש בקשת איסוף פתוחה – השליח בדרך');
  const st = boxState(req.m); db.prepare("INSERT INTO collections(member_id,kind,amount_est,preferred,note) VALUES(?,?,?,?,?)").run(req.m.id, 'pickup', st.balance, String(req.body?.preferred || '').slice(0, 80), String(req.body?.note || '').slice(0, 200));
  res.json({ ok: true }); notifyAdmin(`בקשת איסוף – קופה #${req.m.box_no}`, `${req.m.first} ${req.m.last}, ${req.m.street} ${req.m.house} ${req.m.city} · כ-₪${st.balance}`);
});
app.post('/api/me/donate', mAuth, (req, res) => {
  const st = boxState(req.m); const amount = Math.max(1, Math.round(+req.body?.amount || st.balance || 1)); const kavana = String(req.body?.kavana || '').slice(0, 120);
  const r = db.prepare("INSERT INTO collections(member_id,kind,amount_est,kavana,status) VALUES(?,?,?,?,'pending')").run(req.m.id, 'donation', amount, kavana);
  const url = String(S().donateUrl || '').replace(/\{(amount|box|name|phone|id)\}/g, (_, k) => encodeURIComponent(k === 'amount' ? amount : k === 'box' ? req.m.box_no : k === 'name' ? req.m.first + ' ' + req.m.last : k === 'phone' ? req.m.phone : r.lastInsertRowid));
  res.json({ ok: true, id: r.lastInsertRowid, url });
});
app.post('/api/me/donate/:id/done', mAuth, (req, res) => {
  const c = db.prepare("SELECT * FROM collections WHERE id=? AND member_id=? AND kind='donation'").get(req.params.id, req.m.id); if (!c) return bad(res, 'not found', 404);
  db.prepare("UPDATE collections SET status='reported' WHERE id=?").run(c.id); db.prepare('UPDATE members SET last_empty=? WHERE id=?').run(today(), req.m.id);
  res.json({ ok: true }); notifyAdmin(`תרומה מכוונת – קופה #${req.m.box_no}`, `₪${c.amount_est}${c.kavana ? ' · ' + c.kavana : ''} – לבדיקה מול הסליקה`);
});

// ---------- admin ----------
app.post('/api/admin/login', limit(8, 600000), (req, res) => {
  const pw = process.env.ADMIN_PASSWORD; if (!pw) return bad(res, 'ADMIN_PASSWORD לא הוגדר בשרת');
  const a = Buffer.from(String(req.body?.password || '')), b = Buffer.from(pw);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return bad(res, 'סיסמה שגויה');
  res.cookie('ra', sign({ a: 1, exp: Date.now() + 30 * 864e5 }), { ...cookieOpts, maxAge: 30 * 864e5 }); res.json({ ok: true });
});
app.get('/api/admin/me', (req, res) => res.json({ admin: isAdmin(req) }));
app.get('/api/admin/overview', aAuth, (req, res) => {
  const s = S(); const st = stats(); const t = today();
  const q = (sql, ...a) => db.prepare(sql).all(...a);
  const g = (sql, ...a) => db.prepare(sql).get(...a);
  const collected = g("SELECT COALESCE(SUM(amount_actual),0) s, COUNT(*) n FROM collections WHERE (kind='pickup' AND status='collected') OR (kind='donation' AND status='paid')");
  const reported = g("SELECT COALESCE(SUM(amount_est),0) s, COUNT(*) n FROM collections WHERE kind='donation' AND status='reported'");
  const owed = q("SELECT * FROM members WHERE box_status!='cancelled'").reduce((a, m) => a + boxState(m).balance, 0);
  res.json({
    stats: st, settings: s, today: t,
    totals: { members: g('SELECT COUNT(*) n FROM members').n, cancelled: g("SELECT COUNT(*) n FROM members WHERE box_status='cancelled'").n, todaySignups: g("SELECT COUNT(*) n FROM members WHERE date(created,'+3 hours')=?", t).n, weekSignups: g("SELECT COUNT(*) n FROM members WHERE created>=datetime('now','-7 day')").n, avgAmount: g("SELECT COALESCE(AVG(amount),0) a FROM members WHERE box_status!='cancelled'").a, checkinsToday: g('SELECT COUNT(*) n FROM checkins WHERE day=?', t).n, inBoxes: owed, collected: collected.s, collectedN: collected.n, reported: reported.s, reportedN: reported.n, referred: g('SELECT COUNT(*) n FROM members WHERE referred_by IS NOT NULL').n },
    status: q("SELECT box_status k, COUNT(*) n FROM members GROUP BY box_status"),
    regions: q("SELECT region k, COUNT(*) n, SUM(amount) d, SUM(box_status='delivered') del FROM members WHERE box_status!='cancelled' GROUP BY region ORDER BY n DESC"),
    cities: q("SELECT city k, region, COUNT(*) n, SUM(amount) d, SUM(box_status='delivered') del, SUM(box_status IN ('new','assigned','out')) pend FROM members WHERE box_status!='cancelled' GROUP BY city ORDER BY n DESC"),
    channels: q("SELECT remind_channel k, COUNT(*) n FROM members GROUP BY remind_channel"),
    prayers: q("SELECT prayer k, COUNT(*) n FROM members GROUP BY prayer ORDER BY n DESC"),
    amounts: q("SELECT amount k, COUNT(*) n FROM members GROUP BY amount ORDER BY amount"),
    daily: q("SELECT date(created,'+3 hours') d, COUNT(*) n FROM members WHERE created>=datetime('now','-30 day') GROUP BY d ORDER BY d"),
    topRefs: q("SELECT m.box_no, m.first, m.last, m.city, COUNT(r.id) n FROM members m JOIN members r ON r.referred_by=m.id GROUP BY m.id ORDER BY n DESC LIMIT 10"),
    openPickups: g("SELECT COUNT(*) n FROM collections WHERE kind='pickup' AND status IN ('requested','scheduled')").n,
    reminders: { email: !!process.env.RESEND_API_KEY, sms: !!getKV('sms').url, queued: g("SELECT COUNT(*) n FROM reminders WHERE status='queued' AND day=?", t).n, sent: g("SELECT COUNT(*) n FROM reminders WHERE status='sent' AND day=?", t).n }
  });
});
const mFilter = (qs) => { const w = [], a = []; if (qs.q) { w.push("(first||' '||last LIKE ? OR phone LIKE ? OR street LIKE ? OR CAST(box_no AS TEXT)=?)"); const l = '%' + qs.q + '%'; a.push(l, l, l, qs.q); } if (qs.city) { w.push('city=?'); a.push(qs.city); } if (qs.region) { w.push('region=?'); a.push(qs.region); } if (qs.status) { w.push('box_status=?'); a.push(qs.status); } if (qs.courier) { w.push('courier=?'); a.push(qs.courier); } return { where: w.length ? 'WHERE ' + w.join(' AND ') : '', args: a }; };
app.get('/api/admin/members', aAuth, (req, res) => { const { where, args } = mFilter(req.query); res.json(db.prepare(`SELECT id,box_no,first,last,phone,email,street,house,apt,city,region,amount,prayer,start_date,box_status,courier,delivered_at,remind_channel,remind_time,notes,created,(SELECT COUNT(*) FROM members r WHERE r.referred_by=members.id) refs FROM members ${where} ORDER BY id DESC LIMIT 2000`).all(...args)); });
const STATUSES = ['new', 'assigned', 'out', 'delivered', 'cancelled'];
app.patch('/api/admin/members/:id', aAuth, (req, res) => {
  const m = db.prepare('SELECT * FROM members WHERE id=?').get(req.params.id); if (!m) return bad(res, 'not found', 404); const b = req.body || {};
  const st = STATUSES.includes(b.box_status) ? b.box_status : m.box_status;
  db.prepare('UPDATE members SET box_status=?, courier=?, notes=?, delivered_at=? WHERE id=?').run(st, b.courier !== undefined ? String(b.courier).slice(0, 60) : m.courier, b.notes !== undefined ? String(b.notes).slice(0, 500) : m.notes, st === 'delivered' && m.box_status !== 'delivered' ? new Date().toISOString() : m.delivered_at, m.id);
  statsCache.t = 0; res.json({ ok: true });
});
app.post('/api/admin/members/bulk', aAuth, (req, res) => {
  const ids = (req.body?.ids || []).map(Number).filter(Boolean).slice(0, 2000); const b = req.body || {};
  const tx = db.transaction(() => { for (const id of ids) { if (STATUSES.includes(b.box_status)) db.prepare("UPDATE members SET box_status=?, delivered_at=CASE WHEN ?='delivered' AND box_status!='delivered' THEN datetime('now') ELSE delivered_at END WHERE id=?").run(b.box_status, b.box_status, id); if (b.courier !== undefined) db.prepare('UPDATE members SET courier=? WHERE id=?').run(String(b.courier).slice(0, 60), id); } });
  tx(); statsCache.t = 0; res.json({ ok: true, n: ids.length });
});
const SL = { new: 'חדש – ממתין לקופה', assigned: 'שובץ לשליח', out: 'בדרך', delivered: 'נמסרה', cancelled: 'בוטל' };
app.get('/api/admin/export.csv', aAuth, (req, res) => {
  const { where, args } = mFilter(req.query); const rows = db.prepare(`SELECT * FROM members ${where} ORDER BY region, city, street, CAST(house AS INTEGER)`).all(...args);
  const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const out = ['מס קופה,שם פרטי,שם משפחה,טלפון,רחוב,מספר,דירה,עיר,אזור,שקלים ליום,סטטוס,שליח,הערות,מייל,נרשם'].concat(rows.map(m => [m.box_no, m.first, m.last, m.phone, m.street, m.house, m.apt, m.city, m.region, m.amount, SL[m.box_status], m.courier, m.notes, m.email, m.created].map(esc).join(',')));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="rabeinu-${today()}.csv"`); res.send('﻿' + out.join('\r\n'));
});
app.get('/admin/dispatch', (req, res) => {
  if (!isAdmin(req)) return res.redirect('/admin');
  const { where, args } = mFilter(req.query); const rows = db.prepare(`SELECT * FROM members ${where} ORDER BY city, street, CAST(house AS INTEGER)`).all(...args);
  const e = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const groups = {}; rows.forEach(m => (groups[m.city] ||= []).push(m));
  res.send(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>דף שליח – רבינו שלי</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:22px;margin:0}h2{font-size:17px;margin:22px 0 6px;border-bottom:2px solid #111;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:13px}td,th{border:1px solid #bbb;padding:6px 8px;text-align:right}th{background:#f2f2f2}.ck{width:28px}.top{display:flex;justify-content:space-between;align-items:center}@media print{button{display:none}}</style></head><body><div class="top"><div><h1>רבינו שלי · דף חלוקה לשליח</h1><div>${e(req.query.courier ? 'שליח: ' + req.query.courier + ' · ' : '')}${rows.length} כתובות · ${today()}</div></div><button onclick="print()">🖨 הדפסה</button></div>${Object.entries(groups).map(([c, l]) => `<h2>${e(c)} (${l.length})</h2><table><tr><th class="ck">✓</th><th>קופה</th><th>שם</th><th>כתובת</th><th>טלפון</th><th>הערות</th></tr>${l.map(m => `<tr><td></td><td>#${m.box_no}</td><td>${e(m.first + ' ' + m.last)}</td><td>${e(m.street + ' ' + m.house + (m.apt ? ' דירה ' + m.apt : ''))}</td><td dir="ltr">${e(m.phone)}</td><td>${e(m.notes)}</td></tr>`).join('')}</table>`).join('')}</body></html>`);
});
app.get('/api/admin/collections', aAuth, (req, res) => res.json(db.prepare("SELECT c.*, m.box_no, m.first, m.last, m.phone, m.street, m.house, m.apt, m.city FROM collections c JOIN members m ON m.id=c.member_id ORDER BY (c.status IN ('requested','scheduled','reported','pending')) DESC, c.id DESC LIMIT 500").all()));
app.patch('/api/admin/collections/:id', aAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM collections WHERE id=?').get(req.params.id); if (!c) return bad(res, 'not found', 404);
  const ok = { pickup: ['requested', 'scheduled', 'collected', 'cancelled'], donation: ['pending', 'reported', 'paid', 'cancelled'] }[c.kind]; const st = ok.includes(req.body?.status) ? req.body.status : c.status;
  const amt = req.body?.amount_actual !== undefined ? Math.max(0, Math.round(+req.body.amount_actual || 0)) : c.amount_actual;
  db.prepare("UPDATE collections SET status=?, amount_actual=?, done_at=CASE WHEN ? IN ('collected','paid') THEN datetime('now') ELSE done_at END WHERE id=?").run(st, st === 'paid' && !amt ? c.amount_est : amt, st, c.id);
  if (c.kind === 'pickup' && st === 'collected') db.prepare('UPDATE members SET last_empty=? WHERE id=?').run(today(), c.member_id);
  res.json({ ok: true });
});
app.get('/api/admin/settings', aAuth, (_, res) => res.json({ ...S(), sms: { url: getKV('sms').url || '' } }));
app.put('/api/admin/settings', aAuth, (req, res) => {
  const b = req.body || {}; const cur = S();
  setKV('settings', { ticketPrice: Math.max(100, Math.round(+b.ticketPrice || cur.ticketPrice)), targetDate: /^\d{4}-\d{2}-\d{2}$/.test(b.targetDate || '') ? b.targetDate : cur.targetDate, goal: Math.max(1, Math.round(+b.goal || cur.goal)), donateUrl: String(b.donateUrl ?? cur.donateUrl).slice(0, 500), whatsapp: String(b.whatsapp ?? cur.whatsapp).replace(/[^\d+]/g, '').slice(0, 20), orgName: cur.orgName, showRecent: b.showRecent !== undefined ? !!b.showRecent : cur.showRecent });
  if (b.smsUrl !== undefined) setKV('sms', { url: String(b.smsUrl).slice(0, 500) });
  statsCache.t = 0; res.json({ ok: true });
});
app.get('/api/admin/reminders', aAuth, (_, res) => res.json(db.prepare("SELECT r.*, m.box_no, m.first, m.last, m.phone FROM reminders r JOIN members m ON m.id=r.member_id ORDER BY r.id DESC LIMIT 300").all()));

// ---------- reminders (runs every minute, Israel time) ----------
function post(url, body, headers = {}) { return new Promise((resolve, reject) => { const u = new URL(url); const data = typeof body === 'string' ? body : JSON.stringify(body); const r = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST', headers: { 'Content-Type': typeof body === 'string' ? 'application/x-www-form-urlencoded' : 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers } }, x => { let d = ''; x.on('data', c => d += c); x.on('end', () => resolve({ status: x.statusCode, body: d })); }); r.on('error', reject); r.setTimeout(10000, () => r.destroy(new Error('timeout'))); r.write(data); r.end(); }); }
async function sendMail(to, subject, html) { if (!process.env.RESEND_API_KEY || !to) return false; const r = await post('https://api.resend.com/emails', { from: process.env.MAIL_FROM || 'רבינו שלי <onboarding@resend.dev>', to: [to], subject, html }, { Authorization: 'Bearer ' + process.env.RESEND_API_KEY }); return r.status < 300; }
function notifyAdmin(subject, text) { if (process.env.ADMIN_EMAIL) sendMail(process.env.ADMIN_EMAIL, subject, `<div dir="rtl" style="font-family:Arial">${text}</div>`).catch(() => { }); }
const reminderText = m => `${m.first}, בוקר טוב ☀️ הגיע הזמן לשקל של היום בקופה של רבינו (${m.prayer}). בזכותך עוד יהודי יזכה להגיע לאומן 🔥`;
async function tickReminders() {
  const now = new Date(); const hm = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' }); const dow = String(new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })).getDay()); const t = today();
  if (offName(t)) return;
  const due = db.prepare("SELECT * FROM members WHERE remind_channel!='none' AND box_status!='cancelled' AND remind_time=? AND instr(remind_days, ?)>0 AND id NOT IN (SELECT member_id FROM checkins WHERE day=?) AND id NOT IN (SELECT member_id FROM reminders WHERE day=?)").all(hm, dow, t, t);
  for (const m of due) {
    let status = 'queued', info = '';
    try {
      if (m.remind_channel === 'email') { status = (await sendMail(m.email, 'השקל של היום לרבינו 🔥', `<div dir="rtl" style="font-family:Arial;font-size:16px;line-height:1.7">${reminderText(m)}<br><br><a href="${process.env.BASE_URL || ''}/me">סימון "שמתי היום" ←</a></div>`)) ? 'sent' : 'queued'; if (status === 'queued') info = 'מייל לא מחובר'; }
      else if (m.remind_channel === 'sms' && getKV('sms').url) { const url = getKV('sms').url.replace('{phone}', encodeURIComponent(m.phone)).replace('{text}', encodeURIComponent(reminderText(m))); const r = await post(url, ''); status = r.status < 300 ? 'sent' : 'failed'; info = String(r.status); }
      else info = 'ממתין לחיבור ספק ' + ({ sms: 'SMS', whatsapp: 'וואטסאפ', call: 'שיחות' }[m.remind_channel] || '');
    } catch (e) { status = 'failed'; info = e.message.slice(0, 100); }
    db.prepare('INSERT OR IGNORE INTO reminders(member_id,channel,day,status,info) VALUES(?,?,?,?,?)').run(m.id, m.remind_channel, t, status, info);
  }
}
setInterval(() => tickReminders().catch(e => console.error('reminders', e.message)), 60000).unref();

// ---------- pages ----------
const pub = f => path.join(__dirname, 'public', f);
app.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /me\nSitemap: ${process.env.BASE_URL || ''}/sitemap.xml\n`));
app.get('/sitemap.xml', (req, res) => res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${process.env.BASE_URL || ''}/</loc><changefreq>daily</changefreq></url></urlset>`));
app.use(express.static(pub(''), { maxAge: '10m', setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
app.get(['/me', '/me/*'], (_, res) => res.sendFile(pub('me.html')));
app.get(['/admin', '/admin/*'], (_, res) => res.sendFile(pub('admin.html')));
app.get('/r/:code', (req, res) => res.redirect('/?r=' + encodeURIComponent(req.params.code)));
app.get('*', (_, res) => res.sendFile(pub('index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('rabeinu up', PORT));
