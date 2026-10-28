import AdSlot from '../components/AdSlot';
import { placeLabel, shareEvent, copyEventLink } from '../utils/share';
import React, { useState, useEffect } from 'react';
import { Link2, MessageCircle, Search, MapPin, Calendar, Tag, Heart, X, Share2, Star, MessageSquare, Ticket, CheckCircle2, ArrowLeft, Clock, Sparkles, Filter, SortAsc, History, Users2, ExternalLink } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import EventCard from '../components/EventCard';
import ScrollReveal from '../components/ScrollReveal';
import { useRegionCity, RegionCityPicker } from '../components/pages/RegionCityFilter';
import FlyerView, { FlyerZoom } from '../components/FlyerView';
import { regionName } from '../shared/regions';
import { isEventPast, isEventExpired, eventStartMs } from '../shared/eventTime';
import { PageShell, PageHero, FilterBar, SearchField, Chip, ChipRow, EmptyState, PageLoading, Sheet, IconButton } from '../components/pages/PageKit';
import { useAudienceFilter, AudienceChips, audienceCounts } from '../components/AudienceFilter';
import AudienceBadge from '../components/AudienceBadge';

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
  price: number; // null at runtime = unknown (imported without a price)
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
  // imported automatically by the events agent
  source?: string;
  sourceName?: string;
  sourceUrl?: string;
  soldOut?: boolean;
  salesClosed?: boolean;
  description?: string;
  city?: string;
  region?: string;
  scope?: string;
  startAt?: string;
  audience?: any;
}

// past = after its end (end time, or start + 3h, or the end of its day) — shown with "עבר" for 48h, then gone (shared/eventTime.js)
const startOf = (e: any) => { const t = eventStartMs(e); return Number.isFinite(t) ? t : new Date(e.date).getTime(); };
const isPastEvent = (e: any) => isEventPast(e);

/** "היום / השבוע / בחודש הקרוב / בהמשך" by Israel calendar day. */
const dayKey = (t: number) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
function whenGroup(e: { startAt?: string; date: string }) {
  const today = dayKey(Date.now());
  const d = e.startAt ? dayKey(startOf(e)) : String(e.date).slice(0, 10);
  const days = Math.round((Date.parse(d) - Date.parse(today)) / 864e5);
  if (days === -1) return 'אתמול';
  if (days < -1) return 'לפני יומיים';
  if (days === 0) return 'היום';
  if (days === 1) return 'מחר';
  if (days <= 7) return 'השבוע';
  if (days <= 31) return 'בחודש הקרוב';
  return 'בהמשך';
}
const GROUPS = ['היום', 'מחר', 'השבוע', 'בחודש הקרוב', 'בהמשך', 'אתמול', 'לפני יומיים'];

const API_URL = (import.meta as any).env?.VITE_API_URL || '/api';

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
        const formattedEvents = data.filter((item: any) => !isEventExpired(item)).map((item: any) => ({
            ...item,
            id: item._id || item.id,
            date: item.date || new Date().toISOString(),
            image: item.image || '/placeholder.svg',
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

  // deep link from a shared message: /#/events?e=<id> opens that event (or says it already ended)
  const [ended, setEnded] = useState<{ title: string; region?: string; city?: string } | null>(null);
  const deepId = new URLSearchParams(location.search).get('e');
  useEffect(() => {
    if (!deepId || loading) return;
    const inList = events.find(e => e.id === deepId);
    if (inList) { setSelectedEvent(inList); return; }
    fetch(`${API_URL}/events/${deepId}`).then(async r => {
      const j = await r.json().catch(() => ({}));
      if (r.ok) setSelectedEvent({ ...j, id: j._id || j.id, ratings: j.ratings || [] });
      else setEnded({ title: j.title || '', region: j.region, city: j.city });
    }).catch(() => setEnded({ title: '' }));
  }, [deepId, loading]); // eslint-disable-line react-hooks/exhaustive-deps
  const closeDeep = () => { if (deepId) navigate('/events', { replace: true }); };

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

  // who it's for: הכול · לגברים · לנשים · משפחות/לכולם (remembered); the region counts follow the chosen audience
  const aud = useAudienceFilter();
  const forAudience = events.filter(aud.match);
  const area = useRegionCity(forAudience, (e: EventItem) => !isPastEvent(e));
  const filteredEvents = forAudience.filter(event => {
    if (!area.place(event as any)) return false;
    const q = filter.trim().toLowerCase();
    const matchesSearch = !q || [event.title, event.location, event.city].some(f => (f || '').toLowerCase().includes(q));
    const matchesCategory = selectedCategory === 'all' || event.category === selectedCategory;
    const matchesFree = onlyFree ? getDisplayPrice(event).value === 0 : true;
    return matchesSearch && matchesCategory && matchesFree;
  }).sort((a, b) => {
      if (sortBy === 'date') {
          // past events always at the bottom: newest first; upcoming: soonest first
          const pa = isPastEvent(a), pb = isPastEvent(b);
          if (pa !== pb) return pa ? 1 : -1;
          return pa ? startOf(b) - startOf(a) : startOf(a) - startOf(b);
      }
      if (sortBy === 'price-low') return (getDisplayPrice(a).value ?? 1e9) - (getDisplayPrice(b).value ?? 1e9);
      if (sortBy === 'price-high') return (getDisplayPrice(b).value ?? -1) - (getDisplayPrice(a).value ?? -1);
      return 0;
  });
  const [zoom, setZoom] = useState('');
  const [moreText, setMoreText] = useState(false);
  useEffect(() => { setMoreText(false); }, [selectedEvent]);
  // events that ended in the last 48h stay in their date group with an "עבר" badge (the server drops them after that)
  const here = filteredEvents.filter(e => area.place(e as any) === 'here');
  const upcomingHere = here.filter(e => !isPastEvent(e));
  const upcomingEverywhere = filteredEvents.filter(e => area.place(e as any) === 'everywhere');
  const areaTitle = area.sel.region === 'all' ? 'בכל הארץ' : area.sel.region === 'online' ? 'במקוון' : area.sel.city ? `ב${area.sel.city}` : `ב${regionName(area.sel.region)}`;

  const categories = ['all', 'מוזיקה', 'העשרה', 'סדנאות', 'קהילה', 'בידור', 'תורה ויהדות', 'אופנה'];

  const [copied, setCopied] = useState(false);
  const handleShare = async (ev: EventItem | null = selectedEvent) => {
      if (!ev) return;
      const token = localStorage.getItem('token');
      // WhatsApp with a preview card: the link is /s/event/<id> (server/share.js)
      await shareEvent(ev);
      if (token && ev === selectedEvent) {
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

  const upcomingCount = forAudience.filter(e => !isPastEvent(e)).length;
  const hasActiveFilters = filter !== '' || selectedCategory !== 'all' || onlyFree;
  const audCounts = audienceCounts(events.filter(e => !isPastEvent(e)));

  return (
    <PageShell>
      <PageHero
        eyebrow="לוח אירועים"
        title="רגעים שכדאי"
        accent="לא לפספס"
        subtitle={upcomingCount > 0
          ? <>כנסים, שיעורים, הרצאות, מופעים וסדנאות. <span className="text-rose-700">{upcomingCount} אירועים קרובים</span> מחכים לכם.</>
          : 'כנסים, שיעורים, הרצאות, מופעים וסדנאות — הכול במקום אחד.'}
      />

      {/* --- For whom, then where: regions with counts, then the cities that have events --- */}
      <AudienceChips value={aud.audience} onChange={aud.setAudience} counts={audCounts} className="mb-3" />
      <RegionCityPicker f={area} className="mb-5" />

      {/* --- Filter Bar --- */}
      <FilterBar>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchField value={filter} onChange={setFilter} placeholder="חיפוש אירוע או מקום…" className="lg:w-80 shrink-0" />
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

      <AdSlot placement="events" className="!px-0 mb-6" />

      {/* --- Events, grouped by when (date order) --- */}
      {(() => {
        const card = (event: EventItem, i: number) => {
          const isPast = isPastEvent(event);
          return (
            <ScrollReveal key={event.id} delay={(i % 8) * 60} animation="scale-in">
              <EventCard
                  title={event.title}
                  image={event.image}
                  dateLabel={event.hebrewDate || new Date(event.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}
                  time={formatEventTime(event)}
                  location={placeLabel(event as any)}
                  city={event.scope === 'online' ? 'מקוון' : event.scope === 'national' ? '' : event.city}
                  category={event.category}
                  statusLabel={!isPast && event.soldOut ? 'אזלו הכרטיסים' : !isPast && event.salesClosed ? 'המכירה נסגרה' : undefined}
                  isPast={isPast}
                  ctaLabel={isPast ? 'לסיכום' : 'לפרטים והרשמה'}
                  onClick={() => setSelectedEvent(event)}
                  onShare={() => handleShare(event)}
                  audience={event.audience}
              />
            </ScrollReveal>
          );
        };
        const grid = (list: EventItem[]) => <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-7">{list.map(card)}</div>;
        const heading = (title: string, n: number, sub?: string) => (
          <div className="mb-4 mt-2 flex items-baseline gap-2 border-b border-rose-100 pb-2">
            <h2 className="text-[1.5rem] md:text-[1.8rem]">{title}</h2>
            <span className="text-[13px] text-slate-400 tabular-nums">{n}</span>
            {sub && <span className="mr-auto text-[12.5px] text-slate-400">{sub}</span>}
          </div>
        );
        const anyFilter = filter !== '' || selectedCategory !== 'all' || onlyFree;
        return (
          <div className="space-y-10">
            {upcomingHere.length === 0 && (
              <EmptyState
                icon={<MapPin size={28} />}
                title={anyFilter ? 'לא מצאנו אירועים כאלה' : `עוד אין אירועים קרובים ${areaTitle}`}
                text={anyFilter ? 'אפשר לנסות מילה אחרת או קטגוריה אחרת.' : 'אפשר להציץ במה שקורה בכל הארץ — ומנהלי התרבות באזור יכולים להעלות אירועים בקלות.'}
                action={<div className="flex flex-wrap justify-center gap-2">
                  {anyFilter && <button onClick={() => { setFilter(''); setSelectedCategory('all'); setOnlyFree(false); }} className="btn-ghost">ניקוי סינונים</button>}
                  {area.sel.region !== 'all' && <button onClick={() => area.setRegion('all')} className="btn-primary">לאירועים בכל הארץ</button>}
                  {aud.audience !== 'any' && <button onClick={() => aud.setAudience('any')} className="btn-ghost">לכל הקהלים</button>}
                  {!anyFilter && area.sel.region !== 'all' && <a href="#/become-manager" className="btn-ghost">ניהול תרבות באזור</a>}
                </div>}
              />
            )}
            {here.length > 0 && (sortBy === 'date' ? (
              GROUPS.map(g => {
                const list = here.filter(e => whenGroup(e) === g);
                const upcomingN = list.filter(e => !isPastEvent(e)).length;
                return list.length ? <section key={g}>{heading(g, upcomingN || list.length, g === 'היום' ? areaTitle : g === 'אתמול' || g === 'לפני יומיים' ? 'עבר · יוסר בתוך 48 שעות' : undefined)}{grid(list)}</section> : null;
              })
            ) : grid(here))}

            {upcomingEverywhere.length > 0 && (
              <section>{heading('ארצי ומקוון', upcomingEverywhere.length, 'מכל מקום בארץ')}{grid(upcomingEverywhere)}</section>
            )}

          </div>
        );
      })()}

      {/* --- Detailed Event Modal --- */}
      {/* a shared event that already ended */}
      <Sheet open={!!ended} onClose={() => { setEnded(null); closeDeep(); }} label="האירוע הסתיים">
        {ended && (
          <div className="px-6 pb-8 pt-6 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500"><History size={26} /></span>
            <h2 className="mt-4 text-[1.7rem] leading-tight">האירוע הסתיים</h2>
            {ended.title && <p className="mt-1 text-[15px] text-slate-500">{ended.title}</p>}
            <p className="mt-3 text-[15px] text-slate-600">אבל יש עוד הרבה מה לראות{ended.region ? ` ב${regionName(ended.region)}` : ''}</p>
            <button onClick={() => { if (ended.region) area.setRegion(ended.region); setEnded(null); closeDeep(); }} className="btn-primary mt-5 w-full !py-3.5">
              לאירועים הקרובים{ended.region ? ` ב${regionName(ended.region)}` : ''}
            </button>
          </div>
        )}
      </Sheet>

      <Sheet open={!!selectedEvent} onClose={() => { setSelectedEvent(null); closeDeep(); }} label={selectedEvent?.title}>
        {selectedEvent && (() => {
          const isPast = isPastEvent(selectedEvent);
          const price = getDisplayPrice(selectedEvent);
          return (
            <div className="pb-8">
              <div className="relative m-2">
                <FlyerView src={selectedEvent.image} alt={selectedEvent.title} grayscale={isPast} onZoom={() => setZoom(selectedEvent.image)} />
                <div className="absolute top-3 left-3 flex gap-2">
                  <IconButton label="סגירה" onClick={() => setSelectedEvent(null)}><X size={18} /></IconButton>
                </div>
                {selectedEvent.logo && (
                  <div className="absolute top-3 right-3 h-14 w-14 rounded-2xl bg-white/95 p-2 shadow-soft">
                    <img src={selectedEvent.logo} className="h-full w-full object-contain" alt="Logo" />
                  </div>
                )}
              </div>
              <div className="px-5 md:px-7 pt-3 text-right">
                <div className="flex flex-wrap items-center gap-1.5">
                  <AudienceBadge item={selectedEvent} />
                  {selectedEvent.category && <span className="inline-block rounded-full bg-rose-50 px-3 py-1 text-[12px] text-rose-700">{selectedEvent.category}</span>}
                  {selectedEvent.scope !== 'online' && selectedEvent.city && <span className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-[12px] text-white"><MapPin size={12} /> {selectedEvent.city}</span>}
                </div>
                <h2 className="mt-2 text-[1.8rem] md:text-[2.2rem] leading-[1.12]">{selectedEvent.title}</h2>
              </div>

              <div className="px-5 md:px-7 pt-4 text-right">
                <div className="grid grid-cols-3 gap-2.5 mb-6">
                  {[
                    { k: 'מתי', v: selectedEvent.hebrewDate || new Date(selectedEvent.date).toLocaleDateString('he-IL'), icon: <Calendar size={15} /> },
                    { k: 'שעה', v: formatEventTime(selectedEvent), icon: <Clock size={15} /> },
                    { k: 'מחיר', v: price.value == null ? 'בקישור לרכישה' : price.value === 0 ? 'בחינם' : `₪${price.value}`, icon: <Ticket size={15} />, hi: true },
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

                {selectedEvent.ticketLink && (selectedEvent.source && (selectedEvent.soldOut || selectedEvent.salesClosed) ? (
                  <div className="mb-5 flex items-center justify-center gap-2 rounded-full bg-slate-100 py-4 text-base text-slate-500">
                    <Ticket size={18} /> {selectedEvent.soldOut ? 'אזלו הכרטיסים' : 'המכירה נסגרה'}
                  </div>
                ) : (
                  <a
                    href={selectedEvent.ticketLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary w-full !py-4 !text-base mb-5"
                  >
                    <ExternalLink size={18} /> {selectedEvent.source ? 'לרכישת כרטיסים' : 'לשריון מקום'}
                  </a>
                ))}
                {selectedEvent.source && (
                  <p className="-mt-3 mb-5 text-center text-[12.5px] text-slate-400">
                    יובא אוטומטית מ<a href={selectedEvent.sourceUrl || selectedEvent.ticketLink} target="_blank" rel="noopener noreferrer" className="text-rose-700 underline underline-offset-2">{selectedEvent.sourceName || 'אתר המכירה'}</a> · הרכישה והפרטים המחייבים באתר המכירה
                  </p>
                )}

                {selectedEvent.description && selectedEvent.description.trim() && (() => {
                  const text = selectedEvent.description.trim();
                  const long = text.length > 420;
                  return (
                    <div className="mb-6">
                      <h4 className="mb-2 text-[15px]">על האירוע</h4>
                      <p className={`whitespace-pre-line text-[15px] leading-relaxed text-slate-600 ${long && !moreText ? 'line-clamp-[8]' : ''}`}>{text}</p>
                      {long && <button onClick={() => setMoreText(m => !m)} className="mt-1 text-[13.5px] text-rose-700 underline underline-offset-4">{moreText ? 'פחות' : 'לקריאה המלאה'}</button>}
                    </div>
                  );
                })()}

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

                <div className="mb-8 flex gap-2">
                  <button onClick={() => handleShare()} className="btn-primary flex-1 !py-3.5 !bg-[#1F7A55] hover:!bg-[#17603F]">
                    <MessageCircle size={18} /> שיתוף בוואטסאפ
                  </button>
                  <button onClick={async () => { await copyEventLink(selectedEvent); setCopied(true); setTimeout(() => setCopied(false), 1800); }} className="btn-ghost shrink-0 !px-4 !py-3.5" aria-label="העתקת קישור">
                    {copied ? <CheckCircle2 size={18} /> : <Link2 size={18} />} <span className="hidden sm:inline">{copied ? 'הועתק' : 'העתקת קישור'}</span>
                  </button>
                </div>

                <div className="border-t border-rose-100 pt-6">
                  <h4 className="mb-4 flex items-center gap-2 text-[15px]">
                    <MessageSquare size={16} className="text-rose-400" />
                    איך היה? נשמח לשמוע
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
                        placeholder="איך היה האירוע? כמה מילים…"
                        value={reviewText}
                        onChange={e => setReviewText(e.target.value)}
                      />
                      <button type="submit" className={`w-full ${userRating > 0 ? 'btn-primary' : 'rounded-full bg-rose-50 py-3 text-sm text-rose-300 cursor-not-allowed'}`}>
                        {userRating > 0 ? 'שליחת משוב' : 'דירוג בכוכבים כדי לשלוח'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </Sheet>
      <FlyerZoom src={zoom} onClose={() => setZoom('')} />
    </PageShell>
  );
};

export default EventsPage;
