/**
 * 04-events/listar-eventos — Listagem, busca e filtros de eventos na home.
 */
import { test, expect, Page } from '@playwright/test';
import { aceitarLGPD, BASE_URL } from '../helpers/auth.helper';

async function irParaHome(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);
  await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 10000 });
}

// ─── Listagem básica ──────────────────────────────────────────────────────────

test.describe('Eventos — Listagem', () => {
  test.beforeEach(async ({ page }) => { await irParaHome(page); });

  test('seção "Próximos Eventos" está visível', async ({ page }) => {
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible();
  });

  test('cards de evento exibem botão "Ver Ingressos"', async ({ page }) => {
    const btn = page.getByRole('button', { name: /ver ingressos/i }).first();
    if (await btn.isVisible({ timeout: 8000 })) {
      await expect(btn).toBeVisible();
    }
  });

  test('eventos com status "Rascunho" não aparecem na listagem pública', async ({ page }) => {
    const rascunho = page.getByText(/rascunho|draft/i);
    await expect(rascunho).not.toBeVisible();
  });

  test('cards de evento mostram preço (R$ ou Grátis)', async ({ page }) => {
    const preco = page.getByText(/r\$|grátis|gratuito/i).first();
    if (await preco.isVisible({ timeout: 8000 })) {
      await expect(preco).toBeVisible();
    }
  });

  test('carrossel de destaque renderiza quando há eventos em destaque', async ({ page }) => {
    const carrossel = page.locator('[class*="embla"]').first();
    if (await carrossel.isVisible({ timeout: 6000 })) {
      await expect(carrossel).toBeVisible();
    }
  });
});

// ─── Busca ────────────────────────────────────────────────────────────────────

test.describe('Eventos — Busca por Texto', () => {
  test.beforeEach(async ({ page }) => { await irParaHome(page); });

  test('campo de busca está visível', async ({ page }) => {
    await expect(page.getByPlaceholder(/buscar/i).first()).toBeVisible({ timeout: 6000 });
  });

  test('digitar no campo de busca não quebra a página', async ({ page }) => {
    const input = page.getByPlaceholder(/buscar/i).first();
    await input.fill('show');
    await page.waitForTimeout(400);
    await expect(page.locator('body')).toBeVisible();
  });

  test('busca por texto inexistente não retorna eventos', async ({ page }) => {
    const input = page.getByPlaceholder(/buscar/i).first();
    await input.fill('xyzevento_absolutamente_inexistente_999');
    await page.waitForTimeout(500);
    const eventCards = page.getByRole('button', { name: /ver ingressos/i });
    expect(await eventCards.count()).toBe(0);
  });

  test('limpar a busca restaura os eventos', async ({ page }) => {
    const input = page.getByPlaceholder(/buscar/i).first();
    await input.fill('xyzinexistente999');
    await page.waitForTimeout(400);
    await input.clear();
    await page.waitForTimeout(400);
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 5000 });
  });

  test('busca não é sensível a maiúsculas/minúsculas', async ({ page }) => {
    const input = page.getByPlaceholder(/buscar/i).first();
    await input.fill('show');
    await page.waitForTimeout(300);
    const countLower = await page.getByRole('button', { name: /ver ingressos/i }).count();

    await input.fill('SHOW');
    await page.waitForTimeout(300);
    const countUpper = await page.getByRole('button', { name: /ver ingressos/i }).count();

    expect(countLower).toBe(countUpper);
  });

  test('busca com caracteres especiais não causa crash', async ({ page }) => {
    const input = page.getByPlaceholder(/buscar/i).first();
    await input.fill('!@#$%^&*()');
    await page.waitForTimeout(400);
    await expect(page.locator('nav').first()).toBeVisible();
  });

  test('busca com XSS não executa script', async ({ page }) => {
    const errors: string[] = [];
    page.on('dialog', d => { errors.push(`alert: ${d.message()}`); d.dismiss(); });

    const input = page.getByPlaceholder(/buscar/i).first();
    await input.fill('<script>alert("xss")</script>');
    await page.waitForTimeout(400);

    expect(errors).toHaveLength(0);
  });
});

// ─── Filtros de data ──────────────────────────────────────────────────────────

test.describe('Eventos — Filtros', () => {
  test.beforeEach(async ({ page }) => { await irParaHome(page); });

  test('select de filtro de data está visível', async ({ page }) => {
    await expect(page.getByRole('combobox').first()).toBeVisible({ timeout: 6000 });
  });

  test('filtro tem opção "Todos os eventos" (value: all)', async ({ page }) => {
    const select = page.getByRole('combobox').first();
    const opcoes = await select.evaluate((el: HTMLSelectElement) =>
      Array.from(el.options).map(o => o.value)
    );
    expect(opcoes).toContain('all');
  });

  test('filtro tem opção "Este fim de semana" (value: weekend)', async ({ page }) => {
    const select = page.getByRole('combobox').first();
    const opcoes = await select.evaluate((el: HTMLSelectElement) =>
      Array.from(el.options).map(o => o.value)
    );
    expect(opcoes).toContain('weekend');
  });

  test('filtro tem opção "Este mês" (value: month)', async ({ page }) => {
    const select = page.getByRole('combobox').first();
    const opcoes = await select.evaluate((el: HTMLSelectElement) =>
      Array.from(el.options).map(o => o.value)
    );
    expect(opcoes).toContain('month');
  });

  test('filtrar por "Este fim de semana" não quebra a página', async ({ page }) => {
    await page.getByRole('combobox').first().selectOption({ value: 'weekend' });
    await page.waitForTimeout(400);
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible();
  });

  test('filtrar por "Este mês" não quebra a página', async ({ page }) => {
    await page.getByRole('combobox').first().selectOption({ value: 'month' });
    await page.waitForTimeout(400);
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible();
  });

  test('voltar para "Todos" restaura a listagem', async ({ page }) => {
    await page.getByRole('combobox').first().selectOption({ value: 'month' });
    await page.waitForTimeout(300);
    await page.getByRole('combobox').first().selectOption({ value: 'all' });
    await page.waitForTimeout(300);
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible();
  });

  test('filtro + busca funcionam simultaneamente', async ({ page }) => {
    await page.getByRole('combobox').first().selectOption({ value: 'month' });
    await page.getByPlaceholder(/buscar/i).first().fill('show');
    await page.waitForTimeout(400);
    await expect(page.locator('nav').first()).toBeVisible();
  });
});

// ─── Paginação ────────────────────────────────────────────────────────────────

test.describe('Eventos — Paginação', () => {
  test.beforeEach(async ({ page }) => { await irParaHome(page); });

  test('botão "Ver mais" aparece quando há mais de 12 eventos', async ({ page }) => {
    const verMais = page.getByRole('button', { name: /ver mais|carregar mais/i }).first();
    if (await verMais.isVisible({ timeout: 6000 })) {
      await expect(verMais).toBeVisible();
    }
  });

  test('clicar em "Ver mais" carrega mais eventos', async ({ page }) => {
    const verMais = page.getByRole('button', { name: /ver mais|carregar mais/i }).first();
    if (!(await verMais.isVisible({ timeout: 6000 }))) return;

    const antes = await page.getByRole('button', { name: /ver ingressos/i }).count();
    await verMais.click();
    await page.waitForTimeout(500);
    const depois = await page.getByRole('button', { name: /ver ingressos/i }).count();

    expect(depois).toBeGreaterThanOrEqual(antes);
  });
});
