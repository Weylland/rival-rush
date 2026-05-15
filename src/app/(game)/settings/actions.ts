"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession, setSession, clearSession, verifyPassword, hashPassword } from "@/lib/auth";

export type SettingsState = { error?: string; success?: string } | null;

export async function updatePseudo(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const newPseudo = (formData.get("pseudo") as string)?.trim();
  if (!newPseudo || newPseudo.length < 2) return { error: "Pseudo trop court (min 2 caractères)" };
  if (newPseudo === session.pseudo) return { error: "C'est déjà ton pseudo 😄" };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("players")
    .select("id")
    .eq("pseudo", newPseudo)
    .maybeSingle();

  if (existing) return { error: "Ce pseudo est déjà pris" };

  const { error } = await supabase
    .from("players")
    .update({ pseudo: newPseudo })
    .eq("id", session.playerId);

  if (error) return { error: "Erreur lors de la mise à jour" };

  await supabase.from("presence").update({ pseudo: newPseudo }).eq("player_id", session.playerId);
  await setSession(session.playerId, newPseudo);

  return { success: "Pseudo mis à jour !" };
}

export async function updatePassword(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const currentPassword = formData.get("current_password") as string;
  const newPassword = formData.get("new_password") as string;

  if (!currentPassword || !newPassword) return { error: "Remplis tous les champs" };
  if (newPassword.length < 4) return { error: "Nouveau mot de passe trop court (min 4 caractères)" };

  const supabase = await createClient();

  const { data: player } = await supabase
    .from("players")
    .select("password")
    .eq("id", session.playerId)
    .single();

  if (!player) return { error: "Joueur introuvable" };

  const valid = await verifyPassword(currentPassword, player.password);
  if (!valid) return { error: "Mot de passe actuel incorrect" };

  const hashed = await hashPassword(newPassword);
  const { error } = await supabase.from("players").update({ password: hashed }).eq("id", session.playerId);
  if (error) return { error: "Erreur lors de la mise à jour" };

  return { success: "Mot de passe mis à jour !" };
}

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

    for (const g of games ?? []) {
      if (g.winner_id === null) draws++;
      else if (g.winner_id === playerId) wins++;
      else losses++;
    }
  }

  const points = wins * 3 + draws * 1;
  await supabase.from("leaderboard").upsert({ player_id: playerId, wins, losses, draws, points });
}

export async function deleteAccount(): Promise<SettingsState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();
  const { playerId } = session;

  const { data: activeChallenges } = await supabase
    .from("challenges")
    .select("id, challenger_id, challenged_id")
    .or(`challenger_id.eq.${playerId},challenged_id.eq.${playerId}`)
    .eq("status", "accepted");

  if (activeChallenges && activeChallenges.length > 0) {
    const activeIds = activeChallenges.map((c) => c.id);
    const { data: activeGames } = await supabase
      .from("games").select("id")
      .in("challenge_id", activeIds).eq("status", "playing");

    for (const game of activeGames ?? []) {
      const challenge = activeChallenges.find((c) => activeIds.includes(c.id));
      if (!challenge) continue;
      const winnerId = challenge.challenger_id === playerId ? challenge.challenged_id : challenge.challenger_id;
      await supabase.from("games").update({ status: "finished", winner_id: winnerId }).eq("id", game.id);
    }
  }

  const { data: allChallenges } = await supabase
    .from("challenges")
    .select("id, challenger_id, challenged_id")
    .or(`challenger_id.eq.${playerId},challenged_id.eq.${playerId}`);

  const challengeIds = (allChallenges ?? []).map((c) => c.id);
  const opponentIds = new Set<string>();
  for (const c of allChallenges ?? []) {
    opponentIds.add(c.challenger_id === playerId ? c.challenged_id : c.challenger_id);
  }

  if (challengeIds.length > 0) {
    // Delete game secrets for all games of this player
    const { data: gameRows } = await supabase.from("games").select("id").in("challenge_id", challengeIds);
    const gameIds = (gameRows ?? []).map(g => g.id);
    if (gameIds.length > 0) {
      await supabase.from("game_secrets").delete().in("game_id", gameIds);
    }
    const { error: gErr } = await supabase.from("games").delete().in("challenge_id", challengeIds);
    if (gErr) return { error: `Erreur: ${gErr.message}` };
    const { error: cErr } = await supabase.from("challenges").delete().in("id", challengeIds);
    if (cErr) return { error: `Erreur: ${cErr.message}` };
  }

  for (const opId of opponentIds) {
    await recalculateLeaderboard(supabase, opId);
  }

  // Delete chat messages (lobby + rooms)
  await supabase.from("lobby_chat").delete().eq("player_id", playerId);
  await supabase.from("room_chat").delete().eq("player_id", playerId);

  // Delete direct messages and conversations
  const { data: convs } = await supabase
    .from("conversations")
    .select("id")
    .or(`p1_id.eq.${playerId},p2_id.eq.${playerId}`);
  const convIds = (convs ?? []).map(c => c.id);
  if (convIds.length > 0) {
    await supabase.from("direct_messages").delete().in("conversation_id", convIds);
    await supabase.from("conversation_reads").delete().in("conversation_id", convIds);
    await supabase.from("conversations").delete().or(`p1_id.eq.${playerId},p2_id.eq.${playerId}`);
  }

  // Delete blocks and reports initiated by this player
  await supabase.from("blocks").delete().or(`blocker_id.eq.${playerId},blocked_id.eq.${playerId}`);
  await supabase.from("reports").delete().eq("reporter_id", playerId);

  // Delete room memberships and push subscriptions
  await supabase.from("room_members").delete().eq("player_id", playerId);
  await supabase.from("push_subscriptions").delete().eq("player_id", playerId);

  await supabase.from("leaderboard").delete().eq("player_id", playerId);
  await supabase.from("presence").delete().eq("player_id", playerId);
  const { error: pErr } = await supabase.from("players").delete().eq("id", playerId);
  if (pErr) return { error: `Erreur: ${pErr.message}` };

  await clearSession();
  redirect("/login");
}
