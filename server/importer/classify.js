import { regionOfCity } from '../../shared/regions.js';
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
 *   'haredi' (default) — STRICT, see strictHaredi() below. NASHI shows Haredi-only content.
 *   'broad'  — any women-oriented event with no secular/mixed/party signal (kept for reference / testing).
 */
export const audienceMode = () => (process.env.IMPORTER_AUDIENCE === 'broad' ? 'broad' : 'haredi');

// ---------- strict Haredi rules ----------
// hard rejects, whatever else the event says
const HARD = [
  ['מסיבה / ריקודים', words(['מסיבה', 'מסיבת', 'מסיבות', 'רחבה', 'רחבת ריקודים', 'ריקודים', 'רוקדות', 'ריקוד', 'דאנס', 'dance', 'party'], true)],
  ['קאלמה', /קאלמה/],
  ['מוזיקה נוצרית / כנסייה', /סטבט|stabat|מאטר\s|כנסיי?ה|כנסיית|נוצרי|מיסה\b|רקוויאם|requiem|גוספל|gospel|חג המולד|כריסטמס/i],
  ['קהל מעורב', words(['אמהות ואבות', 'אבות ואמהות', 'אבות', 'לאבות', 'הורים', 'להורים', 'הורים וילדים', 'זוגות', 'לזוגות', 'משפחות', 'למשפחות', 'לכל המשפחה', 'משפחתי'], true)],
  ['פסטיבל סרטים / דוקאביב', /דוקאביב|docaviv/i],
  ['קיבוץ / מקום חילוני', words(['קיבוץ', 'בקיבוץ', 'כרמים', 'עלומים'], true)],
];
// these are out unless the text itself says it's Haredi (a Haredi city alone is not enough)
const SECULAR_UNLESS_HAREDI_WORD = [
  ['פילאטיס / יוגה', words(['פילאטיס', 'יוגה', 'pilates', 'yoga'], true)],
  ['נעמ"ת', /נעמ"?ת|נעמ״ת/],
  ['חודש האישה', /חודש האישה|יום האישה הבינלאומי/],
];
// female performers / makers ("הזמרת", "מגישות", "שרות", "תיאטרון נשי" …)
const FEMALE_STAGE = /הזמרת|הזמרות|זמרות|מגישות|השחקניות|שחקניות|יוצרות|שרות|מנגנות|רוקדות|עולות (?:יחד )?(?:ל|אל )?הבמה|עולות יחד לבמה|תיאטרון נשי|פסטיבל (?:תיאטרון )?נשי|מופע נשי|ערב נשי|אמהות ובנות|אימהות ובנות|הרבנית|בהנחיית (?:ה)?גב'/;
const FILM = words(['סרט', 'סרטים', 'הקרנה', 'הקרנת', 'הקרנות', 'קולנוע', 'פסטיבל סרטים'], true);
const HAREDI_WORD = /חרדי|חרדית|חרדיות|חרדיוות|חסידי|חסידית|לבנות סמינר|סמינר|ללא סרטים|השלוחה החרדית|ברוח ההלכה|על טהרת הקודש/;
export const HAREDI_CITIES = ['בני ברק', 'ביתר עילית', 'מודיעין עילית', 'אלעד', 'בית שמש', 'רכסים', 'עמנואל', 'קריית יערים', 'כפר חב"ד', 'קוממיות', 'תפרח'];
const HAREDI_PLACES = /רמות|רוממה|גאולה|בנייני האומה|הר נוף|רמת שלמה|קרית צאנז|קריית צאנז|מאה שערים|בית וגן|קרית בעלז|קריית בעלז|רמת אלחנן|קרית ספר|קריית ספר|רמת בית שמש|קרית יערים|טלזסטון|ביתר/;
const envList = (k) => (process.env[k] || '').split(',').map(x => x.trim()).filter(Boolean);
// venues that regularly host religious/Haredi women's shows (env IMPORTER_RELIGIOUS_VENUES adds more)
const RELIGIOUS_VENUE = new RegExp(['בית מזי"א', 'בית מזיא', 'בית מזי״א', 'ירושלים', 'בית תרבות שרת', 'נאוה ביבי', 'בנייני האומה', 'היכל התרבות רמות', ...envList('IMPORTER_RELIGIOUS_VENUES')].map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));
const SHOMRON_PLACE = new RegExp(['אריאל', 'קרני שומרון', 'קדומים', 'עלי', 'שילה', 'בית אל', 'אלקנה', 'קריית ארבע', 'כוכב יעקב', 'טלמון', 'אפרת', 'גבעת זאב', 'מעלה אדומים', 'אשכול פיס אריאל'].join('|'));
const HAREDI_ORGANIZERS = () => [/השלוחה החרדית/, /בית יעקב/, /המתנ"ס החרדי|המתנ״ס החרדי/, /רשת חינוך עצמאי|החינוך העצמאי/, ...envList('IMPORTER_HAREDI_ORGANIZERS').map(x => new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))];
const WOMEN_IN_TITLE = words(['נשים', 'לנשים', 'הנשים', 'ונשים', 'ולנשים', 'נשות'], false);
// explicit women-only show phrasing (stronger than a bare "נשים"): with a religious context it is enough on its own
const WOMEN_SHOW_PHRASE = /(?:הצגה|הצגת|מופע|ערב|כנס|הרצאה|מחזמר|התוועדות|סדנה|סדנת|הקרנה|הקרנת|יום עיון)\s+(?:ל|ל?ה)?נשים|נשים\s?נ?בלבד|לנשים ו?(?:ל)?(?:נערות|בנות)/;
// religious context (narrow on purpose — holidays alone don't count)
const RELIGIOUS_CONTEXT = /רבנית|הרבנית|ברוח ההלכה|בהפרדה|התוועדות|שיעור תורה|\bהרב\b|בס"ד|בס״ד|בסייעתא דשמיא|צניעות|תורה|תורות|חסידי|אמונה|ראש חודש|סמינר|בית יעקב|חב"ד|חב״ד|עזרת נשים|הלכה|תהילים|קבר רחל|מערת המכפלה|הילולא|הילולת|זצ"ל|זצ״ל|צדיקים|קדושה|בית כנסת|ישיבת|ישיבה|אמא רחל/;
// a class / group for women named in the title ("חוג ציור נשים", "התעמלות נשים", "מפגשי בוקר לאמא ולתינוק")
const WOMEN_CLASS_TITLE = /(?:חוג|חוגי|קורס|סדנ[הת]|סדנאות|קבוצ[הת]|מפגש|מפגשי|מועדון|בוקר|התעמלות|פיטנס|כושר|שיעור|שיעורי|לימוד|מעגל)[^|\n]{0,30}?(?:\s|^)(?:ל|ה)?נשים(?:\s|$|[-–,:|])|(?:ל|ה)?אמא ו?(?:ל|ה)?תינוק|אימא,? תינוק|לאמהות(?! ו)|לאימהות(?! ו)/;
const WOMEN_CATEGORY = /נשים|חרדיוות|חרדיות/;

/**
 * Keep an event only when BOTH hold — otherwise reject ("when unsure, reject"):
 *   (a) explicitly for women: "לנשים בלבד"-type phrase, "נשים" in the title, or a women's / Haredi category (נשים, חרדיוות)
 *   (b) a Haredi signal: Haredi source (Glatticket), category חרדיוות, Haredi city or neighbourhood, known Haredi
 *       organiser, or words like חרדי / חסידי / לבנות סמינר / ללא סרטים / השלוחה החרדית
 * Hard rejects first: parties & dancing, קאלמה, church/Christian music, mixed audiences (parents, couples, families),
 * DocAviv, kibbutz venues; pilates/yoga, נעמ"ת and חודש האישה unless explicitly Haredi; films not marked women-only.
 * (Images can't be checked automatically — that stays with the admin's hide/delete.)
 */
export function strictHaredi({ title = '', description = '', location = '', category = '', city = '', organizer = '', strong = false, womenSection = false }) {
  const text = `${title}\n${category}\n${description}\n${location}\n${organizer}`.replace(/[\u0591-\u05C7]/g, '');
  for (const [why, re] of HARD) if (re.test(text)) return { ok: false, reason: `לא מתאים: ${why}`, hard: true };
  const harediWord = HAREDI_WORD.test(text);
  for (const [why, re] of SECULAR_UNLESS_HAREDI_WORD) if (re.test(text) && !harediWord) return { ok: false, reason: `לא מתאים: ${why}`, hard: true };
  if (MIXED_HINT.test(text)) return { ok: false, reason: 'קהל מעורב', hard: true };
  const ex = EXCLUDE.exec(text);
  if (ex) return { ok: false, reason: `לא מתאים: "${ex[0].trim()}"`, hard: true };

  const explicitOnly = WOMEN_ONLY.test(text) || /נשים\s?נ?בלבד/.test(text) || /לבנות סמינר/.test(text);
  // a women's section on a Haredi source page (Glatticket "הופעות לנשים") counts like a women's category
  const womenCategory = WOMEN_CATEGORY.test(category) || womenSection;
  // on a Haredi source (Glatticket) women on stage mean a women-only audience (קול אשה), and its film screenings are
  // the Haredi women's cinema circuit — men-only events were already rejected above ("גברים")
  const film = FILM.test(`${title}\n${category}`);
  const strongWomen = strong && (FEMALE_STAGE.test(text) || film);
  const motherBaby = /(?:ל|ה)?אמא ו?(?:ל|ה)?תינוק|אימא,? תינוק|אמהות ותינוקות|אימהות ותינוקות/.test(title);
  const womenOnly = explicitOnly || womenCategory || strongWomen || motherBaby || WOMEN_IN_TITLE.test(title.replace(/[\u0591-\u05C7]/g, ''));
  if (!womenOnly) return { ok: false, reason: 'לא מסומן במפורש כאירוע לנשים' };
  if (film && !(explicitOnly || womenCategory || strongWomen)) return { ok: false, reason: 'סרט שלא מסומן לנשים בלבד', hard: true };
  if (SOFT_EXCLUDE.test(text) && !(strong || /חרדי/.test(category) || explicitOnly)) return { ok: false, reason: 'סטנדאפ שלא מסומן לנשים חרדיות', hard: true };

  const signals = [];
  if (strong) signals.push('מקור חרדי');
  if (/חרדי/.test(category)) signals.push(`קטגוריה "${category}"`);
  if (harediWord) signals.push('מילה חרדית');
  const placeText = `${location}\n${title}\n${organizer}`;
  const hcity = HAREDI_CITIES.find(c => c === city || placeText.includes(c));
  if (hcity) signals.push(`עיר חרדית (${hcity})`);
  if (HAREDI_PLACES.test(`${location}\n${title}`)) signals.push('שכונה/מקום חרדי');
  if (HAREDI_ORGANIZERS().some(re => re.test(text))) signals.push('מארגן חרדי');
  // owner's decision (2026-10-25): every city counts as Haredi — a women-only event with a known place passes
  // (hard rejects above still apply: parties, mixed audiences, kibbutz venues, church music, films not for women…)
  if (!signals.length && process.env.IMPORTER_ALL_CITIES_HAREDI === '1' && (city || location)
    && (explicitOnly || womenCategory || WOMEN_SHOW_PHRASE.test(text) || WOMEN_CLASS_TITLE.test(title.replace(/[\u0591-\u05C7]/g, '')))) signals.push('כל הערים מסומנות כחרדיות');
  if (!signals.length) return { ok: false, reason: 'אין סימן שהאירוע לציבור החרדי' };
  return { ok: true, womenOnly: true, strength: 'haredi', reasons: [explicitOnly ? 'לנשים בלבד' : womenCategory ? (womenSection && !WOMEN_CATEGORY.test(category) ? 'במדור לנשים' : `קטגוריה "${category}"`) : WOMEN_IN_TITLE.test(title.replace(/[\u0591-\u05C7]/g, '')) ? '"נשים" בכותרת' : film ? 'הקרנה במקור חרדי' : 'נשים על הבמה במקור חרדי', ...signals] };
}

export function classifyEvent({ title = '', description = '', location = '', categoryText = '', category = '', city = '', organizer = '', strong = false, womenSection = false, mode = audienceMode() } = {}) {
  if (mode === 'haredi') return strictHaredi({ title, description, location, category, city, organizer, strong, womenSection });
  const text = `${title}\n${categoryText}\n${category}\n${description}\n${location}`.replace(/[\u0591-\u05C7]/g, ''); // drop niqqud
  const reasons = [];
  if (MIXED_HINT.test(text)) return { ok: false, reason: 'קהל מעורב' };
  const ex = EXCLUDE.exec(text);
  if (ex) return { ok: false, reason: `לא מתאים: "${ex[0].trim()}"` };
  // also catches real-world typos like "לנשיםנבלבד" (Glatticket 113204) where word boundaries fail
  const womenOnly = WOMEN_ONLY.test(text) || /נשים\s?נ?בלבד/.test(text);
  // stand-up: out, unless it's a women-only show or listed by a Haredi source/category ("חרדיוות")
  const su = SOFT_EXCLUDE.exec(text);
  if (su && !(strong || womenOnly)) return { ok: false, reason: `לא מתאים: "${su[0].trim()}"` };
  const women = womenOnly || WOMEN.test(text) || WOMEN_CATEGORY.test(category);
  if (!women) return { ok: false, reason: 'לא נמצא סימון שהאירוע לנשים' };
  if (womenOnly) reasons.push('לנשים בלבד');
  const religious = RELIGIOUS.test(text);
  if (religious) reasons.push('מאפיין דתי');
  if (strong) reasons.push('מקור חרדי / קטגוריית נשים');
  if (!(strong || womenOnly || religious)) {
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
export function missingFields(ev, now = new Date(), { allowNoFlyer = false, requirePrice } = {}) {
  const missing = [];
  if (!ev.title || ev.title.trim().length < 3) missing.push('שם');
  if (!(ev.startAt instanceof Date) || isNaN(ev.startAt.getTime())) missing.push('תאריך ושעה');
  else if (ev.startAt.getTime() <= now.getTime()) missing.push('עבר');
  if (!ev.venue || ev.venue.trim().length < 2) missing.push('מקום');
  if (!ev.city) missing.push('עיר מוכרת');
  const priced = ev.isFree === true || (Number.isFinite(ev.priceMin) && ev.priceMin > 0);
  // price is shown when known; a missing price alone doesn't keep an event out (IMPORTER_REQUIRE_PRICE=1 restores that)
  if (!priced && (requirePrice ?? process.env.IMPORTER_REQUIRE_PRICE === '1')) missing.push('מחיר');
  if (!ev.ticketUrl || !/^https:\/\//i.test(ev.ticketUrl)) missing.push('קישור לרכישה');
  if (!allowNoFlyer && !hasRealFlyer(ev)) missing.push('פלייר');
  return missing;
}

export const hasRealFlyer = (ev) => !!ev.imageUrl && /^https?:\/\//i.test(ev.imageUrl) && !/\/(?:default|eventNew|no-?image|placeholder)[^/]*$/i.test(ev.imageUrl);
