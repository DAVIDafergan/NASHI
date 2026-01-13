import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, CheckCircle, ArrowLeft, ShieldCheck } from 'lucide-react';

const ResetPassword = () => {
  const { token } = useParams(); // שליפת הטוקן מהכתובת
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
        setTimeout(() => navigate('/'), 3000); // חזרה לדף הבית אחרי 3 שניות
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
      <div className="bg-white/80 backdrop-blur-xl p-8 md:p-12 rounded-[3rem] shadow-2xl border border-white w-full max-w-md relative overflow-hidden">
        {/* אלמנט עיצובי ברקע */}
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-rose-100/50 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 space-y-6">
          <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto mb-2 shadow-inner">
            <ShieldCheck size={32} />
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">איפוס סיסמה</h2>
            <p className="text-slate-500 text-sm font-medium px-4">הזיני סיסמה חדשה ומאובטחת כדי שתוכלי לחזור למעגל.</p>
          </div>

          {status.type === 'success' ? (
            <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl text-center space-y-3 animate-fade-in">
              <CheckCircle className="text-emerald-500 mx-auto" size={40} />
              <p className="text-emerald-800 font-bold text-sm">{status.message}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Lock className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  required
                  type="password"
                  placeholder="סיסמה חדשה"
                  className="w-full pr-12 pl-4 py-4 bg-slate-50 border border-transparent focus:border-rose-200 rounded-2xl outline-none font-bold text-sm transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="relative">
                <Lock className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  required
                  type="password"
                  placeholder="אימות סיסמה חדשה"
                  className="w-full pr-12 pl-4 py-4 bg-slate-50 border border-transparent focus:border-rose-200 rounded-2xl outline-none font-bold text-sm transition-all"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              {status.type === 'error' && (
                <p className="text-rose-500 text-xs font-black text-center animate-shake">{status.message}</p>
              )}

              <button
                disabled={loading}
                type="submit"
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-200 hover:bg-rose-500 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {loading ? 'מעדכן...' : 'עדכני סיסמה וכנסי'}
              </button>
            </form>
          )}

          <button 
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-2 text-slate-400 text-xs font-bold hover:text-slate-600 transition-colors"
          >
            <ArrowLeft size={14} /> חזרה לדף הבית
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;