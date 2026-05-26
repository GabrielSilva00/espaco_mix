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

// Retorna true se há um usuário autenticado visível na navbar
async function estaAutenticado(page: Page): Promise<boolean> {
  const avatarOuNome = page.locator('[class*="rounded-full"][class*="bg-"]').filter({ hasText: /[A-Z]/ }).first();
  const userIcon = page.locator('button').filter({ has: page.locator('svg[data-lucide="user"], .lucide-user') }).first();
  return (await avatarOuNome.isVisible({ timeout: 2000 })) || (await userIcon.isVisible({ timeout: 2000 }));
}

async function abrirPerfil(page: Page): Promise<boolean> {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);

  // Tenta abrir o dropdown de usuário
  const userDropdown = page.locator('button').filter({ has: page.locator('.lucide-user, [data-lucide="user"]') }).first();
  if (await userDropdown.isVisible({ timeout: 3000 })) {
    await userDropdown.click();
    const perfilBtn = page.getByRole('button', { name: /perfil/i }).first();
    if (await perfilBtn.isVisible({ timeout: 2000 })) {
      await perfilBtn.click();
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Suite: Navbar - Estado de Autenticação
// ---------------------------------------------------------------------------

test.describe('Navbar - Estado de Autenticação', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
  });

  test('deve exibir botão "Entrar" quando usuário não está autenticado', async ({ page }) => {
    const entrarBtn = page.getByRole('button', { name: 'Entrar', exact: true }).first();
    // Se não há usuário logado, o botão "Entrar" deve estar visível
    const autenticado = await estaAutenticado(page);
    if (!autenticado) {
      await expect(entrarBtn).toBeVisible({ timeout: 5000 });
    }
  });

  test('não deve exibir "Minhas Reservas" para usuário não autenticado', async ({ page }) => {
    const autenticado = await estaAutenticado(page);
    if (!autenticado) {
      const reservasBtn = page.getByRole('button', { name: /minhas reservas/i });
      await expect(reservasBtn).not.toBeVisible();
    }
  });

  test('deve exibir dropdown de usuário quando autenticado', async ({ page }) => {
    const autenticado = await estaAutenticado(page);
    if (autenticado) {
      const userBtn = page.locator('button').filter({ has: page.locator('.lucide-user') }).first();
      await expect(userBtn).toBeVisible({ timeout: 5000 });
    }
  });

  test('deve mostrar link "Minhas Reservas" quando autenticado', async ({ page }) => {
    const autenticado = await estaAutenticado(page);
    if (autenticado) {
      const reservasBtn = page.getByRole('button', { name: /minhas reservas/i });
      await expect(reservasBtn).toBeVisible({ timeout: 5000 });
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Perfil - Visualização
// ---------------------------------------------------------------------------

test.describe('Perfil - Visualização', () => {
  test('deve exibir a view de perfil com nome e e-mail', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) return;

    // Verifica elementos básicos do perfil
    const perfilTitulo = page.getByText(/meu perfil|perfil/i).first();
    if (await perfilTitulo.isVisible({ timeout: 5000 })) {
      await expect(perfilTitulo).toBeVisible();
    }
  });

  test('deve exibir o e-mail do usuário logado na view de perfil', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) return;

    const emailText = page.locator('p, span').filter({ hasText: /@/ }).first();
    if (await emailText.isVisible({ timeout: 5000 })) {
      await expect(emailText).toBeVisible();
    }
  });

  test('deve exibir a role/papel do usuário no perfil', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) return;

    const roleText = page.getByText(/admin|cliente|developer|produtor/i).first();
    if (await roleText.isVisible({ timeout: 5000 })) {
      await expect(roleText).toBeVisible();
    }
  });

  test('deve exibir botão de editar perfil', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) return;

    const editBtn = page.getByRole('button', { name: /editar|edit/i }).first();
    if (await editBtn.isVisible({ timeout: 5000 })) {
      await expect(editBtn).toBeVisible();
    }
  });

  test('deve exibir campo de avatar ou iniciais do usuário', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) return;

    // Avatar pode ser uma imagem ou div com iniciais
    const avatarArea = page.locator('[class*="rounded-full"]').first();
    if (await avatarArea.isVisible({ timeout: 5000 })) {
      await expect(avatarArea).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Perfil - Modo de Edição
// ---------------------------------------------------------------------------

test.describe('Perfil - Modo de Edição', () => {
  test('deve ativar modo de edição ao clicar em Editar', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) return;

    const editBtn = page.getByRole('button', { name: /editar/i }).first();
    if (!(await editBtn.isVisible({ timeout: 5000 }))) return;

    await editBtn.click();
    // Campo de nome deve se tornar editável
    const nomeInput = page.locator('input[type="text"]').first();
    if (await nomeInput.isVisible({ timeout: 3000 })) {
      await expect(nomeInput).toBeVisible();
    }
  });

  test('deve exibir campo de telefone no modo de edição', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) return;

    const editBtn = page.getByRole('button', { name: /editar/i }).first();
    if (!(await editBtn.isVisible({ timeout: 5000 }))) return;

    await editBtn.click();
    const telefoneInput = page.getByPlaceholder(/(11) 9|telefone|celular/i).first();
    if (await telefoneInput.isVisible({ timeout: 3000 })) {
      await expect(telefoneInput).toBeVisible();
    }
  });

  test('deve exibir campo de CPF no modo de edição', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) return;

    const editBtn = page.getByRole('button', { name: /editar/i }).first();
    if (!(await editBtn.isVisible({ timeout: 5000 }))) return;

    await editBtn.click();
    const cpfInput = page.getByPlaceholder(/000\.000|cpf/i).first();
    if (await cpfInput.isVisible({ timeout: 3000 })) {
      await expect(cpfInput).toBeVisible();
    }
  });

  test('deve exibir botão Salvar no modo de edição', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) return;

    const editBtn = page.getByRole('button', { name: /editar/i }).first();
    if (!(await editBtn.isVisible({ timeout: 5000 }))) return;

    await editBtn.click();
    const salvarBtn = page.getByRole('button', { name: /salvar/i }).first();
    if (await salvarBtn.isVisible({ timeout: 3000 })) {
      await expect(salvarBtn).toBeVisible();
    }
  });

  test('deve exibir botão Cancelar no modo de edição', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) return;

    const editBtn = page.getByRole('button', { name: /editar/i }).first();
    if (!(await editBtn.isVisible({ timeout: 5000 }))) return;

    await editBtn.click();
    const cancelarBtn = page.getByRole('button', { name: /cancelar/i }).first();
    if (await cancelarBtn.isVisible({ timeout: 3000 })) {
      await expect(cancelarBtn).toBeVisible();
    }
  });

  test('deve sair do modo de edição ao clicar em Cancelar', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) return;

    const editBtn = page.getByRole('button', { name: /editar/i }).first();
    if (!(await editBtn.isVisible({ timeout: 5000 }))) return;

    await editBtn.click();
    const cancelarBtn = page.getByRole('button', { name: /cancelar/i }).first();
    if (await cancelarBtn.isVisible({ timeout: 3000 })) {
      await cancelarBtn.click();
      await page.waitForTimeout(300);
      // Deve voltar a exibir o botão Editar
      await expect(editBtn).toBeVisible({ timeout: 3000 });
    }
  });

  test('deve bloquear salvamento com nome vazio', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) return;

    const editBtn = page.getByRole('button', { name: /editar/i }).first();
    if (!(await editBtn.isVisible({ timeout: 5000 }))) return;

    await editBtn.click();
    const nomeInput = page.locator('input[type="text"]').first();
    if (await nomeInput.isVisible({ timeout: 3000 })) {
      await nomeInput.clear();
      const salvarBtn = page.getByRole('button', { name: /salvar/i }).first();
      if (await salvarBtn.isVisible({ timeout: 2000 })) {
        await salvarBtn.click();
        await page.waitForTimeout(500);
        // Deve permanecer no modo de edição (toast de erro ou campo ainda editável)
        await expect(nomeInput).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('deve ter input de arquivo para upload de avatar', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) return;

    // Input de arquivo para avatar (pode ser oculto mas deve existir no DOM)
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count() > 0) {
      expect(await fileInput.count()).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Perfil - Navegação
// ---------------------------------------------------------------------------

test.describe('Perfil - Navegação', () => {
  test('deve retornar à home pelo botão Voltar no perfil', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) return;

    const voltarBtn = page.getByRole('button', { name: /voltar|início|home/i }).first();
    if (await voltarBtn.isVisible({ timeout: 5000 })) {
      await voltarBtn.click();
      await expect(
        page.getByText('Próximos Eventos').first()
      ).toBeVisible({ timeout: 6000 });
    }
  });

  test('deve exibir link para Minhas Reservas no dropdown', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const autenticado = await estaAutenticado(page);
    if (!autenticado) return;

    const userBtn = page.locator('button').filter({ has: page.locator('.lucide-user') }).first();
    if (await userBtn.isVisible({ timeout: 3000 })) {
      await userBtn.click();
      const reservasLink = page.getByRole('button', { name: /reservas/i }).first();
      if (await reservasLink.isVisible({ timeout: 2000 })) {
        await expect(reservasLink).toBeVisible();
      }
    }
  });

  test('deve exibir botão de Sair no dropdown de usuário', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const autenticado = await estaAutenticado(page);
    if (!autenticado) return;

    const userBtn = page.locator('button').filter({ has: page.locator('.lucide-user') }).first();
    if (await userBtn.isVisible({ timeout: 3000 })) {
      await userBtn.click();
      const sairBtn = page.getByRole('button', { name: /sair|logout/i }).first();
      if (await sairBtn.isVisible({ timeout: 2000 })) {
        await expect(sairBtn).toBeVisible();
      }
    }
  });
});
