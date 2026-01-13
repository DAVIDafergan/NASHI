import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Plus, ThumbsUp, Send, Search, 
  Image as ImageIcon, X, Clock, User as UserIcon, MessageCircle, CheckCircle,
  Share2 // הוספת אייקון שיתוף
} from 'lucide-react';
import { api } from '../services/api';

const ForumPage = ({ user, searchTerm }: { user: any, searchTerm: string }) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
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

  // פונקציית שיתוף חדשה
  const handleShare = async (post: any) => {
    const shareData = {
      title: post.title,
      text: `בואי להצטרף לדיון בפורום הנשי: "${post.title}"`,
      url: window.location.href, // ניתן להחליף בקישור ישיר לפוסט אם קיים
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback למקרה שהדפדפן לא תומך ב-Web Share API
        navigator.clipboard.writeText(window.location.href);
        alert("הקישור לפורום הועתק ללוח!");
      }
    } catch (err) {
      console.error("Error sharing", err);
    }
  };

  // פילטור פוסטים לפי חיפוש
  const filteredPosts = posts.filter(p => 
    (p.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.content || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24 pt-6 px-4 md:px-8 text-right" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* כותרת הפורום ועיצוב עליון */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 animate-fade-in">
          <div className="text-center md:text-right">
            <h1 className="text-3xl font-black text-slate-900 flex items-center justify-center md:justify-start gap-3">
              <MessageSquare className="text-rose-500" size={32} /> פורום נשי.
            </h1>
            <p className="text-slate-500 font-bold mt-1">מרחב בטוח לשיתוף, התייעצות וצמיחה משותפת.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-rose-600 transition-all flex items-center gap-2 active:scale-95"
          >
            <Plus size={20}/> פתיחת נושא חדש
          </button>
        </div>

        {/* הודעת הצלחה לאחר שליחה לבדיקה */}
        {showSuccessMessage && (
          <div className="bg-green-500 text-white p-5 rounded-[2rem] shadow-lg flex items-center gap-3 animate-bounce-in font-black text-sm">
            <CheckCircle size={24} />
            הפוסט שלך נשלח בהצלחה! הוא יופיע בפורום מיד לאחר אישור המנהלת.
          </div>
        )}

        {/* רשימת הפוסטים */}
        <div className="space-y-8">
          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-rose-500 border-r-4 border-transparent mx-auto"></div>
              <p className="text-slate-400 font-bold mt-4">טוען שיחות בפורום...</p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
              <MessageSquare className="mx-auto text-slate-200 mb-4" size={48} />
              <p className="text-slate-400 font-black">לא נמצאו נושאים התואמים לחיפוש שלך.</p>
            </div>
          ) : (
            filteredPosts.map(post => (
              <article key={post._id} className="bg-white rounded-[2.5rem] shadow-md border border-slate-50 overflow-hidden hover:shadow-xl transition-all animate-fade-in-up">
                <div className="p-8 space-y-6">
                  {/* ראש הפוסט */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 shadow-inner">
                        <UserIcon size={24}/>
                      </div>
                      <div className="text-right">
                        <h4 className="font-black text-slate-800">{post.authorName}</h4>
                        <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                          <Clock size={12}/> {new Date(post.createdAt).toLocaleDateString('he-IL')}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase tracking-widest">דיון פעיל</span>
                  </div>

                  {/* תוכן הפוסט */}
                  <div className="space-y-4">
                    <h3 className="text-2xl font-black text-slate-900 leading-tight">{post.title}</h3>
                    <p className="text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">{post.content}</p>
                    {post.image && (
                      <div className="rounded-[2rem] overflow-hidden shadow-lg border-4 border-slate-50">
                        <img src={post.image} className="w-full h-auto max-h-[400px] object-cover" alt={post.title} />
                      </div>
                    )}
                  </div>

                  {/* אינטראקציה ותגובות */}
                  <div className="pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-6 mb-6">
                      <button 
                        onClick={() => handleLike(post._id)}
                        className={`flex items-center gap-2 transition-colors ${post.likes?.includes(user?.id) ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'}`}
                      >
                        <ThumbsUp size={20} className={post.likes?.includes(user?.id) ? "fill-current" : ""} /> 
                        <span className="text-xs font-black">{post.likes?.length || 0}</span>
                      </button>
                      <button className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors">
                        <MessageCircle size={20}/> <span className="text-xs font-black">{post.comments?.length || 0} תגובות</span>
                      </button>
                      {/* כפתור שיתוף חדש */}
                      <button 
                        onClick={() => handleShare(post)}
                        className="flex items-center gap-2 text-slate-400 hover:text-blue-500 transition-colors mr-auto"
                      >
                        <Share2 size={20}/> <span className="text-xs font-black">שיתוף</span>
                      </button>
                    </div>

                    {/* רשימת תגובות */}
                    <div className="bg-slate-50 rounded-[2rem] p-6 space-y-4">
                      {post.comments?.map((comment: any, i: number) => (
                        <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-1">
                          <span className="font-black text-rose-500 text-[11px]">{comment.authorName}</span>
                          <p className="text-slate-700 text-sm font-medium">{comment.text}</p>
                        </div>
                      ))}
                      
                      {/* הוספת תגובה */}
                      {user && (
                        <div className="flex gap-2 pt-2">
                          <input 
                            placeholder="כתבי תגובה לשיחה..." 
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium shadow-sm outline-none focus:ring-2 focus:ring-rose-200 transition-all text-right"
                            value={commentText[post._id] || ''}
                            onChange={(e) => setCommentText({ ...commentText, [post._id]: e.target.value })}
                          />
                          <button 
                            onClick={() => handleAddComment(post._id)} 
                            className="bg-slate-900 text-white p-3 rounded-xl shadow-lg hover:bg-rose-600 transition-colors"
                          >
                            <Send size={18} className="rotate-180" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      {/* מודאל פתיחת נושא חדש */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in text-right">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-800">פתיחת נושא חדש</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X/></button>
            </div>
            
            <form onSubmit={handleCreatePost} className="space-y-4 overflow-y-auto no-scrollbar pr-1">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase mr-2">כותרת הדיון</label>
                <input 
                  required
                  placeholder="על מה תרצי לדבר?" 
                  className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-rose-200 transition-all text-right"
                  value={newPost.title}
                  onChange={e => setNewPost({ ...newPost, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase mr-2">תוכן ההודעה</label>
                <textarea 
                  required
                  placeholder="שתפי אותנו בפרטים..." 
                  rows={5} 
                  className="w-full p-4 bg-slate-50 rounded-2xl font-medium outline-none focus:ring-2 focus:ring-rose-200 resize-none transition-all text-right"
                  value={newPost.content}
                  onChange={e => setNewPost({ ...newPost, content: e.target.value })}
                />
              </div>

              <div className="relative border-2 border-dashed border-slate-200 p-8 text-center rounded-[2rem] bg-slate-50 group hover:border-rose-300 transition-all">
                <input type="file" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                {newPost.image ? (
                  <div className="relative inline-block">
                    <img src={newPost.image} className="h-32 rounded-2xl shadow-lg border-4 border-white" />
                    <button onClick={(e) => { e.preventDefault(); setNewPost({...newPost, image: ''}); }} className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full p-1"><X size={14}/></button>
                  </div>
                ) : (
                  <div className="text-slate-400 flex flex-col items-center gap-2">
                    <ImageIcon size={32} className="opacity-40" />
                    <span className="text-xs font-black">הוסיפי תמונה (אופציונלי, עד 2MB)</span>
                  </div>
                )}
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-5 rounded-[1.5rem] font-black text-lg shadow-xl flex items-center justify-center gap-3 transition-all ${isSubmitting ? 'bg-slate-400' : 'bg-slate-900 text-white hover:bg-rose-600 active:scale-95'}`}
              >
                {isSubmitting ? 'שולח לבדיקה...' : <><Send size={20} className="rotate-180"/> שליחת פוסט לאישור</>}
              </button>
              <p className="text-[10px] text-center text-slate-400 font-bold tracking-widest uppercase">הפוסט יפורסם לאחר אישור מנהלת המערכת</p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForumPage;