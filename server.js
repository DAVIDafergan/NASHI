const express = require('express');
const Database = require('better-sqlite3');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { createSms } = require('./sms');
const { assess } = require('./fraud');

// ---------- הגדרות ----------
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SECRET = process.env.SECRET || 'change-me-' + DATA_DIR;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';
const SHEKELS_PER_POINT = 10;
const MAX_RECEIPTS_PER_DAY = 3;
const MAX_RECEIPT_AGE_DAYS = 7;
const MAX_AMOUNT = 3000;
const MAX_POINTS_PER_RECEIPT = 20;
const ptsFor = amount => Math.min(MAX_POINTS_PER_RECEIPT, Math.floor(amount / SHEKELS_PER_POINT));
const UPLOADS = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });
const MEDIA = path.join(DATA_DIR, 'media');
fs.mkdirSync(MEDIA, { recursive: true });

// ---------- מסד נתונים ----------
const db = new Database(path.join(DATA_DIR, 'app.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, phone TEXT UNIQUE, name TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS otps (phone TEXT PRIMARY KEY, code_hash TEXT, expires_at INTEGER, attempts INTEGER DEFAULT 0, sent_at INTEGER, sent_count_hour INTEGER DEFAULT 0, hour_start INTEGER);
CREATE TABLE IF NOT EXISTS stores (id INTEGER PRIMARY KEY, name TEXT, category TEXT, address TEXT, emoji TEXT DEFAULT '🏪', active INTEGER DEFAULT 1, paid INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS receipts (id INTEGER PRIMARY KEY, user_id INTEGER, store_id INTEGER, receipt_no TEXT, amount REAL, receipt_date TEXT, image TEXT,
  status TEXT DEFAULT 'pending', points INTEGER DEFAULT 0, note TEXT, created_at TEXT DEFAULT (datetime('now')), UNIQUE(store_id, receipt_no));
CREATE TABLE IF NOT EXISTS free_entries (id INTEGER PRIMARY KEY, user_id INTEGER, week TEXT, answer TEXT, created_at TEXT DEFAULT (datetime('now')), UNIQUE(user_id, week));
CREATE TABLE IF NOT EXISTS raffles (id INTEGER PRIMARY KEY, title TEXT, prize TEXT, emoji TEXT DEFAULT '🎁', value TEXT, draw_date TEXT, is_grand INTEGER DEFAULT 0,
  winner_user_id INTEGER, drawn_at TEXT);
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS bonuses (id INTEGER PRIMARY KEY, user_id INTEGER, points INTEGER, reason TEXT, ref_user INTEGER, created_at TEXT DEFAULT (datetime('now')), UNIQUE(user_id, reason, ref_user));
CREATE TABLE IF NOT EXISTS applications (id INTEGER PRIMARY KEY, business TEXT, contact TEXT, phone TEXT, category TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')));
`);
// עמודות שנוספו בגרסה 2
for (const [t, c] of [['receipts', 'file_hash TEXT'], ['receipts', 'vhash TEXT'], ['receipts', 'risk INTEGER DEFAULT 0'], ['receipts', 'flags TEXT'],
  ['receipts', 'ai TEXT'], ['receipts', 'ip TEXT'], ['users', 'banned INTEGER DEFAULT 0'], ['raffles', 'image TEXT'], ['users', 'ref_code TEXT'], ['users', 'referred_by INTEGER'], ['raffles', 'blurb TEXT'], ['raffles', 'credit TEXT'], ['raffles', "kind TEXT DEFAULT 'raffle'"], ['raffles', 'rank INTEGER'], ['applications', "status TEXT DEFAULT 'new'"], ['applications', 'pay_ref TEXT'], ['applications', 'paid_at TEXT'], ['applications', 'email TEXT'], ['applications', 'company_no TEXT']])
  try { db.exec(`ALTER TABLE ${t} ADD COLUMN ${c}`); } catch {}


const U = (id, w = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;
const PRIZES = [
  // [כותרת, פרס, תיאור, שווי (פנימי), תאריך, ראשי, תמונה, קרדיט, סוג, מקום]
  ['הפרס הגדול', 'טיסה זוגית לאירופה', 'טיסות הלוך-חזור לשניים ליעד באירופה, ולילות במלון.', '', '2026-12-31', 1, '/img/europe.jpg', 'Unsplash', 'raffle', null],
  ['הגרלת סיום', 'iPhone 17 Pro', 'הדגם החדש, 256GB, בצבע לבחירתכם.', '', '2026-12-30', 0, U('photo-1574315042617-f84e1847848a'), 'David Hurley', 'raffle', null],
  ['ערב חנוכה ראשון', 'מארזי סופגניות יוקרתיים', '8 זוכים, זוכה אחד בכל ערב חנוכה.', '', '2026-12-05', 0, '/img/donuts.jpg', 'Unsplash', 'raffle', null],
  ['שבוע ההשקה', 'אוזניות AirPods Pro', 'ביטול רעשים אקטיבי וטעינה אלחוטית.', '', '2026-12-07', 0, '/img/headphones.jpg', 'Unsplash', 'raffle', null],
  ['ערב זוגי', 'ארוחת שף זוגית', 'תפריט טעימות במסעדה בעיר.', '', '2026-12-08', 0, '/img/dinner.jpg', 'Unsplash', 'raffle', null],
  ['קונים מקומי', 'שובר קנייה בעסקים השותפים', 'לקנייה בכל אחד מהעסקים שמשתתפים במבצע.', '', '2026-12-10', 0, U('photo-1758274251589-fb70a3654a1b'), 'Vitaly Gariev', 'raffle', null],
  ['פינוק', 'יום ספא זוגי', 'עיסוי, בריכה מחוממת וארוחת בוקר.', '', '2026-12-12', 0, U('photo-1600334129128-685c5582fd35'), 'engin akyurt', 'raffle', null],
  ['אמצע החודש', 'Apple Watch', 'השעון החכם של Apple, הדגם העדכני.', '', '2026-12-14', 0, U('photo-1434494878577-86c23bcb06b9'), 'Luke Chesser', 'raffle', null],
  ['לבית', 'מייבש שיער Dyson', 'Supersonic, כולל כל הראשים.', '', '2026-12-15', 0, U('photo-1620331309205-b5a4669ac526'), 'Andrea Donato', 'raffle', null],
  ['לגיימרים', 'PlayStation 5 Pro', 'כולל שני בקרים ומשחק לבחירה.', '', '2026-12-17', 0, U('photo-1709587797077-7a2c94411514'), 'Roberto Vincenzo Minasi', 'raffle', null],
  ['בוקר טוב', 'שנה של קפה', 'קפה אחד ביום במשך שנה, בבית קפה שותף.', '', '2026-12-18', 0, U('photo-1760175445000-0e01e193d1cd'), 'nameless 3791', 'raffle', null],
  ['סוף שבוע', 'צימר זוגי בצפון', 'שני לילות עם ג׳קוזי וארוחות בוקר.', '', '2026-12-20', 0, U('photo-1613525041465-88225ec0122a'), 'Greg Althoff', 'raffle', null],
  ['למשפחה', 'Nintendo Switch 2', 'עם שני משחקים לכל המשפחה.', '', '2026-12-22', 0, U('photo-1612036781124-847f8939b154'), 'Erik Mclean', 'raffle', null],
  ['בתנועה', 'קורקינט חשמלי', 'מתקפל, עם קסדה.', '', '2026-12-24', 0, U('photo-1565300480288-deb407e6ae15'), 'Ernest Ojeh', 'raffle', null],
  ['ערב בחוץ', 'זוג כרטיסים להופעה', 'להופעה לבחירתכם.', '', '2026-12-27', 0, U('photo-1459749411175-04bf5292ceea'), 'Nainoa Shizuru', 'raffle', null],
  ['שנה בריאה', 'מנוי שנתי לחדר כושר', 'כולל חוגים ובריכה.', '', '2026-12-29', 0, U('photo-1728486145245-d4cb0c9c3470'), 'Ambitious Studio', 'raffle', null],
  // פרסי המובילים: לא הגרלה, אלא למי שצבר הכי הרבה כרטיסים עד המועד
  ['המקום הראשון', 'MacBook Air', 'למי שצבר הכי הרבה כרטיסים עד סוף החודש.', '', '2026-12-31', 0, U('photo-1779444480529-7df3c5645991'), 'Avtar Singh', 'top', 1],
  ['המקום השני', 'iPad', 'למקום השני בטבלת המובילים.', '', '2026-12-31', 0, U('photo-1623126908029-58cb08a2b272'), 's w', 'top', 2],
  ['המקום השלישי', 'שובר פינוק בעסקים השותפים', 'למקום השלישי בטבלת המובילים.', '', '2026-12-31', 0, U('photo-1549465220-1a8b9238cd48'), 'Ekaterina Shevchenko', 'top', 3],
];
// עדכון חד-פעמי של רשימת הפרסים לדוגמה (רק אם עוד לא הוגרל שום דבר)
db.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)');
if ((db.prepare("SELECT v FROM kv WHERE k='seed_v'").get()?.v || '1') < '2' && !db.prepare('SELECT 1 FROM raffles WHERE winner_user_id IS NOT NULL').get() && process.env.SEED_DEMO !== 'false') {
  db.prepare('DELETE FROM raffles').run();
  db.prepare("INSERT INTO kv(k,v) VALUES('seed_v','2') ON CONFLICT(k) DO UPDATE SET v='2'").run();
}
if (!db.prepare('SELECT COUNT(*) c FROM raffles').get().c && process.env.SEED_DEMO !== 'false') {
  const r = db.prepare('INSERT INTO raffles (title, prize, blurb, value, draw_date, is_grand, image, credit, kind, rank, emoji) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  for (const p of PRIZES) r.run(...p, '');
}
if (!db.prepare('SELECT COUNT(*) c FROM stores').get().c && process.env.SEED_DEMO !== 'false') {
  const s = db.prepare('INSERT INTO stores (name, category, address, emoji) VALUES (?,?,?,?)');
  s.run('בית קפה לדוגמה', 'בתי קפה', 'אחוזה, רעננה', '');
  s.run('מספרה לדוגמה', 'טיפוח', 'רעננה', '');
  s.run('פיצרייה לדוגמה', 'מסעדות', 'רעננה', '');
}

// ---------- עזרים ----------
const hash = s => crypto.createHmac('sha256', SECRET).update(String(s)).digest('hex');
const sign = v => v + '.' + hash('v:' + v).slice(0, 32);
const unsign = t => { if (!t) return null; const i = t.lastIndexOf('.'); const v = t.slice(0, i); return sign(v) === t ? v : null; };
const normPhone = p => { const d = String(p || '').replace(/\D/g, '').replace(/^972/, '0'); return /^05\d{8}$/.test(d) ? d : null; };
const weekKey = () => { const d = new Date(); const s = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return d.getUTCFullYear() + '-W' + Math.ceil(((d - s) / 864e5 + s.getUTCDay() + 1) / 7); };
const maskPhone = p => p ? p.slice(0, 3) + '-XXX-' + p.slice(-4) : '';
const pointsOf = uid =>
  db.prepare("SELECT COALESCE(SUM(points),0) p FROM receipts WHERE user_id=? AND status='approved'").get(uid).p +
  db.prepare('SELECT COUNT(*) c FROM free_entries WHERE user_id=?').get(uid).c +
  db.prepare('SELECT COALESCE(SUM(points),0) p FROM bonuses WHERE user_id=?').get(uid).p;
const totalTickets = () =>
  db.prepare("SELECT COALESCE(SUM(r.points),0) p FROM receipts r JOIN users u ON u.id=r.user_id WHERE r.status='approved' AND u.banned=0").get().p +
  db.prepare('SELECT COUNT(*) c FROM free_entries').get().c + db.prepare('SELECT COALESCE(SUM(points),0) p FROM bonuses').get().p;
const kvGet = k => { try { return JSON.parse(db.prepare('SELECT v FROM kv WHERE k=?').get(k)?.v); } catch { return null; } };
const kvSet = (k, v) => db.prepare('INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k, JSON.stringify(v));
const { sendSms, ready: smsReady, config: smsConfig } = createSms(() => kvGet('sms'));
const BRAND = 'רעננים';
const REF_BONUS = 5; // כרטיסים לממליץ, אחרי הקבלה המאושרת הראשונה של החבר
const refCode = () => crypto.randomBytes(4).toString('base64url').replace(/[-_]/g, 'x').slice(0, 6);
const ensureRef = u => { if (u.ref_code) return u.ref_code; const c = refCode(); db.prepare('UPDATE users SET ref_code=? WHERE id=?').run(c, u.id); return c; };
// בונוס חבר מביא חבר: ניתן פעם אחת, אחרי שהחבר קיבל אישור לקבלה ראשונה
function rewardReferrer(userId) {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  if (!u?.referred_by) return;
  const ok = db.prepare("SELECT COUNT(*) c FROM receipts WHERE user_id=? AND status='approved'").get(userId).c;
  if (ok < 1) return;
  db.prepare('INSERT OR IGNORE INTO bonuses (user_id, points, reason, ref_user) VALUES (?,?,?,?)').run(u.referred_by, REF_BONUS, 'referral', userId);
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/media', express.static(MEDIA, { maxAge: '30d' }));

const userOf = req => { const id = unsign(req.cookies.sid); return id ? db.prepare('SELECT * FROM users WHERE id=?').get(id) : null; };
const needUser = (req, res, next) => { const u = userOf(req); if (!u) return res.status(401).json({ error: 'צריך להתחבר' }); req.user = u; next(); };
const needAdmin = (req, res, next) => unsign(req.cookies.adm) === 'admin' ? next() : res.status(401).json({ error: 'אין הרשאה' });
const setCookie = (res, name, val) => res.cookie(name, sign(val), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 * 60 });

// ---------- התחברות ב-SMS ----------
app.post('/api/otp/send', async (req, res) => {
  const phone = normPhone(req.body.phone);
  if (!phone) return res.status(400).json({ error: 'מספר טלפון לא תקין' });
  const now = Date.now();
  const row = db.prepare('SELECT * FROM otps WHERE phone=?').get(phone);
  if (row && now - row.sent_at < 60e3) return res.status(429).json({ error: 'אפשר לבקש קוד חדש בעוד דקה' });
  let count = 1, hourStart = now;
  if (row && now - row.hour_start < 3600e3) { count = row.sent_count_hour + 1; hourStart = row.hour_start; }
  if (count > 5) return res.status(429).json({ error: 'יותר מדי ניסיונות. נסו שוב בעוד שעה' });
  const code = String(crypto.randomInt(100000, 1000000));
  db.prepare(`INSERT INTO otps (phone, code_hash, expires_at, attempts, sent_at, sent_count_hour, hour_start) VALUES (?,?,?,0,?,?,?)
    ON CONFLICT(phone) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at, attempts=0, sent_at=excluded.sent_at, sent_count_hour=excluded.sent_count_hour, hour_start=excluded.hour_start`)
    .run(phone, hash(phone + code), now + 10 * 60e3, now, count, hourStart);
  try {
    await sendSms(phone, `${code} הוא קוד הכניסה שלך ל${BRAND}`);
    res.json({ ok: true, demo: !smsReady() ? code : undefined });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'שליחת ה-SMS נכשלה. נסו שוב בעוד רגע' });
  }
});

app.post('/api/otp/verify', (req, res) => {
  const phone = normPhone(req.body.phone);
  const row = phone && db.prepare('SELECT * FROM otps WHERE phone=?').get(phone);
  if (!row || Date.now() > row.expires_at) return res.status(400).json({ error: 'הקוד פג תוקף. בקשו קוד חדש' });
  if (row.attempts >= 5) return res.status(429).json({ error: 'יותר מדי ניסיונות. בקשו קוד חדש' });
  if (hash(phone + String(req.body.code || '').trim()) !== row.code_hash) {
    db.prepare('UPDATE otps SET attempts=attempts+1 WHERE phone=?').run(phone);
    return res.status(400).json({ error: 'קוד שגוי' });
  }
  db.prepare('DELETE FROM otps WHERE phone=?').run(phone);
  const isNew = !db.prepare('SELECT 1 FROM users WHERE phone=?').get(phone);
  db.prepare('INSERT OR IGNORE INTO users (phone) VALUES (?)').run(phone);
  const user = db.prepare('SELECT * FROM users WHERE phone=?').get(phone);
  if (isNew) {
    ensureRef(user);
    const ref = String(req.body.ref || req.cookies.ref || '').slice(0, 12);
    const by = ref && db.prepare('SELECT id FROM users WHERE ref_code=? AND id<>?').get(ref, user.id);
    if (by) db.prepare('UPDATE users SET referred_by=? WHERE id=?').run(by.id, user.id);
  }
  if (user.banned) return res.status(403).json({ error: 'החשבון חסום. לבירור פנו אלינו' });
  const name = String(req.body.name || '').trim().slice(0, 40);
  if (name && !user.name) db.prepare('UPDATE users SET name=? WHERE id=?').run(name, user.id);
  setCookie(res, 'sid', String(user.id));
  res.json({ ok: true, needName: !user.name && !name });
});

app.post('/api/logout', (req, res) => { res.clearCookie('sid'); res.json({ ok: true }); });

app.post('/api/me/name', needUser, (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 40);
  if (!name) return res.status(400).json({ error: 'נא למלא שם' });
  db.prepare('UPDATE users SET name=? WHERE id=?').run(name, req.user.id);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const u = userOf(req);
  if (!u) return res.json({ user: null });
  const receipts = db.prepare(`SELECT r.id, r.amount, r.status, r.points, r.receipt_date, r.created_at, r.note, s.name store, s.emoji
    FROM receipts r JOIN stores s ON s.id=r.store_id WHERE r.user_id=? ORDER BY r.id DESC LIMIT 50`).all(u.id);
  const freeThisWeek = !!db.prepare('SELECT 1 FROM free_entries WHERE user_id=? AND week=?').get(u.id, weekKey());
  const points = pointsOf(u.id), total = totalTickets();
  const friends = db.prepare('SELECT COUNT(*) c FROM users WHERE referred_by=?').get(u.id).c;
  const bonus = db.prepare('SELECT COALESCE(SUM(points),0) p FROM bonuses WHERE user_id=?').get(u.id).p;
  const rank = points ? leaders(100000).findIndex(r => r.id === u.id) + 1 : 0;
  res.json({ user: { name: u.name, phone: maskPhone(u.phone) }, points, total, rank, maxPerReceipt: MAX_POINTS_PER_RECEIPT, receipts, freeThisWeek, ref: ensureRef(u), friends, bonus, refBonus: REF_BONUS });
});

// ---------- נתונים ציבוריים ----------
app.get('/api/stores', (req, res) => res.json(db.prepare('SELECT id, name, category, address, emoji FROM stores WHERE active=1 ORDER BY name').all()));
app.get('/api/raffles', (req, res) => {
  const rows = db.prepare(`SELECT r.*, u.name wname, u.phone wphone FROM raffles r LEFT JOIN users u ON u.id=r.winner_user_id ORDER BY is_grand DESC, draw_date`).all();
  res.json(rows.map(r => ({ id: r.id, title: r.title, prize: r.prize, blurb: r.blurb, credit: r.credit, image: r.image, draw_date: r.draw_date, is_grand: !!r.is_grand, kind: r.kind || 'raffle', rank: r.rank,
    winner: r.winner_user_id ? `${(r.wname || 'זוכה').split(' ')[0]} (${maskPhone(r.wphone)})` : null })));
});
app.get('/api/live', (req, res) => res.json(db.prepare(`SELECT u.name, s.name store, r.points, r.created_at FROM receipts r
  JOIN users u ON u.id=r.user_id JOIN stores s ON s.id=r.store_id WHERE r.status='approved' ORDER BY r.id DESC LIMIT 12`).all()
  .map(r => ({ name: (r.name || 'מישהו').split(' ')[0], store: r.store, points: r.points }))));
app.get('/api/stats', (req, res) => res.json({
  stores: db.prepare('SELECT COUNT(*) c FROM stores WHERE active=1').get().c,
  players: db.prepare('SELECT COUNT(*) c FROM users').get().c,
  points: totalTickets(),
  prizes: db.prepare('SELECT COUNT(*) c FROM raffles').get().c,
}));
// טבלת המובילים: שם פרטי + 4 ספרות אחרונות, בלי טלפון מלא
const leaders = (n = 10) => db.prepare(`SELECT u.id, u.name, u.phone,
    (SELECT COALESCE(SUM(points),0) FROM receipts WHERE user_id=u.id AND status='approved') +
    (SELECT COUNT(*) FROM free_entries WHERE user_id=u.id) + (SELECT COALESCE(SUM(points),0) FROM bonuses WHERE user_id=u.id) pts
  FROM users u WHERE u.banned=0 ORDER BY pts DESC, u.id ASC LIMIT ?`).all(n).filter(r => r.pts > 0);
app.get('/api/leaders', (req, res) => res.json(leaders(10).map((r, i) => ({ rank: i + 1, name: (r.name || 'משתתף').split(' ')[0], tail: r.phone.slice(-2), pts: r.pts }))));
// כניסה דרך קישור הזמנה: שומרים את הקוד בעוגייה ומעבירים לדף הבית
app.get('/r/:code', (req, res) => { res.cookie('ref', String(req.params.code).slice(0, 12), { maxAge: 30 * 864e5, sameSite: 'lax' }); res.redirect('/?ref=' + encodeURIComponent(req.params.code)); });

// ---------- קבלות ----------
const upload = multer({
  storage: multer.diskStorage({ destination: UPLOADS, filename: (q, f, cb) => cb(null, crypto.randomUUID() + path.extname(f.originalname || '.jpg').toLowerCase().slice(0, 6)) }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (q, f, cb) => cb(null, /^image\//.test(f.mimetype)),
});

app.post('/api/receipts', needUser, upload.single('image'), async (req, res) => {
  if (req.user.banned) { if (req.file) fs.unlink(req.file.path, () => {}); return res.status(403).json({ error: 'החשבון חסום' }); }
  const fail = (msg, code = 400) => { if (req.file) fs.unlink(req.file.path, () => {}); res.status(code).json({ error: msg }); };
  if (!req.file) return fail('צריך לצלם את הקבלה');
  const store = db.prepare('SELECT * FROM stores WHERE id=? AND active=1').get(req.body.store_id);
  if (!store) return fail('בחרו חנות שותפה');
  const receiptNo = String(req.body.receipt_no || '').replace(/\s/g, '').slice(0, 40);
  if (receiptNo.length < 2) return fail('נא להזין את מספר הקבלה');
  const amount = Number(req.body.amount);
  if (!(amount >= SHEKELS_PER_POINT) || amount > MAX_AMOUNT) return fail(`סכום לא תקין (בין ${SHEKELS_PER_POINT} ל-${MAX_AMOUNT} ₪)`);
  const d = new Date(req.body.receipt_date);
  const age = (Date.now() - d) / 864e5;
  if (isNaN(d) || age < -1 || age > MAX_RECEIPT_AGE_DAYS) return fail(`אפשר לסרוק קבלות מ-${MAX_RECEIPT_AGE_DAYS} הימים האחרונים בלבד`);
  const today = db.prepare("SELECT COUNT(*) c FROM receipts WHERE user_id=? AND date(created_at)=date('now')").get(req.user.id).c;
  if (today >= MAX_RECEIPTS_PER_DAY) return fail(`אפשר לסרוק עד ${MAX_RECEIPTS_PER_DAY} קבלות ביום`, 429);
  if (db.prepare('SELECT 1 FROM receipts WHERE store_id=? AND receipt_no=?').get(store.id, receiptNo)) return fail('הקבלה הזו כבר נסרקה');
  const rdate = d.toISOString().slice(0, 10);
  const check = await assess(db, { file: req.file.path, userId: req.user.id, store, amount, receiptNo, receiptDate: rdate, ip: req.ip });
  if (check.block) return fail(check.block, 409);
  const points = ptsFor(amount);
  try {
    db.prepare(`INSERT INTO receipts (user_id, store_id, receipt_no, amount, receipt_date, image, status, points, file_hash, vhash, risk, flags, ai, ip)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(req.user.id, store.id, receiptNo, amount, rdate, path.basename(req.file.path),
      check.auto ? 'approved' : 'pending', check.auto ? points : 0, check.sha, check.vhash, check.risk, JSON.stringify(check.flags), check.ai ? JSON.stringify(check.ai) : null, req.ip);
  } catch (e) {
    if (/UNIQUE/.test(e.message)) return fail('הקבלה הזו כבר נסרקה');
    throw e;
  }
  if (check.auto) rewardReferrer(req.user.id);
  res.json({ ok: true, expected: points, approved: check.auto });
});

// מסלול השתתפות בלי רכישה: נקודה אחת בשבוע תמורת תשובה לשאלה
app.post('/api/free-entry', needUser, (req, res) => {
  const answer = String(req.body.answer || '').trim();
  if (answer.length < 3) return res.status(400).json({ error: 'נא לענות על השאלה' });
  try { db.prepare('INSERT INTO free_entries (user_id, week, answer) VALUES (?,?,?)').run(req.user.id, weekKey(), answer.slice(0, 300)); }
  catch { return res.status(400).json({ error: 'כבר קיבלת את הנקודה החינמית השבוע' }); }
  res.json({ ok: true });
});

// ---------- הצטרפות עסק + תשלום (SUMIT דרך הגשר של GiveIL) ----------
const BIZ_PRICE = +(process.env.BIZ_PRICE || 250);
const PUBLIC = () => (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const bridge = async (path, body) => {
  if (!process.env.PAY_BRIDGE_URL || !process.env.PAY_BRIDGE_KEY) throw new Error('התשלום עדיין לא מחובר');
  const r = await fetch(process.env.PAY_BRIDGE_URL.replace(/\/$/, '') + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Ext-Key': process.env.PAY_BRIDGE_KEY }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'שגיאת תשלום'); return j;
};
app.get('/api/biz/price', (req, res) => res.json({ price: BIZ_PRICE }));
app.post('/api/biz/checkout', async (req, res) => {
  const { business, contact, phone, category, notes, email, company_no, agree } = req.body || {};
  const ph = normPhone(phone);
  if (!business || !ph || !contact) return res.status(400).json({ error: 'נא למלא שם עסק, איש קשר וטלפון נייד תקין' });
  if (!agree) return res.status(400).json({ error: 'יש לאשר את תנאי ההצטרפות לעסקים' });
  const id = db.prepare("INSERT INTO applications (business, contact, phone, category, notes, email, company_no, status) VALUES (?,?,?,?,?,?,?, 'pending_payment')")
    .run(String(business).slice(0, 80), String(contact).slice(0, 60), ph, String(category || '').slice(0, 40), String(notes || '').slice(0, 500), String(email || '').slice(0, 80), String(company_no || '').replace(/\D/g, '').slice(0, 12)).lastInsertRowid;
  const ref = 'kz-biz-' + id;
  db.prepare('UPDATE applications SET pay_ref=? WHERE id=?').run(ref, id);
  const base = PUBLIC() || (req.protocol + '://' + req.get('host'));
  try {
    const r = await bridge('/api/ext/sumit/begin', { amount: BIZ_PRICE, itemName: `${BRAND} – הצטרפות עסק: ${String(business).slice(0, 60)}`, name: String(business).slice(0, 80), phone: ph, email: email || null, customerRef: 'kz-' + ph, ref, returnUrl: `${base}/biz/return/${id}`, cancelUrl: `${base}/business.html?cancel=1#form` });
    res.json({ url: r.url });
  } catch (e) {
    console.error('checkout', e.message);
    if (process.env.ADMIN_PHONE) sendSms(process.env.ADMIN_PHONE, `עסק חדש ביקש להצטרף ל${BRAND} (התשלום לא נפתח): ${business} ${ph}`).catch(() => {});
    res.json({ fallback: true });
  }
});
app.get('/biz/return/:id', async (req, res) => {
  const a = db.prepare('SELECT * FROM applications WHERE id=?').get(req.params.id);
  const pid = req.query['OG-PaymentID'] || req.query.OG_PaymentID || req.query.paymentid;
  if (!a) return res.redirect('/business.html');
  if (a.status === 'paid') return res.redirect('/business.html?paid=1');
  try {
    const v = pid ? await bridge('/api/ext/sumit/verify', { paymentId: pid, ref: a.pay_ref }) : { paid: false };
    if (!v.paid) return res.redirect('/business.html?cancel=1#form');
    db.prepare("UPDATE applications SET status='paid', paid_at=datetime('now') WHERE id=?").run(a.id);
    db.prepare('INSERT INTO stores (name, category, address, emoji, active, paid) VALUES (?,?,?,?,0,1)').run(a.business, a.category || '', 'רעננה', '');
    if (process.env.ADMIN_PHONE) sendSms(process.env.ADMIN_PHONE, `עסק שילם והצטרף ל${BRAND}: ${a.business} ${a.phone}. להפעלה בפאנל הניהול.`).catch(() => {});
    sendSms(a.phone, `תודה! ${a.business} נרשם ל${BRAND}. נחזור אליכם תוך יום עסקים להפעלה.`).catch(() => {});
    res.redirect('/business.html?paid=1');
  } catch (e) { console.error('verify', e.message); res.redirect('/business.html?cancel=1#form'); }
});
app.post('/api/admin/pay/test', needAdmin, async (req, res) => { try { const r = await bridge('/api/ext/sumit/ping', {}); res.json(r); } catch (e) { res.json({ ok: false, msg: e.message }); } });

app.post('/api/business-apply', (req, res) => {
  const { business, contact, phone, category, notes } = req.body;
  if (!business || !normPhone(phone)) return res.status(400).json({ error: 'נא למלא שם עסק וטלפון תקין' });
  db.prepare('INSERT INTO applications (business, contact, phone, category, notes) VALUES (?,?,?,?,?)')
    .run(String(business).slice(0, 80), String(contact || '').slice(0, 60), normPhone(phone), String(category || '').slice(0, 40), String(notes || '').slice(0, 500));
  if (process.env.ADMIN_PHONE) sendSms(process.env.ADMIN_PHONE, `עסק חדש ביקש להצטרף ל${BRAND}: ${business} ${phone}`).catch(() => {});
  res.json({ ok: true });
});

// ---------- ניהול ----------
app.post('/api/admin/login', (req, res) => {
  const ok = crypto.timingSafeEqual(Buffer.from(hash(req.body.password || '')), Buffer.from(hash(ADMIN_PASSWORD)));
  if (!ok) return res.status(401).json({ error: 'סיסמה שגויה' });
  setCookie(res, 'adm', 'admin'); res.json({ ok: true });
});
app.get('/api/admin/overview', needAdmin, (req, res) => res.json({
  pending: db.prepare(`SELECT r.*, s.name store, u.phone, u.name uname, u.id uid,
    (SELECT COUNT(*) FROM receipts x WHERE x.user_id=u.id AND x.status='rejected') rejected_before
    FROM receipts r JOIN stores s ON s.id=r.store_id JOIN users u ON u.id=r.user_id WHERE r.status='pending' ORDER BY r.risk DESC, r.id`).all(),
  ai: !!process.env.ANTHROPIC_API_KEY,
  pay: !!(process.env.PAY_BRIDGE_URL && process.env.PAY_BRIDGE_KEY), bizPrice: BIZ_PRICE,
  stores: db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM receipts WHERE store_id=s.id AND status='approved') receipts,
    (SELECT COALESCE(SUM(amount),0) FROM receipts WHERE store_id=s.id AND status='approved') revenue,
    (SELECT COUNT(DISTINCT user_id) FROM receipts WHERE store_id=s.id AND status='approved') customers FROM stores s ORDER BY s.id DESC`).all(),
  raffles: db.prepare('SELECT r.*, u.phone wphone, u.name wname FROM raffles r LEFT JOIN users u ON u.id=r.winner_user_id ORDER BY draw_date').all(),
  applications: db.prepare('SELECT * FROM applications ORDER BY id DESC').all(),
  users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
  sms: smsConfig().type,
  smsCfg: (c => ({ type: c.type, user: c.user || '', sender: c.sender || '', sid: c.sid || '', from: c.from || '', hasToken: !!c.token }))(smsConfig()),
}));
// הגדרת ספק SMS מהפאנל. טוקן ריק = משאירים את הקיים
app.post('/api/admin/sms', needAdmin, (req, res) => {
  const b = req.body || {}, old = kvGet('sms') || {};
  const type = ['inforu', '019', 'twilio', 'none'].includes(b.type) ? b.type : 'none';
  const cfg = { type, user: String(b.user || '').trim(), sender: String(b.sender || '').trim().slice(0, 11), sid: String(b.sid || '').trim(), from: String(b.from || '').trim(),
    token: String(b.token || '').trim() || (old.type === type ? old.token : '') };
  kvSet('sms', cfg); res.json({ ok: true });
});
app.post('/api/admin/sms/test', needAdmin, async (req, res) => {
  const phone = normPhone(req.body.phone);
  if (!phone) return res.status(400).json({ error: 'מספר לא תקין' });
  if (!smsReady()) return res.status(400).json({ error: 'לא הוגדר ספק SMS' });
  try { await sendSms(phone, `הודעת בדיקה מ${BRAND}. ה-SMS עובד.`); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message.slice(0, 200) }); }
});
app.get('/api/admin/image/:file', needAdmin, (req, res) => res.sendFile(path.join(UPLOADS, path.basename(req.params.file))));
app.post('/api/admin/receipts/:id', needAdmin, (req, res) => {
  const r = db.prepare('SELECT * FROM receipts WHERE id=?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'לא נמצא' });
  if (req.body.action === 'approve') {
    const amount = req.body.amount ? Number(req.body.amount) : r.amount;
    db.prepare("UPDATE receipts SET status='approved', amount=?, points=? WHERE id=?").run(amount, ptsFor(amount), r.id);
    rewardReferrer(r.user_id);
  } else db.prepare("UPDATE receipts SET status='rejected', points=0, note=? WHERE id=?").run(String(req.body.note || '').slice(0, 120), r.id);
  res.json({ ok: true });
});
app.post('/api/admin/users/:id/ban', needAdmin, (req, res) => {
  db.prepare('UPDATE users SET banned=1 WHERE id=?').run(req.params.id);
  db.prepare("UPDATE receipts SET status='rejected', points=0, note='חשבון נחסם' WHERE user_id=?").run(req.params.id);
  db.prepare('DELETE FROM free_entries WHERE user_id=?').run(req.params.id);
  db.prepare('DELETE FROM bonuses WHERE user_id=? OR ref_user=?').run(req.params.id, req.params.id);
  res.json({ ok: true });
});
app.post('/api/admin/stores', needAdmin, (req, res) => {
  const { name, category, address, emoji } = req.body;
  if (!name) return res.status(400).json({ error: 'חסר שם' });
  db.prepare('INSERT INTO stores (name, category, address, emoji) VALUES (?,?,?,?)').run(name, category || '', address || '', emoji || '🏪');
  res.json({ ok: true });
});
app.post('/api/admin/stores/:id', needAdmin, (req, res) => {
  const f = { active: 'active', paid: 'paid' }[req.body.field];
  if (f) db.prepare(`UPDATE stores SET ${f}=1-${f} WHERE id=?`).run(req.params.id);
  if (req.body.delete) db.prepare('DELETE FROM stores WHERE id=? AND NOT EXISTS (SELECT 1 FROM receipts WHERE store_id=?)').run(req.params.id, req.params.id);
  res.json({ ok: true });
});
app.post('/api/admin/raffles', needAdmin, (req, res) => {
  const { title, prize, blurb, value, draw_date, is_grand, image, kind, rank } = req.body;
  if (!title || !prize || !draw_date) return res.status(400).json({ error: 'חסרים פרטים' });
  if (is_grand) db.prepare('UPDATE raffles SET is_grand=0').run();
  db.prepare('INSERT INTO raffles (title, prize, blurb, emoji, value, draw_date, is_grand, image, kind, rank) VALUES (?,?,?,?,?,?,?,?,?,?)').run(title, prize, blurb || '', '', value || '', draw_date, is_grand ? 1 : 0, image || null, kind === 'top' ? 'top' : 'raffle', kind === 'top' ? Math.max(1, +rank || 1) : null);
  res.json({ ok: true });
});
// עריכת פרס קיים
app.post('/api/admin/raffles/:id', needAdmin, (req, res) => {
  const r = db.prepare('SELECT * FROM raffles WHERE id=?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'לא נמצא' });
  const { title, prize, blurb, value, draw_date, is_grand, image, kind, rank } = req.body;
  if (!title || !prize || !draw_date) return res.status(400).json({ error: 'חסרים פרטים' });
  if (is_grand) db.prepare('UPDATE raffles SET is_grand=0 WHERE id<>?').run(r.id);
  db.prepare('UPDATE raffles SET title=?, prize=?, blurb=?, value=?, draw_date=?, is_grand=?, image=?, kind=?, rank=? WHERE id=?')
    .run(title, prize, blurb || '', value || '', draw_date, is_grand ? 1 : 0, image || null, kind === 'top' ? 'top' : 'raffle', kind === 'top' ? Math.max(1, +rank || 1) : null, r.id);
  res.json({ ok: true });
});
// העלאת תמונה לפרס: מוקטנת ונשמרת כ-JPG
const imgUp = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 }, fileFilter: (q, f, cb) => cb(null, /^image\//.test(f.mimetype)) });
app.post('/api/admin/upload', needAdmin, imgUp.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'לא התקבלה תמונה' });
  try {
    const name = crypto.randomUUID() + '.jpg';
    await require('sharp')(req.file.buffer).rotate().resize(1400, 1400, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(path.join(MEDIA, name));
    res.json({ url: '/media/' + name });
  } catch (e) { res.status(400).json({ error: 'קובץ התמונה לא תקין' }); }
});
app.post('/api/admin/raffles/:id/delete', needAdmin, (req, res) => { db.prepare('DELETE FROM raffles WHERE id=? AND winner_user_id IS NULL').run(req.params.id); res.json({ ok: true }); });

// הגרלה: כל נקודה = כרטיס אחד. בחירה אקראית קריפטוגרפית לפי משקל
app.post('/api/admin/raffles/:id/draw', needAdmin, (req, res) => {
  const raffle = db.prepare('SELECT * FROM raffles WHERE id=?').get(req.params.id);
  if (!raffle || raffle.winner_user_id) return res.status(400).json({ error: 'ההגרלה כבר בוצעה' });
  if (raffle.kind === 'top') { const l = leaders(raffle.rank || 1)[(raffle.rank || 1) - 1]; if (!l) return res.status(400).json({ error: 'אין עדיין מספיק משתתפים' });
    db.prepare("UPDATE raffles SET winner_user_id=?, drawn_at=datetime('now') WHERE id=?").run(l.id, raffle.id);
    sendSms(l.phone, `מזל טוב! סיימת במקום ${raffle.rank} בטבלת המובילים של ${BRAND} וזכית ב${raffle.prize}. ניצור איתך קשר בקרוב.`).catch(() => {});
    return res.json({ ok: true, winner: { name: l.name, phone: l.phone, tickets: l.pts, total: totalTickets() } }); }
  const pool = db.prepare('SELECT id, phone, name FROM users WHERE banned=0').all().map(u => ({ ...u, t: pointsOf(u.id) })).filter(u => u.t > 0);
  const total = pool.reduce((s, u) => s + u.t, 0);
  if (!total) return res.status(400).json({ error: 'אין עדיין משתתפים עם נקודות' });
  let pick = crypto.randomInt(total), winner;
  for (const u of pool) { if (pick < u.t) { winner = u; break; } pick -= u.t; }
  db.prepare("UPDATE raffles SET winner_user_id=?, drawn_at=datetime('now') WHERE id=?").run(winner.id, raffle.id);
  sendSms(winner.phone, `מזל טוב! זכית ב${raffle.prize} בהגרלת ${BRAND}. ניצור איתך קשר בקרוב.`).catch(() => {});
  res.json({ ok: true, winner: { name: winner.name, phone: winner.phone, tickets: winner.t, total } });
});

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'שגיאה בשרת' }); });
app.listen(PORT, () => console.log(`${BRAND} רץ על פורט ${PORT} | SMS: ${smsConfig().type}`));
