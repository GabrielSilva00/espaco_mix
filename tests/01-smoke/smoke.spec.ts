/**
 * 01-smoke — Testes críticos de sanidade
 * Devem passar em < 30s e validar que o site está de pé.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';
const API  = 'http://localhost:3000';

// ─── Carregamento ─────────────────────────────────────────────────────────────

test.describe('Smoke — Carregamento do site', () => {
  test('home retorna status 200', async ({ page }) => {
    const response = await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
  });

  test('página carrega em menos de 5 segundos', async ({ page }) => {
    const t0 = Date.now();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  test('título da página não está vazio', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    expect(title.trim().length).toBeGreaterThan(0);
  });

  test('título contém o nome da plataforma', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/eventix|espaço mix/i);
  });
});

// ─── Elementos essenciais ─────────────────────────────────────────────────────

test.describe('Smoke — Elementos essenciais na home', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    // Aceita LGPD se presente
    try {
      await page.getByRole('button', { name: 'Aceitar e Continuar' }).click({ timeout: 2000 });
    } catch { /* já aceito */ }
  });

  test('<nav> de navegação está visível', async ({ page }) => {
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 8000 });
  });

  test('<main> de conteúdo está presente', async ({ page }) => {
    await expect(page.locator('main').first()).toBeVisible({ timeout: 8000 });
  });

  test('<footer> está presente', async ({ page }) => {
    await expect(page.locator('footer').first()).toBeVisible({ timeout: 8000 });
  });

  test('botão "Entrar" visível para usuário não autenticado', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Entrar', exact: true }).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('seção "Próximos Eventos" renderiza', async ({ page }) => {
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 10000 });
  });

  test('logotipo da plataforma está visível na navbar', async ({ page }) => {
    const logo = page.locator('nav [class*="font-serif"], nav [class*="text-[#d4af37]"]').first();
    await expect(logo).toBeVisible({ timeout: 8000 });
  });
});

// ─── Saúde da API ─────────────────────────────────────────────────────────────

test.describe('Smoke — API health', () => {
  test('GET /api/health responde 200', async ({ request }) => {
    const res = await request.get(`${API}/api/health`);
    expect(res.status()).toBe(200);
  });

  test('/api/health retorna propriedade "status"', async ({ request }) => {
    const res  = await request.get(`${API}/api/health`);
    const body = await res.json();
    expect(body).toHaveProperty('status');
  });
});

// ─── Console sem erros críticos ───────────────────────────────────────────────

test.describe('Smoke — Console JavaScript', () => {
  test('não deve lançar erros críticos no carregamento da home', async ({ page }) => {
    const errors: string[] = [];

    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500); // aguarda scripts assíncronos

    // Filtra erros conhecidos e aceitáveis (ex: extensões do browser)
    const critical = errors.filter(e =>
      !/ResizeObserver|extension|favicon/i.test(e)
    );
    expect(critical, `Erros JS encontrados: ${critical.join(' | ')}`).toHaveLength(0);
  });

  test('não deve ter avisos de React duplicate key no carregamento', async ({ page }) => {
    const warnings: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'warning' && /duplicate key/i.test(msg.text())) {
        warnings.push(msg.text());
      }
    });

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    expect(warnings, 'React duplicate key warnings encontrados').toHaveLength(0);
  });

  test('não deve ter avisos de hooks inválidos do React', async ({ page }) => {
    const warnings: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error' && /hook|invalid hook/i.test(msg.text())) {
        warnings.push(msg.text());
      }
    });

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    expect(warnings, 'React hook warnings encontrados').toHaveLength(0);
  });
});

// ─── Recursos estáticos ───────────────────────────────────────────────────────

test.describe('Smoke — Recursos estáticos', () => {
  test('nenhuma requisição 4xx/5xx durante o carregamento', async ({ page }) => {
    const failed: string[] = [];

    page.on('response', res => {
      if (res.status() >= 400 && !res.url().includes('supabase') && !res.url().includes('firebase')) {
        failed.push(`${res.status()} ${res.url()}`);
      }
    });

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Ignora erros de terceiros (analytics, CDNs) — foca apenas no próprio domínio
    const localFails = failed.filter(u => u.includes('localhost'));
    expect(localFails, `Requisições com erro: ${localFails.join(', ')}`).toHaveLength(0);
  });

  test('CSS de estilo está carregado (body tem background escuro)', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Se o CSS carregar, o background não será branco (#ffffff)
    const bgColor = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundColor
    );
    // Não deve ser branco puro
    expect(bgColor).not.toBe('rgb(255, 255, 255)');
  });
});
