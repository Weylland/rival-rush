"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { RR } from "@/lib/design";
import {
  deleteLobbyChatMessage,
  deleteLobbyChatByPlayer,
  deleteRoomChatMessage,
  deleteRoomChatByPlayer,
  deleteDMMessage,
  deleteConversation,
} from "./actions";

// ── Shared types ───────────────────────────────────────────────────────────

interface LobbyChatMsg {
  id: string;
  player_id: string;
  pseudo: string;
  content: string;
  created_at: string;
}

interface RoomChatMsg {
  id: string;
  room_id: string;
  player_id: string;
  pseudo: string;
  content: string;
  created_at: string;
}

interface Room {
  id: string;
  name: string;
  code: string;
}

interface Conversation {
  id: string;
  p1_id: string;
  p2_id: string;
  p1_pseudo: string;
  p2_pseudo: string;
  messageCount: number;
  lastMessage?: string;
  lastAt?: string;
}

interface DMMsg {
  id: string;
  sender_id: string;
  pseudo: string;
  content: string;
  created_at: string;
}

// ── Shared styles ──────────────────────────────────────────────────────────

const msgCardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: `1.5px solid rgba(255,255,255,0.1)`,
  borderRadius: 10,
  padding: "10px 14px",
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
};

const deleteBtnStyle: React.CSSProperties = {
  background: "rgba(255,30,140,0.1)",
  border: `1.5px solid ${RR.pink}`,
  borderRadius: 8,
  padding: "4px 10px",
  fontSize: 13,
  cursor: "pointer",
  flexShrink: 0,
  color: RR.pink,
  lineHeight: 1.4,
};

const deleteBulkBtnStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: 12,
  fontWeight: 800,
  color: RR.pink,
  background: "rgba(255,30,140,0.08)",
  border: `2px solid ${RR.pink}`,
  borderRadius: 999,
  padding: "6px 14px",
  cursor: "pointer",
};

const refreshBtnStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: 11,
  fontWeight: 800,
  color: "rgba(255,255,255,0.5)",
  background: "rgba(255,255,255,0.06)",
  border: `1.5px solid rgba(255,255,255,0.12)`,
  borderRadius: 999,
  padding: "5px 12px",
  cursor: "pointer",
};

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  fontWeight: 700,
  color: RR.white,
  background: "rgba(255,255,255,0.06)",
  border: `2px solid rgba(255,255,255,0.15)`,
  borderRadius: 10,
  padding: "10px 14px",
  outline: "none",
  marginBottom: 12,
};

const errorStyle: React.CSSProperties = {
  background: "rgba(255,30,140,0.12)",
  border: `2px solid ${RR.pink}`,
  borderRadius: 10,
  padding: "10px 14px",
  marginBottom: 12,
  fontFamily: "var(--font-sans)",
  fontSize: 12,
  fontWeight: 800,
  color: RR.pink,
};

const emptyStyle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 16,
  color: "rgba(255,255,255,0.3)",
  textAlign: "center",
  padding: "40px 0",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        fontWeight: 800,
        color: "rgba(255,255,255,0.6)",
        background: "rgba(255,255,255,0.08)",
        border: `2px solid rgba(255,255,255,0.15)`,
        borderRadius: 999,
        padding: "7px 14px",
        cursor: "pointer",
        marginBottom: 16,
      }}
    >
      ← Retour
    </button>
  );
}

// ── Lobby Chat Tab ─────────────────────────────────────────────────────────

function LobbyTab() {
  const [messages, setMessages] = useState<LobbyChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("lobby_chat")
      .select("id, player_id, pseudo, content, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    setMessages((data as LobbyChatMsg[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleDeleteMessage(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await deleteLobbyChatMessage(id);
      if ("error" in res) setError(res.error);
      else setMessages((prev) => prev.filter((m) => m.id !== id));
    });
  }

  function handleDeleteByPlayer(playerId: string, pseudo: string) {
    if (!confirm(`Supprimer TOUS les messages de ${pseudo} dans le lobby ?`))
      return;
    setError(null);
    startTransition(async () => {
      const res = await deleteLobbyChatByPlayer(playerId);
      if ("error" in res) setError(res.error);
      else setMessages((prev) => prev.filter((m) => m.player_id !== playerId));
    });
  }

  const filtered = search.trim()
    ? messages.filter(
        (m) =>
          m.pseudo.toLowerCase().includes(search.toLowerCase()) ||
          m.content.toLowerCase().includes(search.toLowerCase()),
      )
    : messages;

  const playerCounts = filtered.reduce<
    Record<string, { pseudo: string; count: number }>
  >((acc, m) => {
    if (!acc[m.player_id]) acc[m.player_id] = { pseudo: m.pseudo, count: 0 };
    acc[m.player_id].count++;
    return acc;
  }, {});

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 700,
            color: "rgba(255,255,255,0.45)",
          }}
        >
          {messages.length} message{messages.length !== 1 ? "s" : ""} (300
          derniers)
        </span>
        <button onClick={load} disabled={loading} style={refreshBtnStyle}>
          ↻ Rafraîchir
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filtrer par joueur ou contenu…"
        style={searchInputStyle}
      />

      {search && Object.entries(playerCounts).length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          {Object.entries(playerCounts).map(([playerId, { pseudo, count }]) => (
            <button
              key={playerId}
              onClick={() => handleDeleteByPlayer(playerId, pseudo)}
              disabled={pending}
              style={deleteBulkBtnStyle}
            >
              🗑 Tout de {pseudo} ({count})
            </button>
          ))}
        </div>
      )}

      {error && <div style={errorStyle}>⚠ {error}</div>}

      {loading ? (
        <div style={emptyStyle}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div style={emptyStyle}>Aucun message</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {filtered.map((msg) => (
            <div key={msg.id} style={msgCardStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 13,
                    color: RR.cyan,
                  }}
                >
                  {msg.pseudo}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.3)",
                    marginLeft: 8,
                  }}
                >
                  {formatDate(msg.created_at)}
                </span>
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.75)",
                    marginTop: 3,
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                </div>
              </div>
              <button
                onClick={() => handleDeleteMessage(msg.id)}
                disabled={pending}
                style={deleteBtnStyle}
                title="Supprimer"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Room Chat Tab ──────────────────────────────────────────────────────────

function RoomsTab() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<RoomChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("rooms")
      .select("id, name, code")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRooms((data as Room[]) ?? []);
        setLoading(false);
      });
  }, []);

  async function selectRoom(room: Room) {
    setSelectedRoom(room);
    setLoadingMsgs(true);
    setError(null);
    setSearch("");
    const supabase = createClient();
    const { data } = await supabase
      .from("room_chat")
      .select("id, room_id, player_id, pseudo, content, created_at")
      .eq("room_id", room.id)
      .order("created_at", { ascending: false })
      .limit(300);
    setMessages((data as RoomChatMsg[]) ?? []);
    setLoadingMsgs(false);
  }

  function handleDeleteMessage(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await deleteRoomChatMessage(id);
      if ("error" in res) setError(res.error);
      else setMessages((prev) => prev.filter((m) => m.id !== id));
    });
  }

  function handleDeleteByPlayer(playerId: string, pseudo: string) {
    if (!selectedRoom) return;
    if (
      !confirm(
        `Supprimer TOUS les messages de ${pseudo} dans ${selectedRoom.name} ?`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await deleteRoomChatByPlayer(selectedRoom.id, playerId);
      if ("error" in res) setError(res.error);
      else
        setMessages((prev) => prev.filter((m) => m.player_id !== playerId));
    });
  }

  const filtered = search.trim()
    ? messages.filter(
        (m) =>
          m.pseudo.toLowerCase().includes(search.toLowerCase()) ||
          m.content.toLowerCase().includes(search.toLowerCase()),
      )
    : messages;

  const playerCounts = filtered.reduce<
    Record<string, { pseudo: string; count: number }>
  >((acc, m) => {
    if (!acc[m.player_id]) acc[m.player_id] = { pseudo: m.pseudo, count: 0 };
    acc[m.player_id].count++;
    return acc;
  }, {});

  if (loading) return <div style={emptyStyle}>Chargement des salles…</div>;

  if (!selectedRoom) {
    return (
      <div>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 700,
            color: "rgba(255,255,255,0.45)",
            marginBottom: 14,
          }}
        >
          {rooms.length} salle{rooms.length !== 1 ? "s" : ""} — sélectionnez
          pour voir le chat
        </div>
        {rooms.length === 0 ? (
          <div style={emptyStyle}>Aucune salle</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => selectRoom(room)}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: `2px solid ${RR.ink}`,
                  borderRadius: 12,
                  padding: "12px 16px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  textAlign: "left",
                  transition: "border-color .15s",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 15,
                    color: RR.white,
                  }}
                >
                  {room.name}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 11,
                    fontWeight: 900,
                    color: RR.cyan,
                    background: "rgba(0,212,232,0.12)",
                    borderRadius: 999,
                    padding: "2px 8px",
                  }}
                >
                  #{room.code}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontFamily: "var(--font-sans)",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.3)",
                  }}
                >
                  →
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <BackBtn
        onClick={() => {
          setSelectedRoom(null);
          setMessages([]);
          setSearch("");
        }}
      />

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            color: RR.white,
          }}
        >
          {selectedRoom.name}{" "}
          <span style={{ color: RR.cyan, fontSize: 13 }}>
            #{selectedRoom.code}
          </span>
        </span>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            fontWeight: 700,
            color: "rgba(255,255,255,0.4)",
          }}
        >
          {messages.length} message{messages.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => selectRoom(selectedRoom)}
          disabled={loadingMsgs}
          style={refreshBtnStyle}
        >
          ↻
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filtrer…"
        style={searchInputStyle}
      />

      {search && Object.entries(playerCounts).length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          {Object.entries(playerCounts).map(([playerId, { pseudo, count }]) => (
            <button
              key={playerId}
              onClick={() => handleDeleteByPlayer(playerId, pseudo)}
              disabled={pending}
              style={deleteBulkBtnStyle}
            >
              🗑 Tout de {pseudo} ({count})
            </button>
          ))}
        </div>
      )}

      {error && <div style={errorStyle}>⚠ {error}</div>}

      {loadingMsgs ? (
        <div style={emptyStyle}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div style={emptyStyle}>Aucun message</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {filtered.map((msg) => (
            <div key={msg.id} style={msgCardStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 13,
                    color: RR.cyan,
                  }}
                >
                  {msg.pseudo}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.3)",
                    marginLeft: 8,
                  }}
                >
                  {formatDate(msg.created_at)}
                </span>
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.75)",
                    marginTop: 3,
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                </div>
              </div>
              <button
                onClick={() => handleDeleteMessage(msg.id)}
                disabled={pending}
                style={deleteBtnStyle}
                title="Supprimer"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── DMs Tab ────────────────────────────────────────────────────────────────

function DMsTab() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DMMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("conversations")
      .select("id, p1_id, p2_id, created_at")
      .order("created_at", { ascending: false })
      .then(async ({ data: convs }) => {
        if (!convs || convs.length === 0) {
          setLoading(false);
          return;
        }
        const playerIds = [
          ...new Set(
            convs.flatMap((c) => [c.p1_id as string, c.p2_id as string]),
          ),
        ];
        const convIds = convs.map((c) => c.id as string);

        const [{ data: players }, { data: allMsgs }] = await Promise.all([
          supabase.from("players").select("id, pseudo").in("id", playerIds),
          supabase
            .from("direct_messages")
            .select("conversation_id, content, created_at")
            .in("conversation_id", convIds)
            .eq("deleted", false)
            .order("created_at", { ascending: false }),
        ]);

        const pseudoMap = Object.fromEntries(
          (players ?? []).map((p) => [p.id, p.pseudo as string]),
        );
        const countMap: Record<string, number> = {};
        const lastMap: Record<string, { content: string; created_at: string }> =
          {};
        for (const m of allMsgs ?? []) {
          const cid = m.conversation_id as string;
          if (!lastMap[cid])
            lastMap[cid] = {
              content: m.content as string,
              created_at: m.created_at as string,
            };
          countMap[cid] = (countMap[cid] ?? 0) + 1;
        }

        setConversations(
          convs.map((c) => ({
            id: c.id as string,
            p1_id: c.p1_id as string,
            p2_id: c.p2_id as string,
            p1_pseudo: pseudoMap[c.p1_id as string] ?? "?",
            p2_pseudo: pseudoMap[c.p2_id as string] ?? "?",
            messageCount: countMap[c.id as string] ?? 0,
            lastMessage: lastMap[c.id as string]?.content,
            lastAt: lastMap[c.id as string]?.created_at,
          })),
        );
        setLoading(false);
      });
  }, []);

  async function selectConversation(conv: Conversation) {
    setSelected(conv);
    setLoadingMsgs(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("direct_messages")
      .select("id, sender_id, pseudo, content, created_at")
      .eq("conversation_id", conv.id)
      .eq("deleted", false)
      .order("created_at", { ascending: false })
      .limit(300);
    setMessages((data as DMMsg[]) ?? []);
    setLoadingMsgs(false);
  }

  function handleDeleteMessage(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await deleteDMMessage(id);
      if ("error" in res) setError(res.error);
      else setMessages((prev) => prev.filter((m) => m.id !== id));
    });
  }

  function handleDeleteConversation(conv: Conversation) {
    if (
      !confirm(
        `Supprimer toute la conversation entre ${conv.p1_pseudo} et ${conv.p2_pseudo} ?`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await deleteConversation(conv.id);
      if ("error" in res) setError(res.error);
      else {
        setConversations((prev) => prev.filter((c) => c.id !== conv.id));
        if (selected?.id === conv.id) {
          setSelected(null);
          setMessages([]);
        }
      }
    });
  }

  if (loading) return <div style={emptyStyle}>Chargement…</div>;

  if (!selected) {
    return (
      <div>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 700,
            color: "rgba(255,255,255,0.45)",
            marginBottom: 14,
          }}
        >
          {conversations.length} conversation
          {conversations.length !== 1 ? "s" : ""}
        </div>
        {error && <div style={errorStyle}>⚠ {error}</div>}
        {conversations.length === 0 ? (
          <div style={emptyStyle}>Aucune conversation</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {conversations.map((conv) => (
              <div
                key={conv.id}
                style={{
                  ...msgCardStyle,
                  cursor: "default",
                  alignItems: "center",
                }}
              >
                <div
                  style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                  onClick={() => selectConversation(conv)}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 14,
                      color: RR.white,
                    }}
                  >
                    {conv.p1_pseudo}{" "}
                    <span style={{ color: "rgba(255,255,255,0.35)" }}>↔</span>{" "}
                    {conv.p2_pseudo}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.35)",
                      marginTop: 2,
                    }}
                  >
                    {conv.messageCount} msg
                    {conv.lastAt
                      ? ` · dernier ${formatDate(conv.lastAt)}`
                      : ""}
                  </div>
                  {conv.lastMessage && (
                    <div
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.4)",
                        marginTop: 3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {conv.lastMessage}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteConversation(conv)}
                  disabled={pending}
                  style={deleteBtnStyle}
                  title="Supprimer la conversation"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <BackBtn
        onClick={() => {
          setSelected(null);
          setMessages([]);
        }}
      />
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            color: RR.white,
          }}
        >
          {selected.p1_pseudo} ↔ {selected.p2_pseudo}
        </span>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            fontWeight: 700,
            color: "rgba(255,255,255,0.4)",
          }}
        >
          {messages.length} message{messages.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => handleDeleteConversation(selected)}
          disabled={pending}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 800,
            color: RR.pink,
            background: "rgba(255,30,140,0.1)",
            border: `2px solid ${RR.pink}`,
            borderRadius: 999,
            padding: "6px 14px",
            cursor: "pointer",
            marginLeft: "auto",
          }}
        >
          🗑 Supprimer la conv.
        </button>
      </div>

      {error && <div style={errorStyle}>⚠ {error}</div>}

      {loadingMsgs ? (
        <div style={emptyStyle}>Chargement…</div>
      ) : messages.length === 0 ? (
        <div style={emptyStyle}>Aucun message</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {messages.map((msg) => (
            <div key={msg.id} style={msgCardStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 13,
                    color: RR.cyan,
                  }}
                >
                  {msg.pseudo}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.3)",
                    marginLeft: 8,
                  }}
                >
                  {formatDate(msg.created_at)}
                </span>
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.75)",
                    marginTop: 3,
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                </div>
              </div>
              <button
                onClick={() => handleDeleteMessage(msg.id)}
                disabled={pending}
                style={deleteBtnStyle}
                title="Supprimer"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type ChatTab = "lobby" | "rooms" | "dms";

export function ChatAdminClient() {
  const [tab, setTab] = useState<ChatTab>("lobby");

  const tabs: { value: ChatTab; label: string }[] = [
    { value: "lobby", label: "💬 Lobby" },
    { value: "rooms", label: "🏠 Salles" },
    { value: "dms", label: "✉️ DMs" },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {tabs.map(({ value, label }) => {
          const active = tab === value;
          return (
            <button
              key={value}
              onClick={() => setTab(value)}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 13,
                color: active ? RR.violetDeep : "rgba(255,255,255,0.6)",
                background: active ? RR.cyan : "rgba(255,255,255,0.08)",
                border: `2px solid ${active ? RR.ink : "rgba(255,255,255,0.15)"}`,
                borderRadius: 999,
                padding: "8px 18px",
                cursor: active ? "default" : "pointer",
                boxShadow: active ? `2px 2px 0 ${RR.ink}` : "none",
                transition: "all .15s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ display: tab === "lobby" ? "block" : "none" }}>
        <LobbyTab />
      </div>
      <div style={{ display: tab === "rooms" ? "block" : "none" }}>
        <RoomsTab />
      </div>
      <div style={{ display: tab === "dms" ? "block" : "none" }}>
        <DMsTab />
      </div>
    </div>
  );
}
