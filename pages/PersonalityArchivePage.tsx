import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Quote, Calendar, Heart, MessageSquare, Briefcase } from 'lucide-react';
import { api } from '../services/api';

const PersonalityArchivePage = () => {
    const navigate = useNavigate();
    const [personalities, setPersonalities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    // המדינה הזו עכשיו מחזיקה את האישה שמוצגת כרגע בראש הדף
    const [displayUser, setDisplayUser] = useState<any>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const data = await api.getAllPersonalities();
                // מיון: קודם כל מי ש-isActive, ואז לפי תאריך עדכון
                const sorted = data.sort((a: any, b: any) => {
                    if (a.isActive) return -1;
                    if (b.isActive) return 1;
                    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                });
                setPersonalities(sorted);
                
                // כברירת מחדל, נציג בראש הדף את האישה הפעילה/אחרונה
                if (sorted.length > 0) {
                    setDisplayUser(sorted[0]);
                }
            } catch (err) {
                console.error("Error loading archive:", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // פונקציה להחלפת התצוגה בראש הדף
    const handleSelectFromArchive = (p: any) => {
        setDisplayUser(p);
        // גלילה חלקה לראש הדף כדי לראות את הבחירה
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-rose-50/30">
            <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
        </div>
    );

    // רשימת הארכיון היא כל מי שלא מוצג כרגע בראש הדף
    const archiveList = personalities.filter(p => p._id !== displayUser?._id);

    return (
        <div className="min-h-screen bg-gradient-to-b from-rose-50/50 via-white to-white pb-20 pt-6 px-4 md:px-8 text-right font-sans" dir="rtl">
            
            {/* Header */}
            <div className="max-w-5xl mx-auto flex items-center justify-between mb-8">
                <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full shadow-sm text-slate-400 hover:text-rose-500 transition-colors border border-rose-50">
                    <ArrowLeft size={20} />
                </button>
                <div className="text-right">
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">נשות המעגל</h1>
                    <p className="text-[10px] md:text-sm text-rose-400 font-bold uppercase tracking-widest">מקום להשראה וחיבור נשי</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto space-y-16">
                
                {/* תצוגה ראשית - האישה הנבחרת */}
                {displayUser && (
                    <section className="animate-fade-in space-y-10">
                        {/* כרטיס פרופיל ראשי */}
                        <div className="text-center space-y-6">
                            <div className="relative inline-block">
                                <img 
                                    src={displayUser.image} 
                                    className="w-40 h-40 md:w-56 md:h-56 rounded-[3rem] mx-auto object-cover shadow-2xl border-4 border-white transition-all duration-500" 
                                    alt={displayUser.name} 
                                />
                                <div className="absolute -bottom-2 -right-2 bg-rose-500 p-3 rounded-2xl text-white shadow-lg shadow-rose-200">
                                    <Sparkles size={20} />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-3xl md:text-5xl font-black text-slate-800">{displayUser.name}</h2>
                                <div className="flex items-center justify-center gap-2 text-rose-400 font-bold">
                                    <Briefcase size={16} />
                                    <p className="text-base md:text-lg">{displayUser.role}</p>
                                </div>
                                {displayUser.motto && (
                                    <div className="pt-4 max-w-lg mx-auto">
                                        <p className="text-xl md:text-2xl italic text-slate-500 font-serif leading-relaxed">
                                            <Quote size={20} className="inline ml-2 opacity-20 rotate-180" />
                                            {displayUser.motto}
                                            <Quote size={20} className="inline mr-2 opacity-20" />
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* שאלות ותשובות */}
                        <div className="grid gap-6">
                            {displayUser.questions?.map((q: any, i: number) => q.answer && (
                                <div key={i} className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-rose-50 hover:border-rose-100 transition-all animate-fade-in-up" style={{animationDelay: `${i*0.1}s`}}>
                                    <div className="flex items-start gap-4">
                                        <div className="p-2 bg-rose-50 rounded-xl text-rose-500 shrink-0">
                                            <MessageSquare size={20} />
                                        </div>
                                        <div className="space-y-2">
                                            <h5 className="font-black text-slate-800 text-lg md:text-xl leading-tight">{q.question}</h5>
                                            <p className="text-slate-600 text-sm md:text-base leading-relaxed whitespace-pre-wrap">{q.answer}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <hr className="border-rose-100/50" />

                {/* שורת ארכיון - נשות המעגל הקודמות */}
                {archiveList.length > 0 && (
                    <section className="space-y-8">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-xl font-black text-slate-700 flex items-center gap-2">
                                <Calendar size={20} className="text-rose-400" /> נשים נוספות מהמעגל
                            </h3>
                        </div>
                        
                        {/* גריד של כרטיסים קטנים */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                            {archiveList.map((p) => (
                                <div 
                                    key={p._id} 
                                    onClick={() => handleSelectFromArchive(p)}
                                    className="bg-white/70 backdrop-blur-sm rounded-[2rem] p-4 shadow-sm border border-white hover:shadow-xl hover:border-rose-200 transition-all cursor-pointer group active:scale-95 text-center flex flex-col items-center"
                                >
                                    <div className="relative mb-3">
                                        <img 
                                            src={p.image} 
                                            className="w-20 h-20 md:w-24 md:h-24 rounded-[1.5rem] object-cover grayscale group-hover:grayscale-0 transition-all duration-500 shadow-md" 
                                            alt={p.name} 
                                        />
                                    </div>
                                    <h4 className="font-black text-slate-800 text-sm md:text-base line-clamp-1">{p.name}</h4>
                                    <p className="text-[10px] text-rose-400 font-bold line-clamp-1">{p.role}</p>
                                    <button className="mt-3 text-[9px] font-black text-slate-400 group-hover:text-rose-500 uppercase tracking-tighter transition-colors">
                                        צפייה בראיון
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* Footer עדין */}
            <div className="max-w-lg mx-auto text-center mt-20 opacity-30">
                <Heart size={20} className="mx-auto text-rose-400 mb-2" />
                <p className="text-[10px] font-bold text-slate-400">מעגל נשי - מקום שלכן ועבורכן</p>
            </div>
        </div>
    );
};

export default PersonalityArchivePage;