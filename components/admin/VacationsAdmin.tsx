import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Info, Palmtree, Pencil, Phone, Plus, Sparkles, MapPin } from 'lucide-react';
import { api } from '../../services/api';
import {
  Badge, DeleteButton, EmptyState, Field, FormSection, IconButton, ImagePicker, ItemCard, LocationBadges, LocationFields,
  Pager, SaveBar, Sheet, idOf, inputCls, matchesRegion, matchesSearch, withSave, useOnCreate,
} from './ui';

const CATS = ['נופש משפחתי', 'סופ"ש', 'צימר', 'מלון', 'חו"ל', 'נופש נשים', 'אחר'];
const PAGE = 18;

const blank = () => ({
  title: '', category: 'נופש משפחתי', description: '', destination: '', dateFrom: '', dateTo: '', nights: 0, price: 0, priceNote: '',
  contactName: '', contactPhone: '', registrationPhone: '', link: '', image: '',
  scope: 'local', city: '', audience: '', audienceTags: [] as string[],
});

const fmt = (d?: string) => { if (!d) return ''; const x = new Date(d); return isNaN(+x) ? d : x.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }); };

const VacationsAdmin: React.FC<{ items: any[]; region: string; search: string; createTick: number; reload: () => void }> = ({ items, region, search, createTick, reload }) => {
  const [page, setPage] = useState(1);
  const [cat, setCat] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(blank());
  const [saving, setSaving] = useState(false);

  useOnCreate(createTick, () => { setForm(blank()); setOpen(true); });
  useEffect(() => { setPage(1); }, [region, search, cat]);

  const list = useMemo(() => items
    .filter(v => matchesRegion(v, region) && matchesSearch(search, v.title, v.destination, v.contactName, v.city))
    .filter(v => cat === 'all' || v.category === cat), [items, region, search, cat]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const set = (patch: any) => setForm((f: any) => ({ ...f, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.scope === 'local' && !form.city) { alert('נא לבחור עיר (או לסמן ארצי / מקוון)'); return; }
    const id = idOf(form);
    const data = { ...form };
    if (!id) { delete data._id; delete data.id; }
    const ok = await withSave(setSaving, async () => { if (id) await api.updateVacation(id, data); else await api.createVacation(data); }, id ? 'הנופש עודכן ✔' : 'הנופש נוסף ✔');
    if (ok) { setOpen(false); reload(); }
  };

  return (
    <div className="space-y-4">
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {['all', ...CATS].map(c => (
          <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] transition ${cat === c ? 'border-plum-600 bg-plum-600 text-white' : 'border-rose-100 bg-white text-slate-600'}`}>{c === 'all' ? 'הכול' : c}</button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<Palmtree size={26} />} title="אין נופשים להצגה" text="אפשר להוסיף נופש חדש או לשנות את הסינון."
          action={<button onClick={() => { setForm(blank()); setOpen(true); }} className="btn-primary"><Plus size={16} /> נופש חדש</button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.slice((page - 1) * PAGE, page * PAGE).map(v => (
            <ItemCard key={idOf(v)} image={v.image} title={v.title} onClick={() => { setForm({ ...blank(), ...v }); setOpen(true); }}
              badges={<>{v.category && <Badge tone="plum">{v.category}</Badge>}{v.dateFrom && <Badge tone="slate">{fmt(v.dateFrom)}{v.dateTo ? ` – ${fmt(v.dateTo)}` : ''}</Badge>}</>}
              meta={<>
                {v.destination && <p className="flex items-center gap-1.5"><MapPin size={13} className="text-rose-400" /> {v.destination}</p>}
                {v.registrationPhone && <p className="flex items-center gap-1.5" dir="rtl"><Phone size={13} className="text-rose-400" /> הרשמה: <span dir="ltr">{v.registrationPhone}</span></p>}
                {v.price ? <p>₪{v.price}{v.priceNote ? ` · ${v.priceNote}` : ''}</p> : null}
              </>}
              tags={<LocationBadges item={v} showAudience />}
              actions={<>
                <span className="ml-auto" />
                <IconButton onClick={() => { setForm({ ...blank(), ...v }); setOpen(true); }} aria-label="עריכה"><Pencil size={15} /></IconButton>
                <DeleteButton name={v.title} onConfirm={async () => { await api.deleteVacation(idOf(v)); reload(); }} />
              </>}
            />
          ))}
        </div>
      )}
      <Pager page={page} total={pages} onPage={setPage} />

      <Sheet open={open} onClose={() => setOpen(false)} title={idOf(form) ? 'עריכת נופש' : 'נופש חדש'} subtitle="שדות עם * הם חובה" wide
        footer={<SaveBar formId="vacation-form" saving={saving} onCancel={() => setOpen(false)} label={idOf(form) ? 'שמירת שינויים' : 'פרסום הנופש'} />}>
        <form id="vacation-form" onSubmit={save} className="space-y-4">
          <FormSection title="פרטי הנופש" icon={<Info size={17} />}>
            <Field label="שם הנופש" required><input required className={inputCls} value={form.title} onChange={e => set({ title: e.target.value })} placeholder="למשל: סופ״ש מפנק בצפון" /></Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="סוג"><select className={inputCls} value={form.category || ''} onChange={e => set({ category: e.target.value })}>{CATS.map(c => <option key={c}>{c}</option>)}</select></Field>
              <Field label="יעד / מקום"><input className={inputCls} value={form.destination || ''} onChange={e => set({ destination: e.target.value })} placeholder="למשל: טבריה, צימרים בגליל" /></Field>
            </div>
            <Field label="תיאור"><textarea rows={4} className={inputCls} value={form.description || ''} onChange={e => set({ description: e.target.value })} /></Field>
          </FormSection>
          <FormSection title="מתי ובכמה" icon={<Calendar size={17} />}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="מתאריך"><input type="date" className={inputCls} value={form.dateFrom || ''} onChange={e => set({ dateFrom: e.target.value })} /></Field>
              <Field label="עד תאריך"><input type="date" className={inputCls} value={form.dateTo || ''} onChange={e => set({ dateTo: e.target.value })} /></Field>
              <Field label="מספר לילות"><input type="number" min={0} className={inputCls} value={form.nights ?? 0} onChange={e => set({ nights: Number(e.target.value) })} /></Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="מחיר (₪)"><input type="number" min={0} className={inputCls} value={form.price ?? 0} onChange={e => set({ price: Number(e.target.value) })} /></Field>
              <Field label="הערה למחיר" hint="למשל: לזוג, כולל ארוחות"><input className={inputCls} value={form.priceNote || ''} onChange={e => set({ priceNote: e.target.value })} /></Field>
            </div>
          </FormSection>
          <FormSection title="יצירת קשר והרשמה" icon={<Phone size={17} />}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="איש קשר"><input className={inputCls} value={form.contactName || ''} onChange={e => set({ contactName: e.target.value })} /></Field>
              <Field label="טלפון להרשמה" hint="יוצג באתר עם כפתור וואטסאפ"><input dir="ltr" className={`${inputCls} text-left`} value={form.registrationPhone || ''} onChange={e => set({ registrationPhone: e.target.value })} /></Field>
              <Field label="טלפון איש הקשר"><input dir="ltr" className={`${inputCls} text-left`} value={form.contactPhone || ''} onChange={e => set({ contactPhone: e.target.value })} /></Field>
            </div>
            <Field label="קישור לפרטים או הרשמה"><input dir="ltr" className={`${inputCls} text-left`} value={form.link || ''} onChange={e => set({ link: e.target.value })} placeholder="https://" /></Field>
          </FormSection>
          <LocationFields value={form} onChange={set} withAudience />
          <FormSection title="תמונה" icon={<Sparkles size={17} />}><ImagePicker label="תמונת הנופש" value={form.image} onChange={image => set({ image })} /></FormSection>
        </form>
      </Sheet>
    </div>
  );
};

export default VacationsAdmin;
