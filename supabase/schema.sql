-- ExpressionArena — Schéma Supabase
-- Colle ce SQL dans l'éditeur SQL de ton projet Supabase

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── Tables ───────────────────────────────────────────────────────

create table public.players (
  id         uuid primary key default uuid_generate_v4(),
  pseudo     text not null unique,
  password   text not null, -- stocké hashé via pgcrypto crypt()
  created_at timestamptz not null default now()
);

create table public.challenges (
  id            uuid primary key default uuid_generate_v4(),
  challenger_id uuid not null references public.players(id) on delete cascade,
  challenged_id uuid not null references public.players(id) on delete cascade,
  game_type     text not null check (game_type in ('pfc', 'morpion', 'puissance4', 'reflexe', 'naval', 'chess', 'nim', 'pig', 'mastermind', 'plus-ou-moins', 'duel-des')),
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at    timestamptz not null default now(),
  constraint no_self_challenge check (challenger_id <> challenged_id)
);

create table public.games (
  id           uuid primary key default uuid_generate_v4(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  game_type    text not null check (game_type in ('pfc', 'morpion', 'puissance4', 'reflexe', 'naval', 'chess', 'nim', 'pig', 'mastermind', 'plus-ou-moins', 'duel-des')),
  state        jsonb not null default '{}',
  current_turn uuid references public.players(id),
  winner_id    uuid references public.players(id),
  status       text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  created_at   timestamptz not null default now()
);

create table public.leaderboard (
  player_id uuid primary key references public.players(id) on delete cascade,
  wins      int not null default 0,
  losses    int not null default 0,
  draws     int not null default 0,
  points    int not null default 0
);

-- ── Vue avec pseudo pour le classement ──────────────────────────

create view public.leaderboard_with_pseudo as
  select l.*, p.pseudo
  from public.leaderboard l
  join public.players p on p.id = l.player_id
  order by l.points desc;

-- ── Presence table (joueurs en ligne) ───────────────────────────

create table public.presence (
  player_id  uuid primary key references public.players(id) on delete cascade,
  pseudo     text not null,
  status     text not null default 'online' check (status in ('online', 'in-game')),
  game_type  text,
  updated_at timestamptz not null default now()
);

-- ── RLS (Row Level Security) ─────────────────────────────────────
-- Architecture : le client serveur utilise service_role (bypasse RLS).
-- Le client browser passe un JWT signé SUPABASE_JWT_SECRET → auth.uid() = player UUID.
-- Les policies protègent l'accès direct à l'API PostgREST depuis le browser.

alter table public.players    enable row level security;
alter table public.challenges enable row level security;
alter table public.games      enable row level security;
alter table public.leaderboard enable row level security;
alter table public.presence   enable row level security;

-- players : cacher le mot de passe via les privilèges colonne
revoke select on public.players from anon, authenticated;
grant select (id, pseudo, avatar_url, created_at) on public.players to anon, authenticated;
create policy "players_select" on public.players for select using (true);
create policy "players_insert" on public.players for insert with check (true);
-- UPDATE/DELETE : service_role uniquement

-- challenges : uniquement les défis où tu es impliqué
create policy "challenges_select" on public.challenges for select
  using (auth.uid() = challenger_id or auth.uid() = challenged_id);

-- games : uniquement les parties où tu es joueur
create policy "games_select" on public.games for select
  using (
    exists (
      select 1 from public.challenges c
      where c.id = games.challenge_id
        and (c.challenger_id = auth.uid() or c.challenged_id = auth.uid())
    )
  );

-- leaderboard : public
create policy "leaderboard_select" on public.leaderboard for select using (true);

-- presence : lecture publique, écriture uniquement sur sa propre ligne
create policy "presence_select" on public.presence for select using (true);
create policy "presence_insert" on public.presence for insert
  with check (auth.uid() = player_id);
create policy "presence_update" on public.presence for update
  using (auth.uid() = player_id)
  with check (auth.uid() = player_id);
create policy "presence_delete" on public.presence for delete
  using (auth.uid() = player_id);

-- ── Contacts (formulaire de contact) ────────────────────────────

create table public.contacts (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  email      text not null,
  subject    text,
  message    text not null,
  status     text not null default 'new' check (status in ('new', 'in_progress', 'done', 'spam')),
  created_at timestamptz not null default now()
);

alter table public.contacts enable row level security;
create policy "contacts_insert" on public.contacts for insert with check (true);
-- SELECT/UPDATE/DELETE : service_role uniquement (admin)

-- ── Messages (chat in-game) ─────────────────────────────────────

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  pseudo     text not null,
  content    text not null check (char_length(content) between 1 and 200),
  created_at timestamptz not null default now()
);
create index messages_game_id_idx on public.messages(game_id, created_at);
alter table public.messages enable row level security;
create policy "messages_select" on public.messages for select
  using (
    exists (
      select 1 from public.challenges c
      join public.games g on g.challenge_id = c.id
      where g.id = messages.game_id
        and (c.challenger_id = auth.uid() or c.challenged_id = auth.uid())
    )
  );
-- INSERT/DELETE : service_role uniquement

-- ── Blocks ──────────────────────────────────────────────────────

create table public.blocks (
  blocker_id uuid not null references public.players(id) on delete cascade,
  blocked_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocks enable row level security;
create policy "blocks_select" on public.blocks for select
  using (blocker_id = auth.uid() or blocked_id = auth.uid());
-- INSERT/DELETE : service_role uniquement

-- ── Reports (signalements) ───────────────────────────────────────

create table public.reports (
  id                 uuid primary key default gen_random_uuid(),
  reporter_id        uuid not null references public.players(id) on delete cascade,
  reported_player_id uuid not null references public.players(id) on delete cascade,
  game_id            uuid not null,
  message_content    text not null,
  status             text not null default 'new' check (status in ('new', 'reviewed', 'ignored')),
  created_at         timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "reports_insert" on public.reports for insert
  with check (auth.uid() is not null and auth.uid() = reporter_id);
-- SELECT/UPDATE/DELETE : service_role uniquement (admin)

-- ── Chat global de lobby ─────────────────────────────────────────

create table public.lobby_chat (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  pseudo     text not null,
  content    text not null check (char_length(content) between 1 and 300),
  created_at timestamptz not null default now()
);
create index lobby_chat_created_at_idx on public.lobby_chat(created_at desc);
alter table public.lobby_chat enable row level security;
create policy "lobby_chat_select" on public.lobby_chat for select
  using (auth.uid() is not null);
-- INSERT/DELETE : service_role uniquement

-- ── Conversations DM ─────────────────────────────────────────────

create table public.conversations (
  id         uuid primary key default gen_random_uuid(),
  p1_id      uuid not null references public.players(id) on delete cascade,
  p2_id      uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint conversations_ordered check (p1_id < p2_id),
  unique (p1_id, p2_id)
);
alter table public.conversations enable row level security;
create policy "conversations_select" on public.conversations for select
  using (auth.uid() = p1_id or auth.uid() = p2_id);
-- INSERT/DELETE : service_role uniquement

-- ── Messages directs ─────────────────────────────────────────────

create table public.direct_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.players(id) on delete cascade,
  pseudo          text not null,
  content         text not null check (char_length(content) between 1 and 500),
  created_at      timestamptz not null default now()
);
create index direct_messages_conv_idx on public.direct_messages(conversation_id, created_at);
alter table public.direct_messages enable row level security;
create policy "direct_messages_select" on public.direct_messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = direct_messages.conversation_id
        and (c.p1_id = auth.uid() or c.p2_id = auth.uid())
    )
  );
-- INSERT/DELETE : service_role uniquement

-- ── Lecture des conversations (badge unread) ──────────────────────

create table public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  player_id       uuid not null references public.players(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (conversation_id, player_id)
);
alter table public.conversation_reads enable row level security;
create policy "conv_reads_select" on public.conversation_reads for select
  using (player_id = auth.uid());
-- INSERT/UPDATE : service_role uniquement

-- ── Salles privées ───────────────────────────────────────────────

create table public.rooms (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 40),
  code          text not null unique check (char_length(code) = 6),
  host_id       uuid not null references public.players(id) on delete cascade,
  is_public     bool not null default true,
  password_hash text,                          -- null = pas de mot de passe
  max_members   int check (max_members > 1),   -- null = illimité
  allowed_games text[],                        -- null = tous les jeux
  expires_at    timestamptz,                   -- null = permanente
  is_open       bool not null default true,    -- accepter de nouveaux membres
  created_at    timestamptz not null default now()
);

create table public.room_members (
  room_id    uuid not null references public.rooms(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (room_id, player_id)
);

create table public.room_invitations (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references public.rooms(id) on delete cascade,
  invited_by_id    uuid not null references public.players(id) on delete cascade,
  invited_player_id uuid not null references public.players(id) on delete cascade,
  status           text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  expires_at       timestamptz not null,
  created_at       timestamptz not null default now(),
  constraint no_self_invite check (invited_by_id <> invited_player_id),
  unique (room_id, invited_player_id)
);

create table public.room_chat (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  pseudo     text not null,
  content    text not null check (char_length(content) between 1 and 300),
  created_at timestamptz not null default now()
);
create index room_chat_room_idx on public.room_chat(room_id, created_at);

-- room_id tag sur les parties (nullable — parties hors salle = null)
alter table public.games add column if not exists room_id uuid references public.rooms(id) on delete set null;

alter table public.rooms            enable row level security;
alter table public.room_members     enable row level security;
alter table public.room_invitations enable row level security;
alter table public.room_chat        enable row level security;

-- rooms : cacher password_hash
revoke select on public.rooms from anon, authenticated;
grant select (id, name, code, host_id, is_public, max_members, allowed_games, expires_at, is_open, created_at)
  on public.rooms to anon, authenticated;

-- rooms : salles publiques visibles par tous ; privées par membres/hôte
create policy "rooms_select" on public.rooms for select
  using (
    is_public = true
    or host_id = auth.uid()
    or exists (
      select 1 from public.room_members rm
      where rm.room_id = rooms.id and rm.player_id = auth.uid()
    )
  );

-- room_members : public
create policy "room_members_select" on public.room_members for select using (true);

-- room_invitations : inviteur ou invité
create policy "room_invitations_select" on public.room_invitations for select
  using (invited_by_id = auth.uid() or invited_player_id = auth.uid());

-- room_chat : membres de la salle uniquement
create policy "room_chat_select" on public.room_chat for select
  using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = room_chat.room_id and rm.player_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE sur tous : service_role uniquement

-- ── Configuration des jeux (admin) ──────────────────────────────

create table public.game_settings (
  game_type  text primary key check (game_type in (
    'pfc', 'morpion', 'puissance4', 'reflexe', 'naval', 'chess',
    'nim', 'pig', 'mastermind', 'plus-ou-moins', 'duel-des'
  )),
  is_active  bool not null default true,
  win_pts    int  not null default 3,
  draw_pts   int  not null default 1,
  loss_pts   int  not null default 0
);

alter table public.game_settings enable row level security;
create policy "game_settings_select" on public.game_settings for select using (true);
-- INSERT/UPDATE/DELETE : service_role uniquement (admin)

insert into public.game_settings (game_type, is_active, win_pts, draw_pts) values
  ('pfc',           true, 3, 1),
  ('morpion',       true, 3, 1),
  ('puissance4',    true, 3, 1),
  ('reflexe',       true, 3, 1),
  ('naval',         true, 3, 1),
  ('chess',         true, 3, 1),
  ('nim',           true, 3, 1),
  ('pig',           true, 3, 1),
  ('mastermind',    true, 3, 1),
  ('plus-ou-moins', true, 3, 1),
  ('duel-des',      true, 3, 1)
on conflict (game_type) do nothing;

-- ── Notifications joueurs (avertissements admin) ─────────────────

create table public.player_notifications (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  type       text not null default 'warning',
  message    text not null,
  seen       bool not null default false,
  created_at timestamptz not null default now()
);

alter table public.player_notifications enable row level security;
create policy "player_notifications_select" on public.player_notifications for select
  using (player_id = auth.uid());
-- INSERT/UPDATE/DELETE : service_role uniquement (admin)

-- ── Realtime ────────────────────────────────────────────────────

alter publication supabase_realtime add table public.presence;
alter publication supabase_realtime add table public.challenges;
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.lobby_chat;
alter publication supabase_realtime add table public.direct_messages;
alter publication supabase_realtime add table public.room_members;
alter publication supabase_realtime add table public.room_invitations;
alter publication supabase_realtime add table public.room_chat;
