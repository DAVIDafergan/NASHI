import { placeLabel } from '../utils/share';
import React, { useState, useEffect } from 'react';
import { Search, MapPin, Calendar, Tag, Heart, X, Share2, Star, MessageSquare, Ticket, CheckCircle2, ArrowLeft, Clock, Sparkles, Filter, SortAsc, History, Users2, ExternalLink } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import EventCard from '../components/EventCard';
import ScrollReveal from '../components/ScrollReveal';
import { useArea, AreaChips } from '../components/pages/AreaFilter';
import { PageShell, PageHero, FilterBar, SearchField, Chip, ChipRow, EmptyState, PageLoading, Sheet, IconButton } from '../components/pages/PageKit';

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

  useEffect(() => {
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
  }, []);

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

  const { area, setArea, match: matchesArea, myRegion } = useArea();
  const filteredEvents = events.filter(event => {
    if (!matchesArea(event)) return false;
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

          // שני האירועים עברו: החדש ביותר (הכי קרוב להיום) קודם, הישן ביותר למטה
          if (isPastA && isPastB) {
              return new Date(b.date).getTime() - new Date(a.date).getTime();
          }
          // שני האירועים עתידיים: הקרוב ביותר קודם
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

  if (loading) return <PageLoading />;

  const upcomingCount = events.filter(e => new Date(e.date) >= new Date()).length;
  const hasActiveFilters = filter !== '' || selectedCategory !== 'all' || onlyFree;

  return (
    <PageShell>
      <PageHero
        eyebrow="לוח אירועים"
        title="רגעים שכדאי"
        accent="לא לפספס"
        subtitle={upcomingCount > 0
          ? <>ערבי נשים, סדנאות, הרצאות ומופעים. <span className="text-rose-700">{upcomingCount} אירועים קרובים</span> מחכים לך.</>
          : 'ערבי נשים, סדנאות, הרצאות ומופעים — הכול במקום אחד.'}
      />

      {/* --- Filter Bar --- */}
      <FilterBar>
        <AreaChips area={area} setArea={setArea} myRegion={myRegion} className="mb-3" />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchField value={filter} onChange={setFilter} placeholder="חפשי אירוע או מקום…" className="lg:w-80 shrink-0" />
          <ChipRow className="flex-1">
            {categories.map(cat => (
              <Chip key={cat} active={selectedCategory === cat} onClick={() => setSelectedCategory(cat)}>
                {cat === 'all' ? 'הכול' : cat}
              </Chip>
            ))}
          </ChipRow>
        </div>
        <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <Chip tone="sage" active={onlyFree} onClick={() => setOnlyFree(!onlyFree)} icon={<Ticket size={14} />}>חינם בלבד</Chip>
          <span className="mx-1 h-5 w-px shrink-0 bg-rose-100" />
          <label className="relative inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rose-100 bg-white/80 pr-3.5 pl-2 text-[13.5px] text-slate-600">
            <SortAsc size={14} className="text-rose-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="appearance-none bg-transparent py-2 pl-2 outline-none cursor-pointer"
              aria-label="מיון"
            >
              <option value="date">לפי תאריך</option>
              <option value="price-low">מחיר: מהנמוך</option>
              <option value="price-high">מחיר: מהגבוה</option>
            </select>
          </label>
          {hasActiveFilters && (
            <button onClick={() => { setFilter(''); setSelectedCategory('all'); setOnlyFree(false); }} className="mr-auto shrink-0 text-[13px] text-rose-700 underline underline-offset-4 decoration-rose-200 hover:decoration-rose-700">
              ניקוי
            </button>
          )}
        </div>
      </FilterBar>

      {/* --- Events Grid --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-7">
        {filteredEvents.map((event, i) => {
            const isPast = new Date(event.date) < new Date();

            return (
                <ScrollReveal key={event.id} delay={(i % 8) * 60} animation="scale-in">
                  <EventCard
                      title={event.title}
                      image={event.image}
                      dateLabel={event.hebrewDate || new Date(event.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}
                      time={formatEventTime(event)}
                      location={placeLabel(event as any)}
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
          <EmptyState
            icon={<Calendar size={28} />}
            title="לא מצאנו אירועים כאלה"
            text="נסי מילה אחרת או קטגוריה אחרת — ואולי האירוע הבא בדיוק בדרך."
            action={<button onClick={() => {setFilter(''); setSelectedCategory('all'); setOnlyFree(false);}} className="btn-ghost">ניקוי סינונים</button>}
          />
      )}

      {/* --- Detailed Event Modal --- */}
      <Sheet open={!!selectedEvent} onClose={() => setSelectedEvent(null)} label={selectedEvent?.title}>
        {selectedEvent && (() => {
          const isPast = new Date(selectedEvent.date) < new Date();
          const price = getDisplayPrice(selectedEvent);
          return (
            <div className="pb-8">
              <div className="relative m-2 overflow-hidden rounded-[1.6rem] aspect-[4/3] md:aspect-[16/10]">
                <img src={selectedEvent.image} alt="" className={`h-full w-full object-cover animate-kenburns ${isPast ? 'grayscale' : ''}`} />
                <div className="absolute inset-0 bg-gradient-to-t from-plum-950/80 via-plum-950/10 to-transparent" />
                <div className="absolute top-3 left-3 flex gap-2">
                  <IconButton label="סגירה" onClick={() => setSelectedEvent(null)}><X size={18} /></IconButton>
                </div>
                {selectedEvent.logo && (
                  <div className="absolute top-3 right-3 h-14 w-14 rounded-2xl bg-white/95 p-2 shadow-soft">
                    <img src={selectedEvent.logo} className="h-full w-full object-contain" alt="Logo" />
                  </div>
                )}
                <div className="absolute bottom-0 right-0 left-0 p-5 md:p-6 text-right">
                  <span className="inline-block rounded-full bg-white/90 px-3 py-1 text-[12px] text-rose-700">{selectedEvent.category}</span>
                  <h2 className="mt-2 text-[1.9rem] md:text-[2.3rem] leading-[1.1] !text-white">{selectedEvent.title}</h2>
                </div>
              </div>

              <div className="px-5 md:px-7 pt-4 text-right">
                <div className="grid grid-cols-3 gap-2.5 mb-6">
                  {[
                    { k: 'מתי', v: selectedEvent.hebrewDate || new Date(selectedEvent.date).toLocaleDateString('he-IL'), icon: <Calendar size={15} /> },
                    { k: 'שעה', v: formatEventTime(selectedEvent), icon: <Clock size={15} /> },
                    { k: 'מחיר', v: price.value === 0 ? 'בחינם' : `₪${price.value}`, icon: <Ticket size={15} />, hi: true },
                  ].map((c) => (
                    <div key={c.k} className="rounded-2xl border border-rose-100 bg-rose-50/40 p-3 text-center">
                      <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-rose-500 shadow-soft">{c.icon}</div>
                      <p className="text-[11px] text-slate-400">{c.k}</p>
                      <p className={`font-strong text-[13px] md:text-sm ${c.hi ? 'text-rose-700' : 'text-ink'}`}>{c.v}</p>
                    </div>
                  ))}
                </div>
                {price.isEarly && (
                  <p className="-mt-3 mb-5 flex items-center gap-1.5 text-[13px] text-sage-700"><Sparkles size={14} /> מחיר מוקדם בתוקף לזמן מוגבל</p>
                )}

                {selectedEvent.ticketLink && (
                  <a
                    href={selectedEvent.ticketLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary w-full !py-4 !text-base mb-5"
                  >
                    <ExternalLink size={18} /> שרייני מקום עכשיו
                  </a>
                )}

                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-3 rounded-2xl bg-white border border-rose-100 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500"><MapPin size={18} /></div>
                    <div>
                      <p className="text-[12px] text-slate-400">איפה זה קורה</p>
                      <p className="text-[15px] text-ink">{selectedEvent.location}</p>
                    </div>
                  </div>
                  {selectedEvent.targetAges && (
                    <div className="flex items-center gap-3 rounded-2xl border border-plum-100 bg-plum-50/60 p-4 text-plum-700">
                      <Users2 size={18} />
                      <span className="text-[14px]">קהל יעד: {selectedEvent.targetAges}</span>
                    </div>
                  )}
                  {selectedEvent.notes && (
                    <div className="rounded-2xl border border-champagne-100 bg-champagne-50/70 p-4">
                      <p className="mb-1.5 flex items-center gap-1.5 text-[12px] text-champagne-700"><MessageSquare size={14}/> מידע חשוב שכדאי לדעת</p>
                      <p className="text-[14px] leading-relaxed text-slate-600 whitespace-pre-line">{selectedEvent.notes}</p>
                    </div>
                  )}
                </div>

                {selectedEvent.sessions && selectedEvent.sessions.length > 0 && (
                  <div className="mb-6">
                    <h4 className="mb-3 flex items-center gap-2 text-[15px]"><Sparkles size={16} className="text-rose-500" /> מפגשי הסדרה</h4>
                    <ol className="relative space-y-2 border-r-2 border-rose-100 pr-4">
                      {selectedEvent.sessions.map((session, idx) => (
                        <li key={idx} className="relative flex items-center justify-between rounded-2xl bg-rose-50/40 px-4 py-3 text-[13.5px]">
                          <span className="absolute -right-[1.42rem] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-rose-400 ring-4 ring-white" />
                          <span className="text-ink">{session.name}</span>
                          <span className="text-rose-500">{new Date(session.date).toLocaleDateString('he-IL')}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <button onClick={handleShare} className="btn-ghost w-full !py-3.5 mb-8">
                  <Share2 size={18} /> שתפי עם חברות
                </button>

                <div className="border-t border-rose-100 pt-6">
                  <h4 className="mb-4 flex items-center gap-2 text-[15px]">
                    <MessageSquare size={16} className="text-rose-400" />
                    שתפי אותנו בחוויה שלך
                  </h4>
                  {reviewSubmitted ? (
                    <div className="flex items-center justify-center gap-2 rounded-2xl border border-sage-100 bg-sage-50 p-5 text-[15px] text-sage-700 animate-bounce-in">
                      <CheckCircle2 size={20} /> תודה ששיתפת אותנו!
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitReview} className="space-y-3">
                      <div className="flex justify-center gap-1.5 rounded-2xl bg-rose-50/40 p-3" role="radiogroup" aria-label="דירוג">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} type="button" aria-label={`${star} כוכבים`} onClick={() => setUserRating(star)} className="p-1 transition hover:scale-125 active:scale-90">
                            <Star size={28} className={`${star <= userRating ? 'fill-champagne-400 text-champagne-400' : 'text-rose-100'} transition-colors`} />
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="h-24 w-full resize-none rounded-2xl border border-rose-100 bg-white px-4 py-3 text-[15px] outline-none placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100/70"
                        placeholder="איך היה האירוע? נשמח לשמוע…"
                        value={reviewText}
                        onChange={e => setReviewText(e.target.value)}
                      />
                      <button type="submit" className={`w-full ${userRating > 0 ? 'btn-primary' : 'rounded-full bg-rose-50 py-3 text-sm text-rose-300 cursor-not-allowed'}`}>
                        {userRating > 0 ? 'שליחת משוב' : 'דרגי בכוכבים כדי לשלוח'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </Sheet>
    </PageShell>
  );
};

export default EventsPage;
