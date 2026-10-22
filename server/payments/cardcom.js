/**
 * Cardcom (Israeli card clearing with recurring billing) — SKELETON, NOT CONNECTED.
 *
 * TODO(owner decision): choose the provider (Cardcom / Grow (Meshulam) / Tranzila / PayPlus) and get a terminal.
 * TODO: implement with the provider's real API docs and test on its sandbox terminal before enabling.
 *
 * Env (all required to activate; otherwise paymentProvider() falls back to "manual"):
 *   PAYMENT_PROVIDER=cardcom
 *   CARDCOM_TERMINAL=…   CARDCOM_API_NAME=…   CARDCOM_API_PASSWORD=…
 *   PUBLIC_URL=https://nashi-co.com            (for return / webhook URLs)
 *
 * Intended flow (Cardcom API v11 terms):
 *   createCheckout → POST LowProfile/Create with ReturnValue=<supplierId>, Operation = charge + create token,
 *                    SuccessRedirectUrl / FailedRedirectUrl, WebHookUrl=/api/suppliers/payments/webhook/cardcom
 *                    → redirect the supplier to the returned Url.
 *   handleWebhook  → never trust the POST body alone: call LowProfile/GetLpResult with the LowProfileId,
 *                    check ResponseCode === 0 and the amount, then return { ok, supplierId: ReturnValue, event: 'paid',
 *                    customerId, subscriptionId (recurring id / token), amount }.
 *   monthly charge → Cardcom "Recurring payments" (הוראת קבע) on the token, or a daily job that charges the token;
 *                    each successful charge arrives as another webhook → subscription extended a month.
 *   cancel         → stop the recurring order (RecurringPayments update / delete) for subscriptionId.
 */
const env = (k) => process.env[k] || '';

export const cardcomProvider = {
  id: 'cardcom',
  label: 'כרטיס אשראי (Cardcom) — הוראת קבע חודשית',
  configured: () => !!(env('CARDCOM_TERMINAL') && env('CARDCOM_API_NAME') && env('CARDCOM_API_PASSWORD')),

  async createCheckout(/* { supplier, amount, currency, successUrl, cancelUrl, webhookUrl } */) {
    // TODO: POST https://secure.cardcom.solutions/api/v11/LowProfile/Create … return { kind: 'redirect', url: json.Url, reference: json.LowProfileId }
    throw new Error('Cardcom is not connected yet (TODO in server/payments/cardcom.js)');
  },

  async handleWebhook(/* req */) {
    // TODO: verify with LowProfile/GetLpResult before trusting anything.
    return { ok: false, error: 'Cardcom webhook not implemented' };
  },

  async cancel(/* supplier */) {
    // TODO: cancel the recurring order for supplier.subscription.subscriptionId
    return { ok: false, note: 'ביטול הוראת קבע ב-Cardcom עוד לא מחובר — יש לבטל ידנית במסוף.' };
  },
};
