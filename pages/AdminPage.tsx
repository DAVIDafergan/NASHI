import React, { useState } from 'react';
import { ShieldCheck, Plus, Users, Calendar, Gift, Search, Trash2, Edit, Save, LogIn, BookOpen, X, Phone, Check, Eye, User as UserIcon, MapPin, Mail, Award, MessageSquare, Sparkles, Copy, PlayCircle } from 'lucide-react';
import { User, EventItem, LotteryItem, ClassItem, UserLevel, LotteryEligibilityType, Review, PersonalityProfile } from '../types';
import { useNavigate } from 'react-router-dom';

interface AdminPageProps {
  user: User | null;
  onLogin: (user: User) => void;
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

const mockUsers: User[] = [
  { id: '1', name: 'דנה כהן', email: 'dana@email.com', phone: '050-1234567', address: 'הפרחים 12, עיר', points: 230, level: UserLevel.ACTIVE, upcomingEvents: 2, communicationPref: 'whatsapp', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Annie' },
  { id: '2', name: 'מיכל לוי', email: 'michal@email.com', phone: '052-7654321', address: 'הרקפת 4, עיר', points: 500, level: UserLevel.LEADER, upcomingEvents: 5, communicationPref: 'email', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zoey' },
];

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
    events = [], classes = [], lotteries = [], reviews = [], personality,
    onAddEvent, onUpdateEvent, onDeleteEvent, 
    onAddClass, onUpdateClass, onDeleteClass, 
    onAddLottery, onUpdateLottery, onDeleteLottery,
    onUpdatePersonality
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'events' | 'users' | 'lotteries' | 'classes' | 'reviews' | 'personality'>('users');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  
  // Modals State
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isLotteryModalOpen, setIsLotteryModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  
  // Edit/Select State
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingLotteryId, setEditingLotteryId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Forms
  const [eventForm, setEventForm] = useState<Partial<EventItem>>({ title: '', location: '', category: '', price: 0, image: 'https://picsum.photos/400/300', tags: [], isHero: false });
  const [classForm, setClassForm] = useState<Partial<ClassItem>>({ title: '', instructor: '', contactPhone: '', day: 'ראשון', time: '17:00', location: '', price: 0, ageGroup: '', category: '', image: 'https://picsum.photos/400/300' });
  const [lotteryForm, setLotteryForm] = useState<Partial<LotteryItem>>({ 
      title: '', prize: '', drawDate: '', image: 'https://picsum.photos/500/300', participants: [], isActive: true,
      eligibilityType: 'all', minPointsToEnter: 0, minLevel: UserLevel.BEGINNER, specificUserId: ''
  });
  const [personalityForm, setPersonalityForm] = useState<PersonalityProfile | undefined>(personality);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginForm.username === 'YA1212' && loginForm.password === '1212') {
      onLogin({
        id: 'admin',
        name: 'מנהלת מערכת',
        email: 'admin@nashi.city',
        points: 0,
        level: UserLevel.AMBASSADOR,
        upcomingEvents: 0,
        isAdmin: true,
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jane'
      });
    } else {
      setError('שם משתמש או סיסמה שגויים');
    }
  };

  // --- Handlers ---

  const handleViewUser = (u: User) => {
      setSelectedUser(u);
      setIsUserModalOpen(true);
  };

  // Event Handlers
  const handleOpenEventModal = (event?: EventItem) => {
      if (event) {
          setEditingEventId(event.id);
          setEventForm(event);
      } else {
          setEditingEventId(null);
          setEventForm({ title: '', location: '', category: '', price: 0, image: 'https://picsum.photos/400/300', tags: [], ratings: [], isHero: false });
      }
      setIsEventModalOpen(true);
  };

  const handleSaveEvent = (e: React.FormEvent) => {
      e.preventDefault();
      if (editingEventId && onUpdateEvent) {
          onUpdateEvent({ ...eventForm as EventItem, id: editingEventId });
      } else if (onAddEvent) {
          onAddEvent({ ...eventForm as EventItem, id: Date.now().toString(), date: new Date().toISOString(), ratings: [] });
      }
      setIsEventModalOpen(false);
  };

  // Class Handlers
  const handleOpenClassModal = (cls?: ClassItem) => {
      if (cls) {
          setEditingClassId(cls.id);
          setClassForm(cls);
      } else {
          setEditingClassId(null);
          setClassForm({ title: '', instructor: '', contactPhone: '', day: 'ראשון', time: '17:00', location: '', price: 0, ageGroup: '', category: '', image: 'https://picsum.photos/400/300' });
      }
      setIsClassModalOpen(true);
  };

  const handleSaveClass = (e: React.FormEvent) => {
      e.preventDefault();
      if (editingClassId && onUpdateClass) {
          onUpdateClass({ ...classForm as ClassItem, id: editingClassId });
      } else if (onAddClass) {
          onAddClass({ ...classForm as ClassItem, id: Date.now().toString() });
      }
      setIsClassModalOpen(false);
  };

  // Lottery Handlers
  const handleOpenLotteryModal = (lottery?: LotteryItem) => {
      if (lottery) {
          setEditingLotteryId(lottery.id);
          setLotteryForm(lottery);
      } else {
          setEditingLotteryId(null);
          setLotteryForm({ 
              title: '', prize: '', drawDate: '', image: 'https://picsum.photos/500/300', participants: [], isActive: true,
              eligibilityType: 'all', minPointsToEnter: 0, minLevel: UserLevel.BEGINNER, specificUserId: ''
          });
      }
      setIsLotteryModalOpen(true);
  };

  const handleSaveLottery = (e: React.FormEvent) => {
      e.preventDefault();
      if (editingLotteryId && onUpdateLottery) {
          onUpdateLottery({ ...lotteryForm as LotteryItem, id: editingLotteryId });
      } else if (onAddLottery) {
          onAddLottery({ ...lotteryForm as LotteryItem, id: Date.now().toString(), participants: [] });
      }
      setIsLotteryModalOpen(false);
  };

  const handleStartLiveDraw = (lotteryId: string) => {
      // Navigate to Lottery Page with specific state to open the modal
      navigate('/lottery', { state: { liveLotteryId: lotteryId } });
  };

  // Personality
  const handleSavePersonality = () => {
      if (onUpdatePersonality && personalityForm) {
          onUpdatePersonality(personalityForm);
          alert('אישיות השבוע עודכנה בהצלחה!');
      }
  };

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
              <label className="block text-sm font-bold text-slate-700 mb-2 mr-1">שם משתמש</label>
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
             { id: 'personality', label: 'אישיות השבוע', icon: <Sparkles size={18} /> }
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

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden min-h-[500px]">
        
        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="p-4 md:p-6">
             <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h3 className="text-xl font-bold text-slate-800">רשימת משתמשים</h3>
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
                        <th className="p-4">דרגה</th>
                        <th className="p-4 rounded-l-xl">פעולות</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {mockUsers.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                           <td className="p-4 font-bold text-slate-800">{u.name}</td>
                           <td className="p-4">{u.email}</td>
                           <td className="p-4 font-mono text-rose-600 font-bold">{u.points}</td>
                           <td className="p-4"><span className="px-3 py-1 bg-rose-50 text-rose-700 rounded-full text-xs font-bold">{u.level}</span></td>
                           <td className="p-4">
                              <button onClick={() => handleViewUser(u)} className="text-slate-400 hover:text-rose-600 transition-colors bg-slate-50 p-2 rounded-full"><Eye size={18} /></button>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}

        {/* REVIEWS TAB */}
        {activeTab === 'reviews' && (
           <div className="p-6">
              <h3 className="text-xl font-bold text-slate-800 mb-6">חוות דעת אחרונות</h3>
              {reviews.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">אין חוות דעת להצגה</div>
              ) : (
                  <div className="grid gap-4">
                      {reviews.map(review => (
                          <div key={review.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                              <div className="flex justify-between mb-2">
                                  <span className="font-bold text-slate-800">{review.eventTitle}</span>
                                  <span className="text-xs text-slate-500">{review.date}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                                  <span>מאת: {review.userName}</span>
                                  <span className="flex items-center text-yellow-500 font-bold"><span className="text-slate-800 ml-1">דירוג:</span> {review.rating} ★</span>
                              </div>
                              <p className="bg-white p-3 rounded-xl text-slate-700 text-sm border border-slate-200">"{review.comment}"</p>
                          </div>
                      ))}
                  </div>
              )}
           </div>
        )}

        {/* PERSONALITY TAB */}
        {activeTab === 'personality' && personalityForm && (
           <div className="p-6 max-w-3xl mx-auto">
               <h3 className="text-xl font-bold text-slate-800 mb-6">ניהול אישיות השבוע</h3>
               <div className="space-y-6">
                   <div className="bg-rose-50 p-4 rounded-2xl flex items-center justify-between border border-rose-100">
                       <span className="text-rose-800 font-bold text-sm">שלחי קישור לאישה למילוי השאלון</span>
                       <button onClick={() => alert('הקישור הועתק!')} className="flex items-center gap-2 bg-white text-rose-600 px-4 py-2 rounded-xl text-xs font-bold shadow-sm">
                           <Copy size={16} /> העתקת קישור
                       </button>
                   </div>
                   
                   <div className="grid md:grid-cols-2 gap-4">
                       <div>
                           <label className="text-xs font-bold text-slate-500 mb-1 block">שם מלא</label>
                           <input className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" value={personalityForm.name} onChange={e => setPersonalityForm({...personalityForm, name: e.target.value})} />
                       </div>
                       <div>
                           <label className="text-xs font-bold text-slate-500 mb-1 block">תפקיד / עיסוק</label>
                           <input className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" value={personalityForm.role} onChange={e => setPersonalityForm({...personalityForm, role: e.target.value})} />
                       </div>
                       <div className="md:col-span-2">
                           <label className="text-xs font-bold text-slate-500 mb-1 block">תמונה (URL)</label>
                           <input className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" value={personalityForm.image} onChange={e => setPersonalityForm({...personalityForm, image: e.target.value})} />
                       </div>
                   </div>

                   <div className="space-y-4">
                       <h4 className="font-bold text-slate-700 border-b pb-2">שאלות ותשובות</h4>
                       {personalityForm.questions.map((q, idx) => (
                           <div key={idx} className="bg-slate-50 p-4 rounded-2xl space-y-2">
                               <input 
                                  className="w-full p-2 bg-white rounded-lg border border-slate-200 text-sm font-bold" 
                                  value={q.question}
                                  onChange={(e) => {
                                      const newQs = [...personalityForm.questions];
                                      newQs[idx].question = e.target.value;
                                      setPersonalityForm({...personalityForm, questions: newQs});
                                  }}
                               />
                               <textarea 
                                  className="w-full p-2 bg-white rounded-lg border border-slate-200 text-sm" 
                                  rows={2}
                                  value={q.answer}
                                  onChange={(e) => {
                                      const newQs = [...personalityForm.questions];
                                      newQs[idx].answer = e.target.value;
                                      setPersonalityForm({...personalityForm, questions: newQs});
                                  }}
                               />
                           </div>
                       ))}
                   </div>

                   <div className="flex items-center gap-2">
                       <input 
                          type="checkbox" 
                          checked={personalityForm.isActive}
                          onChange={e => setPersonalityForm({...personalityForm, isActive: e.target.checked})}
                          className="w-5 h-5 accent-rose-500"
                       />
                       <span className="font-bold text-slate-700">הצג בדף הבית</span>
                   </div>

                   <button onClick={handleSavePersonality} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold">שמירת שינויים</button>
               </div>
           </div>
        )}

        {/* EVENTS TAB */}
        {activeTab === 'events' && (
           <div className="p-4 md:p-6">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-bold text-slate-800">אירועים ({events.length})</h3>
                 <button onClick={() => handleOpenEventModal()} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-rose-600 transition-colors">
                    <Plus size={18} /> <span className="hidden md:inline">הוספת אירוע</span>
                 </button>
              </div>

              <div className="grid gap-4">
                  {events.map(event => (
                      <div key={event.id} className="flex flex-col md:flex-row md:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
                          <img src={event.image} alt="" className="w-full md:w-20 h-32 md:h-20 rounded-xl object-cover" />
                          <div className="flex-1">
                              <h4 className="font-bold text-slate-800">{event.title} {event.isHero && <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full mr-2">מקודם בראשי</span>}</h4>
                              <p className="text-xs text-slate-500">{new Date(event.date).toLocaleDateString()} | {event.location}</p>
                              <span className="inline-block mt-2 px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600">{event.category}</span>
                          </div>
                          <div className="flex gap-2 justify-end self-start md:self-center">
                             <button onClick={() => handleOpenEventModal(event)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg transition-colors"><Edit size={16} /></button>
                             <button onClick={() => onDeleteEvent && onDeleteEvent(event.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                          </div>
                      </div>
                  ))}
              </div>

              {/* Event Modal */}
              <Modal isOpen={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} title={editingEventId ? "עריכת אירוע" : "הוספת אירוע חדש"}>
                  <form onSubmit={handleSaveEvent} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500">שם האירוע</label>
                              <input required className="p-3 rounded-xl border border-slate-200 w-full bg-slate-50 focus:ring-2 focus:ring-rose-200 outline-none" value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500">מיקום</label>
                              <input required className="p-3 rounded-xl border border-slate-200 w-full bg-slate-50 focus:ring-2 focus:ring-rose-200 outline-none" value={eventForm.location} onChange={e => setEventForm({...eventForm, location: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500">קטגוריה</label>
                              <input required className="p-3 rounded-xl border border-slate-200 w-full bg-slate-50 focus:ring-2 focus:ring-rose-200 outline-none" value={eventForm.category} onChange={e => setEventForm({...eventForm, category: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500">מחיר (₪)</label>
                              <input type="number" className="p-3 rounded-xl border border-slate-200 w-full bg-slate-50 focus:ring-2 focus:ring-rose-200 outline-none" value={eventForm.price} onChange={e => setEventForm({...eventForm, price: Number(e.target.value)})} />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                              <label className="text-xs font-bold text-slate-500">קישור לתמונה</label>
                              <input className="p-3 rounded-xl border border-slate-200 w-full bg-slate-50 focus:ring-2 focus:ring-rose-200 outline-none" value={eventForm.image} onChange={e => setEventForm({...eventForm, image: e.target.value})} />
                          </div>
                          <div className="md:col-span-2 flex items-center gap-2 bg-slate-50 p-3 rounded-xl">
                              <input type="checkbox" checked={eventForm.isHero} onChange={e => setEventForm({...eventForm, isHero: e.target.checked})} className="w-5 h-5 accent-rose-500" />
                              <span className="text-sm font-bold text-slate-700">הצג בסליידר הראשי (דף הבית)</span>
                          </div>
                      </div>
                      <button type="submit" className="w-full py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all flex justify-center items-center gap-2">
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
                 <h3 className="text-xl font-bold text-slate-800">חוגים ({classes.length})</h3>
                 <button onClick={() => handleOpenClassModal()} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200">
                    <Plus size={18} /> <span className="hidden md:inline">הוספת חוג</span>
                 </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {classes.map(cls => (
                      <div key={cls.id} className="flex gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                          <img src={cls.image} alt="" className="w-20 h-20 rounded-xl object-cover hidden sm:block" />
                          <div className="flex-1">
                              <h4 className="font-bold text-slate-800">{cls.title}</h4>
                              <p className="text-xs text-slate-500 mb-1">מדריכה: {cls.instructor}</p>
                              <input required placeholder="טלפון ליצירת קשר" className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={classForm.contactPhone} onChange={e => setClassForm({...classForm, contactPhone: e.target.value})} />
                              <div className="flex flex-wrap gap-2 text-xs">
                                  <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md">{cls.day} {cls.time}</span>
                              </div>
                          </div>
                          <div className="flex flex-col justify-between items-end gap-2">
                             <div className="flex gap-1">
                                 <button onClick={() => handleOpenClassModal(cls)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg transition-colors"><Edit size={16} /></button>
                                 <button onClick={() => onDeleteClass && onDeleteClass(cls.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                             </div>
                             <span className="font-bold text-slate-800">₪{cls.price}</span>
                          </div>
                      </div>
                  ))}
              </div>

              {/* Class Modal */}
              <Modal isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)} title={editingClassId ? "עריכת חוג" : "הוספת חוג חדש"}>
                  <form onSubmit={handleSaveClass} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input required placeholder="שם החוג" className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={classForm.title} onChange={e => setClassForm({...classForm, title: e.target.value})} />
                          <input required placeholder="שם המדריכה" className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={classForm.instructor} onChange={e => setClassForm({...classForm, instructor: e.target.value})} />
                          <input required placeholder="טלפון ליצירת קשר" className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={classForm.contactPhone} onChange={e => setClassForm({...classForm, contactPhone: e.target.value})} />
                          
                          {/* Precise Day Selector */}
                          <div>
                             <label className="text-xs font-bold text-slate-500 mb-1 block">יום בשבוע</label>
                             <select className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={classForm.day} onChange={e => setClassForm({...classForm, day: e.target.value})}>
                                  <option>ראשון</option>
                                  <option>שני</option>
                                  <option>שלישי</option>
                                  <option>רביעי</option>
                                  <option>חמישי</option>
                                  <option>שישי</option>
                                  <option>מוצא"ש</option>
                             </select>
                          </div>
                          
                          {/* Precise Time Picker */}
                          <div>
                              <label className="text-xs font-bold text-slate-500 mb-1 block">שעת התחלה</label>
                              <input required type="time" className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={classForm.time} onChange={e => setClassForm({...classForm, time: e.target.value})} />
                          </div>

                          <input required placeholder="מיקום" className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={classForm.location} onChange={e => setClassForm({...classForm, location: e.target.value})} />
                          <input required type="number" placeholder="מחיר" className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={classForm.price} onChange={e => setClassForm({...classForm, price: Number(e.target.value)})} />
                          <input required placeholder="קבוצת גיל" className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={classForm.ageGroup} onChange={e => setClassForm({...classForm, ageGroup: e.target.value})} />
                          <input required placeholder="קטגוריה" className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={classForm.category} onChange={e => setClassForm({...classForm, category: e.target.value})} />
                          <div className="md:col-span-2">
                             <input required placeholder="קישור לתמונה" className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={classForm.image} onChange={e => setClassForm({...classForm, image: e.target.value})} />
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
                 <h3 className="text-xl font-bold text-slate-800">ניהול הגרלות ({lotteries.length})</h3>
                 <button onClick={() => handleOpenLotteryModal()} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200">
                    <Plus size={18} /> <span className="hidden md:inline">הוספת הגרלה</span>
                 </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lotteries.map(lot => (
                      <div key={lot.id} className="flex gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                          <img src={lot.image} alt="" className="w-20 h-20 rounded-xl object-cover hidden sm:block" />
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
                          
                          {/* Action Buttons */}
                          <div className="flex flex-col justify-between items-end gap-2 pl-2">
                             <div className="flex gap-1">
                                <button title="התחל הגרלה בלייב" onClick={() => handleStartLiveDraw(lot.id)} className="p-2 text-white bg-gradient-to-r from-orange-400 to-rose-500 hover:scale-105 shadow-md shadow-rose-200 rounded-lg transition-all"><PlayCircle size={16} /></button>
                                <button onClick={() => handleOpenLotteryModal(lot)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg transition-colors"><Edit size={16} /></button>
                                <button onClick={() => onDeleteLottery && onDeleteLottery(lot.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                             </div>
                             <span className={`text-xs px-2 py-1 rounded-full ${lot.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{lot.isActive ? 'פעיל' : 'הסתיים'}</span>
                          </div>
                      </div>
                  ))}
              </div>

              {/* Lottery Modal */}
              <Modal isOpen={isLotteryModalOpen} onClose={() => setIsLotteryModalOpen(false)} title={editingLotteryId ? "עריכת הגרלה" : "הוספת הגרלה חדשה"}>
                  <form onSubmit={handleSaveLottery} className="space-y-4">
                      <div className="space-y-4">
                          {/* Basic Info */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">כותרת ההגרלה</label>
                                <input required className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={lotteryForm.title} onChange={e => setLotteryForm({...lotteryForm, title: e.target.value})} />
                             </div>
                             <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">הפרס</label>
                                <input required className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={lotteryForm.prize} onChange={e => setLotteryForm({...lotteryForm, prize: e.target.value})} />
                             </div>
                             <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">תאריך הגרלה</label>
                                <input required type="date" className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={lotteryForm.drawDate} onChange={e => setLotteryForm({...lotteryForm, drawDate: e.target.value})} />
                             </div>
                             <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">קישור לתמונה</label>
                                <input className="p-3 rounded-xl border border-slate-200 bg-slate-50 w-full" value={lotteryForm.image} onChange={e => setLotteryForm({...lotteryForm, image: e.target.value})} />
                             </div>
                          </div>

                          {/* Eligibility Section */}
                          <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 space-y-3">
                              <h4 className="font-bold text-orange-800 text-sm flex items-center gap-2"><Users size={16} /> הגדרות זכאות להשתתפות</h4>
                              
                              <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-600">מי זכאית להשתתף?</label>
                                  <select 
                                    className="w-full p-3 rounded-xl border border-orange-200 bg-white"
                                    value={lotteryForm.eligibilityType}
                                    onChange={(e) => setLotteryForm({...lotteryForm, eligibilityType: e.target.value as LotteryEligibilityType})}
                                  >
                                      <option value="all">כל המשתמשות הרשומות</option>
                                      <option value="points">לפי ניקוד מינימלי</option>
                                      <option value="level">לפי דרגת משתמשת</option>
                                      <option value="specific_user">משתמשת ספציפית (זכאות אישית)</option>
                                  </select>
                              </div>

                              {/* Conditional Inputs */}
                              {lotteryForm.eligibilityType === 'points' && (
                                  <div className="animate-fade-in space-y-1">
                                      <label className="text-xs font-bold text-slate-600">ניקוד מינימלי נדרש</label>
                                      <input type="number" className="w-full p-3 rounded-xl border border-orange-200" value={lotteryForm.minPointsToEnter} onChange={e => setLotteryForm({...lotteryForm, minPointsToEnter: Number(e.target.value)})} />
                                  </div>
                              )}
                              
                              <div className="flex items-center gap-2 mt-2">
                                  <input type="checkbox" checked={lotteryForm.isActive} onChange={e => setLotteryForm({...lotteryForm, isActive: e.target.checked})} className="w-5 h-5 accent-orange-500" />
                                  <span className="font-bold text-slate-700">הגרלה פעילה</span>
                              </div>
                          </div>
                      </div>

                      <button type="submit" className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 flex justify-center items-center gap-2">
                         <Gift size={18} /> {editingLotteryId ? 'עדכון הגרלה' : 'פרסום הגרלה'}
                      </button>
                  </form>
              </Modal>
           </div>
        )}

      </div>
    </div>
  );
};

export default AdminPage;