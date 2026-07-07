import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, Plus, Users, Calendar, Gift, Search, Trash2, Edit, Save, 
  X, Image as ImageIcon, BookOpen, Settings, Award, Sparkles, MessageSquare, 
  Link as LinkIcon, CheckCircle, Clock, Phone, MapPin, HeartHandshake, ChevronLeft, 
  GraduationCap, Copy, Eye, ListPlus, BarChart3, PieChart, TrendingUp, Users2,
  Quote, Megaphone, Video, PlayCircle, Trophy, Hash, Bell, ClipboardList, Target, ArrowUpRight, Activity, CalendarClock, Send, Loader2, Download, ChevronRight,
  Mail, Ticket as TicketIcon, Scan // נוספו אייקונים לכרטיסים וסורק
} from 'lucide-react';
import { User, EventItem, LotteryItem, ClassItem, PersonalityProfile, CommunityItem } from '../types';
import { api } from '../services/api';

// קומפוננטת מודאל פנימית
const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm animate-fade-in text-right" dir="rtl" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl w-full max-w-lg shadow-2xl animate-slide-up relative overflow-hidden flex flex-col max-h-[88vh] border-t-4 border-[#2D6A4F]">
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-2.5 mb-1 shrink-0"></div>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h3 className="text-xl font-black text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto no-scrollbar flex-1">{children}</div>
      </div>
    </div>
  );
};

// קומפוננטת כרטיס סטטיסטיקה משודרגת
const StatCard = ({ title, value, icon: Icon, color, trend }: { title: string, value: number | string, icon: any, color: string, trend?: string }) => (
  <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 group">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-4 rounded-2xl ${color} text-white shadow-lg`}>
        <Icon size={24} />
      </div>
      {trend && (
        <span className="flex items-center gap-1 text-emerald-50 text-xs font-black bg-emerald-50 px-3 py-1 rounded-full">
          {trend} <ArrowUpRight size={14} />
        </span>
      )}
    </div>
    <div className="text-right">
      <p className="text-slate-500 text-sm font-bold mb-1">{title}</p>
      <h4 className="text-3xl font-black text-slate-800 tracking-tighter">{value}</h4>
    </div>
  </div>
);

const AdminPage: React.FC<{ user: User | null, onLogin: (user: User) => void }> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'approvals' | 'stories' | 'users' | 'events' | 'classes' | 'lotteries' | 'zodiacWheel' | 'community' | 'personality' | 'settings' | 'forum' | 'inspirations' | 'ads' | 'announcements' | 'broadcast' | 'messages' | 'tickets'>('summary');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination states (20 items per page)
  const ITEMS_PER_PAGE = 20;
  const [usersPage, setUsersPage] = useState(1);
  const [eventsPage, setEventsPage] = useState(1);
  const [classesPage, setClassesPage] = useState(1);
  
  // תאריך לצורך סיכום חודשי
  const [viewDate, setViewDate] = useState(new Date());

  // Data States
  const [apiUsers, setApiUsers] = useState<User[]>([]);
  const [apiEvents, setApiEvents] = useState<EventItem[]>([]);
  const [apiClasses, setApiClasses] = useState<ClassItem[]>([]);
  const [apiLotteries, setApiLotteries] = useState<LotteryItem[]>([]);
  const [communityItems, setCommunityItems] = useState<CommunityItem[]>([]);
  const [pendingData, setPendingData] = useState<{pendingUsers: User[], pendingPosts: any[]}>({pendingUsers: [], pendingPosts: []});
  const [forumPosts, setForumPosts] = useState<any[]>([]); 
  const [apiInspirations, setApiInspirations] = useState<any[]>([]);
  const [apiAds, setApiAds] = useState<any[]>([]);
  const [apiAnnouncements, setApiAnnouncements] = useState<any[]>([]); 
  const [allInterviews, setAllInterviews] = useState<PersonalityProfile[]>([]); 
  const [contactMessages, setContactMessages] = useState<any[]>([]); 
  const [apiTickets, setApiTickets] = useState<any[]>([]); 
  
  // --- מדינות הסטוריז החדשים ---
  const [pendingStories, setPendingStories] = useState<any[]>([]);
  const [activeStories, setActiveStories] = useState<any[]>([]); // הוספנו סטייט לסטוריז פעילים

  // Form States
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventForm, setEventForm] = useState<Partial<EventItem & { notes?: string, targetAges?: string, hebrewDate?: string, ticketLink?: string, logo?: string, time?: string }>>({ 
    title: '', location: '', category: 'מוזיקה', image: '', date: '', time: '', isHero: false, 
    price: 0, earlyBirdPrice: 0, earlyBirdEndDate: '', sessions: [], notes: '', targetAges: '',
    hebrewDate: '', ticketLink: '', logo: ''
  });

  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [classForm, setClassForm] = useState<Partial<ClassItem>>({ 
    title: '', instructor: '', contactPhone: '', registrationPhone: '', day: 'ראשון', 
    time: '', location: '', price: 0, ageGroup: '', gender: 'נשים', image: ''  
  });

  const [isLotteryModalOpen, setIsLotteryModalOpen] = useState(false);
  const [lotteryForm, setLotteryForm] = useState<Partial<any>>({ 
    title: '', prize: '', prize2: '', prize3: '', prize4: '', prize5: '', prize6: '', prize7: '', drawDate: '', image: '', 
    minPointsToEnter: 0, participationType: 'everyone', missionText: '' 
  });

  // Shabbat Lottery Form State
  const [shabbatLotteryForm, setShabbatLotteryForm] = useState({
    prize: '',
    notes: '',
    isActive: true,
    winnerFamily: ''
  });

  const [shabbatParticipants, setShabbatParticipants] = useState<any[]>([]);
  const [zodiacPrizes, setZodiacPrizes] = useState<any[]>([]);
  const [zodiacPrizeForm, setZodiacPrizeForm] = useState({ _id: '', title: '', description: '', stock: 0, dailyWinners: 1, isActive: true });
  const [zodiacStats, setZodiacStats] = useState<{ totalSpins: number; totalDailyWinners: number; todayWinners: number; winners: any[] }>({ totalSpins: 0, totalDailyWinners: 0, todayWinners: 0, winners: [] });

  const [isCommunityModalOpen, setIsCommunityModalOpen] = useState(false);
  const [communityForm, setCommunityForm] = useState<Partial<any>>({ 
    category: 'גמ"חים', title: '', phone: '', location: '', image: '', description: '',
    startTime: '', targetAudience: '', isPaid: false, price: 0  
  });

  const [isInspirationModalOpen, setIsInspirationModalOpen] = useState(false);
  const [inspirationForm, setInspirationForm] = useState({ _id: '', text: '', author: '', scheduledAt: '' });

  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [adForm, setAdForm] = useState({ _id: '', type: 'image', content: '', link: '', title: '' });

  const [isAnnModalOpen, setIsAnnModalOpen] = useState(false);
  const [annForm, setAnnForm] = useState({ _id: '', title: '', content: '' });

  const [personalityForm, setPersonalityForm] = useState<PersonalityProfile>({ id: '1', name: '', role: '', image: '', isActive: true, questions: [] });
  const [pendingInterviews, setPendingInterviews] = useState<PersonalityProfile[]>([]); 
  const [generatedLink, setGeneratedLink] = useState(''); 
  
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<PersonalityProfile | null>(null);

  // --- מדינות עריכת אשת השבוע לפני אישור ---
  const [isEditInterviewModalOpen, setIsEditInterviewModalOpen] = useState(false);
  const [editingInterview, setEditingInterview] = useState<PersonalityProfile | null>(null);

  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
  const [currentParticipants, setCurrentParticipants] = useState<any[]>([]);

  const [pointsSettings, setPointsSettings] = useState({ pointsPerRegister: 50, pointsPerEventJoin: 10, pointsPerShare: 5 });

  // Broadcast State
  const [broadcastForm, setBroadcastForm] = useState({ subject: '', content: '', image: '', logo: '' });
  const [testEmail, setTestEmail] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

  // Ticket Generator State
  const [ticketForm, setTicketForm] = useState({ eventId: '', backgroundImage: '' });
  const [isGeneratingTicket, setIsGeneratingTicket] = useState(false);

  // חישוב נתונים אמיתיים לסיכום חודשי - מעודכן לכלול את הסטוריז
  const monthlyStats = useMemo(() => {
    const month = viewDate.getMonth();
    const year = viewDate.getFullYear();

    const filteredUsers = apiUsers.filter(u => {
        const d = new Date(u.createdAt || Date.now());
        return d.getMonth() === month && d.getFullYear() === year;
    });

    const filteredEvents = apiEvents.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === month && d.getFullYear() === year;
    });

    // סינון הסטוריז הפעילים לפי חודש (לרוב כולם מהיום האחרון, אבל שומר על לוגיקה זהה)
    const filteredStories = activeStories.filter(s => {
        const d = new Date(s.createdAt || Date.now());
        return d.getMonth() === month && d.getFullYear() === year;
    });

    const totalPoints = apiUsers.reduce((acc, u) => acc + (u.points || 0), 0);
    const storiesViews = filteredStories.reduce((acc, s) => acc + (s.views || 0), 0);

    return {
        usersCount: filteredUsers.length,
        eventsCount: filteredEvents.length,
        points: totalPoints,
        monthName: viewDate.toLocaleString('he-IL', { month: 'long' }),
        year: year,
        storiesCount: filteredStories.length,
        storiesViews: storiesViews
    };
  }, [apiUsers, apiEvents, activeStories, viewDate]);

  useEffect(() => { if (user?.isAdmin) loadTabData(); }, [activeTab, user]);

  const loadTabData = async () => {
    setLoading(true);
    try {
        const users = await fetch('https://nashi-production.up.railway.app/api/users', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json());
        setApiUsers(Array.isArray(users) ? users : []);
        
        const approvals = await api.getAdminApprovals();
        setPendingData(approvals || {pendingUsers: [], pendingPosts: []});
        
        const community = await api.getCommunityItems();
        setCommunityItems(community || []);

        const events = await api.getEvents();
        setApiEvents(events || []);

        const classes = await api.getClasses();
        setApiClasses(classes || []);

        const lotteries = await api.getLotteries();
        setApiLotteries(lotteries || []);

        // שאיבת הסטוריז הפעילים באופן גלובלי כדי שיופיעו בסיכום החודשי תמיד
        const activeSt = await api.getActiveStoriesAdmin().catch(() => []);
        setActiveStories(activeSt || []);

        // טעינת הגדרות ומשתתפות שולחן שבת כשהטאב פעיל
        if (activeTab === 'lotteries') {
            const shabbatSettings = await api.getShabbatLotterySettings();
            if(shabbatSettings) setShabbatLotteryForm(shabbatSettings);
            
            const entries = await api.getShabbatEntries();
            if(entries) setShabbatParticipants(entries);
        }

        if (activeTab === 'zodiacWheel') {
            const [zodiacItems, zodiacStatsData] = await Promise.all([
                api.getAdminZodiacWheelPrizes().catch(() => []),
                api.getAdminZodiacWheelStats().catch(() => ({ totalSpins: 0, totalDailyWinners: 0, todayWinners: 0, winners: [] }))
            ]);
            setZodiacPrizes(Array.isArray(zodiacItems) ? zodiacItems : []);
            setZodiacStats({
                totalSpins: Number(zodiacStatsData?.totalSpins) || 0,
                totalDailyWinners: Number(zodiacStatsData?.totalDailyWinners) || 0,
                todayWinners: Number(zodiacStatsData?.todayWinners) || 0,
                winners: Array.isArray(zodiacStatsData?.winners) ? zodiacStatsData.winners : []
            });
        }

        if (activeTab === 'personality') {
            const template = await api.getPersonalityTemplate();
            if(template) setPersonalityForm(template);
            setPendingInterviews(await api.getPendingInterviews() || []); 
            setAllInterviews(await api.getAllPersonalities() || []);
        }
        else if (activeTab === 'settings') {
            const settings = await api.getSettings();
            if(settings) setPointsSettings(settings);
        }
        else if (activeTab === 'forum') {
            const allPosts = await api.getForumPosts(); 
            setForumPosts(allPosts || []);
        }
        else if (activeTab === 'inspirations') {
            const insp = await api.getInspirations();
            setApiInspirations(insp || []);
        }
        else if (activeTab === 'ads') {
            const ads = await api.getAds();
            setApiAds(ads || []);
        }
        else if (activeTab === 'announcements') {
            const anns = await api.getAnnouncements();
            setApiAnnouncements(anns || []);
        }
        else if (activeTab === 'messages') {
            const msgs = await api.getContactMessages();
            setContactMessages(msgs || []);
        }
        else if (activeTab === 'tickets') {
            const tkts = await api.getTickets();
            setApiTickets(tkts || []);
        }
        else if (activeTab === 'stories') { // טעינת סטוריז ממתינים לאישור
            const stories = await api.getPendingStories();
            setPendingStories(stories || []);
        }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: Function, fieldName: string = 'image') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200; 
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8); 
          setter((prev: any) => ({ ...prev, [fieldName]: dataUrl, content: (activeTab === 'ads' && fieldName === 'image') ? dataUrl : prev.content }));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDelete = async (id: string, type: 'user' | 'event' | 'class' | 'lottery' | 'community' | 'post' | 'inspiration' | 'ad' | 'personality' | 'announcement' | 'message' | 'ticket', name: string) => {
    if (!id) return alert('שגיאה: מזהה חסר');
    if (window.confirm(`למחוק את ${name} לצמיתות?`)) {
      try {
        if (type === 'user') await fetch(`https://nashi-production.up.railway.app/api/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        else if (type === 'event') await api.deleteEvent(id);
        else if (type === 'class') await api.deleteClass(id);
        else if (type === 'lottery') await api.deleteLottery(id);
        else if (type === 'community') await api.deleteCommunityItem(id);
        else if (type === 'post') await api.deletePost(id); 
        else if (type === 'inspiration') await api.deleteInspiration(id);
        else if (type === 'ad') await api.deleteAd(id);
        else if (type === 'personality') await api.deletePersonality(id);
        else if (type === 'announcement') await api.deleteAnnouncement(id);
        else if (type === 'message') await api.deleteContactMessage(id); 
        else if (type === 'ticket') await api.deleteTicket(id); 
        loadTabData();
      } catch (err) { alert('שגיאה במחיקה'); }
    }
  };

  const handleGenerateTicket = async () => {
    if (!ticketForm.eventId || !ticketForm.backgroundImage) {
        return alert("נא לבחור אירוע ולהעלות תמונת רקע לכרטיס.");
    }
    
    setIsGeneratingTicket(true);
    try {
        const code = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const verifyUrl = `${window.location.origin}/#/verify/${code}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(verifyUrl)}&margin=0`;

        const bgImg = new Image();
        bgImg.crossOrigin = "anonymous";
        bgImg.src = ticketForm.backgroundImage;
        await new Promise((resolve) => { bgImg.onload = resolve; });

        const qrImg = new Image();
        qrImg.crossOrigin = "anonymous";
        qrImg.src = qrUrl;
        await new Promise((resolve) => { qrImg.onload = resolve; });

        const canvas = document.createElement('canvas');
        canvas.width = bgImg.width;
        canvas.height = bgImg.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) throw new Error("Canvas context is not supported");

        // 1. צייר את הרקע
        ctx.drawImage(bgImg, 0, 0);
        
        // 2. צייר את ה-QR למטה בצד שמאל
        const qrSize = Math.floor(canvas.width * 0.20); 
        const padding = 30;
        
        // רקע לבן קטן מאחורי הברקוד
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.roundRect(padding - 10, canvas.height - qrSize - padding - 10, qrSize + 20, qrSize + 20, 15);
        ctx.fill();

        // הדבקת הברקוד
        ctx.drawImage(qrImg, padding, canvas.height - qrSize - padding, qrSize, qrSize);

        const finalImageBase64 = canvas.toDataURL('image/jpeg', 0.9);

        // שמירה במסד הנתונים
        await api.createTicket({ eventId: ticketForm.eventId, code, image: finalImageBase64 });
        alert("הכרטיס נוצר בהצלחה! אפשר להוריד ולשלוח אותו ללקוחה.");
        setTicketForm({ eventId: '', backgroundImage: '' });
        loadTabData();
        
    } catch (error) {
        console.error(error);
        alert("הייתה שגיאה ביצירת הכרטיס. נסה שוב.");
    } finally {
        setIsGeneratingTicket(false);
    }
  };

  const addEventSession = () => {
    setEventForm(prev => ({
      ...prev,
      sessions: [...(prev.sessions || []), { name: '', date: '' }]
    }));
  };

  const updateEventSession = (index: number, field: 'name' | 'date', value: string) => {
    const newSessions = [...(eventForm.sessions || [])];
    newSessions[index] = { ...newSessions[index], [field]: value };
    setEventForm({ ...eventForm, sessions: newSessions });
  };

  const addQuestion = () => setPersonalityForm(p => ({ ...p, questions: [...(p.questions || []), { question: '', answer: '' }] }));
  const updateQuestion = (i: number, f: 'question' | 'answer', v: string) => {
    const qs = [...(personalityForm.questions || [])];
    if (qs[i]) {
      qs[i][f] = v;
      setPersonalityForm({ ...personalityForm, questions: qs });
    }
  };

  const runLiveLottery = async (lotteryId: string) => {
    if(window.confirm("להפעיל את ההגרלה בשידור חי?")) {
        alert("מפעיל רולטה... הזוכה תפורסם אוטומטית בדף הבית בסיום!");
        await api.runLotteryLive(lotteryId);
        loadTabData();
    }
  };

  const viewParticipants = async (lotteryId: string) => {
    const participants = await api.getLotteryParticipants(lotteryId);
    setCurrentParticipants(participants || []);
    setIsParticipantsModalOpen(true);
  };

  const sendPersonalBenefit = async (email: string) => {
      const res = await api.createGiftCode({ points: 100, maxUses: 1 });
      alert(`לינק הטבה נוצר: ${res.link}\nשלחי אותו למשתמשת!`);
  };

  const exportShabbatToExcel = () => {
      const headers = ["שם משפחה", "טלפון", "תאריך הרשמה"];
      const rows = shabbatParticipants.map(p => [
          p.familyName,
          p.phone,
          new Date(p.createdAt).toLocaleDateString('he-IL')
      ]);
      
      let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // תמיכה בעברית
      csvContent += headers.join(",") + "\n";
      rows.forEach(row => { csvContent += row.join(",") + "\n"; });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "shabbat_participants.csv");
      document.body.appendChild(link);
      link.click();
  };

  const exportUsersToExcel = () => {
      const headers = ["שם", "דוא\"ל", "טלפון", "נקודות", "סטטוס", "תאריך הרשמה"];
      const rows = apiUsers.map(u => [
          `"${u.name || ''}"`,
          `"${u.email || ''}"`,
          `"${u.phone || ''}"`,
          u.points || 0,
          u.isMemberApproved ? "חברת מעגל" : "רשומה",
          u.createdAt ? new Date(u.createdAt).toLocaleDateString('he-IL') : ''
      ]);

      let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // BOM לשמירה על תצוגת עברית תקינה באקסל
      csvContent += headers.join(",") + "\n";
      rows.forEach(row => { csvContent += row.join(",") + "\n"; });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "registered_users.csv");
      document.body.appendChild(link);
      link.click();
  };

  const refreshZodiacWheelAdminData = async () => {
      const [updatedPrizes, stats] = await Promise.all([
          api.getAdminZodiacWheelPrizes().catch(() => []),
          api.getAdminZodiacWheelStats().catch(() => ({ totalSpins: 0, totalDailyWinners: 0, todayWinners: 0, winners: [] }))
      ]);
      setZodiacPrizes(Array.isArray(updatedPrizes) ? updatedPrizes : []);
      setZodiacStats({
          totalSpins: Number(stats?.totalSpins) || 0,
          totalDailyWinners: Number(stats?.totalDailyWinners) || 0,
          todayWinners: Number(stats?.todayWinners) || 0,
          winners: Array.isArray(stats?.winners) ? stats.winners : []
      });
  };

  const saveZodiacPrize = async () => {
      if (!zodiacPrizeForm.title.trim()) return alert('חובה להזין שם הטבה');
      const payload = {
          title: zodiacPrizeForm.title.trim(),
          description: zodiacPrizeForm.description.trim(),
          stock: Math.max(0, Number(zodiacPrizeForm.stock) || 0),
          dailyWinners: Math.max(0, Math.floor(Number(zodiacPrizeForm.dailyWinners) || 0)),
          isActive: zodiacPrizeForm.isActive
      };

      try {
          if (zodiacPrizeForm._id) {
              await api.updateZodiacWheelPrize(zodiacPrizeForm._id, payload);
          } else {
              await api.createZodiacWheelPrize(payload);
          }
          setZodiacPrizeForm({ _id: '', title: '', description: '', stock: 0, dailyWinners: 1, isActive: true });
          await refreshZodiacWheelAdminData();
      } catch (e) {
          alert('שגיאה בשמירת ההטבה');
      }
  };

  const deleteZodiacPrize = async (id: string) => {
      if (!window.confirm('למחוק את ההטבה מהגלגל?')) return;
      try {
          await api.deleteZodiacWheelPrize(id);
          await refreshZodiacWheelAdminData();
      } catch (e) {
          alert('שגיאה במחיקת ההטבה');
      }
  };

  const deleteAllZodiacPrizes = async () => {
      if (!window.confirm('למחוק את כל ההטבות הקיימות בגלגל? פעולה זו אינה הפיכה.')) return;
      try {
          await api.deleteAllZodiacWheelPrizes();
          setZodiacPrizeForm({ _id: '', title: '', description: '', stock: 0, dailyWinners: 1, isActive: true });
          await refreshZodiacWheelAdminData();
      } catch (e) {
          alert('שגיאה במחיקת כל ההטבות');
      }
  };

  // Broadcast Email Logic
  const handleSendBroadcast = async () => {
    if (!broadcastForm.subject || !broadcastForm.content) return alert("נא למלא נושא ותוכן להודעה");
    if (!window.confirm(`האם את בטוחה שברצונך לשלוח את המייל לכל ${apiUsers.length} המשתמשות הרשומות?`)) return;

    setIsSendingBroadcast(true);
    try {
      const res = await fetch('https://nashi-production.up.railway.app/api/admin/broadcast-email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          subject: broadcastForm.subject, 
          content: broadcastForm.content,
          image: broadcastForm.image,
          logo: broadcastForm.logo,
          isAdmin: user?.isAdmin 
        })
      });
      
      if (res.ok) {
        alert("התפוצה נשלחה בהצלחה לכל המשתמשות!");
        setBroadcastForm({ subject: '', content: '', image: '', logo: '' });
      } else {
        const err = await res.json();
        alert("שגיאה בשליחה: " + (err.error || "נסי שוב מאוחר יותר"));
      }
    } catch (err) {
      alert("שגיאה בתקשורת עם השרת");
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  // Test Email Logic
  const handleSendTest = async () => {
    if (!broadcastForm.subject || !broadcastForm.content) return alert("נא למלא נושא ותוכן להודעה");
    if (!testEmail) return alert("נא להזין כתובת מייל למשלוח הניסיון");

    setIsSendingBroadcast(true);
    try {
      const res = await fetch('https://nashi-production.up.railway.app/api/admin/broadcast-email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          subject: broadcastForm.subject, 
          content: broadcastForm.content,
          image: broadcastForm.image,
          logo: broadcastForm.logo,
          isAdmin: user?.isAdmin,
          isTest: true,
          targetEmail: testEmail
        })
      });
      
      if (res.ok) {
        alert("הודעת הניסיון נשלחה בהצלחה ל-" + testEmail);
      } else {
        const err = await res.json();
        alert("שגיאה בשליחת הניסיון: " + (err.error || "נסי שוב"));
      }
    } catch (err) {
      alert("שגיאה בתקשורת עם השרת");
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  if (!user || !user.isAdmin) return <div className="p-20 text-center font-black text-rose-500 text-2xl animate-fade-in">גישה למנהלות בלבד.</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 pt-6 px-4 md:px-8 space-y-8 overflow-x-hidden text-right" dir="rtl">
      
      {/* תפריט טאבים רספונסיבי - משופר */}
      <div className="max-w-7xl mx-auto flex overflow-x-auto md:flex-wrap no-scrollbar gap-2 bg-white p-2 rounded-[2.5rem] shadow-sm border border-slate-100 justify-start md:justify-center">
        {[
            { id: 'summary', label: 'סיכום חודשי', icon: <BarChart3 size={16} /> },
            { id: 'approvals', label: 'אישורים', icon: <CheckCircle size={16} /> },
            { id: 'stories', label: 'סטוריז', icon: <PlayCircle size={16} /> }, // טאב חדש לסטוריז!
            { id: 'tickets', label: 'כרטיסים חכמים', icon: <TicketIcon size={16} /> },
            { id: 'messages', label: 'הודעות משתמשות', icon: <Mail size={16} /> },
            { id: 'broadcast', label: 'שליחת תפוצה', icon: <Send size={16} /> },
            { id: 'announcements', label: 'הודעות הנהלה', icon: <Bell size={16} /> },
            { id: 'users', label: 'משתמשים', icon: <Users size={16} /> },
            { id: 'events', label: 'אירועים', icon: <Calendar size={16} /> },
            { id: 'classes', label: 'חוגים', icon: <GraduationCap size={16} /> },
            { id: 'lotteries', label: 'הגרלות', icon: <Gift size={16} /> },
            { id: 'zodiacWheel', label: 'גלגל המזלות', icon: <Sparkles size={16} /> },
            { id: 'community', label: 'קהילה', icon: <HeartHandshake size={16} /> },
            { id: 'forum', label: 'פורום נשי', icon: <MessageSquare size={16} /> },
            { id: 'inspirations', label: 'השראה יומית', icon: <Quote size={16} /> },
            { id: 'ads', label: 'פרסומים', icon: <Megaphone size={16} /> },
            { id: 'personality', label: 'אשת השבוע', icon: <Sparkles size={16} /> },
            { id: 'settings', label: 'הגדרות', icon: <Settings size={16} /> },
        ].map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setSearchTerm(''); setUsersPage(1); setEventsPage(1); setClassesPage(1); }} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg scale-105' : 'hover:bg-slate-50 text-slate-500'}`}>
              {tab.icon} {tab.label}
              {tab.id === 'stories' && pendingStories.length > 0 && <span className="bg-rose-500 text-white text-[10px] px-1.5 rounded-full">{pendingStories.length}</span>}
            </button>
        ))}
      </div>

      {/* שורת חיפוש */}
      {(activeTab === 'users' || activeTab === 'events' || activeTab === 'community') && (
        <div className="max-w-md mx-auto relative animate-fade-in">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="חיפוש חופשי..." 
            className="w-full pr-12 pl-4 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-rose-200 text-right"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setUsersPage(1); }}
          />
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        
        {/* טאב ניהול סטוריז - חדש! */}
        {activeTab === 'stories' && (
          <div className="space-y-12 animate-fade-in">
            {/* אזור סטוריז ממתינים */}
            <div>
                <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 mb-6">
                   <h3 className="text-xl font-black flex items-center gap-2"><PlayCircle className="text-rose-500" /> סטוריז הממתינים לאישור</h3>
                   <span className="bg-slate-100 px-4 py-1 rounded-full text-xs font-bold text-slate-500">{pendingStories.length} סטוריז ממתינים</span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {pendingStories.map(story => (
                     <div key={story._id} className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                           <img src={story.user?.avatar} className="w-10 h-10 rounded-full border border-slate-100 object-cover" />
                           <div className="flex-1 overflow-hidden">
                              <p className="text-sm font-bold text-slate-800 truncate">{story.user?.name}</p>
                              <p className="text-[10px] text-slate-400">{new Date(story.createdAt).toLocaleString('he-IL')}</p>
                           </div>
                        </div>
                        
                        <div className="h-56 rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center relative shadow-inner">
                           {story.type === 'image' ? (
                              <img src={story.content} className="w-full h-full object-cover hover:object-contain transition-all" />
                           ) : (
                              <div className="w-full h-full bg-gradient-to-br from-rose-500 via-purple-600 to-indigo-700 p-4 flex items-center justify-center text-center">
                                 <p className="text-white font-black text-sm drop-shadow-md">{story.content}</p>
                              </div>
                           )}
                        </div>
                        
                        <div className="flex gap-2 mt-auto">
                           <button onClick={async () => { await api.approveStory(story._id); loadTabData(); }} className="flex-1 bg-emerald-500 text-white py-3 rounded-xl text-xs font-black flex justify-center items-center gap-1 hover:bg-emerald-600 transition-colors">
                              <CheckCircle size={16}/> פרסום
                           </button>
                           <button onClick={async () => { await api.deleteStory(story._id); loadTabData(); }} className="flex-1 bg-red-100 text-red-500 py-3 rounded-xl text-xs font-black flex justify-center items-center gap-1 hover:bg-red-200 transition-colors">
                              <Trash2 size={16}/> מחיקה
                           </button>
                        </div>
                     </div>
                  ))}
                  
                  {pendingStories.length === 0 && (
                     <div className="col-span-full text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200 text-slate-400 font-bold">
                        אין סטוריז הממתינים לאישור כרגע. בנות יעלו וזה יופיע כאן!
                     </div>
                  )}
                </div>
            </div>

            {/* אזור סטוריז פעילים באוויר למנהלת */}
            <div className="pt-6 border-t border-slate-200">
               <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 mb-6">
                  <h3 className="text-xl font-black flex items-center gap-2"><Eye className="text-emerald-500" /> סטוריז פעילים כרגע באוויר</h3>
                  <span className="bg-slate-100 px-4 py-1 rounded-full text-xs font-bold text-slate-500">{activeStories.length} סטוריז</span>
               </div>
               
               <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                 {activeStories.map(story => (
                    <div key={story._id} className="bg-white p-4 rounded-[2rem] shadow-sm border border-emerald-100 flex flex-col gap-4 relative hover:shadow-md transition-shadow">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 overflow-hidden">
                             <img src={story.user?.avatar} className="w-8 h-8 rounded-full border border-slate-100 object-cover shrink-0" />
                             <p className="text-xs font-bold text-slate-800 truncate max-w-[80px]">{story.user?.name}</p>
                          </div>
                          {/* תצוגת הצפיות! */}
                          <div className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg flex items-center gap-1 text-[10px] font-black shadow-sm shrink-0">
                              <Eye size={12}/> {story.views || 0}
                          </div>
                       </div>
                       
                       <div className="h-40 rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center relative shadow-inner">
                          {story.type === 'image' ? (
                             <img src={story.content} className="w-full h-full object-cover hover:object-contain transition-all" />
                          ) : (
                             <div className="w-full h-full bg-gradient-to-br from-rose-500 to-indigo-700 p-2 flex items-center justify-center text-center">
                                <p className="text-white font-black text-xs drop-shadow-md">{story.content}</p>
                             </div>
                          )}
                       </div>
                       
                       <button onClick={async () => { 
                           if(window.confirm('למחוק את הסטורי הזה מהאוויר?')) {
                               await api.deleteStory(story._id); 
                               loadTabData(); 
                           }
                       }} className="w-full bg-red-50 text-red-500 py-2 rounded-xl text-xs font-black flex justify-center items-center gap-1 hover:bg-red-100 transition-colors mt-auto">
                          <Trash2 size={14}/> הסרה מהאוויר
                       </button>
                    </div>
                 ))}
                 {activeStories.length === 0 && (
                     <div className="col-span-full text-center py-10 bg-white rounded-[2rem] border border-dashed border-slate-200 text-slate-400 font-bold">
                        אין סטוריז פעילים כרגע.
                     </div>
                 )}
               </div>
            </div>
          </div>
        )}

        {/* טאב מחולל כרטיסים חכמים */}
        {activeTab === 'tickets' && (
          <div className="space-y-8 animate-fade-in text-right">
              <div className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl border border-indigo-50">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-6 mb-6">
                      <h3 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                         <Scan className="text-indigo-500" size={32} /> מחולל כרטיסים חכמים
                      </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                     <div className="space-y-6">
                        <div className="space-y-2">
                           <label className="text-sm font-black text-slate-500 pr-2">לאיזה אירוע הכרטיס שייך?</label>
                           <select 
                             className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                             value={ticketForm.eventId}
                             onChange={e => setTicketForm({...ticketForm, eventId: e.target.value})}
                           >
                              <option value="">בחרי אירוע מהרשימה...</option>
                              {apiEvents.map(ev => (
                                 <option key={ev._id || ev.id} value={ev._id || ev.id}>{ev.title}</option>
                              ))}
                           </select>
                        </div>

                        <div className="space-y-2">
                           <label className="text-sm font-black text-slate-500 pr-2">העלאת עיצוב / רקע לכרטיס (ה-QR יודבק אוטומטית)</label>
                           <div className="relative border-2 border-dashed border-indigo-200 bg-indigo-50/30 p-8 text-center rounded-[2rem] hover:bg-indigo-50 transition-colors">
                              <input type="file" onChange={e => handleFileUpload(e, setTicketForm, 'backgroundImage')} className="absolute inset-0 opacity-0 cursor-pointer" />
                              {ticketForm.backgroundImage ? (
                                 <img src={ticketForm.backgroundImage} className="max-h-32 mx-auto rounded-xl shadow-sm" alt="Ticket Background" />
                              ) : (
                                 <div className="flex flex-col items-center gap-2 text-indigo-400">
                                    <ImageIcon size={32}/> 
                                    <span className="text-xs font-bold">לחצי כאן כדי להעלות תמונה (מומלץ בפורמט מלבני)</span>
                                 </div>
                              )}
                           </div>
                        </div>

                        <button 
                           onClick={handleGenerateTicket}
                           disabled={isGeneratingTicket}
                           className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black shadow-lg hover:bg-indigo-700 transition-all flex justify-center items-center gap-2 disabled:bg-slate-300"
                        >
                           {isGeneratingTicket ? <><Loader2 className="animate-spin" size={20} /> מייצר כרטיס וברקוד...</> : <><TicketIcon size={20} /> צרי כרטיס עכשיו</>}
                        </button>
                     </div>

                     <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                        <h4 className="font-black text-lg text-slate-700 mb-4 flex items-center gap-2"><ShieldCheck className="text-emerald-500" /> איך זה עובד?</h4>
                        <ol className="list-decimal list-inside space-y-3 text-sm text-slate-600 font-medium leading-relaxed">
                           <li>את מעצבת כרטיס יפה (ללא ברקוד) ומעלה לכאן.</li>
                           <li>המערכת שלנו מייצרת קוד מאובטח ייחודי שאי אפשר לנחש.</li>
                           <li>היא יוצרת מהקוד תמונת QR Code ומדביקה אותה על העיצוב שלך!</li>
                           <li>את שומרת את התמונה ושולחת למי שרכשה או קיבלה.</li>
                           <li>ביום האירוע, הסדרנית סורקת את הברקוד. המסך יראה ירוק ויאשר כניסה.</li>
                           <li>אם מישהי תנסה לשכפל ולהיכנס שוב - המסך יהיה אדום!</li>
                        </ol>
                     </div>
                  </div>
              </div>

              <div className="space-y-4">
                 <h3 className="font-black text-xl text-slate-800">כרטיסים שהופקו לאחרונה</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {apiTickets.map((ticket) => (
                       <div key={ticket._id} className="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm relative group overflow-hidden">
                          <img src={ticket.image} className="w-full h-auto rounded-[1.5rem] object-contain bg-slate-50" alt="Generated Ticket" />
                          <div className="absolute top-6 right-6 flex gap-2">
                             <span className={`px-3 py-1 rounded-full text-[10px] font-black shadow-sm ${ticket.isUsed ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                {ticket.isUsed ? 'נוצל' : 'בתוקף'}
                             </span>
                          </div>
                          <div className="mt-4 px-2">
                             <p className="text-xs text-slate-400 font-bold mb-1">שייך לאירוע: {ticket.eventId?.title || 'אירוע נמחק'}</p>
                             <div className="flex items-center justify-between">
                                <a href={ticket.image} download={`ticket-${ticket.code}.jpg`} className="text-indigo-500 bg-indigo-50 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1">
                                   <Download size={14}/> הורדת כרטיס
                                </a>
                                <button onClick={() => handleDelete(ticket._id, 'ticket', 'הכרטיס הזה')} className="p-2 text-red-400 hover:bg-red-50 rounded-xl">
                                   <Trash2 size={16}/>
                                </button>
                             </div>
                             {ticket.isUsed && ticket.usedAt && (
                                <p className="text-[10px] text-red-500 mt-3 font-bold">נוצל בתאריך: {new Date(ticket.usedAt).toLocaleString('he-IL')}</p>
                             )}
                          </div>
                       </div>
                    ))}
                    {apiTickets.length === 0 && <p className="text-slate-400 font-medium md:col-span-3">עדיין לא יצרת כרטיסים.</p>}
                 </div>
              </div>
          </div>
        )}

        {/* טאב סיכום חודשי משודרג עם ניווט */}
        {activeTab === 'summary' && (
          <div className="space-y-10 animate-fade-in">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-gradient-to-l from-slate-900 to-slate-800 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10 text-center md:text-right">
                  <div className="flex items-center gap-4 mb-4 justify-center md:justify-start">
                    <button onClick={() => setViewDate(prev => { const d = new Date(prev); d.setMonth(d.getMonth() - 1); return d; })} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ChevronRight size={30}/></button>
                    <h2 className="text-4xl font-black">{monthlyStats.monthName} {monthlyStats.year} 💫</h2>
                    <button onClick={() => setViewDate(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + 1); return d; })} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft size={30}/></button>
                  </div>
                  <p className="opacity-70 font-bold">הנתונים המוצגים מחושבים לפי החודש הנבחר.</p>
                </div>
                <div className="flex gap-4 relative z-10">
                   <div className="bg-white/10 backdrop-blur-md p-4 rounded-3xl border border-white/20">
                     <p className="text-[10px] uppercase font-black opacity-60">משתמשות חדשות</p>
                     <p className="text-2xl font-black">+{monthlyStats.usersCount}</p>
                   </div>
                   <div className="bg-rose-500 p-4 rounded-3xl shadow-lg border border-rose-400">
                     <p className="text-[10px] uppercase font-black opacity-80">אירועי החודש</p>
                     <p className="text-2xl font-black">{monthlyStats.eventsCount}</p>
                   </div>
                </div>
                <Activity className="absolute left-[-20px] bottom-[-20px] text-white/5 w-64 h-64" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard title="סה״כ משתמשות רשומות" value={apiUsers.length} icon={Users2} color="bg-blue-500" trend={`${monthlyStats.usersCount > 0 ? '+' : ''}${monthlyStats.usersCount} החודש`} />
                <StatCard title="חוגים פעילים" value={apiClasses.length} icon={GraduationCap} color="bg-purple-500" />
                <StatCard title="אירועים בחודש זה" value={monthlyStats.eventsCount} icon={Calendar} color="bg-rose-500" />
                <StatCard title="סה״כ נקודות בקהילה" value={monthlyStats.points.toLocaleString()} icon={TrendingUp} color="bg-emerald-500" trend="צבירה כוללת" />
                {/* התוספות החדשות של הסטוריז */}
                <StatCard title="סטוריז באוויר (בחודש זה)" value={monthlyStats.storiesCount} icon={PlayCircle} color="bg-pink-500" trend="בזמן אמת" />
                <StatCard title="צפיות בסטוריז" value={monthlyStats.storiesViews.toLocaleString()} icon={Eye} color="bg-orange-500" trend="מעורבות גולשות" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                   <h3 className="text-xl font-black mb-6 flex items-center gap-2"><PieChart className="text-rose-500" /> התפלגות קהילה</h3>
                   <div className="space-y-4">
                      {['גמ"חים', 'שיעורי תורה', 'עסקים מקומיים'].map(cat => (
                        <div key={cat} className="flex justify-between items-center p-5 bg-slate-50 rounded-[2rem] hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-slate-100">
                           <span className="font-bold text-slate-700">{cat}</span>
                           <span className="bg-white px-5 py-2 rounded-full text-xs font-black shadow-sm">
                             {communityItems.filter(i => i.category === cat).length} פריטים פעילים
                           </span>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                   <h3 className="text-xl font-black mb-6 flex items-center gap-2"><ShieldCheck className="text-emerald-500" /> אבטחה וניהול מעגל</h3>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center p-5 bg-emerald-50 border border-emerald-100 rounded-[2rem]">
                         <span className="font-bold text-emerald-700 text-lg">חברות מעגל מאושרות</span>
                         <span className="font-black text-2xl text-emerald-900">{apiUsers.filter(u => u.isMemberApproved).length}</span>
                      </div>
                      <div className="flex justify-between items-center p-5 bg-orange-50 border border-orange-100 rounded-[2rem]">
                         <span className="font-bold text-orange-700 text-lg">ממתינות לאישור ידני</span>
                         <span className="font-black text-2xl text-orange-900">{(pendingData.pendingUsers || []).length}</span>
                      </div>
                   </div>
                </div>
              </div>
          </div>
        )}

        {/* טאב הודעות משתמשות */}
        {activeTab === 'messages' && (
          <div className="space-y-6 animate-fade-in text-right">
              <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                  <h3 className="text-xl font-black flex items-center gap-2"><Mail className="text-rose-500" /> פניות שהתקבלו מהאתר</h3>
                  <span className="bg-slate-100 px-4 py-1 rounded-full text-xs font-bold text-slate-500">{contactMessages.length} פניות סה"כ</span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                  {contactMessages.map((msg) => (
                      <div key={msg._id} className={`bg-white p-6 rounded-[2.5rem] shadow-sm border transition-all hover:shadow-md ${msg.isRead ? 'border-slate-100' : 'border-rose-200'}`}>
                          <div className="flex flex-col md:flex-row justify-between gap-4">
                              <div className="space-y-2 flex-1">
                                  <div className="flex items-center gap-3">
                                      <h4 className="font-black text-lg text-slate-800">{msg.name}</h4>
                                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md font-bold">{msg.subject}</span>
                                      {!msg.isRead && <span className="text-[10px] bg-rose-500 text-white px-2 py-1 rounded-md font-bold">חדש!</span>}
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-slate-400 font-bold">
                                      <span className="flex items-center gap-1"><Phone size={12}/> {msg.phone}</span>
                                      <span className="flex items-center gap-1"><Clock size={12}/> {new Date(msg.createdAt).toLocaleString('he-IL')}</span>
                                  </div>
                                  <div className="bg-slate-50 p-4 rounded-2xl text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                                      {msg.content || <span className="italic opacity-50">ללא תוכן טקסטואלי</span>}
                                  </div>
                              </div>

                              <div className="flex flex-col justify-between items-end gap-4 min-w-[200px]">
                                  {msg.audio && (
                                      <div className="w-full space-y-2">
                                          <p className="text-[10px] font-black text-slate-400">הודעה קולית:</p>
                                          <audio controls className="h-8 w-full">
                                              <source src={msg.audio} type="audio/webm" />
                                          </audio>
                                      </div>
                                  )}
                                  <div className="flex gap-2">
                                      {!msg.isRead && (
                                          <button 
                                              onClick={async () => { await api.markMessageAsRead(msg._id); loadTabData(); }}
                                              className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1"
                                          >
                                              <CheckCircle size={14}/> סמני כנקרא
                                          </button>
                                      )}
                                      <button 
                                          onClick={() => handleDelete(msg._id, 'message', `הפנייה של ${msg.name}`)}
                                          className="bg-red-50 text-red-500 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1"
                                      >
                                          <Trash2 size={14}/> מחקי
                                      </button>
                                  </div>
                              </div>
                          </div>
                      </div>
                  ))}
                  {contactMessages.length === 0 && (
                      <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200 text-slate-400 font-bold">
                          טרם התקבלו פניות מהאתר
                      </div>
                  )}
              </div>
          </div>
        )}

        {/* טאב שליחת תפוצה */}
        {activeTab === 'broadcast' && (
          <div className="max-w-3xl mx-auto space-y-8 animate-fade-in text-right">
            <div className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-rose-50 space-y-8">
              <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                  <Megaphone className="text-rose-500" size={32} /> שליחת הודעה לכל הקהילה
                </h3>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-500 pr-2">נושא המייל</label>
                  <input 
                    placeholder="נושא מרגש שיגרום להן לפתוח את המייל..." 
                    className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none focus:ring-2 focus:ring-rose-100" 
                    value={broadcastForm.subject} 
                    onChange={e => setBroadcastForm({...broadcastForm, subject: e.target.value})} 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-500 pr-2">תוכן ההודעה</label>
                  <textarea 
                    placeholder="כתבי כאן את התוכן המפורט... (אפשר להשתמש בירידת שורות)" 
                    className="w-full p-6 bg-slate-50 rounded-[2rem] font-bold text-right outline-none focus:ring-2 focus:ring-rose-100 min-h-[250px] leading-relaxed" 
                    value={broadcastForm.content} 
                    onChange={e => setBroadcastForm({...broadcastForm, content: e.target.value})} 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-sm font-black text-slate-500 pr-2">תמונה ראשית להודעה (אופציונלי)</label>
                      <div className="relative border-2 border-dashed p-6 text-center rounded-2xl">
                        <input type="file" onChange={e => handleFileUpload(e, setBroadcastForm, 'image')} className="absolute inset-0 opacity-0 cursor-pointer" />
                        {broadcastForm.image ? <img src={broadcastForm.image} className="h-24 mx-auto rounded-lg shadow-sm" /> : <div className="flex flex-col items-center gap-2 text-slate-400"><ImageIcon size={32}/> <span className="text-xs font-bold">לחצי להעלאת תמונה</span></div>}
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-sm font-black text-slate-500 pr-2">לוגו קטן למעלה (אופציונלי)</label>
                      <div className="relative border-2 border-dashed p-6 text-center rounded-2xl">
                        <input type="file" onChange={e => handleFileUpload(e, setBroadcastForm, 'logo')} className="absolute inset-0 opacity-0 cursor-pointer" />
                        {broadcastForm.logo ? <img src={broadcastForm.logo} className="h-24 mx-auto rounded-lg shadow-sm object-contain" /> : <div className="flex flex-col items-center gap-2 text-slate-400"><Sparkles size={32}/> <span className="text-xs font-bold">לחצי להעלאת לוגו</span></div>}
                      </div>
                   </div>
                </div>

                {/* שליחת ניסיון */}
                <div className="pt-6 border-t border-slate-100 flex flex-col md:flex-row gap-3 items-end">
                  <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 pr-2">מייל לבדיקה</label>
                    <input 
                      placeholder="מייל לניסיון..." 
                      className="w-full p-3 bg-slate-50 rounded-xl font-bold text-right outline-none border border-transparent focus:border-rose-100 text-sm" 
                      value={testEmail} 
                      onChange={e => setTestEmail(e.target.value)} 
                    />
                  </div>
                  <button 
                    onClick={handleSendTest}
                    disabled={isSendingBroadcast}
                    className="bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-black text-sm hover:bg-slate-200 transition-colors shrink-0"
                  >
                    שלחי הודעת ניסיון
                  </button>
                </div>

                <button 
                  onClick={handleSendBroadcast}
                  disabled={isSendingBroadcast}
                  className="w-full py-5 bg-rose-500 text-white rounded-[2rem] font-black shadow-xl hover:bg-rose-600 transition-all flex items-center justify-center gap-3 disabled:bg-slate-300"
                >
                  {isSendingBroadcast ? (
                    <><Loader2 className="animate-spin" /> שולח... </>
                  ) : (
                    <><Send size={24} /> שליחה מיידית לקהילת נשי</>
                  )}
                </button>
                <p className="text-center text-[10px] font-bold text-slate-400">המייל יישלח לכל הכתובות המופיעות בלשונית "משתמשים" דרך Resend.</p>
              </div>
            </div>
          </div>
        )}

        {/* טאב הודעות הנהלה */}
        {activeTab === 'announcements' && (
          <div className="space-y-6 animate-fade-in">
             <button onClick={() => { setAnnForm({ _id: '', title: '', content: '' }); setIsAnnModalOpen(true); }} className="w-full md:w-auto bg-slate-900 text-white px-8 py-3 rounded-2xl font-black flex items-center justify-center gap-2 hover:shadow-lg transition-all"><Bell size={20}/> הודעה חדשה</button>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {apiAnnouncements.map(ann => (
                  <div key={ann._id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between group">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                           <div className="p-3 bg-blue-50 text-blue-500 rounded-xl"><Megaphone size={20}/></div>
                           <div className="flex gap-1">
                             <button onClick={() => { setAnnForm(ann); setIsAnnModalOpen(true); }} className="text-blue-500 p-2 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={18}/></button>
                             <button onClick={() => handleDelete(ann._id, 'announcement', ann.title)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                           </div>
                        </div>
                        <h4 className="font-black text-lg mb-2 text-slate-800">{ann.title}</h4>
                        <p className="text-sm text-slate-500 line-clamp-4 leading-relaxed">{ann.content}</p>
                      </div>
                  </div>
                ))}
                {apiAnnouncements.length === 0 && (
                  <div className="col-span-full text-center py-10 text-slate-400 font-bold italic">אין הודעות הנהלה כרגע</div>
                )}
             </div>
          </div>
        )}

        {/* טאב אישורים */}
        {activeTab === 'approvals' && (
          <div className="grid grid-cols-1 gap-8 animate-fade-in max-w-2xl mx-auto">
            <div className="bg-white p-6 md:p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6 text-right">
               <h3 className="font-black text-xl flex items-center gap-2 text-right"><HeartHandshake className="text-rose-500"/> ממתינות למעגל</h3>
               <div className="space-y-4">
                 {(pendingData.pendingUsers || []).map(u => (
                   <div key={u._id || u.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center animate-fade-in-up shadow-sm">
                     <div className="overflow-hidden text-right"><p className="font-black truncate">{u.name}</p><p className="text-[10px] text-slate-400 truncate">{u.occupation} | {u.phone}</p></div>
                     <button onClick={async () => {
                        await api.approveMember(u._id || u.id);
                        alert(`אישרת את ${u.name} למעגל! כעת יופיעו לה הנקודות.`);
                        loadTabData();
                     }} className="bg-green-500 text-white p-2 rounded-xl shrink-0"><CheckCircle size={20}/></button>
                   </div>
                 ))}
                 {(pendingData.pendingUsers || []).length === 0 && <p className="text-center text-slate-400 italic">אין בקשות חדשות</p>}
               </div>
            </div>
          </div>
        )}

        {/* טאב פורום נשי */}
        {activeTab === 'forum' && (
          <div className="space-y-8 animate-fade-in">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                   <h3 className="font-black text-xl mb-6 flex items-center gap-2"><Clock className="text-orange-500"/> פוסטים הממתינים לאישור</h3>
                   <div className="space-y-4">
                      {(pendingData.pendingPosts || []).map(p => (
                        <div key={p._id} className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100 space-y-3">
                           <div className="flex justify-between items-start">
                              <h4 className="font-black text-slate-800">{p.title}</h4>
                              <div className="flex gap-2">
                                  <button onClick={() => api.approvePost(p._id).then(loadTabData)} className="p-2 bg-green-500 text-white rounded-lg"><CheckCircle size={16}/></button>
                                  <button onClick={() => handleDelete(p._id, 'post', p.title)} className="p-2 bg-red-100 text-red-500 rounded-lg"><Trash2 size={16}/></button>
                              </div>
                           </div>
                           <p className="text-sm text-slate-600 line-clamp-3">{p.content}</p>
                        </div>
                      ))}
                      {(pendingData.pendingPosts || []).length === 0 && <p className="text-slate-400 text-center italic py-4">אין פוסטים הממתינים לאישור</p>}
                   </div>
                </div>

                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                   <h3 className="font-black text-xl mb-6 flex items-center gap-2"><MessageSquare className="text-blue-500"/> פוסטים פעילים בפורום</h3>
                   <div className="space-y-4">
                      {forumPosts.map(p => (
                        <div key={p._id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                           <div className="flex justify-between items-center">
                              <span className="text-xs font-bold bg-white px-2 py-1 rounded-md shadow-sm">{p.authorName}</span>
                              <button onClick={() => handleDelete(p._id, 'post', p.title)} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                           </div>
                           <h4 className="font-bold text-slate-700">{p.title}</h4>
                           <p className="text-xs text-slate-500 line-clamp-2">{p.content}</p>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* טאב השראה יומית */}
        {activeTab === 'inspirations' && (
          <div className="space-y-6 animate-fade-in">
            <button onClick={() => { setInspirationForm({ _id: '', text: '', author: '', scheduledAt: '' }); setIsInspirationModalOpen(true); }} className="w-full md:w-auto bg-slate-900 text-white px-8 py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:shadow-lg transition-all"><Plus/> השראה חדשה</button>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {apiInspirations.map(insp => (
                <div key={insp._id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border-r-4 border-rose-400 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                        <Quote className="text-rose-200 mb-2" size={32} />
                        {insp.scheduledAt && <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-bold flex gap-1"><CalendarClock size={12}/> {new Date(insp.scheduledAt).toLocaleDateString()}</span>}
                    </div>
                    <p className="font-bold text-slate-700 mb-4">"{insp.text}"</p>
                    <p className="text-sm text-slate-400 italic text-left">— {insp.author}</p>
                  </div>
                  <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                    <button onClick={() => { setInspirationForm(insp); setIsInspirationModalOpen(true); }} className="text-blue-500 p-2"><Edit size={18}/></button>
                    <button onClick={() => handleDelete(insp._id, 'inspiration', 'ההשראה')} className="text-red-500 p-2"><Trash2 size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* טאב פרסומים */}
        {activeTab === 'ads' && (
          <div className="space-y-8 animate-fade-in">
            <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100 flex items-start gap-4">
              <div className="p-3 bg-blue-500 rounded-xl text-white"><ImageIcon size={24}/></div>
              <div>
                <h4 className="font-black text-blue-900">הנחיות להעלאת באנר</h4>
                <p className="text-sm text-blue-700 leading-relaxed">הפרסומים יתחלפו אוטומטית בדף הבית (כל 3 שניות או בסיום סרטון).</p>
                <ul className="text-xs font-bold text-blue-600 mt-2 list-disc list-inside">
                  <li>באנר רוחב (דסקטופ): 1920x600 פיקסלים</li>
                  <li>באנר ריבוע (מובייל/סליידר): 1080x1080 פיקסלים</li>
                </ul>
              </div>
            </div>

            <button onClick={() => { setAdForm({ _id: '', type: 'image', content: '', link: '', title: '' }); setIsAdModalOpen(true); }} className="w-full md:w-auto bg-indigo-600 text-white px-8 py-3 rounded-xl font-black flex items-center justify-center gap-2"><Plus/> פרסום חדש</button>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {apiAds.map(ad => (
                <div key={ad._id} className="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  {ad.type === 'image' ? (
                    <img src={ad.content} className="w-full h-48 object-cover rounded-2xl mb-4" />
                  ) : (
                    <div className="w-full h-48 bg-slate-900 rounded-2xl mb-4 flex items-center justify-center text-white flex-col gap-2">
                      <Video size={40}/>
                      <span className="text-xs font-mono">{ad.content?.substring(0,30)}...</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-black">{ad.title || 'ללא כותרת'}</h4>
                      <p className="text-[10px] text-blue-500 truncate max-w-[200px]">{ad.link}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setAdForm(ad); setIsAdModalOpen(true); }} className="text-blue-500 p-2"><Edit size={18}/></button>
                      <button onClick={() => handleDelete(ad._id, 'ad', ad.title)} className="text-red-500 p-2"><Trash2 size={18}/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* טאב משתמשים */}
        {activeTab === 'users' && (() => {
          const filteredUsers = apiUsers.filter(u => (u.name || '').includes(searchTerm) || (u.email || '').includes(searchTerm));
          const totalUsersPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));
          const pagedUsers = filteredUsers.slice((usersPage - 1) * ITEMS_PER_PAGE, usersPage * ITEMS_PER_PAGE);
          return (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                <h3 className="font-black text-slate-800">ניהול משתמשות רשומות</h3>
                <button
                  onClick={exportUsersToExcel}
                  className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-black hover:bg-emerald-600 transition-colors"
                >
                  <Download size={16} /> ייצוא משתמשות לאקסל
                </button>
              </div>
              <div className="bg-white rounded-[3rem] shadow-sm overflow-hidden border border-slate-100 overflow-x-auto">
                <table className="w-full text-right min-w-[500px]">
                  <thead className="bg-slate-50 text-slate-500 text-xs font-black uppercase">
                    <tr><th className="p-6 text-right">שם</th><th className="p-6 text-right">ניקוד</th><th className="p-6 text-right">סטטוס</th><th className="p-6 text-right">פעולות</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagedUsers.map(u => (
                      <tr key={u._id || u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-6 font-bold">{u.name}<br/><span className="text-[10px] text-slate-400">{u.email}</span></td>
                        <td className="p-6 font-black text-rose-500">{u.points}</td>
                        <td className="p-6 text-xs">{u.isMemberApproved ? 'חברת מעגל' : 'רשומה'}</td>
                        <td className="p-6 flex gap-2">
                            <button onClick={() => sendPersonalBenefit(u.email)} className="p-2 bg-yellow-50 text-yellow-600 rounded-xl hover:scale-110 transition-transform" title="שליחת לינק להטבה אישית"><Award size={18}/></button>
                            <button onClick={() => handleDelete(u._id || u.id, 'user', u.name)} className="p-2 bg-red-50 text-red-600 rounded-xl hover:scale-110 transition-transform"><Trash2 size={18}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalUsersPages > 1 && (
                <div className="flex items-center justify-center gap-3 py-2">
                  <button aria-label="עמוד קודם" onClick={() => setUsersPage(p => Math.max(1, p - 1))} disabled={usersPage === 1} className="p-2 rounded-xl bg-white border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors"><ChevronRight size={18}/></button>
                  <span className="text-sm font-bold text-slate-600">{usersPage} / {totalUsersPages}</span>
                  <button aria-label="עמוד הבא" onClick={() => setUsersPage(p => Math.min(totalUsersPages, p + 1))} disabled={usersPage === totalUsersPages} className="p-2 rounded-xl bg-white border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors"><ChevronLeft size={18}/></button>
                </div>
              )}
            </div>
          );
        })()}

        {/* טאב אירועים */}
        {activeTab === 'events' && (() => {
          const totalEventsPages = Math.max(1, Math.ceil(apiEvents.length / ITEMS_PER_PAGE));
          const pagedEvents = apiEvents.slice((eventsPage - 1) * ITEMS_PER_PAGE, eventsPage * ITEMS_PER_PAGE);
          return (
            <div className="space-y-6 animate-fade-in">
              <button onClick={() => { setEventForm({ title: '', location: '', category: 'מוזיקה', image: '', date: '', time: '', isHero: false, price: 0, earlyBirdPrice: 0, earlyBirdEndDate: '', sessions: [], notes: '', targetAges: '', hebrewDate: '', ticketLink: '', logo: '' }); setIsEventModalOpen(true); }} className="w-full md:w-auto bg-rose-600 text-white px-8 py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:shadow-lg transition-all"><Plus/> אירוע חדש</button>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {pagedEvents.map(ev => (
                  <div key={ev._id || ev.id} className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 animate-fade-in-up">
                    {ev.isHero && <Sparkles className="text-yellow-400 mb-2 animate-pulse" size={16}/>}
                    <img src={ev.image} className="w-full h-32 md:h-40 object-cover rounded-2xl mb-4" />
                    <h4 className="font-black text-slate-800 text-right">{ev.title}</h4>
                    <div className="flex justify-between items-center mt-4">
                      <span className="text-[10px] text-slate-400">{ev.location}</span>
                      <div className="flex gap-2">
                        <button className="text-blue-500 p-2 hover:bg-blue-50 rounded-lg transition-colors" onClick={() => { setEventForm(ev); setIsEventModalOpen(true); }}><Edit size={18}/></button>
                        <button className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors" onClick={() => handleDelete(ev._id || ev.id, 'event', ev.title)}><Trash2 size={18}/></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {totalEventsPages > 1 && (
                <div className="flex items-center justify-center gap-3 py-2">
                  <button aria-label="עמוד קודם" onClick={() => setEventsPage(p => Math.max(1, p - 1))} disabled={eventsPage === 1} className="p-2 rounded-xl bg-white border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors"><ChevronRight size={18}/></button>
                  <span className="text-sm font-bold text-slate-600">{eventsPage} / {totalEventsPages}</span>
                  <button aria-label="עמוד הבא" onClick={() => setEventsPage(p => Math.min(totalEventsPages, p + 1))} disabled={eventsPage === totalEventsPages} className="p-2 rounded-xl bg-white border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors"><ChevronLeft size={18}/></button>
                </div>
              )}
            </div>
          );
        })()}

        {/* טאב חוגים */}
        {activeTab === 'classes' && (() => {
          const totalClassesPages = Math.max(1, Math.ceil(apiClasses.length / ITEMS_PER_PAGE));
          const pagedClasses = apiClasses.slice((classesPage - 1) * ITEMS_PER_PAGE, classesPage * ITEMS_PER_PAGE);
          return (
            <div className="space-y-6 animate-fade-in">
              <button onClick={() => { setClassForm({ title: '', instructor: '', contactPhone: '', registrationPhone: '', day: 'ראשון', time: '', location: '', price: 0, ageGroup: '', gender: 'נשים', image: '' }); setIsClassModalOpen(true); }} className="w-full md:w-auto bg-slate-900 text-white px-8 py-3 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg"><Plus/> חוג חדש</button>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-right">
                {pagedClasses.map(c => (
                  <div key={c._id || c.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 animate-fade-in-up shadow-sm">
                    <img src={c.image} className="w-full h-32 md:h-40 object-cover rounded-2xl mb-4" />
                    <h4 className="font-black text-lg">{c.title}</h4>
                    <p className="text-xs text-slate-500 font-bold">{c.instructor} | {c.gender}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{c.day} ב-{c.time} | {c.location}</p>
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] text-blue-500 font-black flex items-center gap-1"><Phone size={10}/> הרשמה: {c.registrationPhone}</p>
                      <p className="text-[10px] text-slate-500 font-bold flex items-center gap-1"><Users size={10}/> מדריכה: {c.contactPhone}</p>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => { setClassForm(c); setIsClassModalOpen(true); }} className="text-blue-500 p-2 hover:bg-blue-50 rounded-lg"><Edit size={16}/></button>
                      <button onClick={() => handleDelete(c._id || c.id, 'class', c.title)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
              {totalClassesPages > 1 && (
                <div className="flex items-center justify-center gap-3 py-2">
                  <button aria-label="עמוד קודם" onClick={() => setClassesPage(p => Math.max(1, p - 1))} disabled={classesPage === 1} className="p-2 rounded-xl bg-white border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors"><ChevronRight size={18}/></button>
                  <span className="text-sm font-bold text-slate-600">{classesPage} / {totalClassesPages}</span>
                  <button aria-label="עמוד הבא" onClick={() => setClassesPage(p => Math.min(totalClassesPages, p + 1))} disabled={classesPage === totalClassesPages} className="p-2 rounded-xl bg-white border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors"><ChevronLeft size={18}/></button>
                </div>
              )}
            </div>
          );
        })()}

        {/* טאב הגרלות */}
        {activeTab === 'lotteries' && (
          <div className="space-y-12 animate-fade-in">
            <div className="bg-indigo-50/50 p-8 rounded-[3.5rem] border border-indigo-100 space-y-6">
                <div className="flex items-center gap-3 border-b border-indigo-100 pb-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><CalendarClock size={24}/></div>
                    <h3 className="text-2xl font-black text-indigo-900">ניהול הגרלת שולחן השבת 🕯️</h3>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-indigo-400 pr-2">פרס השבוע</label>
                        <input 
                            placeholder="למשל: סט פמוטי כסף" 
                            className="w-full p-4 bg-white rounded-2xl font-bold outline-none border border-indigo-100 focus:ring-2 focus:ring-indigo-200" 
                            value={shabbatLotteryForm.prize} 
                            onChange={e => setShabbatLotteryForm({...shabbatLotteryForm, prize: e.target.value})} 
                        />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                        <label className="text-xs font-black text-indigo-400 pr-2">הנחיות או כותרת נוספת</label>
                        <input 
                            placeholder="למשל: העלי תמונה של שולחן השבת המעוצב שלך ואולי תזכי!" 
                            className="w-full p-4 bg-white rounded-2xl font-bold outline-none border border-indigo-100 focus:ring-2 focus:ring-indigo-200" 
                            value={shabbatLotteryForm.notes} 
                            onChange={e => setShabbatLotteryForm({...shabbatLotteryForm, notes: e.target.value})} 
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 items-center justify-between pt-4">
                    <div className="flex gap-4">
                        <button 
                            onClick={async () => {
                                try {
                                    await api.updateShabbatLotterySettings(shabbatLotteryForm);
                                    alert("הגדרות שולחן שבת עודכנו בהצלחה!");
                                } catch (e) { alert("שגיאה בעדכון"); }
                            }}
                            className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
                        >
                            <Save size={18}/> שמירת הגדרות שבת
                        </button>
                        <button 
                            onClick={async () => {
                                if(window.confirm("להפעיל הגרלת שולחן שבת עכשיו?")) {
                                    try {
                                        const res = await api.runShabbatLottery();
                                        alert(`יש לנו זוכה! מזל טוב למשפחת ${res.winnerFamily}`);
                                        loadTabData();
                                    } catch(e: any) { alert(e.response?.data?.error || "שגיאה בהפעלה"); }
                                }
                            }}
                            className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:bg-rose-600 transition-all flex items-center gap-2"
                        >
                            <PlayCircle size={18}/> הפעלת הגרלה לייב (שבת)
                        </button>
                    </div>

                    <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl border border-indigo-100">
                        <label className="text-sm font-black text-indigo-900">הגרלה פעילה?</label>
                        <button 
                            onClick={() => setShabbatLotteryForm({...shabbatLotteryForm, isActive: !shabbatLotteryForm.isActive})}
                            className={`w-12 h-6 rounded-full relative transition-colors ${shabbatLotteryForm.isActive ? 'bg-indigo-500' : 'bg-slate-300'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${shabbatLotteryForm.isActive ? 'left-7' : 'left-1'}`}></div>
                        </button>
                    </div>
                </div>

                <div className="mt-8 bg-white p-6 rounded-[2.5rem] border border-indigo-100 shadow-sm overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="font-black text-xl text-indigo-900">משתתפות שולחן שבת השבוע ({shabbatParticipants.length})</h4>
                        <button 
                            onClick={exportShabbatToExcel}
                            className="flex items-center gap-2 bg-emerald-500 text-white px-5 py-2 rounded-xl font-black text-sm hover:bg-emerald-600 transition-all shadow-md"
                        >
                            <Download size={16} /> ייצוא לאקסל
                        </button>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-right min-w-[400px]">
                            <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase">
                                <tr>
                                    <th className="p-4">שם משפחה</th>
                                    <th className="p-4">מספר טלפון</th>
                                    <th className="p-4">תאריך העלאה</th>
                                    <th className="p-4 text-center">תמונה</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {shabbatParticipants.map((p, i) => (
                                    <tr key={i} className="text-sm hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-bold text-slate-700">משפחת {p.familyName}</td>
                                        <td className="p-4 font-black text-indigo-600" dir="ltr">{p.phone}</td>
                                        <td className="p-4 text-xs text-slate-400">{new Date(p.createdAt).toLocaleDateString('he-IL')}</td>
                                        <td className="p-4 flex justify-center">
                                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-100">
                                                <img src={p.image} className="w-full h-full object-cover" alt="table" />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {shabbatParticipants.length === 0 && (
                                    <tr><td colSpan={4} className="p-10 text-center text-slate-400 italic">אין עדיין משתתפות להשבוע</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <button onClick={() => { setLotteryForm({ title: '', prize: '', prize2: '', prize3: '', prize4: '', prize5: '', prize6: '', prize7: '', drawDate: '', image: '', minPointsToEnter: 0, participationType: 'everyone', missionText: '' }); setIsLotteryModalOpen(true); }} className="w-full md:w-auto bg-purple-600 text-white px-8 py-3 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg"><Plus/> הגרלה רגילה חדשה</button>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-right">
                  {apiLotteries.map(l => (
                    <div key={l._id || l.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm animate-fade-in-up flex flex-col justify-between group">
                      <div>
                        <img src={l.image} className="w-full h-32 md:h-40 object-cover rounded-2xl mb-4 transition-transform group-hover:scale-[1.02]" />
                        <div className="flex justify-between items-start">
                            <h4 className="font-black text-lg">{l.title}</h4>
                            <span className={`text-[8px] font-black px-2 py-1 rounded-full ${l.participationType === 'mission' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                {l.participationType === 'mission' ? 'מבוסס משימה' : 'מבוסס נקודות'}
                            </span>
                        </div>
                        <div className="space-y-1 mt-2">
                            <p className="text-[10px] text-emerald-600 font-bold">🎁 פרס 1: {l.prize}</p>
                            {l.prize2 && <p className="text-[10px] text-slate-600 font-bold">🎁 פרס 2: {l.prize2}</p>}
                            {l.prize3 && <p className="text-[10px] text-slate-600 font-bold">🎁 פרס 3: {l.prize3}</p>}
                            {l.prize4 && <p className="text-[10px] text-slate-600 font-bold">🎁 פרס 4: {l.prize4}</p>}
                            {l.prize5 && <p className="text-[10px] text-slate-600 font-bold">🎁 פרס 5: {l.prize5}</p>}
                            {l.prize6 && <p className="text-[10px] text-slate-600 font-bold">🎁 פרס 6: {l.prize6}</p>}
                            {l.prize7 && <p className="text-[10px] text-slate-600 font-bold">🎁 פרס 7: {l.prize7}</p>}
                            {l.participationType === 'mission' && <p className="text-[10px] text-orange-600 font-black">🎯 משימה: {l.missionText}</p>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 mt-4 pt-4 border-t">
                        <button onClick={() => viewParticipants(l._id || l.id)} className="w-full bg-slate-100 text-slate-600 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2">
                            <Users size={16}/> צפייה במשתתפות
                        </button>
                        <button onClick={() => runLiveLottery(l._id || l.id)} className="w-full bg-slate-900 text-white py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 hover:bg-rose-600 transition-colors">
                            <PlayCircle size={16}/> הפעלת הגרלה בלייב
                        </button>
                        <div className="flex gap-2">
                            <button onClick={() => { setLotteryForm(l); setIsLotteryModalOpen(true); }} className="flex-1 text-blue-500 p-2 hover:bg-blue-50 rounded-lg flex justify-center"><Edit size={16}/></button>
                            <button onClick={() => handleDelete(l._id || l.id, 'lottery', l.title)} className="flex-1 text-red-500 p-2 hover:bg-red-50 rounded-lg flex justify-center"><Trash2 size={16}/></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
            </div>
          </div>
        )}

        {activeTab === 'zodiacWheel' && (
          <div className="space-y-8 animate-fade-in">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-xs text-slate-500 font-bold mb-1">סך כל הסיבובים בגלגל</p>
                <p className="text-3xl font-black text-slate-800">{zodiacStats.totalSpins}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-fuchsia-100 shadow-sm">
                <p className="text-xs text-fuchsia-500 font-bold mb-1">מכסת זוכות יומית מוגדרת</p>
                <p className="text-3xl font-black text-fuchsia-700">{zodiacStats.totalDailyWinners}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm">
                <p className="text-xs text-amber-600 font-bold mb-1">זוכות היום</p>
                <p className="text-3xl font-black text-amber-700">{zodiacStats.todayWinners}</p>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[3rem] border border-fuchsia-100 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-fuchsia-100 pb-4">
                <div className="p-3 bg-fuchsia-600 text-white rounded-2xl shadow-lg"><Sparkles size={22} /></div>
                <h3 className="text-2xl font-black text-fuchsia-900">ניהול גלגל המזלות</h3>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-black text-slate-700">שם ההטבה</label>
                  <input
                    placeholder="לדוגמה: שובר לבית קפה"
                    className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-slate-200"
                    value={zodiacPrizeForm.title}
                    onChange={e => setZodiacPrizeForm({ ...zodiacPrizeForm, title: e.target.value })}
                  />
                  <p className="text-xs text-slate-500">זה השם שיוצג לזוכה לאחר הסיבוב.</p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-black text-slate-700">תיאור ההטבה (אופציונלי)</label>
                  <input
                    placeholder="מה מקבלים בהטבה"
                    className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-slate-200"
                    value={zodiacPrizeForm.description}
                    onChange={e => setZodiacPrizeForm({ ...zodiacPrizeForm, description: e.target.value })}
                  />
                  <p className="text-xs text-slate-500">פירוט קצר שיופיע ברשימת ההטבות בגלגל.</p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-black text-slate-700">מלאי כולל</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="כמות פריטים זמינים"
                    className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-slate-200"
                    value={zodiacPrizeForm.stock}
                    onChange={e => setZodiacPrizeForm({ ...zodiacPrizeForm, stock: Number(e.target.value) })}
                  />
                  <p className="text-xs text-slate-500">כמה פעמים ניתן לחלק את ההטבה עד שהמלאי נגמר.</p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-black text-slate-700">כמות זוכות ביום</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="לדוגמה: 3 זוכות ביום"
                    className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-slate-200"
                    value={zodiacPrizeForm.dailyWinners}
                    onChange={e => setZodiacPrizeForm({ ...zodiacPrizeForm, dailyWinners: Number(e.target.value) })}
                  />
                  <p className="text-xs text-slate-500">המכסה היומית המקסימלית לזוכות בהטבה הזו.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={saveZodiacPrize}
                  className="bg-fuchsia-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg hover:bg-fuchsia-700 transition-colors"
                >
                  {zodiacPrizeForm._id ? 'עדכון הטבה' : 'הוספת הטבה לגלגל'}
                </button>
                <button
                  onClick={() => setZodiacPrizeForm({ _id: '', title: '', description: '', stock: 0, dailyWinners: 1, isActive: true })}
                  className="bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl font-black"
                >
                  איפוס טופס
                </button>
                <button
                  onClick={deleteAllZodiacPrizes}
                  className="bg-red-50 text-red-600 px-6 py-3 rounded-2xl font-black border border-red-200"
                >
                  מחיקת כל ההטבות הקיימות
                </button>
                <p className="text-sm text-slate-500 font-bold">הגלגל עובד לפי מכסת זוכות יומית לכל הטבה (לא לפי אחוזים).</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right min-w-[600px]">
                  <thead className="bg-slate-50 text-slate-500 text-xs font-black uppercase">
                    <tr>
                      <th className="p-4">הטבה</th>
                      <th className="p-4">מלאי</th>
                      <th className="p-4">זוכות ביום</th>
                      <th className="p-4">סטטוס</th>
                      <th className="p-4">פעולות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {zodiacPrizes.map((item: any) => (
                      <tr key={item._id} className="hover:bg-slate-50">
                        <td className="p-4 font-bold text-slate-700">
                          {item.title}
                          {item.description && <p className="text-xs text-slate-400 mt-1">{item.description}</p>}
                        </td>
                        <td className="p-4 font-black text-indigo-600">{item.stock}</td>
                        <td className="p-4 font-black text-fuchsia-600">{item.dailyWinners ?? 0}</td>
                        <td className="p-4 text-xs font-bold">{item.isActive ? 'פעיל' : 'כבוי'}</td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setZodiacPrizeForm({
                                _id: item._id || '',
                                title: item.title || '',
                                description: item.description || '',
                                stock: item.stock || 0,
                                dailyWinners: item.dailyWinners ?? 0,
                                isActive: !!item.isActive
                              })}
                              className="text-blue-500 p-2 hover:bg-blue-50 rounded-lg"
                            >
                              <Edit size={16} />
                            </button>
                            <button onClick={() => deleteZodiacPrize(item._id)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {zodiacPrizes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 italic">אין עדיין הטבות בגלגל המזלות — אפשר להתחיל להזין חדשות</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm overflow-x-auto">
              <h4 className="font-black text-xl text-slate-800 mb-4">רשימת זוכות בגלגל (כולל מייל)</h4>
              <table className="w-full text-right min-w-[640px]">
                <thead className="bg-slate-50 text-slate-500 text-xs font-black uppercase">
                  <tr>
                    <th className="p-4">שם</th>
                    <th className="p-4">מייל</th>
                    <th className="p-4">הפרס שזכתה</th>
                    <th className="p-4">תאריך זכייה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {zodiacStats.winners.map((winner: any) => (
                    <tr key={winner._id} className="hover:bg-slate-50">
                      <td className="p-4 font-bold text-slate-700">{winner.userName || '-'}</td>
                      <td className="p-4 text-sm text-slate-600" dir="ltr">{winner.userEmail || '-'}</td>
                      <td className="p-4 font-bold text-fuchsia-700">{winner.prizeTitle || 'הטבה מיוחדת'}</td>
                      <td className="p-4 text-xs text-slate-500">{winner.createdAt ? new Date(winner.createdAt).toLocaleString('he-IL') : '-'}</td>
                    </tr>
                  ))}
                  {zodiacStats.winners.length === 0 && (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">עדיין אין זכיות רשומות בגלגל</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* טאב קהילה */}
        {activeTab === 'community' && (
          <div className="space-y-6 animate-fade-in">
            <button onClick={() => { setCommunityForm({ category: 'גמ"חים', title: '', phone: '', location: '', image: '', description: '', startTime: '', targetAudience: '', isPaid: false, price: 0 }); setIsCommunityModalOpen(true); }} className="w-full md:w-auto bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg"><Plus/> הוספה לקהילה</button>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-right">
              {communityItems.map(item => (
                <div key={item._id} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 flex items-center gap-4 animate-fade-in-up shadow-sm">
                  <img src={item.image} className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-50" />
                  <div className="flex-1 overflow-hidden">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">{item.category}</span>
                    <h4 className="font-bold text-sm truncate">{item.title}</h4>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setCommunityForm(item); setIsCommunityModalOpen(true); }} className="text-blue-400 hover:text-blue-600"><Edit size={16}/></button>
                    <button onClick={() => handleDelete(item._id, 'community', item.title)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* טאב אשת השבוע (משודרג עם כפתור עריכה) */}
        {activeTab === 'personality' && (
          <div className="max-w-4xl mx-auto space-y-12 animate-fade-in text-right">
            
            {/* ראיונות הממתינים לאישור */}
            {pendingInterviews.length > 0 && (
                <div className="space-y-6">
                    <h3 className="text-xl font-black text-orange-500 pr-4 flex items-center gap-2"><Clock/> ראיונות הממתינים לאישורך:</h3>
                    <div className="grid grid-cols-1 gap-4">
                        {pendingInterviews.map(interview => (
                            <div key={interview.id || (interview as any)._id} className="bg-orange-50 border border-orange-100 p-6 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-4 w-full md:w-auto">
                                    <img src={interview.image} className="w-16 h-16 rounded-2xl object-cover shadow-sm shrink-0" />
                                    <div>
                                        <p className="font-black text-slate-800">{interview.name}</p>
                                        <p className="text-xs text-slate-500">{interview.role}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full md:w-auto justify-end">
                                    <button onClick={() => { setSelectedInterview(interview); setIsPreviewModalOpen(true); }} className="bg-white p-2 rounded-xl text-blue-500 shadow-sm" title="תצוגה מקדימה"><Eye size={20}/></button>
                                    <button 
                                        onClick={() => { setEditingInterview(JSON.parse(JSON.stringify(interview))); setIsEditInterviewModalOpen(true); }} 
                                        className="bg-white p-2 rounded-xl text-orange-500 shadow-sm hover:bg-orange-100 transition-colors" 
                                        title="עריכה לפני אישור"
                                    >
                                        <Edit size={20}/>
                                    </button>
                                    <button onClick={async () => {
                                        await api.approvePersonality(interview.id || (interview as any)._id);
                                        alert("הראיון אושר ופורסם באתר!");
                                        loadTabData();
                                    }} className="bg-green-500 text-white px-4 py-2 rounded-xl font-black text-xs shadow-sm hover:bg-green-600 transition-colors">אישור ופרסום</button>
                                    <button onClick={() => handleDelete(interview.id || (interview as any)._id, 'personality', interview.name)} className="bg-red-100 text-red-500 px-4 py-2 rounded-xl hover:bg-red-200 transition-colors"><Trash2 size={20}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-white p-8 md:p-10 rounded-[3.5rem] shadow-xl border border-rose-50 space-y-8">
              <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3"><Sparkles className="text-rose-500"/> הגדרת אשת השבוע</h3>
              </div>
              
              <div className="p-4 bg-blue-50 border-r-4 border-blue-500 rounded-xl mb-6">
                <p className="text-sm font-bold text-blue-900">שימי לב: השאלות שתגדירי כאן יישמרו כתבנית קבועה תמיד. גם אחרי שליחת לינק, השאלות לא ימחקו עד שתבחרי לשנותן.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input placeholder="שם מלא של האישה" className="p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none focus:ring-2 focus:ring-rose-100" value={personalityForm.name} onChange={e=>setPersonalityForm({...personalityForm, name:e.target.value})} />
                <input placeholder="תפקיד / תיאור קצר" className="p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none focus:ring-2 focus:ring-rose-100" value={personalityForm.role} onChange={e=>setPersonalityForm({...personalityForm, role:e.target.value})} />
              </div>

              <div className="space-y-4 bg-slate-50 p-6 rounded-[2rem]">
                <div className="flex justify-between items-center mb-4"><h4 className="font-black text-lg">הגדרת השאלון</h4><button onClick={addQuestion} className="text-rose-500 font-bold text-sm">+ הוספת שאלה</button></div>
                {personalityForm.questions?.map((q, i) => (
                  <div key={i} className="flex gap-2 mb-3">
                    <input placeholder="כתבי את השאלה כאן..." className="flex-1 p-3 bg-white border border-slate-100 rounded-xl font-bold text-right outline-none focus:border-rose-200" value={q.question} onChange={e=>updateQuestion(i,'question',e.target.value)} />
                    <button onClick={()=>{const qs=[...personalityForm.questions!]; qs.splice(i,1); setPersonalityForm({...personalityForm, questions:qs});}} className="text-red-400 p-2"><Trash2 size={18}/></button>
                  </div>
                ))}
              </div>

              <button onClick={async () => { 
                try {
                  // שמירה ספציפית של התבנית
                  await api.updatePersonalityTemplate(personalityForm);
                  const res = await api.generateInterviewLink(personalityForm); 
                  const fullLink = `${window.location.origin}/#/interview/${res.token || res.id}`;
                  setGeneratedLink(fullLink);
                  alert("השאלות נשמרו כתבנית והלינק הופק בהצלחה!");
                } catch (err: any) { alert("שגיאה: " + err.message); }
              }} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-md hover:bg-blue-700 transition-all">
                <LinkIcon size={18}/> שמירת שאלות והפקת לינק למילוי עצמי
              </button>

              {generatedLink && (
                <div className="p-4 bg-blue-50 rounded-2xl border-2 border-blue-100 flex items-center gap-3 animate-fade-in-up">
                  <input readOnly className="flex-1 bg-transparent font-mono text-[10px] text-blue-800 text-left outline-none overflow-hidden" value={generatedLink} />
                  <button onClick={() => { navigator.clipboard.writeText(generatedLink); alert("הלינק הועתק!"); }} className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"><Copy size={16}/></button>
                </div>
              )}
            </div>

            <div className="space-y-6">
                <h4 className="font-black text-xl text-slate-700 pr-4">ארכיון נשות המעגל (כל הראיונות):</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allInterviews.map((interview) => (
                    <div key={interview._id || (interview as any).id} className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 flex justify-between items-center group hover:shadow-md transition-shadow">
                       <div className="flex items-center gap-3">
                          <img src={interview.image} className="w-12 h-12 rounded-xl object-cover shadow-sm shrink-0" />
                          <div>
                            <p className="font-black text-slate-800 leading-none">{interview.name}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{interview.role}</p>
                          </div>
                       </div>
                       <div className="flex gap-2 items-center">
                          {interview.isActive ? <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-2 py-1 rounded-full border border-emerald-100 whitespace-nowrap">פעילה באתר</span> : null}
                          <button onClick={() => handleDelete(interview._id || (interview as any).id, 'personality', interview.name)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl"><Trash2 size={18}/></button>
                       </div>
                    </div>
                  ))}
                  {allInterviews.length === 0 && <p className="text-slate-400 italic pr-4">טרם אושרו ראיונות לארכיון.</p>}
                </div>
            </div>
          </div>
        )}

        {/* טאב הגדרות */}
        {activeTab === 'settings' && (
          <div className="max-w-xl mx-auto bg-white p-8 md:p-12 rounded-[4rem] shadow-2xl space-y-8 animate-fade-in text-right">
            <h3 className="text-2xl font-black flex items-center gap-3 justify-end"><Settings className="text-rose-500"/> הגדרות ניקוד</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400">נקודות על הרשמה</label>
                <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none text-right" value={pointsSettings.pointsPerRegister} onChange={e=>setPointsSettings({...pointsSettings, pointsPerRegister: Number(e.target.value)})}/>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400">נקודות על הרשמה לאירוע</label>
                <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-black outline-none text-right" value={pointsSettings.pointsPerEventJoin} onChange={e=>setPointsSettings({...pointsSettings, pointsPerEventJoin: Number(e.target.value)})}/>
              </div>
              <button onClick={() => api.updateSettings(pointsSettings).then(() => alert('הגדרות נשמרו!'))} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black shadow-xl hover:scale-[1.02] transition-transform">עדכון הגדרות</button>
            </div>
          </div>
        )}
      </div>

      {/* מודאלים */}

      <Modal isOpen={isAnnModalOpen} onClose={() => setIsAnnModalOpen(false)} title={annForm._id ? "עריכת הודעה" : "הוספת הודעת הנהלה"}>
        <form onSubmit={async (e) => {
          e.preventDefault();
          try {
              if (annForm._id) await api.updateAnnouncement(annForm._id, annForm);
              else await api.createAnnouncement(annForm);
              alert("הודעה נשמרה!");
              setIsAnnModalOpen(false); 
              const anns = await api.getAnnouncements();
              setApiAnnouncements(anns || []);
          } catch(err: any) { alert("שגיאה בשמירה"); }
        }} className="space-y-4">
          <input required placeholder="כותרת ההודעה" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={annForm.title} onChange={e => setAnnForm({ ...annForm, title: e.target.value })} />
          <textarea required placeholder="תוכן ההודעה..." className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right h-32" value={annForm.content} onChange={e => setAnnForm({ ...annForm, content: e.target.value })} />
          <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg">שמירת הודעה</button>
        </form>
      </Modal>

      <Modal isOpen={isParticipantsModalOpen} onClose={() => setIsParticipantsModalOpen(false)} title="רשימת משתתפות בהגרלה">
        <div className="space-y-2">
            {currentParticipants.map((p, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-xl flex justify-between items-center">
                    <span className="font-bold">{p.name}</span>
                    <span className="text-xs text-slate-500">{p.phone}</span>
                </div>
            ))}
            {currentParticipants.length === 0 && <p className="text-center text-slate-400">אף משתמשת עדיין לא נרשמה להגרלה זו.</p>}
        </div>
      </Modal>

      {/* מודל עריכת ראיון אשת השבוע לפני אישור */}
      <Modal isOpen={isEditInterviewModalOpen} onClose={() => setIsEditInterviewModalOpen(false)} title="עריכת הראיון ואישור">
        {editingInterview && (
            <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                    // הפעולה מתבצעת בשני שלבים חכמים:
                    // 1. קודם מאשרים את הראיון (מה שהופך אותו לראיון ה"פעיל" במסד הנתונים)
                    await api.approvePersonality(editingInterview.id || (editingInterview as any)._id);
                    // 2. מיד לאחר מכן מעדכנים את הראיון הפעיל עם הטקסטים החדשים שערכנו
                    await api.updatePersonality(editingInterview);
                    
                    alert("הראיון נערך, אושר ופורסם בהצלחה!");
                    setIsEditInterviewModalOpen(false);
                    loadTabData();
                } catch(err: any) { alert("שגיאה בעריכת הראיון: " + err.message); }
            }} className="space-y-4 text-right">
                
                <div className="flex items-center gap-4 mb-4 bg-orange-50 p-4 rounded-2xl">
                    <img src={editingInterview.image} className="w-16 h-16 rounded-xl object-cover" />
                    <div>
                        <p className="text-xs font-black text-orange-600 mb-1">את עורכת את התשובות של:</p>
                        <input required className="w-full bg-transparent font-black text-lg outline-none border-b border-orange-200 focus:border-orange-400" value={editingInterview.name} onChange={e => setEditingInterview({...editingInterview, name: e.target.value})} placeholder="שם מלא" />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400">תפקיד / מקצוע:</label>
                    <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right border border-slate-100 focus:border-orange-300" value={editingInterview.role || ''} onChange={e => setEditingInterview({...editingInterview, role: e.target.value})} placeholder="למשל: יועצת זוגית" />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400">מוטו לחיים:</label>
                    <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right border border-slate-100 focus:border-orange-300" value={editingInterview.motto || ''} onChange={e => setEditingInterview({...editingInterview, motto: e.target.value})} placeholder="משפט מפתח" />
                </div>

                <div className="space-y-4 mt-4 max-h-[40vh] overflow-y-auto pr-2 no-scrollbar border-t border-slate-100 pt-4">
                    {editingInterview.questions?.map((q, i) => (
                        <div key={i} className="bg-slate-50 p-4 rounded-2xl space-y-2">
                            <p className="font-black text-sm text-slate-700">{q.question}</p>
                            <textarea className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-400 min-h-[100px] leading-relaxed" value={q.answer} onChange={e => {
                                const newQs = [...(editingInterview.questions || [])];
                                newQs[i].answer = e.target.value;
                                setEditingInterview({...editingInterview, questions: newQs});
                            }} />
                        </div>
                    ))}
                </div>
                <button type="submit" className="w-full py-4 bg-orange-500 hover:bg-orange-600 transition-colors text-white rounded-2xl font-black shadow-lg flex justify-center items-center gap-2"><CheckCircle size={20}/> שמירת שינויים ופרסום באתר</button>
            </form>
        )}
      </Modal>

      <Modal isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)} title="תצוגה מקדימה של הראיון">
        {selectedInterview && (
            <div className="space-y-4 text-right">
                <img src={selectedInterview.image} className="w-32 h-32 rounded-3xl mx-auto object-cover" />
                <h4 className="text-2xl font-black text-center">{selectedInterview.name}</h4>
                <p className="font-bold text-rose-500 text-center">{selectedInterview.role}</p>
                <div className="space-y-4 mt-6">
                    {selectedInterview.questions?.map((q, i) => (
                        <div key={i} className="bg-slate-50 p-4 rounded-2xl">
                            <p className="font-black text-xs text-slate-400 mb-1">{q.question}</p>
                            <p className="font-bold leading-relaxed">{q.answer}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </Modal>

      <Modal isOpen={isLotteryModalOpen} onClose={()=>setIsLotteryModalOpen(false)} title={lotteryForm._id ? "עריכת הגרלה" : "הגרלה חדשה"}>
        <form onSubmit={async (e)=>{
            e.preventDefault(); 
            try {
                const data = {...lotteryForm};
                if(!data._id) delete data._id;
                if(lotteryForm._id) await api.updateLottery(lotteryForm._id, data);
                else await api.createLottery(data);
                alert("ההגרלה נשמרה!"); setIsLotteryModalOpen(false); loadTabData();
            } catch(err: any) { alert("שגיאה: " + err.message); }
        }} className="space-y-4">
            <input required placeholder="שם ההגרלה" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={lotteryForm.title} onChange={e=>setLotteryForm({...lotteryForm, title:e.target.value})} />
            <div className="space-y-2">
                <input required placeholder="פרס ראשון 🏆" className="w-full p-4 bg-emerald-50 border border-emerald-100 rounded-2xl font-black outline-none text-right" value={lotteryForm.prize} onChange={e=>setLotteryForm({...lotteryForm, prize:e.target.value})} />
                <input placeholder="פרס שני" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={lotteryForm.prize2} onChange={e=>setLotteryForm({...lotteryForm, prize2:e.target.value})} />
                <input placeholder="פרס שלישי" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={lotteryForm.prize3} onChange={e=>setLotteryForm({...lotteryForm, prize3:e.target.value})} />
                <input placeholder="פרס רביעי" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={lotteryForm.prize4} onChange={e=>setLotteryForm({...lotteryForm, prize4:e.target.value})} />
                <input placeholder="פרס חמישי" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={lotteryForm.prize5} onChange={e=>setLotteryForm({...lotteryForm, prize5:e.target.value})} />
                <input placeholder="פרס שישי" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={lotteryForm.prize6} onChange={e=>setLotteryForm({...lotteryForm, prize6:e.target.value})} />
                <input placeholder="פרס שביעי" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={lotteryForm.prize7} onChange={e=>setLotteryForm({...lotteryForm, prize7:e.target.value})} />
            </div>
            <select className="w-full p-3 bg-white rounded-xl font-bold text-xs outline-none" value={lotteryForm.participationType} onChange={e=>setLotteryForm({...lotteryForm, participationType: e.target.value})}>
                <option value="everyone">כולן</option>
                <option value="points">סף נקודות</option>
                <option value="mission">משימה מיוחדת</option>
                <option value="link_only">לינק אישי</option>
            </select>
            
            {lotteryForm.participationType === 'mission' && (
                <div className="animate-fade-in-up">
                    <label className="text-[10px] font-black pr-2 text-orange-600">תיאור המשימה (למשל: סיום ספר תהילים)</label>
                    <textarea required placeholder="כתבי כאן מה המשימה..." className="w-full p-4 bg-orange-50 border border-orange-100 rounded-2xl font-bold outline-none text-right" value={lotteryForm.missionText} onChange={e=>setLotteryForm({...lotteryForm, missionText:e.target.value})} />
                </div>
            )}

            <input required type="datetime-local" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={lotteryForm.drawDate} onChange={e=>setLotteryForm({...lotteryForm, drawDate:e.target.value})} />
            <div className="relative border-2 border-dashed p-6 text-center rounded-2xl text-right">
                <input type="file" onChange={e => handleFileUpload(e, setLotteryForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
                {lotteryForm.image ? <img src={lotteryForm.image} className="h-20 mx-auto rounded-lg shadow-sm" /> : <p className="text-xs font-bold text-slate-400">העלאת תמונת פרס / החלפת קיימת</p>}
            </div>
            <button className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black shadow-lg">שמירה ופרסום</button>
        </form>
      </Modal>

      <Modal isOpen={isInspirationModalOpen} onClose={() => setIsInspirationModalOpen(false)} title={inspirationForm._id ? "עריכת השראה" : "הוספת השראה יומית"}>
        <form onSubmit={async (e) => {
          e.preventDefault();
          try {
              const data = {...inspirationForm};
              if(!data._id) delete (data as any)._id;
              if (inspirationForm._id) await api.updateInspiration(inspirationForm._id, data);
              else await api.createInspiration(data);
              alert("השראה נשמרה!");
              setIsInspirationModalOpen(false); loadTabData();
          } catch(err: any) { alert("שגיאה בשמירה: " + err.message); }
        }} className="space-y-4">
          <textarea required placeholder="כתבי את ההשראה כאן..." className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right h-32" value={inspirationForm.text} onChange={e => setInspirationForm({ ...inspirationForm, text: e.target.value })} />
          <input required placeholder="שם המצוטט (למשל: רבי נחמן)" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={inspirationForm.author} onChange={e => setInspirationForm({ ...inspirationForm, author: e.target.value })} />
          <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-black">תזמון פרסום (אופציונלי):</label>
              <input type="datetime-local" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={inspirationForm.scheduledAt} onChange={e => setInspirationForm({ ...inspirationForm, scheduledAt: e.target.value })} />
              <p className="text-[10px] text-slate-400 pr-2">השאירי ריק לפרסום מיידי</p>
          </div>
          <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg">שמירת השראה</button>
        </form>
      </Modal>

      <Modal isOpen={isAdModalOpen} onClose={() => setIsAdModalOpen(false)} title={adForm._id ? "עריכת פרסום" : "פרסום חדש"}>
        <form onSubmit={async (e) => {
          e.preventDefault();
          try {
              const data = {...adForm};
              if(!data._id) delete (data as any)._id;
              if (adForm._id) await api.updateAd(adForm._id, data);
              else await api.createAd(data);
              alert("פרסום נשמר!");
              setIsAdModalOpen(false); loadTabData();
          } catch(err: any) { alert("שגיאה בשמירה: " + err.message); }
        }} className="space-y-4">
          <input required placeholder="כותרת הפרסום (לניהול פנימי)" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={adForm.title} onChange={e => setAdForm({ ...adForm, title: e.target.value })} />
          <div className="flex bg-slate-50 p-1 rounded-xl">
            <button type="button" onClick={() => setAdForm({...adForm, type: 'image'})} className={`flex-1 py-2 rounded-lg text-xs font-black ${adForm.type === 'image' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>תמונה/באנר</button>
            <button type="button" onClick={() => setAdForm({...adForm, type: 'video'})} className={`flex-1 py-2 rounded-lg text-xs font-black ${adForm.type === 'video' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>וידאו (לינק)</button>
          </div>
          {adForm.type === 'image' ? (
            <div className="relative border-2 border-dashed p-6 text-center rounded-2xl">
              <input type="file" onChange={e => handleFileUpload(e, setAdForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
              {adForm.content ? <img src={adForm.content} className="h-32 mx-auto rounded-lg" /> : <p className="text-xs font-bold text-slate-400">לחצי להעלאת באנר</p>}
            </div>
          ) : (
            <input required placeholder="לינק לוידאו (YouTube/Vimeo)" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={adForm.content} onChange={e => setAdForm({ ...adForm, content: e.target.value })} />
          )}
          <input placeholder="לינק למעבר בלחיצה (URL)" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-left font-mono text-xs" dir="ltr" value={adForm.link} onChange={e => setAdForm({ ...adForm, link: e.target.value })} />
          <button className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg">פרסום באתר</button>
        </form>
      </Modal>

      <Modal isOpen={isEventModalOpen} onClose={()=>setIsEventModalOpen(false)} title={eventForm._id || eventForm.id ? "עריכת אירוע" : "אירוע חדש"}>
        <form onSubmit={async (e)=>{
            e.preventDefault(); 
            const id = eventForm._id || eventForm.id;
            if(id) await api.updateEvent(id, eventForm);
            else await api.createEvent(eventForm);
            setIsEventModalOpen(false); loadTabData();
        }} className="space-y-4">
          <input required placeholder="שם האירוע" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={eventForm.title} onChange={e=>setEventForm({...eventForm, title:e.target.value})} />
          
          <select required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={eventForm.category} onChange={e=>setEventForm({...eventForm, category:e.target.value})}>
              <option value="מוזיקה">מוזיקה</option>
              <option value="העשרה">העשרה</option>
              <option value="סדנאות">סדנאות</option>
              <option value="קהילה">קהילה</option>
              <option value="בידור">בידור</option>
              <option value="אופנה">אופנה</option>
              <option value="אחר">אחר</option>
          </select>

          <div className="grid grid-cols-2 gap-2">
              <input placeholder="תאריך עברי (אופציונלי)" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={eventForm.hebrewDate} onChange={e=>setEventForm({...eventForm, hebrewDate:e.target.value})} />
              <input placeholder="לינק לרכישת כרטיסים" className="w-full p-4 bg-blue-50 border border-blue-100 text-blue-700 rounded-2xl font-bold outline-none text-left" dir="ltr" value={eventForm.ticketLink} onChange={e=>setEventForm({...eventForm, ticketLink:e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-right">
              <div className="space-y-1">
                <label className="text-[10px] font-bold pr-2 text-slate-400">מחיר קבוע</label>
                <input required placeholder="מחיר" type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={eventForm.price} onChange={e=>setEventForm({...eventForm, price:Number(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold pr-2 text-rose-400">מחיר מכירה מוקדמת</label>
                <input placeholder="מכירה מוקדמת" type="number" className="w-full p-4 bg-rose-50 rounded-2xl font-bold outline-none text-right border border-rose-100" value={eventForm.earlyBirdPrice} onChange={e=>setEventForm({...eventForm, earlyBirdPrice:Number(e.target.value)})} />
              </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-right">
              <div className="space-y-1">
                <label className="text-[10px] font-bold pr-2 text-slate-400">תאריך האירוע</label>
                <input required type="date" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={(eventForm.date || '').split('T')[0]} onChange={e=>setEventForm({...eventForm, date:e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold pr-2 text-blue-400">שעת האירוע</label>
                <input type="time" className="w-full p-4 bg-blue-50/30 border border-blue-100 rounded-2xl font-bold outline-none text-right" value={eventForm.time || ''} onChange={e=>setEventForm({...eventForm, time:e.target.value})} />
              </div>
          </div>

          <div className="space-y-1">
              <label className="text-[10px] font-bold pr-2 text-rose-400">סיום מכירה מוקדמת</label>
              <input type="date" className="w-full p-4 bg-rose-50 rounded-2xl font-bold outline-none text-right border border-rose-100" value={eventForm.earlyBirdEndDate} onChange={e=>setEventForm({...eventForm, earlyBirdEndDate:e.target.value})} />
          </div>

          <input required placeholder="מיקום" className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-right" value={eventForm.location} onChange={e=>setEventForm({...eventForm, location:e.target.value})} />
          
          <div className="grid grid-cols-2 gap-2 bg-slate-50 p-4 rounded-2xl">
             <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 mb-1">תמונת אירוע ראשית:</p>
                <div className="relative h-16 border-2 border-dashed rounded-xl flex items-center justify-center">
                    <input type="file" onChange={e => handleFileUpload(e, setEventForm, 'image')} className="absolute inset-0 opacity-0 cursor-pointer" />
                    {eventForm.image ? <img src={eventForm.image} className="h-full object-cover rounded-lg" /> : <ImageIcon size={20} className="text-slate-300"/>}
                </div>
             </div>
             <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 mb-1">לוגו קטן (אופציונלי):</p>
                <div className="relative h-16 border-2 border-dashed rounded-xl flex items-center justify-center">
                    <input type="file" onChange={e => handleFileUpload(e, setEventForm, 'logo')} className="absolute inset-0 opacity-0 cursor-pointer" />
                    {eventForm.logo ? <img src={eventForm.logo} className="h-full object-contain rounded-lg" /> : <Sparkles size={20} className="text-slate-300"/>}
                </div>
             </div>
          </div>

          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
             <div className="flex justify-between items-center">
                <h4 className="font-black text-sm text-slate-700">מפגשים נוספים באירוע</h4>
                <button type="button" onClick={addEventSession} className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg flex items-center gap-1"><Plus size={14}/> הוספת מפגש</button>
             </div>
             {eventForm.sessions?.map((session, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-black text-slate-400 shrink-0">מפגש {idx + 1}</span>
                    <input placeholder="שם המפגש" className="flex-1 p-2 text-xs bg-slate-50 rounded-lg text-right outline-none" value={session.name} onChange={e => updateEventSession(idx, 'name', e.target.value)} />
                    <input type="date" className="w-32 p-2 text-xs bg-slate-50 rounded-lg text-right outline-none" value={session.date} onChange={e => updateEventSession(idx, 'date', e.target.value)} />
                    <button type="button" onClick={() => {
                      const newSessions = [...(eventForm.sessions || [])];
                      newSessions.splice(idx, 1);
                      setEventForm({ ...eventForm, sessions: newSessions });
                    }} className="text-red-400"><Trash2 size={16}/></button>
                </div>
             ))}
          </div>

          <div className="flex items-center gap-2 p-4 bg-yellow-50 rounded-2xl text-right"><input type="checkbox" className="w-4 h-4" checked={eventForm.isHero} onChange={e=>setEventForm({...eventForm, isHero:e.target.checked})}/><label className="text-sm font-bold">הצגה בסליידר הראשי</label></div>
          <button className="w-full py-4 bg-rose-500 text-white rounded-2xl font-black shadow-lg">שמירה</button>
        </form>
      </Modal>

      <Modal isOpen={isClassModalOpen} onClose={()=>setIsClassModalOpen(false)} title={classForm._id || classForm.id ? "עריכת חוג" : "חוג חדש"}>
        <form onSubmit={async (e)=>{
            e.preventDefault(); 
            const id = classForm._id || classForm.id;
            if(id) await api.updateClass(id, classForm);
            else await api.createClass(classForm);
            setIsClassModalOpen(false); loadTabData();
        }} className="space-y-4 text-right">
          <input placeholder="שם החוג" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={classForm.title} onChange={e=>setClassForm({...classForm, title:e.target.value})} />
          <div className="grid grid-cols-2 gap-2 text-right">
              <select className="p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={classForm.gender} onChange={e=>setClassForm({...classForm, gender:e.target.value as any})}>
                <option value="נשים">נשים</option><option value="בנות">בנות</option><option value="בנים">בנים</option>
              </select>
              <input placeholder="גילאים" className="p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={classForm.ageGroup} onChange={e=>setClassForm({...classForm, ageGroup:e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-right">
              <div className="space-y-1"><label className="text-[10px] font-bold pr-2 text-slate-400">מחיר</label><input placeholder="מחיר" type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={classForm.price} onChange={e=>setClassForm({...classForm, price:Number(e.target.value)})} /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold pr-2 text-slate-400">שם המדריך/ה</label><input placeholder="שם המדריך/ה" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={classForm.instructor} onChange={e=>setClassForm({...classForm, instructor:e.target.value})} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right">
              <div className="space-y-1"><label className="text-[10px] font-bold pr-2 text-slate-400">טלפון מדריך/ה</label><input placeholder="טלפון מדריך" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={classForm.contactPhone} onChange={e=>setClassForm({...classForm, contactPhone:e.target.value})} /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold pr-2 text-blue-400">טלפון להרשמה</label><input placeholder="טלפון להרשמה" className="w-full p-4 bg-blue-50/50 border border-blue-100 rounded-2xl font-bold text-right outline-none" value={classForm.registrationPhone} onChange={e=>setClassForm({...classForm, registrationPhone:e.target.value})} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right">
              <input placeholder="יום בשבוע" className="p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={classForm.day} onChange={e=>setClassForm({...classForm, day:e.target.value})} />
              <input type="time" className="p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={classForm.time} onChange={e=>setClassForm({...classForm, time:e.target.value})} />
          </div>
          <input placeholder="מיקום החוג" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={classForm.location} onChange={e=>setClassForm({...classForm, location:e.target.value})} />
          <div className="relative border-2 border-dashed p-6 text-center rounded-2xl text-right">
              <input type="file" onChange={e => handleFileUpload(e, setClassForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
              {classForm.image ? <img src={classForm.image} className="h-20 mx-auto rounded-lg shadow-sm" /> : <p className="text-xs font-bold text-slate-400">העלאת תמונה / החלפת קיימת</p>}
          </div>
          <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg">שמירה</button>
        </form>
      </Modal>

      <Modal isOpen={isCommunityModalOpen} onClose={()=>setIsCommunityModalOpen(false)} title={communityForm._id ? "עריכת פריט קהילה" : "הוספה לקהילה"}>
          <form onSubmit={async (e)=>{
            e.preventDefault(); 
            try {
              if(communityForm._id) await api.updateCommunityItem(communityForm._id, communityForm);
              else await api.createCommunityItem(communityForm);
              setIsCommunityModalOpen(false); loadTabData();
            } catch(err) { alert("שגיאה בשמירה."); }
          }} className="space-y-4 text-right">
            <select className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={communityForm.category} onChange={e=>setCommunityForm({...communityForm, category:e.target.value as any})}>
              <option value='גמ"חים'>גמ"חים</option><option value="שיעורי תורה">שיעורי תורה</option><option value="עסק מקומי">עסקים מקומיים</option>
            </select>
            <input required placeholder="שם הגוף/עסק" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={communityForm.title} onChange={e=>setCommunityForm({...communityForm, title:e.target.value})} />
            <div className="grid grid-cols-2 gap-2">
                <input placeholder="שעת התחלה" type="time" className="p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={communityForm.startTime} onChange={e=>setCommunityForm({...communityForm, startTime:e.target.value})} />
                <input placeholder="למי זה מיועד?" className="p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={communityForm.targetAudience} onChange={e=>setCommunityForm({...communityForm, targetAudience:e.target.value})} />
            </div>
            <input placeholder="טלפון" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={communityForm.phone} onChange={e=>setCommunityForm({...communityForm, phone:e.target.value})} />
            <input placeholder="מיקום" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={communityForm.location} onChange={e=>setCommunityForm({...communityForm, location:e.target.value})} />
            <div className="relative border-2 border-dashed p-6 text-center rounded-2xl text-right">
               <input type="file" onChange={e => handleFileUpload(e, setCommunityForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
               {communityForm.image ? <img src={communityForm.image} className="h-20 mx-auto rounded-lg shadow-sm" /> : <p className="text-xs font-bold text-slate-400">העלאת תמונה / החלפת קיימת</p>}
            </div>
            <button className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg">שמירה ופרסום</button>
          </form>
      </Modal>

    </div>
  );
};

export default AdminPage;
