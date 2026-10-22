import { REGIONS, CITIES, MAIN_CITIES, regionOfCity } from '../../shared/regions.js';

/**
 * Turns a free-text address ("היכל התרבות, הנשיא 80, אור עקיבא, ישראל") into one of NASHI's CITIES.
 * Strategy (precise first, guessy last):
 *   1. a comma/dash separated part of the address that IS a locality (spelling-tolerant, from the end)
 *   2. a known alias (ת"א, קרית ספר, פ"ת …) anywhere
 *   3. a MAIN city name appearing as whole words anywhere (e.g. "אולם בבני ברק")
 * Small localities are only matched by rule 1, so "רמות" in "רמות, ירושלים" doesn't win over ירושלים.
 */

// spelling-tolerant key (same idea as components/CityPicker.tsx)
export const cityKey = (s = '') => String(s).replace(/[\s\-"'״׳()`.]/g, '').replace(/וו/g, 'ו').replace(/יי/g, 'י');

const ALL = REGIONS.flatMap(r => CITIES[r.id]);
const BY_KEY = new Map();
for (const c of ALL) if (!BY_KEY.has(cityKey(c))) BY_KEY.set(cityKey(c), c);

// names used on ticketing sites → NASHI locality
const ALIASES = {
  'תל אביב יפו': 'תל אביב', 'תל-אביב-יפו': 'תל אביב', 'תל אביב-יפו': 'תל אביב', 'ת"א': 'תל אביב', 'יפו': 'תל אביב',
  'פ"ת': 'פתח תקווה', 'פתח תקוה': 'פתח תקווה',
  'קרית ספר': 'מודיעין עילית', 'קריית ספר': 'מודיעין עילית', 'מודיעין-מכבים-רעות': 'מודיעין', 'מודיעין מכבים רעות': 'מודיעין',
  'ביתר': 'ביתר עילית', 'ב"ב': 'בני ברק', 'ראשל"צ': 'ראשון לציון', 'ראשון': 'ראשון לציון',
  'נצרת עילית': 'נוף הגליל', 'קרית יערים': 'קריית יערים', 'טלזסטון': 'קריית יערים',
  'הר נוף': 'ירושלים', 'רמות ירושלים': 'ירושלים', 'גבעת שאול': 'ירושלים', 'רמת שלמה': 'ירושלים', 'גאולה': 'ירושלים', 'בית וגן': 'ירושלים',
  'רמת בית שמש': 'בית שמש', 'רמב"ש': 'בית שמש', 'קרית גת': 'קריית גת', 'קרית מלאכי': 'קריית מלאכי', 'קרית אתא': 'קריית אתא',
  'קרית שמונה': 'קריית שמונה', 'קרית ביאליק': 'קריית ביאליק', 'קרית מוצקין': 'קריית מוצקין', 'קרית ים': 'קריית ים',
  'קרית ארבע': 'קריית ארבע', 'קרית אונו': 'קריית אונו', 'קרית טבעון': 'קריית טבעון', 'מעלות': 'מעלות-תרשיחא', 'פרדס חנה': 'פרדס חנה-כרכור', 'קדימה': 'קדימה-צורן',
  'יהוד': 'יהוד-מונוסון', 'בנימינה': 'בנימינה-גבעת עדה', 'כוכב יאיר': 'כוכב יאיר-צור יגאל',
};
const ALIAS_KEYS = Object.entries(ALIASES).map(([a, c]) => [cityKey(a), c]).sort((x, y) => y[0].length - x[0].length);

const MAIN = new Set(REGIONS.flatMap(r => MAIN_CITIES[r.id]));
const MAIN_SORTED = [...MAIN].sort((a, b) => b.length - a.length);

const stripPrefix = (k) => k.replace(/^(ב|ל|מ|ו|וב|ול)(?=.{3,})/, '');

function exactPart(part) {
  const k = cityKey(part);
  if (!k) return '';
  if (BY_KEY.has(k)) return BY_KEY.get(k);
  for (const [ak, c] of ALIAS_KEYS) if (ak === k) return c;
  const k2 = stripPrefix(k);
  if (k2 !== k && BY_KEY.has(k2) && MAIN.has(BY_KEY.get(k2))) return BY_KEY.get(k2);
  return '';
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// whole-word match allowing a one-letter Hebrew prefix (ב/ל/מ/ו) and spelling variants of קריה
const wordRe = (name) => new RegExp(`(^|[^\\u0590-\\u05FFa-z])(?:[בלמו])?${escapeRe(name).replace(/קריית/g, 'קרי+ת').replace(/ /g, '[\\s\\-]+')}(?=$|[^\\u0590-\\u05FFa-z])`, 'i');
const MAIN_RES = MAIN_SORTED.map(c => [c, wordRe(c)]);
const ALIAS_RES = Object.entries(ALIASES).sort((a, b) => b[0].length - a[0].length).map(([a, c]) => [c, wordRe(a.trim())]);

/** @returns {{ city: string, region: string, how: string } | null} */
export function resolveCity(...texts) {
  const list = texts.flat().filter(t => typeof t === 'string' && t.trim());
  // 1. exact parts, last part first (addresses end with the city, sometimes followed by "ישראל")
  for (const t of list) {
    const parts = t.split(/[,|\n]|\s[-–]\s/).map(p => p.trim()).filter(Boolean).reverse();
    for (const p of parts) {
      if (/^(ישראל|israel)$/i.test(p)) continue;
      const c = exactPart(p.replace(/\d{5,7}/g, '').trim());
      if (c) return { city: c, region: regionOfCity(c), how: 'part' };
    }
  }
  // 2. aliases anywhere, 3. main cities anywhere
  for (const t of list) {
    for (const [c, re] of ALIAS_RES) if (re.test(t)) return { city: c, region: regionOfCity(c), how: 'alias' };
    for (const [c, re] of MAIN_RES) if (re.test(t)) return { city: c, region: regionOfCity(c), how: 'main' };
  }
  return null;
}
