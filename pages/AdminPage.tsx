import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Plus, Users, Calendar, Gift, Search, Trash2, Edit, Save, 
  X, Eye, Send, Activity, Upload, Image as ImageIcon,
  Settings, Award, Copy, Sparkles, MessageSquare, Link as LinkIcon,
  CheckCircle, Clock, Phone, MapPin
} from 'lucide-react';
import { User, EventItem, LotteryItem, ClassItem, UserLevel, PersonalityProfile } from '../types';
import { api } from '../services/api';

const AdminPage: React.FC<{ user: User | null, onLogin: (user: User) => void }> = ({ user, onLogin }) => {
  // טאבים מעודכנים כולל אישורי מערכת וקהילה
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
  
  // Personality State
  const [personalityLink, setPersonalityLink] = useState<string | null>(null);
  const [personalityForm, setPersonalityForm] = useState<PersonalityProfile>({
      id: '1', name: '', role: '', image: '', isActive: true, questions: [{question: '', answer: ''}]
  });

  // Modals & Forms
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isLotteryModalOpen, setIsLotteryModalOpen] = useState(false);
  const [isCommunityModalOpen, setIsCommunityModalOpen] = useState(false);
  
  const [eventForm, setEventForm] = useState<Partial<EventItem>>({ title: '', location: '', category: '', price: 0, image: '', registrationLink: '' });
  const [classForm, setClassForm] = useState<Partial<ClassItem>>({ title: '', instructor: '', contactPhone: '', day: 'ראשון', time: '17:00', location: '', price: 0, ageGroup: '', category: '' });
  const [lotteryForm, setLotteryForm] = useState<Partial<LotteryItem>>({ title: '', prize: '', drawDate: '', image: '', minPointsToEnter: 0 });
  const [communityForm, setCommunityForm] = useState({ category: 'שיעורי תורה', title: '', location: '', phone: '', description: '', image: '' });

  useEffect(() => {
    if (user?.isAdmin) loadTabData();
  }, [activeTab, user]);

  const loadTabData = async () => {
    setLoading(true);
    setSystemMessage(null);
    try {
        if (activeTab === 'approvals') {
            const data = await api.getAdminApprovals();
            setPendingData(data);
        } else if (activeTab === 'community') {
            const data = await api.getCommunityItems();
            setCommunityItems(data);
        } else if (activeTab === 'users') {
            const data = await fetch('https://nashi-production.up.railway.app/api/users', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json());
            setApiUsers(data);
        } else if (activeTab === 'events') {
            setApiEvents(await api.getEvents());
        } else if (activeTab === 'classes') {
            setApiClasses(await api.getClasses());
        } else if (activeTab === 'lotteries') {
            setApiLotteries(await api.getLotteries());
        } else if (activeTab === 'personality') {
            const data = await api.getPersonality();
            if (data && data.name) setPersonalityForm(data);
        }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  // מנגנון העלאת תמונה חכם עם בדיקת גודל (עד 2MB)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setForm: Function) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { 
        setSystemMessage({ type: 'error', text: 'הקובץ גדול מדי! אנא העלי תמונה קטנה מ-2MB כדי למנוע שגיאות העלאה.' });
        return; 
      }
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => setForm((prev: any) => ({ ...prev, image: reader.result }));
    }
  };

  // פעולות אישור (Approvals)
  const approveMember = async (id: string) => {
      await api.approveMember(id);
      setSystemMessage({ type: 'success', text: 'המשתמשת אושרה בהצלחה!' });
      loadTabData();
  };

  const approveForumPost = async (id: string) => {
      await api.approvePost(id);
      setSystemMessage({ type: 'success', text: 'הפוסט אושר ועלה לפורום!' });
      loadTabData();
  };

  const generateInterviewLink = async () => {
      const res = await api.generateInterviewLink();
      setPersonalityLink(res.link);
  };

  // פילטור לחיפוש חופשי
  const filteredData = (data: any[], field: string) => 
      data.filter(item => (item[field] || '').toLowerCase().includes(searchTerm.toLowerCase()));

  if (!user || !user.isAdmin) return <div className="p-20 text-center font-bold">כניסה למורשים בלבד.</div>;

  return (
    <div className="p-4 md:p-8 space-y-6 pb-20">
      
      {/* תפריט ניהול עליון מעוגל */}
      <div className="flex flex-wrap gap-2 bg-white p-4 rounded-[2rem] shadow-sm justify-center border border-slate-100">
        {[
           { id: 'approvals', label: 'אישורי מערכת', icon: <ShieldCheck size={18} /> },
           { id: 'community', label: 'קהילה', icon: <Users size={18} /> },
           { id: 'events', label: 'אירועים', icon: <Calendar size={18} /> },
           { id: 'classes', label: 'חוגים', icon: <BookOpen size={18} /> },
           { id: 'lotteries', label: 'הגרלות', icon: <Gift size={18} /> },
           { id: 'personality', label: 'אשת השבוע', icon: <Sparkles size={18} /> },
           { id: 'users', label: 'משתמשים', icon: <Users size={18} /> },
        ].map(tab => (
           <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setSearchTerm(''); }} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
              {tab.icon} {tab.label}
           </button>
        ))}
      </div>

      {/* שורת חיפוש חופשי בכל טאב */}
      <div className="relative max-w-md mx-auto">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="חיפוש חופשי בטאב זה..." 
            className="w-full pr-10 pl-4 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-slate-200 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
      </div>

      {systemMessage && (
          <div className={`p-4 rounded-xl text-center font-bold animate-fade-in ${systemMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {systemMessage.text}
          </div>
      )}

      {/* --- טאב אישורי מערכת --- */}
      {activeTab === 'approvals' && (
          <div className="grid md:grid-cols-2 gap-6">
              <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                  <h3 className="text-lg font-black mb-4 flex items-center gap-2"><Clock size={20} className="text-orange-500"/> בקשות הצטרפות</h3>
                  <div className="space-y-4">
                      {pendingData.pendingUsers.map(u => (
                          <div key={u.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center">
                              <div>
                                  <p className="font-bold">{u.name}</p>
                                  <p className="text-xs text-slate-500">{u.occupation} | {u.phone}</p>
                              </div>
                              <button onClick={() => approveMember(u.id)} className="bg-green-500 text-white px-4 py-2 rounded-xl text-xs font-bold">אשרי</button>
                          </div>
                      ))}
                      {pendingData.pendingUsers.length === 0 && <p className="text-center text-slate-400 text-sm">אין בקשות ממתינות</p>}
                  </div>
              </section>

              <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                  <h3 className="text-lg font-black mb-4 flex items-center gap-2"><MessageSquare size={20} className="text-blue-500"/> פוסטים לפורום</h3>
                  <div className="space-y-4">
                      {pendingData.pendingPosts.map(post => (
                          <div key={post._id} className="p-4 bg-slate-50 rounded-2xl">
                              <h4 className="font-bold text-sm">{post.title}</h4>
                              <p className="text-xs text-slate-500 mb-3">מאת: {post.authorName}</p>
                              <div className="flex gap-2">
                                  <button onClick={() => approveForumPost(post._id)} className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold">אשרי פוסט</button>
                                  <button className="text-red-500 text-xs">מחק</button>
                              </div>
                          </div>
                      ))}
                      {pendingData.pendingPosts.length === 0 && <p className="text-center text-slate-400 text-sm">אין פוסטים לאישור</p>}
                  </div>
              </section>
          </div>
      )}

      {/* --- טאב קהילה --- */}
      {activeTab === 'community' && (
          <div className="space-y-6">
              <button onClick={() => setIsCommunityModalOpen(true)} className="bg-rose-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2">
                  <Plus size={20} /> הוספת גוף/עסק לקהילה
              </button>
              <div className="grid md:grid-cols-3 gap-4">
                  {filteredData(communityItems, 'title').map(item => (
                      <div key={item._id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4">
                          <img src={item.image || 'https://via.placeholder.com/100'} className="w-16 h-16 rounded-xl object-cover" />
                          <div>
                              <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">{item.category}</span>
                              <h4 className="font-bold text-slate-800 text-sm">{item.title}</h4>
                              <p className="text-xs text-slate-400 flex items-center gap-1"><Phone size={10}/> {item.phone}</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* --- טאב אשת השבוע (עם הפקת לינק) --- */}
      {activeTab === 'personality' && (
          <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 text-center space-y-4">
                  <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto">
                      <Sparkles size={32} />
                  </div>
                  <h3 className="text-xl font-black">שליחת שאלון לאשת השבוע</h3>
                  <p className="text-slate-500 text-sm">הפיקי לינק ייחודי ושלחי אותו לאישה. היא תמלא את התמונה והתשובות, והמידע ימתין לך כאן לאישור סופי.</p>
                  <button onClick={generateInterviewLink} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all">
                      <LinkIcon size={18} /> הפקת לינק לשאלון
                  </button>
                  {personalityLink && (
                      <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-center justify-between">
                          <p className="text-xs font-mono text-rose-800 truncate flex-1">{personalityLink}</p>
                          <button onClick={() => {navigator.clipboard.writeText(personalityLink); alert('הלינק הועתק!');}} className="mr-3 p-2 bg-white rounded-lg shadow-sm text-rose-600"><Copy size={16} /></button>
                      </div>
                  )}
              </div>
              
              {/* עריכה ידנית */}
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                  <h4 className="font-bold mb-4">תצוגה מקדימה / עריכה ידנית</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                      <input className="w-full p-3 bg-slate-50 rounded-xl" placeholder="שם מלא" value={personalityForm.name} onChange={e => setPersonalityForm({...personalityForm, name: e.target.value})} />
                      <input className="w-full p-3 bg-slate-50 rounded-xl" placeholder="תפקיד" value={personalityForm.role} onChange={e => setPersonalityForm({...personalityForm, role: e.target.value})} />
                      <div className="md:col-span-2 border-2 border-dashed p-4 text-center relative rounded-xl">
                          <input type="file" onChange={e => handleFileUpload(e, setPersonalityForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
                          {personalityForm.image ? <img src={personalityForm.image} className="h-32 mx-auto rounded-lg" /> : <p className="text-slate-400">העלאת תמונת פרופיל</p>}
                      </div>
                  </div>
                  <button onClick={async () => { await api.updatePersonality(personalityForm); setSystemMessage({type:'success', text:'נשמר!'}); }} className="w-full mt-4 py-3 bg-slate-900 text-white rounded-xl font-bold">עדכני באתר</button>
              </div>
          </div>
      )}

      {/* --- שאר הטאבים (אירועים, חוגים, הגרלות) --- */}
      {activeTab === 'events' && (
          <div className="space-y-6">
              <button onClick={() => { setEditingEventId(null); setEventForm({title:'', location:'', category:'', price:0, image:''}); setIsEventModalOpen(true); }} className="bg-rose-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2">
                  <Plus size={20} /> אירוע חדש
              </button>
              <div className="grid gap-4">
                  {filteredData(apiEvents, 'title').map(ev => (
                      <div key={ev.id} className="bg-white p-4 rounded-2xl flex gap-4 items-center shadow-sm border border-slate-100">
                          <img src={ev.image || 'https://via.placeholder.com/100'} className="w-16 h-16 rounded-xl object-cover" />
                          <div className="flex-1"><h4 className="font-bold text-sm">{ev.title}</h4><p className="text-xs text-slate-400">{new Date(ev.date).toLocaleDateString()}</p></div>
                          <div className="flex gap-2"><button onClick={() => { setEditingEventId(ev.id); setEventForm(ev); setIsEventModalOpen(true); }} className="text-blue-400"><Edit size={18}/></button><button onClick={() => deleteEvent(ev.id)} className="text-red-400"><Trash2 size={18}/></button></div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* מודאלים לשמירה */}
      <Modal isOpen={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} title="ניהול אירוע">
          <form onSubmit={saveEvent} className="space-y-4">
              <input required placeholder="שם האירוע" className="w-full p-3 bg-slate-50 rounded-xl" value={eventForm.title} onChange={e=>setEventForm({...eventForm, title:e.target.value})} />
              <div className="grid grid-cols-2 gap-2"><input required type="date" className="w-full p-3 bg-slate-50 rounded-xl" value={eventForm.date ? new Date(eventForm.date).toISOString().split('T')[0] : ''} onChange={e=>setEventForm({...eventForm, date:e.target.value})} /><input required placeholder="מיקום" className="w-full p-3 bg-slate-50 rounded-xl" value={eventForm.location} onChange={e=>setEventForm({...eventForm, location:e.target.value})} /></div>
              <div className="border-2 border-dashed p-4 text-center relative rounded-xl">
                  <input type="file" onChange={e => handleFileUpload(e, setEventForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
                  {eventForm.image ? <img src={eventForm.image} className="h-20 mx-auto" /> : <p className="text-slate-400">העלאת תמונה (עד 2MB)</p>}
              </div>
              <button className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold">שמור אירוע</button>
          </form>
      </Modal>

      {isCommunityModalOpen && (
          <Modal isOpen={isCommunityModalOpen} onClose={() => setIsCommunityModalOpen(false)} title="הוספת פריט לקהילה">
              <div className="space-y-4">
                  <select className="w-full p-3 bg-slate-50 rounded-xl" value={communityForm.category} onChange={e => setCommunityForm({...communityForm, category: e.target.value})}>
                      <option>שיעורי תורה</option><option>גמ"חים</option><option>עסקים מקומיים</option>
                  </select>
                  <input placeholder="שם הגוף / העסק" className="w-full p-3 bg-slate-50 rounded-xl" value={communityForm.title} onChange={e => setCommunityForm({...communityForm, title: e.target.value})} />
                  <input placeholder="טלפון" className="w-full p-3 bg-slate-50 rounded-xl" value={communityForm.phone} onChange={e => setCommunityForm({...communityForm, phone: e.target.value})} />
                  <input placeholder="מיקום / כתובת" className="w-full p-3 bg-slate-50 rounded-xl" value={communityForm.location} onChange={e => setCommunityForm({...communityForm, location: e.target.value})} />
                  <div className="border-2 border-dashed p-4 text-center relative rounded-xl">
                      <input type="file" onChange={e => handleFileUpload(e, setCommunityForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
                      {communityForm.image ? <img src={communityForm.image} className="h-20 mx-auto" /> : <p className="text-slate-400">תמונה (עד 2MB)</p>}
                  </div>
                  <button onClick={async () => { await api.createCommunityItem(communityForm); setIsCommunityModalOpen(false); loadTabData(); }} className="w-full py-4 bg-rose-600 text-white rounded-xl font-bold">שמור בקהילה</button>
              </div>
          </Modal>
      )}

    </div>
  );
};

export default AdminPage;