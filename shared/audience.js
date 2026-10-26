// Who an item is for — shared by the website and the server.
//   content item → audience: 'women' | 'men' | 'all'  (Event, Class, Community, Lottery)
//   user         → gender (optional): 'male' | 'female' — only for wording emails / texts
// Everything created before the field existed was made for women: a missing (or legacy tag-array) audience reads
// as 'women'. No data migration is needed.

export const AUDIENCE_IDS = ['women', 'men', 'all'];

/** Options for the required selector in the admin / manager forms. */
export const AUDIENCE_OPTIONS = [
  { id: 'men', label: 'לגברים', hint: 'אירוע / חוג לגברים בלבד' },
  { id: 'women', label: 'לנשים', hint: 'אירוע / חוג לנשים בלבד' },
  { id: 'all', label: 'לכולם', hint: 'משפחות / כלל הציבור' },
];
/** Small badge on every item. */
export const AUDIENCE_BADGE = { men: 'לגברים', women: 'לנשים', all: 'לכולם' };

/** Effective audience of an item (or of a raw value). Missing / legacy array / unknown → 'women'. */
export function audienceOf(x) {
  const a = x && typeof x === 'object' && !Array.isArray(x) ? x.audience : x;
  return a === 'men' || a === 'all' || a === 'women' ? a : 'women';
}

// ---- the public audience filter (chips: הכול · לגברים · לנשים · משפחות/לכולם) ----
export const AUDIENCE_FILTERS = [
  { id: 'any', label: 'הכול' },
  { id: 'men', label: 'לגברים' },
  { id: 'women', label: 'לנשים' },
  { id: 'all', label: 'משפחות/לכולם' },
];
export const normAudienceFilter = (v) => (v === 'men' || v === 'women' || v === 'all' ? v : 'any');
/**
 * Does an item pass the filter? 'any' → everything; 'men' / 'women' → that audience plus items for everyone
 * (a men's-filter never shows a women-only item and vice versa); 'all' → only items for everyone.
 */
export function matchesAudience(item, filter) {
  const f = normAudienceFilter(filter);
  if (f === 'any') return true;
  const a = audienceOf(item);
  return f === 'all' ? a === 'all' : a === f || a === 'all';
}
/** The same as a MongoDB filter on `audience` (legacy documents without the field count as women's). */
export function audienceQuery(filter) {
  const f = normAudienceFilter(filter);
  if (f === 'any') return {};
  if (f === 'men') return { audience: { $in: ['men', 'all'] } };
  if (f === 'all') return { audience: 'all' };
  return { audience: { $nin: ['men'] } }; // women: 'women', 'all', missing, legacy arrays
}

// ---- gendered wording for a person (emails, texts addressed to one user) ----
export const normGender = (v) => (v === 'male' || v === 'female' ? v : null);
/**
 * g(gender, { male, female, neutral }) — the person's own form when known, otherwise the neutral wording
 * (neutral falls back to "male/female" slash form when not given).
 */
export function g(gender, v) {
  const x = normGender(gender);
  if (x === 'male') return v.male ?? v.neutral;
  if (x === 'female') return v.female ?? v.neutral;
  return v.neutral ?? `${v.male}/${v.female}`;
}

/** Free-text audience tags ("למי זה מתאים?") offered per audience. */
export const AUDIENCE_TAGS = {
  women: ['נשים בלבד', 'נשים ובנות', 'נערות', 'בנות', 'אמהות ותינוקות'],
  men: ['גברים בלבד', 'אברכים', 'בחורים', 'בני נוער', 'אבות ובנים'],
  all: ['משפחות', 'ילדים', 'לכל הגילאים'],
};
