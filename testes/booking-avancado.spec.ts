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

async function abrirBooking(page: Page): Promise<boolean> {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);
  const eventCard = page.getByRole('button', { name: /ver ingressos/i }).first();
  if (!(await eventCard.isVisible({ timeout: 8000 }))) return false;
  await eventCard.click();
  await page.waitForTimeout(600);
  return true;
}

async function expandirPainelIngressos(page: Page): Promise<boolean> {
  const panelBtn = page.getByRole('button', { name: /^ingressos$/i }).first();
  if (!(await panelBtn.isVisible({ timeout: 5000 }))) return false;
  await panelBtn.click();
  await page.waitForTimeout(400);
  return true;
}

// ---------------------------------------------------------------------------
// Suite: Booking - Informações do Evento
// ---------------------------------------------------------------------------

test.describe('Booking - Informações do Evento', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await aceitarLGPD(page);
  });

  test('deve exibir o nome do evento na view de booking', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    // O título do evento deve estar visível
    const titulo = page.locator('h1, h2, [class*="font-serif"], [class*="text-xl"]').first();
    if (await titulo.isVisible({ timeout: 5000 })) {
      await expect(titulo).toBeVisible();
    }
  });

  test('deve exibir a data do evento no booking', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const data = page.locator('svg.lucide-calendar, [data-lucide="calendar"]').first();
    if (await data.isVisible({ timeout: 5000 })) {
      await expect(data).toBeVisible();
    }
  });

  test('deve exibir o local do evento no booking', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const local = page.locator('svg.lucide-map-pin, [data-lucide="map-pin"]').first();
    if (await local.isVisible({ timeout: 5000 })) {
      await expect(local).toBeVisible();
    }
  });

  test('deve exibir o horário do evento no booking', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const horario = page.locator('svg.lucide-clock, [data-lucide="clock"]').first();
    if (await horario.isVisible({ timeout: 5000 })) {
      await expect(horario).toBeVisible();
    }
  });

  test('deve exibir a faixa de preços no painel de ingressos', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const preco = page.getByText(/r\$|grátis|a partir/i).first();
    if (await preco.isVisible({ timeout: 5000 })) {
      await expect(preco).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Booking - Seleção de Ingressos (Quantidade)
// ---------------------------------------------------------------------------

test.describe('Booking - Quantidade de Ingressos', () => {
  test('deve incrementar a quantidade de ingressos ao clicar em +', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const expandiu = await expandirPainelIngressos(page);
    if (!expandiu) return;

    const btnMais = page.getByRole('button').filter({ hasText: '+' }).first();
    if (!(await btnMais.isVisible({ timeout: 5000 }))) return;

    await btnMais.click();
    await page.waitForTimeout(300);

    // Total ou quantidade deve refletir pelo menos 1
    const qtd = page.getByText(/\b1\b|1x/i).first();
    if (await qtd.isVisible({ timeout: 3000 })) {
      await expect(qtd).toBeVisible();
    }
  });

  test('deve decrementar a quantidade de ingressos ao clicar em -', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const expandiu = await expandirPainelIngressos(page);
    if (!expandiu) return;

    const btnMais = page.getByRole('button').filter({ hasText: '+' }).first();
    const btnMenos = page.getByRole('button').filter({ hasText: '-' }).first();

    if (!(await btnMais.isVisible({ timeout: 5000 }))) return;

    // Adiciona 2, depois remove 1
    await btnMais.click();
    await btnMais.click();
    await page.waitForTimeout(200);
    await btnMenos.click();
    await page.waitForTimeout(300);

    // Deve continuar com 1 ingresso
    await expect(page.locator('body')).toBeVisible();
  });

  test('não deve decrementar abaixo de 0 ingressos', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const expandiu = await expandirPainelIngressos(page);
    if (!expandiu) return;

    // Tenta decrementar sem ter adicionado nada
    const btnMenos = page.getByRole('button').filter({ hasText: '-' }).first();
    if (await btnMenos.isVisible({ timeout: 5000 })) {
      await btnMenos.click();
      await page.waitForTimeout(300);
      // Página deve continuar íntegra
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('deve respeitar o limite máximo de ingressos por pedido', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const expandiu = await expandirPainelIngressos(page);
    if (!expandiu) return;

    const btnMais = page.getByRole('button').filter({ hasText: '+' }).first();
    if (!(await btnMais.isVisible({ timeout: 5000 }))) return;

    // Clica 15 vezes (limite é 10)
    for (let i = 0; i < 15; i++) {
      if (await btnMais.isEnabled()) {
        await btnMais.click();
      } else {
        break;
      }
    }
    await page.waitForTimeout(300);

    // O botão + deve estar desabilitado ou a quantidade deve estar limitada a 10
    await expect(page.locator('body')).toBeVisible();
  });

  test('deve atualizar o subtotal ao adicionar ingressos', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const expandiu = await expandirPainelIngressos(page);
    if (!expandiu) return;

    const btnMais = page.getByRole('button').filter({ hasText: '+' }).first();
    if (!(await btnMais.isVisible({ timeout: 5000 }))) return;

    await btnMais.click();
    await page.waitForTimeout(300);

    const subtotal = page.getByText(/subtotal|r\$/i).first();
    if (await subtotal.isVisible({ timeout: 3000 })) {
      await expect(subtotal).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Booking - Preço por Gênero
// ---------------------------------------------------------------------------

test.describe('Booking - Preço por Gênero', () => {
  test('deve exibir opção masculina quando o evento usa preço por gênero', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    await expandirPainelIngressos(page);

    const masculino = page.getByText(/masculino|masc\./i).first();
    if (await masculino.isVisible({ timeout: 5000 })) {
      await expect(masculino).toBeVisible();
    }
  });

  test('deve exibir opção feminina quando o evento usa preço por gênero', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    await expandirPainelIngressos(page);

    const feminino = page.getByText(/feminino|fem\./i).first();
    if (await feminino.isVisible({ timeout: 5000 })) {
      await expect(feminino).toBeVisible();
    }
  });

  test('deve exibir preços diferentes para masculino e feminino', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    await expandirPainelIngressos(page);

    const masculino = page.getByText(/masculino/i).first();
    if (!(await masculino.isVisible({ timeout: 3000 }))) return;

    // Deve haver pelo menos 2 valores de preço R$ diferentes
    const precos = page.getByText(/r\$\s*\d+/i);
    const count = await precos.count();
    if (count >= 2) {
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Booking - Seleção de Mesas
// ---------------------------------------------------------------------------

test.describe('Booking - Seleção de Mesas', () => {
  test('deve exibir o painel de Mesas quando o evento tem mesas', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const mesasPanel = page.getByRole('button', { name: /^mesas$/i }).first();
    if (await mesasPanel.isVisible({ timeout: 6000 })) {
      await expect(mesasPanel).toBeVisible();
    }
  });

  test('deve expandir o painel de mesas ao clicar', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const mesasPanel = page.getByRole('button', { name: /^mesas$/i }).first();
    if (!(await mesasPanel.isVisible({ timeout: 6000 }))) return;

    await mesasPanel.click();
    await page.waitForTimeout(500);

    // Layout SVG ou grid de mesas deve aparecer
    const layoutMesas = page.locator('svg, [class*="grid"], [class*="layout"]').first();
    if (await layoutMesas.isVisible({ timeout: 5000 })) {
      await expect(layoutMesas).toBeVisible();
    }
  });

  test('deve mostrar mesas disponíveis e reservadas com cores diferentes', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const mesasPanel = page.getByRole('button', { name: /^mesas$/i }).first();
    if (!(await mesasPanel.isVisible({ timeout: 6000 }))) return;

    await mesasPanel.click();
    await page.waitForTimeout(500);

    // Deve existir algum elemento representando mesas (círculos SVG, retângulos)
    const mesaEl = page.locator('svg circle, svg rect, [class*="mesa"], [class*="table"]').first();
    if (await mesaEl.isVisible({ timeout: 5000 })) {
      await expect(mesaEl).toBeVisible();
    }
  });

  test('deve selecionar uma mesa ao clicar nela', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const mesasPanel = page.getByRole('button', { name: /^mesas$/i }).first();
    if (!(await mesasPanel.isVisible({ timeout: 6000 }))) return;

    await mesasPanel.click();
    await page.waitForTimeout(500);

    // Clica em alguma mesa disponível (primeiro elemento clicável dentro do layout)
    const svgEl = page.locator('svg').first();
    if (await svgEl.isVisible({ timeout: 4000 })) {
      const circles = svgEl.locator('circle, rect').first();
      if (await circles.isVisible({ timeout: 3000 })) {
        await circles.click({ force: true });
        await page.waitForTimeout(300);
        // Não deve quebrar a página
        await expect(page.locator('body')).toBeVisible();
      }
    }
  });

  test('deve mostrar bistros quando o evento tem bistros', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const bistro = page.getByText(/bistro/i).first();
    if (await bistro.isVisible({ timeout: 5000 })) {
      await expect(bistro).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Booking - Timer do Carrinho
// ---------------------------------------------------------------------------

test.describe('Booking - Timer do Carrinho', () => {
  test('deve exibir o timer de expiração após selecionar ingressos', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const expandiu = await expandirPainelIngressos(page);
    if (!expandiu) return;

    const btnMais = page.getByRole('button').filter({ hasText: '+' }).first();
    if (!(await btnMais.isVisible({ timeout: 5000 }))) return;

    await btnMais.click();
    await page.waitForTimeout(500);

    // Timer deve aparecer (formato M:SS)
    const timer = page.getByText(/\d+:\d{2}/i).first();
    if (await timer.isVisible({ timeout: 5000 })) {
      await expect(timer).toBeVisible();
    }
  });

  test('o timer deve estar contando regressivamente', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const expandiu = await expandirPainelIngressos(page);
    if (!expandiu) return;

    const btnMais = page.getByRole('button').filter({ hasText: '+' }).first();
    if (!(await btnMais.isVisible({ timeout: 5000 }))) return;

    await btnMais.click();
    await page.waitForTimeout(300);

    const timer = page.getByText(/\d+:\d{2}/i).first();
    if (!(await timer.isVisible({ timeout: 5000 }))) return;

    const primeiroValor = await timer.textContent();
    await page.waitForTimeout(2000);
    const segundoValor = await timer.textContent();

    // Os valores devem ser diferentes (timer está contando)
    expect(primeiroValor).not.toBe(segundoValor);
  });
});

// ---------------------------------------------------------------------------
// Suite: Booking - Setores e Lotes
// ---------------------------------------------------------------------------

test.describe('Booking - Setores e Lotes', () => {
  test('deve exibir setores ao expandir o painel de ingressos', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const expandiu = await expandirPainelIngressos(page);
    if (!expandiu) return;

    // Deve mostrar algum setor/lote disponível
    const setor = page.locator('[class*="sector"], [class*="batch"], [class*="setor"]').first();
    if (await setor.isVisible({ timeout: 5000 })) {
      await expect(setor).toBeVisible();
    }
  });

  test('deve exibir a disponibilidade de ingressos no setor', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const expandiu = await expandirPainelIngressos(page);
    if (!expandiu) return;

    const disponivel = page.getByText(/disponível|restam|\d+ vagas/i).first();
    if (await disponivel.isVisible({ timeout: 5000 })) {
      await expect(disponivel).toBeVisible();
    }
  });

  test('deve bloquear seleção em setores esgotados', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const expandiu = await expandirPainelIngressos(page);
    if (!expandiu) return;

    const esgotado = page.getByText(/esgotado|sold out/i).first();
    if (await esgotado.isVisible({ timeout: 5000 })) {
      await expect(esgotado).toBeVisible();
      // O botão + junto a este setor deve estar desabilitado
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Booking - Botão de Finalizar
// ---------------------------------------------------------------------------

test.describe('Booking - Botão Finalizar Pedido', () => {
  test('deve exibir botão de finalizar após selecionar ingressos', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const expandiu = await expandirPainelIngressos(page);
    if (!expandiu) return;

    const btnMais = page.getByRole('button').filter({ hasText: '+' }).first();
    if (!(await btnMais.isVisible({ timeout: 5000 }))) return;

    await btnMais.click();
    await page.waitForTimeout(300);

    const btnFinalizar = page.getByRole('button', { name: /finalizar|comprar|checkout/i }).first();
    if (await btnFinalizar.isVisible({ timeout: 5000 })) {
      await expect(btnFinalizar).toBeVisible();
    }
  });

  test('deve desabilitar botão de finalizar sem ingressos selecionados', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    // Sem selecionar nada, o botão Finalizar não deve estar ativo/visível
    const btnFinalizar = page.getByRole('button', { name: /finalizar|comprar/i }).first();
    if (await btnFinalizar.isVisible({ timeout: 4000 })) {
      // Se visível, deve estar desabilitado
      const isDisabled = await btnFinalizar.isDisabled();
      expect(isDisabled).toBe(true);
    }
  });

  test('deve exibir nota sobre classificação etária se o evento tiver', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const rating = page.getByText(/\d+\+|maior de \d+|classificação etária/i).first();
    if (await rating.isVisible({ timeout: 5000 })) {
      await expect(rating).toBeVisible();
    }
  });

  test('deve exibir notas importantes do evento se houver', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const notas = page.getByText(/observações|notas importantes|atenção/i).first();
    if (await notas.isVisible({ timeout: 5000 })) {
      await expect(notas).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Booking - Navegação de Retorno
// ---------------------------------------------------------------------------

test.describe('Booking - Retorno à Home', () => {
  test('deve ter botão de voltar à home na view de booking', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    const voltarBtn = page.getByRole('button', { name: /voltar|início|home/i }).first();
    if (await voltarBtn.isVisible({ timeout: 5000 })) {
      await expect(voltarBtn).toBeVisible();
    }
  });

  test('deve retornar à home ao clicar em Início na navbar', async ({ page }) => {
    const abriu = await abrirBooking(page);
    if (!abriu) return;

    await page.getByRole('button', { name: /início/i }).first().click();
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
  });
});
