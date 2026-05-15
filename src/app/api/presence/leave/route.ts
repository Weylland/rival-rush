import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false });

    const { playerId } = await request.json();
    if (!playerId || playerId !== session.playerId) return NextResponse.json({ ok: false });

    const supabase = await createClient();
    await supabase.from("presence").delete().eq("player_id", session.playerId);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
