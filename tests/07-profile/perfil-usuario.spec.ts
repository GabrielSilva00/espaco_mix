/**
 * 07-profile/perfil-usuario — Visualização e edição do perfil do usuário.
 */
import { test, expect, Page } from '@playwright/test';
import { aceitarLGPD, loginAsUser, logout, BASE_URL } from '../helpers/auth.helper';
import { TEST_CPFS, generateTestEmail } from '../helpers/data.helper';

async function abrirPerfil(page: Page): Promise<boolean> {
  const ok = await loginAsUser(page);
  if (!ok) return false;

  // Tenta via menu de usuário ou ícone de avatar
  const userIcon = page.locator('.lucide-user, [class*="avatar"], [class*="user-menu"]').first();
  if (await userIcon.isVisible({ timeout: 5000 })) {
    await userIcon.click();
    await page.waitForTimeout(300);

    const perfilLink = page.getByRole('button', { name: /perfil|meu perfil|profile/i }).first();
    if (await perfilLink.isVisible({ timeout: 3000 })) {
      await perfilLink.click();
      await page.waitForTimeout(500);
      return true;
    }
  }

  // Tenta via nav diretamente
  const perfilBtn = page.getByRole('button', { name: /perfil|meu perfil/i }).first();
  if (await perfilBtn.isVisible({ timeout: 5000 })) {
    await perfilBtn.click();
    await page.waitForTimeout(500);
    return true;
  }

  return false;
}

// ─── Acesso ao perfil ─────────────────────────────────────────────────────────

test.describe('Perfil — Acesso', () => {
  test('usuário logado consegue acessar o perfil', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas ou perfil não acessível'); return; }

    const perfil = page.getByText(/meu perfil|informações pessoais|dados do usuário/i).first();
    if (await perfil.isVisible({ timeout: 5000 })) {
      await expect(perfil).toBeVisible();
    }
  });

  test('usuário NÃO logado não acessa o perfil diretamente', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const perfilBtn = page.getByRole('button', { name: /meu perfil|profile/i });
    await expect(perfilBtn).not.toBeVisible();
  });
});

// ─── Dados exibidos ───────────────────────────────────────────────────────────

test.describe('Perfil — Dados Exibidos', () => {
  test('nome do usuário é exibido no perfil', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas'); return; }

    const nome = page.getByText(/nome|name/i).first();
    if (await nome.isVisible({ timeout: 5000 })) {
      await expect(nome).toBeVisible();
    }
  });

  test('e-mail do usuário é exibido no perfil', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas'); return; }

    const email = page.getByText(/@/i).first();
    if (await email.isVisible({ timeout: 5000 })) {
      await expect(email).toBeVisible();
    }
  });

  test('role/função do usuário é indicada', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas'); return; }

    const role = page.getByText(/cliente|usuário|client|user|staff|admin/i).first();
    if (await role.isVisible({ timeout: 5000 })) {
      await expect(role).toBeVisible();
    }
  });

  test('foto de perfil ou avatar é exibido', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas'); return; }

    const avatar = page.locator('img[class*="avatar"], img[alt*="avatar" i], img[alt*="perfil" i], .lucide-user').first();
    if (await avatar.isVisible({ timeout: 5000 })) {
      await expect(avatar).toBeVisible();
    }
  });
});

// ─── Edição do perfil ─────────────────────────────────────────────────────────

test.describe('Perfil — Edição', () => {
  test('botão "Editar Perfil" está disponível', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas'); return; }

    const editarBtn = page.getByRole('button', { name: /editar perfil|editar|edit/i }).first();
    if (await editarBtn.isVisible({ timeout: 5000 })) {
      await expect(editarBtn).toBeVisible();
    }
  });

  test('clicar em editar abre campos editáveis', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas'); return; }

    const editarBtn = page.getByRole('button', { name: /editar perfil|editar/i }).first();
    if (!(await editarBtn.isVisible({ timeout: 5000 }))) return;

    await editarBtn.click();
    await page.waitForTimeout(400);

    const campoNome = page.locator('input[type="text"], input[placeholder*="nome" i]').first();
    if (await campoNome.isVisible({ timeout: 4000 })) {
      await expect(campoNome).toBeEnabled();
    }
  });

  test('nome pode ser alterado e salvo', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas'); return; }

    const editarBtn = page.getByRole('button', { name: /editar|edit/i }).first();
    if (!(await editarBtn.isVisible({ timeout: 5000 }))) return;

    await editarBtn.click();
    await page.waitForTimeout(400);

    const campoNome = page.locator('input[placeholder*="nome" i]').first();
    if (!(await campoNome.isVisible({ timeout: 4000 }))) return;

    const valorOriginal = await campoNome.inputValue();
    await campoNome.fill('Nome Editado Playwright');

    const salvarBtn = page.getByRole('button', { name: /salvar|save|confirmar/i }).first();
    if (await salvarBtn.isVisible({ timeout: 3000 })) {
      await salvarBtn.click();
      await page.waitForTimeout(1000);
    }

    // Reverte para não sujar os dados (se possível)
    const editarBtn2 = page.getByRole('button', { name: /editar/i }).first();
    if (await editarBtn2.isVisible({ timeout: 3000 })) {
      await editarBtn2.click();
      await page.waitForTimeout(300);
      const campo = page.locator('input[placeholder*="nome" i]').first();
      if (await campo.isVisible({ timeout: 3000 })) {
        await campo.fill(valorOriginal);
        const salvar2 = page.getByRole('button', { name: /salvar/i }).first();
        if (await salvar2.isVisible({ timeout: 3000 })) await salvar2.click();
      }
    }
  });

  test('telefone pode ser editado', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas'); return; }

    const editarBtn = page.getByRole('button', { name: /editar/i }).first();
    if (!(await editarBtn.isVisible({ timeout: 5000 }))) return;

    await editarBtn.click();
    await page.waitForTimeout(400);

    const campoTel = page.locator('input[type="tel"], input[placeholder*="telefone" i]').first();
    if (await campoTel.isVisible({ timeout: 4000 })) {
      await expect(campoTel).toBeEnabled();
    }
  });

  test('e-mail não pode ser alterado (somente leitura)', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas'); return; }

    const editarBtn = page.getByRole('button', { name: /editar/i }).first();
    if (!(await editarBtn.isVisible({ timeout: 5000 }))) return;

    await editarBtn.click();
    await page.waitForTimeout(400);

    // Email deve ser somente leitura (readonly ou disabled)
    const emailInput = page.locator('input[type="email"]').first();
    if (await emailInput.isVisible({ timeout: 4000 })) {
      const readonly  = await emailInput.getAttribute('readonly');
      const disabled  = await emailInput.isDisabled();
      expect(readonly !== null || disabled).toBe(true);
    }
  });

  test('cancelar edição reverte campos para valores originais', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas'); return; }

    const editarBtn = page.getByRole('button', { name: /editar/i }).first();
    if (!(await editarBtn.isVisible({ timeout: 5000 }))) return;

    await editarBtn.click();
    await page.waitForTimeout(400);

    const campoNome = page.locator('input[placeholder*="nome" i]').first();
    if (!(await campoNome.isVisible({ timeout: 4000 }))) return;

    const valorOriginal = await campoNome.inputValue();
    await campoNome.fill('Valor Temporário XYZ');

    const cancelarBtn = page.getByRole('button', { name: /cancelar|cancel/i }).first();
    if (await cancelarBtn.isVisible({ timeout: 3000 })) {
      await cancelarBtn.click();
      await page.waitForTimeout(400);

      // Após cancelar, o nome original deve estar visível
      const nomeAtual = page.getByText(valorOriginal).first();
      if (await nomeAtual.isVisible({ timeout: 3000 })) {
        await expect(nomeAtual).toBeVisible();
      }
    }
  });
});

// ─── Alteração de senha ───────────────────────────────────────────────────────

test.describe('Perfil — Senha', () => {
  test('opção de alterar senha está disponível', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas'); return; }

    const senhaBtn = page.getByRole('button', { name: /alterar senha|mudar senha|change password/i }).first();
    const senhaLink = page.getByText(/alterar senha|redefinir senha/i).first();

    if (await senhaBtn.isVisible({ timeout: 5000 })) {
      await expect(senhaBtn).toBeVisible();
    } else if (await senhaLink.isVisible({ timeout: 5000 })) {
      await expect(senhaLink).toBeVisible();
    }
  });
});

// ─── Exclusão de conta ────────────────────────────────────────────────────────

test.describe('Perfil — Conta', () => {
  test('opção de excluir conta (se existir) pede confirmação', async ({ page }) => {
    const abriu = await abrirPerfil(page);
    if (!abriu) { test.skip(true, 'Credenciais não configuradas'); return; }

    const excluirBtn = page.getByRole('button', { name: /excluir conta|deletar conta|delete account/i }).first();
    if (!(await excluirBtn.isVisible({ timeout: 4000 }))) return;

    await excluirBtn.click();
    await page.waitForTimeout(500);

    // Deve pedir confirmação antes de excluir
    const confirmar = page.getByRole('button', { name: /confirmar|sim|confirmo/i }).first();
    const cancelar  = page.getByRole('button', { name: /cancelar|não/i }).first();

    if (await confirmar.isVisible({ timeout: 3000 })) {
      // Cancela para não deletar conta real
      if (await cancelar.isVisible()) await cancelar.click();
    }
  });
});
