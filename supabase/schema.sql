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

alter table public.players    enable row level security;
alter table public.challenges enable row level security;
alter table public.games      enable row level security;
alter table public.leaderboard enable row level security;
alter table public.presence   enable row level security;

-- Policies : accès public en lecture (soirée en réseau local, pas d'auth Supabase)
create policy "players public read"     on public.players    for select using (true);
create policy "challenges public read"  on public.challenges for select using (true);
create policy "games public read"       on public.games      for select using (true);
create policy "leaderboard public read" on public.leaderboard for select using (true);
create policy "presence public read"    on public.presence   for select using (true);

-- Écriture permissive (on gère l'auth côté app avec le mot de passe hashé)
create policy "players insert"     on public.players    for insert with check (true);
create policy "players update"     on public.players    for update using (true);
create policy "players delete"     on public.players    for delete using (true);
create policy "challenges insert"  on public.challenges for insert with check (true);
create policy "challenges update"  on public.challenges for update using (true);
create policy "challenges delete"  on public.challenges for delete using (true);
create policy "games insert"       on public.games      for insert with check (true);
create policy "games update"       on public.games      for update using (true);
create policy "games delete"       on public.games      for delete using (true);
create policy "leaderboard insert" on public.leaderboard for insert with check (true);
create policy "leaderboard update" on public.leaderboard for update using (true);
create policy "leaderboard delete" on public.leaderboard for delete using (true);
create policy "presence upsert"    on public.presence   for insert with check (true);
create policy "presence update"    on public.presence   for update using (true);
create policy "presence delete"    on public.presence   for delete using (true);

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
create policy "contacts insert" on public.contacts for insert with check (true);
create policy "contacts select" on public.contacts for select using (true);
create policy "contacts update" on public.contacts for update using (true);
create policy "contacts delete" on public.contacts for delete using (true);

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
create policy "messages read"   on public.messages for select using (true);
create policy "messages insert" on public.messages for insert with check (true);

-- ── Blocks ──────────────────────────────────────────────────────

create table public.blocks (
  blocker_id uuid not null references public.players(id) on delete cascade,
  blocked_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocks enable row level security;
create policy "blocks read"   on public.blocks for select using (true);
create policy "blocks insert" on public.blocks for insert with check (true);
create policy "blocks delete" on public.blocks for delete using (true);

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
create policy "reports read"   on public.reports for select using (true);
create policy "reports insert" on public.reports for insert with check (true);
create policy "reports update" on public.reports for update using (true);

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
create policy "lobby_chat read"   on public.lobby_chat for select using (true);
create policy "lobby_chat insert" on public.lobby_chat for insert with check (true);
create policy "lobby_chat delete" on public.lobby_chat for delete using (true);

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
create policy "conversations read"   on public.conversations for select using (true);
create policy "conversations insert" on public.conversations for insert with check (true);

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
create policy "direct_messages read"   on public.direct_messages for select using (true);
create policy "direct_messages insert" on public.direct_messages for insert with check (true);

-- ── Lecture des conversations (badge unread) ──────────────────────

create table public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  player_id       uuid not null references public.players(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (conversation_id, player_id)
);
alter table public.conversation_reads enable row level security;
create policy "conv_reads read"   on public.conversation_reads for select using (true);
create policy "conv_reads upsert" on public.conversation_reads for insert with check (true);
create policy "conv_reads update" on public.conversation_reads for update using (true);

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

alter table public.rooms         enable row level security;
alter table public.room_members  enable row level security;
alter table public.room_invitations enable row level security;
alter table public.room_chat     enable row level security;

create policy "rooms read"              on public.rooms          for select using (true);
create policy "rooms insert"            on public.rooms          for insert with check (true);
create policy "rooms update"            on public.rooms          for update using (true);
create policy "rooms delete"            on public.rooms          for delete using (true);
create policy "room_members read"       on public.room_members   for select using (true);
create policy "room_members insert"     on public.room_members   for insert with check (true);
create policy "room_members delete"     on public.room_members   for delete using (true);
create policy "room_invitations read"   on public.room_invitations for select using (true);
create policy "room_invitations insert" on public.room_invitations for insert with check (true);
create policy "room_invitations update" on public.room_invitations for update using (true);
create policy "room_invitations delete" on public.room_invitations for delete using (true);
create policy "room_chat read"          on public.room_chat      for select using (true);
create policy "room_chat insert"        on public.room_chat      for insert with check (true);
create policy "room_chat delete"        on public.room_chat      for delete using (true);

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
