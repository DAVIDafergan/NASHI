import express from 'express';
import mongoose from 'mongoose';
import { Event, ImportRun, ImportBlock, User } from './models.js';
import { authenticate, isAdmin } from './auth.js';
import { importerConfig, importerRunning, importerNextAt, runImporterNow } from './importer/index.js';
import { reclassifyImported } from './importer/reclassify.js';
import { runPushImport, runStructuredPush } from './importer/push.js';
import crypto from 'node:crypto';
import { moderate } from './importer/moderate.js';
import { checkFlyer, modestyEnabled } from './importer/modesty.js';
import { RESEARCHED_SOURCES } from './importer/adapters/index.js';
import { REGIONS } from '../shared/regions.js';

/** Admin endpoints of the events agent ("סוכן אירועים"). Main admin only. */
const r = express.Router();
const guard = [authenticate, isAdmin];

const pushOk = (req) => { const token = process.env.IMPORTER_PUSH_TOKEN || ''; const got = String(req.get('x-import-token') || ''); return !!token && got.length === token.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(token)); };

// owner moderation (same secret): { placeholder: [eventId], remove: [eventId], recheckImages: true }
r.post('/importer/moderate', async (req, res) => {
  if (!pushOk(req)) return res.status(403).json({ error: 'forbidden' });
  try {
    const { placeholder = [], remove = [], recheckImages = false, probe, removeAllImported, listAdmins, makeAdmin, findUsers } = req.body || {};
    // site owner: who are the main admins (name + email only), and grant main-admin to a registered email
    if (findUsers) { const esc = String(findUsers).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return res.json({ users: await User.find({ email: new RegExp('^' + esc + '$', 'i') }).select('name email isAdmin role createdAt').lean() }); }
    if (listAdmins) return res.json({ admins: await User.find({ isAdmin: true }).select('name email -_id').lean() });
    if (makeAdmin) {
      const u = await User.findOneAndUpdate({ email: String(makeAdmin).trim().toLowerCase() }, { isAdmin: true }, { new: true }).select('name email isAdmin -_id').lean();
      return u ? res.json({ ok: true, user: u }) : res.status(404).json({ error: 'אין משתמש רשום עם המייל הזה' });
    }
    if (removeAllImported === 'yes') {
      const r = await Event.deleteMany({ source: { $type: 'string' } });
      return res.json({ removedAllImported: r.deletedCount });
    }
    if (probe) { const v = await checkFlyer(probe); return res.json({ enabled: modestyEnabled(), ...v }); }
    res.json({ enabled: modestyEnabled(), ...(await moderate({ Event, ImportBlock, placeholder, remove, recheckImages })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// pages opened in a normal browser, pushed with the IMPORTER_PUSH_TOKEN secret (no token set → route off)
r.post('/importer/push', async (req, res) => {
  const token = process.env.IMPORTER_PUSH_TOKEN || '';
  const got = String(req.get('x-import-token') || '');
  if (!token || got.length !== token.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(token))) return res.status(403).json({ error: 'forbidden' });
  try {
    const { pages, sites, site, events } = req.body || {};
    const logs = [];
    const run = events ? await runStructuredPush({ site, events, pages,
      models: { Event, ImportRun, ImportBlock }, log: (m) => { logs.push(String(m)); console.log(m); } })
      : await runPushImport({ pages, sites, models: { Event, ImportRun, ImportBlock }, log: (m) => { logs.push(String(m)); console.log(m); } });
    res.json({ ok: true, counts: run?.counts, logs: logs.slice(-12) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

r.get('/admin/importer/status', ...guard, async (req, res) => {
  try {
    const runs = await ImportRun.find().sort({ startedAt: -1 }).limit(12).lean();
    const [visible, hidden, blocked] = await Promise.all([
      Event.countDocuments({ source: { $type: 'string' }, hidden: { $ne: true } }),
      Event.countDocuments({ source: { $type: 'string' }, hidden: true }),
      ImportBlock.countDocuments(),
    ]);
    res.json({ ...importerConfig(), running: importerRunning(), nextAt: importerNextAt(), runs, totals: { visible, hidden, blocked }, sources: RESEARCHED_SOURCES });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// כיסוי לפי אזור: upcoming visible events per region, manual vs imported (target: IMPORTER_TARGET_PER_REGION, default 20)
r.get('/admin/importer/coverage', ...guard, async (req, res) => {
  try {
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const rows = await Event.aggregate([
      { $match: { hidden: { $ne: true }, date: { $gte: today } } },
      { $group: { _id: { scope: { $ifNull: ['$scope', 'local'] }, region: { $ifNull: ['$region', 'north'] }, imported: { $cond: [{ $eq: [{ $type: '$source' }, 'string'] }, true, false] } }, n: { $sum: 1 } } },
    ]);
    const regions = REGIONS.map(rg => ({ id: rg.id, name: rg.name, manual: 0, imported: 0 }));
    const everywhere = { national: 0, online: 0 };
    for (const x of rows) {
      if (x._id.scope === 'national' || x._id.scope === 'online') { everywhere[x._id.scope] += x.n; continue; }
      const rg = regions.find(y => y.id === x._id.region);
      if (rg) rg[x._id.imported ? 'imported' : 'manual'] += x.n;
    }
    res.json({ target: Number(process.env.IMPORTER_TARGET_PER_REGION || 20), regions, everywhere });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// re-check all imported events now (deletes + blocks what fails the current rules)
r.post('/admin/importer/reclassify', ...guard, async (req, res) => {
  try { res.json(await reclassifyImported({ Event, ImportBlock })); } catch (err) { res.status(500).json({ error: err.message }); }
});

r.post('/admin/importer/run', ...guard, (req, res) => {
  const r2 = runImporterNow({ trigger: 'manual', triggeredBy: req.user.id });
  if (!r2.started) return res.status(409).json({ error: r2.reason });
  res.status(202).json({ started: true });
});

r.get('/admin/importer/events', ...guard, async (req, res) => {
  try {
    const status = req.query.status;
    const q = { source: { $type: 'string' } };
    if (status === 'visible') q.hidden = { $ne: true };
    if (status === 'hidden') q.hidden = true;
    const list = await Event.find(q).select('-attendees').sort({ startAt: 1, date: 1 }).limit(400).lean();
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const imported = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) { res.status(404).json({ error: 'not found' }); return null; }
  const ev = await Event.findById(req.params.id);
  if (!ev || !ev.source) { res.status(404).json({ error: 'לא אירוע מיובא' }); return null; }
  return ev;
};

r.post('/admin/importer/events/:id/:action(hide|unhide)', ...guard, async (req, res) => {
  try {
    const ev = await imported(req, res); if (!ev) return;
    if (req.params.action === 'hide') { ev.hidden = true; ev.hiddenReason = 'admin'; }
    else { ev.hidden = false; ev.hiddenReason = undefined; }
    await ev.save();
    res.json({ success: true, hidden: ev.hidden });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// delete = remove from the site AND remember it, so the agent doesn't import it again
r.delete('/admin/importer/events/:id', ...guard, async (req, res) => {
  try {
    const ev = await imported(req, res); if (!ev) return;
    await ImportBlock.updateOne({ source: ev.source, sourceId: ev.sourceId }, { $setOnInsert: { title: ev.title, blockedBy: req.user.id } }, { upsert: true });
    await ev.deleteOne();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default r;
