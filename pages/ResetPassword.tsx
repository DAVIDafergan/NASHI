import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, CheckCircle, ArrowLeft, ShieldCheck } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#fffcfc] via-[#fdf6ff] to-[#fffcfc] p-4 text-right" dir="rtl">
      <div className="bg-white/80 backdrop-blur-xl p-8 md:p-12 rounded-[3rem] shadow-2xl border border-white w-full max-w-md relative">
        <div className="relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">איפוס סיסמה</h2>
            <p className="text-slate-500 text-sm font-medium">הזיני סיסמה חדשה ומאובטחת.</p>
          </div>
          {status.type === 'success' ? (
            <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl text-center space-y-3">
              <CheckCircle className="text-emerald-500 mx-auto" size={40} />
              <p className="text-emerald-800 font-bold text-sm">{status.message}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input required type="password" placeholder="סיסמה חדשה" className="w-full p-4 bg-slate-50 border border-transparent focus:border-rose-200 rounded-2xl outline-none font-bold text-sm" value={password} onChange={(e) => setPassword(e.target.value)} />
              <input required type="password" placeholder="אימות סיסמה" className="w-full p-4 bg-slate-50 border border-transparent focus:border-rose-200 rounded-2xl outline-none font-bold text-sm" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              {status.type === 'error' && <p className="text-rose-500 text-xs font-black text-center">{status.message}</p>}
              <button disabled={loading} type="submit" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-rose-500 transition-all">
                {loading ? 'מעדכן...' : 'עדכני סיסמה וכנסי'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;