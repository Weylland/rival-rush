"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { GAME_LABELS } from "@/lib/game-labels";
import { getMaintenanceMode, setMaintenanceMode } from "@/app/admin/actions";

/* ─── constants ─────────────────────────────────────────────────── */

const PALETTE = [
  EA.cyan, EA.pink, EA.butter, "#4ade80", "#a78bfa",
  "#fb923c", "#34d399", "#f472b6", "#60a5fa", "#c084fc",
];

/* ─── types ─────────────────────────────────────────────────────── */

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
  guestPlayers: number;
  guestsToday: number;
}

interface DayCount { day: string; label: string; count: number }
interface TypeCount { type: string; count: number }
interface TopPlayer {
  player_id: string;
  pseudo: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
}

/* ─── helpers ────────────────────────────────────────────────────── */

function getLast7Days(): { day: string; label: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return {
      day: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("fr-FR", { weekday: "short" }),
    };
  });
}

function getLast14Days(): string[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });
}

/* ─── SVG: Bar chart (games per day) ─────────────────────────────── */

function BarChart({ data, color = EA.cyan }: { data: DayCount[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const W = 320, H = 160, PAD_B = 24, PAD_T = 12;
  const barArea = H - PAD_B - PAD_T;
  const slotW = W / data.length;
  const barW = Math.max(slotW * 0.55, 8);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0.25" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map((f) => {
        const y = PAD_T + barArea * (1 - f);
        return (
          <line
            key={f}
            x1={0} y1={y} x2={W} y2={y}
            stroke="rgba(255,255,255,0.06)" strokeWidth={1}
          />
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const barH = Math.max((d.count / max) * barArea, d.count > 0 ? 4 : 0);
        const x = slotW * i + (slotW - barW) / 2;
        const y = PAD_T + barArea - barH;
        const isToday = i === data.length - 1;

        return (
          <g key={d.day}>
            <rect
              x={x} y={y} width={barW} height={barH}
              rx={5}
              fill={isToday ? "url(#barGrad)" : `${color}40`}
            />
            {d.count > 0 && (
              <text
                x={x + barW / 2} y={y - 5}
                textAnchor="middle"
                fill={isToday ? color : "rgba(255,255,255,0.45)"}
                fontSize={9} fontFamily="var(--font-sans)" fontWeight={800}
              >
                {d.count}
              </text>
            )}
            <text
              x={slotW * i + slotW / 2} y={H - 5}
              textAnchor="middle"
              fill={isToday ? EA.white : "rgba(255,255,255,0.4)"}
              fontSize={10} fontFamily="var(--font-sans)"
              fontWeight={isToday ? 800 : 600}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── SVG: Area sparkline ─────────────────────────────────────────── */

function AreaChart({ data, color = EA.pink }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const W = 320, H = 90;
  const n = data.length;

  const pts = data.map((v, i) => ({
    x: n === 1 ? W / 2 : (i / (n - 1)) * W,
    y: H - 8 - (v / max) * (H - 18),
  }));

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#areaGrad)" />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) =>
        data[i] > 0 ? (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        ) : null,
      )}
    </svg>
  );
}

/* ─── SVG: Donut ring ─────────────────────────────────────────────── */

function DonutChart({
  value, total, color, label,
}: {
  value: number; total: number; color: string; label: string;
}) {
  const R = 36, CX = 50, CY = 50;
  const circ = 2 * Math.PI * R;
  const ratio = total > 0 ? Math.min(value / total, 1) : 0;
  const dash = ratio * circ;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg viewBox="0 0 100 100" style={{ width: 96, height: 96 }}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={10} />
        <circle
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${CX} ${CY})`}
          style={{ filter: `drop-shadow(0 0 8px ${color}80)`, transition: "stroke-dasharray .8s ease" }}
        />
        <text
          x={CX} y={CY}
          textAnchor="middle" dominantBaseline="central"
          fill={EA.white} fontSize={17}
          fontFamily="var(--font-display)"
        >
          {total > 0 ? `${Math.round(ratio * 100)}%` : "—"}
        </text>
      </svg>
      <div style={{
        fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700,
        color: "rgba(255,255,255,0.45)", textAlign: "center", lineHeight: 1.4,
      }}>
        {label}
      </div>
    </div>
  );
}

/* ─── Horizontal progress bar ─────────────────────────────────────── */

function HBar({
  label, value, max, color, sub,
}: {
  label: string; value: number; max: number; color: string; sub?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
          {label}
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color, transform: "skewX(-4deg)" }}>
          {value}
          {sub && (
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.35)", marginLeft: 5 }}>
              {sub}
            </span>
          )}
        </span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: 999,
          boxShadow: `0 0 8px ${color}60`,
          transition: "width .7s cubic-bezier(.4,0,.2,1)",
        }} />
      </div>
    </div>
  );
}

/* ─── Panel wrapper ───────────────────────────────────────────────── */

function Panel({
  title, icon, children, style,
}: {
  title: string; icon: string; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.035)",
      border: "1.5px solid rgba(255,255,255,0.09)",
      borderRadius: 20,
      padding: "18px 20px",
      ...style,
    }}>
      <div style={{
        fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900,
        color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1.3,
        marginBottom: 16, display: "flex", alignItems: "center", gap: 7,
      }}>
        <span>{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

/* ─── KPI card ────────────────────────────────────────────────────── */

function KpiCard({
  label, value, sub, color = EA.white, alert = false,
}: {
  label: string; value: number | string; sub?: string; color?: string; alert?: boolean;
}) {
  return (
    <div style={{
      background: alert ? "rgba(255,30,140,0.12)" : "rgba(255,255,255,0.05)",
      border: `1.5px solid ${alert ? EA.pink + "60" : "rgba(255,255,255,0.09)"}`,
      borderRadius: 16,
      padding: "14px 16px",
      boxShadow: alert ? `0 0 24px rgba(255,30,140,0.2)` : "none",
    }}>
      <div style={{
        fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900,
        color: alert ? EA.pink : "rgba(255,255,255,0.38)",
        textTransform: "uppercase", letterSpacing: 1, marginBottom: 5,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: 34, color,
        transform: "skewX(-4deg)", lineHeight: 1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700,
          color: "rgba(255,255,255,0.28)", marginTop: 5,
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* ─── Placeholder skeleton ────────────────────────────────────────── */

function Skeleton({ h = 80 }: { h?: number }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1.5px solid rgba(255,255,255,0.07)",
      borderRadius: 16,
      height: h,
      animation: "ea-pulse 1.5s ease-in-out infinite",
    }} />
  );
}

/* ─── Usage color (green / amber / red) ──────────────────────────── */

function usageColor(value: number, max: number): string {
  const pct = max > 0 ? (value / max) * 100 : 0;
  if (pct >= 90) return "#f87171"; // red
  if (pct >= 70) return "#fbbf24"; // amber
  return "#4ade80"; // green
}

/* ─── Main component ──────────────────────────────────────────────── */

export function DashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [gamesPerDay, setGamesPerDay] = useState<DayCount[]>([]);
  const [gamesPerType, setGamesPerType] = useState<TypeCount[]>([]);
  const [playersPerDay, setPlayersPerDay] = useState<number[]>([]);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [maintenance, setMaintenance] = useState<boolean | null>(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const staleThreshold = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayStartIso = todayStart.toISOString();

    const [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, rG7, rP14, rG30, rTop, rGuests, rGuestsToday] =
      await Promise.all([
        supabase.from("players").select("*", { count: "exact", head: true }),
        supabase.from("presence").select("*", { count: "exact", head: true }).gt("updated_at", staleThreshold),
        supabase.from("games").select("*", { count: "exact", head: true }).eq("status", "finished"),
        supabase.from("games").select("*", { count: "exact", head: true }).eq("status", "playing"),
        supabase.from("lobby_chat").select("*", { count: "exact", head: true }),
        supabase.from("direct_messages").select("*", { count: "exact", head: true }),
        supabase.from("rooms").select("*", { count: "exact", head: true }),
        supabase.from("rooms").select("*", { count: "exact", head: true }).eq("is_open", true),
        supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("contacts").select("*", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("player_notifications").select("*", { count: "exact", head: true }).eq("seen", false),
        supabase.from("blocks").select("*", { count: "exact", head: true }),
        // chart data
        supabase.from("games").select("created_at").gte("created_at", sevenDaysAgo),
        supabase.from("players").select("created_at").gte("created_at", fourteenDaysAgo),
        supabase.from("games").select("game_type").gte("created_at", thirtyDaysAgo),
        supabase.from("leaderboard").select("player_id, points, wins, losses, draws").order("points", { ascending: false }).limit(5),
        // infra
        supabase.from("players").select("*", { count: "exact", head: true }).eq("is_guest", true),
        supabase.from("players").select("*", { count: "exact", head: true }).eq("is_guest", true).gte("created_at", todayStartIso),
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
      guestPlayers: rGuests.count ?? 0,
      guestsToday: rGuestsToday.count ?? 0,
    });

    /* games per day */
    const days7 = getLast7Days();
    const gameDayMap = new Map<string, number>();
    for (const g of rG7.data ?? []) {
      const day = (g.created_at as string).slice(0, 10);
      gameDayMap.set(day, (gameDayMap.get(day) ?? 0) + 1);
    }
    setGamesPerDay(days7.map((d) => ({ ...d, count: gameDayMap.get(d.day) ?? 0 })));

    /* players per day (14d) */
    const days14 = getLast14Days();
    const playerDayMap = new Map<string, number>();
    for (const p of rP14.data ?? []) {
      const day = (p.created_at as string).slice(0, 10);
      playerDayMap.set(day, (playerDayMap.get(day) ?? 0) + 1);
    }
    setPlayersPerDay(days14.map((d) => playerDayMap.get(d) ?? 0));

    /* games per type (30d) */
    const typeMap = new Map<string, number>();
    for (const g of rG30.data ?? []) {
      const t = g.game_type as string;
      typeMap.set(t, (typeMap.get(t) ?? 0) + 1);
    }
    setGamesPerType(
      Array.from(typeMap.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    );

    /* top players */
    const topRows = rTop.data ?? [];
    if (topRows.length > 0) {
      const ids = topRows.map((r) => r.player_id as string);
      const { data: players } = await supabase.from("players").select("id, pseudo").in("id", ids);
      const pseudoMap = Object.fromEntries((players ?? []).map((p) => [p.id, p.pseudo as string]));
      setTopPlayers(
        topRows.map((r) => ({
          player_id: r.player_id as string,
          pseudo: pseudoMap[r.player_id as string] ?? "?",
          points: r.points as number,
          wins: r.wins as number,
          losses: r.losses as number,
          draws: r.draws as number,
        })),
      );
    } else {
      setTopPlayers([]);
    }

    setLoading(false);
    setRefreshedAt(new Date());
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    getMaintenanceMode().then(setMaintenance);
  }, []);

  async function toggleMaintenance() {
    if (maintenance === null) return;
    setMaintenanceLoading(true);
    const next = !maintenance;
    await setMaintenanceMode(next);
    setMaintenance(next);
    setMaintenanceLoading(false);
  }

  const maxPoints = Math.max(...topPlayers.map((p) => p.points), 1);
  const maxType = Math.max(...gamesPerType.map((t) => t.count), 1);
  const totalGames = (stats?.finishedGames ?? 0) + (stats?.activeGames ?? 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: EA.white, transform: "skewX(-4deg)" }}>
          Vue d&apos;ensemble
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

          {/* Maintenance toggle */}
          <button
            onClick={toggleMaintenance}
            disabled={maintenance === null || maintenanceLoading}
            style={{
              fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800,
              color: maintenance ? EA.pink : "rgba(255,255,255,0.5)",
              background: maintenance ? "rgba(255,30,140,0.15)" : "rgba(255,255,255,0.07)",
              border: `2px solid ${maintenance ? EA.pink + "60" : "rgba(255,255,255,0.14)"}`,
              borderRadius: 999,
              padding: "8px 18px", cursor: (maintenance === null || maintenanceLoading) ? "wait" : "pointer",
              opacity: (maintenance === null || maintenanceLoading) ? 0.5 : 1,
              transition: "all .2s",
              boxShadow: maintenance ? `0 0 16px rgba(255,30,140,0.25)` : "none",
            }}
          >
            {maintenance ? "🔧 Maintenance ON" : "✅ Site en ligne"}
          </button>

          {refreshedAt && (
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.28)" }}>
              {refreshedAt.toLocaleTimeString("fr-FR")}
            </span>
          )}
          <button
            onClick={fetchAll}
            disabled={loading}
            style={{
              fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800,
              color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.08)",
              border: "2px solid rgba(255,255,255,0.14)", borderRadius: 999,
              padding: "8px 18px", cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.5 : 1, transition: "opacity .15s",
            }}
          >
            {loading ? "…" : "↻ Actualiser"}
          </button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(135px, 1fr))", gap: 10 }}>
        {stats ? (
          <>
            <KpiCard label="Joueurs" value={stats.totalPlayers} color={EA.cyan} sub={`${stats.onlinePlayers} en ligne`} />
            <KpiCard label="Parties" value={stats.finishedGames + stats.activeGames} color={EA.white} sub={`${stats.activeGames} en cours`} />
            <KpiCard label="Salles" value={stats.totalRooms} color={EA.white} sub={`${stats.openRooms} ouvertes`} />
            <KpiCard label="Messages" value={stats.lobbyChatMessages + stats.totalDMs} color={EA.white} sub="lobby + DMs" />
            <KpiCard label="Rapports" value={stats.newReports} alert={stats.newReports > 0} color={stats.newReports > 0 ? EA.pink : "rgba(255,255,255,0.4)"} sub={stats.newReports > 0 ? "en attente ⚠" : "RAS"} />
            <KpiCard label="Contacts" value={stats.newContacts} alert={stats.newContacts > 0} color={stats.newContacts > 0 ? EA.pink : "rgba(255,255,255,0.4)"} sub={stats.newContacts > 0 ? "non traités ⚠" : "RAS"} />
          </>
        ) : (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={82} />)
        )}
      </div>

      {/* ── Charts row 1: bar chart + game types ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <Panel title="Parties par jour — 7 derniers jours" icon="📊">
          {gamesPerDay.length > 0
            ? <BarChart data={gamesPerDay} color={EA.cyan} />
            : <Skeleton h={160} />
          }
        </Panel>

        <Panel title="Jeux les plus joués — 30 jours" icon="🎮">
          {loading && gamesPerType.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={28} />)}
            </div>
          ) : gamesPerType.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {gamesPerType.map((t, i) => (
                <HBar
                  key={t.type}
                  label={GAME_LABELS[t.type] ?? t.type}
                  value={t.count}
                  max={maxType}
                  color={PALETTE[i % PALETTE.length]}
                  sub="parties"
                />
              ))}
            </div>
          ) : (
            <div style={{ padding: "40px 0", textAlign: "center", color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-sans)", fontSize: 12 }}>
              Aucune partie enregistrée
            </div>
          )}
        </Panel>
      </div>

      {/* ── Charts row 2: top players + donuts ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <Panel title="Top joueurs — classement" icon="🏆">
          {loading && topPlayers.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={46} />)}
            </div>
          ) : topPlayers.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {topPlayers.map((p, i) => {
                const podiumColor =
                  i === 0 ? EA.butter : i === 1 ? "rgba(200,200,210,0.9)" : i === 2 ? "#cd7c2f" : "rgba(255,255,255,0.35)";
                const medal = ["🥇", "🥈", "🥉"][i] ?? `#${i + 1}`;
                return (
                  <div key={p.player_id} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: podiumColor }}>
                          {medal}
                        </span>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: EA.white }}>
                          {p.pseudo}
                        </span>
                      </div>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: podiumColor, transform: "skewX(-4deg)" }}>
                        {p.points} pts
                      </span>
                    </div>
                    <div style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${(p.points / maxPoints) * 100}%`,
                        background: podiumColor,
                        borderRadius: 999,
                        boxShadow: `0 0 8px ${podiumColor}60`,
                        transition: "width .8s cubic-bezier(.4,0,.2,1)",
                      }} />
                    </div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)" }}>
                      {p.wins}V · {p.losses}D · {p.draws}N
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: "40px 0", textAlign: "center", color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-sans)", fontSize: 12 }}>
              Aucun classement
            </div>
          )}
        </Panel>

        <Panel title="Répartition" icon="🥧">
          {stats ? (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16, paddingTop: 8 }}>
              <DonutChart
                value={stats.finishedGames}
                total={totalGames}
                color={EA.cyan}
                label={`${stats.finishedGames} parties terminées`}
              />
              <DonutChart
                value={stats.activeGames}
                total={totalGames}
                color="#4ade80"
                label={`${stats.activeGames} en cours`}
              />
              <DonutChart
                value={stats.onlinePlayers}
                total={stats.totalPlayers}
                color={EA.violet}
                label={`${stats.onlinePlayers} / ${stats.totalPlayers} en ligne`}
              />
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={96} />)}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Inscriptions sparkline ── */}
      <Panel title="Nouvelles inscriptions — 14 derniers jours" icon="📈">
        {playersPerDay.length > 0 ? (
          <>
            <AreaChart data={playersPerDay} color={EA.pink} />
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700,
              color: "rgba(255,255,255,0.28)", marginTop: 6, paddingInline: 2,
            }}>
              <span>il y a 14j</span>
              <span>{playersPerDay.reduce((a, b) => a + b, 0)} inscriptions au total</span>
              <span>aujourd&apos;hui</span>
            </div>
          </>
        ) : (
          <Skeleton h={90} />
        )}
      </Panel>

      {/* ── Infra & capacité ── */}
      <Panel title="Infra & capacité — Free Tier" icon="⚙️">
        {stats ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* KPI row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
              <KpiCard
                label="Invités aujourd'hui"
                value={stats.guestsToday}
                color={usageColor(stats.guestsToday, 200)}
                alert={stats.guestsToday >= 180}
                sub="limite douce : 200/j"
              />
              <KpiCard
                label="Invités actifs"
                value={stats.guestPlayers}
                color={EA.white}
                sub="comptes anonymes"
              />
              <KpiCard
                label="En ligne"
                value={stats.onlinePlayers}
                color={usageColor(stats.onlinePlayers, 60)}
                alert={stats.onlinePlayers >= 54}
                sub="connexions DB ≈ /60"
              />
              <KpiCard
                label="Parties live"
                value={stats.activeGames}
                color={usageColor(stats.activeGames, 50)}
                alert={stats.activeGames >= 45}
                sub="limite douce : 50"
              />
            </div>

            {/* Progress bars */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <HBar
                label="Joueurs en ligne / connexions DB"
                value={stats.onlinePlayers}
                max={60}
                color={usageColor(stats.onlinePlayers, 60)}
                sub="/ 60 (Free)"
              />
              <HBar
                label="Invités créés aujourd'hui"
                value={stats.guestsToday}
                max={200}
                color={usageColor(stats.guestsToday, 200)}
                sub="/ 200 (limite douce)"
              />
              <HBar
                label="Parties en cours"
                value={stats.activeGames}
                max={50}
                color={usageColor(stats.activeGames, 50)}
                sub="/ 50 (limite douce)"
              />
              <HBar
                label="Joueurs inscrits"
                value={stats.totalPlayers}
                max={500}
                color={usageColor(stats.totalPlayers, 500)}
                sub="/ 500 (Free tier conseillé)"
              />
            </div>

            {/* Warning legend + external links */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                {[
                  { color: "#4ade80", label: "< 70 % — OK" },
                  { color: "#fbbf24", label: "70–90 % — Surveiller" },
                  { color: "#f87171", label: "> 90 % — Agir" },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)" }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { label: "Supabase →", href: "https://supabase.com/dashboard/project/_/reports" },
                  { label: "Vercel →", href: "https://vercel.com/dashboard" },
                ].map(({ label, href }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800,
                      color: "rgba(255,255,255,0.5)",
                      background: "rgba(255,255,255,0.07)",
                      border: "1.5px solid rgba(255,255,255,0.12)",
                      borderRadius: 999,
                      padding: "6px 14px",
                      textDecoration: "none",
                    }}
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>

          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={28} />)}
          </div>
        )}
      </Panel>
    </div>
  );
}
