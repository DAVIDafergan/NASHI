import React, { useState, useEffect } from 'react';
import { 
  Bell, Star, Music, Palette, Activity, Briefcase, Mic, Gift, Clock, Sparkles,
  X, Send, MapPin, Phone, HeartHandshake, Quote, GraduationCap, ChevronLeft, ChevronRight, ExternalLink,
  Users, Megaphone, Calendar, BookOpen 
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

// --- Interfaces ---
interface EventItem {
  id: string; _id?: string; title: string; date: string; location: string; category: string; image: string; isHero?: boolean;
}
interface LotteryItem {
  id: string; _id?: string; title: string; prize: string; drawDate: string; isActive: boolean;
}
interface AdItem {
  _id: string; type: 'image' | 'video'; content: string; link: string; title: string;
}

// הגדרת הקטגוריות
const categories = [
  { name: 'מוזיקה', icon: <Music size={12} /> },
  { name: 'אמנות', icon: <Palette size={12} /> },
  { name: 'סדנאות', icon: <Activity size={12} /> },
  { name: 'קריירה', icon: <Briefcase size={12} /> },
  { name: 'העשרה', icon: <Mic size={12} /> },
  { name: 'קהילה', icon: <HeartHandshake size={12} /> },
];

const API_URL = 'https://nashi-production.up.railway.app/api';

const HomePage = ({ user, onOpenLogin, onUpdateUser }: { user: any, onOpenLogin: () => void, onUpdateUser?: (u: any) => void }) => {
  const navigate = useNavigate();
  
  const [events, setEvents] = useState<EventItem[]>([]);
  const [classes, setClasses] = useState<any[]>([]); 
  const [lotteries, setLotteries] = useState<LotteryItem[]>([]);
  const [personality, setPersonality] = useState<any>(null);
  const [communityItems, setCommunityItems] = useState<any[]>([]);
  const [ads, setAds] = useState<AdItem[]>([]);
  const [inspirations, setInspirations] = useState<any[]>([]); 
  const [announcements, setAnnouncements] = useState<any[]>([]); 
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentAdIndex, setCurrentAdIndex] = useState(0); 
  const [upcomingLottery, setUpcomingLottery] = useState<LotteryItem | null>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false); 
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [membershipForm, setMembershipForm] = useState({ age: '', occupation: '', address: '', phone: user?.phone || '' });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAllData = async () => {
      try {
        setIsLoading(true);
        const [evRes, lotRes, adsRes, persData, commData, inspData, annData, classRes] = await Promise.all([
          fetch(`${API_URL}/events`).then(res => res.json()).catch(() => []),
          fetch(`${API_URL}/lotteries`).then(res => res.json()).catch(() => []),
          fetch(`${API_URL}/ads`).then(res => res.json()).catch(() => []),
          api.getPersonality().catch(() => null),
          api.getCommunityItems().catch(() => []),
          api.getInspirations().catch(() => []),
          api.getAnnouncements().catch(() => []),
          api.getClasses().catch(() => [])
        ]);

        setEvents(Array.isArray(evRes) ? evRes.map((e: any) => ({...e, id: e._id || e.id})) : []);
        setLotteries(Array.isArray(lotRes) ? lotRes.map((l: any) => ({...l, id: l._id || l.id})) : []);
        setAds(Array.isArray(adsRes) ? adsRes : []);
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

  useEffect(() => {
    if (ads && ads.length > 1 && ads[currentAdIndex]?.type === 'image') {
      const adTimer = setInterval(() => {
        setCurrentAdIndex((prev) => (prev + 1) % ads.length);
      }, 3000);
      return () => clearInterval(adTimer);
    }
  }, [ads, currentAdIndex]);

  const heroEvents = events.filter(e => e.isHero);
  const displayEvents = heroEvents.length > 0 ? heroEvents : events.slice(0, 3);

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
              alert("הבקשה נשלחה בהצלחה! המתיני לאישור המנהלת.");
          }
      } catch (err) { alert("שגיאה בשליחה"); }
  };

  const renderAdBanner = () => {
    if (!ads || ads.length === 0) return null;
    const ad = ads[currentAdIndex]; 
    if (!ad) return null;

    return (
      <div className="mx-1 md:mx-0 animate-fade-in transition-all duration-700">
        <a href={ad.link || '#'} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-xl md:rounded-2xl shadow-sm border border-rose-50">
          {ad.type === 'image' ? (
            <img src={ad.content} alt={ad.title || 'Ad'} className="w-full h-20 md:h-24 object-cover transition-transform duration-700 group-hover:scale-105" />
          ) : (
            <div className="w-full h-20 md:h-24 bg-slate-900 flex items-center justify-center overflow-hidden">
                <video src={ad.content} autoPlay muted playsInline onEnded={() => setCurrentAdIndex((prev) => (prev + 1) % ads.length)} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-l from-black/40 to-transparent flex items-center justify-end px-6 text-right text-white">
             <div>
                <p className="text-[6px] md:text-[8px] font-bold opacity-70 uppercase tracking-widest mb-0.5">בשיתוף פעולה</p>
                <h4 className="text-[10px] md:text-sm font-black leading-tight">{ad.title || ''}</h4>
             </div>
          </div>
        </a>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fffcfc]" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-purple-50 border-t-purple-300 rounded-full animate-spin mx-auto"></div>
          <p className="text-purple-300 text-[10px] font-black tracking-widest animate-pulse uppercase font-serif">טוען חוויות נשיות...</p>
        </div>
      </div>
    );
  }

  const latestInspiration = inspirations[0] || { text: "הכוח האמיתי של אישה נמצא ביכולת שלה להאיר לאחרות את הדרך.", author: "נ.ש" };

  return (
    <div className="min-h-screen pb-20 relative overflow-x-hidden font-sans text-right bg-gradient-to-br from-[#fffcfc] via-[#fdf6ff] to-[#fffcfc] transition-colors duration-1000" dir="rtl">
      
      {/* רקע נשי מעוצב עם תנועה */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,240,245,0.4),transparent)]"></div>
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-rose-100/30 rounded-full blur-[100px] animate-blob"></div>
          <div className="absolute top-1/2 left-1/3 w-72 h-72 bg-purple-100/20 rounded-full blur-[80px] animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-rose-50/40 rounded-full blur-[100px] -mr-32 -mb-32 animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-5xl mx-auto px-2 md:px-8 pt-4 md:pt-10 relative z-10 space-y-6 md:space-y-10">
        
        {renderAdBanner()}

        {/* גישה להגרלות בנייד */}
        <div className="md:hidden mx-0">
          <Link to="/lottery" className="flex items-center justify-between bg-gradient-to-r from-purple-500/90 to-rose-500/90 backdrop-blur-md p-4 rounded-xl text-white shadow-xl shadow-purple-500/20">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm"><Gift size={20}/></div>
              <div>
                <span className="font-black text-xs block leading-none">הגרלות המעגל</span>
                <span className="text-[9px] opacity-80 font-bold uppercase tracking-widest">מימוש נקודות והטבות</span>
              </div>
            </div>
            <div className="bg-white/10 p-1.5 rounded-full"><ChevronLeft size={16}/></div>
          </Link>
        </div>

        {/* סטטוס משתמש */}
        <div className="mx-0 hidden md:block">
          {user?.isMemberApproved ? (
              <div className="bg-white/60 backdrop-blur-md p-3 md:p-5 rounded-2xl md:rounded-3xl border border-rose-100/50 flex items-center justify-between shadow-sm animate-bounce-in">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="p-2 md:p-3 bg-rose-50 rounded-xl shadow-inner text-rose-400"><Star fill="currentColor" size={16} /></div>
                    <div>
                      <p className="text-[7px] md:text-[9px] font-black text-rose-300 uppercase tracking-widest leading-none mb-1">הניקוד שצברת</p>
                      <span className="font-black text-slate-800 text-xs md:text-2xl tracking-tighter">{(user?.points || 0).toLocaleString()} <small className="text-[8px] md:text-xs opacity-40 font-bold">PTS</small></span>
                    </div>
                </div>
                <Link to="/lottery" className="bg-slate-900 text-white px-5 md:px-8 py-1.5 md:py-3 rounded-xl text-[8px] md:text-xs font-black hover:bg-purple-600 transition-all shadow-md active:scale-95 flex items-center gap-1.5">כניסה להגרלות <ChevronLeft size={14}/></Link>
              </div>
          ) : (
            <div className="bg-white/70 backdrop-blur-md p-4 md:p-10 rounded-[2rem] md:rounded-[3rem] text-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm border border-purple-50">
                <div className="text-center md:text-right space-y-1 md:space-y-2 relative z-10">
                    <h3 className="text-sm md:text-2xl font-black flex items-center justify-center md:justify-start gap-2 text-purple-600 tracking-tight">
                       <Sparkles size={16} md:size={20} className="text-rose-400 animate-pulse" /> 
                       {user?.isMemberRequested ? 'הבקשה בטיפול' : 'ברוכה הבאה למעגל'}
                    </h3>
                    <p className="text-[10px] md:text-sm text-slate-400 font-medium max-w-md leading-relaxed">
                       {user?.isMemberRequested 
                         ? 'המנהלת בודקת את פרטייך. בקרוב הכל יפתח בפנייך.'
                         : 'המקום שלך להכיר נשות עשייה וליהנות מהטבות ייחודיות.'}
                    </p>
                </div>
                {!user?.isMemberRequested && (
                  <button 
                    onClick={() => user ? setShowMembershipModal(true) : onOpenLogin()} 
                    className="bg-rose-500 text-white px-6 md:px-10 py-2 md:py-3.5 rounded-full font-black text-[10px] md:text-sm shadow-lg hover:bg-purple-600 transition-all active:scale-95 flex items-center gap-2"
                  >
                    <HeartHandshake size={16} /> הצטרפי עכשיו
                  </button>
                )}
            </div>
          )}
        </div>

        {/* סליידר אירועים ראשי - בולט יותר בנייד */}
        <section className="relative h-[300px] md:h-[450px] w-full overflow-hidden rounded-[1.5rem] md:rounded-[3rem] shadow-xl mx-0">
            {displayEvents && displayEvents.length > 0 ? displayEvents.map((event, index) => (
            <div key={event.id || index} className={`absolute inset-0 transition-all duration-1000 ease-out ${index === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}>
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${event.image})` }}></div>
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/90 via-slate-900/20 to-transparent"></div>
                
                <div className="absolute bottom-0 left-0 p-5 md:p-10 text-left w-full flex flex-col items-start z-20">
                    <div className="inline-flex items-center gap-1.5 bg-purple-600/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-[8px] md:text-[10px] font-black uppercase mb-2 shadow-lg tracking-widest border border-white/20">
                      <Sparkles size={10} className="text-amber-300" /> אירוע נבחר
                    </div>
                    <h2 className="text-xl md:text-4xl font-black text-white mb-2 md:mb-4 tracking-tight drop-shadow-2xl leading-tight">{event.title}</h2>
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 justify-start text-white/90 font-bold mb-4 md:mb-6">
                        <p className="flex items-center gap-1.5 text-[9px] md:text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                          <MapPin size={12} className="text-rose-400" /> {event.location}
                        </p>
                        <p className="flex items-center gap-1.5 text-[9px] md:text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                          <Calendar size={12} className="text-rose-400" /> {event.date ? new Date(event.date).toLocaleDateString('he-IL') : ''}
                        </p>
                    </div>
                    <Link to="/events" className="inline-flex items-center gap-2 bg-white text-slate-900 px-6 md:px-10 py-2.5 md:py-4 rounded-xl font-black text-[10px] md:text-sm hover:bg-purple-600 hover:text-white transition-all shadow-xl active:scale-95 group">
                      לפרטים והרשמה <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform"/>
                    </Link>
                </div>
            </div>
            )) : (
              <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300 text-xs italic">טוען אירועים...</div>
            )}
            <div className="absolute bottom-4 right-1/2 translate-x-1/2 flex gap-1.5 z-20 bg-black/20 backdrop-blur-md p-1.5 rounded-full">
              {displayEvents && displayEvents.map((_, i) => (
                <button key={i} onClick={() => setCurrentSlide(i)} className={`h-1 rounded-full transition-all duration-500 ${i === currentSlide ? 'w-6 bg-white shadow-sm' : 'w-1 bg-white/40'}`}></button>
              ))}
            </div>
        </section>

        {/* קטגוריות - גלילה אופקית נוחה בנייד */}
        <div className="flex gap-2.5 overflow-x-auto pb-4 no-scrollbar px-0">
            <button onClick={() => navigate('/classes')} 
                    className="flex items-center gap-2 px-6 md:px-8 py-3.5 md:py-4 bg-slate-900 rounded-xl text-[10px] md:text-xs font-black text-white shadow-lg transition-all flex-shrink-0 active:scale-95 border-b-2 border-purple-500/50">
              <GraduationCap size={16} className="text-purple-400" /> חוגי המעגל
            </button>
            <Link to="/personality-archive" className="flex items-center gap-2 px-6 md:px-8 py-3.5 md:py-4 bg-purple-500 rounded-xl text-[10px] md:text-xs font-black text-white shadow-lg transition-all flex-shrink-0 active:scale-95 border-b-2 border-white/20">
              <Users size={16} className="text-purple-100" /> נשות המעגל
            </Link>
            {categories.map((cat, idx) => (
              <button key={idx} onClick={() => navigate('/events', { state: { category: cat.name } })} 
                      className="flex items-center gap-1.5 px-5 md:px-7 py-3.5 md:py-4 bg-white rounded-xl text-[10px] md:text-xs font-bold text-slate-500 shadow-sm border border-rose-50 hover:border-purple-200 transition-all flex-shrink-0 active:shadow-md">
                <span className="text-rose-300">{cat.icon}</span>{cat.name}
              </button>
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">
            <div className="lg:col-span-2 space-y-10 md:space-y-12">
                
                {/* כרטיס אשת השבוע - מעוצב מחדש לנייד */}
                {personality && personality.name && (
                  <section className="animate-fade-in px-0">
                      <div className="flex items-center justify-between mb-4 px-1">
                        <h3 className="text-sm md:text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                          <Sparkles size={18} className="text-purple-400"/> אשת השבוע במעגל
                        </h3>
                        <Link to="/personality-archive" className="text-purple-500 font-black text-[9px] md:text-xs flex items-center gap-0.5 hover:underline font-serif font-serif">צפייה בכל הנשים <ChevronLeft size={10}/></Link>
                      </div>
                      <Link to={`/personality-archive`} className="block bg-white rounded-[2rem] p-5 md:p-8 shadow-sm border border-purple-50 hover:shadow-xl transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-rose-100 to-purple-100 rounded-full blur-[40px] -mr-16 -mt-16 opacity-60"></div>
                        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 relative z-10">
                            <div className="relative shrink-0">
                                <div className="absolute inset-0 bg-rose-200 rounded-[1.5rem] md:rounded-3xl rotate-3 group-hover:rotate-6 transition-transform"></div>
                                <img src={personality.image} className="w-32 h-32 md:w-44 md:h-44 rounded-[1.5rem] md:rounded-3xl object-cover shadow-lg border-2 border-white relative z-10" alt={personality.name} />
                                <div className="absolute -bottom-2 -right-2 bg-rose-500 p-2 rounded-lg text-white shadow-md z-20 animate-pulse"><Quote size={14}/></div>
                            </div>
                            <div className="text-center md:text-right space-y-3 md:space-y-4 flex-1">
                                <div>
                                    <h3 className="text-xl md:text-3xl font-black text-slate-900 leading-tight font-serif group-hover:text-purple-600 transition-colors">{personality.name}</h3>
                                    <p className="text-[10px] md:text-sm text-slate-400 font-bold mt-1 uppercase tracking-wider">{personality.role}</p>
                                </div>
                                <p className="text-sm md:text-lg text-slate-600 font-serif italic leading-relaxed line-clamp-2">
                                    "{personality.motto || 'סיפור של השראה, חיבור ועשייה...'}"
                                </p>
                                <div className="text-[10px] md:text-xs font-black text-purple-400 flex items-center gap-1 justify-center md:justify-start pt-1">
                                    קראי את הראיון <ChevronLeft size={12} />
                                </div>
                            </div>
                        </div>
                      </Link>
                  </section>
                )}

                {/* חוגים - פריסה נקיה בנייד */}
                <div className="space-y-4 px-0">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-sm md:text-lg font-black text-slate-800 flex items-center gap-2 tracking-tight font-serif">
                        <GraduationCap className="text-purple-400" size={20}/> חוגי המעגל
                      </h3>
                      <Link to="/classes" className="text-purple-500 font-black text-[9px] md:text-xs flex items-center gap-0.5 hover:underline font-serif">כל החוגים <ChevronLeft size={10}/></Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {classes.slice(0, 4).map((cls, idx) => (
                            <div key={cls._id || idx} className="bg-white p-3.5 md:p-4 rounded-[1.2rem] md:rounded-[1.5rem] shadow-sm border border-purple-50 flex items-center gap-4 group hover:bg-purple-50/20 transition-all cursor-pointer">
                                <div className="w-14 h-14 md:w-16 md:h-16 bg-purple-50 rounded-xl overflow-hidden shrink-0 shadow-inner">
                                  <img src={cls.image} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt={cls.title} />
                                </div>
                                <div className="text-right flex-1 overflow-hidden">
                                    <h4 className="font-black text-slate-800 text-[12px] md:text-sm group-hover:text-purple-600 transition-colors truncate mb-0.5 font-serif">{cls.title}</h4>
                                    <p className="text-slate-400 text-[9px] md:text-xs line-clamp-1 font-medium">{cls.instructor} | {cls.day}</p>
                                </div>
                                <div className="bg-slate-50 p-1.5 rounded-full"><ChevronLeft size={14} className="text-slate-300"/></div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* אירועים קרובים */}
                <div className="space-y-4 px-0">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-sm md:text-lg font-black text-slate-800 flex items-center gap-2 tracking-tight font-serif">
                        <Calendar className="text-rose-400" size={20}/> אירועים קרובים
                      </h3>
                      <Link to="/events" className="text-rose-400 font-black text-[9px] md:text-xs flex items-center gap-0.5 hover:underline font-serif">כל האירועים <ChevronLeft size={10}/></Link>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
                        {events.filter(ev => !ev.isHero).slice(0, 3).map((ev, idx) => (
                            <div key={ev._id || ev.id || idx} className="bg-white p-2.5 md:p-4 rounded-[1.2rem] md:rounded-[2rem] shadow-sm border border-rose-50 group hover:border-rose-200 transition-all">
                                <img src={ev.image} className="w-full h-28 md:h-32 rounded-xl md:rounded-2xl object-cover mb-2 group-hover:opacity-90 transition-opacity" />
                                <div className="text-right px-1">
                                    <h4 className="font-black text-slate-800 text-[11px] md:text-xs truncate leading-tight font-serif">{ev.title}</h4>
                                    <p className="text-slate-400 text-[8px] md:text-[9px] flex items-center gap-1 mt-0.5"><MapPin size={8}/> {ev.location}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* קהילה */}
                {communityItems && communityItems.length > 0 && (
                    <section className="space-y-4 animate-fade-in px-0">
                        <div className="flex items-center justify-between px-1">
                          <h3 className="text-sm md:text-lg font-black text-slate-800 flex items-center gap-2">
                              <HeartHandshake className="text-rose-400" size={18}/> שירותי קהילה
                          </h3>
                          <Link to="/community" className="text-rose-400 font-black text-[9px] md:text-xs flex items-center gap-0.5 hover:underline font-serif">לכל השירותים <ChevronLeft size={10}/></Link>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5 overflow-x-auto md:overflow-visible pb-2 no-scrollbar">
                            {communityItems.slice(0, 6).map((item, idx) => (
                                <div key={item._id || item.id || idx} className="bg-white p-2.5 md:p-4 rounded-[1.2rem] md:rounded-[1.5rem] shadow-sm border border-rose-50 group hover:border-purple-200 transition-all flex-shrink-0 md:flex-shrink w-44 md:w-auto">
                                    <img src={item.image} className="w-full h-28 md:h-32 rounded-xl md:rounded-2xl object-cover mb-2 group-hover:opacity-90 transition-opacity" />
                                    <div className="text-right px-1">
                                        <span className="text-[6px] md:text-[8px] font-black text-purple-300 uppercase block mb-0.5 font-serif">{item.category}</span>
                                        <h4 className="font-black text-slate-800 text-[11px] md:text-xs truncate leading-tight font-serif">{item.title}</h4>
                                        <p className="text-slate-400 text-[8px] md:text-[9px] flex items-center gap-1 mt-0.5"><MapPin size={8}/> {item.location}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* סיידבר - מסודר בנייד בסוף הדף */}
            <div className="space-y-8 md:space-y-8 px-0 md:px-0">
                <div className="bg-slate-900 rounded-[1.8rem] md:rounded-[2.5rem] p-7 md:p-8 text-white relative overflow-hidden shadow-2xl text-right group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[60px]"></div>
                    <div className="relative z-10 space-y-4">
                        <Quote className="text-rose-400 -mb-2 group-hover:rotate-12 transition-transform" size={24} />
                        <p className="text-sm md:text-lg font-serif italic leading-relaxed tracking-tight">
                            "{latestInspiration.text}"
                        </p>
                        <div className="flex items-center gap-2 justify-end pt-4 border-t border-white/5">
                            <span className="text-[8px] md:text-[8px] font-black opacity-30 tracking-widest uppercase">השראה יומית</span>
                            <div className="px-3 py-1 rounded-full bg-rose-500 text-white font-black text-[10px] md:text-xs shadow-lg font-serif">
                                {latestInspiration.author}
                            </div>
                        </div>
                    </div>
                </div>

                {/* הודעות הנהלה */}
                {announcements && announcements.length > 0 && (
                    <div className="space-y-4">
                        <h3 className="text-[10px] md:text-xs font-black text-slate-400 flex items-center gap-1.5 px-2 uppercase tracking-widest font-serif">
                          <Megaphone size={14} className="text-purple-500"/> הודעות הנהלה
                        </h3>
                        <div className="space-y-3">
                          {announcements.slice(0, 3).map((ann, idx) => (
                              <div key={ann._id || idx} className="bg-gradient-to-br from-white to-purple-50/20 p-6 md:p-7 rounded-[1.5rem] md:rounded-[2rem] border border-purple-100 shadow-sm hover:border-purple-300 transition-all animate-fade-in-up">
                                 <h4 className="font-black text-purple-600 text-[12px] md:text-sm mb-1.5 flex items-center gap-1.5 font-serif font-serif">
                                    <Bell size={12}/> {ann.title}
                                 </h4>
                                 <p className="text-[11px] md:text-xs text-slate-500 leading-normal font-medium opacity-90 font-serif">{ann.content}</p>
                              </div>
                          ))}
                        </div>
                    </div>
                )}

                <div className="bg-white/50 backdrop-blur-md p-7 md:p-8 rounded-[1.8rem] shadow-sm border border-rose-50 text-center space-y-4 flex flex-col items-center">
                    <div className="w-12 h-12 md:w-14 md:h-14 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-400 shadow-inner"><Phone size={24}/></div>
                    <h3 className="text-[10px] md:text-xs font-black text-slate-800 uppercase tracking-widest font-serif">אנחנו כאן בשבילך</h3>
                    <a href="tel:0500000000" className="block w-full py-3.5 bg-white text-slate-900 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs border border-rose-100 shadow-sm hover:bg-rose-50 transition-colors font-serif">חיוג למשרד המעגל</a>
                </div>
            </div>
        </div>

        {/* פוטר */}
        <footer className="pt-12 pb-8 border-t border-rose-50 text-center space-y-4">
            <div className="flex justify-center gap-6 text-[10px] md:text-xs font-bold text-slate-400">
                <button onClick={() => setShowTermsModal(true)} className="hover:text-purple-500 transition-colors">תקנון האתר ומדיניות</button>
                <Link to="/contact" className="hover:text-purple-500 transition-colors">צרי קשר</Link>
            </div>
            <p className="text-[10px] md:text-xs font-medium text-slate-300 tracking-wide font-serif">
                כל הזכויות שמורות למעגל הנשי &copy; {new Date().getFullYear()} | בנייה ופיתוח ע"י 
                <a href="https://wa.me/message/WZKLTKH4KELMD1" target="_blank" rel="noopener noreferrer" className="text-purple-400 font-black mr-1 hover:underline">
                  DA פרויקטים ויזמות
                </a>
            </p>
        </footer>
      </div>

      {/* מודאלים נשארו ללא שינוי לוגי */}
      {showMembershipModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in text-right">
              <div className="bg-white rounded-[2rem] md:rounded-[3rem] w-full max-w-lg p-6 md:p-12 relative shadow-2xl border border-white mx-3 overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-purple-500"></div>
                  <button onClick={() => setShowMembershipModal(false)} className="absolute top-6 left-6 p-2 hover:bg-rose-50 rounded-full text-slate-300 transition-colors"><X size={20}/></button>
                  <div className="text-right space-y-6 md:space-y-8">
                      <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-400"><Sparkles size={24}/></div>
                      <div className="space-y-1">
                        <h2 className="text-xl md:text-3xl font-black text-slate-800 tracking-tight font-serif">בקשת הצטרפות</h2>
                        <p className="text-[10px] md:text-sm text-slate-400 font-bold font-serif">מלאי פרטים והמתיני לאישור</p>
                      </div>
                      <form onSubmit={handleMembershipSubmit} className="space-y-3 md:space-y-5 pt-4 border-t border-rose-50">
                          <div className="grid grid-cols-2 gap-3 md:gap-5">
                            <input required autoComplete="age" type="number" placeholder="גיל" className="p-3.5 md:p-4 bg-rose-50/30 rounded-xl font-bold text-[11px] md:text-sm text-right outline-none focus:ring-1 focus:ring-rose-200 transition-all" value={membershipForm.age} onChange={e=>setMembershipForm({...membershipForm, age: e.target.value})}/>
                            <input required autoComplete="organization-title" type="text" placeholder="עיסוק" className="p-3.5 md:p-4 bg-rose-50/30 rounded-xl font-bold text-[11px] md:text-sm text-right outline-none focus:ring-1 focus:ring-rose-200 transition-all" value={membershipForm.occupation} onChange={e=>setMembershipForm({...membershipForm, occupation: e.target.value})}/>
                          </div>
                          <input required autoComplete="street-address" type="text" placeholder="כתובת מגורים" className="w-full p-3.5 md:p-4 bg-rose-50/30 rounded-xl font-bold text-[11px] md:text-sm text-right outline-none focus:ring-1 focus:ring-rose-200 transition-all" value={membershipForm.address} onChange={e=>setMembershipForm({...membershipForm, address: e.target.value})}/>
                          <input required autoComplete="tel" type="tel" placeholder="מספר טלפון" className="w-full p-3.5 md:p-4 bg-rose-50/30 rounded-xl font-bold text-[11px] md:text-sm text-right outline-none focus:ring-1 focus:ring-rose-200 transition-all" value={membershipForm.phone} onChange={e=>setMembershipForm({...membershipForm, phone: e.target.value})}/>
                          <div className="flex flex-col gap-2 py-2">
                             <div className="flex items-center gap-2">
                                <input id="terms" type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="w-4 h-4 text-purple-600 rounded" />
                                <label htmlFor="terms" className="text-[10px] md:text-xs font-bold text-slate-600 font-serif">קראתי ואני מאשרת את תקנון האתר</label>
                             </div>
                             <button type="button" onClick={() => setShowTermsModal(true)} className="text-[9px] md:text-[10px] text-purple-500 font-black underline w-fit font-serif">לחצי לקריאת התקנון המלא</button>
                          </div>
                          <button type="submit" className="w-full py-4 md:py-5 bg-rose-500 text-white rounded-xl md:rounded-2xl font-black text-[12px] md:text-sm shadow-xl hover:bg-purple-600 transition-all active:scale-95 flex items-center justify-center gap-2 mt-2 font-serif">
                             <Send size={16}/> שליחת בקשה
                          </button>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {showTermsModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in text-right" dir="rtl">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl p-6 md:p-10 shadow-2xl max-h-[85vh] overflow-y-auto no-scrollbar border-t-8 border-purple-500">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black text-slate-800 font-serif">תקנון ומדיניות שימוש</h3>
                  <button onClick={() => setShowTermsModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
                </div>
                <div className="space-y-4 text-sm md:text-base leading-relaxed text-slate-600 font-medium font-serif">
                  <p className="font-black text-slate-800 underline">כללי</p>
                  <p>ברוכות הבאות לאתר. השימוש באתר ובתכניו כפוף לתקנון ולמדיניות שימוש זו, ומהווה הסכמה מלאה לכל תנאיה. הנהלת האתר רשאית לעדכן את התקנון מעת לעת, לפי שיקול דעתה הבלעדי וללא הודעה מוקדמת. נוסח התקנון המעודכן הוא המחייב.</p>
                  <p className="font-black text-slate-800 underline">מהות האתר ותכניו</p>
                  <p>האתר מהווה מרחב קהילתי לנשים ונערות, שמטרתו שיתוף, השראה, חיבור ויצירת שיח פתוח ומכבד. התכנים המפורסמים באתר נכתבים לצורכי שיח, שיתוף דעות וניסיון אישי בלבד. ייתכנו בתכני האתר טעויות, אי־דיוקים או מידע שאינו מעודכן. אין לראות בתכנים המופיעים באתר ייעוץ מקצועי מכל סוג שהוא, לרבות אך לא רק: ייעוץ רפואי, נפשי, משפטי, פיננסי או טיפולי.</p>
                  <p className="font-black text-slate-800 underline">אחריות ושימוש במידע</p>
                  <p>השימוש בתכני האתר ובמידע המפורסם בו נעשה על אחריות המשתמשת בלבד. הנהלת האתר לא תישא בכל אחריות לנזק, ישיר או עקיף, שעלול להיגרם עקב הסתמכות על מידע המופיע באתר או שימוש בו.</p>
                  <p className="font-black text-slate-800 underline">פעילות כספית והתקשרויות חיצוניות</p>
                  <p>האתר אינו עוסק בכספים, תשלומים, תרומות, מכירת מוצרים או קניית כרטיסים, ואינו מהווה צד לכל התקשרות כספית או חוזית המתקיימת מחוץ למסגרת האתר. כל התקשרות בין משתמשות או בין משתמשת לגורם חיצוני נעשית באחריותן הבלעדין של הצדדים המעורבים.</p>
                  <p className="font-black text-slate-800 underline">קישורים ותכנים חיצוניים</p>
                  <p>באתר עשויים להופיע קישורים, הפניות או אזכורים לגורמים חיצוניים. הנהלת האתר אינה אחראית לתוכן, לאמינות, לזמינות או לפעילות של אתרים, שירותים או גורמים חיצוניים אלו, והשימוש בהם הוא באחריות המשתמשת בלבד.</p>
                  <p className="font-black text-slate-800 underline">פרטיות ושמירת מידע</p>
                  <p>האתר מכבד את פרטיות המשתמשות. מסירת מידע אישי, פרסומו או שיתופו באתר נעשים ביוזמת המשתמשת ובאחריותה בלבד. הנהלת האתר אינה אחראית לשימוש שייעשה במידע אישי שפורסם בפומבי על ידי המשתמשת.</p>
                  <p className="font-black text-slate-800 underline">התנהלות ושיח קהילתי</p>
                  <p>המשתמשות מתחייבות לנהל שיח מכבד, אחראי ורגיש. הנהלת האתר שומרת לעצמה את הזכות להסיר תכנים, להגביל גישה או לחסום משתמשת, לפי שיקול דעתה, במקרה של הפרת תקנון זה או פגיעה ברוח הקהילה.</p>
                  <p className="font-black text-slate-800 underline">סמכות שיפוט</p>
                  <p>על תקנון זה ועל השימוש באתר יחולו דיני מדינת ישראל בלבד, וסמכות השיפוט הבלעדית נתונה לבתי המשפט המוסמכים בישראל.</p>
                </div>
                <button onClick={() => setShowTermsModal(false)} className="w-full mt-8 py-3 bg-slate-900 text-white font-black rounded-xl font-serif">סגירה וחזרה</button>
            </div>
          </div>
      )}
    </div>
  );
};

export default HomePage;