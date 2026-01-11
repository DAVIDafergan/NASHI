import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, Star, Music, Palette, Activity, Briefcase, Mic, Gift, Clock, Sparkles,
  X, Send, MapPin, Phone, HeartHandshake, Quote, GraduationCap, ChevronLeft, ChevronRight, ExternalLink,
  Users, Megaphone, Calendar, BookOpen 
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
      const cardWidth = slider.offsetWidth * 0.85 + 16;
      const maxScroll = slider.scrollWidth - slider.offsetWidth;
      
      if (Math.abs(slider.scrollLeft) >= maxScroll - 10) {
        slider.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        slider.scrollBy({ left: -cardWidth, behavior: 'smooth' });
      }
    }, 3000);

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
          <p className="text-purple-300 text-[10px] font-black tracking-widest animate-pulse uppercase font-serif">טוען חוויות נשיות...</p>
        </div>
      </div>
    );
  }

  const latestInspiration = inspirations[0] || { text: "הכוח האמיתי של אישה נמצא ביכולת שלה להאיר לאחרות את הדרך.", author: "נ.ש" };

  return (
    <div className="min-h-screen pb-20 relative overflow-x-hidden font-sans text-right bg-gradient-to-br from-[#fffcfc] via-[#fdf6ff] to-[#fffcfc]" dir="rtl">
      
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,240,245,0.4),transparent)]"></div>
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-rose-100/30 rounded-full blur-[100px] animate-blob"></div>
      </div>

      <div className="max-w-5xl mx-auto md:px-8 pt-4 md:pt-10 relative z-10 space-y-6 md:space-y-10">
        
        <div className="px-4 md:px-0">{renderAdBanner()}</div>

        {/* --- MOBILE VIEW START --- */}
        <div className="md:hidden space-y-8">
          
          {/* הודעות הנהלה בנייד - סליידר אופקי עם רמז גלילה */}
          {announcements.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between px-5">
                 <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                   <Megaphone size={12}/> עדכוני מערכת
                 </h4>
                 {announcements.length > 1 && <span className="text-[9px] text-slate-300 font-bold">החליקי לצפייה {'<'}</span>}
              </div>
              <div className="flex overflow-x-auto gap-3 px-4 no-scrollbar snap-x snap-mandatory">
                 {announcements.map((ann, i) => (
                   <div key={i} className="min-w-[85vw] bg-white/90 backdrop-blur-md p-5 rounded-[1.5rem] border-r-4 border-purple-500 shadow-sm snap-center flex flex-col gap-1">
                      <h4 className="font-black text-slate-800 text-xs">{ann.title}</h4>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{ann.content}</p>
                   </div>
                 ))}
              </div>
            </section>
          )}

          {/* סליידר אירועים בקהילה - UI/UX משופר */}
          <section className="space-y-5">
            <div className="flex items-center justify-between px-5">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">אירועים בקהילה</h3>
              <Link to="/events" className="text-rose-500 text-xs font-black bg-rose-50 px-3 py-1 rounded-full">הכל</Link>
            </div>
            <div 
              ref={mobileSliderRef}
              className="flex overflow-x-auto gap-4 px-4 pb-4 snap-x snap-mandatory no-scrollbar"
            >
               {events.map((event, i) => (
                 <div key={i} className="min-w-[85vw] bg-white rounded-[2.5rem] overflow-hidden shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border border-slate-50 snap-center">
                    <div className="relative h-52">
                      <img src={event.image} className="w-full h-full object-cover" alt={event.title} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md text-slate-900 text-[9px] font-black px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1">
                        <Calendar size={10} className="text-rose-500"/> {event.date ? new Date(event.date).toLocaleDateString('he-IL') : 'קרוב'}
                      </div>
                    </div>
                    <div className="p-6 space-y-5">
                      <div className="space-y-2">
                        <h4 className="text-xl font-black text-slate-900 leading-tight">{event.title}</h4>
                        <div className="flex items-center gap-3 text-slate-400">
                           <p className="flex items-center gap-1.5 text-[11px] font-bold"><MapPin size={12} className="text-rose-400"/> {event.location}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => navigate('/events')}
                        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        لפרטים נוספים <ChevronLeft size={16}/>
                      </button>
                    </div>
                 </div>
               ))}
            </div>
          </section>

          {/* חוגים בנייד */}
          <section className="space-y-4 bg-purple-50/30 py-8">
            <div className="flex items-center justify-between px-5">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <GraduationCap className="text-purple-500" size={20}/> חוגי המעגל
              </h3>
              <Link to="/classes" className="text-purple-500 text-xs font-bold">לכל החוגים</Link>
            </div>
            <div className="flex overflow-x-auto gap-3 px-4 no-scrollbar">
              {classes.map((cls, i) => (
                <div 
                  key={i} 
                  onClick={() => navigate('/classes')}
                  className="min-w-[145px] bg-white p-3 rounded-[2rem] shadow-sm border border-purple-50 text-center space-y-2 cursor-pointer active:scale-95 transition-transform"
                >
                  <img src={cls.image} className="w-full h-24 rounded-[1.5rem] object-cover shadow-inner" alt={cls.title} />
                  <h4 className="font-black text-slate-800 text-[11px] line-clamp-1 px-1">{cls.title}</h4>
                  <p className="text-[9px] text-slate-400 font-bold">{cls.day}</p>
                </div>
              ))}
            </div>
          </section>

          {/* השראה יומית */}
          <section className="px-4">
            <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
              <Quote className="text-rose-400/40 mb-4" size={40} />
              <p className="text-lg font-serif italic leading-relaxed relative z-10">"{latestInspiration.text}"</p>
              <div className="mt-8 flex justify-end">
                 <span className="bg-rose-500 px-5 py-2 rounded-full text-[10px] font-black shadow-lg shadow-rose-500/20">{latestInspiration.author}</span>
              </div>
            </div>
          </section>

          {/* קהילה בנייד */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-5">
              <h3 className="text-lg font-black text-slate-800">שירותי קהילה</h3>
              <Link to="/community" className="text-rose-400 text-xs font-bold bg-rose-50 px-3 py-1 rounded-full">הכל</Link>
            </div>
            <div className="flex overflow-x-auto gap-4 px-4 pb-4 no-scrollbar">
               {communityItems.map((item, i) => (
                 <div 
                    key={i} 
                    onClick={() => navigate('/community')}
                    className="min-w-[220px] bg-white rounded-[2rem] overflow-hidden border border-slate-50 shadow-sm cursor-pointer active:scale-95 transition-transform"
                 >
                    <img src={item.image} className="w-full h-32 object-cover" alt={item.title} />
                    <div className="p-4">
                      <h4 className="font-black text-slate-800 text-xs truncate">{item.title}</h4>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1.5"><MapPin size={10}/> {item.location}</p>
                    </div>
                 </div>
               ))}
            </div>
          </section>

          {/* אשת השבוע בנייד */}
          {personality && (
            <section className="px-4 pb-10">
               <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-purple-50 relative overflow-hidden text-center space-y-5">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full blur-3xl opacity-50"></div>
                  <img src={personality.image} className="w-36 h-36 rounded-[2.5rem] object-cover mx-auto shadow-2xl border-4 border-white relative z-10" alt={personality.name} />
                  <div className="relative z-10">
                     <span className="text-rose-500 text-[10px] font-black uppercase tracking-[0.2em]">אשת השבוע</span>
                     <h3 className="text-2xl font-black text-slate-900 mt-1">{personality.name}</h3>
                     <p className="text-slate-600 font-serif italic text-sm mt-3 px-4">"{personality.motto}"</p>
                  </div>
                  <button onClick={() => navigate('/personality-archive')} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs shadow-lg relative z-10">לקריאת הראיון המלא</button>
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
                            <input required type="number" placeholder="גיל" className="p-3 bg-rose-50/30 rounded-xl font-bold text-xs text-right outline-none focus:ring-1 focus:ring-rose-200" value={membershipForm.age} onChange={e=>setMembershipForm({...membershipForm, age: e.target.value})}/>
                            <input required type="text" placeholder="עיסוק" className="p-3 bg-rose-50/30 rounded-xl font-bold text-xs text-right outline-none focus:ring-1 focus:ring-rose-200" value={membershipForm.occupation} onChange={e=>setMembershipForm({...membershipForm, occupation: e.target.value})}/>
                          </div>
                          <input required type="text" placeholder="כתובת מגורים" className="w-full p-3 bg-rose-50/30 rounded-xl font-bold text-xs text-right outline-none focus:ring-1 focus:ring-rose-200" value={membershipForm.address} onChange={e=>setMembershipForm({...membershipForm, address: e.target.value})}/>
                          <input required type="tel" placeholder="מספר טלפון" className="w-full p-3 bg-rose-50/30 rounded-xl font-bold text-xs text-right outline-none focus:ring-1 focus:ring-rose-200" value={membershipForm.phone} onChange={e=>setMembershipForm({...membershipForm, phone: e.target.value})}/>
                          <div className="flex items-center gap-2">
                             <input id="terms" type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="w-4 h-4 text-purple-600 rounded" />
                             <label htmlFor="terms" className="text-[10px] font-bold text-slate-600">אני מאשרת את התקנון</label>
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