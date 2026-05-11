"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sendChallenge, acceptChallenge, declineChallenge } from "./actions";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { EAButton } from "@/components/ui/ea-button";
import { SvgBlob } from "@/components/ui/blob";
import { Star } from "@/components/ui/star";
import type { GameType } from "@/types/database";

interface PresencePlayer {
  player_id: string;
  pseudo: string;
  status: "online" | "in-game";
}

interface IncomingChallenge {
  id: string;
  challenger_id: string;
  challenger_pseudo: string;
  game_type: GameType;
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
  "La victoire sourit aux audacieux ⚡",
];

function ChooseGameModal({
  opponent,
  onClose,
  onChoose,
  isPending,
}: {
  opponent: PresencePlayer;
  onClose: () => void;
  onChoose: (g: GameType) => void;
  isPending: boolean;
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
            Best of 3 · 60 sec par manche
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 18, position: "relative", zIndex: 2 }}>
          {([
            { type: "pfc" as GameType, icon: "✊✋✌", title: "PIERRE\nFEUILLE\nCISEAUX", sub: "Réflexes", color: EA.cyan, shadow: EA.pink, badge: "HOT 🔥" },
            { type: "morpion" as GameType, icon: "⨯⭕⨯", title: "MORPION", sub: "Tactique", color: EA.pink, shadow: EA.butter, badge: undefined },
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

function ChallengeModal({
  challenge,
  onAccept,
  onDecline,
  isPending,
}: {
  challenge: IncomingChallenge;
  onAccept: () => void;
  onDecline: () => void;
  isPending: boolean;
}) {
  const [countdown, setCountdown] = useState(20);

  useEffect(() => {
    if (countdown <= 0) { onDecline(); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onDecline]);

  const gameLabel = challenge.game_type === "pfc" ? "PIERRE FEUILLE CISEAUX" : "MORPION";
  const gameIcon = challenge.game_type === "pfc" ? "✊✋✌" : "⨯⭕⨯";

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(26,15,94,0.7)",
      zIndex: 50,
    }}>
      {/* Banner top */}
      <div style={{
        position: "absolute", top: 30, left: 16, right: 16,
        background: EA.butter, border: `2.5px solid ${EA.ink}`,
        borderRadius: 16, padding: "8px 12px",
        textAlign: "center",
        fontFamily: "var(--font-display)", fontSize: 12, color: EA.ink, letterSpacing: 1.4,
        transform: "rotate(-1.5deg)",
        boxShadow: `4px 4px 0 ${EA.pink}`,
        zIndex: 30,
      }}>
        ⚡ DÉFI ENTRANT ⚡
      </div>

      {/* Modal */}
      <div style={{
        position: "absolute", left: 16, right: 16, top: 100,
        background: EA.pink, border: `3px solid ${EA.ink}`,
        borderRadius: 28, padding: "24px 18px 20px",
        boxShadow: `6px 6px 0 ${EA.cyan}, 6px 6px 0 1px ${EA.ink}`,
        zIndex: 20,
      }}>
        <div style={{
          position: "absolute", inset: 4, borderRadius: 24,
          backgroundImage: "radial-gradient(circle, rgba(255,233,74,0.35) 1px, transparent 1.4px)",
          backgroundSize: "12px 12px", pointerEvents: "none",
        }} />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative", zIndex: 2 }}>
          <div style={{ position: "relative", marginBottom: 4 }}>
            <div style={{
              position: "absolute", inset: -8, borderRadius: "50%",
              border: `3px dashed ${EA.butter}`,
              animation: "ea-spin 6s linear infinite",
            }} />
            <Avatar name={challenge.challenger_pseudo} color={EA.cyan} ring={EA.butter} size={84} />
          </div>

          <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.violetDeep}` }}>
            {challenge.challenger_pseudo.toUpperCase()}
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontStyle: "italic", fontSize: 14, fontWeight: 800, color: EA.white }}>
            te défie sur
          </div>

          <div style={{
            background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
            borderRadius: 16, padding: "8px 16px", marginTop: 4,
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: `3px 3px 0 ${EA.butter}`, transform: "rotate(-1deg)",
          }}>
            <div style={{ fontSize: 22 }}>{gameIcon}</div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: EA.white, transform: "skewX(-4deg)" }}>{gameLabel}</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 800, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>
                Best of 3 · 60 sec/manche
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: 1 }}>
              auto-refus dans
            </div>
            <div style={{
              background: EA.white, border: `2px solid ${EA.ink}`,
              borderRadius: 10, padding: "2px 8px",
              fontFamily: "var(--font-display)", fontSize: 16, color: countdown <= 5 ? EA.pink : EA.ink,
              transform: "skewX(-8deg)", boxShadow: `2px 2px 0 ${EA.cyan}`,
            }}>0:{String(countdown).padStart(2, "0")}</div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18, width: "100%" }}>
            <button
              onClick={onDecline}
              disabled={isPending}
              style={{
                flex: 1, fontFamily: "var(--font-display)", fontSize: 14,
                color: EA.white, background: EA.violetDeep,
                border: `2.5px solid ${EA.ink}`, borderRadius: 999,
                padding: "12px 0", textTransform: "uppercase", letterSpacing: 0.8,
                cursor: "pointer", boxShadow: `3px 3px 0 ${EA.ink}`,
              }}>Refuser</button>
            <button
              onClick={onAccept}
              disabled={isPending}
              style={{
                flex: 1.4, fontFamily: "var(--font-display)", fontSize: 16,
                color: EA.ink, background: EA.butter,
                border: `2.5px solid ${EA.ink}`, borderRadius: 999,
                padding: "12px 0", textTransform: "uppercase", letterSpacing: 0.8,
                cursor: isPending ? "wait" : "pointer",
                boxShadow: `4px 4px 0 ${EA.cyan}, 4px 4px 0 1px ${EA.ink}`,
                transform: "skewX(-4deg)",
                opacity: isPending ? 0.7 : 1,
              }}>
              <span style={{ display: "inline-block", transform: "skewX(4deg)" }}>⚔ J'accepte !</span>
            </button>
          </div>
        </div>
      </div>

      <Star color={EA.butter} size={22} style={{ top: 90, left: 22, transform: "rotate(15deg)" }} />
      <Star color={EA.cyan} size={16} style={{ bottom: 200, right: 20 }} />
    </div>
  );
}

function PlayerRow({ p, idx, onChallenge }: { p: PresencePlayer; idx: number; onChallenge: () => void }) {
  const inGame = p.status === "in-game";
  const shadowColor = idx % 2 === 0 ? EA.cyan : EA.pink;
  return (
    <div style={{
      background: EA.white, border: `2.5px solid ${EA.ink}`,
      borderRadius: 22, padding: "12px 14px",
      display: "flex", alignItems: "center", gap: 12,
      boxShadow: `4px 4px 0 ${shadowColor}`,
      transform: idx % 2 === 0 ? "rotate(-0.6deg)" : "rotate(0.5deg)",
    }}>
      <Avatar name={p.pseudo} color={idx % 2 === 0 ? EA.cyan : EA.pink} ring={idx % 2 === 0 ? EA.pink : EA.cyan} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: EA.ink, transform: "skewX(-4deg)" }}>
          {p.pseudo}
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800, color: inGame ? EA.pink : EA.violetDeep, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
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
          fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: 0.6,
          color: inGame ? "rgba(26,15,94,0.4)" : EA.white,
          background: inGame ? "#e6e2f5" : EA.pink,
          border: `2px solid ${inGame ? "#bdb5da" : EA.ink}`,
          borderRadius: 999, padding: "8px 14px",
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
  const [players, setPlayers] = useState<PresencePlayer[]>(initialPlayers);
  const [tab, setTab] = useState<"joueurs" | "classement">("joueurs");
  const [chooseOpponent, setChooseOpponent] = useState<PresencePlayer | null>(null);
  const [incomingChallenge, setIncomingChallenge] = useState<IncomingChallenge | null>(null);
  const [isPending, startTransition] = useTransition();

  // Join presence + subscribe to realtime
  useEffect(() => {
    const supabase = createClient();

    // Upsert presence on mount
    supabase.from("presence").upsert({
      player_id: myPlayerId,
      pseudo: myPseudo,
      status: "online",
      updated_at: new Date().toISOString(),
    }).then(() => {});

    // Delete presence on leave
    const handleUnload = () => {
      navigator.sendBeacon("/api/presence/leave", JSON.stringify({ playerId: myPlayerId }));
    };
    window.addEventListener("beforeunload", handleUnload);

    // Subscribe to presence changes
    const presenceSub = supabase
      .channel("presence-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "presence" }, () => {
        supabase.from("presence").select("*").then(({ data }) => {
          if (data) setPlayers(data.filter((p) => p.player_id !== myPlayerId) as PresencePlayer[]);
        });
      })
      .subscribe();

    // Subscribe to incoming challenges
    const challengeSub = supabase
      .channel("challenges-incoming")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "challenges",
        filter: `challenged_id=eq.${myPlayerId}`,
      }, async (payload) => {
        const c = payload.new as { id: string; challenger_id: string; game_type: GameType };
        const { data: challenger } = await supabase
          .from("players")
          .select("pseudo")
          .eq("id", c.challenger_id)
          .single();
        if (challenger) {
          setIncomingChallenge({
            id: c.id,
            challenger_id: c.challenger_id,
            challenger_pseudo: challenger.pseudo,
            game_type: c.game_type,
          });
        }
      })
      .subscribe();

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      supabase.removeChannel(presenceSub);
      supabase.removeChannel(challengeSub);
      supabase.from("presence").delete().eq("player_id", myPlayerId).then(() => {});
    };
  }, [myPlayerId, myPseudo]);

  const handleChooseGame = useCallback((gameType: GameType) => {
    if (!chooseOpponent) return;
    startTransition(async () => {
      await sendChallenge(chooseOpponent.player_id, gameType);
    });
  }, [chooseOpponent]);

  const handleAccept = useCallback(() => {
    if (!incomingChallenge) return;
    startTransition(async () => {
      await acceptChallenge(incomingChallenge.id);
    });
  }, [incomingChallenge]);

  const handleDecline = useCallback(() => {
    if (!incomingChallenge) return;
    declineChallenge(incomingChallenge.id);
    setIncomingChallenge(null);
  }, [incomingChallenge]);

  const visiblePlayers = players.filter((p) => p.player_id !== myPlayerId);

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden" }}>
      {/* Dot bg */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.3,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.55) 1.4px, transparent 1.8px)",
        backgroundSize: "16px 16px",
      }} />

      {/* Deco blobs */}
      <SvgBlob color={EA.pink} style={{ width: 200, height: 180, top: -70, right: -60, opacity: 0.9 }} />
      <Star color={EA.butter} size={20} style={{ top: 110, left: 30 }} />
      <Star color={EA.cyan} size={14} style={{ top: 180, right: 60 }} />

      {/* Header */}
      <div style={{ position: "relative", zIndex: 10, padding: "8px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1.4 }}>
              Salut {myPseudo}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 32, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.pink}`, lineHeight: 1, marginTop: 2 }}>
              LE LOBBY
            </div>
          </div>
          <div style={{
            background: EA.cyan, border: `2px solid ${EA.ink}`,
            borderRadius: 14, padding: "6px 12px",
            transform: "rotate(3deg)", boxShadow: `2px 2px 0 ${EA.ink}`,
          }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: EA.violetDeep, textTransform: "uppercase", letterSpacing: 1 }}>
              Mes points
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: EA.violetDeep, transform: "skewX(-8deg)", lineHeight: 1 }}>
              {myPoints.toLocaleString("fr-FR")}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          marginTop: 18,
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
                border: "none", borderRadius: 999, padding: "8px 0",
                fontFamily: "var(--font-display)", fontSize: 13,
                color: tab === t ? EA.white : "rgba(255,255,255,0.65)",
                letterSpacing: 0.6, cursor: "pointer",
                boxShadow: tab === t ? `2px 2px 0 ${EA.cyan}` : "none",
              }}>
              {t === "joueurs" ? `JOUEURS · ${visiblePlayers.length}` : "CLASSEMENT"}
            </button>
          ))}
        </div>
      </div>

      {/* Player list */}
      <div style={{
        position: "relative", zIndex: 10,
        margin: "16px 16px 100px",
        display: "flex", flexDirection: "column", gap: 10,
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
            <PlayerRow key={p.player_id} p={p} idx={i} onChallenge={() => setChooseOpponent(p)} />
          ))
        )}
      </div>

      {/* Match rapide sticky */}
      <div style={{
        position: "fixed", bottom: 20, left: 16, right: 16,
        zIndex: 20,
        background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
        borderRadius: 22, padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 10,
        boxShadow: `4px 4px 0 ${EA.pink}`,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: EA.cyan, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, border: `2px solid ${EA.ink}`,
        }}>🎲</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: EA.white, lineHeight: 1 }}>MATCH RAPIDE</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>Adversaire au hasard</div>
        </div>
        <button
          onClick={() => {
            const available = visiblePlayers.filter((p) => p.status === "online");
            if (available.length > 0) setChooseOpponent(available[Math.floor(Math.random() * available.length)]);
          }}
          style={{
            fontFamily: "var(--font-display)", fontSize: 18, color: EA.cyan,
            background: "none", border: "none", cursor: "pointer",
            transform: "skewX(-6deg)",
          }}>GO →</button>
      </div>

      {/* Modals */}
      {chooseOpponent && (
        <ChooseGameModal
          opponent={chooseOpponent}
          onClose={() => setChooseOpponent(null)}
          onChoose={handleChooseGame}
          isPending={isPending}
        />
      )}
      {incomingChallenge && !chooseOpponent && (
        <ChallengeModal
          challenge={incomingChallenge}
          onAccept={handleAccept}
          onDecline={handleDecline}
          isPending={isPending}
        />
      )}
    </div>
  );
}
