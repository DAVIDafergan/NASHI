import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, Loader2, Mail, PauseCircle, Save, Send, AlertCircle } from 'lucide-react';
import { suppliersApi, Supplier, Checkout } from '../services/suppliersApi';
import { SupplierForm, PaymentStep, fromSupplier, validateSupplier, SupplierFormValue } from '../components/suppliers/SupplierParts';
import { SUPPLIER_STATUS_LABELS } from '../shared/suppliers';
import { BRAND } from '../shared/brand';

const TOKEN_KEY = 'nashi-supplier-token';
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

/** Supplier's own page, opened from the magic link (#/suppliers/edit?t=…). */
const SupplierEditPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [token, setToken] = useState<string>(() => params.get('t') || (() => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } })());
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierFormValue | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'nolink'>(token ? 'loading' : 'nolink');
  const [msg, setMsg] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [checkout, setCheckout] = useState<{ checkout: Checkout; label: string } | null>(null);
  const [paying, setPaying] = useState(false);
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);

  useEffect(() => { suppliersApi.meta().then(m => setPrice(m.monthlyPrice)).catch(() => {}); }, []);
  useEffect(() => {
    if (!token) { setState('nolink'); return; }
    suppliersApi.me(token).then(r => {
      setSupplier(r.supplier); setForm(fromSupplier(r.supplier)); setState('ready');
      try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
      if (params.get('t')) setParams({}, { replace: true }); // don't leave the token in the address bar
    }).catch(() => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } setToken(''); setState('nolink'); });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const err = validateSupplier(form);
    if (err) { setMsg({ text: err, tone: 'bad' }); return; }
    setSaving(true); setMsg(null);
    try { const { email: _e, ...rest } = form; const r = await suppliersApi.updateMe(token, rest); setSupplier(r.supplier); setMsg({ text: 'הכרטיס עודכן ✔', tone: 'good' }); }
    catch (x: any) { setMsg({ text: x?.message || 'השמירה נכשלה', tone: 'bad' }); }
    finally { setSaving(false); }
  };
  const pay = async () => {
    setPaying(true);
    try { const r = await suppliersApi.checkout(token); setCheckout({ checkout: r.checkout, label: r.provider.label }); if (r.checkout.kind === 'redirect') window.location.href = r.checkout.url; }
    catch (x: any) { setMsg({ text: x?.message || 'לא הצלחנו לפתוח את התשלום', tone: 'bad' }); }
    finally { setPaying(false); }
  };
  const requestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    await suppliersApi.requestLink(email.trim()).catch(() => {});
    setLinkSent(true);
  };

  if (state === 'loading') return <div className="flex min-h-[50vh] items-center justify-center text-rose-500"><Loader2 className="animate-spin" size={32} /></div>;

  if (state === 'nolink' || !supplier || !form) {
    return (
      <div className="mx-auto max-w-md px-5 pb-24 pt-12 text-center" dir="rtl">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-500"><Mail size={28} /></span>
        <h1 className="mt-5 text-[2.2rem] leading-tight">עריכת הכרטיס במאגר</h1>
        <p className="mt-2 text-slate-500">נשלח אליכם קישור אישי למייל שאיתו נרשמתם.</p>
        {linkSent ? (
          <p className="mt-6 rounded-2xl bg-sage-50 p-4 text-[15px] text-sage-700">אם המייל רשום אצלנו, הקישור כבר בדרך 💌</p>
        ) : (
          <form onSubmit={requestLink} className="mt-6 space-y-3 text-right">
            <input dir="ltr" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" className="w-full rounded-2xl border border-rose-100 bg-white px-4 py-3.5 text-left text-[16px] outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-100" />
            <button type="submit" className="btn-primary w-full !py-3.5"><Send size={17} /> שליחת קישור</button>
          </form>
        )}
        <Link to="/suppliers/join" className="mt-6 inline-block text-[14px] text-rose-700 underline underline-offset-4">עוד לא רשומים? להצטרפות למאגר</Link>
      </div>
    );
  }

  const status = supplier.status || 'pending_payment';
  const end = supplier.subscription?.currentPeriodEnd;
  const banner = {
    active: { icon: <CheckCircle2 size={22} />, cls: 'border-sage-100 bg-sage-50 text-sage-700', text: supplier.listed ? `הכרטיס מופיע במאגר. המנוי בתוקף עד ${fmt(end)}.` : 'הכרטיס פעיל.' },
    pending_payment: { icon: <Clock size={22} />, cls: 'border-amber-100 bg-amber-50 text-amber-800', text: 'הכרטיס שמור וממתין לתשלום. אחרי התשלום הוא יופיע במאגר.' },
    expired: { icon: <AlertCircle size={22} />, cls: 'border-rose-100 bg-rose-50 text-rose-800', text: `המנוי הסתיים${end ? ` ב-${fmt(end)}` : ''}. לחידוש — המשיכו לתשלום.` },
    suspended: { icon: <PauseCircle size={22} />, cls: 'border-slate-200 bg-slate-50 text-slate-700', text: `הכרטיס מושהה ע״י הנהלת ${BRAND.name}${supplier.statusNote ? `: ${supplier.statusNote}` : ''}.` },
  }[status];
  const needsPayment = status === 'pending_payment' || status === 'expired';

  return (
    <div className="pb-24" dir="rtl">
      <section className="mx-auto max-w-3xl px-5 pt-8 md:pt-12">
        <p className="eyebrow">מאגר הספקים · {SUPPLIER_STATUS_LABELS[status]}</p>
        <h1 className="mt-2 text-[2.3rem] leading-[1.05] md:text-[3.2rem]">{supplier.businessName}</h1>
        <div className={`mt-5 flex items-start gap-3 rounded-[1.4rem] border p-4 ${banner.cls}`}>{banner.icon}<p className="text-[15px] leading-relaxed">{banner.text}</p></div>
        {needsPayment && (
          <div className="mt-5">
            <PaymentStep price={price} providerLabel={checkout?.label} checkout={checkout?.checkout} loading={paying} onPay={pay} businessName={supplier.businessName} />
          </div>
        )}
        <form onSubmit={save} className="mt-8 space-y-4" noValidate>
          <SupplierForm value={form} onChange={setForm} emailLocked />
          {msg && <p role="status" className={`rounded-2xl px-4 py-3 text-sm font-semibold ${msg.tone === 'good' ? 'bg-sage-50 text-sage-700' : 'bg-rose-50 text-rose-700'}`}>{msg.text}</p>}
          <div className="sticky bottom-24 z-20 md:bottom-4">
            <button type="submit" disabled={saving} className="btn-primary w-full !py-4 text-lg shadow-lift disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={18} />} שמירת השינויים</button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default SupplierEditPage;
