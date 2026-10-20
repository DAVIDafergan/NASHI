import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Download, Gift, Info, Pencil, PlayCircle, Plus, Save, Target, Trophy, Users } from 'lucide-react';
import { api } from '../../services/api';
import {
  Badge, DeleteButton, EmptyState, Field, FormSection, IconButton, ImagePicker, ItemCard, LocationBadges, LocationFields,
  SaveBar, Sheet, Toggle, fmtDate, idOf, inputCls, matchesRegion, matchesSearch, toast, withSave, useOnCreate,
} from './ui';

const TYPES = [
  { id: 'everyone', label: 'כל הרשומות', hint: 'כל אחת יכולה להירשם' },
  { id: 'points', label: 'סף נקודות', hint: 'רק מי שצברה מספיק נקודות' },
  { id: 'mission', label: 'משימה', hint: 'נכנסות להגרלה אחרי שמסיימות משימה' },
  { id: 'link_only', label: 'קישור אישי', hint: 'רק מי שקיבלה קישור' },
];
const PRIZE_KEYS = ['prize', 'prize2', 'prize3', 'prize4', 'prize5', 'prize6', 'prize7'];
const blank = () => ({ title: '', prize: '', prize2: '', prize3: '', prize4: '', prize5: '', prize6: '', prize7: '', drawDate: '', image: '', minPointsToEnter: 0, participationType: 'everyone', missionText: '', scope: 'national', city: '' });
const toLocalInput = (d?: string) => { if (!d) return ''; const t = new Date(d); if (isNaN(t.getTime())) return String(d); const p = (n: number) => String(n).padStart(2, '0'); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T${p(t.getHours())}:${p(t.getMinutes())}`; };

const csv = (name: string, headers: string[], rows: any[][]) => {
  let c = 'data:text/csv;charset=utf-8,﻿' + headers.join(',') + '\n';
  rows.forEach(r => { c += r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',') + '\n'; });
  const a = document.createElement('a'); a.href = encodeURI(c); a.download = name; document.body.appendChild(a); a.click(); a.remove();
};

const LotteriesAdmin: React.FC<{ lotteries: any[]; region: string; search: string; createTick: number; reload: () => void }> = ({ lotteries, region, search, createTick, reload }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(blank());
  const [saving, setSaving] = useState(false);
  const [participants, setParticipants] = useState<{ open: boolean; title: string; list: any[] }>({ open: false, title: '', list: [] });
  const [shabbat, setShabbat] = useState({ prize: '', notes: '', isActive: true, winnerFamily: '' });
  const [shabbatEntries, setShabbatEntries] = useState<any[]>([]);
  const [shabbatSaving, setShabbatSaving] = useState(false);

  useOnCreate(createTick, () => { setForm(blank()); setOpen(true); });
  const loadShabbat = async () => {
    const [s, e] = await Promise.all([api.getShabbatLotterySettings().catch(() => null), api.getShabbatEntries().catch(() => [])]);
    if (s) setShabbat((x) => ({ ...x, ...s }));
    setShabbatEntries(Array.isArray(e) ? e : []);
  };
  useEffect(() => { loadShabbat(); }, []);

  const list = useMemo(() => lotteries.filter(l => matchesRegion(l, region) && matchesSearch(search, l.title, l.prize)).sort((a, b) => +new Date(b.drawDate || 0) - +new Date(a.drawDate || 0)), [lotteries, region, search]);
  const set = (patch: any) => setForm((f: any) => ({ ...f, ...patch }));
  const upcoming = (l: any) => l.drawDate && new Date(l.drawDate) > new Date();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.scope === 'local' && !form.city) { alert('נא לבחור עיר (או לסמן ארצי)'); return; }
    const id = idOf(form);
    const data = { ...form };
    if (!data._id) delete data._id;
    if (!id) delete data.id;
    const ok = await withSave(setSaving, async () => { if (id) await api.updateLottery(id, data); else await api.createLottery(data); }, 'ההגרלה נשמרה ✔');
    if (ok) { setOpen(false); reload(); }
  };

  const viewParticipants = async (l: any) => {
    const list = await api.getLotteryParticipants(idOf(l)).catch(() => []);
    setParticipants({ open: true, title: l.title, list: list || [] });
  };
  const runLive = async (l: any) => {
    if (!window.confirm(`להפעיל עכשיו את ההגרלה "${l.title}" בשידור חי? הזוכה תפורסם בדף הבית.`)) return;
    await api.runLotteryLive(idOf(l));
    toast('ההגרלה הופעלה 🎉');
    reload();
  };

  return (
    <div className="space-y-8">
      {/* regular lotteries */}
      {list.length === 0 ? (
        <EmptyState icon={<Gift size={26} />} title="אין הגרלות" text="הגרלות ומשימות מושכות נשים לחזור לאתר."
          action={<button onClick={() => { setForm(blank()); setOpen(true); }} className="btn-primary"><Plus size={16} /> הגרלה חדשה</button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map(l => (
            <ItemCard key={idOf(l)} image={l.image} title={l.title} onClick={() => { setForm({ ...blank(), ...l, drawDate: toLocalInput(l.drawDate) }); setOpen(true); }}
              badges={<>{upcoming(l) ? <Badge tone="green">פעילה</Badge> : <Badge tone="slate">הסתיימה</Badge>}<Badge tone={l.participationType === 'mission' ? 'amber' : 'plum'}>{TYPES.find(t => t.id === l.participationType)?.label || 'כולן'}</Badge></>}
              meta={<>
                <p className="flex items-center gap-1.5"><CalendarClock size={13} className="text-rose-400" /> הגרלה: {fmtDate(l.drawDate, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
                <p className="flex items-center gap-1.5"><Trophy size={13} className="text-amber-500" /> {l.prize}{PRIZE_KEYS.slice(1).filter(k => l[k]).length ? ` +${PRIZE_KEYS.slice(1).filter(k => l[k]).length} פרסים` : ''}</p>
                {l.participationType === 'mission' && l.missionText && <p className="line-clamp-2 text-amber-700">🎯 {l.missionText}</p>}
              </>}
              tags={<LocationBadges item={l} />}
              actions={<>
                <span className="ml-auto" />
                <IconButton onClick={() => viewParticipants(l)} title="משתתפות" aria-label="משתתפות"><Users size={15} /></IconButton>
                <IconButton onClick={() => runLive(l)} title="הפעלה בלייב" aria-label="הפעלה בלייב" tone="good"><PlayCircle size={15} /></IconButton>
                <IconButton onClick={() => { setForm({ ...blank(), ...l, drawDate: toLocalInput(l.drawDate) }); setOpen(true); }} aria-label="עריכה"><Pencil size={15} /></IconButton>
                <DeleteButton name={l.title} onConfirm={async () => { await api.deleteLottery(idOf(l)); reload(); }} />
              </>}
            />
          ))}
        </div>
      )}

      {/* shabbat table lottery */}
      <section className="overflow-hidden rounded-[2rem] border border-plum-100 bg-gradient-to-bl from-plum-50 via-white to-white p-5 shadow-soft md:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-plum-600 text-white text-xl">🕯️</span>
            <div>
              <h3 className="text-xl">הגרלת שולחן השבת</h3>
              <p className="text-xs text-slate-500">נשים מעלות תמונה של שולחן השבת, ואחת זוכה בכל שבוע</p>
            </div>
          </div>
          <Badge tone={shabbat.isActive ? 'green' : 'slate'}>{shabbat.isActive ? 'פעילה' : 'כבויה'}</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
          <Field label="הפרס השבוע"><input className={inputCls} value={shabbat.prize} onChange={e => setShabbat({ ...shabbat, prize: e.target.value })} placeholder="למשל: סט פמוטים" /></Field>
          <Field label="הנחיה / כותרת"><input className={inputCls} value={shabbat.notes} onChange={e => setShabbat({ ...shabbat, notes: e.target.value })} placeholder="העלי תמונה של שולחן השבת שלך…" /></Field>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <Toggle checked={!!shabbat.isActive} onChange={isActive => setShabbat({ ...shabbat, isActive })} label="ההגרלה פתוחה להשתתפות" />
          <button onClick={() => withSave(setShabbatSaving, () => api.updateShabbatLotterySettings(shabbat), 'הגדרות השבת נשמרו ✔')} disabled={shabbatSaving} className="btn-ghost"><Save size={16} /> שמירה</button>
          <button onClick={async () => {
            if (!window.confirm('להגריל עכשיו את הזוכה בשולחן השבת?')) return;
            try { const res = await api.runShabbatLottery(); toast(`מזל טוב למשפחת ${res.winnerFamily} 🎉`); loadShabbat(); }
            catch (e: any) { toast(e?.response?.data?.error || e?.message || 'שגיאה בהפעלה', 'bad'); }
          }} className="btn-primary"><PlayCircle size={16} /> הגרלה עכשיו</button>
        </div>
        {shabbat.winnerFamily && <p className="mt-3 text-sm text-plum-700">הזוכה האחרונה: משפחת {shabbat.winnerFamily}</p>}

        <div className="mt-6 rounded-[1.5rem] border border-plum-100 bg-white">
          <div className="flex items-center justify-between border-b border-plum-50 px-4 py-3">
            <h4 className="font-strong text-ink">משתתפות השבוע ({shabbatEntries.length})</h4>
            <button onClick={() => csv('shabbat_participants.csv', ['שם משפחה', 'טלפון', 'תאריך הרשמה'], shabbatEntries.map(p => [p.familyName, p.phone, fmtDate(p.createdAt)]))} disabled={!shabbatEntries.length} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"><Download size={13} /> ייצוא לאקסל</button>
          </div>
          {shabbatEntries.length === 0 ? <p className="p-6 text-center text-sm text-slate-400">עוד אין משתתפות השבוע</p> : (
            <ul className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {shabbatEntries.map((p, i) => (
                <li key={i} className="flex items-center gap-3 rounded-2xl bg-plum-50/40 p-2">
                  {p.image ? <a href={p.image} target="_blank" rel="noreferrer"><img src={p.image} alt="" className="h-12 w-12 rounded-xl object-cover" /></a> : <span className="h-12 w-12 rounded-xl bg-plum-100" />}
                  <span className="min-w-0">
                    <span className="block truncate font-strong text-sm text-ink">משפחת {p.familyName}</span>
                    <span className="block text-xs text-slate-500" dir="ltr">{p.phone}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* form */}
      <Sheet open={open} onClose={() => setOpen(false)} title={idOf(form) ? 'עריכת הגרלה' : 'הגרלה חדשה'} subtitle="שדות עם * הם חובה" wide
        footer={<SaveBar formId="lottery-form" saving={saving} onCancel={() => setOpen(false)} label="שמירה ופרסום" />}>
        <form id="lottery-form" onSubmit={save} className="space-y-4">
          <FormSection title="פרטי ההגרלה" icon={<Info size={17} />}>
            <Field label="שם ההגרלה" required><input required className={inputCls} value={form.title} onChange={e => set({ title: e.target.value })} /></Field>
            <Field label="מועד ההגרלה" required hint="ההגרלה נסגרת להרשמה במועד הזה"><input required type="datetime-local" className={inputCls} value={form.drawDate || ''} onChange={e => set({ drawDate: e.target.value })} /></Field>
          </FormSection>
          <FormSection title="פרסים" icon={<Trophy size={17} />} subtitle="פרס ראשון חובה, השאר לא חובה">
            {PRIZE_KEYS.map((k, i) => (
              <div key={k} className="flex items-center gap-2">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-accent text-xl ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-rose-50 text-rose-400'}`}>{i + 1}</span>
                <input required={i === 0} className={inputCls} placeholder={i === 0 ? 'פרס ראשון *' : `פרס ${i + 1}`} value={form[k] || ''} onChange={e => set({ [k]: e.target.value })} />
              </div>
            ))}
          </FormSection>
          <FormSection title="מי יכולה להשתתף" icon={<Target size={17} />}>
            <div className="grid gap-2 sm:grid-cols-2">
              {TYPES.map(t => (
                <button key={t.id} type="button" onClick={() => set({ participationType: t.id })} className={`rounded-2xl border p-3 text-right transition ${form.participationType === t.id ? 'border-rose-600 bg-rose-50 ring-2 ring-rose-100' : 'border-rose-100 bg-white hover:border-rose-300'}`}>
                  <span className="block font-strong text-[14px] text-ink">{t.label}</span>
                  <span className="text-xs text-slate-500">{t.hint}</span>
                </button>
              ))}
            </div>
            {form.participationType === 'points' && <Field label="כמה נקודות צריך?"><input type="number" min={0} className={inputCls} value={form.minPointsToEnter ?? 0} onChange={e => set({ minPointsToEnter: Number(e.target.value) })} /></Field>}
            {form.participationType === 'mission' && <Field label="מה המשימה?" required hint="למשל: סיום ספר תהילים"><textarea required rows={3} className={`${inputCls} resize-y`} value={form.missionText || ''} onChange={e => set({ missionText: e.target.value })} /></Field>}
          </FormSection>
          <LocationFields value={form} onChange={set} withOnline={false} />
          <FormSection title="תמונת הפרס"><ImagePicker label="תמונה" value={form.image} onChange={image => set({ image })} /></FormSection>
        </form>
      </Sheet>

      <Sheet open={participants.open} onClose={() => setParticipants(p => ({ ...p, open: false }))} title="משתתפות בהגרלה" subtitle={participants.title}
        footer={<button onClick={() => csv('lottery_participants.csv', ['שם', 'טלפון', 'מייל'], participants.list.map(p => [p.name, p.phone, p.email]))} disabled={!participants.list.length} className="btn-ghost w-full"><Download size={16} /> ייצוא לאקסל</button>}>
        {participants.list.length === 0 ? <EmptyState icon={<Users size={24} />} title="עוד אין משתתפות" /> : (
          <ul className="divide-y divide-rose-50 rounded-2xl bg-white">
            {participants.list.map((p, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-3"><span className="font-strong text-ink">{p.name}</span><span className="text-sm text-slate-500" dir="ltr">{p.phone}</span></li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  );
};

export default LotteriesAdmin;
