import { clean, metaContent, decodeEntities, htmlToText } from '../text.js';
import { parseWhen, fromIsraelLocal } from '../time.js';
import { resolveCity } from '../city.js';
import { regionOfCity } from '../../../shared/regions.js';
import { classifyEvent } from '../classify.js';
import { buildDescription, pageSources } from '../describe.js';
import { normalizeSmarticket } from './smarticket.js';

/**
 * "א.ש בינה" (binaa.co.il) — the CMS behind many municipal / community-centre sites. Server-rendered:
 *   list:   https://<site>/events/  (sometimes with a branch: /events/?branch=2)
 *           each item is a link to /events/<id>/ (or straight to the venue's SmarTicket page) whose text reads
 *           "<title> יום ראשון, י"ד חשון התשפ"ז, 25.10.2026 20:30 - 22:00 <place> לפרטים נוספים #נשים#סדנאות לנשים"
 *           (checked on modil.org.il and betshemesh.muni.il, Oct 2026; netivim.org.il lists DD/MM/YYYY and links
 *           every item to netivot.smarticket.co.il). A recurring course repeats the same id once per session.
 *   filter: <select name="…"> options — an audience / category option naming נשים or חרדי is fetched as well.
 *   event:  /events/<id>/ → og:title / h1, og:image (flyer), JSON-LD Event when present, price text ("₪ 40", "ללא עלות").
 * Strict classification still applies: a women's tag (#נשים) is the women signal, the site's city (Modiin Illit,
 * Beit Shemesh, Emanuel) or a Haredi branch the Haredi one. Courses / recurring classes → one event at the next session.
 */

/** host[/path] | city | haredi (1 = the site / branch itself serves the Haredi public). Override: IMPORTER_BINAA_SITES. */
export const DEFAULT_BINAA_SITES = [
  'modil.org.il|מודיעין עילית|1', 'netivim.org.il|נתיבות|', 'betshemesh.muni.il|בית שמש|', 'meytarim-j.org.il/events/?branch=2|ירושלים|1',
  'ofektivi.org.il||', 'qiryat-gat.muni.il|קריית גת|', 'k-m.org.il|קריית מלאכי|', 'matnasgan.org.il|נתניה|', 'matnasyavne.co.il|יבנה|',
  'yavne.muni.il|יבנה|', 'ganeytikva.org.il|גני תקווה|', 'emanuel.muni.il|עמנואל|1', 'nof-hagalil.muni.il|נוף הגליל|', 'arad.muni.il|ערד|',
  'mama.org.il||', 'bney-ayish.muni.il|בני עי"ש|', 'rosh-haayin.muni.il|ראש העין|',
];

/** "modil.org.il|מודיעין עילית|1" → { id, url, origin, city, haredi } */
export function parseSite(spec = '') {
  const [where = '', city = '', haredi = ''] = String(spec).split('|').map(s => s.trim());
  if (!where) return null;
  let url;
  try { url = new URL(/^https?:\/\//.test(where) ? where : `https://${where}`); } catch { return null; }
  if (url.pathname === '/' || !url.pathname) url.pathname = '/events/';
  const branch = url.searchParams.get('branch');
  return {
    id: `${url.hostname.replace(/^www\./, '')}${branch ? `~${branch}` : ''}`,
    url: url.href, origin: url.origin, city, haredi: haredi === '1' || /^(true|yes|haredi|חרדי)$/i.test(haredi),
  };
}

const WOMEN_TAG = /נשים|לנשים|נשות|אמהות|אימהות|חרדיות|רבנית/;
const COURSE = /חוג|חוגים|קורס|קורסים|סדרת|מחזור|שיעור שבועי|שיעורים|מפגשים|סדנאות(?! ואירועים)/;
const DATE_RE = /(\d{1,2})[./](\d{1,2})[./](\d{4})/;
const TIME_RE = /(\d{1,2}):(\d{2})(?:\s*[-–]\s*(\d{1,2}):(\d{2}))?/;
const WEEKDAY_RE = /יום\s+(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)|מוצאי שבת|ללא תאריך/;

/** "25.10.2026" + "20:30 - 22:00" → { startAt, endAt } in Israel time (null when no date). */
export function parseListDate(text = '') {
  const d = DATE_RE.exec(text);
  if (!d) return { startAt: null, endAt: null };
  const after = text.slice(d.index + d[0].length);
  const t = TIME_RE.exec(after) || TIME_RE.exec(text);
  const [y, m, day] = [+d[3], +d[2], +d[1]];
  if (m < 1 || m > 12 || day < 1 || day > 31) return { startAt: null, endAt: null };
  const startAt = fromIsraelLocal(y, m, day, t ? +t[1] : 0, t ? +t[2] : 0);
  const endAt = t && t[3] ? fromIsraelLocal(y, m, day, +t[3], +t[4]) : null;
  return { startAt: t ? startAt : null, endAt, dateOnly: !t ? fromIsraelLocal(y, m, day, 12, 0) : null };
}

/** One list item's text → { title, startAt, endAt, place, tags } */
export function parseItemText(text = '') {
  const t = text.replace(/\s+/g, ' ').trim();
  const tags = [...t.matchAll(/#([^#]+?)(?=#|$)/g)].map(m => m[1].trim()).filter(Boolean);
  const body = t.replace(/#.*$/, '').replace(/לפרטים נוספים|להרשמה|לרכישת כרטיסים/g, ' ').trim();
  const wd = WEEKDAY_RE.exec(body);
  const d = DATE_RE.exec(body);
  // netivim style: "25/10 <title> <place> 25/10/2026 16:00" — a short date first
  let title = (wd ? body.slice(0, wd.index) : d ? body.slice(0, d.index) : body).replace(/^\d{1,2}\/\d{1,2}\s+/, '').replace(/[,\s]+$/, '').trim();
  const { startAt, endAt } = parseListDate(body);
  let place = '';
  if (d) {
    const after = body.slice(d.index + d[0].length);
    const tm = TIME_RE.exec(after);
    place = (tm && tm.index < 12 ? after.slice(tm.index + tm[0].length) : after).replace(/^\s*\+\d+\s*תאריכים\s*/, '').trim();
    if (!place && wd) place = '';
  }
  // "<title> <place> <date>" (netivim): what's between the title and the date is the place — can't split it reliably,
  // so the title keeps it only when there was no weekday marker; the event page title wins anyway
  return { title: title.slice(0, 200), startAt, endAt, place: place.slice(0, 160), tags, untimed: /ללא תאריך/.test(body) };
}

const absUrl = (href, base) => { try { return new URL(decodeEntities(href), base).href.replace(/#.*$/, ''); } catch { return ''; } };

/**
 * Event links on a list page: internal /events/<id>/ and external SmarTicket ones.
 * → [{ key, kind: 'binaa'|'smarticket', id, url, venue?, sessions: [{ startAt, endAt }], title, place, tags }]
 */
export function parseBinaaList(html = '', base = 'https://example.org/events/') {
  const origin = (() => { try { return new URL(base).origin; } catch { return ''; } })();
  const anchors = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = absUrl(m[1], base);
    if (!url) continue;
    let u; try { u = new URL(url); } catch { continue; }
    const own = u.origin.replace('://www.', '://') === origin.replace('://www.', '://');
    const bid = own ? (/^\/events\/(\d+)\/?$/.exec(u.pathname) || [])[1] : '';
    const st = /^([a-z0-9-]+)\.smarticket\.co\.il$/i.exec(u.hostname);
    if (!bid && !(st && u.pathname.length > 1)) continue;
    anchors.push({ at: m.index, end: m.index + m[0].length, url: bid ? `${u.origin}/events/${bid}/` : url, inner: m[2], bid, venue: st ? st[1].toLowerCase() : '' });
  }
  const out = new Map();
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    let text = htmlToText(a.inner);
    // the card may keep its date / place next to the link instead of inside it: look until the next event link
    if (!DATE_RE.test(text) && !/ללא תאריך/.test(text)) {
      const next = anchors[i + 1]?.at ?? Math.min(html.length, a.end + 3000);
      const tail = htmlToText(html.slice(a.end, Math.min(next, a.end + 3000)));
      text = `${text} ${tail}`;
    }
    const it = parseItemText(text);
    if (!it.title && !it.startAt) continue;
    const stId = a.venue ? ((/\/event\/(\d+)/.exec(a.url) || /[?&]id=(\d+)/.exec(a.url) || [])[1] || decodeURIComponent(new URL(a.url).pathname.slice(1)).slice(0, 120)) : '';
    const key = a.bid ? `b:${a.bid}` : `s:${a.venue}:${stId}`;
    const prev = out.get(key) || { key, kind: a.bid ? 'binaa' : 'smarticket', id: a.bid || stId, url: a.url, venue: a.venue, sessions: [], title: '', place: '', tags: [] };
    if (it.startAt && !prev.sessions.some(s => +s.startAt === +it.startAt)) prev.sessions.push({ startAt: it.startAt, endAt: it.endAt });
    prev.title = prev.title || it.title;
    prev.place = prev.place || it.place;
    prev.tags = [...new Set([...prev.tags, ...it.tags])];
    out.set(key, prev);
  }
  for (const v of out.values()) v.sessions.sort((x, y) => x.startAt - y.startAt);
  return [...out.values()];
}

/** Audience / category filter options naming women or Haredi: [{ url, label }] (GET form on the list page). */
export function filterPages(html = '', base = '') {
  const out = new Map();
  const sel = /<select\b[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/gi;
  let m;
  while ((m = sel.exec(html))) {
    const name = decodeEntities(m[1]);
    const ore = /<option\b[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi;
    let o;
    while ((o = ore.exec(m[2]))) {
      const label = clean(o[2], 80);
      if (!o[1] || !/נשים|חרדי|אמהות|אימהות/.test(label)) continue;
      try { const u = new URL(base); u.searchParams.set(name, decodeEntities(o[1])); out.set(u.href, { url: u.href, label, haredi: /חרדי/.test(label), women: /נשים|אמהות|אימהות/.test(label) }); } catch { /* bad base */ }
    }
  }
  // plain links to filtered lists (?category=…, ?audience=…) whose label names women / Haredi
  const lre = /<a\b[^>]*href=["']([^"']*\/events\/?\?[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = lre.exec(html))) {
    const label = clean(m[2], 80);
    if (!/נשים|חרדי/.test(label)) continue;
    const url = absUrl(m[1], base);
    if (url && !out.has(url)) out.set(url, { url, label, haredi: /חרדי/.test(label), women: /נשים/.test(label) });
  }
  return [...out.values()].slice(0, 6);
}

/** Next pages of a list ("rel=next", /events/page/2/, ?pg=2 / ?page=2). */
export function nextPage(html = '', base = '') {
  const m = /<a\b[^>]*rel=["']next["'][^>]*href=["']([^"']+)["']/i.exec(html) || /<link\b[^>]*rel=["']next["'][^>]*href=["']([^"']+)["']/i.exec(html)
    || /<a\b[^>]*href=["']([^"']+)["'][^>]*rel=["']next["']/i.exec(html)
    || /<a\b[^>]*href=["']([^"']*\/events\/(?:page\/\d+\/?|\?(?:[^"']*&)?(?:pg|page|paged)=\d+[^"']*))["'][^>]*>\s*(?:הבא|הבאה|&gt;|›|»|עמוד הבא)/i.exec(html);
  return m ? absUrl(m[1], base) : '';
}

const nums = (s = '') => (String(s).match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0 && n < 5000);

function ldEvent(html = '') {
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const walk = (x) => { if (!x || typeof x !== 'object') return null; if (Array.isArray(x)) { for (const y of x) { const r = walk(y); if (r) return r; } return null; } if (x['@type'] === 'Event' || (Array.isArray(x['@type']) && x['@type'].includes('Event'))) return x; return x['@graph'] ? walk(x['@graph']) : null; };
      const e = walk(JSON.parse(m[1]));
      if (e) return e;
    } catch { /* broken block */ }
  }
  return null;
}

/** /events/<id>/ page (+ what the list said) → normalized event. Pure. */
export function normalizeBinaa({ html = '', url = '', site = {}, item = {}, session = null }) {
  const ld = ldEvent(html) || {};
  const h1 = clean((/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html) || [])[1] || '', 200);
  const ogTitle = metaContent(html, 'og:title').split(/\s+[|\-–]\s+/)[0];
  const title = clean(ld.name || h1 || ogTitle || item.title || '', 200);
  const main = (/<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html) || /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(html) || [])[1] || html.replace(/<header[\s\S]*?<\/header>|<footer[\s\S]*?<\/footer>|<nav[\s\S]*?<\/nav>/gi, ' ');
  const text = htmlToText(main);

  const pageDate = parseListDate(text);
  const startAt = session?.startAt || parseWhen(ld.startDate) || item.sessions?.[0]?.startAt || pageDate.startAt;
  const endAt = session ? session.endAt : (parseWhen(ld.endDate) || item.sessions?.[0]?.endAt || pageDate.endAt);

  const loc = ld.location || {};
  const labelled = (label) => clean((new RegExp(`${label}\\s*[:：]?\\s*([^\\n]{2,120})`).exec(text) || [])[1] || '', 120);
  const venue = clean(loc.name || item.place || labelled('(?:מיקום|מקום|כתובת)') || '', 160);
  const street = clean(loc.address?.streetAddress || '', 160);
  const resolved = resolveCity([loc.address?.addressLocality || '', street].filter(Boolean), venue, labelled('כתובת'));
  const city = resolved?.city || site.city || '';

  const priceText = labelled('(?:מחיר|עלות|דמי השתתפות|תשלום)') || (/(?:₪\s*\d+|\d+\s*(?:₪|ש"ח|ש״ח|שקלים?))/.exec(text) || [''])[0];
  const offer = Array.isArray(ld.offers) ? ld.offers[0] : (ld.offers || {});
  const ldPrice = Number(offer.price);
  const free = /ללא עלות|ללא תשלום|חינם|הכניסה חופשית|בחינם/.test(priceText || text.slice(0, 2000));
  const prices = Number.isFinite(ldPrice) && ldPrice > 0 ? [ldPrice] : nums(priceText);
  const priceMin = prices.length ? Math.min(...prices) : (free ? 0 : NaN);

  // registration / ticket link: a ticketing or form link on the page, else the page itself
  const reg = (/href=["'](https:\/\/[^"']*(?:smarticket|tickchak|eventer|ticketor|lean|forms\.gle|docs\.google\.com\/forms|payboxapp|meshulam|cardcom|binaa\.co\.il\/[^"']*form)[^"']*)["']/i.exec(main) || [])[1];
  const pageUrl = (metaContent(html, 'og:url') || url || item.url || '').replace(/^http:/, 'https:');
  const img = metaContent(html, 'og:image') || (Array.isArray(ld.image) ? ld.image[0] : (ld.image?.url || ld.image)) || '';
  const imageUrl = img ? absUrl(img, url || site.url) : '';

  const tags = item.tags || [];
  const category = tags.join(' · ').slice(0, 120);
  const soldOut = /אזלו הכרטיסים|הכרטיסים אזלו|אזל המלאי|ההרשמה מלאה|אין מקומות/.test(text) || /SoldOut/i.test(offer.availability || '');
  const closed = /ההרשמה (?:נסגרה|הסתיימה)|האירוע בוטל|בוטל/.test(text.slice(0, 1500));
  const id = String(item.id || (/\/events\/(\d+)/.exec(pageUrl) || [])[1] || '');
  const n = {
    sourceId: `${site.id}:${id}${session && item.sessions?.length > 1 && !item.course ? `@${session.startAt.toISOString()}` : ''}`,
    sourceName: clean(metaContent(html, 'og:site_name'), 60) || site.id,
    title,
    description: clean(ld.description || '', 3000),
    startAt, endAt,
    venue: venue || (city ? `מרכז קהילתי ${city}` : ''),
    location: [venue, street].filter(Boolean).join(', '),
    city, region: city ? regionOfCity(city) : '', cityHow: resolved ? resolved.how : (city ? 'site' : ''),
    priceMin, priceMax: prices.length ? Math.max(...prices) : priceMin, isFree: free && !(prices.length && Math.min(...prices) > 0),
    tickets: prices.length ? [{ title: '', price: Math.min(...prices) }] : [],
    soldOut, closed,
    ticketUrl: reg || pageUrl,
    imageUrl,
    category,
    strong: !!site.haredi,
    women: WOMEN_TAG.test(category),
    extraText: [metaContent(html, 'og:description'), item.title, category && `קהל יעד: ${category}`, item.course ? 'חוג / קורס — מוצג המפגש הקרוב' : ''].filter(Boolean).join('\n'),
  };
  const about = clean(main.replace(/<(h1|h2)[\s\S]*?<\/\1>/gi, ' '), 3000);
  n.rawDescription = n.description || about.slice(0, 1500);
  n.description = buildDescription(n, [n.description, ...pageSources(html), about].filter(Boolean));
  return n;
}

const envList = (k) => (process.env[k] || '').split(',').map(x => x.trim()).filter(Boolean);

export function createBinaaAdapter({
  sites = (envList('IMPORTER_BINAA_SITES').length ? envList('IMPORTER_BINAA_SITES') : DEFAULT_BINAA_SITES).map(parseSite).filter(Boolean),
  perSite = Number(process.env.IMPORTER_BINAA_PER_SITE || 40), maxPages = 3,
} = {}) {
  return {
    id: 'binaa',
    name: 'אתרי עיריות ומתנ"סים (א.ש בינה)',
    async discover(http, ctx) {
      const all = [];
      for (const site of sites) {
        await ctx.channel(`binaa ${site.id}`, async () => {
          const found = new Map();
          const read = async (url, hint = {}) => {
            let next = url;
            for (let p = 0; next && p < maxPages; p++) {
              const { text, url: got } = await http.getText(next);
              for (const it of parseBinaaList(text, got || next)) {
                const prev = found.get(it.key);
                const merged = prev ? { ...prev, sessions: [...prev.sessions, ...it.sessions.filter(s => !prev.sessions.some(x => +x.startAt === +s.startAt))].sort((a, b) => a.startAt - b.startAt), tags: [...new Set([...prev.tags, ...it.tags, ...(hint.tags || [])])] } : { ...it, tags: [...new Set([...it.tags, ...(hint.tags || [])])] };
                found.set(it.key, { ...merged, strong: !!(prev?.strong || hint.haredi) });
              }
              if (p === 0 && !hint.filtered) for (const f of filterPages(text, got || next)) await read(f.url, { filtered: true, haredi: f.haredi, tags: [f.label] });
              next = nextPage(text, got || next);
            }
          };
          await read(site.url);
          const now = Date.now();
          const list = [];
          for (const it of found.values()) {
            const course = COURSE.test(`${it.title} ${it.tags.join(' ')}`) || it.sessions.length > 3;
            const upcoming = it.sessions.filter(s => +s.startAt > now);
            const sessions = course ? upcoming.slice(0, 1) : upcoming;
            // no date in the list → let the event page decide (one candidate)
            for (const s of sessions.length ? sessions : (it.sessions.length ? [] : [null])) {
              const sid = it.kind === 'smarticket' ? `smarticket:${it.venue}:${it.id}` : `${site.id}:${it.id}`;
              list.push({
                sourceId: s && it.sessions.length > 1 && !course ? `${sid}@${s.startAt.toISOString()}` : sid,
                url: it.url, site, strong: !!(site.haredi || it.strong), women: WOMEN_TAG.test(it.tags.join(' ')),
                listItem: { ...it, course, title: it.title, description: it.tags.length ? `קהל יעד: ${it.tags.join(', ')}` : '', location: it.place }, session: s,
              });
            }
          }
          list.sort((a, b) => (b.strong - a.strong) || (b.women - a.women));
          all.push(...list.slice(0, perSite * 3));
        });
      }
      return all;
    },
    /** the list already says title + tags + place: spend a page request only on what can still pass */
    prefilter(c, now = new Date(), mode) {
      const li = c.listItem || {};
      if (c.session && +c.session.startAt <= +now) return 'עבר';
      const r = classifyEvent({ mode, title: li.title, description: li.description, location: li.location, city: c.site?.city || '', category: (li.tags || []).join(' · '), strong: c.strong });
      if (r.ok) return '';
      if (r.hard) return r.reason;
      // women-tagged but the Haredi sign may be on the page (organizer, branch) → look; anything else → no request
      return c.women && r.reason.startsWith('אין סימן') ? '' : `רשימת ${c.site?.id}: ${r.reason}`;
    },
    async details(c, http) {
      const { text, url } = await http.getText(c.url);
      if (c.listItem?.kind === 'smarticket') {
        const n = normalizeSmarticket({ html: text, url, venue: c.listItem.venue, listItem: { id: c.listItem.id, title: c.listItem.title } });
        n.sourceId = c.sourceId;
        if (c.session) { n.startAt = c.session.startAt; n.endAt = c.session.endAt || n.endAt; }
        if (!n.city && c.site?.city) { n.city = c.site.city; n.region = regionOfCity(n.city); }
        n.category = [n.category, ...(c.listItem.tags || [])].filter(Boolean).join(' · ');
        n.strong = n.strong || c.strong; n.women = n.women || c.women;
        if (!n.title) { const e = new Error('לא נמצאו פרטי אירוע בדף'); e.skip = true; throw e; }
        return n;
      }
      const n = normalizeBinaa({ html: text, url, site: c.site, item: c.listItem, session: c.session });
      n.sourceId = c.sourceId;
      if (!n.title) { const e = new Error('לא נמצאו פרטי אירוע בדף'); e.skip = true; throw e; }
      n.strong = n.strong || c.strong; n.women = n.women || c.women;
      return n;
    },
  };
}
