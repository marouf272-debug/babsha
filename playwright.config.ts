import { defineConfig, devices } from '@playwright/test';

// End to end tests run against the production preview build.
export default defineConfig({
  testDir: 'tests/e2e',
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5181' },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:5181',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'phone-portrait', use: { ...devices['Pixel 7'] } }],
});
