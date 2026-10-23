import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FAKE_JPEG } from './fakeTickchak.js';

/**
 * Serves the REAL SmarTicket captures (betshemesh.smarticket.co.il, 2026-10-23): home page, the women category page,
 * event pages 786 / 791 / 742 / 746. robots.txt answers 404 text/html like the real site. Contacts redacted.
 */
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'smarticket');
export const readSmart = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
export const SMART_NOW = new Date('2026-10-23T10:00:00Z');

const res = (body, { status = 200, type = 'text/html; charset=UTF-8', url } = {}) => {
  const r = new Response(body, { status, headers: { 'content-type': type } });
  if (url) Object.defineProperty(r, 'url', { value: url });
  return r;
};

export function createSmarticketFetch() {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const u = new URL(url);
    if (u.pathname === '/robots.txt') return res('<html>404</html>', { status: 404 });
    if (u.host !== 'betshemesh.smarticket.co.il') return res('not found', { status: 404, url });
    const p = decodeURIComponent(u.pathname);
    if (p === '/') return res(readSmart('betshemesh-home.html'), { url });
    if (p === '/נשים_page_22') return res(readSmart('betshemesh-cat-women.html'), { url });
    if (/^\/uploads\//.test(p)) return res(FAKE_JPEG, { type: 'image/jpeg' });
    const id = u.searchParams.get('id');
    const f = `betshemesh-${id}.html`;
    if (id && fs.existsSync(path.join(DIR, f))) return res(readSmart(f), { url });
    return res('not found', { status: 404, url });
  };
  return { fetchImpl, calls };
}
