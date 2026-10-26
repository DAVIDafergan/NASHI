import React, { useMemo, useState } from 'react';
import {
  BarChart3, Calendar, Eye, Globe2, Image as ImageIcon, LayoutTemplate, Loader2, Megaphone, MousePointerClick, Pause,
  Pencil, Play, Plus, Smartphone, Upload, Video, MapPin,
} from 'lucide-react';
import { api } from '../../services/api';
import {
  Badge, CityPicker, DeleteButton, EmptyState, Field, FormSection, IconButton, ImagePicker, SaveBar, Segmented, Sheet, Toggle,
  fmtDate, idOf, inputCls, toast, useOnCreate, withSave,
} from './ui';
import { regionName } from '../../shared/regions';
import { BRAND } from '../../shared/brand';

export const AD_PLACEMENTS: { id: string; label: string; hint: string }[] = [
  { id: 'home-top', label: 'דף הבית · למעלה', hint: 'מתחת לסטטוסים — הכי נצפה' },
  { id: 'home-middle', label: 'דף הבית · באמצע', hint: 'אחרי האירועים הקרובים' },
  { id: 'home-bottom', label: 'דף הבית · למטה', hint: 'לפני הודעות ההנהלה' },
  { id: 'events', label: 'עמוד האירועים', hint: 'מעל רשימת האירועים' },
  { id: 'classes', label: 'עמוד החוגים', hint: 'מעל רשימת החוגים' },
  { id: 'community', label: 'עמוד הקהילה', hint: 'מעל הגמ"חים והעסקים' },
];
const placementName = (id: string) => AD_PLACEMENTS.find(p => p.id === id)?.label || id;

const toDate = (v?: string | null) => (v ? new Date(v).toISOString().slice(0, 10) : '');
const statusOf = (ad: any): { key: 'live' | 'off' | 'scheduled' | 'ended'; label: string; tone: string } => {
  const now = Date.now();
  if (ad.isActive === false) return { key: 'off', label: 'מושהה', tone: 'slate' };
  if (ad.startsAt && new Date(ad.startsAt).getTime() > now) return { key: 'scheduled', label: `מתחיל ${fmtDate(ad.startsAt, { day: 'numeric', month: 'short' })}`, tone: 'sky' };
  if (ad.endsAt && new Date(ad.endsAt).getTime() < now) return { key: 'ended', label: 'הסתיים', tone: 'slate' };
  return { key: 'live', label: 'באוויר', tone: 'green' };
};
const ctr = (ad: any) => (ad.views ? Math.round((ad.clicks / ad.views) * 1000) / 10 : 0);
const isVideoFile = (s?: string) => !!s && (s.startsWith('data:video') || /\.(mp4|webm|mov)(\?|$)/i.test(s) || /\/api\/media\/[a-f0-9]+\.(mp4|webm|mov)/i.test(s));

const blank = {
  _id: '', title: '', advertiser: '', advertiserPhone: '', type: 'image', content: '', mobileContent: '', link: '', ctaText: 'לפרטים',
  placements: ['home-middle'], isActive: true, startsAt: '', endsAt: '', order: 0, scope: 'national', city: '',
};

const VideoPicker: React.FC<{ value?: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const [busy, setBusy] = useState(false);
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 11 * 1024 * 1024) { toast('הסרטון גדול מ-11MB. כדאי לקצר או לכווץ אותו.', 'bad'); return; }
    setBusy(true);
    const r = new FileReader();
    r.onload = () => { onChange(String(r.result)); setBusy(false); };
    r.onerror = () => { setBusy(false); toast('קריאת הסרטון נכשלה', 'bad'); };
    r.readAsDataURL(f);
    e.target.value = '';
  };
  return (
    <div className="space-y-2">
      <label className="flex aspect-[16/9] w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-rose-200 bg-ink/90 text-white">
        {value && isVideoFile(value) ? <video src={value} muted autoPlay loop playsInline className="h-full w-full object-contain" />
          : <span className="flex flex-col items-center gap-2 text-white/80">{busy ? <Loader2 className="animate-spin" /> : <Upload size={26} />}<span className="text-xs">העלאת סרטון קצר (עד 11MB, MP4)</span></span>}
        <input type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" onChange={onFile} />
      </label>
      <Field label="או קישור לסרטון" hint="קישור ישיר ל-MP4, או סרטון YouTube">
        <input dir="ltr" className={`${inputCls} text-left`} placeholder="https://…" value={value && !value.startsWith('data:') ? value : ''} onChange={e => onChange(e.target.value)} />
      </Field>
    </div>
  );
};

const AdsAdmin: React.FC<{ items: any[]; createTick: number; reload: () => void }> = ({ items, createTick, reload }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(blank);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'all' | 'live' | 'off'>('all');
  const set = (p: any) => setForm((f: any) => ({ ...f, ...p }));
  const openNew = () => { setForm(blank); setOpen(true); };
  useOnCreate(createTick, openNew);

  const totals = useMemo(() => ({
    live: items.filter(a => statusOf(a).key === 'live').length,
    views: items.reduce((s, a) => s + (a.views || 0), 0),
    clicks: items.reduce((s, a) => s + (a.clicks || 0), 0),
  }), [items]);
  const list = items.filter(a => tab === 'all' ? true : tab === 'live' ? statusOf(a).key === 'live' : statusOf(a).key !== 'live');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.content) { toast(form.type === 'image' ? 'צריך להעלות באנר' : 'צריך סרטון או קישור', 'bad'); return; }
    if (!form.placements?.length) { toast('יש לבחור לפחות מקום אחד באתר', 'bad'); return; }
    if (form.scope === 'local' && !form.city) { toast('יש לבחור עיר לפרסום מקומי', 'bad'); return; }
    const data = { ...form };
    if (!data._id) delete data._id;
    const ok = await withSave(setSaving, async () => { if (form._id) await api.updateAd(form._id, data); else await api.createAd(data); }, 'הפרסום נשמר ✔');
    if (ok) { setOpen(false); reload(); }
  };
  const toggle = async (ad: any) => {
    await withSave(() => {}, () => api.updateAd(idOf(ad), { isActive: ad.isActive === false }), ad.isActive === false ? 'הפרסום חזר לאוויר ✔' : 'הפרסום הושהה');
    reload();
  };

  return (
    <div className="space-y-5">
      {/* stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: <Play size={18} />, n: totals.live, label: 'באוויר עכשיו' },
          { icon: <Eye size={18} />, n: totals.views.toLocaleString('he-IL'), label: 'צפיות' },
          { icon: <MousePointerClick size={18} />, n: totals.clicks.toLocaleString('he-IL'), label: `לחיצות${totals.views ? ` · ${Math.round((totals.clicks / totals.views) * 1000) / 10}%` : ''}` },
        ].map((k, i) => (
          <div key={i} className="rounded-[1.4rem] border border-rose-100 bg-white p-4 shadow-soft">
            <span className="text-rose-500">{k.icon}</span>
            <p className="mt-1.5 font-strong text-2xl text-ink tabular-nums">{k.n}</p>
            <p className="text-xs text-slate-500">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([['all', 'הכול'], ['live', 'באוויר'], ['off', 'מושהים / מתוזמנים']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full border px-4 py-2 text-[13px] transition ${tab === k ? 'border-rose-700 bg-rose-700 text-white' : 'border-rose-100 bg-white text-slate-600 hover:border-rose-300'}`}>{l}</button>
        ))}
        <span className="mr-auto text-xs text-slate-400">גדלים מומלצים: באנר רחב 1920×640 · גרסת נייד 1080×1080</span>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<Megaphone size={24} />} title="אין פרסומות כאן" text="פרסומת יכולה להופיע בדף הבית ובעמודי האירועים, החוגים והקהילה, לכל הארץ או לעיר אחת." action={<button onClick={openNew} className="btn-primary"><Plus size={16} /> פרסום חדש</button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map(ad => {
            const st = statusOf(ad);
            return (
              <article key={idOf(ad)} className={`flex flex-col overflow-hidden rounded-[1.6rem] border bg-white shadow-soft ${st.key === 'live' ? 'border-rose-100' : 'border-slate-100 opacity-90'}`}>
                <div className="relative aspect-[16/7] bg-rose-50">
                  {ad.type === 'video'
                    ? (isVideoFile(ad.content) ? <video src={ad.content} muted playsInline className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center bg-ink text-white"><Video size={28} /></span>)
                    : <img src={ad.content} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  <span className="absolute right-3 top-3"><Badge tone={st.tone}>{st.label}</Badge></span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h4 className="truncate font-strong text-ink">{ad.title || 'ללא כותרת'}</h4>
                  {ad.advertiser && <p className="text-xs text-slate-500">בשיתוף {ad.advertiser}</p>}
                  <div className="flex flex-wrap gap-1">
                    {(ad.placements || ['home-middle']).map((p: string) => <Badge key={p} tone="rose">{placementName(p)}</Badge>)}
                    {ad.scope === 'local' ? <Badge tone="amber"><MapPin size={10} /> {ad.city}</Badge> : <Badge tone="plum"><Globe2 size={10} /> כל הארץ</Badge>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Eye size={12} /> {(ad.views || 0).toLocaleString('he-IL')}</span>
                    <span className="flex items-center gap-1"><MousePointerClick size={12} /> {(ad.clicks || 0).toLocaleString('he-IL')}</span>
                    <span className="flex items-center gap-1"><BarChart3 size={12} /> {ctr(ad)}%</span>
                  </div>
                  {(ad.startsAt || ad.endsAt) && <p className="flex items-center gap-1 text-[11.5px] text-slate-400"><Calendar size={11} /> {ad.startsAt ? fmtDate(ad.startsAt) : 'מעכשיו'} – {ad.endsAt ? fmtDate(ad.endsAt) : 'ללא סיום'}</p>}
                  <div className="mt-auto flex items-center justify-end gap-1.5 border-t border-rose-50 pt-3">
                    <IconButton onClick={() => toggle(ad)} title={ad.isActive === false ? 'החזרה לאוויר' : 'השהיה'} aria-label="השהיה">{ad.isActive === false ? <Play size={15} /> : <Pause size={15} />}</IconButton>
                    <IconButton onClick={() => { setForm({ ...blank, ...ad, startsAt: toDate(ad.startsAt), endsAt: toDate(ad.endsAt), placements: ad.placements?.length ? ad.placements : ['home-middle'] }); setOpen(true); }} aria-label="עריכה"><Pencil size={15} /></IconButton>
                    <DeleteButton name={ad.title || 'הפרסום'} onConfirm={async () => { await api.deleteAd(idOf(ad)); reload(); }} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} wide title={form._id ? 'עריכת פרסום' : 'פרסום חדש'} subtitle="שדות עם * הם חובה"
        footer={<SaveBar formId="ad-form" saving={saving} onCancel={() => setOpen(false)} label={form._id ? 'שמירה' : 'העלאה לאתר'} />}>
        <form id="ad-form" onSubmit={save} className="space-y-4">
          <FormSection title="הפרסום" icon={<Megaphone size={17} />}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="כותרת" required hint="מופיעה על הפרסום"><input required className={inputCls} value={form.title} onChange={e => set({ title: e.target.value })} placeholder={`למשל: 20% הנחה לחברי ${BRAND.name}`} /></Field>
              <Field label="שם המפרסם" hint='יוצג כ"בשיתוף …"'><input className={inputCls} value={form.advertiser || ''} onChange={e => set({ advertiser: e.target.value })} placeholder="למשל: סטודיו שירה" /></Field>
            </div>
            <Segmented value={form.type} onChange={(type) => set({ type, content: '', mobileContent: '' })} options={[{ id: 'image', label: 'באנר', icon: <ImageIcon size={14} /> }, { id: 'video', label: 'סרטון', icon: <Video size={14} /> }]} />
            {form.type === 'image' ? (
              <div className="grid gap-3 md:grid-cols-[1.6fr_1fr]">
                <ImagePicker label="באנר למחשב *" aspect="aspect-[3/1]" value={form.content} onChange={content => set({ content })} maxSide={1920} contain hint="רחב, 1920×640" />
                <ImagePicker label="גרסה לנייד" aspect="aspect-square" value={form.mobileContent} onChange={mobileContent => set({ mobileContent })} maxSide={1080} contain hint="ריבוע 1080×1080 · לא חובה" />
              </div>
            ) : <VideoPicker value={form.content} onChange={content => set({ content })} />}
            <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
              <Field label="לאן לוחצים?" hint="אתר, וואטסאפ (https://wa.me/972…) או טלפון (tel:05…)"><input dir="ltr" className={`${inputCls} text-left`} value={form.link || ''} onChange={e => set({ link: e.target.value })} placeholder="https://…" /></Field>
              <Field label="טקסט הכפתור"><input className={inputCls} value={form.ctaText || ''} onChange={e => set({ ctaText: e.target.value })} placeholder="לפרטים" /></Field>
            </div>
          </FormSection>

          <FormSection title="איפה יופיע באתר" subtitle="אפשר לבחור כמה מקומות" icon={<LayoutTemplate size={17} />}>
            <div className="grid gap-2 sm:grid-cols-2">
              {AD_PLACEMENTS.map(p => {
                const on = (form.placements || []).includes(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => set({ placements: on ? form.placements.filter((x: string) => x !== p.id) : [...(form.placements || []), p.id] })}
                    className={`rounded-2xl border p-3 text-right transition ${on ? 'border-rose-600 bg-rose-50 ring-2 ring-rose-100' : 'border-rose-100 bg-white hover:border-rose-300'}`}>
                    <span className={`block text-sm ${on ? 'font-strong text-rose-800' : 'text-ink'}`}>{p.label}</span>
                    <span className="block text-[11.5px] text-slate-400">{p.hint}</span>
                  </button>
                );
              })}
            </div>
          </FormSection>

          <FormSection title="למי ומתי" icon={<Calendar size={17} />}>
            <Field label="קהל">
              <Segmented value={form.scope === 'local' ? 'local' : 'national'} onChange={(scope) => set({ scope, city: scope === 'local' ? form.city : '' })}
                options={[{ id: 'national', label: 'כל הארץ', icon: <Globe2 size={14} /> }, { id: 'local', label: 'עיר / אזור', icon: <MapPin size={14} /> }]} />
            </Field>
            {form.scope === 'local' && (
              <Field label="עיר" required hint={form.city ? `יוצג למבקרים מאזור ${regionName(form.region || '') || 'העיר'}` : 'יוצג רק למבקרים מהאזור של העיר'}>
                <CityPicker value={form.city} onChange={city => set({ city })} />
              </Field>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="מתאריך" hint="ריק = מיד"><input type="date" className={inputCls} value={form.startsAt || ''} onChange={e => set({ startsAt: e.target.value })} /></Field>
              <Field label="עד תאריך" hint="ריק = בלי סיום"><input type="date" className={inputCls} value={form.endsAt || ''} onChange={e => set({ endsAt: e.target.value })} /></Field>
            </div>
            <Toggle checked={form.isActive !== false} onChange={isActive => set({ isActive })} label="פעיל באתר" hint="אפשר להשהות בלי למחוק" />
          </FormSection>

          <FormSection title="פרטי המפרסם (פנימי)" icon={<Smartphone size={17} />}>
            <Field label="טלפון של המפרסם" hint="לא מוצג באתר"><input dir="ltr" className={`${inputCls} text-left`} value={form.advertiserPhone || ''} onChange={e => set({ advertiserPhone: e.target.value })} placeholder="05…" /></Field>
          </FormSection>
        </form>
      </Sheet>
    </div>
  );
};

export default AdsAdmin;
