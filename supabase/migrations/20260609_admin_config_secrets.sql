-- Configuração do site pelo próprio painel (Acesso Master)
--
-- 1) system_config recebe campos NÃO-secretos (seguros para o client ler):
--    public key do MP, ambiente, provedor de e-mail, host/porta/usuário SMTP,
--    webhook de notificações, hora do lembrete e links sociais dinâmicos.
--
-- 2) Os SEGREDOS (access token do MP, API key do e-mail, senha SMTP) ficam numa
--    tabela separada `app_secrets` com RLS que NEGA acesso a anon/authenticated —
--    só o servidor (service role) lê/escreve. Guardados criptografados ("enc:..").
--    Isso evita vazamento via getSystemConfig() (select * lido por anônimos).

ALTER TABLE public.system_config
  ADD COLUMN IF NOT EXISTS mp_public_key      text,
  ADD COLUMN IF NOT EXISTS mp_environment     text    DEFAULT 'production',
  ADD COLUMN IF NOT EXISTS email_provider     text    DEFAULT 'resend',   -- 'resend' | 'smtp'
  ADD COLUMN IF NOT EXISTS smtp_host          text,
  ADD COLUMN IF NOT EXISTS smtp_port          integer,
  ADD COLUMN IF NOT EXISTS smtp_user          text,
  ADD COLUMN IF NOT EXISTS smtp_secure        boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_webhook_url text,
  ADD COLUMN IF NOT EXISTS reminder_cron_hour integer DEFAULT 12,
  ADD COLUMN IF NOT EXISTS social_links       jsonb   DEFAULT '[]'::jsonb;

-- Tabela de segredos (acesso exclusivo do servidor via service role)
CREATE TABLE IF NOT EXISTS public.app_secrets (
  id              text PRIMARY KEY DEFAULT 'main',
  mp_access_token text,   -- "enc:..."
  resend_api_key  text,   -- "enc:..."
  smtp_password   text,   -- "enc:..."
  updated_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_secrets (id) VALUES ('main')
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
-- Sem políticas = ninguém (anon/authenticated) lê ou escreve.
-- O service role IGNORA RLS, então o servidor continua com acesso total.
