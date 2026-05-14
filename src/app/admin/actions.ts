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
  const { error } = await supabase.from("direct_messages").delete().eq("id", messageId);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteConversation(conversationId: string): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
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

// ── Configuration jeux ────────────────────────────────────────────────────

export async function updateGameSetting(
  gameType: string,
  field: "is_active" | "win_pts" | "draw_pts",
  value: boolean | number,
): Promise<{ ok: boolean } | { error: string }> {
  if (!await isAdmin()) return { error: "Non autorisé" };
  const supabase = await createClient();
  const { error } = await supabase.from("game_settings").update({ [field]: value }).eq("game_type", gameType);
  return error ? { error: error.message } : { ok: true };
}
