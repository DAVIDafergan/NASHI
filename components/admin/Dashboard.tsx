import React, { useMemo, useState } from 'react';
import {
  Users, UserPlus, CheckCircle2, PlayCircle, Calendar, Mail, ArrowLeft, Sparkles, GraduationCap, Gift, Quote,
  Bell, ChevronLeft, ChevronRight, MessageSquare, Eye, TrendingUp, HeartHandshake, ShieldCheck,
} from 'lucide-react';
import { REGIONS } from '../../shared/regions';
import type { AdminTab } from './AdminShell';
import { Badge, idOf, regionOfItem, LocationBadges } from './ui';

type Props = {
  data: {
    users: any[]; events: any[]; classes: any[]; lotteries: any[]; community: any[];
    pendingUsers: any[]; pendingPosts: any[]; pendingStories: any[]; activeStories: any[]; messages: any[]; managerApps?: any[];
  };
  go: (t: AdminTab) => void;
  create: (t: AdminTab) => void;
};

const DAY = 864e5;

const Kpi: React.FC<{ label: string; value: React.ReactNode; icon: React.ReactNode; tone: string; sub?: string; onClick?: () => void }> = ({ label, value, icon, tone, sub, onClick }) => (
  <button type="button" onClick={onClick} className="group flex flex-col rounded-[1.4rem] border border-rose-100/80 bg-white p-3.5 text-right shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift md:rounded-[1.6rem] md:p-5">
    <span className={`flex h-9 w-9 items-center justify-center rounded-2xl md:h-10 md:w-10 ${tone}`}>{icon}</span>
    <span className="mt-2.5 font-display text-[1.7rem] leading-none text-ink tabular-nums md:mt-3 md:text-[2.4rem]">{value}</span>
    <span className="mt-1.5 text-[13px] text-slate-500">{label}</span>
    {sub && <span className="mt-1 text-[11.5px] font-semibold text-emerald-600">{sub}</span>}
  </button>
);

const Dashboard: React.FC<Props> = ({ data, go, create }) => {
  const { users, events, classes, lotteries, community, pendingUsers, pendingPosts, pendingStories, activeStories, messages } = data;
  const managerApps = data.managerApps || [];
  const now = Date.now();
  const [monthOffset, setMonthOffset] = useState(0);

  const newThisWeek = users.filter(u => u.createdAt && now - new Date(u.createdAt).getTime() < 7 * DAY).length;
  const unread = messages.filter(m => !m.isRead).length;
  const upcoming = useMemo(() => events
    .filter(e => e.date && new Date(e.date).getTime() >= now - DAY)
    .sort((a, b) => +new Date(a.date) - +new Date(b.date)), [events, now]);

  const queue = [
    { n: managerApps.length, label: 'בקשות לניהול תרבות', tab: 'approvals' as AdminTab, icon: <ShieldCheck size={18} /> },
    { n: pendingUsers.length, label: 'בקשות הצטרפות למעגל', tab: 'approvals' as AdminTab, icon: <UserPlus size={18} /> },
    { n: pendingPosts.length, label: 'פוסטים לפורום שממתינים', tab: 'approvals' as AdminTab, icon: <MessageSquare size={18} /> },
    { n: pendingStories.length, label: 'סטטוסים שממתינים לאישור', tab: 'stories' as AdminTab, icon: <PlayCircle size={18} /> },
    { n: unread, label: 'פניות שלא נקראו', tab: 'messages' as AdminTab, icon: <Mail size={18} /> },
  ].filter(q => q.n > 0);

  // members by region (old accounts with no city count as Migdal HaEmek → north)
  const byRegion = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach(u => { const r = u.city || u.region ? regionOfItem(u) : 'unknown'; counts[r] = (counts[r] || 0) + 1; });
    const rows = REGIONS.map(r => ({ id: r.id, name: r.name, n: counts[r.id] || 0 }));
    if (counts.unknown) rows.push({ id: 'unknown', name: 'עוד לא בחרו עיר', n: counts.unknown } as any);
    return rows;
  }, [users]);
  const maxRegion = Math.max(1, ...byRegion.map(r => r.n));

  // month summary (kept from the old "סיכום חודשי")
  const month = useMemo(() => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + monthOffset);
    const m = d.getMonth(), y = d.getFullYear();
    const inMonth = (x?: string) => { if (!x) return false; const t = new Date(x); return t.getMonth() === m && t.getFullYear() === y; };
    return {
      name: d.toLocaleString('he-IL', { month: 'long', year: 'numeric' }),
      newUsers: users.filter(u => inMonth(u.createdAt)).length,
      events: events.filter(e => inMonth(e.date)).length,
      stories: activeStories.filter(s => inMonth(s.createdAt)).length,
      views: activeStories.reduce((a, s) => a + (s.views || 0), 0),
      points: users.reduce((a, u) => a + (u.points || 0), 0),
      members: users.filter(u => u.isMemberApproved).length,
    };
  }, [users, events, activeStories, monthOffset]);

  return (
    <div className="flex flex-col gap-6">
      {/* KPIs (on phones they come after "what's waiting") */}
      <div className="order-2 grid grid-cols-2 gap-3 md:order-none md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="משתמשים רשומים" value={users.length.toLocaleString('he-IL')} icon={<Users size={19} />} tone="bg-rose-50 text-rose-600" sub={newThisWeek ? `+${newThisWeek} השבוע` : undefined} onClick={() => go('users')} />
        <Kpi label="חדשים השבוע" value={newThisWeek} icon={<UserPlus size={19} />} tone="bg-emerald-50 text-emerald-600" onClick={() => go('users')} />
        <Kpi label="ממתינים לאישור" value={pendingUsers.length + pendingPosts.length} icon={<CheckCircle2 size={19} />} tone="bg-amber-50 text-amber-600" onClick={() => go('approvals')} />
        <Kpi label="סטטוסים באוויר" value={activeStories.length} icon={<PlayCircle size={19} />} tone="bg-plum-50 text-plum-600" onClick={() => go('stories')} />
        <Kpi label="אירועים קרובים" value={upcoming.length} icon={<Calendar size={19} />} tone="bg-sky-50 text-sky-600" onClick={() => go('events')} />
        <Kpi label="פניות פתוחות" value={unread} icon={<Mail size={19} />} tone="bg-red-50 text-red-500" onClick={() => go('messages')} />
      </div>

      <div className="order-1 grid gap-6 md:order-none xl:grid-cols-[1.25fr_1fr]">
        {/* what's waiting */}
        <section className="rounded-[2rem] border border-rose-100/80 bg-white p-5 shadow-soft md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl">מה מחכה לך</h3>
            {queue.length > 0 && <Badge tone="amber">{queue.reduce((a, q) => a + q.n, 0)} פריטים</Badge>}
          </div>
          {queue.length === 0 ? (
            <div className="flex flex-col items-center rounded-[1.5rem] bg-gradient-to-l from-emerald-50 to-white py-10 text-center">
              <span className="text-4xl">✨</span>
              <p className="mt-3 font-strong text-lg text-ink">הכול מטופל</p>
              <p className="text-sm text-slate-500">אין אישורים או פניות שמחכים כרגע.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {queue.map(q => (
                <li key={q.label}>
                  <button onClick={() => go(q.tab)} className="group flex w-full items-center gap-4 rounded-2xl border border-rose-100 bg-rose-50/40 px-4 py-3.5 text-right transition hover:border-rose-300 hover:bg-white">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-rose-600 shadow-soft">{q.icon}</span>
                    <span className="flex-1">
                      <span className="block font-strong text-[15px] text-ink">{q.label}</span>
                      <span className="text-xs text-slate-500">לטיפול</span>
                    </span>
                    <span className="min-w-[34px] rounded-full bg-rose-600 px-2.5 py-1 text-center text-sm font-bold text-white tabular-nums">{q.n}</span>
                    <ArrowLeft size={17} className="text-rose-300 transition group-hover:-translate-x-1 group-hover:text-rose-600" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mb-2 mt-6 text-[13px] font-semibold text-slate-600">יצירה מהירה</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { t: 'events' as AdminTab, label: 'אירוע חדש', icon: <Calendar size={17} /> },
              { t: 'classes' as AdminTab, label: 'חוג חדש', icon: <GraduationCap size={17} /> },
              { t: 'community' as AdminTab, label: 'פריט לקהילה', icon: <HeartHandshake size={17} /> },
              { t: 'lotteries' as AdminTab, label: 'הגרלה חדשה', icon: <Gift size={17} /> },
              { t: 'inspirations' as AdminTab, label: 'השראה חדשה', icon: <Quote size={17} /> },
              { t: 'announcements' as AdminTab, label: 'הודעה חדשה', icon: <Bell size={17} /> },
            ].map(a => (
              <button key={a.t} onClick={() => create(a.t)} className="flex items-center gap-2 rounded-2xl border border-rose-100 bg-white px-3.5 py-3 text-[14px] text-slate-700 transition hover:border-rose-300 hover:text-rose-700">
                <span className="text-rose-500">{a.icon}</span> {a.label}
              </button>
            ))}
          </div>
        </section>

        {/* upcoming events */}
        <section className="rounded-[2rem] border border-rose-100/80 bg-white p-5 shadow-soft md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl">אירועים קרובים</h3>
            <button onClick={() => go('events')} className="text-sm text-rose-700 hover:underline">לכל האירועים</button>
          </div>
          {upcoming.length === 0 ? (
            <div className="rounded-2xl bg-rose-50/50 p-6 text-center text-sm text-slate-500">
              אין אירועים קרובים. <button onClick={() => create('events')} className="font-strong text-rose-700">ליצירת אירוע ←</button>
            </div>
          ) : (
            <ul className="divide-y divide-rose-50">
              {upcoming.slice(0, 6).map(e => {
                const d = new Date(e.date);
                return (
                  <li key={idOf(e)} className="flex items-center gap-3 py-3">
                    <span className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-rose-50 py-1.5 text-rose-700">
                      <span className="font-display text-xl leading-none">{d.getDate()}</span>
                      <span className="text-[10px]">{d.toLocaleString('he-IL', { month: 'short' })}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-strong text-[14.5px] text-ink">{e.title}</span>
                      <span className="mt-0.5 block"><LocationBadges item={e} /></span>
                    </span>
                    {(e.attendees?.length || 0) > 0 && <span className="text-xs text-slate-400">{e.attendees.length} נרשמו</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="order-3 grid gap-6 md:order-none xl:grid-cols-2">
        {/* members by region */}
        <section className="rounded-[2rem] border border-rose-100/80 bg-white p-5 shadow-soft md:p-6">
          <h3 className="mb-1 text-xl">משתמשים לפי אזור</h3>
          <p className="mb-4 text-xs text-slate-500">חשבונות ותיקים בלי עיר נספרים כמגדל העמק (צפון ועמקים).</p>
          <ul className="space-y-2.5">
            {byRegion.map(r => (
              <li key={r.id} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3 text-sm">
                <span className="truncate text-slate-600">{r.name}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-rose-50">
                  <span className="block h-full rounded-full bg-gradient-to-l from-rose-400 to-rose-600 transition-all duration-700" style={{ width: `${(r.n / maxRegion) * 100}%` }} />
                </span>
                <span className="text-left font-semibold tabular-nums text-ink">{r.n}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* month summary */}
        <section className="rounded-[2rem] bg-ink p-5 text-white shadow-lift md:p-6">
          <div className="mb-5 flex items-center justify-between">
            <button onClick={() => setMonthOffset(o => o - 1)} className="rounded-full p-2 hover:bg-white/10" aria-label="חודש קודם"><ChevronRight size={20} /></button>
            <div className="text-center">
              <p className="text-xs text-white/60">סיכום חודשי</p>
              <h3 className="text-2xl !text-white">{month.name}</h3>
            </div>
            <button onClick={() => setMonthOffset(o => Math.min(0, o + 1))} disabled={monthOffset === 0} className="rounded-full p-2 hover:bg-white/10 disabled:opacity-30" aria-label="חודש הבא"><ChevronLeft size={20} /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { l: 'נרשמים חדשים', v: month.newUsers, i: <UserPlus size={15} /> },
              { l: 'אירועים', v: month.events, i: <Calendar size={15} /> },
              { l: 'חברי מעגל', v: month.members, i: <Sparkles size={15} /> },
              { l: 'סטטוסים', v: month.stories, i: <PlayCircle size={15} /> },
              { l: 'צפיות בסטטוסים', v: month.views, i: <Eye size={15} /> },
              { l: 'נקודות בקהילה', v: month.points.toLocaleString('he-IL'), i: <TrendingUp size={15} /> },
            ].map(x => (
              <div key={x.l} className="rounded-2xl bg-white/[0.07] p-3">
                <span className="text-rose-200">{x.i}</span>
                <p className="mt-1 font-display text-2xl leading-none tabular-nums text-white">{x.v}</p>
                <p className="mt-1 text-[11px] text-white/60">{x.l}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[12px] text-white/70">
            <span>{classes.length} חוגים</span><span>{community.length} בקהילה</span><span>{lotteries.length} הגרלות</span>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
