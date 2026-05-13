import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WaitingClient } from "./WaitingClient";

interface Props {
  searchParams: Promise<{ challenge_id?: string }>;
}

export default async function WaitingPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { challenge_id } = await searchParams;
  if (!challenge_id) redirect("/lobby");

  const supabase = await createClient();

  const { data: challenge } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challenge_id)
    .eq("challenger_id", session.playerId)
    .single();

  if (!challenge) redirect("/lobby");

  const [{ data: opponent }, { data: presence }] = await Promise.all([
    supabase.from("players").select("pseudo").eq("id", challenge.challenged_id).single(),
    supabase.from("presence").select("status, updated_at").eq("player_id", challenge.challenged_id).maybeSingle(),
  ]);

  const cutoff = new Date(Date.now() - 180_000).toISOString();
  const opponentIsOffline = !presence || presence.updated_at < cutoff || presence.status === "offline";

  return (
    <WaitingClient
      challengeId={challenge_id}
      myPseudo={session.pseudo}
      myAvatarUrl={session.avatarUrl}
      opponentPseudo={opponent?.pseudo ?? "?"}
      gameType={challenge.game_type}
      opponentIsOffline={opponentIsOffline}
    />
  );
}
