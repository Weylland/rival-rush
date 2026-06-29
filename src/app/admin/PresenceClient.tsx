"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { RR } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { kickPresence, clearAllPresence } from "./actions";

interface OnlineEntry {
  player_id: string;
  pseudo: string;
  avatar_url: string | null;
  avatar_color: string | null;
  status: "online" | "in-game";
  game_type: string | null;
  updated_at: string;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h`;
}

export function PresenceClient() {
  const [entries, setEntries] = useState<OnlineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const staleThreshold = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const { data: presence } = await supabase
      .from("presence")
      .select("player_id, pseudo, status, game_type, updated_at")
      .gt("updated_at", staleThreshold)
      .order("updated_at", { ascending: false });

    if (!presence || presence.length === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const playerIds = presence.map((p) => p.player_id as string);
    const { data: players } = await supabase
      .from("players")
      .select("id, avatar_url, avatar_color")
      .in("id", playerIds);
    const avatarMap = Object.fromEntries(
      (players ?? []).map((p) => [p.id, p.avatar_url as string | null]),
    );
    const colorMap = Object.fromEntries(
      (players ?? []).map((p) => [p.id, p.avatar_color as string | null]),
    );

    setEntries(
      presence.map((p) => ({
        player_id: p.player_id as string,
        pseudo: p.pseudo as string,
        avatar_url: avatarMap[p.player_id as string] ?? null,
        avatar_color: colorMap[p.player_id as string] ?? null,
        status: p.status as "online" | "in-game",
        game_type: p.game_type as string | null,
        updated_at: p.updated_at as string,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const supabase = createClient();
    const ch = supabase
      .channel("admin-presence")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "presence" },
        load,
      )
      .subscribe();
    const tick = setInterval(load, 30_000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(tick);
    };
  }, [load]);

  function handleKick(playerId: string, pseudo: string) {
    if (!confirm(`Déconnecter ${pseudo} ?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await kickPresence(playerId);
      if ("error" in res) setError(res.error);
      else
        setEntries((prev) => prev.filter((e) => e.player_id !== playerId));
    });
  }

  function handleClearAll() {
    setError(null);
    startTransition(async () => {
      const res = await clearAllPresence();
      if ("error" in res) setError(res.error);
      else {
        setEntries([]);
        setConfirmClear(false);
      }
    });
  }

  const inGame = entries.filter((e) => e.status === "in-game").length;
  const idle = entries.filter((e) => e.status === "online").length;

  return (
    <div>
      {/* Stats strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            background: "rgba(74,222,128,0.08)",
            border: `1.5px solid rgba(74,222,128,0.25)`,
            borderRadius: 14,
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 10,
              fontWeight: 900,
              color: "#4ade80",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            En ligne
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 32,
              color: "#4ade80",
              transform: "skewX(-4deg)",
              marginTop: 2,
              lineHeight: 1,
            }}
          >
            {entries.length}
          </div>
        </div>
        <div
          style={{
            background: "rgba(0,212,232,0.08)",
            border: `1.5px solid rgba(0,212,232,0.25)`,
            borderRadius: 14,
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 10,
              fontWeight: 900,
              color: RR.cyan,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            En partie
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 32,
              color: RR.cyan,
              transform: "skewX(-4deg)",
              marginTop: 2,
              lineHeight: 1,
            }}
          >
            {inGame}
          </div>
        </div>
        <div
          style={{
            background: "rgba(255,233,74,0.08)",
            border: `1.5px solid rgba(255,233,74,0.25)`,
            borderRadius: 14,
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 10,
              fontWeight: 900,
              color: RR.butter,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Inactifs
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 32,
              color: RR.butter,
              transform: "skewX(-4deg)",
              marginTop: 2,
              lineHeight: 1,
            }}
          >
            {idle}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={load}
          disabled={loading}
          style={{
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
          ↻ Rafraîchir
        </button>
        {entries.length > 0 && !confirmClear && (
          <button
            onClick={() => setConfirmClear(true)}
            disabled={pending}
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 11,
              fontWeight: 800,
              color: RR.pink,
              background: "rgba(255,30,140,0.08)",
              border: `1.5px solid ${RR.pink}`,
              borderRadius: 999,
              padding: "6px 12px",
              cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            🧹 Tout vider
          </button>
        )}
        {confirmClear && (
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            <button
              onClick={() => setConfirmClear(false)}
              disabled={pending}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 11,
                fontWeight: 800,
                color: RR.white,
                background: "rgba(255,255,255,0.1)",
                border: `1.5px solid rgba(255,255,255,0.15)`,
                borderRadius: 999,
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >
              Annuler
            </button>
            <button
              onClick={handleClearAll}
              disabled={pending}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 11,
                fontWeight: 900,
                color: RR.white,
                background: RR.pink,
                border: `1.5px solid ${RR.ink}`,
                borderRadius: 999,
                padding: "6px 12px",
                cursor: pending ? "wait" : "pointer",
                boxShadow: `2px 2px 0 ${RR.ink}`,
              }}
            >
              Vider tout
            </button>
          </div>
        )}
      </div>

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
      ) : entries.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 0",
            color: "rgba(255,255,255,0.3)",
            fontFamily: "var(--font-display)",
          }}
        >
          Personne en ligne
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 10,
          }}
        >
          {entries.map((e) => {
            const inGame = e.status === "in-game";
            return (
              <div
                key={e.player_id}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1.5px solid ${inGame ? "rgba(0,212,232,0.3)" : "rgba(74,222,128,0.25)"}`,
                  borderRadius: 14,
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  transition: "all .15s",
                }}
              >
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <Avatar
                    name={e.pseudo}
                    src={e.avatar_url}
                    color={e.avatar_color ?? (inGame ? RR.cyan : RR.violet)}
                    ring="transparent"
                    size={40}
                  />
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      bottom: -1,
                      right: -1,
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: inGame ? RR.cyan : "#4ade80",
                      border: "2px solid #0a0218",
                      boxShadow: `0 0 8px ${inGame ? RR.cyan : "#4ade80"}`,
                    }}
                    className={inGame ? undefined : "rr-admin-pulse-dot"}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 14,
                      color: RR.white,
                      transform: "skewX(-4deg)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {e.pseudo}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 11,
                      fontWeight: 700,
                      color: inGame ? RR.cyan : "#4ade80",
                      marginTop: 2,
                    }}
                  >
                    {inGame
                      ? `🎯 ${e.game_type ?? "en jeu"}`
                      : `🟢 actif il y a ${timeAgo(e.updated_at)}`}
                  </div>
                </div>
                <button
                  onClick={() => handleKick(e.player_id, e.pseudo)}
                  disabled={pending}
                  title="Déconnecter"
                  style={{
                    fontSize: 13,
                    background: "rgba(255,30,140,0.1)",
                    border: `1.5px solid ${RR.pink}`,
                    borderRadius: 8,
                    padding: "5px 10px",
                    color: RR.pink,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  🚪
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
