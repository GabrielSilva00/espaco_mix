-- ════════════════════════════════════════════════════════════════════════════
-- Unicidade de CPF entre contas (impressão digital determinística)
-- ════════════════════════════════════════════════════════════════════════════
-- Contexto: o CPF é guardado CRIPTOGRAFADO (encryptData → "enc:<iv>:<dados>")
-- com IV ALEATÓRIO. Logo, o mesmo CPF gera ciphertext diferente a cada gravação
-- e um índice único sobre a coluna `cpf` NÃO detecta duplicatas.
--
-- Solução: coluna `cpf_hash` = HMAC-SHA256(11 dígitos, ENCRYPTION_KEY), calculada
-- no servidor. É determinística (mesmo CPF → mesmo hash) e não reversível, então
-- permite garantir unicidade sem expor nem decifrar o CPF.
--
-- O e-mail já é único no nível do Supabase Auth (auth.users.email), reforçado por
-- checagem antecipada em /api/auth/send-verify-code.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Coluna de impressão digital do CPF ────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf_hash text;

-- ─── 2. Unicidade de CPF entre contas (ignora nulos: estrangeiros/sem CPF) ─────
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_hash_unique
  ON public.profiles (cpf_hash)
  WHERE cpf_hash IS NOT NULL;

COMMIT;
