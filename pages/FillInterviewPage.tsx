import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Image as ImageIcon, Sparkles, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../services/api';

const FillInterviewPage = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    
    const [formData, setFormData] = useState({
        name: '',
        role: '',
        image: '',
        questions: [
            { question: 'ספרי לנו קצת על עצמך ועל העשייה שלך?', answer: '' },
            { question: 'מהו המוטו שלך לחיים?', answer: '' },
            { question: 'מה נותן לך השראה בעיר שלנו?', answer: '' },
            { question: 'טיפ אחד לנשים שרוצות להתחיל להתנדב?', answer: '' }
        ]
    });

    useEffect(() => {
        if (token) {
            api.getInterviewByToken(token).then(data => {
                if (data.error) navigate('/');
                setLoading(false);
            }).catch(() => navigate('/'));
        }
    }, [token]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) return alert("התמונה גדולה מדי (עד 2MB)");
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => setFormData({ ...formData, image: reader.result as string });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.submitInterview(token!, formData);
            setSubmitted(true);
        } catch (err) {
            alert("שגיאה בשליחת השאלון");
        }
        setSubmitting(false);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-rose-500"><Loader2 className="animate-spin" size={40} /></div>;

    if (submitted) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
            <div className="bg-white p-10 rounded-[3rem] shadow-xl max-w-md space-y-4 animate-scale-in">
                <CheckCircle2 size={60} className="text-green-500 mx-auto" />
                <h2 className="text-2xl font-black text-slate-800">תודה רבה!</h2>
                <p className="text-slate-500">התשובות והתמונה שלך התקבלו בהצלחה. המנהלת תעלה אותן לאתר בקרוב.</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 md:px-8">
            <div className="max-w-2xl mx-auto bg-white rounded-[3rem] shadow-xl overflow-hidden animate-fade-in-up">
                <div className="bg-gradient-to-r from-rose-500 to-pink-600 p-10 text-white text-center space-y-2">
                    <Sparkles className="mx-auto mb-2" />
                    <h1 className="text-3xl font-black">שאלון אשת השבוע</h1>
                    <p className="opacity-90 font-medium text-sm">נבחרת להיות הלב הפועם של העיר לשבוע הקרוב!</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-8 text-right" dir="rtl">
                    <div className="space-y-4">
                        <label className="block font-black text-slate-700">פרטים אישיים</label>
                        <div className="grid md:grid-cols-2 gap-4">
                            <input required placeholder="שם מלא" className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-rose-100" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} />
                            <input required placeholder="עיסוק / תפקיד" className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-rose-100" value={formData.role} onChange={e=>setFormData({...formData, role: e.target.value})} />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="block font-black text-slate-700">תמונת פרופיל</label>
                        <div className="border-2 border-dashed border-rose-100 p-8 text-center relative rounded-3xl bg-rose-50/30">
                            <input type="file" required={!formData.image} onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                            {formData.image ? (
                                <img src={formData.image} className="h-32 w-32 object-cover mx-auto rounded-full border-4 border-white shadow-lg" />
                            ) : (
                                <div className="text-rose-400 flex flex-col items-center gap-2">
                                    <ImageIcon size={40}/>
                                    <span className="text-xs font-bold">לחצי להעלאת תמונה (עד 2MB)</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <label className="block font-black text-slate-700">הראיון</label>
                        {formData.questions.map((q, i) => (
                            <div key={i} className="space-y-2">
                                <p className="text-sm font-bold text-slate-600">{q.question}</p>
                                <textarea 
                                    required
                                    rows={3}
                                    placeholder="התשובה שלך..."
                                    className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-rose-100 resize-none"
                                    value={q.answer}
                                    onChange={e => {
                                        const newQs = [...formData.questions];
                                        newQs[i].answer = e.target.value;
                                        setFormData({...formData, questions: newQs});
                                    }}
                                />
                            </div>
                        ))}
                    </div>

                    <button 
                        type="submit" 
                        disabled={submitting}
                        className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-rose-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {submitting ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                        שליחת השאלון לאתר
                    </button>
                </form>
            </div>
        </div>
    );
};

export default FillInterviewPage;