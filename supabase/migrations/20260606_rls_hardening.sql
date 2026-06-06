-- ════════════════════════════════════════════════════════════════════════════
-- RLS Hardening — fecha brechas que permitiam fraude de ingresso grátis
-- ════════════════════════════════════════════════════════════════════════════
-- Contexto: o app acessa o banco direto do cliente com a anon key, então a
-- segurança depende 100% do RLS. A auditoria encontrou 3 brechas:
--
--   1. reservations UPDATE: o dono podia alterar payment_status -> 'approved'
--      (sem WITH CHECK restringindo colunas). Ingresso grátis.
--   2. reservations INSERT: o dono podia inserir a reserva já 'approved'/total=0.
--   3. ticket_items INSERT: CHECK (true) — qualquer um forjava ingressos.
--
-- Princípio aplicado: o status financeiro de uma reserva só pode ser definido
-- pelo SERVICE ROLE (webhook do Mercado Pago) ou por um admin. O usuário comum
-- cria a reserva sempre como 'pending' e nunca altera campos financeiros.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1 & 2. Proteção de campos financeiros em reservations (via trigger) ──────
-- RLS no Postgres não restringe colunas individualmente; usamos um trigger.

CREATE OR REPLACE FUNCTION public.protect_reservation_financials()
RETURNS TRIGGER AS $$
BEGIN
  -- Service role (webhook/servidor) e admins têm controle total.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.get_my_role() = ANY (ARRAY['admin', 'developer']) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Usuário comum nunca cria uma reserva já paga.
    NEW.payment_status := 'pending';
    NEW.payment_id := NULL;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Usuário comum não pode mexer em nenhum campo financeiro.
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.payment_id    IS DISTINCT FROM OLD.payment_id
       OR NEW.total         IS DISTINCT FROM OLD.total
       OR NEW.platform_fee  IS DISTINCT FROM OLD.platform_fee
       OR NEW.net_amount    IS DISTINCT FROM OLD.net_amount THEN
      RAISE EXCEPTION 'Alteração de campos financeiros não permitida.';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_reservation_financials ON public.reservations;
CREATE TRIGGER trg_protect_reservation_financials
  BEFORE INSERT OR UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.protect_reservation_financials();

-- ─── 3. ticket_items: só cria ingresso vinculado a uma reserva sua ────────────
DROP POLICY IF EXISTS ticket_items_insert_anon ON public.ticket_items;
DROP POLICY IF EXISTS ticket_items_insert_authenticated ON public.ticket_items;

CREATE POLICY ticket_items_insert_own ON public.ticket_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = ticket_items.reservation_id
        AND r.user_id = auth.uid()
    )
  );

-- Admin/developer continuam podendo inserir manualmente.
DROP POLICY IF EXISTS ticket_items_insert_admin ON public.ticket_items;
CREATE POLICY ticket_items_insert_admin ON public.ticket_items
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = ANY (ARRAY['admin', 'developer']));

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- RECOMENDAÇÕES ADICIONAIS (não aplicadas automaticamente — avaliar impacto):
--
-- • system_config: a leitura é pública (USING true) e a tabela contém PII da
--   organização (CNPJ/document, dpo_email, telefones, e-mail sender). Criar uma
--   VIEW pública só com campos seguros (site_name, logo, cores) e restringir a
--   tabela base a admins.
--
-- • events: a política "Leitura pública dos eventos" (USING true) permite ler
--   rascunhos (status='draft'/'Rascunho'). Remover essa policy e manter apenas
--   events_select_public (status <> draft) + creator + admin.
--
-- • Políticas legadas duplicadas: várias tabelas têm dois conjuntos de policies
--   (rótulos em PT roles={public} e em EN roles={authenticated}). As {public}
--   aplicam inclusive a anon. Consolidar para reduzir superfície de erro.
-- ════════════════════════════════════════════════════════════════════════════
