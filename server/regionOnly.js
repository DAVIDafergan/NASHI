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
