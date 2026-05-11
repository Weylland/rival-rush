"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { sendChallenge } from "./actions";
import { logout } from "@/app/(auth)/login/actions";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { EAButton } from "@/components/ui/ea-button";
import { SvgBlob } from "@/components/ui/blob";
import { Star } from "@/components/ui/star";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import type { GameType } from "@/types/database";

interface PresencePlayer {
  player_id: string;
  pseudo: string;
  status: "online" | "in-game";
}

interface LobbyClientProps {
  myPlayerId: string;
  myPseudo: string;
  myPoints: number;
  initialPlayers: PresencePlayer[];
}

const TIPS = [
  "Au PFC, observe le rythme de l'adversaire 👀",
  "Au Morpion, les coins valent de l'or 🎯",
  "Au P4, contrôle le centre pour gagner 🔴",
  "La victoire sourit aux audacieux ⚡",
];

function ChooseGameModal({
  opponent,
  onClose,
  onChoose,
  isPending,
  error,
}: {
  opponent: PresencePlayer;
  onClose: () => void;
  onChoose: (g: GameType) => void;
  isPending: boolean;
  error: string | null;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(26,15,94,0.75)",
      backdropFilter: "blur(3px)",
      zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "0 16px",
    }}>
      <div style={{
        width: "100%", maxWidth: 343,
        background: EA.violet,
        border: `3px solid ${EA.ink}`,
        borderRadius: 28,
        padding: "22px 18px 20px",
        boxShadow: `6px 6px 0 ${EA.pink}, 6px 6px 0 1px ${EA.ink}`,
        position: "relative",
      }}>
        <div style={{
          position: "absolute", inset: 4, borderRadius: 24,
          backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.35) 1px, transparent 1.4px)",
          backgroundSize: "12px 12px",
          pointerEvents: "none",
        }} />

        <button
          onClick={onClose}
          style={{
            position: "absolute", top: -12, right: -12,
            width: 36, height: 36, borderRadius: "50%",
            background: EA.white, border: `2.5px solid ${EA.ink}`,
            fontSize: 18, color: EA.ink, cursor: "pointer",
            boxShadow: `2px 2px 0 ${EA.ink}`, zIndex: 5,
          }}>×</button>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative", zIndex: 2 }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1.6 }}>
            Tu défies
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            background: EA.violetDeep,
            border: `2px solid ${EA.ink}`,
            borderRadius: 999,
            padding: "6px 18px 6px 6px",
            boxShadow: `3px 3px 0 ${EA.cyan}`,
          }}>
            <Avatar name={opponent.pseudo} color={EA.cyan} ring={EA.pink} size={36} />
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: EA.white, transform: "skewX(-4deg)" }}>
              {opponent.pseudo.toUpperCase()}
            </div>
          </div>

          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.pink}`, marginTop: 12 }}>
            CHOISIS TON JEU
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontStyle: "italic", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)", textAlign: "center" }}>
            Choisis le jeu, l'adversaire accepte
          </div>
        </div>

        {error && (
          <div style={{
            background: "rgba(255,30,140,0.15)", border: `2px solid ${EA.pink}`,
            borderRadius: 12, padding: "10px 14px", marginTop: 8,
            fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800,
            color: EA.white, textAlign: "center", position: "relative", zIndex: 2,
          }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 18, position: "relative", zIndex: 2, flexWrap: "wrap" }}>
          {([
            { type: "pfc" as GameType, icon: "✊✋✌", title: "PIERRE\nFEUILLE\nCISEAUX", sub: "Réflexes", color: EA.cyan, shadow: EA.pink, badge: "HOT 🔥" },
            { type: "morpion" as GameType, icon: "⨯⭕⨯", title: "MORPION", sub: "Tactique", color: EA.pink, shadow: EA.butter, badge: undefined },
            { type: "puissance4" as GameType, icon: "🔴🟡🔴", title: "PUISSANCE 4", sub: "Stratégie", color: EA.butter, shadow: EA.cyan, badge: "NEW ✨" },
          ] as { type: GameType; icon: string; title: string; sub: string; color: string; shadow: string; badge?: string }[]).map((g) => (
            <button
              key={g.type}
              onClick={() => !isPending && onChoose(g.type)}
              disabled={isPending}
              style={{
                flex: 1,
                background: g.color,
                border: `2.5px solid ${EA.ink}`,
                borderRadius: 22,
                padding: "16px 14px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                boxShadow: `4px 4px 0 ${g.shadow}, 4px 4px 0 1px ${EA.ink}`,
                cursor: isPending ? "wait" : "pointer",
                position: "relative",
                opacity: isPending ? 0.7 : 1,
              }}>
              {g.badge && (
                <div style={{
                  position: "absolute", top: -10, right: -8,
                  background: EA.butter, border: `2px solid ${EA.ink}`,
                  padding: "3px 8px", borderRadius: 999,
                  fontFamily: "var(--font-display)", fontSize: 9, color: EA.ink,
                  letterSpacing: 0.6, transform: "rotate(8deg)",
                  boxShadow: `2px 2px 0 ${EA.ink}`,
                }}>{g.badge}</div>
              )}
              <div style={{ fontSize: 38, lineHeight: 1 }}>{g.icon}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: EA.ink, textAlign: "center", transform: "skewX(-4deg)", lineHeight: 1.1, whiteSpace: "pre-line" }}>{g.title}</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 800, color: EA.ink, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.8 }}>{g.sub}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlayerRow({ p, idx, onChallenge, desktop }: { p: PresencePlayer; idx: number; onChallenge: () => void; desktop: boolean }) {
  const inGame = p.status === "in-game";
  const shadowColor = idx % 2 === 0 ? EA.cyan : EA.pink;
  return (
    <div style={{
      background: EA.white, border: `2.5px solid ${EA.ink}`,
      borderRadius: 22, padding: desktop ? "16px 20px" : "12px 14px",
      display: "flex", alignItems: "center", gap: desktop ? 16 : 12,
      boxShadow: `4px 4px 0 ${shadowColor}`,
      transform: idx % 2 === 0 ? "rotate(-0.6deg)" : "rotate(0.5deg)",
    }}>
      <Avatar name={p.pseudo} color={idx % 2 === 0 ? EA.cyan : EA.pink} ring={idx % 2 === 0 ? EA.pink : EA.cyan} size={desktop ? 56 : 44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 24 : 17, color: EA.ink, transform: "skewX(-4deg)" }}>
          {p.pseudo}
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: desktop ? 15 : 12, fontWeight: 800, color: inGame ? EA.pink : EA.violetDeep, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: inGame ? EA.pink : "#1ee29a",
            boxShadow: inGame ? "none" : "0 0 6px #1ee29a",
          }} />
          {inGame ? "En partie" : "En ligne"}
        </div>
      </div>
      <button
        onClick={inGame ? undefined : onChallenge}
        disabled={inGame}
        style={{
          fontFamily: "var(--font-display)", fontSize: desktop ? 17 : 13, letterSpacing: 0.6,
          color: inGame ? "rgba(26,15,94,0.4)" : EA.white,
          background: inGame ? "#e6e2f5" : EA.pink,
          border: `2px solid ${inGame ? "#bdb5da" : EA.ink}`,
          borderRadius: 999, padding: desktop ? "12px 22px" : "8px 14px",
          textTransform: "uppercase",
          cursor: inGame ? "not-allowed" : "pointer",
          boxShadow: inGame ? "none" : `2px 2px 0 ${EA.cyan}`,
        }}>
        {inGame ? "Occupé" : "Défier ⚔"}
      </button>
    </div>
  );
}

export function LobbyClient({ myPlayerId, myPseudo, myPoints, initialPlayers }: LobbyClientProps) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const [players, setPlayers] = useState<PresencePlayer[]>(initialPlayers);
  const [tab, setTab] = useState<"joueurs" | "classement">("joueurs");
  const [chooseOpponent, setChooseOpponent] = useState<PresencePlayer | null>(null);
  const [isPending, startTransition] = useTransition();
  const [challengeError, setChallengeError] = useState<string | null>(null);

  // Subscribe to realtime
  useEffect(() => {
    const supabase = createClient();

    // Fresh fetch on mount — initialPlayers is server-rendered before our presence upsert
    const cutoff = new Date(Date.now() - 90_000).toISOString();
    supabase.from("presence").select("*").gte("updated_at", cutoff).then(({ data }) => {
      if (data) setPlayers(data.filter((p) => p.player_id !== myPlayerId) as PresencePlayer[]);
    });

    // Subscribe to presence changes
    const presenceSub = supabase
      .channel("presence-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "presence" }, () => {
        const cutoff = new Date(Date.now() - 90_000).toISOString();
        supabase.from("presence").select("*").gte("updated_at", cutoff).then(({ data }) => {
          if (data) setPlayers(data.filter((p) => p.player_id !== myPlayerId) as PresencePlayer[]);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(presenceSub);
    };
  }, [myPlayerId]);

  const handleChooseGame = useCallback((gameType: GameType) => {
    if (!chooseOpponent) return;
    setChallengeError(null);
    startTransition(async () => {
      const result = await sendChallenge(chooseOpponent.player_id, gameType);
      if (result?.error) {
        setChallengeError(result.error);
      }
    });
  }, [chooseOpponent]);

  const visiblePlayers = players.filter((p) => p.player_id !== myPlayerId);
  const inGameCount = visiblePlayers.filter((p) => p.status === "in-game").length;

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden" }}>
      {/* Dot bg */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.3,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.55) 1.4px, transparent 1.8px)",
        backgroundSize: "16px 16px",
      }} />

      {/* Deco blobs */}
      <SvgBlob color={EA.pink} style={{ width: 520, height: 460, top: -220, right: -180, opacity: 0.7, animation: "ea-float 6s ease-in-out infinite" }} />
      <SvgBlob color={EA.butter} style={{ width: 420, height: 380, bottom: -180, left: -150, opacity: 0.5, animation: "ea-float 8s ease-in-out infinite reverse" }} path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />
      <SvgBlob color={EA.cyan} style={{ width: 320, height: 280, top: "38%", left: -130, opacity: 0.25, animation: "ea-float 11s ease-in-out infinite" }} />
      <Star color={EA.butter} size={38} style={{ top: "16%", left: "7%", animation: "ea-spin-slow 10s linear infinite" }} />
      <Star color={EA.cyan} size={26} style={{ top: "32%", right: "5%", animation: "ea-float 4s ease-in-out infinite" }} />
      <Star color={EA.white} size={20} style={{ bottom: "30%", left: "4%", transform: "rotate(15deg)", animation: "ea-spin-slow 16s linear infinite reverse" }} />
      <Star color={EA.pink} size={16} style={{ bottom: "14%", right: "7%", animation: "ea-float 7s ease-in-out infinite" }} />
      <Star color={EA.butter} size={14} style={{ top: "55%", left: "12%", animation: "ea-spin-slow 8s linear infinite" }} />
      <Star color={EA.white} size={12} style={{ top: "72%", right: "11%", transform: "rotate(-20deg)", animation: "ea-float 9s ease-in-out infinite reverse" }} />

      {/* Header */}
      <div style={{ position: "relative", zIndex: 10, maxWidth: desktop ? 680 : "100%", margin: "0 auto", padding: desktop ? "32px 40px 0" : "8px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: desktop ? 16 : 12, fontWeight: 800, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1.4 }}>
              Salut {myPseudo}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 52 : 32, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.pink}`, lineHeight: 1, marginTop: 2 }}>
              LE LOBBY
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: desktop ? 12 : 8 }}>
            <div style={{
              background: EA.cyan, border: `2px solid ${EA.ink}`,
              borderRadius: 14, padding: desktop ? "10px 18px" : "6px 12px",
              transform: "rotate(3deg)", boxShadow: `2px 2px 0 ${EA.ink}`,
            }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: desktop ? 13 : 10, fontWeight: 900, color: EA.violetDeep, textTransform: "uppercase", letterSpacing: 1 }}>
                Mes points
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 32 : 22, color: EA.violetDeep, transform: "skewX(-8deg)", lineHeight: 1 }}>
                {myPoints.toLocaleString("fr-FR")}
              </div>
            </div>
            <Link
              href="/games"
              title="Les jeux & règles"
              style={{
                width: desktop ? 44 : 38, height: desktop ? 44 : 38,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.08)", border: `2.5px solid ${EA.ink}`,
                color: "rgba(255,255,255,0.6)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                textDecoration: "none",
                boxShadow: `3px 3px 0 ${EA.ink}`,
                fontFamily: "var(--font-display)", fontSize: desktop ? 18 : 15,
                transition: "transform .1s, box-shadow .1s",
                flexShrink: 0,
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "translate(3px,3px)";
                e.currentTarget.style.boxShadow = "none";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow = `3px 3px 0 ${EA.ink}`;
              }}
            >?</Link>
            <Link
              href="/settings"
              title="Paramètres"
              style={{
                width: desktop ? 44 : 38, height: desktop ? 44 : 38,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.08)", border: `2.5px solid ${EA.ink}`,
                color: "rgba(255,255,255,0.6)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `3px 3px 0 ${EA.ink}`,
                textDecoration: "none",
                transition: "transform .1s, box-shadow .1s",
                flexShrink: 0,
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "translate(3px,3px)";
                e.currentTarget.style.boxShadow = "none";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow = `3px 3px 0 ${EA.ink}`;
              }}
            >
              <svg width={desktop ? 20 : 16} height={desktop ? 20 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
            <form action={logout}>
              <button
                type="submit"
                title="Se déconnecter"
                style={{
                  width: desktop ? 44 : 38, height: desktop ? 44 : 38,
                  borderRadius: "50%",
                  background: "rgba(255,30,140,0.12)", border: `2.5px solid ${EA.pink}`,
                  color: EA.pink, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `3px 3px 0 ${EA.ink}`,
                  padding: 0,
                  transition: "transform .1s, box-shadow .1s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translate(3px,3px)";
                  e.currentTarget.style.boxShadow = "none";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "";
                  e.currentTarget.style.boxShadow = `3px 3px 0 ${EA.ink}`;
                }}
              >
                <svg width={desktop ? 20 : 16} height={desktop ? 20 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M18.36 6.64A9 9 0 1 1 5.64 6.64" />
                  <line x1="12" y1="2" x2="12" y2="12" />
                </svg>
              </button>
            </form>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          marginTop: desktop ? 24 : 18,
          display: "flex", gap: 8,
          background: "rgba(26,15,94,0.55)",
          border: `2px solid ${EA.ink}`,
          borderRadius: 999, padding: 4,
        }}>
          {(["joueurs", "classement"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t === "classement") router.push("/ranking"); }}
              style={{
                flex: 1, textAlign: "center",
                background: tab === t ? EA.pink : "transparent",
                border: "none", borderRadius: 999, padding: desktop ? "12px 0" : "8px 0",
                fontFamily: "var(--font-display)", fontSize: desktop ? 18 : 13,
                color: tab === t ? EA.white : "rgba(255,255,255,0.65)",
                letterSpacing: 0.6, cursor: "pointer",
                boxShadow: tab === t ? `2px 2px 0 ${EA.cyan}` : "none",
              }}>
              {t === "joueurs"
                ? `JOUEURS · ${visiblePlayers.length - inGameCount} en ligne${inGameCount > 0 ? ` · ${inGameCount} en match` : ""}`
                : "CLASSEMENT"}
            </button>
          ))}
        </div>
      </div>

      {/* Player list */}
      <div style={{
        position: "relative", zIndex: 10,
        maxWidth: desktop ? 680 : "100%", margin: "0 auto",
        padding: desktop ? "16px 40px 120px" : "0 16px 100px",
        marginTop: 16,
        display: "flex", flexDirection: "column", gap: desktop ? 12 : 10,
      }}>
        {visiblePlayers.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "40px 20px",
            fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 800,
            color: "rgba(255,255,255,0.55)", fontStyle: "italic",
          }}>
            Personne d'autre pour l'instant...<br />
            <span style={{ fontSize: 11, opacity: 0.6 }}>Les joueurs apparaissent ici en temps réel</span>
          </div>
        ) : (
          visiblePlayers.map((p, i) => (
            <PlayerRow key={p.player_id} p={p} idx={i} onChallenge={() => setChooseOpponent(p)} desktop={desktop} />
          ))
        )}
      </div>

      {/* Match rapide sticky */}
      <div style={{
        position: "fixed", bottom: 20,
        left: desktop ? "50%" : 16,
        right: desktop ? "auto" : 16,
        transform: desktop ? "translateX(-50%)" : "none",
        width: desktop ? 640 : "auto",
        zIndex: 20,
        background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
        borderRadius: 22, padding: desktop ? "14px 20px" : "10px 14px",
        display: "flex", alignItems: "center", gap: desktop ? 14 : 10,
        boxShadow: `4px 4px 0 ${EA.pink}`,
      }}>
        <div style={{
          width: desktop ? 48 : 36, height: desktop ? 48 : 36, borderRadius: 10,
          background: EA.cyan, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: desktop ? 24 : 18, border: `2px solid ${EA.ink}`,
        }}>🎲</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 20 : 14, color: EA.white, lineHeight: 1 }}>MATCH RAPIDE</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: desktop ? 14 : 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>Adversaire au hasard</div>
        </div>
        <button
          onClick={() => {
            const available = visiblePlayers.filter((p) => p.status === "online");
            if (available.length > 0) setChooseOpponent(available[Math.floor(Math.random() * available.length)]);
          }}
          style={{
            fontFamily: "var(--font-display)", fontSize: desktop ? 24 : 18, color: EA.cyan,
            background: "none", border: "none", cursor: "pointer",
            transform: "skewX(-6deg)",
          }}>GO →</button>
      </div>

      {/* Modals */}
      {chooseOpponent && (
        <ChooseGameModal
          opponent={chooseOpponent}
          onClose={() => { setChooseOpponent(null); setChallengeError(null); }}
          onChoose={handleChooseGame}
          isPending={isPending}
          error={challengeError}
        />
      )}
    </div>
  );
}
