import React, { useState, useEffect } from 'react';
import { Gift, Calendar, Award, Star, Trophy, Users, CheckCircle, CheckCircle2, Ticket, Loader2, X, Sparkles, Share2, Info, Lock, ClipboardList, Camera, Send, Settings, Eye, Image as ImageIcon, ArrowLeft, Medal, Target, Plus, Trash2, Minus } from 'lucide-react';
import { LotteryItem, User } from '../types';
import { useLocation } from 'react-router-dom';
import { api } from '../services/api'; // ייבוא ה-API

interface LotteryPageProps {
    lotteries?: LotteryItem[];
    user?: User | null;
    onUpdateUser?: (u: User) => void;
    onUpdateLottery?: (l: LotteryItem) => void;
}

const LotteryPage: React.FC<LotteryPageProps> = ({ lotteries = [], user, onUpdateUser, onUpdateLottery }) => {
  const [selectedLottery, setSelectedLottery] = useState<LotteryItem | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showWinner, setShowWinner] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const location = useLocation();

  // --- מצבים חדשים עבור מערכת האתגרים (החליף את שולחן השבת) ---
  const [activeTab, setActiveTab] = useState<'regular' | 'challenges'>('regular');
  const [challenges, setChallenges] = useState<any[]>([]);
  const [challengeEntries, setChallengeEntries] = useState<any[]>([]);
  
  // תצוגת UX חדשה - אתגר פעיל בטאבים
  const [viewingChallengeId, setViewingChallengeId] = useState<string | null>(null);
  
  // מצבי טופס למשתמש
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState('');
  const [phone, setPhone] = useState('');
  const [entryImage, setEntryImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // מצבי טופס למנהל (ליצירת אתגר חדש - שודרג עם מערך פרסים ותמונה)
  const [newChallenge, setNewChallenge] = useState({
      title: '',
      prizes: [''], // שינינו מ-prize בודד למערך של פרסים
      notes: '',
      image: '', // תמונה לאתגר עצמו
      drawDate: ''
  });

  // Handle Admin triggering a live draw from AdminPage
  useEffect(() => {
      if (location.state && location.state.liveLotteryId) {
          const targetLottery = lotteries.find(l => (l.id === location.state.liveLotteryId || l._id === location.state.liveLotteryId));
          if (targetLottery) {
              handleOpenDraw(targetLottery);
          }
      }
      
      const params = new URLSearchParams(location.search);
      if (params.get('tab') === 'challenges' || params.get('tab') === 'shabbat') {
          setActiveTab('challenges');
      }

      const fetchChallengesData = async () => {
          try {
              const fetchedChallenges = await api.getChallenges();
              if (fetchedChallenges) {
                  setChallenges(fetchedChallenges);
                  if (fetchedChallenges.length > 0) setViewingChallengeId(fetchedChallenges[0]._id || fetchedChallenges[0].id);
              }
              
              const fetchedEntries = await api.getChallengeEntries();
              if (fetchedEntries) setChallengeEntries(fetchedEntries);
          } catch (e) { console.error("Failed to fetch challenges data", e); }
      };
      fetchChallengesData();
  }, [location.state, lotteries, location.search]);
  
  const handleEnterLottery = (lottery: any) => {
      if (!user) {
          alert('יש להתחבר למערכת כדי להשתתף בהגרלה!');
          return;
      }

      if (lottery.participants.includes(user.id || user._id)) {
          alert('את כבר רשומה להגרלה זו!');
          return;
      }

      if (lottery.participationType === 'points') {
          if (user.points < (lottery.minPointsToEnter || 0)) {
              alert(`אופס! להגרלה זו נדרשות לפחות ${lottery.minPointsToEnter} נקודות. חסרות לך ${(lottery.minPointsToEnter || 0) - user.points} נקודות.`);
              return;
          }
      }

      if (lottery.participationType === 'link_only') {
          alert('השתתפות בהגרלה זו היא באמצעות לינק אישי שנשלח אליך בלבד.');
          return;
      }
      
      if (onUpdateUser && onUpdateLottery) {
          const newPoints = lottery.participationType === 'points' ? user.points : user.points; 

          onUpdateUser({
              ...user,
              points: newPoints
          });

          const updatedLottery = {
              ...lottery,
              participants: lottery.participationType === 'mission' ? lottery.participants : [...lottery.participants, (user.id || user._id)],
              missionStarted: lottery.participationType === 'mission' ? [...(lottery.missionStarted || []), (user.id || user._id)] : (lottery.missionStarted || [])
          };

          onUpdateLottery(updatedLottery);
          
          if(lottery.participationType === 'mission') {
              alert('🎯 המשימה התחילה! בצעי אותה ולחצי על כפתור "סיימתי" כדי להיכנס להגרלה.');
          } else {
              alert('🎉 נרשמת בהצלחה להגרלה! הודעה תישלח אליך במידה ותזכי.');
          }
      }
  };

  const handleCompleteMission = async (lottery: any) => {
      try {
          if (onUpdateLottery) {
              const res = await api.completeLotteryMission(lottery._id || lottery.id);
              if(res) {
                onUpdateLottery({
                    ...lottery,
                    participants: [...lottery.participants, (user?.id || user?._id)]
                });
                alert('כל הכבוד! נכנסת רשמית להגרלה. בהצלחה! 🏆');
              }
          }
      } catch (err) {
          alert('שגיאה בעדכון המשימה');
      }
  };

  const handleOpenDraw = (lottery: LotteryItem) => {
      setSelectedLottery(lottery);
      setShowWinner(!!lottery.winnerId);
      setCountdown(3);
  };

  const handleShare = (lottery: LotteryItem) => {
      const shareData = {
          title: `הגרלת ${lottery.title} ב'נשי'`,
          text: `בואי להשתתף בהגרלה על ${lottery.prize} באפליקציית נשי!`,
          url: window.location.href
      };
      
      if (navigator.share) {
          navigator.share(shareData).catch(console.error);
      } else {
          navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
          alert('הקישור הועתק ללוח!');
      }
  };

  // --- פונקציות ניהול והשתתפות באתגרים ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, isChallengeAdminImage = false) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              if (isChallengeAdminImage) {
                  setNewChallenge({...newChallenge, image: reader.result as string});
              } else {
                  setEntryImage(reader.result as string);
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const handleChallengeSubmit = async () => {
      if (!user) return alert('נא להתחבר למערכת');
      if (!selectedChallengeId) return alert('נא לבחור אתגר');
      if (!familyName || !entryImage || !phone) return alert('נא למלא את כל הפרטים כולל טלפון ותמונה');
      
      setIsSubmitting(true);
      try {
          await api.enterChallenge({ challengeId: selectedChallengeId, familyName, image: entryImage, phone });
          alert('איזה יופי! התמונה הועלתה ונכנסת לאתגר בהצלחה! 🎯');
          setEntryImage(null);
          setFamilyName('');
          setPhone('');
          setSelectedChallengeId(null);
          
          const entries = await api.getChallengeEntries();
          if (entries) setChallengeEntries(entries);
      } catch (err: any) {
          alert(err.message || 'שגיאה בשליחת התמונה');
      } finally {
          setIsSubmitting(false);
      }
  };

  // פונקציות לניהול מערך הפרסים
  const handlePrizeChange = (index: number, value: string) => {
      const updatedPrizes = [...newChallenge.prizes];
      updatedPrizes[index] = value;
      setNewChallenge({...newChallenge, prizes: updatedPrizes});
  };
  const addPrizeField = () => setNewChallenge({...newChallenge, prizes: [...newChallenge.prizes, '']});
  const removePrizeField = (index: number) => {
      if (newChallenge.prizes.length === 1) return;
      const updatedPrizes = newChallenge.prizes.filter((_, i) => i !== index);
      setNewChallenge({...newChallenge, prizes: updatedPrizes});
  };

  const handleAdminCreateChallenge = async () => {
      if (!newChallenge.title || newChallenge.prizes[0] === '') return alert('חובה להזין כותרת ופרס אחד לפחות לאתגר');
      try {
          await api.createChallenge(newChallenge);
          alert('האתגר נוצר בהצלחה!');
          setNewChallenge({ title: '', prizes: [''], notes: '', image: '', drawDate: '' });
          
          const fetchedChallenges = await api.getChallenges();
          if (fetchedChallenges) {
              setChallenges(fetchedChallenges);
              if (!viewingChallengeId && fetchedChallenges.length > 0) setViewingChallengeId(fetchedChallenges[0]._id || fetchedChallenges[0].id);
          }
      } catch (e) { alert('שגיאה ביצירת האתגר'); }
  };

  const handleAdminDeleteChallenge = async (challengeId: string) => {
      if (!window.confirm('האם את בטוחה שברצונך למחוק אתגר זה ואת כל התמונות המשויכות אליו?')) return;
      try {
          await api.deleteChallenge(challengeId);
          alert('האתגר נמחק בהצלחה');
          const fetchedChallenges = await api.getChallenges();
          if (fetchedChallenges) {
              setChallenges(fetchedChallenges);
              if (viewingChallengeId === challengeId) {
                  setViewingChallengeId(fetchedChallenges.length > 0 ? (fetchedChallenges[0]._id || fetchedChallenges[0].id) : null);
              }
          }
          const fetchedEntries = await api.getChallengeEntries();
          if (fetchedEntries) setChallengeEntries(fetchedEntries);
      } catch (e) { alert('שגיאה במחיקת האתגר'); }
  };

  const handleAdminRunChallenge = async (challengeId: string) => {
      if (!window.confirm('האם להפעיל את ההגרלה ולבחור זוכה לאתגר זה עכשיו?')) return;
      try {
          const res = await api.runChallengeLottery(challengeId);
          alert(`יש לנו זוכה! מזל טוב למשפחת ${res.winnerFamily}`);
          const fetchedChallenges = await api.getChallenges();
          if (fetchedChallenges) setChallenges(fetchedChallenges);
      } catch (e: any) { alert(e.response?.data?.error || 'שגיאה בהפעלת ההגרלה לאתגר'); }
  };

  const simulateDraw = () => {
      if (!selectedLottery || !onUpdateLottery) return;
      setIsDrawing(true);
      setShowWinner(false);

      let count = 3;
      setCountdown(3);
      const interval = setInterval(() => {
          count--;
          setCountdown(count);
          if (count === 0) {
              clearInterval(interval);
          }
      }, 1000);

      setTimeout(() => {
          setIsDrawing(false);
          setShowWinner(true);
          
          const winnerId = selectedLottery.participants.length > 0 
                ? selectedLottery.participants[Math.floor(Math.random() * selectedLottery.participants.length)]
                : 'No Participants';
          
          onUpdateLottery({
              ...selectedLottery,
              isActive: false,
              winnerId: winnerId
          });

      }, 3500); 
  };

  const filteredLotteries = lotteries.filter(l => !l.title.includes("שולחן השבת") && !l.title.includes("שולחן שבת"));

  const renderPrizeList = (lottery: any, isDark: boolean = false) => {
    const allPrizes = [
        lottery.prize,
        lottery.prize2,
        lottery.prize3,
        lottery.prize4,
        lottery.prize5,
        lottery.prize6,
        lottery.prize7
    ].filter(Boolean);

    const finalPrizes = (lottery.prizes && lottery.prizes.length > 0) ? lottery.prizes : allPrizes;

    return (
        <div className="space-y-2">
            {finalPrizes.map((p: string, idx: number) => (
                <div key={idx} className={`flex items-center gap-2 p-2 rounded-xl transition-all ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white/60 border border-rose-100/50 shadow-sm'}`}>
                    <div className={`${idx === 0 ? 'text-amber-500' : 'text-slate-400'} shrink-0`}>
                        {idx === 0 ? <Trophy size={16} /> : <Medal size={14} />}
                    </div>
                    <span className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-700'}`}>
                        {idx === 0 ? 'פרס ראשון: ' : `פרס ${idx + 1}: `}
                        <span className={idx === 0 ? 'text-rose-500' : ''}>{p}</span>
                    </span>
                </div>
            ))}
        </div>
    );
  };

  // פונקציית עזר לרינדור פרסים באתגרים
  const renderChallengePrizes = (prizes: string[]) => {
      if (!prizes || prizes.length === 0) return null;
      return (
          <div className="flex flex-col gap-2 mt-3 w-full md:w-auto">
              {prizes.map((p, idx) => (
                  <div key={idx} className="inline-flex items-center gap-2 text-indigo-900 font-bold bg-white/90 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-lg border border-white/50 w-fit">
                      {idx === 0 ? <Trophy size={16} className="text-yellow-500" /> : <Medal size={14} className="text-slate-400" />}
                      <span className="text-sm">
                          {idx === 0 ? 'פרס ראשון:' : `פרס ${idx + 1}:`} {p}
                      </span>
                  </div>
              ))}
          </div>
      );
  };

  return (
    <div className="min-h-screen space-y-8 pb-10 text-right" dir="rtl">
      {/* Header Section */}
      <div className="text-center space-y-3 py-10 relative overflow-hidden rounded-[3rem] bg-white border border-rose-100 shadow-sm">
        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <Sparkles className="text-rose-400 mx-auto mb-2" size={32} />
        <h2 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tight">הגרלות והטבות בלעדיות</h2>
        <p className="text-slate-500 max-w-xl mx-auto text-sm md:text-base font-medium px-4">השתמשי בנקודות שצברת כדי להיכנס למעגל ההגרלות שלנו. כל שיתוף, הרשמה או פעילות מקרבים אותך לפרסים מדהימים!</p>
        
        {user ? (
            <div className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 px-6 py-3 rounded-2xl font-black mt-6 border border-amber-100 shadow-sm animate-fade-in">
                <Star size={20} className="fill-amber-400 text-amber-400" />
                יתרת הנקודות שלך: {user.points}
            </div>
        ) : (
            <div onClick={() => window.location.hash = '/login'} className="inline-flex items-center gap-2 bg-slate-100 text-slate-500 px-6 py-3 rounded-2xl font-bold mt-6 cursor-pointer hover:bg-slate-200 transition-colors">
                <Lock size={16} /> התחברי כדי לראות את הנקודות שלך
            </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center p-1.5 bg-slate-100 w-fit mx-auto rounded-[2rem] gap-1 shadow-inner">
          <button 
            onClick={() => setActiveTab('regular')}
            className={`px-8 py-3 rounded-full font-black text-sm transition-all ${activeTab === 'regular' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            הגרלות כלליות
          </button>
          <button 
            onClick={() => setActiveTab('challenges')}
            className={`px-8 py-3 rounded-full font-black text-sm transition-all flex items-center gap-2 ${activeTab === 'challenges' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            אתגרי החוסן 💪
          </button>
      </div>

      {activeTab === 'regular' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 px-2 animate-fade-in">
            {filteredLotteries.map((lottery: any) => {
                const isRegistered = user && lottery.participants.includes(user.id || user._id);
                const isMissionStarted = user && lottery.missionStarted?.includes(user.id || user._id);
                const canParticipate = lottery.participationType === 'everyone' || (user && user.points >= (lottery.minPointsToEnter || 0)) || lottery.participationType === 'mission';
                
                return (
                    <div key={lottery.id || lottery._id} className={`bg-white rounded-[2.5rem] p-3 shadow-sm border border-slate-100 hover:shadow-2xl transition-all duration-500 flex flex-col group relative overflow-hidden ${!lottery.isActive ? 'opacity-80' : ''}`}>
                        <div className="h-56 relative overflow-hidden rounded-[2rem] mb-5 shrink-0 shadow-inner bg-slate-50">
                            <img src={lottery.image} alt={lottery.title} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                            <div className="absolute top-4 right-4 flex flex-col gap-2">
                                <div className="bg-white/95 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black text-rose-600 flex items-center gap-1.5 shadow-xl border border-rose-50">
                                    {lottery.participationType === 'mission' ? (
                                        <>
                                            <ClipboardList size={12} className="text-orange-500" />
                                            <span className="text-orange-600">הגרלת משימה</span>
                                        </>
                                    ) : (
                                        <>
                                            <Star size={12} className="fill-rose-500 text-rose-500" />
                                            {lottery.participationType === 'everyone' ? 'פתוח לכולן' : `${lottery.minPointsToEnter} נקודות`}
                                        </>
                                    )}
                                </div>
                                {!lottery.isActive && (
                                    <div className="bg-slate-900/90 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black text-white flex items-center gap-1.5 shadow-xl">
                                        <CheckCircle size={12} /> הגרלה הסתיימה
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={(e) => { e.stopPropagation(); handleShare(lottery); }}
                                className="absolute bottom-4 left-4 bg-white/20 backdrop-blur-xl p-3 rounded-2xl text-white hover:bg-white hover:text-rose-500 transition-all shadow-lg border border-white/20"
                            >
                                <Share2 size={18} />
                            </button>
                        </div>
                        
                        <div className="px-4 pb-4 flex-1 flex flex-col text-right">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-black text-slate-800 leading-tight group-hover:text-rose-600 transition-colors">{lottery.title}</h3>
                                {lottery.isActive && <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>}
                            </div>

                            <div className="space-y-3 mb-6 bg-rose-50/30 p-4 rounded-[2rem] border border-rose-100/50">
                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider mb-2">פירוט הפרסים:</p>
                                {renderPrizeList(lottery)}
                                
                                {lottery.participationType === 'mission' && lottery.missionText && (
                                    <div className="mt-3 pt-3 border-t border-rose-100/50">
                                        <p className="text-[10px] font-black text-orange-600 uppercase mb-1">המשימה שלך:</p>
                                        <p className="text-xs font-bold text-slate-600 leading-relaxed">{lottery.missionText}</p>
                                    </div>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="flex flex-col items-center justify-center gap-1 text-[10px] text-slate-500 bg-slate-50 p-3 rounded-2xl border border-slate-100/50">
                                    <Calendar size={16} className="text-rose-300" />
                                    <span className="font-black text-slate-700">{new Date(lottery.drawDate).toLocaleDateString('he-IL')}</span>
                                </div>
                                <div className="flex flex-col items-center justify-center gap-1 text-[10px] text-slate-500 bg-slate-50 p-3 rounded-2xl border border-slate-100/50">
                                    <Users size={16} className="text-rose-300" />
                                    <span className="font-black text-slate-700">{lottery.participants.length} משתתפות</span>
                                </div>
                            </div>

                            <div className="mt-auto">
                                {user?.isAdmin ? (
                                    <button 
                                        onClick={() => handleOpenDraw(lottery)}
                                        className="w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 bg-slate-900 text-white shadow-xl hover:bg-rose-600 active:scale-95"
                                    >
                                        <Sparkles size={18} className="text-yellow-400" />
                                        {lottery.winnerId ? 'צפייה בתוצאות' : 'ניהול הגרלה (Live)'}
                                    </button>
                                ) : (!lottery.isActive || lottery.winnerId) ? (
                                    <button 
                                        onClick={() => handleOpenDraw(lottery)}
                                        className="w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-100"
                                    >
                                        <Trophy size={18} />
                                        צפייה בזוכה המאושרת
                                    </button>
                                ) : isRegistered ? (
                                    <div className="w-full py-4 rounded-2xl font-black text-sm bg-emerald-50 text-emerald-600 flex items-center justify-center gap-2 border border-emerald-100">
                                        <CheckCircle2 size={18} />
                                        את בפנים! בהצלחה
                                    </div>
                                ) : (lottery.participationType === 'mission' && isMissionStarted) ? (
                                    <button 
                                        onClick={() => handleCompleteMission(lottery)}
                                        className="w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white animate-pulse"
                                    >
                                        <CheckCircle size={18} />
                                        סיימתי את המשימה!
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleEnterLottery(lottery)}
                                        className={`w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95 ${
                                            canParticipate 
                                            ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:shadow-rose-200' 
                                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        }`}
                                    >
                                        <Ticket size={18} />
                                        {lottery.participationType === 'mission' ? 'התחילי משימה להגרלה' : canParticipate ? 'הירשמי להגרלה עכשיו' : `חסרות לך נקודות`}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      ) : (
        /* --- ממשק אתגרים חדש --- */
        <div className="max-w-6xl mx-auto px-2 animate-scale-in space-y-8">
            
            {/* ניהול למנהלת (הוספת אתגר) */}
            {user?.isAdmin && (
                <div className="bg-white p-8 rounded-[3rem] border border-indigo-100 shadow-xl relative overflow-hidden mb-8">
                    <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500"></div>
                    <div className="flex items-center gap-2 mb-6 text-indigo-700">
                        <Settings size={24} />
                        <h4 className="text-2xl font-black">ניהול חוסן - יצירת אתגר חדש</h4>
                    </div>
                    
                    <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 items-start">
                        <div className="space-y-2 lg:col-span-1">
                            <label className="text-xs font-black text-slate-400 mr-2">כותרת האתגר</label>
                            <input 
                                type="text" 
                                value={newChallenge.title} 
                                onChange={(e) => setNewChallenge({...newChallenge, title: e.target.value})}
                                className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none shadow-inner" 
                                placeholder="שם האתגר..."
                            />
                        </div>
                        
                        {/* ריבוי פרסים */}
                        <div className="space-y-2 lg:col-span-2">
                            <label className="text-xs font-black text-slate-400 mr-2">רשימת פרסים לזוכים</label>
                            <div className="space-y-2">
                                {newChallenge.prizes.map((prize, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={prize} 
                                            onChange={(e) => handlePrizeChange(idx, e.target.value)}
                                            className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none shadow-inner" 
                                            placeholder={`פרס ${idx + 1}`}
                                        />
                                        <button onClick={() => removePrizeField(idx)} className="bg-red-50 text-red-500 p-4 rounded-2xl hover:bg-red-100 transition-colors shrink-0">
                                            <Minus size={20} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={addPrizeField} className="text-xs font-black text-indigo-600 flex items-center gap-1 mt-2 hover:underline">
                                <Plus size={14} /> הוספי פרס נוסף
                            </button>
                        </div>

                        <div className="space-y-2 lg:col-span-1">
                            <label className="text-xs font-black text-slate-400 mr-2">הסבר / משימה</label>
                            <textarea 
                                value={newChallenge.notes} 
                                onChange={(e) => setNewChallenge({...newChallenge, notes: e.target.value})}
                                className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none shadow-inner h-[60px] resize-none" 
                                placeholder="הנחיות למשתתפות..."
                            />
                        </div>

                        {/* תמונה לאתגר */}
                        <div className="space-y-2 lg:col-span-1 flex flex-col h-full justify-between">
                            <div 
                                onClick={() => document.getElementById('admin-challenge-image')?.click()}
                                className={`h-[60px] rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 cursor-pointer transition-all overflow-hidden relative ${newChallenge.image ? 'border-indigo-500' : 'border-slate-200 hover:border-indigo-300'}`}
                            >
                                {newChallenge.image ? (
                                    <img src={newChallenge.image} className="w-full h-full object-cover" alt="Preview" />
                                ) : (
                                    <>
                                        <ImageIcon size={20} className="text-slate-400" />
                                        <span className="text-xs font-bold text-slate-500">תמונת נושא</span>
                                    </>
                                )}
                                <input id="admin-challenge-image" type="file" accept="image/*" className="hidden" onChange={(e) => handleImageChange(e, true)} />
                            </div>

                            <button 
                                onClick={handleAdminCreateChallenge}
                                className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-black hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 mt-2 h-[60px]"
                            >
                                <Plus size={20} /> צרי
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* חווית משתמש משופרת: תפריט אתגרים אופקי לנייד ולדסקטופ */}
            {challenges.length === 0 ? (
                <div className="text-center py-20 bg-slate-50/50 rounded-[3rem] border border-dashed border-slate-200">
                    <Target size={48} className="text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold text-lg">אין כרגע אתגרי חוסן פעילים. חזרי לבדוק בקרוב!</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Ribbon - בחירת אתגר */}
                    <div className="flex overflow-x-auto gap-4 pb-4 snap-x hide-scrollbar scroll-smooth">
                        {challenges.map((challenge) => {
                            const isSelected = viewingChallengeId === (challenge._id || challenge.id);
                            return (
                                <button 
                                    key={challenge._id || challenge.id}
                                    onClick={() => setViewingChallengeId(challenge._id || challenge.id)}
                                    className={`snap-center shrink-0 px-6 py-4 rounded-3xl font-black text-sm whitespace-nowrap transition-all border shadow-sm flex items-center gap-2 ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 scale-105' : 'bg-white text-slate-600 border-slate-100 hover:bg-slate-50'}`}
                                >
                                    <Target size={18} className={isSelected ? 'text-indigo-200' : 'text-slate-400'} />
                                    {challenge.title}
                                    {challenge.isActive === false && <Lock size={14} className="mr-1 opacity-50" />}
                                </button>
                            );
                        })}
                    </div>

                    {/* תצוגת האתגר הנבחר */}
                    {challenges.map((challenge) => {
                        if (viewingChallengeId !== (challenge._id || challenge.id)) return null;
                        
                        const currentEntries = challengeEntries.filter(e => e.challengeId === (challenge._id || challenge.id));
                        const challengePrizes = challenge.prizes || (challenge.prize ? [challenge.prize] : []);
                        
                        return (
                            <div key={challenge._id || challenge.id} className="bg-white rounded-[3.5rem] overflow-hidden border border-slate-100 shadow-2xl relative animate-fade-in">
                                {/* Header של האתגר (עם רקע תמונה במידה והמנהלת העלתה) */}
                                <div className={`p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 min-h-[250px]`}>
                                    {challenge.image ? (
                                        <>
                                            <div className="absolute inset-0 bg-black/50 z-0"></div>
                                            <img src={challenge.image} alt={challenge.title} className="absolute inset-0 w-full h-full object-cover z-[1]" />
                                        </>
                                    ) : (
                                        <div className={`absolute inset-0 ${challenge.isActive !== false ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800' : 'bg-slate-800'}`}>
                                            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                                        </div>
                                    )}
                                    
                                    <div className="relative z-10 text-center md:text-right space-y-3 text-white flex-1 w-full">
                                        <h3 className="text-4xl md:text-5xl font-black drop-shadow-md">{challenge.title}</h3>
                                        {challenge.notes && <p className="text-indigo-100 font-bold text-lg max-w-2xl drop-shadow-md bg-black/20 p-4 rounded-2xl backdrop-blur-sm border border-white/10">{challenge.notes}</p>}
                                        
                                        {/* רינדור הפרסים */}
                                        {renderChallengePrizes(challengePrizes)}
                                    </div>
                                    
                                    <div className="relative z-10 flex flex-col gap-3 min-w-[250px] w-full md:w-auto">
                                        {challenge.winnerFamily ? (
                                            <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-amber-950 px-6 py-6 rounded-[2rem] font-black text-center shadow-xl border border-yellow-300 animate-bounce">
                                                <Trophy size={28} className="mx-auto mb-2 opacity-80" />
                                                <span className="block text-sm opacity-70 mb-1">הזוכה המאושרת:</span>
                                                <span className="text-xl">משפחת {challenge.winnerFamily}</span>
                                            </div>
                                        ) : challenge.isActive !== false ? (
                                            <button 
                                                onClick={() => setSelectedChallengeId(selectedChallengeId === (challenge._id || challenge.id) ? null : (challenge._id || challenge.id))}
                                                className={`w-full px-8 py-5 rounded-3xl font-black shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 text-lg ${selectedChallengeId === (challenge._id || challenge.id) ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-indigo-600 hover:scale-105'}`}
                                            >
                                                {selectedChallengeId === (challenge._id || challenge.id) ? 'סגירת טופס השתתפות' : 'השתתפי באתגר עכשיו!'} 
                                                <Target size={24} className={selectedChallengeId === (challenge._id || challenge.id) ? 'text-slate-400' : 'text-indigo-400'} />
                                            </button>
                                        ) : (
                                            <div className="bg-black/40 text-white px-6 py-5 rounded-3xl font-black text-center backdrop-blur-md border border-white/20">
                                                <Lock className="mx-auto mb-2 opacity-50" size={24}/>
                                                האתגר הסתיים
                                            </div>
                                        )}

                                        {user?.isAdmin && (
                                            <div className="flex gap-2 mt-2">
                                                <button onClick={() => handleAdminRunChallenge(challenge._id || challenge.id)} className="flex-1 bg-emerald-500 text-white py-3 rounded-2xl text-sm font-black hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 shadow-lg">
                                                    <Eye size={16}/> הגרלי זוכה
                                                </button>
                                                <button onClick={() => handleAdminDeleteChallenge(challenge._id || challenge.id)} className="flex-1 bg-red-500 text-white py-3 rounded-2xl text-sm font-black hover:bg-red-600 transition-colors flex items-center justify-center gap-2 shadow-lg">
                                                    <Trash2 size={16}/> מחיקה
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* אזור טופס העלאה (נפתח רק אם המשתמשת לחצה על "השתתפי באתגר") */}
                                {selectedChallengeId === (challenge._id || challenge.id) && (
                                    <div className="p-8 md:p-12 bg-gradient-to-b from-indigo-50/50 to-white border-b border-indigo-100 animate-fade-in">
                                        {!user ? (
                                            <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-indigo-200 shadow-sm">
                                                <Lock size={40} className="text-indigo-300 mx-auto mb-4" />
                                                <h4 className="text-xl font-black text-slate-800">התחברי כדי להשתתף</h4>
                                                <button onClick={() => window.location.hash = '/login'} className="mt-6 bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all">התחברי למערכת</button>
                                            </div>
                                        ) : (
                                            <div className="grid md:grid-cols-2 gap-10 max-w-4xl mx-auto bg-white p-8 rounded-[2.5rem] shadow-[0_10px_40px_rgba(79,70,229,0.08)] border border-indigo-50">
                                                <div className="space-y-6">
                                                    <div className="space-y-3">
                                                        <label className="text-sm font-black text-slate-600 mr-2">שם משפחה (יוצג באתר)</label>
                                                        <input 
                                                            type="text" 
                                                            value={familyName}
                                                            onChange={(e) => setFamilyName(e.target.value)}
                                                            placeholder="למשל: משפחת לוי"
                                                            className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-lg"
                                                        />
                                                    </div>

                                                    <div className="space-y-3">
                                                        <label className="text-sm font-black text-slate-600 mr-2">מספר טלפון (חסוי, להנהלה בלבד)</label>
                                                        <input 
                                                            type="tel" 
                                                            value={phone}
                                                            onChange={(e) => setPhone(e.target.value)}
                                                            placeholder="למשל: 050-1234567"
                                                            className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-lg"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-6 flex flex-col justify-end">
                                                    <div className="space-y-3 flex-1">
                                                        <label className="text-sm font-black text-slate-600 mr-2">העלי תמונה לאתגר 📸</label>
                                                        <div 
                                                            onClick={() => document.getElementById('challenge-input')?.click()}
                                                            className={`group relative h-36 rounded-3xl border-4 border-dashed transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center gap-3 bg-slate-50 ${entryImage ? 'border-indigo-500' : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50'}`}
                                                        >
                                                            {entryImage ? (
                                                                <div className="w-full h-full relative">
                                                                    <img src={entryImage} className="w-full h-full object-cover" alt="Preview" />
                                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                                                        <Camera className="text-white" size={32} />
                                                                        <span className="text-white font-bold ml-2">החלפת תמונה</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="w-14 h-14 bg-white shadow-sm rounded-2xl flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                                                                        <Camera size={28} />
                                                                    </div>
                                                                    <p className="font-black text-slate-500 group-hover:text-indigo-600 text-sm">לחצי להעלאת תמונה</p>
                                                                </>
                                                            )}
                                                            <input id="challenge-input" type="file" accept="image/*" className="hidden" onChange={(e) => handleImageChange(e, false)} />
                                                        </div>
                                                    </div>

                                                    <button 
                                                        onClick={handleChallengeSubmit}
                                                        disabled={isSubmitting}
                                                        className="w-full py-5 rounded-2xl bg-indigo-600 text-white font-black text-xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:shadow-2xl hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-50 disabled:hover:transform-none flex items-center justify-center gap-3"
                                                    >
                                                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Send size={22} />}
                                                        שלחי והיכנסי לאתגר!
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* גלריית התמונות של האתגר הנבחר */}
                                <div className="p-8 md:p-12">
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500">
                                            <ImageIcon size={24} />
                                        </div>
                                        <div>
                                            <h4 className="text-2xl font-black text-slate-800">העלאות של המשתתפות</h4>
                                            <p className="text-slate-400 font-bold text-sm">{currentEntries.length} משתתפות נכנסו לאתגר</p>
                                        </div>
                                    </div>

                                    {currentEntries.length > 0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                                            {currentEntries.map((entry, idx) => (
                                                <div key={idx} className="group relative bg-slate-100 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-shadow border border-slate-100 aspect-[4/5]">
                                                    <img src={entry.image} alt={entry.familyName} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent opacity-90 transition-opacity flex flex-col justify-end p-5">
                                                        <p className="text-white font-black text-base drop-shadow-md">
                                                            {/* תיקון באג ה-"משפחת משפחת" - אם כבר כתבה משפחת לא נוסיף */}
                                                            {entry.familyName.startsWith('משפחת') ? entry.familyName : `משפחת ${entry.familyName}`}
                                                        </p>
                                                        {user?.isAdmin && (
                                                            <p className="text-indigo-300 text-xs font-bold mt-1 dir-ltr text-left drop-shadow-sm">{entry.phone}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-16 bg-slate-50/50 rounded-[2.5rem] border border-dashed border-slate-200">
                                            <p className="text-slate-400 font-bold text-lg">עדיין אין העלאות לאתגר זה. תהיי הראשונה!</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
      )}

      {/* --- מודל ההגרלות הלייב (לא לגעת) --- */}
      {selectedLottery && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl animate-fade-in">
              <div className="w-full max-w-xl relative">
                  <button onClick={() => setSelectedLottery(null)} className="absolute -top-16 right-0 md:-right-16 p-3 bg-white/10 rounded-full hover:bg-white/20 text-white transition-all"><X size={24} /></button>
                  
                  <div className="bg-gradient-to-b from-indigo-950 via-purple-900 to-slate-950 rounded-[3.5rem] overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(139,92,246,0.3)] relative">
                      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 animate-pulse"></div>
                      <div className="absolute -top-24 -left-24 w-64 h-64 bg-rose-500/20 rounded-full blur-[80px]"></div>
                      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px]"></div>
                      
                      <div className="p-10 md:p-14 text-center relative z-10 min-h-[500px] flex flex-col items-center justify-center">
                          <div className="mb-10">
                              <span className="text-rose-400 text-[10px] font-black tracking-[0.3em] uppercase mb-3 block">Live Drawing Event</span>
                              <h3 className="text-3xl md:text-4xl font-black text-white leading-tight tracking-tight">{selectedLottery.title}</h3>
                          </div>

                          {!showWinner && !isDrawing && !selectedLottery.winnerId && (
                              <div className="space-y-10 w-full animate-fade-in">
                                  <div className="w-32 h-32 bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto border border-white/10 shadow-inner">
                                    <Gift size={60} className="text-rose-400/50" />
                                  </div>
                                  {user?.isAdmin ? (
                                      <div className="space-y-6">
                                          <p className="text-purple-200 font-bold text-lg">כל המשתתפות בפנים. מוכנה להפעיל?</p>
                                          <button onClick={simulateDraw} className="w-full bg-gradient-to-r from-yellow-400 via-orange-500 to-rose-500 text-white px-8 py-6 rounded-3xl font-black text-2xl shadow-[0_15px_30px_rgba(245,158,11,0.4)] hover:scale-105 transition-all active:scale-95 border-t border-white/20">
                                              הפעלת רולטת המזל
                                          </button>
                                      </div>
                                  ) : (
                                      <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                                          <Loader2 size={32} className="text-rose-400 animate-spin mx-auto mb-4" />
                                          <p className="text-white/80 font-bold">המנהלת טרם הפעילה את ההגרלה...</p>
                                          <p className="text-white/40 text-xs mt-2">ברגע שהרולטה תופעל, התוצאה תופיע כאן בלייב!</p>
                                      </div>
                                  )}
                              </div>
                          )}

                          {isDrawing && (
                              <div className="space-y-10 animate-fade-in">
                                  <div className="relative">
                                      <div className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-rose-300 to-purple-500 animate-pulse">
                                          {countdown}
                                      </div>
                                      <div className="absolute inset-0 bg-white/20 blur-3xl rounded-full animate-ping"></div>
                                  </div>
                                  <div className="flex flex-col items-center gap-3">
                                      <p className="text-rose-200 font-black text-xl tracking-widest animate-bounce">מערבבים את השמות...</p>
                                      <div className="flex gap-1">
                                          {[1,2,3,4,5].map(i => <div key={i} className="w-2 h-2 bg-rose-500 rounded-full animate-bounce" style={{animationDelay: `${i*0.1}s`}}></div>)}
                                      </div>
                                  </div>
                              </div>
                          )}

                          {(showWinner || selectedLottery.winnerId) && (
                              <div className="space-y-8 animate-scale-in w-full">
                                  <div className="relative">
                                      <div className="absolute inset-0 bg-yellow-400 blur-[60px] opacity-30 rounded-full animate-pulse"></div>
                                      <Trophy size={120} className="text-yellow-400 mx-auto drop-shadow-[0_0_30px_rgba(250,204,21,0.6)] relative z-10 animate-bounce" />
                                  </div>
                                  
                                  <div className="relative z-10">
                                      <p className="text-sm font-black text-rose-300 uppercase tracking-[0.4em] mb-4">יש לנו זוכה מאושרת!</p>
                                      <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-[2.5rem] shadow-2xl overflow-hidden relative group">
                                          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-yellow-400/10 to-transparent"></div>
                                          <h2 className="text-4xl md:text-5xl font-black text-white mb-3 tracking-tighter">
                                              {selectedLottery.winnerId === 'No Participants' ? 'אין משתתפות' : 'חברת המעגל המאושרת'}
                                          </h2>
                                          <div className="flex items-center justify-center gap-2 text-yellow-400 bg-yellow-400/10 py-2 px-4 rounded-full w-fit mx-auto border border-yellow-400/20">
                                              <Sparkles size={16} fill="currentColor" />
                                              <span className="font-black text-sm uppercase">מזל טוב על הזכייה!</span>
                                          </div>
                                      </div>
                                  </div>

                                  <div className="pt-6">
                                      <p className="text-white/60 text-xs font-black uppercase tracking-widest mb-4">פירוט הפרסים שחולקו:</p>
                                      <div className="max-w-xs mx-auto">
                                          {renderPrizeList(selectedLottery, true)}
                                      </div>
                                      <button onClick={() => setSelectedLottery(null)} className="mt-10 bg-white text-slate-950 px-10 py-4 rounded-2xl font-black text-sm hover:bg-rose-500 hover:text-white transition-all shadow-xl">
                                          סגירה וחזרה להגרלות
                                      </button>
                                  </div>
                                  
                                  {user?.isAdmin && (
                                     <p className="text-emerald-400 text-xs font-bold flex items-center justify-center gap-2 animate-fade-in">
                                         <CheckCircle2 size={14} /> תוצאות ההגרלה פורסמו בדף הבית.
                                     </p>
                                  )}
                              </div>
                          )}
                      </div>
                  </div>
                  
                  {(showWinner || selectedLottery.winnerId) && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[3.5rem]">
                          <div className="absolute top-1/4 left-10 w-4 h-4 bg-yellow-400 rounded-full animate-ping shadow-[0_0_15px_yellow]"></div>
                          <div className="absolute top-1/2 right-10 w-3 h-3 bg-rose-500 rounded-full animate-ping delay-700 shadow-[0_0_15px_red]"></div>
                          <div className="absolute bottom-1/4 left-1/2 w-4 h-4 bg-blue-400 rounded-full animate-ping delay-1000"></div>
                      </div>
                  )}
              </div>
          </div>
      )}

      {(activeTab === 'regular' && filteredLotteries.length === 0) && (
          <div className="text-center py-32 bg-white/50 rounded-[3rem] border border-dashed border-rose-200">
            <Gift size={48} className="text-rose-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold">אין הגרלות כלליות פעילות כרגע. חזרי לבדוק בקרוב!</p>
            <button onClick={() => window.location.hash = '/'} className="mt-4 text-rose-500 text-xs font-black hover:underline">חזרה לדף הבית</button>
          </div>
      )}
    </div>
  );
};

export default LotteryPage;