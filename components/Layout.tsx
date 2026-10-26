import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LogOut, User as UserIcon, ShieldCheck, ChevronDown, Home, 
  Calendar, MessageSquare, Users, Search, X, Menu, Heart, ArrowLeft, Sparkles
} from 'lucide-react';
import { shareLink } from '../utils/share';
import InstallPrompt from './InstallPrompt';
import SupplierBanner from './SupplierBanner';
import { PlaceChip, CityPrompt, AutoLocate } from './PlaceControl';
import { User } from '../types';
import Logo from './Logo';
import { BRAND } from '../shared/brand';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  onOpenLogin: () => void;
  searchTerm: string;      // הוספה: מצב החיפוש
  setSearchTerm: (term: string) => void; // הוספה: פונקציית עדכון חיפוש
  onUpdateUser?: (u: any) => void;
}

const MORE_LINKS = [
  { label: 'אישיות השבוע', path: '/personality-archive', hint: 'ראיונות מעוררי השראה' },
  { label: 'הגרלות', path: '/lottery', hint: 'פרסים לחברי הקהילה' },
  { label: 'ניהול תרבות', path: '/become-manager', hint: 'להוביל את התרבות באזור שלכם' },
  { label: 'לספקים', path: '/suppliers/join', hint: `הצטרפות למאגר הספקים של ${BRAND.name}` },
  { label: 'צור קשר', path: '/contact', hint: 'נשמח לשמוע מכם' },
];
// only for culture managers (regionAdmin) and the main admin
const MANAGER_LINK = { label: 'מאגר ספקים', path: '/suppliers', hint: 'ספקים לאירועים — למנהלי תרבות בלבד' };

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, onOpenLogin, searchTerm, setSearchTerm, onUpdateUser }) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const progressRef = useRef<HTMLSpanElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [ribbon, setRibbon] = useState(() => { try { return localStorage.getItem('nashi-ribbon-closed') !== '1'; } catch { return true; } });
  const [showTermsModal, setShowTermsModal] = useState(false); // מצב למודל תקנון
  const navigate = useNavigate();
  const location = useLocation();
  const isManager = !!user && (user.isAdmin || (user as any).role === 'regionAdmin');
  const moreLinks = isManager ? [MANAGER_LINK, ...MORE_LINKS] : MORE_LINKS;
  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  // header: shrink after scrolling, hide while scrolling down on phones, reading progress line
  useEffect(() => {
    let last = window.scrollY;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const s = y > 10;
      const dy = y - last;
      setScrolled(prev => (prev === s ? prev : s));
      if (Math.abs(dy) > 6) {
        const h = y > 160 && dy > 0 && window.innerWidth < 768;
        setHidden(prev => (prev === h ? prev : h));
        last = y;
      }
      const bar = progressRef.current;
      if (bar) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  // close menus on navigation
  useEffect(() => { setMenuOpen(false); setMoreOpen(false); setIsProfileMenuOpen(false); setSearchOpen(false); }, [location.pathname]);

  // lock scroll behind full-screen menus
  useEffect(() => {
    const lock = menuOpen || searchOpen;
    document.body.style.overflow = lock ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen, searchOpen]);

  // keyboard: "/" opens search, Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); setSearchOpen(true); }
      if (e.key === 'Escape') { setSearchOpen(false); setMenuOpen(false); setMoreOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // remember an invite code (?ref=...) so registration can credit the friend who invited her
  useEffect(() => {
    const ref = new URLSearchParams(location.search).get('ref');
    if (ref && /^[a-f0-9]{24}$/i.test(ref)) { try { localStorage.setItem('nashi-ref', ref); } catch { /* ignore */ } }
  }, [location.search]);

  // עדכון רשימת הקישורים (Desktop)
  const navLinks = [
    { label: 'ראשי', path: '/' },
    { label: 'אירועים', path: '/events' },
    { label: 'חוגים', path: '/classes' },
    { label: 'פורום', path: '/forum' },
    { label: 'קהילה', path: '/community' }, // חדש
    { label: 'צור קשר', path: '/contact' },
  ];
  const primaryLinks = navLinks.slice(0, 5);

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

  const isActive = (path: string) => (path === '/' ? location.pathname === '/' : path === '/suppliers' ? location.pathname === '/suppliers' : location.pathname.startsWith(path));

  // sliding pill behind the active desktop link
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const el = nav.querySelector<HTMLElement>('[data-active="true"]');
      if (!el) { setIndicator(null); return; }
      // the "more" button sits inside a wrapper div, so measure relative to the nav itself
      const nr = nav.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      setIndicator({ left: er.left - nr.left, width: er.width });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(nav);
    nav.querySelectorAll('a,button').forEach(n => ro?.observe(n));
    (document as any).fonts?.ready?.then(measure).catch(() => {});
    return () => ro?.disconnect();
  }, [location.pathname]);

  const handleMobileProfileClick = () => {
      if (user) {
          navigate('/profile');
      } else {
           onOpenLogin();
      }
  };

  const invite = () => shareLink({
    title: `הצטרפו אליי ל${BRAND.name}`,
    text: `${BRAND.tagline}: אירועים, שיעורים, חוגים, הגרלות וקהילה — לגברים, לנשים ולמשפחות. ההצטרפות חינם`,
    path: `/s/join${user ? `?ref=${(user as any)._id || user.id}` : ''}`,
  });

  const closeRibbon = () => { setRibbon(false); try { localStorage.setItem('nashi-ribbon-closed', '1'); } catch { /* ignore */ } };
  const ribbonOn = ribbon && !scrolled;
  const headerTop = ribbonOn ? 'top-9' : 'top-0';

  const searchTargets = [
    { label: 'אירועים', path: '/events', icon: <Calendar size={16} /> },
    { label: 'חוגים', path: '/classes', icon: <Sparkles size={16} /> },
    { label: 'פורום', path: '/forum', icon: <MessageSquare size={16} /> },
    { label: 'קהילה ועסקים', path: '/community', icon: <Users size={16} /> },
  ];

  return (
    <div className="flex flex-col min-h-screen w-full font-sans text-slate-600 bg-cream">
      
      {/* Ambient background — lives here (outside the animated main container) so it truly covers the viewport */}
      <div className="fixed inset-0 -z-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(60vmax 45vmax at 0% 0%, rgb(var(--ambient-1) / 0.55), transparent 70%), radial-gradient(55vmax 45vmax at 100% 45%, rgb(var(--ambient-2) / 0.35), transparent 70%), radial-gradient(45vmax 35vmax at 30% 100%, rgb(var(--ambient-3) / 0.7), transparent 70%), linear-gradient(var(--ambient-top), rgb(var(--cream)) 40%)' }} />
      </div>

      {/* --- Top ribbon --- */}
      <div className={`fixed inset-x-0 top-0 z-[51] h-9 overflow-hidden bg-ink text-white transition-transform duration-500 ${ribbonOn ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="mx-auto flex h-full max-w-7xl items-center justify-center gap-3 px-10 text-[12.5px]">
          <Heart size={13} className="shrink-0 fill-rose-300 text-rose-300" />
          {user ? (
            <button onClick={invite} className="truncate hover:underline">הקהילה גדלה בזכותכם: <span className="font-strong text-rose-300">הזמינו חברים ל{BRAND.name} ←</span></button>
          ) : (
            <button onClick={onOpenLogin} className="truncate hover:underline">אירועים, שיעורים וחוגים לגברים, לנשים ולמשפחות. <span className="font-strong text-rose-300">הצטרפות חינם ←</span></button>
          )}
          <button onClick={closeRibbon} aria-label="סגירה" className="absolute left-3 rounded-full p-1 text-white/60 hover:text-white"><X size={14} /></button>
        </div>
      </div>

      {/* --- Header --- */}
      <header
        className={`fixed left-0 right-0 z-50 transition-all duration-500 ${headerTop} ${hidden && !menuOpen ? '-translate-y-[120%]' : 'translate-y-0'} ${
            scrolled
              ? 'h-16 bg-cream/95 md:bg-cream/85 md:backdrop-blur-xl shadow-[0_1px_0_rgb(var(--rose-500)/0.18),0_10px_30px_-20px_rgb(var(--mauve-800)/0.25)]'
              : 'h-[72px] md:h-20 bg-cream/90 md:bg-cream/60 md:backdrop-blur-md'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-full flex items-center justify-between gap-4">
          {/* logo */}
          <Link to="/" className="group z-50 shrink-0 transition-opacity hover:opacity-85" aria-label={`${BRAND.name} — לדף הבית`}>
            <Logo />
          </Link>

          {/* Desktop Nav — pill with a sliding active indicator */}
          <nav ref={navRef} className="relative hidden md:flex items-center gap-0.5 rounded-full border border-rose-100/80 bg-white/60 p-1 shadow-[0_8px_30px_-18px_rgb(var(--mauve-800)/0.35)] backdrop-blur" aria-label="ניווט ראשי">
            {indicator && (
              <span className="absolute top-1 bottom-1 rounded-full bg-plum-300 shadow-lift transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)]" style={{ left: indicator.left, width: indicator.width }} aria-hidden="true" />
            )}
            {primaryLinks.map((link) => {
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  data-active={active}
                  aria-current={active ? 'page' : undefined}
                  className={`relative z-10 px-4 py-2 rounded-full text-[14px] transition-colors duration-300 ${active ? 'text-ink font-strong' : 'text-slate-600 hover:text-rose-700'}`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="relative">
              <button
                onClick={() => setMoreOpen(o => !o)}
                data-active={moreLinks.some(l => isActive(l.path))}
                className={`relative z-10 flex items-center gap-1 px-4 py-2 rounded-full text-[14px] transition-colors ${moreLinks.some(l => isActive(l.path)) ? 'text-white font-strong' : 'text-slate-600 hover:text-rose-700'}`}
                aria-expanded={moreOpen}
              >
                עוד <ChevronDown size={14} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-[55]" onClick={() => setMoreOpen(false)} />
                  <div className="absolute left-1/2 top-full z-[60] mt-3 w-72 -translate-x-1/2 rounded-[1.6rem] border border-rose-100 bg-white p-2 shadow-lift animate-fade-in-up">
                    {moreLinks.map(l => (
                      <Link key={l.path} to={l.path} className="group flex items-center justify-between rounded-2xl px-4 py-3 hover:bg-rose-50">
                        <span>
                          <span className="block font-strong text-[15px] text-ink group-hover:text-rose-700">{l.label}</span>
                          <span className="block text-xs text-slate-400">{l.hint}</span>
                        </span>
                        <ArrowLeft size={15} className="text-rose-300 transition-transform group-hover:-translate-x-1 group-hover:text-rose-600" />
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          </nav>

          {/* actions */}
          <div className="flex items-center gap-2">
            <PlaceChip user={user} onUpdateUser={onUpdateUser} className="hidden sm:flex md:hidden lg:flex" />
            <button onClick={() => setSearchOpen(true)} aria-label="חיפוש" className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-100 bg-white/70 text-slate-500 transition hover:border-rose-300 hover:text-rose-700">
              <Search size={17} strokeWidth={1.8} />
            </button>
            {user && (
              <button onClick={invite} className="hidden lg:flex items-center gap-1.5 rounded-full border border-rose-100 bg-white/70 px-4 h-10 text-[13px] text-rose-700 transition hover:border-rose-300 hover:bg-white">
                <Heart size={15} /> הזמנת חברים
              </button>
            )}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2 p-1 md:pl-3 rounded-full bg-white/80 border border-rose-100 hover:border-rose-200 hover:shadow-soft transition-all group"
                  aria-haspopup="menu"
                  aria-expanded={isProfileMenuOpen}
                >
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-rose-100 overflow-hidden ring-2 ring-white">
                    {user.avatar
                      ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                      : <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-200 to-rose-400 font-accent text-xl text-white">{user.name?.charAt(0)}</span>}
                  </div>
                  <div className="text-right hidden md:block leading-tight">
                    <p className="text-[13px] font-semibold text-slate-800">{user.name.split(' ')[0]}</p>
                    {user.isMemberApproved && <p className="text-[11px] text-rose-600">{user.points} נקודות</p>}
                  </div>
                  <ChevronDown size={13} className="text-slate-400 hidden md:block group-hover:text-rose-600 transition-colors" />
                </button>

                {isProfileMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-[55]" onClick={() => setIsProfileMenuOpen(false)} />
                    <div role="menu" className="absolute top-full left-0 mt-3 w-64 bg-white rounded-3xl shadow-lift border border-rose-100 p-2 animate-fade-in-up origin-top-left z-[60]">
                      <div className="px-4 py-3 mb-1 rounded-2xl bg-rose-50/70">
                          <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                          {user.isMemberApproved && <p className="mt-1 text-xs text-rose-700">{user.points} נקודות בקהילה</p>}
                      </div>
                      <Link to="/profile" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors rounded-2xl"><UserIcon size={16} strokeWidth={1.75} />האזור האישי</Link>
                      <button onClick={() => { setIsProfileMenuOpen(false); invite(); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors rounded-2xl"><Heart size={16} strokeWidth={1.75} />הזמנת חברים</button>
                      {(user.isAdmin || (user as any).role === 'regionAdmin') && <Link to="/admin" onClick={() => setIsProfileMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors rounded-2xl"><ShieldCheck size={16} strokeWidth={1.75} />{user.isAdmin ? 'ניהול מערכת' : 'ניהול האזור שלי'}</Link>}
                      <div className="hairline my-1.5" />
                      <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors rounded-2xl"><LogOut size={16} strokeWidth={1.75} />התנתקות</button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <button onClick={onOpenLogin} className="hidden sm:inline-flex md:hidden lg:inline-flex h-10 items-center rounded-full px-4 text-[14px] text-slate-600 hover:text-rose-700">כניסה</button>
                <button onClick={onOpenLogin} className="btn-primary !px-5 !py-2.5 min-h-[40px] whitespace-nowrap">הצטרפות<span className="hidden sm:inline"> חינם</span></button>
              </>
            )}
            <button onClick={() => setMenuOpen(true)} aria-label="תפריט" className="md:hidden flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-white/70">
              <Menu size={22} strokeWidth={1.6} />
            </button>
          </div>
        </div>
        {/* reading progress */}
        <span ref={progressRef} className="absolute bottom-0 inset-x-0 h-[2px] origin-right bg-gradient-to-l from-rose-400 to-rose-700 will-change-transform" style={{ transform: 'scaleX(0)' }} aria-hidden="true" />
      </header>

      {/* --- Mobile full-screen menu --- */}
      {menuOpen && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-cream animate-fade-in md:hidden" dir="rtl">
          <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-rose-200/50 blur-[90px]" aria-hidden="true" />
          <div className="relative flex h-[72px] items-center justify-between px-4">
            <Logo />
            <button onClick={() => setMenuOpen(false)} aria-label="סגירה" className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-soft"><X size={20} /></button>
          </div>
          <div className="relative px-6"><PlaceChip user={user} onUpdateUser={onUpdateUser} className="w-full justify-center !h-12 !text-[15px]" /></div>
          <nav className="relative flex-1 overflow-y-auto px-6 pt-2">
            {[...primaryLinks, ...moreLinks].map((l, i) => (
              <Link key={l.path} to={l.path} className="group flex items-center justify-between border-b border-rose-100/80 py-4 animate-fade-in-up" style={{ animationDelay: `${i * 45}ms` }}>
                <span className={`font-display text-[2rem] leading-none ${isActive(l.path) ? 'text-rose-700' : 'text-ink'}`}>{l.label}</span>
                <ArrowLeft size={18} className="text-rose-300" />
              </Link>
            ))}
          </nav>
          <div className="relative space-y-2 p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
            {user && (user.isAdmin || (user as any).role === 'regionAdmin') && (
              <Link to="/admin" className="btn-ghost w-full !py-3.5"><ShieldCheck size={17} /> {user.isAdmin ? 'ניהול מערכת' : 'ניהול האזור שלי'}</Link>
            )}
            {user ? (
              <button onClick={() => { setMenuOpen(false); invite(); }} className="btn-primary w-full !py-3.5"><Heart size={17} /> הזמנת חברים ל{BRAND.name}</button>
            ) : (
              <button onClick={() => { setMenuOpen(false); onOpenLogin(); }} className="btn-primary w-full !py-3.5">הצטרפות חינם</button>
            )}
          </div>
        </div>
      )}

      {/* --- Search overlay --- */}
      {searchOpen && (
        <div className="fixed inset-0 z-[95] flex items-start justify-center bg-ink/40 px-4 pt-[12vh] backdrop-blur-sm animate-fade-in" onClick={() => setSearchOpen(false)} dir="rtl">
          <div className="w-full max-w-xl rounded-[2rem] bg-white p-3 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 rounded-[1.4rem] bg-rose-50/70 px-4">
              <Search size={19} className="text-rose-400" />
              <input
                autoFocus
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { setSearchOpen(false); if (location.pathname === '/') navigate('/events'); } }}
                placeholder="מה מחפשים? אירוע, שיעור, חוג, נושא…"
                className="h-14 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-slate-400"
              />
              {searchTerm && <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-rose-600"><X size={18} /></button>}
            </div>
            <p className="px-3 pb-1 pt-4 text-xs text-slate-400">{searchTerm ? `לחפש את "${searchTerm}" ב…` : 'קיצורי דרך'}</p>
            <div className="grid grid-cols-2 gap-2 p-1">
              {searchTargets.map(t => (
                <button key={t.path} onClick={() => { setSearchOpen(false); navigate(t.path); }} className="flex items-center gap-2.5 rounded-2xl border border-rose-100 px-4 py-3 text-right text-[14px] text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700">
                  <span className="text-rose-400">{t.icon}</span>{t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- Main Content --- */}
      <main className={`relative z-10 flex-1 ${ribbon ? 'pt-[108px] md:pt-[116px]' : 'pt-[72px] md:pt-20'} pb-28 md:pb-12 w-full min-h-screen transition-[padding] duration-500`}>
        <div key={location.pathname} className="w-full max-w-7xl mx-auto px-4 md:px-8 py-4 animate-page-in">
          {children}
        </div>
        <SupplierBanner />
      </main>

      <InstallPrompt />
      <CityPrompt user={user} onUpdateUser={onUpdateUser} />
      <AutoLocate user={user} onUpdateUser={onUpdateUser} />

      {/* --- Mobile Bottom Navigation --- */}
      <nav aria-label="ניווט" className="md:hidden fixed bottom-3 left-3 right-3 z-40 pb-safe">
        <div className="bg-white/[0.97] border border-rose-100 rounded-[28px] shadow-lift flex justify-around items-center h-[64px] px-2">
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
            <Logo size="lg" />
            <p className="mt-3 font-strong text-[15px] text-rose-800">{BRAND.tagline}</p>
            <p className="mt-1.5 text-sm text-slate-500 leading-relaxed max-w-xs">{BRAND.about}</p>
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
            <Link to="/become-manager" className="text-slate-600 hover:text-rose-700 transition-colors w-fit">ניהול תרבות באזור שלכם</Link>
            <Link to="/suppliers/join" className="text-slate-600 hover:text-rose-700 transition-colors w-fit">ספקים? הצטרפו למאגר</Link>
            <button onClick={() => setShowTermsModal(true)} className="text-slate-600 hover:text-rose-700 transition-colors w-fit text-right">תקנון ותנאי שימוש</button>
          </div>
        </div>
        <div className="hairline" />
        <p className="text-center text-[12px] text-slate-400 py-5">© {new Date().getFullYear()} {BRAND.name} · נבנה באהבה לקהילה</p>
      </footer>

      {/* מודל תקנון גלובלי - זמין לכל האתר */}
      {showTermsModal && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-start justify-center bg-ink/40 backdrop-blur-sm animate-fade-in text-right md:pt-24 md:px-4 md:pb-4" onClick={() => setShowTermsModal(false)}>
              <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-[2rem] md:rounded-[2rem] w-full max-w-2xl p-6 md:p-10 relative shadow-lift overflow-hidden flex flex-col max-h-[88vh] animate-slide-up border border-rose-100">
                  <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto -mt-3 mb-4 shrink-0 md:hidden"></div>
                  <div className="flex items-center justify-between mb-6 shrink-0">
                      <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><ShieldCheck className="text-rose-500"/> תקנון ומדיניות שימוש</h2>
                      <button onClick={() => setShowTermsModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
                  </div>
                  <div className="overflow-y-auto pr-2 space-y-4 text-slate-600 text-right text-xs md:text-sm leading-relaxed font-medium">
                      <p className="font-black text-slate-800 underline">כללי</p>
                      <p>ברוכים הבאים לאתר. השימוש באתר ובתכניו כפוף לתקנון ולמדיניות שימוש זו, ומהווה הסכמה מלאה לכל תנאיה. הנהלת האתר רשאית לעדכן את התקנון מעת לעת, לפי שיקול דעתה הבלעדי וללא הודעה מוקדמת. נוסח התקנון המעודכן הוא המחייב.</p>
                      
                      <p className="font-black text-slate-800 underline">מהות האתר ותכניו</p>
                      <p>האתר מהווה מרחב קהילתי ותרבותי לציבור החרדי — גברים, נשים ומשפחות — שמטרתו שיתוף, השראה, חיבור ויצירת שיח פתוח ומכבד. התכנים המפורסמים באתר נכתבים לצורכי שיח, שיתוף דעות וניסיון אישי בלבד.
                      ייתכנו בתכני האתר טעויות, אי־דיוקים או מידע שאינו מעודכן. אין לראות בתכנים המופיעים באתר ייעוץ מקצועי מכל סוג שהוא, לרבות אך לא רק: ייעוץ רפואי, נפשי, משפטי, פיננסי או טיפולי.</p>
                      
                      <p className="font-black text-slate-800 underline">אחריות ושימוש במידע</p>
                      <p>השימוש בתכני האתר ובמידע המפורסם בו נעשה על אחריות המשתמש/ת בלבד. הנהלת האתר לא תישא בכל אחריות לנזק, ישיר או עקיף, שעלול להיגרם עקב הסתמכות על מידע המופיע באתר או שימוש בו.</p>
                      
                      <p className="font-black text-slate-800 underline">פעילות כספית והתקשרויות חיצוניות</p>
                      <p>האתר אינו עוסק בכספים, תשלומים, תרומות, מכירת מוצרים או קניית כרטיסים, ואינו מהווה צד לכל התקשרות כספית או חוזית המתקיימת מחוץ למסגרת האתר. כל התקשרות בין משתמשים או בין משתמש/ת לגורם חיצוני נעשית באחריותם הבלעדית של הצדדים המעורבים.</p>
                      
                      <p className="font-black text-slate-800 underline">קישורים ותכנים חיצוניים</p>
                      <p>באתר עשויים להופיע קישורים, הפניות או אזכורים לגורמים חיצוניים. הנהלת האתר אינה אחראית לתוכן, לאמינות, לזמינות או לפעילות של אתרים, שירותים או גורמים חיצוניים אלו, והשימוש בהם הוא באחריות המשתמש/ת בלבד.</p>
                      
                      <p className="font-black text-slate-800 underline">פרטיות ושמירת מידע</p>
                      <p>האתר מכבד את פרטיות המשתמשים. מסירת מידע אישי, פרסומו או שיתופו באתר נעשים ביוזמת המשתמש/ת ובאחריותו/ה בלבד. הנהלת האתר אינה אחראית לשימוש שייעשה במידע אישי שפורסם בפומבי על ידי המשתמש/ת.</p>
                      
                      <p className="font-black text-slate-800 underline">התנהלות ושיח קהילתי</p>
                      <p>המשתמשים מתחייבים לנהל שיח מכבד, אחראי ורגיש. הנהלת האתר שומרת לעצמה את הזכות להסיר תכנים, להגביל גישה או לחסום משתמש/ת, לפי שיקול דעתה, במקרה של הפרת תקנון זה או פגיעה ברוח הקהילה.</p>
                      
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