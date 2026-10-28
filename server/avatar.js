import { User as UserModel } from './models.js';
// Initials avatar served from our own domain (replaces api.dicebear.com — no outside image hosts,
// no cartoon faces: kosher filters approve a single clean domain).
const COLORS = ['#1e3354', '#8a6828', '#5b5f68', '#a5636b', '#E88A60'];
const esc = (s) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function initials(name = '') {
  const parts = String(name).replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
}

export function avatarSvg(name = '', color) {
  let h = 0; for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  const bg = COLORS[Number.isInteger(color) && color >= 0 ? color % COLORS.length : h % COLORS.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="${bg}"/><text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Assistant, Arial, sans-serif" font-size="40" font-weight="700" fill="#fff">${esc(initials(name))}</text></svg>`;
}

export const avatarPath = (name = '') => `/api/avatar.svg?n=${encodeURIComponent(String(name).slice(0, 60))}`;

/** one-time: users whose avatar still points at dicebear get the local initials avatar */
export async function backfillAvatars(User = UserModel, log = console.log) {
  try {
    const users = await User.find({ avatar: /dicebear\.com/ }).select('_id name').lean();
    for (const u of users) await User.updateOne({ _id: u._id }, { $set: { avatar: avatarPath(u.name) } });
    if (users.length) log(`[avatars] moved ${users.length} avatars to the local initials avatar`);
  } catch (e) { log('[avatars] backfill failed', e.message); }
}
