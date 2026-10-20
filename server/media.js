import crypto from 'crypto';
import express from 'express';
import mongoose from 'mongoose';

/**
 * Images, videos and audio are stored in Mongo as base64 "data:" strings inside each document.
 * Sending them inside JSON made the homepage download ~60MB on every visit.
 *
 * This module:
 *  1. rewrites every large data: string in GET /api JSON responses into a short URL /api/media/<hash>
 *  2. serves those URLs as real files with long browser caching (and Range support for video)
 *  3. turns /api/media/<hash> URLs that come back in POST/PUT bodies (admin edit forms) into the
 *     original data: string again, so saving a form never loses an image.
 *
 * Decoded files live in memory (LRU) and are persisted in the "mediablobs" collection so links
 * keep working after a restart.
 */

const MIN_LEN = 2048;                 // small data: URIs (icons) stay inline
const MEM_LIMIT = 160 * 1024 * 1024;  // bytes of decoded media kept in RAM
const PERSIST_LIMIT = 15 * 1024 * 1024;
const DATA_RE = /^data:([\w.+-]+\/[\w.+-]+)(?:;[\w=.+-]+)*;base64,/i;
const MEDIA_RE = /\/api\/media\/([a-f0-9]{40})(?:\.[a-z0-9]+)?(?:\?.*)?$/i;

const MediaBlob = mongoose.models.MediaBlob || mongoose.model('MediaBlob', new mongoose.Schema({
  _id: String,           // sha1 of the original data: string
  mime: String,
  data: Buffer,
  dataUrlPrefix: String, // "data:image/jpeg;base64," — to rebuild the original string
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false }));

// ---- caches ----
const fingerprints = new Map(); // cheap fingerprint of a big string -> sha1
const mem = new Map();          // sha1 -> { mime, buf, prefix }
let memBytes = 0;
const persisted = new Set();

const fingerprint = (s) => {
  const n = s.length;
  const pick = (p) => s.substr(Math.max(0, Math.floor(n * p) - 24), 48);
  return `${n}|${pick(0.13)}|${pick(0.37)}|${pick(0.61)}|${pick(0.83)}|${s.slice(-48)}`;
};

const remember = (hash, entry) => {
  if (mem.has(hash)) { mem.delete(hash); mem.set(hash, entry); return; }
  mem.set(hash, entry);
  memBytes += entry.buf.length;
  while (memBytes > MEM_LIMIT && mem.size > 1) {
    const [k, v] = mem.entries().next().value;
    mem.delete(k);
    memBytes -= v.buf.length;
  }
};

const extFor = (mime) => ({
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'audio/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/wav': 'wav',
}[mime.toLowerCase()] || 'bin');

/** Registers a data: string and returns its hash (or null if it isn't a usable data URL). */
function register(s) {
  const fp = fingerprint(s);
  let hash = fingerprints.get(fp);
  if (hash && mem.has(hash)) return hash;
  const m = DATA_RE.exec(s);
  if (!m) return null;
  if (!hash) {
    hash = crypto.createHash('sha1').update(s).digest('hex');
    if (fingerprints.size > 20000) fingerprints.clear();
    fingerprints.set(fp, hash);
  }
  if (!mem.has(hash)) {
    const prefix = s.slice(0, s.indexOf(',') + 1);
    const buf = Buffer.from(s.slice(prefix.length), 'base64');
    const entry = { mime: m[1].toLowerCase(), buf, prefix };
    remember(hash, entry);
    if (!persisted.has(hash) && buf.length <= PERSIST_LIMIT && mongoose.connection.readyState === 1) {
      persisted.add(hash);
      MediaBlob.updateOne({ _id: hash }, { $setOnInsert: { mime: entry.mime, data: buf, dataUrlPrefix: prefix } }, { upsert: true })
        .catch(() => persisted.delete(hash));
    }
  }
  return hash;
}

async function load(hash) {
  const hit = mem.get(hash);
  if (hit) return hit;
  const doc = await MediaBlob.findById(hash).lean();
  if (!doc) return null;
  const entry = { mime: doc.mime, buf: Buffer.from(doc.data.buffer || doc.data), prefix: doc.dataUrlPrefix };
  remember(hash, entry);
  persisted.add(hash);
  return entry;
}

// ---- response rewriting ----
function rewrite(value, base, depth = 0) {
  if (depth > 12 || value == null) return value;
  if (typeof value === 'string') {
    if (value.length >= MIN_LEN && value.startsWith('data:')) {
      const hash = register(value);
      if (hash) return `${base}/api/media/${hash}.${extFor(mem.get(hash)?.mime || '')}`;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(v => rewrite(v, base, depth + 1));
  if (typeof value === 'object') {
    if (value instanceof Date || Buffer.isBuffer(value)) return value;
    if (typeof value.toJSON === 'function') {
      const j = value.toJSON();
      if (j !== value) return rewrite(j, base, depth + 1);
    }
    const out = {};
    for (const k of Object.keys(value)) out[k] = rewrite(value[k], base, depth + 1);
    return out;
  }
  return value;
}

export function mediaResponses(req, res, next) {
  if (req.method !== 'GET' || req.path.startsWith('/media/')) return next();
  const original = res.json.bind(res);
  res.json = (body) => {
    try {
      const plain = body;
      const proto = req.headers['x-forwarded-proto'] || req.protocol;
      return original(rewrite(plain, `${proto}://${req.get('host')}`));
    } catch {
      return original(body);
    }
  };
  next();
}

// ---- request restoring (POST/PUT bodies from edit forms) ----
async function restore(value, depth = 0) {
  if (depth > 12 || value == null) return value;
  if (typeof value === 'string') {
    const m = MEDIA_RE.exec(value);
    if (!m) return value;
    const entry = await load(m[1]).catch(() => null);
    return entry ? entry.prefix + entry.buf.toString('base64') : undefined;
  }
  if (Array.isArray(value)) return Promise.all(value.map(v => restore(v, depth + 1)));
  if (typeof value === 'object') {
    for (const k of Object.keys(value)) {
      const v = await restore(value[k], depth + 1);
      if (v === undefined) delete value[k]; else value[k] = v;
    }
  }
  return value;
}

export async function mediaRequests(req, res, next) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method) || !req.body || typeof req.body !== 'object') return next();
  try { await restore(req.body); } catch { /* leave body as is */ }
  next();
}

// ---- file route ----
export const mediaRouter = express.Router();
mediaRouter.get('/media/:file', async (req, res) => {
  const hash = String(req.params.file).split('.')[0];
  if (!/^[a-f0-9]{40}$/i.test(hash)) return res.status(404).end();
  try {
    const entry = await load(hash);
    if (!entry) return res.status(404).end();
    const { buf, mime } = entry;
    res.set({
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Accept-Ranges': 'bytes',
      ETag: `"${hash}"`,
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    if (req.headers['if-none-match'] === `"${hash}"`) return res.status(304).end();
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range) {
      const start = range[1] ? parseInt(range[1], 10) : Math.max(0, buf.length - parseInt(range[2], 10));
      const end = range[1] && range[2] ? Math.min(parseInt(range[2], 10), buf.length - 1) : buf.length - 1;
      if (start >= buf.length || start > end) { res.set('Content-Range', `bytes */${buf.length}`); return res.status(416).end(); }
      res.status(206).set({ 'Content-Range': `bytes ${start}-${end}/${buf.length}`, 'Content-Length': end - start + 1 });
      return res.end(buf.subarray(start, end + 1));
    }
    res.set('Content-Length', buf.length);
    res.end(buf);
  } catch {
    res.status(500).end();
  }
});
