import AdSlot from '../components/AdSlot';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Clock, MapPin, Users, Heart, Phone, ArrowLeft, Info, Calendar, MessageCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ScrollReveal from '../components/ScrollReveal';
import { TiltCard } from '../components/home/HomeParts';
import { useArea, AreaChips } from '../components/pages/AreaFilter';
import { PageShell, PageHero, FilterBar, SearchField, Chip, ChipRow, EmptyState, PageLoading } from '../components/pages/PageKit';
import { useAudienceFilter, AudienceChips, audienceCounts } from '../components/AudienceFilter';
import AudienceBadge from '../components/AudienceBadge';
import { BRAND } from '../shared/brand';

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
  audience?: any;
}

const API_URL = (import.meta as any).env?.VITE_API_URL || '/api';

const ClassesPage = () => {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState('');
  const [selectedDay, setSelectedDay] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetch(`${API_URL}/classes`)
      .then(res => res.json())
      .then(data => {
        const formattedClasses = data.map((item: any) => ({
            ...item,
            id: item._id || item.id,
            image: item.image || '/placeholder.svg',
        }));
        setClasses(formattedClasses);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching classes:", err);
        setLoading(false);
      });
  }, []);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(classes.map(c => c.category).filter(Boolean)));
    return ['all', ...unique];
  }, [classes]);

  const { area, setArea, match: matchesArea, myRegion } = useArea();
  const aud = useAudienceFilter();
  const filteredClasses = classes.filter(cls => {
    if (!aud.match(cls) || !matchesArea(cls)) return false;
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
            ? `שלום ${name}, אשמח לפרטים לגבי החוג "${title}" שראיתי ב${BRAND.name}.`
            : `שלום, אשמח להירשם לחוג "${title}" (ראיתי ב${BRAND.name}).`;
          window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
      }
  };

  if (loading) return <PageLoading />;

  const hasActiveFilters = filter !== '' || selectedDay !== 'all' || selectedCategory !== 'all';
  const todayName = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][new Date().getDay()];

  return (
    <PageShell>
      <PageHero
        eyebrow="חוגים ופעילויות"
        title="זמן קבוע"
        accent="של לימוד והעשרה"
        subtitle="חוגים, שיעורים וסדנאות לגברים, לנשים, לבנים ולבנות — בעיר שלכם ובזום: לימוד, יצירה, כושר והעשרה. בוחרים יום, מוצאים חוג ונרשמים בוואטסאפ בלחיצה."
      />

      <FilterBar>
        <AudienceChips value={aud.audience} onChange={aud.setAudience} counts={audienceCounts(classes)} className="mb-3" />
        <AreaChips area={area} setArea={setArea} myRegion={myRegion} className="mb-3" />
        <SearchField value={filter} onChange={setFilter} placeholder="חיפוש חוג, מדריך או מדריכה…" />
        <ChipRow className="mt-3">
          {days.map(day => (
            <Chip key={day} active={selectedDay === day} onClick={() => setSelectedDay(day)}>
              {day === 'all' ? 'כל הימים' : day}
              {day === todayName && <span className={`mr-1 h-1.5 w-1.5 rounded-full ${selectedDay === day ? 'bg-white' : 'bg-rose-400'}`} aria-label="היום" />}
            </Chip>
          ))}
        </ChipRow>
        {categories.length > 1 && (
          <ChipRow className="mt-2">
            {categories.map(cat => (
              <Chip key={cat} tone="sage" active={selectedCategory === cat} onClick={() => setSelectedCategory(cat)}>
                {cat === 'all' ? 'כל הסוגים' : cat}
              </Chip>
            ))}
          </ChipRow>
        )}
      </FilterBar>

      <AdSlot placement="classes" className="!px-0 mb-6" />

      {filteredClasses.length > 0 && (
        <p className="mb-4 text-[14px] text-slate-500">
          {filteredClasses.length} חוגים{selectedDay !== 'all' ? ` ביום ${selectedDay}` : ''}
          {hasActiveFilters && (
            <button onClick={() => {setFilter(''); setSelectedDay('all'); setSelectedCategory('all');}} className="mr-3 text-rose-700 underline underline-offset-4 decoration-rose-200">ניקוי</button>
          )}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-7">
        {filteredClasses.map((cls, i) => (
          <ScrollReveal key={cls.id} delay={(i % 9) * 60} animation="scale-in" className="h-full">
            <TiltCard max={4} className="group h-full rounded-[1.75rem] border border-rose-100/70 bg-white shadow-petal hover:shadow-lift flex flex-col">
              <div className="relative m-2 mb-0 aspect-[16/10] overflow-hidden rounded-[1.4rem] bg-rose-50 shrink-0">
                <img src={cls.image} alt={cls.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" />
                <div className="absolute inset-0 bg-gradient-to-t from-plum-950/55 via-transparent to-transparent" />
                <span className="absolute top-3 right-3 flex items-center gap-1.5">
                  <AudienceBadge item={cls} overlay />
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-[12px] text-rose-700 shadow-soft backdrop-blur">
                    <Heart size={11} className="fill-current" /> {cls.category || 'כללי'}
                  </span>
                </span>
                <div className="absolute bottom-3 right-3 left-3 flex items-end justify-between text-white">
                  <span className="font-accent text-[2rem] leading-none">{cls.day}</span>
                  <span className="rounded-full bg-white/20 px-3 py-1 text-[13px] backdrop-blur">{cls.time}</span>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3 p-5 pt-4 text-right">
                <div>
                  <h3 className="text-[1.2rem] leading-snug">{cls.title}</h3>
                  <p className="mt-1 text-[13.5px] text-slate-500">עם {cls.instructor}</p>
                </div>

                <ul className="space-y-1.5 text-[13.5px] text-slate-500">
                  <li className="flex items-center gap-2"><MapPin size={14} className="shrink-0 text-rose-400" />{cls.location || 'מיקום יעודכן'}</li>
                  <li className="flex items-center gap-2"><Users size={14} className="shrink-0 text-rose-400" />{cls.ageGroup || 'כל הגילאים'}</li>
                  <li className="flex items-center gap-2"><Clock size={14} className="shrink-0 text-rose-400" />{cls.day} בשעה {cls.time}</li>
                </ul>

                {cls.exceptions && (
                  <div className="flex items-start gap-2 rounded-2xl border border-champagne-100 bg-champagne-50 p-3 text-[13px] text-champagne-800">
                    <Info size={14} className="mt-0.5 shrink-0" />
                    <span>{cls.exceptions}</span>
                  </div>
                )}

                <div className="mt-auto flex items-baseline justify-between border-t border-rose-50 pt-3">
                  <span className="text-[12px] text-slate-400">מחיר חודשי</span>
                  <span className="font-strong text-[1.35rem] text-ink">₪{cls.price}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handlePhoneAction(cls.contactPhone, cls.instructor, cls.title, 'instructor')}
                    className="btn-ghost !px-3 !text-[14px] min-h-[44px]"
                  >
                    <MessageCircle size={15} /> שאלה
                  </button>
                  <button
                    onClick={() => handlePhoneAction(cls.registrationPhone || cls.contactPhone, cls.instructor, cls.title, 'reg')}
                    className="btn-primary !px-3 !text-[14px] min-h-[44px]"
                  >
                    <Phone size={15} /> הרשמה
                  </button>
                </div>
              </div>
            </TiltCard>
          </ScrollReveal>
        ))}
      </div>

      {filteredClasses.length === 0 && (
        <EmptyState
          icon={<Calendar size={28} />}
          title="לא נמצאו חוגים כאלה"
          text="אולי ביום אחר? אפשר לשנות את היום, את סוג החוג או את קהל היעד."
          action={<button onClick={() => {setFilter(''); setSelectedDay('all'); setSelectedCategory('all'); aud.setAudience('any');}} className="btn-ghost">הצגת כל החוגים</button>}
        />
      )}
    </PageShell>
  );
};

export default ClassesPage;
