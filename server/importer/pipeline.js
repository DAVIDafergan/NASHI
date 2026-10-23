import { HDate } from '@hebcal/core';
import { classifyEvent, categoryFor, audienceFor, missingFields } from './classify.js';
import { israelParts, nashiDate } from './time.js';
import { downloadFlyer } from './images.js';
import { placeholderFlyer } from './placeholder.js';
import { kindOf } from './describe.js';
import { hasRealFlyer, audienceMode } from './classify.js';

/**
 * One run of the events agent:
 *   discover candidates per source → prefilter → details → classify → completeness → upsert → hide gone/past.
 * Every step that can fail is isolated: a failing channel or event is logged in the run and the run continues.
 */

const hebrewDay = (d) => { try { return new HDate(d).renderGematriya(true).split(' ').slice(0, -1).join(' '); } catch { return ''; } };
const money = (n) => `₪${Math.round(n)}`;

export const placeholderFor = (n, fields) => placeholderFlyer({
  title: n.title, kind: kindOf(`${n.title}\n${n.rawDescription || n.description || ''}`), city: n.city,
  dateLabel: `${new Date(`${israelParts(n.startAt).date}T12:00:00Z`).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })} · ${fields.time}`,
});

/** normalized event → the fields of NASHI's Event model (pure, unit-tested). */
export function toEventFields(n) {
  const { date, time } = israelParts(n.startAt);
  const text = `${n.title}\n${n.description}`;
  const priceLine = n.isFree ? 'הכניסה חופשית' : n.tickets?.length > 1
    ? `כרטיסים: ${n.tickets.filter(t => t.price > 0).map(t => `${t.title || 'כרטיס'} ${money(t.price)}`).join(' · ')}`
    : `מחיר: ${money(n.priceMin)}`;
  return {
    title: n.title,
    date: nashiDate(n.startAt),
    time,
    startAt: n.startAt,
    endAt: n.endAt && n.endAt > n.startAt ? n.endAt : null,
    hebrewDate: hebrewDay(new Date(`${date}T12:00:00Z`)),
    location: n.location || n.venue,
    city: n.city,
    region: n.region,
    scope: 'local',
    audience: audienceFor(text),
    category: categoryFor(text),
    description: n.description,
    price: n.isFree ? 0 : Math.round(n.priceMin),
    notes: priceLine,
    ticketLink: n.ticketUrl,
    soldOut: !!n.soldOut,
    salesClosed: !!n.closed,
    sourceName: n.sourceName,
    sourceUrl: n.ticketUrl,
    sourceImageUrl: hasRealFlyer(n) ? n.imageUrl : '',
  };
}

// fields compared to decide "updated" vs "unchanged"
const CONTENT = ['title', 'time', 'location', 'city', 'description', 'price', 'notes', 'ticketLink', 'category', 'sourceImageUrl', 'hebrewDate'];
const FACTS = ['soldOut', 'salesClosed', 'price', 'time', 'endAt'];
const same = (a, b) => (a instanceof Date || b instanceof Date) ? +new Date(a || 0) === +new Date(b || 0) : JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Which fields to write on an existing imported event (pure, unit-tested). */
export function planUpdate(existing, fields) {
  const keys = existing.importEdited ? [...FACTS, 'date', 'startAt'] : [...CONTENT, ...FACTS, 'date', 'startAt', 'region', 'audience', 'sourceName', 'sourceUrl'];
  const set = {};
  for (const k of new Set(keys)) if (!same(existing[k], fields[k])) set[k] = fields[k];
  if (existing.hidden && existing.hiddenReason === 'gone') { set.hidden = false; set.hiddenReason = null; }
  return { set, changed: Object.keys(set).length > 0, imageChanged: !existing.importEdited && !same(existing.sourceImageUrl, fields.sourceImageUrl) };
}

export async function runImport({ adapters, http, models, trigger = 'schedule', triggeredBy, now = () => new Date(), maxDetails = Number(process.env.IMPORTER_MAX_DETAILS || 600), allowNoFlyer = process.env.IMPORTER_PLACEHOLDER_FLYER !== '0', audience = audienceMode(), log = console.log }) {
  const { Event, ImportRun, ImportBlock } = models;
  const run = await ImportRun.create({ trigger, triggeredBy, status: 'running', startedAt: now() });
  const counts = { discovered: 0, created: 0, updated: 0, unchanged: 0, skipped: 0, hidden: 0, failed: 0 };
  const skipped = [];
  const errors = [];
  const sources = [];
  const skip = (src, c, reason, title) => {
    counts.skipped++;
    if (skipped.length < 400) skipped.push({ source: src, sourceId: c.sourceId, title: (title || c.listItem?.title || '').slice(0, 140), url: c.url, reason });
  };
  const fail = (msg) => { counts.failed++; if (errors.length < 150) errors.push(String(msg).slice(0, 400)); };
  let detailsBudget = maxDetails;

  try {
    for (const adapter of adapters) {
      const st = { id: adapter.id, name: adapter.name, discovered: 0, created: 0, updated: 0, skipped: 0, failed: 0, error: '' };
      sources.push(st);
      let channelErrors = 0;
      const ctx = {
        // soft channels (optional listing pages) may fail without blocking the "gone from the source" check
        channel: async (name, fn, { soft = false } = {}) => {
          try { await fn(); } catch (e) { if (!soft) channelErrors++; st.failed++; fail(`${adapter.name} · ${name}${soft ? ' (רשות)' : ''}: ${e.message}`); }
        },
      };
      try {
        const startedAt = now();
        const candidates = await adapter.discover(http, ctx);
        st.discovered = candidates.length;
        counts.discovered += candidates.length;
        const blocked = new Set((await ImportBlock.find({ source: adapter.id }).select('sourceId').lean()).map(b => b.sourceId));
        // everything still listed on the source counts as "seen", even if we don't refetch it this time
        await Event.updateMany({ source: adapter.id, sourceId: { $in: candidates.map(c => c.sourceId) } }, { $set: { lastSeenAt: startedAt } });

        // existing first (to refresh sold-out / price), then strong signals, then the rest
        const existingIds = new Set((await Event.find({ source: adapter.id }).select('sourceId').lean()).map(e => e.sourceId));
        candidates.sort((a, b) => (existingIds.has(b.sourceId) - existingIds.has(a.sourceId)) || (b.strong - a.strong) || (b.women - a.women));

        for (const c of candidates) {
          const before = counts.skipped;
          if (blocked.has(c.sourceId)) { skip(adapter.id, c, 'נמחק ע״י מנהלת'); st.skipped++; continue; }
          const pre = adapter.prefilter ? adapter.prefilter(c, now()) : '';
          if (pre && !existingIds.has(c.sourceId)) { skip(adapter.id, c, pre); st.skipped++; continue; }
          // existing events are always refreshed; the budget limits only NEW event pages per run
          if (!existingIds.has(c.sourceId) && detailsBudget-- <= 0) { skip(adapter.id, c, 'הגענו למכסת הבדיקות לריצה'); st.skipped++; continue; }
          let n;
          try { n = await adapter.details(c, http); }
          catch (e) { if (e.skip) skip(adapter.id, c, e.message); else { st.failed++; fail(`${adapter.name} · ${c.url}: ${e.message}`); } if (counts.skipped > before) st.skipped++; continue; }
          n.sourceId = n.sourceId || c.sourceId;

          const verdict = classifyEvent({ mode: audience, title: n.title, description: `${n.rawDescription ?? n.description}\n${n.extraText || ''}`, location: n.location, strong: n.strong || c.strong, categoryText: c.women ? 'אירוע לנשים' : '' });
          const existing = await Event.findOne({ source: adapter.id, sourceId: n.sourceId });
          if (!verdict.ok) {
            skip(adapter.id, c, verdict.reason, n.title); st.skipped++;
            if (existing && !existing.hidden && !existing.importEdited) { await Event.updateOne({ _id: existing._id }, { hidden: true, hiddenReason: 'gone' }); counts.hidden++; }
            continue;
          }
          const missing = missingFields(n, now(), { allowNoFlyer });
          if (missing.length) {
            skip(adapter.id, c, missing.includes('עבר') ? 'האירוע כבר עבר' : `חסר: ${missing.join(', ')}`, n.title); st.skipped++;
            continue;
          }
          const fields = toEventFields(n);

          if (!existing) {
            if (n.soldOut || n.closed) { skip(adapter.id, c, n.soldOut ? 'אזלו הכרטיסים' : 'המכירה סגורה', n.title); st.skipped++; continue; }
            let image;
            let generatedFlyer = false;
            try {
              if (!hasRealFlyer(n)) throw new Error('אין פלייר במקור');
              image = await downloadFlyer(http, n.imageUrl);
            } catch (e) {
              if (!allowNoFlyer) { skip(adapter.id, c, `פלייר: ${e.message}`, n.title); st.skipped++; continue; }
              image = placeholderFor(n, fields); generatedFlyer = true; fields.sourceImageUrl = '';
            }
            try {
              await Event.create({ ...fields, image, generatedFlyer, source: adapter.id, sourceId: n.sourceId, importedAt: now(), lastSeenAt: now(), hidden: false });
              counts.created++; st.created++;
            } catch (e) {
              if (e?.code === 11000) { counts.unchanged++; } else { st.failed++; fail(`שמירה: ${n.title}: ${e.message}`); }
            }
            continue;
          }

          const plan = planUpdate(existing.toObject(), fields);
          const set = { ...plan.set, lastSeenAt: now() };
          if (plan.imageChanged) {
            if (hasRealFlyer(n)) {
              try { set.image = await downloadFlyer(http, n.imageUrl); set.generatedFlyer = false; }
              catch (e) { delete set.sourceImageUrl; fail(`פלייר (עדכון) ${n.title}: ${e.message}`); }
            } else delete set.sourceImageUrl; // flyer gone on the source: keep what we have
          }
          await Event.updateOne({ _id: existing._id }, { $set: set });
          if (plan.changed) { counts.updated++; st.updated++; } else counts.unchanged++;
        }

        // listed nowhere anymore → hide (only when discovery fully worked, so a network hiccup never hides events)
        if (channelErrors === 0) {
          // (an event that already happened keeps its 48h 'עבר' window even if the source dropped it)
          const r = await Event.updateMany({ source: adapter.id, hidden: { $ne: true }, startAt: { $gt: startedAt }, $or: [{ lastSeenAt: { $lt: startedAt } }, { lastSeenAt: { $exists: false } }] }, { $set: { hidden: true, hiddenReason: 'gone' } });
          counts.hidden += r.modifiedCount || 0;
        }
      } catch (e) {
        st.error = e.message; st.failed++;
        fail(`${adapter.name}: ${e.message}`);
      }
    }
    // past events: shown with 'עבר' for 48h, then removed by the cleanup job (server/eventCleanup.js)

    Object.assign(run, { status: 'done', finishedAt: now(), counts, sources, skipped, errorMessages: errors });
    await run.save();
    log(`[importer] done: ${JSON.stringify(counts)}`);
  } catch (e) {
    fail(e.message);
    Object.assign(run, { status: 'failed', finishedAt: now(), counts, sources, skipped, errorMessages: errors });
    await run.save().catch(() => {});
    log(`[importer] failed: ${e.message}`);
  }
  return run;
}
