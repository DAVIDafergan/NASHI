import express from 'express';
import { HebrewCalendar, Location, HDate, flags } from '@hebcal/core';

/**
 * Shabbat & Yom Tov awareness (Israel).
 * The site "rests" from Jerusalem candle lighting (the earliest in Israel) until Jerusalem havdalah
 * (8.5°) + 15 minutes, so that no part of the country is still in Shabbat when it reopens.
 */
const JERUSALEM = Location.lookup('Jerusalem');
const CITIES = {
  jerusalem: { name: 'ירושלים', loc: JERUSALEM },
  telaviv: { name: 'תל אביב', loc: Location.lookup('Tel Aviv') },
  haifa: { name: 'חיפה', loc: Location.lookup('Haifa') },
  beersheva: { name: 'באר שבע', loc: Location.lookup('Beer Sheva') },
};
const END_BUFFER_MS = 15 * 60 * 1000;

const events = (loc, start, end) => HebrewCalendar.calendar({
  start, end, location: loc, candlelighting: true, il: true, sedrot: true, havdalahDeg: 8.5,
});

let cache = { at: 0, data: null };

function compute(now = new Date()) {
  const start = new Date(now.getTime() - 8 * 864e5);
  const end = new Date(now.getTime() + 12 * 864e5);
  const jer = events(JERUSALEM, start, end);

  const candles = jer.filter(e => e.getFlags() & flags.LIGHT_CANDLES).map(e => e.eventTime).filter(Boolean);
  const havdalot = jer.filter(e => e.getFlags() & flags.LIGHT_CANDLES_TZEIS || /^Havdalah/.test(e.getDesc())).map(e => e.eventTime).filter(Boolean);

  // rest windows: candle lighting → the first havdalah after it (Yom Tov next to Shabbat chains naturally)
  const windows = candles.map(c => {
    const h = havdalot.find(x => x > c);
    return h ? { from: c, to: new Date(h.getTime() + END_BUFFER_MS) } : null;
  }).filter(Boolean);
  const current = windows.find(w => now >= w.from && now < w.to) || null;
  const next = windows.find(w => w.from > now) || null;

  const parashaEv = jer.find(e => (e.getFlags() & flags.PARSHA_HASHAVUA) && e.getDate().greg() >= new Date(now.getTime() - 864e5));
  const today = new HDate(now);
  const holidays = HebrewCalendar.getHolidaysOnDate(today, true) || [];
  const holiday = holidays.find(h => !(h.getFlags() & (flags.MODERN_HOLIDAY | flags.MINOR_FAST | flags.SPECIAL_SHABBAT | flags.ROSH_CHODESH))) || holidays[0] || null;

  const timesFor = (loc) => {
    const ev = events(loc, now, new Date(now.getTime() + 9 * 864e5));
    const c = ev.find(e => e.getFlags() & flags.LIGHT_CANDLES);
    const h = ev.find(e => (e.getFlags() & flags.LIGHT_CANDLES_TZEIS || /^Havdalah/.test(e.getDesc())) && (!c || e.eventTime > c.eventTime));
    return { candles: c?.eventTime || null, havdalah: h?.eventTime || null };
  };

  return {
    now: now.toISOString(),
    hebrewDate: today.renderGematriya(true),
    parasha: parashaEv ? parashaEv.render('he-x-NoNikud') : null,
    holiday: holiday ? holiday.render('he-x-NoNikud') : null,
    rest: current ? { active: true, from: current.from, until: current.to } : { active: false, nextFrom: next?.from || null, nextUntil: next?.to || null },
    times: Object.fromEntries(Object.entries(CITIES).map(([k, v]) => [k, { name: v.name, ...timesFor(v.loc) }])),
  };
}

export function calendarInfo(now = new Date()) {
  if (cache.data && Math.abs(now.getTime() - cache.at) < 60 * 1000) return cache.data;
  cache = { at: now.getTime(), data: compute(now) };
  return cache.data;
}

export const isRestNow = () => {
  try { return !!calendarInfo().rest.active; } catch { return false; }
};

export const calendarRouter = express.Router();
calendarRouter.get('/calendar', (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(calendarInfo());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/** During Shabbat/Yom Tov nothing is written: no posts, statuses, sign-ups or admin changes. */
export function restGuard(req, res, next) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && isRestNow()) {
    return res.status(423).json({ error: 'האתר שומר שבת וחג. נשמח לראות אותך במוצאי שבת 🕯️' });
  }
  next();
}
