import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Store, Phone, Mail, MessageCircle, CheckCircle2, PauseCircle, PlayCircle, Link2, Loader2, Wallet, ExternalLink } from 'lucide-react';
import { suppliersApi, Supplier } from '../../services/suppliersApi';
import { SUPPLIER_STATUS_LABELS, supplierCategoryName } from '../../shared/suppliers';
import { areaLabel, waLink } from '../suppliers/SupplierParts';
import { Badge, DeleteButton, EmptyState, IconButton, Segmented, fmtDate, matchesSearch, toast } from './ui';

const TONE: Record<string, string> = { pending_payment: 'amber', active: 'green', expired: 'slate', suspended: 'red' };

/** Admin: supplier listings, payment status, manual "mark paid", suspend / activate, edit link. */
const SuppliersAdmin: React.FC<{ search: string }> = ({ search }) => {
  const [list, setList] = useState<Supplier[] | null>(null);
  const [meta, setMeta] = useState<{ provider: string; monthlyPrice: number | null }>({ provider: 'manual', monthlyPrice: null });
  const [status, setStatus] = useState<'all' | 'pending_payment' | 'active' | 'expired' | 'suspended'>('all');
  const [months, setMonths] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try { const r = await suppliersApi.adminList(); setList(r.suppliers); setMeta({ provider: r.provider, monthlyPrice: r.monthlyPrice }); }
    catch (e: any) { toast(e?.message || 'טעינה נכשלה', 'bad'); setList([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (s: Supplier, key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(s.id + key);
    try { await fn(); toast(ok); await load(); } catch (e: any) { toast(e?.message || 'הפעולה נכשלה', 'bad'); } finally { setBusy(''); }
  };
  const sendLink = async (s: Supplier) => {
    setBusy(s.id + 'link');
    try {
      const r = await suppliersApi.sendLink(s.id);
      try { await navigator.clipboard.writeText(r.link); } catch { /* ignore */ }
      toast(r.sent ? 'קישור חדש נשלח למייל והועתק' : 'קישור חדש הועתק — אפשר לשלוח בוואטסאפ');
    } catch (e: any) { toast(e?.message || 'הפעולה נכשלה', 'bad'); } finally { setBusy(''); }
  };

  const counts = useMemo(() => (list || []).reduce((m, s) => { m[s.status || ''] = (m[s.status || ''] || 0) + 1; return m; }, {} as Record<string, number>), [list]);
  const shown = (list || []).filter(s => (status === 'all' || s.status === status) && matchesSearch(search, s.businessName, s.contactName, s.phone, s.email, s.description));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-rose-100/80 bg-white p-4 text-[13.5px] text-slate-600">
        <span className="flex items-center gap-2"><Wallet size={16} className="text-rose-500" /> מנוי חודשי: <b className="text-ink">{meta.monthlyPrice ? `₪${meta.monthlyPrice}` : 'לא הוגדר (SUPPLIER_MONTHLY_PRICE)'}</b></span>
        <span>ספק תשלומים: <b className="text-ink">{meta.provider === 'manual' ? 'ידני — מסמנים תשלום כאן' : meta.provider}</b></span>
        <span>{counts.active || 0} פעילים · {counts.pending_payment || 0} ממתינים לתשלום</span>
      </div>
      <div className="max-w-2xl">
        <Segmented value={status} onChange={(v) => setStatus(v as any)} options={[
          { id: 'all', label: `הכול${list ? ` (${list.length})` : ''}` }, { id: 'pending_payment', label: 'ממתינים' }, { id: 'active', label: 'פעילים' }, { id: 'expired', label: 'פג תוקף' }, { id: 'suspended', label: 'מושהים' },
        ]} />
      </div>

      {list === null ? <div className="h-40 animate-pulse rounded-[1.6rem] bg-rose-50" /> : shown.length === 0 ? (
        <EmptyState icon={<Store size={26} />} title="אין ספקים להצגה" text="ספקים נרשמים בעמוד 'הצטרפות ספקים' באתר (‎/#/suppliers/join)." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map(s => {
            const end = s.subscription?.currentPeriodEnd;
            const m = months[s.id] || 1;
            return (
              <article key={s.id} className="rounded-[1.6rem] border border-rose-100/80 bg-white p-5 shadow-soft">
                <div className="flex items-start gap-3">
                  {s.logo ? <img src={s.logo} alt="" className="h-12 w-12 shrink-0 rounded-xl border border-rose-100 object-contain p-1" />
                    : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 font-accent text-2xl text-rose-500">{s.businessName.charAt(0)}</span>}
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-strong text-[16px] text-ink">{s.businessName} <Badge tone={TONE[s.status || '']}>{SUPPLIER_STATUS_LABELS[s.status || 'pending_payment']}</Badge></p>
                    <p className="text-[12.5px] text-slate-500">{s.contactName} · {s.categories.map(supplierCategoryName).join(', ')} · {areaLabel(s)}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <a href={`tel:${s.phone}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-100 text-slate-500 hover:text-rose-700" aria-label="חיוג"><Phone size={15} /></a>
                    <a href={waLink(s.whatsapp || s.phone)} target="_blank" rel="noreferrer" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-100 text-slate-500 hover:text-emerald-600" aria-label="וואטסאפ"><MessageCircle size={15} /></a>
                    <a href={`mailto:${s.email}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-100 text-slate-500 hover:text-rose-700" aria-label="מייל"><Mail size={15} /></a>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-[13.5px] leading-relaxed text-slate-600">{s.description}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-rose-50/50 p-3 text-[12.5px] text-slate-600 sm:grid-cols-3">
                  <span>בתוקף עד<br /><b className="text-ink">{end ? fmtDate(end) : '—'}</b></span>
                  <span>תשלום אחרון<br /><b className="text-ink">{s.subscription?.lastPaymentAt ? fmtDate(s.subscription.lastPaymentAt) : '—'}</b></span>
                  <span>נרשם<br /><b className="text-ink">{fmtDate(s.createdAt)}</b>{s.views ? ` · ${s.views} צפיות` : ''}</span>
                </div>
                {s.statusNote && <p className="mt-2 text-[12.5px] text-red-600">הערה: {s.statusNote}</p>}
                {s.website && <a href={s.website} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12.5px] text-rose-700 hover:underline"><ExternalLink size={12} /> {s.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="flex items-center overflow-hidden rounded-full border border-rose-200">
                    <select value={m} onChange={e => setMonths(x => ({ ...x, [s.id]: Number(e.target.value) }))} className="h-10 bg-white px-2 text-[13px] text-slate-600 outline-none" aria-label="מספר חודשים">
                      {[1, 3, 6, 12].map(n => <option key={n} value={n}>{n === 1 ? 'חודש' : `${n} חודשים`}</option>)}
                    </select>
                    <button disabled={!!busy} onClick={() => act(s, 'paid', () => suppliersApi.markPaid(s.id, m), `${s.businessName} פעיל ✔`)} className="inline-flex h-10 items-center gap-1.5 bg-rose-700 px-4 text-[13px] text-white hover:bg-rose-800 disabled:opacity-60">
                      {busy === s.id + 'paid' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} סימון תשלום
                    </button>
                  </div>
                  {s.status === 'suspended'
                    ? <button disabled={!!busy} onClick={() => act(s, 'act', () => suppliersApi.activate(s.id), 'הכרטיס הופעל')} className="btn-ghost !px-4 !py-2 text-[13px]"><PlayCircle size={14} /> הפעלה</button>
                    : <button disabled={!!busy} onClick={() => { const note = window.prompt('סיבת ההשהיה (תוצג לספק):', '') ?? null; if (note !== null) act(s, 'sus', () => suppliersApi.suspend(s.id, note), 'הכרטיס הושהה'); }} className="btn-ghost !px-4 !py-2 text-[13px]"><PauseCircle size={14} /> השהיה</button>}
                  <IconButton onClick={() => sendLink(s)} title="קישור עריכה חדש לספק" aria-label="קישור עריכה חדש">{busy === s.id + 'link' ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}</IconButton>
                  <span className="mr-auto" />
                  <DeleteButton name={s.businessName} onConfirm={async () => { await suppliersApi.remove(s.id); toast('נמחק'); load(); }} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SuppliersAdmin;
