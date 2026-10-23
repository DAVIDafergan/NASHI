import { phpUnserialize } from '../php.js';
import { clean, metaContent, decodeEntities } from '../text.js';
import { parseWhen } from '../time.js';
import { resolveCity } from '../city.js';
import { classifyEvent } from '../classify.js';
import { buildDescription, pageSources } from '../describe.js';

/**
 * Tickchak (tickchak.co.il) and its Haredi portal Glatticket (glatticket.co.il — "תרבות ברוח ההלכה").
 * Same backend, so one adapter with isolated discovery channels:
 *   1. Glatticket home  → every event linked there is a STRONG signal (Haredi audience);
 *                         events under a "…נשים…" heading also count as a women's category.
 *   2. LIVE hubs        → live.tickchak.co.il/performances-for-women, /tzama-5787 (women's category hint).
 *                         NB: LIVE is an aggregator ("updated by AI from the sale sites"), so its ids are only
 *                         candidates — we import only what resolves to a real Tickchak sale page (step 3).
 *   3. Tickchak search  → POST /ajax/homepage/get_events with many Hebrew search terms, 100 per page.
 * Details (all channels): GET https://<domain>/<eid> → event_hash (inline or in static.tickchak.co.il/js/ev_….js)
 *   → POST https://<same host>/ajax/form/init {event, lang:'he', source:'landing'} → event + tickets.
 */

export const TICKCHAK = 'https://tickchak.co.il';
export const GLATTICKET_HOME = 'https://home.glatticket.co.il/';
export const LIVE_HUBS = ['https://live.tickchak.co.il/performances-for-women', 'https://live.tickchak.co.il/tzama-5787'];
// optional listing pages (failures here never block the "gone from the source" check)
export const SOFT_HUBS = [
  'https://live.tickchak.co.il/Performances_for_women', 'https://live.tickchak.co.il/Lectures', 'https://live.tickchak.co.il/presentations',
  'https://live.tickchak.co.il/musical', 'https://tickchak.co.il/courses', 'https://tickchak.co.il/festivals', 'https://tickchak.co.il/events',
];
export const SEARCH_TERMS = [
  // audience
  'נשים', 'לנשים', 'לנשים בלבד', 'נשות', 'בנות', 'נערות', 'אמהות', 'אמא', 'רבנית', 'ערב נשים', 'כנס נשים',
  // kinds of events
  'הצגה', 'מופע', 'מחזמר', 'הפקה', 'ערב', 'כנס', 'התוועדות', 'הרצאה', 'סדנה', 'זמרת', 'ערב שירה', 'יום עיון',
  'שיעור', 'חוג', 'קורס', 'בית מדרש', 'הפרשת חלה', 'חלות', 'טיול נשים', 'סיור נשים', 'ריקוד נשים', 'זומבה', 'התעמלות',
  'מחול', 'אומנות', 'יצירה', 'העצמה', 'הקרנה', 'סרט', 'ראש חודש', 'מסיבת סיום', 'שבת', 'חנוכה',
];
// Tickchak search matches titles, and titles often carry the city — religious / Haredi cities first
export const CITY_TERMS = [
  'בני ברק', 'ירושלים', 'אלעד', 'מודיעין עילית', 'קרית ספר', 'ביתר', 'בית שמש', 'צפת', 'טבריה', 'אשדוד', 'נתיבות',
  'אופקים', 'קרית גת', 'רכסים', 'חיפה', 'פתח תקווה', 'נתניה', 'רחובות', 'באר שבע', 'עמנואל', 'חריש', 'טלזסטון',
  'בית שאן', 'עפולה', 'מגדל העמק', 'כרמיאל', 'נוף הגליל', 'קרית שמונה', 'אשקלון', 'קרית מלאכי', 'דימונה', 'ערד',
  'גבעת זאב', 'מעלה אדומים', 'אפרת', 'קרית ארבע', 'אריאל', 'קרני שומרון', 'קדומים', 'יבנה', 'לוד', 'רמלה', 'חדרה',
  'בת ים', 'חולון', 'רמת גן', 'גבעתיים', 'ראשון לציון', 'אור יהודה', 'קרית אתא', 'קרית ביאליק', 'נהריה', 'עכו',
];
const envList = (k) => (process.env[k] || '').split(',').map(x => x.trim()).filter(Boolean);

// Tickchak / Glatticket sale pages are https://<domain>/<numeric eid> (e.g. tickchak.co.il/113538, glatticket.co.il/113204),
// links often carry ?ref=… / ?_ref=… / #event. (LIVE aggregator ids like "hKpLyNdxl" are NOT sale pages.)
const EID = /^\d{4,8}$/;
export const isEid = (s) => EID.test(String(s ?? ''));
const SALE_URL = /https?:\/\/(?:www\.)?(glatticket|tickchak)\.co\.il\/(\d{4,8})(?=[?#"'\s<\\/]|$)/g;

const WOMEN_HINT = /נשים|לנשים|נשות|נשי|בנות|נערות|אמהות|רבנית/;

/** schema.org Event objects from <script type="application/ld+json"> blocks (Glatticket home / LIVE hubs use an @graph). */
export function jsonLdEvents(html = '') {
  const out = [];
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  const walk = (x) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { x.forEach(walk); return; }
    const t = x['@type'];
    if (t === 'Event' || (Array.isArray(t) && t.includes('Event'))) out.push(x);
    for (const v of Object.values(x)) if (v && typeof v === 'object') walk(v);
  };
  while ((m = re.exec(html))) { try { walk(JSON.parse(m[1])); } catch { /* broken block */ } }
  return out;
}

/** Sale-page event ids found in a Glatticket / LIVE page, with hints (women's event? sold out?). */
export function parseEventLinks(html = '', { womenHeading = /נשים|לנשים/ } = {}) {
  const out = new Map(); // eid -> { eid, host, women, soldOut, title, startDate }
  const add = (eid, host, patch = {}) => {
    const prev = out.get(eid) || { eid, host, women: false, soldOut: false, title: '', startDate: '' };
    out.set(eid, { ...prev, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v)), women: prev.women || !!patch.women });
  };
  // 1. structured data (preferred: has the name, date and availability)
  for (const ev of jsonLdEvents(html)) {
    const urls = [ev['@id'], ev.url, ...(Array.isArray(ev.offers) ? ev.offers : [ev.offers]).map(o => o?.url)].filter(Boolean).join(' ');
    SALE_URL.lastIndex = 0;
    const m = SALE_URL.exec(urls);
    if (!m) continue;
    const offers = (Array.isArray(ev.offers) ? ev.offers : [ev.offers]).filter(Boolean);
    add(m[2], m[1], {
      title: clean(ev.name || '', 200), startDate: ev.startDate || '',
      women: WOMEN_HINT.test(`${ev.name || ''} ${ev.description || ''}`),
      soldOut: offers.length > 0 && offers.every(o => /SoldOut/i.test(o.availability || '')),
    });
  }
  // 2. plain links, with the heading they appear under
  const heads = [];
  const hre = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi;
  let m;
  while ((m = hre.exec(html))) heads.push({ at: m.index, text: clean(m[1], 200) });
  const sectionAt = (pos) => { let h = ''; for (const x of heads) { if (x.at <= pos) h = x.text; else break; } return h; };
  const lre = /href=["']([^"']+)["']/gi;
  while ((m = lre.exec(html))) {
    SALE_URL.lastIndex = 0;
    const u = SALE_URL.exec(m[1].startsWith('//') ? `https:${m[1]}` : m[1]);
    if (!u) continue;
    add(u[2], u[1], { women: womenHeading.test(sectionAt(m.index)) });
  }
  return [...out.values()];
}

/** Regional women pages linked from live.tickchak.co.il/performances-for-women (…/performances-for-women/<region>). */
export function liveRegionPages(html = '') {
  const out = new Set();
  const re = /href=["']((?:https?:\/\/live\.tickchak\.co\.il)?\/performances[-_]for[-_]women\/([a-z0-9-]+))\/?["']/gi;
  let m;
  while ((m = re.exec(html))) if (!/^(event|events|today|tomorrow|thisweek|weekend|dates?)$/i.test(m[2])) out.add(`https://live.tickchak.co.il/performances-for-women/${m[2].toLowerCase()}`);
  return [...out];
}

/** cat_id values used by Tickchak's homepage script (cat_id: 5, data-cat="7", category_id=12 …). */
export function detectCatIds(js = '') {
  const out = new Set();
  const re = /(?:cat_id|catId|category_id|data-cat(?:egory)?(?:-id)?)\s*[:=]\s*["']?(\d{1,4})\b/g;
  let m;
  while ((m = re.exec(js))) if (Number(m[1]) > 0) out.add(m[1]);
  return [...out].slice(0, 40);
}

/** event_hash:"…" from the page or its ev_….js script. */
export const findEventHash = (s = '') => (/event_hash\s*[:=]\s*["']([A-Za-z0-9_\-=]{6,128})["']/.exec(s) || [])[1] || '';
export const findEventScript = (html = '') => (/(https?:)?\/\/static\.tickchak\.co\.il\/js\/ev_[^"'\s>]+\.js[^"'\s>]*/.exec(html) || [])[0] || '';

/** Address strings from the PHP-serialized location_map. */
export function locationStrings(locationMap) {
  const v = typeof locationMap === 'string' ? phpUnserialize(locationMap) : locationMap;
  if (!v || typeof v !== 'object') return { venue: '', parts: [] };
  const flat = [];
  const walk = (x, k = '') => {
    if (x == null) return;
    if (typeof x === 'string') { if (/[֐-׿]/.test(x) || /city|address|title/i.test(k)) flat.push([k, decodeEntities(x)]); return; }
    if (typeof x === 'object') for (const [kk, vv] of Object.entries(x)) walk(vv, kk);
  };
  walk(v);
  const pick = (re) => flat.filter(([k]) => re.test(k)).map(([, s]) => s);
  return {
    venue: (pick(/^title$/i)[0] || pick(/name/i)[0] || '').split(',')[0].trim(),
    // city-ish fields first, then the full addresses
    parts: [...pick(/city|locality|town|עיר/i), ...pick(/cleanTitle/i), ...pick(/address|formatted/i), ...pick(/^title$/i), ...flat.map(([, s]) => s)],
  };
}

const num = (v) => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : NaN; };

const yes = (v) => v === true || v === 1 || v === '1' || v === 'true';

/**
 * Sold out? Real form/init sends `issoldout` as a STRING COUNT of remaining tickets (e.g. "41"), not a flag —
 * so "1" means one ticket left. Sold out = boolean true, a zero count, or no active ticket with stock left.
 */
export function isSoldOut(ev = {}, tickets = [], listItem = {}) {
  const so = ev.issoldout;
  if (so === true) return true;
  if (so !== undefined && so !== null && so !== '' && so !== false && /^\d+$/.test(String(so)) && Number(so) === 0) return true;
  const active = tickets.filter(t => !('active' in t) || yes(t.active));
  if (tickets.length && !active.length) return true;
  const withStock = active.filter(t => t.amount_avaliable !== undefined && t.amount_avaliable !== null);
  if (withStock.length && withStock.length === active.length && withStock.every(t => Number(t.amount_avaliable) <= 0)) return true;
  // the search listing's in_stock is only a fallback: it can be stale/false while form/init still sells tickets
  if (!tickets.length && (listItem.in_stock === false || listItem.in_stock === 0 || listItem.in_stock === '0')) return true;
  return false;
}

/** form/init JSON (+ page data) → normalized event used by the pipeline. Pure: unit-tested on real + synthetic fixtures. */
export function normalizeTickchak({ init, pageUrl, pageHtml = '', listItem = {}, strong = false, women = false }) {
  const ev = init?.event || {};
  const tickets = Array.isArray(init?.tickets) ? init.tickets : [];
  const loc = locationStrings(ev.location_map);
  const evLocation = clean(ev.location || listItem.location || '', 200);
  const venue = (evLocation || loc.venue || '').trim();
  // "אולם רמון, שדרות מנחם בגין, 51, גדרה" — the venue plus the structured address when it adds something
  const address = clean(loc.parts.find(p => /\d|,/.test(p)) || '', 200).replace(/,?\s*ישראל\s*$/, '');
  const location = address && !evLocation.includes(address) && address !== evLocation ? `${evLocation ? `${evLocation}, ` : ''}${address}` : (evLocation || address);
  const resolved = resolveCity(loc.parts, evLocation, listItem.location || '');
  const activeTickets = tickets.filter(t => !('active' in t) || yes(t.active));
  // prices of the tickets on sale; when nothing is on sale (sold out) keep the last known prices
  const priced = activeTickets.length ? activeTickets : tickets;
  const prices = priced.map(t => num(t.price)).filter(n => Number.isFinite(n));
  const paid = prices.filter(n => n > 0);
  const isFree = yes(ev.is_all_free) || (prices.length > 0 && paid.length === 0);
  const startAt = parseWhen(ev.time_start) || parseWhen(ev.time_google_openstart) || parseWhen(listItem.time_start);
  const endAt = parseWhen(ev.time_end) || parseWhen(listItem.time_end);
  const host = (() => { try { return new URL(pageUrl).host; } catch { return ''; } })();
  const glatt = /glatticket/i.test(host) || yes(ev.glatticket_index);
  const eid = String(ev.eid || listItem.eid || '').trim();
  const imageUrl = metaContent(pageHtml, 'og:image') || metaContent(pageHtml, 'twitter:image:src') || listItem.fb_img || '';
  // clean ticket link (no ?ref=…): the sale page on the domain we actually fetched
  const ticketUrl = isEid(eid) && host ? `https://${host}/${eid}` : (pageUrl && /^https?:/.test(pageUrl) ? pageUrl.replace(/^http:/, 'https:').replace(/[?#].*$/, '') : '');
  const n = {
    sourceId: eid,
    sourceName: glatt ? 'גלאטיקט' : "טיקצ'אק",
    title: clean(ev.title || listItem.title || '', 200),
    description: clean(ev.description || listItem.description || '', 3000),
    startAt, endAt,
    venue, location,
    city: resolved?.city || '', region: resolved?.region || '', cityHow: resolved?.how || '',
    priceMin: paid.length ? Math.min(...paid) : (isFree ? 0 : NaN),
    priceMax: paid.length ? Math.max(...paid) : (isFree ? 0 : NaN),
    isFree,
    tickets: activeTickets.map(t => ({ title: clean(t.title || '', 80), price: num(t.price) })).slice(0, 12),
    soldOut: isSoldOut(ev, tickets, listItem),
    closed: yes(ev.closed) || ev.suspended === true || (('active' in ev) && !yes(ev.active)),
    ticketUrl,
    imageUrl: imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl,
    strong: strong || glatt,
    women,
    // more text for the women/Haredi classifier only (not shown): og:description + what the listing said
    extraText: [metaContent(pageHtml, 'og:description'), listItem.title, listItem.description].filter(Boolean).join('\n').slice(0, 2000),
  };
  // full description: the fullest source text, or a factual intro when the source says little
  n.rawDescription = n.description;
  n.description = buildDescription(n, [...pageSources(pageHtml), listItem.description || '']);
  return n;
}

export function createTickchakAdapter({
  searchTerms = [...SEARCH_TERMS, ...(process.env.IMPORTER_CITY_TERMS === '0' ? [] : CITY_TERMS), ...envList('IMPORTER_EXTRA_TERMS')],
  pageSize = 100, maxPerTerm = Number(process.env.IMPORTER_MAX_PER_TERM || 400), glatticketHome = GLATTICKET_HOME, hubs = LIVE_HUBS,
  softHubs = process.env.IMPORTER_SOFT_HUBS === '0' ? [] : SOFT_HUBS,
  catIds = envList('IMPORTER_TICKCHAK_CAT_IDS'), detectCategories = process.env.IMPORTER_DETECT_CATEGORIES !== '0',
  liveRegions = Number(process.env.IMPORTER_LIVE_REGION_PAGES || 15),
} = {}) {
  return {
    id: 'tickchak',
    name: "טיקצ'אק / גלאטיקט",
    /** → candidates: [{ sourceId, url, strong, women, listItem }] */
    async discover(http, ctx) {
      const found = new Map();
      const add = (eid, patch) => {
        const prev = found.get(eid) || { sourceId: eid, url: `${TICKCHAK}/${eid}`, strong: false, women: false, listItem: { eid } };
        found.set(eid, { ...prev, ...patch, strong: prev.strong || !!patch.strong, women: prev.women || !!patch.women, listItem: { ...prev.listItem, ...(patch.listItem || {}) } });
      };
      // 1. Glatticket home (strong)
      await ctx.channel('glatticket-home', async () => {
        const { text } = await http.getText(glatticketHome);
        for (const l of parseEventLinks(text)) add(l.eid, { strong: true, women: l.women, url: `https://glatticket.co.il/${l.eid}`, listItem: { title: l.title, soldOutHint: l.soldOut } });
      });
      // 2. LIVE hubs (category hint only) — and the regional women pages linked from them
      const regional = new Set();
      for (const hub of hubs) {
        await ctx.channel(`hub ${hub.replace(/^https:\/\//, '')}`, async () => {
          const { text } = await http.getText(hub);
          for (const r of liveRegionPages(text)) regional.add(r);
          for (const l of parseEventLinks(text, { womenHeading: /./ })) if (!found.has(l.eid)) add(l.eid, { women: /women|tzama/i.test(hub) || l.women, url: `https://${l.host}.co.il/${l.eid}` });
        });
      }
      // 2b. optional listing pages (LIVE regional women pages, LIVE categories, tickchak /courses /festivals /events)
      for (const hub of [...[...regional].slice(0, liveRegions), ...softHubs]) {
        await ctx.channel(`page ${hub.replace(/^https:\/\//, '')}`, async () => {
          const { text } = await http.getText(hub);
          for (const l of parseEventLinks(text, { womenHeading: /נשים|לנשים/ })) if (!found.has(l.eid)) add(l.eid, { women: l.women || /women/i.test(hub), url: `https://${l.host}.co.il/${l.eid}` });
        }, { soft: true });
      }
      // 2c. category ids for get_events: IMPORTER_TICKCHAK_CAT_IDS, plus whatever homepage.js uses
      let cats = [...catIds];
      if (detectCategories) {
        await ctx.channel('detect categories (homepage.js)', async () => {
          const { text } = await http.getText(`${TICKCHAK}/homepage/homepage.js`);
          cats = [...new Set([...cats, ...detectCatIds(text)])];
        }, { soft: true });
      }
      // 3. Tickchak search: every term with no category, then (empty search) every category
      const queries = [...searchTerms.map(term => ({ term, cat: '' })), ...cats.map(cat => ({ term: '', cat }))];
      for (const { term, cat } of queries) {
        await ctx.channel(term ? `search "${term}"` : `category ${cat}`, async () => {
          for (let offset = 0; offset < maxPerTerm; offset += pageSize) {
            const json = await http.postForm(`${TICKCHAK}/ajax/homepage/get_events`, { limit: pageSize, offset, search: term, cat_id: cat });
            const events = Array.isArray(json?.events) ? json.events : [];
            for (const e of events) {
              const eid = String(e.eid || '').trim();
              if (!isEid(eid)) continue;
              const prev = found.get(eid);
              // real `link` is "tickchak.co.il/112712?ref=1B1O" (no scheme) — we use the clean sale page
              const host = /glatticket/i.test(String(e.link || '')) ? 'https://glatticket.co.il' : TICKCHAK;
              add(eid, { listItem: e, url: prev?.url || `${host}/${eid}` });
            }
            if (events.length < pageSize) break;
          }
        }, { soft: !term });
      }
      return [...found.values()];
    },
    /** Cheap pre-check on listing data, before spending requests on details. → reason string or '' */
    prefilter(c, now = new Date()) {
      if (c.strong) return '';
      const li = c.listItem || {};
      const start = parseWhen(li.time_start);
      if (start && start <= now) return 'עבר';
      if (li.title || li.description) {
        const r = classifyEvent({ title: li.title, description: li.description, location: li.location, strong: false });
        // at list level we only drop clear "no"s; "not sure it's religious" is decided after the details
        if (!r.ok && r.reason !== 'לא ברור שמתאים לציבור הדתי/חרדי' && !c.women) return r.reason;
      }
      return '';
    },
    /** → normalized event (see normalizeTickchak) */
    async details(c, http) {
      const page = await http.getText(c.url);
      let hash = findEventHash(page.text);
      if (!hash) {
        const script = findEventScript(page.text);
        if (script) hash = findEventHash((await http.getText(script.startsWith('//') ? `https:${script}` : script)).text);
      }
      if (!hash) { const e = new Error('לא נמצא event_hash (לא דף מכירה של טיקצ\'אק)'); e.skip = true; throw e; }
      const origin = new URL(page.url).origin;
      const init = await http.postForm(`${origin}/ajax/form/init`, { event: hash, lang: 'he', source: 'landing' });
      if (!init || !init.event) { const e = new Error('form/init החזיר תשובה ריקה'); e.skip = true; throw e; }
      return normalizeTickchak({ init, pageUrl: page.url, pageHtml: page.text, listItem: c.listItem, strong: c.strong, women: c.women });
    },
  };
}
