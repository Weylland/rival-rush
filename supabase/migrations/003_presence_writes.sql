-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 003 — Autoriser l'écriture de sa propre présence
--
-- La table `presence` reçoit des heartbeats côté client (PresenceProvider +
-- clients de jeu pour le statut "in-game"). Sans ces policies, les écritures
-- échouent silencieusement et personne n'apparaît plus en ligne.
--
-- Restriction : auth.uid() = player_id → on ne peut modifier QUE sa propre ligne.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE POLICY "presence_insert"
  ON public.presence FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "presence_update"
  ON public.presence FOR UPDATE
  USING (auth.uid() = player_id)
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "presence_delete"
  ON public.presence FOR DELETE
  USING (auth.uid() = player_id);
