import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, CheckCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import AuthShell, { authInputCls } from '../components/pages/AuthShell';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setStatus({ type: 'error', message: 'הסיסמאות אינן תואמות' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`https://nashi-production.up.railway.app/api/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', message: 'הסיסמה עודכנה בהצלחה! מיד תועברי להתחברות...' });
        setTimeout(() => navigate('/'), 3000);
      } else {
        setStatus({ type: 'error', message: data.error || 'חלה שגיאה באיפוס הסיסמה' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'שגיאה בחיבור לשרת' });
    }
    setLoading(false);
  };

  return (
    <AuthShell>
      <div className="mb-6 space-y-2 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600 animate-float-y">
          <ShieldCheck size={26} />
        </div>
        <p className="eyebrow">סיסמה חדשה</p>
        <h1 className="text-[2.3rem] leading-[1.05]">איפוס סיסמה</h1>
        <p className="text-[15px] text-slate-500">בחרי סיסמה חדשה ומאובטחת.</p>
      </div>
      {status.type === 'success' ? (
        <div role="status" className="space-y-3 rounded-2xl border border-sage-100 bg-sage-50 p-6 text-center animate-bounce-in">
          <CheckCircle className="mx-auto text-sage-500" size={40} />
          <p className="text-[15px] text-sage-800">{status.message}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="relative block">
            <span className="sr-only">סיסמה חדשה</span>
            <Lock className="absolute top-1/2 right-4 -translate-y-1/2 text-rose-300" size={17} />
            <input required type="password" autoComplete="new-password" placeholder="סיסמה חדשה" className={`${authInputCls} pr-12`} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="relative block">
            <span className="sr-only">אימות סיסמה</span>
            <Lock className="absolute top-1/2 right-4 -translate-y-1/2 text-rose-300" size={17} />
            <input required type="password" autoComplete="new-password" placeholder="אימות סיסמה" className={`${authInputCls} pr-12`} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </label>
          {status.type === 'error' && <p role="alert" className="text-center text-[14px] text-rose-700">{status.message}</p>}
          <button disabled={loading} type="submit" className="btn-primary w-full !py-4 !text-base disabled:opacity-60">
            {loading ? 'מעדכנת…' : 'עדכון סיסמה וכניסה'}
          </button>
        </form>
      )}
    </AuthShell>
  );
};

export default ResetPassword;
