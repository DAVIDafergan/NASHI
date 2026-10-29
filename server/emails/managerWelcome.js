// The "you were approved" email for a new culture manager: a proper welcome — what was approved,
// what she/he can do, how to start in 3 steps, the house rules, and where to get help.
// Worded by gender (g) — neutral when unknown. Table layout + inline styles so Gmail/Outlook render it.
import { BRAND, BRAND_COLORS, mailFrom } from '../../shared/brand.js';
import { g } from '../../shared/audience.js';

const C = { ...BRAND_COLORS, peach: '#F8BE9C', peachSoft: '#FDEBDD', line: '#EDE6DC', muted: '#6B7280' };
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function managerWelcomeEmail({ name = '', gender, regionLabel = '', siteUrl = BRAND.siteUrl } = {}) {
  const G = (o) => g(gender, o);
  const adminUrl = `${siteUrl}/#/admin`;
  const first = esc(String(name).trim().split(/\s+/)[0] || '');
  const region = esc(regionLabel);

  const subject = G({
    male: `אושרת! ברוך הבא לצוות מנהלי התרבות של ${BRAND.name}`,
    female: `אושרת! ברוכה הבאה לצוות מנהלות התרבות של ${BRAND.name}`,
    neutral: `הבקשה אושרה – ברוכים הבאים לצוות ניהול התרבות של ${BRAND.name}`,
  });

  const can = [
    ['📅', 'אירועים', G({ male: 'העלה הופעות, כנסים, שיעורים וערבים – עם תמונה, מקום, שעה ומחיר.', female: 'העלי הופעות, כנסים, שיעורים וערבים – עם תמונה, מקום, שעה ומחיר.', neutral: 'העלאת הופעות, כנסים, שיעורים וערבים – עם תמונה, מקום, שעה ומחיר.' })],
    ['🎟️', 'הרשמה וכרטיסים', G({ male: 'פתח הרשמה לאירוע, ראה מי נרשם, וסרוק כרטיסים בכניסה מהטלפון.', female: 'פתחי הרשמה לאירוע, ראי מי נרשמה, וסרקי כרטיסים בכניסה מהטלפון.', neutral: 'פתיחת הרשמה לאירוע, רשימת הנרשמים וסריקת כרטיסים בכניסה מהטלפון.' })],
    ['🎨', 'חוגים', G({ male: 'פרסם חוגים קבועים לגברים, לנשים, לילדים או למשפחות.', female: 'פרסמי חוגים קבועים לגברים, לנשים, לילדים או למשפחות.', neutral: 'פרסום חוגים קבועים לגברים, לנשים, לילדים או למשפחות.' })],
    ['🤝', 'קהילה וגמ"חים', G({ male: 'הוסף גמ"חים, יוזמות ושירותים קהילתיים באזור.', female: 'הוסיפי גמ"חים, יוזמות ושירותים קהילתיים באזור.', neutral: 'הוספת גמ"חים, יוזמות ושירותים קהילתיים באזור.' })],
    ['🎁', 'הגרלות', G({ male: 'צור הגרלה, והמערכת תגריל זוכה בין המשתתפים.', female: 'צרי הגרלה, והמערכת תגריל זוכה בין המשתתפות.', neutral: 'יצירת הגרלה – המערכת מגרילה זוכה בין המשתתפים.' })],
  ];

  const steps = [
    G({ male: `היכנס ל${BRAND.name} עם המייל והסיסמה שלך.`, female: `היכנסי ל${BRAND.name} עם המייל והסיסמה שלך.`, neutral: `כניסה ל${BRAND.name} עם המייל והסיסמה שלך.` }),
    G({ male: 'לחץ על כפתור המגן 🛡️ למעלה (בטלפון), או בתפריט על "ניהול האזור שלי".', female: 'לחצי על כפתור המגן 🛡️ למעלה (בטלפון), או בתפריט על "ניהול האזור שלי".', neutral: 'לחיצה על כפתור המגן 🛡️ למעלה (בטלפון), או בתפריט על "ניהול האזור שלי".' }),
    G({ male: 'בחר מה להוסיף – אירוע, חוג, קהילה או הגרלה – מלא את הפרטים ושמור. זהו, זה באוויר!', female: 'בחרי מה להוסיף – אירוע, חוג, קהילה או הגרלה – מלאי את הפרטים ושמרי. זהו, זה באוויר!', neutral: 'בחירה מה להוסיף – אירוע, חוג, קהילה או הגרלה – מילוי הפרטים ושמירה. זהו, זה באוויר!' }),
  ];

  const rules = [
    G({ male: `מה שתעלה יוצג לגולשים של אזור ${region} בלבד.`, female: `מה שתעלי יוצג לגולשים של אזור ${region} בלבד.`, neutral: `התוכן שיועלה יוצג לגולשים של אזור ${region} בלבד.` }),
    G({ male: 'בכל פריט בחר למי הוא מיועד: גברים, נשים או כולם.', female: 'בכל פריט בחרי למי הוא מיועד: גברים, נשים או כולם.', neutral: 'בכל פריט יש לבחור למי הוא מיועד: גברים, נשים או כולם.' }),
    'רק תמונות צנועות – בלי תמונות נשים. האתר עובר את כל הסינונים, ושומרים על זה יחד.',
    'תוכן ברוח הציבור החרדי בלבד.',
  ];

  const row = (inner, pad = '0 32px') => `<tr><td style="padding:${pad}">${inner}</td></tr>`;
  const h3 = (t) => `<h3 style="margin:28px 0 12px;font-size:18px;color:${C.navy}">${t}</h3>`;

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="max-width:600px;background:#fff;border-radius:24px;overflow:hidden;font-family:Arial,'Segoe UI',sans-serif;color:${C.ink};text-align:right;border:1px solid ${C.line}">
  <tr><td style="background:${C.navy};padding:28px 32px" align="right">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-left:10px"><img src="${siteUrl}/icon-192.png" width="44" height="44" alt="" style="display:block;border-radius:12px"></td>
      <td style="font-size:28px;font-weight:bold;color:#fff">${BRAND.name}</td>
    </tr></table>
    <div style="margin-top:6px;font-size:14px;color:${C.peach}">${BRAND.tagline}</div>
  </td></tr>
  ${row(`<div style="margin-top:28px;display:inline-block;background:${C.peachSoft};color:${C.goldDeep};border-radius:999px;padding:6px 14px;font-size:13px;font-weight:bold">✓ הבקשה אושרה${region ? ` · אזור ${region}` : ''}</div>
    <h1 style="margin:16px 0 8px;font-size:26px;line-height:1.3;color:${C.ink}">מזל טוב${first ? `, ${first}` : ''}! 🎉</h1>
    <p style="margin:0;font-size:16px;line-height:1.7">${G({ male: 'מעכשיו אתה', female: 'מעכשיו את', neutral: 'מעכשיו יש לך הרשאת' })} <b>${G({ male: 'מנהל תרבות', female: 'מנהלת תרבות', neutral: 'ניהול תרבות' })}${region ? ` באזור ${region}` : ''}</b> ב${BRAND.name}. ${G({ male: 'שמחים שהצטרפת – יחד נמלא את האזור באירועים ובתרבות טובה.', female: 'שמחים שהצטרפת – יחד נמלא את האזור באירועים ובתרבות טובה.', neutral: 'שמחים על ההצטרפות – יחד נמלא את האזור באירועים ובתרבות טובה.' })}</p>`)}
  ${row(`<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td style="background:${C.peach};border-radius:999px"><a href="${adminUrl}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:bold;color:${C.ink};text-decoration:none">${G({ male: 'כניסה לניהול האזור שלי', female: 'כניסה לניהול האזור שלי', neutral: 'כניסה לניהול האזור' })} ←</a></td></tr></table>`)}
  ${row(h3(G({ male: 'מה אתה יכול לעשות', female: 'מה את יכולה לעשות', neutral: 'מה אפשר לעשות' })) + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${can.map(([ic, t, d]) => `<tr><td valign="top" style="width:40px;padding:8px 0;font-size:22px">${ic}</td><td style="padding:8px 0;border-bottom:1px solid ${C.line}"><div style="font-weight:bold;font-size:15px">${t}</div><div style="font-size:14px;color:${C.muted};line-height:1.6">${d}</div></td></tr>`).join('')}</table>`)}
  ${row(h3('איך מתחילים – 3 צעדים') + steps.map((s, i) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 10px"><tr><td valign="top" style="width:34px"><div style="width:26px;height:26px;line-height:26px;border-radius:13px;background:${C.navy};color:#fff;text-align:center;font-size:14px;font-weight:bold">${i + 1}</div></td><td style="font-size:15px;line-height:1.6">${s}</td></tr></table>`).join(''))}
  ${row(`<div style="margin-top:20px;background:${C.peachSoft};border-radius:16px;padding:18px 20px"><div style="font-weight:bold;font-size:15px;color:${C.goldDeep};margin-bottom:8px">חשוב לדעת</div>${rules.map(r => `<div style="font-size:14px;line-height:1.7">• ${r}</div>`).join('')}</div>`)}
  ${row(`<p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:${C.muted}">${G({ male: 'שאלה? צריך עזרה? פשוט השב למייל הזה', female: 'שאלה? צריכה עזרה? פשוט השיבי למייל הזה', neutral: 'שאלה או צורך בעזרה? אפשר להשיב למייל הזה' })} ונחזור אליך.</p>
    <p style="margin:16px 0 0;font-size:15px">בהצלחה רבה,<br><b>צוות ${BRAND.name}</b></p>`, '0 32px 28px')}
  <tr><td style="background:${C.bg};padding:16px 32px;font-size:12px;color:${C.muted}" align="center"><a href="${siteUrl}" style="color:${C.muted}">${siteUrl.replace(/^https?:\/\//, '')}</a> · ${BRAND.tagline}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `מזל טוב${first ? `, ${first}` : ''}! הבקשה שלך אושרה – ${G({ male: 'מנהל תרבות', female: 'מנהלת תרבות', neutral: 'ניהול תרבות' })}${region ? ` באזור ${region}` : ''} ב${BRAND.name}.`,
    '', 'מה אפשר לעשות:', ...can.map(([, t, d]) => `- ${t}: ${d}`),
    '', 'איך מתחילים:', ...steps.map((s, i) => `${i + 1}. ${s}`),
    '', 'חשוב לדעת:', ...rules.map(r => `- ${r}`),
    '', `לניהול: ${adminUrl}`, '', `צוות ${BRAND.name}`,
  ].join('\n');

  return { subject, html, text };
}

/** Sends it via Resend. Never throws; logs the outcome (Resend returns {error} instead of throwing). */
export async function sendManagerWelcome(resend, { to, name, gender, regionLabel, replyTo }) {
  if (!resend || !process.env.RESEND_API_KEY || !to) return { skipped: true };
  try {
    const { subject, html, text } = managerWelcomeEmail({ name, gender, regionLabel });
    const r = await resend.emails.send({ from: mailFrom(), to, subject, html, text, ...(replyTo ? { replyTo } : {}) });
    if (r?.error) { console.warn('[manager-welcome] failed:', to, r.error?.message || r.error); return { error: r.error }; }
    console.log('[manager-welcome] sent to', to);
    return { ok: true };
  } catch (e) { console.warn('[manager-welcome] failed:', to, e?.message); return { error: e?.message }; }
}
