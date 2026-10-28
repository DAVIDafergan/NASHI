import React, { useState } from 'react';
import { User, Award, Star, Settings, QrCode, TrendingUp, Heart, Calendar, Edit2, Save, X, Camera, HeartHandshake, Lock, ClipboardList, CheckCircle2, Target, Clock, LogOut, Bookmark, Activity, Sparkles, ShieldCheck } from 'lucide-react'; // נוספו אייקונים
import { shareLink } from '../utils/share';
import { UserLevel, EventItem, LotteryItem } from '../types'; // הוספת LotteryItem
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api'; // ייבוא ה-API לסנכרון משימות
import ScrollReveal from '../components/ScrollReveal';
import { PageShell, EmptyState } from '../components/pages/PageKit';
import { BRAND } from '../shared/brand';
import { g } from '../shared/audience';

interface ProfilePageProps {
    user: User;
    events?: EventItem[];
    lotteries?: LotteryItem[]; // הוספת הגרלות לפרופס
    onUpdateUser?: (updatedUser: User) => void;
    onUpdateLottery?: (l: LotteryItem) => void; // הוספת פונקציית עדכון
    onLogout?: () => void;
}


// initials avatars in the site colours, from our own domain (no cartoon faces, no outside image hosts)
const avatarChoices = (name: string) => [0, 1, 2, 3, 4].map(c => `/api/avatar.svg?n=${encodeURIComponent(name || '')}&c=${c}`);

const ProfilePage: React.FC<ProfilePageProps> = ({ user, events = [], lotteries = [], onUpdateUser, onUpdateLottery, onLogout }) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(user);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'activity' | 'bookmarks'>('activity');

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

  const handleLogoutClick = () => {
      onLogout?.();
      navigate('/');
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

  const memberSinceLabel = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('he-IL', { year: 'numeric', month: 'short' })
    : null;

  const firstName = (user.name || '').split(' ')[0] || '';
  const gen = (user as any).gender;
  const inputCls = 'w-full min-h-[46px] rounded-2xl border border-rose-100 bg-rose-50/30 px-4 text-[15px] text-right outline-none transition focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-100/70';

  return (
    <PageShell className="!max-w-5xl">

      {/* כרטיס פרופיל עליון */}
      <header className="relative isolate pt-6 md:pt-12 pb-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-rose-200/40 blur-3xl animate-mesh-drift" />
          <div className="absolute top-10 left-[-4rem] h-64 w-64 rounded-full bg-champagne-200/50 blur-3xl animate-mesh-drift-slow" />
        </div>

        <div className="relative overflow-visible rounded-[2rem] border border-rose-100 bg-white/85 p-6 md:p-9 shadow-lift backdrop-blur animate-scale-in">
          <div className="relative z-10 flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-9">

            {/* Avatar Section */}
            <div className="relative group shrink-0">
              <div className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-rose-300 via-champagne-200 to-plum-200 animate-spin-slow opacity-80" aria-hidden="true" />
              <div className={`relative h-32 w-32 md:h-40 md:w-40 overflow-hidden rounded-full border-4 border-white shadow-lift ${isEditing ? 'cursor-pointer' : ''}`}
                   onClick={() => isEditing && setShowAvatarPicker(!showAvatarPicker)}>
                 <img src={isEditing ? editForm.avatar : user.avatar || `/api/avatar.svg?n=${encodeURIComponent(user.name || '')}`} alt="Profile" className="h-full w-full bg-rose-50 object-cover" />
                 {isEditing && (
                     <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white opacity-100 md:opacity-0 transition-opacity md:group-hover:opacity-100">
                         <Camera size={24} />
                     </div>
                 )}
              </div>

              {/* Avatar Picker Popup */}
              {showAvatarPicker && isEditing && (
                  <div className="absolute top-full right-1/2 translate-x-1/2 md:right-0 md:translate-x-0 z-50 mt-3 grid w-64 grid-cols-4 gap-2 rounded-[1.5rem] border border-rose-100 bg-white p-4 shadow-lift animate-fade-in-up">
                      {avatarChoices(user.name).map((url, i) => (
                          <button key={i} onClick={() => handleAvatarSelect(url)} className="h-12 w-12 overflow-hidden rounded-full border border-rose-100 transition-transform hover:scale-110">
                              <img src={url} className="h-full w-full" />
                          </button>
                      ))}
                  </div>
              )}
            </div>

            {/* Info Section */}
            <div className="w-full flex-1 space-y-4 text-center md:text-right">
               {isEditing ? (
                   <div className="grid gap-3 md:grid-cols-2 animate-fade-in-up">
                       <label className="block text-right">
                           <span className="mb-1 block text-[12.5px] text-slate-500">שם מלא</span>
                           <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className={inputCls} />
                       </label>
                       <label className="block text-right">
                           <span className="mb-1 block text-[12.5px] text-slate-500">טלפון</span>
                           <input type="text" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className={inputCls} />
                       </label>
                       <label className="block text-right">
                           <span className="mb-1 block text-[12.5px] text-slate-500">אימייל</span>
                           <input type="text" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className={inputCls} />
                       </label>
                       <label className="block text-right">
                           <span className="mb-1 block text-[12.5px] text-slate-500">כתובת</span>
                           <input type="text" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} className={inputCls} />
                       </label>
                       <label className="block text-right">
                           <span className="mb-1 block text-[12.5px] text-slate-500">אני (לא חובה — לפנייה במיילים)</span>
                           <select value={(editForm as any).gender || ''} onChange={e => setEditForm({ ...editForm, gender: e.target.value } as any)} className={inputCls}>
                               <option value="">לא צוין</option><option value="male">גבר</option><option value="female">אישה</option>
                           </select>
                       </label>
                       <div className="flex gap-2 md:col-span-2 pt-1">
                           <button onClick={handleSave} className="btn-primary flex-1"><Save size={17} /> שמירה</button>
                           <button onClick={() => setIsEditing(false)} className="btn-ghost"><X size={17} /> ביטול</button>
                       </div>
                   </div>
               ) : (
                  <>
                      <p className="eyebrow">האזור האישי</p>
                      <h1 className="text-[2.4rem] md:text-[3.2rem] leading-[1.02]">שלום, {firstName}</h1>
                      <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                          <span className={`rounded-full px-4 py-1.5 text-[13px] shadow-soft font-strong ${getLevelStyle(user.level)}`}>
                              {user.level}
                          </span>
                          <span className="text-[14.5px] text-slate-500">{user.occupation || user.email}</span>
                      </div>

                      {/* 3 Badges: נקודות / אירועים שאהבתי / חברה מאז */}
                      <div className="grid grid-cols-3 gap-2 max-w-md mx-auto md:mx-0">
                          <div className="rounded-2xl bg-rose-50/60 px-3 py-2.5 text-center">
                              <Star size={15} className="mx-auto text-rose-500" />
                              <p className="font-strong text-[1.15rem] text-ink leading-tight mt-1">{user.points}</p>
                              <p className="text-[11.5px] text-slate-500">נקודות</p>
                          </div>
                          <div className="rounded-2xl bg-rose-50/60 px-3 py-2.5 text-center">
                              <Heart size={15} className="mx-auto text-rose-400" />
                              <p className="font-strong text-[1.15rem] text-ink leading-tight mt-1">{likedEvents.length}</p>
                              <p className="text-[11.5px] text-slate-500">שמורים</p>
                          </div>
                          <div className="rounded-2xl bg-rose-50/60 px-3 py-2.5 text-center">
                              <Calendar size={15} className="mx-auto text-slate-400" />
                              <p className="font-strong text-[0.95rem] text-ink leading-tight mt-1.5 truncate">{memberSinceLabel || '—'}</p>
                              <p className="text-[11.5px] text-slate-500">{g(gen, { male: 'חבר מאז', female: 'חברה מאז', neutral: 'בקהילה מאז' })}</p>
                          </div>
                      </div>
                  </>
               )}

               {/* מדד התקדמות - מופיע רק למאושרות */}
               {!isEditing && (
                  <div className="mx-auto w-full max-w-md md:mx-0">
                      <div className="mb-1.5 flex justify-between text-[12.5px] text-slate-500">
                        <span>{user.points} נקודות</span>
                        <span>{nextLevelPoints} ליעד הבא</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-rose-50">
                        <div className="h-full rounded-full bg-gradient-to-l from-rose-600 via-rose-400 to-sage-400 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                      </div>
                  </div>
               )}

               {/* כפתורי פעולה */}
               {!isEditing && (
                 <div className="flex flex-wrap justify-center gap-2 pt-1 md:justify-start">
                    {(user.isAdmin || (user as any).role === 'regionAdmin') && (
                      <Link to="/admin" className="btn-primary"><ShieldCheck size={16} /> {user.isAdmin ? 'ניהול מערכת' : 'ניהול האזור שלי'}</Link>
                    )}
                    <button onClick={() => setIsEditing(true)} className="btn-ghost">
                        <Edit2 size={16} /> עריכת פרטים
                    </button>
                    {onLogout && (
                      <button onClick={handleLogoutClick} className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-5 py-2.5 text-[15px] text-red-500 transition hover:bg-red-50 font-strong">
                          <LogOut size={16} /> התנתקות
                      </button>
                    )}
                 </div>
               )}
            </div>
          </div>
        </div>
      </header>

      {/* טאבים: הפעילות שלי / הסימניות שלי */}
      <div className="mb-6 inline-flex rounded-full border border-rose-100 bg-white/80 p-1 shadow-soft" role="tablist">
        {[
          { key: 'activity' as const, label: 'הפעילות שלי', icon: Activity },
          { key: 'bookmarks' as const, label: 'אירועים ששמרתי', icon: Bookmark },
        ].map(tab => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-[14.5px] transition-all duration-300 ${
                activeTab === tab.key ? 'bg-plum-300 text-ink shadow-soft' : 'text-slate-500 hover:text-rose-700'
              }`}
            >
              <TabIcon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'activity' ? (
        <div className="grid gap-6 lg:grid-cols-2 animate-fade-in">
          <div className="space-y-6">
              {/* Digital Card */}
              <ScrollReveal delay={100} animation="scale-in">
                <div className={`group relative aspect-[1.6/1] overflow-hidden rounded-[1.75rem] p-6 md:p-8 text-white shadow-lift transition-transform duration-700 hover:-rotate-1 hover:scale-[1.02] ${true ? (user.level === UserLevel.AMBASSADOR ? 'bg-gradient-to-br from-champagne-400 via-champagne-500 to-rose-600' : 'bg-gradient-to-br from-plum-800 via-rose-800 to-plum-950') : 'bg-gradient-to-br from-slate-400 to-slate-500 grayscale'}`}>
                    <div className="relative z-10 flex h-full flex-col justify-between">
                      <div className="flex items-start justify-between">
                          <div>
                              <p className="mb-1 text-[12px] tracking-[0.18em] opacity-75">כרטיס חבר/ה</p>
                              <p className="font-accent text-[2.6rem] leading-none">{BRAND.name} קארד</p>
                          </div>
                          <Heart className="fill-current text-white/25" size={40} />
                      </div>
                      <div className="flex items-end justify-between">
                          <div>
                              <p className="mb-1 text-[12px] opacity-70">{g(gen, { male: 'בעל הכרטיס', female: 'בעלת הכרטיס', neutral: 'בעלי הכרטיס' })}</p>
                              <p className="font-strong text-[1.2rem] tracking-wide">{user.name}</p>
                              {false && <p className="mt-1 text-[12px] opacity-80">יופעל לאחר אישור החברות</p>}
                          </div>
                          <QrCode size={58} className="rounded-xl bg-white p-1.5 text-plum-900" />
                      </div>
                    </div>
                    {/* Decorative */}
                    <div className="absolute -top-16 -right-16 h-52 w-52 rounded-full bg-white/15 blur-3xl transition-colors group-hover:bg-white/25"></div>
                    <div className="absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-black/10 blur-2xl"></div>
                    <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-l from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full"></div>
                </div>
              </ScrollReveal>

              {/* Missions Section - המשימות הפעילות שלי */}
              {activeMissions.length > 0 && (
                  <ScrollReveal delay={150} className="rounded-[1.75rem] border border-champagne-100 bg-white p-6 shadow-petal">
                      <h3 className="mb-4 flex items-center gap-2 text-[1.15rem] text-champagne-700">
                          <Target size={20} />
                          משימות בביצוע ({activeMissions.length})
                      </h3>
                      <div className="space-y-3">
                          {activeMissions.map(mission => (
                              <div key={mission.id || mission._id} className="space-y-3 rounded-2xl border border-champagne-100 bg-champagne-50/60 p-4">
                                  <div className="flex items-start justify-between gap-2">
                                      <h4 className="text-[15px] text-ink font-strong">{mission.title}</h4>
                                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11.5px] text-champagne-700 shadow-soft">
                                          <Clock size={11} />
                                          עד {new Date(mission.drawDate).toLocaleDateString('he-IL')}
                                      </span>
                                  </div>
                                  <p className="rounded-xl bg-white/70 p-3 text-[14px] leading-relaxed text-slate-600">
                                      {mission.missionText}
                                  </p>
                                  <button
                                      onClick={() => handleCompleteMission(mission._id || mission.id)}
                                      className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-champagne-500 text-[14px] text-white transition hover:bg-champagne-600 font-strong"
                                  >
                                      <CheckCircle2 size={15} /> סיימתי את המשימה!
                                  </button>
                              </div>
                          ))}
                      </div>
                  </ScrollReveal>
              )}
          </div>

          {/* Benefits & History */}
          <div className="space-y-6">
               <ScrollReveal delay={100} className="flex h-full flex-col rounded-[1.75rem] border border-rose-100/70 bg-white p-6 shadow-petal">
                  <h3 className="mb-4 flex items-center gap-2 text-[1.15rem]">
                      <Award size={20} className="text-champagne-500" />
                      ההטבות שלי
                  </h3>

                  {true ? (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-rose-200 bg-rose-50/30 p-6 text-center">
                        <Sparkles size={26} className="mb-2 text-rose-300 animate-float-y" />
                        <p className="text-[14.5px] leading-relaxed text-slate-500">
                          אין כרגע הטבות מוגדרות. ההנהלה תעדכן כאן הטבות חדשות בקרוב.
                        </p>
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center space-y-5 rounded-[1.25rem] border border-dashed border-rose-200 bg-gradient-to-b from-rose-50/60 to-white p-8 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-rose-600 shadow-soft">
                          <Lock size={28} />
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-[1.1rem]">הטבות המעגל עוד נעולות</h4>
                          <p className="text-[14.5px] leading-relaxed text-slate-500">
                            {user.isMemberRequested
                              ? "הבקשה שלך בטיפול. מיד לאחר אישור ההנהלה, כל ההטבות והנקודות יופיעו כאן."
                              : `הצטרפות למעגל של ${BRAND.name} פותחת צבירת נקודות והטבות בלעדיות.`}
                          </p>
                        </div>
                        {!user.isMemberRequested && (
                          <Link to="/" className="btn-primary">
                            <HeartHandshake size={18} /> הצטרפות למעגל
                          </Link>
                        )}
                    </div>
                  )}
              </ScrollReveal>

              {/* הזמנת חברות — נתון אמיתי במקום גרף לדוגמה */}
              <ScrollReveal delay={150} className="rounded-[1.75rem] border border-rose-100/70 bg-white p-6 shadow-petal">
                  <h3 className="flex items-center gap-2 text-[1.15rem]"><TrendingUp size={20} className="text-plum-500" /> חברים שהזמנת</h3>
                  <p className="mt-2 font-accent text-6xl leading-none text-rose-700">{(user as any).referralsCount || 0}</p>
                  <p className="mt-2 text-sm text-slate-500">על כל חבר/ה שמצטרפים דרך הקישור שלך מקבלים 30 נקודות.</p>
                  <button
                    type="button"
                    onClick={() => shareLink({ title: `הצטרפו אליי ל${BRAND.name}`, text: `${BRAND.tagline}: אירועים, שיעורים, חוגים, הגרלות וקהילה — לגברים, לנשים ולמשפחות. ההצטרפות חינם`, path: `/s/join?ref=${(user as any)._id || user.id}` })}
                    className="btn-primary mt-5 w-full"
                  >הזמנת חברים</button>
              </ScrollReveal>
          </div>
        </div>
      ) : (
        /* אירועים שנשמרו/סומנו כאהובים */
        <div className="animate-fade-in">
            {likedEvents.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {likedEvents.map((event, i) => (
                        <ScrollReveal key={event.id} delay={i * 50}>
                          <Link to="/events" className="group flex items-center gap-3 rounded-[1.4rem] border border-rose-100/70 bg-white p-2.5 shadow-petal transition hover:-translate-y-0.5 hover:shadow-lift">
                              <img src={event.image} className="h-16 w-16 shrink-0 rounded-[1rem] object-cover" />
                              <div className="min-w-0 flex-1">
                                  <h4 className="line-clamp-1 text-[15px] text-ink transition-colors group-hover:text-rose-700 font-strong">{event.title}</h4>
                                  <div className="mt-1 flex items-center gap-1 text-[12.5px] text-slate-500">
                                      <Calendar size={12} className="text-rose-400" />
                                      <span>{new Date(event.date).toLocaleDateString('he-IL')}</span>
                                  </div>
                              </div>
                          </Link>
                        </ScrollReveal>
                    ))}
                </div>
            ) : (
                <EmptyState
                  icon={<Heart size={28} />}
                  title="עוד לא שמרת אירועים"
                  text="סימון לב על אירוע מעניין — והוא יחכה כאן."
                  action={<Link to="/events" className="btn-primary">ללוח האירועים</Link>}
                />
            )}
        </div>
      )}
    </PageShell>
  );
};

export default ProfilePage;
