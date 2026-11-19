/* רבינו שלי accessibility widget – per Israeli accessibility regulations (IS 5568 / WCAG 2.0 AA) */
(function () {
  const K = 'rb_a11y';
  let st = {}; try { st = JSON.parse(localStorage.getItem(K) || '{}'); } catch { }
  const css = `
  .a11y-btn{position:fixed;bottom:calc(var(--a11y-b,18px) + env(safe-area-inset-bottom));inset-inline-start:14px;z-index:9000;width:38px;height:38px;border-radius:50%;background:rgba(12,17,40,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(217,174,91,.4);color:#d9ae5b;display:grid;place-items:center;cursor:pointer;opacity:.55;transition:opacity .25s,transform .25s;padding:0}
  .a11y-btn:hover,.a11y-btn:focus-visible{opacity:1;transform:scale(1.06)}.a11y-btn svg{width:20px;height:20px}
  .a11y-btn:focus-visible{outline:3px solid #ffd600;outline-offset:2px}
  .a11y-pnl{position:fixed;bottom:calc(var(--a11y-b,18px) + 48px + env(safe-area-inset-bottom));inset-inline-start:14px;z-index:9001;width:min(330px,calc(100vw - 28px));background:#0e1430;color:#f6efe0;border:1px solid rgba(217,174,91,.35);border-radius:18px;padding:14px;box-shadow:0 30px 60px -20px #000;font:15px/1.5 Fredoka,system-ui,sans-serif;display:none}
  .a11y-pnl.on{display:grid;grid-template-columns:1fr 1fr;gap:6px;max-height:72vh;overflow:auto}.a11y-pnl h4,.a11y-pnl a{grid-column:1/-1}.a11y-pnl h4{font-size:16px;margin:0 0 10px;display:flex;justify-content:space-between;align-items:center;color:#e2c27f}
  .a11y-pnl button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid rgba(246,239,224,.12);border-radius:12px;background:rgba(255,255,255,.03);color:inherit;font:inherit;font-size:13px;cursor:pointer;margin:0;text-align:start}
  .a11y-pnl button:hover{border-color:rgba(217,174,91,.5)}
  .a11y-pnl button[aria-pressed=true]{background:#d1ac63;color:#1a1205;border-color:#d1ac63}
  .a11y-pnl .x{width:auto;border:0;margin:0;padding:4px 8px;font-size:18px;background:none}
  .a11y-pnl a{display:block;text-align:center;font-size:13px;color:#b9b2a3;margin-top:8px;text-decoration:underline}
  html.a11y-contrast,html.a11y-contrast body{background:#000!important;color:#fff!important}
  html.a11y-contrast *:not(.a11y-pnl):not(.a11y-pnl *):not(img):not(video):not(svg):not(svg *){background-color:#000!important;color:#fff!important;border-color:#fff!important;box-shadow:none!important;background-image:none!important;-webkit-text-fill-color:#fff!important}
  html.a11y-contrast a,html.a11y-contrast button{text-decoration:underline!important;color:#ffd600!important;-webkit-text-fill-color:#ffd600!important}
  html.a11y-gray{filter:grayscale(1)}
  html.a11y-links a{text-decoration:underline!important}
  html.a11y-font *{font-family:Arial,Helvetica,sans-serif!important}
  html.a11y-noanim *,html.a11y-noanim *::before,html.a11y-noanim *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
  html.a11y-focus *:focus{outline:3px solid #ffd600!important;outline-offset:2px!important}
  html.a11y-cursor,html.a11y-cursor *{cursor:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M6 2l22 20-9 1 6 12-4 2-6-12-7 7z' fill='%23000' stroke='%23fff' stroke-width='2'/%3E%3C/svg%3E") 6 2,auto!important}
  .a11y-skip{position:absolute;top:-60px;inset-inline-start:8px;z-index:9002;background:#d1ac63;color:#1a1205!important;color:#fff;padding:10px 14px;border-radius:10px}.a11y-skip:focus{top:8px}`;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  const he = document.documentElement.lang !== 'en';
  const opts = [
    ['zoom+', he ? 'הגדלת טקסט' : 'Larger text', 'A+'], ['zoom-', he ? 'הקטנת טקסט' : 'Smaller text', 'A−'],
    ['contrast', he ? 'ניגודיות גבוהה' : 'High contrast', '◐'], ['gray', he ? 'גווני אפור' : 'Grayscale', '◑'],
    ['links', he ? 'הדגשת קישורים' : 'Underline links', '🔗'], ['font', he ? 'פונט קריא' : 'Readable font', 'Aa'],
    ['noanim', he ? 'עצירת אנימציות' : 'Stop animations', '⏸'], ['focus', he ? 'הדגשת פוקוס מקלדת' : 'Keyboard focus', '⌨'],
    ['cursor', he ? 'סמן גדול' : 'Big cursor', '🖱'], ['reset', he ? 'איפוס' : 'Reset', '↺']
  ];
  const apply = () => {
    const h = document.documentElement;
    ['contrast', 'gray', 'links', 'font', 'noanim', 'focus', 'cursor'].forEach(k => h.classList.toggle('a11y-' + k, !!st[k]));
    h.style.fontSize = st.zoom ? (100 + st.zoom * 12.5) + '%' : '';
    document.querySelectorAll('.a11y-pnl button[data-k]').forEach(b => b.setAttribute('aria-pressed', !!st[b.dataset.k]));
    try { localStorage.setItem(K, JSON.stringify(st)); } catch { }
  };
  const btn = document.createElement('button'); btn.className = 'a11y-btn'; btn.setAttribute('aria-label', he ? 'תפריט נגישות' : 'Accessibility menu'); btn.title = he ? 'נגישות' : 'Accessibility'; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="4" r="2"/><path d="M20 8.5c-2.6.6-5.3.9-8 .9s-5.4-.3-8-.9l-.5 1.9c2.1.5 4.3.8 6.5.9V14l-2.2 7.2 1.9.6L11.6 16h.8l1.9 5.8 1.9-.6L14 14v-2.7c2.2-.1 4.4-.4 6.5-.9z"/></svg>';
  const pnl = document.createElement('div'); pnl.className = 'a11y-pnl'; pnl.setAttribute('role', 'dialog'); pnl.setAttribute('aria-label', he ? 'הגדרות נגישות' : 'Accessibility settings');
  pnl.innerHTML = `<h4>${he ? 'נגישות' : 'Accessibility'}<button class="x" aria-label="${he ? 'סגירה' : 'Close'}">✕</button></h4>` + opts.map(([k, l, i]) => `<button data-k="${k}" aria-pressed="false"><span>${l}</span><b>${i}</b></button>`).join('') + `<a href="/accessibility.html">${he ? 'הצהרת נגישות' : 'Accessibility statement'}</a>`;
  const skip = document.createElement('a'); skip.className = 'a11y-skip'; skip.href = '#main'; skip.textContent = he ? 'דלגו לתוכן הראשי' : 'Skip to main content';
  document.body.prepend(skip); document.body.appendChild(btn); document.body.appendChild(pnl);
  if (!document.getElementById('main')) { const m = document.querySelector('main') || document.querySelector('header + *') || document.body.children[1]; if (m) m.id = m.id || 'main'; }
  btn.onclick = () => { pnl.classList.toggle('on'); if (pnl.classList.contains('on')) pnl.querySelector('button[data-k]').focus(); };
  pnl.querySelector('.x').onclick = () => { pnl.classList.remove('on'); btn.focus(); };
  pnl.addEventListener('click', e => {
    const b = e.target.closest('button[data-k]'); if (!b) return; const k = b.dataset.k;
    if (k === 'zoom+') st.zoom = Math.min(4, (st.zoom || 0) + 1); else if (k === 'zoom-') st.zoom = Math.max(-2, (st.zoom || 0) - 1); else if (k === 'reset') st = {}; else st[k] = !st[k];
    apply();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && pnl.classList.contains('on')) { pnl.classList.remove('on'); btn.focus(); } });
  apply();
})();
