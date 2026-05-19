-- Migração: adiciona campos de dados da organização à tabela system_config
-- Execute este script no painel SQL do Supabase

ALTER TABLE system_config
  ADD COLUMN IF NOT EXISTS person_type   TEXT    DEFAULT 'pf' CHECK (person_type IN ('pf', 'pj')),
  ADD COLUMN IF NOT EXISTS company_name  TEXT,
  ADD COLUMN IF NOT EXISTS trade_name    TEXT,
  ADD COLUMN IF NOT EXISTS address       TEXT,
  ADD COLUMN IF NOT EXISTS document      TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;
