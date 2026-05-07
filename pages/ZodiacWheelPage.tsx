import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, Gift, Lock, RefreshCw, Crown, X } from 'lucide-react';
import { User } from '../types';
import { api } from '../services/api';

interface ZodiacWheelPageProps {
  user?: User | null;
  onOpenLogin?: () => void;
}

const luxuryWinColors = ['#fbbf24', '#f59e0b', '#f97316', '#f43f5e'];
const luxuryLoseColors = ['#334155', '#1f2937', '#3f3f46'];
const BASE_SEGMENTS_COUNT = 12;

const ZodiacWheelPage: React.FC<ZodiacWheelPageProps> = ({ user, onOpenLogin }) => {
  const [prizes, setPrizes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [canSpin, setCanSpin] = useState(false);
  const [nextSpinAt, setNextSpinAt] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState('');
  const [totalWinChance, setTotalWinChance] = useState(0);

  const normalizedWinChance = Math.max(0, Math.min(100, Number(totalWinChance) || 0));

  const displaySegments = useMemo(() => {
    if (prizes.length === 0) {
      return Array.from({ length: BASE_SEGMENTS_COUNT }, (_, i) => ({
        key: `lose-${i}`,
        label: 'נסה שוב',
        type: 'lose' as const
      }));
    }

    const winningSlots = Math.max(1, Math.min(BASE_SEGMENTS_COUNT - 1, Math.round((normalizedWinChance / 100) * BASE_SEGMENTS_COUNT)));
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
  }, [prizes, normalizedWinChance]);

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
      const [wheelPrizes, wheelConfig] = await Promise.all([
        api.getZodiacWheelPrizes(),
        api.getZodiacWheelConfig().catch(() => ({ totalWinChance: 0 }))
      ]);
      setPrizes(Array.isArray(wheelPrizes) ? wheelPrizes : []);
      setTotalWinChance(Math.max(0, Math.min(100, Number(wheelConfig?.totalWinChance) || 0)));

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
      const spins = 12 * 360;
      const newRotation = rotation + spins + targetAngle;
      setRotation(newRotation);

      setTimeout(() => {
        setResultMessage(res.message);
        setCanSpin(false);
        setNextSpinAt(res.nextSpinAt || null);
        setSpinning(false);
      }, 6800);
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
    <div className="min-h-screen py-8 px-4" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="bg-gradient-to-l from-rose-100 via-white to-purple-100 rounded-[2.5rem] border border-rose-100 p-8 shadow-xl text-center">
          <h1 className="text-3xl md:text-4xl font-black text-slate-800 flex items-center justify-center gap-3">
            <Sparkles className="text-rose-500" /> גלגל המזל
          </h1>
          <p className="mt-3 text-slate-600 font-medium">סיבוב יומי אחד לכל משתמשת רשומה, עם הטבות שוות ומזל גדול ✨</p>
        </div>

        <div className="grid md:grid-cols-[1fr,360px] gap-8 items-center">
          <div className="relative w-full max-w-[520px] mx-auto">
            <div className="absolute top-[-14px] left-1/2 -translate-x-1/2 z-30 w-0 h-0 border-l-[18px] border-l-transparent border-r-[18px] border-r-transparent border-t-[30px] border-t-amber-200 drop-shadow-[0_8px_10px_rgba(251,191,36,0.4)]" />
            <div
              className="aspect-square rounded-full border-[14px] border-amber-200 shadow-[0_26px_85px_rgba(190,24,93,0.28)] relative overflow-hidden"
              style={{
                background: wheelGradient,
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? 'transform 6.7s cubic-bezier(0.1, 0.86, 0.2, 1)' : 'none'
              }}
            >
              <div className="absolute inset-[8%] rounded-full border border-white/25 pointer-events-none" />
              {spinning && <div className="absolute inset-0 bg-white/10 animate-pulse pointer-events-none" />}
              {displaySegments.map((segment, i) => (
                <div
                  key={segment.key}
                  className="absolute left-1/2 top-1/2 origin-bottom text-white font-black text-xs md:text-sm tracking-wide"
                  style={{
                    transform: `translate(-50%, -100%) rotate(${(i * segmentAngle) + segmentAngle / 2}deg)`,
                    width: '120px',
                    textAlign: 'center'
                  }}
                >
                  <span className="drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] inline-flex items-center justify-center">
                    {segment.type === 'win' ? <Gift size={18} /> : <X size={18} />}
                  </span>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 m-auto w-24 h-24 rounded-full bg-gradient-to-br from-white to-amber-50 border-8 border-rose-200 shadow-[0_12px_30px_rgba(190,24,93,0.25)] flex items-center justify-center z-20">
              <Crown className="text-amber-500" />
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm space-y-4">
            <h3 className="font-black text-xl text-slate-800">מה אפשר לזכות?</h3>
            <div className="text-xs bg-amber-50 border border-amber-100 text-amber-700 p-3 rounded-xl font-bold">
               סיכוי הזכייה הכללי בגלגל: {normalizedWinChance}% (השאר הוא "ללא זכייה")
             </div>
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {prizes.length === 0 ? (
                <p className="text-slate-500 text-sm">אין כרגע הטבות מוגדרות. ניתן עדיין לסובב ולקבל "ללא זכייה".</p>
              ) : prizes.map((p, i) => (
                  <div key={p._id || p.id || i} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="font-bold text-slate-800">{p.title}</p>
                    {p.description && <p className="text-xs text-slate-500 mt-1">{p.description}</p>}
                    <p className="text-xs text-rose-500 mt-1">מלאי: {p.stock}</p>
                  </div>
              ))}
            </div>

            {!user ? (
              <button onClick={onOpenLogin} className="w-full py-3 rounded-xl bg-slate-900 text-white font-black flex items-center justify-center gap-2">
                <Lock size={16} /> התחברי כדי לסובב
              </button>
            ) : (
              <button
                onClick={handleSpin}
                disabled={!canSpin || spinning || loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white font-black disabled:opacity-50 disabled:cursor-not-allowed"
              >
              {spinning ? 'הגלגל מסתובב... מחזיקות אצבעות ✨' : canSpin ? 'סובבי עכשיו' : 'הסיבוב היומי נוצל'}
              </button>
            )}

            {!canSpin && user && (
              <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl">
                הסיבוב הבא ייפתח ב: <span className="font-black text-slate-700">{nextSpinText}</span>
              </p>
            )}

            <button onClick={loadData} className="text-xs text-slate-500 font-bold flex items-center gap-2 hover:text-rose-500">
              <RefreshCw size={14} /> רענון מצב הגלגל
            </button>
          </div>
        </div>

        {resultMessage && (
          <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm text-center font-bold text-slate-700">
            {resultMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default ZodiacWheelPage;
