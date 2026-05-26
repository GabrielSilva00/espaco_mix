# Relatório de Erros — Suite Playwright
> Gerado em: 2026-05-26  
> Run executado: `npx playwright test --reporter=line` (7 projetos × todas as specs)  
> Total de testes que falharam: **1.862** (de ~5.500 executados)

---

## Resumo Rápido

| # | Categoria | Testes afetados | Solução |
|---|-----------|-----------------|---------|
| 1 | Browsers Firefox e WebKit não instalados | ~750+ | `npx playwright install firefox webkit` |
| 2 | Chromium sobrecarregado — timeout ao criar nova página | ~737 | Rodar por categoria, 1 projeto por vez |
| 3 | Credenciais de login inválidas / elementos não encontrados | ~285 | Configurar `.env` com credenciais reais |
| 4 | Timeout em requisição API com token falso | 1 | Adicionar timeout no server.ts |

---

## Categoria 1 — Firefox e WebKit não instalados

**Quantidade:** ~750+ falhos (todos os projetos `firefox`, `webkit`, `mobile-safari`, `tablet` quando usam webkit)  
**Erro:**
```
Error: browserType.launch: Executable doesn't exist at 
C:\Users\Felipe Ferreira\AppData\Local\ms-playwright\firefox-1522\firefox\firefox.exe
```

**Causa:** Os browsers Firefox e WebKit nunca foram instalados nesta máquina.  
**Correção (1 comando):**
```bash
npx playwright install firefox webkit
```
Isso resolve ~750 falhos de uma vez.

---

## Categoria 2 — Chromium sobrecarregado (browserContext.newPage timeout)

**Quantidade:** ~737 falhos  
**Erro:**
```
Test timeout of 30000ms exceeded while setting up "page".
Error: browserContext.newPage: Test timeout of 30000ms exceeded.
```
ou
```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
Error: browserContext.newPage: Test timeout of 30000ms exceeded.
```

**Causa:** Com 7 projetos simultâneos e `workers: 2`, o Chromium fica com muitas abas abertas em paralelo. Quando há muitos testes rodando ao mesmo tempo (especialmente nos projetos `desktop-hd`, `mobile-chrome`, `tablet`), a criação de novas páginas começa a estourar o timeout de 30s.

**Exemplos de testes afetados:**
- `tests\01-smoke\smoke.spec.ts >> Smoke — Elementos essenciais na home >> <footer> está presente`
- `tests\11-errors\error-boundaries.spec.ts >> Error Boundary — Rede >> falha na API de health não trava a aplicação`
- `testes\carrossel-paginacao.spec.ts >> Carrossel - Eventos em Destaque >> deve exibir nome do evento`
- `tests\05-purchase\selecao-ingresso.spec.ts >> Seleção de Ingresso — Resumo >> botão continuar está desabilitado`

**Correção — rodar por categoria e por projeto:**
```bash
# Instalar browsers primeiro (Categoria 1)
npx playwright install firefox webkit

# Depois rodar categoria por categoria, só 1 projeto para evitar sobrecarga
npx playwright test tests/01-smoke/   --project=chromium
npx playwright test tests/02-auth/    --project=chromium
npx playwright test tests/03-navigation/ --project=chromium
npx playwright test tests/04-events/  --project=chromium
npx playwright test tests/05-purchase/ --project=chromium
npx playwright test tests/06-reservations/ --project=chromium
npx playwright test tests/07-profile/ --project=chromium
npx playwright test tests/08-admin/   --project=chromium
npx playwright test tests/09-dev/     --project=chromium
npx playwright test tests/10-ui-ux/   --project=chromium
npx playwright test tests/11-errors/  --project=chromium
```

Ou ajustar `playwright.config.ts` para reduzir workers:
```typescript
workers: process.env.CI ? 1 : 1, // forçar 1 worker
```

---

## Categoria 3 — Credenciais inválidas / Elementos não encontrados

**Quantidade:** ~285 falhos  
**Erro:**
```
TimeoutError: locator.click: Timeout 10000ms exceeded.
```

### 3A — Testes que precisam de login (admin/user)

**Causa:** Os testes chamam `loginAsAdmin()` ou `loginAsUser()` usando as credenciais padrão do helper (`admin@teste.com / Admin@12345`), mas o Firebase retorna **"Invalid login credentials"**. Depois disso, o teste tenta clicar em botões que só aparecem quando logado (ex: "Minhas Reservas", "Criar Evento") — e eles nunca aparecem → timeout.

**Testes afetados (exemplos):**
- `tests\08-admin\dashboard-admin.spec.ts >> Dashboard Admin — Métricas >> total de eventos é exibido`
- `tests\08-admin\dashboard-admin.spec.ts >> Dashboard Admin — Métricas >> total de vendas ou receita é exibido`
- `tests\08-admin\dashboard-admin.spec.ts >> Dashboard Admin — Navegação >> links de aprovações e colaboradores estão no menu`
- `tests\07-profile\perfil-usuario.spec.ts >> Perfil — Dados Exibidos >> nome do usuário é exibido no perfil`
- `tests\06-reservations\transferencia.spec.ts >> Transferência — Iniciar >> clicar em "Transferir" abre formulário`
- `tests\02-auth\logout.spec.ts >> Logout — Páginas Protegidas >> links de admin não aparecem após logout`
- `tests\02-auth\logout.spec.ts >> Logout — Dropdown de Usuário >> dropdown fecha ao clicar fora dele`
- `tests\09-dev\logs-sistema.spec.ts >> Scanner de Check-in >> botão de scanner de QR está disponível`

**Correção — configurar credenciais reais:**
```bash
# Criar arquivo .env na raiz do projeto (ou .env.test)
TEST_USER_EMAIL=seu-usuario@dominio.com
TEST_USER_PASSWORD=sua-senha-usuario
TEST_ADMIN_EMAIL=admin@dominio.com
TEST_ADMIN_PASSWORD=senha-admin
TEST_DEV_EMAIL=dev@dominio.com
TEST_DEV_PASSWORD=senha-dev
```

E descomentar no `playwright.config.ts`:
```typescript
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
```

### 3B — Testes legados (`testes/`) com elementos renomeados/removidos

**Causa:** A pasta `testes/` contém specs antigas que testam elementos que mudaram ou não existem mais no app atual.

**Testes afetados (exemplos):**
- `testes\novos-testes.spec.ts >> Página de Contato - Detalhes >> deve exibir botão "Retornar ao Evento"` — botão não existe
- `testes\novos-testes.spec.ts >> LGPD - Comportamento >> deve aceitar cookies e não mostrar o banner novamente` — seletor mudou
- `testes\novos-testes.spec.ts >> Eventos - Interações na Home >> deve permitir busca por texto` — elemento não encontrado

**Ação:** Revisar cada spec da pasta `testes/` e atualizar os seletores para corresponder ao app atual, ou migrar os testes válidos para a nova estrutura `tests/`.

---

## Categoria 4 — Timeout em requisição API com token falso

**Quantidade:** 1 falho  
**Arquivo:** `testes\api-completa.spec.ts:196`  
**Teste:** `API - Proteção de Rotas Autenticadas >> deve retornar 401 com token inválido (Bearer fake)`  
**Erro:**
```
TimeoutError: apiRequestContext.post: Timeout 10000ms exceeded.
Call log:
  → POST http://localhost:3000/api/orders
    Authorization: Bearer token_totalmente_falso_xyzabc
```

**Causa:** O servidor (`server.ts`) verifica tokens via requisição externa ao Google (`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=TOKEN`). Quando o token é completamente inválido, a resposta do Google pode demorar mais de 10 segundos ou o servidor pode estar esperando indefinidamente sem timeout configurado.

**Correção em `server.ts`:**
```typescript
// Adicionar timeout ao fetch de verificação de token
const tokenResp = await fetch(
  `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${token}`,
  { signal: AbortSignal.timeout(5000) } // 5 segundos máximo
);
```

Ou no teste, aceitar que tokens inválidos podem causar timeout do servidor (500):
```typescript
// testes/api-completa.spec.ts:201
expect([401, 403, 500]).toContain(response.status());
```

---

## Plano de Ação — Ordem de Prioridade

### Passo 1 — Instalar browsers (imediato, resolve ~750 falhos)
```bash
npx playwright install firefox webkit
```

### Passo 2 — Configurar credenciais de teste
Criar `.env.test` com credenciais reais do Firebase. Isso desbloqueia todos os testes de admin/user/dev.

### Passo 3 — Re-rodar só o Chromium por categoria
```bash
npx playwright test tests/ --project=chromium --reporter=line
```
Isso vai mostrar quais falhos reais existem no app (sem o ruído dos browsers faltando).

### Passo 4 — Corrigir timeout no server.ts (token inválido)
Adicionar `AbortSignal.timeout(5000)` na verificação de token Google.

### Passo 5 — Revisar testes legados (`testes/`)
Verificar quais specs da pasta `testes/` têm seletores desatualizados e corrigir ou migrar.

### Passo 6 — Re-run completo com todos os browsers
```bash
npx playwright test --reporter=html
# Abrir relatório em: playwright-report/index.html
```

---

## Testes que passaram normalmente (não têm arquivo de erro)

Os seguintes tipos passaram sem problemas no Chromium:
- `tests/01-smoke` — Smoke tests básicos (quando Chromium não estava sobrecarregado)
- `tests/11-errors/form-validations.spec.ts` — Validações de API (CPF, registro) — passaram
- `testes/api-completa.spec.ts` — Maioria das rotas de API (health, privacy-policy, etc.)

---

## Como interpretar o playwright-report

O relatório HTML completo está em `playwright-report/index.html`. Para abrir:
```bash
npx playwright show-report
```

Cada arquivo `.md` na pasta `playwright-report/data/` corresponde a **um teste que falhou** e contém:
- Nome e localização do teste
- Mensagem de erro completa
- Snapshot da página no momento da falha (para testes de UI)
- Trecho do código do teste com a linha exata do erro
