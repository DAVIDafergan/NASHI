import React, { useEffect, useRef, useState } from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  /** stagger delay in ms */
  delay?: number;
  as?: keyof JSX.IntrinsicElements;
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
const ScrollReveal: React.FC<ScrollRevealProps> = ({ children, className = '', delay = 0, as = 'div', ...rest }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Tag = as as any;

  return (
    <Tag
      ref={ref}
      className={`${visible ? 'animate-fade-in-up' : ''} ${className}`}
      style={visible ? { animationDelay: `${delay}ms` } : { opacity: 0, transform: 'translateY(16px)' }}
      {...rest}
    >
      {children}
    </Tag>
  );
};

export default ScrollReveal;
