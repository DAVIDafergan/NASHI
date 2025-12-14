import React, { useState } from 'react';
import { Search, Clock, MapPin, Users, Heart, Filter, User as UserIcon, Phone, CheckCircle2 } from 'lucide-react';
import { ClassItem } from '../types';

interface ClassesPageProps {
  classes: ClassItem[];
}

const ClassesPage: React.FC<ClassesPageProps> = ({ classes }) => {
  const [filter, setFilter] = useState('');
  const [selectedDay, setSelectedDay] = useState('all');

  const filteredClasses = classes.filter(cls => {
    const matchesSearch = cls.title.includes(filter) || cls.category.includes(filter);
    const matchesDay = selectedDay === 'all' || cls.day === selectedDay;
    return matchesSearch && matchesDay;
  });

  const days = ['all', 'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];

  const handleRegister = (cls: ClassItem) => {
      if (cls.contactPhone) {
          window.location.href = `tel:${cls.contactPhone}`;
      } else {
          alert(`לפרטים והרשמה ניתן להגיע ל${cls.location} בשעות הפעילות.`);
      }
  };

  return (
    <div className="space-y-6 w-full pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-rose-50 to-purple-50 p-6 md:p-8 rounded-[2.5rem] border border-white shadow-sm">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">מערכת חוגים עירונית</h2>
          <p className="text-slate-600 mt-2 text-sm md:text-base">מצא את החוג המושלם עבורך - גוף, נפש ויצירה</p>
        </div>
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-rose-500 shadow-md transform rotate-3 hidden md:flex">
            <Heart fill="currentColor" size={24} />
        </div>
      </div>

      <div className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center sticky top-20 z-10 backdrop-blur-md bg-white/95">
        <div className="relative flex-1 w-full">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
                type="text" 
                placeholder="חפשי חוג לפי שם או קטגוריה..." 
                className="w-full pr-10 pl-4 py-2.5 md:py-3 bg-slate-50 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all text-sm"
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
                    {day === 'all' ? 'כל השבוע' : day}
                </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClasses.map(cls => (
            <div key={cls.id} className="bg-white rounded-[2rem] p-2 shadow-sm border border-white hover:shadow-xl hover:shadow-purple-100/50 transition-all duration-300 group flex flex-col">
                <div className="h-44 md:h-48 overflow-hidden relative rounded-[1.5rem] mb-3 shrink-0">
                    <img src={cls.image} alt={cls.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-slate-800 shadow-sm flex items-center gap-1">
                        <Heart size={10} className="text-purple-500 fill-current" />
                        {cls.category}
                    </div>
                </div>
                
                <div className="px-2 pb-2 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-black text-slate-800 leading-tight">{cls.title}</h3>
                        <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap border border-purple-100">{cls.ageGroup}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-slate-500 text-xs mb-3">
                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center"><UserIcon size={12} /></div>
                        <span>מדריכה: <span className="font-bold">{cls.instructor}</span></span>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-3 space-y-2 mb-4 border border-slate-100">
                        <div className="flex items-center justify-between text-xs font-medium">
                            <span className="flex items-center gap-2 text-slate-600"><Clock size={14} className="text-purple-400" /> {cls.day}, {cls.time}</span>
                            <span className="flex items-center gap-2 text-slate-600"><MapPin size={14} className="text-purple-400" /> {cls.location}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50">
                        <span className="text-xl font-black text-slate-800">₪{cls.price}<span className="text-xs font-normal text-slate-400">/מפגש</span></span>
                        <button 
                            onClick={() => handleRegister(cls)}
                            className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-xs font-bold hover:bg-purple-600 transition-colors shadow-lg shadow-slate-200 flex items-center gap-2"
                        >
                            <Phone size={14} /> הרשמה
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