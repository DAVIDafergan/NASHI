// Israeli card processors that work with a hosted payment page.
// Every adapter has:
//   start({base, donation, campaign, cfg})  -> {mode:'redirect', url, ref}   (ref = the processor's session id, stored on the donation)
//   verify({cfg, donation, input})          -> {state:'paid'|'failed'|'pending', amount, ref, verified, note, meta}
//                                              input = query/body we received on the return/notify call ({} when polling)
//   ping(cfg)                                -> {ok, msg}   (credentials check from the "בדיקה עכשיו" button)
// Rule: a donation is counted only when the processor's own server confirms it (verified:true),
// or – for processors without a lookup API – it is counted as "לא אומת" and flagged for the owner.
const https = require('https');
const { URL } = require('url');

function req(url, { method = 'POST', headers = {}, body, form, timeout = 20000 } = {}) {
  if (process.env.GW_TEST) { const o = new URL(url); url = process.env.GW_TEST + '/' + o.hostname + o.pathname + o.search; } // local mock, tests only
  const u = new URL(url); let data = null;
  if (form) { data = new URLSearchParams(form).toString(); headers['Content-Type'] = 'application/x-www-form-urlencoded'; }
  else if (body !== undefined) { data = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
  if (data) headers['Content-Length'] = Buffer.byteLength(data);
  return new Promise((resolve, reject) => {
    const q = (u.protocol === 'http:' ? require('http') : https).request({ hostname: u.hostname, port: u.port || (u.protocol === 'http:' ? 80 : 443), path: u.pathname + u.search, method, headers }, r => {
      let s = ''; r.on('data', c => s += c); r.on('end', () => { let j = null; try { j = JSON.parse(s); } catch { } resolve({ status: r.statusCode, text: s, json: j }); });
    });
    q.on('error', reject); q.setTimeout(timeout, () => q.destroy(new Error('הספק לא ענה בזמן'))); if (data) q.write(data); q.end();
  });
}
const perCharge = d => (d.monthly && d.installments > 1 ? Math.round(d.amount / d.installments * 100) / 100 : d.amount);
const near = (a, b) => Math.abs((+a || 0) - (+b || 0)) <= 1;
const S = v => String(v ?? '').trim();
const desc = (c) => `תרומה – ${c.title}`.slice(0, 100);

const G = {};

// ---------------- Cardcom (API v11, LowProfile) ----------------
G.cardcom = {
  label: 'קארדקום (Cardcom)',
  fields: [{ k: 'terminal', l: 'מספר מסוף (TerminalNumber)', required: true }, { k: 'apiName', l: 'שם משתמש API (ApiName)', required: true }],
  async start({ base, donation: d, campaign: c, cfg, urls }) {
    const r = await req('https://secure.cardcom.solutions/api/v11/LowProfile/Create', { body: {
      TerminalNumber: +S(cfg.terminal), ApiName: S(cfg.apiName), Operation: 'ChargeOnly', ReturnValue: 'gx-d-' + d.id, Amount: perCharge(d),
      SuccessRedirectUrl: urls.ret, FailedRedirectUrl: urls.cancel, WebHookUrl: urls.notify, ISOCoinId: d.currency === 'USD' ? 2 : 1, Language: c.lang === 'en' ? 'en' : 'he', ProductName: desc(c),
      UIDefinition: { CardOwnerNameValue: d.name || '', CardOwnerEmailValue: d.email || '', CardOwnerPhoneValue: d.phone || '', MinNumOfPayments: 1, MaxNumOfPayments: d.monthly ? 1 : (d.installments || 1) }
    } });
    const j = r.json || {}; if (j.ResponseCode !== 0 || !j.Url) throw new Error('Cardcom: ' + (j.Description || 'יצירת דף תשלום נכשלה'));
    return { mode: 'redirect', url: j.Url, ref: j.LowProfileId };
  },
  async verify({ cfg, donation: d, input }) {
    const lp = S(input.lowprofilecode || input.LowProfileId || input.LowProfileCode || d.ref); if (!lp) return { state: 'pending' };
    const r = await req('https://secure.cardcom.solutions/api/v11/LowProfile/GetLpResult', { body: { TerminalNumber: +S(cfg.terminal), ApiName: S(cfg.apiName), LowProfileId: lp } });
    const j = r.json || {}; const t = j.TranzactionInfo || {};
    if (j.ReturnValue && j.ReturnValue !== 'gx-d-' + d.id) return { state: 'pending', note: 'Cardcom: מזהה לא תואם' };
    if (j.ResponseCode !== 0 || !j.TranzactionInfo) return { state: j.ResponseCode === 0 ? 'pending' : 'failed', note: 'Cardcom: ' + (j.Description || 'לא שולם') };
    if (t.ResponseCode !== undefined && +t.ResponseCode !== 0) return { state: 'failed', note: 'Cardcom: העסקה נדחתה' };
    return { state: 'paid', amount: t.Amount, ref: S(t.TranzactionId || lp), verified: true, meta: { lp, approval: t.ApprovalNumber } };
  },
  async ping(cfg) { const r = await req('https://secure.cardcom.solutions/api/v11/LowProfile/Create', { body: { TerminalNumber: +S(cfg.terminal), ApiName: S(cfg.apiName), Operation: 'ChargeOnly', Amount: 1, ReturnValue: 'gx-test', SuccessRedirectUrl: 'https://giveil.com/', FailedRedirectUrl: 'https://giveil.com/', ProductName: 'בדיקת חיבור' } }); const j = r.json || {}; return j.ResponseCode === 0 ? { ok: true, msg: 'Cardcom יצר דף תשלום לבדיקה – המסוף ושם המשתמש נכונים.' } : { ok: false, msg: 'Cardcom: ' + (j.Description || 'הפרטים לא אושרו') }; }
};

// ---------------- PayPlus ----------------
const ppBase = cfg => (String(cfg.sandbox) === 'true' ? 'https://restapidev.payplus.co.il/api/v1.0' : 'https://restapi.payplus.co.il/api/v1.0');
const ppHead = cfg => ({ 'api-key': S(cfg.apiKey), 'secret-key': S(cfg.secretKey), Authorization: JSON.stringify({ api_key: S(cfg.apiKey), secret_key: S(cfg.secretKey) }) });
G.payplus = {
  label: 'PayPlus (פיי פלוס)',
  fields: [{ k: 'apiKey', l: 'API Key', required: true }, { k: 'secretKey', l: 'Secret Key', secret: true, required: true }, { k: 'pageUid', l: 'Payment Page UID (מזהה דף תשלום)', required: true }, { k: 'sandbox', l: 'סביבת בדיקות? (true/false)' }],
  async start({ donation: d, campaign: c, cfg, urls }) {
    const r = await req(ppBase(cfg) + '/PaymentPages/generateLink', { headers: ppHead(cfg), body: {
      payment_page_uid: S(cfg.pageUid), charge_method: 1, amount: perCharge(d), currency_code: d.currency === 'USD' ? 'USD' : 'ILS', language_code: c.lang === 'en' ? 'en' : 'he',
      refURL_success: urls.ret, refURL_failure: urls.cancel, refURL_callback: urls.notify, send_failure_callback: false, more_info: 'gx-d-' + d.id,
      payments: d.monthly ? 1 : (d.installments || 1), max_payments: d.monthly ? 1 : (d.installments || 1),
      customer: { customer_name: d.name || 'תורם', email: d.email || undefined, phone: d.phone || undefined }, items: [{ name: desc(c), quantity: 1, price: perCharge(d) }]
    } });
    const j = r.json || {}; const link = j.data?.payment_page_link; if (!link) throw new Error('PayPlus: ' + (j.results?.description || j.message || 'יצירת דף תשלום נכשלה'));
    return { mode: 'redirect', url: link, ref: j.data.page_request_uid };
  },
  async verify({ cfg, donation: d, input }) {
    const uid = S(input.page_request_uid || d.ref); if (!uid) return { state: 'pending' };
    const r = await req(ppBase(cfg) + '/PaymentPages/ipn', { headers: ppHead(cfg), body: { payment_request_uid: uid, related_transaction: true } });
    const x = r.json?.data || {}; const st = S(x.status_code || x.status);
    if (x.more_info && x.more_info !== 'gx-d-' + d.id) return { state: 'pending', note: 'PayPlus: מזהה לא תואם' };
    if (st === '000') return { state: 'paid', amount: x.amount, ref: S(x.transaction_uid || x.number || uid), verified: true, meta: { uid, approval: x.approval_num } };
    return { state: st && st !== '000' && r.json?.results?.status === 'success' ? 'failed' : 'pending', note: st ? 'PayPlus: סטטוס ' + st : '' };
  },
  async ping(cfg) { const r = await req(ppBase(cfg) + '/PaymentPages/generateLink', { headers: ppHead(cfg), body: { payment_page_uid: S(cfg.pageUid), charge_method: 1, amount: 1, currency_code: 'ILS', more_info: 'gx-test', customer: { customer_name: 'בדיקה' } } }); return r.json?.data?.payment_page_link ? { ok: true, msg: 'PayPlus יצר דף תשלום לבדיקה – המפתחות ודף התשלום נכונים.' } : { ok: false, msg: 'PayPlus: ' + (r.json?.results?.description || 'הפרטים לא אושרו') }; }
};

// ---------------- Hyp (יעד שריג) ----------------
G.hyp = {
  label: 'Hyp – יעד שריג',
  fields: [{ k: 'masof', l: 'מספר מסוף (Masof)', required: true }, { k: 'key', l: 'מפתח API (KEY)', secret: true, required: true }, { k: 'passp', l: 'סיסמת API (PassP)', secret: true, required: true }],
  async start({ donation: d, campaign: c, cfg, urls }) {
    const p = new URLSearchParams({ action: 'APISign', What: 'SIGN', Sign: 'True', Masof: S(cfg.masof), KEY: S(cfg.key), PassP: S(cfg.passp), UTF8: 'True', UTF8out: 'True',
      Amount: String(perCharge(d)), Order: 'gx-d-' + d.id, Info: desc(c), Coin: d.currency === 'USD' ? '2' : '1', Tash: String(d.monthly ? 1 : (d.installments || 1)), PageLang: c.lang === 'en' ? 'ENG' : 'HEB',
      ClientName: d.name || '', email: d.email || '', cell: d.phone || '', Fild1: String(d.id), tmp: '1' });
    const r = await req('https://pay.hyp.co.il/p/?' + p.toString(), { method: 'GET' });
    const t = S(r.text); if (!/signature=/.test(t)) throw new Error('Hyp: ' + (t.slice(0, 120) || 'החתימה נכשלה'));
    return { mode: 'redirect', url: 'https://pay.hyp.co.il/p/?' + t };
  },
  async verify({ cfg, donation: d, input, rawQuery }) {
    if (!input.Id || input.CCode === undefined) return { state: 'pending' };
    if (S(input.CCode) !== '0') return { state: 'failed', note: 'Hyp: קוד ' + input.CCode };
    if (input.Order && input.Order !== 'gx-d-' + d.id) return { state: 'pending', note: 'Hyp: מזהה לא תואם' };
    const q = 'action=APISign&What=VERIFY&Masof=' + encodeURIComponent(S(cfg.masof)) + '&KEY=' + encodeURIComponent(S(cfg.key)) + '&PassP=' + encodeURIComponent(S(cfg.passp)) + '&' + rawQuery; // same params, same order
    const r = await req('https://pay.hyp.co.il/p/?' + q, { method: 'GET' });
    const ok = /(^|&)CCode=0(&|$)/.test(S(r.text));
    return ok ? { state: 'paid', amount: input.Amount, ref: S(input.Id), verified: true, meta: { acode: input.ACode } } : { state: 'pending', note: 'Hyp: האימות נכשל (' + S(r.text).slice(0, 40) + ')' };
  },
  async ping(cfg) { const p = new URLSearchParams({ action: 'APISign', What: 'SIGN', Sign: 'True', Masof: S(cfg.masof), KEY: S(cfg.key), PassP: S(cfg.passp), Amount: '1', Order: 'gx-test', Info: 'בדיקה', UTF8: 'True', UTF8out: 'True' }); const r = await req('https://pay.hyp.co.il/p/?' + p, { method: 'GET' }); return /signature=/.test(r.text) ? { ok: true, msg: 'Hyp חתם על בקשת בדיקה – הפרטים נכונים.' } : { ok: false, msg: 'Hyp: ' + S(r.text).slice(0, 120) }; }
};

// ---------------- Pelecard ----------------
const pcBase = 'https://gateway21.pelecard.biz/PaymentGW';
G.pelecard = {
  label: 'פלאקארד (Pelecard)',
  fields: [{ k: 'terminal', l: 'מספר מסוף', required: true }, { k: 'user', l: 'שם משתמש', required: true }, { k: 'password', l: 'סיסמה', secret: true, required: true }],
  async start({ donation: d, campaign: c, cfg, urls }) {
    const n = d.monthly ? 1 : (d.installments || 1);
    const r = await req(pcBase + '/init', { body: { terminal: S(cfg.terminal), user: S(cfg.user), password: S(cfg.password), GoodURL: urls.ret, ErrorURL: urls.cancel, CancelURL: urls.cancel, ServerSideGoodFeedbackURL: urls.notify,
      ActionType: 'J4', Currency: d.currency === 'USD' ? '2' : '1', Total: Math.round(perCharge(d) * 100), MaxPayments: String(n), MinPayments: '1', ParamX: 'gx-d-' + d.id, Language: c.lang === 'en' ? 'EN' : 'HE',
      FeedbackDataTransferMethod: 'GET', CustomerIdField: 'optional', EmailField: d.email || 'optional', TelField: d.phone || 'optional', FreeTotal: false } });
    const j = r.json || {}; if (!j.URL || (j.Error && +j.Error.ErrCode !== 0)) throw new Error('Pelecard: ' + (j.Error?.ErrMsg || 'יצירת דף תשלום נכשלה'));
    return { mode: 'redirect', url: j.URL, ref: j.ConfirmationKey || '' };
  },
  async verify({ cfg, donation: d, input }) {
    const tid = S(input.PelecardTransactionId); if (!tid) return { state: 'pending' };
    if (input.PelecardStatusCode && S(input.PelecardStatusCode) !== '000') return { state: 'failed', note: 'Pelecard: קוד ' + input.PelecardStatusCode };
    const r = await req(pcBase + '/GetTransaction', { body: { terminal: S(cfg.terminal), user: S(cfg.user), password: S(cfg.password), TransactionId: tid } });
    const j = r.json || {}; const x = j.ResultData || {};
    if (S(j.StatusCode) !== '000') return { state: 'pending', note: 'Pelecard: ' + S(j.ErrorMessage || j.StatusCode) };
    if (x.ParamX && x.ParamX !== 'gx-d-' + d.id) return { state: 'pending', note: 'Pelecard: מזהה לא תואם' };
    return { state: 'paid', amount: x.DebitTotal ? +x.DebitTotal / 100 : undefined, ref: tid, verified: true, meta: { approval: x.DebitApproveNumber } };
  },
  async ping(cfg) { const r = await req(pcBase + '/init', { body: { terminal: S(cfg.terminal), user: S(cfg.user), password: S(cfg.password), GoodURL: 'https://giveil.com/', ErrorURL: 'https://giveil.com/', ActionType: 'J4', Currency: '1', Total: 100 } }); return r.json?.URL ? { ok: true, msg: 'Pelecard יצר דף תשלום לבדיקה – הפרטים נכונים.' } : { ok: false, msg: 'Pelecard: ' + (r.json?.Error?.ErrMsg || 'הפרטים לא אושרו') }; }
};

// ---------------- iCredit (ריווחית) ----------------
const icBase = cfg => (String(cfg.sandbox) === 'true' ? 'https://testicredit.rivhit.co.il' : 'https://icredit.rivhit.co.il') + '/API/PaymentPageRequest.svc';
G.icredit = {
  label: 'iCredit (ריווחית)',
  fields: [{ k: 'token', l: 'GroupPrivateToken (טוקן דף התשלום)', secret: true, required: true }, { k: 'sandbox', l: 'סביבת בדיקות? (true/false)' }],
  async start({ donation: d, campaign: c, cfg, urls }) {
    const r = await req(icBase(cfg) + '/GetUrl', { body: { GroupPrivateToken: S(cfg.token), Items: [{ UnitPrice: perCharge(d), Quantity: 1, Description: desc(c) }], RedirectURL: urls.ret, FailRedirectURL: urls.cancel, IPNURL: urls.notify, IPNMethod: 1,
      Custom1: 'gx-d-' + d.id, EmailAddress: d.email || undefined, CustomerFirstName: d.name || undefined, PhoneNumber: d.phone || undefined, MaxPayments: d.monthly ? 1 : (d.installments || 1), Currency: d.currency === 'USD' ? 2 : 1, HideItemList: true } });
    const j = r.json || {}; if (!j.URL || +j.Status !== 0) throw new Error('iCredit: ' + (j.DebugMessage || 'יצירת דף תשלום נכשלה'));
    return { mode: 'redirect', url: j.URL, ref: j.PrivateSaleToken || '' };
  },
  async verify({ cfg, donation: d, input }) {
    const sale = S(input.SaleId); if (!sale) return { state: 'pending' };
    if (input.Custom1 && input.Custom1 !== 'gx-d-' + d.id) return { state: 'pending', note: 'iCredit: מזהה לא תואם' };
    const r = await req(icBase(cfg) + '/Verify', { body: { GroupPrivateToken: S(cfg.token), SaleId: sale, TotalAmount: perCharge(d) } });
    return S(r.json?.Status).toUpperCase() === 'VERIFIED' ? { state: 'paid', amount: perCharge(d), ref: sale, verified: true } : { state: 'pending', note: 'iCredit: ' + S(r.json?.Status || 'לא אומת') };
  },
  async ping(cfg) { const r = await req(icBase(cfg) + '/GetUrl', { body: { GroupPrivateToken: S(cfg.token), Items: [{ UnitPrice: 1, Quantity: 1, Description: 'בדיקה' }], RedirectURL: 'https://giveil.com/' } }); return r.json?.URL ? { ok: true, msg: 'iCredit יצר דף תשלום לבדיקה – הטוקן נכון.' } : { ok: false, msg: 'iCredit: ' + (r.json?.DebugMessage || 'הטוקן לא אושר') }; }
};

// ---------------- PayMe ----------------
const pmBase = cfg => (String(cfg.sandbox) === 'true' ? 'https://sandbox.payme.io/api' : 'https://live.payme.io/api');
G.payme = {
  label: 'PayMe',
  fields: [{ k: 'sellerId', l: 'Seller PayMe ID (MPL…)', secret: true, required: true }, { k: 'sandbox', l: 'סביבת בדיקות? (true/false)' }],
  async start({ donation: d, campaign: c, cfg, urls }) {
    const r = await req(pmBase(cfg) + '/generate-sale', { body: { seller_payme_id: S(cfg.sellerId), sale_price: Math.round(perCharge(d) * 100), currency: d.currency === 'USD' ? 'USD' : 'ILS', product_name: desc(c), transaction_id: 'gx-d-' + d.id,
      installments: String(d.monthly ? 1 : (d.installments || 1)), sale_callback_url: urls.notify, sale_return_url: urls.ret, sale_email: d.email || undefined, sale_name: d.name || undefined, sale_mobile: d.phone || undefined, language: c.lang === 'en' ? 'en' : 'he' } });
    const j = r.json || {}; if (+j.status_code !== 0 || !j.sale_url) throw new Error('PayMe: ' + (j.status_error_details || 'יצירת דף תשלום נכשלה'));
    return { mode: 'redirect', url: j.sale_url, ref: j.payme_sale_id };
  },
  async verify({ cfg, donation: d, input }) {
    const id = S(input.payme_sale_id || d.ref); if (!id) return { state: 'pending' };
    const r = await req(pmBase(cfg) + '/get-sales', { body: { seller_payme_id: S(cfg.sellerId), sale_payme_id: id } });
    const x = (r.json?.items || [])[0]; if (!x) return { state: 'pending' };
    if (x.transaction_id && x.transaction_id !== 'gx-d-' + d.id) return { state: 'pending', note: 'PayMe: מזהה לא תואם' };
    if (['completed', 'captured'].includes(S(x.sale_status))) return { state: 'paid', amount: +x.sale_price / 100, ref: id, verified: true };
    return { state: ['failed', 'declined', 'cancelled'].includes(S(x.sale_status)) ? 'failed' : 'pending', note: 'PayMe: ' + S(x.sale_status) };
  },
  async ping(cfg) { const r = await req(pmBase(cfg) + '/get-sales', { body: { seller_payme_id: S(cfg.sellerId), page_size: 1 } }); return r.json && +r.json.status_code === 0 ? { ok: true, msg: 'PayMe זיהה את המוכר – הפרטים נכונים.' } : { ok: false, msg: 'PayMe: ' + (r.json?.status_error_details || 'המזהה לא אושר') }; }
};

// ---------------- Z-Credit (WebCheckout) ----------------
const zcBase = 'https://pci.zcredit.co.il/webcheckout/api/WebCheckout';
G.zcredit = {
  label: 'Z-Credit',
  fields: [{ k: 'key', l: 'מפתח WebCheckout (Key)', secret: true, required: true }],
  async start({ donation: d, campaign: c, cfg, urls }) {
    const r = await req(zcBase + '/CreateSession', { body: { Key: S(cfg.key), Local: c.lang === 'en' ? 'En' : 'He', UniqueId: 'gx-d-' + d.id, SuccessUrl: urls.ret, CancelUrl: urls.cancel, CallbackUrl: urls.notify, PaymentType: 'regular', CreateInvoice: 'false', ShowCart: 'false',
      Installments: { Type: 'regular', MinQuantity: '1', MaxQuantity: String(d.monthly ? 1 : (d.installments || 1)) }, Customer: { Email: d.email || '', Name: d.name || '', PhoneNumber: d.phone || '' },
      CartItems: [{ Amount: String(perCharge(d)), Currency: d.currency === 'USD' ? 'USD' : 'ILS', Name: desc(c), Quantity: 1, IsTaxFree: 'true' }] } });
    const j = r.json || {}; if (j.HasError || !j.Data?.SessionUrl) throw new Error('Z-Credit: ' + (j.ReturnMessage || 'יצירת דף תשלום נכשלה'));
    return { mode: 'redirect', url: j.Data.SessionUrl, ref: j.Data.SessionId };
  },
  async verify({ cfg, donation: d, input }) {
    const sid = S(input.SessionId || d.ref); if (!sid) return { state: 'pending' };
    const r = await req(zcBase + '/GetSessionStatus', { body: { Key: S(cfg.key), SessionId: sid } });
    const j = r.json || {}; const x = j.Data || {}; const det = (() => { try { return typeof x.TransactionsDetails === 'string' ? JSON.parse(x.TransactionsDetails) : x.TransactionsDetails; } catch { return null; } })();
    const t = Array.isArray(det) ? det[0] : det;
    if (x.UniqueID && x.UniqueID !== 'gx-d-' + d.id) return { state: 'pending', note: 'Z-Credit: מזהה לא תואם' };
    const ok = !j.HasError && (/success|approved|completed/i.test(S(x.Status || x.SessionStatus)) || (t && !t.HasError && t.ReferenceNumber));
    return ok ? { state: 'paid', amount: t?.Total ?? t?.Amount, ref: S(t?.ReferenceNumber || sid), verified: true } : { state: 'pending', note: 'Z-Credit: ' + S(x.Status || j.ReturnMessage || 'ממתין') };
  },
  async ping(cfg) { const r = await req(zcBase + '/CreateSession', { body: { Key: S(cfg.key), Local: 'He', UniqueId: 'gx-test', SuccessUrl: 'https://giveil.com/', CancelUrl: 'https://giveil.com/', PaymentType: 'regular', CartItems: [{ Amount: '1', Currency: 'ILS', Name: 'בדיקה', Quantity: 1 }] } }); return r.json?.Data?.SessionUrl ? { ok: true, msg: 'Z-Credit יצר דף תשלום לבדיקה – המפתח נכון.' } : { ok: false, msg: 'Z-Credit: ' + (r.json?.ReturnMessage || 'המפתח לא אושר') }; }
};

// ---------------- Morning / חשבונית ירוקה ----------------
const mrBase = cfg => (String(cfg.sandbox) === 'true' ? 'https://sandbox.d.greeninvoice.co.il/api/v1' : 'https://api.greeninvoice.co.il/api/v1');
async function mrToken(cfg) { const r = await req(mrBase(cfg) + '/account/token', { body: { id: S(cfg.apiId), secret: S(cfg.apiSecret) } }); if (!r.json?.token) throw new Error('Morning: ' + (r.json?.errorMessage || 'המפתחות לא אושרו')); return r.json.token; }
G.morning = {
  label: 'Morning (חשבונית ירוקה)',
  fields: [{ k: 'apiId', l: 'מזהה מפתח API (ID)', required: true }, { k: 'apiSecret', l: 'סוד מפתח API (Secret)', secret: true, required: true }, { k: 'pluginId', l: 'מזהה פלאגין סליקה (pluginId)', required: true }, { k: 'sandbox', l: 'סביבת בדיקות? (true/false)' }],
  async start({ donation: d, campaign: c, cfg, urls }) {
    const tok = await mrToken(cfg);
    const r = await req(mrBase(cfg) + '/payments/form', { headers: { Authorization: 'Bearer ' + tok }, body: {
      description: desc(c), type: 400, lang: c.lang === 'en' ? 'en' : 'he', currency: d.currency === 'USD' ? 'USD' : 'ILS', vatType: 1, amount: perCharge(d), maxPayments: d.monthly ? 1 : (d.installments || 1), pluginId: S(cfg.pluginId), group: 100,
      client: { name: d.name || 'תורם', emails: d.email ? [d.email] : [], phone: d.phone || undefined, add: false }, successUrl: urls.ret, failureUrl: urls.cancel, notifyUrl: urls.notify, custom: 'gx-d-' + d.id } });
    if (!r.json?.url) throw new Error('Morning: ' + (r.json?.errorMessage || 'יצירת דף תשלום נכשלה'));
    return { mode: 'redirect', url: r.json.url };
  },
  // Morning has no simple lookup by our id: the notify call is accepted only with our id + matching amount, and counted as "לא אומת" for the owner to confirm
  async verify({ donation: d, input }) {
    if (!input.custom && !input.payment) return { state: 'pending' };
    if (S(input.custom) && S(input.custom) !== 'gx-d-' + d.id) return { state: 'pending', note: 'Morning: מזהה לא תואם' };
    const amt = +(input.amount || input.payment?.[0]?.price || 0);
    return amt ? { state: 'paid', amount: amt, ref: S(input.id || input.transactionId || ''), verified: false, note: 'Morning: התקבל אישור – לא אומת מול השרת' } : { state: 'pending' };
  },
  async ping(cfg) { await mrToken(cfg); return { ok: true, msg: 'Morning אישרה את מפתחות ה-API.' }; }
};

// ---------------- Tranzila ----------------
G.tranzila = {
  label: 'טרנזילה (Tranzila)',
  fields: [{ k: 'terminal', l: 'שם מסוף (supplier)', required: true }, { k: 'pw', l: 'סיסמת TranzilaPW (לאימות סכום – מומלץ)', secret: true }],
  async start({ donation: d, campaign: c, cfg, urls }) {
    const term = S(cfg.terminal).replace(/[^\w-]/g, ''); const sum = perCharge(d);
    const p = new URLSearchParams({ sum: String(sum), currency: d.currency === 'USD' ? '2' : '1', cred_type: (d.installments > 1 && !d.monthly) ? '8' : '1', maxpay: String(d.monthly ? 1 : (d.installments || 1)), tranmode: 'A',
      lang: c.lang === 'en' ? 'us' : 'il', contact: d.name || '', email: d.email || '', phone: d.phone || '', pdesc: desc(c), gxid: 'gx-d-' + d.id,
      success_url_address: urls.ret, fail_url_address: urls.cancel, notify_url_address: urls.notify, nologo: '1' });
    if (cfg.pw) { // handshake: Tranzila will refuse a payment page whose sum was changed in the browser
      const h = await req(`https://secure5.tranzila.com/cgi-bin/tranzila71dt.cgi`, { form: { supplier: term, sum: String(sum), TranzilaPW: S(cfg.pw), op: '1' } });
      const m = /thtk=([^&\s]+)/.exec(h.text || ''); if (m) p.set('thtk', m[1]);
    }
    return { mode: 'redirect', url: `https://direct.tranzila.com/${term}/iframenew.php?` + p.toString() };
  },
  async verify({ donation: d, input }) {
    if (!input.Response) return { state: 'pending' };
    if (S(input.Response) !== '000') return { state: 'failed', note: 'טרנזילה: קוד ' + input.Response };
    if (input.gxid && input.gxid !== 'gx-d-' + d.id) return { state: 'pending', note: 'טרנזילה: מזהה לא תואם' };
    return { state: 'paid', amount: input.sum, ref: S(input.index || input.ConfirmationCode), verified: false, note: 'טרנזילה: התקבל אישור – לא אומת מול השרת', meta: { confirmation: input.ConfirmationCode } };
  },
  async ping(cfg) { if (!cfg.pw) return { ok: true, msg: 'שם המסוף נשמר. בלי TranzilaPW אי אפשר לבדוק מראש – בצעו תרומת בדיקה.' }; const h = await req('https://secure5.tranzila.com/cgi-bin/tranzila71dt.cgi', { form: { supplier: S(cfg.terminal), sum: '1', TranzilaPW: S(cfg.pw), op: '1' } }); return /thtk=/.test(h.text || '') ? { ok: true, msg: 'טרנזילה אישרה את המסוף והסיסמה.' } : { ok: false, msg: 'טרנזילה: ' + S(h.text).slice(0, 100) }; }
};

for (const k of Object.keys(G)) { G[k].gateway = true; G[k].noMonthly = true; }
G.cardcom.wallets = ['bit', 'applepay', 'googlepay']; G.payplus.wallets = ['bit', 'applepay', 'googlepay']; G.hyp.wallets = ['bit', 'applepay', 'googlepay'];
G.pelecard.wallets = ['bit', 'applepay', 'googlepay']; G.icredit.wallets = ['bit']; G.payme.wallets = ['bit', 'applepay', 'googlepay']; G.zcredit.wallets = ['bit', 'applepay', 'googlepay']; G.morning.wallets = ['bit', 'applepay', 'googlepay']; G.tranzila.wallets = ['bit', 'applepay', 'googlepay'];
module.exports = { G, perCharge, near };
