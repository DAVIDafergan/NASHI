import React from 'react';
import { Star, ArrowLeft } from 'lucide-react';

const WomanOfTheWeek = () => {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-purple-100 my-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 bg-yellow-400 text-purple-900 text-xs font-bold px-4 py-1 rounded-bl-xl z-10 flex items-center gap-1">
        <Star size={12} fill="currentColor" />
        אשת השבוע
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-center">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-purple-200 to-pink-200 p-1 flex-shrink-0">
          <img 
            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200&h=200" 
            alt="אשת השבוע" 
            className="w-full h-full object-cover rounded-full border-4 border-white"
          />
        </div>
        
        <div className="text-center md:text-right flex-1">
          <h3 className="text-xl font-bold text-slate-800 mb-1">רונית כהן</h3>
          <p className="text-purple-600 text-sm font-medium mb-3">יזמת חברתית ומנכ"לית "עתיד ירוק"</p>
          <p className="text-slate-600 text-sm leading-relaxed mb-4">
            רונית מובילה מהפכה בתחום הקיימות בעיר שלנו, עם פרויקט גינות קהילתיות שחיבר מאות נשים לעשייה ירוקה.
          </p>
          <button className="text-rose-500 text-sm font-bold flex items-center gap-1 mx-auto md:mx-0 hover:gap-2 transition-all">
            קראי את הראיון המלא
            <ArrowLeft size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default WomanOfTheWeek;