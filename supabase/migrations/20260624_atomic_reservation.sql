-- ============================================================
-- Migração: Reserva Atômica (anti double-selling)
-- v2: compatível com coluna tables como JSONB
-- ============================================================

-- 1. Índice parcial para reservas ativas por evento
CREATE INDEX IF NOT EXISTS idx_reservations_active_event
  ON reservations (event_id)
  WHERE payment_status IN ('approved', 'pending');

-- 2. Adicionar sector_id se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reservations' AND column_name = 'sector_id'
  ) THEN
    ALTER TABLE reservations ADD COLUMN sector_id UUID;
  END IF;
END $$;

-- 3. Drop da versão anterior se existir
DROP FUNCTION IF EXISTS reserve_tickets;

-- 4. Função atômica de reserva (JSONB-compatible)
CREATE OR REPLACE FUNCTION reserve_tickets(
  p_event_id       BIGINT,
  p_user_id        UUID       DEFAULT NULL,
  p_buyer_name     TEXT       DEFAULT '',
  p_buyer_email    TEXT       DEFAULT '',
  p_buyer_cpf      TEXT       DEFAULT '',
  p_buyer_phone    TEXT       DEFAULT NULL,
  p_tables         JSONB      DEFAULT '[]',
  p_single_tickets INTEGER    DEFAULT 0,
  p_male_tickets   INTEGER    DEFAULT 0,
  p_female_tickets INTEGER    DEFAULT 0,
  p_ticket_lines   JSONB      DEFAULT NULL,
  p_sector_id      UUID       DEFAULT NULL,
  p_payment_method TEXT       DEFAULT NULL,
  p_total          NUMERIC    DEFAULT 0,
  p_platform_fee   NUMERIC    DEFAULT 0,
  p_net_amount     NUMERIC    DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation_id  UUID;
  v_cart_expiry_min INTEGER;
  v_conflict_count  INTEGER;
  v_line            JSONB;
  v_sector          RECORD;
  v_sold_count      BIGINT;
  v_requested       INTEGER;
  v_tables_arr      JSONB;
BEGIN

  -- Normaliza tables
  v_tables_arr := COALESCE(p_tables, '[]'::jsonb);

  -- ═══════════════════════════════════════════════════════════════
  -- 0. LIMPAR CARRINHOS EXPIRADOS
  -- ═══════════════════════════════════════════════════════════════
  SELECT COALESCE(cart_expiration_minutes, 15)
    INTO v_cart_expiry_min
    FROM system_config
   WHERE id = 'main';

  UPDATE reservations
     SET payment_status = 'cancelled'
   WHERE event_id = p_event_id
     AND payment_status = 'pending'
     AND payment_id IS NULL
     AND created_at < NOW() - (v_cart_expiry_min || ' minutes')::INTERVAL;

  -- ═══════════════════════════════════════════════════════════════
  -- 1. VALIDAÇÃO DE MESAS
  -- ═══════════════════════════════════════════════════════════════
  IF jsonb_array_length(v_tables_arr) > 0 THEN

    -- Advisory lock serializa reservas de mesas por evento
    PERFORM pg_advisory_xact_lock(p_event_id);

    -- Verifica conflitos: mesas já ocupadas por reservas ativas
    -- Usa JSONB overlap: checa se algum elemento de v_tables_arr
    -- existe no array tables da reserva existente
    SELECT COUNT(*) INTO v_conflict_count
      FROM reservations r
     WHERE r.event_id = p_event_id
       AND r.payment_status IN ('approved', 'pending')
       AND r.tables IS NOT NULL
       AND jsonb_typeof(r.tables) = 'array'
       AND jsonb_array_length(r.tables) > 0
       AND EXISTS (
         SELECT 1
           FROM jsonb_array_elements_text(r.tables) AS existing_table
           JOIN jsonb_array_elements_text(v_tables_arr) AS requested_table
             ON existing_table.value = requested_table.value
       );

    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'MESA_OCUPADA:Uma ou mais mesas já estão reservadas. Atualize o mapa.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 2. VALIDAÇÃO DE INGRESSOS (SELECT FOR UPDATE)
  -- ═══════════════════════════════════════════════════════════════

  -- 2a. Multi-setor (ticket_lines)
  IF p_ticket_lines IS NOT NULL
     AND jsonb_typeof(p_ticket_lines) = 'array'
     AND jsonb_array_length(p_ticket_lines) > 0 THEN

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_ticket_lines) LOOP

      SELECT id, name, quantity, event_id INTO v_sector
        FROM sectors
       WHERE id = (v_line->>'sectorId')::UUID
         AND event_id = p_event_id
       FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'SETOR_INVALIDO:Setor não encontrado.'
          USING ERRCODE = 'P0001';
      END IF;

      IF v_sector.quantity IS NOT NULL AND v_sector.quantity > 0 THEN
        SELECT COALESCE(SUM(
          COALESCE((tl->>'single')::INT, 0) +
          COALESCE((tl->>'male')::INT, 0) +
          COALESCE((tl->>'female')::INT, 0)
        ), 0) INTO v_sold_count
        FROM reservations r,
             jsonb_array_elements(r.ticket_lines) AS tl
        WHERE r.event_id = p_event_id
          AND r.payment_status IN ('approved', 'pending')
          AND (tl->>'sectorId') = (v_line->>'sectorId');

        v_requested := COALESCE((v_line->>'single')::INT, 0)
                     + COALESCE((v_line->>'male')::INT, 0)
                     + COALESCE((v_line->>'female')::INT, 0);

        IF v_sold_count + v_requested > v_sector.quantity THEN
          RAISE EXCEPTION 'ESGOTADO:Ingressos esgotados para "%". Restam %.',
            v_sector.name,
            GREATEST(v_sector.quantity - v_sold_count, 0)
            USING ERRCODE = 'P0001';
        END IF;
      END IF;

    END LOOP;
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 3. INSERÇÃO ATÔMICA
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO reservations (
    event_id, user_id, buyer_name, buyer_email, buyer_cpf, buyer_phone,
    tables, single_tickets, male_tickets, female_tickets,
    ticket_lines, sector_id,
    total, platform_fee, net_amount,
    payment_status, payment_method
  ) VALUES (
    p_event_id, p_user_id, p_buyer_name, p_buyer_email, p_buyer_cpf, p_buyer_phone,
    v_tables_arr, p_single_tickets, p_male_tickets, p_female_tickets,
    p_ticket_lines, p_sector_id,
    p_total, p_platform_fee, p_net_amount,
    'pending', p_payment_method
  )
  RETURNING id INTO v_reservation_id;

  RETURN jsonb_build_object('reservation_id', v_reservation_id, 'status', 'ok');

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- 5. Permissões
REVOKE ALL ON FUNCTION reserve_tickets FROM PUBLIC;
REVOKE ALL ON FUNCTION reserve_tickets FROM anon;
REVOKE ALL ON FUNCTION reserve_tickets FROM authenticated;
GRANT EXECUTE ON FUNCTION reserve_tickets TO service_role;
