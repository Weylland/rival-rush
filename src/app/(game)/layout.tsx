import type { ReactNode } from "react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ChatProvider } from "./chat/ChatSystem";

export default async function GameLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) return <>{children}</>;

  // Fetch all non-expired room memberships; the client decides which one is
  // "active" based on the current pathname (only when on /room/[code]/*).
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("room_members")
    .select("room_id, rooms(id, name, code, expires_at)")
    .eq("player_id", session.playerId)
    .limit(20);

  type RoomRow = { id: string; name: string; code: string; expires_at: string | null };
  const roomMemberships = (membership ?? [])
    .flatMap(m => {
      const r = m.rooms;
      if (!r) return [];
      if (Array.isArray(r)) return r as RoomRow[];
      return [r as RoomRow];
    })
    .filter(r => !r.expires_at || new Date(r.expires_at) > new Date())
    .map(r => ({ id: r.id, name: r.name, code: r.code }));

  // Fetch all block relationships involving me (bidirectional)
  const { data: blocksData } = await supabase
    .from("blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${session.playerId},blocked_id.eq.${session.playerId}`);

  const blockedUserIds = [...new Set(
    (blocksData ?? []).flatMap(b =>
      b.blocker_id === session.playerId ? [b.blocked_id] : [b.blocker_id]
    )
  )];

  return (
    <ChatProvider
      myId={session.playerId}
      myPseudo={session.pseudo}
      roomMemberships={roomMemberships}
      blockedUserIds={blockedUserIds}
    >
      {children}
    </ChatProvider>
  );
}
