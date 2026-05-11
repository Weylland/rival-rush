import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { playerId } = await request.json();
    if (!playerId) return NextResponse.json({ ok: false });

    const supabase = await createClient();
    await supabase.from("presence").delete().eq("player_id", playerId);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
