import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/** Headline whose words rise into place one after another. */
export const AnimatedHeadline: React.FC<{ lines: { text: string; className?: string }[]; className?: string; startDelay?: number }> = ({ lines, className = '', startDelay = 120 }) => {
  let wordIndex = 0;
  return (
    <h1 className={className}>
      {lines.map((line, li) => (
        <span key={li} className={`block ${line.className || ''}`}>
          {line.text.split(' ').map((word, wi) => {
            const delay = startDelay + wordIndex++ * 110;
            return (
              <span key={wi} className="inline-block overflow-hidden align-bottom pb-[0.12em] -mb-[0.12em]">
                <span className="inline-block animate-word-rise" style={{ animationDelay: `${delay}ms` }}>
                  {word}
                </span>
                {wi < line.text.split(' ').length - 1 && ' '}
              </span>
            );
          })}
        </span>
      ))}
    </h1>
  );
};

/** Endless ribbon of words. Pauses on hover. */
export const Marquee: React.FC<{ items: string[]; className?: string }> = ({ items, className = '' }) => {
  const row = [...items, ...items, ...items, ...items];
  return (
    <div className={`group relative overflow-hidden ${className}`} aria-hidden="true">
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center">
            {row.map((w, i) => (
              <span key={`${copy}-${i}`} className="flex items-center">
                <span className="font-display text-[1.6rem] md:text-[2.4rem] leading-none px-6 md:px-10 text-ink/85">{w}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" className="text-rose-400 shrink-0"><path fill="currentColor" d="M12 0c.6 6.4 5.6 11.4 12 12-6.4.6-11.4 5.6-12 12-.6-6.4-5.6-11.4-12-12C6.4 11.4 11.4 6.4 12 0z" /></svg>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Section header: eyebrow + big title + optional link, with a line that draws itself in. */
export const SectionHeader: React.FC<{ eyebrow: string; title: string; to?: string; linkLabel?: string; className?: string }> = ({ eyebrow, title, to, linkLabel, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`px-5 md:px-0 ${className}`}>
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className={`eyebrow ${seen ? 'animate-fade-in-up' : 'opacity-0'}`}>{eyebrow}</p>
          <h2 className={`mt-2 font-display text-[2rem] md:text-[3rem] leading-[1.05] text-ink ${seen ? 'animate-blur-in' : 'opacity-0'}`} style={{ animationDelay: '120ms' }}>{title}</h2>
        </div>
        {to && (
          <Link to={to} className="group hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-rose-700 shrink-0 pb-2">
            {linkLabel || 'לכל הרשימה'}
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 transition-all duration-500 group-hover:bg-rose-700 group-hover:text-white group-hover:border-rose-700 group-hover:-translate-x-1">
              <ArrowLeft size={15} />
            </span>
          </Link>
        )}
      </div>
      <div className={`mt-5 h-px origin-right bg-gradient-to-l from-rose-300 via-rose-200 to-transparent ${seen ? 'animate-line-grow' : 'scale-x-0'}`} style={{ animationDelay: '250ms' }} />
    </div>
  );
};

/** Card that tilts slightly toward the pointer (desktop only; no effect on touch). */
export const TiltCard: React.FC<React.HTMLAttributes<HTMLDivElement> & { max?: number }> = ({ children, className = '', max = 6, ...rest }) => {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || window.matchMedia('(hover: none)').matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateY(-4px)`;
  };
  const reset = () => { if (ref.current) ref.current.style.transform = ''; };
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={reset} className={`transition-transform duration-300 ease-out will-change-transform ${className}`} {...rest}>
      {children}
    </div>
  );
};
