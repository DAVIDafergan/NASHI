import React from 'react';
import { AUDIENCE_BADGE, audienceOf } from '../shared/audience';

// Colour per audience — tokens only (rose-* = navy/gold primary, plum-* = the dusty-rose accent, sage = families).
const TONE = {
  men: 'bg-rose-700 text-white border-rose-700',
  women: 'bg-plum-50 text-plum-700 border-plum-200',
  all: 'bg-sage-50 text-sage-700 border-sage-200',
} as const;

/** Small "לגברים" / "לנשים" / "לכולם" badge. A missing audience reads as women (shared/audience.js). */
const AudienceBadge: React.FC<{ item?: any; audience?: string; className?: string; overlay?: boolean }> = ({ item, audience, className = '', overlay }) => {
  const a = audienceOf(audience ?? item);
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold leading-5 ${TONE[a]} ${overlay ? 'shadow-soft ring-1 ring-white/80' : ''} ${className}`}>
      {AUDIENCE_BADGE[a]}
    </span>
  );
};

export default AudienceBadge;
