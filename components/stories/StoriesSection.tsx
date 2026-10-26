import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Camera, Check, Clock, Eye, ImagePlus, Link2, Loader2, Plus, Trash2, Type, X } from 'lucide-react';
import { api } from '../../services/api';
import { compressImageFile } from '../../utils/image';
import { renderStoryCard, STORY_THEMES, themeOf } from '../../utils/storyCard';
import { downloadBlob, shareImageFile, shareLink } from '../../utils/share';
import { BRAND } from '../../shared/brand';

type StoryUser = { _id?: string; id?: string; name?: string; avatar?: string };
export type Story = {
  _id: string; user?: StoryUser; type: 'text' | 'image'; content: string; caption?: string; background?: string;
  status?: 'pending' | 'approved'; approvedAt?: string; createdAt?: string; views?: number;
};
type Group = { userId: string; user?: StoryUser; stories: Story[] };

const DURATION = 7000;
const DAY = 24 * 60 * 60 * 1000;
const uid = (u?: StoryUser | null) => (u?._id || u?.id || '') as string;
const firstName = (n?: string) => (n || 'מהקהילה').trim().split(' ')[0];
const timeAgo = (d?: string) => {
  if (!d) return '';
  const m = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.round(m / 60);
  return h === 1 ? 'לפני שעה' : `לפני ${h} שעות`;
};

const WhatsAppIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.86 9.86 0 0 0 12.04 2Zm5.8 14.03c-.25.69-1.44 1.32-1.98 1.36-.51.05-.98.24-3.32-.69-2.8-1.1-4.58-3.97-4.72-4.15-.14-.18-1.13-1.5-1.13-2.87 0-1.36.71-2.03.97-2.31.25-.28.55-.35.74-.35l.53.01c.17.01.4-.06.62.48.25.6.83 2.06.9 2.21.07.14.12.31.02.5-.09.18-.14.3-.28.46l-.42.49c-.14.14-.29.3-.12.58.17.28.74 1.22 1.59 1.98 1.09.97 2.01 1.27 2.29 1.42.28.14.45.12.61-.07.17-.18.71-.83.9-1.11.19-.28.37-.23.62-.14.26.09 1.63.77 1.91.91.28.14.46.21.53.32.07.12.07.67-.18 1.36Z" /></svg>
);

/** Ring around an avatar, one segment per status. */
const Ring: React.FC<{ count: number; seen?: boolean }> = ({ count, seen }) => {
  const r = 32.5, c = 2 * Math.PI * r, gap = count > 1 ? 7 : 0, dash = c / count - gap;
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 69 69" aria-hidden="true">
      <defs><linearGradient id="nashi-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#A5636B" /><stop offset="1" stopColor="#E7B9BC" /></linearGradient></defs>
      <circle cx="34.5" cy="34.5" r={r} fill="none" stroke={seen ? '#E5D9D6' : 'url(#nashi-ring)'} strokeWidth="2.6" strokeDasharray={count > 1 ? `${dash} ${gap}` : undefined} strokeLinecap="round" />
    </svg>
  );
};

const Avatar: React.FC<{ u?: StoryUser; className?: string }> = ({ u, className = '' }) =>
  u?.avatar ? <img src={u.avatar} alt="" className={`rounded-full object-cover ${className}`} />
    : <span className={`flex items-center justify-center rounded-full bg-gradient-to-br from-rose-200 to-rose-400 font-strong text-white ${className}`}>{firstName(u?.name).charAt(0)}</span>;

/** Status body: used in the viewer and in the composer preview. */
const StoryBody: React.FC<{ s: Pick<Story, 'type' | 'content' | 'caption' | 'background'> }> = ({ s }) => {
  if (s.type === 'image') {
    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-ink">
        <img src={s.content} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" aria-hidden="true" />
        <img src={s.content} alt="" className="relative max-h-full max-w-full object-contain" />
        {s.caption && (
          <p className="absolute inset-x-4 bottom-24 rounded-2xl bg-black/35 px-4 py-3 text-center font-strong text-lg leading-snug text-white backdrop-blur-md">{s.caption}</p>
        )}
      </div>
    );
  }
  const t = themeOf(s.background);
  const len = s.content.length;
  return (
    <div className="flex h-full w-full items-center justify-center px-8 text-center" style={{ background: t.css, color: t.ink }}>
      <p style={{ color: t.ink }} className={`whitespace-pre-line font-display font-light leading-[1.4] ${len < 60 ? 'text-[2.4rem]' : len < 160 ? 'text-[1.9rem]' : 'text-[1.4rem]'}`}>{s.content || 'מה חדש היום?'}</p>
    </div>
  );
};

const StoriesSection: React.FC<{ user: any; onOpenLogin: () => void }> = ({ user, onOpenLogin }) => {
  const location = useLocation();
  const [stories, setStories] = useState<Story[]>([]);
  const [mine, setMine] = useState<Story[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [seen, setSeen] = useState<Record<string, true>>(() => { try { return JSON.parse(localStorage.getItem('nashi-seen-stories') || '{}'); } catch { return {}; } });

  // viewer
  const [open, setOpen] = useState<{ g: number; i: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);

  // composer
  const [composer, setComposer] = useState(false);
  const [draft, setDraft] = useState<{ type: 'text' | 'image'; content: string; caption: string; background: string }>({ type: 'text', content: '', caption: '', background: 'rose' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 3200); };
  const myId = uid(user);

  const load = useCallback(async () => {
    const [all, my] = await Promise.all([api.getStories().catch(() => []), user ? api.getMyStories().catch(() => []) : Promise.resolve([])]);
    const now = Date.now();
    setStories((Array.isArray(all) ? all : []).filter((s: Story) => now - new Date(s.approvedAt || s.createdAt || now).getTime() < DAY));
    setMine((Array.isArray(my) ? my : []).filter((s: Story) => s.status === 'pending'));
    setLoaded(true);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const groups: Group[] = useMemo(() => {
    const map = new Map<string, Group>();
    stories.forEach(s => {
      const id = uid(s.user) || s._id;
      if (!map.has(id)) map.set(id, { userId: id, user: s.user, stories: [] });
      map.get(id)!.stories.push(s);
    });
    const list = Array.from(map.values());
    // my own first, then unseen, then seen
    return list.sort((a, b) => {
      if (a.userId === myId) return -1;
      if (b.userId === myId) return 1;
      const as = a.stories.every(s => seen[s._id]) ? 1 : 0;
      const bs = b.stories.every(s => seen[s._id]) ? 1 : 0;
      return as - bs;
    });
  }, [stories, seen, myId]);

  const current = open ? groups[open.g]?.stories[open.i] : null;
  const currentGroup = open ? groups[open.g] : null;
  const isMine = !!current && uid(current.user) === myId && !!myId;

  // open from a shared link (?storyId=...)
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('storyId');
    if (!id || !groups.length) return;
    groups.forEach((g, gi) => { const i = g.stories.findIndex(s => s._id === id); if (i >= 0) setOpen({ g: gi, i }); });
  }, [location.search, groups.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => { setOpen(null); setProgress(0); setPaused(false); }, []);
  const next = useCallback(() => {
    setProgress(0);
    setOpen(o => {
      if (!o) return o;
      const g = groups[o.g];
      if (g && o.i < g.stories.length - 1) return { g: o.g, i: o.i + 1 };
      if (o.g < groups.length - 1) return { g: o.g + 1, i: 0 };
      return null;
    });
  }, [groups]);
  const prev = useCallback(() => {
    setProgress(0);
    setOpen(o => {
      if (!o) return o;
      if (o.i > 0) return { g: o.g, i: o.i - 1 };
      if (o.g > 0) return { g: o.g - 1, i: groups[o.g - 1].stories.length - 1 };
      return { g: 0, i: 0 };
    });
  }, [groups]);

  // mark seen + count view
  useEffect(() => {
    if (!current) return;
    setSeen(s => {
      if (s[current._id]) return s;
      const n = { ...s, [current._id]: true as const };
      try { localStorage.setItem('nashi-seen-stories', JSON.stringify(n)); } catch { /* ignore */ }
      return n;
    });
    if (user) api.viewStory(current._id).catch(() => {});
  }, [current?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // progress timer
  useEffect(() => {
    if (!open || paused || busy) return;
    const step = 50;
    const t = window.setInterval(() => setProgress(p => p + (step / DURATION) * 100), step);
    return () => window.clearInterval(t);
  }, [open, paused, busy]);
  useEffect(() => { if (progress >= 100) next(); }, [progress, next]);

  // keyboard + lock page scroll
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') next();
      if (e.key === 'ArrowRight') prev();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [open, close, next, prev]);

  // ---------- sharing ----------
  const shareToStatus = async (s: Pick<Story, 'type' | 'content' | 'caption' | 'background'>, authorName?: string) => {
    setBusy('status');
    try {
      const blob = await renderStoryCard({ ...s, authorName });
      const r = await shareImageFile(blob, 'nashi-status.jpg', `מתוך ${BRAND.name} · nashi-co.com`);
      if (r === 'unsupported') {
        downloadBlob(blob, 'nashi-status.jpg');
        flash('התמונה ירדה למכשיר. מעלים אותה לסטטוס בוואטסאפ מהטלפון 💚');
      } else if (r === 'shared') {
        flash('בוחרים "הסטטוס שלי" בוואטסאפ, וזה עולה ✨');
      }
    } catch (e: any) {
      flash(e?.message || 'לא הצלחנו להכין את התמונה');
    } finally { setBusy(''); }
  };
  const shareAsLink = async (s: Story) => {
    setPaused(true);
    await shareLink({
      title: `סטטוס מ${BRAND.name}`,
      text: s.type === 'text' ? `״${s.content.slice(0, 120)}״ — מתוך ${BRAND.name}` : (s.caption || `מה שותף ב${BRAND.name}`),
      path: `/s/story/${s._id}`,
    });
    setPaused(false);
  };

  const removeMine = async (s: Story) => {
    if (!window.confirm('למחוק את הסטטוס?')) return;
    setBusy('delete');
    try {
      await api.deleteMyStory(s._id);
      setStories(list => list.filter(x => x._id !== s._id));
      setMine(list => list.filter(x => x._id !== s._id));
      close();
    } catch { flash('המחיקה נכשלה'); }
    finally { setBusy(''); }
  };

  // ---------- composer ----------
  const openComposer = () => {
    if (!user) { onOpenLogin(); return; }
    setDraft({ type: 'text', content: '', caption: '', background: 'rose' });
    setSent(false); setError(''); setComposer(true);
  };
  const pickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError('');
    try { const img = await compressImageFile(f, 1440, 0.85); setDraft(d => ({ ...d, type: 'image', content: img })); }
    catch { setError('לא הצלחנו לקרוא את התמונה'); }
    e.target.value = '';
  };
  const submit = async () => {
    if (!draft.content.trim()) { setError(draft.type === 'text' ? 'כמה מילים, לפחות 🙂' : 'יש לבחור תמונה'); return; }
    setSending(true); setError('');
    try {
      await api.uploadStory({ type: draft.type, content: draft.content, caption: draft.caption, background: draft.type === 'text' ? draft.background : '' });
      setSent(true);
      load();
    } catch (e: any) { setError(e?.message || 'השליחה נכשלה'); }
    finally { setSending(false); }
  };

  // ---------- touch gestures in the viewer ----------
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }; setPaused(true); };
  const onTouchEnd = (e: React.TouchEvent) => {
    const st = touch.current; touch.current = null; setPaused(false);
    if (!st) return;
    const dx = e.changedTouches[0].clientX - st.x;
    const dy = e.changedTouches[0].clientY - st.y;
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) { close(); return; }
    if (Math.abs(dx) > 60) { dx < 0 ? next() : prev(); return; }
    if (Date.now() - st.t < 250) {
      const w = (e.currentTarget as HTMLElement).clientWidth;
      e.changedTouches[0].clientX < w / 2 ? next() : prev();
    }
  };

  const myPendingCount = mine.length;

  return (
    <section>
      <div className="mb-4 flex items-end justify-between px-5 md:px-0">
        <div>
          <p className="eyebrow">סטטוסים מהקהילה</p>
          <p className="mt-1 text-xs text-slate-400">רגעים קטנים שנעלמים אחרי 24 שעות</p>
        </div>
        {groups.length > 0 && <span className="rounded-full bg-white/80 px-3 py-1 text-xs text-rose-700 shadow-soft">{stories.length} חדשים</span>}
      </div>

      <div className="no-scrollbar flex w-full snap-x gap-4 overflow-x-auto px-5 pb-2 pt-1 md:px-0">
        {/* add */}
        <button type="button" onClick={openComposer} className="group flex w-[78px] shrink-0 snap-center flex-col items-center gap-2">
          <span className="relative flex h-[76px] w-[76px] items-center justify-center rounded-full border border-dashed border-rose-300 bg-white p-1 shadow-petal transition duration-500 group-hover:scale-[1.06] group-active:scale-95">
            {user?.avatar ? <img src={user.avatar} alt="" className="h-full w-full rounded-full object-cover" /> : <span className="flex h-full w-full items-center justify-center rounded-full bg-rose-50 text-rose-400"><Camera size={22} strokeWidth={1.5} /></span>}
            <span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white bg-rose-600 p-[5px] text-white shadow-md transition-transform duration-500 group-hover:rotate-90"><Plus size={12} strokeWidth={3} /></span>
          </span>
          <span className="text-[12px] font-medium text-slate-600">{myPendingCount ? 'ממתין לאישור' : 'הסטטוס שלי'}</span>
        </button>

        {!loaded && [0, 1, 2, 3].map(i => (
          <span key={i} className="flex w-[78px] shrink-0 flex-col items-center gap-2"><span className="h-[76px] w-[76px] animate-pulse rounded-full bg-rose-100/70" /><span className="h-2.5 w-12 animate-pulse rounded-full bg-rose-100/70" /></span>
        ))}

        {groups.map((g, gi) => {
          const allSeen = g.stories.every(s => seen[s._id]);
          return (
            <button type="button" key={g.userId} onClick={() => { setOpen({ g: gi, i: Math.max(0, g.stories.findIndex(s => !seen[s._id])) }); setProgress(0); }}
              className="flex w-[78px] shrink-0 snap-center flex-col items-center gap-2 animate-scale-in" style={{ animationDelay: `${gi * 60}ms` }}>
              <span className="relative flex h-[76px] w-[76px] items-center justify-center p-[4px] transition duration-500 hover:scale-[1.06] active:scale-95">
                <Ring count={g.stories.length} seen={allSeen} />
                <Avatar u={g.user} className="relative z-10 h-full w-full border-[3px] border-white bg-white text-2xl" />
              </span>
              <span className={`w-[78px] truncate text-center text-[12px] ${allSeen ? 'text-slate-400' : 'font-semibold text-slate-700'}`}>{g.userId === myId ? 'שלי' : firstName(g.user?.name)}</span>
            </button>
          );
        })}

        {loaded && groups.length === 0 && (
          <button type="button" onClick={openComposer} className="flex shrink-0 items-center gap-3 rounded-full border border-rose-100 bg-white/80 px-5 text-right shadow-soft">
            <span className="text-sm text-slate-600">עוד אין סטטוסים היום, <span className="font-strong text-rose-700">אולי הראשון שלך?</span></span>
          </button>
        )}
      </div>

      {/* ================= VIEWER ================= */}
      {open && current && currentGroup && createPortal(
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-ink/95 backdrop-blur-xl animate-fade-in" dir="rtl" role="dialog" aria-label="צפייה בסטטוס">
          <div className="relative h-full w-full overflow-hidden md:h-[min(92vh,860px)] md:w-auto md:aspect-[9/16] md:rounded-[2rem] md:shadow-2xl"
            onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
            onMouseDown={() => setPaused(true)} onMouseUp={() => setPaused(false)} onMouseLeave={() => setPaused(false)}>
            <StoryBody key={current._id} s={current} />

            {/* tap zones (desktop) */}
            <button type="button" aria-label="הבא" className="absolute inset-y-24 left-0 hidden w-1/3 md:block" onClick={next} />
            <button type="button" aria-label="הקודם" className="absolute inset-y-24 right-0 hidden w-1/3 md:block" onClick={prev} />

            {/* top bar */}
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 to-transparent px-3 pb-10 pt-[max(12px,env(safe-area-inset-top))]"
              onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
              <div className="flex gap-1">
                {currentGroup.stories.map((s, i) => (
                  <span key={s._id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35">
                    <span className="block h-full rounded-full bg-white" style={{ width: i < open.i ? '100%' : i === open.i ? `${Math.min(100, progress)}%` : '0%' }} />
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Avatar u={current.user} className="h-10 w-10 border-2 border-white/70 text-base" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-strong text-[15px] text-white">{isMine ? 'הסטטוס שלי' : current.user?.name || 'מהקהילה'}</p>
                  <p className="text-[11px] text-white/70">{timeAgo(current.approvedAt || current.createdAt)}</p>
                </div>
                {isMine && <span className="flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-xs text-white"><Eye size={13} /> {current.views || 0}</span>}
                {isMine && <button onClick={() => removeMine(current)} className="rounded-full bg-black/25 p-2.5 text-white hover:bg-red-500/80" aria-label="מחיקה"><Trash2 size={17} /></button>}
                <button onClick={close} className="rounded-full bg-black/25 p-2.5 text-white hover:bg-black/40" aria-label="סגירה"><X size={19} /></button>
              </div>
            </div>

            {/* bottom actions */}
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/60 to-transparent px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-12"
              onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
              <button onClick={() => shareToStatus(current, current.user?.name)} disabled={busy === 'status'}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#1FA855] py-3 font-strong text-[15px] text-white shadow-lg transition hover:bg-[#178a45] disabled:opacity-70">
                {busy === 'status' ? <Loader2 size={18} className="animate-spin" /> : <WhatsAppIcon />} לסטטוס שלי בוואטסאפ
              </button>
              <button onClick={() => shareAsLink(current)} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur hover:bg-white/30" aria-label="שליחת קישור">
                <Link2 size={19} />
              </button>
            </div>
          </div>
          {/* desktop arrows */}
          <button onClick={prev} className="absolute right-6 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 md:flex" aria-label="הקודם">›</button>
          <button onClick={next} className="absolute left-6 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 md:flex" aria-label="הבא">‹</button>
        </div>,
        document.body
      )}

      {/* ================= COMPOSER ================= */}
      {composer && createPortal(
        <div className="fixed inset-0 z-[450] flex items-end justify-center bg-ink/50 backdrop-blur-sm animate-fade-in md:items-center md:p-6" dir="rtl" onClick={() => !sending && setComposer(false)}>
          <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-[2rem] bg-[#FBF7F4] p-5 shadow-2xl md:max-w-[440px] md:rounded-[2rem] animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl">{sent ? 'נשלח!' : 'סטטוס חדש'}</h3>
              <button onClick={() => setComposer(false)} className="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X size={20} /></button>
            </div>

            {sent ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check /></div>
                <p className="text-slate-600 leading-relaxed">הסטטוס עבר לאישור הצוות, ויופיע לכולם ל־24 שעות מרגע האישור.</p>
                <div className="rounded-[1.5rem] bg-white p-4 shadow-soft">
                  <p className="font-strong text-ink">לשתף גם בוואטסאפ?</p>
                  <p className="mt-1 text-xs text-slate-500">נכין תמונה מעוצבת בגודל של סטטוס, עם הכתובת של {BRAND.name}.</p>
                  <button onClick={() => shareToStatus(draft, user?.name)} disabled={busy === 'status'} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#1FA855] py-3 font-strong text-white hover:bg-[#178a45] disabled:opacity-70">
                    {busy === 'status' ? <Loader2 size={18} className="animate-spin" /> : <WhatsAppIcon />} לסטטוס שלי בוואטסאפ
                  </button>
                </div>
                <button onClick={() => setComposer(false)} className="btn-ghost w-full">סגירה</button>
              </div>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-white p-1 shadow-soft">
                  {([['text', 'טקסט', <Type key="t" size={15} />], ['image', 'תמונה', <ImagePlus key="i" size={15} />]] as const).map(([k, label, icon]) => (
                    <button key={k} onClick={() => setDraft(d => ({ ...d, type: k, content: d.type === k ? d.content : '' }))}
                      className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-sm transition ${draft.type === k ? 'bg-rose-700 font-strong text-white' : 'text-slate-500'}`}>{icon}{label}</button>
                  ))}
                </div>

                <div className="relative mx-auto aspect-[9/16] max-h-[52vh] overflow-hidden rounded-[1.6rem] shadow-lift">
                  {draft.type === 'text' ? (
                    <div className="relative h-full w-full" style={{ background: themeOf(draft.background).css }}>
                      <textarea autoFocus maxLength={700} value={draft.content} onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
                        placeholder="מה חדש היום?"
                        className="absolute inset-0 h-full w-full resize-none bg-transparent px-6 pt-[30%] text-center font-display text-[1.7rem] font-light leading-[1.4] outline-none placeholder:text-current placeholder:opacity-60"
                        style={{ color: themeOf(draft.background).ink }} />
                      <span className="absolute bottom-3 left-4 text-[11px] opacity-70" style={{ color: themeOf(draft.background).ink }}>{draft.content.length}/700</span>
                    </div>
                  ) : draft.content ? (
                    <>
                      <StoryBody s={{ ...draft, caption: draft.caption }} />
                      <label className="absolute left-3 top-3 cursor-pointer rounded-full bg-black/40 px-3 py-1.5 text-xs text-white backdrop-blur">החלפה<input type="file" accept="image/*" className="sr-only" onChange={pickImage} /></label>
                    </>
                  ) : (
                    <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-3 bg-gradient-to-b from-rose-50 to-rose-100 text-rose-600">
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-soft"><ImagePlus size={26} /></span>
                      <span className="font-strong">בחירת תמונה</span>
                      <span className="text-xs text-rose-500/80">אפשר ישר מהמצלמה</span>
                      <input type="file" accept="image/*" className="sr-only" onChange={pickImage} />
                    </label>
                  )}
                </div>

                {draft.type === 'text' ? (
                  <div className="mt-4 flex justify-center gap-2.5">
                    {Object.entries(STORY_THEMES).map(([k, t]) => (
                      <button key={k} onClick={() => setDraft(d => ({ ...d, background: k }))} aria-label={k}
                        className={`h-9 w-9 rounded-full border-2 transition ${draft.background === k ? 'scale-110 border-ink' : 'border-white'}`} style={{ background: t.css }} />
                    ))}
                  </div>
                ) : draft.content ? (
                  <input value={draft.caption} maxLength={300} onChange={e => setDraft(d => ({ ...d, caption: e.target.value }))} placeholder="כיתוב (לא חובה)"
                    className="mt-4 w-full rounded-2xl border border-rose-100 bg-white px-4 py-3 outline-none focus:ring-4 focus:ring-rose-100" />
                ) : null}

                {error && <p className="mt-3 text-center text-sm font-semibold text-rose-700">{error}</p>}
                <button onClick={submit} disabled={sending} className="btn-primary mt-5 w-full !py-3.5 disabled:opacity-60">
                  {sending ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} פרסום הסטטוס
                </button>
                <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-slate-400"><Clock size={12} /> עולה לאתר אחרי אישור הצוות, ונעלם אחרי 24 שעות</p>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {toast && createPortal(<div className="fixed bottom-28 left-1/2 z-[500] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl bg-ink px-5 py-3 text-center text-sm text-white shadow-lift md:bottom-8">{toast}</div>, document.body)}
    </section>
  );
};

export default StoriesSection;
