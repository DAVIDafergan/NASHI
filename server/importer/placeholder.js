/**
 * Branded placeholder flyer for an imported event whose source has no flyer: NASHI colours, the kind of event,
 * title, date and city — nothing invented. An SVG data: URL, stored like any event image (server/media.js serves it).
 * Events that use it are marked `generatedFlyer: true` so the admin can see them.
 */
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Greedy word wrap by character count (Hebrew glyphs are ~uniform enough for a poster). */
export function wrap(text = '', max = 14, maxLines = 4) {
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= max) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
  return lines;
}

const PALETTES = [
  ['#8A5058', '#3D2F37'], ['#5B6C8F', '#2B2027'], ['#6E8B74', '#2F3B33'], ['#B98B4E', '#4A3524'], ['#7A4E7F', '#2E2231'],
];
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function placeholderFlyerSvg({ title = '', kind = '', dateLabel = '', city = '' }) {
  const [a, b] = PALETTES[hash(title) % PALETTES.length];
  const lines = wrap(title, title.length > 40 ? 16 : 13, 4);
  const size = lines.length > 3 ? 64 : 76;
  const top = 470 - ((lines.length - 1) * size * 1.15) / 2;
  const tspans = lines.map((l, i) => `<text x="400" y="${Math.round(top + i * size * 1.15)}" font-size="${size}" font-weight="700" fill="#fff" text-anchor="middle" direction="rtl">${esc(l)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<radialGradient id="r" cx="0.2" cy="0.1" r="0.7"><stop offset="0" stop-color="#F0D5D6" stop-opacity="0.35"/><stop offset="1" stop-color="#F0D5D6" stop-opacity="0"/></radialGradient></defs>
<rect width="800" height="1000" fill="url(#g)"/><rect width="800" height="1000" fill="url(#r)"/>
<rect x="40" y="40" width="720" height="920" rx="36" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="2"/>
<g font-family="Assistant, 'Noto Sans Hebrew', Arial, sans-serif">
${kind ? `<text x="400" y="190" font-size="44" fill="#F0D5D6" text-anchor="middle" direction="rtl">${esc(kind)}</text>` : ''}
${tspans}
${dateLabel ? `<text x="400" y="770" font-size="40" fill="#fff" fill-opacity="0.92" text-anchor="middle" direction="rtl">${esc(dateLabel)}</text>` : ''}
${city ? `<text x="400" y="830" font-size="40" fill="#fff" fill-opacity="0.92" text-anchor="middle" direction="rtl">${esc(city)}</text>` : ''}
<text x="400" y="915" font-size="46" fill="#fff" fill-opacity="0.85" text-anchor="middle" font-family="Karantina, Assistant, Arial, sans-serif">נשי</text>
</g></svg>`;
}

export const placeholderFlyer = (o) => `data:image/svg+xml;base64,${Buffer.from(placeholderFlyerSvg(o), 'utf8').toString('base64')}`;
