/**
 * Shrinks a phone photo before upload: reads the file, downsizes the long side to `maxSide`
 * and re-encodes as JPEG (or PNG when the original is PNG and `keepPng` is set).
 * A 6MB camera photo typically ends up at 150–400KB.
 */
export async function compressImageFile(file: File, maxSide = 1600, quality = 0.84, keepPng = false): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('קריאת הקובץ נכשלה'));
    r.readAsDataURL(file);
  });
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return raw;
  const img = await loadImage(raw);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return raw;
  const png = keepPng && file.type === 'image/png';
  if (!png) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(png ? 'image/png' : 'image/jpeg', quality);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    if (!src.startsWith('data:')) i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('התמונה לא נטענה'));
    i.src = src;
  });
}
