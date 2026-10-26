import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, CheckCircle2, Loader2, Send, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { compressImageFile } from '../utils/image';
import { BRAND } from '../shared/brand';

type Q = { question: string; answer: string };

/** Public questionnaire the interviewee fills after the admin sends the "אישיות השבוע" link. */
const InterviewPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [motto, setMotto] = useState('');
  const [image, setImage] = useState('');
  const [questions, setQuestions] = useState<Q[]>([]);

  const draftKey = token ? `nashi-interview-${token}` : '';

  useEffect(() => {
    if (!token) { setInvalid(true); setLoading(false); return; }
    api.getInterviewByToken(token)
      .then((data: any) => {
        if (!data || data.error) { setInvalid(true); return; }
        let qs: Q[] = (data.questions || []).map((q: any) => ({ question: q.question, answer: '' }));
        let draft: any = null;
        try { draft = JSON.parse(localStorage.getItem(`nashi-interview-${token}`) || 'null'); } catch { /* ignore */ }
        if (draft) {
          qs = qs.map((q, i) => ({ ...q, answer: draft.answers?.[i] || '' }));
          setName(draft.name || ''); setRole(draft.role || ''); setMotto(draft.motto || '');
        } else {
          setName(data.name || ''); setRole(data.role || ''); setMotto(data.motto || '');
        }
        setQuestions(qs);
      })
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false));
  }, [token]);

  // keep a draft on the device so a long questionnaire isn't lost if she closes the tab
  useEffect(() => {
    if (!draftKey || loading || submitted) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ name, role, motto, answers: questions.map(q => q.answer) })); } catch { /* ignore */ }
  }, [draftKey, name, role, motto, questions, loading, submitted]);

  const answered = useMemo(() => questions.filter(q => q.answer.trim()).length, [questions]);
  const progress = questions.length ? Math.round((answered / questions.length) * 100) : 0;

  const onImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageBusy(true);
    try { setImage(await compressImageFile(file, 1200, 0.85)); }
    catch { setError('לא הצלחנו לקרוא את התמונה. אפשר לנסות תמונה אחרת.'); }
    finally { setImageBusy(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('נשמח לדעת את השם 🙂'); return; }
    setSubmitting(true);
    try {
      await api.submitInterview(token!, { name, role, motto, image, questions } as any);
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err?.message || 'השליחה נכשלה, כדאי לנסות שוב.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-[70vh] flex items-center justify-center text-rose-500"><Loader2 className="animate-spin" size={36} /></div>
  );

  if (invalid) return (
    <div className="min-h-[70vh] flex items-center justify-center px-5" dir="rtl">
      <div className="card-soft max-w-md w-full p-10 text-center">
        <p className="eyebrow">אישיות השבוע</p>
        <h1 className="mt-3 text-3xl">הקישור כבר לא פעיל</h1>
        <p className="mt-3 text-slate-500 leading-relaxed">ייתכן שהשאלון כבר נשלח, או שהקישור הוחלף. אפשר לבקש קישור חדש מצוות {BRAND.name}.</p>
        <button onClick={() => navigate('/')} className="btn-primary mt-7">לדף הבית</button>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-[70vh] flex items-center justify-center px-5" dir="rtl">
      <div className="card-soft max-w-md w-full p-10 text-center animate-scale-in">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600"><CheckCircle2 size={34} /></div>
        <h1 className="mt-6 text-4xl">תודה, {name.split(' ')[0]}!</h1>
        <p className="mt-4 text-slate-500 leading-relaxed">הראיון שלך הגיע אלינו. נעבור עליו בקרוב, ונעדכן כשהוא יעלה לדף הבית של {BRAND.name}.</p>
        <button onClick={() => navigate('/')} className="btn-ghost mt-7">לביקור באתר</button>
      </div>
    </div>
  );

  const input = 'w-full rounded-2xl border border-rose-100 bg-white/90 px-4 py-3.5 text-[16px] text-ink outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100';

  return (
    <div className="relative px-4 pb-28 pt-8 md:pt-14" dir="rtl">
      <div className="mx-auto max-w-2xl">
        <header className="text-center animate-fade-in-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 shadow-soft"><Sparkles size={14} className="text-rose-500" /><span className="eyebrow">אישיות השבוע · {BRAND.name}</span></span>
          <h1 className="mt-5 text-[2.6rem] leading-[1.05] md:text-[3.6rem]">נבחרת להיות<br /><span className="font-accent text-[1.3em] text-rose-600">אישיות השבוע</span></h1>
          <p className="mx-auto mt-4 max-w-md text-[17px] leading-relaxed text-slate-500">ספרו לנו על עצמכם, במילים שלכם. אין תשובות נכונות — כותבים מהלב, כמה שרוצים.</p>
        </header>

        {/* progress */}
        <div className="sticky top-[76px] z-20 mt-8 rounded-full bg-white/85 p-1.5 shadow-soft backdrop-blur">
          <div className="flex items-center gap-3 px-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-rose-100">
              <div className="h-full rounded-full bg-rose-500 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs font-semibold text-rose-700 tabular-nums">{answered}/{questions.length}</span>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-6">
          <section className="card-soft p-6 md:p-8">
            <h2 className="text-2xl">קצת עליך</h2>
            <div className="mt-6 flex flex-col items-center gap-6 md:flex-row md:items-start">
              <label className="group relative flex h-36 w-36 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[2.2rem] border-2 border-dashed border-rose-200 bg-rose-50/60 transition hover:border-rose-400">
                {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : (
                  <span className="flex flex-col items-center gap-2 text-rose-500">
                    {imageBusy ? <Loader2 className="animate-spin" /> : <Camera size={28} />}
                    <span className="text-xs font-semibold">תמונה שלך</span>
                  </span>
                )}
                {image && <span className="absolute inset-x-0 bottom-0 bg-black/40 py-1.5 text-center text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100">החלפה</span>}
                <input type="file" accept="image/*" onChange={onImage} className="sr-only" />
              </label>
              <div className="w-full space-y-3">
                <input required className={input} placeholder="שם מלא" value={name} onChange={e => setName(e.target.value)} />
                <input className={input} placeholder="עיסוק (למשל: מלמד, גננת, הורה ל־4, מעצב/ת)" value={role} onChange={e => setRole(e.target.value)} />
                <input className={input} placeholder="המוטו לחיים" value={motto} onChange={e => setMotto(e.target.value)} />
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-400">התמונה מוקטנת אוטומטית — אפשר להעלות ישר מהמצלמה.</p>
          </section>

          {questions.map((q, i) => (
            <section key={i} className="card-soft p-6 md:p-8">
              <div className="flex items-start gap-3">
                <span className="font-accent text-4xl leading-none text-rose-300">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="pt-1 text-[1.15rem] leading-snug">{q.question}</h3>
              </div>
              <textarea
                rows={4}
                className={`${input} mt-4 resize-y leading-relaxed`}
                placeholder="התשובה שלך…"
                value={q.answer}
                onChange={e => setQuestions(prev => prev.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
              />
            </section>
          ))}

          {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-center text-sm font-semibold text-rose-700">{error}</p>}

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-rose-100 bg-white/90 px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
            <button type="submit" disabled={submitting || imageBusy} className="btn-primary w-full !py-4 text-lg disabled:opacity-60">
              {submitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={18} />}
              שליחת הראיון
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-400">השליחה מהווה אישור לפרסם את התשובות והתמונה ב{BRAND.name}, לאחר עריכה ואישור של הצוות.</p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InterviewPage;
