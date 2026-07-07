import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Clock, MapPin, Users, Heart, Phone, ArrowLeft, Info, Calendar, MessageCircle, Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ScrollReveal from '../components/ScrollReveal';

// הגדרת המבנה של חוג (כולל השדות החדשים)
interface ClassItem {
  id: string;
  _id?: string;
  title: string;
  instructor: string;
  contactPhone: string;
  registrationPhone?: string; // השדה החדש
  day: string;
  time: string;
  location: string;
  price: number;
  ageGroup: string;
  exceptions?: string;
  category: string;
  image: string;
}

const API_URL = 'https://nashi-production.up.railway.app/api';

const ClassesPage = () => {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState('');
  const [selectedDay, setSelectedDay] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // בדיקת התחברות
  const token = localStorage.getItem('token');

  useEffect(() => {
    // רק אם יש טוקן נבצע את הקריאה לשרת
    if (token) {
        fetch(`${API_URL}/classes`)
          .then(res => res.json())
          .then(data => {
            const formattedClasses = data.map((item: any) => ({
                ...item,
                id: item._id || item.id,
                image: item.image || 'https://via.placeholder.com/400x300',
            }));
            setClasses(formattedClasses);
            setLoading(false);
          })
          .catch(err => {
            console.error("Error fetching classes:", err);
            setLoading(false);
          });
    } else {
        setLoading(false);
    }
  }, [token]);

  // הגנה על הדף - אם אין טוקן, נציג מסך התחברות מעוצב
  if (!token) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#FFFBF7]" dir="rtl">
            <div className="w-20 h-20 bg-[#DCEEE5] rounded-3xl flex items-center justify-center text-[#2D6A4F] mb-6 shadow-inner">
                <Lock size={32} />
            </div>
            <h1 className="text-2xl font-bold text-[#1A202C] mb-2">התוכן זמין לחברות בלבד</h1>
            <p className="text-[#718096] mb-8 max-w-xs font-medium leading-relaxed">כדי לצפות במערכת החוגים וליהנות מפעילויות nashi, עלייך להיות מחוברת למערכת.</p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
                <button
                    onClick={() => navigate('/login')}
                    className="w-full min-h-[44px] py-4 bg-[#2D6A4F] text-white rounded-xl font-bold shadow-lg shadow-[#2D6A4F]/15 hover:bg-[#245A41] active:scale-95 transition-all"
                >
                    התחברות למערכת
                </button>
                <button
                    onClick={() => navigate('/register')}
                    className="w-full min-h-[44px] py-4 bg-white text-[#718096] border border-slate-200 rounded-xl font-bold hover:text-[#2D6A4F] hover:border-[#2D6A4F]/40 transition-all"
                >
                    הרשמה מהירה
                </button>
            </div>
        </div>
    );
  }

  const categories = useMemo(() => {
    const unique = Array.from(new Set(classes.map(c => c.category).filter(Boolean)));
    return ['all', ...unique];
  }, [classes]);

  const filteredClasses = classes.filter(cls => {
    const matchesSearch = cls.title.includes(filter) || cls.category.includes(filter) || cls.instructor.includes(filter);
    const matchesDay = selectedDay === 'all' || cls.day === selectedDay;
    const matchesCategory = selectedCategory === 'all' || cls.category === selectedCategory;
    return matchesSearch && matchesDay && matchesCategory;
  });

  const days = ['all', 'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

  const handlePhoneAction = (phone: string, name: string, title: string, type: 'instructor' | 'reg') => {
      if (phone) {
          const cleanPhone = phone.replace(/^0/, '972').replace(/\D/g, '');
          const msg = type === 'instructor'
            ? `היי ${name}, אשמח לפרטים לגבי החוג "${title}" שראיתי באפליקציית נשים.`
            : `שלום, אשמח להירשם לחוג "${title}" דרך אפליקציית נשים.`;
          window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
      }
  };

  if (loading) return (
      <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D6A4F]"></div>
      </div>
  );

  return (
    <div className="space-y-6 w-full pb-24 p-4 md:p-8 text-right bg-[#FFFBF7]" dir="rtl">

      <ScrollReveal className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="flex items-center gap-3 w-full">
             <button onClick={() => navigate(-1)} className="w-11 h-11 shrink-0 flex items-center justify-center bg-white rounded-full shadow-sm text-[#1A202C] hover:bg-[#F5F5F5] border border-slate-100 transition-colors"><ArrowLeft size={20}/></button>
             <div>
                <h2 className="text-2xl md:text-3xl font-bold text-[#1A202C]">חוגים ופעילויות</h2>
                <p className="text-[#718096] text-sm mt-0.5">מערכת השעות העירונית</p>
             </div>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={80} className="bg-white p-3 md:p-4 rounded-2xl shadow-[0_2px_16px_rgba(15,23,42,0.05)] border border-slate-100 flex flex-col gap-4 sticky top-16 z-30">
        <div className="relative w-full">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
                type="text"
                placeholder="חפשי חוג, מדריכה..."
                className="w-full pr-10 pl-4 py-3 bg-[#F5F5F5] border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 text-sm font-medium text-right min-h-[44px]"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
            />
        </div>

        <div className="flex gap-2 w-full overflow-x-auto pb-1 no-scrollbar">
            {days.map(day => (
                <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`px-4 py-2 min-h-[36px] rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 active:scale-95 ${
                        selectedDay === day
                        ? 'bg-[#2D6A4F] text-white shadow-md shadow-[#2D6A4F]/20'
                        : 'bg-[#F5F5F5] text-[#718096] hover:bg-[#DCEEE5] hover:text-[#2D6A4F]'
                    }`}
                >
                    {day === 'all' ? 'כל הימים' : day}
                </button>
            ))}
        </div>

        {categories.length > 1 && (
          <div className="flex gap-2 w-full overflow-x-auto pb-1 no-scrollbar border-t border-slate-50 pt-3">
              {categories.map(cat => (
                  <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 min-h-[36px] rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 border active:scale-95 ${
                          selectedCategory === cat
                          ? 'bg-[#F8A88F] text-white border-[#F8A88F] shadow-md shadow-[#F8A88F]/20'
                          : 'bg-white text-[#718096] border-slate-200 hover:border-[#F8A88F]/50 hover:text-[#E88B70]'
                      }`}
                  >
                      {cat === 'all' ? 'כל הקטגוריות' : cat}
                  </button>
              ))}
          </div>
        )}
      </ScrollReveal>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClasses.map((cls, i) => (
            <ScrollReveal key={cls.id} delay={(i % 9) * 60} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-[0_2px_16px_rgba(15,23,42,0.06)] hover:shadow-[0_8px_28px_rgba(15,23,42,0.1)] hover:-translate-y-1 transition-all duration-300 flex flex-col">

                <div className="h-44 overflow-hidden relative bg-[#DCEEE5] shrink-0">
                    <img src={cls.image} alt={cls.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                    <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold text-[#1A202C] shadow-sm flex items-center gap-1">
                        <Heart size={10} className="text-[#F8A88F] fill-current" />
                        {cls.category || 'כללי'}
                    </div>
                </div>

                <div className="p-4 flex-1 flex flex-col text-right gap-3">
                    <div>
                      <h3 className="text-base font-bold text-[#1A202C] leading-snug">{cls.title}</h3>
                      <p className="text-xs text-[#718096] mt-1">עם המדריכה: <span className="font-bold text-[#1A202C]">{cls.instructor}</span></p>
                    </div>

                    <div className="bg-[#F5F5F5] rounded-xl p-3 space-y-2.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#1A202C]">
                            <Clock size={15} className="text-[#2D6A4F] shrink-0" />
                            <span>{cls.day} בשעה {cls.time}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#718096] font-medium">
                            <MapPin size={15} className="text-[#2D6A4F] shrink-0" />
                            <span>{cls.location || 'מיקום יעודכן'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#718096] font-medium">
                            <Users size={15} className="text-[#2D6A4F] shrink-0" />
                            <span>{cls.ageGroup || 'כל הגילאים'}</span>
                        </div>

                        {cls.exceptions && (
                            <div className="flex items-start gap-2 text-xs text-orange-700 bg-orange-50 p-2 rounded-lg border border-orange-100">
                                <Info size={14} className="shrink-0 mt-0.5" />
                                <span>{cls.exceptions}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between px-1">
                       <span className="text-lg font-bold text-[#1A202C]">₪{cls.price}</span>
                       <span className="text-xs text-[#718096]">מחיר חודשי</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-auto pt-1">
                       <button
                           onClick={() => handlePhoneAction(cls.contactPhone, cls.instructor, cls.title, 'instructor')}
                           className="min-h-[44px] bg-white border-2 border-slate-100 text-[#1A202C] rounded-xl text-xs font-bold hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F] active:scale-95 transition-all flex items-center justify-center gap-1.5"
                       >
                           <MessageCircle size={15} className="text-[#2D6A4F]" /> יצירת קשר
                       </button>
                       <button
                           onClick={() => handlePhoneAction(cls.registrationPhone || cls.contactPhone, cls.instructor, cls.title, 'reg')}
                           className="min-h-[44px] bg-[#2D6A4F] text-white rounded-xl text-xs font-bold hover:bg-[#245A41] active:scale-95 transition-all shadow-md shadow-[#2D6A4F]/15 flex items-center justify-center gap-1.5"
                       >
                           <Phone size={15} /> הרשמה לחוג
                       </button>
                    </div>
                </div>
            </ScrollReveal>
        ))}
      </div>

       {filteredClasses.length === 0 && (
         <ScrollReveal className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
           <p className="text-[#718096] font-medium text-sm">לא נמצאו חוגים התואמים את החיפוש.</p>
           <button
             onClick={() => {setFilter(''); setSelectedDay('all'); setSelectedCategory('all');}}
             className="mt-3 min-h-[44px] px-5 text-[#2D6A4F] text-xs font-bold hover:underline"
           >
             הצג את כל החוגים
           </button>
         </ScrollReveal>
      )}
    </div>
  );
};

export default ClassesPage;
