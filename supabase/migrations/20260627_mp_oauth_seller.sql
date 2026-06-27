-- Split de Pagamentos (Marketplace Mercado Pago)
--
-- O desenvolvedor é o MARKETPLACE (recebe a comissão via marketplace_fee) e o
-- dono do site é o VENDEDOR (seller), que conecta a conta MP dele via OAuth.
-- As orders passam a ser criadas com o access_token DO VENDEDOR (obtido por
-- OAuth) — só assim o Mercado Pago aceita o marketplace_fee.
--
-- 1) Os TOKENS OAuth do vendedor (access + refresh) ficam criptografados em
--    app_secrets ("enc:..."), acessíveis apenas pelo servidor (service role).
-- 2) Os METADADOS não-secretos (id/nickname da conta, datas) ficam em
--    system_config — mas NÃO são adicionados à view pública system_config_public;
--    o status de conexão é lido por rota admin server-side.

BEGIN;

-- Tokens OAuth do vendedor (criptografados)
ALTER TABLE public.app_secrets
  ADD COLUMN IF NOT EXISTS mp_seller_access_token  text,   -- "enc:..."
  ADD COLUMN IF NOT EXISTS mp_seller_refresh_token text;   -- "enc:..."

-- Metadados da conexão do vendedor (não-secretos)
ALTER TABLE public.system_config
  ADD COLUMN IF NOT EXISTS mp_seller_user_id          text,
  ADD COLUMN IF NOT EXISTS mp_seller_nickname         text,
  ADD COLUMN IF NOT EXISTS mp_seller_connected_at     timestamptz,
  ADD COLUMN IF NOT EXISTS mp_seller_token_expires_at timestamptz;

COMMIT;
