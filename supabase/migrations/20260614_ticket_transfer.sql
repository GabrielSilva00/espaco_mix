-- ════════════════════════════════════════════════════════════════════════════
-- Transferência de ingressos com aceitação — jun/2026
--
-- Adiciona suporte à transferência real entre contas:
--   • holder_user_id        — quem EXIBE o ingresso hoje (default = dono original).
--                             Permite que o remetente continue vendo o ingresso
--                             como "transferido" e o destinatário o veja na conta.
--   • transferred_from_name — nome do remetente (badge "Transferido de {nome}").
--   • transfer_token        — token de aceite enviado por e-mail ao destinatário.
--   • transfer_expires_at   — validade do convite de transferência.
--
-- Também garante as colunas usadas pela tabela transfer_logs.
-- Aditiva e idempotente — segura para aplicar antes/depois do deploy do código.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.ticket_items
  ADD COLUMN IF NOT EXISTS holder_user_id uuid,
  ADD COLUMN IF NOT EXISTS transferred_from_name text,
  ADD COLUMN IF NOT EXISTS transfer_token text,
  ADD COLUMN IF NOT EXISTS transfer_expires_at timestamptz;

-- Garante as colunas esperadas em transfer_logs (algumas podem já existir).
ALTER TABLE public.transfer_logs
  ADD COLUMN IF NOT EXISTS transfer_token text,
  ADD COLUMN IF NOT EXISTS to_user_id uuid,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ticket_items_holder_user_id ON public.ticket_items (holder_user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_items_transfer_token ON public.ticket_items (transfer_token);
CREATE INDEX IF NOT EXISTS idx_transfer_logs_transfer_token ON public.transfer_logs (transfer_token);

COMMIT;
