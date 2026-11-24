// תפריט נגישות: נשמר במכשיר (localStorage), מתאים לת"י 5568
(function () {
  const OPTS = [['a-big', 'הגדלת טקסט'], ['a-contrast', 'ניגודיות גבוהה'], ['a-links', 'הדגשת קישורים'], ['a-font', 'גופן קריא'], ['a-still', 'עצירת אנימציות']];
  const get = () => { try { return JSON.parse(localStorage.getItem('a11y') || '[]'); } catch { return []; } };
  const set = v => { try { localStorage.setItem('a11y', JSON.stringify(v)); } catch {} };
  const apply = () => { const on = get(); OPTS.forEach(([c]) => document.documentElement.classList.toggle(c, on.includes(c))); };
  apply();
  addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('button');
    b.className = 'a11y-btn'; b.type = 'button'; b.setAttribute('aria-label', 'תפריט נגישות'); b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'a11yPanel');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="4" r="2"/><path d="M19 8.5c-2 .6-4.3.9-7 .9s-5-.3-7-.9l-.5 1.9c1.9.6 3.9.9 5.8 1V14l-2 7.5 1.9.5L12 16l1.8 6 1.9-.5-2-7.5v-2.6c1.9-.1 3.9-.4 5.8-1z"/></svg>';
    const p = document.createElement('div');
    p.className = 'a11y-panel'; p.id = 'a11yPanel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'הגדרות נגישות');
    p.innerHTML = '<h4>נגישות</h4>' + OPTS.map(([c, l]) => `<button type="button" data-a="${c}" aria-pressed="false">${l}<span aria-hidden="true">●</span></button>`).join('') +
      '<button type="button" data-a="reset">איפוס הגדרות</button><a href="/accessibility.html">הצהרת נגישות</a>';
    document.body.append(b, p);
    const sync = () => { const on = get(); p.querySelectorAll('[data-a]').forEach(x => x.dataset.a !== 'reset' && x.setAttribute('aria-pressed', on.includes(x.dataset.a))); };
    sync();
    b.onclick = () => { const o = p.classList.toggle('on'); b.setAttribute('aria-expanded', o); if (o) p.querySelector('button').focus(); };
    p.onclick = e => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      let on = get(); on = a === 'reset' ? [] : on.includes(a) ? on.filter(x => x !== a) : [...on, a];
      set(on); apply(); sync();
    };
    addEventListener('keydown', e => { if (e.key === 'Escape' && p.classList.contains('on')) { p.classList.remove('on'); b.setAttribute('aria-expanded', 'false'); b.focus(); } });
  });
})();
