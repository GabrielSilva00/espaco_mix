-- ============================================================================
--  wipe-all-for-handover.sql  —  ZERA O BANCO para entrega ao dono do site
-- ============================================================================
--
--  ⚠️  ATENÇÃO — OPERAÇÃO IRREVERSÍVEL  ⚠️
--  Este script REMOVE PERMANENTEMENTE todos os dados de teste (eventos, compras,
--  usuários, staff, logs) deixando o site pronto para o dono começar do zero.
--  NÃO HÁ COMO DESFAZER depois do COMMIT. Faça um BACKUP do banco antes.
--
--  COMO USAR COM SEGURANÇA:
--    1. Rode o script como está (ele termina em ROLLBACK e NÃO apaga nada).
--    2. Revise as contagens ANTES/DEPOIS e confirme que está correto
--       (DEPOIS deve ser 0 em tudo, e profiles = 1 — só a conta admin).
--    3. Só então troque a última linha `ROLLBACK;` por `COMMIT;` e rode de novo.
--
--    Comando: npx tsx scripts/run-migration.ts scripts/sql/wipe-all-for-handover.sql
--
--  O QUE É APAGADO:
--    • Todos os eventos, setores, lotes e códigos de acesso a setor
--    • Todas as reservas, ingressos, transferências e cancelamentos
--    • Toda a equipe de portaria (staff_accounts)
--    • Solicitações de produtor e dados bancários
--    • Logs de auditoria e tentativas de OTP
--    • TODAS as contas de usuário, EXCETO a conta admin — inclui as contas
--      "fantasmas" de teste: developer (acesso@developer.com) e o test user do
--      Mercado Pago (testuser...@testuser.com). Remove tanto o perfil (profiles)
--      quanto o login (auth.users).
--
--  O QUE É PRESERVADO:
--    • A conta admin (acesso@admin.com) — usada pelo dono no "Acesso Master"
--    • app_secrets (tokens do Mercado Pago, SMTP, etc.) — INTACTO
--    • A conexão OAuth do vendedor MP (mp_seller_* em system_config) — INTACTA
--    • O schema (tabelas, policies, triggers) — nada é dropado
--
--  Após o COMMIT, o system_config fica com onboarding_completed = false, então no
--  PRIMEIRO acesso do dono pelo "Acesso Master" o wizard de configuração inicial
--  (AdminOnboarding) abre automaticamente para ele preencher os próprios dados e
--  os dados do site.
--
--  ORDEM DE EXCLUSÃO respeita as chaves estrangeiras (filhos → pais).
-- ============================================================================

BEGIN;

-- ── 1. Contagens ANTES ──────────────────────────────────────────────────────
SELECT 'ANTES' AS momento,
       (SELECT count(*) FROM events)        AS events,
       (SELECT count(*) FROM reservations)  AS reservations,
       (SELECT count(*) FROM ticket_items)  AS ticket_items,
       (SELECT count(*) FROM staff_accounts) AS staff_accounts,
       (SELECT count(*) FROM profiles)      AS profiles,
       (SELECT count(*) FROM auth.users)    AS auth_users;

-- ── 2. Dados transacionais e de eventos (filhos → pais) ─────────────────────
DELETE FROM transfer_logs;        -- FK → ticket_items
DELETE FROM cancellations;        -- FK → reservations
DELETE FROM ticket_items;         -- FK → reservations / events
DELETE FROM sector_access_codes;  -- FK → sectors
DELETE FROM batches;              -- FK → sectors / events
DELETE FROM reservations;         -- FK → events / usuários
DELETE FROM staff_accounts;       -- FK → events
DELETE FROM sectors;              -- FK → events
DELETE FROM events;               -- "pai" dos eventos
DELETE FROM producer_applications;-- FK → usuários
DELETE FROM banking_details;      -- FK → usuários
DELETE FROM audit_logs;           -- logs
DELETE FROM otp_attempts;         -- tentativas de OTP

-- ── 3. Contas: remove TUDO, exceto a conta admin ────────────────────────────
--  Apaga as contas fantasmas (developer, test user MP), staff e clientes —
--  tanto o perfil quanto o login. Ajuste o e-mail abaixo se o admin já tiver
--  sido trocado.
DELETE FROM public.profiles WHERE lower(email) <> 'acesso@admin.com';
DELETE FROM auth.users      WHERE lower(email) <> 'acesso@admin.com';
--  (deletar auth.users cascateia identities/sessions/refresh_tokens do schema auth)

-- ── 4. Reabre o onboarding e zera o branding de teste ───────────────────────
--  Mantém app_secrets e mp_seller_* (conexão MP) intactos — só reseta o que o
--  dono vai preencher no wizard. Se a marca real já estiver configurada de
--  propósito, comente as linhas de branding e deixe só onboarding_completed.
UPDATE public.system_config SET
  onboarding_completed = false,
  site_name       = '',            -- não-nulo: usa string vazia
  site_logo_url   = NULL,
  company_name    = NULL,
  document        = NULL,
  address         = NULL,
  contact_phone   = NULL,
  contact_email   = NULL,
  social_links    = '[]'::jsonb;

-- ── 5. Contagens DEPOIS (tudo 0; profiles = 1 e auth_users = 1 — só o admin) ─
SELECT 'DEPOIS' AS momento,
       (SELECT count(*) FROM events)        AS events,
       (SELECT count(*) FROM reservations)  AS reservations,
       (SELECT count(*) FROM ticket_items)  AS ticket_items,
       (SELECT count(*) FROM staff_accounts) AS staff_accounts,
       (SELECT count(*) FROM profiles)      AS profiles,
       (SELECT count(*) FROM auth.users)    AS auth_users;

-- ============================================================================
--  Mantenha ROLLBACK para apenas REVISAR (nada é apagado).
--  Troque por COMMIT quando tiver certeza de que quer apagar de verdade.
-- ============================================================================
ROLLBACK;
-- COMMIT;
