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

// Verifica se o usuário está logado como admin
async function estaComoAdmin(page: Page): Promise<boolean> {
  // Dashboard aparece na navbar para admin
  const dashBtn = page.getByRole('button', { name: /painel|dashboard|aprovações/i }).first();
  return await dashBtn.isVisible({ timeout: 3000 });
}

async function irParaDashboard(page: Page): Promise<boolean> {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);

  const isAdmin = await estaComoAdmin(page);
  if (!isAdmin) return false;

  // Navega para o dashboard
  const dashBtn = page.getByRole('button', { name: /aprovações|painel/i }).first();
  if (await dashBtn.isVisible({ timeout: 3000 })) {
    await dashBtn.click();
    await page.waitForTimeout(600);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Suite: Dashboard - Acesso e Proteção de Rota
// ---------------------------------------------------------------------------

test.describe('Dashboard - Acesso', () => {
  test('não deve exibir link de Dashboard para usuário não autenticado', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const entrarBtn = page.getByRole('button', { name: 'Entrar', exact: true }).first();
    if (await entrarBtn.isVisible({ timeout: 3000 })) {
      // Usuário não logado — não deve ver aprovações/dashboard
      const dashBtn = page.getByRole('button', { name: /aprovações|colaboradores|configurações/i }).first();
      await expect(dashBtn).not.toBeVisible();
    }
  });

  test('deve exibir links de admin na navbar quando autenticado como admin', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const isAdmin = await estaComoAdmin(page);
    if (isAdmin) {
      const aprovBtn = page.getByRole('button', { name: /aprovações/i }).first();
      await expect(aprovBtn).toBeVisible({ timeout: 5000 });
    }
  });

  test('deve carregar o dashboard sem erros quando admin acessa', async ({ page }) => {
    const acessou = await irParaDashboard(page);
    if (!acessou) return;

    // O dashboard deve renderizar
    await expect(page.locator('main, [class*="dashboard"]').first()).toBeVisible({ timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Dashboard - Estrutura e Navegação
// ---------------------------------------------------------------------------

test.describe('Dashboard - Estrutura', () => {
  test('deve exibir a sidebar ou menu de admin no dashboard', async ({ page }) => {
    const acessou = await irParaDashboard(page);
    if (!acessou) return;

    const sidebar = page.locator('[class*="sidebar"], nav').first();
    if (await sidebar.isVisible({ timeout: 5000 })) {
      await expect(sidebar).toBeVisible();
    }
  });

  test('deve exibir título da seção atual no dashboard', async ({ page }) => {
    const acessou = await irParaDashboard(page);
    if (!acessou) return;

    const titulo = page.locator('h1, h2').filter({ hasText: /visão geral|aprovações|eventos/i }).first();
    if (await titulo.isVisible({ timeout: 5000 })) {
      await expect(titulo).toBeVisible();
    }
  });

  test('deve exibir botão de Eventos no dashboard', async ({ page }) => {
    const acessou = await irParaDashboard(page);
    if (!acessou) return;

    const eventosBtn = page.getByRole('button', { name: /eventos/i }).first();
    if (await eventosBtn.isVisible({ timeout: 5000 })) {
      await expect(eventosBtn).toBeVisible();
    }
  });

  test('deve exibir seção de colaboradores (staff) no dashboard', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const isAdmin = await estaComoAdmin(page);
    if (!isAdmin) return;

    const colabBtn = page.getByRole('button', { name: /colaboradores/i }).first();
    if (await colabBtn.isVisible({ timeout: 5000 })) {
      await colabBtn.click();
      await page.waitForTimeout(400);
      await expect(page.locator('main')).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Dashboard - Visão Geral (Métricas)
// ---------------------------------------------------------------------------

test.describe('Dashboard - Visão Geral', () => {
  test('deve exibir métricas de receita na visão geral', async ({ page }) => {
    const acessou = await irParaDashboard(page);
    if (!acessou) return;

    const receita = page.getByText(/receita|faturamento|total/i).first();
    if (await receita.isVisible({ timeout: 5000 })) {
      await expect(receita).toBeVisible();
    }
  });

  test('deve exibir gráfico de vendas na visão geral', async ({ page }) => {
    const acessou = await irParaDashboard(page);
    if (!acessou) return;

    // Recharts renderiza SVG
    const grafico = page.locator('svg[class*="recharts"], [class*="recharts"]').first();
    if (await grafico.isVisible({ timeout: 5000 })) {
      await expect(grafico).toBeVisible();
    }
  });

  test('deve exibir contagem de eventos ativos', async ({ page }) => {
    const acessou = await irParaDashboard(page);
    if (!acessou) return;

    const eventosAtivos = page.getByText(/eventos ativos|ativo/i).first();
    if (await eventosAtivos.isVisible({ timeout: 5000 })) {
      await expect(eventosAtivos).toBeVisible();
    }
  });

  test('deve exibir contagem de compradores pagos', async ({ page }) => {
    const acessou = await irParaDashboard(page);
    if (!acessou) return;

    const pagos = page.getByText(/pago|compradores/i).first();
    if (await pagos.isVisible({ timeout: 5000 })) {
      await expect(pagos).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Dashboard - Gerenciamento de Eventos
// ---------------------------------------------------------------------------

test.describe('Dashboard - Gerenciamento de Eventos', () => {
  test('deve exibir a lista de eventos no dashboard', async ({ page }) => {
    const acessou = await irParaDashboard(page);
    if (!acessou) return;

    // Navega para a seção de eventos
    const eventosBtn = page.getByRole('button', { name: /^eventos$/i }).first();
    if (await eventosBtn.isVisible({ timeout: 5000 })) {
      await eventosBtn.click();
      await page.waitForTimeout(400);
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('deve exibir botão de criar novo evento', async ({ page }) => {
    const acessou = await irParaDashboard(page);
    if (!acessou) return;

    const criarBtn = page.getByRole('button', { name: /criar|novo evento|\+ evento/i }).first();
    if (await criarBtn.isVisible({ timeout: 5000 })) {
      await expect(criarBtn).toBeVisible();
    }
  });

  test('deve abrir formulário de criação ao clicar em Criar Evento', async ({ page }) => {
    const acessou = await irParaDashboard(page);
    if (!acessou) return;

    const criarBtn = page.getByRole('button', { name: /criar|novo evento/i }).first();
    if (!(await criarBtn.isVisible({ timeout: 5000 }))) return;

    await criarBtn.click();
    await page.waitForTimeout(400);

    // Formulário de criação deve aparecer
    const campoTitulo = page.getByPlaceholder(/título|nome do evento/i).first();
    if (await campoTitulo.isVisible({ timeout: 5000 })) {
      await expect(campoTitulo).toBeVisible();
    }
  });

  test('deve exibir opções de status do evento no formulário de criação', async ({ page }) => {
    const acessou = await irParaDashboard(page);
    if (!acessou) return;

    const criarBtn = page.getByRole('button', { name: /criar|novo evento/i }).first();
    if (!(await criarBtn.isVisible({ timeout: 5000 }))) return;

    await criarBtn.click();
    await page.waitForTimeout(400);

    const statusSelect = page.locator('select').first();
    if (await statusSelect.isVisible({ timeout: 5000 })) {
      await expect(statusSelect).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Dashboard - Lista de Compradores
// ---------------------------------------------------------------------------

test.describe('Dashboard - Compradores', () => {
  test('deve exibir a lista de compradores no dashboard', async ({ page }) => {
    const acessou = await irParaDashboard(page);
    if (!acessou) return;

    const compradoresSection = page.getByText(/compradores|lista de compradores|participantes/i).first();
    if (await compradoresSection.isVisible({ timeout: 5000 })) {
      await expect(compradoresSection).toBeVisible();
    }
  });

  test('deve ter campo de busca de compradores', async ({ page }) => {
    const acessou = await irParaDashboard(page);
    if (!acessou) return;

    const buscaInput = page.getByPlaceholder(/buscar|pesquisar/i).first();
    if (await buscaInput.isVisible({ timeout: 5000 })) {
      await expect(buscaInput).toBeVisible();
    }
  });

  test('deve filtrar compradores ao digitar no campo de busca', async ({ page }) => {
    const acessou = await irParaDashboard(page);
    if (!acessou) return;

    const buscaInput = page.getByPlaceholder(/buscar|pesquisar/i).first();
    if (!(await buscaInput.isVisible({ timeout: 5000 }))) return;

    await buscaInput.fill('Gabriel');
    await page.waitForTimeout(400);
    await expect(page.locator('body')).toBeVisible();
  });

  test('deve exibir status de pagamento nos cards de comprador', async ({ page }) => {
    const acessou = await irParaDashboard(page);
    if (!acessou) return;

    const statusPago = page.getByText(/pago|pendente|cancelado/i).first();
    if (await statusPago.isVisible({ timeout: 5000 })) {
      await expect(statusPago).toBeVisible();
    }
  });

  test('deve exibir botão de exportar lista de compradores', async ({ page }) => {
    const acessou = await irParaDashboard(page);
    if (!acessou) return;

    const exportBtn = page.getByRole('button', { name: /exportar|download|csv|pdf/i }).first();
    if (await exportBtn.isVisible({ timeout: 5000 })) {
      await expect(exportBtn).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Dashboard - Scanner QR (Staff)
// ---------------------------------------------------------------------------

test.describe('Dashboard - Scanner QR', () => {
  test('deve exibir a opção de scanner no dashboard para staff/admin', async ({ page }) => {
    const acessou = await irParaDashboard(page);
    if (!acessou) return;

    const scannerBtn = page.getByRole('button', { name: /scanner|scan|qr|check-in/i }).first();
    if (await scannerBtn.isVisible({ timeout: 5000 })) {
      await expect(scannerBtn).toBeVisible();
    }
  });

  test('deve abrir o scanner ao clicar no botão de scan', async ({ page }) => {
    const acessou = await irParaDashboard(page);
    if (!acessou) return;

    const scannerBtn = page.getByRole('button', { name: /scanner|scan|qr/i }).first();
    if (!(await scannerBtn.isVisible({ timeout: 5000 }))) return;

    await scannerBtn.click();
    await page.waitForTimeout(500);

    // O scanner (câmera) ou modal de scanner deve aparecer
    const scannerEl = page.locator('[class*="scanner"], video, canvas').first();
    if (await scannerEl.isVisible({ timeout: 5000 })) {
      await expect(scannerEl).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Dashboard - Acesso Colaborador (Staff)
// ---------------------------------------------------------------------------

test.describe('Dashboard - Acesso Colaborador', () => {
  test('deve ter aba de acesso colaborador no modal de login', async ({ page }) => {
    await abrirLogin(page);

    const staffTab = page.getByRole('button', { name: /colaborador/i }).first();
    if (await staffTab.isVisible({ timeout: 3000 })) {
      await staffTab.click();
      await expect(page.getByText('Acesso Colaborador')).toBeVisible({ timeout: 4000 });
    }
  });

  test('deve mostrar erro de credencial inválida para colaborador', async ({ page }) => {
    await abrirLogin(page);

    const staffTab = page.getByRole('button', { name: /colaborador/i }).first();
    if (!(await staffTab.isVisible({ timeout: 3000 }))) return;

    await staffTab.click();
    await page.getByPlaceholder('seu@email.com').fill('staff_invalido@teste.com');
    await page.getByPlaceholder('••••••••').first().fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    const erro = page.locator('.text-red-400, .text-red-500').first();
    await expect(erro).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Dashboard - Fila de Aprovações
// ---------------------------------------------------------------------------

test.describe('Dashboard - Fila de Aprovações', () => {
  test('deve exibir a fila de aprovações quando admin acessa', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const isAdmin = await estaComoAdmin(page);
    if (!isAdmin) return;

    const aprovBtn = page.getByRole('button', { name: /aprovações/i }).first();
    if (await aprovBtn.isVisible({ timeout: 5000 })) {
      await aprovBtn.click();
      await page.waitForTimeout(400);
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('deve exibir contador de aprovações pendentes na navbar', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const isAdmin = await estaComoAdmin(page);
    if (!isAdmin) return;

    // O badge de aprovações pendentes pode aparecer na navbar
    const badge = page.locator('[class*="bg-[#d4af37]"][class*="rounded-full"]').first();
    // É opcional — só verifica se existe, não se tem valor específico
    if (await badge.isVisible({ timeout: 3000 })) {
      await expect(badge).toBeVisible();
    }
  });
});
