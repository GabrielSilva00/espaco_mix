# Auditoria de Segurança — Eventix / Espaço Mix

> Data: 18/06/2026 · Escopo: estado atual do código (branch `main`)
> Plataforma: React 19 + Vite (frontend) · Express.js (`server.ts`) · Supabase (Auth + PostgreSQL + RLS) · Mercado Pago Orders API · Vercel serverless

## Resumo executivo

A postura geral de segurança é **boa e madura**. As correções recentes (escape de HTML no PDF/e-mail, OTP com `crypto.randomInt` + tabela `otp_attempts`, fail-closed de segredos e webhook, validação de preço server-side, RLS financeiro com trigger) estão **presentes e corretas** no código atual. **Não há vulnerabilidades críticas exploráveis.**

| Severidade | Quantidade |
|------------|-----------|
| 🔴 HIGH (exploráveis) | 0 |
| 🟡 MEDIUM | 4 (3 corrigidos · 1 pendente de decisão) |
| 🔵 LOW | 4 (3 corrigidos · 1 risco aceito) |
| ℹ️ INFO | 3 (I1 e I3 tratados · I2 risco aceito) |

> **Atualização 18/06/2026:** M2, M3, M4 corrigidos; M1 risco aceito. L1, L2, L3 corrigidos; L4 risco aceito (UX). I1 (OTP de cadastro) e I3 (fuso dos lembretes) tratados; I2 (CSP) risco aceito.

As principais oportunidades de melhoria: enumeração de e-mail/username, política de senha fraca no cadastro de staff, abuso do endpoint público de reservas e vazamento do corpo de erro cru do Mercado Pago.

---

## 🟡 MEDIUM

### M1 — Enumeração de e-mail na transferência de ingresso ⚠️ RISCO ACEITO
- **Local:** `server.ts:2090-2098` (`POST /api/ticket/:ticketId/transfer`)
- **Categoria:** enumeração de usuários / vazamento de informação (LGPD)
- **Descrição:** O endpoint responde `404` com `"O destinatário não possui cadastro no site..."` quando o e-mail não tem conta e prossegue (`200`) quando tem. Um usuário autenticado pode sondar e-mails arbitrários e descobrir quais possuem conta — oráculo de existência de conta.
- **Cenário de ataque:** Usuário com 1 ingresso ativo chama o endpoint variando `toEmail` e mapeia quem é cliente. O rate-limit global (200/15min) atenua, mas não impede coleta lenta.
- **Decisão (18/06/2026):** **Risco aceito.** A transferência exige que o destinatário tenha conta para aceitar; a mensagem explícita é necessária para a UX (orientar o remetente a pedir o cadastro). Mitigado por: exigir autenticação + posse do ingresso, rate-limit e limite de 2 transferências/ingresso. Reavaliar se surgir abuso real.

### M2 — Enumeração username → e-mail sem proteção ✅ CORRIGIDO
- **Local:** `server.ts` (`POST /api/auth/resolve-username` → substituído por `POST /api/auth/login-username`)
- **Categoria:** enumeração / vazamento de PII
- **Descrição:** O endpoint antigo retornava o e-mail real associado a um username (`{ email }`), permitindo mapear username→e-mail em massa.
- **Correção aplicada:** A rota agora recebe `username` + `password`, resolve o e-mail **internamente** e autentica server-side (anon key), devolvendo apenas os tokens da sessão (o cliente faz `supabase.auth.setSession`). Resposta `401` genérica e idêntica para "usuário inexistente" e "senha incorreta". O frontend (`loginWithUsername` em `supabase.ts`, `handleAdminLogin` em `AppContext.tsx`) foi ajustado. O e-mail nunca é exposto.

### M3 — Cadastro de staff aceita senha fraca ✅ CORRIGIDO
- **Local:** `server.ts` (`POST /api/staff`)
- **Categoria:** política de senha / autenticação
- **Descrição:** A criação de colaborador exigia apenas `password` não-vazio (sem mínimo), enquanto o `PATCH` já exigia `length >= 6`.
- **Correção aplicada:** Adicionada validação `password.length < 6 → 400` na criação, alinhando com o `PATCH`.

### M4 — Vazamento da resposta crua do Mercado Pago em erro ✅ CORRIGIDO
- **Local:** `server.ts` (`POST /api/payment/mercadopago` e fluxo de refund)
- **Categoria:** exposição de detalhes internos
- **Descrição:** Em falha, retornava `details: data`/`details: result.body` — o corpo de erro completo da Orders API ao cliente.
- **Correção aplicada:** Removido o campo `details` de ambas as respostas; o corpo cru continua sendo logado no servidor (`console.error`) e o cliente recebe apenas a mensagem amigável.

---

## 🔵 LOW

### L1 — Endpoint público de criação de reservas sem validação de e-mail/CPF ✅ PARCIALMENTE CORRIGIDO
- **Local:** `server.ts` (`POST /api/reservations`, sem `requireAuth`)
- **Categoria:** abuso de recurso / falta de validação
- **Descrição:** A rota é intencionalmente pública (convidados compram sem conta) e o preço é recalculado server-side (correto). Porém: (a) qualquer um cria reservas `pending` em massa; (b) `buyer_cpf` era gravado sem passar por `validateCpf`; o e-mail era truncado mas não validado por regex.
- **Correção aplicada:** Adicionada validação de `buyer_email` por regex e de `buyer_cpf` por `validateCpf` quando um CPF real é informado (o sentinela `000.000.000-00`/vazio é tratado como "sem CPF", preservando o checkout de convidado).
- **Pendente (não-segurança crítica):** o controle de spam de reservas `pending` (limite por e-mail/IP, janela de expiração) continua dependendo do rate-limit por IP. Avaliar se houver abuso real.

### L2 — `verifyPassword` aceita senha legada em plaintext ✅ MITIGADO
- **Local:** `server.ts` (`verifyPassword` + `POST /api/staff/login`)
- **Categoria:** fallback de migração / hashing
- **Descrição:** Se `stored` não começa com `scrypt:`, compara em plaintext (`password === stored`). Afeta só contas de staff nunca re-hasheadas.
- **Correção aplicada:** Re-hash transparente no login — quando uma senha legada (plaintext) confere, o servidor a converte para `scrypt` na hora (`hashPassword`) e atualiza a `staff_accounts`. Assim cada conta legada migra no primeiro login. O ramo plaintext em `verifyPassword` pode ser removido após confirmar que não restam contas sem `scrypt:`.

### L3 — `POST /api/orders` é stub e usa `Math.random` para o id ✅ CORRIGIDO
- **Local:** `server.ts` (`POST /api/orders` — removido)
- **Categoria:** PRNG fraco / código morto
- **Descrição:** Endpoint não persistia nada (TODO legado do Firebase) e gerava `orderId` com `Math.random().toString(36)`. Superfície morta autenticada.
- **Correção aplicada:** Endpoint removido (confirmado que nenhum código de produção o chamava; apenas um mock de teste o interceptava na camada de rede, sem depender do endpoint real).

### L4 — Anti-enumeração inconsistente entre cadastro e reset ⚠️ RISCO ACEITO
- **Local:** `server.ts` (`send-verify-code`)
- **Categoria:** enumeração
- **Descrição:** O cadastro retorna `409` confirmando "e-mail já cadastrado"/"CPF já cadastrado".
- **Decisão (18/06/2026):** **Risco aceito** — trade-off de UX legítimo (avisar duplicata antes de criar conta). Mitigado por `authLimiter`. Observação: com o M2 corrigido, o oráculo username→e-mail deixou de existir, reduzindo a superfície. Considerar CAPTCHA no cadastro se surgir abuso.

---

## ℹ️ INFO

### I1 — OTP de cadastro não usa o contador `otp_attempts` ✅ CORRIGIDO
- **Local:** `server.ts` (`check-verify-code`)
- **Descrição:** A tabela `otp_attempts` só era consultada em `reset-password`. O OTP de verificação de cadastro dependia apenas do `authLimiter` (20/15min por IP).
- **Correção aplicada:** `check-verify-code` agora é assíncrono e aplica `otpAttemptsExceeded`/`recordOtpFailure` com `kind = "email_verify"` (mesmo padrão do reset), com degradação graciosa se o admin client estiver indisponível.

### I2 — CSP relativamente permissiva ⚠️ RISCO ACEITO
- **Local:** `server.ts` (bloco `helmet`/CSP)
- **Descrição:** `styleSrc` inclui `'unsafe-inline'` e `imgSrc` inclui `https:`. Não é vulnerabilidade direta (sem `unsafe-inline` em scripts, `objectSrc 'none'`, `frameguard deny`).
- **Decisão (18/06/2026):** **Risco aceito.** O vetor crítico (scripts) já está travado sem `'unsafe-inline'`. `styleSrc 'unsafe-inline'` é exigido pelos estilos inline do React/Tailwind; `imgSrc https:` é necessário porque imagens vêm de várias origens (Supabase Storage, `api.qrserver.com`, Mercado Pago e avatares externos do Google via OAuth). Apertar quebraria UI e imagens legítimas, com ganho marginal. Reavaliar se migrar imagens para hosts fixos.

### I3 — Lembretes comparam hora em UTC ✅ CORRIGIDO
- **Local:** `server.ts` (`handleSendReminders`)
- **Descrição:** A hora configurada pelo admin era comparada em UTC; se o admin pensa em horário de Brasília, os lembretes saíam ~3h deslocados. Não é segurança.
- **Correção aplicada:** A hora atual passa a ser calculada em horário de Brasília (UTC−3, fixo — sem horário de verão desde 2019) antes da comparação com `reminder_cron_hour`.

---

## ✅ Controles verificados como corretos

- **Preço server-side:** `computeOrderTotal` (`server.ts:585`) recalcula do banco em todos os fluxos; valor do cliente é só logado e descartado. Valida setor pertencente ao evento, mesas válidas e evento pausado.
- **Webhook MP** (`server.ts:2781`): assinatura HMAC validada com `crypto.timingSafeEqual`, **processa antes de responder** (correto p/ serverless), **fail-closed em produção** sem secret, re-consulta o status real na API, idempotência via claim atômico em `confirmation_email_sent_at`.
- **Autorização por role do banco:** `getProfileRole`/`requireAdmin` consultam `profiles.role` via service role; o `userRole` do frontend é apenas cosmético. Nenhum uso de `user_metadata`/token para role.
- **Sem `application_fee`** nos payloads da Orders API (ambos os fluxos).
- **Segredos sem fallback hardcoded:** `staffSecret()` e `signOtp()` lançam se não houver env. `app_secrets` e `otp_attempts` com RLS habilitado e **sem policies** (só service role). View `system_config_public` expõe apenas colunas seguras.
- **RLS financeiro:** trigger `protect_reservation_financials` impede usuário comum de alterar `payment_status/payment_id/total/platform_fee/net_amount`; `ticket_items` INSERT só vinculado à própria reserva.
- **XSS:** `escapeHtml`/`sanitizeName` no servidor; `escapeHtml` em `pdf.ts` (no `document.write`) e em `emailService.ts`. Nenhum `dangerouslySetInnerHTML` no frontend.
- **Cripto de CPF:** AES-256-CBC com IV aleatório + `cpf_hash` HMAC determinístico para índice único.
- **IDOR mitigado:** status de pagamento, reenvio de e-mail, cancelamento, transferência, resume-PIX e refund verificam dono ou admin/developer; refund (`server.ts:3568`) com checagem anti-IDOR explícita; estorno feito antes de cancelar o ticket.
- **Higiene:** `trust proxy = 1`, rate limiters dedicados, CORS restrito a `APP_URL` em produção, HSTS/frameguard, redirect HTTPS, `.env*` gitignored, service role **nunca** referenciado no frontend, `timingSafeEqual` nas verificações de OTP/staff.

---

## Observações de confiança

A verificação de RLS baseou-se nas **migrations versionadas**; o estado real aplicado em produção não foi inspecionado diretamente. As migrations de lockdown da `system_config` e `otp_attempts` constam como aplicadas, mas vale rodar `npx tsx scripts/check-schema.ts` para confirmar que estão ativas em produção antes de considerar esses controles 100% efetivos.
