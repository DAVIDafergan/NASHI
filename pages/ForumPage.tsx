import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Plus, ThumbsUp, ThumbsDown, Send, Search, 
  Image as ImageIcon, X, Clock, User as UserIcon, MessageCircle 
} from 'lucide-react';
import { api } from '../services/api';

const ForumPage = ({ user }: { user: any }) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
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
      setPosts(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert("יש להתחבר כדי להוסיף נושא");
    
    const res = await api.createForumPost(newPost);
    if (res.success) {
      alert("הנושא נשלח לאישור המנהלת ויוצג לאחר אישורה.");
      setIsModalOpen(false);
      setNewPost({ title: '', content: '', image: '' });
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
    if (!text) return;
    const res = await api.addComment(postId, text);
    if (res) {
      setCommentText({ ...commentText, [postId]: '' });
      loadPosts(); // רענון להצגת התגובה
    }
  };

  const filteredPosts = posts.filter(p => 
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6 pb-24">
      
      {/* כותרת וחיפוש */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800">פורום נשי</h2>
          <p className="text-slate-500 text-sm">מרחב פתוח לשיח, שיתוף והתייעצות</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all"
        >
          <Plus size={20}/> הוספת נושא לדיון
        </button>
      </div>

      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
        <input 
          type="text" 
          placeholder="חפשי נושא בפורום..." 
          className="w-full pr-12 pl-4 py-4 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm focus:ring-2 focus:ring-rose-100 outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* רשימת פוסטים */}
      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-10"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500 mx-auto"></div></div>
        ) : filteredPosts.map(post => (
          <div key={post._id} className="bg-white rounded-[2rem] shadow-sm border border-slate-50 overflow-hidden animate-fade-in-up">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center text-rose-500"><UserIcon size={20}/></div>
                <div>
                  <h4 className="font-bold text-slate-800">{post.authorName}</h4>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1"><Clock size={12}/> {new Date(post.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <h3 className="text-xl font-black text-slate-800">{post.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{post.content}</p>
              
              {post.image && <img src={post.image} className="w-full h-64 object-cover rounded-2xl" />}

              {/* לייקים ותגובות */}
              <div className="flex items-center gap-6 pt-4 border-t border-slate-50">
                <button className="flex items-center gap-2 text-slate-400 hover:text-green-500 transition-colors">
                  <ThumbsUp size={18}/> <span className="text-xs font-bold">{post.likes?.length || 0}</span>
                </button>
                <button className="flex items-center gap-2 text-slate-400 hover:text-red-500 transition-colors">
                  <ThumbsDown size={18}/> <span className="text-xs font-bold">{post.dislikes?.length || 0}</span>
                </button>
                <div className="flex items-center gap-2 text-slate-400">
                  <MessageCircle size={18}/> <span className="text-xs font-bold">{post.comments?.length || 0} תגובות</span>
                </div>
              </div>

              {/* תגובות */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                {post.comments?.map((comment: any, i: number) => (
                  <div key={i} className="text-xs bg-white p-3 rounded-xl shadow-sm">
                    <span className="font-bold text-rose-500 ml-2">{comment.authorName}:</span>
                    <span className="text-slate-600">{comment.text}</span>
                  </div>
                ))}
                
                <div className="flex gap-2 pt-2">
                  <input 
                    placeholder="כתבי תגובה..." 
                    className="flex-1 bg-white border-none rounded-xl px-4 py-2 text-xs shadow-sm outline-none focus:ring-1 focus:ring-rose-200"
                    value={commentText[post._id] || ''}
                    onChange={(e) => setCommentText({ ...commentText, [post._id]: e.target.value })}
                  />
                  <button onClick={() => handleAddComment(post._id)} className="p-2 bg-slate-900 text-white rounded-xl"><Send size={14}/></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* מודאל הוספת פוסט */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 space-y-4 animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800">פתיחת נושא חדש</h3>
              <button onClick={() => setIsModalOpen(false)}><X/></button>
            </div>
            <input 
              placeholder="כותרת הנושא" 
              className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-rose-100"
              value={newPost.title}
              onChange={e => setNewPost({ ...newPost, title: e.target.value })}
            />
            <textarea 
              placeholder="מה על ליבך?" 
              rows={4} 
              className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-rose-100 resize-none"
              value={newPost.content}
              onChange={e => setNewPost({ ...newPost, content: e.target.value })}
            />
            <div className="border-2 border-dashed p-6 text-center relative rounded-2xl bg-slate-50">
              <input type="file" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
              {newPost.image ? (
                <img src={newPost.image} className="h-24 mx-auto rounded-xl" />
              ) : (
                <div className="text-slate-400 flex flex-col items-center gap-2">
                  <ImageIcon size={32}/>
                  <span className="text-xs font-bold">הוסיפי תמונה (אופציונלי)</span>
                </div>
              )}
            </div>
            <button 
              onClick={handleCreatePost}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl hover:bg-rose-600 transition-colors"
            >
              שלחי לאישור המנהלת
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForumPage;