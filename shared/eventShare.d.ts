type ShareEvent = { title?: string; date?: string | Date; time?: string; startAt?: string | Date; endAt?: string | Date; location?: string; city?: string; scope?: string; price?: number; soldOut?: boolean; hebrewDate?: string };
export declare function whenText(e?: ShareEvent, hebrewDate?: string): string;
export declare function whereText(e?: ShareEvent): string;
export declare function priceText(e?: ShareEvent): string;
export declare function factsLine(e?: ShareEvent, hebrewDate?: string): string;
export declare function shareMessage(e?: ShareEvent, url?: string): string;
export declare function eventSharePath(id: string): string;
export declare function eventDeepLink(id: string): string;
