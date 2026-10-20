import React, { useState, useRef } from 'react';
import { Mic, Square, Send, Phone, Mail, MapPin, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import ScrollReveal from '../components/ScrollReveal';
import { PageShell, PageHero, Chip } from '../components/pages/PageKit';

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
      <PageShell wide={false}>
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center animate-scale-in">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-sage-50 text-sage-600 animate-bounce-in">
            <CheckCircle size={40} />
          </div>
          <p className="eyebrow">נשלח</p>
          <h1 className="mt-2 text-[2.4rem] leading-tight">תודה, קיבלנו!</h1>
          <p className="mt-2 text-[16px] text-slate-500">הפנייה נשלחה ותופיע באזור האישי שלך בקרוב.</p>
          <button onClick={() => setIsSubmitted(false)} className="btn-ghost mt-8">
            שליחת פנייה נוספת
          </button>
        </div>
      </PageShell>
    );
  }

  const inputCls = 'w-full rounded-2xl border border-rose-100 bg-rose-50/30 px-4 py-3 text-[15px] text-right outline-none transition focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-100/70';
  const subjects = ['בירור על חוגים ואירועים', 'בקשה להתנדבות', 'הצעה למיזם חדש', 'דיווח על תקלה', 'אחר'];

  return (
    <PageShell className="!max-w-5xl">
      <PageHero
        eyebrow="צרי קשר"
        title="נשמח"
        accent="לשמוע ממך"
        subtitle="שאלה, רעיון, בקשה להתנדב או משהו שלא עובד — כתבי לנו, או פשוט השאירי הודעה קולית."
      />

      <div className="grid gap-6 md:grid-cols-[1fr_2fr] md:gap-8 text-right">
        <aside className="space-y-4">
           {[
             { icon: <Mail size={20} />, label: 'דוא"ל', value: 'YA@101.ORG.IL', href: 'mailto:YA@101.ORG.IL' },
           ].map((item, i) => (
             <ScrollReveal key={i} delay={i * 80}>
               <a href={item.href} className="group flex items-center gap-4 rounded-[1.5rem] border border-rose-100/70 bg-white p-4 shadow-petal transition hover:-translate-y-0.5 hover:shadow-lift">
                 <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 transition group-hover:bg-rose-700 group-hover:text-white">
                   {item.icon}
                 </div>
                 <div className="min-w-0">
                   <p className="text-[12.5px] text-slate-400">{item.label}</p>
                   <p className="truncate text-[15px] text-ink font-strong" dir="ltr">{item.value}</p>
                 </div>
               </a>
             </ScrollReveal>
           ))}
           <ScrollReveal delay={160} className="hidden md:block rounded-[1.5rem] bg-gradient-to-br from-rose-100 via-rose-50 to-champagne-50 p-6">
             <p className="font-accent text-[1.8rem] leading-none text-rose-700">טיפ קטן</p>
             <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">אין זמן להקליד? לחצי על “הקלטת הודעה” ודברי. נחזור אלייך בהקדם.</p>
           </ScrollReveal>
        </aside>

        <ScrollReveal delay={80} animation="scale-in" className="rounded-[2rem] border border-rose-100/70 bg-white p-6 shadow-lift md:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[13px] text-slate-500">שם מלא</span>
                <input
                  required
                  type="text"
                  autoComplete="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] text-slate-500">טלפון</span>
                <input
                  required
                  type="tel"
                  autoComplete="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className={inputCls}
                />
              </label>
            </div>

            <fieldset>
              <legend className="mb-2 block text-[13px] text-slate-500">נושא הפנייה</legend>
              <div className="flex flex-wrap gap-2">
                {subjects.map(s => (
                  <Chip key={s} active={formData.subject === s} onClick={() => setFormData({...formData, subject: s})}>{s}</Chip>
                ))}
              </div>
            </fieldset>

            <label className="block">
              <span className="mb-1.5 block text-[13px] text-slate-500">תוכן הפנייה</span>
              <textarea
                rows={4}
                value={formData.content}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                placeholder="ספרי לנו במה מדובר…"
                className={`${inputCls} resize-none`}
              ></textarea>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50/30 p-3">
              <span className="text-[13.5px] text-slate-500 pr-1">הודעה קולית (לא חובה)</span>
              <div className="flex items-center gap-2">
                {audioBlob && (
                  <span className="flex items-center gap-1.5 rounded-full border border-sage-100 bg-sage-50 px-3 py-1.5 text-[13px] text-sage-700 animate-scale-in">
                    <CheckCircle size={14} />
                    הוקלט
                  </span>
                )}
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`relative flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] transition-all font-strong ${isRecording ? 'bg-red-500 text-white' : 'bg-white text-rose-700 shadow-soft hover:bg-rose-700 hover:text-white'}`}
                >
                  {isRecording && <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40" aria-hidden="true" />}
                  {isRecording ? <Square size={15} className="relative fill-current" /> : <Mic size={16} />}
                  <span className="relative">{isRecording ? 'עצירת הקלטה' : 'הקלטת הודעה'}</span>
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full !py-4 !text-base">
              <Send size={18} className="rotate-180" />
              שליחת הפנייה
            </button>
          </form>
        </ScrollReveal>
      </div>
    </PageShell>
  );
};

export default ContactPage;
