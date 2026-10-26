import React, { useState } from 'react';
import { Calendar, MapPin, CheckCircle2, Share2 } from 'lucide-react';
import AudienceBadge from './AudienceBadge';

interface EventCardProps {
  title: string;
  image: string;
  /** Already-formatted date string (Hebrew date or locale date) */
  dateLabel: string;
  time?: string;
  location: string;
  /** shown as a pill on the flyer so the city is obvious at a glance */
  city?: string;
  category?: string;
  /** e.g. "אזלו הכרטיסים" — shown instead of the category chip */
  statusLabel?: string;
  ctaLabel?: string;
  onClick?: () => void;
  /** WhatsApp / share-sheet share of this event */
  onShare?: () => void;
  isPast?: boolean;
  className?: string;
  /** the item (or its audience): shows the small "לגברים / לנשים / לכולם" badge on the flyer */
  audience?: any;
}

/**
 * Unified event card used across the Home page and the Events listing.
 * Structure: image on top, title, date+time (icon), location (icon),
 * one clear call-to-action at the bottom. Anything non-essential
 * (price, ratings, extra badges) belongs in the detail view, not here.
 */
const EventCard: React.FC<EventCardProps> = ({
  title,
  image,
  dateLabel,
  time,
  location,
  city,
  category,
  statusLabel,
  ctaLabel = 'לפרטים והרשמה',
  onClick,
  onShare,
  isPast = false,
  className = '',
  audience,
}) => {
  // posters are portrait (4:5 / A4) or square: let the box follow the flyer instead of cropping it
  const [ratio, setRatio] = useState(4 / 3);
  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    if (w && h) setRatio(Math.min(1.6, Math.max(0.8, w / h)));
  };
  return (
    <div
      onClick={onClick}
      className={`group bg-white rounded-[1.75rem] overflow-hidden border border-rose-100/70 shadow-petal hover:shadow-lift hover:-translate-y-1 active:scale-[0.99] transition-all duration-500 cursor-pointer flex flex-col ${isPast ? 'opacity-70 saturate-50' : ''} ${className}`}
    >
      <div className="relative overflow-hidden bg-rose-50 shrink-0 m-2 mb-0 rounded-[1.4rem]" style={{ aspectRatio: String(ratio) }}>
        {/* event images are usually posters with text: show the whole poster over a soft copy of itself */}
        <img src={image} alt="" aria-hidden="true" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-50" />
        <img
          src={image}
          alt={title}
          loading="lazy"
          decoding="async"
          onLoad={onLoad}
          className={`relative w-full h-full object-contain transition-transform duration-700 group-hover:scale-[1.03] ${isPast ? 'grayscale-[0.35]' : ''}`}
        />
        {isPast ? (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 bg-slate-700/90 text-white px-3 py-1.5 rounded-full text-[12px] font-semibold shadow-soft">
            <CheckCircle2 size={13} /> עבר
          </span>
        ) : statusLabel ? (
          <span className="absolute top-3 right-3 bg-ink/85 text-white px-3 py-1 rounded-full text-[11px] font-semibold shadow-soft">
            {statusLabel}
          </span>
        ) : category && (
          <span className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide text-rose-700 shadow-soft">
            {category}
          </span>
        )}
        {onShare && !isPast && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onShare(); }} aria-label={`שיתוף: ${title}`} title="שיתוף בוואטסאפ"
            className="absolute top-2.5 left-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-rose-700 shadow-soft backdrop-blur-sm transition hover:bg-rose-700 hover:text-white active:scale-90">
            <Share2 size={17} />
          </button>
        )}
        <AudienceBadge audience={audience && typeof audience === 'object' ? audience.audience : audience} overlay className="absolute bottom-2.5 right-2.5" />
        {city && (
          <span className="absolute bottom-2.5 left-2.5 inline-flex max-w-[60%] items-center gap-1 rounded-full bg-ink/85 px-2.5 py-1 text-[11.5px] font-semibold text-white shadow-soft backdrop-blur-sm">
            <MapPin size={11} className="shrink-0" /> <span className="truncate">{city}</span>
          </span>
        )}
      </div>

      <div className="p-5 pt-4 flex flex-col flex-1 text-right gap-3">
        <h3 className="text-[1.2rem] leading-snug text-ink line-clamp-2">{title}</h3>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-[13px] text-slate-500">
            <Calendar size={14} className="text-rose-500 shrink-0" />
            <span>{dateLabel}{time ? ` • ${time}` : ''}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[13px] text-slate-500">
            <MapPin size={14} className="text-rose-500 shrink-0" />
            <span className="truncate">{location}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick?.(); }}
          className={`mt-auto w-full py-3 rounded-full text-[14.5px] font-strong active:scale-[0.98] transition-all min-h-[44px] ${
            isPast
              ? 'bg-slate-100 text-slate-500'
              : 'bg-rose-50 text-rose-700 group-hover:bg-rose-700 group-hover:text-white'
          }`}
        >
          {isPast ? 'עבר' : ctaLabel}
        </button>
      </div>
    </div>
  );
};

export default EventCard;
