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
