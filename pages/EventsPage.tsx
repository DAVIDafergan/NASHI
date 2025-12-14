import React, { useState, useEffect } from 'react';
import { Search, MapPin, Calendar, Tag, Heart, X, Share2, Star, MessageSquare, Ticket, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

// --- Types (Internal Definition to ensure safety) ---
interface EventItem {
  id: string;
  _id?: string;
  title: string;
  date: string;
  location: string;
  category: string;
  price: number;
  image: string;
  isHero?: boolean;
  ratings?: number[];
}

// --- API Helper ---
const API_URL = 'https://nashi-production.up.railway.app/api';

const EventsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // State
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filter, setFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  
  // Review State
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [userRating, setUserRating] = useState(0);

  // 1. טעינת נתונים מהשרת (התיקון למסך הלבן)
  useEffect(() => {
    fetch(`${API_URL}/events`)
      .then(res => res.json())
      .then(data => {
        // המרה של _id ל-id כדי שהממשק לא יקרוס
        const formattedEvents = data.map((item: any) => ({
            ...item,
            id: item._id || item.id,
            date: item.date || new Date().toISOString(), // הגנה מפני תאריך חסר
            image: item.image || 'https://via.placeholder.com/400x300', // תמונת ברירת מחדל
            ratings: item.ratings || []
        }));
        setEvents(formattedEvents);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching events:", err);
        setLoading(false);
      });
  }, []);

  // קבלת קטגוריה מדף הבית
  useEffect(() => {
    if (location.state && location.state.category) {
        setSelectedCategory(location.state.category);
    }
  }, [location.state]);

  // איפוס טופס ביקורת כשפותחים אירוע
  useEffect(() => {
      if (selectedEvent) {
          setUserRating(0);
          setReviewText('');
          setReviewSubmitted(false);
      }
  }, [selectedEvent]);

  // סינון אירועים
  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(filter.toLowerCase()) || event.location.toLowerCase().includes(filter.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || event.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', 'מוזיקה', 'העשרה', 'סדנאות', 'קהילה', 'בידור', 'אופנה'];

  // --- Actions ---

  const handleJoin = async (event: EventItem) => {
      const token = localStorage.getItem('token');
      if (!token) {
          alert('יש להתחבר כדי להירשם ולקבל נקודות!');
          return;
      }

      try {
          const res = await fetch(`${API_URL}/events/${event.id}/join`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success) {
              alert(`נרשמת בהצלחה ל"${event.title}"! \n🎉 ${data.message}`);
          } else {
              alert(data.error || 'שגיאה בהרשמה (אולי כבר נרשמת?)');
          }
      } catch (err) {
          alert('תקלה בתקשורת עם השרת');
      }
  };

  const handleShare = async () => {
      const token = localStorage.getItem('token');
      const url = window.location.href;
      
      // Share UI
      if (navigator.share) {
          try { await navigator.share({ title: 'Nashi Event', url }); } catch {}
      } else {
          navigator.clipboard.writeText(url);
          alert('הקישור הועתק!');
      }

      // Add points via API
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
      // כאן ניתן להוסיף קריאה לשרת לשמירת הביקורת בעתיד
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

  // --- Render ---

  if (loading) return (
      <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
      </div>
  );

  return (
    <div className="space-y-6 w-full pb-20 p-4 md:p-8">
      
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-4">
           <button onClick={() => navigate(-1)} className="bg-white p-2 rounded-full shadow-sm text-slate-600 hover:bg-slate-50"><ArrowLeft size={20}/></button>
           <h1 className="text-2xl font-black text-slate-800">לוח אירועים</h1>
      </div>

      {/* --- Filter Bar (Sticky & Glass) --- */}
      <div className="bg-white/80 backdrop-blur-xl p-2 md:p-3 rounded-2xl shadow-sm border border-white sticky top-16 md:top-20 z-40 flex flex-col md:flex-row gap-2 shadow-rose-100/10 transition-all">
        <div className="relative w-full md:w-64">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="חיפוש אירוע..." 
            className="w-full pr-9 pl-3 py-2.5 bg-white border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200 transition-all text-xs font-medium placeholder-slate-400 shadow-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 w-full overflow-x-auto pb-1 md:pb-0 scrollbar-hide no-scrollbar items-center">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-[11px] md:text-xs font-bold whitespace-nowrap transition-all border ${
                selectedCategory === cat 
                  ? 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-200' 
                  : 'bg-transparent text-slate-500 border-transparent hover:bg-white hover:text-rose-500 hover:shadow-sm'
              }`}
            >
              {cat === 'all' ? 'הכל' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* --- Events Grid --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {filteredEvents.map(event => {
            const avgRating = getAverageRating(event.ratings);
            
            return (
                <div 
                    key={event.id} 
                    onClick={() => setSelectedEvent(event)}
                    className="bg-white rounded-[1.8rem] md:rounded-[2rem] p-1.5 md:p-2 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] border border-white hover:shadow-xl hover:shadow-rose-100/50 transition-all duration-300 group cursor-pointer active:scale-[0.98] flex flex-row sm:flex-col h-28 sm:h-auto items-center sm:items-stretch"
                >
                    {/* Image Section */}
                    <div className="h-full w-28 sm:w-full sm:h-40 md:h-48 overflow-hidden relative rounded-[1.4rem] shrink-0 bg-slate-100">
                        <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        
                        {/* Desktop Only Overlays */}
                        <div className="hidden sm:flex absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-700 shadow-sm items-center gap-1">
                            <Tag size={10} className="text-rose-400" />
                            {event.category}
                        </div>
                    </div>
                    
                    {/* Content Section */}
                    <div className="px-3 sm:px-2 pb-1 sm:pb-2 pt-0 sm:pt-2 flex-1 min-w-0 flex flex-col justify-center sm:justify-start h-full sm:h-auto">
                        
                        <div className="flex justify-between items-start mb-1 sm:mb-2">
                            <h3 className="text-sm md:text-base font-black text-slate-800 leading-tight line-clamp-2 sm:line-clamp-2 ml-1 group-hover:text-rose-600 transition-colors">
                                {event.title}
                            </h3>
                            {Number(avgRating) > 0 && (
                                <div className="hidden sm:flex items-center gap-0.5 text-[10px] font-bold bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded-full border border-yellow-100 shrink-0">
                                    <Star size={8} fill="currentColor" /> {avgRating}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] md:text-xs text-slate-400 mb-1 sm:mb-3">
                            <div className="flex items-center gap-1">
                                <Calendar size={11} className="text-rose-300" />
                                <span>{new Date(event.date).toLocaleDateString('he-IL', {day: '2-digit', month: '2-digit'})}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <MapPin size={11} className="text-rose-300" />
                                <span className="truncate max-w-[80px] md:max-w-[100px]">{event.location}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50 sm:border-slate-50 border-transparent w-full">
                            <div className="font-black text-sm text-slate-700">
                                {event.price === 0 ? <span className="text-emerald-500">חינם</span> : `₪${event.price}`}
                            </div>
                            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2.5 py-1 rounded-full group-hover:bg-rose-100 transition-colors">
                                פרטים
                            </span>
                        </div>
                    </div>
                </div>
            );
        })}
      </div>
      
      {filteredEvents.length === 0 && (
         <div className="text-center py-16 bg-white/50 rounded-[2rem] border border-dashed border-slate-200">
           <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-3 text-rose-300">
               <Calendar size={20} />
           </div>
           <p className="text-slate-400 text-sm font-medium">לא נמצאו אירועים.</p>
           <button onClick={() => {setFilter(''); setSelectedCategory('all');}} className="mt-2 text-rose-500 text-xs font-bold">ניקוי סינון</button>
         </div>
      )}

      {/* --- Detailed Event Modal --- */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-slate-900/30 backdrop-blur-md animate-fade-in">
            <div className="bg-white w-full md:w-auto md:max-w-lg md:rounded-[2.5rem] rounded-t-[2.5rem] max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up md:animate-scale-in relative border border-white">
                <button onClick={() => setSelectedEvent(null)} className="absolute top-4 left-4 p-2 bg-white/80 backdrop-blur-md rounded-full hover:bg-rose-50 hover:text-rose-500 z-10 text-slate-800 transition-colors shadow-sm"><X size={18} /></button>
                
                <div className="pb-6">
                  <div className="h-64 w-full relative">
                      <img src={selectedEvent.image} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent"></div>
                      <div className="absolute bottom-10 right-6 text-white max-w-[80%]">
                           <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold mb-2 inline-block tracking-wide shadow-sm border border-white/20">{selectedEvent.category}</span>
                           <h2 className="text-3xl font-black leading-tight shadow-sm drop-shadow-md mb-2">{selectedEvent.title}</h2>
                      </div>
                  </div>
                  
                  <div className="px-6 py-6 bg-white rounded-t-[2.5rem] -mt-8 relative z-10">
                      
                      <div className="flex gap-3 mb-6">
                          <div className="flex-1 bg-slate-50 p-3 rounded-2xl text-center border border-slate-100 flex flex-col items-center justify-center">
                              <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">תאריך</p>
                              <p className="font-bold text-slate-700 text-sm">{new Date(selectedEvent.date).toLocaleDateString('he-IL')}</p>
                          </div>
                          <div className="flex-1 bg-slate-50 p-3 rounded-2xl text-center border border-slate-100 flex flex-col items-center justify-center">
                              <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">שעה</p>
                              <p className="font-bold text-slate-700 text-sm">{new Date(selectedEvent.date).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}</p>
                          </div>
                          <div className="flex-1 bg-slate-50 p-3 rounded-2xl text-center border border-slate-100 flex flex-col items-center justify-center">
                              <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">מחיר</p>
                              <p className="font-bold text-rose-500 text-sm">{selectedEvent.price === 0 ? 'חינם' : `₪${selectedEvent.price}`}</p>
                          </div>
                      </div>

                      <div className="space-y-4 mb-8">
                          <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 shrink-0 border border-rose-100"><MapPin size={18} /></div>
                              <div>
                                  <h4 className="font-bold text-slate-800 text-sm">מיקום האירוע</h4>
                                  <p className="text-slate-500 text-sm mt-0.5">{selectedEvent.location}</p>
                              </div>
                          </div>
                      </div>

                      <div className="flex gap-3 mb-6">
                          <button onClick={() => handleJoin(selectedEvent)} className="flex-[2] bg-gradient-to-r from-slate-900 to-slate-800 text-white py-4 rounded-2xl font-bold text-sm shadow-xl hover:shadow-2xl transition-all flex justify-center items-center gap-2 active:scale-95">
                              <Ticket size={18} /> הרשמה לאירוע
                          </button>
                          
                          <div className="flex flex-col items-center justify-center gap-1">
                                <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-1.5 rounded-md border border-rose-100 animate-pulse whitespace-nowrap">+10 נק'</span>
                                <button onClick={handleShare} className="w-12 h-12 flex items-center justify-center rounded-2xl border-2 border-rose-100 text-rose-400 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition-colors active:scale-95 bg-white">
                                    <Share2 size={20} />
                                </button>
                          </div>
                      </div>

                      <div className="border-t border-slate-50 pt-5">
                          <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-1.5">
                              <MessageSquare size={14} className="text-slate-300" />
                              דירוג
                          </h4>
                          {reviewSubmitted ? (
                              <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl text-center text-xs font-bold border border-emerald-100 flex items-center justify-center gap-2">
                                  <CheckCircle2 size={16} /> תודה על המשוב!
                              </div>
                          ) : (
                              <form onSubmit={handleSubmitReview} className="space-y-3">
                                  <div className="flex justify-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button key={star} type="button" onClick={() => setUserRating(star)} className="focus:outline-none transition-transform active:scale-90 p-1">
                                            <Star size={24} className={`${star <= userRating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'} transition-colors`} />
                                        </button>
                                    ))}
                                  </div>
                                  <input 
                                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-rose-200 outline-none placeholder-slate-400" 
                                    placeholder="איך היה? כתבי תגובה..."
                                    value={reviewText}
                                    onChange={e => setReviewText(e.target.value)}
                                  />
                                  <button type="submit" className="w-full text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 py-3 rounded-xl transition-all">
                                      {userRating > 0 ? 'שליחה' : 'דרגי כדי לשלוח'}
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