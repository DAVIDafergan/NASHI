import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bell, Star, Music, Palette, Activity, Briefcase, Mic, Clock, Sparkles,
  X, Send, MapPin, Phone, HeartHandshake, Quote, GraduationCap, ChevronLeft, ChevronRight, ExternalLink,
  Megaphone, Calendar, BookOpen, ArrowLeft, Plus, Image as ImageIcon, Camera, Type as TypeIcon, Trash2, Share2,
  Trophy
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import FlyerCarousel from '../components/FlyerCarousel';
import { AnimatedHeadline, Marquee, SectionHeader, TiltCard } from '../components/home/HomeParts';
import ScrollReveal from '../components/ScrollReveal';
import EventCard from '../components/EventCard';

// --- Interfaces ---
interface EventItem {
  id: string; _id?: string; title: string; date: string; location: string; category: string; image: string; isHero?: boolean; speaker?: string;
}
interface LotteryItem {
  id: string; _id?: string; title: string; prize: string; drawDate: string; isActive: boolean;
}
interface AdItem {
  _id: string; type: 'image' | 'video'; content: string; link: string; title: string;
}

// ממשק חכם לסטוריז (כולל כיתוב)
interface StoryItem {
  id?: string; _id?: string;
  user: { _id?: string; id?: string; name: string; avatar: string };
  type: 'text' | 'image';
  content: string;
  caption?: string; 
  createdAt?: string;
}

// ממשק חדש לקבוצת סטוריז (אוגד את הסטוריז של אותה משתמשת)
interface UserStoryGroup {
  userId: string;
  user: { _id?: string; id?: string; name: string; avatar: string };
  stories: StoryItem[];
}

const categories = [
  { name: 'מוזיקה', icon: <Music size={12} /> },
  { name: 'אמנות', icon: <Palette size={12} /> },
  { name: 'סדנאות', icon: <Activity size={12} /> },
  { name: 'קריירה', icon: <Briefcase size={12} /> },
  { name: 'העשרה', icon: <Mic size={12} /> },
  { name: 'קהילה', icon: <HeartHandshake size={12} /> },
];

const API_URL = 'https://nashi-production.up.railway.app/api';

// פיצ'רי הפלטפורמה המוצגים בסקשן "מה זה נשי?" — קומפקטי: 4 אייקונים עיקריים, אייקון וטקסט, צבע מתחלף
const platformFeatures = [
  { icon: Calendar, label: 'אירועים', color: 'green' as const },
  { icon: GraduationCap, label: 'חוגים', color: 'coral' as const },
  { icon: Camera, label: 'סטוריז', color: 'coral' as const },
  { icon: Trophy, label: 'הגרלות', color: 'green' as const },
];

// --- פונקציית עזר חכמה לזיהוי לינקים והצגתם נכון ---
const renderTextWithLinks = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  return text.split(urlRegex).map((part, i) => {
    if (part.match(urlRegex)) {
      const href = part.startsWith('http') ? part : `https://${part}`;
      return (
        <a 
          key={i} 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-white font-black underline decoration-1 decoration-rose-300 hover:text-rose-100 hover:decoration-rose-100 transition-colors pointer-events-auto relative z-[70] drop-shadow-md mx-1 inline-block break-all"
          onClick={(e) => e.stopPropagation()} 
          dir="ltr"
        >
          {part}
        </a>
      );
    }
    return <span key={i} className="pointer-events-none relative z-[60]">{part}</span>;
  });
};

// --- קומפוננטה עזר: מציירת את הפסים הצבעוניים סביב האוואטר לפי מספר הסטוריז ---
const StoryRing = ({ count }: { count: number }) => {
  if (count <= 1) {
    return <div className="absolute inset-0 rounded-full border-[2.5px] border-[#D2959A] shadow-[0_0_8px_rgba(232,165,178,0.4)]"></div>;
  }
  const radius = 32.5;
  const circumference = 2 * Math.PI * radius;
  const gap = 8; 
  const dashLength = (circumference / count) - gap;
  
  return (
    <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none drop-shadow-[0_0_4px_rgba(232,165,178,0.5)]" viewBox="0 0 69 69">
      <circle 
         cx="34.5" cy="34.5" r={radius} 
         fill="none" stroke="url(#story-gradient)" strokeWidth="2.5"
         strokeDasharray={`${dashLength} ${gap}`} 
         strokeLinecap="round"
      />
      <defs>
        <linearGradient id="story-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A5636B" />
          <stop offset="100%" stopColor="#D2959A" />
        </linearGradient>
      </defs>
    </svg>
  );
};

const HomePage = ({ user, onOpenLogin, onUpdateUser }: { user: any, onOpenLogin: () => void, onUpdateUser?: (u: any) => void }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const mobileSliderRef = useRef<HTMLDivElement>(null);
   
  const [events, setEvents] = useState<EventItem[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [lotteries, setLotteries] = useState<LotteryItem[]>([]);
  const [personality, setPersonality] = useState<any>(null);
  const [communityItems, setCommunityItems] = useState<any[]>([]);
  const [ads, setAds] = useState<AdItem[]>([]);
  const [inspirations, setInspirations] = useState<any[]>([]); 
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentAdIndex, setCurrentAdIndex] = useState(0); 
  const [upcomingLottery, setUpcomingLottery] = useState<LotteryItem | null>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [membershipForm, setMembershipForm] = useState({ age: '', occupation: '', address: '', phone: user?.phone || '' });
  const [isLoading, setIsLoading] = useState(true);

  // === מצבים למערכת הסטוריז המקובצים ===
  const [groupedStories, setGroupedStories] = useState<UserStoryGroup[]>([]);
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);
  const [activeInnerIndex, setActiveInnerIndex] = useState<number>(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const [showAddStoryModal, setShowAddStoryModal] = useState(false);
  const [newStory, setNewStory] = useState<{ type: 'text' | 'image', content: string, caption?: string }>({ type: 'text', content: '', caption: '' });
  const [isUploadingStory, setIsUploadingStory] = useState(false);

  // לוגיקת טעינת נתונים
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setIsLoading(true);
        const [evRes, lotRes, adsRes, persDataRaw, commData, inspData, annData, classRes, storiesRes] = await Promise.all([
          fetch(`${API_URL}/events`).then(res => res.json()).catch(() => []),
          fetch(`${API_URL}/lotteries`).then(res => res.json()).catch(() => []),
          fetch(`${API_URL}/ads`).then(res => res.json()).catch(() => []),
          api.getPersonality().catch(() => null),
          api.getCommunityItems().catch(() => []),
          api.getInspirations().catch(() => []),
          api.getAnnouncements().catch(() => []),
          api.getClasses().catch(() => []),
          api.getStories().catch(() => []) 
        ]);

        setEvents(Array.isArray(evRes) ? evRes.map((e: any) => ({...e, id: e._id || e.id})) : []);
        setLotteries(Array.isArray(lotRes) ? lotRes.map((l: any) => ({...l, id: l._id || l.id})) : []);
        setAds(Array.isArray(adsRes) ? adsRes : []);
        
        const nowTime = new Date().getTime();
        const validStories = Array.isArray(storiesRes) ? storiesRes.filter((story: any) => {
          const timeField = story.approvedAt || story.createdAt;
          if (!timeField) return true; 
          const storyTime = new Date(timeField).getTime();
          return (nowTime - storyTime) < (24 * 60 * 60 * 1000); 
        }) : [];

        const grouped = validStories.reduce((acc: UserStoryGroup[], story: any) => {
            const uid = story.user?._id || story.user?.id;
            let group = acc.find(g => g.userId === uid);
            if (!group) {
                group = { userId: uid, user: story.user, stories: [] };
                acc.push(group);
            }
            group.stories.push(story);
            return acc;
        }, []);
        setGroupedStories(grouped);
        
        const persData = Array.isArray(persDataRaw) ? persDataRaw[0] : persDataRaw;
        setPersonality(persData);
        
        setCommunityItems(Array.isArray(commData) ? commData : []);
        
        const now = new Date();
        const validInspirations = (Array.isArray(inspData) ? inspData : [])
          .filter((insp: any) => !insp.scheduledAt || new Date(insp.scheduledAt) <= now)
          .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        
        setInspirations(validInspirations);
        setAnnouncements(Array.isArray(annData) ? annData : []); 
        setClasses(Array.isArray(classRes) ? classRes : []);
      } catch (err) {
        console.error("Error loading home data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadAllData();
  }, []);

  // 1. פתיחה אוטומטית של סטורי אם הגענו מלינק משותף
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const storyId = params.get('storyId');
    
    if (storyId && groupedStories.length > 0) {
      for (let gIndex = 0; gIndex < groupedStories.length; gIndex++) {
        const sIndex = groupedStories[gIndex].stories.findIndex(s => s._id === storyId || s.id === storyId);
        if (sIndex !== -1) {
          setActiveGroupIndex(gIndex);
          setActiveInnerIndex(sIndex);
          setStoryProgress(0);
          break;
        }
      }
    }
  }, [location.search, groupedStories]);

  // 2. ספירת צפיות ברגע שהסטורי מוצג
  useEffect(() => {
    const currentStory = activeGroupIndex !== null ? groupedStories[activeGroupIndex]?.stories[activeInnerIndex] : null;
    if (currentStory && user) {
       api.viewStory(currentStory._id || currentStory.id!).catch(console.error);
    }
  }, [activeGroupIndex, activeInnerIndex, user]);

  // "אירועים קרובים" — מציג רק אירועים שטרם עברו, ממוינים מהקרוב ביותר. אירוע שעבר התאריך שלו לא יופיע כאן יותר,
  // גם אם המשמעות היא רשימה ריקה (הסקשן כולו מוסתר במקרה הזה)
  // ממוין ב-useMemo (לא בכל רינדור) כדי שלא יאפס את אינטרוול הגלילה האוטומטית של הסליידר בכל עדכון state אחר בעמוד
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return [...events]
      .filter(e => new Date(e.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  // סליידר אירועים אוטומטי בנייד
  useEffect(() => {
    const slider = mobileSliderRef.current;
    if (!slider || upcomingEvents.length === 0) return;

    const interval = setInterval(() => {
      const cardWidth = slider.offsetWidth;
      const maxScroll = slider.scrollWidth - slider.offsetWidth;

      if (Math.abs(slider.scrollLeft) >= maxScroll - 10) {
        slider.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        slider.scrollBy({ left: -cardWidth, behavior: 'smooth' });
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [upcomingEvents]);

  useEffect(() => {
    if (ads && ads.length > 1 && ads[currentAdIndex]?.type === 'image') {
      const adTimer = setInterval(() => {
        setCurrentAdIndex((prev) => (prev + 1) % ads.length);
      }, 3000);
      return () => clearInterval(adTimer);
    }
  }, [ads, currentAdIndex]);

  // === טיימר חכם למערכת הסטוריז המקובצים ===
  useEffect(() => {
    if (activeGroupIndex === null) return;
    const duration = 7000;
    const intervalTime = 70; 
    const step = 100 / (duration / intervalTime);

    const timer = setInterval(() => {
      setStoryProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          handleNextStory();
          return 0;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [activeGroupIndex, activeInnerIndex]);

  const handleNextStory = () => {
    setStoryProgress(0);
    const group = groupedStories[activeGroupIndex!];
    if (activeInnerIndex < group.stories.length - 1) {
        setActiveInnerIndex(prev => prev + 1); 
    } else {
        if (activeGroupIndex! < groupedStories.length - 1) {
            setActiveGroupIndex(prev => prev! + 1); 
            setActiveInnerIndex(0);
        } else {
            setActiveGroupIndex(null); 
        }
    }
  };

  const handlePrevStory = () => {
    setStoryProgress(0);
    if (activeInnerIndex > 0) {
        setActiveInnerIndex(prev => prev - 1); 
    } else {
        if (activeGroupIndex! > 0) {
            setActiveGroupIndex(prev => prev! - 1); 
            setActiveInnerIndex(groupedStories[activeGroupIndex! - 1].stories.length - 1);
        } else {
            setActiveInnerIndex(0); 
        }
    }
  };

  const submitNewStory = async () => {
    if (!newStory.content.trim()) return;
    setIsUploadingStory(true);
    try {
        await api.uploadStory(newStory);
        alert('הסטורי נשלח בהצלחה וממתין לאישור מנהלת!');
        setShowAddStoryModal(false);
        setNewStory({ type: 'text', content: '', caption: '' });
    } catch (err: any) {
        alert(err.message || 'אירעה שגיאה בהעלאת הסטורי');
    } finally {
        setIsUploadingStory(false);
    }
  };

  const handleDeleteMyStory = async (storyId: string) => {
    if (!window.confirm('למחוק את הסטורי שלך?')) return;
    try {
        await api.deleteMyStory(storyId);
        setGroupedStories(prev => {
            const newGroups = prev.map(g => ({
                ...g,
                stories: g.stories.filter(s => s._id !== storyId && s.id !== storyId)
            })).filter(g => g.stories.length > 0);
            return newGroups;
        });
        setActiveGroupIndex(null); 
    } catch (err: any) {
        alert('שגיאה במחיקה: ' + err.message);
    }
  };

  const handleShareStory = async (story: StoryItem) => {
      if (navigator.share) {
          try {
              await navigator.share({
                  title: 'סטורי מקהילת נשי',
                  text: story.type === 'text' ? story.content : (story.caption || 'צפי בסטורי הזה בקהילת נשי!'),
                  url: `${API_URL}/stories/share/${story._id || story.id}` 
              });
          } catch (error) {
              console.log('Error sharing', error);
          }
      } else {
          alert("הדפדפן שלך לא תומך בשיתוף ישיר.");
      }
  };

  const handleStoryImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5000000) { alert('הקובץ גדול מדי. המקסימום הוא 5MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
        setNewStory({ ...newStory, type: 'image', content: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  // רק אירועים עתידיים - אירוע שעבר התאריך שלו לא מוצג יותר בבאנר הראשי, גם אם סומן כ"hero" ע"י מנהלת
  const heroEvents = events.filter(e => e.isHero && new Date(e.date) >= new Date());
  const displayEvents = heroEvents.length > 0 ? heroEvents : upcomingEvents.slice(0, 3);

  useEffect(() => {
    if (displayEvents && displayEvents.length > 0) {
        const interval = setInterval(() => setCurrentSlide((prev) => (prev + 1) % displayEvents.length), 6000);
        return () => clearInterval(interval);
    }
  }, [displayEvents]);

  useEffect(() => {
    const checkLottery = () => {
        if (!lotteries || lotteries.length === 0) return;
        const now = new Date().getTime();
        const active = lotteries.find(l => {
            if (!l.drawDate) return false;
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
      if (!agreedToTerms) {
        alert("יש לאשר את התקנון ומדיניות האתר כדי להמשיך.");
        return;
      }
      try {
          const res = await api.requestMembership(membershipForm as any);
          if (res.success) {
              if (onUpdateUser) onUpdateUser(res.user);
              setShowMembershipModal(false);
              alert("הבקשה נשלחה בהצלחה! המתיני לאישור המנהלת.");
          }
      } catch (err) { alert("שגיאה בשליחה"); }
  };

  const renderAdBanner = () => {
    if (!ads || ads.length === 0) return null;
    const ad = ads[currentAdIndex]; 
    if (!ad) return null;

    return (
      <div className="md:mx-0 animate-fade-in transition-all duration-700 w-full hover:opacity-95 cursor-pointer">
        <a href={ad.link || '#'} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden md:rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(189,122,129,0.08)] transition-all duration-300 border border-rose-50/50">
          {ad.type === 'image' ? (
            <img src={ad.content} alt={ad.title || 'Ad'} loading="lazy" className="w-full h-24 md:h-28 object-cover transition-transform duration-700 group-hover:scale-105" />
          ) : (
            <div className="w-full h-24 md:h-28 bg-slate-900 flex items-center justify-center overflow-hidden">
                <video src={ad.content} autoPlay muted playsInline onEnded={() => setCurrentAdIndex((prev) => (prev + 1) % ads.length)} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-l from-black/50 to-transparent flex items-center justify-end px-8 text-right text-white">
             <div>
                <p className="text-[10px] font-bold opacity-90 uppercase tracking-widest mb-1 text-rose-200">בשיתוף</p>
                <h4 className="text-base font-black leading-tight tracking-wide">{ad.title || ''}</h4>
             </div>
          </div>
        </a>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-5">
          <p className="font-accent text-7xl text-ink leading-none animate-pulse">נשי</p>
          <div className="mx-auto h-px w-24 overflow-hidden bg-rose-100">
            <div className="h-full w-1/2 bg-rose-400 animate-[shimmer-sweep_1.6s_ease-in-out_infinite]" />
          </div>
          <p className="text-sm text-slate-500">רגע, אנחנו מכינות לך את הבית…</p>
        </div>
      </div>
    );
  }

  const latestInspiration = inspirations[0] || { text: "הכוח האמיתי של אישה נמצא ביכולת שלה להאיר לאחרות את הדרך.", author: "נ.ש" };
  const activeGroup = activeGroupIndex !== null ? groupedStories[activeGroupIndex] : null;
  const currentStory = activeGroup ? activeGroup.stories[activeInnerIndex] : null;

  return (
    <div className="min-h-screen pb-12 relative font-sans text-right" dir="rtl">

      {/* ============ HERO — full-bleed, animated ============ */}
      <section className="full-bleed relative -mt-4 overflow-hidden">
        {/* drifting colour mesh */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-24 right-[8%] w-[46vw] max-w-[620px] aspect-square rounded-full bg-rose-200/60 blur-[90px] animate-mesh-drift" />
          <div className="absolute top-[30%] left-[4%] w-[40vw] max-w-[540px] aspect-square rounded-full bg-plum-200/50 blur-[100px] animate-mesh-drift-slow" />
          <div className="absolute bottom-[-10%] right-[35%] w-[30vw] max-w-[420px] aspect-square rounded-full bg-champagne-200/60 blur-[90px] animate-mesh-drift" style={{ animationDelay: '-8s' }} />
          {/* fine rotating ring */}
          <svg className="absolute -left-40 top-10 w-[520px] h-[520px] text-rose-300/40 animate-spin-slow hidden md:block" viewBox="0 0 200 200" fill="none">
            <circle cx="100" cy="100" r="96" stroke="currentColor" strokeWidth="0.4" strokeDasharray="1 5" />
            <circle cx="100" cy="100" r="74" stroke="currentColor" strokeWidth="0.3" />
          </svg>
        </div>

        <div className="relative max-w-7xl mx-auto px-5 md:px-8 pt-10 md:pt-16 pb-10 md:pb-20 grid lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-6 items-center">
          <div className="relative z-10">
            <p className="eyebrow animate-fade-in-up">קהילת נשים · תרבות · השראה</p>
            <AnimatedHeadline
              className="mt-5 text-[3.4rem] leading-[0.98] sm:text-[4.6rem] lg:text-[6.2rem] text-ink"
              lines={[{ text: 'המקום שלך' }, { text: 'לפרוח,', className: 'font-accent text-[1.45em] leading-[0.82] text-rose-600' }, { text: 'להתחבר ולהשפיע.' , className: 'text-[0.55em] leading-[1.25] mt-3 text-slate-500 font-light' }]}
            />
            <p className="mt-7 max-w-md text-[17px] leading-relaxed text-slate-600 animate-fade-in-up" style={{ animationDelay: '900ms' }}>
              אירועים, חוגים, קהילה ורגעים קטנים של השראה — מרחב אחד, עדין ומחבק, שנבנה בשבילך.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3 animate-fade-in-up" style={{ animationDelay: '1050ms' }}>
              <Link to="/events" className="btn-primary group !px-7 !py-3.5">
                לאירועים הקרובים
                <ArrowLeft size={16} className="transition-transform duration-500 group-hover:-translate-x-1.5" />
              </Link>
              {user?.isMemberApproved ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur border border-rose-100 px-5 py-3 text-sm text-slate-600">
                  <Star size={15} className="text-champagne-500" fill="currentColor" /> {(user?.points || 0).toLocaleString()} נקודות במעגל
                </span>
              ) : !user?.isMemberRequested ? (
                <button onClick={() => (user ? setShowMembershipModal(true) : onOpenLogin())} className="btn-ghost !px-6 !py-3.5">הצטרפי למעגל</button>
              ) : (
                <span className="text-sm text-slate-500">בקשת ההצטרפות שלך בטיפול ✨</span>
              )}
            </div>
          </div>

          {/* floating collage of what's coming up */}
          <div className="relative h-[380px] sm:h-[460px] lg:h-[560px]">
            {(() => {
              const pics = upcomingEvents.filter(e => e.image).slice(0, 3);
              const fallback = classes.filter((c: any) => c.image).slice(0, 3 - pics.length).map((c: any) => ({ image: c.image, title: c.title, id: c._id }));
              const items: any[] = [...pics, ...fallback];
              const spots = [
                'right-[6%] top-[4%] w-[52%] h-[64%] rotate-[-4deg] animate-float-y',
                'left-[4%] top-[18%] w-[44%] h-[52%] rotate-[5deg] animate-float-y-slow',
                'right-[30%] bottom-[2%] w-[40%] h-[40%] rotate-[2deg] animate-float-y',
              ];
              if (items.length === 0) {
                return (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-[78%] aspect-square">
                      <div className="absolute inset-0 rounded-[45%_55%_60%_40%/50%_45%_55%_50%] bg-gradient-to-br from-rose-200 via-rose-100 to-plum-200 animate-mesh-drift" />
                      <div className="absolute inset-[12%] rounded-[55%_45%_40%_60%/45%_55%_45%_55%] bg-white/50 backdrop-blur-xl border border-white/70 flex items-center justify-center">
                        <span className="font-accent text-8xl text-rose-700/80">נשי</span>
                      </div>
                    </div>
                  </div>
                );
              }
              return items.map((it, i) => (
                <div key={i} className={`absolute ${spots[i]}`} style={{ animationDelay: `${i * -2.3}s` }}>
                  <div className="w-full h-full animate-clip-up" style={{ animationDelay: `${500 + i * 220}ms` }}>
                    <div className="w-full h-full rounded-[2rem] overflow-hidden shadow-lift ring-8 ring-white/70 bg-rose-100">
                      <img src={it.image} alt={it.title || ''} className="w-full h-full object-cover animate-kenburns" />
                    </div>
                  </div>
                </div>
              ));
            })()}
            {upcomingEvents[0] && (
              <Link to="/events" className="absolute left-[2%] bottom-[8%] z-10 animate-scale-in" style={{ animationDelay: '1300ms' }}>
                <div className="rounded-3xl bg-white/85 backdrop-blur-xl border border-white shadow-lift px-5 py-4 max-w-[230px] hover:-translate-y-1 transition-transform duration-500">
                  <p className="text-[11px] text-rose-600 font-semibold">האירוע הבא</p>
                  <p className="mt-1 text-[15px] font-semibold text-ink leading-snug line-clamp-2">{upcomingEvents[0].title}</p>
                  <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1.5"><Calendar size={12} /> {new Date(upcomingEvents[0].date).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}</p>
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* marquee ribbon */}
        <div className="relative border-y border-rose-200/70 bg-white/40 backdrop-blur-sm py-5 md:py-7">
          <Marquee items={['תרבות', 'קהילה', 'השראה', 'אירועים', 'חוגים', 'חסד', 'יצירה', 'ביחד']} />
        </div>
      </section>

      <div className="relative z-10 space-y-20 md:space-y-28 pt-14 md:pt-20">

        {/* ============ FLYERS ============ */}
        <ScrollReveal animation="blur-in" className="px-5 md:px-0">
          <FlyerCarousel />
        </ScrollReveal>

        {/* ============ STORIES ============ */}
        <section>
          <div className="px-5 md:px-0 flex items-center justify-between mb-4">
            <p className="eyebrow">רגעים מהקהילה</p>
            <span className="text-xs text-slate-400">נעלמים אחרי 24 שעות</span>
          </div>
          <div className="w-full px-5 md:px-0 pb-2 pt-1 overflow-x-auto no-scrollbar flex gap-5 snap-x">
            <button type="button" className="flex flex-col items-center gap-2 shrink-0 snap-center group" onClick={() => user ? setShowAddStoryModal(true) : onOpenLogin()}>
              <div className="relative w-[76px] h-[76px] rounded-full p-1 flex items-center justify-center bg-white cursor-pointer transition-all duration-500 group-hover:scale-[1.07] active:scale-95 shadow-petal border border-dashed border-rose-300">
                 {user?.avatar ? <img src={user.avatar} className="w-full h-full rounded-full object-cover" alt="" /> : <span className="w-full h-full rounded-full bg-rose-50 flex items-center justify-center text-rose-400"><Camera size={22} strokeWidth={1.5} /></span>}
                 <span className="absolute -bottom-0.5 -right-0.5 bg-rose-600 text-white rounded-full p-[5px] border-2 border-white shadow-md group-hover:rotate-90 transition-transform duration-500"><Plus size={12} strokeWidth={3} /></span>
              </div>
              <span className="text-[12px] font-medium text-slate-600">הוסיפי רגע</span>
            </button>
            {groupedStories.map((group, idx) => (
              <button type="button" key={group.userId} className="flex flex-col items-center gap-2 shrink-0 snap-center animate-scale-in" style={{ animationDelay: `${idx * 70}ms` }} onClick={() => { setActiveGroupIndex(idx); setActiveInnerIndex(0); setStoryProgress(0); }}>
                <div className="relative w-[76px] h-[76px] p-[3px] flex items-center justify-center transform active:scale-95 hover:scale-[1.07] transition-all duration-500">
                  <StoryRing count={group.stories.length} />
                  <img src={group.user?.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${group.user?.name || 'user'}`} className="w-full h-full rounded-full object-cover border-[3px] border-white bg-white relative z-10" alt="" />
                </div>
                <span className="text-[12px] text-slate-600 w-[76px] truncate text-center">{group.user?.name || 'משתמשת'}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ============ BENTO — what is NASHI ============ */}
        <section>
          <SectionHeader eyebrow="מה זה נשי" title="הכול במקום אחד" />
          <div className="mt-8 px-5 md:px-0 grid grid-cols-2 md:grid-cols-4 md:grid-rows-2 gap-3 md:gap-5 md:h-[520px]">
            <ScrollReveal animation="scale-in" className="col-span-2 md:row-span-2">
              <TiltCard onClick={() => navigate('/events')} className="group relative h-[260px] md:h-full rounded-[2rem] overflow-hidden cursor-pointer bg-rose-700 text-white">
                {upcomingEvents[0]?.image && <img src={upcomingEvents[0].image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-55 transition-transform duration-[1.6s] group-hover:scale-110" />}
                <div className="absolute inset-0 bg-gradient-to-t from-rose-950/85 via-rose-900/30 to-transparent" />
                <div className="absolute inset-0 p-7 md:p-10 flex flex-col justify-between">
                  <Calendar size={30} strokeWidth={1.3} />
                  <div>
                    <p className="text-white/70 text-sm">{upcomingEvents.length > 0 ? `${upcomingEvents.length} אירועים קרובים` : 'לוח האירועים'}</p>
                    <h3 className="mt-1 font-accent text-6xl md:text-8xl leading-none text-white">אירועים</h3>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm text-white/90">לגלות מה קורה <ArrowLeft size={15} className="transition-transform duration-500 group-hover:-translate-x-2" /></span>
                  </div>
                </div>
              </TiltCard>
            </ScrollReveal>
            <ScrollReveal animation="scale-in" delay={100} className="col-span-1">
              <TiltCard onClick={() => navigate('/classes')} className="group relative h-[190px] md:h-full rounded-[2rem] overflow-hidden cursor-pointer bg-plum-100 p-6 flex flex-col justify-between">
                <GraduationCap size={28} strokeWidth={1.3} className="text-plum-600 transition-transform duration-500 group-hover:-rotate-12" />
                <div>
                  <h3 className="font-accent text-5xl md:text-6xl leading-none text-plum-800">חוגים</h3>
                  <p className="text-xs text-plum-600 mt-1">{classes.length > 0 ? `${classes.length} חוגים פעילים` : 'סדנאות והעשרה'}</p>
                </div>
              </TiltCard>
            </ScrollReveal>
            <ScrollReveal animation="scale-in" delay={180} className="col-span-1">
              <TiltCard onClick={() => navigate('/lottery')} className="group relative h-[190px] md:h-full rounded-[2rem] overflow-hidden cursor-pointer bg-champagne-100 p-6 flex flex-col justify-between">
                <Trophy size={28} strokeWidth={1.3} className="text-champagne-600 transition-transform duration-500 group-hover:scale-110" />
                <div>
                  <h3 className="font-accent text-5xl md:text-6xl leading-none text-champagne-800">הגרלות</h3>
                  <p className="text-xs text-champagne-700 mt-1 tabular-nums">{upcomingLottery ? `ההגרלה בעוד ${timeLeft}` : 'פרסים לחברות המעגל'}</p>
                </div>
              </TiltCard>
            </ScrollReveal>
            <ScrollReveal animation="scale-in" delay={260} className="col-span-2">
              <TiltCard onClick={() => navigate('/community')} className="group relative h-[190px] md:h-full rounded-[2rem] overflow-hidden cursor-pointer bg-white border border-rose-100 p-6 md:p-8 flex items-center justify-between gap-6">
                <div>
                  <HeartHandshake size={28} strokeWidth={1.3} className="text-rose-500" />
                  <h3 className="mt-3 font-accent text-5xl md:text-6xl leading-none text-ink">קהילה וחסד</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-[16rem]">עסקים, שירותים ויד מושטת — מנשים לנשים.</p>
                </div>
                <div className="hidden sm:flex -space-x-4 space-x-reverse">
                  {communityItems.filter((c: any) => c.image).slice(0, 3).map((c: any, i: number) => (
                    <img key={i} src={c.image} alt="" className="h-16 w-16 md:h-20 md:w-20 rounded-full object-cover ring-4 ring-white transition-transform duration-500 group-hover:-translate-y-1" style={{ transitionDelay: `${i * 60}ms` }} />
                  ))}
                </div>
              </TiltCard>
            </ScrollReveal>
          </div>
        </section>

        {/* ============ EVENTS RAIL ============ */}
        {upcomingEvents.length > 0 && (
          <section>
            <SectionHeader eyebrow="בקרוב" title="אירועים קרובים" to="/events" linkLabel="ללוח המלא" />
            <div ref={mobileSliderRef} className="mt-8 flex gap-5 overflow-x-auto snap-x snap-mandatory no-scrollbar px-5 md:px-0 pb-6">
              {upcomingEvents.map((event, i) => (
                <ScrollReveal key={event.id || i} animation="scale-in" delay={i * 90} className="snap-start shrink-0 w-[82%] sm:w-[46%] lg:w-[31%]">
                  <EventCard
                    title={event.title}
                    image={event.image}
                    dateLabel={event.date ? new Date(event.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' }) : ''}
                    location={event.location}
                    category={event.category}
                    ctaLabel="לפרטים והרשמה"
                    onClick={() => navigate('/events')}
                    className="h-full"
                  />
                </ScrollReveal>
              ))}
            </div>
          </section>
        )}

        {/* ============ INSPIRATION BAND ============ */}
        <section className="full-bleed relative overflow-hidden bg-rose-800 text-white">
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="absolute -top-1/2 right-0 w-[60vw] aspect-square rounded-full bg-rose-500/40 blur-[120px] animate-mesh-drift" />
            <div className="absolute -bottom-1/2 left-0 w-[50vw] aspect-square rounded-full bg-plum-500/40 blur-[120px] animate-mesh-drift-slow" />
          </div>
          <div className="relative max-w-5xl mx-auto px-6 py-20 md:py-28 text-center">
            <ScrollReveal animation="blur-in"><Quote className="mx-auto text-rose-200" size={34} strokeWidth={1.2} /></ScrollReveal>
            <ScrollReveal animation="blur-in" delay={150}>
              <p className="mt-6 font-display font-light text-[1.9rem] leading-[1.25] md:text-[3.2rem] text-white">"{latestInspiration.text}"</p>
            </ScrollReveal>
            <ScrollReveal delay={350}>
              <p className="mt-8 text-sm text-rose-100/80">השראה יומית · <span className="text-white font-medium">{latestInspiration.author}</span></p>
            </ScrollReveal>
          </div>
        </section>

        {/* ============ CLASSES — editorial grid ============ */}
        {classes.length > 0 && (
          <section>
            <SectionHeader eyebrow="ללמוד וליצור" title="חוגים וסדנאות" to="/classes" linkLabel="לכל החוגים" />
            <div className="mt-8 px-5 md:px-0 grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {classes.slice(0, 4).map((cls: any, i: number) => (
                <ScrollReveal key={cls._id || i} animation="clip-up" delay={i * 120} className={i % 2 === 1 ? 'lg:mt-14' : ''}>
                  <button type="button" onClick={() => navigate('/classes')} className="group relative block w-full text-right aspect-[3/4] rounded-[2rem] overflow-hidden bg-rose-100">
                    <img src={cls.image} alt={cls.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 text-white">
                      {cls.day && <span className="inline-block rounded-full bg-white/20 backdrop-blur px-2.5 py-1 text-[11px] mb-2">{cls.day}</span>}
                      <h3 className="font-strong text-lg md:text-2xl leading-tight text-white">{cls.title}</h3>
                      <p className="mt-1 text-xs md:text-sm text-white/75 max-h-0 opacity-0 group-hover:max-h-10 group-hover:opacity-100 transition-all duration-500">{cls.instructor}</p>
                    </div>
                  </button>
                </ScrollReveal>
              ))}
            </div>
          </section>
        )}

        {/* ============ WOMAN OF THE WEEK — spotlight ============ */}
        {personality && (
          <section className="px-5 md:px-0">
            <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
              <ScrollReveal animation="clip-up" className="relative mx-auto w-full max-w-[420px]">
                <div className="absolute -inset-5 rounded-t-full rounded-b-[3rem] border border-rose-200 animate-float-y-slow" aria-hidden="true" />
                <div className="relative aspect-[4/5] rounded-t-full rounded-b-[2.5rem] overflow-hidden bg-rose-100 shadow-lift">
                  <img src={personality.image} alt={personality.name} className="w-full h-full object-cover animate-kenburns" loading="lazy" />
                </div>
              </ScrollReveal>
              <div>
                <ScrollReveal><p className="eyebrow">אשת השבוע</p></ScrollReveal>
                <ScrollReveal animation="blur-in" delay={120}><h2 className="mt-3 font-display text-[2.6rem] md:text-[4rem] leading-[1.02] text-ink">{personality.name}</h2></ScrollReveal>
                {personality.role && <ScrollReveal delay={240}><p className="mt-5 text-lg text-slate-600 leading-relaxed max-w-md">{personality.role}</p></ScrollReveal>}
                <ScrollReveal delay={360}>
                  <button type="button" onClick={() => navigate(personality._id || personality.id ? `/personality-archive/${personality._id || personality.id}` : '/personality-archive')} className="btn-primary group mt-8">
                    לקריאת הראיון <ArrowLeft size={16} className="transition-transform duration-500 group-hover:-translate-x-1.5" />
                  </button>
                </ScrollReveal>
              </div>
            </div>
          </section>
        )}

        {/* ============ COMMUNITY ============ */}
        {communityItems.length > 0 && (
          <section>
            <SectionHeader eyebrow="מנשים לנשים" title="קהילה וחסד" to="/community" linkLabel="לכל השירותים" />
            <div className="mt-8 px-5 md:px-0 grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {communityItems.slice(0, 4).map((item: any, i: number) => (
                <ScrollReveal key={item._id || i} animation="scale-in" delay={i * 90}>
                  <button type="button" onClick={() => navigate('/community', { state: { activeTab: item.category || item.type } })} className="group w-full text-right card-soft overflow-hidden hover:shadow-lift hover:-translate-y-1 transition-all duration-500">
                    <div className="m-2 mb-0 aspect-[4/3] rounded-[1.4rem] overflow-hidden bg-rose-50">
                      <img src={item.image} alt={item.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-[1.2s] group-hover:scale-110" />
                    </div>
                    <div className="p-4 md:p-5">
                      <h3 className="text-[1.05rem] md:text-lg text-ink truncate">{item.title}</h3>
                      <p className="mt-1 text-xs md:text-[13px] text-slate-500 line-clamp-2 leading-relaxed">{item.description || item.location || 'לפרטים ודרכי יצירת קשר'}</p>
                    </div>
                  </button>
                </ScrollReveal>
              ))}
            </div>
          </section>
        )}

        {/* ============ ANNOUNCEMENTS ============ */}
        {announcements.length > 0 && (
          <section className="px-5 md:px-0">
            <ScrollReveal animation="scale-in" className="card-soft p-6 md:p-10 grid md:grid-cols-[220px_1fr] gap-6 md:gap-10">
              <div>
                <span className="relative inline-flex h-3 w-3"><span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60 animate-ping" /><span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" /></span>
                <h2 className="mt-3 font-display text-3xl text-ink">לוח מודעות</h2>
                <p className="mt-1 text-sm text-slate-500">עדכונים מהנהלת הקהילה</p>
              </div>
              <div className="divide-y divide-rose-100">
                {announcements.slice(0, 3).map((ann: any, i: number) => (
                  <ScrollReveal key={ann._id || i} delay={i * 120} className="py-4 first:pt-0 last:pb-0">
                    <h3 className="text-lg text-ink flex items-center gap-2"><Megaphone size={16} className="text-rose-400 shrink-0" strokeWidth={1.6} /> {ann.title}</h3>
                    <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{ann.content}</p>
                  </ScrollReveal>
                ))}
              </div>
            </ScrollReveal>
          </section>
        )}

        {/* Ads strip */}
        <div className="w-full px-5 md:px-0">{renderAdBanner()}</div>

        {/* small credits (the site-wide footer lives in Layout) */}
        <div className="pb-6 text-center text-xs text-slate-400 space-y-2">
          <div className="flex justify-center items-center gap-5">
            <button onClick={() => setShowTermsModal(true)} className="hover:text-rose-600 transition-colors">תקנון האתר ומדיניות</button>
            <span className="w-1 h-1 bg-rose-200 rounded-full" />
            <Link to="/contact" className="hover:text-rose-600 transition-colors">צרי קשר</Link>
          </div>
          <p>
            כל הזכויות שמורות לקהילת נשי &copy; {new Date().getFullYear()} · בנייה ופיתוח ע"י
            <a href="https://wa.me/message/WZKLTKH4KELMD1" target="_blank" rel="noopener noreferrer" className="text-rose-600 font-semibold mr-1.5 hover:text-rose-800 transition-colors">DA פרויקטים ויזמות</a>
          </p>
        </div>
      </div>

      {/* --- מודלים --- */}

      {/* 1. מודל צפייה בסטורי (Fullscreen) */}
      {activeGroup !== null && currentStory && (
         <div className="fixed inset-0 z-[400] bg-slate-900/95 backdrop-blur-3xl flex flex-col animate-fade-in transition-all duration-300" dir="rtl">
            {/* פסי התקדמות */}
            <div className="absolute top-4 left-0 right-0 flex gap-1.5 px-4 z-50" dir="ltr">
               {activeGroup.stories.map((_, idx) => (
                  <div key={idx} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden shadow-sm">
                     <div className="h-full bg-white transition-all duration-75 ease-linear rounded-full"
                         style={{ width: idx === activeInnerIndex ? `${storyProgress}%` : idx < activeInnerIndex ? '100%' : '0%' }}>
                     </div>
                  </div>
               ))}
            </div>
            
            {/* הדר הסטורי */}
            <div className="absolute top-10 left-0 right-0 px-5 z-50 flex justify-between items-center drop-shadow-lg">
               <div className="flex items-center gap-3">
                  <img src={currentStory.user?.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${currentStory.user?.name || 'user'}`} className="w-10 h-10 rounded-full border-[1.5px] border-white/60 shadow-md bg-white object-cover" />
                  <span className="text-white font-bold text-sm tracking-wide drop-shadow-md">{currentStory.user?.name}</span>
               </div>
               <div className="flex gap-2 items-center">
                  <button onClick={() => handleShareStory(currentStory)} className="text-white p-2.5 hover:bg-white/10 bg-black/20 backdrop-blur-md rounded-full transition-colors shadow-sm" title="שתפי את הסטורי">
                     <Share2 size={18}/>
                  </button>
                  
                  {user && (currentStory.user?._id === user._id || currentStory.user?.id === user.id) && (
                     <button onClick={() => handleDeleteMyStory(currentStory._id || currentStory.id!)} className="text-white p-2.5 hover:bg-red-500/80 bg-black/20 backdrop-blur-md rounded-full transition-colors shadow-sm" title="מחיקת הסטורי שלך">
                        <Trash2 size={18}/>
                     </button>
                  )}
                  <button onClick={() => setActiveGroupIndex(null)} className="text-white p-2.5 hover:bg-white/20 bg-black/20 backdrop-blur-md rounded-full transition-colors shadow-sm ml-2"><X size={22}/></button>
               </div>
            </div>
            
            {/* אזור התוכן */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
               {currentStory.type === 'image' ? (
                   <>
                     <img src={currentStory.content} className="w-full h-full object-contain drop-shadow-2xl" alt="Story" />
                     {currentStory.caption && (
                        <div className="absolute bottom-20 left-0 right-0 px-6 text-center z-[60] animate-fade-in-up flex justify-center">
                           <div className="inline-block bg-black/50 text-white px-6 py-4 rounded-[1.5rem] text-sm font-medium backdrop-blur-xl shadow-2xl border border-white/10 leading-relaxed max-w-[90%] pointer-events-none">
                              {renderTextWithLinks(currentStory.caption)}
                           </div>
                        </div>
                     )}
                   </>
               ) : (
                   <div className="w-full h-full bg-gradient-to-br from-rose-300 via-pink-400 to-[#BD7A81] flex items-center justify-center p-8 text-center pointer-events-none">
                      <p className="text-white text-3xl md:text-5xl font-black leading-snug drop-shadow-lg font-serif max-w-2xl relative z-[60]">
                         {renderTextWithLinks(currentStory.content)}
                      </p>
                   </div>
               )}
            </div>
            
            {/* אזורי לחיצה לניווט */}
            <div className="absolute inset-y-24 right-0 w-1/3 z-40 cursor-e-resize" onClick={handlePrevStory}></div>
            <div className="absolute inset-y-24 left-0 w-2/3 z-40 cursor-w-resize" onClick={handleNextStory}></div>
         </div>
      )}

      {/* 2. מודל העלאת סטורי חדש */}
      {showAddStoryModal && (
          <div className="fixed inset-0 z-[450] flex items-end md:items-start justify-center bg-slate-950/50 backdrop-blur-sm animate-fade-in text-right md:pt-24 md:px-4 md:pb-4" onClick={() => setShowAddStoryModal(false)}>
             <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md p-8 relative shadow-2xl animate-slide-up max-h-[88vh] overflow-y-auto border-t-4 border-[#8A5058]">
                 <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto -mt-3 mb-5 md:hidden"></div>
                 <button onClick={() => setShowAddStoryModal(false)} className="absolute top-6 left-6 p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-rose-50 hover:text-rose-400 transition-colors"><X size={20}/></button>
                 <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-2"><Sparkles className="text-[#BD7A81]" size={20}/> שתפי רגע למעגל</h2>
                 
                 <div className="flex gap-4 mb-6">
                    <button 
                       onClick={() => setNewStory({...newStory, type: 'text', caption: ''})} 
                       className={`flex-1 py-4 rounded-2xl flex flex-col items-center gap-2 font-bold text-sm transition-all border-2 ${newStory.type === 'text' ? 'border-rose-300 text-rose-500 bg-rose-50/50' : 'border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                    >
                       <TypeIcon size={24} /> טקסט
                    </button>
                    <button 
                       onClick={() => setNewStory({...newStory, type: 'image', content: ''})} 
                       className={`flex-1 py-4 rounded-2xl flex flex-col items-center gap-2 font-bold text-sm transition-all border-2 ${newStory.type === 'image' ? 'border-rose-300 text-rose-500 bg-rose-50/50' : 'border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                    >
                       <ImageIcon size={24} /> תמונה
                    </button>
                 </div>

                 {newStory.type === 'text' ? (
                     <textarea 
                        className="w-full h-36 bg-slate-50 border border-slate-100 rounded-2xl p-5 resize-none outline-none focus:ring-2 focus:ring-rose-200 text-slate-700 font-medium transition-all"
                        placeholder="מה תרצי לשתף היום? (ניתן לצרף לינק)"
                        value={newStory.content}
                        onChange={e => setNewStory({...newStory, content: e.target.value})}
                     ></textarea>
                 ) : (
                     <div className="space-y-4">
                       <div className="relative border-2 border-dashed border-slate-200 hover:border-rose-300 rounded-2xl p-8 flex flex-col items-center justify-center text-slate-400 bg-slate-50 overflow-hidden min-h-[180px] transition-colors">
                          <input type="file" accept="image/*" onChange={handleStoryImageUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                          {newStory.content ? (
                             <img src={newStory.content} className="absolute inset-0 w-full h-full object-cover" />
                          ) : (
                             <>
                                <Camera size={32} className="mb-3 text-rose-300" />
                                <p className="font-bold text-sm">הקישי לבחירת תמונה</p>
                             </>
                          )}
                       </div>
                       
                       {newStory.content && (
                          <input 
                             type="text" 
                             placeholder="הוסיפי כיתוב (אופציונלי, ניתן לצרף לינק)..." 
                             className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-rose-200 text-slate-700 font-medium text-sm transition-all"
                             value={newStory.caption || ''}
                             onChange={e => setNewStory({...newStory, caption: e.target.value})}
                          />
                       )}
                     </div>
                 )}

                 <button 
                    onClick={submitNewStory} 
                    disabled={isUploadingStory || !newStory.content}
                    className="w-full mt-8 bg-rose-700 text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-rose-500 transition-all active:scale-95"
                 >
                    {isUploadingStory ? 'מעלה...' : 'שליחה לאישור'} <Send size={16} />
                 </button>
                 <p className="text-center text-[11px] text-slate-400 mt-5 font-medium">הסטורי יופיע למשך 24 שעות לאחר אישור המנהלת</p>
             </div>
          </div>
      )}

      {/* 3. מודל בקשת הצטרפות */}
      {showMembershipModal && (
          <div className="fixed inset-0 z-[250] flex items-end md:items-start justify-center bg-slate-950/50 backdrop-blur-sm animate-fade-in text-right md:pt-24 md:px-4 md:pb-4" onClick={() => setShowMembershipModal(false)}>
              <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg p-8 md:p-10 relative shadow-2xl animate-slide-up max-h-[88vh] overflow-y-auto border-t-4 border-[#8A5058]">
                  <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto -mt-4 mb-5 md:hidden"></div>
                  <button onClick={() => setShowMembershipModal(false)} className="absolute top-6 left-6 p-2 hover:bg-rose-50 rounded-full text-slate-400 transition-colors"><X size={20}/></button>
                  <div className="text-right space-y-6">
                      <div className="w-14 h-14 bg-rose-50 rounded-[1.2rem] flex items-center justify-center text-rose-400 shadow-sm"><Sparkles size={28}/></div>
                      <div>
                        <h2 className="text-2xl font-black text-slate-800">בקשת הצטרפות למעגל</h2>
                        <p className="text-slate-500 text-sm mt-1 font-medium">נשמח להכיר אותך קצת יותר.</p>
                      </div>
                      <form onSubmit={handleMembershipSubmit} className="space-y-4 pt-2">
                          <div className="grid grid-cols-2 gap-4">
                            <input required type="number" placeholder="גיל" className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm text-right outline-none focus:ring-2 focus:ring-rose-200 transition-shadow" value={membershipForm.age} onChange={e=>setMembershipForm({...membershipForm, age: e.target.value})}/>
                            <input required type="text" placeholder="עיסוק" className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm text-right outline-none focus:ring-2 focus:ring-rose-200 transition-shadow" value={membershipForm.occupation} onChange={e=>setMembershipForm({...membershipForm, occupation: e.target.value})}/>
                          </div>
                          <input required type="text" placeholder="כתובת מגורים" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm text-right outline-none focus:ring-2 focus:ring-rose-200 transition-shadow" value={membershipForm.address} onChange={e=>setMembershipForm({...membershipForm, address: e.target.value})}/>
                          <input required type="tel" placeholder="מספר טלפון" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm text-right outline-none focus:ring-2 focus:ring-rose-200 transition-shadow" value={membershipForm.phone} onChange={e=>setMembershipForm({...membershipForm, phone: e.target.value})}/>
                          <div className="flex items-center gap-3 pt-2">
                             <input id="terms" type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="w-5 h-5 text-rose-500 border-slate-300 rounded focus:ring-rose-500 cursor-pointer" />
                             <label htmlFor="terms" className="text-sm font-medium text-slate-600 cursor-pointer">אני מאשרת את התקנון</label>
                          </div>
                          <button type="submit" className="w-full mt-4 py-4 bg-rose-700 hover:bg-rose-500 text-white rounded-2xl font-bold text-sm shadow-xl hover:shadow-2xl transition-all active:scale-95">שליחת בקשה</button>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {/* 4. מודל תקנון */}
      {showTermsModal && (
        <div className="fixed inset-0 z-[300] flex items-end md:items-start justify-center bg-slate-950/50 backdrop-blur-sm animate-fade-in text-right md:pt-24 md:px-4 md:pb-4" onClick={() => setShowTermsModal(false)}>
           <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-2xl p-8 shadow-2xl max-h-[88vh] overflow-hidden flex flex-col animate-slide-up border-t-4 border-[#8A5058]">
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto -mt-3 mb-4 shrink-0 md:hidden"></div>
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-2xl font-black text-slate-800">תקנון ומדיניות</h3>
                <button onClick={() => setShowTermsModal(false)} className="p-2 hover:bg-rose-50 rounded-full text-slate-400 transition-colors"><X size={20}/></button>
              </div>
              <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
                 <p className="text-slate-600 text-sm leading-relaxed font-medium">כאן מופיע התקנון המלא של האתר...</p>
              </div>
              <div className="pt-6 shrink-0 border-t border-slate-100 mt-4">
                 <button onClick={() => setShowTermsModal(false)} className="w-full py-4 bg-rose-700 hover:bg-rose-500 text-white font-bold rounded-2xl transition-colors shadow-lg">סגירה והמשך</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default HomePage;
