import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cleanupStaleGames } from "@/lib/stale-games";
import { LobbyClient } from "./LobbyClient";

export default async function LobbyPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Safety net: forfeit any abandoned games before showing the lobby
  await cleanupStaleGames();

  const supabase = await createClient();

  const cutoff = new Date(Date.now() - 90_000).toISOString();
  const [{ data: presenceData }, { data: leaderboardData }, { data: pushData }] = await Promise.all([
    supabase.from("presence").select("*").neq("player_id", session.playerId).gte("updated_at", cutoff),
    supabase.from("leaderboard").select("points").eq("player_id", session.playerId).maybeSingle(),
    supabase.from("push_subscriptions").select("player_id"),
  ]);

  const pushSubscriberIds = (pushData ?? []).map((r: { player_id: string }) => r.player_id);

  return (
    <LobbyClient
      myPlayerId={session.playerId}
      myPseudo={session.pseudo}
      myPoints={leaderboardData?.points ?? 0}
      initialPlayers={(presenceData ?? []) as { player_id: string; pseudo: string; status: "online" | "in-game" }[]}
      pushSubscriberIds={pushSubscriberIds}
    />
  );
}
