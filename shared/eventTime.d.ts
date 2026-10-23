type EventTimes = { startAt?: string | Date | null; endAt?: string | Date | null; date?: string | Date | null; time?: string | null; sessions?: { date?: string | Date | null }[] };
export declare const PAST_GRACE_MS: number;
export declare function israelLocalMs(y: number, m: number, d: number, h?: number, mi?: number): number;
export declare function eventStartMs(e?: EventTimes): number;
export declare function eventEndMs(e?: EventTimes): number;
export declare function isEventPast(e: EventTimes, now?: number): boolean;
export declare function isEventExpired(e: EventTimes, now?: number): boolean;
