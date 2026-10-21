import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, X } from 'lucide-react';
import CityPicker from './CityPicker';
import { useMyPlace, setGuestCity } from '../hooks/useMyPlace';
import { regionName } from '../shared/regions';

type Props = { user: any; onUpdateUser?: (u: any) => void };

/** Header chip "📍 city" — changes the area the site shows first. */
export const PlaceChip: React.FC<Props & { className?: string }> = ({ user, onUpdateUser, className = '' }) => {
  const { city, region } = useMyPlace(user);
  const [open, setOpen] = useState(false);
  const pick = (c: string) => {
    if (user && onUpdateUser) onUpdateUser({ ...user, city: c });
    setGuestCity(c);
    setOpen(false);
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`flex h-10 items-center gap-1.5 rounded-full border border-rose-100 bg-white/70 px-3 text-[13px] text-slate-600 transition hover:border-rose-300 hover:text-rose-700 ${className}`} title={region ? regionName(region) : 'בחירת אזור'}>
        <MapPin size={15} className="text-rose-400" />
        <span className="max-w-[7.5rem] truncate">{city || 'כל הארץ'}</span>
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-ink/40 backdrop-blur-sm md:items-center md:p-6" dir="rtl" onClick={() => setOpen(false)}>
          <div className="w-full rounded-t-[2rem] bg-[#FBF7F4] p-6 shadow-2xl md:max-w-md md:rounded-[2rem] animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl">איפה את גרה?</h3>
              <button onClick={() => setOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-rose-50"><X size={20} /></button>
            </div>
            <p className="mt-2 text-sm text-slate-500">נציג לך קודם אירועים, חוגים וגמ"חים באזור שלך. התוכן הארצי והמקוון יוצג תמיד.</p>
            <CityPicker className="mt-4" value={city} onChange={pick} inline placeholder="חיפוש עיר או יישוב…" />
            {city && !user && <button onClick={() => pick('')} className="mt-3 w-full text-center text-sm text-slate-500 hover:text-rose-700">הצגת כל הארץ</button>}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

/** One-time question for members who registered before cities existed. */
export const CityPrompt: React.FC<Props> = ({ user, onUpdateUser }) => {
  const [show, setShow] = useState(false);
  const [city, setCity] = useState('');
  useEffect(() => {
    if (!user || user.city) { setShow(false); return; }
    let skipped = false;
    try { skipped = sessionStorage.getItem('nashi-city-skip') === '1'; } catch { /* ignore */ }
    if (!skipped) { const t = window.setTimeout(() => setShow(true), 9000); return () => window.clearTimeout(t); }
  }, [user]);
  if (!show || !user) return null;
  const skip = () => { try { sessionStorage.setItem('nashi-city-skip', '1'); } catch { /* ignore */ } setShow(false); };
  const save = () => { if (!city) return; onUpdateUser?.({ ...user, city }); setGuestCity(city); setShow(false); };
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-ink/40 backdrop-blur-sm md:items-center md:p-6" dir="rtl">
      <div className="w-full rounded-t-[2rem] bg-[#FBF7F4] p-6 shadow-2xl md:max-w-md md:rounded-[2rem] animate-fade-in-up">
        <p className="eyebrow">נשי מתרחבת לכל הארץ 💗</p>
        <h3 className="mt-2 text-[1.8rem] leading-tight">היי {String(user.name || '').split(' ')[0]}, באיזו עיר את גרה?</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">ככה נציג לך קודם את מה שקורה קרוב אלייך.</p>
        <CityPicker className="mt-4" value={city} onChange={setCity} inline placeholder="חיפוש עיר או יישוב…" />
        <button onClick={save} disabled={!city} className="btn-primary mt-4 w-full disabled:opacity-50">שמירה</button>
        <button onClick={skip} className="mt-2 w-full py-2 text-sm text-slate-400 hover:text-slate-600">אחר כך</button>
      </div>
    </div>,
    document.body
  );
};

/**
 * Automatic location: on a first visit with no city chosen, ask the browser once for the position and
 * set the nearest city (members without a city get it saved to their profile). A short note says what
 * was detected and how to change it. If the visitor declines, we never ask again.
 */
export const AutoLocate: React.FC<Props> = ({ user, onUpdateUser }) => {
  const { city } = useMyPlace(user);
  const [note, setNote] = useState('');
  useEffect(() => {
    if (city) return;
    let asked = false;
    try { asked = localStorage.getItem('nashi-geo-asked') === '1'; } catch { /* ignore */ }
    if (asked) return;
    const t = window.setTimeout(async () => {
      try { localStorage.setItem('nashi-geo-asked', '1'); } catch { /* ignore */ }
      const { locateCity } = await import('../utils/locate');
      const r = await locateCity();
      if (!r) return;
      setGuestCity(r.city);
      if (user && !user.city && onUpdateUser) onUpdateUser({ ...user, city: r.city });
      setNote(r.city);
      window.setTimeout(() => setNote(''), 6000);
    }, 3500);
    return () => window.clearTimeout(t);
  }, [city, user]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!note) return null;
  return createPortal(
    <div className="fixed inset-x-3 top-24 z-[250] mx-auto flex max-w-sm items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-lift animate-fade-in-up" dir="rtl" role="status">
      <MapPin size={16} className="shrink-0 text-rose-300" />
      <span className="flex-1">זיהינו שאת ב<b>{note}</b>. מעכשיו נציג לך קודם את מה שקרוב אלייך. <span className="text-white/60">(אפשר לשנות בכל רגע)</span></span>
      <button onClick={() => setNote('')} aria-label="סגירה" className="text-white/60 hover:text-white"><X size={15} /></button>
    </div>,
    document.body
  );
};
