import { Page, expect } from '@playwright/test';

export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
export const API_URL  = process.env.API_URL  ?? 'http://localhost:3000';

// ─── Credenciais via variáveis de ambiente ────────────────────────────────────
const USERS = {
  comum: {
    email:    process.env.TEST_USER_EMAIL    ?? 'user@teste.com',
    password: process.env.TEST_USER_PASSWORD ?? 'Senha@12345',
    name:     'Usuário Teste',
  },
  admin: {
    email:    process.env.TEST_ADMIN_EMAIL    ?? 'admin@teste.com',
    password: process.env.TEST_ADMIN_PASSWORD ?? 'Admin@12345',
    name:     'Admin Teste',
  },
  dev: {
    email:    process.env.TEST_DEV_EMAIL    ?? 'dev@teste.com',
    password: process.env.TEST_DEV_PASSWORD ?? 'Dev@12345',
    name:     'Dev Teste',
  },
} as const;

// ─── Banner LGPD ──────────────────────────────────────────────────────────────
/**
 * Aceita o banner LGPD se estiver presente.
 * Silencioso se já aceito ou ausente.
 */
export async function aceitarLGPD(page: Page): Promise<void> {
  try {
    const btn = page.getByRole('button', { name: 'Aceitar e Continuar' });
    await btn.waitFor({ state: 'visible', timeout: 2500 });
    await btn.click();
  } catch {
    // Banner não exibido — nada a fazer
  }
}

// ─── Abertura do modal de autenticação ───────────────────────────────────────
/**
 * Navega para a home, aceita LGPD e abre o modal de auth na aba Login.
 */
export async function abrirModalLogin(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);
  await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
  await expect(page.getByText('Bem-vindo de volta')).toBeVisible({ timeout: 8000 });
}

// ─── Login genérico ────────────────────────────────────────────────────────────
/**
 * Realiza login via modal de autenticação.
 * Retorna true se o login foi bem-sucedido, false se falhou.
 */
export async function loginAsUser(
  page: Page,
  email    = USERS.comum.email,
  password = USERS.comum.password,
): Promise<boolean> {
  await abrirModalLogin(page);

  await page.getByPlaceholder('seu@email.com').fill(email);
  await page.getByPlaceholder('••••••••').first().fill(password);
  await page.locator('button[type="submit"]').click();

  try {
    // Sucesso: o modal fecha e o dropdown de usuário aparece
    await expect(
      page.locator('button').filter({ has: page.locator('.lucide-user') }).first()
    ).toBeVisible({ timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Realiza login como administrador.
 * Retorna true se autenticado com role admin, false caso contrário.
 */
export async function loginAsAdmin(page: Page): Promise<boolean> {
  const ok = await loginAsUser(page, USERS.admin.email, USERS.admin.password);
  if (!ok) return false;

  // Admin deve ter links de aprovações ou colaboradores na navbar
  const sinal = page.getByRole('button', { name: /aprovações|colaboradores/i }).first();
  return sinal.isVisible({ timeout: 5000 });
}

/**
 * Realiza login como desenvolvedor.
 * Retorna true se autenticado com role dev, false caso contrário.
 */
export async function loginAsDev(page: Page): Promise<boolean> {
  const ok = await loginAsUser(page, USERS.dev.email, USERS.dev.password);
  if (!ok) return false;

  // Dev deve ter algum indicador específico (ex: "Developer" na navbar ou perfil)
  const sinal = page.getByText(/developer|desenvolvedor|dev panel/i).first();
  return sinal.isVisible({ timeout: 5000 });
}

// ─── Logout ───────────────────────────────────────────────────────────────────
/**
 * Realiza logout via dropdown de usuário.
 */
export async function logout(page: Page): Promise<void> {
  const userBtn = page.locator('button').filter({ has: page.locator('.lucide-user') }).first();
  if (await userBtn.isVisible({ timeout: 3000 })) {
    await userBtn.click();
    const sairBtn = page.getByRole('button', { name: /sair|logout/i }).first();
    if (await sairBtn.isVisible({ timeout: 2000 })) {
      await sairBtn.click();
      await page.waitForTimeout(500);
    }
  }
}

// ─── Toast ────────────────────────────────────────────────────────────────────
/**
 * Aguarda um toast de notificação aparecer.
 * Se `message` fornecido, verifica também o texto.
 */
export async function waitForToast(
  page:    Page,
  message?: string | RegExp,
  timeout  = 8000,
): Promise<void> {
  const toast = message
    ? page.getByText(message).first()
    : page.locator('[class*="toast"], [class*="fixed"][class*="z-"]').filter({ hasText: /\w/ }).last();

  await expect(toast).toBeVisible({ timeout });
}

// ─── Verificação de autenticação ──────────────────────────────────────────────
/**
 * Retorna true se existe um usuário autenticado (dropdown visível na navbar).
 */
export async function estaAutenticado(page: Page): Promise<boolean> {
  const dropdown = page.locator('button').filter({ has: page.locator('.lucide-user') }).first();
  return dropdown.isVisible({ timeout: 2000 });
}

export { USERS };
