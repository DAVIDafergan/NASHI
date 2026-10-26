import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { CheckCircle, XCircle, Loader2, Home } from 'lucide-react';
import { User } from '../types';
import AuthShell from '../components/pages/AuthShell';

const VerifyPage: React.FC<{ user: User | null }> = ({ user }) => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [eventTitle, setEventTitle] = useState('');

  useEffect(() => {
    // 1. קודם כל נוודא שמי שסורק הוא מנהל בלבד
    if (!user || !(user.isAdmin || (user as any).role === 'regionAdmin')) {
      setStatus('error');
      setMessage('גישה למנהלים בלבד! יש להתחבר למערכת הניהול קודם.');
      return;
    }

    // 2. אם מנהלת התחברה, נבצע קריאת API לאימות הכרטיס
    if (code) {
      api.verifyTicket(code)
        .then((res) => {
          setStatus('success');
          setMessage(res.message || 'כניסה אושרה בהצלחה!');
          setEventTitle(res.eventTitle || '');
        })
        .catch((err) => {
          setStatus('error');
          setMessage(err.message || 'כרטיס שגוי או כבר נוצל!');
        });
    } else {
        setStatus('error');
        setMessage('קוד ברקוד חסר.');
    }
  }, [code, user]);

  return (
    <AuthShell className="!max-w-lg text-center">
      {status === 'loading' && (
        <div className="flex flex-col items-center gap-4 py-8 text-slate-500" role="status">
          <Loader2 className="animate-spin text-rose-500" size={56} />
          <p className="font-display text-[1.6rem] text-ink">סורק את הכרטיס…</p>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center animate-fade-in-up">
          <div className="relative mb-6">
            <span className="absolute inset-0 rounded-full bg-sage-300/50 animate-ping" aria-hidden="true" />
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-sage-500 text-white shadow-lift animate-bounce-in">
              <CheckCircle size={60} />
            </div>
          </div>
          <p className="font-accent text-[1.6rem] text-sage-600">הכניסה אושרה</p>
          <h1 className="mt-1 text-[2.8rem] leading-none !text-sage-800">מאושר!</h1>
          <p className="mt-3 text-[16px] text-slate-600">{message}</p>
          {eventTitle && (
            <div className="mt-5 w-full rounded-2xl border border-sage-100 bg-sage-50 px-6 py-3 text-[15px] text-sage-800 font-strong">
              אירוע: {eventTitle}
            </div>
          )}
          <button onClick={() => navigate('/admin')} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-sage-600 px-8 py-4 text-[16px] text-white transition hover:bg-sage-700 font-strong">
            <Home size={19} /> חזרה למערכת הניהול
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center animate-fade-in-up">
          <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-red-500 text-white shadow-lift animate-bounce-in">
            <XCircle size={60} />
          </div>
          <p className="font-accent text-[1.6rem] text-red-500">שימו לב</p>
          <h1 className="mt-1 text-[2.4rem] leading-tight !text-red-700">הכניסה נדחתה</h1>
          <p className="mt-3 text-[16px] text-slate-600">{message}</p>
          <button onClick={() => navigate('/admin')} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-rose-700 px-8 py-4 text-[16px] text-white transition hover:bg-rose-800 font-strong">
            <Home size={19} /> חזרה למערכת הניהול
          </button>
        </div>
      )}
    </AuthShell>
  );
};

export default VerifyPage;
