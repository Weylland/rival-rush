-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 006 — Table game_secrets (état privé serveur-only)
--
-- Cette table stocke les données sensibles d'une partie qui ne doivent JAMAIS
-- transiter par Supabase Realtime ni être lisibles côté client :
--   - Naval         : positions des flottes (codes.ships)
--   - Mastermind    : le code secret de CHAQUE joueur (data.codes[playerId])
--   - Plus-ou-Moins : le nombre secret de chaque manche (data.secret_rounds)
--
-- Elle existait déjà en base (créée à la main) mais n'était documentée dans aucune
-- migration. Ce fichier la rend reproductible. Idempotent : ne touche pas une
-- table existante.
--
-- Accès : RLS activé, AUCUNE policy client. Seul le service_role (createAdminClient)
-- peut lire/écrire, depuis les Server Actions.
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.game_secrets (
  game_id    uuid primary key references public.games(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.game_secrets enable row level security;

-- Aucune policy → tout accès anon/authenticated est refusé par défaut.
-- Le service_role bypasse le RLS (clé serveur uniquement).
