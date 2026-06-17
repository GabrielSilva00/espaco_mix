-- Carrinho multi-setor: detalhamento das quantidades de ingresso por setor.
-- Mantém single_tickets/male_tickets/female_tickets como agregados (compatibilidade)
-- e guarda a quebra por setor em ticket_lines para preço/relatórios.
BEGIN;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS ticket_lines jsonb;

COMMENT ON COLUMN public.reservations.ticket_lines IS
  'Detalhamento por setor: [{ sectorId, name, single, male, female }]. Carrinho multi-setor.';

COMMIT;
