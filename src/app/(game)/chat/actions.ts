"use server";

import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function sendLobbyMessage(content: string) {
  const session = await getSession();
  if (!session) return { error: "Non connecté" };

  const trimmed = content.trim().slice(0, 300);
  if (!trimmed) return { error: "Message vide" };

  const admin = createAdminClient();
  const { error } = await admin.from("lobby_chat").insert({
    player_id: session.playerId,
    pseudo: session.pseudo,
    content: trimmed,
  });

  if (error) return { error: error.message };

  // Garde les 200 derniers messages
  await admin
    .from("lobby_chat")
    .delete()
    .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  return { ok: true };
}

export async function getOrCreateConversation(recipientId: string) {
  const session = await getSession();
  if (!session) return { error: "Non connecté" };

  const supabase = await createClient();
  const admin = createAdminClient();
  const myId = session.playerId;

  if (myId === recipientId) return { error: "Impossible de se DM soi-même" };

  const p1 = myId < recipientId ? myId : recipientId;
  const p2 = myId < recipientId ? recipientId : myId;

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("p1_id", p1)
    .eq("p2_id", p2)
    .maybeSingle();

  if (existing) return { conversationId: existing.id };

  const { data: created, error } = await admin
    .from("conversations")
    .insert({ p1_id: p1, p2_id: p2 })
    .select("id")
    .single();

  if (error || !created) return { error: error?.message ?? "Impossible de créer la conversation" };
  return { conversationId: created.id };
}

export async function sendDirectMessage(conversationId: string, content: string) {
  const session = await getSession();
  if (!session) return { error: "Non connecté" };

  const trimmed = content.trim().slice(0, 500);
  if (!trimmed) return { error: "Message vide" };

  const admin = createAdminClient();
  const { error } = await admin.from("direct_messages").insert({
    conversation_id: conversationId,
    sender_id: session.playerId,
    pseudo: session.pseudo,
    content: trimmed,
  });

  if (error) return { error: error.message };
  return { ok: true };
}

export async function markConversationRead(conversationId: string) {
  const session = await getSession();
  if (!session) return;

  const admin = createAdminClient();
  await admin.from("conversation_reads").upsert(
    { conversation_id: conversationId, player_id: session.playerId, read_at: new Date().toISOString() },
    { onConflict: "conversation_id,player_id" },
  );
}
