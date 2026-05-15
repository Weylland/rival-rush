/**
 * game_secrets — table non publiée dans Supabase Realtime.
 * Stocke les données sensibles (ships Naval, code Mastermind, secret Plus-ou-Moins)
 * uniquement accessibles côté serveur via service role.
 */
import type { NavalShip } from "@/types/database";
import { createClient } from "@/lib/supabase/server";

export interface GameSecretsData {
  ships?: Record<string, NavalShip[]>;   // Naval: playerId → fleet
  code?: number[];                        // Mastermind: code secret [0-5]×4
  secret_rounds?: Record<string, number>; // Plus-ou-Moins: "round_1" → nombre
}

export async function readSecrets(gameId: string): Promise<GameSecretsData> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("game_secrets")
    .select("data")
    .eq("game_id", gameId)
    .maybeSingle();
  return (data?.data ?? {}) as GameSecretsData;
}

export async function writeSecrets(gameId: string, patch: Partial<GameSecretsData>): Promise<void> {
  const supabase = await createClient();
  const current = await readSecrets(gameId);
  await supabase.from("game_secrets").upsert({
    game_id: gameId,
    data: { ...current, ...patch },
  });
}
