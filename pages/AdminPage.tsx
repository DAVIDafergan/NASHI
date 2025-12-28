import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Plus, Users, Calendar, Gift, Search, Trash2, Edit, Save, 
  X, Eye, Send, Activity, Upload, Image as ImageIcon, BookOpen,
  Settings, Award, Copy, Sparkles, MessageSquare, Link as LinkIcon,
  CheckCircle, Clock, Phone, MapPin, HeartHandshake, ChevronLeft
} from 'lucide-react';
import { User, EventItem, LotteryItem, ClassItem, PersonalityProfile } from '../types';
import { api } from '../services/api';

// קומפוננטת מודאל פנימית לשימוש בדף
const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-fade-in-up relative overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-black text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto no-scrollbar">{children}</div>
      </div>
    </div>
  );
};

const AdminPage: React.FC<{ user: User | null, onLogin: (user: User) => void }> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'approvals' | 'community' | 'users' | 'events' | 'classes' | 'lotteries' | 'personality' | 'settings' | 'gifts'>('approvals');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [systemMessage, setSystemMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  // Data States
  const [apiUsers, setApiUsers] = useState<User[]>([]);
  const [apiEvents, setApiEvents] = useState<EventItem[]>([]);
  const [apiClasses, setApiClasses] = useState<ClassItem[]>([]);
  const [apiLotteries, setApiLotteries] = useState<LotteryItem[]>([]);
  const [communityItems, setCommunityItems] = useState<any[]>([]);
  const [pendingData, setPendingData] = useState<{pendingUsers: User[], pendingPosts: any[]}>({pendingUsers: [], pendingPosts: []});
  
  // Settings & Gifts
  const [pointsSettings, setPointsSettings] = useState({ pointsPerRegister: 50, pointsPerEventJoin: 10, pointsPerShare: 5 });
  const [giftForm, setGiftForm] = useState({ code: '', points: 0, maxUses: 10 });

  // Personality State
  const [personalityLink, setPersonalityLink] = useState<string | null>(null);
  const [personalityForm, setPersonalityForm] = useState<PersonalityProfile>({
      id: '1', name: '', role: '', image: '', isActive: true, questions: [{question: '', answer: ''}]
  });

  // Modals & Forms State
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isCommunityModalOpen, setIsCommunityModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  
  const [eventForm, setEventForm] = useState<Partial<EventItem>>({ title: '', location: '', category: '', price: 0, image: '', registrationLink: '', date: '' });
  const [communityForm, setCommunityForm] = useState({ category: 'שיעורי תורה', title: '', location: '', phone: '', description: '', image: '' });

  useEffect(() => {
    if (user?.isAdmin) loadTabData();
  }, [activeTab, user]);

  const loadTabData = async () => {
    setLoading(true);
    try {
        if (activeTab === 'approvals') {
            const data = await api.getAdminApprovals();
            setPendingData(data || { pendingUsers: [], pendingPosts: [] });
        } else if (activeTab === 'community') {
            setCommunityItems(await api.getCommunityItems());
        } else if (activeTab === 'users') {
            const data = await fetch('https://nashi-production.up.railway.app/api/users', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json());
            setApiUsers(Array.isArray(data) ? data : []);
        } else if (activeTab === 'events') {
            setApiEvents(await api.getEvents());
        } else if (activeTab === 'settings') {
            const settings = await api.getSettings();
            if (settings) setPointsSettings(settings);
        } else if (activeTab === 'personality') {
            const data = await api.getPersonality();
            if (data && data.name) setPersonalityForm(data);
        }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setForm: Function) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { 
        setSystemMessage({ type: 'error', text: 'הקובץ גדול מדי! מקסימום 2MB.' });
        return; 
      }
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => setForm((prev: any) => ({ ...prev, image: reader.result }));
    }
  };

  // --- פונקציות ניהול ---
  const approveMember = async (id: string) => {
      await api.approveMember(id);
      setSystemMessage({ type: 'success', text: 'המשתמשת אושרה במעגל!' });
      loadTabData();
  };

  const approveForumPost = async (id: string) => {
      await api.approvePost(id);
      setSystemMessage({ type: 'success', text: 'הפוסט עלה לאוויר!' });
      loadTabData();
  };

  const saveEvent = async (e: React.FormEvent) => {
      e.preventDefault();
      if (editingEventId) await api.updateEvent({ ...eventForm, id: editingEventId } as EventItem);
      else await api.createEvent(eventForm);
      setIsEventModalOpen(false);
      setSystemMessage({ type: 'success', text: 'האירוע נשמר בהצלחה!' });
      loadTabData();
  };

  const deleteEvent = async (id: string) => {
      if (window.confirm('למחוק אירוע זה?')) {
          await api.deleteEvent(id);
          loadTabData();
      }
  };

  const updatePointsSettings = async () => {
      await api.updateSettings(pointsSettings);
      setSystemMessage({ type: 'success', text: 'הגדרות הניקוד עודכנו!' });
  };

  const generateInterviewLink = async () => {
      const res = await api.generateInterviewLink();
      setPersonalityLink(res.link);
  };

  const filteredData = (data: any[], field: string) => 
      (data || []).filter(item => (item[field] || '').toLowerCase().includes(searchTerm.toLowerCase()));

  if (!user || !user.isAdmin) return <div className="p-20 text-center font-black text-rose-500 text-2xl">גישה למורשי ניהול בלבד.</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 pt-6 px-4 md:px-8 space-y-8">
      
      {/* כותרת דף הניהול */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-right">
              <h1 className="text-4xl font-black text-slate-900 flex items-center justify-center md:justify-start gap-3">
                 <ShieldCheck className="text-rose-500" size={40} /> מרכז ניהול - נשי.
              </h1>
              <p className="text-slate-500 font-bold mt-1">שלום {user.name}, ברוכה הבאה למערכת השליטה.</p>
          </div>
          
          <div className="flex bg-white p-1.5 rounded-[2rem] shadow-sm border border-slate-100 overflow-x-auto no-scrollbar">
            {[
               { id: 'approvals', label: 'אישורים', icon: <CheckCircle size={18} /> },
               { id: 'events', label: 'אירועים', icon: <Calendar size={18} /> },
               { id: 'personality', label: 'אשת השבוע', icon: <Sparkles size={18} /> },
               { id: 'community', label: 'קהילה', icon: <Users size={18} /> },
               { id: 'settings', label: 'הגדרות', icon: <Settings size={18} /> },
            ].map(tab => (
               <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                 {tab.icon} {tab.label}
               </button>
            ))}
          </div>
      </div>

      {systemMessage && (
          <div className={`max-w-2xl mx-auto p-4 rounded-2xl text-center font-black shadow-lg animate-bounce-in ${systemMessage.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
              {systemMessage.text}
          </div>
      )}

      <div className="max-w-7xl mx-auto">
        
        {/* --- טאב אישורי מערכת --- */}
        {activeTab === 'approvals' && (
            <div className="grid md:grid-cols-2 gap-8 animate-fade-in">
                {/* בקשות הצטרפות למעגל */}
                <section className="bg-white p-8 rounded-[3rem] shadow-xl border border-rose-50 space-y-6">
                    <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3"><HeartHandshake className="text-rose-500" /> ממתינות להצטרפות למעגל</h3>
                    <div className="space-y-4">
                        {pendingData.pendingUsers.map(u => (
                            <div key={u.id} className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 flex justify-between items-center group hover:bg-white hover:shadow-md transition-all">
                                <div>
                                    <p className="font-black text-slate-800">{u.name}</p>
                                    <p className="text-xs text-slate-500">{u.occupation} • גיל {u.age} • {u.address}</p>
                                </div>
                                <button onClick={() => approveMember(u.id)} className="bg-green-500 text-white p-3 rounded-xl shadow-lg hover:scale-110 transition-transform"><CheckCircle size={20}/></button>
                            </div>
                        ))}
                        {pendingData.pendingUsers.length === 0 && <div className="text-center py-10 text-slate-400 italic font-bold">אין בקשות חדשות כרגע</div>}
                    </div>
                </section>

                {/* פוסטים לפורום */}
                <section className="bg-white p-8 rounded-[3rem] shadow-xl border border-rose-50 space-y-6">
                    <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3"><MessageSquare className="text-rose-500" /> פוסטים לאישור בפורום</h3>
                    <div className="space-y-4">
                        {pendingData.pendingPosts.map(post => (
                            <div key={post._id} className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-3">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-black text-slate-800 text-sm">{post.title}</h4>
                                    <button onClick={() => approveForumPost(post._id)} className="bg-rose-500 text-white p-2.5 rounded-xl shadow-md"><CheckCircle size={18}/></button>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 bg-white/50 p-2 rounded-lg">{post.content}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">מאת: {post.authorName}</p>
                            </div>
                        ))}
                        {pendingData.pendingPosts.length === 0 && <div className="text-center py-10 text-slate-400 italic font-bold">הפורום נקי מפוסטים ממתינים</div>}
                    </div>
                </section>
            </div>
        )}

        {/* --- טאב אירועים --- */}
        {activeTab === 'events' && (
            <div className="space-y-8 animate-fade-in">
                <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm">
                    <h3 className="text-xl font-black">ניהול לוח אירועים</h3>
                    <button onClick={() => { setEditingEventId(null); setEventForm({title:'', location:'', category:'', price:0, image:'', registrationLink:'', date:''}); setIsEventModalOpen(true); }} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-rose-600 transition-all">
                        <Plus size={20} /> הוספת אירוע חדש
                    </button>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {apiEvents.map(ev => (
                        <div key={ev.id} className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50 group hover:border-rose-200 transition-all">
                            <img src={ev.image} className="w-full h-40 object-cover rounded-[2rem] mb-4 shadow-md" />
                            <h4 className="font-black text-slate-800 mb-1">{ev.title}</h4>
                            <p className="text-xs text-slate-400 font-bold mb-4">{new Date(ev.date).toLocaleDateString('he-IL')} • {ev.location}</p>
                            <div className="flex gap-2">
                                <button onClick={() => { setEditingEventId(ev.id); setEventForm(ev); setIsEventModalOpen(true); }} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-xs hover:bg-rose-50 hover:text-rose-500 transition-all flex items-center justify-center gap-2"><Edit size={14}/> עריכה</button>
                                <button onClick={() => deleteEvent(ev.id)} className="p-2.5 bg-slate-50 text-red-500 rounded-xl hover:bg-red-50 transition-all"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* --- טאב אשת השבוע --- */}
        {activeTab === 'personality' && (
            <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
                <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl border border-rose-50 text-center space-y-6">
                    <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-500 mx-auto rotate-12"><Sparkles size={40} /></div>
                    <div className="space-y-2">
                        <h3 className="text-3xl font-black text-slate-900">שאלון אשת השבוע</h3>
                        <p className="text-slate-500 font-medium">הפיקי לינק ושלחי אותו לאישה. התוכן ימתין לך כאן לעדכון.</p>
                    </div>
                    <button onClick={generateInterviewLink} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-3 hover:bg-rose-600 transition-all">
                        <LinkIcon size={22} /> הפקת לינק ייחודי
                    </button>
                    {personalityLink && (
                        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-center justify-between animate-bounce-in">
                            <p className="text-xs font-mono text-rose-800 truncate flex-1 font-bold">{personalityLink}</p>
                            <button onClick={() => {navigator.clipboard.writeText(personalityLink); alert('הלינק הועתק!');}} className="mr-4 p-3 bg-white rounded-xl shadow-md text-rose-600 hover:scale-110 transition-transform"><Copy size={18} /></button>
                        </div>
                    )}
                </div>

                <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-50 space-y-6">
                    <h4 className="text-xl font-black text-slate-800 flex items-center gap-2">עריכה ידנית באתר <ChevronLeft size={18}/></h4>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-400 uppercase mr-2">שם מלא</label>
                          <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={personalityForm.name} onChange={e => setPersonalityForm({...personalityForm, name: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-400 uppercase mr-2">תפקיד/תיאור</label>
                          <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={personalityForm.role} onChange={e => setPersonalityForm({...personalityForm, role: e.target.value})} />
                        </div>
                    </div>
                    <button onClick={async () => { await api.updatePersonality(personalityForm); setSystemMessage({type:'success', text:'אשת השבוע עודכנה באתר!'}); }} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg">עדכון סופי בדף הבית</button>
                </div>
            </div>
        )}

        {/* --- טאב הגדרות ניקוד --- */}
        {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto bg-white p-10 md:p-14 rounded-[4rem] shadow-2xl border border-rose-50 animate-fade-in">
                <div className="flex items-center gap-4 mb-10">
                    <div className="p-3 bg-yellow-400 rounded-2xl text-white shadow-lg"><Award size={32} /></div>
                    <h3 className="text-3xl font-black text-slate-900">ניהול ניקוד והטבות</h3>
                </div>
                <div className="space-y-8">
                    {[
                        { key: 'pointsPerRegister', label: 'נקודות על הרשמה (מתנת פתיחה)', icon: <Users size={20}/> },
                        { key: 'pointsPerEventJoin', label: 'נקודות על הגעה לאירוע', icon: <Calendar size={20}/> },
                        { key: 'pointsPerShare', label: 'נקודות על שיתוף תוכן', icon: <Send size={20}/> },
                    ].map((s) => (
                        <div key={s.key} className="space-y-3">
                            <label className="flex items-center gap-2 text-sm font-black text-slate-600">{s.icon} {s.label}</label>
                            <input type="number" className="w-full p-5 bg-slate-50 rounded-[1.5rem] font-black text-lg outline-none focus:ring-4 focus:ring-rose-100 transition-all" value={pointsSettings[s.key as keyof typeof pointsSettings]} onChange={e=>setPointsSettings({...pointsSettings, [s.key]: Number(e.target.value)})}/>
                        </div>
                    ))}
                    <button onClick={updatePointsSettings} className="w-full py-6 bg-slate-900 text-white rounded-3xl font-black text-xl shadow-2xl hover:bg-rose-600 transition-all active:scale-95">שמירת הגדרות מערכת</button>
                </div>
            </div>
        )}

      </div>

      {/* מודאל ניהול אירוע */}
      <Modal isOpen={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} title={editingEventId ? "עריכת אירוע" : "הוספת אירוע חדש"}>
          <form onSubmit={saveEvent} className="space-y-5">
              <input required placeholder="שם האירוע" className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={eventForm.title} onChange={e=>setEventForm({...eventForm, title:e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <input required type="date" className="p-4 bg-slate-50 rounded-2xl font-bold" value={eventForm.date ? new Date(eventForm.date).toISOString().split('T')[0] : ''} onChange={e=>setEventForm({...eventForm, date:e.target.value})} />
                <input required placeholder="מיקום" className="p-4 bg-slate-50 rounded-2xl font-bold" value={eventForm.location} onChange={e=>setEventForm({...eventForm, location:e.target.value})} />
              </div>
              <div className="relative border-2 border-dashed border-slate-200 p-8 text-center rounded-[2rem] hover:border-rose-300 transition-all group">
                  <input type="file" onChange={e => handleFileUpload(e, setEventForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
                  {eventForm.image ? <img src={eventForm.image} className="h-32 mx-auto rounded-xl shadow-md" /> : (
                      <div className="text-slate-400">
                          <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                          <p className="text-sm font-bold">העלאת תמונה (מקסימום 2MB)</p>
                      </div>
                  )}
              </div>
              <button type="submit" className="w-full py-5 bg-rose-500 text-white rounded-2xl font-black shadow-xl hover:bg-rose-600 transition-all">שמירת שינויים</button>
          </form>
      </Modal>

    </div>
  );
};

export default AdminPage;