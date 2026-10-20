import { nearestCity } from '../shared/geo';

/** Ask the browser for the position and return the nearest NASHI city (null if denied / outside Israel). */
export function locateCity(timeoutMs = 9000): Promise<{ city: string; km: number } | null> {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve(nearestCity(pos.coords.latitude, pos.coords.longitude)),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 24 * 60 * 60 * 1000 },
    );
  });
}

export async function geoPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  try {
    const p = await (navigator as any).permissions?.query({ name: 'geolocation' });
    return (p?.state as any) || 'unknown';
  } catch { return 'unknown'; }
}
