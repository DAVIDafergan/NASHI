import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users, MapPin, Loader2, Send, PenLine, CreditCard, Sparkles, ShieldCheck } from 'lucide-react';
import ScrollReveal from '../components/ScrollReveal';
import { SUPPLIER_CATEGORIES } from '../shared/suppliers';
import { suppliersApi, Checkout } from '../services/suppliersApi';
import { SupplierForm, PaymentStep, blankSupplier, validateSupplier, categoryIcon, SupplierFormValue } from '../components/suppliers/SupplierParts';
import { BRAND } from '../shared/brand';

const WHY = [
  { icon: <Users size={22} />, title: `מנהלי התרבות של ${BRAND.name}`, text: 'בכל אזור יש מנהל/ת תרבות שמפיקים כנסים, מופעים, סדנאות ואירועים לגברים, לנשים ולמשפחות — ומחפשים ספקים.' },
  { icon: <Search size={22} />, title: 'מוצאים בדיוק אתכם', text: 'חיפוש לפי קטגוריה, סגנון ואזור. אתם מופיעים כשמחפשים את מה שאתם עושים.' },
  { icon: <MapPin size={22} />, title: 'רק איפה שאתם עובדים', text: 'בוחרים אזורים או יישובים — או כל הארץ.' },
];
const STEPS = [
  { icon: <PenLine size={20} />, title: 'ממלאים כרטיס', text: 'פרטי העסק, קטגוריות, אזורים ותמונות.' },
  { icon: <CreditCard size={20} />, title: 'מנוי חודשי', text: 'משלמים ומתחילים. אפשר להפסיק בכל חודש.' },
  { icon: <Sparkles size={20} />, title: 'מופיעים במאגר', text: 'מנהלי התרבות פונים אליכם ישירות.' },
];

const SupplierSignupPage: React.FC = () => {
  const [price, setPrice] = useState<number | null>(null);
  const [form, setForm] = useState<SupplierFormValue>(blankSupplier());
  const [terms, setTerms] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ token: string; name: string } | null>(null);
  const [checkout, setCheckout] = useState<{ checkout: Checkout; label: string } | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => { suppliersApi.meta().then(m => setPrice(m.monthlyPrice)).catch(() => {}); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = validateSupplier(form) || (!terms ? 'יש לאשר את תנאי ההצטרפות' : '');
    setError(msg);
    if (msg) return;
    setSending(true);
    try {
      const r = await suppliersApi.signup({ ...form, terms });
      setDone({ token: r.token, name: r.supplier.businessName });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) { setError(err?.message || 'השליחה נכשלה'); }
    finally { setSending(false); }
  };
  const pay = async () => {
    if (!done) return;
    setPaying(true);
    try { const r = await suppliersApi.checkout(done.token); setCheckout({ checkout: r.checkout, label: r.provider.label }); if (r.checkout.kind === 'redirect') window.location.href = r.checkout.url; }
    catch (err: any) { setError(err?.message || 'לא הצלחנו לפתוח את התשלום'); }
    finally { setPaying(false); }
  };
  const editLink = done ? `${window.location.origin}${window.location.pathname}#/suppliers/edit?t=${done.token}` : '';

  if (done) {
    return (
      <div className="pb-24" dir="rtl">
        <section className="mx-auto max-w-2xl px-5 pt-8 md:pt-14">
          <p className="eyebrow animate-fade-in-up">שלב 2 מתוך 3 · תשלום</p>
          <h1 className="mt-3 text-[2.4rem] leading-[1.05] md:text-[3.4rem] animate-fade-in-up">כמעט שם, <span className="font-accent text-[1.2em] text-rose-600">{done.name}</span></h1>
          <p className="mt-3 text-[16px] leading-relaxed text-slate-600">הכרטיס נשמר. אחרי התשלום הוא יופיע במאגר הספקים של מנהלי התרבות.</p>
          <div className="mt-7">
            <PaymentStep price={price} providerLabel={checkout?.label} checkout={checkout?.checkout} loading={paying} onPay={pay} editLink={editLink} businessName={done.name} />
          </div>
          {error && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
        </section>
      </div>
    );
  }

  return (
    <div className="pb-24" dir="rtl">
      {/* hero */}
      <section className="mx-auto max-w-5xl px-5 pt-8 text-center md:pt-16">
        <p className="eyebrow animate-fade-in-up">מאגר הספקים של {BRAND.name}</p>
        <h1 className="mt-4 text-[2.6rem] leading-[1.02] md:text-[4.4rem] animate-fade-in-up">
          ספקים לאירועים חרדיים?<br /><span className="font-accent text-[1.3em] text-rose-600">הצטרפו למאגר</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-slate-600 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          מרצים ומרצות, מופעים, הצגות, סדנאות, קייטרינג, הגברה, צילום ועוד. מנהלי התרבות של {BRAND.name} מחפשים כאן ספקים לאירועים שלהם — בכל הסגנונות ובכל הארץ.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          {/* HashRouter: an "#join" href would change the route, so scroll instead */}
          <button type="button" onClick={() => document.getElementById('join')?.scrollIntoView({ behavior: 'smooth' })} className="btn-primary !px-7 !py-3.5">להצטרפות{price ? ` · ₪${price} לחודש` : ''}</button>
          <Link to="/suppliers/edit" className="btn-ghost">כבר רשומים? לעריכת הכרטיס</Link>
        </div>
      </section>

      {/* categories marquee-ish */}
      <section className="mx-auto mt-10 max-w-5xl px-5">
        <div className="flex flex-wrap justify-center gap-2">
          {SUPPLIER_CATEGORIES.filter(c => c.id !== 'other').map(c => (
            <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-rose-100 bg-white/80 px-3.5 py-1.5 text-[13px] text-slate-600"><span className="text-rose-400 [&>svg]:h-4 [&>svg]:w-4">{categoryIcon(c.id)}</span>{c.name}</span>
          ))}
        </div>
      </section>

      {/* why */}
      <section className="mx-auto mt-14 max-w-5xl px-5">
        <p className="eyebrow">למה להצטרף</p>
        <h2 className="mt-2 text-[2rem] md:text-[2.6rem]">הלקוחות הכי מדויקות שיש</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {WHY.map((w, i) => (
            <ScrollReveal key={w.title} animation="scale-in" delay={i * 70}>
              <div className="h-full rounded-[1.6rem] border border-rose-100 bg-white p-5 shadow-soft">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">{w.icon}</span>
                <h3 className="mt-3 text-lg">{w.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{w.text}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
        <ol className="mt-8 grid gap-3 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-[1.6rem] bg-white/80 p-5 shadow-soft">
              <span className="font-accent text-5xl leading-none text-rose-200">0{i + 1}</span>
              <span className="absolute left-5 top-5 text-rose-500">{s.icon}</span>
              <h3 className="mt-2 text-lg">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* form */}
      <section id="join" className="mx-auto mt-14 max-w-3xl scroll-mt-28 px-5">
        <div className="card-soft !bg-[#FBF7F4] p-4 md:p-8">
          <p className="eyebrow flex items-center gap-1.5"><Sparkles size={14} /> שלב 1 מתוך 3</p>
          <h2 className="mt-2 text-[2rem]">הכרטיס שלכם במאגר</h2>
          <p className="mt-1 text-sm text-slate-500">רק מנהלי התרבות של {BRAND.name} רואים את המאגר. הפרטים לא מתפרסמים לציבור.</p>
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <SupplierForm value={form} onChange={setForm} />
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-rose-100 bg-white p-4 text-[14px] leading-relaxed text-slate-600">
              <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-rose-700" />
              <span>אני מאשר/ת שהפרטים נכונים, שהשירות מתאים לאירועים בציבור הדתי והחרדי, ושהמנוי מתחדש מדי חודש{price ? ` (₪${price})` : ''} עד לביטול. הנהלת {BRAND.name} רשאית להסיר כרטיס שאינו מתאים.</span>
            </label>
            {error && <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
            <button type="submit" disabled={sending} className="btn-primary w-full !py-4 text-lg disabled:opacity-60">
              {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={18} />} שמירה והמשך לתשלום
            </button>
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400"><ShieldCheck size={13} /> הקישור לעריכת הכרטיס יישלח למייל שלכם</p>
          </form>
        </div>
      </section>
    </div>
  );
};

export default SupplierSignupPage;
