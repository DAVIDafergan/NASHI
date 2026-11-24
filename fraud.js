// מערכת נגד רמאויות: בודקת כל קבלה ומחזירה ציון סיכון (0 עד 100) וסיבות
const sharp = require('sharp');
const crypto = require('crypto');
const fs = require('fs');

// טביעת אצבע חזותית (dHash): מזהה את אותה תמונה גם אחרי חיתוך קל, דחיסה או צילום מחדש
async function visualHash(file) {
  const px = await sharp(file).rotate().grayscale().resize(17, 16, { fit: 'fill' }).raw().toBuffer();
  let bits = '';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) bits += px[y * 17 + x] > px[y * 17 + x + 1] ? '1' : '0';
  return BigInt('0b' + bits).toString(16).padStart(64, '0');
}
const hamming = (a, b) => { let x = BigInt('0x' + a) ^ BigInt('0x' + b), n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };
const fileHash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// קריאת הקבלה עם Claude (רק אם הוגדר ANTHROPIC_API_KEY)
async function aiRead(file, storeNames) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const img = await sharp(file).rotate().resize(1400, 1400, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  const prompt = `זו תמונה שמשתמש העלה כקבלה במבצע הגרלות. העסקים המשתתפים: ${storeNames.join(', ')}.
החזר JSON בלבד, בלי טקסט נוסף:
{"is_receipt": bool, "business_name": string|null, "total": number|null, "date": "YYYY-MM-DD"|null, "receipt_number": string|null,
 "is_photo_of_screen": bool, "looks_edited": bool, "is_handwritten_or_fake": bool, "notes": string}
total = הסכום הסופי לתשלום. looks_edited = סימנים לעריכה דיגיטלית, ספרות לא אחידות, הדבקות.`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'claude-haiku-4-5', max_tokens: 400,
        messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img.toString('base64') } }, { type: 'text', text: prompt }] }],
      }),
    });
    const j = await r.json();
    const text = j.content?.[0]?.text || '';
    return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  } catch (e) { console.error('AI check failed:', e.message); return null; }
}

const norm = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const similar = (a, b) => { a = norm(a); b = norm(b); return a && b && (a.includes(b) || b.includes(a) || a.slice(0, 4) === b.slice(0, 4)); };

async function assess(db, { file, userId, store, amount, receiptNo, receiptDate, ip }) {
  const flags = []; let risk = 0;
  const add = (pts, msg) => { risk += pts; flags.push(msg); };

  // 1. אותה תמונה בדיוק, או תמונה כמעט זהה
  const sha = fileHash(file);
  const vhash = await visualHash(file).catch(() => null);
  if (db.prepare('SELECT 1 FROM receipts WHERE file_hash=?').get(sha)) return { block: 'התמונה הזו כבר הועלתה' };
  if (vhash) {
    const recent = db.prepare("SELECT vhash FROM receipts WHERE vhash IS NOT NULL AND created_at > datetime('now','-60 days')").all();
    if (recent.some(r => hamming(r.vhash, vhash) <= 22)) return { block: 'נראה שהקבלה הזו כבר נסרקה' };
  }

  // 2. התנהגות חשודה
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  if (user.banned) return { block: 'החשבון חסום. לבירור פנו אלינו' };
  const ageH = (Date.now() - new Date(user.created_at.replace(' ', 'T') + 'Z')) / 36e5;
  if (ageH < 1 && amount > 300) add(20, 'חשבון חדש מאוד עם סכום גבוה');
  const avg = db.prepare("SELECT AVG(amount) a, COUNT(*) c FROM receipts WHERE store_id=? AND status='approved'").get(store.id);
  if (avg.c >= 5 && amount > avg.a * 4) add(25, `סכום גבוה פי ${(amount / avg.a).toFixed(1)} מהממוצע בעסק`);
  if (amount >= 200 && amount % 100 === 0) add(10, 'סכום עגול');
  const sameStoreToday = db.prepare("SELECT COUNT(*) c FROM receipts WHERE user_id=? AND store_id=? AND date(created_at)=date('now')").get(userId, store.id).c;
  if (sameStoreToday >= 1) add(15, 'קבלה נוספת מאותו עסק היום');
  const prevNos = db.prepare('SELECT receipt_no FROM receipts WHERE user_id=? AND store_id=?').all(userId, store.id).map(r => Number(r.receipt_no)).filter(Number.isFinite);
  if (prevNos.some(n => Math.abs(n - Number(receiptNo)) <= 3)) add(25, 'מספרי קבלה עוקבים מאותו משתמש');
  if (ip) {
    const usersOnIp = db.prepare("SELECT COUNT(DISTINCT user_id) c FROM receipts WHERE ip=? AND created_at > datetime('now','-7 days')").get(ip).c;
    if (usersOnIp >= 4) add(20, `${usersOnIp} משתמשים שונים מאותה רשת השבוע`);
  }

  // 3. קריאת הקבלה עם בינה מלאכותית והשוואה למה שהמשתמש הזין
  const ai = await aiRead(file, db.prepare('SELECT name FROM stores WHERE active=1').all().map(s => s.name));
  let aiMatch = false;
  if (ai) {
    if (!ai.is_receipt) add(60, 'הבינה המלאכותית: זו לא נראית קבלה');
    if (ai.looks_edited) add(50, 'סימנים לעריכה דיגיטלית');
    if (ai.is_photo_of_screen) add(30, 'צילום של מסך');
    if (ai.is_handwritten_or_fake) add(50, 'קבלה בכתב יד או מזויפת');
    const totalOk = ai.total != null && Math.abs(ai.total - amount) <= 1;
    const storeOk = similar(ai.business_name, store.name);
    const dateOk = !ai.date || ai.date === receiptDate;
    const noOk = !ai.receipt_number || norm(ai.receipt_number).includes(norm(receiptNo)) || norm(receiptNo).includes(norm(ai.receipt_number));
    if (ai.total != null && !totalOk) add(40, `בקבלה כתוב ${ai.total} ₪ אבל הוזן ${amount} ₪`);
    if (ai.business_name && !storeOk) add(35, `בקבלה כתוב "${ai.business_name}" ולא ${store.name}`);
    if (!dateOk) add(15, `תאריך בקבלה: ${ai.date}`);
    if (!noOk) add(15, `מספר קבלה בתמונה: ${ai.receipt_number}`);
    aiMatch = ai.is_receipt && totalOk && storeOk && dateOk && !ai.looks_edited && !ai.is_photo_of_screen;
    if (aiMatch) flags.push('✓ הבינה המלאכותית אימתה סכום, עסק ותאריך');
  } else flags.push('לא בוצעה בדיקת בינה מלאכותית');

  risk = Math.min(100, risk);
  const auto = process.env.AUTO_APPROVE === 'true' && aiMatch && risk < 20;
  return { risk, flags, ai, sha, vhash, auto };
}

module.exports = { assess };
