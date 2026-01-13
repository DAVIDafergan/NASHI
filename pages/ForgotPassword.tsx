import React, { useState } from 'react';
import { Mail, ArrowRight, Sparkles, Loader2, ChevronRight } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#fffcfc] via-[#fdf6ff] to-[#fffcfc] p-4 text-right" dir="rtl">
      <div className="bg-white/80 backdrop-blur-xl p-8 md:p-12 rounded-[3rem] shadow-2xl border border-white w-full max-w-md relative overflow-hidden">
        
        {/* קישוט עיצובי */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-rose-100/40 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 space-y-6">
          <Link to="/" className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-500 transition-colors text-xs font-bold">
            <ChevronRight size={14} /> חזרה לדף הבית
          </Link>

          <div className="space-y-2">
            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mb-4 shadow-inner">
              <Sparkles size={28} />
            </div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">שכחת סיסמה?</h2>
            <p className="text-slate-500 text-sm font-medium">אל דאגה, זה קורה לכולן. הזיני את המייל ונשלח לך לינק לשחזור מיידי.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-300" size={18} />
              <input
                required
                type="email"
                placeholder="כתובת המייל שלך"
                className="w-full pr-12 pl-4 py-4 bg-slate-50 border border-transparent focus:border-rose-200 rounded-2xl outline-none font-bold text-sm transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {status.message && (
              <div className={`p-4 rounded-2xl text-xs font-black text-center animate-fade-in ${
                status.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
              }`}>
                {status.message}
              </div>
            )}

            <button
              disabled={loading || status.type === 'success'}
              type="submit"
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-200 hover:bg-rose-500 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-slate-400"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>שלחי לי לינק לאיפוס <ArrowRight size={18} /></>
              )}
            </button>
          </form>

          <div className="pt-4 text-center">
            <p className="text-xs text-slate-400 font-bold">
              נזכרת בסיסמה?{' '}
              <button onClick={() => navigate('/')} className="text-rose-500 underline">לחצי כאן לחזרה</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;