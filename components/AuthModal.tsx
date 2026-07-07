import React, { useState } from 'react';
import { X, Mail, Lock, User, Phone, ArrowRight, CheckCircle, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
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

    setLoading(true);
    try {
      let res;
      if (isRegister) {
        res = await api.register(formData);
        alert("נרשמת בהצלחה! ברוכה הבאה למעגל.");
      } else {
        res = await api.login({ email: formData.email, password: formData.password });
      }
      
      // שמירת הטוקן ועדכון משתמש
      localStorage.setItem('token', res.token);
      onLogin(res.user);
      onClose();
    } catch (err: any) {
      alert(isRegister ? "שגיאה בהרשמה (אולי המייל תפוס?)" : "שגיאה בהתחברות (בדקי פרטים)");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm animate-fade-in text-right" dir="rtl" onClick={onClose}>

      {/* כרטיס הטופס */}
      {!showTerms ? (
        <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl w-full max-w-md shadow-2xl overflow-hidden relative animate-slide-up max-h-[88vh] flex flex-col">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-2.5 mb-1 shrink-0"></div>

          {/* כותרת */}
          <div className="bg-gradient-to-r from-purple-600 to-rose-500 p-8 text-white text-center relative shrink-0">
            <button onClick={onClose} className="absolute top-4 left-4 p-2 bg-white/20 rounded-full hover:bg-white/40 transition-colors">
              <X size={20} />
            </button>
            <h2 className="text-3xl font-black tracking-tight mb-2">
              {isRegister ? 'הצטרפות למעגל' : 'ברוכה השבה'}
            </h2>
            <p className="text-purple-100 text-sm font-medium">
              {isRegister ? 'מלאי פרטים והתחילי לצבור חוויות' : 'התחברי כדי לראות מה חדש'}
            </p>
          </div>

          <div className="p-8 overflow-y-auto flex-1">
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {isRegister && (
                <div className="space-y-1">
                  <div className="relative">
                    <User className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      name="name"
                      placeholder="שם מלא"
                      autoComplete="name" // מילוי אוטומטי לשם
                      required
                      className="w-full pr-12 pl-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-50/50 transition-all font-bold text-slate-700"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <div className="relative">
                  <Mail className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="email" 
                    name="email"
                    placeholder="כתובת אימייל"
                    autoComplete="username" // מילוי אוטומטי למייל
                    required
                    className="w-full pr-12 pl-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-50/50 transition-all font-bold text-slate-700"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              {isRegister && (
                <div className="space-y-1">
                  <div className="relative">
                    <Phone className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="tel" 
                      name="phone"
                      placeholder="מספר נייד"
                      autoComplete="tel" // מילוי אוטומטי לטלפון
                      required
                      className="w-full pr-12 pl-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-50/50 transition-all font-bold text-slate-700"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <div className="relative">
                  <Lock className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="password" 
                    name="password"
                    placeholder="סיסמה"
                    autoComplete={isRegister ? "new-password" : "current-password"} // מילוי אוטומטי לסיסמה
                    required
                    className="w-full pr-12 pl-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-50/50 transition-all font-bold text-slate-700"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                </div>
                
                {/* תוספת: קישור שכחתי סיסמה (רק במצב התחברות) */}
                {!isRegister && (
                  <div className="flex justify-start px-1">
                    <button 
                      type="button"
                      onClick={() => { onClose(); navigate('/forgot-password'); }}
                      className="text-[10px] font-black text-rose-400 hover:text-rose-600 transition-colors uppercase tracking-tighter"
                    >
                      שכחת סיסמה? לחצי כאן
                    </button>
                  </div>
                )}
              </div>

              {/* צ'ק בוקס לתקנון (רק בהרשמה) */}
              {isRegister && (
                <div className="flex items-start gap-3 pt-2 px-1">
                   <div className="relative flex items-center">
                     <input 
                       id="terms-check" 
                       type="checkbox" 
                       className="peer h-5 w-5 cursor-pointer appearance-none rounded-lg border-2 border-slate-300 transition-all checked:border-purple-500 checked:bg-purple-500 hover:border-purple-400"
                       checked={formData.agreedToTerms}
                       onChange={e => setFormData({...formData, agreedToTerms: e.target.checked})}
                     />
                     <CheckCircle size={12} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100" />
                   </div>
                   <label htmlFor="terms-check" className="text-xs text-slate-500 font-medium leading-tight cursor-pointer select-none">
                     אני מאשרת שקראתי והסכמתי ל
                     <span 
                       className="text-purple-600 font-bold underline hover:text-purple-800 mr-1"
                       onClick={(e) => { e.preventDefault(); setShowTerms(true); }}
                     >
                       תקנון ומדיניות האתר
                     </span>
                   </label>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-purple-600 hover:shadow-purple-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 mt-4"
              >
                {loading ? <span className="animate-spin text-xl">⏳</span> : (
                  <>
                    {isRegister ? 'הרשמה מהירה' : 'כניסה למערכת'} <ArrowRight size={20} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-slate-400 font-medium">
                {isRegister ? 'כבר יש לך משתמש?' : 'עדיין אין לך משתמש?'}
                <button 
                  onClick={() => setIsRegister(!isRegister)} 
                  className="text-purple-600 font-black underline mr-1 hover:text-purple-800"
                >
                  {isRegister ? 'התחברי כאן' : 'הירשמי עכשיו'}
                </button>
              </p>
            </div>
          </div>
        </div>
      ) : (
        // --- מודאל התקנון (נפתח במקום הטופס) ---
        <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl w-full max-w-xl shadow-2xl relative flex flex-col max-h-[88vh] animate-slide-up border-t-4 border-[#2D6A4F]">
           <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-2.5 mb-1 shrink-0"></div>
           <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><ShieldCheck className="text-purple-500"/> תקנון ומדיניות האתר</h3>
              <button onClick={() => setShowTerms(false)} className="p-2 hover:bg-white rounded-full transition-colors"><X size={20}/></button>
           </div>
           
           <div className="p-8 overflow-y-auto text-sm leading-loose text-slate-600 space-y-4">
             <p className="font-bold text-slate-900">כללי</p>
             <p>ברוכות הבאות לאתר. השימוש באתר ובתכניו כפוף לתקנון ולמדיניות שימוש זו, ומהווה הסכמה מלאה לכל תנאיה. הנהלת האתר רשאית לעדכן את התקנון מעת לעת, לפי שיקול דעתה הבלעדי וללא הודעה מוקדמת. נוסח התקנון המעודכן הוא המחייב.</p>

             <p className="font-bold text-slate-900 mt-4">מהות האתר ותכניו</p>
             <p>האתר מהווה מרחב קהילתי לנשים ונערות, שמטרתו שיתוף, השראה, חיבור ויצירת שיח פתוח ומכבד. התכנים המפורסמים באתר נכתבים לצורכי שיח, שיתוף דעות וניסיון אישי בלבד.</p>
             <p>ייתכנו בתכני האתר טעויות, אי־דיוקים או מידע שאינו מעודכן. אין לראות בתכנים המופיעים באתר ייעוץ מקצועי מכל סוג שהוא, לרבות אך לא רק: ייעוץ רפואי, נפשי, משפטי, פיננסי או טיפולי.</p>

             <p className="font-bold text-slate-900 mt-4">אחריות ושימוש במידע</p>
             <p>השימוש בתכני האתר ובמידע המפורסם בו נעשה על אחריות המשתמשת בלבד. הנהלת האתר לא תישא בכל אחריות לנזק, ישיר או עקיף, שעלול להיגרם עקב הסתמכות על מידע המופיע באתר או שימוש בו.</p>

             <p className="font-bold text-slate-900 mt-4">פעילות כספית והתקשרויות חיצוניות</p>
             <p>האתר אינו עוסק בכספים, תשלומים, תרומות, מכירת מוצרים או קניית כרטיסים, ואינו מהווה צד לכל התקשרות כספית או חוזית המתקיימת מחוץ למסגרת האתר. כל התקשרות בין משתמשות או בין משתמשת לגורם חיצוני נעשית באחריותן הבלעדית של הצדדים המעורבים.</p>

             <p className="font-bold text-slate-900 mt-4">קישורים ותכנים חיצוניים</p>
             <p>באתר עשויים להופיע קישורים, הפניות או אזכורים לגורמים חיצוניים. הנהלת האתר אינה אחראית לתוכן, לאמינות, לזמינות או לפעילות של אתרים, שירותים או גורמים חיצוניים אלו, והשימוש בהם הוא באחריות המשתמשת בלבד.</p>

             <p className="font-bold text-slate-900 mt-4">פרטיות ושמירת מידע</p>
             <p>האתר מכבד את פרטיות המשתמשות. מסירת מידע אישי, פרסומו או שיתופו באתר נעשים ביוזמת המשתמשת ובאחריותה בלבד. הנהלת האתר אינה אחראית לשימוש שייעשה במידע אישי שפורסם בפומבי על ידי המשתמשת.</p>
             <p>הנהלת האתר תפעל, ככל שניתן, לשמור על סביבה בטוחה ומכבדת, אך אינה יכולה להבטיח הגנה מלאה מפני שימוש לא ראוי במידע שפורסם.</p>

             <p className="font-bold text-slate-900 mt-4">התנהלות ושיח קהילתי</p>
             <p>המשתמשות מתחייבות לנהל שיח מכבד, אחראי ורגיש. הנהלת האתר שומרת לעצמה את הזכות להסיר תכנים, להגביל גישה או לחסום משתמשת, לפי שיקול דעתה, במקרה של הפרת תקנון זה או פגיעה ברוח הקהילה.</p>

             <p className="font-bold text-slate-900 mt-4">סמכות שיפוט</p>
             <p>על תקנון זה ועל השימוש באתר יחולו דיני מדינת ישראל בלבד, וסמכות השיפוט הבלעדית נתונה לבתי המשפט המוסמכים בישראל.</p>
             <p className="italic mt-2 text-xs opacity-70">תקנון זה נועד להבהיר את אופן השימוש באתר ולשמור על קהילה בטוחה, מכבדת ומעצימה.</p>
           </div>
           <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
             <button onClick={() => { setShowTerms(false); setFormData({...formData, agreedToTerms: true}); }} className="w-full py-3 bg-purple-600 text-white rounded-xl font-black hover:bg-purple-700 transition-colors">קראתי ואני מאשרת את התקנון</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default AuthModal;