import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LogOut, User as UserIcon, ShieldCheck, ChevronDown, Home, 
  Calendar, Gift, MessageSquare, Users, Search, X, Send // נוספו X, Send
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
    { label: 'פורום נשי', path: '/forum' },  // חדש
    { label: 'קהילה', path: '/community' }, // חדש
    { label: 'צור קשר', path: '/contact' },
  ];

  // עדכון רשימת הקישורים (Mobile)
  const mobileNavLinks = [
      { label: 'בית', path: '/', icon: <Home size={20} strokeWidth={1.6} /> },
      { label: 'אירועים', path: '/events', icon: <Calendar size={20} strokeWidth={1.6} /> },
      { label: 'פורום', path: '/forum', icon: <MessageSquare size={20} strokeWidth={1.6} /> }, // חדש
      { label: 'קהילה', path: '/community', icon: <Users size={20} strokeWidth={1.6} /> }, // חדש
      { label: 'פרופיל', path: '/profile', icon: <UserIcon size={20} strokeWidth={1.6} /> },
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
    <div className="flex flex-col min-h-screen w-full font-sans text-slate-600 bg-[#FBF7F4]">
      
      {/* Ambient background — lives here (outside the animated main container) so it truly covers the viewport */}
      <div className="fixed inset-0 -z-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-b from-rose-50 via-[#FBF7F4] to-[#FBF7F4]" />
        <div className="absolute -top-40 -left-40 w-[560px] h-[560px] bg-rose-200/40 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-48 w-[520px] h-[520px] bg-plum-200/25 rounded-full blur-[130px]" />
        <div className="absolute bottom-0 left-1/4 w-[420px] h-[420px] bg-champagne-100/50 rounded-full blur-[120px]" />
      </div>

      {/* --- Header --- */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
            scrolled
              ? 'h-16 bg-[#FBF7F4]/85 backdrop-blur-xl shadow-[0_1px_0_rgba(189,122,129,0.18),0_10px_30px_-20px_rgba(61,47,55,0.25)]'
              : 'h-20 bg-[#FBF7F4]/60 backdrop-blur-md'
        }`}
      >
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-full flex items-center justify-between gap-6">
          <div className="flex items-center gap-6 flex-1 min-w-0">
            <Link to="/" className="flex items-baseline gap-1.5 group z-50 shrink-0" aria-label="נשי — לדף הבית">
              <span className="font-display text-[1.85rem] md:text-[2.1rem] leading-none text-ink tracking-tight">נשי</span>
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400 group-hover:scale-150 transition-transform duration-500" />
            </Link>

            {/* שורת חיפוש חופשי (Desktop) */}
            <div className="hidden lg:flex items-center relative group flex-1 max-w-[260px]">
                <Search className="absolute right-4 text-rose-300 group-focus-within:text-rose-600 transition-colors" size={15} strokeWidth={1.75} />
                <input
                    type="text"
                    placeholder="חיפוש באתר…"
                    className="w-full pr-10 pl-4 py-2.5 bg-white/70 border border-rose-100 rounded-full outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-300 text-[13px] text-slate-700 placeholder:text-slate-400 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="ניווט ראשי">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`relative px-3.5 py-2 rounded-full text-[14px] font-medium transition-all duration-300 ${
                  isActive(link.path) ? 'text-rose-800 bg-rose-100/70' : 'text-slate-600 hover:text-rose-700 hover:bg-white/70'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* User Profile / Login Section */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2 p-1 md:pl-3 rounded-full bg-white/80 border border-rose-100 hover:border-rose-200 hover:shadow-soft transition-all group"
                  aria-haspopup="menu"
                  aria-expanded={isProfileMenuOpen}
                >
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-rose-100 overflow-hidden ring-2 ring-white">
                    <img src={user.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${user.name}`} alt={user.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="text-right hidden md:block leading-tight">
                    <p className="text-[13px] font-semibold text-slate-800">{user.name.split(' ')[0]}</p>
                    {user.isMemberApproved && <p className="text-[11px] text-rose-600">{user.points} נקודות</p>}
                  </div>
                  {user.isMemberApproved && (
                    <span className="md:hidden text-[11px] font-semibold text-rose-700 pl-2">{user.points} נק'</span>
                  )}
                  <ChevronDown size={13} className="text-slate-400 hidden md:block group-hover:text-rose-600 transition-colors" />
                </button>

                {isProfileMenuOpen && (
                  <div role="menu" className="absolute top-full left-0 mt-3 w-60 bg-white rounded-3xl shadow-lift border border-rose-100 p-2 animate-fade-in-up origin-top-left z-[60]">
                    <div className="px-4 py-3 mb-1 rounded-2xl bg-rose-50/70">
                        <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>
                    <Link to="/profile" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors rounded-2xl"><UserIcon size={16} strokeWidth={1.75} />האזור האישי</Link>
                    {user.isAdmin && <Link to="/admin" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors rounded-2xl"><ShieldCheck size={16} strokeWidth={1.75} />ניהול מערכת</Link>}
                    <div className="hairline my-1.5" />
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors rounded-2xl"><LogOut size={16} strokeWidth={1.75} />התנתקות</button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={onOpenLogin} className="btn-primary !px-6 !py-2.5 min-h-[44px]">
                כניסה
              </button>
            )}
          </div>

        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="relative z-10 flex-1 pt-20 pb-28 md:pb-12 w-full min-h-screen">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-4 animate-fade-in-up">
          {children}
        </div>
      </main>

      {/* --- Mobile Bottom Navigation --- */}
      <nav aria-label="ניווט" className="md:hidden fixed bottom-3 left-3 right-3 z-40 pb-safe">
        <div className="bg-white/90 backdrop-blur-xl border border-rose-100 rounded-[28px] shadow-lift flex justify-around items-center h-[64px] px-2">
         {mobileNavLinks.map((link) => {
             const active = isActive(link.path);
             const onClick = (link.path === '/profile' && !user) ? handleMobileProfileClick : undefined;
             const linkProps = onClick ? { onClick, type: 'button' } : { to: link.path };
             const Wrapper: any = onClick ? 'button' : Link;

             return (
                <Wrapper
                    key={link.path}
                    {...(linkProps as any)}
                    aria-current={active ? 'page' : undefined}
                    className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[48px]"
                >
                    <span className={`flex items-center justify-center w-10 h-8 rounded-full transition-all duration-300 ${
                      active ? 'bg-rose-100 text-rose-700' : 'text-slate-400'
                    }`}>
                        {link.icon}
                    </span>
                    <span className={`text-[10px] transition-colors ${active ? 'text-rose-700 font-semibold' : 'text-slate-500'}`}>
                        {link.label}
                    </span>
                </Wrapper>
             );
         })}
        </div>
      </nav>

      <footer className="relative z-10 hidden md:block mt-auto border-t border-rose-100/70 bg-gradient-to-b from-transparent to-rose-50/60">
        <div className="max-w-7xl mx-auto px-8 py-14 grid grid-cols-3 items-start gap-10 text-right">
          <div>
            <p className="font-display text-3xl text-ink leading-none">נשי</p>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed max-w-xs">פלטפורמה עירונית לקידום תרבות נשים — אירועים, חוגים, קהילה והשראה, במקום אחד.</p>
          </div>
          <div className="flex flex-col gap-2.5 text-sm">
            <p className="eyebrow mb-1">ניווט</p>
            {navLinks.slice(0, 5).map((l) => (
              <Link key={l.path} to={l.path} className="text-slate-600 hover:text-rose-700 transition-colors w-fit">{l.label}</Link>
            ))}
          </div>
          <div className="flex flex-col gap-2.5 text-sm">
            <p className="eyebrow mb-1">מידע</p>
            <Link to="/contact" className="text-slate-600 hover:text-rose-700 transition-colors w-fit">צור קשר</Link>
            <button onClick={() => setShowTermsModal(true)} className="text-slate-600 hover:text-rose-700 transition-colors w-fit text-right">תקנון ותנאי שימוש</button>
          </div>
        </div>
        <div className="hairline" />
        <p className="text-center text-[12px] text-slate-400 py-5">© {new Date().getFullYear()} נשי · נבנה באהבה לקהילה</p>
      </footer>

      {/* מודל תקנון גלובלי - זמין לכל האתר */}
      {showTermsModal && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-start justify-center bg-[#2B2027]/40 backdrop-blur-sm animate-fade-in text-right md:pt-24 md:px-4 md:pb-4" onClick={() => setShowTermsModal(false)}>
              <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-[2rem] md:rounded-[2rem] w-full max-w-2xl p-6 md:p-10 relative shadow-lift overflow-hidden flex flex-col max-h-[88vh] animate-slide-up border border-rose-100">
                  <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto -mt-3 mb-4 shrink-0 md:hidden"></div>
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
                  <button onClick={() => setShowTermsModal(false)} className="btn-primary mt-6 w-full shrink-0">סגור ואישור</button>
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