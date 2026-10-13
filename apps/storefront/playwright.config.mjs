import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.mjs',
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  outputDir: '../../work/browser-results',
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    launchOptions: process.env.KFMB_CHROMIUM_PATH ? { executablePath: process.env.KFMB_CHROMIUM_PATH, args: ['--no-sandbox'] } : {},
  },
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port 4173${process.env.KFMB_COUNTRY_DISABLED === 'true' ? ' --outDir ../../work/single-country-dist' : ''}`,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
