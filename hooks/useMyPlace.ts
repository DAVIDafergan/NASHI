import { useCallback, useEffect, useState } from 'react';
import { regionOfCity } from '../shared/regions';

/**
 * "Where am I?" for the whole site: the logged-in user's city, or the city a guest picked
 * (kept on the device). Changing it anywhere updates every component that uses the hook.
 */
const KEY = 'nashi-city';
const EVT = 'nashi-place';

const readGuest = (): string => {
  try {
    const c = localStorage.getItem(KEY);
    if (c) return c;
    // a logged-in member's city (kept by the app with the user) when a page doesn't pass the user in
    return JSON.parse(localStorage.getItem('user') || 'null')?.city || '';
  } catch { return ''; }
};

export function setGuestCity(city: string) {
  try { if (city) localStorage.setItem(KEY, city); else localStorage.removeItem(KEY); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(EVT));
}

export function useMyPlace(user?: { city?: string; region?: string } | null) {
  const [guestCity, setGuest] = useState(readGuest);
  useEffect(() => {
    const on = () => setGuest(readGuest());
    window.addEventListener(EVT, on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener(EVT, on); window.removeEventListener('storage', on); };
  }, []);
  // a place chosen on this device (header picker / detected location) wins over the profile city,
  // so switching city always changes what the site shows
  let chosen = '';
  try { chosen = localStorage.getItem(KEY) || ''; } catch { /* ignore */ }
  const city = chosen || user?.city || guestCity || '';
  const region = (regionOfCity(city) || (!chosen ? user?.region : '') || '') as string;
  const set = useCallback((c: string) => setGuestCity(c), []);
  return { city, region, setCity: set };
}

/** Does an item (event/class/community…) belong in "near you" for this region? */
export function isNear(item: { region?: string; scope?: string } | null | undefined, region: string) {
  if (!item) return false;
  const scope = item.scope || 'local';
  if (scope !== 'local') return true;
  if (!region) return true;
  return (item.region || 'north') === region;
}

/** Home page / flyers: national & online items, plus local items of the visitor's own CITY (not the whole region). */
export function isInMyCity(item: { city?: string; scope?: string } | null | undefined, city: string) {
  if (!item) return false;
  const scope = item.scope || 'local';
  if (scope !== 'local') return true;
  if (!city) return false;
  return (item.city || 'מגדל העמק') === city;
}
