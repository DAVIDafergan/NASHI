import React from 'react';
import { BRAND } from '../shared/brand';

/** The mark: a location pin with a "spot" dot — navy pin (rose-700 token), gold dot (rose-400 token). */
export const LogoMark: React.FC<{ className?: string; title?: string }> = ({ className = 'h-8 w-8', title }) => (
  <svg viewBox="0 0 64 64" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
    <path d="M32 4C20.4 4 11 13.2 11 24.6 11 40 32 60 32 60s21-20 21-35.4C53 13.2 43.6 4 32 4z" className="fill-rose-700" />
    <circle cx="32" cy="24.5" r="8.5" className="fill-rose-400" />
  </svg>
);

/** Pin + wordmark (BRAND.name). size: 'sm' | 'md' | 'lg' | 'xl'. */
const Logo: React.FC<{ size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string; light?: boolean }> = ({ size = 'md', className = '', light }) => {
  const s = {
    sm: { mark: 'h-6 w-6', word: 'text-[1.5rem]' },
    md: { mark: 'h-8 w-8 md:h-9 md:w-9', word: 'text-[2.4rem] md:text-[2.7rem]' },
    lg: { mark: 'h-12 w-12', word: 'text-[3rem]' },
    xl: { mark: 'h-16 w-16 md:h-20 md:w-20', word: 'text-[4rem] md:text-[5.5rem]' },
  }[size];
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} dir="rtl">
      <LogoMark className={`${s.mark} shrink-0`} />
      <span className={`font-accent leading-none ${s.word} ${light ? 'text-white' : 'text-ink'}`}>{BRAND.name}</span>
    </span>
  );
};

export default Logo;
