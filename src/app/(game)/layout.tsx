import type { ReactNode } from "react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ChatProvider } from "./chat/ChatSystem";

export default async function GameLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) return <>{children}</>;

  // Detect active room membership
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("room_members")
    .select("room_id, rooms(id, name, code, expires_at)")
    .eq("player_id", session.playerId)
    .limit(5);

  type RoomRow = { id: string; name: string; code: string; expires_at: string | null };
  // Pick first non-expired room
  const activeRoom = (membership ?? [])
    .flatMap(m => {
      const r = m.rooms;
      if (!r) return [];
      if (Array.isArray(r)) return r as RoomRow[];
      return [r as RoomRow];
    })
    .find(r => !r.expires_at || new Date(r.expires_at) > new Date()) ?? null;

  return (
    <ChatProvider
      myId={session.playerId}
      myPseudo={session.pseudo}
      activeRoomId={activeRoom?.id ?? null}
      activeRoomName={activeRoom?.name ?? null}
    >
      {children}
    </ChatProvider>
  );
}
