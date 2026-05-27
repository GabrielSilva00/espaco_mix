-- ============================================================
-- CORREÇÃO DAS POLÍTICAS RLS — Espaço Mix
-- Execute este arquivo no Supabase Dashboard → SQL Editor
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. CORRIGIR RECURSÃO INFINITA NA TABELA "profiles"
--    O problema: uma política está consultando a própria tabela
--    profiles para verificar o role, causando recursão infinita.
-- ────────────────────────────────────────────────────────────

-- Remove TODAS as políticas atuais da tabela profiles
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- Cria função auxiliar que retorna o role SEM precisar de RLS
-- (SECURITY DEFINER = executa com permissão do criador, ignorando RLS)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Recria políticas corretas para profiles
-- Usuários veem e editam apenas o próprio perfil
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admin e developer podem ver todos os perfis (usa a função auxiliar)
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() IN ('admin', 'developer'));

-- Admin e developer podem atualizar qualquer perfil
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'developer'));

-- Trigger de criação de perfil pode inserir novos registros
CREATE POLICY "profiles_insert_self"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ────────────────────────────────────────────────────────────
-- 2. CORRIGIR CARREGAMENTO DE EVENTOS (tabela "events")
--    O problema: RLS habilitado sem política de leitura pública,
--    então usuários não logados não veem nenhum evento.
-- ────────────────────────────────────────────────────────────

-- Remove políticas atuais de events
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'events' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.events', pol.policyname);
  END LOOP;
END $$;

-- Qualquer pessoa pode ver eventos públicos (não rascunhos)
CREATE POLICY "events_select_public"
  ON public.events FOR SELECT
  USING (status != 'draft' OR status IS NULL);

-- Admin e developer veem todos os eventos (incluindo rascunhos)
CREATE POLICY "events_select_admin"
  ON public.events FOR SELECT
  USING (public.get_my_role() IN ('admin', 'developer'));

-- Criadores de eventos veem os próprios eventos
CREATE POLICY "events_select_creator"
  ON public.events FOR SELECT
  USING (auth.uid() = created_by);

-- Apenas admin, developer e criadores aprovados podem criar eventos
CREATE POLICY "events_insert"
  ON public.events FOR INSERT
  WITH CHECK (
    public.get_my_role() IN ('admin', 'developer')
    OR (
      auth.uid() IS NOT NULL
      AND (SELECT is_approved_event_creator FROM public.profiles WHERE id = auth.uid()) = true
    )
  );

-- Apenas admin, developer e o criador podem editar
CREATE POLICY "events_update"
  ON public.events FOR UPDATE
  USING (
    public.get_my_role() IN ('admin', 'developer')
    OR auth.uid() = created_by
  );

-- Apenas admin e developer podem deletar
CREATE POLICY "events_delete"
  ON public.events FOR DELETE
  USING (public.get_my_role() IN ('admin', 'developer'));

-- ────────────────────────────────────────────────────────────
-- 3. GARANTIR RLS HABILITADO NAS TABELAS PRINCIPAIS
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- 4. POLÍTICAS PARA BATCHES E SECTORS (lotes e setores)
--    Precisam de leitura pública para a página de compra funcionar
-- ────────────────────────────────────────────────────────────

-- Remove políticas atuais
DO $$
DECLARE
  pol RECORD;
  tbl TEXT;
BEGIN
  FOR tbl IN VALUES ('batches'), ('sectors') LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE tablename = tbl AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

-- Batches: leitura pública, escrita apenas admin/creator
CREATE POLICY "batches_select_public" ON public.batches FOR SELECT USING (true);
CREATE POLICY "batches_write_admin" ON public.batches FOR ALL
  USING (public.get_my_role() IN ('admin', 'developer'));

-- Sectors: leitura pública, escrita apenas admin/creator
CREATE POLICY "sectors_select_public" ON public.sectors FOR SELECT USING (true);
CREATE POLICY "sectors_write_admin" ON public.sectors FOR ALL
  USING (public.get_my_role() IN ('admin', 'developer'));

ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- FIM DO SCRIPT
-- ────────────────────────────────────────────────────────────
-- Após executar, teste:
--   1. Abra a página sem estar logado → eventos devem aparecer
--   2. Tente fazer login → não deve mais dar erro de recursão
-- ────────────────────────────────────────────────────────────
