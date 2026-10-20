import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { useMyPlace, isNear } from '../hooks/useMyPlace';

type Ad = {
  _id: string; title?: string; advertiser?: string; type: 'image' | 'video'; content: string; mobileContent?: string;
  link?: string; ctaText?: string; placements?: string[]; scope?: string; region?: string;
};

// one request for all slots on the page
let cache: { at: number; data: Ad[] } | null = null;
let inflight: Promise<Ad[]> | null = null;
const loadAds = (): Promise<Ad[]> => {
  if (cache && Date.now() - cache.at < 60_000) return Promise.resolve(cache.data);
  if (!inflight) inflight = api.getAds().then((d: any) => { const data = Array.isArray(d) ? d : []; cache = { at: Date.now(), data }; return data; })
    .catch(() => []).finally(() => { inflight = null; });
  return inflight;
};
const seen = new Set<string>();

const youtubeId = (url: string) => (/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/.exec(url) || [])[1];
const isVideoFile = (s: string) => s.startsWith('data:video') || /\.(mp4|webm|mov)(\?|$)/i.test(s);

/** A labelled ad space. Shows the active ads for this placement (and the visitor's area), rotating every 7s. */
const AdSlot: React.FC<{ placement: string; className?: string }> = ({ placement, className = '' }) => {
  const { region } = useMyPlace(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [i, setI] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { let alive = true; loadAds().then(d => alive && setAds(d)); return () => { alive = false; }; }, []);
  const mine = useMemo(() => ads.filter(a => (a.placements?.length ? a.placements : ['home-middle']).includes(placement) && isNear(a, region)), [ads, placement, region]);
  const ad = mine[i % Math.max(mine.length, 1)];

  // rotate
  useEffect(() => {
    if (mine.length < 2 || ad?.type === 'video') return;
    const t = window.setInterval(() => setI(x => x + 1), 7000);
    return () => window.clearInterval(t);
  }, [mine.length, ad?.type]);

  // count a view once per ad per visit, when at least half of it is on screen
  useEffect(() => {
    const el = box.current;
    if (!el || !ad || seen.has(ad._id)) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !seen.has(ad._id)) { seen.add(ad._id); api.trackAd(ad._id, 'view'); io.disconnect(); }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [ad?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ad) return null;
  const open = () => {
    api.trackAd(ad._id, 'click');
    if (ad.link) window.open(/^(https?:|tel:|mailto:)/i.test(ad.link) ? ad.link : `https://${ad.link}`, '_blank', 'noopener');
  };
  const yt = ad.type === 'video' ? youtubeId(ad.content) : '';
  const clickable = !!ad.link;

  return (
    <section className={`px-5 md:px-0 ${className}`} aria-label="פרסום">
      <div ref={box} className="relative overflow-hidden rounded-[1.75rem] border border-rose-100/80 bg-white shadow-soft">
        <div role={clickable ? 'link' : undefined} tabIndex={clickable ? 0 : -1} onClick={clickable && !yt ? open : undefined} onKeyDown={e => { if (clickable && e.key === 'Enter') open(); }}
          className={`relative block w-full ${clickable && !yt ? 'cursor-pointer' : ''}`}>
          {ad.type === 'image' ? (
            <picture>
              {ad.mobileContent && <source media="(max-width: 639px)" srcSet={ad.mobileContent} />}
              <img key={ad._id} src={ad.content} alt={ad.title || 'פרסום'} loading="lazy" decoding="async"
                className={`w-full animate-fade-in ${ad.mobileContent ? 'aspect-square sm:aspect-[3/1]' : 'aspect-[3/1]'} object-cover`} />
            </picture>
          ) : yt ? (
            <div className="aspect-video w-full bg-ink">
              <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${yt}?rel=0`} title={ad.title || 'סרטון'} allow="encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
            </div>
          ) : isVideoFile(ad.content) || ad.content.includes('/api/media/') ? (
            <video key={ad._id} src={ad.content} autoPlay muted loop={mine.length < 2} playsInline preload="metadata"
              onEnded={() => setI(x => x + 1)} className="aspect-[16/7] w-full bg-ink object-cover" />
          ) : null}
          {/* caption */}
          <div className="flex items-center gap-3 border-t border-rose-50 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] text-slate-400">{ad.advertiser ? `בשיתוף ${ad.advertiser}` : 'פרסום'}</p>
              {ad.title && <p className="line-clamp-2 font-strong text-[15px] leading-snug text-ink">{ad.title}</p>}
            </div>
            {clickable && (
              <button type="button" onClick={e => { e.stopPropagation(); open(); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-700 px-4 py-2 text-[13px] font-strong text-white transition hover:bg-rose-800">
                {ad.ctaText || 'לפרטים'} <ArrowLeft size={14} />
              </button>
            )}
          </div>
        </div>
        {mine.length > 1 && (
          <div className="absolute left-3 top-3 flex gap-1.5" aria-hidden="true">
            {mine.map((a, k) => <span key={a._id} className={`h-1.5 rounded-full transition-all ${k === i % mine.length ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`} />)}
          </div>
        )}
      </div>
    </section>
  );
};

export default AdSlot;
