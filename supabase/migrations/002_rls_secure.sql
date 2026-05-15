-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 002 — RLS sécurisées (Option B : JWT custom compatible Supabase)
--
-- Principe :
--   • Le client serveur (service_role) bypasse toutes les policies → sécurité
--     garantie par getSession() dans les server actions Next.js.
--   • Le client browser passe un JWT signé avec SUPABASE_JWT_SECRET →
--     auth.uid() retourne l'UUID du joueur connecté.
--   • RLS restrict what the browser can directly read/write via PostgREST.
--
-- À coller dans l'éditeur SQL de ton projet Supabase.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. Supprimer toutes les anciennes policies ────────────────────────────────

DO $$ DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;


-- ── 2. players — cacher le mot de passe via les privilèges colonne ────────────

-- Retirer l'accès SELECT complet aux rôles client
REVOKE SELECT ON public.players FROM anon, authenticated;

-- Accorder uniquement les colonnes publiques
-- (password reste visible uniquement par service_role)
GRANT SELECT (id, pseudo, avatar_url, created_at) ON public.players TO anon, authenticated;

-- RLS : tout le monde peut voir la liste des joueurs (mais seulement les colonnes accordées)
CREATE POLICY "players_select"
  ON public.players FOR SELECT
  USING (true);

-- INSERT : le browser peut créer un compte (l'inscription n'a pas encore de session)
-- La validation métier (unicité du pseudo, hash du password) est dans la server action
CREATE POLICY "players_insert"
  ON public.players FOR INSERT
  WITH CHECK (true);

-- UPDATE/DELETE : service_role uniquement (toutes les modifs passent par server actions)


-- ── 3. challenges ─────────────────────────────────────────────────────────────

-- SELECT : uniquement les défis où tu es impliqué
CREATE POLICY "challenges_select"
  ON public.challenges FOR SELECT
  USING (
    auth.uid() = challenger_id
    OR auth.uid() = challenged_id
  );

-- INSERT/UPDATE/DELETE : service_role uniquement


-- ── 4. games ──────────────────────────────────────────────────────────────────

-- SELECT : uniquement les parties où tu es joueur (via le challenge associé)
CREATE POLICY "games_select"
  ON public.games FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = games.challenge_id
        AND (c.challenger_id = auth.uid() OR c.challenged_id = auth.uid())
    )
  );

-- INSERT/UPDATE/DELETE : service_role uniquement


-- ── 5. leaderboard ────────────────────────────────────────────────────────────

-- SELECT : public (classement)
CREATE POLICY "leaderboard_select"
  ON public.leaderboard FOR SELECT
  USING (true);

-- INSERT/UPDATE/DELETE : service_role uniquement


-- ── 6. presence ───────────────────────────────────────────────────────────────

-- SELECT : public (voir qui est en ligne)
CREATE POLICY "presence_select"
  ON public.presence FOR SELECT
  USING (true);

-- INSERT/UPDATE/DELETE : service_role uniquement (géré via API routes)


-- ── 7. contacts ───────────────────────────────────────────────────────────────

-- INSERT : n'importe qui peut soumettre le formulaire de contact
CREATE POLICY "contacts_insert"
  ON public.contacts FOR INSERT
  WITH CHECK (true);

-- SELECT/UPDATE/DELETE : service_role uniquement (admin)


-- ── 8. messages (chat in-game) ────────────────────────────────────────────────

-- SELECT : uniquement les joueurs de la partie
CREATE POLICY "messages_select"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.challenges c
      JOIN public.games g ON g.challenge_id = c.id
      WHERE g.id = messages.game_id
        AND (c.challenger_id = auth.uid() OR c.challenged_id = auth.uid())
    )
  );

-- INSERT/DELETE : service_role uniquement


-- ── 9. blocks ─────────────────────────────────────────────────────────────────

-- SELECT : tes propres blocs + savoir si tu es bloqué
CREATE POLICY "blocks_select"
  ON public.blocks FOR SELECT
  USING (blocker_id = auth.uid() OR blocked_id = auth.uid());

-- INSERT/DELETE : service_role uniquement


-- ── 10. reports ───────────────────────────────────────────────────────────────

-- INSERT : tout utilisateur authentifié peut signaler
CREATE POLICY "reports_insert"
  ON public.reports FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = reporter_id
  );

-- SELECT/UPDATE/DELETE : service_role uniquement (admin)


-- ── 11. lobby_chat ────────────────────────────────────────────────────────────

-- SELECT : tout utilisateur authentifié
CREATE POLICY "lobby_chat_select"
  ON public.lobby_chat FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT/DELETE : service_role uniquement


-- ── 12. conversations ─────────────────────────────────────────────────────────

-- SELECT : uniquement les participants
CREATE POLICY "conversations_select"
  ON public.conversations FOR SELECT
  USING (auth.uid() = p1_id OR auth.uid() = p2_id);

-- INSERT/DELETE : service_role uniquement


-- ── 13. direct_messages ───────────────────────────────────────────────────────

-- SELECT : uniquement les participants de la conversation
CREATE POLICY "direct_messages_select"
  ON public.direct_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = direct_messages.conversation_id
        AND (c.p1_id = auth.uid() OR c.p2_id = auth.uid())
    )
  );

-- INSERT/DELETE : service_role uniquement


-- ── 14. conversation_reads ────────────────────────────────────────────────────

-- SELECT : uniquement tes propres lectures
CREATE POLICY "conv_reads_select"
  ON public.conversation_reads FOR SELECT
  USING (player_id = auth.uid());

-- INSERT/UPDATE : service_role uniquement


-- ── 15. rooms ─────────────────────────────────────────────────────────────────

-- Cacher password_hash des rooms via les privilèges colonne
REVOKE SELECT ON public.rooms FROM anon, authenticated;
GRANT SELECT (id, name, code, host_id, is_public, max_members, allowed_games, expires_at, is_open, created_at)
  ON public.rooms TO anon, authenticated;

-- SELECT : salles publiques visibles par tous ; salles privées par les membres
CREATE POLICY "rooms_select"
  ON public.rooms FOR SELECT
  USING (
    is_public = true
    OR host_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = rooms.id AND rm.player_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE : service_role uniquement


-- ── 16. room_members ──────────────────────────────────────────────────────────

-- SELECT : public (voir les membres d'une salle)
CREATE POLICY "room_members_select"
  ON public.room_members FOR SELECT
  USING (true);

-- INSERT/DELETE : service_role uniquement


-- ── 17. room_invitations ──────────────────────────────────────────────────────

-- SELECT : inviteur ou invité
CREATE POLICY "room_invitations_select"
  ON public.room_invitations FOR SELECT
  USING (invited_by_id = auth.uid() OR invited_player_id = auth.uid());

-- INSERT/UPDATE/DELETE : service_role uniquement


-- ── 18. room_chat ─────────────────────────────────────────────────────────────

-- SELECT : membres de la salle uniquement
CREATE POLICY "room_chat_select"
  ON public.room_chat FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = room_chat.room_id
        AND rm.player_id = auth.uid()
    )
  );

-- INSERT/DELETE : service_role uniquement


-- ── 19. game_settings ────────────────────────────────────────────────────────

-- SELECT : public (les jeux disponibles)
CREATE POLICY "game_settings_select"
  ON public.game_settings FOR SELECT
  USING (true);

-- INSERT/UPDATE/DELETE : service_role uniquement


-- ── 20. player_notifications ─────────────────────────────────────────────────

-- SELECT : uniquement tes propres notifications
CREATE POLICY "player_notifications_select"
  ON public.player_notifications FOR SELECT
  USING (player_id = auth.uid());

-- INSERT/UPDATE/DELETE : service_role uniquement


-- ── 21. game_secrets — RLS activé, aucune policy client ──────────────────────

ALTER TABLE IF EXISTS public.game_secrets ENABLE ROW LEVEL SECURITY;
-- Aucune policy → inaccessible via client (service_role bypasse RLS)


-- ── 22. push_subscriptions — RLS activé, aucune policy client ────────────────

ALTER TABLE IF EXISTS public.push_subscriptions ENABLE ROW LEVEL SECURITY;


-- ── 23. contact_logs — RLS activé, aucune policy client ──────────────────────

ALTER TABLE IF EXISTS public.contact_logs ENABLE ROW LEVEL SECURITY;


-- ── Vérification ─────────────────────────────────────────────────────────────
-- Exécute cette requête après pour confirmer :
-- SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, cmd;
