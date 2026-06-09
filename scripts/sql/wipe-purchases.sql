-- ============================================================================
--  wipe-purchases.sql  —  APAGA TODOS OS REGISTROS DE COMPRAS do Eventix
-- ============================================================================
--
--  ⚠️  ATENÇÃO — OPERAÇÃO IRREVERSÍVEL  ⚠️
--  Este script REMOVE PERMANENTEMENTE todas as compras (reservas, ingressos,
--  transferências e cancelamentos). NÃO HÁ COMO DESFAZER depois do COMMIT.
--  Faça um BACKUP do banco antes de rodar em produção.
--
--  COMO USAR COM SEGURANÇA:
--    1. Rode o script como está (ele termina em ROLLBACK e NÃO apaga nada).
--    2. Revise as contagens exibidas (antes/depois) e confirme que está correto.
--    3. Só então troque a última linha `ROLLBACK;` por `COMMIT;` e rode de novo.
--
--  TABELAS QUE SERÃO ESVAZIADAS (dados de compra):
--    • transfer_logs   — histórico de transferências de ingressos
--    • cancellations   — pedidos/registros de cancelamento e reembolso
--    • ticket_items    — ingressos individuais (inclui check-ins)
--    • reservations    — reservas/pedidos (comprador, valores, pagamento)
--
--  TABELAS PRESERVADAS (NÃO são tocadas):
--    • events, sectors, batches      — configuração dos eventos
--    • profiles                      — contas de usuários
--    • staff_accounts                — equipe de portaria
--    • system_config                 — configurações do site
--    • sector_access_codes           — códigos de acesso a setores (config)
--      (opcionalmente é possível zerar o used_count — ver bloco comentado abaixo)
--
--  A ORDEM DE EXCLUSÃO respeita as chaves estrangeiras (FK):
--    transfer_logs (FK ticket_id → ticket_items)
--    cancellations (FK reservation_id → reservations)
--    ticket_items  (FK reservation_id → reservations)
--    reservations  (apagada por último)
-- ============================================================================

BEGIN;

-- ── 1. Contagens ANTES ──────────────────────────────────────────────────────
SELECT 'ANTES' AS momento,
       (SELECT count(*) FROM transfer_logs) AS transfer_logs,
       (SELECT count(*) FROM cancellations) AS cancellations,
       (SELECT count(*) FROM ticket_items)  AS ticket_items,
       (SELECT count(*) FROM reservations)  AS reservations;

-- ── 2. Exclusão na ordem correta de dependência (filhos → pais) ──────────────
DELETE FROM transfer_logs;   -- depende de ticket_items
DELETE FROM cancellations;   -- depende de reservations
DELETE FROM ticket_items;    -- depende de reservations
DELETE FROM reservations;    -- tabela "pai" das compras

-- ── 2b. (OPCIONAL) Zerar o uso dos códigos de acesso a setores ───────────────
--  Descomente se quiser que os códigos de setor voltem a contar do zero.
--  Isso NÃO apaga os códigos, apenas reseta quantas vezes foram usados.
-- UPDATE sector_access_codes SET used_count = 0;

-- ── 3. Contagens DEPOIS (devem ficar todas em 0) ────────────────────────────
SELECT 'DEPOIS' AS momento,
       (SELECT count(*) FROM transfer_logs) AS transfer_logs,
       (SELECT count(*) FROM cancellations) AS cancellations,
       (SELECT count(*) FROM ticket_items)  AS ticket_items,
       (SELECT count(*) FROM reservations)  AS reservations;

-- ============================================================================
--  Mantenha ROLLBACK para apenas REVISAR (nada é apagado).
--  Troque por COMMIT quando tiver certeza de que quer apagar de verdade.
-- ============================================================================
ROLLBACK;
-- COMMIT;
