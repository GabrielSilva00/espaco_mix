-- ════════════════════════════════════════════════════════════════════════════
-- Pagamento/E-mail/View pública — jun/2026 (parte ADITIVA, segura pré-deploy)
--
-- 1. reservations.confirmation_email_sent_at: claim atômico de idempotência do
--    e-mail de confirmação (o webhook do MP pode chegar duplicado; só o primeiro
--    update que preencher o campo dispara o envio) + trilha de auditoria.
--
-- 2. VIEW system_config_public: o site público passa a ler esta view, que
--    expõe apenas os campos necessários às telas públicas (identidade visual,
--    taxas exibidas no checkout, regras de compra/transferência/cancelamento,
--    dados de contato/legais do rodapé e da política de privacidade, e a chave
--    PÚBLICA do Mercado Pago usada na tokenização do cartão).
--
-- A remoção da leitura pública da TABELA system_config fica em
-- 20260612_system_config_lockdown.sql — aplicar SOMENTE após o deploy do
-- código que lê a view (senão o site em produção perde acesso à config).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Claim de idempotência do e-mail de confirmação ───────────────────────
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamptz;

-- ─── 2. View pública com apenas os campos seguros ────────────────────────────
-- A view roda com os privilégios do dono (postgres), contornando o RLS da
-- tabela base — é o mecanismo intencional de exposição dos campos públicos.
CREATE OR REPLACE VIEW public.system_config_public AS
SELECT
  id,
  site_name,
  site_logo_url,
  primary_color,
  venue_max_capacity,
  platform_fee_percent,
  gateway_fee_percent,
  fee_payer,
  show_fee_to_buyer,
  max_tickets_per_purchase,
  cart_expiration_minutes,
  require_cpf,
  limit_per_cpf,
  block_simultaneous,
  verify_email,
  late_participant_info,
  ticket_require_name,
  ticket_require_email,
  same_owner_for_all,
  allow_transfer,
  transfer_max_delay_hours,
  allow_multiple_transfers,
  transfer_require_email,
  allow_cancellation,
  cancel_max_delay_hours,
  auto_refund,
  refund_type,
  cancel_fee_percent,
  refund_process_days,
  mp_public_key,
  mp_environment,
  support_email,
  support_phone,
  main_url,
  person_type,
  company_name,
  trade_name,
  address,
  document,
  contact_email,
  contact_phone,
  dpo_name,
  dpo_email,
  legal_city,
  social_instagram,
  social_links,
  updated_at
FROM public.system_config;

GRANT SELECT ON public.system_config_public TO anon, authenticated;

COMMIT;
