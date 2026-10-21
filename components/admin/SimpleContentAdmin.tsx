import React, { useEffect, useState } from 'react';
import { Bell, CalendarClock, ExternalLink, Image as ImageIcon, Megaphone, Pencil, Plus, Quote, Video } from 'lucide-react';
import { api } from '../../services/api';
import { Badge, DeleteButton, EmptyState, Field, FormSection, IconButton, ImagePicker, SaveBar, Segmented, Sheet, fmtDate, inputCls, matchesSearch, withSave, useOnCreate } from './ui';

/* ------------------------- inspirations ------------------------- */
const toLocalInput = (d?: string) => { if (!d) return ''; const t = new Date(d); if (isNaN(t.getTime())) return String(d); const p = (n: number) => String(n).padStart(2, '0'); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T${p(t.getHours())}:${p(t.getMinutes())}`; };

export const InspirationsAdmin: React.FC<{ items: any[]; search: string; createTick: number; reload: () => void }> = ({ items, search, createTick, reload }) => {
  const blank = { _id: '', text: '', author: '', scheduledAt: '' };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(blank);
  const [saving, setSaving] = useState(false);
  useOnCreate(createTick, () => { setForm(blank); setOpen(true); });
  const now = new Date();
  const list = items.filter(i => matchesSearch(search, i.text, i.author)).sort((a, b) => +new Date(b.scheduledAt || b.createdAt || 0) - +new Date(a.scheduledAt || a.createdAt || 0));
  const live = items.filter(i => !i.scheduledAt || new Date(i.scheduledAt) <= now).sort((a, b) => +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0))[0];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...form };
    if (!data._id) delete data._id;
    const ok = await withSave(setSaving, async () => { if (form._id) await api.updateInspiration(form._id, data); else await api.createInspiration(data); }, 'ההשראה נשמרה ✔');
    if (ok) { setOpen(false); reload(); }
  };

  return (
    <div className="space-y-4">
      {live && (
        <div className="rounded-[1.8rem] bg-rose-800 p-6 text-white shadow-lift">
          <p className="text-xs text-rose-200">מוצג עכשיו בדף הבית</p>
          <p className="mt-2 font-display text-2xl leading-snug">"{live.text}"</p>
          <p className="mt-2 text-sm text-rose-200">— {live.author}</p>
        </div>
      )}
      {list.length === 0 ? <EmptyState icon={<Quote size={24} />} title="אין עדיין השראות" action={<button onClick={() => { setForm(blank); setOpen(true); }} className="btn-primary"><Plus size={16} /> השראה חדשה</button>} /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map(i => {
            const scheduled = i.scheduledAt && new Date(i.scheduledAt) > now;
            return (
              <article key={i._id} className="flex flex-col rounded-[1.5rem] border border-rose-100 bg-white p-5 shadow-soft">
                <div className="mb-2 flex items-center justify-between">
                  <Quote size={22} className="text-rose-200" />
                  {scheduled ? <Badge tone="sky"><CalendarClock size={11} /> {fmtDate(i.scheduledAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Badge> : i === live ? <Badge tone="green">בדף הבית</Badge> : <Badge tone="slate">פורסמה</Badge>}
                </div>
                <p className="flex-1 font-display text-[17px] leading-snug text-ink">"{i.text}"</p>
                <div className="mt-3 flex items-center justify-between border-t border-rose-50 pt-3">
                  <span className="text-sm text-slate-500">— {i.author}</span>
                  <span className="flex gap-1.5">
                    <IconButton onClick={() => { setForm({ ...blank, ...i, scheduledAt: toLocalInput(i.scheduledAt) }); setOpen(true); }} aria-label="עריכה"><Pencil size={15} /></IconButton>
                    <DeleteButton name="ההשראה" onConfirm={async () => { await api.deleteInspiration(i._id); reload(); }} />
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={form._id ? 'עריכת השראה' : 'השראה חדשה'} footer={<SaveBar formId="insp-form" saving={saving} onCancel={() => setOpen(false)} />}>
        <form id="insp-form" onSubmit={save} className="space-y-4">
          <FormSection title="המשפט" icon={<Quote size={17} />}>
            <Field label="טקסט ההשראה" required><textarea required rows={4} className={`${inputCls} resize-y font-display text-lg`} value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} /></Field>
            <Field label="מי אמרה / אמר" required><input required className={inputCls} value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} placeholder="למשל: רבי נחמן מברסלב" /></Field>
            <Field label="תזמון פרסום" hint="ריק = עולה מיד. אפשר לתזמן השראה לכל יום בשבוע מראש."><input type="datetime-local" className={inputCls} value={form.scheduledAt || ''} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} /></Field>
          </FormSection>
        </form>
      </Sheet>
    </div>
  );
};

/* ------------------------- ads ------------------------- */
export const AdsAdmin: React.FC<{ items: any[]; createTick: number; reload: () => void }> = ({ items, createTick, reload }) => {
  const blank = { _id: '', type: 'image', content: '', link: '', title: '' };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(blank);
  const [saving, setSaving] = useState(false);
  useOnCreate(createTick, () => { setForm(blank); setOpen(true); });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.content) { alert(form.type === 'image' ? 'נא להעלות באנר' : 'נא להזין קישור לסרטון'); return; }
    const data = { ...form };
    if (!data._id) delete data._id;
    const ok = await withSave(setSaving, async () => { if (form._id) await api.updateAd(form._id, data); else await api.createAd(data); }, 'הפרסום נשמר ✔');
    if (ok) { setOpen(false); reload(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-[1.5rem] border border-sky-100 bg-sky-50/60 p-4 text-sm text-sky-900">
        <ImageIcon size={20} className="mt-0.5 shrink-0 text-sky-500" />
        <p>הפרסומות מתחלפות בדף הבית. גודל מומלץ: באנר רחב 1920×600, או ריבוע 1080×1080 למובייל.</p>
      </div>
      {items.length === 0 ? <EmptyState icon={<Megaphone size={24} />} title="אין פרסומות" action={<button onClick={() => { setForm(blank); setOpen(true); }} className="btn-primary"><Plus size={16} /> פרסום חדש</button>} /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map(ad => (
            <article key={ad._id} className="overflow-hidden rounded-[1.5rem] border border-rose-100 bg-white shadow-soft">
              {ad.type === 'image' ? <img src={ad.content} alt="" className="aspect-[16/7] w-full bg-rose-50 object-cover" /> : (
                <div className="flex aspect-[16/7] w-full flex-col items-center justify-center gap-2 bg-ink text-white"><Video size={30} /><span className="max-w-[80%] truncate text-xs text-white/60" dir="ltr">{ad.content}</span></div>
              )}
              <div className="flex items-center gap-2 p-4">
                <div className="min-w-0 flex-1">
                  <h4 className="truncate font-strong text-ink">{ad.title || 'ללא כותרת'}</h4>
                  {ad.link && <a href={ad.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-xs text-sky-600" dir="ltr"><ExternalLink size={11} /> {ad.link}</a>}
                </div>
                <IconButton onClick={() => { setForm({ ...blank, ...ad }); setOpen(true); }} aria-label="עריכה"><Pencil size={15} /></IconButton>
                <DeleteButton name={ad.title || 'הפרסום'} onConfirm={async () => { await api.deleteAd(ad._id); reload(); }} />
              </div>
            </article>
          ))}
        </div>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={form._id ? 'עריכת פרסום' : 'פרסום חדש'} footer={<SaveBar formId="ad-form" saving={saving} onCancel={() => setOpen(false)} label="פרסום באתר" />}>
        <form id="ad-form" onSubmit={save} className="space-y-4">
          <FormSection title="הפרסום" icon={<Megaphone size={17} />}>
            <Field label="שם הפרסום" required hint="לשימוש פנימי בלבד"><input required className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
            <Segmented value={form.type} onChange={(type) => setForm({ ...form, type, content: '' })} options={[{ id: 'image', label: 'באנר / תמונה', icon: <ImageIcon size={14} /> }, { id: 'video', label: 'סרטון (קישור)', icon: <Video size={14} /> }]} />
            {form.type === 'image'
              ? <ImagePicker label="הבאנר" value={form.content} onChange={content => setForm({ ...form, content })} maxSide={1920} contain />
              : <Field label="קישור לסרטון" required hint="YouTube / Vimeo"><input dir="ltr" className={`${inputCls} text-left`} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></Field>}
            <Field label="לאן לוחצים?" hint="קישור שנפתח בלחיצה על הפרסום (לא חובה)"><input dir="ltr" className={`${inputCls} text-left`} value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="https://…" /></Field>
          </FormSection>
        </form>
      </Sheet>
    </div>
  );
};

/* ------------------------- announcements ------------------------- */
export const AnnouncementsAdmin: React.FC<{ items: any[]; createTick: number; reload: () => void }> = ({ items, createTick, reload }) => {
  const blank = { _id: '', title: '', content: '' };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(blank);
  const [saving, setSaving] = useState(false);
  useOnCreate(createTick, () => { setForm(blank); setOpen(true); });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await withSave(setSaving, async () => { if (form._id) await api.updateAnnouncement(form._id, form); else await api.createAnnouncement(form); }, 'ההודעה נשמרה ✔');
    if (ok) { setOpen(false); reload(); }
  };
  return (
    <div className="space-y-4">
      {items.length === 0 ? <EmptyState icon={<Bell size={24} />} title="אין הודעות הנהלה" text="הודעות מופיעות בלוח המודעות בדף הבית." action={<button onClick={() => { setForm(blank); setOpen(true); }} className="btn-primary"><Plus size={16} /> הודעה חדשה</button>} /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map(a => (
            <article key={a._id} className="flex flex-col rounded-[1.5rem] border border-rose-100 bg-white p-5 shadow-soft">
              <div className="mb-2 flex items-center gap-2 text-rose-500"><Bell size={17} /><span className="text-xs text-slate-400">{fmtDate(a.createdAt)}</span></div>
              <h4 className="font-strong text-[16px] text-ink break-words">{a.title}</h4>
              <p className="mt-1 line-clamp-4 flex-1 whitespace-pre-line break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-slate-600">{a.content}</p>
              <div className="mt-3 flex justify-end gap-1.5 border-t border-rose-50 pt-3">
                <IconButton onClick={() => { setForm({ ...blank, ...a }); setOpen(true); }} aria-label="עריכה"><Pencil size={15} /></IconButton>
                <DeleteButton name={a.title} onConfirm={async () => { await api.deleteAnnouncement(a._id); reload(); }} />
              </div>
            </article>
          ))}
        </div>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={form._id ? 'עריכת הודעה' : 'הודעת הנהלה חדשה'} footer={<SaveBar formId="ann-form" saving={saving} onCancel={() => setOpen(false)} />}>
        <form id="ann-form" onSubmit={save} className="space-y-4">
          <FormSection title="ההודעה" icon={<Bell size={17} />}>
            <Field label="כותרת" required><input required className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="תוכן" required hint="אפשר לכתוב כמו בוואטסאפ: *טקסט מודגש*, קישורים ומספרי טלפון הופכים ללחיצים. הודעה ארוכה תוצג עם 'קראי עוד'."><textarea required rows={6} className={`${inputCls} resize-y`} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></Field>
          </FormSection>
        </form>
      </Sheet>
    </div>
  );
};
