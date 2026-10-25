import { HDate } from '@hebcal/core';
import { classifyEvent, categoryFor, audienceFor, missingFields } from './classify.js';
import { israelParts, nashiDate } from './time.js';
import { downloadFlyer } from './images.js';
import { placeholderFlyer } from './placeholder.js';
import { kindOf } from './describe.js';
import { reclassifyImported } from './reclassify.js';
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
    : Number.isFinite(n.priceMin) && n.priceMin > 0 ? `מחיר: ${money(n.priceMin)}` : 'מחיר: בקישור לרכישה';
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
    // unknown price → null (the site shows "בקישור"), never 0 (= free)
    price: n.isFree ? 0 : Number.isFinite(n.priceMin) && n.priceMin > 0 ? Math.round(n.priceMin) : null,
    notes: priceLine,
    ticketLink: n.ticketUrl,
    soldOut: !!n.soldOut,
    salesClosed: !!n.closed,
    sourceName: n.sourceName,
    sourceUrl: n.ticketUrl,
    sourceImageUrl: hasRealFlyer(n) ? n.imageUrl : '',
    sourceCategory: n.category || '',
    harediSource: !!n.strong,
  };
}

// fields compared to decide "updated" vs "unchanged"
const CONTENT = ['title', 'time', 'location', 'city', 'description', 'price', 'notes', 'ticketLink', 'category', 'sourceImageUrl', 'hebrewDate'];
const FACTS = ['soldOut', 'salesClosed', 'price', 'time', 'endAt', 'sourceCategory', 'harediSource'];
const same = (a, b) => (a instanceof Date || b instanceof Date) ? +new Date(a || 0) === +new Date(b || 0) : JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Which fields to write on an existing imported event (pure, unit-tested). */
export function planUpdate(existing, fields) {
  const keys = existing.importEdited ? [...FACTS, 'date', 'startAt'] : [...CONTENT, ...FACTS, 'date', 'startAt', 'region', 'audience', 'sourceName', 'sourceUrl'];
  const set = {};
  for (const k of new Set(keys)) if (!same(existing[k], fields[k])) set[k] = fields[k];
  if (existing.hidden && existing.hiddenReason === 'gone') { set.hidden = false; set.hiddenReason = null; }
  return { set, changed: Object.keys(set).length > 0, imageChanged: !existing.importEdited && !same(existing.sourceImageUrl, fields.sourceImageUrl) };
}

export async function runImport({ adapters, http, models, trigger = 'schedule', triggeredBy, now = () => new Date(), maxDetails = Number(process.env.IMPORTER_MAX_DETAILS || 600), allowNoFlyer = process.env.IMPORTER_PLACEHOLDER_FLYER !== '0', audience = audienceMode(), log = console.log, markGone = true }) {
  const { Event, ImportRun, ImportBlock } = models;
  const run = await ImportRun.create({ trigger, triggeredBy, status: 'running', startedAt: now() });
  const counts = { discovered: 0, created: 0, updated: 0, unchanged: 0, skipped: 0, hidden: 0, failed: 0 };
  const skipped = [];
  const errors = [];
  const sources = [];
  const reasons = {};          // skip reason → count (logged after the run)
  const strongSkipped = [];    // skipped items from strong (Haredi) sources, logged so a bad rule shows up at once
  let unblocked = 0;
  const skip = (src, c, reason, title) => {
    counts.skipped++;
    const key = String(reason).replace(/"[^"]*"/g, '"…"').replace(/https?:\/\/\S+/g, '<url>').slice(0, 80);
    reasons[key] = (reasons[key] || 0) + 1;
    if (c?.strong && strongSkipped.length < 30) strongSkipped.push(`${c.sourceId} ${(title || c.listItem?.title || '').slice(0, 60)} → ${reason}`);
    if (skipped.length < 400 || (c?.strong && skipped.length < 600)) skipped.push({ source: src, sourceId: c.sourceId, title: (title || c.listItem?.title || '').slice(0, 140), url: c.url, reason });
  };
  const fail = (msg) => { counts.failed++; if (errors.length < 150) errors.push(String(msg).slice(0, 400)); };
  let detailsBudget = maxDetails;

  try {
    for (const adapter of adapters) {
      detailsBudget = maxDetails; // per source, so one big source can't starve the others
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
        // blocks: a manager's delete is final; automatic ones (rule re-check, duplicate, past) are re-checked with the
        // CURRENT rules — so an event purged under older rules comes back once it passes
        const blocks = await ImportBlock.find({ source: adapter.id }).select('sourceId blockedBy reason').lean();
        const blocked = new Set(blocks.filter(b => b.blockedBy).map(b => b.sourceId));
        const autoBlocked = new Set(blocks.filter(b => !b.blockedBy).map(b => b.sourceId));
        // everything still listed on the source counts as "seen", even if we don't refetch it this time
        await Event.updateMany({ source: adapter.id, sourceId: { $in: candidates.map(c => c.sourceId) } }, { $set: { lastSeenAt: startedAt } });

        // existing first (to refresh sold-out / price), then strong signals, then the rest
        const existingIds = new Set((await Event.find({ source: adapter.id }).select('sourceId').lean()).map(e => e.sourceId));
        candidates.sort((a, b) => (existingIds.has(b.sourceId) - existingIds.has(a.sourceId)) || (b.strong - a.strong) || (b.women - a.women));

        for (const c of candidates) {
          const before = counts.skipped;
          if (blocked.has(c.sourceId)) { skip(adapter.id, c, 'נמחק ע״י מנהלת'); st.skipped++; continue; }
          const pre = adapter.prefilter ? adapter.prefilter(c, now(), audience) : '';
          if (pre && !existingIds.has(c.sourceId)) { skip(adapter.id, c, pre); st.skipped++; continue; }
          // existing events are always refreshed; the budget limits only NEW event pages per run
          if (!existingIds.has(c.sourceId) && detailsBudget-- <= 0) { skip(adapter.id, c, 'הגענו למכסת הבדיקות לריצה'); st.skipped++; continue; }
          let got;
          try { got = await adapter.details(c, http); }
          catch (e) { if (e.skip) skip(adapter.id, c, e.message); else { st.failed++; fail(`${adapter.name} · ${c.url}: ${e.message}`); } if (counts.skipped > before) st.skipped++; continue; }
          // an event with several dates comes back as one normalized event per date
          for (const n of Array.isArray(got) ? got : [got]) {
            n.sourceId = n.sourceId || c.sourceId;
            if (n.sourceId !== c.sourceId && blocked.has(n.sourceId)) { skip(adapter.id, c, 'נמחק ע״י מנהלת', n.title); st.skipped++; continue; }

            const verdict = classifyEvent({ mode: audience, title: n.title, description: `${n.rawDescription ?? n.description}\n${n.extraText || ''}`, location: n.location, city: n.city, category: n.category || '', organizer: n.sourceName || '', strong: n.strong || c.strong, womenSection: !!(n.womenSection || c.womenSection), categoryText: c.women ? 'אירוע לנשים' : '' });
            const existing = await Event.findOne({ source: adapter.id, sourceId: n.sourceId });
            if (!verdict.ok) {
              skip(adapter.id, c, verdict.reason, n.title); st.skipped++;
              // no longer passes the rules → removed for good (and never re-imported)
              if (existing) { await ImportBlock.updateOne({ source: adapter.id, sourceId: n.sourceId }, { $setOnInsert: { title: n.title, reason: verdict.reason } }, { upsert: true }); await Event.deleteOne({ _id: existing._id }); counts.hidden++; }
              continue;
            }
            const missing = missingFields(n, now(), { allowNoFlyer });
            if (missing.length) {
              skip(adapter.id, c, missing.includes('עבר') ? 'האירוע כבר עבר' : `חסר: ${missing.join(', ')}`, n.title); st.skipped++;
              continue;
            }
            const fields = toEventFields(n);
            if (autoBlocked.has(n.sourceId)) { await ImportBlock.deleteOne({ source: adapter.id, sourceId: n.sourceId, blockedBy: null }); autoBlocked.delete(n.sourceId); unblocked++; }

            if (!existing) {
              // the same event listed by two sources / two venue sites (e.g. netivot + netivim): keep one
              const dup = await Event.findOne({ source: { $type: 'string' }, title: fields.title, startAt: fields.startAt, city: fields.city }).select('_id').lean();
              if (dup) { skip(adapter.id, c, 'כפילות של אירוע שכבר יובא', n.title); st.skipped++; continue; }
              // sold out is still imported (shown as "אזלו הכרטיסים"); a closed / suspended sale is not
              if (n.closed && !n.soldOut) { skip(adapter.id, c, 'המכירה סגורה', n.title); st.skipped++; continue; }
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
        }

        // listed nowhere anymore → hide (only when discovery fully worked, so a network hiccup never hides events)
        if (markGone && channelErrors === 0) {
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
    // everything imported earlier is re-checked against the current rules
    try { const rc = await reclassifyImported({ Event, ImportBlock, mode: audience, log }); counts.hidden += rc.removed.length + rc.duplicates; } catch (e) { fail(`בדיקה מחדש: ${e.message}`); }

    const top = Object.fromEntries(Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 25));
    log(`[importer] skip reasons: ${JSON.stringify(top)}`);
    if (strongSkipped.length) log(`[importer] skipped from strong sources (${strongSkipped.length}):\n  ${strongSkipped.join('\n  ')}`);
    if (unblocked) log(`[importer] ${unblocked} events blocked by an earlier automatic check pass the current rules and were re-imported`);
    if (errors.length) log(`[importer] errors (${errors.length}):\n  ${errors.slice(0, 25).join('\n  ')}`);
    log(`[importer] per source: ${JSON.stringify((sources || []).map(x => ({ id: x.id, d: x.discovered, c: x.created, s: x.skipped, f: x.failed, e: (x.error || '').slice(0, 120) })))}`);
    run.skipReasons = top;
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
