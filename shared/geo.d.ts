export declare const CITY_COORDS: Record<string, [number, number]>;
export declare function nearestCity(lat: number, lng: number, maxKm?: number): { city: string; km: number } | null;
