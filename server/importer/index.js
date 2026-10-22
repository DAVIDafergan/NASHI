import mongoose from 'mongoose';
import { Event, ImportRun, ImportBlock } from '../models.js';
import { isRestNow } from '../calendar.js';
import { createHttp } from './http.js';
import { activeAdapters } from './adapters/index.js';
import { runImport } from './pipeline.js';

/**
 * The events agent ("סוכן אירועים") inside the Express app.
 *   IMPORTER_ENABLED=1            turn the schedule on (off by default; "run now" in the admin works either way)
 *   IMPORTER_INTERVAL_HOURS=6     how often
 *   IMPORTER_SOURCES=tickchak     limit sources (comma separated)
 *   IMPORTER_MAX_DETAILS=300      max event pages fetched per run
 * Never runs during Shabbat / Yom Tov (the site rests; nothing is written).
 */

export const importerConfig = () => ({
  enabled: process.env.IMPORTER_ENABLED === '1',
  intervalHours: Math.max(1, Number(process.env.IMPORTER_INTERVAL_HOURS || 6)),
});

let current = null; // the running promise
let timer = null;
let nextAt = null;

export const importerRunning = () => !!current;
export const importerNextAt = () => nextAt;

export function runImporterNow({ trigger = 'manual', triggeredBy, adapters, http } = {}) {
  if (current) return { started: false, reason: 'כבר רץ' };
  if (mongoose.connection.readyState !== 1) return { started: false, reason: 'אין חיבור למסד הנתונים' };
  current = runImport({
    adapters: adapters || activeAdapters(),
    http: http || createHttp({ log: () => {} }),
    models: { Event, ImportRun, ImportBlock },
    trigger, triggeredBy,
  }).catch(e => console.error('[importer]', e)).finally(() => { current = null; });
  return { started: true, promise: current };
}

export async function startImporter() {
  // a run that was cut by a restart is not "running" anymore
  try { await ImportRun.updateMany({ status: 'running' }, { $set: { status: 'failed', finishedAt: new Date() }, $push: { errors: 'הריצה נקטעה (השרת הופעל מחדש)' } }); } catch { /* db not ready yet */ }
  const { enabled, intervalHours } = importerConfig();
  if (!enabled) { console.log('ℹ️  events importer schedule is off (IMPORTER_ENABLED != 1)'); return; }
  const every = intervalHours * 3600 * 1000;
  const tick = () => {
    nextAt = new Date(Date.now() + every);
    if (isRestNow()) { console.log('[importer] Shabbat/Yom Tov — skipping this run'); return; }
    runImporterNow({ trigger: 'schedule' });
  };
  nextAt = new Date(Date.now() + 2 * 60 * 1000);
  setTimeout(() => { tick(); timer = setInterval(tick, every); timer.unref?.(); }, 2 * 60 * 1000).unref?.();
  console.log(`🤖 events importer: every ${intervalHours}h`);
}
