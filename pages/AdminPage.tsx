import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Plus, Users, Calendar, Gift, Search, Trash2, Edit, Save, 
  LogIn, BookOpen, X, Eye, Send, Activity, Upload, Image as ImageIcon,
  Settings, Award, Copy, Sparkles, MessageSquare, PlayCircle
} from 'lucide-react';
import { User, EventItem, LotteryItem, ClassItem, UserLevel, LotteryEligibilityType, Review, PersonalityProfile } from '../types';
import { useNavigate } from 'react-router-dom';

// --- API Helper ---
const API_URL = 'https://nashi-production.up.railway.app/api';

const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
    ...options.headers,
  };
  try {
    const res = await fetch(`${API_URL}${url}`, { ...options, headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  } catch (err) {
    console.error("API Error:", err);
    throw err;
  }
};

// --- Helper: Convert File to Base64 ---
const convertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

interface AdminPageProps {
  user: User | null;
  onLogin: (user: User) => void;
  // נשאר למען תאימות, אך המידע מגיע מהשרת
  events?: EventItem[];
  classes?: ClassItem[];
  lotteries?: LotteryItem[];
  reviews?: Review[];
  personality?: PersonalityProfile;
  
  onAddEvent?: (event: EventItem) => void;
  onUpdateEvent?: (event: EventItem) => void;
  onDeleteEvent?: (id: string) => void;
  
  onAddClass?: (cls: ClassItem) => void;
  onUpdateClass?: (cls: ClassItem) => void;
  onDeleteClass?: (id: string) => void;
  
  onAddLottery?: (lottery: LotteryItem) => void;
  onUpdateLottery?: (lottery: LotteryItem) => void;
  onDeleteLottery?: (id: string) => void;
  
  onUpdatePersonality?: (p: PersonalityProfile) => void;
}

const Modal: React.FC<{isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode}> = ({isOpen, onClose, title, children}) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in-up border border-white/50">
                <div className="sticky top-0 bg-white/95 backdrop-blur-sm p-6 border-b border-slate-100 flex justify-between items-center z-10">
                    <h3 className="text-xl font-black text-slate-800">{title}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

const AdminPage: React.FC<AdminPageProps> = ({ 
    user, onLogin, 
    personality: initialPersonality 
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'events' | 'users' | 'lotteries' | 'classes' | 'reviews' | 'personality' | 'settings' | 'gifts'>('users');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [systemMessage, setSystemMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  // Real Data State (Fetched from API)
  const [apiUsers, setApiUsers] = useState<User[]>([]);
  const [apiEvents, setApiEvents] = useState<EventItem[]>([]);
  const [apiClasses, setApiClasses] = useState<ClassItem[]>([]);
  const [apiLotteries, setApiLotteries] = useState<LotteryItem[]>([]);
  const [apiReviews, setApiReviews] = useState<Review[]>([]); // נתונים לחוות דעת
  
  const [settings, setSettings] = useState({
    pointsPerRegister: 50,
    pointsPerEventJoin: 10,
    pointsPerShare: 5
  });
  
  const [giftForm, setGiftForm] = useState({ code: '', points: 100, maxUses: 100 });
  const [createdGiftLink, setCreatedGiftLink] = useState<string | null>(null);

  // Modals State
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isLotteryModalOpen, setIsLotteryModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  
  // Forms
  const [eventForm, setEventForm] = useState<Partial<EventItem>>({ title: '', location: '', category: '', price: 0, image: '', tags: [], isHero: false });
  const [classForm, setClassForm] = useState<Partial<ClassItem>>({ title: '', instructor: '', contactPhone: '', day: 'ראשון', time: '17:00', location: '', price: 0, ageGroup: '', category: '', image: '' });
  const [lotteryForm, setLotteryForm] = useState<Partial<LotteryItem>>({ 
      title: '', prize: '', drawDate: '', image: '', participants: [], isActive: true,
      eligibilityType: 'all', minPointsToEnter: 0, minLevel: UserLevel.BEGINNER, specificUserId: ''
  });
  const [personalityForm, setPersonalityForm] = useState<PersonalityProfile | undefined>(initialPersonality || {
      id: '1', name: '', role: '', image: '', isActive: true, questions: [{question: '', answer: ''}]
  });

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingLotteryId, setEditingLotteryId] = useState<string | null>(null);


  // --- Load Data on Tab Change ---
  useEffect(() => {
    if (user?.isAdmin) {
        loadTabData();
    }
  }, [activeTab, user]);

  const loadTabData = async () => {
    setLoading(true);
    setSystemMessage(null);
    try {
        if (activeTab === 'users') {
            const data = await authFetch('/users');
            setApiUsers(data.map((u: any) => ({ ...u, id: u._id || u.id })));
        } else if (activeTab === 'events') {
            const data = await authFetch('/events');
            setApiEvents(data.map((e: any) => ({ ...e, id: e._id || e.id })));
        } else if (activeTab === 'classes') {
            const data = await authFetch('/classes');
            setApiClasses(data.map((c: any) => ({ ...c, id: c._id || c.id })));
        } else if (activeTab === 'lotteries') {
            const data = await authFetch('/lotteries');
            setApiLotteries(data.map((l: any) => ({ ...l, id: l._id || l.id })));
        } else if (activeTab === 'settings') {
            const data = await authFetch('/admin/settings');
            setSettings(data);
        }
        // Reviews and Personality might need their own endpoints later, keeping mocks/props for now if API not ready
    } catch (err) {
        console.error("Failed to load data", err);
    } finally {
        setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const res = await authFetch('/login', { method: 'POST', body: JSON.stringify({ email: loginForm.username, password: loginForm.password }) });
        if (res.user && res.user.isAdmin) {
            localStorage.setItem('token', res.token);
            onLogin(res.user);
        } else { setError('אין הרשאת ניהול'); }
    } catch { setError('שגיאה בהתחברות'); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setForm: Function) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB Limit
        alert('הקובץ גדול מדי! נא להעלות תמונה עד 5MB');
        return;
      }
      const base64 = await convertToBase64(file);
      setForm((prev: any) => ({ ...prev, image: base64 }));
    }
  };

  // --- Handlers: Gamification ---
  const handleUpdateSettings = async () => {
      try { await authFetch('/admin/settings', { method: 'PUT', body: JSON.stringify(settings) }); setSystemMessage({type:'success', text:'הגדרות נשמרו'}); } 
      catch { setSystemMessage({type:'error', text:'שגיאה בשמירה'}); }
  };

  const handleCreateGift = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          const res = await authFetch('/admin/gifts', { method: 'POST', body: JSON.stringify(giftForm) });
          setCreatedGiftLink(res.link);
          setSystemMessage({type:'success', text:'הלינק נוצר בהצלחה!'});
      } catch { setSystemMessage({type:'error', text:'שגיאה ביצירה'}); }
  };

  const handleSendPoints = async (userId: string) => {
      const amountStr = prompt('כמה נקודות לשלוח למשתמשת?');
      if (!amountStr) return;
      const amount = parseInt(amountStr);
      if (isNaN(amount)) return;

      try {
          await authFetch(`/admin/users/${userId}/points`, { method: 'POST', body: JSON.stringify({ points: amount }) });
          setSystemMessage({ type: 'success', text: `נשלחו ${amount} נקודות בהצלחה!` });
          loadTabData();
      } catch { setSystemMessage({ type: 'error', text: 'שגיאה בשליחה' }); }
  };

  // --- Handlers: Content ---
  const handleOpenEventModal = (event?: EventItem) => {
      if (event) {
          setEditingEventId(event.id);
          setEventForm(event);
      } else {
          setEditingEventId(null);
          setEventForm({ title: '', location: '', category: '', price: 0, image: '', tags: [], isHero: false });
      }
      setIsEventModalOpen(true);
  };

  const saveEvent = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          // If editing logic exists in API, use PUT, otherwise POST creates new
          await authFetch('/events', { method: 'POST', body: JSON.stringify(eventForm) });
          setSystemMessage({ type: 'success', text: 'אירוע נשמר בהצלחה!' });
          setIsEventModalOpen(false);
          loadTabData();
      } catch { alert('שגיאה בשמירה'); }
  };

  const deleteEvent = async (id: string) => {
      if(!confirm('האם את בטוחה שברצונך למחוק?')) return;
      try {
          await authFetch(`/events/${id}`, { method: 'DELETE' });
          loadTabData();
      } catch { alert('שגיאה במחיקה'); }
  };

  // Same logic for Classes
  const handleOpenClassModal = (cls?: ClassItem) => {
      if (cls) { setEditingClassId(cls.id); setClassForm(cls); } 
      else { setEditingClassId(null); setClassForm({ title: '', instructor: '', contactPhone: '', day: 'ראשון', time: '17:00', location: '', price: 0, ageGroup: '', category: '', image: '' }); }
      setIsClassModalOpen(true);
  };

  const saveClass = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await authFetch('/classes', { method: 'POST', body: JSON.stringify(classForm) });
          setSystemMessage({ type: 'success', text: 'חוג נשמר בהצלחה!' });
          setIsClassModalOpen(false);
          loadTabData();
      } catch { alert('שגיאה בשמירה'); }
  };

  // Same logic for Lotteries
  const handleOpenLotteryModal = (lottery?: LotteryItem) => {
      if (lottery) { setEditingLotteryId(lottery.id); setLotteryForm(lottery); }
      else { setEditingLotteryId(null); setLotteryForm({ title: '', prize: '', drawDate: '', image: '', participants: [], isActive: true, eligibilityType: 'all', minPointsToEnter: 0, minLevel: UserLevel.BEGINNER }); }
      setIsLotteryModalOpen(true);
  };

  const saveLottery = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await authFetch('/lotteries', { method: 'POST', body: JSON.stringify(lotteryForm) });
          setSystemMessage({ type: 'success', text: 'הגרלה נשמרה בהצלחה!' });
          setIsLotteryModalOpen(false);
          loadTabData();
      } catch { alert('שגיאה בשמירה'); }
  };
  
  const handleSavePersonality = () => {
     alert('פונקציונליות שמירת אישיות תחובר לשרת בקרוב. כרגע זה מקומי.');
  };

  // --- Render Login ---
  if (!user || !user.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 w-full">
        <div className="bg-white p-8 rounded-[2rem] shadow-xl w-full max-w-md border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center text-white mx-auto mb-4 shadow-xl shadow-slate-300">
              <ShieldCheck size={40} />
            </div>
            <h2 className="text-3xl font-black text-slate-800">כניסת ניהול</h2>
            <p className="text-slate-500 mt-2">אזור זה מוגבל לצוות הניהול בלבד</p>
          </div>
          <form onSubmit={handleAdminLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 mr-1">אימייל / שם משתמש</label>
              <input type="text" className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                value={loginForm.username} onChange={(e) => setLoginForm({...loginForm, username: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 mr-1">סיסמה</label>
              <input type="password" className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                value={loginForm.password} onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} />
            </div>
            {error && <p className="text-red-500 text-sm font-bold bg-red-50 p-3 rounded-lg text-center">{error}</p>}
            <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-rose-600 transition-all shadow-lg hover:shadow-rose-200 flex items-center justify-center gap-2 mt-4">
              <LogIn size={20} />
              התחברות למערכת
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Render Dashboard ---
  return (
    <div className="space-y-8 w-full pb-10">
      {/* Header */}
      <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-slate-100 flex flex-col xl:flex-row justify-between items-center gap-6">
         <div className="text-center xl:text-right">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">לוח בקרה ניהולי</h1>
            <p className="text-slate-500">ניהול שוטף של כלל המודולים במערכת</p>
         </div>
         <div className="flex flex-wrap justify-center bg-slate-50 p-2 rounded-[2rem] gap-2 w-full md:w-auto">
           {[
             { id: 'users', label: 'משתמשים', icon: <Users size={18} /> },
             { id: 'events', label: 'אירועים', icon: <Calendar size={18} /> },
             { id: 'classes', label: 'חוגים', icon: <BookOpen size={18} /> },
             { id: 'lotteries', label: 'הגרלות', icon: <Gift size={18} /> },
             { id: 'reviews', label: 'חוות דעת', icon: <MessageSquare size={18} /> },
             { id: 'personality', label: 'אישיות השבוע', icon: <Sparkles size={18} /> },
             { id: 'gifts', label: 'מתנות וקופונים', icon: <Award size={18} /> },
             { id: 'settings', label: 'הגדרות', icon: <Settings size={18} /> },
           ].map(tab => (
             <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
               className={`flex items-center gap-2 px-4 md:px-5 py-3 rounded-2xl text-xs md:text-sm font-bold transition-all flex-1 md:flex-none justify-center ${activeTab === tab.id ? 'bg-white text-rose-600 shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
             >
               {tab.icon}
               <span className="hidden md:inline">{tab.label}</span>
             </button>
           ))}
         </div>
      </div>

      {systemMessage && (
        <div className={`p-4 rounded-xl text-center font-bold animate-fade-in ${systemMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {systemMessage.text}
        </div>
      )}

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden min-h-[500px]">
        
        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="p-4 md:p-6">
             <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex items-center gap-4">
                    <h3 className="text-xl font-bold text-slate-800">רשימת משתמשים ({apiUsers.length})</h3>
                    {loading && <Activity className="animate-spin text-rose-500" size={20} />}
                </div>
                <div className="relative w-full md:w-auto">
                   <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                   <input type="text" placeholder="חיפוש משתמשת..." className="w-full md:w-64 pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
                </div>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-right min-w-[600px]">
                   <thead className="bg-slate-50 text-slate-600 font-bold">
                     <tr>
                       <th className="p-4 rounded-r-xl">שם מלא</th>
                       <th className="p-4">פרטי קשר</th>
                       <th className="p-4">נקודות</th>
                       <th className="p-4">סטטוס</th>
                       <th className="p-4 rounded-l-xl">פעולות</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {apiUsers.map(u => (
                       <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-bold text-slate-800 flex items-center gap-2">
                             <img src={u.avatar || 'https://via.placeholder.com/40'} className="w-8 h-8 rounded-full bg-slate-200" alt="" />
                             {u.name}
                             {u.isAdmin && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">מנהלת</span>}
                          </td>
                          <td className="p-4">{u.email}<br/><span className="text-slate-400 text-xs">{u.phone}</span></td>
                          <td className="p-4 font-mono text-rose-600 font-bold">{u.points}</td>
                          <td className="p-4"><span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">{u.isAdmin ? 'צוות' : 'רשומה'}</span></td>
                          <td className="p-4 flex gap-2">
                             <button onClick={() => {setSelectedUser(u); setIsUserModalOpen(true);}} className="text-slate-400 hover:text-rose-600 transition-colors bg-slate-50 p-2 rounded-full"><Eye size={18} /></button>
                             <button 
                                onClick={() => handleSendPoints(u.id)} 
                                title="שלח נקודות"
                                className="text-blue-400 hover:text-blue-600 transition-colors bg-blue-50 p-2 rounded-full"
                             >
                                <Send size={18} />
                             </button>
                          </td>
                       </tr>
                     ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}

        {/* EVENTS TAB */}
        {activeTab === 'events' && (
           <div className="p-4 md:p-6">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-bold text-slate-800">אירועים ({apiEvents.length})</h3>
                 <button onClick={() => handleOpenEventModal()} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-rose-600 transition-colors">
                    <Plus size={18} /> <span className="hidden md:inline">הוספת אירוע</span>
                 </button>
              </div>

              <div className="grid gap-4">
                  {apiEvents.map(event => (
                      <div key={event.id} className="flex flex-col md:flex-row md:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
                          <img src={event.image || 'https://via.placeholder.com/150'} alt="" className="w-full md:w-24 h-32 md:h-24 rounded-xl object-cover bg-slate-100" />
                          <div className="flex-1">
                              <h4 className="font-bold text-slate-800">{event.title} {event.isHero && <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full mr-2">מקודם בראשי</span>}</h4>
                              <p className="text-xs text-slate-500">{new Date(event.date).toLocaleDateString()} | {event.location}</p>
                              <span className="inline-block mt-2 px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600">{event.category}</span>
                          </div>
                          <div className="flex gap-2 justify-end self-start md:self-center">
                             <button onClick={() => deleteEvent(event.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                          </div>
                      </div>
                  ))}
              </div>

              <Modal isOpen={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} title="הוספת אירוע">
                  <form onSubmit={saveEvent} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input required placeholder="שם האירוע" className="p-3 rounded-xl border border-slate-200 w-full bg-slate-50" value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} />
                          <input required placeholder="מיקום" className="p-3 rounded-xl border border-slate-200 w-full bg-slate-50" value={eventForm.location} onChange={e => setEventForm({...eventForm, location: e.target.value})} />
                          <input required type="date" className="p-3 rounded-xl border border-slate-200 w-full bg-slate-50" value={eventForm.date ? new Date(eventForm.date).toISOString().split('T')[0] : ''} onChange={e => setEventForm({...eventForm, date: e.target.value})} />
                          <input required type="number" placeholder="מחיר" className="p-3 rounded-xl border border-slate-200 w-full bg-slate-50" value={eventForm.price} onChange={e => setEventForm({...eventForm, price: Number(e.target.value)})} />
                          <input required placeholder="קטגוריה" className="p-3 rounded-xl border border-slate-200 w-full bg-slate-50" value={eventForm.category} onChange={e => setEventForm({...eventForm, category: e.target.value})} />
                          
                          <div className="md:col-span-2 border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50 relative">
                               <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setEventForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
                               {eventForm.image ? (
                                   <img src={eventForm.image} className="h-32 mx-auto rounded object-cover" />
                               ) : (
                                   <div className="text-slate-500 flex flex-col items-center">
                                       <Upload size={30} />
                                       <span className="mt-2 text-sm font-bold">לחצי כאן להעלאת תמונה</span>
                                   </div>
                               )}
                          </div>
                          
                          <div className="md:col-span-2 flex items-center gap-2 bg-slate-50 p-3 rounded-xl">
                              <input type="checkbox" checked={eventForm.isHero} onChange={e => setEventForm({...eventForm, isHero: e.target.checked})} className="w-5 h-5 accent-rose-500" />
                              <span className="text-sm font-bold text-slate-700">הצג בסליידר הראשי (דף הבית)</span>
                          </div>
                      </div>
                      <button type="submit" className="w-full py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 flex justify-center items-center gap-2">
                          <Save size={18} /> שמירה ועדכון
                      </button>
                  </form>
              </Modal>
           </div>
        )}

        {/* CLASSES TAB */}
        {activeTab === 'classes' && (
           <div className="p-4 md:p-6">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-bold text-slate-800">חוגים ({apiClasses.length})</h3>
                 <button onClick={() => handleOpenClassModal()} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200">
                    <Plus size={18} /> <span className="hidden md:inline">הוספת חוג</span>
                 </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {apiClasses.map(cls => (
                      <div key={cls.id} className="flex gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                          <img src={cls.image || 'https://via.placeholder.com/150'} alt="" className="w-20 h-20 rounded-xl object-cover hidden sm:block bg-slate-100" />
                          <div className="flex-1">
                              <h4 className="font-bold text-slate-800">{cls.title}</h4>
                              <p className="text-xs text-slate-500 mb-1">מדריכה: {cls.instructor}</p>
                              <div className="flex flex-wrap gap-2 text-xs">
                                  <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md">{cls.day} {cls.time}</span>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>

              <Modal isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)} title="הוספת חוג">
                  <form onSubmit={saveClass} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input required placeholder="שם החוג" className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={classForm.title} onChange={e => setClassForm({...classForm, title: e.target.value})} />
                          <input required placeholder="מדריכה" className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={classForm.instructor} onChange={e => setClassForm({...classForm, instructor: e.target.value})} />
                          <div className="grid grid-cols-2 gap-4">
                              <select className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={classForm.day} onChange={e => setClassForm({...classForm, day: e.target.value})}>
                                  <option>ראשון</option><option>שני</option><option>שלישי</option><option>רביעי</option><option>חמישי</option><option>שישי</option>
                              </select>
                              <input required placeholder="שעה" className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={classForm.time} onChange={e => setClassForm({...classForm, time: e.target.value})} />
                          </div>
                          <input required placeholder="טלפון" className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={classForm.contactPhone} onChange={e => setClassForm({...classForm, contactPhone: e.target.value})} />
                          
                          <div className="md:col-span-2 border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50 relative">
                               <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setClassForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
                               {classForm.image ? <img src={classForm.image} className="h-24 mx-auto rounded" /> : <span>העלאת תמונה</span>}
                          </div>
                      </div>
                      <button type="submit" className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 flex justify-center items-center gap-2">
                        <Save size={18} /> שמירה ופרסום
                      </button>
                  </form>
              </Modal>
           </div>
        )}

        {/* LOTTERIES TAB */}
        {activeTab === 'lotteries' && (
           <div className="p-4 md:p-6">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-bold text-slate-800">ניהול הגרלות ({apiLotteries.length})</h3>
                 <button onClick={() => handleOpenLotteryModal()} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200">
                    <Plus size={18} /> <span className="hidden md:inline">הוספת הגרלה</span>
                 </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {apiLotteries.map(lot => (
                      <div key={lot.id} className="flex gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                          <img src={lot.image || 'https://via.placeholder.com/150'} alt="" className="w-20 h-20 rounded-xl object-cover hidden sm:block bg-slate-100" />
                          <div className="flex-1">
                              <h4 className="font-bold text-slate-800">{lot.title}</h4>
                              <p className="text-xs text-rose-500 font-bold mb-1">{lot.prize}</p>
                              <div className="flex gap-2 text-xs text-slate-500 mb-1">
                                  <span>תאריך: {lot.drawDate}</span>
                              </div>
                              <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                                  {lot.eligibilityType === 'all' ? 'פתוח לכולן' : 
                                   lot.eligibilityType === 'points' ? `מעל ${lot.minPointsToEnter} נק'` : 
                                   lot.eligibilityType === 'level' ? `דרגת ${lot.minLevel} ומעלה` : 'משתמשת ספציפית'}
                              </span>
                          </div>
                      </div>
                  ))}
              </div>

              <Modal isOpen={isLotteryModalOpen} onClose={() => setIsLotteryModalOpen(false)} title="הוספת הגרלה">
                  <form onSubmit={saveLottery} className="space-y-4">
                      <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <input required placeholder="כותרת" className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={lotteryForm.title} onChange={e => setLotteryForm({...lotteryForm, title: e.target.value})} />
                             <input required placeholder="הפרס" className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={lotteryForm.prize} onChange={e => setLotteryForm({...lotteryForm, prize: e.target.value})} />
                             <input required type="date" className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={lotteryForm.drawDate} onChange={e => setLotteryForm({...lotteryForm, drawDate: e.target.value})} />
                             
                             <div className="md:col-span-2 border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50 relative">
                                 <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setLotteryForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
                                 {lotteryForm.image ? <img src={lotteryForm.image} className="h-24 mx-auto rounded" /> : <span>העלאת תמונה</span>}
                             </div>
                          </div>

                          <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 space-y-3">
                              <h4 className="font-bold text-orange-800 text-sm flex items-center gap-2"><Users size={16} /> הגדרות זכאות</h4>
                              <select className="w-full p-3 rounded-xl border border-orange-200 bg-white" value={lotteryForm.eligibilityType} onChange={(e) => setLotteryForm({...lotteryForm, eligibilityType: e.target.value as LotteryEligibilityType})}>
                                  <option value="all">כל המשתמשות הרשומות</option>
                                  <option value="points">לפי ניקוד מינימלי</option>
                                  <option value="level">לפי דרגת משתמשת</option>
                              </select>
                              {lotteryForm.eligibilityType === 'points' && (
                                  <input type="number" placeholder="ניקוד מינימלי" className="w-full p-3 rounded-xl border border-orange-200" value={lotteryForm.minPointsToEnter} onChange={e => setLotteryForm({...lotteryForm, minPointsToEnter: Number(e.target.value)})} />
                              )}
                          </div>
                      </div>

                      <button type="submit" className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 flex justify-center items-center gap-2">
                         <Gift size={18} /> פרסום הגרלה
                      </button>
                  </form>
              </Modal>
           </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="p-6 max-w-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Settings size={24} className="text-slate-400" />
                הגדרות ניקוד מערכת (Gamification)
            </h3>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">נקודות להרשמה לאתר</label>
                        <input type="number" className="w-full p-3 rounded-xl border border-slate-200 bg-white" value={settings.pointsPerRegister} onChange={(e) => setSettings({...settings, pointsPerRegister: Number(e.target.value)})} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">נקודות להרשמה לאירוע</label>
                        <input type="number" className="w-full p-3 rounded-xl border border-slate-200 bg-white" value={settings.pointsPerEventJoin} onChange={(e) => setSettings({...settings, pointsPerEventJoin: Number(e.target.value)})} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">נקודות לשיתוף לינק</label>
                        <input type="number" className="w-full p-3 rounded-xl border border-slate-200 bg-white" value={settings.pointsPerShare} onChange={(e) => setSettings({...settings, pointsPerShare: Number(e.target.value)})} />
                    </div>
                </div>
                <button onClick={handleUpdateSettings} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-rose-600 transition-colors flex justify-center items-center gap-2">
                    <Save size={18} /> שמירת הגדרות
                </button>
            </div>
          </div>
        )}

        {/* GIFTS TAB */}
        {activeTab === 'gifts' && (
          <div className="p-6 max-w-3xl">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Gift size={24} className="text-rose-500" />
                יצירת לינק מתנה לקבוצות
            </h3>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
                <form onSubmit={handleCreateGift} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <input type="text" required placeholder="קוד קופון (באנגלית)" className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50" value={giftForm.code} onChange={e => setGiftForm({...giftForm, code: e.target.value})} />
                        <input type="number" required placeholder="כמות נקודות" className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50" value={giftForm.points} onChange={e => setGiftForm({...giftForm, points: Number(e.target.value)})} />
                    </div>
                    <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-rose-500 text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all flex justify-center items-center gap-2">
                        <Sparkles size={18} /> צור מתנה
                    </button>
                </form>
            </div>
            {createdGiftLink && (
                <div className="bg-green-50 border border-green-200 p-6 rounded-2xl text-center animate-fade-in">
                    <p className="text-green-800 font-bold mb-3 text-lg">הלינק נוצר בהצלחה! 🎉</p>
                    <div className="flex items-center gap-2 justify-center bg-white p-3 rounded-xl border border-green-100 shadow-sm mb-3">
                        <code className="text-rose-600 font-mono font-bold">{createdGiftLink}</code>
                        <button onClick={() => {navigator.clipboard.writeText(createdGiftLink); alert('הועתק!');}} className="text-slate-400 hover:text-slate-800 p-1"><Copy size={20} /></button>
                    </div>
                </div>
            )}
          </div>
        )}

        {/* REVIEWS TAB (Static for now) */}
        {activeTab === 'reviews' && (
           <div className="p-6">
              <h3 className="text-xl font-bold text-slate-800 mb-6">חוות דעת אחרונות</h3>
              <div className="text-center py-12 text-slate-400">אין חוות דעת חדשות להצגה כרגע.</div>
           </div>
        )}

        {/* PERSONALITY TAB (UI Restoration) */}
        {activeTab === 'personality' && personalityForm && (
           <div className="p-6 max-w-3xl mx-auto">
               <h3 className="text-xl font-bold text-slate-800 mb-6">ניהול אישיות השבוע</h3>
               <div className="space-y-6">
                   <div className="grid md:grid-cols-2 gap-4">
                       <input className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" placeholder="שם מלא" value={personalityForm.name} onChange={e => setPersonalityForm({...personalityForm, name: e.target.value})} />
                       <input className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" placeholder="תפקיד" value={personalityForm.role} onChange={e => setPersonalityForm({...personalityForm, role: e.target.value})} />
                       <div className="md:col-span-2">
                           <input className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" placeholder="קישור לתמונה" value={personalityForm.image} onChange={e => setPersonalityForm({...personalityForm, image: e.target.value})} />
                       </div>
                   </div>
                   <div className="space-y-4">
                       <h4 className="font-bold text-slate-700 border-b pb-2">שאלות ותשובות</h4>
                       {personalityForm.questions.map((q, idx) => (
                           <div key={idx} className="bg-slate-50 p-4 rounded-2xl space-y-2">
                               <input className="w-full p-2 bg-white rounded-lg border border-slate-200 text-sm font-bold" value={q.question} onChange={(e) => { const newQs = [...personalityForm.questions]; newQs[idx].question = e.target.value; setPersonalityForm({...personalityForm, questions: newQs}); }} />
                               <textarea className="w-full p-2 bg-white rounded-lg border border-slate-200 text-sm" rows={2} value={q.answer} onChange={(e) => { const newQs = [...personalityForm.questions]; newQs[idx].answer = e.target.value; setPersonalityForm({...personalityForm, questions: newQs}); }} />
                           </div>
                       ))}
                   </div>
                   <button onClick={handleSavePersonality} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold">שמירת שינויים</button>
               </div>
           </div>
        )}

      </div>
    </div>
  );
};

export default AdminPage;