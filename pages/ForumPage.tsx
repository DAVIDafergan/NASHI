import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare, Plus, ThumbsUp, Send, Search,
  Image as ImageIcon, X, Clock, User as UserIcon, MessageCircle, CheckCircle,
  Share2, Heart, ChevronDown
} from 'lucide-react';
import { api } from '../services/api';
import ScrollReveal from '../components/ScrollReveal';
import { PageShell, PageHero, Chip, ChipRow, EmptyState, Skeleton, Sheet, IconButton } from '../components/pages/PageKit';
import { BRAND } from '../shared/brand';

type SortMode = 'new' | 'popular' | 'mine';

const ForumPage = ({ user, searchTerm }: { user: any, searchTerm: string }) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('new');
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  // פוסט חדש
  const [newPost, setNewPost] = useState({ title: '', content: '', image: '' });
  const [commentText, setCommentText] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const data = await api.getForumPosts();
      // הצגת פוסטים מאושרים בלבד למשתמשות רגילות
      // אם המשתמש הוא אדמין, הוא יוכל לראות הכל (אופציונלי)
      const visiblePosts = Array.isArray(data)
        ? data.filter((p: any) => p.status === 'approved' || user?.isAdmin)
        : [];
      setPosts(visiblePosts);
    } catch (err) {
      console.error("Failed to load forum posts", err);
    }
    setLoading(false);
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert("עליך להתחבר כדי להוסיף נושא לדיון");

    setIsSubmitting(true);
    try {
      const res = await api.createForumPost(newPost);
      if (res) {
        setIsModalOpen(false);
        setNewPost({ title: '', content: '', image: '' });
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 5000);
        loadPosts(); // רענון הרשימה
      }
    } catch (err) {
      alert("שגיאה בשליחת הפוסט. כדאי לנסות שוב מאוחר יותר.");
    }
    setIsSubmitting(false);
  };

  const handleLike = async (postId: string) => {
    if (!user) return alert("יש להתחבר כדי לעשות לייק");
    try {
      await api.likePost(postId);
      loadPosts(); // רענון כדי לראות את הלייק המעודכן
    } catch (err) {
      console.error("Failed to like post", err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return alert("התמונה גדולה מדי (עד 2MB)");
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => setNewPost({ ...newPost, image: reader.result as string });
    }
  };

  const handleAddComment = async (postId: string) => {
    const text = commentText[postId];
    if (!text || !user) return;
    try {
      const res = await api.addComment(postId, text);
      if (res) {
        setCommentText({ ...commentText, [postId]: '' });
        loadPosts(); // רענון להצגת התגובה החדשה
      }
    } catch (err) {
      console.error("Failed to add comment", err);
    }
  };

  // פונקציית שיתוף
  const handleShare = async (post: any) => {
    const shareData = {
      title: post.title,
      text: `בואו להצטרף לדיון בפורום של ${BRAND.name}: "${post.title}"`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        navigator.clipboard.writeText(window.location.href);
        alert("הקישור לפורום הועתק ללוח!");
      }
    } catch (err) {
      console.error("Error sharing", err);
    }
  };

  // פילטור פוסטים לפי חיפוש
  const searchedPosts = posts.filter(p =>
    (p.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.content || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // מיון/סינון לפי הטאב הנבחר — UX בלבד, אותו דאטה
  const filteredPosts = useMemo(() => {
    const list = [...searchedPosts];
    if (sortMode === 'popular') {
      return list.sort((a, b) => (b.likes?.length || 0) + (b.comments?.length || 0) - ((a.likes?.length || 0) + (a.comments?.length || 0)));
    }
    if (sortMode === 'mine') {
      return list.filter(p => p.author === user?.id || p.author === user?._id);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [searchedPosts, sortMode, user]);

  const tabs: { key: SortMode; label: string }[] = [
    { key: 'new', label: 'החדשים ביותר' },
    { key: 'popular', label: 'פופולרי ביותר' },
    ...(user ? [{ key: 'mine' as SortMode, label: 'שלי' }] : []),
  ];

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const h = Math.floor(diff / 36e5);
    if (h < 1) return 'ממש עכשיו';
    if (h < 24) return `לפני ${h} שע׳`;
    const days = Math.floor(h / 24);
    if (days < 7) return days === 1 ? 'אתמול' : `לפני ${days} ימים`;
    return new Date(d).toLocaleDateString('he-IL');
  };

  return (
    <PageShell wide={false}>
      <PageHero
        eyebrow="פורום"
        title="מדברים,"
        accent="מתייעצים, מפרגנים"
        subtitle="מרחב בטוח לשאלות, המלצות ושיתופים. כל פוסט עובר אישור הנהלה לפני שהוא עולה."
      >
        <button onClick={() => setIsModalOpen(true)} className="btn-primary !px-6 !py-3.5">
          <Plus size={18}/> פתיחת נושא חדש
        </button>
      </PageHero>

      {/* הודעת הצלחה לאחר שליחה לבדיקה */}
      {showSuccessMessage && (
        <div role="status" className="mb-5 flex items-center gap-3 rounded-2xl border border-sage-100 bg-sage-50 p-4 text-[14.5px] text-sage-800 animate-bounce-in">
          <CheckCircle size={20} className="shrink-0" />
          הפוסט שלך נשלח! הוא יופיע בפורום מיד לאחר אישור ההנהלה.
        </div>
      )}

      {/* Tabs */}
      <ChipRow className="mb-6">
        {tabs.map(tab => (
          <Chip key={tab.key} active={sortMode === tab.key} onClick={() => setSortMode(tab.key)}>{tab.label}</Chip>
        ))}
        {searchTerm && <span className="self-center pr-2 text-[13px] text-slate-400">חיפוש: “{searchTerm}”</span>}
      </ChipRow>

      {/* רשימת הפוסטים */}
      <div className="flex flex-col gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-[1.75rem] border border-rose-100/70 bg-white p-5 shadow-petal">
              <div className="flex items-center gap-3"><Skeleton className="h-11 w-11 rounded-full" /><Skeleton className="h-4 w-32" /></div>
              <Skeleton className="mt-4 h-5 w-2/3" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-5/6" />
            </div>
          ))
        ) : filteredPosts.length === 0 ? (
          <EmptyState
            icon={<MessageSquare size={28} />}
            title={sortMode === 'mine' ? 'עוד לא פתחת נושא' : 'אין עדיין שיחות כאן'}
            text={sortMode === 'mine' ? 'יש לך שאלה או המלצה? זה המקום.' : 'אפשר לפתוח את השיחה הראשונה — מישהו בדיוק מחכה לשאלה הזאת.'}
            action={<button onClick={() => setIsModalOpen(true)} className="btn-primary"><Plus size={16}/> פתיחת נושא</button>}
          />
        ) : (
          filteredPosts.map((post, i) => {
            const isExpanded = expandedPostId === post._id;
            const isLiked = post.likes?.includes(user?.id) || post.likes?.includes(user?._id);
            return (
              <ScrollReveal
                key={post._id}
                as="article"
                delay={i < 6 ? i * 70 : 0}
                className={`rounded-[1.75rem] border bg-white p-5 md:p-6 shadow-petal transition-all duration-500 hover:shadow-lift ${isExpanded ? 'border-rose-200' : 'border-rose-100/70'}`}
              >
                {/* ראש הפוסט */}
                <div className="mb-3 flex items-center gap-3">
                  <img
                    src={`/api/avatar.svg?n=${encodeURIComponent(post.authorName || '')}`}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-full border-2 border-white bg-rose-50 object-cover shadow-soft"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] text-ink font-strong">{post.authorName}</p>
                    <p className="flex items-center gap-1 text-[12px] text-slate-400">
                      <Clock size={11}/> {timeAgo(post.createdAt)}
                    </p>
                  </div>
                  {post.status && post.status !== 'approved' && (
                    <span className="rounded-full bg-champagne-50 px-2.5 py-1 text-[11px] text-champagne-700">ממתין לאישור</span>
                  )}
                </div>

                {/* כותרת + תוכן */}
                <h3 className="mb-1.5 text-[1.15rem] md:text-[1.3rem] leading-snug">{post.title}</h3>
                <p className={`whitespace-pre-wrap text-[15px] leading-[1.65] text-slate-600 ${isExpanded ? '' : 'line-clamp-3'}`}>
                  {post.content}
                </p>
                {!isExpanded && post.content && post.content.length > 140 && (
                  <button onClick={() => setExpandedPostId(post._id)} className="mt-1 text-[13.5px] text-rose-700 hover:underline">
                    להמשך קריאה
                  </button>
                )}

                {isExpanded && post.image && (
                  <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-rose-100 animate-scale-in">
                    <img src={post.image} className="h-auto max-h-[420px] w-full object-cover" alt={post.title} />
                  </div>
                )}

                {/* שורת אינטראקציה */}
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-rose-50 pt-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleLike(post._id)}
                      aria-pressed={isLiked}
                      title={`${post.likes?.length || 0} לייקים`}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-2 transition active:scale-90 ${isLiked ? 'bg-rose-100 text-rose-600' : 'bg-rose-50/60 text-slate-500 hover:text-rose-600'}`}
                    >
                      <Heart size={16} className={`${isLiked ? 'fill-current animate-bounce-in' : ''}`} />
                      <span className="text-[13px]">{post.likes?.length || 0}</span>
                    </button>
                    <span title={`${post.comments?.length || 0} תגובות`} className="flex items-center gap-1.5 rounded-full bg-rose-50/60 px-3 py-2 text-slate-500">
                      <MessageCircle size={16}/>
                      <span className="text-[13px]">{post.comments?.length || 0}</span>
                    </span>
                    <button onClick={() => handleShare(post)} aria-label="שיתוף" className="flex items-center rounded-full bg-rose-50/60 px-3 py-2 text-slate-500 transition hover:text-rose-700 active:scale-90">
                      <Share2 size={16}/>
                    </button>
                  </div>

                  <button
                    onClick={() => setExpandedPostId(isExpanded ? null : post._id)}
                    className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 text-[13.5px] transition font-strong ${isExpanded ? 'bg-plum-300 text-ink' : 'bg-rose-50 text-rose-700 hover:bg-plum-300 hover:text-ink'}`}
                  >
                    {isExpanded ? 'סגירה' : 'לדיון'}
                    <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* תגובות — מוצג רק כשמורחב */}
                {isExpanded && (
                  <div className="mt-4 space-y-2.5 animate-fade-in-up">
                    {post.comments?.length ? post.comments.map((comment: any, ci: number) => (
                      <div key={ci} className="flex gap-2.5">
                        <img src={`/api/avatar.svg?n=${encodeURIComponent(comment.authorName || '')}`} alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-rose-50" />
                        <div className="rounded-2xl rounded-tr-md bg-rose-50/60 px-4 py-2.5">
                          <span className="block text-[12px] text-rose-700 font-strong">{comment.authorName}</span>
                          <p className="text-[14.5px] text-ink">{comment.text}</p>
                        </div>
                      </div>
                    )) : <p className="text-[13.5px] text-slate-400">עדיין אין תגובות — אפשר להגיב ראשונים.</p>}

                    {user ? (
                      <div className="flex gap-2 pt-2">
                        <input
                          placeholder="תגובה…"
                          className="min-h-[46px] flex-1 rounded-full border border-rose-100 bg-white px-5 text-[15px] outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100/70"
                          value={commentText[post._id] || ''}
                          onChange={(e) => setCommentText({ ...commentText, [post._id]: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(post._id); }}
                        />
                        <button
                          onClick={() => handleAddComment(post._id)}
                          aria-label="שליחת תגובה"
                          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-plum-300 text-ink shadow-soft transition hover:bg-plum-400 active:scale-90"
                        >
                          <Send size={17} className="rotate-180" />
                        </button>
                      </div>
                    ) : (
                      <p className="pt-1 text-[13px] text-slate-400">כדי להגיב צריך להתחבר.</p>
                    )}
                  </div>
                )}
              </ScrollReveal>
            );
          })
        )}
      </div>

      {/* כפתור צף במובייל */}
      <button
        onClick={() => setIsModalOpen(true)}
        aria-label="פתיחת נושא חדש"
        className="fixed bottom-24 left-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-plum-300 text-ink shadow-lift transition active:scale-90 md:hidden"
      >
        <Plus size={24} />
      </button>

      {/* מודאל פתיחת נושא חדש */}
      <Sheet open={isModalOpen} onClose={() => setIsModalOpen(false)} label="פתיחת נושא חדש">
        <div className="p-6 md:p-8 text-right">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <p className="eyebrow">נושא חדש</p>
              <h3 className="mt-1 font-display text-[2rem] leading-tight text-ink">על מה נדבר?</h3>
            </div>
            <IconButton label="סגירה" onClick={() => setIsModalOpen(false)} className="!bg-rose-50"><X size={18}/></IconButton>
          </div>

          <form onSubmit={handleCreatePost} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[13px] text-slate-500">כותרת</span>
              <input
                required
                placeholder="למשל: המלצה על גננת בשכונה"
                className="w-full rounded-2xl border border-rose-100 bg-rose-50/30 p-4 text-[15px] outline-none transition focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-100/70"
                value={newPost.title}
                onChange={e => setNewPost({ ...newPost, title: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[13px] text-slate-500">ההודעה</span>
              <textarea
                required
                placeholder="הפרטים…"
                rows={5}
                className="w-full resize-none rounded-2xl border border-rose-100 bg-rose-50/30 p-4 text-[15px] outline-none transition focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-100/70"
                value={newPost.content}
                onChange={e => setNewPost({ ...newPost, content: e.target.value })}
              />
            </label>

            <div className="group relative rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/30 p-5 text-center transition hover:border-rose-400">
              <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 cursor-pointer opacity-0" aria-label="הוספת תמונה" />
              {newPost.image ? (
                <div className="relative inline-block">
                  <img src={newPost.image} className="h-32 rounded-xl border-4 border-white shadow-soft" />
                  <button onClick={(e) => { e.preventDefault(); setNewPost({...newPost, image: ''}); }} className="absolute -top-2 -left-2 rounded-full bg-red-500 p-1 text-white" aria-label="הסרת תמונה"><X size={14}/></button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-rose-400">
                  <ImageIcon size={26} />
                  <span className="text-[13px]">הוספת תמונה (לא חובה, עד 2MB)</span>
                </div>
              )}
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full !py-4 !text-base disabled:opacity-60">
              {isSubmitting ? 'שולח…' : <><Send size={18} className="rotate-180"/> שליחה לאישור</>}
            </button>
            <p className="text-center text-[12px] text-slate-400">הפוסט יפורסם אחרי אישור ההנהלה</p>
          </form>
        </div>
      </Sheet>
    </PageShell>
  );
};

export default ForumPage;
