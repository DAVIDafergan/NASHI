import React, { useLayoutEffect, useRef, useState } from 'react';
import { ExternalLink, Phone } from 'lucide-react';
import { BRAND } from '../shared/brand';

/**
 * Text written by the admins the way they write in WhatsApp: line breaks, *bold*, links and phone numbers.
 * Links become short tappable chips (a long URL never pushes the layout sideways on a phone),
 * phone numbers become "call" links, and long texts are folded with "קראי עוד".
 */
const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
const PHONE_RE = /(0\d{1,2}-?\d{3}-?\d{4}|0\d{8,9})/g;

const linkLabel = (url: string) => {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, '');
    if (/whatsapp\.com|wa\.me|chat\.whatsapp/.test(host)) return u.pathname.includes('channel') ? 'ערוץ הוואטסאפ' : 'וואטסאפ';
    if (/nashi-co\.com/.test(host)) return `לאתר ${BRAND.name}`;
    if (/heyzine\.com/.test(host)) return 'לחוברת הדיגיטלית';
    if (/youtube\.com|youtu\.be/.test(host)) return 'צפייה ביוטיוב';
    if (/instagram\.com/.test(host)) return 'אינסטגרם';
    if (/facebook\.com/.test(host)) return 'פייסבוק';
    if (/docs\.google|forms\.gle/.test(host)) return 'לטופס';
    return host.length > 26 ? host.slice(0, 24) + '…' : host;
  } catch { return 'קישור'; }
};

// *bold* (WhatsApp style) inside a plain text fragment
const bold = (text: string, key: string) =>
  text.split(/(\*[^*\n]+\*)/g).map((p, i) =>
    /^\*[^*\n]+\*$/.test(p) ? <b key={`${key}b${i}`} className="font-strong text-ink">{p.slice(1, -1)}</b> : <React.Fragment key={`${key}t${i}`}>{p}</React.Fragment>);

const phones = (text: string, key: string) =>
  text.split(PHONE_RE).map((p, i) => {
    if (i % 2 === 1) {
      const tel = p.replace(/-/g, '');
      return (
        <a key={`${key}p${i}`} href={`tel:${tel}`} dir="ltr" className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-rose-50 px-2 py-0.5 text-rose-700 hover:bg-rose-100">
          <Phone size={12} /> {p}
        </a>
      );
    }
    return <React.Fragment key={`${key}f${i}`}>{bold(p, `${key}f${i}`)}</React.Fragment>;
  });

export const renderRich = (text: string) =>
  String(text || '').split(URL_RE).map((part, i) => {
    if (i % 2 === 1) {
      const href = part.startsWith('http') ? part : `https://${part}`;
      return (
        <a key={`u${i}`} href={href} target="_blank" rel="noopener noreferrer"
          className="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-full border border-rose-200 bg-white px-2.5 py-0.5 align-middle text-[13px] text-rose-700 transition hover:border-rose-400 hover:bg-rose-50">
          <ExternalLink size={12} className="shrink-0" /><span className="truncate">{linkLabel(part)}</span>
        </a>
      );
    }
    return <React.Fragment key={`s${i}`}>{phones(part, `s${i}`)}</React.Fragment>;
  });

const RichText: React.FC<{ text: string; className?: string; clampLines?: number }> = ({ text, className = '', clampLines }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !clampLines) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 2);
    check();
    const ro = new ResizeObserver(check); ro.observe(el);
    return () => ro.disconnect();
  }, [text, clampLines, open]);
  const clamp = clampLines && !open ? { display: '-webkit-box', WebkitLineClamp: clampLines, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : undefined;
  return (
    <div className="min-w-0">
      <div ref={ref} style={clamp} className={`whitespace-pre-line break-words [overflow-wrap:anywhere] ${className}`}>
        {renderRich(text.replace(/\n{3,}/g, '\n\n').trim())}
      </div>
      {clampLines && (overflows || open) && (
        <button type="button" onClick={() => setOpen(o => !o)} className="mt-1.5 text-[13px] font-strong text-rose-700 hover:underline">
          {open ? 'הצגת פחות' : 'קריאה נוספת'}
        </button>
      )}
    </div>
  );
};

export default RichText;
