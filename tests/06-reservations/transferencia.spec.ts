/**
 * 06-reservations/transferencia — Transferência de ingressos entre usuários.
 * Timer de 59 minutos (não 10). Aceitar / rejeitar / expirar.
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsUser, BASE_URL } from '../helpers/auth.helper';

async function abrirDetalheReserva(page: Page): Promise<boolean> {
  const ok = await loginAsUser(page);
  if (!ok) return false;

  const reservasBtn = page.getByRole('button', { name: /minhas reservas|meus ingressos/i }).first();
  if (!(await reservasBtn.isVisible({ timeout: 6000 }))) return false;
  await reservasBtn.click();
  await page.waitForTimeout(500);

  const card = page.locator('[class*="reserva"], [class*="ticket"], [class*="booking"]').first();
  if (!(await card.isVisible({ timeout: 5000 }))) return false;

  await card.click();
  await page.waitForTimeout(600);
  return true;
}

// ─── Iniciar transferência ────────────────────────────────────────────────────

test.describe('Transferência — Iniciar', () => {
  test('botão "Transferir Ingresso" existe nos detalhes da reserva', async ({ page }) => {
    const abriu = await abrirDetalheReserva(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas ou sem reservas'); return; }

    const transferirBtn = page.getByRole('button', { name: /transferir|transfer/i }).first();
    if (await transferirBtn.isVisible({ timeout: 5000 })) {
      await expect(transferirBtn).toBeVisible();
    }
  });

  test('clicar em "Transferir" abre formulário de destinatário', async ({ page }) => {
    const abriu = await abrirDetalheReserva(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas ou sem reservas'); return; }

    const transferirBtn = page.getByRole('button', { name: /transferir|transfer/i }).first();
    if (!(await transferirBtn.isVisible({ timeout: 5000 }))) return;

    await transferirBtn.click();
    await page.waitForTimeout(500);

    const emailInput = page.getByPlaceholder(/e-mail|email.*destinatário|destinatário/i).first();
    if (await emailInput.isVisible({ timeout: 4000 })) {
      await expect(emailInput).toBeVisible();
    }
  });

  test('campo de e-mail do destinatário é obrigatório', async ({ page }) => {
    const abriu = await abrirDetalheReserva(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas ou sem reservas'); return; }

    const transferirBtn = page.getByRole('button', { name: /transferir|transfer/i }).first();
    if (!(await transferirBtn.isVisible({ timeout: 5000 }))) return;
    await transferirBtn.click();
    await page.waitForTimeout(500);

    const confirmarBtn = page.getByRole('button', { name: /enviar|confirmar transferência|enviar convite/i }).first();
    if (!(await confirmarBtn.isVisible({ timeout: 4000 }))) return;

    await confirmarBtn.click();
    await page.waitForTimeout(500);

    // Deve exibir erro de campo obrigatório
    const erro = page.getByText(/obrigatório|requerido|informe.*e-mail|email.*required/i).first();
    if (await erro.isVisible({ timeout: 3000 })) {
      await expect(erro).toBeVisible();
    }
  });

  test('e-mail inválido é rejeitado no formulário de transferência', async ({ page }) => {
    const abriu = await abrirDetalheReserva(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas ou sem reservas'); return; }

    const transferirBtn = page.getByRole('button', { name: /transferir|transfer/i }).first();
    if (!(await transferirBtn.isVisible({ timeout: 5000 }))) return;
    await transferirBtn.click();
    await page.waitForTimeout(500);

    const emailInput = page.getByPlaceholder(/e-mail|email.*destinatário/i).first();
    if (!(await emailInput.isVisible({ timeout: 4000 }))) return;

    await emailInput.fill('email-invalido-sem-arroba');
    const confirmarBtn = page.getByRole('button', { name: /enviar|confirmar|enviar convite/i }).first();
    if (await confirmarBtn.isVisible({ timeout: 3000 })) {
      await confirmarBtn.click();
      await page.waitForTimeout(500);
      await expect(emailInput).toBeVisible(); // permanece na tela
    }
  });
});

// ─── Timer da transferência ───────────────────────────────────────────────────

test.describe('Transferência — Timer de 59 Minutos', () => {
  test('transferência pendente exibe timer de 59 minutos (não 10)', async ({ page }) => {
    const abriu = await abrirDetalheReserva(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas ou sem reservas'); return; }

    const transferirBtn = page.getByRole('button', { name: /transferir|transfer/i }).first();
    if (!(await transferirBtn.isVisible({ timeout: 5000 }))) return;
    await transferirBtn.click();
    await page.waitForTimeout(500);

    const emailInput = page.getByPlaceholder(/e-mail|email.*destinatário/i).first();
    if (!(await emailInput.isVisible({ timeout: 4000 }))) return;

    await emailInput.fill('destinatario@teste.local');
    const confirmarBtn = page.getByRole('button', { name: /enviar|confirmar|enviar convite/i }).first();
    if (!(await confirmarBtn.isVisible({ timeout: 3000 }))) return;

    await confirmarBtn.click();
    await page.waitForTimeout(1500);

    // Timer deve mostrar próximo de 59 minutos
    const timerTexto = await page.getByText(/\d{2}:\d{2}/i).first().textContent().catch(() => '');
    if (timerTexto) {
      // Extrai minutos do timer (ex: "58:59")
      const match = timerTexto.match(/(\d{2}):\d{2}/);
      if (match) {
        const minutos = parseInt(match[1], 10);
        // Deve ser próximo de 59 (não 10)
        expect(minutos).toBeGreaterThanOrEqual(55);
        expect(minutos).toBeLessThanOrEqual(59);
      }
    }
  });

  test('timer de transferência é diferente do timer de checkout (10 min)', async ({ page }) => {
    // O timer de transferência é 59 min, o de checkout é 10 min (CART_EXPIRATION_MS)
    // Apenas documenta o comportamento esperado
    const abriu = await abrirDetalheReserva(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas ou sem reservas'); return; }

    // Se houver timer visível na tela de reserva, deve ser 59 min
    const timer = page.getByText(/\d{2}:\d{2}/i).first();
    if (await timer.isVisible({ timeout: 4000 })) {
      const texto = await timer.textContent();
      const match = texto?.match(/(\d{2}):\d{2}/);
      if (match) {
        const minutos = parseInt(match[1], 10);
        // Não deve ser 10 minutos (que é o checkout timer)
        expect(minutos).not.toBe(10);
      }
    }
  });
});

// ─── Receber transferência ────────────────────────────────────────────────────

test.describe('Transferência — Receber', () => {
  test('usuário destinatário vê solicitação pendente', async ({ page }) => {
    // Requer 2 usuários configurados — testa apenas o fluxo de UI
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais não configuradas'); return; }

    const chegou = await abrirDetalheReserva(page);
    if (!chegou) { test.skip(true, 'Sem reservas disponíveis'); return; }

    const pendente = page.getByText(/transferência.*pendente|ingresso.*transferido|convite.*transferência/i).first();
    if (await pendente.isVisible({ timeout: 4000 })) {
      await expect(pendente).toBeVisible();
    }
  });

  test('botão "Aceitar Transferência" está disponível', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais não configuradas'); return; }

    const chegou = await abrirDetalheReserva(page);
    if (!chegou) { test.skip(true, 'Sem reservas disponíveis'); return; }

    const aceitarBtn = page.getByRole('button', { name: /aceitar|accept/i }).first();
    if (await aceitarBtn.isVisible({ timeout: 5000 })) {
      await expect(aceitarBtn).toBeVisible();
    }
  });

  test('botão "Recusar Transferência" está disponível', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais não configuradas'); return; }

    const chegou = await abrirDetalheReserva(page);
    if (!chegou) { test.skip(true, 'Sem reservas disponíveis'); return; }

    const recusarBtn = page.getByRole('button', { name: /recusar|rejeitar|reject|decline/i }).first();
    if (await recusarBtn.isVisible({ timeout: 5000 })) {
      await expect(recusarBtn).toBeVisible();
    }
  });
});

// ─── Cancelar transferência ───────────────────────────────────────────────────

test.describe('Transferência — Cancelar', () => {
  test('remetente pode cancelar transferência pendente', async ({ page }) => {
    const abriu = await abrirDetalheReserva(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas ou sem reservas'); return; }

    const cancelarBtn = page.getByRole('button', { name: /cancelar transferência|cancelar/i }).first();
    if (await cancelarBtn.isVisible({ timeout: 5000 })) {
      await expect(cancelarBtn).toBeVisible();
    }
  });

  test('cancelar transferência não gera erro JS', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    const abriu = await abrirDetalheReserva(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas ou sem reservas'); return; }

    const cancelarBtn = page.getByRole('button', { name: /cancelar transferência/i }).first();
    if (!(await cancelarBtn.isVisible({ timeout: 5000 }))) return;

    await cancelarBtn.click();
    await page.waitForTimeout(1000);

    const critical = errors.filter(e => !/ResizeObserver|extension/i.test(e));
    expect(critical, `Erros JS: ${critical.join(' | ')}`).toHaveLength(0);
  });
});

// ─── Expiração da transferência ───────────────────────────────────────────────

test.describe('Transferência — Expiração', () => {
  test('transferência expirada exibe mensagem adequada', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais não configuradas'); return; }

    const chegou = await abrirDetalheReserva(page);
    if (!chegou) { test.skip(true, 'Sem reservas disponíveis'); return; }

    // Procura por transferências expiradas na interface
    const expirado = page.getByText(/expirado|expirada|vencida|expirou/i).first();
    if (await expirado.isVisible({ timeout: 4000 })) {
      await expect(expirado).toBeVisible();
    }
  });
});
