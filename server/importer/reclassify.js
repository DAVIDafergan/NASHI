import { classifyEvent, audienceMode } from './classify.js';

/**
 * Re-check every imported event against the CURRENT rules (IMPORTER_AUDIENCE, default strict Haredi) and remove
 * what fails — run on startup, after every import run, and from the admin ("בדיקה מחדש").
 *   fail → deleted. Blocked (never re-imported) when the verdict is a hard reject or we have the source's full
 *   data; older SmarTicket events saved before the category was stored are deleted WITHOUT a block, so the next run
 *   can re-check them with their category (a Haredi "חרדיוות" event comes back, a secular one is rejected again).
 * Duplicates (same title + start + city from two sources / venue sites) → the oldest stays, the rest are removed.
 * Passing events get the audience of the current verdict ('women' | 'men' | 'all'), unless a manager edited them.
 * Manual events are never touched.
 */
const normTitle = (t = '') => String(t).replace(/[\s"'״׳\-–—:.,!()]/g, '');

export async function reclassifyImported({ Event, ImportBlock, mode = audienceMode(), log = () => {} }) {
  const list = await Event.find({ source: { $type: 'string' } }).select('title description location city source sourceId sourceName sourceCategory harediSource startAt importedAt audience importEdited').lean();
  const removed = [];
  const block = (e, reason) => ImportBlock.updateOne({ source: e.source, sourceId: e.sourceId }, { $setOnInsert: { title: e.title, reason } }, { upsert: true });
  for (const e of list) {
    const v = classifyEvent({
      mode, title: e.title, description: e.description, location: e.location, city: e.city,
      category: e.sourceCategory || '', organizer: e.sourceName || '',
      strong: !!e.harediSource || e.sourceName === 'גלאטיקט',
    });
    if (v.ok) {
      const a = v.audience || 'women';
      if (!e.importEdited && e.audience !== a) await Event.updateOne({ _id: e._id }, { $set: { audience: a } });
      continue;
    }
    const incomplete = e.source === 'smarticket' && e.sourceCategory === undefined && !v.hard;
    if (!incomplete) await block(e, v.reason);
    await Event.deleteOne({ _id: e._id });
    removed.push({ title: e.title, city: e.city, reason: v.reason, blocked: !incomplete });
  }
  // duplicates
  const kept = await Event.find({ source: { $type: 'string' } }).select('title city startAt importedAt source sourceId').sort({ importedAt: 1, _id: 1 }).lean();
  const seen = new Set();
  let dups = 0;
  for (const e of kept) {
    const k = `${normTitle(e.title)}|${e.startAt ? new Date(e.startAt).getTime() : ''}|${e.city || ''}`;
    if (!seen.has(k)) { seen.add(k); continue; }
    await block(e, 'כפילות');
    await Event.deleteOne({ _id: e._id });
    dups++;
  }
  if (removed.length || dups) log(`[importer] re-check (${mode}): removed ${removed.length} events, ${dups} duplicates`);
  return { checked: list.length, removed, duplicates: dups };
}
