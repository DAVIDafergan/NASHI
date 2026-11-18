// Platform email. Uses Resend (RESEND_API_KEY) – set once in Railway; MAIL_FROM e.g. "GiveIL <no-reply@giveil.com>".
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
  const r = await post('api.resend.com', '/emails', { Authorization: 'Bearer ' + process.env.RESEND_API_KEY }, { from: process.env.MAIL_FROM || 'GiveIL <onboarding@resend.dev>', to: [to], subject, html, text, reply_to: replyTo });
  return { ok: r.status < 300, status: r.status, body: r.body.slice(0, 300) };
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function layout(title, body, footer = '') {
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#f5f4f1;font-family:Rubik,Arial,sans-serif;color:#1c1917"><div style="max-width:560px;margin:0 auto;padding:28px 16px"><div style="background:#fff;border:1px solid #e9e6e2;border-radius:16px;padding:28px"><h1 style="font-size:22px;margin:0 0 12px">${esc(title)}</h1>${body}</div><p style="text-align:center;color:#6b6762;font-size:12px;margin-top:16px">${footer || 'נשלח דרך GiveIL · צדקה תציל ממוות'}</p></div></body></html>`;
}
// Designed campaign email: hero image, headline, body, button – colours from the campaign
function template({ title, body, image, btnText, btnUrl, color = '#7c5cff', logo = '', org = '', footer = '' }) {
  const paras = String(body || '').split(/\n{2,}/).map(x => `<p style="margin:0 0 14px;font-size:16px;line-height:1.7">${esc(x).replace(/\n/g, '<br>')}</p>`).join('');
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#f5f4f1;font-family:Rubik,Arial,sans-serif;color:#1c1917"><div style="max-width:600px;margin:0 auto;padding:24px 12px">
  <div style="background:#fff;border:1px solid #e9e6e2;border-radius:18px;overflow:hidden">
  ${image ? `<img src="${esc(image)}" alt="" style="display:block;width:100%;max-height:320px;object-fit:cover">` : `<div style="height:8px;background:${esc(color)}"></div>`}
  <div style="padding:28px 26px">
  ${logo ? `<img src="${esc(logo)}" alt="" style="height:44px;margin-bottom:14px">` : ''}
  ${title ? `<h1 style="font-size:24px;margin:0 0 14px;line-height:1.3">${esc(title)}</h1>` : ''}
  ${paras}
  ${btnText && btnUrl ? `<p style="margin:22px 0 4px;text-align:center"><a href="${esc(btnUrl)}" style="background:${esc(color)};color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;display:inline-block;font-weight:700;font-size:16px">${esc(btnText)}</a></p>` : ''}
  </div></div>
  <p style="text-align:center;color:#6b6762;font-size:12px;margin-top:14px">${esc(org ? org + ' · ' : '')}${footer || 'נשלח דרך GiveIL · צדקה תציל ממוות'}</p></div></body></html>`;
}
module.exports = { send, enabled, layout, esc, template };
