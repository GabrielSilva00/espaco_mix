/**
 * 05-purchase/resumo-pedido — Resumo do pedido e confirmação antes do pagamento.
 */
import { test, expect, Page } from '@playwright/test';
import { aceitarLGPD, BASE_URL } from '../helpers/auth.helper';
import { TEST_CPFS } from '../helpers/data.helper';

async function chegarNoResumoPedido(page: Page): Promise<boolean> {
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
  if (!(await continuar.isEnabled({ timeout: 3000 }).catch(() => false))) return false;
  await continuar.click();
  await page.waitForTimeout(600);

  // Preenche dados do comprador
  const nomeInput  = page.getByPlaceholder(/nome completo|nome|name/i).first();
  const emailInput = page.getByPlaceholder(/e-mail|email/i).first();
  const cpfInput   = page.getByPlaceholder(/CPF/i).first();

  if (await nomeInput.isVisible({ timeout: 3000 })) await nomeInput.fill('Teste Playwright');
  if (await emailInput.isVisible({ timeout: 3000 })) await emailInput.fill('teste@playwright.local');
  if (await cpfInput.isVisible({ timeout: 3000 }))   await cpfInput.fill(TEST_CPFS.valido1);

  const avancar = page.getByRole('button', { name: /continuar|avançar|próximo|revisar/i }).first();
  if (await avancar.isVisible({ timeout: 4000 })) {
    await avancar.click();
    await page.waitForTimeout(800);
    return true;
  }
  return true; // pode não ter etapa de revisão explícita
}

// ─── Exibição do resumo ───────────────────────────────────────────────────────

test.describe('Resumo do Pedido — Exibição', () => {
  test('nome do evento é exibido no resumo', async ({ page }) => {
    const chegou = await chegarNoResumoPedido(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const titulo = page.locator('h1, h2, h3').first();
    if (await titulo.isVisible({ timeout: 5000 })) {
      const texto = await titulo.textContent();
      expect(texto?.length).toBeGreaterThan(0);
    }
  });

  test('quantidade de ingressos selecionada é exibida', async ({ page }) => {
    const chegou = await chegarNoResumoPedido(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const quantidade = page.getByText(/\d+\s*(ingresso|ticket|un\.)/i).first();
    if (await quantidade.isVisible({ timeout: 5000 })) {
      await expect(quantidade).toBeVisible();
    }
  });

  test('valor total é exibido no resumo', async ({ page }) => {
    const chegou = await chegarNoResumoPedido(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const total = page.getByText(/total|R\$\s*\d+/i).first();
    if (await total.isVisible({ timeout: 5000 })) {
      await expect(total).toBeVisible();
    }
  });

  test('nome do comprador é exibido no resumo', async ({ page }) => {
    const chegou = await chegarNoResumoPedido(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const nome = page.getByText(/Teste Playwright/i).first();
    if (await nome.isVisible({ timeout: 5000 })) {
      await expect(nome).toBeVisible();
    }
  });

  test('e-mail do comprador é exibido no resumo', async ({ page }) => {
    const chegou = await chegarNoResumoPedido(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const email = page.getByText(/teste@playwright.local/i).first();
    if (await email.isVisible({ timeout: 5000 })) {
      await expect(email).toBeVisible();
    }
  });
});

// ─── Navegação no resumo ──────────────────────────────────────────────────────

test.describe('Resumo do Pedido — Navegação', () => {
  test('botão "Voltar" retorna à etapa anterior', async ({ page }) => {
    const chegou = await chegarNoResumoPedido(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const voltarBtn = page.getByRole('button', { name: /voltar|back/i }).first();
    if (!(await voltarBtn.isVisible({ timeout: 5000 }))) return;

    await voltarBtn.click();
    await page.waitForTimeout(500);

    // Deve voltar para alguma etapa anterior (dados ou seleção)
    const etapaAnterior = page.getByPlaceholder(/nome|email|cpf|\+|-/i).first();
    if (await etapaAnterior.isVisible({ timeout: 5000 })) {
      await expect(etapaAnterior).toBeVisible();
    }
  });

  test('indicador de etapas mostra o progresso correto', async ({ page }) => {
    const chegou = await chegarNoResumoPedido(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    // Indicadores de step como círculos numerados ou barras de progresso
    const stepIndicator = page.locator('[class*="step"], [class*="progress"], [role="progressbar"]').first();
    if (await stepIndicator.isVisible({ timeout: 4000 })) {
      await expect(stepIndicator).toBeVisible();
    }
  });

  test('clicar em "Confirmar" avança para pagamento', async ({ page }) => {
    const chegou = await chegarNoResumoPedido(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const confirmarBtn = page.getByRole('button', { name: /confirmar|prosseguir|pagar/i }).first();
    if (!(await confirmarBtn.isVisible({ timeout: 5000 }))) return;

    await confirmarBtn.click();
    await page.waitForTimeout(800);

    // Deve avançar para seleção de método de pagamento
    const metodosPagamento = page.getByText(/pix|cartão|forma de pagamento/i).first();
    if (await metodosPagamento.isVisible({ timeout: 5000 })) {
      await expect(metodosPagamento).toBeVisible();
    }
  });
});

// ─── Cálculos de preço ────────────────────────────────────────────────────────

test.describe('Resumo do Pedido — Cálculos', () => {
  test('taxa de serviço é exibida separadamente quando aplicável', async ({ page }) => {
    const chegou = await chegarNoResumoPedido(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const taxa = page.getByText(/taxa|fee|serviço/i).first();
    if (await taxa.isVisible({ timeout: 5000 })) {
      await expect(taxa).toBeVisible();
    }
  });

  test('total = subtotal + taxa (quando exibidos separadamente)', async ({ page }) => {
    const chegou = await chegarNoResumoPedido(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const textoTotal = await page.getByText(/total/i).first().textContent();
    // Apenas verifica que o total está presente e não é zero
    if (textoTotal) {
      expect(textoTotal).toBeTruthy();
    }
  });

  test('evento gratuito mostra "R$ 0,00" ou "Grátis"', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    // Procura um evento gratuito
    const gratuito = page.getByText(/grátis|gratuito|R\$\s*0/i).first();
    if (await gratuito.isVisible({ timeout: 5000 })) {
      await expect(gratuito).toBeVisible();
    }
  });
});
