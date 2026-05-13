import { NextResponse } from "next/server";
import { getSession, setAvatarUrl } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const type = formData.get("type") as string;
  const supabase = await createClient();

  if (type === "preset") {
    const emoji = formData.get("emoji") as string;
    if (!emoji) return NextResponse.json({ error: "Missing emoji" }, { status: 400 });
    const avatarUrl = `preset:${emoji}`;
    await supabase.from("players").update({ avatar_url: avatarUrl }).eq("id", session.playerId);
    await setAvatarUrl(avatarUrl);
    return NextResponse.json({ ok: true, avatarUrl });
  }

  if (type === "remove") {
    await supabase.from("players").update({ avatar_url: null }).eq("id", session.playerId);
    await setAvatarUrl(null);
    return NextResponse.json({ ok: true, avatarUrl: null });
  }

  if (type === "upload") {
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });
    if (file.size > 3 * 1024 * 1024) return NextResponse.json({ error: "Fichier trop lourd (max 3 MB)" }, { status: 400 });

    const ext = file.type === "image/png" ? "png" : "jpg";
    const path = `${session.playerId}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, buffer, { contentType: file.type, upsert: true });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    // Cache-bust
    const avatarUrl = `${publicUrl}?v=${Date.now()}`;

    await supabase.from("players").update({ avatar_url: publicUrl }).eq("id", session.playerId);
    await setAvatarUrl(avatarUrl);
    return NextResponse.json({ ok: true, avatarUrl });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
