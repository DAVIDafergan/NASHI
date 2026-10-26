import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { BRAND, BRAND_COLORS, logoMarkSvg } from './shared/brand.js';

/**
 * The brand comes from shared/brand.js only:
 *   index.html  — %BRAND_NAME% / %BRAND_LATIN% / %BRAND_TAGLINE% / %BRAND_ABOUT% / %BRAND_BG% / %BRAND_INK% tokens
 *   /manifest.json and /favicon.svg — generated (dev server + build), the logo mark drawn from logoMarkSvg()
 * (The PNG app icons in public/ are still the old rasters — see public/ICONS-TODO.md.)
 */
const manifest = () => JSON.stringify({
  name: `${BRAND.latin} · ${BRAND.name}`,
  short_name: BRAND.latin,
  description: `${BRAND.name} — ${BRAND.tagline}`,
  lang: 'he', dir: 'rtl',
  start_url: '/?utm_source=pwa_app',
  display: 'standalone',
  background_color: BRAND_COLORS.bg,
  theme_color: BRAND_COLORS.navy,
  icons: [
    { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
}, null, 2);
const favicon = () => logoMarkSvg({ size: 64 });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function brandPlugin(): Plugin {
  return {
    name: 'spot-brand',
    transformIndexHtml(html) {
      return html
        .replace(/%BRAND_NAME%/g, esc(BRAND.name)).replace(/%BRAND_LATIN%/g, esc(BRAND.latin))
        .replace(/%BRAND_TAGLINE%/g, esc(BRAND.tagline)).replace(/%BRAND_ABOUT%/g, esc(BRAND.about))
        .replace(/%BRAND_BG%/g, BRAND_COLORS.bg).replace(/%BRAND_INK%/g, BRAND_COLORS.navy);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/manifest.json') { res.setHeader('Content-Type', 'application/manifest+json'); res.end(manifest()); return; }
        if (req.url === '/favicon.svg') { res.setHeader('Content-Type', 'image/svg+xml'); res.end(favicon()); return; }
        next();
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: manifest() });
      this.emitFile({ type: 'asset', fileName: 'favicon.svg', source: favicon() });
    },
  };
}

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:5000',
            changeOrigin: true,
          },
        },
      },
      build: {
        outDir: 'dist',
      },
      plugins: [react(), brandPlugin()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
