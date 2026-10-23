import mongoose from 'mongoose';
import { Event, ImportBlock } from './models.js';
import { isEventExpired, PAST_GRACE_MS } from '../shared/eventTime.js';

/**
 * "אירועים שעברו יופיע עליהם 'עבר' ל-48 שעות ואז ייעלמו לתמיד"
 * Hourly: every event whose end (endAt / start + 3h / end of its day, or its last session) is more than 48 hours ago
 *   - imported  → deleted, and its (source, sourceId) blocked so the agent never brings it back
 *   - manual    → archived (archived: true). Not hard-deleted: barcode tickets (Ticket.eventId) and members'
 *                 likes/attendance point at it. Archived events are excluded from every public API and from the
 *                 admin lists by default (the admin can open "ארכיון").
 * The write is invisible to visitors (nothing new appears), so it runs on Shabbat too — the site's Shabbat guard
 * (server/calendar.js restGuard) only blocks write REQUESTS, not background jobs.
 */
export async function cleanupPastEvents(now = new Date()) {
  const t = now.getTime();
  // cheap DB pre-filter: the calendar day is at least 2 days ago, and no later end date is stored
  const candidates = await Event.find({
    archived: { $ne: true },
    date: { $lt: new Date(t - PAST_GRACE_MS) },
    $or: [{ endAt: null }, { endAt: { $exists: false } }, { endAt: { $lt: new Date(t - PAST_GRACE_MS) } }],
  }).select('source sourceId title date time startAt endAt sessions').lean();
  const expired = candidates.filter(e => isEventExpired(e, t));
  let deleted = 0, archived = 0;
  for (const e of expired) {
    if (e.source && e.sourceId) {
      await ImportBlock.updateOne({ source: e.source, sourceId: e.sourceId }, { $setOnInsert: { title: e.title } }, { upsert: true });
      await Event.deleteOne({ _id: e._id });
      deleted++;
    } else {
      await Event.updateOne({ _id: e._id }, { $set: { archived: true, archivedAt: now } });
      archived++;
    }
  }
  return { checked: candidates.length, deleted, archived };
}

export function startEventCleanup() {
  if (process.env.EVENT_CLEANUP === '0') return;
  const tick = () => {
    if (mongoose.connection.readyState !== 1) return;
    cleanupPastEvents().then(r => { if (r.deleted || r.archived) console.log(`[events] past cleanup: ${r.deleted} imported deleted, ${r.archived} archived`); })
      .catch(e => console.warn('[events] cleanup failed', e.message));
  };
  setTimeout(tick, 90 * 1000).unref?.();
  setInterval(tick, 3600 * 1000).unref?.();
}
