import React, { useMemo, useRef, useState, useEffect } from 'react';
import { MapPin, Search, ChevronDown, Check, LocateFixed, Loader2 } from 'lucide-react';
import { locateCity } from '../utils/locate';
import { REGIONS, CITIES } from '../shared/regions';

/** Searchable city select, grouped by region. */
const CityPicker: React.FC<{ value: string; onChange: (city: string) => void; placeholder?: string; required?: boolean; className?: string; compact?: boolean; locate?: boolean }> = ({ value, onChange, placeholder = 'באיזו עיר את גרה?', required, className = '', compact, locate = true }) => {
  const [open, setOpen] = useState(false);
  const [finding, setFinding] = useState(false);
  const [geoMsg, setGeoMsg] = useState('');
  const detect = async () => {
    setFinding(true); setGeoMsg('');
    const r = await locateCity();
    setFinding(false);
    if (r) onChange(r.city); else setGeoMsg('לא הצלחנו לזהות. אפשר לבחור מהרשימה.');
  };
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const groups = useMemo(() => REGIONS.map(r => ({ ...r, cities: CITIES[r.id].filter(c => !q || c.includes(q.trim())) })).filter(g => g.cities.length), [q]);
  return (
    <div ref={box} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-2xl border border-rose-100 bg-white text-right outline-none transition focus:ring-4 focus:ring-rose-100 ${compact ? 'px-3 py-2 text-sm' : 'px-4 py-3.5 text-[16px]'}`}>
        <MapPin size={compact ? 15 : 17} className="shrink-0 text-rose-400" />
        <span className={`flex-1 truncate ${value ? 'text-ink' : 'text-slate-400'}`}>{value || placeholder}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {locate && !compact && (
        <button type="button" onClick={detect} disabled={finding} className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-rose-700 hover:underline disabled:opacity-60">
          {finding ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />} {finding ? 'מזהה מיקום…' : 'לזהות את העיר שלי אוטומטית'}
        </button>
      )}
      {geoMsg && <p className="mt-1 text-xs text-slate-500">{geoMsg}</p>}
      {required && <input tabIndex={-1} aria-hidden="true" required value={value} onChange={() => {}} className="absolute inset-x-0 bottom-0 h-px opacity-0" />}
      {open && (
        <div className="absolute inset-x-0 top-full z-[320] mt-2 max-h-80 overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-lift animate-fade-in" role="listbox">
          <div className="flex items-center gap-2 border-b border-rose-50 px-3">
            <Search size={15} className="text-rose-300" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="חיפוש עיר…" className="h-11 flex-1 bg-transparent text-[15px] outline-none" />
          </div>
          <div className="max-h-64 overflow-y-auto overscroll-contain p-1">
            {groups.map(g => (
              <div key={g.id}>
                <p className="px-3 pb-1 pt-3 text-[11px] font-semibold text-rose-500">{g.name}</p>
                {g.cities.map(c => (
                  <button type="button" key={c} onClick={() => { onChange(c); setOpen(false); setQ(''); }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-right text-[15px] hover:bg-rose-50 ${c === value ? 'font-strong text-rose-700' : 'text-slate-700'}`}>
                    {c}{c === value && <Check size={15} />}
                  </button>
                ))}
              </div>
            ))}
            {groups.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-400">לא מצאנו את העיר. בחרי את העיר הקרובה אלייך.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default CityPicker;
