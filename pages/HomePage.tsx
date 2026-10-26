import { placeLabel, shareEvent } from '../utils/share';
import RichText from '../components/RichText';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bell, Star, Music, Palette, Activity, Briefcase, Mic, Clock, Sparkles,
  X, Send, MapPin, Phone, HeartHandshake, Quote, GraduationCap, ChevronLeft, ChevronRight, ExternalLink,
  Megaphone, Calendar, BookOpen, ArrowLeft, Plus, Image as ImageIcon, Camera, Type as TypeIcon, Trash2, Share2,
  Trophy
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import FlyerCarousel from '../components/FlyerCarousel';
import { AnimatedHeadline, Marquee, SectionHeader, TiltCard } from '../components/home/HomeParts';
import ScrollReveal from '../components/ScrollReveal';
import StoriesSection from '../components/stories/StoriesSection';
import InviteBand from '../components/home/InviteBand';
import AdSlot from '../components/AdSlot';
import HebrewDayLine from '../components/home/HebrewDayLine';
import { useMyPlace, isNear } from '../hooks/useMyPlace';
import { regionName } from '../shared/regions';
import EventCard from '../components/EventCard';
import AudienceBadge from '../components/AudienceBadge';
import Logo from '../components/Logo';
import { BRAND } from '../shared/brand';

// --- Interfaces ---
interface EventItem {
  id: string; _id?: string; title: string; date: string; location: string; category: string; image: string; isHero?: boolean; speaker?: string;
}
interface LotteryItem {
  id: string; _id?: string; title: string; prize: string; drawDate: string; isActive: boolean;
}
interface AdItem {
  _id: string; type: 'image' | 'video'; content: string; link: string; title: string;
}

const categories = [
  { name: 'מוזיקה', icon: <Music size={12} /> },
  { name: 'אמנות', icon: <Palette size={12} /> },
  { name: 'סדנאות', icon: <Activity size={12} /> },
  { name: 'קריירה', icon: <Briefcase size={12} /> },
  { name: 'העשרה', icon: <Mic size={12} /> },
  { name: 'קהילה', icon: <HeartHandshake size={12} /> },
];

const API_URL = (import.meta as any).env?.VITE_API_URL || 'https://nashi-production.up.railway.app/api';

// פיצ'רי הפלטפורמה המוצגים בסקשן "מה זה ספוט?" — קומפקטי: 4 אייקונים עיקריים, אייקון וטקסט, צבע מתחלף
const platformFeatures = [
  { icon: Calendar, label: 'אירועים', color: 'green' as const },
  { icon: GraduationCap, label: 'חוגים', color: 'coral' as const },
  { icon: Camera, label: 'סטוריז', color: 'coral' as const },
  { icon: Trophy, label: 'הגרלות', color: 'green' as const },
];

// --- פונקציית עזר חכמה לזיהוי לינקים והצגתם נכון ---
const renderTextWithLinks = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  return text.split(urlRegex).map((part, i) => {
    if (part.match(urlRegex)) {
      const href = part.startsWith('http') ? part : `https://${part}`;
      return (
        <a 
          key={i} 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-white font-black underline decoration-1 decoration-rose-300 hover:text-rose-100 hover:decoration-rose-100 transition-colors pointer-events-auto relative z-[70] drop-shadow-md mx-1 inline-block break-all"
          onClick={(e) => e.stopPropagation()} 
          dir="ltr"
        >
          {part}
        </a>
      );
    }
    return <span key={i} className="pointer-events-none relative z-[60]">{part}</span>;
  });
};

const HomePage = ({ user, onOpenLogin, onUpdateUser }: { user: any, onOpenLogin: () => void, onUpdateUser?: (u: any) => void }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const mobileSliderRef = useRef<HTMLDivElement>(null);
   
  const [events, setEvents] = useState<EventItem[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [lotteries, setLotteries] = useState<LotteryItem[]>([]);
  const [personality, setPersonality] = useState<any>(null);
  const [communityItems, setCommunityItems] = useState<any[]>([]);
  const [inspirations, setInspirations] = useState<any[]>([]); 
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [upcomingLottery, setUpcomingLottery] = useState<LotteryItem | null>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [membershipForm, setMembershipForm] = useState({ age: '', occupation: '', address: '', phone: user?.phone || '' });
  const [isLoading, setIsLoading] = useState(true);

  // לוגיקת טעינת נתונים
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setIsLoading(true);
        const [evRes, lotRes, persDataRaw, commData, inspData, annData, classRes] = await Promise.all([
          fetch(`${API_URL}/events`).then(res => res.json()).catch(() => []),
          fetch(`${API_URL}/lotteries`).then(res => res.json()).catch(() => []),
          api.getPersonality().catch(() => null),
          api.getCommunityItems().catch(() => []),
          api.getInspirations().catch(() => []),
          api.getAnnouncements().catch(() => []),
          api.getClasses().catch(() => []),
        ]);

        setEvents(Array.isArray(evRes) ? evRes.map((e: any) => ({...e, id: e._id || e.id})) : []);
        setLotteries(Array.isArray(lotRes) ? lotRes.map((l: any) => ({...l, id: l._id || l.id})) : []);
        
        const persData = Array.isArray(persDataRaw) ? persDataRaw[0] : persDataRaw;
        setPersonality(persData);
        
        setCommunityItems(Array.isArray(commData) ? commData : []);
        
        const now = new Date();
        const validInspirations = (Array.isArray(inspData) ? inspData : [])
          .filter((insp: any) => !insp.scheduledAt || new Date(insp.scheduledAt) <= now)
          .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        
        setInspirations(validInspirations);
        setAnnouncements(Array.isArray(annData) ? annData : []); 
        setClasses(Array.isArray(classRes) ? classRes : []);
      } catch (err) {
        console.error("Error loading home data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadAllData();
  }, []);

  // "אירועים קרובים" — מציג רק אירועים שטרם עברו, ממוינים מהקרוב ביותר. אירוע שעבר התאריך שלו לא יופיע כאן יותר,
  // גם אם המשמעות היא רשימה ריקה (הסקשן כולו מוסתר במקרה הזה)
  // ממוין ב-useMemo (לא בכל רינדור) כדי שלא יאפס את אינטרוול הגלילה האוטומטית של הסליידר בכל עדכון state אחר בעמוד
  // national site: show the visitor's area first (local items of her region + all national/online items).
  // If her area has nothing yet, fall back to the whole country so the page is never empty.
  const place = useMyPlace(user);
  const pickNear = <T,>(list: T[]): T[] => {
    // items uploaded by a regional manager appear only to visitors of her region
    const open = list.filter((i: any) => !i.regionOnly);
    if (!place.region) return open;
    const near = list.filter((i: any) => isNear(i, place.region));
    if (!near.length) return open;
    // her own city first, then the rest of the region (stable: keeps the original order inside each group)
    const mine = near.filter((i: any) => (i.scope || 'local') === 'local' && i.city === place.city);
    return mine.length ? [...mine, ...near.filter(i => !mine.includes(i))] : near;
  };
  const areaLabel = place.city ? `באזור שלך · ${regionName(place.region) || place.city}` : 'מכל הארץ';
  const shownClasses = useMemo(() => pickNear(classes as any[]), [classes, place.region]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownCommunity = useMemo(() => pickNear(communityItems as any[]), [communityItems, place.region]); // eslint-disable-line react-hooks/exhaustive-deps

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return [...pickNear(events)]
      .filter(e => new Date(e.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events, place.region]); // eslint-disable-line react-hooks/exhaustive-deps

  // סליידר אירועים אוטומטי בנייד
  useEffect(() => {
    const slider = mobileSliderRef.current;
    if (!slider || upcomingEvents.length === 0) return;

    const interval = setInterval(() => {
      const cardWidth = slider.offsetWidth;
      const maxScroll = slider.scrollWidth - slider.offsetWidth;

      if (Math.abs(slider.scrollLeft) >= maxScroll - 10) {
        slider.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        slider.scrollBy({ left: -cardWidth, behavior: 'smooth' });
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [upcomingEvents]);


  // רק אירועים עתידיים - אירוע שעבר התאריך שלו לא מוצג יותר בבאנר הראשי, גם אם סומן כ"hero" ע"י מנהלת
  const heroEvents = events.filter(e => e.isHero && new Date(e.date) >= new Date());
  const displayEvents = heroEvents.length > 0 ? heroEvents : upcomingEvents.slice(0, 3);

  useEffect(() => {
    if (displayEvents && displayEvents.length > 0) {
        const interval = setInterval(() => setCurrentSlide((prev) => (prev + 1) % displayEvents.length), 6000);
        return () => clearInterval(interval);
    }
  }, [displayEvents]);

  useEffect(() => {
    const checkLottery = () => {
        if (!lotteries || lotteries.length === 0) return;
        const now = new Date().getTime();
        const active = lotteries.find(l => {
            if (!l.drawDate) return false;
            const drawTime = new Date(l.drawDate).getTime();
            const diff = drawTime - now;
            return l.isActive && diff > 0 && diff <= (24 * 60 * 60 * 1000); 
        });
        if (active) {
            setUpcomingLottery(active);
            const diff = new Date(active.drawDate).getTime() - now;
            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeLeft(`${h}:${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`);
        } else { setUpcomingLottery(null); }
    };
    const interval = setInterval(checkLottery, 1000);
    return () => clearInterval(interval);
  }, [lotteries]);

  const handleMembershipSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!agreedToTerms) {
        alert("יש לאשר את התקנון ומדיניות האתר כדי להמשיך.");
        return;
      }
      try {
          const res = await api.requestMembership(membershipForm as any);
          if (res.success) {
              if (onUpdateUser) onUpdateUser(res.user);
              setShowMembershipModal(false);
              alert("הבקשה נשלחה בהצלחה! נעדכן כשהיא תאושר.");
          }
      } catch (err) { alert("שגיאה בשליחה"); }
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-5">
          <div className="animate-pulse"><Logo size="xl" /></div>
          <div className="mx-auto h-px w-24 overflow-hidden bg-rose-100">
            <div className="h-full w-1/2 bg-rose-400 animate-[shimmer-sweep_1.6s_ease-in-out_infinite]" />
          </div>
          <p className="text-sm text-slate-500">רגע, מכינים את הבית…</p>
        </div>
      </div>
    );
  }

  const latestInspiration = inspirations[0] || { text: "מעט מן האור דוחה הרבה מן החושך.", author: BRAND.name };

  return (
    <div className="min-h-screen pb-12 relative font-sans text-right" dir="rtl">

      {/* ============ HERO — full-bleed, animated ============ */}
      <section className="full-bleed relative -mt-4 overflow-hidden">
        {/* drifting colour mesh */}
        <div className="absolute inset-0 pointer-events-none hidden md:block" aria-hidden="true">
          <div className="absolute -top-24 right-[8%] w-[46vw] max-w-[620px] aspect-square rounded-full bg-rose-200/60 blur-[90px] animate-mesh-drift" />
          <div className="absolute top-[30%] left-[4%] w-[40vw] max-w-[540px] aspect-square rounded-full bg-plum-200/50 blur-[100px] animate-mesh-drift-slow" />
          <div className="absolute bottom-[-10%] right-[35%] w-[30vw] max-w-[420px] aspect-square rounded-full bg-champagne-200/60 blur-[90px] animate-mesh-drift" style={{ animationDelay: '-8s' }} />
          {/* fine rotating ring */}
          <svg className="absolute -left-40 top-10 w-[520px] h-[520px] text-rose-300/40 animate-spin-slow hidden md:block" viewBox="0 0 200 200" fill="none">
            <circle cx="100" cy="100" r="96" stroke="currentColor" strokeWidth="0.4" strokeDasharray="1 5" />
            <circle cx="100" cy="100" r="74" stroke="currentColor" strokeWidth="0.3" />
          </svg>
        </div>

        <div className="relative max-w-7xl mx-auto px-5 md:px-8 pt-8 md:pt-16 pb-8 md:pb-20 grid lg:grid-cols-[1.15fr_1fr] gap-8 lg:gap-6 items-center">
          <div className="relative z-10">
            <p className="eyebrow animate-fade-in-up">לגברים · לנשים · למשפחות · מכל הארץ</p>
            <HebrewDayLine className="mt-2 animate-fade-in-up" />
            <AnimatedHeadline
              className="mt-5 text-[3.4rem] leading-[0.98] sm:text-[4.6rem] lg:text-[6.2rem] text-ink"
              lines={[{ text: 'כל התרבות' }, { text: 'החרדית,', className: 'font-accent text-[1.45em] leading-[0.82] text-rose-600' }, { text: 'במקום אחד, קרוב לבית.' , className: 'text-[0.55em] leading-[1.25] mt-3 text-slate-500 font-light' }]}
            />
            <p className="mt-7 max-w-md text-[17px] leading-relaxed text-slate-600 animate-fade-in-up" style={{ animationDelay: '450ms' }}>
              שיעורים וכנסים, אירועים ומופעים, חוגים, גמ"חים ורגעים של השראה — לגברים, לנשים ולמשפחות, באזור שלכם ובכל הארץ.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3 animate-fade-in-up" style={{ animationDelay: '550ms' }}>
              <Link to="/events" className="btn-primary group !px-7 !py-3.5">
                לאירועים הקרובים
                <ArrowLeft size={16} className="transition-transform duration-500 group-hover:-translate-x-1.5" />
              </Link>
              {user?.isMemberApproved ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur border border-rose-100 px-5 py-3 text-sm text-slate-600">
                  <Star size={15} className="text-champagne-500" fill="currentColor" /> {(user?.points || 0).toLocaleString()} נקודות במעגל
                </span>
              ) : !user?.isMemberRequested ? (
                <button onClick={() => (user ? setShowMembershipModal(true) : onOpenLogin())} className="btn-ghost !px-6 !py-3.5">הצטרפות למעגל</button>
              ) : (
                <span className="text-sm text-slate-500">בקשת ההצטרפות שלך בטיפול ✨</span>
              )}
            </div>
          </div>

          {/* phones: one clear "next event" card instead of the floating collage */}
          {upcomingEvents[0] && (
            <Link to="/events" className="lg:hidden flex items-center gap-4 rounded-[1.75rem] bg-white/90 border border-rose-100 p-3 shadow-soft animate-fade-in-up" style={{ animationDelay: '650ms' }}>
              {upcomingEvents[0].image && <img src={upcomingEvents[0].image} alt="" className="h-24 w-20 shrink-0 rounded-2xl object-contain bg-rose-50" />}
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold text-rose-600">האירוע הבא</span>
                <span className="mt-0.5 block font-strong text-[15px] leading-snug text-ink line-clamp-2">{upcomingEvents[0].title}</span>
                <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Calendar size={12} /> {new Date(upcomingEvents[0].date).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}</span>
              </span>
              <ArrowLeft size={18} className="shrink-0 text-rose-400" />
            </Link>
          )}

          {/* floating collage of what's coming up (tablet/desktop) */}
          <div className="relative hidden lg:block h-[560px]">
            {(() => {
              const pics = upcomingEvents.filter(e => e.image).slice(0, 3);
              const fallback = shownClasses.filter((c: any) => c.image).slice(0, 3 - pics.length).map((c: any) => ({ image: c.image, title: c.title, id: c._id }));
              const items: any[] = [...pics, ...fallback];
              const spots = [
                'right-[6%] top-[4%] w-[52%] h-[64%] rotate-[-4deg] animate-float-y',
                'left-[4%] top-[18%] w-[44%] h-[52%] rotate-[5deg] animate-float-y-slow',
                'right-[30%] bottom-[2%] w-[40%] h-[40%] rotate-[2deg] animate-float-y',
              ];
              if (items.length === 0) {
                return (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-[78%] aspect-square">
                      <div className="absolute inset-0 rounded-[45%_55%_60%_40%/50%_45%_55%_50%] bg-gradient-to-br from-rose-200 via-rose-100 to-plum-200 animate-mesh-drift" />
                      <div className="absolute inset-[12%] rounded-[55%_45%_40%_60%/45%_55%_45%_55%] bg-white/50 backdrop-blur-xl border border-white/70 flex items-center justify-center">
                        <Logo size="xl" />
                      </div>
                    </div>
                  </div>
                );
              }
              return items.map((it, i) => (
                <div key={i} className={`absolute ${spots[i]}`} style={{ animationDelay: `${i * -2.3}s` }}>
                  <div className="w-full h-full animate-clip-up" style={{ animationDelay: `${500 + i * 220}ms` }}>
                    <div className="w-full h-full rounded-[2rem] overflow-hidden shadow-lift ring-8 ring-white/70 bg-rose-100">
                      {/* flyers are posters: show them whole over a blurred copy instead of cropping */}
                      <div className="relative w-full h-full">
                        <img src={it.image} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-60" />
                        <img src={it.image} alt={it.title || ''} className="relative w-full h-full object-contain" />
                      </div>
                    </div>
                  </div>
                </div>
              ));
            })()}
            {upcomingEvents[0] && (
              <Link to="/events" className="absolute left-[2%] bottom-[8%] z-10 animate-scale-in" style={{ animationDelay: '1300ms' }}>
                <div className="rounded-3xl bg-white/85 backdrop-blur-xl border border-white shadow-lift px-5 py-4 max-w-[230px] hover:-translate-y-1 transition-transform duration-500">
                  <p className="text-[11px] text-rose-600 font-semibold">האירוע הבא</p>
                  <p className="mt-1 text-[15px] font-semibold text-ink leading-snug line-clamp-2">{upcomingEvents[0].title}</p>
                  <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1.5"><Calendar size={12} /> {new Date(upcomingEvents[0].date).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}</p>
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* marquee ribbon */}
        <div className="relative border-y border-rose-200/70 bg-white/50 py-4 md:py-7">
          <Marquee items={['תורה', 'קהילה', 'השראה', 'אירועים', 'חוגים', 'חסד', 'יצירה', 'ביחד', 'מכל הארץ']} />
        </div>
      </section>

      <div className="relative z-10 space-y-14 md:space-y-28 pt-10 md:pt-20">

        {/* ============ FLYERS ============ */}
        <ScrollReveal animation="blur-in" className="px-5 md:px-0">
          <FlyerCarousel />
        </ScrollReveal>

        {/* ============ STORIES ============ */}
        <StoriesSection user={user} onOpenLogin={onOpenLogin} />

        <AdSlot placement="home-top" />

        {/* ============ BENTO — what is NASHI ============ */}
        <section>
          <SectionHeader eyebrow={`מה זה ${BRAND.name}`} title="הכול במקום אחד" />
          <div className="mt-8 px-5 md:px-0 grid grid-cols-2 md:grid-cols-4 md:grid-rows-2 gap-3 md:gap-5 md:h-[520px]">
            <ScrollReveal animation="scale-in" className="col-span-2 md:row-span-2">
              <TiltCard onClick={() => navigate('/events')} className="group relative h-[260px] md:h-full rounded-[2rem] overflow-hidden cursor-pointer bg-rose-700 text-white">
                {upcomingEvents[0]?.image && <img src={upcomingEvents[0].image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 transition-transform duration-[1.6s] group-hover:scale-110" />}
                <div className="absolute inset-0 bg-gradient-to-t from-rose-950/95 via-rose-900/60 to-rose-800/40" />
                <div className="absolute inset-0 p-7 md:p-10 flex flex-col justify-between">
                  <Calendar size={30} strokeWidth={1.3} />
                  <div>
                    <p className="text-white/70 text-sm">{upcomingEvents.length > 0 ? `${upcomingEvents.length} אירועים קרובים` : 'לוח האירועים'}</p>
                    <h3 className="mt-1 font-accent text-6xl md:text-8xl leading-none text-white">אירועים</h3>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm text-white/90">לגלות מה קורה <ArrowLeft size={15} className="transition-transform duration-500 group-hover:-translate-x-2" /></span>
                  </div>
                </div>
              </TiltCard>
            </ScrollReveal>
            <ScrollReveal animation="scale-in" delay={100} className="col-span-1">
              <TiltCard onClick={() => navigate('/classes')} className="group relative h-[190px] md:h-full rounded-[2rem] overflow-hidden cursor-pointer bg-plum-100 p-6 flex flex-col justify-between">
                <GraduationCap size={28} strokeWidth={1.3} className="text-plum-600 transition-transform duration-500 group-hover:-rotate-12" />
                <div>
                  <h3 className="font-accent text-5xl md:text-6xl leading-none text-plum-800">חוגים</h3>
                  <p className="text-xs text-plum-600 mt-1">{shownClasses.length > 0 ? `${shownClasses.length} חוגים פעילים` : 'סדנאות והעשרה'}</p>
                </div>
              </TiltCard>
            </ScrollReveal>
            <ScrollReveal animation="scale-in" delay={180} className="col-span-1">
              <TiltCard onClick={() => navigate('/lottery')} className="group relative h-[190px] md:h-full rounded-[2rem] overflow-hidden cursor-pointer bg-champagne-100 p-6 flex flex-col justify-between">
                <Trophy size={28} strokeWidth={1.3} className="text-champagne-600 transition-transform duration-500 group-hover:scale-110" />
                <div>
                  <h3 className="font-accent text-5xl md:text-6xl leading-none text-champagne-800">הגרלות</h3>
                  <p className="text-xs text-champagne-700 mt-1 tabular-nums">{upcomingLottery ? `ההגרלה בעוד ${timeLeft}` : 'פרסים לחברי המעגל'}</p>
                </div>
              </TiltCard>
            </ScrollReveal>
            <ScrollReveal animation="scale-in" delay={260} className="col-span-2">
              <TiltCard onClick={() => navigate('/community')} className="group relative h-[190px] md:h-full rounded-[2rem] overflow-hidden cursor-pointer bg-white border border-rose-100 p-6 md:p-8 flex items-center justify-between gap-6">
                <div>
                  <HeartHandshake size={28} strokeWidth={1.3} className="text-rose-500" />
                  <h3 className="mt-3 font-accent text-5xl md:text-6xl leading-none text-ink">קהילה וחסד</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-[16rem]">עסקים, שירותים ויד מושטת — מהקהילה לקהילה.</p>
                </div>
                <div className="hidden sm:flex -space-x-4 space-x-reverse">
                  {shownCommunity.filter((c: any) => c.image).slice(0, 3).map((c: any, i: number) => (
                    <img key={i} src={c.image} alt="" className="h-16 w-16 md:h-20 md:w-20 rounded-full object-cover ring-4 ring-white transition-transform duration-500 group-hover:-translate-y-1" style={{ transitionDelay: `${i * 60}ms` }} />
                  ))}
                </div>
              </TiltCard>
            </ScrollReveal>
          </div>
        </section>

        {/* ============ EVENTS RAIL ============ */}
        {upcomingEvents.length > 0 && (
          <section>
            <SectionHeader eyebrow={areaLabel} title="אירועים קרובים" to="/events" linkLabel="ללוח המלא" />
            <div ref={mobileSliderRef} className="mt-8 flex gap-5 overflow-x-auto snap-x snap-mandatory no-scrollbar px-5 md:px-0 pb-6">
              {upcomingEvents.map((event, i) => (
                <ScrollReveal key={event.id || i} animation="scale-in" delay={i * 90} className={`snap-start shrink-0 ${upcomingEvents.length === 1 ? 'w-full' : 'w-[82%]'} sm:w-[46%] lg:w-[31%]`}>
                  <EventCard
                    title={event.title}
                    image={event.image}
                    dateLabel={event.date ? new Date(event.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' }) : ''}
                    location={placeLabel(event as any)}
                    city={(event as any).scope === 'local' || !(event as any).scope ? (event as any).city : undefined}
                    category={event.category}
                    ctaLabel="לפרטים והרשמה"
                    onClick={() => navigate(`/events?e=${(event as any)._id || event.id}`)}
                    onShare={() => shareEvent(event)}
                    audience={(event as any).audience}
                    className="h-full"
                  />
                </ScrollReveal>
              ))}
            </div>
          </section>
        )}

        <AdSlot placement="home-middle" />

        {/* ============ INSPIRATION BAND ============ */}
        <section className="full-bleed relative overflow-hidden bg-rose-800 text-white">
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="absolute -top-1/2 right-0 w-[60vw] aspect-square rounded-full bg-rose-500/40 blur-[120px] animate-mesh-drift" />
            <div className="absolute -bottom-1/2 left-0 w-[50vw] aspect-square rounded-full bg-plum-500/40 blur-[120px] animate-mesh-drift-slow" />
          </div>
          <div className="relative max-w-5xl mx-auto px-6 py-20 md:py-28 text-center">
            <ScrollReveal animation="blur-in"><Quote className="mx-auto text-rose-200" size={34} strokeWidth={1.2} /></ScrollReveal>
            <ScrollReveal animation="blur-in" delay={150}>
              <p className="mt-6 font-display font-light text-[1.9rem] leading-[1.25] md:text-[3.2rem] text-white">"{String(latestInspiration.text).trim().replace(/^["״“”']+|["״“”']+$/g, '')}"</p>
            </ScrollReveal>
            <ScrollReveal delay={350}>
              <p className="mt-8 text-sm text-rose-100/80">השראה יומית · <span className="text-white font-medium">{latestInspiration.author}</span></p>
            </ScrollReveal>
          </div>
        </section>

        {/* ============ CLASSES — editorial grid ============ */}
        {shownClasses.length > 0 && (
          <section>
            <SectionHeader eyebrow={areaLabel} title="חוגים, שיעורים וסדנאות" to="/classes" linkLabel="לכל החוגים" />
            <div className="mt-8 px-5 md:px-0 grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {shownClasses.slice(0, 4).map((cls: any, i: number) => (
                <ScrollReveal key={cls._id || i} animation="clip-up" delay={i * 120} className={i % 2 === 1 ? 'lg:mt-14' : ''}>
                  <button type="button" onClick={() => navigate('/classes')} className="group relative block w-full text-right aspect-[3/4] rounded-[2rem] overflow-hidden bg-rose-100">
                    <img src={cls.image} alt={cls.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
                    <AudienceBadge item={cls} overlay className="absolute top-3 right-3" />
                    <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 text-white">
                      {cls.day && <span className="inline-block rounded-full bg-white/20 backdrop-blur px-2.5 py-1 text-[11px] mb-2">{cls.day}</span>}
                      <h3 className="font-strong text-lg md:text-2xl leading-tight text-white">{cls.title}</h3>
                      <p className="mt-1 text-xs md:text-sm text-white/75 max-h-0 opacity-0 group-hover:max-h-10 group-hover:opacity-100 transition-all duration-500">{cls.instructor}</p>
                    </div>
                  </button>
                </ScrollReveal>
              ))}
            </div>
          </section>
        )}

        {/* ============ WOMAN OF THE WEEK — spotlight ============ */}
        {personality && personality.name && (() => {
          const pid = personality._id || personality.id;
          const teaser = (personality.questions || []).find((q: any) => (q.answer || '').trim().length > 40);
          const goRead = () => navigate(pid ? `/personality-archive/${pid}` : '/personality-archive');
          return (
          <section className="px-5 md:px-0">
            <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
              <ScrollReveal animation="clip-up" className="relative mx-auto w-full max-w-[420px]">
                <div className="absolute -inset-5 rounded-t-full rounded-b-[3rem] border border-rose-200 animate-float-y-slow" aria-hidden="true" />
                <button type="button" onClick={goRead} className="relative block w-full aspect-[4/5] rounded-t-full rounded-b-[2.5rem] overflow-hidden bg-gradient-to-b from-rose-100 to-rose-200 shadow-lift">
                  {personality.image ? (
                    <img src={personality.image} alt={personality.name} className="w-full h-full object-cover animate-kenburns" loading="lazy" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center font-accent text-[9rem] text-white/80">{String(personality.name).trim().charAt(0)}</span>
                  )}
                  <span className="absolute bottom-5 right-1/2 translate-x-1/2 rounded-full bg-white/90 px-4 py-1.5 font-accent text-xl text-rose-700 shadow-soft backdrop-blur">אישיות השבוע</span>
                </button>
              </ScrollReveal>
              <div>
                <ScrollReveal><p className="eyebrow">הכירו את אישיות השבוע</p></ScrollReveal>
                <ScrollReveal animation="blur-in" delay={120}><h2 className="mt-3 font-display text-[2.6rem] md:text-[4rem] leading-[1.02] text-ink">{personality.name}</h2></ScrollReveal>
                {personality.role && <ScrollReveal delay={200}><p className="mt-4 text-lg text-slate-600 leading-relaxed max-w-md">{personality.role}</p></ScrollReveal>}
                {personality.motto && (
                  <ScrollReveal delay={280}><p className="mt-6 max-w-md border-r-2 border-rose-300 pr-4 font-display text-2xl leading-snug text-rose-800">"{personality.motto}"</p></ScrollReveal>
                )}
                {teaser && (
                  <ScrollReveal delay={340}>
                    <div className="mt-6 max-w-md rounded-[1.5rem] bg-white/80 p-5 shadow-soft">
                      <p className="font-strong text-ink text-[15px]">{teaser.question}</p>
                      <p className="mt-2 text-slate-600 leading-relaxed line-clamp-3">{teaser.answer}</p>
                    </div>
                  </ScrollReveal>
                )}
                <ScrollReveal delay={420}>
                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={goRead} className="btn-primary group">
                      לקריאת הראיון המלא <ArrowLeft size={16} className="transition-transform duration-500 group-hover:-translate-x-1.5" />
                    </button>
                    <button type="button" onClick={() => navigate('/personality-archive')} className="btn-ghost">לכל הראיונות</button>
                  </div>
                </ScrollReveal>
              </div>
            </div>
          </section>
          );
        })()}

        {/* ============ COMMUNITY ============ */}
        {shownCommunity.length > 0 && (
          <section>
            <SectionHeader eyebrow={areaLabel} title="קהילה וחסד" to="/community" linkLabel="לכל השירותים" />
            <div className="mt-8 px-5 md:px-0 grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {shownCommunity.slice(0, 4).map((item: any, i: number) => (
                <ScrollReveal key={item._id || i} animation="scale-in" delay={i * 90}>
                  <button type="button" onClick={() => navigate('/community', { state: { activeTab: item.category || item.type } })} className="group w-full text-right card-soft overflow-hidden hover:shadow-lift hover:-translate-y-1 transition-all duration-500">
                    <div className="relative m-2 mb-0 aspect-[4/3] rounded-[1.4rem] overflow-hidden bg-rose-50">
                      <AudienceBadge item={item} overlay className="absolute top-2 right-2 z-10" />
                      <img src={item.image} alt={item.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-[1.2s] group-hover:scale-110" />
                    </div>
                    <div className="p-4 md:p-5">
                      <h3 className="text-[1.05rem] md:text-lg text-ink truncate">{item.title}</h3>
                      <p className="mt-1 text-xs md:text-[13px] text-slate-500 line-clamp-2 leading-relaxed">{item.description || item.location || 'לפרטים ודרכי יצירת קשר'}</p>
                    </div>
                  </button>
                </ScrollReveal>
              ))}
            </div>
          </section>
        )}

        {/* ============ INVITE ============ */}
        <InviteBand user={user} onOpenLogin={onOpenLogin} />

        {/* ============ ANNOUNCEMENTS ============ */}
        {announcements.length > 0 && (
          <section className="px-5 md:px-0">
            <ScrollReveal animation="scale-in" className="card-soft p-5 sm:p-6 md:p-10 grid md:grid-cols-[220px_minmax(0,1fr)] gap-5 md:gap-10">
              <div className="min-w-0">
                <span className="relative inline-flex h-3 w-3"><span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60 animate-ping" /><span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" /></span>
                <h2 className="mt-3 font-display text-3xl text-ink">לוח מודעות</h2>
                <p className="mt-1 text-sm text-slate-500">עדכונים מהנהלת הקהילה</p>
              </div>
              <div className="min-w-0 divide-y divide-rose-100">
                {announcements.slice(0, 3).map((ann: any, i: number) => (
                  <ScrollReveal key={ann._id || i} delay={i * 120} className="min-w-0 py-4 first:pt-0 last:pb-0">
                    <h3 className="flex items-start gap-2 text-lg leading-snug text-ink break-words [overflow-wrap:anywhere]"><Megaphone size={16} className="mt-1 shrink-0 text-rose-400" strokeWidth={1.6} /> <span className="min-w-0">{ann.title}</span></h3>
                    {ann.content && <RichText text={String(ann.content)} clampLines={5} className="mt-1.5 text-[14.5px] leading-relaxed text-slate-600" />}
                  </ScrollReveal>
                ))}
              </div>
            </ScrollReveal>
          </section>
        )}

        {/* Ads strip */}
        <AdSlot placement="home-bottom" />

        {/* small credits (the site-wide footer lives in Layout) */}
        <div className="pb-6 text-center text-xs text-slate-400 space-y-2">
          <div className="flex justify-center items-center gap-5">
            <button onClick={() => setShowTermsModal(true)} className="hover:text-rose-600 transition-colors">תקנון האתר ומדיניות</button>
            <span className="w-1 h-1 bg-rose-200 rounded-full" />
            <Link to="/contact" className="hover:text-rose-600 transition-colors">צור קשר</Link>
          </div>
          <p>
            כל הזכויות שמורות ל{BRAND.name} &copy; {new Date().getFullYear()} · בנייה ופיתוח ע"י
            <a href="https://wa.me/message/WZKLTKH4KELMD1" target="_blank" rel="noopener noreferrer" className="text-rose-600 font-semibold mr-1.5 hover:text-rose-800 transition-colors">DA פרויקטים ויזמות</a>
          </p>
        </div>
      </div>

      {/* --- מודלים --- */}

      {/* 3. מודל בקשת הצטרפות */}
      {showMembershipModal && (
          <div className="fixed inset-0 z-[250] flex items-end md:items-start justify-center bg-slate-950/50 backdrop-blur-sm animate-fade-in text-right md:pt-24 md:px-4 md:pb-4" onClick={() => setShowMembershipModal(false)}>
              <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg p-8 md:p-10 relative shadow-2xl animate-slide-up max-h-[88vh] overflow-y-auto border-t-4 border-rose-700">
                  <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto -mt-4 mb-5 md:hidden"></div>
                  <button onClick={() => setShowMembershipModal(false)} className="absolute top-6 left-6 p-2 hover:bg-rose-50 rounded-full text-slate-400 transition-colors"><X size={20}/></button>
                  <div className="text-right space-y-6">
                      <div className="w-14 h-14 bg-rose-50 rounded-[1.2rem] flex items-center justify-center text-rose-400 shadow-sm"><Sparkles size={28}/></div>
                      <div>
                        <h2 className="text-2xl font-black text-slate-800">בקשת הצטרפות למעגל</h2>
                        <p className="text-slate-500 text-sm mt-1 font-medium">נשמח להכיר אותך קצת יותר.</p>
                      </div>
                      <form onSubmit={handleMembershipSubmit} className="space-y-4 pt-2">
                          <div className="grid grid-cols-2 gap-4">
                            <input required type="number" placeholder="גיל" className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm text-right outline-none focus:ring-2 focus:ring-rose-200 transition-shadow" value={membershipForm.age} onChange={e=>setMembershipForm({...membershipForm, age: e.target.value})}/>
                            <input required type="text" placeholder="עיסוק" className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm text-right outline-none focus:ring-2 focus:ring-rose-200 transition-shadow" value={membershipForm.occupation} onChange={e=>setMembershipForm({...membershipForm, occupation: e.target.value})}/>
                          </div>
                          <input required type="text" placeholder="כתובת מגורים" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm text-right outline-none focus:ring-2 focus:ring-rose-200 transition-shadow" value={membershipForm.address} onChange={e=>setMembershipForm({...membershipForm, address: e.target.value})}/>
                          <input required type="tel" placeholder="מספר טלפון" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm text-right outline-none focus:ring-2 focus:ring-rose-200 transition-shadow" value={membershipForm.phone} onChange={e=>setMembershipForm({...membershipForm, phone: e.target.value})}/>
                          <div className="flex items-center gap-3 pt-2">
                             <input id="terms" type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="w-5 h-5 text-rose-500 border-slate-300 rounded focus:ring-rose-500 cursor-pointer" />
                             <label htmlFor="terms" className="text-sm font-medium text-slate-600 cursor-pointer">קראתי ואני מסכים/ה לתקנון</label>
                          </div>
                          <button type="submit" className="w-full mt-4 py-4 bg-plum-300 hover:bg-plum-400 text-ink rounded-2xl font-bold text-sm shadow-xl hover:shadow-2xl transition-all active:scale-95">שליחת בקשה</button>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {/* 4. מודל תקנון */}
      {showTermsModal && (
        <div className="fixed inset-0 z-[300] flex items-end md:items-start justify-center bg-slate-950/50 backdrop-blur-sm animate-fade-in text-right md:pt-24 md:px-4 md:pb-4" onClick={() => setShowTermsModal(false)}>
           <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-2xl p-8 shadow-2xl max-h-[88vh] overflow-hidden flex flex-col animate-slide-up border-t-4 border-rose-700">
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto -mt-3 mb-4 shrink-0 md:hidden"></div>
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-2xl font-black text-slate-800">תקנון ומדיניות</h3>
                <button onClick={() => setShowTermsModal(false)} className="p-2 hover:bg-rose-50 rounded-full text-slate-400 transition-colors"><X size={20}/></button>
              </div>
              <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
                 <p className="text-slate-600 text-sm leading-relaxed font-medium">כאן מופיע התקנון המלא של האתר...</p>
              </div>
              <div className="pt-6 shrink-0 border-t border-slate-100 mt-4">
                 <button onClick={() => setShowTermsModal(false)} className="w-full py-4 bg-plum-300 hover:bg-plum-400 text-ink font-bold rounded-2xl transition-colors shadow-lg">סגירה והמשך</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default HomePage;
