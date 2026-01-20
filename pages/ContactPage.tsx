import React, { useState, useRef } from 'react';
import { Mic, Square, Send, Phone, Mail, MapPin, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

const ContactPage: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    subject: 'בירור על חוגים ואירועים',
    content: ''
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        chunksRef.current = [];
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("לא ניתן לגשת למיקרופון. אנא בדקי הרשאות.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  // פונקציית עזר להפוך Blob ל-Base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let audioBase64 = '';
    if (audioBlob) {
      audioBase64 = await blobToBase64(audioBlob);
    }

    const payload = {
      ...formData,
      audio: audioBase64
    };

    try {
      const result = await api.submitContactMessage(payload);
      
      if (result.success) {
        setIsSubmitted(true);
        setTimeout(() => setIsSubmitted(false), 3000);
        setAudioBlob(null);
        setFormData({ name: '', phone: '', subject: 'בירור על חוגים ואירועים', content: '' });
      } else {
        alert("שגיאה בשליחת הפנייה, נסי שוב.");
      }
    } catch (error) {
      console.error("שגיאה בשליחת הפנייה:", error);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 animate-fade-in-up">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6">
          <CheckCircle size={40} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">פנייתך התקבלה בהצלחה!</h2>
        <p className="text-slate-600">הפנייה נשלחה ותופיע באזור האישי שלך בקרוב.</p>
        <button onClick={() => setIsSubmitted(false)} className="mt-8 text-rose-600 font-medium hover:underline">
          שליחת פנייה נוספת
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center md:text-right">
        <h2 className="text-2xl font-bold text-slate-800">פניות הציבור</h2>
        <p className="text-slate-500">אנחנו כאן לכל שאלה, הצעה או רעיון.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 text-right" dir="rtl">
        <div className="space-y-4">
           {[
             { icon: <Mail size={20} />, label: 'דוא"ל', value: 'YA@101.ORG.IL' },
           ].map((item, i) => (
             <div key={i} className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
               <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-600">
                 {item.icon}
               </div>
               <div>
                 <p className="text-xs text-slate-400 font-medium">{item.label}</p>
                 <p className="font-bold text-slate-800">{item.value}</p>
               </div>
             </div>
           ))}
        </div>

        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">שם מלא</label>
                <input 
                  required 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none text-right" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">טלפון</label>
                <input 
                  required 
                  type="tel" 
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none text-right" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">נושא הפנייה</label>
              <select 
                value={formData.subject}
                onChange={(e) => setFormData({...formData, subject: e.target.value})}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none text-slate-600 text-right"
              >
                <option>בירור על חוגים ואירועים</option>
                <option>בקשה להתנדבות</option>
                <option>הצעה למיזם חדש</option>
                <option>דיווח על תקלה</option>
                <option>אחר</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">תוכן הפנייה</label>
              <textarea 
                rows={4} 
                value={formData.content}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none resize-none text-right"
              ></textarea>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-sm font-medium text-slate-700 mb-2 block text-right">הודעה קולית (אופציונלי)</label>
              <div className="flex items-center justify-end gap-4">
                {audioBlob && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                    <CheckCircle size={14} />
                    ההודעה הוקלטה
                  </div>
                )}
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {isRecording ? <Square size={16} className="fill-current" /> : <Mic size={16} />}
                  {isRecording ? 'עצור הקלטה' : 'הקלט הודעה'}
                </button>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button type="submit" className="w-full md:w-auto px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                <Send size={18} />
                שליחת פנייה
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;