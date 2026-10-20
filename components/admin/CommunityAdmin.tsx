import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, HeartHandshake, Info, Pencil, Phone, Plus, Sparkles, Store } from 'lucide-react';
import { api } from '../../services/api';
import {
  Badge, DeleteButton, EmptyState, Field, FormSection, IconButton, ImagePicker, LocationBadges, LocationFields,
  SaveBar, Segmented, Sheet, Toggle, idOf, inputCls, matchesRegion, matchesSearch, withSave, useOnCreate,
} from './ui';

const CATS = [
  { id: 'שיעורי תורה', label: 'שיעורי תורה', icon: <BookOpen size={14} /> },
  { id: 'גמ"חים', label: 'גמ"חים', icon: <HeartHandshake size={14} /> },
  { id: 'עסקים מקומיים', label: 'עסקים של נשים', icon: <Store size={14} /> },
];
const catOf = (c?: string) => (c && c.includes('עסק') ? 'עסקים מקומיים' : c || 'גמ"חים');

const blank = (category = 'גמ"חים') => ({ category, title: '', description: '', phone: '', location: '', image: '', startTime: '', targetAudience: '', isPaid: false, price: 0, scope: 'local', city: '' });

const CommunityAdmin: React.FC<{ items: any[]; region: string; search: string; createTick: number; reload: () => void }> = ({ items, region, search, createTick, reload }) => {
  const [cat, setCat] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(blank());
  const [saving, setSaving] = useState(false);

  useOnCreate(createTick, () => { setForm(blank(cat === 'all' ? 'גמ"חים' : cat)); setOpen(true); });

  const list = useMemo(() => items
    .filter(i => matchesRegion(i, region) && matchesSearch(search, i.title, i.description, i.location, i.city))
    .filter(i => cat === 'all' || catOf(i.category) === cat), [items, region, search, cat]);
  const set = (patch: any) => setForm((f: any) => ({ ...f, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.scope === 'local' && !form.city) { alert('נא לבחור עיר (או לסמן ארצי / מקוון)'); return; }
    const id = idOf(form);
    const data = { ...form, category: catOf(form.category) };
    if (!id) { delete data._id; delete data.id; }
    const ok = await withSave(setSaving, async () => { if (id) await api.updateCommunityItem(id, data); else await api.createCommunityItem(data); }, 'נשמר ✔');
    if (ok) { setOpen(false); reload(); }
  };

  const counts = (id: string) => items.filter(i => catOf(i.category) === id && matchesRegion(i, region)).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <button onClick={() => setCat('all')} className={`rounded-2xl border px-4 py-3 text-right transition ${cat === 'all' ? 'border-rose-700 bg-rose-700 text-white' : 'border-rose-100 bg-white'}`}>
          <span className="block font-strong">הכול</span><span className={`text-xs ${cat === 'all' ? 'text-white/80' : 'text-slate-400'}`}>{items.filter(i => matchesRegion(i, region)).length} פריטים</span>
        </button>
        {CATS.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)} className={`rounded-2xl border px-4 py-3 text-right transition ${cat === c.id ? 'border-rose-700 bg-rose-700 text-white' : 'border-rose-100 bg-white'}`}>
            <span className="flex items-center gap-1.5 font-strong">{c.icon}{c.label}</span><span className={`text-xs ${cat === c.id ? 'text-white/80' : 'text-slate-400'}`}>{counts(c.id)} פריטים</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<HeartHandshake size={26} />} title="אין פריטים להצגה" text="שיעורי תורה, גמ״חים ועסקים של נשים מופיעים בעמוד הקהילה."
          action={<button onClick={() => { setForm(blank(cat === 'all' ? 'גמ"חים' : cat)); setOpen(true); }} className="btn-primary"><Plus size={16} /> הוספה</button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map(i => (
            <article key={idOf(i)} className="flex items-center gap-3 rounded-[1.4rem] border border-rose-100/80 bg-white p-3 shadow-soft">
              <button onClick={() => { setForm({ ...blank(), ...i, category: catOf(i.category) }); setOpen(true); }} className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-rose-50">
                {i.image ? <img src={i.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-rose-300">{CATS.find(c => c.id === catOf(i.category))?.icon}</span>}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-rose-600">{CATS.find(c => c.id === catOf(i.category))?.label}</p>
                <h4 className="truncate font-strong text-[15px] text-ink">{i.title}</h4>
                <div className="mt-1 flex flex-wrap items-center gap-1.5"><LocationBadges item={i} />{i.phone && <Badge tone="slate"><Phone size={10} /> <span dir="ltr">{i.phone}</span></Badge>}</div>
              </div>
              <div className="flex flex-col gap-1.5">
                <IconButton onClick={() => { setForm({ ...blank(), ...i, category: catOf(i.category) }); setOpen(true); }} aria-label="עריכה"><Pencil size={15} /></IconButton>
                <DeleteButton name={i.title} onConfirm={async () => { await api.deleteCommunityItem(idOf(i)); reload(); }} />
              </div>
            </article>
          ))}
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={idOf(form) ? 'עריכת פריט בקהילה' : 'הוספה לקהילה'} subtitle="שדות עם * הם חובה"
        footer={<SaveBar formId="community-form" saving={saving} onCancel={() => setOpen(false)} label="שמירה ופרסום" />}>
        <form id="community-form" onSubmit={save} className="space-y-4">
          <FormSection title="סוג" icon={<Info size={17} />}>
            <Segmented value={catOf(form.category)} onChange={(v) => set({ category: v })} options={CATS as any} />
          </FormSection>
          <FormSection title="פרטים">
            <Field label={catOf(form.category) === 'שיעורי תורה' ? 'שם השיעור / המרצה' : catOf(form.category) === 'גמ"חים' ? 'שם הגמ"ח' : 'שם העסק'} required>
              <input required className={inputCls} value={form.title} onChange={e => set({ title: e.target.value })} />
            </Field>
            <Field label="תיאור קצר"><textarea rows={3} className={`${inputCls} resize-y`} value={form.description || ''} onChange={e => set({ description: e.target.value })} /></Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="טלפון (לוואטסאפ)"><input dir="ltr" className={`${inputCls} text-left`} value={form.phone || ''} onChange={e => set({ phone: e.target.value })} /></Field>
              <Field label="שעה" hint="לשיעורים"><input type="time" className={inputCls} value={form.startTime || ''} onChange={e => set({ startTime: e.target.value })} /></Field>
            </div>
            <Field label="למי מיועד"><input className={inputCls} value={form.targetAudience || ''} onChange={e => set({ targetAudience: e.target.value })} placeholder="למשל: נשים ונערות" /></Field>
            <Toggle checked={!!form.isPaid} onChange={isPaid => set({ isPaid })} label="בתשלום" />
            {form.isPaid && <Field label="מחיר (₪)"><input type="number" min={0} className={inputCls} value={form.price ?? 0} onChange={e => set({ price: Number(e.target.value) })} /></Field>}
          </FormSection>
          <LocationFields value={form} onChange={set} withOnline={false} />
          <FormSection title="כתובת"><Field label="מקום / כתובת"><input className={inputCls} value={form.location || ''} onChange={e => set({ location: e.target.value })} /></Field></FormSection>
          <FormSection title="תמונה" icon={<Sparkles size={17} />}><ImagePicker label="תמונה / לוגו" value={form.image} onChange={image => set({ image })} aspect="aspect-[4/3]" /></FormSection>
        </form>
      </Sheet>
    </div>
  );
};

export default CommunityAdmin;
