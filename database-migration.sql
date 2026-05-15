-- ====================================================================
-- MIGRAÇÃO COMPLETA — Espaço Mix / Eventix
-- Execute no Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- Ordem: Partes 1 a 7 são independentes e podem ser executadas juntas.
-- ====================================================================


-- ====================================================================
-- PARTE 1: COLUNAS FALTANDO EM system_config
-- Configurações que o AdminSettings já usa mas que não persistiam no BD
-- ====================================================================

ALTER TABLE public.system_config
  -- Transferências de ingressos
  ADD COLUMN IF NOT EXISTS allow_transfer              boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS transfer_max_delay_hours    integer DEFAULT 24,
  ADD COLUMN IF NOT EXISTS allow_multiple_transfers    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS transfer_require_email      boolean DEFAULT true,

  -- Notificações por e-mail
  ADD COLUMN IF NOT EXISTS notify_purchase             boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_transfer             boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_cancel               boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_reminder             boolean DEFAULT true,

  -- Cancelamento e reembolso
  ADD COLUMN IF NOT EXISTS allow_cancellation          boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS cancel_max_delay_hours      integer DEFAULT 48,
  ADD COLUMN IF NOT EXISTS auto_refund                 boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS refund_type                 text    DEFAULT 'total'
      CHECK (refund_type = ANY (ARRAY['total'::text, 'partial'::text])),
  ADD COLUMN IF NOT EXISTS cancel_fee_percent          numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_process_days         integer DEFAULT 7,

  -- Checkout e nomeação de ingressos
  ADD COLUMN IF NOT EXISTS show_fee_to_buyer           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ticket_require_name         boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS ticket_require_email        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS same_owner_for_all          boolean DEFAULT false,

  -- Gateway de pagamento
  ADD COLUMN IF NOT EXISTS gateway_fee_percent         numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_payer                   text    DEFAULT 'buyer'
      CHECK (fee_payer = ANY (ARRAY['buyer'::text, 'seller'::text])),

  -- Relatórios e suporte
  ADD COLUMN IF NOT EXISTS enable_reports              boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_export                boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_sensitive_data         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS support_email               text,
  ADD COLUMN IF NOT EXISTS support_phone               text,
  ADD COLUMN IF NOT EXISTS main_url                    text;


-- ====================================================================
-- PARTE 2: TABELA banking_details
-- Dados financeiros dos produtores (BankingForm já coleta, mas não havia
-- onde persistir — dados eram descartados após o submit)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.banking_details (
  id                    uuid        NOT NULL DEFAULT uuid_generate_v4(),
  user_id               uuid        NOT NULL,

  -- PIX
  pix_key               text,
  pix_key_type          text
      CHECK (pix_key_type = ANY (ARRAY['cpf','cnpj','email','phone','random'])),
  pix_holder_name       text,

  -- Transferência bancária (TED)
  bank_code             text,
  bank_name             text,
  account_type          text        DEFAULT 'corrente'
      CHECK (account_type = ANY (ARRAY['corrente','poupanca'])),
  agency                text,
  account               text,
  account_holder_name   text,
  account_holder_cpf    text,

  -- Preferências de repasse
  preferred_method      text        DEFAULT 'PIX'
      CHECK (preferred_method = ANY (ARRAY['PIX','TED'])),
  payout_schedule       text        DEFAULT 'after_event'
      CHECK (payout_schedule = ANY (ARRAY['after_event','weekly','monthly'])),

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT banking_details_pkey         PRIMARY KEY (id),
  CONSTRAINT banking_details_user_id_fkey FOREIGN KEY (user_id)
      REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT banking_details_user_unique  UNIQUE (user_id)
);

-- RLS
ALTER TABLE public.banking_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "banking_details: produtor vê/edita os próprios"
  ON public.banking_details
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "banking_details: admin lê tudo"
  ON public.banking_details
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'developer')
    )
  );


-- ====================================================================
-- PARTE 3: TABELA transfer_logs
-- Histórico auditável de transferências de ingressos.
-- ticket_items já tem status 'pending_transfer' e 'transferred',
-- mas não havia rastreamento de tentativas, rejeições ou expiração.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.transfer_logs (
  id              uuid        NOT NULL DEFAULT uuid_generate_v4(),
  ticket_id       text        NOT NULL,
  from_user_id    uuid,
  to_email        text        NOT NULL,
  to_user_id      uuid,
  status          text        NOT NULL DEFAULT 'pending'
      CHECK (status = ANY (ARRAY['pending','accepted','rejected','expired','cancelled'])),
  initiated_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  expires_at      timestamptz,

  CONSTRAINT transfer_logs_pkey            PRIMARY KEY (id),
  CONSTRAINT transfer_logs_ticket_fkey     FOREIGN KEY (ticket_id)
      REFERENCES public.ticket_items(id) ON DELETE CASCADE,
  CONSTRAINT transfer_logs_from_user_fkey  FOREIGN KEY (from_user_id)
      REFERENCES public.profiles(id),
  CONSTRAINT transfer_logs_to_user_fkey    FOREIGN KEY (to_user_id)
      REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_transfer_logs_ticket
  ON public.transfer_logs (ticket_id);

CREATE INDEX IF NOT EXISTS idx_transfer_logs_to_email
  ON public.transfer_logs (to_email);

-- RLS
ALTER TABLE public.transfer_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfer_logs: usuário vê transferências suas"
  ON public.transfer_logs
  FOR SELECT
  USING (
    from_user_id = auth.uid()
    OR to_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'developer')
    )
  );

CREATE POLICY "transfer_logs: usuário cria transferência dos seus tickets"
  ON public.transfer_logs
  FOR INSERT
  WITH CHECK (from_user_id = auth.uid());


-- ====================================================================
-- PARTE 4: TABELA cancellations
-- Rastreia pedidos de cancelamento e reembolso por reserva.
-- Sem esta tabela, ao mudar payment_status para 'refunded' perde-se
-- o motivo, quem aprovou e quando o gateway processou.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.cancellations (
  id                 uuid        NOT NULL DEFAULT uuid_generate_v4(),
  reservation_id     uuid        NOT NULL,
  requested_by       uuid,
  reason             text,
  refund_amount      numeric,
  refund_type        text        DEFAULT 'total'
      CHECK (refund_type = ANY (ARRAY['total','partial','none'])),
  status             text        NOT NULL DEFAULT 'pending'
      CHECK (status = ANY (ARRAY['pending','approved','rejected','processed'])),
  processed_by       uuid,
  processed_at       timestamptz,
  gateway_refund_id  text,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cancellations_pkey               PRIMARY KEY (id),
  CONSTRAINT cancellations_reservation_fkey   FOREIGN KEY (reservation_id)
      REFERENCES public.reservations(id),
  CONSTRAINT cancellations_requested_by_fkey  FOREIGN KEY (requested_by)
      REFERENCES public.profiles(id),
  CONSTRAINT cancellations_processed_by_fkey  FOREIGN KEY (processed_by)
      REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_cancellations_reservation
  ON public.cancellations (reservation_id);

CREATE INDEX IF NOT EXISTS idx_cancellations_status
  ON public.cancellations (status);

-- RLS
ALTER TABLE public.cancellations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cancellations: comprador vê os próprios"
  ON public.cancellations
  FOR SELECT
  USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = reservation_id AND r.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'developer')
    )
  );

CREATE POLICY "cancellations: comprador abre cancelamento"
  ON public.cancellations
  FOR INSERT
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "cancellations: admin processa"
  ON public.cancellations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'developer')
    )
  );


-- ====================================================================
-- PARTE 5: TABELA sector_access_codes
-- Setores com visibility='code' já existem no schema, mas não havia
-- onde guardar os códigos gerados nem controlar o uso.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.sector_access_codes (
  id           uuid        NOT NULL DEFAULT uuid_generate_v4(),
  sector_id    text        NOT NULL,
  code         text        NOT NULL,
  label        text,
  max_uses     integer,
  used_count   integer     NOT NULL DEFAULT 0,
  expires_at   timestamptz,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sector_access_codes_pkey        PRIMARY KEY (id),
  CONSTRAINT sector_access_codes_sector_fkey FOREIGN KEY (sector_id)
      REFERENCES public.sectors(id) ON DELETE CASCADE,
  CONSTRAINT sector_access_codes_unique_code UNIQUE (sector_id, code)
);

CREATE INDEX IF NOT EXISTS idx_sector_access_codes_sector
  ON public.sector_access_codes (sector_id);

-- RLS
ALTER TABLE public.sector_access_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sector_access_codes: qualquer usuário valida código"
  ON public.sector_access_codes
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "sector_access_codes: admin gerencia"
  ON public.sector_access_codes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'developer')
    )
  );


-- ====================================================================
-- PARTE 6: TABELA audit_logs
-- Registra ações sensíveis (aprovações, pagamentos, acesso a dados PII,
-- etc.) para conformidade com LGPD e rastreabilidade administrativa.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           uuid        NOT NULL DEFAULT uuid_generate_v4(),
  user_id      uuid,
  action       text        NOT NULL,
  entity_type  text        NOT NULL,
  entity_id    text,
  changes      jsonb,
  ip_address   text,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT audit_logs_pkey          PRIMARY KEY (id),
  CONSTRAINT audit_logs_user_id_fkey  FOREIGN KEY (user_id)
      REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user
  ON public.audit_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON public.audit_logs (created_at DESC);

-- RLS: apenas admins leem; inserção liberada para o sistema
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs: admin lê tudo"
  ON public.audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'developer')
    )
  );

CREATE POLICY "audit_logs: sistema insere"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (true);


-- ====================================================================
-- PARTE 7: FUNCTIONS e TRIGGERS
-- ====================================================================

-- 7.1 Função genérica de atualização de updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 7.2 Trigger em banking_details
CREATE TRIGGER trg_banking_details_updated_at
  BEFORE UPDATE ON public.banking_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 7.3 Trigger em cancellations
CREATE TRIGGER trg_cancellations_updated_at
  BEFORE UPDATE ON public.cancellations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 7.4 Trigger em system_config (já pode existir, mas recria com IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_system_config_updated_at'
  ) THEN
    CREATE TRIGGER trg_system_config_updated_at
      BEFORE UPDATE ON public.system_config
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END;
$$;

-- 7.5 Função: contar ingressos vendidos por setor
-- Usada para checar disponibilidade no checkout sem precisar
-- de uma coluna "sold_count" que exigiria sincronização constante.
CREATE OR REPLACE FUNCTION public.get_sector_sold_count(p_sector_id text)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM public.ticket_items ti
  JOIN public.reservations r ON r.id = ti.reservation_id
  JOIN public.sectors s ON s.event_id = ti.event_id AND s.name = ti.name
  WHERE s.id = p_sector_id
    AND r.payment_status IN ('approved', 'pending')
    AND ti.status NOT IN ('cancelled', 'transferred');
$$;

-- 7.6 Função: expirar transferências pendentes antigas
-- Chame via cron do Supabase (pg_cron) ou pela sua edge function de webhook.
CREATE OR REPLACE FUNCTION public.expire_pending_transfers()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  expired_count integer;
BEGIN
  -- Marca como expirados
  UPDATE public.transfer_logs
  SET status = 'expired', resolved_at = now()
  WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < now();

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  -- Reverte os ticket_items correspondentes
  UPDATE public.ticket_items
  SET status = 'active', pending_transfer_email = NULL
  WHERE status = 'pending_transfer'
    AND id IN (
      SELECT ticket_id FROM public.transfer_logs
      WHERE status = 'expired' AND resolved_at >= now() - interval '5 seconds'
    );

  RETURN expired_count;
END;
$$;

-- 7.7 Função: registrar entrada no audit_log de forma conveniente
CREATE OR REPLACE FUNCTION public.log_audit(
  p_user_id    uuid,
  p_action     text,
  p_entity_type text,
  p_entity_id  text DEFAULT NULL,
  p_changes    jsonb DEFAULT NULL,
  p_ip         text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, changes, ip_address)
  VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_changes, p_ip);
END;
$$;

-- 7.8 Função: validar e consumir código de acesso de setor
CREATE OR REPLACE FUNCTION public.validate_sector_code(
  p_sector_id text,
  p_code      text
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_record public.sector_access_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_record
  FROM public.sector_access_codes
  WHERE sector_id = p_sector_id
    AND code      = upper(trim(p_code))
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR used_count < max_uses);

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Incrementa contador de uso
  UPDATE public.sector_access_codes
  SET used_count = used_count + 1
  WHERE id = v_record.id;

  RETURN true;
END;
$$;


-- ====================================================================
-- VERIFICAÇÃO FINAL
-- Executa após todas as partes para confirmar que tudo foi criado.
-- ====================================================================

SELECT
  'system_config colunas' AS verificacao,
  COUNT(*) AS total_colunas
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'system_config'

UNION ALL

SELECT 'banking_details', COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'banking_details'

UNION ALL

SELECT 'transfer_logs', COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'transfer_logs'

UNION ALL

SELECT 'cancellations', COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'cancellations'

UNION ALL

SELECT 'sector_access_codes', COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'sector_access_codes'

UNION ALL

SELECT 'audit_logs', COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'audit_logs';


-- ====================================================================
-- PARTE 8: COLUNA CAPACITY NA TABELA EVENTS (Item 14)
-- ====================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS capacity integer;

-- ====================================================================
-- PARTE 9: POLÍTICAS DE STORAGE PARA event-images (Item 13)
-- Execute após criar o bucket 'event-images' no Supabase Storage
-- ====================================================================

-- Leitura pública (qualquer um pode ver as imagens)
CREATE POLICY IF NOT EXISTS "Public read event-images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'event-images');

-- Upload por usuários autenticados
CREATE POLICY IF NOT EXISTS "Authenticated upload event-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'event-images');

-- Atualização por usuários autenticados
CREATE POLICY IF NOT EXISTS "Authenticated update event-images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'event-images');

-- Exclusão por usuários autenticados
CREATE POLICY IF NOT EXISTS "Authenticated delete event-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'event-images');

-- Verificação final
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'events'
  AND column_name = 'capacity';
