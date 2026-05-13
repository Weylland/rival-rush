import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MorpionClient } from "./MorpionClient";
import type { MorpionState } from "@/types/database";

interface Props {
  searchParams: Promise<{ game_id?: string }>;
}

export default async function MorpionPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { game_id } = await searchParams;
  if (!game_id) redirect("/lobby");

  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("*, challenges(challenger_id, challenged_id)")
    .eq("id", game_id)
    .single();

  if (!game || game.game_type !== "morpion") redirect("/lobby");

  const challenge = game.challenges as { challenger_id: string; challenged_id: string };
  const { challenger_id: p1Id, challenged_id: p2Id } = challenge;

  if (session.playerId !== p1Id && session.playerId !== p2Id) redirect("/lobby");

  const { data: players } = await supabase
    .from("players")
    .select("id, pseudo, avatar_url")
    .in("id", [p1Id, p2Id]);

  const pseudoOf = Object.fromEntries((players ?? []).map(p => [p.id, p.pseudo]));
  const avatarOf = Object.fromEntries((players ?? []).map(p => [p.id, (p.avatar_url as string | null) ?? null]));

  const raw = game.state as Record<string, unknown>;
  const initialState: MorpionState = raw && "board" in raw
    ? (raw as unknown as MorpionState)
    : { board: Array(9).fill(null), scores: { [p1Id]: 0, [p2Id]: 0 } };

  return (
    <MorpionClient
      gameId={game_id}
      myId={session.playerId}
      p1Id={p1Id}
      p2Id={p2Id}
      p1Pseudo={pseudoOf[p1Id] ?? "?"}
      p2Pseudo={pseudoOf[p2Id] ?? "?"}
      p1AvatarUrl={avatarOf[p1Id] ?? null}
      p2AvatarUrl={avatarOf[p2Id] ?? null}
      initialState={initialState}
      initialStatus={game.status as "waiting" | "playing" | "finished"}
      initialCurrentTurn={game.current_turn as string | null}
      initialWinnerId={game.winner_id as string | null}
    />
  );
}
