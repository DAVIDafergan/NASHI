/**
 * Manual provider (default): the supplier pays by bank transfer / Bit / phone, and the admin clicks
 * "סימון תשלום" in the admin panel, which extends the subscription by a month.
 */
export const manualProvider = {
  id: 'manual',
  label: 'תשלום ידני (העברה / ביט / טלפון)',
  configured: () => true,
  async createCheckout({ supplier, amount }) {
    const phone = process.env.SUPPLIER_PAYMENT_PHONE || '';
    const bit = process.env.SUPPLIER_PAYMENT_BIT || phone;
    const lines = [
      amount ? `דמי המנוי: ₪${amount} לחודש.` : 'דמי המנוי יימסרו בשיחה.',
      bit ? `אפשר לשלם בביט / פייבוקס למספר ${bit}, עם שם העסק "${supplier.businessName}".` : 'צוות נשי יחזור אלייך לתיאום התשלום.',
      'אחרי אישור התשלום הכרטיס שלך יופיע במאגר למנהלות התרבות.',
    ];
    return { kind: 'manual', instructions: lines, contactPhone: phone || null };
  },
  async handleWebhook() { return { ok: false, error: 'manual provider has no webhooks' }; },
  async cancel() { return { ok: true, note: 'המנוי לא יחודש. אפשר לבקש חידוש מהנהלת נשי.' }; },
};
