import React, { useState } from 'react';
import { Award, Check, Clock, Download, Eye, Heart, Image as ImageIcon, Loader2, MessageSquare, Send, Settings, ShieldCheck, Sparkles, Ticket as TicketIcon } from 'lucide-react';
import { api } from '../../services/api';
import { API_BASE, Badge, DeleteButton, EmptyState, Field, FormSection, ImagePicker, SectionTitle, authHeaders, fmtDate, idOf, inputCls, toast, withSave } from './ui';
import { loadImage } from '../../utils/image';
import { BRAND } from '../../shared/brand';

/* ------------------------- forum ------------------------- */
export const ForumAdmin: React.FC<{ pending: any[]; posts: any[]; search: string; reload: () => void }> = ({ pending, posts, search, reload }) => {
  const q = search.trim();
  const list = posts.filter(p => !q || [p.title, p.content, p.authorName].some(f => String(f || '').includes(q)));
  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <section>
          <SectionTitle title="ממתינים לאישור" count={pending.length} icon={<Clock size={18} />} />
          <ul className="grid gap-3 md:grid-cols-2">
            {pending.map(p => (
              <li key={p._id} className="rounded-[1.4rem] border border-amber-100 bg-white p-4 shadow-soft">
                <p className="text-xs text-slate-400">{p.author?.name || p.authorName}</p>
                <h4 className="font-strong text-ink">{p.title}</h4>
                <p className="mt-1 line-clamp-3 text-sm text-slate-600">{p.content}</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => api.approvePost(p._id).then(() => { toast('פורסם ✔'); reload(); })} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm text-white"><Check size={14} /> פרסום</button>
                  <DeleteButton name={p.title} label="דחייה" onConfirm={async () => { await api.deletePost(p._id); reload(); }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <SectionTitle title="דיונים פעילים" count={list.length} icon={<MessageSquare size={18} />} />
        {list.length === 0 ? <EmptyState icon={<MessageSquare size={24} />} title="אין דיונים בפורום" /> : (
          <ul className="space-y-2.5">
            {list.map(p => (
              <li key={p._id} className="flex items-start gap-3 rounded-[1.4rem] border border-rose-100 bg-white p-4 shadow-soft">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-400">{p.authorName} · {fmtDate(p.createdAt)}</p>
                  <h4 className="font-strong text-[15px] text-ink">{p.title}</h4>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{p.content}</p>
                  <div className="mt-2 flex gap-2">
                    <Badge tone="rose"><Heart size={10} /> {p.likes?.length || 0}</Badge>
                    <Badge tone="slate"><MessageSquare size={10} /> {p.comments?.length || 0}</Badge>
                  </div>
                </div>
                <DeleteButton name={p.title} onConfirm={async () => { await api.deletePost(p._id); reload(); }} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

/* ------------------------- tickets ------------------------- */
export const TicketsAdmin: React.FC<{ tickets: any[]; events: any[]; reload: () => void }> = ({ tickets, events, reload }) => {
  const [form, setForm] = useState({ eventId: '', backgroundImage: '' });
  const [busy, setBusy] = useState(false);
  const generate = async () => {
    if (!form.eventId || !form.backgroundImage) { alert('נא לבחור אירוע ולהעלות עיצוב לכרטיס'); return; }
    setBusy(true);
    try {
      const code = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const verifyUrl = `${window.location.origin}/#/verify/${code}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(verifyUrl)}&margin=0`;
      const [bg, qr] = await Promise.all([loadImage(form.backgroundImage), loadImage(qrUrl)]);
      const canvas = document.createElement('canvas');
      canvas.width = bg.width; canvas.height = bg.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(bg, 0, 0);
      const size = Math.floor(canvas.width * 0.2), pad = 30;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      (ctx as any).roundRect ? (ctx as any).roundRect(pad - 10, canvas.height - size - pad - 10, size + 20, size + 20, 15) : ctx.rect(pad - 10, canvas.height - size - pad - 10, size + 20, size + 20);
      ctx.fill();
      ctx.drawImage(qr, pad, canvas.height - size - pad, size, size);
      await api.createTicket({ eventId: form.eventId, code, image: canvas.toDataURL('image/jpeg', 0.9) });
      toast('הכרטיס נוצר ✔ אפשר להוריד ולשלוח');
      setForm({ eventId: '', backgroundImage: '' });
      reload();
    } catch (e) {
      console.error(e);
      toast('יצירת הכרטיס נכשלה, כדאי לנסות שוב', 'bad');
    } finally { setBusy(false); }
  };
  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <FormSection title="כרטיס חדש" subtitle="מעלים עיצוב, והברקוד נוסף אוטומטית בפינה" icon={<TicketIcon size={17} />}>
          <Field label="לאיזה אירוע?" required>
            <select className={inputCls} value={form.eventId} onChange={e => setForm({ ...form, eventId: e.target.value })}>
              <option value="">בחירת אירוע…</option>
              {events.map(ev => <option key={idOf(ev)} value={idOf(ev)}>{ev.title} · {fmtDate(ev.date)}</option>)}
            </select>
          </Field>
          <ImagePicker label="עיצוב הכרטיס (בלי ברקוד)" value={form.backgroundImage} onChange={backgroundImage => setForm({ ...form, backgroundImage })} maxSide={2000} contain />
          <button onClick={generate} disabled={busy} className="btn-primary w-full !py-3.5 disabled:opacity-60">{busy ? <Loader2 size={17} className="animate-spin" /> : <TicketIcon size={17} />} יצירת כרטיס</button>
        </FormSection>
        <div className="rounded-[1.6rem] border border-emerald-100 bg-emerald-50/50 p-5">
          <h4 className="mb-3 flex items-center gap-2 font-strong text-ink"><ShieldCheck size={18} className="text-emerald-600" /> איך זה עובד</h4>
          <ol className="list-inside list-decimal space-y-2 text-sm leading-relaxed text-slate-600">
            <li>מעצבים כרטיס יפה בלי ברקוד ומעלים אותו לכאן.</li>
            <li>המערכת מייצרת קוד ייחודי שאי אפשר לנחש, ומדביקה ברקוד על העיצוב.</li>
            <li>מורידים את הכרטיס ושולחים לנרשמים.</li>
            <li>בכניסה סורקים: ירוק = בתוקף, אדום = כבר נוצל.</li>
          </ol>
        </div>
      </div>
      <section>
        <SectionTitle title="כרטיסים שהופקו" count={tickets.length} />
        {tickets.length === 0 ? <p className="rounded-2xl bg-white/70 p-6 text-center text-sm text-slate-400">עוד לא הופקו כרטיסים.</p> : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {tickets.map(t => (
              <article key={t._id} className="overflow-hidden rounded-[1.4rem] border border-rose-100 bg-white shadow-soft">
                <div className="relative bg-rose-50"><img src={t.image} alt="" className="h-auto w-full object-contain" /><span className="absolute right-2 top-2">{t.isUsed ? <Badge tone="red">נוצל</Badge> : <Badge tone="green">בתוקף</Badge>}</span></div>
                <div className="space-y-2 p-3">
                  <p className="truncate text-xs text-slate-500">{t.eventId?.title || 'אירוע שנמחק'}</p>
                  {t.isUsed && t.usedAt && <p className="text-[11px] text-red-500">נוצל: {fmtDate(t.usedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}
                  <div className="flex items-center gap-1.5">
                    <a href={t.image} download={`ticket-${t.code}.jpg`} className="inline-flex flex-1 items-center justify-center gap-1 rounded-full border border-rose-100 py-2 text-xs text-rose-700 hover:bg-rose-50"><Download size={13} /> הורדה</a>
                    <DeleteButton name="הכרטיס" onConfirm={async () => { await api.deleteTicket(t._id); reload(); }} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

/* ------------------------- broadcast ------------------------- */
export const BroadcastAdmin: React.FC<{ recipients: number }> = ({ recipients }) => {
  const [form, setForm] = useState({ subject: '', content: '', image: '', logo: '' });
  const [testEmail, setTestEmail] = useState('');
  const [busy, setBusy] = useState<'' | 'test' | 'all'>('');
  const send = async (isTest: boolean) => {
    if (!form.subject || !form.content) { alert('נא למלא נושא ותוכן'); return; }
    if (isTest && !testEmail) { alert('נא להזין מייל לבדיקה'); return; }
    if (!isTest && !window.confirm(`לשלוח את המייל לכל ${recipients} הנרשמים? אי אפשר לבטל אחרי השליחה.`)) return;
    setBusy(isTest ? 'test' : 'all');
    try {
      const res = await fetch(`${API_BASE}/admin/broadcast-email`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...form, isAdmin: true, ...(isTest ? { isTest: true, targetEmail: testEmail } : {}) }) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'כדאי לנסות שוב מאוחר יותר'); }
      toast(isTest ? `מייל בדיקה נשלח ל-${testEmail} ✔` : 'הדיוור נשלח לכל הנרשמים ✔');
      if (!isTest) setForm({ subject: '', content: '', image: '', logo: '' });
    } catch (e: any) { toast(`שגיאה בשליחה: ${e.message}`, 'bad'); }
    finally { setBusy(''); }
  };
  return (
    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <FormSection title="המייל" icon={<Send size={17} />}>
          <Field label="נושא" required><input className={inputCls} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="נושא שגורם לפתוח…" /></Field>
          <Field label="תוכן" required hint="ירידת שורה נשמרת"><textarea rows={10} className={`${inputCls} resize-y leading-relaxed`} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></Field>
          <div className="grid gap-4 md:grid-cols-2">
            <ImagePicker label="תמונה ראשית (לא חובה)" value={form.image} onChange={image => setForm({ ...form, image })} />
            <ImagePicker label="לוגו קטן (לא חובה)" value={form.logo} onChange={logo => setForm({ ...form, logo })} contain maxSide={600} />
          </div>
        </FormSection>
        <div className="rounded-[1.6rem] border border-rose-100 bg-white p-4">
          <p className="mb-2 text-[13px] font-semibold text-slate-700">קודם שולחים לעצמך בדיקה</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input dir="ltr" className={`${inputCls} text-left`} placeholder="you@example.com" value={testEmail} onChange={e => setTestEmail(e.target.value)} />
            <button onClick={() => send(true)} disabled={!!busy} className="btn-ghost shrink-0">{busy === 'test' ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />} שליחת בדיקה</button>
          </div>
        </div>
        <button onClick={() => send(false)} disabled={!!busy} className="btn-primary w-full !py-4 text-base disabled:opacity-60">{busy === 'all' ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />} שליחה ל-{recipients.toLocaleString('he-IL')} נרשמות</button>
      </div>
      <aside className="rounded-[1.6rem] border border-rose-100 bg-white p-5 shadow-soft">
        <p className="eyebrow">תצוגה מקדימה</p>
        <div className="mt-3 overflow-hidden rounded-2xl border border-rose-100">
          <div className="bg-rose-50 p-4 text-center">{form.logo ? <img src={form.logo} alt="" className="mx-auto h-10 object-contain" /> : <span className="font-strong text-3xl text-rose-700">{BRAND.name}</span>}</div>
          {form.image && <img src={form.image} alt="" className="w-full object-cover" />}
          <div className="p-4">
            <h4 className="font-strong text-lg text-ink">{form.subject || 'נושא המייל'}</h4>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{form.content || 'כאן יופיע התוכן…'}</p>
          </div>
        </div>
      </aside>
    </div>
  );
};

/* ------------------------- settings ------------------------- */
export const SettingsAdmin: React.FC<{ settings: any; setSettings: (s: any) => void }> = ({ settings, setSettings }) => {
  const [saving, setSaving] = useState(false);
  const rows: [string, string, string][] = [
    ['pointsPerRegister', 'נקודות על הרשמה לאתר', 'מתקבלות פעם אחת כשנרשמים'],
    ['pointsPerEventJoin', 'נקודות על הרשמה לאירוע', 'בכל הרשמה לאירוע'],
    ['pointsPerShare', 'נקודות על שיתוף', 'שיתוף אירוע עם חברים'],
  ];
  return (
    <div className="max-w-2xl space-y-4">
      <FormSection title="ניקוד" subtitle="נקודות מאפשרות להשתתף בהגרלות ומעודדות פעילות" icon={<Award size={17} />}>
        {rows.map(([k, label, hint]) => (
          <Field key={k} label={label} hint={hint}><input type="number" min={0} className={inputCls} value={settings?.[k] ?? 0} onChange={e => setSettings({ ...settings, [k]: Number(e.target.value) })} /></Field>
        ))}
        <button onClick={() => withSave(setSaving, () => api.updateSettings(settings), 'ההגדרות נשמרו ✔')} disabled={saving} className="btn-primary w-full disabled:opacity-60">{saving ? <Loader2 size={16} className="animate-spin" /> : <Settings size={16} />} שמירת הגדרות</button>
      </FormSection>
      <div className="flex items-start gap-3 rounded-[1.5rem] border border-rose-100 bg-white/70 p-4 text-sm text-slate-600">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-rose-500" />
        <p>מי שמזמין חברים דרך קישור ההזמנה האישי מקבל 30 נקודות על כל הצטרפות.</p>
      </div>
      <div className="flex items-start gap-3 rounded-[1.5rem] border border-rose-100 bg-white/70 p-4 text-sm text-slate-600">
        <ImageIcon size={18} className="mt-0.5 shrink-0 text-rose-500" />
        <p>תמונות שמעלים בניהול מוקטנות אוטומטית, כדי שהאתר ייטען מהר גם בטלפון.</p>
      </div>
    </div>
  );
};
