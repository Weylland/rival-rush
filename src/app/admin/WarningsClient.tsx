"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { RR } from "@/lib/design";
import { deleteWarning, markWarningSeen } from "./actions";

interface Warning {
  id: string;
  player_id: string;
  player_pseudo: string;
  type: string;
  message: string;
  seen: boolean;
  created_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WarningsClient() {
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unseen" | "seen">("unseen");
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setDbError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("player_notifications")
      .select("id, player_id, type, message, seen, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (err) {
      setDbError(
        "Table player_notifications introuvable. Voir l'onglet Configuration des jeux pour le SQL.",
      );
      setLoading(false);
      return;
    }

    const playerIds = [...new Set((data ?? []).map((w) => w.player_id as string))];
    const { data: players } = await supabase
      .from("players")
      .select("id, pseudo")
      .in("id", playerIds);
    const pseudoMap = Object.fromEntries(
      (players ?? []).map((p) => [p.id, p.pseudo as string]),
    );

    setWarnings(
      (data ?? []).map((w) => ({
        id: w.id as string,
        player_id: w.player_id as string,
        player_pseudo: pseudoMap[w.player_id as string] ?? "?",
        type: w.type as string,
        message: w.message as string,
        seen: w.seen as boolean,
        created_at: w.created_at as string,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleMarkSeen(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await markWarningSeen(id);
      if ("error" in res) setError(res.error);
      else
        setWarnings((prev) =>
          prev.map((w) => (w.id === id ? { ...w, seen: true } : w)),
        );
    });
  }

  function handleDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await deleteWarning(id);
      if ("error" in res) setError(res.error);
      else setWarnings((prev) => prev.filter((w) => w.id !== id));
    });
  }

  const counts = {
    all: warnings.length,
    unseen: warnings.filter((w) => !w.seen).length,
    seen: warnings.filter((w) => w.seen).length,
  };

  const filtered = warnings
    .filter((w) =>
      filter === "all"
        ? true
        : filter === "unseen"
          ? !w.seen
          : w.seen,
    )
    .filter((w) =>
      search.trim()
        ? w.player_pseudo.toLowerCase().includes(search.toLowerCase()) ||
          w.message.toLowerCase().includes(search.toLowerCase())
        : true,
    );

  if (dbError) {
    return (
      <div
        style={{
          background: "rgba(255,30,140,0.12)",
          border: `2px solid ${RR.pink}`,
          borderRadius: 14,
          padding: "20px 24px",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 700,
          color: "rgba(255,255,255,0.7)",
        }}
      >
        ⚠ {dbError}
      </div>
    );
  }

  const filterTabs: { value: typeof filter; label: string; count: number }[] = [
    { value: "unseen", label: "Non lus", count: counts.unseen },
    { value: "seen", label: "Lus", count: counts.seen },
    { value: "all", label: "Tous", count: counts.all },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 16,
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
                background: active ? RR.pink : "rgba(255,255,255,0.05)",
                border: active
                  ? `1.5px solid ${RR.pink}`
                  : "1.5px solid rgba(255,255,255,0.1)",
                borderRadius: 999,
                padding: "7px 14px",
                cursor: "pointer",
                transition: "all .15s",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              {t.label}
              <span
                style={{
                  background: active
                    ? "rgba(0,0,0,0.2)"
                    : "rgba(255,255,255,0.1)",
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
        placeholder="Filtrer par joueur ou contenu…"
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
          Aucun avertissement
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((w) => (
            <div
              key={w.id}
              style={{
                background: w.seen
                  ? "rgba(255,255,255,0.03)"
                  : "rgba(255,30,140,0.08)",
                border: w.seen
                  ? `1.5px solid rgba(255,255,255,0.08)`
                  : `2px solid ${RR.pink}40`,
                borderRadius: 14,
                padding: "14px 16px",
                boxShadow: w.seen ? "none" : `0 0 24px rgba(255,30,140,0.1)`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  marginBottom: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 15,
                    color: RR.white,
                  }}
                >
                  ⚠️ {w.player_pseudo}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 10,
                    fontWeight: 900,
                    color: w.seen ? "rgba(255,255,255,0.4)" : RR.pink,
                    background: w.seen
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(255,30,140,0.15)",
                    border: `1.5px solid ${w.seen ? "rgba(255,255,255,0.1)" : RR.pink}40`,
                    borderRadius: 999,
                    padding: "2px 8px",
                    textTransform: "uppercase",
                  }}
                >
                  {w.seen ? "Lu" : "Non lu"}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.35)",
                    marginLeft: "auto",
                  }}
                >
                  {formatDate(w.created_at)}
                </span>
              </div>

              <div
                style={{
                  background: "rgba(0,0,0,0.25)",
                  border: `1.5px solid rgba(255,255,255,0.06)`,
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.85)",
                  lineHeight: 1.6,
                  marginBottom: 10,
                  wordBreak: "break-word",
                }}
              >
                {w.message}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {!w.seen && (
                  <button
                    onClick={() => handleMarkSeen(w.id)}
                    disabled={pending}
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 12,
                      fontWeight: 800,
                      color: RR.cyan,
                      background: "rgba(0,212,232,0.1)",
                      border: `1.5px solid ${RR.cyan}`,
                      borderRadius: 999,
                      padding: "6px 14px",
                      cursor: "pointer",
                    }}
                  >
                    ✓ Marquer comme lu
                  </button>
                )}
                <button
                  onClick={() => handleDelete(w.id)}
                  disabled={pending}
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 12,
                    fontWeight: 800,
                    color: RR.pink,
                    background: "rgba(255,30,140,0.1)",
                    border: `1.5px solid ${RR.pink}`,
                    borderRadius: 999,
                    padding: "6px 14px",
                    cursor: "pointer",
                  }}
                >
                  🗑 Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
