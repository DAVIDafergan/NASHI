import React, { useState, useEffect } from 'react';
import { 
  Bell, Star, Music, Palette, Activity, Briefcase, Mic, Gift, Clock, Sparkles,
  X, Send, MapPin, Phone, HeartHandshake, Quote, GraduationCap, ChevronLeft, ExternalLink
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
  const [currentSlide, setCurrentSlide] = useState(0);
  const [upcomingLottery, setUpcomingLottery] = useState<LotteryItem | null>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [membershipForm, setMembershipForm] = useState({ age: '', occupation: '', address: '', phone: user?.phone || '' });
  const [isLoading, setIsLoading] = useState(true); // מצב טעינה למניעת מסך לבן

  // טעינת נתונים
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setIsLoading(true);
        const [evRes, lotRes, adsRes, persData, commData] = await Promise.all([
          fetch(`${API_URL}/events`).then(res => res.json()),
          fetch(`${API_URL}/lotteries`).then(res => res.json()),
          fetch(`${API_URL}/ads`).then(res => res.json()),
          api.getPersonality(),
          api.getCommunityItems()
        ]);

        setEvents(evRes.map((e: any) => ({...e, id: e._id || e.id})));
        setLotteries(lotRes.map((l: any) => ({...l, id: l._id || l.id})));
        setAds(adsRes || []);
        setPersonality(persData);
        setCommunityItems(commData || []);
      } catch (err) {
        console.error("Error loading home data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAllData();
  }, []);

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

  // פונקציה לרינדור הבאנר עם הגנה מפני Undefined
  const renderAdBanner = () => {
    if (!ads || ads.length === 0 || !ads[0]) return null;
    const ad = ads[0]; 
    return (
      <div className="mx-2 md:mx-0 animate-fade-in">
        <a href={ad.link || '#'} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-3xl shadow-md border border-rose-100">
          {ad.type === 'image' ? (
            <img src={ad.content} alt={ad.title || 'Ad'} className="w-full h-24 md:h-32 object-cover transition-transform duration-700 group-hover:scale-105" />
          ) : (
            <div className="w-full h-24 md:h-32 bg-slate-900 flex items-center justify-center text-white text-xs font-bold">
               {ad.title || 'וידאו פרסומי'}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-l from-black/40 to-transparent flex items-center justify-end px-6">
             <div className="text-right text-white">
                <p className="text-[10px] font-bold opacity-80 uppercase tracking-tighter">בשיתוף פעולה</p>
                <h4 className="text-sm md:text-lg font-black">{ad.title || ''}</h4>
             </div>
          </div>
          <div className="absolute bottom-2 left-2 bg-white/20 backdrop-blur-md p-1.5 rounded-lg">
            <ExternalLink size={14} className="text-white" />
          </div>
        </a>
      </div>
    );
  };

  // מסך טעינה זמני כדי למנוע קריסה בזמן שהנתונים בדרך
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rose-50/30" dir="rtl">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-rose-500 font-bold animate-pulse">טוען את המעגל שלך...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 relative overflow-x-hidden font-sans text-right bg-gradient-to-b from-rose-50/50 via-white to-rose-50/30" dir="rtl">
      
      {/* רקע רך */}
      <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-cover bg-center bg-fixed opacity-20"
               style={{ backgroundImage: "url('/images/pattern-dots.png')" }}>
          </div>
          <div className="absolute inset-0 bg-gradient-to-tr from-rose-100/20 via-transparent to-amber-50/20 pointer-events-none"></div>
      </div>

      <div className="max-w-6xl mx-auto px-3 md:px-12 pt-12 md:pt-16 relative z-10 space-y-8 md:space-y-12">
        
        {/* באנר פרסומת במיקום אסטרטגי */}
        {renderAdBanner()}

        {/* סטטוס משתמש */}
        <div className="mx-1">
          {user?.isMemberApproved ? (
             <div className="bg-white/70 backdrop-blur-md p-3 md:p-6 rounded-[2rem] border border-rose-100 flex items-center justify-between shadow-sm animate-bounce-in">
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-1.5 md:p-2 bg-rose-50 rounded-xl"><Star className="text-rose-400 fill-current" size={18} /></div>
                    <div>
                      <p className="text-[8px] md:text-[9px] font-bold text-rose-300 uppercase tracking-widest">הניקוד שלך</p>
                      <span className="font-bold text-slate-700 text-sm md:text-2xl">{user.points} נקודות</span>
                    </div>
                </div>
                <Link to="/lottery" className="bg-rose-500 text-white px-4 md:px-6 py-2 rounded-xl text-[10px] md:text-xs font-bold hover:bg-rose-600 transition-all shadow-sm active:scale-95">מימוש הטבות</Link>
             </div>
          ) : (
            <div className="bg-white/80 backdrop-blur-xl p-5 md:p-10 rounded-[2.5rem] md:rounded-[3rem] text-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 shadow-xl relative overflow-hidden border border-rose-100/50">
                <div className="text-center md:text-right space-y-1 relative z-10">
                    <h3 className="text-lg md:text-2xl font-bold flex items-center justify-center md:justify-start gap-2 text-rose-600">
                       <Sparkles size={18} className="text-rose-400" /> 
                       {user?.isMemberRequested ? 'הבקשה בטיפול' : 'הצטרפי למעגל הנשי'}
                    </h3>
                    <p className="text-[10px] md:text-sm text-slate-500 font-medium max-w-md leading-tight md:leading-relaxed">
                       {user?.isMemberRequested 
                         ? 'אנחנו מעבדים את פנייתך. ברגע שתאושרי, כל האתר יפתח בפנייך.'
                         : 'גלי עולם של תרבות, קהילה והטבות בלעדיות לנשות העיר.'}
                    </p>
                </div>
                {!user?.isMemberRequested && (
                  <button 
                    onClick={() => user ? setShowMembershipModal(true) : onOpenLogin()} 
                    className="bg-rose-500 text-white px-6 md:px-8 py-2.5 md:py-3.5 rounded-full font-bold text-xs md:text-sm shadow-md hover:bg-rose-600 transition-all active:scale-95 relative z-10 flex items-center gap-2"
                  >
                    <HeartHandshake size={16} /> הצטרפי אלינו
                  </button>
                )}
            </div>
          )}
        </div>

        {/* הגרלה פעילה */}
        {upcomingLottery && user?.isMemberApproved && (
            <Link to="/lottery" className="block animate-fade-in-up mx-1">
                <div className="bg-gradient-to-r from-rose-50/90 to-rose-100/90 backdrop-blur-sm rounded-[2rem] p-4 md:p-7 shadow-sm border border-rose-200 flex items-center justify-between overflow-hidden relative group">
                    <div className="flex items-center gap-3 md:gap-4 relative z-10">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl md:rounded-2xl flex items-center justify-center text-rose-500 border border-rose-50 shadow-sm">
                            <Gift size={20} className="animate-pulse" />
                        </div>
                        <div className="text-slate-700">
                            <h3 className="font-bold text-sm md:text-lg tracking-tight">הגרלה פעילה</h3>
                            <p className="text-[9px] md:text-[11px] text-rose-400 font-bold uppercase tracking-wide">פרס השבוע: {upcomingLottery.prize}</p>
                        </div>
                    </div>
                    <div className="text-left bg-white/60 px-3 md:px-4 py-1.5 md:py-2 rounded-xl md:rounded-2xl border border-rose-50">
                        <p className="text-[8px] md:text-[9px] text-rose-300 font-bold uppercase mb-0.5">נסגר בעוד:</p>
                        <div className="font-mono text-sm md:text-xl font-bold text-rose-500 flex items-center gap-1.5">
                            <Clock size={14} /> {timeLeft}
                        </div>
                    </div>
                </div>
            </Link>
        )}

        {/* סליידר אירועים */}
        <section className="relative h-[240px] md:h-[450px] w-full overflow-hidden rounded-[2.5rem] md:rounded-[3rem] shadow-xl border border-white mx-1 md:mx-0">
            {displayEvents.length > 0 && displayEvents.map((event, index) => (
            <div key={event.id} className={`absolute inset-0 transition-all duration-1000 ${index === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}>
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${event.image})` }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 text-right">
                    <span className="bg-rose-500/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-[8px] md:text-[10px] font-bold uppercase mb-2 md:mb-4 inline-block tracking-widest">אירוע נבחר</span>
                    <h2 className="text-xl md:text-5xl font-bold text-white mb-1 md:mb-2 leading-tight">{event.title}</h2>
                    <p className="text-[10px] md:text-base text-white/80 font-medium mb-4 md:mb-6 flex items-center gap-1.5 justify-end">
                       <MapPin size={14} className="text-rose-400" /> {event.location} • {event.date ? new Date(event.date).toLocaleDateString('he-IL') : ''}
                    </p>
                    <Link to="/events" className="inline-block bg-white text-rose-600 px-6 md:px-8 py-2 md:py-3 rounded-xl font-bold text-[10px] md:text-xs hover:bg-rose-50 transition-all shadow-lg active:scale-95">לפרטים והרשמה</Link>
                </div>
            </div>
            ))}
        </section>

        {/* קטגוריות וחוגים */}
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar px-2">
            <button onClick={() => navigate('/classes')} 
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 rounded-2xl text-[11px] md:text-[13px] font-bold text-white shadow-md transition-all flex-shrink-0 active:scale-95">
              <GraduationCap size={16} className="text-rose-400" /> חוגי העיר
            </button>
            {categories.map((cat, idx) => (
              <button key={idx} onClick={() => navigate('/events', { state: { category: cat.name } })} 
                      className="flex items-center gap-2 px-5 py-2.5 bg-white/80 backdrop-blur-sm rounded-2xl text-[11px] md:text-[13px] font-bold text-slate-600 shadow-sm border border-rose-50 hover:border-rose-300 transition-all flex-shrink-0 group active:scale-95">
                <span className="text-rose-400 group-hover:scale-110 transition-transform">{cat.icon}</span>{cat.name}
              </button>
            ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8 md:gap-10">
            <div className="lg:col-span-2 space-y-8 md:space-y-10">
                
                {/* אשת השבוע */}
                {personality && personality.name && (
                    <section className="animate-fade-in group px-1">
                        <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] p-4 md:p-8 shadow-sm border border-white flex flex-col md:flex-row items-center gap-5 md:gap-10 relative">
                            <div className="relative shrink-0">
                                <img src={personality.image} className="w-24 h-24 md:w-40 md:h-40 rounded-[1.5rem] md:rounded-[2rem] object-cover shadow-md border-2 border-white" alt={personality.name} />
                                <div className="absolute -bottom-1 -right-1 bg-amber-400 p-1.5 rounded-lg text-white shadow-sm"><Sparkles size={14}/></div>
                            </div>
                            <div className="text-center md:text-right space-y-2 md:space-y-3 flex-1">
                                <span className="text-[8px] md:text-[9px] font-bold text-rose-400 uppercase tracking-widest bg-rose-50 px-3 py-1 rounded-full">אשת השבוע</span>
                                <div>
                                    <h3 className="text-xl md:text-3xl font-bold text-slate-800 leading-tight">{personality.name}</h3>
                                    <p className="text-[10px] md:text-sm text-slate-400 font-bold">{personality.role}</p>
                                </div>
                                
                                {personality.motto && (
                                  <div className="relative py-1 md:py-2">
                                     <p className="text-xs md:text-base text-rose-600/80 font-medium italic leading-relaxed">
                                       <Quote size={10} className="inline ml-1 opacity-50 rotate-180" />
                                       {personality.motto}
                                       <Quote size={10} className="inline mr-1 opacity-50" />
                                     </p>
                                  </div>
                                )}

                                <Link to="/personality-archive" className="text-[10px] md:text-[11px] font-bold text-slate-400 hover:text-rose-500 flex items-center gap-1.5 transition-all mx-auto md:mr-0 pt-2 border-t border-rose-50/50 justify-center md:justify-start">
                                    לכל נשות השבוע והראיון המלא <ChevronLeft size={14} />
                                </Link>
                            </div>
                        </div>
                    </section>
                )}

                {/* קהילה */}
                {communityItems && communityItems.length > 0 && (
                    <section className="space-y-3 md:space-y-4 animate-fade-in px-2">
                        <h3 className="text-sm md:text-lg font-bold text-slate-800 flex items-center gap-2 px-1">
                            <HeartHandshake className="text-rose-400" size={18}/> בקהילה שלנו
                        </h3>
                        <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                            {communityItems.map((item) => (
                                <div key={item._id || item.id} className="bg-white/80 backdrop-blur-sm p-3 rounded-2xl shadow-sm border border-rose-50 flex items-center gap-3 shrink-0 w-56 md:w-64 group hover:border-rose-200 transition-all">
                                    <img src={item.image} className="w-10 h-10 md:w-12 md:h-12 rounded-xl object-cover shrink-0 shadow-sm" />
                                    <div className="flex-1 overflow-hidden text-right">
                                        <span className="text-[7px] md:text-[8px] font-bold text-rose-400 uppercase tracking-widest">{item.category}</span>
                                        <h4 className="font-bold text-slate-700 text-[11px] md:text-xs truncate leading-none mb-0.5">{item.title}</h4>
                                        <p className="text-slate-400 text-[9px] truncate">{item.location}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* סיידבר */}
            <div className="space-y-8 md:space-y-10 px-1 md:px-0">
                <div className="bg-slate-800/90 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 text-white relative overflow-hidden shadow-xl text-right">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-400/10 rounded-full blur-[40px] -mr-16 -mt-16"></div>
                    <div className="relative z-10 space-y-4 md:space-y-6">
                        <Quote className="text-rose-400/30 -mb-2" size={24} />
                        <p className="text-base md:text-xl font-serif italic opacity-95 leading-relaxed tracking-tight">"הכוח האמיתי של אישה נמצא ביכולת שלה להאיר לאחרות את הדרך."</p>
                        <div className="flex items-center gap-2 justify-end pt-2 border-t border-white/10">
                            <span className="text-[8px] md:text-[9px] font-bold opacity-40 tracking-widest uppercase">השראה יומית</span>
                            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-rose-500 flex items-center justify-center font-bold text-[9px] md:text-[10px] shadow-lg shadow-rose-900/20">נ.ש</div>
                        </div>
                    </div>
                </div>

                {!user ? (
                   <div onClick={onOpenLogin} className="cursor-pointer bg-white/90 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 text-center space-y-3 md:space-y-4 hover:translate-y-[-5px] transition-all border border-rose-100 shadow-sm flex flex-col items-center">
                      <div className="w-12 h-12 md:w-16 md:h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500"><HeartHandshake size={28} /></div>
                      <h3 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">הצטרפי למעגל</h3>
                      <p className="text-[10px] md:text-[11px] text-slate-400 font-medium leading-tight max-w-[200px]">תהיי חלק מהשינוי בעיר ותיהני מעולם של תרבות והטבות.</p>
                      <button className="bg-rose-500 text-white px-8 py-2.5 md:py-3 rounded-xl font-bold text-[11px] md:text-xs shadow-md hover:bg-rose-600 transition-all">הרשמה מהירה</button>
                   </div>
                ) : (
                  <div className="bg-white/80 backdrop-blur-md p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-rose-50 text-center space-y-3 md:space-y-4 flex flex-col items-center">
                      <div className="w-12 h-12 md:w-14 md:h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-400 shadow-inner"><Phone size={24}/></div>
                      <h3 className="text-base md:text-lg font-bold text-slate-800">צרי קשר</h3>
                      <p className="text-[10px] md:text-[11px] text-slate-400 font-medium max-w-[180px]">אנחנו כאן לכל שאלה, הצעה או שיתוף פעולה.</p>
                      <a href="tel:0500000000" className="block w-full py-2.5 md:py-3 bg-slate-50 text-slate-700 rounded-xl font-bold text-[11px] md:text-xs hover:bg-rose-50 transition-all border border-slate-100">חיוג למוקד</a>
                  </div>
                )}
            </div>
        </div>
      </div>

      {/* מודאל הצטרפות */}
      {showMembershipModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 bg-rose-900/20 backdrop-blur-sm animate-fade-in text-right">
              <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] w-full max-w-md p-6 md:p-10 relative shadow-2xl border border-white mx-2">
                  <button onClick={() => setShowMembershipModal(false)} className="absolute top-5 left-5 p-1.5 hover:bg-rose-50 rounded-full transition-colors text-slate-300"><X size={18}/></button>
                  <div className="text-right space-y-5">
                      <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-400 shadow-inner"><Sparkles size={20}/></div>
                      <div className="space-y-1">
                        <h2 className="text-xl md:text-2xl font-bold text-slate-800">בקשת הצטרפות</h2>
                        <p className="text-[10px] md:text-xs text-slate-400">מלאי את הפרטים והמתיני לאישור המנהלת</p>
                      </div>
                      <form onSubmit={handleMembershipSubmit} className="space-y-3 md:space-y-4 pt-4 border-t border-rose-50">
                          <div className="grid grid-cols-2 gap-2">
                            <input required type="number" placeholder="גיל" className="p-3.5 md:p-4 bg-rose-50/50 rounded-xl font-bold text-xs md:text-sm outline-none focus:ring-2 focus:ring-rose-100 transition-all text-right" value={membershipForm.age} onChange={e=>setMembershipForm({...membershipForm, age: e.target.value})}/>
                            <input required type="text" placeholder="עיסוק" className="p-3.5 md:p-4 bg-rose-50/50 rounded-xl font-bold text-xs md:text-sm outline-none focus:ring-2 focus:ring-rose-100 transition-all text-right" value={membershipForm.occupation} onChange={e=>setMembershipForm({...membershipForm, occupation: e.target.value})}/>
                          </div>
                          <input required type="text" placeholder="כתובת מגורים" className="w-full p-3.5 md:p-4 bg-rose-50/50 rounded-xl font-bold text-xs md:text-sm outline-none focus:ring-2 focus:ring-rose-100 transition-all text-right" value={membershipForm.address} onChange={e=>setMembershipForm({...membershipForm, address: e.target.value})}/>
                          <input required type="tel" placeholder="טלפון" className="w-full p-3.5 md:p-4 bg-rose-50/50 rounded-xl font-bold text-xs md:text-sm outline-none focus:ring-2 focus:ring-rose-100 transition-all text-right" value={membershipForm.phone} onChange={e=>setMembershipForm({...membershipForm, phone: e.target.value})}/>
                          <button type="submit" className="w-full py-3.5 md:py-4 bg-rose-500 text-white rounded-xl font-bold text-sm md:text-base shadow-lg hover:bg-rose-600 transition-all active:scale-95 flex items-center justify-center gap-2 mt-2">
                             <Send size={16}/> שליחת בקשה
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