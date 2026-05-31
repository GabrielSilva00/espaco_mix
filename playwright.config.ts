import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './',
  testMatch: ['**/testes/**/*.spec.ts', '**/tests/**/*.spec.ts'],

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,

  timeout: 30_000,

  reporter: [
    ['html', { open: 'never', outputFolder: 'test-results' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  outputDir: 'test-results',

  use: {
    // Em produção/CI: defina BASE_URL para a URL real do deploy.
    // Em desenvolvimento: usa o Express que em dev-mode proxia o Vite,
    // garantindo que os headers do Helmet (segurança) estejam presentes.
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',

    navigationTimeout: 30_000,
    actionTimeout:     20_000,

    trace:      'on-first-retry',
    screenshot: 'only-on-failure',
    video:      'retain-on-failure',
  },

  projects: [
    { name: 'chromium',      use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ],

  globalTeardown: './tests/helpers/report-summary.ts',

  webServer: [
    {
      command:             'npm run dev:server',
      url:                 'http://localhost:3000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout:             120_000,
      stdout:              'pipe',
      stderr:              'pipe',
    },
    {
      command:             'npx vite',
      url:                 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout:             120_000,
      stdout:              'pipe',
      stderr:              'pipe',
    },
  ],
});
