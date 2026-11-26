// Fundraising events: live event screens (styles from the screens app), pledges that show only on
// the screen (never added to the campaign total), and optional live campaign donations on the screen.
const crypto = require('crypto');

module.exports = function installEvents(app, { db, J, bad, auth, own, stats, isTest, safeUrl, SITE, pub }) {
  db.exec(`CREATE TABLE IF NOT EXISTS fr_events(id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE, key TEXT UNIQUE, name TEXT, at TEXT DEFAULT '', settings TEXT DEFAULT '{}', live_from TEXT DEFAULT '', created TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS fr_pledges(id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER REFERENCES fr_events(id) ON DELETE CASCADE, name TEXT, phone TEXT DEFAULT '', email TEXT DEFAULT '', amount INTEGER DEFAULT 0, dedication TEXT DEFAULT '', note TEXT DEFAULT '', status TEXT DEFAULT 'pledged', hidden INTEGER DEFAULT 0, sent_at TEXT DEFAULT '', created TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS fr_pl_e ON fr_pledges(event_id);`);

  // modern screens (event-live.html) + the decorated gala screen from the screens app (event-screen.html)
  const STYLES = {
    stage: { engine: 'modern' }, aurora: { engine: 'modern' }, gold: { engine: 'modern' }, paper: { engine: 'modern' }, score: { engine: 'modern' }, wall: { engine: 'modern' },
    gala: { engine: 'gala', skin: 'gala', layout: 'center' }
  };
  const FONTS = ['heebo', 'rubik', 'assistant', 'secular', 'suez', 'frank', 'david', 'bellefair'];
  const BASE = { theme: 'royal', layout: 'center', primary: '#D9B46A', bg1: '#0B1D3A', bg2: '#1E3A6E', text: '#FFFFFF', font: 'Heebo', showGoal: true, showTicker: true, showList: true, listCount: 8, showClock: true, showQr: true, popupStyle: 'card', popupSeconds: 7, sound: 'chime', volume: 0.8, confetti: true, bigThreshold: 1000, bigSound: 'fanfare', showAmount: true, roundUp: true, blessing: 'תזכו למצוות', goalMsg: 'הגענו ליעד! תודה!', speech: false, dedicationShow: true, latestFirst: true, dim: 0.35, idleMsg: '', countUp: true, wallCols: 3, logoScale: 1, screens: {}, skin: '', plaqueImg: '/ev/skin/plaque.webp', res: 'auto', tier1Name: '', tier2Name: '', tier3Name: '' };
  const shade = (hex, p) => { const n = parseInt(String(hex).slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v + (p < 0 ? v : 255 - v) * p / 100))); return '#' + [n >> 16, n >> 8 & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join(''); };
  const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
  const campOf = e => db.prepare('SELECT * FROM campaigns WHERE id=?').get(e.campaign_id);

  function settingsFor(e, c, styleOverride) {
    const es = J(e.settings), cs = J(c.settings), med = (cs.media && cs.media.default) || {};
    const style = STYLES[styleOverride] ? styleOverride : (STYLES[es.style] ? es.style : 'stage');
    const col = /^#[0-9a-f]{6}$/i.test(c.color || '') ? c.color : '#5C0A1E';
    // background: the style's own (default) / the campaign banner / media uploaded for the screens only
    const bgMode = ['campaign', 'own'].includes(es.bg) ? es.bg : 'style';
    return { ...BASE, ...STYLES[style], bg1: shade(col, -70), bg2: shade(col, -35),
      title: es.title || c.title, subtitle: es.subtitle !== undefined ? es.subtitle : (c.subtitle || ''),
      logo: es.logo || c.logo || '', bgImage: bgMode === 'campaign' ? ((med.desktop || [])[0] || c.cover || '') : bgMode === 'own' ? (es.bgImage || '') : '', bgVideo: bgMode === 'own' ? (es.bgVideo || '') : '',
      currency: c.currency === 'USD' ? '$' : '₪', qrUrl: `${SITE()}/c/${c.slug}`, qrText: es.qrText || 'סרקו ותרמו', showQr: es.showQr !== false,
      ticker: es.ticker || `תודה לכל התורמים! · ${c.title}`, res: /^\d{3,5}x\d{3,5}$/.test(es.res || '') ? es.res : 'auto',
      showAmount: es.showAmount !== false, sound: es.sound || 'chime', confetti: es.confetti !== false, idleMsg: es.idleMsg || '',
      popupSeconds: Math.min(20, Math.max(3, +es.popupSeconds || 7)), style, engine: STYLES[style].engine,
      font: FONTS.includes(es.font) ? es.font : '', accent: /^#[0-9a-f]{6}$/i.test(es.accent || '') ? es.accent : col, bigThreshold: Math.max(1, +es.bigThreshold || 1000) };
  }
  const pledgesOf = e => db.prepare("SELECT * FROM fr_pledges WHERE event_id=? AND status!='cancelled' AND hidden=0 ORDER BY id DESC").all(e.id);
  const liveOf = (e, c) => { if (J(e.settings).live === false || !e.live_from) return []; return db.prepare("SELECT * FROM donations WHERE campaign_id=? AND status='paid' AND test=? AND COALESCE(paid_at,created)>=? ORDER BY id DESC LIMIT 500").all(c.id, isTest(c) ? 1 : 0, e.live_from); };
  const pItem = p => ({ id: 'p' + p.id, donor: p.name || 'תורם', amount: p.amount, dedication: p.dedication || '', created_at: p.created });
  const dItem = d => ({ id: 'd' + d.id, donor: d.anonymous || !d.name ? 'אנונימי/ת' : d.name, amount: d.amount, dedication: d.dedication || '', created_at: d.paid_at || d.created, live: 1 });
  function totals(e, c) {
    const s = J(e.settings); const pl = pledgesOf(e), lv = liveOf(e, c);
    const items = [...pl.map(pItem), ...lv.map(dItem)].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    let total = items.reduce((a, x) => a + (+x.amount || 0), 0), count = items.length;
    if (s.addCampaign) { const st = stats(c, isTest(c)); total += st.total - lv.reduce((a, d) => a + d.amount, 0); count += st.count - lv.length; }
    return { items, total, count, goal: +s.goal || c.goal || 0 };
  }
  const DEMO = [['משפחת כהן', 1800, 'לעילוי נשמת סבא'], ['יוסף לוי', 360, ''], ['אנונימי/ת', 5000, 'להצלחת הילדים'], ['שרה ודוד', 180, ''], ['משפחת אברהם', 1000, 'לרפואה שלמה'], ['מנחם', 72, ''], ['ישראל ורחל', 3600, ''], ['בית הכנסת', 2500, '']];
  function state(e, c, q = {}) {
    const s = settingsFor(e, c, q.style); let { items, total, count, goal } = totals(e, c);
    if (q.demo && !items.length) { items = DEMO.map(([donor, amount, dedication], i) => ({ id: 'x' + i, donor, amount, dedication, created_at: '' })); total = items.reduce((a, x) => a + x.amount, 0); count = items.length; }
    const amounts = {}; items.forEach(x => { amounts[x.amount] = (amounts[x.amount] || 0) + 1; });
    return { build: 'ev2', engine: s.engine, slug: e.key, name: e.name, goal, total, count, settings: s, recent: items.slice(0, 30), wall: items.slice(0, 300), amounts, top: [...items].sort((a, b) => b.amount - a.amount).slice(0, 10) };
  }

  const subs = new Map();
  const send = (eid, msg) => { const set = subs.get(eid); if (!set || !set.size) return; const m = `data: ${JSON.stringify(msg)}\n\n`; for (const r of set) { try { r.write(m); } catch { } } };
  const push = (e, c, item, extra = {}) => { const t = totals(e, c); send(e.id, { type: 'donation', donation: item, total: t.total, count: t.count, goal: t.goal, ...extra }); };
  const refresh = (e, c) => send(e.id, { type: 'state', state: state(e, c) });
  function forward(cid, data) {
    try {
      if (!subs.size) return; const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(cid); if (!c) return; const d = data.donation;
      for (const e of db.prepare("SELECT * FROM fr_events WHERE campaign_id=? AND live_from!=''").all(cid)) {
        if (J(e.settings).live === false || !(subs.get(e.id) && subs.get(e.id).size)) continue;
        push(e, c, { id: 'd' + d.id, donor: d.anonymous || !d.name ? 'אנונימי/ת' : d.name, amount: d.amount, dedication: d.dedication || '', created_at: d.created, live: 1 });
      }
    } catch (er) { console.error('events.forward', er.message); }
  }

  const evOwn = (req, res, next) => { const e = db.prepare('SELECT * FROM fr_events WHERE id=? AND campaign_id=?').get(req.params.eid, req.c.id); if (!e) return bad(res, 'not found', 404); req.ev = e; next(); };
  const out = e => ({ ...e, settings: J(e.settings) });
  const pOut = p => ({ id: p.id, name: p.name, phone: p.phone, email: p.email, amount: p.amount, dedication: p.dedication, note: p.note, status: p.status, hidden: !!p.hidden, sent_at: p.sent_at, created: p.created });
  const pIn = b => ({ name: String(b.name || '').trim().slice(0, 80), phone: String(b.phone || '').replace(/[^\d+]/g, '').slice(0, 20), email: String(b.email || '').trim().slice(0, 120), amount: Math.max(0, Math.round(+b.amount || 0)), dedication: String(b.dedication || '').slice(0, 200), note: String(b.note || '').slice(0, 300) });

  app.get('/api/campaigns/:id/events', auth, own, (req, res) => res.json(db.prepare('SELECT * FROM fr_events WHERE campaign_id=? ORDER BY id DESC').all(req.c.id).map(e => { const t = totals(e, req.c); return { ...out(e), total: t.total, count: t.count, screens: (subs.get(e.id) || new Set()).size, pledges: db.prepare("SELECT COUNT(*) n FROM fr_pledges WHERE event_id=? AND status!='cancelled'").get(e.id).n }; })));
  app.post('/api/campaigns/:id/events', auth, own, (req, res) => {
    const b = req.body || {}; const name = String(b.name || '').trim().slice(0, 100) || 'אירוע התרמה'; const key = crypto.randomBytes(6).toString('base64url');
    const r = db.prepare('INSERT INTO fr_events(campaign_id,key,name,at,settings,live_from) VALUES(?,?,?,?,?,?)').run(req.c.id, key, name, String(b.at || '').slice(0, 20), JSON.stringify({ style: 'stage', live: true, bg: 'style' }), now());
    res.json({ id: r.lastInsertRowid, key });
  });
  app.get('/api/campaigns/:id/events/:eid', auth, own, evOwn, (req, res) => { const t = totals(req.ev, req.c); res.json({ ...out(req.ev), total: t.total, count: t.count, goal: t.goal, liveCount: t.items.filter(x => x.live).length, liveSum: t.items.filter(x => x.live).reduce((a, x) => a + x.amount, 0), screens: (subs.get(req.ev.id) || new Set()).size, pledges: db.prepare('SELECT * FROM fr_pledges WHERE event_id=? ORDER BY id DESC').all(req.ev.id).map(pOut) }); });
  app.put('/api/campaigns/:id/events/:eid', auth, own, evOwn, (req, res) => {
    const b = req.body || {}; const s = { ...J(req.ev.settings) };
    for (const k of ['title', 'subtitle', 'ticker', 'qrText', 'idleMsg']) if (b[k] !== undefined) s[k] = String(b[k]).slice(0, 200);
    for (const k of ['live', 'addCampaign', 'showQr', 'showAmount', 'confetti']) if (b[k] !== undefined) s[k] = !!b[k];
    if (b.style !== undefined && STYLES[b.style]) s.style = b.style;
    if (b.bg !== undefined) s.bg = ['campaign', 'own'].includes(b.bg) ? b.bg : 'style';
    for (const k of ['bgImage', 'bgVideo', 'logo']) if (b[k] !== undefined) s[k] = safeUrl(b[k]);
    if (b.res !== undefined) s.res = /^\d{3,5}x\d{3,5}$/.test(b.res) ? b.res : 'auto';
    if (b.goal !== undefined) s.goal = Math.max(0, Math.round(+b.goal || 0));
    if (b.sound !== undefined) s.sound = String(b.sound).slice(0, 20);
    if (b.font !== undefined) s.font = FONTS.includes(b.font) ? b.font : '';
    if (b.accent !== undefined) s.accent = /^#[0-9a-f]{6}$/i.test(b.accent || '') ? b.accent : '';
    if (b.bigThreshold !== undefined) s.bigThreshold = Math.max(1, Math.round(+b.bigThreshold || 1000));
    if (b.popupSeconds !== undefined) s.popupSeconds = Math.min(20, Math.max(3, +b.popupSeconds || 7));
    const name = b.name !== undefined ? (String(b.name).trim().slice(0, 100) || req.ev.name) : req.ev.name; const at = b.at !== undefined ? String(b.at).slice(0, 20) : req.ev.at;
    const liveFrom = b.resetLive ? now() : req.ev.live_from;
    db.prepare('UPDATE fr_events SET name=?, at=?, settings=?, live_from=? WHERE id=?').run(name, at, JSON.stringify(s), liveFrom, req.ev.id);
    refresh(db.prepare('SELECT * FROM fr_events WHERE id=?').get(req.ev.id), req.c); res.json({ ok: true });
  });
  app.delete('/api/campaigns/:id/events/:eid', auth, own, evOwn, (req, res) => { db.prepare('DELETE FROM fr_pledges WHERE event_id=?').run(req.ev.id); db.prepare('DELETE FROM fr_events WHERE id=?').run(req.ev.id); res.json({ ok: true }); });

  app.post('/api/campaigns/:id/events/:eid/pledges', auth, own, evOwn, (req, res) => {
    const list = Array.isArray(req.body && req.body.list) ? req.body.list.slice(0, 2000) : [req.body || {}];
    const silent = !!(req.body && req.body.silent) || list.length > 1; let n = 0, last = null;
    const ins = db.prepare('INSERT INTO fr_pledges(event_id,name,phone,email,amount,dedication,note) VALUES(?,?,?,?,?,?,?)');
    for (const raw of list) { const p = pIn(raw); if (!p.name || p.amount <= 0) continue; const r = ins.run(req.ev.id, p.name, p.phone, p.email, p.amount, p.dedication, p.note); last = db.prepare('SELECT * FROM fr_pledges WHERE id=?').get(r.lastInsertRowid); n++; }
    if (!n) return bad(res, 'נא למלא שם וסכום');
    if (silent) refresh(req.ev, req.c); else push(req.ev, req.c, pItem(last));
    res.json({ ok: true, n, id: last.id });
  });
  app.put('/api/campaigns/:id/events/:eid/pledges/:pid', auth, own, evOwn, (req, res) => {
    const p0 = db.prepare('SELECT * FROM fr_pledges WHERE id=? AND event_id=?').get(req.params.pid, req.ev.id); if (!p0) return bad(res, 'not found', 404);
    const b = req.body || {}; const p = pIn({ ...p0, ...b });
    const status = ['pledged', 'paid', 'cancelled'].includes(b.status) ? b.status : p0.status; const hidden = b.hidden !== undefined ? (b.hidden ? 1 : 0) : p0.hidden; const sent = b.sent ? now() : p0.sent_at;
    db.prepare('UPDATE fr_pledges SET name=?,phone=?,email=?,amount=?,dedication=?,note=?,status=?,hidden=?,sent_at=? WHERE id=?').run(p.name || p0.name, p.phone, p.email, p.amount || p0.amount, p.dedication, p.note, status, hidden, sent, p0.id);
    if (!b.sent) refresh(req.ev, req.c); res.json({ ok: true });
  });
  app.delete('/api/campaigns/:id/events/:eid/pledges/:pid', auth, own, evOwn, (req, res) => { db.prepare('DELETE FROM fr_pledges WHERE id=? AND event_id=?').run(req.params.pid, req.ev.id); refresh(req.ev, req.c); res.json({ ok: true }); });
  app.post('/api/campaigns/:id/events/:eid/pledges/:pid/show', auth, own, evOwn, (req, res) => { const p = db.prepare('SELECT * FROM fr_pledges WHERE id=? AND event_id=?').get(req.params.pid, req.ev.id); if (!p) return bad(res, 'not found', 404); const t = totals(req.ev, req.c); send(req.ev.id, { type: 'donation', donation: pItem(p), total: t.total, count: t.count, goal: t.goal, replay: 1 }); res.json({ ok: true }); });
  app.post('/api/campaigns/:id/events/:eid/screen', auth, own, evOwn, (req, res) => {
    const b = req.body || {};
    if (b.text) send(req.ev.id, { type: 'message', text: String(b.text).slice(0, 200), seconds: Math.min(60, +b.seconds || 10) });
    else if (b.cmd) send(req.ev.id, { type: 'command', cmd: String(b.cmd).slice(0, 20), arg: String(b.arg || '').slice(0, 200) });
    res.json({ ok: true, screens: (subs.get(req.ev.id) || new Set()).size });
  });

  const XLSX = require('./xlsx');
  const ST = { pledged: 'התחייב', paid: 'שילם', cancelled: 'בוטל' };
  app.get('/api/campaigns/:id/events/:eid/pledges.xlsx', auth, own, evOwn, (req, res) => {
    const e = req.ev, c = req.c; const ps = db.prepare('SELECT * FROM fr_pledges WHERE event_id=? ORDER BY id').all(e.id); const lv = liveOf(e, c);
    const day = new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const act = ps.filter(p => p.status !== 'cancelled');
    const sheets = [{ name: 'התחייבויות', title: `התחייבויות – ${e.name} · ${c.title} · הופק ${day}`, cols: [{ h: '#', t: 'int', w: 6, count: 1 }, { h: 'תאריך', t: 'date', w: 17 }, { h: 'שם', w: 24 }, { h: 'סכום', t: 'money', w: 13, sum: 1 }, { h: 'סטטוס', w: 10 }, { h: 'טלפון', w: 14 }, { h: 'אימייל', w: 24 }, { h: 'הקדשה', t: 'wrap', w: 28 }, { h: 'הערה', t: 'wrap', w: 24 }, { h: 'הודעה נשלחה', w: 17 }, { h: 'מוסתר מהמסך', w: 10 }],
      rows: ps.map((p, i) => [i + 1, p.created, p.name, p.amount, ST[p.status] || p.status, p.phone, p.email, p.dedication, p.note, p.sent_at || '', p.hidden ? 'כן' : '']), totals: { label: 'סה"כ' } }];
    if (lv.length) sheets.push({ name: 'תרומות מהאתר', title: `תרומות שנכנסו לקמפיין בזמן האירוע`, cols: [{ h: '#', t: 'int', w: 6, count: 1 }, { h: 'תאריך', t: 'date', w: 17 }, { h: 'שם', w: 24 }, { h: 'סכום', t: 'money', w: 13, sum: 1 }, { h: 'הקדשה', t: 'wrap', w: 28 }], rows: lv.map((d, i) => [i + 1, d.paid_at || d.created, (d.name || '') + (d.anonymous ? ' (אנונימי בדף)' : ''), d.amount, d.dedication || '']), totals: { label: 'סה"כ' } });
    const sum = a => a.reduce((x, y) => x + y.amount, 0);
    sheets.push({ name: 'סיכום', title: `סיכום – ${e.name}`, cols: [{ h: 'נושא', w: 30 }, { h: 'מספר', t: 'int', w: 10 }, { h: 'סכום', t: 'money', w: 14 }], rows: [['התחייבויות פעילות', act.length, sum(act)], ['מתוכן שילמו', act.filter(p => p.status === 'paid').length, sum(act.filter(p => p.status === 'paid'))], ['עוד לא שילמו', act.filter(p => p.status === 'pledged').length, sum(act.filter(p => p.status === 'pledged'))], ['בוטלו', ps.length - act.length, sum(ps.filter(p => p.status === 'cancelled'))], ['תרומות מהאתר באירוע', lv.length, sum(lv)]] });
    const name = `${e.name} - התחייבויות`; res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}.xlsx`); res.send(XLSX.build(sheets));
  });
  app.post('/api/campaigns/:id/events/:eid/duplicate', auth, own, evOwn, (req, res) => {
    const key = crypto.randomBytes(6).toString('base64url');
    const r = db.prepare('INSERT INTO fr_events(campaign_id,key,name,at,settings,live_from) VALUES(?,?,?,?,?,?)').run(req.c.id, key, (req.ev.name + ' (עותק)').slice(0, 100), '', req.ev.settings, now());
    res.json({ id: r.lastInsertRowid, key });
  });
  const byKey = k => db.prepare('SELECT * FROM fr_events WHERE key=?').get(String(k || ''));
  app.get('/api/e/:key/state', (req, res) => { const e = byKey(req.params.key); if (!e) return bad(res, 'not found', 404); res.setHeader('Cache-Control', 'no-store'); res.json(state(e, campOf(e), { style: req.query.style, demo: req.query.demo === '1' })); });
  app.get('/api/e/:key/stream', (req, res) => {
    const e = byKey(req.params.key); if (!e) return res.status(404).end();
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' }); res.write(':ok\n\n');
    if (!subs.has(e.id)) subs.set(e.id, new Set()); subs.get(e.id).add(res);
    const ping = setInterval(() => { try { res.write(':p\n\n'); } catch { } }, 25000);
    req.on('close', () => { clearInterval(ping); const s = subs.get(e.id); if (s) s.delete(res); });
  });
  app.get('/e/:key', (req, res) => { const e = byKey(req.params.key); if (!e) return res.status(404).sendFile(pub('404.html')); const st = STYLES[req.query.style] ? req.query.style : J(e.settings).style; res.setHeader('Cache-Control', 'no-cache'); res.sendFile(pub(STYLES[st] && STYLES[st].engine === 'gala' ? 'event-screen.html' : 'event-live.html')); });

  return { forward };
};
