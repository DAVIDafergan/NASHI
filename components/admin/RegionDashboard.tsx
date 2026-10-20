import React, { useMemo } from 'react';
import { CalendarDays, GraduationCap, HeartHandshake, Gift, Plus, ArrowLeft, MapPin } from 'lucide-react';
import { AdminTab } from './AdminShell';
import { regionName, CITIES } from '../../shared/regions';

type Props = {
  region: string; name?: string;
  go: (t: AdminTab) => void; create: (t: AdminTab) => void;
  data: { events: any[]; classes: any[]; lotteries: any[]; community: any[] };
};

/** Home screen of a regional manager: what she has in her region + one-tap create. */
const RegionDashboard: React.FC<Props> = ({ region, name, go, create, data }) => {
  const upcoming = useMemo(() => data.events.filter(e => new Date(e.date) >= new Date()).sort((a, b) => +new Date(a.date) - +new Date(b.date)), [data.events]);
  const cards: { tab: AdminTab; label: string; n: number; icon: React.ReactNode; add: string }[] = [
    { tab: 'events', label: 'אירועים קרובים', n: upcoming.length, icon: <CalendarDays size={20} />, add: 'אירוע חדש' },
    { tab: 'classes', label: 'חוגים', n: data.classes.length, icon: <GraduationCap size={20} />, add: 'חוג חדש' },
    { tab: 'community', label: 'קהילה וחסד', n: data.community.length, icon: <HeartHandshake size={20} />, add: 'פריט לקהילה' },
    { tab: 'lotteries', label: 'הגרלות', n: data.lotteries.length, icon: <Gift size={20} />, add: 'הגרלה חדשה' },
  ];
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] bg-ink p-6 text-white md:p-8">
        <p className="flex items-center gap-1.5 text-sm text-rose-200"><MapPin size={14} /> מנהלת תרבות</p>
        <h2 className="mt-2 text-3xl !text-white md:text-4xl">שלום{name ? ` ${name}` : ''}, האזור שלך: {regionName(region)}</h2>
        <p className="mt-2 max-w-xl text-white/70">מה שתעלי כאן יופיע לנשים באזור שלך, ובסינון של כל הארץ. הערים באזור: {(CITIES as any)[region]?.slice(0, 6).join(', ')}{(CITIES as any)[region]?.length > 6 ? ' ועוד' : ''}.</p>
        <button onClick={() => go('tickets')} className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-strong text-sm text-rose-800 shadow-lift order-last">🎟️ הנפקת כרטיסים לאירוע</button>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(c => (
          <div key={c.tab} className="rounded-[1.6rem] border border-rose-100 bg-white p-4 shadow-soft">
            <button onClick={() => go(c.tab)} className="w-full text-right">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">{c.icon}</span>
              <p className="mt-3 font-strong text-4xl leading-none text-ink tabular-nums">{c.n}</p>
              <p className="mt-1 text-sm text-slate-500">{c.label}</p>
            </button>
            <button onClick={() => create(c.tab)} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-rose-100 py-2 text-[13px] text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"><Plus size={14} /> {c.add}</button>
          </div>
        ))}
      </section>

      <section className="rounded-[1.8rem] border border-rose-100 bg-white p-5 shadow-soft md:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl">האירועים הקרובים באזור</h3>
          <button onClick={() => go('events')} className="flex items-center gap-1 text-sm text-rose-700">לכל האירועים <ArrowLeft size={14} /></button>
        </div>
        {upcoming.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-slate-500">עדיין אין אירועים קרובים באזור.</p>
            <button onClick={() => create('events')} className="btn-primary mt-4"><Plus size={16} /> העלאת אירוע ראשון</button>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-rose-50">
            {upcoming.slice(0, 6).map(e => (
              <li key={e._id || e.id} className="flex items-center gap-3 py-3">
                <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-rose-50 leading-none text-rose-700">
                  <span className="font-strong text-lg">{new Date(e.date).getDate()}</span>
                  <span className="text-[10px]">{new Date(e.date).toLocaleDateString('he-IL', { month: 'short' })}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-strong text-ink">{e.title}</span>
                  <span className="block truncate text-xs text-slate-500">{e.city || ''}{e.location ? ` · ${e.location}` : ''}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default RegionDashboard;
