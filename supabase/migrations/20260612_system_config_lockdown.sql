-- ════════════════════════════════════════════════════════════════════════════
-- Lockdown da system_config — jun/2026
--
-- ⚠️ APLICAR SOMENTE APÓS o deploy do código que lê system_config_public
--    (criada em 20260611_payment_email_rls.sql). O frontend antigo lê a tabela
--    diretamente como anon; rodar isto antes do deploy derruba o site público.
--
-- A leitura era pública (USING true) e a tabela contém dados de operação
-- (smtp_user, templates de e-mail, hora do cron, provedor de pagamento).
-- Permanecem: "Config — leitura admin" (is_admin), "Config — escrita admin" e
-- "system_config_update_admin". Service role ignora RLS.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY IF EXISTS "Leitura pública da config" ON public.system_config;
DROP POLICY IF EXISTS "Config do site é pública" ON public.system_config;
DROP POLICY IF EXISTS system_config_select_all ON public.system_config;

COMMIT;
