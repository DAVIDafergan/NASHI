import type { CapacitorConfig } from '@capacitor/cli';
import { BRAND } from './shared/brand.js';

const config: CapacitorConfig = {
  appId: 'com.nashi.app',   // internal identifier — unchanged
  appName: BRAND.latin,     // the name under the app icon (shared/brand.js)
  webDir: 'dist'
};

export default config;
