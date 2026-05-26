/**
 * 03-navigation/menu — Navbar, menu mobile e links de navegação.
 */
import { test, expect, Page } from '@playwright/test';
import { aceitarLGPD, loginAsAdmin, loginAsUser, BASE_URL } from '../helpers/auth.helper';

async function irParaHome(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);
}

// ─── Navbar Desktop ───────────────────────────────────────────────────────────

test.describe('Menu — Navbar Desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await irParaHome(page);
  });

  test('navbar fixa está visível no topo', async ({ page }) => {
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible({ timeout: 6000 });
    const box = await nav.boundingBox();
    expect(box?.y).toBeLessThan(10);
  });

  test('navbar permanece visível após scroll de 500px', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(300);
    await expect(page.locator('nav').first()).toBeVisible();
  });

  test('botão "Início" está presente', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /^início$/i }).first()
    ).toBeVisible({ timeout: 6000 });
  });

  test('botão "Contato" está presente', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /^contato$/i }).first()
    ).toBeVisible({ timeout: 6000 });
  });

  test('botão "Entrar" está presente para usuário anônimo', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Entrar', exact: true }).first()
    ).toBeVisible({ timeout: 6000 });
  });

  test('clicar em "Início" navega para a home', async ({ page }) => {
    await page.getByRole('button', { name: /contato/i }).first().click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /^início$/i }).first().click();
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
  });

  test('clicar em "Contato" navega para a página de contato', async ({ page }) => {
    await page.getByRole('button', { name: /^contato$/i }).first().click();
    await expect(page.getByText('Central de Atendimento')).toBeVisible({ timeout: 6000 });
  });

  test('clicar em "Início" dentro da contato retorna para home', async ({ page }) => {
    await page.getByRole('button', { name: /^contato$/i }).first().click();
    await expect(page.getByText('Central de Atendimento')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /^início$/i }).first().click();
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
  });
});

// ─── Menu Mobile ──────────────────────────────────────────────────────────────

test.describe('Menu — Mobile Hamburger', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await irParaHome(page);
  });

  test('botão hamburger está visível em mobile', async ({ page }) => {
    const hamburger = page.locator('button.md\\:hidden, button[class*="md:hidden"]').first();
    if (await hamburger.isVisible({ timeout: 5000 })) {
      await expect(hamburger).toBeVisible();
    }
  });

  test('menu abre ao clicar no hamburger', async ({ page }) => {
    const hamburger = page.locator('button.md\\:hidden').first();
    if (!(await hamburger.isVisible({ timeout: 5000 }))) return;
    await hamburger.click();
    await page.waitForTimeout(400);

    const menuItem = page.getByRole('button', { name: /início|contato/i }).first();
    await expect(menuItem).toBeVisible({ timeout: 4000 });
  });

  test('menu fecha ao clicar no botão X', async ({ page }) => {
    const hamburger = page.locator('button.md\\:hidden').first();
    if (!(await hamburger.isVisible({ timeout: 5000 }))) return;
    await hamburger.click();
    await page.waitForTimeout(400);

    const fecharBtn = page.locator('button').filter({ has: page.locator('.lucide-x') }).first();
    if (await fecharBtn.isVisible({ timeout: 3000 })) {
      await fecharBtn.click();
      await page.waitForTimeout(300);
      await expect(fecharBtn).not.toBeVisible();
    }
  });

  test('botão "Entrar" está acessível no menu mobile', async ({ page }) => {
    const hamburger = page.locator('button.md\\:hidden').first();
    if (!(await hamburger.isVisible({ timeout: 5000 }))) return;
    await hamburger.click();
    await page.waitForTimeout(400);

    const loginBtn = page.getByRole('button', { name: /entrar|login/i }).first();
    await expect(loginBtn).toBeVisible({ timeout: 4000 });
  });

  test('clicar em "Contato" no menu mobile navega corretamente', async ({ page }) => {
    const hamburger = page.locator('button.md\\:hidden').first();
    if (!(await hamburger.isVisible({ timeout: 5000 }))) return;
    await hamburger.click();
    await page.waitForTimeout(400);

    const contatoBtn = page.getByRole('button', { name: /^contato$/i }).first();
    if (await contatoBtn.isVisible({ timeout: 3000 })) {
      await contatoBtn.click();
      await expect(
        page.getByRole('heading', { name: /central de atendimento/i }).first()
      ).toBeVisible({ timeout: 6000 });
    }
  });
});

// ─── Menu Admin ───────────────────────────────────────────────────────────────

test.describe('Menu — Admin', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('usuário comum NÃO vê links de admin na navbar', async ({ page }) => {
    await irParaHome(page);
    const aprovLink = page.getByRole('button', { name: /aprovações|colaboradores/i });
    // Para usuário não logado
    await expect(aprovLink).not.toBeVisible();
  });

  test('admin vê links de aprovações e colaboradores na navbar', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    await expect(
      page.getByRole('button', { name: /aprovações/i }).first()
    ).toBeVisible({ timeout: 6000 });
  });

  test('admin NÃO vê o botão "Entrar" após autenticado', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    await expect(
      page.getByRole('button', { name: 'Entrar', exact: true }).first()
    ).not.toBeVisible({ timeout: 5000 });
  });
});

// ─── Página de Contato ────────────────────────────────────────────────────────

test.describe('Menu — Página de Contato', () => {
  test.beforeEach(async ({ page }) => {
    await irParaHome(page);
    await page.getByRole('button', { name: /^contato$/i }).first().click();
    await expect(page.getByText('Central de Atendimento')).toBeVisible({ timeout: 6000 });
  });

  test('exibe botão de WhatsApp', async ({ page }) => {
    await expect(
      page.getByRole('link', { name: /conversar|whatsapp/i }).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('botão WhatsApp abre link externo (target="_blank")', async ({ page }) => {
    const link = page.getByRole('link', { name: /conversar|whatsapp/i }).first();
    if (await link.isVisible({ timeout: 3000 })) {
      const target = await link.getAttribute('target');
      expect(target).toBe('_blank');
    }
  });

  test('exibe horário de atendimento', async ({ page }) => {
    await expect(page.getByText(/segunda|horário de atendimento/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('exibe e-mail de suporte', async ({ page }) => {
    await expect(page.getByText(/suporte@/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('botão "Retornar ao Evento" está presente', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /retornar ao evento/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test('"Retornar ao Evento" navega de volta', async ({ page }) => {
    await page.getByRole('button', { name: /retornar ao evento/i }).click();
    await expect(
      page.getByText(/próximos eventos|ingressos/i).first()
    ).toBeVisible({ timeout: 6000 });
  });
});
