import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Lock, Store, MapPin, Globe2, Search, X, Wallet, Sparkles } from 'lucide-react';
import { PageShell, PageHero, FilterBar, SearchField, Chip, ChipRow, EmptyState, CardSkeletonGrid, Sheet, IconButton } from '../components/pages/PageKit';
import ScrollReveal from '../components/ScrollReveal';
import CityPicker from '../components/CityPicker';
import { SupplierCard, ContactButtons, categoryIcon, areaLabel, priceRangeName } from '../components/suppliers/SupplierParts';
import { suppliersApi, Supplier, isCultureManager } from '../services/suppliersApi';
import { SUPPLIER_CATEGORIES, supplierCategoryName } from '../shared/suppliers';
import { REGIONS, regionName } from '../shared/regions';
import { User } from '../types';
import { BRAND } from '../shared/brand';

/** "מאתרות ספקים" — only culture managers (regionAdmin) and the main admin. The server enforces it too (403). */
const SuppliersDirectoryPage: React.FC<{ user: User | null; onOpenLogin: () => void }> = ({ user, onOpenLogin }) => {
  const allowed = isCultureManager(user);
  const myRegion = (user as any)?.adminRegion || '';
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('all');
  const [style, setStyle] = useState('');
  const [region, setRegion] = useState<string>(myRegion || 'all');
  const [city, setCity] = useState('');
  const [picking, setPicking] = useState(false);
  const [list, setList] = useState<Supplier[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Supplier | null>(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(q), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setStyle(''); }, [category]);
  useEffect(() => {
    if (!allowed) return;
    let live = true;
    setList(null); setError('');
    suppliersApi.directory({ q: debounced, category, style, region: city ? '' : region, city })
      .then(r => { if (live) setList(r.suppliers); })
      .catch(e => { if (!live) return; if (e.status === 403 || e.status === 401) setDenied(true); else setError(e.message); setList([]); });
    return () => { live = false; };
  }, [allowed, debounced, category, style, region, city]);

  const styles = useMemo(() => SUPPLIER_CATEGORIES.find(c => c.id === category)?.styles || [], [category]);

  if (!allowed || denied) {
    return (
      <PageShell wide={false}>
        <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-500"><Lock size={28} /></span>
          <h1 className="mt-5 text-[2.2rem] leading-tight">מאתרות ספקים</h1>
          <p className="mt-2 text-[16px] leading-relaxed text-slate-500">האזור הזה פתוח למנהלי התרבות של {BRAND.name} בלבד: מאגר ספקים לאירועים — מרצים, מופעים, קייטרינג, הגברה ועוד.</p>
          {!user ? <button onClick={onOpenLogin} className="btn-primary mt-6">כניסה למנהלים</button>
            : <Link to="/become-manager" className="btn-primary mt-6">לניהול תרבות באזור שלכם</Link>}
          <Link to="/suppliers/join" className="mt-4 text-[14px] text-rose-700 underline underline-offset-4">ספקים? הצטרפו למאגר</Link>
        </div>
      </PageShell>
    );
  }

  const clear = () => { setQ(''); setCategory('all'); setStyle(''); setRegion(myRegion || 'all'); setCity(''); };
  const filtered = q || category !== 'all' || style || city || region !== (myRegion || 'all');

  return (
    <PageShell>
      <PageHero eyebrow="למנהלי התרבות" title="מאתרים ספקים" accent="לכל אירוע"
        subtitle={<>מרצים, מופעים, הצגות, סדנאות, קייטרינג, הגברה וצילום — ספקים לאירועים בציבור החרדי{myRegion ? <> ב<span className="text-rose-700">{regionName(myRegion)}</span></> : ''} ובכל הארץ.</>} />

      <FilterBar>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchField value={q} onChange={setQ} placeholder="חיפוש ספק, סגנון או עיר…" className="shrink-0 lg:w-80" />
          <ChipRow className="flex-1">
            <Chip active={category === 'all'} onClick={() => setCategory('all')}>הכול</Chip>
            {SUPPLIER_CATEGORIES.map(c => (
              <Chip key={c.id} active={category === c.id} onClick={() => setCategory(category === c.id ? 'all' : c.id)} icon={<span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{categoryIcon(c.id)}</span>}>{c.name}</Chip>
            ))}
          </ChipRow>
        </div>
        {styles.length > 0 && (
          <ChipRow className="mt-3">
            {styles.map(s => <Chip key={s} tone="sage" active={style === s} onClick={() => setStyle(style === s ? '' : s)}>{s}</Chip>)}
          </ChipRow>
        )}
        <ChipRow className="mt-3">
          {city && <Chip active onClick={() => setPicking(true)} icon={<MapPin size={14} />}>{city}</Chip>}
          {myRegion && <Chip active={!city && region === myRegion} onClick={() => { setCity(''); setRegion(myRegion); }} icon={<MapPin size={14} />}>האזור שלי · {regionName(myRegion)}</Chip>}
          <Chip active={!city && region === 'all'} onClick={() => { setCity(''); setRegion('all'); }} icon={<Globe2 size={14} />}>כל הארץ</Chip>
          {REGIONS.filter(r => r.id !== myRegion).map(r => <Chip key={r.id} active={!city && region === r.id} onClick={() => { setCity(''); setRegion(r.id); }}>{r.name}</Chip>)}
          <Chip onClick={() => setPicking(true)} icon={<Search size={13} />}>עיר או יישוב…</Chip>
          {filtered && <button onClick={clear} className="mr-auto shrink-0 px-2 text-[13px] text-rose-700 underline decoration-rose-200 underline-offset-4">ניקוי</button>}
        </ChipRow>
      </FilterBar>

      {list === null ? <CardSkeletonGrid count={6} /> : list.length === 0 ? (
        <EmptyState icon={<Store size={28} />} title={error ? 'לא הצלחנו לטעון את המאגר' : 'עוד אין ספקים שמתאימים לחיפוש'}
          text={error || 'אפשר לנסות קטגוריה אחרת, או "כל הארץ". המאגר מתמלא כל הזמן.'}
          action={filtered ? <button onClick={clear} className="btn-ghost">ניקוי סינונים</button> : undefined} />
      ) : (
        <>
          <p className="mb-4 text-[13.5px] text-slate-500">{list.length} ספקים{category !== 'all' ? ` · ${supplierCategoryName(category)}` : ''}{city ? ` · ${city}` : region !== 'all' ? ` · ${regionName(region)}` : ''}</p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:gap-7 lg:grid-cols-3">
            {list.map((s, i) => (
              <ScrollReveal key={s.id} delay={(i % 6) * 60} animation="scale-in">
                <SupplierCard s={s} onOpen={() => setOpen(s)} />
              </ScrollReveal>
            ))}
          </div>
        </>
      )}

      <div className="mt-12 flex flex-col items-center gap-2 rounded-[1.75rem] border border-dashed border-rose-200 bg-white/60 px-6 py-8 text-center">
        <Sparkles className="text-rose-400" size={22} />
        <p className="text-[15px] text-slate-600">מכירים ספק טוב שלא מופיע כאן? שלחו לו את הקישור להצטרפות.</p>
        <Link to="/suppliers/join" className="text-[14px] font-strong text-rose-700 underline underline-offset-4">nashi-co.com · הצטרפות ספקים</Link>
      </div>

      {/* profile */}
      <Sheet open={!!open} onClose={() => setOpen(null)} label={open?.businessName} maxWidth="md:max-w-[640px]">
        {open && (
          <div className="pb-8">
            <div className="relative m-2 overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-rose-50 to-champagne-50">
              {open.gallery?.length ? (
                <div className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
                  {open.gallery.map((g, i) => <img key={i} src={g} alt="" className="aspect-[16/10] w-full shrink-0 snap-center object-cover" />)}
                </div>
              ) : <div className="flex aspect-[16/7] items-center justify-center text-rose-200 [&>svg]:h-14 [&>svg]:w-14">{categoryIcon(open.categories[0])}</div>}
              <div className="absolute left-3 top-3"><IconButton label="סגירה" onClick={() => setOpen(null)}><X size={18} /></IconButton></div>
              {open.gallery?.length > 1 && <span className="absolute bottom-3 left-3 rounded-full bg-ink/60 px-2.5 py-1 text-[11px] text-white">{open.gallery.length} תמונות · החליקי</span>}
            </div>
            <div className="px-5 pt-4 text-right md:px-7">
              <div className="flex items-center gap-3">
                {open.logo ? <img src={open.logo} alt="" className="h-14 w-14 shrink-0 rounded-2xl border border-rose-100 bg-white object-contain p-1.5" />
                  : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-50 font-accent text-3xl text-rose-500">{open.businessName.charAt(0)}</span>}
                <div className="min-w-0">
                  <h2 className="text-[1.8rem] leading-tight">{open.businessName}</h2>
                  <p className="text-[13.5px] text-slate-500">{open.contactName}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {open.categories.map(c => <span key={c} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-[12.5px] text-rose-700"><span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{categoryIcon(c)}</span>{supplierCategoryName(c)}</span>)}
                {open.styles.map(s => <span key={s} className="rounded-full bg-plum-50 px-3 py-1 text-[12.5px] text-plum-700">{s}</span>)}
              </div>
              <div className="mt-5"><ContactButtons s={open} big /></div>
              <p className="mt-6 whitespace-pre-line text-[15px] leading-relaxed text-slate-600">{open.description}</p>
              <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-white p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500"><MapPin size={16} /></span>
                  <div className="min-w-0"><p className="text-[12px] text-slate-400">אזורי שירות</p><p className="text-[14px] text-ink">{open.nationwide ? 'כל הארץ' : [...open.regions.map(r => regionName(r)), ...open.cities].join(' · ') || areaLabel(open)}</p></div>
                </div>
                {(open.priceRange || open.priceNote) && (
                  <div className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-white p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500"><Wallet size={16} /></span>
                    <div><p className="text-[12px] text-slate-400">מחיר</p><p className="text-[14px] text-ink">{priceRangeName(open.priceRange)}{open.priceNote ? <span className="block text-[13px] text-slate-500">{open.priceNote}</span> : null}</p></div>
                  </div>
                )}
              </div>
              <p className="mt-6 text-center text-[12px] text-slate-400">הספקים משלמים על ההופעה במאגר. {BRAND.name} אינו צד להתקשרות — מומלץ לבקש המלצות והצעת מחיר בכתב.</p>
            </div>
          </div>
        )}
      </Sheet>

      {picking && createPortal(
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-ink/40 backdrop-blur-sm md:items-center md:p-6" dir="rtl" onClick={() => setPicking(false)}>
          <div className="w-full rounded-t-[2rem] bg-[#FBF7F4] p-6 pb-8 shadow-2xl animate-fade-in-up md:max-w-md md:rounded-[2rem]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl">ספקים שעובדים ב…</h3>
              <button onClick={() => setPicking(false)} aria-label="סגירה" className="rounded-full p-2 text-slate-400 hover:bg-rose-50"><X size={20} /></button>
            </div>
            <p className="mt-2 text-sm text-slate-500">בחירת עיר או יישוב: יוצגו ספקים שעובדים שם, באזור, או בכל הארץ.</p>
            <CityPicker className="mt-2" value={city} placeholder="חיפוש עיר או יישוב…" locate={false} inline onChange={c => { setCity(c); setPicking(false); }} />
          </div>
        </div>,
        document.body
      )}
    </PageShell>
  );
};

export default SuppliersDirectoryPage;
