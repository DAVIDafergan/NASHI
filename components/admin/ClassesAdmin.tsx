import React, { useEffect, useMemo, useState } from 'react';
import { Clock, GraduationCap, Info, Pencil, Phone, Plus, Sparkles, User as UserIcon } from 'lucide-react';
import { api } from '../../services/api';
import {
  Badge, DeleteButton, EmptyState, Field, FormSection, IconButton, ImagePicker, ItemCard, LocationBadges, LocationFields,
  Pager, SaveBar, Sheet, idOf, inputCls, matchesRegion, matchesSearch, withSave, useOnCreate,
} from './ui';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'מוצאי שבת'];
const CATS = ['יצירה', 'ריקוד ותנועה', 'מוזיקה', 'העשרה', 'תורה ויהדות', 'כושר', 'בישול', 'אחר'];
const PAGE = 18;

const blank = () => ({
  title: '', instructor: '', contactPhone: '', registrationPhone: '', day: 'ראשון', time: '', location: '', price: 0,
  ageGroup: '', gender: '', category: 'יצירה', exceptions: '', image: '', scope: 'local', city: '', onlineLink: '', audience: '', audienceTags: [] as string[],
});

const ClassesAdmin: React.FC<{ classes: any[]; region: string; search: string; createTick: number; reload: () => void }> = ({ classes, region, search, createTick, reload }) => {
  const [page, setPage] = useState(1);
  const [day, setDay] = useState('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(blank());
  const [saving, setSaving] = useState(false);

  useOnCreate(createTick, () => { setForm(blank()); setOpen(true); });
  useEffect(() => { setPage(1); }, [region, search, day]);

  const list = useMemo(() => classes
    .filter(c => matchesRegion(c, region) && matchesSearch(search, c.title, c.instructor, c.location, c.city))
    .filter(c => day === 'all' || c.day === day), [classes, region, search, day]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const set = (patch: any) => setForm((f: any) => ({ ...f, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.scope === 'local' && !form.city) { alert('נא לבחור עיר (או לסמן ארצי / מקוון)'); return; }
    const id = idOf(form);
    const data = { ...form };
    if (!id) { delete data._id; delete data.id; }
    const ok = await withSave(setSaving, async () => { if (id) await api.updateClass(id, data); else await api.createClass(data); }, id ? 'החוג עודכן ✔' : 'החוג נוסף ✔');
    if (ok) { setOpen(false); reload(); }
  };

  return (
    <div className="space-y-4">
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {['all', ...DAYS].map(d => (
          <button key={d} onClick={() => setDay(d)} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] transition ${day === d ? 'border-plum-600 bg-plum-600 text-white' : 'border-rose-100 bg-white text-slate-600'}`}>{d === 'all' ? 'כל הימים' : `יום ${d}`}</button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<GraduationCap size={26} />} title="אין חוגים להצגה" text="אפשר להוסיף חוג חדש או לשנות את הסינון."
          action={<button onClick={() => { setForm(blank()); setOpen(true); }} className="btn-primary"><Plus size={16} /> חוג חדש</button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.slice((page - 1) * PAGE, page * PAGE).map(c => (
            <ItemCard key={idOf(c)} image={c.image} title={c.title} onClick={() => { setForm({ ...blank(), ...c }); setOpen(true); }}
              badges={<>{c.day && <Badge tone="plum">יום {c.day}{c.time ? ` · ${c.time}` : ''}</Badge>}{c.gender && <Badge tone="slate">{c.gender}</Badge>}</>}
              meta={<>
                {c.instructor && <p className="flex items-center gap-1.5"><UserIcon size={13} className="text-rose-400" /> {c.instructor}</p>}
                {c.registrationPhone && <p className="flex items-center gap-1.5" dir="rtl"><Phone size={13} className="text-rose-400" /> הרשמה: <span dir="ltr">{c.registrationPhone}</span></p>}
                {c.price ? <p>₪{c.price} לחודש</p> : null}
              </>}
              tags={<LocationBadges item={c} showAudience />}
              actions={<>
                <span className="ml-auto" />
                <IconButton onClick={() => { setForm({ ...blank(), ...c }); setOpen(true); }} aria-label="עריכה"><Pencil size={15} /></IconButton>
                <DeleteButton name={c.title} onConfirm={async () => { await api.deleteClass(idOf(c)); reload(); }} />
              </>}
            />
          ))}
        </div>
      )}
      <Pager page={page} total={pages} onPage={setPage} />

      <Sheet open={open} onClose={() => setOpen(false)} title={idOf(form) ? 'עריכת חוג' : 'חוג חדש'} subtitle="שדות עם * הם חובה" wide
        footer={<SaveBar formId="class-form" saving={saving} onCancel={() => setOpen(false)} label={idOf(form) ? 'שמירת שינויים' : 'פרסום החוג'} />}>
        <form id="class-form" onSubmit={save} className="space-y-4">
          <FormSection title="פרטי החוג" icon={<Info size={17} />}>
            <Field label="שם החוג" required><input required className={inputCls} value={form.title} onChange={e => set({ title: e.target.value })} placeholder="למשל: ציור באקוורל" /></Field>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="תחום"><select className={inputCls} value={form.category || ''} onChange={e => set({ category: e.target.value })}>{CATS.map(c => <option key={c}>{c}</option>)}</select></Field>
              <Field label="קבוצה" hint="לא חובה — קהל היעד נבחר למטה"><select className={inputCls} value={form.gender || ''} onChange={e => set({ gender: e.target.value })}><option value="">—</option><option>גברים</option><option>נשים</option><option>בנים</option><option>בנות</option><option>משפחות</option></select></Field>
              <Field label="גילאים"><input className={inputCls} value={form.ageGroup || ''} onChange={e => set({ ageGroup: e.target.value })} placeholder="למשל: 8-12" /></Field>
            </div>
          </FormSection>
          <FormSection title="מתי ובכמה" icon={<Clock size={17} />}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="יום בשבוע"><select className={inputCls} value={form.day || 'ראשון'} onChange={e => set({ day: e.target.value })}>{DAYS.map(d => <option key={d}>{d}</option>)}</select></Field>
              <Field label="שעה"><input type="time" className={inputCls} value={form.time || ''} onChange={e => set({ time: e.target.value })} /></Field>
              <Field label="מחיר חודשי (₪)"><input type="number" min={0} className={inputCls} value={form.price ?? 0} onChange={e => set({ price: Number(e.target.value) })} /></Field>
            </div>
            <Field label="חריגים / הערות" hint="למשל: אין חוג בחול המועד"><input className={inputCls} value={form.exceptions || ''} onChange={e => set({ exceptions: e.target.value })} /></Field>
          </FormSection>
          <FormSection title="מדריכה ויצירת קשר" icon={<Phone size={17} />}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="שם המדריכה"><input className={inputCls} value={form.instructor || ''} onChange={e => set({ instructor: e.target.value })} /></Field>
              <Field label="טלפון להרשמה" hint="יוצג באתר עם כפתור וואטסאפ"><input dir="ltr" className={`${inputCls} text-left`} value={form.registrationPhone || ''} onChange={e => set({ registrationPhone: e.target.value })} /></Field>
              <Field label="טלפון המדריכה"><input dir="ltr" className={`${inputCls} text-left`} value={form.contactPhone || ''} onChange={e => set({ contactPhone: e.target.value })} /></Field>
            </div>
          </FormSection>
          <LocationFields value={form} onChange={set} withAudience />
          <FormSection title="איפה בדיוק"><Field label="מקום / כתובת"><input className={inputCls} value={form.location || ''} onChange={e => set({ location: e.target.value })} placeholder="למשל: מתנ״ס מרכז, חדר 3" /></Field></FormSection>
          <FormSection title="תמונה" icon={<Sparkles size={17} />}><ImagePicker label="תמונת החוג" value={form.image} onChange={image => set({ image })} /></FormSection>
        </form>
      </Sheet>
    </div>
  );
};

export default ClassesAdmin;
