import React, { useState, useEffect } from 'react';
import { 
  Bell, Star, Music, Palette, Activity, Briefcase, Mic, Gift, Clock, Sparkles,
  X, Send, MapPin, Phone, HeartHandshake, Quote, GraduationCap, ChevronLeft, ChevronRight, ExternalLink,
  Users, Megaphone, Calendar, BookOpen // כל האייקונים מיובאים בצורה תקינה
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

// הגדרת הקטגוריות - זה פותר את שגיאת categories is not defined
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
  const [classes, setClasses] = useState<any[]>([]); // מצב לחוגים
  const [lotteries, setLotteries] = useState<LotteryItem[]>([]);
  const [personality, setPersonality] = useState<any>(null);
  const [communityItems, setCommunityItems] = useState<any[]>([]);
  const [ads, setAds] = useState<AdItem[]>([]);
  const [inspirations, setInspirations] = useState<any[]>([]); 
  const [announcements, setAnnouncements] = useState<any[]>([]); // הודעות הנהלה
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentAdIndex, setCurrentAdIndex] = useState(0); 
  const [upcomingLottery, setUpcomingLottery] = useState<LotteryItem | null>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false); // תקנון
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [membershipForm, setMembershipForm] = useState({ age: '', occupation: '', address: '', phone: user?.phone || '' });
  const [isLoading, setIsLoading] = useState(true);

  // טעינת נתונים משולבת
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
          api.getClasses().catch(() => []) // משיכת חוגים
        ]);

        setEvents(Array.isArray(evRes) ? evRes.map((e: any) => ({...e, id: e._id || e.id})) : []);
        setLotteries(Array.isArray(lotRes) ? lotRes.map((l: any) => ({...l, id: l._id || l.id})) : []);
        setAds(Array.isArray(adsRes) ? adsRes : []);
        setPersonality(persData);
        setCommunityItems(Array.isArray(commData) ? commData : []);
        setInspirations(Array.isArray(inspData) ? inspData : []);
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

  // לוגיקת קרוסלת פרסומות אוטומטית
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
      <div className="mx-2 md:mx-0 animate-fade-in transition-all duration-700">
        <a href={ad.link || '#'} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-xl md:rounded-2xl shadow-sm border border-rose-50">
          {ad.type === 'image' ? (
            <img src={ad.content} alt={ad.title || 'Ad'} className="w-full h-16 md:h-24 object-cover transition-transform duration-700 group-hover:scale-105" />
          ) : (
            <div className="w-full h-16 md:h-24 bg-slate-900 flex items-center justify-center overflow-hidden">
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
          <p className="text-purple-300 text-[10px] font-black tracking-widest animate-pulse uppercase">טוען חוויות נשיות...</p>
        </div>
      </div>
    );
  }

  const latestInspiration = inspirations[0] || { text: "הכוח האמיתי של אישה נמצא ביכולת שלה להאיר לאחרות את הדרך.", author: "נ.ש" };

  return (
    <div className="min-h-screen pb-20 relative overflow-x-hidden font-sans text-right bg-[#fffcfc]" dir="rtl">
      
      {/* רקע נשי עדין */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,240,245,0.6),transparent)]"></div>
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-purple-50/30 rounded-full blur-[100px] -mr-32 -mb-32"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-4 md:pt-10 relative z-10 space-y-6 md:space-y-10">
        
        {renderAdBanner()}

        {/* גישה להגרלות בנייד - עיצוב בינלאומי */}
        <div className="md:hidden mx-1">
          <Link to="/lottery" className="flex items-center justify-between bg-gradient-to-r from-purple-500/90 to-rose-500/90 backdrop-blur-md p-4 rounded-2xl text-white shadow-xl shadow-purple-500/20">
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
        <div className="mx-1 hidden md:block">
          {user?.isMemberApproved ? (
             <div className="bg-white/60 backdrop-blur-md p-3 md:p-5 rounded-2xl md:rounded-3xl border border-rose-100/50 flex items-center justify-between shadow-sm animate-bounce-in">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="p-2 md:p-3 bg-rose-50 rounded-xl shadow-inner text-rose-400"><Star fill="currentColor" size={16} /></div>
                    <div>
                      <p className="text-[7px] md:text-[9px] font-black text-rose-300 uppercase tracking-[0.2em] leading-none mb-1">הניקוד שצברת</p>
                      <span className="font-black text-slate-800 text-sm md:text-4xl tracking-tighter">{(user?.points || 0).toLocaleString()} <small className="text-[10px] md:text-lg opacity-40 font-bold">PTS</small></span>
                    </div>
                </div>
                <Link to="/lottery" className="bg-slate-900 text-white px-5 md:px-12 py-2 md:py-4 rounded-xl md:rounded-2xl text-[10px] md:text-sm font-black hover:bg-rose-600 transition-all shadow-xl active:scale-95 flex items-center gap-2">כניסה להגרלות <ChevronLeft size={16}/></Link>
             </div>
          ) : (
            <div className="bg-white/80 backdrop-blur-xl p-6 md:p-14 rounded-[2.5rem] md:rounded-[4rem] text-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10 shadow-sm border border-rose-100/40">
                <div className="text-center md:text-right space-y-2 md:space-y-4 relative z-10">
                    <h3 className="text-xl md:text-4xl font-black flex items-center justify-center md:justify-start gap-3 text-rose-600 tracking-tight">
                       <Sparkles size={20} md:size={28} className="text-rose-400 animate-pulse" /> 
                       {user?.isMemberRequested ? 'הבקשה שלך בטיפול' : 'ברוכה הבאה למעגל הנשי'}
                    </h3>
                    <p className="text-xs md:text-lg text-slate-500 font-medium max-w-xl leading-relaxed">
                       {user?.isMemberRequested 
                         ? 'המנהלת בודקת את פרטייך. בקרוב כל התוכן הבלעדי וההטבות יפתחו בפנייך.'
                         : 'המקום שלך לגלות את כל מה שקורה בעיר, להכיר נשות עשייה וליהנות מהטבות ייחודיות.'}
                    </p>
                </div>
                {!user?.isMemberRequested && (
                  <button 
                    onClick={() => user ? setShowMembershipModal(true) : onOpenLogin()} 
                    className="bg-rose-500 text-white px-8 md:px-16 py-3 md:py-5 rounded-full font-black text-xs md:text-lg shadow-[0_15px_30px_rgba(244,63,94,0.3)] hover:bg-slate-900 transition-all active:scale-95 relative z-10 flex items-center gap-3"
                  >
                    <HeartHandshake size={20} /> הצטרפי עכשיו
                  </button>
                )}
            </div>
          )}
        </div>

        {/* הגרלה פעילה - עיצוב משופר */}
        {upcomingLottery && user?.isMemberApproved && (
            <Link to="/lottery" className="block animate-fade-in-up mx-1 group">
                <div className="bg-gradient-to-l from-rose-50 to-rose-100/40 backdrop-blur-md rounded-[2rem] md:rounded-[3.5rem] p-4 md:p-10 shadow-sm border border-rose-200/50 flex items-center justify-between overflow-hidden relative">
                    <div className="flex items-center gap-4 md:gap-8 relative z-10">
                        <div className="w-12 h-12 md:w-20 md:h-20 bg-white rounded-2xl md:rounded-[2.5rem] flex items-center justify-center text-rose-500 border border-rose-100 shadow-sm group-hover:rotate-6 transition-transform">
                            <Gift size={24} md:size={40} className="animate-bounce" />
                        </div>
                        <div className="text-slate-800">
                            <h3 className="font-black text-sm md:text-3xl tracking-tight mb-1">הגרלת השבוע בעיצומה!</h3>
                            <p className="text-[9px] md:text-base text-rose-500 font-black uppercase tracking-widest opacity-70">הפרס המפנק: {upcomingLottery.prize}</p>
                        </div>
                    </div>
                    <div className="text-left bg-white/80 px-4 md:px-8 py-2 md:py-4 rounded-2xl md:rounded-3xl border border-rose-100 shadow-sm">
                        <p className="text-[7px] md:text-[11px] text-rose-300 font-black uppercase mb-1 tracking-widest">זמן נותר:</p>
                        <div className="font-mono text-sm md:text-3xl font-black text-rose-600 flex items-center gap-2">
                            <Clock size={16} md:size={24} /> {timeLeft}
                        </div>
                    </div>
                </div>
            </Link>
        )}

        {/* סליידר אירועים ראשי - UI/UX משודרג ומרחף */}
        <section className="relative h-[300px] md:h-[500px] w-full overflow-hidden rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_30px_60px_-15px_rgba(168,85,247,0.25)] mx-0 border-0 transition-all duration-500">
            {displayEvents && displayEvents.length > 0 ? displayEvents.map((event, index) => (
            <div key={event.id || index} className={`absolute inset-0 transition-all duration-1000 ease-out ${index === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}>
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${event.image})` }}></div>
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/80 via-slate-900/10 to-transparent"></div>
                
                <div className="absolute bottom-0 left-0 p-6 md:p-14 text-left w-full flex flex-col items-start z-20">
                    <div className="inline-flex items-center gap-1.5 bg-purple-600/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-[8px] md:text-[10px] font-black uppercase mb-2 shadow-lg tracking-widest border border-white/20">
                      <Sparkles size={10} className="text-amber-300" /> אירוע נבחר
                    </div>
                    <h2 className="text-2xl md:text-5xl font-black text-white mb-2 md:mb-4 tracking-tight drop-shadow-2xl">{event.title}</h2>
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 justify-start text-white/90 font-bold mb-4 md:mb-6">
                       <p className="flex items-center gap-1.5 text-[9px] md:text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                          <MapPin size={12} className="text-rose-400" /> {event.location}
                       </p>
                       <p className="flex items-center gap-1.5 text-[9px] md:text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                          <Calendar size={12} className="text-rose-400" /> {event.date ? new Date(event.date).toLocaleDateString('he-IL') : ''}
                       </p>
                    </div>
                    <Link to="/events" className="inline-flex items-center gap-2 bg-white text-slate-900 px-6 md:px-10 py-2.5 md:py-4 rounded-2xl font-black text-[10px] md:text-sm hover:bg-purple-600 hover:text-white transition-all shadow-xl active:scale-95 group">
                      לפרטים והרשמה <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform"/>
                    </Link>
                </div>
            </div>
            )) : (
              <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300 text-xs italic">טוען אירועים...</div>
            )}
            <div className="absolute bottom-6 right-1/2 translate-x-1/2 flex gap-2 z-20 bg-black/10 backdrop-blur-md p-1.5 rounded-full">
              {displayEvents && displayEvents.map((_, i) => (
                <button key={i} onClick={() => setCurrentSlide(i)} className={`h-1.5 rounded-full transition-all duration-500 ${i === currentSlide ? 'w-8 bg-white shadow-sm' : 'w-1.5 bg-white/40'}`}></button>
              ))}
            </div>
        </section>

        {/* קטגוריות */}
        <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar px-1">
            <button onClick={() => navigate('/classes')} 
                    className="flex items-center gap-2 px-5 md:px-8 py-3 md:py-4 bg-slate-900 rounded-xl md:rounded-2xl text-[9px] md:text-xs font-black text-white shadow-xl transition-all flex-shrink-0 active:scale-95 border-b-2 border-purple-500/50">
              <GraduationCap size={16} className="text-purple-400" /> חוגי המעגל
            </button>
            <Link to="/personality-archive" className="flex items-center gap-2 px-5 md:px-8 py-3 md:py-4 bg-purple-500 rounded-xl md:rounded-2xl text-[9px] md:text-xs font-black text-white shadow-xl transition-all flex-shrink-0 active:scale-95 border-b-2 border-white/20">
              <Users size={16} className="text-purple-100" /> נשות המעגל
            </Link>
            {categories.map((cat, idx) => (
              <button key={idx} onClick={() => navigate('/events', { state: { category: cat.name } })} 
                      className="flex items-center gap-1.5 px-5 md:px-7 py-3 md:py-4 bg-white rounded-xl text-[9px] md:text-xs font-bold text-slate-500 shadow-sm border border-rose-50 hover:border-purple-200 transition-all flex-shrink-0 active:shadow-md">
                <span className="text-rose-300">{cat.icon}</span>{cat.name}
              </button>
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-16">
            <div className="lg:col-span-2 space-y-10 md:space-y-20">
                
                {/* אשת השבוע - חזר למקומו בעיצוב פרימיום */}
                {personality && personality.name && (
                    <section className="animate-fade-in px-1">
                        <div className="flex items-center justify-between mb-6 px-4">
                            <h3 className="text-xl md:text-3xl font-black text-slate-800">הכרות עם נשות המעגל</h3>
                            <Link to="/personality-archive" className="text-rose-500 font-black text-xs md:text-sm flex items-center gap-1 hover:underline">כל הראיונות <ChevronLeft size={14}/></Link>
                        </div>
                        <Link to={`/interview/${personality._id || personality.id}`} className="block bg-white rounded-[3rem] md:rounded-[4rem] p-4 md:p-12 shadow-sm border border-rose-50 hover:shadow-xl transition-all duration-700 group relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-rose-50 rounded-full blur-[80px] -mr-20 -mt-20 opacity-60"></div>
                            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-14 relative z-10">
                                <div className="relative shrink-0">
                                    <div className="absolute inset-0 bg-rose-200 rounded-2xl md:rounded-[3.5rem] rotate-6 group-hover:rotate-12 transition-transform"></div>
                                    <img src={personality.image} className="w-32 h-32 md:w-64 md:h-64 rounded-2xl md:rounded-[3.5rem] object-cover shadow-2xl border-4 border-white relative z-10" alt={personality.name} />
                                    <div className="absolute -bottom-3 -right-3 md:-bottom-6 md:-right-6 bg-amber-400 p-2 md:p-4 rounded-2xl md:rounded-3xl text-white shadow-xl z-20"><Sparkles size={20} md:size={32} className="animate-pulse"/></div>
                                </div>
                                <div className="text-center md:text-right space-y-3 md:space-y-6 flex-1">
                                    <span className="text-[8px] md:text-xs font-black text-rose-500 uppercase tracking-[0.3em] bg-rose-50 px-4 py-1.5 rounded-full inline-block">Personality Spotlight</span>
                                    <div>
                                        <h3 className="text-2xl md:text-6xl font-black text-slate-900 leading-tight tracking-tighter group-hover:text-rose-600 transition-colors">{personality.name}</h3>
                                        <p className="text-xs md:text-2xl text-slate-400 font-bold tracking-wide mt-1 md:mt-2">{personality.role}</p>
                                    </div>
                                    <div className="relative pt-4 md:pt-8 border-t border-rose-50">
                                        <Quote size={20} md:size={40} className="text-rose-100 absolute -top-2 md:-top-4 -right-2 md:-right-4" />
                                        <p className="text-sm md:text-2xl text-slate-600 font-serif italic leading-relaxed line-clamp-3">
                                            "{personality.motto || 'סיפור של עשייה, השראה וחיבור לקהילה...'}"
                                        </p>
                                    </div>
                                    <div className="text-[9px] md:text-sm font-black text-rose-400 group-hover:gap-4 flex items-center gap-2 transition-all mx-auto md:mr-0 pt-2">
                                        קראי את הראיון המלא <ChevronLeft size={14} md:size={20} />
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </section>
                )}

                {/* חוגי המעגל - החליף את חדשות המעגל */}
                <div className="space-y-4 px-1">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-lg md:text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                        <GraduationCap className="text-purple-400" size={24}/> חוגים והעשרה
                      </h3>
                      <Link to="/classes" className="text-purple-500 font-black text-xs md:text-sm flex items-center gap-1 hover:underline">כל החוגים <ChevronLeft size={14}/></Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                        {classes.slice(0, 4).map((cls, idx) => (
                            <div key={cls._id || idx} className="bg-white p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-sm border border-rose-100/50 flex items-center gap-4 md:gap-8 group hover:bg-rose-50/30 transition-all cursor-pointer">
                                <div className="w-16 h-16 md:w-24 md:h-24 bg-rose-50 rounded-2xl md:rounded-[2rem] overflow-hidden shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                                    <img src={cls.image} className="w-full h-full object-cover" alt={cls.title} />
                                </div>
                                <div className="text-right flex-1 overflow-hidden">
                                    <h4 className="font-black text-slate-800 text-sm md:text-2xl group-hover:text-rose-600 transition-colors truncate mb-1 md:mb-2">{cls.title}</h4>
                                    <p className="text-slate-400 text-[10px] md:text-lg line-clamp-1 font-medium leading-tight">{cls.instructor} | {cls.day}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* קהילה - גריד ללא גלילה במחשב */}
                {communityItems && communityItems.length > 0 && (
                    <section className="space-y-4 md:space-y-8 animate-fade-in px-2">
                        <div className="flex items-center justify-between px-1">
                          <h3 className="text-lg md:text-3xl font-black text-slate-800 flex items-center gap-3 px-1 tracking-tight">
                              <HeartHandshake className="text-rose-400" size={20} md:size={32}/> שירותי קהילה
                          </h3>
                          <Link to="/community" className="text-rose-400 font-black text-xs md:text-sm flex items-center gap-1 hover:underline">לכל השירותים <ChevronLeft size={14}/></Link>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
                            {communityItems.slice(0, 6).map((item, idx) => (
                                <div key={item._id || item.id || idx} className="bg-white p-3 md:p-6 rounded-[2rem] md:rounded-[3rem] shadow-sm border border-rose-100/50 flex flex-col gap-3 md:gap-5 group hover:border-rose-400 hover:shadow-xl transition-all duration-500">
                                    <img src={item.image} className="w-full h-32 md:h-48 rounded-[1.5rem] md:rounded-[2.5rem] object-cover shadow-sm group-hover:scale-105 transition-transform" />
                                    <div className="text-right px-1">
                                        <span className="text-[7px] md:text-[10px] font-black text-rose-300 uppercase block mb-1">{item.category}</span>
                                        <h4 className="font-black text-slate-800 text-xs md:text-xl truncate leading-tight">{item.title}</h4>
                                        <p className="text-slate-400 text-[9px] md:text-sm flex items-center gap-1 mt-0.5"><MapPin size={12}/> {item.location}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* סיידבר */}
            <div className="space-y-6 md:space-y-12 px-1 md:px-0">
                <div className="bg-slate-900 rounded-[2rem] md:rounded-[4rem] p-6 md:p-12 text-white relative overflow-hidden shadow-2xl text-right group">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/20 rounded-full blur-[80px] -mr-16 -mt-16"></div>
                    <div className="relative z-10 space-y-4 md:space-y-10">
                        <Quote className="text-rose-400 -mb-2 md:-mb-4 group-hover:rotate-12 transition-transform" size={24} md:size={48} />
                        <p className="text-lg md:text-4xl font-serif italic leading-[1.4] tracking-tight">
                            "{latestInspiration.text}"
                        </p>
                        <div className="flex items-center gap-3 justify-end pt-4 md:pt-10 border-t border-white/10">
                            <span className="text-[8px] md:text-xs font-black opacity-30 tracking-[0.4em] uppercase">Inspiration</span>
                            <div className="px-3 md:px-6 py-1 md:py-2 rounded-full bg-rose-500 text-white font-black text-[9px] md:text-lg shadow-lg">
                                {latestInspiration.author}
                            </div>
                        </div>
                    </div>
                </div>

                {/* הודעות הנהלה */}
                {announcements && announcements.length > 0 && (
                    <div className="space-y-4">
                       <h3 className="text-sm md:text-xl font-black text-slate-800 flex items-center gap-2 px-2 uppercase tracking-widest"><Megaphone size={18} className="text-purple-500"/> הודעות הנהלה</h3>
                        <div className="space-y-4">
                          {announcements.slice(0, 3).map((ann, idx) => (
                              <div key={ann._id || idx} className="bg-gradient-to-br from-white to-purple-50/30 p-5 md:p-10 border-2 border-rose-100 shadow-sm hover:border-rose-300 transition-all animate-fade-in-up">
                                 <h4 className="font-black text-rose-600 text-xs md:text-xl tracking-tight mb-2 md:mb-4">{ann.title}</h4>
                                 <p className="text-[10px] md:text-lg text-slate-600 leading-relaxed font-bold opacity-80">{ann.content}</p>
                              </div>
                          ))}
                        </div>
                    </div>
                )}

                {!user ? (
                    <div onClick={onOpenLogin} className="cursor-pointer bg-white rounded-[2rem] md:rounded-[4rem] p-6 md:p-14 text-center space-y-4 md:space-y-8 hover:translate-y-[-5px] transition-all border border-rose-100 shadow-xl flex flex-col items-center group">
                        <div className="w-16 h-16 md:w-28 md:h-28 bg-rose-50 rounded-[1.5rem] md:rounded-[2.5rem] flex items-center justify-center text-rose-500 shadow-inner group-hover:scale-110 transition-transform"><HeartHandshake size={32} md:size={56} /></div>
                        <div className="space-y-2">
                          <h3 className="text-sm md:text-3xl font-black text-slate-800 tracking-tight">הצטרפי אלינו</h3>
                          <p className="text-[10px] md:text-lg text-slate-400 font-medium leading-tight px-4">תהיי חלק מהמעגל הנשי המשפיע ביותר בעיר.</p>
                        </div>
                        <button className="bg-rose-500 text-white px-10 md:px-20 py-3 md:py-6 rounded-2xl md:rounded-[2rem] font-black text-xs md:text-xl shadow-xl hover:bg-rose-600 transition-all active:scale-95">הרשמה מהירה</button>
                    </div>
                ) : (
                  <div className="bg-white/60 backdrop-blur-xl p-6 md:p-14 rounded-[2rem] md:rounded-[4rem] shadow-sm border border-rose-100/50 text-center space-y-4 md:space-y-8 flex flex-col items-center">
                      <div className="w-14 h-14 md:w-24 md:h-24 bg-rose-50 rounded-[1.5rem] md:rounded-[2.5rem] flex items-center justify-center mx-auto text-rose-400 shadow-inner"><Phone size={24} md:size={48}/></div>
                      <div className="space-y-2">
                        <h3 className="text-sm md:text-2xl font-black text-slate-800">אנחנו כאן בשבילך</h3>
                        <p className="text-[10px] md:text-lg text-slate-400 font-medium px-4">לכל שאלה, הצעה או שיתוף פעולה במעגל.</p>
                      </div>
                      <a href="tel:0500000000" className="block w-full py-4 md:py-7 bg-white text-slate-900 rounded-2xl md:rounded-[2rem] font-black text-xs md:text-xl hover:bg-rose-50 transition-all border-2 border-rose-100 shadow-sm">חיוג מהיר למשרד</a>
                  </div>
                )}
            </div>
        </div>
      </div>

      {/* מודאל הצטרפות */}
      {showMembershipModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-right">
              <div className="bg-white rounded-[2rem] md:rounded-[4rem] w-full max-w-xl p-6 md:p-16 relative shadow-2xl border border-white mx-3 overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-rose-500"></div>
                  <button onClick={() => setShowMembershipModal(false)} className="absolute top-6 left-6 p-2 hover:bg-rose-50 rounded-full text-slate-300 transition-colors"><X size={24}/></button>
                  <div className="text-right space-y-6 md:space-y-10">
                      <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-400 shadow-inner"><Sparkles size={32}/></div>
                      <div className="space-y-2">
                        <h2 className="text-2xl md:text-5xl font-black text-slate-800 tracking-tighter">בקשת הצטרפות</h2>
                        <p className="text-xs md:text-xl text-slate-400 font-bold">מלאי פרטים והמתיני לאישור המנהלת</p>
                      </div>
                      <form onSubmit={handleMembershipSubmit} className="space-y-4 md:space-y-8 pt-6 border-t border-rose-50">
                          <div className="grid grid-cols-2 gap-4 md:gap-8">
                            <input required autoComplete="age" type="number" placeholder="גיל" className="p-4 md:p-7 bg-rose-50/50 rounded-2xl md:rounded-3xl font-bold text-sm md:text-2xl text-right outline-none focus:ring-2 focus:ring-rose-200 transition-all" value={membershipForm.age} onChange={e=>setMembershipForm({...membershipForm, age: e.target.value})}/>
                            <input required autoComplete="organization-title" type="text" placeholder="עיסוק" className="p-4 md:p-7 bg-rose-50/50 rounded-2xl md:rounded-3xl font-bold text-sm md:text-2xl text-right outline-none focus:ring-2 focus:ring-rose-200 transition-all" value={membershipForm.occupation} onChange={e=>setMembershipForm({...membershipForm, occupation: e.target.value})}/>
                          </div>
                          <input required autoComplete="street-address" type="text" placeholder="כתובת מגורים" className="w-full p-4 md:p-7 bg-rose-50/50 rounded-2xl md:rounded-3xl font-bold text-sm md:text-2xl text-right outline-none focus:ring-2 focus:ring-rose-200 transition-all" value={membershipForm.address} onChange={e=>setMembershipForm({...membershipForm, address: e.target.value})}/>
                          <input required autoComplete="tel" type="tel" placeholder="מספר טלפון" className="w-full p-4 md:p-7 bg-rose-50/50 rounded-2xl md:rounded-3xl font-bold text-sm md:text-2xl text-right outline-none focus:ring-2 focus:ring-rose-200 transition-all" value={membershipForm.phone} onChange={e=>setMembershipForm({...membershipForm, phone: e.target.value})}/>
                          
                          <div className="flex flex-col gap-2 py-2">
                             <div className="flex items-center gap-2">
                                <input id="terms" type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="w-4 h-4 text-purple-600 rounded" />
                                <label htmlFor="terms" className="text-[10px] md:text-xs font-bold text-slate-600">קראתי ואני מאשרת את תקנון מדיניות האתר</label>
                             </div>
                             <button type="button" onClick={() => setShowTermsModal(true)} className="text-[9px] md:text-[11px] text-purple-500 font-black underline w-fit">לחצי לקריאת התקנון המלא</button>
                          </div>

                          <button type="submit" className="w-full py-5 md:py-10 bg-rose-500 text-white rounded-[1.5rem] md:rounded-[3rem] font-black text-sm md:text-3xl shadow-2xl hover:bg-slate-900 transition-all active:scale-95 flex items-center justify-center gap-4 mt-4">
                             <Send size={24}/> שליחת בקשת הצטרפות
                          </button>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {/* מודאל תקנון */}
      {showTermsModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in text-right" dir="rtl">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl p-6 md:p-10 shadow-2xl max-h-[85vh] overflow-y-auto no-scrollbar border-t-8 border-purple-500">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black text-slate-800">תקנון ומדיניות שימוש</h3>
                  <button onClick={() => setShowTermsModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
                </div>
                <div className="space-y-4 text-sm md:text-base leading-relaxed text-slate-600 font-medium">
                  <p className="font-black text-slate-800 underline">כללי</p>
                  <p>ברוכות הבאות לאתר. השימוש באתר ובתכניו כפוף לתקנון ולמדיניות שימוש זו, ומהווה הסכמה מלאה לכל תנאיה.</p>
                  <p className="font-black text-slate-800 underline">מהות האתר ותכניו</p>
                  <p>האתר מהווה מרחב קהילתי לנשים ונערות, שמטרתו שיתוף, השראה, חיבור ויצירת שיח פתוח ומכבד.</p>
                  <p className="font-black text-slate-800 underline">אחריות ושימוש במידע</p>
                  <p>השימוש בתכני האתר ובמידע המפורסם בו נעשה על אחריות המשתמשת בלבד.</p>
                  {/* שאר תוכן התקנון שסיפקת... */}
                  <p>על תקנון זה ועל השימוש באתר יחולו דיני מדינת ישראל בלבד.</p>
                </div>
                <button onClick={() => setShowTermsModal(false)} className="w-full mt-8 py-3 bg-slate-900 text-white font-black rounded-xl">סגירה וחזרה</button>
            </div>
         </div>
      )}
    </div>
  );
};

export default HomePage;