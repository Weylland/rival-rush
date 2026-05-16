import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanupStaleGames } from "@/lib/stale-games";
import { LobbyClient } from "./LobbyClient";

export default async function LobbyPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Safety net: forfeit any abandoned games before showing the lobby
  await cleanupStaleGames();

  const supabase = await createClient();

  const cutoff = new Date(Date.now() - 90_000).toISOString();
  const now = new Date().toISOString();
  const [
    { data: presenceData },
    { data: leaderboardData },
    { data: pushData },
    { data: invitationsRaw },
    { data: myRoomsRaw },
  ] = await Promise.all([
    supabase.from("presence").select("*").neq("player_id", session.playerId).gte("updated_at", cutoff),
    supabase.from("leaderboard").select("points").eq("player_id", session.playerId).maybeSingle(),
    createAdminClient().from("push_subscriptions").select("player_id"),
    supabase.from("room_invitations")
      .select("id, room_id, invited_by_id, expires_at, rooms(name, code), players!room_invitations_invited_by_id_fkey(pseudo)")
      .eq("invited_player_id", session.playerId)
      .eq("status", "pending")
      .gt("expires_at", now),
    supabase.from("room_members")
      .select("room_id, rooms(id, name, code, expires_at, is_open)")
      .eq("player_id", session.playerId),
  ]);

  const pushSubscriberIds = (pushData ?? []).map((r: { player_id: string }) => r.player_id);

  const roomInvitations = (invitationsRaw ?? []).map(inv => {
    const room = Array.isArray(inv.rooms) ? inv.rooms[0] : inv.rooms;
    const inviter = Array.isArray(inv.players) ? inv.players[0] : inv.players;
    return {
      id: inv.id as string,
      roomId: inv.room_id as string,
      roomName: (room as { name: string; code: string } | null)?.name ?? "Salle",
      roomCode: (room as { name: string; code: string } | null)?.code ?? "",
      inviterPseudo: (inviter as { pseudo: string } | null)?.pseudo ?? "?",
      expiresAt: inv.expires_at as string,
    };
  });

  // Filter non-expired rooms and normalize
  const myRooms = (myRoomsRaw ?? [])
    .flatMap(m => {
      const r = Array.isArray(m.rooms) ? m.rooms[0] : m.rooms;
      if (!r) return [];
      const room = r as { id: string; name: string; code: string; expires_at: string | null; is_open: boolean };
      if (room.expires_at && new Date(room.expires_at) < new Date()) return [];
      return [{ id: room.id, name: room.name, code: room.code, expiresAt: room.expires_at }];
    });

  return (
    <LobbyClient
      myPlayerId={session.playerId}
      myPseudo={session.pseudo}
      myAvatarUrl={session.avatarUrl}
      myPoints={leaderboardData?.points ?? 0}
      initialPlayers={(presenceData ?? []) as { player_id: string; pseudo: string; status: "online" | "in-game" }[]}
      pushSubscriberIds={pushSubscriberIds}
      roomInvitations={roomInvitations}
      myRooms={myRooms}
    />
  );
}
