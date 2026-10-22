/**
 * Downloads a flyer and returns it as a data: URL — the same way NASHI stores every event image.
 * server/media.js then serves it as /api/media/<sha1>.<ext> (so the site never hotlinks the ticketing site).
 */
const OK_TYPES = /^image\/(jpeg|jpg|png|webp|gif)$/i;
export const MAX_FLYER_BYTES = 4 * 1024 * 1024;

const sniff = (buf) => {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buf.slice(0, 3).toString() === 'GIF') return 'image/gif';
  return '';
};

export async function downloadFlyer(http, url) {
  const { buf, type } = await http.getBuffer(url);
  const mime = (type.split(';')[0] || '').trim().toLowerCase();
  const real = sniff(buf) || (OK_TYPES.test(mime) ? mime : '');
  if (!real) throw new Error(`הפלייר אינו תמונה (${mime || 'unknown'})`);
  if (buf.length < 2048) throw new Error('הפלייר קטן מדי');
  if (buf.length > MAX_FLYER_BYTES) throw new Error('הפלייר גדול מדי');
  return `data:${real};base64,${buf.toString('base64')}`;
}
