# App icons — TODO (brand: ספוט / SPOT)

The favicon (`/favicon.svg`) and the PWA manifest (`/manifest.json`) are generated at build time from
`shared/brand.js` (see `vite.config.ts`), so they already show the new location-pin mark.

Still the old NASHI rasters — replace with exports of the pin mark (navy `#1E3354` pin, gold `#C6A15C` dot on
cream `#F7F5F0`, ~12% padding; maskable variant with ~20% safe area):

- [ ] `public/favicon.png` (32×32 and 48×48)
- [ ] `public/icon-192.png` (192×192, also used as `apple-touch-icon`)
- [ ] `public/icon-512.png` (512×512)
- [ ] `public/og-image.jpg` / `og-image.png` — the static fallback share image (the server now serves a generated
      brand card at `/s/img/brand.jpg`; the static file is used only when sharp is unavailable)
- [ ] Android launcher icons: `android/app/src/main/res/mipmap-*/ic_launcher*.png`
- [ ] iOS app icon set: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- [ ] Native app name: `capacitor.config.ts` now reads `BRAND.latin`; run `npx cap sync` so
      `android/.../strings.xml` (`app_name`, `title_activity_main`) and `ios/App/App/Info.plist` pick it up.
      (`appId` `com.nashi.app` is an internal identifier and stays.)
