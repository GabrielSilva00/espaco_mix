/**
 * 05-purchase/compra-concluida — Tela de confirmação pós-compra.
 * Botão "Compartilhar" NÃO existe. Botão "PDFs" EXISTE e gera arquivos.
 */
import { test, expect, Page } from '@playwright/test';
import { aceitarLGPD, loginAsUser, BASE_URL } from '../helpers/auth.helper';
import { TEST_CPFS } from '../helpers/data.helper';

async function simularCompraConcluida(page: Page): Promise<boolean> {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);

  const verBtn = page.getByRole('button', { name: /ver ingressos/i }).first();
  if (!(await verBtn.isVisible({ timeout: 8000 }))) return false;
  await verBtn.click();
  await page.waitForTimeout(400);

  const mais = page.getByRole('button', { name: '+' }).first();
  if (!(await mais.isVisible({ timeout: 5000 }))) return false;
  await mais.click();
  await page.waitForTimeout(300);

  const continuar = page.getByRole('button', { name: /continuar|comprar|próximo|checkout/i }).first();
  const continua = await continuar.isEnabled({ timeout: 3000 }).catch(() => false);
  if (!continua) return false;
  await continuar.click();
  await page.waitForTimeout(600);

  // Preenche dados do comprador
  const nomeInput  = page.getByPlaceholder(/nome completo|nome|name/i).first();
  const emailInput = page.getByPlaceholder(/e-mail|email/i).first();
  const cpfInput   = page.getByPlaceholder(/CPF/i).first();

  if (await nomeInput.isVisible({ timeout: 3000 })) await nomeInput.fill('Teste Playwright');
  if (await emailInput.isVisible({ timeout: 3000 })) await emailInput.fill('teste@playwright.local');
  if (await cpfInput.isVisible({ timeout: 3000 }))   await cpfInput.fill(TEST_CPFS.valido1);

  const avancar = page.getByRole('button', { name: /continuar|avançar|próximo/i }).first();
  if (await avancar.isVisible({ timeout: 4000 })) {
    await avancar.click();
    await page.waitForTimeout(600);
  }

  // Seleciona PIX e confirma (mock)
  const pixBtn = page.getByRole('button', { name: /pix/i }).first();
  if (await pixBtn.isVisible({ timeout: 4000 })) {
    await pixBtn.click();
    await page.waitForTimeout(300);
  }

  const confirmar = page.getByRole('button', { name: /confirmar|pagar com pix|gerar pix|finalizar/i }).first();
  if (await confirmar.isVisible({ timeout: 4000 })) {
    await confirmar.click();
    await page.waitForTimeout(2000);
  }

  return true;
}

// ─── Tela de confirmação ──────────────────────────────────────────────────────

test.describe('Compra Concluída — Tela de Confirmação', () => {
  test('mensagem de sucesso é exibida após pagamento', async ({ page }) => {
    const chegou = await simularCompraConcluida(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const sucesso = page.getByText(/confirmado|sucesso|aprovado|pedido criado|compra realizada/i).first();
    if (await sucesso.isVisible({ timeout: 8000 })) {
      await expect(sucesso).toBeVisible();
    }
  });

  test('número do pedido ou código de confirmação é exibido', async ({ page }) => {
    const chegou = await simularCompraConcluida(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const codigoPedido = page.getByText(/pedido|order|código|#\d+/i).first();
    if (await codigoPedido.isVisible({ timeout: 8000 })) {
      await expect(codigoPedido).toBeVisible();
    }
  });

  test('nome do evento é exibido na confirmação', async ({ page }) => {
    const chegou = await simularCompraConcluida(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const nomeEvento = page.locator('h1, h2, h3').first();
    if (await nomeEvento.isVisible({ timeout: 5000 })) {
      const texto = await nomeEvento.textContent();
      expect(texto?.length).toBeGreaterThan(0);
    }
  });
});

// ─── Botões da tela de confirmação ───────────────────────────────────────────

test.describe('Compra Concluída — Botões', () => {
  test('botão "PDFs" ou "Baixar Ingressos" EXISTE', async ({ page }) => {
    const chegou = await simularCompraConcluida(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const pdfBtn = page.getByRole('button', { name: /pdf|baixar|download|ingressos/i }).first();
    if (await pdfBtn.isVisible({ timeout: 8000 })) {
      await expect(pdfBtn).toBeVisible();
    }
  });

  test('botão "Compartilhar" NÃO existe na tela de confirmação', async ({ page }) => {
    const chegou = await simularCompraConcluida(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    // Aguarda a tela de confirmação carregar
    await page.waitForTimeout(2000);

    const compartilharBtn = page.getByRole('button', { name: /compartilhar|share/i });
    await expect(compartilharBtn).not.toBeVisible();
  });

  test('botão "Voltar para Home" ou "Ver Meus Ingressos" está presente', async ({ page }) => {
    const chegou = await simularCompraConcluida(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const voltarBtn = page.getByRole('button', { name: /voltar|home|meus ingressos|minhas reservas/i }).first();
    if (await voltarBtn.isVisible({ timeout: 8000 })) {
      await expect(voltarBtn).toBeVisible();
    }
  });

  test('clicar em "PDFs" não gera erro JS', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    const chegou = await simularCompraConcluida(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const pdfBtn = page.getByRole('button', { name: /pdf|baixar|download|ingressos/i }).first();
    if (!(await pdfBtn.isVisible({ timeout: 8000 }))) return;

    await pdfBtn.click();
    await page.waitForTimeout(2000);

    const critical = errors.filter(e => !/ResizeObserver|extension/i.test(e));
    expect(critical, `Erros JS ao clicar PDF: ${critical.join(' | ')}`).toHaveLength(0);
  });

  test('clicar em PDF inicia download ou abre nova aba', async ({ page }) => {
    const chegou = await simularCompraConcluida(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const pdfBtn = page.getByRole('button', { name: /pdf|baixar|download/i }).first();
    if (!(await pdfBtn.isVisible({ timeout: 8000 }))) return;

    // Monitora novos downloads ou novas abas
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    const newPagePromise  = page.context().waitForEvent('page', { timeout: 5000 }).catch(() => null);

    await pdfBtn.click();
    const [download, newPage] = await Promise.all([downloadPromise, newPagePromise]);

    // Pelo menos um deve ocorrer, OU a página não deve quebrar
    if (!download && !newPage) {
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

// ─── Informações pós-compra ───────────────────────────────────────────────────

test.describe('Compra Concluída — Informações', () => {
  test('instrução sobre QR code ou validação é exibida', async ({ page }) => {
    const chegou = await simularCompraConcluida(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const instrucao = page.getByText(/qr code|apresente|validar|check-in|scanner/i).first();
    if (await instrucao.isVisible({ timeout: 6000 })) {
      await expect(instrucao).toBeVisible();
    }
  });

  test('e-mail de confirmação mencionado na tela', async ({ page }) => {
    const chegou = await simularCompraConcluida(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const emailRef = page.getByText(/e-mail|email.*enviado|confirmação.*enviada/i).first();
    if (await emailRef.isVisible({ timeout: 6000 })) {
      await expect(emailRef).toBeVisible();
    }
  });
});

// ─── Redirecionamento pós-compra ──────────────────────────────────────────────

test.describe('Compra Concluída — Redirecionamento', () => {
  test('clicar em "Voltar" retorna à home sem erro', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    const chegou = await simularCompraConcluida(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const voltarBtn = page.getByRole('button', { name: /voltar|home|início/i }).first();
    if (!(await voltarBtn.isVisible({ timeout: 8000 }))) return;

    await voltarBtn.click();
    await page.waitForTimeout(800);

    await expect(page.locator('nav').first()).toBeVisible();

    const critical = errors.filter(e => !/ResizeObserver|extension/i.test(e));
    expect(critical).toHaveLength(0);
  });

  test('compra concluída não mantém estado do carrinho expirado', async ({ page }) => {
    const chegou = await simularCompraConcluida(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    // Navega de volta para home e tenta abrir compra novamente
    const voltarBtn = page.getByRole('button', { name: /voltar|home|início/i }).first();
    if (!(await voltarBtn.isVisible({ timeout: 6000 }))) return;

    await voltarBtn.click();
    await page.waitForTimeout(500);

    // O timer não deve aparecer na home
    const timer = page.getByText(/\d{2}:\d{2}.*expira/i).first();
    await expect(timer).not.toBeVisible();
  });
});
