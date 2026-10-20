import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Share2 } from 'lucide-react';
import { api } from '../services/api';
import ScrollReveal from '../components/ScrollReveal';
import { shareLink } from '../utils/share';

const initial = (name?: string) => (name || '?').trim().charAt(0);

/** "נשות השבוע": the full interview of the selected woman + the archive of previous ones. */
const PersonalityArchivePage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.getAllPersonalities()
      .then((data: any) => { if (alive) setList(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const current = useMemo(() => {
    if (!list.length) return null;
    return (id && list.find(p => (p._id || p.id) === id)) || list.find(p => p.isActive) || list[0];
  }, [list, id]);
  const others = list.filter(p => p !== current);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [id]);

  if (loading) return (
    <div className="mx-auto max-w-3xl px-5 py-16 animate-pulse" dir="rtl">
      <div className="mx-auto h-64 w-52 rounded-t-full rounded-b-[2rem] bg-rose-100" />
      <div className="mx-auto mt-8 h-10 w-64 rounded-full bg-rose-100" />
      <div className="mt-10 space-y-4">{[0, 1, 2].map(i => <div key={i} className="h-28 rounded-[1.75rem] bg-white" />)}</div>
    </div>
  );

  if (!current) return (
    <div className="mx-auto max-w-md px-5 py-24 text-center" dir="rtl">
      <p className="eyebrow">נשות השבוע</p>
      <h1 className="mt-3 text-4xl">בקרוב כאן</h1>
      <p className="mt-3 text-slate-500">הראיון הראשון בדרך אלינו.</p>
      <button onClick={() => navigate('/')} className="btn-primary mt-8">לדף הבית</button>
    </div>
  );

  const pid = current._id || current.id;
  const answers = (current.questions || []).filter((q: any) => (q.answer || '').trim());
  const share = () => shareLink({
    title: `${current.name} — אשת השבוע בנשי`,
    text: `הכירו את ${current.name}${current.role ? `, ${current.role}` : ''} — אשת השבוע בקהילת נשי 💗`,
    path: `/s/personality/${pid}`,
  });

  return (
    <div className="pb-24" dir="rtl">
      {/* hero */}
      <section className="relative px-5 pt-8 md:pt-14">
        <div className="mx-auto max-w-5xl">
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-rose-700">
            <ArrowLeft size={16} className="rotate-180" /> חזרה
          </button>
          <div className="mt-6 grid items-center gap-10 md:grid-cols-[minmax(0,420px)_1fr] md:gap-16">
            <ScrollReveal animation="clip-up" className="relative mx-auto w-full max-w-[380px]">
              <div className="absolute -inset-4 rounded-t-full rounded-b-[3rem] border border-rose-200 animate-float-y-slow" aria-hidden="true" />
              <div className="relative aspect-[4/5] overflow-hidden rounded-t-full rounded-b-[2.5rem] bg-gradient-to-b from-rose-100 to-rose-200 shadow-lift">
                {current.image
                  ? <img src={current.image} alt={current.name} className="h-full w-full object-cover animate-kenburns" />
                  : <span className="absolute inset-0 flex items-center justify-center font-accent text-[9rem] text-white/80">{initial(current.name)}</span>}
              </div>
            </ScrollReveal>
            <div className="text-center md:text-right">
              <p className="eyebrow">{current.isActive ? 'אשת השבוע' : 'מנשות השבוע'}</p>
              <h1 key={pid} className="mt-3 text-[3rem] leading-[1] md:text-[4.6rem] animate-blur-in">{current.name}</h1>
              {current.role && <p className="mt-4 text-lg leading-relaxed text-slate-600">{current.role}</p>}
              {current.motto && (
                <p className="mx-auto mt-7 max-w-md font-display text-[1.7rem] leading-snug text-rose-800 md:mx-0">
                  <span className="font-accent text-5xl leading-none text-rose-300">״</span>{current.motto}<span className="font-accent text-5xl leading-none text-rose-300">״</span>
                </p>
              )}
              <button onClick={share} className="btn-ghost mt-8"><Share2 size={16} /> שיתוף הראיון</button>
            </div>
          </div>
        </div>
      </section>

      {/* interview */}
      <section className="mx-auto mt-16 max-w-3xl px-5">
        <div className="space-y-5">
          {answers.map((q: any, i: number) => (
            <ScrollReveal key={`${pid}-${i}`} delay={Math.min(i, 4) * 60}>
              <article className="card-soft p-6 md:p-9">
                <div className="flex items-start gap-4">
                  <span className="font-accent text-4xl leading-none text-rose-300">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="text-[1.2rem] leading-snug md:text-[1.35rem]">{q.question}</h3>
                    <p className="mt-3 whitespace-pre-line text-[17px] leading-[1.85] text-slate-600">{q.answer}</p>
                  </div>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
        <div className="mt-10 rounded-[2rem] bg-gradient-to-l from-rose-100 via-rose-50 to-white p-7 text-center md:p-10">
          <p className="font-accent text-3xl text-rose-700">מכירה אישה מעוררת השראה?</p>
          <p className="mt-2 text-slate-600">ספרי לנו עליה, ואולי היא תהיה אשת השבוע הבאה.</p>
          <button onClick={() => navigate('/contact')} className="btn-primary mt-5">להמליץ על אישה</button>
        </div>
      </section>

      {/* archive */}
      {others.length > 0 && (
        <section className="mx-auto mt-20 max-w-5xl px-5">
          <p className="eyebrow">ארכיון</p>
          <h2 className="mt-2 text-[2rem] md:text-[2.6rem]">נשות השבוע הקודמות</h2>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 md:gap-6">
            {others.map((p, i) => (
              <ScrollReveal key={p._id || i} animation="scale-in" delay={(i % 4) * 70}>
                <button onClick={() => navigate(`/personality-archive/${p._id || p.id}`)} className="group w-full text-right">
                  <div className="aspect-[4/5] overflow-hidden rounded-t-full rounded-b-[1.75rem] bg-gradient-to-b from-rose-100 to-rose-200 shadow-soft transition duration-500 group-hover:-translate-y-1 group-hover:shadow-lift">
                    {p.image
                      ? <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover transition duration-[1.2s] group-hover:scale-105" />
                      : <span className="flex h-full items-center justify-center font-accent text-7xl text-white/80">{initial(p.name)}</span>}
                  </div>
                  <h3 className="mt-3 truncate text-lg">{p.name}</h3>
                  <p className="truncate text-xs text-slate-500">{p.role}</p>
                </button>
              </ScrollReveal>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default PersonalityArchivePage;
