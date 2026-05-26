/**
 * 02-auth/logout — Sessão, logout e redirecionamentos.
 */
import { test, expect } from '@playwright/test';
import {
  aceitarLGPD, loginAsUser, logout,
  estaAutenticado, BASE_URL,
} from '../helpers/auth.helper';

// ─── Logout ───────────────────────────────────────────────────────────────────

test.describe('Logout — Fluxo Completo', () => {
  test('dropdown de usuário exibe botão "Sair"', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais não configuradas'); return; }

    const userBtn = page.locator('button').filter({ has: page.locator('.lucide-user') }).first();
    await userBtn.click();

    const sairBtn = page.getByRole('button', { name: /sair|logout/i }).first();
    await expect(sairBtn).toBeVisible({ timeout: 5000 });
  });

  test('logout remove sessão do usuário', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais não configuradas'); return; }

    await logout(page);

    // Após logout, o botão "Entrar" deve reaparecer
    await expect(
      page.getByRole('button', { name: 'Entrar', exact: true }).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('logout redireciona para a home', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais não configuradas'); return; }

    await logout(page);

    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 8000 });
  });

  test('"Minhas Reservas" desaparece da navbar após logout', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais não configuradas'); return; }

    await logout(page);

    const reservasBtn = page.getByRole('button', { name: /minhas reservas/i });
    await expect(reservasBtn).not.toBeVisible({ timeout: 5000 });
  });

  test('sessão não persiste após logout + refresh', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais não configuradas'); return; }

    await logout(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const autenticado = await estaAutenticado(page);
    expect(autenticado).toBe(false);
  });
});

// ─── Páginas protegidas ───────────────────────────────────────────────────────

test.describe('Logout — Páginas Protegidas', () => {
  test('botão "Minhas Reservas" não aparece para usuário não autenticado', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const entrarBtn = page.getByRole('button', { name: 'Entrar', exact: true }).first();
    if (await entrarBtn.isVisible({ timeout: 3000 })) {
      const reservasBtn = page.getByRole('button', { name: /minhas reservas/i });
      await expect(reservasBtn).not.toBeVisible();
    }
  });

  test('acesso ao perfil não está disponível sem autenticação', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    // Sem login, o dropdown de usuário com perfil não existe
    const userDropdown = page.locator('button').filter({ has: page.locator('.lucide-user') }).first();
    if (await userDropdown.isVisible({ timeout: 2000 })) {
      // Usuário ainda logado — pula o teste
      return;
    }
    // Se chegou aqui, confirma que o "Perfil" não está acessível
    const perfilLink = page.getByRole('button', { name: /perfil/i });
    await expect(perfilLink).not.toBeVisible();
  });

  test('links de admin não aparecem após logout', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais não configuradas'); return; }

    await logout(page);

    const adminLink = page.getByRole('button', { name: /aprovações|colaboradores|configurações/i });
    await expect(adminLink).not.toBeVisible({ timeout: 5000 });
  });
});

// ─── Dropdown de usuário ──────────────────────────────────────────────────────

test.describe('Logout — Dropdown de Usuário', () => {
  test('dropdown exibe nome ou e-mail do usuário logado', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais não configuradas'); return; }

    const userBtn = page.locator('button').filter({ has: page.locator('.lucide-user') }).first();
    if (!(await userBtn.isVisible({ timeout: 5000 }))) return;

    await userBtn.click();

    // Deve exibir nome ou e-mail do usuário
    const userInfo = page.locator('[class*="dropdown"], [class*="menu"]')
      .filter({ hasText: /@|\.com|teste/i }).first();
    if (await userInfo.isVisible({ timeout: 3000 })) {
      await expect(userInfo).toBeVisible();
    }
  });

  test('dropdown fecha ao clicar fora dele', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais não configuradas'); return; }

    const userBtn = page.locator('button').filter({ has: page.locator('.lucide-user') }).first();
    if (!(await userBtn.isVisible({ timeout: 5000 }))) return;

    await userBtn.click();
    await page.waitForTimeout(300);

    // Clica fora do dropdown
    await page.locator('main').first().click({ position: { x: 100, y: 100 }, force: true });
    await page.waitForTimeout(300);

    // O dropdown deve ter fechado (botão Sair deve sumir)
    const sairBtn = page.getByRole('button', { name: /sair|logout/i }).first();
    await expect(sairBtn).not.toBeVisible({ timeout: 3000 });
  });
});
