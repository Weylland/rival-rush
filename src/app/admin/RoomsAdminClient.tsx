"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { deleteRoom, setRoomOpen } from "./actions";

interface RoomEntry {
  id: string;
  name: string;
  code: string;
  host_id: string;
  host_pseudo: string;
  is_open: boolean;
  is_public: boolean;
  memberCount: number;
  created_at: string;
  allowed_games: string[] | null;
  max_members: number | null;
}

interface Member {
  player_id: string;
  pseudo: string;
  joined_at: string;
}

const GAME_LABELS: Record<string, string> = {
  pfc: "PFC",
  morpion: "Morpion",
  puissance4: "P4",
  reflexe: "Réflexe",
  naval: "Naval",
  chess: "Échecs",
  nim: "Nim",
  pig: "Pig",
  mastermind: "Mastermind",
  "plus-ou-moins": "±",
  "duel-des": "Dés",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

export function RoomsAdminClient() {
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedMembers, setExpandedMembers] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, Member[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data: rawRooms } = await supabase
      .from("rooms")
      .select(
        "id, name, code, host_id, is_open, is_public, created_at, allowed_games, max_members",
      )
      .order("created_at", { ascending: false });

    if (!rawRooms || rawRooms.length === 0) {
      setRooms([]);
      setLoading(false);
      return;
    }

    const hostIds = [...new Set(rawRooms.map((r) => r.host_id as string))];
    const roomIds = rawRooms.map((r) => r.id as string);

    const [{ data: players }, { data: memberRows }] = await Promise.all([
      supabase.from("players").select("id, pseudo").in("id", hostIds),
      supabase
        .from("room_members")
        .select("room_id")
        .in("room_id", roomIds),
    ]);

    const pseudoMap = Object.fromEntries(
      (players ?? []).map((p) => [p.id, p.pseudo as string]),
    );
    const countMap: Record<string, number> = {};
    for (const m of memberRows ?? []) {
      const rid = m.room_id as string;
      countMap[rid] = (countMap[rid] ?? 0) + 1;
    }

    setRooms(
      rawRooms.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        code: r.code as string,
        host_id: r.host_id as string,
        host_pseudo: pseudoMap[r.host_id as string] ?? "?",
        is_open: r.is_open as boolean,
        is_public: r.is_public as boolean,
        memberCount: countMap[r.id as string] ?? 0,
        created_at: r.created_at as string,
        allowed_games: r.allowed_games as string[] | null,
        max_members: r.max_members as number | null,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMembers(roomId: string) {
    if (members[roomId]) {
      setExpandedMembers(expandedMembers === roomId ? null : roomId);
      return;
    }
    const supabase = createClient();
    const { data: roomMembers } = await supabase
      .from("room_members")
      .select("player_id, joined_at")
      .eq("room_id", roomId)
      .order("joined_at");

    if (!roomMembers || roomMembers.length === 0) {
      setMembers((prev) => ({ ...prev, [roomId]: [] }));
      setExpandedMembers(roomId);
      return;
    }

    const pids = roomMembers.map((m) => m.player_id as string);
    const { data: players } = await supabase
      .from("players")
      .select("id, pseudo")
      .in("id", pids);
    const pseudoMap = Object.fromEntries(
      (players ?? []).map((p) => [p.id, p.pseudo as string]),
    );

    setMembers((prev) => ({
      ...prev,
      [roomId]: roomMembers.map((m) => ({
        player_id: m.player_id as string,
        pseudo: pseudoMap[m.player_id as string] ?? "?",
        joined_at: m.joined_at as string,
      })),
    }));
    setExpandedMembers(roomId);
  }

  function handleToggleOpen(roomId: string, current: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await setRoomOpen(roomId, !current);
      if ("error" in res) setError(res.error);
      else
        setRooms((prev) =>
          prev.map((r) => (r.id === roomId ? { ...r, is_open: !current } : r)),
        );
    });
  }

  function handleDelete(roomId: string) {
    setError(null);
    startTransition(async () => {
      const res = await deleteRoom(roomId);
      if ("error" in res) setError(res.error);
      else {
        setRooms((prev) => prev.filter((r) => r.id !== roomId));
        setConfirmDelete(null);
        if (expandedMembers === roomId) setExpandedMembers(null);
      }
    });
  }

  const filtered = search.trim()
    ? rooms.filter(
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.code.toLowerCase().includes(search.toLowerCase()) ||
          r.host_pseudo.toLowerCase().includes(search.toLowerCase()),
      )
    : rooms;

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
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
          {rooms.length} salle{rooms.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={load}
          disabled={loading || pending}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            fontWeight: 800,
            color: "rgba(255,255,255,0.5)",
            background: "rgba(255,255,255,0.06)",
            border: `1.5px solid rgba(255,255,255,0.12)`,
            borderRadius: 999,
            padding: "5px 12px",
            cursor: "pointer",
          }}
        >
          ↻ Rafraîchir
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher par nom, code, hôte…"
        style={{
          width: "100%",
          boxSizing: "border-box",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 700,
          color: EA.white,
          background: "rgba(255,255,255,0.06)",
          border: `2px solid rgba(255,255,255,0.15)`,
          borderRadius: 10,
          padding: "10px 14px",
          outline: "none",
          marginBottom: 12,
        }}
      />

      {error && (
        <div
          style={{
            background: "rgba(255,30,140,0.12)",
            border: `2px solid ${EA.pink}`,
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 12,
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 800,
            color: EA.pink,
          }}
        >
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            color: "rgba(255,255,255,0.3)",
            textAlign: "center",
            padding: "40px 0",
          }}
        >
          Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            color: "rgba(255,255,255,0.3)",
            textAlign: "center",
            padding: "40px 0",
          }}
        >
          Aucune salle
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((room) => (
            <div
              key={room.id}
              style={{
                background: EA.violetDeep,
                border: `2.5px solid ${EA.ink}`,
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: `2px 2px 0 ${EA.ink}`,
              }}
            >
              {/* Main row */}
              <div style={{ padding: "14px 16px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 16,
                          color: EA.white,
                        }}
                      >
                        {room.name}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: 11,
                          fontWeight: 900,
                          color: EA.cyan,
                          background: "rgba(0,212,232,0.12)",
                          borderRadius: 999,
                          padding: "2px 8px",
                        }}
                      >
                        #{room.code}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: 10,
                          fontWeight: 900,
                          color: room.is_open ? "#4ade80" : EA.pink,
                          background: room.is_open
                            ? "rgba(74,222,128,0.12)"
                            : "rgba(255,30,140,0.12)",
                          border: `1.5px solid ${room.is_open ? "#4ade80" : EA.pink}`,
                          borderRadius: 999,
                          padding: "2px 8px",
                          textTransform: "uppercase",
                        }}
                      >
                        {room.is_open ? "Ouverte" : "Fermée"}
                      </span>
                      {!room.is_public && (
                        <span
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 10,
                            fontWeight: 900,
                            color: EA.butter,
                            background: "rgba(255,233,74,0.1)",
                            border: `1.5px solid ${EA.butter}`,
                            borderRadius: 999,
                            padding: "2px 8px",
                            textTransform: "uppercase",
                          }}
                        >
                          🔒 Privée
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "rgba(255,255,255,0.4)",
                        marginTop: 4,
                      }}
                    >
                      Hôte: {room.host_pseudo} ·{" "}
                      <button
                        onClick={() => loadMembers(room.id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: EA.cyan,
                          cursor: "pointer",
                          fontFamily: "var(--font-sans)",
                          fontSize: 12,
                          fontWeight: 800,
                          padding: 0,
                          textDecoration: "underline",
                        }}
                      >
                        {room.memberCount} membre
                        {room.memberCount !== 1 ? "s" : ""}
                        {room.max_members ? ` / ${room.max_members}` : ""}
                      </button>{" "}
                      · {formatDate(room.created_at)}
                    </div>
                    {room.allowed_games && room.allowed_games.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          gap: 4,
                          flexWrap: "wrap",
                          marginTop: 6,
                        }}
                      >
                        {room.allowed_games.map((g) => (
                          <span
                            key={g}
                            style={{
                              fontFamily: "var(--font-sans)",
                              fontSize: 10,
                              fontWeight: 800,
                              color: "rgba(255,255,255,0.5)",
                              background: "rgba(255,255,255,0.06)",
                              border: "1.5px solid rgba(255,255,255,0.1)",
                              borderRadius: 999,
                              padding: "1px 7px",
                            }}
                          >
                            {GAME_LABELS[g] ?? g}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexShrink: 0,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      onClick={() => handleToggleOpen(room.id, room.is_open)}
                      disabled={pending}
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 12,
                        fontWeight: 800,
                        color: room.is_open ? EA.pink : "#4ade80",
                        background: room.is_open
                          ? "rgba(255,30,140,0.1)"
                          : "rgba(74,222,128,0.1)",
                        border: `2px solid ${room.is_open ? EA.pink : "#4ade80"}`,
                        borderRadius: 999,
                        padding: "7px 14px",
                        cursor: pending ? "wait" : "pointer",
                        opacity: pending ? 0.6 : 1,
                      }}
                    >
                      {room.is_open ? "🔒 Fermer" : "🔓 Ouvrir"}
                    </button>

                    {confirmDelete === room.id ? (
                      <>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          disabled={pending}
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: 12,
                            background: "rgba(255,255,255,0.1)",
                            border: `2px solid ${EA.ink}`,
                            borderRadius: 999,
                            padding: "7px 14px",
                            color: EA.white,
                            cursor: "pointer",
                          }}
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => handleDelete(room.id)}
                          disabled={pending}
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: 12,
                            background: EA.pink,
                            border: `2px solid ${EA.ink}`,
                            borderRadius: 999,
                            padding: "7px 14px",
                            color: EA.white,
                            cursor: pending ? "wait" : "pointer",
                            boxShadow: `2px 2px 0 ${EA.ink}`,
                          }}
                        >
                          Supprimer
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(room.id)}
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 13,
                          background: "rgba(255,30,140,0.1)",
                          border: `2px solid ${EA.pink}`,
                          borderRadius: 999,
                          padding: "7px 14px",
                          color: EA.pink,
                          cursor: "pointer",
                        }}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Members list (expanded) */}
              {expandedMembers === room.id && (
                <div
                  style={{
                    borderTop: `1.5px solid rgba(255,255,255,0.08)`,
                    padding: "10px 16px",
                    background: "rgba(0,0,0,0.2)",
                  }}
                >
                  {(members[room.id] ?? []).length === 0 ? (
                    <div
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 12,
                        color: "rgba(255,255,255,0.3)",
                      }}
                    >
                      Aucun membre
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      {(members[room.id] ?? []).map((m) => (
                        <span
                          key={m.player_id}
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 12,
                            fontWeight: 800,
                            color: EA.white,
                            background: "rgba(255,255,255,0.08)",
                            border: `1.5px solid rgba(255,255,255,0.15)`,
                            borderRadius: 999,
                            padding: "4px 12px",
                          }}
                          title={`Rejoint le ${new Date(m.joined_at).toLocaleDateString("fr-FR")}`}
                        >
                          {m.player_id === rooms.find((r) => r.id === room.id)?.host_id ? "👑 " : ""}
                          {m.pseudo}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
