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

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate magic bytes — reject anything that isn't a real JPEG or PNG
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng  = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e &&
                   buffer[3] === 0x47 && buffer[4] === 0x0d && buffer[5] === 0x0a &&
                   buffer[6] === 0x1a && buffer[7] === 0x0a;
    if (!isJpeg && !isPng) {
      return NextResponse.json({ error: "Format invalide. JPG ou PNG uniquement." }, { status: 400 });
    }

    const ext  = isPng ? "png" : "jpg";
    const mime = isPng ? "image/png" : "image/jpeg";
    const path = `${session.playerId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, buffer, { contentType: mime, upsert: true });

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
