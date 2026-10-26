import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Store, X } from 'lucide-react';
import { BRAND } from '../shared/brand';

const KEY = 'nashi-supplier-banner-closed';
const HIDE_ON = ['/admin', '/suppliers', '/interview', '/verify', '/reset-password', '/forgot-password'];

/** Site-wide call to action for suppliers ("זה יעלה כסף" — the paid directory). Dismissible for 30 days. */
const SupplierBanner: React.FC = () => {
  const { pathname } = useLocation();
  const [closed, setClosed] = useState(() => { try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < 30 * 864e5; } catch { return false; } });
  if (closed || HIDE_ON.some(p => pathname.startsWith(p))) return null;
  const close = () => { setClosed(true); try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } };
  return (
    <aside dir="rtl" aria-label="הצטרפות ספקים" className="relative mx-auto mt-10 w-full max-w-7xl px-4 md:mt-14 md:px-8">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-ink px-5 py-6 text-white shadow-lift md:flex md:items-center md:gap-6 md:px-9 md:py-7">
        <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full bg-rose-500/30 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-1/3 h-56 w-56 rounded-full bg-champagne-300/20 blur-3xl" />
        <span className="relative hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-rose-200 md:flex"><Store size={26} /></span>
        <div className="relative min-w-0 flex-1 pl-8 md:pl-0">
          <p className="font-accent text-[20px] leading-none text-rose-200">לספקים ולנותני שירות</p>
          <h2 className="mt-1.5 text-[1.45rem] leading-tight !text-white md:text-[1.9rem]">ספקים? הצטרפו למאגר הספקים של {BRAND.name}</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-white/75 md:text-[15px]">מנהלי התרבות שלנו בכל הארץ מחפשים מרצים, מופעים, הצגות, סדנאות, קייטרינג, הגברה ועוד.</p>
        </div>
        <Link to="/suppliers/join" className="relative mt-4 inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-[15px] font-strong text-rose-800 transition hover:bg-rose-50 active:scale-[0.98] md:mt-0 md:w-auto">
          להצטרפות למאגר <ArrowLeft size={16} />
        </Link>
        <button onClick={close} aria-label="סגירה" className="absolute left-3 top-3 rounded-full p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"><X size={16} /></button>
      </div>
    </aside>
  );
};

export default SupplierBanner;
