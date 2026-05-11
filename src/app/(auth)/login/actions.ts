"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hashPassword, verifyPassword, setSession } from "@/lib/auth";

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
