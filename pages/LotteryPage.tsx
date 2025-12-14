import React, { useState, useEffect } from 'react';
import { Gift, Calendar, Award, Star, Trophy, Users, CheckCircle, CheckCircle2, Ticket, Loader2, X, Sparkles, Share2 } from 'lucide-react';
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
          const targetLottery = lotteries.find(l => l.id === location.state.liveLotteryId);
          if (targetLottery) {
              handleOpenDraw(targetLottery);
          }
      }
  }, [location.state, lotteries]);
  
  const handleEnterLottery = (lottery: LotteryItem) => {
      if (!user) {
          alert('יש להתחבר כדי להשתתף בהגרלה');
          return;
      }
      if (lottery.participants.includes(user.id)) {
          return;
      }
      if (user.points < (lottery.minPointsToEnter || 0)) {
          alert(`אין לך מספיק נקודות. חסרות לך ${(lottery.minPointsToEnter || 0) - user.points} נקודות.`);
          return;
      }
      
      // Automatic Registration (No Confirm Dialog)
      if (onUpdateUser && onUpdateLottery) {
          onUpdateUser({
              ...user,
              points: user.points - (lottery.minPointsToEnter || 0)
          });
          onUpdateLottery({
              ...lottery,
              participants: [...lottery.participants, user.id]
          });
          // Optional: Show a toast or small visual cue instead of alert, but for now simple alert is safer
          // alert('נרשמת להגרלה בהצלחה!');
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
          
          // Pick winner
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
    <div className="space-y-8 pb-10">
      <div className="text-center space-y-2 py-6">
        <h2 className="text-3xl font-black text-slate-800">הגרלות והטבות</h2>
        <p className="text-slate-600 max-w-xl mx-auto text-sm md:text-base">השתמשי בנקודות שצברת כדי להשתתף בהגרלות שוות במיוחד! כל נקודה מקרבת אותך לזכייה.</p>
        {user && (
            <div className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-700 px-4 py-2 rounded-full font-bold mt-4 border border-yellow-200 text-sm">
                <Star size={16} fill="currentColor" />
                יתרת הנקודות שלך: {user.points}
            </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {lotteries.map((lottery) => {
            const isRegistered = user && lottery.participants.includes(user.id);
            const drawDatePassed = new Date(lottery.drawDate) < new Date();
            
            return (
                <div key={lottery.id} className="bg-white rounded-[2rem] p-2 shadow-sm border border-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group relative">
                    <div className="h-48 relative overflow-hidden rounded-[1.5rem] mb-3 shrink-0">
                        <img src={lottery.image} alt={lottery.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-rose-600 flex items-center gap-1 shadow-sm">
                            <Star size={10} fill="currentColor" />
                            {lottery.minPointsToEnter} נקודות
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleShare(lottery); }}
                            className="absolute top-3 left-3 bg-white/30 backdrop-blur-md p-2 rounded-full text-white hover:bg-white hover:text-rose-500 transition-colors shadow-sm"
                        >
                            <Share2 size={16} />
                        </button>
                    </div>
                    
                    <div className="px-2 pb-2 flex-1 flex flex-col">
                        <h3 className="text-lg font-black text-slate-800 mb-1 leading-tight">{lottery.title}</h3>
                        <p className="text-rose-500 font-medium text-xs mb-4 flex items-center gap-1">
                            <Gift size={12} />
                            {lottery.prize}
                        </p>
                        
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <div className="flex flex-col items-center justify-center gap-1 text-[10px] text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                <Calendar size={14} className="text-slate-400" />
                                <span className="font-bold text-slate-700">{new Date(lottery.drawDate).toLocaleDateString()}</span>
                            </div>
                            <div className="flex flex-col items-center justify-center gap-1 text-[10px] text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                <Users size={14} className="text-slate-400" />
                                <span className="font-bold text-slate-700">{lottery.participants.length} משתתפות</span>
                            </div>
                        </div>

                        <div className="mt-auto space-y-3">
                            {user?.isAdmin ? (
                                <button 
                                    onClick={() => handleOpenDraw(lottery)}
                                    className="w-full py-3 rounded-full font-bold text-xs transition-colors flex items-center justify-center gap-2 bg-slate-900 text-white shadow-lg hover:shadow-slate-300 active:scale-95"
                                >
                                    <Sparkles size={14} className="text-yellow-400" />
                                    {lottery.winnerId ? 'צפייה בתוצאות' : 'ניהול הגרלה (Live)'}
                                </button>
                            ) : (!lottery.isActive || lottery.winnerId) ? (
                                <button 
                                    onClick={() => handleOpenDraw(lottery)}
                                    className="w-full py-3 rounded-full font-bold text-xs transition-colors flex items-center justify-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200"
                                >
                                    <Trophy size={14} />
                                    צפייה בתוצאות
                                </button>
                            ) : isRegistered ? (
                                <button disabled className="w-full py-3 rounded-full font-bold text-xs bg-green-50 text-green-700 flex items-center justify-center gap-2 cursor-default border border-green-100">
                                    <CheckCircle2 size={14} />
                                    נרשמת בהצלחה!
                                </button>
                            ) : (
                                <button 
                                    onClick={() => handleEnterLottery(lottery)}
                                    className="w-full py-3 rounded-full font-bold text-xs transition-colors flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:shadow-lg hover:shadow-rose-200 active:scale-95"
                                >
                                    <Ticket size={14} />
                                    הירשמי להגרלה (אוטומטי)
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            );
        })}
      </div>

      {/* Premium Live Draw Modal */}
      {selectedLottery && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
              <div className="w-full max-w-lg relative">
                  <button onClick={() => setSelectedLottery(null)} className="absolute -top-12 right-0 p-2 bg-white/10 rounded-full hover:bg-white/20 text-white transition-colors"><X size={24} /></button>
                  
                  <div className="bg-gradient-to-b from-indigo-900 via-purple-900 to-slate-900 rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl relative">
                      {/* Background Effects */}
                      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse"></div>
                      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-black/60"></div>
                      
                      <div className="p-8 md:p-12 text-center relative z-10 min-h-[450px] flex flex-col items-center justify-center">
                          
                          {/* Header */}
                          <div className="mb-8">
                              <span className="text-purple-300 text-xs font-bold tracking-[0.2em] uppercase mb-2 block">Live Draw Event</span>
                              <h3 className="text-2xl md:text-3xl font-black text-white leading-tight">{selectedLottery.title}</h3>
                          </div>

                          {/* STATE 1: Ready to Draw (Admin Only) or Waiting (User) */}
                          {!showWinner && !isDrawing && !selectedLottery.winnerId && (
                              <div className="space-y-8 w-full">
                                  <Gift size={80} className="text-white/20 mx-auto" />
                                  {user?.isAdmin ? (
                                      <>
                                          <p className="text-purple-200 font-medium">ההגרלה מוכנה. לחצי להפעלה!</p>
                                          <button onClick={simulateDraw} className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-8 py-5 rounded-2xl font-black text-xl shadow-xl shadow-orange-500/30 hover:scale-105 transition-transform">
                                              התחלת הגרלה
                                          </button>
                                      </>
                                  ) : (
                                      <p className="text-white/60 font-medium">ההגרלה טרם בוצעה. התוצאות יפורסמו בקרוב.</p>
                                  )}
                              </div>
                          )}

                          {/* STATE 2: Drawing Animation */}
                          {isDrawing && (
                              <div className="space-y-6">
                                  <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-purple-400 animate-bounce">
                                      {countdown}
                                  </div>
                                  <p className="text-purple-200 font-bold animate-pulse">בוחרים את הזוכה...</p>
                              </div>
                          )}

                          {/* STATE 3: Winner Reveal */}
                          {(showWinner || selectedLottery.winnerId) && (
                              <div className="space-y-8 animate-scale-in w-full">
                                  <div className="relative">
                                      <div className="absolute inset-0 bg-yellow-500 blur-3xl opacity-20 rounded-full"></div>
                                      <Trophy size={100} className="text-yellow-400 mx-auto drop-shadow-[0_10px_20px_rgba(234,179,8,0.5)] relative z-10" />
                                  </div>
                                  
                                  <div>
                                      <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">הזוכה המאושרת היא</p>
                                      <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-3xl">
                                        <h2 className="text-3xl md:text-4xl font-black text-white mb-2">
                                            {selectedLottery.winnerId === '1' ? 'דנה כהן' : 
                                            selectedLottery.winnerId === '2' ? 'מיכל לוי' : 'אורחת'}
                                        </h2>
                                        <div className="flex items-center justify-center gap-2 text-yellow-400">
                                            <Star size={16} fill="currentColor" />
                                            <span className="font-bold text-sm">חברת מועדון {selectedLottery.winnerId === '2' ? 'מובילה' : 'פעילה'}</span>
                                        </div>
                                      </div>
                                  </div>
                                  
                                  {user?.isAdmin && (
                                     <p className="text-green-400 text-sm font-bold flex items-center justify-center gap-2">
                                         <CheckCircle2 size={16} /> ההגרלה נשמרה והודעה נשלחה.
                                     </p>
                                  )}
                              </div>
                          )}
                      </div>
                  </div>
                  
                  {/* Confetti Decoration (CSS based) */}
                  {(showWinner || selectedLottery.winnerId) && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[3rem]">
                          <div className="absolute top-10 left-10 w-4 h-4 bg-yellow-400 rounded-full animate-ping"></div>
                          <div className="absolute top-20 right-20 w-3 h-3 bg-rose-500 rounded-full animate-ping delay-100"></div>
                          <div className="absolute bottom-10 left-1/2 w-4 h-4 bg-purple-400 rounded-full animate-ping delay-200"></div>
                      </div>
                  )}
              </div>
          </div>
      )}

      {lotteries.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
              <p className="text-slate-500">אין הגרלות פעילות כרגע. חזרי בקרוב!</p>
          </div>
      )}
    </div>
  );
};

export default LotteryPage;