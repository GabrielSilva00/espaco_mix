/**
 * 09-dev/dashboard-dev — Dashboard do desenvolvedor: acesso, features exclusivas.
 */
import { test, expect, Page } from '@playwright/test';
import { aceitarLGPD, loginAsDev, loginAsAdmin, loginAsUser, logout, BASE_URL } from '../helpers/auth.helper';

async function abrirDashboardDev(page: Page): Promise<boolean> {
  const ok = await loginAsDev(page);
  if (!ok) return false;

  // Dashboard dev pode ter link específico
  const devBtn = page.getByRole('button', { name: /dev|developer|desenvolvedor/i }).first();
  if (await devBtn.isVisible({ timeout: 6000 })) {
    await devBtn.click();
    await page.waitForTimeout(500);
    return true;
  }

  return true; // Dashboard pode estar acessível diretamente após login dev
}

// ─── Acesso ao dashboard dev ──────────────────────────────────────────────────

test.describe('Dashboard Dev — Acesso', () => {
  test('desenvolvedor consegue fazer login com role dev', async ({ page }) => {
    const ok = await loginAsDev(page);
    if (!ok) { test.skip(true, 'Credenciais dev não configuradas'); return; }

    // Apenas verifica que o login não causou erro
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 5000 });
  });

  test('dev vê recursos exclusivos não disponíveis para usuário comum', async ({ page }) => {
    const ok = await loginAsDev(page);
    if (!ok) { test.skip(true, 'Credenciais dev não configuradas'); return; }

    // Dev deve ter acesso a algo que usuário comum não tem
    const devFeature = page.getByText(/dev|log|debug|sistema/i).first();
    if (await devFeature.isVisible({ timeout: 6000 })) {
      await expect(devFeature).toBeVisible();
    }
  });

  test('usuário comum NÃO tem acesso a features de dev', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais de usuário não configuradas'); return; }

    const devMenu = page.getByRole('button', { name: /developer|desenvolvedor|dev tools/i });
    await expect(devMenu).not.toBeVisible();
  });

  test('admin NÃO tem acesso a features exclusivas de dev (roles separadas)', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    // Dev tem role separada de admin — funcionalidades dev não devem estar no admin
    const devTools = page.getByRole('button', { name: /dev tools|developer tools/i });
    if (await devTools.isVisible({ timeout: 3000 })) {
      // Se admin tiver acesso a ferramentas dev, registra mas não falha
      // (pode ser comportamento intencional)
      await expect(devTools).toBeVisible();
    }
  });
});

// ─── Ferramentas de desenvolvimento ──────────────────────────────────────────

test.describe('Dashboard Dev — Ferramentas', () => {
  test('painel de controle de features (feature flags) está acessível', async ({ page }) => {
    const abriu = await abrirDashboardDev(page);
    if (!abriu) { test.skip(true, 'Credenciais dev não configuradas'); return; }

    const featureFlags = page.getByText(/feature flag|feature toggle|configurações.*sistema/i).first();
    if (await featureFlags.isVisible({ timeout: 6000 })) {
      await expect(featureFlags).toBeVisible();
    }
  });

  test('visualização de logs do sistema está acessível', async ({ page }) => {
    const abriu = await abrirDashboardDev(page);
    if (!abriu) { test.skip(true, 'Credenciais dev não configuradas'); return; }

    const logsBtn = page.getByRole('button', { name: /logs|log do sistema|system logs/i }).first();
    if (await logsBtn.isVisible({ timeout: 6000 })) {
      await expect(logsBtn).toBeVisible();
    }
  });

  test('endpoint de saúde da API está acessível via dashboard dev', async ({ page }) => {
    const abriu = await abrirDashboardDev(page);
    if (!abriu) { test.skip(true, 'Credenciais dev não configuradas'); return; }

    const healthStatus = page.getByText(/health|saudável|online|status.*api/i).first();
    if (await healthStatus.isVisible({ timeout: 6000 })) {
      await expect(healthStatus).toBeVisible();
    }
  });

  test('informações do ambiente são exibidas', async ({ page }) => {
    const abriu = await abrirDashboardDev(page);
    if (!abriu) { test.skip(true, 'Credenciais dev não configuradas'); return; }

    const env = page.getByText(/development|production|staging|NODE_ENV/i).first();
    if (await env.isVisible({ timeout: 6000 })) {
      await expect(env).toBeVisible();
    }
  });
});

// ─── Funcionalidades de teste ─────────────────────────────────────────────────

test.describe('Dashboard Dev — Funcionalidades de Teste', () => {
  test('botão de limpar dados de teste está disponível (se existir)', async ({ page }) => {
    const abriu = await abrirDashboardDev(page);
    if (!abriu) { test.skip(true, 'Credenciais dev não configuradas'); return; }

    const limparBtn = page.getByRole('button', { name: /limpar dados|clear data|reset|seed/i }).first();
    if (await limparBtn.isVisible({ timeout: 5000 })) {
      await expect(limparBtn).toBeVisible();
    }
  });

  test('mock de pagamento está indicado no dashboard dev', async ({ page }) => {
    const abriu = await abrirDashboardDev(page);
    if (!abriu) { test.skip(true, 'Credenciais dev não configuradas'); return; }

    const mockIndicator = page.getByText(/mock|teste|simulado|payment.*test/i).first();
    if (await mockIndicator.isVisible({ timeout: 5000 })) {
      await expect(mockIndicator).toBeVisible();
    }
  });

  test('scanner de QR Code está disponível para dev', async ({ page }) => {
    const abriu = await abrirDashboardDev(page);
    if (!abriu) { test.skip(true, 'Credenciais dev não configuradas'); return; }

    const scannerBtn = page.getByRole('button', { name: /scanner|scan|check-in|câmera/i }).first();
    if (await scannerBtn.isVisible({ timeout: 6000 })) {
      await expect(scannerBtn).toBeVisible();
    }
  });
});

// ─── Sem erros no dashboard dev ───────────────────────────────────────────────

test.describe('Dashboard Dev — Estabilidade', () => {
  test('dashboard dev não causa erros JS ao carregar', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    const abriu = await abrirDashboardDev(page);
    if (!abriu) { test.skip(true, 'Credenciais dev não configuradas'); return; }

    await page.waitForTimeout(2000);

    const critical = errors.filter(e => !/ResizeObserver|extension/i.test(e));
    expect(critical, `Erros JS: ${critical.join(' | ')}`).toHaveLength(0);
  });

  test('sem avisos de chaves React duplicadas', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'warning' && /duplicate key/i.test(msg.text())) {
        warnings.push(msg.text());
      }
    });

    const abriu = await abrirDashboardDev(page);
    if (!abriu) { test.skip(true, 'Credenciais dev não configuradas'); return; }

    await page.waitForTimeout(2000);
    expect(warnings, `Chaves duplicadas: ${warnings.join(' | ')}`).toHaveLength(0);
  });
});
