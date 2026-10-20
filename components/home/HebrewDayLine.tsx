import React from 'react';
import { useCalendar, hhmm } from '../../hooks/useCalendar';
import { useMyPlace } from '../../hooks/useMyPlace';

// nearest of the four computed cities for the visitor's region
const TIMES_FOR_REGION: Record<string, string> = { north: 'haifa', haifa: 'haifa', sharon: 'telaviv', center: 'telaviv', jerusalem: 'jerusalem', shomron: 'jerusalem', south: 'beersheva' };

/** "ט׳ חשון תשפ״ז · פרשת לך־לך · הדלקת נרות 17:18 (ירושלים)" */
const HebrewDayLine: React.FC<{ className?: string }> = ({ className = '' }) => {
  const cal = useCalendar();
  const { region } = useMyPlace(null);
  if (!cal) return null;
  const t = cal.times?.[TIMES_FOR_REGION[region] || 'jerusalem'];
  const candles = t?.candles ? new Date(t.candles) : null;
  const soon = candles && candles.getTime() - Date.now() < 3 * 864e5 && candles.getTime() > Date.now();
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-500 ${className}`}>
      <span>{cal.hebrewDate}</span>
      {cal.holiday && <><span className="text-rose-300">·</span><span className="text-rose-700">{cal.holiday}</span></>}
      {cal.parasha && <><span className="text-rose-300">·</span><span>{cal.parasha}</span></>}
      {soon && t && <><span className="text-rose-300">·</span><span>🕯️ הדלקת נרות {hhmm(t.candles)} · צאת {hhmm(t.havdalah)} ({t.name})</span></>}
    </p>
  );
};

export default HebrewDayLine;
