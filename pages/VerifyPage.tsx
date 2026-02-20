import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { CheckCircle, XCircle, Loader2, Home } from 'lucide-react';
import { User } from '../types';

const VerifyPage: React.FC<{ user: User | null }> = ({ user }) => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [eventTitle, setEventTitle] = useState('');

  useEffect(() => {
    // 1. קודם כל נוודא שמי שסורק הוא מנהל בלבד
    if (!user || !user.isAdmin) {
      setStatus('error');
      setMessage('גישה למנהלים בלבד! אנא התחברי למערכת הניהול קודם.');
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
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-right" dir="rtl">
      
      {status === 'loading' && (
        <div className="flex flex-col items-center gap-4 text-slate-500">
          <Loader2 className="animate-spin text-indigo-500" size={60} />
          <h2 className="text-xl font-black">סורק נתונים, אנא המתיני...</h2>
        </div>
      )}

      {status === 'success' && (
        <div className="bg-emerald-50 border-4 border-emerald-500 p-8 md:p-12 rounded-[3rem] shadow-2xl flex flex-col items-center max-w-lg w-full text-center animate-fade-in-up">
          <CheckCircle className="text-emerald-500 mb-6" size={100} />
          <h1 className="text-4xl font-black text-emerald-700 mb-2">מאושר!</h1>
          <h2 className="text-xl font-bold text-emerald-900 mb-6">{message}</h2>
          {eventTitle && (
            <div className="bg-white px-6 py-3 rounded-2xl shadow-sm text-emerald-800 font-black mb-6 w-full">
              עבור אירוע: {eventTitle}
            </div>
          )}
          <button onClick={() => navigate('/admin')} className="mt-4 bg-emerald-600 text-white px-8 py-4 rounded-full font-black flex items-center gap-2 hover:bg-emerald-700 transition-colors w-full justify-center text-lg">
            <Home size={20} /> חזרה למערכת הניהול
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-rose-50 border-4 border-rose-500 p-8 md:p-12 rounded-[3rem] shadow-2xl flex flex-col items-center max-w-lg w-full text-center animate-fade-in-up">
          <XCircle className="text-rose-500 mb-6" size={100} />
          <h1 className="text-4xl font-black text-rose-700 mb-2">אזהרה: כניסה נדחתה!</h1>
          <h2 className="text-xl font-bold text-rose-900 mb-6">{message}</h2>
          <button onClick={() => navigate('/admin')} className="mt-4 bg-rose-600 text-white px-8 py-4 rounded-full font-black flex items-center gap-2 hover:bg-rose-700 transition-colors w-full justify-center text-lg">
            <Home size={20} /> חזרה למערכת הניהול
          </button>
        </div>
      )}
    </div>
  );
};

export default VerifyPage;