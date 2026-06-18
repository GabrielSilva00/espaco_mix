-- ════════════════════════════════════════════════════════════════════════════
-- Contador de tentativas de OTP de recuperação de senha (anti brute-force)
-- ════════════════════════════════════════════════════════════════════════════
-- Contexto: o código de recuperação (/api/auth/reset-password) é um OTP de 6
-- dígitos verificado de forma STATELESS (ticket = HMAC do e-mail+código+exp).
-- Como o servidor não guardava estado, o rate-limit por IP (express-rate-limit)
-- não impedia adivinhar o código (10^6 possibilidades) via rotação de IP.
--
-- Esta tabela registra cada tentativa FALHA por e-mail (guardado como hash, sem
-- PII). O servidor conta as falhas recentes e bloqueia após o limite dentro da
-- janela de validade do código. Acessada SOMENTE pela service role (RLS ligado,
-- sem policies → nega qualquer acesso anônimo/autenticado).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.otp_attempts (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email_hash  text        NOT NULL,
  kind        text        NOT NULL DEFAULT 'password_reset',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Consulta de contagem: por e-mail + tipo + janela de tempo.
CREATE INDEX IF NOT EXISTS otp_attempts_lookup
  ON public.otp_attempts (email_hash, kind, created_at DESC);

-- RLS habilitada e SEM policies: apenas a service role (que ignora RLS) acessa.
ALTER TABLE public.otp_attempts ENABLE ROW LEVEL SECURITY;

COMMIT;
