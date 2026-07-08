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
import ZodiacWheelPage from './pages/ZodiacWheelPage';
import ForumPage from './pages/ForumPage'; 
import CommunityPage from './pages/CommunityPage'; 
import InterviewPage from './pages/InterviewPage';
import PersonalityArchivePage from './pages/PersonalityArchivePage';
import ForgotPassword from './pages/ForgotPassword'; // ייבוא דף שכחתי סיסמה
import ResetPassword from './pages/ResetPassword'; // ייבוא דף איפוס סיסמה
import VerifyPage from './pages/VerifyPage'; // ייבוא דף אימות כרטיסים (חדש!)
import { GeminiAssistant } from './components/GeminiAssistant';
import { User, EventItem, ClassItem, LotteryItem, Review, PersonalityProfile, CommunicationPreference } from './types';
import { Loader2 } from 'lucide-react'; // X and AlertCircle removed as they are now in AuthModal
import { api } from './services/api';
import AuthModal from './components/AuthModal'; // ייבוא המודל החדש
import ErrorBoundary from './components/ErrorBoundary'; // ייבוא מגן השגיאות

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [lotteries, setLotteries] = useState<LotteryItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  
  // מצב חיפוש גלובלי עבור כל הטאבים
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');

  // Auth Modal State - נשלט כעת ע"י הקומפוננטה החיצונית
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

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
        
        // בדיקת טוקן מול השרת
        const token = localStorage.getItem('token');
        if (token) {
           try {
             const userData = await api.getMe();
             setUser(userData);
             localStorage.setItem('user', JSON.stringify(userData)); // סנכרון ללוקאל
           } catch (err) {
             localStorage.removeItem('token');
             localStorage.removeItem('user');
           }
        }
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // פונקציה המופעלת לאחר התחברות/הרשמה מוצלחת דרך המודל
  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setIsAuthModalOpen(false);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };
  
  const handleOpenAuth = () => {
    setIsAuthModalOpen(true);
  };

  const handleUpdateUser = async (updatedUser: User) => {
    try {
      const result = await api.updateUser(updatedUser);
      setUser(result);
      localStorage.setItem('user', JSON.stringify(result));
    } catch (err) {
      console.error('Failed to update user', err);
      setUser(updatedUser);
    }
  };

  // --- Actions ---

  const handleAddPoints = (pointsToAdd: number) => {
    if (user && user.isMemberApproved) {
      handleUpdateUser({ ...user, points: user.points + pointsToAdd });
      alert(`כל הכבוד! צברת ${pointsToAdd} נקודות חדשות.`);
    } else if (user && !user.isMemberApproved) {
      alert("רק חברות מאושרות במעגל הנשי יכולות לצבור נקודות.");
    } else {
      handleOpenAuth();
    }
  };

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

  // Admin Actions
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
  const deleteLottery = async (id: string) => {
      try {
          await api.deleteLottery(id);
          setLotteries(lotteries.filter(l => l.id !== id));
      } catch (e) { console.error(e); }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-rose-500"><Loader2 className="animate-spin" size={40} /></div>;
  }

  return (
    <HashRouter>
      <div className="min-h-screen text-slate-800 bg-slate-50 font-sans w-full overflow-x-hidden flex flex-col">
        <Layout 
            user={user} 
            onLogout={handleLogout} 
            onOpenLogin={handleOpenAuth}
            searchTerm={globalSearchTerm}
            setSearchTerm={setGlobalSearchTerm}
        >
          <Routes>
            <Route path="/" element={<HomePage user={user} onOpenLogin={handleOpenAuth} onUpdateUser={handleUpdateUser} />} />
            
            <Route 
              path="/events" 
              element={<EventsPage events={events} onToggleLike={toggleEventLike} user={user} onAddPoints={handleAddPoints} onRateEvent={handleRateEvent} searchTerm={globalSearchTerm} />} 
            />
            
            <Route path="/classes" element={<ClassesPage classes={classes} searchTerm={globalSearchTerm} />} />
            
            <Route 
              path="/lottery" 
              element={<LotteryPage lotteries={lotteries} user={user} onUpdateUser={handleUpdateUser} onUpdateLottery={(l) => setLotteries(lotteries.map(item => item.id === l.id ? l : item))} />} 
            />
            <Route path="/zodiac-wheel" element={<ZodiacWheelPage user={user} onOpenLogin={handleOpenAuth} />} />

            <Route path="/forum" element={<ForumPage user={user} searchTerm={globalSearchTerm} />} />
            <Route path="/community" element={<CommunityPage searchTerm={globalSearchTerm} />} />
            
            {/* נתיב לראיון אשת השבוע */}
            <Route path="/interview/:token" element={<InterviewPage />} />
            
            {/* נתיב לארכיון נשות השבוע */}
            <Route path="/personality-archive" element={<PersonalityArchivePage />} />

            {/* נתיבי שחזור ואיפוס סיסמה */}
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />

            {/* נתיב סריקת ואימות כרטיסים (חדש!) */}
            <Route path="/verify/:code" element={<VerifyPage user={user} />} />

            <Route path="/profile" element={user ? <ProfilePage user={user} events={events} onUpdateUser={handleUpdateUser} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
            <Route path="/contact" element={<ContactPage />} />
            
            <Route 
              path="/admin" 
              element={
                <AdminPage 
                  user={user} 
                  onLogin={(u) => {setUser(u); setIsAuthModalOpen(false);}}
                />
              } 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
        
        {user && !user.isAdmin && (
          <ErrorBoundary>
            <GeminiAssistant />
          </ErrorBoundary>
        )}

        {/* השימוש ברכיב AuthModal החדש במקום הקוד הישן */}
        <AuthModal 
          isOpen={isAuthModalOpen} 
          onClose={() => setIsAuthModalOpen(false)} 
          onLogin={handleLoginSuccess} 
        />
      </div>
    </HashRouter>
  );
};

export default App;
