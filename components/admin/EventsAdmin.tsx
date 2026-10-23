import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, Copy, Info, Pencil, Plus, Sparkles, Star, Ticket, Trash2, Wallet, Users } from 'lucide-react';
import { api } from '../../services/api';
import {
  Badge, DeleteButton, EmptyState, Field, FormSection, IconButton, ImagePicker, ItemCard, LocationBadges, LocationFields,
  Pager, SaveBar, Segmented, Sheet, Toggle, fmtDate, idOf, inputCls, matchesRegion, matchesSearch, withSave, useOnCreate, AdminScopeContext, API_BASE, authHeaders } from './ui';
import { isEventPast } from '../../shared/eventTime';

const CATEGORIES = ['מוזיקה', 'העשרה', 'סדנאות', 'קהילה', 'בידור', 'אופנה', 'תורה ויהדות', 'אחר'];
const PAGE = 18;

const blank = () => ({
  title: '', category: 'מוזיקה', description: '', image: '', logo: '', date: '', time: '', hebrewDate: '', location: '',
  price: 0, earlyBirdPrice: 0, earlyBirdEndDate: '', ticketLink: '', registrationLink: '', sessions: [] as { name: string; date: string }[],
  isHero: false, targetAges: '', notes: '', scope: 'local', city: '', onlineLink: '', audience: [] as string[],
});

const dateOnly = (d?: string) => (d ? String(d).split('T')[0] : '');

const EventsAdmin: React.FC<{ events: any[]; region: string; search: string; createTick: number; reload: () => void }> = ({ events, region, search, createTick, reload }) => {
  const { lockRegion } = React.useContext(AdminScopeContext);
  const [when, setWhen] = useState<'upcoming' | 'past' | 'all' | 'archive'>('upcoming');
  // ארכיון: events that ended more than 48h ago (hidden from the site; manual ones are kept here)
  const [archive, setArchive] = useState<any[] | null>(null);
  useEffect(() => {
    if (when !== 'archive' || archive) return;
    fetch(`${API_BASE}/admin/events/archive`, { headers: authHeaders() }).then(r => r.ok ? r.json() : []).then(a => setArchive(Array.isArray(a) ? a : [])).catch(() => setArchive([]));
  }, [when, archive]);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(blank());
  const [saving, setSaving] = useState(false);

  useOnCreate(createTick, () => { setForm(blank()); setOpen(true); });
  useEffect(() => { setPage(1); }, [region, search, when]);

  const isPast = (e: any) => isEventPast(e);

  const list = useMemo(() => (when === 'archive' ? (archive || []) : events)
    .filter(e => matchesRegion(e, region) && matchesSearch(search, e.title, e.location, e.city, e.category))
    .filter(e => when === 'all' || when === 'archive' ? true : when === 'past' ? isPast(e) : !isPast(e))
    .sort((a, b) => (when === 'past' ? -1 : 1) * (+new Date(a.date || 0) - +new Date(b.date || 0))), [events, archive, region, search, when]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const shown = list.slice((page - 1) * PAGE, page * PAGE);
  const set = (patch: any) => setForm((f: any) => ({ ...f, ...patch }));

  const edit = (e: any) => { setForm({ ...blank(), ...e, date: dateOnly(e.date), earlyBirdEndDate: dateOnly(e.earlyBirdEndDate), sessions: (e.sessions || []).map((s: any) => ({ ...s, date: dateOnly(s.date) })) }); setOpen(true); };
  const duplicate = (e: any) => { const { _id, id, attendees, createdAt, ...rest } = e; setForm({ ...blank(), ...rest, title: `${e.title} (העתק)`, date: '', sessions: [] }); setOpen(true); };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (form.scope === 'local' && !form.city) { alert('נא לבחור עיר (או לסמן ארצי / מקוון)'); return; }
    const id = idOf(form);
    const data = { ...form };
    if (!id) { delete data._id; delete data.id; }
    const ok = await withSave(setSaving, async () => { if (id) await api.updateEvent(id, data); else await api.createEvent(data); }, id ? 'האירוע עודכן ✔' : 'האירוע נוסף ✔');
    if (ok) { setOpen(false); reload(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full max-w-sm">
          <Segmented value={when} onChange={(v) => setWhen(v as any)} options={[{ id: 'upcoming', label: 'קרובים' }, { id: 'past', label: 'עברו (48 ש׳)' }, { id: 'all', label: 'הכול' }, { id: 'archive', label: 'ארכיון' }]} />
        </div>
        <span className="text-sm text-slate-500">{list.length} אירועים{when === 'archive' ? ' · מוסתרים מהאתר' : when === 'past' ? ' · יוסרו מהאתר 48 שעות אחרי שהסתיימו' : ''}</span>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<Calendar size={26} />} title={when === 'upcoming' ? 'אין אירועים קרובים' : 'אין אירועים להצגה'} text="אפשר ליצור אירוע חדש, או לשנות את הסינון למעלה."
          action={<button onClick={() => { setForm(blank()); setOpen(true); }} className="btn-primary"><Plus size={16} /> אירוע חדש</button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map(e => (
            <ItemCard key={idOf(e)} image={e.image} title={e.title} onClick={() => edit(e)}
              badges={<>{e.isHero && <Badge tone="amber"><Star size={11} /> בבאנר הראשי</Badge>}{e.archived ? <Badge tone="slate">בארכיון</Badge> : isPast(e) && <Badge tone="slate">עבר</Badge>}</>}
              meta={<>
                <p className="flex items-center gap-1.5"><Calendar size={13} className="text-rose-400" /> {fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'long' })}{e.time ? ` · ${e.time}` : ''}{e.hebrewDate ? ` · ${e.hebrewDate}` : ''}</p>
                {e.location && <p className="truncate">{e.location}</p>}
              </>}
              tags={<LocationBadges item={e} showAudience />}
              actions={<>
                <span className="ml-auto" />
                {(e.attendees?.length || 0) > 0 && <Badge tone="green"><Users size={11} /> {e.attendees.length}</Badge>}
                <IconButton onClick={() => duplicate(e)} title="שכפול" aria-label="שכפול"><Copy size={15} /></IconButton>
                <IconButton onClick={() => edit(e)} title="עריכה" aria-label="עריכה"><Pencil size={15} /></IconButton>
                <DeleteButton name={e.title} onConfirm={async () => { await api.deleteEvent(idOf(e)); reload(); }} />
              </>}
            />
          ))}
        </div>
      )}
      <Pager page={page} total={pages} onPage={setPage} />

      <Sheet open={open} onClose={() => setOpen(false)} title={idOf(form) ? 'עריכת אירוע' : 'אירוע חדש'} subtitle="שדות עם * הם חובה" wide
        footer={<SaveBar formId="event-form" saving={saving} onCancel={() => setOpen(false)} label={idOf(form) ? 'שמירת שינויים' : 'פרסום האירוע'} />}>
        <form id="event-form" onSubmit={save} className="space-y-4">
          <FormSection title="פרטי האירוע" icon={<Info size={17} />}>
            <Field label="שם האירוע" required><input required className={inputCls} value={form.title} onChange={e => set({ title: e.target.value })} placeholder="למשל: ערב נשים עם הזמרת…" /></Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="קטגוריה">
                <select className={inputCls} value={form.category} onChange={e => set({ category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
              </Field>
              <Field label="גילאים / למי מיועד" hint="לא חובה"><input className={inputCls} value={form.targetAges} onChange={e => set({ targetAges: e.target.value })} placeholder="למשל: 16+" /></Field>
            </div>
            <Field label="תיאור" hint="מופיע בעמוד האירוע"><textarea rows={4} className={`${inputCls} resize-y`} value={form.description || ''} onChange={e => set({ description: e.target.value })} /></Field>
          </FormSection>

          <FormSection title="מתי" icon={<Clock size={17} />}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="תאריך" required><input required type="date" className={inputCls} value={form.date} onChange={e => set({ date: e.target.value })} /></Field>
              <Field label="שעה"><input type="time" className={inputCls} value={form.time || ''} onChange={e => set({ time: e.target.value })} /></Field>
              <Field label="תאריך עברי" hint="למשל: כ״ה בכסלו"><input className={inputCls} value={form.hebrewDate || ''} onChange={e => set({ hebrewDate: e.target.value })} /></Field>
            </div>
            <div className="rounded-2xl bg-rose-50/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-slate-700">מפגשים נוספים בסדרה</span>
                <button type="button" onClick={() => set({ sessions: [...(form.sessions || []), { name: '', date: '' }] })} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs text-rose-700 shadow-soft"><Plus size={13} /> מפגש</button>
              </div>
              {(form.sessions || []).length === 0 && <p className="text-xs text-slate-400">לאירוע של ערב אחד אין צורך במפגשים.</p>}
              <div className="space-y-2">
                {(form.sessions || []).map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-6 shrink-0 text-center font-accent text-xl text-rose-300">{i + 1}</span>
                    <input className={`${inputCls} !py-2`} placeholder="שם המפגש" value={s.name} onChange={e => set({ sessions: form.sessions.map((x: any, j: number) => j === i ? { ...x, name: e.target.value } : x) })} />
                    <input type="date" className={`${inputCls} !w-40 !py-2`} value={s.date} onChange={e => set({ sessions: form.sessions.map((x: any, j: number) => j === i ? { ...x, date: e.target.value } : x) })} />
                    <IconButton tone="danger" onClick={() => set({ sessions: form.sessions.filter((_: any, j: number) => j !== i) })} aria-label="הסרה"><Trash2 size={14} /></IconButton>
                  </div>
                ))}
              </div>
            </div>
          </FormSection>

          <LocationFields value={form} onChange={set} withAudience />
          <FormSection title="איפה בדיוק" subtitle="שם המקום והכתובת, כפי שיופיעו לנרשמות">
            <Field label="מקום / כתובת" required={form.scope !== 'online'}><input required={form.scope !== 'online'} className={inputCls} value={form.location} onChange={e => set({ location: e.target.value })} placeholder="למשל: אולם התרבות, רח׳ הרצל 5" /></Field>
          </FormSection>

          <FormSection title="תמונות" icon={<Sparkles size={17} />}>
            <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
              <ImagePicker label="תמונה / פוסטר ראשי" value={form.image} onChange={image => set({ image })} hint="פוסטר מלא מוצג במלואו בכרטיס" contain />
              <ImagePicker label="לוגו קטן (לא חובה)" value={form.logo} onChange={logo => set({ logo })} aspect="aspect-square" maxSide={600} contain />
            </div>
          </FormSection>

          <FormSection title="מחיר והרשמה" icon={<Wallet size={17} />}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="מחיר (₪)" hint="0 = חינם"><input type="number" min={0} className={inputCls} value={form.price ?? 0} onChange={e => set({ price: Number(e.target.value) })} /></Field>
              <Field label="מחיר מכירה מוקדמת"><input type="number" min={0} className={inputCls} value={form.earlyBirdPrice ?? 0} onChange={e => set({ earlyBirdPrice: Number(e.target.value) })} /></Field>
              <Field label="עד תאריך"><input type="date" className={inputCls} value={form.earlyBirdEndDate || ''} onChange={e => set({ earlyBirdEndDate: e.target.value })} /></Field>
            </div>
            <Field label="קישור לרכישת כרטיסים" hint="אם יש מערכת כרטיסים חיצונית"><input dir="ltr" className={`${inputCls} text-left`} value={form.ticketLink || ''} onChange={e => set({ ticketLink: e.target.value })} placeholder="https://…" /></Field>
            <Field label="הערות לנרשמות"><input className={inputCls} value={form.notes || ''} onChange={e => set({ notes: e.target.value })} placeholder="למשל: יש להביא תעודה מזהה" /></Field>
            {!lockRegion && <Toggle checked={!!form.isHero} onChange={isHero => set({ isHero })} label="להציג בבאנר הראשי בדף הבית" hint="מומלץ לאירוע אחד או שניים בכל פעם" />}
          </FormSection>
          {!lockRegion && <p className="flex items-center gap-1.5 px-1 text-xs text-slate-400"><Ticket size={13} /> כרטיסי כניסה עם ברקוד מפיקים בלשונית "כרטיסים".</p>}
        </form>
      </Sheet>
    </div>
  );
};

export default EventsAdmin;
