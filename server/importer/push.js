/**
 * "Push" import: pages a person opened in a normal browser (public event listings of municipal / community-center
 * sites that refuse our server's requests) are posted here and run through the SAME adapter, rules and pipeline.
 * Nothing is fetched from the source by the server; every URL must be in `pages`.
 *
 * pages: { "<url>": { text } | { b64, type } }   sites: ["www.modil.org.il|מודיעין עילית|1", …]
 */
import { runImport } from './pipeline.js';
import { createBinaaAdapter, parseSite } from './adapters/binaa.js';

const norm = (u = '') => { try { const x = new URL(u); x.hash = ''; return x.href; } catch { return String(u); } };

export function mapHttp(pages = {}) {
  const table = new Map();
  for (const [u, v] of Object.entries(pages)) { table.set(norm(u), v); table.set(norm(u).replace('://www.', '://'), v); }
  const find = (url) => table.get(norm(url)) || table.get(norm(url).replace('://www.', '://'));
  let requests = 0;
  const miss = (url) => Object.assign(new Error(`HTTP 404 for GET ${url} (not in the pushed pages)`), { status: 404 });
  return {
    getText: async (url) => { requests++; const v = find(url); if (!v || v.text == null) throw miss(url); return { text: v.text, url }; },
    getJson: async (url) => { requests++; const v = find(url); if (!v || v.text == null) throw miss(url); return JSON.parse(v.text); },
    postForm: async (url) => { throw miss(url); },
    getBuffer: async (url) => { requests++; const v = find(url); if (!v || !v.b64) throw miss(url); return { buf: Buffer.from(v.b64, 'base64'), type: v.type || 'image/jpeg', url }; },
    stats: () => ({ requests }),
  };
}

export async function runPushImport({ pages, sites, models, log = console.log, now }) {
  const parsed = (sites || []).map(parseSite).filter(Boolean);
  if (!parsed.length) throw new Error('no sites');
  const adapter = createBinaaAdapter({ sites: parsed, perSite: 200, maxPages: 5 });
  return runImport({ adapters: [adapter], http: mapHttp(pages), models, trigger: 'push', log, markGone: false, ...(now ? { now } : {}) });
}

// ---------- structured push: events read off a page that renders its listing in the browser (e.g. visit-tzfat) ----------
import { fromIsraelLocal } from './time.js';
import { resolveCity } from './city.js';
import { regionOfCity } from '../../shared/regions.js';
import { buildDescription } from './describe.js';
import { clean } from './text.js';

/** { id, title, date: "DD.MM.YY(YY)", time: "HH[:MM]", place, city, price, audience, description, image, link } → normalized */
export function normalizePushed(e = {}, site = {}) {
  const dm = /(\d{1,2})[./](\d{1,2})[./](\d{2,4})/.exec(e.date || '');
  if (!dm) return null;
  const y = dm[3].length === 2 ? 2000 + Number(dm[3]) : Number(dm[3]);
  const tm = /(\d{1,2})(?::(\d{2}))?/.exec(e.time || '') || [];
  const h = tm[1] != null ? Number(tm[1]) : 0, mi = tm[2] != null ? Number(tm[2]) : 0;
  const startAt = fromIsraelLocal(y, Number(dm[2]), Number(dm[1]), h, mi);
  const resolved = resolveCity([e.city || '', e.place || ''].filter(Boolean));
  const city = resolved?.city || site.city || '';
  const prices = (String(e.price || '').match(/\d+(?:[.,]\d+)?/g) || []).map(x => Number(x.replace(',', ''))).filter(n => n > 0 && n < 100000);
  const free = /חינם|חופשית|ללא עלות|ללא תשלום/.test(`${e.price || ''} ${e.admission || ''}`);
  const priceMin = prices.length ? Math.min(...prices) : (free ? 0 : NaN);
  const n = {
    sourceId: `${site.id}:${e.id}`,
    sourceName: site.name || site.id,
    title: clean(e.title || '', 200),
    description: clean(e.description || '', 3000),
    startAt, endAt: null,
    venue: clean(e.place || '', 160), location: clean(e.place || '', 160),
    city, region: city ? regionOfCity(city) : '', cityHow: resolved ? resolved.how : (city ? 'site' : ''),
    priceMin, priceMax: prices.length ? Math.max(...prices) : priceMin, isFree: free && !prices.length,
    tickets: prices.length ? [{ title: '', price: Math.min(...prices) }] : [],
    soldOut: false, closed: false,
    ticketUrl: e.link || site.url || '',
    imageUrl: e.image || '',
    category: clean(e.audience || '', 120),
    strong: false, women: /נשים/.test(e.audience || ''),
    extraText: [e.audience && `למי זה מתאים: ${e.audience}`].filter(Boolean).join('\n'),
  };
  n.rawDescription = n.description;
  n.description = buildDescription(n, [n.description].filter(Boolean));
  return n;
}

export function createPushedAdapter({ site, events }) {
  return {
    id: `pushed:${site.id}`,
    name: site.name || site.id,
    async discover() { return events.map(e => ({ sourceId: `${site.id}:${e.id}`, url: e.link || site.url, women: /נשים/.test(e.audience || ''), listItem: e })); },
    async details(c) {
      const n = normalizePushed(c.listItem, site);
      if (!n || !n.title) { const e = new Error('חסר: תאריך / כותרת'); e.skip = true; throw e; }
      return n;
    },
  };
}

export async function runStructuredPush({ site, events, pages = {}, models, log = console.log }) {
  if (!site?.id || !Array.isArray(events)) throw new Error('site + events required');
  return runImport({ adapters: [createPushedAdapter({ site, events })], http: mapHttp(pages), models, trigger: 'push', log, markGone: false });
}
