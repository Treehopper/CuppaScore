import { defineConfig, devices } from '@playwright/test';

const base = (process.env.BASE_PATH?.trim() || '/').replace(/^\/?/, '/').replace(/\/?$/, '/');
const port = 4173;

export default defineConfig({
  testDir: 'apps/pwa/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}${base}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm run preview',
    url: `http://localhost:${port}${base}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
