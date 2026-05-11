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

  const { data: opponent } = await supabase
    .from("players")
    .select("pseudo")
    .eq("id", challenge.challenged_id)
    .single();

  return (
    <WaitingClient
      challengeId={challenge_id}
      myPseudo={session.pseudo}
      opponentPseudo={opponent?.pseudo ?? "?"}
      gameType={challenge.game_type}
    />
  );
}
