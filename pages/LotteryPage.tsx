import React, { useState, useEffect } from 'react';
import { Gift, Calendar, Award, Star, Trophy, Users, CheckCircle, CheckCircle2, Ticket, Loader2, X, Sparkles, Share2, Info, Lock } from 'lucide-react';
import { LotteryItem, User } from '../types';
import { useLocation } from 'react-router-dom';

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

  // Handle Admin triggering a live draw from AdminPage
  useEffect(() => {
      if (location.state && location.state.liveLotteryId) {
          const targetLottery = lotteries.find(l => (l.id === location.state.liveLotteryId || l._id === location.state.liveLotteryId));
          if (targetLottery) {
              handleOpenDraw(targetLottery);
          }
      }
  }, [location.state, lotteries]);
  
  const handleEnterLottery = (lottery: any) => {
      if (!user) {
          alert('יש להתחבר למערכת כדי להשתתף בהגרלה!');
          return;
      }

      // בדיקת חסימה - האם כבר רשומה
      if (lottery.participants.includes(user.id || user._id)) {
          alert('את כבר רשומה להגרלה זו!');
          return;
      }

      // בדיקת זכאות לפי הגדרות מנהל
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
      
      // Automatic Registration (No Confirm Dialog)
      if (onUpdateUser && onUpdateLottery) {
          // הורדת נקודות אם הוגדר (אופציונלי - תלוי אם המנהל רוצה "תשלום" בנקודות או רק סף כניסה)
          // נכון לעכשיו זה רק בודק סף, אם תרצה להוריד נקודות בפועל - השורה למטה מבצעת זאת:
          const newPoints = lottery.participationType === 'points' ? user.points : user.points; 

          onUpdateUser({
              ...user,
              points: newPoints
          });
          onUpdateLottery({
              ...lottery,
              participants: [...lottery.participants, (user.id || user._id)]
          });
          
          alert('🎉 נרשמת בהצלחה להגרלה! הודעה תישלח אליך במידה ותזכי.');
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

  const simulateDraw = () => {
      if (!selectedLottery || !onUpdateLottery) return;
      setIsDrawing(true);
      setShowWinner(false);

      // Countdown effect
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
          
          // Pick winner from participants list
          const winnerId = selectedLottery.participants.length > 0 
                ? selectedLottery.participants[Math.floor(Math.random() * selectedLottery.participants.length)]
                : 'No Participants';
          
          onUpdateLottery({
              ...selectedLottery,
              isActive: false,
              winnerId: winnerId
          });

      }, 3500); // Wait for countdown (3s) + a little buffer
  };

  return (
    <div className="space-y-8 pb-10 text-right" dir="rtl">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 px-2">
        {lotteries.map((lottery: any) => {
            const isRegistered = user && lottery.participants.includes(user.id || user._id);
            const drawDatePassed = new Date(lottery.drawDate) < new Date();
            const canParticipate = lottery.participationType === 'everyone' || (user && user.points >= (lottery.minPointsToEnter || 0));
            
            return (
                <div key={lottery.id || lottery._id} className={`bg-white rounded-[2.5rem] p-3 shadow-sm border border-slate-100 hover:shadow-2xl transition-all duration-500 flex flex-col group relative overflow-hidden ${!lottery.isActive ? 'opacity-80' : ''}`}>
                    {/* Header Image */}
                    <div className="h-56 relative overflow-hidden rounded-[2rem] mb-5 shrink-0 shadow-inner bg-slate-50">
                        <img src={lottery.image} alt={lottery.title} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                        
                        {/* Eligibility Badge */}
                        <div className="absolute top-4 right-4 flex flex-col gap-2">
                            <div className="bg-white/95 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black text-rose-600 flex items-center gap-1.5 shadow-xl border border-rose-50">
                                <Star size={12} className="fill-rose-500 text-rose-500" />
                                {lottery.participationType === 'everyone' ? 'פתוח לכולן' : `${lottery.minPointsToEnter} נקודות`}
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
                    
                    {/* Content Section */}
                    <div className="px-4 pb-4 flex-1 flex flex-col text-right">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xl font-black text-slate-800 leading-tight group-hover:text-rose-600 transition-colors">{lottery.title}</h3>
                            {lottery.isActive && <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>}
                        </div>

                        {/* Prizes List */}
                        <div className="space-y-2 mb-6 bg-rose-50/30 p-4 rounded-2xl border border-rose-100/50">
                            <p className="text-rose-600 font-black text-sm flex items-center gap-2">
                                <Trophy size={16} className="text-amber-500" />
                                פרס ראשון: {lottery.prize}
                            </p>
                            {lottery.prize2 && (
                                <p className="text-slate-600 font-bold text-xs flex items-center gap-2 pr-1">
                                    <Award size={14} className="text-slate-400" />
                                    פרס שני: {lottery.prize2}
                                </p>
                            )}
                            {lottery.prize3 && (
                                <p className="text-slate-600 font-bold text-xs flex items-center gap-2 pr-1">
                                    <Award size={14} className="text-slate-300" />
                                    פרס שלישי: {lottery.prize3}
                                </p>
                            )}
                        </div>
                        
                        {/* Stats Row */}
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

                        {/* Action Button */}
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
                                    {canParticipate ? 'הירשמי להגרלה עכשיו' : `חסרות לך נקודות`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            );
        })}
      </div>

      {/* Premium Live Draw Modal (רולטה יוקרתית) */}
      {selectedLottery && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl animate-fade-in">
              <div className="w-full max-w-xl relative">
                  <button onClick={() => setSelectedLottery(null)} className="absolute -top-16 right-0 md:-right-16 p-3 bg-white/10 rounded-full hover:bg-white/20 text-white transition-all"><X size={24} /></button>
                  
                  <div className="bg-gradient-to-b from-indigo-950 via-purple-900 to-slate-950 rounded-[3.5rem] overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(139,92,246,0.3)] relative">
                      {/* Background Particles Decoration */}
                      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 animate-pulse"></div>
                      <div className="absolute -top-24 -left-24 w-64 h-64 bg-rose-500/20 rounded-full blur-[80px]"></div>
                      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px]"></div>
                      
                      <div className="p-10 md:p-14 text-center relative z-10 min-h-[500px] flex flex-col items-center justify-center">
                          
                          {/* Title */}
                          <div className="mb-10">
                              <span className="text-rose-400 text-[10px] font-black tracking-[0.3em] uppercase mb-3 block">Live Drawing Event</span>
                              <h3 className="text-3xl md:text-4xl font-black text-white leading-tight tracking-tight">{selectedLottery.title}</h3>
                          </div>

                          {/* STATE 1: Ready to Draw */}
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

                          {/* STATE 2: Drawing Animation (The Roulette Effect) */}
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

                          {/* STATE 3: Winner Reveal */}
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
                                              {/* כאן בקוד האמיתי תהיה פונקציה ששולפת את שם המשתמשת לפי ה-ID */}
                                              {selectedLottery.winnerId === 'No Participants' ? 'אין משתתפות' : 'חברת המעגל'}
                                          </h2>
                                          <div className="flex items-center justify-center gap-2 text-yellow-400 bg-yellow-400/10 py-2 px-4 rounded-full w-fit mx-auto border border-yellow-400/20">
                                              <Sparkles size={16} fill="currentColor" />
                                              <span className="font-black text-sm uppercase">מזל טוב על הזכייה!</span>
                                          </div>
                                      </div>
                                  </div>

                                  <div className="pt-6">
                                      <p className="text-white/60 text-sm font-medium mb-4">הפרס: <span className="text-white font-black">{selectedLottery.prize}</span></p>
                                      <button onClick={() => setSelectedLottery(null)} className="bg-white text-slate-950 px-10 py-4 rounded-2xl font-black text-sm hover:bg-rose-500 hover:text-white transition-all shadow-xl">
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
                  
                  {/* Decorative Confetti Elements */}
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

      {lotteries.length === 0 && (
          <div className="text-center py-32 bg-white/50 rounded-[3rem] border border-dashed border-rose-200">
            <Gift size={48} className="text-rose-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold">אין הגרלות פעילות כרגע. חזרי לבדוק בקרוב!</p>
            <button onClick={() => window.location.hash = '/'} className="mt-4 text-rose-500 text-xs font-black hover:underline">חזרה לדף הבית</button>
          </div>
      )}
    </div>
  );
};

export default LotteryPage;