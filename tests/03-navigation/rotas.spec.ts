/**
 * 03-navigation/rotas — Navegação entre views da SPA.
 */
import { test, expect, Page } from '@playwright/test';
import { aceitarLGPD, BASE_URL } from '../helpers/auth.helper';

async function irParaHome(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);
  await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 8000 });
}

// ─── Navegação básica ─────────────────────────────────────────────────────────

test.describe('Rotas — Navegação SPA', () => {
  test('home → contato → home sem erros', async ({ page }) => {
    await irParaHome(page);
    await page.getByRole('button', { name: /^contato$/i }).first().click();
    await expect(page.getByText('Central de Atendimento')).toBeVisible({ timeout: 6000 });
    await page.getByRole('button', { name: /^início$/i }).first().click();
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
  });

  test('home → booking → home via navbar', async ({ page }) => {
    await irParaHome(page);
    const eventBtn = page.getByRole('button', { name: /ver ingressos/i }).first();
    if (!(await eventBtn.isVisible({ timeout: 8000 }))) return;
    await eventBtn.click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: /^início$/i }).first().click();
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
  });

  test('múltiplas navegações consecutivas não causam erros JS', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await irParaHome(page);
    await page.getByRole('button', { name: /^contato$/i }).first().click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /^início$/i }).first().click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /^contato$/i }).first().click();
    await page.waitForTimeout(400);

    const critical = errors.filter(e => !/ResizeObserver|extension/i.test(e));
    expect(critical).toHaveLength(0);
  });

  test('URL não muda ao navegar (é uma SPA com state interno)', async ({ page }) => {
    await irParaHome(page);
    const urlInicio = page.url();

    await page.getByRole('button', { name: /^contato$/i }).first().click();
    await page.waitForTimeout(400);

    // SPA: URL permanece a mesma (não usa react-router)
    expect(page.url()).toBe(urlInicio);
  });
});

// ─── Botão de Voltar ──────────────────────────────────────────────────────────

test.describe('Rotas — Botão Voltar', () => {
  test('"Retornar ao Evento" na contato navega de volta', async ({ page }) => {
    await irParaHome(page);
    await page.getByRole('button', { name: /^contato$/i }).first().click();
    await expect(page.getByText('Central de Atendimento')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /retornar ao evento/i }).click();
    await expect(
      page.getByText(/próximos eventos|ingressos/i).first()
    ).toBeVisible({ timeout: 6000 });
  });

  test('"Voltar ao Site" no modal de auth fecha o modal', async ({ page }) => {
    await irParaHome(page);
    await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
    await expect(page.getByText('Bem-vindo de volta')).toBeVisible({ timeout: 6000 });
    await page.getByRole('button', { name: /voltar ao site/i }).click();
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
  });
});

// ─── Estado 404 / rota inexistente ───────────────────────────────────────────

test.describe('Rotas — Rota Inexistente', () => {
  test('URL desconhecida não causa crash da aplicação', async ({ page }) => {
    // O app é SPA e serve o index.html para qualquer rota
    const res = await page.goto(`${BASE_URL}/rota-que-nao-existe-xyzabc`);

    // Deve retornar 200 (SPA serve index.html)
    expect([200, 404]).toContain(res?.status());

    // A aplicação deve renderizar sem crash
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('API retorna 404 para endpoint desconhecido', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/endpoint-inexistente-xyz');
    expect([404, 400]).toContain(res.status());
  });
});

// ─── Consistência entre navegações ───────────────────────────────────────────

test.describe('Rotas — Consistência', () => {
  test('navbar sempre visível em todas as views', async ({ page }) => {
    await irParaHome(page);
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /^contato$/i }).first().click();
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 5000 });
  });

  test('footer sempre visível na home e contato', async ({ page }) => {
    await irParaHome(page);
    await expect(page.locator('footer').first()).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /^contato$/i }).first().click();
    await page.waitForTimeout(400);
    await expect(page.locator('footer').first()).toBeVisible({ timeout: 5000 });
  });

  test('banner LGPD não reaparece após aceito na mesma sessão', async ({ page }) => {
    await irParaHome(page);

    // Navega para contato e volta
    await page.getByRole('button', { name: /^contato$/i }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /^início$/i }).first().click();
    await page.waitForTimeout(300);

    // Banner não deve reaparecer
    const banner = page.getByRole('button', { name: 'Aceitar e Continuar' });
    await expect(banner).not.toBeVisible();
  });
});
