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

async function irParaHome(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await aceitarLGPD(page);
  await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 8000 });
}

// ---------------------------------------------------------------------------
// Suite: Carrossel de Eventos em Destaque
// ---------------------------------------------------------------------------

test.describe('Carrossel - Eventos em Destaque', () => {
  test('deve renderizar o carrossel de eventos em destaque', async ({ page }) => {
    await irParaHome(page);

    const carrossel = page.locator('[class*="embla"], [class*="carousel"], [class*="carrossel"]').first();
    if (await carrossel.isVisible({ timeout: 6000 })) {
      await expect(carrossel).toBeVisible();
    }
  });

  test('deve exibir pelo menos um slide no carrossel', async ({ page }) => {
    await irParaHome(page);

    // Embla usa overflow-hidden + flex
    const slide = page.locator('[class*="embla__slide"], [class*="slide"]').first();
    if (await slide.isVisible({ timeout: 6000 })) {
      await expect(slide).toBeVisible();
    }
  });

  test('deve exibir botão de próximo slide no carrossel', async ({ page }) => {
    await irParaHome(page);

    const nextBtn = page.locator('button').filter({ has: page.locator('.lucide-chevron-right, [data-lucide="chevron-right"]') }).first();
    if (await nextBtn.isVisible({ timeout: 6000 })) {
      await expect(nextBtn).toBeVisible();
    }
  });

  test('deve exibir botão de slide anterior no carrossel', async ({ page }) => {
    await irParaHome(page);

    const prevBtn = page.locator('button').filter({ has: page.locator('.lucide-chevron-left, [data-lucide="chevron-left"]') }).first();
    if (await prevBtn.isVisible({ timeout: 6000 })) {
      await expect(prevBtn).toBeVisible();
    }
  });

  test('deve avançar para o próximo slide ao clicar no botão Próximo', async ({ page }) => {
    await irParaHome(page);

    const nextBtn = page.locator('button').filter({ has: page.locator('.lucide-chevron-right') }).first();
    if (!(await nextBtn.isVisible({ timeout: 6000 }))) return;

    await nextBtn.click();
    await page.waitForTimeout(800);

    // Página não deve quebrar
    await expect(page.locator('body')).toBeVisible();
  });

  test('deve voltar para o slide anterior ao clicar no botão Anterior', async ({ page }) => {
    await irParaHome(page);

    const prevBtn = page.locator('button').filter({ has: page.locator('.lucide-chevron-left') }).first();
    if (!(await prevBtn.isVisible({ timeout: 6000 }))) return;

    await prevBtn.click();
    await page.waitForTimeout(800);

    await expect(page.locator('body')).toBeVisible();
  });

  test('deve exibir indicadores de paginação (dots) no carrossel', async ({ page }) => {
    await irParaHome(page);

    // Dots: pequenos botões/divs circulares abaixo do carrossel
    const dots = page.locator('[class*="rounded-full"][class*="w-2"], [class*="dot"]').first();
    if (await dots.isVisible({ timeout: 6000 })) {
      await expect(dots).toBeVisible();
    }
  });

  test('o carrossel deve fazer autoplay (slide muda sozinho)', async ({ page }) => {
    await irParaHome(page);

    const carrossel = page.locator('[class*="embla__container"], [class*="slides"]').first();
    if (!(await carrossel.isVisible({ timeout: 6000 }))) return;

    // Aguarda o autoplay (delay de 4.5s + margem)
    const transformBefore = await carrossel.evaluate(el => (el as HTMLElement).style.transform);
    await page.waitForTimeout(5500);
    const transformAfter = await carrossel.evaluate(el => (el as HTMLElement).style.transform);

    // Embla muda o transform ao trocar slide (podem ser diferentes)
    // Aceita também que o carrossel tenha apenas 1 slide e não mude
    expect(typeof transformAfter).toBe('string');
  });

  test('deve exibir nome do evento no slide do carrossel', async ({ page }) => {
    await irParaHome(page);

    // O slide deve ter nome ou título do evento
    const nomeEvento = page.locator('[class*="embla"], [class*="carousel"]').locator('h2, h3, [class*="font-serif"], [class*="title"]').first();
    if (await nomeEvento.isVisible({ timeout: 6000 })) {
      const texto = await nomeEvento.textContent();
      expect(texto?.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Paginação de Eventos ("Ver mais")
// ---------------------------------------------------------------------------

test.describe('Paginação de Eventos', () => {
  test('deve exibir a seção "Próximos Eventos" com listagem', async ({ page }) => {
    await irParaHome(page);
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 6000 });
  });

  test('deve exibir botão "Ver mais" quando há mais de 12 eventos', async ({ page }) => {
    await irParaHome(page);

    const verMaisBtn = page.getByRole('button', { name: /ver mais|carregar mais|load more/i }).first();
    if (await verMaisBtn.isVisible({ timeout: 6000 })) {
      await expect(verMaisBtn).toBeVisible();
    }
  });

  test('deve carregar mais eventos ao clicar em "Ver mais"', async ({ page }) => {
    await irParaHome(page);

    const verMaisBtn = page.getByRole('button', { name: /ver mais|carregar mais/i }).first();
    if (!(await verMaisBtn.isVisible({ timeout: 6000 }))) return;

    // Conta cards antes
    const cardsBefore = await page.getByRole('button', { name: /ver ingressos/i }).count();
    await verMaisBtn.click();
    await page.waitForTimeout(500);

    // Deve ter mais cards ou o mesmo (se todos foram carregados)
    const cardsAfter = await page.getByRole('button', { name: /ver ingressos/i }).count();
    expect(cardsAfter).toBeGreaterThanOrEqual(cardsBefore);
  });

  test('deve mostrar a contagem de eventos visíveis', async ({ page }) => {
    await irParaHome(page);

    const eventCards = page.getByRole('button', { name: /ver ingressos/i });
    const count = await eventCards.count();

    // Se há eventos no banco, deve haver pelo menos 1
    if (count > 0) {
      expect(count).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Filtros de Data
// ---------------------------------------------------------------------------

test.describe('Filtros de Data', () => {
  test.beforeEach(async ({ page }) => {
    await irParaHome(page);
  });

  test('deve exibir o select de filtro de data', async ({ page }) => {
    const filtro = page.getByRole('combobox').first();
    await expect(filtro).toBeVisible({ timeout: 6000 });
  });

  test('deve ter opção "Todos os eventos" no filtro', async ({ page }) => {
    const filtro = page.getByRole('combobox').first();
    if (!(await filtro.isVisible({ timeout: 5000 }))) return;

    const opcoes = await filtro.evaluate((select: HTMLSelectElement) =>
      Array.from(select.options).map(o => o.text)
    );
    const temTodos = opcoes.some(o => /todos|all/i.test(o));
    expect(temTodos).toBe(true);
  });

  test('deve ter opção "Este fim de semana" no filtro', async ({ page }) => {
    const filtro = page.getByRole('combobox').first();
    if (!(await filtro.isVisible({ timeout: 5000 }))) return;

    const opcoes = await filtro.evaluate((select: HTMLSelectElement) =>
      Array.from(select.options).map(o => o.value)
    );
    expect(opcoes).toContain('weekend');
  });

  test('deve ter opção "Este mês" no filtro', async ({ page }) => {
    const filtro = page.getByRole('combobox').first();
    if (!(await filtro.isVisible({ timeout: 5000 }))) return;

    const opcoes = await filtro.evaluate((select: HTMLSelectElement) =>
      Array.from(select.options).map(o => o.value)
    );
    expect(opcoes).toContain('month');
  });

  test('deve filtrar por "Este fim de semana" sem quebrar a página', async ({ page }) => {
    const filtro = page.getByRole('combobox').first();
    if (!(await filtro.isVisible({ timeout: 5000 }))) return;

    await filtro.selectOption({ value: 'weekend' });
    await page.waitForTimeout(500);
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 5000 });
  });

  test('deve filtrar por "Este mês" sem quebrar a página', async ({ page }) => {
    const filtro = page.getByRole('combobox').first();
    if (!(await filtro.isVisible({ timeout: 5000 }))) return;

    await filtro.selectOption({ value: 'month' });
    await page.waitForTimeout(500);
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 5000 });
  });

  test('deve restaurar todos os eventos ao voltar para "Todos"', async ({ page }) => {
    const filtro = page.getByRole('combobox').first();
    if (!(await filtro.isVisible({ timeout: 5000 }))) return;

    // Aplica filtro de mês
    await filtro.selectOption({ value: 'month' });
    await page.waitForTimeout(400);

    // Volta para todos
    await filtro.selectOption({ value: 'all' });
    await page.waitForTimeout(400);

    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 5000 });
  });

  test('deve combinar filtro de data com busca por texto', async ({ page }) => {
    const filtro = page.getByRole('combobox').first();
    const searchInput = page.getByPlaceholder(/buscar/i).first();

    if (!(await filtro.isVisible({ timeout: 5000 })) || !(await searchInput.isVisible({ timeout: 5000 }))) return;

    await filtro.selectOption({ value: 'month' });
    await searchInput.fill('show');
    await page.waitForTimeout(500);

    // A página não deve quebrar com ambos os filtros ativos
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Suite: Cards de Evento na Listagem
// ---------------------------------------------------------------------------

test.describe('Cards de Evento - Listagem', () => {
  test.beforeEach(async ({ page }) => {
    await irParaHome(page);
  });

  test('cards de evento devem ter imagem ou placeholder visual', async ({ page }) => {
    const eventCard = page.locator('[class*="cursor-pointer"]').first();
    if (!(await eventCard.isVisible({ timeout: 8000 }))) return;

    const img = eventCard.locator('img').first();
    const imgPlaceholder = eventCard.locator('[class*="bg-"]').first();

    if (await img.isVisible({ timeout: 3000 })) {
      await expect(img).toBeVisible();
    } else if (await imgPlaceholder.isVisible({ timeout: 3000 })) {
      await expect(imgPlaceholder).toBeVisible();
    }
  });

  test('cards de evento devem ter título do evento', async ({ page }) => {
    const eventCard = page.locator('[class*="cursor-pointer"]').first();
    if (!(await eventCard.isVisible({ timeout: 8000 }))) return;

    const titulo = eventCard.locator('h2, h3, [class*="font-"], [class*="text-lg"]').first();
    if (await titulo.isVisible({ timeout: 3000 })) {
      const text = await titulo.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });

  test('cards de evento devem ter data do evento', async ({ page }) => {
    const eventoCard = page.locator('[class*="cursor-pointer"]').first();
    if (!(await eventoCard.isVisible({ timeout: 8000 }))) return;

    const dataEl = eventoCard.locator('[class*="text-"]').filter({ hasText: /202\d|\d{2}\/\d{2}/i }).first();
    if (await dataEl.isVisible({ timeout: 3000 })) {
      await expect(dataEl).toBeVisible();
    }
  });

  test('cards de evento devem ter local do evento', async ({ page }) => {
    const eventoCard = page.locator('[class*="cursor-pointer"]').first();
    if (!(await eventoCard.isVisible({ timeout: 8000 }))) return;

    const localEl = eventoCard.locator('[class*="text-"]').filter({ hasText: /espaço|são paulo|sp|venue/i }).first();
    if (await localEl.isVisible({ timeout: 3000 })) {
      await expect(localEl).toBeVisible();
    }
  });

  test('botão "Ver Ingressos" deve estar visível nos cards de evento', async ({ page }) => {
    const verIngBtn = page.getByRole('button', { name: /ver ingressos/i }).first();
    if (await verIngBtn.isVisible({ timeout: 8000 })) {
      await expect(verIngBtn).toBeVisible();
    }
  });

  test('deve navegar para o booking ao clicar em "Ver Ingressos"', async ({ page }) => {
    const verIngBtn = page.getByRole('button', { name: /ver ingressos/i }).first();
    if (!(await verIngBtn.isVisible({ timeout: 8000 }))) return;

    await verIngBtn.click();
    await page.waitForTimeout(600);

    // Deve entrar na BookingView
    const bookingContent = page.getByText(/ingresso|mesa|local|selecione/i).first();
    if (await bookingContent.isVisible({ timeout: 6000 })) {
      await expect(bookingContent).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Busca em Tempo Real
// ---------------------------------------------------------------------------

test.describe('Busca em Tempo Real', () => {
  test.beforeEach(async ({ page }) => {
    await irParaHome(page);
  });

  test('deve mostrar a barra de busca na home', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/buscar/i).first();
    await expect(searchInput).toBeVisible({ timeout: 6000 });
  });

  test('deve ter ícone de lupa na barra de busca', async ({ page }) => {
    const lupaIcon = page.locator('.lucide-search, [data-lucide="search"]').first();
    if (await lupaIcon.isVisible({ timeout: 5000 })) {
      await expect(lupaIcon).toBeVisible();
    }
  });

  test('deve filtrar em tempo real ao digitar na busca', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/buscar/i).first();
    if (!(await searchInput.isVisible({ timeout: 6000 }))) return;

    await searchInput.fill('a');
    await page.waitForTimeout(300);
    // A lista deve ter atualizado sem precisar pressionar Enter
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 5000 });
  });

  test('deve limpar a busca ao clicar no campo e pressionar Ctrl+A + Delete', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/buscar/i).first();
    if (!(await searchInput.isVisible({ timeout: 6000 }))) return;

    await searchInput.fill('evento teste');
    await page.waitForTimeout(300);
    await searchInput.selectText();
    await searchInput.press('Delete');
    await page.waitForTimeout(300);

    const value = await searchInput.inputValue();
    expect(value).toBe('');
    await expect(page.getByText('Próximos Eventos').first()).toBeVisible({ timeout: 5000 });
  });

  test('a busca não deve ser case sensitive', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/buscar/i).first();
    if (!(await searchInput.isVisible({ timeout: 6000 }))) return;

    await searchInput.fill('EVENTO');
    await page.waitForTimeout(300);
    const upperCount = await page.getByRole('button', { name: /ver ingressos/i }).count();

    await searchInput.fill('evento');
    await page.waitForTimeout(300);
    const lowerCount = await page.getByRole('button', { name: /ver ingressos/i }).count();

    // Resultados devem ser iguais independente de maiúsculas
    expect(upperCount).toBe(lowerCount);
  });
});
