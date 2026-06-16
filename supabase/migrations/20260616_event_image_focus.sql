BEGIN;

-- Ponto focal (object-position) da imagem do evento, por contexto de exibição.
-- Permite ao admin ajustar o enquadramento da home (cards/carrossel) e da página
-- de compra (banner largo) sem duplicar a imagem. Formato CSS: "<x>% <y>%".
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS img_focus_home text DEFAULT '50% 50%',
  ADD COLUMN IF NOT EXISTS img_focus_booking text DEFAULT '50% 50%';

COMMIT;
