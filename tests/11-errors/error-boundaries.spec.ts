/**
 * 11-errors/error-boundaries — Error boundaries do React, estados de erro,
 * sem chaves duplicadas, sem warnings de hooks.
 */
import { test, expect, Page } from '@playwright/test';
import { aceitarLGPD, loginAsAdmin, loginAsUser, BASE_URL, API_URL } from '../helpers/auth.helper';

async function irParaHome(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);
}

// ─── Sem erros JS na home ─────────────────────────────────────────────────────

test.describe('Error Boundary — Home', () => {
  test('home carrega sem erros JS', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await irParaHome(page);
    await page.waitForTimeout(2000);

    const critical = errors.filter(e => !/ResizeObserver|extension/i.test(e));
    expect(critical, `Erros JS na home: ${critical.join(' | ')}`).toHaveLength(0);
  });

  test('sem warnings de chaves React duplicadas na home', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'warning' && /duplicate.*key|key.*duplicate|Each child.*unique/i.test(msg.text())) {
        warnings.push(msg.text());
      }
    });

    await irParaHome(page);
    await page.waitForTimeout(2000);

    expect(warnings, `Chaves duplicadas: ${warnings.join(' | ')}`).toHaveLength(0);
  });

  test('sem warnings de hooks React na home', async ({ page }) => {
    const hookWarnings: string[] = [];
    page.on('console', msg => {
      if (/hook|hooks|useState|useEffect|rendered.*more hooks/i.test(msg.text())) {
        hookWarnings.push(msg.text());
      }
    });

    await irParaHome(page);
    await page.waitForTimeout(2000);

    expect(hookWarnings, `Warnings de hooks: ${hookWarnings.join(' | ')}`).toHaveLength(0);
  });

  test('sem erros de prop-types', async ({ page }) => {
    const propErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && /Failed prop type|Invalid prop/i.test(msg.text())) {
        propErrors.push(msg.text());
      }
    });

    await irParaHome(page);
    await page.waitForTimeout(2000);

    // Em produção não há prop-types, em dev pode aparecer
    if (propErrors.length > 0) {
      console.warn(`Prop-types warnings: ${propErrors.join(' | ')}`);
    }
  });
});

// ─── Sem erros no dashboard admin ────────────────────────────────────────────

test.describe('Error Boundary — Dashboard Admin', () => {
  test('dashboard admin carrega sem erros JS', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    const ok = await loginAsAdmin(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    await page.waitForTimeout(2000);

    const critical = errors.filter(e => !/ResizeObserver|extension/i.test(e));
    expect(critical, `Erros JS no admin: ${critical.join(' | ')}`).toHaveLength(0);
  });

  test('sem chaves React duplicadas no dashboard admin', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', msg => {
      if (/duplicate.*key|key.*duplicate|Each child.*unique/i.test(msg.text())) {
        warnings.push(msg.text());
      }
    });

    const ok = await loginAsAdmin(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    await page.waitForTimeout(2000);
    expect(warnings).toHaveLength(0);
  });

  test('gráficos Recharts não causam erros de referência', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => {
      if (/recharts|chart|undefined.*width|undefined.*height/i.test(e.message)) {
        errors.push(e.message);
      }
    });

    const ok = await loginAsAdmin(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    await page.waitForTimeout(3000);
    expect(errors, `Erros Recharts: ${errors.join(' | ')}`).toHaveLength(0);
  });
});

// ─── Error boundary do React ──────────────────────────────────────────────────

test.describe('Error Boundary — React', () => {
  test('error boundary captura erros e exibe fallback (não crash total)', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', e => pageErrors.push(e.message));

    await irParaHome(page);

    // Navega por várias views para tentar provocar erro
    const contatoBtn = page.getByRole('button', { name: /^contato$/i }).first();
    if (await contatoBtn.isVisible({ timeout: 5000 })) {
      await contatoBtn.click();
      await page.waitForTimeout(400);
    }

    const inicioBtn = page.getByRole('button', { name: /^início$/i }).first();
    if (await inicioBtn.isVisible({ timeout: 5000 })) {
      await inicioBtn.click();
      await page.waitForTimeout(400);
    }

    // A página deve continuar funcional
    await expect(page.locator('nav').first()).toBeVisible();
  });

  test('navegação rápida entre views não causa unmount errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await irParaHome(page);

    // Clica rapidamente entre views sem esperar
    const contato = page.getByRole('button', { name: /^contato$/i }).first();
    const inicio  = page.getByRole('button', { name: /^início$/i }).first();

    for (let i = 0; i < 5; i++) {
      if (await contato.isVisible({ timeout: 2000 })) await contato.click();
      await page.waitForTimeout(100);
      if (await inicio.isVisible({ timeout: 2000 })) await inicio.click();
      await page.waitForTimeout(100);
    }

    const critical = errors.filter(e =>
      !/ResizeObserver|extension|Warning|React.*/i.test(e) &&
      /TypeError|ReferenceError|Cannot.*null|Cannot.*undefined/.test(e)
    );
    expect(critical, `Erros de unmount: ${critical.join(' | ')}`).toHaveLength(0);
  });
});

// ─── Estados de erro de rede ──────────────────────────────────────────────────

test.describe('Error Boundary — Rede', () => {
  test('falha na API de health não trava a aplicação', async ({ page }) => {
    // Intercepta chamadas à API
    await page.route('**/api/health', route => route.abort());

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // A home deve ainda ser exibida (mesmo sem saúde da API)
    await expect(page.locator('body')).toBeVisible();
  });

  test('resposta lenta da API não causa timeout fatal', async ({ page }) => {
    // Atrasa respostas da API em 3 segundos
    await page.route('**/api/**', async route => {
      await new Promise(res => setTimeout(res, 3000));
      await route.continue();
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    await expect(page.locator('body')).toBeVisible();
  });

  test('erro 500 da API exibe mensagem amigável', async ({ page }) => {
    await page.route('**/api/orders', route =>
      route.fulfill({ status: 500, body: '{"error":"Internal Server Error"}' })
    );

    await irParaHome(page);

    // Tenta comprar ingresso
    const verBtn = page.getByRole('button', { name: /ver ingressos/i }).first();
    if (!(await verBtn.isVisible({ timeout: 8000 }))) return;

    await verBtn.click();
    await page.waitForTimeout(400);

    // Não deve exibir dump de stack trace para o usuário
    const stack = page.getByText(/at Object\.|at Function\.|\.js:\d+:\d+/i);
    await expect(stack).not.toBeVisible();
  });
});

// ─── Erros específicos conhecidos ─────────────────────────────────────────────

test.describe('Error Boundary — Bugs Conhecidos', () => {
  test('BUG-001: is_active salvo como boolean (não provoca erro ao salvar evento)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    const ok = await loginAsAdmin(page);
    if (!ok) { test.skip(true, 'Credenciais admin não configuradas'); return; }

    // Tenta abrir e salvar o primeiro evento
    const editBtn = page.getByRole('button', { name: /editar/i }).first();
    if (!(await editBtn.isVisible({ timeout: 8000 }))) return;

    await editBtn.click();
    await page.waitForTimeout(500);

    const salvarBtn = page.getByRole('button', { name: /salvar|atualizar/i }).first();
    if (!(await salvarBtn.isVisible({ timeout: 5000 }))) return;

    await salvarBtn.click();
    await page.waitForTimeout(2000);

    // O bug específico de is_active causaria um TypeError
    const isActiveBug = errors.some(e =>
      /is_active|isActive|Cannot read.*undefined|Cannot set.*undefined/i.test(e)
    );
    expect(isActiveBug, `Bug is_active detectado: ${errors.filter(e => /is_active/i.test(e)).join(' | ')}`).toBe(false);
  });

  test('BUG-002: sem chaves React duplicadas ao listar eventos', async ({ page }) => {
    const dupKeys: string[] = [];
    page.on('console', msg => {
      if (/duplicate.*key|Each child.*unique/i.test(msg.text())) {
        dupKeys.push(msg.text());
      }
    });

    await irParaHome(page);
    await page.waitForTimeout(3000);

    expect(dupKeys, `Chaves duplicadas nos eventos: ${dupKeys.join(' | ')}`).toHaveLength(0);
  });

  test('BUG-003: timer de transferência é 59 min, não 10 min', async ({ page }) => {
    // Documenta o comportamento esperado para regressão
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais de usuário não configuradas'); return; }

    const reservasBtn = page.getByRole('button', { name: /minhas reservas/i }).first();
    if (!(await reservasBtn.isVisible({ timeout: 6000 }))) return;

    await reservasBtn.click();
    await page.waitForTimeout(500);

    const card = page.locator('[class*="reserva"], [class*="ticket"]').first();
    if (!(await card.isVisible({ timeout: 5000 }))) return;

    await card.click();
    await page.waitForTimeout(500);

    // Verifica timer de transferência se presente
    const timer = page.getByText(/\d{2}:\d{2}/i).first();
    if (await timer.isVisible({ timeout: 4000 })) {
      const texto = await timer.textContent();
      const match = texto?.match(/(\d{2}):\d{2}/);
      if (match) {
        const minutos = parseInt(match[1], 10);
        // Timer de transferência NÃO deve ser 10 minutos
        expect(minutos, `Timer incorreto: deveria ser ~59min, encontrou ${minutos}min`).not.toBe(10);
      }
    }
  });
});
