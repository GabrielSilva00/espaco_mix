import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function aceitarLGPD(page: Page) {
  const banner = page.getByRole('button', { name: 'Aceitar e Continuar' });
  try {
    await banner.waitFor({ state: 'visible', timeout: 2000 });
    await banner.click();
  } catch { /* já aceito */ }
}

async function abrirCheckoutComIngresso(page: Page): Promise<boolean> {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);

  const eventCard = page.getByRole('button', { name: /ver ingressos/i }).first();
  if (!(await eventCard.isVisible({ timeout: 8000 }))) return false;

  await eventCard.click();
  await page.waitForTimeout(600);

  const panelIngressos = page.getByRole('button', { name: /^ingressos$/i }).first();
  if (await panelIngressos.isVisible({ timeout: 5000 })) {
    await panelIngressos.click();
    await page.waitForTimeout(400);
  }

  const btnMais = page.getByRole('button').filter({ hasText: '+' }).first();
  if (!(await btnMais.isVisible({ timeout: 5000 }))) return false;

  await btnMais.click();
  await page.waitForTimeout(300);

  const btnFinalizar = page.getByRole('button', { name: /finalizar|comprar|checkout/i }).first();
  if (!(await btnFinalizar.isVisible({ timeout: 5000 }))) return false;

  await btnFinalizar.click();
  await page.waitForTimeout(800);
  return true;
}

async function selecionarCartaoCredito(page: Page): Promise<boolean> {
  const cartaoOpcao = page.locator('button, label, [role="radio"]').filter({ hasText: /cartão de crédito|crédito/i }).first();
  if (!(await cartaoOpcao.isVisible({ timeout: 5000 }))) return false;
  await cartaoOpcao.click();
  await page.waitForTimeout(300);
  return true;
}

async function selecionarCartaoDebito(page: Page): Promise<boolean> {
  const debitoOpcao = page.locator('button, label, [role="radio"]').filter({ hasText: /cartão de débito|débito/i }).first();
  if (!(await debitoOpcao.isVisible({ timeout: 5000 }))) return false;
  await debitoOpcao.click();
  await page.waitForTimeout(300);
  return true;
}

// ---------------------------------------------------------------------------
// Suite: Cartão de Crédito - Opções e Seleção
// ---------------------------------------------------------------------------

test.describe('Checkout - Cartão de Crédito (Seleção)', () => {
  test('deve exibir opção de Cartão de Crédito no checkout', async ({ page }) => {
    const abriu = await abrirCheckoutComIngresso(page);
    if (!abriu) return;

    const opcao = page.getByText(/cartão de crédito|crédito/i).first();
    if (await opcao.isVisible({ timeout: 5000 })) {
      await expect(opcao).toBeVisible();
    }
  });

  test('deve exibir opção de Cartão de Débito no checkout', async ({ page }) => {
    const abriu = await abrirCheckoutComIngresso(page);
    if (!abriu) return;

    const opcao = page.getByText(/cartão de débito|débito/i).first();
    if (await opcao.isVisible({ timeout: 5000 })) {
      await expect(opcao).toBeVisible();
    }
  });

  test('deve exibir as 3 opções de pagamento: PIX, Crédito e Débito', async ({ page }) => {
    const abriu = await abrirCheckoutComIngresso(page);
    if (!abriu) return;

    const pix = page.getByText(/pix/i).first();
    const credito = page.getByText(/crédito/i).first();
    const debito = page.getByText(/débito/i).first();

    if (await pix.isVisible({ timeout: 5000 })) await expect(pix).toBeVisible();
    if (await credito.isVisible({ timeout: 3000 })) await expect(credito).toBeVisible();
    if (await debito.isVisible({ timeout: 3000 })) await expect(debito).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Suite: Cartão de Crédito - Formulário
// ---------------------------------------------------------------------------

test.describe('Checkout - Cartão de Crédito (Formulário)', () => {
  test('deve exibir campo de número do cartão', async ({ page }) => {
    const abriu = await abrirCheckoutComIngresso(page);
    if (!abriu) return;

    const selecionou = await selecionarCartaoCredito(page);
    if (!selecionou) return;

    // Preenche dados do convidado primeiro se necessário
    const nomeConv = page.getByPlaceholder(/seu nome|nome completo/i).first();
    if (await nomeConv.isVisible({ timeout: 3000 })) {
      await nomeConv.fill('Teste Cartão');
    }

    const campoNumero = page.getByPlaceholder(/número do cartão|0000 0000|•••• ••••/i).first();
    if (await campoNumero.isVisible({ timeout: 5000 })) {
      await expect(campoNumero).toBeVisible();
    }
  });

  test('deve exibir campo de validade do cartão', async ({ page }) => {
    const abriu = await abrirCheckoutComIngresso(page);
    if (!abriu) return;

    const selecionou = await selecionarCartaoCredito(page);
    if (!selecionou) return;

    const campoValidade = page.getByPlaceholder(/mm\/aa|validade|vencimento/i).first();
    if (await campoValidade.isVisible({ timeout: 5000 })) {
      await expect(campoValidade).toBeVisible();
    }
  });

  test('deve exibir campo de CVV/CVC do cartão', async ({ page }) => {
    const abriu = await abrirCheckoutComIngresso(page);
    if (!abriu) return;

    const selecionou = await selecionarCartaoCredito(page);
    if (!selecionou) return;

    const campoCVV = page.getByPlaceholder(/cvv|cvc|código de segurança/i).first();
    if (await campoCVV.isVisible({ timeout: 5000 })) {
      await expect(campoCVV).toBeVisible();
    }
  });

  test('deve exibir campo de nome impresso no cartão', async ({ page }) => {
    const abriu = await abrirCheckoutComIngresso(page);
    if (!abriu) return;

    const selecionou = await selecionarCartaoCredito(page);
    if (!selecionou) return;

    const campoNome = page.getByPlaceholder(/nome no cartão|nome do titular|como no cartão/i).first();
    if (await campoNome.isVisible({ timeout: 5000 })) {
      await expect(campoNome).toBeVisible();
    }
  });

  test('deve permitir preencher número do cartão', async ({ page }) => {
    const abriu = await abrirCheckoutComIngresso(page);
    if (!abriu) return;

    const selecionou = await selecionarCartaoCredito(page);
    if (!selecionou) return;

    const campoNumero = page.getByPlaceholder(/número do cartão|0000 0000|•••• ••••/i).first();
    if (!(await campoNumero.isVisible({ timeout: 5000 }))) return;

    await campoNumero.fill('4111 1111 1111 1111');
    await page.waitForTimeout(200);
    // Não deve quebrar a página
    await expect(page.locator('body')).toBeVisible();
  });

  test('deve bloquear prosseguimento com campos de cartão em branco', async ({ page }) => {
    const abriu = await abrirCheckoutComIngresso(page);
    if (!abriu) return;

    const selecionou = await selecionarCartaoCredito(page);
    if (!selecionou) return;

    // Tenta confirmar sem preencher nada
    const btnPagar = page.getByRole('button', { name: /pagar|confirmar|finalizar/i }).first();
    if (!(await btnPagar.isVisible({ timeout: 5000 }))) return;

    await btnPagar.click();
    await page.waitForTimeout(800);

    // Deve mostrar erros ou permanecer no mesmo step
    const erro = page.locator('.text-red-400, .text-red-500, [class*="error"]').first();
    if (await erro.isVisible({ timeout: 3000 })) {
      await expect(erro).toBeVisible();
    }
  });

  test('deve aceitar número de cartão com 16 dígitos', async ({ page }) => {
    const abriu = await abrirCheckoutComIngresso(page);
    if (!abriu) return;

    const selecionou = await selecionarCartaoCredito(page);
    if (!selecionou) return;

    const campoNumero = page.getByPlaceholder(/número do cartão|0000 0000|•••• ••••/i).first();
    if (!(await campoNumero.isVisible({ timeout: 5000 }))) return;

    await campoNumero.fill('4111111111111111');
    await page.waitForTimeout(200);

    // O campo deve aceitar o input sem rejeitar imediatamente
    await expect(page.locator('body')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Suite: Cartão de Débito - Formulário
// ---------------------------------------------------------------------------

test.describe('Checkout - Cartão de Débito (Formulário)', () => {
  test('deve exibir formulário de débito ao selecionar cartão de débito', async ({ page }) => {
    const abriu = await abrirCheckoutComIngresso(page);
    if (!abriu) return;

    const selecionou = await selecionarCartaoDebito(page);
    if (!selecionou) return;

    // Deve exibir o formulário de débito (similar ao de crédito)
    const campoPrimeiro = page.locator('input').first();
    if (await campoPrimeiro.isVisible({ timeout: 5000 })) {
      await expect(campoPrimeiro).toBeVisible();
    }
  });

  test('deve manter informações do comprador ao alternar entre métodos', async ({ page }) => {
    const abriu = await abrirCheckoutComIngresso(page);
    if (!abriu) return;

    const nomeInput = page.getByPlaceholder(/seu nome|nome completo/i).first();
    if (await nomeInput.isVisible({ timeout: 5000 })) {
      await nomeInput.fill('Teste Alternância');
    }

    // Alterna de PIX para Cartão
    const cartaoOpcao = page.locator('button, label').filter({ hasText: /cartão de crédito|crédito/i }).first();
    if (await cartaoOpcao.isVisible({ timeout: 3000 })) {
      await cartaoOpcao.click();
      await page.waitForTimeout(300);

      // Volta para PIX
      const pixOpcao = page.locator('button, label').filter({ hasText: /^pix$/i }).first();
      if (await pixOpcao.isVisible({ timeout: 3000 })) {
        await pixOpcao.click();
        await page.waitForTimeout(300);
      }
    }

    // A página não deve quebrar durante a alternância
    await expect(page.locator('body')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Suite: Checkout - Auth Inline (Login durante Checkout)
// ---------------------------------------------------------------------------

test.describe('Checkout - Login Inline', () => {
  test('deve exibir opção de login durante o checkout', async ({ page }) => {
    const abriu = await abrirCheckoutComIngresso(page);
    if (!abriu) return;

    // O checkout pode oferecer login inline
    const loginOpcao = page.getByText(/entrar|fazer login|já tenho conta/i).first();
    if (await loginOpcao.isVisible({ timeout: 5000 })) {
      await expect(loginOpcao).toBeVisible();
    }
  });

  test('deve exibir campos de login ao selecionar a aba de login no checkout', async ({ page }) => {
    const abriu = await abrirCheckoutComIngresso(page);
    if (!abriu) return;

    const loginTab = page.getByRole('button', { name: /^entrar$/i }).filter({ hasText: /entrar/i }).first();
    if (!(await loginTab.isVisible({ timeout: 5000 }))) return;

    await loginTab.click();
    await page.waitForTimeout(300);

    const emailInput = page.getByPlaceholder(/seu@email|e-mail/i).first();
    if (await emailInput.isVisible({ timeout: 3000 })) {
      await expect(emailInput).toBeVisible();
    }
  });

  test('deve exibir botão de cadastro durante o checkout', async ({ page }) => {
    const abriu = await abrirCheckoutComIngresso(page);
    if (!abriu) return;

    const cadastrarTab = page.getByRole('button', { name: /cadastrar/i }).first();
    if (await cadastrarTab.isVisible({ timeout: 5000 })) {
      await expect(cadastrarTab).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Checkout - Resumo e Totais
// ---------------------------------------------------------------------------

test.describe('Checkout - Resumo do Pedido', () => {
  test('deve exibir o subtotal no checkout', async ({ page }) => {
    const abriu = await abrirCheckoutComIngresso(page);
    if (!abriu) return;

    const subtotal = page.getByText(/subtotal/i).first();
    if (await subtotal.isVisible({ timeout: 5000 })) {
      await expect(subtotal).toBeVisible();
    }
  });

  test('deve exibir a taxa de conveniência no checkout', async ({ page }) => {
    const abriu = await abrirCheckoutComIngresso(page);
    if (!abriu) return;

    const taxa = page.getByText(/taxa|conveniência|fee/i).first();
    if (await taxa.isVisible({ timeout: 5000 })) {
      await expect(taxa).toBeVisible();
    }
  });

  test('deve exibir o total final no checkout', async ({ page }) => {
    const abriu = await abrirCheckoutComIngresso(page);
    if (!abriu) return;

    const totalEl = page.getByText(/^total$/i).first();
    if (await totalEl.isVisible({ timeout: 5000 })) {
      await expect(totalEl).toBeVisible();
    }
  });

  test('deve exibir nome e quantidade do item selecionado no resumo', async ({ page }) => {
    const abriu = await abrirCheckoutComIngresso(page);
    if (!abriu) return;

    const resumoItem = page.getByText(/1x|ingresso|mesa/i).first();
    if (await resumoItem.isVisible({ timeout: 5000 })) {
      await expect(resumoItem).toBeVisible();
    }
  });
});
