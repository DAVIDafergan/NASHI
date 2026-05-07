import React, { useState, useEffect } from 'react';
import { 
  Search, Phone, MapPin, BookOpen, Heart, Store, 
  ArrowLeft, Info, ExternalLink, MessageCircle
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';

const CommunityPage = () => {
  const navigate = useNavigate();
  const location = useLocation(); // תופס את המידע שהגיע מדף הבית
  
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'שיעורי תורה' | 'גמ"חים' | 'עסקים מקומיים'>('שיעורי תורה');
  const [searchTerm, setSearchTerm] = useState('');

  // טעינת הנתונים הראשונית
  useEffect(() => {
    loadCommunityData();
  }, []);

  // האזנה לשינויים בניתוב ועדכון הטאב הפעיל בהתאם
  useEffect(() => {
    if (location.state?.activeTab) {
      const incomingCategory = location.state.activeTab;
      
      // מתרגמים את הקטגוריה שמגיעה מהשרת לשם המדויק של הטאב
      if (incomingCategory.includes('עסק') || incomingCategory === 'עסקים מקומיים') {
        setActiveTab('עסקים מקומיים');
      } else if (incomingCategory.includes('גמ"ח') || incomingCategory === 'גמ"חים') {
        setActiveTab('גמ"חים');
      } else if (incomingCategory.includes('שיעור') || incomingCategory.includes('תורה')) {
        setActiveTab('שיעורי תורה');
      }
    }
  }, [location.state]);

  const loadCommunityData = async () => {
    setLoading(true);
    try {
      const data = await api.getCommunityItems();
      setItems(data);
    } catch (err) {
      console.error("Error fetching community data:", err);
    }
    setLoading(false);
  };

  // סינון פריטים לפי טאב פעיל וחיפוש חופשי (תוקן כדי לתמוך בכל הווריאציות של עסקים מהשרת)
  const filteredItems = items.filter(item => {
    const isBusinessCategory = activeTab === 'עסקים מקומיים' && 
      ['עסקים', 'עסק מקומי', 'עסקים מקומיים'].includes(item.category);
      
    const matchesCategory = item.category === activeTab || isBusinessCategory;
    
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

  const tabs = [
    { id: 'שיעורי תורה', icon: <BookOpen size={18} />, label: 'שיעורי תורה' },
    { id: 'גמ"חים', icon: <Heart size={18} />, label: 'גמ"חים' },
    { id: 'עסקים מקומיים', icon: <Store size={18} />, label: 'עסקים מקומיים' }
  ];

  const handleContact = (phone: string, title: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const msg = encodeURIComponent(`היי, הגעתי אלייך דרך אפליקציית "נשי", אשמח לקבל פרטים בנוגע ל${title}.`);
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 md:space-y-8 pb-24">
        
        {/* כותרת וחזרה */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
          <button onClick={() => navigate(-1)} className="bg-slate-50 p-2.5 rounded-full text-slate-600 hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-95 border border-slate-100">
            <ArrowLeft size={22}/>
          </button>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">קהילה נשית</h2>
            <p className="text-slate-400 text-sm font-medium mt-0.5">כל מה שקורה בעיר עבורך</p>
          </div>
        </div>

        {/* תפריט קטגוריות */}
        <div className="relative">
          <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 md:mx-0 md:px-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); setSearchTerm(''); }}
                className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all duration-300 ${
                  activeTab === tab.id 
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' 
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* שורת חיפוש */}
        <div className="relative group max-w-2xl">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rose-500 transition-colors" size={18}/>
          <input 
            type="text" 
            placeholder={`חפשי בתוך ${activeTab}...`} 
            className="w-full pr-14 pl-6 py-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-rose-500/10 focus:border-rose-300 outline-none transition-all text-slate-700 font-medium placeholder:font-normal placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* גריד תוצאות */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-5 bg-white rounded-[3rem] border border-slate-100">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-100 border-t-rose-500"></div>
            <p className="text-slate-400 font-bold animate-pulse">טוען נתונים מהקהילה...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {filteredItems.map(item => (
              <div 
                key={item._id} 
                className="flex flex-col bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1 transition-all duration-400 group"
              >
                {/* תמונה */}
                <div className="h-52 relative overflow-hidden bg-slate-50">
                  <img 
                    src={item.image || 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=500'} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                    alt={item.title}
                  />
                  <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-slate-700 shadow-sm border border-slate-100">
                    {activeTab}
                  </div>
                </div>

                {/* תוכן הכרטיס */}
                <div className="flex-1 flex flex-col p-5 space-y-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-black text-slate-800 mb-2 leading-tight">{item.title}</h3>
                    <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed">{item.description}</p>
                  </div>

                  <div className="space-y-2.5 bg-slate-50 p-4 rounded-xl">
                    <div className="flex items-center gap-2.5 text-sm text-slate-600 font-medium">
                      <div className="text-rose-400">
                        <MapPin size={15} />
                      </div>
                      <span className="truncate">{item.location || 'מיקום יפורסם בפרטי'}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm text-slate-600 font-medium">
                      <div className="text-rose-400">
                        <Phone size={15} />
                      </div>
                      <span>{item.phone}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleContact(item.phone, item.title)}
                    className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-rose-500 transition-all duration-300 active:scale-[0.98]"
                  >
                    <MessageCircle size={16}/>
                    צרי קשר עכשיו
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* מצב ריק */}
        {!loading && filteredItems.length === 0 && (
          <div className="text-center py-24 bg-white rounded-[3rem] border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-5 text-slate-300">
              <Search size={32}/>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">לא מצאנו את מה שחיפשת</h3>
            <p className="text-slate-400 font-medium max-w-sm mx-auto">נסי לשנות את מונח החיפוש או לעבור לקטגוריה אחרת למעלה.</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default CommunityPage;