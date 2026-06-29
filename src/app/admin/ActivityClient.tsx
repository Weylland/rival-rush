"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { RR } from "@/lib/design";

type EventKind =
  | "player"
  | "game"
  | "report"
  | "contact"
  | "room"
  | "warning"
  | "challenge";

interface Event {
  id: string;
  kind: EventKind;
  title: string;
  detail?: string;
  at: string;
}

const KIND_META: Record<
  EventKind,
  { icon: string; color: string; label: string }
> = {
  player: { icon: "👤", color: RR.cyan, label: "Joueur" },
  game: { icon: "🎯", color: RR.butter, label: "Partie" },
  report: { icon: "🚩", color: RR.pink, label: "Signalement" },
  contact: { icon: "📩", color: RR.pink, label: "Contact" },
  room: { icon: "🏠", color: RR.violet, label: "Salle" },
  warning: { icon: "⚠️", color: RR.pink, label: "Avertissement" },
  challenge: { icon: "⚔️", color: RR.cyan, label: "Défi" },
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `il y a ${Math.floor(diff)}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

export function ActivityClient() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<EventKind | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [
      { data: players },
      { data: games },
      { data: reports },
      { data: contacts },
      { data: rooms },
      { data: warnings },
      { data: challenges },
    ] = await Promise.all([
      supabase
        .from("players")
        .select("id, pseudo, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("games")
        .select(
          "id, game_type, winner_id, status, created_at, challenges(challenger_id, challenged_id)",
        )
        .eq("status", "finished")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("reports")
        .select("id, reporter_id, reported_player_id, created_at")
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("contacts")
        .select("id, name, subject, created_at")
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("rooms")
        .select("id, name, code, host_id, created_at")
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("player_notifications")
        .select("id, player_id, message, created_at")
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("challenges")
        .select(
          "id, game_type, status, challenger_id, challenged_id, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const allPlayerIds = new Set<string>();
    for (const p of players ?? []) allPlayerIds.add(p.id as string);
    for (const r of reports ?? []) {
      allPlayerIds.add(r.reporter_id as string);
      allPlayerIds.add(r.reported_player_id as string);
    }
    for (const r of rooms ?? []) allPlayerIds.add(r.host_id as string);
    for (const w of warnings ?? []) allPlayerIds.add(w.player_id as string);
    for (const c of challenges ?? []) {
      allPlayerIds.add(c.challenger_id as string);
      allPlayerIds.add(c.challenged_id as string);
    }
    type GameRow = {
      id: string;
      game_type: string;
      winner_id: string | null;
      created_at: string;
      challenges:
        | { challenger_id: string; challenged_id: string }
        | { challenger_id: string; challenged_id: string }[]
        | null;
    };
    const gameRows = (games ?? []) as unknown as GameRow[];
    for (const g of gameRows) {
      const ch = Array.isArray(g.challenges) ? g.challenges[0] : g.challenges;
      if (ch) {
        allPlayerIds.add(ch.challenger_id);
        allPlayerIds.add(ch.challenged_id);
      }
      if (g.winner_id) allPlayerIds.add(g.winner_id);
    }

    const { data: playerRows } = await supabase
      .from("players")
      .select("id, pseudo")
      .in("id", Array.from(allPlayerIds));
    const pseudoMap = Object.fromEntries(
      (playerRows ?? []).map((p) => [p.id, p.pseudo as string]),
    );

    const all: Event[] = [];
    for (const p of players ?? []) {
      all.push({
        id: `player-${p.id}`,
        kind: "player",
        title: `Nouveau joueur : ${p.pseudo}`,
        at: p.created_at as string,
      });
    }
    for (const g of gameRows) {
      const ch = Array.isArray(g.challenges) ? g.challenges[0] : g.challenges;
      const p1 = ch ? pseudoMap[ch.challenger_id] ?? "?" : "?";
      const p2 = ch ? pseudoMap[ch.challenged_id] ?? "?" : "?";
      const winner = g.winner_id
        ? pseudoMap[g.winner_id] ?? "?"
        : null;
      all.push({
        id: `game-${g.id}`,
        kind: "game",
        title: winner
          ? `${winner} a battu ${winner === p1 ? p2 : p1}`
          : `Égalité ${p1} vs ${p2}`,
        detail: g.game_type,
        at: g.created_at,
      });
    }
    for (const r of reports ?? []) {
      const reporter = pseudoMap[r.reporter_id as string] ?? "?";
      const reported = pseudoMap[r.reported_player_id as string] ?? "?";
      all.push({
        id: `report-${r.id}`,
        kind: "report",
        title: `${reporter} a signalé ${reported}`,
        at: r.created_at as string,
      });
    }
    for (const c of contacts ?? []) {
      all.push({
        id: `contact-${c.id}`,
        kind: "contact",
        title: `Message de ${c.name}`,
        detail: (c.subject as string | null) ?? undefined,
        at: c.created_at as string,
      });
    }
    for (const r of rooms ?? []) {
      const host = pseudoMap[r.host_id as string] ?? "?";
      all.push({
        id: `room-${r.id}`,
        kind: "room",
        title: `Salle "${r.name}" créée par ${host}`,
        detail: `#${r.code}`,
        at: r.created_at as string,
      });
    }
    for (const w of warnings ?? []) {
      const target = pseudoMap[w.player_id as string] ?? "?";
      all.push({
        id: `warning-${w.id}`,
        kind: "warning",
        title: `Avertissement envoyé à ${target}`,
        detail: w.message as string,
        at: w.created_at as string,
      });
    }
    for (const c of challenges ?? []) {
      const challenger = pseudoMap[c.challenger_id as string] ?? "?";
      const challenged = pseudoMap[c.challenged_id as string] ?? "?";
      all.push({
        id: `challenge-${c.id}`,
        kind: "challenge",
        title: `${challenger} défie ${challenged}`,
        detail: `${c.game_type} · ${c.status}`,
        at: c.created_at as string,
      });
    }

    all.sort((a, b) => (a.at > b.at ? -1 : 1));
    setEvents(all.slice(0, 80));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const supabase = createClient();
    const ch = supabase
      .channel("admin-activity")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "players" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contacts" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "rooms" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "challenges" }, load)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const filtered =
    filter === "all" ? events : events.filter((e) => e.kind === filter);

  const filterButtons: { value: EventKind | "all"; label: string }[] = [
    { value: "all", label: "Tout" },
    { value: "player", label: "Joueurs" },
    { value: "game", label: "Parties" },
    { value: "report", label: "Signalements" },
    { value: "contact", label: "Contacts" },
    { value: "room", label: "Salles" },
    { value: "warning", label: "Avertissements" },
    { value: "challenge", label: "Défis" },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        {filterButtons.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                fontWeight: 800,
                color: active ? RR.violetDeep : "rgba(255,255,255,0.55)",
                background: active ? RR.cyan : "rgba(255,255,255,0.05)",
                border: active
                  ? `1.5px solid ${RR.cyan}`
                  : "1.5px solid rgba(255,255,255,0.1)",
                borderRadius: 999,
                padding: "6px 14px",
                cursor: "pointer",
                transition: "all .15s",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

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
          Aucun événement
        </div>
      ) : (
        <div
          style={{
            position: "relative",
            paddingLeft: 32,
          }}
        >
          {/* Vertical timeline line */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 13,
              top: 8,
              bottom: 8,
              width: 1.5,
              background:
                "linear-gradient(180deg, rgba(0,212,232,0.4) 0%, rgba(255,30,140,0.2) 100%)",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((event) => {
              const meta = KIND_META[event.kind];
              return (
                <div
                  key={event.id}
                  style={{
                    position: "relative",
                    background: "rgba(255,255,255,0.03)",
                    border: `1.5px solid rgba(255,255,255,0.07)`,
                    borderRadius: 12,
                    padding: "12px 16px",
                    transition: "all .15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                    e.currentTarget.style.borderColor = `${meta.color}40`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                  }}
                >
                  {/* Timeline dot */}
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: -27,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: "#0a0218",
                      border: `2.5px solid ${meta.color}`,
                      boxShadow: `0 0 12px ${meta.color}80`,
                    }}
                  />

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{meta.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: 13,
                          fontWeight: 800,
                          color: RR.white,
                        }}
                      >
                        {event.title}
                      </div>
                      {event.detail && (
                        <div
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "rgba(255,255,255,0.4)",
                            marginTop: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {event.detail}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 10,
                        fontWeight: 800,
                        color: meta.color,
                        background: `${meta.color}15`,
                        border: `1px solid ${meta.color}30`,
                        borderRadius: 999,
                        padding: "3px 8px",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        flexShrink: 0,
                      }}
                    >
                      {meta.label}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "rgba(255,255,255,0.35)",
                        flexShrink: 0,
                        minWidth: 70,
                        textAlign: "right",
                      }}
                    >
                      {timeAgo(event.at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
