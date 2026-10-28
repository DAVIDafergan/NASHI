import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ImagePlus, Loader2, MapPin, Search, Trash2, Wifi, Globe2, X } from 'lucide-react';
import { REGIONS, CITIES, SCOPES, regionName, regionOfCity } from '../../shared/regions';
import { AUDIENCE_OPTIONS, AUDIENCE_TAGS, AUDIENCE_IDS, audienceOf } from '../../shared/audience';
import { BRAND } from '../../shared/brand';
import AudienceBadge from '../AudienceBadge';
import { compressImageFile } from '../../utils/image';

/* ------------------------------------------------------------------ */
/*  Shared building blocks for the admin panel                         */
/* ------------------------------------------------------------------ */

export const API_BASE: string = (import.meta as any).env?.VITE_API_URL || '/api';
export const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
});

export const idOf = (x: any): string => (x && (x._id || x.id)) || '';

/** Effective region of an item / user (old documents are Migdal HaEmek → north). */
export const regionOfItem = (x: any): string => x?.region || regionOfCity(x?.city) || 'north';
export const cityOfItem = (x: any): string => x?.city || 'מגדל העמק';

/** Region filter: items of that region, plus national / online items that apply everywhere. */
export const matchesRegion = (x: any, region: string, includeEverywhere = true) => {
  if (!region || region === 'all') return true;
  if (includeEverywhere && (x?.scope === 'national' || x?.scope === 'online')) return true;
  return regionOfItem(x) === region;
};

export const matchesSearch = (q: string, ...fields: any[]) => {
  const s = q.trim();
  if (!s) return true;
  return fields.some(f => String(f ?? '').toLowerCase().includes(s.toLowerCase()));
};

export const fmtDate = (d?: string | Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  if (!d) return '';
  const t = new Date(d);
  return isNaN(t.getTime()) ? '' : t.toLocaleDateString('he-IL', opts);
};

/* ---------------- inputs ---------------- */

export const inputCls = 'w-full rounded-2xl border border-rose-100 bg-white px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100';

export const Field: React.FC<{ label: string; required?: boolean; hint?: string; className?: string; children: React.ReactNode }> = ({ label, required, hint, className = '', children }) => (
  <label className={`block ${className}`}>
    <span className="mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-slate-700">
      {label}{required && <span className="text-rose-500" aria-hidden="true">*</span>}
    </span>
    {children}
    {hint && <span className="mt-1 block text-[11.5px] leading-snug text-slate-400">{hint}</span>}
  </label>
);

export const FormSection: React.FC<{ title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, subtitle, icon, children }) => (
  <section className="rounded-[1.6rem] border border-rose-100/80 bg-white p-5 shadow-[0_1px_0_rgba(189,122,129,0.06)]">
    <div className="mb-4 flex items-start gap-3">
      {icon && <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">{icon}</span>}
      <div>
        <h4 className="font-strong text-[16px] text-ink">{title}</h4>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
    <div className="space-y-4">{children}</div>
  </section>
);

export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }> = ({ checked, onChange, label, hint }) => (
  <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-rose-100 bg-white px-4 py-3 text-right transition hover:border-rose-200">
    <span>
      <span className="block text-[14px] font-semibold text-ink">{label}</span>
      {hint && <span className="block text-[11.5px] text-slate-400">{hint}</span>}
    </span>
    <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-rose-600' : 'bg-slate-200'}`}>
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-1' : 'left-6'}`} />
    </span>
  </button>
);

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; icon?: React.ReactNode }[] }) {
  return (
    <div className="grid gap-1 rounded-2xl bg-rose-50/70 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(o => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)}
          className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[13px] transition ${value === o.id ? 'bg-white font-strong text-rose-800 shadow-soft' : 'text-slate-500 hover:text-rose-700'}`}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}

/** Image picker with preview; compresses phone photos before they're stored. */
export const ImagePicker: React.FC<{ value?: string; onChange: (dataUrl: string) => void; label?: string; hint?: string; aspect?: string; maxSide?: number; contain?: boolean }> = ({ value, onChange, label = 'תמונה', hint, aspect = 'aspect-[16/9]', maxSide = 1600, contain }) => {
  const [busy, setBusy] = useState(false);
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try { onChange(await compressImageFile(f, maxSide, 0.84, true)); } catch { alert('לא הצלחנו לקרוא את התמונה'); }
    finally { setBusy(false); e.target.value = ''; }
  };
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">{label}</span>
      <label className={`group relative flex ${aspect} w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/40 transition hover:border-rose-400`}>
        {value ? (
          <>
            <img src={value} alt="" className={`h-full w-full ${contain ? 'object-contain' : 'object-cover'}`} />
            <span className="absolute inset-x-0 bottom-0 bg-black/45 py-2 text-center text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">החלפת תמונה</span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-2 text-rose-500">
            {busy ? <Loader2 className="animate-spin" /> : <ImagePlus size={26} />}
            <span className="text-xs font-semibold">לבחירת תמונה</span>
          </span>
        )}
        <input type="file" accept="image/*" className="sr-only" onChange={onFile} />
      </label>
      {hint && <span className="mt-1 block text-[11.5px] text-slate-400">{hint}</span>}
    </div>
  );
};

/* ---------------- location & audience ---------------- */

/** Set by AdminPage for a regional manager: forms only offer her/his region and local scope. */
export const AdminScopeContext = React.createContext<{ lockRegion?: string }>({});


/** Searchable city picker grouped by region. */
export const CityPicker: React.FC<{ value?: string; onChange: (city: string) => void }> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const { lockRegion } = React.useContext(AdminScopeContext);
  const groups = useMemo(() => REGIONS.filter(r => !lockRegion || r.id === lockRegion).map(r => ({ ...r, cities: (CITIES as any)[r.id].filter((c: string) => !q.trim() || c.includes(q.trim())) })).filter(g => g.cities.length), [q, lockRegion]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} className={`${inputCls} flex items-center justify-between text-right`}>
        <span className="flex items-center gap-2">
          <MapPin size={16} className="text-rose-400" />
          {value ? <span>{value} <span className="text-xs text-slate-400">· {regionName(regionOfCity(value))}</span></span> : <span className="text-slate-400">בחירת עיר…</span>}
        </span>
        <ChevronDown size={16} className={`text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-rose-100 bg-white p-2 shadow-lift">
          <div className="sticky top-0 z-10 bg-white pb-2">
            <div className="flex items-center gap-2 rounded-xl bg-rose-50/70 px-3">
              <Search size={15} className="text-rose-400" />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="חיפוש עיר…" className="h-10 flex-1 bg-transparent text-sm outline-none" />
            </div>
          </div>
          {groups.map(g => (
            <div key={g.id} className="mb-1">
              <p className="px-2 pb-1 pt-2 text-[11px] font-semibold text-rose-600">{g.name}</p>
              <div className="flex flex-wrap gap-1.5 px-1">
                {g.cities.map((c: string) => (
                  <button key={c} type="button" onClick={() => { onChange(c); setOpen(false); setQ(''); }}
                    className={`rounded-full border px-3 py-1.5 text-[13px] transition ${c === value ? 'border-rose-600 bg-rose-600 text-white' : 'border-rose-100 text-slate-700 hover:border-rose-300 hover:bg-rose-50'}`}>{c}</button>
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 && <p className="p-4 text-center text-sm text-slate-400">לא נמצאה עיר כזאת</p>}
        </div>
      )}
    </div>
  );
};

type LocationValue = { scope?: string; city?: string; onlineLink?: string; audience?: any; audienceTags?: string[] };

/**
 * "מיקום וקהל" form section used by events, classes, community and lotteries.
 * Always asks who the item is for (required): לגברים / לנשים / לכולם. A new item starts with audience '' (nothing
 * chosen); an existing item without the field (or with the old tag array) is shown as 'women' — what it always was.
 * withAudience adds the optional "למי זה מתאים" tags (audienceTags).
 */
export const LocationFields: React.FC<{ value: LocationValue; onChange: (patch: Partial<LocationValue>) => void; withAudience?: boolean; withOnline?: boolean; noAudience?: boolean }> = ({ value, onChange, withAudience, withOnline = true, noAudience = false }) => {
  const { lockRegion } = React.useContext(AdminScopeContext);
  const scope = (lockRegion ? 'local' : (value.scope || 'local')) as 'local' | 'national' | 'online';
  // regional managers publish local items only
  useEffect(() => { if (lockRegion && value.scope && value.scope !== 'local') onChange({ scope: 'local' }); }, [lockRegion, value.scope]); // eslint-disable-line react-hooks/exhaustive-deps
  // an existing item: missing audience / legacy tag array → 'women' (+ the old tags move to audienceTags)
  useEffect(() => {
    if (noAudience || value.audience === '' || AUDIENCE_IDS.includes(value.audience)) return;
    onChange({ audience: audienceOf(value), ...(Array.isArray(value.audience) && !value.audienceTags?.length ? { audienceTags: value.audience } : {}) });
  }, [value.audience]); // eslint-disable-line react-hooks/exhaustive-deps
  const aud = AUDIENCE_IDS.includes(value.audience) ? value.audience as string : '';
  const audRef = useRef<HTMLInputElement>(null);
  useEffect(() => { audRef.current?.setCustomValidity(aud || noAudience ? '' : 'יש לבחור קהל יעד: לגברים, לנשים או לכולם'); }, [aud, noAudience]);
  const tags = aud ? AUDIENCE_TAGS[aud as 'men' | 'women' | 'all'] : [];
  const opts = SCOPES.filter(s => withOnline || s.id !== 'online').map(s => ({
    id: s.id,
    label: s.id === 'local' ? 'מקומי' : s.id === 'national' ? 'ארצי' : 'מקוון',
    icon: s.id === 'local' ? <MapPin size={14} /> : s.id === 'national' ? <Globe2 size={14} /> : <Wifi size={14} />,
  }));
  return (
    <FormSection title="מיקום וקהל" subtitle="קובע למי ואיפה זה יוצג באתר" icon={<MapPin size={17} />}>
      {!noAudience && (
      <Field label="קהל יעד" required hint={aud ? AUDIENCE_OPTIONS.find(o => o.id === aud)?.hint : 'חובה לבחור: יוצג בסינון "לגברים", "לנשים" או "משפחות/לכולם".'}>
        <div className="relative">
          <Segmented value={aud as any} onChange={(v) => onChange({ audience: v, audienceTags: (value.audienceTags || []).filter(t => AUDIENCE_TAGS[v as 'men' | 'women' | 'all'].includes(t)) })} options={AUDIENCE_OPTIONS.map(o => ({ id: o.id, label: o.label }))} />
          {/* native "required" for the segmented control: the form won't submit until an audience is chosen */}
          <input ref={audRef} required value={aud} onChange={() => {}} tabIndex={-1} aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0" />
        </div>
      </Field>
      )}
      {lockRegion ? (
        <p className="rounded-2xl bg-rose-50/70 px-4 py-3 text-sm text-rose-800">האזור שבניהולך: <b>{regionName(lockRegion)}</b>. התוכן יוצג באזור, ובנוסף בסינון של כל הארץ.</p>
      ) : (
      <Field label="היקף" hint={scope === 'local' ? 'יוצג קודם למבקרים מהאזור של העיר שנבחרה.' : scope === 'national' ? 'יוצג לכל המבקרים בכל הארץ.' : 'מתקיים באונליין — יוצג לכולם, עם קישור הצטרפות.'}>
        <Segmented value={scope} onChange={(v) => onChange({ scope: v })} options={opts as any} />
      </Field>
      )}
      {scope === 'local' && (
        <Field label="עיר" required hint="האזור נקבע אוטומטית לפי העיר.">
          <CityPicker value={value.city} onChange={(city) => onChange({ city })} />
        </Field>
      )}
      {scope === 'online' && withOnline && (
        <Field label="קישור להצטרפות (זום / יוטיוב)" hint="אפשר להוסיף גם מאוחר יותר.">
          <input dir="ltr" className={`${inputCls} text-left`} placeholder="https://zoom.us/j/…" value={value.onlineLink || ''} onChange={e => onChange({ onlineLink: e.target.value })} />
        </Field>
      )}
      {withAudience && aud && (
        <Field label="למי זה מתאים?" hint="לא חובה. אפשר לבחור כמה.">
          <div className="flex flex-wrap gap-2">
            {tags.map(a => {
              const on = (value.audienceTags || []).includes(a);
              return (
                <button key={a} type="button" onClick={() => onChange({ audienceTags: on ? (value.audienceTags || []).filter(x => x !== a) : [...(value.audienceTags || []), a] })}
                  className={`flex items-center gap-1 rounded-full border px-3.5 py-2 text-[13px] transition ${on ? 'border-rose-600 bg-rose-600 text-white' : 'border-rose-100 bg-white text-slate-600 hover:border-rose-300'}`}>
                  {on && <Check size={13} />}{a}
                </button>
              );
            })}
          </div>
        </Field>
      )}
    </FormSection>
  );
};

export const LocationBadges: React.FC<{ item: any; showAudience?: boolean }> = ({ item, showAudience }) => (
  <div className="flex flex-wrap gap-1.5">
    {item?.scope === 'national' ? <Badge tone="plum"><Globe2 size={11} /> ארצי</Badge>
      : item?.scope === 'online' ? <Badge tone="sky"><Wifi size={11} /> מקוון</Badge>
      : <Badge tone="rose"><MapPin size={11} /> {cityOfItem(item)}</Badge>}
    <AudienceBadge item={item} />
    {showAudience && (item?.audienceTags || (Array.isArray(item?.audience) ? item.audience : [])).slice(0, 2).map((a: string) => <Badge key={a} tone="slate">{a}</Badge>)}
  </div>
);

/* ---------------- display ---------------- */

const TONES: Record<string, string> = {
  rose: 'bg-rose-50 text-rose-700 border-rose-100',
  plum: 'bg-plum-50 text-plum-700 border-plum-100',
  sky: 'bg-sky-50 text-sky-700 border-sky-100',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  slate: 'bg-slate-50 text-slate-600 border-slate-100',
  red: 'bg-red-50 text-red-600 border-red-100',
};
export const Badge: React.FC<{ tone?: keyof typeof TONES | string; children: React.ReactNode; className?: string }> = ({ tone = 'slate', children, className = '' }) => (
  <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold ${TONES[tone] || TONES.slate} ${className}`}>{children}</span>
);

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode }> = ({ icon, title, text, action }) => (
  <div className="flex flex-col items-center rounded-[2rem] border border-dashed border-rose-200 bg-white/70 px-6 py-14 text-center">
    {icon && <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">{icon}</span>}
    <p className="font-strong text-lg text-ink">{title}</p>
    {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'default' | 'danger' | 'good' }> = ({ tone = 'default', className = '', children, ...rest }) => (
  <button type="button" {...rest}
    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-40 ${tone === 'danger' ? 'border-red-100 text-red-500 hover:bg-red-50' : tone === 'good' ? 'border-emerald-100 text-emerald-600 hover:bg-emerald-50' : 'border-rose-100 text-slate-500 hover:border-rose-300 hover:text-rose-700'} ${className}`}>
    {children}
  </button>
);

export const DeleteButton: React.FC<{ name: string; onConfirm: () => Promise<any> | void; label?: string }> = ({ name, onConfirm, label }) => {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!window.confirm(`למחוק את "${name}"? אי אפשר לבטל.`)) return;
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  };
  return label
    ? <button type="button" onClick={run} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full border border-red-100 px-3.5 py-2 text-[13px] text-red-600 hover:bg-red-50 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}{label}</button>
    : <IconButton tone="danger" onClick={run} disabled={busy} title="מחיקה" aria-label="מחיקה">{busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}</IconButton>;
};

export const Pager: React.FC<{ page: number; total: number; onPage: (p: number) => void }> = ({ page, total, onPage }) => total <= 1 ? null : (
  <div className="flex items-center justify-center gap-3 pt-2">
    <IconButton onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} aria-label="הקודם"><ChevronRight size={16} /></IconButton>
    <span className="text-sm text-slate-500 tabular-nums">{page} / {total}</span>
    <IconButton onClick={() => onPage(Math.min(total, page + 1))} disabled={page === total} aria-label="הבא"><ChevronLeft size={16} /></IconButton>
  </div>
);

export const SectionTitle: React.FC<{ title: string; count?: number; icon?: React.ReactNode; action?: React.ReactNode }> = ({ title, count, icon, action }) => (
  <div className="mb-3 flex items-center justify-between gap-3">
    <h3 className="flex items-center gap-2 text-[17px]">{icon && <span className="text-rose-500">{icon}</span>}{title}{count !== undefined && <span className="text-sm font-normal text-slate-400">({count})</span>}</h3>
    {action}
  </div>
);

/* ---------------- sheet (slide-over form) ---------------- */

export const Sheet: React.FC<{
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode;
  footer?: React.ReactNode; wide?: boolean;
}> = ({ open, onClose, title, subtitle, children, footer, wide }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[300] flex justify-end bg-ink/40 backdrop-blur-[2px] animate-fade-in" dir="rtl" onClick={onClose}>
      <aside onClick={e => e.stopPropagation()}
        className={`flex h-full w-full flex-col bg-[#FBF7F4] shadow-2xl ${wide ? 'md:max-w-3xl' : 'md:max-w-xl'} animate-fade-in-up`}>
        <header className="flex items-start justify-between gap-4 border-b border-rose-100 bg-white/80 px-5 py-4 md:px-7">
          <div>
            <h3 className="text-[1.35rem]">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="סגירה" className="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X size={20} /></button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 md:px-7">{children}</div>
        {footer && <footer className="border-t border-rose-100 bg-white/95 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] md:px-7">{footer}</footer>}
      </aside>
    </div>,
    document.body
  );
};

/** Save bar used at the bottom of every sheet. */
export const SaveBar: React.FC<{ onCancel: () => void; saving?: boolean; label?: string; formId?: string; extra?: React.ReactNode }> = ({ onCancel, saving, label = 'שמירה', formId, extra }) => (
  <div className="flex items-center gap-2">
    <button type="submit" form={formId} disabled={saving} className="btn-primary flex-1 !py-3 disabled:opacity-60">
      {saving ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />} {label}
    </button>
    {extra}
    <button type="button" onClick={onCancel} className="btn-ghost !py-3">ביטול</button>
  </div>
);

/* ---------------- toast ---------------- */

let toastFn: ((m: string, tone?: 'good' | 'bad') => void) | null = null;
export const toast = (m: string, tone: 'good' | 'bad' = 'good') => { if (toastFn) toastFn(m, tone); else alert(m); };

export const ToastHost: React.FC = () => {
  const [msg, setMsg] = useState<{ m: string; tone: 'good' | 'bad' } | null>(null);
  useEffect(() => {
    let t = 0;
    toastFn = (m, tone = 'good') => { setMsg({ m, tone }); window.clearTimeout(t); t = window.setTimeout(() => setMsg(null), 3000); };
    return () => { toastFn = null; window.clearTimeout(t); };
  }, []);
  if (!msg) return null;
  return createPortal(
    <div className={`fixed bottom-6 left-1/2 z-[400] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl px-5 py-3 text-center text-sm text-white shadow-lift animate-fade-in-up ${msg.tone === 'bad' ? 'bg-red-600' : 'bg-ink'}`}>{msg.m}</div>,
    document.body
  );
};

/** Run an async save with a spinner flag + toast. */
export async function withSave(setSaving: (b: boolean) => void, fn: () => Promise<any>, okMsg = 'נשמר ✔') {
  setSaving(true);
  try { await fn(); toast(okMsg); return true; }
  catch (e: any) { toast(e?.message ? `שגיאה: ${e.message}` : 'שגיאה בשמירה', 'bad'); return false; }
  finally { setSaving(false); }
}

/** Card row used by list pages: thumbnail + title + meta + actions. */
export const ItemCard: React.FC<{ image?: string; title: string; meta?: React.ReactNode; badges?: React.ReactNode; tags?: React.ReactNode; actions?: React.ReactNode; onClick?: () => void; highlight?: boolean; children?: React.ReactNode }> = ({ image, title, meta, badges, tags, actions, onClick, highlight, children }) => (
  <article className={`group flex flex-col overflow-hidden rounded-[1.6rem] border bg-white shadow-soft transition hover:shadow-lift ${highlight ? 'border-amber-200 ring-2 ring-amber-100' : 'border-rose-100/80'}`}>
    <button type="button" onClick={onClick} className="relative block aspect-[16/9] w-full overflow-hidden bg-rose-50 text-right" tabIndex={onClick ? 0 : -1}>
      {image ? <img src={image} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        : <span className="flex h-full items-center justify-center font-accent text-5xl text-rose-200">{BRAND.name}</span>}
      {badges && <span className="absolute right-3 top-3 flex flex-wrap gap-1">{badges}</span>}
    </button>
    <div className="flex flex-1 flex-col gap-2 p-4">
      <h4 className="line-clamp-2 font-strong text-[16px] leading-snug text-ink">{title}</h4>
      {meta && <div className="space-y-1 text-[12.5px] text-slate-500">{meta}</div>}
      {tags && <div className="pt-0.5">{tags}</div>}
      {children}
      {actions && <div className="mt-auto flex items-center justify-end gap-1.5 border-t border-rose-50 pt-3">{actions}</div>}
    </div>
  </article>
);

/** Runs fn when the header's "new" button is pressed (tick changes) — never on first mount. */
export function useOnCreate(tick: number, fn: () => void) {
  const last = useRef(tick);
  useEffect(() => {
    if (tick !== last.current) { last.current = tick; if (tick) fn(); }
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps
}

export const FILTERED_NOTE = (n: number, total: number) => n === total ? `${total}` : `${n} מתוך ${total}`;
