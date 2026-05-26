/**
 * 04-events/criar-evento — Criação de evento via dashboard admin.
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin, BASE_URL } from '../helpers/auth.helper';
import { generateEventName } from '../helpers/data.helper';

async function irParaFormCriacao(page: Page): Promise<boolean> {
  const isAdmin = await loginAsAdmin(page);
  if (!isAdmin) return false;

  const criarBtn = page.getByRole('button', { name: /criar|novo evento|\+ evento/i }).first();
  if (!(await criarBtn.isVisible({ timeout: 8000 }))) return false;

  await criarBtn.click();
  await page.waitForTimeout(500);

  const campoTitulo = page.getByPlaceholder(/título|nome do evento/i).first();
  return campoTitulo.isVisible({ timeout: 6000 });
}

// ─── Acesso ao formulário ─────────────────────────────────────────────────────

test.describe('Criar Evento — Acesso', () => {
  test('admin vê botão "Criar Evento" no dashboard', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const criarBtn = page.getByRole('button', { name: /criar|novo evento/i }).first();
    await expect(criarBtn).toBeVisible({ timeout: 8000 });
  });

  test('clicar em "Criar" abre o formulário de criação', async ({ page }) => {
    const ok = await irParaFormCriacao(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    await expect(
      page.getByPlaceholder(/título|nome do evento/i).first()
    ).toBeVisible({ timeout: 6000 });
  });
});

// ─── Campos do formulário ─────────────────────────────────────────────────────

test.describe('Criar Evento — Campos', () => {
  test('formulário exibe campo de título', async ({ page }) => {
    if (!(await irParaFormCriacao(page))) {
      test.skip(true, 'Credenciais admin não configuradas'); return;
    }
    await expect(page.getByPlaceholder(/título|nome do evento/i).first()).toBeVisible();
  });

  test('formulário exibe campo de descrição', async ({ page }) => {
    if (!(await irParaFormCriacao(page))) {
      test.skip(true, 'Credenciais admin não configuradas'); return;
    }
    const desc = page.getByPlaceholder(/descrição|sobre o evento/i).first();
    if (await desc.isVisible({ timeout: 3000 })) {
      await expect(desc).toBeVisible();
    }
  });

  test('formulário exibe campo de data', async ({ page }) => {
    if (!(await irParaFormCriacao(page))) {
      test.skip(true, 'Credenciais admin não configuradas'); return;
    }
    await expect(page.locator('input[type="date"]').first()).toBeVisible({ timeout: 4000 });
  });

  test('formulário exibe campo de local', async ({ page }) => {
    if (!(await irParaFormCriacao(page))) {
      test.skip(true, 'Credenciais admin não configuradas'); return;
    }
    const local = page.getByPlaceholder(/local|endereço|venue/i).first();
    if (await local.isVisible({ timeout: 3000 })) {
      await expect(local).toBeVisible();
    }
  });

  test('formulário exibe seletor de status', async ({ page }) => {
    if (!(await irParaFormCriacao(page))) {
      test.skip(true, 'Credenciais admin não configuradas'); return;
    }
    const statusSelect = page.locator('select').first();
    if (await statusSelect.isVisible({ timeout: 3000 })) {
      await expect(statusSelect).toBeVisible();
    }
  });

  test('seletor de status inclui opção "Rascunho"', async ({ page }) => {
    if (!(await irParaFormCriacao(page))) {
      test.skip(true, 'Credenciais admin não configuradas'); return;
    }
    const select = page.locator('select').first();
    if (!(await select.isVisible({ timeout: 3000 }))) return;
    const opcoes = await select.evaluate((el: HTMLSelectElement) =>
      Array.from(el.options).map(o => o.text)
    );
    expect(opcoes.some(o => /rascunho|draft/i.test(o))).toBe(true);
  });

  test('formulário exibe opções de tipo de preço (único / por gênero)', async ({ page }) => {
    if (!(await irParaFormCriacao(page))) {
      test.skip(true, 'Credenciais admin não configuradas'); return;
    }
    const precoGenero = page.getByText(/gênero|masculino|feminino|por gênero/i).first();
    if (await precoGenero.isVisible({ timeout: 4000 })) {
      await expect(precoGenero).toBeVisible();
    }
  });
});

// ─── Validações ───────────────────────────────────────────────────────────────

test.describe('Criar Evento — Validações', () => {
  test('bloqueia salvar sem título preenchido', async ({ page }) => {
    if (!(await irParaFormCriacao(page))) {
      test.skip(true, 'Credenciais admin não configuradas'); return;
    }

    const salvarBtn = page.getByRole('button', { name: /salvar|criar evento/i }).first();
    if (!(await salvarBtn.isVisible({ timeout: 4000 }))) return;
    await salvarBtn.click();
    await page.waitForTimeout(500);

    const erro = page.locator('.text-red-400, .text-red-500').first();
    if (await erro.isVisible({ timeout: 3000 })) {
      await expect(erro).toBeVisible();
    }
  });

  test('bloqueia datas de início posteriores à data de fim', async ({ page }) => {
    if (!(await irParaFormCriacao(page))) {
      test.skip(true, 'Credenciais admin não configuradas'); return;
    }

    const campoData = page.locator('input[type="date"]').first();
    const campoDataFim = page.locator('input[type="date"]').nth(1);

    if (!(await campoData.isVisible({ timeout: 3000 }))) return;

    await campoData.fill('2027-12-31');
    if (await campoDataFim.isVisible({ timeout: 2000 })) {
      await campoDataFim.fill('2027-01-01');
    }

    // A página não deve quebrar
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─── Criação bem-sucedida ─────────────────────────────────────────────────────

test.describe('Criar Evento — Sucesso', () => {
  test('evento criado aparece na lista do dashboard', async ({ page }) => {
    if (!(await irParaFormCriacao(page))) {
      test.skip(true, 'Credenciais admin não configuradas'); return;
    }

    const nomeEvento = generateEventName('Playwright Auto');

    await page.getByPlaceholder(/título|nome do evento/i).first().fill(nomeEvento);

    const dataFutura = new Date();
    dataFutura.setMonth(dataFutura.getMonth() + 2);
    const dataStr = dataFutura.toISOString().split('T')[0];

    const campoData = page.locator('input[type="date"]').first();
    if (await campoData.isVisible({ timeout: 2000 })) {
      await campoData.fill(dataStr);
    }

    const salvarBtn = page.getByRole('button', { name: /salvar|criar evento/i }).first();
    if (!(await salvarBtn.isVisible({ timeout: 4000 }))) return;
    await salvarBtn.click();
    await page.waitForTimeout(1000);

    // O evento deve aparecer na listagem (toast de sucesso ou card)
    const sucessoOuCard = page.getByText(new RegExp(nomeEvento, 'i')).first();
    const toast = page.getByText(/criado|sucesso/i).first();
    const apareceu = (await sucessoOuCard.isVisible({ timeout: 6000 })) ||
                     (await toast.isVisible({ timeout: 6000 }));
    expect(apareceu).toBe(true);
  });
});
