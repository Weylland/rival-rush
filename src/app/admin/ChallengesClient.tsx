"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { cancelChallenge, deleteChallenge } from "./actions";

interface Challenge {
  id: string;
  game_type: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: string;
  challenger_id: string;
  challenged_id: string;
  challenger_pseudo: string;
  challenged_pseudo: string;
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

const STATUS_META: Record<
  Challenge["status"],
  { label: string; color: string }
> = {
  pending: { label: "En attente", color: EA.cyan },
  accepted: { label: "Accepté", color: "#4ade80" },
  declined: { label: "Refusé", color: "rgba(255,255,255,0.4)" },
  cancelled: { label: "Annulé", color: EA.pink },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChallengesClient() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Challenge["status"] | "all">("pending");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("challenges")
      .select(
        "id, game_type, status, created_at, challenger_id, challenged_id",
      )
      .order("created_at", { ascending: false })
      .limit(150);

    if (!data || data.length === 0) {
      setChallenges([]);
      setLoading(false);
      return;
    }

    const playerIds = [
      ...new Set(
        data.flatMap((c) => [
          c.challenger_id as string,
          c.challenged_id as string,
        ]),
      ),
    ];
    const { data: players } = await supabase
      .from("players")
      .select("id, pseudo")
      .in("id", playerIds);
    const pseudoMap = Object.fromEntries(
      (players ?? []).map((p) => [p.id, p.pseudo as string]),
    );

    setChallenges(
      data.map((c) => ({
        id: c.id as string,
        game_type: c.game_type as string,
        status: c.status as Challenge["status"],
        created_at: c.created_at as string,
        challenger_id: c.challenger_id as string,
        challenged_id: c.challenged_id as string,
        challenger_pseudo: pseudoMap[c.challenger_id as string] ?? "?",
        challenged_pseudo: pseudoMap[c.challenged_id as string] ?? "?",
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const supabase = createClient();
    const ch = supabase
      .channel("admin-challenges")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "challenges" },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  function handleCancel(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await cancelChallenge(id);
      if ("error" in res) setError(res.error);
      else
        setChallenges((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: "cancelled" } : c)),
        );
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Supprimer définitivement ce défi ?")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteChallenge(id);
      if ("error" in res) setError(res.error);
      else setChallenges((prev) => prev.filter((c) => c.id !== id));
    });
  }

  const counts = {
    all: challenges.length,
    pending: challenges.filter((c) => c.status === "pending").length,
    accepted: challenges.filter((c) => c.status === "accepted").length,
    declined: challenges.filter((c) => c.status === "declined").length,
    cancelled: challenges.filter((c) => c.status === "cancelled").length,
  };

  const filtered =
    filter === "all" ? challenges : challenges.filter((c) => c.status === filter);

  const filterTabs: {
    value: typeof filter;
    label: string;
    count: number;
    color: string;
  }[] = [
    { value: "pending", label: "En attente", count: counts.pending, color: EA.cyan },
    { value: "accepted", label: "Acceptés", count: counts.accepted, color: "#4ade80" },
    { value: "declined", label: "Refusés", count: counts.declined, color: "rgba(255,255,255,0.4)" },
    { value: "cancelled", label: "Annulés", count: counts.cancelled, color: EA.pink },
    { value: "all", label: "Tous", count: counts.all, color: EA.violet },
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
                color: active ? EA.violetDeep : "rgba(255,255,255,0.6)",
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
          Aucun défi
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((c) => {
            const meta = STATUS_META[c.status];
            return (
              <div
                key={c.id}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1.5px solid ${meta.color}30`,
                  borderRadius: 12,
                  padding: "12px 16px",
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
                    color: meta.color,
                    background: `${meta.color}15`,
                    border: `1.5px solid ${meta.color}40`,
                    borderRadius: 999,
                    padding: "3px 10px",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {meta.label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 11,
                    fontWeight: 900,
                    color: EA.butter,
                    background: "rgba(255,233,74,0.08)",
                    border: `1.5px solid ${EA.butter}40`,
                    borderRadius: 999,
                    padding: "3px 10px",
                  }}
                >
                  {GAME_LABELS[c.game_type] ?? c.game_type}
                </span>
                <div
                  style={{
                    flex: 1,
                    minWidth: 200,
                    fontFamily: "var(--font-display)",
                    fontSize: 14,
                    color: EA.white,
                    transform: "skewX(-4deg)",
                  }}
                >
                  {c.challenger_pseudo}{" "}
                  <span style={{ color: "rgba(255,255,255,0.3)" }}>→</span>{" "}
                  {c.challenged_pseudo}
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  {formatDate(c.created_at)}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  {c.status === "pending" && (
                    <button
                      onClick={() => handleCancel(c.id)}
                      disabled={pending}
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 11,
                        fontWeight: 800,
                        color: EA.butter,
                        background: "rgba(255,233,74,0.1)",
                        border: `1.5px solid ${EA.butter}`,
                        borderRadius: 999,
                        padding: "6px 12px",
                        cursor: "pointer",
                      }}
                    >
                      Annuler
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={pending}
                    style={{
                      fontSize: 13,
                      background: "rgba(255,30,140,0.1)",
                      border: `1.5px solid ${EA.pink}`,
                      borderRadius: 8,
                      padding: "5px 10px",
                      color: EA.pink,
                      cursor: "pointer",
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
