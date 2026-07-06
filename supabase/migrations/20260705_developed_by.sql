-- ════════════════════════════════════════════════════════════════════════════
-- Crédito "Desenvolvido por" — jul/2026
--
-- Adiciona developed_by ao system_config (texto configurável no painel do
-- developer) e recria a view system_config_public incluindo a nova coluna ao
-- final para que o rodapé consiga ler o valor publicamente.
--
-- Também garante social_instagram exposto na view (recriação aditiva completa),
-- corrigindo ambientes com a view desatualizada.
--
-- Seguro para deploy: apenas ADD COLUMN + CREATE OR REPLACE VIEW (aditivo).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.system_config
  ADD COLUMN IF NOT EXISTS developed_by text;

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
  platform_fee_type,
  developed_by
FROM public.system_config;

GRANT SELECT ON public.system_config_public TO anon, authenticated;

COMMIT;
