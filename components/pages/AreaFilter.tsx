import React, { useState } from 'react';
import { MapPin, Wifi, Globe2 } from 'lucide-react';
import { Chip, ChipRow } from './PageKit';
import { REGIONS, regionName } from '../../shared/regions';
import { useMyPlace, isNear } from '../../hooks/useMyPlace';

export type Area = 'mine' | 'all' | 'online' | string;

/** Area filter state: starts on "my area" when we know it, otherwise the whole country. */
export function useArea() {
  const { region } = useMyPlace(null);
  const [area, setArea] = useState<Area>(region ? 'mine' : 'all');
  const match = (item: any) => {
    const scope = item?.scope || 'local';
    if (area === 'all') return true;
    if (area === 'online') return scope === 'online';
    if (area === 'mine') return isNear(item, region);
    return scope !== 'local' || (item?.region || 'north') === area;
  };
  return { area, setArea, match, myRegion: region };
}

export const AreaChips: React.FC<{ area: Area; setArea: (a: Area) => void; myRegion: string; className?: string }> = ({ area, setArea, myRegion, className = '' }) => (
  <ChipRow className={className}>
    {myRegion && <Chip active={area === 'mine'} onClick={() => setArea('mine')} icon={<MapPin size={14} />}>האזור שלי · {regionName(myRegion)}</Chip>}
    <Chip active={area === 'all'} onClick={() => setArea('all')} icon={<Globe2 size={14} />}>כל הארץ</Chip>
    <Chip active={area === 'online'} onClick={() => setArea('online')} icon={<Wifi size={14} />}>מקוון</Chip>
    {REGIONS.filter(r => r.id !== myRegion).map(r => (
      <Chip key={r.id} active={area === r.id} onClick={() => setArea(r.id)}>{r.name}</Chip>
    ))}
  </ChipRow>
);
