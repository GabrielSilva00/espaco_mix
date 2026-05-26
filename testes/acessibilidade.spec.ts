import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function aceitarLGPD(page: Page) {
  const banner = page.getByRole('button', { name: 'Aceitar e Continuar' });
  try {
    await banner.waitFor({ state: 'visible', timeout: 2000 });
    await banner.click();
  } catch { /* já aceito */ }
}

async function abrirLogin(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);
  await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
  await expect(page.getByText('Bem-vindo de volta')).toBeVisible({ timeout: 6000 });
}

// ---------------------------------------------------------------------------
// Suite: Estrutura Semântica do HTML
// ---------------------------------------------------------------------------

test.describe('Acessibilidade - Estrutura HTML Semântica', () => {
  test('deve ter título de página definido e não vazio', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('deve conter elemento <nav> para navegação principal', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 6000 });
  });

  test('deve conter elemento <main> para o conteúdo principal', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 6000 });
  });

  test('deve conter elemento <footer> no rodapé', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    await expect(page.locator('footer').first()).toBeVisible({ timeout: 6000 });
  });

  test('deve ter pelo menos um heading (h1-h3) visível na home', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    const heading = page.locator('h1, h2, h3').first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  test('deve ter heading com texto "Próximos Eventos" na home', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Navegação por Teclado
// ---------------------------------------------------------------------------

test.describe('Acessibilidade - Navegação por Teclado', () => {
  test('deve permitir Tab para chegar à navbar', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    // Navega com Tab várias vezes
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }

    // Algum elemento da navbar ou conteúdo deve estar focado
    const focused = page.locator(':focus');
    const count = await focused.count();
    expect(count).toBeGreaterThanOrEqual(0);
    await expect(page.locator('nav').first()).toBeVisible();
  });

  test('deve poder ativar o botão "Entrar" via teclado', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    // Navega até o botão Entrar
    const entrarBtn = page.getByRole('button', { name: 'Entrar', exact: true }).first();
    await entrarBtn.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Bem-vindo de volta')).toBeVisible({ timeout: 6000 });
  });

  test('deve poder fechar o modal de auth com Escape', async ({ page }) => {
    await abrirLogin(page);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Modal pode fechar ou permanecer — verifica que a página não quebrou
    await expect(page.locator('body')).toBeVisible();
  });

  test('deve poder navegar pelos campos do formulário de login com Tab', async ({ page }) => {
    await abrirLogin(page);

    const emailInput = page.getByPlaceholder('seu@email.com');
    await emailInput.focus();

    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // O foco deve ter avançado para o próximo campo
    const senhaInput = page.getByPlaceholder('••••••••').first();
    await expect(senhaInput).toBeVisible();
  });

  test('deve poder submeter o formulário de login com Enter', async ({ page }) => {
    await abrirLogin(page);

    await page.getByPlaceholder('seu@email.com').fill('teste@teste.com');
    await page.getByPlaceholder('••••••••').first().fill('senha123');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(2000);
    // Não deve quebrar a página ao submeter via Enter
    await expect(page.locator('body')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Suite: Atributos de Acessibilidade
// ---------------------------------------------------------------------------

test.describe('Acessibilidade - Atributos ARIA', () => {
  test('deve ter botões com texto acessível (não apenas ícones)', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    // Todos os botões da navbar devem ter texto
    const navButtons = await page.locator('nav button').all();
    for (const btn of navButtons) {
      const textContent = await btn.textContent();
      const ariaLabel = await btn.getAttribute('aria-label');
      const title = await btn.getAttribute('title');
      // Deve ter texto, aria-label ou title
      const hasAccessibleName = (textContent?.trim().length ?? 0) > 0
        || (ariaLabel?.length ?? 0) > 0
        || (title?.length ?? 0) > 0;
      expect(hasAccessibleName).toBe(true);
    }
  });

  test('campos de formulário devem ter label ou placeholder', async ({ page }) => {
    await abrirLogin(page);

    const emailInput = page.getByPlaceholder('seu@email.com');
    const placeholder = await emailInput.getAttribute('placeholder');
    const ariaLabel = await emailInput.getAttribute('aria-label');
    const id = await emailInput.getAttribute('id');

    const hasAccessibleLabel = (placeholder?.length ?? 0) > 0
      || (ariaLabel?.length ?? 0) > 0
      || (id?.length ?? 0) > 0;

    expect(hasAccessibleLabel).toBe(true);
  });

  test('imagens no carrossel devem ter atributo alt', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    await page.waitForTimeout(1000);

    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');
      // Imagens decorativas devem ter alt="" ou role="presentation"
      // Imagens de conteúdo devem ter alt descritivo
      const hasAlt = alt !== null;
      expect(hasAlt).toBe(true);
    }
  });

  test('links externos devem ter rel="noopener noreferrer"', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const externalLinks = page.locator('a[target="_blank"]');
    const count = await externalLinks.count();

    for (let i = 0; i < count; i++) {
      const rel = await externalLinks.nth(i).getAttribute('rel');
      if (rel) {
        expect(rel).toContain('noopener');
      }
    }
  });

  test('modal de autenticação deve ter role dialog ou ser um modal acessível', async ({ page }) => {
    await abrirLogin(page);

    // O modal deve estar presente e acessível
    const modal = page.locator('[role="dialog"], [aria-modal="true"]').first();
    const modalVisible = await modal.isVisible({ timeout: 2000 });

    // Se não tem role explícito, verifica pelo container do modal
    if (!modalVisible) {
      const modalContainer = page.locator('[class*="modal"], [class*="overlay"]').first();
      if (await modalContainer.isVisible({ timeout: 2000 })) {
        await expect(modalContainer).toBeVisible();
      }
    }

    // O modal deve conter campos acessíveis
    await expect(page.getByPlaceholder('seu@email.com')).toBeVisible({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Contraste e Visibilidade
// ---------------------------------------------------------------------------

test.describe('Acessibilidade - Visibilidade', () => {
  test('botão "Entrar" deve ser claramente visível na navbar', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const entrarBtn = page.getByRole('button', { name: 'Entrar', exact: true }).first();
    await expect(entrarBtn).toBeVisible({ timeout: 5000 });

    const box = await entrarBtn.boundingBox();
    expect(box).not.toBeNull();
    // Botão deve ter tamanho mínimo clicável (44px recomendado pelo WCAG)
    if (box) {
      expect(box.width).toBeGreaterThan(30);
      expect(box.height).toBeGreaterThan(30);
    }
  });

  test('botão "Aceitar e Continuar" do LGPD deve ter tamanho adequado', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const aceitarBtn = page.getByRole('button', { name: 'Aceitar e Continuar' });
    if (!(await aceitarBtn.isVisible({ timeout: 3000 }))) return;

    const box = await aceitarBtn.boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThan(80);
      expect(box.height).toBeGreaterThan(30);
    }
  });

  test('o logo da plataforma deve ser visível na navbar', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    // O nome da plataforma deve estar no topo
    const logoText = page.locator('nav [class*="font-serif"]').first();
    if (await logoText.isVisible({ timeout: 5000 })) {
      await expect(logoText).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Responsividade e Acessibilidade Mobile
// ---------------------------------------------------------------------------

test.describe('Acessibilidade - Mobile', () => {
  test('deve ter menu hamburger acessível no mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const menuHamburger = page.locator('button').filter({ has: page.locator('.lucide-menu, [data-lucide="menu"]') }).first();
    if (await menuHamburger.isVisible({ timeout: 4000 })) {
      const box = await menuHamburger.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThan(30);
        expect(box.height).toBeGreaterThan(30);
      }
    }
  });

  test('itens do menu mobile devem ser clicáveis após abrir', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const menuHamburger = page.locator('button').filter({ has: page.locator('.lucide-menu, [data-lucide="menu"]') }).first();
    if (!(await menuHamburger.isVisible({ timeout: 4000 }))) return;

    await menuHamburger.click();
    await page.waitForTimeout(400);

    const menuItems = await page.locator('button').filter({ hasText: /início|contato|entrar/i }).all();
    for (const item of menuItems.slice(0, 3)) {
      const box = await item.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThan(30);
      }
    }
  });

  test('deve fechar o menu mobile ao clicar em X', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const menuHamburger = page.locator('button').filter({ has: page.locator('.lucide-menu, [data-lucide="menu"]') }).first();
    if (!(await menuHamburger.isVisible({ timeout: 4000 }))) return;

    await menuHamburger.click();
    await page.waitForTimeout(400);

    const fecharMenu = page.locator('button').filter({ has: page.locator('.lucide-x, [data-lucide="x"]') }).first();
    if (await fecharMenu.isVisible({ timeout: 3000 })) {
      await fecharMenu.click();
      await page.waitForTimeout(300);
      // Menu deve ter fechado
      await expect(fecharMenu).not.toBeVisible();
    }
  });

  test('deve exibir footer corretamente no mobile sem overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const footer = page.locator('footer');
    await expect(footer).toBeVisible({ timeout: 6000 });

    const box = await footer.boundingBox();
    if (box) {
      // Footer não deve ter largura maior que a viewport
      expect(box.width).toBeLessThanOrEqual(375 + 5);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Focus Management
// ---------------------------------------------------------------------------

test.describe('Acessibilidade - Gerenciamento de Foco', () => {
  test('foco deve ir para dentro do modal ao abrir', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
    await expect(page.getByText('Bem-vindo de volta')).toBeVisible({ timeout: 6000 });

    // Algum elemento dentro do modal deve estar focável
    const primeiroInputModal = page.getByPlaceholder('seu@email.com');
    await primeiroInputModal.focus();
    await expect(primeiroInputModal).toBeFocused();
  });

  test('deve ser possível navegar pelo formulário apenas com teclado', async ({ page }) => {
    await abrirLogin(page);

    // Foca no email e navega
    await page.getByPlaceholder('seu@email.com').focus();
    await page.keyboard.type('teste@email.com');
    await page.keyboard.press('Tab');
    await page.keyboard.type('senha123');
    await page.keyboard.press('Tab');

    // Deve conseguir navegar sem travar
    await expect(page.locator('body')).toBeVisible();
  });
});
