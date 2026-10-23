import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FAKE_JPEG } from './fakeTickchak.js';

/**
 * Serves the REAL captures in tests/fixtures/real (taken from the live sites on 2026-10-22):
 * search results, two event pages (tickchak 113538, glatticket 113204), their ev_ scripts and form/init,
 * the Glatticket home page, and tickchak's robots.txt — which is really the HTML homepage with status 200.
 * Organizer e-mails / phone numbers in the captures are redacted.
 */
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'real');
export const readReal = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
export const REAL_NOW = new Date(1792668555 * 1000); // "dnow" in the captured search response

const res = (body, { status = 200, type = 'text/html; charset=UTF-8', url } = {}) => {
  const r = new Response(body, { status, headers: { 'content-type': type } });
  if (url) Object.defineProperty(r, 'url', { value: url });
  return r;
};

export function createRealFetch() {
  const calls = [];
  const evUrls = { [readReal('tc-113538.ev-url.txt').trim()]: 'tc-113538.ev.js.txt', [readReal('glatt-113204.ev-url.txt').trim()]: 'glatt-113204.ev.js.txt' };
  const hashOf = (f) => /event_hash:"([^"]+)"/.exec(readReal(f))[1];
  const inits = { [hashOf('tc-113538.ev.js.txt')]: 'tc-113538.form-init.json', [hashOf('glatt-113204.ev.js.txt')]: 'glatt-113204.form-init.json' };
  const fetchImpl = async (url, init = {}) => {
    const method = (init.method || 'GET').toUpperCase();
    const body = init.body ? Object.fromEntries(new URLSearchParams(String(init.body))) : {};
    calls.push({ method, url, body });
    const u = new URL(url);
    if (u.pathname === '/robots.txt') return res(readReal('tickchak-robots-response.html')); // 200 text/html, like the real sites
    if (u.host === 'home.glatticket.co.il') return res(readReal('glatt-home.html'), { url });
    if (u.host === 'live.tickchak.co.il') return res('<html><body></body></html>', { url });
    if (method === 'POST' && u.pathname === '/ajax/homepage/get_events') {
      return res(Number(body.offset) > 0 || body.search !== 'לנשים' ? JSON.stringify({ events: [], offset: 0 }) : readReal('search-lanashim.json'), { type: 'application/json' });
    }
    if (method === 'POST' && u.pathname === '/ajax/form/init') {
      const f = inits[body.event];
      return res(f ? readReal(f) : JSON.stringify({ result: 'error' }), { type: 'application/json' });
    }
    if (evUrls[url]) return res(readReal(evUrls[url]), { type: 'application/javascript' });
    if (u.host === 'static.tickchak.co.il' && /\.(jpe?g|png|webp)$/i.test(u.pathname)) return res(FAKE_JPEG, { type: 'image/jpeg' });
    if (u.host === 'tickchak.co.il' && u.pathname === '/113538') return res(readReal('tc-113538.html'), { url });
    if (u.host === 'glatticket.co.il' && u.pathname === '/113204') return res(readReal('glatt-113204.html'), { url });
    return res('not found', { status: 404, url });
  };
  return { fetchImpl, calls };
}
