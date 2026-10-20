import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check, CheckCircle2, ChevronDown, Clock, Copy, Eye, Home, Link2, Loader2, MessageCircle, Pencil, Plus, Send,
  Sparkles, Trash2, UserPlus, X, ListChecks, Camera,
} from 'lucide-react';
import { api } from '../../services/api';
import { compressImageFile } from '../../utils/image';

type Q = { question: string; answer: string };
type P = {
  _id: string; name: string; role?: string; motto?: string; image?: string; questions: Q[];
  isActive?: boolean; status: 'awaiting' | 'submitted' | 'published'; externalToken?: string | null;
  updatedAt?: string; publishedAt?: string; createdAt?: string;
};

const interviewLink = (token: string) => `${window.location.origin}/#/interview/${token}`;
const waLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
const inviteText = (token: string) =>
  `היי 💗\nבחרנו בך להיות *אשת השבוע* בקהילת נשי!\nזה הקישור לשאלון האישי — לוקח כמה דקות, ואפשר לצרף תמונה:\n${interviewLink(token)}`;
const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

const Sheet: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }> = ({ open, onClose, title, children, wide }) => {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/40 backdrop-blur-sm md:items-center md:p-6" onClick={onClose} dir="rtl">
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-[#FBF7F4] shadow-2xl md:rounded-[2rem] ${wide ? 'md:max-w-3xl' : 'md:max-w-lg'} animate-fade-in-up`}
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-rose-100 bg-[#FBF7F4]/95 px-6 py-4 backdrop-blur">
          <h3 className="text-xl">{title}</h3>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X size={20} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
};

const StatusPill: React.FC<{ p: P }> = ({ p }) => {
  if (p.isActive && p.status === 'published') return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">בדף הבית עכשיו</span>;
  if (p.status === 'published') return <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">בארכיון</span>;
  if (p.status === 'submitted') return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">ממתינה לאישור</span>;
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">טרם מולא</span>;
};

const Avatar: React.FC<{ p: P; size?: string }> = ({ p, size = 'h-14 w-14' }) =>
  p.image ? <img src={p.image} alt="" className={`${size} shrink-0 rounded-2xl object-cover`} />
    : <div className={`${size} flex shrink-0 items-center justify-center rounded-2xl bg-rose-100 font-accent text-2xl text-rose-600`}>{(p.name || '?').trim().charAt(0)}</div>;

const PersonalityAdmin: React.FC = () => {
  const [items, setItems] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [toast, setToast] = useState('');

  // modals
  const [linkModal, setLinkModal] = useState<{ open: boolean; name: string; token?: string }>({ open: false, name: '' });
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateQs, setTemplateQs] = useState<string[]>([]);
  const [editor, setEditor] = useState<{ open: boolean; draft: P | null; isNew: boolean }>({ open: false, draft: null, isNew: false });
  const [preview, setPreview] = useState<P | null>(null);

  const flash = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(''), 2600); };

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await api.getAllPersonalitiesAdmin()); }
    catch (e: any) { flash(e.message || 'שגיאה בטעינה'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const published = useMemo(() => items.filter(p => p.status === 'published')
    .sort((a, b) => +new Date(b.publishedAt || b.updatedAt || 0) - +new Date(a.publishedAt || a.updatedAt || 0)), [items]);
  const featured = published.find(p => p.isActive) || null;
  const shownOnHome = featured || published[0] || null;
  const pending = items.filter(p => p.status === 'submitted');
  const awaiting = items.filter(p => p.status === 'awaiting');

  const run = async (key: string, fn: () => Promise<any>, ok?: string) => {
    setBusy(key);
    try { await fn(); if (ok) flash(ok); await load(); }
    catch (e: any) { flash(e.message || 'משהו השתבש'); }
    finally { setBusy(''); }
  };

  const approve = (p: P) => run(`approve-${p._id}`, () => api.approvePersonality(p._id), `${p.name} מוצגת עכשיו בדף הבית ✨`);
  const unfeature = (p: P) => run(`unf-${p._id}`, () => api.unfeaturePersonality(p._id), 'הוסרה מדף הבית (נשארת בארכיון)');
  const remove = (p: P) => {
    if (!window.confirm(`למחוק את "${p.name}" לצמיתות?`)) return;
    run(`del-${p._id}`, () => api.deletePersonality(p._id), 'נמחק');
  };

  const openTemplate = async () => {
    setTemplateOpen(true);
    try { const t = await api.getPersonalityTemplate(); setTemplateQs((t?.questions || []).map((q: any) => q.question)); }
    catch { setTemplateQs([]); }
  };
  const saveTemplate = () => run('template', async () => {
    await api.updatePersonalityTemplate({ questions: templateQs.filter(q => q.trim()).map(q => ({ question: q, answer: '' })) });
    setTemplateOpen(false);
  }, 'השאלות נשמרו');

  const createLink = () => run('link', async () => {
    const res = await api.generateInterviewLink({ name: linkModal.name });
    if (!res?.token) throw new Error(res?.error || 'יצירת הקישור נכשלה');
    setLinkModal(m => ({ ...m, token: res.token }));
  });

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); flash('הועתק ✔'); }
    catch { window.prompt('העתיקי את הקישור:', text); }
  };

  const openEditor = (p?: P) => setEditor({
    open: true,
    isNew: !p,
    draft: p ? JSON.parse(JSON.stringify(p)) : { _id: '', name: '', role: '', motto: '', image: '', questions: [], status: 'submitted' },
  });
  const loadTemplateIntoDraft = async () => {
    const t = await api.getPersonalityTemplate().catch(() => null);
    const qs = (t?.questions || []).map((q: any) => ({ question: q.question, answer: '' }));
    setEditor(e => (e.draft ? { ...e, draft: { ...e.draft, questions: qs } } : e));
  };
  const saveEditor = (publish: boolean) => {
    const d = editor.draft; if (!d) return;
    if (!d.name.trim()) { flash('חסר שם'); return; }
    const data = { name: d.name, role: d.role, motto: d.motto, image: d.image, questions: d.questions };
    run('save', async () => {
      if (editor.isNew) await api.createPersonalityAdmin(data, publish);
      else {
        await api.updatePersonalityAdmin(d._id, data);
        if (publish) await api.approvePersonality(d._id);
      }
      setEditor({ open: false, draft: null, isNew: false });
    }, publish ? 'נשמר ומוצג בדף הבית ✨' : 'נשמר');
  };

  const card = 'rounded-[1.75rem] border border-rose-100/80 bg-white p-5 shadow-soft';
  const iconBtn = 'inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-100 text-slate-500 transition hover:border-rose-300 hover:text-rose-700 disabled:opacity-40';

  return (
    <div className="space-y-8" dir="rtl">
      {/* header + actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">אשת השבוע</p>
          <h2 className="mt-1 text-3xl md:text-4xl">ניהול אשת השבוע</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setLinkModal({ open: true, name: '' })} className="btn-primary"><Send size={16} /> שליחת שאלון</button>
          <button onClick={() => openEditor()} className="btn-ghost"><UserPlus size={16} /> הוספה ידנית</button>
          <button onClick={openTemplate} className="btn-ghost"><ListChecks size={16} /> השאלות הקבועות</button>
        </div>
      </div>

      {/* how it works */}
      <div className="overflow-hidden rounded-[1.75rem] border border-rose-100 bg-gradient-to-l from-rose-50 to-white">
        <button onClick={() => setGuideOpen(o => !o)} className="flex w-full items-center justify-between px-6 py-4 text-right">
          <span className="flex items-center gap-2 font-strong text-ink"><Sparkles size={16} className="text-rose-500" /> איך זה עובד?</span>
          <ChevronDown size={18} className={`text-rose-500 transition ${guideOpen ? 'rotate-180' : ''}`} />
        </button>
        {guideOpen && (
          <ol className="grid gap-4 px-6 pb-6 md:grid-cols-4">
            {[
              ['שולחים שאלון', 'לוחצים "שליחת שאלון", ושולחים לה את הקישור בוואטסאפ. השאלות נלקחות מ"השאלות הקבועות".'],
              ['היא ממלאת', 'היא עונה מהטלפון ומצרפת תמונה. הטיוטה נשמרת אצלה, ולא הולכת לאיבוד.'],
              ['את מאשרת', 'הראיון מגיע ל"ממתינות לאישור". אפשר לערוך ניסוח, תמונה ושאלות, ואז ללחוץ "אישור והצגה בדף הבית".'],
              ['מוצג באתר', 'היא מופיעה בדף הבית כאשת השבוע. כשמאשרים את הבאה, הקודמת עוברת לארכיון. מהארכיון אפשר להחזיר כל אחת לדף הבית.'],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-2xl bg-white/80 p-4">
                <span className="font-accent text-3xl text-rose-300">0{i + 1}</span>
                <p className="mt-1 font-strong text-ink">{t}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{d}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-rose-400"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          {/* now on homepage */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-lg"><Home size={18} className="text-rose-500" /> עכשיו בדף הבית</h3>
            {shownOnHome ? (
              <div className={`${card} flex flex-col gap-5 md:flex-row md:items-center`}>
                <Avatar p={shownOnHome} size="h-24 w-24" />
                <div className="flex-1">
                  <p className="font-display text-3xl text-ink">{shownOnHome.name}</p>
                  <p className="text-slate-500">{shownOnHome.role}</p>
                  {!featured && <p className="mt-2 text-xs text-amber-700">לא נבחרה אף אחת, אז מוצגת אוטומטית האחרונה שאושרה.</p>}
                </div>
                <div className="flex gap-2">
                  <button className={iconBtn} title="תצוגה" onClick={() => setPreview(shownOnHome)}><Eye size={17} /></button>
                  <button className={iconBtn} title="עריכה" onClick={() => openEditor(shownOnHome)}><Pencil size={17} /></button>
                  {featured && <button className="btn-ghost !px-4 !py-2 text-sm" disabled={!!busy} onClick={() => unfeature(featured)}>הסרה מדף הבית</button>}
                </div>
              </div>
            ) : (
              <div className={`${card} text-center text-slate-500`}>עדיין אין ראיון מאושר. שלחי שאלון, או הוסיפי ידנית.</div>
            )}
          </section>

          {/* pending approval */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-lg"><Clock size={18} className="text-amber-500" /> ממתינות לאישור <span className="text-sm text-slate-400">({pending.length})</span></h3>
            {pending.length === 0 ? <p className="text-sm text-slate-400">אין ראיונות שממתינים.</p> : (
              <div className="grid gap-3 md:grid-cols-2">
                {pending.map(p => (
                  <div key={p._id} className={`${card} flex items-center gap-4`}>
                    <Avatar p={p} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-strong text-ink">{p.name}</p>
                      <p className="truncate text-xs text-slate-500">{p.role}</p>
                      <p className="mt-1 text-[11px] text-slate-400">התקבל {fmtDate(p.updatedAt)}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button className="btn-primary !px-4 !py-2 text-sm" disabled={!!busy} onClick={() => approve(p)}>
                        {busy === `approve-${p._id}` ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} אישור
                      </button>
                      <div className="flex justify-center gap-1.5">
                        <button className={iconBtn} title="עריכה" onClick={() => openEditor(p)}><Pencil size={15} /></button>
                        <button className={iconBtn} title="מחיקה" onClick={() => remove(p)}><Trash2 size={15} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* links sent */}
          {awaiting.length > 0 && (
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-lg"><Link2 size={18} className="text-slate-400" /> שאלונים שנשלחו וטרם מולאו <span className="text-sm text-slate-400">({awaiting.length})</span></h3>
              <div className="grid gap-3 md:grid-cols-2">
                {awaiting.map(p => (
                  <div key={p._id} className={`${card} flex items-center gap-3`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-strong text-ink">{p.name || 'ממתין למילוי'}</p>
                      <p className="text-[11px] text-slate-400">נשלח {fmtDate(p.createdAt || p.updatedAt)}</p>
                    </div>
                    {p.externalToken && <>
                      <button className={iconBtn} title="העתקת קישור" onClick={() => copy(interviewLink(p.externalToken!))}><Copy size={15} /></button>
                      <a className={iconBtn} title="שליחה בוואטסאפ" href={waLink(inviteText(p.externalToken))} target="_blank" rel="noreferrer"><MessageCircle size={15} /></a>
                    </>}
                    <button className={iconBtn} title="ביטול" onClick={() => remove(p)}><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* archive */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-lg"><CheckCircle2 size={18} className="text-rose-500" /> ארכיון <span className="text-sm text-slate-400">({published.length})</span></h3>
            {published.length === 0 ? <p className="text-sm text-slate-400">הארכיון ריק.</p> : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {published.map(p => (
                  <div key={p._id} className={`${card} flex items-center gap-3`}>
                    <Avatar p={p} size="h-12 w-12" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-strong text-ink">{p.name}</p>
                      <div className="mt-1"><StatusPill p={p} /></div>
                    </div>
                    {!p.isActive && (
                      <button className={iconBtn} title="הצגה בדף הבית" disabled={!!busy} onClick={() => approve(p)}>
                        {busy === `approve-${p._id}` ? <Loader2 size={15} className="animate-spin" /> : <Home size={15} />}
                      </button>
                    )}
                    <button className={iconBtn} title="עריכה" onClick={() => openEditor(p)}><Pencil size={15} /></button>
                    <button className={iconBtn} title="מחיקה" onClick={() => remove(p)}><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ---------- send questionnaire ---------- */}
      <Sheet open={linkModal.open} onClose={() => setLinkModal({ open: false, name: '' })} title="שליחת שאלון אשת השבוע">
        {!linkModal.token ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-500">ניצור קישור אישי לשאלון, עם השאלות הקבועות. את הקישור שולחים לה בוואטסאפ, וכל קישור מתאים למילוי אחד.</p>
            <input className="w-full rounded-2xl border border-rose-100 bg-white px-4 py-3 outline-none focus:ring-4 focus:ring-rose-100" placeholder="שם (רק בשבילך, לא חובה)" value={linkModal.name} onChange={e => setLinkModal(m => ({ ...m, name: e.target.value }))} />
            <button onClick={createLink} disabled={busy === 'link'} className="btn-primary w-full">{busy === 'link' ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />} יצירת קישור</button>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check /></div>
            <p className="font-strong text-ink">הקישור מוכן</p>
            <p className="break-all rounded-2xl bg-white px-4 py-3 text-left text-xs text-slate-500" dir="ltr">{interviewLink(linkModal.token)}</p>
            <a href={waLink(inviteText(linkModal.token))} target="_blank" rel="noreferrer" className="btn-primary w-full !bg-[#1FA855] hover:!bg-[#178a45]"><MessageCircle size={17} /> שליחה בוואטסאפ</a>
            <button onClick={() => copy(interviewLink(linkModal.token!))} className="btn-ghost w-full"><Copy size={16} /> העתקת הקישור</button>
          </div>
        )}
      </Sheet>

      {/* ---------- template questions ---------- */}
      <Sheet open={templateOpen} onClose={() => setTemplateOpen(false)} title="השאלות הקבועות לשאלון" wide>
        <p className="mb-4 text-sm text-slate-500">השאלות האלה נכנסות לכל שאלון חדש שנשלח. שאלונים שכבר נשלחו לא משתנים.</p>
        <div className="space-y-2">
          {templateQs.map((q, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-7 text-center font-accent text-2xl text-rose-300">{i + 1}</span>
              <input className="flex-1 rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-rose-100" value={q} onChange={e => setTemplateQs(qs => qs.map((x, j) => (j === i ? e.target.value : x)))} />
              <button className={iconBtn} onClick={() => setTemplateQs(qs => qs.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => setTemplateQs(qs => [...qs, ''])}><Plus size={16} /> שאלה חדשה</button>
          <button className="btn-primary" disabled={busy === 'template'} onClick={saveTemplate}>{busy === 'template' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} שמירה</button>
        </div>
      </Sheet>

      {/* ---------- editor ---------- */}
      <Sheet open={editor.open} onClose={() => setEditor({ open: false, draft: null, isNew: false })} title={editor.isNew ? 'הוספת אשת השבוע' : 'עריכת ראיון'} wide>
        {editor.draft && (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 md:flex-row">
              <label className="relative flex h-32 w-32 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[2rem] border-2 border-dashed border-rose-200 bg-rose-50/60">
                {editor.draft.image ? <img src={editor.draft.image} alt="" className="h-full w-full object-cover" /> : <Camera className="text-rose-400" />}
                <input type="file" accept="image/*" className="sr-only" onChange={async e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const img = await compressImageFile(f, 1200, 0.85);
                  setEditor(s => (s.draft ? { ...s, draft: { ...s.draft, image: img } } : s));
                }} />
              </label>
              <div className="flex-1 space-y-2">
                {(['name', 'role', 'motto'] as const).map(k => (
                  <input key={k} className="w-full rounded-2xl border border-rose-100 bg-white px-4 py-3 outline-none focus:ring-4 focus:ring-rose-100"
                    placeholder={k === 'name' ? 'שם מלא' : k === 'role' ? 'עיסוק / תיאור קצר' : 'מוטו'}
                    value={(editor.draft as any)[k] || ''}
                    onChange={e => setEditor(s => (s.draft ? { ...s, draft: { ...s.draft, [k]: e.target.value } } : s))} />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {editor.draft.questions.length === 0 && (
                <button className="btn-ghost" onClick={loadTemplateIntoDraft}><ListChecks size={16} /> טעינת השאלות הקבועות</button>
              )}
              {editor.draft.questions.map((q, i) => (
                <div key={i} className="rounded-2xl bg-white p-4 shadow-soft">
                  <div className="flex items-center gap-2">
                    <input className="flex-1 bg-transparent font-strong text-ink outline-none" value={q.question} placeholder="שאלה"
                      onChange={e => setEditor(s => (s.draft ? { ...s, draft: { ...s.draft, questions: s.draft.questions.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)) } } : s))} />
                    <button className="text-slate-300 hover:text-rose-600" onClick={() => setEditor(s => (s.draft ? { ...s, draft: { ...s.draft, questions: s.draft.questions.filter((_, j) => j !== i) } } : s))}><Trash2 size={15} /></button>
                  </div>
                  <textarea rows={3} className="mt-2 w-full resize-y rounded-xl bg-rose-50/40 p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-rose-100" value={q.answer} placeholder="תשובה"
                    onChange={e => setEditor(s => (s.draft ? { ...s, draft: { ...s.draft, questions: s.draft.questions.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)) } } : s))} />
                </div>
              ))}
              <button className="btn-ghost" onClick={() => setEditor(s => (s.draft ? { ...s, draft: { ...s.draft, questions: [...s.draft.questions, { question: '', answer: '' }] } } : s))}><Plus size={16} /> שאלה</button>
            </div>

            <div className="sticky bottom-0 -mx-6 flex flex-wrap gap-2 border-t border-rose-100 bg-[#FBF7F4]/95 px-6 py-4 backdrop-blur">
              <button className="btn-primary flex-1" disabled={busy === 'save'} onClick={() => saveEditor(true)}>{busy === 'save' ? <Loader2 size={16} className="animate-spin" /> : <Home size={16} />} שמירה והצגה בדף הבית</button>
              <button className="btn-ghost" disabled={busy === 'save'} onClick={() => saveEditor(false)}>שמירה בלבד</button>
            </div>
          </div>
        )}
      </Sheet>

      {/* ---------- preview ---------- */}
      <Sheet open={!!preview} onClose={() => setPreview(null)} title="תצוגת הראיון" wide>
        {preview && (
          <div className="space-y-4">
            <div className="flex items-center gap-4"><Avatar p={preview} size="h-20 w-20" /><div><p className="font-display text-3xl">{preview.name}</p><p className="text-slate-500">{preview.role}</p></div></div>
            {preview.motto && <p className="rounded-2xl bg-rose-50 p-4 font-display text-xl text-rose-800">"{preview.motto}"</p>}
            {preview.questions.filter(q => q.answer?.trim()).map((q, i) => (
              <div key={i}><p className="font-strong text-ink">{q.question}</p><p className="mt-1 whitespace-pre-line leading-relaxed text-slate-600">{q.answer}</p></div>
            ))}
          </div>
        )}
      </Sheet>

      {toast && <div className="fixed bottom-6 left-1/2 z-[130] -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm text-white shadow-lift">{toast}</div>}
    </div>
  );
};

export default PersonalityAdmin;
