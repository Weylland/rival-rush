import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { SvgBlob } from "@/components/ui/blob";
import { Star } from "@/components/ui/star";
import Link from "next/link";
import type { GameType } from "@/types/database";

interface GameRow {
  id: string;
  game_type: GameType;
  winner_id: string | null;
  created_at: string;
  challenger_id: string;
  challenged_id: string;
  challenger_pseudo: string;
  challenged_pseudo: string;
  opponent_avatar_url: string | null;
}

export default async function HistoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();

  const { data: games } = await supabase
    .from("games")
    .select("id, game_type, winner_id, created_at, challenges(challenger_id, challenged_id)")
    .eq("status", "finished")
    .order("created_at", { ascending: false })
    .limit(30);

  const rawGames = (games ?? []) as unknown as Array<{
    id: string;
    game_type: GameType;
    winner_id: string | null;
    created_at: string;
    challenges: { challenger_id: string; challenged_id: string } | null;
  }>;

  // Filter only games involving the current player
  const myGames = rawGames.filter(g => {
    const c = g.challenges;
    return c && (c.challenger_id === session.playerId || c.challenged_id === session.playerId);
  });

  // Collect all opponent IDs to fetch pseudos
  const opponentIds = new Set<string>();
  for (const g of myGames) {
    const c = g.challenges!;
    const opId = c.challenger_id === session.playerId ? c.challenged_id : c.challenger_id;
    opponentIds.add(opId);
  }

  const { data: opPlayers } = await supabase
    .from("players")
    .select("id, pseudo, avatar_url")
    .in("id", [...opponentIds]);

  const pseudoOf = Object.fromEntries((opPlayers ?? []).map(p => [p.id, p.pseudo as string]));
  const avatarOf = Object.fromEntries((opPlayers ?? []).map(p => [p.id, p.avatar_url as string | null]));

  const rows: GameRow[] = myGames.map(g => {
    const c = g.challenges!;
    const opId = c.challenger_id === session.playerId ? c.challenged_id : c.challenger_id;
    return {
      id: g.id,
      game_type: g.game_type,
      winner_id: g.winner_id,
      created_at: g.created_at,
      challenger_id: c.challenger_id,
      challenged_id: c.challenged_id,
      challenger_pseudo: pseudoOf[c.challenger_id] ?? "?",
      challenged_pseudo: pseudoOf[c.challenged_id] ?? "?",
      opponent_avatar_url: avatarOf[opId] ?? null,
    };
  });

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden" }}>
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.25,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.6) 1.4px, transparent 1.8px)",
        backgroundSize: "16px 16px",
      }} />

      <SvgBlob color={EA.cyan} style={{ width: 500, height: 440, top: -160, right: -130, opacity: 0.65, animation: "ea-float 7s ease-in-out infinite" }} />
      <SvgBlob color={EA.butter} style={{ width: 420, height: 380, bottom: -150, left: -120, opacity: 0.5, animation: "ea-float 9s ease-in-out infinite reverse" }}
        path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />

      <Star color={EA.butter} size={36} style={{ top: "7%", left: "5%", animation: "ea-spin-slow 12s linear infinite" }} />
      <Star color={EA.white} size={22} style={{ top: "5%", right: "7%", animation: "ea-spin-slow 18s linear infinite reverse" }} />
      <Star color={EA.pink} size={18} style={{ bottom: "24%", right: "5%", animation: "ea-float 5s ease-in-out infinite" }} />
      <Star color={EA.cyan} size={14} style={{ bottom: "10%", left: "8%", transform: "rotate(-15deg)" }} />

      <div style={{ position: "relative", zIndex: 10, maxWidth: 680, margin: "0 auto", padding: "40px 24px 100px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 2 }}>
            {session.pseudo}
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 48, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.pink}`, marginTop: 4 }}>
            HISTORIQUE
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
            {rows.length} partie{rows.length !== 1 ? "s" : ""} terminée{rows.length !== 1 ? "s" : ""}
          </div>
        </div>

        {rows.length === 0 && (
          <div style={{
            background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
            borderRadius: 20, padding: "40px 24px", textAlign: "center",
            boxShadow: `3px 3px 0 ${EA.ink}`,
          }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "rgba(255,255,255,0.4)", transform: "skewX(-4deg)" }}>
              Aucune partie jouée
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.3)", marginTop: 8 }}>
              Lance un défi depuis le lobby !
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((game) => {
            const isWin = game.winner_id === session.playerId;
            const isDraw = game.winner_id === null;
            const opponentId = game.challenger_id === session.playerId ? game.challenged_id : game.challenger_id;
            const opponentPseudo = game.challenger_id === session.playerId ? game.challenged_pseudo : game.challenger_pseudo;

            const resultColor = isDraw ? EA.butter : isWin ? EA.cyan : EA.pink;
            const resultLabel = isDraw ? "ÉGALITÉ" : isWin ? "VICTOIRE" : "DÉFAITE";
            const resultEmoji = isDraw ? "🤝" : isWin ? "🏆" : "💀";

            const date = new Date(game.created_at);
            const dateStr = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

            return (
              <div key={game.id} style={{
                background: EA.violetDeep,
                border: `2.5px solid ${EA.ink}`,
                borderRadius: 18, padding: "14px 16px",
                boxShadow: `2px 2px 0 ${EA.ink}`,
                display: "flex", alignItems: "center", gap: 14,
              }}>
                {/* Result badge */}
                <div style={{
                  background: resultColor, border: `2px solid ${EA.ink}`,
                  borderRadius: 12, padding: "6px 12px",
                  fontFamily: "var(--font-display)", fontSize: 12, color: EA.ink,
                  letterSpacing: 0.8, textAlign: "center", flexShrink: 0,
                  boxShadow: `2px 2px 0 ${EA.ink}`,
                  minWidth: 80,
                }}>
                  <div style={{ fontSize: 18, lineHeight: 1.2 }}>{resultEmoji}</div>
                  <div>{resultLabel}</div>
                </div>

                {/* Opponent info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Avatar name={opponentPseudo} src={game.opponent_avatar_url} color={EA.pink} ring="transparent" size={28} />
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 15, color: EA.white, transform: "skewX(-4deg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      vs {opponentPseudo.toUpperCase()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{
                      background:
                        game.game_type === "pfc"        ? EA.cyan :
                        game.game_type === "puissance4" ? EA.butter :
                        game.game_type === "reflexe"    ? EA.pink :
                        game.game_type === "naval"      ? "#0ea5e9" :
                        game.game_type === "chess"      ? "#9b8ec4" :
                        game.game_type === "nim"        ? EA.butter :
                        game.game_type === "pig"        ? EA.pink :
                        game.game_type === "mastermind" ? "#4ADE80" :
                        EA.pink,
                      border: `1.5px solid ${EA.ink}`, borderRadius: 999,
                      padding: "2px 8px", fontSize: 10,
                      fontFamily: "var(--font-display)", color: EA.ink, letterSpacing: 0.6,
                    }}>
                      {game.game_type === "pfc"        ? "✊ PFC" :
                       game.game_type === "puissance4" ? "🔴 P4" :
                       game.game_type === "reflexe"    ? "⚡ Réflexe" :
                       game.game_type === "naval"      ? "🚢 Naval" :
                       game.game_type === "chess"      ? "♟ Échecs" :
                       game.game_type === "nim"        ? "🔥 Nim" :
                       game.game_type === "pig"        ? "🐷 Cochon" :
                       game.game_type === "mastermind" ? "🎨 Mastermind" :
                       "⨯ Morpion"}
                    </div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>
                      {dateStr}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Back */}
        <div style={{ marginTop: 40, textAlign: "center" }}>
          <Link href="/ranking" style={{
            fontFamily: "var(--font-display)", fontSize: 18, color: EA.cyan,
            textDecoration: "none", display: "inline-block", transform: "skewX(-4deg)",
            borderBottom: `2px solid ${EA.cyan}`, paddingBottom: 2,
          }}>
            ← CLASSEMENT
          </Link>
        </div>
      </div>
    </div>
  );
}
