-- ════════════════════════════════════════════════════════════════════════════
-- Taxas de gateway fixas + toggle "mostrar taxas separadas" por evento — jul/2026
--
-- 1) events.show_fee_to_buyer: o dono do evento decide, por evento, se a taxa de
--    conveniência aparece separada ("+ Taxa") no checkout. (Antes era global em
--    system_config; agora é por evento.)
-- 2) system_config: tarifas FIXAS do gateway por método (apenas estimativa de
--    relatório — o Mercado Pago cobra a tarifa real dele) + modo de recebimento
--    ('instant' = na hora, 'd30' = em 30 dias) que o dono pode alternar.
--
-- Seguro para deploy: apenas ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE VIEW
-- (aditivo). A view recria a lista atual de colunas + as 4 novas de gateway ao
-- final (o CREATE OR REPLACE VIEW do PG só permite anexar colunas no fim).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1) Toggle por evento
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS show_fee_to_buyer boolean DEFAULT false;

-- 2) Tarifas fixas de gateway (relatório) + modo de recebimento
ALTER TABLE public.system_config
  ADD COLUMN IF NOT EXISTS gateway_fee_credit_instant numeric DEFAULT 4.99,
  ADD COLUMN IF NOT EXISTS gateway_fee_credit_30d     numeric DEFAULT 3.99,
  ADD COLUMN IF NOT EXISTS gateway_fee_pix            numeric DEFAULT 0.99,
  ADD COLUMN IF NOT EXISTS gateway_settlement_mode    text    DEFAULT 'instant';

-- Recriar a view pública incluindo as 4 novas colunas de gateway ao final.
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
  developed_by,
  gateway_fee_credit_instant,
  gateway_fee_credit_30d,
  gateway_fee_pix,
  gateway_settlement_mode
FROM public.system_config;

GRANT SELECT ON public.system_config_public TO anon, authenticated;

COMMIT;
