import { getSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoomSettingsClient } from "./RoomSettingsClient";

export default async function RoomSettingsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();
  const { data: room } = await supabase.from("rooms").select("*").eq("code", code.toUpperCase()).maybeSingle();
  if (!room) notFound();
  if (room.host_id !== session.playerId) redirect(`/room/${code}`);

  return (
    <RoomSettingsClient
      room={{
        id: room.id as string,
        name: room.name as string,
        code: room.code as string,
        isPublic: room.is_public as boolean,
        hasPassword: !!room.password_hash,
        maxMembers: room.max_members as number | null,
        allowedGames: room.allowed_games as string[] | null,
        expiresAt: room.expires_at as string | null,
        isOpen: room.is_open as boolean,
      }}
    />
  );
}
