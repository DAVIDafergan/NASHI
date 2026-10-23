import { createTickchakAdapter } from './tickchak.js';
import { createSmarticketAdapter } from './smarticket.js';

/**
 * Active sources. Each adapter is { id, name, discover(http, ctx), prefilter?(candidate), details(candidate, http) }.
 * The pipeline runs them one after another and isolates failures (a failing source never stops the run).
 * IMPORTER_SOURCES=tickchak,… limits which run (default: all).
 */
export function activeAdapters() {
  const all = [createTickchakAdapter(), createSmarticketAdapter()];
  const only = (process.env.IMPORTER_SOURCES || '').split(',').map(s => s.trim()).filter(Boolean);
  return only.length ? all.filter(a => only.includes(a.id)) : all;
}

/**
 * Sites that were looked at for Haredi / women's events and why they are not (yet) an adapter.
 * Shown in the admin panel so the owner can decide what to add next.
 */
export const RESEARCHED_SOURCES = [
  { id: 'tickchak', name: "טיקצ'אק + גלאטיקט", status: 'active', note: 'רשימת אירועים ב-JSON ציבורי, פרטים ומחירים מ-form/init. גלאטיקט = הפורטל החרדי של טיקצ\'אק ("תרבות ברוח ההלכה").' },
  { id: 'tickchak-live', name: "טיקצ'אק LIVE (דפי ריכוז)", status: 'discovery', note: 'משמש רק לגילוי מזהים. האתר עצמו מצהיר שהנתונים "עודכנו ע״י AI מאתרי המכירה" — לכן מייבאים רק אירוע שנפתח כדף מכירה אמיתי של טיקצ\'אק.' },
  { id: 'eventer', name: 'Eventer', status: 'todo', note: 'לא נבדק מהשרת (הרשת בסביבת הפיתוח חסומה). לבדוק robots.txt, תנאי שימוש ונקודת JSON ציבורית לפני כתיבת מתאם.' },
  { id: 'smarticket', name: 'SmarTicket (היכלי תרבות ומתנ"סים)', status: 'active', note: 'אותה תבנית בכל היכל: דף בית + קטגוריות נשים (נשים / ערבי נשים / חרדיוות), דף אירוע עם JSON-LD. רשימת ההיכלים ב-IMPORTER_SMARTICKET_VENUES, עד 15 דפי אירוע להיכל בריצה.' },
  { id: 'leaan', name: 'לאן (leaan.co.il)', status: 'skip', note: 'בעיקר תרבות כללית/חילונית ומופעים מעורבים; מעט אירועים לנשים בלבד.' },
  { id: 'kupat', name: 'קופות עירוניות / מתנ״סים', status: 'todo', note: 'כל עירייה במערכת אחרת; עדיף שמנהלות התרבות יעלו ידנית.' },
];
