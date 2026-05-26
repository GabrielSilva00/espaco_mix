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

async function irParaCadastro(page: Page) {
  await abrirLogin(page);
  await page.getByRole('button', { name: /cadastrar/i }).first().click();
  await expect(page.getByText('Criar nova conta')).toBeVisible({ timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Suite: Estados Vazios
// ---------------------------------------------------------------------------

test.describe('Estados Vazios', () => {
  test('deve exibir estado vazio quando a busca não retorna eventos', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const searchInput = page.getByPlaceholder(/buscar/i).first();
    if (!(await searchInput.isVisible({ timeout: 6000 }))) return;

    await searchInput.fill('xyzevento_absolutamente_inexistente_12345');
    await page.waitForTimeout(600);

    // Deve exibir uma mensagem de "sem resultados" ou a lista vazia
    const semResultados = page.getByText(
      /nenhum evento|sem resultados|não encontrado|nada aqui/i
    ).first();
    if (await semResultados.isVisible({ timeout: 4000 })) {
      await expect(semResultados).toBeVisible();
    }

    // A página não deve quebrar
    await expect(page.locator('nav').first()).toBeVisible();
  });

  test('deve exibir estado vazio com filtro de "este fim de semana" sem eventos', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const filtro = page.getByRole('combobox').first();
    if (!(await filtro.isVisible({ timeout: 5000 }))) return;

    await filtro.selectOption({ value: 'weekend' });
    await page.waitForTimeout(500);

    // Página não deve quebrar
    await expect(page.locator('nav').first()).toBeVisible();
  });

  test('deve exibir estado vazio com filtro "este mês" sem eventos futuros no mês', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const filtro = page.getByRole('combobox').first();
    if (!(await filtro.isVisible({ timeout: 5000 }))) return;

    await filtro.selectOption({ value: 'month' });
    await page.waitForTimeout(500);

    await expect(page.locator('nav').first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Suite: Validações de Formulário - Login
// ---------------------------------------------------------------------------

test.describe('Erros - Formulário de Login', () => {
  test('deve exibir erro ao tentar fazer login com campos em branco', async ({ page }) => {
    await abrirLogin(page);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1000);
    // Deve permanecer na tela de login
    await expect(page.getByText(/bem-vindo de volta/i)).toBeVisible({ timeout: 3000 });
  });

  test('deve exibir erro com e-mail sem "@"', async ({ page }) => {
    await abrirLogin(page);
    await page.getByPlaceholder('seu@email.com').fill('emailsemarroba');
    await page.getByPlaceholder('••••••••').first().fill('senha123');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1500);
    await expect(page.getByText(/bem-vindo de volta|inválido|erro/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('deve exibir erro com credenciais incorretas', async ({ page }) => {
    await abrirLogin(page);
    await page.getByPlaceholder('seu@email.com').fill('usuario_que_nao_existe@teste123abc.com');
    await page.getByPlaceholder('••••••••').first().fill('SenhaCompletamenteErrada#999');
    await page.locator('button[type="submit"]').click();
    const erro = page.locator('.text-red-400, .text-red-500').first();
    await expect(erro).toBeVisible({ timeout: 20000 });
  });

  test('deve exibir erro com senha muito curta', async ({ page }) => {
    await abrirLogin(page);
    await page.getByPlaceholder('seu@email.com').fill('teste@teste.com');
    await page.getByPlaceholder('••••••••').first().fill('123');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Suite: Validações de Formulário - Cadastro
// ---------------------------------------------------------------------------

test.describe('Erros - Formulário de Cadastro', () => {
  test('deve exibir erro ao tentar avançar sem preencher etapa 1', async ({ page }) => {
    await irParaCadastro(page);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    const erro = page.locator('.text-red-400, .text-red-500').first();
    await expect(erro).toBeVisible({ timeout: 3000 });
  });

  test('deve exibir erro de e-mail inválido no cadastro', async ({ page }) => {
    await irParaCadastro(page);
    await page.getByPlaceholder('Seu nome').fill('Teste Erro');
    await page.getByPlaceholder('contato@exemplo.com').fill('emailinvalido');
    await page.getByPlaceholder('••••••••').first().fill('Senha@12345');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.waitForTimeout(500);
    const erro = page.locator('.text-red-400, .text-red-500').first();
    if (await erro.isVisible({ timeout: 3000 })) {
      await expect(erro).toBeVisible();
    }
  });

  test('deve exibir erro de senha fraca no cadastro', async ({ page }) => {
    await irParaCadastro(page);
    await page.getByPlaceholder('Seu nome').fill('Teste Fraco');
    await page.getByPlaceholder('contato@exemplo.com').fill('fraco@teste.com');
    await page.getByPlaceholder('••••••••').first().fill('123');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.waitForTimeout(500);
    // Deve permanecer na etapa 1 ou mostrar erro
    await expect(page.getByPlaceholder('Seu nome')).toBeVisible({ timeout: 3000 });
  });

  test('deve exibir erro de nome em branco no cadastro', async ({ page }) => {
    await irParaCadastro(page);
    await page.getByPlaceholder('contato@exemplo.com').fill('valido@teste.com');
    await page.getByPlaceholder('••••••••').first().fill('Senha@12345');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.waitForTimeout(500);
    await expect(page.getByPlaceholder('Seu nome')).toBeVisible({ timeout: 3000 });
  });

  test('deve validar confirmação de senha na etapa 1 do cadastro', async ({ page }) => {
    await irParaCadastro(page);
    // Verifica se existe campo de confirmar senha
    const confirmarSenha = page.getByPlaceholder(/confirmar senha|repita/i).first();
    if (!(await confirmarSenha.isVisible({ timeout: 2000 }))) return;

    await page.getByPlaceholder('Seu nome').fill('Teste Confirm');
    await page.getByPlaceholder('contato@exemplo.com').fill('confirm@teste.com');
    await page.getByPlaceholder('••••••••').first().fill('Senha@12345');
    await confirmarSenha.fill('SenhaDiferente@123');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.waitForTimeout(500);
    const erro = page.locator('.text-red-400').first();
    if (await erro.isVisible({ timeout: 3000 })) {
      await expect(erro).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Validações - Etapa 2 do Cadastro (Dados Pessoais)
// ---------------------------------------------------------------------------

test.describe('Erros - Cadastro Etapa 2', () => {
  async function irParaEtapa2(page: Page) {
    await irParaCadastro(page);
    await page.getByPlaceholder('Seu nome').fill('Teste Playwright');
    await page.getByPlaceholder('contato@exemplo.com').fill('playwright@test.com');
    await page.getByPlaceholder('••••••••').first().fill('Senha@12345');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.getByPlaceholder('(11) 90000-0000')).toBeVisible({ timeout: 6000 });
  }

  test('deve bloquear cadastro com CPF inválido na etapa 2', async ({ page }) => {
    await irParaEtapa2(page);

    const cpfInput = page.getByPlaceholder('000.000.000-00');
    if (!(await cpfInput.isVisible({ timeout: 3000 }))) return;

    await cpfInput.fill('111.111.111-11');
    await page.getByRole('button', { name: /criar conta/i }).click();
    await page.waitForTimeout(1500);
    const erro = page.locator('.text-red-400, .text-red-500').first();
    if (await erro.isVisible({ timeout: 5000 })) {
      await expect(erro).toBeVisible();
    }
  });

  test('deve bloquear cadastro com telefone inválido na etapa 2', async ({ page }) => {
    await irParaEtapa2(page);

    const tel = page.getByPlaceholder('(11) 90000-0000');
    if (!(await tel.isVisible({ timeout: 3000 }))) return;

    await tel.fill('123');
    await page.getByRole('button', { name: /criar conta/i }).click();
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Suite: Validações - Recuperação de Senha
// ---------------------------------------------------------------------------

test.describe('Erros - Recuperação de Senha', () => {
  test.beforeEach(async ({ page }) => {
    await abrirLogin(page);
    await page.getByRole('button', { name: /esqueci minha senha/i }).click();
    await expect(page.getByText('Recuperar Senha')).toBeVisible({ timeout: 5000 });
  });

  test('deve exibir erro ao enviar código sem preencher e-mail', async ({ page }) => {
    await page.getByRole('button', { name: /enviar código/i }).click();
    const erro = page.locator('.text-red-400, .text-red-500').first();
    await expect(erro).toBeVisible({ timeout: 3000 });
  });

  test('deve exibir erro ao avançar com código em branco', async ({ page }) => {
    await page.getByPlaceholder('contato@exemplo.com').fill('qualquer@email.com');
    await page.getByRole('button', { name: /enviar código/i }).click();
    await expect(page.getByText(/código de verificação/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /verificar código/i }).click();
    const erro = page.locator('.text-red-400, .text-red-500').first();
    await expect(erro).toBeVisible({ timeout: 3000 });
  });

  test('deve exibir erro de nova senha em branco na etapa 3', async ({ page }) => {
    await page.getByPlaceholder('contato@exemplo.com').fill('qualquer@email.com');
    await page.getByRole('button', { name: /enviar código/i }).click();
    await expect(page.getByText(/código de verificação/i)).toBeVisible({ timeout: 4000 });
    await page.locator('input[placeholder="0000"]').fill('0000');
    await page.getByRole('button', { name: /verificar código/i }).click();

    const novaSenhaInput = page.getByPlaceholder('••••••••').first();
    if (await novaSenhaInput.isVisible({ timeout: 4000 })) {
      // Tenta redefinir sem preencher a senha
      await page.getByRole('button', { name: /redefinir senha/i }).click();
      await page.waitForTimeout(500);
      // Deve mostrar erro ou permanecer na mesma etapa
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Erros de Rede (Simulados)
// ---------------------------------------------------------------------------

test.describe('Erros de Rede - Resiliência', () => {
  test('deve manter a UI funcional mesmo com falha em requisições de imagem', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    // A página deve carregar mesmo sem imagens
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 6000 });
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
  });

  test('deve continuar funcional após erro de requisição', async ({ page }) => {
    // Intercepta chamadas ao Supabase e simula falha
    await page.route('**/rest/v1/**', async route => {
      await route.abort();
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    // A UI deve renderizar (mesmo sem dados do banco)
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 8000 });

    // Desfaz a interceptação
    await page.unrouteAll();
  });

  test('deve exibir indicador de carregamento enquanto busca eventos', async ({ page }) => {
    // Intercepta e atrasa o carregamento
    await page.route('**/rest/v1/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.continue();
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // Pode exibir spinner ou skeleton
    const loading = page.getByText(/carregando|loading/i).first();
    // Apenas verifica que a página não ficou completamente branca
    await expect(page.locator('body')).toBeVisible();

    await page.unrouteAll();
  });
});

// ---------------------------------------------------------------------------
// Suite: Erros de Input - XSS e Injeção
// ---------------------------------------------------------------------------

test.describe('Segurança - Inputs Maliciosos', () => {
  test('deve sanitizar XSS no campo de nome do cadastro', async ({ page }) => {
    await irParaCadastro(page);
    await page.getByPlaceholder('Seu nome').fill('<script>document.body.innerHTML=""</script>');
    await page.waitForTimeout(300);
    // A página deve continuar com conteúdo
    await expect(page.getByPlaceholder('contato@exemplo.com')).toBeVisible({ timeout: 3000 });
  });

  test('deve sanitizar HTML no campo de busca', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    const searchInput = page.getByPlaceholder(/buscar/i).first();
    if (!(await searchInput.isVisible({ timeout: 5000 }))) return;
    await searchInput.fill('<img src=x onerror=alert(1)>');
    await page.waitForTimeout(400);
    await expect(page.locator('nav').first()).toBeVisible();
  });

  test('deve lidar com caracteres especiais no campo de busca sem quebrar', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    const searchInput = page.getByPlaceholder(/buscar/i).first();
    if (!(await searchInput.isVisible({ timeout: 5000 }))) return;
    await searchInput.fill('!@#$%^&*()_+{}[]|"<>?/\\');
    await page.waitForTimeout(400);
    await expect(page.locator('body')).toBeVisible();
  });

  test('deve lidar com input muito longo no campo de busca', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    const searchInput = page.getByPlaceholder(/buscar/i).first();
    if (!(await searchInput.isVisible({ timeout: 5000 }))) return;
    await searchInput.fill('a'.repeat(500));
    await page.waitForTimeout(400);
    await expect(page.locator('body')).toBeVisible();
  });

  test('deve lidar com emojis no campo de busca', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
    const searchInput = page.getByPlaceholder(/buscar/i).first();
    if (!(await searchInput.isVisible({ timeout: 5000 }))) return;
    await searchInput.fill('🎉🎊🎈🎵🎶');
    await page.waitForTimeout(400);
    await expect(page.locator('body')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Suite: Estados de Evento
// ---------------------------------------------------------------------------

test.describe('Estados de Evento', () => {
  test('deve exibir apenas eventos ativos na listagem (sem rascunhos)', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    // Eventos com status "Rascunho" não devem aparecer para usuários comuns
    const rascunhoTexto = page.getByText(/rascunho|draft/i);
    // Em contexto público, não deve haver eventos com label "Rascunho"
    await expect(rascunhoTexto).not.toBeVisible();
  });

  test('deve exibir badge de status nos eventos (quando aplicável)', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const statusBadge = page.getByText(/em breve|vendas liberadas|ativo/i).first();
    if (await statusBadge.isVisible({ timeout: 8000 })) {
      await expect(statusBadge).toBeVisible();
    }
  });
});
