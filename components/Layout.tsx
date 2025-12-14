import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon, ShieldCheck, ChevronDown, Home, Calendar, Gift, Heart } from 'lucide-react';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  onOpenLogin: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, onOpenLogin }) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'ראשי', path: '/' },
    { label: 'אירועים', path: '/events' },
    { label: 'חוגים', path: '/classes' },
    { label: 'הגרלות', path: '/lottery' },
    { label: 'צור קשר', path: '/contact' },
  ];

  const mobileNavLinks = [
      { label: 'בית', path: '/', icon: <Home size={20} strokeWidth={1.5} /> },
      { label: 'אירועים', path: '/events', icon: <Calendar size={20} strokeWidth={1.5} /> },
      { label: 'הגרלות', path: '/lottery', icon: <Gift size={20} strokeWidth={1.5} /> },
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
            scrolled ? 'bg-white/80 backdrop-blur-xl border-white/40 h-16 shadow-sm shadow-rose-100/30' : 'bg-white/30 border-transparent h-20'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group z-50">
            <div className="bg-gradient-to-tr from-rose-400 to-pink-500 p-1.5 rounded-full text-white shadow-lg shadow-rose-200 group-hover:scale-105 transition-transform duration-500">
              <Heart className="fill-current" size={14} />
            </div>
            <span className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
              נשי<span className="text-rose-500">.</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 bg-white/40 backdrop-blur-md px-1.5 py-1 rounded-full border border-white/60 shadow-sm">
            {navLinks.map((link) => (
              <Link 
                key={link.path}
                to={link.path} 
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all duration-300 ${
                    isActive(link.path) 
                    ? 'bg-white text-rose-600 shadow-sm shadow-rose-100' 
                    : 'text-slate-500 hover:text-rose-500 hover:bg-white/50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* User Profile / Login Section (Desktop & Mobile Unified Logic) */}
          <div className="flex items-center gap-4">
            {user ? (
              <div className="relative">
                <button 
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2 pl-1 pr-1 py-1 rounded-full bg-white/60 border border-white hover:border-rose-200 hover:bg-rose-50/50 hover:shadow-md transition-all group"
                >
                  <div className="text-right hidden md:block pl-2">
                    <p className="text-xs font-bold text-slate-700 group-hover:text-rose-600 transition-colors">{user.name.split(' ')[0]}</p>
                    <p className="text-[10px] text-rose-400 font-medium">{user.points} נק'</p>
                  </div>
                  {/* Mobile Only Points display inside button */}
                  <div className="md:hidden flex flex-col items-end pr-2 pl-1">
                      <span className="text-[10px] font-bold text-rose-500">{user.points} נק'</span>
                  </div>

                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-rose-50 overflow-hidden border-2 border-white shadow-sm ring-1 ring-rose-100">
                    <img src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} alt={user.name} className="w-full h-full object-cover" />
                  </div>
                  <ChevronDown size={12} className="text-slate-400 ml-0.5 group-hover:text-rose-400 hidden md:block" />
                </button>

                {isProfileMenuOpen && (
                  <div className="absolute top-full left-0 mt-2 w-48 md:w-56 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-rose-100/50 border border-white py-2 animate-fade-in-up origin-top-left z-[60]">
                    <div className="md:hidden px-4 py-2 border-b border-slate-50 mb-1">
                        <p className="text-sm font-bold text-slate-800">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                    <Link to="/profile" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-3 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-500 transition-colors"><UserIcon size={16} />האזור האישי</Link>
                    {user.isAdmin && <Link to="/admin" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-3 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-500 transition-colors"><ShieldCheck size={16} />ניהול מערכת</Link>}
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-5 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors mt-1"><LogOut size={16} />התנתקות</button>
                  </div>
                )}
              </div>
            ) : (
              <button 
                onClick={onOpenLogin}
                className="bg-gradient-to-r from-rose-500 to-pink-600 text-white px-4 md:px-5 py-1.5 md:py-2 rounded-full font-bold text-[11px] md:text-xs hover:shadow-lg hover:shadow-rose-300 hover:-translate-y-0.5 transition-all shadow-md"
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
      
      {/* --- Mobile Bottom Navigation (Refined) --- */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-rose-100/50 pb-safe pt-1 px-6 z-40 flex justify-between items-center h-[65px] shadow-[0_-5px_20px_rgba(251,113,133,0.1)] rounded-t-[20px]">
         {mobileNavLinks.map((link) => {
             const active = isActive(link.path);
             const onClick = (link.path === '/profile' && !user) ? handleMobileProfileClick : undefined;
             const linkProps = onClick ? { as: 'button', onClick } : { to: link.path };
             
             // Dynamic Component
             const Wrapper = onClick ? 'button' : Link;

             return (
                <Wrapper 
                    key={link.path} 
                    {...linkProps as any}
                    className={`flex flex-col items-center justify-center gap-1 w-14 transition-all duration-300`}
                >
                    <div className={`
                        p-1.5 rounded-full transition-all duration-300
                        ${active ? 'bg-gradient-to-tr from-rose-50 to-pink-50 text-rose-500 -translate-y-1 shadow-sm' : 'text-slate-400 hover:text-rose-400'}
                    `}>
                        {link.icon}
                    </div>
                    <span className={`text-[10px] font-bold transition-all ${active ? 'text-rose-500 opacity-100' : 'text-slate-400 opacity-70'}`}>
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
                <Link to="/events" className="hover:text-rose-500 transition-colors">תנאי שימוש</Link>
             </div>
           </div>
      </footer>
    </div>
  );
};

export default Layout;