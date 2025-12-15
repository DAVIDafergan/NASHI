import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Plus, Users, Calendar, Gift, Search, Trash2, Edit, Save, 
  LogIn, BookOpen, X, Eye, Send, Activity, Upload, Image as ImageIcon,
  Settings, Award, Copy, Sparkles, MessageSquare, Link as LinkIcon
} from 'lucide-react';
import { User, EventItem, LotteryItem, ClassItem, UserLevel, LotteryEligibilityType, Review, PersonalityProfile } from '../types';
import { useNavigate } from 'react-router-dom';

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
  // Legacy props
  events?: EventItem[];
  classes?: ClassItem[];
  lotteries?: LotteryItem[];
  reviews?: Review[];
  personality?: PersonalityProfile;
  // Legacy callbacks
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

const AdminPage: React.FC<AdminPageProps> = ({ user, onLogin }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'events' | 'users' | 'lotteries' | 'classes' | 'settings' | 'gifts' | 'personality'>('users');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [systemMessage, setSystemMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  // Data State
  const [apiUsers, setApiUsers] = useState<User[]>([]);
  const [apiEvents, setApiEvents] = useState<EventItem[]>([]);
  const [apiClasses, setApiClasses] = useState<ClassItem[]>([]);
  const [apiLotteries, setApiLotteries] = useState<LotteryItem[]>([]);
  
  const [settings, setSettings] = useState({ pointsPerRegister: 50, pointsPerEventJoin: 10, pointsPerShare: 5 });
  const [giftForm, setGiftForm] = useState({ code: '', points: 100, maxUses: 100 });
  const [createdGiftLink, setCreatedGiftLink] = useState<string | null>(null);

  // Personality State
  const [personalityForm, setPersonalityForm] = useState<PersonalityProfile>({
      id: '1', name: '', role: '', image: '', isActive: true, questions: [{question: '', answer: ''}]
  });

  // Modals
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isLotteryModalOpen, setIsLotteryModalOpen] = useState(false);
  
  // Edit State
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  
  // Forms
  const [eventForm, setEventForm] = useState<Partial<EventItem>>({ title: '', location: '', category: '', price: 0, image: '', registrationLink: '', tags: [], isHero: false });
  const [classForm, setClassForm] = useState<Partial<ClassItem>>({ title: '', instructor: '', contactPhone: '', day: 'ראשון', time: '17:00', location: '', price: 0, ageGroup: '', exceptions: '', category: '', image: '' });
  const [lotteryForm, setLotteryForm] = useState<Partial<LotteryItem>>({ title: '', prize: '', drawDate: '', image: '', participants: [], isActive: true, eligibilityType: 'all', minPointsToEnter: 0, minLevel: UserLevel.BEGINNER });

  useEffect(() => {
    if (user?.isAdmin) loadTabData();
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
        } else if (activeTab === 'personality') {
            const data = await authFetch('/personality');
            if (data && (data.name || data._id)) {
                // Ensure questions array exists
                if (!data.questions || data.questions.length === 0) data.questions = [{question: '', answer: ''}];
                setPersonalityForm(data);
            }
        }
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
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
      if (file.size > 5 * 1024 * 1024) { alert('הקובץ גדול מדי! עד 5MB'); return; }
      const base64 = await convertToBase64(file);
      setForm((prev: any) => ({ ...prev, image: base64 }));
    }
  };

  const handleSavePersonality = async () => {
      try {
          await authFetch('/personality', { method: 'POST', body: JSON.stringify(personalityForm) });
          setSystemMessage({ type: 'success', text: 'אשת השבוע נשמרה בשרת!' });
      } catch { setSystemMessage({ type: 'error', text: 'שגיאה בשמירה' }); }
  };

  const handleOpenEventModal = (event?: EventItem) => {
      if (event) { setEditingEventId(event.id); setEventForm({ ...event, registrationLink: event.registrationLink || '' }); }
      else { setEditingEventId(null); setEventForm({ title: '', location: '', category: '', price: 0, image: '', registrationLink: '', tags: [], isHero: false }); }
      setIsEventModalOpen(true);
  };

  const saveEvent = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          const method = editingEventId ? 'PUT' : 'POST';
          const url = editingEventId ? `/events/${editingEventId}` : '/events';
          await authFetch(url, { method, body: JSON.stringify(eventForm) });
          setSystemMessage({ type: 'success', text: 'האירוע נשמר!' });
          setIsEventModalOpen(false); loadTabData();
      } catch { alert('שגיאה בשמירה'); }
  };
  
  const deleteEvent = async (id: string) => {
      if(!confirm('למחוק?')) return;
      try { await authFetch(`/events/${id}`, { method: 'DELETE' }); loadTabData(); } catch { alert('שגיאה'); }
  };

  const handleOpenClassModal = (cls?: ClassItem) => {
      if (cls) { setEditingClassId(cls.id); setClassForm(cls); }
      else { setEditingClassId(null); setClassForm({ title: '', instructor: '', contactPhone: '', day: 'ראשון', time: '17:00', location: '', price: 0, ageGroup: '', exceptions: '', category: '', image: '' }); }
      setIsClassModalOpen(true);
  };

  const saveClass = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          const method = editingClassId ? 'PUT' : 'POST';
          const url = editingClassId ? `/classes/${editingClassId}` : '/classes';
          await authFetch(url, { method, body: JSON.stringify(classForm) });
          setSystemMessage({ type: 'success', text: 'החוג נשמר!' });
          setIsClassModalOpen(false); loadTabData();
      } catch { alert('שגיאה'); }
  };

  const deleteClass = async (id: string) => {
      if(!confirm('למחוק?')) return;
      try { await authFetch(`/classes/${id}`, { method: 'DELETE' }); loadTabData(); } catch { alert('שגיאה'); }
  };

  const saveLottery = async (e: React.FormEvent) => {
      e.preventDefault();
      try { await authFetch('/lotteries', { method: 'POST', body: JSON.stringify(lotteryForm) }); setSystemMessage({ type: 'success', text: 'הגרלה נשמרה!' }); setIsLotteryModalOpen(false); loadTabData(); } catch { alert('שגיאה'); }
  };
  
  const updateSettings = async () => { try { await authFetch('/admin/settings', { method: 'PUT', body: JSON.stringify(settings) }); alert('נשמר'); } catch { alert('שגיאה'); } };
  const createGift = async (e: React.FormEvent) => { e.preventDefault(); try { const res = await authFetch('/admin/gifts', { method: 'POST', body: JSON.stringify(giftForm) }); setCreatedGiftLink(res.link); } catch { alert('שגיאה'); } };
  const handleSendPoints = async (id: string) => { const pts = prompt('נקודות?'); if(pts) try { await authFetch(`/admin/users/${id}/points`, {method:'POST', body: JSON.stringify({points: +pts})}); loadTabData(); } catch{} };

  if (!user || !user.isAdmin) return <div className="flex justify-center items-center h-screen"><form onSubmit={handleAdminLogin} className="bg-white p-8 rounded shadow"><h2 className="text-xl mb-4 font-bold">כניסת מנהל</h2><input className="border p-2 w-full mb-2" placeholder="Email" value={loginForm.username} onChange={e=>setLoginForm({...loginForm, username:e.target.value})}/><input className="border p-2 w-full mb-4" type="password" placeholder="Pass" value={loginForm.password} onChange={e=>setLoginForm({...loginForm, password:e.target.value})}/><button className="bg-black text-white p-2 w-full">Login</button></form></div>;

  return (
    <div className="p-4 md:p-8 space-y-6 pb-20">
      <div className="flex flex-wrap gap-2 bg-white p-4 rounded-[2rem] shadow-sm justify-center">
        {[
           { id: 'users', label: 'משתמשים', icon: <Users size={18} /> },
           { id: 'events', label: 'אירועים', icon: <Calendar size={18} /> },
           { id: 'classes', label: 'חוגים', icon: <BookOpen size={18} /> },
           { id: 'lotteries', label: 'הגרלות', icon: <Gift size={18} /> },
           { id: 'personality', label: 'אשת השבוע', icon: <Sparkles size={18} /> },
           { id: 'gifts', label: 'מתנות', icon: <Award size={18} /> },
           { id: 'settings', label: 'הגדרות', icon: <Settings size={18} /> },
        ].map(tab => (
           <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${activeTab === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
              {tab.icon} {tab.label}
           </button>
        ))}
      </div>

      {systemMessage && <div className="bg-green-100 text-green-800 p-4 rounded-xl text-center font-bold">{systemMessage.text}</div>}

      {activeTab === 'users' && (
          <div className="p-6 bg-white rounded-[2rem] shadow-sm overflow-x-auto">
             <table className="w-full text-right">
               <thead><tr><th className="p-2">שם</th><th className="p-2">אימייל</th><th className="p-2">נק'</th><th className="p-2">פעולה</th></tr></thead>
               <tbody>{apiUsers.map(u=><tr key={u.id}><td className="p-2">{u.name}</td><td className="p-2">{u.email}</td><td className="p-2 font-bold">{u.points}</td><td className="p-2"><button onClick={()=>handleSendPoints(u.id)} className="text-blue-500 text-xs font-bold bg-blue-50 p-1 rounded">שלח נקודות</button></td></tr>)}</tbody>
             </table>
          </div>
      )}

      {activeTab === 'events' && (
        <div>
           <button onClick={() => handleOpenEventModal()} className="bg-rose-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 mb-6"> <Plus size={20} /> אירוע חדש </button>
           <div className="grid gap-4">
              {apiEvents.map(ev => (
                  <div key={ev.id} className="bg-white p-4 rounded-2xl flex gap-4 items-center shadow-sm border border-slate-100 relative">
                      <img src={ev.image || 'https://via.placeholder.com/100'} className="w-20 h-20 rounded-xl object-cover bg-slate-100" />
                      <div className="flex-1"><h4 className="font-bold">{ev.title}</h4><p className="text-sm">{new Date(ev.date).toLocaleDateString()}</p></div>
                      <div className="flex gap-2"><button onClick={() => handleOpenEventModal(ev)} className="text-blue-400 p-2"><Edit size={18}/></button><button onClick={() => deleteEvent(ev.id)} className="text-red-400 p-2"><Trash2 size={18}/></button></div>
                  </div>
              ))}
           </div>
           <Modal isOpen={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} title="אירוע">
               <form onSubmit={saveEvent} className="space-y-4">
                   <input required placeholder="שם" className="w-full p-3 bg-slate-50 rounded-xl" value={eventForm.title} onChange={e=>setEventForm({...eventForm, title:e.target.value})} />
                   <div className="grid grid-cols-2 gap-2"><input required type="date" className="w-full p-3 bg-slate-50 rounded-xl" value={eventForm.date ? new Date(eventForm.date).toISOString().split('T')[0] : ''} onChange={e=>setEventForm({...eventForm, date:e.target.value})} /><input required placeholder="מיקום" className="w-full p-3 bg-slate-50 rounded-xl" value={eventForm.location} onChange={e=>setEventForm({...eventForm, location:e.target.value})} /></div>
                   <input required placeholder="קטגוריה" className="w-full p-3 bg-slate-50 rounded-xl" value={eventForm.category} onChange={e=>setEventForm({...eventForm, category:e.target.value})} />
                   <input type="number" placeholder="מחיר" className="w-full p-3 bg-slate-50 rounded-xl" value={eventForm.price} onChange={e=>setEventForm({...eventForm, price:Number(e.target.value)})} />
                   <div className="relative"><LinkIcon className="absolute right-3 top-3.5 text-slate-400" size={18} /><input placeholder="לינק חיצוני" className="w-full pr-10 pl-3 py-3 bg-slate-50 rounded-xl" value={eventForm.registrationLink} onChange={e=>setEventForm({...eventForm, registrationLink:e.target.value})} /></div>
                   <div className="border-2 border-dashed p-4 text-center relative"><input type="file" onChange={e=>handleFileUpload(e, setEventForm)} className="absolute inset-0 opacity-0"/>{eventForm.image ? <img src={eventForm.image} className="h-20 mx-auto"/> : 'העלאת תמונה'}</div>
                   <button className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">שמור</button>
               </form>
           </Modal>
        </div>
      )}

      {activeTab === 'classes' && (
        <div>
           <button onClick={() => handleOpenClassModal()} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold mb-6"> <Plus size={20} /> חוג חדש </button>
           <div className="grid gap-4 md:grid-cols-2">
              {apiClasses.map(cls => (
                  <div key={cls.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4 relative">
                      <img src={cls.image || 'https://via.placeholder.com/100'} className="w-20 h-20 rounded-xl object-cover bg-slate-100" />
                      <div className="flex-1"><h4 className="font-bold">{cls.title}</h4><p className="text-sm">{cls.day} {cls.time}</p></div>
                      <div className="flex flex-col gap-2"><button onClick={() => handleOpenClassModal(cls)} className="text-blue-400 p-2"><Edit size={18}/></button><button onClick={() => deleteClass(cls.id)} className="text-red-400 p-2"><Trash2 size={18}/></button></div>
                  </div>
              ))}
           </div>
           <Modal isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)} title="חוג">
               <form onSubmit={saveClass} className="space-y-4">
                   <div className="grid grid-cols-2 gap-4"><input required placeholder="שם" className="w-full p-3 bg-slate-50 rounded-xl" value={classForm.title} onChange={e=>setClassForm({...classForm, title:e.target.value})} /><input required placeholder="מדריכה" className="w-full p-3 bg-slate-50 rounded-xl" value={classForm.instructor} onChange={e=>setClassForm({...classForm, instructor:e.target.value})} /></div>
                   <div className="grid grid-cols-2 gap-4"><input placeholder="מיקום" className="w-full p-3 bg-slate-50 rounded-xl" value={classForm.location} onChange={e=>setClassForm({...classForm, location:e.target.value})} /><input placeholder="גילאים" className="w-full p-3 bg-slate-50 rounded-xl" value={classForm.ageGroup} onChange={e=>setClassForm({...classForm, ageGroup:e.target.value})} /></div>
                   <input placeholder="חריגים" className="w-full p-3 bg-slate-50 rounded-xl" value={classForm.exceptions} onChange={e=>setClassForm({...classForm, exceptions:e.target.value})} />
                   <div className="grid grid-cols-2 gap-2"><select className="w-full p-3 bg-slate-50 rounded-xl" value={classForm.day} onChange={e=>setClassForm({...classForm, day:e.target.value})}><option>ראשון</option><option>שני</option><option>שלישי</option><option>רביעי</option><option>חמישי</option><option>שישי</option></select><input required placeholder="שעה" className="w-full p-3 bg-slate-50 rounded-xl" value={classForm.time} onChange={e=>setClassForm({...classForm, time:e.target.value})} /></div>
                   <input placeholder="טלפון" className="w-full p-3 bg-slate-50 rounded-xl" value={classForm.contactPhone} onChange={e=>setClassForm({...classForm, contactPhone:e.target.value})} />
                   <input type="number" placeholder="מחיר" className="w-full p-3 bg-slate-50 rounded-xl" value={classForm.price} onChange={e=>setClassForm({...classForm, price:Number(e.target.value)})} />
                   <div className="border-2 border-dashed p-4 text-center relative"><input type="file" onChange={e=>handleFileUpload(e, setClassForm)} className="absolute inset-0 opacity-0"/>{classForm.image ? <img src={classForm.image} className="h-20 mx-auto"/> : 'תמונה'}</div>
                   <button className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold">שמור</button>
               </form>
           </Modal>
        </div>
      )}

      {activeTab === 'lotteries' && (
        <div>
           <button onClick={() => setIsLotteryModalOpen(true)} className="bg-orange-500 text-white px-6 py-3 rounded-xl font-bold mb-6"> <Plus size={20} /> הגרלה חדשה </button>
           <div className="grid gap-4 md:grid-cols-2">{apiLotteries.map(lot => (<div key={lot.id} className="bg-white p-4 rounded-2xl flex gap-4"><img src={lot.image} className="w-20 h-20 rounded-xl"/><div className="flex-1"><h4 className="font-bold">{lot.title}</h4><p>{lot.prize}</p></div></div>))}</div>
           <Modal isOpen={isLotteryModalOpen} onClose={() => setIsLotteryModalOpen(false)} title="הגרלה"><form onSubmit={saveLottery} className="space-y-4"><input required placeholder="כותרת" className="w-full p-3 bg-slate-50 rounded-xl" value={lotteryForm.title} onChange={e=>setLotteryForm({...lotteryForm, title:e.target.value})} /><input required placeholder="פרס" className="w-full p-3 bg-slate-50 rounded-xl" value={lotteryForm.prize} onChange={e=>setLotteryForm({...lotteryForm, prize:e.target.value})} /><input required type="date" className="w-full p-3 bg-slate-50 rounded-xl" value={lotteryForm.drawDate} onChange={e=>setLotteryForm({...lotteryForm, drawDate:e.target.value})} /><div className="border-2 border-dashed p-4 text-center relative"><input type="file" onChange={e=>handleFileUpload(e, setLotteryForm)} className="absolute inset-0 opacity-0"/>{lotteryForm.image ? <img src={lotteryForm.image} className="h-20 mx-auto"/> : 'תמונה'}</div><button className="w-full bg-orange-500 text-white py-3 font-bold rounded-xl">שמור</button></form></Modal>
        </div>
      )}

      {activeTab === 'personality' && personalityForm && (
           <div className="p-6 max-w-3xl mx-auto bg-white rounded-[2rem] shadow-sm">
               <h3 className="text-xl font-bold text-slate-800 mb-6">ניהול אשת השבוע</h3>
               <div className="space-y-6">
                   <div className="grid md:grid-cols-2 gap-4">
                       <input className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" placeholder="שם מלא" value={personalityForm.name} onChange={e => setPersonalityForm({...personalityForm, name: e.target.value})} />
                       <input className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" placeholder="תפקיד" value={personalityForm.role} onChange={e => setPersonalityForm({...personalityForm, role: e.target.value})} />
                       <div className="md:col-span-2 border-2 border-dashed p-4 relative rounded-xl text-center"><input type="file" onChange={e => handleFileUpload(e, setPersonalityForm)} className="absolute inset-0 opacity-0" />{personalityForm.image ? <img src={personalityForm.image} className="h-32 mx-auto rounded" /> : 'העלאת תמונה'}</div>
                   </div>
                   <div className="space-y-4">
                       <h4 className="font-bold text-slate-700 border-b pb-2">שאלות ותשובות</h4>
                       {personalityForm.questions.map((q, idx) => (
                           <div key={idx} className="bg-slate-50 p-4 rounded-2xl space-y-2 relative group">
                               <input className="w-full p-2 bg-white rounded-lg border border-slate-200 text-sm font-bold" placeholder="שאלה" value={q.question} onChange={(e) => { const newQs = [...personalityForm.questions]; newQs[idx].question = e.target.value; setPersonalityForm({...personalityForm, questions: newQs}); }} />
                               <textarea className="w-full p-2 bg-white rounded-lg border border-slate-200 text-sm" placeholder="תשובה" rows={3} value={q.answer} onChange={(e) => { const newQs = [...personalityForm.questions]; newQs[idx].answer = e.target.value; setPersonalityForm({...personalityForm, questions: newQs}); }} />
                               <button onClick={() => { const newQs = personalityForm.questions.filter((_, i) => i !== idx); setPersonalityForm({...personalityForm, questions: newQs}); }} className="text-red-500 text-xs absolute top-2 left-2">מחק שאלה</button>
                           </div>
                       ))}
                       <button onClick={() => setPersonalityForm({...personalityForm, questions: [...personalityForm.questions, {question: '', answer: ''}]})} className="text-rose-600 font-bold text-sm">+ הוסף שאלה</button>
                   </div>
                   <div className="flex items-center gap-2"><input type="checkbox" checked={personalityForm.isActive} onChange={e => setPersonalityForm({...personalityForm, isActive: e.target.checked})} className="w-5 h-5 accent-rose-500" /><span className="font-bold text-slate-700">הצג באתר</span></div>
                   <button onClick={handleSavePersonality} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold">שמור שינויים בשרת</button>
               </div>
           </div>
      )}

      {activeTab === 'settings' && (<div className="max-w-lg mx-auto bg-white p-6 rounded-2xl"><h3 className="font-bold mb-4">הגדרות</h3><input type="number" value={settings.pointsPerRegister} onChange={e=>setSettings({...settings, pointsPerRegister:+e.target.value})} className="w-full p-3 border rounded-xl mb-2"/><button onClick={updateSettings} className="bg-black text-white w-full p-3 rounded-xl">שמור</button></div>)}
      {activeTab === 'gifts' && (<div className="max-w-lg mx-auto bg-white p-6 rounded-2xl"><h3 className="font-bold mb-4">מתנה</h3><input value={giftForm.code} onChange={e=>setGiftForm({...giftForm, code:e.target.value})} className="w-full p-3 border rounded-xl mb-2"/><button onClick={createGift} className="bg-pink-600 text-white w-full p-3 rounded-xl">צור</button>{createdGiftLink && <div className="p-2 bg-green-100 mt-2 rounded">{createdGiftLink}</div>}</div>)}
    </div>
  );
};

export default AdminPage;