import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Globe2, Wifi, Check } from 'lucide-react';
import { REGIONS, regionName } from '../../shared/regions';
import { useMyPlace } from '../../hooks/useMyPlace';

/**
 * "איפה?" — the area picker of the events page, built to be obvious on a phone:
 *   1. big region cards with the number of upcoming events in each (plus כל הארץ and מקוון)
 *   2. inside a region: chips of the cities that actually have events, with counts
 * The choice is remembered on the device; the first time, the visitor's own region is selected.
 * National / online events are for everyone: the page shows them in their own section under any region.
 */
export type AreaSel = { region: string; city: string }; // region: 'all' | 'online' | <region id>
const KEY = 'nashi-events-area';

const read = (): AreaSel | null => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && typeof v.region === 'string' ? { region: v.region, city: v.city || '' } : null; } catch { return null; } };

type Item = { region?: string; city?: string; scope?: string };
const scopeOf = (x: Item) => x.scope || 'local';
const regionOf = (x: Item) => x.region || 'north';
const cityOf = (x: Item) => x.city || 'מגדל העמק';

export function useRegionCity<T extends Item>(items: T[], isUpcoming: (x: T) => boolean) {
  const { region: myRegion, city: myCity } = useMyPlace(null);
  const [sel, setSel] = useState<AreaSel>(() => read() || { region: myRegion || 'all', city: '' });
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(sel)); } catch { /* ignore */ } }, [sel]);

  const upcoming = useMemo(() => items.filter(isUpcoming), [items, isUpcoming]);
  const regionCounts = useMemo(() => {
    const c: Record<string, number> = { all: upcoming.length, online: 0 };
    for (const x of upcoming) {
      if (scopeOf(x) === 'online') c.online++;
      else if (scopeOf(x) === 'local') c[regionOf(x)] = (c[regionOf(x)] || 0) + 1;
    }
    return c;
  }, [upcoming]);
  const everywhereCount = upcoming.filter(x => scopeOf(x) !== 'local').length;
  const cityCounts = useMemo(() => {
    if (sel.region === 'all' || sel.region === 'online') return [] as [string, number][];
    const c = new Map<string, number>();
    for (const x of upcoming) if (scopeOf(x) === 'local' && regionOf(x) === sel.region) c.set(cityOf(x), (c.get(cityOf(x)) || 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'he'));
  }, [upcoming, sel.region]);

  /** 'here' = belongs to the chosen region/city · 'everywhere' = national/online shown under every region · false = hidden */
  const place = (x: T): 'here' | 'everywhere' | false => {
    const scope = scopeOf(x);
    if (sel.region === 'all') return 'here';
    if (sel.region === 'online') return scope === 'online' ? 'here' : false;
    if (scope !== 'local') return 'everywhere';
    if (regionOf(x) !== sel.region) return false;
    return !sel.city || cityOf(x) === sel.city ? 'here' : false;
  };
  return {
    sel, myRegion, myCity, regionCounts, cityCounts, everywhereCount, place,
    setRegion: (region: string) => setSel({ region, city: '' }),
    setCity: (city: string) => setSel(s => ({ ...s, city: s.city === city ? '' : city })),
  };
}

const RegionCard: React.FC<{ active: boolean; onClick: () => void; title: string; count: number; sub?: string; icon?: React.ReactNode }> = ({ active, onClick, title, count, sub, icon }) => (
  <button type="button" onClick={onClick} aria-pressed={active}
    className={`relative flex min-w-[118px] shrink-0 flex-col items-start rounded-[1.25rem] border px-3.5 py-2.5 text-right transition active:scale-[0.97] md:min-w-0 ${active ? 'border-rose-700 bg-rose-700 text-white shadow-lift' : 'border-rose-100 bg-white text-ink hover:border-rose-300'}`}>
    <span className={`flex items-center gap-1 text-[11px] ${active ? 'text-rose-100' : 'text-rose-500'}`}>{icon}{sub || ' '}</span>
    <span className="mt-0.5 text-[15px] font-strong leading-tight">{title}</span>
    <span className={`mt-1 text-[12px] tabular-nums ${active ? 'text-white/80' : count ? 'text-slate-500' : 'text-slate-300'}`}>{count ? `${count} אירועים` : 'עוד אין אירועים'}</span>
    {active && <Check size={14} className="absolute left-2.5 top-2.5 text-white/80" />}
  </button>
);

export const RegionCityPicker: React.FC<{ f: ReturnType<typeof useRegionCity<any>>; className?: string }> = ({ f, className = '' }) => {
  const regions = [...REGIONS].sort((a, b) => (a.id === f.myRegion ? -1 : b.id === f.myRegion ? 1 : 0));
  return (
    <section className={className} aria-label="בחירת אזור">
      <p className="mb-2 text-[13px] font-semibold text-slate-500">איפה?</p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:px-0 md:grid md:grid-cols-5 md:overflow-visible lg:grid-cols-9">
        <RegionCard active={f.sel.region === 'all'} onClick={() => f.setRegion('all')} title="כל הארץ" count={f.regionCounts.all || 0} icon={<Globe2 size={11} />} sub="הכול" />
        {regions.map(r => (
          <RegionCard key={r.id} active={f.sel.region === r.id} onClick={() => f.setRegion(r.id)} title={r.name} count={f.regionCounts[r.id] || 0}
            icon={r.id === f.myRegion ? <MapPin size={11} /> : undefined} sub={r.id === f.myRegion ? 'האזור שלי' : ''} />
        ))}
        <RegionCard active={f.sel.region === 'online'} onClick={() => f.setRegion('online')} title="מקוון" count={f.regionCounts.online || 0} icon={<Wifi size={11} />} sub="מכל מקום" />
      </div>
      {f.cityCounts.length > 0 && (
        <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0" aria-label={`ערים ב${regionName(f.sel.region)}`}>
          <button type="button" onClick={() => f.setCity('')} aria-pressed={!f.sel.city}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] transition ${!f.sel.city ? 'border-ink bg-ink text-white' : 'border-rose-100 bg-white text-slate-600 hover:border-rose-300'}`}>
            כל {regionName(f.sel.region)}
          </button>
          {f.cityCounts.map(([c, n]) => (
            <button key={c} type="button" onClick={() => f.setCity(c)} aria-pressed={f.sel.city === c}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] transition ${f.sel.city === c ? 'border-ink bg-ink text-white' : 'border-rose-100 bg-white text-slate-600 hover:border-rose-300'}`}>
              {c} <span className="tabular-nums opacity-60">{n}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};
