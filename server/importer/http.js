/**
 * Polite HTTP client for the events agent:
 *  - clear User-Agent with a contact URL
 *  - at most one request per host every `minIntervalMs` (default 1.5s)
 *  - honours robots.txt (User-agent: * and our own token) — a disallowed URL throws RobotsDisallowed
 *  - short in-memory cache for GETs (listing pages are requested by several adapters)
 *  - timeout per request
 * `fetchImpl` is injectable so tests run on fixtures without network.
 */

export const USER_AGENT = process.env.IMPORTER_USER_AGENT || 'NashiEventsBot/1.0 (+https://nashi-co.com; events agent for a women\'s community site)';
const BOT_TOKEN = 'nashieventsbot';

export class RobotsDisallowed extends Error {
  constructor(url) { super(`robots.txt disallows ${url}`); this.name = 'RobotsDisallowed'; }
}

/** Parses robots.txt and returns a function (path) => allowed. Longest matching rule wins (Allow wins ties). */
export function parseRobots(txt = '', agent = BOT_TOKEN) {
  const groups = [];
  let cur = null;
  let lastWasAgent = false;
  for (const raw of String(txt).split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent || !cur) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (cur && (key === 'allow' || key === 'disallow')) cur.rules.push({ allow: key === 'allow', path: val });
    }
  }
  const mine = groups.filter(g => g.agents.some(a => a !== '*' && agent.includes(a)));
  const chosen = mine.length ? mine : groups.filter(g => g.agents.includes('*'));
  const rules = chosen.flatMap(g => g.rules).filter(r => r.path !== '' || r.allow);
  const toRe = (p) => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
  const compiled = rules.filter(r => r.path).map(r => ({ ...r, re: toRe(r.path), len: r.path.length }));
  return (path) => {
    let best = null;
    for (const r of compiled) if (r.re.test(path) && (!best || r.len > best.len || (r.len === best.len && r.allow))) best = r;
    return !best || best.allow;
  };
}

export function createHttp({ fetchImpl = globalThis.fetch, minIntervalMs = 1500, timeoutMs = 20000, cacheMs = 10 * 60 * 1000, respectRobots = true, log = () => {} } = {}) {
  const nextSlot = new Map();   // host -> timestamp when the next request may start
  const robots = new Map();     // origin -> Promise<(path)=>boolean>
  const cache = new Map();      // key -> { at, value }
  let requests = 0;

  const wait = async (host) => {
    const now = Date.now();
    const slot = Math.max(now, nextSlot.get(host) || 0);
    nextSlot.set(host, slot + minIntervalMs);
    if (slot > now) await new Promise(r => setTimeout(r, slot - now));
  };

  const raw = async (url, init = {}) => {
    const u = new URL(url);
    await wait(u.host);
    requests++;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        ...init,
        redirect: 'follow',
        signal: ctrl.signal,
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'he-IL,he;q=0.9', ...(init.headers || {}) },
      });
      return res;
    } finally { clearTimeout(t); }
  };

  const allowed = async (url) => {
    if (!respectRobots) return true;
    const u = new URL(url);
    if (!robots.has(u.origin)) {
      robots.set(u.origin, (async () => {
        // 4xx = no robots.txt → allowed. 5xx / network error = unknown → don't crawl that site this run.
        try {
          const r = await raw(`${u.origin}/robots.txt`);
          if (r.status >= 500) return null;
          if (r.status >= 400) return () => true;
          return parseRobots(await r.text());
        } catch { return null; }
      })());
    }
    const rules = await robots.get(u.origin);
    if (!rules) throw new Error(`האתר ${u.host} לא זמין (robots.txt) — מדלגים עליו בריצה הזו`);
    return rules(u.pathname + u.search);
  };

  async function request(url, { method = 'GET', form, headers, as = 'text', cache: useCache = method === 'GET' } = {}) {
    if (!(await allowed(url))) throw new RobotsDisallowed(url);
    const body = form ? new URLSearchParams(Object.entries(form).map(([k, v]) => [k, String(v ?? '')])).toString() : undefined;
    const key = `${method} ${url} ${body || ''} ${as}`;
    const hit = useCache && cache.get(key);
    if (hit && Date.now() - hit.at < cacheMs) return hit.value;
    const res = await raw(url, {
      method,
      body,
      headers: { ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' } : {}), ...(headers || {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${method} ${url}`);
    const value = as === 'json' ? await res.json()
      : as === 'buffer' ? { buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get('content-type') || '', url: res.url || url }
      : { text: await res.text(), url: res.url || url };
    if (useCache) cache.set(key, { at: Date.now(), value });
    log(`${method} ${url}`);
    return value;
  }

  return {
    getText: (url, o) => request(url, { ...o, as: 'text' }),     // → { text, url (after redirects) }
    getJson: (url, o) => request(url, { ...o, as: 'json' }),
    postForm: (url, form, o) => request(url, { ...o, method: 'POST', form, as: 'json', cache: false }),
    getBuffer: (url, o) => request(url, { ...o, as: 'buffer', cache: false }),
    stats: () => ({ requests }),
  };
}
