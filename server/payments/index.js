import { manualProvider } from './manual.js';
import { cardcomProvider } from './cardcom.js';

/**
 * Payment provider interface for the supplier MONTHLY subscription.
 *
 *   id, label
 *   configured(): boolean
 *   createCheckout({ supplier, amount, currency, successUrl, cancelUrl, webhookUrl })
 *       → { kind: 'manual', instructions }            (admin marks the payment in the panel)
 *       | { kind: 'redirect', url, reference }        (hosted payment page of the provider)
 *   handleWebhook(req) → { ok, supplierId, event: 'paid'|'failed'|'cancelled', amount?, periodEnd?, customerId?, subscriptionId?, reference? }
 *       Must VERIFY the notification with the provider (signature / server-to-server lookup) before returning ok.
 *   cancel(supplier) → { ok, note? }
 *
 * PAYMENT_PROVIDER=manual (default) | cardcom
 * SUPPLIER_MONTHLY_PRICE=149        shown on the site, charged monthly (ILS)
 */
const PROVIDERS = { manual: manualProvider, cardcom: cardcomProvider };

export function paymentProvider(id = process.env.PAYMENT_PROVIDER || 'manual') {
  const p = PROVIDERS[id];
  if (!p) return manualProvider;
  if (!p.configured()) return manualProvider; // a half-configured provider never blocks signups
  return p;
}
export const getProvider = (id) => PROVIDERS[id] || null;

export const monthlyPrice = () => {
  const n = Number(process.env.SUPPLIER_MONTHLY_PRICE);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** End of the paid period after a payment: one month from the later of now / current end. */
export function extendPeriod(currentEnd, now = new Date(), months = 1) {
  const base = currentEnd && new Date(currentEnd) > now ? new Date(currentEnd) : new Date(now);
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Visible in the directory? */
export const isListed = (s, now = new Date()) => s?.status === 'active' && !!s?.subscription?.currentPeriodEnd && new Date(s.subscription.currentPeriodEnd) > now;
