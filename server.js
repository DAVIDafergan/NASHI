import express from 'express';
import Database from 'better-sqlite3';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(path.join(DATA, 'uploads'), { recursive: true });
const ADMIN_PIN = process.env.ADMIN_PIN || '1234';

const db = new Database(path.join(DATA, 'tromot.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS campaigns(
  id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  goal INTEGER DEFAULT 100000, currency TEXT DEFAULT '₪', settings TEXT DEFAULT '{}', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS donations(
  id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER NOT NULL, donor TEXT NOT NULL, amount INTEGER NOT NULL,
  dedication TEXT DEFAULT '', city TEXT DEFAULT '', anonymous INTEGER DEFAULT 0, hidden INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(campaign_id) REFERENCES campaigns(id));
CREATE INDEX IF NOT EXISTS d_c ON donations(campaign_id, created_at);
`);

const DEFAULTS = {
  theme: 'royal', layout: 'center', title: 'קמפיין התרמה', subtitle: 'יחד נגיע ליעד',
  primary: '#C9A961', bg1: '#0B1D3A', bg2: '#1E3A6E', text: '#FFFFFF', font: 'Heebo', logo: '', bgImage: '', bgVideo: '',
  showGoal: true, showTicker: true, showList: true, listCount: 8, showClock: true, showQr: false, qrUrl: '',
  popupStyle: 'card', popupSeconds: 7, sound: 'chime', volume: 0.8, confetti: true, bigThreshold: 1000,
  bigSound: 'fanfare', showAmount: true, roundUp: true, ticker: 'תודה לכל התורמים! כל תרומה מקרבת אותנו ליעד', blessing: 'תזכו למצוות',
  goalMsg: 'הגענו ליעד! תודה!', speech: false, currency: '₪', dedicationShow: true, latestFirst: true, dim: 0.35, idleMsg: '', countUp: true,
  wallCols: 3, screens: {}, skin: '', plaqueImg: '/skin/plaque.webp',
  scrollTitle: '', scrollSub: '', quote: '',
  tier1Name: 'שותף כסף', tier1Sub: 'החזקת תלמיד', tier1Amt: 148, tier2Name: 'שותף זהב', tier2Sub: 'החזקת יום במוסדות', tier2Amt: 248, tier3Name: 'שותף יהלום', tier3Sub: 'החזקת שבוע במוסדות', tier3Amt: 512
};
const getCampaign = (slug) => db.prepare('SELECT * FROM campaigns WHERE slug=?').get(slug);
const settingsOf = (c) => ({ ...DEFAULTS, ...JSON.parse(c.settings || '{}') });
if (!db.prepare('SELECT COUNT(*) n FROM campaigns').get().n) {
  db.prepare('INSERT INTO campaigns(slug,name,goal,settings) VALUES(?,?,?,?)').run('main', 'קמפיין ראשי', 100000, '{}');
}
{
  const PRESET = { skin: 'shtar', layout: 'wallcounter', title: 'בנחלים יהלכון', scrollTitle: 'שטר שותפות ותמיכה במוסדות התורה',
    scrollSub: 'מוסדות התורה והחסד "נחלי התורה" בשיאורתו הרה"ג הרב נתן מרדכי ישראל שליט"א', quote: '"כי לי כל הבכור… ויתמכו בו ויחזקו ידיו"',
    ticker: 'הריני השותף בנחלים יהלכון למען דור העתיד ✦ תזכו למצוות', wallCols: 3 };
  const m = db.prepare("SELECT id,settings FROM campaigns WHERE slug='main'").get();
  if (m && (m.settings || '{}') === '{}') db.prepare('UPDATE campaigns SET settings=? WHERE id=?').run(JSON.stringify(PRESET), m.id);
}
const totals = (cid) => db.prepare('SELECT COALESCE(SUM(amount),0) total, COUNT(*) count FROM donations WHERE campaign_id=? AND hidden=0').get(cid);
const recent = (cid, n) => db.prepare('SELECT id,donor,amount,dedication,city,anonymous,created_at FROM donations WHERE campaign_id=? AND hidden=0 ORDER BY id DESC LIMIT ?').all(cid, n);
const top = (cid, n) => db.prepare('SELECT id,donor,amount,dedication,city,anonymous FROM donations WHERE campaign_id=? AND hidden=0 ORDER BY amount DESC, id DESC LIMIT ?').all(cid, n);
const amounts = (cid) => Object.fromEntries(db.prepare('SELECT amount a, COUNT(*) n FROM donations WHERE campaign_id=? AND hidden=0 GROUP BY amount').all(cid).map(r => [r.a, r.n]));
const pub = (d) => ({ ...d, donor: d.anonymous ? 'תורם/ת אנונימי/ת' : d.donor });
const state = (c) => { const t = totals(c.id); return { slug: c.slug, name: c.name, goal: c.goal, total: t.total, count: t.count, settings: settingsOf(c), recent: recent(c.id, 30).map(pub), wall: recent(c.id, 300).map(pub), amounts: amounts(c.id), top: top(c.id, 10).map(pub) }; };

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const rooms = new Map();
wss.on('connection', (ws, req) => {
  const slug = new URL(req.url, 'http://x').searchParams.get('c') || 'main';
  if (!rooms.has(slug)) rooms.set(slug, new Set());
  rooms.get(slug).add(ws);
  const c = getCampaign(slug); if (c) ws.send(JSON.stringify({ type: 'state', state: state(c) }));
  ws.on('close', () => rooms.get(slug)?.delete(ws));
  ws.on('message', (m) => { try { if (JSON.parse(m).type === 'ping') ws.send('{"type":"pong"}'); } catch {} });
});
const broadcast = (slug, msg) => { const s = JSON.stringify(msg); rooms.get(slug)?.forEach(ws => { if (ws.readyState === 1) ws.send(s); }); };
const pushState = (c) => broadcast(c.slug, { type: 'state', state: state(c) });

app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(DATA, 'uploads'), { maxAge: '30d' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } }));

const auth = (req, res, next) => { if ((req.get('x-pin') || req.query.pin) === ADMIN_PIN) return next(); res.status(401).json({ error: 'קוד ניהול שגוי' }); };

// ---- public ----
app.get('/api/c/:slug', (req, res) => { const c = getCampaign(req.params.slug); if (!c) return res.status(404).json({ error: 'not found' }); res.json(state(c)); });
app.get('/api/c/:slug/donations', (req, res) => { const c = getCampaign(req.params.slug); if (!c) return res.status(404).json({ error: 'not found' }); res.json(db.prepare('SELECT * FROM donations WHERE campaign_id=? ORDER BY id DESC LIMIT 500').all(c.id)); });

// ---- admin ----
app.post('/api/login', (req, res) => res.json({ ok: (req.body?.pin || '') === ADMIN_PIN }));
app.get('/api/campaigns', auth, (_, res) => res.json(db.prepare('SELECT id,slug,name,goal FROM campaigns ORDER BY id').all()));
app.post('/api/campaigns', auth, (req, res) => {
  const { name, goal } = req.body || {}; if (!name) return res.status(400).json({ error: 'חסר שם' });
  const slug = (req.body.slug || name).toString().toLowerCase().replace(/[^a-z0-9א-ת]+/g, '-').replace(/^-|-$/g, '') || crypto.randomBytes(3).toString('hex');
  try { db.prepare('INSERT INTO campaigns(slug,name,goal,settings) VALUES(?,?,?,?)').run(slug, name, Number(goal) || 100000, '{}'); res.json(getCampaign(slug)); }
  catch { res.status(400).json({ error: 'השם כבר קיים' }); }
});
app.put('/api/c/:slug', auth, (req, res) => {
  const c = getCampaign(req.params.slug); if (!c) return res.status(404).json({ error: 'not found' });
  const { name, goal, settings } = req.body || {};
  const merged = { ...JSON.parse(c.settings || '{}'), ...(settings || {}) };
  db.prepare('UPDATE campaigns SET name=COALESCE(?,name), goal=COALESCE(?,goal), settings=? WHERE id=?').run(name ?? null, goal != null ? Number(goal) : null, JSON.stringify(merged), c.id);
  const u = getCampaign(c.slug); pushState(u); res.json(state(u));
});
app.post('/api/c/:slug/donations', auth, (req, res) => {
  const c = getCampaign(req.params.slug); if (!c) return res.status(404).json({ error: 'not found' });
  const { donor, amount, dedication = '', city = '', anonymous = 0 } = req.body || {};
  const amt = Math.round(Number(amount)); if (!donor?.trim() || !(amt > 0)) return res.status(400).json({ error: 'שם וסכום חובה' });
  const r = db.prepare('INSERT INTO donations(campaign_id,donor,amount,dedication,city,anonymous) VALUES(?,?,?,?,?,?)').run(c.id, donor.trim(), amt, dedication, city, anonymous ? 1 : 0);
  const d = pub(db.prepare('SELECT * FROM donations WHERE id=?').get(r.lastInsertRowid));
  const t = totals(c.id);
  broadcast(c.slug, { type: 'donation', donation: d, total: t.total, count: t.count, goal: c.goal });
  res.json({ ok: true, donation: d, total: t.total });
});
app.post('/api/c/:slug/test', auth, (req, res) => { const c = getCampaign(req.params.slug); if (!c) return res.status(404).end(); const t = totals(c.id); broadcast(c.slug, { type: 'donation', test: true, donation: { donor: req.body?.donor || 'תורם לדוגמה', amount: Number(req.body?.amount) || 180, dedication: req.body?.dedication || 'לרפואה שלמה', city: '' }, total: t.total, count: t.count, goal: c.goal }); res.json({ ok: true }); });
app.delete('/api/c/:slug/donations/:id', auth, (req, res) => { const c = getCampaign(req.params.slug); if (!c) return res.status(404).end(); db.prepare('UPDATE donations SET hidden=1 WHERE id=? AND campaign_id=?').run(req.params.id, c.id); pushState(c); res.json({ ok: true }); });
app.post('/api/c/:slug/donations/:id/restore', auth, (req, res) => { const c = getCampaign(req.params.slug); if (!c) return res.status(404).end(); db.prepare('UPDATE donations SET hidden=0 WHERE id=? AND campaign_id=?').run(req.params.id, c.id); pushState(c); res.json({ ok: true }); });
app.put('/api/c/:slug/donations/:id', auth, (req, res) => { const c = getCampaign(req.params.slug); if (!c) return res.status(404).end(); const { donor, amount, dedication, city, anonymous } = req.body || {}; db.prepare('UPDATE donations SET donor=COALESCE(?,donor), amount=COALESCE(?,amount), dedication=COALESCE(?,dedication), city=COALESCE(?,city), anonymous=COALESCE(?,anonymous) WHERE id=? AND campaign_id=?').run(donor ?? null, amount != null ? Math.round(Number(amount)) : null, dedication ?? null, city ?? null, anonymous != null ? (anonymous ? 1 : 0) : null, req.params.id, c.id); pushState(c); res.json({ ok: true }); });
app.post('/api/c/:slug/message', auth, (req, res) => { const c = getCampaign(req.params.slug); if (!c) return res.status(404).end(); broadcast(c.slug, { type: 'message', text: String(req.body?.text || ''), seconds: Number(req.body?.seconds) || 10 }); res.json({ ok: true }); });
app.post('/api/c/:slug/command', auth, (req, res) => { const c = getCampaign(req.params.slug); if (!c) return res.status(404).end(); broadcast(c.slug, { type: 'command', cmd: String(req.body?.cmd || ''), arg: req.body?.arg }); res.json({ ok: true }); });
app.post('/api/c/:slug/reset', auth, (req, res) => { const c = getCampaign(req.params.slug); if (!c) return res.status(404).end(); db.prepare('UPDATE donations SET hidden=1 WHERE campaign_id=?').run(c.id); pushState(c); res.json({ ok: true }); });
app.get('/api/c/:slug/export.csv', auth, (req, res) => { const c = getCampaign(req.params.slug); if (!c) return res.status(404).end(); const rows = db.prepare('SELECT id,donor,amount,dedication,city,anonymous,hidden,created_at FROM donations WHERE campaign_id=? ORDER BY id').all(c.id); res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${c.slug}.csv"`); res.send('﻿' + ['id,donor,amount,dedication,city,anonymous,hidden,created_at', ...rows.map(r => [r.id, r.donor, r.amount, r.dedication, r.city, r.anonymous, r.hidden, r.created_at].map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(','))].join('\n')); });
const upload = multer({ storage: multer.diskStorage({ destination: path.join(DATA, 'uploads'), filename: (_, f, cb) => cb(null, crypto.randomBytes(8).toString('hex') + path.extname(f.originalname).toLowerCase()) }), limits: { fileSize: 25 * 1024 * 1024 }, fileFilter: (_, f, cb) => cb(null, /^(image|video|audio)\//.test(f.mimetype)) });
app.post('/api/upload', auth, upload.single('file'), (req, res) => { if (!req.file) return res.status(400).json({ error: 'קובץ לא נתמך' }); res.json({ url: '/uploads/' + req.file.filename }); });

app.get('/screen/:slug', (_, res) => res.sendFile(path.join(__dirname, 'public', 'screen.html')));
app.get('/admin', (_, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/', (_, res) => res.redirect('/admin'));
server.listen(process.env.PORT || 3000, () => console.log('tromot up'));
