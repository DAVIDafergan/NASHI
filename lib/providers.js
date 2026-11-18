// Payment provider adapters. Each `start(ctx)` returns an instruction for the browser:
//   {mode:'redirect', url}            -> go to a hosted payment page
//   {mode:'iframe', url, post}        -> embed hosted page (Nedarim Plus)
//   {mode:'paypal', clientId, ...}    -> PayPal JS SDK
//   {mode:'test', url}                -> built-in sandbox checkout
// Callbacks/webhooks call `markPaid(donationId, ref, meta)` through the server.

const https = require('https');
const { URL } = require('url');

function request(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers }, res => {
      let data = ''; res.on('data', c => data += c); res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject); if (body) req.write(body); req.end();
  });
}
const form = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');

const providers = {
  // ---- built-in sandbox ----
  test: {
    label: 'מצב בדיקה (ללא סליקה)',
    fields: [],
    start: async ({ base, donation }) => ({ mode: 'test', url: `${base}/pay/test/${donation.token}` })
  },

  // ---- Nedarim Plus (matara.pro) iframe ----
  nedarim: {
    label: 'נדרים פלוס',
    fields: [{ k: 'mosadId', l: 'מספר מוסד (מופיע בפינה העליונה של נדרים פלוס ליד שם המוסד, למשל 7011515)' }, { k: 'apiValid', l: 'ApiValid – "סיסמת אימות לדף התשלום" (הגדרות → מפתחות API → העתקה)' }, { k: 'group', l: 'שם קבוצה/קמפיין בנדרים (לא חובה, לדוחות)' }],
    start: async ({ base, donation, campaign, cfg }) => {
      const [first, ...rest] = (donation.name || '').split(' ');
      return {
        mode: 'iframe',
        url: 'https://matara.pro/nedarimplus/iframe?language=he',
        post: {
          Mosad: cfg.mosadId, ApiValid: cfg.apiValid,
          PaymentType: donation.monthly ? 'HK' : 'Ragil',
          Currency: donation.currency === 'USD' ? '2' : '1',
          Amount: String(donation.amount), Tashlumim: String(donation.installments || 1),
          FirstName: first || '', LastName: rest.join(' '), Phone: donation.phone || '', Mail: donation.email || '',
          Groupe: cfg.group || campaign.title, Comment: donation.dedication || '',
          Param1: String(donation.id), Param2: donation.token,
          CallBack: `${base}/pay/nedarim/callback`, CallBackMailError: ''
        }
      };
    },
    // Nedarim Plus posts form fields to CallBack after a transaction
    callback: (body) => {
      const ok = String(body.Status || body.status || '').toLowerCase().includes('ok') || body.Status === 'OK' || body.Status === 'Success';
      return { donationId: +(body.Param1 || 0), token: body.Param2, paid: ok, ref: body.TransactionId || body.KevaId || '', meta: body };
    }
  },

  // ---- Meshulam / Grow ----
  meshulam: {
    label: 'משולם / Grow',
    fields: [{ k: 'pageCode', l: 'Page code' }, { k: 'userId', l: 'User ID (apiKey)' }, { k: 'sandbox', l: 'Sandbox? (true/false)' }],
    start: async ({ base, donation, campaign, cfg }) => {
      const host = String(cfg.sandbox) === 'true' ? 'sandbox.meshulam.co.il' : 'secure.meshulam.co.il';
      const body = form({
        pageCode: cfg.pageCode, userId: cfg.userId, sum: donation.amount, description: campaign.title.slice(0, 60),
        'pageField[fullName]': donation.name, 'pageField[phone]': donation.phone, 'pageField[email]': donation.email,
        successUrl: `${base}/pay/return/${donation.token}`, cancelUrl: `${base}/c/${campaign.slug}?cancel=1`, notifyUrl: `${base}/pay/meshulam/webhook`,
        cField1: donation.id, cField2: donation.token, maxPaymentNum: donation.installments || 1, paymentNum: donation.installments || 1,
        chargeType: donation.monthly ? 2 : 1
      });
      const r = await request(`https://${host}/api/light/server/1.0/createPaymentProcess`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }, body });
      let j; try { j = JSON.parse(r.body); } catch { throw new Error('Meshulam: bad response'); }
      if (j.status !== 1 || !j.data?.url) throw new Error('Meshulam: ' + (j.err?.message || 'createPaymentProcess failed'));
      return { mode: 'redirect', url: j.data.url, ref: j.data.processId };
    },
    callback: (body) => ({ donationId: +(body.cField1 || body.data?.cField1 || 0), token: body.cField2 || body.data?.cField2, paid: String(body.status ?? body.data?.status ?? '1') === '1' && !body.err, ref: body.transactionId || body.data?.transactionId || body.asmachta || '', meta: body })
  },

  // ---- PayPal (Orders API v2) ----
  paypal: {
    label: 'PayPal',
    fields: [{ k: 'clientId', l: 'Client ID' }, { k: 'secret', l: 'Secret' }, { k: 'sandbox', l: 'Sandbox? (true/false)' }],
    start: async ({ donation, cfg }) => ({ mode: 'paypal', clientId: cfg.clientId, currency: donation.currency, amount: donation.amount, sandbox: String(cfg.sandbox) === 'true' }),
    capture: async ({ cfg, orderId }) => {
      const host = String(cfg.sandbox) === 'true' ? 'api-m.sandbox.paypal.com' : 'api-m.paypal.com';
      const auth = Buffer.from(cfg.clientId + ':' + cfg.secret).toString('base64');
      const t = await request(`https://${host}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': 29 }, body: 'grant_type=client_credentials' });
      const token = JSON.parse(t.body).access_token; if (!token) throw new Error('PayPal auth failed');
      const c = await request(`https://${host}/v2/checkout/orders/${orderId}/capture`, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': 0 } });
      const j = JSON.parse(c.body);
      const cap = j.purchase_units?.[0]?.payments?.captures?.[0];
      return { paid: j.status === 'COMPLETED', amount: +(cap?.amount?.value || 0), currency: cap?.amount?.currency_code, ref: cap?.id || orderId, meta: j };
    }
  },

  // ---- Generic hosted page (Cardcom / Tranzila / any link) ----
  link: {
    label: 'דף תשלום חיצוני (קארדקום, טרנזילה, כל קישור)',
    fields: [{ k: 'url', l: 'כתובת דף התשלום. אפשר להשתמש ב-{amount} {name} {phone} {email} {id}' }],
    start: async ({ donation, cfg }) => {
      const url = String(cfg.url || '').replace(/\{(amount|name|phone|email|id)\}/g, (_, k) => encodeURIComponent(k === 'id' ? donation.id : donation[k] || ''));
      return { mode: 'redirect', url, manual: true };
    }
  }
};
module.exports = providers;
