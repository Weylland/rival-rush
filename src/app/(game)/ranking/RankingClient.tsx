"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import type { LeaderboardEntry } from "@/types/database";

type Tab = "global" | "pfc" | "morpion" | "puissance4" | "reflexe" | "naval" | "chess" | "nim" | "pig" | "mastermind" | "plus-ou-moins";

interface TypeStat {
  wins: number;
  losses: number;
  draws: number;
}

interface Props {
  myPlayerId: string;
  initialEntries: LeaderboardEntry[];
}

const MEDALS = ["🥇", "🥈", "🥉"];
const TAB_LABELS: Record<Tab, string> = {
  global:     "🏆 Classement global",
  pfc:        "✊ Pierre Feuille Ciseaux",
  morpion:    "⨯ Morpion",
  puissance4: "🔴 Puissance 4",
  reflexe:    "⚡ Réflexe",
  naval:      "🚢 Bataille Navale",
  chess:      "♟ Échecs",
  nim:             "🔥 Nim",
  pig:             "🐷 Jeu du Cochon",
  mastermind:      "🎨 Mastermind",
  "plus-ou-moins": "🔢 Plus ou Moins",
};

export function RankingClient({ myPlayerId, initialEntries }: Props) {
  const [tab, setTab] = useState<Tab>("global");
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initialEntries);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [typeStats, setTypeStats] = useState<Record<Tab, Map<string, TypeStat>>>({
    global: new Map(),
    pfc: new Map(),
    morpion: new Map(),
    puissance4: new Map(),
    reflexe: new Map(),
    naval: new Map(),
    chess: new Map(),
    nim: new Map(),
    pig: new Map(),
    mastermind: new Map(),
    "plus-ou-moins": new Map(),
  });
  const [typeLoaded, setTypeLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const refetch = () => {
      supabase
        .from("leaderboard_with_pseudo")
        .select("*")
        .order("points", { ascending: false })
        .limit(20)
        .then(({ data }) => { if (data) setEntries(data as LeaderboardEntry[]); });
    };

    const sub = supabase
      .channel("leaderboard-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "leaderboard" }, refetch)
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("games")
      .select("game_type, winner_id, challenges(challenger_id, challenged_id)")
      .eq("status", "finished")
      .then(({ data: games }) => {
        if (!games) return;

        const maps: Record<Exclude<Tab, "global">, Map<string, TypeStat>> = {
          pfc: new Map(), morpion: new Map(), puissance4: new Map(),
          reflexe: new Map(), naval: new Map(), chess: new Map(),
          nim: new Map(), pig: new Map(), mastermind: new Map(), "plus-ou-moins": new Map(),
        };

        for (const game of games) {
          const challenge = game.challenges as unknown as { challenger_id: string; challenged_id: string } | null;
          if (!challenge) continue;
          const gt = game.game_type as Exclude<Tab, "global">;
          const map = maps[gt];
          if (!map) continue;
          const players = [challenge.challenger_id, challenge.challenged_id];
          for (const pid of players) {
            const s = map.get(pid) ?? { wins: 0, losses: 0, draws: 0 };
            if (game.winner_id === null) s.draws++;
            else if (game.winner_id === pid) s.wins++;
            else s.losses++;
            map.set(pid, s);
          }
        }

        setTypeStats({ global: new Map(), ...maps });
        setTypeLoaded(true);
      });
  }, []);

  const getTabRows = (): { playerId: string; pseudo: string; avatar_url?: string | null; wins: number; losses: number; draws: number; pts?: number }[] => {
    if (tab === "global") {
      return entries
        .map(e => ({ playerId: e.player_id, pseudo: e.pseudo, avatar_url: e.avatar_url, wins: e.wins, losses: e.losses, draws: e.draws, pts: e.points }))
        .filter(r => r.wins + r.losses + r.draws > 0);
    }
    const map = typeStats[tab];
    return entries
      .map(e => {
        const s = map.get(e.player_id) ?? { wins: 0, losses: 0, draws: 0 };
        return { playerId: e.player_id, pseudo: e.pseudo, avatar_url: e.avatar_url, ...s };
      })
      .filter(r => r.wins + r.losses + r.draws > 0)
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  };

  const rows = getTabRows();

  return (
    <>
      {/* Filter dropdown */}
      <div style={{ position: "relative", marginBottom: 24 }}>
        <select
          value={tab}
          onChange={e => setTab(e.target.value as Tab)}
          style={{
            width: "100%",
            fontFamily: "var(--font-display)",
            fontSize: 16,
            color: EA.white,
            background: EA.violetDeep,
            border: `2.5px solid ${EA.pink}`,
            borderRadius: 14,
            padding: "13px 48px 13px 18px",
            appearance: "none",
            cursor: "pointer",
            boxShadow: `3px 3px 0 ${EA.pink}`,
            outline: "none",
          }}
        >
          {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
            <option key={t} value={t} style={{ background: EA.violetDeep, color: EA.white }}>
              {TAB_LABELS[t]}
            </option>
          ))}
        </select>
        {/* Chevron */}
        <span aria-hidden style={{
          position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
          fontSize: 16, color: EA.pink, pointerEvents: "none",
        }}>▾</span>
      </div>

      {tab !== "global" && !typeLoaded && (
        <div style={{ textAlign: "center", padding: "20px 0", fontFamily: "var(--font-sans)", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
          Chargement...
        </div>
      )}

      {/* Legend */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 48px",
        marginBottom: 10, padding: "0 14px",
      }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 1 }}>JOUEUR</div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1, textAlign: "center" }}>V</div>
      </div>

      {/* Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.length === 0 && (
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "40px 0", transform: "skewX(-4deg)" }}>
            Aucun joueur classé pour l&apos;instant
          </div>
        )}
        {rows.map((row, i) => {
          const isMe = row.playerId === myPlayerId;
          const isExpanded = expandedId === row.playerId || (expandedId === null && i === 0);
          return (
            <div
              key={row.playerId}
              onClick={() => setExpandedId(isExpanded ? null : row.playerId)}
              style={{
                background: isMe ? `rgba(0,212,232,0.12)` : EA.violetDeep,
                border: `2.5px solid ${isMe ? EA.cyan : EA.ink}`,
                borderRadius: 18, padding: "12px 16px",
                boxShadow: isMe ? `3px 3px 0 ${EA.cyan}` : `2px 2px 0 ${EA.ink}`,
                cursor: "pointer",
                transition: "box-shadow 0.15s",
              }}
            >
              {/* Ligne principale */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 48px", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 20, minWidth: 26, flexShrink: 0 }}>{MEDALS[i] ?? `#${i + 1}`}</span>
                  <Avatar name={row.pseudo} src={row.avatar_url} color={isMe ? EA.butter : EA.pink} ring={isMe ? EA.cyan : "transparent"} size={34} />
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 15, color: isMe ? EA.cyan : EA.white, transform: "skewX(-4deg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
                    {row.pseudo.toUpperCase()}
                    {isMe && <span style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900, color: EA.cyan, marginLeft: 5 }}>TOI</span>}
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: EA.cyan, textAlign: "center", transform: "skewX(-4deg)" }}>{row.wins}</div>
              </div>

              {/* Détails (expandable) */}
              {isExpanded && (
                <div style={{
                  marginTop: 12, paddingTop: 12,
                  borderTop: `1.5px solid rgba(255,255,255,0.1)`,
                  display: "flex", gap: 8, justifyContent: "space-around",
                }}>
                  {[
                    { label: "Victoires", val: row.wins, color: EA.cyan },
                    { label: "Défaites",  val: row.losses, color: EA.pink },
                    { label: "Nuls",      val: row.draws, color: EA.butter },
                    ...(tab === "global" ? [{ label: "Points", val: row.pts ?? 0, color: EA.white }] : []),
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color, transform: "skewX(-4deg)" }}>{val}</div>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
