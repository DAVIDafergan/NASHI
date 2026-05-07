import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, Gift, Lock, RefreshCw } from 'lucide-react';
import { User } from '../types';
import { api } from '../services/api';

interface ZodiacWheelPageProps {
  user?: User | null;
  onOpenLogin?: () => void;
}

const wheelColors = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const DEFAULT_NON_WIN_STOCK = Number.MAX_SAFE_INTEGER;

const ZodiacWheelPage: React.FC<ZodiacWheelPageProps> = ({ user, onOpenLogin }) => {
  const [prizes, setPrizes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [canSpin, setCanSpin] = useState(false);
  const [nextSpinAt, setNextSpinAt] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState('');

  const activeSegments = useMemo(() => {
    if (prizes.length === 0) {
      return [{ _id: 'default', title: 'ללא זכייה', description: '', stock: DEFAULT_NON_WIN_STOCK, winChance: 0 }];
    }
    return prizes;
  }, [prizes]);

  const segmentAngle = 360 / activeSegments.length;
  const wheelGradient = `conic-gradient(${activeSegments
    .map((_, i) => `${wheelColors[i % wheelColors.length]} ${i * segmentAngle}deg ${(i + 1) * segmentAngle}deg`)
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

      const winnerIndex = res.won && res.prize
        ? activeSegments.findIndex(p => (p._id || p.id) === (res.prize._id || res.prize.id))
        : -1;

      const finalIndex = winnerIndex >= 0 ? winnerIndex : Math.floor(Math.random() * activeSegments.length);
      const targetAngle = 360 - ((finalIndex + 0.5) * segmentAngle);
      const spins = 8 * 360;
      const newRotation = rotation + spins + targetAngle;
      setRotation(newRotation);

      setTimeout(() => {
        setResultMessage(res.message);
        setCanSpin(false);
        setNextSpinAt(res.nextSpinAt || null);
        setSpinning(false);
      }, 4200);
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
            <Sparkles className="text-rose-500" /> גלגל המזלות
          </h1>
          <p className="mt-3 text-slate-600 font-medium">סיבוב יומי אחד לכל משתמשת רשומה, עם הטבות שוות ומזל גדול ✨</p>
        </div>

        <div className="grid md:grid-cols-[1fr,360px] gap-8 items-center">
          <div className="relative w-full max-w-[520px] mx-auto">
            <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[26px] border-t-slate-900" />
            <div
              className="aspect-square rounded-full border-[12px] border-amber-200 shadow-[0_25px_80px_rgba(190,24,93,0.25)] relative overflow-hidden"
              style={{
                background: wheelGradient,
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? 'transform 4.2s cubic-bezier(0.18, 0.96, 0.33, 1)' : 'none'
              }}
            >
              {activeSegments.map((segment, i) => (
                <div
                  key={segment._id || segment.id || i}
                  className="absolute left-1/2 top-1/2 origin-bottom text-white font-black text-sm md:text-base"
                  style={{
                    transform: `translate(-50%, -100%) rotate(${(i * segmentAngle) + segmentAngle / 2}deg)`,
                    width: '120px',
                    textAlign: 'center'
                  }}
                >
                  <span className="drop-shadow-lg">{segment.title}</span>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-white border-8 border-rose-200 shadow-lg flex items-center justify-center z-10">
              <Gift className="text-rose-500" />
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm space-y-4">
            <h3 className="font-black text-xl text-slate-800">מה אפשר לזכות?</h3>
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {prizes.length === 0 ? (
                <p className="text-slate-500 text-sm">אין כרגע הטבות מוגדרות. ניתן עדיין לסובב ולקבל "ללא זכייה".</p>
              ) : prizes.map((p, i) => (
                <div key={p._id || p.id || i} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="font-bold text-slate-800">{p.title}</p>
                  {p.description && <p className="text-xs text-slate-500 mt-1">{p.description}</p>}
                  <p className="text-xs text-rose-500 mt-1">מלאי: {p.stock} | סיכוי: {p.winChance}%</p>
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
                {spinning ? 'הגלגל מסתובב...' : canSpin ? 'סובבי עכשיו' : 'הסיבוב היומי נוצל'}
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
