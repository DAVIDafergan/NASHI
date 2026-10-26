import React, { useState } from 'react';
import { Briefcase, Check, CheckCircle2, Clock, Eye, Mail, MapPin, MessageSquare, Phone, PlayCircle, UserPlus } from 'lucide-react';
import { api } from '../../services/api';
import { themeOf } from '../../utils/storyCard';
import { Badge, DeleteButton, EmptyState, SectionTitle, fmtDate, idOf, toast } from './ui';

const Avatar: React.FC<{ u?: any; size?: string }> = ({ u, size = 'h-11 w-11' }) => u?.avatar
  ? <img src={u.avatar} alt="" className={`${size} shrink-0 rounded-full bg-rose-50 object-cover`} />
  : <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-200 to-rose-400 font-strong text-white`}>{(u?.name || '?').charAt(0)}</span>;

/* ------------------------- approvals ------------------------- */
export const ApprovalsAdmin: React.FC<{ pendingUsers: any[]; pendingPosts: any[]; reload: () => void }> = ({ pendingUsers, pendingPosts, reload }) => {
  const [busy, setBusy] = useState('');
  const approveUser = async (u: any) => {
    setBusy(idOf(u));
    try { await api.approveMember(idOf(u)); toast(`${u.name} אושרה למעגל ✨`); reload(); } catch { toast('שגיאה באישור', 'bad'); } finally { setBusy(''); }
  };
  const approvePost = async (p: any) => {
    setBusy(p._id);
    try { await api.approvePost(p._id); toast('הפוסט פורסם בפורום ✔'); reload(); } catch { toast('שגיאה באישור', 'bad'); } finally { setBusy(''); }
  };
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section>
        <SectionTitle title="בקשות הצטרפות למעגל" count={pendingUsers.length} icon={<UserPlus size={18} />} />
        <p className="mb-3 text-xs text-slate-500">חבר/ת מעגל מאושר/ת צובר/ת נקודות ומשתתף/ת בהגרלות.</p>
        {pendingUsers.length === 0 ? <EmptyState icon={<CheckCircle2 size={24} />} title="אין בקשות חדשות" text="בקשות הצטרפות חדשות למעגל יופיעו כאן." /> : (
          <ul className="space-y-2.5">
            {pendingUsers.map(u => (
              <li key={idOf(u)} className="flex items-center gap-3 rounded-[1.4rem] border border-rose-100 bg-white p-3.5 shadow-soft">
                <Avatar u={u} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-strong text-[15px] text-ink">{u.name}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    {u.city && <span className="flex items-center gap-1"><MapPin size={11} /> {u.city}</span>}
                    {u.occupation && <span className="flex items-center gap-1"><Briefcase size={11} /> {u.occupation}</span>}
                    {u.phone && <span className="flex items-center gap-1" dir="ltr"><Phone size={11} /> {u.phone}</span>}
                    {u.age && <span>גיל {u.age}</span>}
                  </div>
                </div>
                <button onClick={() => approveUser(u)} disabled={busy === idOf(u)} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"><Check size={15} /> אישור</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <SectionTitle title="פוסטים לפורום" count={pendingPosts.length} icon={<MessageSquare size={18} />} />
        <p className="mb-3 text-xs text-slate-500">כל פוסט עובר אישור לפני שהוא עולה.</p>
        {pendingPosts.length === 0 ? <EmptyState icon={<CheckCircle2 size={24} />} title="אין פוסטים שממתינים" /> : (
          <ul className="space-y-2.5">
            {pendingPosts.map(p => (
              <li key={p._id} className="rounded-[1.4rem] border border-amber-100 bg-white p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">{p.author?.name || p.authorName} · {fmtDate(p.createdAt)}</p>
                    <h4 className="mt-0.5 font-strong text-[15px] text-ink">{p.title}</h4>
                  </div>
                  <Badge tone="amber"><Clock size={11} /> ממתין</Badge>
                </div>
                <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-slate-600">{p.content}</p>
                {p.image && <img src={p.image} alt="" className="mt-2 max-h-40 rounded-xl object-cover" />}
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => approvePost(p)} disabled={busy === p._id} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"><Check size={15} /> פרסום</button>
                  <DeleteButton name={p.title} label="דחייה" onConfirm={async () => { await api.deletePost(p._id); reload(); }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

/* ------------------------- stories ------------------------- */
const StoryThumb: React.FC<{ s: any; tall?: boolean }> = ({ s, tall }) => (
  <div className={`relative overflow-hidden rounded-2xl bg-ink ${tall ? 'aspect-[9/14]' : 'aspect-[9/12]'}`}>
    {s.type === 'image' ? (
      <>
        <img src={s.content} alt="" className="h-full w-full object-cover" />
        {s.caption && <p className="absolute inset-x-2 bottom-2 rounded-xl bg-black/45 px-2 py-1.5 text-center text-xs text-white">{s.caption}</p>}
      </>
    ) : (
      <div className="flex h-full items-center justify-center p-4 text-center" style={{ background: themeOf(s.background).css, color: themeOf(s.background).ink }}>
        <p className="font-display text-[15px] leading-snug" style={{ color: themeOf(s.background).ink }}>{s.content}</p>
      </div>
    )}
  </div>
);

export const StoriesAdmin: React.FC<{ pending: any[]; active: any[]; reload: () => void }> = ({ pending, active, reload }) => {
  const [busy, setBusy] = useState('');
  return (
    <div className="space-y-8">
      <section>
        <SectionTitle title="ממתינים לאישור" count={pending.length} icon={<Clock size={18} />} />
        <p className="mb-3 text-xs text-slate-500">סטטוס שאושר עולה לאתר ל־24 שעות. יש לבדוק שהתוכן מכבד וצנוע.</p>
        {pending.length === 0 ? <EmptyState icon={<PlayCircle size={24} />} title="אין סטטוסים שממתינים" text="סטטוסים חדשים יופיעו כאן לאישור." /> : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {pending.map(s => (
              <article key={s._id} className="flex flex-col gap-2 rounded-[1.4rem] border border-rose-100 bg-white p-2.5 shadow-soft">
                <div className="flex items-center gap-2 px-1"><Avatar u={s.user} size="h-7 w-7" /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-ink">{s.user?.name}</span><span className="text-[10px] text-slate-400">{fmtDate(s.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></span></div>
                <StoryThumb s={s} tall />
                <div className="flex gap-1.5">
                  <button disabled={busy === s._id} onClick={async () => { setBusy(s._id); try { await api.approveStory(s._id); toast('הסטטוס פורסם ✔'); reload(); } finally { setBusy(''); } }} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"><Check size={14} /> פרסום</button>
                  <DeleteButton name="הסטטוס" onConfirm={async () => { await api.deleteStory(s._id); reload(); }} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section>
        <SectionTitle title="באוויר עכשיו" count={active.length} icon={<Eye size={18} />} />
        {active.length === 0 ? <p className="rounded-2xl bg-white/70 p-6 text-center text-sm text-slate-400">אין סטטוסים פעילים כרגע.</p> : (
          <div className="grid grid-cols-3 gap-3 md:grid-cols-4 xl:grid-cols-6">
            {active.map(s => (
              <article key={s._id} className="flex flex-col gap-2 rounded-[1.2rem] border border-emerald-100 bg-white p-2 shadow-soft">
                <StoryThumb s={s} />
                <div className="flex items-center justify-between gap-1 px-1">
                  <span className="min-w-0 truncate text-[12px] text-slate-600">{s.user?.name}</span>
                  <Badge tone="green"><Eye size={10} /> {s.views || 0}</Badge>
                </div>
                <DeleteButton name="הסטטוס" label="הסרה" onConfirm={async () => { await api.deleteStory(s._id); reload(); }} />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

/* ------------------------- messages ------------------------- */
export const MessagesAdmin: React.FC<{ messages: any[]; search: string; reload: () => void }> = ({ messages, search, reload }) => {
  const [filter, setFilter] = useState<'unread' | 'all'>('unread');
  const list = messages
    .filter(m => filter === 'all' || !m.isRead)
    .filter(m => !search.trim() || [m.name, m.subject, m.content, m.phone].some(f => String(f || '').includes(search.trim())))
    .sort((a, b) => +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0));
  const unread = messages.filter(m => !m.isRead).length;
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {([['unread', `לא נקראו (${unread})`], ['all', `הכול (${messages.length})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} className={`rounded-full border px-4 py-2 text-[13px] transition ${filter === id ? 'border-rose-700 bg-rose-700 text-white' : 'border-rose-100 bg-white text-slate-600'}`}>{label}</button>
        ))}
      </div>
      {list.length === 0 ? <EmptyState icon={<Mail size={24} />} title={filter === 'unread' ? 'הכול נקרא ✨' : 'עוד לא הגיעו פניות'} /> : (
        <ul className="space-y-3">
          {list.map(m => (
            <li key={m._id} className={`rounded-[1.5rem] border bg-white p-4 shadow-soft md:p-5 ${m.isRead ? 'border-rose-100/70' : 'border-rose-300 ring-2 ring-rose-50'}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-strong text-[16px] text-ink">{m.name}</h4>
                    {m.subject && <Badge tone="plum">{m.subject}</Badge>}
                    {!m.isRead && <Badge tone="rose">חדש</Badge>}
                  </div>
                  <p className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                    {m.phone && <a href={`tel:${m.phone}`} className="flex items-center gap-1 hover:text-rose-700" dir="ltr"><Phone size={11} /> {m.phone}</a>}
                    <span className="flex items-center gap-1"><Clock size={11} /> {fmtDate(m.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {m.phone && <a href={`https://wa.me/972${String(m.phone).replace(/\D/g, '').replace(/^0/, '')}`} target="_blank" rel="noreferrer" className="rounded-full border border-emerald-100 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50">וואטסאפ</a>}
                  {!m.isRead && <button onClick={async () => { await api.markMessageAsRead(m._id); reload(); }} className="inline-flex items-center gap-1 rounded-full border border-rose-100 px-3 py-1.5 text-xs text-slate-600 hover:border-rose-300"><Check size={13} /> סימון כנקרא</button>}
                  <DeleteButton name={`הפנייה של ${m.name}`} onConfirm={async () => { await api.deleteContactMessage(m._id); reload(); }} />
                </div>
              </div>
              {m.content && <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-rose-50/40 p-3.5 text-[14.5px] leading-relaxed text-slate-700">{m.content}</p>}
              {m.audio && <audio controls className="mt-3 h-9 w-full"><source src={m.audio} type="audio/webm" /></audio>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
