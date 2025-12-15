import React, { useState, useEffect } from 'react';
import { Search, Clock, MapPin, Users, Heart, Phone, ArrowLeft, Info, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// הגדרת המבנה של חוג (כולל השדות החדשים)
interface ClassItem {
  id: string;
  _id?: string;
  title: string;
  instructor: string;
  contactPhone: string;
  day: string;
  time: string;
  location: string;
  price: number;
  ageGroup: string;
  exceptions?: string; // חריגים / הערות
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

  // טעינת הנתונים מהשרת (במקום props)
  useEffect(() => {
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
  }, []);

  const filteredClasses = classes.filter(cls => {
    const matchesSearch = cls.title.includes(filter) || cls.category.includes(filter) || cls.instructor.includes(filter);
    const matchesDay = selectedDay === 'all' || cls.day === selectedDay;
    return matchesSearch && matchesDay;
  });

  const days = ['all', 'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

  const handleRegister = (cls: ClassItem) => {
      // פתיחת וואטסאפ למדריכה
      if (cls.contactPhone) {
          const cleanPhone = cls.contactPhone.replace(/^0/, '972').replace(/\D/g, '');
          const msg = `היי ${cls.instructor}, אשמח לפרטים והרשמה לחוג "${cls.title}" שראיתי באפליקציית נשים.`;
          window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
      } else {
          alert(`לפרטים והרשמה ניתן להגיע ל${cls.location} בשעות הפעילות.`);
      }
  };

  if (loading) return (
      <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
  );

  return (
    <div className="space-y-6 w-full pb-24 p-4 md:p-8">
      
      {/* כותרת וכפתור חזרה */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="flex items-center gap-3 w-full">
             <button onClick={() => navigate(-1)} className="bg-white p-2 rounded-full shadow-sm text-slate-600 hover:bg-slate-50"><ArrowLeft size={20}/></button>
             <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900">חוגים ופעילויות</h2>
                <p className="text-slate-500 text-sm">מערכת השעות העירונית</p>
             </div>
        </div>
      </div>

      {/* סרגל סינון - דביק */}
      <div className="bg-white/90 backdrop-blur-xl p-3 md:p-4 rounded-2xl shadow-sm border border-white flex flex-col md:flex-row gap-4 items-center sticky top-16 z-30 transition-all">
        <div className="relative flex-1 w-full">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
                type="text" 
                placeholder="חפשי חוג, מדריכה..." 
                className="w-full pr-10 pl-4 py-3 bg-slate-50 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 text-sm font-medium"
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

      {/* גריד החוגים - מותאם למובייל */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClasses.map(cls => (
            <div key={cls.id} className="bg-white rounded-[2rem] p-2 shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-purple-100/50 transition-all duration-300 group flex flex-col">
                
                {/* תמונה */}
                <div className="h-48 overflow-hidden relative rounded-[1.5rem] mb-3 shrink-0 bg-purple-50">
                    <img src={cls.image} alt={cls.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-slate-800 shadow-sm flex items-center gap-1">
                        <Heart size={10} className="text-purple-500 fill-current" />
                        {cls.category || 'כללי'}
                    </div>
                </div>
                
                <div className="px-2 pb-2 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-1">
                        <h3 className="text-lg font-black text-slate-800 leading-tight">{cls.title}</h3>
                    </div>
                    
                    <p className="text-xs text-slate-500 mb-4">עם המדריכה: <span className="font-bold text-slate-700">{cls.instructor}</span></p>

                    <div className="bg-slate-50 rounded-2xl p-3 space-y-3 mb-4 border border-slate-100">
                        {/* זמן ויום */}
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                            <Clock size={16} className="text-purple-500" />
                            <span>{cls.day} בשעה {cls.time}</span>
                        </div>
                        
                        {/* מיקום */}
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                            <MapPin size={16} className="text-purple-400" />
                            <span>{cls.location || 'מיקום יעודכן'}</span>
                        </div>

                        {/* גילאים */}
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Users size={16} className="text-purple-400" />
                            <span>{cls.ageGroup || 'כל הגילאים'}</span>
                        </div>

                        {/* חריגים / הערות מיוחדות - רק אם קיים */}
                        {cls.exceptions && (
                            <div className="flex items-start gap-2 text-xs text-orange-700 bg-orange-50 p-2 rounded-xl border border-orange-100 mt-1">
                                <Info size={14} className="shrink-0 mt-0.5" />
                                <span>{cls.exceptions}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50">
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-400">מחיר</span>
                            <span className="text-lg font-black text-slate-800">₪{cls.price}</span>
                        </div>
                        <button 
                            onClick={() => handleRegister(cls)}
                            className="bg-slate-900 text-white px-5 py-3 rounded-xl text-xs font-bold hover:bg-purple-600 transition-colors shadow-lg shadow-slate-200 flex items-center gap-2"
                        >
                            <Phone size={14} /> פרטים והרשמה
                        </button>
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