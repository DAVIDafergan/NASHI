import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react';

/**
 * Event flyers are posters (portrait 4:5 / A4, or square) with text all over them — never crop them.
 * FlyerView shows the WHOLE flyer, centred on a blurred, tinted copy of itself; tap opens FlyerZoom.
 */
const FlyerView: React.FC<{ src: string; alt?: string; grayscale?: boolean; onZoom?: () => void; maxH?: string }> = ({ src, alt = '', grayscale, onZoom, maxH = 'max-h-[62vh] md:max-h-[560px]' }) => (
  <div className="relative overflow-hidden rounded-[1.6rem] bg-plum-950">
    <img src={src} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-55 blur-2xl" />
    <div className="absolute inset-0 bg-gradient-to-b from-plum-950/10 to-plum-950/40" />
    <button type="button" onClick={onZoom} disabled={!onZoom} className="group relative flex w-full items-center justify-center px-3 py-4 md:py-6" aria-label="הגדלת הפלייר">
      <img src={src} alt={alt} className={`${maxH} min-h-[180px] w-auto max-w-full rounded-xl object-contain shadow-lift ${grayscale ? 'grayscale' : ''}`} />
      {onZoom && <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11.5px] text-slate-600 shadow-soft"><Maximize2 size={12} /> הגדלה</span>}
    </button>
  </div>
);

/** Full-screen flyer: fit to screen; tap (or the button) for full size, then scroll / pinch around. */
export const FlyerZoom: React.FC<{ src: string; onClose: () => void }> = ({ src, onClose }) => {
  const [big, setBig] = useState(false);
  useEffect(() => {
    if (!src) return;
    setBig(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src, onClose]);
  if (!src) return null;
  return createPortal(
    <div className="fixed inset-0 z-[400] bg-black/92 animate-fade-in" role="dialog" aria-modal="true" aria-label="פלייר" dir="rtl">
      <div className={`h-full w-full ${big ? 'overflow-auto' : 'flex items-center justify-center overflow-hidden p-3'}`} style={{ touchAction: 'pan-x pan-y pinch-zoom' }} onClick={() => setBig(b => !b)}>
        <img src={src} alt="" className={big ? 'max-w-none w-[200vw] md:w-auto' : 'max-h-full max-w-full object-contain'} />
      </div>
      <div className="fixed left-3 top-3 flex gap-2">
        <button onClick={onClose} aria-label="סגירה" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-soft"><X size={20} /></button>
        <button onClick={() => setBig(b => !b)} aria-label={big ? 'התאמה למסך' : 'הגדלה'} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-soft">{big ? <ZoomOut size={19} /> : <ZoomIn size={19} />}</button>
      </div>
    </div>,
    document.body
  );
};

export default FlyerView;
