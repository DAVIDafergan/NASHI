import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Plus, Users, Calendar, Gift, Search, Trash2, Edit, Save, 
  X, Eye, Send, Activity, Upload, Image as ImageIcon, BookOpen,
  Settings, Award, Copy, Sparkles, MessageSquare, Link as LinkIcon,
  CheckCircle, Clock, Phone, MapPin, HeartHandshake, ChevronLeft, GraduationCap
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
  const [activeTab, setActiveTab] = useState<'approvals' | 'community' | 'users' | 'events' | 'classes' | 'lotteries' | 'personality' | 'settings'>('approvals');
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
  
  // Forms States
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState<Partial<EventItem>>({ title: '', location: '', category: '', price: 0, image: '', date: '', isHero: false });

  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [classForm, setClassForm] = useState<Partial<ClassItem>>({
    title: '', instructor: '', contactPhone: '', day: 'ראשון', time: '', location: '', price: 0, ageGroup: '', category: 'ספורט', image: '', gender: 'נשים'
  });

  const [isLotteryModalOpen, setIsLotteryModalOpen] = useState(false);
  const [lotteryForm, setLotteryForm] = useState<Partial<LotteryItem>>({
    title: '', prize: '', drawDate: '', image: '', minPointsToEnter: 0, isMemberOnly: true
  });

  const [isCommunityModalOpen, setIsCommunityModalOpen] = useState(false);
  const [communityForm, setCommunityForm] = useState({ category: 'גמ"ח', title: '', location: '', phone: '', description: '', image: '' });

  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [pointsSettings, setPointsSettings] = useState({ pointsPerRegister: 50, pointsPerEventJoin: 10, pointsPerShare: 5 });

  // Personality State
  const [personalityLink, setPersonalityLink] = useState<string | null>(null);
  const [personalityForm, setPersonalityForm] = useState<PersonalityProfile>({
      id: '1', name: '', role: '', image: '', isActive: true, questions: [{question: '', answer: ''}]
  });

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
        } else if (activeTab === 'classes') {
            setApiClasses(await api.getClasses());
        } else if (activeTab === 'lotteries') {
            setApiLotteries(await api.getLotteries());
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
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => setForm((prev: any) => ({ ...prev, image: reader.result }));
    }
  };

  // --- פעולות ניהול ---
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

  const deleteUser = async (id: string) => {
      if (window.confirm('למחוק משתמשת זו לצמיתות?')) {
          await fetch(`https://nashi-production.up.railway.app/api/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
          loadTabData();
      }
  };

  const saveEvent = async (e: React.FormEvent) => {
      e.preventDefault();
      if (editingEventId) await api.updateEvent({ ...eventForm, id: editingEventId } as EventItem);
      else await api.createEvent(eventForm);
      setIsEventModalOpen(false);
      loadTabData();
  };

  const saveClass = async (e: React.FormEvent) => {
      e.preventDefault();
      if (editingClassId) await api.updateClass({ ...classForm, id: editingClassId } as ClassItem);
      else await api.createClass(classForm);
      setIsClassModalOpen(false);
      loadTabData();
  };

  const saveLottery = async (e: React.FormEvent) => {
      e.preventDefault();
      await api.createLottery(lotteryForm);
      setIsLotteryModalOpen(false);
      loadTabData();
  };

  const sendPersonalBenefit = async (email: string) => {
      const res = await api.createGiftCode({ points: 100, maxUses: 1 });
      alert(`לינק הטבה נוצר: ${res.link}\nשלחי אותו למשתמשת!`);
  };

  const filteredData = (data: any[], field: string) => 
      (data || []).filter(item => (item[field] || '').toLowerCase().includes(searchTerm.toLowerCase()));

  if (!user || !user.isAdmin) return <div className="p-20 text-center font-black text-rose-500 text-2xl">גישה למורשי ניהול בלבד.</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 pt-6 px-4 md:px-8 space-y-8">
      
      {/* תפריט ניהול מלא */}
      <div className="max-w-7xl mx-auto flex flex-wrap gap-2 bg-white p-2 rounded-[2.5rem] shadow-sm border border-slate-100 justify-center">
        {[
           { id: 'approvals', label: 'אישורים', icon: <CheckCircle size={16} /> },
           { id: 'users', label: 'משתמשים', icon: <Users size={16} /> },
           { id: 'events', label: 'אירועים', icon: <Calendar size={16} /> },
           { id: 'classes', label: 'חוגים', icon: <GraduationCap size={16} /> },
           { id: 'lotteries', label: 'הגרלות', icon: <Gift size={16} /> },
           { id: 'community', label: 'קהילה', icon: <HeartHandshake size={16} /> },
           { id: 'personality', label: 'אשת השבוע', icon: <Sparkles size={16} /> },
           { id: 'settings', label: 'הגדרות', icon: <Settings size={16} /> },
        ].map(tab => (
           <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'hover:bg-slate-50 text-slate-500'}`}>
             {tab.icon} {tab.label}
           </button>
        ))}
      </div>

      <div className="max-w-7xl mx-auto">
        
        {/* --- טאב משתמשים --- */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-[3rem] shadow-xl overflow-hidden border border-slate-100 animate-fade-in">
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-500 text-xs font-black uppercase">
                <tr>
                  <th className="p-6">שם המשתמשת</th>
                  <th className="p-6">ניקוד</th>
                  <th className="p-6">סטטוס</th>
                  <th className="p-6 text-center">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {apiUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-6 font-bold">{u.name} <br/><span className="text-[10px] text-slate-400 font-medium">{u.email}</span></td>
                    <td className="p-6 font-black text-rose-500">{u.points}</td>
                    <td className="p-6 text-xs">{u.isMemberApproved ? <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold">חברת מעגל</span> : <span className="bg-slate-100 text-slate-400 px-3 py-1 rounded-full">רשומה</span>}</td>
                    <td className="p-6 flex justify-center gap-2">
                       <button onClick={() => sendPersonalBenefit(u.email)} title="שלחי הטבה אישית" className="p-2 bg-yellow-50 text-yellow-600 rounded-xl hover:bg-yellow-100 transition-all"><Award size={18}/></button>
                       <button onClick={() => deleteUser(u.id)} className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"><Trash2 size={18}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- טאב חוגים (עם מגדר וגילאים) --- */}
        {activeTab === 'classes' && (
          <div className="space-y-6">
            <button onClick={() => { setEditingClassId(null); setClassForm({title:'', instructor:'', contactPhone:'', day:'ראשון', time:'', location:'', price:0, ageGroup:'', category:'ספורט', image:'', gender:'נשים'}); setIsClassModalOpen(true); }} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg hover:bg-rose-600 transition-all"><Plus/> חוג חדש</button>
            <div className="grid md:grid-cols-3 gap-6">
              {apiClasses.map(c => (
                <div key={c.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                  <img src={c.image} className="w-full h-32 object-cover rounded-2xl mb-4 shadow-sm" />
                  <h4 className="font-black text-slate-800">{c.title}</h4>
                  <p className="text-xs text-slate-500 font-bold mb-4">{c.instructor} • {c.ageGroup} ({c.gender})</p>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingClassId(c.id); setClassForm(c); setIsClassModalOpen(true); }} className="flex-1 bg-slate-100 p-2 rounded-xl text-xs font-bold hover:bg-white transition-all"><Edit size={14} className="inline ml-1"/> עריכה</button>
                    <button onClick={async () => { if(window.confirm('למחוק?')) {await api.deleteClass(c.id); loadTabData(); } }} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- טאב הגרלות --- */}
        {activeTab === 'lotteries' && (
          <div className="space-y-6">
            <button onClick={() => { setLotteryForm({title:'', prize:'', drawDate:'', image:'', minPointsToEnter:0, isMemberOnly:true}); setIsLotteryModalOpen(true); }} className="bg-purple-600 text-white px-8 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg"><Plus/> הגרלה חדשה</button>
            <div className="grid md:grid-cols-3 gap-6">
               {apiLotteries.map(l => (
                 <div key={l.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <img src={l.image} className="w-full h-32 object-cover rounded-2xl mb-4" />
                    <h4 className="font-black text-slate-800">{l.title}</h4>
                    <p className="text-xs text-slate-400 font-bold mb-4">תאריך: {new Date(l.drawDate).toLocaleString('he-IL')}</p>
                    <button onClick={async () => { if(window.confirm('למחוק?')) {await api.deleteLottery(l.id); loadTabData(); } }} className="w-full p-2 text-red-500 hover:bg-red-50 rounded-xl text-xs font-bold">מחק הגרלה</button>
                 </div>
               ))}
            </div>
          </div>
        )}

        {/* --- טאב קהילה (גמח, עסק, שיעור) --- */}
        {activeTab === 'community' && (
           <div className="space-y-6">
              <button onClick={() => setIsCommunityModalOpen(true)} className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg"><Plus/> הוספת גוף/שיעור/גמ"ח</button>
              <div className="grid md:grid-cols-3 gap-6">
                 {communityItems.map(item => (
                   <div key={item._id} className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 flex gap-4 items-center">
                      <img src={item.image} className="w-16 h-16 rounded-xl object-cover shadow-inner" />
                      <div className="flex-1">
                         <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full uppercase">{item.category}</span>
                         <h4 className="font-bold text-slate-800 text-sm mt-1">{item.title}</h4>
                      </div>
                      <button onClick={async () => { await api.deleteCommunityItem(item._id); loadTabData(); }} className="text-red-400 p-2 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                   </div>
                 ))}
              </div>
           </div>
        )}
        
        {/* טאב אשת השבוע (קיים) */}
        {activeTab === 'personality' && (
            <div className="max-w-2xl mx-auto space-y-8">
                <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl border border-rose-50 text-center space-y-6">
                    <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-500 mx-auto rotate-12"><Sparkles size={40} /></div>
                    <h3 className="text-3xl font-black">שאלון אשת השבוע</h3>
                    <button onClick={async () => { const res = await api.generateInterviewLink(); setPersonalityLink(res.link); }} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-3">
                        <LinkIcon size={22} /> הפקת לינק ייחודי
                    </button>
                    {personalityLink && (
                        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-center justify-between animate-bounce-in">
                            <p className="text-xs font-mono text-rose-800 truncate flex-1 font-bold">{personalityLink}</p>
                            <button onClick={() => {navigator.clipboard.writeText(personalityLink); alert('הלינק הועתק!');}} className="mr-4 p-3 bg-white rounded-xl shadow-md text-rose-600"><Copy size={18} /></button>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>

      {/* --- מודאלים מורחבים --- */}

      {/* מודאל חוגים מפורט */}
      <Modal isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)} title="ניהול חוג">
         <form onSubmit={saveClass} className="space-y-4">
            <input required placeholder="שם החוג" className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={classForm.title} onChange={e=>setClassForm({...classForm, title:e.target.value})} />
            <div className="grid grid-cols-2 gap-3">
               <input required placeholder="שם המדריכה/מדריך" className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={classForm.instructor} onChange={e=>setClassForm({...classForm, instructor:e.target.value})} />
               <input required placeholder="טלפון ליצירת קשר" className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={classForm.contactPhone} onChange={e=>setClassForm({...classForm, contactPhone:e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
               <select className="p-4 bg-slate-50 rounded-2xl font-bold" value={classForm.gender} onChange={e=>setClassForm({...classForm, gender:e.target.value as any})}>
                  <option value="נשים">נשים</option><option value="גברים">גברים</option><option value="בנות">בנות</option><option value="בנים">בנים</option>
               </select>
               <input required placeholder="גילאים (למשל: 6-12)" className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={classForm.ageGroup} onChange={e=>setClassForm({...classForm, ageGroup:e.target.value})} />
            </div>
            <input required placeholder="מיקום" className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={classForm.location} onChange={e=>setClassForm({...classForm, location:e.target.value})} />
            <div className="relative border-2 border-dashed border-slate-200 p-8 text-center rounded-[2rem] hover:border-rose-300 transition-all group">
                <input type="file" onChange={e => handleFileUpload(e, setClassForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
                {classForm.image ? <img src={classForm.image} className="h-32 mx-auto rounded-xl shadow-md" /> : (
                    <div className="text-slate-400">
                        <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-bold">העלאת תמונת חוג (מקסימום 2MB)</p>
                    </div>
                )}
            </div>
            <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black">שמירה</button>
         </form>
      </Modal>

      {/* מודאל הגרלה מפורט */}
      <Modal isOpen={isLotteryModalOpen} onClose={() => setIsLotteryModalOpen(false)} title="הגרלה חדשה">
         <form onSubmit={saveLottery} className="space-y-4">
            <input required placeholder="שם ההגרלה" className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={lotteryForm.title} onChange={e=>setLotteryForm({...lotteryForm, title:e.target.value})} />
            <input required placeholder="הפרס" className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={lotteryForm.prize} onChange={e=>setLotteryForm({...lotteryForm, prize:e.target.value})} />
            <div className="space-y-2">
               <label className="text-xs font-black text-slate-400 mr-2 uppercase">תאריך ושעת הגרלה</label>
               <input required type="datetime-local" className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={lotteryForm.drawDate} onChange={e=>setLotteryForm({...lotteryForm, drawDate:e.target.value})} />
            </div>
            <input type="number" placeholder="מינימום נקודות להשתתפות" className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={lotteryForm.minPointsToEnter} onChange={e=>setLotteryForm({...lotteryForm, minPointsToEnter: Number(e.target.value)})} />
            <div className="relative border-2 border-dashed border-slate-200 p-8 text-center rounded-[2rem]">
               <input type="file" onChange={e => handleFileUpload(e, setLotteryForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
               {lotteryForm.image ? <img src={lotteryForm.image} className="h-32 mx-auto rounded-xl shadow-md" /> : <p className="text-xs font-bold text-slate-400">העלאת תמונת פרס</p>}
            </div>
            <button className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black shadow-lg">פרסום הגרלה</button>
         </form>
      </Modal>

      {/* מודאל קהילה (גמח/עסק/שיעור) */}
      <Modal isOpen={isCommunityModalOpen} onClose={() => setIsCommunityModalOpen(false)} title="הוספה לקהילה">
         <div className="space-y-4">
            <select className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={communityForm.category} onChange={e=>setCommunityForm({...communityForm, category:e.target.value})}>
               <option>גמ"ח</option><option>שיעור תורה</option><option>עסק מקומי</option><option>גוף קהילתי</option>
            </select>
            <input placeholder="שם הגוף/העסק/השיעור" className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={communityForm.title} onChange={e=>setCommunityForm({...communityForm, title:e.target.value})} />
            <input placeholder="טלפון ליצירת קשר" className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={communityForm.phone} onChange={e=>setCommunityForm({...communityForm, phone:e.target.value})} />
            <input placeholder="מיקום" className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={communityForm.location} onChange={e=>setCommunityForm({...communityForm, location:e.target.value})} />
            <div className="relative border-2 border-dashed p-6 text-center rounded-2xl">
               <input type="file" onChange={e => handleFileUpload(e, setCommunityForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
               {communityForm.image ? <img src={communityForm.image} className="h-20 mx-auto" /> : <p className="text-xs font-bold text-slate-400">העלאת תמונה</p>}
            </div>
            <button onClick={async () => { await api.createCommunityItem(communityForm); setIsCommunityModalOpen(false); loadTabData(); }} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg">שמירה בקהילה</button>
         </div>
      </Modal>

    </div>
  );
};

export default AdminPage;