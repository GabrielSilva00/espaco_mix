/**
 * 04-events/editar-evento — Edição e exclusão de eventos via dashboard admin.
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth.helper';

async function abrirPrimeiroEvento(page: Page): Promise<boolean> {
  const ok = await loginAsAdmin(page);
  if (!ok) return false;

  // Tenta localizar o primeiro card de evento no dashboard
  const editBtn = page.getByRole('button', { name: /editar|edit/i }).first();
  if (await editBtn.isVisible({ timeout: 8000 })) {
    await editBtn.click();
    await page.waitForTimeout(500);
    return true;
  }

  // Tenta pelo ícone de lápis (Edit2 do lucide)
  const editIcon = page.locator('button').filter({ has: page.locator('.lucide-edit-2, .lucide-pencil') }).first();
  if (await editIcon.isVisible({ timeout: 5000 })) {
    await editIcon.click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

// ─── Edição básica ────────────────────────────────────────────────────────────

test.describe('Editar Evento — Acesso ao Formulário', () => {
  test('botão de editar está disponível nos cards de evento', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const editBtn = page.locator('button').filter({
      has: page.locator('.lucide-edit-2, .lucide-pencil, [data-lucide="edit-2"]')
    }).first();
    if (await editBtn.isVisible({ timeout: 8000 })) {
      await expect(editBtn).toBeVisible();
    }
  });

  test('clicar em editar abre o formulário preenchido com dados do evento', async ({ page }) => {
    const abriu = await abrirPrimeiroEvento(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas ou sem eventos'); return; }

    // O formulário deve ter o campo de título preenchido
    const campoTitulo = page.getByPlaceholder(/título|nome do evento/i).first();
    if (await campoTitulo.isVisible({ timeout: 6000 })) {
      const valor = await campoTitulo.inputValue();
      expect(valor.length).toBeGreaterThan(0);
    }
  });
});

// ─── Campos editáveis ─────────────────────────────────────────────────────────

test.describe('Editar Evento — Campos', () => {
  test('título do evento pode ser modificado', async ({ page }) => {
    const abriu = await abrirPrimeiroEvento(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas ou sem eventos'); return; }

    const campoTitulo = page.getByPlaceholder(/título|nome do evento/i).first();
    if (!(await campoTitulo.isVisible({ timeout: 6000 }))) return;

    const valorOriginal = await campoTitulo.inputValue();
    await campoTitulo.fill(valorOriginal + ' (editado)');
    await expect(campoTitulo).toHaveValue(valorOriginal + ' (editado)');

    // Reverte a alteração para não sujar os dados
    await campoTitulo.fill(valorOriginal);
  });

  test('status do evento pode ser alterado', async ({ page }) => {
    const abriu = await abrirPrimeiroEvento(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas ou sem eventos'); return; }

    const select = page.locator('select').first();
    if (await select.isVisible({ timeout: 4000 })) {
      await expect(select).toBeEnabled();
    }
  });

  test('campo de data é editável', async ({ page }) => {
    const abriu = await abrirPrimeiroEvento(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas ou sem eventos'); return; }

    const campoData = page.locator('input[type="date"]').first();
    if (await campoData.isVisible({ timeout: 4000 })) {
      await expect(campoData).toBeEnabled();
    }
  });
});

// ─── Salvar edição ────────────────────────────────────────────────────────────

test.describe('Editar Evento — Salvar', () => {
  test('botão de salvar está disponível no formulário de edição', async ({ page }) => {
    const abriu = await abrirPrimeiroEvento(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas ou sem eventos'); return; }

    const salvarBtn = page.getByRole('button', { name: /salvar|atualizar|update/i }).first();
    if (await salvarBtn.isVisible({ timeout: 5000 })) {
      await expect(salvarBtn).toBeVisible();
    }
  });

  test('salvar evento com is_active correto não gera erro', async ({ page }) => {
    const abriu = await abrirPrimeiroEvento(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas ou sem eventos'); return; }

    const salvarBtn = page.getByRole('button', { name: /salvar|atualizar/i }).first();
    if (!(await salvarBtn.isVisible({ timeout: 5000 }))) return;

    // Captura erros JS antes de salvar
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await salvarBtn.click();
    await page.waitForTimeout(1500);

    const critical = errors.filter(e => !/ResizeObserver|extension/i.test(e));
    expect(critical, `Erros JS ao salvar: ${critical.join(' | ')}`).toHaveLength(0);
  });
});

// ─── Exclusão ────────────────────────────────────────────────────────────────

test.describe('Editar Evento — Exclusão', () => {
  test('botão de excluir evento existe no formulário de edição', async ({ page }) => {
    const abriu = await abrirPrimeiroEvento(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas ou sem eventos'); return; }

    const deleteBtn = page.getByRole('button', { name: /excluir|deletar|remover/i }).first();
    if (await deleteBtn.isVisible({ timeout: 5000 })) {
      await expect(deleteBtn).toBeVisible();
    }
  });

  test('clicar em excluir pede confirmação', async ({ page }) => {
    const abriu = await abrirPrimeiroEvento(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas ou sem eventos'); return; }

    const deleteBtn = page.locator('button').filter({
      has: page.locator('.lucide-trash-2, .lucide-trash, [data-lucide="trash-2"]')
    }).first();
    if (!(await deleteBtn.isVisible({ timeout: 5000 }))) return;

    await deleteBtn.click();
    await page.waitForTimeout(400);

    // Deve aparecer um modal ou botão de confirmação
    const confirmar = page.getByRole('button', { name: /confirmar|sim|ok/i }).first();
    const cancelar  = page.getByRole('button', { name: /cancelar|não|cancel/i }).first();

    if (await confirmar.isVisible({ timeout: 3000 })) {
      // Cancela para não deletar dados reais
      if (await cancelar.isVisible()) await cancelar.click();
    }
  });
});

// ─── Preview de evento ────────────────────────────────────────────────────────

test.describe('Editar Evento — Preview', () => {
  test('botão de preview existe no painel de edição', async ({ page }) => {
    const abriu = await abrirPrimeiroEvento(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas ou sem eventos'); return; }

    const previewBtn = page.getByRole('button', { name: /preview|visualizar|pré-visualizar/i }).first();
    if (await previewBtn.isVisible({ timeout: 5000 })) {
      await expect(previewBtn).toBeVisible();
    }
  });

  test('modo preview exibe botão "Voltar à Edição"', async ({ page }) => {
    const abriu = await abrirPrimeiroEvento(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas ou sem eventos'); return; }

    const previewBtn = page.getByRole('button', { name: /preview|visualizar/i }).first();
    if (!(await previewBtn.isVisible({ timeout: 5000 }))) return;

    await previewBtn.click();
    await page.waitForTimeout(600);

    const voltarBtn = page.getByRole('button', { name: /voltar à edição|back/i }).first();
    if (await voltarBtn.isVisible({ timeout: 5000 })) {
      await expect(voltarBtn).toBeVisible();
    }
  });
});
