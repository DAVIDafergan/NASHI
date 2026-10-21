import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Wifi, Globe2, Search, X, Navigation } from 'lucide-react';
import { Chip, ChipRow } from './PageKit';
import CityPicker from '../CityPicker';
import { REGIONS, regionName } from '../../shared/regions';
import { useMyPlace, isNear } from '../../hooks/useMyPlace';

/**
 * Area filter for events / classes / community:
 *   'city'      — my city            'mine'   — my region
 *   'all'       — the whole country  'online' — online only
 *   '<region>'  — a region           'city:<name>' — any locality in Israel
 * National and online items always show (they're for everyone), except under "online only".
 */
export type Area = 'city' | 'mine' | 'all' | 'online' | string;

export function useArea() {
  const { city, region } = useMyPlace(null);
  const [area, setArea] = useState<Area>(region ? 'mine' : 'all');
  const match = (item: any) => {
    const scope = item?.scope || 'local';
    if (area === 'all') return true;
    if (area === 'online') return scope === 'online';
    if (scope !== 'local') return true;
    if (area === 'mine') return isNear(item, region);
    if (area === 'city') return (item?.city || 'מגדל העמק') === city;
    if (area.startsWith('city:')) return (item?.city || 'מגדל העמק') === area.slice(5);
    return (item?.region || 'north') === area;
  };
  return { area, setArea, match, myRegion: region, myCity: city };
}

export const AreaChips: React.FC<{ area: Area; setArea: (a: Area) => void; myRegion: string; myCity?: string; className?: string }> = ({ area, setArea, myRegion, myCity, className = '' }) => {
  const place = useMyPlace(null);
  const city = myCity ?? place.city;
  const [picking, setPicking] = useState(false);
  const other = area.startsWith('city:') ? area.slice(5) : '';
  return (
    <>
      <ChipRow className={className}>
        {other && <Chip active onClick={() => setPicking(true)} icon={<MapPin size={14} />}>{other}</Chip>}
        {city && <Chip active={area === 'city'} onClick={() => setArea('city')} icon={<Navigation size={13} />}>{city}</Chip>}
        {myRegion && <Chip active={area === 'mine'} onClick={() => setArea('mine')} icon={<MapPin size={14} />}>האזור שלי · {regionName(myRegion)}</Chip>}
        <Chip active={area === 'all'} onClick={() => setArea('all')} icon={<Globe2 size={14} />}>כל הארץ</Chip>
        <Chip active={area === 'online'} onClick={() => setArea('online')} icon={<Wifi size={14} />}>מקוון</Chip>
        {REGIONS.filter(r => r.id !== myRegion).map(r => (
          <Chip key={r.id} active={area === r.id} onClick={() => setArea(r.id)}>{r.name}</Chip>
        ))}
        <Chip onClick={() => setPicking(true)} icon={<Search size={13} />}>עיר או יישוב…</Chip>
      </ChipRow>
      {picking && createPortal(
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-ink/40 backdrop-blur-sm md:items-center md:p-6" dir="rtl" onClick={() => setPicking(false)}>
          <div className="w-full rounded-t-[2rem] bg-[#FBF7F4] p-6 pb-8 shadow-2xl md:max-w-md md:rounded-[2rem] animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl">מה קורה ב…</h3>
              <button onClick={() => setPicking(false)} aria-label="סגירה" className="rounded-full p-2 text-slate-400 hover:bg-rose-50"><X size={20} /></button>
            </div>
            <p className="mt-2 text-sm text-slate-500">בחרי כל עיר או יישוב בארץ. יוצג מה שקורה שם, וגם התוכן הארצי והמקוון.</p>
            <CityPicker className="mt-2" value={other} placeholder="חיפוש עיר או יישוב…" locate={false} inline
              onChange={c => { setArea(c === city ? 'city' : `city:${c}`); setPicking(false); }} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
