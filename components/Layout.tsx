import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LogOut, User as UserIcon, ShieldCheck, ChevronDown, Home, 
  Calendar, Gift, Heart, MessageSquare, Users, Search, X, Send // נוספו X, Send
} from 'lucide-react';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  onOpenLogin: () => void;
  searchTerm: string;      // הוספה: מצב החיפוש
  setSearchTerm: (term: string) => void; // הוספה: פונקציית עדכון חיפוש
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, onOpenLogin, searchTerm, setSearchTerm }) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false); // מצב למודל תקנון
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // עדכון רשימת הקישורים (Desktop)
  const navLinks = [
    { label: 'ראשי', path: '/' },
    { label: 'אירועים', path: '/events' },
    { label: 'חוגים', path: '/classes' },
    { label: 'הגרלות', path: '/lottery' },
    { label: 'פורום נשי', path: '/forum' },  // חדש
    { label: 'קהילה', path: '/community' }, // חדש
    { label: 'צור קשר', path: '/contact' },
  ];

  // עדכון רשימת הקישורים (Mobile)
  const mobileNavLinks = [
      { label: 'בית', path: '/', icon: <Home size={20} strokeWidth={1.5} /> },
      { label: 'אירועים', path: '/events', icon: <Calendar size={20} strokeWidth={1.5} /> },
      { label: 'פורום', path: '/forum', icon: <MessageSquare size={20} strokeWidth={1.5} /> }, // חדש
      { label: 'קהילה', path: '/community', icon: <Users size={20} strokeWidth={1.5} /> }, // חדש
      { label: 'פרופיל', path: '/profile', icon: <UserIcon size={20} strokeWidth={1.5} /> },
  ];

  const handleLogout = () => {
    onLogout();
    setIsProfileMenuOpen(false);
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  const handleMobileProfileClick = () => {
      if (user) {
          navigate('/profile');
      } else {
           onOpenLogin();
      }
  };

  return (
    <div className="flex flex-col min-h-screen w-full font-sans text-slate-600">
      
      {/* --- Header --- */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 border-b ${
            scrolled ? 'bg-white/90 backdrop-blur-xl border-slate-100/80 h-16 shadow-sm' : 'bg-white/40 backdrop-blur-md border-transparent h-20'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <Link to="/" className="flex items-center gap-2 group z-50 shrink-0">
              <div className="bg-gradient-to-tr from-rose-400 to-pink-500 p-1.5 rounded-full text-white shadow-lg shadow-rose-200 group-hover:scale-105 transition-transform duration-500">
                <Heart className="fill-current" size={14} />
              </div>
              <span className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                נשי<span className="text-rose-500">.</span>
              </span>
            </Link>

            {/* שורת חיפוש חופשי (Desktop) */}
            <div className="hidden lg:flex items-center relative group flex-1 max-w-xs">
                <Search className="absolute right-3 text-slate-400 group-focus-within:text-rose-500 transition-colors" size={16} />
                <input 
                    type="text" 
                    placeholder="חיפוש חופשי באתר..." 
                    className="w-full pr-10 pl-4 py-2 bg-white/50 border border-white/60 rounded-full outline-none focus:ring-2 focus:ring-rose-100 text-xs transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          </div>

            {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 bg-white/60 backdrop-blur-md px-1.5 py-1 rounded-full border border-slate-200/60 shadow-sm">
            {navLinks.map((link) => (
              <Link 
                key={link.path}
                to={link.path} 
                className={`px-4 py-2 rounded-full text-[11px] lg:text-xs font-bold transition-all duration-300 ${
                    isActive(link.path) 
                    ? 'bg-white text-rose-600 shadow-sm' 
                    : 'text-slate-500 hover:text-rose-500 hover:bg-white/70'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* User Profile / Login Section */}
          <div className="flex items-center gap-4">
            {user ? (
              <div className="relative">
                <button 
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2 pl-1 pr-1 py-1 rounded-full bg-white/60 border border-white hover:border-rose-200 hover:bg-rose-50/50 hover:shadow-md transition-all group"
                >
                  <div className="text-right hidden md:block pl-2">
                    <p className="text-xs font-bold text-slate-700 group-hover:text-rose-600 transition-colors">{user.name.split(' ')[0]}</p>
                    {/* הצגת נקודות מותנית */}
                    {user.isMemberApproved && (
                      <p className="text-[10px] text-rose-400 font-medium">{user.points} נק'</p>
                    )}
                  </div>

                  {/* Mobile Only Points display */}
                  {user.isMemberApproved && (
                    <div className="md:hidden flex flex-col items-end pr-2 pl-1">
                        <span className="text-[10px] font-bold text-rose-500">{user.points} נק'</span>
                    </div>
                  )}

                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-rose-50 overflow-hidden border-2 border-white shadow-sm ring-1 ring-rose-100">
                    <img src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} alt={user.name} className="w-full h-full object-cover" />
                  </div>
                  <ChevronDown size={12} className="text-slate-400 ml-0.5 group-hover:text-rose-400 hidden md:block" />
                </button>

                {isProfileMenuOpen && (
                  <div className="absolute top-full left-0 mt-2 w-52 bg-white rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.12)] border border-slate-100 py-2 animate-fade-in-up origin-top-left z-[60]">
                    <div className="md:hidden px-4 py-3 border-b border-slate-50 mb-1">
                        <p className="text-sm font-bold text-slate-800">{user.name}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                    </div>
                    <Link to="/profile" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-3 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-500 transition-colors rounded-lg mx-1"><UserIcon size={15} />האזור האישי</Link>
                    {user.isAdmin && <Link to="/admin" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-3 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-500 transition-colors rounded-lg mx-1"><ShieldCheck size={15} />ניהול מערכת</Link>}
                    <div className="border-t border-slate-50 mt-1 pt-1">
                      <button onClick={handleLogout} className="w-full flex items-center gap-3 px-5 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors rounded-lg mx-1"><LogOut size={15} />התנתקות</button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button 
                onClick={onOpenLogin}
                className="bg-gradient-to-r from-rose-500 to-pink-500 text-white px-4 md:px-5 py-2 md:py-2.5 rounded-full font-bold text-[11px] md:text-xs hover:shadow-lg hover:shadow-rose-200 hover:-translate-y-0.5 transition-all duration-300 shadow-md"
              >
                כניסה
              </button>
            )}
          </div>

        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="flex-1 pt-20 pb-24 md:pb-10 w-full min-h-screen">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-4 animate-fade-in-up">
          {children}
        </div>
      </main>
      
      {/* --- Mobile Bottom Navigation --- */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 pb-safe pt-1 px-4 z-40 flex justify-between items-center h-[65px] shadow-[0_-8px_30px_rgba(0,0,0,0.06)] rounded-t-[24px]">
         {mobileNavLinks.map((link) => {
             const active = isActive(link.path);
             const onClick = (link.path === '/profile' && !user) ? handleMobileProfileClick : undefined;
             const linkProps = onClick ? { as: 'button', onClick } : { to: link.path };
             
             const Wrapper = onClick ? 'button' : Link;

             return (
                <Wrapper 
                    key={link.path} 
                    {...linkProps as any}
                    className={`flex flex-col items-center justify-center gap-1 w-14 transition-all duration-300`}
                >
                    <div className={`
                        p-1.5 rounded-full transition-all duration-300
                        ${active ? 'bg-rose-50 text-rose-500 -translate-y-1' : 'text-slate-400 hover:text-rose-400'}
                    `}>
                        {link.icon}
                    </div>
                    <span className={`text-[9px] font-bold transition-all ${active ? 'text-rose-500' : 'text-slate-400'}`}>
                        {link.label}
                    </span>
                </Wrapper>
             );
         })}
      </div>

      <footer className="hidden md:block bg-white/40 border-t border-rose-100/50 py-10 mt-auto backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-6 text-center text-slate-400 text-sm">
              <div className="flex justify-center items-center gap-2 mb-3 text-rose-300"><Heart size={14} className="fill-current" /></div>
              <p className="mb-3 font-light text-xs text-slate-500">נשי - פלטפורמה עירונית לקידום תרבות נשים</p>
              <div className="flex justify-center gap-6 text-[11px] font-bold text-slate-400">
                 <Link to="/contact" className="hover:text-rose-500 transition-colors">צור קשר</Link>
                 <button onClick={() => setShowTermsModal(true)} className="hover:text-rose-500 transition-colors">תנאי שימוש</button>
              </div>
            </div>
      </footer>

      {/* מודל תקנון גלובלי - זמין לכל האתר */}
      {showTermsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in text-right">
              <div className="bg-white rounded-[2rem] w-full max-w-2xl p-6 md:p-10 relative shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                  <div className="flex items-center justify-between mb-6 shrink-0">
                      <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><ShieldCheck className="text-rose-500"/> תקנון ומדיניות שימוש</h2>
                      <button onClick={() => setShowTermsModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
                  </div>
                  <div className="overflow-y-auto pr-2 space-y-4 text-slate-600 text-right text-xs md:text-sm leading-relaxed font-medium">
                      <p className="font-black text-slate-800 underline">כללי</p>
                      <p>ברוכות הבאות לאתר. השימוש באתר ובתכניו כפוף לתקנון ולמדיניות שימוש זו, ומהווה הסכמה מלאה לכל תנאיה. הנהלת האתר רשאית לעדכן את התקנון מעת לעת, לפי שיקול דעתה הבלעדי וללא הודעה מוקדמת. נוסח התקנון המעודכן הוא המחייב.</p>
                      
                      <p className="font-black text-slate-800 underline">מהות האתר ותכניו</p>
                      <p>האתר מהווה מרחב קהילתי לנשים ונערות, שמטרתו שיתוף, השראה, חיבור ויצירת שיח פתוח ומכבד. התכנים המפורסמים באתר נכתבים לצורכי שיח, שיתוף דעות וניסיון אישי בלבד.
                      ייתכנו בתכני האתר טעויות, אי־דיוקים או מידע שאינו מעודכן. אין לראות בתכנים המופיעים באתר ייעוץ מקצועי מכל סוג שהוא, לרבות אך לא רק: ייעוץ רפואי, נפשי, משפטי, פיננסי או טיפולי.</p>
                      
                      <p className="font-black text-slate-800 underline">אחריות ושימוש במידע</p>
                      <p>השימוש בתכני האתר ובמידע המפורסם בו נעשה על אחריות המשתמשת בלבד. הנהלת האתר לא תישא בכל אחריות לנזק, ישיר או עקיף, שעלול להיגרם עקב הסתמכות על מידע המופיע באתר או שימוש בו.</p>
                      
                      <p className="font-black text-slate-800 underline">פעילות כספית והתקשרויות חיצוניות</p>
                      <p>האתר אינו עוסק בכספים, תשלומים, תרומות, מכירת מוצרים או קניית כרטיסים, ואינו מהווה צד לכל התקשרות כספית או חוזית המתקיימת מחוץ למסגרת האתר. כל התקשרות בין משתמשות או בין משתמשת לגורם חיצוני נעשית באחריותן הבלעדיות של הצדדים המעורבים.</p>
                      
                      <p className="font-black text-slate-800 underline">קישורים ותכנים חיצוניים</p>
                      <p>באתר עשויים להופיע קישורים, הפניות או אזכורים לגורמים חיצוניים. הנהלת האתר אינה אחראית לתוכן, לאמינות, לזמינות או לפעילות של אתרים, שירותים או גורמים חיצוניים אלו, והשימוש בהם הוא באחריות המשתמשת בלבד.</p>
                      
                      <p className="font-black text-slate-800 underline">פרטיות ושמירת מידע</p>
                      <p>האתר מכבד את פרטיות המשתמשות. מסירת מידע אישי, פרסומו או שיתופו באתר נעשים ביוזמת המשתמשת ובאחריותה בלבד. הנהלת האתר אינה אחראית לשימוש שייעשה במידע אישי שפורסם בפומבי על ידי המשתמשת.</p>
                      
                      <p className="font-black text-slate-800 underline">התנהלות ושיח קהילתי</p>
                      <p>המשתמשות מתחייבות לנהל שיח מכבד, אחראי ורגיש. הנהלת האתר שומרת לעצמה את הזכות להסיר תכנים, להגביל גישה או לחסום משתמשת, לפי שיקול דעתה, במקרה של הפרת תקנון זה או פגיעה ברוח הקהילה.</p>
                      
                      <p className="font-black text-slate-800 underline">סמכות שיפוט</p>
                      <p>על תקנון זה ועל השימוש באתר יחולו דיני מדינת ישראל בלבד, וסמכות השיפוט הבלעדית נתונה לבתי המשפט המוסמכים בישראל.</p>
                  </div>
                  <button onClick={() => setShowTermsModal(false)} className="mt-6 w-full py-4 bg-slate-900 text-white rounded-xl font-black text-xs shrink-0">סגור ואישור</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default Layout;


/** * הנחיות לשילוב בטופס ההרשמה (AuthModal):
 * --------------------------------------
 * כדי שהשדות יהיו תואמים לגוגל ולדרישות שלך, וודאי שהאינפוטים בטופס נראים כך:
 * * 1. שדה אימייל: <input type="email" name="email" autoComplete="email" ... />
 * 2. שדה סיסמה: <input type="password" name="password" autoComplete="new-password" ... />
 * 3. שדה שם מלא: <input type="text" name="name" autoComplete="name" ... />
 * * הוספת הצ'קבוקס בטופס ההרשמה:
 * * const [accepted, setAccepted] = useState(false);
 * * <div className="flex items-center gap-2 mt-4">
 * <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} id="reg-terms" />
 * <label htmlFor="reg-terms" className="text-xs">אני מאשרת את <button type="button" onClick={() => setShowTermsModal(true)} className="underline">תקנון האתר</button></label>
 * </div>
 * * <button disabled={!accepted} ...>הרשמה</button>
 */