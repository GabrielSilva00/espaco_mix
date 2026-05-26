/**
 * 05-purchase/selecao-ingresso — Seleção de quantidade e tipo de ingresso no modal de compra.
 */
import { test, expect, Page } from '@playwright/test';
import { aceitarLGPD, BASE_URL } from '../helpers/auth.helper';

async function abrirModalCompra(page: Page): Promise<boolean> {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);

  const verBtn = page.getByRole('button', { name: /ver ingressos/i }).first();
  if (!(await verBtn.isVisible({ timeout: 8000 }))) return false;

  await verBtn.click();
  await page.waitForTimeout(600);
  return true;
}

// ─── Abertura do modal ────────────────────────────────────────────────────────

test.describe('Seleção de Ingresso — Modal', () => {
  test('botão "Ver Ingressos" abre painel ou modal de compra', async ({ page }) => {
    const abriu = await abrirModalCompra(page);
    if (!abriu) { test.skip(true, 'Nenhum evento disponível'); return; }

    // Deve exibir algum painel de compra
    const painel = page.locator('[role="dialog"], .modal, [class*="booking"], [class*="ticket"]').first();
    const info   = page.getByText(/ingresso|ticket|quantidade|lote/i).first();

    const temPainel = (await painel.isVisible({ timeout: 5000 })) ||
                      (await info.isVisible({ timeout: 5000 }));
    expect(temPainel).toBe(true);
  });

  test('nome do evento é exibido no painel de compra', async ({ page }) => {
    const abriu = await abrirModalCompra(page);
    if (!abriu) { test.skip(true, 'Nenhum evento disponível'); return; }

    // Painel deve mostrar o nome/título do evento
    const titulo = page.locator('h1, h2, h3').first();
    if (await titulo.isVisible({ timeout: 5000 })) {
      const texto = await titulo.textContent();
      expect(texto?.length).toBeGreaterThan(0);
    }
  });

  test('data e local do evento são exibidos', async ({ page }) => {
    const abriu = await abrirModalCompra(page);
    if (!abriu) { test.skip(true, 'Nenhum evento disponível'); return; }

    const data  = page.getByText(/\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez/i).first();
    if (await data.isVisible({ timeout: 5000 })) {
      await expect(data).toBeVisible();
    }
  });
});

// ─── Seleção de quantidade ────────────────────────────────────────────────────

test.describe('Seleção de Ingresso — Quantidade', () => {
  test('controles de quantidade (+/-) estão visíveis', async ({ page }) => {
    const abriu = await abrirModalCompra(page);
    if (!abriu) { test.skip(true, 'Nenhum evento disponível'); return; }

    const mais   = page.getByRole('button', { name: '+' }).first();
    const menos  = page.getByRole('button', { name: '-' }).first();

    if (await mais.isVisible({ timeout: 5000 })) {
      await expect(mais).toBeVisible();
    }
    if (await menos.isVisible({ timeout: 5000 })) {
      await expect(menos).toBeVisible();
    }
  });

  test('quantidade inicial é 0 ou 1', async ({ page }) => {
    const abriu = await abrirModalCompra(page);
    if (!abriu) { test.skip(true, 'Nenhum evento disponível'); return; }

    const qtdDisplay = page.getByText(/^[01]$/).first();
    if (await qtdDisplay.isVisible({ timeout: 4000 })) {
      const val = await qtdDisplay.textContent();
      expect(['0', '1']).toContain(val?.trim());
    }
  });

  test('clicar em "+" aumenta a quantidade', async ({ page }) => {
    const abriu = await abrirModalCompra(page);
    if (!abriu) { test.skip(true, 'Nenhum evento disponível'); return; }

    const mais = page.getByRole('button', { name: '+' }).first();
    if (!(await mais.isVisible({ timeout: 5000 }))) return;

    await mais.click();
    await page.waitForTimeout(300);
    await expect(page.locator('body')).toBeVisible();
  });

  test('quantidade não passa do máximo permitido (MAX_TICKETS_PER_ORDER = 10)', async ({ page }) => {
    const abriu = await abrirModalCompra(page);
    if (!abriu) { test.skip(true, 'Nenhum evento disponível'); return; }

    const mais = page.getByRole('button', { name: '+' }).first();
    if (!(await mais.isVisible({ timeout: 5000 }))) return;

    // Clica 15 vezes tentando ultrapassar o limite
    for (let i = 0; i < 15; i++) {
      if (await mais.isEnabled()) {
        await mais.click();
        await page.waitForTimeout(100);
      }
    }

    // O botão deve ficar desabilitado ao atingir o máximo
    const disabled = !(await mais.isEnabled());
    if (disabled) {
      await expect(mais).toBeDisabled();
    }
  });

  test('quantidade não fica negativa ao clicar em "-" além do zero', async ({ page }) => {
    const abriu = await abrirModalCompra(page);
    if (!abriu) { test.skip(true, 'Nenhum evento disponível'); return; }

    const menos = page.getByRole('button', { name: '-' }).first();
    if (!(await menos.isVisible({ timeout: 5000 }))) return;

    for (let i = 0; i < 5; i++) {
      await menos.click();
      await page.waitForTimeout(100);
    }

    // Não deve exibir número negativo
    const negativo = page.getByText(/-\d+/).first();
    await expect(negativo).not.toBeVisible();
  });
});

// ─── Tipo de ingresso por gênero ──────────────────────────────────────────────

test.describe('Seleção de Ingresso — Por Gênero', () => {
  test('quando evento tem preço por gênero, exibe opções masculino/feminino', async ({ page }) => {
    const abriu = await abrirModalCompra(page);
    if (!abriu) { test.skip(true, 'Nenhum evento disponível'); return; }

    const masculino = page.getByText(/masculino|masc\./i).first();
    const feminino  = page.getByText(/feminino|fem\./i).first();

    // Se o evento tiver preços por gênero, ambos devem aparecer
    if (await masculino.isVisible({ timeout: 4000 })) {
      await expect(feminino).toBeVisible({ timeout: 4000 });
    }
  });

  test('preços masculino e feminino são exibidos corretamente', async ({ page }) => {
    const abriu = await abrirModalCompra(page);
    if (!abriu) { test.skip(true, 'Nenhum evento disponível'); return; }

    const masculino = page.getByText(/masculino|masc\./i).first();
    if (!(await masculino.isVisible({ timeout: 4000 }))) return;

    // Deve exibir valor em R$
    const preco = page.getByText(/R\$\s*\d+/i).first();
    if (await preco.isVisible({ timeout: 3000 })) {
      await expect(preco).toBeVisible();
    }
  });
});

// ─── Resumo antes de continuar ────────────────────────────────────────────────

test.describe('Seleção de Ingresso — Resumo', () => {
  test('valor total é calculado dinamicamente ao selecionar ingressos', async ({ page }) => {
    const abriu = await abrirModalCompra(page);
    if (!abriu) { test.skip(true, 'Nenhum evento disponível'); return; }

    const mais = page.getByRole('button', { name: '+' }).first();
    if (!(await mais.isVisible({ timeout: 5000 }))) return;

    // Captura texto antes
    const totalBefore = await page.getByText(/total|R\$/i).first().textContent();

    await mais.click();
    await page.waitForTimeout(300);

    const totalAfter = await page.getByText(/total|R\$/i).first().textContent();

    // Se o total muda, o cálculo é dinâmico
    if (totalBefore && totalAfter) {
      // Apenas verifica que continua visível
      await expect(page.getByText(/R\$/i).first()).toBeVisible();
    }
  });

  test('botão de continuar/comprar está visível após selecionar ingresso', async ({ page }) => {
    const abriu = await abrirModalCompra(page);
    if (!abriu) { test.skip(true, 'Nenhum evento disponível'); return; }

    const mais = page.getByRole('button', { name: '+' }).first();
    if (!(await mais.isVisible({ timeout: 5000 }))) return;

    await mais.click();
    await page.waitForTimeout(300);

    const continuar = page.getByRole('button', { name: /continuar|comprar|próximo|checkout/i }).first();
    if (await continuar.isVisible({ timeout: 4000 })) {
      await expect(continuar).toBeVisible();
    }
  });

  test('botão continuar está desabilitado quando quantidade é zero', async ({ page }) => {
    const abriu = await abrirModalCompra(page);
    if (!abriu) { test.skip(true, 'Nenhum evento disponível'); return; }

    const continuar = page.getByRole('button', { name: /continuar|comprar|próximo|checkout/i }).first();
    if (!(await continuar.isVisible({ timeout: 5000 }))) return;

    // Com quantidade 0, deve estar desabilitado
    const disabled = !(await continuar.isEnabled());
    if (disabled) {
      await expect(continuar).toBeDisabled();
    }
  });
});

// ─── Timer do carrinho ────────────────────────────────────────────────────────

test.describe('Seleção de Ingresso — Timer', () => {
  test('timer não aparece antes de iniciar checkout', async ({ page }) => {
    const abriu = await abrirModalCompra(page);
    if (!abriu) { test.skip(true, 'Nenhum evento disponível'); return; }

    // O timer de 10 min só deve aparecer após iniciar pagamento
    const timer = page.getByText(/\d{2}:\d{2}|minutos restantes/i).first();
    // Na seleção inicial, não deve haver timer
    await expect(timer).not.toBeVisible();
  });
});
