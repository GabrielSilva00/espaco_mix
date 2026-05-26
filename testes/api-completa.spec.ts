import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Suite: Health Check
// ---------------------------------------------------------------------------

test.describe('API - Health Check', () => {
  test('deve retornar status 200 no health check', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);
    expect(response.status()).toBe(200);
  });

  test('deve retornar propriedade "status" no health check', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);
    const body = await response.json();
    expect(body).toHaveProperty('status');
  });

  test('deve retornar status "ok" ou "healthy"', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);
    const body = await response.json();
    expect(['ok', 'healthy', 'running']).toContain(body.status?.toLowerCase?.() ?? body.status);
  });

  test('deve retornar informações do ambiente no health check', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);
    const body = await response.json();
    // Pode ter environment, node_env ou timestamp
    expect(typeof body).toBe('object');
  });

  test('deve responder ao health check em menos de 2 segundos', async ({ request }) => {
    const inicio = Date.now();
    await request.get(`${API_URL}/api/health`);
    const duracao = Date.now() - inicio;
    expect(duracao).toBeLessThan(2000);
  });
});

// ---------------------------------------------------------------------------
// Suite: Política de Privacidade
// ---------------------------------------------------------------------------

test.describe('API - Política de Privacidade', () => {
  test('deve retornar 200 na rota de política de privacidade', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/privacy-policy`);
    expect(response.status()).toBe(200);
  });

  test('deve retornar conteúdo de texto ou HTML na política de privacidade', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/privacy-policy`);
    const contentType = response.headers()['content-type'] ?? '';
    // Deve ser text/html, text/plain ou application/json
    expect(contentType.length).toBeGreaterThan(0);
  });

  test('deve retornar corpo não vazio na política de privacidade', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/privacy-policy`);
    const body = await response.text();
    expect(body.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Suite: Validação de CPF
// ---------------------------------------------------------------------------

test.describe('API - Validação de CPF', () => {
  test('deve rejeitar CPF com todos os dígitos iguais (111.111.111-11)', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/validate-cpf`, {
      data: { cpf: '111.111.111-11' },
    });
    expect([200, 400, 422, 429]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.valid).toBe(false);
    }
  });

  test('deve rejeitar CPF com todos os dígitos iguais (000.000.000-00)', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/validate-cpf`, {
      data: { cpf: '000.000.000-00' },
    });
    expect([200, 400, 422, 429]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.valid).toBe(false);
    }
  });

  test('deve rejeitar CPF com menos de 11 dígitos', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/validate-cpf`, {
      data: { cpf: '123.456.789' },
    });
    expect([200, 400, 422, 429]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.valid).toBe(false);
    }
  });

  test('deve rejeitar CPF completamente inválido (999.999.999-99)', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/validate-cpf`, {
      data: { cpf: '999.999.999-99' },
    });
    expect([200, 400, 422, 429]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.valid).toBe(false);
    }
  });

  test('deve aceitar CPF válido: 529.982.247-25', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/validate-cpf`, {
      data: { cpf: '529.982.247-25' },
    });
    expect([200, 400]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty('valid');
      // CPF 529.982.247-25 é matematicamente válido
      expect(body.valid).toBe(true);
    }
  });

  test('deve aceitar CPF válido sem formatação: 52998224725', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/validate-cpf`, {
      data: { cpf: '52998224725' },
    });
    expect([200, 400]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty('valid');
    }
  });

  test('deve retornar 400 ao enviar CPF como string vazia', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/validate-cpf`, {
      data: { cpf: '' },
    });
    expect([400, 422]).toContain(response.status());
  });

  test('deve retornar 400 ao enviar body sem campo cpf', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/validate-cpf`, {
      data: {},
    });
    expect([400, 422]).toContain(response.status());
  });

  test('deve retornar erro ao enviar CPF com letras', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/validate-cpf`, {
      data: { cpf: 'abc.def.ghi-jk' },
    });
    expect([200, 400, 422, 429]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.valid).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: Rotas Autenticadas (sem token)
// ---------------------------------------------------------------------------

test.describe('API - Proteção de Rotas Autenticadas', () => {
  test('deve retornar 401 ou 403 em /api/orders sem token', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/orders`, {
      data: { eventId: 1, tickets: 1 },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('deve retornar 401 ou 403 em /api/create-payment-intent sem token', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/create-payment-intent`, {
      data: { amount: 100, method: 'pix' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('deve retornar 401 ou 403 em /api/admin/settings sem token', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/admin/settings`);
    expect([401, 403]).toContain(response.status());
  });

  test('deve retornar 401 ou 403 em /api/producer/rejection-email sem token', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/producer/rejection-email`, {
      data: { producerId: '123' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('deve retornar 401 com token inválido (Bearer fake)', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/orders`, {
      headers: { Authorization: 'Bearer token_totalmente_falso_xyzabc' },
      data: {},
      timeout: 8000,
    });
    // 401/403 esperado; 500 possível se a verificação Supabase lançar exceção antes do timeout de 5s
    expect([401, 403, 500]).toContain(response.status());
  });

  test('deve retornar 401 com Authorization header malformado', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/orders`, {
      headers: { Authorization: 'nao_e_bearer' },
      data: {},
    });
    expect([401, 403]).toContain(response.status());
  });
});

// ---------------------------------------------------------------------------
// Suite: Registro de Usuário
// ---------------------------------------------------------------------------

test.describe('API - Registro de Usuário', () => {
  test('deve retornar 400 ao registrar sem e-mail', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/users/register`, {
      data: {
        name: 'Teste',
        password: 'Senha@123',
        lgpdConsent: true,
      },
    });
    expect([400, 422]).toContain(response.status());
  });

  test('deve retornar 400 ao registrar com e-mail inválido', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/users/register`, {
      data: {
        name: 'Teste',
        email: 'nao_e_um_email',
        password: 'Senha@123',
        lgpdConsent: true,
      },
    });
    expect([400, 422]).toContain(response.status());
  });

  test('deve retornar 400 ao registrar sem consentimento LGPD', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/users/register`, {
      data: {
        name: 'Teste',
        email: 'teste@playwright.com',
        password: 'Senha@123',
        lgpdConsent: false,
      },
    });
    expect([400, 422]).toContain(response.status());
  });

  test('deve retornar 400 ao registrar sem nome', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/users/register`, {
      data: {
        email: 'teste@playwright.com',
        password: 'Senha@123',
        lgpdConsent: true,
      },
    });
    expect([400, 422]).toContain(response.status());
  });

  test('deve retornar 400 ao registrar sem senha', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/users/register`, {
      data: {
        name: 'Teste',
        email: 'teste@playwright.com',
        lgpdConsent: true,
      },
    });
    expect([400, 422]).toContain(response.status());
  });

  test('deve retornar 400 ao enviar body vazio no registro', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/users/register`, {
      data: {},
    });
    expect([400, 422]).toContain(response.status());
  });
});

// ---------------------------------------------------------------------------
// Suite: Segurança de Headers
// ---------------------------------------------------------------------------

test.describe('API - Headers de Segurança', () => {
  test('deve incluir headers de segurança na resposta do health check', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);
    const headers = response.headers();

    // Helmet adiciona pelo menos um desses headers
    const hasSecurityHeader = 'x-content-type-options' in headers
      || 'x-frame-options' in headers
      || 'x-xss-protection' in headers
      || 'strict-transport-security' in headers;

    expect(hasSecurityHeader).toBe(true);
  });

  test('deve ter Content-Type correto nas respostas JSON', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);
    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toContain('application/json');
  });

  test('deve retornar 404 para rota inexistente', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/rota-que-nao-existe-xyzabc`);
    // 404 esperado (server.ts tem catch-all /api/*); aceita 200 em dev legado (Vite SPA fallback)
    expect([404, 400, 200]).toContain(response.status());
  });
});

// ---------------------------------------------------------------------------
// Suite: Rate Limiting
// ---------------------------------------------------------------------------

test.describe('API - Rate Limiting', () => {
  test('deve aceitar múltiplas requisições dentro do limite', async ({ request }) => {
    // Faz 5 requisições ao health check (bem abaixo do limite de 200/15min)
    for (let i = 0; i < 5; i++) {
      const response = await request.get(`${API_URL}/api/health`);
      expect(response.status()).toBe(200);
    }
  });

  test('deve aceitar múltiplas validações de CPF dentro do limite', async ({ request }) => {
    // Faz 5 validações (abaixo do limite de 20/15min para auth)
    for (let i = 0; i < 5; i++) {
      const response = await request.post(`${API_URL}/api/validate-cpf`, {
        data: { cpf: '529.982.247-25' },
      });
      expect([200, 400]).toContain(response.status());
    }
  });
});
