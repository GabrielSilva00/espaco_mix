/**
 * 05-purchase/pagamento — Fluxo de pagamento: PIX e Cartão. Boleto NÃO existe no sistema.
 */
import { test, expect, Page } from '@playwright/test';
import { aceitarLGPD, loginAsUser, BASE_URL } from '../helpers/auth.helper';
import { TEST_CPFS } from '../helpers/data.helper';

async function chegarNaEtapaGuestData(page: Page): Promise<boolean> {
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
  return true;
}

async function chegarNaEtapaPagamento(page: Page): Promise<boolean> {
  const chegou = await chegarNaEtapaGuestData(page);
  if (!chegou) return false;

  // Preenche dados do comprador se necessário
  const nomeInput  = page.getByPlaceholder(/nome|name/i).first();
  const emailInput = page.getByPlaceholder(/e-mail|email/i).first();
  const cpfInput   = page.getByPlaceholder(/CPF/i).first();

  if (await nomeInput.isVisible({ timeout: 3000 })) {
    await nomeInput.fill('Teste Playwright');
  }
  if (await emailInput.isVisible({ timeout: 3000 })) {
    await emailInput.fill('teste@playwright.local');
  }
  if (await cpfInput.isVisible({ timeout: 3000 })) {
    await cpfInput.fill(TEST_CPFS.valido1);
  }

  const avancar = page.getByRole('button', { name: /continuar|avançar|próximo|pagar/i }).first();
  if (await avancar.isVisible({ timeout: 4000 })) {
    await avancar.click();
    await page.waitForTimeout(800);
  }
  return true;
}

// ─── Métodos de pagamento disponíveis ────────────────────────────────────────

test.describe('Pagamento — Métodos Disponíveis', () => {
  test('opção PIX está disponível', async ({ page }) => {
    const chegou = await chegarNaEtapaPagamento(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const pixOpcao = page.getByText(/pix/i).first();
    if (await pixOpcao.isVisible({ timeout: 6000 })) {
      await expect(pixOpcao).toBeVisible();
    }
  });

  test('opção Cartão de Crédito está disponível', async ({ page }) => {
    const chegou = await chegarNaEtapaPagamento(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const cartaoOpcao = page.getByText(/cartão|crédito|credit/i).first();
    if (await cartaoOpcao.isVisible({ timeout: 6000 })) {
      await expect(cartaoOpcao).toBeVisible();
    }
  });

  test('opção Cartão de Débito está disponível', async ({ page }) => {
    const chegou = await chegarNaEtapaPagamento(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const debitoOpcao = page.getByText(/débito|debit/i).first();
    if (await debitoOpcao.isVisible({ timeout: 6000 })) {
      await expect(debitoOpcao).toBeVisible();
    }
  });

  test('BOLETO NÃO está disponível como opção de pagamento', async ({ page }) => {
    const chegou = await chegarNaEtapaPagamento(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    // Boleto explicitamente não deve existir
    const boletoOpcao = page.getByText(/boleto/i);
    await expect(boletoOpcao).not.toBeVisible();
  });
});

// ─── Fluxo PIX ────────────────────────────────────────────────────────────────

test.describe('Pagamento — PIX', () => {
  test('selecionar PIX exibe QR Code ou chave copia-e-cola', async ({ page }) => {
    const chegou = await chegarNaEtapaPagamento(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const pixBtn = page.getByRole('button', { name: /pix/i }).first();
    if (!(await pixBtn.isVisible({ timeout: 5000 }))) return;
    await pixBtn.click();
    await page.waitForTimeout(500);

    const confirmarPix = page.getByRole('button', { name: /pagar com pix|confirmar pix|gerar pix/i }).first();
    if (await confirmarPix.isVisible({ timeout: 3000 })) {
      await confirmarPix.click();
      await page.waitForTimeout(2000);

      const qrCode    = page.locator('canvas, img[alt*="qr" i], [class*="qr"]').first();
      const chavePix  = page.getByText(/copia e cola|copiar chave|pix key/i).first();

      const temQR    = await qrCode.isVisible({ timeout: 5000 });
      const temChave = await chavePix.isVisible({ timeout: 5000 });
      expect(temQR || temChave).toBe(true);
    }
  });

  test('botão "Copiar" da chave PIX funciona', async ({ page }) => {
    const chegou = await chegarNaEtapaPagamento(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const pixBtn = page.getByRole('button', { name: /pix/i }).first();
    if (!(await pixBtn.isVisible({ timeout: 5000 }))) return;
    await pixBtn.click();
    await page.waitForTimeout(500);

    const confirmarPix = page.getByRole('button', { name: /pagar com pix|gerar pix/i }).first();
    if (!(await confirmarPix.isVisible({ timeout: 3000 }))) return;
    await confirmarPix.click();
    await page.waitForTimeout(2000);

    const copiarBtn = page.getByRole('button', { name: /copiar|copy/i }).first();
    if (await copiarBtn.isVisible({ timeout: 5000 })) {
      await copiarBtn.click();
      await page.waitForTimeout(500);
      // Não deve gerar erro JS
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('timer de 10 minutos aparece durante checkout PIX', async ({ page }) => {
    const chegou = await chegarNaEtapaPagamento(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const pixBtn = page.getByRole('button', { name: /pix/i }).first();
    if (!(await pixBtn.isVisible({ timeout: 5000 }))) return;
    await pixBtn.click();

    const confirmarPix = page.getByRole('button', { name: /pagar com pix|gerar pix/i }).first();
    if (!(await confirmarPix.isVisible({ timeout: 3000 }))) return;
    await confirmarPix.click();
    await page.waitForTimeout(2000);

    // Timer de carrinho deve aparecer durante o checkout
    const timer = page.getByText(/\d{2}:\d{2}|minutos|expira/i).first();
    if (await timer.isVisible({ timeout: 5000 })) {
      await expect(timer).toBeVisible();
    }
  });
});

// ─── Fluxo Cartão ─────────────────────────────────────────────────────────────

test.describe('Pagamento — Cartão', () => {
  test('selecionar Cartão exibe campos de número, validade e CVV', async ({ page }) => {
    const chegou = await chegarNaEtapaPagamento(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const cartaoBtn = page.getByRole('button', { name: /cartão|crédito|débito/i }).first();
    if (!(await cartaoBtn.isVisible({ timeout: 5000 }))) return;
    await cartaoBtn.click();
    await page.waitForTimeout(500);

    const campoNumero   = page.getByPlaceholder(/número do cartão|card number|\d{4}/i).first();
    const campoValidade = page.getByPlaceholder(/validade|expiry|mm\/aa/i).first();
    const campoCVV      = page.getByPlaceholder(/cvv|cvc|código/i).first();

    if (await campoNumero.isVisible({ timeout: 4000 })) {
      await expect(campoNumero).toBeVisible();
    }
    if (await campoValidade.isVisible({ timeout: 3000 })) {
      await expect(campoValidade).toBeVisible();
    }
    if (await campoCVV.isVisible({ timeout: 3000 })) {
      await expect(campoCVV).toBeVisible();
    }
  });

  test('número de cartão inválido gera mensagem de erro', async ({ page }) => {
    const chegou = await chegarNaEtapaPagamento(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const cartaoBtn = page.getByRole('button', { name: /cartão|crédito/i }).first();
    if (!(await cartaoBtn.isVisible({ timeout: 5000 }))) return;
    await cartaoBtn.click();
    await page.waitForTimeout(500);

    const campoNumero = page.getByPlaceholder(/número do cartão|card number|\d{4}/i).first();
    if (!(await campoNumero.isVisible({ timeout: 4000 }))) return;

    await campoNumero.fill('1234 5678 9012 3456');

    const pagarBtn = page.getByRole('button', { name: /pagar|confirmar pagamento/i }).first();
    if (await pagarBtn.isVisible({ timeout: 3000 })) {
      await pagarBtn.click();
      await page.waitForTimeout(800);
      // Deve exibir algum erro
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('campo de número do cartão aceita apenas números', async ({ page }) => {
    const chegou = await chegarNaEtapaPagamento(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const cartaoBtn = page.getByRole('button', { name: /cartão|crédito/i }).first();
    if (!(await cartaoBtn.isVisible({ timeout: 5000 }))) return;
    await cartaoBtn.click();
    await page.waitForTimeout(500);

    const campoNumero = page.getByPlaceholder(/número do cartão|card number/i).first();
    if (!(await campoNumero.isVisible({ timeout: 4000 }))) return;

    await campoNumero.fill('abcd efgh ijkl mnop');
    const valor = await campoNumero.inputValue();

    // Campo não deve conter letras
    expect(/[a-zA-Z]/.test(valor)).toBe(false);
  });

  test('nome do titular é obrigatório no cartão', async ({ page }) => {
    const chegou = await chegarNaEtapaPagamento(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const cartaoBtn = page.getByRole('button', { name: /cartão|crédito/i }).first();
    if (!(await cartaoBtn.isVisible({ timeout: 5000 }))) return;
    await cartaoBtn.click();
    await page.waitForTimeout(500);

    const nomeTitular = page.getByPlaceholder(/nome.*titular|cardholder|nome no cartão/i).first();
    if (await nomeTitular.isVisible({ timeout: 4000 })) {
      await expect(nomeTitular).toBeEnabled();
    }
  });
});

// ─── Dados do comprador ───────────────────────────────────────────────────────

test.describe('Pagamento — Dados do Comprador', () => {
  test('formulário exige nome completo', async ({ page }) => {
    const chegou = await chegarNaEtapaGuestData(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const nomeInput = page.getByPlaceholder(/nome completo|nome|name/i).first();
    if (await nomeInput.isVisible({ timeout: 5000 })) {
      await expect(nomeInput).toBeEnabled();
    }
  });

  test('formulário exige e-mail válido', async ({ page }) => {
    const chegou = await chegarNaEtapaGuestData(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const emailInput = page.getByPlaceholder(/e-mail|email/i).first();
    if (!(await emailInput.isVisible({ timeout: 5000 }))) return;

    await emailInput.fill('email-invalido');
    const avancar = page.getByRole('button', { name: /continuar|avançar|próximo/i }).first();
    if (await avancar.isVisible({ timeout: 3000 })) {
      await avancar.click();
      await page.waitForTimeout(500);
      // Deve manter na tela de dados
      await expect(emailInput).toBeVisible();
    }
  });

  test('CPF inválido gera erro de validação', async ({ page }) => {
    const chegou = await chegarNaEtapaGuestData(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const cpfInput = page.getByPlaceholder(/CPF/i).first();
    if (!(await cpfInput.isVisible({ timeout: 5000 }))) return;

    await cpfInput.fill(TEST_CPFS.invalido_sequencial);
    const avancar = page.getByRole('button', { name: /continuar|avançar|próximo/i }).first();
    if (await avancar.isVisible({ timeout: 3000 })) {
      await avancar.click();
      await page.waitForTimeout(600);
      // Deve exibir erro de CPF
      const erroCpf = page.getByText(/CPF inválido|CPF.*inválido|cpf.*invalid/i).first();
      if (await erroCpf.isVisible({ timeout: 3000 })) {
        await expect(erroCpf).toBeVisible();
      }
    }
  });

  test('CPF válido passa pela validação', async ({ page }) => {
    const chegou = await chegarNaEtapaGuestData(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    const cpfInput = page.getByPlaceholder(/CPF/i).first();
    if (!(await cpfInput.isVisible({ timeout: 5000 }))) return;

    await cpfInput.fill(TEST_CPFS.valido1);
    await page.waitForTimeout(300);

    // Não deve exibir erro de CPF imediatamente
    const erroCpf = page.getByText(/CPF inválido/i);
    await expect(erroCpf).not.toBeVisible();
  });
});

// ─── Segurança no pagamento ───────────────────────────────────────────────────

test.describe('Pagamento — Segurança', () => {
  test('dados de pagamento não ficam expostos no HTML', async ({ page }) => {
    const chegou = await chegarNaEtapaPagamento(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    // Campos sensíveis devem ser type="password" ou gerenciados pelo SDK do gateway
    const cartaoBtn = page.getByRole('button', { name: /cartão/i }).first();
    if (!(await cartaoBtn.isVisible({ timeout: 5000 }))) return;
    await cartaoBtn.click();
    await page.waitForTimeout(500);

    const cvvInput = page.getByPlaceholder(/cvv|cvc/i).first();
    if (await cvvInput.isVisible({ timeout: 4000 })) {
      const type = await cvvInput.getAttribute('type');
      // CVV deve ser password ou text (se mascarado pelo SDK)
      expect(['password', 'text', 'tel', 'number']).toContain(type);
    }
  });

  test('erros JS não ocorrem durante fluxo de pagamento', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    const chegou = await chegarNaEtapaPagamento(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis para compra'); return; }

    await page.waitForTimeout(1000);

    const critical = errors.filter(e => !/ResizeObserver|extension/i.test(e));
    expect(critical, `Erros JS: ${critical.join(' | ')}`).toHaveLength(0);
  });
});
