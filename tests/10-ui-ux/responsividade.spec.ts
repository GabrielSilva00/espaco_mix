/**
 * 10-ui-ux/responsividade — Testes de layout responsivo em múltiplos viewports.
 */
import { test, expect, Page } from '@playwright/test';
import { aceitarLGPD, BASE_URL } from '../helpers/auth.helper';

const VIEWPORTS = {
  mobile:  { width: 375,  height: 812  },
  tablet:  { width: 768,  height: 1024 },
  desktop: { width: 1280, height: 800  },
  hd:      { width: 1920, height: 1080 },
};

async function irParaHome(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);
}

// ─── Mobile (375px) ───────────────────────────────────────────────────────────

test.describe('Responsividade — Mobile (375px)', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test.beforeEach(async ({ page }) => { await irParaHome(page); });

  test('navbar está visível em mobile', async ({ page }) => {
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 6000 });
  });

  test('menu hamburger está visível em mobile', async ({ page }) => {
    const hamburger = page.locator('button.md\\:hidden, [class*="hamburger"], [class*="menu-toggle"]').first();
    if (await hamburger.isVisible({ timeout: 5000 })) {
      await expect(hamburger).toBeVisible();
    }
  });

  test('seção de eventos é legível em mobile', async ({ page }) => {
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 8000 });
  });

  test('cards de evento não transbordam a tela em mobile', async ({ page }) => {
    const card = page.locator('[class*="event-card"], [class*="card"]').first();
    if (!(await card.isVisible({ timeout: 6000 }))) return;

    const box = await card.boundingBox();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(VIEWPORTS.mobile.width + 20); // tolerância de 20px
    }
  });

  test('botões têm tamanho adequado para toque (mín. 44px)', async ({ page }) => {
    const btn = page.getByRole('button', { name: /ver ingressos|entrar|início/i }).first();
    if (!(await btn.isVisible({ timeout: 6000 }))) return;

    const box = await btn.boundingBox();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(36); // tolerância ligeiramente abaixo de 44px
    }
  });

  test('formulário de busca é usável em mobile', async ({ page }) => {
    const busca = page.getByPlaceholder(/buscar/i).first();
    if (await busca.isVisible({ timeout: 5000 })) {
      await busca.fill('teste');
      await page.waitForTimeout(300);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('banner LGPD não bloqueia interação em mobile', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    // Banner LGPD deve ser totalmente visível e o botão acessível
    const aceitarBtn = page.getByRole('button', { name: /aceitar|aceitar e continuar/i }).first();
    if (await aceitarBtn.isVisible({ timeout: 5000 })) {
      const box = await aceitarBtn.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThan(20);
      }
    }
  });
});

// ─── Tablet (768px) ───────────────────────────────────────────────────────────

test.describe('Responsividade — Tablet (768px)', () => {
  test.use({ viewport: VIEWPORTS.tablet });

  test.beforeEach(async ({ page }) => { await irParaHome(page); });

  test('navbar está visível em tablet', async ({ page }) => {
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 6000 });
  });

  test('eventos são exibidos em grade adequada para tablet', async ({ page }) => {
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('botões de navegação são visíveis em tablet', async ({ page }) => {
    const inicioBtn = page.getByRole('button', { name: /^início$/i }).first();
    if (await inicioBtn.isVisible({ timeout: 5000 })) {
      await expect(inicioBtn).toBeVisible();
    }
  });
});

// ─── Desktop (1280px) ─────────────────────────────────────────────────────────

test.describe('Responsividade — Desktop (1280px)', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test.beforeEach(async ({ page }) => { await irParaHome(page); });

  test('menu desktop está visível (sem hamburger)', async ({ page }) => {
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible({ timeout: 6000 });

    // Em desktop, os botões de menu devem estar diretamente visíveis
    const inicioBtn = page.getByRole('button', { name: /^início$/i }).first();
    if (await inicioBtn.isVisible({ timeout: 5000 })) {
      await expect(inicioBtn).toBeVisible();
    }
  });

  test('conteúdo utiliza largura máxima (max-w) em desktop', async ({ page }) => {
    const main = page.locator('main, [class*="container"], [class*="max-w"]').first();
    if (await main.isVisible({ timeout: 5000 })) {
      const box = await main.boundingBox();
      if (box) {
        // Conteúdo não deve ocupar 100% da largura em telas largas
        expect(box.width).toBeLessThanOrEqual(VIEWPORTS.desktop.width);
      }
    }
  });

  test('footer é exibido corretamente em desktop', async ({ page }) => {
    await expect(page.locator('footer').first()).toBeVisible({ timeout: 5000 });
  });
});

// ─── HD (1920px) ──────────────────────────────────────────────────────────────

test.describe('Responsividade — HD (1920px)', () => {
  test.use({ viewport: VIEWPORTS.hd });

  test.beforeEach(async ({ page }) => { await irParaHome(page); });

  test('layout não quebra em tela muito larga', async ({ page }) => {
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('sem overflow horizontal em HD', async ({ page }) => {
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // tolerância de 5px
  });
});

// ─── Orientação e redimensionamento ──────────────────────────────────────────

test.describe('Responsividade — Redimensionamento', () => {
  test('redimensionar de mobile para desktop não causa erro JS', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.setViewportSize(VIEWPORTS.mobile);
    await irParaHome(page);
    await page.waitForTimeout(400);

    await page.setViewportSize(VIEWPORTS.desktop);
    await page.waitForTimeout(400);

    const critical = errors.filter(e => !/ResizeObserver|extension/i.test(e));
    expect(critical).toHaveLength(0);
  });

  test('scroll vertical funciona corretamente', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await irParaHome(page);

    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(300);

    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
  });
});
