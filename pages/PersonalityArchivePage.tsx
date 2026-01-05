import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Quote, Calendar, X, Heart, MessageSquare } from 'lucide-react';
import { api } from '../services/api';

const PersonalityArchivePage = () => {
    const navigate = useNavigate();
    const [personalities, setPersonalities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedInterview, setSelectedInterview] = useState<any>(null);

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
            } catch (err) {
                console.error("Error loading archive:", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-rose-50/30">
            <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
        </div>
    );

    const activeOne = personalities.find(p => p.isActive);
    const archive = personalities.filter(p => !p.isActive);

    return (
        <div className="min-h-screen bg-gradient-to-b from-rose-50/50 to-white pb-20 pt-6 px-4 md:px-8 text-right font-sans" dir="rtl">
            
            {/* Header */}
            <div className="max-w-5xl mx-auto flex items-center justify-between mb-10">
                <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full shadow-sm text-slate-400 hover:text-rose-500 transition-colors border border-rose-50">
                    <ArrowLeft size={20} />
                </button>
                <div className="text-right">
                    <h1 className="text-2xl md:text-4xl font-black text-slate-800">נשות המעגל</h1>
                    <p className="text-xs md:text-sm text-rose-400 font-bold">מקום להשראה, עוצמה וחיבור נשי</p>
                </div>
            </div>

            <div className="max-w-5xl mx-auto space-y-12">
                
                {/* אשת השבוע הנוכחית - Hero Section */}
                {activeOne && (
                    <section className="animate-fade-in">
                        <div className="bg-white rounded-[3rem] p-6 md:p-10 shadow-xl shadow-rose-100/50 border border-white relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-32 h-32 bg-rose-100/30 rounded-full -ml-16 -mt-16 blur-2xl"></div>
                            <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                                <div className="relative shrink-0">
                                    <img src={activeOne.image} alt={activeOne.name} className="w-40 h-40 md:w-56 md:h-56 rounded-[2.5rem] object-cover shadow-2xl border-4 border-white" />
                                    <div className="absolute -bottom-2 -right-2 bg-amber-400 p-2.5 rounded-2xl text-white shadow-lg animate-bounce">
                                        <Sparkles size={20} />
                                    </div>
                                </div>
                                <div className="text-center md:text-right flex-1 space-y-4">
                                    <span className="bg-rose-500 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md shadow-rose-200">השבוע במעגל</span>
                                    <h2 className="text-3xl md:text-5xl font-black text-slate-800 leading-tight">{activeOne.name}</h2>
                                    <p className="text-lg md:text-xl text-rose-400 font-bold">{activeOne.role}</p>
                                    <p className="text-slate-600 italic text-base md:text-xl leading-relaxed max-w-xl">
                                        <Quote size={18} className="inline ml-2 opacity-20 rotate-180" />
                                        {activeOne.motto || "מאמינה בכוחן של נשים לשנות את העולם."}
                                        <Quote size={18} className="inline mr-2 opacity-20" />
                                    </p>
                                    <button onClick={() => setSelectedInterview(activeOne)} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-sm hover:bg-rose-600 transition-all shadow-lg active:scale-95">
                                        קראי את הראיון המלא
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* ארכיון - ראיונות קודמים */}
                {archive.length > 0 && (
                    <section className="space-y-6">
                        <h3 className="text-xl font-black text-slate-700 flex items-center gap-2 pr-2">
                            <Calendar size={20} className="text-rose-400" /> ראיונות קודמים
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {archive.map((p) => (
                                <div 
                                    key={p._id} 
                                    onClick={() => setSelectedInterview(p)}
                                    className="bg-white/70 backdrop-blur-sm rounded-[2.5rem] p-5 shadow-sm border border-white hover:shadow-xl hover:shadow-rose-50 transition-all cursor-pointer group active:scale-95"
                                >
                                    <div className="flex items-center gap-4">
                                        <img src={p.image} className="w-20 h-20 rounded-2xl object-cover grayscale group-hover:grayscale-0 transition-all shadow-sm" alt={p.name} />
                                        <div className="overflow-hidden">
                                            <h4 className="font-black text-slate-800 text-lg truncate">{p.name}</h4>
                                            <p className="text-xs text-rose-400 font-bold truncate">{p.role}</p>
                                            <p className="text-[10px] text-slate-400 mt-1">{new Date(p.updatedAt).toLocaleDateString('he-IL')}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* מודאל ראיון מלא - Overlay */}
            {selectedInterview && (
                <div className="fixed inset-0 z-[200] bg-rose-50/98 overflow-y-auto animate-fade-in no-scrollbar">
                    <div className="sticky top-0 bg-white/80 backdrop-blur-md p-5 flex justify-between items-center border-b z-50 px-6 md:px-12">
                        <button onClick={() => setSelectedInterview(null)} className="p-2 bg-slate-50 rounded-full hover:bg-rose-100 text-slate-500 transition-colors">
                            <X size={24}/>
                        </button>
                        <div className="flex items-center gap-2">
                            <h4 className="font-black text-rose-500 text-lg">סיפור אישי</h4>
                            <Heart size={20} className="text-rose-400 fill-current" />
                        </div>
                    </div>
                    
                    <div className="max-w-2xl mx-auto p-8 md:p-16 space-y-12 text-right">
                        <div className="text-center space-y-4">
                            <img src={selectedInterview.image} className="w-48 h-48 md:w-64 md:h-64 rounded-[3.5rem] mx-auto object-cover shadow-2xl border-4 border-white" />
                            <h2 className="text-4xl md:text-6xl font-black text-slate-800 tracking-tight">{selectedInterview.name}</h2>
                            <p className="text-xl text-rose-400 font-bold">{selectedInterview.role}</p>
                            {selectedInterview.motto && (
                                <p className="text-2xl italic text-slate-500 max-w-lg mx-auto font-serif">"{selectedInterview.motto}"</p>
                            )}
                        </div>

                        <div className="space-y-8">
                            {selectedInterview.questions?.map((q: any, i: number) => q.answer && (
                                <div key={i} className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border-r-8 border-rose-400 animate-fade-in-up" style={{animationDelay: `${i*0.1}s`}}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-2 bg-rose-50 rounded-lg text-rose-500">
                                            <MessageSquare size={18} />
                                        </div>
                                        <h5 className="font-black text-slate-800 text-lg md:text-xl">{q.question}</h5>
                                    </div>
                                    <p className="text-slate-700 text-base md:text-lg leading-relaxed whitespace-pre-wrap">{q.answer}</p>
                                </div>
                            ))}
                        </div>
                        
                        <button onClick={() => setSelectedInterview(null)} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-rose-500 transition-all mt-10">
                            סגירה וחזרה לארכיון
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonalityArchivePage;