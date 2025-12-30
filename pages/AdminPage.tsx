import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Plus, Users, Calendar, Gift, Search, Trash2, Edit, Save, 
  X, Image as ImageIcon, BookOpen, Settings, Award, Sparkles, MessageSquare, 
  Link as LinkIcon, CheckCircle, Clock, Phone, MapPin, HeartHandshake, ChevronLeft, GraduationCap, Copy
} from 'lucide-react';
import { User, EventItem, LotteryItem, ClassItem, PersonalityProfile, CommunityItem } from '../types';
import { api } from '../services/api';

// קומפוננטת מודאל פנימית לשימוש בדף עם כל האפקטים המקוריים
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

const AdminPage: React.FC<{ user: User | null, onLogin: (user: User) => void }> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'approvals' | 'users' | 'events' | 'classes' | 'lotteries' | 'community' | 'personality' | 'settings'>('approvals');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data States
  const [apiUsers, setApiUsers] = useState<User[]>([]);
  const [apiEvents, setApiEvents] = useState<EventItem[]>([]);
  const [apiClasses, setApiClasses] = useState<ClassItem[]>([]);
  const [apiLotteries, setApiLotteries] = useState<LotteryItem[]>([]);
  const [communityItems, setCommunityItems] = useState<CommunityItem[]>([]);
  const [pendingData, setPendingData] = useState<{pendingUsers: User[], pendingPosts: any[]}>({pendingUsers: [], pendingPosts: []});
  
  // Form States
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventForm, setEventForm] = useState<Partial<EventItem>>({ title: '', location: '', category: 'מוזיקה', image: '', date: '', isHero: false, price: 0 });

  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [classForm, setClassForm] = useState<Partial<ClassItem>>({ title: '', instructor: '', contactPhone: '', day: 'ראשון', time: '', location: '', price: 0, ageGroup: '', gender: 'נשים', image: '' });

  const [isLotteryModalOpen, setIsLotteryModalOpen] = useState(false);
  const [lotteryForm, setLotteryForm] = useState<Partial<LotteryItem>>({ title: '', prize: '', drawDate: '', image: '', minPointsToEnter: 0 });

  const [isCommunityModalOpen, setIsCommunityModalOpen] = useState(false);
  const [communityForm, setCommunityForm] = useState<Partial<CommunityItem>>({ category: 'גמ"חים', title: '', phone: '', location: '', image: '', description: '' });

  const [personalityForm, setPersonalityForm] = useState<PersonalityProfile>({ id: '1', name: '', role: '', image: '', isActive: true, questions: [] });
  const [pendingInterviews, setPendingInterviews] = useState<PersonalityProfile[]>([]); // סטייט לראיונות ממתינים
  const [generatedLink, setGeneratedLink] = useState(''); // סטייט ללינק שנוצר כדי שיהיה אפשר להעתיק
  
  const [pointsSettings, setPointsSettings] = useState({ pointsPerRegister: 50, pointsPerEventJoin: 10, pointsPerShare: 5 });

  useEffect(() => { if (user?.isAdmin) loadTabData(); }, [activeTab, user]);

  const loadTabData = async () => {
    setLoading(true);
    try {
        if (activeTab === 'approvals') setPendingData(await api.getAdminApprovals());
        else if (activeTab === 'community') setCommunityItems(await api.getCommunityItems());
        else if (activeTab === 'users') {
            const data = await fetch('https://nashi-production.up.railway.app/api/users', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json());
            setApiUsers(data || []);
        }
        else if (activeTab === 'events') setApiEvents(await api.getEvents());
        else if (activeTab === 'classes') setApiClasses(await api.getClasses());
        else if (activeTab === 'lotteries') setApiLotteries(await api.getLotteries());
        else if (activeTab === 'personality') {
            setPersonalityForm(await api.getPersonality());
            setPendingInterviews(await api.getPendingInterviews()); // טעינת ראיונות שמילאו נשים
        }
        else if (activeTab === 'settings') setPointsSettings(await api.getSettings());
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: Function) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024) {
        alert('הקובץ גדול מדי! מקסימום 50KB בלבד.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setter((prev: any) => ({ ...prev, image: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  // פונקציות המחיקה המתוקנות עם בדיקת ID כפולה
  const handleDelete = async (id: string, type: 'user' | 'event' | 'class' | 'lottery' | 'community', name: string) => {
    if (!id) return alert('שגיאה: מזהה חסר');
    if (window.confirm(`למחוק את ${name} לצמיתות?`)) {
      try {
        if (type === 'user') await fetch(`https://nashi-production.up.railway.app/api/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        else if (type === 'event') await api.deleteEvent(id);
        else if (type === 'class') await api.deleteClass(id);
        else if (type === 'lottery') await api.deleteLottery(id);
        else if (type === 'community') await api.deleteCommunityItem(id);
        loadTabData();
      } catch (err) { alert('שגיאה במחיקה'); }
    }
  };

  const addQuestion = () => setPersonalityForm(p => ({ ...p, questions: [...(p.questions || []), { question: '', answer: '' }] }));
  const updateQuestion = (i: number, f: 'question' | 'answer', v: string) => {
    const qs = [...(personalityForm.questions || [])];
    qs[i][f] = v;
    setPersonalityForm({ ...personalityForm, questions: qs });
  };

  const sendPersonalBenefit = async (email: string) => {
      const res = await api.createGiftCode({ points: 100, maxUses: 1 });
      alert(`לינק הטבה נוצר: ${res.link}\nשלחי אותו למשתמשת!`);
  };

  if (!user || !user.isAdmin) return <div className="p-20 text-center font-black text-rose-500 text-2xl animate-fade-in">גישה למנהלות בלבד.</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 pt-6 px-4 md:px-8 space-y-8 overflow-x-hidden text-right" dir="rtl">
      
      {/* תפריט טאבים רספונסיבי */}
      <div className="max-w-7xl mx-auto flex overflow-x-auto md:flex-wrap no-scrollbar gap-2 bg-white p-2 rounded-[2.5rem] shadow-sm border border-slate-100 justify-start md:justify-center">
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
           <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'hover:bg-slate-50 text-slate-500'}`}>
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
        
        {/* טאב אישורים */}
        {activeTab === 'approvals' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
            <div className="bg-white p-6 md:p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
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
            <div className="bg-white p-6 md:p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
               <h3 className="font-black text-xl flex items-center gap-2 text-right"><MessageSquare className="text-blue-500"/> פוסטים לאישור</h3>
               <div className="space-y-4">
                 {pendingData.pendingPosts.map(p => (
                   <div key={p._id} className="p-4 bg-slate-50 rounded-2xl space-y-2 animate-fade-in-up">
                     <div className="flex justify-between items-center gap-2"><p className="font-black text-sm truncate">{p.title}</p><button onClick={() => api.approvePost(p._id).then(loadTabData)} className="text-green-600 shrink-0"><CheckCircle/></button></div>
                     <p className="text-xs text-slate-500 line-clamp-2 text-right">{p.content}</p>
                   </div>
                 ))}
                 {pendingData.pendingPosts.length === 0 && <p className="text-center text-slate-400 italic">אין פוסטים שמחכים</p>}
               </div>
            </div>
          </div>
        )}

        {/* טאב משתמשים */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-[3rem] shadow-xl overflow-hidden border border-slate-100 animate-fade-in overflow-x-auto">
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
            <button onClick={() => setIsEventModalOpen(true)} className="w-full md:w-auto bg-rose-600 text-white px-8 py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:shadow-lg transition-all"><Plus/> אירוע חדש</button>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {apiEvents.map(ev => (
                <div key={ev._id || ev.id} className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 animate-fade-in-up">
                  {ev.isHero && <Sparkles className="text-yellow-400 mb-2 animate-pulse" size={16}/>}
                  <img src={ev.image} className="w-full h-32 md:h-40 object-cover rounded-2xl mb-4" />
                  <h4 className="font-black text-slate-800">{ev.title}</h4>
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-[10px] text-slate-400">{ev.location}</span>
                    <button className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors" onClick={() => handleDelete(ev._id || ev.id, 'event', ev.title)}><Trash2 size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* טאב חוגים */}
        {activeTab === 'classes' && (
          <div className="space-y-6 animate-fade-in">
            <button onClick={() => setIsClassModalOpen(true)} className="w-full md:w-auto bg-slate-900 text-white px-8 py-3 rounded-2xl font-black flex items-center justify-center gap-2"><Plus/> חוג חדש</button>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {apiClasses.map(c => (
                <div key={c._id || c.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 animate-fade-in-up">
                  <img src={c.image} className="w-full h-32 md:h-40 object-cover rounded-2xl mb-4" />
                  <h4 className="font-black text-lg">{c.title}</h4>
                  <p className="text-xs text-slate-400">{c.instructor} | {c.gender}</p>
                  <button onClick={() => handleDelete(c._id || c.id, 'class', c.title)} className="text-red-500 mt-4 p-2 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* טאב הגרלות */}
        {activeTab === 'lotteries' && (
          <div className="space-y-6 animate-fade-in">
            <button onClick={() => setIsLotteryModalOpen(true)} className="w-full md:w-auto bg-purple-600 text-white px-8 py-3 rounded-2xl font-black flex items-center justify-center gap-2"><Plus/> הגרלה חדשה</button>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {apiLotteries.map(l => (
                <div key={l._id || l.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 animate-fade-in-up">
                  <img src={l.image} className="w-full h-32 md:h-40 object-cover rounded-2xl mb-4" />
                  <h4 className="font-black text-lg">{l.title}</h4>
                  <p className="text-xs text-slate-400">{new Date(l.drawDate).toLocaleString()}</p>
                  <button onClick={() => handleDelete(l._id || l.id, 'lottery', l.title)} className="text-red-500 mt-4 p-2 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* טאב קהילה */}
        {activeTab === 'community' && (
          <div className="space-y-6 animate-fade-in">
            <button onClick={() => setIsCommunityModalOpen(true)} className="w-full md:w-auto bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black flex items-center justify-center gap-2"><Plus/> הוספה לקהילה</button>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-right">
              {communityItems.map(item => (
                <div key={item._id} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 flex items-center gap-4 animate-fade-in-up shadow-sm">
                  <img src={item.image} className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-50" />
                  <div className="flex-1 overflow-hidden">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">{item.category}</span>
                    <h4 className="font-bold text-sm truncate">{item.title}</h4>
                  </div>
                  <button onClick={() => handleDelete(item._id, 'community', item.title)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
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
                  <button 
                    onClick={async () => {
                      if(window.confirm("למחוק את אשת השבוע הנוכחית מהאתר?")) {
                        await api.updatePersonality({ name: '', role: '', image: '', questions: [], isActive: false });
                        alert("נמחק!");
                        loadTabData();
                      }
                    }}
                    className="text-red-500 font-bold text-xs hover:underline"
                  >
                    מחיקת אשת שבוע נוכחית
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input placeholder="שם מלא" className="p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={personalityForm.name} onChange={e=>setPersonalityForm({...personalityForm, name:e.target.value})} />
                <input placeholder="תפקיד / תיאור" className="p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={personalityForm.role} onChange={e=>setPersonalityForm({...personalityForm, role:e.target.value})} />
              </div>
              <div className="relative border-2 border-dashed border-slate-200 p-8 text-center rounded-[2.5rem]">
                 <input type="file" onChange={e => handleFileUpload(e, setPersonalityForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
                 {personalityForm.image ? <img src={personalityForm.image} className="h-40 mx-auto rounded-3xl shadow-lg animate-fade-in" /> : <p className="font-bold text-slate-400">העלאת תמונת פרופיל (עד 50KB)</p>}
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center"><h4 className="font-black">הגדרת שאלון (ללא תשובות)</h4><button onClick={addQuestion} className="text-rose-500 font-bold">+ הוספת שאלה</button></div>
                <div className="space-y-3">
                  {personalityForm.questions?.map((q, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-2xl space-y-2 relative animate-fade-in-up">
                      <button onClick={()=>{const qs=[...personalityForm.questions!]; qs.splice(i,1); setPersonalityForm({...personalityForm, questions:qs});}} className="absolute -top-2 -left-2 text-red-500 bg-white rounded-full p-1 shadow-sm"><X size={16}/></button>
                      <input placeholder="שאלה" className="w-full p-2 bg-white rounded-xl text-sm font-bold outline-none text-right" value={q.question} onChange={e=>updateQuestion(i,'question',e.target.value)} />
                      <textarea placeholder="תשובה" className="w-full p-2 bg-white rounded-xl text-sm resize-none outline-none text-right" value={q.answer} onChange={e=>updateQuestion(i,'answer',e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <button onClick={async () => { await api.updatePersonality({...personalityForm, isActive: true}); alert('עודכן!'); }} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black shadow-xl hover:bg-rose-600 transition-all text-center">עדכון ישיר באתר</button>
                
                <div className="space-y-3 pt-6 border-t">
                  <button 
                    onClick={async () => { 
                      const res = await api.generateInterviewLink(); 
                      const fullLink = `${window.location.origin}/#/interview/${res.token || res.id}`;
                      setGeneratedLink(fullLink);
                    }} 
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-md text-center"
                  >
                    <LinkIcon size={18}/> הפקת לינק לשליחה לאישה
                  </button>

                  {generatedLink && (
                    <div className="p-4 bg-blue-50 rounded-2xl border-2 border-blue-100 flex items-center gap-3 animate-fade-in-up">
                      <input readOnly className="flex-1 bg-transparent font-mono text-[10px] text-blue-800 text-left outline-none overflow-hidden" value={generatedLink} />
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(generatedLink);
                          alert("הלינק הועתק בהצלחה!");
                        }}
                        className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ראיונות שהושלמו וממתינים לאישור */}
            {pendingInterviews.length > 0 && (
               <div className="space-y-4">
                  <h4 className="font-black text-xl text-slate-700 pr-4">ראיונות שהושלמו וממתינים לאישורך:</h4>
                  {pendingInterviews.map((interview) => (
                    <div key={interview._id || interview.id} className="bg-white p-6 rounded-[2.5rem] shadow-md border-r-8 border-emerald-500 flex justify-between items-center animate-fade-in-up">
                       <div className="text-right">
                          <p className="font-black text-xl text-slate-800">{interview.name}</p>
                          <p className="text-sm text-slate-500">{interview.role}</p>
                       </div>
                       <button 
                        onClick={async () => {
                          await api.approvePersonality(interview._id || interview.id);
                          alert("אשת השבוע עודכנה באתר!");
                          loadTabData();
                        }}
                        className="bg-emerald-500 text-white px-8 py-3 rounded-2xl font-black hover:bg-emerald-600 transition-all shadow-md"
                       >
                         אישור ופרסום באתר
                       </button>
                    </div>
                  ))}
               </div>
            )}
          </div>
        )}

        {/* טאב הגדרות */}
        {activeTab === 'settings' && (
          <div className="max-w-xl mx-auto bg-white p-8 md:p-12 rounded-[4rem] shadow-2xl space-y-8 animate-fade-in">
            <h3 className="text-2xl font-black flex items-center gap-3"><Settings className="text-rose-500"/> הגדרות ניקוד</h3>
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

      {/* מודאלים לניהול */}
      <Modal isOpen={isEventModalOpen} onClose={()=>setIsEventModalOpen(false)} title="אירוע חדש">
        <form onSubmit={async (e)=>{e.preventDefault(); await api.createEvent(eventForm); setIsEventModalOpen(false); loadTabData();}} className="space-y-4">
          <input required placeholder="שם האירוע" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={eventForm.title} onChange={e=>setEventForm({...eventForm, title:e.target.value})} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-right">
              <input required type="date" className="p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={eventForm.date} onChange={e=>setEventForm({...eventForm, date:e.target.value})} />
              <input required placeholder="מחיר" type="number" className="p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={eventForm.price} onChange={e=>setEventForm({...eventForm, price:Number(e.target.value)})} />
          </div>
          <input required placeholder="מיקום" className="w-full p-4 bg-slate-50 rounded-2xl outline-none text-right" value={eventForm.location} onChange={e=>setEventForm({...eventForm, location:e.target.value})} />
          <div className="flex items-center gap-2 p-4 bg-yellow-50 rounded-2xl"><input type="checkbox" className="w-4 h-4" checked={eventForm.isHero} onChange={e=>setEventForm({...eventForm, isHero:e.target.checked})}/><label className="text-sm font-bold">הצגה בסליידר הראשי</label></div>
          <div className="relative border-2 border-dashed p-6 text-center rounded-2xl text-right">
              <input type="file" onChange={e => handleFileUpload(e, setEventForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
              {eventForm.image ? <img src={eventForm.image} className="h-20 mx-auto rounded-lg shadow-sm" /> : <p className="text-xs font-bold text-slate-400">לחצי להעלאת תמונה (עד 50KB)</p>}
          </div>
          <button className="w-full py-4 bg-rose-500 text-white rounded-2xl font-black shadow-lg">שמירת אירוע</button>
        </form>
      </Modal>

      <Modal isOpen={isClassModalOpen} onClose={()=>setIsClassModalOpen(false)} title="חוג חדש">
        <form onSubmit={async (e)=>{e.preventDefault(); await api.createClass(classForm); setIsClassModalOpen(false); loadTabData();}} className="space-y-4 text-right">
          <input required placeholder="שם החוג" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={classForm.title} onChange={e=>setClassForm({...classForm, title:e.target.value})} />
          <div className="grid grid-cols-2 gap-2">
              <select className="p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={classForm.gender} onChange={e=>setClassForm({...classForm, gender:e.target.value as any})}>
                <option value="נשים">נשים</option>
                <option value="בנות">בנות</option>
                <option value="בנים">בנים</option>
              </select>
              <input placeholder="גילאים" className="p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={classForm.ageGroup} onChange={e=>setClassForm({...classForm, ageGroup:e.target.value})} />
          </div>
          <div className="relative border-2 border-dashed p-6 text-center rounded-2xl text-right">
              <input type="file" onChange={e => handleFileUpload(e, setClassForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
              {classForm.image ? <img src={classForm.image} className="h-20 mx-auto rounded-lg" /> : <p className="text-xs font-bold text-slate-400">העלאת תמונה (עד 50KB)</p>}
          </div>
          <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black">שמירת חוג</button>
        </form>
      </Modal>

      <Modal isOpen={isLotteryModalOpen} onClose={()=>setIsLotteryModalOpen(false)} title="הגרלה חדשה">
        <form onSubmit={async (e)=>{e.preventDefault(); await api.createLottery(lotteryForm); setIsLotteryModalOpen(false); loadTabData();}} className="space-y-4">
           <input required placeholder="שם ההגרלה" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={lotteryForm.title} onChange={e=>setLotteryForm({...lotteryForm, title:e.target.value})} />
           <input required placeholder="הפרס" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={lotteryForm.prize} onChange={e=>setLotteryForm({...lotteryForm, prize:e.target.value})} />
           <input required type="datetime-local" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={lotteryForm.drawDate} onChange={e=>setLotteryForm({...lotteryForm, drawDate:e.target.value})} />
           <div className="relative border-2 border-dashed p-6 text-center rounded-2xl text-right">
              <input type="file" onChange={e => handleFileUpload(e, setLotteryForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
              {lotteryForm.image ? <img src={lotteryForm.image} className="h-20 mx-auto rounded-lg" /> : <p className="text-xs font-bold text-slate-400">העלאת תמונת פרס (עד 50KB)</p>}
           </div>
           <button className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black">פרסום</button>
        </form>
      </Modal>

      <Modal isOpen={isCommunityModalOpen} onClose={()=>setIsCommunityModalOpen(false)} title="הוספה לקהילה">
         <form onSubmit={async (e)=>{
           e.preventDefault(); 
           try {
             const res = await api.createCommunityItem(communityForm); 
             if(res) {
               setCommunityForm({ category: 'גמ"חים', title: '', phone: '', location: '', image: '', description: '' });
               setIsCommunityModalOpen(false); 
               loadTabData();
             }
           } catch(err) { alert("שגיאה בשמירה לקהילה. ודאי שהתמונה קטנה מ-50KB."); }
         }} className="space-y-4 text-right">
            <select className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-right" value={communityForm.category} onChange={e=>setCommunityForm({...communityForm, category:e.target.value as any})}>
              <option value='גמ"חים'>גמ"חים</option>
              <option value="שיעורי תורה">שיעורי תורה</option>
              <option value="עסק מקומי">עסקים מקומיים</option>
            </select>
            <input required placeholder="שם הגוף/עסק" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={communityForm.title} onChange={e=>setCommunityForm({...communityForm, title:e.target.value})} />
            <input placeholder="טלפון" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={communityForm.phone} onChange={e=>setCommunityForm({...communityForm, phone:e.target.value})} />
            <input placeholder="מיקום" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-right outline-none" value={communityForm.location} onChange={e=>setCommunityForm({...communityForm, location:e.target.value})} />
            <div className="relative border-2 border-dashed p-6 text-center rounded-2xl text-right">
               <input type="file" onChange={e => handleFileUpload(e, setCommunityForm)} className="absolute inset-0 opacity-0 cursor-pointer" />
               {communityForm.image ? <img src={communityForm.image} className="h-20 mx-auto rounded-lg" /> : <p className="text-xs font-bold text-slate-400">העלאת תמונה (עד 50KB)</p>}
            </div>
            <button className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg">שמירה ופרסום</button>
         </form>
      </Modal>

    </div>
  );
};

export default AdminPage;