import { Page, expect } from '@playwright/test';
import { loginAsAdmin } from './auth.helper';

// ─── Geração de dados ──────────────────────────────────────────────────────────

/**
 * Gera um CPF matematicamente válido para uso em testes.
 * Algoritmo de dígitos verificadores do CPF.
 */
export function generateValidCPF(): string {
  const n = (max: number) => Math.floor(Math.random() * max);

  const d = Array.from({ length: 9 }, () => n(10));

  const calc = (digits: number[], weights: number[]) => {
    const sum = digits.reduce((acc, val, i) => acc + val * weights[i], 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  d.push(calc(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]));
  d.push(calc(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]));

  return `${d.slice(0, 3).join('')}.${d.slice(3, 6).join('')}.${d.slice(6, 9).join('')}-${d[9]}${d[10]}`;
}

/**
 * Gera um e-mail único de teste com timestamp.
 */
export function generateTestEmail(prefix = 'playwright'): string {
  return `${prefix}_${Date.now()}@teste.playwright.local`;
}

/**
 * Gera um nome de evento único com timestamp.
 */
export function generateEventName(prefix = 'Evento Teste'): string {
  return `${prefix} ${Date.now()}`;
}

// ─── Dados de eventos de teste ────────────────────────────────────────────────

export interface TestEventData {
  title:       string;
  description: string;
  date:        string; // YYYY-MM-DD
  location:    string;
  status:      'Rascunho' | 'Em breve' | 'Ativo' | 'Vendas liberadas';
  priceType:   'unique' | 'gender';
  price:       number;
}

export function defaultEventData(overrides: Partial<TestEventData> = {}): TestEventData {
  const futureDate = new Date();
  futureDate.setMonth(futureDate.getMonth() + 1);
  const dateStr = futureDate.toISOString().split('T')[0];

  return {
    title:       generateEventName(),
    description: 'Evento criado automaticamente por testes Playwright.',
    date:        dateStr,
    location:    'Espaço Mix - São Paulo, SP',
    status:      'Rascunho',
    priceType:   'unique',
    price:       50,
    ...overrides,
  };
}

// ─── Criação de dados via UI (admin) ──────────────────────────────────────────

/**
 * Cria um evento de teste via interface admin.
 * Retorna true se o evento foi criado com sucesso.
 * Requer que o usuário esteja autenticado como admin.
 */
export async function createTestEvent(
  page:      Page,
  eventData: Partial<TestEventData> = {},
): Promise<boolean> {
  const data = defaultEventData(eventData);

  // Navega para o dashboard
  const dashBtn = page.getByRole('button', { name: /aprovações|dashboard/i }).first();
  if (!(await dashBtn.isVisible({ timeout: 5000 }))) return false;

  // Acessa criação de evento
  const criarBtn = page.getByRole('button', { name: /criar|novo evento/i }).first();
  if (!(await criarBtn.isVisible({ timeout: 5000 }))) return false;
  await criarBtn.click();
  await page.waitForTimeout(400);

  // Preenche o formulário
  const campoTitulo = page.getByPlaceholder(/título|nome do evento/i).first();
  if (!(await campoTitulo.isVisible({ timeout: 5000 }))) return false;

  await campoTitulo.fill(data.title);

  const campoDesc = page.getByPlaceholder(/descrição|sobre o evento/i).first();
  if (await campoDesc.isVisible({ timeout: 2000 })) {
    await campoDesc.fill(data.description);
  }

  const campoData = page.locator('input[type="date"]').first();
  if (await campoData.isVisible({ timeout: 2000 })) {
    await campoData.fill(data.date);
  }

  const campoLocal = page.getByPlaceholder(/local|endereço|venue/i).first();
  if (await campoLocal.isVisible({ timeout: 2000 })) {
    await campoLocal.fill(data.location);
  }

  // Salva o evento
  const salvarBtn = page.getByRole('button', { name: /salvar|criar evento/i }).first();
  if (!(await salvarBtn.isVisible({ timeout: 3000 }))) return false;
  await salvarBtn.click();
  await page.waitForTimeout(800);

  return true;
}

/**
 * Limpa dados de teste criados durante a sessão de testes.
 * Navega para o dashboard admin e remove eventos com "Teste" no nome.
 */
export async function cleanTestData(page: Page): Promise<void> {
  // Esta função deve ser usada em afterEach/afterAll
  // A limpeza real depende da implementação da interface admin
  // Por hora, apenas registra que a limpeza foi tentada
  const currentUrl = page.url();
  if (!currentUrl.includes('localhost')) return;

  // Tenta localizar e remover eventos de teste
  const deleteBtn = page.locator('button').filter({ hasText: /excluir|deletar|remover/i }).first();
  if (await deleteBtn.isVisible({ timeout: 2000 })) {
    // Confirma que é um evento de teste antes de deletar
    const contexto = await deleteBtn.evaluate(el => el.closest('[class*="card"], li, tr')?.textContent ?? '');
    if (/playwright|teste playwright/i.test(contexto)) {
      await deleteBtn.click();
      const confirmar = page.getByRole('button', { name: /confirmar|sim|ok/i }).first();
      if (await confirmar.isVisible({ timeout: 2000 })) {
        await confirmar.click();
      }
    }
  }
}

// ─── Helpers de espera ────────────────────────────────────────────────────────

/**
 * Aguarda que todos os requests de rede terminem.
 */
export async function waitForNetworkIdle(page: Page, timeout = 5000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {
    // Ignora timeout — a página pode ter requests longos em background
  });
}

/**
 * Aguarda que um elemento de loading desapareça.
 */
export async function waitForLoadingToDisappear(page: Page): Promise<void> {
  const loader = page.getByText(/carregando|loading/i).first();
  try {
    await loader.waitFor({ state: 'hidden', timeout: 10000 });
  } catch {
    // Loader pode não existir
  }
}

// ─── CPFs de referência para testes ──────────────────────────────────────────

/**
 * CPFs matematicamente válidos para uso em testes.
 * Estes são CPFs gerados apenas para testes — não pertencem a nenhuma pessoa real.
 */
export const TEST_CPFS = {
  valido1: '529.982.247-25',
  valido2: '111.444.777-35',
  invalido_sequencial: '111.111.111-11',
  invalido_zeros: '000.000.000-00',
  invalido_formato: '123.456.789',
  invalido_digitos: '529.982.247-26',
} as const;
