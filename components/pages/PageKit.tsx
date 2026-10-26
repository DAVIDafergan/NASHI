import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search, X } from 'lucide-react';
import { AnimatedHeadline } from '../home/HomeParts';

/**
 * Shared building blocks for the inner pages, so every page opens and behaves the same way:
 * editorial hero, pill filters, search field, empty state and loading skeletons.
 */

/** Soft decorative blobs behind a page hero. Purely visual. */
const HeroGlow: React.FC = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-20vw] -top-24 bottom-0 -z-10">
    <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-rose-200/40 blur-3xl animate-mesh-drift" />
    <div className="absolute top-10 left-[-4rem] h-64 w-64 rounded-full bg-champagne-200/50 blur-3xl animate-mesh-drift-slow" />
  </div>
);

export const PageHero: React.FC<{
  eyebrow: string;
  title: string;
  /** optional second line, shown in rose */
  accent?: string;
  subtitle?: React.ReactNode;
  back?: boolean;
  children?: React.ReactNode;
  className?: string;
}> = ({ eyebrow, title, accent, subtitle, back = true, children, className = '' }) => {
  const navigate = useNavigate();
  const lines = [{ text: title }];
  if (accent) lines.push({ text: accent, className: 'font-accent text-[1.15em] leading-[0.9] text-rose-600' } as any);
  return (
    <header className={`relative isolate pt-6 md:pt-12 pb-6 md:pb-10 ${className}`}>
      <HeroGlow />
      {back && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-rose-100 bg-white/80 px-3.5 py-1.5 text-[13px] text-slate-500 shadow-soft backdrop-blur transition hover:text-rose-700 hover:-translate-x-0.5"
        >
          <ArrowRight size={15} /> חזרה
        </button>
      )}
      <p className="eyebrow animate-fade-in-up">{eyebrow}</p>
      <AnimatedHeadline
        className="mt-2 text-[2.6rem] leading-[1.02] sm:text-[3.4rem] md:text-[4.4rem] text-ink"
        lines={lines}
      />
      {subtitle && (
        <p className="mt-4 max-w-xl text-[16px] md:text-[17px] leading-relaxed text-slate-500 animate-fade-in-up" style={{ animationDelay: '450ms' }}>
          {subtitle}
        </p>
      )}
      {children && <div className="mt-6 animate-fade-in-up" style={{ animationDelay: '600ms' }}>{children}</div>}
      <div className="mt-8 h-px origin-right bg-gradient-to-l from-rose-300 via-rose-200 to-transparent animate-line-grow" style={{ animationDelay: '500ms' }} />
    </header>
  );
};

/** Page wrapper: consistent gutters, width and RTL. */
export const PageShell: React.FC<{ children: React.ReactNode; className?: string; wide?: boolean }> = ({ children, className = '', wide = true }) => (
  <div dir="rtl" className={`w-full mx-auto px-4 sm:px-6 md:px-10 pb-28 text-right ${wide ? 'max-w-7xl' : 'max-w-3xl'} ${className}`}>
    {children}
  </div>
);

export const Chip: React.FC<{ active?: boolean; onClick?: () => void; children: React.ReactNode; icon?: React.ReactNode; tone?: 'rose' | 'sage' }> = ({ active, onClick, children, icon, tone = 'rose' }) => {
  const on = tone === 'sage' ? 'bg-sage-600 border-sage-600 text-white shadow-soft' : 'bg-rose-700 border-rose-700 text-white shadow-soft';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-[13.5px] transition-all duration-300 active:scale-95 ${
        active ? on : 'border-rose-100 bg-white/80 text-slate-600 hover:border-rose-300 hover:text-rose-700'
      }`}
    >
      {icon}
      {children}
    </button>
  );
};

export const ChipRow: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-2 overflow-x-auto no-scrollbar ${className}`}>{children}</div>
);

export const SearchField: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; className?: string }> = ({ value, onChange, placeholder = 'חיפוש…', className = '' }) => (
  <label className={`relative block ${className}`}>
    <span className="sr-only">{placeholder}</span>
    <Search size={17} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-rose-300" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-full border border-rose-100 bg-white/90 py-3 pr-11 pl-10 text-[15px] text-ink placeholder:text-slate-400 shadow-soft outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100/70"
    />
    {value && (
      <button type="button" aria-label="ניקוי" onClick={() => onChange('')} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700">
        <X size={15} />
      </button>
    )}
  </label>
);

/** Sticky glass bar for search + filters. */
export const FilterBar: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`sticky top-[4.5rem] md:top-24 z-30 -mx-4 sm:mx-0 mb-8 border-y sm:border border-rose-100/80 bg-[#FBF7F4]/85 backdrop-blur-xl px-4 py-3 sm:rounded-[1.75rem] sm:px-4 sm:shadow-soft ${className}`}>
    {children}
  </div>
);

export const EmptyState: React.FC<{ icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }> = ({ icon, title, text, action }) => (
  <div className="relative overflow-hidden rounded-[2rem] border border-dashed border-rose-200 bg-white/60 px-6 py-16 text-center animate-scale-in">
    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-400 animate-float-y">{icon}</div>
    <h3 className="text-xl text-ink">{title}</h3>
    {text && <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-slate-500">{text}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
);

/** Shimmering placeholder blocks while data loads. */
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`relative overflow-hidden rounded-2xl bg-rose-100/50 ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-l from-transparent via-white/60 to-transparent" />
    <style>{`@keyframes shimmer{100%{transform:translateX(100%)}}`}</style>
  </div>
);

export const CardSkeletonGrid: React.FC<{ count?: number; className?: string }> = ({ count = 6, className = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' }) => (
  <div className={`grid gap-6 ${className}`} aria-busy="true" aria-label="טוען">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-[1.75rem] border border-rose-100/70 bg-white p-2 shadow-petal">
        <Skeleton className="aspect-[4/3] rounded-[1.4rem]" />
        <div className="space-y-3 p-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-11 w-full rounded-full" />
        </div>
      </div>
    ))}
  </div>
);

export const PageLoading: React.FC<{ eyebrow?: string; title?: string }> = ({ eyebrow = 'רגע…', title = 'טוען…' }) => (
  <PageShell>
    <div className="pt-12 pb-10">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="mt-4 h-14 w-2/3 max-w-md" />
      <Skeleton className="mt-4 h-4 w-1/2 max-w-sm" />
      <span className="sr-only">{eyebrow} {title}</span>
    </div>
    <CardSkeletonGrid />
  </PageShell>
);

/** Bottom-sheet on mobile, centered dialog on desktop. */
export const Sheet: React.FC<{ open: boolean; onClose: () => void; children: React.ReactNode; maxWidth?: string; label?: string }> = ({ open, onClose, children, maxWidth = 'md:max-w-[520px]', label }) => {
  if (!open) return null;
  return createPortal(
    <div dir="rtl" role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[300] flex items-end md:items-center justify-center bg-plum-900/40 backdrop-blur-sm animate-fade-in md:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`relative w-full ${maxWidth} max-h-[92vh] overflow-y-auto no-scrollbar rounded-t-[2rem] md:rounded-[2rem] bg-white shadow-lift animate-slide-up`}>
        <div className="sticky top-0 z-10 mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-rose-100 md:hidden" />
        {children}
      </div>
    </div>,
    document.body
  );
};

/** Renders children at the end of <body>, outside the page's stacking context (for full-screen overlays). */
export const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => createPortal(children, document.body);

/** Small round icon button (close / share etc.) */
export const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }> = ({ label, className = '', children, ...rest }) => (
  <button type="button" aria-label={label} title={label} className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-soft backdrop-blur transition hover:bg-rose-700 hover:text-white active:scale-90 ${className}`} {...rest}>
    {children}
  </button>
);
