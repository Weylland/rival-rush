import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSecrets } from "@/lib/game-secrets";
import { NavalClient } from "./NavalClient";
import type { NavalState, NavalShip } from "@/types/database";

interface Props {
  searchParams: Promise<{ game_id?: string }>;
}

export default async function NavalPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { game_id } = await searchParams;
  if (!game_id) redirect("/lobby");

  const supabase = createAdminClient();

  const { data: game } = await supabase
    .from("games")
    .select("*, challenges(challenger_id, challenged_id)")
    .eq("id", game_id)
    .single();

  if (!game || game.game_type !== "naval") redirect("/lobby");
  if (game.status === "finished") redirect(`/result?game_id=${game_id}`);

  const challenge = game.challenges as { challenger_id: string; challenged_id: string };
  const { challenger_id: p1Id, challenged_id: p2Id } = challenge;

  if (session.playerId !== p1Id && session.playerId !== p2Id) redirect("/lobby");

  const { data: players } = await supabase
    .from("players")
    .select("id, pseudo, avatar_url, avatar_color")
    .in("id", [p1Id, p2Id]);

  const pseudoOf = Object.fromEntries((players ?? []).map(p => [p.id, p.pseudo]));
  const avatarOf = Object.fromEntries((players ?? []).map(p => [p.id, (p.avatar_url as string | null) ?? null]));
  const colorOf = Object.fromEntries((players ?? []).map(p => [p.id, (p.avatar_color as string | null) ?? null]));

  const raw = game.state as Record<string, unknown>;

  // Support both new format (fleets_placed) and legacy format (ships in state)
  const legacyShips = raw?.ships as Record<string, NavalShip[]> | undefined;
  const initialState: NavalState = {
    fleets_placed: (raw?.fleets_placed as Record<string, boolean>) ?? (legacyShips
      ? { [p1Id]: !!legacyShips[p1Id]?.length, [p2Id]: !!legacyShips[p2Id]?.length }
      : {}),
    shots: (raw?.shots as Record<string, import("@/types/database").NavalShot[]>) ?? { [p1Id]: [], [p2Id]: [] },
    sunk_ships: (raw?.sunk_ships as Record<string, NavalShip[]>) ?? {},
    revealed_ships: raw?.revealed_ships as Record<string, NavalShip[]> | undefined,
  };

  // Read MY ships from game_secrets (not from public state) — fall back to legacy state for in-progress games
  const secrets = await readSecrets(game_id);
  const myInitialShips: NavalShip[] | null =
    secrets.ships?.[session.playerId] ??
    legacyShips?.[session.playerId] ??
    null;

  return (
    <NavalClient
      gameId={game_id}
      myId={session.playerId}
      p1Id={p1Id}
      p2Id={p2Id}
      p1Pseudo={pseudoOf[p1Id] ?? "?"}
      p2Pseudo={pseudoOf[p2Id] ?? "?"}
      p1AvatarUrl={avatarOf[p1Id] ?? null}
      p2AvatarUrl={avatarOf[p2Id] ?? null}
      p1AvatarColor={colorOf[p1Id] ?? null}
      p2AvatarColor={colorOf[p2Id] ?? null}
      myInitialShips={myInitialShips}
      initialState={initialState}
      initialStatus={game.status as "waiting" | "playing" | "finished"}
      initialWinnerId={(game.winner_id ?? null) as string | null}
      initialTurn={game.current_turn as string | null}
    />
  );
}
