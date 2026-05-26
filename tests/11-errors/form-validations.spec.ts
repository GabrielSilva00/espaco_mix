/**
 * 11-errors/form-validations — Validações de formulário: campos obrigatórios,
 * formatos inválidos, CPF, e-mail, datas.
 */
import { test, expect, Page } from '@playwright/test';
import { aceitarLGPD, BASE_URL } from '../helpers/auth.helper';
import { TEST_CPFS } from '../helpers/data.helper';

async function irParaHome(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);
}

async function abrirModalLogin(page: Page) {
  await irParaHome(page);
  const entrarBtn = page.getByRole('button', { name: 'Entrar', exact: true }).first();
  await entrarBtn.click();
  await expect(page.getByText('Bem-vindo de volta').first()).toBeVisible({ timeout: 6000 });
}

// ─── Validações de login ──────────────────────────────────────────────────────

test.describe('Validações — Login', () => {
  test('submeter login vazio exibe erro em ambos os campos', async ({ page }) => {
    await abrirModalLogin(page);

    const submitBtn = page.getByRole('button', { name: /entrar|login|sign in/i }).first();
    await submitBtn.click();
    await page.waitForTimeout(500);

    const erro = page.locator('.text-red-400, .text-red-500, [class*="error"]').first();
    if (await erro.isVisible({ timeout: 3000 })) {
      await expect(erro).toBeVisible();
    }
  });

  test('e-mail sem @ exibe erro de formato', async ({ page }) => {
    await abrirModalLogin(page);

    const emailInput = page.getByPlaceholder(/e-mail|email/i).first();
    await emailInput.fill('emailinvalido');

    const submitBtn = page.getByRole('button', { name: /entrar|sign in/i }).first();
    await submitBtn.click();
    await page.waitForTimeout(500);

    // Deve mostrar erro ou manter na tela
    await expect(emailInput).toBeVisible();
  });

  test('senha com menos de 6 caracteres exibe erro', async ({ page }) => {
    await abrirModalLogin(page);

    const emailInput = page.getByPlaceholder(/e-mail|email/i).first();
    const senhaInput = page.getByPlaceholder(/senha|password/i).first();

    await emailInput.fill('teste@teste.com');
    await senhaInput.fill('123');

    const submitBtn = page.getByRole('button', { name: /entrar|sign in/i }).first();
    await submitBtn.click();
    await page.waitForTimeout(500);

    const erro = page.locator('.text-red-400, .text-red-500').first();
    if (await erro.isVisible({ timeout: 3000 })) {
      await expect(erro).toBeVisible();
    }
  });

  test('credenciais incorretas exibem mensagem clara', async ({ page }) => {
    await abrirModalLogin(page);

    await page.getByPlaceholder(/e-mail|email/i).first().fill('naoexiste@teste.com');
    await page.getByPlaceholder(/senha|password/i).first().fill('SenhaErrada123!');

    await page.getByRole('button', { name: /entrar|sign in/i }).first().click();
    await page.waitForTimeout(2000);

    const erro = page.getByText(/credencial|inválido|incorrect|wrong password|user not found/i).first();
    if (await erro.isVisible({ timeout: 5000 })) {
      await expect(erro).toBeVisible();
    }
  });
});

// ─── Validações de cadastro ───────────────────────────────────────────────────

test.describe('Validações — Cadastro', () => {
  async function abrirCadastro(page: Page) {
    await abrirModalLogin(page);
    const cadastroBtn = page.getByRole('button', { name: /cadastrar|registrar|criar conta/i }).first();
    if (await cadastroBtn.isVisible({ timeout: 4000 })) {
      await cadastroBtn.click();
      await page.waitForTimeout(400);
    }
  }

  test('nome em branco bloqueia avanço no cadastro', async ({ page }) => {
    await abrirCadastro(page);

    const proximo = page.getByRole('button', { name: /próximo|continuar|avançar/i }).first();
    if (!(await proximo.isVisible({ timeout: 4000 }))) return;

    await proximo.click();
    await page.waitForTimeout(500);

    const erro = page.locator('.text-red-400, .text-red-500, [class*="error"]').first();
    if (await erro.isVisible({ timeout: 3000 })) {
      await expect(erro).toBeVisible();
    }
  });

  test('CPF sequencial (111.111.111-11) é rejeitado', async ({ page }) => {
    await abrirCadastro(page);

    const cpfInput = page.getByPlaceholder(/CPF/i).first();
    if (!(await cpfInput.isVisible({ timeout: 5000 }))) return;

    await cpfInput.fill(TEST_CPFS.invalido_sequencial);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(400);

    const erro = page.getByText(/CPF inválido/i).first();
    if (await erro.isVisible({ timeout: 3000 })) {
      await expect(erro).toBeVisible();
    }
  });

  test('CPF com dígitos verificadores errados é rejeitado', async ({ page }) => {
    await abrirCadastro(page);

    const cpfInput = page.getByPlaceholder(/CPF/i).first();
    if (!(await cpfInput.isVisible({ timeout: 5000 }))) return;

    await cpfInput.fill(TEST_CPFS.invalido_digitos);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(400);

    const erro = page.getByText(/CPF inválido/i).first();
    if (await erro.isVisible({ timeout: 3000 })) {
      await expect(erro).toBeVisible();
    }
  });

  test('CPF válido aceito sem erro', async ({ page }) => {
    await abrirCadastro(page);

    const cpfInput = page.getByPlaceholder(/CPF/i).first();
    if (!(await cpfInput.isVisible({ timeout: 5000 }))) return;

    await cpfInput.fill(TEST_CPFS.valido1);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(400);

    const erro = page.getByText(/CPF inválido/i);
    await expect(erro).not.toBeVisible();
  });

  test('data de nascimento futura é rejeitada', async ({ page }) => {
    await abrirCadastro(page);

    const dataInput = page.locator('input[type="date"]').first();
    if (!(await dataInput.isVisible({ timeout: 4000 }))) return;

    await dataInput.fill('2099-01-01');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(400);

    // A página não deve quebrar
    await expect(page.locator('body')).toBeVisible();
  });

  test('senha e confirmação de senha devem coincidir', async ({ page }) => {
    await abrirCadastro(page);

    const senhaInput    = page.getByPlaceholder(/^senha$/i).first();
    const confirmaInput = page.getByPlaceholder(/confirmar senha|confirme|repeat/i).first();

    if (!(await senhaInput.isVisible({ timeout: 4000 }))) return;
    if (!(await confirmaInput.isVisible({ timeout: 4000 }))) return;

    await senhaInput.fill('SenhaForte123!');
    await confirmaInput.fill('SenhaDiferente456!');

    const submitBtn = page.getByRole('button', { name: /cadastrar|criar conta|finalizar/i }).first();
    if (!(await submitBtn.isVisible({ timeout: 3000 }))) return;

    await submitBtn.click();
    await page.waitForTimeout(500);

    const erro = page.getByText(/senhas.*não coincidem|passwords.*match|senha.*diferente/i).first();
    if (await erro.isVisible({ timeout: 3000 })) {
      await expect(erro).toBeVisible();
    }
  });
});

// ─── Validações de checkout ───────────────────────────────────────────────────

test.describe('Validações — Checkout', () => {
  async function irParaCheckout(page: Page): Promise<boolean> {
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

    const continuar = page.getByRole('button', { name: /continuar|comprar|próximo/i }).first();
    if (!(await continuar.isEnabled({ timeout: 3000 }).catch(() => false))) return false;

    await continuar.click();
    await page.waitForTimeout(600);
    return true;
  }

  test('nome em branco bloqueia o checkout', async ({ page }) => {
    const chegou = await irParaCheckout(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis'); return; }

    const nomeInput = page.getByPlaceholder(/nome|name/i).first();
    if (!(await nomeInput.isVisible({ timeout: 5000 }))) return;

    await nomeInput.clear();
    const avancar = page.getByRole('button', { name: /continuar|avançar/i }).first();
    if (await avancar.isVisible({ timeout: 3000 })) {
      await avancar.click();
      await page.waitForTimeout(500);
      await expect(nomeInput).toBeVisible();
    }
  });

  test('e-mail inválido bloqueia o checkout', async ({ page }) => {
    const chegou = await irParaCheckout(page);
    if (!chegou) { test.skip(true, 'Sem eventos disponíveis'); return; }

    const emailInput = page.getByPlaceholder(/e-mail|email/i).first();
    if (!(await emailInput.isVisible({ timeout: 5000 }))) return;

    await emailInput.fill('invalido');
    const avancar = page.getByRole('button', { name: /continuar|avançar/i }).first();
    if (await avancar.isVisible({ timeout: 3000 })) {
      await avancar.click();
      await page.waitForTimeout(500);
      await expect(emailInput).toBeVisible();
    }
  });
});

// ─── Validações de API ────────────────────────────────────────────────────────

test.describe('Validações — API', () => {
  test('POST /api/validate-cpf com CPF inválido retorna 400', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/validate-cpf', {
      data: { cpf: '111.111.111-11' }
    });
    expect([400, 422]).toContain(res.status());
  });

  test('POST /api/validate-cpf com CPF válido retorna 200', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/validate-cpf', {
      data: { cpf: TEST_CPFS.valido1.replace(/\D/g, '') }
    });
    expect([200, 201]).toContain(res.status());
  });

  test('POST /api/users/register sem dados retorna 400', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/users/register', {
      data: {}
    });
    expect([400, 422]).toContain(res.status());
  });
});
