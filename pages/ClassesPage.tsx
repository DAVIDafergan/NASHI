import React, { useState, useEffect } from 'react';
import { 
  Search, Clock, MapPin, Users, Heart, Phone, ArrowLeft, Info, Calendar, MessageCircle, Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#fffcfc]" dir="rtl">
            <div className="w-20 h-20 bg-purple-50 rounded-3xl flex items-center justify-center text-purple-500 mb-6 shadow-inner border border-purple-100">
                <Lock size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-800 mb-2">התוכן זמין לחברות בלבד</h1>
            <p className="text-slate-500 mb-8 max-w-xs font-medium">כדי לצפות במערכת החוגים וליהנות מפעילויות nashi, עלייך להיות מחוברת למערכת.</p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
                <button 
                    onClick={() => navigate('/login')}
                    className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black shadow-lg shadow-purple-100 hover:bg-purple-700 transition-all active:scale-95"
                >
                    התחברות למערכת
                </button>
                <button 
                    onClick={() => navigate('/register')}
                    className="w-full py-4 bg-white text-slate-400 border border-purple-100 rounded-2xl font-black hover:text-purple-600 transition-all"
                >
                    הרשמה מהירה
                </button>
            </div>
        </div>
    );
  }

  const filteredClasses = classes.filter(cls => {
    const matchesSearch = cls.title.includes(filter) || cls.category.includes(filter) || cls.instructor.includes(filter);
    const matchesDay = selectedDay === 'all' || cls.day === selectedDay;
    return matchesSearch && matchesDay;
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
  );

  return (
    <div className="space-y-6 w-full pb-24 p-4 md:p-8 text-right" dir="rtl">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="flex items-center gap-3 w-full">
             <button onClick={() => navigate(-1)} className="bg-white p-2 rounded-full shadow-sm text-slate-600 hover:bg-slate-50 border border-slate-100"><ArrowLeft size={20}/></button>
             <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900">חוגים ופעילויות</h2>
                <p className="text-slate-500 text-sm">מערכת השעות העירונית</p>
             </div>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-xl p-3 md:p-4 rounded-2xl shadow-sm border border-white flex flex-col md:flex-row gap-4 items-center sticky top-16 z-30 transition-all">
        <div className="relative flex-1 w-full">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
                type="text" 
                placeholder="חפשי חוג, מדריכה..." 
                className="w-full pr-10 pl-4 py-3 bg-slate-50 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 text-sm font-medium text-right"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
            />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide no-scrollbar">
            {days.map(day => (
                <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                        selectedDay === day 
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-200' 
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    {day === 'all' ? 'הכל' : day}
                </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClasses.map(cls => (
            <div key={cls.id} className="bg-white rounded-[2rem] p-2 shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-purple-100/50 transition-all duration-300 group flex flex-col">
                
                <div className="h-48 overflow-hidden relative rounded-[1.5rem] mb-3 shrink-0 bg-purple-50">
                    <img src={cls.image} alt={cls.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-slate-800 shadow-sm flex items-center gap-1">
                        <Heart size={10} className="text-purple-500 fill-current" />
                        {cls.category || 'כללי'}
                    </div>
                </div>
                
                <div className="px-2 pb-2 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-1 text-right">
                        <h3 className="text-lg font-black text-slate-800 leading-tight w-full">{cls.title}</h3>
                    </div>
                    
                    <p className="text-xs text-slate-500 mb-4 text-right">עם המדריכה: <span className="font-bold text-slate-700">{cls.instructor}</span></p>

                    <div className="bg-slate-50 rounded-2xl p-3 space-y-3 mb-4 border border-slate-100 text-right">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 justify-start">
                            <Clock size={16} className="text-purple-500" />
                            <span>{cls.day} בשעה {cls.time}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-slate-600 justify-start">
                            <MapPin size={16} className="text-purple-400" />
                            <span>{cls.location || 'מיקום יעודכן'}</span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-600 justify-start">
                            <Users size={16} className="text-purple-400" />
                            <span>{cls.ageGroup || 'כל הגילאים'}</span>
                        </div>

                        {cls.exceptions && (
                            <div className="flex items-start gap-2 text-xs text-orange-700 bg-orange-50 p-2 rounded-xl border border-orange-100 mt-1">
                                <Info size={14} className="shrink-0 mt-0.5" />
                                <span>{cls.exceptions}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 mt-auto pt-2 border-t border-slate-50">
                        <div className="flex justify-between items-center px-1 mb-1">
                           <span className="text-lg font-black text-slate-800">₪{cls.price}</span>
                           <span className="text-xs text-slate-400">מחיר חודשי</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                           <button 
                               onClick={() => handlePhoneAction(cls.contactPhone, cls.instructor, cls.title, 'instructor')}
                               className="bg-white border-2 border-slate-100 text-slate-700 py-3 rounded-xl text-[10px] font-black hover:bg-slate-50 transition-colors flex items-center justify-center gap-1 shadow-sm"
                           >
                               <MessageCircle size={14} className="text-purple-500" /> המדריכה
                           </button>
                           <button 
                               onClick={() => handlePhoneAction(cls.registrationPhone || cls.contactPhone, cls.instructor, cls.title, 'reg')}
                               className="bg-slate-900 text-white py-3 rounded-xl text-[10px] font-black hover:bg-purple-600 transition-colors flex items-center justify-center gap-1 shadow-lg"
                           >
                               <Phone size={14} /> להרשמה
                           </button>
                        </div>
                    </div>
                </div>
            </div>
        ))}
      </div>
      
       {filteredClasses.length === 0 && (
         <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-slate-200">
           <p className="text-slate-500 font-medium text-sm">לא נמצאו חוגים התואמים את החיפוש.</p>
           <button 
             onClick={() => {setFilter(''); setSelectedDay('all');}}
             className="mt-2 text-purple-600 text-xs font-bold hover:underline"
           >
             הצג את כל החוגים
           </button>
         </div>
      )}
    </div>
  );
};

export default ClassesPage;