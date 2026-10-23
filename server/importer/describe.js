import { HDate } from '@hebcal/core';
import { htmlToText, metaContent } from './text.js';
import { israelParts } from './time.js';

/**
 * A real description for an imported event:
 *  1. the fullest text the source has — form/init description, the page's "about" box (details2-textbox),
 *     JSON-LD description, og:description — cleaned of contacts and ticketing boilerplate;
 *  2. when that is short (< MIN_LEN), a clear Hebrew intro composed ONLY from facts we have
 *     (kind, audience, when, where, price, where tickets are sold) is put before it.
 * Pure — tested in tests/importer.describe.test.js.
 */
export const MIN_LEN = 150;

const BOILERPLATE = [
  /טיקצ'?אק אינה אחראית/, /החברה מספקת מערכת/, /מערכת למכירת כרטיסים/, /לרכישת כרטיסים לחצ/, /הכרטיסים נמכרים ב/,
  /מדיניות ביטול/, /תקנון/, /powered by/i, /^שתפו$/, /^התקשרו$/, /^אזור אישי$/,
];
const CONTACT = /(?:\+?972|0)[-\s]?\d{1,2}[-\s]?\d{3}[-\s]?\d{4}|[\w.+-]+@[\w-]+\.[\w.]+|wa\.me\/|וואטסאפ\s*:?\s*\d|טלפון\s*:?\s*\d|לפרטים\s*:?\s*0\d/i;

/** Cleans scraped text: drops contact lines / boilerplate / the bare title, keeps paragraphs and emojis. */
export function cleanDescription(text = '', title = '') {
  const norm = (s) => s.replace(/[\s"'״׳!.,\-–—:]/g, '');
  const lines = String(text).replace(/\r/g, '').split('\n').map(l => l.replace(/[ \t ]+/g, ' ').trim());
  const out = [];
  for (const l of lines) {
    if (!l) { if (out.length && out[out.length - 1] !== '') out.push(''); continue; }
    if (CONTACT.test(l) || BOILERPLATE.some(re => re.test(l))) continue;
    if (title && norm(l) === norm(title) && !out.some(Boolean)) continue; // the title repeated as the first line
    if (out.includes(l) && l.length < 80) continue; // repeated short lines (page headings)
    out.push(l);
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** The page's own "about" text (Tickchak / Glatticket landing pages put it in .details2-textbox). */
export function pageAboutText(html = '') {
  const parts = [];
  const re = /<div[^>]+class="[^"]*details2-textbox[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  let m;
  while ((m = re.exec(html))) parts.push(htmlToText(m[1]));
  // JSON-LD Event.description on the page
  const ld = /"@type"\s*:\s*"Event"[\s\S]{0,4000}?"description"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(html);
  if (ld) { try { parts.push(JSON.parse(`"${ld[1]}"`)); } catch { /* ignore */ } }
  return parts;
}

// what the event IS — only when the text says so
const KINDS = [
  ['מחזמר', /מחזמר/], ['הצגה', /הצגה|הצגת|תיאטרון/], ['הקרנת סרט', /הקרנ[הת]|סרט\b|סרט /], ['מופע', /מופע|הופעה|קונצרט|ג'אם/],
  ['הרצאה', /הרצאה|הרצאת|מרצה/], ['סדנה', /סדנ[הא]|סדנת/], ['כנס', /כנס\b|כנס /], ['יום עיון', /יום עיון/],
  ['שיעור', /שיעור/], ['קורס', /קורס/], ['חוג', /חוג\b|חוג /], ['בית מדרש', /בית מדרש/], ['ערב הפרשת חלה', /הפרשת חלה|חלות/],
  ['טיול', /טיול|סיור/], ['שמחת בית השואבה', /שמחת בית השואבה/], ['ערב', /ערב /],
];
export const kindOf = (text = '') => (KINDS.find(([, re]) => re.test(text)) || [])[0] || '';

const AUD = [
  ['לנשים ולנערות בלבד', /לנשים ו?(?:ל)?נערות בלבד|נשים ונערות בלבד/], ['לנשים ובנות בלבד', /לנשים ו?(?:ל)?בנות בלבד/],
  ['לנשים בלבד', /נשים\s?נ?בלבד/], ['לבנות בלבד', /לבנות בלבד/], ['לנערות בלבד', /לנערות בלבד/],
  ['לאמהות וילדים', /אמהות ו?ילדים|אמא ו?ילד/], ['לנשים ולנערות', /לנשים ו?(?:ל)?נערות/], ['לנשים', /לנשים|נשים/],
];
export const audienceOf = (text = '') => (AUD.find(([, re]) => re.test(text)) || [])[0] || '';
const ageOf = (text = '') => (/(?:מגיל|גילאי|גיל)\s*(\d{1,2}(?:\s*[-–+]\s*\d{0,2})?\+?)/.exec(text) || [])[0] || '';

const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export function whenLine(startAt) {
  if (!(startAt instanceof Date) || isNaN(startAt)) return '';
  const { date, time } = israelParts(startAt);
  const d = new Date(`${date}T12:00:00Z`);
  const greg = d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  let heb = '';
  try { heb = new HDate(d).renderGematriya(true); } catch { /* ignore */ }
  return `יום ${WEEKDAYS[d.getUTCDay()]}, ${greg}${heb ? ` (${heb})` : ''} · בשעה ${time}`;
}

export function priceLine(n) {
  if (n.isFree) return 'הכניסה חופשית';
  const paid = (n.tickets || []).filter(t => t.price > 0);
  if (paid.length > 1 && new Set(paid.map(t => t.price)).size > 1) return `כרטיסים: ${paid.map(t => `${t.title ? `${t.title} ` : ''}₪${Math.round(t.price)}`).join(' · ')}`;
  return Number.isFinite(n.priceMin) && n.priceMin > 0 ? `מחיר כרטיס: ₪${Math.round(n.priceMin)}` : '';
}

/**
 * @param n normalized event (title, description, startAt, venue, location, city, priceMin, isFree, tickets, sourceName, soldOut)
 * @param sources extra raw texts (page about box, og:description…)
 */
export function buildDescription(n, sources = []) {
  // page text first: on equal length it wins (form/init text sometimes has typos the page fixed)
  const candidates = [...sources, n.description].filter(Boolean).map(t => cleanDescription(t, n.title));
  // fullest text wins; others are added only if they bring something new
  candidates.sort((a, b) => b.length - a.length);
  let body = candidates[0] || '';
  for (const c of candidates.slice(1)) {
    const key = c.replace(/\s/g, '').slice(0, 40);
    if (c.length > 30 && key && !body.replace(/\s/g, '').includes(key)) body += `\n\n${c}`;
  }
  body = body.slice(0, 2500).trim();
  if (body.length >= MIN_LEN) return body;

  const text = `${n.title}\n${body}`;
  const kind = kindOf(text);
  const aud = audienceOf(text);
  const age = ageOf(text);
  const where = [n.venue, n.city && !(n.venue || '').includes(n.city) ? n.city : ''].filter(Boolean).join(', ');
  const fullWhere = n.location && n.location.length > where.length ? n.location : where;
  const lines = [];
  const opener = [kind && `${kind}`, aud, age && `(${age})`].filter(Boolean).join(' ');
  lines.push(`${n.title}${opener ? ` — ${opener}` : ''}${where ? ` ב${where}` : ''}.`);
  if (body && body.replace(/[\s.!]/g, '') !== n.title.replace(/[\s.!]/g, '')) lines.push(body);
  const facts = [];
  const w = whenLine(n.startAt);
  if (w) facts.push(`📅 ${w}`);
  if (fullWhere) facts.push(`📍 ${fullWhere}`);
  const p = priceLine(n);
  if (p) facts.push(`🎟️ ${p}${n.soldOut ? ' (אזלו הכרטיסים)' : ''}`);
  if (facts.length) lines.push(facts.join('\n'));
  if (n.sourceName) lines.push(`הכרטיסים נמכרים באתר ${n.sourceName}.`);
  return lines.join('\n\n');
}

export const pageSources = (html = '') => [...pageAboutText(html), metaContent(html, 'og:description'), metaContent(html, 'description')].filter(Boolean);
