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
  game_type     text not null check (game_type in ('pfc', 'morpion')),
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at    timestamptz not null default now(),
  constraint no_self_challenge check (challenger_id <> challenged_id)
);

create table public.games (
  id           uuid primary key default uuid_generate_v4(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  game_type    text not null check (game_type in ('pfc', 'morpion')),
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

-- ── Realtime ────────────────────────────────────────────────────
-- À activer dans le dashboard Supabase > Database > Replication :
-- tables : presence, challenges, games
