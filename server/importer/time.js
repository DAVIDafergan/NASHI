// Israel-time helpers (no dependency: Intl knows Asia/Jerusalem incl. DST).
const TZ = 'Asia/Jerusalem';
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

/** Instant → { date: 'YYYY-MM-DD', time: 'HH:MM' } in Israel time. */
export function israelParts(d) {
  const p = Object.fromEntries(fmt.formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Israel wall-clock (y,m,d,h,mi) → instant. */
export function fromIsraelLocal(y, m, d, h = 0, mi = 0) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  // offset of Israel at that moment (2 or 3 hours); iterate twice around DST edges
  let t = guess;
  for (let k = 0; k < 2; k++) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map(x => [x.type, x.value]));
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    t = guess - (asUtc - t);
  }
  return new Date(t);
}

/**
 * Parses the date formats seen on ticketing sites into an instant:
 *  - unix seconds / ms (number or numeric string)
 *  - Google Calendar "20261105T193000" (Israel local) or "20261105T173000Z" (UTC)
 *  - "2026-11-05 19:30[:00]" / "2026-11-05T19:30" (Israel local) / ISO with offset
 *  - "05/11/2026 19:30" or "05.11.2026 19:30" (Israel local, day first)
 * Returns null when nothing sensible (a date without a time is treated as incomplete: returns null).
 */
export function parseWhen(v) {
  if (v === null || v === undefined || v === '' || v === '0' || v === 0) return null;
  if (typeof v === 'number' || /^\d{9,13}$/.test(String(v).trim())) {
    const n = Number(v);
    const d = new Date(n < 1e12 ? n * 1000 : n);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  let m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(s);
  if (m) return m[7] ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])) : fromIsraelLocal(+m[1], +m[2], +m[3], +m[4], +m[5]);
  if (/[+-]\d{2}:?\d{2}$|Z$/.test(s) && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/.exec(s);
  if (m) return fromIsraelLocal(+m[1], +m[2], +m[3], +m[4], +m[5]);
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})\s+(\d{1,2}):(\d{2})/.exec(s);
  if (m) return fromIsraelLocal(+m[3], +m[2], +m[1], +m[4], +m[5]);
  return null;
}

/** NASHI stores `date` the way the admin form does: midnight UTC of the (Israel) calendar day. */
export const nashiDate = (instant) => new Date(`${israelParts(instant).date}T00:00:00.000Z`);
