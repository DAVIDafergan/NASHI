import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Sparkles, Send, Camera, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import { PersonalityProfile } from '../types';

const InterviewPage = () => {
    const { token } = useParams<{ token: string }>();
    const [profile, setProfile] = useState<Partial<PersonalityProfile> | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (token) {
            api.getInterviewByToken(token)
                .then(setProfile)
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [token]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.size <= 50 * 1024) {
            const reader = new FileReader();
            reader.onloadend = () => setProfile(prev => prev ? ({ ...prev, image: reader.result as string }) : null);
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
                alert('שגיאה בשליחת הראיון');
            }
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-rose-500">טוען שאלון...</div>;
    if (submitted) return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-6 bg-slate-50">
            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
                <CheckCircle size={48} />
            </div>
            <h1 className="text-4xl font-black text-slate-900">תודה רבה!</h1>
            <p className="text-xl text-slate-500 font-bold">התשובות שלך נשלחו למערכת ויופיעו באתר לאחר אישור המנהלת.</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 md:px-8">
            <div className="max-w-3xl mx-auto bg-white rounded-[4rem] shadow-2xl overflow-hidden border border-rose-100">
                <div className="bg-rose-500 p-12 text-white text-right space-y-4">
                    <Sparkles size={40} className="text-rose-200 animate-pulse" />
                    <h1 className="text-4xl font-black">נבחרת לאשת השבוע!</h1>
                    <p className="text-rose-100 text-lg font-bold">נשמח שתשתפי אותנו בסיפור שלך כדי שנוכל להאיר את הקהילה.</p>
                </div>

                <form onSubmit={handleSubmit} className="p-10 md:p-16 space-y-10 text-right">
                    <div className="space-y-6">
                        <h3 className="text-2xl font-black text-slate-800">קצת עלייך</h3>
                        <div className="relative group mx-auto w-40 h-40">
                            <input type="file" onChange={handleFileUpload} className="absolute inset-0 opacity-0 z-10 cursor-pointer" />
                            <div className="w-40 h-40 bg-slate-100 rounded-[3rem] border-4 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 overflow-hidden relative">
                                {profile?.image ? (
                                    <img src={profile.image} className="w-full h-full object-cover" />
                                ) : (
                                    <>
                                        <Camera size={32} />
                                        <span className="text-[10px] font-bold mt-2">העלאת תמונה</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {profile?.questions?.map((q, i) => (
                            <div key={i} className="space-y-3">
                                <label className="block font-black text-slate-700 text-lg">
                                    <span className="text-rose-500 ml-2">{i + 1}.</span> {q.question}
                                </label>
                                <textarea
                                    required
                                    className="w-full p-5 bg-slate-50 rounded-3xl border-none outline-none focus:ring-4 focus:ring-rose-100 transition-all min-h-[120px] font-bold resize-none"
                                    placeholder="כתבי כאן את תשובתך..."
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

                    <button type="submit" className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-xl hover:bg-rose-600 transition-all flex items-center justify-center gap-4 group">
                        <Send size={24} className="group-hover:translate-x-[-4px] transition-transform" /> שליחת הראיון
                    </button>
                </form>
            </div>
        </div>
    );
};

export default InterviewPage;