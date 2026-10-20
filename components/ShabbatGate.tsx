import React, { useEffect, useState } from 'react';
import { useCalendar, hhmm } from '../hooks/useCalendar';

/** While Shabbat or Yom Tov is in, the whole site shows a quiet "Shabbat Shalom" screen. */
const ShabbatGate: React.FC = () => {
  const cal = useCalendar();
  const [, force] = useState(0);
  // re-check locally every minute so the screen lifts on time even between server polls
  useEffect(() => { const t = window.setInterval(() => force(x => x + 1), 60 * 1000); return () => window.clearInterval(t); }, []);
  if (!cal?.rest?.active || !cal.rest.until) return null;
  if (Date.now() >= new Date(cal.rest.until).getTime()) return null;
  const isHoliday = !!cal.holiday && !/שבת/.test(cal.holiday);
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-hidden bg-[#FBF7F4] px-6 text-center" dir="rtl" role="dialog" aria-label="שבת שלום">
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60vmax 45vmax at 50% 0%, rgba(240,213,214,0.7), transparent 70%), radial-gradient(50vmax 40vmax at 50% 110%, rgba(247,237,230,0.9), transparent 70%)' }} />
      <div className="relative max-w-md">
        <div className="mx-auto flex items-end justify-center gap-5" aria-hidden="true">
          {[0, 1].map(i => (
            <div key={i} className="flex flex-col items-center">
              <span className="block h-7 w-4 rounded-full bg-gradient-to-t from-amber-400 via-amber-300 to-yellow-100 shadow-[0_0_30px_10px_rgba(251,191,36,0.35)] animate-pulse" />
              <span className="mt-1 block h-24 w-6 rounded-md bg-white shadow-soft" />
            </div>
          ))}
        </div>
        <p className="mt-10 font-accent text-7xl text-rose-700">{isHoliday ? 'חג שמח' : 'שבת שלום'}</p>
        <p className="mt-3 font-display text-2xl text-ink">{isHoliday ? cal.holiday : cal.parasha}</p>
        <p className="mx-auto mt-5 max-w-sm leading-relaxed text-slate-600">
          נשי שומרת שבת וחג. נחזור במוצאי {isHoliday ? 'החג' : 'השבת'}, בשעה {hhmm(cal.rest.until)}.
        </p>
        <p className="mt-8 text-xs text-slate-400">{cal.hebrewDate}</p>
      </div>
    </div>
  );
};

export default ShabbatGate;
