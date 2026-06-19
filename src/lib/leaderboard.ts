import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface Points { win: number; draw: number; loss: number }

const DEFAULTS: Points = { win: 3, draw: 1, loss: 0 };

async function getPoints(supabase: SupabaseClient, gameType?: string): Promise<Points> {
  if (!gameType) return DEFAULTS;
  const { data } = await supabase
    .from("game_settings")
    .select("win_pts, draw_pts, loss_pts")
    .eq("game_type", gameType)
    .maybeSingle();
  if (!data) return DEFAULTS;
  return {
    win:  data.win_pts  ?? DEFAULTS.win,
    draw: data.draw_pts ?? DEFAULTS.draw,
    loss: data.loss_pts ?? DEFAULTS.loss,
  };
}

/**
 * Recalculates a single player's leaderboard row from their full game history.
 * Points use each game's own game_type settings (cached), matching live scoring.
 * Called after account deletion to fix affected opponents, and by admin on manual recalc.
 */
export async function recalculatePlayerLeaderboard(
  supabase: SupabaseClient,
  playerId: string,
) {
  const { data: challenges } = await supabase
    .from("challenges")
    .select("id")
    .or(`challenger_id.eq.${playerId},challenged_id.eq.${playerId}`);

  const challengeIds = (challenges ?? []).map((c) => c.id);
  let wins = 0, losses = 0, draws = 0, points = 0;

  if (challengeIds.length > 0) {
    const { data: games } = await supabase
      .from("games")
      .select("winner_id, challenges(game_type)")
      .eq("status", "finished")
      .in("challenge_id", challengeIds);

    const ptsCache = new Map<string, Points>();
    for (const g of games ?? []) {
      const rel = g.challenges as { game_type?: string } | { game_type?: string }[] | null;
      const gameType = (Array.isArray(rel) ? rel[0] : rel)?.game_type;

      let pts = gameType ? ptsCache.get(gameType) : undefined;
      if (!pts) {
        pts = await getPoints(supabase, gameType);
        if (gameType) ptsCache.set(gameType, pts);
      }

      if (g.winner_id === null) { draws++; points += pts.draw; }
      else if (g.winner_id === playerId) { wins++; points += pts.win; }
      else { losses++; points += pts.loss; }
    }
  }

  await supabase.from("leaderboard").upsert({ player_id: playerId, wins, losses, draws, points });
}

/**
 * Updates the leaderboard for both players after a game ends.
 * @param winnerId - null means draw
 * @param gameType - used to fetch dynamic point values from game_settings
 */
export async function updateLeaderboard(
  supabase: SupabaseClient,
  winnerId: string | null,
  player1Id: string,
  player2Id: string,
  gameType?: string,
) {
  const pts = await getPoints(supabase, gameType);
  const isDraw = winnerId === null;

  for (const player_id of [player1Id, player2Id]) {
    const isWinner = winnerId === player_id;
    const delta = isWinner ? pts.win : isDraw ? pts.draw : pts.loss;

    const { data: existing } = await supabase
      .from("leaderboard")
      .select("*")
      .eq("player_id", player_id)
      .single();

    if (existing) {
      await supabase.from("leaderboard").update({
        wins:   existing.wins   + (isWinner          ? 1 : 0),
        losses: existing.losses + (!isWinner && !isDraw ? 1 : 0),
        draws:  existing.draws  + (isDraw             ? 1 : 0),
        points: existing.points + delta,
      }).eq("player_id", player_id);
    } else {
      await supabase.from("leaderboard").insert({
        player_id,
        wins:   isWinner           ? 1 : 0,
        losses: !isWinner && !isDraw ? 1 : 0,
        draws:  isDraw             ? 1 : 0,
        points: delta,
      });
    }
  }
}
