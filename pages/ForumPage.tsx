import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare, Plus, ThumbsUp, Send, Search,
  Image as ImageIcon, X, Clock, User as UserIcon, MessageCircle, CheckCircle,
  Share2, Heart, ChevronDown
} from 'lucide-react';
import { api } from '../services/api';
import ScrollReveal from '../components/ScrollReveal';

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
      alert("שגיאה בשליחת הפוסט. נסי שוב מאוחר יותר.");
    }
    setIsSubmitting(false);
  };

  const handleLike = async (postId: string) => {
    if (!user) return alert("התחברי כדי לעשות לייק");
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
      text: `בואי להצטרף לדיון בפורום הנשי: "${post.title}"`,
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
    { key: 'new', label: 'חדשות ביותר' },
    { key: 'popular', label: 'פופולרי ביותר' },
    ...(user ? [{ key: 'mine' as SortMode, label: 'שלי' }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#FFFBF7] pb-24 pt-6 px-4 md:px-8 text-right" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* כותרת הפורום */}
        <ScrollReveal className="flex flex-col md:flex-row justify-between items-center gap-5 bg-white p-6 md:p-8 rounded-2xl shadow-[0_2px_16px_rgba(15,23,42,0.06)] border border-slate-100">
          <div className="text-center md:text-right">
            <h1 className="text-2xl md:text-3xl font-bold text-[#1A202C] flex items-center justify-center md:justify-start gap-3">
              <MessageSquare className="text-[#2D6A4F]" size={28} /> פורום נשי
            </h1>
            <p className="text-[#718096] font-medium mt-1 text-sm">מרחב בטוח לשיתוף, התייעצות וצמיחה משותפת.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="min-h-[44px] bg-[#2D6A4F] text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md shadow-[#2D6A4F]/15 hover:bg-[#245A41] active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus size={18}/> פתיחת נושא חדש
          </button>
        </ScrollReveal>

        {/* הודעת הצלחה לאחר שליחה לבדיקה */}
        {showSuccessMessage && (
          <div className="bg-[#2D6A4F] text-white p-4 rounded-xl shadow-md flex items-center gap-3 animate-bounce-in font-bold text-sm">
            <CheckCircle size={20} />
            הפוסט שלך נשלח בהצלחה! הוא יופיע בפורום מיד לאחר אישור המנהלת.
          </div>
        )}

        {/* Tabs */}
        <ScrollReveal delay={60} className="flex gap-2 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setSortMode(tab.key)}
              className={`px-4 py-2 min-h-[36px] rounded-full text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${
                sortMode === tab.key
                  ? 'bg-[#2D6A4F] text-white shadow-md shadow-[#2D6A4F]/20'
                  : 'bg-white text-[#718096] border border-slate-200 hover:border-[#2D6A4F]/40 hover:text-[#2D6A4F]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </ScrollReveal>

        {/* רשימת הפוסטים */}
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-[#2D6A4F] border-r-4 border-transparent mx-auto"></div>
              <p className="text-[#718096] font-medium mt-4 text-sm">טוען שיחות בפורום...</p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <MessageSquare className="mx-auto text-slate-200 mb-4" size={44} />
              <p className="text-[#718096] font-bold text-sm">לא נמצאו נושאים התואמים לחיפוש שלך.</p>
            </div>
          ) : (
            filteredPosts.map((post, i) => {
              const isExpanded = expandedPostId === post._id;
              const isLiked = post.likes?.includes(user?.id) || post.likes?.includes(user?._id);
              return (
                <ScrollReveal
                  key={post._id}
                  as="article"
                  delay={i < 6 ? i * 70 : 0}
                  className="bg-white rounded-lg border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)] hover:scale-[1.01] transition-all duration-200 p-4"
                >
                  {/* ראש הפוסט */}
                  <div className="flex items-center gap-3 mb-3">
                    <img
                      src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${post.authorName || 'user'}`}
                      alt={post.authorName}
                      className="w-10 h-10 rounded-full bg-[#DCEEE5] shrink-0 object-cover border border-slate-100"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-[#1A202C] text-sm truncate">{post.authorName}</h4>
                      <p className="text-[12px] text-[#A0AEC0] font-normal flex items-center gap-1">
                        <Clock size={11}/> {new Date(post.createdAt).toLocaleDateString('he-IL')}
                      </p>
                    </div>
                  </div>

                  {/* כותרת + תוכן */}
                  <h3 className="text-base md:text-lg font-bold text-[#1A202C] leading-snug mb-1.5">{post.title}</h3>
                  <p className={`text-[#4A5568] text-sm leading-[1.5] whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-3'}`}>
                    {post.content}
                  </p>
                  {!isExpanded && post.content && post.content.length > 140 && (
                    <button
                      onClick={() => setExpandedPostId(post._id)}
                      className="text-[#2D6A4F] text-xs font-bold mt-1.5 hover:underline"
                    >
                      קרא עוד
                    </button>
                  )}

                  {isExpanded && post.image && (
                    <div className="rounded-xl overflow-hidden border border-slate-100 mt-3">
                      <img src={post.image} className="w-full h-auto max-h-[360px] object-cover" alt={post.title} />
                    </div>
                  )}

                  {/* שורת אינטראקציה */}
                  <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleLike(post._id)}
                        title={`${post.likes?.length || 0} לייקים`}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#F5F5F5] hover:bg-[#DCEEE5] transition-colors active:scale-95 ${isLiked ? 'text-[#E85C5C]' : 'text-[#718096]'}`}
                      >
                        <Heart size={15} className={isLiked ? 'fill-current' : ''} />
                        <span className="text-[13px] font-medium">{post.likes?.length || 0}</span>
                      </button>
                      <span
                        title={`${post.comments?.length || 0} תגובות`}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#F5F5F5] text-[#718096]"
                      >
                        <MessageCircle size={15}/>
                        <span className="text-[13px] font-medium">{post.comments?.length || 0}</span>
                      </span>
                      <button
                        onClick={() => handleShare(post)}
                        title="שיתוף"
                        className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#F5F5F5] text-[#718096] hover:text-[#2D6A4F] hover:bg-[#DCEEE5] transition-colors active:scale-95"
                      >
                        <Share2 size={15}/>
                      </button>
                    </div>

                    <button
                      onClick={() => setExpandedPostId(isExpanded ? null : post._id)}
                      className="min-h-[36px] flex items-center gap-1.5 bg-[#2D6A4F] hover:bg-[#245A41] text-white px-4 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-sm"
                    >
                      {isExpanded ? 'סגירת הדיון' : 'צפה בדיון'}
                      <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* תגובות — מוצג רק כשמורחב */}
                  {isExpanded && (
                    <div className="bg-[#F5F5F5] rounded-xl p-4 space-y-3 mt-3">
                      {post.comments?.map((comment: any, ci: number) => (
                        <div key={ci} className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 flex flex-col gap-1">
                          <span className="font-semibold text-[#2D6A4F] text-[11px]">{comment.authorName}</span>
                          <p className="text-[#1A202C] text-sm">{comment.text}</p>
                        </div>
                      ))}

                      {user && (
                        <div className="flex gap-2 pt-1">
                          <input
                            placeholder="כתבי תגובה לשיחה..."
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-[#2D6A4F]/25 focus:border-[#2D6A4F]/40 transition-all text-right min-h-[44px]"
                            value={commentText[post._id] || ''}
                            onChange={(e) => setCommentText({ ...commentText, [post._id]: e.target.value })}
                          />
                          <button
                            onClick={() => handleAddComment(post._id)}
                            className="min-w-[44px] min-h-[44px] bg-[#2D6A4F] text-white p-3 rounded-lg shadow-sm hover:bg-[#245A41] active:scale-95 transition-all flex items-center justify-center"
                          >
                            <Send size={18} className="rotate-180" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollReveal>
              );
            })
          )}
        </div>
      </div>

      {/* מודאל פתיחת נושא חדש */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-start justify-center bg-slate-950/50 backdrop-blur-sm animate-fade-in text-right md:pt-24 md:px-4 md:pb-4" onClick={() => setIsModalOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[88vh] animate-slide-up border-t-4 border-[#2D6A4F]">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto -mt-2 mb-4 shrink-0 md:hidden"></div>
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h3 className="text-xl font-bold text-[#1A202C]">פתיחת נושא חדש</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors"><X size={18}/></button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-4 overflow-y-auto no-scrollbar pr-1">
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#718096] mr-1">כותרת הדיון</label>
                <input
                  required
                  placeholder="על מה תרצי לדבר?"
                  className="w-full p-4 bg-[#F5F5F5] border border-transparent rounded-xl font-semibold outline-none focus:ring-2 focus:ring-[#2D6A4F]/25 focus:border-[#2D6A4F]/40 transition-all text-right min-h-[44px]"
                  value={newPost.title}
                  onChange={e => setNewPost({ ...newPost, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#718096] mr-1">תוכן ההודעה</label>
                <textarea
                  required
                  placeholder="שתפי אותנו בפרטים..."
                  rows={5}
                  className="w-full p-4 bg-[#F5F5F5] border border-transparent rounded-xl font-medium outline-none focus:ring-2 focus:ring-[#2D6A4F]/25 focus:border-[#2D6A4F]/40 resize-none transition-all text-right"
                  value={newPost.content}
                  onChange={e => setNewPost({ ...newPost, content: e.target.value })}
                />
              </div>

              <div className="relative border-2 border-dashed border-slate-200 p-6 text-center rounded-xl bg-[#F5F5F5] group hover:border-[#2D6A4F]/40 transition-all">
                <input type="file" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                {newPost.image ? (
                  <div className="relative inline-block">
                    <img src={newPost.image} className="h-32 rounded-xl shadow-md border-4 border-white" />
                    <button onClick={(e) => { e.preventDefault(); setNewPost({...newPost, image: ''}); }} className="absolute -top-2 -left-2 bg-[#E53E3E] text-white rounded-full p-1"><X size={14}/></button>
                  </div>
                ) : (
                  <div className="text-[#A0AEC0] flex flex-col items-center gap-2">
                    <ImageIcon size={28} className="opacity-50" />
                    <span className="text-xs font-bold">הוסיפי תמונה (אופציונלי, עד 2MB)</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full min-h-[44px] py-4 rounded-xl font-bold text-base shadow-md flex items-center justify-center gap-3 transition-all active:scale-95 ${isSubmitting ? 'bg-slate-300' : 'bg-[#2D6A4F] text-white hover:bg-[#245A41]'}`}
              >
                {isSubmitting ? 'שולח לבדיקה...' : <><Send size={18} className="rotate-180"/> שליחת פוסט לאישור</>}
              </button>
              <p className="text-[11px] text-center text-[#A0AEC0] font-medium">הפוסט יפורסם לאחר אישור מנהלת המערכת</p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForumPage;
