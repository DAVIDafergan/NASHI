import React, { useState, useEffect } from 'react';
import { 
  Bell, Star, Music, Palette, Activity, Briefcase, Mic, Gift, Clock, Sparkles,
  X, Send, MapPin, Phone, HeartHandshake, Quote, GraduationCap, ChevronLeft, ExternalLink,
  Users, Megaphone // נוסף אייקון מגפון
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
  const [membershipForm, setMembershipForm] = useState({ age: '', occupation: '', address: '', phone: user?.phone || '' });
  const [isLoading, setIsLoading] = useState(true);

  // טעינת נתונים משולבת
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setIsLoading(true);
        const [evRes, lotRes, adsRes, persData, commData, inspData, annData] = await Promise.all([
          fetch(`${API_URL}/events`).then(res => res.json()),
          fetch(`${API_URL}/lotteries`).then(res => res.json()),
          fetch(`${API_URL}/ads`).then(res => res.json()),
          api.getPersonality(),
          api.getCommunityItems(),
          api.getInspirations(),
          api.getAnnouncements() // משיכת הודעות הנהלה
        ]);

        setEvents(evRes.map((e: any) => ({...e, id: e._id || e.id})));
        setLotteries(lotRes.map((l: any) => ({...l, id: l._id || l.id})));
        setAds(adsRes || []);
        setPersonality(persData);
        setCommunityItems(commData || []);
        setInspirations(inspData || []);
        setAnnouncements(annData || []); 
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
    if (ads.length > 1 && ads[currentAdIndex]?.type === 'image') {
      const adTimer = setInterval(() => {
        setCurrentAdIndex((prev) => (prev + 1) % ads.length);
      }, 3000);
      return () => clearInterval(adTimer);
    }
  }, [ads, currentAdIndex]);

  const heroEvents = events.filter(e => e.isHero);
  const displayEvents = heroEvents.length > 0 ? heroEvents : events.slice(0, 3);

  useEffect(() => {
    if (displayEvents.length > 0) {
        const interval = setInterval(() => setCurrentSlide((prev) => (prev + 1) % displayEvents.length), 5000);
        return () => clearInterval(interval);
    }
  }, [displayEvents]);

  useEffect(() => {
    const checkLottery = () => {
        if (!lotteries || lotteries.length === 0) return;
        const now = new Date().getTime();
        const active = lotteries.find(l => {
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
        <a href={ad.link || '#'} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-[1.5rem] md:rounded-3xl shadow-sm border border-rose-100">
          {ad.type === 'image' ? (
            <img src={ad.content} alt={ad.title || 'Ad'} className="w-full h-24 md:h-32 object-cover transition-transform duration-700 group-hover:scale-105" />
          ) : (
            <div className="w-full h-24 md:h-32 bg-slate-900 flex items-center justify-center overflow-hidden">
                <video 
                  src={ad.content} 
                  autoPlay muted playsInline
                  onEnded={() => setCurrentAdIndex((prev) => (prev + 1) % ads.length)}
                  className="w-full h-full object-cover"
                />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-l from-black/50 to-transparent flex items-center justify-end px-4 md:px-6">
             <div className="text-right text-white">
                <p className="text-[7px] md:text-[9px] font-bold opacity-80 uppercase tracking-widest leading-none mb-1">בשיתוף פעולה</p>
                <h4 className="text-xs md:text-lg font-black leading-tight">{ad.title || ''}</h4>
             </div>
          </div>
          <div className="absolute bottom-2 left-2 bg-white/20 backdrop-blur-md p-1 rounded-lg border border-white/10">
            <ExternalLink size={10} className="text-white" />
          </div>
        </a>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fffcfc]" dir="rtl">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-rose-100 border-t-rose-400 rounded-full animate-spin mx-auto"></div>
          <p className="text-rose-400 text-[10px] font-black tracking-widest animate-pulse uppercase">טוען חוויות...</p>
        </div>
      </div>
    );
  }

  const latestInspiration = inspirations[0] || { text: "הכוח האמיתי של אישה נמצא ביכולת שלה להאיר לאחרות את הדרך.", author: "נ.ש" };

  return (
    <div className="min-h-screen pb-24 relative overflow-x-hidden font-sans text-right bg-[#fffcfc]" dir="rtl">
      
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,245,245,0.8),transparent)]"></div>
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-rose-100/10 rounded-full blur-[100px] -mr-48 -mb-48"></div>
          <div className="absolute top-1/4 left-0 w-[250px] h-[250px] bg-amber-50/20 rounded-full blur-[80px] -ml-32"></div>
      </div>

      <div className="max-w-6xl mx-auto px-3 md:px-12 pt-6 md:pt-16 relative z-10 space-y-5 md:space-y-12">
        
        {/* באנר פרסומת - חזר למקומו */}
        {renderAdBanner()}

        {/* סטטוס משתמש */}
        <div className="mx-1">
          {user?.isMemberApproved ? (
             <div className="bg-white/60 backdrop-blur-md p-2.5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-rose-100/50 flex items-center justify-between shadow-sm animate-bounce-in">
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-1.5 md:p-2 bg-rose-50 rounded-xl md:rounded-2xl"><Star className="text-rose-400 fill-current" size={14} md:size={16} /></div>
                    <div>
                      <p className="text-[6px] md:text-[9px] font-black text-rose-300 uppercase tracking-widest leading-none mb-0.5 md:mb-1">הניקוד שלך</p>
                      <span className="font-black text-slate-700 text-xs md:text-2xl">{user.points} נקודות</span>
                    </div>
                </div>
                <Link to="/lottery" className="bg-rose-500 text-white px-3 md:px-6 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[8px] md:text-xs font-black hover:bg-rose-600 transition-all shadow-md active:scale-95">מימוש הטבות</Link>
             </div>
          ) : (
            <div className="bg-white/80 backdrop-blur-xl p-4 md:p-10 rounded-[1.5rem] md:rounded-[3rem] text-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-6 shadow-sm border border-rose-100/40">
                <div className="text-center md:text-right space-y-1 relative z-10">
                    <h3 className="text-sm md:text-2xl font-black flex items-center justify-center md:justify-start gap-2 text-rose-600 tracking-tight">
                       <Sparkles size={14} md:size={16} className="text-rose-400" /> 
                       {user?.isMemberRequested ? 'הבקשה בטיפול' : 'הצטרפי למעגל הנשי'}
                    </h3>
                    <p className="text-[9px] md:text-sm text-slate-400 font-medium max-w-md leading-tight md:leading-relaxed">
                       {user?.isMemberRequested 
                         ? 'אנחנו מעבדים את פנייתך. ברגע שתאושרי, כל האתר יפתח בפנייך.'
                         : 'גלי עולם של תרבות, קהילה והטבות בלעדיות לנשות העיר.'}
                    </p>
                </div>
                {!user?.isMemberRequested && (
                  <button 
                    onClick={() => user ? setShowMembershipModal(true) : onOpenLogin()} 
                    className="bg-slate-900 text-white px-6 md:px-10 py-2 md:py-3.5 rounded-full font-black text-[9px] md:text-sm shadow-lg hover:bg-rose-600 transition-all active:scale-95 relative z-10 flex items-center gap-1.5 md:gap-2"
                  >
                    <HeartHandshake size={12} md:size={14} /> הצטרפי אלינו
                  </button>
                )}
            </div>
          )}
        </div>

        {/* הגרלה פעילה */}
        {upcomingLottery && user?.isMemberApproved && (
            <Link to="/lottery" className="block animate-fade-in-up mx-1">
                <div className="bg-gradient-to-r from-rose-50/90 to-rose-100/90 backdrop-blur-sm rounded-[1.5rem] md:rounded-[2rem] p-3 md:p-7 shadow-sm border border-rose-200 flex items-center justify-between overflow-hidden relative group">
                    <div className="flex items-center gap-2.5 md:gap-4 relative z-10">
                        <div className="w-8 h-8 md:w-12 md:h-12 bg-white rounded-lg md:rounded-2xl flex items-center justify-center text-rose-500 border border-rose-50 shadow-sm">
                            <Gift size={16} md:size={18} className="animate-pulse" />
                        </div>
                        <div className="text-slate-700">
                            <h3 className="font-black text-[10px] md:text-lg tracking-tight">הגרלה פעילה</h3>
                            <p className="text-[7px] md:text-[11px] text-rose-400 font-bold uppercase tracking-wider leading-none">פרס השבוע: {upcomingLottery.prize}</p>
                        </div>
                    </div>
                    <div className="text-left bg-white/60 px-2 md:px-4 py-1 md:py-2 rounded-lg md:rounded-2xl border border-rose-50">
                        <p className="text-[6px] md:text-[9px] text-rose-300 font-bold uppercase mb-0.5 tracking-tighter">נסגר בעוד:</p>
                        <div className="font-mono text-[10px] md:text-xl font-black text-rose-500 flex items-center gap-1">
                            <Clock size={10} md:size={12} /> {timeLeft}
                        </div>
                    </div>
                </div>
            </Link>
        )}

        {/* סליידר אירועים ראשי - חזר למקומו */}
        <section className="relative h-[180px] md:h-[450px] w-full overflow-hidden rounded-[1.5rem] md:rounded-[3.5rem] shadow-sm border border-white mx-1 md:mx-0">
            {displayEvents.length > 0 && displayEvents.map((event, index) => (
            <div key={event.id} className={`absolute inset-0 transition-all duration-1000 ${index === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}>
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${event.image})` }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-12 text-right">
                    <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[6px] md:text-[10px] font-black uppercase mb-1 md:mb-4 inline-block tracking-[0.2em] shadow-lg shadow-rose-900/40">אירוע נבחר</span>
                    <h2 className="text-sm md:text-5xl font-black text-white mb-0.5 md:mb-2 leading-tight tracking-tight">{event.title}</h2>
                    <p className="text-[8px] md:text-base text-white/80 font-bold mb-2 md:mb-6 flex items-center gap-1 justify-end">
                       <MapPin size={10} md:size={12} className="text-rose-400" /> {event.location} • {event.date ? new Date(event.date).toLocaleDateString('he-IL') : ''}
                    </p>
                    <Link to="/events" className="inline-block bg-white text-slate-900 px-4 md:px-8 py-1.5 md:py-3 rounded-lg md:rounded-xl font-black text-[8px] md:text-xs hover:bg-rose-50 transition-all shadow-xl active:scale-95">לפרטים והרשמה</Link>
                </div>
            </div>
            ))}
        </section>

        {/* קטגוריות */}
        <div className="flex gap-1.5 overflow-x-auto pb-4 no-scrollbar px-2">
            <button onClick={() => navigate('/classes')} 
                    className="flex items-center gap-1.5 px-3.5 py-2 md:py-2.5 bg-slate-900 rounded-xl md:rounded-2xl text-[9px] md:text-[13px] font-black text-white shadow-md transition-all flex-shrink-0 active:scale-95">
              <GraduationCap size={12} md:size={14} className="text-rose-400" /> חוגי העיר
            </button>
            <Link to="/personality-archive" className="flex items-center gap-1.5 px-3.5 py-2 md:py-2.5 bg-rose-500 rounded-xl md:rounded-2xl text-[9px] md:text-[13px] font-black text-white shadow-md transition-all flex-shrink-0 active:scale-95">
              <Users size={12} md:size={14} className="text-rose-100" /> נשות המעגל
            </Link>
            {categories.map((cat, idx) => (
              <button key={idx} onClick={() => navigate('/events', { state: { category: cat.name } })} 
                      className="flex items-center gap-1.5 px-3.5 py-2 md:py-2.5 bg-white rounded-xl md:rounded-2xl text-[9px] md:text-[13px] font-bold text-slate-600 shadow-sm border border-rose-50/50 hover:border-rose-200 transition-all flex-shrink-0 group active:scale-95">
                <span className="text-rose-300 group-hover:scale-110 transition-transform">{cat.icon}</span>{cat.name}
              </button>
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-10">
            <div className="lg:col-span-2 space-y-5 md:space-y-10">
                
                {/* אשת השבוע - חזר למקומו */}
                {personality && personality.name && (
                    <section className="animate-fade-in px-1">
                        <Link to="/personality-archive" className="block bg-white/40 backdrop-blur-xl rounded-[1.5rem] md:rounded-[3rem] p-3.5 md:p-8 shadow-sm border border-white flex flex-col md:flex-row items-center gap-4 md:gap-10 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-rose-100/20 rounded-full blur-2xl -mr-10 -mt-10"></div>
                            <div className="relative shrink-0">
                                <img src={personality.image} className="w-20 h-20 md:w-40 md:h-40 rounded-xl md:rounded-[2.5rem] object-cover shadow-sm border-2 border-white transition-transform duration-700 group-hover:scale-105" alt={personality.name} />
                                <div className="absolute -bottom-1 -right-1 bg-amber-400 p-1 md:p-1.5 rounded-lg text-white shadow-md"><Sparkles size={10} md:size={12}/></div>
                            </div>
                            <div className="text-center md:text-right space-y-1 md:space-y-3 flex-1">
                                <span className="text-[6px] md:text-[9px] font-black text-rose-400 uppercase tracking-[0.2em] bg-rose-50 px-2.5 py-0.5 rounded-full inline-block">אשת השבוע</span>
                                <div>
                                    <h3 className="text-base md:text-3xl font-black text-slate-800 leading-tight tracking-tight">{personality.name}</h3>
                                    <p className="text-[8px] md:text-sm text-slate-400 font-bold tracking-wide">{personality.role}</p>
                                </div>
                                <div className="text-[8px] md:text-[11px] font-black text-slate-400 group-hover:text-rose-500 flex items-center gap-1 transition-all mx-auto md:mr-0 pt-1.5 border-t border-rose-50/50 justify-center md:justify-start">
                                    לכל נשות המעגל והראיון המלא <ChevronLeft size={10} md:size={12} />
                                </div>
                            </div>
                        </Link>
                    </section>
                )}

                {/* קהילה */}
                {communityItems && communityItems.length > 0 && (
                    <section className="space-y-2 md:space-y-4 animate-fade-in px-2">
                        <h3 className="text-[10px] md:text-lg font-black text-slate-800 flex items-center gap-2 px-1 tracking-tight">
                            <HeartHandshake className="text-rose-400" size={14} md:size={16}/> בקהילה שלנו
                        </h3>
                        <div className="flex gap-2 md:gap-3 overflow-x-auto pb-4 no-scrollbar">
                            {communityItems.map((item) => (
                                <div key={item._id || item.id} className="bg-white/60 backdrop-blur-sm p-2 rounded-[1rem] md:rounded-[1.5rem] shadow-sm border border-rose-50/50 flex items-center gap-2 shrink-0 w-48 md:w-64 group hover:border-rose-200 transition-all">
                                    <img src={item.image} className="w-8 h-8 md:w-10 md:h-10 rounded-lg object-cover shrink-0 shadow-xs" />
                                    <div className="flex-1 overflow-hidden text-right">
                                        <span className="text-[6px] md:text-[8px] font-bold text-rose-300 uppercase tracking-widest leading-none">{item.category}</span>
                                        <h4 className="font-bold text-slate-700 text-[9px] md:text-xs truncate leading-tight mb-0.5">{item.title}</h4>
                                        <p className="text-slate-400 text-[7px] md:text-[8px] truncate">{item.location}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* עדכונים אחרונים */}
                <div className="space-y-2 md:space-y-4 px-2">
                    <h3 className="text-[10px] md:text-lg font-black text-slate-800 flex items-center gap-2 px-1 tracking-tight"><Bell className="text-rose-400" size={14} md:size={16}/> עדכונים אחרונים</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
                        {[
                          { id: '1', title: 'פתיחת עונת התרבות', description: 'אירוע פתיחה חגיגי בהיכל התרבות.', date: '10/05' },
                          { id: '2', title: 'סדנת מנהיגות', description: 'הרשמה לקורס מנהיגות קהילתית.', date: '12/05' },
                        ].map((item) => (
                            <div key={item.id} className="bg-white/50 backdrop-blur-sm p-3 rounded-[1rem] md:rounded-2xl shadow-sm border border-rose-50/50 flex items-center gap-3 group hover:bg-white transition-all">
                                <div className="w-8 h-8 md:w-11 md:h-11 bg-rose-50 rounded-lg md:rounded-xl flex flex-col items-center justify-center text-rose-400 shrink-0 font-black border border-rose-100/30 leading-none">
                                    <span className="text-[9px] md:text-sm">{item.date.split('/')[0]}</span>
                                    <span className="text-[5px] md:text-[8px] opacity-60 uppercase">{item.date.split('/')[1]}</span>
                                </div>
                                <div className="text-right flex-1 overflow-hidden">
                                    <h4 className="font-bold text-slate-700 text-[9px] md:text-sm group-hover:text-rose-500 transition-colors truncate tracking-tight">{item.title}</h4>
                                    <p className="text-slate-400 text-[8px] md:text-[11px] line-clamp-1 leading-tight">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* סיידבר - כולל הודעות הנהלה */}
            <div className="space-y-3.5 md:space-y-6 px-1 md:px-0">
                {/* השראה יומית */}
                <div className="bg-slate-900 rounded-[1.2rem] md:rounded-[3rem] p-4 md:p-8 text-white relative overflow-hidden shadow-xl text-right">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                    <div className="relative z-10 space-y-2 md:space-y-6">
                        <Quote className="text-rose-400/30 -mb-1" size={14} md:size={20} />
                        <p className="text-[11px] md:text-xl font-serif italic opacity-95 leading-relaxed tracking-tight">
                            "{latestInspiration.text}"
                        </p>
                        <div className="flex items-center gap-2 justify-end pt-1.5 border-t border-white/5">
                            <span className="text-[6px] md:text-[9px] font-black opacity-40 tracking-widest uppercase">השראה</span>
                            <div className="px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-400 font-black text-[7px] md:text-[10px] border border-rose-500/10">
                                {latestInspiration.author}
                            </div>
                        </div>
                    </div>
                </div>

                {/* הודעות הנהלה - חזר למקומו */}
                {announcements.length > 0 && announcements.map((ann) => (
                   <div key={ann._id} className="bg-rose-50/80 backdrop-blur-md rounded-[1.2rem] md:rounded-[2.5rem] p-4 md:p-6 border border-rose-100 shadow-sm animate-fade-in-up">
                      <div className="flex items-center gap-2 mb-2">
                         <div className="p-1.5 bg-rose-500 rounded-lg text-white shadow-sm shadow-rose-200"><Megaphone size={14} /></div>
                         <h4 className="font-black text-rose-900 text-[10px] md:text-sm tracking-tight">{ann.title}</h4>
                      </div>
                      <p className="text-[9px] md:text-xs text-rose-800/80 leading-relaxed font-bold">{ann.content}</p>
                   </div>
                ))}

                {/* כרטיסי קשר */}
                {!user ? (
                   <div onClick={onOpenLogin} className="cursor-pointer bg-white rounded-[1.2rem] md:rounded-[3rem] p-4 md:p-8 text-center space-y-2 md:space-y-4 hover:translate-y-[-2px] transition-all border border-rose-100/50 shadow-sm flex flex-col items-center">
                      <div className="w-10 h-10 md:w-16 md:h-16 bg-rose-50 rounded-xl md:rounded-2xl flex items-center justify-center text-rose-500"><HeartHandshake size={20} md:size={24} /></div>
                      <h3 className="text-xs md:text-xl font-black text-slate-800 tracking-tight">הצטרפי למעגל</h3>
                      <button className="bg-rose-500 text-white px-6 py-2 rounded-lg md:rounded-xl font-black text-[8px] md:text-xs shadow-lg hover:bg-rose-600 active:scale-95">הרשמה מהירה</button>
                   </div>
                ) : (
                  <div className="bg-white/60 backdrop-blur-md p-4 md:p-8 rounded-[1.2rem] md:rounded-[3rem] shadow-sm border border-rose-100/50 text-center space-y-2 md:space-y-4 flex flex-col items-center">
                      <div className="w-9 h-9 md:w-14 md:h-14 bg-rose-50 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto text-rose-400"><Phone size={14} md:size={20}/></div>
                      <h3 className="text-xs md:text-lg font-black text-slate-800">צרי קשר</h3>
                      <a href="tel:0500000000" className="block w-full py-2 bg-white text-slate-700 rounded-lg md:rounded-xl font-black text-[8px] md:text-xs hover:bg-rose-50 border border-rose-100">חיוג מהיר</a>
                  </div>
                )}
            </div>
        </div>
      </div>

      {/* מודאל הצטרפות */}
      {showMembershipModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 bg-rose-900/10 backdrop-blur-sm animate-fade-in text-right">
              <div className="bg-white rounded-[1.5rem] w-full max-w-md p-5 md:p-10 relative shadow-2xl border border-white mx-2 overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-rose-500"></div>
                  <button onClick={() => setShowMembershipModal(false)} className="absolute top-4 left-4 p-1.5 hover:bg-rose-50 rounded-full text-slate-300"><X size={16}/></button>
                  <div className="text-right space-y-4">
                      <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-400"><Sparkles size={16}/></div>
                      <h2 className="text-lg md:text-2xl font-black text-slate-800 tracking-tight">בקשת הצטרפות</h2>
                      <form onSubmit={handleMembershipSubmit} className="space-y-2.5 md:space-y-4 pt-3 border-t border-rose-50">
                          <div className="grid grid-cols-2 gap-2">
                            <input required type="number" placeholder="גיל" className="p-3 bg-rose-50/30 rounded-lg font-bold text-[10px] md:text-sm text-right outline-none" value={membershipForm.age} onChange={e=>setMembershipForm({...membershipForm, age: e.target.value})}/>
                            <input required type="text" placeholder="עיסוק" className="p-3 bg-rose-50/30 rounded-lg font-bold text-[10px] md:text-sm text-right outline-none" value={membershipForm.occupation} onChange={e=>setMembershipForm({...membershipForm, occupation: e.target.value})}/>
                          </div>
                          <input required type="text" placeholder="כתובת מגורים" className="w-full p-3 bg-rose-50/30 rounded-lg font-bold text-[10px] md:text-sm text-right outline-none" value={membershipForm.address} onChange={e=>setMembershipForm({...membershipForm, address: e.target.value})}/>
                          <input required type="tel" placeholder="טלפון" className="w-full p-3 bg-rose-50/30 rounded-lg font-bold text-[10px] md:text-sm text-right outline-none" value={membershipForm.phone} onChange={e=>setMembershipForm({...membershipForm, phone: e.target.value})}/>
                          <button type="submit" className="w-full py-3 md:py-4 bg-rose-500 text-white rounded-xl font-black text-xs md:text-base shadow-lg active:scale-95 flex items-center justify-center gap-1.5 mt-1.5">
                             <Send size={14}/> שליחת בקשה למנהלת
                          </button>
                      </form>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default HomePage;