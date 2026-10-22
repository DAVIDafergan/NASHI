import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Calendar, ChevronDown, Clock, ExternalLink, Eye, EyeOff, Loader2, Play, RefreshCw, AlertTriangle, CheckCircle2, Ticket } from 'lucide-react';
import { importerApi, ImporterStatus, ImportRun } from '../../services/suppliersApi';
import { Badge, DeleteButton, EmptyState, IconButton, ItemCard, LocationBadges, Segmented, SectionTitle, fmtDate, idOf, toast } from './ui';

const when = (d?: string | null) => d ? new Date(d).toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const dur = (r: ImportRun) => r.finishedAt ? `${Math.max(1, Math.round((+new Date(r.finishedAt) - +new Date(r.startedAt)) / 1000))} שנ׳` : '';
const HIDDEN_LABEL: Record<string, string> = { admin: 'הוסתר ע״י מנהלת', gone: 'ירד מאתר המקור', past: 'עבר' };
const SOURCE_TONE: Record<string, string> = { active: 'green', discovery: 'sky', todo: 'amber', skip: 'slate' };
const SOURCE_LABEL: Record<string, string> = { active: 'פעיל', discovery: 'לגילוי בלבד', todo: 'לבדיקה', skip: 'לא מתאים' };

/** Group skip reasons ("חסר: מחיר, פלייר" → per reason) to show why events didn't come in. */
const reasonsOf = (run: ImportRun) => {
  const m = new Map<string, number>();
  for (const s of run.skipped || []) { const k = s.reason.replace(/"[^"]*"/, '"…"'); m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const RunCard: React.FC<{ run: ImportRun; open: boolean; onToggle: () => void }> = ({ run, open, onToggle }) => {
  const c = run.counts || ({} as ImportRun['counts']);
  const failed = run.status === 'failed';
  return (
    <article className={`rounded-[1.4rem] border bg-white shadow-soft ${failed ? 'border-red-100' : 'border-rose-100/80'}`}>
      <button type="button" onClick={onToggle} className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 p-4 text-right">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${run.status === 'running' ? 'bg-sky-50 text-sky-600' : failed ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
          {run.status === 'running' ? <Loader2 size={17} className="animate-spin" /> : failed ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-strong text-[15px] text-ink">{when(run.startedAt)} <span className="text-[12px] font-normal text-slate-400">· {run.trigger === 'manual' ? 'הרצה ידנית' : run.trigger === 'schedule' ? 'מתוזמן' : run.trigger} {dur(run) && `· ${dur(run)}`}</span></span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone="green">{c.created || 0} חדשים</Badge>
            <Badge tone="sky">{c.updated || 0} עודכנו</Badge>
            <Badge tone="slate">{c.skipped || 0} דולגו</Badge>
            {(c.hidden || 0) > 0 && <Badge tone="plum">{c.hidden} הוסתרו</Badge>}
            {(c.failed || 0) > 0 && <Badge tone="red">{c.failed} שגיאות</Badge>}
            <span className="text-[11.5px] text-slate-400">{c.discovered || 0} נבדקו</span>
          </span>
        </span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-rose-50 p-4 text-[13px]">
          {(run.sources || []).map(s => (
            <p key={s.id} className="text-slate-600"><b className="text-ink">{s.name}:</b> {s.discovered} נמצאו · {s.created} חדשים · {s.updated} עודכנו · {s.skipped} דולגו{s.failed ? ` · ${s.failed} שגיאות` : ''}{s.error ? ` — ${s.error}` : ''}</p>
          ))}
          {reasonsOf(run).length > 0 && (
            <div>
              <p className="mb-1.5 font-semibold text-slate-700">למה אירועים לא נכנסו</p>
              <div className="flex flex-wrap gap-1.5">{reasonsOf(run).map(([r, n]) => <Badge key={r} tone="slate">{r} · {n}</Badge>)}</div>
            </div>
          )}
          {(run.skipped || []).length > 0 && (
            <details className="rounded-2xl bg-rose-50/40 p-3">
              <summary className="cursor-pointer font-semibold text-slate-700">כל האירועים שדולגו ({run.skipped.length})</summary>
              <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                {run.skipped.map((s, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 border-b border-rose-100/60 py-1.5 last:border-0">
                    <span className="min-w-0"><span className="block truncate text-ink">{s.title || s.sourceId}</span><span className="text-slate-500">{s.reason}</span></span>
                    {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="shrink-0 text-rose-600" aria-label="לאתר המקור"><ExternalLink size={14} /></a>}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {(run.errorMessages || []).length > 0 && (
            <details className="rounded-2xl bg-red-50/60 p-3" open={failed}>
              <summary className="cursor-pointer font-semibold text-red-700">שגיאות ({run.errorMessages.length})</summary>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto font-mono text-[11.5px] text-red-700" dir="ltr">{run.errorMessages.map((e, i) => <li key={i} className="break-all">{e}</li>)}</ul>
            </details>
          )}
        </div>
      )}
    </article>
  );
};

/** "סוכן אירועים" — automatic import of complete women's events from ticketing sites. Main admin only. */
const ImporterAdmin: React.FC = () => {
  const [status, setStatus] = useState<ImporterStatus | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [filter, setFilter] = useState<'visible' | 'hidden' | 'all'>('visible');
  const [openRun, setOpenRun] = useState<string>('');
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    const [s, e] = await Promise.all([importerApi.status().catch(() => null), importerApi.events('all').catch(() => [])]);
    if (s) setStatus(s);
    setEvents(Array.isArray(e) ? e : []);
  }, []);
  useEffect(() => { load(); }, [load]);
  // while a run is going, refresh every few seconds
  useEffect(() => { if (!status?.running) return; const t = setInterval(load, 4000); return () => clearInterval(t); }, [status?.running, load]);

  const runNow = async () => {
    setStarting(true);
    try { await importerApi.run(); toast('הסוכן התחיל לסרוק ✨'); setTimeout(load, 800); }
    catch (e: any) { toast(e?.message || 'ההרצה נכשלה', 'bad'); }
    finally { setStarting(false); }
  };
  const setHidden = async (ev: any, hide: boolean) => {
    try { await importerApi.setHidden(idOf(ev), hide); toast(hide ? 'האירוע הוסתר מהאתר' : 'האירוע מוצג שוב'); load(); }
    catch (e: any) { toast(e?.message || 'הפעולה נכשלה', 'bad'); }
  };

  const shown = useMemo(() => events.filter(e => filter === 'all' ? true : filter === 'hidden' ? e.hidden : !e.hidden), [events, filter]);
  const last = status?.runs?.[0];

  return (
    <div className="space-y-8">
      {/* header */}
      <section className="relative overflow-hidden rounded-[1.75rem] bg-ink p-5 text-white md:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-20 h-60 w-60 rounded-full bg-rose-500/30 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-rose-200"><Bot size={24} /></span>
          <div className="min-w-0 flex-1">
            <p className="font-accent text-[20px] leading-none text-rose-200">סוכן אירועים</p>
            <h3 className="mt-1 text-[1.35rem] leading-snug !text-white md:text-[1.6rem]">סורק אתרי כרטיסים ומעלה אירועים לנשים — רק כשכל הפרטים קיימים</h3>
            <p className="mt-1.5 text-[13.5px] text-white/70">
              {status ? (status.enabled ? `פועל אוטומטית כל ${status.intervalHours} שעות${status.nextAt ? ` · הריצה הבאה ${when(status.nextAt)}` : ''}` : 'התזמון כבוי (IMPORTER_ENABLED). אפשר להריץ ידנית.') : 'טוען…'}
              {' · '}לא רץ בשבת ובחג
            </p>
          </div>
          <button onClick={runNow} disabled={starting || status?.running} className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-[15px] font-strong text-rose-800 transition hover:bg-rose-50 disabled:opacity-70">
            {status?.running || starting ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />} {status?.running ? 'סורק עכשיו…' : 'הרצה עכשיו'}
          </button>
        </div>
        <div className="relative mt-5 grid grid-cols-3 gap-2 md:max-w-lg">
          {[{ k: 'מוצגים באתר', v: status?.totals.visible ?? '—' }, { k: 'מוסתרים', v: status?.totals.hidden ?? '—' }, { k: 'נחסמו', v: status?.totals.blocked ?? '—' }].map(x => (
            <div key={x.k} className="rounded-2xl bg-white/10 px-3 py-2.5"><p className="font-display text-[1.6rem] leading-none tabular-nums">{x.v}</p><p className="mt-1 text-[11.5px] text-white/70">{x.k}</p></div>
          ))}
        </div>
      </section>

      {/* runs */}
      <section>
        <SectionTitle title="ריצות אחרונות" icon={<Clock size={17} />} action={<IconButton onClick={load} aria-label="רענון" title="רענון"><RefreshCw size={15} /></IconButton>} />
        {!status ? <div className="h-24 animate-pulse rounded-[1.4rem] bg-rose-50" /> : status.runs.length === 0 ? (
          <EmptyState icon={<Bot size={26} />} title="הסוכן עוד לא רץ" text="לחצי על 'הרצה עכשיו' כדי לסרוק בפעם הראשונה." />
        ) : (
          <div className="space-y-2.5">{status.runs.map(r => <RunCard key={r._id} run={r} open={openRun === r._id || (!openRun && r === last)} onToggle={() => setOpenRun(openRun === r._id ? '-' : r._id)} />)}</div>
        )}
      </section>

      {/* imported events */}
      <section>
        <SectionTitle title="אירועים שיובאו" count={events.length} icon={<Calendar size={17} />} />
        <div className="mb-4 max-w-md"><Segmented value={filter} onChange={(v) => setFilter(v as any)} options={[{ id: 'visible', label: 'מוצגים' }, { id: 'hidden', label: 'מוסתרים' }, { id: 'all', label: 'הכול' }]} /></div>
        {shown.length === 0 ? <EmptyState icon={<Calendar size={26} />} title="אין אירועים להצגה" /> : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map(e => (
              <ItemCard key={idOf(e)} image={e.image} title={e.title}
                badges={<>
                  <Badge tone="plum">{e.sourceName || e.source}</Badge>
                  {e.hidden && <Badge tone="slate"><EyeOff size={11} /> {HIDDEN_LABEL[e.hiddenReason] || 'מוסתר'}</Badge>}
                  {e.soldOut && <Badge tone="red"><Ticket size={11} /> אזל</Badge>}
                  {e.importEdited && <Badge tone="amber">נערך ידנית</Badge>}
                </>}
                meta={<>
                  <p className="flex items-center gap-1.5"><Calendar size={13} className="text-rose-400" /> {fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'long' })}{e.time ? ` · ${e.time}` : ''}{e.price ? ` · ₪${e.price}` : ' · חינם'}</p>
                  {e.location && <p className="truncate">{e.location}</p>}
                  <p className="text-[11.5px] text-slate-400">יובא {fmtDate(e.importedAt)} · נראה לאחרונה {when(e.lastSeenAt)}</p>
                </>}
                tags={<LocationBadges item={e} showAudience />}
                actions={<>
                  <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[12.5px] text-rose-700 hover:underline"><ExternalLink size={13} /> באתר המקור</a>
                  {e.hidden
                    ? <IconButton tone="good" onClick={() => setHidden(e, false)} title="להציג שוב" aria-label="להציג שוב"><Eye size={15} /></IconButton>
                    : <IconButton onClick={() => setHidden(e, true)} title="הסתרה מהאתר" aria-label="הסתרה מהאתר"><EyeOff size={15} /></IconButton>}
                  <DeleteButton name={e.title} onConfirm={async () => { await importerApi.remove(idOf(e)); toast('נמחק — הסוכן לא ייבא אותו שוב'); load(); }} />
                </>}
              />
            ))}
          </div>
        )}
      </section>

      {/* sources */}
      <section>
        <SectionTitle title="מקורות" icon={<ExternalLink size={17} />} />
        <div className="grid gap-2.5 md:grid-cols-2">
          {(status?.sources || []).map(s => (
            <div key={s.id} className="rounded-[1.4rem] border border-rose-100/80 bg-white p-4">
              <p className="flex items-center gap-2 font-strong text-[15px] text-ink">{s.name} <Badge tone={SOURCE_TONE[s.status]}>{SOURCE_LABEL[s.status]}</Badge></p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{s.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12.5px] text-slate-400">נכנס רק אירוע לנשים שמתאים לציבור הדתי/חרדי, עתידי, ועם שם, תאריך ושעה, מקום ועיר מוכרת, מחיר (או חינם), קישור לרכישה ופלייר. אירוע שמחקת לא ייובא שוב.</p>
      </section>
    </div>
  );
};

export default ImporterAdmin;
