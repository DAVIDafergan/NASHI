import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, Gift, Lock, RefreshCw, Crown } from 'lucide-react';
import { User } from '../types';
import { api } from '../services/api';
import ScrollReveal from '../components/ScrollReveal';
import { PageShell, PageHero, Skeleton } from '../components/pages/PageKit';

interface ZodiacWheelPageProps {
  user?: User | null;
  onOpenLogin?: () => void;
}

const luxuryWinColors = ['#D9A0A6', '#C98990', '#DDBF8A', '#BD7A81'];
const luxuryLoseColors = ['#62425B', '#4F364A', '#77506E'];
const BASE_SEGMENTS_COUNT = 12;

const ZodiacWheelPage: React.FC<ZodiacWheelPageProps> = ({ user, onOpenLogin }) => {
  const [prizes, setPrizes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [canSpin, setCanSpin] = useState(false);
  const [nextSpinAt, setNextSpinAt] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState('');

  const displaySegments = useMemo(() => {
    if (prizes.length === 0) {
      return Array.from({ length: BASE_SEGMENTS_COUNT }, (_, i) => ({
        key: `lose-${i}`,
        label: 'נסה שוב',
        type: 'lose' as const
      }));
    }

    const winningSlots = Math.max(1, Math.min(BASE_SEGMENTS_COUNT - 1, Math.floor(BASE_SEGMENTS_COUNT / 2)));
    const losingSlots = Math.max(1, BASE_SEGMENTS_COUNT - winningSlots);

    const winSegments = Array.from({ length: winningSlots }, (_, i) => {
      const prize = prizes[i % prizes.length];
      return {
        key: `win-${i}-${prize?._id || prize?.id || i}`,
        label: 'מתנה',
        type: 'win' as const,
        prizeId: prize?._id || prize?.id || ''
      };
    });

    const loseSegments = Array.from({ length: losingSlots }, (_, i) => ({
      key: `lose-${i}`,
      label: 'נסה שוב',
      type: 'lose' as const
    }));

    const segments = [];
    const maxLength = Math.max(winSegments.length, loseSegments.length);
    for (let i = 0; i < maxLength; i += 1) {
      if (winSegments[i]) segments.push(winSegments[i]);
      if (loseSegments[i]) segments.push(loseSegments[i]);
    }

    return segments;
  }, [prizes]);

  const segmentAngle = 360 / displaySegments.length;
  const wheelGradient = `conic-gradient(${displaySegments
    .map((segment, i) => {
      const palette = segment.type === 'win' ? luxuryWinColors : luxuryLoseColors;
      return `${palette[i % palette.length]} ${i * segmentAngle}deg ${(i + 1) * segmentAngle}deg`;
    })
    .join(', ')})`;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const wheelPrizes = await api.getZodiacWheelPrizes();
      setPrizes(Array.isArray(wheelPrizes) ? wheelPrizes : []);

      if (user) {
        const status = await api.getZodiacWheelStatus();
        setCanSpin(!!status?.canSpin);
        setNextSpinAt(status?.nextSpinAt || null);
      } else {
        setCanSpin(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSpin = async () => {
    if (!user) {
      onOpenLogin?.();
      return;
    }

    if (!canSpin || spinning) return;

    try {
      setSpinning(true);
      const res = await api.spinZodiacWheel();

      const winningSegmentIndexes = displaySegments
        .map((segment, index) => segment.type === 'win' ? index : -1)
        .filter(index => index >= 0);
      const losingSegmentIndexes = displaySegments
        .map((segment, index) => segment.type === 'lose' ? index : -1)
        .filter(index => index >= 0);

      const winnerIndex = res.won && res.prize
        ? displaySegments.findIndex(segment => segment.type === 'win' && segment.prizeId === (res.prize._id || res.prize.id))
        : -1;

      const finalIndex = winnerIndex >= 0
        ? winnerIndex
        : (res.won
          ? winningSegmentIndexes[Math.floor(Math.random() * winningSegmentIndexes.length)] ?? 0
          : losingSegmentIndexes[Math.floor(Math.random() * losingSegmentIndexes.length)] ?? 0);
      const targetAngle = 360 - ((finalIndex + 0.5) * segmentAngle);
      const spins = 10 * 360;
      const newRotation = rotation + spins + targetAngle;
      setRotation(newRotation);

      setTimeout(() => {
        setResultMessage(res.message);
        setCanSpin(false);
        setNextSpinAt(res.nextSpinAt || null);
        setSpinning(false);
      }, 5600);
    } catch (error: any) {
      setSpinning(false);
      setResultMessage(error.message || 'שגיאה בסיבוב הגלגל');
      await loadData();
    }
  };

  const nextSpinText = nextSpinAt
    ? new Date(nextSpinAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })
    : 'מחר בשעה 08:00';

  return (
    <PageShell className="!max-w-6xl">
      <PageHero
        eyebrow="גלגל המזלות"
        title="סיבוב אחד ביום,"
        accent="הרבה מזל"
        subtitle="כל משתמשת רשומה מסובבת פעם ביום ויכולה לזכות בהטבות שוות מהעסקים של העיר."
      />

      <div className="grid items-center gap-10 md:grid-cols-[1fr_380px]">
        <ScrollReveal animation="scale-in" className="relative mx-auto w-full max-w-[520px]">
          {/* glow */}
          <div aria-hidden="true" className="absolute inset-[6%] rounded-full bg-rose-300/40 blur-3xl animate-float-y-slow" />
          <div className="absolute top-[-16px] left-1/2 z-30 h-0 w-0 -translate-x-1/2 border-l-[18px] border-r-[18px] border-t-[32px] border-l-transparent border-r-transparent border-t-rose-700 drop-shadow-[0_8px_10px_rgba(165,99,107,0.45)]" />
          <div
            className="relative aspect-square overflow-hidden rounded-full border-[12px] border-white shadow-[0_26px_85px_rgba(165,99,107,0.35)] ring-1 ring-rose-200"
            style={{
              background: wheelGradient,
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 5.5s cubic-bezier(0.12, 0.88, 0.27, 1)' : 'none'
            }}
          >
            <div className="pointer-events-none absolute inset-[8%] rounded-full border border-white/30" />
            {displaySegments.map((segment, i) => (
              <div
                key={segment.key}
                className="absolute left-1/2 top-1/2 flex origin-bottom items-start justify-center pt-[7%] text-white text-[12px] sm:text-[13px] md:text-[15px] font-strong"
                style={{
                  transform: `translate(-50%, -100%) rotate(${(i * segmentAngle) + segmentAngle / 2}deg)`,
                  width: '120px',
                  height: '50%',
                  textAlign: 'center'
                }}
              >
                <span className="drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">{segment.label}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSpin}
            disabled={!!user && (!canSpin || spinning || loading)}
            aria-label="סיבוב הגלגל"
            className="absolute inset-0 z-20 m-auto flex h-24 w-24 items-center justify-center rounded-full border-[6px] border-rose-100 bg-gradient-to-br from-white to-rose-50 shadow-[0_12px_30px_rgba(165,99,107,0.3)] transition hover:scale-105 active:scale-95 disabled:hover:scale-100"
          >
            <Crown className={`text-champagne-500 ${spinning ? 'animate-spin-slow' : ''}`} size={30} />
          </button>
        </ScrollReveal>

        <ScrollReveal delay={120} className="space-y-4 rounded-[2rem] border border-rose-100/70 bg-white p-6 shadow-lift">
          <h3 className="text-[1.3rem]">מה אפשר לזכות?</h3>
          <p className="rounded-2xl border border-champagne-100 bg-champagne-50 p-3 text-[13px] text-champagne-800">
            לכל הטבה יש מספר זוכות יומי שהמנהלת קובעת.
          </p>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <>
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </>
            ) : prizes.length === 0 ? (
              <p className="text-[14px] text-slate-500">אין כרגע הטבות מוגדרות. אפשר עדיין לסובב ולנסות את המזל.</p>
            ) : prizes.map((p, i) => (
                <div key={p._id || p.id || i} className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50/40 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-rose-500 shadow-soft"><Gift size={16} /></span>
                  <div className="min-w-0">
                    <p className="text-[15px] text-ink font-strong">{p.title}</p>
                    {p.description && <p className="mt-0.5 text-[13px] text-slate-500">{p.description}</p>}
                    <p className="mt-1 text-[12px] text-rose-600">נשארו: {p.stock}</p>
                  </div>
                </div>
            ))}
          </div>

          {!user ? (
            <button onClick={onOpenLogin} className="btn-primary w-full !py-3.5">
              <Lock size={16} /> התחברי כדי לסובב
            </button>
          ) : (
            <button
              onClick={handleSpin}
              disabled={!canSpin || spinning || loading}
              className="btn-primary w-full !py-3.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles size={17} />
              {spinning ? 'הגלגל מסתובב…' : canSpin ? 'סובבי עכשיו' : 'הסיבוב היומי נוצל'}
            </button>
          )}

          {!canSpin && user && (
            <p className="rounded-2xl bg-rose-50/50 p-3 text-[13px] text-slate-500">
              הסיבוב הבא ייפתח ב־<span className="text-ink font-strong">{nextSpinText}</span>
            </p>
          )}

          <button onClick={loadData} className="flex items-center gap-2 text-[13px] text-slate-500 hover:text-rose-700">
            <RefreshCw size={14} /> רענון מצב הגלגל
          </button>
        </ScrollReveal>
      </div>

      {resultMessage && (
        <div role="status" className="mt-8 rounded-[1.5rem] border border-rose-200 bg-gradient-to-l from-rose-50 via-white to-champagne-50 p-6 text-center animate-bounce-in">
          <Sparkles className="mx-auto mb-2 text-rose-500" />
          <p className="font-display text-[1.6rem] leading-snug text-ink">{resultMessage}</p>
        </div>
      )}
    </PageShell>
  );
};

export default ZodiacWheelPage;
