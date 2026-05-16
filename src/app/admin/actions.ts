"use server";

import { isAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalculatePlayerLeaderboard } from "@/lib/leaderboard";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function guardAdmin() {
  if (!(await isAdmin())) throw new Error("Non autorisé");
}

function db() {
  return createAdminClient();
}

// ── Joueurs ───────────────────────────────────────────────────────────────────

export async function deletePlayer(playerId: string) {
  await guardAdmin();
  const supabase = db();

  // 1. Forfeit active games
  const { data: activeChallenges } = await supabase
    .from("challenges")
    .select("id, challenger_id, challenged_id")
    .or(`challenger_id.eq.${playerId},challenged_id.eq.${playerId}`)
    .eq("status", "accepted");

  if (activeChallenges && activeChallenges.length > 0) {
    const activeIds = activeChallenges.map((c) => c.id);
    const { data: activeGames } = await supabase
      .from("games")
      .select("id, challenge_id")
      .in("challenge_id", activeIds)
      .eq("status", "playing");

    for (const game of activeGames ?? []) {
      const challenge = activeChallenges.find((c) => c.id === game.challenge_id);
      if (!challenge) continue;
      const winnerId =
        challenge.challenger_id === playerId
          ? challenge.challenged_id
          : challenge.challenger_id;
      await supabase
        .from("games")
        .update({ status: "finished", winner_id: winnerId })
        .eq("id", game.id);
    }
  }

  // 2. Collect all challenges + opponents
  const { data: allChallenges } = await supabase
    .from("challenges")
    .select("id, challenger_id, challenged_id")
    .or(`challenger_id.eq.${playerId},challenged_id.eq.${playerId}`);

  const challengeIds = (allChallenges ?? []).map((c) => c.id);
  const opponentIds = new Set<string>();
  for (const c of allChallenges ?? []) {
    opponentIds.add(c.challenger_id === playerId ? c.challenged_id : c.challenger_id);
  }

  // 3. Delete game_secrets + games + challenges
  if (challengeIds.length > 0) {
    const { data: gameRows } = await supabase.from("games").select("id").in("challenge_id", challengeIds);
    const gameIds = (gameRows ?? []).map((g) => g.id);
    if (gameIds.length > 0) await supabase.from("game_secrets").delete().in("game_id", gameIds);
    const { error: gamesErr } = await supabase.from("games").delete().in("challenge_id", challengeIds);
    if (gamesErr) return { error: `Erreur suppression games: ${gamesErr.message}` };
    const { error: chalErr } = await supabase.from("challenges").delete().in("id", challengeIds);
    if (chalErr) return { error: `Erreur suppression challenges: ${chalErr.message}` };
  }

  // 4. Recalculate leaderboard for opponents
  for (const opId of opponentIds) {
    await recalculatePlayerLeaderboard(supabase, opId);
  }

  // 5. Chats
  await supabase.from("lobby_chat").delete().eq("player_id", playerId);
  await supabase.from("room_chat").delete().eq("player_id", playerId);

  // 6. DMs
  const { data: convs } = await supabase
    .from("conversations").select("id")
    .or(`p1_id.eq.${playerId},p2_id.eq.${playerId}`);
  const convIds = (convs ?? []).map((c) => c.id);
  if (convIds.length > 0) {
    await supabase.from("direct_messages").delete().in("conversation_id", convIds);
    await supabase.from("conversation_reads").delete().in("conversation_id", convIds);
    await supabase.from("conversations").delete().or(`p1_id.eq.${playerId},p2_id.eq.${playerId}`);
  }

  // 7. Misc
  await supabase.from("blocks").delete().or(`blocker_id.eq.${playerId},blocked_id.eq.${playerId}`);
  await supabase.from("reports").delete().eq("reporter_id", playerId);
  await supabase.from("room_members").delete().eq("player_id", playerId);
  await supabase.from("push_subscriptions").delete().eq("player_id", playerId);

  // 8. Player records
  await supabase.from("leaderboard").delete().eq("player_id", playerId);
  await supabase.from("presence").delete().eq("player_id", playerId);
  const { error: playerErr } = await supabase.from("players").delete().eq("id", playerId);
  if (playerErr) return { error: `Erreur suppression joueur: ${playerErr.message}` };

  // 9. Supprimer le compte Supabase Auth (cascade sur players via FK)
  const { error: authErr } = await supabase.auth.admin.deleteUser(playerId);
  if (authErr) return { error: `Erreur suppression auth: ${authErr.message}` };

  return { ok: true };
}

export async function resetPlayerPassword(playerId: string): Promise<{ tempPassword: string } | { error: string }> {
  await guardAdmin();

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const tempPassword = Array.from(
    { length: 8 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");

  const { error } = await db().auth.admin.updateUserById(playerId, {
    password: tempPassword,
  });
  if (error) return { error: error.message };

  return { tempPassword };
}

export async function updatePlayerPseudo(playerId: string, newPseudo: string): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const trimmed = newPseudo.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 20) return { error: "Pseudo invalide (2–20 caractères)" };
  const { error } = await db().from("players").update({ pseudo: trimmed }).eq("id", playerId);
  return error ? { error: error.message } : { ok: true };
}

export async function setPlayerStats(
  playerId: string,
  wins: number,
  losses: number,
  draws: number,
): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const points = wins * 3 + draws;
  const { error } = await db().from("leaderboard").upsert({ player_id: playerId, wins, losses, draws, points });
  return error ? { error: error.message } : { ok: true };
}

export async function sendPlayerWarning(playerId: string, message: string): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  if (!message.trim()) return { error: "Message vide" };
  const { error } = await db()
    .from("player_notifications")
    .insert({ player_id: playerId, type: "warning", message: message.trim() });
  return error ? { error: error.message } : { ok: true };
}

// ── Reports ───────────────────────────────────────────────────────────────────

export type ReportStatus = "new" | "reviewed" | "ignored";

export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const { error } = await db().from("reports").update({ status }).eq("id", reportId);
  return error ? { error: error.message } : { ok: true };
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export type ContactStatus = "new" | "in_progress" | "done" | "spam";

export async function deleteContact(contactId: string): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const { error } = await db().from("contacts").delete().eq("id", contactId);
  return error ? { error: error.message } : { ok: true };
}

export async function updateContactStatus(
  contactId: string,
  status: ContactStatus,
): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const { error } = await db().from("contacts").update({ status }).eq("id", contactId);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteAllSpamContacts(): Promise<{ ok: boolean; count: number } | { error: string }> {
  await guardAdmin();
  const { error, count } = await db()
    .from("contacts")
    .delete({ count: "exact" })
    .eq("status", "spam");
  return error ? { error: error.message } : { ok: true, count: count ?? 0 };
}

// ── Chats ─────────────────────────────────────────────────────────────────────

export async function deleteLobbyChatMessage(messageId: string): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const { error } = await db().from("lobby_chat").delete().eq("id", messageId);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteLobbyChatByPlayer(playerId: string): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const { error } = await db().from("lobby_chat").delete().eq("player_id", playerId);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteRoomChatMessage(messageId: string): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const { error } = await db().from("room_chat").delete().eq("id", messageId);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteRoomChatByPlayer(roomId: string, playerId: string): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const { error } = await db().from("room_chat").delete().eq("room_id", roomId).eq("player_id", playerId);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteDMMessage(messageId: string): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const { error } = await db().from("direct_messages").update({ deleted: true }).eq("id", messageId);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteConversation(conversationId: string): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  await db().from("direct_messages").update({ deleted: true }).eq("conversation_id", conversationId);
  const { error } = await db().from("conversations").delete().eq("id", conversationId);
  return error ? { error: error.message } : { ok: true };
}

// ── Salles ────────────────────────────────────────────────────────────────────

export async function deleteRoom(roomId: string): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const { error } = await db().from("rooms").delete().eq("id", roomId);
  return error ? { error: error.message } : { ok: true };
}

export async function setRoomOpen(roomId: string, isOpen: boolean): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const { error } = await db().from("rooms").update({ is_open: isOpen }).eq("id", roomId);
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
  await guardAdmin();
  if (fields.name !== undefined && !fields.name.trim()) return { error: "Nom vide" };
  const { error } = await db().from("rooms").update(fields).eq("id", roomId);
  return error ? { error: error.message } : { ok: true };
}

// ── Jeux ──────────────────────────────────────────────────────────────────────

export async function updateGameSetting(
  gameType: string,
  field: "is_active" | "win_pts" | "draw_pts" | "loss_pts",
  value: boolean | number,
): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const { error } = await db().from("game_settings").update({ [field]: value }).eq("game_type", gameType);
  return error ? { error: error.message } : { ok: true };
}

export async function forceEndGame(
  gameId: string,
  winnerId: string | null,
): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const supabase = db();
  const { error } = await supabase
    .from("games")
    .update({ status: "finished", winner_id: winnerId })
    .eq("id", gameId);
  if (error) return { error: error.message };

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
      recalculatePlayerLeaderboard(supabase, challenge.challenger_id),
      recalculatePlayerLeaderboard(supabase, challenge.challenged_id),
    ]);
  }
  return { ok: true };
}

export async function deleteGame(gameId: string): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const { error } = await db().from("games").delete().eq("id", gameId);
  return error ? { error: error.message } : { ok: true };
}

export async function cancelChallenge(challengeId: string): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const { error } = await db().from("challenges").update({ status: "cancelled" }).eq("id", challengeId);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteChallenge(challengeId: string): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const { error } = await db().from("challenges").delete().eq("id", challengeId);
  return error ? { error: error.message } : { ok: true };
}

// ── Avertissements ────────────────────────────────────────────────────────────

export async function deleteWarning(id: string): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const { error } = await db().from("player_notifications").delete().eq("id", id);
  return error ? { error: error.message } : { ok: true };
}

export async function markWarningSeen(id: string): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const { error } = await db().from("player_notifications").update({ seen: true }).eq("id", id);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteAllWarningsForPlayer(playerId: string): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const { error } = await db().from("player_notifications").delete().eq("player_id", playerId);
  return error ? { error: error.message } : { ok: true };
}

// ── Présence ──────────────────────────────────────────────────────────────────

export async function kickPresence(playerId: string): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const { error } = await db().from("presence").delete().eq("player_id", playerId);
  return error ? { error: error.message } : { ok: true };
}

export async function clearAllPresence(): Promise<{ ok: boolean } | { error: string }> {
  await guardAdmin();
  const { error } = await db()
    .from("presence")
    .delete()
    .neq("player_id", "00000000-0000-0000-0000-000000000000");
  return error ? { error: error.message } : { ok: true };
}
