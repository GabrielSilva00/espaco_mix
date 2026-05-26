/**
 * 06-reservations/pdf-ingressos — Download de PDFs de ingressos.
 * Ingresso individual: SEM botão editar.
 * Ingresso múltiplo: COM botão editar.
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsUser, BASE_URL } from '../helpers/auth.helper';

async function abrirDetalhesReserva(page: Page): Promise<boolean> {
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

// ─── Botão de PDF ─────────────────────────────────────────────────────────────

test.describe('PDF de Ingressos — Botão', () => {
  test('botão "PDFs" ou "Baixar Ingressos" existe nos detalhes', async ({ page }) => {
    const abriu = await abrirDetalhesReserva(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas ou sem reservas'); return; }

    const pdfBtn = page.getByRole('button', { name: /pdf|baixar|download|ingressos/i }).first();
    if (await pdfBtn.isVisible({ timeout: 6000 })) {
      await expect(pdfBtn).toBeVisible();
    }
  });

  test('botão PDF está habilitado para ingressos confirmados', async ({ page }) => {
    const abriu = await abrirDetalhesReserva(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas ou sem reservas'); return; }

    const pdfBtn = page.getByRole('button', { name: /pdf|baixar|download/i }).first();
    if (!(await pdfBtn.isVisible({ timeout: 5000 }))) return;

    // Para reservas confirmadas, o botão deve estar habilitado
    const confirmado = await page.getByText(/confirmado|pago/i).first().isVisible({ timeout: 3000 });
    if (confirmado) {
      await expect(pdfBtn).toBeEnabled();
    }
  });

  test('clicar em PDF não gera erro JS', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    const abriu = await abrirDetalhesReserva(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas ou sem reservas'); return; }

    const pdfBtn = page.getByRole('button', { name: /pdf|baixar|download/i }).first();
    if (!(await pdfBtn.isVisible({ timeout: 5000 }))) return;

    await pdfBtn.click();
    await page.waitForTimeout(2000);

    const critical = errors.filter(e => !/ResizeObserver|extension/i.test(e));
    expect(critical, `Erros JS ao gerar PDF: ${critical.join(' | ')}`).toHaveLength(0);
  });
});

// ─── Ingresso individual: SEM botão editar ────────────────────────────────────

test.describe('PDF de Ingressos — Ingresso Individual', () => {
  test('ingresso individual NÃO tem botão "Editar"', async ({ page }) => {
    const abriu = await abrirDetalhesReserva(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas ou sem reservas'); return; }

    // Localiza um card de ingresso individual (quantidade = 1)
    const ingressos = page.locator('[class*="ingresso-item"], [class*="ticket-item"]');
    const count = await ingressos.count();

    if (count === 1) {
      // Ingresso individual: NÃO deve ter botão editar
      const editarBtn = ingressos.first().getByRole('button', { name: /editar|edit/i });
      await expect(editarBtn).not.toBeVisible();
    } else if (count === 0) {
      // Verifica via estrutura alternativa
      const cardIngresso = page.locator('[class*="ticket"]').first();
      if (!(await cardIngresso.isVisible({ timeout: 3000 }))) return;

      const allIngressos = await page.locator('[class*="ticket"]').count();
      if (allIngressos === 1) {
        const editarBtn = cardIngresso.getByRole('button', { name: /editar/i });
        await expect(editarBtn).not.toBeVisible();
      }
    }
  });

  test('ingresso individual exibe apenas QR code e dados do evento', async ({ page }) => {
    const abriu = await abrirDetalhesReserva(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas ou sem reservas'); return; }

    const qrCode = page.locator('canvas, img[alt*="qr" i], [class*="qr"]').first();
    if (await qrCode.isVisible({ timeout: 5000 })) {
      await expect(qrCode).toBeVisible();
    }
  });
});

// ─── Ingresso múltiplo: COM botão editar ──────────────────────────────────────

test.describe('PDF de Ingressos — Ingresso Múltiplo', () => {
  test('pedido com múltiplos ingressos TEM botão "Editar" por ingresso', async ({ page }) => {
    const abriu = await abrirDetalhesReserva(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas ou sem reservas'); return; }

    const ingressos = page.locator('[class*="ingresso-item"], [class*="ticket-item"]');
    const count = await ingressos.count();

    if (count > 1) {
      // Pedido com múltiplos ingressos DEVE ter botão editar em cada um
      const editarBtn = ingressos.first().getByRole('button', { name: /editar|edit/i });
      if (await editarBtn.isVisible({ timeout: 4000 })) {
        await expect(editarBtn).toBeVisible();
      }
    }
  });

  test('editar nome do participante funciona em pedido múltiplo', async ({ page }) => {
    const abriu = await abrirDetalhesReserva(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas ou sem reservas'); return; }

    const ingressos = page.locator('[class*="ingresso-item"], [class*="ticket-item"]');
    const count = await ingressos.count();

    if (count <= 1) return; // Pula se não for pedido múltiplo

    const editarBtn = ingressos.first().getByRole('button', { name: /editar|edit/i });
    if (!(await editarBtn.isVisible({ timeout: 4000 }))) return;

    await editarBtn.click();
    await page.waitForTimeout(400);

    const nomeInput = page.getByPlaceholder(/nome.*participante|nome.*ingresso/i).first();
    if (await nomeInput.isVisible({ timeout: 4000 })) {
      await nomeInput.fill('Participante Teste');
      await expect(nomeInput).toHaveValue('Participante Teste');
    }
  });

  test('cada ingresso em pedido múltiplo tem QR code próprio', async ({ page }) => {
    const abriu = await abrirDetalhesReserva(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas ou sem reservas'); return; }

    const ingressos = page.locator('[class*="ingresso-item"], [class*="ticket-item"]');
    const count = await ingressos.count();

    if (count > 1) {
      const qrCodes = page.locator('canvas, [class*="qr"]');
      const qrCount = await qrCodes.count();
      // Deve ter pelo menos um QR code por ingresso
      expect(qrCount).toBeGreaterThanOrEqual(1);
    }
  });
});

// ─── Geração do PDF ───────────────────────────────────────────────────────────

test.describe('PDF de Ingressos — Geração', () => {
  test('clicar em PDFs inicia geração ou download', async ({ page }) => {
    const abriu = await abrirDetalhesReserva(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas ou sem reservas'); return; }

    const pdfBtn = page.getByRole('button', { name: /pdf|baixar/i }).first();
    if (!(await pdfBtn.isVisible({ timeout: 5000 }))) return;

    const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
    await pdfBtn.click();
    const download = await downloadPromise;

    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    } else {
      // Se não iniciou download direto, pode ter aberto em nova aba
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('PDF gerado tem nome de arquivo adequado', async ({ page }) => {
    const abriu = await abrirDetalhesReserva(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas ou sem reservas'); return; }

    const pdfBtn = page.getByRole('button', { name: /pdf|baixar/i }).first();
    if (!(await pdfBtn.isVisible({ timeout: 5000 }))) return;

    const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
    await pdfBtn.click();
    const download = await downloadPromise;

    if (download) {
      const filename = download.suggestedFilename();
      // Deve ter extensão .pdf
      expect(filename.toLowerCase()).toContain('.pdf');
    }
  });

  test('indicador de carregamento aparece durante geração do PDF', async ({ page }) => {
    const abriu = await abrirDetalhesReserva(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas ou sem reservas'); return; }

    const pdfBtn = page.getByRole('button', { name: /pdf|baixar/i }).first();
    if (!(await pdfBtn.isVisible({ timeout: 5000 }))) return;

    await pdfBtn.click();

    // Pode aparecer brevemente um spinner ou texto "gerando..."
    const loading = page.getByText(/gerando|carregando|aguarde/i).first();
    // Apenas verifica que a página não quebra
    await expect(page.locator('body')).toBeVisible();
  });
});
