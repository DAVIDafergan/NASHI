import React, { useState, useEffect } from 'react';
import { 
  Bell, Star, Music, Palette, Activity, Briefcase, Mic, Gift, Clock, Sparkles,
  X, Send, MapPin, Phone, HeartHandshake, Quote, GraduationCap, ChevronLeft, ChevronRight, ExternalLink,
  Users, Megaphone, Calendar, BookOpen, User, Search
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
  { name: 'מוזיקה', icon: <Music size={20} /> },
  { name: 'אמנות', icon: <Palette size={20} /> },
  { name: 'סדנאות', icon: <Activity size={20} /> },
  { name: 'קריירה', icon: <Briefcase size={20} /> },
  { name: 'העשרה', icon: <Mic size={20} /> },
  { name: 'קהילה', icon: <HeartHandshake size={20} /> },
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
                <p className="text-[6px] md:text-[8px] font-bold opacity-70 uppercase tracking-widest mb-0.5 font-serif">בשיתוף פעולה</p>
                <h4 className="text-[10px] md:text-sm font-black leading-tight font-serif">{ad.title || ''}</h4>
             </div>
          </div>
        </a>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-rose-100 border-t-rose-400 rounded-full animate-spin mx-auto"></div>
          <p className="text-rose-400 text-[10px] font-black tracking-widest animate-pulse uppercase">טוען...</p>
        </div>
      </div>
    );
  }

  const latestInspiration = inspirations[0] || { text: "השמחה היא לא במציאות אלא בדרך שבה אנחנו בוחרות לראות אותה.", author: "פרשת השבוע • חיזוק יומי" };

  return (
    <div className="min-h-screen pb-24 relative overflow-x-hidden font-sans text-right bg-[#fcfcfc] transition-colors duration-1000" dir="rtl">
      
      {/* Header - בוקר טוב - נייד בלבד */}
      <div className="md:hidden flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-400 border border-slate-50 relative">
                  <Bell size={20} />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
              </div>
          </div>
          <div className="flex items-center gap-3">
              <div className="text-right">
                  <p className="text-slate-400 text-[10px] font-medium font-serif">שלום {user?.name || 'שרה'},</p>
                  <p className="text-slate-900 text-sm font-black font-serif">בוקר אור ומבורך</p>
              </div>
              <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center text-rose-400">
                  <User size={20} />
              </div>
          </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-2 md:pt-10 relative z-10 space-y-6 md:space-y-10">
        
        {/* סליידר ראשי בעיצוב הכרטיס הוורוד */}
        <section className="relative h-[240px] md:h-[450px] w-full overflow-hidden rounded-[2.5rem] md:rounded-[3rem] shadow-lg mx-0 group">
            {displayEvents && displayEvents.length > 0 ? displayEvents.map((event, index) => (
            <div key={event.id || index} className={`absolute inset-0 transition-all duration-1000 ease-out ${index === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}>
                {/* כאן ניתן להחליף את הרקע לצבע ורוד כמו בתמונה אם האירוע הוא "השראה" */}
                <div className={`absolute inset-0 ${event.isHero ? 'bg-gradient-to-br from-rose-400 to-rose-500' : 'bg-cover bg-center'}`} 
                     style={!event.isHero ? { backgroundImage: `url(${event.image})` } : {}}></div>
                
                {/* שכבת טקסט מעוצבת כמו בתמונה */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 md:p-12 text-white">
                    <div className="bg-white/20 backdrop-blur-sm px-4 py-1 rounded-full text-[10px] font-bold mb-4 uppercase tracking-widest font-serif">
                       השראה יומית
                    </div>
                    <h2 className="text-lg md:text-3xl font-black mb-6 max-w-xs md:max-w-lg leading-relaxed font-serif drop-shadow-sm">
                        "{event.title || latestInspiration.text}"
                    </h2>
                    <div className="h-[1px] w-12 bg-white/30 mb-6"></div>
                    <p className="text-[10px] md:text-sm font-medium opacity-90 font-serif">
                        {event.location || latestInspiration.author}
                    </p>
                </div>
            </div>
            )) : null}
            <div className="absolute bottom-6 right-1/2 translate-x-1/2 flex gap-1.5 z-20">
              {displayEvents && displayEvents.map((_, i) => (
                <button key={i} onClick={() => setCurrentSlide(i)} className={`h-1 rounded-full transition-all duration-500 ${i === currentSlide ? 'w-6 bg-white' : 'w-1 bg-white/40'}`}></button>
              ))}
            </div>
        </section>

        {/* שורת עדכונים מהנהלה - כמו בתמונה */}
        {announcements && announcements.length > 0 && (
            <div className="mx-2 bg-white rounded-2xl p-3 shadow-sm border border-slate-50 flex items-center justify-between overflow-hidden">
                <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-rose-500 font-black text-[10px] shrink-0 font-serif">עדכונים:</span>
                    <p className="text-slate-400 text-[10px] truncate font-medium font-serif">
                        {announcements[0].title} • {announcements[0].content}
                    </p>
                </div>
                <Megaphone size={14} className="text-rose-400 shrink-0 ml-1" />
            </div>
        )}

        {/* קטגוריות - אייקונים עגולים כמו בתמונה */}
        <div className="flex justify-around items-start md:justify-start md:gap-8 px-2">
            <button onClick={() => navigate('/events')} className="flex flex-col items-center gap-3 group">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-white rounded-full flex items-center justify-center text-rose-500 shadow-sm border border-slate-50 group-active:scale-90 transition-all">
                    <Calendar size={22} />
                </div>
                <span className="text-[11px] font-black text-slate-800 font-serif">אירועים</span>
            </button>
            <button onClick={() => navigate('/classes')} className="flex flex-col items-center gap-3 group">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-white rounded-full flex items-center justify-center text-rose-500 shadow-sm border border-slate-50 group-active:scale-90 transition-all">
                    <BookOpen size={22} />
                </div>
                <span className="text-[11px] font-black text-slate-800 font-serif">שיעורים</span>
            </button>
            <button onClick={() => navigate('/community')} className="flex flex-col items-center gap-3 group">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-white rounded-full flex items-center justify-center text-rose-500 shadow-sm border border-slate-50 group-active:scale-90 transition-all">
                    <Mic size={22} />
                </div>
                <span className="text-[11px] font-black text-slate-800 font-serif">פורומים</span>
            </button>
        </div>

        {renderAdBanner()}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-10">
                
                {/* אשת השבוע - מופיע גם בנייד וגם במחשב לפי העיצוב בתמונה */}
                {personality && personality.name && (
                  <section className="px-1 animate-fade-in">
                      <div className="flex items-center justify-between mb-4 px-2">
                        <h3 className="text-sm md:text-lg font-black text-slate-900 tracking-tight font-serif">אשת השבוע</h3>
                        <Link to="/personality-archive" className="text-rose-500 font-black text-[10px] font-serif">לכל הסיפורים</Link>
                      </div>
                      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-50 p-6 relative overflow-hidden">
                        <div className="flex flex-row-reverse items-center gap-4 md:gap-8">
                            <div className="relative shrink-0">
                                <div className="w-20 h-20 md:w-28 md:h-28 rounded-full border-[3px] border-rose-100 p-1">
                                    <img src={personality.image} className="w-full h-full rounded-full object-cover shadow-sm" alt={personality.name} />
                                </div>
                            </div>
                            <div className="text-right flex-1 space-y-1">
                                <h3 className="text-base md:text-xl font-black text-slate-900 font-serif">{personality.name}</h3>
                                <p className="text-[10px] md:text-sm text-slate-400 font-medium font-serif leading-tight">{personality.role}</p>
                                <p className="text-[10px] md:text-sm text-slate-600 font-serif italic line-clamp-2 pt-1">
                                    "{personality.motto || 'סיפור של השראה, חיבור ועשייה...'}"
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                            <Link to={`/personality-archive`} className="bg-rose-500 text-white px-6 py-2 rounded-full text-[11px] font-black font-serif shadow-md shadow-rose-200">
                                קראי עוד
                            </Link>
                            <span className="text-[9px] text-slate-300 font-medium font-serif">פורסם לפני יומיים</span>
                        </div>
                      </div>
                  </section>
                )}

                {/* סעיף עסקים מקומיים / חוגים - בסגנון הכרטיסים בתחתית התמונה */}
                <div className="space-y-4 px-1">
                    <div className="flex items-center justify-between px-2">
                      <h3 className="text-sm md:text-lg font-black text-slate-900 font-serif">עסקים מקומיים</h3>
                      <Link to="/community" className="text-rose-400 font-black text-[10px] font-serif">הכל</Link>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                        {communityItems.slice(0, 5).map((item, idx) => (
                            <div key={item._id || idx} className="bg-white rounded-[1.8rem] shadow-sm border border-slate-50 shrink-0 w-[160px] md:w-[200px] overflow-hidden group">
                                <div className="h-32 md:h-40 relative">
                                    <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                </div>
                                <div className="p-4 text-right">
                                    <h4 className="font-black text-slate-800 text-[11px] md:text-sm truncate font-serif">{item.title}</h4>
                                    <p className="text-slate-400 text-[9px] md:text-[10px] font-medium font-serif mt-1">{item.category} • 2 ק"מ ממך</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sidebar Desktop - מופיע רק במחשב */}
            <div className="hidden lg:block space-y-8">
                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
                    <Quote className="text-rose-400 mb-4" size={32} />
                    <p className="text-lg font-serif italic leading-relaxed">
                        "{latestInspiration.text}"
                    </p>
                    <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[10px] font-black opacity-40 uppercase">השראה יומית</span>
                        <div className="px-3 py-1 rounded-full bg-rose-500 text-[10px] font-black font-serif">
                            {latestInspiration.author}
                        </div>
                    </div>
                </div>

                {announcements && announcements.length > 0 && (
                  <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-400 flex items-center gap-1.5 px-2 uppercase tracking-widest font-serif">
                        <Megaphone size={14} className="text-rose-500"/> הודעות הנהלה
                      </h3>
                      <div className="space-y-3">
                        {announcements.slice(0, 3).map((ann, idx) => (
                            <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-50 shadow-sm">
                               <h4 className="font-black text-rose-500 text-sm mb-1 font-serif">{ann.title}</h4>
                               <p className="text-xs text-slate-500 leading-normal font-serif">{ann.content}</p>
                            </div>
                        ))}
                      </div>
                  </div>
                )}
            </div>
        </div>

        {/* פוטר */}
        <footer className="pt-12 pb-8 border-t border-slate-100 text-center space-y-4">
            <div className="flex justify-center gap-6 text-[11px] font-bold text-slate-400 font-serif">
                <button onClick={() => setShowTermsModal(true)} className="hover:text-rose-500">תקנון האתר</button>
                <Link to="/contact" className="hover:text-rose-500">צרי קשר</Link>
            </div>
            <p className="text-[10px] font-medium text-slate-300 font-serif">
                כל הזכויות שמורות למעגל הנשי &copy; {new Date().getFullYear()} | פיתוח: DA פרויקטים ויזמות
            </p>
        </footer>
      </div>

      {/* מודאלים נשארים ללא שינוי פונקציונלי */}
      {showMembershipModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in text-right">
              <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 relative shadow-2xl border border-white mx-3">
                  <button onClick={() => setShowMembershipModal(false)} className="absolute top-6 left-6 p-2 hover:bg-slate-50 rounded-full text-slate-300"><X size={20}/></button>
                  <div className="text-right space-y-6">
                      <h2 className="text-2xl font-black text-slate-800 font-serif">בקשת הצטרפות</h2>
                      <form onSubmit={handleMembershipSubmit} className="space-y-4">
                          <input required type="number" placeholder="גיל" className="w-full p-4 bg-slate-50 rounded-xl font-bold text-sm text-right outline-none" value={membershipForm.age} onChange={e=>setMembershipForm({...membershipForm, age: e.target.value})}/>
                          <input required type="text" placeholder="עיסוק" className="w-full p-4 bg-slate-50 rounded-xl font-bold text-sm text-right outline-none" value={membershipForm.occupation} onChange={e=>setMembershipForm({...membershipForm, occupation: e.target.value})}/>
                          <input required type="text" placeholder="כתובת מגורים" className="w-full p-4 bg-slate-50 rounded-xl font-bold text-sm text-right outline-none" value={membershipForm.address} onChange={e=>setMembershipForm({...membershipForm, address: e.target.value})}/>
                          <input required type="tel" placeholder="מספר טלפון" className="w-full p-4 bg-slate-50 rounded-xl font-bold text-sm text-right outline-none" value={membershipForm.phone} onChange={e=>setMembershipForm({...membershipForm, phone: e.target.value})}/>
                          <div className="flex items-center gap-2 py-2">
                             <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="w-4 h-4 text-rose-500 rounded" />
                             <label className="text-xs font-bold text-slate-600 font-serif">אני מאשרת את תקנון האתר</label>
                          </div>
                          <button type="submit" className="w-full py-4 bg-rose-500 text-white rounded-2xl font-black text-sm shadow-xl active:scale-95 flex items-center justify-center gap-2 font-serif font-serif">
                             <Send size={16}/> שליחת בקשה
                          </button>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {showTermsModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-right">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 shadow-2xl max-h-[80vh] overflow-y-auto font-serif">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black text-slate-800">תקנון האתר</h3>
                  <button onClick={() => setShowTermsModal(false)} className="p-2 hover:bg-slate-50 rounded-full"><X size={20}/></button>
                </div>
                <div className="space-y-4 text-sm text-slate-600 leading-relaxed font-serif">
                  <p>השימוש באתר מיועד לנשים ונערות בלבד. כל התכנים באתר נועדו להשראה ושיתוף קהילתי בלבד...</p>
                  <p>אין לראות בתכנים המופיעים באתר ייעוץ מקצועי מכל סוג שהוא...</p>
                </div>
                <button onClick={() => setShowTermsModal(false)} className="w-full mt-8 py-3 bg-slate-900 text-white font-black rounded-xl">סגירה</button>
            </div>
          </div>
      )}
    </div>
  );
};

export default HomePage;