import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

type ForfeitMode = "self" | "check-opponent";

const STALE_THRESHOLD_MS = 60_000;

async function updateLeaderboardForForfeit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  winnerId: string,
  loserId: string,
) {
  for (const player_id of [winnerId, loserId]) {
    const isWinner = player_id === winnerId;
    const { data: existing } = await supabase
      .from("leaderboard")
      .select("*")
      .eq("player_id", player_id)
      .single();

    if (existing) {
      await supabase.from("leaderboard").update({
        wins: existing.wins + (isWinner ? 1 : 0),
        losses: existing.losses + (isWinner ? 0 : 1),
        points: existing.points + (isWinner ? 3 : 0),
      }).eq("player_id", player_id);
    } else {
      await supabase.from("leaderboard").insert({
        player_id,
        wins: isWinner ? 1 : 0,
        losses: isWinner ? 0 : 1,
        draws: 0,
        points: isWinner ? 3 : 0,
      });
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { gameId, mode = "self" } = (await request.json()) as { gameId: string; mode?: ForfeitMode };
    if (!gameId) return NextResponse.json({ ok: false });

    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false });

    const supabase = await createClient();

    const { data: game } = await supabase
      .from("games")
      .select("*, challenges(challenger_id, challenged_id)")
      .eq("id", gameId)
      .eq("status", "playing")
      .single();

    if (!game) return NextResponse.json({ ok: true, alreadyFinished: true });

    const challenge = game.challenges as { challenger_id: string; challenged_id: string };
    const { challenger_id: p1Id, challenged_id: p2Id } = challenge;

    if (session.playerId !== p1Id && session.playerId !== p2Id) {
      return NextResponse.json({ ok: false });
    }

    let loserId: string;

    if (mode === "self") {
      // Skip forfeit if the player already reconnected to a game (page reload)
      const { data: myPresence } = await supabase
        .from("presence")
        .select("status, updated_at")
        .eq("player_id", session.playerId)
        .maybeSingle();

      const reconnected =
        myPresence?.status === "in-game" &&
        Date.now() - new Date(myPresence.updated_at).getTime() < 10_000;

      if (reconnected) {
        return NextResponse.json({ ok: false, reason: "reconnected" });
      }
      loserId = session.playerId;
    } else {
      // check-opponent: verify the opponent's presence is missing or stale
      const opponentId = session.playerId === p1Id ? p2Id : p1Id;
      const { data: presence } = await supabase
        .from("presence")
        .select("updated_at")
        .eq("player_id", opponentId)
        .maybeSingle();

      const isStale = !presence || (Date.now() - new Date(presence.updated_at).getTime() > STALE_THRESHOLD_MS);
      if (!isStale) {
        return NextResponse.json({ ok: false, reason: "opponent-alive" });
      }
      loserId = opponentId;
    }

    const winnerId = loserId === p1Id ? p2Id : p1Id;

    const { error } = await supabase
      .from("games")
      .update({ status: "finished", winner_id: winnerId })
      .eq("id", gameId)
      .eq("status", "playing");

    if (error) return NextResponse.json({ ok: false });

    await updateLeaderboardForForfeit(supabase, winnerId, loserId);

    return NextResponse.json({ ok: true, winnerId, loserId });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
