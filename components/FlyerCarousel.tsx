import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api, FlyerItem } from '../services/api';
import { useMyPlace, isNear } from '../hooks/useMyPlace';

const AUTOPLAY_MS = 6000;

/**
 * Homepage flyer carousel. Flyers are managed in the admin panel ("פליירים").
 * - Swipe / scroll-snap on touch, arrows + dots on desktop, autoplay that pauses on hover/touch.
 * - Any flyer shape works: the whole flyer is shown (object-contain) over a blurred copy of itself.
 * - A link starting with "/" navigates inside the site; anything else opens as an external link.
 */
const FlyerCarousel: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [all, setAll] = useState<FlyerItem[]>([]);
  // only flyers of the visitor's area (+ national ones); location unknown → national only
  const { region } = useMyPlace(null);
  const flyers = React.useMemo(() => all.filter((f: any) => region ? isNear(f, region) : (f.scope || 'local') !== 'local'), [all, region]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    api.getFlyers().then((rows) => { if (alive) setAll(Array.isArray(rows) ? rows : []); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const goTo = useCallback((i: number) => {
    const track = trackRef.current;
    if (!track || flyers.length === 0) return;
    const next = (i + flyers.length) % flyers.length;
    // The track is dir="rtl": slide 0 sits at scrollLeft 0 and later slides at negative
    // offsets (the standard behaviour in current Chrome, Safari and Firefox).
    track.scrollTo({ left: -next * track.clientWidth, behavior: 'smooth' });
    setIndex(next);
  }, [flyers.length]);

  // Keep the active dot in sync when the user swipes
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = track.clientWidth || 1;
        setIndex(Math.round(Math.abs(track.scrollLeft) / w));
      });
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => { track.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [flyers.length]);

  useEffect(() => {
    if (paused || flyers.length < 2) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = window.setTimeout(() => goTo(index + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [index, paused, flyers.length, goTo]);

  if (flyers.length === 0) return null;

  const open = (f: FlyerItem) => {
    const link = (f.link || '').trim();
    if (!link) return;
    if (link.startsWith('/')) navigate(link);
    else window.open(/^https?:\/\//i.test(link) ? link : `https://${link}`, f.openInNewTab === false ? '_self' : '_blank', 'noopener,noreferrer');
  };

  return (
    <section
      className={`relative w-full ${className}`}
      aria-roledescription="carousel"
      aria-label="פליירים"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div
        ref={trackRef}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth rounded-[2rem] shadow-petal border border-rose-100/80 bg-white"
        dir="rtl"
      >
        {flyers.map((f, i) => {
          const desktopSrc = api.flyerImageSrc(f.imageUrl);
          const mobileSrc = api.flyerImageSrc(f.mobileImageUrl || f.imageUrl);
          const clickable = Boolean((f.link || '').trim());
          const Tag: any = clickable ? 'button' : 'div';
          return (
            <Tag
              key={f._id}
              type={clickable ? 'button' : undefined}
              onClick={clickable ? () => open(f) : undefined}
              aria-roledescription="slide"
              aria-label={`${f.title || 'פלייר'} (${i + 1} מתוך ${flyers.length})`}
              className={`relative shrink-0 w-full snap-center overflow-hidden aspect-[4/5] sm:aspect-[16/9] md:aspect-[21/9] ${clickable ? 'cursor-pointer group' : ''}`}
            >
              {/* blurred backdrop so any flyer ratio looks intentional */}
              <picture aria-hidden="true">
                <source media="(max-width: 639px)" srcSet={mobileSrc} />
                <img src={desktopSrc} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60" loading={i === 0 ? 'eager' : 'lazy'} />
              </picture>
              <div className="absolute inset-0 bg-gradient-to-t from-white/30 via-transparent to-white/20" aria-hidden="true" />
              <picture>
                <source media="(max-width: 639px)" srcSet={mobileSrc} />
                <img
                  src={desktopSrc}
                  alt={f.title || 'פלייר'}
                  className="relative w-full h-full object-contain transition-transform duration-700 group-hover:scale-[1.015]"
                  loading={i === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                />
              </picture>
              {clickable && (
                <span className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur px-4 py-2 text-[12px] font-semibold text-rose-700 shadow-soft opacity-90 group-hover:opacity-100 transition">
                  לפרטים <ChevronLeft size={14} />
                </span>
              )}
            </Tag>
          );
        })}
      </div>

      {flyers.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="הפלייר הקודם"
            className="hidden md:flex absolute top-1/2 -translate-y-1/2 right-4 h-11 w-11 items-center justify-center rounded-full bg-white/85 backdrop-blur text-rose-700 shadow-soft hover:bg-white transition"
          >
            <ChevronRight size={20} />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="הפלייר הבא"
            className="hidden md:flex absolute top-1/2 -translate-y-1/2 left-4 h-11 w-11 items-center justify-center rounded-full bg-white/85 backdrop-blur text-rose-700 shadow-soft hover:bg-white transition"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="mt-4 flex items-center justify-center gap-2" role="tablist" aria-label="בחירת פלייר">
            {flyers.map((f, i) => (
              <button
                key={f._id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`פלייר ${i + 1}`}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all duration-500 ${i === index ? 'w-7 bg-rose-500' : 'w-1.5 bg-rose-200 hover:bg-rose-300'}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default FlyerCarousel;
