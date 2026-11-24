// ממסר הודעות וואטסאפ קטן: מקבל בקשה מאתרים של DA פרויקטים ושולח הודעה דרך Green API
// שולח רק למספרים שמוגדרים ב-ALLOWED_TO, כדי שלא ישמש לשליחה לאנשים אחרים
const http = require('http');
const crypto = require('crypto');
const { GREEN_API_URL, GREEN_ID_INSTANCE, GREEN_API_TOKEN, RELAY_KEY, ALLOWED_TO = '', PORT = 8080 } = process.env;
const allowed = ALLOWED_TO.split(',').map(s => s.replace(/\D/g, '').replace(/^0/, '972')).filter(Boolean);
const ok = k => RELAY_KEY && k && k.length === RELAY_KEY.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(RELAY_KEY));
// בדיקת מצב החיבור של מופע הוואטסאפ
const stateUrl = () => `${String(GREEN_API_URL || 'https://api.green-api.com').replace(/\/$/, '')}/waInstance${GREEN_ID_INSTANCE}/getStateInstance/${GREEN_API_TOKEN}`;
http.createServer((req, res) => {
  const send = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true });
  if (req.method === 'POST' && req.url === '/state' && ok(String(req.headers['x-key'] || ''))) return fetch(stateUrl()).then(r => r.json().then(j => send(r.status, j))).catch(e => send(500, { error: e.message }));
  if (req.method !== 'POST' || req.url !== '/notify') return send(404, { error: 'not found' });
  if (!ok(String(req.headers['x-key'] || ''))) return send(401, { error: 'unauthorized' });
  let body = ''; req.on('data', d => { body += d; if (body.length > 20000) req.destroy(); });
  req.on('end', async () => {
    try {
      const j = JSON.parse(body || '{}');
      const to = String(j.to || allowed[0] || '').replace(/\D/g, '').replace(/^0/, '972');
      if (!allowed.includes(to)) return send(403, { error: 'recipient not allowed' });
      const text = String(j.text || '').slice(0, 4000); if (!text) return send(400, { error: 'empty' });
      const base = String(GREEN_API_URL || 'https://api.green-api.com').replace(/\/$/, '');
      const r = await fetch(`${base}/waInstance${GREEN_ID_INSTANCE}/sendMessage/${GREEN_API_TOKEN}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId: to + '@c.us', message: text }) });
      const out = await r.json().catch(() => ({}));
      if (!r.ok || !out.idMessage) { console.error('green api failed', r.status, JSON.stringify(out).slice(0, 300), 'base=', base.replace(/\/\/([^.]+)/, '//$1'), 'inst=', String(GREEN_ID_INSTANCE || '').length, 'tok=', String(GREEN_API_TOKEN || '').length); return send(502, { error: 'green api', status: r.status }); }
      send(200, { ok: true, id: out.idMessage });
    } catch (e) { send(500, { error: e.message }); }
  });
}).listen(PORT, () => console.log('wa-relay on', PORT));
