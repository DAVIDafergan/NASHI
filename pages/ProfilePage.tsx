import React, { useState } from 'react';
import { User, Award, Star, Settings, QrCode, TrendingUp, Heart, Calendar, Edit2, Save, X, Camera, HeartHandshake, Lock, ClipboardList, CheckCircle2, Target, Clock } from 'lucide-react'; // נוספו אייקונים
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { UserLevel, EventItem, LotteryItem } from '../types'; // הוספת LotteryItem
import { Link } from 'react-router-dom';
import { api } from '../services/api'; // ייבוא ה-API לסנכרון משימות

interface ProfilePageProps {
    user: User;
    events?: EventItem[];
    lotteries?: LotteryItem[]; // הוספת הגרלות לפרופס
    onUpdateUser?: (updatedUser: User) => void;
    onUpdateLottery?: (l: LotteryItem) => void; // הוספת פונקציית עדכון
}

const mockData = [
  { name: 'ינו', points: 20 },
  { name: 'פבר', points: 45 },
  { name: 'מרץ', points: 30 },
  { name: 'אפר', points: 80 },
  { name: 'מאי', points: 55 },
];

const predefinedAvatars = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Annie',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Jane',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Willow',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Zoey',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Bella',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Molly',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucy',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie'
];

const ProfilePage: React.FC<ProfilePageProps> = ({ user, events = [], lotteries = [], onUpdateUser, onUpdateLottery }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(user);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const nextLevelPoints = 300;
  const progress = Math.min((user.points / nextLevelPoints) * 100, 100);
  const likedEvents = events.filter(e => user.likedEventIds?.includes(e.id));

  // סינון משימות פעילות - הגרלות מסוג משימה שהמשתמשת התחילה אך טרם סיימה
  const activeMissions = lotteries.filter(l => 
    l.participationType === 'mission' && 
    l.missionStarted?.includes(user.id || user._id) && 
    !l.participants.includes(user.id || user._id) &&
    new Date(l.drawDate) > new Date()
  );

  // Determine colors based on level
  const getLevelStyle = (level: UserLevel) => {
      switch(level) {
          case UserLevel.AMBASSADOR: return 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-orange-200';
          case UserLevel.LEADER: return 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-indigo-200';
          case UserLevel.CREATOR: return 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-rose-200';
          case UserLevel.ACTIVE: return 'bg-gradient-to-r from-emerald-400 to-green-600 text-white shadow-emerald-200';
          default: return 'bg-slate-200 text-slate-700';
      }
  };

  const handleSave = () => {
      if (onUpdateUser) {
          onUpdateUser(editForm);
      }
      setIsEditing(false);
  };

  const handleAvatarSelect = (url: string) => {
      setEditForm({...editForm, avatar: url});
      setShowAvatarPicker(false);
  };

  // פונקציה לסיום משימה מהפרופיל
  const handleCompleteMission = async (lotteryId: string) => {
      try {
          const res = await api.completeLotteryMission(lotteryId);
          if (res && onUpdateLottery) {
              const lottery = lotteries.find(l => (l.id === lotteryId || l._id === lotteryId));
              if (lottery) {
                  onUpdateLottery({
                      ...lottery,
                      participants: [...lottery.participants, (user.id || user._id)]
                  });
                  alert("אשריך! המשימה עודכנה ונכנסת להגרלה.");
              }
          }
      } catch (err) {
          alert("שגיאה בעדכון המשימה");
      }
  };

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto pb-10 text-right" dir="rtl">
      
      {/* Header & Edit Section */}
      <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-slate-100 relative overflow-visible">
        <div className="flex flex-col md:flex-row gap-8 items-center md:items-start relative z-10">
          
          {/* Avatar Section */}
          <div className="relative group">
            <div className={`w-32 h-32 rounded-full border-4 border-white shadow-xl overflow-hidden ${isEditing ? 'cursor-pointer ring-4 ring-rose-100' : ''}`}
                 onClick={() => isEditing && setShowAvatarPicker(!showAvatarPicker)}>
               <img src={isEditing ? editForm.avatar : user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Annie'} alt="Profile" className="w-full h-full object-cover bg-rose-50" />
               {isEditing && (
                   <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                       <Camera size={24} />
                   </div>
               )}
            </div>
            
            {/* Avatar Picker Popup */}
            {showAvatarPicker && isEditing && (
                <div className="absolute top-full right-0 mt-2 bg-white p-4 rounded-2xl shadow-2xl border border-slate-100 z-50 w-64 grid grid-cols-4 gap-2 animate-fade-in-up">
                    {predefinedAvatars.map((url, i) => (
                        <button key={i} onClick={() => handleAvatarSelect(url)} className="w-12 h-12 rounded-full overflow-hidden hover:scale-110 transition-transform border border-slate-200">
                            <img src={url} className="w-full h-full" />
                        </button>
                    ))}
                </div>
            )}
          </div>

          {/* Info Section */}
          <div className="flex-1 w-full text-center md:text-right space-y-4">
             {isEditing ? (
                 <div className="grid md:grid-cols-2 gap-4 animate-fade-in-up">
                     <div className="space-y-1 text-right">
                         <label className="text-xs font-bold text-slate-500">שם מלא</label>
                         <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-right" />
                     </div>
                     <div className="space-y-1 text-right">
                         <label className="text-xs font-bold text-slate-500">טלפון</label>
                         <input type="text" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-right" />
                     </div>
                     <div className="space-y-1 text-right">
                         <label className="text-xs font-bold text-slate-500">אימייל</label>
                         <input type="text" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-right" />
                     </div>
                     <div className="space-y-1 text-right">
                         <label className="text-xs font-bold text-slate-500">כתובת</label>
                         <input type="text" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-right" />
                     </div>
                 </div>
             ) : (
                <>
                    <div className="flex flex-col md:flex-row items-center gap-3 justify-center md:justify-start">
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900">{user.name}</h2>
                        <span className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-md ${getLevelStyle(user.level)}`}>
                            {user.level}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2 md:gap-4 justify-center md:justify-start text-slate-500 text-sm">
                        <span>{user.email}</span>
                        <span className="hidden md:inline">•</span>
                        <span>{user.phone}</span>
                        <span className="hidden md:inline">•</span>
                        <span>{user.address || 'לא צויינה כתובת'}</span>
                    </div>
                </>
             )}
             
             {/* מדד התקדמות - מופיע רק למאושרות */}
             {!isEditing && user.isMemberApproved && (
                <div className="mt-4 max-w-md w-full mx-auto md:mx-0">
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                    <span>{user.points} נקודות</span>
                    <span>{nextLevelPoints} ליעד הבא</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-rose-400 to-purple-500 transition-all duration-1000 shadow-[0_0_10px_rgba(244,63,94,0.5)]" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
             )}
          </div>

          <div className="flex gap-2 self-start absolute top-0 left-0 md:relative">
             {isEditing ? (
                 <div className="flex gap-2">
                     <button onClick={() => setIsEditing(false)} className="p-3 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors"><X size={20} /></button>
                     <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800"><Save size={18} /> שמירה</button>
                 </div>
             ) : (
                <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors font-medium border border-transparent hover:border-rose-100">
                    <Edit2 size={18} />
                    <span className="hidden md:inline">עריכת פרטים</span>
                </button>
             )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
            {/* Digital Card */}
            <div className={`rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500 ${user.isMemberApproved ? (user.level === UserLevel.AMBASSADOR ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-slate-800 to-slate-900') : 'bg-slate-400 grayscale'}`}>
                <div className="flex justify-between items-start mb-8 relative z-10">
                    <div>
                        <p className="text-xs opacity-70 tracking-[0.2em] font-medium mb-1">כרטיס תושבת</p>
                        <h3 className="text-2xl font-black tracking-wide">נשי קארד</h3>
                    </div>
                    <Heart className="text-white/20 fill-current drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" size={40} />
                </div>
                <div className="flex justify-between items-end relative z-10">
                    <div>
                        <p className="text-xs opacity-60 mb-1">שם בעלת הכרטיס</p>
                        <p className="font-bold tracking-wider text-lg">{user.name}</p>
                    </div>
                    <QrCode size={56} className="bg-white text-slate-900 p-1.5 rounded-lg" />
                </div>
                {/* Decorative circles */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-white/20 transition-colors"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10"></div>
            </div>

            {/* Missions Section - חדש: המשימות הפעילות שלי */}
            {user.isMemberApproved && activeMissions.length > 0 && (
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-orange-100 animate-fade-in">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-orange-600">
                        <Target size={20} className="animate-pulse" />
                        משימות בביצוע ({activeMissions.length})
                    </h3>
                    <div className="space-y-4">
                        {activeMissions.map(mission => (
                            <div key={mission.id || mission._id} className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100 space-y-3">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-black text-slate-800 text-sm">{mission.title}</h4>
                                    <div className="flex items-center gap-1 text-[10px] text-orange-600 bg-white px-2 py-1 rounded-full shadow-sm">
                                        <Clock size={10} />
                                        עד: {new Date(mission.drawDate).toLocaleDateString('he-IL')}
                                    </div>
                                </div>
                                <p className="text-xs text-slate-600 font-medium leading-relaxed bg-white/50 p-3 rounded-xl">
                                    {mission.missionText}
                                </p>
                                <button 
                                    onClick={() => handleCompleteMission(mission._id || mission.id)}
                                    className="w-full py-2.5 bg-orange-500 text-white rounded-xl text-xs font-black shadow-md shadow-orange-200 hover:bg-orange-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <CheckCircle2 size={14} /> סיימתי את המשימה!
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

             {/* Liked Events Section */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 min-h-[300px]">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800">
                    <Heart size={20} className="text-rose-500 fill-current" />
                    אירועים שאהבתי ({likedEvents.length})
                </h3>
                {likedEvents.length > 0 ? (
                    <div className="space-y-3">
                        {likedEvents.map(event => (
                            <div key={event.id} className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 hover:border-rose-200 transition-colors group">
                                <img src={event.image} className="w-16 h-16 rounded-xl object-cover shadow-sm" />
                                <div className="flex-1">
                                    <h4 className="font-bold text-sm text-slate-800 line-clamp-1 group-hover:text-rose-600 transition-colors">{event.title}</h4>
                                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                                        <Calendar size={12} />
                                        <span>{new Date(event.date).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200 h-full">
                        <Heart size={32} className="mb-2 opacity-20" />
                        <p>לא סימנת אירועים עדיין</p>
                    </div>
                )}
            </div>
        </div>

        {/* Benefits & History */}
        <div className="space-y-6">
             <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 h-full flex flex-col">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800">
                    <Award size={20} className="text-yellow-500" />
                    ההטבות שלי
                </h3>
                
                {user.isMemberApproved ? (
                  /* תצוגה למאושרות */
                  <ul className="space-y-3 flex-1">
                      {[
                      { text: '10% הנחה בחוגי העשרה', active: true },
                      { text: 'כניסה חינם למוזיאון העיר', active: true },
                      { text: 'קדימות ברכישת כרטיסים למופעים', active: user.level !== UserLevel.BEGINNER },
                      { text: 'הזמנה לאירועי VIP', active: user.level === UserLevel.AMBASSADOR || user.level === UserLevel.LEADER },
                      ].map((item, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                          <div className={`w-2.5 h-2.5 rounded-full ${item.active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-slate-300'}`}></div>
                          <span className={`font-medium ${item.active ? 'text-slate-700' : 'text-slate-400 line-through'}`}>{item.text}</span>
                      </li>
                      ))}
                  </ul>
                ) : (
                  /* באנר הצטרפות למי שלא אושרה */
                  <div className="flex-1 flex flex-col items-center justify-center space-y-6 bg-slate-50 rounded-3xl p-8 border border-dashed border-slate-200 text-center">
                      <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center text-rose-500">
                        <Lock size={32} />
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-black text-slate-800">הטבות המעגל חסומות</h4>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">
                          {user.isMemberRequested 
                            ? "בקשתך בטיפול. מיד לאחר אישור המנהלת, כל ההטבות והנקודות יופיעו כאן עבורך!" 
                            : "הצטרפי למעגל הנשי של העיר כדי להתחיל לצבור נקודות וליהנות מהטבות בלעדיות."}
                        </p>
                      </div>
                      {!user.isMemberRequested && (
                        <Link to="/" className="bg-rose-600 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-lg hover:bg-rose-700 transition-all flex items-center gap-2">
                          <HeartHandshake size={18} /> הצטרפי למעגל עכשיו
                        </Link>
                      )}
                  </div>
                )}
            </div>

            {/* גרף צבירה - מופיע רק למאושרות */}
            {user.isMemberApproved && (
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800">
                      <TrendingUp size={20} className="text-purple-500" />
                      צבירת נקודות שנתית
                  </h3>
                  <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={mockData}>
                          <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                          <YAxis hide />
                          <Tooltip 
                              cursor={{fill: '#f1f5f9'}} 
                              contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                          />
                          <Bar dataKey="points" radius={[6, 6, 6, 6]}>
                              {mockData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === mockData.length - 1 ? '#e11d48' : '#e2e8f0'} />
                              ))}
                          </Bar>
                      </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;