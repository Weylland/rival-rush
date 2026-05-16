import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SessionPayload {
  playerId: string;
  pseudo: string;
  avatarUrl: string | null;
  isGuest: boolean;
}

/**
 * Récupère la session courante côté serveur.
 * Retourne null si non connecté.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) return null;

  const admin = createAdminClient();
  const { data: player } = await admin
    .from("players")
    .select("pseudo, avatar_url, is_guest")
    .eq("id", user.id)
    .maybeSingle();

  if (!player) return null;

  return {
    playerId: user.id,
    pseudo: player.pseudo as string,
    avatarUrl: (player.avatar_url as string | null) ?? null,
    isGuest: (player.is_guest as boolean) ?? false,
  };
}

/**
 * Vérifie si l'utilisateur connecté est admin.
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const admin = createAdminClient();
  const { data } = await admin
    .from("admins")
    .select("player_id")
    .eq("player_id", user.id)
    .maybeSingle();

  return !!data;
}

/**
 * Met à jour le pseudo ou l'avatar dans public.players.
 */
export async function updateProfile(
  updates: { pseudo?: string; avatar_url?: string | null },
) {
  const session = await getSession();
  if (!session) throw new Error("Non connecté");

  const admin = createAdminClient();
  const { error } = await admin
    .from("players")
    .update(updates)
    .eq("id", session.playerId);

  if (error) throw new Error(error.message);
}
