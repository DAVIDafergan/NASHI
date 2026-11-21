// SUMIT (app.sumit.co.il) API client – hosted payment page, payment lookup, standing orders.
// Docs: https://app.sumit.co.il/swagger/v1/swagger.json  (POST JSON, Credentials: {CompanyID, APIKey})
const https = require('https');

const DOC = { invoiceReceipt: 1, receipt: 2, donationReceipt: 4 };

function call(path, body, timeout = 20000) {
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const T = process.env.SUMIT_API_TEST ? new URL(process.env.SUMIT_API_TEST) : null; // local mock for tests only
    const q = (T ? require('http') : https).request({ hostname: T ? T.hostname : 'api.sumit.co.il', port: T ? T.port : 443, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Language': 'he', 'Content-Length': Buffer.byteLength(data) } }, r => {
      let s = ''; r.on('data', c => s += c); r.on('end', () => {
        let j; try { j = JSON.parse(s); } catch { return reject(new Error('SUMIT: תשובה לא תקינה (' + r.statusCode + ')')); }
        if (j.Status !== 0 && j.Status !== 'Success') return reject(new Error('SUMIT: ' + (j.UserErrorMessage || j.TechnicalErrorDetails || 'שגיאה')));
        resolve(j.Data || {});
      });
    });
    q.on('error', reject); q.setTimeout(timeout, () => q.destroy(new Error('SUMIT לא ענה בזמן'))); q.write(data); q.end();
  });
}
const creds = cfg => ({ CompanyID: +String(cfg.companyId || '').replace(/\D/g, ''), APIKey: String(cfg.apiKey || '').trim() });
const cur = c => (c === 'USD' ? 1 : 0);

// hosted payment page → {url}
async function beginRedirect(cfg, o) {
  const d = await call('/billing/payments/beginredirect/', {
    Credentials: creds(cfg),
    Customer: { Name: o.name || 'לקוח', Phone: o.phone || null, EmailAddress: o.email || null, CompanyNumber: o.companyNumber || null, ExternalIdentifier: o.customerRef || null, SearchMode: o.customerRef ? 2 : 0 },
    Items: [{ Item: { Name: o.itemName }, Quantity: 1, UnitPrice: o.amount, Currency: cur(o.currency), Description: o.description || null }],
    VATIncluded: true, DocumentType: o.docType ?? DOC.invoiceReceipt,
    RedirectURL: o.returnUrl, CancelRedirectURL: o.cancelUrl || null, ExternalIdentifier: o.ref,
    MaximumPayments: o.maxPayments || 1, Language: o.lang === 'en' ? 1 : 0,
    SendUpdateByEmailAddress: o.notifyEmail || null, ExpirationHours: 24,
    PreventSavingPaymentMethod: !o.saveCard, DocumentDescription: o.docDescription || null
  });
  if (!d.RedirectURL) throw new Error('SUMIT לא החזיר קישור לתשלום');
  return { url: d.RedirectURL };
}
// the redirect back carries OG-PaymentID; we always re-read it from SUMIT before trusting it
async function getPayment(cfg, id) { const d = await call('/billing/payments/get/', { Credentials: creds(cfg), PaymentID: +id }); return d.Payment || null; }
const isPaid = p => !!p && p.ValidPayment === true;
async function listPayments(cfg, from, to) { const d = await call('/billing/payments/list/', { Credentials: creds(cfg), Date_From: from, Date_To: to, Valid: true }); return d.Payments || []; }
// standing order on the card saved during the first (redirect) payment
async function startRecurring(cfg, o) {
  const d = await call('/billing/recurring/charge/', {
    Credentials: creds(cfg), Customer: { ID: +o.customerId },
    Items: [{ Item: { Name: o.itemName }, Quantity: 1, UnitPrice: o.amount, Currency: cur(o.currency), Date_Start: o.start, Duration_Months: 1, Duration_Days: 0, Recurrence: o.count || null, Description: o.description || null }],
    VATIncluded: true, DocumentType: o.docType ?? DOC.invoiceReceipt, UpdateCustomerByEmail: true, UpdateCustomerByEmail_AttachDocument: true
  });
  return { itemId: (d.RecurringCustomerItemIDs || [])[0] || null, payment: d.Payment || null };
}
async function cancelRecurring(cfg, customerId, itemId) { return call('/billing/recurring/cancel/', { Credentials: creds(cfg), Customer: { ID: +customerId }, RecurringCustomerItemID: +itemId }); }
// cheap authenticated call – proves CompanyID + APIKey are right
async function ping(cfg) { const t = new Date().toISOString().slice(0, 10); await call('/billing/payments/list/', { Credentials: creds(cfg), Date_From: t + 'T00:00:00', Date_To: t + 'T23:59:59', Valid: true }, 12000); return true; }
const nextMonth = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10) + 'T00:00:00'; };

module.exports = { call, beginRedirect, getPayment, isPaid, listPayments, startRecurring, cancelRecurring, ping, nextMonth, DOC };
