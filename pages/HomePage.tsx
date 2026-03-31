import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, Star, Music, Palette, Activity, Briefcase, Mic, Gift, Clock, Sparkles,
  X, Send, MapPin, Phone, HeartHandshake, Quote, GraduationCap, ChevronLeft, ChevronRight, ExternalLink,
  Users, Megaphone, Calendar, BookOpen, ArrowLeft, Plus, Image as ImageIcon, Camera, Type as TypeIcon, Trash2, Share2, Target
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';

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
    return <div className="absolute inset-0 rounded-full border-[2.5px] border-[#e8a5b2] shadow-[0_0_8px_rgba(232,165,178,0.4)]"></div>;
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
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#e8a5b2" />
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
  const [showPostcardModal, setShowPostcardModal] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [membershipForm, setMembershipForm] = useState({ age: '', occupation: '', address: '', phone: user?.phone || '' });
  const [isLoading, setIsLoading] = useState(true);

  // === תוספות עבור אתגרי חוסן ===
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeForm, setChallengeForm] = useState({ name: '', phone: '', category: '' });

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
          if (!story.createdAt) return true; 
          const storyTime = new Date(story.createdAt).getTime();
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

  // סליידר אירועים אוטומטי בנייד
  useEffect(() => {
    const slider = mobileSliderRef.current;
    if (!slider || events.length === 0) return;

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
  }, [events]);

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

  const heroEvents = events.filter(e => e.isHero);
  const displayEvents = heroEvents.length > 0 ? heroEvents : events.slice(0, 3);

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

  const handleChallengeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeForm.category) {
      alert("אנא בחרי קטגוריה להשתתפות");
      return;
    }
    const subject = encodeURIComponent(`השתתפות באתגרי חוסן - ${challengeForm.category}`);
    const body = encodeURIComponent(
      `אני רוצה להשתתף באתגר: ${challengeForm.category}\n\n` +
      `שם מלא: ${challengeForm.name}\n` +
      `טלפון: ${challengeForm.phone}\n\n` +
      `*** נא לצרף את תמונת האתגר למייל זה לפני השליחה! ***`
    );
    window.location.href = `mailto:Nashi@101.org.il?subject=${subject}&body=${body}`;
    setShowChallengeModal(false);
    setChallengeForm({ name: '', phone: '', category: '' });
  };

  const handlePassoverClick = (e: React.MouseEvent) => {
    if (!user) {
        e.preventDefault();
        onOpenLogin();
    }
  };

  const renderAdBanner = () => {
    if (!ads || ads.length === 0) return null;
    const ad = ads[currentAdIndex]; 
    if (!ad) return null;

    return (
      <div className="md:mx-0 animate-fade-in transition-all duration-700 w-full hover:opacity-95 cursor-pointer">
        <a href={ad.link || '#'} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden md:rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(244,63,94,0.08)] transition-all duration-300 border border-rose-50/50">
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
      <div className="min-h-screen flex items-center justify-center bg-[#fdfbfb]" dir="rtl">
        <div className="text-center space-y-6">
          <div className="relative w-16 h-16 mx-auto">
             <div className="absolute inset-0 border-[3px] border-rose-50 rounded-full"></div>
             <div className="absolute inset-0 border-[3px] border-[#e8a5b2] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-[#d88a99] text-sm font-bold tracking-widest animate-pulse uppercase font-serif">מכינים עבורך את הקסם...</p>
        </div>
      </div>
    );
  }

  const latestInspiration = inspirations[0] || { text: "הכוח האמיתי של אישה נמצא ביכולת שלה להאיר לאחרות את הדרך.", author: "נ.ש" };
  const activeGroup = activeGroupIndex !== null ? groupedStories[activeGroupIndex] : null;
  const currentStory = activeGroup ? activeGroup.stories[activeInnerIndex] : null;

  return (
    <div className="min-h-screen pb-12 relative overflow-x-hidden font-sans text-right bg-[#fdfbfb] scroll-smooth" dir="rtl">
      
      {/* הגדרות קריטיות לאנימציות מתקדמות עבור כפתור שי לחוסן וכפתור הגלויה */}
      <style>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-x {
          animation: gradient-x 3s ease infinite;
          background-size: 200% 200%;
        }
        @keyframes shimmer-sweep {
          0% { transform: translateX(150%) skewX(-15deg); }
          100% { transform: translateX(-150%) skewX(-15deg); }
        }
        .animate-shimmer-sweep {
          animation: shimmer-sweep 2.5s infinite;
        }
      `}</style>

      {/* Background Ambience - Softer, more feminine */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,rgba(255,245,247,0.7),transparent_70%)]"></div>
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-rose-50/50 rounded-full blur-[100px] opacity-70"></div>
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-pink-50/40 rounded-full blur-[100px]"></div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-5xl mx-auto md:px-8 pt-0 md:pt-10 relative z-10 space-y-10 md:space-y-12">
        
        {/* Banner Area */}
        <div className="w-full px-4 md:px-0">{renderAdBanner()}</div>

        {/* --- אזור הסטוריז המקובץ --- */}
        <div className="w-full px-5 pb-4 pt-2 overflow-x-auto no-scrollbar flex gap-5 snap-x">
            
           {/* כפתור הוספת סטורי מונפש ויוקרתי */}
           <div className="flex flex-col items-center gap-2 shrink-0 snap-center group" onClick={() => user ? setShowAddStoryModal(true) : onOpenLogin()}>
              <div className="relative w-[72px] h-[72px] rounded-full p-1 flex items-center justify-center bg-white/60 backdrop-blur-md cursor-pointer transition-all duration-300 hover:scale-[1.05] shadow-[0_4px_20px_rgb(244,63,94,0.08)] border border-rose-100">
                 {user?.avatar ? <img src={user.avatar} className="w-full h-full rounded-full object-cover" /> : <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${user?.name || 'new'}`} className="w-full h-full rounded-full object-cover opacity-80" />}
                 
                 {/* כפתור הפלוס - עדין יותר */}
                 <div className="absolute bottom-0 right-0 bg-white text-[#d88a99] rounded-full p-[4px] border border-rose-100 shadow-md group-hover:rotate-90 transition-transform duration-300 z-10">
                    <Plus size={14} strokeWidth={3}/>
                 </div>
              </div>
              
              <div className="flex flex-col items-center mt-1">
                 <span className="text-[11px] font-bold text-slate-700 tracking-wide">הוספי רגע</span>
              </div>
           </div>

           {/* רשימת המשתמשות שהעלו סטורי */}
           {groupedStories.map((group, idx) => (
              <div key={group.userId} className="flex flex-col items-center gap-2 shrink-0 snap-center cursor-pointer group-hover" onClick={() => { setActiveGroupIndex(idx); setActiveInnerIndex(0); setStoryProgress(0); }}>
                 <div className="relative w-[72px] h-[72px] p-[3px] flex items-center justify-center transform active:scale-95 hover:scale-[1.05] transition-all duration-300">
                    {/* הטבעת שמתפצלת לפי כמות הסטוריז */}
                    <StoryRing count={group.stories.length} />
                    <img src={group.user?.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${group.user?.name || 'user'}`} className="w-full h-full rounded-full object-cover border-[3px] border-white bg-white relative z-10 shadow-sm" />
                 </div>
                 <span className="text-[11px] text-slate-600 font-medium w-[72px] truncate text-center">{group.user?.name || 'משתמשת'}</span>
              </div>
           ))}
        </div>

        {/* --- MOBILE VIEW START --- */}
        <div className="md:hidden space-y-10 mt-2">
          
          {/* --- שי חוסן (נייד) --- עיצוב זוהר ומקצועי --- */}
          <section className="px-5">
            <div 
                onClick={() => user ? setShowChallengeModal(true) : onOpenLogin()}
                className="group relative flex items-center justify-between w-full bg-gradient-to-r from-rose-400 via-[#ff7eb3] to-rose-500 p-[3px] rounded-[2.2rem] shadow-[0_0_25px_rgba(244,63,94,0.4)] active:scale-95 transition-all overflow-hidden animate-gradient-x cursor-pointer"
            >
                {/* אפקט הברק שרץ על הכפתור */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-full h-full animate-shimmer-sweep pointer-events-none"></div>
                
                <div className="w-full bg-white/10 backdrop-blur-md px-5 py-4 rounded-[2rem] flex items-center justify-between border border-white/20 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-3.5 rounded-2xl text-white shadow-lg backdrop-blur-sm animate-pulse">
                            <Target size={26} strokeWidth={2.5} />
                        </div>
                        <div className="text-right">
                            <h3 className="font-black text-2xl text-white leading-none drop-shadow-md flex items-center gap-2">
                              שיתוף אתגרי חוסן <Sparkles size={16} className="text-yellow-200" />
                            </h3>
                            <span className="block mt-1 mb-1.5 text-rose-100 text-lg font-bold leading-none drop-shadow-sm">העלו תמונה וזכו!</span>
                            <p className="text-rose-50 text-[11px] font-bold bg-black/15 px-2.5 py-1 rounded-full inline-block backdrop-blur-md border border-white/20 shadow-sm">
                                שתפו אותנו באתגר שבחרתם
                            </p>
                        </div>
                    </div>
                    
                    <div className="relative z-10 bg-white text-rose-500 p-3 rounded-full shadow-xl group-hover:-translate-x-1 transition-transform">
                        <ChevronLeft size={20} />
                    </div>
                </div>
            </div>
          </section>

          {/* --- כפתור יצירת גלויה (נייד) --- עיצוב זוהר ומזמין --- */}
          <section className="px-5">
            <div 
                onClick={() => user ? setShowPostcardModal(true) : onOpenLogin()}
                className="group relative flex items-center justify-between w-full bg-gradient-to-r from-purple-400 via-pink-400 to-purple-500 p-[3px] rounded-[2.2rem] shadow-[0_0_25px_rgba(192,132,252,0.4)] active:scale-95 transition-all overflow-hidden animate-gradient-x cursor-pointer"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-full h-full animate-shimmer-sweep pointer-events-none"></div>
                
                <div className="w-full bg-white/10 backdrop-blur-md px-5 py-4 rounded-[2rem] flex items-center justify-between border border-white/20 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-3.5 rounded-2xl text-white shadow-lg backdrop-blur-sm animate-pulse">
                            <ImageIcon size={26} strokeWidth={2.5} />
                        </div>
                        <div className="text-right">
                            <h3 className="font-black text-2xl text-white leading-none drop-shadow-md flex items-center gap-2">
                              גלויה אישית <Sparkles size={16} className="text-yellow-200" />
                            </h3>
                            <span className="block mt-1 mb-1 text-purple-100 text-[13px] font-bold leading-tight drop-shadow-sm">
                              עצבי ברכה מרגשת, הוסיפי מילים חמות ושתפי עם מי שאת אוהבת!
                            </span>
                        </div>
                    </div>
                    
                    <div className="relative z-10 bg-white text-purple-500 p-3 rounded-full shadow-xl group-hover:-translate-x-1 transition-transform">
                        <ChevronLeft size={20} />
                    </div>
                </div>
            </div>
          </section>

          {/* 1. Announcements */}
          {announcements.length > 0 && (
            <section className="px-5">
               <div className="flex items-center gap-2 mb-4">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-300 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-400"></span>
                  </span>
                  <h4 className="text-xs font-bold text-slate-500 tracking-wide uppercase">הודעות המערכת</h4>
               </div>
               
               <div className="-mx-5 px-5 flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory no-scrollbar">
                  {announcements.map((ann, i) => (
                    <div key={i} className="min-w-[85vw] bg-white/80 backdrop-blur-md p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-rose-50/50 snap-center flex items-start gap-4">
                       <div className="p-3 bg-rose-50/80 text-rose-400 rounded-2xl shrink-0">
                          <Megaphone size={18} />
                       </div>
                       <div className="w-full pt-1">
                          <h4 className="font-black text-slate-800 text-sm mb-1.5">{ann.title}</h4>
                          <p className="text-xs text-slate-500 leading-relaxed font-medium">{ann.content}</p>
                       </div>
                    </div>
                  ))}
               </div>
            </section>
          )}

          {/* 2. Events Slider - Softer gradients, elegant text */}
          <section className="space-y-5">
            <div className="flex items-center justify-between px-5">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">אירועים קרובים</h3>
              <Link to="/events" className="text-rose-400 text-xs font-bold hover:text-rose-500 transition-colors flex items-center gap-1">ללוח המלא <ChevronLeft size={14}/></Link>
            </div>
            
            <div 
              ref={mobileSliderRef}
              className="-mx-0 flex overflow-x-auto snap-x snap-mandatory no-scrollbar pb-8"
            >
               {events.map((event, i) => (
                 <div key={i} className="min-w-[100vw] px-5 snap-center">
                    <div className="relative w-full h-[400px] rounded-[2.5rem] overflow-hidden shadow-[0_15px_40px_rgb(0,0,0,0.08)] group cursor-pointer" onClick={() => navigate('/events')}>
                      <img src={event.image} className="w-full h-full object-cover transform transition-transform duration-1000 group-hover:scale-105" alt={event.title} loading="lazy" />
                      
                      {/* Gradient Overlay - Elegant */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent"></div>
                      
                      {/* Date Badge */}
                      <div className="absolute top-6 right-6 bg-white/95 backdrop-blur-sm px-4 py-3 rounded-2xl flex flex-col items-center leading-none shadow-lg border border-white/20 z-10">
                         <span className="font-black text-2xl text-slate-800">{event.date ? new Date(event.date).getDate() : '?'}</span>
                         <span className="text-[11px] font-bold text-rose-400 mt-1 uppercase tracking-wider">{event.date ? new Date(event.date).toLocaleString('he-IL', { month: 'short' }) : ''}</span>
                      </div>

                      {/* Content */}
                      <div className="absolute bottom-0 left-0 w-full p-8 text-white z-20">
                         <div className="flex items-center gap-2 text-rose-200 text-xs font-medium uppercase tracking-widest mb-3">
                            <MapPin size={14} /> {event.location}
                         </div>
                         <h2 className="text-3xl font-black leading-tight mb-5 text-white/95">{event.title}</h2>
                         <button className="w-full bg-white/20 backdrop-blur-md hover:bg-white text-white hover:text-slate-900 border border-white/30 transition-all py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm">
                            לפרטים והרשמה
                         </button>
                      </div>
                    </div>
                 </div>
               ))}
            </div>
          </section>

          {/* 3. Classes - Elegant Grid */}
          <section className="bg-gradient-to-b from-rose-50/30 to-transparent py-10 -mx-0">
            <div className="px-5 mb-6 flex items-center justify-between">
               <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                 <GraduationCap className="text-[#d88a99]" size={22}/> חוגים וסדנאות
               </h3>
               <Link to="/classes" className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm hover:bg-rose-50 text-slate-400 transition-colors"><ChevronLeft size={18}/></Link>
            </div>
            
            <div className="grid grid-cols-2 gap-4 px-5">
              {classes.map((cls, i) => (
                <div 
                  key={i} 
                  onClick={() => navigate('/classes')}
                  className="bg-white/80 backdrop-blur-sm p-3.5 rounded-[2rem] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-rose-50/50 hover:-translate-y-1 active:scale-95 transition-all cursor-pointer"
                >
                  <div className="relative h-32 mb-4 overflow-hidden rounded-[1.5rem]">
                     <img src={cls.image} className="w-full h-full object-cover" alt={cls.title} loading="lazy" />
                     <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-slate-700 shadow-sm">{cls.day}</div>
                  </div>
                  <h4 className="font-black text-slate-800 text-sm px-1 leading-snug">{cls.title}</h4>
                  <p className="text-[11px] text-slate-400 font-medium px-1 mt-1 truncate">{cls.instructor}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Daily Inspiration - Soft Quote Card */}
          <section className="px-5">
            <div className="bg-gradient-to-br from-rose-50 via-white to-pink-50 rounded-[2.5rem] p-8 relative overflow-hidden shadow-[0_8px_30px_rgb(244,63,94,0.05)] border border-white">
               <Quote className="text-rose-200 mb-5 opacity-60" size={36} />
               <p className="text-xl font-serif leading-relaxed relative z-10 text-slate-700 font-medium">"{latestInspiration.text}"</p>
               <div className="mt-8 pt-6 border-t border-rose-100/50 flex justify-between items-center">
                  <span className="text-[11px] text-slate-400 font-medium uppercase tracking-widest">השראה יומית</span>
                  <span className="text-sm font-bold text-[#d88a99]">{latestInspiration.author}</span>
               </div>
            </div>
          </section>

          {/* 5. Community Services */}
          <section className="space-y-5 pt-4">
            <div className="flex items-center justify-between px-5">
              <h3 className="text-xl font-black text-slate-800">קהילה וחסד</h3>
              <Link to="/community" className="w-8 h-8 flex items-center justify-center bg-white hover:bg-rose-50 rounded-full shadow-[0_2px_10px_rgb(0,0,0,0.04)] text-slate-400 transition-colors"><ChevronLeft size={18}/></Link>
            </div>
            
            <div className="grid grid-cols-2 gap-4 px-5 pb-2">
               {communityItems.slice(0, 4).map((item, i) => (
                 <div 
                    key={i} 
                    onClick={() => navigate('/community', { state: { activeTab: item.category || item.type } })}
                    className="bg-white/70 backdrop-blur-sm rounded-[2rem] p-3.5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-white flex flex-col gap-3 active:scale-95 transition-all cursor-pointer"
                 >
                    <img src={item.image} className="w-full h-28 rounded-[1.5rem] object-cover bg-slate-50" alt={item.title} loading="lazy" />
                    <div className="flex flex-col justify-center overflow-hidden px-1">
                       <h4 className="font-black text-slate-800 text-sm truncate w-full">{item.title}</h4>
                       <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed font-medium">{item.description || 'לפרטים נוספים ודרכי יצירת קשר'}</p>
                    </div>
                 </div>
               ))}
            </div>
            <div className="px-5">
              <Link to="/community" className="block w-full text-center py-4 bg-white/60 backdrop-blur-sm border border-rose-50 hover:bg-white text-rose-400 rounded-2xl text-sm font-bold shadow-sm transition-colors">לכל השירותים בקהילה</Link>
            </div>
          </section>

          {/* 6. Personality of the Week */}
          {personality && (
            <section className="px-5 pb-4">
               <div 
                 onClick={() => navigate(personality._id || personality.id ? `/personality-archive/${personality._id || personality.id}` : '/personality-archive')}
                 className="relative bg-white rounded-[2.5rem] overflow-hidden shadow-[0_10px_40px_rgb(244,63,94,0.06)] border border-white hover:shadow-xl transition-all cursor-pointer group"
               >
                 <div className="h-56 w-full relative">
                    <img src={personality.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={personality.name} loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent"></div>
                 </div>
                 <div className="px-8 pb-10 relative -mt-16 text-center z-10">
                    <div className="inline-block bg-white/90 backdrop-blur-md p-1.5 rounded-full shadow-sm mb-4">
                       <div className="bg-rose-50 text-rose-400 px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-rose-100/50">
                          אשת השבוע
                       </div>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-1.5">{personality.name}</h3>
                    {personality.profession && <p className="text-[#d88a99] font-bold text-sm mb-3">{personality.profession}</p>}
                    <p className="text-slate-500 font-serif text-sm leading-relaxed mb-8 px-2 line-clamp-3">"{personality.motto}"</p>
                    <button className="w-full py-4 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-500 font-black text-sm shadow-sm flex items-center justify-center gap-2 transition-colors">
                       לקריאת הראיון <BookOpen size={16} />
                    </button>
                 </div>
               </div>
            </section>
          )}

        </div>
        {/* --- MOBILE VIEW END --- */}

        {/* --- DESKTOP VIEW START --- */}
        <div className="hidden md:block space-y-16">
           {/* Welcome / Points Card */}
           <div className="mx-1">
            {user?.isMemberApproved ? (
               <div className="bg-white/80 backdrop-blur-xl p-6 rounded-[2rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-between">
                 <div className="flex items-center gap-5">
                     <div className="p-4 bg-gradient-to-br from-rose-100 to-pink-100 rounded-[1.2rem] shadow-inner text-rose-400"><Star fill="currentColor" size={20} /></div>
                     <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">הניקוד שצברת בקהילה</p>
                       <span className="font-black text-slate-800 text-3xl tracking-tight">{(user?.points || 0).toLocaleString()} <small className="text-sm opacity-50 font-medium">נק'</small></span>
                     </div>
                 </div>
               </div>
            ) : (
              <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[2.5rem] text-slate-800 flex items-center justify-between gap-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                 <div className="text-right space-y-3">
                     <h3 className="text-3xl font-black flex items-center gap-3 text-slate-800">
                        <Sparkles size={24} className="text-rose-400" /> {user?.isMemberRequested ? 'בקשתך בטיפול, איזה התרגשות!' : 'ברוכה הבאה למעגל הנשי'}
                     </h3>
                     <p className="text-base text-slate-500 font-medium max-w-lg leading-relaxed">המרחב הבטוח שלך להכיר נשות עשייה, לשתף, ללמוד וליהנות מהטבות ייחודיות.</p>
                 </div>
                 {!user?.isMemberRequested && (
                   <button onClick={() => user ? setShowMembershipModal(true) : onOpenLogin()} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold text-sm shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all">הצטרפי למעגל</button>
                 )}
              </div>
            )}
           </div>

           {/* --- שי חוסן (מחשב) --- באנר זוהר ענק לכולם --- */}
           <div className="mx-1 mt-6">
               <div 
                  onClick={() => user ? setShowChallengeModal(true) : onOpenLogin()}
                  className="relative group flex items-center justify-between bg-gradient-to-r from-rose-400 via-[#ff7eb3] to-rose-500 rounded-[3rem] p-1.5 shadow-[0_15px_50px_rgba(244,63,94,0.4)] hover:shadow-[0_20px_60px_rgba(244,63,94,0.6)] hover:-translate-y-1 transition-all duration-500 overflow-hidden animate-gradient-x cursor-pointer"
               >
                  {/* אפקט הברק שרץ על הבאנר */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-full h-full animate-shimmer-sweep pointer-events-none"></div>

                  <div className="w-full bg-white/10 backdrop-blur-lg px-12 py-8 rounded-[2.6rem] flex items-center justify-between border border-white/30 relative z-10">
                     <div className="flex items-center gap-8">
                        <div className="bg-white/20 p-6 rounded-[1.8rem] text-white shadow-2xl backdrop-blur-md animate-pulse">
                            <Target size={44} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="font-black text-5xl text-white tracking-tight drop-shadow-xl flex items-center gap-4">
                               שיתוף אתגרי חוסן <Sparkles className="text-yellow-200" size={36} />
                            </h3>
                            <p className="text-rose-50 text-base font-bold mt-4 bg-black/15 px-5 py-2 rounded-full inline-block backdrop-blur-md border border-white/20 shadow-inner">
                               העלו תמונה וזכו! • לחצי כאן להשתתפות באתגר
                            </p>
                        </div>
                     </div>
                     <div className="bg-white text-rose-500 px-10 py-5 rounded-3xl font-black text-xl shadow-2xl group-hover:bg-rose-50 group-hover:scale-105 transition-all flex items-center gap-3">
                        להשתתפות <ChevronLeft size={24}/>
                     </div>
                  </div>
               </div>
           </div>

           {/* --- כפתור יצירת גלויה (מחשב) --- */}
           <div className="mx-1 mt-6">
                <div
                   onClick={() => user ? setShowPostcardModal(true) : onOpenLogin()}
                   className="relative group flex items-center justify-between bg-gradient-to-r from-purple-400 via-pink-400 to-purple-500 rounded-[3rem] p-1.5 shadow-[0_15px_50px_rgba(192,132,252,0.4)] hover:shadow-[0_20px_60px_rgba(192,132,252,0.6)] hover:-translate-y-1 transition-all duration-500 overflow-hidden animate-gradient-x cursor-pointer"
                >
                   <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-full h-full animate-shimmer-sweep pointer-events-none"></div>

                   <div className="w-full bg-white/10 backdrop-blur-lg px-12 py-8 rounded-[2.6rem] flex items-center justify-between border border-white/30 relative z-10">
                      <div className="flex items-center gap-8">
                         <div className="bg-white/20 p-6 rounded-[1.8rem] text-white shadow-2xl backdrop-blur-md animate-pulse">
                             <ImageIcon size={44} strokeWidth={2.5} />
                         </div>
                         <div>
                             <h3 className="font-black text-5xl text-white tracking-tight drop-shadow-xl flex items-center gap-4">
                                צרי גלויה אישית <Sparkles className="text-yellow-200" size={36} />
                             </h3>
                             <p className="text-purple-50 text-base font-bold mt-4 bg-black/15 px-5 py-2 rounded-full inline-block backdrop-blur-md border border-white/20 shadow-inner">
                                בחרי עיצוב, הוסיפי ברכה חמה ושתפי עם האהובות שלך • לחצי כאן להתחלה
                             </p>
                         </div>
                      </div>
                      <div className="bg-white text-purple-500 px-10 py-5 rounded-3xl font-black text-xl shadow-2xl group-hover:bg-purple-50 group-hover:scale-105 transition-all flex items-center gap-3">
                         ליצירת גלויה <ChevronLeft size={24}/>
                      </div>
                   </div>
                </div>
            </div>

           {/* Hero Slider */}
           <section className="relative h-[500px] w-full overflow-hidden rounded-[3rem] shadow-[0_20px_50px_rgb(0,0,0,0.1)] mt-8">
              {displayEvents.map((event, index) => (
                <div key={index} className={`absolute inset-0 transition-all duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}>
                   <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${event.image})` }}></div>
                   <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/30 to-transparent"></div>
                   <div className="absolute bottom-12 left-12 right-12 flex justify-between items-end">
                      <div className="text-left max-w-2xl">
                         <div className="flex items-center gap-2 text-rose-200 text-sm font-medium uppercase tracking-widest mb-4">
                            <MapPin size={16} /> {event.location}
                         </div>
                         <h2 className="text-5xl font-black text-white leading-tight">{event.title}</h2>
                      </div>
                      <Link to="/events" className="shrink-0 bg-white/20 backdrop-blur-md text-white border border-white/30 px-10 py-4 rounded-2xl font-bold text-base hover:bg-white hover:text-slate-900 transition-all shadow-lg">לפרטים והרשמה</Link>
                   </div>
                </div>
              ))}
           </section>

           {/* Classes Desktop */}
           <section className="space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                  <GraduationCap className="text-[#d88a99]" size={28}/> חוגי המעגל
                </h3>
                <Link to="/classes" className="text-slate-500 hover:text-rose-500 font-bold text-sm transition-colors flex items-center gap-1">לכל החוגים <ChevronLeft size={16}/></Link>
              </div>
              <div className="grid grid-cols-4 gap-6">
                 {classes.slice(0, 4).map((cls, i) => (
                   <div key={i} onClick={() => navigate('/classes')} className="bg-white/80 backdrop-blur-sm p-4 rounded-[2rem] border border-white shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_10px_30px_rgb(244,63,94,0.06)] hover:-translate-y-1 transition-all cursor-pointer group text-center">
                      <div className="overflow-hidden rounded-[1.5rem] mb-4 h-40">
                         <img src={cls.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      </div>
                      <h4 className="font-black text-slate-800 text-lg">{cls.title}</h4>
                      <p className="text-slate-400 text-sm mt-1.5 font-medium">{cls.instructor} <span className="mx-1">•</span> {cls.day}</p>
                   </div>
                 ))}
              </div>
           </section>

           {/* Community Desktop */}
           <section className="space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                  <HeartHandshake className="text-rose-400" size={28}/> קהילה וחסד
                </h3>
                <Link to="/community" className="text-slate-500 hover:text-rose-500 font-bold text-sm transition-colors flex items-center gap-1">לכל השירותים <ChevronLeft size={16}/></Link>
              </div>
              <div className="grid grid-cols-3 gap-8">
                 {communityItems.slice(0, 3).map((item, i) => (
                   <div key={i} onClick={() => navigate('/community', { state: { activeTab: item.category || item.type } })} className="bg-white/80 backdrop-blur-sm rounded-[2rem] overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_10px_30px_rgb(244,63,94,0.06)] hover:-translate-y-1 transition-all cursor-pointer border border-white group">
                      <div className="overflow-hidden h-48">
                         <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      </div>
                      <div className="p-6 text-center">
                        <h4 className="font-black text-slate-800 text-xl">{item.title}</h4>
                        <p className="text-slate-400 text-sm mt-2 flex items-center justify-center gap-1.5"><MapPin size={14}/> {item.location}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </section>

           {/* Personality & Grid Desktop */}
           <div className="grid grid-cols-3 gap-10">
              <div className="col-span-2 space-y-10">
                 {personality && (
                    <section className="bg-gradient-to-br from-white to-rose-50/30 rounded-[3rem] p-10 shadow-[0_10px_40px_rgb(0,0,0,0.04)] border border-white flex items-center gap-10 group cursor-pointer" onClick={() => navigate(personality._id || personality.id ? `/personality-archive/${personality._id || personality.id}` : '/personality-archive')}>
                       <div className="shrink-0 relative">
                          <div className="absolute inset-0 bg-rose-200 blur-2xl opacity-40 rounded-full group-hover:opacity-60 transition-opacity"></div>
                          <img src={personality.image} className="w-64 h-64 rounded-[2.5rem] object-cover shadow-lg border-8 border-white relative z-10 group-hover:scale-105 transition-transform duration-700" alt="" loading="lazy" />
                       </div>
                       <div className="text-right space-y-4">
                          <div className="inline-block bg-white px-4 py-1.5 rounded-full shadow-sm border border-rose-50">
                             <span className="text-rose-400 font-bold text-xs uppercase tracking-widest">אשת השבוע במעגל</span>
                          </div>
                          <h3 className="text-4xl font-black text-slate-800">{personality.name}</h3>
                          {personality.profession && <p className="text-[#d88a99] font-bold text-lg">{personality.profession}</p>}
                          <p className="text-lg text-slate-500 font-serif leading-relaxed line-clamp-3">"{personality.motto}"</p>
                          <button className="text-rose-500 font-bold text-sm flex items-center gap-2 pt-2 group-hover:translate-x-[-8px] transition-transform">לקריאת הראיון המלא <ArrowLeft size={16}/></button>
                       </div>
                    </section>
                 )}
              </div>
              <div className="space-y-8">
                 {/* Inspiration Desktop */}
                 <div className="bg-gradient-to-br from-rose-100 to-[#e8a5b2] rounded-[2.5rem] p-8 text-slate-800 shadow-[0_10px_30px_rgb(232,165,178,0.2)] relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 text-white/20"><Quote size={120} /></div>
                    <div className="relative z-10">
                       <Quote className="text-white mb-6" size={28} />
                       <p className="font-serif leading-relaxed text-xl text-slate-800 font-medium">"{latestInspiration.text}"</p>
                       <p className="mt-6 text-sm font-black text-slate-700 opacity-80">{latestInspiration.author}</p>
                    </div>
                 </div>
                 {/* Announcements Desktop */}
                 <div className="space-y-4">
                    <h4 className="font-bold text-slate-400 text-sm px-2 uppercase tracking-widest">לוח מודעות</h4>
                    {announcements.slice(0, 2).map((ann, i) => (
                      <div key={i} className="bg-white/80 backdrop-blur-sm p-6 rounded-3xl border-r-4 border-rose-300 shadow-sm hover:shadow-md transition-all">
                         <h4 className="font-bold text-slate-800 text-base mb-2 flex items-center gap-2"><Bell className="text-rose-300" size={16}/> {ann.title}</h4>
                         <p className="text-sm text-slate-500 leading-relaxed font-medium">{ann.content}</p>
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>

        {/* Footer - Elegant */}
        <footer className="pt-8 pb-10 border-t border-rose-100/50 text-center space-y-5 px-4 mt-0 bg-transparent relative z-10">
            <div className="flex justify-center items-center gap-8 text-xs font-bold text-slate-400">
                <button onClick={() => setShowTermsModal(true)} className="hover:text-rose-400 transition-colors">תקנון האתר ומדיניות</button>
                <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                <Link to="/contact" className="hover:text-rose-400 transition-colors">צרי קשר</Link>
            </div>
            <p className="text-xs font-medium text-slate-400 tracking-wide">
                כל הזכויות שמורות לקהילת נשי &copy; {new Date().getFullYear()} <br className="md:hidden" />
                <span className="hidden md:inline"> | </span>
                בנייה ופיתוח ע"י 
                <a href="https://wa.me/message/WZKLTKH4KELMD1" target="_blank" rel="noopener noreferrer" className="text-[#d88a99] font-black mr-1.5 hover:text-rose-500 transition-colors">
                  DA פרויקטים ויזמות
                </a>
            </p>
        </footer>
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
                   <div className="w-full h-full bg-gradient-to-br from-rose-300 via-pink-400 to-[#d88a99] flex items-center justify-center p-8 text-center pointer-events-none">
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
          <div className="fixed inset-0 z-[450] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in text-right">
             <div className="bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] w-full max-w-md p-8 relative shadow-2xl border border-white">
                 <button onClick={() => setShowAddStoryModal(false)} className="absolute top-6 left-6 p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-rose-50 hover:text-rose-400 transition-colors"><X size={20}/></button>
                 <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-2"><Sparkles className="text-[#d88a99]" size={20}/> שתפי רגע למעגל</h2>
                 
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
                    className="w-full mt-8 bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-rose-500 transition-all active:scale-95"
                 >
                    {isUploadingStory ? 'מעלה...' : 'שליחה לאישור'} <Send size={16} />
                 </button>
                 <p className="text-center text-[11px] text-slate-400 mt-5 font-medium">הסטורי יופיע למשך 24 שעות לאחר אישור המנהלת</p>
             </div>
          </div>
      )}

      {/* 3. מודל בקשת הצטרפות */}
      {showMembershipModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in text-right">
              <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 md:p-10 relative shadow-2xl border border-white">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-rose-300 to-pink-300"></div>
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
                          <button type="submit" className="w-full mt-4 py-4 bg-slate-900 hover:bg-rose-500 text-white rounded-2xl font-bold text-sm shadow-xl hover:shadow-2xl transition-all active:scale-95">שליחת בקשה</button>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {/* 4. מודל תקנון */}
      {showTermsModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in text-right">
           <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 shadow-2xl max-h-[85vh] overflow-hidden flex flex-col border border-white">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-2xl font-black text-slate-800">תקנון ומדיניות</h3>
                <button onClick={() => setShowTermsModal(false)} className="p-2 hover:bg-rose-50 rounded-full text-slate-400 transition-colors"><X size={20}/></button>
              </div>
              <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
                 <p className="text-slate-600 text-sm leading-relaxed font-medium">כאן מופיע התקנון המלא של האתר...</p>
              </div>
              <div className="pt-6 shrink-0 border-t border-slate-100 mt-4">
                 <button onClick={() => setShowTermsModal(false)} className="w-full py-4 bg-slate-900 hover:bg-rose-500 text-white font-bold rounded-2xl transition-colors shadow-lg">סגירה והמשך</button>
              </div>
           </div>
        </div>
      )}

      {/* 5. מודל יצירת גלויה (Iframe) */}
      {showPostcardModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in text-right">
           <div className="bg-white rounded-[2.5rem] w-full max-w-5xl h-[90vh] md:h-[85vh] p-2 sm:p-4 relative shadow-2xl flex flex-col border border-white overflow-hidden">
              <button onClick={() => setShowPostcardModal(false)} className="absolute top-4 left-4 p-2 bg-slate-100 hover:bg-rose-50 rounded-full text-slate-600 transition-colors z-10 shadow-md">
                 <X size={24}/>
              </button>
              <div className="w-full h-full rounded-[1.5rem] overflow-hidden relative">
                <iframe 
                  src="https://my-web-app--nashi-81205509-24d67.europe-west4.hosted.app" 
                  className="w-full h-full border-none"
                  title="יצירת גלויה אישית"
                  allow="camera; microphone"
                ></iframe>
              </div>
           </div>
        </div>
      )}

      {/* 6. מודל אתגרי חוסן (תוספת חדשה) */}
      {showChallengeModal && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in text-right" dir="rtl">
              <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 md:p-10 relative shadow-2xl border border-white">
                  <button onClick={() => setShowChallengeModal(false)} className="absolute top-6 left-6 p-2 hover:bg-rose-50 rounded-full text-slate-400 transition-colors"><X size={20}/></button>
                  <div className="text-right space-y-6">
                      <div className="w-14 h-14 bg-rose-50 rounded-[1.2rem] flex items-center justify-center text-rose-400 shadow-sm"><Target size={28}/></div>
                      <div>
                          <h2 className="text-2xl font-black text-slate-800">שיתוף אתגרי חוסן</h2>
                          <p className="text-slate-500 text-sm mt-1 font-medium">העלו תמונה וזכו! בחרו אתגר והשאירו פרטים.</p>
                      </div>
                      <form onSubmit={handleChallengeSubmit} className="space-y-4 pt-2">
                          <input required type="text" placeholder="שם מלא" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm text-right outline-none focus:ring-2 focus:ring-rose-200" value={challengeForm.name} onChange={e=>setChallengeForm({...challengeForm, name: e.target.value})}/>
                          <input required type="tel" placeholder="טלפון" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-sm text-right outline-none focus:ring-2 focus:ring-rose-200" value={challengeForm.phone} onChange={e=>setChallengeForm({...challengeForm, phone: e.target.value})}/>
                          
                          <div className="space-y-2 mt-4">
                              <label className="text-sm font-bold text-slate-700">באיזה אתגר תרצו להשתתף?</label>
                              <div className="grid grid-cols-2 gap-3">
                                  {['אתגר האריה 🦁', 'אתגר האפייה 🥖', 'אתגר הגיבור שלי 🦸‍♂️', 'אתגר הגלויה 💌'].map(cat => (
                                      <label key={cat} className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${challengeForm.category === cat ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                                          <input type="radio" name="challengeCategory" value={cat} checked={challengeForm.category === cat} onChange={e => setChallengeForm({...challengeForm, category: e.target.value})} className="hidden" />
                                          <span className="text-sm font-medium">{cat}</span>
                                      </label>
                                  ))}
                              </div>
                          </div>

                          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl mt-4">
                              <p className="text-xs font-bold text-yellow-800 text-center leading-relaxed">
                                  שימו לב: בלחיצה על שליחה תועברו למייל. <br/> חובה לצרף את התמונה למייל שייפתח לפני השליחה!
                              </p>
                          </div>

                          <button type="submit" className="w-full mt-4 py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-bold text-sm shadow-xl hover:shadow-2xl transition-all active:scale-95">פתיחת מייל לשליחת התמונה</button>
                      </form>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default HomePage;