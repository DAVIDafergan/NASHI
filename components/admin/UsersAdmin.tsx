import React, { useMemo, useState } from 'react';
import { Award, Check, Copy, Download, Mail, MapPin, Phone, Plus, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { api } from '../../services/api';
import { regionName, regionOfCity, REGIONS } from '../../shared/regions';
import { Badge, DeleteButton, EmptyState, Field, IconButton, Pager, Sheet, fmtDate, idOf, inputCls, matchesRegion, matchesSearch, regionOfItem, toast } from './ui';

const PAGE = 25;
type Filter = 'all' | 'members' | 'requested' | 'regular' | 'nocity' | 'managers';

const UsersAdmin: React.FC<{ users: any[]; region: string; search: string; reload: () => void }> = ({ users, region, search, reload }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<'new' | 'points' | 'name'>('new');
  const [page, setPage] = useState(1);
  const [gift, setGift] = useState<{ open: boolean; user?: any; link?: string; busy?: boolean }>({ open: false });
  const [roleFor, setRoleFor] = useState<{ user: any; region: string } | null>(null);
  const [roleBusy, setRoleBusy] = useState(false);
  const [pointsFor, setPointsFor] = useState<{ user?: any; amount: number } | null>(null);

  const list = useMemo(() => users
    .filter(u => matchesRegion(u, region, false) && matchesSearch(search, u.name, u.email, u.phone, u.city))
    .filter(u => filter === 'all' ? true : filter === 'members' ? u.isMemberApproved : filter === 'requested' ? (u.isMemberRequested && !u.isMemberApproved) : filter === 'nocity' ? !u.city : filter === 'managers' ? u.role === 'regionAdmin' : !u.isMemberApproved && !u.isMemberRequested)
    .sort((a, b) => sort === 'points' ? (b.points || 0) - (a.points || 0) : sort === 'name' ? String(a.name).localeCompare(String(b.name), 'he') : +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0)),
  [users, region, search, filter, sort]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const shown = list.slice((page - 1) * PAGE, page * PAGE);

  const count = (f: Filter) => users.filter(u => matchesRegion(u, region, false)).filter(u => f === 'all' ? true : f === 'members' ? u.isMemberApproved : f === 'requested' ? (u.isMemberRequested && !u.isMemberApproved) : f === 'nocity' ? !u.city : f === 'managers' ? u.role === 'regionAdmin' : !u.isMemberApproved && !u.isMemberRequested).length;

  const exportCsv = () => {
    const headers = ['שם', 'דוא"ל', 'טלפון', 'עיר', 'אזור', 'נקודות', 'סטטוס', 'תאריך הרשמה'];
    let c = 'data:text/csv;charset=utf-8,﻿' + headers.join(',') + '\n';
    list.forEach(u => {
      c += [u.name, u.email, u.phone, u.city || '', regionName(regionOfItem(u)), u.points || 0, u.isMemberApproved ? 'חברת מעגל' : u.isMemberRequested ? 'ממתינה' : 'רשומה', fmtDate(u.createdAt)]
        .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',') + '\n';
    });
    const a = document.createElement('a'); a.href = encodeURI(c); a.download = 'nashi_users.csv'; document.body.appendChild(a); a.click(); a.remove();
  };

  const makeGift = async (u: any) => {
    setGift({ open: true, user: u, busy: true });
    try { const res = await api.createGiftCode({ points: 100, maxUses: 1 }); setGift({ open: true, user: u, link: res.link }); }
    catch { setGift({ open: true, user: u }); toast('יצירת ההטבה נכשלה', 'bad'); }
  };

  const filters: [Filter, string][] = [['all', 'כולן'], ['members', 'חברות מעגל'], ['requested', 'ביקשו להצטרף'], ['regular', 'רשומות'], ['nocity', 'בלי עיר'], ['managers', 'מנהלות תרבות']];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="no-scrollbar -mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1">
          {filters.map(([id, label]) => (
            <button key={id} onClick={() => { setFilter(id); setPage(1); }} className={`shrink-0 rounded-full border px-3.5 py-2 text-[13px] transition ${filter === id ? 'border-rose-700 bg-rose-700 text-white' : 'border-rose-100 bg-white text-slate-600'}`}>
              {label} <span className="opacity-70">({count(id)})</span>
            </button>
          ))}
        </div>
        <select value={sort} onChange={e => setSort(e.target.value as any)} className="rounded-full border border-rose-100 bg-white px-3 py-2 text-[13px] text-slate-600 outline-none">
          <option value="new">חדשות קודם</option><option value="points">הכי הרבה נקודות</option><option value="name">לפי שם</option>
        </select>
        <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-white px-3.5 py-2 text-[13px] text-emerald-700 hover:bg-emerald-50"><Download size={14} /> ייצוא לאקסל</button>
      </div>

      {list.length === 0 ? <EmptyState icon={<Users size={24} />} title="לא נמצאו משתמשות" text="נסי לשנות את הסינון או החיפוש." /> : (
        <>
          {/* desktop table */}
          <div className="hidden overflow-hidden rounded-[1.6rem] border border-rose-100 bg-white shadow-soft md:block">
            <table className="w-full text-right text-sm">
              <thead className="bg-rose-50/60 text-[12px] text-slate-500">
                <tr><th className="p-3.5 font-semibold">שם</th><th className="p-3.5 font-semibold">עיר</th><th className="p-3.5 font-semibold">נקודות</th><th className="p-3.5 font-semibold">סטטוס</th><th className="p-3.5 font-semibold">הצטרפה</th><th className="p-3.5" /></tr>
              </thead>
              <tbody className="divide-y divide-rose-50">
                {shown.map(u => (
                  <tr key={idOf(u)} className="hover:bg-rose-50/30">
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        {u.avatar ? <img src={u.avatar} alt="" className="h-9 w-9 rounded-full bg-rose-50 object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 font-strong text-rose-700">{(u.name || '?').charAt(0)}</span>}
                        <div className="min-w-0">
                          <p className="truncate font-strong text-ink">{u.name}</p>
                          <p className="truncate text-xs text-slate-400" dir="ltr">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5">{u.city ? <span>{u.city}<span className="block text-[11px] text-slate-400">{regionName(regionOfItem(u))}</span></span> : <span className="text-xs text-slate-400">לא נבחרה</span>}</td>
                    <td className="p-3.5 font-strong text-rose-700 tabular-nums">{(u.points || 0).toLocaleString('he-IL')}</td>
                    <td className="p-3.5">{u.isAdmin ? <Badge tone="plum">מנהלת</Badge> : u.role === 'regionAdmin' ? <Badge tone="plum"><ShieldCheck size={10} /> מנהלת {regionName(u.adminRegion)}</Badge> : u.isMemberApproved ? <Badge tone="green"><Sparkles size={10} /> חברת מעגל</Badge> : u.isMemberRequested ? <Badge tone="amber">ממתינה לאישור</Badge> : <Badge tone="slate">רשומה</Badge>}</td>
                    <td className="p-3.5 text-xs text-slate-500">{fmtDate(u.createdAt)}</td>
                    <td className="p-3.5">
                      <div className="flex justify-end gap-1.5">
                        {u.isMemberRequested && !u.isMemberApproved && <IconButton tone="good" title="אישור למעגל" aria-label="אישור" onClick={async () => { await api.approveMember(idOf(u)); toast(`${u.name} אושרה ✨`); reload(); }}><Check size={15} /></IconButton>}
                        <IconButton title="הוספת נקודות" aria-label="נקודות" onClick={() => setPointsFor({ user: u, amount: 50 })}><Plus size={15} /></IconButton>
                        <IconButton title="קישור להטבה אישית" aria-label="הטבה" onClick={() => makeGift(u)}><Award size={15} /></IconButton>
                        {!u.isAdmin && <IconButton title="מנהלת תרבות" aria-label="מנהלת תרבות" onClick={() => setRoleFor({ user: u, region: u.adminRegion || regionOfCity(u.city) || '' })}><ShieldCheck size={15} /></IconButton>}
                        {!u.isAdmin && <DeleteButton name={u.name} onConfirm={async () => { await api.deleteUser(idOf(u)); reload(); }} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* phone cards */}
          <ul className="space-y-2 md:hidden">
            {shown.map(u => (
              <li key={idOf(u)} className="rounded-[1.4rem] border border-rose-100 bg-white p-3.5 shadow-soft">
                <div className="flex items-center gap-3">
                  {u.avatar ? <img src={u.avatar} alt="" className="h-10 w-10 rounded-full bg-rose-50 object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 font-strong text-rose-700">{(u.name || '?').charAt(0)}</span>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-strong text-ink">{u.name}</p>
                    <p className="flex items-center gap-2 text-xs text-slate-500"><MapPin size={11} /> {u.city || 'לא נבחרה עיר'} · <span className="font-strong text-rose-700">{u.points || 0} נק׳</span></p>
                  </div>
                  {u.role === 'regionAdmin' ? <Badge tone="plum"><ShieldCheck size={10} /> {regionName(u.adminRegion)}</Badge> : u.isMemberApproved ? <Badge tone="green">מעגל</Badge> : u.isMemberRequested ? <Badge tone="amber">ממתינה</Badge> : null}
                </div>
                <div className="mt-3 flex items-center gap-1.5 border-t border-rose-50 pt-3">
                  {u.phone && <a href={`tel:${u.phone}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-100 text-slate-500"><Phone size={15} /></a>}
                  <a href={`mailto:${u.email}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-100 text-slate-500"><Mail size={15} /></a>
                  <span className="flex-1" />
                  {u.isMemberRequested && !u.isMemberApproved && <IconButton tone="good" aria-label="אישור" onClick={async () => { await api.approveMember(idOf(u)); toast(`${u.name} אושרה ✨`); reload(); }}><Check size={15} /></IconButton>}
                  <IconButton aria-label="נקודות" onClick={() => setPointsFor({ user: u, amount: 50 })}><Plus size={15} /></IconButton>
                  <IconButton aria-label="הטבה" onClick={() => makeGift(u)}><Award size={15} /></IconButton>
                  {!u.isAdmin && <IconButton aria-label="מנהלת תרבות" onClick={() => setRoleFor({ user: u, region: u.adminRegion || regionOfCity(u.city) || '' })}><ShieldCheck size={15} /></IconButton>}
                  {!u.isAdmin && <DeleteButton name={u.name} onConfirm={async () => { await api.deleteUser(idOf(u)); reload(); }} />}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <Pager page={page} total={pages} onPage={setPage} />

      <Sheet open={!!roleFor} onClose={() => setRoleFor(null)} title="מנהלת תרבות" subtitle={roleFor?.user?.name}
        footer={roleFor && (
          <div className="flex gap-2">
            <button disabled={roleBusy || !roleFor.region} className="btn-primary flex-1 disabled:opacity-50" onClick={async () => {
              setRoleBusy(true);
              try { await api.setUserRole(idOf(roleFor.user), 'regionAdmin', roleFor.region); toast(`${roleFor.user.name} מנהלת עכשיו את ${regionName(roleFor.region)} ✨`); setRoleFor(null); reload(); }
              catch (e: any) { toast(e?.message || 'השמירה נכשלה', 'bad'); } finally { setRoleBusy(false); }
            }}>{roleFor.user.role === 'regionAdmin' ? 'שמירת שינוי' : 'מינוי למנהלת תרבות'}</button>
            {roleFor.user.role === 'regionAdmin' && (
              <button disabled={roleBusy} className="btn-ghost" onClick={async () => {
                setRoleBusy(true);
                try { await api.setUserRole(idOf(roleFor.user), 'member'); toast('ההרשאה הוסרה'); setRoleFor(null); reload(); }
                catch (e: any) { toast(e?.message || 'השמירה נכשלה', 'bad'); } finally { setRoleBusy(false); }
              }}>הסרת ההרשאה</button>
            )}
          </div>
        )}>
        {roleFor && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-600">מנהלת תרבות נכנסת ל"ניהול" עם המשתמש הרגיל שלה, ויכולה להעלות, לערוך ולמחוק <b>אירועים, חוגים, פריטי קהילה והגרלות</b> באזור שלה בלבד. היא לא רואה משתמשות, פניות או הגדרות.</p>
            <Field label="איזה אזור היא מנהלת?" required>
              <div className="grid grid-cols-2 gap-2">
                {REGIONS.map(r => (
                  <button key={r.id} type="button" onClick={() => setRoleFor(x => (x ? { ...x, region: r.id } : x))}
                    className={`rounded-2xl border px-3 py-3 text-sm transition ${roleFor.region === r.id ? 'border-rose-700 bg-rose-700 font-strong text-white' : 'border-rose-100 bg-white text-slate-700 hover:border-rose-300'}`}>{r.name}</button>
                ))}
              </div>
            </Field>
          </div>
        )}
      </Sheet>

      <Sheet open={gift.open} onClose={() => setGift({ open: false })} title="קישור להטבה אישית" subtitle={gift.user?.name}>
        {gift.busy ? <p className="p-6 text-center text-slate-500">יוצרת קישור…</p> : gift.link ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">קישור חד־פעמי שמעניק 100 נקודות. שלחי אותו ל{gift.user?.name}:</p>
            <p className="break-all rounded-2xl bg-white p-3 text-left text-xs text-slate-600" dir="ltr">{gift.link}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={async () => { try { await navigator.clipboard.writeText(gift.link!); toast('הועתק ✔'); } catch { window.prompt('העתיקי:', gift.link); } }} className="btn-ghost"><Copy size={15} /> העתקה</button>
              {gift.user?.phone && <a href={`https://wa.me/972${String(gift.user.phone).replace(/\D/g, '').replace(/^0/, '')}?text=${encodeURIComponent(`היי ${gift.user.name} 💗 הכנו לך הטבה אישית בנשי: ${gift.link}`)}`} target="_blank" rel="noreferrer" className="btn-primary !bg-[#1FA855]">שליחה בוואטסאפ</a>}
            </div>
          </div>
        ) : <p className="p-6 text-center text-slate-500">לא נוצר קישור.</p>}
      </Sheet>

      <Sheet open={!!pointsFor} onClose={() => setPointsFor(null)} title="הוספת נקודות" subtitle={pointsFor?.user?.name}
        footer={<button onClick={async () => { if (!pointsFor) return; await api.sendPointsToUser(idOf(pointsFor.user), pointsFor.amount); toast(`נוספו ${pointsFor.amount} נקודות ✔`); setPointsFor(null); reload(); }} className="btn-primary w-full">הוספה</button>}>
        <Field label="כמה נקודות להוסיף?" hint="אפשר גם מספר שלילי כדי להוריד">
          <input type="number" className={inputCls} value={pointsFor?.amount ?? 0} onChange={e => setPointsFor(p => p && ({ ...p, amount: Number(e.target.value) }))} />
        </Field>
        <div className="flex flex-wrap gap-2">{[10, 25, 50, 100].map(n => <button key={n} onClick={() => setPointsFor(p => p && ({ ...p, amount: n }))} className="rounded-full border border-rose-100 bg-white px-4 py-2 text-sm">+{n}</button>)}</div>
      </Sheet>
    </div>
  );
};

export default UsersAdmin;
