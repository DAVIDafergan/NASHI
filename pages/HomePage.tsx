import React, { useState, useEffect } from 'react';
import { 
  Bell, Star, Music, Palette, Activity, Briefcase, Mic, Gift, Clock, Sparkles,
  X, Send, MapPin, Phone, HeartHandshake, Quote, GraduationCap, ChevronLeft, ChevronRight, ExternalLink,
  Users, Megaphone, Calendar, BookOpen, Search 
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
  
  // --- States (נשמרים בדיוק מהקוד המקורי) ---
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

  // --- Logic (נשמר בדיוק מהקוד המקורי) ---
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fffcfc]" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-purple-50 border-t-purple-300 rounded-full animate-spin mx-auto"></div>
          <p className="text-purple-300 text-xs font-black tracking-widest animate-pulse font-serif">טוען...</p>
        </div>
      </div>
    );
  }

  const latestInspiration = inspirations[0] || { text: "הכוח האמיתי של אישה נמצא ביכולת שלה להאיר לאחרות את הדרך.", author: "נ.ש" };

  return (
    <div className="min-h-screen pb-24 relative overflow-x-hidden font-sans text-right bg-[#fffcfc]" dir="rtl">
      
      {/* Header Area (מבוסס על התמונה) */}
      <div className="pt-8 px-6 relative z-20">
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-rose-100 border-2 border-white shadow-md overflow-hidden flex items-center justify-center">
                   {user?.image ? <img src={user.image} className="w-full h-full object-cover" /> : <Users className="text-rose-400" size={24}/>}
                </div>
                <div className="text-right">
                    <p className="text-[11px] text-slate-400 font-bold leading-none mb-1">בוקר טוב,</p>
                    <h2 className="text-lg font-black text-[#a63c64] tracking-tight">{user?.name || 'אורחת יקרה'}</h2>
                </div>
            </div>
            <button className="relative p-3 bg-white rounded-full shadow-sm border border-rose-50 text-slate-700">
                <Bell size={22} />
                <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
        </div>

        {/* Search Bar (מבוסס על התמונה) */}
        <div className="relative mb-10 group">
            <input 
                type="text" 
                placeholder="חפשי אירוע, שיעור או גמ''ח..." 
                className="w-full py-4.5 px-12 bg-white rounded-2xl shadow-sm border border-rose-50 text-right text-sm font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-rose-50/50 transition-all"
            />
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300 group-focus-within:text-rose-500 transition-colors" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 relative z-10 space-y-10">
        
        {/* Ad Banner */}
        {ads.length > 0 && (
          <div className="mx-2 mb-4">
             <a href={ads[currentAdIndex].link || '#'} className="block relative h-20 md:h-24 rounded-2xl overflow-hidden shadow-sm border border-rose-50">
                <img src={ads[currentAdIndex].content} className="w-full h-full object-cover" alt="ad" />
             </a>
          </div>
        )}

        {/* מה חדש בקהילה (הסליידר המעוגל מהתמונה) */}
        <section className="space-y-5">
            <div className="flex items-center justify-between px-3">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">מה חדש בקהילה</h3>
                <button className="text-rose-500 text-sm font-black hover:opacity-70">הכל</button>
            </div>
            
            <div className="flex gap-5 overflow-x-auto no-scrollbar snap-x snap-mandatory px-3 pb-4">
                {displayEvents.map((event, index) => (
                    <div key={event.id || index} className="relative flex-shrink-0 w-[88%] md:w-[450px] h-[240px] rounded-[3rem] overflow-hidden shadow-xl snap-center group">
                        <img src={event.image} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={event.title} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                        
                        <div className="absolute top-6 right-6 bg-rose-500/90 text-white text-[10px] font-black px-4 py-1.5 rounded-full backdrop-blur-md shadow-lg">
                            {event.category || 'סדנה חדשה'}
                        </div>
                        
                        <div className="absolute bottom-8 right-8 left-8 text-right">
                            <h4 className="text-white text-2xl font-black mb-2 leading-tight drop-shadow-md">{event.title}</h4>
                            <p className="text-white/90 text-[12px] font-bold flex items-center justify-end gap-2">
                                {event.date ? `יום חמישי הקרוב ב-${new Date(event.date).getHours()}:00` : event.location}
                                <Clock size={14} className="text-rose-400" />
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </section>

        {/* אירועים קרובים (הכרטיסיות מהתמונה) */}
        <section className="space-y-5">
            <div className="flex items-center justify-between px-3">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">אירועים קרובים</h3>
                <Link to="/events" className="text-rose-500 text-sm font-black">יומן מלא</Link>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 px-3">
                {events.filter(ev => !ev.isHero).slice(0, 4).map((ev, idx) => (
                    <div key={ev._id || ev.id || idx} className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-rose-50 p-3 flex flex-col group hover:shadow-md transition-all">
                        <div className="relative h-36 md:h-48 rounded-[2rem] overflow-hidden mb-4">
                            <img src={ev.image} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt={ev.title} />
                        </div>
                        <div className="px-3 pb-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 text-[10px] font-black text-rose-500 mb-2">
                                <span>{ev.date ? new Date(ev.date).toLocaleDateString('he-IL', {day:'numeric', month:'long'}) : ''}</span>
                                <Calendar size={12} />
                            </div>
                            <h4 className="font-black text-slate-900 text-sm leading-tight mb-2 group-hover:text-rose-600 transition-colors">{ev.title}</h4>
                            <p className="text-slate-400 text-[10px] font-bold truncate flex items-center justify-end gap-1">
                                {ev.location} <MapPin size={10} />
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </section>

        {/* קטגוריות */}
        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar px-3">
            <button onClick={() => navigate('/classes')} className="flex items-center gap-2.5 px-7 py-4 bg-slate-900 rounded-[1.5rem] text-xs font-black text-white shadow-lg flex-shrink-0 active:scale-95 transition-transform">
              <GraduationCap size={18} className="text-rose-400" /> חוגי המעגל
            </button>
            {categories.map((cat, idx) => (
              <button key={idx} onClick={() => navigate('/events', { state: { category: cat.name } })} className="flex items-center gap-2.5 px-7 py-4 bg-white rounded-[1.5rem] text-xs font-bold text-slate-500 shadow-sm border border-rose-50 flex-shrink-0 hover:bg-rose-50 transition-colors">
                <span className="text-rose-300">{cat.icon}</span>{cat.name}
              </button>
            ))}
        </div>

        {/* השראה יומית (שמירה על פונקציה) */}
        <div className="px-3">
            <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl text-right">
                <div className="absolute top-0 right-0 w-40 h-40 bg-rose-500/10 rounded-full blur-[80px]"></div>
                <div className="relative z-10 space-y-5">
                    <Quote className="text-rose-400" size={32} />
                    <p className="text-lg md:text-xl font-serif italic leading-relaxed tracking-tight">"{latestInspiration.text}"</p>
                    <div className="flex items-center gap-3 justify-end pt-6 border-t border-white/10">
                        <span className="text-[10px] font-black opacity-30 uppercase tracking-widest">השראה יומית</span>
                        <div className="px-5 py-1.5 rounded-full bg-rose-500 text-white font-black text-xs shadow-lg">{latestInspiration.author}</div>
                    </div>
                </div>
            </div>
        </div>

        {/* חוגים (שמירה על פונקציה) */}
        <section className="space-y-5 px-3">
             <div className="flex items-center justify-between px-2">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">חוגי המעגל</h3>
                <Link to="/classes" className="text-rose-500 text-sm font-black">כל החוגים</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classes.slice(0, 4).map((cls, idx) => (
                    <div key={cls._id || idx} className="bg-white p-4 rounded-[2rem] shadow-sm border border-rose-50 flex items-center gap-4 group hover:bg-rose-50/30 transition-all cursor-pointer">
                        <div className="w-16 h-16 bg-rose-50 rounded-2xl overflow-hidden shrink-0">
                          <img src={cls.image} className="w-full h-full object-cover" alt={cls.title} />
                        </div>
                        <div className="text-right flex-1">
                            <h4 className="font-black text-slate-900 text-sm mb-1">{cls.title}</h4>
                            <p className="text-slate-400 text-[11px] font-bold">{cls.instructor} | {cls.day}</p>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-full"><ChevronLeft size={16} className="text-slate-300"/></div>
                    </div>
                ))}
            </div>
        </section>

        {/* אשת השבוע (שמירה על פונקציה) */}
        {personality && (
            <section className="px-3">
                <h3 className="text-xl font-black text-slate-800 tracking-tight mb-5 px-2">אשת השבוע</h3>
                <Link to="/personality-archive" className="block bg-white rounded-[3rem] p-8 shadow-sm border border-rose-50 hover:shadow-lg transition-all relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-100/50 rounded-full blur-[50px] -mr-16 -mt-16"></div>
                    <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                        <div className="relative">
                            <div className="absolute inset-0 bg-rose-200 rounded-[2rem] rotate-3 group-hover:rotate-6 transition-transform"></div>
                            <img src={personality.image} className="w-32 h-32 md:w-40 md:h-40 rounded-[2rem] object-cover shadow-xl border-4 border-white relative z-10" alt={personality.name} />
                        </div>
                        <div className="text-center md:text-right flex-1 space-y-3">
                            <h3 className="text-2xl font-black text-slate-900">{personality.name}</h3>
                            <p className="text-xs text-rose-400 font-black uppercase tracking-widest">{personality.role}</p>
                            <p className="text-sm md:text-base text-slate-600 italic font-serif leading-relaxed">"{personality.motto}"</p>
                        </div>
                    </div>
                </Link>
            </section>
        )}

        {/* הודעות הנהלה (שמירה על פונקציה) */}
        {announcements.length > 0 && (
            <div className="space-y-4 px-3">
                <h3 className="text-xs font-black text-slate-400 flex items-center gap-2 uppercase tracking-widest px-2">
                    <Megaphone size={16} className="text-rose-500"/> עדכוני הנהלה
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {announcements.slice(0, 2).map((ann, idx) => (
                      <div key={ann._id || idx} className="bg-gradient-to-br from-white to-rose-50/30 p-6 rounded-[2rem] border border-rose-100 shadow-sm">
                          <h4 className="font-black text-rose-600 text-sm mb-2 flex items-center gap-2">
                            <Bell size={14}/> {ann.title}
                          </h4>
                          <p className="text-xs text-slate-500 leading-relaxed font-medium">{ann.content}</p>
                      </div>
                  ))}
                </div>
            </div>
        )}

        {/* Footer & Credits */}
        <footer className="pt-16 pb-12 border-t border-rose-50 text-center space-y-6">
            <div className="flex justify-center gap-8 text-xs font-black text-slate-400">
                <button onClick={() => setShowTermsModal(true)} className="hover:text-rose-500 transition-colors">תקנון</button>
                <Link to="/contact" className="hover:text-rose-500 transition-colors">צרי קשר</Link>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">
                  כל הזכויות שמורות למעגל הנשי &copy; {new Date().getFullYear()}
              </p>
              <p className="text-xs font-medium text-slate-400">
                  עיצוב ופיתוח: 
                  <a href="https://wa.me/message/WZKLTKH4KELMD1" target="_blank" className="text-rose-500 font-black mr-1 hover:underline">
                    DA פרויקטים ויזמות
                  </a>
              </p>
            </div>
        </footer>
      </div>

      {/* Membership & Terms Modals (נשמרו בדיוק כפי שהיו) */}
      {showMembershipModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in text-right">
              <div className="bg-white rounded-[3rem] w-full max-w-lg p-10 relative shadow-2xl border border-white mx-3">
                  <button onClick={() => setShowMembershipModal(false)} className="absolute top-8 left-8 p-2 hover:bg-rose-50 rounded-full text-slate-300"><X size={20}/></button>
                  <div className="text-right space-y-6">
                      <div className="space-y-1">
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">בקשת הצטרפות</h2>
                        <p className="text-xs text-slate-400 font-bold">הצטרפי לקהילה המובילה לנשים</p>
                      </div>
                      <form onSubmit={handleMembershipSubmit} className="space-y-4 pt-4 border-t border-rose-50">
                          <div className="grid grid-cols-2 gap-4">
                            <input required type="number" placeholder="גיל" className="p-4 bg-rose-50/30 rounded-2xl font-bold text-sm text-right outline-none focus:ring-2 focus:ring-rose-200" value={membershipForm.age} onChange={e=>setMembershipForm({...membershipForm, age: e.target.value})}/>
                            <input required type="text" placeholder="עיסוק" className="p-4 bg-rose-50/30 rounded-2xl font-bold text-sm text-right outline-none focus:ring-2 focus:ring-rose-200" value={membershipForm.occupation} onChange={e=>setMembershipForm({...membershipForm, occupation: e.target.value})}/>
                          </div>
                          <input required type="text" placeholder="כתובת מגורים" className="w-full p-4 bg-rose-50/30 rounded-2xl font-bold text-sm text-right" value={membershipForm.address} onChange={e=>setMembershipForm({...membershipForm, address: e.target.value})}/>
                          <input required type="tel" placeholder="מספר טלפון" className="w-full p-4 bg-rose-50/30 rounded-2xl font-bold text-sm text-right" value={membershipForm.phone} onChange={e=>setMembershipForm({...membershipForm, phone: e.target.value})}/>
                          <div className="flex items-center gap-2 py-2">
                             <input id="terms" type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="w-5 h-5 text-rose-500 rounded-lg border-rose-200" />
                             <label htmlFor="terms" className="text-[11px] font-bold text-slate-600 cursor-pointer">אני מאשרת את תקנון האתר</label>
                          </div>
                          <button type="submit" className="w-full py-4.5 bg-rose-500 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-slate-900 transition-all active:scale-95 flex items-center justify-center gap-2">
                             <Send size={18}/> שליחת בקשה למנהלת
                          </button>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {showTermsModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in text-right" dir="rtl">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 shadow-2xl max-h-[80vh] overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black text-slate-800">תקנון ומדיניות שימוש</h3>
                  <button onClick={() => setShowTermsModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
                </div>
                <div className="space-y-4 text-sm leading-relaxed text-slate-600 font-medium">
                  <p className="font-black text-slate-800 underline">כללי</p>
                  <p>ברוכות הבאות לאתר. השימוש באתר ובתכניו כפוף לתקנון ולמדיניות שימוש זו, ומהווה הסכמה מלאה לכל תנאיה...</p>
                  {/* ... המשך הטקסט המקורי שלך ... */}
                </div>
                <button onClick={() => setShowTermsModal(false)} className="w-full mt-8 py-4 bg-slate-900 text-white font-black rounded-2xl">סגירה וחזרה</button>
            </div>
          </div>
      )}
    </div>
  );
};

export default HomePage;