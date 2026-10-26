import React, { useState } from 'react';
import { X, Mail, Lock, User, Phone, ArrowRight, CheckCircle, ShieldCheck } from 'lucide-react';
import CityPicker from './CityPicker';
import { api } from '../services/api';
import Logo from './Logo';
import { BRAND } from '../shared/brand';
import { useNavigate } from 'react-router-dom'; // תוספת לייבוא

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: any) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLogin }) => {
  const navigate = useNavigate(); // אתחול הניווט
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false); // מצב הצגת התקנון
  
  // טופס
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    city: '',
    gender: '',            // optional "אני" — only for wording emails / texts to her/him
    agreedToTerms: false
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // בדיקת תקנון בהרשמה
    if (isRegister && !formData.agreedToTerms) {
      alert('יש לאשר את תקנון האתר כדי להירשם.');
      return;
    }
    if (isRegister && !formData.city) {
      alert('יש לבחור עיר, כדי שנוכל להראות מה קורה קרוב לבית.');
      return;
    }

    setLoading(true);
    try {
      let res;
      if (isRegister) {
        res = await api.register(formData);
        alert(`נרשמת בהצלחה! ${formData.gender === 'male' ? 'ברוך הבא' : formData.gender === 'female' ? 'ברוכה הבאה' : 'ברוכים הבאים'} ל${BRAND.name}.`);
      } else {
        res = await api.login({ email: formData.email, password: formData.password });
      }
      
      // שמירת הטוקן ועדכון משתמש
      localStorage.setItem('token', res.token);
      onLogin(res.user);
      onClose();
    } catch (err: any) {
      alert(isRegister ? (err?.message || "שגיאה בהרשמה") : "שגיאה בהתחברות (כדאי לבדוק את הפרטים)");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full rounded-2xl border border-rose-100 bg-rose-50/30 py-3.5 pr-12 pl-4 text-[15px] text-ink outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-100/70';
  const iconCls = 'absolute top-1/2 right-4 -translate-y-1/2 text-rose-300';

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-plum-900/40 backdrop-blur-sm animate-fade-in text-right md:p-6" dir="rtl" onClick={onClose}>

      {/* כרטיס הטופס */}
      {!showTerms ? (
        <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={isRegister ? 'הצטרפות' : 'התחברות'} className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] md:rounded-[2rem] bg-white shadow-lift animate-slide-up">
          <div className="mx-auto mt-2.5 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-rose-100 md:hidden"></div>

          {/* כותרת */}
          <div className="relative shrink-0 overflow-hidden px-7 pt-7 pb-5 md:px-8 md:pt-9">
            <div aria-hidden="true" className="pointer-events-none absolute -top-16 -left-10 h-48 w-48 rounded-full bg-rose-200/50 blur-3xl animate-mesh-drift" />
            <div aria-hidden="true" className="pointer-events-none absolute -top-10 right-[-3rem] h-40 w-40 rounded-full bg-champagne-200/60 blur-3xl animate-mesh-drift-slow" />
            <button onClick={onClose} aria-label="סגירה" className="absolute top-4 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-slate-500 transition hover:bg-plum-300 hover:text-ink active:scale-90">
              <X size={18} />
            </button>
            <div className="relative">
              <Logo size="md" />
              <h2 key={isRegister ? 'r' : 'l'} className="mt-3 text-[2.2rem] md:text-[2.5rem] leading-[1.05] animate-blur-in">
                {isRegister ? 'ברוכים הבאים, יש לכם מקום כאן' : 'טוב לראות אותך שוב'}
              </h2>
              <p className="mt-2 text-[15px] text-slate-500">
                {isRegister ? 'דקה אחת והצטרפת: אירועים, שיעורים, חוגים, הגרלות והשראה.' : 'התחברות כדי לראות מה חדש.'}
              </p>
            </div>

            {/* מתג התחברות/הרשמה */}
            <div className="relative mt-5 grid grid-cols-2 rounded-full bg-rose-50 p-1 text-[14.5px]" role="tablist">
              <span aria-hidden="true" className={`absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-soft transition-all duration-500 ${isRegister ? 'right-[calc(50%+0rem)]' : 'right-1'}`} />
              <button type="button" role="tab" aria-selected={!isRegister} onClick={() => setIsRegister(false)} className={`relative z-10 rounded-full py-2 transition ${!isRegister ? 'text-rose-700 font-strong' : 'text-slate-500'}`}>התחברות</button>
              <button type="button" role="tab" aria-selected={isRegister} onClick={() => setIsRegister(true)} className={`relative z-10 rounded-full py-2 transition ${isRegister ? 'text-rose-700 font-strong' : 'text-slate-500'}`}>הרשמה</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-7 pb-8 md:px-8">
            <form onSubmit={handleSubmit} className="space-y-3">

              {isRegister && (
                <label className="relative block animate-fade-in-up">
                  <span className="sr-only">שם מלא</span>
                  <User className={iconCls} size={18} />
                  <input
                    type="text"
                    name="name"
                    placeholder="שם מלא"
                    autoComplete="name"
                    required
                    className={inputCls}
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </label>
              )}

              <label className="relative block">
                <span className="sr-only">אימייל</span>
                <Mail className={iconCls} size={18} />
                <input
                  type="email"
                  name="email"
                  placeholder="כתובת אימייל"
                  autoComplete="username"
                  required
                  className={inputCls}
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </label>

              {isRegister && (
                <div className="animate-fade-in-up">
                  <CityPicker value={formData.city} onChange={city => setFormData({ ...formData, city })} />
                </div>
              )}

              {isRegister && (
                <div className="flex items-center gap-2 animate-fade-in-up" role="radiogroup" aria-label="אני (לא חובה)">
                  <span className="text-[13px] text-slate-500">אני <span className="text-slate-400">(לא חובה)</span></span>
                  {[['male', 'גבר'], ['female', 'אישה']].map(([id, label]) => (
                    <button type="button" key={id} role="radio" aria-checked={formData.gender === id} onClick={() => setFormData({ ...formData, gender: formData.gender === id ? '' : id })}
                      className={`rounded-full border px-4 py-1.5 text-[13.5px] transition ${formData.gender === id ? 'border-plum-300 bg-plum-300 text-ink' : 'border-rose-100 bg-white text-slate-600 hover:border-rose-300'}`}>{label}</button>
                  ))}
                </div>
              )}

              {isRegister && (
                <label className="relative block animate-fade-in-up">
                  <span className="sr-only">טלפון נייד</span>
                  <Phone className={iconCls} size={18} />
                  <input
                    type="tel"
                    name="phone"
                    placeholder="מספר נייד"
                    autoComplete="tel"
                    required
                    className={inputCls}
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </label>
              )}

              <label className="relative block">
                <span className="sr-only">סיסמה</span>
                <Lock className={iconCls} size={18} />
                <input
                  type="password"
                  name="password"
                  placeholder="סיסמה"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  required
                  className={inputCls}
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </label>

              {!isRegister && (
                <div className="flex justify-start px-1">
                  <button
                    type="button"
                    onClick={() => { onClose(); navigate('/forgot-password'); }}
                    className="text-[13px] text-rose-600 underline-offset-4 transition-colors hover:text-rose-800 hover:underline"
                  >
                    שכחת סיסמה?
                  </button>
                </div>
              )}

              {/* צ'ק בוקס לתקנון (רק בהרשמה) */}
              {isRegister && (
                <div className="flex items-start gap-3 px-1 pt-1">
                   <div className="relative mt-0.5 flex items-center">
                     <input
                       id="terms-check"
                       type="checkbox"
                       className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-rose-200 transition-all checked:border-plum-300 checked:bg-plum-300 hover:border-rose-400"
                       checked={formData.agreedToTerms}
                       onChange={e => setFormData({...formData, agreedToTerms: e.target.checked})}
                     />
                     <CheckCircle size={12} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100" />
                   </div>
                   <label htmlFor="terms-check" className="cursor-pointer select-none text-[13.5px] leading-snug text-slate-500">
                     קראתי ואני מסכים/ה ל
                     <span
                       className="mr-1 text-rose-700 underline underline-offset-4 hover:text-rose-900"
                       onClick={(e) => { e.preventDefault(); setShowTerms(true); }}
                     >
                       תקנון האתר
                     </span>
                   </label>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary mt-3 w-full !py-4 !text-base disabled:opacity-70"
              >
                {loading ? <span className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-label="טוען" /> : (
                  <>
                    {isRegister ? 'הצטרפות לקהילה' : 'כניסה'} <ArrowRight size={19} className="rotate-180" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-[13.5px] text-slate-500">
              {isRegister ? 'כבר יש לך משתמש?' : 'עדיין לא חלק מהקהילה?'}
              <button
                onClick={() => setIsRegister(!isRegister)}
                className="mr-1 text-rose-700 underline underline-offset-4 hover:text-rose-900"
              >
                {isRegister ? 'להתחברות' : 'להרשמה בחינם'}
              </button>
            </p>
          </div>
        </div>
      ) : (
        // --- מודאל התקנון (נפתח במקום הטופס) ---
        <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="תקנון האתר" className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] md:rounded-[2rem] bg-white shadow-lift animate-slide-up">
           <div className="mx-auto mt-2.5 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-rose-100 md:hidden"></div>
           <div className="flex shrink-0 items-center justify-between border-b border-rose-100 px-6 py-5 md:px-8">
              <div>
                <p className="eyebrow">לפני שמצטרפים</p>
                <h3 className="mt-1 flex items-center gap-2 font-display text-[1.7rem] text-ink"><ShieldCheck className="text-rose-500" size={22}/> תקנון האתר</h3>
              </div>
              <button onClick={() => setShowTerms(false)} aria-label="חזרה" className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-slate-500 transition hover:bg-plum-300 hover:text-ink"><X size={18}/></button>
           </div>

           <div className="overflow-y-auto px-6 py-6 md:px-8 text-[14.5px] leading-[1.85] text-slate-600 space-y-3">
             <p className="text-ink font-strong">כללי</p>
             <p>ברוכים הבאים לאתר. השימוש באתר ובתכניו כפוף לתקנון ולמדיניות שימוש זו, ומהווה הסכמה מלאה לכל תנאיה. הנהלת האתר רשאית לעדכן את התקנון מעת לעת, לפי שיקול דעתה הבלעדי וללא הודעה מוקדמת. נוסח התקנון המעודכן הוא המחייב.</p>

             <p className="text-ink font-strong pt-2">מהות האתר ותכניו</p>
             <p>האתר מהווה מרחב קהילתי ותרבותי לציבור החרדי — גברים, נשים ומשפחות — שמטרתו שיתוף, השראה, חיבור ויצירת שיח פתוח ומכבד. התכנים המפורסמים באתר נכתבים לצורכי שיח, שיתוף דעות וניסיון אישי בלבד.</p>
             <p>ייתכנו בתכני האתר טעויות, אי־דיוקים או מידע שאינו מעודכן. אין לראות בתכנים המופיעים באתר ייעוץ מקצועי מכל סוג שהוא, לרבות אך לא רק: ייעוץ רפואי, נפשי, משפטי, פיננסי או טיפולי.</p>

             <p className="text-ink font-strong pt-2">אחריות ושימוש במידע</p>
             <p>השימוש בתכני האתר ובמידע המפורסם בו נעשה על אחריות המשתמש/ת בלבד. הנהלת האתר לא תישא בכל אחריות לנזק, ישיר או עקיף, שעלול להיגרם עקב הסתמכות על מידע המופיע באתר או שימוש בו.</p>

             <p className="text-ink font-strong pt-2">פעילות כספית והתקשרויות חיצוניות</p>
             <p>האתר אינו עוסק בכספים, תשלומים, תרומות, מכירת מוצרים או קניית כרטיסים, ואינו מהווה צד לכל התקשרות כספית או חוזית המתקיימת מחוץ למסגרת האתר. כל התקשרות בין משתמשים או בין משתמש/ת לגורם חיצוני נעשית באחריותם הבלעדית של הצדדים המעורבים.</p>

             <p className="text-ink font-strong pt-2">קישורים ותכנים חיצוניים</p>
             <p>באתר עשויים להופיע קישורים, הפניות או אזכורים לגורמים חיצוניים. הנהלת האתר אינה אחראית לתוכן, לאמינות, לזמינות או לפעילות של אתרים, שירותים או גורמים חיצוניים אלו, והשימוש בהם הוא באחריות המשתמש/ת בלבד.</p>

             <p className="text-ink font-strong pt-2">פרטיות ושמירת מידע</p>
             <p>האתר מכבד את פרטיות המשתמשים. מסירת מידע אישי, פרסומו או שיתופו באתר נעשים ביוזמת המשתמש/ת ובאחריותו/ה בלבד. הנהלת האתר אינה אחראית לשימוש שייעשה במידע אישי שפורסם בפומבי על ידי המשתמש/ת.</p>
             <p>הנהלת האתר תפעל, ככל שניתן, לשמור על סביבה בטוחה ומכבדת, אך אינה יכולה להבטיח הגנה מלאה מפני שימוש לא ראוי במידע שפורסם.</p>

             <p className="text-ink font-strong pt-2">התנהלות ושיח קהילתי</p>
             <p>המשתמשים מתחייבים לנהל שיח מכבד, אחראי ורגיש. הנהלת האתר שומרת לעצמה את הזכות להסיר תכנים, להגביל גישה או לחסום משתמש/ת, לפי שיקול דעתה, במקרה של הפרת תקנון זה או פגיעה ברוח הקהילה.</p>

             <p className="text-ink font-strong pt-2">סמכות שיפוט</p>
             <p>על תקנון זה ועל השימוש באתר יחולו דיני מדינת ישראל בלבד, וסמכות השיפוט הבלעדית נתונה לבתי המשפט המוסמכים בישראל.</p>
             <p className="italic mt-2 text-xs opacity-70">תקנון זה נועד להבהיר את אופן השימוש באתר ולשמור על קהילה בטוחה ומכבדת.</p>
           </div>

           <div className="shrink-0 border-t border-rose-100 bg-rose-50/40 p-4">
             <button onClick={() => { setShowTerms(false); setFormData({...formData, agreedToTerms: true}); }} className="btn-primary w-full !py-3.5">קראתי ואני מאשר/ת</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default AuthModal;
