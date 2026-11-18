const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const multer = require('multer');
const cookieParser = require('cookie-parser');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UP_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UP_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'site.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS services(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price INTEGER, minutes INTEGER DEFAULT 30, note TEXT DEFAULT '', pos INTEGER DEFAULT 0, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS hours(dow INTEGER PRIMARY KEY, open TEXT, close TEXT, closed INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS bookings(id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, time TEXT, minutes INTEGER, service_id INTEGER, service TEXT, price INTEGER, name TEXT, phone TEXT, note TEXT DEFAULT '', status TEXT DEFAULT 'new', created TEXT DEFAULT (datetime('now','localtime')));
CREATE INDEX IF NOT EXISTS b_date ON bookings(date);
CREATE TABLE IF NOT EXISTS blocks(id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, from_t TEXT, to_t TEXT, reason TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS gallery(id INTEGER PRIMARY KEY AUTOINCREMENT, file TEXT, caption TEXT DEFAULT '', pos INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, text TEXT, stars INTEGER DEFAULT 5, active INTEGER DEFAULT 1);
`);

const DEF = {
  name: 'Uriya Biton', sub: 'BARBER SHOP',
  tagline: 'אחרי עשר שנות ניסיון', headline: 'מתרגשים לפתוח את הדלתות',
  about: 'מספרה בוטיקית לגבר שמבין באיכות. תספורת מדויקת, עיצוב זקן חד, ושירות אישי באווירה רגועה ויוקרתית.',
  phone: '0528142894', whatsapp: '972528142894',
  address: 'בחניה מעל קניון רמות', city: 'ירושלים', maps: '',
  instagram: '', promo: 'מחירים מיוחדים לרגל ההשקה', promoOn: '1',
  slot: '30', lead: '60', ahead: '21', seoDesc: 'Uriya Biton Barber Shop – תספורות גברים, עיצוב זקן, טיפוח וסטיילינג. קביעת תור אונליין.'
};
const getS = () => { const o = { ...DEF }; for (const r of db.prepare('SELECT k,v FROM settings').all()) o[r.k] = r.v; return o; };
const setS = (obj) => { const st = db.prepare('INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v'); const tx = db.transaction(o => { for (const [k, v] of Object.entries(o)) if (k in DEF) st.run(k, String(v ?? '')); }); tx(obj); };

if (!db.prepare('SELECT COUNT(*) c FROM services').get().c) {
  const ins = db.prepare('INSERT INTO services(name,price,minutes,note,pos) VALUES(?,?,?,?,?)');
  [['תספורת גברים', 80, 30, 'כולל שטיפה וסטיילינג', 1], ['תספורת + זקן', 110, 45, 'החבילה המלאה', 2], ['עיצוב זקן', 50, 20, 'עיצוב, גילוח מכונה וסכין', 3], ['תספורת ילדים', 60, 30, 'עד גיל 12', 4], ['טיפוח וסטיילינג', 40, 20, 'שעווה, מסכה, מראה גמור', 5]].forEach(a => ins.run(...a));
}
if (!db.prepare('SELECT COUNT(*) c FROM hours').get().c) {
  const ins = db.prepare('INSERT INTO hours(dow,open,close,closed) VALUES(?,?,?,?)');
  [[0, '09:00', '20:00', 0], [1, '09:00', '20:00', 0], [2, '09:00', '20:00', 0], [3, '09:00', '20:00', 0], [4, '09:00', '21:00', 0], [5, '08:00', '14:00', 0], [6, '00:00', '00:00', 1]].forEach(a => ins.run(...a));
}
if (!db.prepare('SELECT COUNT(*) c FROM reviews').get().c) {
  const ins = db.prepare('INSERT INTO reviews(name,text,stars) VALUES(?,?,?)');
  [['יוסי כ.', 'הכי מדויק שהסתפרתי אצלו. יחס אישי, אווירה מעולה, ויוצאים אחרת.', 5], ['אלעד מ.', 'עיצוב זקן ברמה אחרת. סוף סוף מישהו שמבין מה אני רוצה.', 5], ['דניאל ש.', 'מקצוען אמיתי. קבעתי תור בוואטסאפ תוך דקה.', 5]].forEach(a => ins.run(...a));
}

// ---------- admin auth ----------
const pinFile = path.join(DATA_DIR, 'pin.txt');
const getPin = () => { try { return fs.readFileSync(pinFile, 'utf8').trim(); } catch { return process.env.ADMIN_PIN || '1234'; } };
const SECRET = process.env.SECRET || (() => { const f = path.join(DATA_DIR, 'secret.txt'); try { return fs.readFileSync(f, 'utf8'); } catch { const s = crypto.randomBytes(24).toString('hex'); fs.writeFileSync(f, s); return s; } })();
const sign = (v) => v + '.' + crypto.createHmac('sha256', SECRET).update(v).digest('hex').slice(0, 24);
const ok = (t) => { if (!t) return false; const i = t.lastIndexOf('.'); if (i < 0) return false; return sign(t.slice(0, i)) === t && Number(t.slice(0, i)) > Date.now() - 30 * 864e5; };
const auth = (req, res, next) => ok(req.cookies.adm) ? next() : res.status(401).json({ error: 'auth' });

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ---------- helpers ----------
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toT = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const nowIL = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function slotsFor(date, minutes) {
  const s = getS();
  const dow = new Date(date + 'T12:00:00').getDay();
  const h = db.prepare('SELECT * FROM hours WHERE dow=?').get(dow);
  if (!h || h.closed) return { slots: [], closed: true };
  const step = Math.max(10, +s.slot || 30);
  const busy = db.prepare("SELECT time,minutes FROM bookings WHERE date=? AND status!='cancelled'").all(date).map(b => [toMin(b.time), toMin(b.time) + (b.minutes || step)]);
  for (const b of db.prepare('SELECT from_t,to_t FROM blocks WHERE date=?').all(date)) busy.push([toMin(b.from_t), toMin(b.to_t)]);
  const n = nowIL(); const today = ymd(n) === date; const minStart = today ? n.getHours() * 60 + n.getMinutes() + (+s.lead || 0) : -1;
  const out = [];
  for (let t = toMin(h.open); t + minutes <= toMin(h.close); t += step) {
    if (t < minStart) continue;
    const end = t + minutes;
    if (busy.some(([a, b]) => t < b && end > a)) continue;
    out.push(toT(t));
  }
  return { slots: out, closed: false, open: h.open, close: h.close };
}

// ---------- public API ----------
app.get('/api/site', (_, res) => {
  const s = getS();
  res.json({
    settings: s,
    services: db.prepare('SELECT id,name,price,minutes,note FROM services WHERE active=1 ORDER BY pos,id').all(),
    hours: db.prepare('SELECT * FROM hours ORDER BY dow').all(),
    gallery: db.prepare('SELECT id,file,caption FROM gallery ORDER BY pos,id').all(),
    reviews: db.prepare('SELECT name,text,stars FROM reviews WHERE active=1 ORDER BY id DESC LIMIT 12').all()
  });
});
app.get('/api/days', (_, res) => {
  const s = getS(); const n = nowIL(); const out = [];
  for (let i = 0; i < (+s.ahead || 21); i++) {
    const d = new Date(n); d.setDate(d.getDate() + i); const date = ymd(d);
    const h = db.prepare('SELECT closed FROM hours WHERE dow=?').get(d.getDay());
    const full = db.prepare('SELECT COUNT(*) c FROM blocks WHERE date=? AND from_t<=? AND to_t>=?').get(date, '00:00', '23:59').c > 0;
    out.push({ date, dow: d.getDay(), closed: !h || !!h.closed || full });
  }
  res.json(out);
});
app.get('/api/slots', (req, res) => {
  const { date, service } = req.query;
  if (!validDate(date)) return res.status(400).json({ error: 'date' });
  const sv = db.prepare('SELECT * FROM services WHERE id=?').get(service);
  res.json(slotsFor(date, sv ? sv.minutes : 30));
});
app.post('/api/book', (req, res) => {
  const { date, time, service, name, phone, note } = req.body || {};
  if (!validDate(date) || !/^\d{2}:\d{2}$/.test(time || '')) return res.status(400).json({ error: 'תאריך או שעה לא תקינים' });
  const sv = db.prepare('SELECT * FROM services WHERE id=? AND active=1').get(service);
  if (!sv) return res.status(400).json({ error: 'שירות לא נמצא' });
  const nm = String(name || '').trim().slice(0, 60); const ph = String(phone || '').replace(/[^\d+]/g, '').slice(0, 20);
  if (nm.length < 2) return res.status(400).json({ error: 'נא להזין שם' });
  if (ph.replace(/\D/g, '').length < 9) return res.status(400).json({ error: 'נא להזין טלפון תקין' });
  const { slots } = slotsFor(date, sv.minutes);
  if (!slots.includes(time)) return res.status(409).json({ error: 'השעה כבר נתפסה, בחרו שעה אחרת' });
  const r = db.prepare('INSERT INTO bookings(date,time,minutes,service_id,service,price,name,phone,note) VALUES(?,?,?,?,?,?,?,?,?)').run(date, time, sv.minutes, sv.id, sv.name, sv.price, nm, ph, String(note || '').slice(0, 300));
  res.json({ ok: true, id: r.lastInsertRowid, service: sv.name, price: sv.price });
});

// ---------- admin API ----------
app.post('/api/admin/login', (req, res) => {
  if (String(req.body?.pin || '') !== getPin()) return res.status(401).json({ error: 'קוד שגוי' });
  res.cookie('adm', sign(String(Date.now())), { httpOnly: true, sameSite: 'lax', maxAge: 30 * 864e5, secure: !!process.env.RAILWAY_ENVIRONMENT }); res.json({ ok: true });
});
app.post('/api/admin/logout', (_, res) => { res.clearCookie('adm'); res.json({ ok: true }); });
app.get('/api/admin/me', (req, res) => res.json({ ok: ok(req.cookies.adm) }));
app.use('/api/admin', auth);
app.post('/api/admin/pin', (req, res) => { const p = String(req.body?.pin || '').trim(); if (p.length < 4) return res.status(400).json({ error: 'לפחות 4 תווים' }); fs.writeFileSync(pinFile, p); res.json({ ok: true }); });

app.get('/api/admin/settings', (_, res) => res.json(getS()));
app.put('/api/admin/settings', (req, res) => { setS(req.body || {}); res.json(getS()); });

app.get('/api/admin/services', (_, res) => res.json(db.prepare('SELECT * FROM services ORDER BY pos,id').all()));
app.post('/api/admin/services', (req, res) => { const b = req.body || {}; const r = db.prepare('INSERT INTO services(name,price,minutes,note,pos,active) VALUES(?,?,?,?,?,?)').run(String(b.name || 'שירות').slice(0, 60), +b.price || 0, +b.minutes || 30, String(b.note || '').slice(0, 120), +b.pos || 99, b.active === false ? 0 : 1); res.json({ id: r.lastInsertRowid }); });
app.put('/api/admin/services/:id', (req, res) => { const b = req.body || {}; db.prepare('UPDATE services SET name=?,price=?,minutes=?,note=?,pos=?,active=? WHERE id=?').run(String(b.name || '').slice(0, 60), +b.price || 0, +b.minutes || 30, String(b.note || '').slice(0, 120), +b.pos || 0, b.active ? 1 : 0, req.params.id); res.json({ ok: true }); });
app.delete('/api/admin/services/:id', (req, res) => { db.prepare('DELETE FROM services WHERE id=?').run(req.params.id); res.json({ ok: true }); });

app.get('/api/admin/hours', (_, res) => res.json(db.prepare('SELECT * FROM hours ORDER BY dow').all()));
app.put('/api/admin/hours', (req, res) => { const st = db.prepare('INSERT INTO hours(dow,open,close,closed) VALUES(?,?,?,?) ON CONFLICT(dow) DO UPDATE SET open=excluded.open,close=excluded.close,closed=excluded.closed'); db.transaction(a => a.forEach(h => st.run(+h.dow, h.open || '09:00', h.close || '20:00', h.closed ? 1 : 0)))(req.body || []); res.json({ ok: true }); });

app.get('/api/admin/bookings', (req, res) => {
  const { from, to, q } = req.query;
  let sql = 'SELECT * FROM bookings WHERE 1=1'; const p = [];
  if (validDate(from)) { sql += ' AND date>=?'; p.push(from); }
  if (validDate(to)) { sql += ' AND date<=?'; p.push(to); }
  if (q) { sql += ' AND (name LIKE ? OR phone LIKE ?)'; p.push('%' + q + '%', '%' + q + '%'); }
  sql += ' ORDER BY date,time'; res.json(db.prepare(sql).all(...p));
});
app.post('/api/admin/bookings', (req, res) => {
  const b = req.body || {}; const sv = db.prepare('SELECT * FROM services WHERE id=?').get(b.service) || { id: null, name: b.service_name || 'תור', price: +b.price || 0, minutes: +b.minutes || 30 };
  if (!validDate(b.date) || !/^\d{2}:\d{2}$/.test(b.time || '')) return res.status(400).json({ error: 'תאריך/שעה' });
  const r = db.prepare("INSERT INTO bookings(date,time,minutes,service_id,service,price,name,phone,note,status) VALUES(?,?,?,?,?,?,?,?,?,'confirmed')").run(b.date, b.time, +b.minutes || sv.minutes, sv.id, sv.name, +b.price || sv.price, String(b.name || '').slice(0, 60), String(b.phone || '').slice(0, 20), String(b.note || '').slice(0, 300));
  res.json({ id: r.lastInsertRowid });
});
app.patch('/api/admin/bookings/:id', (req, res) => { const b = req.body || {}; const cur = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id); if (!cur) return res.status(404).json({}); db.prepare('UPDATE bookings SET status=?,note=?,date=?,time=? WHERE id=?').run(b.status || cur.status, b.note ?? cur.note, validDate(b.date) ? b.date : cur.date, /^\d{2}:\d{2}$/.test(b.time || '') ? b.time : cur.time, req.params.id); res.json({ ok: true }); });
app.delete('/api/admin/bookings/:id', (req, res) => { db.prepare('DELETE FROM bookings WHERE id=?').run(req.params.id); res.json({ ok: true }); });

app.get('/api/admin/blocks', (req, res) => res.json(db.prepare('SELECT * FROM blocks WHERE date>=? ORDER BY date,from_t').all(ymd(nowIL()))));
app.post('/api/admin/blocks', (req, res) => { const b = req.body || {}; if (!validDate(b.date)) return res.status(400).json({ error: 'date' }); const r = db.prepare('INSERT INTO blocks(date,from_t,to_t,reason) VALUES(?,?,?,?)').run(b.date, b.from_t || '00:00', b.to_t || '23:59', String(b.reason || '').slice(0, 80)); res.json({ id: r.lastInsertRowid }); });
app.delete('/api/admin/blocks/:id', (req, res) => { db.prepare('DELETE FROM blocks WHERE id=?').run(req.params.id); res.json({ ok: true }); });

const upload = multer({ storage: multer.diskStorage({ destination: UP_DIR, filename: (_, f, cb) => cb(null, Date.now() + '-' + crypto.randomBytes(3).toString('hex') + path.extname(f.originalname).toLowerCase()) }), limits: { fileSize: 8e6 }, fileFilter: (_, f, cb) => cb(null, /image\/(jpeg|png|webp|gif)/.test(f.mimetype)) });
app.post('/api/admin/gallery', upload.array('img', 12), (req, res) => { const st = db.prepare('INSERT INTO gallery(file,caption,pos) VALUES(?,?,?)'); (req.files || []).forEach((f, i) => st.run(f.filename, '', Date.now() + i)); res.json({ ok: true, n: (req.files || []).length }); });
app.put('/api/admin/gallery/:id', (req, res) => { db.prepare('UPDATE gallery SET caption=?,pos=? WHERE id=?').run(String(req.body?.caption || '').slice(0, 80), +req.body?.pos || 0, req.params.id); res.json({ ok: true }); });
app.delete('/api/admin/gallery/:id', (req, res) => { const g = db.prepare('SELECT file FROM gallery WHERE id=?').get(req.params.id); if (g) { try { fs.unlinkSync(path.join(UP_DIR, g.file)); } catch { } db.prepare('DELETE FROM gallery WHERE id=?').run(req.params.id); } res.json({ ok: true }); });
app.post('/api/admin/logo', upload.single('img'), (req, res) => { if (!req.file) return res.status(400).json({ error: 'file' }); setS({}); db.prepare("INSERT INTO settings(k,v) VALUES('logo',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").run(req.file.filename); res.json({ ok: true, file: req.file.filename }); });

app.post('/api/admin/logo/rm', (_, res) => { db.prepare("DELETE FROM settings WHERE k='logo'").run(); res.json({ ok: true }); });
app.get('/api/admin/reviews', (_, res) => res.json(db.prepare('SELECT * FROM reviews ORDER BY id DESC').all()));
app.post('/api/admin/reviews', (req, res) => { const b = req.body || {}; const r = db.prepare('INSERT INTO reviews(name,text,stars) VALUES(?,?,?)').run(String(b.name || '').slice(0, 40), String(b.text || '').slice(0, 300), Math.min(5, Math.max(1, +b.stars || 5))); res.json({ id: r.lastInsertRowid }); });
app.delete('/api/admin/reviews/:id', (req, res) => { db.prepare('DELETE FROM reviews WHERE id=?').run(req.params.id); res.json({ ok: true }); });

app.get('/api/admin/stats', (_, res) => {
  const d = ymd(nowIL());
  res.json({
    today: db.prepare("SELECT COUNT(*) c FROM bookings WHERE date=? AND status!='cancelled'").get(d).c,
    week: db.prepare("SELECT COUNT(*) c FROM bookings WHERE date>=? AND date<=date(?,'+7 day') AND status!='cancelled'").get(d, d).c,
    pending: db.prepare("SELECT COUNT(*) c FROM bookings WHERE status='new' AND date>=?").get(d).c,
    month: db.prepare("SELECT COALESCE(SUM(price),0) s FROM bookings WHERE strftime('%Y-%m',date)=strftime('%Y-%m',?) AND status='done'").get(d).s
  });
});

// ---------- static ----------
app.use('/u', express.static(UP_DIR, { maxAge: '30d', immutable: true }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d', setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
app.get('/admin', (_, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(process.env.PORT || 3000, () => console.log('uriya up'));
