"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hashPassword, verifyPassword, setSession, getSession, clearSession } from "@/lib/auth";

export type AuthState = { error: string } | null;

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const pseudo = (formData.get("pseudo") as string)?.trim();
  const password = formData.get("password") as string;

  if (!pseudo || !password) return { error: "Remplis tous les champs" };
  if (pseudo.length < 2) return { error: "Pseudo trop court (min 2 caractères)" };
  if (password.length < 4) return { error: "Mot de passe trop court (min 4 caractères)" };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("players")
    .select("id")
    .eq("pseudo", pseudo)
    .maybeSingle();

  if (existing) return { error: "Ce pseudo est déjà pris 😅" };

  const hashed = await hashPassword(password);

  const { data: player, error } = await supabase
    .from("players")
    .insert({ pseudo, password: hashed })
    .select()
    .single();

  if (error || !player) return { error: "Erreur lors de la création du compte" };

  await supabase.from("leaderboard").insert({ player_id: player.id });

  await setSession(player.id, player.pseudo);
  redirect("/lobby");
}

export async function logout() {
  const session = await getSession();
  if (!session) {
    await clearSession();
    redirect("/login");
  }

  const supabase = await createClient();

  // Forfeit any active games this player is in
  const { data: activeGames } = await supabase
    .from("games")
    .select("id, challenges(challenger_id, challenged_id)")
    .eq("status", "playing");

  for (const game of activeGames ?? []) {
    const challenge = game.challenges as unknown as { challenger_id: string; challenged_id: string };
    if (challenge.challenger_id !== session.playerId && challenge.challenged_id !== session.playerId) continue;
    const opponentId = session.playerId === challenge.challenger_id ? challenge.challenged_id : challenge.challenger_id;

    await supabase
      .from("games")
      .update({ status: "finished", winner_id: opponentId })
      .eq("id", game.id)
      .eq("status", "playing");

    for (const player_id of [opponentId, session.playerId]) {
      const isWinner = player_id === opponentId;
      const { data: existing } = await supabase
        .from("leaderboard")
        .select("*")
        .eq("player_id", player_id)
        .single();

      if (existing) {
        await supabase.from("leaderboard").update({
          wins: existing.wins + (isWinner ? 1 : 0),
          losses: existing.losses + (isWinner ? 0 : 1),
          points: existing.points + (isWinner ? 3 : 0),
        }).eq("player_id", player_id);
      } else {
        await supabase.from("leaderboard").insert({
          player_id,
          wins: isWinner ? 1 : 0,
          losses: isWinner ? 0 : 1,
          draws: 0,
          points: isWinner ? 3 : 0,
        });
      }
    }
  }

  // Remove presence and clear session
  await supabase.from("presence").delete().eq("player_id", session.playerId);
  await clearSession();

  redirect("/login");
}

export async function signin(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const pseudo = (formData.get("pseudo") as string)?.trim();
  const password = formData.get("password") as string;

  if (!pseudo || !password) return { error: "Remplis tous les champs" };

  const supabase = await createClient();

  const { data: player } = await supabase
    .from("players")
    .select("*")
    .eq("pseudo", pseudo)
    .maybeSingle();

  if (!player) return { error: "Pseudo introuvable" };

  const valid = await verifyPassword(password, player.password);
  if (!valid) return { error: "Mot de passe incorrect" };

  await setSession(player.id, player.pseudo);
  redirect("/lobby");
}
