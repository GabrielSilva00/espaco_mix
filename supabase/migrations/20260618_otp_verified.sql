-- ════════════════════════════════════════════════════════════════════════════
-- Verificação por código de e-mail para contas criadas via Google
-- ════════════════════════════════════════════════════════════════════════════
-- Contexto: o cadastro por e-mail/senha já passa por um código OTP. O login com
-- Google não passava (o Google verifica o e-mail). O dono quer que, no PRIMEIRO
-- cadastro via Google, o usuário também receba um código e informe no site.
--
-- `otp_verified_at` marca quando o usuário confirmou o código no site. Usuários
-- existentes são "grandfathered" (marcados como verificados) para não serem
-- incomodados. Apenas novos cadastros via Google (otp_verified_at IS NULL +
-- provedor google) verão a etapa de código.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS otp_verified_at timestamptz;

-- Não incomodar quem já tem conta.
UPDATE public.profiles
  SET otp_verified_at = now()
  WHERE otp_verified_at IS NULL;

COMMIT;
