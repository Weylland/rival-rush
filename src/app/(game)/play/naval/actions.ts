"use server";

import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readSecrets, writeSecrets } from "@/lib/game-secrets";
import { findHitShip, isShipSunk, isFleetSunk, validateFleet } from "@/lib/battleship";
import { updateLeaderboard } from "@/lib/leaderboard";
import type { NavalState, NavalShip } from "@/types/database";

export async function submitNavalPlacement(gameId: string, ships: NavalShip[]): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Non authentifié" };

  if (!validateFleet(ships)) return { ok: false, error: "Flotte invalide" };

  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("*, challenges(challenger_id, challenged_id)")
    .eq("id", gameId)
    .single();

  if (!game || game.game_type !== "naval" || game.status !== "playing") {
    return { ok: false, error: "Partie invalide" };
  }

  const challenge = game.challenges as { challenger_id: string; challenged_id: string };
  const { challenger_id: p1Id, challenged_id: p2Id } = challenge;
  const myId = session.playerId;

  if (myId !== p1Id && myId !== p2Id) return { ok: false, error: "Non participant" };

  // Store ships privately in game_secrets (never in broadcast state)
  const secrets = await readSecrets(gameId);
  await writeSecrets(gameId, {
    ships: { ...(secrets.ships ?? {}), [myId]: ships },
  });

  // Update only fleets_placed in public state — no ship positions
  const raw = game.state as Record<string, unknown>;
  const state = raw as unknown as Partial<NavalState>;

  const fleetsPlaced = { ...(state.fleets_placed ?? {}), [myId]: true };
  const bothReady = fleetsPlaced[p1Id] && fleetsPlaced[p2Id];

  const newState: NavalState = {
    fleets_placed: fleetsPlaced,
    shots: state.shots ?? { [p1Id]: [], [p2Id]: [] },
    sunk_ships: state.sunk_ships ?? {},
  };

  await supabase.from("games").update({
    state: newState as unknown as Record<string, unknown>,
    ...(bothReady ? { current_turn: p1Id } : {}),
  }).eq("id", gameId);

  return { ok: true };
}

export async function submitNavalShot(gameId: string, cell: number) {
  const session = await getSession();
  if (!session) return { ok: false, error: "Non authentifié" };

  if (cell < 0 || cell > 99) return { ok: false, error: "Case invalide" };

  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("*, challenges(challenger_id, challenged_id)")
    .eq("id", gameId)
    .single();

  if (!game || game.game_type !== "naval" || game.status !== "playing") {
    return { ok: false, error: "Partie invalide" };
  }

  const challenge = game.challenges as { challenger_id: string; challenged_id: string };
  const { challenger_id: p1Id, challenged_id: p2Id } = challenge;
  const myId = session.playerId;

  if (myId !== p1Id && myId !== p2Id) return { ok: false, error: "Non participant" };
  if (game.current_turn !== myId) return { ok: false, error: "Ce n'est pas ton tour" };

  const opponentId = myId === p1Id ? p2Id : p1Id;
  const raw = game.state as Record<string, unknown>;
  const state = raw as unknown as NavalState;

  const myShots = state.shots?.[myId] ?? [];

  if (myShots.some(s => s.cell === cell)) {
    return { ok: false, error: "Case déjà jouée" };
  }

  // Read opponent ships from game_secrets (never from public state)
  const secrets = await readSecrets(gameId);
  const opponentShips = secrets.ships?.[opponentId] ?? [];

  const hitShip = findHitShip(opponentShips, cell);

  let result: "miss" | "hit" | "sunk" = "miss";
  if (hitShip) {
    const prevHitCells = myShots.filter(s => s.result !== "miss").map(s => s.cell);
    const allHitCells = [...prevHitCells, cell];
    result = isShipSunk(hitShip, allHitCells) ? "sunk" : "hit";
  }

  const newShots = [...myShots, { cell, result }];

  // Track sunk ships (reveal them once destroyed — they're no longer secret)
  const newSunkShips = { ...(state.sunk_ships ?? {}) };
  if (result === "sunk" && hitShip) {
    newSunkShips[opponentId] = [...(newSunkShips[opponentId] ?? []), hitShip];
  }

  const hitCells = newShots.filter(s => s.result !== "miss").map(s => s.cell);
  const finished = isFleetSunk(opponentShips, hitCells);

  const newState: NavalState = {
    fleets_placed: state.fleets_placed ?? {},
    shots: { ...(state.shots ?? {}), [myId]: newShots },
    sunk_ships: newSunkShips,
    // Reveal all ship positions once game is over (post-game analysis)
    ...(finished ? { revealed_ships: secrets.ships ?? {} } : {}),
  };

  await supabase.from("games").update({
    state: newState as unknown as Record<string, unknown>,
    current_turn: finished ? null : opponentId,
    status: finished ? "finished" : "playing",
    ...(finished ? { winner_id: myId } : {}),
  }).eq("id", gameId);

  if (finished) {
    await updateLeaderboard(supabase, myId, p1Id, p2Id, "naval");
  }

  return { ok: true, result };
}
