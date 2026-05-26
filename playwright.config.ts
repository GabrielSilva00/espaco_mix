import { defineConfig, devices } from '@playwright/test';

// Para carregar .env localmente, descomente as linhas abaixo:
// import dotenv from 'dotenv';
// dotenv.config();

export default defineConfig({
  // Cobre tanto a pasta legada `testes/` quanto a nova estrutura `tests/`
  testDir: './',
  testMatch: ['**/testes/**/*.spec.ts', '**/tests/**/*.spec.ts'],

  // Arquivos do mesmo describe rodam em série; suites diferentes correm em paralelo
  fullyParallel: false,

  // Impede test.only acidental no CI
  forbidOnly: !!process.env.CI,

  // CI: 2 retries para tolerar instabilidade; local: 0 para feedback rápido
  retries: process.env.CI ? 2 : 0,

  // CI: 1 worker (mesmo servidor); local: até 2 para acelerar sem sobrecarregar
  workers: process.env.CI ? 1 : 2,

  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',

    // Timeouts
    navigationTimeout: 30000,
    actionTimeout:     10000,

    // Diagnóstico em falhas
    trace:      'on-first-retry',
    screenshot: 'only-on-failure',
    video:      'on-first-retry',
  },

  projects: [
    // ── Desktop ────────────────────────────────────────────────────────────────
    {
      name: 'chromium',
      use:  { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use:  { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use:  { ...devices['Desktop Safari'] },
    },

    // ── Desktop HD (1920 × 1080) ───────────────────────────────────────────────
    {
      name: 'desktop-hd',
      use:  {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },

    // ── Mobile ─────────────────────────────────────────────────────────────────
    {
      name: 'mobile-chrome',
      use:  { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use:  { ...devices['iPhone 12'] },
    },

    // ── Tablet ──────────────────────────────────────────────────────────────────
    {
      name: 'tablet',
      use:  {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
      },
    },
  ],

  webServer: [
    {
      command:             'npm run dev:server',
      url:                 'http://localhost:3000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout:             120000,
      stdout:              'pipe',
      stderr:              'pipe',
    },
    {
      command:             'npx vite',
      url:                 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout:             120000,
      stdout:              'pipe',
      stderr:              'pipe',
    },
  ],
});
