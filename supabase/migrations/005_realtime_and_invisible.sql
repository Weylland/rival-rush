-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 005 — Realtime publication + colonne is_invisible
--
-- Ce qu'elle fait :
--   1. Ajoute la colonne is_invisible sur players
--   2. Ajoute toutes les tables nécessaires à la publication supabase_realtime
--   3. Active REPLICA IDENTITY FULL sur les tables filtrées par realtime
--      (requis pour que les filtres postgres_changes fonctionnent)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Colonne is_invisible ───────────────────────────────────────────────────

alter table public.players
  add column if not exists is_invisible boolean not null default false;

-- ── 2. REPLICA IDENTITY FULL ─────────────────────────────────────────────────
-- Requis pour les subscriptions avec filtre (filter: challenged_id=eq.xxx etc.)
-- Sans ça, Supabase Realtime ne peut pas évaluer le filtre sur les événements.

alter table public.challenges        replica identity full;
alter table public.presence          replica identity full;
alter table public.room_members      replica identity full;
alter table public.room_invitations  replica identity full;
alter table public.lobby_chat        replica identity full;
alter table public.room_chat         replica identity full;
alter table public.direct_messages   replica identity full;
alter table public.conversations     replica identity full;
alter table public.games             replica identity full;

-- ── 3. Publication supabase_realtime ─────────────────────────────────────────
-- Ajoute uniquement les tables pas encore dans la publication (idempotent).

do $$
declare
  t text;
  tables text[] := array[
    'challenges', 'presence', 'room_members', 'room_invitations',
    'lobby_chat', 'room_chat', 'direct_messages', 'conversations', 'games'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
