"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { RR } from "@/lib/design";
import { forceEndGame, deleteGame } from "./actions";
import { GAME_LABELS } from "@/lib/game-labels";

interface Game {
  id: string;
  game_type: string;
  status: "waiting" | "playing" | "finished";
  winner_id: string | null;
  created_at: string;
  p1_id: string;
  p2_id: string;
  p1_pseudo: string;
  p2_pseudo: string;
  room_id: string | null;
  room_name?: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function GamesBrowserClient() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "playing" | "finished" | "waiting">(
    "playing",
  );
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: rawGames } = await supabase
      .from("games")
      .select(
        "id, game_type, status, winner_id, created_at, room_id, challenges(challenger_id, challenged_id), rooms(name)",
      )
      .order("created_at", { ascending: false })
      .limit(150);

    if (!rawGames || rawGames.length === 0) {
      setGames([]);
      setLoading(false);
      return;
    }

    type ChallengeShape = { challenger_id: string; challenged_id: string };
    type RoomShape = { name: string };
    type GameRow = {
      id: string;
      game_type: string;
      status: string;
      winner_id: string | null;
      created_at: string;
      room_id: string | null;
      challenges: ChallengeShape | ChallengeShape[] | null;
      rooms: RoomShape | RoomShape[] | null;
    };
    const rows = rawGames as unknown as GameRow[];

    const playerIds = new Set<string>();
    for (const g of rows) {
      const ch = Array.isArray(g.challenges) ? g.challenges[0] : g.challenges;
      if (ch) {
        playerIds.add(ch.challenger_id);
        playerIds.add(ch.challenged_id);
      }
    }

    const { data: players } = await supabase
      .from("players")
      .select("id, pseudo")
      .in("id", Array.from(playerIds));
    const pseudoMap = Object.fromEntries(
      (players ?? []).map((p) => [p.id, p.pseudo as string]),
    );

    setGames(
      rows
        .map((g) => {
          const ch = Array.isArray(g.challenges) ? g.challenges[0] : g.challenges;
          const rm = Array.isArray(g.rooms) ? g.rooms[0] : g.rooms;
          if (!ch) return null;
          return {
            id: g.id,
            game_type: g.game_type,
            status: g.status as Game["status"],
            winner_id: g.winner_id,
            created_at: g.created_at,
            p1_id: ch.challenger_id,
            p2_id: ch.challenged_id,
            p1_pseudo: pseudoMap[ch.challenger_id] ?? "?",
            p2_pseudo: pseudoMap[ch.challenged_id] ?? "?",
            room_id: g.room_id,
            room_name: rm?.name,
          } as Game;
        })
        .filter((g): g is Game => g !== null),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const supabase = createClient();
    const ch = supabase
      .channel("admin-games")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  function handleForceEnd(gameId: string, winnerId: string | null) {
    setError(null);
    startTransition(async () => {
      const res = await forceEndGame(gameId, winnerId);
      if ("error" in res) setError(res.error);
      else {
        load();
        setOpenMenu(null);
      }
    });
  }

  function handleDelete(gameId: string) {
    if (!confirm("Supprimer définitivement cette partie ?")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteGame(gameId);
      if ("error" in res) setError(res.error);
      else {
        setGames((prev) => prev.filter((g) => g.id !== gameId));
        setOpenMenu(null);
      }
    });
  }

  const counts = {
    all: games.length,
    playing: games.filter((g) => g.status === "playing").length,
    finished: games.filter((g) => g.status === "finished").length,
    waiting: games.filter((g) => g.status === "waiting").length,
  };

  const filtered = games
    .filter((g) => (filter === "all" ? true : g.status === filter))
    .filter((g) =>
      search.trim()
        ? g.p1_pseudo.toLowerCase().includes(search.toLowerCase()) ||
          g.p2_pseudo.toLowerCase().includes(search.toLowerCase()) ||
          g.game_type.toLowerCase().includes(search.toLowerCase())
        : true,
    );

  const filterTabs: { value: typeof filter; label: string; count: number; color: string }[] = [
    { value: "playing", label: "En cours", count: counts.playing, color: RR.cyan },
    { value: "waiting", label: "En attente", count: counts.waiting, color: RR.butter },
    { value: "finished", label: "Terminées", count: counts.finished, color: "rgba(255,255,255,0.5)" },
    { value: "all", label: "Toutes", count: counts.all, color: RR.violet },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        {filterTabs.map((t) => {
          const active = filter === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                fontWeight: 800,
                color: active ? RR.violetDeep : "rgba(255,255,255,0.6)",
                background: active ? t.color : "rgba(255,255,255,0.05)",
                border: active
                  ? `1.5px solid ${t.color}`
                  : "1.5px solid rgba(255,255,255,0.1)",
                borderRadius: 999,
                padding: "7px 14px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                transition: "all .15s",
              }}
            >
              {t.label}
              <span
                style={{
                  background: active ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.1)",
                  borderRadius: 999,
                  padding: "1px 7px",
                  fontSize: 10,
                  fontWeight: 900,
                }}
              >
                {t.count}
              </span>
            </button>
          );
        })}
        <button
          onClick={load}
          disabled={loading}
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            fontWeight: 800,
            color: "rgba(255,255,255,0.5)",
            background: "rgba(255,255,255,0.05)",
            border: "1.5px solid rgba(255,255,255,0.1)",
            borderRadius: 999,
            padding: "6px 12px",
            cursor: "pointer",
          }}
        >
          ↻
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filtrer par joueur ou jeu…"
        style={{
          width: "100%",
          boxSizing: "border-box",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 700,
          color: RR.white,
          background: "rgba(255,255,255,0.04)",
          border: `1.5px solid rgba(255,255,255,0.1)`,
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
            border: `2px solid ${RR.pink}`,
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 12,
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 800,
            color: RR.pink,
          }}
        >
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 0",
            color: "rgba(255,255,255,0.3)",
            fontFamily: "var(--font-display)",
          }}
        >
          Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 0",
            color: "rgba(255,255,255,0.3)",
            fontFamily: "var(--font-display)",
          }}
        >
          Aucune partie
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((g) => {
            const isPlaying = g.status === "playing";
            const isFinished = g.status === "finished";
            const winnerPseudo = g.winner_id
              ? g.winner_id === g.p1_id
                ? g.p1_pseudo
                : g.p2_pseudo
              : null;
            const statusColor = isPlaying
              ? RR.cyan
              : isFinished
                ? "rgba(255,255,255,0.4)"
                : RR.butter;
            return (
              <div
                key={g.id}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1.5px solid ${isPlaying ? "rgba(0,212,232,0.3)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 12,
                  padding: "12px 16px",
                  position: "relative",
                  boxShadow: isPlaying
                    ? `0 0 16px rgba(0,212,232,0.08)`
                    : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 10,
                      fontWeight: 900,
                      color: statusColor,
                      background: `${statusColor}15`,
                      border: `1.5px solid ${statusColor}40`,
                      borderRadius: 999,
                      padding: "3px 10px",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      flexShrink: 0,
                    }}
                  >
                    {isPlaying && (
                      <span
                        className="rr-admin-pulse-dot"
                        style={{
                          display: "inline-block",
                          width: 5,
                          height: 5,
                          borderRadius: 999,
                          background: statusColor,
                          marginRight: 5,
                          verticalAlign: "middle",
                        }}
                      />
                    )}
                    {g.status}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 11,
                      fontWeight: 900,
                      color: RR.butter,
                      background: "rgba(255,233,74,0.08)",
                      border: `1.5px solid ${RR.butter}40`,
                      borderRadius: 999,
                      padding: "3px 10px",
                      flexShrink: 0,
                    }}
                  >
                    {GAME_LABELS[g.game_type] ?? g.game_type}
                  </span>

                  <div
                    style={{
                      flex: 1,
                      minWidth: 200,
                      fontFamily: "var(--font-display)",
                      fontSize: 14,
                      color: RR.white,
                      transform: "skewX(-4deg)",
                    }}
                  >
                    {g.p1_pseudo}
                    {winnerPseudo === g.p1_pseudo && " 🏆"}
                    <span
                      style={{
                        color: "rgba(255,255,255,0.3)",
                        margin: "0 8px",
                      }}
                    >
                      vs
                    </span>
                    {g.p2_pseudo}
                    {winnerPseudo === g.p2_pseudo && " 🏆"}
                    {isFinished && !winnerPseudo && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontFamily: "var(--font-sans)",
                          fontSize: 11,
                          color: RR.butter,
                        }}
                      >
                        (égalité)
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.4)",
                      flexShrink: 0,
                    }}
                  >
                    {g.room_name ? `🏠 ${g.room_name} · ` : ""}
                    {formatDate(g.created_at)}
                  </div>

                  <button
                    onClick={() =>
                      setOpenMenu(openMenu === g.id ? null : g.id)
                    }
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.06)",
                      border: `1.5px solid rgba(255,255,255,0.1)`,
                      color: RR.white,
                      cursor: "pointer",
                      flexShrink: 0,
                      fontSize: 16,
                      lineHeight: 1,
                    }}
                  >
                    ⋯
                  </button>
                </div>

                {openMenu === g.id && (
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: `1.5px solid rgba(255,255,255,0.06)`,
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {!isFinished && (
                      <>
                        <button
                          onClick={() => handleForceEnd(g.id, g.p1_id)}
                          disabled={pending}
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 11,
                            fontWeight: 800,
                            color: "#4ade80",
                            background: "rgba(74,222,128,0.1)",
                            border: `1.5px solid #4ade8060`,
                            borderRadius: 999,
                            padding: "6px 12px",
                            cursor: "pointer",
                          }}
                        >
                          🏆 {g.p1_pseudo} gagne
                        </button>
                        <button
                          onClick={() => handleForceEnd(g.id, g.p2_id)}
                          disabled={pending}
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 11,
                            fontWeight: 800,
                            color: "#4ade80",
                            background: "rgba(74,222,128,0.1)",
                            border: `1.5px solid #4ade8060`,
                            borderRadius: 999,
                            padding: "6px 12px",
                            cursor: "pointer",
                          }}
                        >
                          🏆 {g.p2_pseudo} gagne
                        </button>
                        <button
                          onClick={() => handleForceEnd(g.id, null)}
                          disabled={pending}
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 11,
                            fontWeight: 800,
                            color: RR.butter,
                            background: "rgba(255,233,74,0.1)",
                            border: `1.5px solid ${RR.butter}`,
                            borderRadius: 999,
                            padding: "6px 12px",
                            cursor: "pointer",
                          }}
                        >
                          🤝 Égalité
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(g.id)}
                      disabled={pending}
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 11,
                        fontWeight: 800,
                        color: RR.pink,
                        background: "rgba(255,30,140,0.1)",
                        border: `1.5px solid ${RR.pink}`,
                        borderRadius: 999,
                        padding: "6px 12px",
                        cursor: "pointer",
                        marginLeft: "auto",
                      }}
                    >
                      🗑 Supprimer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
