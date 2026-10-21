import React, { useMemo, useRef, useState, useEffect } from 'react';
import { MapPin, Search, ChevronDown, Check, LocateFixed, Loader2 } from 'lucide-react';
import { REGIONS, CITIES, MAIN_CITIES } from '../shared/regions';

// spelling-tolerant search key: קרית/קריית, תקוה/תקווה, quotes, hyphens and spaces don't matter
export const cityKey = (s: string) => s.replace(/[\s\-"'״׳()]/g, '').replace(/וו/g, 'ו').replace(/יי/g, 'י');
const ALL = REGIONS.flatMap(r => CITIES[r.id].map(c => ({ c, r: r.id, k: cityKey(c) })));
/** Localities matching a search, best first: exact start of name, start of a word, then anywhere. */
export function searchCities(q: string, limit = 60) {
  const k = cityKey(q.trim());
  if (!k) return [];
  const words = q.trim().split(/\s+/).map(cityKey).filter(Boolean);
  const scored = ALL.map(x => {
    if (x.k === k) return { ...x, s: 0 };
    if (x.k.startsWith(k)) return { ...x, s: 1 };
    if (x.c.split(/[\s\-]/).some(w => cityKey(w).startsWith(words[0] || k))) return { ...x, s: 2 };
    if (x.k.includes(k)) return { ...x, s: 3 };
    return null;
  }).filter(Boolean) as { c: string; r: string; k: string; s: number }[];
  return scored.sort((a, b) => a.s - b.s || a.c.length - b.c.length).slice(0, limit);
}

/** Searchable city select, grouped by region. */
const CityPicker: React.FC<{ value: string; onChange: (city: string) => void; placeholder?: string; required?: boolean; className?: string; compact?: boolean; locate?: boolean; inline?: boolean }> = ({ value, onChange, placeholder = 'באיזו עיר את גרה?', required, className = '', compact, locate = true, inline }) => {
  const [open, setOpen] = useState(false);
  const [finding, setFinding] = useState(false);
  const [geoMsg, setGeoMsg] = useState('');
  const detect = async () => {
    setFinding(true); setGeoMsg('');
    const { locateCity } = await import('../utils/locate');
    const r = await locateCity();
    setFinding(false);
    if (r) onChange(r.city); else setGeoMsg('לא הצלחנו לזהות. אפשר לבחור מהרשימה.');
  };
  const [q, setQ] = useState('');
  const pick = (c: string) => { onChange(c); setOpen(false); setQ(''); };
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const results = useMemo(() => searchCities(q), [q]);
  const groups = useMemo(() => REGIONS.map(r => {
    const main = MAIN_CITIES[r.id] || [];
    const all = CITIES[r.id];
    return { ...r, cities: expanded[r.id] ? all : main, more: all.length - main.length };
  }), [expanded]);
  const list = (
          <div className={`${inline ? 'max-h-[46vh]' : 'max-h-64'} overflow-y-auto overscroll-contain p-1`}>
            {q.trim() ? (
              results.length ? results.map(({ c, r }) => (
                <button type="button" key={c} onClick={() => pick(c)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-right text-[15px] hover:bg-rose-50 ${c === value ? 'font-strong text-rose-700' : 'text-slate-700'}`}>
                  <span className="min-w-0 truncate">{c}</span>
                  <span className="shrink-0 text-[11px] text-slate-400">{REGIONS.find(x => x.id === r)?.name}</span>
                </button>
              )) : <p className="px-3 py-6 text-center text-sm text-slate-400">לא מצאנו יישוב בשם הזה. נסי לכתוב חלק מהשם.</p>
            ) : (
              <>
                <p className="px-3 pb-1 pt-2 text-[12px] text-slate-400">כל היישובים בארץ, אפשר לחפש למעלה</p>
                {groups.map(g => (
                  <div key={g.id}>
                    <p className="px-3 pb-1 pt-3 text-[11px] font-semibold text-rose-500">{g.name}</p>
                    {g.cities.map(c => (
                      <button type="button" key={c} onClick={() => pick(c)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-right text-[15px] hover:bg-rose-50 ${c === value ? 'font-strong text-rose-700' : 'text-slate-700'}`}>
                        {c}{c === value && <Check size={15} />}
                      </button>
                    ))}
                    {g.more > 0 && (
                      <button type="button" onClick={() => setExpanded(e => ({ ...e, [g.id]: !e[g.id] }))} className="w-full rounded-xl px-3 py-2 text-right text-[13px] text-rose-700 hover:bg-rose-50">
                        {expanded[g.id] ? 'הצגת הערים המרכזיות בלבד' : `כל היישובים באזור (${CITIES[g.id as keyof typeof CITIES].length}) ←`}
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
  );
  const detectBtn = locate && !compact && (
    <button type="button" onClick={detect} disabled={finding} className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-rose-700 hover:underline disabled:opacity-60">
      {finding ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />} {finding ? 'מזהה מיקום…' : 'לזהות את העיר שלי אוטומטית'}
    </button>
  );
  if (inline) return (
    <div className={className}>
      {detectBtn}
      {geoMsg && <p className="mt-1 text-xs text-slate-500">{geoMsg}</p>}
      <div className="mt-3 overflow-hidden rounded-2xl border border-rose-100 bg-white">
        <div className="flex items-center gap-2 border-b border-rose-50 px-3">
          <Search size={15} className="text-rose-300" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder || 'חיפוש עיר או יישוב…'} className="h-12 flex-1 bg-transparent text-[16px] outline-none" />
          {value && <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-[12px] text-rose-700">{value} ✓</span>}
        </div>
        {list}
      </div>
    </div>
  );
  return (
    <div ref={box} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-2xl border border-rose-100 bg-white text-right outline-none transition focus:ring-4 focus:ring-rose-100 ${compact ? 'px-3 py-2 text-sm' : 'px-4 py-3.5 text-[16px]'}`}>
        <MapPin size={compact ? 15 : 17} className="shrink-0 text-rose-400" />
        <span className={`flex-1 truncate ${value ? 'text-ink' : 'text-slate-400'}`}>{value || placeholder}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {detectBtn}
      {geoMsg && <p className="mt-1 text-xs text-slate-500">{geoMsg}</p>}
      {required && <input tabIndex={-1} aria-hidden="true" required value={value} onChange={() => {}} className="absolute inset-x-0 bottom-0 h-px opacity-0" />}
      {open && (
        <div className="absolute inset-x-0 top-full z-[320] mt-2 max-h-80 overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-lift animate-fade-in" role="listbox">
          <div className="flex items-center gap-2 border-b border-rose-50 px-3">
            <Search size={15} className="text-rose-300" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="חיפוש עיר או יישוב…" className="h-11 flex-1 bg-transparent text-[15px] outline-none" />
          </div>
          {list}
        </div>
      )}
    </div>
  );
};

export default CityPicker;
