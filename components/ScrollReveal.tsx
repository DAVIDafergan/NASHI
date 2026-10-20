import React, { useEffect, useRef, useState } from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  /** stagger delay in ms */
  delay?: number;
  as?: keyof JSX.IntrinsicElements;
  /** 'fade-in-up' (default, subtle upward slide) or 'fade-in-fast' (plain opacity fade, no movement, 200ms) */
  animation?: 'fade-in-up' | 'fade-in-fast' | 'blur-in' | 'scale-in' | 'clip-up' | 'word-rise';
  [key: string]: any;
}

/**
 * Reveals its children with a fade-up animation once they enter the
 * viewport. Before the intersection fires, the hidden state is applied
 * only via inline style (never a static class), so if the browser has
 * prefers-reduced-motion enabled — which strips the `animation` property
 * globally — the content still becomes visible immediately instead of
 * staying stuck invisible.
 */
const ScrollReveal: React.FC<ScrollRevealProps> = ({ children, className = '', delay = 0, as = 'div', animation = 'fade-in-up', ...rest }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Phones: one short opacity fade that starts *before* the element scrolls into view,
  // so content never "jumps" or arrives late while the finger is still scrolling.
  const [isPhone] = useState(() => typeof window !== 'undefined' && (window.matchMedia?.('(max-width: 767px)').matches || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (isPhone) {
      // already on screen at load → show immediately, no animation at all
      const r = node.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) { setVisible(true); return; }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      isPhone ? { threshold: 0, rootMargin: '0px 0px 25% 0px' } : { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Tag = as as any;
  if (isPhone) {
    return (
      <Tag ref={ref} className={`${visible ? 'animate-fade-in-fast' : ''} ${className}`} style={visible ? { animationDelay: `${Math.min(delay, 160) / 2}ms` } : { opacity: 0 }} {...rest}>
        {children}
      </Tag>
    );
  }
  const hiddenStyle: React.CSSProperties =
    animation === 'fade-in-fast' || animation === 'blur-in' ? { opacity: 0 }
    : animation === 'clip-up' ? { opacity: 0 } // clip-path here would hide it from IntersectionObserver
    : animation === 'scale-in' ? { opacity: 0, transform: 'scale(0.94)' }
    : { opacity: 0, transform: 'translateY(16px)' };

  return (
    <Tag
      ref={ref}
      className={`${visible ? `animate-${animation}` : ''} ${className}`}
      style={visible ? { animationDelay: `${delay}ms` } : hiddenStyle}
      {...rest}
    >
      {children}
    </Tag>
  );
};

export default ScrollReveal;
