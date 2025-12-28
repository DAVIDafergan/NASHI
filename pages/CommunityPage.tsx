import React, { useState, useEffect } from 'react';
import { 
  Search, Phone, MapPin, BookOpen, Heart, Store, 
  ArrowLeft, Info, ExternalLink, MessageCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const CommunityPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'שיעורי תורה' | 'גמ"חים' | 'עסקים מקומיים'>('שיעורי תורה');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadCommunityData();
  }, []);

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

  // סינון פריטים לפי טאב פעיל וחיפוש חופשי
  const filteredItems = items.filter(item => 
    item.category === activeTab && 
    (item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
     item.description?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 pb-24">
      
      {/* כותרת וחזרה */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="bg-white p-2 rounded-full shadow-sm text-slate-600 hover:bg-rose-50 transition-colors">
          <ArrowLeft size={20}/>
        </button>
        <div>
          <h2 className="text-3xl font-black text-slate-800">קהילה נשית</h2>
          <p className="text-slate-500 text-sm">כל מה שקורה בעיר עבורך</p>
        </div>
      </div>

      {/* תפריט קטגוריות מעוצב */}
      <div className="flex flex-wrap gap-3">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as any); setSearchTerm(''); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all duration-300 ${
              activeTab === tab.id 
              ? 'bg-slate-900 text-white shadow-xl shadow-slate-200 scale-105' 
              : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* שורת חיפוש חופשי */}
      <div className="relative group">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rose-500 transition-colors" size={20}/>
        <input 
          type="text" 
          placeholder={`חפשי בתוך ${activeTab}...`} 
          className="w-full pr-12 pl-4 py-4 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm focus:ring-2 focus:ring-rose-100 outline-none transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* גריד תוצאות */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
          <p className="text-slate-400 font-bold animate-pulse">טוען נתונים מהקהילה...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map(item => (
            <div 
              key={item._id} 
              className="bg-white rounded-[2.5rem] p-3 shadow-sm border border-slate-50 hover:shadow-xl hover:shadow-rose-100/30 transition-all duration-500 group"
            >
              {/* תמונה */}
              <div className="h-48 rounded-[2rem] overflow-hidden relative mb-4">
                <img 
                  src={item.image || 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=500'} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                />
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-slate-800 shadow-sm">
                  {activeTab}
                </div>
              </div>

              <div className="px-3 pb-3 space-y-4">
                <div>
                  <h3 className="text-xl font-black text-slate-800 mb-1">{item.title}</h3>
                  <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed">{item.description}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <MapPin size={14} className="text-rose-400"/>
                    <span>{item.location || 'מיקום יפורסם בפרטי'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <Phone size={14} className="text-rose-400"/>
                    <span>{item.phone}</span>
                  </div>
                </div>

                <button 
                  onClick={() => handleContact(item.phone, item.title)}
                  className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-rose-600 transition-colors shadow-lg active:scale-95"
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
        <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
            <Search size={32}/>
          </div>
          <h3 className="font-bold text-slate-800">לא מצאנו את מה שחיפשת</h3>
          <p className="text-slate-400 text-sm">נסי לשנות את מונח החיפוש או לעבור לקטגוריה אחרת.</p>
        </div>
      )}

    </div>
  );
};

export default CommunityPage;