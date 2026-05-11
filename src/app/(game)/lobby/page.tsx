import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LobbyClient } from "./LobbyClient";

export default async function LobbyPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();

  const [{ data: presenceData }, { data: leaderboardData }] = await Promise.all([
    supabase.from("presence").select("*").neq("player_id", session.playerId),
    supabase.from("leaderboard").select("points").eq("player_id", session.playerId).maybeSingle(),
  ]);

  return (
    <LobbyClient
      myPlayerId={session.playerId}
      myPseudo={session.pseudo}
      myPoints={leaderboardData?.points ?? 0}
      initialPlayers={(presenceData ?? []) as { player_id: string; pseudo: string; status: "online" | "in-game" }[]}
    />
  );
}
