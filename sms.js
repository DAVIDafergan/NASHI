// שליחת SMS. הספק נקבע בפאנל הניהול (נשמר במסד), ואם לא הוגדר שם: לפי משתני הסביבה.
//   inforu : InforU (ישראלי). user, token, sender
//   019    : 019 SMS (ישראלי). user, token, sender
//   twilio : Twilio. sid, token, from
//   none   : אין ספק. האתר עובד במצב הדגמה (הקוד מוצג על המסך)

const esc = s => String(s ?? '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const toLocal = p => p.replace(/^\+?972/, '0');
const toIntl = p => '+972' + toLocal(p).replace(/^0/, '');

function envConfig() {
  const p = (process.env.SMS_PROVIDER || '').toLowerCase();
  if (p === 'inforu') return { type: 'inforu', user: process.env.INFORU_USER, token: process.env.INFORU_TOKEN, sender: process.env.SMS_SENDER };
  if (p === '019') return { type: '019', user: process.env.SMS019_USER, token: process.env.SMS019_TOKEN, sender: process.env.SMS_SENDER };
  if (p === 'twilio') return { type: 'twilio', sid: process.env.TWILIO_SID, token: process.env.TWILIO_TOKEN, from: process.env.TWILIO_FROM };
  return { type: 'none' };
}

async function sendInforu(c, phone, text) {
  const xml = `<Inforu><User><Username>${esc(c.user)}</Username><ApiToken>${esc(c.token)}</ApiToken></User>` +
    `<Content Type="sms"><Message>${esc(text)}</Message></Content>` +
    `<Recipients><PhoneNumber>${toLocal(phone)}</PhoneNumber></Recipients>` +
    `<Settings><Sender>${esc(c.sender || 'KanitZachit')}</Sender></Settings></Inforu>`;
  const r = await fetch('https://api.inforu.co.il/SendMessageXml.ashx', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' }, body: 'InforuXML=' + encodeURIComponent(xml),
  });
  const body = await r.text();
  if (!/<Status>1<\/Status>/.test(body)) throw new Error('InforU: ' + body.slice(0, 300));
}

async function send019(c, phone, text) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><sms><user><username>${esc(c.user)}</username></user>` +
    `<source>${esc(c.sender || 'KanitZachit')}</source><destinations><phone>${toLocal(phone)}</phone></destinations>` +
    `<message>${esc(text)}</message></sms>`;
  const r = await fetch('https://019sms.co.il/api', {
    method: 'POST', headers: { 'Content-Type': 'application/xml; charset=utf-8', Authorization: 'Bearer ' + c.token }, body: xml,
  });
  const body = await r.text();
  if (!/<status>0<\/status>/.test(body)) throw new Error('019: ' + body.slice(0, 300));
}

async function sendTwilio(c, phone, text) {
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${c.sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(c.sid + ':' + c.token).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: toIntl(phone), From: c.from, Body: text }),
  });
  if (!r.ok) throw new Error('Twilio: ' + (await r.text()).slice(0, 300));
}

// getStored: פונקציה שמחזירה את ההגדרה מהמסד (או null)
function createSms(getStored) {
  const config = () => { const s = getStored(); return s && s.type && s.type !== 'none' ? s : envConfig(); };
  const ready = () => config().type !== 'none';
  async function sendSms(phone, text) {
    const c = config();
    if (c.type === 'inforu') return sendInforu(c, phone, text);
    if (c.type === '019') return send019(c, phone, text);
    if (c.type === 'twilio') return sendTwilio(c, phone, text);
    console.log(`[SMS הדגמה] אל ${phone}: ${text}`);
  }
  return { sendSms, ready, config };
}

module.exports = { createSms };
