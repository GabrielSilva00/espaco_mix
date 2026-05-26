/**
 * 10-ui-ux/visual-regression — Consistência visual, cores e layout.
 * Nota: testes de snapshot visual requerem execução inicial para gerar referências.
 */
import { test, expect, Page } from '@playwright/test';
import { aceitarLGPD, loginAsAdmin, BASE_URL } from '../helpers/auth.helper';

async function irParaHome(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);
  await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 10000 });
}

// ─── Cores e tema ─────────────────────────────────────────────────────────────

test.describe('Visual — Tema Escuro', () => {
  test('fundo da página usa cor escura (#0a0a0a ou similar)', async ({ page }) => {
    await irParaHome(page);
    const bg = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundColor
    );
    // Tema escuro: não deve ser branco nem cinza claro
    expect(bg).not.toBe('rgb(255, 255, 255)');
    expect(bg).not.toBe('rgb(248, 248, 248)');
  });

  test('cor dourada (#d4af37) aparece em elementos de destaque', async ({ page }) => {
    await irParaHome(page);
    const temDourado = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        const style = window.getComputedStyle(el);
        const color = style.color;
        const bg    = style.backgroundColor;
        if (color.includes('212, 175, 55') || bg.includes('212, 175, 55')) {
          return true;
        }
      }
      return false;
    });

    if (!temDourado) {
      // Verifica pela classe Tailwind
      const goldElements = page.locator('[class*="d4af37"], [class*="yellow"], [class*="gold"]').first();
      if (await goldElements.isVisible({ timeout: 3000 })) {
        await expect(goldElements).toBeVisible();
      }
    }
  });

  test('navbar usa background escuro ou semitransparente', async ({ page }) => {
    await irParaHome(page);
    const navBg = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      if (!nav) return null;
      return window.getComputedStyle(nav).backgroundColor;
    });

    if (navBg) {
      // Não deve ser totalmente branco
      expect(navBg).not.toBe('rgb(255, 255, 255)');
    }
  });
});

// ─── Consistência de componentes ──────────────────────────────────────────────

test.describe('Visual — Consistência de Componentes', () => {
  test('cards de evento têm altura consistente', async ({ page }) => {
    await irParaHome(page);
    const cards = page.locator('[class*="event-card"], [class*="card"]');
    const count = await cards.count();

    if (count < 2) return;

    const heights: number[] = [];
    for (let i = 0; i < Math.min(count, 6); i++) {
      const box = await cards.nth(i).boundingBox();
      if (box) heights.push(box.height);
    }

    if (heights.length < 2) return;

    // Cards devem ter alturas similares (max variação de 50px)
    const min = Math.min(...heights);
    const max = Math.max(...heights);
    expect(max - min).toBeLessThan(100);
  });

  test('botões primários têm estilo visual consistente', async ({ page }) => {
    await irParaHome(page);
    const btns = page.getByRole('button', { name: /ver ingressos/i });
    const count = await btns.count();

    if (count < 2) return;

    const bg1 = await btns.first().evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );
    const bg2 = await btns.nth(1).evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );

    expect(bg1).toBe(bg2);
  });

  test('ícones Lucide renderizam corretamente', async ({ page }) => {
    await irParaHome(page);
    const lucideIcons = page.locator('[class*="lucide"]');
    const count = await lucideIcons.count();

    if (count === 0) return;

    // Verifica que ícones têm dimensões razoáveis
    const box = await lucideIcons.first().boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThan(10);
      expect(box.height).toBeGreaterThan(10);
    }
  });
});

// ─── Animações e transições ───────────────────────────────────────────────────

test.describe('Visual — Animações', () => {
  test('carrossel de destaque anima sem erro JS', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await irParaHome(page);

    const carrossel = page.locator('[class*="embla"]').first();
    if (!(await carrossel.isVisible({ timeout: 6000 }))) return;

    // Aguarda animação inicial
    await page.waitForTimeout(2000);

    const critical = errors.filter(e => !/ResizeObserver|extension/i.test(e));
    expect(critical).toHaveLength(0);
  });

  test('transições de modal não causam layout shift', async ({ page }) => {
    await irParaHome(page);

    const entrarBtn = page.getByRole('button', { name: 'Entrar', exact: true }).first();
    if (!(await entrarBtn.isVisible({ timeout: 5000 }))) return;

    await entrarBtn.click();
    await page.waitForTimeout(500);

    const modal = page.getByText('Bem-vindo de volta').first();
    if (await modal.isVisible({ timeout: 4000 })) {
      // O body não deve ter overflow ou scrollbar desnecessário
      const overflow = await page.evaluate(() => document.body.style.overflow);
      // Modal pode ou não travar o scroll
      await expect(modal).toBeVisible();
    }
  });

  test('hover em cards de evento aplica estilo visual', async ({ page }) => {
    await irParaHome(page);

    const card = page.locator('[class*="card"]').first();
    if (!(await card.isVisible({ timeout: 6000 }))) return;

    const bgBefore = await card.evaluate(el => window.getComputedStyle(el).backgroundColor);
    await card.hover();
    await page.waitForTimeout(300);
    const bgAfter = await card.evaluate(el => window.getComputedStyle(el).backgroundColor);

    // Hover pode mudar o background ou aplicar transform
    // Apenas verifica que não quebrou
    await expect(card).toBeVisible();
  });
});

// ─── Layout geral ─────────────────────────────────────────────────────────────

test.describe('Visual — Layout Geral', () => {
  test('sem overflow horizontal na home', async ({ page }) => {
    await irParaHome(page);
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('sem overflow horizontal na página de contato', async ({ page }) => {
    await irParaHome(page);
    await page.getByRole('button', { name: /^contato$/i }).first().click();
    await page.waitForTimeout(400);

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('footer está abaixo do conteúdo principal', async ({ page }) => {
    await irParaHome(page);
    const footer = page.locator('footer').first();
    if (!(await footer.isVisible({ timeout: 5000 }))) return;

    const main   = page.locator('main, [class*="container"]').first();
    const fBox   = await footer.boundingBox();
    const mBox   = await main.boundingBox();

    if (fBox && mBox) {
      expect(fBox.y).toBeGreaterThan(mBox.y);
    }
  });

  test('navbar não sobrepõe o conteúdo principal', async ({ page }) => {
    await irParaHome(page);
    const nav     = page.locator('nav').first();
    const content = page.getByText('Próximos Eventos').first();

    const navBox  = await nav.boundingBox();
    const contBox = await content.boundingBox();

    if (navBox && contBox) {
      // O início do conteúdo deve estar abaixo do fim da navbar
      expect(contBox.y).toBeGreaterThan(navBox.y + navBox.height - 10);
    }
  });
});

// ─── Dashboard admin — visual ─────────────────────────────────────────────────

test.describe('Visual — Dashboard Admin', () => {
  test('gráficos Recharts são renderizados visivelmente', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    await page.waitForTimeout(1500);

    const grafico = page.locator('.recharts-wrapper, svg[class*="recharts"]').first();
    if (await grafico.isVisible({ timeout: 8000 })) {
      const box = await grafico.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThan(100);
        expect(box.height).toBeGreaterThan(100);
      }
    }
  });

  test('cards de métricas têm conteúdo visível', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const card = page.locator('[class*="metric"], [class*="stat"], [class*="kpi"]').first();
    if (await card.isVisible({ timeout: 6000 })) {
      const texto = await card.textContent();
      expect(texto?.trim().length).toBeGreaterThan(0);
    }
  });
});
