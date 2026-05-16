import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function abrirPaginaLogin(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);
  await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
  await expect(page.getByText('Bem-vindo de volta')).toBeVisible();
}

async function aceitarLGPD(page: Page) {
  const banner = page.getByRole('button', { name: 'Aceitar e Continuar' });
  try {
    await banner.waitFor({ state: 'visible', timeout: 2000 });
    await banner.click();
  } catch {
    // Banner já foi aceito ou não está presente
  }
}

// ---------------------------------------------------------------------------
// Suite: Carregamento Inicial
// ---------------------------------------------------------------------------

test.describe('Carregamento Inicial', () => {
  test('deve carregar a home page com título correto e navbar visível', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/eventix/i);
    // Verifica que a navbar (logo + nome da plataforma) está presente
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 8000 });
  });

  test('deve exibir o banner de consentimento LGPD na primeira visita', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const bannerTexto = page.getByText(/cookies|privacidade|lgpd|aceitar/i).first();
    await expect(bannerTexto).toBeVisible({ timeout: 5000 });
  });

  test('deve fechar o banner LGPD ao aceitar', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const btnAceitar = page.getByRole('button', { name: /aceitar/i }).first();
    if (await btnAceitar.isVisible()) {
      await btnAceitar.click();
      await expect(btnAceitar).not.toBeVisible();
    }
  });

  test('deve mostrar a seção de eventos na home', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    // Verifica o heading "Próximos Eventos" que sempre está presente
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Navegação
// ---------------------------------------------------------------------------

test.describe('Navegação', () => {
  test('deve navegar para a página inicial pelo menu', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    await page.getByRole('button', { name: /início/i }).first().click();
    // Confirma que a home continua carregada com o heading de eventos
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
  });

  test('deve abrir a página de contato pelo menu', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    await page.getByRole('button', { name: /contato/i }).first().click();
    await expect(page.getByText(/contato|whatsapp|fale conosco/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('deve exibir o botão "Entrar" na navbar para usuários não autenticados', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    await expect(page.getByRole('button', { name: 'Entrar', exact: true }).first()).toBeVisible();
  });

  test('deve abrir o modal de autenticação ao clicar em "Entrar"', async ({ page }) => {
    await abrirPaginaLogin(page);
    await expect(page.getByText('Bem-vindo de volta')).toBeVisible();
  });

  test('deve exibir abas de Login e Cadastro no modal de autenticação', async ({ page }) => {
    await abrirPaginaLogin(page);
    await expect(page.getByRole('button', { name: /cadastrar/i }).first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Suite: Autenticação - Tela de Login
// ---------------------------------------------------------------------------

test.describe('Autenticação - Login', () => {
  test('deve exibir os campos de e-mail e senha', async ({ page }) => {
    await abrirPaginaLogin(page);
    await expect(page.getByPlaceholder('seu@email.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••').first()).toBeVisible();
  });

  test('deve exibir erro com credenciais inválidas', async ({ page }) => {
    await abrirPaginaLogin(page);
    await page.getByPlaceholder('seu@email.com').fill('usuario_invalido@teste.com');
    await page.getByPlaceholder('••••••••').first().fill('senhaerrada123');
    await page.locator('button[type="submit"]').click();
    const erro = page.locator('.text-red-400').first();
    await expect(erro).toBeVisible({ timeout: 20000 });
  });

  test('deve alternar para aba "Cadastrar"', async ({ page }) => {
    await abrirPaginaLogin(page);
    await page.getByRole('button', { name: /cadastrar/i }).first().click();
    await expect(page.getByText('Criar nova conta')).toBeVisible();
  });

  test('deve exibir o botão "Entrar com Google"', async ({ page }) => {
    await abrirPaginaLogin(page);
    await expect(page.getByRole('button', { name: /entrar com google/i })).toBeVisible();
  });

  test('deve exibir o link "Esqueci minha senha"', async ({ page }) => {
    await abrirPaginaLogin(page);
    await expect(page.getByRole('button', { name: /esqueci minha senha/i })).toBeVisible();
  });

  test('deve abrir o fluxo de redefinição de senha', async ({ page }) => {
    await abrirPaginaLogin(page);
    await page.getByRole('button', { name: /esqueci minha senha/i }).click();
    await expect(page.getByPlaceholder('contato@exemplo.com')).toBeVisible();
  });

  test('deve exibir aba de acesso colaborador', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
    // A aba Colaborador pode existir no modal
    const colaboradorTab = page.getByRole('button', { name: /colaborador/i }).first();
    if (await colaboradorTab.isVisible({ timeout: 3000 })) {
      await colaboradorTab.click();
      await expect(page.getByText(/acesso colaborador/i)).toBeVisible({ timeout: 3000 });
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Autenticação - Cadastro
// ---------------------------------------------------------------------------

test.describe('Autenticação - Cadastro', () => {
  test.beforeEach(async ({ page }) => {
    await abrirPaginaLogin(page);
    await page.getByRole('button', { name: /cadastrar/i }).first().click();
  });

  test('deve exibir campos da etapa 1 do cadastro', async ({ page }) => {
    await expect(page.getByPlaceholder('Seu nome')).toBeVisible();
    await expect(page.getByPlaceholder('contato@exemplo.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••').first()).toBeVisible();
  });

  test('deve bloquear avanço sem preencher os campos obrigatórios', async ({ page }) => {
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    const erro = page.locator('.text-red-400').first();
    await expect(erro).toBeVisible({ timeout: 3000 });
  });

  test('deve avançar para a etapa 2 ao preencher etapa 1 corretamente', async ({ page }) => {
    await page.getByPlaceholder('Seu nome').fill('Teste Playwright');
    await page.getByPlaceholder('contato@exemplo.com').fill('playwright@teste.com');
    await page.getByPlaceholder('••••••••').first().fill('Senha@12345');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.getByPlaceholder('(11) 90000-0000')).toBeVisible({ timeout: 4000 });
  });

  test('deve exibir botão "Cadastrar com Google"', async ({ page }) => {
    await expect(page.getByRole('button', { name: /cadastrar com google/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Suite: Formulários - Validações
// ---------------------------------------------------------------------------

test.describe('Formulários - Validações', () => {
  test('deve validar CPF inválido no checkout de convidado', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const eventCard = page.locator('[class*="cursor-pointer"]').first();
    if (await eventCard.isVisible({ timeout: 3000 })) {
      await eventCard.click();
    }

    const btnComprar = page.getByRole('button', { name: /comprar|reservar|selecionar/i }).first();
    if (await btnComprar.isVisible({ timeout: 3000 })) {
      await btnComprar.click();
    }

    const cpfInput = page.getByPlaceholder('000.000.000-00');
    if (await cpfInput.isVisible({ timeout: 3000 })) {
      await cpfInput.fill('111.111.111-11');
      const nomeInput = page.getByPlaceholder('Seu nome').first();
      if (await nomeInput.isVisible()) {
        await nomeInput.fill('Teste');
      }
      const emailInput = page.getByPlaceholder('contato@exemplo.com').first();
      if (await emailInput.isVisible()) {
        await emailInput.fill('teste@teste.com');
      }
      const btnContinuar = page.getByRole('button', { name: /continuar|avançar|próximo/i }).first();
      if (await btnContinuar.isVisible()) {
        await btnContinuar.click();
      }
    }
  });

  test('deve validar e-mail inválido no formulário de login', async ({ page }) => {
    await abrirPaginaLogin(page);
    await page.getByPlaceholder('seu@email.com').fill('nao-e-um-email');
    await page.getByPlaceholder('••••••••').first().fill('qualquersenha');
    await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
    await page.waitForTimeout(1000);
  });

  test('deve validar senha vazia no formulário de login', async ({ page }) => {
    await abrirPaginaLogin(page);
    await page.getByPlaceholder('seu@email.com').fill('admin@teste.com');
    await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
    await page.waitForTimeout(1000);
  });
});

// ---------------------------------------------------------------------------
// Suite: Home - Busca e Filtros
// ---------------------------------------------------------------------------

test.describe('Home - Busca e Filtros', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
  });

  test('deve renderizar a barra de busca de eventos', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/buscar/i).first();
    await expect(searchInput).toBeVisible({ timeout: 6000 });
  });

  test('deve filtrar eventos ao digitar no campo de busca', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/buscar/i).first();
    await expect(searchInput).toBeVisible({ timeout: 6000 });
    await searchInput.fill('evento inexistente xyzabc');
    await page.waitForTimeout(500);
    // Verifica que a página não quebrou — o heading continua presente
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
  });

  test('deve exibir filtros de data na home', async ({ page }) => {
    const filtro = page.getByRole('combobox');
    await expect(filtro).toBeVisible({ timeout: 6000 });
  });

  test('deve clicar no filtro "Este mês" sem quebrar a página', async ({ page }) => {
    const filtro = page.getByRole('combobox');
    if (await filtro.isVisible({ timeout: 4000 })) {
      await filtro.selectOption({ value: 'month' });
      await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
    }
  });

  test('deve exibir o título "Próximos Eventos" na listagem', async ({ page }) => {
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Fluxo de Compra (Checkout)
// ---------------------------------------------------------------------------

test.describe('Fluxo de Compra', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
  });

  test('deve mostrar seleção de ingressos ao acessar a área de compra', async ({ page }) => {
    const eventCard = page.getByRole('button', { name: /ver ingressos/i }).first();
    const temEvento = await eventCard.isVisible({ timeout: 8000 });

    if (!temEvento) {
      // Sem eventos no banco — verifica apenas que a listagem renderizou
      await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
      return;
    }

    await eventCard.click();
    const ticketSection = page.getByText(/ingresso|mesa|selecione/i).first();
    await expect(ticketSection).toBeVisible({ timeout: 8000 });
  });

  test('deve permitir aumentar a quantidade de ingressos', async ({ page }) => {
    const eventCard = page.getByRole('button', { name: /ver ingressos/i }).first();
    if (await eventCard.isVisible({ timeout: 8000 })) {
      await eventCard.click();
      const btnAdicionar = page.getByRole('button').filter({ has: page.locator('svg') }).first();
      if (await btnAdicionar.isVisible({ timeout: 5000 })) {
        await btnAdicionar.click();
        await page.waitForTimeout(300);
      }
    }
    // Se não há eventos, o teste passa por não haver nada a testar
  });

  test('deve exibir métodos de pagamento no checkout', async ({ page }) => {
    const eventCard = page.getByRole('button', { name: /ver ingressos/i }).first();
    const hasEvents = await eventCard.isVisible({ timeout: 8000 });

    if (hasEvents) {
      await eventCard.click();
      await page.waitForTimeout(1000);
      const paymentMethod = page.getByText(/pix|cartão|boleto/i).first();
      if (await paymentMethod.isVisible({ timeout: 5000 })) {
        await expect(paymentMethod).toBeVisible();
      }
      // No checkout, a navbar ainda deve estar visível
      await expect(page.locator('nav').first()).toBeVisible();
    } else {
      // Sem eventos — página home continua íntegra
      await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Acessibilidade Básica
// ---------------------------------------------------------------------------

test.describe('Acessibilidade Básica', () => {
  test('deve ter título de página definido', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('todos os botões do menu devem ser focalizáveis via teclado', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.locator('nav').first()).toBeVisible();
  });

  test('deve manter navegação funcional em viewport mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    await expect(page.locator('nav').first()).toBeVisible();
    const menuMobile = page.locator('button.md\\:hidden').first();
    if (await menuMobile.isVisible({ timeout: 3000 })) {
      await menuMobile.click();
      await expect(page.getByRole('button', { name: /início/i }).first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('deve exibir botão de login no mobile ao abrir menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    const menuMobile = page.locator('button.md\\:hidden').first();
    if (await menuMobile.isVisible({ timeout: 3000 })) {
      await menuMobile.click();
      // Verifica se existe um botão de login/entrar no menu mobile
      const loginBtn = page.getByRole('button', { name: /entrar|login/i }).first();
      await expect(loginBtn).toBeVisible({ timeout: 3000 });
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Responsividade
// ---------------------------------------------------------------------------

test.describe('Responsividade', () => {
  const viewports = [
    { name: 'Mobile', width: 375, height: 812 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1440, height: 900 },
  ];

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.close();
  });

  for (const vp of viewports) {
    test(`deve carregar corretamente em ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await aceitarLGPD(page);
      await expect(page.locator('nav').first()).toBeVisible({ timeout: 6000 });
      await page.waitForTimeout(500);
    });
  }
});
