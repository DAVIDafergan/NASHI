import React, { useState } from 'react';
import { AUDIENCE_FILTERS, normAudienceFilter, matchesAudience, AudienceFilter as Filter } from '../shared/audience';

// The visitor's last choice, shared by the events, classes and community pages.
const KEY = 'spot-audience-filter';
const read = (): Filter => { try { return normAudienceFilter(localStorage.getItem(KEY)); } catch { return 'any'; } };
const write = (v: Filter) => { try { if (v === 'any') localStorage.removeItem(KEY); else localStorage.setItem(KEY, v); } catch { /* private mode etc. */ } };

/** { audience, setAudience, match(item) } — remembers the last choice in localStorage (guarded). */
export function useAudienceFilter() {
  const [audience, set] = useState<Filter>(read);
  const setAudience = (v: Filter) => { set(v); write(v); };
  return { audience, setAudience, match: (item: any) => matchesAudience(item, audience) };
}

/** Chips: הכול · לגברים · לנשים · משפחות/לכולם. counts (optional) per chip id. */
export const AudienceChips: React.FC<{ value: Filter; onChange: (v: Filter) => void; counts?: Partial<Record<Filter, number>>; className?: string }> = ({ value, onChange, counts, className = '' }) => (
  <div className={`flex flex-wrap items-center gap-2 ${className}`} role="radiogroup" aria-label="קהל יעד">
    {AUDIENCE_FILTERS.map(f => {
      const on = value === f.id;
      return (
        <button key={f.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(f.id)} data-audience={f.id}
          className={`inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 sm:px-4 text-[13.5px] transition-all duration-300 active:scale-95 ${on ? 'border-plum-300 bg-plum-300 text-ink shadow-soft' : 'border-rose-100 bg-white/80 text-slate-600 hover:border-rose-300 hover:text-rose-800'}`}>
          {f.label}
          {counts && counts[f.id] !== undefined && <span className={`text-[11.5px] tabular-nums ${on ? 'text-white/70' : 'text-slate-400'}`}>{counts[f.id]}</span>}
        </button>
      );
    })}
  </div>
);

/** Counts per chip for a list (honours the same rules as the filter). */
export const audienceCounts = (list: any[]): Partial<Record<Filter, number>> =>
  Object.fromEntries(AUDIENCE_FILTERS.map(f => [f.id, list.filter(i => matchesAudience(i, f.id)).length]));
