"use server";

import { createClient } from "@/lib/supabase/server";

const WIN_PTS = 3;
const DRAW_PTS = 1;

async function recalculateLeaderboard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  playerId: string,
) {
  const { data: challenges } = await supabase
    .from("challenges")
    .select("id, challenger_id, challenged_id")
    .or(`challenger_id.eq.${playerId},challenged_id.eq.${playerId}`);

  const challengeIds = (challenges ?? []).map((c) => c.id);

  let wins = 0, losses = 0, draws = 0;

  if (challengeIds.length > 0) {
    const { data: games } = await supabase
      .from("games")
      .select("winner_id")
      .eq("status", "finished")
      .in("challenge_id", challengeIds);

    for (const game of games ?? []) {
      if (game.winner_id === null) draws++;
      else if (game.winner_id === playerId) wins++;
      else losses++;
    }
  }

  const points = wins * WIN_PTS + draws * DRAW_PTS;
  await supabase.from("leaderboard").upsert({ player_id: playerId, wins, losses, draws, points });
}

export async function deletePlayer(playerId: string, secret: string) {
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return { error: "Non autorisé" };
  }

  const supabase = await createClient();

  // 1. Forfeit any active game the player is in
  const { data: activeChallenges } = await supabase
    .from("challenges")
    .select("id, challenger_id, challenged_id")
    .or(`challenger_id.eq.${playerId},challenged_id.eq.${playerId}`)
    .eq("status", "accepted");

  if (activeChallenges && activeChallenges.length > 0) {
    const activeIds = activeChallenges.map((c) => c.id);
    const { data: activeGames } = await supabase
      .from("games")
      .select("id, winner_id")
      .in("challenge_id", activeIds)
      .eq("status", "playing");

    for (const game of activeGames ?? []) {
      const challenge = activeChallenges.find((c) =>
        activeIds.includes(c.id)
      );
      if (!challenge) continue;
      const winnerId =
        challenge.challenger_id === playerId
          ? challenge.challenged_id
          : challenge.challenger_id;

      await supabase
        .from("games")
        .update({ status: "finished", winner_id: winnerId })
        .eq("id", game.id);

      // Update leaderboard for winner (opponent)
      // leaderboard for the winner is recalculated in step 4 below
    }
  }

  // 2. Collect all challenge IDs for this player
  const { data: allChallenges } = await supabase
    .from("challenges")
    .select("id, challenger_id, challenged_id")
    .or(`challenger_id.eq.${playerId},challenged_id.eq.${playerId}`);

  const challengeIds = (allChallenges ?? []).map((c) => c.id);
  const opponentIds = new Set<string>();
  for (const c of allChallenges ?? []) {
    const opId =
      c.challenger_id === playerId ? c.challenged_id : c.challenger_id;
    opponentIds.add(opId);
  }

  // 3. Delete games then challenges
  if (challengeIds.length > 0) {
    await supabase.from("games").delete().in("challenge_id", challengeIds);
    await supabase.from("challenges").delete().in("id", challengeIds);
  }

  // 4. Recalculate leaderboard for all affected opponents
  for (const opId of opponentIds) {
    await recalculateLeaderboard(supabase, opId);
  }

  // 5. Clean up player's own records
  await supabase.from("leaderboard").delete().eq("player_id", playerId);
  await supabase.from("presence").delete().eq("player_id", playerId);
  await supabase.from("players").delete().eq("id", playerId);

  return { ok: true };
}
