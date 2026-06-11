# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Instruções de Idioma
- Responda sempre em português brasileiro.
- Use termos técnicos em inglês quando apropriado para programação.

## Project Overview

**Eventix** is a full-stack event ticketing platform built with React + Express, featuring:
- User registration and authentication via Supabase Auth
- Event management and ticket sales (tables + individual tickets)
- Payments via Mercado Pago Orders API (PIX, Credit/Debit Card)
- Server-side confirmation e-mails with ticket QR codes
- Admin dashboard, staff (portaria) check-in flow, and onboarding
- Security-first architecture: RLS, rate limiting, input validation, encrypted secrets

## Essential Commands

```bash
# Development
npm run dev           # Start Vite dev server (http://localhost:5173)
npm run dev:server   # Start Express backend (http://localhost:3000)

# Building
npm run build        # Build frontend for production
npm run preview      # Preview production build locally

# Code Quality
npm run lint         # Type-check with TypeScript

# Database
npx tsx scripts/run-migration.ts supabase/migrations/<file>.sql  # Apply migration
npx tsx scripts/check-schema.ts                                  # Verify schema state (read-only)
```

**Development Setup:** Run both servers in separate terminals:
```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev
```

## Architecture

### Frontend (React 19 + Vite)
- **Entry:** `src/main.tsx` → `src/App.tsx`
- **Styling:** Tailwind CSS — identidade visual: ouro `#d4af37`, fundo preto/cinza escuro, títulos serif
- **State Management:** `src/context/AppContext.tsx` (contexto único, ~2300 linhas) + Supabase
- **Key Modules:**
  - `src/modules/payment/CheckoutModal.tsx`: fluxo de compra completo (seleção → login → pagamento → polling → sucesso)
  - `src/modules/dashboard/DashboardView.tsx`: dashboard admin/produtor
  - `src/modules/reservations/ReservationsView.tsx`: "Minhas Reservas" com QR codes
  - `src/lib/supabase.ts`: client + helpers de dados (config pública via view `system_config_public`, admin via `getSystemConfigAdmin`)

### Backend (Express.js + Node.js)
- **Server:** `server.ts` — Express instance única (API + serving); na Vercel roda como serverless via `api/index.ts`
- Security middleware (Helmet, CORS, Rate Limiting), `validateEnv()` loga avisos `[STARTUP]` para env incompleta
- Supabase **service role** no backend (bypassa RLS) — é a única fonte de verdade de pagamento e o único emissor de e-mail; o frontend apenas observa status

### Database & Auth
- **Supabase:** Auth (tokens validados server-side), PostgreSQL com RLS
- **Migrações:** `supabase/migrations/*.sql`, aplicadas via `scripts/run-migration.ts` usando `SUPABASE_DB_URL` (transaction pooler porta **6543** — 5432 e host direto NÃO funcionam)
- **`system_config`:** tabela restrita a admin; leitura pública via view `system_config_public` (colunas seguras apenas — nunca expor smtp_*, email_*, notify_*)

### Payment Integration
- **Provider:** Mercado Pago **Orders API** (`/v1/orders`) — rotas `/api/payment/pix` e `/api/payment/mercadopago`
- **Payment Methods:** PIX, Credit Card, Debit Card
- **`payment_id` na reserva = ORDER id** (`data.id` da Orders API), usado para re-consultar `/v1/orders/{id}`
- **Sandbox:** Orders API NÃO aceita credenciais `TEST-`; use credenciais `APP_USR-` de um vendedor de teste + comprador com e-mail `@testuser.com`
- **Restrição MP:** `application_fee` NÃO é suportado pela Orders API — exclusivo do Checkout Pro (Preferences API). Nunca incluir esse campo no payload de `/v1/orders`

### Payment Flow (server-side como fonte de verdade)
1. Frontend cria a reserva (`pending`) e chama `/api/payment/pix` ou `/api/payment/mercadopago`
2. Servidor valida preço server-side, cria a order no MP e grava `payment_id` (order id)
3. **PIX:** frontend exibe QR e inicia polling em `GET /api/payment/status/:reservationId` (5s; a cada 5ª iteração `?refresh=1` re-consulta o MP)
4. **Cartão:** `approved` → sucesso imediato; `pending`/`in_process` → estado `in_review` + polling
5. **Webhook `/api/webhook/mercadopago`:** valida assinatura HMAC, processa ANTES de responder (serverless congela após a resposta!), atualiza a reserva e dispara o e-mail de confirmação. Falha transitória → responde 500 (MP reenvia = fila de retry)
6. **E-mail de confirmação:** enviado APENAS pelo servidor (`sendReservationConfirmation`), com claim atômico de idempotência em `reservations.confirmation_email_sent_at`, QR codes dos `ticket_items` e dados do banco (nunca do cliente)

## API Routes

### Public Routes
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Health check with environment info |
| POST | `/api/validate-cpf` | Validate Brazilian CPF (rate limited) |
| GET | `/api/events/:id/occupied-tables` | Mesas ocupadas (sem PII) |
| POST | `/api/webhook/mercadopago` | Webhook MP (assinatura HMAC) |

### Authenticated Routes (Supabase access token in `Authorization: Bearer <token>`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/payment/pix` | Cria order PIX no MP |
| POST | `/api/payment/mercadopago` | Cria order de cartão no MP |
| GET | `/api/payment/status/:reservationId` | Status do pagamento (`?refresh=1` re-consulta MP) |
| POST | `/api/email/send-confirmation` | Reenvio do e-mail (body `{ reservationId }`; dono ou admin) |
| GET | `/api/admin/settings` | Admin settings (role check server-side) |

## Environment Variables

Ver `.env.example` para a lista completa comentada. Resumo (backend, sem prefixo `VITE_`):

```
NODE_ENV                     # "development" or "production"
PORT                         # Default: 3000
APP_URL                      # Required in production (CORS)
PAYMENT_PROVIDER             # "mercadopago" | "disabled"
MERCADOPAGO_ACCESS_TOKEN     # APP_USR-... (vendedor de teste em sandbox)
MERCADOPAGO_WEBHOOK_SECRET   # Assinatura secreta do webhook (painel MP)
SUPABASE_SERVICE_ROLE_KEY    # Service role (bypassa RLS) — NUNCA no frontend
SUPABASE_DB_URL              # Postgres via transaction pooler :6543 (migrações)
ENCRYPTION_KEY               # 64 hex chars — descriptografa segredos do painel (app_secrets)
RESEND_API_KEY               # E-mail via Resend (ou SMTP_* / config no painel)
CRON_SECRET                  # Protege /api/email/send-reminders
```

Frontend (`VITE_` = exposto): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MERCADOPAGO_PUBLIC_KEY`.

### Checklist manual de deploy (produção)
1. Cadastrar TODAS as env vars de backend na Vercel (Settings → Environment Variables)
2. No painel do Mercado Pago: Suas integrações → Webhooks → cadastrar `https://<domínio>/api/webhook/mercadopago` (evento: Pagamentos) e copiar a **assinatura secreta** para `MERCADOPAGO_WEBHOOK_SECRET`
3. Aplicar migrações pendentes: `npx tsx scripts/run-migration.ts supabase/migrations/<file>.sql` (após o deploy do código)
4. Conferir com `npx tsx scripts/check-schema.ts`

## Key Implementation Details

### Rate Limiting
- **Global:** 200 requests per 15 minutes (rota `/api/payment/status/` é isenta)
- **Auth:** 20 attempts per 15 minutes
- **Payments:** 10 attempts per 10 minutes
- **Payment status polling:** 300 per 10 minutes (limiter dedicado)
- **Proxy:** `app.set('trust proxy', 1)` configurado para que `req.ip` reflita o IP real do cliente via `X-Forwarded-For` (Vercel). Sem isso o `express-rate-limit` lança `ERR_ERL_FORWARDED_HEADER` e bloqueia todas as requisições

### Security Headers
- **Production:** CSP enabled with strict directives
- **Development:** CSP disabled for easier debugging
- CORS restricted to `APP_URL` in production; unrestricted in development

## File Structure Highlights

```
espaco_mix/
├── server.ts              # Express backend (~2400 linhas) + Vite dev proxy
├── emailService.ts        # Envio de e-mail (Resend/SMTP) + templates com QR codes
├── api/index.ts           # Entry serverless Vercel → createExpressApp
├── vite.config.ts         # Frontend build config
├── src/
│   ├── App.tsx            # Componente principal (routing + modais globais)
│   ├── context/AppContext.tsx  # Estado global (auth, checkout, polling de pagamento)
│   ├── lib/supabase.ts    # Client + data helpers
│   └── modules/           # payment/, dashboard/, reservations/, auth/, ...
├── scripts/
│   ├── run-migration.ts   # Aplica SQL via pooler 6543
│   └── check-schema.ts    # Verifica estado do schema (read-only)
├── supabase/migrations/   # Migrações SQL versionadas
└── dist/                  # Build output (production)
```

## Deployment (Vercel)

- **Backend:** Serverless function em `api/index.ts` — importa `createExpressApp` do `server.ts` e despacha cada request para o Express
- **Rewrites:** `/api/*` → `api/index`; demais rotas → `index.html` (SPA)
- **`maxDuration: 30`** no `vercel.json` — dá folga para o webhook processar antes de responder
- **Serverless gotcha:** NUNCA responder antes de terminar o processamento — a função é congelada após `res.send()` e código posterior pode não executar
- **Cron jobs:** Removidos do `vercel.json` — requerem plano Pro. O endpoint `/api/email/send-reminders` existe mas deve ser disparado via serviço externo (ex: [cron-job.org](https://cron-job.org)) com `CRON_SECRET`
- **Build:** `npm run build` gera `dist/`; `outputDirectory: "dist"` no `vercel.json`

## Common Development Tasks

### Adding a New API Endpoint
1. Add route handler in `server.ts` with appropriate middleware
2. Apply rate limiting if user-facing
3. Validate all inputs server-side
4. Log sensitive data redacted (mask emails, etc.)
5. Return proper HTTP status codes (201 for creation, 400 for validation, 401 for auth)

### Adding a New React Component
- Place in `src/components/` (or the matching `src/modules/<area>/`)
- Use Tailwind classes for styling (no inline CSS); manter identidade visual (ouro `#d4af37`, serif nos títulos)
- Auth state vem do `AppContext` (`useApp()`); token via `getAccessTokenSafe()`
- Call API endpoints with Bearer token in Authorization header

### Database Migrations
- Criar em `supabase/migrations/AAAAMMDD_descricao.sql`, idempotente (`IF NOT EXISTS`), com `BEGIN/COMMIT`
- Aplicar via `npx tsx scripts/run-migration.ts <arquivo>` (usa `SUPABASE_DB_URL`, pooler 6543)
- NUNCA aplicar migração que remove acesso (DROP POLICY) antes do deploy do código que a acomoda

## Known Limitations & TODOs

1. **Stripe:** não implementado (apenas Mercado Pago)
2. **Email Reminders Cron:** removido do `vercel.json` (plano Hobby); disparar `/api/email/send-reminders` via serviço externo
3. **PIX em sandbox:** QR code de teste tem limitações no ambiente sandbox do MP

## Troubleshooting

**CORS errors in development?**
- Ensure `npm run dev:server` runs before `npm run dev`
- Frontend should connect to `http://localhost:3000` (backend), not the Vite port

**Pagamento aprovado mas reserva continua `pending`?**
- Verificar se o webhook está cadastrado no painel MP e `MERCADOPAGO_WEBHOOK_SECRET` setado na Vercel
- O polling do frontend com `?refresh=1` é a rede de segurança: re-consulta `/v1/orders/{payment_id}` diretamente
- Conferir logs `[WEBHOOK]` na Vercel

**E-mail de confirmação não chegou?**
- Conferir provedor: `RESEND_API_KEY`/`SMTP_*` em env ou config no painel admin (exige `ENCRYPTION_KEY` correta)
- Falhas ficam em `audit_logs` com `action = 'email_confirmation_failed'`
- Reenvio: botão "Reenviar e-mail" no dashboard (Visualizar comprador) ou `POST /api/email/send-confirmation`

**TypeScript errors?**
- Run `npm run lint` to see all type issues

**Erro 'unsupported_properties' no Mercado Pago?**
- A Orders API (`/v1/orders`) não aceita `application_fee` — esse campo é exclusivo do Checkout Pro (Preferences API)
- Verificar se nenhum campo extra foi adicionado ao payload de `/v1/orders`

**Rate limiter lançando ERR_ERL_FORWARDED_HEADER na Vercel?**
- Confirmar que `app.set('trust proxy', 1)` está logo após `const app = express()` em `server.ts`

**Migração falhando ao conectar?**
- Usar `SUPABASE_DB_URL` com o transaction pooler porta **6543** — a 5432 e o host direto falham neste projeto
