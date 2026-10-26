import React, { useState } from 'react';
import {
  Mic, Sparkles, Drama, Palette, Footprints, Music, Utensils, Speaker, Camera, PartyPopper, Presentation, Building2, Flower2, Bus, Gift,
  MoreHorizontal, Phone, MessageCircle, Mail, Globe, Instagram, Facebook, MapPin, Check, X, ImagePlus, Loader2, Copy, CreditCard, Wallet, CheckCircle2,
} from 'lucide-react';
import CityPicker from '../CityPicker';
import { REGIONS, regionName } from '../../shared/regions';
import { SUPPLIER_CATEGORIES, SUPPLIER_PRICE_RANGES, supplierCategoryName } from '../../shared/suppliers';
import { compressImageFile } from '../../utils/image';
import type { Checkout, Supplier } from '../../services/suppliersApi';
import { BRAND } from '../../shared/brand';

/* ---------------- shared bits ---------------- */

const ICONS: Record<string, React.ReactNode> = {
  mic: <Mic size={18} />, sparkles: <Sparkles size={18} />, drama: <Drama size={18} />, palette: <Palette size={18} />, footprints: <Footprints size={18} />,
  music: <Music size={18} />, utensils: <Utensils size={18} />, speaker: <Speaker size={18} />, camera: <Camera size={18} />, party: <PartyPopper size={18} />,
  presentation: <Presentation size={18} />, building: <Building2 size={18} />, flower: <Flower2 size={18} />, bus: <Bus size={18} />, gift: <Gift size={18} />, more: <MoreHorizontal size={18} />,
};
export const categoryIcon = (id: string) => ICONS[SUPPLIER_CATEGORIES.find(c => c.id === id)?.icon || 'more'];
export const priceRangeName = (id?: string) => SUPPLIER_PRICE_RANGES.find(p => p.id === id)?.name || '';

export const areaLabel = (s: Pick<Supplier, 'nationwide' | 'regions' | 'cities'>) => {
  if (s.nationwide) return 'כל הארץ';
  const parts = [...(s.regions || []).map(r => regionName(r)), ...(s.cities || [])];
  if (parts.length <= 3) return parts.join(' · ');
  return `${parts.slice(0, 3).join(' · ')} ועוד ${parts.length - 3}`;
};

export const waLink = (phone?: string) => phone ? `https://wa.me/972${String(phone).replace(/\D/g, '').replace(/^972/, '').replace(/^0/, '')}` : '';

export const inputCls = 'w-full rounded-2xl border border-rose-100 bg-white px-4 py-3.5 text-[16px] text-ink outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100';

const Label: React.FC<{ children: React.ReactNode; hint?: string; required?: boolean }> = ({ children, hint, required }) => (
  <span className="mb-1.5 block">
    <span className="text-sm font-semibold text-slate-700">{children}{required && <span className="text-rose-500"> *</span>}</span>
    {hint && <span className="mr-1.5 text-[12px] text-slate-400">{hint}</span>}
  </span>
);

const Pill: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode; icon?: React.ReactNode }> = ({ on, onClick, children, icon }) => (
  <button type="button" onClick={onClick} aria-pressed={on}
    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13.5px] transition active:scale-95 ${on ? 'border-plum-300 bg-plum-300 text-ink shadow-soft' : 'border-rose-100 bg-white text-slate-600 hover:border-rose-300 hover:text-rose-700'}`}>
    {on ? <Check size={14} /> : icon}{children}
  </button>
);

/* ---------------- the listing form (signup + edit) ---------------- */

export type SupplierFormValue = {
  businessName: string; contactName: string; phone: string; whatsapp: string; email: string;
  website: string; instagram: string; facebook: string;
  nationwide: boolean; regions: string[]; cities: string[];
  categories: string[]; styles: string[]; description: string; priceRange: string; priceNote: string;
  logo: string; gallery: string[];
};
export const blankSupplier = (): SupplierFormValue => ({
  businessName: '', contactName: '', phone: '', whatsapp: '', email: '', website: '', instagram: '', facebook: '',
  nationwide: false, regions: [], cities: [], categories: [], styles: [], description: '', priceRange: '', priceNote: '', logo: '', gallery: [],
});
export const fromSupplier = (s: Supplier): SupplierFormValue => ({ ...blankSupplier(), ...Object.fromEntries(Object.entries(s).filter(([k]) => k in blankSupplier())) } as SupplierFormValue);

export function validateSupplier(v: SupplierFormValue): string {
  if (v.businessName.trim().length < 2) return 'מה שם העסק?';
  if (v.contactName.trim().length < 2) return 'חסר שם איש/אשת קשר';
  if (v.phone.replace(/\D/g, '').length < 9) return 'חסר מספר טלפון תקין';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) return 'חסר מייל תקין';
  if (!v.categories.length) return 'בחרו לפחות קטגוריה אחת';
  if (!v.nationwide && !v.regions.length && !v.cities.length) return 'באילו אזורים אתם נותנים שירות?';
  if (v.description.trim().length < 20) return 'כתבו כמה מילים על השירות (לפחות 20 תווים)';
  return '';
}

const Section: React.FC<{ n: number; title: string; sub?: string; children: React.ReactNode }> = ({ n, title, sub, children }) => (
  <section className="rounded-[1.6rem] border border-rose-100/80 bg-white p-5 md:p-6">
    <div className="mb-4 flex items-start gap-3">
      <span className="font-accent text-[2.4rem] leading-[0.8] text-rose-200">0{n}</span>
      <div>
        <h3 className="text-[1.25rem] leading-tight text-ink">{title}</h3>
        {sub && <p className="mt-0.5 text-[13px] text-slate-500">{sub}</p>}
      </div>
    </div>
    <div className="space-y-4">{children}</div>
  </section>
);

export const SupplierForm: React.FC<{ value: SupplierFormValue; onChange: (v: SupplierFormValue) => void; emailLocked?: boolean }> = ({ value: v, onChange, emailLocked }) => {
  const set = (patch: Partial<SupplierFormValue>) => onChange({ ...v, ...patch });
  const toggle = (k: 'regions' | 'categories' | 'styles', id: string, max = 99) => {
    const has = v[k].includes(id);
    if (!has && v[k].length >= max) return;
    const next = has ? v[k].filter(x => x !== id) : [...v[k], id];
    if (k === 'categories' && has) {
      // drop styles that belonged only to the removed category
      const keep = new Set(SUPPLIER_CATEGORIES.filter(c => next.includes(c.id)).flatMap(c => c.styles));
      set({ categories: next, styles: v.styles.filter(s => keep.has(s)) });
      return;
    }
    set({ [k]: next } as any);
  };
  const styles = SUPPLIER_CATEGORIES.filter(c => v.categories.includes(c.id) && c.styles.length);
  const [busy, setBusy] = useState('');
  const addImage = async (e: React.ChangeEvent<HTMLInputElement>, kind: 'logo' | 'gallery') => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setBusy(kind);
    try {
      if (kind === 'logo') set({ logo: await compressImageFile(files[0], 600, 0.86, true) });
      else {
        const room = 6 - v.gallery.length;
        const imgs = await Promise.all(files.slice(0, room).map(f => compressImageFile(f, 1400, 0.82)));
        set({ gallery: [...v.gallery, ...imgs] });
      }
    } catch { alert('לא הצלחנו לקרוא את התמונה'); }
    finally { setBusy(''); }
  };

  return (
    <div className="space-y-4">
      <Section n={1} title="פרטי העסק" sub="כך יופיע הכרטיס שלכם למנהלי התרבות">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block"><Label required>שם העסק</Label><input className={inputCls} value={v.businessName} onChange={e => set({ businessName: e.target.value })} placeholder="למשל: הפקות שירה" maxLength={80} /></label>
          <label className="block"><Label required>איש / אשת קשר</Label><input className={inputCls} value={v.contactName} onChange={e => set({ contactName: e.target.value })} placeholder="שם מלא" maxLength={60} /></label>
          <label className="block"><Label required>טלפון</Label><input dir="ltr" type="tel" className={`${inputCls} text-left`} value={v.phone} onChange={e => set({ phone: e.target.value })} placeholder="05X-XXXXXXX" /></label>
          <label className="block"><Label hint="אם שונה מהטלפון">וואטסאפ</Label><input dir="ltr" type="tel" className={`${inputCls} text-left`} value={v.whatsapp} onChange={e => set({ whatsapp: e.target.value })} placeholder="05X-XXXXXXX" /></label>
          <label className="block md:col-span-2"><Label required hint={emailLocked ? `לשינוי המייל פנו להנהלת ${BRAND.name}` : 'לשם נשלח הקישור לעריכת הכרטיס'}>מייל</Label>
            <input dir="ltr" type="email" disabled={emailLocked} className={`${inputCls} text-left disabled:bg-slate-50 disabled:text-slate-500`} value={v.email} onChange={e => set({ email: e.target.value })} placeholder="name@example.com" /></label>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block"><Label>אתר</Label><input dir="ltr" className={`${inputCls} text-left`} value={v.website} onChange={e => set({ website: e.target.value })} placeholder="www…" /></label>
          <label className="block"><Label>אינסטגרם</Label><input dir="ltr" className={`${inputCls} text-left`} value={v.instagram} onChange={e => set({ instagram: e.target.value })} placeholder="instagram.com/…" /></label>
          <label className="block"><Label>פייסבוק</Label><input dir="ltr" className={`${inputCls} text-left`} value={v.facebook} onChange={e => set({ facebook: e.target.value })} placeholder="facebook.com/…" /></label>
        </div>
      </Section>

      <Section n={2} title="מה אתם מציעים" sub="עד 5 קטגוריות. הסגנונות עוזרים למנהלי התרבות למצוא בדיוק אתכם">
        <div className="flex flex-wrap gap-2">
          {SUPPLIER_CATEGORIES.map(c => <Pill key={c.id} on={v.categories.includes(c.id)} onClick={() => toggle('categories', c.id, 5)} icon={<span className="text-rose-400">{categoryIcon(c.id)}</span>}>{c.name}</Pill>)}
        </div>
        {styles.map(c => (
          <div key={c.id} className="rounded-2xl bg-rose-50/50 p-3">
            <p className="mb-2 text-[12.5px] font-semibold text-rose-700">סגנונות · {c.name}</p>
            <div className="flex flex-wrap gap-1.5">
              {c.styles.map(s => <Pill key={s} on={v.styles.includes(s)} onClick={() => toggle('styles', s, 20)}>{s}</Pill>)}
            </div>
          </div>
        ))}
        <label className="block"><Label required hint={`${v.description.length}/1500`}>ספרו על השירות</Label>
          <textarea rows={5} maxLength={1500} className={`${inputCls} resize-y`} value={v.description} onChange={e => set({ description: e.target.value })} placeholder="מה מיוחד אצלכם, למי זה מתאים, ניסיון, המלצות…" /></label>
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label>טווח מחירים לאירוע</Label>
            <div className="flex flex-wrap gap-1.5">{SUPPLIER_PRICE_RANGES.map(p => <Pill key={p.id} on={v.priceRange === p.id} onClick={() => set({ priceRange: v.priceRange === p.id ? '' : p.id })}>{p.name}</Pill>)}</div>
          </div>
          <label className="block"><Label hint="לא חובה">הערה על המחיר</Label><input className={inputCls} value={v.priceNote} onChange={e => set({ priceNote: e.target.value })} maxLength={120} placeholder="למשל: הנחה למוסדות ולקהילות" /></label>
        </div>
      </Section>

      <Section n={3} title="איפה אתם עובדים" sub="אזורים שלמים, יישובים מסוימים, או כל הארץ">
        <button type="button" onClick={() => set({ nationwide: !v.nationwide })}
          className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-right transition ${v.nationwide ? 'border-rose-300 bg-rose-50' : 'border-rose-100 bg-white hover:border-rose-200'}`}>
          <span><span className="block text-[15px] font-semibold text-ink">שירות בכל הארץ</span><span className="block text-[12px] text-slate-500">תופיעו לכל מנהלי התרבות בכל האזורים</span></span>
          <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${v.nationwide ? 'bg-rose-600' : 'bg-slate-200'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${v.nationwide ? 'left-1' : 'left-6'}`} /></span>
        </button>
        {!v.nationwide && (
          <>
            <div><Label>אזורים</Label>
              <div className="flex flex-wrap gap-1.5">{REGIONS.map(r => <Pill key={r.id} on={v.regions.includes(r.id)} onClick={() => toggle('regions', r.id)}>{r.name}</Pill>)}</div>
            </div>
            <div><Label hint="אפשר להוסיף כמה">ערים ויישובים</Label>
              <CityPicker value="" placeholder="הוספת עיר או יישוב…" locate={false} onChange={c => { if (!v.cities.includes(c)) set({ cities: [...v.cities, c].slice(0, 60) }); }} />
              {v.cities.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {v.cities.map(c => (
                    <span key={c} className="inline-flex items-center gap-1 rounded-full bg-rose-50 py-1.5 pl-1.5 pr-3 text-[13px] text-rose-800">
                      {c}<button type="button" aria-label={`הסרת ${c}`} onClick={() => set({ cities: v.cities.filter(x => x !== c) })} className="rounded-full p-0.5 text-rose-400 hover:bg-white hover:text-rose-700"><X size={13} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Section>

      <Section n={4} title="תמונות" sub="לוגו ועד 6 תמונות מאירועים (לא חובה, אבל מאוד עוזר)">
        <div className="grid grid-cols-[96px_1fr] items-start gap-4">
          <label className="group relative flex aspect-square w-24 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/40 hover:border-rose-400">
            {v.logo ? <img src={v.logo} alt="" className="h-full w-full object-contain p-1.5" /> : busy === 'logo' ? <Loader2 className="animate-spin text-rose-400" /> : <span className="flex flex-col items-center gap-1 text-[11px] font-semibold text-rose-500"><ImagePlus size={20} /> לוגו</span>}
            <input type="file" accept="image/*" className="sr-only" onChange={e => addImage(e, 'logo')} />
          </label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {v.gallery.map((g, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-2xl bg-rose-50">
                <img src={g} alt="" className="h-full w-full object-cover" />
                <button type="button" aria-label="הסרת תמונה" onClick={() => set({ gallery: v.gallery.filter((_, j) => j !== i) })} className="absolute left-1.5 top-1.5 rounded-full bg-white/90 p-1 text-slate-500 shadow-soft hover:text-rose-700"><X size={13} /></button>
              </div>
            ))}
            {v.gallery.length < 6 && (
              <label className="flex aspect-square cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/40 text-rose-500 hover:border-rose-400">
                {busy === 'gallery' ? <Loader2 className="animate-spin" /> : <ImagePlus size={20} />}
                <input type="file" accept="image/*" multiple className="sr-only" onChange={e => addImage(e, 'gallery')} />
              </label>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
};

/* ---------------- payment step ---------------- */

export const PaymentStep: React.FC<{ price: number | null; providerLabel?: string; checkout?: Checkout | null; loading?: boolean; onPay?: () => void; editLink?: string; businessName?: string }> = ({ price, providerLabel, checkout, loading, onPay, editLink, businessName }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => { if (!editLink) return; try { await navigator.clipboard.writeText(editLink); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt('העתיקו את הקישור:', editLink); } };
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-ink p-6 text-white md:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -left-10 -top-16 h-56 w-56 rounded-full bg-rose-500/30 blur-3xl" />
        <p className="font-accent text-[21px] leading-none text-rose-200">מנוי חודשי למאגר</p>
        <div className="mt-3 flex items-baseline gap-2">
          {price ? <><span className="font-display text-[3.4rem] leading-none tabular-nums !text-white">₪{price}</span><span className="text-white/70">לחודש</span></> : <span className="text-2xl">המחיר יימסר בשיחה</span>}
        </div>
        <ul className="mt-5 space-y-2 text-[14.5px] text-white/85">
          {[`הכרטיס שלכם מוצג לכל מנהלי התרבות של ${BRAND.name}`, 'חיפוש לפי קטגוריה, סגנון ואזור — מגיעים בדיוק אליכם', 'עריכת הכרטיס בכל זמן בקישור אישי', 'בלי התחייבות: אפשר להפסיק בכל חודש'].map(t => (
            <li key={t} className="flex items-start gap-2"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-rose-300" />{t}</li>
          ))}
        </ul>
      </div>

      {checkout?.kind === 'manual' ? (
        <div className="rounded-[1.6rem] border border-champagne-100 bg-champagne-50/70 p-5">
          <p className="flex items-center gap-2 font-strong text-[16px] text-ink"><Wallet size={18} className="text-champagne-700" /> {providerLabel || 'תשלום'}</p>
          <ul className="mt-3 space-y-1.5 text-[14.5px] leading-relaxed text-slate-600">{checkout.instructions.map((l, i) => <li key={i}>{l}</li>)}</ul>
          {checkout.contactPhone && <a href={`tel:${checkout.contactPhone}`} className="btn-ghost mt-4 !py-2.5"><Phone size={16} /> {checkout.contactPhone}</a>}
          <p className="mt-3 text-[12.5px] text-slate-500">ברגע שהתשלום יאושר, הכרטיס של {businessName || 'העסק'} יופיע במאגר.</p>
        </div>
      ) : checkout?.kind === 'redirect' ? (
        <a href={checkout.url} className="btn-primary w-full !py-4 text-lg"><CreditCard size={19} /> למעבר לתשלום מאובטח</a>
      ) : (
        <button type="button" onClick={onPay} disabled={loading} className="btn-primary w-full !py-4 text-lg disabled:opacity-60">
          {loading ? <Loader2 size={19} className="animate-spin" /> : <CreditCard size={19} />} להמשך לתשלום
        </button>
      )}

      {editLink && (
        <div className="rounded-[1.6rem] border border-rose-100 bg-white p-5">
          <p className="font-strong text-[15px] text-ink">הקישור האישי שלכם לעריכת הכרטיס</p>
          <p className="mt-1 text-[13px] text-slate-500">שלחנו אותו גם למייל. שמרו אותו — הוא מחליף סיסמה.</p>
          <div className="mt-3 flex items-center gap-2">
            <input readOnly dir="ltr" value={editLink} className="h-11 min-w-0 flex-1 truncate rounded-xl border border-rose-100 bg-rose-50/40 px-3 text-left text-[13px] text-slate-600 outline-none" onFocus={e => e.currentTarget.select()} />
            <button type="button" onClick={copy} className="btn-ghost shrink-0 !px-4 !py-2.5">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'הועתק' : 'העתקה'}</button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------------- directory card + contact buttons ---------------- */

export const ContactButtons: React.FC<{ s: Supplier; big?: boolean }> = ({ s, big }) => {
  const cls = big ? 'flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[14.5px] font-strong transition active:scale-[0.98]' : 'flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95';
  const wa = waLink(s.whatsapp || s.phone);
  return (
    <div className={`flex ${big ? 'flex-wrap gap-2' : 'gap-1.5'}`} onClick={e => e.stopPropagation()}>
      <a href={`tel:${s.phone}`} aria-label={`חיוג ל${s.businessName}`} className={`${cls} bg-rose-700 text-white hover:bg-rose-800`}><Phone size={big ? 17 : 16} />{big && 'חיוג'}</a>
      {wa && <a href={wa} target="_blank" rel="noreferrer" aria-label="וואטסאפ" className={`${cls} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}><MessageCircle size={big ? 17 : 16} />{big && 'וואטסאפ'}</a>}
      <a href={`mailto:${s.email}?subject=${encodeURIComponent(`פנייה ממנהל/ת תרבות ב${BRAND.name}`)}`} aria-label="מייל" className={`${cls} bg-rose-50 text-rose-700 hover:bg-rose-100`}><Mail size={big ? 17 : 16} />{big && 'מייל'}</a>
      {big && s.website && <a href={s.website} target="_blank" rel="noreferrer" className={`${cls} border border-rose-100 bg-white text-slate-600 hover:text-rose-700`}><Globe size={17} /> אתר</a>}
      {big && s.instagram && <a href={s.instagram} target="_blank" rel="noreferrer" aria-label="אינסטגרם" className="flex h-12 w-12 items-center justify-center rounded-full border border-rose-100 bg-white text-slate-600 hover:text-rose-700"><Instagram size={17} /></a>}
      {big && s.facebook && <a href={s.facebook} target="_blank" rel="noreferrer" aria-label="פייסבוק" className="flex h-12 w-12 items-center justify-center rounded-full border border-rose-100 bg-white text-slate-600 hover:text-rose-700"><Facebook size={17} /></a>}
    </div>
  );
};

export const SupplierCard: React.FC<{ s: Supplier; onOpen: () => void }> = ({ s, onOpen }) => (
  <article onClick={onOpen} className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-[1.75rem] border border-rose-100/70 bg-white shadow-petal transition-all duration-500 hover:-translate-y-1 hover:shadow-lift">
    <div className="relative m-2 mb-0 aspect-[16/9] overflow-hidden rounded-[1.4rem] bg-gradient-to-br from-rose-50 to-champagne-50">
      {s.gallery?.[0] ? <img src={s.gallery[0]} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
        : <span className="flex h-full items-center justify-center text-rose-200 [&>svg]:h-12 [&>svg]:w-12">{categoryIcon(s.categories[0])}</span>}
      <span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-rose-700 shadow-soft backdrop-blur-sm">{supplierCategoryName(s.categories[0])}{s.categories.length > 1 ? ` +${s.categories.length - 1}` : ''}</span>
    </div>
    <div className="flex flex-1 flex-col gap-2.5 p-5 pt-4 text-right">
      <div className="flex items-center gap-3">
        {s.logo ? <img src={s.logo} alt="" className="h-11 w-11 shrink-0 rounded-xl border border-rose-100 bg-white object-contain p-1" />
          : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 font-accent text-2xl text-rose-500">{s.businessName.charAt(0)}</span>}
        <div className="min-w-0">
          <h3 className="truncate text-[1.15rem] leading-snug text-ink">{s.businessName}</h3>
          <p className="truncate text-[12.5px] text-slate-500">{s.contactName}</p>
        </div>
      </div>
      <p className="line-clamp-2 text-[13.5px] leading-relaxed text-slate-600">{s.description}</p>
      <div className="flex flex-col gap-1 text-[12.5px] text-slate-500">
        <span className="flex items-center gap-1.5"><MapPin size={13} className="shrink-0 text-[#BD7A81]" /><span className="truncate">{areaLabel(s)}</span></span>
        {s.priceRange && <span className="flex items-center gap-1.5"><Wallet size={13} className="shrink-0 text-[#BD7A81]" />{priceRangeName(s.priceRange)}</span>}
      </div>
      {s.styles.length > 0 && <div className="flex flex-wrap gap-1">{s.styles.slice(0, 3).map(t => <span key={t} className="rounded-full bg-plum-50 px-2.5 py-0.5 text-[11.5px] text-plum-700">{t}</span>)}</div>}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-rose-50 pt-3">
        <span className="text-[13px] font-strong text-rose-700 group-hover:underline">לפרופיל המלא</span>
        <ContactButtons s={s} />
      </div>
    </div>
  </article>
);
