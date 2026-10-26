import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, CheckCircle2, PlayCircle, Mail, Calendar, GraduationCap, HeartHandshake, Gift, Sparkles,
  Quote, Image as ImageIcon, Megaphone, Bell, Users, MessageSquare, Ticket, Send, Settings, Menu, X, Plus,
  Search, MapPin, ArrowRight, ExternalLink, Bot, Store,
} from 'lucide-react';
import { REGIONS } from '../../shared/regions';
import Logo from '../Logo';

export type AdminTab =
  | 'dashboard' | 'approvals' | 'stories' | 'messages'
  | 'events' | 'classes' | 'community' | 'lotteries' | 'personality' | 'inspirations' | 'flyers' | 'ads' | 'announcements'
  | 'users' | 'forum' | 'tickets' | 'broadcast' | 'settings' | 'importer' | 'suppliers';

export type NavItem = { id: AdminTab; label: string; icon: React.ReactNode; hint: string };

export const NAV: { group: string; items: NavItem[] }[] = [
  { group: '', items: [{ id: 'dashboard', label: 'לוח בקרה', icon: <LayoutDashboard size={18} />, hint: 'תמונת מצב ומה מחכה לך' }] },
  {
    group: 'ממתין לטיפול', items: [
      { id: 'approvals', label: 'אישורים', icon: <CheckCircle2 size={18} />, hint: 'בקשות הצטרפות למעגל ופוסטים לפורום' },
      { id: 'stories', label: 'סטטוסים', icon: <PlayCircle size={18} />, hint: 'סטטוסים שממתינים לאישור ופעילים עכשיו' },
      { id: 'messages', label: 'פניות', icon: <Mail size={18} />, hint: 'הודעות שהגיעו מטופס צור קשר' },
    ],
  },
  {
    group: 'תוכן באתר', items: [
      { id: 'events', label: 'אירועים', icon: <Calendar size={18} />, hint: 'כל האירועים, לפי עיר ואזור' },
      { id: 'classes', label: 'חוגים', icon: <GraduationCap size={18} />, hint: 'חוגים וסדנאות קבועים' },
      { id: 'community', label: 'קהילה וחסד', icon: <HeartHandshake size={18} />, hint: 'שיעורי תורה, גמ"חים ועסקים מקומיים' },
      { id: 'lotteries', label: 'הגרלות', icon: <Gift size={18} />, hint: 'הגרלות, משימות והגרלת שולחן שבת' },
      { id: 'personality', label: 'אישיות השבוע', icon: <Sparkles size={18} />, hint: 'שאלונים, אישורים וארכיון' },
      { id: 'inspirations', label: 'השראה יומית', icon: <Quote size={18} />, hint: 'משפט השראה בדף הבית, עם תזמון' },
      { id: 'flyers', label: 'פליירים', icon: <ImageIcon size={18} />, hint: 'קרוסלת הפליירים בדף הבית' },
      { id: 'ads', label: 'פרסומות', icon: <Megaphone size={18} />, hint: 'באנרים וסרטונים בדף הבית' },
      { id: 'announcements', label: 'הודעות הנהלה', icon: <Bell size={18} />, hint: 'לוח המודעות בדף הבית' },
      { id: 'importer', label: 'סוכן אירועים', icon: <Bot size={18} />, hint: 'ייבוא אוטומטי של אירועים חרדיים מאתרי כרטיסים (כבוי כרגע)' },
    ],
  },
  { group: 'ספקים', items: [{ id: 'suppliers', label: 'מאגר ספקים', icon: <Store size={18} />, hint: 'ספקים בתשלום חודשי, סטטוס תשלום ואישורים' }] },
  {
    group: 'קהילה', items: [
      { id: 'users', label: 'משתמשים', icon: <Users size={18} />, hint: 'כל הנרשמים, נקודות וחברות במעגל' },
      { id: 'forum', label: 'פורום', icon: <MessageSquare size={18} />, hint: 'ניהול הדיונים בפורום' },
      { id: 'tickets', label: 'כרטיסים', icon: <Ticket size={18} />, hint: 'כרטיסי כניסה עם ברקוד לאירועים' },
    ],
  },
  { group: 'תקשורת', items: [{ id: 'broadcast', label: 'דיוור במייל', icon: <Send size={18} />, hint: 'מייל לכל הנרשמים' }] },
  { group: '', items: [{ id: 'settings', label: 'הגדרות', icon: <Settings size={18} />, hint: 'ניקוד ונקודות' }] },
];

export const navItem = (id: AdminTab) => NAV.flatMap(g => g.items).find(i => i.id === id)!;

const AdminShell: React.FC<{
  active: AdminTab;
  onNavigate: (t: AdminTab) => void;
  counts: Partial<Record<AdminTab, number>>;
  adminName?: string;
  primary?: { label: string; onClick: () => void } | null;
  region: string; setRegion: (r: string) => void;
  search: string; setSearch: (s: string) => void;
  showRegion?: boolean; showSearch?: boolean;
  loading?: boolean;
  /** regional manager: only these tabs, and her region instead of the region chips */
  allowed?: AdminTab[];
  lockedRegionName?: string;
  children: React.ReactNode;
}> = ({ active, onNavigate, counts, adminName, primary, region, setRegion, search, setSearch, showRegion, showSearch, loading, allowed, lockedRegionName, children }) => {
  const [drawer, setDrawer] = useState(false);
  const item = navItem(active);
  useEffect(() => { setDrawer(false); }, [active]);
  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawer]);

  const nav = (
    <nav className="space-y-4" aria-label="ניווט ניהול">
      {NAV.map(g => ({ ...g, items: g.items.filter(i => !allowed || allowed.includes(i.id)) })).filter(g => g.items.length).map((g, gi) => (
        <div key={gi}>
          {g.group && <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-rose-500/80">{g.group}</p>}
          <ul className="space-y-0.5">
            {g.items.map(i => {
              const on = i.id === active;
              const n = counts[i.id] || 0;
              return (
                <li key={i.id}>
                  <button onClick={() => onNavigate(i.id)} aria-current={on ? 'page' : undefined}
                    className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-right text-[14.5px] transition ${on ? 'bg-rose-700 text-white shadow-lift' : 'text-slate-600 hover:bg-white hover:text-rose-800'}`}>
                    <span className={on ? 'text-white' : 'text-rose-400 group-hover:text-rose-600'}>{i.icon}</span>
                    <span className={`flex-1 ${on ? 'font-strong' : ''}`}>{i.label}</span>
                    {n > 0 && <span className={`min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold tabular-nums ${on ? 'bg-white text-rose-700' : 'bg-rose-600 text-white'}`}>{n > 99 ? '99+' : n}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="relative -mx-4 -mt-4 min-h-[80vh] md:-mx-8" dir="rtl">
      <div className="mx-auto flex max-w-[1500px] gap-6 px-3 md:px-6">
        {/* sidebar (desktop) */}
        <aside className="sticky top-24 hidden h-[calc(100vh-7rem)] w-64 shrink-0 flex-col overflow-y-auto rounded-[2rem] border border-rose-100/80 bg-white/60 p-4 lg:flex">
          <div className="mb-5 flex items-center justify-between px-2">
            <div>
              <Logo size="sm" />
              <p className="text-[11px] text-slate-400">{lockedRegionName ? `ניהול תרבות · ${lockedRegionName}` : 'מערכת ניהול'}</p>
            </div>
            <Link to="/" className="flex items-center gap-1 rounded-full border border-rose-100 px-2.5 py-1 text-[11px] text-slate-500 hover:text-rose-700"><ExternalLink size={12} /> לאתר</Link>
          </div>
          {nav}
        </aside>

        {/* main column */}
        <div className="min-w-0 flex-1 pb-24">
          <header className="mb-5 pt-1 md:pt-2">
            <div className="flex items-center gap-3">
              <button onClick={() => setDrawer(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-100 bg-white text-ink lg:hidden" aria-label="תפריט ניהול">
                <Menu size={20} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="eyebrow hidden md:block">{active === 'dashboard' ? `שלום${adminName ? `, ${adminName}` : ''}` : 'ניהול'}</p>
                <h1 className="truncate text-[1.6rem] leading-tight md:text-[2.3rem]">{item.label}</h1>
                <p className="hidden truncate text-sm text-slate-500 md:block">{item.hint}</p>
              </div>
              {primary && (
                <button onClick={primary.onClick} className="btn-primary shrink-0 !px-4 !py-2.5 md:!px-6 md:!py-3">
                  <Plus size={17} /> <span className="hidden sm:inline">{primary.label}</span><span className="sm:hidden">חדש</span>
                </button>
              )}
            </div>
            {(showRegion || showSearch) && (
              <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
                {showSearch && (
                  <div className="flex flex-1 items-center gap-2 rounded-2xl border border-rose-100 bg-white px-3.5 md:max-w-sm">
                    <Search size={16} className="text-rose-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש ברשימה…" className="h-11 flex-1 bg-transparent text-[15px] outline-none" />
                    {search && <button onClick={() => setSearch('')} className="text-slate-400 hover:text-rose-600" aria-label="ניקוי"><X size={15} /></button>}
                  </div>
                )}
                {showRegion && lockedRegionName && (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-rose-700 px-3.5 py-2 text-[13px] text-white"><MapPin size={13} /> האזור שלך: {lockedRegionName}</span>
                )}
                {showRegion && !lockedRegionName && (
                  <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
                    <button onClick={() => setRegion('all')} className={`flex shrink-0 items-center gap-1 rounded-full border px-3.5 py-2 text-[13px] transition ${region === 'all' ? 'border-rose-700 bg-rose-700 text-white' : 'border-rose-100 bg-white text-slate-600 hover:border-rose-300'}`}>
                      <MapPin size={13} /> כל הארץ
                    </button>
                    {REGIONS.map(r => (
                      <button key={r.id} onClick={() => setRegion(r.id)} className={`shrink-0 rounded-full border px-3.5 py-2 text-[13px] transition ${region === r.id ? 'border-rose-700 bg-rose-700 text-white' : 'border-rose-100 bg-white text-slate-600 hover:border-rose-300'}`}>{r.name}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </header>
          {loading && <div className="mb-4 h-1 overflow-hidden rounded-full bg-rose-100"><div className="h-full w-1/3 animate-pulse rounded-full bg-rose-400" /></div>}
          {children}
        </div>
      </div>

      {/* drawer (mobile / tablet) */}
      {drawer && createPortal(
        <div className="fixed inset-0 z-[300] bg-ink/40 lg:hidden" onClick={() => setDrawer(false)}>
          <aside onClick={e => e.stopPropagation()} className="absolute inset-y-0 right-0 flex w-[84%] max-w-[320px] flex-col overflow-y-auto bg-[#FBF7F4] p-4 pb-10 shadow-2xl animate-fade-in" dir="rtl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <Logo size="sm" />
                <p className="text-[11px] text-slate-400">מערכת ניהול</p>
              </div>
              <button onClick={() => setDrawer(false)} className="rounded-full bg-white p-2 shadow-soft" aria-label="סגירה"><X size={18} /></button>
            </div>
            {nav}
            <Link to="/" onClick={() => setDrawer(false)} className="mt-6 flex items-center justify-center gap-1.5 rounded-2xl border border-rose-100 bg-white py-3 text-sm text-slate-600"><ArrowRight size={15} /> חזרה לאתר</Link>
          </aside>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminShell;
