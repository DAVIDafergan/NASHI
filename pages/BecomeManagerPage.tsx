import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Clock, GraduationCap, HeartHandshake, Gift, Ticket, Loader2, ShieldCheck, Sparkles, UserPlus, Send, PartyPopper } from 'lucide-react';
import { api } from '../services/api';
import CityPicker from '../components/CityPicker';
import ScrollReveal from '../components/ScrollReveal';
import { regionName, regionOfCity, REGIONS } from '../shared/regions';
import { BRAND } from '../shared/brand';
import { g } from '../shared/audience';

const ROLE = [
  { icon: <CalendarDays size={22} />, title: 'אירועים', text: 'כנסים, הרצאות, מופעים וסדנאות באזור — לגברים, לנשים או לכולם.' },
  { icon: <GraduationCap size={22} />, title: 'חוגים ושיעורים', text: 'מערכת החוגים ושיעורי התורה של הערים באזור.' },
  { icon: <HeartHandshake size={22} />, title: 'קהילה וחסד', text: 'גמ"חים, עסקים מקומיים ויוזמות קהילתיות.' },
  { icon: <Gift size={22} />, title: 'הגרלות', text: 'הגרלות ואתגרים לתושבי האזור.' },
  { icon: <Ticket size={22} />, title: 'כרטיסים', text: 'הנפקת כרטיסים עם ברקוד וסריקה בכניסה.' },
];

const STEPS = [
  { icon: <UserPlus size={20} />, title: 'נרשמים לאתר', text: 'משתמש רגיל, חינם, בחצי דקה.' },
  { icon: <Send size={20} />, title: 'שולחים בקשה', text: 'ממלאים את הטופס כאן: פרטים, תפקיד והיקף פעילות.' },
  { icon: <ShieldCheck size={20} />, title: 'אישור הנהלה', text: `צוות ${BRAND.name} עובר על הבקשה ויוצר קשר.` },
  { icon: <PartyPopper size={20} />, title: 'מתחילים לנהל', text: 'בתפריט מופיע "ניהול האזור שלי", ומשם הכול.' },
];

const BecomeManagerPage: React.FC<{ user: any; onOpenLogin: () => void }> = ({ user, onOpenLogin }) => {
  const [mine, setMine] = useState<any>(undefined);
  // gender: the optional "אני" (גבר / אישה) — only for how we word messages to the applicant
  const [form, setForm] = useState({ fullName: '', email: '', city: '', address: '', phone: '', jobTitle: '', employer: '', employerOther: '', activityScope: '', about: '', experience: '', hoursPerWeek: '', gender: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(f => ({ ...f, fullName: f.fullName || user?.name || '', email: f.email || user?.email || '', city: f.city || user?.city || '', phone: f.phone || user?.phone || '', gender: f.gender || user?.gender || '' }));
    if (!user) { setMine(null); return; }
    api.getMyManagerApplication().then(setMine).catch(() => setMine(null));
  }, [user]);

  const isManager = !!user && (user.isAdmin || user.role === 'regionAdmin');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    // everything is required except experience
    const miss = [
      !form.fullName.trim() && 'שם מלא', !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()) && 'מייל תקין', !form.phone.trim() && 'טלפון',
      !form.city && 'עיר', !form.address.trim() && 'כתובת', !form.jobTitle.trim() && 'תפקיד', !form.employer && 'מקום העסקה',
      form.employer === 'other' && !form.employerOther.trim() && 'פירוט מקום העסקה', !form.activityScope.trim() && 'היקף פעילות',
      !form.about.trim() && 'קצת עליך', !form.hoursPerWeek && 'זמינות בשבוע',
    ].filter(Boolean);
    if (miss.length) { setError(`חסר: ${miss.join(', ')}`); return; }
    setSending(true);
    try { setMine(await api.applyAsManager(form)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    catch (err: any) { setError(err?.message || 'השליחה נכשלה'); }
    finally { setSending(false); }
  };
  const gn = form.gender || user?.gender;
  const input = 'w-full rounded-2xl border border-rose-100 bg-white px-4 py-3.5 text-[16px] text-ink outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100';

  return (
    <div className="pb-24" dir="rtl">
      {/* hero */}
      <section className="mx-auto max-w-5xl px-5 pt-8 text-center md:pt-16">
        <p className="eyebrow animate-fade-in-up">מנהלי ומנהלות התרבות של {BRAND.name}</p>
        <h1 className="mt-4 text-[2.7rem] leading-[1.02] md:text-[4.6rem] animate-fade-in-up">
          להוביל את התרבות<br /><span className="font-accent text-[1.3em] text-rose-600">באזור שלכם</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-slate-600 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          {BRAND.name}: {BRAND.tagline}. הארץ מחולקת לאזורים, ולכל אזור יש מנהל/ת תרבות שמעלה את מה שקורה בו: אירועים, חוגים, גמ"חים והגרלות — ובוחר/ת לכל פריט אם הוא לגברים, לנשים או לכולם. כל מה שעולה מופיע מיד באזור.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          {REGIONS.map(r => <span key={r.id} className="rounded-full border border-rose-100 bg-white/80 px-3.5 py-1.5 text-[13px] text-slate-600">{r.name}</span>)}
        </div>
      </section>

      {/* status for someone who already applied / manages */}
      {isManager ? (
        <section className="mx-auto mt-10 max-w-xl px-5">
          <div className="card-soft p-7 text-center">
            <CheckCircle2 className="mx-auto text-emerald-600" size={36} />
            <h2 className="mt-3 text-2xl">{g(user.gender, { male: 'אתה כבר מנהל', female: 'את כבר מנהלת', neutral: 'כבר יש לך הרשאת ניהול' })} {user.isAdmin ? '· הנהלה ראשית' : `· תרבות ${regionName(user.adminRegion)}`}</h2>
            <Link to="/admin" className="btn-primary mt-5">לניהול</Link>
          </div>
        </section>
      ) : mine && mine.status === 'pending' ? (
        <section className="mx-auto mt-10 max-w-xl px-5">
          <div className="card-soft p-7 text-center">
            <Clock className="mx-auto text-amber-600" size={36} />
            <h2 className="mt-3 text-2xl">הבקשה שלך בבדיקה</h2>
            <p className="mt-2 text-slate-500">ביקשת לנהל את אזור <b>{regionName(mine.region)}</b>. ניצור קשר בטלפון או במייל, ובינתיים אפשר להמשיך ליהנות מהאתר.</p>
          </div>
        </section>
      ) : mine && mine.status === 'rejected' ? (
        <section className="mx-auto mt-10 max-w-xl px-5">
          <div className="card-soft p-7 text-center">
            <h2 className="text-2xl">תודה על הפנייה</h2>
            <p className="mt-2 text-slate-500">כרגע לא התאפשר לאשר את הבקשה. אפשר ליצור קשר דרך עמוד "צור קשר".</p>
          </div>
        </section>
      ) : null}

      {/* what the role includes */}
      <section className="mx-auto mt-16 max-w-5xl px-5">
        <p className="eyebrow">מה עושה מנהל/ת תרבות</p>
        <h2 className="mt-2 text-[2rem] md:text-[2.6rem]">הכול מהטלפון, באזור שלך בלבד</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          {ROLE.map((r, i) => (
            <ScrollReveal key={r.title} animation="scale-in" delay={i * 70}>
              <div className="h-full rounded-[1.6rem] border border-rose-100 bg-white p-5 shadow-soft">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">{r.icon}</span>
                <h3 className="mt-3 text-lg">{r.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{r.text}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* steps */}
      <section className="mx-auto mt-16 max-w-5xl px-5">
        <p className="eyebrow">איך מצטרפים</p>
        <h2 className="mt-2 text-[2rem] md:text-[2.6rem]">ארבעה צעדים, וכל בקשה מאושרת ע"י ההנהלה</h2>
        <ol className="mt-6 grid gap-3 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <ScrollReveal key={s.title} delay={i * 80}>
              <li className="relative h-full rounded-[1.6rem] bg-white/80 p-5 shadow-soft">
                <span className="font-accent text-5xl leading-none text-rose-200">0{i + 1}</span>
                <span className="absolute left-5 top-5 text-rose-500">{s.icon}</span>
                <h3 className="mt-2 text-lg">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{s.text}</p>
              </li>
            </ScrollReveal>
          ))}
        </ol>
      </section>

      {/* form */}
      {!isManager && !(mine && mine.status === 'pending') && (
        <section id="apply" className="mx-auto mt-16 max-w-2xl px-5">
          <div className="card-soft p-6 md:p-9">
            <p className="eyebrow flex items-center gap-1.5"><Sparkles size={14} /> בקשה להצטרף</p>
            <h2 className="mt-2 text-[2rem]">{g(gn, { male: 'רוצה להיות מנהל תרבות?', female: 'רוצה להיות מנהלת תרבות?', neutral: 'מנהל/ת תרבות באזור שלכם?' })}</h2>
            {!user ? (
              <div className="mt-5 rounded-2xl bg-rose-50/70 p-5 text-center">
                <p className="text-slate-600">כדי לשלוח בקשה צריך קודם משתמש באתר (חינם).</p>
                <button onClick={onOpenLogin} className="btn-primary mt-4">הרשמה / כניסה</button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">שם מלא *</label>
                    <input className={input} value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} autoComplete="name" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">מייל *</label>
                    <input dir="ltr" type="email" className={`${input} text-left`} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} autoComplete="email" />
                  </div>
                </div>
                <div>
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">אני <span className="font-normal text-slate-400">(לא חובה — רק כדי שנפנה אליך נכון)</span></span>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="אני">
                    {[['male', 'גבר'], ['female', 'אישה']].map(([id, label]) => (
                      <button type="button" key={id} role="radio" aria-checked={form.gender === id} onClick={() => setForm(f => ({ ...f, gender: f.gender === id ? '' : id }))}
                        className={`rounded-full border px-4 py-2 text-sm transition ${form.gender === id ? 'border-rose-700 bg-rose-700 text-white' : 'border-rose-100 bg-white text-slate-600 hover:border-rose-300'}`}>{label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">עיר מגורים *</label>
                  <CityPicker value={form.city} onChange={city => setForm(f => ({ ...f, city }))} placeholder="באיזו עיר?" />
                  {form.city && <p className="mt-1.5 text-xs text-rose-700">אזור הניהול: {regionName(regionOfCity(form.city))}</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">כתובת *</label>
                  <input className={input} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="רחוב ומספר" autoComplete="street-address" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">טלפון *</label>
                  <input dir="ltr" type="tel" className={`${input} text-left`} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="05X-XXXXXXX" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">תפקיד *</label>
                  <input className={input} value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} placeholder="לדוגמה: רכז/ת תרבות, מנהל/ת מתנ״ס, רכז/ת קהילה" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">מקום העסקה *</label>
                  <div className="flex flex-wrap gap-2">
                    {[['matnas', 'מתנ״ס'], ['municipality', 'עירייה / מועצה'], ['other', 'אחר']].map(([id, label]) => (
                      <button type="button" key={id} onClick={() => setForm(f => ({ ...f, employer: id }))}
                        className={`rounded-full border px-4 py-2 text-sm transition ${form.employer === id ? 'border-rose-700 bg-rose-700 text-white' : 'border-rose-100 bg-white text-slate-600 hover:border-rose-300'}`}>{label}</button>
                    ))}
                  </div>
                  {form.employer === 'other' && <input className={`${input} mt-2`} value={form.employerOther} onChange={e => setForm(f => ({ ...f, employerOther: e.target.value }))} placeholder="פירוט: עמותה, ארגון, עצמאי/ת…" />}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">היקף פעילות *</label>
                  <textarea rows={3} className={input} value={form.activityScope} onChange={e => setForm(f => ({ ...f, activityScope: e.target.value }))} placeholder="כמה אירועים / חוגים בחודש, לאיזה קהל, באילו שכונות…" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">קצת עליך *</label>
                  <textarea rows={3} className={input} value={form.about} onChange={e => setForm(f => ({ ...f, about: e.target.value }))} placeholder="עיסוק, משפחה, קהילה…" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">ניסיון בהפקת אירועים / עבודה עם קהילה</label>
                  <textarea rows={3} className={input} value={form.experience} onChange={e => setForm(f => ({ ...f, experience: e.target.value }))} placeholder="לא חובה ניסיון. מספיק רצון טוב 🙂" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">כמה זמן אפשר להקדיש בשבוע? *</label>
                  <div className="flex flex-wrap gap-2">
                    {['עד שעה', '1-3 שעות', '3-5 שעות', 'יותר'].map(h => (
                      <button type="button" key={h} onClick={() => setForm(f => ({ ...f, hoursPerWeek: h }))}
                        className={`rounded-full border px-4 py-2 text-sm transition ${form.hoursPerWeek === h ? 'border-rose-700 bg-rose-700 text-white' : 'border-rose-100 bg-white text-slate-600 hover:border-rose-300'}`}>{h}</button>
                    ))}
                  </div>
                </div>
                {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
                <button type="submit" disabled={sending} className="btn-primary w-full !py-4 text-lg disabled:opacity-60">
                  {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={18} />} שליחת הבקשה
                </button>
                <p className="text-center text-xs text-slate-400">כל בקשה נבדקת ומאושרת על ידי הנהלת {BRAND.name}.</p>
              </form>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default BecomeManagerPage;
