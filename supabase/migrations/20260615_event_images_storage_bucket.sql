BEGIN;

-- Bucket público para imagens de evento e branding (logo/avatar).
-- uploadEventImage() e uploadAsset() em src/lib/supabase.ts usam este bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de Storage (storage.objects não aceita IF NOT EXISTS em CREATE POLICY;
-- por isso fazemos DROP idempotente antes de cada CREATE).

-- Leitura pública (o bucket é público; a policy garante o SELECT via API).
DROP POLICY IF EXISTS "event_images_public_read" ON storage.objects;
CREATE POLICY "event_images_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'event-images');

-- Upload por usuário autenticado (admin faz upload com a sessão Supabase).
DROP POLICY IF EXISTS "event_images_auth_insert" ON storage.objects;
CREATE POLICY "event_images_auth_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'event-images');

-- Atualização por usuário autenticado (upsert: true usa UPDATE quando o path já existe).
DROP POLICY IF EXISTS "event_images_auth_update" ON storage.objects;
CREATE POLICY "event_images_auth_update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'event-images')
  WITH CHECK (bucket_id = 'event-images');

-- Remoção por usuário autenticado (limpeza de imagens substituídas).
DROP POLICY IF EXISTS "event_images_auth_delete" ON storage.objects;
CREATE POLICY "event_images_auth_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'event-images');

COMMIT;
