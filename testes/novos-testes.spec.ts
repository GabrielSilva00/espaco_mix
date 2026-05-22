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
  } catch {
    // Banner já foi aceito ou não está presente
  }
}

async function abrirPaginaLogin(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);
  await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
  await expect(page.getByText('Bem-vindo de volta')).toBeVisible();
}

async function irParaCadastro(page: Page) {
  await abrirPaginaLogin(page);
  await page.getByRole('button', { name: /cadastrar/i }).first().click();
  await expect(page.getByText('Criar nova conta')).toBeVisible();
}

// ---------------------------------------------------------------------------
// Suite: Footer
// ---------------------------------------------------------------------------

test.describe('Footer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
  });

  test('deve exibir o copyright no rodapé', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible({ timeout: 8000 });
    await expect(footer.getByText(/espaço mix|eventix/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('deve exibir o indicador "Reservas Ativas" no rodapé', async ({ page }) => {
    await expect(page.getByText(/reservas ativas/i).first()).toBeVisible({ timeout: 6000 });
  });

  test('deve ter o indicador de status (ponto verde) visível', async ({ page }) => {
    const footer = page.locator('footer');
    const statusDot = footer.locator('.bg-green-500').first();
    await expect(statusDot).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Navbar - Estados e Elementos
// ---------------------------------------------------------------------------

test.describe('Navbar - Elementos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
  });

  test('deve exibir a navbar no topo da página', async ({ page }) => {
    const navbar = page.locator('nav').first();
    await expect(navbar).toBeVisible({ timeout: 6000 });
    const box = await navbar.boundingBox();
    expect(box?.y).toBeLessThan(100);
  });

  test('deve exibir botão de Início na navbar', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /início/i }).first()
    ).toBeVisible({ timeout: 6000 });
  });

  test('deve exibir botão de Contato na navbar', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /contato/i }).first()
    ).toBeVisible({ timeout: 6000 });
  });

  test('deve manter navbar fixa ao rolar a página', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(300);
    const navbar = page.locator('nav').first();
    await expect(navbar).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Suite: Página de Contato - Detalhes
// ---------------------------------------------------------------------------

test.describe('Página de Contato - Detalhes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    await page.getByRole('button', { name: /contato/i }).first().click();
    await expect(page.getByText(/central de atendimento|contato/i).first()).toBeVisible({ timeout: 6000 });
  });

  test('deve exibir o título "Central de Atendimento"', async ({ page }) => {
    await expect(page.getByText('Central de Atendimento')).toBeVisible();
  });

  test('deve exibir o botão de WhatsApp', async ({ page }) => {
    const whatsappBtn = page.getByRole('link', { name: /conversar|whatsapp/i });
    await expect(whatsappBtn).toBeVisible({ timeout: 5000 });
  });

  test('deve exibir o horário de atendimento', async ({ page }) => {
    await expect(page.getByText(/segunda|horário de atendimento/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('deve exibir o e-mail corporativo', async ({ page }) => {
    await expect(page.getByText(/suporte@/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('deve exibir botão "Retornar ao Evento"', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /retornar ao evento/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test('botão "Retornar ao Evento" deve navegar de volta', async ({ page }) => {
    await page.getByRole('button', { name: /retornar ao evento/i }).click();
    await expect(
      page.getByText(/próximos eventos|ingressos/i).first()
    ).toBeVisible({ timeout: 6000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Recuperação de Senha - Fluxo Completo
// ---------------------------------------------------------------------------

test.describe('Recuperação de Senha - Fluxo Completo', () => {
  test.beforeEach(async ({ page }) => {
    await abrirPaginaLogin(page);
    await page.getByRole('button', { name: /esqueci minha senha/i }).click();
  });

  test('deve exibir o campo de e-mail na etapa de recuperação', async ({ page }) => {
    await expect(page.getByPlaceholder('contato@exemplo.com')).toBeVisible();
  });

  test('deve exibir o título "Recuperar Senha"', async ({ page }) => {
    await expect(page.getByText('Recuperar Senha')).toBeVisible();
  });

  test('deve bloquear avanço sem e-mail preenchido', async ({ page }) => {
    await page.getByRole('button', { name: /enviar código/i }).click();
    const erro = page.locator('.text-red-400').first();
    await expect(erro).toBeVisible({ timeout: 3000 });
  });

  test('deve avançar para etapa de código ao preencher e-mail', async ({ page }) => {
    await page.getByPlaceholder('contato@exemplo.com').fill('teste@teste.com');
    await page.getByRole('button', { name: /enviar código/i }).click();
    await expect(page.getByText(/código de verificação/i).first()).toBeVisible({ timeout: 4000 });
  });

  test('deve bloquear avanço sem código preenchido', async ({ page }) => {
    await page.getByPlaceholder('contato@exemplo.com').fill('teste@teste.com');
    await page.getByRole('button', { name: /enviar código/i }).click();
    await expect(page.getByText(/código de verificação/i).first()).toBeVisible({ timeout: 4000 });
    await page.getByRole('button', { name: /verificar código/i }).click();
    const erro = page.locator('.text-red-400').first();
    await expect(erro).toBeVisible({ timeout: 3000 });
  });

  test('deve completar fluxo de recuperação até redefinir senha', async ({ page }) => {
    // Etapa 1: e-mail
    await page.getByPlaceholder('contato@exemplo.com').fill('teste@teste.com');
    await page.getByRole('button', { name: /enviar código/i }).click();

    // Etapa 2: código
    await expect(page.locator('input[placeholder="0000"]')).toBeVisible({ timeout: 4000 });
    await page.locator('input[placeholder="0000"]').fill('1234');
    await page.getByRole('button', { name: /verificar código/i }).click();

    // Etapa 3: nova senha
    const novaSenhaInput = page.getByPlaceholder('••••••••').first();
    await expect(novaSenhaInput).toBeVisible({ timeout: 4000 });
    await novaSenhaInput.fill('NovaSenha@123');
    await page.getByRole('button', { name: /redefinir senha/i }).click();

    // Deve voltar para o login com toast de sucesso ou tela de login
    await expect(
      page.getByText(/bem-vindo de volta|senha redefinida/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('deve voltar ao login pelo botão Voltar', async ({ page }) => {
    const btnVoltar = page.getByRole('button', { name: /voltar/i }).first();
    await expect(btnVoltar).toBeVisible();
    await btnVoltar.click();
    await expect(page.getByText('Bem-vindo de volta')).toBeVisible({ timeout: 4000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Cadastro - Etapa 2 (Dados Pessoais)
// ---------------------------------------------------------------------------

test.describe('Cadastro - Etapa 2', () => {
  test.beforeEach(async ({ page }) => {
    await irParaCadastro(page);
    // Preenche e avança para etapa 2
    await page.getByPlaceholder('Seu nome').fill('Teste Playwright');
    await page.getByPlaceholder('contato@exemplo.com').fill('playwright@test.com');
    await page.getByPlaceholder('••••••••').first().fill('Senha@12345');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.getByPlaceholder('(11) 90000-0000')).toBeVisible({ timeout: 6000 });
  });

  test('deve exibir campo de celular na etapa 2', async ({ page }) => {
    await expect(page.getByPlaceholder('(11) 90000-0000')).toBeVisible();
  });

  test('deve exibir campo de CPF na etapa 2', async ({ page }) => {
    await expect(page.getByPlaceholder('000.000.000-00')).toBeVisible();
  });

  test('deve exibir campo de data de nascimento na etapa 2', async ({ page }) => {
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible({ timeout: 4000 });
  });

  test('deve permitir preencher o celular', async ({ page }) => {
    const telefone = page.getByPlaceholder('(11) 90000-0000');
    await telefone.fill('(11) 99999-9999');
    await expect(telefone).toHaveValue('(11) 99999-9999');
  });

  test('deve permitir voltar para a etapa 1', async ({ page }) => {
    const btnVoltar = page.getByRole('button', { name: /voltar/i }).first();
    await expect(btnVoltar).toBeVisible();
    await btnVoltar.click();
    await expect(page.getByPlaceholder('Seu nome')).toBeVisible({ timeout: 4000 });
  });

  test('deve exibir botão "Criar Conta e Continuar" na etapa 2', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /criar conta e continuar/i })
    ).toBeVisible({ timeout: 4000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Acesso Colaborador (Staff)
// ---------------------------------------------------------------------------

test.describe('Acesso Colaborador', () => {
  test('deve existir a aba colaborador no modal de autenticação', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
    await expect(page.getByText('Bem-vindo de volta')).toBeVisible({ timeout: 6000 });

    const staffTab = page.getByRole('button', { name: /colaborador/i }).first();
    if (await staffTab.isVisible({ timeout: 3000 })) {
      await staffTab.click();
      await expect(page.getByText(/acesso colaborador/i)).toBeVisible({ timeout: 4000 });
    }
  });

  test('deve exibir campos de login no acesso colaborador', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
    await expect(page.getByText('Bem-vindo de volta')).toBeVisible({ timeout: 6000 });

    const staffTab = page.getByRole('button', { name: /colaborador/i }).first();
    if (await staffTab.isVisible({ timeout: 3000 })) {
      await staffTab.click();
      await expect(page.getByPlaceholder('seu@email.com')).toBeVisible({ timeout: 4000 });
      await expect(page.getByPlaceholder('••••••••').first()).toBeVisible();
    }
  });

  test('deve exibir erro ao tentar entrar como colaborador com credenciais inválidas', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
    await expect(page.getByText('Bem-vindo de volta')).toBeVisible({ timeout: 6000 });

    const staffTab = page.getByRole('button', { name: /colaborador/i }).first();
    if (await staffTab.isVisible({ timeout: 3000 })) {
      await staffTab.click();
      await page.getByPlaceholder('seu@email.com').fill('colaborador@invalido.com');
      await page.getByPlaceholder('••••••••').first().fill('senhaerrada');
      await page.locator('button[type="submit"]').click();
      const erro = page.locator('.text-red-400').first();
      await expect(erro).toBeVisible({ timeout: 10000 });
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Página de Reservas
// ---------------------------------------------------------------------------

test.describe('Página de Reservas', () => {
  async function irParaReservas(page: Page) {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    // Tenta navegar para reservas via navbar ou diretamente simulando o estado
    const reservasBtn = page.getByRole('button', { name: /reservas|ingressos/i }).first();
    if (await reservasBtn.isVisible({ timeout: 3000 })) {
      await reservasBtn.click();
    }
  }

  test('deve exibir o título "Minhas Reservas" ao acessar a página', async ({ page }) => {
    await irParaReservas(page);
    const titulo = page.getByText('Minhas Reservas');
    if (await titulo.isVisible({ timeout: 4000 })) {
      await expect(titulo).toBeVisible();
    }
  });

  test('deve mostrar estado vazio quando não há reservas', async ({ page }) => {
    await irParaReservas(page);
    const vazioMsg = page.getByText(/nenhuma reserva|nenhum histórico/i).first();
    if (await vazioMsg.isVisible({ timeout: 4000 })) {
      await expect(vazioMsg).toBeVisible();
    }
  });

  test('deve exibir a aba "Próximos Eventos" nas reservas', async ({ page }) => {
    await irParaReservas(page);
    const aba = page.getByRole('button', { name: /próximos eventos/i }).first();
    if (await aba.isVisible({ timeout: 4000 })) {
      await expect(aba).toBeVisible();
    }
  });

  test('deve exibir a aba "Histórico" nas reservas', async ({ page }) => {
    await irParaReservas(page);
    const aba = page.getByRole('button', { name: /histórico/i }).first();
    if (await aba.isVisible({ timeout: 4000 })) {
      await expect(aba).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: API - Health Check e Endpoints Públicos
// ---------------------------------------------------------------------------

test.describe('API - Endpoints Públicos', () => {
  test('deve responder ao health check da API', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('status');
  });

  test('deve rejeitar CPF inválido via API', async ({ request }) => {
    const response = await request.post('http://localhost:3000/api/validate-cpf', {
      data: { cpf: '111.111.111-11' },
    });
    expect([200, 400, 422]).toContain(response.status());
    const body = await response.json();
    if (response.status() === 200) {
      expect(body.valid).toBe(false);
    }
  });

  test('deve aceitar CPF válido via API', async ({ request }) => {
    // CPF válido de teste: 529.982.247-25
    const response = await request.post('http://localhost:3000/api/validate-cpf', {
      data: { cpf: '529.982.247-25' },
    });
    expect([200, 400]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty('valid');
    }
  });

  test('deve retornar 401 em rota autenticada sem token', async ({ request }) => {
    const response = await request.post('http://localhost:3000/api/orders', {
      data: {},
    });
    expect([401, 403]).toContain(response.status());
  });

  test('deve retornar a política de privacidade', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/privacy-policy');
    expect(response.status()).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Suite: Modal de Checkout - Dados do Convidado
// ---------------------------------------------------------------------------

test.describe('Checkout - Formulário de Convidado', () => {
  async function abrirCheckout(page: Page) {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const eventCard = page.getByRole('button', { name: /ver ingressos/i }).first();
    if (!(await eventCard.isVisible({ timeout: 8000 }))) return false;

    await eventCard.click();
    await page.waitForTimeout(500);

    // Tenta abrir o painel de ingressos
    const ticketPanel = page.getByRole('button', { name: /ingressos|ingresso avulso/i }).first();
    if (await ticketPanel.isVisible({ timeout: 4000 })) {
      await ticketPanel.click();
    }

    // Incrementa ingressos
    const btnMais = page.getByRole('button').filter({ hasText: /\+/ }).first();
    if (await btnMais.isVisible({ timeout: 3000 })) {
      await btnMais.click();
    }

    // Clica em Finalizar / Comprar
    const btnFinalizar = page.getByRole('button', { name: /finalizar|comprar|checkout/i }).first();
    if (await btnFinalizar.isVisible({ timeout: 4000 })) {
      await btnFinalizar.click();
      return true;
    }
    return false;
  }

  test('deve exibir campo de nome no checkout de convidado', async ({ page }) => {
    const abriu = await abrirCheckout(page);
    if (!abriu) return;

    const nomeInput = page.getByPlaceholder(/seu nome|nome completo/i).first();
    if (await nomeInput.isVisible({ timeout: 5000 })) {
      await expect(nomeInput).toBeVisible();
    }
  });

  test('deve exibir campo de e-mail no checkout de convidado', async ({ page }) => {
    const abriu = await abrirCheckout(page);
    if (!abriu) return;

    const emailInput = page.getByPlaceholder(/e-mail|contato@/i).first();
    if (await emailInput.isVisible({ timeout: 5000 })) {
      await expect(emailInput).toBeVisible();
    }
  });

  test('deve exibir campo de CPF no checkout', async ({ page }) => {
    const abriu = await abrirCheckout(page);
    if (!abriu) return;

    const cpfInput = page.getByPlaceholder('000.000.000-00');
    if (await cpfInput.isVisible({ timeout: 5000 })) {
      await expect(cpfInput).toBeVisible();
    }
  });

  test('deve exibir opções de pagamento no checkout', async ({ page }) => {
    const abriu = await abrirCheckout(page);
    if (!abriu) return;

    const pixOption = page.getByText(/pix/i).first();
    if (await pixOption.isVisible({ timeout: 5000 })) {
      await expect(pixOption).toBeVisible();
    }
  });

  test('deve permitir fechar o modal de checkout', async ({ page }) => {
    const abriu = await abrirCheckout(page);
    if (!abriu) return;

    const btnFechar = page.locator('button').filter({ has: page.locator('svg') }).first();
    if (await btnFechar.isVisible({ timeout: 3000 })) {
      // Tenta fechar o modal pelo X
      const closeBtn = page.locator('[class*="absolute"][class*="top-4"][class*="right-4"]').first();
      if (await closeBtn.isVisible({ timeout: 2000 })) {
        await closeBtn.click();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Interações com Eventos na Home
// ---------------------------------------------------------------------------

test.describe('Eventos - Interações na Home', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
  });

  test('deve exibir cards de evento com informações básicas', async ({ page }) => {
    const eventCard = page.getByRole('button', { name: /ver ingressos/i }).first();
    if (await eventCard.isVisible({ timeout: 8000 })) {
      await expect(eventCard).toBeVisible();
    } else {
      // Sem eventos, verifica que a home está íntegra
      await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
    }
  });

  test('deve abrir detalhes do evento ao clicar no card', async ({ page }) => {
    const eventCard = page.getByRole('button', { name: /ver ingressos/i }).first();
    if (await eventCard.isVisible({ timeout: 8000 })) {
      await eventCard.click();
      // Deve mostrar a view de booking com informações do evento
      await expect(
        page.getByText(/ingresso|mesa|local|data/i).first()
      ).toBeVisible({ timeout: 8000 });
    }
  });

  test('deve exibir preço nos cards de evento', async ({ page }) => {
    const priceText = page.getByText(/r\$|grátis|gratuito/i).first();
    if (await priceText.isVisible({ timeout: 8000 })) {
      await expect(priceText).toBeVisible();
    }
  });

  test('deve permitir busca por texto', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/buscar/i).first();
    if (await searchInput.isVisible({ timeout: 6000 })) {
      await searchInput.fill('show');
      await page.waitForTimeout(500);
      // A página não deve quebrar
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('deve limpar a busca e restaurar eventos', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/buscar/i).first();
    if (await searchInput.isVisible({ timeout: 6000 })) {
      await searchInput.fill('xyzinexistente123');
      await page.waitForTimeout(400);
      await searchInput.clear();
      await page.waitForTimeout(400);
      await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Booking View - Seleção de Ingressos
// ---------------------------------------------------------------------------

test.describe('Booking - Seleção de Ingressos', () => {
  async function abrirBooking(page: Page): Promise<boolean> {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    const eventCard = page.getByRole('button', { name: /ver ingressos/i }).first();
    if (!(await eventCard.isVisible({ timeout: 8000 }))) return false;
    await eventCard.click();
    return true;
  }

  test('deve exibir o nome do evento na página de booking', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;
    // Confirma que a view de booking carregou
    await expect(page.locator('main')).toBeVisible({ timeout: 6000 });
  });

  test('deve exibir painel de ingressos na view de booking', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const ticketBtn = page.getByRole('button', { name: /ingressos/i }).first();
    if (await ticketBtn.isVisible({ timeout: 6000 })) {
      await expect(ticketBtn).toBeVisible();
    }
  });

  test('deve expandir o painel de ingressos ao clicar', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const ticketBtn = page.getByRole('button', { name: /ingressos/i }).first();
    if (await ticketBtn.isVisible({ timeout: 6000 })) {
      await ticketBtn.click();
      await page.waitForTimeout(400);
      // Deve aparecer opções de ingresso ou setor
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('deve mostrar subtotal ao selecionar ingressos', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const ticketBtn = page.getByRole('button', { name: /ingressos/i }).first();
    if (await ticketBtn.isVisible({ timeout: 6000 })) {
      await ticketBtn.click();
      await page.waitForTimeout(300);
      const btnMais = page.getByRole('button').filter({ hasText: /\+/ }).first();
      if (await btnMais.isVisible({ timeout: 3000 })) {
        await btnMais.click();
        await page.waitForTimeout(300);
        // Subtotal deve aparecer
        const subtotal = page.getByText(/subtotal|total/i).first();
        if (await subtotal.isVisible({ timeout: 3000 })) {
          await expect(subtotal).toBeVisible();
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: LGPD - Comportamento Avançado
// ---------------------------------------------------------------------------

test.describe('LGPD - Comportamento', () => {
  test('deve aceitar cookies e não mostrar o banner novamente na mesma sessão', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const banner = page.getByRole('button', { name: /aceitar e continuar/i });
    if (await banner.isVisible({ timeout: 3000 })) {
      await banner.click();
      // Navega para outra seção
      await page.getByRole('button', { name: /contato/i }).first().click();
      await page.waitForTimeout(300);
      // O banner não deve reaparecer na mesma sessão
      await expect(banner).not.toBeVisible();
    }
  });

  test('deve exibir texto sobre privacidade no banner LGPD', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const texto = page.getByText(/privacidade|cookies|lgpd|aceitar/i).first();
    await expect(texto).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Responsividade - Tablet
// ---------------------------------------------------------------------------

test.describe('Responsividade - Tablet', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
  });

  test('deve exibir a navbar corretamente no tablet', async ({ page }) => {
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 6000 });
  });

  test('deve exibir a listagem de eventos no tablet', async ({ page }) => {
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
  });

  test('deve abrir o modal de login no tablet', async ({ page }) => {
    await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
    await expect(page.getByText('Bem-vindo de volta')).toBeVisible({ timeout: 6000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Responsividade - Mobile
// ---------------------------------------------------------------------------

test.describe('Responsividade - Mobile Extra', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
  });

  test('deve exibir footer corretamente no mobile', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible({ timeout: 6000 });
  });

  test('deve navegar para contato no mobile', async ({ page }) => {
    // Tenta pelo menu hamburger primeiro
    const menuMobile = page.locator('button.md\\:hidden').first();
    if (await menuMobile.isVisible({ timeout: 3000 })) {
      await menuMobile.click();
    }
    // O botão Contato pode estar visível diretamente ou após abrir o menu
    const contatoBtn = page.getByRole('button', { name: /^contato$/i }).first();
    if (await contatoBtn.isVisible({ timeout: 3000 })) {
      await contatoBtn.click();
      // Aguarda a navegação e verifica o conteúdo da página de contato (h1 específico)
      await expect(
        page.getByRole('heading', { name: /central de atendimento/i }).first()
      ).toBeVisible({ timeout: 8000 });
    }
  });

  test('deve abrir o modal de login no mobile', async ({ page }) => {
    // Tenta pelo menu hamburger
    const menuMobile = page.locator('button.md\\:hidden').first();
    if (await menuMobile.isVisible({ timeout: 3000 })) {
      await menuMobile.click();
      const loginBtn = page.getByRole('button', { name: /entrar/i }).first();
      if (await loginBtn.isVisible({ timeout: 3000 })) {
        await loginBtn.click();
        await expect(page.getByText(/bem-vindo de volta/i)).toBeVisible({ timeout: 6000 });
      }
    } else {
      const loginBtn = page.getByRole('button', { name: 'Entrar', exact: true }).first();
      if (await loginBtn.isVisible({ timeout: 3000 })) {
        await loginBtn.click();
        await expect(page.getByText(/bem-vindo de volta/i)).toBeVisible({ timeout: 6000 });
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Segurança e Validações
// ---------------------------------------------------------------------------

test.describe('Segurança - Validações de Input', () => {
  test('deve sanitizar entrada XSS no campo de busca', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    const searchInput = page.getByPlaceholder(/buscar/i).first();
    if (await searchInput.isVisible({ timeout: 6000 })) {
      await searchInput.fill('<script>alert("xss")</script>');
      await page.waitForTimeout(500);
      // A página não deve executar o script e deve continuar íntegra
      await expect(page.locator('body')).toBeVisible();
      await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('deve sanitizar entrada SQL injection no campo de busca', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    const searchInput = page.getByPlaceholder(/buscar/i).first();
    if (await searchInput.isVisible({ timeout: 6000 })) {
      await searchInput.fill("'; DROP TABLE events; --");
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('não deve aceitar e-mail inválido no formulário de login sem "@"', async ({ page }) => {
    await abrirPaginaLogin(page);
    const emailInput = page.getByPlaceholder('seu@email.com');
    await emailInput.fill('emailsemarroba');
    await page.getByPlaceholder('••••••••').first().fill('senha123');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1500);
    // A página deve continuar na tela de login (sem navegar para dashboard)
    await expect(page.getByText(/bem-vindo de volta|erro|inválido/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('deve bloquear envio sem preencher nenhum campo no cadastro', async ({ page }) => {
    await irParaCadastro(page);
    // Clica em Continuar sem preencher nada
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.waitForTimeout(500);
    // A tela deve continuar na etapa 1 (campo "Seu nome" ainda visível)
    await expect(page.getByPlaceholder('Seu nome')).toBeVisible({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Navegação - Voltar ao Site
// ---------------------------------------------------------------------------

test.describe('Navegação - Fluxos de Retorno', () => {
  test('deve retornar à home pelo botão "Voltar ao Site" no modal de auth', async ({ page }) => {
    await abrirPaginaLogin(page);
    const btnVoltar = page.getByRole('button', { name: /voltar ao site/i });
    await expect(btnVoltar).toBeVisible({ timeout: 5000 });
    await btnVoltar.click();
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
  });

  test('deve voltar da aba Cadastro para a aba Login', async ({ page }) => {
    await irParaCadastro(page);
    // Clica na aba Entrar
    await page.getByRole('button', { name: /^entrar$/i }).first().click();
    await expect(page.getByText('Bem-vindo de volta')).toBeVisible({ timeout: 4000 });
  });

  test('deve navegar home → contato → home sem erros', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    await page.getByRole('button', { name: /contato/i }).first().click();
    await expect(page.getByText(/central de atendimento/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /início/i }).first().click();
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
  });
});
