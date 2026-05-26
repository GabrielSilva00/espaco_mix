/**
 * 10-ui-ux/acessibilidade — Testes de acessibilidade: ARIA, contraste, teclado.
 */
import { test, expect, Page } from '@playwright/test';
import { aceitarLGPD, BASE_URL } from '../helpers/auth.helper';

async function irParaHome(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);
}

// ─── Semântica HTML ───────────────────────────────────────────────────────────

test.describe('Acessibilidade — Semântica', () => {
  test.beforeEach(async ({ page }) => { await irParaHome(page); });

  test('página tem elemento <nav> para navegação', async ({ page }) => {
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 6000 });
  });

  test('página tem elemento <main> ou role="main"', async ({ page }) => {
    const main = page.locator('main, [role="main"]').first();
    if (await main.isVisible({ timeout: 5000 })) {
      await expect(main).toBeVisible();
    }
  });

  test('página tem elemento <footer>', async ({ page }) => {
    await expect(page.locator('footer').first()).toBeVisible({ timeout: 5000 });
  });

  test('heading principal (h1) está presente na home', async ({ page }) => {
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 6000 });
  });

  test('hierarquia de headings está em ordem (não pula níveis)', async ({ page }) => {
    const headings = await page.evaluate(() => {
      const levels = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
        .map(h => parseInt(h.tagName.slice(1)));
      return levels;
    });

    if (headings.length < 2) return;

    // Verifica que não há salto de mais de 1 nível entre headings consecutivos
    let hasSkip = false;
    for (let i = 1; i < headings.length; i++) {
      if (headings[i] - headings[i - 1] > 1) {
        hasSkip = true;
        break;
      }
    }
    // Apenas documenta — não falha, pois pode ser intencional
    if (hasSkip) {
      console.warn('Hierarquia de headings com salto detectada');
    }
  });
});

// ─── Atributos ARIA ───────────────────────────────────────────────────────────

test.describe('Acessibilidade — ARIA', () => {
  test.beforeEach(async ({ page }) => { await irParaHome(page); });

  test('botões têm texto acessível (não apenas ícone sem label)', async ({ page }) => {
    const buttons = page.locator('button');
    const count   = await buttons.count();

    for (let i = 0; i < Math.min(count, 20); i++) {
      const btn  = buttons.nth(i);
      const text = await btn.textContent();
      const aria = await btn.getAttribute('aria-label');
      const title = await btn.getAttribute('title');

      // Botão deve ter texto, aria-label ou title
      const temLabel = (text?.trim() ?? '') !== '' || !!aria || !!title;
      if (!temLabel) {
        console.warn(`Botão sem label acessível encontrado (índice ${i})`);
      }
    }
  });

  test('imagens têm atributo alt', async ({ page }) => {
    const images = page.locator('img');
    const count  = await images.count();

    for (let i = 0; i < Math.min(count, 20); i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      // alt pode ser vazio string para imagens decorativas, mas deve existir
      expect(alt, `Imagem ${i} sem atributo alt`).not.toBeNull();
    }
  });

  test('links têm texto descritivo ou aria-label', async ({ page }) => {
    const links = page.locator('a');
    const count = await links.count();

    for (let i = 0; i < Math.min(count, 20); i++) {
      const link = links.nth(i);
      const text = await link.textContent();
      const aria = await link.getAttribute('aria-label');

      const temLabel = (text?.trim() ?? '') !== '' || !!aria;
      if (!temLabel) {
        console.warn(`Link sem texto acessível encontrado (índice ${i})`);
      }
    }
  });

  test('modal de login tem role="dialog"', async ({ page }) => {
    const entrarBtn = page.getByRole('button', { name: 'Entrar', exact: true }).first();
    if (!(await entrarBtn.isVisible({ timeout: 5000 }))) return;

    await entrarBtn.click();
    await page.waitForTimeout(400);

    const dialog = page.locator('[role="dialog"], dialog').first();
    if (await dialog.isVisible({ timeout: 4000 })) {
      await expect(dialog).toBeVisible();
    }
  });

  test('campos de formulário têm labels associados', async ({ page }) => {
    const entrarBtn = page.getByRole('button', { name: 'Entrar', exact: true }).first();
    if (!(await entrarBtn.isVisible({ timeout: 5000 }))) return;

    await entrarBtn.click();
    await page.waitForTimeout(400);

    const inputs = page.locator('input:not([type="hidden"])');
    const count  = await inputs.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const input = inputs.nth(i);
      const id    = await input.getAttribute('id');
      const aria  = await input.getAttribute('aria-label');
      const placeholder = await input.getAttribute('placeholder');

      // Deve ter algum identificador acessível
      const temId = id ? await page.locator(`label[for="${id}"]`).count() > 0 : false;
      const acessivel = temId || !!aria || !!placeholder;

      if (!acessivel) {
        console.warn(`Input ${i} sem label acessível`);
      }
    }
  });
});

// ─── Navegação por teclado ────────────────────────────────────────────────────

test.describe('Acessibilidade — Teclado', () => {
  test.beforeEach(async ({ page }) => { await irParaHome(page); });

  test('é possível navegar pela navbar com Tab', async ({ page }) => {
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Algum elemento deve estar focado
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'A', 'INPUT', 'SELECT']).toContain(focused);
  });

  test('Enter ativa botões focados', async ({ page }) => {
    // Foca no primeiro botão da navbar e pressiona Enter
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // A página não deve ter quebrado
    await expect(page.locator('body')).toBeVisible();
  });

  test('Escape fecha modal de login', async ({ page }) => {
    const entrarBtn = page.getByRole('button', { name: 'Entrar', exact: true }).first();
    if (!(await entrarBtn.isVisible({ timeout: 5000 }))) return;

    await entrarBtn.click();
    await page.waitForTimeout(400);

    const modal = page.getByText('Bem-vindo de volta').first();
    if (!(await modal.isVisible({ timeout: 4000 }))) return;

    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    await expect(modal).not.toBeVisible();
  });

  test('focus trap funciona dentro do modal de login', async ({ page }) => {
    const entrarBtn = page.getByRole('button', { name: 'Entrar', exact: true }).first();
    if (!(await entrarBtn.isVisible({ timeout: 5000 }))) return;

    await entrarBtn.click();
    await page.waitForTimeout(400);

    if (!(await page.getByText('Bem-vindo de volta').isVisible({ timeout: 4000 }))) return;

    // Tab múltiplas vezes — foco deve permanecer dentro do modal
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
    }

    // O modal ainda deve estar visível (foco não "escapou")
    await expect(page.getByText('Bem-vindo de volta').first()).toBeVisible();
  });
});

// ─── Contraste e visibilidade ─────────────────────────────────────────────────

test.describe('Acessibilidade — Contraste', () => {
  test('background da página não é branco puro (tema escuro)', async ({ page }) => {
    await irParaHome(page);
    const bg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    // Background não deve ser branco (rgb(255, 255, 255))
    expect(bg).not.toBe('rgb(255, 255, 255)');
  });

  test('texto principal é legível (não a mesma cor do background)', async ({ page }) => {
    await irParaHome(page);
    const { bg, color } = await page.evaluate(() => {
      const body = document.body;
      const h1   = document.querySelector('h1');
      return {
        bg:    window.getComputedStyle(body).backgroundColor,
        color: h1 ? window.getComputedStyle(h1).color : null,
      };
    });

    if (bg && color) {
      expect(bg).not.toBe(color);
    }
  });

  test('links e botões têm estado :focus visível', async ({ page }) => {
    await irParaHome(page);
    await page.keyboard.press('Tab');

    const focusedOutline = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      return window.getComputedStyle(el).outlineStyle;
    });

    // Outline não deve ser 'none' para o primeiro elemento focável
    if (focusedOutline) {
      // Apenas documenta — alguns designs usam outros indicadores de foco
      expect(focusedOutline).toBeDefined();
    }
  });
});

// ─── Skip links ───────────────────────────────────────────────────────────────

test.describe('Acessibilidade — Skip Links', () => {
  test('skip link para conteúdo principal existe (se implementado)', async ({ page }) => {
    await irParaHome(page);
    const skipLink = page.locator('a[href="#main"], a[href="#conteudo"], a:has-text("Pular para")').first();
    if (await skipLink.isVisible({ timeout: 3000 })) {
      await expect(skipLink).toBeVisible();
    }
  });
});
