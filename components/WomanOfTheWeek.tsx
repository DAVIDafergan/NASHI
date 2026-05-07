import React, { useState, useEffect } from 'react';
import { Star, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const WomanOfTheWeek = () => {
  const navigate = useNavigate();
  const [personality, setPersonality] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const dataRaw = await api.getPersonality();
        // במקרה והשרת מחזיר מערך של כל הראיונות, ניקח את הראשון/העדכני ביותר
        const persData = Array.isArray(dataRaw) ? dataRaw[0] : dataRaw;
        setPersonality(persData);
      } catch (err) {
        console.error("Error fetching personality:", err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // מצב טעינה שומר על המבנה שלא יקפוץ
  if (loading) {
    return (
      <div className="bg-white rounded-3xl p-6 shadow-xl border border-purple-100 my-8 flex justify-center items-center h-40 animate-pulse">
        <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  // אם משום מה אין נתונים בשרת, לא נציג כלום כדי לא להראות כרטיס שבור
  if (!personality) return null;

  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-purple-100 my-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 bg-yellow-400 text-purple-900 text-xs font-bold px-4 py-1 rounded-bl-xl z-10 flex items-center gap-1">
        <Star size={12} fill="currentColor" />
        אשת השבוע
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-center">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-purple-200 to-pink-200 p-1 flex-shrink-0">
          <img 
            src={personality.image || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200&h=200"} 
            alt={personality.name} 
            className="w-full h-full object-cover rounded-full border-4 border-white"
          />
        </div>
        
        <div className="text-center md:text-right flex-1">
          <h3 className="text-xl font-bold text-slate-800 mb-1">{personality.name}</h3>
          
          {/* מציג מקצוע אם קיים בשרת */}
          {personality.role && (
            <p className="text-purple-600 text-sm font-medium mb-3">{personality.role}</p>
          )}
          
          <p className="text-slate-600 text-sm leading-relaxed mb-4 font-serif italic">
            "{personality.motto || personality.description}"
          </p>
          
          <button 
            onClick={() => navigate(personality._id || personality.id ? `/personality-archive/${personality._id || personality.id}` : '/personality-archive')}
            className="text-rose-500 text-sm font-bold flex items-center gap-1 mx-auto md:mx-0 hover:gap-2 transition-all"
          >
            קראי את הראיון המלא
            <ArrowLeft size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default WomanOfTheWeek;