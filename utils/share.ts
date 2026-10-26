import { shareMessage, eventSharePath } from '../shared/eventShare';
/** Public site origin used in shared links (the server renders preview cards for /s/* paths). */
export const SITE_ORIGIN = (() => {
  const o = typeof window !== 'undefined' ? window.location.origin : '';
  return /localhost|127\.0\.0\.1/.test(o) ? 'https://nashi-co.com' : o || 'https://nashi-co.com';
})();

export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** Native share sheet on phones (WhatsApp, Instagram…); WhatsApp web link elsewhere. */
export async function shareLink({ title, text, path }: { title: string; text: string; path: string }) {
  const url = `${SITE_ORIGIN}${path}`;
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return 'shared'; }
    catch (e: any) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  window.open(whatsappUrl(`${text}\n${url}`), '_blank', 'noopener');
  return 'whatsapp';
}

/** Share an image file (e.g. to WhatsApp status). Returns false when the device can't share files. */
export async function shareImageFile(blob: Blob, filename: string, text?: string): Promise<'shared' | 'cancelled' | 'unsupported'> {
  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  const nav: any = navigator;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], text }); return 'shared'; }
    catch (e: any) { return e?.name === 'AbortError' ? 'cancelled' : 'unsupported'; }
  }
  return 'unsupported';
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** "המקום, העיר" / "מקוון" for an event or class. */
export function placeLabel(item: { location?: string; city?: string; scope?: string } | null | undefined): string {
  if (!item) return '';
  if (item.scope === 'online') return item.location ? `מקוון · ${item.location}` : 'מקוון (זום)';
  const loc = (item.location || '').trim();
  const city = (item.city || '').trim();
  if (!city || loc.includes(city)) return loc || city;
  return loc ? `${loc}, ${city}` : city;
}

// ---------------- events ----------------

/** /s/event/<id>: WhatsApp builds a preview (flyer, date, place, price) from this link. */
export const eventShareUrl = (id: string) => `${SITE_ORIGIN}${eventSharePath(id)}`;

/**
 * Share an event: the phone's share sheet when there is one (title + message + link), otherwise WhatsApp
 * (web / desktop app) with the whole message — the link goes LAST so WhatsApp renders the preview card.
 */
export async function shareEvent(ev: any): Promise<'shared' | 'cancelled' | 'whatsapp'> {
  const id = ev?._id || ev?.id;
  const url = eventShareUrl(id);
  const nav: any = typeof navigator !== 'undefined' ? navigator : null;
  if (nav?.share && /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || '')) {
    try { await nav.share({ title: ev.title, text: shareMessage(ev), url }); return 'shared'; }
    catch (e: any) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  window.open(whatsappUrl(shareMessage(ev, url)), '_blank', 'noopener');
  return 'whatsapp';
}

export async function copyEventLink(ev: any): Promise<boolean> {
  const url = eventShareUrl(ev?._id || ev?.id);
  try { await navigator.clipboard.writeText(url); return true; }
  catch { window.prompt('העתקת הקישור:', url); return false; }
}
