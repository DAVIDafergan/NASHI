import React, { useEffect, useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import { shareLink } from '../../utils/share';
import ScrollReveal from '../ScrollReveal';
import { BRAND } from '../../shared/brand';

/** "Bring a friend" band. Members get a personal invite link (points when a friend joins); guests get a join CTA. */
const InviteBand: React.FC<{ user: any; onOpenLogin: () => void }> = ({ user, onOpenLogin }) => {
  const [members, setMembers] = useState<number | null>(null);
  useEffect(() => { api.getPublicStats().then(s => setMembers(s?.members ?? null)).catch(() => {}); }, []);

  const rounded = members && members >= 30 ? (members >= 1000 ? `${(Math.floor(members / 100) * 100).toLocaleString('he-IL')}+` : `${Math.floor(members / 10) * 10}+`) : null;
  const invite = () => shareLink({
    title: `הצטרפו אליי ל${BRAND.name}`,
    text: `${BRAND.tagline}: אירועים, שיעורים, חוגים, הגרלות וקהילה — לגברים, לנשים ולמשפחות. ההצטרפות חינם`,
    path: `/s/join${user ? `?ref=${user._id || user.id}` : ''}`,
  });

  return (
    <section className="px-5 md:px-0">
      <ScrollReveal animation="scale-in">
        <div className="relative overflow-hidden rounded-[2.2rem] bg-ink px-6 py-12 text-center text-white md:px-16 md:py-16">
          <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-rose-400/30 blur-[90px] animate-mesh-drift" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-plum-400/30 blur-[100px] animate-mesh-drift-slow" aria-hidden="true" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-rose-100"><Sparkles size={14} /> {rounded ? `כבר ${rounded} חברים בקהילה` : 'קהילה שגדלה כל יום'}</span>
            <h2 className="mx-auto mt-5 max-w-2xl text-[2.3rem] leading-[1.1] !text-white md:text-[3.4rem]">
              כל אחד מכיר <span className="font-accent text-[1.3em] text-rose-300">עוד מישהו</span> שצריך את המקום הזה
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[17px] leading-relaxed text-white/75">
              {user ? 'שולחים לחברים את הקישור האישי שלך. על כל הצטרפות מקבלים נקודות להגרלות.' : 'ההצטרפות חינם ולוקחת חצי דקה: אירועים, שיעורים, חוגים, הגרלות וקהילה.'}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {user ? (
                <button onClick={invite} className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-strong text-rose-800 shadow-lift transition hover:-translate-y-0.5"><Heart size={17} /> הזמנת חברים</button>
              ) : (
                <>
                  <button onClick={onOpenLogin} className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-strong text-rose-800 shadow-lift transition hover:-translate-y-0.5">הצטרפות חינם</button>
                  <button onClick={invite} className="inline-flex items-center gap-2 rounded-full border border-white/30 px-7 py-3.5 font-strong text-white transition hover:bg-white/10"><Heart size={17} /> שיתוף עם חברים</button>
                </>
              )}
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
};

export default InviteBand;
