import { preview } from 'vite';

// Pass the artifact path directly to Vite rather than interpolating it into
// a shell command. Production dist remains the default browser-test target.
await preview({
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { outDir: process.env.KFMB_BROWSER_DIST || (process.env.KFMB_COUNTRY_DISABLED === 'true' ? '../../work/single-country-dist' : 'dist') },
});
