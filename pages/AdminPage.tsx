import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Plus, Users, Calendar, Gift, Search, Trash2, Edit, Save, 
  X, Image as ImageIcon, BookOpen, Settings, Award, Sparkles, MessageSquare, 
  Link as LinkIcon, CheckCircle, Clock, Phone, MapPin, HeartHandshake, ChevronLeft, 
  GraduationCap, Copy, Eye, ListPlus, BarChart3, PieChart, TrendingUp, Users2,
  Quote, Megaphone, Video, PlayCircle, Trophy // נוספו אייקונים חדשים
} from 'lucide-react';
import { User, EventItem, LotteryItem, ClassItem, PersonalityProfile, CommunityItem } from '../types';
import { api } from '../services/api';

// קומפוננטת מודאל פנימית
const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-fade-in-up relative overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-black text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto no-scrollbar text-right" dir="rtl">{children}</div>
      </div>
    </div>
  );
};

// קומפוננטת כרטיס סטטיסטיקה לטאב הסיכום
const StatCard = ({ title, value, icon: Icon, color }: { title: string, value: number | string, icon: any, color: string }) => (
  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5 transition-all hover:shadow-md">
    <div className={`p-4 rounded-2xl ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
    <div className="text-right">
      <p className="text-slate-500 text-sm font-bold">{title}</p>
      <h4 className="text-2xl font-black text-slate-800">{value}</h4>
    </div>
  </div>
);

const AdminPage: React.FC<{ user: User | null, onLogin: (user: User) => void }> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'approvals' | 'users' | 'events' | 'classes' | 'lotteries' | 'community' | 'personality' | 'settings' | 'forum' | 'inspirations' | 'ads'>('summary');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data States
  const [apiUsers, setApiUsers] = useState<User[]>([]);
  const [apiEvents, setApiEvents] = useState<EventItem[]>([]);
  const [apiClasses, setApiClasses] = useState<ClassItem[]>([]);
  const [apiLotteries, setApiLotteries] = useState<LotteryItem[]>([]);
  const [communityItems, setCommunityItems] = useState<CommunityItem[]>([]);
  const [pendingData, setPendingData] = useState<{pendingUsers: User[], pendingPosts: any[]}>({pendingUsers: [], pendingPosts: []});
  const [forumPosts, setForumPosts] = useState<any[]>([]); 
  const [apiInspirations, setApiInspirations] = useState<any[]>([]); // חדש: השראה יומית
  const [apiAds, setApiAds] = useState<any[]>([]); // חדש: פרסומות
  
  // Form States
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventForm, setEventForm] = useState<Partial<EventItem & { notes?: string, targetAges?: string }>>({ 
    title: '', location: '', category: 'מוזיקה', image: '', date: '', isHero: false, 
    price: 0, earlyBirdPrice: 0, earlyBirdEndDate: '', sessions: [], notes: '', targetAges: ''
  });

  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [classForm, setClassForm] = useState<Partial<ClassItem>>({ 
    title: '', instructor: '', contactPhone: '', registrationPhone: '', day: 'ראשון', 
    time: '', location: '', price: 0, ageGroup: '', gender: 'נשים', image: '' 
  });

  const [isLotteryModalOpen, setIsLotteryModalOpen] = useState(false);
  const [lotteryForm, setLotteryForm] = useState<Partial<any>>({ 
    title: '', prize: '', prize2: '', prize3: '', drawDate: '', image: '', 
    minPointsToEnter: 0, participationType: 'everyone' 
  });

  const [isCommunityModalOpen, setIsCommunityModalOpen] = useState(false);
  const [communityForm, setCommunityForm] = useState<Partial<any>>({ 
    category: 'גמ"חים', title: '', phone: '', location: '', image: '', description: '',
    startTime: '', targetAudience: '', isPaid: false, price: 0 
  });

  // פורם השראה יומית
  const [isInspirationModalOpen, setIsInspirationModalOpen] = useState(false);
  const [inspirationForm, setInspirationForm] = useState({ _id: '', text: '', author: '' });

  // פורם פרסומות
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [adForm, setAdForm] = useState({ _id: '', type: 'image', content: '', link: '', title: '' });

  const [personalityForm, setPersonalityForm] = useState<PersonalityProfile>({ id: '1', name: '', role: '', image: '', isActive: true, questions: [] });
  const [pendingInterviews, setPendingInterviews] = useState<PersonalityProfile[]>([]); 
  const [generatedLink, setGeneratedLink] = useState(''); 
  
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<PersonalityProfile | null>(null);

  const [pointsSettings, setPointsSettings] = useState({ pointsPerRegister: 50, pointsPerEventJoin: 10, pointsPerShare: 5 });

  useEffect(() => { if (user?.isAdmin) loadTabData(); }, [activeTab, user]);

  const loadTabData = async () => {
    setLoading(true);
    try {
        const users = await fetch('https://nashi-production.up.railway.app/api/users', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json());
        setApiUsers(users || []);
        
        const approvals = await api.getAdminApprovals();
        setPendingData(approvals);
        
        const community = await api.getCommunityItems();
        setCommunityItems(community);

        const events = await api.getEvents();
        setApiEvents(events);

        const classes = await api.getClasses();
        setApiClasses(classes);

        const lotteries = await api.getLotteries();
        setApiLotteries(lotteries);

        if (activeTab === 'personality') {
            setPersonalityForm(await api.getPersonality());
            setPendingInterviews(await api.getPendingInterviews()); 
        }
        else if (activeTab === 'settings') setPointsSettings(await api.getSettings());
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
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: Function) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200; // הגדלנו מעט לטובת באנרים
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8); 
          setter((prev: any) => ({ ...prev, image: dataUrl, content: prev.type === 'image' ? dataUrl : prev.content }));
          if (activeTab === 'ads') setAdForm(prev => ({ ...prev, content: dataUrl }));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDelete = async (id: string, type: 'user' | 'event' | 'class' | 'lottery' | 'community' | 'post' | 'inspiration' | 'ad', name: string) => {
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
        loadTabData();
      } catch (err) { alert('שגיאה במחיקה'); }
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
    qs[i][f] = v;
    setPersonalityForm({ ...personalityForm, questions: qs });
  };

  const runLiveLottery = async (lotteryId: string) => {
    if(window.confirm("להפעיל את ההגרלה בשידור חי?")) {
        alert("מפעיל רולטה... הזוכה תפורסם אוטומטית בדף הבית בסיום!");
        // כאן יתבצע החיבור לסקריפט הרולטה
        await api.runLotteryLive(lotteryId);
        loadTabData();
    }
  };

  const sendPersonalBenefit = async (email: string) => {
      const res = await api.createGiftCode({ points: 100, maxUses: 1 });
      alert(`לינק הטבה נוצר: ${res.link}\nשלחי אותו למשתמשת!`);
  };

  if (!user || !user.isAdmin) return <div className="p-20 text-center font-black text-rose-500 text-2xl animate-fade-in">גישה למנהלות בלבד.</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 pt-6 px-4 md:px-8 space-y-8 overflow-x-hidden text-right" dir="rtl">
      
      {/* תפריט טאבים רספונסיבי - משופר */}
      <div className="max-w-7xl mx-auto flex overflow-x-auto md:flex-wrap no-scrollbar gap-2 bg-white p-2 rounded-[2.5rem] shadow-sm border border-slate-100 justify-start md:justify-center">
        {[
           { id: 'summary', label: 'סיכום חודשי', icon: <BarChart3 size={16} /> },
           { id: 'approvals', label: 'אישורים', icon: <CheckCircle size={16} /> },
           { id: 'users', label: 'משתמשים', icon: <Users size={16} /> },
           { id: 'events', label: 'אירועים', icon: <Calendar size={16} /> },
           { id: 'classes', label: 'חוגים', icon: <GraduationCap size={16} /> },
           { id: 'lotteries', label: 'הגרלות', icon: <Gift size={16} /> },
           { id: 'community', label: 'קהילה', icon: <HeartHandshake size={16} /> },
           { id: 'forum', label: 'פורום נשי', icon: <MessageSquare size={16} /> },
           { id: 'inspirations', label: 'השראה יומית', icon: <Quote size={16} /> },
           { id: 'ads', label: 'פרסומים', icon: <Megaphone size={16} /> },
           { id: 'personality', label: 'אשת השבוע', icon: <Sparkles size={16} /> },
           { id: 'settings', label: 'הגדרות', icon: <Settings size={16} /> },
        ].map(tab => (
           <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg scale-105' : 'hover:bg-slate-50 text-slate-500'}`}>
             {tab.icon} {tab.label}
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
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        
        {/* טאב סיכום חודשי */}
        {activeTab === 'summary' && (
          <div className="space-y-8 animate-fade-in">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="סה״כ משתמשות" value={apiUsers.length} icon={Users2} color="bg-blue-500" />
                <StatCard title="חוגים פעילים" value={apiClasses.length} icon={GraduationCap} color="bg-purple-500" />
                <StatCard title="אירועים החודש" value={apiEvents.length} icon={Calendar} color="bg-rose-500" />
                <StatCard title="נקודות שנצברו" value={apiUsers.reduce((acc, u) => acc + (u.points || 0), 0)} icon={TrendingUp} color="bg-emerald-500" />
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                   <h3 className="text-xl font-black mb-6 flex items-center gap-2"><PieChart className="text-rose-500" /> התפלגות קהילה</h3>
                   <div className="space-y-4">
                      {['גמ"חים', 'שיעורי תורה', 'עסקים מקומיים'].map(cat => (
                        <div key={cat} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                           <span className="font-bold text-slate-700">{cat}</span>
                           <span className="bg-white px-4 py-1 rounded-full text-sm font-black shadow-sm">
                             {communityItems.filter(i => i.category === cat).length} פריטים
                           </span>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                   <h3 className="text-xl font-black mb-6 flex items-center gap-2"><ShieldCheck className="text-emerald-500" /> סטטוס הרשמות</h3>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                         <span className="font-bold text-emerald-700">חברות מעגל מאושרות</span>
                         <span className="font-black text-emerald-900">{apiUsers.filter(u => u.isMemberApproved).length}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                         <span className="font-bold text-orange-700">ממתינות לאישור</span>
                         <span className="font-black text-orange-900">{pendingData.pendingUsers.length}</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* טאב אישורים */}
        {activeTab === 'approvals' && (
          <div className="grid grid-cols-1 gap-8 animate-fade-in max-w-2xl mx-auto">
            <div className="bg-white p-6 md:p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6 text-right">
               <h3 className="font-black text-xl flex items-center gap-2 text-right"><HeartHandshake className="text-rose-500"/> ממתינות למעגל</h3>
               <div className="space-y-4">
                 {pendingData.pendingUsers.map(u => (
                   <div key={u._id || u.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center animate-fade-in-up shadow-sm">
                     <div className="overflow-hidden text-right"><p className="font-black truncate">{u.name}</p><p className="text-[10px] text-slate-400 truncate">{u.occupation} | {u.phone}</p></div>
                     <button onClick={async () => {
                        await api.approveMember(u._id || u.id);
                        alert(`אישרת את ${u.name} למעגל! כעת יופיעו לה הנקודות.`);
                        loadTabData();
                     }} className="bg-green-500 text-white p-2 rounded-xl shrink-0"><CheckCircle size={20}/></button>
                   </div>
                 ))}
                 {pendingData.pendingUsers.length === 0 && <p className="text-center text-slate-400 italic">אין בקשות חדשות</p>}
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
                      {pendingData.pendingPosts.map(p => (
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
                      {pendingData.pendingPosts.length === 0 && <p className="text-slate-400 text-center italic py-4">אין פוסטים הממתינים לאישור</p>}
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
            <button onClick={() => { setInspirationForm({ _id: '', text: '', author: '' }); setIsInspirationModalOpen(true); }} className="w-full md:w-auto bg-slate-900 text-white px-8 py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:shadow-lg transition-all"><Plus/> השראה חדשה</button>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {apiInspirations.map(insp => (
                <div key={insp._id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border-r-4 border-rose-400 flex flex-col justify-between">
                  <div>
                    <Quote className="text-rose-200 mb-2" size={32} />
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
                <p className="text-sm text-blue-700 leading-relaxed">כדי שהפרסומות יראו מושלם באתר, מומלץ להעלות קבצים במידות הבאות:</p>
                <ul className="text-xs font-bold text-blue-600 mt-2 list-disc list-inside">
                  <li>באנר רוחב (דסקטופ): 1920x600 פיקסלים</li>
                  <li>באנר ריבוע (מובייל/סליידר): 1080x1080 פיקסלים</li>
                  <li>משקל מקסימלי: 1MB (הקוד מבצע אופטימיזציה אוטומטית)</li>
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
                      <span className="text-xs font-mono">{ad.content.substring(0,30)}...</span>
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
        {activeTab === 'users' && (
          <div className="bg-white rounded-[3rem] shadow-sm overflow-hidden border border-slate-100 animate-fade-in overflow-x-auto">
            <table className="w-full text-right min-w-[500px]">
              <thead className="bg-slate-50 text-slate-500 text-xs font-black uppercase">
                <tr><th className="p-6 text-right">שם</th><th className="p-6 text-right">ניקוד</th><th className="p-6 text-right">סטטוס</th><th className="p-6 text-right">פעולות</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {apiUsers.filter(u => u.name.includes(searchTerm)).map(u => (
                  <tr key={u._id || u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-6 font-bold">{u.name}<br/><span className="text-[10px] text-slate-400">{u.email}</span></td>
                    <td className="p-6 font-black text-rose-500">{u.points}</td>
                    <td className="p-6 text-xs">{u.isMemberApproved ? 'חברת מעגל' : 'רשומה'}</td>
                    <td className="p-6 flex gap-2">
                        <button onClick={() => sendPersonalBenefit(u.email)} className="p-2 bg-yellow-50 text-yellow-600 rounded-xl hover:scale-110 transition-transform"><Award size={18}/></button>
                        <button onClick={() => handleDelete(u._id || u.id, 'user', u.name)} className="p-2 bg-red-50 text-red-600 rounded-xl hover:scale-110 transition-transform"><Trash2 size={18}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* טאב אירועים */}
        {activeTab === 'events' && (
          <div className="space-y-6 animate-fade-in">
            <button onClick={() => { setEventForm({ title: '', location: '', category: 'מוזיקה', image: '', date: '', isHero: false, price: 0, earlyBirdPrice: 0, earlyBirdEndDate: '', sessions: [], notes: '', targetAges: '' }); setIsEventModalOpen(true); }} className="w-full md:w-auto bg-rose-600 text-white px-8 py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:shadow-lg transition-all"><Plus/> אירוע חדש</button>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {apiEvents.map(ev => (
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
          </div>
        )}

        {/* טאב חוגים */}
        {activeTab === 'classes' && (
          <div className="space-y-6 animate-fade-in">
            <button onClick={() => { setClassForm({ title: '', instructor: '', contactPhone: '', registrationPhone: '', day: 'ראשון', time: '', location: '', price: 0, ageGroup: '', gender: 'נשים', image: '' }); setIsClassModalOpen(true); }} className="w-full md:w-auto bg-slate-900 text-white px-8 py-3 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg"><Plus/> חוג חדש</button>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-right">
              {apiClasses.map(c => (
                <div key={c._id || c.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 animate-fade-in-up shadow-sm">
                  <img src={c.image} className="w-full h-32 md:h-40 object-cover rounded-2xl mb-4" />
                  <h4 className="font-black text-lg">{c.title}</h4>
                  <p className="text-xs text-slate-500 font-bold">{c.instructor} | {c.gender}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{c.day} ב-{c.time} | {c.location}</p>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => { setClassForm(c); setIsClassModalOpen(true); }} className="text-blue-500 p-2 hover:bg-blue-50 rounded-lg"><Edit size={16}/></button>
                    <button onClick={() => handleDelete(c._id || c.id, 'class', c.title)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* טאב הגרלות */}
        {activeTab === 'lotteries' && (
          <div className="space-y-6 animate-fade-in">
            <button onClick={() => { setLotteryForm({ title: '', prize: '', prize2: '', prize3: '', drawDate: '', image: '', minPointsToEnter: 0, participationType: 'everyone' }); setIsLotteryModalOpen(true); }} className="w-full md:w-auto bg-purple-600 text-white px-8 py-3 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg"><Plus/> הגרלה חדשה</button>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-right">
              {apiLotteries.map(l => (
                <div key={l._id || l.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm animate-fade-in-up flex flex-col justify-between">
                  <div>
                    <img src={l.image} className="w-full h-32 md:h-40 object-cover rounded-2xl mb-4" />
                    <h4 className="font-black text-lg">{l.title}</h4>
                    <div className="space-y-1 mt-2">
                        <p className="text-[10px] text-emerald-600 font-bold">🎁 פרס 1: {l.prize}</p>
                        {l.prize2 && <p className="text-[10px] text-slate-500">🎁 פרס 2: {l.prize2}</p>}
                        {l.prize3 && <p className="text-[10px] text-slate-500">🎁 פרס 3: {l.prize3}</p>}
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl mt-3">
                        <p className="text-[10px] font-bold text-slate-500">זכאות: {l.participationType === 'everyone' ? 'כולן' : l.participationType === 'points' ? `מעל ${l.minPointsToEnter} נק'` : 'לינק בלבד'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 mt-4 pt-4 border-t">
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

        {/* טאב אשת השבוע */}
        {activeTab === 'personality' && (
          <div className="max-w-4xl mx-auto space-y-12 animate-fade-in text-right">
            <div className="bg-white p-8 md:p-10 rounded-[3.5rem] shadow-xl border border-rose-50 space-y-8">
              <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3"><Sparkles className="text-rose-500"/> ניהול אשת השבוע</h3>
                {personalityForm.name && (
                  <button onClick={async () => {
                      if(window.confirm("למחוק את אשת השבוע הנוכחית מהאתר?")) {
                        await api.updatePersonality({ name: '', role: '', image: '', questions: [], isActive: false });
                        alert("נמחק!"); loadTabData();
                      }
                  }} className="text-red-500 font-bold text-xs hover:underline">מחיקת אשת שבוע נוכחית</button>
                )}
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

              <div className="flex flex-col gap-4">
                <button onClick={async () => { await api.updatePersonality({...personalityForm, isActive: true}); alert('האתר עודכן!'); }} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black shadow-xl hover:bg-rose-600 transition-all text-center">עדכון ישיר של הכתבה באתר</button>
                
                <div className="space-y-3 pt-6 border-t">
                  <button onClick={async () => { 
                      const res = await api.generateInterviewLink(personalityForm); 
                      const fullLink = `${window.location.origin}/#/interview/${res.token || res.id}`;
                      setGeneratedLink(fullLink);
                  }} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-md hover:bg-blue-700 transition-all">
                    <LinkIcon size={18}/> הפקת לינק עם השאלות שהגדרתי
                  </button>

                  {generatedLink && (
                    <div className="p-4 bg-blue-50 rounded-2xl border-2 border-blue-100 flex items-center gap-3 animate-fade-in-up">
                      <input readOnly className="flex-1 bg-transparent font-mono text-[10px] text-blue-800 text-left outline-none overflow-hidden" value={generatedLink} />
                      <button onClick={() => { navigator.clipboard.writeText(generatedLink); alert("הלינק הועתק!"); }} className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"><Copy size={16}/></button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {pendingInterviews.length > 0 && (
               <div className="space-y-4">
                  <h4 className="font-black text-xl text-slate-700 pr-4">ראיונות שהושלמו וממתינים לאישורך:</h4>
                  {pendingInterviews.map((interview) => (
                    <div key={interview._id || interview.id} className="bg-white p-6 rounded-[2.5rem] shadow-md border-r-8 border-emerald-500 flex justify-between items-center animate-fade-in-up">
                       <div className="text-right">
                          <p className="font-black text-xl text-slate-800">{interview.name}</p>
                          <p className="text-sm text-slate-500">{interview.role}</p>
                       </div>
                       <div className="flex gap-2">
                          <button 
                            onClick={() => { setSelectedInterview(interview); setIsPreviewModalOpen(true); }}
                            className="bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl font-black hover:bg-slate-200 transition-all flex items-center gap-2"
                          >
                             <Eye size={18}/> צפייה בראיון
                          </button>
                          <button onClick={async () => { await api.approvePersonality(interview._id || interview.id); alert("אשת השבוע עודכנה באתר!"); loadTabData(); }} className="bg-emerald-500 text-white px-8 py-3 rounded-2xl font-black hover:bg-emerald-600 transition-all shadow-md">אישור ופרסום</button>
                       </div>
                    </div>
                  ))}
               </div>
            )}
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

      {/* מודאלים מורחבים */}
      
      {/* מודאל השראה יומית */}
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
          <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg">שמירת השראה</button>
        </form>
      </Modal>

      {/* מודאל פרסומים */}
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

          <div className="grid grid-cols-2 gap-2 text-right">
              <div className="space-y-1">
                <label className="text-[10px] font-bold pr-2 text-slate-400">מחיר קבוע</label>
                <input required placeholder="מחיר קבוע" type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={eventForm.price} onChange={e=>setEventForm({...eventForm, price:Number(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold pr-2 text-rose-400">מחיר מכירה מוקדמת</label>
                <input placeholder="מכירה מוקדמת" type="number" className="w-full p-4 bg-rose-50 rounded-2xl font-bold outline-none text-right border border-rose-100" value={eventForm.earlyBirdPrice} onChange={e=>setEventForm({...eventForm, earlyBirdPrice:Number(e.target.value)})} />
              </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-right">
              <div className="space-y-1">
                <label className="text-[10px] font-bold pr-2 text-slate-400">תאריך האירוע</label>
                <input required type="date" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={eventForm.date?.split('T')[0]} onChange={e=>setEventForm({...eventForm, date:e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold pr-2 text-rose-400">סיום מכירה מוקדמת</label>
                <input type="date" className="w-full p-4 bg-rose-50 rounded-2xl font-bold outline-none text-right border border-rose-100" value={eventForm.earlyBirdEndDate} onChange={e=>setEventForm({...eventForm, earlyBirdEndDate:e.target.value})} />
              </div>
          </div>

          <input required placeholder="מיקום" className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-right" value={eventForm.location} onChange={e=>setEventForm({...eventForm, location:e.target.value})} />
          
          <input placeholder="גילאים (אופציונלי)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-right font-bold" value={eventForm.targetAges} onChange={e=>setEventForm({...eventForm, targetAges:e.target.value})} />
          
          <textarea placeholder="הערות נוספות (אופציונלי)" className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-right font-bold h-20" value={eventForm.notes} onChange={e=>setEventForm({...eventForm, notes:e.target.value})} />

          {/* ניהול מפגשים נוספים */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
             <div className="flex justify-between items-center">
                <h4 className="font-black text-sm text-slate-700">מפגשים נוספים באירוע</h4>
                <button type="button" onClick={addEventSession} className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg flex items-center gap-1"><Plus size={14}/> הוספת מפגש</button>
             </div>
             {eventForm.sessions?.map((session, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-xl border border-slate-200 animate-fade-in-up">
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
          
          <div className="relative border-2 border-dashed p-6 text-center rounded-2xl text-right">
              <input type="file" onChange={e => handleFileUpload(e, setEventForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
              {eventForm.image ? <img src={eventForm.image} className="h-20 mx-auto rounded-lg shadow-sm" /> : <p className="text-xs font-bold text-slate-400">לחצי להעלאת תמונה / החלפת קיימת</p>}
          </div>
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
                <option value="נשים">נשים</option>
                <option value="בנות">בנות</option>
                <option value="בנים">בנים</option>
              </select>
              <input placeholder="גילאים" className="p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={classForm.ageGroup} onChange={e=>setClassForm({...classForm, ageGroup:e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-right">
              <div className="space-y-1 text-right">
                <label className="text-[10px] font-bold pr-2 text-slate-400">מחיר</label>
                <input placeholder="מחיר" type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={classForm.price} onChange={e=>setClassForm({...classForm, price:Number(e.target.value)})} />
              </div>
              <div className="space-y-1 text-right">
                <label className="text-[10px] font-bold pr-2 text-slate-400">שם המדריך/ה</label>
                <input placeholder="שם המדריך/ה" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={classForm.instructor} onChange={e=>setClassForm({...classForm, instructor:e.target.value})} />
              </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-right">
              <div className="space-y-1">
                <label className="text-[10px] font-bold pr-2 text-slate-400">טלפון מדריך</label>
                <input placeholder="טלפון מדריך" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={classForm.contactPhone} onChange={e=>setClassForm({...classForm, contactPhone:e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold pr-2 text-blue-400">טלפון להרשמה</label>
                <input placeholder="טלפון להרשמה" className="w-full p-4 bg-blue-50/50 border border-blue-100 rounded-2xl font-bold text-right outline-none" value={classForm.registrationPhone} onChange={e=>setClassForm({...classForm, registrationPhone:e.target.value})} />
              </div>
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
              <option value='גמ"חים'>גמ"חים</option>
              <option value="שיעורי תורה">שיעורי תורה</option>
              <option value="עסק מקומי">עסקים מקומיים</option>
            </select>
            <input required placeholder="שם הגוף/עסק" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={communityForm.title} onChange={e=>setCommunityForm({...communityForm, title:e.target.value})} />
            <div className="grid grid-cols-2 gap-2">
               <input placeholder="שעת התחלה (אופציונלי)" type="time" className="p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={communityForm.startTime} onChange={e=>setCommunityForm({...communityForm, startTime:e.target.value})} />
               <input placeholder="למי זה מיועד?" className="p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={communityForm.targetAudience} onChange={e=>setCommunityForm({...communityForm, targetAudience:e.target.value})} />
            </div>
            <input placeholder="טלפון" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={communityForm.phone} onChange={e=>setCommunityForm({...communityForm, phone:e.target.value})} />
            <input placeholder="מיקום" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={communityForm.location} onChange={e=>setCommunityForm({...communityForm, location:e.target.value})} />
            
            {(communityForm.category === 'שיעורי תורה' || communityForm.category === 'גמ"חים') && (
               <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                     <label className="font-bold text-slate-700">האם בתשלום?</label>
                     <input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={communityForm.isPaid} onChange={e => setCommunityForm({...communityForm, isPaid: e.target.checked})} />
                  </div>
                  {communityForm.isPaid && (
                     <input placeholder="מחיר" type="number" className="w-full p-4 bg-emerald-50 border border-emerald-100 rounded-2xl font-bold text-right outline-none" value={communityForm.price} onChange={e=>setCommunityForm({...communityForm, price: Number(e.target.value)})} />
                  )}
               </div>
            )}

            <div className="relative border-2 border-dashed p-6 text-center rounded-2xl text-right">
               <input type="file" onChange={e => handleFileUpload(e, setCommunityForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
               {communityForm.image ? <img src={communityForm.image} className="h-20 mx-auto rounded-lg shadow-sm" /> : <p className="text-xs font-bold text-slate-400">העלאת תמונה / החלפת קיימת</p>}
            </div>
            <button className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg">שמירה ופרסום</button>
          </form>
      </Modal>

      <Modal isOpen={isLotteryModalOpen} onClose={()=>setIsLotteryModalOpen(false)} title={lotteryForm._id ? "עריכת הגרלה" : "הגרלה חדשה"}>
        <form onSubmit={async (e)=>{
            e.preventDefault(); 
            try {
                const data = {...lotteryForm};
                if(!data._id) delete data._id;
                if(lotteryForm._id) await api.updateLottery(lotteryForm._id, data);
                else await api.createLottery(data);
                alert("ההגרלה נשמרה!");
                setIsLotteryModalOpen(false); loadTabData();
            } catch(err: any) { alert("שגיאה: " + err.message); }
        }} className="space-y-4">
            <input required placeholder="שם ההגרלה" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={lotteryForm.title} onChange={e=>setLotteryForm({...lotteryForm, title:e.target.value})} />
            
            <div className="space-y-2">
                <input required placeholder="פרס ראשון 🏆" className="w-full p-4 bg-emerald-50 border border-emerald-100 rounded-2xl font-black outline-none text-right" value={lotteryForm.prize} onChange={e=>setLotteryForm({...lotteryForm, prize:e.target.value})} />
                <input placeholder="פרס שני (אופציונלי)" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={lotteryForm.prize2} onChange={e=>setLotteryForm({...lotteryForm, prize2:e.target.value})} />
                <input placeholder="פרס שלישי (אופציונלי)" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={lotteryForm.prize3} onChange={e=>setLotteryForm({...lotteryForm, prize3:e.target.value})} />
            </div>

            <div className="space-y-3 bg-purple-50 p-5 rounded-[2rem] border border-purple-100">
                <h4 className="font-black text-xs text-purple-700">מי זכאית להשתתף?</h4>
                <select className="w-full p-3 bg-white rounded-xl font-bold text-xs outline-none" value={lotteryForm.participationType} onChange={e=>setLotteryForm({...lotteryForm, participationType: e.target.value})}>
                    <option value="everyone">כולן (כל מי שלוחצת "להשתתפות")</option>
                    <option value="points">סף נקודות מסוים (שאת מגדירה)</option>
                    <option value="link_only">לינק אישי בלבד (שנשלח למשתמשת)</option>
                </select>
                {lotteryForm.participationType === 'points' && (
                    <input type="number" placeholder="כמה נקודות מינימום?" className="w-full p-3 bg-white rounded-xl font-black text-xs outline-none" value={lotteryForm.minPointsToEnter} onChange={e=>setLotteryForm({...lotteryForm, minPointsToEnter: Number(e.target.value)})} />
                )}
            </div>

            <input required type="datetime-local" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={lotteryForm.drawDate} onChange={e=>setLotteryForm({...lotteryForm, drawDate:e.target.value})} />
            
            <div className="relative border-2 border-dashed p-6 text-center rounded-2xl text-right">
               <input type="file" onChange={e => handleFileUpload(e, setLotteryForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
               {lotteryForm.image ? <img src={lotteryForm.image} className="h-20 mx-auto rounded-lg shadow-sm" /> : <p className="text-xs font-bold text-slate-400">העלאת תמונת פרס / החלפת קיימת</p>}
            </div>
            <button className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black shadow-lg">שמירה ופרסום הגרלה</button>
        </form>
      </Modal>

    </div>
  );
};

export default AdminPage;