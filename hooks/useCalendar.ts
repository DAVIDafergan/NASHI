import { useEffect, useState } from 'react';

const API_URL = (import.meta as any).env?.VITE_API_URL || '/api';

export type CalendarInfo = {
  now: string; hebrewDate: string; parasha: string | null; holiday: string | null;
  rest: { active: boolean; from?: string; until?: string; nextFrom?: string | null; nextUntil?: string | null };
  times: Record<string, { name: string; candles: string | null; havdalah: string | null }>;
};

let shared: CalendarInfo | null = null;
let inflight: Promise<CalendarInfo | null> | null = null;
const load = () => {
  if (!inflight) {
    inflight = fetch(`${API_URL}/calendar`).then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then(d => { shared = d; window.setTimeout(() => { inflight = null; }, 60 * 1000); return d; });
  }
  return inflight;
};

/** Hebrew date, parasha, Shabbat times and whether the site is resting now. Refreshes every 5 minutes. */
export function useCalendar() {
  const [info, setInfo] = useState<CalendarInfo | null>(shared);
  useEffect(() => {
    let alive = true;
    const tick = () => load().then(d => { if (alive && d) setInfo(d); });
    tick();
    const t = window.setInterval(tick, 5 * 60 * 1000);
    return () => { alive = false; window.clearInterval(t); };
  }, []);
  return info;
}

export const hhmm = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' }) : '');
