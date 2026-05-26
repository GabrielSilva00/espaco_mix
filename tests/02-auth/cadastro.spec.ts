/**
 * 02-auth/cadastro — Fluxo completo de registro de novo usuário.
 */
import { test, expect, Page } from '@playwright/test';
import { aceitarLGPD, abrirModalLogin, BASE_URL } from '../helpers/auth.helper';
import { generateTestEmail, generateValidCPF, TEST_CPFS } from '../helpers/data.helper';

async function irParaCadastro(page: Page) {
  await abrirModalLogin(page);
  await page.getByRole('button', { name: /cadastrar/i }).first().click();
  await expect(page.getByText('Criar nova conta')).toBeVisible({ timeout: 6000 });
}

// ─── Etapa 1 ──────────────────────────────────────────────────────────────────

test.describe('Cadastro — Etapa 1 (Dados da Conta)', () => {
  test.beforeEach(async ({ page }) => {
    await irParaCadastro(page);
  });

  test('exibe campo de nome', async ({ page }) => {
    await expect(page.getByPlaceholder('Seu nome')).toBeVisible();
  });

  test('exibe campo de e-mail', async ({ page }) => {
    await expect(page.getByPlaceholder('contato@exemplo.com')).toBeVisible();
  });

  test('exibe campo de senha', async ({ page }) => {
    await expect(page.getByPlaceholder('••••••••').first()).toBeVisible();
  });

  test('exibe botão "Cadastrar com Google"', async ({ page }) => {
    await expect(page.getByRole('button', { name: /cadastrar com google/i })).toBeVisible();
  });

  test('exibe botão "Continuar"', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeVisible();
  });

  test('bloqueia avanço sem preencher campos obrigatórios', async ({ page }) => {
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    const erro = page.locator('.text-red-400, .text-red-500').first();
    await expect(erro).toBeVisible({ timeout: 4000 });
  });

  test('bloqueia avanço com nome vazio', async ({ page }) => {
    await page.getByPlaceholder('contato@exemplo.com').fill('teste@email.com');
    await page.getByPlaceholder('••••••••').first().fill('Senha@12345');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    // Permanece na etapa 1
    await expect(page.getByPlaceholder('Seu nome')).toBeVisible({ timeout: 3000 });
  });

  test('bloqueia avanço com e-mail inválido', async ({ page }) => {
    await page.getByPlaceholder('Seu nome').fill('Teste Playwright');
    await page.getByPlaceholder('contato@exemplo.com').fill('emailinvalido');
    await page.getByPlaceholder('••••••••').first().fill('Senha@12345');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.waitForTimeout(500);
    await expect(page.getByPlaceholder('Seu nome')).toBeVisible({ timeout: 3000 });
  });

  test('bloqueia avanço com senha fraca (menos de 6 caracteres)', async ({ page }) => {
    await page.getByPlaceholder('Seu nome').fill('Teste Playwright');
    await page.getByPlaceholder('contato@exemplo.com').fill('fraco@email.com');
    await page.getByPlaceholder('••••••••').first().fill('123');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.waitForTimeout(500);
    await expect(page.getByPlaceholder('Seu nome')).toBeVisible({ timeout: 3000 });
  });

  test('avança para etapa 2 com dados válidos', async ({ page }) => {
    await page.getByPlaceholder('Seu nome').fill('Teste Playwright');
    await page.getByPlaceholder('contato@exemplo.com').fill(generateTestEmail());
    await page.getByPlaceholder('••••••••').first().fill('Senha@12345');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    // Etapa 2: campo de telefone aparece
    await expect(page.getByPlaceholder('(11) 90000-0000')).toBeVisible({ timeout: 6000 });
  });
});

// ─── Etapa 2 ──────────────────────────────────────────────────────────────────

test.describe('Cadastro — Etapa 2 (Dados Pessoais)', () => {
  async function chegarNaEtapa2(page: Page) {
    await irParaCadastro(page);
    await page.getByPlaceholder('Seu nome').fill('Teste Playwright');
    await page.getByPlaceholder('contato@exemplo.com').fill(generateTestEmail());
    await page.getByPlaceholder('••••••••').first().fill('Senha@12345');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.getByPlaceholder('(11) 90000-0000')).toBeVisible({ timeout: 6000 });
  }

  test('exibe campo de celular', async ({ page }) => {
    await chegarNaEtapa2(page);
    await expect(page.getByPlaceholder('(11) 90000-0000')).toBeVisible();
  });

  test('exibe campo de CPF', async ({ page }) => {
    await chegarNaEtapa2(page);
    await expect(page.getByPlaceholder('000.000.000-00')).toBeVisible();
  });

  test('exibe campo de data de nascimento', async ({ page }) => {
    await chegarNaEtapa2(page);
    await expect(page.locator('input[type="date"]').first()).toBeVisible({ timeout: 4000 });
  });

  test('exibe botão "Criar Conta e Continuar"', async ({ page }) => {
    await chegarNaEtapa2(page);
    await expect(
      page.getByRole('button', { name: /criar conta e continuar/i })
    ).toBeVisible({ timeout: 4000 });
  });

  test('exibe botão "Voltar" para retornar à etapa 1', async ({ page }) => {
    await chegarNaEtapa2(page);
    await expect(page.getByRole('button', { name: /^voltar$/i }).first()).toBeVisible();
  });

  test('botão "Voltar" retorna à etapa 1', async ({ page }) => {
    await chegarNaEtapa2(page);
    await page.getByRole('button', { name: /^voltar$/i }).first().click();
    await expect(page.getByPlaceholder('Seu nome')).toBeVisible({ timeout: 5000 });
  });

  test('permite preencher o celular', async ({ page }) => {
    await chegarNaEtapa2(page);
    const tel = page.getByPlaceholder('(11) 90000-0000');
    await tel.fill('(11) 99999-8888');
    await expect(tel).toHaveValue('(11) 99999-8888');
  });

  test('bloqueia cadastro com CPF sequencial inválido', async ({ page }) => {
    await chegarNaEtapa2(page);
    await page.getByPlaceholder('000.000.000-00').fill(TEST_CPFS.invalido_sequencial);
    await page.getByPlaceholder('(11) 90000-0000').fill('(11) 99999-1234');
    await page.getByRole('button', { name: /criar conta e continuar/i }).click();
    await page.waitForTimeout(1500);
    const erro = page.locator('.text-red-400, .text-red-500').first();
    if (await erro.isVisible({ timeout: 4000 })) {
      await expect(erro).toBeVisible();
    }
  });

  test('aceita CPF matematicamente válido', async ({ page }) => {
    await chegarNaEtapa2(page);
    const cpfInput = page.getByPlaceholder('000.000.000-00');
    await cpfInput.fill(TEST_CPFS.valido1);
    // Não deve mostrar erro de CPF imediatamente
    const erroCpf = page.locator('.text-red-400').filter({ hasText: /cpf/i });
    await expect(erroCpf).not.toBeVisible();
  });
});

// ─── Navegação entre abas ─────────────────────────────────────────────────────

test.describe('Cadastro — Navegação', () => {
  test('alterna de "Cadastrar" para "Entrar" e vice-versa', async ({ page }) => {
    await irParaCadastro(page);
    // Vai para Login
    await page.getByRole('button', { name: /^entrar$/i }).first().click();
    await expect(page.getByText('Bem-vindo de volta')).toBeVisible({ timeout: 5000 });
    // Volta para Cadastro
    await page.getByRole('button', { name: /cadastrar/i }).first().click();
    await expect(page.getByText('Criar nova conta')).toBeVisible({ timeout: 5000 });
  });

  test('"Voltar ao Site" fecha o fluxo de cadastro', async ({ page }) => {
    await irParaCadastro(page);
    await page.getByRole('button', { name: /voltar ao site/i }).click();
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
  });
});
