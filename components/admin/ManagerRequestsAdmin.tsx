import React, { useState } from 'react';
import { Check, Loader2, MapPin, MessageCircle, Phone, ShieldCheck, X } from 'lucide-react';
import { api } from '../../services/api';
import { regionName, REGIONS } from '../../shared/regions';
import { Badge, fmtDate, idOf, toast } from './ui';

/** Requests to become a regional culture manager — the main admin approves (and can change the region) or declines. */
const ManagerRequestsAdmin: React.FC<{ items: any[]; reload: () => void }> = ({ items, reload }) => {
  const [busy, setBusy] = useState('');
  const [regionFor, setRegionFor] = useState<Record<string, string>>({});
  if (!items.length) return null;
  const decide = async (a: any, decision: 'approve' | 'reject') => {
    if (decision === 'reject' && !window.confirm(`לדחות את הבקשה של ${a.name || a.user?.name}?`)) return;
    setBusy(idOf(a) + decision);
    try {
      const region = regionFor[idOf(a)] || a.region;
      await api.decideManagerApplication(idOf(a), decision, region);
      toast(decision === 'approve' ? `${a.name || a.user?.name} מנהלת עכשיו את ${regionName(region)} ✨` : 'הבקשה נדחתה');
      reload();
    } catch (e: any) { toast(e?.message || 'הפעולה נכשלה', 'bad'); }
    finally { setBusy(''); }
  };
  const wa = (phone?: string) => phone ? `https://wa.me/972${String(phone).replace(/\D/g, '').replace(/^0/, '')}` : '';
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-xl"><ShieldCheck size={19} className="text-rose-600" /> בקשות להיות מנהלת תרבות <Badge tone="amber">{items.length}</Badge></h3>
      <div className="grid gap-3 lg:grid-cols-2">
        {items.map(a => {
          const id = idOf(a);
          const region = regionFor[id] || a.region;
          return (
            <article key={id} className="rounded-[1.6rem] border border-amber-100 bg-white p-5 shadow-soft">
              <div className="flex items-start gap-3">
                {a.user?.avatar ? <img src={a.user.avatar} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 font-strong text-lg text-rose-700">{(a.name || '?').charAt(0)}</span>}
                <div className="min-w-0 flex-1">
                  <p className="font-strong text-lg text-ink">{a.name || a.user?.name}</p>
                  <p className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><MapPin size={12} /> {a.city}</span>
                    <span>נשלח {fmtDate(a.createdAt)}</span>
                    {a.hoursPerWeek && <span>זמינות: {a.hoursPerWeek}</span>}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {a.phone && <a href={`tel:${a.phone}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-100 text-slate-500 hover:text-rose-700" aria-label="חיוג"><Phone size={15} /></a>}
                  {a.phone && <a href={wa(a.phone)} target="_blank" rel="noreferrer" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-100 text-slate-500 hover:text-emerald-600" aria-label="וואטסאפ"><MessageCircle size={15} /></a>}
                </div>
              </div>
              {(a.email || a.address || a.jobTitle || a.employer) && (
                <div className="mt-3 grid gap-1 rounded-2xl border border-rose-100 p-3 text-sm text-slate-600 sm:grid-cols-2">
                  {a.email && <p><b className="text-ink">מייל:</b> <a href={`mailto:${a.email}`} className="underline" dir="ltr">{a.email}</a></p>}
                  {a.address && <p><b className="text-ink">כתובת:</b> {a.address}</p>}
                  {a.jobTitle && <p><b className="text-ink">תפקיד:</b> {a.jobTitle}</p>}
                  {a.employer && <p><b className="text-ink">מועסקת דרך:</b> {({ matnas: 'מתנ״ס', municipality: 'עירייה / מועצה', other: 'אחר' } as any)[a.employer] || a.employer}{a.employerOther ? ` · ${a.employerOther}` : ''}</p>}
                </div>
              )}
              {(a.about || a.experience || a.activityScope) && (
                <div className="mt-3 space-y-2 rounded-2xl bg-rose-50/50 p-3 text-sm leading-relaxed text-slate-600">
                  {a.activityScope && <p><b className="text-ink">היקף פעילות:</b> {a.activityScope}</p>}
                  {a.about && <p><b className="text-ink">עליה:</b> {a.about}</p>}
                  {a.experience && <p><b className="text-ink">ניסיון:</b> {a.experience}</p>}
                </div>
              )}
              <div className="mt-4">
                <p className="mb-1.5 text-xs font-semibold text-slate-500">האזור שתנהל</p>
                <div className="flex flex-wrap gap-1.5">
                  {REGIONS.map(r => (
                    <button key={r.id} type="button" onClick={() => setRegionFor(m => ({ ...m, [id]: r.id }))}
                      className={`rounded-full border px-3 py-1.5 text-[12.5px] transition ${region === r.id ? 'border-rose-700 bg-rose-700 text-white' : 'border-rose-100 text-slate-600 hover:border-rose-300'}`}>{r.name}</button>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button disabled={!!busy} onClick={() => decide(a, 'approve')} className="btn-primary flex-1 disabled:opacity-60">
                  {busy === id + 'approve' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} אישור כמנהלת תרבות
                </button>
                <button disabled={!!busy} onClick={() => decide(a, 'reject')} className="btn-ghost disabled:opacity-60"><X size={16} /> דחייה</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default ManagerRequestsAdmin;
