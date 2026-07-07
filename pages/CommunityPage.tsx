import React, { useState, useEffect } from 'react';
import {
  Search, Phone, MapPin, BookOpen, Heart, Store,
  ArrowLeft, Info, ExternalLink, MessageCircle
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import ScrollReveal from '../components/ScrollReveal';

const tabIcon = (category: string) => {
  if (category === 'גמ"חים') return <Heart size={13} />;
  if (category?.includes('עסק')) return <Store size={13} />;
  return <BookOpen size={13} />;
};

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
    <div className="min-h-screen bg-[#FFFBF7]">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-5 md:space-y-6 pb-24">

        {/* כותרת וחזרה */}
        <ScrollReveal className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
          <button onClick={() => navigate(-1)} className="w-11 h-11 shrink-0 flex items-center justify-center bg-[#F5F5F5] rounded-full text-[#1A202C] hover:bg-[#DCEEE5] hover:text-[#2D6A4F] transition-all active:scale-95">
            <ArrowLeft size={20}/>
          </button>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-[#1A202C] tracking-tight">קהילה נשית</h2>
            <p className="text-[#718096] text-sm font-medium mt-0.5">כל מה שקורה בעיר עבורך</p>
          </div>
        </ScrollReveal>

        {/* תפריט קטגוריות */}
        <ScrollReveal delay={60} className="flex overflow-x-auto gap-2 pb-1 no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); setSearchTerm(''); }}
              className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl font-bold text-sm transition-all duration-300 active:scale-95 ${
                activeTab === tab.id
                ? 'bg-[#2D6A4F] text-white shadow-md shadow-[#2D6A4F]/20'
                : 'bg-white text-[#718096] border border-slate-200 hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </ScrollReveal>

        {/* שורת חיפוש */}
        <ScrollReveal delay={100} className="relative group max-w-2xl">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#2D6A4F] transition-colors" size={18}/>
          <input
            type="text"
            placeholder={`חפשי בתוך ${activeTab}...`}
            className="w-full pr-14 pl-6 py-3.5 min-h-[44px] bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-4 focus:ring-[#2D6A4F]/10 focus:border-[#2D6A4F]/40 outline-none transition-all text-[#1A202C] font-medium placeholder:font-normal placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </ScrollReveal>

        {/* גריד תוצאות */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-5 bg-white rounded-2xl border border-slate-100">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-100 border-t-[#2D6A4F]"></div>
            <p className="text-[#718096] font-bold animate-pulse">טוען נתונים מהקהילה...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredItems.map((item, i) => (
              <ScrollReveal
                key={item._id}
                delay={i < 8 ? i * 60 : 0}
                className="flex flex-col bg-white rounded-lg overflow-hidden border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)] hover:scale-[1.02] transition-all duration-300 group"
              >
                {/* תמונה */}
                <div className="h-28 relative overflow-hidden bg-[#DCEEE5] shrink-0">
                  <img
                    src={item.image || 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=500'}
                    className="w-full h-full object-cover animate-float-slow group-hover:scale-105 transition-transform duration-700"
                    alt={item.title}
                  />
                  <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-md w-6 h-6 rounded-full flex items-center justify-center text-[#2D6A4F] shadow-sm">
                    {tabIcon(item.category)}
                  </div>
                </div>

                {/* תוכן הכרטיס */}
                <div className="flex-1 flex flex-col p-3 gap-2">
                  <h3 className="text-[15px] font-semibold text-[#1A202C] leading-snug">{item.title}</h3>
                  <p className="text-[#4A5568] text-[13px] leading-[1.4] line-clamp-2">{item.description}</p>

                  {item.location && (
                    <span className="inline-flex items-center gap-1 self-start bg-[#F5F5F5] text-[#718096] text-[12px] font-medium px-2 py-1 rounded-full">
                      <MapPin size={11} className="text-[#2D6A4F]" />
                      <span className="truncate max-w-[110px]">{item.location}</span>
                    </span>
                  )}

                  <button
                    onClick={() => handleContact(item.phone, item.title)}
                    className="mt-auto min-h-[44px] w-full py-2.5 bg-[#2D6A4F] text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#245A41] hover:scale-[1.02] transition-all duration-200 active:scale-95"
                  >
                    <MessageCircle size={14}/>
                    צרי קשר עכשיו
                  </button>
                </div>
              </ScrollReveal>
            ))}
          </div>
        )}

        {/* מצב ריק */}
        {!loading && filteredItems.length === 0 && (
          <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-[#F5F5F5] rounded-full flex items-center justify-center mx-auto mb-5 text-slate-300">
              <Search size={32}/>
            </div>
            <h3 className="text-xl font-bold text-[#1A202C] mb-2">לא מצאנו את מה שחיפשת</h3>
            <p className="text-[#718096] font-medium max-w-sm mx-auto">נסי לשנות את מונח החיפוש או לעבור לקטגוריה אחרת למעלה.</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default CommunityPage;