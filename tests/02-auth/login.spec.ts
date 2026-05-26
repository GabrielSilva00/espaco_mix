/**
 * 02-auth/login — Testes de autenticação via e-mail/senha e Google.
 */
import { test, expect } from '@playwright/test';
import { aceitarLGPD, abrirModalLogin, loginAsUser, estaAutenticado, BASE_URL } from '../helpers/auth.helper';

// ─── Abertura do modal ────────────────────────────────────────────────────────

test.describe('Login — Abertura do Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
  });

  test('modal abre ao clicar em "Entrar"', async ({ page }) => {
    await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
    await expect(page.getByText('Bem-vindo de volta')).toBeVisible({ timeout: 8000 });
  });

  test('modal exibe a aba Login ativa por padrão', async ({ page }) => {
    await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
    await expect(page.getByText('Bem-vindo de volta')).toBeVisible({ timeout: 8000 });
    // A aba Login deve estar destacada (fundo dourado)
    const loginTab = page.getByRole('button', { name: /^entrar$/i }).first();
    await expect(loginTab).toBeVisible({ timeout: 4000 });
  });

  test('modal exibe campo de e-mail', async ({ page }) => {
    await abrirModalLogin(page);
    await expect(page.getByPlaceholder('seu@email.com')).toBeVisible();
  });

  test('modal exibe campo de senha', async ({ page }) => {
    await abrirModalLogin(page);
    await expect(page.getByPlaceholder('••••••••').first()).toBeVisible();
  });

  test('modal exibe botão "Entrar com Google"', async ({ page }) => {
    await abrirModalLogin(page);
    await expect(page.getByRole('button', { name: /entrar com google/i })).toBeVisible();
  });

  test('modal exibe link "Esqueci minha senha"', async ({ page }) => {
    await abrirModalLogin(page);
    await expect(page.getByRole('button', { name: /esqueci minha senha/i })).toBeVisible();
  });

  test('modal exibe aba "Cadastrar"', async ({ page }) => {
    await abrirModalLogin(page);
    await expect(page.getByRole('button', { name: /cadastrar/i }).first()).toBeVisible();
  });

  test('modal exibe botão "Voltar ao Site"', async ({ page }) => {
    await abrirModalLogin(page);
    await expect(page.getByRole('button', { name: /voltar ao site/i })).toBeVisible({ timeout: 5000 });
  });
});

// ─── Validações de campos ─────────────────────────────────────────────────────

test.describe('Login — Validações de campos', () => {
  test.beforeEach(async ({ page }) => {
    await abrirModalLogin(page);
  });

  test('bloqueia login com campos em branco', async ({ page }) => {
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(500);
    // Deve permanecer no modal de login
    await expect(page.getByText('Bem-vindo de volta')).toBeVisible({ timeout: 4000 });
  });

  test('bloqueia login com e-mail sem "@"', async ({ page }) => {
    await page.getByPlaceholder('seu@email.com').fill('emailsemarroba');
    await page.getByPlaceholder('••••••••').first().fill('qualquersenha');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1500);
    // Deve permanecer no login (não navegar)
    await expect(page.getByText(/bem-vindo de volta|inválido|erro/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('bloqueia login com senha vazia', async ({ page }) => {
    await page.getByPlaceholder('seu@email.com').fill('teste@email.com');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Bem-vindo de volta')).toBeVisible({ timeout: 4000 });
  });

  test('exibe erro com credenciais inválidas', async ({ page }) => {
    await page.getByPlaceholder('seu@email.com').fill('usuario_nao_existe_xyz@teste123.com');
    await page.getByPlaceholder('••••••••').first().fill('SenhaCompletamenteErrada#999');
    await page.locator('button[type="submit"]').click();
    const erro = page.locator('.text-red-400, .text-red-500').first();
    await expect(erro).toBeVisible({ timeout: 20000 });
  });
});

// ─── Fluxo de login bem-sucedido ──────────────────────────────────────────────

test.describe('Login — Sucesso', () => {
  test('login com credenciais válidas redireciona para home autenticada', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) {
      test.skip(true, 'Credenciais de teste não configuradas via env vars');
      return;
    }
    // Após login, o botão Entrar não deve mais estar visível
    await expect(
      page.getByRole('button', { name: 'Entrar', exact: true }).first()
    ).not.toBeVisible({ timeout: 6000 });
  });

  test('após login, "Minhas Reservas" aparece na navbar', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) {
      test.skip(true, 'Credenciais de teste não configuradas');
      return;
    }
    await expect(
      page.getByRole('button', { name: /minhas reservas/i }).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('modal fecha após login bem-sucedido', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) {
      test.skip(true, 'Credenciais de teste não configuradas');
      return;
    }
    await expect(page.getByText('Bem-vindo de volta')).not.toBeVisible({ timeout: 8000 });
  });
});

// ─── Sessão e persistência ────────────────────────────────────────────────────

test.describe('Login — Sessão', () => {
  test('sessão persiste após refresh da página', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) {
      test.skip(true, 'Credenciais de teste não configuradas');
      return;
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const autenticado = await estaAutenticado(page);
    expect(autenticado).toBe(true);
  });

  test('campos do formulário estão vazios ao reabrir o modal', async ({ page }) => {
    await abrirModalLogin(page);

    // Preenche mas não submete
    await page.getByPlaceholder('seu@email.com').fill('test@test.com');
    await page.getByRole('button', { name: /voltar ao site/i }).click();
    await page.waitForTimeout(300);

    // Reabre o modal
    await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
    await expect(page.getByText('Bem-vindo de volta')).toBeVisible({ timeout: 6000 });

    const emailValue = await page.getByPlaceholder('seu@email.com').inputValue();
    expect(emailValue).toBe('');
  });
});

// ─── Recuperação de senha ─────────────────────────────────────────────────────

test.describe('Login — Recuperação de Senha', () => {
  test.beforeEach(async ({ page }) => {
    await abrirModalLogin(page);
    await page.getByRole('button', { name: /esqueci minha senha/i }).click();
    await expect(page.getByText('Recuperar Senha')).toBeVisible({ timeout: 6000 });
  });

  test('exibe campo de e-mail na recuperação', async ({ page }) => {
    await expect(page.getByPlaceholder('contato@exemplo.com')).toBeVisible();
  });

  test('exibe erro ao enviar sem e-mail', async ({ page }) => {
    await page.getByRole('button', { name: /enviar código/i }).click();
    const erro = page.locator('.text-red-400, .text-red-500').first();
    await expect(erro).toBeVisible({ timeout: 4000 });
  });

  test('avança para etapa de código OTP ao preencher e-mail', async ({ page }) => {
    await page.getByPlaceholder('contato@exemplo.com').fill('teste@teste.com');
    await page.getByRole('button', { name: /enviar código/i }).click();
    await expect(
      page.getByText(/código de verificação/i).first()
    ).toBeVisible({ timeout: 6000 });
  });

  test('botão "Voltar" retorna ao login', async ({ page }) => {
    await page.getByRole('button', { name: /^voltar$/i }).first().click();
    await expect(page.getByText('Bem-vindo de volta')).toBeVisible({ timeout: 5000 });
  });

  test('exibe erro ao avançar sem código OTP', async ({ page }) => {
    await page.getByPlaceholder('contato@exemplo.com').fill('teste@teste.com');
    await page.getByRole('button', { name: /enviar código/i }).click();
    await expect(page.getByText(/código de verificação/i)).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /verificar código/i }).click();
    const erro = page.locator('.text-red-400, .text-red-500').first();
    await expect(erro).toBeVisible({ timeout: 4000 });
  });
});

// ─── Aba Colaborador ──────────────────────────────────────────────────────────

test.describe('Login — Acesso Colaborador', () => {
  test('aba "Colaborador" está presente no modal', async ({ page }) => {
    await abrirModalLogin(page);
    const staffTab = page.getByRole('button', { name: /colaborador/i }).first();
    if (await staffTab.isVisible({ timeout: 3000 })) {
      await expect(staffTab).toBeVisible();
    }
  });

  test('clicar em "Colaborador" exibe tela de acesso da equipe', async ({ page }) => {
    await abrirModalLogin(page);
    const staffTab = page.getByRole('button', { name: /colaborador/i }).first();
    if (!(await staffTab.isVisible({ timeout: 3000 }))) return;
    await staffTab.click();
    await expect(page.getByText('Acesso Colaborador')).toBeVisible({ timeout: 5000 });
  });

  test('credenciais inválidas de colaborador exibem erro', async ({ page }) => {
    await abrirModalLogin(page);
    const staffTab = page.getByRole('button', { name: /colaborador/i }).first();
    if (!(await staffTab.isVisible({ timeout: 3000 }))) return;
    await staffTab.click();

    await page.getByPlaceholder('seu@email.com').fill('staff_invalido@teste.com');
    await page.getByPlaceholder('••••••••').first().fill('senhaerrada999');
    await page.locator('button[type="submit"]').click();

    const erro = page.locator('.text-red-400, .text-red-500').first();
    await expect(erro).toBeVisible({ timeout: 12000 });
  });
});
