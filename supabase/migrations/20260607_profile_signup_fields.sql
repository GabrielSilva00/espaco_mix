-- ════════════════════════════════════════════════════════════════════════════
-- Cadastro: persistir todos os campos do perfil + corrigir salvamento
-- ════════════════════════════════════════════════════════════════════════════
-- Contexto: o trigger handle_new_user só copiava id/name/email/role do
-- raw_user_meta_data para profiles, então sex/nationality/country/passport_doc/
-- username nunca eram gravados no cadastro. Além disso, birth_date era do tipo
-- `date`, incompatível com o valor CRIPTOGRAFADO ("enc:...") que o servidor
-- grava em /api/profile/sensitive — o que fazia o botão "Salvar" do perfil
-- retornar erro 500.
--
-- Nota sobre nationality x country (NÃO são duplicados):
--   • nationality ∈ {'br','foreign'} — flag que decide CPF vs passaporte.
--   • country — país real, preenchido apenas para estrangeiros.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. birth_date: date -> text (aceita valor criptografado ou 'YYYY-MM-DD') ──
ALTER TABLE public.profiles
  ALTER COLUMN birth_date TYPE text USING birth_date::text;

-- ─── 2. Trigger de novo usuário copia TODOS os campos não-sensíveis ───────────
-- cpf/phone/birth_date NÃO são copiados aqui: são gravados criptografados pelo
-- servidor (/api/profile/sensitive) logo após o cadastro, com sessão ativa.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  meta jsonb := new.raw_user_meta_data;
BEGIN
  INSERT INTO public.profiles (
    id, name, email, role,
    username, sex, nationality, country, passport_doc, phone_country
  )
  VALUES (
    new.id,
    COALESCE(meta->>'name', split_part(new.email, '@', 1)),
    new.email,
    COALESCE(meta->>'role', 'client'),
    NULLIF(meta->>'username', ''),
    NULLIF(meta->>'sex', ''),
    NULLIF(meta->>'nationality', ''),
    NULLIF(meta->>'country', ''),
    NULLIF(meta->>'passport_doc', ''),
    NULLIF(meta->>'phone_country', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;

-- ─── 3. Unicidade de username (case-insensitive, ignora nulos) ────────────────
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

COMMIT;
