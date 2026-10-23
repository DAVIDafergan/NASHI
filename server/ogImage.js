import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Link-preview images for WhatsApp / Facebook: WhatsApp drops images over ~300KB and ignores SVG.
 * derivePreview() turns a stored flyer (data: URL — JPEG/PNG/WebP/GIF or our SVG placeholder) into a small JPEG:
 * max 600px wide (aspect kept), quality 72, mozjpeg, progressive, metadata stripped, aiming at < 200KB.
 * Results are kept in an in-memory LRU keyed by the caller's key + a hash of the image.
 * When sharp is not installed or fails, it returns null and the caller serves the original (old behaviour).
 */

// SVG placeholders are rendered by librsvg through fontconfig: add the bundled Hebrew font (server/fonts)
// before sharp loads, so the text renders even on a server image without Hebrew fonts.
const FONTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts', 'fonts.conf');
if (!process.env.FONTCONFIG_FILE) process.env.FONTCONFIG_FILE = FONTS;

let loader = () => import('sharp').then(m => m.default || m);
let sharpPromise = null;
/** Tests: replace how sharp is loaded (e.g. () => Promise.reject(...) to simulate it missing). */
export function setSharpLoader(fn) { loader = fn; sharpPromise = null; cache.clear(); bytes = 0; }
const getSharp = () => (sharpPromise ||= loader().catch(() => null));

export const PREVIEW = { maxWidth: 600, quality: 72, targetBytes: 200 * 1024 };
const LIMIT = 40 * 1024 * 1024;
const cache = new Map(); // key -> { buf, type, width, height }
let bytes = 0;
const remember = (k, v) => {
  cache.set(k, v); bytes += v.buf.length;
  while (bytes > LIMIT && cache.size > 1) { const [ok, ov] = cache.entries().next().value; cache.delete(ok); bytes -= ov.buf.length; }
};

export const parseDataUrl = (s) => {
  const m = /^data:([\w/+.-]+)(?:;[\w=.+-]+)*;base64,(.+)$/.exec(s || '');
  return m ? { mime: m[1].toLowerCase(), buf: Buffer.from(m[2], 'base64') } : null;
};

/** → { buf, type: 'image/jpeg', width, height } or null (no sharp / not an image / failed). */
export async function derivePreview(key, dataUrl) {
  const src = parseDataUrl(dataUrl);
  if (!src || !/^image\//.test(src.mime)) return null;
  const k = `${key}:${crypto.createHash('sha1').update(src.buf).digest('hex')}`;
  const hit = cache.get(k);
  if (hit) { cache.delete(k); cache.set(k, hit); return hit; }
  const sharp = await getSharp();
  if (!sharp) return null;
  try {
    const svg = /svg/.test(src.mime);
    const make = (width, quality) => sharp(src.buf, svg ? { density: 144 } : { animated: false })
      .rotate()
      .resize({ width, withoutEnlargement: !svg })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality, mozjpeg: true, progressive: true })
      .toBuffer({ resolveWithObject: true });
    let out = await make(PREVIEW.maxWidth, PREVIEW.quality);
    if (out.data.length > PREVIEW.targetBytes) out = await make(PREVIEW.maxWidth, 60);
    if (out.data.length > PREVIEW.targetBytes) out = await make(480, 60);
    const v = { buf: out.data, type: 'image/jpeg', width: out.info.width, height: out.info.height };
    remember(k, v);
    return v;
  } catch {
    return null;
  }
}

export const previewCacheSize = () => ({ entries: cache.size, bytes });
