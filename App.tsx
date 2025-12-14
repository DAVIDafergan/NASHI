import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import EventsPage from './pages/EventsPage';
import ClassesPage from './pages/ClassesPage';
import ProfilePage from './pages/ProfilePage';
import ContactPage from './pages/ContactPage';
import AdminPage from './pages/AdminPage';
import LotteryPage from './pages/LotteryPage';
import { GeminiAssistant } from './components/GeminiAssistant';
import { User, UserLevel, EventItem, ClassItem, LotteryItem, Review, PersonalityProfile, CommunicationPreference } from './types';
import { X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from './services/api';

const initialPersonality: PersonalityProfile = {
  id: '1',
  name: 'ד"ר יעל אברהמי',
  role: 'חוקרת מח ומנהלת מעבדה',
  image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Yael',
  isActive: true,
  questions: [
    { question: 'מה נותן לך השראה?', answer: 'הטבע, והיכולת של המוח האנושי להשתנות ולהתפתח בכל גיל.' },
    { question: 'איזה עצה היית נותנת לעצמך הצעירה?', answer: 'אל תפחדי לטעות. הטעויות הן השיעורים הכי טובים.' },
    { question: 'מהו המקום האהוב עלייך בעיר?', answer: 'גן הפסלים החדש, מקום של שקט ויצירה.' }
  ]
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [lotteries, setLotteries] = useState<LotteryItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [personality, setPersonality] = useState<PersonalityProfile>(initialPersonality);
  const [loading, setLoading] = useState(true);
  
  // Auth Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login Form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Register Form
  const [regData, setRegData] = useState({
        name: '', phone: '', email: '', address: '', 
        communicationPref: 'whatsapp' as CommunicationPreference, password: ''
  });

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
        try {
            const [fetchedEvents, fetchedClasses, fetchedLotteries] = await Promise.all([
                api.getEvents(),
                api.getClasses(),
                api.getLotteries()
            ]);
            setEvents(fetchedEvents);
            setClasses(fetchedClasses);
            setLotteries(fetchedLotteries);
            
            // Restore user from local storage if token exists
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                setUser(JSON.parse(storedUser));
            }
        } catch (error) {
            console.error("Failed to fetch data, server might be down", error);
            // Fallback for demo if server is not running
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoginError('');
    try {
        const { user: loggedInUser, token } = await api.login({ email: loginEmail, password: loginPassword });
        setUser(loggedInUser);
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(loggedInUser));
        setIsAuthModalOpen(false);
        setLoginEmail('');
        setLoginPassword('');
    } catch (err) {
        setLoginError('שם משתמש או סיסמה שגויים');
    }
  };

  const handleRegister = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!regData.name || !regData.email || !regData.password) {
        setLoginError('אנא מלאי את כל שדות החובה');
        return;
      }
      try {
        const { user: newUser, token } = await api.register(regData);
        setUser(newUser);
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(newUser));
        setIsAuthModalOpen(false);
      } catch (err) {
        setLoginError('שגיאה בהרשמה. נסי שוב מאוחר יותר.');
      }
  };

  const handleLogout = () => {
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
  };
  
  const handleOpenAuth = () => {
      setIsAuthModalOpen(true);
      setAuthMode('login');
      setLoginError('');
  };

  // --- Actions ---

  const handleUpdateUser = async (updatedUser: User) => {
      try {
          const result = await api.updateUser(updatedUser);
          setUser(result);
          localStorage.setItem('user', JSON.stringify(result));
      } catch (err) {
          console.error('Failed to update user', err);
          // Optimistic update fallback
          setUser(updatedUser);
      }
  };

  const handleAddPoints = (pointsToAdd: number) => {
    if (user) {
      handleUpdateUser({ ...user, points: user.points + pointsToAdd });
      alert(`כל הכבוד! צברת ${pointsToAdd} נקודות חדשות.`);
    }
  };

  // Events & Reviews
  const toggleEventLike = async (eventId: string) => {
    if (!user) { handleOpenAuth(); return; }
    const isLiked = user.likedEventIds?.includes(eventId);
    let newLikedIds = user.likedEventIds || [];
    if (isLiked) newLikedIds = newLikedIds.filter(id => id !== eventId);
    else newLikedIds = [...newLikedIds, eventId];
    
    handleUpdateUser({ ...user, likedEventIds: newLikedIds });
  };

  const handleRateEvent = async (eventId: string, rating: number, comment: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event || !user) return;
    
    const updatedEvent = { ...event, ratings: [...(event.ratings || []), rating] };
    try {
        await api.updateEvent(updatedEvent);
        setEvents(events.map(e => e.id === eventId ? updatedEvent : e));
    } catch (e) { console.error(e); }

    // Add Review (Locally for now, assume backend doesn't have review endpoint yet)
    const newReview: Review = {
        id: Date.now().toString(),
        eventId,
        eventTitle: event.title,
        userId: user.id,
        userName: user.name,
        rating,
        comment,
        date: new Date().toLocaleDateString('he-IL')
    };
    setReviews([newReview, ...reviews]);
  };

  // Admin Actions (Connected to API)
  const addEvent = async (newEvent: EventItem) => {
      try {
          const created = await api.createEvent(newEvent);
          setEvents([...events, created]);
      } catch (e) { console.error(e); }
  };
  const updateEvent = async (updatedEvent: EventItem) => {
      try {
          const result = await api.updateEvent(updatedEvent);
          setEvents(events.map(e => e.id === result.id ? result : e));
      } catch (e) { console.error(e); }
  };
  const deleteEvent = async (id: string) => {
      try {
          await api.deleteEvent(id);
          setEvents(events.filter(e => e.id !== id));
      } catch (e) { console.error(e); }
  };
  
  const addClass = async (newClass: ClassItem) => {
      try {
          const created = await api.createClass(newClass);
          setClasses([...classes, created]);
      } catch (e) { console.error(e); }
  };
  const updateClass = async (updatedClass: ClassItem) => {
      try {
          const result = await api.updateClass(updatedClass);
          setClasses(classes.map(c => c.id === result.id ? result : c));
      } catch (e) { console.error(e); }
  };
  const deleteClass = async (id: string) => {
       try {
          await api.deleteClass(id);
          setClasses(classes.filter(c => c.id !== id));
      } catch (e) { console.error(e); }
  };
  
  const addLottery = async (newLottery: LotteryItem) => {
      try {
          const created = await api.createLottery(newLottery);
          setLotteries([...lotteries, created]);
      } catch (e) { console.error(e); }
  };
  const updateLottery = async (updatedLottery: LotteryItem) => {
      try {
          const result = await api.updateLottery(updatedLottery);
          setLotteries(lotteries.map(l => l.id === result.id ? result : l));
      } catch (e) { console.error(e); }
  };
  const deleteLottery = async (id: string) => {
      try {
          await api.deleteLottery(id);
          setLotteries(lotteries.filter(l => l.id !== id));
      } catch (e) { console.error(e); }
  };

  const updatePersonality = (p: PersonalityProfile) => setPersonality(p);

  if (loading) {
      return <div className="min-h-screen flex items-center justify-center text-rose-500"><Loader2 className="animate-spin" size={40} /></div>;
  }

  return (
    <HashRouter>
      <div className="min-h-screen text-slate-800 bg-slate-50 font-sans w-full overflow-x-hidden flex flex-col">
        <Layout user={user} onLogout={handleLogout} onOpenLogin={handleOpenAuth}>
          <Routes>
            <Route path="/" element={<HomePage user={user} onOpenLogin={handleOpenAuth} events={events} personality={personality} lotteries={lotteries} />} />
            
            <Route 
              path="/events" 
              element={<EventsPage events={events} onToggleLike={toggleEventLike} user={user} onAddPoints={handleAddPoints} onRateEvent={handleRateEvent} />} 
            />
            <Route path="/classes" element={<ClassesPage classes={classes} />} />
            <Route 
              path="/lottery" 
              element={<LotteryPage lotteries={lotteries} user={user} onUpdateUser={handleUpdateUser} onUpdateLottery={updateLottery} />} 
            />

            <Route path="/profile" element={user ? <ProfilePage user={user} events={events} onUpdateUser={handleUpdateUser} /> : <Navigate to="/" replace />} />
            <Route path="/contact" element={<ContactPage />} />
            
            <Route 
              path="/admin" 
              element={
                <AdminPage 
                  user={user} onLogin={(u) => {setUser(u); setIsAuthModalOpen(false);}}
                  events={events} classes={classes} lotteries={lotteries} reviews={reviews} personality={personality}
                  onAddEvent={addEvent} onUpdateEvent={updateEvent} onDeleteEvent={deleteEvent}
                  onAddClass={addClass} onUpdateClass={updateClass} onDeleteClass={deleteClass}
                  onAddLottery={addLottery} onUpdateLottery={updateLottery} onDeleteLottery={deleteLottery}
                  onUpdatePersonality={updatePersonality}
                />
              } 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
        
        {user && !user.isAdmin && <GeminiAssistant />}

        {/* Global Auth Modal */}
        {isAuthModalOpen && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] w-full max-w-md shadow-2xl shadow-rose-200/50 animate-fade-in-up relative overflow-hidden border border-white">
                 <button onClick={() => setIsAuthModalOpen(false)} className="absolute top-4 left-4 p-2 bg-slate-50 rounded-full hover:bg-rose-50 hover:text-rose-500 transition-colors z-10"><X size={20} /></button>
                 
                 <div className="p-8">
                    <div className="text-center mb-6">
                       <h2 className="text-3xl font-black text-slate-800 mb-2">{authMode === 'login' ? 'ברוכה הבאה!' : 'הצטרפות לקהילה'}</h2>
                       <p className="text-slate-500 text-sm font-medium">המקום שלך לצמוח, להשפיע ולהנות.</p>
                    </div>

                    {loginError && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-2xl text-xs font-bold mb-4 flex items-center gap-2 border border-red-100">
                           <AlertCircle size={16} /> {loginError}
                        </div>
                    )}

                    {authMode === 'login' ? (
                       <form onSubmit={handleLogin} className="space-y-4">
                          <input type="text" placeholder="אימייל" className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-rose-200 outline-none text-sm font-medium" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                          <input type="password" placeholder="סיסמה" className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-rose-200 outline-none text-sm font-medium" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                          <button type="submit" className="w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white py-4 rounded-2xl font-bold hover:shadow-lg hover:shadow-rose-200 transition-all active:scale-95">כניסה</button>
                       </form>
                    ) : (
                       <form onSubmit={handleRegister} className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                             <input type="text" placeholder="שם מלא" className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none outline-none text-sm" value={regData.name} onChange={e => setRegData({...regData, name: e.target.value})} />
                             <input type="text" placeholder="טלפון" className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none outline-none text-sm" value={regData.phone} onChange={e => setRegData({...regData, phone: e.target.value})} />
                          </div>
                          <input type="email" placeholder="אימייל" className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none outline-none text-sm" value={regData.email} onChange={e => setRegData({...regData, email: e.target.value})} />
                          <input type="password" placeholder="סיסמה" className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none outline-none text-sm" value={regData.password} onChange={e => setRegData({...regData, password: e.target.value})} />
                          <select className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none outline-none text-sm text-slate-500" value={regData.communicationPref} onChange={e => setRegData({...regData, communicationPref: e.target.value as CommunicationPreference})}>
                             <option value="whatsapp">וואטסאפ</option><option value="email">אימייל</option><option value="sms">SMS</option>
                          </select>
                          <button type="submit" className="w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white py-4 rounded-2xl font-bold hover:shadow-lg hover:shadow-rose-200 transition-all mt-2 active:scale-95">הרשמה</button>
                       </form>
                    )}

                    <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                       <button onClick={() => {setAuthMode(authMode === 'login' ? 'register' : 'login'); setLoginError('');}} className="text-sm font-bold text-slate-400 hover:text-rose-500 transition-colors">
                          {authMode === 'login' ? 'אין לך חשבון? להרשמה' : 'יש לך חשבון? להתחברות'}
                       </button>
                    </div>
                 </div>
              </div>
           </div>
        )}
      </div>
    </HashRouter>
  );
};

export default App;