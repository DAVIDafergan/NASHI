import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, Star, Music, Palette, Activity, Briefcase, Mic, Gift, Clock, Sparkles,
  X, Send, MapPin, Phone, HeartHandshake, Quote, GraduationCap, ChevronLeft, ChevronRight, ExternalLink,
  Users, Megaphone, Calendar, BookOpen, ArrowLeft, Plus, Image as ImageIcon, Camera, Type as TypeIcon, Trash2, Share2, Target // נוספו Trash2 ו-Share2 וכן Target
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
  caption?: string; // טקסט שיופיע על התמונה
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
  // מזהה כתובות URL (כולל www ו-http/https)
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
          className="text-white font-black underline decoration-2 decoration-rose-400 hover:text-rose-200 hover:decoration-rose-200 transition-colors pointer-events-auto relative z-[70] drop-shadow-md mx-1 inline-block break-all"
          onClick={(e) => e.stopPropagation()} // מונע מעבר לסטורי הבא בלחיצה על לינק
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
    return <div className="absolute inset-0 rounded-full border-[2.5px] border-rose-500"></div>;
  }
  const radius = 32.5;
  const circumference = 2 * Math.PI * radius;
  const gap = 8; // הרווח בין הפסים
  const dashLength = (circumference / count) - gap;
  
  return (
    <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 69 69">
      <circle 
         cx="34.5" cy="34.5" r={radius} 
         fill="none" stroke="#f43f5e" strokeWidth="2.5"
         strokeDasharray={`${dashLength} ${gap}`} 
         strokeLinecap="round"
      />
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
          api.getStories().catch(() => []) // שליפת הסטוריז הפעילים
        ]);

        setEvents(Array.isArray(evRes) ? evRes.map((e: any) => ({...e, id: e._id || e.id})) : []);
        setLotteries(Array.isArray(lotRes) ? lotRes.map((l: any) => ({...l, id: l._id || l.id})) : []);
        setAds(Array.isArray(adsRes) ? adsRes : []);
        
        // קיבוץ הסטוריז לפי משתמשת (כמו בוואצפ)
        const validStories = Array.isArray(storiesRes) ? storiesRes : [];
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
      // מחפשים באיזה קבוצה נמצא הסטורי הזה
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
       // משדרים לשרת שצפינו בסטורי
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
    const intervalTime = 70; // עדכון כל 70 מ"ש לקבלת תנועה חלקה
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
        setActiveInnerIndex(prev => prev + 1); // עובר לסטורי הבא של אותה בחורה
    } else {
        if (activeGroupIndex! < groupedStories.length - 1) {
            setActiveGroupIndex(prev => prev! + 1); // עובר לבחורה הבאה
            setActiveInnerIndex(0);
        } else {
            setActiveGroupIndex(null); // נגמרו הסטוריז - סוגר
        }
    }
  };

  const handlePrevStory = () => {
    setStoryProgress(0);
    if (activeInnerIndex > 0) {
        setActiveInnerIndex(prev => prev - 1); // חוזר לסטורי הקודם של אותה בחורה
    } else {
        if (activeGroupIndex! > 0) {
            setActiveGroupIndex(prev => prev! - 1); // חוזר לבחורה הקודמת (לסטורי האחרון שלה)
            setActiveInnerIndex(groupedStories[activeGroupIndex! - 1].stories.length - 1);
        } else {
            setActiveInnerIndex(0); // נשאר בסטורי הראשון
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

  // מחיקת סטורי אישי על ידי המשתמשת
  const handleDeleteMyStory = async (storyId: string) => {
    if (!window.confirm('למחוק את הסטורי שלך?')) return;
    try {
        await api.deleteMyStory(storyId);
        // מעדכנים את המערך המקובץ במקום
        setGroupedStories(prev => {
            const newGroups = prev.map(g => ({
                ...g,
                stories: g.stories.filter(s => s._id !== storyId && s.id !== storyId)
            })).filter(g => g.stories.length > 0);
            return newGroups;
        });
        setActiveGroupIndex(null); // סגירת הנגן אחרי מחיקה
    } catch (err: any) {
        alert('שגיאה במחיקה: ' + err.message);
    }
  };

  // שיתוף הסטורי לוואצפ/אפליקציות אחרות
  const handleShareStory = async (story: StoryItem) => {
      if (navigator.share) {
          try {
              await navigator.share({
                  title: 'סטורי מקהילת נשי',
                  text: story.type === 'text' ? story.content : (story.caption || 'צפי בסטורי הזה בקהילת נשי!'),
                  url: `${API_URL}/stories/share/${story._id || story.id}` // הלינק הייעודי שעובר דרך השרת לוואצפ
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

  const renderAdBanner = () => {
    if (!ads || ads.length === 0) return null;
    const ad = ads[currentAdIndex]; 
    if (!ad) return null;

    return (
      <div className="md:mx-0 animate-fade-in transition-all duration-700 w-full">
        <a href={ad.link || '#'} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden md:rounded-2xl shadow-sm border-b md:border border-rose-50">
          {ad.type === 'image' ? (
            <img src={ad.content} alt={ad.title || 'Ad'} className="w-full h-20 md:h-24 object-cover transition-transform duration-700 group-hover:scale-105" />
          ) : (
            <div className="w-full h-20 md:h-24 bg-slate-900 flex items-center justify-center overflow-hidden">
                <video src={ad.content} autoPlay muted playsInline onEnded={() => setCurrentAdIndex((prev) => (prev + 1) % ads.length)} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-l from-black/60 to-transparent flex items-center justify-end px-6 text-right text-white">
             <div>
                <p className="text-[9px] font-bold opacity-80 uppercase tracking-widest mb-0.5 text-rose-200">בשיתוף</p>
                <h4 className="text-sm md:text-sm font-black leading-tight tracking-wide">{ad.title || ''}</h4>
             </div>
          </div>
        </a>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fffcfc]" dir="rtl">
        <div className="text-center space-y-4">
          <div className="relative w-12 h-12 mx-auto">
             <div className="absolute inset-0 border-4 border-purple-100 rounded-full"></div>
             <div className="absolute inset-0 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-purple-400 text-xs font-bold tracking-widest animate-pulse uppercase font-serif">טוען נתונים...</p>
        </div>
      </div>
    );
  }

  const latestInspiration = inspirations[0] || { text: "הכוח האמיתי של אישה נמצא ביכולת שלה להאיר לאחרות את הדרך.", author: "נ.ש" };
  const activeGroup = activeGroupIndex !== null ? groupedStories[activeGroupIndex] : null;
  const currentStory = activeGroup ? activeGroup.stories[activeInnerIndex] : null;

  return (
    <div className="min-h-screen pb-12 relative overflow-x-hidden font-sans text-right bg-[#fffcfc]" dir="rtl">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,rgba(255,245,247,0.8),transparent_70%)]"></div>
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-rose-100/40 rounded-full blur-[120px] opacity-60"></div>
          <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-purple-100/30 rounded-full blur-[80px]"></div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-5xl mx-auto md:px-8 pt-0 md:pt-10 relative z-10 space-y-8 md:space-y-10">
        
        {/* Banner Area */}
        <div className="w-full">{renderAdBanner()}</div>

        {/* --- אזור הסטוריז המקובץ --- */}
        <div className="w-full px-5 pb-2 pt-1 overflow-x-auto no-scrollbar flex gap-4 snap-x">
            
           {/* כפתור הוספת סטורי מונפש ויוקרתי */}
           <div className="flex flex-col items-center gap-1 shrink-0 snap-center group" onClick={() => user ? setShowAddStoryModal(true) : onOpenLogin()}>
              <div className="relative w-[68px] h-[68px] rounded-full border-2 border-dashed border-rose-300 p-1 flex items-center justify-center bg-rose-50 cursor-pointer hover:bg-rose-100 hover:border-rose-400 transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_15px_rgba(244,63,94,0.15)]">
                 {user?.avatar ? <img src={user.avatar} className="w-full h-full rounded-full object-cover" /> : <img src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${user?.name || 'new'}`} className="w-full h-full rounded-full object-cover" />}
                 
                 {/* כפתור הפלוס עם נקודה פועמת עדינה */}
                 <div className="absolute bottom-0 right-0 bg-gradient-to-tr from-rose-500 to-purple-600 text-white rounded-full p-[3px] border-2 border-white shadow-md">
                    <Plus size={12} strokeWidth={4}/>
                 </div>
                 <div className="absolute -top-0 -left-0 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500 border border-white"></span>
                 </div>
              </div>
              
              {/* אנימציית טקסט מושכת */}
              <div className="flex flex-col items-center mt-1">
                 <span className="text-[11px] font-black text-slate-800 tracking-wide drop-shadow-sm">הוספי סטורי</span>
                 <span className="text-[9px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-purple-600 animate-pulse mt-[1px] flex items-center gap-0.5">
                    שתפי רגע <Sparkles size={8} className="text-purple-500" />
                 </span>
              </div>
           </div>

           {/* רשימת המשתמשות שהעלו סטורי */}
           {groupedStories.map((group, idx) => (
              <div key={group.userId} className="flex flex-col items-center gap-1 shrink-0 snap-center cursor-pointer group-hover" onClick={() => { setActiveGroupIndex(idx); setActiveInnerIndex(0); setStoryProgress(0); }}>
                 <div className="relative w-[68px] h-[68px] p-1 flex items-center justify-center transform active:scale-95 transition-transform">
                    {/* הטבעת שמתפצלת לפי כמות הסטוריז */}
                    <StoryRing count={group.stories.length} />
                    <img src={group.user?.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${group.user?.name || 'user'}`} className="w-full h-full rounded-full object-cover border-2 border-white bg-white relative z-10" />
                 </div>
                 <span className="text-[10px] text-slate-700 font-bold w-[68px] truncate text-center mt-1">{group.user?.name || 'משתמשת'}</span>
              </div>
           ))}
        </div>
        {/* סוף אזור הסטוריז */}

        {/* --- MOBILE VIEW START (Redesigned) --- */}
        <div className="md:hidden space-y-8 mt-2">
          
          {/* --- כפתור חדש: אתגרי החוסן והגרלות (נוסף לפי בקשתך) --- */}
          <section className="px-5">
            <Link 
                to="/lottery"
                className="group relative flex items-center justify-between w-full bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 p-4 rounded-3xl shadow-[0_10px_20px_-10px_rgba(225,29,72,0.5)] active:scale-95 transition-all overflow-hidden"
            >
                {/* אפקט תנועה עדין לרקע */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 group-hover:scale-110 transition-transform duration-700"></div>
                
                <div className="relative z-10 flex items-center gap-4">
                    <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl text-white shadow-inner animate-pulse">
                        <Target size={24} />
                    </div>
                    <div className="text-right text-white">
                        <h3 className="font-black text-lg leading-tight tracking-wide drop-shadow-md">אתגרי החוסן והגרלות</h3>
                        <p className="text-rose-100 text-xs font-bold mt-0.5 opacity-90">היכנסי, שתפי וזכי בפרסים! 🎁</p>
                    </div>
                </div>
                
                <div className="relative z-10 bg-white text-purple-600 p-2.5 rounded-full shadow-lg animate-bounce" style={{ animationDuration: '2.5s' }}>
                    <ChevronLeft size={20} className="mr-0.5" />
                </div>
            </Link>
          </section>

          {/* 1. Announcements */}
          {announcements.length > 0 && (
            <section className="px-5">
               <div className="flex items-center gap-2 mb-3 opacity-80">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                  <h4 className="text-xs font-black text-slate-500 tracking-wide uppercase">עדכונים חמים</h4>
               </div>
               
               <div className="-mx-5 px-5 flex overflow-x-auto gap-3 pb-2 snap-x snap-mandatory no-scrollbar">
                  {announcements.map((ann, i) => (
                    <div key={i} className="min-w-[88vw] bg-white p-5 rounded-2xl shadow-[0_4px_20px_-10px_rgba(0,0,0,0.08)] border border-slate-100 snap-center flex items-start gap-4">
                       <div className="p-2.5 bg-rose-50 text-rose-500 rounded-full shrink-0">
                          <Megaphone size={16} />
                       </div>
                       <div className="w-full">
                          <h4 className="font-bold text-slate-800 text-sm mb-1">{ann.title}</h4>
                          <p className="text-xs text-slate-600 leading-relaxed font-medium">{ann.content}</p>
                       </div>
                    </div>
                  ))}
               </div>
            </section>
          )}

          {/* 2. Events Slider - Darker Gradient, Clearer Text */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-5">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">האירועים החמים</h3>
              <Link to="/events" className="text-rose-500 text-xs font-bold bg-rose-50/80 px-4 py-1.5 rounded-full backdrop-blur-sm">ללוח המלא</Link>
            </div>
            
            <div 
              ref={mobileSliderRef}
              className="-mx-0 flex overflow-x-auto snap-x snap-mandatory no-scrollbar pb-6"
            >
               {events.map((event, i) => (
                 <div key={i} className="min-w-[100vw] px-5 snap-center">
                    <div className="relative w-full h-[380px] rounded-[2.5rem] overflow-hidden shadow-[0_15px_40px_-10px_rgba(0,0,0,0.2)] group" onClick={() => navigate('/events')}>
                      {/* Full Image */}
                      <img src={event.image} className="w-full h-full object-cover transform transition-transform duration-700 group-active:scale-105" alt={event.title} />
                      
                      {/* STRONGER Gradient Overlay for readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent opacity-90"></div>
                      
                      {/* Date Badge */}
                      <div className="absolute top-5 right-5 bg-white text-slate-900 px-5 py-3 rounded-2xl flex flex-col items-center leading-none shadow-xl border border-slate-100 z-10">
                         <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1">תאריך</span>
                         <span className="font-black text-2xl">{event.date ? new Date(event.date).getDate() : '?'}</span>
                         <span className="text-xs font-bold text-slate-400 mt-0.5">{event.date ? new Date(event.date).toLocaleString('he-IL', { month: 'short' }) : ''}</span>
                      </div>

                      {/* Content Bottom - High Contrast */}
                      <div className="absolute bottom-0 left-0 w-full p-6 text-white space-y-3 z-20">
                         <div className="flex items-center gap-2 text-rose-300 text-xs font-bold uppercase tracking-widest bg-black/30 px-3 py-1 rounded-full w-fit backdrop-blur-sm">
                            <MapPin size={12} /> {event.location}
                         </div>
                         <h2 className="text-3xl font-black leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{event.title}</h2>
                         <button className="mt-2 w-full bg-white text-slate-900 hover:bg-rose-50 transition-all py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg">
                            שרייני מקום <ArrowLeft size={16} />
                         </button>
                      </div>
                    </div>
                 </div>
               ))}
            </div>
          </section>

          {/* 3. Classes - Grid */}
          <section className="bg-gradient-to-b from-purple-50/50 to-transparent py-10 -mx-0">
            <div className="px-5 mb-5 flex items-center justify-between">
               <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                 <GraduationCap className="text-purple-500" size={22}/> חוגים וסדנאות
               </h3>
               <Link to="/classes" className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm text-slate-400"><ChevronLeft size={18}/></Link>
            </div>
            
            <div className="grid grid-cols-2 gap-3 px-5">
              {classes.map((cls, i) => (
                <div 
                  key={i} 
                  onClick={() => navigate('/classes')}
                  className="bg-white p-3 rounded-[1.8rem] shadow-sm border border-slate-100/50 active:scale-95 transition-transform"
                >
                  <div className="relative h-28 mb-3">
                     <img src={cls.image} className="w-full h-full rounded-[1.2rem] object-cover" alt={cls.title} />
                     <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-bold text-slate-800 shadow-sm">{cls.day}</div>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm px-1 leading-snug">{cls.title}</h4>
                  <p className="text-xs text-slate-400 px-1 mt-1 truncate">{cls.instructor}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Daily Inspiration */}
          <section className="px-5">
            <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-xl shadow-slate-200">
               <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
               <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl -ml-6 -mb-6"></div>
               
               <Quote className="text-rose-400 mb-4 opacity-80" size={32} />
               <p className="text-xl font-serif leading-relaxed relative z-10 text-slate-100">"{latestInspiration.text}"</p>
               <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-medium">השראה יומית</span>
                  <span className="text-sm font-black text-rose-400 tracking-wide">{latestInspiration.author}</span>
               </div>
            </div>
          </section>

          {/* 5. Community Services - Grid (Limited to 4 + View All Button) */}
          <section className="space-y-4 pt-4">
            <div className="flex items-center justify-between px-5">
              <h3 className="text-xl font-black text-slate-800">קהילה וחסד</h3>
              <Link to="/community" className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm text-slate-400"><ChevronLeft size={18}/></Link>
            </div>
            
            <div className="grid grid-cols-2 gap-3 px-5 pb-0">
               {communityItems.slice(0, 4).map((item, i) => (
                 <div 
                    key={i} 
                    onClick={() => navigate('/community', { state: { activeTab: item.category || item.type } })}
                    className="bg-white rounded-[2rem] p-3 shadow-sm border border-slate-50 flex flex-col gap-3 active:bg-slate-50 transition-colors"
                 >
                    <img src={item.image} className="w-full h-24 rounded-2xl object-cover bg-slate-100" alt={item.title} />
                    <div className="flex flex-col justify-center overflow-hidden px-1">
                       <h4 className="font-black text-slate-800 text-sm truncate w-full">{item.title}</h4>
                       <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{item.description || 'לחצי לפרטים נוספים ודרכי יצירת קשר'}</p>
                    </div>
                 </div>
               ))}
            </div>
            <div className="px-5">
              <Link to="/community" className="block w-full text-center py-3 bg-rose-50 text-rose-500 rounded-xl text-xs font-black">לכל השירותים בקהילה</Link>
            </div>
          </section>

          {/* 6. Personality of the Week - Reduced bottom padding for Footer adhesion */}
          {personality && (
            <section className="px-5 pb-0">
               <div 
                 onClick={() => navigate(personality._id || personality.id ? `/personality-archive/${personality._id || personality.id}` : '/personality-archive')}
                 className="relative bg-white rounded-[2.5rem] overflow-hidden shadow-xl shadow-purple-100 border border-purple-50"
               >
                 <div className="h-48 w-full relative">
                    <img src={personality.image} className="w-full h-full object-cover" alt={personality.name} />
                    <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent"></div>
                 </div>
                 <div className="px-8 pb-8 relative -mt-12 text-center">
                    <div className="inline-block bg-white p-1.5 rounded-full shadow-lg mb-3">
                       <div className="bg-rose-50 text-rose-500 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-rose-100">
                          אשת השבוע
                       </div>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 mb-1">{personality.name}</h3>
                    {personality.profession && <p className="text-rose-500 font-bold text-sm mb-2">{personality.profession}</p>}
                    <p className="text-slate-500 font-serif italic text-sm leading-relaxed mb-6">"{personality.motto}"</p>
                    <button className="w-full py-3.5 rounded-xl bg-slate-900 text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2">
                       לראיון המלא <BookOpen size={16} className="text-rose-400"/>
                    </button>
                 </div>
               </div>
            </section>
          )}

        </div>
        {/* --- MOBILE VIEW END --- */}

        {/* --- DESKTOP VIEW START (UNTOUCHED) --- */}
        <div className="hidden md:block space-y-12">
           <div className="mx-1">
            {user?.isMemberApproved ? (
                <div className="bg-white/60 backdrop-blur-md p-5 rounded-3xl border border-rose-100/50 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                      <div className="p-3 bg-rose-50 rounded-xl shadow-inner text-rose-400"><Star fill="currentColor" size={16} /></div>
                      <div>
                        <p className="text-[9px] font-black text-rose-300 uppercase tracking-widest leading-none mb-1">הניקוד שצברת</p>
                        <span className="font-black text-slate-800 text-2xl tracking-tighter">{(user?.points || 0).toLocaleString()} <small className="text-xs opacity-40 font-bold">PTS</small></span>
                      </div>
                  </div>
                  <Link to="/lottery" className="bg-slate-900 text-white px-8 py-3 rounded-xl text-xs font-black hover:bg-purple-600 transition-all shadow-md flex items-center gap-1.5">כניסה להגרלות <ChevronLeft size={14}/></Link>
                </div>
            ) : (
              <div className="bg-white/70 backdrop-blur-md p-10 rounded-[3rem] text-slate-800 flex items-center justify-between gap-4 shadow-sm border border-purple-50">
                  <div className="text-right space-y-2">
                      <h3 className="text-2xl font-black flex items-center gap-2 text-purple-600">
                         <Sparkles size={20} className="text-rose-400 animate-pulse" /> {user?.isMemberRequested ? 'הבקשה בטיפול' : 'ברוכה הבאה למעגל'}
                      </h3>
                      <p className="text-sm text-slate-400 font-medium max-w-md">המקום שלך להכיר נשות עשייה וליהנות מהטבות ייחודיות.</p>
                  </div>
                  {!user?.isMemberRequested && (
                    <button onClick={() => user ? setShowMembershipModal(true) : onOpenLogin()} className="bg-rose-500 text-white px-10 py-3.5 rounded-full font-black text-sm shadow-lg hover:bg-purple-600 transition-all">הצטרפי עכשיו</button>
                  )}
              </div>
            )}
           </div>

           <section className="relative h-[450px] w-full overflow-hidden rounded-[3rem] shadow-2xl">
              {displayEvents.map((event, index) => (
                <div key={index} className={`absolute inset-0 transition-all duration-1000 ${index === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}>
                   <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${event.image})` }}></div>
                   <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/80 via-transparent"></div>
                   <div className="absolute bottom-10 left-10 p-10 text-left">
                      <h2 className="text-4xl font-black text-white mb-4">{event.title}</h2>
                      <Link to="/events" className="inline-flex bg-white text-slate-900 px-10 py-4 rounded-2xl font-black text-sm hover:bg-purple-600 transition-all">לפרטים והרשמה</Link>
                   </div>
                </div>
              ))}
           </section>

           <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                  <GraduationCap className="text-purple-500" size={28}/> חוגי המעגל
                </h3>
                <Link to="/classes" className="bg-purple-50 text-purple-600 px-6 py-2 rounded-xl font-black text-sm hover:bg-purple-500 transition-all">לכל החוגים</Link>
              </div>
              <div className="grid grid-cols-4 gap-6">
                 {classes.slice(0, 4).map((cls, i) => (
                   <div key={i} onClick={() => navigate('/classes')} className="bg-white p-4 rounded-3xl border border-purple-50 shadow-sm hover:shadow-xl transition-all cursor-pointer group text-center">
                      <img src={cls.image} className="w-full h-32 rounded-2xl object-cover mb-4 group-hover:scale-105 transition-transform" />
                      <h4 className="font-black text-slate-800">{cls.title}</h4>
                      <p className="text-slate-400 text-xs mt-1">{cls.instructor} | {cls.day}</p>
                   </div>
                 ))}
              </div>
           </section>

           <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                  <HeartHandshake className="text-rose-500" size={28}/> שירותי קהילה וגמ"חים
                </h3>
                <Link to="/community" className="bg-rose-50 text-rose-500 px-6 py-2 rounded-xl font-black text-sm hover:bg-rose-500 transition-all">לכל שירותי הקהילה</Link>
              </div>
              <div className="grid grid-cols-3 gap-8">
                 {communityItems.slice(0, 3).map((item, i) => (
                   <div key={i} onClick={() => navigate('/community', { state: { activeTab: item.category || item.type } })} className="bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all cursor-pointer border border-rose-50">
                      <img src={item.image} className="w-full h-40 object-cover" />
                      <div className="p-6">
                        <h4 className="font-black text-slate-800 text-lg">{item.title}</h4>
                        <p className="text-slate-400 text-sm mt-2 flex items-center gap-2"><MapPin size={14}/> {item.location}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </section>

           <div className="grid grid-cols-3 gap-10">
              <div className="col-span-2 space-y-12">
                 {personality && (
                    <section className="bg-white rounded-[3rem] p-10 shadow-sm border border-purple-50 flex items-center gap-10">
                       <img src={personality.image} className="w-56 h-56 rounded-[2.5rem] object-cover shadow-lg border-8 border-purple-50" alt="" />
                       <div className="text-right space-y-4">
                          <span className="text-purple-500 font-black text-xs uppercase tracking-widest">אשת השבוע במעגל</span>
                          <h3 className="text-4xl font-black text-slate-900">{personality.name}</h3>
                          {personality.profession && <p className="text-rose-500 font-bold text-lg">{personality.profession}</p>}
                          <p className="text-xl text-slate-600 font-serif italic leading-relaxed">"{personality.motto}"</p>
                          <button onClick={() => navigate(personality._id || personality.id ? `/personality-archive/${personality._id || personality.id}` : '/personality-archive')} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-sm flex items-center gap-2">לקריאת הראיון המלא <ChevronLeft size={18}/></button>
                       </div>
                    </section>
                 )}
              </div>
              <div className="space-y-8">
                 <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white">
                    <Quote className="text-rose-400 mb-4" size={24} />
                    <p className="font-serif italic leading-relaxed text-lg">"{latestInspiration.text}"</p>
                    <p className="mt-4 text-xs font-black text-rose-500">{latestInspiration.author}</p>
                 </div>
                 {announcements.slice(0, 2).map((ann, i) => (
                   <div key={i} className="bg-white p-6 rounded-3xl border-r-8 border-purple-500 shadow-sm">
                      <h4 className="font-black text-purple-600 text-sm mb-2 flex items-center gap-2"><Bell size={14}/> {ann.title}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">{ann.content}</p>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Footer */}
        <footer className="pt-6 pb-8 border-t border-rose-50/50 text-center space-y-4 px-4 mt-0 bg-white/50 backdrop-blur-sm">
            <div className="flex justify-center gap-6 text-[10px] md:text-xs font-bold text-slate-400">
                <button onClick={() => setShowTermsModal(true)} className="hover:text-purple-500 transition-colors">תקנון האתר ומדיניות</button>
                <Link to="/contact" className="hover:text-purple-500 transition-colors">צרי קשר</Link>
            </div>
            <p className="text-[10px] md:text-xs font-medium text-slate-300 tracking-wide font-serif">
                כל הזכויות שמורות למעגל הנשי &copy; {new Date().getFullYear()} | בנייה ופיתוח ע"י 
                <a href="https://wa.me/message/WZKLTKH4KELMD1" target="_blank" rel="noopener noreferrer" className="text-purple-400 font-black mr-1">
                  DA פרויקטים ויזמות
                </a>
            </p>
        </footer>
      </div>

      {/* --- מודלים --- */}

      {/* 1. מודל צפייה בסטורי (Fullscreen) */}
      {activeGroup !== null && currentStory && (
         <div className="fixed inset-0 z-[400] bg-slate-950 flex flex-col animate-fade-in" dir="rtl">
            {/* פסי התקדמות (לפי כמות הסטוריז של אותה משתמשת) */}
            <div className="absolute top-4 left-0 right-0 flex gap-1 px-3 z-50" dir="ltr">
               {activeGroup.stories.map((_, idx) => (
                  <div key={idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm">
                     <div className="h-full bg-white transition-all duration-75 ease-linear"
                         style={{ width: idx === activeInnerIndex ? `${storyProgress}%` : idx < activeInnerIndex ? '100%' : '0%' }}>
                     </div>
                  </div>
               ))}
            </div>
            
            {/* הדר הסטורי */}
            <div className="absolute top-8 left-0 right-0 px-4 z-50 flex justify-between items-center drop-shadow-md">
               <div className="flex items-center gap-3">
                  <img src={currentStory.user?.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${currentStory.user?.name || 'user'}`} className="w-10 h-10 rounded-full border border-white/40 shadow-sm bg-white" />
                  <span className="text-white font-bold text-sm tracking-wide">{currentStory.user?.name}</span>
               </div>
               <div className="flex gap-3 items-center">
                  {/* כפתור שיתוף - משתמש ב-Web Share API */}
                  <button onClick={() => handleShareStory(currentStory)} className="text-white p-2 hover:bg-blue-500/80 bg-black/20 backdrop-blur-md rounded-full transition-colors" title="שתפי את הסטורי">
                     <Share2 size={20}/>
                  </button>
                  
                  {/* כפתור מחיקה - מופיע רק אם הסטורי שייך למשתמשת */}
                  {user && (currentStory.user?._id === user._id || currentStory.user?.id === user.id) && (
                     <button onClick={() => handleDeleteMyStory(currentStory._id || currentStory.id!)} className="text-white p-2 hover:bg-red-500/80 bg-black/20 backdrop-blur-md rounded-full transition-colors" title="מחיקת הסטורי שלך">
                        <Trash2 size={20}/>
                     </button>
                  )}
                  <button onClick={() => setActiveGroupIndex(null)} className="text-white p-2 hover:bg-white/20 bg-black/20 backdrop-blur-md rounded-full transition-colors"><X size={24}/></button>
               </div>
            </div>
            
            {/* אזור התוכן - כאן שולב זיהוי הלינקים */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
               {currentStory.type === 'image' ? (
                   <>
                     <img src={currentStory.content} className="w-full h-full object-contain" alt="Story" />
                     {/* הצגת טקסט על התמונה אם קיים */}
                     {currentStory.caption && (
                        <div className="absolute bottom-16 left-0 right-0 px-4 text-center z-[60] animate-fade-in-up flex justify-center">
                           <div className="inline-block bg-black/60 text-white px-5 py-3 rounded-2xl text-sm font-bold backdrop-blur-md shadow-2xl border border-white/10 leading-relaxed max-w-[90%] pointer-events-none">
                              {renderTextWithLinks(currentStory.caption)}
                           </div>
                        </div>
                     )}
                   </>
               ) : (
                   <div className="w-full h-full bg-gradient-to-br from-rose-500 via-purple-600 to-indigo-700 flex items-center justify-center p-8 text-center pointer-events-none">
                      <p className="text-white text-3xl md:text-5xl font-black leading-snug drop-shadow-xl font-serif max-w-2xl relative z-[60]">
                         {renderTextWithLinks(currentStory.content)}
                      </p>
                   </div>
               )}
            </div>
            
            {/* אזורי לחיצה לניווט (מימין אחורה, משמאל קדימה - מותאם לעברית) */}
            <div className="absolute inset-y-24 right-0 w-1/3 z-40" onClick={handlePrevStory}></div>
            <div className="absolute inset-y-24 left-0 w-2/3 z-40" onClick={handleNextStory}></div>
         </div>
      )}

      {/* 2. מודל העלאת סטורי חדש */}
      {showAddStoryModal && (
          <div className="fixed inset-0 z-[450] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-right">
             <div className="bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] w-full max-w-md p-6 relative shadow-2xl">
                 <button onClick={() => setShowAddStoryModal(false)} className="absolute top-6 left-6 p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-colors"><X size={20}/></button>
                 <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><Sparkles className="text-rose-500" size={20}/> שתפי מחשבה או רגע</h2>
                 
                 <div className="flex gap-4 mb-6">
                    <button 
                       onClick={() => setNewStory({...newStory, type: 'text', caption: ''})} 
                       className={`flex-1 py-3 rounded-2xl flex flex-col items-center gap-2 font-bold text-sm transition-colors border-2 ${newStory.type === 'text' ? 'border-rose-500 text-rose-600 bg-rose-50' : 'border-slate-100 text-slate-400'}`}
                    >
                       <TypeIcon size={24} /> טקסט
                    </button>
                    <button 
                       onClick={() => setNewStory({...newStory, type: 'image', content: ''})} 
                       className={`flex-1 py-3 rounded-2xl flex flex-col items-center gap-2 font-bold text-sm transition-colors border-2 ${newStory.type === 'image' ? 'border-rose-500 text-rose-600 bg-rose-50' : 'border-slate-100 text-slate-400'}`}
                    >
                       <ImageIcon size={24} /> תמונה
                    </button>
                 </div>

                 {newStory.type === 'text' ? (
                     <textarea 
                        className="w-full h-32 bg-slate-50 border-none rounded-2xl p-4 resize-none outline-none focus:ring-2 focus:ring-rose-200 text-slate-700 font-medium"
                        placeholder="מה יושב לך על הלב היום?... (ניתן להדביק גם לינק)"
                        value={newStory.content}
                        onChange={e => setNewStory({...newStory, content: e.target.value})}
                     ></textarea>
                 ) : (
                     <div className="space-y-4">
                       <div className="relative border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-slate-400 bg-slate-50 overflow-hidden min-h-[160px]">
                          <input type="file" accept="image/*" onChange={handleStoryImageUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                          {newStory.content ? (
                             <img src={newStory.content} className="absolute inset-0 w-full h-full object-cover" />
                          ) : (
                             <>
                                <Camera size={32} className="mb-2" />
                                <p className="font-bold text-sm">לחצי לבחירת תמונה</p>
                             </>
                          )}
                       </div>
                       
                       {/* שורת הכיתוב לתמונה */}
                       {newStory.content && (
                          <input 
                             type="text" 
                             placeholder="הוסיפי כיתוב לתמונה (ניתן גם לצרף לינק)..." 
                             className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-rose-200 text-slate-700 font-medium text-sm"
                             value={newStory.caption || ''}
                             onChange={e => setNewStory({...newStory, caption: e.target.value})}
                          />
                       )}
                     </div>
                 )}

                 <button 
                    onClick={submitNewStory} 
                    disabled={isUploadingStory || !newStory.content}
                    className="w-full mt-6 bg-rose-500 text-white font-black py-4 rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-rose-600 transition-colors"
                 >
                    {isUploadingStory ? 'מעלה...' : 'שליחה לאישור'} <Send size={16} />
                 </button>
                 <p className="text-center text-[10px] text-slate-400 mt-4 font-bold">הסטורי יתפרסם ל-24 שעות לאחר אישור המנהלת</p>
             </div>
          </div>
      )}

      {/* 3. מודל בקשת הצטרפות */}
      {showMembershipModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in text-right">
              <div className="bg-white rounded-[2rem] md:rounded-[3rem] w-full max-w-lg p-6 md:p-12 relative shadow-2xl border border-white mx-3">
                  <div className="absolute top-0 left-0 w-full h-2 bg-purple-500"></div>
                  <button onClick={() => setShowMembershipModal(false)} className="absolute top-6 left-6 p-2 hover:bg-rose-50 rounded-full text-slate-300 transition-colors"><X size={20}/></button>
                  <div className="text-right space-y-6">
                      <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-400"><Sparkles size={24}/></div>
                      <h2 className="text-xl md:text-3xl font-black text-slate-800 font-serif">בקשת הצטרפות</h2>
                      <form onSubmit={handleMembershipSubmit} className="space-y-4 pt-4 border-t border-rose-50">
                          <div className="grid grid-cols-2 gap-3">
                            <input required type="number" placeholder="גיל" className="p-4 bg-rose-50/30 rounded-xl font-bold text-sm text-right outline-none focus:ring-1 focus:ring-rose-200" value={membershipForm.age} onChange={e=>setMembershipForm({...membershipForm, age: e.target.value})}/>
                            <input required type="text" placeholder="עיסוק" className="p-4 bg-rose-50/30 rounded-xl font-bold text-sm text-right outline-none focus:ring-1 focus:ring-rose-200" value={membershipForm.occupation} onChange={e=>setMembershipForm({...membershipForm, occupation: e.target.value})}/>
                          </div>
                          <input required type="text" placeholder="כתובת מגורים" className="w-full p-4 bg-rose-50/30 rounded-xl font-bold text-sm text-right outline-none focus:ring-1 focus:ring-rose-200" value={membershipForm.address} onChange={e=>setMembershipForm({...membershipForm, address: e.target.value})}/>
                          <input required type="tel" placeholder="מספר טלפון" className="w-full p-4 bg-rose-50/30 rounded-xl font-bold text-sm text-right outline-none focus:ring-1 focus:ring-rose-200" value={membershipForm.phone} onChange={e=>setMembershipForm({...membershipForm, phone: e.target.value})}/>
                          <div className="flex items-center gap-3">
                             <input id="terms" type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="w-5 h-5 text-purple-600 rounded" />
                             <label htmlFor="terms" className="text-xs font-bold text-slate-600">אני מאשרת את התקנון</label>
                          </div>
                          <button type="submit" className="w-full py-4 bg-rose-500 text-white rounded-xl font-black text-sm shadow-xl active:scale-95">שליחת בקשה</button>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {/* 4. מודל תקנון */}
      {showTermsModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in text-right">
           <div className="bg-white rounded-[2rem] w-full max-w-2xl p-8 shadow-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-800">תקנון ומדיניות</h3>
                <button onClick={() => setShowTermsModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">כאן מופיע התקנון המלא של האתר...</p>
              <button onClick={() => setShowTermsModal(false)} className="w-full mt-8 py-3 bg-slate-900 text-white font-black rounded-xl">סגירה</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;