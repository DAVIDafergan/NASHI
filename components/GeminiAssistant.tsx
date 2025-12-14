import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles, Loader2 } from 'lucide-react';
import { getSmartRecommendation } from '../services/geminiService';

export const GeminiAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([
    { role: 'model', text: 'היי! אני העוזרת החכמה שלך. מחפשת המלצה לאירוע? רוצה לדעת איך להתנדב?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const response = await getSmartRecommendation(userMsg);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: 'מצטערת, אירעה שגיאה.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-24 left-6 md:bottom-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            p-4 rounded-full shadow-2xl transition-all duration-300 flex items-center gap-2
            ${isOpen ? 'bg-slate-800 text-white rotate-90' : 'bg-gradient-to-r from-rose-500 to-purple-600 text-white hover:scale-105 shadow-rose-300/50'}
          `}
        >
          {isOpen ? <X size={24} /> : <Sparkles size={24} />}
        </button>
      </div>

      {isOpen && (
        <div className="fixed bottom-40 md:bottom-24 left-6 z-50 w-80 md:w-96 bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-purple-100 border border-white flex flex-col overflow-hidden max-h-[500px] animate-fade-in-up">
          <div className="bg-gradient-to-r from-slate-900 to-purple-900 text-white p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-yellow-400" />
              <span className="font-medium">היועצת החכמה</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto bg-slate-50/50 space-y-3 h-80" ref={scrollRef}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`max-w-[80%] p-3 rounded-2xl text-xs font-medium ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-rose-500 to-pink-500 text-white mr-auto rounded-tl-none shadow-sm shadow-rose-200'
                    : 'bg-white border border-slate-100 text-slate-700 ml-auto rounded-tr-none shadow-sm'
                }`}
              >
                {msg.text}
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-center p-2">
                <Loader2 className="animate-spin text-rose-300" size={20} />
              </div>
            )}
          </div>

          <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="כתבי כאן..."
              className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-rose-200 outline-none placeholder-slate-400"
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-rose-500 text-white p-2 rounded-xl hover:bg-rose-600 disabled:opacity-50 transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};