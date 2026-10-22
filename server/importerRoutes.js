import express from 'express';
import mongoose from 'mongoose';
import { Event, ImportRun, ImportBlock } from './models.js';
import { authenticate, isAdmin } from './auth.js';
import { importerConfig, importerRunning, importerNextAt, runImporterNow } from './importer/index.js';
import { RESEARCHED_SOURCES } from './importer/adapters/index.js';

/** Admin endpoints of the events agent ("סוכן אירועים"). Main admin only. */
const r = express.Router();
const guard = [authenticate, isAdmin];

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
