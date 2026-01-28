import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, Star, Music, Palette, Activity, Briefcase, Mic, Gift, Clock, Sparkles,
  X, Send, MapPin, Phone, HeartHandshake, Quote, GraduationCap, ChevronLeft, ChevronRight, ExternalLink,
  Users, Megaphone, Calendar, BookOpen, ArrowLeft
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

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

const API_URL = 'https://nashi-production.up.railway.app/api';

const HomePage = ({ user, onOpenLogin, onUpdateUser }: { user: any, onOpenLogin: () => void, onUpdateUser?: (u: any) => void }) => {
  const navigate = useNavigate();
  const mobileSliderRef = useRef<HTMLDivElement>(null);
   
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

  // לוגיקת טעינת נתונים
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

  // סליידר אירועים אוטומטי בנייד
  useEffect(() => {
    const slider = mobileSliderRef.current;
    if (!slider || events.length === 0) return;

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
  }, [events]);

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
      <div className="md:mx-0 animate-fade-in transition-all duration-700 w-full">
        <a href={ad.link || '#'} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden md:rounded-2xl shadow-sm border-b md:border border-rose-50">
          {ad.type === 'image' ? (
            <img src={ad.content} alt={ad.title || 'Ad'} className="w-full h-20 md:h-24 object-cover transition-transform duration-700 group-hover:scale-105" />
          ) : (
            <div className="w-full h-20 md:h-24 bg-slate-900 flex items-center justify-center overflow-hidden">
                <video src={ad.content} autoPlay muted playsInline onEnded={() => setCurrentAdIndex((prev) => (prev + 1) % ads.length)} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-l from-black/60 to-transparent flex items-center justify-end px-6 text-right text-white">
             <div>
                <p className="text-[9px] font-bold opacity-80 uppercase tracking-widest mb-0.5 text-rose-200">בשיתוף</p>
                <h4 className="text-sm md:text-sm font-black leading-tight tracking-wide">{ad.title || ''}</h4>
             </div>
          </div>
        </a>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fffcfc]" dir="rtl">
        <div className="text-center space-y-4">
          <div className="relative w-12 h-12 mx-auto">
             <div className="absolute inset-0 border-4 border-purple-100 rounded-full"></div>
             <div className="absolute inset-0 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-purple-400 text-xs font-bold tracking-widest animate-pulse uppercase font-serif">טוען נתונים...</p>
        </div>
      </div>
    );
  }

  const latestInspiration = inspirations[0] || { text: "הכוח האמיתי של אישה נמצא ביכולת שלה להאיר לאחרות את הדרך.", author: "נ.ש" };

  return (
    <div className="min-h-screen pb-24 relative overflow-x-hidden font-sans text-right bg-[#fffcfc]" dir="rtl">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,rgba(255,245,247,0.8),transparent_70%)]"></div>
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-rose-100/40 rounded-full blur-[120px] opacity-60"></div>
          <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-purple-100/30 rounded-full blur-[80px]"></div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-5xl mx-auto md:px-8 pt-0 md:pt-10 relative z-10 space-y-8 md:space-y-10">
        
        {/* Banner Area */}
        <div className="w-full">{renderAdBanner()}</div>

        {/* --- MOBILE VIEW START (Redesigned) --- */}
        <div className="md:hidden space-y-10 pb-6">
          
          {/* 1. Announcements - Notification Style (FIXED: Full Text) */}
          {announcements.length > 0 && (
            <section className="px-5">
               <div className="flex items-center gap-2 mb-3 opacity-80">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                  <h4 className="text-xs font-black text-slate-500 tracking-wide uppercase">עדכונים חמים</h4>
               </div>
               
               <div className="-mx-5 px-5 flex overflow-x-auto gap-3 pb-2 snap-x snap-mandatory no-scrollbar">
                  {announcements.map((ann, i) => (
                    <div key={i} className="min-w-[88vw] bg-white p-5 rounded-2xl shadow-[0_4px_20px_-10px_rgba(0,0,0,0.08)] border border-slate-100 snap-center flex items-start gap-4">
                       <div className="p-2.5 bg-rose-50 text-rose-500 rounded-full shrink-0">
                          <Megaphone size={16} />
                       </div>
                       <div className="w-full">
                          <h4 className="font-bold text-slate-800 text-sm mb-1">{ann.title}</h4>
                          {/* FIX: Removed line-clamp to show full text */}
                          <p className="text-xs text-slate-600 leading-relaxed font-medium">{ann.content}</p>
                       </div>
                    </div>
                  ))}
               </div>
            </section>
          )}

          {/* 2. Events Slider - Magazine Full Bleed Style (FIXED: Clear Date) */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-5">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">הכי קרוב אלייך</h3>
              <Link to="/events" className="text-rose-500 text-xs font-bold bg-rose-50/80 px-4 py-1.5 rounded-full backdrop-blur-sm">ללוח המלא</Link>
            </div>
            
            <div 
              ref={mobileSliderRef}
              className="-mx-0 flex overflow-x-auto snap-x snap-mandatory no-scrollbar pb-6"
            >
               {events.map((event, i) => (
                 <div key={i} className="min-w-[100vw] px-5 snap-center">
                    <div className="relative w-full h-[380px] rounded-[2.5rem] overflow-hidden shadow-[0_15px_40px_-10px_rgba(0,0,0,0.2)] group" onClick={() => navigate('/events')}>
                      {/* Full Image */}
                      <img src={event.image} className="w-full h-full object-cover transform transition-transform duration-700 group-active:scale-105" alt={event.title} />
                      
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent opacity-90"></div>
                      
                      {/* FIXED: Clearer Date Badge */}
                      <div className="absolute top-5 right-5 bg-white text-slate-900 px-5 py-3 rounded-2xl flex flex-col items-center leading-none shadow-xl border border-slate-100 z-10">
                         <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1">תאריך</span>
                         <span className="font-black text-2xl">{event.date ? new Date(event.date).getDate() : '?'}</span>
                         <span className="text-xs font-bold text-slate-400 mt-0.5">{event.date ? new Date(event.date).toLocaleString('he-IL', { month: 'short' }) : ''}</span>
                      </div>

                      {/* Content Bottom */}
                      <div className="absolute bottom-0 left-0 w-full p-6 text-white space-y-3">
                         <div className="flex items-center gap-2 text-rose-300 text-xs font-bold uppercase tracking-widest">
                            <MapPin size={12} /> {event.location}
                         </div>
                         <h2 className="text-3xl font-black leading-tight drop-shadow-md">{event.title}</h2>
                         <button className="mt-2 w-full bg-white/10 backdrop-blur-md hover:bg-white text-white hover:text-slate-900 border border-white/40 transition-all py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                            שרייני מקום <ArrowLeft size={16} />
                         </button>
                      </div>
                    </div>
                 </div>
               ))}
            </div>
          </section>

          {/* 3. Classes - Grid Layout (FIXED: 2 Rows/Columns) */}
          <section className="bg-gradient-to-b from-purple-50/50 to-transparent py-10 -mx-0">
            <div className="px-5 mb-5 flex items-center justify-between">
               <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                 <GraduationCap className="text-purple-500" size={22}/> חוגים וסדנאות
               </h3>
               <Link to="/classes" className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm text-slate-400"><ChevronLeft size={18}/></Link>
            </div>
            
            {/* FIX: Changed from flex overflow to Grid */}
            <div className="grid grid-cols-2 gap-3 px-5">
              {classes.map((cls, i) => (
                <div 
                  key={i} 
                  onClick={() => navigate('/classes')}
                  className="bg-white p-3 rounded-[1.8rem] shadow-sm border border-slate-100/50 active:scale-95 transition-transform"
                >
                  <div className="relative h-28 mb-3">
                     <img src={cls.image} className="w-full h-full rounded-[1.2rem] object-cover" alt={cls.title} />
                     <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-bold text-slate-800 shadow-sm">{cls.day}</div>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm px-1 leading-snug">{cls.title}</h4>
                  <p className="text-xs text-slate-400 px-1 mt-1 truncate">{cls.instructor}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Daily Inspiration - Clean Card */}
          <section className="px-5">
            <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-xl shadow-slate-200">
               {/* Decorative */}
               <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
               <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl -ml-6 -mb-6"></div>
               
               <Quote className="text-rose-400 mb-4 opacity-80" size={32} />
               <p className="text-xl font-serif leading-relaxed relative z-10 text-slate-100">"{latestInspiration.text}"</p>
               <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-medium">השראה יומית</span>
                  <span className="text-sm font-black text-rose-400 tracking-wide">{latestInspiration.author}</span>
               </div>
            </div>
          </section>

          {/* 5. Community Services - Grid Layout (FIXED: 2 Rows/Columns) */}
          <section className="space-y-4 pt-4">
            <div className="flex items-center justify-between px-5">
              <h3 className="text-xl font-black text-slate-800">קהילה וחסד</h3>
            </div>
            {/* FIX: Changed from flex overflow to Grid */}
            <div className="grid grid-cols-2 gap-3 px-5 pb-4">
               {communityItems.map((item, i) => (
                 <div 
                    key={i} 
                    onClick={() => navigate('/community')}
                    className="bg-white rounded-[2rem] p-3 shadow-sm border border-slate-50 flex flex-col gap-3 active:bg-slate-50 transition-colors"
                 >
                    <img src={item.image} className="w-full h-24 rounded-2xl object-cover bg-slate-100" alt={item.title} />
                    <div className="flex flex-col justify-center overflow-hidden px-1">
                       <h4 className="font-black text-slate-800 text-sm truncate w-full">{item.title}</h4>
                       <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{item.description || 'לחצי לפרטים נוספים ודרכי יצירת קשר'}</p>
                    </div>
                 </div>
               ))}
            </div>
          </section>

          {/* 6. Personality of the Week - Full Width Hero */}
          {personality && (
            <section className="px-5 pb-8">
               <div 
                 onClick={() => navigate('/personality-archive')}
                 className="relative bg-white rounded-[2.5rem] overflow-hidden shadow-xl shadow-purple-100 border border-purple-50"
               >
                 <div className="h-48 w-full relative">
                    <img src={personality.image} className="w-full h-full object-cover" alt={personality.name} />
                    <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent"></div>
                 </div>
                 <div className="px-8 pb-8 relative -mt-12 text-center">
                    <div className="inline-block bg-white p-1.5 rounded-full shadow-lg mb-3">
                       <div className="bg-rose-50 text-rose-500 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-rose-100">
                          אשת השבוע
                       </div>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 mb-2">{personality.name}</h3>
                    <p className="text-slate-500 font-serif italic text-sm leading-relaxed mb-6">"{personality.motto}"</p>
                    <button className="w-full py-3.5 rounded-xl bg-slate-900 text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2">
                       לראיון המלא <BookOpen size={16} className="text-rose-400"/>
                    </button>
                 </div>
               </div>
            </section>
          )}

        </div>
        {/* --- MOBILE VIEW END --- */}

        {/* --- DESKTOP VIEW START (UNTOUCHED) --- */}
        <div className="hidden md:block space-y-12">
           <div className="mx-1">
            {user?.isMemberApproved ? (
                <div className="bg-white/60 backdrop-blur-md p-5 rounded-3xl border border-rose-100/50 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                      <div className="p-3 bg-rose-50 rounded-xl shadow-inner text-rose-400"><Star fill="currentColor" size={16} /></div>
                      <div>
                        <p className="text-[9px] font-black text-rose-300 uppercase tracking-widest leading-none mb-1">הניקוד שצברת</p>
                        <span className="font-black text-slate-800 text-2xl tracking-tighter">{(user?.points || 0).toLocaleString()} <small className="text-xs opacity-40 font-bold">PTS</small></span>
                      </div>
                  </div>
                  <Link to="/lottery" className="bg-slate-900 text-white px-8 py-3 rounded-xl text-xs font-black hover:bg-purple-600 transition-all shadow-md flex items-center gap-1.5">כניסה להגרלות <ChevronLeft size={14}/></Link>
                </div>
            ) : (
              <div className="bg-white/70 backdrop-blur-md p-10 rounded-[3rem] text-slate-800 flex items-center justify-between gap-4 shadow-sm border border-purple-50">
                  <div className="text-right space-y-2">
                      <h3 className="text-2xl font-black flex items-center gap-2 text-purple-600">
                         <Sparkles size={20} className="text-rose-400 animate-pulse" /> {user?.isMemberRequested ? 'הבקשה בטיפול' : 'ברוכה הבאה למעגל'}
                      </h3>
                      <p className="text-sm text-slate-400 font-medium max-w-md">המקום שלך להכיר נשות עשייה וליהנות מהטבות ייחודיות.</p>
                  </div>
                  {!user?.isMemberRequested && (
                    <button onClick={() => user ? setShowMembershipModal(true) : onOpenLogin()} className="bg-rose-500 text-white px-10 py-3.5 rounded-full font-black text-sm shadow-lg hover:bg-purple-600 transition-all">הצטרפי עכשיו</button>
                  )}
              </div>
            )}
           </div>

           <section className="relative h-[450px] w-full overflow-hidden rounded-[3rem] shadow-2xl">
              {displayEvents.map((event, index) => (
                <div key={index} className={`absolute inset-0 transition-all duration-1000 ${index === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}>
                   <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${event.image})` }}></div>
                   <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/80 via-transparent"></div>
                   <div className="absolute bottom-10 left-10 p-10 text-left">
                      <h2 className="text-4xl font-black text-white mb-4">{event.title}</h2>
                      <Link to="/events" className="inline-flex bg-white text-slate-900 px-10 py-4 rounded-2xl font-black text-sm hover:bg-purple-600 transition-all">לפרטים והרשמה</Link>
                   </div>
                </div>
              ))}
           </section>

           <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                  <GraduationCap className="text-purple-500" size={28}/> חוגי המעגל
                </h3>
                <Link to="/classes" className="bg-purple-50 text-purple-600 px-6 py-2 rounded-xl font-black text-sm hover:bg-purple-500 transition-all">לכל החוגים</Link>
              </div>
              <div className="grid grid-cols-4 gap-6">
                 {classes.slice(0, 4).map((cls, i) => (
                   <div key={i} onClick={() => navigate('/classes')} className="bg-white p-4 rounded-3xl border border-purple-50 shadow-sm hover:shadow-xl transition-all cursor-pointer group text-center">
                      <img src={cls.image} className="w-full h-32 rounded-2xl object-cover mb-4 group-hover:scale-105 transition-transform" />
                      <h4 className="font-black text-slate-800">{cls.title}</h4>
                      <p className="text-slate-400 text-xs mt-1">{cls.instructor} | {cls.day}</p>
                   </div>
                 ))}
              </div>
           </section>

           <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                  <HeartHandshake className="text-rose-500" size={28}/> שירותי קהילה וגמ"חים
                </h3>
                <Link to="/community" className="bg-rose-50 text-rose-500 px-6 py-2 rounded-xl font-black text-sm hover:bg-rose-500 transition-all">לכל שירותי הקהילה</Link>
              </div>
              <div className="grid grid-cols-3 gap-8">
                 {communityItems.slice(0, 3).map((item, i) => (
                   <div key={i} onClick={() => navigate('/community')} className="bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all cursor-pointer border border-rose-50">
                      <img src={item.image} className="w-full h-40 object-cover" />
                      <div className="p-6">
                        <h4 className="font-black text-slate-800 text-lg">{item.title}</h4>
                        <p className="text-slate-400 text-sm mt-2 flex items-center gap-2"><MapPin size={14}/> {item.location}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </section>

           <div className="grid grid-cols-3 gap-10">
              <div className="col-span-2 space-y-12">
                 {personality && (
                    <section className="bg-white rounded-[3rem] p-10 shadow-sm border border-purple-50 flex items-center gap-10">
                       <img src={personality.image} className="w-56 h-56 rounded-[2.5rem] object-cover shadow-lg border-8 border-purple-50" alt="" />
                       <div className="text-right space-y-4">
                          <span className="text-purple-500 font-black text-xs uppercase tracking-widest">אשת השבוע במעגל</span>
                          <h3 className="text-4xl font-black text-slate-900">{personality.name}</h3>
                          <p className="text-xl text-slate-600 font-serif italic leading-relaxed">"{personality.motto}"</p>
                          <button onClick={() => navigate('/personality-archive')} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-sm flex items-center gap-2">לקריאת הראיון המלא <ChevronLeft size={18}/></button>
                       </div>
                    </section>
                 )}
              </div>
              <div className="space-y-8">
                 <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white">
                    <Quote className="text-rose-400 mb-4" size={24} />
                    <p className="font-serif italic leading-relaxed text-lg">"{latestInspiration.text}"</p>
                    <p className="mt-4 text-xs font-black text-rose-500">{latestInspiration.author}</p>
                 </div>
                 {announcements.slice(0, 2).map((ann, i) => (
                   <div key={i} className="bg-white p-6 rounded-3xl border-r-8 border-purple-500 shadow-sm">
                      <h4 className="font-black text-purple-600 text-sm mb-2 flex items-center gap-2"><Bell size={14}/> {ann.title}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">{ann.content}</p>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Footer */}
        <footer className="pt-12 pb-8 border-t border-rose-50 text-center space-y-4 px-4">
            <div className="flex justify-center gap-6 text-[10px] md:text-xs font-bold text-slate-400">
                <button onClick={() => setShowTermsModal(true)} className="hover:text-purple-500 transition-colors">תקנון האתר ומדיניות</button>
                <Link to="/contact" className="hover:text-purple-500 transition-colors">צרי קשר</Link>
            </div>
            <p className="text-[10px] md:text-xs font-medium text-slate-300 tracking-wide font-serif">
                כל הזכויות שמורות למעגל הנשי &copy; {new Date().getFullYear()} | בנייה ופיתוח ע"י 
                <a href="https://wa.me/message/WZKLTKH4KELMD1" target="_blank" rel="noopener noreferrer" className="text-purple-400 font-black mr-1">
                  DA פרויקטים ויזמות
                </a>
            </p>
        </footer>
      </div>

      {/* Modals */}
      {showMembershipModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in text-right">
              <div className="bg-white rounded-[2rem] md:rounded-[3rem] w-full max-w-lg p-6 md:p-12 relative shadow-2xl border border-white mx-3">
                  <div className="absolute top-0 left-0 w-full h-2 bg-purple-500"></div>
                  <button onClick={() => setShowMembershipModal(false)} className="absolute top-6 left-6 p-2 hover:bg-rose-50 rounded-full text-slate-300 transition-colors"><X size={20}/></button>
                  <div className="text-right space-y-6">
                      <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-400"><Sparkles size={24}/></div>
                      <h2 className="text-xl md:text-3xl font-black text-slate-800 font-serif">בקשת הצטרפות</h2>
                      <form onSubmit={handleMembershipSubmit} className="space-y-4 pt-4 border-t border-rose-50">
                          <div className="grid grid-cols-2 gap-3">
                            <input required type="number" placeholder="גיל" className="p-4 bg-rose-50/30 rounded-xl font-bold text-sm text-right outline-none focus:ring-1 focus:ring-rose-200" value={membershipForm.age} onChange={e=>setMembershipForm({...membershipForm, age: e.target.value})}/>
                            <input required type="text" placeholder="עיסוק" className="p-4 bg-rose-50/30 rounded-xl font-bold text-sm text-right outline-none focus:ring-1 focus:ring-rose-200" value={membershipForm.occupation} onChange={e=>setMembershipForm({...membershipForm, occupation: e.target.value})}/>
                          </div>
                          <input required type="text" placeholder="כתובת מגורים" className="w-full p-4 bg-rose-50/30 rounded-xl font-bold text-sm text-right outline-none focus:ring-1 focus:ring-rose-200" value={membershipForm.address} onChange={e=>setMembershipForm({...membershipForm, address: e.target.value})}/>
                          <input required type="tel" placeholder="מספר טלפון" className="w-full p-4 bg-rose-50/30 rounded-xl font-bold text-sm text-right outline-none focus:ring-1 focus:ring-rose-200" value={membershipForm.phone} onChange={e=>setMembershipForm({...membershipForm, phone: e.target.value})}/>
                          <div className="flex items-center gap-3">
                             <input id="terms" type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="w-5 h-5 text-purple-600 rounded" />
                             <label htmlFor="terms" className="text-xs font-bold text-slate-600">אני מאשרת את התקנון</label>
                          </div>
                          <button type="submit" className="w-full py-4 bg-rose-500 text-white rounded-xl font-black text-sm shadow-xl active:scale-95">שליחת בקשה</button>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {showTermsModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in text-right">
           <div className="bg-white rounded-[2rem] w-full max-w-2xl p-8 shadow-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-800">תקנון ומדיניות</h3>
                <button onClick={() => setShowTermsModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">כאן מופיע התקנון המלא של האתר...</p>
              <button onClick={() => setShowTermsModal(false)} className="w-full mt-8 py-3 bg-slate-900 text-white font-black rounded-xl">סגירה</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;