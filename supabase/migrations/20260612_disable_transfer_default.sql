-- Desabilita o módulo de transferência de ingressos nesta versão.
-- O botão "Transferir" (ingresso e mesa) só volta a aparecer para os clientes
-- quando o Developer reativar o toggle "Transferência de Ingressos" no painel,
-- que grava em system_config.allow_transfer.
-- Idempotente: apenas atualiza o valor da linha de configuração principal.

BEGIN;

UPDATE public.system_config
SET allow_transfer = false,
    updated_at = now()
WHERE id = 'main';

COMMIT;
