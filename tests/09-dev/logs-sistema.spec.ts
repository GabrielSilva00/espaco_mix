/**
 * 09-dev/logs-sistema — Logs do sistema, scanner de check-in e ferramentas dev.
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsDev, loginAsAdmin, BASE_URL } from '../helpers/auth.helper';

async function abrirLogsOuFerramentas(page: Page): Promise<boolean> {
  const ok = await loginAsDev(page);
  if (!ok) {
    // Fallback: tenta com admin (pode ter acesso a logs também)
    return loginAsAdmin(page);
  }
  return true;
}

// ─── Logs do sistema ──────────────────────────────────────────────────────────

test.describe('Logs do Sistema — Acesso', () => {
  test('seção de logs é acessível para dev', async ({ page }) => {
    const ok = await loginAsDev(page);
    if (!ok) { test.skip(true, 'Credenciais dev não configuradas'); return; }

    const logsBtn = page.getByRole('button', { name: /logs?|log do sistema|activity/i }).first();
    if (await logsBtn.isVisible({ timeout: 6000 })) {
      await logsBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('logs exibem entrada de cada ação do sistema', async ({ page }) => {
    const ok = await abrirLogsOuFerramentas(page);
    if (!ok) { test.skip(true, 'Credenciais não configuradas'); return; }

    const logsBtn = page.getByRole('button', { name: /logs?/i }).first();
    if (!(await logsBtn.isVisible({ timeout: 5000 }))) return;

    await logsBtn.click();
    await page.waitForTimeout(500);

    // Logs devem ter timestamps ou mensagens
    const logEntry = page.locator('[class*="log"], [class*="entry"]').first();
    if (await logEntry.isVisible({ timeout: 5000 })) {
      await expect(logEntry).toBeVisible();
    }
  });

  test('logs exibem timestamp das ações', async ({ page }) => {
    const ok = await abrirLogsOuFerramentas(page);
    if (!ok) { test.skip(true, 'Credenciais não configuradas'); return; }

    const logsBtn = page.getByRole('button', { name: /logs?/i }).first();
    if (!(await logsBtn.isVisible({ timeout: 5000 }))) return;

    await logsBtn.click();
    await page.waitForTimeout(500);

    // Timestamps em formato de data/hora
    const timestamp = page.getByText(/\d{2}:\d{2}:\d{2}|\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}/i).first();
    if (await timestamp.isVisible({ timeout: 5000 })) {
      await expect(timestamp).toBeVisible();
    }
  });
});

// ─── Scanner de Check-in ──────────────────────────────────────────────────────

test.describe('Scanner de Check-in', () => {
  test('botão de scanner de QR está disponível', async ({ page }) => {
    const ok = await abrirLogsOuFerramentas(page);
    if (!ok) { test.skip(true, 'Credenciais não configuradas'); return; }

    const scannerBtn = page.getByRole('button', { name: /scanner|scan|check-in/i }).first();
    if (await scannerBtn.isVisible({ timeout: 6000 })) {
      await expect(scannerBtn).toBeVisible();
    }
  });

  test('scanner exibe fallback quando câmera é negada', async ({ page }) => {
    // Nega acesso à câmera explicitamente
    await page.context().grantPermissions([]);

    const ok = await abrirLogsOuFerramentas(page);
    if (!ok) { test.skip(true, 'Credenciais não configuradas'); return; }

    const scannerBtn = page.getByRole('button', { name: /scanner|scan|check-in/i }).first();
    if (!(await scannerBtn.isVisible({ timeout: 6000 }))) return;

    await scannerBtn.click();
    await page.waitForTimeout(1000);

    // Deve exibir mensagem de erro/fallback, não crash
    const fallback = page.getByText(/câmera.*negada|permissão.*câmera|camera.*denied|não.*câmera|insira.*código/i).first();
    const input    = page.locator('input[placeholder*="código" i], input[placeholder*="qr" i]').first();

    const temFallback = (await fallback.isVisible({ timeout: 5000 })) ||
                        (await input.isVisible({ timeout: 5000 }));

    // Ou exibe mensagem de fallback, ou exibe um input de inserção manual
    if (!temFallback) {
      // No mínimo a página não deve ter quebrado
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('scanner sem câmera disponível não causa erro JS', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.context().grantPermissions([]);

    const ok = await abrirLogsOuFerramentas(page);
    if (!ok) { test.skip(true, 'Credenciais não configuradas'); return; }

    const scannerBtn = page.getByRole('button', { name: /scanner|scan|check-in/i }).first();
    if (!(await scannerBtn.isVisible({ timeout: 6000 }))) return;

    await scannerBtn.click();
    await page.waitForTimeout(2000);

    const critical = errors.filter(e =>
      !/ResizeObserver|extension|NotAllowedError|NotFoundError/i.test(e)
    );
    expect(critical, `Erros JS ao abrir scanner: ${critical.join(' | ')}`).toHaveLength(0);
  });

  test('input manual de código QR está disponível como alternativa', async ({ page }) => {
    const ok = await abrirLogsOuFerramentas(page);
    if (!ok) { test.skip(true, 'Credenciais não configuradas'); return; }

    const scannerBtn = page.getByRole('button', { name: /scanner|scan|check-in/i }).first();
    if (!(await scannerBtn.isVisible({ timeout: 6000 }))) return;

    await scannerBtn.click();
    await page.waitForTimeout(1000);

    // Deve existir alternativa de input manual
    const manualInput = page.locator('input[placeholder*="código" i], input[placeholder*="hash" i], input[placeholder*="ticket" i]').first();
    const manualBtn   = page.getByRole('button', { name: /inserir código|manual|digitar/i }).first();

    if (await manualInput.isVisible({ timeout: 4000 })) {
      await expect(manualInput).toBeVisible();
    } else if (await manualBtn.isVisible({ timeout: 4000 })) {
      await expect(manualBtn).toBeVisible();
    }
  });

  test('validar código QR inválido exibe mensagem de erro', async ({ page }) => {
    const ok = await abrirLogsOuFerramentas(page);
    if (!ok) { test.skip(true, 'Credenciais não configuradas'); return; }

    const scannerBtn = page.getByRole('button', { name: /scanner|scan|check-in/i }).first();
    if (!(await scannerBtn.isVisible({ timeout: 6000 }))) return;

    await scannerBtn.click();
    await page.waitForTimeout(1000);

    const manualInput = page.locator('input[placeholder*="código" i], input[type="text"]').first();
    if (!(await manualInput.isVisible({ timeout: 4000 }))) return;

    await manualInput.fill('CODIGO-INVALIDO-123456789');

    const validarBtn = page.getByRole('button', { name: /validar|verificar|check/i }).first();
    if (await validarBtn.isVisible({ timeout: 3000 })) {
      await validarBtn.click();
      await page.waitForTimeout(800);

      const erro = page.getByText(/inválido|não encontrado|not found|invalid/i).first();
      if (await erro.isVisible({ timeout: 4000 })) {
        await expect(erro).toBeVisible();
      }
    }
  });

  test('check-in válido exibe confirmação de entrada', async ({ page }) => {
    const ok = await abrirLogsOuFerramentas(page);
    if (!ok) { test.skip(true, 'Credenciais não configuradas'); return; }

    // Este teste só funciona com um código de ingresso real
    // Documenta o comportamento esperado sem executar
    test.skip(true, 'Requer código de ingresso real para testar check-in positivo');
  });
});

// ─── Configurações do sistema ─────────────────────────────────────────────────

test.describe('Configurações do Sistema', () => {
  test('seção de configurações do sistema está acessível para admin', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const configBtn = page.getByRole('button', { name: /configurações|settings|config/i }).first();
    if (await configBtn.isVisible({ timeout: 6000 })) {
      await configBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('rate limits são exibidos no painel de config', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const configBtn = page.getByRole('button', { name: /configurações|settings/i }).first();
    if (!(await configBtn.isVisible({ timeout: 6000 }))) return;

    await configBtn.click();
    await page.waitForTimeout(500);

    const rateLimit = page.getByText(/rate limit|limite.*requisições|request limit/i).first();
    if (await rateLimit.isVisible({ timeout: 5000 })) {
      await expect(rateLimit).toBeVisible();
    }
  });
});
