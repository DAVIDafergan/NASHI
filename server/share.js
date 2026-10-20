import express from 'express';
import mongoose from 'mongoose';
import { Story, Personality } from './models.js';

/**
 * Link-preview pages for WhatsApp / Facebook / Telegram.
 * The site is a hash-router SPA, so crawlers can't see per-page titles or images.
 * /s/... returns a tiny HTML page with Open Graph tags and immediately forwards people to the real page.
 */
const router = express.Router();

const esc = (v = '') => String(v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const clip = (v = '', n = 180) => { const s = String(v).replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const origin = (req) => `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;

const page = ({ title, description, image, url, redirect }) => `<!doctype html>
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

// ---- images that crawlers can fetch ----
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
