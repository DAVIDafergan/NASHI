import React, { useState, useEffect } from 'react';
import { Search, MapPin, Calendar, Tag, Heart, X, Share2, Star, MessageSquare, Ticket, CheckCircle2, ArrowLeft, Clock, Sparkles, Filter, SortAsc, History, Users2, ExternalLink, Lock } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import EventCard from '../components/EventCard';
import ScrollReveal from '../components/ScrollReveal';

// --- Types ---
interface EventSession {
  name: string;
  date: string;
}

interface EventItem {
  id: string;
  _id?: string;
  title: string;
  date: string;
  time?: string; // הוספת שדה שעה לטיפוס
  location: string;
  category: string;
  price: number;
  earlyBirdPrice?: number;
  earlyBirdEndDate?: string;
  sessions?: EventSession[];
  image: string;
  isHero?: boolean;
  ratings?: number[];
  notes?: string; 
  targetAges?: string;
  hebrewDate?: string;
  ticketLink?: string;
  logo?: string;
}

const API_URL = 'https://nashi-production.up.railway.app/api';

const EventsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filter, setFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  
  const [sortBy, setSortBy] = useState<'date' | 'price-low' | 'price-high'>('date');
  const [onlyFree, setOnlyFree] = useState(false);

  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [userRating, setUserRating] = useState(0);

  // בדיקת התחברות
  const token = localStorage.getItem('token');

  useEffect(() => {
    // רק אם יש טוקן נבצע את הקריאה לשרת
    if (token) {
        fetch(`${API_URL}/events`)
          .then(res => res.json())
          .then(data => {
            const formattedEvents = data.map((item: any) => ({
                ...item,
                id: item._id || item.id,
                date: item.date || new Date().toISOString(),
                image: item.image || 'https://via.placeholder.com/400x300',
                ratings: item.ratings || []
            }));
            setEvents(formattedEvents);
            setLoading(false);
          })
          .catch(err => {
            console.error("Error fetching events:", err);
            setLoading(false);
          });
    } else {
        setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (location.state && location.state.category) {
        setSelectedCategory(location.state.category);
    }
  }, [location.state]);

  useEffect(() => {
      if (selectedEvent) {
          setUserRating(0);
          setReviewText('');
          setReviewSubmitted(false);
      }
  }, [selectedEvent]);

  // הגנה על הדף - אם אין טוקן, נציג מסך התחברות מעוצב שמפנה לדפים המתאימים
  if (!token) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#fffcfc]" dir="rtl">
            <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-500 mb-6 shadow-inner border border-rose-100">
                <Lock size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-800 mb-2">התוכן זמין לחברות בלבד</h1>
            <p className="text-slate-500 mb-8 max-w-xs font-medium">כדי לצפות בלוח האירועים וליהנות מחוויות nashi, עלייך להיות מחוברת למערכת.</p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
                {/* לחיצה כאן תעביר לדף ההתחברות שלך */}
                <button 
                    onClick={() => navigate('/login')}
                    className="w-full py-4 bg-rose-500 text-white rounded-2xl font-black shadow-lg shadow-rose-100 hover:bg-rose-600 transition-all active:scale-95"
                >
                    התחברות למערכת
                </button>
                {/* לחיצה כאן תעביר לדף ההרשמה שלך */}
                <button 
                    onClick={() => navigate('/register')}
                    className="w-full py-4 bg-white text-slate-400 border border-rose-100 rounded-2xl font-black hover:text-rose-500 transition-all"
                >
                    הרשמה מהירה
                </button>
            </div>
        </div>
    );
  }

  const getDisplayPrice = (event: EventItem) => {
    if (event.earlyBirdPrice && event.earlyBirdEndDate) {
      const now = new Date();
      const deadline = new Date(event.earlyBirdEndDate);
      if (now <= deadline) {
        return { value: event.earlyBirdPrice, isEarly: true };
      }
    }
    return { value: event.price, isEarly: false };
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(filter.toLowerCase()) || event.location.toLowerCase().includes(filter.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || event.category === selectedCategory;
    const matchesFree = onlyFree ? getDisplayPrice(event).value === 0 : true;
    
    return matchesSearch && matchesCategory && matchesFree;
  }).sort((a, b) => {
      if (sortBy === 'date') {
          // דואג שאירועי עבר יופיעו תמיד למטה, כדי לא להסתיר אירועים חדשים
          const isPastA = new Date(a.date) < new Date();
          const isPastB = new Date(b.date) < new Date();
          
          if (isPastA && !isPastB) return 1;
          if (!isPastA && isPastB) return -1;
          
          // אם שניהם בעבר או שניהם בעתיד, סדר לפי תאריך
          return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (sortBy === 'price-low') return getDisplayPrice(a).value - getDisplayPrice(b).value;
      if (sortBy === 'price-high') return getDisplayPrice(b).value - getDisplayPrice(a).value;
      return 0;
  });

  const categories = ['all', 'מוזיקה', 'העשרה', 'סדנאות', 'קהילה', 'בידור', 'אופנה'];

  const handleShare = async () => {
      const token = localStorage.getItem('token');
      const url = window.location.href;
      
      if (navigator.share) {
          try { await navigator.share({ title: 'Nashi Event', url }); } catch {}
      } else {
          navigator.clipboard.writeText(url);
          alert('הקישור הועתק!');
      }

      if (token && selectedEvent) {
          fetch(`${API_URL}/events/${selectedEvent.id}/share`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
          });
      }
  };

  const handleSubmitReview = (e: React.FormEvent) => {
      e.preventDefault();
      const token = localStorage.getItem('token');
      if (!token) {
          alert('יש להתחבר כדי לדרג');
          return;
      }
      setReviewSubmitted(true);
      setTimeout(() => {
          setReviewText('');
          setUserRating(0);
          setReviewSubmitted(false);
      }, 3000);
  };

  const getAverageRating = (ratings?: number[]) => {
      if (!ratings || ratings.length === 0) return 0;
      const sum = ratings.reduce((a, b) => a + b, 0);
      return (sum / ratings.length).toFixed(1);
  };

  // פונקציית עזר להצגת שעה בצורה תקינה - מעודכנת לתמיכה בהגדרת מנהל
  const formatEventTime = (event: EventItem) => {
    // אם קיימת שעה שהמנהל הגדיר ידנית, נשתמש בה קודם
    if (event.time) return event.time;

    // אחרת, נשתמש בחישוב מהתאריך כגיבוי
    const dateObj = new Date(event.date);
    return dateObj.toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  if (loading) return (
      <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
      </div>
  );

  return (
    <div className="space-y-6 w-full pb-20 p-4 md:p-12 text-right bg-[#fffcfc]" dir="rtl">
      
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-8 justify-start">
            <button onClick={() => navigate(-1)} className="bg-white p-2.5 rounded-full shadow-sm text-slate-400 hover:text-rose-500 transition-colors border border-rose-50"><ArrowLeft size={20}/></button>
            <h1 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight">לוח אירועים <span className="text-rose-500 font-serif opacity-20">nashi</span></h1>
      </div>

      {/* --- Filter Bar --- */}
      <div className="bg-white/60 backdrop-blur-xl p-3 md:p-5 rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-rose-50 sticky top-16 md:top-20 z-40 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-rose-300" size={18} />
            <input 
              type="text" 
              placeholder="חפשי חוויות חדשות..." 
              className="w-full pr-11 pl-4 py-3 bg-white/50 border border-rose-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-rose-50 transition-all text-sm font-bold placeholder-slate-300 shadow-inner text-right"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full overflow-x-auto pb-1 no-scrollbar items-center">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-black whitespace-nowrap transition-all border ${
                  selectedCategory === cat 
                    ? 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-200' 
                    : 'bg-white text-slate-400 border-rose-50 hover:text-rose-500 hover:shadow-md'
                }`}
              >
                {cat === 'all' ? 'הכל' : cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 items-center overflow-x-auto no-scrollbar pt-2 border-t border-rose-50/50">
            <button onClick={() => setOnlyFree(!onlyFree)} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-black transition-all border ${onlyFree ? 'bg-emerald-500 text-white border-emerald-500 shadow-md' : 'bg-white text-slate-400 border-rose-50'}`}>
                <Ticket size={14}/> חינם בלבד
            </button>
            <div className="h-4 w-px bg-rose-100 mx-2"></div>
            <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-white border-none text-slate-500 text-[11px] font-black rounded-xl px-3 py-2 focus:outline-none shadow-sm cursor-pointer"
            >
                <option value="date">סדרי לפי תאריך</option>
                <option value="price-low">מחיר: מהנמוך</option>
                <option value="price-high">מחיר: מהגבוה</option>
            </select>
        </div>
      </div>

      {/* --- Events Grid --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
        {filteredEvents.map((event, i) => {
            const isPast = new Date(event.date) < new Date();

            return (
                <ScrollReveal key={event.id} delay={(i % 8) * 60}>
                  <EventCard
                      title={event.title}
                      image={event.image}
                      dateLabel={event.hebrewDate || new Date(event.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}
                      time={formatEventTime(event)}
                      location={event.location}
                      category={event.category}
                      isPast={isPast}
                      ctaLabel={isPast ? 'לסיכום' : 'לפרטים והרשמה'}
                      onClick={() => setSelectedEvent(event)}
                  />
                </ScrollReveal>
            );
        })}
      </div>
      
      {/* Empty State */}
      {filteredEvents.length === 0 && (
          <div className="text-center py-24 bg-white/40 rounded-[3rem] border-2 border-dashed border-rose-100">
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-300 shadow-inner">
                <Calendar size={28} />
            </div>
            <p className="text-slate-400 text-base font-black">לא מצאנו אירועים שתואמים לחיפוש שלך...</p>
            <button onClick={() => {setFilter(''); setSelectedCategory('all'); setOnlyFree(false);}} className="mt-4 text-rose-500 text-sm font-black underline decoration-2 underline-offset-4">ניקוי סינונים</button>
          </div>
      )}

      {/* --- Detailed Event Modal --- */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedEvent(null)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-white w-full md:max-w-[500px] rounded-t-2xl max-h-[88vh] overflow-y-auto shadow-2xl animate-slide-up relative border-t-4 border-[#2D6A4F] no-scrollbar">
                <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-2.5 sticky top-0"></div>

                {/* Close Button UI */}
                <button onClick={() => setSelectedEvent(null)} className="absolute top-5 left-5 p-3 bg-white/95 backdrop-blur-md rounded-full hover:bg-rose-500 hover:text-white z-50 text-slate-800 transition-all shadow-xl active:scale-90 border border-white/50"><X size={22} /></button>

                <div className="pb-8">
                  <div className="h-80 md:h-80 w-full relative overflow-hidden">
                      <img src={selectedEvent.image} className={`w-full h-full object-cover transition-transform duration-1000 ${new Date(selectedEvent.date) < new Date() ? 'grayscale' : ''}`} />
                      
                      {selectedEvent.logo && (
                        <div className="absolute top-5 right-5 w-14 h-14 bg-white/95 backdrop-blur-md p-2 rounded-2xl shadow-2xl border border-white/50 z-20">
                           <img src={selectedEvent.logo} className="w-full h-full object-contain" alt="Logo" />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-black/10"></div>
                      <div className="absolute bottom-12 right-8 text-white max-w-[85%] text-right z-30">
                           <span className="bg-rose-500/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-[11px] font-black mb-3 inline-block tracking-widest shadow-lg border border-white/20 uppercase">{selectedEvent.category}</span>
                           <h2 className="text-3xl md:text-4xl font-black leading-tight drop-shadow-2xl font-serif text-slate-900">{selectedEvent.title}</h2>
                      </div>
                  </div>
                  
                  <div className="px-8 py-2 bg-white relative z-10 text-right">
                      
                      <div className="flex gap-3 mb-8 -mt-6">
                          <div className="flex-1 bg-white p-4 rounded-3xl text-center shadow-xl border border-rose-50/50">
                              <p className="text-[10px] text-rose-300 font-black uppercase mb-1 tracking-widest">מתי</p>
                              <p className="font-black text-slate-800 text-xs md:text-sm">
                                {selectedEvent.hebrewDate || new Date(selectedEvent.date).toLocaleDateString('he-IL')}
                              </p>
                          </div>
                          <div className="flex-1 bg-white p-4 rounded-3xl text-center shadow-xl border border-rose-50/50">
                              <p className="text-[10px] text-rose-300 font-black uppercase mb-1 tracking-widest">שעה</p>
                              <p className="font-black text-slate-800 text-xs md:text-sm">{formatEventTime(selectedEvent)}</p>
                          </div>
                          <div className="flex-1 bg-white p-4 rounded-3xl text-center shadow-xl border border-rose-50/50">
                              <p className="text-[10px] text-rose-300 font-black uppercase mb-1 tracking-widest">מחיר</p>
                              <p className="font-black text-rose-500 text-xs md:text-sm">{getDisplayPrice(selectedEvent).value === 0 ? 'בחינם' : `₪${getDisplayPrice(selectedEvent).value}`}</p>
                          </div>
                      </div>

                      {selectedEvent.ticketLink && (
                        <a 
                          href={selectedEvent.ticketLink} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="w-full mb-6 bg-emerald-500 hover:bg-emerald-600 text-white py-5 rounded-[1.8rem] font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-emerald-100 transition-all active:scale-95 border-b-4 border-emerald-700"
                        >
                            <ExternalLink size={20} /> שרייני מקום עכשיו
                        </a>
                      )}

                      {selectedEvent.targetAges && (
                          <div className="mb-5 flex items-center gap-3 bg-purple-50/50 p-4 rounded-2xl border border-purple-100/50 text-purple-700">
                              <Users2 size={18} />
                              <span className="text-xs font-black">קהל יעד: {selectedEvent.targetAges}</span>
                          </div>
                      )}

                      {selectedEvent.notes && (
                          <div className="mb-8 p-5 bg-slate-50/80 rounded-3xl border border-slate-100 text-right">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <MessageSquare size={14}/> מידע חשוב שכדאי לדעת:
                              </h4>
                              <p className="text-xs md:text-sm text-slate-600 leading-relaxed font-bold">{selectedEvent.notes}</p>
                          </div>
                      )}

                      {selectedEvent.sessions && selectedEvent.sessions.length > 0 && (
                        <div className="mb-8 space-y-4">
                            <h4 className="font-black text-sm text-slate-800 flex items-center gap-2 pr-2">
                              <Sparkles size={18} className="text-rose-500" />
                              מפגשי הסדרה:
                            </h4>
                            <div className="grid grid-cols-1 gap-2">
                               {selectedEvent.sessions.map((session, idx) => (
                                 <div key={idx} className="flex justify-between items-center bg-rose-50/30 px-4 py-3 rounded-2xl text-[11px] border border-rose-100/50 font-bold text-slate-700">
                                    <span>{session.name}</span>
                                    <span className="text-rose-400">{new Date(session.date).toLocaleDateString('he-IL')}</span>
                                 </div>
                               ))}
                            </div>
                        </div>
                      )}

                      <div className="space-y-6 mb-8 pr-2">
                          <div className="flex items-start gap-4 justify-start">
                              <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 shrink-0 border border-rose-100 shadow-inner"><MapPin size={22} /></div>
                              <div className="text-right">
                                  <h4 className="font-black text-slate-800 text-sm">איפה זה קורה?</h4>
                                  <p className="text-slate-500 text-sm mt-1 font-medium">{selectedEvent.location}</p>
                              </div>
                          </div>
                      </div>

                      <div className="flex gap-4 mb-10">
                          <button onClick={handleShare} className="w-full py-5 rounded-[2rem] bg-slate-900 text-white font-black text-sm flex items-center justify-center gap-3 shadow-xl hover:bg-rose-600 transition-all active:scale-95">
                              <Share2 size={20} /> שתפי עם חברות
                          </button>
                      </div>

                      <div className="border-t border-rose-50 pt-8 text-right">
                          <h4 className="font-black text-slate-800 text-sm mb-5 flex items-center gap-2 justify-start font-serif">
                              <MessageSquare size={16} className="text-rose-300" />
                              שתפי אותנו בחוויה שלך
                          </h4>
                          {reviewSubmitted ? (
                              <div className="bg-emerald-50 text-emerald-600 p-5 rounded-3xl text-center text-sm font-black border border-emerald-100 flex items-center justify-center gap-3 animate-bounce-in">
                                  <CheckCircle2 size={20} /> תודה ששיתפת אותנו!
                              </div>
                          ) : (
                              <form onSubmit={handleSubmitReview} className="space-y-4">
                                  <div className="flex justify-center gap-3 bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                          <button key={star} type="button" onClick={() => setUserRating(star)} className="focus:outline-none transition-all hover:scale-125 active:scale-90 p-1">
                                              <Star size={28} className={`${star <= userRating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'} transition-colors`} />
                                          </button>
                                      ))}
                                  </div>
                                  <textarea 
                                    className="w-full bg-slate-50 border-none rounded-3xl px-6 py-4 text-sm focus:ring-4 focus:ring-rose-50 outline-none placeholder-slate-300 text-right font-bold h-24 resize-none" 
                                    placeholder="איך היה האירוע? נשמח לשמוע..."
                                    value={reviewText}
                                    onChange={e => setReviewText(e.target.value)}
                                  />
                                  <button type="submit" className={`w-full py-4 rounded-2xl font-black text-xs transition-all ${userRating > 0 ? 'bg-rose-500 text-white shadow-lg shadow-rose-100 hover:bg-rose-600' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}>
                                      {userRating > 0 ? 'שליחת משוב' : 'דרגי בבקשה כדי לשלוח'}
                                  </button>
                              </form>
                          )}
                      </div>
                  </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default EventsPage;