-- ════════════════════════════════════════════════════════════════════════════
-- Tipo de taxa da plataforma — jun/2026
--
-- Adiciona platform_fee_type ('percentage' | 'fixed') ao system_config e
-- recria a view system_config_public incluindo a nova coluna ao final
-- (CREATE OR REPLACE VIEW só permite adicionar colunas no final).
--
-- Seguro para deploy: apenas ADD COLUMN + CREATE OR REPLACE VIEW (aditivo).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.system_config
  ADD COLUMN IF NOT EXISTS platform_fee_type text DEFAULT 'percentage';

-- Recriar view incluindo a nova coluna ao final (obrigatório no PG)
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
  updated_at,
  platform_fee_type
FROM public.system_config;

GRANT SELECT ON public.system_config_public TO anon, authenticated;

COMMIT;
