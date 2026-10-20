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
