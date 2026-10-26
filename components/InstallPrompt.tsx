import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { BRAND } from '../shared/brand';

/** Android/Chrome "add to home screen" invitation. Shows once a visitor is engaged (2nd visit or 40s), never after dismissal. */
const InstallPrompt: React.FC = () => {
  const [evt, setEvt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let visits = 0;
    try {
      if (localStorage.getItem('nashi-install-dismissed')) return;
      visits = Number(localStorage.getItem('nashi-visits') || '0') + 1;
      localStorage.setItem('nashi-visits', String(visits));
    } catch { /* ignore */ }
    let timer = 0;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e);
      timer = window.setTimeout(() => setShow(true), visits >= 2 ? 6000 : 40000);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.clearTimeout(timer); };
  }, []);

  if (!show || !evt) return null;
  const dismiss = () => { setShow(false); try { localStorage.setItem('nashi-install-dismissed', '1'); } catch { /* ignore */ } };
  const install = async () => {
    evt.prompt();
    try { await evt.userChoice; } catch { /* ignore */ }
    dismiss();
  };

  return (
    <div className="fixed inset-x-3 bottom-[88px] z-[80] mx-auto max-w-md rounded-[1.6rem] border border-rose-100 bg-white/95 p-4 shadow-lift backdrop-blur animate-fade-in-up md:bottom-6" dir="rtl">
      <div className="flex items-center gap-3">
        <img src="/icon-192.png" alt="" className="h-12 w-12 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <p className="font-strong text-ink">{BRAND.name} על המסך הראשי</p>
          <p className="text-xs text-slate-500">פתיחה בלחיצה, כמו אפליקציה. בלי הורדה מהחנות.</p>
        </div>
        <button onClick={dismiss} aria-label="סגירה" className="self-start rounded-full p-1 text-slate-400 hover:text-rose-600"><X size={16} /></button>
      </div>
      <button onClick={install} className="btn-primary mt-3 w-full"><Download size={16} /> הוספה למסך הבית</button>
    </div>
  );
};

export default InstallPrompt;
