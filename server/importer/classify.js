/**
 * Is this event for NASHI? — women's audience AND suitable for the Haredi / religious public.
 *
 * Rules (in order):
 *   1. any EXCLUDE marker (men / mixed audience, bars & clubs, alcohol, dating…) → reject
 *   2. a WOMEN marker is required (לנשים, נשים, נשות, בנות, נערות, אמהות, רבנית…)
 *   3. suitability: a strong signal (Glatticket = "תרבות ברוח ההלכה", or a women's category on the source)
 *      OR an explicit women-only phrase (לנשים בלבד / לנשים ולנערות בלבד)
 *      OR a religious marker (רבנית, ברוח ההלכה, בהפרדה מלאה, התוועדות, שיעור…)
 * Pure function — tested in tests/importer.test.js.
 */

const W = '(?:^|[^\\u0590-\\u05FF])'; // word start (Hebrew has no \b)
const E = '(?=$|[^\\u0590-\\u05FF])';
// prefix=true also accepts a one/two-letter Hebrew prefix (ה/ו/ב/ל/מ/ש, "ול…"): המחזמר, ולנערות
const words = (list, prefix = false) => new RegExp(`${W}${prefix ? '(?:[הובלמש]|ו[הבלמ])?' : ''}(?:${list.join('|')})${E}`, 'i');

const WOMEN_ONLY = words([
  'לנשים בלבד', 'לנשים ונערות בלבד', 'לנשים ולנערות בלבד', 'לנשים ובנות בלבד', 'לבנות בלבד', 'לנערות בלבד',
  'מיועד לנשים בלבד', 'מיועדת לנשים בלבד', 'הכניסה לנשים בלבד', 'נשים בלבד', 'לנשים ולבנות בלבד',
]);
const WOMEN = words([
  'נשים', 'לנשים', 'הנשים', 'ונשים', 'נשות', 'לנשות', 'אישה', 'לאישה', 'האישה', 'ערב נשי', 'ערב נשים', 'כנס נשים',
  'בנות', 'לבנות', 'הבנות', 'נערות', 'לנערות', 'הנערות', 'אמהות', 'לאמהות', 'אמא ובת', 'אמהות ובנות', 'אם ובת',
  'רבנית', 'הרבנית', 'מרת', 'כלות', 'נשי', 'אמא', 'לאמא', 'אמהות וילדים', 'אמא וילד', 'נשות הקהילה', 'סבתות',
]);
const RELIGIOUS = words([
  'רבנית', 'הרבנית', 'ברוח ההלכה', 'על טהרת הקודש', 'בהפרדה', 'בהפרדה מלאה', 'התוועדות', 'שיעור', 'שיעורי', 'הרב', 'בס"ד', 'בסייעתא דשמיא',
  'בהשגחת', 'כשרות', 'כשר', 'מהדרין', 'צניעות', 'תורה', 'חסידי', 'חסידית', 'אמונה', 'ראש חודש', 'חנוכה', 'פורים', 'ט"ו בשבט', 'ל"ג בעומר',
  'ערב שירה', 'מחזמר', 'סמינר', 'מוסדות', 'בית יעקב', 'חב"ד', 'עזרת נשים', 'גלאטיקט', 'טהרת המשפחה', 'הלכה', 'הלכות',
]);
const EXCLUDE = words([
  'גברים', 'לגברים', 'לגברים בלבד', 'גבר', 'קהל מעורב', 'מעורב', 'זוגות', 'לזוגות', 'רווקים', 'רווקות ורווקים', 'היכרויות', 'דייטינג',
  'קומדי בר', 'קומדי קלאב', 'בבר', 'הבר', 'בר יין', 'בר קוקטיילים', 'פאב', 'בפאב', 'מועדון', 'במועדון', 'קלאב',
  'אלכוהול', 'בירה קרה', 'בירות', 'קוקטייל', 'קוקטיילים', 'יין חופשי', 'וודקה', 'וויסקי',
  'מסיבת טבע', 'רייב', 'טכנו', 'מסיבת בריכה', 'פול פארטי', 'בגדי ים', 'אפטר פארטי', 'דיג\'יי', 'DJ', 'ריקודי זוגות', 'לזוגות', 'זוגי', 'לכל המשפחה', 'הורים וילדים', 'אבא ובן', 'בגירים', '18\\+', '\\+18', 'מעל גיל 18 בלבד',
]);
const SOFT_EXCLUDE = words(['סטנדאפ', 'סטנד אפ', 'סטנד-אפ'], true);
// Men singers/performers aren't excluded by name (we can't know), but these phrasings are clearly mixed:
const MIXED_HINT = /קהל\s+(?:מעורב|כללי)|גברים\s+ונשים|נשים\s+וגברים|ישיבה\s+מעורבת/;

/**
 * mode (IMPORTER_AUDIENCE):
 *   'broad'  (default) — NASHI's audience is "קהילת נשים דתיות": any women-oriented event (shows, lectures, workshops,
 *                         courses, classes, בית מדרש, challah, tours, mothers & kids…) with NO secular/mixed/party signal.
 *   'haredi' — stricter: also needs a strong source, an explicit women-only phrase, or a religious marker.
 */
export const audienceMode = () => (process.env.IMPORTER_AUDIENCE === 'haredi' ? 'haredi' : 'broad');

export function classifyEvent({ title = '', description = '', location = '', categoryText = '', strong = false, mode = audienceMode() } = {}) {
  const text = `${title}\n${categoryText}\n${description}\n${location}`.replace(/[֑-ׇ]/g, ''); // drop niqqud
  const reasons = [];
  if (MIXED_HINT.test(text)) return { ok: false, reason: 'קהל מעורב' };
  const ex = EXCLUDE.exec(text);
  if (ex) return { ok: false, reason: `לא מתאים: "${ex[0].trim()}"` };
  // also catches real-world typos like "לנשיםנבלבד" (Glatticket 113204) where word boundaries fail
  const womenOnly = WOMEN_ONLY.test(text) || /נשים\s?נ?בלבד/.test(text);
  // stand-up: out, unless it's a women-only show or listed by a Haredi source/category ("חרדיוות")
  const su = SOFT_EXCLUDE.exec(text);
  if (su && !(strong || womenOnly)) return { ok: false, reason: `לא מתאים: "${su[0].trim()}"` };
  const women = womenOnly || WOMEN.test(text);
  if (!women) return { ok: false, reason: 'לא נמצא סימון שהאירוע לנשים' };
  if (womenOnly) reasons.push('לנשים בלבד');
  const religious = RELIGIOUS.test(text);
  if (religious) reasons.push('מאפיין דתי');
  if (strong) reasons.push('מקור חרדי / קטגוריית נשים');
  if (!(strong || womenOnly || religious)) {
    if (mode === 'haredi') return { ok: false, reason: 'לא ברור שמתאים לציבור הדתי/חרדי' };
    reasons.push('אירוע לנשים (מצב רחב)');
    return { ok: true, womenOnly, strength: 'women', reasons };
  }
  return { ok: true, womenOnly, strength: strong ? 'strong' : womenOnly ? 'women-only' : 'religious', reasons };
}

// NASHI's event categories (components/admin/EventsAdmin.tsx)
const CATEGORY_RULES = [
  ['תורה ויהדות', words(['רבנית', 'הרבנית', 'שיעור', 'שיעורי', 'התוועדות', 'תורה', 'הלכה', 'הלכות', 'פרשת', 'אמונה', 'טהרת המשפחה'], true)],
  ['סדנאות', words(['סדנה', 'סדנת', 'סדנאות', 'סדנא', 'workshop'], true)],
  ['אופנה', words(['אופנה', 'תצוגת אופנה', 'סטיילינג', 'יריד אופנה'], true)],
  ['העשרה', words(['הרצאה', 'הרצאת', 'כנס', 'ערב העצמה', 'העצמה', 'סמינר', 'כנס נשים', 'יום עיון'], true)],
  ['מוזיקה', words(['הופעה', 'מופע', 'זמרת', 'זמרות', 'קונצרט', 'מוזיקלי', 'מוזיקה', 'ערב שירה', 'להקה', 'מקהלה'], true)],
  ['בידור', words(['הצגה', 'מחזמר', 'תיאטרון', 'הפקה', 'קומדיה', 'מופע קומי', 'בידור'], true)],
  ['קהילה', words(['ערב גיבוש', 'מפגש', 'קהילה', 'יריד', 'ערב התרמה'], true)],
];
export function categoryFor(text = '') {
  for (const [cat, re] of CATEGORY_RULES) if (re.test(text)) return cat;
  return 'אחר';
}

export function audienceFor(text = '') {
  if (words(['בנות', 'לבנות', 'נערות', 'לנערות', 'אמא ובת', 'אמהות ובנות', 'אם ובת'], true).test(text)) return ['נשים ובנות'];
  return ['נשים בלבד'];
}

/**
 * Completeness: we only publish an event that has everything a woman needs to decide and buy.
 * `ev` is the normalized event built by an adapter.
 */
export function missingFields(ev, now = new Date(), { allowNoFlyer = false } = {}) {
  const missing = [];
  if (!ev.title || ev.title.trim().length < 3) missing.push('שם');
  if (!(ev.startAt instanceof Date) || isNaN(ev.startAt.getTime())) missing.push('תאריך ושעה');
  else if (ev.startAt.getTime() <= now.getTime()) missing.push('עבר');
  if (!ev.venue || ev.venue.trim().length < 2) missing.push('מקום');
  if (!ev.city) missing.push('עיר מוכרת');
  const priced = ev.isFree === true || (Number.isFinite(ev.priceMin) && ev.priceMin > 0);
  if (!priced) missing.push('מחיר');
  if (!ev.ticketUrl || !/^https:\/\//i.test(ev.ticketUrl)) missing.push('קישור לרכישה');
  if (!allowNoFlyer && !hasRealFlyer(ev)) missing.push('פלייר');
  return missing;
}

export const hasRealFlyer = (ev) => !!ev.imageUrl && /^https?:\/\//i.test(ev.imageUrl) && !/\/(?:default|eventNew|no-?image|placeholder)[^/]*$/i.test(ev.imageUrl);
