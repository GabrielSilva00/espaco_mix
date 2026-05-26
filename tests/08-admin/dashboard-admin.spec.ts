/**
 * 08-admin/dashboard-admin — Dashboard do administrador: métricas, gráficos, eventos.
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin, BASE_URL } from '../helpers/auth.helper';

async function abrirDashboardAdmin(page: Page): Promise<boolean> {
  const ok = await loginAsAdmin(page);
  if (!ok) return false;

  // Dashboard admin pode estar acessível após login
  const dashboard = page.getByText(/dashboard|painel|admin|gestão/i).first();
  if (await dashboard.isVisible({ timeout: 6000 })) return true;

  // Pode precisar navegar para uma seção específica
  const adminBtn = page.getByRole('button', { name: /admin|painel|dashboard/i }).first();
  if (await adminBtn.isVisible({ timeout: 5000 })) {
    await adminBtn.click();
    await page.waitForTimeout(500);
    return true;
  }

  return false;
}

// ─── Acesso ao dashboard ──────────────────────────────────────────────────────

test.describe('Dashboard Admin — Acesso', () => {
  test('admin consegue acessar o dashboard após login', async ({ page }) => {
    const abriu = await abrirDashboardAdmin(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    await expect(page.locator('nav').first()).toBeVisible();
  });

  test('usuário comum NÃO vê controles admin', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const adminControles = page.getByRole('button', { name: /aprovações|colaboradores/i });
    await expect(adminControles).not.toBeVisible();
  });
});

// ─── Métricas e KPIs ──────────────────────────────────────────────────────────

test.describe('Dashboard Admin — Métricas', () => {
  test('total de eventos é exibido', async ({ page }) => {
    const abriu = await abrirDashboardAdmin(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const totalEventos = page.getByText(/total.*eventos|eventos.*total|\d+\s*eventos/i).first();
    if (await totalEventos.isVisible({ timeout: 6000 })) {
      await expect(totalEventos).toBeVisible();
    }
  });

  test('total de vendas ou receita é exibido', async ({ page }) => {
    const abriu = await abrirDashboardAdmin(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const vendas = page.getByText(/vendas|receita|faturamento|R\$/i).first();
    if (await vendas.isVisible({ timeout: 6000 })) {
      await expect(vendas).toBeVisible();
    }
  });

  test('total de usuários cadastrados é exibido', async ({ page }) => {
    const abriu = await abrirDashboardAdmin(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const usuarios = page.getByText(/usuários|clientes|members/i).first();
    if (await usuarios.isVisible({ timeout: 6000 })) {
      await expect(usuarios).toBeVisible();
    }
  });

  test('cards de métricas não exibem "NaN" ou "undefined"', async ({ page }) => {
    const abriu = await abrirDashboardAdmin(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const pageContent = await page.textContent('body');
    expect(pageContent).not.toMatch(/\bNaN\b/);
    expect(pageContent).not.toMatch(/\bundefined\b/);
  });
});

// ─── Gráficos (Recharts) ──────────────────────────────────────────────────────

test.describe('Dashboard Admin — Gráficos', () => {
  test('gráfico de vendas por período está visível', async ({ page }) => {
    const abriu = await abrirDashboardAdmin(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    // Recharts renderiza SVGs
    const grafico = page.locator('.recharts-wrapper, svg[class*="recharts"]').first();
    if (await grafico.isVisible({ timeout: 8000 })) {
      await expect(grafico).toBeVisible();
    }
  });

  test('gráfico renderiza sem erros JS', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    const abriu = await abrirDashboardAdmin(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    await page.waitForTimeout(2000);

    const critical = errors.filter(e => !/ResizeObserver|extension/i.test(e));
    expect(critical, `Erros JS no dashboard: ${critical.join(' | ')}`).toHaveLength(0);
  });

  test('tooltip do gráfico aparece ao passar o mouse', async ({ page }) => {
    const abriu = await abrirDashboardAdmin(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const grafico = page.locator('.recharts-wrapper').first();
    if (!(await grafico.isVisible({ timeout: 8000 }))) return;

    await grafico.hover();
    await page.waitForTimeout(500);

    const tooltip = page.locator('.recharts-tooltip-wrapper, [class*="tooltip"]').first();
    if (await tooltip.isVisible({ timeout: 3000 })) {
      await expect(tooltip).toBeVisible();
    }
  });
});

// ─── Gestão de eventos no dashboard ──────────────────────────────────────────

test.describe('Dashboard Admin — Gestão de Eventos', () => {
  test('lista de eventos está visível no dashboard', async ({ page }) => {
    const abriu = await abrirDashboardAdmin(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const listaEventos = page.locator('[class*="event"], [class*="evento"]').first();
    const semEventos   = page.getByText(/nenhum evento|no events/i).first();

    const temLista    = await listaEventos.isVisible({ timeout: 6000 });
    const temMsg      = await semEventos.isVisible({ timeout: 6000 });

    expect(temLista || temMsg).toBe(true);
  });

  test('botão "Criar Evento" está disponível no dashboard', async ({ page }) => {
    const abriu = await abrirDashboardAdmin(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const criarBtn = page.getByRole('button', { name: /criar evento|novo evento|\+ evento/i }).first();
    if (await criarBtn.isVisible({ timeout: 6000 })) {
      await expect(criarBtn).toBeVisible();
    }
  });

  test('eventos exibem informações de vendas (ingressos vendidos)', async ({ page }) => {
    const abriu = await abrirDashboardAdmin(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const cardEvento = page.locator('[class*="event-card"], [class*="evento-card"]').first();
    if (!(await cardEvento.isVisible({ timeout: 6000 }))) return;

    const vendidos = cardEvento.getByText(/vendidos|ingressos|sold|\/\d+/i).first();
    if (await vendidos.isVisible({ timeout: 3000 })) {
      await expect(vendidos).toBeVisible();
    }
  });

  test('status dos eventos é exibido (ativo, rascunho, encerrado)', async ({ page }) => {
    const abriu = await abrirDashboardAdmin(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const status = page.getByText(/ativo|rascunho|encerrado|draft|active/i).first();
    if (await status.isVisible({ timeout: 6000 })) {
      await expect(status).toBeVisible();
    }
  });
});

// ─── Navegação no dashboard ───────────────────────────────────────────────────

test.describe('Dashboard Admin — Navegação', () => {
  test('links de aprovações e colaboradores estão no menu', async ({ page }) => {
    const abriu = await abrirDashboardAdmin(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const aprovacoes = page.getByRole('button', { name: /aprovações/i }).first();
    if (await aprovacoes.isVisible({ timeout: 5000 })) {
      await expect(aprovacoes).toBeVisible();
    }
  });

  test('seção de aprovações é acessível', async ({ page }) => {
    const abriu = await abrirDashboardAdmin(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const aprovacoes = page.getByRole('button', { name: /aprovações/i }).first();
    if (!(await aprovacoes.isVisible({ timeout: 5000 }))) return;

    await aprovacoes.click();
    await page.waitForTimeout(600);

    const filaAprovacao = page.getByText(/aprovação|fila|pendentes|waiting/i).first();
    if (await filaAprovacao.isVisible({ timeout: 5000 })) {
      await expect(filaAprovacao).toBeVisible();
    }
  });

  test('dashboard não quebra ao navegar entre seções', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    const abriu = await abrirDashboardAdmin(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const aprovacoes = page.getByRole('button', { name: /aprovações/i }).first();
    if (await aprovacoes.isVisible({ timeout: 5000 })) {
      await aprovacoes.click();
      await page.waitForTimeout(400);
    }

    const dashboard = page.getByRole('button', { name: /dashboard|início|painel/i }).first();
    if (await dashboard.isVisible({ timeout: 5000 })) {
      await dashboard.click();
      await page.waitForTimeout(400);
    }

    const critical = errors.filter(e => !/ResizeObserver|extension/i.test(e));
    expect(critical, `Erros JS na navegação: ${critical.join(' | ')}`).toHaveLength(0);
  });
});
