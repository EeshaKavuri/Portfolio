import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.\\tests',
  outputDir: '.\\test-results',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: '.\\artifacts\\test-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4177',
    channel: 'chrome',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', channel: 'chrome' },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4177',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
