import React from 'react';
import { Calendar, MapPin } from 'lucide-react';

interface EventCardProps {
  title: string;
  image: string;
  /** Already-formatted date string (Hebrew date or locale date) */
  dateLabel: string;
  time?: string;
  location: string;
  category?: string;
  ctaLabel?: string;
  onClick?: () => void;
  isPast?: boolean;
  className?: string;
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
  category,
  ctaLabel = 'לפרטים והרשמה',
  onClick,
  isPast = false,
  className = '',
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-[0_2px_16px_rgba(15,23,42,0.06)] hover:shadow-[0_8px_28px_rgba(15,23,42,0.1)] hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 cursor-pointer flex flex-col ${className}`}
    >
      <div className="relative h-44 sm:h-48 overflow-hidden bg-slate-50 shrink-0">
        <img
          src={image}
          alt={title}
          loading="lazy"
          className={`w-full h-full object-cover transition-transform duration-700 hover:scale-105 ${isPast ? 'grayscale-[0.4] brightness-90' : ''}`}
        />
        {category && (
          <span className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full text-[11px] font-bold text-slate-700 shadow-sm">
            {category}
          </span>
        )}
        {isPast && (
          <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-[10px] font-bold">
            הסתיים
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 text-right gap-3">
        <h3 className="font-bold text-slate-800 text-base leading-snug line-clamp-2">{title}</h3>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Calendar size={14} className="text-[#E85C5C] shrink-0" />
            <span>{dateLabel}{time ? ` • ${time}` : ''}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <MapPin size={14} className="text-[#E85C5C] shrink-0" />
            <span className="truncate">{location}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick?.(); }}
          className="mt-1 w-full py-3 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-[#E85C5C] active:scale-95 transition-all min-h-[44px]"
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
};

export default EventCard;
