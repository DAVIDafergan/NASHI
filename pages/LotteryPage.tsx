import React, { useState, useEffect } from 'react';
import { Gift, Calendar, Award, Star, Trophy, Users, CheckCircle, CheckCircle2, Ticket, Loader2, X, Sparkles, Share2, Info, Lock, ClipboardList, Camera, Send, Settings, Eye, Image as ImageIcon, ArrowLeft, Medal, Target, Plus, Trash2, Minus, Edit } from 'lucide-react';
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

  // מצבי טופס למנהל (ליצירת ועריכת אתגר)
  const [newChallenge, setNewChallenge] = useState({
      title: '',
      prizes: [''], 
      notes: '',
      image: '', 
      drawDate: ''
  });
  
  // תוספת לעריכת אתגר קיים
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);

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

  // פונקציית שמירה/יצירה של אתגר (תומכת גם בעריכה עכשיו)
  const handleAdminSaveChallenge = async () => {
      if (!newChallenge.title || newChallenge.prizes[0] === '') return alert('חובה להזין כותרת ופרס אחד לפחות לאתגר');
      try {
          if (editingChallengeId) {
              await api.updateChallenge(editingChallengeId, newChallenge);
              alert('האתגר עודכן בהצלחה!');
          } else {
              await api.createChallenge(newChallenge);
              alert('האתגר נוצר בהצלחה!');
          }
          setNewChallenge({ title: '', prizes: [''], notes: '', image: '', drawDate: '' });
          setEditingChallengeId(null);
          
          const fetchedChallenges = await api.getChallenges();
          if (fetchedChallenges) {
              setChallenges(fetchedChallenges);
              if (!viewingChallengeId && fetchedChallenges.length > 0) setViewingChallengeId(fetchedChallenges[0]._id || fetchedChallenges[0].id);
          }
      } catch (e) { alert(editingChallengeId ? 'שגיאה בעדכון האתגר' : 'שגיאה ביצירת האתגר'); }
  };

  // פונקציה ללחיצה על כפתור עריכת אתגר
  const handleEditChallengeClick = (challenge: any) => {
      setEditingChallengeId(challenge._id || challenge.id);
      setNewChallenge({
          title: challenge.title || '',
          prizes: challenge.prizes && challenge.prizes.length > 0 ? challenge.prizes : [challenge.prize || ''],
          notes: challenge.notes || '',
          image: challenge.image || '',
          drawDate: challenge.drawDate || ''
      });
      // גלילה למעלה לטופס העריכה
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdminDeleteChallenge = async (challengeId: string) => {
      if (!window.confirm('האם את בטוחה שברצונך למחוק אתגר זה ואת כל התמונות המשויכות אליו?')) return;
      try {
          await api.deleteChallenge(challengeId);
          alert('האתגר נמחק בהצלחה');
          
          // איפוס מצב עריכה אם מחקנו את האתגר שאנחנו עורכים כרגע
          if (editingChallengeId === challengeId) {
              setEditingChallengeId(null);
              setNewChallenge({ title: '', prizes: [''], notes: '', image: '', drawDate: '' });
          }

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

  // פונקציית עזר לרינדור פרסים באתגרים (מוקטן ועדין יותר)
  const renderChallengePrizes = (prizes: string[]) => {
      if (!prizes || prizes.length === 0) return null;
      return (
          <div className="flex flex-col gap-1.5 mt-2 w-full md:w-auto">
              {prizes.map((p, idx) => (
                  <div key={idx} className="inline-flex items-center gap-2 text-indigo-900 font-bold bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-sm border border-white/50 w-fit">
                      {idx === 0 ? <Trophy size={14} className="text-yellow-500" /> : <Medal size={12} className="text-slate-400" />}
                      <span className="text-[11px] md:text-xs">
                          {idx === 0 ? 'פרס ראשון:' : `פרס ${idx + 1}:`} {p}
                      </span>
                  </div>
              ))}
          </div>
      );
  };

  return (
    <div className="min-h-screen space-y-6 md:space-y-8 pb-10 text-right bg-slate-50/50" dir="rtl">
      {/* Tab Navigation - מוצג תמיד למעלה */}
      <div className="flex justify-center p-1 bg-slate-200/50 backdrop-blur-sm w-fit mx-auto rounded-full gap-1 shadow-inner mt-4 md:mt-8">
          <button 
            onClick={() => setActiveTab('regular')}
            className={`px-5 py-2 md:px-8 md:py-3 rounded-full font-bold md:font-black text-xs md:text-sm transition-all ${activeTab === 'regular' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            הגרלות כלליות
          </button>
          <button 
            onClick={() => setActiveTab('challenges')}
            className={`px-5 py-2 md:px-8 md:py-3 rounded-full font-bold md:font-black text-xs md:text-sm transition-all flex items-center gap-1.5 ${activeTab === 'challenges' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            אתגרי החוסן 💪
          </button>
      </div>

      {activeTab === 'regular' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 px-4 animate-fade-in max-w-7xl mx-auto">
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
        /* --- ממשק אתגרים חדש - מעודן ומותאם לנייד --- */
        <div className="max-w-6xl mx-auto px-4 animate-scale-in space-y-6 md:space-y-8">
            
            {/* ניהול למנהלת (הוספת/עריכת אתגר) */}
            {user?.isAdmin && (
                <div className={`bg-white p-6 md:p-8 rounded-[2rem] border ${editingChallengeId ? 'border-amber-300 shadow-[0_0_25px_rgba(251,191,36,0.3)]' : 'border-indigo-100 shadow-lg'} relative overflow-hidden`}>
                    <div className={`absolute top-0 right-0 w-1.5 h-full ${editingChallengeId ? 'bg-amber-400' : 'bg-indigo-500'}`}></div>
                    <div className={`flex items-center gap-2 mb-4 ${editingChallengeId ? 'text-amber-600' : 'text-indigo-700'}`}>
                        {editingChallengeId ? <Edit size={20} /> : <Settings size={20} />}
                        <h4 className="text-xl md:text-2xl font-black">ניהול חוסן - {editingChallengeId ? 'עריכת אתגר' : 'יצירת אתגר'}</h4>
                    </div>
                    
                    <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
                        <div className="space-y-2 lg:col-span-1">
                            <label className="text-[10px] md:text-xs font-bold text-slate-400 mr-2">כותרת האתגר</label>
                            <input 
                                type="text" 
                                value={newChallenge.title} 
                                onChange={(e) => setNewChallenge({...newChallenge, title: e.target.value})}
                                className="w-full p-3 md:p-4 bg-slate-50 rounded-xl font-medium text-sm border border-slate-100 focus:border-indigo-300 outline-none" 
                                placeholder="שם האתגר..."
                            />
                        </div>
                        
                        {/* ריבוי פרסים */}
                        <div className="space-y-2 lg:col-span-2">
                            <label className="text-[10px] md:text-xs font-bold text-slate-400 mr-2">רשימת פרסים לזוכים</label>
                            <div className="space-y-2">
                                {newChallenge.prizes.map((prize, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={prize} 
                                            onChange={(e) => handlePrizeChange(idx, e.target.value)}
                                            className="w-full p-3 md:p-4 bg-slate-50 rounded-xl font-medium text-sm border border-slate-100 focus:border-indigo-300 outline-none" 
                                            placeholder={`פרס ${idx + 1}`}
                                        />
                                        <button onClick={() => removePrizeField(idx)} className="bg-red-50 text-red-500 px-3 rounded-xl hover:bg-red-100 transition-colors shrink-0">
                                            <Minus size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={addPrizeField} className="text-[10px] md:text-xs font-bold text-indigo-600 flex items-center gap-1 mt-1 hover:underline">
                                <Plus size={12} /> הוספי פרס
                            </button>
                        </div>

                        <div className="space-y-2 lg:col-span-1">
                            <label className="text-[10px] md:text-xs font-bold text-slate-400 mr-2">הסבר / משימה</label>
                            <textarea 
                                value={newChallenge.notes} 
                                onChange={(e) => setNewChallenge({...newChallenge, notes: e.target.value})}
                                className="w-full p-3 md:p-4 bg-slate-50 rounded-xl font-medium text-sm border border-slate-100 focus:border-indigo-300 outline-none h-[48px] md:h-[56px] resize-none" 
                                placeholder="הנחיות..."
                            />
                        </div>

                        {/* תמונה לאתגר */}
                        <div className="space-y-2 lg:col-span-1 flex flex-col h-full justify-between">
                            <div 
                                onClick={() => document.getElementById('admin-challenge-image')?.click()}
                                className={`h-[48px] md:h-[56px] rounded-xl border border-dashed flex items-center justify-center gap-2 cursor-pointer transition-all overflow-hidden relative ${newChallenge.image ? 'border-indigo-500' : 'border-slate-300 hover:border-indigo-300'}`}
                            >
                                {newChallenge.image ? (
                                    <img src={newChallenge.image} className="w-full h-full object-cover" alt="Preview" />
                                ) : (
                                    <>
                                        <ImageIcon size={16} className="text-slate-400" />
                                        <span className="text-[10px] md:text-xs font-medium text-slate-500">תמונה</span>
                                    </>
                                )}
                                <input id="admin-challenge-image" type="file" accept="image/*" className="hidden" onChange={(e) => handleImageChange(e, true)} />
                            </div>

                            <div className="flex gap-2 mt-2 h-[48px] md:h-[56px]">
                                <button 
                                    onClick={handleAdminSaveChallenge}
                                    className={`flex-1 text-white py-3 md:py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 ${editingChallengeId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                >
                                    {editingChallengeId ? <><Edit size={16} /> שמרי שינויים</> : <><Plus size={16} /> צרי אתגר</>}
                                </button>
                                {editingChallengeId && (
                                    <button 
                                        onClick={() => {
                                            setEditingChallengeId(null);
                                            setNewChallenge({ title: '', prizes: [''], notes: '', image: '', drawDate: '' });
                                        }}
                                        className="px-4 bg-slate-100 text-slate-500 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all flex items-center justify-center"
                                    >
                                        ביטול
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* חווית משתמש משופרת: תפריט אתגרים אופקי עדין */}
            {challenges.length === 0 ? (
                <div className="text-center py-16 bg-white/50 rounded-[2rem] border border-dashed border-slate-200">
                    <Target size={36} className="text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium text-sm md:text-base">אין כרגע אתגרי חוסן פעילים. חזרי לבדוק בקרוב!</p>
                </div>
            ) : (
                <div className="space-y-6 md:space-y-8">
                    {/* Ribbon - בחירת אתגר - מוקטן ומעודן */}
                    <div className="flex overflow-x-auto gap-3 pb-2 snap-x hide-scrollbar scroll-smooth">
                        {challenges.map((challenge) => {
                            const isSelected = viewingChallengeId === (challenge._id || challenge.id);
                            return (
                                <button 
                                    key={challenge._id || challenge.id}
                                    onClick={() => setViewingChallengeId(challenge._id || challenge.id)}
                                    className={`snap-center shrink-0 px-4 py-2.5 md:px-6 md:py-3 rounded-2xl md:rounded-3xl font-bold md:font-black text-xs md:text-sm whitespace-nowrap transition-all border shadow-sm flex items-center gap-1.5 md:gap-2 ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 scale-[1.02]' : 'bg-white text-slate-600 border-slate-100 hover:bg-slate-50'}`}
                                >
                                    <Target size={16} className={isSelected ? 'text-indigo-200' : 'text-slate-400'} />
                                    {challenge.title}
                                    {challenge.isActive === false && <Lock size={12} className="mr-1 opacity-50" />}
                                </button>
                            );
                        })}
                    </div>

                    {/* תצוגת האתגר הנבחר - קומפקטי ואלגנטי */}
                    {challenges.map((challenge) => {
                        if (viewingChallengeId !== (challenge._id || challenge.id)) return null;
                        
                        const currentEntries = challengeEntries.filter(e => e.challengeId === (challenge._id || challenge.id));
                        const challengePrizes = challenge.prizes || (challenge.prize ? [challenge.prize] : []);
                        
                        return (
                            <div key={challenge._id || challenge.id} className="bg-white rounded-[2rem] md:rounded-[3.5rem] overflow-hidden border border-slate-100 shadow-xl relative animate-fade-in">
                                {/* Header של האתגר */}
                                <div className={`p-6 md:p-10 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 min-h-[180px] md:min-h-[250px]`}>
                                    {challenge.image ? (
                                        <>
                                            <div className="absolute inset-0 bg-black/60 z-0"></div>
                                            <img src={challenge.image} alt={challenge.title} className="absolute inset-0 w-full h-full object-cover z-[1]" />
                                        </>
                                    ) : (
                                        <div className={`absolute inset-0 ${challenge.isActive !== false ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800' : 'bg-slate-800'}`}>
                                            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                                        </div>
                                    )}
                                    
                                    <div className="relative z-10 text-center md:text-right space-y-2.5 text-white flex-1 w-full">
                                        <h3 className="text-2xl md:text-4xl font-black drop-shadow-md">{challenge.title}</h3>
                                        {challenge.notes && <p className="text-indigo-50 font-medium text-sm md:text-base max-w-2xl drop-shadow-sm bg-black/20 p-3 md:p-4 rounded-xl md:rounded-2xl backdrop-blur-sm border border-white/10 leading-relaxed">{challenge.notes}</p>}
                                        
                                        {/* רינדור הפרסים - מוקטן עדין */}
                                        {renderChallengePrizes(challengePrizes)}
                                    </div>
                                    
                                    <div className="relative z-10 flex flex-col gap-2.5 min-w-[200px] md:min-w-[250px] w-full md:w-auto mt-2 md:mt-0">
                                        {challenge.winnerFamily ? (
                                            <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-amber-950 px-5 py-4 rounded-2xl font-black text-center shadow-lg border border-yellow-300 animate-bounce text-sm">
                                                <Trophy size={20} className="mx-auto mb-1 opacity-80" />
                                                <span className="block text-[10px] opacity-70 mb-0.5">הזוכה המאושרת:</span>
                                                <span className="text-base">משפחת {challenge.winnerFamily}</span>
                                            </div>
                                        ) : challenge.isActive !== false ? (
                                            <button 
                                                onClick={() => setSelectedChallengeId(selectedChallengeId === (challenge._id || challenge.id) ? null : (challenge._id || challenge.id))}
                                                className={`w-full px-5 md:px-6 py-3.5 md:py-4 rounded-2xl md:rounded-3xl font-bold md:font-black shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm md:text-base ${selectedChallengeId === (challenge._id || challenge.id) ? 'bg-slate-900 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-50'}`}
                                            >
                                                {selectedChallengeId === (challenge._id || challenge.id) ? 'סגירת הטופס' : 'השתתפי באתגר!'} 
                                                <Target size={18} className={selectedChallengeId === (challenge._id || challenge.id) ? 'text-slate-400' : 'text-indigo-400'} />
                                            </button>
                                        ) : (
                                            <div className="bg-black/40 text-white px-5 py-3 rounded-2xl font-bold text-center backdrop-blur-sm border border-white/10 text-sm">
                                                <Lock className="mx-auto mb-1 opacity-50" size={16}/>
                                                האתגר הסתיים
                                            </div>
                                        )}

                                        {user?.isAdmin && (
                                            <div className="flex gap-2 mt-1">
                                                <button onClick={() => handleAdminRunChallenge(challenge._id || challenge.id)} className="flex-1 bg-emerald-500 text-white py-2 rounded-xl text-[10px] md:text-xs font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1 shadow-sm">
                                                    <Eye size={12}/> הגרלי
                                                </button>
                                                <button onClick={() => handleEditChallengeClick(challenge)} className="flex-1 bg-amber-500 text-white py-2 rounded-xl text-[10px] md:text-xs font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-1 shadow-sm">
                                                    <Edit size={12}/> עריכה
                                                </button>
                                                <button onClick={() => handleAdminDeleteChallenge(challenge._id || challenge.id)} className="flex-1 bg-red-500 text-white py-2 rounded-xl text-[10px] md:text-xs font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-1 shadow-sm">
                                                    <Trash2 size={12}/> מחיקה
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* אזור טופס העלאה - אלגנטי וקומפקטי */}
                                {selectedChallengeId === (challenge._id || challenge.id) && (
                                    <div className="p-5 md:p-10 bg-indigo-50/30 border-b border-indigo-100 animate-fade-in">
                                        {!user ? (
                                            <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-indigo-200 shadow-sm">
                                                <Lock size={32} className="text-indigo-300 mx-auto mb-3" />
                                                <h4 className="text-base md:text-lg font-bold text-slate-800">התחברי כדי להשתתף</h4>
                                                <button onClick={() => window.location.hash = '/login'} className="mt-4 bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-md hover:bg-indigo-700 transition-all text-sm">כניסה למערכת</button>
                                            </div>
                                        ) : (
                                            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto bg-white p-5 md:p-8 rounded-2xl md:rounded-[2rem] shadow-sm border border-slate-50">
                                                <div className="space-y-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] md:text-xs font-bold text-slate-500 mr-1">שם משפחה (יוצג באתר)</label>
                                                        <input 
                                                            type="text" 
                                                            value={familyName}
                                                            onChange={(e) => setFamilyName(e.target.value)}
                                                            placeholder="למשל: לוי"
                                                            className="w-full px-4 py-3 md:px-5 md:py-3.5 rounded-xl bg-slate-50 border border-slate-100 focus:border-indigo-400 focus:bg-white outline-none transition-colors font-medium text-sm"
                                                        />
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] md:text-xs font-bold text-slate-500 mr-1">מספר טלפון (חסוי להנהלה בלבד)</label>
                                                        <input 
                                                            type="tel" 
                                                            value={phone}
                                                            onChange={(e) => setPhone(e.target.value)}
                                                            placeholder="למשל: 050-1234567"
                                                            className="w-full px-4 py-3 md:px-5 md:py-3.5 rounded-xl bg-slate-50 border border-slate-100 focus:border-indigo-400 focus:bg-white outline-none transition-colors font-medium text-sm"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-4 flex flex-col justify-end">
                                                    <div className="space-y-1.5 flex-1">
                                                        <label className="text-[10px] md:text-xs font-bold text-slate-500 mr-1">תמונה לאתגר 📸</label>
                                                        <div 
                                                            onClick={() => document.getElementById('challenge-input')?.click()}
                                                            className={`group relative h-28 md:h-32 rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center gap-2 bg-slate-50 ${entryImage ? 'border-indigo-500' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'}`}
                                                        >
                                                            {entryImage ? (
                                                                <div className="w-full h-full relative">
                                                                    <img src={entryImage} className="w-full h-full object-cover" alt="Preview" />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                                                        <Camera className="text-white" size={24} />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="w-10 h-10 bg-white shadow-sm rounded-full flex items-center justify-center text-indigo-400">
                                                                        <Camera size={20} />
                                                                    </div>
                                                                    <p className="font-medium text-slate-500 text-[10px] md:text-xs">לחצי לבחירת תמונה</p>
                                                                </>
                                                            )}
                                                            <input id="challenge-input" type="file" accept="image/*" className="hidden" onChange={(e) => handleImageChange(e, false)} />
                                                        </div>
                                                    </div>

                                                    <button 
                                                        onClick={handleChallengeSubmit}
                                                        disabled={isSubmitting}
                                                        className="w-full py-3.5 md:py-4 rounded-xl bg-indigo-600 text-white font-bold text-sm md:text-base shadow-md hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                    >
                                                        {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                                                        שלחי תמונה
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* גלריית התמונות של האתגר - עדינה ופרופורציונלית */}
                                <div className="p-6 md:p-10">
                                    <div className="flex items-center justify-between mb-5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
                                                <ImageIcon size={18} />
                                            </div>
                                            <div>
                                                <h4 className="text-lg md:text-xl font-black text-slate-800">הגלריה</h4>
                                                <p className="text-slate-400 font-medium text-[10px] md:text-xs">{currentEntries.length} משתתפות</p>
                                            </div>
                                        </div>
                                    </div>

                                    {currentEntries.length > 0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-5">
                                            {currentEntries.map((entry, idx) => (
                                                <div key={idx} className="group relative bg-slate-100 rounded-xl md:rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-slate-100 aspect-[4/5]">
                                                    <img src={entry.image} alt={entry.familyName} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90 transition-opacity flex flex-col justify-end p-3 md:p-4">
                                                        <p className="text-white font-bold text-xs md:text-sm drop-shadow-sm truncate">
                                                            {/* תיקון באג ה-"משפחת משפחת" - אם כבר כתבה משפחת לא נוסיף */}
                                                            {entry.familyName.startsWith('משפחת') ? entry.familyName : `משפחת ${entry.familyName}`}
                                                        </p>
                                                        {user?.isAdmin && (
                                                            <p className="text-indigo-200 text-[9px] md:text-[10px] font-medium mt-0.5 dir-ltr text-left">{entry.phone}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                            <p className="text-slate-400 font-medium text-sm">הגלריה ריקה. תהיי הראשונה להעלות!</p>
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

      {/* --- מודל ההגרלות הלייב --- */}
      {selectedLottery && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
              <div className="w-full max-w-md relative">
                  <button onClick={() => setSelectedLottery(null)} className="absolute -top-12 right-0 p-2 bg-white/10 rounded-full hover:bg-white/20 text-white transition-all"><X size={20} /></button>
                  
                  <div className="bg-gradient-to-b from-indigo-950 via-purple-900 to-slate-950 rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative">
                      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse"></div>
                      
                      <div className="p-8 md:p-10 text-center relative z-10 min-h-[350px] flex flex-col items-center justify-center">
                          <div className="mb-6">
                              <span className="text-rose-400 text-[9px] font-bold tracking-[0.2em] uppercase mb-2 block">Live Drawing Event</span>
                              <h3 className="text-2xl md:text-3xl font-black text-white leading-tight">{selectedLottery.title}</h3>
                          </div>

                          {!showWinner && !isDrawing && !selectedLottery.winnerId && (
                              <div className="space-y-6 w-full animate-fade-in">
                                  <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mx-auto border border-white/10">
                                    <Gift size={36} className="text-rose-400/60" />
                                  </div>
                                  {user?.isAdmin ? (
                                      <div className="space-y-4">
                                          <p className="text-purple-200 font-medium text-sm">מוכנה להפעיל?</p>
                                          <button onClick={simulateDraw} className="w-full bg-gradient-to-r from-yellow-400 via-orange-500 to-rose-500 text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform">
                                              הפעלת רולטה
                                          </button>
                                      </div>
                                  ) : (
                                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                          <Loader2 size={24} className="text-rose-400 animate-spin mx-auto mb-3" />
                                          <p className="text-white/80 font-medium text-sm">המנהלת טרם הפעילה...</p>
                                      </div>
                                  )}
                              </div>
                          )}

                          {isDrawing && (
                              <div className="space-y-6 animate-fade-in">
                                  <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-rose-300 to-purple-500 animate-pulse">
                                      {countdown}
                                  </div>
                                  <div className="flex flex-col items-center gap-2">
                                      <p className="text-rose-200 font-bold text-sm tracking-widest animate-bounce">מערבבים שמות...</p>
                                  </div>
                              </div>
                          )}

                          {(showWinner || selectedLottery.winnerId) && (
                              <div className="space-y-6 animate-scale-in w-full">
                                  <Trophy size={80} className="text-yellow-400 mx-auto drop-shadow-lg animate-bounce" />
                                  
                                  <div className="relative z-10">
                                      <p className="text-[10px] font-bold text-rose-300 uppercase tracking-widest mb-2">יש לנו זוכה מאושרת!</p>
                                      <div className="bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl shadow-xl">
                                          <h2 className="text-2xl font-black text-white mb-2">
                                              {selectedLottery.winnerId === 'No Participants' ? 'אין משתתפות' : 'חברת המעגל המאושרת'}
                                          </h2>
                                      </div>
                                  </div>

                                  <div className="pt-2">
                                      <button onClick={() => setSelectedLottery(null)} className="w-full mt-4 bg-white text-slate-900 py-3 rounded-xl font-bold text-sm hover:bg-rose-50 transition-colors">
                                          סגירה
                                      </button>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {(activeTab === 'regular' && filteredLotteries.length === 0) && (
          <div className="text-center py-24 bg-white/50 rounded-3xl border border-dashed border-rose-200 mx-4">
            <Gift size={36} className="text-rose-200 mx-auto mb-3" />
            <p className="text-slate-400 font-medium text-sm">אין הגרלות כלליות כרגע.</p>
            <button onClick={() => window.location.hash = '/'} className="mt-3 text-rose-500 text-xs font-bold hover:underline">חזרה לדף הבית</button>
          </div>
      )}
    </div>
  );
};

export default LotteryPage;