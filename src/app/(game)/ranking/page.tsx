import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import Link from "next/link";
import type { LeaderboardEntry } from "@/types/database";

export default async function RankingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("leaderboard_with_pseudo")
    .select("*")
    .order("points", { ascending: false })
    .limit(20);

  const entries = (rows ?? []) as LeaderboardEntry[];

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden" }}>
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.25,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.6) 1.4px, transparent 1.8px)",
        backgroundSize: "16px 16px",
      }} />

      <div style={{ position: "relative", zIndex: 10, padding: "28px 20px 100px" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>
            CLASSEMENT
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.pink}`, marginTop: 2 }}>
            TOP JOUEURS
          </div>
        </div>

        {/* Legend */}
        <div style={{
          display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
          marginBottom: 8, padding: "0 12px",
        }}>
          {["JOUEUR", "V", "D", "=", "PTS"].map(h => (
            <div key={h} style={{ fontFamily: "var(--font-sans)", fontSize: 8, fontWeight: 900, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, textAlign: h === "JOUEUR" ? "left" : "center" }}>
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entries.length === 0 && (
            <div style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "40px 0", transform: "skewX(-4deg)" }}>
              Aucun joueur classé pour l'instant
            </div>
          )}
          {entries.map((entry, i) => {
            const isMe = entry.player_id === session.playerId;
            return (
              <div key={entry.player_id} style={{
                background: isMe ? `rgba(0,212,232,0.12)` : EA.violetDeep,
                border: `2.5px solid ${isMe ? EA.cyan : EA.ink}`,
                borderRadius: 14, padding: "12px",
                boxShadow: isMe ? `3px 3px 0 ${EA.cyan}` : `2px 2px 0 ${EA.ink}`,
                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                alignItems: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16, minWidth: 20 }}>{medals[i] ?? `#${i + 1}`}</span>
                  <Avatar name={entry.pseudo} color={isMe ? EA.butter : EA.pink} ring={isMe ? EA.cyan : "transparent"} size={28} />
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 12, color: isMe ? EA.cyan : EA.white, transform: "skewX(-4deg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.pseudo.toUpperCase()}
                    {isMe && <span style={{ fontFamily: "var(--font-sans)", fontSize: 7, fontWeight: 900, color: EA.cyan, marginLeft: 4 }}>TOI</span>}
                  </div>
                </div>
                {[entry.wins, entry.losses, entry.draws].map((val, j) => (
                  <div key={j} style={{ fontFamily: "var(--font-display)", fontSize: 14, color: j === 0 ? EA.cyan : j === 1 ? EA.pink : EA.butter, textAlign: "center", transform: "skewX(-4deg)" }}>
                    {val}
                  </div>
                ))}
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: EA.white, textAlign: "center", transform: "skewX(-6deg)" }}>
                  {entry.points}
                </div>
              </div>
            );
          })}
        </div>

        {/* Back */}
        <div style={{ marginTop: 32, textAlign: "center" }}>
          <Link href="/lobby" style={{
            fontFamily: "var(--font-display)", fontSize: 13, color: EA.cyan,
            textDecoration: "none", display: "inline-block", transform: "skewX(-4deg)",
            borderBottom: `2px solid ${EA.cyan}`, paddingBottom: 2,
          }}>
            ← RETOUR AU LOBBY
          </Link>
        </div>
      </div>
    </div>
  );
}
