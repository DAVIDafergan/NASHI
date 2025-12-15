import React, { useState, useEffect } from 'react';
import { 
  Bell, Star, Heart, Music, Palette, Activity, Briefcase, Mic, Gift, Clock, Sparkles
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import WomanOfTheWeek from '../components/WomanOfTheWeek'; // ודא שהנתיב נכון

// טיפוסים פנימיים למניעת תלות ב-types.ts אם יש שינויים
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

interface User {
  name: string;
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

const HomePage = ({ user, onOpenLogin }: { user: User | null, onOpenLogin: () => void }) => {
  const navigate = useNavigate();
  
  // Data State
  const [events, setEvents] = useState<EventItem[]>([]);
  const [lotteries, setLotteries] = useState<LotteryItem[]>([]);
  
  // UI State
  const [currentSlide, setCurrentSlide] = useState(0);
  const [upcomingLottery, setUpcomingLottery] = useState<LotteryItem | null>(null);
  const [timeLeft, setTimeLeft] = useState('');

  // 1. Fetch Data from Server
  useEffect(() => {
    // Events
    fetch(`${API_URL}/events`)
      .then(res => res.json())
      .then(data => {
         const formatted = data.map((e: any) => ({...e, id: e._id || e.id}));
         setEvents(formatted);
      })
      .catch(console.error);

    // Lotteries
    fetch(`${API_URL}/lotteries`)
      .then(res => res.json())
      .then(data => {
         const formatted = data.map((l: any) => ({...l, id: l._id || l.id}));
         setLotteries(formatted);
      })
      .catch(console.error);
  }, []);

  const heroEvents = events.filter(e => e.isHero);
  const displayEvents = heroEvents.length > 0 ? heroEvents : events.slice(0, 3);

  // 2. Lottery Timer Logic
  useEffect(() => {
    const checkLottery = () => {
        const now = new Date().getTime();
        // מחפש הגרלה שמתרחשת ב-24 שעות הקרובות
        const active = lotteries.find(l => {
            const drawTime = new Date(l.drawDate).getTime();
            const diff = drawTime - now;
            return l.isActive && diff > 0 && diff <= (24 * 60 * 60 * 1000); 
        });

        if (active) {
            setUpcomingLottery(active);
            const diff = new Date(active.drawDate).getTime() - now;
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeLeft(`${hours}:${minutes < 10 ? '0'+minutes : minutes}:${seconds < 10 ? '0'+seconds : seconds}`);
        } else {
            setUpcomingLottery(null);
        }
    };

    const interval = setInterval(checkLottery, 1000);
    checkLottery();
    return () => clearInterval(interval);
  }, [lotteries]);

  // 3. Slider Auto-Play
  useEffect(() => {
    if (displayEvents.length > 0) {
        const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % displayEvents.length);
        }, 6000);
        return () => clearInterval(interval);
    }
  }, [displayEvents]);

  const handleCategoryClick = (categoryName: string) => {
      navigate('/events', { state: { category: categoryName } });
  };

  return (
    <div className="min-h-screen pb-20 p-4 md:p-8 space-y-8">
      
      {/* --- Upcoming Lottery Banner --- */}
      {upcomingLottery && (
          <Link to="/lottery" className="block mb-6 animate-fade-in-up">
              <div className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 rounded-3xl p-5 shadow-xl shadow-purple-200/50 border border-purple-400/30 flex items-center justify-between relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                  <div className="absolute -left-10 -top-10 w-32 h-32 bg-white rounded-full blur-3xl opacity-20 animate-pulse"></div>
                  
                  <div className="flex items-center gap-4 relative z-10">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30 shadow-inner">
                          <Gift size={22} className="animate-bounce" />
                      </div>
                      <div className="text-white">
                          <div className="flex items-center gap-2 mb-0.5">
                             <span className="bg-white/90 text-purple-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full animate-pulse shadow-sm">הגרלה פעילה</span>
                             <h3 className="font-bold text-sm">ההגרלה מתחילה בקרוב!</h3>
                          </div>
                          <p className="text-xs text-purple-100 font-medium">פרס: {upcomingLottery.prize}</p>
                      </div>
                  </div>

                  <div className="text-left relative z-10">
                      <p className="text-[10px] text-purple-200 font-medium mb-1 uppercase tracking-widest">זמן שנותר</p>
                      <div className="font-mono text-xl font-black text-white flex items-center gap-1.5 drop-shadow-sm">
                          <Clock size={16} className="text-pink-200" />
                          {timeLeft}
                      </div>
                  </div>
              </div>
          </Link>
      )}

      {/* --- Welcome Banner (LoggedIn) --- */}
      {user && (
         <div className="bg-white/60 backdrop-blur-md p-4 rounded-3xl border border-white flex items-center justify-between animate-fade-in-up shadow-sm shadow-rose-100/20">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-rose-400 shadow-sm border border-rose-50">
                    <Star size={18} className="fill-current" />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-slate-700">היי {user.name.split(' ')[0]}</h2>
                    <p className="text-slate-500 text-[10px] md:text-xs">שמחים לראות אותך כאן שוב.</p>
                </div>
            </div>
         </div>
      )}

      {/* --- Hero Slider --- */}
      {displayEvents.length > 0 && (
        <section className="relative h-[280px] md:h-[380px] w-full overflow-hidden group rounded-[2rem] md:rounded-[2.5rem] shadow-xl shadow-rose-200/40 mb-8 border border-white">
            {displayEvents.map((event, index) => (
            <div 
                key={event.id}
                className={`absolute inset-0 transition-all duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
            >
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${event.image})` }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-slate-900/10 to-transparent"></div>
                
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 flex flex-col items-start justify-end">
                    <span className="bg-white/20 backdrop-blur-md border border-white/20 text-white px-3 py-1 rounded-full text-[10px] md:text-xs font-bold tracking-wide mb-2 shadow-sm">
                        מומלץ עבורך
                    </span>
                    <h2 className="text-2xl md:text-4xl font-black text-white leading-tight mb-1 drop-shadow-md">
                        {event.title}
                    </h2>
                    <p className="text-xs md:text-sm text-white/95 font-medium max-w-md mb-4 flex items-center gap-2 drop-shadow-sm">
                         {new Date(event.date).toLocaleDateString('he-IL')} • {event.location}
                    </p>
                    <Link to="/events" className="bg-white/90 backdrop-blur text-rose-600 px-6 py-2.5 rounded-full font-bold text-xs hover:bg-white transition-colors shadow-lg shadow-black/10 active:scale-95">
                        לפרטים והרשמה
                    </Link>
                </div>
            </div>
            ))}
            
            <div className="absolute bottom-6 left-6 flex gap-1.5 z-10">
                {displayEvents.map((_, idx) => (
                <button 
                    key={idx} 
                    onClick={() => setCurrentSlide(idx)} 
                    className={`h-1.5 rounded-full transition-all duration-500 shadow-sm ${idx === currentSlide ? 'bg-white w-6' : 'bg-white/50 w-1.5'}`} 
                />
                ))}
            </div>
        </section>
      )}

      {/* --- Categories --- */}
      <div>
          <h3 className="font-bold text-sm text-slate-700 mb-3 px-1">קטגוריות מובילות</h3>
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
            {categories.map((cat, idx) => (
              <button 
                key={idx}
                onClick={() => handleCategoryClick(cat.name)}
                className="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 hover:text-rose-600 hover:bg-white hover:shadow-md hover:shadow-rose-100 rounded-full text-xs font-bold transition-all border border-slate-100 hover:border-rose-100 shadow-sm flex-shrink-0 active:scale-95"
              >
                <span className="text-rose-400">{cat.icon}</span>
                {cat.name}
              </button>
            ))}
          </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
          
          <div className="lg:col-span-2 space-y-6">
            
            {/* --- אשת השבוע (החדש!) --- */}
            <WomanOfTheWeek />

            {/* --- News Updates --- */}
            <div>
                <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                        <Bell size={14} className="text-rose-400" />
                        עדכונים
                    </h3>
                    <Link to="/news" className="text-[10px] font-bold text-slate-400 hover:text-rose-500">הכל</Link>
                </div>
                
                <div className="space-y-3">
                    {mockNews.map((item) => (
                        <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 hover:border-rose-200 transition-all flex items-center gap-4 group">
                            <div className="flex flex-col items-center justify-center bg-rose-50/50 w-12 h-12 rounded-xl text-rose-500 shrink-0 border border-rose-50 group-hover:bg-rose-50 transition-colors">
                                <span className="text-xs font-bold">{item.date.split('/')[0]}</span>
                                <span className="text-[10px] opacity-70">{item.date.split('/')[1]}</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm group-hover:text-rose-600 transition-colors">{item.title}</h4>
                                <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{item.description}</p>
                            </div>
                            {item.important && <div className="mr-auto w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-sm shadow-rose-300"></div>}
                        </div>
                    ))}
                </div>
            </div>
         </div>

         {/* --- Inspiration --- */}
         <div className="space-y-5">
            <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-[2rem] p-6 text-white relative overflow-hidden shadow-lg shadow-purple-100 group">
              <div className="relative z-10">
                <p className="text-sm font-medium leading-relaxed italic opacity-95 font-serif tracking-wide">
                  "תרבות היא לא מותרות, היא הכרח. היא מה שנותן משמעות לחיים."
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-[10px] shadow-inner">ל.ג</div>
                  <p className="font-bold text-[10px] opacity-80">לאה גולדברג</p>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:scale-110 transition-transform duration-1000"></div>
            </div>

            {!user && (
                <div onClick={onOpenLogin} className="cursor-pointer bg-slate-800 rounded-[2rem] p-6 text-white relative overflow-hidden shadow-lg group hover:bg-slate-900 transition-colors">
                    <div className="relative z-10 text-center">
                        <h3 className="text-lg font-black mb-1">הצטרפי אלינו</h3>
                        <p className="text-xs opacity-70 mb-4 font-light">קהילה, תרבות והשראה.</p>
                        <span className="inline-block bg-gradient-to-r from-rose-500 to-pink-500 text-white px-5 py-2 rounded-full text-[10px] font-bold shadow-lg shadow-rose-900/50">
                            הרשמה מהירה
                        </span>
                    </div>
                </div>
            )}
         </div>

      </div>
    </div>
  );
};

export default HomePage;