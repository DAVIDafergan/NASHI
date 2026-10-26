import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Link2, Pencil, Plus, Smartphone, Trash2, X } from 'lucide-react';
import { api, FlyerInput, FlyerItem } from '../../services/api';

/** Downscale + re-encode so a phone photo of a flyer doesn't become a 10MB upload. */
async function fileToCompressedDataUrl(file: File, maxSide = 2000): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('קריאת הקובץ נכשלה'));
    r.readAsDataURL(file);
  });
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return raw; // keep animation / vectors
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('התמונה לא נטענה'));
    i.src = raw;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return raw;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const isPng = file.type === 'image/png';
  return canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.86);
}

const toDateInput = (v?: string | null) => (v ? new Date(v).toISOString().slice(0, 10) : '');

type Draft = FlyerInput & { _id?: string; previewImage?: string; previewMobile?: string };

const emptyDraft: Draft = { title: '', link: '', openInNewTab: true, isActive: true, startsAt: '', endsAt: '' };

const FlyersAdmin: React.FC = () => {
  const [flyers, setFlyers] = useState<FlyerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const mobileFileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try { setFlyers(await api.getAdminFlyers()); }
    catch (e: any) { setError(e.message || 'טעינה נכשלה'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const pickImage = async (e: React.ChangeEvent<HTMLInputElement>, field: 'image' | 'mobileImage') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !draft) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setDraft({ ...draft, [field]: dataUrl, [field === 'image' ? 'previewImage' : 'previewMobile']: dataUrl });
    } catch (err: any) { alert(err.message); }
  };

  const save = async () => {
    if (!draft) return;
    if (!draft._id && !draft.image) { alert('יש לבחור תמונה לפלייר'); return; }
    setSaving(true);
    try {
      const { _id, previewImage, previewMobile, ...payload } = draft;
      await api.saveFlyer({
        ...payload,
        startsAt: payload.startsAt || null,
        endsAt: payload.endsAt ? new Date(`${payload.endsAt}T23:59:59`).toISOString() : null,
      }, _id);
      setDraft(null);
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (f: FlyerItem) => {
    setFlyers((prev) => prev.map((x) => (x._id === f._id ? { ...x, isActive: !x.isActive } : x)));
    try { await api.saveFlyer({ isActive: !f.isActive }, f._id); }
    catch (e: any) { alert(e.message); load(); }
  };

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= flyers.length) return;
    const next = [...flyers];
    [next[i], next[j]] = [next[j], next[i]];
    setFlyers(next);
    try { await api.reorderFlyers(next.map((f) => f._id)); }
    catch (e: any) { alert(e.message); load(); }
  };

  const remove = async (f: FlyerItem) => {
    if (!window.confirm(`למחוק את הפלייר${f.title ? ` "${f.title}"` : ''}?`)) return;
    try { await api.deleteFlyer(f._id); setFlyers((prev) => prev.filter((x) => x._id !== f._id)); }
    catch (e: any) { alert(e.message); }
  };

  const status = (f: FlyerItem) => {
    if (!f.isActive) return { label: 'מוסתר', cls: 'bg-slate-100 text-slate-500' };
    const now = Date.now();
    if (f.startsAt && new Date(f.startsAt).getTime() > now) return { label: `מתוזמן ל-${new Date(f.startsAt).toLocaleDateString('he-IL')}`, cls: 'bg-champagne-100 text-champagne-700' };
    if (f.endsAt && new Date(f.endsAt).getTime() < now) return { label: 'פג תוקף', cls: 'bg-slate-100 text-slate-500' };
    return { label: 'מוצג באתר', cls: 'bg-sage-100 text-sage-700' };
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl text-ink">פליירים בדף הבית</h2>
          <p className="text-sm text-slate-500 mt-1">הפליירים מוצגים בראש דף הבית בגלילה אוטומטית, לפי הסדר כאן. לחיצה על פלייר מובילה לקישור שהגדרת.</p>
        </div>
        <button onClick={() => setDraft({ ...emptyDraft })} className="btn-primary"><Plus size={16} /> פלייר חדש</button>
      </div>

      {error && <div className="rounded-2xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-64 rounded-[1.75rem] bg-rose-50 animate-pulse" />)}
        </div>
      ) : flyers.length === 0 ? (
        <div className="card-soft p-10 text-center">
          <ImagePlus className="mx-auto text-rose-300" size={36} strokeWidth={1.5} />
          <p className="mt-3 text-slate-600">עדיין אין פליירים. אפשר להוסיף את הראשון והוא יופיע מיד בדף הבית.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {flyers.map((f, i) => {
            const st = status(f);
            return (
              <li key={f._id} className={`card-soft overflow-hidden flex flex-col ${!f.isActive ? 'opacity-70' : ''}`}>
                <div className="relative aspect-[4/3] bg-rose-50">
                  <img src={api.flyerImageSrc(f.imageUrl)} alt={f.title || 'פלייר'} className="absolute inset-0 w-full h-full object-contain" loading="lazy" />
                  <span className="absolute top-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-soft">#{i + 1}</span>
                  <span className={`absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                  {f.mobileImageUrl && <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] text-slate-600"><Smartphone size={11} /> גרסת נייד</span>}
                </div>
                <div className="p-4 flex-1 flex flex-col gap-2">
                  <p className="font-semibold text-slate-800 truncate">{f.title || 'ללא כותרת'}</p>
                  <p className="text-xs text-slate-500 truncate flex items-center gap-1.5"><Link2 size={12} />{f.link || 'ללא קישור'}</p>
                  <div className="mt-auto pt-3 flex items-center gap-1.5">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="p-2 rounded-full hover:bg-rose-50 text-slate-500 disabled:opacity-30" aria-label="הזזה למעלה"><ArrowUp size={16} /></button>
                    <button onClick={() => move(i, 1)} disabled={i === flyers.length - 1} className="p-2 rounded-full hover:bg-rose-50 text-slate-500 disabled:opacity-30" aria-label="הזזה למטה"><ArrowDown size={16} /></button>
                    <button onClick={() => toggleActive(f)} className="p-2 rounded-full hover:bg-rose-50 text-slate-500" aria-label={f.isActive ? 'הסתרה' : 'הצגה'}>{f.isActive ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                    <span className="flex-1" />
                    <button onClick={() => setDraft({ _id: f._id, title: f.title, link: f.link, openInNewTab: f.openInNewTab !== false, isActive: f.isActive, startsAt: toDateInput(f.startsAt), endsAt: toDateInput(f.endsAt), previewImage: api.flyerImageSrc(f.imageUrl), previewMobile: f.mobileImageUrl ? api.flyerImageSrc(f.mobileImageUrl) : '' })} className="btn-ghost !px-3 !py-1.5 !text-xs"><Pencil size={13} /> עריכה</button>
                    <button onClick={() => remove(f)} className="p-2 rounded-full hover:bg-red-50 text-red-500" aria-label="מחיקה"><Trash2 size={16} /></button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {draft && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-[#2B2027]/40 backdrop-blur-sm p-0 md:p-6" onClick={() => !saving && setDraft(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-[2rem] md:rounded-[2rem] shadow-lift border border-rose-100 p-6 md:p-8 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl text-ink">{draft._id ? 'עריכת פלייר' : 'פלייר חדש'}</h3>
              <button onClick={() => setDraft(null)} className="p-2 rounded-full hover:bg-rose-50" aria-label="סגירה"><X size={18} /></button>
            </div>

            <div className="grid md:grid-cols-[1.4fr_1fr] gap-5">
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">תמונת הפלייר <span className="text-rose-500">*</span></p>
                <button type="button" onClick={() => fileRef.current?.click()} className="relative w-full aspect-[4/3] rounded-3xl border-2 border-dashed border-rose-200 bg-rose-50/50 hover:bg-rose-50 transition overflow-hidden flex items-center justify-center">
                  {draft.previewImage ? <img src={draft.previewImage} alt="" className="absolute inset-0 w-full h-full object-contain" /> : (
                    <span className="flex flex-col items-center gap-2 text-rose-400"><ImagePlus size={30} strokeWidth={1.5} /><span className="text-sm">לבחירת תמונה</span></span>
                  )}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e, 'image')} />
                <p className="text-[11px] text-slate-400 mt-2">כל גודל וצורה מתאימים — הפלייר מוצג במלואו בלי חיתוך.</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><Smartphone size={14} /> גרסה לנייד <span className="text-slate-400 font-normal">(לא חובה)</span></p>
                <button type="button" onClick={() => mobileFileRef.current?.click()} className="relative w-full aspect-[4/5] rounded-3xl border-2 border-dashed border-rose-200 bg-rose-50/50 hover:bg-rose-50 transition overflow-hidden flex items-center justify-center">
                  {draft.previewMobile ? <img src={draft.previewMobile} alt="" className="absolute inset-0 w-full h-full object-contain" /> : (
                    <span className="flex flex-col items-center gap-2 text-rose-300 px-4 text-center"><ImagePlus size={24} strokeWidth={1.5} /><span className="text-xs">פלייר לאורך שיוצג בטלפונים</span></span>
                  )}
                </button>
                <input ref={mobileFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e, 'mobileImage')} />
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">כותרת <span className="text-slate-400 font-normal">(לנגישות ולניהול)</span></span>
                <input value={draft.title || ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="mt-1.5 w-full rounded-2xl border border-rose-100 bg-cream px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-300" placeholder="למשל: ערב נשים — חנוכה" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">קישור בלחיצה</span>
                <input value={draft.link || ''} onChange={(e) => setDraft({ ...draft, link: e.target.value })} dir="ltr" className="mt-1.5 w-full rounded-2xl border border-rose-100 bg-cream px-4 py-3 text-sm text-left outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-300" placeholder="https://… או /events" />
                <span className="text-[11px] text-slate-400 mt-1 block">קישור שמתחיל ב-/ פותח עמוד באתר (למשל /events). אפשר להשאיר ריק.</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={draft.openInNewTab !== false} onChange={(e) => setDraft({ ...draft, openInNewTab: e.target.checked })} className="h-4 w-4 rounded" />
                קישור חיצוני ייפתח בלשונית חדשה
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">מתחיל להופיע</span>
                  <input type="date" value={(draft.startsAt as string) || ''} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} className="mt-1.5 w-full rounded-2xl border border-rose-100 bg-cream px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-rose-100" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">מפסיק להופיע</span>
                  <input type="date" value={(draft.endsAt as string) || ''} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} className="mt-1.5 w-full rounded-2xl border border-rose-100 bg-cream px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-rose-100" />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={draft.isActive !== false} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} className="h-4 w-4 rounded" />
                הצג באתר
              </label>
            </div>

            <div className="mt-8 flex gap-3">
              <button onClick={save} disabled={saving} className="btn-primary flex-1 disabled:opacity-60">{saving ? 'שומרת…' : 'שמירה'}</button>
              <button onClick={() => setDraft(null)} disabled={saving} className="btn-ghost">ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlyersAdmin;
