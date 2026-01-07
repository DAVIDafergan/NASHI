import React, { useState, useEffect } from 'react';
import { 
  Bell, Star, Music, Palette, Activity, Briefcase, Mic, Gift, Clock, Sparkles,
  X, Send, MapPin, Phone, HeartHandshake, Quote, GraduationCap, ChevronLeft, ChevronRight, ExternalLink,
  Users, Megaphone, Calendar // נוסף הייבוא החסר כאן
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

const API_URL = 'https://nashi-production.up.railway.app/api';

const HomePage = ({ user, onOpenLogin, onUpdateUser }: { user: any, onOpenLogin: () => void, onUpdateUser?: (u: any) => void }) => {
  const navigate = useNavigate();
  
  const [events, setEvents] = useState<EventItem[]>([]);
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
        const [evRes, lotRes, adsRes, persData, commData, inspData, annData] = await Promise.all([
          fetch(`${API_URL}/events`).then(res => res.json()).catch(() => []),
          fetch(`${API_URL}/lotteries`).then(res => res.json()).catch(() => []),
          fetch(`${API_URL}/ads`).then(res => res.json()).catch(() => []),
          api.getPersonality().catch(() => null),
          api.getCommunityItems().catch(() => []),
          api.getInspirations().catch(() => []),
          api.getAnnouncements().catch(() => []) 
        ]);

        setEvents(Array.isArray(evRes) ? evRes.map((e: any) => ({...e, id: e._id || e.id})) : []);
        setLotteries(Array.isArray(lotRes) ? lotRes.map((l: any) => ({...l, id: l._id || l.id})) : []);
        setAds(Array.isArray(adsRes) ? adsRes : []);
        setPersonality(persData);
        setCommunityItems(Array.isArray(commData) ? commData : []);
        setInspirations(Array.isArray(inspData) ? inspData : []);
        setAnnouncements(Array.isArray(annData) ? annData : []); 
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

  const categories = [
    { name: 'מוזיקה', icon: <Music size={12} /> },
    { name: 'אמנות', icon: <Palette size={12} /> },
    { name: 'סדנאות', icon: <Activity size={12} /> },
    { name: 'קריירה', icon: <Briefcase size={12} /> },
    { name: 'העשרה', icon: <Mic size={12} /> },
    { name: 'קהילה', icon: <HeartHandshake size={12} /> },
  ];

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
                <video 
                  src={ad.content} 
                  autoPlay muted playsInline
                  onEnded={() => setCurrentAdIndex((prev) => (prev + 1) % ads.length)}
                  className="w-full h-full object-cover"
                />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-l from-black/40 to-transparent flex items-center justify-end px-6">
             <div className="text-right text-white">
                <p className="text-[6px] md:text-[8px] font-bold opacity-70 uppercase tracking-widest mb-0.5">בשיתוף פעולה</p>
                <h4 className="text-[10px] md:text-sm font-black leading-tight">{ad.title || ''}</h4>
             </div>
          </div>
          <div className="absolute bottom-1.5 left-1.5 bg-white/20 backdrop-blur-md p-1 rounded-md border border-white/10">
            <ExternalLink size={8} className="text-white" />
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
          <p className="text-purple-300 text-[10px] font-black tracking-widest animate-pulse uppercase">טוען רגעים נשיים...</p>
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
          <div className="absolute top-1/3 left-0 w-[200px] h-[200px] bg-amber-50/20 rounded-full blur-[80px] -ml-20"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-4 md:pt-10 relative z-10 space-y-6 md:space-y-10">
        
        {/* באנר פרסומת */}
        {renderAdBanner()}

        {/* גישה להגרלות בנייד - חדש */}
        <div className="md:hidden mx-1">
          <Link to="/lottery" className="flex items-center justify-between bg-gradient-to-r from-purple-500 to-rose-500 p-4 rounded-2xl text-white shadow-lg shadow-purple-200 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl"><Gift size={20}/></div>
              <span className="font-black text-sm">הגרלות והטבות היום</span>
            </div>
            <ChevronLeft size={20}/>
          </Link>
        </div>

        {/* סטטוס משתמש */}
        <div className="mx-1 hidden md:block">
          {user?.isMemberApproved ? (
             <div className="bg-white/60 backdrop-blur-md p-3 md:p-5 rounded-2xl md:rounded-3xl border border-rose-100/50 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="p-2 md:p-3 bg-rose-50 rounded-xl shadow-inner text-rose-400"><Star fill="currentColor" size={16} /></div>
                    <div>
                      <p className="text-[7px] md:text-[9px] font-black text-rose-300 uppercase tracking-widest leading-none mb-1">הניקוד שצברת</p>
                      <span className="font-black text-slate-800 text-xs md:text-2xl tracking-tighter">{(user?.points || 0).toLocaleString()} <small className="text-[8px] md:text-xs opacity-40 font-bold">PTS</small></span>
                    </div>
                </div>
                <Link to="/lottery" className="bg-slate-900 text-white px-5 md:px-8 py-1.5 md:py-3 rounded-xl text-[8px] md:text-xs font-black hover:bg-purple-600 transition-all shadow-md flex items-center gap-1.5">כניסה להגרלות <ChevronLeft size={14}/></Link>
             </div>
          ) : (
            <div className="bg-white/70 backdrop-blur-md p-4 md:p-10 rounded-[2rem] md:rounded-[3rem] text-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm border border-purple-50">
                <div className="text-center md:text-right space-y-1 md:space-y-2 relative z-10">
                    <h3 className="text-sm md:text-2xl font-black flex items-center justify-center md:justify-start gap-2 text-purple-600">
                       <Sparkles size={16} md:size={20} className="text-rose-400" /> {user?.isMemberRequested ? 'הבקשה בטיפול' : 'ברוכה הבאה למעגל'}
                    </h3>
                    <p className="text-[10px] md:text-sm text-slate-400 font-medium max-w-md">גלי עולם של תרבות, קהילה והטבות בלעדיות לנשות העיר.</p>
                </div>
                {!user?.isMemberRequested && (
                  <button onClick={() => user ? setShowMembershipModal(true) : onOpenLogin()} className="bg-rose-500 text-white px-6 md:px-10 py-2 md:py-3.5 rounded-full font-black text-[10px] md:text-sm shadow-lg hover:bg-purple-600 transition-all active:scale-95 flex items-center gap-2">
                    <HeartHandshake size={16} /> הצטרפי עכשיו
                  </button>
                )}
            </div>
          )}
        </div>

        {/* סליידר אירועים ראשי - עיצוב מרחף ללא מסגרת בנייד */}
        <section className="relative h-[300px] md:h-[450px] w-full overflow-hidden rounded-[2rem] md:rounded-[3rem] shadow-[0_20px_50px_rgba(168,85,247,0.15)] mx-0 border-0 md:border-[8px] md:border-white transition-all duration-500">
            {displayEvents && displayEvents.length > 0 ? displayEvents.map((event, index) => (
            <div key={event.id || index} className={`absolute inset-0 transition-all duration-1000 ease-out ${index === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}>
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${event.image})` }}></div>
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/70 via-transparent to-transparent"></div>
                
                <div className="absolute bottom-0 left-0 p-6 md:p-10 text-left w-full flex flex-col items-start">
                    <div className="inline-flex items-center gap-1 bg-purple-600/90 text-white px-3 py-1 rounded-full text-[8px] md:text-[10px] font-black uppercase mb-2 shadow-lg">
                      <Sparkles size={10} /> אירוע נבחר
                    </div>
                    <h2 className="text-xl md:text-4xl font-black text-white mb-2 md:mb-4 leading-tight tracking-tight drop-shadow-md">{event.title}</h2>
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 justify-start text-white/90 font-bold mb-4 md:mb-6">
                       <p className="flex items-center gap-1 text-[9px] md:text-sm bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
                          <MapPin size={12} className="text-purple-400" /> {event.location}
                       </p>
                       <p className="flex items-center gap-1 text-[9px] md:text-sm bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
                          <Calendar size={12} className="text-purple-400" /> {event.date ? new Date(event.date).toLocaleDateString('he-IL') : ''}
                       </p>
                    </div>
                    <Link to="/events" className="inline-flex items-center gap-2 bg-white text-slate-900 px-6 md:px-10 py-2 md:py-4 rounded-2xl font-black text-[10px] md:text-sm hover:bg-purple-600 hover:text-white transition-all shadow-2xl active:scale-95 group">
                      לפרטים והרשמה <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform"/>
                    </Link>
                </div>
            </div>
            )) : (
              <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-200 text-xs italic">אין אירועים להצגה כרגע</div>
            )}
            <div className="absolute bottom-6 right-1/2 translate-x-1/2 flex gap-2 z-20">
              {displayEvents && displayEvents.map((_, i) => (
                <button key={i} onClick={() => setCurrentSlide(i)} className={`h-1.5 rounded-full transition-all ${i === currentSlide ? 'w-8 bg-white shadow-sm' : 'w-1.5 bg-white/40'}`}></button>
              ))}
            </div>
        </section>

        {/* קטגוריות */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-1">
            <button onClick={() => navigate('/classes')} 
                    className="flex items-center gap-1.5 px-4 md:px-7 py-2 md:py-4 bg-slate-900 rounded-xl md:rounded-2xl text-[9px] md:text-xs font-black text-white shadow-md flex-shrink-0 active:scale-95">
              <GraduationCap size={14} md:size={18} className="text-purple-300" /> חוגי המעגל
            </button>
            <Link to="/personality-archive" className="flex items-center gap-1.5 px-4 md:px-7 py-2 md:py-4 bg-purple-500 rounded-xl md:rounded-2xl text-[9px] md:text-xs font-black text-white shadow-md flex-shrink-0 active:scale-95">
              <Users size={14} md:size={18} className="text-purple-100" /> נשות המעגל
            </Link>
            {categories.map((cat, idx) => (
              <button key={idx} onClick={() => navigate('/events', { state: { category: cat.name } })} 
                      className="flex items-center gap-1.5 px-4 md:px-6 py-2 md:py-4 bg-white rounded-xl md:rounded-2xl text-[9px] md:text-xs font-bold text-slate-500 shadow-sm border border-rose-50 hover:border-purple-200 transition-all flex-shrink-0">
                <span className="text-rose-300">{cat.icon}</span>{cat.name}
              </button>
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10">
            <div className="lg:col-span-2 space-y-8 md:space-y-12">
                
                {/* אשת השבוע - תיקון לינק */}
                {personality && personality.name && (
                    <section className="animate-fade-in px-1">
                        <div className="flex items-center justify-between mb-4 px-2">
                            <h3 className="text-sm md:text-lg font-black text-slate-800 tracking-tight">הכרות עם נשות המעגל</h3>
                            <Link to="/personality-archive" className="text-rose-400 font-black text-[9px] md:text-xs flex items-center gap-0.5 hover:underline">כל הראיונות <ChevronLeft size={10}/></Link>
                        </div>
                        <Link to={`/personality-archive`} className="block bg-white rounded-[2rem] p-4 md:p-8 shadow-sm border border-rose-50 hover:shadow-md transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full blur-[60px] opacity-40"></div>
                            <div className="flex flex-col md:flex-row items-center gap-5 md:gap-10 relative z-10">
                                <div className="relative shrink-0">
                                    <div className="absolute inset-0 bg-purple-100 rounded-2xl md:rounded-3xl rotate-3 group-hover:rotate-6 transition-transform"></div>
                                    <img src={personality.image} className="w-24 h-24 md:w-44 md:h-44 rounded-2xl md:rounded-3xl object-cover shadow-lg border-2 border-white relative z-10" alt={personality.name} />
                                    <div className="absolute -bottom-2 -right-2 bg-amber-400 p-1.5 md:p-2 rounded-lg text-white shadow-md z-20"><Sparkles size={14} md:size={18}/></div>
                                </div>
                                <div className="text-center md:text-right space-y-1.5 md:space-y-4 flex-1">
                                    <span className="text-[7px] md:text-[9px] font-black text-purple-400 uppercase tracking-widest bg-purple-50 px-3 py-1 rounded-full inline-block">Spotlight</span>
                                    <div>
                                        <h3 className="text-lg md:text-3xl font-black text-slate-900 leading-tight tracking-tight group-hover:text-rose-600 transition-colors">{personality.name}</h3>
                                        <p className="text-[9px] md:text-sm text-slate-400 font-bold mt-0.5">{personality.role}</p>
                                    </div>
                                    <div className="relative pt-3 md:pt-4 border-t border-rose-50">
                                        <Quote size={14} md:size={20} className="text-rose-100 absolute -top-1 md:-top-2 -right-1" />
                                        <p className="text-[10px] md:text-base text-slate-500 font-serif italic leading-relaxed line-clamp-2">
                                            "{personality.motto || 'סיפור של עשייה, השראה וחיבור לקהילה...'}"
                                        </p>
                                    </div>
                                    <div className="text-[8px] md:text-xs font-black text-rose-400 group-hover:gap-2 flex items-center gap-1 transition-all pt-1">
                                        צפי בארכיון הנשים <ChevronLeft size={12} />
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </section>
                )}

                {/* קהילה - תצוגת גריד ללא גלילה במחשב */}
                {communityItems && communityItems.length > 0 && (
                    <section className="space-y-4 animate-fade-in px-1">
                        <div className="flex items-center justify-between px-1">
                          <h3 className="text-sm md:text-lg font-black text-slate-800 flex items-center gap-2">
                              <HeartHandshake className="text-rose-400" size={18}/> שירותי קהילה
                          </h3>
                          <Link to="/community" className="text-rose-400 font-black text-[9px] md:text-xs flex items-center gap-0.5 hover:underline">לכל השירותים <ChevronLeft size={10}/></Link>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 overflow-x-auto md:overflow-visible pb-2 no-scrollbar">
                            {communityItems.slice(0, 6).map((item, idx) => (
                                <div key={item._id || item.id || idx} className="bg-white p-2.5 md:p-3.5 rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-rose-50 group hover:border-purple-200 transition-all flex-shrink-0 md:flex-shrink w-44 md:w-auto">
                                    <img src={item.image} className="w-full h-24 md:h-36 rounded-xl md:rounded-2xl object-cover mb-1 group-hover:scale-105 transition-transform" />
                                    <div className="text-right px-1">
                                        <span className="text-[6px] md:text-[8px] font-black text-purple-300 uppercase block mb-0.5">{item.category}</span>
                                        <h4 className="font-black text-slate-800 text-[10px] md:text-sm truncate">{item.title}</h4>
                                        <p className="text-slate-400 text-[7px] md:text-[9px] flex items-center gap-1 mt-0.5"><MapPin size={8}/> {item.location}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* חדשות המעגל - ללא גלילה במחשב */}
                <div className="space-y-4 px-1">
                    <h3 className="text-sm md:text-lg font-black text-slate-800 flex items-center gap-2 px-1 tracking-tight"><Bell className="text-rose-400" size={18}/> חדשות המעגל</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        {[
                          { id: '1', title: 'פתיחת עונת התרבות', description: 'אירוע פתיחה חגיגי בהיכל התרבות.', date: '10/05' },
                          { id: '2', title: 'סדנת מנהיגות נשית', description: 'הרשמה למחזור החדש של קורס מנהיגות.', date: '12/05' },
                        ].map((item) => (
                            <div key={item.id} className="bg-white p-3 md:p-4 rounded-[1.5rem] shadow-sm border border-rose-50 flex items-center gap-4 group hover:bg-purple-50/30 transition-all cursor-pointer">
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-rose-50 rounded-xl flex flex-col items-center justify-center text-rose-500 shrink-0 font-black border border-rose-100 shadow-inner group-hover:bg-rose-500 group-hover:text-white transition-colors">
                                    <span className="text-xs md:text-lg">{item.date.split('/')[0]}</span>
                                    <span className="text-[6px] md:text-[8px] opacity-60 uppercase">{item.date.split('/')[1]}</span>
                                </div>
                                <div className="text-right flex-1 overflow-hidden">
                                    <h4 className="font-black text-slate-800 text-[11px] md:text-sm group-hover:text-rose-600 transition-colors truncate mb-0.5">{item.title}</h4>
                                    <p className="text-slate-400 text-[9px] md:text-xs line-clamp-1 font-medium">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* סיידבר */}
            <div className="space-y-6 md:space-y-8 px-1 md:px-0">
                <div className="bg-slate-900 rounded-[2rem] p-6 md:p-8 text-white relative overflow-hidden shadow-xl text-right group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[60px]"></div>
                    <div className="relative z-10 space-y-4">
                        <Quote className="text-rose-400 -mb-2" size={18} md:size={24} />
                        <p className="text-sm md:text-xl font-serif italic leading-relaxed tracking-tight">
                            "{latestInspiration.text}"
                        </p>
                        <div className="flex items-center gap-2 justify-end pt-4 border-t border-white/5">
                            <span className="text-[7px] md:text-[9px] font-black opacity-30 tracking-widest uppercase">Inspiration</span>
                            <div className="px-3 py-1 rounded-full bg-rose-500 text-white font-black text-[8px] md:text-xs">
                                {latestInspiration.author}
                            </div>
                        </div>
                    </div>
                </div>

                {/* כרטיס הודעות מהנהלה - חדש */}
                {announcements && announcements.length > 0 && (
                    <div className="space-y-3">
                       <h3 className="text-[10px] md:text-xs font-black text-slate-400 flex items-center gap-1.5 px-1 uppercase tracking-widest">
                          <Megaphone size={14} className="text-purple-500"/> הודעות הנהלה
                       </h3>
                        <div className="space-y-2">
                          {announcements.map((ann, idx) => (
                              <div key={ann._id || idx} className="bg-gradient-to-br from-white to-purple-50/30 p-4 md:p-6 rounded-[1.2rem] md:rounded-[1.5rem] border border-purple-100 shadow-sm animate-fade-in-up">
                                 <h4 className="font-black text-purple-600 text-[10px] md:text-sm mb-1.5">{ann.title}</h4>
                                 <p className="text-[9px] md:text-xs text-slate-500 leading-normal font-medium opacity-90">{ann.content}</p>
                              </div>
                          ))}
                        </div>
                    </div>
                )}

                {!user ? (
                    <div onClick={onOpenLogin} className="cursor-pointer bg-white rounded-[2rem] p-6 md:p-10 text-center space-y-4 hover:shadow-md transition-all border border-purple-50 shadow-sm flex flex-col items-center">
                       <div className="w-12 h-12 md:w-16 md:h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 shadow-inner"><HeartHandshake size={24} md:size={32} /></div>
                       <div className="space-y-1">
                         <h3 className="text-xs md:text-lg font-black text-slate-800 tracking-tight">הצטרפי אלינו</h3>
                         <p className="text-[9px] md:text-xs text-slate-400 font-medium leading-tight">תהיי חלק מהמעגל הנשי המשפיע.</p>
                       </div>
                       <button className="bg-rose-500 text-white px-8 py-2 md:py-3.5 rounded-full font-black text-[9px] md:text-xs shadow-md active:scale-95">הרשמה מהירה</button>
                    </div>
                ) : (
                  <div className="bg-white/50 backdrop-blur-md p-5 md:p-10 rounded-[2rem] shadow-sm border border-rose-50 text-center space-y-3 flex flex-col items-center">
                      <div className="w-10 h-10 md:w-16 md:h-16 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-400 shadow-inner"><Phone size={20} md:size={28}/></div>
                      <h3 className="text-[10px] md:text-sm font-black text-slate-800 uppercase tracking-widest">אנחנו פה בשבילך</h3>
                      <a href="tel:0500000000" className="block w-full py-2.5 md:py-4 bg-white text-slate-900 rounded-xl md:rounded-2xl font-black text-[9px] md:text-xs border border-rose-100 shadow-sm hover:bg-rose-50 transition-colors">חיוג למשרד</a>
                  </div>
                )}
            </div>
        </div>
      </div>

      {/* מודאל הצטרפות עם תקנון ותמיכה באוטומט */}
      {showMembershipModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-sm animate-fade-in text-right">
              <div className="bg-white rounded-[2rem] md:rounded-[3rem] w-full max-w-lg p-6 md:p-12 relative shadow-2xl border border-white mx-3 overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-purple-500"></div>
                  <button onClick={() => setShowMembershipModal(false)} className="absolute top-6 left-6 p-2 hover:bg-rose-50 rounded-full text-slate-300 transition-colors"><X size={20}/></button>
                  <div className="text-right space-y-6 md:space-y-8">
                      <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-400"><Sparkles size={24}/></div>
                      <div className="space-y-1">
                        <h2 className="text-xl md:text-3xl font-black text-slate-800 tracking-tight">בקשת הצטרפות</h2>
                        <p className="text-[10px] md:text-sm text-slate-400 font-bold">מלאי פרטים והמתיני לאישור</p>
                      </div>
                      <form onSubmit={handleMembershipSubmit} className="space-y-3 md:space-y-5 pt-4 border-t border-rose-50">
                          <div className="grid grid-cols-2 gap-3 md:gap-5">
                            <input required autoComplete="age" type="number" placeholder="גיל" className="p-3 md:p-4 bg-rose-50/30 rounded-xl font-bold text-[10px] md:text-sm text-right outline-none focus:ring-1 focus:ring-rose-200 transition-all" value={membershipForm.age} onChange={e=>setMembershipForm({...membershipForm, age: e.target.value})}/>
                            <input required autoComplete="organization-title" type="text" placeholder="עיסוק" className="p-3 md:p-4 bg-rose-50/30 rounded-xl font-bold text-[10px] md:text-sm text-right outline-none focus:ring-1 focus:ring-rose-200 transition-all" value={membershipForm.occupation} onChange={e=>setMembershipForm({...membershipForm, occupation: e.target.value})}/>
                          </div>
                          <input required autoComplete="street-address" type="text" placeholder="כתובת מגורים" className="w-full p-3 md:p-4 bg-rose-50/30 rounded-xl font-bold text-[10px] md:text-sm text-right outline-none focus:ring-1 focus:ring-rose-200 transition-all" value={membershipForm.address} onChange={e=>setMembershipForm({...membershipForm, address: e.target.value})}/>
                          <input required autoComplete="tel" type="tel" placeholder="מספר טלפון" className="w-full p-3 md:p-4 bg-rose-50/30 rounded-xl font-bold text-[10px] md:text-sm text-right outline-none focus:ring-1 focus:ring-rose-200 transition-all" value={membershipForm.phone} onChange={e=>setMembershipForm({...membershipForm, phone: e.target.value})}/>
                          
                          {/* תיבת אישור תקנון */}
                          <div className="flex flex-col gap-2 py-2">
                             <div className="flex items-center gap-2">
                                <input id="terms" type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="w-4 h-4 text-purple-600 rounded" />
                                <label htmlFor="terms" className="text-[10px] md:text-xs font-bold text-slate-600">קראתי ואני מאשרת את תקנון מדיניות האתר</label>
                             </div>
                             <button type="button" onClick={() => setShowTermsModal(true)} className="text-[9px] md:text-[11px] text-purple-500 font-black underline w-fit">לחצי לקריאת התקנון המלא</button>
                          </div>

                          <button type="submit" className="w-full py-3.5 md:py-5 bg-rose-500 text-white rounded-xl md:rounded-2xl font-black text-[10px] md:text-sm shadow-xl hover:bg-purple-600 transition-all active:scale-95 flex items-center justify-center gap-2 mt-2">
                             <Send size={16}/> שליחת בקשה
                          </button>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {/* מודאל תקנון - תוכן כפי שביקשת */}
      {showTermsModal && (
         <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in text-right" dir="rtl">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl p-6 md:p-10 shadow-2xl max-h-[85vh] overflow-y-auto no-scrollbar border-t-8 border-purple-500">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black text-slate-800">תקנון ומדיניות שימוש באתר</h3>
                  <button onClick={() => setShowTermsModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
                </div>
                <div className="space-y-4 text-sm md:text-base leading-relaxed text-slate-600">
                  <p className="font-black text-slate-800">כללי</p>
                  <p>ברוכות הבאות לאתר. השימוש באתר ובתכניו כפוף לתקנון ולמדיניות שימוש זו, ומהווה הסכמה מלאה לכל תנאיה. הנהלת האתר רשאית לעדכן את התקנון מעת לעת, לפי שיקול דעתה הבלעדי וללא הודעה מוקדמת. נוסח התקנון המעודכן הוא המחייב.</p>
                  
                  <p className="font-black text-slate-800">מהות האתר ותכניו</p>
                  <p>האתר מהווה מרחב קהילתי לנשים ונערות, שמטרתו שיתוף, השראה, חיבור ויצירת שיח פתוח ומכבד. התכנים המפורסמים באתר נכתבים לצורכי שיח, שיתוף דעות וניסיון אישי בלבד. ייתכנו בתכני האתר טעויות, אי־דיוקים או מידע שאינו מעודכן. אין לראות בתכנים המופיעים באתר ייעוץ מקצועי מכל סוג שהוא, לרבות אך לא רק: ייעוץ רפואי, נפשי, משפטי, פיננסי או טיפולי.</p>
                  
                  <p className="font-black text-slate-800">אחריות ושימוש במידע</p>
                  <p>השימוש בתכני האתר ובמידע המפורסם בו נעשה על אחריות המשתמשת בלבד. הנהלת האתר לא תישא בכל אחריות לנזק, ישיר או עקיף, שעלול להיגרם עקב הסתמכות על מידע המופיע באתר או שימוש בו.</p>
                  
                  <p className="font-black text-slate-800">פעילות כספית והתקשרויות חיצוניות</p>
                  <p>האתר אינו עוסק בכספים, תשלומים, תרומות, מכירת מוצרים או קניית כרטיסים, ואינו מהווה צד לכל התקשרות כספית או חוזית המתקיימת מחוץ למסגרת האתר. כל התקשרות בין משתמשות או בין משתמשת לגורם חיצוני נעשית באחריותן הבלעדין של הצדדים המעורבים.</p>
                  
                  <p className="font-black text-slate-800">קישורים ותכנים חיצוניים</p>
                  <p>באתר עשויים להופיע קישורים, הפניות או אזכורים לגורמים חיצוניים. הנהלת האתר אינה אחראית לתוכן, לאמינות, לזמינות או לפעילות של אתרים, שירותים או גורמים חיצוניים אלו, והשימוש בהם הוא באחריות המשתמשת בלבד.</p>
                  
                  <p className="font-black text-slate-800">פרטיות ושמירת מידע</p>
                  <p>האתר מכבד את פרטיות המשתמשות. מסירת מידע אישי, פרסומו או שיתופו באתר נעשים ביוזמת המשתמשת ובאחריותה בלבד. הנהלת האתר אינה אחראית לשימוש שייעשה במידע אישי שפורסם בפומבי על ידי המשתמשת. הנהלת האתר תפעל, ככל שניתן, לשמור על סביבה בטוחה ומכבדת, אך אינה יכולה להבטיח הגנה מלאה מפני שימוש לא ראוי במידע שפורסם.</p>
                  
                  <p className="font-black text-slate-800">התנהלות ושיח קהילתי</p>
                  <p>המשתמשות מתחייבות לנהל שיח מכבד, אחראי ורגיש. הנהלת האתר שומרת לעצמה את הזכות להסיר תכנים, להגביל גישה או לחסום משתמשת, לפי שיקול דעתה, במקרה של הפרת תקנון זה או פגיעה ברוח הקהילה.</p>
                  
                  <p className="font-black text-slate-800">סמכות שיפוט</p>
                  <p>על תקנון זה ועל השימוש באתר יחולו דיני מדינת ישראל בלבד, וסמכות השיפוט הבלעדית נתונה לבתי המשפט המוסמכים בישראל. תקנון זה נועד להבהיר את אופן השימוש באתר ולשמור על קהילה בטוחה, מכבדת ומעצימה.</p>
                </div>
                <button onClick={() => setShowTermsModal(false)} className="w-full mt-8 py-3 bg-slate-900 text-white font-black rounded-xl">סגירה וחזרה</button>
            </div>
         </div>
      )}
    </div>
  );
};

export default HomePage;