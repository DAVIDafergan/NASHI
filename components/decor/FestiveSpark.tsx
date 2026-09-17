import React, { useEffect, useRef, useState } from 'react';

interface FestiveSparkProps {
  className?: string;
  size?: number;
  rotate?: number;
  flip?: boolean;
  /** float | float-reverse | none */
  motion?: 'float' | 'float-reverse' | 'none';
  /** parallax strength in px per 1000px scrolled; 0 disables */
  parallax?: number;
  style?: React.CSSProperties;
}

/**
 * Flat, minimalist festive sparkle-and-confetti SVG used purely as ambient
 * decoration. Motion is intentionally subtle (slow float + tiny rotation)
 * and fully disabled under prefers-reduced-motion.
 */
const FestiveSpark: React.FC<FestiveSparkProps> = ({
  className = '',
  size = 120,
  rotate = 0,
  flip = false,
  motion = 'float',
  parallax = 0,
  style = {},
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReducedMotion(prefersReduced);
    if (prefersReduced || !parallax) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setOffset((window.scrollY / 1000) * parallax);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [parallax]);

  const motionClass = reducedMotion
    ? ''
    : motion === 'float'
    ? 'animate-float-slow'
    : motion === 'float-reverse'
    ? 'animate-float-slow-reverse'
    : '';

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none select-none ${motionClass} ${className}`}
      style={{
        width: size,
        height: size,
        transform: `translateY(${offset}px) rotate(${rotate}deg) ${flip ? 'scaleX(-1)' : ''}`,
        transition: 'transform 100ms linear',
        ...style,
      }}
    >
      <svg viewBox="0 0 200 200" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* main sparkle burst */}
        <path
          d="M100 20 C104 70 108 92 158 100 C108 108 104 130 100 180 C96 130 92 108 42 100 C92 92 96 70 100 20 Z"
          fill="#D4A017"
        />
        {/* small secondary sparkle */}
        <path
          d="M148 34 C150 50 152 58 168 62 C152 66 150 74 148 90 C146 74 144 66 128 62 C144 58 146 50 148 34 Z"
          fill="#9B2242"
        />
        {/* confetti dots */}
        <circle cx="46" cy="42" r="6" fill="#E8871E" />
        <circle cx="162" cy="140" r="5" fill="#4E8F72" />
        <circle cx="58" cy="152" r="4" fill="#9B2242" />
      </svg>
    </div>
  );
};

export default FestiveSpark;
