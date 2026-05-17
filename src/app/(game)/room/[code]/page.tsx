import { getSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RoomClient } from "./RoomClient";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();
  // Admin client bypasses column-level grants (password_hash on rooms, games RLS)
  const admin = createAdminClient();

  // Fetch room via admin — SELECT * fails with user client due to password_hash column grant
  const { data: room } = await admin
    .from("rooms").select("*").eq("code", code.toUpperCase()).maybeSingle();

  if (!room) notFound();

  // Check expired
  if (room.expires_at && new Date(room.expires_at) < new Date()) {
    redirect("/room?expired=1");
  }

  // Check membership — security check stays on user client (RLS enforced)
  const { data: membership } = await supabase
    .from("room_members").select("player_id")
    .eq("room_id", room.id).eq("player_id", session.playerId).maybeSingle();

  if (!membership) {
    // Public + open: auto-join
    if (room.is_public && room.is_open && !room.password_hash) {
      const { count } = await supabase
        .from("room_members").select("*", { count: "exact", head: true }).eq("room_id", room.id);
      if (!room.max_members || (count ?? 0) < room.max_members) {
        await supabase.from("room_members").insert({ room_id: room.id, player_id: session.playerId });
      } else {
        redirect(`/room?full=1`);
      }
    } else {
      redirect(`/room?join=${room.code}`);
    }
  }

  // Fetch members with player data
  const { data: membersRaw } = await supabase
    .from("room_members").select("player_id, joined_at").eq("room_id", room.id);

  const memberIds = (membersRaw ?? []).map(m => m.player_id as string);

  const [{ data: players }, { data: lbRows }, { data: presence }] = await Promise.all([
    // avatar_color needs the column grant — use admin to be safe
    admin.from("players").select("id, pseudo, avatar_url, avatar_color").in("id", memberIds),
    supabase.from("leaderboard").select("player_id, wins, losses, draws, points").in("player_id", memberIds),
    supabase.from("presence").select("player_id, status, game_type").in("player_id", memberIds),
  ]);

  // Room leaderboard — admin needed because games RLS only shows games you personally played
  const { data: roomGames } = await admin
    .from("games")
    .select("winner_id, current_turn, state, game_type")
    .eq("room_id", room.id)
    .eq("status", "finished");

  // Compute room-specific scores
  const roomScores: Record<string, { wins: number; losses: number; draws: number; points: number }> = {};
  for (const id of memberIds) roomScores[id] = { wins: 0, losses: 0, draws: 0, points: 0 };

  for (const g of roomGames ?? []) {
    const winnerId = g.winner_id as string | null;
    // Find participants from game state (keys of scores object)
    const state = g.state as Record<string, unknown>;
    const scoresObj = (state?.scores ?? state?.shots) as Record<string, unknown> | undefined;
    const participants = scoresObj ? Object.keys(scoresObj).filter(id => memberIds.includes(id)) : [];

    if (participants.length === 2) {
      const [p1, p2] = participants;
      if (winnerId === null) {
        // Draw
        if (roomScores[p1]) { roomScores[p1].draws++; roomScores[p1].points += 1; }
        if (roomScores[p2]) { roomScores[p2].draws++; roomScores[p2].points += 1; }
      } else {
        const loserId = winnerId === p1 ? p2 : p1;
        if (roomScores[winnerId]) { roomScores[winnerId].wins++; roomScores[winnerId].points += 3; }
        if (roomScores[loserId]) { roomScores[loserId].losses++; }
      }
    }
  }

  const playerMap = new Map((players ?? []).map(p => [p.id, p]));
  const lbMap = new Map((lbRows ?? []).map(r => [r.player_id, r]));
  const presenceMap = new Map((presence ?? []).map(p => [p.player_id, p]));

  const members = memberIds.map(id => {
    const p = playerMap.get(id);
    const lb = lbMap.get(id);
    const pr = presenceMap.get(id);
    return {
      player_id: id,
      pseudo: (p?.pseudo as string) ?? "?",
      avatar_url: (p?.avatar_url as string | null) ?? null,
      avatar_color: (p?.avatar_color as string | null) ?? null,
      joined_at: membersRaw?.find(m => m.player_id === id)?.joined_at as string ?? "",
      status: (pr?.status as "online" | "in-game") ?? "offline" as "online" | "in-game" | "offline",
      game_type: (pr?.game_type as string | null) ?? null,
      globalWins: lb?.wins ?? 0,
      globalLosses: lb?.losses ?? 0,
      globalPoints: lb?.points ?? 0,
      roomWins: roomScores[id]?.wins ?? 0,
      roomLosses: roomScores[id]?.losses ?? 0,
      roomDraws: roomScores[id]?.draws ?? 0,
      roomPoints: roomScores[id]?.points ?? 0,
    };
  }).sort((a, b) => b.roomPoints - a.roomPoints || b.roomWins - a.roomWins);

  // Pending invitations I sent or received
  const { data: invitations } = await supabase
    .from("room_invitations")
    .select("*")
    .eq("room_id", room.id)
    .eq("status", "pending");

  return (
    <RoomClient
      room={{
        id: room.id as string,
        name: room.name as string,
        code: room.code as string,
        hostId: room.host_id as string,
        isPublic: room.is_public as boolean,
        hasPassword: !!room.password_hash,
        maxMembers: room.max_members as number | null,
        allowedGames: room.allowed_games as string[] | null,
        expiresAt: room.expires_at as string | null,
        isOpen: room.is_open as boolean,
      }}
      members={members}
      myPlayerId={session.playerId}
      myPseudo={session.pseudo}
      pendingInvitations={(invitations ?? []) as {
        id: string; invited_player_id: string; invited_by_id: string; expires_at: string;
      }[]}
    />
  );
}
