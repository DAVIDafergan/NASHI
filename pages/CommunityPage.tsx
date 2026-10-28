import AdSlot from '../components/AdSlot';
import React, { useState, useEffect } from 'react';
import {
  Search, Phone, MapPin, BookOpen, Heart, Store,
  ArrowLeft, Info, ExternalLink, MessageCircle
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import ScrollReveal from '../components/ScrollReveal';
import { useArea, AreaChips } from '../components/pages/AreaFilter';
import { PageShell, PageHero, FilterBar, SearchField, EmptyState, CardSkeletonGrid } from '../components/pages/PageKit';
import { useAudienceFilter, AudienceChips, audienceCounts } from '../components/AudienceFilter';
import AudienceBadge from '../components/AudienceBadge';
import { BRAND } from '../shared/brand';

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
  const { area, setArea, match: matchesArea, myRegion } = useArea();
  const aud = useAudienceFilter();
  const forAudience = items.filter(aud.match);
  const filteredItems = forAudience.filter(item => {
    if (!matchesArea(item)) return false;
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
    const msg = encodeURIComponent(`שלום, הגעתי דרך ${BRAND.name}, אשמח לקבל פרטים בנוגע ל${title}.`);
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
  };

  const tabBlurb: Record<string, string> = {
    'שיעורי תורה': 'שיעורים ודרשות — קרוב לבית, בזמן שנוח.',
    'גמ"חים': 'השאלות, עזרה ונתינה בין שכנים. כי ביחד הכול קל יותר.',
    'עסקים מקומיים': 'עסקים מהעיר. מפרגנים, קונים ומרוויחים ביחד.',
  };

  return (
    <PageShell>
      <PageHero
        eyebrow="קהילה וחסד"
        title="הכוח של"
        accent="קהילה ביחד"
        subtitle="שיעורים, גמ״חים ועסקים מהעיר. מוצאים, פונים בוואטסאפ ומתחברים."
      />

      {/* Tabs as big segmented cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5" role="tablist" aria-label="קטגוריות">
        {tabs.map(tab => {
          const active = activeTab === tab.id;
          const count = forAudience.filter(it => it.category === tab.id || (tab.id === 'עסקים מקומיים' && ['עסקים', 'עסק מקומי', 'עסקים מקומיים'].includes(it.category))).length;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => { setActiveTab(tab.id as any); setSearchTerm(''); }}
              className={`group relative overflow-hidden rounded-[1.4rem] border px-3 py-4 sm:p-5 text-right transition-all duration-500 active:scale-[0.97] ${
                active ? 'border-plum-300 bg-plum-300 text-ink shadow-lift' : 'border-rose-100 bg-white/80 text-ink hover:border-rose-300 hover:-translate-y-0.5'
              }`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-full transition ${active ? 'bg-white/15' : 'bg-rose-50 text-rose-500'}`}>{tab.icon}</span>
              <span className="mt-3 block font-strong text-[14px] sm:text-[16px] leading-tight">{tab.label}</span>
              {!loading && <span className={`mt-0.5 block text-[12px] ${active ? 'text-ink/70' : 'text-slate-400'}`}>{count} פריטים</span>}
            </button>
          );
        })}
      </div>

      <FilterBar>
        <AudienceChips value={aud.audience} onChange={aud.setAudience} counts={audienceCounts(items)} className="mb-3" />
        <AreaChips area={area} setArea={setArea} myRegion={myRegion} className="mb-3" />
        <SearchField value={searchTerm} onChange={setSearchTerm} placeholder={`חיפוש בתוך ${activeTab}…`} />
        <p className="mt-2 px-1 text-[13px] text-slate-500">{tabBlurb[activeTab]}</p>
      </FilterBar>

      <AdSlot placement="community" className="!px-0 mb-6" />

      {/* גריד תוצאות */}
      {loading ? (
        <CardSkeletonGrid count={8} className="grid-cols-2 md:grid-cols-3 lg:grid-cols-4" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
          {filteredItems.map((item, i) => (
            <ScrollReveal key={item._id} delay={i < 8 ? i * 60 : 0} animation="scale-in" className="h-full">
              <div className="group flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-rose-100/70 bg-white shadow-petal transition-all duration-500 hover:-translate-y-1 hover:shadow-lift">
                <div className="relative m-1.5 mb-0 aspect-[4/3] overflow-hidden rounded-[1.2rem] bg-rose-50 shrink-0">
                  <img
                    src={item.image || '/placeholder.svg'}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                    alt={item.title}
                    loading="lazy"
                  />
                  <span className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-soft">
                    {tabIcon(item.category)}
                  </span>
                  <AudienceBadge item={item} overlay className="absolute bottom-2 right-2" />
                </div>

                <div className="flex flex-1 flex-col gap-2 p-3 md:p-4">
                  <h3 className="text-[15px] md:text-[16.5px] leading-snug">{item.title}</h3>
                  {item.description && <p className="text-[13px] leading-[1.5] text-slate-500 line-clamp-3">{item.description}</p>}

                  {item.location && (
                    <span className="inline-flex max-w-full items-center gap-1 self-start rounded-full bg-rose-50/70 px-2.5 py-1 text-[12px] text-slate-500">
                      <MapPin size={11} className="shrink-0 text-rose-500" />
                      <span className="truncate">{item.location}</span>
                    </span>
                  )}

                  <button
                    onClick={() => handleContact(item.phone, item.title)}
                    className="mt-auto inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full bg-rose-50 text-[13.5px] text-rose-700 transition-all duration-300 group-hover:bg-plum-300 group-hover:text-ink active:scale-95 font-strong"
                  >
                    <MessageCircle size={15}/>
                    לפנייה בוואטסאפ
                  </button>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      )}

      {/* מצב ריק */}
      {!loading && filteredItems.length === 0 && (
        <EmptyState
          icon={<Search size={28}/>}
          title="לא מצאנו את מה שחיפשת"
          text="אפשר לנסות מילה אחרת, קטגוריה אחרת למעלה, או קהל יעד אחר."
          action={searchTerm ? <button onClick={() => setSearchTerm('')} className="btn-ghost">ניקוי חיפוש</button> : aud.audience !== 'any' ? <button onClick={() => aud.setAudience('any')} className="btn-ghost">לכל הקהלים</button> : undefined}
        />
      )}
    </PageShell>
  );
};

export default CommunityPage;
