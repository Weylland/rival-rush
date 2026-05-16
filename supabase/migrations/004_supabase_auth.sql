-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 004 — Supabase Auth natif
--
-- ATTENTION : cette migration supprime toutes les données existantes.
-- À exécuter sur un environnement de dev uniquement.
--
-- Ce qu'elle fait :
--   1. Vide toutes les tables liées aux joueurs
--   2. Adapte public.players pour fonctionner avec auth.users
--   3. Crée le trigger qui crée un joueur à chaque signup Supabase
--   4. Crée la table admins + fonction is_admin()
--   5. Réécrit toutes les RLS policies
--   6. Met à jour les réglages Realtime
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Reset complet ─────────────────────────────────────────────────────────
-- Vide tout en cascade via les FK (players → leaderboard, presence, messages, etc.)
truncate table public.presence        restart identity cascade;
truncate table public.leaderboard     restart identity cascade;
truncate table public.messages        restart identity cascade;
truncate table public.lobby_chat      restart identity cascade;
truncate table public.room_chat       restart identity cascade;
truncate table public.direct_messages restart identity cascade;
truncate table public.conversations   restart identity cascade;
truncate table public.conversation_reads restart identity cascade;
truncate table public.blocks          restart identity cascade;
truncate table public.reports         restart identity cascade;
truncate table public.contacts        restart identity cascade;
truncate table public.room_invitations restart identity cascade;
truncate table public.room_members    restart identity cascade;
truncate table public.rooms           restart identity cascade;
truncate table public.games           restart identity cascade;
truncate table public.challenges      restart identity cascade;
truncate table public.players         restart identity cascade;
-- Supprime les users Supabase Auth (cascade vers players via la FK qu'on va créer)
delete from auth.users;

-- ── 2. Adapter public.players ────────────────────────────────────────────────

-- Supprimer la colonne password (gérée par Supabase Auth désormais)
alter table public.players drop column if exists password;

-- Supprimer le default uuid auto (l'id viendra de auth.users.id)
alter table public.players alter column id drop default;

-- Ajouter colonne is_guest
alter table public.players add column if not exists is_guest bool not null default false;

-- Lier players.id à auth.users.id
alter table public.players
  add constraint players_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

-- ── 3. Trigger : créer un joueur à chaque signup Supabase ───────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_pseudo text;
  v_is_guest bool;
begin
  v_is_guest := coalesce((new.raw_user_meta_data->>'is_anonymous')::bool, new.is_anonymous, false);

  if v_is_guest then
    -- Pseudo auto pour les invités : Joueur#XXXX
    v_pseudo := 'Joueur#' || lpad((floor(random() * 9999) + 1)::text, 4, '0');
    -- S'assurer de l'unicité
    while exists(select 1 from public.players where pseudo = v_pseudo) loop
      v_pseudo := 'Joueur#' || lpad((floor(random() * 9999) + 1)::text, 4, '0');
    end loop;
  else
    v_pseudo := coalesce(
      new.raw_user_meta_data->>'pseudo',
      split_part(new.email, '@', 1)
    );
  end if;

  insert into public.players (id, pseudo, avatar_url, is_guest, created_at)
  values (
    new.id,
    v_pseudo,
    new.raw_user_meta_data->>'avatar_url',
    v_is_guest,
    now()
  )
  on conflict (id) do nothing;

  -- Créer une entrée leaderboard
  insert into public.leaderboard (player_id)
  values (new.id)
  on conflict (player_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 4. Table admins + fonction is_admin() ────────────────────────────────────

create table if not exists public.admins (
  player_id  uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
create policy "admins_select" on public.admins for select using (true);
-- INSERT/DELETE : service_role uniquement

create or replace function public.is_admin()
returns boolean
language sql
security definer stable
as $$
  select exists(
    select 1 from public.admins where player_id = auth.uid()
  );
$$;

-- ── 5. Réécriture complète des RLS policies ──────────────────────────────────

-- players
drop policy if exists "players_select" on public.players;
drop policy if exists "players_insert" on public.players;
create policy "players_select" on public.players for select using (true);
-- INSERT géré par le trigger, pas directement par les clients

-- challenges
drop policy if exists "challenges_select" on public.challenges;
create policy "challenges_select" on public.challenges for select
  using (auth.uid() = challenger_id or auth.uid() = challenged_id);

-- games
drop policy if exists "games_select" on public.games;
create policy "games_select" on public.games for select
  using (
    exists (
      select 1 from public.challenges c
      where c.id = games.challenge_id
        and (c.challenger_id = auth.uid() or c.challenged_id = auth.uid())
    )
  );

-- leaderboard
drop policy if exists "leaderboard_select" on public.leaderboard;
create policy "leaderboard_select" on public.leaderboard for select using (true);

-- presence
drop policy if exists "presence_select" on public.presence;
drop policy if exists "presence_insert" on public.presence;
drop policy if exists "presence_update" on public.presence;
drop policy if exists "presence_delete" on public.presence;
create policy "presence_select" on public.presence for select using (true);
create policy "presence_insert" on public.presence for insert
  with check (auth.uid() = player_id);
create policy "presence_update" on public.presence for update
  using (auth.uid() = player_id)
  with check (auth.uid() = player_id);
create policy "presence_delete" on public.presence for delete
  using (auth.uid() = player_id);

-- messages
drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages for select
  using (
    exists (
      select 1 from public.challenges c
      join public.games g on g.challenge_id = c.id
      where g.id = messages.game_id
        and (c.challenger_id = auth.uid() or c.challenged_id = auth.uid())
    )
  );

-- lobby_chat : connectés seulement (invités inclus)
drop policy if exists "lobby_chat_select" on public.lobby_chat;
create policy "lobby_chat_select" on public.lobby_chat for select
  using (auth.uid() is not null);

-- conversations
drop policy if exists "conversations_select" on public.conversations;
create policy "conversations_select" on public.conversations for select
  using (auth.uid() = p1_id or auth.uid() = p2_id);

-- direct_messages
drop policy if exists "direct_messages_select" on public.direct_messages;
create policy "direct_messages_select" on public.direct_messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = direct_messages.conversation_id
        and (c.p1_id = auth.uid() or c.p2_id = auth.uid())
    )
  );

-- conversation_reads
drop policy if exists "conv_reads_select" on public.conversation_reads;
create policy "conv_reads_select" on public.conversation_reads for select
  using (player_id = auth.uid());

-- blocks
drop policy if exists "blocks_select" on public.blocks;
create policy "blocks_select" on public.blocks for select
  using (blocker_id = auth.uid() or blocked_id = auth.uid());

-- rooms
drop policy if exists "rooms_select" on public.rooms;
create policy "rooms_select" on public.rooms for select
  using (
    is_public = true
    or host_id = auth.uid()
    or exists (
      select 1 from public.room_members rm
      where rm.room_id = rooms.id and rm.player_id = auth.uid()
    )
  );

-- room_members
drop policy if exists "room_members_select" on public.room_members;
create policy "room_members_select" on public.room_members for select using (true);

-- room_invitations
drop policy if exists "room_invitations_select" on public.room_invitations;
create policy "room_invitations_select" on public.room_invitations for select
  using (invited_by_id = auth.uid() or invited_player_id = auth.uid());

-- room_chat
drop policy if exists "room_chat_select" on public.room_chat;
create policy "room_chat_select" on public.room_chat for select
  using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = room_chat.room_id and rm.player_id = auth.uid()
    )
  );

-- player_notifications
drop policy if exists "player_notifications_select" on public.player_notifications;
create policy "player_notifications_select" on public.player_notifications for select
  using (player_id = auth.uid());

-- contacts
drop policy if exists "contacts_insert" on public.contacts;
create policy "contacts_insert" on public.contacts for insert with check (true);

-- game_settings
drop policy if exists "game_settings_select" on public.game_settings;
create policy "game_settings_select" on public.game_settings for select using (true);
