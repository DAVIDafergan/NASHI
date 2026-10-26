import express from 'express';
import mongoose from 'mongoose';
import { HDate } from '@hebcal/core';
import { Story, Personality, Event } from './models.js';
import { isEventExpired } from '../shared/eventTime.js';
import { factsLine, eventDeepLink } from '../shared/eventShare.js';
import { derivePreview } from './ogImage.js';
import { BRAND, BRAND_COLORS, logoMarkSvg } from '../shared/brand.js';
import { audienceOf, AUDIENCE_BADGE } from '../shared/audience.js';

/**
 * Link-preview pages for WhatsApp / Facebook / Telegram.
 * The site is a hash-router SPA, so crawlers can't see per-page titles or images.
 * /s/... returns a tiny HTML page with Open Graph tags and immediately forwards people to the real page.
 */
const router = express.Router();

export const esc = (v = '') => String(v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const clip = (v = '', n = 180) => { const s = String(v).replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const origin = (req) => `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;

export const page = ({ title, description, image, url, redirect, imageMeta }) => `<!doctype html>
<html lang="he" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${esc(`${BRAND.name} · ${BRAND.tagline}`)}">
<meta property="og:locale" content="he_IL">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:secure_url" content="${esc(image)}">${imageMeta?.type ? `
<meta property="og:image:type" content="${esc(imageMeta.type)}">` : ''}${imageMeta?.width ? `
<meta property="og:image:width" content="${imageMeta.width}">
<meta property="og:image:height" content="${imageMeta.height}">` : ''}
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${esc(redirect)}">
<link rel="canonical" href="${esc(url)}">
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:${BRAND_COLORS.bg};color:${BRAND_COLORS.navy};font-family:Assistant,Arial,sans-serif}</style>
</head><body><p>פותחים את ${esc(BRAND.name)}…</p><script>location.replace(${JSON.stringify(redirect)})</script></body></html>`;

const sendPage = (res, data) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.type('html').send(page(data));
};

/** Serve the small preview JPEG (sharp); falls back to the stored bytes when sharp is missing or fails. */
const sendPreview = async (res, key, dataUrl) => {
  const d = await derivePreview(key, dataUrl);
  if (d) {
    res.set({ 'Content-Type': d.type, 'Content-Length': d.buf.length, 'Cache-Control': 'public, max-age=86400' });
    res.end(d.buf);
    return true;
  }
  if (/^data:image\/svg/i.test(dataUrl || '')) return false; // WhatsApp can't show SVG: caller falls back
  return sendDataUrl(res, dataUrl);
};

const sendDataUrl = (res, dataUrl) => {
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) return false;
  const buf = Buffer.from(m[2], 'base64');
  res.set({ 'Content-Type': m[1], 'Content-Length': buf.length, 'Cache-Control': 'public, max-age=86400' });
  res.end(buf);
  return true;
};

/** Width/height/type of a JPEG / PNG / WebP / GIF buffer (for og:image:width/height); null if unknown. */
export function imageInfo(buf) {
  try {
    if (!buf || buf.length < 24) return null;
    if (buf[0] === 0x89 && buf[1] === 0x50) return { type: 'image/png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (buf.slice(0, 3).toString() === 'GIF') return { type: 'image/gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') {
      const kind = buf.slice(12, 16).toString();
      if (kind === 'VP8X') return { type: 'image/webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
      if (kind === 'VP8 ') return { type: 'image/webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      return { type: 'image/webp' };
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { type: 'image/jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        i += 2 + len;
      }
      return { type: 'image/jpeg' };
    }
  } catch { /* unknown */ }
  return null;
}
const dataUrlBuffer = (dataUrl) => { const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl || ''); return m ? { mime: m[1], buf: Buffer.from(m[2], 'base64') } : null; };

// ---- the brand share image (logo + name + tagline), used when an item has no picture of its own ----
/** 1200×630 SVG of the share card (pure — tested). Rendered to JPEG by sharp at /s/img/brand.jpg. */
export function brandCardSvg() {
  const c = BRAND_COLORS;
  const mark = logoMarkSvg({ size: 210 }).replace("<svg ", "<svg x=\"800\" y=\"140\" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs><radialGradient id="a" cx="0.85" cy="0.1" r="0.8"><stop offset="0" stop-color="${c.soft}"/><stop offset="1" stop-color="${c.bg}"/></radialGradient></defs>
<rect width="1200" height="630" fill="url(#a)"/>
<rect x="0" y="600" width="1200" height="30" fill="${c.navy}"/><rect x="0" y="600" width="260" height="30" fill="${c.gold}"/>
${mark}
<g font-family="'Simple CLM', 'SimpleCLM', Assistant, Arial, sans-serif" text-anchor="start" direction="rtl">
<text x="780" y="330" font-size="190" font-weight="700" fill="${c.ink}">${esc(BRAND.name)}</text>
<text x="780" y="420" font-size="54" fill="${c.navy}">${esc(BRAND.tagline)}</text>
<text x="780" y="490" font-size="36" fill="${c.goldDeep}">לגברים · לנשים · למשפחות</text>
</g></svg>`;
}
let brandJpeg = null;
router.get('/s/img/brand.jpg', async (req, res) => {
  try {
    if (!brandJpeg) {
      const d = await derivePreview('brand', `data:image/svg+xml;base64,${Buffer.from(brandCardSvg()).toString('base64')}`, { width: 1200 });
      if (!d) return res.redirect('/og-image.jpg'); // no sharp: the static site image
      brandJpeg = d;
    }
    res.set({ 'Content-Type': brandJpeg.type, 'Content-Length': brandJpeg.buf.length, 'Cache-Control': 'public, max-age=86400' });
    res.end(brandJpeg.buf);
  } catch { res.redirect('/og-image.jpg'); }
});
const siteImage = (base) => `${base}/s/img/brand.jpg`;

// ---- images that crawlers can fetch ----
// event flyer for WhatsApp: raster only (WhatsApp ignores SVG — generated placeholder flyers use the site image)
router.get('/s/img/event/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.redirect('/s/img/brand.jpg');
    const ev = await Event.findById(req.params.id).select('image hidden');
    if (!ev || ev.hidden || !ev.image) return res.redirect('/s/img/brand.jpg');
    if (/^https:\/\//.test(ev.image)) return res.redirect(ev.image);
    if (!(await sendPreview(res, `event:${ev._id}`, ev.image))) res.redirect('/s/img/brand.jpg');
  } catch { res.redirect('/s/img/brand.jpg'); }
});

router.get('/s/img/personality/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.redirect('/s/img/brand.jpg');
    const p = await Personality.findById(req.params.id).select('image status externalToken isTemplate');
    if (!p || p.isTemplate || p.externalToken || p.status === 'submitted' || !p.image) return res.redirect('/s/img/brand.jpg');
    if (/^https?:\/\//.test(p.image)) return res.redirect(p.image);
    if (!(await sendPreview(res, `personality:${p._id}`, p.image))) res.redirect('/s/img/brand.jpg');
  } catch { res.redirect('/s/img/brand.jpg'); }
});

router.get('/s/img/story/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.redirect('/s/img/brand.jpg');
    const s = await Story.findById(req.params.id).select('type content status');
    if (!s || s.status !== 'approved' || s.type !== 'image') return res.redirect('/s/img/brand.jpg');
    if (!(await sendPreview(res, `story:${s._id}`, s.content))) res.redirect('/s/img/brand.jpg');
  } catch { res.redirect('/s/img/brand.jpg'); }
});

// ---- preview pages ----
router.get('/s/personality/:id', async (req, res) => {
  const base = origin(req);
  const fallback = { title: `אישיות השבוע · ${BRAND.name}`, description: `הכירו את אישי ונשות השבוע של ${BRAND.name}`, image: siteImage(base), url: `${base}${req.originalUrl}`, redirect: '/#/personality-archive' };
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendPage(res, fallback);
    const p = await Personality.findById(req.params.id).select('name role motto image status externalToken isTemplate');
    if (!p || p.isTemplate || p.externalToken || p.status === 'submitted') return sendPage(res, fallback);
    sendPage(res, {
      title: `${p.name} · אישיות השבוע ב${BRAND.name}`,
      description: clip(p.motto ? `״${p.motto}״ — ${p.role || ''}` : (p.role || `ראיון אישי ב${BRAND.name}`)),
      image: p.image ? `${base}/s/img/personality/${p._id}` : siteImage(base),
      url: `${base}/s/personality/${p._id}`,
      redirect: `/#/personality-archive/${p._id}`,
    });
  } catch { sendPage(res, fallback); }
});

router.get('/s/story/:id', async (req, res) => {
  const base = origin(req);
  const fallback = { title: `סטטוס ב${BRAND.name}`, description: 'היכנסו לראות מה חדש בקהילה', image: siteImage(base), url: `${base}${req.originalUrl}`, redirect: '/#/' };
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendPage(res, fallback);
    const s = await Story.findById(req.params.id).populate('user', 'name');
    if (!s || s.status !== 'approved') return sendPage(res, fallback);
    const who = s.user?.name ? s.user.name.split(' ')[0] : 'הקהילה';
    sendPage(res, {
      title: `הסטטוס של ${who} · ${BRAND.name}`,
      description: clip(s.type === 'text' ? s.content : (s.caption || `היכנסו לראות את הסטטוס ב${BRAND.name}`)),
      image: s.type === 'image' ? `${base}/s/img/story/${s._id}` : siteImage(base),
      url: `${base}/s/story/${s._id}`,
      redirect: `/#/?storyId=${s._id}`,
    });
  } catch { sendPage(res, fallback); }
});

// ---- events ----
const hebrewDay = (ev) => {
  if (ev.hebrewDate) return ev.hebrewDate;
  try { const d = new Date(ev.date); return isNaN(d) ? '' : new HDate(new Date(d.getTime() + 12 * 3600e3)).renderGematriya(true).split(' ').slice(0, -1).join(' '); } catch { return ''; }
};
const firstLine = (text = '', skip = '') => String(text).split('\n').map(l => l.trim()).filter(l => l && l !== skip && !/^[📅📍🎟️]/u.test(l) && !/^הכרטיסים נמכרים/.test(l))[0] || '';

/** The preview data for one event (pure — tested). ended: past its 48h window, archived or hidden. */
export function eventPreview(ev, base, { now = Date.now(), svgOk = false } = {}) {
  const id = String(ev._id || ev.id);
  const ended = !!(ev.archived || ev.hidden || isEventExpired(ev, now));
  const facts = factsLine(ev, hebrewDay(ev));
  const blurb = firstLine(ev.description, ev.title);
  const img = typeof ev.image === 'string' ? ev.image : '';
  // SVG placeholder flyers only when they can be converted to JPEG (sharp) — WhatsApp ignores SVG
  const raster = img && (svgOk || !/^data:image\/svg/i.test(img));
  // who it is for, first ("לגברים · 📅 …") — never "נשים" on a men's / everyone's event
  const who = AUDIENCE_BADGE[audienceOf(ev)];
  return {
    title: ended ? `האירוע הסתיים · ${ev.title}` : `${ev.title} · ${BRAND.name}`,
    description: ended ? `האירוע הזה כבר הסתיים — היכנסו לאירועים הקרובים באזור שלכם ב${BRAND.name}` : clip(`${who} · ${blurb ? `${facts} — ${blurb}` : facts}`, 290),
    image: !ended && raster ? `${base}/s/img/event/${id}` : siteImage(base),
    url: `${base}/s/event/${id}`,
    redirect: eventDeepLink(id),
  };
}

// /s/event/:id — WhatsApp / Facebook preview, then the event opens on the site
router.get('/s/event/:id', async (req, res) => {
  const base = origin(req);
  const fallback = { title: `אירועים · ${BRAND.name}`, description: 'שיעורים, כנסים, הרצאות ומופעים לגברים, לנשים ולמשפחות — בכל הארץ', image: siteImage(base), url: `${base}${req.originalUrl}`, redirect: '/#/events' };
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendPage(res, fallback);
    const ev = await Event.findById(req.params.id).select('-attendees').lean();
    if (!ev) return sendPage(res, fallback);
    // the derived preview JPEG (also warms its cache for WhatsApp's image request) → og:image:width/height/type
    const derived = typeof ev.image === 'string' && ev.image.startsWith('data:') ? await derivePreview(`event:${ev._id}`, ev.image) : null;
    const data = eventPreview(ev, base, { svgOk: !!derived });
    if (data.image.includes('/s/img/event/')) {
      if (derived) data.imageMeta = { type: derived.type, width: derived.width, height: derived.height };
      else { const d = dataUrlBuffer(ev.image); if (d) data.imageMeta = imageInfo(d.buf); }
    }
    sendPage(res, data);
  } catch { sendPage(res, fallback); }
});

// invite link: /s/join?ref=<userId>
router.get('/s/join', (req, res) => {
  const base = origin(req);
  const ref = typeof req.query.ref === 'string' && /^[a-f0-9]{24}$/i.test(req.query.ref) ? req.query.ref : '';
  sendPage(res, {
    title: `הוזמנת ל${BRAND.name}`,
    description: `${BRAND.tagline}: אירועים, שיעורים, חוגים, הגרלות וקהילה — לגברים, לנשים ולמשפחות. ההצטרפות חינם.`,
    image: siteImage(base),
    url: `${base}/s/join${ref ? `?ref=${ref}` : ''}`,
    redirect: `/#/${ref ? `?ref=${ref}` : ''}`,
  });
});

export default router;
