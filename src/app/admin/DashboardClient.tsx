"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";

interface Stats {
  totalPlayers: number;
  onlinePlayers: number;
  finishedGames: number;
  activeGames: number;
  lobbyChatMessages: number;
  totalDMs: number;
  totalRooms: number;
  openRooms: number;
  newReports: number;
  newContacts: number;
  totalWarnings: number;
  totalBlocks: number;
}

function StatCard({
  label,
  value,
  color,
  alert,
  sub,
}: {
  label: string;
  value: number | string;
  color?: string;
  alert?: boolean;
  sub?: string;
}) {
  return (
    <div
      style={{
        background: alert ? "rgba(255,30,140,0.12)" : "rgba(255,255,255,0.06)",
        border: `2.5px solid ${alert ? EA.pink : EA.ink}`,
        borderRadius: 16,
        padding: "16px 18px",
        boxShadow: alert ? `3px 3px 0 ${EA.pink}` : `2px 2px 0 ${EA.ink}`,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 10,
          fontWeight: 900,
          color: alert ? EA.pink : "rgba(255,255,255,0.45)",
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 38,
          color: color ?? EA.white,
          transform: "skewX(-4deg)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            fontWeight: 700,
            color: "rgba(255,255,255,0.3)",
            marginTop: 4,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `2px solid rgba(255,255,255,0.08)`,
        borderRadius: 16,
        padding: "16px 18px",
        height: 90,
        opacity: 0.5,
      }}
    />
  );
}

export function DashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12] =
        await Promise.all([
          supabase.from("players").select("*", { count: "exact", head: true }),
          supabase.from("presence").select("*", { count: "exact", head: true }),
          supabase
            .from("games")
            .select("*", { count: "exact", head: true })
            .eq("status", "finished"),
          supabase
            .from("games")
            .select("*", { count: "exact", head: true })
            .eq("status", "playing"),
          supabase
            .from("lobby_chat")
            .select("*", { count: "exact", head: true }),
          supabase
            .from("direct_messages")
            .select("*", { count: "exact", head: true }),
          supabase.from("rooms").select("*", { count: "exact", head: true }),
          supabase
            .from("rooms")
            .select("*", { count: "exact", head: true })
            .eq("is_open", true),
          supabase
            .from("reports")
            .select("*", { count: "exact", head: true })
            .eq("status", "new"),
          supabase
            .from("contacts")
            .select("*", { count: "exact", head: true })
            .eq("status", "new"),
          supabase
            .from("player_notifications")
            .select("*", { count: "exact", head: true })
            .eq("seen", false),
          supabase.from("blocks").select("*", { count: "exact", head: true }),
        ]);

      setStats({
        totalPlayers: r1.count ?? 0,
        onlinePlayers: r2.count ?? 0,
        finishedGames: r3.count ?? 0,
        activeGames: r4.count ?? 0,
        lobbyChatMessages: r5.count ?? 0,
        totalDMs: r6.count ?? 0,
        totalRooms: r7.count ?? 0,
        openRooms: r8.count ?? 0,
        newReports: r9.count ?? 0,
        newContacts: r10.count ?? 0,
        totalWarnings: r11.count ?? 0,
        totalBlocks: r12.count ?? 0,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setRefreshedAt(new Date());
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const cards = stats
    ? [
        {
          label: "Joueurs inscrits",
          value: stats.totalPlayers,
          color: EA.cyan,
          sub: `${stats.onlinePlayers} en ligne maintenant`,
        },
        {
          label: "Parties jouées",
          value: stats.finishedGames,
          color: EA.white,
          sub: `${stats.activeGames} en cours`,
        },
        {
          label: "Messages lobby",
          value: stats.lobbyChatMessages,
          color: EA.white,
        },
        {
          label: "Messages privés",
          value: stats.totalDMs,
          color: EA.white,
        },
        {
          label: "Salles",
          value: stats.totalRooms,
          color: EA.white,
          sub: `${stats.openRooms} ouvertes`,
        },
        {
          label: "Blocages",
          value: stats.totalBlocks,
          color: "rgba(255,255,255,0.6)",
        },
        {
          label: "Rapports",
          value: stats.newReports,
          alert: stats.newReports > 0,
          color: stats.newReports > 0 ? EA.pink : EA.white,
          sub: stats.newReports > 0 ? "en attente" : "aucun en attente",
        },
        {
          label: "Contacts",
          value: stats.newContacts,
          alert: stats.newContacts > 0,
          color: stats.newContacts > 0 ? EA.pink : EA.white,
          sub: stats.newContacts > 0 ? "non traités" : "tous traités",
        },
        {
          label: "Avertissements",
          value: stats.totalWarnings,
          alert: stats.totalWarnings > 0,
          color: stats.totalWarnings > 0 ? EA.pink : EA.white,
          sub: "non lus par les joueurs",
        },
      ]
    : [];

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            color: EA.white,
            transform: "skewX(-4deg)",
          }}
        >
          Vue d&apos;ensemble
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {refreshedAt && (
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(255,255,255,0.3)",
              }}
            >
              {refreshedAt.toLocaleTimeString("fr-FR")}
            </span>
          )}
          <button
            onClick={fetchStats}
            disabled={loading}
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 800,
              color: "rgba(255,255,255,0.6)",
              background: "rgba(255,255,255,0.08)",
              border: `2px solid rgba(255,255,255,0.15)`,
              borderRadius: 999,
              padding: "8px 18px",
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.5 : 1,
              transition: "opacity .15s",
            }}
          >
            {loading ? "…" : "↻ Actualiser"}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "rgba(255,30,140,0.12)",
            border: `2px solid ${EA.pink}`,
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 16,
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 800,
            color: EA.pink,
          }}
        >
          ⚠ {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
          gap: 10,
        }}
      >
        {loading && !stats
          ? Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)
          : cards.map((c) => (
              <StatCard
                key={c.label}
                label={c.label}
                value={c.value}
                color={c.color}
                alert={c.alert}
                sub={c.sub}
              />
            ))}
      </div>
    </div>
  );
}
