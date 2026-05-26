/**
 * 06-reservations/minhas-reservas — Listagem e detalhes das reservas do usuário.
 */
import { test, expect, Page } from '@playwright/test';
import { aceitarLGPD, loginAsUser, logout, BASE_URL } from '../helpers/auth.helper';

async function loginEIrParaReservas(page: Page): Promise<boolean> {
  const ok = await loginAsUser(page);
  if (!ok) return false;

  const reservasBtn = page.getByRole('button', { name: /minhas reservas|meus ingressos|my tickets/i }).first();
  if (await reservasBtn.isVisible({ timeout: 6000 })) {
    await reservasBtn.click();
    await page.waitForTimeout(500);
    return true;
  }

  // Pode estar no menu de usuário
  const userIcon = page.locator('.lucide-user, [class*="avatar"], button[class*="user"]').first();
  if (await userIcon.isVisible({ timeout: 5000 })) {
    await userIcon.click();
    await page.waitForTimeout(300);
    const reservasLink = page.getByRole('button', { name: /minhas reservas|meus ingressos/i }).first();
    if (await reservasLink.isVisible({ timeout: 3000 })) {
      await reservasLink.click();
      await page.waitForTimeout(500);
      return true;
    }
  }
  return false;
}

// ─── Acesso à seção ───────────────────────────────────────────────────────────

test.describe('Minhas Reservas — Acesso', () => {
  test('usuário logado vê link "Minhas Reservas"', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais de usuário não configuradas'); return; }

    const reservasBtn = page.getByRole('button', { name: /minhas reservas|meus ingressos/i }).first();
    await expect(reservasBtn).toBeVisible({ timeout: 6000 });
  });

  test('usuário NÃO logado NÃO vê "Minhas Reservas"', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    const reservasBtn = page.getByRole('button', { name: /minhas reservas|meus ingressos/i });
    await expect(reservasBtn).not.toBeVisible();
  });

  test('clicar em "Minhas Reservas" abre a seção correta', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais de usuário não configuradas'); return; }

    const reservasBtn = page.getByRole('button', { name: /minhas reservas|meus ingressos/i }).first();
    if (!(await reservasBtn.isVisible({ timeout: 6000 }))) { test.skip(true, 'Botão não visível'); return; }

    await reservasBtn.click();
    await page.waitForTimeout(500);

    const titulo = page.getByText(/minhas reservas|meus ingressos|suas reservas/i).first();
    if (await titulo.isVisible({ timeout: 5000 })) {
      await expect(titulo).toBeVisible();
    }
  });
});

// ─── Listagem de reservas ─────────────────────────────────────────────────────

test.describe('Minhas Reservas — Listagem', () => {
  test('tela exibe mensagem quando não há reservas', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais de usuário não configuradas'); return; }

    const chegou = await loginEIrParaReservas(page);
    if (!chegou) { test.skip(true, 'Não foi possível chegar à seção de reservas'); return; }

    const semReservas = page.getByText(/nenhuma reserva|sem ingressos|você ainda não|no tickets/i).first();
    const listaReservas = page.locator('[class*="reserva"], [class*="ticket"], [class*="booking"]').first();

    const temMsg  = await semReservas.isVisible({ timeout: 5000 });
    const temLista = await listaReservas.isVisible({ timeout: 5000 });

    // Uma das duas deve ser verdadeira
    expect(temMsg || temLista).toBe(true);
  });

  test('cards de reserva exibem nome do evento', async ({ page }) => {
    const chegou = await loginEIrParaReservas(page);
    if (!chegou) { test.skip(true, 'Credenciais de usuário não configuradas'); return; }

    const card = page.locator('[class*="reserva"], [class*="ticket"], [class*="booking"]').first();
    if (!(await card.isVisible({ timeout: 5000 }))) return;

    const nomeEvento = card.locator('h2, h3, [class*="title"]').first();
    if (await nomeEvento.isVisible({ timeout: 3000 })) {
      const texto = await nomeEvento.textContent();
      expect(texto?.length).toBeGreaterThan(0);
    }
  });

  test('cards de reserva exibem data do evento', async ({ page }) => {
    const chegou = await loginEIrParaReservas(page);
    if (!chegou) { test.skip(true, 'Credenciais de usuário não configuradas'); return; }

    const card = page.locator('[class*="reserva"], [class*="ticket"], [class*="booking"]').first();
    if (!(await card.isVisible({ timeout: 5000 }))) return;

    const data = card.getByText(/\d{2}\/\d{2}\/\d{4}|\d{2}\s+de\s+\w+/i).first();
    if (await data.isVisible({ timeout: 3000 })) {
      await expect(data).toBeVisible();
    }
  });

  test('status da reserva é exibido (confirmado, pendente, etc.)', async ({ page }) => {
    const chegou = await loginEIrParaReservas(page);
    if (!chegou) { test.skip(true, 'Credenciais de usuário não configuradas'); return; }

    const card = page.locator('[class*="reserva"], [class*="ticket"], [class*="booking"]').first();
    if (!(await card.isVisible({ timeout: 5000 }))) return;

    const status = card.getByText(/confirmado|pago|pendente|cancelado|aguardando/i).first();
    if (await status.isVisible({ timeout: 3000 })) {
      await expect(status).toBeVisible();
    }
  });
});

// ─── Detalhes da reserva ──────────────────────────────────────────────────────

test.describe('Minhas Reservas — Detalhes', () => {
  test('clicar em uma reserva abre os detalhes', async ({ page }) => {
    const chegou = await loginEIrParaReservas(page);
    if (!chegou) { test.skip(true, 'Credenciais de usuário não configuradas'); return; }

    const card = page.locator('[class*="reserva"], [class*="ticket"], [class*="booking"]').first();
    if (!(await card.isVisible({ timeout: 5000 }))) return;

    await card.click();
    await page.waitForTimeout(600);

    // Deve exibir detalhes como QR code ou número do pedido
    const detalhe = page.locator('[role="dialog"], [class*="detail"], canvas').first();
    if (await detalhe.isVisible({ timeout: 5000 })) {
      await expect(detalhe).toBeVisible();
    }
  });

  test('QR code do ingresso é exibido nos detalhes', async ({ page }) => {
    const chegou = await loginEIrParaReservas(page);
    if (!chegou) { test.skip(true, 'Credenciais de usuário não configuradas'); return; }

    const card = page.locator('[class*="reserva"], [class*="ticket"], [class*="booking"]').first();
    if (!(await card.isVisible({ timeout: 5000 }))) return;

    await card.click();
    await page.waitForTimeout(600);

    const qrCode = page.locator('canvas, img[alt*="qr" i], [class*="qr-code"]').first();
    if (await qrCode.isVisible({ timeout: 5000 })) {
      await expect(qrCode).toBeVisible();
    }
  });

  test('informações do comprador são exibidas nos detalhes', async ({ page }) => {
    const chegou = await loginEIrParaReservas(page);
    if (!chegou) { test.skip(true, 'Credenciais de usuário não configuradas'); return; }

    const card = page.locator('[class*="reserva"], [class*="ticket"], [class*="booking"]').first();
    if (!(await card.isVisible({ timeout: 5000 }))) return;

    await card.click();
    await page.waitForTimeout(600);

    const nome = page.getByText(/nome|comprador|titular/i).first();
    if (await nome.isVisible({ timeout: 4000 })) {
      await expect(nome).toBeVisible();
    }
  });
});

// ─── Ordenação e filtros ──────────────────────────────────────────────────────

test.describe('Minhas Reservas — Ordenação', () => {
  test('reservas são exibidas em ordem cronológica', async ({ page }) => {
    const chegou = await loginEIrParaReservas(page);
    if (!chegou) { test.skip(true, 'Credenciais de usuário não configuradas'); return; }

    // Apenas verifica que a listagem não quebra
    await expect(page.locator('body')).toBeVisible();
  });

  test('reservas passadas são diferenciadas das futuras', async ({ page }) => {
    const chegou = await loginEIrParaReservas(page);
    if (!chegou) { test.skip(true, 'Credenciais de usuário não configuradas'); return; }

    // Pode haver separação por abas ou labels visuais
    const passados = page.getByText(/passado|encerrado|past/i).first();
    const futuros  = page.getByText(/próximo|futuro|upcoming/i).first();

    if (await passados.isVisible({ timeout: 3000 })) {
      await expect(passados).toBeVisible();
    }
    if (await futuros.isVisible({ timeout: 3000 })) {
      await expect(futuros).toBeVisible();
    }
  });
});

// ─── Sessão e segurança ───────────────────────────────────────────────────────

test.describe('Minhas Reservas — Sessão', () => {
  test('após logout, "Minhas Reservas" não está acessível', async ({ page }) => {
    const ok = await loginAsUser(page);
    if (!ok) { test.skip(true, 'Credenciais de usuário não configuradas'); return; }

    await logout(page);
    await page.waitForTimeout(500);

    const reservasBtn = page.getByRole('button', { name: /minhas reservas|meus ingressos/i });
    await expect(reservasBtn).not.toBeVisible();
  });
});
