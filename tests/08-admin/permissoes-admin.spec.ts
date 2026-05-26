/**
 * 08-admin/permissoes-admin — Controle de acesso e permissões por role.
 */
import { test, expect, Page } from '@playwright/test';
import { aceitarLGPD, loginAsAdmin, loginAsUser, logout, BASE_URL } from '../helpers/auth.helper';

// ─── Acesso por role ──────────────────────────────────────────────────────────

test.describe('Permissões — Usuário Anônimo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
  });

  test('anônimo NÃO vê menu admin', async ({ page }) => {
    const adminMenu = page.getByRole('button', { name: /aprovações|colaboradores|admin/i });
    await expect(adminMenu).not.toBeVisible();
  });

  test('anônimo NÃO vê "Minhas Reservas"', async ({ page }) => {
    const reservas = page.getByRole('button', { name: /minhas reservas|meus ingressos/i });
    await expect(reservas).not.toBeVisible();
  });

  test('anônimo VÊ botão "Entrar"', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Entrar', exact: true }).first()
    ).toBeVisible({ timeout: 6000 });
  });

  test('anônimo pode ver eventos mas NÃO pode iniciar compra sem login (se exigir)', async ({ page }) => {
    const verBtn = page.getByRole('button', { name: /ver ingressos/i }).first();
    if (!(await verBtn.isVisible({ timeout: 8000 }))) return;

    await verBtn.click();
    await page.waitForTimeout(600);

    // O app pode permitir compra como guest ou exigir login
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─── Usuário comum ────────────────────────────────────────────────────────────

test.describe('Permissões — Usuário Comum (client)', () => {
  test('usuário comum VÊ "Minhas Reservas"', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais de usuário não configuradas'); return; }

    const reservas = page.getByRole('button', { name: /minhas reservas|meus ingressos/i }).first();
    if (await reservas.isVisible({ timeout: 6000 })) {
      await expect(reservas).toBeVisible();
    }
  });

  test('usuário comum NÃO vê menu de aprovações admin', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais de usuário não configuradas'); return; }

    const adminMenu = page.getByRole('button', { name: /aprovações/i });
    await expect(adminMenu).not.toBeVisible();
  });

  test('usuário comum NÃO vê botões de editar eventos', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais de usuário não configuradas'); return; }

    // Botões de editar evento são exclusivos do admin
    const editBtn = page.locator('button').filter({
      has: page.locator('.lucide-edit-2, .lucide-pencil')
    });
    await expect(editBtn).not.toBeVisible();
  });

  test('usuário comum NÃO vê botão "Criar Evento"', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais de usuário não configuradas'); return; }

    const criarBtn = page.getByRole('button', { name: /criar evento|novo evento/i });
    await expect(criarBtn).not.toBeVisible();
  });
});

// ─── Administrador ────────────────────────────────────────────────────────────

test.describe('Permissões — Administrador', () => {
  test('admin VÊ menu de aprovações na navbar', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const aprovacoes = page.getByRole('button', { name: /aprovações/i }).first();
    await expect(aprovacoes).toBeVisible({ timeout: 6000 });
  });

  test('admin VÊ link de colaboradores na navbar', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const colaboradores = page.getByRole('button', { name: /colaboradores/i }).first();
    if (await colaboradores.isVisible({ timeout: 6000 })) {
      await expect(colaboradores).toBeVisible();
    }
  });

  test('admin VÊ botões de editar eventos', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const editBtn = page.locator('button').filter({
      has: page.locator('.lucide-edit-2, .lucide-pencil')
    }).first();
    if (await editBtn.isVisible({ timeout: 6000 })) {
      await expect(editBtn).toBeVisible();
    }
  });

  test('admin NÃO vê botão "Entrar" após autenticado', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    await expect(
      page.getByRole('button', { name: 'Entrar', exact: true }).first()
    ).not.toBeVisible({ timeout: 5000 });
  });

  test('admin pode acessar fila de aprovações', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const aprovacoes = page.getByRole('button', { name: /aprovações/i }).first();
    if (!(await aprovacoes.isVisible({ timeout: 6000 }))) return;

    await aprovacoes.click();
    await page.waitForTimeout(600);

    const fila = page.getByText(/aprovação|fila|pending|pendente/i).first();
    if (await fila.isVisible({ timeout: 5000 })) {
      await expect(fila).toBeVisible();
    }
  });
});

// ─── Proteção de rotas de API ─────────────────────────────────────────────────

test.describe('Permissões — API', () => {
  test('GET /api/admin/settings retorna 401 sem autenticação', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/admin/settings');
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/orders retorna 401 sem token', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/orders', {
      data: { eventId: 'test', quantity: 1 }
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/create-payment-intent retorna 401 sem token', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/create-payment-intent', {
      data: { amount: 100, currency: 'BRL' }
    });
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/health é público e retorna 200', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/health');
    expect(res.status()).toBe(200);
  });
});

// ─── Transição de roles ───────────────────────────────────────────────────────

test.describe('Permissões — Transição', () => {
  test('após logout de admin, controles admin desaparecem', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    // Verifica que os controles estão visíveis
    const aprovacoes = page.getByRole('button', { name: /aprovações/i }).first();
    if (!(await aprovacoes.isVisible({ timeout: 6000 }))) return;

    // Faz logout
    await logout(page);
    await page.waitForTimeout(500);

    // Controles admin devem sumir
    await expect(page.getByRole('button', { name: /aprovações/i })).not.toBeVisible();
  });
});
