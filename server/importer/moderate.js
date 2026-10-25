/** Owner moderation of imported events: generated flyer instead of the source image, removal for good, image re-check. */
import { placeholderFor } from './pipeline.js';
import { checkFlyer, modestyEnabled } from './modesty.js';

const asN = (e) => ({ title: e.title, description: e.description || '', rawDescription: e.description || '', city: e.city, startAt: e.startAt || e.date });

export async function usePlaceholder(Event, e, why = '') {
  const image = placeholderFor(asN(e), { time: e.time || '' });
  await Event.updateOne({ _id: e._id }, { $set: { image, generatedFlyer: true, sourceImageUrl: '', importEdited: true, flyerNote: why } });
}

export async function moderate({ Event, ImportBlock, placeholder = [], remove = [], recheckImages = false, log = console.log }) {
  const out = { placeholder: 0, removed: 0, checked: 0, replaced: [], errors: [] };
  for (const id of placeholder) {
    const e = await Event.findById(id).lean(); if (!e) continue;
    await usePlaceholder(Event, e, 'owner'); out.placeholder++;
  }
  for (const id of remove) {
    const e = await Event.findById(id).lean(); if (!e) continue;
    if (typeof e.source === 'string') await ImportBlock.updateOne({ source: e.source, sourceId: e.sourceId }, { $set: { final: true, title: e.title, reason: 'הוסר ע״י הנהלת האתר' } }, { upsert: true });
    await Event.deleteOne({ _id: e._id }); out.removed++;
  }
  if (recheckImages && modestyEnabled()) {
    const list = await Event.find({ source: { $type: 'string' }, generatedFlyer: { $ne: true }, image: /^data:image\/(jpe?g|png|webp|gif)/ }).select('_id title description city startAt date time image').lean();
    for (const e of list) {
      out.checked++;
      let ok = false, why = '';
      try { const v = await checkFlyer(e.image); ok = v.modest; why = v.reason; } catch (err) { why = `בדיקה נכשלה: ${err.message}`; if (out.errors.length < 5) out.errors.push(why); }
      if (!ok) { await usePlaceholder(Event, e, why); out.replaced.push(`${e.title} — ${why}`); log(`[modesty] replaced: ${e.title} (${why})`); }
    }
  }
  return out;
}
