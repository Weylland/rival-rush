"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { initialChessState } from "@/lib/chess";
import { sendPushToSubscriptions } from "@/lib/push";
import type { GameType } from "@/types/database";
import { GAME_LABELS } from "@/lib/game-labels";

export async function sendChallenge(challengedId: string, gameType: GameType, timeControl?: number | null) {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();

  // Vérifie que la session pointe vers un joueur existant (session corrompue / compte supprimé)
  const { data: me } = await supabase
    .from("players")
    .select("id")
    .eq("id", session.playerId)
    .maybeSingle();

  if (!me) redirect("/login");

  // Check presence (block only if actively in-game)
  const { data: presence } = await supabase
    .from("presence")
    .select("status")
    .eq("player_id", challengedId)
    .maybeSingle();

  if (presence?.status === "in-game") {
    return { error: "Ce joueur est déjà en partie" };
  }

  const isOffline = !presence || presence.status === "offline";

  // Guard: no pending challenge already between these two players
  const { data: existing } = await supabase
    .from("challenges")
    .select("id")
    .eq("status", "pending")
    .or(
      `and(challenger_id.eq.${session.playerId},challenged_id.eq.${challengedId}),` +
      `and(challenger_id.eq.${challengedId},challenged_id.eq.${session.playerId})`
    )
    .maybeSingle();

  if (existing) return { error: "Un défi est déjà en cours avec ce joueur" };

  // expires_at: 2min online (chess gets a bit more think-time), 5min offline
  const expiresInMs = isOffline ? 5 * 60 * 1000 : 2 * 60 * 1000;
  const expiresAt = new Date(Date.now() + expiresInMs).toISOString();

  const admin = createAdminClient();
  const { data: challenge, error } = await admin
    .from("challenges")
    .insert({
      challenger_id: session.playerId,
      challenged_id: challengedId,
      game_type: gameType,
      status: "pending",
      expires_at: expiresAt,
      metadata: gameType === "chess" ? { timeControl: timeControl ?? null } : {},
    })
    .select()
    .single();

  if (error || !challenge) return { error: error?.message ?? "Impossible d'envoyer le défi" };

  // Send Web Push if player is offline (or as backup even if online)
  // admin requis : push_subscriptions n'a pas de policy SELECT publique
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("player_id", challengedId);

  if (subs && subs.length > 0) {
    const label = GAME_LABELS[gameType] ?? gameType;
    const duration = isOffline ? "5 minutes" : "2 minutes";
    await sendPushToSubscriptions(subs as { endpoint: string; p256dh: string; auth: string }[], {
      title: `⚔ Défi de ${session.pseudo} !`,
      body: `${session.pseudo} te défie sur ${label}. Tu as ${duration} pour accepter !`,
      tag: `challenge-${challenge.id}`,
      url: "/lobby",
    });
  }

  redirect(`/waiting?challenge_id=${challenge.id}`);
}

export async function cancelChallenge(challengeId: string) {
  const session = await getSession();
  if (!session) return;

  await createAdminClient()
    .from("challenges")
    .update({ status: "cancelled" })
    .eq("id", challengeId)
    .eq("challenger_id", session.playerId);
}

export async function acceptChallenge(challengeId: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();

  const { data: challenge } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .eq("challenged_id", session.playerId)
    .eq("status", "pending")
    .single();

  if (!challenge) return { error: "Défi introuvable" };
  const admin = createAdminClient();

  if (challenge.expires_at && new Date(challenge.expires_at) < new Date()) {
    await admin.from("challenges").update({ status: "cancelled" }).eq("id", challengeId);
    return { error: "Ce défi a expiré" };
  }

  await admin
    .from("challenges")
    .update({ status: "accepted" })
    .eq("id", challengeId);

  const p1 = challenge.challenger_id;
  const p2 = session.playerId;

  const initialState =
    challenge.game_type === "pfc"
      ? { rounds: [], scores: { [p1]: 0, [p2]: 0 } }
      : challenge.game_type === "puissance4"
        ? { board: Array(42).fill(null) }
        : challenge.game_type === "reflexe"
          ? { rounds: [], scores: { [p1]: 0, [p2]: 0 }, phase: "idle", signal_at: null, current_round: 1, ready: [] }
          : challenge.game_type === "naval"
            ? { fleets_placed: {}, shots: { [p1]: [], [p2]: [] }, sunk_ships: {} }
            : challenge.game_type === "chess"
              ? initialChessState((challenge.metadata as { timeControl?: number | null } | null)?.timeControl ?? null, p1, p2)
              : challenge.game_type === "nim"
                ? (() => { const pile = Math.floor(Math.random() * 11) + 15; return { pile, initial_pile: pile, last_taken: null, last_player_id: null }; })()
                : challenge.game_type === "pig"
                  ? { scores: { [p1]: 0, [p2]: 0 }, turn_total: 0, last_roll: null }
                  : challenge.game_type === "mastermind"
                    // code is server-only — stored in game_secrets on first guess, never in public state
                    ? { guesses: [] }
                    : challenge.game_type === "plus-ou-moins"
                      // secret is server-only — stored in game_secrets on first guess, never in public state
                      ? { range_min: 1, range_max: 100, guesses: [], scores: { [p1]: 0, [p2]: 0 }, current_round: 1 }
                      : challenge.game_type === "duel-des"
                        ? { rounds: [{ rolls: {}, winner_id: null }], scores: { [p1]: 0, [p2]: 0 }, current_round: 1 }
                        : { board: Array(9).fill(null), scores: { [p1]: 0, [p2]: 0 } };

  // Check if both players are in the same active room → tag game
  const now = new Date().toISOString();
  const { data: sharedRoom } = await supabase
    .from("room_members")
    .select("room_id, rooms(expires_at)")
    .eq("player_id", p1)
    .then(async ({ data }) => {
      if (!data) return { data: null };
      const roomIds = data.map(m => m.room_id as string);
      if (!roomIds.length) return { data: null };
      const { data: p2Memberships } = await supabase
        .from("room_members").select("room_id").eq("player_id", p2).in("room_id", roomIds);
      const shared = (p2Memberships ?? []).find(m => {
        const rm = data.find(d => d.room_id === m.room_id);
        const roomsField = rm?.rooms;
        const exp = (Array.isArray(roomsField) ? (roomsField[0] as unknown as { expires_at: string | null } | undefined)?.expires_at : (roomsField as unknown as { expires_at: string | null } | null)?.expires_at);
        return !exp || exp > now;
      });
      return { data: shared?.room_id ?? null };
    });

  const { data: game } = await admin
    .from("games")
    .insert({
      challenge_id: challengeId,
      game_type: challenge.game_type,
      state: initialState,
      current_turn: challenge.game_type === "naval" || challenge.game_type === "duel-des" ? null : challenge.challenger_id,
      status: "playing",
      ...(sharedRoom ? { room_id: sharedRoom } : {}),
    })
    .select()
    .single();

  if (!game) return { error: "Impossible de créer la partie" };

  redirect(`/play/${challenge.game_type}?game_id=${game.id}`);
}

export async function declineChallenge(challengeId: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  await createAdminClient()
    .from("challenges")
    .update({ status: "declined" })
    .eq("id", challengeId)
    .eq("challenged_id", session.playerId);
}

export async function blockPlayer(blockedId: string) {
  const session = await getSession();
  if (!session) return;
  await createAdminClient().from("blocks").upsert({ blocker_id: session.playerId, blocked_id: blockedId });
}

export async function unblockPlayer(blockedId: string) {
  const session = await getSession();
  if (!session) return;
  await createAdminClient().from("blocks").delete()
    .eq("blocker_id", session.playerId)
    .eq("blocked_id", blockedId);
}

export async function reportPlayer(reportedId: string, reason: string) {
  const session = await getSession();
  if (!session) return;
  await createAdminClient().from("reports").insert({
    reporter_id: session.playerId,
    reported_player_id: reportedId,
    message_content: reason.trim() || "Signalement depuis le lobby",
  });
}

export async function updatePresenceStatus(status: "online" | "in-game") {
  const session = await getSession();
  if (!session) return;

  const supabase = await createClient();
  await supabase.from("presence").upsert({
    player_id: session.playerId,
    pseudo: session.pseudo,
    status,
    updated_at: new Date().toISOString(),
  });
}
