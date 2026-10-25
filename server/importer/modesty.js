/**
 * Flyer modesty check (Haredi standard) with Gemini vision. Used for every imported flyer:
 * not modest / unsure / check failed → the event keeps its details but shows NASHI's generated flyer instead.
 * Key: GEMINI_API_KEY (or VITE_GEMINI_API_KEY). IMPORTER_MODESTY=0 turns the check off.
 */
const MODEL = () => process.env.IMPORTER_MODESTY_MODEL || 'gemini-2.5-flash';
const KEY = () => process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
export const modestyEnabled = () => process.env.IMPORTER_MODESTY !== '0' && !!KEY();

const PROMPT = `You review event flyers for a website for Haredi (ultra-Orthodox) Jewish women. Strict Haredi modesty standard.
Answer NOT modest if the image shows ANY of: a man and a woman together or touching/hugging; a woman or girl in sleeveless or short sleeves (above the elbow), a neckline below the collarbone, a skirt or dress above the knee, trousers, leggings or tight sportswear, swimwear; women dancing or exercising in sportswear; a glamour / fashion pose; a woman with long loose uncovered hair as the main subject; any suggestive content.
Drawings, text, objects, landscapes, babies, and women dressed modestly (long sleeves, long skirt, covered hair) are modest.
If unsure, answer NOT modest.
Reply with JSON only: {"modest": true|false, "reason": "<short reason in Hebrew>"}`;

export async function checkFlyer(dataUrl, { fetchImpl = fetch } = {}) {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl || '');
  if (!m) return { modest: true, reason: 'not an image' };
  const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent?key=${encodeURIComponent(KEY())}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: m[1], data: m[2] } }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } }),
  });
  if (!res.ok) { let msg = ''; try { msg = (await res.text()).slice(0, 300); } catch { /* none */ } throw new Error(`gemini HTTP ${res.status} ${msg}`); }
  const j = await res.json();
  const text = j?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  const parsed = JSON.parse(text.replace(/^```(?:json)?|```$/g, '').trim());
  return { modest: parsed.modest === true, reason: String(parsed.reason || '').slice(0, 120) };
}
