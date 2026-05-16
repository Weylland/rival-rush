"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { sendPushToSubscriptions } from "@/lib/push";
import type { GameType, RoomExpiration } from "@/types/database";

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ123456789"; // no O, no 0
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function expiresAt(exp: RoomExpiration): string | null {
  if (exp === "permanent") return null;
  const ms: Record<string, number> = { "6h": 6, "12h": 12, "24h": 24, "7d": 168 };
  return new Date(Date.now() + ms[exp] * 3_600_000).toISOString();
}

async function hashPassword(password: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crypt_password", { pass: password });
  if (error || !data) throw new Error("Impossible de hacher le mot de passe");
  return data as string;
}

// ── Create room ───────────────────────────────────────────────────────────────

export interface CreateRoomInput {
  name: string;
  isPublic: boolean;
  password?: string;
  maxMembers?: number | null;
  allowedGames?: GameType[] | null;
  expiration: RoomExpiration;
}

export async function createRoom(input: CreateRoomInput) {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();

  // Generate a unique code
  let code = generateCode();
  let tries = 0;
  while (tries < 10) {
    const { data } = await supabase.from("rooms").select("id").eq("code", code).maybeSingle();
    if (!data) break;
    code = generateCode();
    tries++;
  }

  const passwordHash = input.password ? await hashPassword(input.password) : null;

  const admin = createAdminClient();
  const { data: room, error } = await admin
    .from("rooms")
    .insert({
      name: input.name.trim(),
      code,
      host_id: session.playerId,
      is_public: input.isPublic,
      password_hash: passwordHash,
      max_members: input.maxMembers ?? null,
      allowed_games: input.allowedGames ?? null,
      expires_at: expiresAt(input.expiration),
      is_open: true,
    })
    .select()
    .single();

  if (error || !room) return { error: error?.message ?? "Impossible de créer la salle" };

  // Host auto-joins
  await admin.from("room_members").insert({ room_id: room.id, player_id: session.playerId });

  redirect(`/room/${code}`);
}

// ── Join room ─────────────────────────────────────────────────────────────────

export async function joinRoom(code: string, password?: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();

  const { data: room } = await supabase
    .from("rooms").select("*").eq("code", code.toUpperCase()).maybeSingle();

  if (!room) return { error: "Salle introuvable. Vérifie le code." };

  // Expired?
  if (room.expires_at && new Date(room.expires_at) < new Date()) {
    return { error: "Cette salle a expiré." };
  }

  // Closed?
  if (!room.is_open) return { error: "Les inscriptions sont fermées pour cette salle." };

  // Max members?
  if (room.max_members) {
    const { count } = await supabase
      .from("room_members").select("*", { count: "exact", head: true }).eq("room_id", room.id);
    if ((count ?? 0) >= room.max_members) return { error: "Cette salle est pleine." };
  }

  // Password?
  if (room.password_hash && password) {
    const { data: valid } = await supabase
      .rpc("verify_password", { pass: password, hashed: room.password_hash }).single();
    if (!valid) return { error: "Mot de passe incorrect." };
  } else if (room.password_hash && !password) {
    return { needsPassword: true };
  }

  // Already member?
  const { data: existing } = await supabase
    .from("room_members")
    .select("player_id").eq("room_id", room.id).eq("player_id", session.playerId).maybeSingle();

  if (!existing) {
    await createAdminClient().from("room_members").insert({ room_id: room.id, player_id: session.playerId });
  }

  redirect(`/room/${room.code}`);
}

// ── Leave room ────────────────────────────────────────────────────────────────

export async function leaveRoom(roomId: string) {
  const session = await getSession();
  if (!session) return;

  const supabase = await createClient();
  const admin = createAdminClient();
  await admin.from("room_members")
    .delete().eq("room_id", roomId).eq("player_id", session.playerId);

  // If host leaves, transfer to next member or delete
  const { data: room } = await supabase.from("rooms").select("host_id").eq("id", roomId).maybeSingle();
  if (room?.host_id === session.playerId) {
    const { data: others } = await supabase
      .from("room_members").select("player_id").eq("room_id", roomId).limit(1);
    if (others && others.length > 0) {
      await admin.from("rooms").update({ host_id: others[0].player_id }).eq("id", roomId);
    } else {
      await admin.from("rooms").delete().eq("id", roomId);
    }
  }

  redirect("/lobby");
}

// ── Invite player ─────────────────────────────────────────────────────────────

export async function inviteToRoom(roomId: string, playerId: string) {
  const session = await getSession();
  if (!session) return { error: "Non connecté" };

  const supabase = await createClient();

  // Check already member
  const { data: already } = await supabase
    .from("room_members").select("player_id").eq("room_id", roomId).eq("player_id", playerId).maybeSingle();
  if (already) return { error: "Ce joueur est déjà dans la salle" };

  // Upsert invitation (overwrite declined/pending)
  const expires = new Date(Date.now() + 10 * 60_000).toISOString();
  await createAdminClient().from("room_invitations").upsert({
    room_id: roomId,
    invited_by_id: session.playerId,
    invited_player_id: playerId,
    status: "pending",
    expires_at: expires,
  }, { onConflict: "room_id,invited_player_id" });

  const { data: room } = await supabase.from("rooms").select("name").eq("id", roomId).maybeSingle();
  const { data: subs } = await supabase
    .from("push_subscriptions").select("endpoint, p256dh, auth").eq("player_id", playerId);

  if (subs && subs.length > 0 && room) {
    await sendPushToSubscriptions(subs as { endpoint: string; p256dh: string; auth: string }[], {
      title: `🏠 Invitation de ${session.pseudo}`,
      body: `${session.pseudo} t'invite dans la salle "${room.name}". Tu as 10 minutes pour accepter !`,
      tag: `room-invite-${roomId}`,
      url: `/room/${roomId}`,
    });
  }

  return { ok: true };
}

// ── Respond to invitation ─────────────────────────────────────────────────────

export async function acceptRoomInvitation(invitationId: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();

  const { data: inv } = await supabase
    .from("room_invitations").select("*")
    .eq("id", invitationId).eq("invited_player_id", session.playerId)
    .eq("status", "pending").maybeSingle();

  if (!inv) return { error: "Invitation introuvable ou expirée" };
  if (new Date(inv.expires_at) < new Date()) return { error: "Invitation expirée" };

  const { data: room } = await supabase
    .from("rooms").select("code, is_open, max_members").eq("id", inv.room_id).maybeSingle();
  if (!room) return { error: "Salle introuvable" };
  if (!room.is_open) return { error: "Les inscriptions sont fermées" };

  const admin = createAdminClient();
  await admin.from("room_invitations").update({ status: "accepted" }).eq("id", invitationId);
  await admin.from("room_members").upsert({ room_id: inv.room_id, player_id: session.playerId });

  redirect(`/room/${room.code}`);
}

export async function declineRoomInvitation(invitationId: string) {
  const session = await getSession();
  if (!session) return;
  await createAdminClient().from("room_invitations").update({ status: "declined" })
    .eq("id", invitationId).eq("invited_player_id", session.playerId);
}

// ── Host actions ──────────────────────────────────────────────────────────────

export async function updateRoomSettings(roomId: string, input: Partial<{
  name: string;
  isPublic: boolean;
  password: string | null;
  maxMembers: number | null;
  allowedGames: GameType[] | null;
  isOpen: boolean;
}>) {
  const session = await getSession();
  if (!session) return { error: "Non connecté" };

  const supabase = await createClient();
  const { data: room } = await supabase.from("rooms").select("host_id").eq("id", roomId).maybeSingle();
  if (room?.host_id !== session.playerId) return { error: "Accès refusé" };

  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name.trim();
  if (input.isPublic !== undefined) update.is_public = input.isPublic;
  if (input.password !== undefined) {
    update.password_hash = input.password ? await hashPassword(input.password) : null;
  }
  if (input.maxMembers !== undefined) update.max_members = input.maxMembers;
  if (input.allowedGames !== undefined) update.allowed_games = input.allowedGames;
  if (input.isOpen !== undefined) update.is_open = input.isOpen;

  const { error } = await createAdminClient().from("rooms").update(update).eq("id", roomId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function kickMember(roomId: string, playerId: string) {
  const session = await getSession();
  if (!session) return { error: "Non connecté" };

  const supabase = await createClient();
  const { data: room } = await supabase.from("rooms").select("host_id").eq("id", roomId).maybeSingle();
  if (room?.host_id !== session.playerId) return { error: "Accès refusé" };
  if (playerId === session.playerId) return { error: "Tu ne peux pas te kicker toi-même" };

  await createAdminClient().from("room_members").delete().eq("room_id", roomId).eq("player_id", playerId);
  return { ok: true };
}

export async function transferHost(roomId: string, newHostId: string) {
  const session = await getSession();
  if (!session) return { error: "Non connecté" };

  const supabase = await createClient();
  const { data: room } = await supabase.from("rooms").select("host_id").eq("id", roomId).maybeSingle();
  if (room?.host_id !== session.playerId) return { error: "Accès refusé" };

  await createAdminClient().from("rooms").update({ host_id: newHostId }).eq("id", roomId);
  return { ok: true };
}

export async function deleteRoom(roomId: string) {
  const session = await getSession();
  if (!session) return { error: "Non connecté" };

  const supabase = await createClient();
  const { data: room } = await supabase.from("rooms").select("host_id").eq("id", roomId).maybeSingle();
  if (room?.host_id !== session.playerId) return { error: "Accès refusé" };

  await createAdminClient().from("rooms").delete().eq("id", roomId);
  redirect("/lobby");
}

// ── Send room chat ────────────────────────────────────────────────────────────

export async function sendRoomMessage(roomId: string, content: string) {
  const session = await getSession();
  if (!session) return;
  await createAdminClient().from("room_chat").insert({
    room_id: roomId,
    player_id: session.playerId,
    pseudo: session.pseudo,
    content: content.trim(),
  });
}
