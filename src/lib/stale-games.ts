import { createClient } from "@/lib/supabase/server";
import { updateLeaderboard } from "@/lib/leaderboard";

const STALE_THRESHOLD_MS = 60_000;

/**
 * Server-side safety net: finds all playing games and forfeits any where at
 * least one player's presence is missing or stale. Called on lobby load so
 * abandoned games never linger.
 */
export async function cleanupStaleGames() {
  const supabase = await createClient();

  const { data: games } = await supabase
    .from("games")
    .select("id, game_type, challenges(challenger_id, challenged_id)")
    .eq("status", "playing");

  if (!games || games.length === 0) return;

  const { data: presence } = await supabase
    .from("presence")
    .select("player_id, updated_at");

  const freshIds = new Set(
    (presence ?? [])
      .filter((p) => Date.now() - new Date(p.updated_at).getTime() < STALE_THRESHOLD_MS)
      .map((p) => p.player_id),
  );

  for (const game of games) {
    const challenge = game.challenges as unknown as { challenger_id: string; challenged_id: string };
    const p1Fresh = freshIds.has(challenge.challenger_id);
    const p2Fresh = freshIds.has(challenge.challenged_id);

    if (p1Fresh && p2Fresh) continue;

    let winnerId: string | null;
    let loserId: string | null;

    if (p1Fresh && !p2Fresh) {
      winnerId = challenge.challenger_id;
      loserId = challenge.challenged_id;
    } else if (!p1Fresh && p2Fresh) {
      winnerId = challenge.challenged_id;
      loserId = challenge.challenger_id;
    } else {
      // both stale — mark as finished without a winner (no leaderboard credit)
      winnerId = null;
      loserId = null;
    }

    const { error } = await supabase
      .from("games")
      .update({ status: "finished", winner_id: winnerId })
      .eq("id", game.id)
      .eq("status", "playing");

    if (error || !winnerId || !loserId) continue;

    await updateLeaderboard(supabase, winnerId, challenge.challenger_id, challenge.challenged_id, game.game_type as string);
  }
}
