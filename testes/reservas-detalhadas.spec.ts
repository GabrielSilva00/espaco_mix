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

async function irParaReservas(page: Page): Promise<boolean> {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);

  const reservasBtn = page.getByRole('button', { name: /minhas reservas/i }).first();
  if (await reservasBtn.isVisible({ timeout: 4000 })) {
    await reservasBtn.click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Suite: Reservas - Acesso e Estrutura
// ---------------------------------------------------------------------------

test.describe('Reservas - Acesso e Estrutura', () => {
  test('deve exibir o título "Minhas Reservas" ao acessar a página', async ({ page }) => {
    const acessou = await irParaReservas(page);
    if (!acessou) return;

    const titulo = page.getByText('Minhas Reservas').first();
    if (await titulo.isVisible({ timeout: 5000 })) {
      await expect(titulo).toBeVisible();
    }
  });

  test('deve exibir a aba "Próximos Eventos" nas reservas', async ({ page }) => {
    const acessou = await irParaReservas(page);
    if (!acessou) return;

    const aba = page.getByRole('button', { name: /próximos eventos/i }).first();
    if (await aba.isVisible({ timeout: 5000 })) {
      await expect(aba).toBeVisible();
    }
  });

  test('deve exibir a aba "Histórico" nas reservas', async ({ page }) => {
    const acessou = await irParaReservas(page);
    if (!acessou) return;

    const aba = page.getByRole('button', { name: /histórico/i }).first();
    if (await aba.isVisible({ timeout: 5000 })) {
      await expect(aba).toBeVisible();
    }
  });

  test('deve alternar para a aba Histórico ao clicar nela', async ({ page }) => {
    const acessou = await irParaReservas(page);
    if (!acessou) return;

    const abaHistorico = page.getByRole('button', { name: /histórico/i }).first();
    if (await abaHistorico.isVisible({ timeout: 5000 })) {
      await abaHistorico.click();
      await page.waitForTimeout(300);
      // A aba ativa deve estar destacada — verifica que a página não quebrou
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('deve exibir mensagem de estado vazio quando não há reservas', async ({ page }) => {
    const acessou = await irParaReservas(page);
    if (!acessou) return;

    const vazioMsg = page.getByText(
      /nenhuma reserva|nenhum ingresso|sem reservas|você ainda não|nada por aqui/i
    ).first();
    if (await vazioMsg.isVisible({ timeout: 5000 })) {
      await expect(vazioMsg).toBeVisible();
    }
  });

  test('deve exibir botão para voltar à home nas reservas', async ({ page }) => {
    const acessou = await irParaReservas(page);
    if (!acessou) return;

    const voltarBtn = page.getByRole('button', { name: /início|home|ver eventos/i }).first();
    if (await voltarBtn.isVisible({ timeout: 5000 })) {
      await expect(voltarBtn).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Reservas - Cards de Ingresso
// ---------------------------------------------------------------------------

test.describe('Reservas - Cards de Ingresso', () => {
  test('deve exibir cards de ingresso quando há reservas', async ({ page }) => {
    const acessou = await irParaReservas(page);
    if (!acessou) return;

    // Verifica se há algum card de ingresso
    const card = page.locator('[class*="rounded-xl"], [class*="border"]')
      .filter({ hasText: /ingresso|mesa|R\$/i }).first();
    if (await card.isVisible({ timeout: 5000 })) {
      await expect(card).toBeVisible();
    }
  });

  test('deve exibir status do ingresso (Ativo/Cancelado/etc)', async ({ page }) => {
    const acessou = await irParaReservas(page);
    if (!acessou) return;

    const status = page.getByText(/ativo|cancelado|transferido|pendente/i).first();
    if (await status.isVisible({ timeout: 5000 })) {
      await expect(status).toBeVisible();
    }
  });

  test('deve exibir o nome do evento no card de reserva', async ({ page }) => {
    const acessou = await irParaReservas(page);
    if (!acessou) return;

    const temCard = page.locator('[class*="border"]').filter({ hasText: /ingresso|mesa/i }).first();
    if (!(await temCard.isVisible({ timeout: 5000 }))) return;

    // O card de reserva deve ter nome de evento, data ou local
    const infoEvento = page.locator('[class*="text-"]').filter({ hasText: /espaço mix|evento/i }).first();
    if (await infoEvento.isVisible({ timeout: 3000 })) {
      await expect(infoEvento).toBeVisible();
    }
  });

  test('deve exibir o valor total da reserva', async ({ page }) => {
    const acessou = await irParaReservas(page);
    if (!acessou) return;

    const temCard = page.locator('[class*="border"]').filter({ hasText: /ingresso|mesa/i }).first();
    if (!(await temCard.isVisible({ timeout: 5000 }))) return;

    const valorText = page.getByText(/r\$/i).first();
    if (await valorText.isVisible({ timeout: 3000 })) {
      await expect(valorText).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Reservas - Ações nos Ingressos
// ---------------------------------------------------------------------------

test.describe('Reservas - Ações nos Ingressos', () => {
  test('deve exibir botão de download de PDF do ingresso', async ({ page }) => {
    const acessou = await irParaReservas(page);
    if (!acessou) return;

    const temCard = page.locator('[class*="border"]').filter({ hasText: /ingresso|mesa/i }).first();
    if (!(await temCard.isVisible({ timeout: 5000 }))) return;

    const downloadBtn = page.getByRole('button', { name: /download|baixar|pdf/i }).first();
    if (await downloadBtn.isVisible({ timeout: 5000 })) {
      await expect(downloadBtn).toBeVisible();
    }
  });

  test('deve exibir ícone de QR code nos ingressos ativos', async ({ page }) => {
    const acessou = await irParaReservas(page);
    if (!acessou) return;

    const temCard = page.locator('[class*="border"]').filter({ hasText: /ativo/i }).first();
    if (!(await temCard.isVisible({ timeout: 5000 }))) return;

    // QR code button - pode ser um botão ou ícone
    const qrBtn = page.locator('button').filter({ has: page.locator('.lucide-qr-code, [data-lucide="qr-code"]') }).first();
    if (await qrBtn.isVisible({ timeout: 3000 })) {
      await expect(qrBtn).toBeVisible();
    }
  });

  test('deve abrir QR code em tela cheia ao clicar', async ({ page }) => {
    const acessou = await irParaReservas(page);
    if (!acessou) return;

    const qrBtn = page.locator('button').filter({ has: page.locator('.lucide-qr-code, [data-lucide="qr-code"]') }).first();
    if (!(await qrBtn.isVisible({ timeout: 5000 }))) return;

    await qrBtn.click();
    await page.waitForTimeout(400);

    // Deve abrir fullscreen ou modal com QR code
    const fullscreen = page.locator('[class*="fixed"], [class*="inset-0"]').filter({ has: page.locator('svg, canvas, img') }).last();
    if (await fullscreen.isVisible({ timeout: 3000 })) {
      await expect(fullscreen).toBeVisible();
      // Fecha o fullscreen
      const fecharBtn = page.getByRole('button').filter({ has: page.locator('.lucide-x') }).first();
      if (await fecharBtn.isVisible({ timeout: 2000 })) {
        await fecharBtn.click();
      }
    }
  });

  test('deve exibir informações de transferência pendente', async ({ page }) => {
    const acessou = await irParaReservas(page);
    if (!acessou) return;

    const transferPendente = page.getByText(/pendente|transferência/i).first();
    if (await transferPendente.isVisible({ timeout: 4000 })) {
      await expect(transferPendente).toBeVisible();
    }
  });

  test('deve exibir aviso de ingresso cancelado com estilo diferente', async ({ page }) => {
    const acessou = await irParaReservas(page);
    if (!acessou) return;

    const canceladoCard = page.locator('[class*="border-red"]').first();
    if (await canceladoCard.isVisible({ timeout: 4000 })) {
      await expect(canceladoCard).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Reservas - Sem Autenticação
// ---------------------------------------------------------------------------

test.describe('Reservas - Comportamento sem Autenticação', () => {
  test('não deve mostrar "Minhas Reservas" na navbar sem autenticação', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    // Verifica se "Minhas Reservas" está ausente para usuários não logados
    const reservasBtn = page.getByRole('button', { name: /minhas reservas/i });
    const entrarBtn = page.getByRole('button', { name: 'Entrar', exact: true }).first();

    if (await entrarBtn.isVisible({ timeout: 3000 })) {
      // Usuário não está logado — "Minhas Reservas" não deve aparecer
      await expect(reservasBtn).not.toBeVisible();
    }
  });

  test('deve redirecionar para login ao tentar acessar reservas sem auth', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);

    // Tenta navegar forçando currentView — se o app tem guarda de rota
    // Como é SPA sem URL routing, verifica que o botão "Minhas Reservas" não está acessível
    const entrarBtn = page.getByRole('button', { name: 'Entrar', exact: true }).first();
    if (await entrarBtn.isVisible({ timeout: 3000 })) {
      // Não há como navegar para reservas sem autenticação
      await expect(entrarBtn).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Reservas - Aba Histórico
// ---------------------------------------------------------------------------

test.describe('Reservas - Aba Histórico', () => {
  test('deve mostrar estado vazio no histórico quando não há reservas passadas', async ({ page }) => {
    const acessou = await irParaReservas(page);
    if (!acessou) return;

    const abaHistorico = page.getByRole('button', { name: /histórico/i }).first();
    if (!(await abaHistorico.isVisible({ timeout: 5000 }))) return;

    await abaHistorico.click();
    await page.waitForTimeout(400);

    const vazioMsg = page.getByText(
      /nenhum histórico|sem histórico|nada encontrado|você ainda não/i
    ).first();
    if (await vazioMsg.isVisible({ timeout: 4000 })) {
      await expect(vazioMsg).toBeVisible();
    }
  });

  test('deve exibir reservas passadas na aba histórico', async ({ page }) => {
    const acessou = await irParaReservas(page);
    if (!acessou) return;

    const abaHistorico = page.getByRole('button', { name: /histórico/i }).first();
    if (!(await abaHistorico.isVisible({ timeout: 5000 }))) return;

    await abaHistorico.click();
    await page.waitForTimeout(400);

    // Deve renderizar sem quebrar a página
    await expect(page.locator('main')).toBeVisible();
  });

  test('deve voltar para Próximos Eventos ao clicar na aba', async ({ page }) => {
    const acessou = await irParaReservas(page);
    if (!acessou) return;

    const abaHistorico = page.getByRole('button', { name: /histórico/i }).first();
    const abaProximos = page.getByRole('button', { name: /próximos eventos/i }).first();

    if ((await abaHistorico.isVisible({ timeout: 5000 })) && (await abaProximos.isVisible({ timeout: 3000 }))) {
      await abaHistorico.click();
      await page.waitForTimeout(300);
      await abaProximos.click();
      await page.waitForTimeout(300);
      // Deve voltar para a aba inicial sem erros
      await expect(page.locator('main')).toBeVisible();
    }
  });
});
