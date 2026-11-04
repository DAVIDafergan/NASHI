// Manager roles. The main admin (isAdmin) can do everything; a regional manager (role 'regionAdmin') has a
// type that decides which sections she may publish in. Everyone only ever sees and edits what she created herself.
export const SECTIONS = ['events', 'classes', 'community', 'lotteries', 'vacations'];
export const SECTION_LABELS = {
  events: 'אירועים', classes: 'חוגים', community: 'קהילה וחסד', lotteries: 'הגרלות', vacations: 'נופשים',
};
export const MANAGER_TYPES = {
  // "מנהלת תרבות" — the full role (also what every manager appointed before types existed has)
  culture: { label: 'מנהלת תרבות', perms: ['events', 'classes', 'community', 'lotteries', 'vacations'] },
  // culture manager on behalf of the municipality
  municipal: { label: 'מנהל/ת תרבות מטעם העירייה', perms: ['events', 'vacations'] },
  // anyone else (e.g. a named person defined later) — starts with events + vacations, the main admin can change it per person
  other: { label: 'אחר', perms: ['events', 'vacations'] },
};
export const MANAGER_TYPE_IDS = Object.keys(MANAGER_TYPES);

export const normType = (t) => (MANAGER_TYPE_IDS.includes(t) ? t : 'culture');
export const cleanPerms = (arr) => (Array.isArray(arr) ? [...new Set(arr.filter((p) => SECTIONS.includes(p)))] : null);

/** The sections a user may publish in. Main admin → all. Regional manager → her own list, else the default of her type. Others → none. */
export function permsOf(u) {
  if (!u) return [];
  if (u.isAdmin === true) return [...SECTIONS];
  if (u.role !== 'regionAdmin') return [];
  const own = cleanPerms(u.managerPerms);
  return own && own.length ? own : [...MANAGER_TYPES[normType(u.managerType)].perms];
}
export const canDo = (u, section) => permsOf(u).includes(section);
