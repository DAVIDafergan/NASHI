import React, { useState, useEffect } from 'react';
import { 
  Bell, Star, Music, Palette, Activity, Briefcase, Mic, Gift, Clock, Sparkles,
  X, Send, MapPin, Phone, HeartHandshake
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
  { name: 'מוזיקה', icon: <Music size={14} /> },
  { name: 'אמנות', icon: <Palette size={14} /> },
  { name: 'סדנאות', icon: <Activity size={14} /> },
  { name: 'קריירה', icon: <Briefcase size={14} /> },
  { name: 'העשרה', icon: <Mic size={14} /> },
  { name: 'קהילה', icon: <HeartHandshake size={14} /> },
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
    <div className="min-h-screen pb-24 relative overflow-x-hidden font-sans text-right" dir="rtl">
      
      <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-cover bg-center bg-fixed"
               style={{ backgroundImage: "url('/images/header-bg.jpg')" }}>
          </div>
          <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/30 via-transparent to-yellow-500/30 mix-blend-overlay saturate-[1.5] pointer-events-none"></div>
          <div className="absolute inset-0 bg-black/5 mix-blend-soft-light pointer-events-none"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-20 relative z-10 space-y-12">
        
        {/* ניקוד / הצטרפות */}
        <div className="mx-2">
          {user?.isMemberApproved ? (
             <div className="bg-white/90 backdrop-blur-xl p-5 md:p-7 rounded-[3rem] border-2 border-yellow-400 flex items-center justify-between shadow-2xl animate-bounce-in">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-yellow-100 rounded-2xl shadow-inner"><Star className="text-yellow-500 fill-current" size={32} /></div>
                    <div>
                      <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest">הניקוד שצברת</p>
                      <span className="font-black text-slate-800 text-xl md:text-3xl">{user.points} נקודות</span>
                    </div>
                </div>
                <Link to="/lottery" className="bg-slate-900 text-white px-8 py-4 rounded-2xl text-xs font-black hover:bg-rose-600 transition-all shadow-lg active:scale-95">מימוש הטבות</Link>
             </div>
          ) : (
            <div className="bg-slate-900/95 backdrop-blur-xl p-8 md:p-10 rounded-[4rem] text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden border border-white/10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-rose-600/20 rounded-full blur-[100px]"></div>
                <div className="text-center md:text-right space-y-3 relative z-10">
                    <h3 className="text-2xl md:text-3xl font-black flex items-center justify-center md:justify-start gap-3">
                       <Sparkles className="text-yellow-400 animate-pulse" size={30} /> מועדון "נשי" מחכה לך
                    </h3>
                    <p className="text-sm md:text-base opacity-70 font-bold max-w-lg leading-relaxed">הצטרפי למעגל הנשי המקומי, תרמי לקהילה ותהני מעולם שלם של הטבות, נקודות והגרלות בלעדיות.</p>
                </div>
                <button 
                  onClick={() => user ? setShowMembershipModal(true) : onOpenLogin()} 
                  className="bg-gradient-to-r from-rose-500 to-pink-500 px-10 py-5 rounded-[2rem] font-black text-base shadow-[0_10px_30px_rgba(225,29,72,0.4)] hover:scale-105 transition-all active:scale-95 relative z-10 flex items-center gap-3"
                >
                  <HeartHandshake size={24} /> הצטרפי למעגל עכשיו
                </button>
            </div>
          )}
        </div>

        {/* הגרלה פעילה */}
        {upcomingLottery && user?.isMemberApproved && (
            <Link to="/lottery" className="block animate-fade-in-up">
                <div className="bg-gradient-to-r from-purple-800/90 to-fuchsia-600/90 backdrop-blur-md rounded-[3rem] p-6 md:p-8 shadow-2xl border border-white/20 flex items-center justify-between overflow-hidden relative group">
                    <div className="flex items-center gap-5 relative z-10">
                        <div className="w-14 h-14 md:w-16 md:h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-white border border-white/30 shadow-inner">
                            <Gift size={32} className="animate-bounce" />
                        </div>
                        <div className="text-white">
                            <h3 className="font-black text-lg md:text-xl tracking-tight">הגרלה פעילה!</h3>
                            <p className="text-xs md:text-sm text-purple-100 opacity-90 font-bold">הפרס המיוחד: {upcomingLottery.prize}</p>
                        </div>
                    </div>
                    <div className="text-left relative z-10 bg-black/20 p-4 rounded-3xl backdrop-blur-sm border border-white/10">
                        <p className="text-[10px] text-purple-200 font-black mb-1 uppercase tracking-widest">זמן שנותר:</p>
                        <div className="font-mono text-xl md:text-3xl font-black text-white flex items-center gap-2">
                            <Clock size={24} className="text-pink-300" /> {timeLeft}
                        </div>
                    </div>
                </div>
            </Link>
        )}

        {/* סליידר אירועים */}
        <section className="relative h-[350px] md:h-[500px] w-full overflow-hidden rounded-[4rem] shadow-2xl border-4 border-white/50">
            {displayEvents.map((event, index) => (
            <div key={event.id} className={`absolute inset-0 transition-all duration-1000 ${index === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}>
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${event.image})` }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-10 md:p-16 text-right">
                    <span className="bg-rose-600 text-white px-5 py-2 rounded-full text-xs font-black uppercase mb-5 inline-block shadow-lg">המלצת השבוע</span>
                    <h2 className="text-4xl md:text-7xl font-black text-white mb-3 drop-shadow-2xl">{event.title}</h2>
                    <p className="text-sm md:text-xl text-white/90 font-bold mb-8 flex items-center gap-3 md:justify-start justify-center text-right">
                       <MapPin size={20} className="text-rose-400" /> {event.location} • {new Date(event.date).toLocaleDateString('he-IL')}
                    </p>
                    <Link to="/events" className="inline-block bg-white text-rose-600 px-10 py-4 rounded-2xl font-black text-base hover:scale-105 transition-transform shadow-2xl">פרטים והרשמה</Link>
                </div>
            </div>
            ))}
        </section>

        {/* קטגוריות */}
        <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar px-2">
            {categories.map((cat, idx) => (
              <button key={idx} onClick={() => navigate('/events', { state: { category: cat.name } })} 
                      className="flex items-center gap-4 px-8 py-5 bg-white/90 backdrop-blur-md rounded-[2rem] text-base font-black text-slate-700 shadow-md border border-white/50 hover:border-rose-300 hover:text-rose-600 transition-all flex-shrink-0 group">
                <span className="text-rose-500 p-3 bg-rose-50 rounded-2xl group-hover:bg-rose-500 group-hover:text-white transition-colors">{cat.icon}</span>{cat.name}
              </button>
            ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-10">
                
                {/* --- אשת השבוע: עיצוב אלמנט קטן ויוקרתי (חצי דף) --- */}
                {personality && personality.name && (
                    <section className="animate-fade-in group">
                        <div className="bg-white/90 backdrop-blur-xl rounded-[3rem] p-6 md:p-8 shadow-xl border border-white/50 flex flex-col md:flex-row items-center gap-8 max-w-2xl">
                            <div className="relative shrink-0">
                                <img src={personality.image} className="w-32 h-32 md:w-48 md:h-48 rounded-[2.5rem] object-cover shadow-lg border-4 border-white group-hover:rotate-2 transition-transform duration-500" alt={personality.name} />
                                <div className="absolute -bottom-2 -right-2 bg-yellow-400 p-3 rounded-2xl shadow-lg animate-pulse"><Sparkles className="text-white" size={20}/></div>
                            </div>
                            <div className="text-center md:text-right space-y-2 flex-1">
                                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 px-4 py-1 rounded-full">אשת השבוע</span>
                                <h3 className="text-2xl md:text-4xl font-black text-slate-900">{personality.name}</h3>
                                <p className="text-sm md:text-lg text-slate-500 font-bold leading-tight line-clamp-2">{personality.role}</p>
                                <button onClick={() => setShowFullInterview(true)} className="mt-4 text-sm font-black text-rose-600 flex items-center gap-2 hover:gap-3 transition-all mx-auto md:mr-0">
                                   קראי את הראיון המלא <Send size={14} className="rotate-180" />
                                </button>
                            </div>
                        </div>

                        {/* מודאל הראיון המלא (ללא גלילה פנימית, גלילה על כל הדף) */}
                        {showFullInterview && (
                            <div className="fixed inset-0 z-[200] bg-white overflow-y-auto animate-fade-in no-scrollbar text-right" dir="rtl">
                                <div className="sticky top-0 bg-white/80 backdrop-blur-md p-6 flex justify-between items-center border-b z-50">
                                    <button onClick={() => setShowFullInterview(false)} className="p-3 bg-slate-100 rounded-full hover:bg-rose-100 transition-colors"><X size={24}/></button>
                                    <h4 className="font-black text-rose-600 text-xl">ראיון השבוע הבלעדי</h4>
                                </div>
                                <div className="max-w-3xl mx-auto p-8 md:p-20 space-y-12">
                                    <div className="text-center space-y-6">
                                        <img src={personality.image} className="w-48 h-48 md:w-64 md:h-64 rounded-[4rem] mx-auto object-cover shadow-2xl border-8 border-rose-50" />
                                        <h2 className="text-4xl md:text-7xl font-black text-slate-900 leading-none">{personality.name}</h2>
                                        <div className="h-2 w-32 bg-rose-500 mx-auto rounded-full"></div>
                                        <p className="text-xl md:text-3xl text-slate-500 font-bold">{personality.role}</p>
                                    </div>
                                    <div className="space-y-12">
                                        {personality.questions?.map((q: any, i: number) => q.answer && (
                                            <div key={i} className="border-r-[10px] border-rose-500 pr-8 py-4 space-y-4 animate-fade-in-up" style={{animationDelay: `${i*0.1}s`}}>
                                                <h5 className="font-black text-rose-600 text-lg md:text-2xl leading-tight">Q: {q.question}</h5>
                                                <p className="text-slate-800 text-xl md:text-4xl font-medium leading-relaxed italic">"{q.answer}"</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* --- COMMUNITY ITEMS SECTION --- */}
                {communityItems && communityItems.length > 0 && (
                    <section className="space-y-6 animate-fade-in">
                        <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3 px-4">
                            <HeartHandshake className="text-emerald-500" size={28}/> מה קורה בקהילה
                        </h3>
                        <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar px-2">
                            {communityItems.map((item) => (
                                <div key={item._id || item.id} className="bg-white/90 backdrop-blur-md p-5 rounded-[2.5rem] shadow-lg border border-white/50 flex items-center gap-4 shrink-0 w-72 group hover:border-emerald-200 transition-all hover:translate-y-[-4px]">
                                    <img src={item.image} className="w-16 h-16 rounded-2xl object-cover shrink-0 shadow-inner" />
                                    <div className="flex-1 overflow-hidden text-right">
                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{item.category}</span>
                                        <h4 className="font-black text-slate-800 text-sm truncate">{item.title}</h4>
                                        <p className="text-slate-500 text-[10px] font-bold truncate">{item.location}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <div className="space-y-6">
                    <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3 px-4"><Bell className="text-rose-500" size={28}/> עדכונים חמים</h3>
                    <div className="grid md:grid-cols-2 gap-6">
                        {mockNews.map((item) => (
                            <div key={item.id} className="bg-white/90 backdrop-blur-md p-7 rounded-[2.5rem] shadow-lg border border-white/50 flex items-center gap-6 group hover:border-rose-200 transition-all hover:translate-y-[-4px]">
                                <div className="w-16 h-16 bg-rose-50 rounded-3xl flex flex-col items-center justify-center text-rose-600 shrink-0 font-black shadow-inner">
                                    <span className="text-lg leading-none">{item.date.split('/')[0]}</span>
                                    <span className="text-xs opacity-60">{item.date.split('/')[1]}</span>
                                </div>
                                <div className="text-right">
                                    <h4 className="font-black text-slate-800 text-base md:text-lg group-hover:text-rose-600 transition-colors">{item.title}</h4>
                                    <p className="text-slate-500 text-sm line-clamp-1 font-bold">{item.description}</p>
                                </div>
                                {item.important && <div className="mr-auto w-3 h-3 bg-rose-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(225,29,72,0.6)]"></div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-10">
                <div className="bg-slate-900/95 backdrop-blur-xl rounded-[4rem] p-12 text-white relative overflow-hidden shadow-2xl group border border-white/10 text-right">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/20 rounded-full blur-[80px] -mr-24 -mt-24"></div>
                    <div className="relative z-10 space-y-8">
                        <p className="text-2xl md:text-3xl font-serif italic leading-relaxed font-bold opacity-95">"הכוח האמיתי של אישה נמצא ביכולת שלה להאיר לאחרות את הדרך."</p>
                        <div className="flex items-center gap-4 justify-end">
                            <span className="text-xs font-black opacity-50 tracking-[0.3em] uppercase">השראה יומית</span>
                            <div className="w-12 h-12 rounded-2xl bg-rose-500 flex items-center justify-center font-black text-sm shadow-xl shadow-rose-900/40">נ.ש</div>
                        </div>
                    </div>
                </div>

                {!user ? (
                   <div onClick={onOpenLogin} className="cursor-pointer bg-gradient-to-br from-rose-600/90 to-pink-600/90 backdrop-blur-md rounded-[4rem] p-10 text-white shadow-2xl shadow-rose-200/50 text-center space-y-6 hover:scale-[1.03] transition-transform border border-white/20 flex flex-col items-center">
                      <HeartHandshake size={60} className="mx-auto drop-shadow-lg" />
                      <h3 className="text-3xl font-black">הצטרפי למעגל</h3>
                      <p className="text-sm font-bold opacity-90 leading-relaxed max-w-sm">תהיי חלק מהשינוי בעיר. תרמי לקהילה ותקבלי עולם שלם של תרבות והטבות.</p>
                      <button className="bg-white text-rose-600 px-10 py-4 rounded-[1.5rem] font-black text-base shadow-2xl hover:bg-slate-50 transition-colors">הרשמה מהירה</button>
                   </div>
                ) : (
                  <div className="bg-white/90 backdrop-blur-md p-10 rounded-[4rem] shadow-2xl border border-white/50 text-center space-y-6 flex flex-col items-center">
                      <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto text-rose-500 shadow-inner"><Phone size={32}/></div>
                      <h3 className="text-2xl font-black text-slate-800">דברי איתנו</h3>
                      <p className="text-sm text-slate-500 font-bold leading-relaxed max-w-sm">לכל שאלה, הצעה או שיתוף פעולה - הצוות שלנו זמין עבורך תמיד.</p>
                      <a href="tel:0500000000" className="block w-full py-5 bg-slate-50 text-slate-800 rounded-2xl font-black text-base hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-100 shadow-sm">חיוג מהיר למוקד</a>
                  </div>
                )}
            </div>
        </div>
      </div>

      {/* מודאל הצטרפות */}
      {showMembershipModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in text-right">
              <div className="bg-white/95 backdrop-blur-xl rounded-[4rem] w-full max-w-xl p-10 md:p-14 relative shadow-[0_30px_100px_rgba(0,0,0,0.4)] overflow-y-auto max-h-[95vh] no-scrollbar border border-white/20">
                  <button onClick={() => setShowMembershipModal(false)} className="absolute top-10 left-10 p-3 hover:bg-slate-100 rounded-full transition-colors"><X size={24}/></button>
                  <div className="text-right space-y-8">
                      <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center text-rose-500 shadow-inner rotate-12"><Sparkles size={40}/></div>
                      <h2 className="text-4xl font-black text-slate-900 leading-tight">נתינה פוגשת עוצמה</h2>
                      <p className="text-slate-500 text-base md:text-lg leading-relaxed font-bold">
                        הצטרפות למעגל מאפשרת לך להיות חלק משפיע, להוביל מיזמים חברתיים ולצבור נקודות "נשי" המעניקות הנחות ענק להופעות, סדנאות והגרלות בלעדיות.
                      </p>
                      
                      <form onSubmit={handleMembershipSubmit} className="space-y-5 pt-8 border-t border-slate-100">
                          <div className="grid grid-cols-2 gap-5 text-right">
                            <input required type="number" placeholder="גיל" className="p-5 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-rose-100 transition-all text-right" value={membershipForm.age} onChange={e=>setMembershipForm({...membershipForm, age: e.target.value})}/>
                            <input required type="text" placeholder="עיסוק" className="p-5 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-rose-100 transition-all text-right" value={membershipForm.occupation} onChange={e=>setMembershipForm({...membershipForm, occupation: e.target.value})}/>
                          </div>
                          <input required type="text" placeholder="כתובת מגורים מלאה" className="w-full p-5 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-rose-100 transition-all text-right" value={membershipForm.address} onChange={e=>setMembershipForm({...membershipForm, address: e.target.value})}/>
                          <input required type="tel" placeholder="טלפון ליצירת קשר" className="w-full p-5 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-rose-100 transition-all text-right" value={membershipForm.phone} onChange={e=>setMembershipForm({...membershipForm, phone: e.target.value})}/>
                          <button type="submit" className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl hover:bg-rose-600 transition-all active:scale-95 flex items-center justify-center gap-4">
                             <Send size={24}/> שליחת בקשה
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