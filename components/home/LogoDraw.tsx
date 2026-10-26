import React from 'react';
import { BRAND } from '../../shared/brand';

/**
 * The Spot logo drawing itself: the pin's outline is traced, then fills in, the dot pops,
 * the wordmark rises letter by letter, and a soft ripple keeps pulsing under it. Runs once on load (CSS only).
 */
const LogoDraw: React.FC<{ className?: string; big?: boolean }> = ({ className = '', big = false }) => {
  const letters = [...BRAND.name];
  return (
    <div className={`spot-draw relative flex items-center justify-center ${className}`} aria-hidden="true">
      {/* glow + ripples on the "spot" */}
      <span className={`absolute rounded-full bg-gradient-to-br from-plum-200/80 via-champagne-100/70 to-transparent blur-3xl ${big ? 'h-[26rem] w-[26rem]' : 'h-56 w-56'}`} />
      <span className={`spot-ripple absolute rounded-full border border-plum-300 ${big ? 'h-44 w-44' : 'h-28 w-28'}`} />
      <span className={`spot-ripple absolute rounded-full border border-plum-300 ${big ? 'h-44 w-44' : 'h-28 w-28'}`} style={{ animationDelay: '3.6s' }} />
      <div className="relative flex flex-row-reverse items-center gap-3">
        <svg viewBox="0 0 64 64" className={`spot-pin overflow-visible drop-shadow-xl ${big ? 'h-36 w-36' : 'h-24 w-24'}`}>
          <path className="spot-pin-path" pathLength={1}
            d="M32 4C20.4 4 11 13.2 11 24.6 11 40 32 60 32 60s21-20 21-35.4C53 13.2 43.6 4 32 4z"
            fill="rgb(var(--rose-700))" stroke="rgb(var(--rose-700))" strokeWidth={1.6} strokeLinejoin="round" />
          <circle className="spot-pin-dot" cx="32" cy="24.5" r="8.5" fill="rgb(var(--plum-300))" />
        </svg>
        <span className={`font-accent leading-none text-ink ${big ? 'text-[9rem]' : 'text-[5.5rem]'}`}>
          {letters.map((ch, i) => (
            <span key={i} className="inline-block overflow-hidden align-bottom">
              <span className="spot-letter inline-block" style={{ animationDelay: `${1500 + i * 120}ms` }}>{ch}</span>
            </span>
          ))}
        </span>
      </div>
    </div>
  );
};

export default LogoDraw;
