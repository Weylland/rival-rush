import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoomLanding } from "./RoomLanding";

export default async function RoomPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();

  // Public rooms (non-expired, open)
  const { data: publicRooms } = await supabase
    .from("rooms")
    .select("id, name, code, is_public, max_members, allowed_games, expires_at, host_id")
    .eq("is_public", true)
    .eq("is_open", true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(20);

  // Member counts for public rooms
  const roomIds = (publicRooms ?? []).map(r => r.id);
  const { data: memberCounts } = roomIds.length > 0
    ? await supabase.from("room_members").select("room_id").in("room_id", roomIds)
    : { data: [] };

  const countMap = new Map<string, number>();
  for (const m of memberCounts ?? []) {
    countMap.set(m.room_id, (countMap.get(m.room_id) ?? 0) + 1);
  }

  // Host pseudos
  const hostIds = [...new Set((publicRooms ?? []).map(r => r.host_id))];
  const { data: hosts } = hostIds.length > 0
    ? await supabase.from("players").select("id, pseudo").in("id", hostIds)
    : { data: [] };
  const hostMap = new Map((hosts ?? []).map(h => [h.id, h.pseudo as string]));

  const rooms = (publicRooms ?? []).map(r => ({
    id: r.id as string,
    name: r.name as string,
    code: r.code as string,
    isPublic: r.is_public as boolean,
    maxMembers: r.max_members as number | null,
    allowedGames: r.allowed_games as string[] | null,
    expiresAt: r.expires_at as string | null,
    memberCount: countMap.get(r.id as string) ?? 0,
    hostPseudo: hostMap.get(r.host_id as string) ?? "?",
  }));

  return (
    <RoomLanding
      myPlayerId={session.playerId}
      publicRooms={rooms}
    />
  );
}
