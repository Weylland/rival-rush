import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EA } from "@/lib/design";
import { SvgBlob } from "@/components/ui/blob";
import { Star } from "@/components/ui/star";
import Link from "next/link";
import { RankingClient } from "./RankingClient";
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

  const leaderboard = (rows ?? []) as LeaderboardEntry[];

  const playerIds = leaderboard.map(r => r.player_id);
  const { data: avatarRows } = playerIds.length > 0
    ? await supabase.from("players").select("id, avatar_url").in("id", playerIds)
    : { data: [] };

  const avatarOf = Object.fromEntries((avatarRows ?? []).map(p => [p.id, p.avatar_url as string | null]));
  const entries = leaderboard.map(r => ({ ...r, avatar_url: avatarOf[r.player_id] ?? null }));

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden" }}>
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.25,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.6) 1.4px, transparent 1.8px)",
        backgroundSize: "16px 16px",
      }} />

      <SvgBlob color={EA.butter} style={{ width: 560, height: 480, top: -180, right: -140, opacity: 0.7, animation: "ea-float 6s ease-in-out infinite" }} />
      <SvgBlob color={EA.pink} style={{ width: 480, height: 420, bottom: -160, left: -130, opacity: 0.65, animation: "ea-float 8s ease-in-out infinite reverse" }}
        path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />
      <SvgBlob color={EA.cyan} style={{ width: 300, height: 260, top: "42%", left: -110, opacity: 0.35, animation: "ea-float 11s ease-in-out infinite" }}
        path="M 40 20 Q 80 0 130 25 Q 190 55 170 120 Q 155 180 85 175 Q 15 170 10 105 Q -5 45 40 20 Z" />

      <Star color={EA.butter} size={38} style={{ top: "7%", left: "5%", animation: "ea-spin-slow 12s linear infinite" }} />
      <Star color={EA.white} size={24} style={{ top: "5%", right: "7%", animation: "ea-spin-slow 18s linear infinite reverse" }} />
      <Star color={EA.cyan} size={20} style={{ bottom: "22%", right: "5%", animation: "ea-float 5s ease-in-out infinite" }} />
      <Star color={EA.pink} size={16} style={{ top: "28%", right: "4%", animation: "ea-spin-slow 9s linear infinite" }} />
      <Star color={EA.butter} size={14} style={{ bottom: "9%", left: "8%", transform: "rotate(-15deg)" }} />
      <Star color={EA.white} size={12} style={{ top: "60%", left: "4%", animation: "ea-float 7s ease-in-out infinite reverse" }} />

      <div style={{ position: "relative", zIndex: 10, maxWidth: 680, margin: "0 auto", padding: "40px 24px 100px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>
            CLASSEMENT
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 48, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.pink}`, marginTop: 4 }}>
            TOP JOUEURS
          </div>
        </div>

        <RankingClient myPlayerId={session.playerId} initialEntries={entries} />

        {/* Back + History */}
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <Link href="/history" style={{
            fontFamily: "var(--font-display)", fontSize: 15, color: EA.butter,
            textDecoration: "none", display: "inline-block", transform: "skewX(-4deg)",
            borderBottom: `2px solid ${EA.butter}`, paddingBottom: 2,
          }}>
            📜 MON HISTORIQUE
          </Link>
          <Link href="/lobby" style={{
            fontFamily: "var(--font-display)", fontSize: 18, color: EA.cyan,
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
