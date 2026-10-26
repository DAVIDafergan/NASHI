// The site's name lives HERE only — the website (Vite), the server (emails, share pages, OG images) read it from
// this file. Renaming the site = changing these values.
// (Internal identifiers — package name, API paths, localStorage keys, the nashi-co.com domain — are not the brand.)
export const BRAND = {
  name: 'ספוט',
  latin: 'SPOT',                                   // manifest, app title, places that need Latin letters
  tagline: 'כל התרבות החרדית במקום אחד',
  about: 'אירועים, שיעורים, חוגים, גמ"חים והשראה לציבור החרדי, לגברים, לנשים ולמשפחות, מכל הארץ ובמקום אחד.',
  siteUrl: 'https://nashi-co.com',                 // the domain stays for now
  emailFrom: 'updates@nashi-co.com',
};

/** "ספוט <updates@…>" for outgoing mail. */
export const mailFrom = () => `${BRAND.name} <${BRAND.emailFrom}>`;

/** Brand colours (logo, OG images, emails): ink-navy, warm gold, dusty rose as a secondary accent. */
export const BRAND_COLORS = { ink: '#121C2E', navy: '#1E3354', gold: '#C6A15C', goldDeep: '#8A6828', rose: '#BD7A81', bg: '#F7F5F0', soft: '#E8ECF3' };

/** The mark: a location pin with a "spot" dot, as an SVG string (server-side images, favicon). */
export function logoMarkSvg({ pin = BRAND_COLORS.navy, dot = BRAND_COLORS.gold, size = 64 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><path d="M32 4C20.4 4 11 13.2 11 24.6 11 40 32 60 32 60s21-20 21-35.4C53 13.2 43.6 4 32 4z" fill="${pin}"/><circle cx="32" cy="24.5" r="8.5" fill="${dot}"/></svg>`;
}
