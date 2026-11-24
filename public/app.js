const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const api = async (url, body, isForm) => {
  const r = await fetch(url, body ? { method: 'POST', body: isForm ? body : JSON.stringify(body), headers: isForm ? {} : { 'Content-Type': 'application/json' } } : {});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'משהו השתבש, נסו שוב');
  return j;
};
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = d => new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
const fmtShort = d => new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
const wait = ms => new Promise(r => setTimeout(r, ms));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const toast = (msg, ms = 3800) => { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), ms); };

// קוד הזמנה מהקישור נשמר לכניסה
const REF = new URLSearchParams(location.search).get('ref');
if (REF) try { localStorage.setItem('ref', REF); } catch {}
const getRef = () => { try { return localStorage.getItem('ref') || ''; } catch { return REF || ''; } };

// ---------- גלילה חלקה + כניסה ----------
let lenis;
if (window.Lenis && !reduce) {
  lenis = new Lenis({ duration: 1.1, smoothWheel: true });
  (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => { const t = $(a.getAttribute('href')); if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: -80 }); } }));
}
const scrollTo = sel => lenis ? lenis.scrollTo(sel, { offset: -90 }) : $(sel).scrollIntoView({ behavior: 'smooth' });
document.fonts.ready.then(() => setTimeout(() => { $('#loader').classList.add('done'); revealInit(); }, 450));
setTimeout(() => $('#loader').classList.add('done'), 2200);

function revealInit() {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  $$('.rv:not(.in)').forEach(el => io.observe(el));
}

// כותרת: שקופה מעל הגיבור, אטומה אחרי
const onScroll = () => {
  const y = scrollY, h = $('.hero-wrap').offsetHeight;
  $('#hdr').classList.toggle('solid', y > 40 && y < h - 70);
  document.body.classList.toggle('light-top', y >= h - 70);
  $('#fab').classList.toggle('on', y > h * .6);
};
(lenis ? lenis.on('scroll', onScroll) : addEventListener('scroll', onScroll, { passive: true })); onScroll();

// פס רץ
const strip = items => { const s = items.map(t => `<span>${esc(t)}</span>`).join(''); $('#strip').innerHTML = s + s + s; };

// ---------- נתונים ציבוריים ----------
let PRIZES = [];
async function loadPublic() {
  const [raffles, stores, stats] = await Promise.all([api('/api/raffles'), api('/api/stores'), api('/api/stats')]);
  PRIZES = raffles;
  const grand = raffles.find(r => r.is_grand);
  if (grand?.image) $('#heroBg').style.backgroundImage = `url("${grand.image}")`;
  if (grand) $('#grandTag').innerHTML = `<small>${esc(grand.title)} · ${fmtDate(grand.draw_date)}</small><h3>${esc(grand.prize)}</h3><p>${esc(grand.blurb || '')}</p>
    ${grand.winner ? `<p style="color:var(--gold2);margin-top:8px">הזוכה: ${esc(grand.winner)}</p>` : '<div class="count" id="count"></div>'}`;
  if (grand && !grand.winner) countdown(new Date(grand.draw_date + 'T20:00:00'));
  $('#fPrizes').textContent = raffles.length;
  $('#fStores').textContent = stats.stores;
  if (stats.points >= 500) $('#fTickets').textContent = stats.points.toLocaleString('he-IL');
  else { $('#fTickets').textContent = '10 ₪'; $('#fTickets').nextElementSibling.textContent = 'כרטיס אחד'; }
  strip(raffles.filter(r => !r.winner).map(r => `${r.prize} · ${fmtShort(r.draw_date)}`));
  renderPrizes('all');
  const credits = [...new Set(raffles.map(r => r.credit).filter(c => c && c !== 'Unsplash'))];
  $('#credits').textContent = credits.length ? 'צילומים: ' + credits.join(', ') + ' / Unsplash' : '';

  $('#storeGrid').innerHTML = stores.map((s, i) => `<div class="store rv d${i % 3}"><div class="e">${esc(s.emoji || s.name.trim()[0] || '')}</div><div><b>${esc(s.name)}</b><small>${esc(s.category)}${s.address ? ' · ' + esc(s.address) : ''}</small></div></div>`).join('') +
    '<a class="store join rv" href="/business.html">+ העסק שלכם כאן?</a>';
  $('#store').innerHTML = '<option value="">בחרו עסק</option>' + stores.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  revealInit();
}
const valNum = v => +(String(v || '').replace(/[^\d]/g, '') || 0);
function renderPrizes(f) {
  const now = Date.now(), week = now + 7 * 864e5;
  let list = PRIZES.slice().sort((a, b) => b.is_grand - a.is_grand || a.draw_date.localeCompare(b.draw_date));
  if (f === 'soon') list = list.filter(r => !r.winner && new Date(r.draw_date) <= week && new Date(r.draw_date + 'T23:59') >= now);
  if (f === 'big') list = list.filter(r => r.is_grand || valNum(r.value) >= 2000);
  $('#prizeGrid').innerHTML = list.length ? list.map((r, i) => `<article class="pz rv d${i % 4}${r.is_grand ? ' grand' : ''}${r.winner ? ' done' : ''}">
      <div class="img" style="${r.image ? `background-image:url('${esc(r.image)}')` : ''}"><span class="date">${r.winner ? 'הוגרל' : 'הגרלה ' + fmtDate(r.draw_date)}</span></div>
      <div class="body"><small>${esc(r.title)}</small><h3>${esc(r.prize)}</h3>${r.blurb ? `<p>${esc(r.blurb)}</p>` : ''}
        ${r.value ? `<div class="v">שווי ${esc(r.value)}</div>` : ''}${r.winner ? `<div class="win">הזוכה: ${esc(r.winner)}</div>` : ''}</div></article>`).join('')
    : '<p class="note">אין הגרלות בשבוע הקרוב. כל הכרטיסים שלכם ממשיכים להגרלות הבאות.</p>';
  revealInit();
}
$$('#pfilter button').forEach(b => b.onclick = () => { $$('#pfilter button').forEach(x => x.classList.toggle('on', x === b)); renderPrizes(b.dataset.f); });

function countdown(target) {
  const f = () => {
    const el = $('#count'); if (!el) return;
    let s = Math.max(0, (target - Date.now()) / 1000);
    el.innerHTML = [['ימים', 86400], ['שעות', 3600], ['דקות', 60], ['שניות', 1]].map(([l, n]) => { const v = Math.floor(s / n); s -= v * n; return `<div><b>${v}</b><span>${l}</span></div>`; }).join('');
  };
  f(); setInterval(f, 1000);
}

// ---------- משתמש ----------
let me = null, afterLogin = null;
const refUrl = () => location.origin + '/r/' + me.ref;
async function loadMe() {
  me = await api('/api/me');
  $('#meBtn').textContent = me.user ? `${me.points} כרטיסים` : 'כניסה';
  $('#me').classList.toggle('hide', !me.user);
  if (!me.user) return;
  $('#meName').textContent = me.user.name || '';
  $('#mePts').textContent = me.points;
  const ch = me.total ? me.points / me.total * 100 : 0;
  $('#meChance').textContent = me.points ? (ch >= 1 ? ch.toFixed(0) : ch >= .1 ? ch.toFixed(1) : ch.toFixed(2)) + '%' : '0%';
  $('#meFriends').textContent = me.friends; $('#meBonus').textContent = me.bonus;
  $$('.rb').forEach(x => x.textContent = me.refBonus);
  $('#refUrl').textContent = refUrl();
  $('#freeBtn').classList.toggle('hide', me.freeThisWeek);
  const st = { pending: 'בבדיקה', approved: 'אושר', rejected: 'נדחה' };
  $('#meList').innerHTML = me.receipts.length ? me.receipts.map(r => `<div class="row"><div><b>${esc(r.store)}</b> · ${r.amount} ₪ <small>${fmtDate(r.receipt_date)}</small></div>
    <span class="badge b-${r.status}">${st[r.status]}${r.status === 'approved' ? ` · +${r.points} כרטיסים` : ''}${r.note ? ` · ${esc(r.note)}` : ''}</span></div>`).join('')
    : '<div class="note">עוד לא צילמת קבלות. קנייה ראשונה בעסק שותף, ואת/ה בפנים.</div>';
}
const shareText = () => `מכיר/ה את "קנית·זכית"? כל קנייה בעסקים של רעננה היא כרטיס להגרלה, והפרס הגדול הוא חופשה זוגית ביוון. נרשמים כאן: ${refUrl()}`;
$('#waShare').onclick = () => open('https://wa.me/?text=' + encodeURIComponent(shareText()), '_blank');
$('#copyRef').onclick = async () => { try { await navigator.clipboard.writeText(refUrl()); toast('הקישור הועתק'); } catch { prompt('העתיקו את הקישור', refUrl()); } };
$('#inviteBtn').onclick = () => needLogin(() => { scrollTo('#me'); });

const show = id => { lenis?.stop(); $(id).classList.add('on'); };
const closeAll = () => { $$('.modal').forEach(m => m.classList.remove('on')); lenis?.start(); };
$$('[data-close]').forEach(b => b.onclick = closeAll);
$$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeAll(); }));
addEventListener('keydown', e => e.key === 'Escape' && closeAll());
function needLogin(then) { if (me?.user) return then(); afterLogin = then; $('#loginErr').textContent = ''; show('#mLogin'); setTimeout(() => $('#phone').focus(), 120); }
$('#meBtn').onclick = () => me?.user ? scrollTo('#me') : needLogin(() => scrollTo('#me'));

async function sendCode() {
  const b = $('#sendCode'); b.disabled = true; $('#loginErr').textContent = ''; $('#demoBox').innerHTML = '';
  try {
    const r = await api('/api/otp/send', { phone: $('#phone').value });
    $('#stepPhone').classList.add('hide'); $('#stepCode').classList.remove('hide'); $('#code').focus();
    if (r.demo) { $('#demoBox').innerHTML = `<div class="demo">שירות ה-SMS עדיין לא מחובר, אז הקוד מוצג כאן: <b>${esc(r.demo)}</b></div>`; $('#code').value = r.demo; }
  } catch (e) { $('#loginErr').textContent = e.message; }
  b.disabled = false;
}
$('#sendCode').onclick = sendCode;
$('#phone').onkeydown = e => e.key === 'Enter' && sendCode();
$('#resend').onclick = e => { e.preventDefault(); $('#stepCode').classList.add('hide'); $('#stepPhone').classList.remove('hide'); };
$('#verify').onclick = async () => {
  const b = $('#verify'); b.disabled = true; $('#loginErr').textContent = '';
  try {
    await api('/api/otp/verify', { phone: $('#phone').value, code: $('#code').value, name: $('#name').value, ref: getRef() });
    closeAll(); await loadMe();
    if (afterLogin) { const f = afterLogin; afterLogin = null; f(); }
  } catch (e) { $('#loginErr').textContent = e.message; }
  b.disabled = false;
};
$('#logout').onclick = async e => { e.preventDefault(); await api('/api/logout', {}); loadMe(); };

// ---------- סריקה ----------
const dropHtml = $('#drop').innerHTML;
const openScan = () => { $('#scanErr').textContent = ''; $('#scanForm').classList.remove('hide'); $('#scanCheck').classList.add('hide'); $('#rdate').value = new Date().toISOString().slice(0, 10); show('#mScan'); };
$$('[data-scan]').forEach(b => b.onclick = () => needLogin(openScan));
$('#drop').onclick = () => $('#photo').click();
$('#photo').onchange = () => { const f = $('#photo').files[0]; if (f) $('#drop').innerHTML = `<img src="${URL.createObjectURL(f)}" alt=""><div class="note">לחצו כדי לצלם מחדש</div>`; };
$('#amount').oninput = () => { const p = Math.floor(($('#amount').value || 0) / 10); $('#preview').innerHTML = p ? `הקבלה הזו שווה <b style="color:var(--gold);font-size:18px">${p} כרטיסים</b>` : 'כל 10 ₪ = כרטיס אחד'; };
$('#sendReceipt').onclick = async () => {
  $('#scanErr').textContent = '';
  if (!$('#photo').files[0]) return $('#scanErr').textContent = 'צריך לצלם את הקבלה';
  const fd = new FormData();
  fd.append('image', $('#photo').files[0]); fd.append('store_id', $('#store').value); fd.append('amount', $('#amount').value);
  fd.append('receipt_date', $('#rdate').value); fd.append('receipt_no', $('#rno').value);
  $('#scanForm').classList.add('hide'); $('#scanCheck').classList.remove('hide');
  const rows = $$('.checks div'); rows.forEach(r => r.className = '');
  const anim = (async () => { for (const r of rows) { r.classList.add('on'); await wait(600); r.classList.add('ok'); } })();
  try {
    const [r] = await Promise.all([api('/api/receipts', fd, true), anim]);
    closeAll(); confetti();
    toast(r.approved ? `הקבלה אומתה. נוספו לך ${r.expected} כרטיסים.` : `הקבלה התקבלה. אחרי האישור יתווספו ${r.expected} כרטיסים.`, 5000);
    ['#amount', '#rno'].forEach(s => $(s).value = ''); $('#photo').value = ''; $('#drop').innerHTML = dropHtml;
    loadMe();
  } catch (e) { await anim; $('#scanCheck').classList.add('hide'); $('#scanForm').classList.remove('hide'); $('#scanErr').textContent = e.message; }
};

// ---------- כרטיס חינם ----------
$('#freeBtn').onclick = () => { $('#freeErr').textContent = ''; show('#mFree'); };
$('#sendFree').onclick = async () => {
  try { await api('/api/free-entry', { answer: $('#answer').value }); closeAll(); confetti(); toast('נוסף לך כרטיס חינם'); loadMe(); }
  catch (e) { $('#freeErr').textContent = e.message; }
};

// ---------- זיקוקי זהב עדינים ----------
function confetti() {
  if (reduce) return;
  const c = $('#confetti'), x = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
  const cols = ['#E4C485', '#C99B4A', '#F1DFB4', '#ffffff'];
  const ps = Array.from({ length: 110 }, () => ({ x: innerWidth / 2, y: innerHeight * .55, vx: (Math.random() - .5) * 14, vy: Math.random() * -15 - 5, s: Math.random() * 6 + 3, c: cols[Math.random() * 4 | 0], r: Math.random() * 6 }));
  let t = 0; (function f() {
    x.clearRect(0, 0, c.width, c.height);
    ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .38; p.vx *= .985; p.r += .1; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.globalAlpha = Math.max(0, 1 - t / 150); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
    if (++t < 150) requestAnimationFrame(f); else x.clearRect(0, 0, c.width, c.height);
  })();
}

loadPublic(); loadMe().then(() => { if (getRef() && !me?.user) setTimeout(() => toast('הוזמנת על ידי חבר. צלמו קבלה ראשונה ושניכם מרוויחים.'), 1500); });
