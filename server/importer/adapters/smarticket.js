import { clean, metaContent, decodeEntities } from '../text.js';
import { parseWhen, fromIsraelLocal } from '../time.js';
import { resolveCity } from '../city.js';
import { regionOfCity } from '../../../shared/regions.js';
import { buildDescription } from '../describe.js';

/**
 * SmarTicket (https://<venue>.smarticket.co.il/) — the ticketing template used by many municipal culture halls and
 * community centres. Server-rendered HTML, the same on every venue; no public JSON API.
 *   listing: the home page (all upcoming events) + category pages "<name>_page_<N>" linked from the home nav
 *            (women's categories: נשים, ערבי_נשים, חרדיוות, חרדיות …)
 *   event:   "<slug>/?id=<n>" (links are often RELATIVE, without a leading slash) — has schema.org Event JSON-LD
 *            (name, startDate/endDate in Israel local time, location, offers.price/availability, image), plus
 *            <title> "event • organiser • category", og:image, and HTML fallbacks (date sentence, "מחיר 49 ₪"…).
 * Politeness: one home page + at most 2 women's category pages per venue per run, and at most
 * IMPORTER_SMARTICKET_PER_VENUE (15) event pages per venue per run.
 */

export const DEFAULT_VENUES = [
  'betshemesh', 'netivot', 'netivim', 'matnasgan', 'matnaskg', 'harish', 'petah-tikva', 'makefet', 'mama', 'htma', 'm-zion',
  'netanya', 'kivunimb7', 'eilatmuni', 'menashe', 'eyz', 'maalot', 't-hazafon', 'ksaba', 'batyam', 'lod', 'tarbut-nz',
  'habama', 'telmond', 'mifgashim-mb', 'phk', 'oryehuda', 'arava', 'ramathasharon',
];

/**
 * Venue → its city, used only when the event page has no address we can resolve. '' = unknown / several towns
 * (those events are imported only when the page itself names a city). Verify unclear ones from a captured page.
 */
export const VENUE_CITY = {
  betshemesh: 'בית שמש', netivot: 'נתיבות', netivim: 'נתיבות', matnasgan: 'נתניה', matnaskg: 'קריית גת', harish: 'חריש',
  'petah-tikva': 'פתח תקווה', netanya: 'נתניה', kivunimb7: 'באר שבע', eilatmuni: 'אילת', maalot: 'מעלות-תרשיחא',
  't-hazafon': 'חיפה', ksaba: 'כפר סבא', batyam: 'בת ים', lod: 'לוד', 'tarbut-nz': 'נס ציונה', telmond: 'תל מונד',
  oryehuda: 'אור יהודה', ramathasharon: 'רמת השרון', 'mifgashim-mb': 'מבשרת ציון',
  // regional councils / unclear names: no single city
  menashe: '', eyz: '', arava: '', makefet: '', mama: '', htma: '', 'm-zion': '', habama: '', phk: '',
};

const WOMEN_CATEGORY = /נשים|נשי|חרדי|אמהות|בנות/;
const HAREDI_CATEGORY = /חרדי/;
const WOMEN_HINT = /נשים|לנשים|נשות|נשי|בנות|נערות|אמהות|חרדיות|רבנית|אישה|האישה/;
const envList = (k) => (process.env[k] || '').split(',').map(x => x.trim()).filter(Boolean);
const origin = (venue) => `https://${venue}.smarticket.co.il`;

/** Resolve a (possibly relative, possibly Hebrew) href against the venue; returns a normalized https URL or ''. */
export function resolveHref(venue, href = '') {
  try {
    const h = decodeEntities(href).trim();
    if (!h || h.startsWith('#') || /^(mailto|tel|javascript):/i.test(h)) return '';
    const u = new URL(h, `${origin(venue)}/`);
    if (!u.hostname.endsWith('smarticket.co.il')) return '';
    return u.href;
  } catch { return ''; }
}
const idOf = (url) => (/[?&]id=(\d+)/.exec(url) || /\/event\/(\d+)/.exec(url) || [])[1] || '';

/** Events listed on a home / category page: [{ id, url, title, category }] (deduped by id; header links skipped). */
export function parseListing(venue, html = '') {
  const out = new Map();
  const re = /<a\s[^>]*href="([^"]*(?:\?id=\d+|\/event\/\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = resolveHref(venue, m[1]);
    const id = idOf(url);
    if (!id) continue;
    // listing items carry the show name in <h2 id="show_name_N"> / <h2 id="show_theater_name_N">;
    // header / "featured" links that repeat on every page have no name — skip them (they aren't in this category)
    const h = /<(h[1-4]|div|span)[^>]*id="show_(?:theater_)?name_[^"]*"[^>]*>([\s\S]*?)<\/\1>/i.exec(m[2]);
    const title = h ? clean(h[2], 200) : '';
    if (!title) continue;
    // home items also name their category: <div class="pages">… נשים</div>
    const category = clean((/class="pages">([\s\S]*?)<\/div>/i.exec(m[2]) || [])[1] || '', 80);
    if (!out.has(id)) out.set(id, { id, url: url.replace(/#.*$/, ''), title, category });
  }
  return [...out.values()];
}

/** Category pages linked from the venue nav: [{ name, url, women, haredi }]. */
export function parseCategories(venue, html = '') {
  const out = new Map();
  const re = /href="([^"]*_page_\d+)"/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = resolveHref(venue, m[1]);
    if (!url) continue;
    const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, '').replace(/_page_\d+$/, '')).replace(/_/g, ' ');
    if (!out.has(url)) out.set(url, { name, url, women: WOMEN_CATEGORY.test(name), haredi: HAREDI_CATEGORY.test(name) });
  }
  return [...out.values()];
}

const HEB_MONTHS = { ינואר: 1, פברואר: 2, מרץ: 3, מרס: 3, אפריל: 4, מאי: 5, יוני: 6, יולי: 7, אוגוסט: 8, ספטמבר: 9, אוקטובר: 10, נובמבר: 11, דצמבר: 12 };
/** "ביום שני, 2 בנובמבר 2026" + "בשעה 20:30" → instant (Israel time). */
export function parseHebrewDate(text = '') {
  const d = /(\d{1,2})\s+ב?(ינואר|פברואר|מרץ|מרס|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+(\d{4})/.exec(text);
  const t = /בשעה\s+(\d{1,2}):(\d{2})/.exec(text);
  if (!d || !t) return null;
  return fromIsraelLocal(+d[3], HEB_MONTHS[d[2]], +d[1], +t[1], +t[2]);
}

function jsonLdEvent(html = '') {
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const j = JSON.parse(m[1]);
      for (const x of Array.isArray(j) ? j : [j]) if (x && x['@type'] === 'Event') return x;
    } catch { /* ignore broken blocks */ }
  }
  return null;
}

const nums = (s = '') => (String(s).match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0);

/** Event page → normalized event (same shape as the Tickchak adapter). Pure: tested on the raw captures. */
export function normalizeSmarticket({ html = '', url = '', venue = '', listItem = {} }) {
  const ld = jsonLdEvent(html) || {};
  const titleTag = clean((/<title>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || metaContent(html, 'og:title'), 300);
  const [tEvent = '', organiser = '', category = ''] = titleTag.split(/\s+•\s+/);
  const title = clean(ld.name || (/class="title-name">([\s\S]*?)<\/span>/.exec(html) || [])[1] || tEvent || listItem.title || '', 200);

  const dateText = clean([(/class="event-date">([\s\S]*?)<\/span>/.exec(html) || [])[1], (/class="event-time">([\s\S]*?)<\/span>/.exec(html) || [])[1]].filter(Boolean).join(' '), 120);
  const startAt = parseWhen(ld.startDate) || parseHebrewDate(dateText);
  const endAt = parseWhen(ld.endDate);

  const loc = ld.location || {};
  const theaterText = clean((/class="theater">([\s\S]*?)<\/div>/.exec(html) || [])[1] || '', 200);
  const venueName = clean(loc.name || theaterText, 160);
  const street = clean(loc.streetAddress || loc.address?.streetAddress || '', 160);
  const locality = clean(loc.address?.addressLocality || '', 80);
  const resolved = resolveCity([locality, street].filter(Boolean), venueName, organiser);
  const fallbackCity = VENUE_CITY[venue] || '';
  const online = /zoom|זום|אונליין|מקוון/i.test(venueName);
  const city = resolved?.city || (online ? '' : fallbackCity);

  // price: JSON-LD offer, else "מחיר 65 עד 70 ₪"
  const priceText = clean((/class="price_range">([\s\S]*?)<\/span>/.exec(html) || [])[1] || '', 80);
  const offer = Array.isArray(ld.offers) ? ld.offers[0] : (ld.offers || {});
  const ldPrice = Number(offer.price);
  const textPrices = nums(priceText);
  const isFree = /data-is-free=true/.test(html) || /חינם|ללא תשלום|הכניסה חופשית/.test(priceText);
  const priceMin = Number.isFinite(ldPrice) && ldPrice > 0 ? ldPrice : textPrices.length ? Math.min(...textPrices) : (isFree ? 0 : NaN);
  const priceMax = textPrices.length ? Math.max(...textPrices, priceMin || 0) : priceMin;

  const notOpen = /טרם נפתחה רכישת/.test(html);
  const soldOutText = /הכרטיסים אזלו|אזלו הכרטיסים/.test(html);
  const soldOut = soldOutText || (!notOpen && /SoldOut/i.test(offer.availability || ''));

  const about = clean((/class="txt_container">([\s\S]*?)<\/div>/.exec(html) || [])[1] || '', 3000).replace(/^פרטים נוספים\s*/, '');
  const pageUrl = metaContent(html, 'og:url') || url;
  let ticketUrl = '';
  try { const u = new URL(pageUrl); ticketUrl = /^https?:$/.test(u.protocol) ? u.href.replace(/^http:/, 'https:') : ''; } catch { /* ignore */ }
  const img = metaContent(html, 'og:image') || (Array.isArray(ld.image) ? ld.image[0] : ld.image) || '';
  const imageUrl = img ? (() => { try { const u = new URL(img, `${origin(venue)}/`); u.pathname = u.pathname.replace(/\/{2,}/g, '/'); return u.href; } catch { return ''; } })() : '';

  const n = {
    sourceId: `${venue}:${idOf(ticketUrl || url) || listItem.id || ''}`,
    sourceName: organiser || 'SmarTicket',
    title,
    description: about || clean(metaContent(html, 'og:description'), 1000),
    startAt, endAt,
    venue: venueName,
    location: [venueName, street].filter(Boolean).join(', '),
    city, region: city ? regionOfCity(city) : '', cityHow: resolved ? resolved.how : (city ? 'venue' : ''),
    priceMin, priceMax: Number.isFinite(priceMax) ? priceMax : priceMin, isFree: isFree && !(priceMin > 0),
    tickets: Number.isFinite(priceMin) && priceMin > 0 ? [{ title: '', price: priceMin }] : [],
    soldOut, closed: notOpen,
    ticketUrl, imageUrl,
    category,
    strong: HAREDI_CATEGORY.test(category),
    women: WOMEN_CATEGORY.test(category),
    online,
    extraText: [titleTag, metaContent(html, 'og:description'), category && `קטגוריה: ${category}`].filter(Boolean).join('\n'),
  };
  n.rawDescription = n.description;
  n.description = buildDescription(n, [about]);
  return n;
}

export function createSmarticketAdapter({
  venues = envList('IMPORTER_SMARTICKET_VENUES').length ? envList('IMPORTER_SMARTICKET_VENUES') : DEFAULT_VENUES,
  perVenue = Number(process.env.IMPORTER_SMARTICKET_PER_VENUE || 15),
  maxCategoryPages = 2,
} = {}) {
  return {
    id: 'smarticket',
    name: 'SmarTicket (היכלי תרבות ומתנ"סים)',
    async discover(http, ctx) {
      const all = [];
      for (const venue of venues) {
        await ctx.channel(`smarticket ${venue}`, async () => {
          const { text: home } = await http.getText(`${origin(venue)}/`);
          const found = new Map();
          const add = (it, patch) => {
            const prev = found.get(it.id);
            found.set(it.id, { sourceId: `${venue}:${it.id}`, venue, url: it.url, strong: !!(prev?.strong || patch.strong), women: !!(prev?.women || patch.women), listItem: { id: it.id, title: it.title || prev?.listItem?.title || '' } });
          };
          // women's categories first (they are the strongest signal), then women-looking titles on the home page
          for (const cat of parseCategories(venue, home).filter(c => c.women).slice(0, maxCategoryPages)) {
            const { text } = await http.getText(cat.url);
            for (const it of parseListing(venue, text)) add(it, { women: true, strong: cat.haredi });
          }
          for (const it of parseListing(venue, home)) {
            if (WOMEN_CATEGORY.test(it.category)) add(it, { women: true, strong: HAREDI_CATEGORY.test(it.category) });
            else if (WOMEN_HINT.test(it.title)) add(it, { women: true });
          }
          const list = [...found.values()].sort((a, b) => (b.strong - a.strong) || (b.women - a.women)).slice(0, perVenue);
          all.push(...list);
        });
      }
      return all;
    },
    async details(c, http) {
      const { text, url } = await http.getText(c.url);
      const n = normalizeSmarticket({ html: text, url, venue: c.venue, listItem: c.listItem });
      if (!n.title) { const e = new Error('לא נמצאו פרטי אירוע בדף'); e.skip = true; throw e; }
      n.strong = n.strong || c.strong;
      n.women = n.women || c.women;
      return n;
    },
  };
}
