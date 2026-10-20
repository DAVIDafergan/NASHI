import React from 'react';

/** Centered glass card on a soft animated backdrop — used by the password/verify pages. */
const AuthShell: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div dir="rtl" className="relative isolate flex min-h-[85vh] items-center justify-center overflow-hidden px-4 py-12 text-right">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute top-[8%] right-[10%] h-72 w-72 rounded-full bg-rose-200/50 blur-3xl animate-mesh-drift" />
      <div className="absolute bottom-[6%] left-[8%] h-80 w-80 rounded-full bg-champagne-200/50 blur-3xl animate-mesh-drift-slow" />
    </div>
    <div className={`relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white bg-white/85 p-8 shadow-lift backdrop-blur-xl md:p-10 animate-scale-in ${className}`}>
      {children}
    </div>
  </div>
);

export const authInputCls =
  'w-full rounded-2xl border border-rose-100 bg-rose-50/30 px-4 py-3.5 text-[15px] outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-100/70';

export default AuthShell;
