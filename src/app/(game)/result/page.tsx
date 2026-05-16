import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ResultClient } from "./ResultClient";
import type { PFCState } from "@/types/database";

interface Props {
  searchParams: Promise<{ game_id?: string }>;
}

export default async function ResultPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { game_id } = await searchParams;
  if (!game_id) redirect("/lobby");

  const admin = createAdminClient();

  const { data: game } = await admin
    .from("games")
    .select("*, challenges(challenger_id, challenged_id), rooms(code, name)")
    .eq("id", game_id)
    .single();

  if (!game) redirect("/lobby");

  const challenge = game.challenges as { challenger_id: string; challenged_id: string };
  const { challenger_id: p1Id, challenged_id: p2Id } = challenge;

  if (session.playerId !== p1Id && session.playerId !== p2Id) redirect("/lobby");

  const { data: players } = await admin
    .from("players")
    .select("id, pseudo, avatar_url")
    .in("id", [p1Id, p2Id]);

  const pseudoOf = Object.fromEntries((players ?? []).map(p => [p.id, p.pseudo]));
  const avatarOf = Object.fromEntries((players ?? []).map(p => [p.id, p.avatar_url as string | null]));

  const raw = game.state as Record<string, unknown>;
  const pfcState: PFCState | null = raw && "rounds" in raw ? (raw as unknown as PFCState) : null;

  const opponentId = session.playerId === p1Id ? p2Id : p1Id;
  const opponentPseudo = pseudoOf[opponentId] ?? "?";

  const roomRaw = game.rooms as { code: string; name: string } | { code: string; name: string }[] | null;
  const room = Array.isArray(roomRaw) ? roomRaw[0] ?? null : roomRaw;

  return (
    <ResultClient
      myId={session.playerId}
      p1Id={p1Id}
      p2Id={p2Id}
      p1Pseudo={pseudoOf[p1Id] ?? "?"}
      p2Pseudo={pseudoOf[p2Id] ?? "?"}
      p1AvatarUrl={avatarOf[p1Id] ?? null}
      p2AvatarUrl={avatarOf[p2Id] ?? null}
      winnerId={(game.winner_id ?? null) as string | null}
      gameType={game.game_type as "pfc" | "morpion" | "puissance4" | "reflexe" | "naval" | "chess"}
      pfcState={pfcState}
      opponentId={opponentId}
      opponentPseudo={opponentPseudo}
      roomCode={room?.code ?? null}
      roomName={room?.name ?? null}
    />
  );
}
