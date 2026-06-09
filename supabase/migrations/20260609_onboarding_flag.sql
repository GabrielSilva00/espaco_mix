-- Onboarding inicial do administrador (primeiro acesso)
-- Adiciona a flag que controla se o passo a passo de configuração inicial já foi
-- concluído. Quando false/ausente, o site guia o admin na primeira entrada.

ALTER TABLE public.system_config
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
