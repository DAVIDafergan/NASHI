import { loadImage } from './image';
import { BRAND, BRAND_COLORS } from '../shared/brand';

/** Background themes for text statuses — shared by the composer, the viewer and the WhatsApp card. */
export const STORY_THEMES: Record<string, { css: string; stops: string[]; ink: string }> = {
  rose:   { css: 'linear-gradient(160deg,#E7B9BC 0%,#C98289 55%,#A5636B 100%)', stops: ['#E7B9BC', '#C98289', '#A5636B'], ink: '#ffffff' },
  plum:   { css: 'linear-gradient(160deg,#9C7891 0%,#6E4A65 60%,#4A2F45 100%)', stops: ['#9C7891', '#6E4A65', '#4A2F45'], ink: '#ffffff' },
  sage:   { css: 'linear-gradient(160deg,#C9D6C3 0%,#93AA8B 60%,#6C8565 100%)', stops: ['#C9D6C3', '#93AA8B', '#6C8565'], ink: '#ffffff' },
  sunset: { css: 'linear-gradient(160deg,#F6D7B0 0%,#EBA48D 55%,#C9727A 100%)', stops: ['#F6D7B0', '#EBA48D', '#C9727A'], ink: '#ffffff' },
  night:  { css: 'linear-gradient(160deg,#4B3A4A 0%,#2B2027 70%,#1C1519 100%)', stops: ['#4B3A4A', '#2B2027', '#1C1519'], ink: '#F6E7E8' },
  cream:  { css: 'linear-gradient(160deg,#FFFDF9 0%,#F7EDE6 60%,#EED9D3 100%)', stops: ['#FFFDF9', '#F7EDE6', '#EED9D3'], ink: '#4A2F45' },
};
export const themeOf = (key?: string) => STORY_THEMES[key || ''] || STORY_THEMES.rose;

const W = 1080;
const H = 1920;

async function ensureFonts() {
  const fonts = (document as any).fonts;
  if (!fonts?.load) return;
  await Promise.all([
    fonts.load('300 80px "Noto Serif Hebrew"'),
    fonts.load('400 80px "Karantina"'),
    fonts.load('400 40px "Secular One"'),
    fonts.load('500 40px "Assistant"'),
  ]).catch(() => {});
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  text.split(/\n/).forEach(par => {
    const words = par.split(/\s+/).filter(Boolean);
    let line = '';
    words.forEach(w => {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
      else line = test;
    });
    lines.push(line);
  });
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBrand(ctx: CanvasRenderingContext2D, ink: string, author?: string) {
  // top wordmark
  ctx.textAlign = 'center';
  ctx.fillStyle = ink;
  ctx.font = '400 110px "Secular One", "Assistant", sans-serif';
  ctx.fillText(BRAND.name, W / 2, 210);
  ctx.globalAlpha = 0.85;
  ctx.font = '500 34px "Assistant", sans-serif';
  ctx.fillText(BRAND.tagline, W / 2, 268);
  ctx.globalAlpha = 1;

  // bottom pill with the site address
  const label = 'nashi-co.com';
  ctx.font = '400 44px "Secular One", "Assistant", sans-serif';
  const tw = ctx.measureText(label).width;
  const pw = tw + 120;
  const px = (W - pw) / 2;
  const py = H - 200;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  roundRect(ctx, px, py, pw, 96, 48);
  ctx.fill();
  ctx.fillStyle = BRAND_COLORS.navy;
  ctx.direction = 'ltr';
  ctx.fillText(label, W / 2, py + 64);
  ctx.direction = 'rtl';
  if (author) {
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.9;
    ctx.font = '500 36px "Assistant", sans-serif';
    ctx.fillText(`מאת ${author} · מתוך ${BRAND.name}`, W / 2, H - 245);
    ctx.globalAlpha = 1;
  }
}

/**
 * Renders a 1080×1920 image (the exact WhatsApp-status size) for a status.
 * Used for "share to my WhatsApp status".
 */
export async function renderStoryCard(story: { type: 'text' | 'image'; content: string; caption?: string; background?: string; authorName?: string }): Promise<Blob> {
  await ensureFonts();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.direction = 'rtl';
  const author = story.authorName ? story.authorName.split(' ')[0] : undefined;

  if (story.type === 'image') {
    const img = await loadImage(story.content);
    // blurred backdrop
    const cover = Math.max(W / img.width, H / img.height);
    ctx.filter = 'blur(48px) saturate(1.1)';
    ctx.drawImage(img, (W - img.width * cover) / 2, (H - img.height * cover) / 2, img.width * cover, img.height * cover);
    ctx.filter = 'none';
    const shade = ctx.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, 'rgba(43,32,39,0.55)');
    shade.addColorStop(0.5, 'rgba(43,32,39,0.15)');
    shade.addColorStop(1, 'rgba(43,32,39,0.65)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);

    // the photo itself, fully visible
    const caption = (story.caption || '').trim();
    const boxTop = 340;
    const boxBottom = caption ? H - 560 : H - 340;
    const maxW = W - 120;
    const maxH = boxBottom - boxTop;
    const fit = Math.min(maxW / img.width, maxH / img.height);
    const iw = img.width * fit;
    const ih = img.height * fit;
    const ix = (W - iw) / 2;
    const iy = boxTop + (maxH - ih) / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 20;
    roundRect(ctx, ix, iy, iw, ih, 44);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, ix, iy, iw, ih, 44);
    ctx.clip();
    ctx.drawImage(img, ix, iy, iw, ih);
    ctx.restore();

    if (caption) {
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = '400 52px "Secular One", "Assistant", sans-serif';
      wrap(ctx, caption, W - 180).slice(0, 3).forEach((l, i) => ctx.fillText(l, W / 2, H - 480 + i * 66));
    }
    drawBrand(ctx, '#ffffff', author);
  } else {
    const theme = themeOf(story.background);
    const g = ctx.createLinearGradient(0, 0, W * 0.6, H);
    theme.stops.forEach((c, i) => g.addColorStop(i / (theme.stops.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // soft glow
    const glow = ctx.createRadialGradient(W * 0.2, H * 0.25, 0, W * 0.2, H * 0.25, W);
    glow.addColorStop(0, 'rgba(255,255,255,0.28)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    const text = story.content.trim();
    const size = text.length < 60 ? 96 : text.length < 140 ? 78 : text.length < 260 ? 62 : 50;
    ctx.font = `300 ${size}px "Noto Serif Hebrew", Georgia, serif`;
    const lines = wrap(ctx, text, W - 200).slice(0, 16);
    const lh = size * 1.42;
    const top = H / 2 - (lines.length * lh) / 2 + size * 0.6;
    ctx.fillStyle = theme.ink;
    ctx.textAlign = 'center';
    // decorative quote marks
    ctx.globalAlpha = 0.35;
    ctx.font = '400 220px "Karantina", serif';
    ctx.fillText('״', W / 2, top - lh * 0.4);
    ctx.globalAlpha = 1;
    ctx.font = `300 ${size}px "Noto Serif Hebrew", Georgia, serif`;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * lh));
    drawBrand(ctx, theme.ink, author);
  }

  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('יצירת התמונה נכשלה'))), 'image/jpeg', 0.92));
}
