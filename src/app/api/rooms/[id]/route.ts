import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Returns room name+code for a room the user is invited to or is a member of.
// Used by the realtime invitation handler in LobbyClient (bypasses rooms RLS).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();

  // Verify the requester has a legitimate reason to see this room
  const [{ data: inv }, { data: member }] = await Promise.all([
    admin.from("room_invitations")
      .select("id").eq("room_id", id)
      .eq("invited_player_id", session.playerId)
      .eq("status", "pending")
      .maybeSingle(),
    admin.from("room_members")
      .select("player_id").eq("room_id", id)
      .eq("player_id", session.playerId)
      .maybeSingle(),
  ]);

  if (!inv && !member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: room } = await admin
    .from("rooms").select("name, code").eq("id", id).single();

  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ name: room.name, code: room.code });
}
