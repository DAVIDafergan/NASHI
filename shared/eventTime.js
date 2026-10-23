// When does an event END? Shared by the server (cleanup job, GET /events) and the website (the "עבר" badge).
//   1. endAt when known (imported events)
//   2. start + 3 hours — start = startAt, or the event's date + its "HH:MM" time (Israel time)
//   3. otherwise the end of its date
// After it ends an event shows "עבר" for 48 hours, then it is gone for good.

export const PAST_GRACE_MS = 48 * 3600 * 1000;
const DEFAULT_LENGTH_MS = 3 * 3600 * 1000;

const fmt = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : null;
/** Israel wall-clock → epoch ms (handles DST). */
export function israelLocalMs(y, m, d, h = 0, mi = 0) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  if (!fmt) return guess - 2 * 3600e3;
  let t = guess;
  for (let k = 0; k < 2; k++) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map(x => [x.type, x.value]));
    t = guess - (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t);
  }
  return t;
}

const ms = (v) => { if (!v) return NaN; const t = new Date(v).getTime(); return Number.isFinite(t) ? t : NaN; };

/** Epoch ms of the event's start (NaN when unknown). */
export function eventStartMs(e = {}) {
  const s = ms(e.startAt);
  if (Number.isFinite(s)) return s;
  const d = ms(e.date);
  if (!Number.isFinite(d)) return NaN;
  const day = new Date(d).toISOString().slice(0, 10); // admin forms store the calendar day as midnight UTC
  const t = /^(\d{1,2}):(\d{2})/.exec(String(e.time || ''));
  const [y, m, dd] = day.split('-').map(Number);
  return t ? israelLocalMs(y, m, dd, +t[1], +t[2]) : NaN;
}

/** Epoch ms when the event is over. */
export function eventEndMs(e = {}) {
  const base = baseEndMs(e);
  // a series ends with its last session
  const last = Math.max(-Infinity, ...(Array.isArray(e.sessions) ? e.sessions : []).map(s => ms(s && s.date)).filter(Number.isFinite));
  if (Number.isFinite(last)) {
    const [y, m, dd] = new Date(last).toISOString().slice(0, 10).split('-').map(Number);
    const sEnd = israelLocalMs(y, m, dd, 23, 59);
    return Number.isFinite(base) ? Math.max(base, sEnd) : sEnd;
  }
  return base;
}

function baseEndMs(e) {
  const end = ms(e.endAt);
  const start = eventStartMs(e);
  if (Number.isFinite(end) && (!Number.isFinite(start) || end >= start)) return end;
  if (Number.isFinite(start)) return start + DEFAULT_LENGTH_MS;
  const d = ms(e.date);
  if (!Number.isFinite(d)) return NaN;
  const [y, m, dd] = new Date(d).toISOString().slice(0, 10).split('-').map(Number);
  return israelLocalMs(y, m, dd, 23, 59);
}

export const isEventPast = (e, now = Date.now()) => { const t = eventEndMs(e); return Number.isFinite(t) && t < now; };
/** Past AND the 48-hour "עבר" window is over → never shown again. */
export const isEventExpired = (e, now = Date.now()) => { const t = eventEndMs(e); return Number.isFinite(t) && t + PAST_GRACE_MS < now; };
