import { defineConfig, devices } from '@playwright/test';

const origin = 'http://127.0.0.1:4182';
const publicURL = process.env.PLAYWRIGHT_PUBLIC_URL;
const baseURL = publicURL || origin + (process.env.VITE_BASE_PATH || '/one-sky-many-stories/');

export default defineConfig({
  testDir: './tests',
  outputDir: publicURL ? './artifacts/public-webtoon-qa/test-results' : './artifacts/webtoon-qa/test-results',
  timeout: 90_000,
  expect: { timeout: 8_000 },
  workers: 2,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'iphone-webkit',
      use: {
        ...devices['iPhone 16'],
        browserName: 'webkit',
        viewport: { width: 393, height: 852 },
        screen: { width: 393, height: 852 },
        deviceScaleFactor: 3,
      },
    },
    {
      name: 'desktop-chromium',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'ipad-webkit',
      use: { ...devices['iPad Pro 11'], browserName: 'webkit' },
    },
  ],
  webServer: publicURL ? undefined : {
    command: 'python3 tests/serve_dist.py',
    url: baseURL,
    reuseExistingServer: false,
  },
});
