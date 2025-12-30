import React, { useState, useEffect } from 'react';
import { 
  Bell, Star, Music, Palette, Activity, Briefcase, Mic, Gift, Clock, Sparkles,
  X, Send, MapPin, Phone, HeartHandshake, Quote
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

// --- Interfaces (ללא שינוי) ---
interface EventItem {
  id: string; _id?: string; title: string; date: string; location: string; category: string; image: string; isHero?: boolean;
}
interface LotteryItem {
  id: string; _id?: string; title: string; prize: string; drawDate: string; isActive: boolean;
}

const API_URL = 'https://nashi-production.up.railway.app/api';

// --- Mock Data & Categories (ללא שינוי) ---
const mockNews = [
  { id: '1', title: 'פתיחת עונת התרבות', description: 'אירוע פתיחה חגיגי בהיכל התרבות.', date: '10/05', important: true },
  { id: '2', title: 'סדנת מנהיגות', description: 'הרשמה לקורס מנהיגות קהילתית.', date: '12/05', important: false },
];

const categories = [
  { name: 'מוזיקה', icon: <Music size={12} /> },
  { name: 'אמנות', icon: <Palette size={12} /> },
  { name: 'סדנאות', icon: <Activity size={12} /> },
  { name: 'קריירה', icon: <Briefcase size={12} /> },
  { name: 'העשרה', icon: <Mic size={12} /> },
  { name: 'קהילה', icon: <HeartHandshake size={12} /> },
];

const HomePage = ({ user, onOpenLogin, onUpdateUser }: { user: any, onOpenLogin: () => void, onUpdateUser?: (u: any) => void }) => {
  const navigate = useNavigate();
  
  const [events, setEvents] = useState<EventItem[]>([]);
  const [lotteries, setLotteries] = useState<LotteryItem[]>([]);
  const [personality, setPersonality] = useState<any>(null);
  const [communityItems, setCommunityItems] = useState<any[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [upcomingLottery, setUpcomingLottery] = useState<LotteryItem | null>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showFullInterview, setShowFullInterview] = useState(false);
  const [membershipForm, setMembershipForm] = useState({ age: '', occupation: '', address: '', phone: user?.phone || '' });

  useEffect(() => {
    fetch(`${API_URL}/events`).then(res => res.json()).then(data => setEvents(data.map((e: any) => ({...e, id: e._id || e.id})))).catch(console.error);
    fetch(`${API_URL}/lotteries`).then(res => res.json()).then(data => setLotteries(data.map((l: any) => ({...l, id: l._id || l.id})))).catch(console.error);
    api.getPersonality().then(setPersonality).catch(console.error);
    api.getCommunityItems().then(setCommunityItems).catch(console.error);
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

  return (
    <div className="min-h-screen pb-24 relative overflow-x-hidden font-sans text-right bg-rose-50/30" dir="rtl">
      
      <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-cover bg-center bg-fixed opacity-40"
               style={{ backgroundImage: "url('/images/header-bg.jpg')" }}>
          </div>
          <div className="absolute inset-0 bg-gradient-to-tr from-rose-100/40 via-white/50 to-amber-50/40 pointer-events-none"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-12 pt-16 relative z-10 space-y-10">
        
        <div className="mx-2">
          {user?.isMemberApproved ? (
             <div className="bg-white/80 backdrop-blur-md p-4 md:p-6 rounded-[2rem] border border-rose-100 flex items-center justify-between shadow-sm animate-bounce-in">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-50 rounded-xl"><Star className="text-rose-400 fill-current" size={24} /></div>
                    <div>
                      <p className="text-[9px] font-bold text-rose-300 uppercase tracking-[0.2em]">הניקוד שלך</p>
                      <span className="font-bold text-slate-700 text-lg md:text-2xl">{user.points} נקודות</span>
                    </div>
                </div>
                <Link to="/lottery" className="bg-rose-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-rose-600 transition-all shadow-sm active:scale-95">מימוש הטבות</Link>
             </div>
          ) : (
            <div className="bg-white/90 backdrop-blur-xl p-6 md:p-10 rounded-[3rem] text-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden border border-rose-100">
                <div className="absolute top-0 right-0 w-48 h-48 bg-rose-200/20 rounded-full blur-[60px]"></div>
                <div className="text-center md:text-right space-y-2 relative z-10">
                    <h3 className="text-xl md:text-2xl font-bold flex items-center justify-center md:justify-start gap-2 text-rose-600">
                       <Sparkles size={20} className="text-rose-400" /> 
                       {user?.isMemberRequested ? 'הבקשה בטיפול' : 'הצטרפי למעגל הנשי'}
                    </h3>
                    <p className="text-xs md:text-sm text-slate-500 font-medium max-w-md leading-relaxed">
                       {user?.isMemberRequested 
                         ? 'אנחנו מעבדים את פנייתך. ברגע שתאושרי, כל האתר יפתח בפנייך.'
                         : 'גלי עולם של תרבות, קהילה והטבות בלעדיות לנשות העיר.'}
                    </p>
                </div>
                {!user?.isMemberRequested && (
                  <button 
                    onClick={() => user ? setShowMembershipModal(true) : onOpenLogin()} 
                    className="bg-rose-500 text-white px-8 py-3.5 rounded-full font-bold text-sm shadow-md hover:bg-rose-600 transition-all active:scale-95 relative z-10 flex items-center gap-2"
                  >
                    <HeartHandshake size={18} /> הצטרפי אלינו
                  </button>
                )}
            </div>
          )}
        </div>

        {upcomingLottery && user?.isMemberApproved && (
            <Link to="/lottery" className="block animate-fade-in-up">
                <div className="bg-gradient-to-r from-rose-50/80 to-rose-100/80 backdrop-blur-sm rounded-[2.5rem] p-5 md:p-7 shadow-sm border border-rose-200 flex items-center justify-between overflow-hidden relative group">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-rose-500 border border-rose-50 shadow-sm">
                            <Gift size={24} className="animate-pulse" />
                        </div>
                        <div className="text-slate-700">
                            <h3 className="font-bold text-base md:text-lg">הגרלה פעילה</h3>
                            <p className="text-[11px] text-rose-400 font-bold uppercase tracking-wide">פרס השבוע: {upcomingLottery.prize}</p>
                        </div>
                    </div>
                    <div className="text-left bg-white/60 px-4 py-2 rounded-2xl border border-rose-50">
                        <p className="text-[9px] text-rose-300 font-bold uppercase mb-1">נסגר בעוד:</p>
                        <div className="font-mono text-lg md:text-xl font-bold text-rose-500 flex items-center gap-2">
                            <Clock size={16} /> {timeLeft}
                        </div>
                    </div>
                </div>
            </Link>
        )}

        <section className="relative h-[300px] md:h-[450px] w-full overflow-hidden rounded-[3rem] shadow-xl border border-white">
            {displayEvents.map((event, index) => (
            <div key={event.id} className={`absolute inset-0 transition-all duration-1000 ${index === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}>
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${event.image})` }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 text-right">
                    <span className="bg-rose-500/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase mb-4 inline-block tracking-widest">אירוע נבחר</span>
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-2">{event.title}</h2>
                    <p className="text-xs md:text-base text-white/80 font-medium mb-6 flex items-center gap-2">
                       <MapPin size={16} className="text-rose-400" /> {event.location} • {new Date(event.date).toLocaleDateString('he-IL')}
                    </p>
                    <Link to="/events" className="inline-block bg-white text-rose-600 px-8 py-3 rounded-xl font-bold text-xs hover:bg-rose-50 transition-all shadow-lg">לפרטים והרשמה</Link>
                </div>
            </div>
            ))}
        </section>

        <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar px-2">
            {categories.map((cat, idx) => (
              <button key={idx} onClick={() => navigate('/events', { state: { category: cat.name } })} 
                      className="flex items-center gap-2 px-6 py-3 bg-white/80 backdrop-blur-sm rounded-2xl text-[13px] font-bold text-slate-600 shadow-sm border border-rose-50 hover:border-rose-300 hover:text-rose-600 transition-all flex-shrink-0 group">
                <span className="text-rose-400 p-2 bg-rose-50 rounded-xl group-hover:bg-rose-500 group-hover:text-white transition-colors">{cat.icon}</span>{cat.name}
              </button>
            ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-10">
                
                {personality && personality.name && (
                    <section className="animate-fade-in group">
                        <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] p-5 md:p-8 shadow-sm border border-white flex flex-col md:flex-row items-center gap-6 md:gap-10">
                            <div className="relative shrink-0">
                                <img src={personality.image} className="w-28 h-28 md:w-40 md:h-40 rounded-[2rem] object-cover shadow-md border-2 border-white" alt={personality.name} />
                                <div className="absolute -bottom-2 -right-2 bg-amber-400 p-2 rounded-xl text-white shadow-sm"><Sparkles size={16}/></div>
                            </div>
                            <div className="text-center md:text-right space-y-3 flex-1">
                                <span className="text-[9px] font-bold text-rose-400 uppercase tracking-[0.2em] bg-rose-50 px-3 py-1 rounded-full">אשת השבוע</span>
                                <div>
                                    <h3 className="text-2xl md:text-3xl font-bold text-slate-800 leading-tight">{personality.name}</h3>
                                    <p className="text-xs md:text-sm text-slate-400 font-bold">{personality.role}</p>
                                </div>
                                
                                {/* הוספת המוטו בתצוגה מקדימה */}
                                {personality.motto && (
                                  <div className="relative py-2">
                                     <p className="text-sm md:text-base text-rose-600/80 font-medium italic leading-relaxed">
                                       <Quote size={12} className="inline ml-1 opacity-50 rotate-180" />
                                       {personality.motto}
                                       <Quote size={12} className="inline mr-1 opacity-50" />
                                     </p>
                                  </div>
                                )}

                                <button onClick={() => setShowFullInterview(true)} className="text-[11px] font-bold text-slate-400 hover:text-rose-500 flex items-center gap-2 transition-all mx-auto md:mr-0 pt-2 border-t border-rose-50/50">
                                    קראי את הראיון המלא <Send size={10} className="rotate-180" />
                                </button>
                            </div>
                        </div>

                        {showFullInterview && (
                            <div className="fixed inset-0 z-[200] bg-rose-50/95 overflow-y-auto animate-fade-in no-scrollbar text-right" dir="rtl">
                                <div className="sticky top-0 bg-white/80 backdrop-blur-md p-5 flex justify-between items-center border-b z-50">
                                    <button onClick={() => setShowFullInterview(false)} className="p-2 bg-slate-50 rounded-full hover:bg-rose-50"><X size={20}/></button>
                                    <h4 className="font-bold text-rose-500 text-lg">ראיון השבוע</h4>
                                </div>
                                <div className="max-w-2xl mx-auto p-8 md:p-16 space-y-10">
                                    <div className="text-center space-y-4">
                                        <img src={personality.image} className="w-40 h-40 md:w-56 md:h-56 rounded-[3rem] mx-auto object-cover shadow-xl border-4 border-white" />
                                        <h2 className="text-3xl md:text-5xl font-bold text-slate-800">{personality.name}</h2>
                                        <p className="text-lg text-rose-400 font-bold">{personality.role}</p>
                                        {personality.motto && <p className="text-xl italic text-slate-600 max-w-lg mx-auto">"{personality.motto}"</p>}
                                    </div>
                                    <div className="space-y-8">
                                        {personality.questions?.map((q: any, i: number) => q.answer && (
                                            <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border-r-4 border-rose-400 animate-fade-in-up" style={{animationDelay: `${i*0.1}s`}}>
                                                <h5 className="font-bold text-rose-500 text-base md:text-lg mb-2">{q.question}</h5>
                                                <p className="text-slate-700 text-sm md:text-base leading-relaxed">{q.answer}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {communityItems && communityItems.length > 0 && (
                    <section className="space-y-4 animate-fade-in px-2">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <HeartHandshake className="text-rose-400" size={20}/> בקהילה שלנו
                        </h3>
                        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                            {communityItems.map((item) => (
                                <div key={item._id || item.id} className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-rose-50 flex items-center gap-3 shrink-0 w-64 group hover:border-rose-200 transition-all">
                                    <img src={item.image} className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-sm" />
                                    <div className="flex-1 overflow-hidden">
                                        <span className="text-[8px] font-bold text-rose-400 uppercase tracking-widest">{item.category}</span>
                                        <h4 className="font-bold text-slate-700 text-xs truncate">{item.title}</h4>
                                        <p className="text-slate-400 text-[9px] truncate">{item.location}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <div className="space-y-4 px-2">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Bell className="text-rose-400" size={20}/> עדכונים</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        {mockNews.map((item) => (
                            <div key={item.id} className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl shadow-sm border border-rose-50 flex items-center gap-4 group hover:border-rose-100 transition-all">
                                <div className="w-12 h-12 bg-rose-50 rounded-xl flex flex-col items-center justify-center text-rose-400 shrink-0 font-bold border border-rose-100/50">
                                    <span className="text-base leading-none">{item.date.split('/')[0]}</span>
                                    <span className="text-[8px] opacity-60 uppercase">{item.date.split('/')[1]}</span>
                                </div>
                                <div className="text-right flex-1">
                                    <h4 className="font-bold text-slate-700 text-sm group-hover:text-rose-500 transition-colors">{item.title}</h4>
                                    <p className="text-slate-400 text-[11px] line-clamp-1">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-10">
                <div className="bg-slate-800/90 backdrop-blur-xl rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl text-right">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-400/10 rounded-full blur-[40px] -mr-16 -mt-16"></div>
                    <div className="relative z-10 space-y-6">
                        <p className="text-lg md:text-xl font-serif italic opacity-90 leading-relaxed">"הכוח האמיתי של אישה נמצא ביכולת שלה להאיר לאחרות את הדרך."</p>
                        <div className="flex items-center gap-3 justify-end">
                            <span className="text-[9px] font-bold opacity-40 tracking-widest uppercase">השראה יומית</span>
                            <div className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center font-bold text-[10px] shadow-lg shadow-rose-900/20">נ.ש</div>
                        </div>
                    </div>
                </div>

                {!user ? (
                   <div onClick={onOpenLogin} className="cursor-pointer bg-white rounded-[2.5rem] p-8 text-center space-y-4 hover:translate-y-[-5px] transition-all border border-rose-100 shadow-sm flex flex-col items-center">
                      <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500"><HeartHandshake size={32} /></div>
                      <h3 className="text-xl font-bold text-slate-800">הצטרפי למעגל</h3>
                      <p className="text-[11px] text-slate-400 font-medium leading-relaxed max-w-[200px]">תהיי חלק מהשינוי בעיר ותיהני מעולם של תרבות והטבות.</p>
                      <button className="bg-rose-500 text-white px-8 py-3 rounded-xl font-bold text-xs shadow-md hover:bg-rose-600 transition-all">הרשמה מהירה</button>
                   </div>
                ) : (
                  <div className="bg-white/80 backdrop-blur-md p-8 rounded-[2.5rem] shadow-sm border border-rose-50 text-center space-y-4 flex flex-col items-center">
                      <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto text-rose-400"><Phone size={24}/></div>
                      <h3 className="text-lg font-bold text-slate-800">צרי קשר</h3>
                      <p className="text-[11px] text-slate-400 font-medium max-w-[180px]">אנחנו כאן לכל שאלה, הצעה או שיתוף פעולה.</p>
                      <a href="tel:0500000000" className="block w-full py-3 bg-slate-50 text-slate-700 rounded-xl font-bold text-xs hover:bg-rose-50 transition-all border border-slate-100">חיוג למוקד</a>
                  </div>
                )}
            </div>
        </div>
      </div>

      {/* מודאל הצטרפות - עידון עיצובי */}
      {showMembershipModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-rose-900/20 backdrop-blur-sm animate-fade-in text-right">
              <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] w-full max-w-md p-8 md:p-10 relative shadow-2xl border border-white">
                  <button onClick={() => setShowMembershipModal(false)} className="absolute top-6 left-6 p-2 hover:bg-rose-50 rounded-full transition-colors text-slate-300"><X size={20}/></button>
                  <div className="text-right space-y-6">
                      <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-400 shadow-inner"><Sparkles size={24}/></div>
                      <div className="space-y-1">
                        <h2 className="text-2xl font-bold text-slate-800">בקשת הצטרפות</h2>
                        <p className="text-xs text-slate-400">מלאי את הפרטים והמתיני לאישור המנהלת</p>
                      </div>
                      <form onSubmit={handleMembershipSubmit} className="space-y-4 pt-4 border-t border-rose-50">
                          <div className="grid grid-cols-2 gap-3">
                            <input required type="number" placeholder="גיל" className="p-4 bg-rose-50/50 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-rose-100 transition-all text-right" value={membershipForm.age} onChange={e=>setMembershipForm({...membershipForm, age: e.target.value})}/>
                            <input required type="text" placeholder="עיסוק" className="p-4 bg-rose-50/50 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-rose-100 transition-all text-right" value={membershipForm.occupation} onChange={e=>setMembershipForm({...membershipForm, occupation: e.target.value})}/>
                          </div>
                          <input required type="text" placeholder="כתובת מגורים" className="w-full p-4 bg-rose-50/50 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-rose-100 transition-all text-right" value={membershipForm.address} onChange={e=>setMembershipForm({...membershipForm, address: e.target.value})}/>
                          <input required type="tel" placeholder="טלפון" className="w-full p-4 bg-rose-50/50 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-rose-100 transition-all text-right" value={membershipForm.phone} onChange={e=>setMembershipForm({...membershipForm, phone: e.target.value})}/>
                          <button type="submit" className="w-full py-4 bg-rose-500 text-white rounded-xl font-bold text-base shadow-lg hover:bg-rose-600 transition-all active:scale-95 flex items-center justify-center gap-2 mt-4">
                             <Send size={18}/> שליחת בקשה
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