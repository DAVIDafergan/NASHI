import React, { useState, useEffect } from 'react';
import { 
  Bell, Star, Heart, Music, Palette, Activity, Briefcase, Mic, Gift, Clock, Sparkles,
  X, Send, ChevronLeft, MapPin, Phone, User as UserIcon, HeartHandshake
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface EventItem {
  id: string;
  _id?: string;
  title: string;
  date: string;
  location: string;
  category: string;
  image: string;
  isHero?: boolean;
}

interface LotteryItem {
  id: string;
  _id?: string;
  title: string;
  prize: string;
  drawDate: string;
  isActive: boolean;
}

const API_URL = 'https://nashi-production.up.railway.app/api';

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
  { name: 'קהילה', icon: <Heart size={14} /> },
];

const HomePage = ({ user, onOpenLogin, onUpdateUser }: { user: any, onOpenLogin: () => void, onUpdateUser?: (u: any) => void }) => {
  const navigate = useNavigate();
  
  // Data State
  const [events, setEvents] = useState<EventItem[]>([]);
  const [lotteries, setLotteries] = useState<LotteryItem[]>([]);
  const [personality, setPersonality] = useState<any>(null);
  
  // UI State
  const [currentSlide, setCurrentSlide] = useState(0);
  const [upcomingLottery, setUpcomingLottery] = useState<LotteryItem | null>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [showMembershipBanner, setShowMembershipBanner] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showFullInterview, setShowFullInterview] = useState(false);
  
  // Form State
  const [membershipForm, setMembershipForm] = useState({
      age: '', occupation: '', address: '', phone: user?.phone || ''
  });

  // 1. Fetch Data
  useEffect(() => {
    fetch(`${API_URL}/events`).then(res => res.json()).then(data => {
         setEvents(data.map((e: any) => ({...e, id: e._id || e.id})));
    }).catch(console.error);

    fetch(`${API_URL}/lotteries`).then(res => res.json()).then(data => {
         setLotteries(data.map((l: any) => ({...l, id: l._id || l.id})));
    }).catch(console.error);

    api.getPersonality().then(setPersonality).catch(console.error);
  }, []);

  // 2. Membership Banner Logic
  useEffect(() => {
    if (user && !user.isMemberRequested && !user.isMemberApproved) {
        const timer = setTimeout(() => setShowMembershipBanner(true), 2500);
        return () => clearTimeout(timer);
    }
  }, [user]);

  // 3. Slider Logic
  const heroEvents = events.filter(e => e.isHero);
  const displayEvents = heroEvents.length > 0 ? heroEvents : events.slice(0, 3);

  useEffect(() => {
    if (displayEvents.length > 0) {
        const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % displayEvents.length);
        }, 5000);
        return () => clearInterval(interval);
    }
  }, [displayEvents]);

  // 4. Timer Logic
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
              setShowMembershipBanner(false);
              alert("הבקשה נשלחה בהצלחה! המתיני לאישור המנהלת.");
          }
      } catch (err) { alert("שגיאה בשליחה"); }
  };

  return (
    <div className="min-h-screen pb-24 bg-[#fdfcfb] overflow-x-hidden">
      
      {/* --- HEADER צבעוני (סטייל חרבות אור/אמנותי) --- */}
      <div className="relative pt-12 pb-24 px-6 text-white rounded-b-[3.5rem] shadow-2xl overflow-hidden" 
           style={{ background: 'linear-gradient(135deg, #e11d48 0%, #f97316 50%, #fbbf24 100%)' }}>
          <div className="absolute inset-0 opacity-15 bg-[url('https://www.transparenttextures.com/patterns/watercolor.png')]"></div>
          <div className="relative z-10 text-center space-y-4 max-w-2xl mx-auto animate-fade-in">
              <div className="bg-white/20 w-16 h-16 rounded-[1.5rem] backdrop-blur-md flex items-center justify-center mx-auto border border-white/30 rotate-12 shadow-xl">
                <Heart className="fill-white" size={32} />
              </div>
              <h1 className="text-5xl md:text-8xl font-black tracking-tighter drop-shadow-2xl">נשי<span className="text-white/70">.</span></h1>
              <p className="text-sm md:text-2xl font-bold opacity-90 leading-tight">הבית שלך לתרבות, קהילה ועוצמה נשית בעיר.</p>
          </div>
      </div>

      {/* --- מדד נקודות (מותנה באישור) --- */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-10 relative z-20 space-y-6">
        {user?.isMemberApproved && (
           <div className="bg-white p-4 md:p-6 rounded-[2.5rem] border-2 border-yellow-400 flex items-center justify-between shadow-2xl animate-bounce-in">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-50 rounded-2xl"><Star className="text-yellow-500 fill-current" size={28} /></div>
                  <div>
                    <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase">היתרה שלך</p>
                    <span className="font-black text-slate-800 text-lg md:text-2xl">{user.points} נקודות</span>
                  </div>
              </div>
              <Link to="/lottery" className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-black hover:bg-rose-600 transition-all shadow-lg active:scale-95">מימוש הטבות</Link>
           </div>
        )}

        {/* --- Upcoming Lottery --- */}
        {upcomingLottery && (
            <Link to="/lottery" className="block animate-fade-in-up">
                <div className="bg-gradient-to-r from-purple-700 to-fuchsia-500 rounded-[2.5rem] p-5 md:p-6 shadow-xl shadow-purple-200 border border-white/20 flex items-center justify-between overflow-hidden relative group">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/30 shadow-inner">
                            <Gift size={24} className="animate-bounce" />
                        </div>
                        <div className="text-white">
                            <h3 className="font-black text-sm md:text-lg">ההגרלה מתחילה!</h3>
                            <p className="text-[10px] md:text-xs text-purple-100 opacity-90">הפרס: {upcomingLottery.prize}</p>
                        </div>
                    </div>
                    <div className="text-left relative z-10">
                        <p className="text-[9px] text-purple-200 font-bold mb-1">נסגר בעוד:</p>
                        <div className="font-mono text-lg md:text-2xl font-black text-white flex items-center gap-2">
                            <Clock size={18} className="text-pink-300" /> {timeLeft}
                        </div>
                    </div>
                </div>
            </Link>
        )}

        {/* --- Hero Slider --- */}
        <section className="relative h-[300px] md:h-[450px] w-full overflow-hidden rounded-[3rem] shadow-2xl border-4 border-white">
            {displayEvents.map((event, index) => (
            <div key={event.id} className={`absolute inset-0 transition-all duration-1000 ${index === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}>
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${event.image})` }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 text-right">
                    <span className="bg-rose-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase mb-4 inline-block">מומלץ השבוע</span>
                    <h2 className="text-3xl md:text-6xl font-black text-white mb-2 drop-shadow-md">{event.title}</h2>
                    <p className="text-sm md:text-lg text-white/90 font-medium mb-6 flex items-center gap-2 md:justify-start justify-center">
                       <MapPin size={16} /> {event.location} • {new Date(event.date).toLocaleDateString('he-IL')}
                    </p>
                    <Link to="/events" className="inline-block bg-white text-rose-600 px-8 py-3.5 rounded-2xl font-black text-sm hover:scale-105 transition-transform shadow-xl">להרשמה מהירה</Link>
                </div>
            </div>
            ))}
        </section>

        {/* --- Categories (Scrollable) --- */}
        <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
            {categories.map((cat, idx) => (
              <button key={idx} onClick={() => navigate('/events', { state: { category: cat.name } })} 
                      className="flex items-center gap-3 px-6 py-4 bg-white rounded-3xl text-sm font-black text-slate-700 shadow-sm border border-slate-100 hover:border-rose-300 hover:text-rose-600 transition-all flex-shrink-0">
                <span className="text-rose-500 p-2 bg-rose-50 rounded-xl">{cat.icon}</span>{cat.name}
              </button>
            ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                
                {/* --- אשת השבוע (מעוצב מחדש) --- */}
                {personality && personality.isActive && (
                    <section className="bg-white p-6 md:p-10 rounded-[3.5rem] shadow-xl border border-rose-50 relative group overflow-hidden">
                        <div className="absolute top-0 left-0 w-32 h-32 bg-rose-500/5 rounded-full -ml-16 -mt-16 transition-transform group-hover:scale-150"></div>
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className="relative">
                                <img src={personality.image} className="w-32 h-32 md:w-44 md:h-44 rounded-[2.5rem] object-cover shadow-2xl border-4 border-white rotate-3 group-hover:rotate-0 transition-transform duration-500" />
                                <div className="absolute -bottom-2 -right-2 bg-yellow-400 p-3 rounded-2xl shadow-lg"><Sparkles className="text-white" size={20}/></div>
                            </div>
                            <div className="text-center md:text-right flex-1 space-y-2">
                                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 px-3 py-1 rounded-full">מדור אשת השבוע</span>
                                <h3 className="text-3xl md:text-5xl font-black text-slate-900 leading-tight">{personality.name}</h3>
                                <p className="text-sm md:text-xl text-slate-500 font-bold">{personality.role}</p>
                                <button onClick={() => setShowFullInterview(true)} 
                                        className="mt-4 w-full md:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-rose-600 transition-all shadow-xl">
                                    קראי את הראיון המלא
                                </button>
                            </div>
                        </div>

                        {/* מודאל ראיון מלא - פריסה קבועה ורספונסיבית */}
                        {showFullInterview && (
                            <div className="fixed inset-0 z-[200] bg-white overflow-y-auto animate-slide-up no-scrollbar">
                                <div className="sticky top-0 bg-white/95 backdrop-blur-md p-5 flex justify-between items-center border-b z-50">
                                    <button onClick={() => setShowFullInterview(false)} className="p-3 bg-slate-100 rounded-full hover:bg-rose-100 transition-colors"><X/></button>
                                    <h4 className="font-black text-rose-500 text-lg">ראיון השבוע בלעדי</h4>
                                </div>
                                <div className="p-8 md:p-20 max-w-3xl mx-auto space-y-12">
                                    <div className="text-center space-y-6">
                                        <img src={personality.image} className="w-48 h-48 md:w-72 md:h-72 rounded-[3.5rem] mx-auto object-cover shadow-2xl border-8 border-rose-50 rotate-2" />
                                        <h2 className="text-4xl md:text-7xl font-black text-slate-900 leading-none">{personality.name}</h2>
                                        <div className="h-1.5 w-24 bg-rose-500 mx-auto rounded-full"></div>
                                    </div>
                                    <div className="space-y-8">
                                        {personality.questions?.map((q: any, i: number) => (
                                            <div key={i} className="bg-[#fafafa] p-8 md:p-12 rounded-[3rem] border-r-8 border-rose-500 shadow-sm animate-fade-in-up" style={{animationDelay: `${i*0.1}s`}}>
                                                <h5 className="font-black text-rose-600 mb-4 text-sm md:text-xl leading-tight">Q: {q.question}</h5>
                                                <p className="text-slate-700 leading-relaxed text-sm md:text-2xl font-medium">{q.answer}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* --- News Updates --- */}
                <div className="space-y-4">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 px-2"><Bell className="text-rose-500" size={20}/> עדכונים אחרונים</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        {mockNews.map((item) => (
                            <div key={item.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-5 group hover:border-rose-200 transition-all">
                                <div className="w-14 h-14 bg-rose-50 rounded-2xl flex flex-col items-center justify-center text-rose-500 shrink-0 font-black">
                                    <span className="text-sm">{item.date.split('/')[0]}</span>
                                    <span className="text-[10px] opacity-60">{item.date.split('/')[1]}</span>
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-800 text-sm md:text-base group-hover:text-rose-600 transition-colors">{item.title}</h4>
                                    <p className="text-slate-500 text-xs line-clamp-1 font-medium">{item.description}</p>
                                </div>
                                {item.important && <div className="mr-auto w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse shadow-lg shadow-rose-200"></div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                {/* --- Inspiration Card --- */}
                <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl group">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-rose-500/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
                    <div className="relative z-10 space-y-6">
                        <p className="text-xl md:text-2xl font-serif italic leading-relaxed font-medium opacity-90">"הכוח האמיתי של אישה נמצא ביכולת שלה להאיר לאחרות את הדרך."</p>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center font-black text-xs shadow-lg shadow-rose-900">נ.ש</div>
                            <span className="text-xs font-black opacity-60 tracking-widest uppercase">השראה יומית</span>
                        </div>
                    </div>
                </div>

                {/* --- Quick Contact/Join Card --- */}
                {!user ? (
                   <div onClick={onOpenLogin} className="cursor-pointer bg-gradient-to-br from-rose-500 to-pink-600 rounded-[3rem] p-8 text-white shadow-xl shadow-rose-200 text-center space-y-4 hover:scale-[1.02] transition-transform">
                      <HeartHandshake size={48} className="mx-auto" />
                      <h3 className="text-2xl font-black">הצטרפי למעגל</h3>
                      <p className="text-xs font-bold opacity-80">תהיי חלק מהשינוי. תרמי לקהילה ותקבלי עולם שלם של תרבות.</p>
                      <button className="bg-white text-rose-600 px-8 py-3 rounded-2xl font-black text-sm shadow-xl">הרשמה מהירה</button>
                   </div>
                ) : (
                  <div className="bg-white p-8 rounded-[3rem] shadow-lg border border-slate-50 text-center space-y-4">
                      <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500"><Phone/></div>
                      <h3 className="text-xl font-black text-slate-800">צרי קשר איתנו</h3>
                      <p className="text-xs text-slate-500 font-medium">לכל שאלה, הצעה או שיתוף פעולה - אנחנו כאן בשבילך.</p>
                      <a href="tel:0500000000" className="block w-full py-4 bg-slate-50 text-slate-700 rounded-2xl font-black text-sm hover:bg-rose-50 transition-colors">חיוג מהיר</a>
                  </div>
                )}
            </div>
        </div>
      </div>

      {/* --- Floating Membership Banner --- */}
      {showMembershipBanner && (
          <div className="fixed bottom-24 left-4 right-4 z-[150] animate-bounce-in">
              <div className="bg-gradient-to-r from-rose-600 to-pink-500 p-5 rounded-[2.5rem] shadow-2xl border-2 border-white/20 text-white flex items-center justify-between">
                  <button onClick={() => setShowMembershipBanner(false)} className="bg-white/20 p-1.5 rounded-full hover:bg-white/40"><X size={16}/></button>
                  <div className="flex items-center gap-4 text-right">
                      <div>
                          <h3 className="font-black text-sm md:text-base leading-none">הצטרפי למעגל הנשי!</h3>
                          <p className="text-[10px] md:text-xs opacity-90 mt-1">צברי נקודות הטבה יוקרתיות על כל תרומה לקהילה.</p>
                      </div>
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center"><Heart className="fill-current" /></div>
                  </div>
                  <button onClick={() => setShowMembershipModal(true)} className="bg-white text-rose-600 px-5 py-2.5 rounded-xl font-black text-[11px] shadow-xl">למידע נוסף</button>
              </div>
          </div>
      )}

      {/* --- Membership Registration Modal --- */}
      {showMembershipModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
              <div className="bg-white rounded-[3.5rem] w-full max-w-lg p-8 md:p-12 relative shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar">
                  <button onClick={() => setShowMembershipModal(false)} className="absolute top-8 left-8 p-2 hover:bg-slate-50 rounded-full"><X/></button>
                  <div className="text-right space-y-6">
                      <div className="w-16 h-16 bg-rose-50 rounded-[1.5rem] flex items-center justify-center text-rose-500"><Sparkles size={32}/></div>
                      <h2 className="text-3xl font-black text-slate-900 leading-tight">מעגל נשי – המקום שבו נתינה פוגשת עוצמה</h2>
                      <p className="text-slate-500 text-sm md:text-base leading-relaxed font-medium">
                        הצטרפות למעגל מאפשרת לך להיות חלק משפיע מהקהילה, להוביל מיזמים חברתיים ולצבור נקודות "נשי" שמעניקות הנחות ענק להופעות, סדנאות והגרלות בלעדיות.
                      </p>
                      
                      <form onSubmit={handleMembershipSubmit} className="space-y-4 pt-6 border-t border-slate-100">
                          <div className="grid grid-cols-2 gap-4">
                            <input required type="number" placeholder="גיל" className="p-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-rose-200" value={membershipForm.age} onChange={e=>setMembershipForm({...membershipForm, age: e.target.value})}/>
                            <input required type="text" placeholder="עיסוק" className="p-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-rose-200" value={membershipForm.occupation} onChange={e=>setMembershipForm({...membershipForm, occupation: e.target.value})}/>
                          </div>
                          <input required type="text" placeholder="כתובת מגורים מלאה" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-rose-200" value={membershipForm.address} onChange={e=>setMembershipForm({...membershipForm, address: e.target.value})}/>
                          <input required type="tel" placeholder="טלפון ליצירת קשר" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-rose-200" value={membershipForm.phone} onChange={e=>setMembershipForm({...membershipForm, phone: e.target.value})}/>
                          <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-lg shadow-2xl hover:bg-rose-600 transition-all active:scale-95 flex items-center justify-center gap-3">
                             <Send size={20}/> שליחת בקשה להצטרפות
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