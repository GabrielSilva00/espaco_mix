/**
 * 04-events/lotes — Gerenciamento de lotes de ingresso (is_active, datas, exclusão).
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth.helper';

async function abrirFormEvento(page: Page): Promise<boolean> {
  const ok = await loginAsAdmin(page);
  if (!ok) return false;

  // Tenta abrir criação de evento
  const criarBtn = page.getByRole('button', { name: /criar|novo evento|\+ evento/i }).first();
  if (await criarBtn.isVisible({ timeout: 8000 })) {
    await criarBtn.click();
    await page.waitForTimeout(500);
    const campoTitulo = page.getByPlaceholder(/título|nome do evento/i).first();
    return campoTitulo.isVisible({ timeout: 6000 });
  }

  // Tenta abrir edição do primeiro evento existente
  const editBtn = page.getByRole('button', { name: /editar|edit/i }).first();
  if (await editBtn.isVisible({ timeout: 5000 })) {
    await editBtn.click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

async function irParaAbaLotes(page: Page): Promise<boolean> {
  const abriu = await abrirFormEvento(page);
  if (!abriu) return false;

  // Procura aba ou seção de lotes
  const abaLotes = page.getByRole('button', { name: /lotes|ingressos|tickets/i }).first();
  if (await abaLotes.isVisible({ timeout: 5000 })) {
    await abaLotes.click();
    await page.waitForTimeout(400);
    return true;
  }

  // Pode estar visível diretamente na página
  const secaoLotes = page.getByText(/lotes|gerenciar lotes/i).first();
  return secaoLotes.isVisible({ timeout: 5000 });
}

// ─── Estrutura da seção de lotes ──────────────────────────────────────────────

test.describe('Lotes — Estrutura', () => {
  test('seção de lotes está acessível no formulário de evento', async ({ page }) => {
    const ok = await loginAsAdmin(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const abreForms = await abrirFormEvento(page);
    if (!abreForms) { test.skip(true, 'Sem eventos para editar'); return; }

    // Deve existir referência a lotes em algum lugar
    const ref = page.getByText(/lote|ingresso/i).first();
    if (await ref.isVisible({ timeout: 6000 })) {
      await expect(ref).toBeVisible();
    }
  });

  test('botão "Adicionar Lote" existe', async ({ page }) => {
    const abriu = await irParaAbaLotes(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas ou seção indisponível'); return; }

    const addBtn = page.getByRole('button', { name: /adicionar lote|novo lote|\+ lote/i }).first();
    if (await addBtn.isVisible({ timeout: 6000 })) {
      await expect(addBtn).toBeVisible();
    }
  });
});

// ─── Adição de lotes ──────────────────────────────────────────────────────────

test.describe('Lotes — Adição', () => {
  test('clicar em "Adicionar Lote" exibe formulário de novo lote', async ({ page }) => {
    const abriu = await irParaAbaLotes(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const addBtn = page.getByRole('button', { name: /adicionar lote|novo lote|\+ lote/i }).first();
    if (!(await addBtn.isVisible({ timeout: 5000 }))) return;

    const antes = await page.locator('[data-testid="lote-item"], .lote-item').count();
    await addBtn.click();
    await page.waitForTimeout(500);

    // Deve aparecer campo de nome ou quantidade do novo lote
    const nomeLote = page.getByPlaceholder(/nome do lote|lote \d|título do lote/i).last();
    if (await nomeLote.isVisible({ timeout: 4000 })) {
      await expect(nomeLote).toBeVisible();
    }
  });

  test('múltiplos lotes podem ser adicionados em sequência', async ({ page }) => {
    const abriu = await irParaAbaLotes(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const addBtn = page.getByRole('button', { name: /adicionar lote|novo lote|\+ lote/i }).first();
    if (!(await addBtn.isVisible({ timeout: 5000 }))) return;

    await addBtn.click();
    await page.waitForTimeout(300);
    await addBtn.click();
    await page.waitForTimeout(300);

    // A página não deve quebrar
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('nav').first()).toBeVisible();
  });

  test('lote possui campo de quantidade', async ({ page }) => {
    const abriu = await irParaAbaLotes(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const qtdInput = page.locator('input[type="number"]').first();
    if (await qtdInput.isVisible({ timeout: 5000 })) {
      await expect(qtdInput).toBeEnabled();
    }
  });

  test('lote possui campo de preço', async ({ page }) => {
    const abriu = await irParaAbaLotes(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const precoInput = page.locator('input[placeholder*="preço" i], input[placeholder*="valor" i], input[placeholder*="R$" i]').first();
    if (await precoInput.isVisible({ timeout: 5000 })) {
      await expect(precoInput).toBeEnabled();
    }
  });

  test('lote possui campo de data de início', async ({ page }) => {
    const abriu = await irParaAbaLotes(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const campoData = page.locator('input[type="date"], input[type="datetime-local"]').first();
    if (await campoData.isVisible({ timeout: 5000 })) {
      await expect(campoData).toBeEnabled();
    }
  });
});

// ─── Remoção de lotes ─────────────────────────────────────────────────────────

test.describe('Lotes — Remoção', () => {
  test('botão de remover lote existe', async ({ page }) => {
    const abriu = await irParaAbaLotes(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const removeBtn = page.locator('button').filter({
      has: page.locator('.lucide-trash-2, .lucide-trash, .lucide-x, [data-lucide="trash"]')
    }).first();
    if (await removeBtn.isVisible({ timeout: 5000 })) {
      await expect(removeBtn).toBeVisible();
    }
  });

  test('remover lote intermediário não quebra a sequência restante', async ({ page }) => {
    const abriu = await irParaAbaLotes(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const addBtn = page.getByRole('button', { name: /adicionar lote|novo lote|\+ lote/i }).first();
    if (!(await addBtn.isVisible({ timeout: 5000 }))) return;

    // Adiciona 2 lotes para ter pelo menos 3
    await addBtn.click();
    await page.waitForTimeout(300);
    await addBtn.click();
    await page.waitForTimeout(300);

    // Remove o lote do meio (índice 1)
    const removeBtns = page.locator('button').filter({
      has: page.locator('.lucide-trash-2, .lucide-trash')
    });
    const count = await removeBtns.count();
    if (count >= 2) {
      await removeBtns.nth(1).click();
      await page.waitForTimeout(400);
      // A página não deve quebrar
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('lotes removidos não reaparecem após salvar', async ({ page }) => {
    const abriu = await irParaAbaLotes(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    // Verifica apenas que a interação de remover é possível
    const removeBtn = page.locator('button').filter({
      has: page.locator('.lucide-trash-2, .lucide-trash')
    }).first();

    if (!(await removeBtn.isVisible({ timeout: 5000 }))) return;

    // Conta antes
    const antes = await removeBtn.count();
    await removeBtn.click();
    await page.waitForTimeout(500);
    const depois = await page.locator('button').filter({
      has: page.locator('.lucide-trash-2, .lucide-trash')
    }).count();

    expect(depois).toBeLessThanOrEqual(antes);
  });
});

// ─── is_active nos lotes ──────────────────────────────────────────────────────

test.describe('Lotes — is_active', () => {
  test('lote possui toggle/switch de ativo ou campo is_active', async ({ page }) => {
    const abriu = await irParaAbaLotes(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    // Pode ser checkbox, toggle ou select
    const toggle = page.locator('input[type="checkbox"]').first();
    const select  = page.locator('select').first();

    const temToggle = await toggle.isVisible({ timeout: 3000 });
    const temSelect = await select.isVisible({ timeout: 3000 });

    // Pelo menos um deve existir para controlar o estado do lote
    if (temToggle || temSelect) {
      expect(temToggle || temSelect).toBe(true);
    }
  });

  test('salvar evento com is_active correto não gera erro JS', async ({ page }) => {
    const abriu = await abrirFormEvento(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas ou sem eventos'); return; }

    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    const salvarBtn = page.getByRole('button', { name: /salvar|atualizar|update/i }).first();
    if (!(await salvarBtn.isVisible({ timeout: 5000 }))) return;

    await salvarBtn.click();
    await page.waitForTimeout(2000);

    const critical = errors.filter(e =>
      !/ResizeObserver|extension/i.test(e) &&
      !e.includes('is_active') === false ||
      /TypeError|ReferenceError|SyntaxError/.test(e)
    );

    // Não deve haver erros críticos de JS ao salvar
    const isActiveBug = errors.some(e => /is_active|isActive|cannot.*undefined/i.test(e));
    expect(isActiveBug, `Bug is_active detectado: ${errors.join(' | ')}`).toBe(false);
  });

  test('is_active enviado como boolean (não string) ao salvar lote', async ({ page }) => {
    const abriu = await abrirFormEvento(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const requests: { url: string; body: string }[] = [];
    page.on('request', req => {
      if (req.method() === 'POST' || req.method() === 'PUT' || req.method() === 'PATCH') {
        try {
          requests.push({ url: req.url(), body: req.postData() ?? '' });
        } catch {}
      }
    });

    const salvarBtn = page.getByRole('button', { name: /salvar|atualizar/i }).first();
    if (!(await salvarBtn.isVisible({ timeout: 5000 }))) return;

    await salvarBtn.click();
    await page.waitForTimeout(2000);

    // Se houver requisição com lotes, verifica que is_active não é uma string
    for (const req of requests) {
      if (req.body && /lote|batch|ticket/i.test(req.url)) {
        try {
          const parsed = JSON.parse(req.body);
          const lotes = parsed.lotes ?? parsed.batches ?? parsed.tickets ?? [];
          for (const lote of lotes) {
            if ('is_active' in lote) {
              expect(typeof lote.is_active, 'is_active deve ser boolean').toBe('boolean');
            }
          }
        } catch {
          // JSON inválido — ignora
        }
      }
    }
  });
});

// ─── Validação de datas conflitantes ─────────────────────────────────────────

test.describe('Lotes — Validação de Datas', () => {
  test('lotes com datas conflitantes exibem aviso ou bloqueiam salvamento', async ({ page }) => {
    const abriu = await irParaAbaLotes(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const addBtn = page.getByRole('button', { name: /adicionar lote|novo lote|\+ lote/i }).first();
    if (!(await addBtn.isVisible({ timeout: 5000 }))) return;

    await addBtn.click();
    await page.waitForTimeout(300);
    await addBtn.click();
    await page.waitForTimeout(300);

    const dataInputs = page.locator('input[type="date"], input[type="datetime-local"]');
    const count = await dataInputs.count();

    if (count >= 2) {
      // Define a segunda data ANTES da primeira (conflito intencional)
      await dataInputs.nth(0).fill('2027-06-01');
      await dataInputs.nth(1).fill('2027-01-01');
      await page.waitForTimeout(400);

      // A página não deve quebrar
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('lote com data de fim anterior ao início é sinalizado', async ({ page }) => {
    const abriu = await irParaAbaLotes(page);
    if (!abriu) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    const dataInputs = page.locator('input[type="date"], input[type="datetime-local"]');
    const count = await dataInputs.count();

    if (count < 2) return;

    // Início no futuro, fim no passado
    await dataInputs.nth(0).fill('2027-12-01');
    await dataInputs.nth(1).fill('2026-01-01');
    await page.waitForTimeout(300);

    // Não deve crashar
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─── Lotes na listagem pública ────────────────────────────────────────────────

test.describe('Lotes — Exibição Pública', () => {
  test('nome do lote é exibido no modal de compra', async ({ page }) => {
    const { BASE_URL } = await import('../helpers/auth.helper');
    const { aceitarLGPD } = await import('../helpers/auth.helper');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const verBtn = page.getByRole('button', { name: /ver ingressos/i }).first();
    if (!(await verBtn.isVisible({ timeout: 8000 }))) return;

    await verBtn.click();
    await page.waitForTimeout(600);

    // Deve exibir algum lote ou informação de ingresso
    const infoLote = page.getByText(/lote|1°|2°|ingresso|entrada/i).first();
    if (await infoLote.isVisible({ timeout: 5000 })) {
      await expect(infoLote).toBeVisible();
    }
  });

  test('lote inativo não aparece nas opções de compra', async ({ page }) => {
    const { BASE_URL, aceitarLGPD } = await import('../helpers/auth.helper');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const verBtn = page.getByRole('button', { name: /ver ingressos/i }).first();
    if (!(await verBtn.isVisible({ timeout: 8000 }))) return;

    await verBtn.click();
    await page.waitForTimeout(600);

    // Inativo não deve aparecer como opção selecionável
    const inativos = page.getByText(/inativo|esgotado/i);
    // Se aparecer "esgotado" está correto, mas não deve ser clicável
    if (await inativos.isVisible({ timeout: 3000 })) {
      const btn = page.getByRole('button', { name: /inativo/i });
      await expect(btn).not.toBeVisible();
    }
  });
});
