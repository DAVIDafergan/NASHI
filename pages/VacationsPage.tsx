import AdSlot from '../components/AdSlot';
import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, Phone, Calendar, MessageCircle, Moon, ExternalLink, Palmtree } from 'lucide-react';
import ScrollReveal from '../components/ScrollReveal';
import { TiltCard } from '../components/home/HomeParts';
import { useArea, AreaChips } from '../components/pages/AreaFilter';
import { PageShell, PageHero, FilterBar, SearchField, Chip, ChipRow, EmptyState, PageLoading } from '../components/pages/PageKit';
import { useAudienceFilter, AudienceChips, audienceCounts } from '../components/AudienceFilter';
import AudienceBadge from '../components/AudienceBadge';
import { api } from '../services/api';
import { BRAND } from '../shared/brand';
import { VacationItem } from '../types';

const fmt = (d?: string) => { if (!d) return ''; const x = new Date(d); return isNaN(+x) ? d : x.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' }); };

const VacationsPage = () => {
  const [items, setItems] = useState<VacationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [cat, setCat] = useState('all');
  const { area, setArea, match: matchesArea, myRegion } = useArea();
  const aud = useAudienceFilter();

  useEffect(() => {
    api.getVacations()
      .then(d => setItems((Array.isArray(d) ? d : []).map((v: any) => ({ ...v, id: v._id || v.id, image: v.image || '/placeholder.svg' }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cats = useMemo(() => ['all', ...Array.from(new Set(items.map(v => v.category).filter(Boolean) as string[]))], [items]);
  // a stay that has already ended is not shown
  const today = new Date().toISOString().slice(0, 10);
  const list = items.filter(v => {
    if (v.dateTo && v.dateTo < today) return false;
    if (!aud.match(v as any) || !matchesArea(v as any)) return false;
    if (cat !== 'all' && v.category !== cat) return false;
    return !filter || [v.title, v.destination, v.category].some(x => (x || '').includes(filter));
  });

  const wa = (phone: string | undefined, text: string) => {
    if (!phone) return;
    window.open(`https://wa.me/${phone.replace(/\D/g, '').replace(/^0/, '972')}?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (loading) return <PageLoading />;
  const reset = () => { setFilter(''); setCat('all'); aud.setAudience('any'); };

  return (
    <PageShell>
      <PageHero eyebrow="נופשים" title="זמן" accent="לנשום ולנוח"
        subtitle="נופשים, צימרים וסופי שבוע מאורגנים — מההנהלה ומנהלות התרבות בכל אזור. בוחרים, מתקשרים ונרשמים." />

      <FilterBar>
        <AudienceChips value={aud.audience} onChange={aud.setAudience} counts={audienceCounts(items as any)} className="mb-3" />
        <AreaChips area={area} setArea={setArea} myRegion={myRegion} className="mb-3" />
        <SearchField value={filter} onChange={setFilter} placeholder="חיפוש נופש או יעד…" />
        {cats.length > 1 && (
          <ChipRow className="mt-3">
            {cats.map(c => <Chip key={c} tone="sage" active={cat === c} onClick={() => setCat(c)}>{c === 'all' ? 'כל הסוגים' : c}</Chip>)}
          </ChipRow>
        )}
      </FilterBar>

      <AdSlot placement="events" className="!px-0 mb-6" />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:gap-7 lg:grid-cols-3">
        {list.map((v, i) => (
          <ScrollReveal key={v.id} delay={(i % 9) * 60} animation="scale-in" className="h-full">
            <TiltCard max={4} className="group flex h-full flex-col rounded-[1.75rem] border border-rose-100/70 bg-white shadow-petal hover:shadow-lift">
              <div className="relative m-2 mb-0 aspect-[16/10] shrink-0 overflow-hidden rounded-[1.4rem] bg-rose-50">
                <img src={v.image} alt={v.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" />
                <div className="absolute inset-0 bg-gradient-to-t from-plum-950/55 via-transparent to-transparent" />
                <span className="absolute right-3 top-3 flex items-center gap-1.5">
                  <AudienceBadge item={v as any} overlay />
                  {v.category && <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-[12px] text-rose-700 shadow-soft backdrop-blur"><Palmtree size={11} /> {v.category}</span>}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5 pt-4 text-right">
                <h3 className="text-[1.2rem] leading-snug">{v.title}</h3>
                <ul className="space-y-1.5 text-[13.5px] text-slate-500">
                  {v.destination && <li className="flex items-center gap-2"><MapPin size={14} className="shrink-0 text-rose-400" />{v.destination}</li>}
                  {v.dateFrom && <li className="flex items-center gap-2"><Calendar size={14} className="shrink-0 text-rose-400" />{fmt(v.dateFrom)}{v.dateTo ? ` – ${fmt(v.dateTo)}` : ''}</li>}
                  {!!v.nights && <li className="flex items-center gap-2"><Moon size={14} className="shrink-0 text-rose-400" />{v.nights} לילות</li>}
                </ul>
                {v.description && <p className="line-clamp-3 text-[13.5px] leading-relaxed text-slate-600">{v.description}</p>}
                {!!v.price && (
                  <div className="mt-auto flex items-baseline justify-between border-t border-rose-50 pt-3">
                    <span className="text-[12px] text-slate-400">{v.priceNote || 'מחיר'}</span>
                    <span className="font-strong text-[1.35rem] text-ink">₪{v.price}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {v.link
                    ? <a href={v.link} target="_blank" rel="noreferrer" className="btn-ghost min-h-[44px] !px-3 !text-[14px]"><ExternalLink size={15} /> לפרטים</a>
                    : <button onClick={() => wa(v.contactPhone || v.registrationPhone, `שלום${v.contactName ? ` ${v.contactName}` : ''}, אשמח לפרטים על "${v.title}" שראיתי ב${BRAND.name}.`)} className="btn-ghost min-h-[44px] !px-3 !text-[14px]"><MessageCircle size={15} /> שאלה</button>}
                  <button onClick={() => wa(v.registrationPhone || v.contactPhone, `שלום, אשמח להירשם ל"${v.title}" (ראיתי ב${BRAND.name}).`)} className="btn-primary min-h-[44px] !px-3 !text-[14px]"><Phone size={15} /> הרשמה</button>
                </div>
              </div>
            </TiltCard>
          </ScrollReveal>
        ))}
      </div>

      {list.length === 0 && (
        <EmptyState icon={<Palmtree size={28} />} title="עדיין אין נופשים להצגה" text="נופשים חדשים יתווספו בקרוב. אפשר לשנות את הסינון." action={<button onClick={reset} className="btn-ghost">הצגת הכול</button>} />
      )}
    </PageShell>
  );
};

export default VacationsPage;
