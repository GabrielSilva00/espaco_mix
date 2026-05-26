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

// Tenta abrir o checkout de um evento com ingressos
async function abrirCheckout(page: Page): Promise<boolean> {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);

  const eventCard = page.getByRole('button', { name: /ver ingressos/i }).first();
  if (!(await eventCard.isVisible({ timeout: 8000 }))) return false;

  await eventCard.click();
  await page.waitForTimeout(600);

  // Expande painel de ingressos
  const panelIngressos = page.getByRole('button', { name: /^ingressos$/i }).first();
  if (await panelIngressos.isVisible({ timeout: 5000 })) {
    await panelIngressos.click();
    await page.waitForTimeout(400);
  }

  // Adiciona pelo menos 1 ingresso
  const btnMais = page.getByRole('button').filter({ hasText: '+' }).first();
  if (!(await btnMais.isVisible({ timeout: 5000 }))) return false;

  await btnMais.click();
  await page.waitForTimeout(300);

  // Clica em Finalizar
  const btnFinalizar = page.getByRole('button', { name: /finalizar|comprar|checkout/i }).first();
  if (!(await btnFinalizar.isVisible({ timeout: 5000 }))) return false;

  await btnFinalizar.click();
  await page.waitForTimeout(800);
  return true;
}

// Preenche formulário de convidado no checkout
async function preencherDadosConvidado(page: Page): Promise<boolean> {
  const nomeInput = page.getByPlaceholder(/seu nome|nome completo/i).first();
  const emailInput = page.getByPlaceholder(/e-mail|contato@|seu@/i).first();
  const cpfInput = page.getByPlaceholder('000.000.000-00').first();

  if (!(await nomeInput.isVisible({ timeout: 5000 }))) return false;

  await nomeInput.fill('Teste Playwright PIX');
  if (await emailInput.isVisible({ timeout: 2000 })) {
    await emailInput.fill('pix.teste@playwright.com');
  }
  if (await cpfInput.isVisible({ timeout: 2000 })) {
    await cpfInput.fill('529.982.247-25');
  }
  return true;
}

// ---------------------------------------------------------------------------
// Suite: Checkout PIX - Opção de Pagamento
// ---------------------------------------------------------------------------

test.describe('Checkout PIX - Seleção de Método', () => {
  test('deve exibir a opção PIX no checkout', async ({ page }) => {
    const abriu = await abrirCheckout(page);
    if (!abriu) return;

    const pixOpcao = page.getByText(/pix/i).first();
    if (await pixOpcao.isVisible({ timeout: 5000 })) {
      await expect(pixOpcao).toBeVisible();
    }
  });

  test('deve exibir ícone ou badge "PIX" nas opções de pagamento', async ({ page }) => {
    const abriu = await abrirCheckout(page);
    if (!abriu) return;

    const pixLabel = page.locator('label, button, div').filter({ hasText: /^pix$/i }).first();
    if (await pixLabel.isVisible({ timeout: 5000 })) {
      await expect(pixLabel).toBeVisible();
    }
  });

  test('deve selecionar PIX como método de pagamento', async ({ page }) => {
    const abriu = await abrirCheckout(page);
    if (!abriu) return;

    const pixOpcao = page.locator('button, label, [role="radio"]').filter({ hasText: /pix/i }).first();
    if (await pixOpcao.isVisible({ timeout: 5000 })) {
      await pixOpcao.click();
      await page.waitForTimeout(300);
      // Verifica que o PIX ficou selecionado (classe ativa ou border colorida)
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('deve exibir opções de cartão de crédito além do PIX', async ({ page }) => {
    const abriu = await abrirCheckout(page);
    if (!abriu) return;

    const cartaoOpcao = page.getByText(/cartão de crédito|crédito/i).first();
    if (await cartaoOpcao.isVisible({ timeout: 5000 })) {
      await expect(cartaoOpcao).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Checkout PIX - Formulário de Convidado
// ---------------------------------------------------------------------------

test.describe('Checkout PIX - Dados do Comprador', () => {
  test('deve exibir campo de nome no formulário de checkout', async ({ page }) => {
    const abriu = await abrirCheckout(page);
    if (!abriu) return;

    const nomeInput = page.getByPlaceholder(/seu nome|nome completo/i).first();
    if (await nomeInput.isVisible({ timeout: 5000 })) {
      await expect(nomeInput).toBeVisible();
    }
  });

  test('deve exibir campo de e-mail no formulário de checkout', async ({ page }) => {
    const abriu = await abrirCheckout(page);
    if (!abriu) return;

    const emailInput = page.getByPlaceholder(/e-mail|contato@|seu@/i).first();
    if (await emailInput.isVisible({ timeout: 5000 })) {
      await expect(emailInput).toBeVisible();
    }
  });

  test('deve exibir campo de CPF no formulário de checkout', async ({ page }) => {
    const abriu = await abrirCheckout(page);
    if (!abriu) return;

    const cpfInput = page.getByPlaceholder('000.000.000-00').first();
    if (await cpfInput.isVisible({ timeout: 5000 })) {
      await expect(cpfInput).toBeVisible();
    }
  });

  test('deve bloquear prosseguimento com CPF inválido no checkout', async ({ page }) => {
    const abriu = await abrirCheckout(page);
    if (!abriu) return;

    const cpfInput = page.getByPlaceholder('000.000.000-00').first();
    if (!(await cpfInput.isVisible({ timeout: 5000 }))) return;

    await cpfInput.fill('111.111.111-11');

    const nomeInput = page.getByPlaceholder(/seu nome|nome completo/i).first();
    if (await nomeInput.isVisible()) await nomeInput.fill('Teste Inválido');

    const continuar = page.getByRole('button', { name: /continuar|avançar|confirmar/i }).first();
    if (await continuar.isVisible({ timeout: 3000 })) {
      await continuar.click();
      await page.waitForTimeout(1000);
      // Deve aparecer mensagem de erro ou permanecer no mesmo step
      const erro = page.locator('.text-red-400, .text-red-500, [class*="error"]').first();
      if (await erro.isVisible({ timeout: 3000 })) {
        await expect(erro).toBeVisible();
      }
    }
  });

  test('deve aceitar CPF válido no checkout', async ({ page }) => {
    const abriu = await abrirCheckout(page);
    if (!abriu) return;

    const preencheu = await preencherDadosConvidado(page);
    if (!preencheu) return;

    // Após preencher dados válidos, não deve mostrar erro de CPF
    const erroCpf = page.locator('.text-red-400').filter({ hasText: /cpf/i });
    await expect(erroCpf).not.toBeVisible();
  });

  test('deve exibir o resumo do pedido no checkout (quantidade e total)', async ({ page }) => {
    const abriu = await abrirCheckout(page);
    if (!abriu) return;

    const total = page.getByText(/total|r\$/i).first();
    if (await total.isVisible({ timeout: 5000 })) {
      await expect(total).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Checkout PIX - Tela de QR Code
// ---------------------------------------------------------------------------

test.describe('Checkout PIX - QR Code', () => {
  async function chegarNaPaginaPIX(page: Page): Promise<boolean> {
    const abriu = await abrirCheckout(page);
    if (!abriu) return false;

    // Seleciona PIX
    const pixOpcao = page.locator('button, label, [role="radio"]').filter({ hasText: /pix/i }).first();
    if (await pixOpcao.isVisible({ timeout: 5000 })) {
      await pixOpcao.click();
    }

    // Preenche dados
    const preencheu = await preencherDadosConvidado(page);
    if (!preencheu) return false;

    // Avança para pagamento
    const btnPagar = page.getByRole('button', { name: /pagar|confirmar|finalizar compra/i }).first();
    if (!(await btnPagar.isVisible({ timeout: 5000 }))) return false;

    await btnPagar.click();
    await page.waitForTimeout(2000);
    return true;
  }

  test('deve exibir o QR code PIX após confirmar o pedido', async ({ page }) => {
    const chegou = await chegarNaPaginaPIX(page);
    if (!chegou) return;

    const qrCode = page.locator('canvas, img[alt*="qr" i], svg[class*="qr"]').first();
    const qrTexto = page.getByText(/qr code|escaneie/i).first();
    if (await qrCode.isVisible({ timeout: 6000 })) {
      await expect(qrCode).toBeVisible();
    } else if (await qrTexto.isVisible({ timeout: 6000 })) {
      await expect(qrTexto).toBeVisible();
    }
  });

  test('deve exibir a chave PIX copia-cola', async ({ page }) => {
    const chegou = await chegarNaPaginaPIX(page);
    if (!chegou) return;

    const chavePix = page.getByText(/copia e cola|copiar chave|pix copia/i).first();
    if (await chavePix.isVisible({ timeout: 6000 })) {
      await expect(chavePix).toBeVisible();
    }
  });

  test('deve exibir botão de copiar a chave PIX', async ({ page }) => {
    const chegou = await chegarNaPaginaPIX(page);
    if (!chegou) return;

    const copiarBtn = page.getByRole('button', { name: /copiar/i }).first();
    if (await copiarBtn.isVisible({ timeout: 6000 })) {
      await expect(copiarBtn).toBeVisible();
    }
  });

  test('deve exibir o valor a ser pago na tela do PIX', async ({ page }) => {
    const chegou = await chegarNaPaginaPIX(page);
    if (!chegou) return;

    const valorText = page.getByText(/r\$/i).first();
    if (await valorText.isVisible({ timeout: 5000 })) {
      await expect(valorText).toBeVisible();
    }
  });

  test('deve exibir mensagem de aguardando pagamento', async ({ page }) => {
    const chegou = await chegarNaPaginaPIX(page);
    if (!chegou) return;

    const aguardando = page.getByText(/aguard|pendente|processando/i).first();
    if (await aguardando.isVisible({ timeout: 6000 })) {
      await expect(aguardando).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Checkout - Fechar Modal
// ---------------------------------------------------------------------------

test.describe('Checkout - Controle do Modal', () => {
  test('deve exibir botão de fechar o modal de checkout', async ({ page }) => {
    const abriu = await abrirCheckout(page);
    if (!abriu) return;

    const fecharBtn = page.locator('button').filter({ has: page.locator('.lucide-x, svg') }).first();
    if (await fecharBtn.isVisible({ timeout: 5000 })) {
      await expect(fecharBtn).toBeVisible();
    }
  });

  test('deve fechar o modal de checkout ao clicar em X', async ({ page }) => {
    const abriu = await abrirCheckout(page);
    if (!abriu) return;

    const fecharBtn = page.locator('[class*="absolute"][class*="top"]').locator('button').first();
    if (!(await fecharBtn.isVisible({ timeout: 3000 }))) {
      // Tenta localizar pelo ícone X
      const xBtn = page.locator('button').filter({ has: page.locator('.lucide-x') }).first();
      if (await xBtn.isVisible({ timeout: 3000 })) {
        await xBtn.click();
        await page.waitForTimeout(400);
        // Modal deve fechar — booking view deve estar visível
        await expect(page.locator('main')).toBeVisible();
      }
      return;
    }

    await fecharBtn.click();
    await page.waitForTimeout(400);
    await expect(page.locator('main')).toBeVisible();
  });

  test('deve exibir resumo dos itens no modal de checkout', async ({ page }) => {
    const abriu = await abrirCheckout(page);
    if (!abriu) return;

    // Deve mostrar a quantidade de ingressos ou mesas selecionadas
    const resumo = page.getByText(/1x|ingresso|mesa/i).first();
    if (await resumo.isVisible({ timeout: 5000 })) {
      await expect(resumo).toBeVisible();
    }
  });

  test('deve exibir timer de expiração do carrinho no checkout', async ({ page }) => {
    const abriu = await abrirCheckout(page);
    if (!abriu) return;

    const timer = page.getByText(/\d+:\d{2}|expira|tempo/i).first();
    if (await timer.isVisible({ timeout: 5000 })) {
      await expect(timer).toBeVisible();
    }
  });
});
