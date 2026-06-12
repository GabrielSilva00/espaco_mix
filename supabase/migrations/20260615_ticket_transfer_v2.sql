BEGIN;

-- Adiciona colunas de rastreamento de transferência no registro original (remetente)
ALTER TABLE public.ticket_items
  ADD COLUMN IF NOT EXISTS transferred_to_name text,
  ADD COLUMN IF NOT EXISTS transferred_to_email text,
  ADD COLUMN IF NOT EXISTS transferred_at timestamptz;

COMMIT;
