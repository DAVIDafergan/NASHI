// Platform email. Uses Resend (RESEND_API_KEY) – set once in Railway; MAIL_FROM e.g. "TTM <no-reply@ttm.co.il>".
const https = require('https');
function post(host, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({ hostname: host, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
    req.on('error', reject); req.setTimeout(10000, () => req.destroy(new Error('timeout'))); req.write(data); req.end();
  });
}
const enabled = () => !!process.env.RESEND_API_KEY;
async function send({ to, subject, html, text, replyTo }) {
  if (!enabled()) return { ok: false, skipped: true };
  const r = await post('api.resend.com', '/emails', { Authorization: 'Bearer ' + process.env.RESEND_API_KEY }, { from: process.env.MAIL_FROM || 'TTM <onboarding@resend.dev>', to: [to], subject, html, text, reply_to: replyTo });
  return { ok: r.status < 300, status: r.status, body: r.body.slice(0, 300) };
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function layout(title, body, footer = '') {
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#f5f4f1;font-family:Rubik,Arial,sans-serif;color:#1c1917"><div style="max-width:560px;margin:0 auto;padding:28px 16px"><div style="background:#fff;border:1px solid #e9e6e2;border-radius:16px;padding:28px"><h1 style="font-size:22px;margin:0 0 12px">${esc(title)}</h1>${body}</div><p style="text-align:center;color:#6b6762;font-size:12px;margin-top:16px">${footer || 'נשלח דרך TTM · Tzedaka Tatzil Mimavet'}</p></div></body></html>`;
}
module.exports = { send, enabled, layout, esc };
