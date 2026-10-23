import express from 'express';
import mongoose from 'mongoose';
import { HDate } from '@hebcal/core';
import { Story, Personality, Event } from './models.js';
import { isEventExpired } from '../shared/eventTime.js';
import { factsLine, eventDeepLink } from '../shared/eventShare.js';

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
<meta property="og:site_name" content="נשי · קהילת נשים">
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
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FBF7F4;color:#A5636B;font-family:Assistant,Arial,sans-serif}</style>
</head><body><p>פותחת את נשי…</p><script>location.replace(${JSON.stringify(redirect)})</script></body></html>`;

const sendPage = (res, data) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.type('html').send(page(data));
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

// ---- images that crawlers can fetch ----
// event flyer for WhatsApp: raster only (WhatsApp ignores SVG — generated placeholder flyers use the site image)
router.get('/s/img/event/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.redirect('/og-image.jpg');
    const ev = await Event.findById(req.params.id).select('image hidden');
    if (!ev || ev.hidden || !ev.image) return res.redirect('/og-image.jpg');
    if (/^https:\/\//.test(ev.image)) return res.redirect(ev.image);
    if (/^data:image\/svg/i.test(ev.image)) return res.redirect('/og-image.jpg');
    if (!sendDataUrl(res, ev.image)) res.redirect('/og-image.jpg');
  } catch { res.redirect('/og-image.jpg'); }
});

router.get('/s/img/personality/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.redirect('/og-image.jpg');
    const p = await Personality.findById(req.params.id).select('image status externalToken isTemplate');
    if (!p || p.isTemplate || p.externalToken || p.status === 'submitted' || !p.image) return res.redirect('/og-image.jpg');
    if (/^https?:\/\//.test(p.image)) return res.redirect(p.image);
    if (!sendDataUrl(res, p.image)) res.redirect('/og-image.jpg');
  } catch { res.redirect('/og-image.jpg'); }
});

router.get('/s/img/story/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.redirect('/og-image.jpg');
    const s = await Story.findById(req.params.id).select('type content status');
    if (!s || s.status !== 'approved' || s.type !== 'image') return res.redirect('/og-image.jpg');
    if (!sendDataUrl(res, s.content)) res.redirect('/og-image.jpg');
  } catch { res.redirect('/og-image.jpg'); }
});

// ---- preview pages ----
router.get('/s/personality/:id', async (req, res) => {
  const base = origin(req);
  const fallback = { title: 'אשת השבוע · נשי', description: 'הכירו את נשות השבוע של קהילת נשי', image: `${base}/og-image.jpg`, url: `${base}${req.originalUrl}`, redirect: '/#/personality-archive' };
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendPage(res, fallback);
    const p = await Personality.findById(req.params.id).select('name role motto image status externalToken isTemplate');
    if (!p || p.isTemplate || p.externalToken || p.status === 'submitted') return sendPage(res, fallback);
    sendPage(res, {
      title: `${p.name} · אשת השבוע בנשי`,
      description: clip(p.motto ? `״${p.motto}״ — ${p.role || ''}` : (p.role || 'ראיון אישי בקהילת נשי')),
      image: p.image ? `${base}/s/img/personality/${p._id}` : `${base}/og-image.jpg`,
      url: `${base}/s/personality/${p._id}`,
      redirect: `/#/personality-archive/${p._id}`,
    });
  } catch { sendPage(res, fallback); }
});

router.get('/s/story/:id', async (req, res) => {
  const base = origin(req);
  const fallback = { title: 'סטטוס בקהילת נשי', description: 'היכנסי לראות מה חדש בקהילה', image: `${base}/og-image.jpg`, url: `${base}${req.originalUrl}`, redirect: '/#/' };
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendPage(res, fallback);
    const s = await Story.findById(req.params.id).populate('user', 'name');
    if (!s || s.status !== 'approved') return sendPage(res, fallback);
    const who = s.user?.name ? s.user.name.split(' ')[0] : 'חברה בקהילה';
    sendPage(res, {
      title: `הסטטוס של ${who} · נשי`,
      description: clip(s.type === 'text' ? s.content : (s.caption || 'היכנסי לראות את הסטטוס בקהילת נשי')),
      image: s.type === 'image' ? `${base}/s/img/story/${s._id}` : `${base}/og-image.jpg`,
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
export function eventPreview(ev, base, { now = Date.now() } = {}) {
  const id = String(ev._id || ev.id);
  const ended = !!(ev.archived || ev.hidden || isEventExpired(ev, now));
  const facts = factsLine(ev, hebrewDay(ev));
  const blurb = firstLine(ev.description, ev.title);
  const img = typeof ev.image === 'string' ? ev.image : '';
  const raster = img && !/^data:image\/svg/i.test(img);
  return {
    title: ended ? `האירוע הסתיים · ${ev.title}` : `${ev.title} · נשי`,
    description: ended ? 'האירוע הזה כבר הסתיים — היכנסי לאירועים הקרובים באזור שלך בנשי' : clip(blurb ? `${facts} — ${blurb}` : facts, 290),
    image: !ended && raster ? `${base}/s/img/event/${id}` : `${base}/og-image.jpg`,
    url: `${base}/s/event/${id}`,
    redirect: eventDeepLink(id),
  };
}

// /s/event/:id — WhatsApp / Facebook preview, then the event opens on the site
router.get('/s/event/:id', async (req, res) => {
  const base = origin(req);
  const fallback = { title: 'אירועים לנשים · נשי', description: 'ערבי נשים, סדנאות, הרצאות ומופעים — בכל הארץ', image: `${base}/og-image.jpg`, url: `${base}${req.originalUrl}`, redirect: '/#/events' };
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendPage(res, fallback);
    const ev = await Event.findById(req.params.id).select('-attendees').lean();
    if (!ev) return sendPage(res, fallback);
    const data = eventPreview(ev, base);
    // image size for WhatsApp (og:image:width/height/type) when the flyer is stored with us
    if (data.image.includes('/s/img/event/')) {
      const d = dataUrlBuffer(ev.image);
      if (d) data.imageMeta = imageInfo(d.buf);
    }
    sendPage(res, data);
  } catch { sendPage(res, fallback); }
});

// invite link: /s/join?ref=<userId>
router.get('/s/join', (req, res) => {
  const base = origin(req);
  const ref = typeof req.query.ref === 'string' && /^[a-f0-9]{24}$/i.test(req.query.ref) ? req.query.ref : '';
  sendPage(res, {
    title: 'הוזמנת לקהילת נשי 💗',
    description: 'אירועים, חוגים, הגרלות, קהילה ורגעים קטנים של השראה — מרחב אחד, עדין ומחבק לנשים. ההצטרפות חינם.',
    image: `${base}/og-image.jpg`,
    url: `${base}/s/join${ref ? `?ref=${ref}` : ''}`,
    redirect: `/#/${ref ? `?ref=${ref}` : ''}`,
  });
});

export default router;
