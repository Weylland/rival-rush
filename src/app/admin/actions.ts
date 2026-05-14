"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hashPassword } from "@/lib/auth";

export async function adminLogin(_prev: string | null, formData: FormData): Promise<string | null> {
  const secret = formData.get("secret") as string;
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return "Mot de passe incorrect";
  }
  const store = await cookies();
  store.set("ea_admin", secret, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
  redirect("/admin");
}

const WIN_PTS = 3;
const DRAW_PTS = 1;

async function recalculateLeaderboard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  playerId: string,
) {
  const { data: challenges } = await supabase
    .from("challenges")
    .select("id, challenger_id, challenged_id")
    .or(`challenger_id.eq.${playerId},challenged_id.eq.${playerId}`);

  const challengeIds = (challenges ?? []).map((c) => c.id);

  let wins = 0, losses = 0, draws = 0;

  if (challengeIds.length > 0) {
    const { data: games } = await supabase
      .from("games")
      .select("winner_id")
      .eq("status", "finished")
      .in("challenge_id", challengeIds);

    for (const game of games ?? []) {
      if (game.winner_id === null) draws++;
      else if (game.winner_id === playerId) wins++;
      else losses++;
    }
  }

  const points = wins * WIN_PTS + draws * DRAW_PTS;
  await supabase.from("leaderboard").upsert({ player_id: playerId, wins, losses, draws, points });
}

export async function deletePlayer(playerId: string) {
  const store = await cookies();
  const adminCookie = store.get("ea_admin")?.value;
  if (!adminCookie || adminCookie !== process.env.ADMIN_SECRET) {
    return { error: "Non autorisé" };
  }

  const supabase = await createClient();

  // 1. Forfeit any active game the player is in
  const { data: activeChallenges } = await supabase
    .from("challenges")
    .select("id, challenger_id, challenged_id")
    .or(`challenger_id.eq.${playerId},challenged_id.eq.${playerId}`)
    .eq("status", "accepted");

  if (activeChallenges && activeChallenges.length > 0) {
    const activeIds = activeChallenges.map((c) => c.id);
    const { data: activeGames } = await supabase
      .from("games")
      .select("id, winner_id")
      .in("challenge_id", activeIds)
      .eq("status", "playing");

    for (const game of activeGames ?? []) {
      const challenge = activeChallenges.find((c) =>
        activeIds.includes(c.id)
      );
      if (!challenge) continue;
      const winnerId =
        challenge.challenger_id === playerId
          ? challenge.challenged_id
          : challenge.challenger_id;

      await supabase
        .from("games")
        .update({ status: "finished", winner_id: winnerId })
        .eq("id", game.id);

      // Update leaderboard for winner (opponent)
      // leaderboard for the winner is recalculated in step 4 below
    }
  }

  // 2. Collect all challenge IDs for this player
  const { data: allChallenges } = await supabase
    .from("challenges")
    .select("id, challenger_id, challenged_id")
    .or(`challenger_id.eq.${playerId},challenged_id.eq.${playerId}`);

  const challengeIds = (allChallenges ?? []).map((c) => c.id);
  const opponentIds = new Set<string>();
  for (const c of allChallenges ?? []) {
    const opId =
      c.challenger_id === playerId ? c.challenged_id : c.challenger_id;
    opponentIds.add(opId);
  }

  // 3. Delete games then challenges
  if (challengeIds.length > 0) {
    const { error: gamesErr } = await supabase.from("games").delete().in("challenge_id", challengeIds);
    if (gamesErr) return { error: `Erreur suppression games: ${gamesErr.message}` };
    const { error: chalErr } = await supabase.from("challenges").delete().in("id", challengeIds);
    if (chalErr) return { error: `Erreur suppression challenges: ${chalErr.message}` };
  }

  // 4. Recalculate leaderboard for all affected opponents
  for (const opId of opponentIds) {
    await recalculateLeaderboard(supabase, opId);
  }

  // 5. Clean up player's own records
  const { error: lbErr } = await supabase.from("leaderboard").delete().eq("player_id", playerId);
  if (lbErr) return { error: `Erreur suppression leaderboard: ${lbErr.message}` };
  await supabase.from("presence").delete().eq("player_id", playerId);
  const { error: playerErr } = await supabase.from("players").delete().eq("id", playerId);
  if (playerErr) return { error: `Erreur suppression joueur: ${playerErr.message}` };

  return { ok: true };
}

export async function resetPlayerPassword(playerId: string): Promise<{ tempPassword: string } | { error: string }> {
  const store = await cookies();
  const adminCookie = store.get("ea_admin")?.value;
  if (!adminCookie || adminCookie !== process.env.ADMIN_SECRET) {
    return { error: "Non autorisé" };
  }

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const tempPassword = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

  const hashed = await hashPassword(tempPassword);
  const supabase = await createClient();
  const { error } = await supabase.from("players").update({ password: hashed }).eq("id", playerId);
  if (error) return { error: `Erreur: ${error.message}` };

  return { tempPassword };
}

export type ReportStatus = "new" | "reviewed" | "ignored";

export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
): Promise<{ ok: boolean } | { error: string }> {
  const store = await cookies();
  const adminCookie = store.get("ea_admin")?.value;
  if (!adminCookie || adminCookie !== process.env.ADMIN_SECRET) {
    return { error: "Non autorisé" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("reports").update({ status }).eq("id", reportId);
  if (error) return { error: error.message };
  return { ok: true };
}

export type ContactStatus = "new" | "in_progress" | "done" | "spam";

export async function deleteContact(contactId: string): Promise<{ ok: boolean } | { error: string }> {
  const store = await cookies();
  const adminCookie = store.get("ea_admin")?.value;
  if (!adminCookie || adminCookie !== process.env.ADMIN_SECRET) {
    return { error: "Non autorisé" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", contactId);
  if (error) return { error: error.message };

  return { ok: true };
}

export async function updateContactStatus(
  contactId: string,
  status: ContactStatus,
): Promise<{ ok: boolean } | { error: string }> {
  const store = await cookies();
  const adminCookie = store.get("ea_admin")?.value;
  if (!adminCookie || adminCookie !== process.env.ADMIN_SECRET) {
    return { error: "Non autorisé" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").update({ status }).eq("id", contactId);
  if (error) return { error: error.message };

  return { ok: true };
}

// ── Auth helper (nouveaux actions) ────────────────────────────────────────

async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return store.get("ea_admin")?.value === process.env.ADMIN_SECRET;
}

// ── Chat modération — Lobby ───────────────────────────────────────────────

export async function deleteLobbyChatMessage(messageId: string): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
  const { error } = await supabase.from("lobby_chat").delete().eq("id", messageId);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteLobbyChatByPlayer(playerId: string): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
  const { error } = await supabase.from("lobby_chat").delete().eq("player_id", playerId);
  return error ? { error: error.message } : { ok: true };
}

// ── Chat modération — Salles ──────────────────────────────────────────────

export async function deleteRoomChatMessage(messageId: string): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
  const { error } = await supabase.from("room_chat").delete().eq("id", messageId);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteRoomChatByPlayer(roomId: string, playerId: string): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
  const { error } = await supabase.from("room_chat").delete().eq("room_id", roomId).eq("player_id", playerId);
  return error ? { error: error.message } : { ok: true };
}

// ── Chat modération — DMs ─────────────────────────────────────────────────

export async function deleteDMMessage(messageId: string): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
  // Soft delete — UPDATE fires reliably in Realtime, DELETE does not
  const { error } = await supabase.from("direct_messages").update({ deleted: true }).eq("id", messageId);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteConversation(conversationId: string): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
  // Soft-delete all messages first so chat clients see them disappear via reliable UPDATE realtime events
  // (DELETE realtime is unreliable, and cascade DELETE doesn't fire postgres_changes properly)
  await supabase.from("direct_messages").update({ deleted: true }).eq("conversation_id", conversationId);
  const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
  return error ? { error: error.message } : { ok: true };
}

// ── Gestion joueurs ───────────────────────────────────────────────────────

export async function updatePlayerPseudo(playerId: string, newPseudo: string): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const trimmed = newPseudo.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 20) return { error: "Pseudo invalide (2–20 caractères)" };
  const supabase = await createClient();
  const { error } = await supabase.from("players").update({ pseudo: trimmed }).eq("id", playerId);
  return error ? { error: error.message } : { ok: true };
}

export async function setPlayerStats(
  playerId: string,
  wins: number,
  losses: number,
  draws: number,
): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const points = wins * WIN_PTS + draws * DRAW_PTS;
  const supabase = await createClient();
  const { error } = await supabase.from("leaderboard").upsert({ player_id: playerId, wins, losses, draws, points });
  return error ? { error: error.message } : { ok: true };
}

export async function sendPlayerWarning(playerId: string, message: string): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  if (!message.trim()) return { error: "Message vide" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("player_notifications")
    .insert({ player_id: playerId, type: "warning", message: message.trim() });
  return error ? { error: error.message } : { ok: true };
}

// ── Gestion salles ────────────────────────────────────────────────────────

export async function deleteRoom(roomId: string): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
  const { error } = await supabase.from("rooms").delete().eq("id", roomId);
  return error ? { error: error.message } : { ok: true };
}

export async function setRoomOpen(roomId: string, isOpen: boolean): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
  const { error } = await supabase.from("rooms").update({ is_open: isOpen }).eq("id", roomId);
  return error ? { error: error.message } : { ok: true };
}

export async function updateRoom(
  roomId: string,
  fields: {
    name?: string;
    is_open?: boolean;
    is_public?: boolean;
    max_members?: number | null;
    allowed_games?: string[] | null;
  },
): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  if (fields.name !== undefined && !fields.name.trim()) return { error: "Nom vide" };
  const supabase = await createClient();
  const { error } = await supabase.from("rooms").update(fields).eq("id", roomId);
  return error ? { error: error.message } : { ok: true };
}

// ── Configuration jeux ────────────────────────────────────────────────────

export async function updateGameSetting(
  gameType: string,
  field: "is_active" | "win_pts" | "draw_pts" | "loss_pts",
  value: boolean | number,
): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
  const { error } = await supabase.from("game_settings").update({ [field]: value }).eq("game_type", gameType);
  return error ? { error: error.message } : { ok: true };
}

// ── Avertissements (suite) ────────────────────────────────────────────────

export async function deleteWarning(id: string): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
  const { error } = await supabase.from("player_notifications").delete().eq("id", id);
  return error ? { error: error.message } : { ok: true };
}

export async function markWarningSeen(id: string): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
  const { error } = await supabase.from("player_notifications").update({ seen: true }).eq("id", id);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteAllWarningsForPlayer(playerId: string): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
  const { error } = await supabase.from("player_notifications").delete().eq("player_id", playerId);
  return error ? { error: error.message } : { ok: true };
}

// ── Présence ──────────────────────────────────────────────────────────────

export async function kickPresence(playerId: string): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
  const { error } = await supabase.from("presence").delete().eq("player_id", playerId);
  return error ? { error: error.message } : { ok: true };
}

// ── Parties (force end) ───────────────────────────────────────────────────

export async function forceEndGame(
  gameId: string,
  winnerId: string | null,
): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("games")
    .update({ status: "finished", winner_id: winnerId })
    .eq("id", gameId);
  if (error) return { error: error.message };

  // Recalculate leaderboard for both players
  const { data: game } = await supabase
    .from("games")
    .select("challenge_id, challenges(challenger_id, challenged_id)")
    .eq("id", gameId)
    .single();

  type ChallengeShape = { challenger_id: string; challenged_id: string };
  const ch = game?.challenges as ChallengeShape | ChallengeShape[] | null | undefined;
  const challenge = Array.isArray(ch) ? ch[0] : ch;
  if (challenge) {
    await Promise.all([
      recalculateLeaderboard(supabase, challenge.challenger_id),
      recalculateLeaderboard(supabase, challenge.challenged_id),
    ]);
  }
  return { ok: true };
}

export async function deleteGame(gameId: string): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
  const { error } = await supabase.from("games").delete().eq("id", gameId);
  return error ? { error: error.message } : { ok: true };
}

// ── Challenges ────────────────────────────────────────────────────────────

export async function cancelChallenge(challengeId: string): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("challenges")
    .update({ status: "cancelled" })
    .eq("id", challengeId);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteChallenge(challengeId: string): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
  const { error } = await supabase.from("challenges").delete().eq("id", challengeId);
  return error ? { error: error.message } : { ok: true };
}

// ── Actions massives ──────────────────────────────────────────────────────

export async function deleteAllSpamContacts(): Promise<{ ok: boolean; count: number } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("contacts")
    .delete({ count: "exact" })
    .eq("status", "spam");
  if (error) return { error: error.message };
  return { ok: true, count: count ?? 0 };
}

export async function clearAllPresence(): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
  const { error } = await supabase.from("presence").delete().neq("player_id", "00000000-0000-0000-0000-000000000000");
  return error ? { error: error.message } : { ok: true };
}

// ── Logout ────────────────────────────────────────────────────────────────

export async function adminLogout(): Promise<void> {
  const store = await cookies();
  store.delete("ea_admin");
}
