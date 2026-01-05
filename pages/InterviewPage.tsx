import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sparkles, Send, Camera, CheckCircle, User, Briefcase, Heart } from 'lucide-react';
import { api } from '../services/api';
import { PersonalityProfile } from '../types';

const InterviewPage = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        const fetchInterview = async () => {
            if (!token) {
                setLoading(false);
                return;
            }
            
            try {
                const data = await api.getInterviewByToken(token);
                // בדיקה שהמידע תקין ולא מכיל שגיאה מהשרת
                if (data && !data.error) {
                    // מוודא שיש שדות בסיסיים אם הם לא קיימים בטיוטה
                    // מאפס את התשובות כך שהשדות תמיד יהיו ריקים בטעינה ראשונה
                    setProfile({
                        ...data,
                        name: data.name || '',
                        role: data.role || '',
                        motto: data.motto || '',
                        questions: (data.questions || []).map((q: any) => ({
                            ...q,
                            answer: '' // מאפס את התשובה לטקסט ריק
                        }))
                    });
                } else {
                    throw new Error("Invalid token data");
                }
            } catch (err) {
                console.error("Interview load error:", err);
                alert('הלינק אינו תקין, פג תוקף או שכבר נעשה בו שימוש.');
                navigate('/');
            } finally {
                setLoading(false);
            }
        };

        fetchInterview();
    }, [token, navigate]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.size <= 50 * 1024) {
            const reader = new FileReader();
            reader.onloadend = () => setProfile((prev: any) => prev ? ({ ...prev, image: reader.result as string }) : null);
            reader.readAsDataURL(file);
        } else if (file) {
            alert('התמונה גדולה מדי! מקסימום 50KB.');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (token && profile) {
            try {
                await api.submitInterview(token, profile);
                setSubmitted(true);
            } catch (err) {
                alert('שגיאה בשליחת הראיון. ודאי שהתמונה קטנה מ-50KB.');
            }
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-center space-y-4">
                <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="font-black text-rose-500">טוען שאלון אישי...</p>
            </div>
        </div>
    );

    if (submitted) return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-6 bg-slate-50" dir="rtl">
            <div className="bg-white p-12 rounded-[4rem] shadow-2xl space-y-6 max-w-lg border border-emerald-100">
                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle size={48} />
                </div>
                <h1 className="text-4xl font-black text-slate-900">הראיון נשלח!</h1>
                <p className="text-xl text-slate-500 font-bold leading-relaxed">
                    תודה רבה על השיתוף. התשובות והתמונה שלך הועברו למנהלת האתר לאישור סופי לפני הפרסום.
                </p>
                <button onClick={() => navigate('/')} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black hover:bg-rose-600 transition-all shadow-lg">חזרה לדף הבית</button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 md:px-8 text-right font-sans" dir="rtl">
            <div className="max-w-3xl mx-auto bg-white rounded-[4rem] shadow-2xl overflow-hidden border border-rose-100">
                
                {/* Header */}
                <div className="bg-gradient-to-l from-rose-500 to-pink-600 p-12 text-white space-y-4 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -ml-32 -mt-32"></div>
                    <Sparkles size={40} className="text-rose-200 animate-pulse relative z-10" />
                    <h1 className="text-4xl md:text-5xl font-black relative z-10">נבחרת לאשת השבוע!</h1>
                    <p className="text-rose-100 text-lg font-bold relative z-10">נשמח שתשתפי אותנו בסיפור שלך כדי שנוכל להאיר את הקהילה.</p>
                </div>

                <form onSubmit={handleSubmit} className="p-10 md:p-16 space-y-12">
                    
                    {/* פרטים אישיים */}
                    <div className="space-y-8">
                        <h3 className="text-2xl font-black text-slate-800 border-r-4 border-rose-500 pr-4">פרטים אישיים</h3>
                        
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 font-black text-slate-700"><User size={18} className="text-rose-500"/> שם מלא:</label>
                                <input 
                                    required 
                                    className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent outline-none focus:border-rose-200 focus:bg-white font-bold transition-all"
                                    value={profile?.name} 
                                    onChange={e => setProfile({...profile, name: e.target.value})} 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 font-black text-slate-700"><Briefcase size={18} className="text-rose-500"/> מה את עושה בחיים?</label>
                                <input 
                                    required 
                                    className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent outline-none focus:border-rose-200 focus:bg-white font-bold transition-all"
                                    value={profile?.role} 
                                    onChange={e => setProfile({...profile, role: e.target.value})} 
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="flex items-center gap-2 font-black text-slate-700"><Heart size={18} className="text-rose-500"/> המוטו שלך לחיים:</label>
                            <input 
                                required 
                                placeholder="למשל: 'הכל אפשרי למי שמאמינה'"
                                className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-transparent outline-none focus:border-rose-200 focus:bg-white font-bold italic transition-all"
                                value={profile?.motto} 
                                onChange={e => setProfile({...profile, motto: e.target.value})} 
                            />
                        </div>
                    </div>

                    {/* צילום תמונה */}
                    <div className="space-y-6">
                        <h3 className="text-2xl font-black text-slate-800 border-r-4 border-rose-500 pr-4">תמונת פרופיל לכתבה</h3>
                        <div className="relative group mx-auto w-48 h-48">
                            <input type="file" required onChange={handleFileUpload} className="absolute inset-0 opacity-0 z-20 cursor-pointer" />
                            <div className="w-48 h-48 bg-slate-50 rounded-[3.5rem] border-4 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 overflow-hidden relative group-hover:bg-slate-100 transition-all shadow-inner">
                                {profile?.image ? (
                                    <img src={profile.image} className="w-full h-full object-cover" alt="תצוגה" />
                                ) : (
                                    <>
                                        <Camera size={40} />
                                        <span className="text-xs font-black mt-2">לחצי להעלאה</span>
                                        <span className="text-[10px] font-bold">עד 50KB</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* שאלות דינמיות */}
                    <div className="space-y-10">
                        <h3 className="text-2xl font-black text-slate-800 border-r-4 border-rose-500 pr-4">השאלון האישי שלך</h3>
                        {profile?.questions?.map((q: any, i: number) => (
                            <div key={i} className="space-y-4 animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                                <label className="block font-black text-slate-700 text-xl">
                                    <span className="text-rose-500 ml-2">{i + 1}.</span> {q.question}
                                </label>
                                <textarea
                                    required
                                    className="w-full p-6 bg-slate-50 rounded-[2rem] border-2 border-transparent outline-none focus:border-rose-200 focus:bg-white transition-all min-h-[150px] font-bold text-lg resize-none shadow-inner"
                                    placeholder="כתבי כאן את תשובתך המלאה..."
                                    value={q.answer}
                                    onChange={(e) => {
                                        const newQs = [...(profile.questions || [])];
                                        newQs[i].answer = e.target.value;
                                        setProfile({ ...profile, questions: newQs });
                                    }}
                                />
                            </div>
                        ))}
                    </div>

                    {/* כפתור שליחה */}
                    <div className="pt-6">
                        <button type="submit" className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-2xl shadow-xl hover:bg-rose-600 hover:-translate-y-1 transition-all flex items-center justify-center gap-4 group">
                            <Send size={28} className="group-hover:translate-x-[-8px] transition-transform rotate-180" /> שליחת הראיון לאישור המנהלת
                        </button>
                        <p className="text-center text-slate-400 text-sm font-bold mt-6 tracking-wide">בלחיצה על שליחה, את מאשרת את פרסום התשובות והתמונה באתר.</p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InterviewPage;