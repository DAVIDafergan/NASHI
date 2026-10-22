import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * A fake `fetch` that serves the Tickchak / Glatticket fixtures, so the adapter + pipeline run end-to-end
 * without network. `overrides` lets a test change what the "site" returns (price change, removed event…).
 */
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'tickchak');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(DIR, f));

// a tiny but real-looking JPEG / PNG (magic bytes + padding above the 2KB minimum)
export const FAKE_JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(4096, 7), Buffer.from([0xff, 0xd9])]);
export const FAKE_PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(4096, 3)]);

const res = (body, { status = 200, type = 'text/html; charset=utf-8', url } = {}) => {
  const r = new Response(body, { status, headers: { 'content-type': type } });
  if (url) Object.defineProperty(r, 'url', { value: url });
  return r;
};

export function createFakeFetch(overrides = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const method = (init.method || 'GET').toUpperCase();
    const body = init.body ? Object.fromEntries(new URLSearchParams(String(init.body))) : {};
    calls.push({ method, url, body, ua: init.headers?.['User-Agent'] });
    const u = new URL(url);
    if (overrides.handle) { const o = await overrides.handle({ method, url, u, body }); if (o) return o; }

    if (u.pathname === '/robots.txt') return res(read('robots.txt'), { type: 'text/plain' });
    if (u.host === 'home.glatticket.co.il' && u.pathname === '/') return res(read('glatticket-home.html'), { url });
    if (u.host === 'live.tickchak.co.il' && u.pathname === '/performances-for-women') return res(read('live-women-hub.html'), { url });
    if (u.host === 'live.tickchak.co.il') return res('<html><body><h1>לא נמצאו הופעות</h1></body></html>', { url });

    if (method === 'POST' && u.pathname === '/ajax/homepage/get_events') {
      const term = body.search;
      if (Number(body.offset) > 0) return res(read('search-empty.json'), { type: 'application/json' });
      const file = term === 'נשים' ? 'search-women.json' : term === 'הצגה' ? 'search-show.json' : 'search-empty.json';
      let json = JSON.parse(read(file));
      if (overrides.search) json = overrides.search(term, json) || json;
      return res(JSON.stringify(json), { type: 'application/json' });
    }
    if (method === 'POST' && u.pathname === '/ajax/form/init') {
      const f = `init/${body.event}.json`;
      if (!exists(f)) return res(JSON.stringify({ status: 'error' }), { type: 'application/json' });
      let json = JSON.parse(read(f));
      if (overrides.init) json = overrides.init(body.event, json) || json;
      return res(JSON.stringify(json), { type: 'application/json' });
    }
    if (u.host === 'static.tickchak.co.il' && u.pathname.startsWith('/js/ev_')) {
      const f = path.basename(u.pathname);
      return exists(f) ? res(read(f), { type: 'application/javascript' }) : res('', { status: 404 });
    }
    if (u.host === 'static.tickchak.co.il' && /\.(jpe?g|png)$/i.test(u.pathname)) {
      const png = /\.png$/i.test(u.pathname);
      return res(png ? FAKE_PNG : FAKE_JPEG, { type: png ? 'image/png' : 'image/jpeg' });
    }
    const eid = u.pathname.slice(1);
    if (/^(www\.)?(tickchak|glatticket)\.co\.il$/.test(u.host) && exists(`page-${eid}.html`)) return res(read(`page-${eid}.html`), { url });
    return res('not found', { status: 404, url });
  };
  return { fetchImpl, calls };
}
