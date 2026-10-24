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
 *                         The home's section / "הצג הכל" pages (home.glatticket.co.il/<slug>), the LIVE hub pages it links to
 *                         (performances-for-women + its city pages) and sub-site sale pages (tiferet./restart.glatticket.co.il/<hash>)
 *                         are followed too — all strong; events listed under a women's heading/page count as women-only.
 *   3. Tickchak search  → POST /ajax/homepage/get_events with many Hebrew search terms, 100 per page.
 *   4. Bulk scan        → the same call with an empty search, paged until empty (IMPORTER_BULK_MAX, 0 = off);
 *                         a find only this scan made gets a details request when its listing already looks like a women's event.
 * An event page with several dates becomes one event per date (splitDates).
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
  // women-only / Haredi audience first
  'לנשים בלבד', 'לנשים', 'נשים', 'ערב נשים', 'כנס נשים', 'הצגה לנשים', 'מופע לנשים', 'הרצאה לנשים', 'מחזמר לנשים',
  'לבנות', 'לבנות סמינר', 'סמינר', 'חרדיות', 'לנשים חרדיות', 'חסידי', 'ברוח ההלכה', 'ללא סרטים', 'השלוחה החרדית',
  'נשות', 'בנות', 'נערות', 'רבנית', 'מחזמר', 'הפקה', 'הצגה', 'מופע', 'התוועדות', 'הרצאה', 'יום עיון', 'שיעור',
  'בית מדרש', 'הפרשת חלה', 'ראש חודש', 'חנוכה',
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

// Glatticket sub-sites sell with a hash id instead: https://tiferet.glatticket.co.il/<hash>, https://restart.glatticket.co.il/<hash>
const HASH_SALE_URL = /https?:\/\/((?!home\.|live\.|www\.|static\.)[a-z0-9-]+\.glatticket\.co\.il)\/([A-Za-z0-9_-]{5,64})(?=[?#"'\s<\\/]|$)/g;
// listing pages on the Glatticket side: home.glatticket.co.il/<slug> ("הצג הכל" pages) and LIVE hub pages
const SECTION_URL = /^https?:\/\/(?:home\.glatticket\.co\.il\/[^\s"'#?]+|live\.tickchak\.co\.il\/[^\s"'#?]+)/i;
const NOT_SECTION = /\.(?:png|jpe?g|gif|webp|svg|css|js|ico|pdf|xml|json)$|\/(?:login|account|cart|privacy|terms|policy|takanon|contact|about|search)(?:\/|$)/i;
/** Which section heading counts as "women only" on a Glatticket page. */
export const WOMEN_SECTION = /הופעות לנשים|מופעים לנשים|לנשים בלבד|נשים בלבד|לנשים|נשים|performances[-_]for[-_]women|women/i;

function saleLink(u) {
  SALE_URL.lastIndex = 0;
  const a = SALE_URL.exec(u);
  if (a) return { key: a[2], eid: a[2], host: a[1], url: `https://${a[1]}.co.il/${a[2]}` };
  HASH_SALE_URL.lastIndex = 0;
  const b = HASH_SALE_URL.exec(u);
  if (b && !/^(?:performances|events?|category|categories|search|page|about|contact)$/i.test(b[2])) return { key: `${b[1]}/${b[2]}`, eid: '', host: b[1], url: `https://${b[1]}/${b[2]}` };
  return null;
}

/**
 * Sale pages found in a Glatticket / LIVE page, with hints:
 *   women (any women hint), section (the heading it is listed under), womenSection (listed under a women-only heading),
 *   soldOut, title, startDate + dates (every date the page lists for it).
 */
export function parseEventLinks(html = '', { womenHeading = /נשים|לנשים/, sectionHint = '' } = {}) {
  const out = new Map(); // key -> { key, eid, host, url, women, womenSection, section, soldOut, title, startDate, dates }
  const add = (link, patch = {}) => {
    const prev = out.get(link.key) || { ...link, women: false, womenSection: false, section: '', soldOut: false, title: '', startDate: '', dates: [] };
    const dates = [...new Set([...prev.dates, ...(patch.dates || [])])].sort();
    out.set(link.key, {
      ...prev, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v && !Array.isArray(v))),
      soldOut: prev.title ? prev.soldOut : !!patch.soldOut,
      women: prev.women || !!patch.women, womenSection: prev.womenSection || !!patch.womenSection,
      section: prev.section || patch.section || '', dates,
    });
  };
  const sectionHintWomen = !!sectionHint && womenHeading.test(sectionHint);
  // 1. structured data (preferred: has the name, date and availability)
  for (const ev of jsonLdEvents(html)) {
    const offers = (Array.isArray(ev.offers) ? ev.offers : [ev.offers]).filter(Boolean);
    const link = [ev['@id'], ev.url, ...offers.map(o => o?.url)].filter(Boolean).map(u => saleLink(String(u))).find(Boolean);
    if (!link) continue;
    const subs = (Array.isArray(ev.subEvent) ? ev.subEvent : []).map(x => x?.startDate).filter(Boolean);
    const dates = [...(Array.isArray(ev.startDate) ? ev.startDate : [ev.startDate]), ...subs].filter(Boolean).map(String);
    add(link, {
      title: clean(ev.name || '', 200), startDate: dates[0] || '', dates,
      women: WOMEN_HINT.test(`${ev.name || ''} ${ev.description || ''}`) || sectionHintWomen,
      womenSection: sectionHintWomen, section: sectionHint,
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
    const link = saleLink(m[1].startsWith('//') ? `https:${m[1]}` : m[1]);
    if (!link) continue;
    const section = sectionAt(m.index) || sectionHint;
    const ws = womenHeading.test(section);
    add(link, { women: ws, womenSection: ws, section });
  }
  return [...out.values()];
}

/** Listing pages linked from a Glatticket page ("הצג הכל" / section pages / LIVE hubs), with the heading they sit under. */
export function sectionPages(html = '', base = GLATTICKET_HOME) {
  const heads = [];
  const hre = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi;
  let m;
  while ((m = hre.exec(html))) heads.push({ at: m.index, text: clean(m[1], 200) });
  const sectionAt = (pos) => { let h = ''; for (const x of heads) { if (x.at <= pos) h = x.text; else break; } return h; };
  const out = new Map();
  const lre = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = lre.exec(html))) {
    let u;
    try { u = new URL(decodeEntities(m[1]), base).href.replace(/#.*$/, ''); } catch { continue; }
    if (!SECTION_URL.test(u) || NOT_SECTION.test(u.replace(/[?#].*$/, '')) || saleLink(u)) continue;
    const clean0 = u.replace(/\/$/, '');
    if (clean0 === base.replace(/\/$/, '') || /\/(?:hKpLyNdxl)$/.test(clean0)) continue;
    const label = clean(m[2], 120);
    const section = [sectionAt(m.index), label].filter(Boolean).join(' · ');
    const prev = out.get(clean0);
    out.set(clean0, { url: clean0, section: prev?.section || section, women: (prev?.women) || WOMEN_SECTION.test(`${section} ${clean0}`) });
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

/** Every start time an event lists: form/init session arrays, the sale page's JSON-LD, the listing's dates. */
export function eventDates({ init, pageHtml = '', listDates = [] } = {}) {
  const ev = init?.event || {};
  const raw = [];
  for (const k of ['dates', 'sessions', 'events_dates', 'event_dates', 'times', 'shows', 'performances', 'sub_events']) {
    const arr = ev[k] ?? init?.[k];
    if (Array.isArray(arr)) for (const x of arr) raw.push(typeof x === 'object' && x ? (x.time_start ?? x.start ?? x.startDate ?? x.date ?? x.time) : x);
  }
  for (const e of jsonLdEvents(pageHtml)) {
    for (const d of Array.isArray(e.startDate) ? e.startDate : [e.startDate]) raw.push(d);
    for (const x of Array.isArray(e.subEvent) ? e.subEvent : []) raw.push(x?.startDate);
  }
  raw.push(...listDates);
  const seen = new Map();
  for (const r of raw) {
    const d = r == null || r === '' ? null : parseWhen(r);
    if (d && !Number.isNaN(+d)) seen.set(+d, d);
  }
  return [...seen.values()].sort((a, b) => a - b);
}

/**
 * One NASHI event per date: an event page listing several start times becomes several events (same flyer/link).
 * The first date keeps the plain id (so nothing already imported changes id); the others are "<eid>@<ISO start>".
 */
export function splitDates(n, opts = {}) {
  const dates = eventDates(opts);
  const base = n.startAt ? +n.startAt : null;
  // dates closer than 3h are the same show written twice (doors vs. start, a rounded listing time)
  const all = [];
  for (const d of [...(n.startAt ? [n.startAt] : []), ...dates]) if (!all.some(x => Math.abs(+x - +d) < 3 * 3600e3)) all.push(d);
  all.sort((a, b) => a - b);
  if (all.length < 2) return n;
  const dur = n.startAt && n.endAt ? +n.endAt - +n.startAt : 0;
  const first = base ?? +all[0];
  return all.map(d => {
    if (+d === first) return { ...n, startAt: d };
    return { ...n, sourceId: `${n.sourceId}@${d.toISOString()}`, startAt: d, endAt: dur > 0 ? new Date(+d + dur) : null };
  });
}

/** form/init JSON (+ page data) → normalized event used by the pipeline. Pure: unit-tested on real + synthetic fixtures. */
export function normalizeTickchak({ init, pageUrl, pageHtml = '', listItem = {}, strong = false, women = false, womenSection = false, section = '' }) {
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
    women: women || womenSection,
    womenSection,
    // listed under a women-only section of Glatticket ("הופעות לנשים"): kept as the source category, so re-checks know it too
    category: womenSection ? (/נשים/.test(section) ? clean(section.split(' · ')[0], 60) || 'לנשים בלבד' : 'לנשים בלבד') : '',
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
  glattSections = Number(process.env.IMPORTER_GLATT_SECTION_PAGES || 40),
  bulkMax = Number(process.env.IMPORTER_BULK_MAX ?? 10000),
} = {}) {
  return {
    id: 'tickchak',
    name: "טיקצ'אק / גלאטיקט",
    /** → candidates: [{ sourceId, url, strong, women, listItem }] */
    async discover(http, ctx) {
      const found = new Map();
      const add = (eid, patch) => {
        const prev = found.get(eid) || { sourceId: eid, url: `${TICKCHAK}/${eid}`, strong: false, women: false, womenSection: false, bulk: false, listItem: isEid(eid) ? { eid } : {} };
        found.set(eid, {
          ...prev, ...patch,
          strong: prev.strong || !!patch.strong, women: prev.women || !!patch.women, womenSection: prev.womenSection || !!patch.womenSection,
          bulk: found.has(eid) ? prev.bulk && !!patch.bulk : !!patch.bulk,
          section: prev.section || patch.section || '',
          url: prev.strong && !patch.strong ? prev.url : (patch.url || prev.url),
          listItem: { ...prev.listItem, ...(patch.listItem || {}), dates: [...new Set([...(prev.listItem.dates || []), ...(patch.listItem?.dates || [])])] },
        });
      };
      const addGlatt = (l, extra = {}) => add(l.key, {
        strong: true, women: l.women || extra.women, womenSection: l.womenSection || !!extra.women, section: l.section || extra.section || '',
        url: l.eid ? `https://glatticket.co.il/${l.eid}` : l.url,
        listItem: { ...(l.title ? { title: l.title } : {}), soldOutHint: l.soldOut, dates: l.dates },
      });
      // 1. Glatticket home (strong) — and every section / "הצג הכל" page / LIVE hub it links to (also strong)
      const glattPages = [];
      await ctx.channel('glatticket-home', async () => {
        const { text } = await http.getText(glatticketHome);
        for (const l of parseEventLinks(text, { womenHeading: WOMEN_SECTION })) addGlatt(l);
        glattPages.push(...sectionPages(text, glatticketHome));
      });
      const seenPages = new Set([glatticketHome.replace(/\/$/, '')]);
      for (let i = 0; i < glattPages.length && seenPages.size <= glattSections; i++) {
        const pg = glattPages[i];
        if (seenPages.has(pg.url)) continue;
        seenPages.add(pg.url);
        await ctx.channel(`glatticket ${pg.url.replace(/^https:\/\//, '')}`, async () => {
          const { text } = await http.getText(pg.url);
          const hint = `${pg.section} ${pg.url}`;
          for (const l of parseEventLinks(text, { womenHeading: WOMEN_SECTION, sectionHint: pg.women ? hint : '' })) addGlatt(l, { women: pg.women, section: pg.section });
          // regional / "show all" pages one level down (e.g. performances-for-women/<city>)
          for (const r of [...liveRegionPages(text).map(url => ({ url, section: pg.section, women: true })), ...sectionPages(text, pg.url)]) {
            if (!seenPages.has(r.url) && !glattPages.some(x => x.url === r.url)) glattPages.push({ ...r, women: r.women || pg.women });
          }
        }, { soft: true });
      }
      // 2. LIVE hubs (category hint only) — and the regional women pages linked from them
      const regional = new Set();
      for (const hub of hubs) {
        await ctx.channel(`hub ${hub.replace(/^https:\/\//, '')}`, async () => {
          const { text } = await http.getText(hub);
          for (const r of liveRegionPages(text)) regional.add(r);
          for (const l of parseEventLinks(text, { womenHeading: /./ })) if (!found.has(l.key)) add(l.key, { women: /women|tzama/i.test(hub) || l.women, womenSection: /women/i.test(hub), url: l.url, listItem: { dates: l.dates } });
        });
      }
      // 2b. optional listing pages (LIVE regional women pages, LIVE categories, tickchak /courses /festivals /events)
      for (const hub of [...[...regional].slice(0, liveRegions), ...softHubs]) {
        await ctx.channel(`page ${hub.replace(/^https:\/\//, '')}`, async () => {
          const { text } = await http.getText(hub);
          for (const l of parseEventLinks(text, { womenHeading: /נשים|לנשים/ })) if (!found.has(l.key)) add(l.key, { women: l.women || /women/i.test(hub), womenSection: /women/i.test(hub), url: l.url, listItem: { dates: l.dates } });
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
      // 4. bulk scan: the whole catalogue (empty search, paged until it runs dry) — classified like everything else
      const queries = [...searchTerms.map(term => ({ term, cat: '' })), ...cats.map(cat => ({ term: '', cat })), ...(bulkMax > 0 ? [{ term: '', cat: '', bulk: true }] : [])];
      for (const { term, cat, bulk } of queries) {
        await ctx.channel(bulk ? 'סריקה מלאה (get_events)' : term ? `search "${term}"` : `category ${cat}`, async () => {
          const limit = bulk ? bulkMax : maxPerTerm;
          for (let offset = 0; offset < limit; offset += pageSize) {
            const json = await http.postForm(`${TICKCHAK}/ajax/homepage/get_events`, { limit: pageSize, offset, search: term, cat_id: cat });
            const events = Array.isArray(json?.events) ? json.events : [];
            for (const e of events) {
              const eid = String(e.eid || '').trim();
              if (!isEid(eid)) continue;
              const prev = found.get(eid);
              // real `link` is "tickchak.co.il/112712?ref=1B1O" (no scheme) — we use the clean sale page
              const host = /glatticket/i.test(String(e.link || '')) ? 'https://glatticket.co.il' : TICKCHAK;
              add(eid, { listItem: e, url: prev?.url || `${host}/${eid}`, bulk: !!bulk });
            }
            if (!events.length || (!bulk && events.length < pageSize)) break;
          }
        }, { soft: !term });
      }
      return [...found.values()];
    },
    /** Cheap pre-check on listing data, before spending requests on details. → reason string or '' */
    prefilter(c, now = new Date(), mode) {
      if (c.strong) return '';
      const li = c.listItem || {};
      const start = parseWhen(li.time_start);
      if (start && start <= now) return 'עבר';
      if (li.title || li.description) {
        const r = classifyEvent({ title: li.title, description: li.description, location: li.location, strong: false, ...(mode ? { mode } : {}) });
        // at list level we only drop clear "no"s (hard rejects); the rest is decided after the details
        if (!r.ok && (r.hard || (r.reason !== 'לא נמצא סימון שהאירוע לנשים' && !r.reason.startsWith('אין סימן') && !r.reason.startsWith('לא מסומן') && !c.women))) return r.reason;
        // found only by the bulk scan: spend a details request only when the listing already looks like a women's event
        if (c.bulk && !c.women && !r.ok && !r.reason.startsWith('אין סימן') && !/glatticket/i.test(String(li.link || ''))) return `סריקה מלאה: ${r.reason}`;
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
      const n = normalizeTickchak({ init, pageUrl: page.url, pageHtml: page.text, listItem: c.listItem, strong: c.strong, women: c.women, womenSection: c.womenSection, section: c.section });
      return splitDates(n, { init, pageHtml: page.text, listDates: c.listItem?.dates || [] });
    },
  };
}
