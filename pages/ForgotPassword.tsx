import React, { useState } from 'react';
import { Mail, ArrowRight, Sparkles, Loader2, ChevronRight } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import AuthShell, { authInputCls } from '../components/pages/AuthShell';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: null, message: '' });

    try {
      const res = await fetch('https://nashi-production.up.railway.app/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await res.json();

      if (res.ok) {
        setStatus({ 
          type: 'success', 
          message: 'שלחנו לך לינק לאיפוס! בדקי את תיבת המייל שלך (וגם בספאם).' 
        });
      } else {
        setStatus({ 
          type: 'error', 
          message: data.error || 'המייל לא נמצא במערכת, וודאי שהקלדת נכון.' 
        });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'שגיאה בחיבור לשרת. נסי שוב מאוחר יותר.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-[13px] text-slate-400 transition-colors hover:text-rose-700">
        <ChevronRight size={14} /> חזרה לדף הבית
      </Link>

      <div className="mb-6 space-y-2">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600 animate-float-y">
          <Sparkles size={26} />
        </div>
        <p className="eyebrow">שחזור סיסמה</p>
        <h1 className="text-[2.3rem] leading-[1.05]">שכחת סיסמה?</h1>
        <p className="text-[15px] leading-relaxed text-slate-500">זה קורה לכולן. כתבי את המייל ונשלח לך קישור לאיפוס.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="relative block">
          <span className="sr-only">כתובת המייל</span>
          <Mail className="absolute top-1/2 right-4 -translate-y-1/2 text-rose-300" size={18} />
          <input
            required
            type="email"
            autoComplete="email"
            placeholder="כתובת המייל שלך"
            className={`${authInputCls} pr-12`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        {status.message && (
          <div role="status" className={`rounded-2xl p-4 text-center text-[14px] animate-fade-in ${
            status.type === 'success' ? 'bg-sage-50 text-sage-700 border border-sage-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
          }`}>
            {status.message}
          </div>
        )}

        <button
          disabled={loading || status.type === 'success'}
          type="submit"
          className="btn-primary w-full !py-4 !text-base disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : (
            <>שלחי לי קישור לאיפוס <ArrowRight size={18} className="rotate-180" /></>
          )}
        </button>
      </form>

      <p className="pt-6 text-center text-[13.5px] text-slate-500">
        נזכרת בסיסמה?{' '}
        <button onClick={() => navigate('/')} className="text-rose-700 underline underline-offset-4">חזרה להתחברות</button>
      </p>
    </AuthShell>
  );
};

export default ForgotPassword;
