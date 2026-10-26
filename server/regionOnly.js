/** One-time backfill: everything a regional manager created is shown only in her region. Safe to run on every start. */
import { User, Event, Class, Community, Lottery } from './models.js';

export async function backfillRegionOnly(log = console.log) {
  try {
    const managers = (await User.find({ role: 'regionAdmin' }).select('_id').lean()).map(u => u._id);
    if (!managers.length) return;
    let n = 0;
    for (const M of [Event, Class, Community, Lottery]) {
      const r = await M.updateMany({ createdBy: { $in: managers }, regionOnly: { $ne: true } }, { $set: { regionOnly: true } });
      n += r.modifiedCount || 0;
    }
    if (n) log(`[regionOnly] marked ${n} items of regional managers`);
  } catch (e) { log(`[regionOnly] ${e.message}`); }
}

/** Everyone collects points now: open the circle to all existing users (idempotent). */
export async function openCircleToAll(log = console.log) {
  try {
    const r = await User.updateMany({ isMemberApproved: { $ne: true } }, { $set: { isMemberApproved: true } });
    if (r.modifiedCount) log(`[circle] ${r.modifiedCount} users can now collect points`);
  } catch (e) { log(`[circle] ${e.message}`); }
}
