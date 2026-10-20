import React, { useState, useEffect } from 'react';
import { Gift, Calendar, Award, Star, Trophy, Users, CheckCircle, CheckCircle2, Ticket, Loader2, X, Sparkles, Share2, Info, Lock, ClipboardList, Camera, Send, Settings, Eye, Image as ImageIcon, ArrowLeft, Medal, Target, Plus, Trash2, Minus, Edit, Clock } from 'lucide-react';
import { LotteryItem, User } from '../types';
import { useLocation } from 'react-router-dom';
import { api } from '../services/api'; // ייבוא ה-API
import ScrollReveal from '../components/ScrollReveal';
import { SectionHeader } from '../components/home/HomeParts';
import { PageShell, PageHero, ChipRow, EmptyState, Portal } from '../components/pages/PageKit';

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
  const [drawCountdown, setDrawCountdown] = useState('');
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

  // --- פונקציות ניהול והשתתפות באתגרים (כולל דחיסת תמונה) ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, isChallengeAdminImage = false) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
              const img = new Image();
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  const MAX_WIDTH = 800; // רזולוציה מקסימלית לתמונה (כדי לא להעמיס על השרת)
                  const MAX_HEIGHT = 800;
                  let width = img.width;
                  let height = img.height;

                  if (width > height) {
                      if (width > MAX_WIDTH) {
                          height *= MAX_WIDTH / width;
                          width = MAX_WIDTH;
                      }
                  } else {
                      if (height > MAX_HEIGHT) {
                          width *= MAX_HEIGHT / height;
                          height = MAX_HEIGHT;
                      }
                  }

                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  ctx?.drawImage(img, 0, 0, width, height);
                  
                  // דחיסה ל-JPEG ב-70% איכות - מקטין את המשקל משמעותית
                  const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);

                  if (isChallengeAdminImage) {
                      setNewChallenge({...newChallenge, image: compressedDataUrl});
                  } else {
                      setEntryImage(compressedDataUrl);
                  }
              };
              img.src = event.target?.result as string;
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
          // חווית משתמש מיידית - מוסיפים את התמונה לתצוגה המקומית מיד כדי לא להמתין
          const newEntry = {
              challengeId: selectedChallengeId,
              familyName: familyName,
              image: entryImage,
              phone: phone
          };
          setChallengeEntries(prev => [...prev, newEntry]);

          await api.enterChallenge({ challengeId: selectedChallengeId, familyName, image: entryImage, phone });
          alert('איזה יופי! התמונה הועלתה ונכנסת לאתגר בהצלחה! 🎯');
          
          setEntryImage(null);
          setFamilyName('');
          setPhone('');
          setSelectedChallengeId(null);
          
          // סנכרון שקט מול השרת ברקע כדי להבטיח את שאר הנתונים
          api.getChallengeEntries().then(entries => {
              if (entries) setChallengeEntries(entries);
          }).catch(e => console.error(e));
          
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

  // ההגרלה הפעילה הראשונה מוצגת ככרטיס מוביל גדול; השאר (פעילות נוספות + שהסתיימו) ברשימה קטנה יותר מתחת
  const activeLotteries = filteredLotteries.filter(l => l.isActive);
  const endedLotteries = filteredLotteries.filter(l => !l.isActive);
  const featuredLottery = activeLotteries[0] || null;
  const otherLotteries = [...activeLotteries.slice(1), ...endedLotteries];
  const featuredLotteryKey = featuredLottery ? (featuredLottery._id || featuredLottery.id) : null;

  // ספירה לאחור בעברית עד מועד ההגרלה של הכרטיס המוביל
  useEffect(() => {
    if (!featuredLottery) { setDrawCountdown(''); return; }
    const update = () => {
      const diff = new Date(featuredLottery.drawDate).getTime() - Date.now();
      if (diff <= 0) { setDrawCountdown('ההגרלה מתקיימת בקרוב'); return; }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      if (days > 0) setDrawCountdown(`עוד ${days} ימים ו-${hours} שעות`);
      else if (hours > 0) setDrawCountdown(`עוד ${hours} שעות ו-${minutes} דקות`);
      else setDrawCountdown(`עוד ${minutes} דקות ו-${seconds} שניות`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [featuredLotteryKey]);

  // כפתור הפעולה של כרטיס הגרלה - זהה בין הכרטיס המוביל לכרטיסים הקטנים
  const renderActionButton = (lottery: any) => {
      const isRegistered = user && lottery.participants.includes(user.id || user._id);
      const isMissionStarted = user && lottery.missionStarted?.includes(user.id || user._id);
      const canParticipate = lottery.participationType === 'everyone' || (user && user.points >= (lottery.minPointsToEnter || 0)) || lottery.participationType === 'mission';
      const base = 'w-full min-h-[48px] rounded-full text-[15px] font-strong transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.97]';

      if (user?.isAdmin) {
          return (
              <button onClick={() => handleOpenDraw(lottery)} className={`${base} bg-rose-700 text-white shadow-lift hover:bg-rose-800`}>
                  <Sparkles size={17} className="text-champagne-200" />
                  {lottery.winnerId ? 'צפייה בתוצאות' : 'ניהול הגרלה (Live)'}
              </button>
          );
      }
      if (!lottery.isActive || lottery.winnerId) {
          return (
              <button onClick={() => handleOpenDraw(lottery)} className={`${base} bg-rose-50 text-rose-700 hover:bg-rose-100`}>
                  <Trophy size={17} /> צפייה בזוכה
              </button>
          );
      }
      if (isRegistered) {
          return (
              <div className={`${base} border border-sage-200 bg-sage-50 text-sage-700`}>
                  <CheckCircle2 size={17} /> את בפנים! בהצלחה
              </div>
          );
      }
      if (lottery.participationType === 'mission' && isMissionStarted) {
          return (
              <button onClick={() => handleCompleteMission(lottery)} className={`${base} bg-gradient-to-l from-champagne-500 to-rose-500 text-white shadow-lift`}>
                  <CheckCircle size={17} /> סיימתי את המשימה!
              </button>
          );
      }
      return (
          <button
              onClick={() => handleEnterLottery(lottery)}
              className={`${base} ${canParticipate ? 'bg-rose-700 text-white shadow-lift hover:bg-rose-800' : 'bg-rose-50 text-rose-300 cursor-not-allowed'}`}
          >
              <Ticket size={17} />
              {lottery.participationType === 'mission' ? 'התחילי משימה להגרלה' : canParticipate ? 'הירשמי להגרלה עכשיו' : 'חסרות לך נקודות'}
          </button>
      );
  };

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
        <ol className="space-y-1.5">
            {finalPrizes.map((p: string, idx: number) => (
                <li key={idx} className={`flex items-center gap-2.5 rounded-2xl px-3 py-2 ${isDark ? 'bg-white/10' : idx === 0 ? 'bg-champagne-50 border border-champagne-100' : 'bg-rose-50/50'}`}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${idx === 0 ? 'bg-champagne-400 text-white' : 'bg-white text-slate-400'}`}>
                        {idx === 0 ? <Trophy size={14} /> : <Medal size={13} />}
                    </span>
                    <span className={`text-[14px] ${isDark ? 'text-white' : 'text-ink'}`}>
                        <span className="text-slate-400">{idx === 0 ? 'פרס ראשון · ' : `פרס ${idx + 1} · `}</span>
                        {p}
                    </span>
                </li>
            ))}
        </ol>
    );
  };

  // פונקציית עזר לרינדור פרסים באתגרים
  const renderChallengePrizes = (prizes: string[]) => {
      if (!prizes || prizes.length === 0) return null;
      return (
          <div className="mt-3 flex flex-wrap gap-1.5">
              {prizes.map((p, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[12.5px] text-plum-800 shadow-soft backdrop-blur">
                      {idx === 0 ? <Trophy size={13} className="text-champagne-500" /> : <Medal size={12} className="text-slate-400" />}
                      {idx === 0 ? 'פרס ראשון:' : `פרס ${idx + 1}:`} {p}
                  </span>
              ))}
          </div>
      );
  };

  const inputCls = 'w-full rounded-2xl border border-rose-100 bg-rose-50/30 px-4 py-3 text-[15px] outline-none transition focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-100/70';

  return (
    <PageShell>
      <PageHero
        eyebrow="הגרלות ואתגרים"
        title="קצת מזל,"
        accent="הרבה פרגון"
        subtitle="הגרלות לחברות המעגל ואתגרי חוסן משפחתיים עם פרסים אמיתיים. נרשמות בלחיצה ומחכות לגילוי."
      >
        <div className="inline-flex rounded-full border border-rose-100 bg-white/80 p-1 shadow-soft" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'regular'}
            onClick={() => setActiveTab('regular')}
            className={`flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[14.5px] transition-all duration-300 ${activeTab === 'regular' ? 'bg-rose-700 text-white shadow-soft' : 'text-slate-500 hover:text-rose-700'}`}
          >
            <Gift size={16} /> הגרלות
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'challenges'}
            onClick={() => setActiveTab('challenges')}
            className={`flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[14.5px] transition-all duration-300 ${activeTab === 'challenges' ? 'bg-plum-700 text-white shadow-soft' : 'text-slate-500 hover:text-plum-700'}`}
          >
            <Target size={16} /> אתגרי החוסן
          </button>
        </div>
      </PageHero>

      {activeTab === 'regular' ? (
        <div className="space-y-10 animate-fade-in">

            {/* --- כרטיס ההגרלה הפעילה המוביל --- */}
            {featuredLottery && (
              <ScrollReveal animation="scale-in" className="relative overflow-hidden rounded-[2rem] border border-rose-100 bg-white shadow-lift">
                 <div className="grid md:grid-cols-[1.1fr_1fr]">
                    <div className="relative min-h-[220px] md:min-h-[380px] overflow-hidden bg-rose-100">
                       {(featuredLottery as any).image ? (
                         <img src={(featuredLottery as any).image} alt="" className="absolute inset-0 h-full w-full object-cover animate-kenburns" />
                       ) : (
                         <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-rose-200 via-rose-100 to-champagne-100">
                           <Gift size={88} className="text-rose-400 animate-float-y" />
                         </div>
                       )}
                       <div className="absolute inset-0 bg-gradient-to-t from-plum-950/70 via-transparent to-transparent md:bg-gradient-to-l md:from-transparent md:via-transparent md:to-plum-950/30" />
                       <span className="absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1.5 text-[12.5px] text-rose-700 shadow-soft">
                          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" /></span>
                          ההגרלה הפעילה
                       </span>
                       {drawCountdown && (
                         <div className="absolute bottom-4 right-4 left-4 md:left-auto rounded-2xl bg-white/15 px-4 py-3 text-white backdrop-blur-md">
                           <p className="text-[12px] opacity-80">ההגרלה תתקיים בעוד</p>
                           <p className="font-strong text-[1.25rem] leading-tight flex items-center gap-2"><Clock size={17} /> {drawCountdown}</p>
                         </div>
                       )}
                    </div>
                    <div className="flex flex-col gap-4 p-6 md:p-9 text-right">
                       <h2 className="text-[2rem] md:text-[2.6rem] leading-[1.08]">{featuredLottery.title}</h2>
                       {renderPrizeList(featuredLottery)}
                       <div className="flex items-center gap-2 text-[14px] text-slate-500">
                          <div className="flex -space-x-2 space-x-reverse">
                            {[0,1,2].map(n => <span key={n} className="h-7 w-7 rounded-full border-2 border-white bg-gradient-to-br from-rose-200 to-champagne-200" />)}
                          </div>
                          <Users size={15} className="text-rose-400" /> {featuredLottery.participants.length} משתתפות כבר בפנים
                       </div>
                       <div className="mt-auto flex items-center gap-2 pt-2">
                          <div className="flex-1">{renderActionButton(featuredLottery)}</div>
                          <button onClick={() => handleShare(featuredLottery)} aria-label="שיתוף" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-rose-100 bg-white text-rose-700 transition hover:bg-rose-50 active:scale-90">
                            <Share2 size={18} />
                          </button>
                       </div>
                    </div>
                 </div>
              </ScrollReveal>
            )}

            {/* --- הגרלות נוספות / שהסתיימו --- */}
            {otherLotteries.length > 0 && (
              <section>
                 <SectionHeader eyebrow={featuredLottery ? 'עוד הזדמנויות' : 'כל ההגרלות'} title={featuredLottery ? 'הגרלות נוספות' : 'הגרלות'} className="!px-0 mb-6" />
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {otherLotteries.map((lottery: any, i) => (
                        <ScrollReveal key={lottery.id || lottery._id} delay={i < 6 ? i * 60 : 0} animation="scale-in" className="h-full">
                          <div className={`group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-rose-100/70 bg-white shadow-petal transition-all duration-500 hover:-translate-y-1 hover:shadow-lift ${!lottery.isActive ? 'opacity-90' : ''}`}>
                            <div className="relative m-2 mb-0 aspect-[16/10] shrink-0 overflow-hidden rounded-[1.4rem] bg-rose-50">
                                <img src={lottery.image} alt={lottery.title} loading="lazy" className={`h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 ${!lottery.isActive ? 'grayscale-[0.4]' : ''}`} />
                                <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1.5">
                                    {lottery.participationType === 'mission' ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-[11.5px] text-champagne-700 shadow-soft">
                                            <ClipboardList size={12} /> הגרלת משימה
                                        </span>
                                    ) : (
                                        <span className="rounded-full bg-white/95 px-3 py-1 text-[11.5px] text-rose-700 shadow-soft">
                                            {lottery.participationType === 'everyone' ? 'פתוח לכולן' : `${lottery.minPointsToEnter} נקודות`}
                                        </span>
                                    )}
                                    {!lottery.isActive && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-plum-900/80 px-3 py-1 text-[11.5px] text-white">
                                            <CheckCircle2 size={12} /> הסתיימה
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleShare(lottery); }}
                                    aria-label="שיתוף"
                                    className="absolute bottom-2.5 left-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-rose-700 shadow-soft transition hover:bg-white active:scale-90"
                                >
                                    <Share2 size={15} />
                                </button>
                            </div>

                            <div className="flex flex-1 flex-col gap-3 p-5 pt-4 text-right">
                                <h3 className="text-[1.15rem] leading-snug">{lottery.title}</h3>
                                {renderPrizeList(lottery)}

                                <div className="flex items-center gap-4 text-[13px] text-slate-500">
                                    <span className="flex items-center gap-1"><Calendar size={13} className="text-rose-400" /> {new Date(lottery.drawDate).toLocaleDateString('he-IL')}</span>
                                    <span className="flex items-center gap-1"><Users size={13} className="text-rose-400" /> {lottery.participants.length}</span>
                                </div>

                                <div className="mt-auto pt-1">
                                    {renderActionButton(lottery)}
                                </div>
                            </div>
                          </div>
                        </ScrollReveal>
                    ))}
                 </div>
              </section>
            )}

            {filteredLotteries.length === 0 && (
              <EmptyState icon={<Gift size={28} />} title="אין הגרלות פעילות כרגע" text="הגרלה חדשה בדרך — חזרי לבדוק בקרוב, או הצטרפי לאתגר החוסן." action={<button onClick={() => setActiveTab('challenges')} className="btn-ghost"><Target size={16}/> לאתגרי החוסן</button>} />
            )}
        </div>
      ) : (
        /* --- אתגרי חוסן --- */
        <div className="space-y-8 animate-fade-in">

            {/* ניהול למנהלת (הוספת/עריכת אתגר) */}
            {user?.isAdmin && (
                <div className={`relative overflow-hidden rounded-[2rem] border bg-white p-6 md:p-8 shadow-petal ${editingChallengeId ? 'border-champagne-300' : 'border-plum-100'}`}>
                    <div className={`absolute top-0 right-0 h-full w-1.5 ${editingChallengeId ? 'bg-champagne-400' : 'bg-plum-500'}`}></div>
                    <div className={`mb-5 flex items-center gap-2 ${editingChallengeId ? 'text-champagne-700' : 'text-plum-700'}`}>
                        {editingChallengeId ? <Edit size={20} /> : <Settings size={20} />}
                        <h3 className="text-xl md:text-2xl">ניהול חוסן · {editingChallengeId ? 'עריכת אתגר' : 'יצירת אתגר'}</h3>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 items-start">
                        <label className="block lg:col-span-1">
                            <span className="mb-1.5 block text-[12.5px] text-slate-500">כותרת האתגר</span>
                            <input
                                type="text"
                                value={newChallenge.title}
                                onChange={(e) => setNewChallenge({...newChallenge, title: e.target.value})}
                                className={inputCls}
                                placeholder="שם האתגר…"
                            />
                        </label>

                        {/* ריבוי פרסים */}
                        <div className="lg:col-span-2">
                            <span className="mb-1.5 block text-[12.5px] text-slate-500">פרסים לזוכים</span>
                            <div className="space-y-2">
                                {newChallenge.prizes.map((prize, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={prize}
                                            onChange={(e) => handlePrizeChange(idx, e.target.value)}
                                            className={inputCls}
                                            placeholder={`פרס ${idx + 1}`}
                                        />
                                        <button onClick={() => removePrizeField(idx)} aria-label="הסרת פרס" className="shrink-0 rounded-2xl bg-red-50 px-3 text-red-500 transition hover:bg-red-100">
                                            <Minus size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={addPrizeField} className="mt-2 flex items-center gap-1 text-[13px] text-plum-700 hover:underline">
                                <Plus size={13} /> הוספת פרס
                            </button>
                        </div>

                        <label className="block lg:col-span-1">
                            <span className="mb-1.5 block text-[12.5px] text-slate-500">הסבר / משימה</span>
                            <textarea
                                value={newChallenge.notes}
                                onChange={(e) => setNewChallenge({...newChallenge, notes: e.target.value})}
                                className={`${inputCls} h-[96px] resize-none`}
                                placeholder="הנחיות…"
                            />
                        </label>

                        {/* תמונה לאתגר */}
                        <div className="flex flex-col gap-2 lg:col-span-1">
                            <span className="block text-[12.5px] text-slate-500">תמונה</span>
                            <div
                                onClick={() => document.getElementById('admin-challenge-image')?.click()}
                                className={`relative flex h-[52px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed transition ${newChallenge.image ? 'border-plum-400' : 'border-rose-200 hover:border-plum-300'}`}
                            >
                                {newChallenge.image ? (
                                    <img src={newChallenge.image} className="h-full w-full object-cover" alt="Preview" />
                                ) : (
                                    <>
                                        <ImageIcon size={16} className="text-slate-400" />
                                        <span className="text-[13px] text-slate-500">בחירת תמונה</span>
                                    </>
                                )}
                                <input id="admin-challenge-image" type="file" accept="image/*" className="hidden" onChange={(e) => handleImageChange(e, true)} />
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={handleAdminSaveChallenge}
                                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-3 text-[14px] text-white transition font-strong ${editingChallengeId ? 'bg-champagne-500 hover:bg-champagne-600' : 'bg-plum-700 hover:bg-plum-800'}`}
                                >
                                    {editingChallengeId ? <><Edit size={15} /> שמירה</> : <><Plus size={15} /> יצירה</>}
                                </button>
                                {editingChallengeId && (
                                    <button
                                        onClick={() => {
                                            setEditingChallengeId(null);
                                            setNewChallenge({ title: '', prizes: [''], notes: '', image: '', drawDate: '' });
                                        }}
                                        className="rounded-full bg-rose-50 px-4 text-[14px] text-slate-500 transition hover:bg-rose-100"
                                    >
                                        ביטול
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {challenges.length === 0 ? (
                <EmptyState icon={<Target size={28} />} title="אין כרגע אתגרי חוסן פעילים" text="האתגר הבא בדרך. בינתיים — אולי הגרלה?" action={<button onClick={() => setActiveTab('regular')} className="btn-ghost"><Gift size={16}/> להגרלות</button>} />
            ) : (
                <div className="space-y-6 md:space-y-8">
                    {/* בחירת אתגר */}
                    <ChipRow>
                        {challenges.map((challenge) => {
                            const isSelected = viewingChallengeId === (challenge._id || challenge.id);
                            return (
                                <button
                                    key={challenge._id || challenge.id}
                                    onClick={() => setViewingChallengeId(challenge._id || challenge.id)}
                                    className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2.5 text-[14px] transition-all duration-300 active:scale-95 ${isSelected ? 'border-plum-700 bg-plum-700 text-white shadow-soft' : 'border-rose-100 bg-white/80 text-slate-600 hover:border-plum-300 hover:text-plum-700'}`}
                                >
                                    <Target size={15} className={isSelected ? 'text-plum-200' : 'text-slate-400'} />
                                    {challenge.title}
                                    {challenge.isActive === false && <Lock size={12} className="mr-1 opacity-60" />}
                                </button>
                            );
                        })}
                    </ChipRow>

                    {/* תצוגת האתגר הנבחר */}
                    {challenges.map((challenge) => {
                        if (viewingChallengeId !== (challenge._id || challenge.id)) return null;

                        const currentEntries = challengeEntries.filter(e => e.challengeId === (challenge._id || challenge.id));
                        const challengePrizes = challenge.prizes || (challenge.prize ? [challenge.prize] : []);
                        const isOpen = selectedChallengeId === (challenge._id || challenge.id);

                        return (
                            <div key={challenge._id || challenge.id} className="relative overflow-hidden rounded-[2rem] border border-rose-100 bg-white shadow-lift animate-scale-in">
                                {/* Header של האתגר */}
                                <div className="relative flex min-h-[220px] md:min-h-[300px] flex-col justify-end gap-5 overflow-hidden p-6 md:flex-row md:items-end md:justify-between md:p-10">
                                    {challenge.image ? (
                                        <>
                                            <img src={challenge.image} alt={challenge.title} className="absolute inset-0 z-0 h-full w-full object-cover animate-kenburns" />
                                            <div className="absolute inset-0 z-[1] bg-gradient-to-t from-plum-950/90 via-plum-950/45 to-plum-950/10"></div>
                                        </>
                                    ) : (
                                        <div className={`absolute inset-0 ${challenge.isActive !== false ? 'bg-gradient-to-br from-plum-700 via-rose-700 to-plum-900' : 'bg-plum-900'}`}>
                                            <div className="absolute -top-20 -left-10 h-72 w-72 rounded-full bg-rose-400/30 blur-3xl animate-mesh-drift" />
                                        </div>
                                    )}

                                    <div className="relative z-10 flex-1 space-y-2 text-right text-white">
                                        <p className="font-accent text-[1.3rem] text-rose-200">אתגר חוסן</p>
                                        <h3 className="text-[2rem] md:text-[2.8rem] leading-[1.05] !text-white">{challenge.title}</h3>
                                        {challenge.notes && <p className="max-w-2xl text-[15px] leading-relaxed text-white/85">{challenge.notes}</p>}
                                        {renderChallengePrizes(challengePrizes)}
                                    </div>

                                    <div className="relative z-10 flex w-full flex-col gap-2.5 md:w-auto md:min-w-[250px]">
                                        {challenge.winnerFamily ? (
                                            <div className="rounded-2xl bg-gradient-to-l from-champagne-300 to-champagne-400 px-5 py-4 text-center text-champagne-950 shadow-lift animate-bounce-in">
                                                <Trophy size={22} className="mx-auto mb-1" />
                                                <span className="block text-[12px] opacity-75">הזוכה המאושרת</span>
                                                <span className="font-strong text-[1.1rem]">משפחת {challenge.winnerFamily}</span>
                                            </div>
                                        ) : challenge.isActive !== false ? (
                                            <button
                                                onClick={() => setSelectedChallengeId(isOpen ? null : (challenge._id || challenge.id))}
                                                className={`flex w-full min-h-[52px] items-center justify-center gap-2 rounded-full px-6 text-[15.5px] shadow-lift transition-all active:scale-[0.97] font-strong ${isOpen ? 'bg-white/15 text-white backdrop-blur border border-white/30' : 'bg-white text-plum-800 hover:bg-rose-50'}`}
                                            >
                                                {isOpen ? 'סגירת הטופס' : 'השתתפי באתגר!'}
                                                <Target size={18} />
                                            </button>
                                        ) : (
                                            <div className="rounded-2xl border border-white/15 bg-black/30 px-5 py-3 text-center text-[14px] text-white backdrop-blur-sm">
                                                <Lock className="mx-auto mb-1 opacity-60" size={16}/>
                                                האתגר הסתיים
                                            </div>
                                        )}

                                        {user?.isAdmin && (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleAdminRunChallenge(challenge._id || challenge.id)} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-sage-500 py-2 text-[12.5px] text-white transition hover:bg-sage-600">
                                                    <Eye size={13}/> הגרלה
                                                </button>
                                                <button onClick={() => handleEditChallengeClick(challenge)} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-champagne-500 py-2 text-[12.5px] text-white transition hover:bg-champagne-600">
                                                    <Edit size={13}/> עריכה
                                                </button>
                                                <button onClick={() => handleAdminDeleteChallenge(challenge._id || challenge.id)} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-red-500 py-2 text-[12.5px] text-white transition hover:bg-red-600">
                                                    <Trash2 size={13}/> מחיקה
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* אזור טופס העלאה */}
                                {isOpen && (
                                    <div className="border-b border-rose-100 bg-rose-50/40 p-5 md:p-10 animate-fade-in-up">
                                        {!user ? (
                                            <div className="mx-auto max-w-md rounded-[1.5rem] border border-dashed border-rose-200 bg-white py-8 text-center">
                                                <Lock size={30} className="mx-auto mb-3 text-rose-300" />
                                                <h4 className="text-lg">התחברי כדי להשתתף</h4>
                                                <button onClick={() => window.location.hash = '/login'} className="btn-primary mt-4">כניסה</button>
                                            </div>
                                        ) : (
                                            <div className="mx-auto grid max-w-3xl gap-6 rounded-[1.5rem] border border-rose-100 bg-white p-5 shadow-soft md:grid-cols-2 md:p-8">
                                                <div className="space-y-4">
                                                    <label className="block">
                                                        <span className="mb-1.5 block text-[13px] text-slate-500">שם משפחה (יוצג באתר)</span>
                                                        <input type="text" value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="למשל: לוי" className={inputCls} />
                                                    </label>
                                                    <label className="block">
                                                        <span className="mb-1.5 block text-[13px] text-slate-500">טלפון (גלוי רק להנהלה)</span>
                                                        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="050-1234567" className={inputCls} />
                                                    </label>
                                                </div>

                                                <div className="flex flex-col gap-4">
                                                    <div className="flex-1">
                                                        <span className="mb-1.5 block text-[13px] text-slate-500">התמונה שלכן לאתגר</span>
                                                        <div
                                                            onClick={() => document.getElementById('challenge-input')?.click()}
                                                            className={`group relative flex h-32 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed bg-rose-50/30 transition ${entryImage ? 'border-plum-400' : 'border-rose-200 hover:border-plum-300'}`}
                                                        >
                                                            {entryImage ? (
                                                                <div className="relative h-full w-full">
                                                                    <img src={entryImage} className="h-full w-full object-cover" alt="Preview" />
                                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                                                                        <Camera className="text-white" size={24} />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-plum-500 shadow-soft">
                                                                        <Camera size={20} />
                                                                    </div>
                                                                    <p className="text-[13px] text-slate-500">לחצי לבחירת תמונה</p>
                                                                </>
                                                            )}
                                                            <input id="challenge-input" type="file" accept="image/*" className="hidden" onChange={(e) => handleImageChange(e, false)} />
                                                        </div>
                                                    </div>

                                                    <button onClick={handleChallengeSubmit} disabled={isSubmitting} className="btn-primary w-full !py-3.5 disabled:opacity-50">
                                                        {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} className="rotate-180" />}
                                                        שליחת התמונה
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* גלריית התמונות של האתגר */}
                                <div className="p-6 md:p-10">
                                    <div className="mb-5 flex items-end justify-between">
                                        <div>
                                            <p className="eyebrow">הגלריה</p>
                                            <h4 className="font-display text-[1.8rem] leading-tight text-ink">המשפחות שהשתתפו</h4>
                                        </div>
                                        <span className="rounded-full bg-rose-50 px-3 py-1 text-[13px] text-rose-700">{currentEntries.length} משתתפות</span>
                                    </div>

                                    {currentEntries.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5">
                                            {currentEntries.map((entry, idx) => (
                                                <ScrollReveal key={idx} delay={(idx % 10) * 50} animation="scale-in">
                                                  <div className="group relative aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-rose-50 shadow-soft">
                                                    <img src={entry.image} alt={entry.familyName} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                                    <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-plum-950/80 via-transparent to-transparent p-3">
                                                        <p className="truncate text-[13.5px] text-white font-strong">
                                                            {/* תיקון באג ה-"משפחת משפחת" - אם כבר כתבה משפחת לא נוסיף */}
                                                            {entry.familyName.startsWith('משפחת') ? entry.familyName : `משפחת ${entry.familyName}`}
                                                        </p>
                                                        {user?.isAdmin && (
                                                            <p className="mt-0.5 text-left text-[10.5px] text-plum-100" dir="ltr">{entry.phone}</p>
                                                        )}
                                                    </div>
                                                  </div>
                                                </ScrollReveal>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-[1.5rem] border border-dashed border-rose-200 bg-rose-50/30 py-10 text-center text-[15px] text-slate-500">
                                            הגלריה ריקה. תהיי הראשונה להעלות!
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
      {/* מודל הגרלה חיה נשאר תיאטרלי וכהה (dramatic reveal) — לחיצה על הרקע סוגרת */}
      {selectedLottery && (
        <Portal>
          <div dir="rtl" className="fixed inset-0 z-[300] flex items-center justify-center bg-plum-950/90 p-4 backdrop-blur-md animate-fade-in" onClick={() => setSelectedLottery(null)}>
              <div className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setSelectedLottery(null)} aria-label="סגירה" className="absolute -top-12 right-0 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"><X size={20} /></button>

                  <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-plum-900 via-rose-900 to-plum-950 shadow-2xl">
                      <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-rose-400/30 blur-3xl animate-mesh-drift" />

                      <div className="relative z-10 flex min-h-[360px] flex-col items-center justify-center p-8 text-center md:p-10">
                          <div className="mb-6">
                              <span className="mb-2 block font-accent text-[1.4rem] tracking-wide text-rose-300">הגרלה חיה</span>
                              <h3 className="text-[1.8rem] md:text-[2.2rem] leading-tight !text-white">{selectedLottery.title}</h3>
                          </div>

                          {!showWinner && !isDrawing && !selectedLottery.winnerId && (
                              <div className="w-full space-y-6 animate-fade-in">
                                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-white/5 animate-float-y">
                                    <Gift size={36} className="text-rose-300" />
                                  </div>
                                  {user?.isAdmin ? (
                                      <div className="space-y-4">
                                          <p className="text-[15px] text-rose-100">מוכנה להפעיל?</p>
                                          <button onClick={simulateDraw} className="w-full rounded-full bg-gradient-to-l from-champagne-300 via-rose-400 to-rose-500 px-6 py-4 text-lg text-white shadow-lift transition active:scale-95 font-strong">
                                              הפעלת ההגרלה
                                          </button>
                                      </div>
                                  ) : (
                                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                          <Loader2 size={24} className="mx-auto mb-3 animate-spin text-rose-300" />
                                          <p className="text-[14.5px] text-white/80">המנהלת עוד לא הפעילה…</p>
                                      </div>
                                  )}
                              </div>
                          )}

                          {isDrawing && (
                              <div className="space-y-6 animate-fade-in">
                                  <div className="font-accent text-[7rem] leading-none text-transparent bg-clip-text bg-gradient-to-b from-white via-rose-200 to-rose-400 animate-pulse">
                                      {countdown}
                                  </div>
                                  <p className="text-[15px] tracking-wide text-rose-200 animate-bounce">מערבבות שמות…</p>
                              </div>
                          )}

                          {(showWinner || selectedLottery.winnerId) && (
                              <div className="w-full space-y-6 animate-scale-in">
                                  <Trophy size={76} className="mx-auto text-champagne-300 drop-shadow-lg animate-bounce" />
                                  <div>
                                      <p className="mb-2 text-[13px] text-rose-200">יש לנו זוכה!</p>
                                      <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-md">
                                          <h2 className="text-[1.6rem] !text-white">
                                              {selectedLottery.winnerId === 'No Participants' ? 'אין משתתפות' : 'חברת המעגל המאושרת'}
                                          </h2>
                                      </div>
                                  </div>
                                  <button onClick={() => setSelectedLottery(null)} className="w-full rounded-full bg-white py-3 text-[15px] text-plum-900 transition hover:bg-rose-50 font-strong">
                                      סגירה
                                  </button>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
        </Portal>
      )}

    </PageShell>
  );
};

export default LotteryPage;
