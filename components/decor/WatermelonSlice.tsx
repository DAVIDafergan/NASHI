import React, { useEffect, useRef, useState } from 'react';

interface WatermelonSliceProps {
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
 * Flat, minimalist watermelon-slice SVG used purely as ambient decoration.
 * Motion is intentionally subtle (slow float + tiny rotation) and fully
 * disabled under prefers-reduced-motion.
 */
const WatermelonSlice: React.FC<WatermelonSliceProps> = ({
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
        {/* rind (green) */}
        <path d="M20 100 A80 80 0 0 1 180 100 Z" fill="#4E8F72" />
        {/* white pith ring */}
        <path d="M32 100 A68 68 0 0 1 168 100 Z" fill="#FFFBF7" />
        {/* flesh (red) */}
        <path d="M44 100 A56 56 0 0 1 156 100 Z" fill="#E85C5C" />
        {/* seeds */}
        <ellipse cx="80" cy="82" rx="4" ry="6" fill="#2E2E2E" transform="rotate(-20 80 82)" />
        <ellipse cx="120" cy="82" rx="4" ry="6" fill="#2E2E2E" transform="rotate(20 120 82)" />
        <ellipse cx="100" cy="60" rx="4" ry="6" fill="#2E2E2E" />
        <ellipse cx="65" cy="60" rx="3.5" ry="5.5" fill="#2E2E2E" transform="rotate(-15 65 60)" />
        <ellipse cx="135" cy="60" rx="3.5" ry="5.5" fill="#2E2E2E" transform="rotate(15 135 60)" />
      </svg>
    </div>
  );
};

export default WatermelonSlice;
