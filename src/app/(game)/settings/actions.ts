"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { recalculatePlayerLeaderboard } from "@/lib/leaderboard";

export type SettingsState = { error?: string; success?: string } | null;

export async function updatePseudo(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const newPseudo = (formData.get("pseudo") as string)?.trim();
  if (!newPseudo || newPseudo.length < 2) return { error: "Pseudo trop court (min 2 caractères)" };
  if (newPseudo === session.pseudo) return { error: "C'est déjà ton pseudo 😄" };

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("players")
    .select("id")
    .eq("pseudo", newPseudo)
    .maybeSingle();

  if (existing) return { error: "Ce pseudo est déjà pris" };

  const { error } = await admin
    .from("players")
    .update({ pseudo: newPseudo })
    .eq("id", session.playerId);

  if (error) return { error: "Erreur lors de la mise à jour" };

  await admin.from("presence").update({ pseudo: newPseudo }).eq("player_id", session.playerId);

  return { success: "Pseudo mis à jour !" };
}

export async function updatePassword(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const newPassword = formData.get("new_password") as string;
  if (!newPassword) return { error: "Remplis tous les champs" };
  if (newPassword.length < 6) return { error: "Nouveau mot de passe trop court (min 6 caractères)" };

  // Supabase Auth gère la vérification du mot de passe actuel via reauthentication
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  return { success: "Mot de passe mis à jour !" };
}

export async function deleteAccount(): Promise<SettingsState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const admin = createAdminClient();
  const { playerId } = session;

  const { data: activeChallenges } = await admin
    .from("challenges")
    .select("id, challenger_id, challenged_id")
    .or(`challenger_id.eq.${playerId},challenged_id.eq.${playerId}`)
    .eq("status", "accepted");

  if (activeChallenges && activeChallenges.length > 0) {
    const activeIds = activeChallenges.map((c) => c.id);
    const { data: activeGames } = await admin
      .from("games").select("id, challenge_id")
      .in("challenge_id", activeIds).eq("status", "playing");

    for (const game of activeGames ?? []) {
      const challenge = activeChallenges.find((c) => c.id === game.challenge_id);
      if (!challenge) continue;
      const winnerId = challenge.challenger_id === playerId ? challenge.challenged_id : challenge.challenger_id;
      await admin.from("games").update({ status: "finished", winner_id: winnerId }).eq("id", game.id);
    }
  }

  const { data: allChallenges } = await admin
    .from("challenges")
    .select("id, challenger_id, challenged_id")
    .or(`challenger_id.eq.${playerId},challenged_id.eq.${playerId}`);

  const challengeIds = (allChallenges ?? []).map((c) => c.id);
  const opponentIds = new Set<string>();
  for (const c of allChallenges ?? []) {
    opponentIds.add(c.challenger_id === playerId ? c.challenged_id : c.challenger_id);
  }

  if (challengeIds.length > 0) {
    const { data: gameRows } = await admin.from("games").select("id").in("challenge_id", challengeIds);
    const gameIds = (gameRows ?? []).map((g) => g.id);
    if (gameIds.length > 0) await admin.from("game_secrets").delete().in("game_id", gameIds);
    const { error: gErr } = await admin.from("games").delete().in("challenge_id", challengeIds);
    if (gErr) return { error: `Erreur: ${gErr.message}` };
    const { error: cErr } = await admin.from("challenges").delete().in("id", challengeIds);
    if (cErr) return { error: `Erreur: ${cErr.message}` };
  }

  for (const opId of opponentIds) {
    await recalculatePlayerLeaderboard(admin, opId);
  }

  await admin.from("lobby_chat").delete().eq("player_id", playerId);
  await admin.from("room_chat").delete().eq("player_id", playerId);

  const { data: convs } = await admin
    .from("conversations").select("id")
    .or(`p1_id.eq.${playerId},p2_id.eq.${playerId}`);
  const convIds = (convs ?? []).map((c) => c.id);
  if (convIds.length > 0) {
    await admin.from("direct_messages").delete().in("conversation_id", convIds);
    await admin.from("conversation_reads").delete().in("conversation_id", convIds);
    await admin.from("conversations").delete().or(`p1_id.eq.${playerId},p2_id.eq.${playerId}`);
  }

  await admin.from("blocks").delete().or(`blocker_id.eq.${playerId},blocked_id.eq.${playerId}`);
  await admin.from("reports").delete().eq("reporter_id", playerId);
  await admin.from("room_members").delete().eq("player_id", playerId);
  await admin.from("push_subscriptions").delete().eq("player_id", playerId);
  await admin.from("leaderboard").delete().eq("player_id", playerId);
  await admin.from("presence").delete().eq("player_id", playerId);

  // Supprimer le compte Supabase Auth (cascade sur players)
  await admin.auth.admin.deleteUser(playerId);

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
