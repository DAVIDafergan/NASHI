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
