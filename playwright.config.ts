import { defineConfig, devices } from '@playwright/test';

// End to end tests run against the production preview build, on port 5182 so they can run
// while `npm run phone` serves port 5181.
export default defineConfig({
  testDir: 'tests/e2e',
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5182' },
  webServer: {
    command: 'npm run build && npx vite preview --host 127.0.0.1 --port 5182 --strictPort',
    url: 'http://127.0.0.1:5182',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'phone-portrait', use: { ...devices['Pixel 7'] } }],
});
