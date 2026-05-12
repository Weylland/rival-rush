"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import type { LeaderboardEntry } from "@/types/database";

type Tab = "global" | "pfc" | "morpion" | "puissance4" | "reflexe" | "naval";

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
const TAB_LABELS: Record<Tab, string> = { global: "🏆 GLOBAL", pfc: "✊ PFC", morpion: "⨯ MORPION", puissance4: "🔴 P4", reflexe: "⚡ RÉFLEXE", naval: "🚢 NAVAL" };

export function RankingClient({ myPlayerId, initialEntries }: Props) {
  const [tab, setTab] = useState<Tab>("global");
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initialEntries);
  const [typeStats, setTypeStats] = useState<Record<Tab, Map<string, TypeStat>>>({
    global: new Map(),
    pfc: new Map(),
    morpion: new Map(),
    puissance4: new Map(),
    reflexe: new Map(),
    naval: new Map(),
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

        const pfcMap = new Map<string, TypeStat>();
        const morpionMap = new Map<string, TypeStat>();
        const puissance4Map = new Map<string, TypeStat>();
        const reflexeMap = new Map<string, TypeStat>();
        const navalMap = new Map<string, TypeStat>();

        for (const game of games) {
          const challenge = game.challenges as unknown as { challenger_id: string; challenged_id: string } | null;
          if (!challenge) continue;

          const map = game.game_type === "pfc" ? pfcMap : game.game_type === "puissance4" ? puissance4Map : game.game_type === "reflexe" ? reflexeMap : game.game_type === "naval" ? navalMap : morpionMap;
          const players = [challenge.challenger_id, challenge.challenged_id];

          for (const pid of players) {
            const s = map.get(pid) ?? { wins: 0, losses: 0, draws: 0 };
            if (game.winner_id === null) s.draws++;
            else if (game.winner_id === pid) s.wins++;
            else s.losses++;
            map.set(pid, s);
          }
        }

        setTypeStats({ global: new Map(), pfc: pfcMap, morpion: morpionMap, puissance4: puissance4Map, reflexe: reflexeMap, naval: navalMap });
        setTypeLoaded(true);
      });
  }, []);

  const getTabRows = (): { playerId: string; pseudo: string; wins: number; losses: number; draws: number; pts?: number }[] => {
    if (tab === "global") {
      return entries.map(e => ({ playerId: e.player_id, pseudo: e.pseudo, wins: e.wins, losses: e.losses, draws: e.draws, pts: e.points }));
    }
    const map = typeStats[tab];
    const rows = entries
      .map(e => {
        const s = map.get(e.player_id) ?? { wins: 0, losses: 0, draws: 0 };
        return { playerId: e.player_id, pseudo: e.pseudo, ...s };
      })
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses);
    return rows;
  };

  const rows = getTabRows();

  return (
    <>
      {/* Tabs */}
      <div style={{
        display: "flex", gap: 6,
        background: "rgba(26,15,94,0.55)",
        border: `2px solid ${EA.ink}`,
        borderRadius: 999, padding: 4,
        marginBottom: 24,
      }}>
        {(["global", "pfc", "morpion", "puissance4", "reflexe"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, textAlign: "center",
              background: tab === t ? EA.pink : "transparent",
              border: "none", borderRadius: 999, padding: "10px 0",
              fontFamily: "var(--font-display)", fontSize: 13,
              color: tab === t ? EA.white : "rgba(255,255,255,0.65)",
              letterSpacing: 0.6, cursor: "pointer",
              boxShadow: tab === t ? `2px 2px 0 ${EA.cyan}` : "none",
              transition: "all 0.15s",
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab !== "global" && !typeLoaded && (
        <div style={{ textAlign: "center", padding: "20px 0", fontFamily: "var(--font-sans)", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
          Chargement...
        </div>
      )}

      {/* Legend */}
      <div style={{
        display: "grid",
        gridTemplateColumns: tab === "global" ? "2fr 1fr 1fr 1fr 1fr" : "2fr 1fr 1fr 1fr",
        marginBottom: 10, padding: "0 14px",
      }}>
        {(tab === "global" ? ["JOUEUR", "V", "D", "=", "PTS"] : ["JOUEUR", "V", "D", "="]).map(h => (
          <div key={h} style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, textAlign: h === "JOUEUR" ? "left" : "center" }}>
            {h}
          </div>
        ))}
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
          return (
            <div key={row.playerId} style={{
              background: isMe ? `rgba(0,212,232,0.12)` : EA.violetDeep,
              border: `2.5px solid ${isMe ? EA.cyan : EA.ink}`,
              borderRadius: 18, padding: "14px 16px",
              boxShadow: isMe ? `3px 3px 0 ${EA.cyan}` : `2px 2px 0 ${EA.ink}`,
              display: "grid",
              gridTemplateColumns: tab === "global" ? "2fr 1fr 1fr 1fr 1fr" : "2fr 1fr 1fr 1fr",
              alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22, minWidth: 28 }}>{MEDALS[i] ?? `#${i + 1}`}</span>
                <Avatar name={row.pseudo} color={isMe ? EA.butter : EA.pink} ring={isMe ? EA.cyan : "transparent"} size={36} />
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: isMe ? EA.cyan : EA.white, transform: "skewX(-4deg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.pseudo.toUpperCase()}
                  {isMe && <span style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: EA.cyan, marginLeft: 6 }}>TOI</span>}
                </div>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: EA.cyan, textAlign: "center", transform: "skewX(-4deg)" }}>{row.wins}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: EA.pink, textAlign: "center", transform: "skewX(-4deg)" }}>{row.losses}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: EA.butter, textAlign: "center", transform: "skewX(-4deg)" }}>{row.draws}</div>
              {tab === "global" && (
                <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: EA.white, textAlign: "center", transform: "skewX(-6deg)" }}>
                  {row.pts}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
