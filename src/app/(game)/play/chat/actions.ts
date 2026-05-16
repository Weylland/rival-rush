"use server";

import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Profanity filter (FR) ─────────────────────────────────────────────────────

const BAD_WORDS = [
  "pute","putain","connard","connasse","salope","enculé","encule","fdp",
  "nique","niquer","chiotte","tapette","nazisalaud","batard","bâtard",
];

function hasProfanity(text: string): boolean {
  const clean = text.toLowerCase().replace(/[^a-z]/g, "");
  return BAD_WORDS.some(w => clean.includes(w.replace(/[^a-z]/g, "")));
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function sendMessage(
  gameId: string,
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Non connecté" };

  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 200) return { ok: false, error: "Message invalide" };
  if (hasProfanity(trimmed)) return { ok: false, error: "Message refusé (contenu inapproprié)" };

  const supabase = await createClient();
  const admin = createAdminClient();

  // Rate limit : max 3 messages dans les 5 dernières secondes
  const since = new Date(Date.now() - 5_000).toISOString();
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId)
    .eq("player_id", session.playerId)
    .gte("created_at", since);

  if ((count ?? 0) >= 3) return { ok: false, error: "Trop vite ! Attends un peu." };

  const { error } = await admin.from("messages").insert({
    game_id: gameId,
    player_id: session.playerId,
    pseudo: session.pseudo,
    content: trimmed,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function blockPlayer(
  blockedId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Non connecté" };

  const admin = createAdminClient();
  const { error } = await admin.from("blocks").upsert({
    blocker_id: session.playerId,
    blocked_id: blockedId,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function reportMessage(
  reportedPlayerId: string,
  gameId: string,
  messageContent: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Non connecté" };

  const admin = createAdminClient();
  const { error } = await admin.from("reports").insert({
    reporter_id: session.playerId,
    reported_player_id: reportedPlayerId,
    game_id: gameId,
    message_content: messageContent,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
