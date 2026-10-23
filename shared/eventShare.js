// Event share wording — shared by the server (/s/event/:id preview) and the site (WhatsApp message).
import { eventStartMs } from './eventTime.js';

const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const fmt = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : null;
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** "יום שני 2.11 · י״א חשון · 20:30" (Hebrew date only when known). */
export function whenText(e = {}, hebrewDate = e.hebrewDate) {
  const s = eventStartMs(e);
  let day = '';
  let time = (String(e.time || '').match(/^\d{1,2}:\d{2}/) || [])[0] || '';
  if (Number.isFinite(s) && fmt) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(s)).map(x => [x.type, x.value]));
    day = `יום ${WEEKDAYS[WD[p.weekday]]} ${Number(p.day)}.${Number(p.month)}`;
    time = time || `${p.hour}:${p.minute}`;
  } else if (e.date) {
    const d = new Date(e.date);
    if (!isNaN(d)) day = `יום ${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
  }
  return [day, hebrewDate, time].filter(Boolean).join(' · ');
}

export function whereText(e = {}) {
  if (e.scope === 'online') return 'מקוון';
  const loc = String(e.location || '').trim();
  const city = String(e.city || '').trim();
  if (!city || loc.includes(city)) return loc || city;
  return loc ? `${loc}, ${city}` : city;
}

export function priceText(e = {}) {
  if (e.soldOut) return 'אזלו הכרטיסים';
  const p = Number(e.price);
  if (!Number.isFinite(p)) return '';
  return p > 0 ? `₪${Math.round(p)}` : 'חינם';
}

/** One line for previews: "📅 … · 📍 … · ₪49". */
export function factsLine(e = {}, hebrewDate) {
  const parts = [];
  const w = whenText(e, hebrewDate);
  if (w) parts.push(`📅 ${w}`);
  const where = whereText(e);
  if (where) parts.push(`📍 ${where}`);
  const pr = priceText(e);
  if (pr) parts.push(`🎟️ ${pr}`);
  return parts.join(' · ');
}

/** The WhatsApp message: title, when, where, price — and the link LAST so WhatsApp builds the preview from it. */
export function shareMessage(e = {}, url = '') {
  const lines = [`*${String(e.title || '').trim()}*`];
  const w = whenText(e);
  if (w) lines.push(`📅 ${w}`);
  const where = whereText(e);
  if (where) lines.push(`📍 ${where}`);
  const pr = priceText(e);
  if (pr) lines.push(`🎟️ ${pr}`);
  if (url) lines.push('', url);
  return lines.join('\n');
}

export const eventSharePath = (id) => `/s/event/${id}`;
export const eventDeepLink = (id) => `/#/events?e=${id}`;
