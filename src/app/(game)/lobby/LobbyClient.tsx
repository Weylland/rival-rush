"use client";

import { useEffect, useState, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { sendChallenge } from "./actions";
import { logout } from "@/app/(auth)/login/actions";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { SvgBlob } from "@/components/ui/blob";
import { Star } from "@/components/ui/star";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import type { GameType } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PresencePlayer {
  player_id: string;
  pseudo: string;
  status: "online" | "in-game";
}

interface LobbyPlayer {
  player_id: string;
  pseudo: string;
  status: "online" | "in-game" | "offline";
}

interface LobbyClientProps {
  myPlayerId: string;
  myPseudo: string;
  myPoints: number;
  initialPlayers: PresencePlayer[];
  pushSubscriberIds: string[];
}

// ── Choose game modal ─────────────────────────────────────────────────────────

function ChooseGameModal({
  opponent, onClose, onChoose, isPending, error,
}: {
  opponent: LobbyPlayer;
  onClose: () => void;
  onChoose: (g: GameType) => void;
  isPending: boolean;
  error: string | null;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(26,15,94,0.75)", backdropFilter: "blur(3px)",
      zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px",
    }}>
      <div style={{
        width: "100%", maxWidth: 343,
        background: EA.violet, border: `3px solid ${EA.ink}`,
        borderRadius: 28, padding: "22px 18px 20px",
        boxShadow: `6px 6px 0 ${EA.pink}, 6px 6px 0 1px ${EA.ink}`,
        position: "relative",
      }}>
        <div style={{
          position: "absolute", inset: 4, borderRadius: 24,
          backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.35) 1px, transparent 1.4px)",
          backgroundSize: "12px 12px", pointerEvents: "none",
        }} />

        <button onClick={onClose} style={{
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
            background: EA.violetDeep, border: `2px solid ${EA.ink}`,
            borderRadius: 999, padding: "6px 18px 6px 6px",
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
          }}>⚠ {error}</div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 18, position: "relative", zIndex: 2, flexWrap: "wrap" }}>
          {([
            { type: "pfc" as GameType, icon: "✊✋✌", title: "PIERRE\nFEUILLE\nCISEAUX", sub: "Réflexes", color: EA.cyan, shadow: EA.pink, badge: "HOT 🔥" },
            { type: "morpion" as GameType, icon: "⨯⭕⨯", title: "MORPION", sub: "Tactique", color: EA.pink, shadow: EA.butter, badge: undefined },
            { type: "puissance4" as GameType, icon: "🔴🟡🔴", title: "PUISSANCE 4", sub: "Stratégie", color: EA.butter, shadow: EA.cyan, badge: undefined },
            { type: "reflexe" as GameType, icon: "⚡⚡⚡", title: "RÉFLEXE", sub: "Vitesse", color: EA.pink, shadow: EA.butter, badge: undefined },
            { type: "naval" as GameType, icon: "🚢⚓🎯", title: "BATAILLE\nNAVALE", sub: "Stratégie", color: EA.cyan, shadow: EA.butter, badge: "NEW ✨" },
          ] as { type: GameType; icon: string; title: string; sub: string; color: string; shadow: string; badge?: string }[]).map((g) => (
            <button
              key={g.type}
              onClick={() => !isPending && onChoose(g.type)}
              disabled={isPending}
              style={{
                flex: 1, background: g.color, border: `2.5px solid ${EA.ink}`,
                borderRadius: 22, padding: "16px 14px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                boxShadow: `4px 4px 0 ${g.shadow}, 4px 4px 0 1px ${EA.ink}`,
                cursor: isPending ? "wait" : "pointer", position: "relative",
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

// ── Player row ────────────────────────────────────────────────────────────────

function PlayerRow({ p, idx, onChallenge, desktop, hasPush }: { p: LobbyPlayer; idx: number; onChallenge: () => void; desktop: boolean; hasPush: boolean }) {
  const inGame = p.status === "in-game";
  const offline = p.status === "offline";
  const shadowColor = offline ? "rgba(255,255,255,0.08)" : idx % 2 === 0 ? EA.cyan : EA.pink;

  return (
    <div style={{
      background: offline ? "rgba(255,255,255,0.04)" : EA.white,
      border: `2.5px solid ${offline ? "rgba(255,255,255,0.12)" : EA.ink}`,
      borderRadius: 22, padding: desktop ? "16px 20px" : "12px 14px",
      display: "flex", alignItems: "center", gap: desktop ? 16 : 12,
      boxShadow: offline ? "none" : `4px 4px 0 ${shadowColor}`,
      transform: offline ? "none" : idx % 2 === 0 ? "rotate(-0.6deg)" : "rotate(0.5deg)",
      opacity: offline ? 0.6 : 1,
      transition: "opacity 0.2s",
    }}>
      <Avatar
        name={p.pseudo}
        color={offline ? "rgba(255,255,255,0.2)" : idx % 2 === 0 ? EA.cyan : EA.pink}
        ring={offline ? "transparent" : idx % 2 === 0 ? EA.pink : EA.cyan}
        size={desktop ? 56 : 44}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 24 : 17, color: offline ? "rgba(255,255,255,0.6)" : EA.ink, transform: "skewX(-4deg)" }}>
          {p.pseudo}
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: desktop ? 15 : 12, fontWeight: 800, marginTop: 2, display: "flex", alignItems: "center", gap: 6, color: offline ? "rgba(255,255,255,0.35)" : inGame ? EA.pink : EA.violetDeep }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: offline ? "rgba(255,255,255,0.25)" : inGame ? EA.pink : "#1ee29a",
            boxShadow: offline || inGame ? "none" : "0 0 6px #1ee29a",
            flexShrink: 0,
          }} />
          {offline ? "Hors ligne" : inGame ? "En partie" : "En ligne"}
        </div>
      </div>
      {!inGame && (!offline || hasPush) && (
        <button
          onClick={onChallenge}
          style={{
            fontFamily: "var(--font-display)", fontSize: desktop ? 17 : 13, letterSpacing: 0.6,
            color: offline ? "rgba(255,255,255,0.7)" : EA.white,
            background: offline ? "rgba(255,255,255,0.08)" : EA.pink,
            border: `2px solid ${offline ? "rgba(255,255,255,0.2)" : EA.ink}`,
            borderRadius: 999, padding: desktop ? "12px 22px" : "8px 14px",
            textTransform: "uppercase",
            cursor: "pointer",
            boxShadow: offline ? "none" : `2px 2px 0 ${EA.cyan}`,
            whiteSpace: "nowrap",
          }}>
          {offline ? "Inviter 📬" : "Défier ⚔"}
        </button>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ searchQuery, showOffline, onlineCount }: { searchQuery: string; showOffline: boolean; onlineCount: number }) {
  if (searchQuery) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "rgba(255,255,255,0.55)", transform: "skewX(-4deg)" }}>
          Aucun joueur pour &quot;{searchQuery}&quot;
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>
          Vérifie l'orthographe du pseudo
        </div>
      </div>
    );
  }
  if (!showOffline && onlineCount === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>😴</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "rgba(255,255,255,0.55)", transform: "skewX(-4deg)" }}>
          Personne en ligne pour l'instant
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>
          Active <strong style={{ color: "rgba(255,255,255,0.55)" }}>Voir tous</strong> pour voir qui est inscrit
        </div>
      </div>
    );
  }
  return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>👻</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "rgba(255,255,255,0.55)", transform: "skewX(-4deg)" }}>
        Aucun autre joueur inscrit
      </div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>
        Invite des amis pour jouer !
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function LobbyClient({ myPlayerId, myPseudo, myPoints, initialPlayers, pushSubscriberIds }: LobbyClientProps) {
  const router = useRouter();
  const desktop = useIsDesktop();

  // Notification permission
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);
  useEffect(() => {
    if (typeof Notification !== "undefined") setNotifPermission(Notification.permission);
  }, []);

  async function requestNotifPermission() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  }

  // Presence (online/in-game)
  const [onlinePlayers, setOnlinePlayers] = useState<PresencePlayer[]>(
    initialPlayers.filter(p => p.player_id !== myPlayerId)
  );
  // All registered players (loaded async)
  const [allPlayers, setAllPlayers] = useState<{ player_id: string; pseudo: string }[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [showOffline, setShowOffline] = useState(false);
  const [chooseOpponent, setChooseOpponent] = useState<LobbyPlayer | null>(null);
  const [isPending, startTransition] = useTransition();
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [quickMatchError, setQuickMatchError] = useState<string | null>(null);
  const quickMatchErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch all players + subscribe to presence
  useEffect(() => {
    const supabase = createClient();

    // Load all registered players (for search + offline display)
    supabase.from("players").select("id, pseudo").then(({ data }) => {
      if (data) setAllPlayers(data.map(p => ({ player_id: p.id as string, pseudo: p.pseudo as string })));
    });

    // Fresh presence fetch
    const fetchPresence = () => {
      // 3-minute window: mobile browsers suspend background JS so the 25s
      // heartbeat can be delayed significantly. 180 s gives 7 missed beats.
      const cutoff = new Date(Date.now() - 180_000).toISOString();
      supabase.from("presence").select("*").gte("updated_at", cutoff).then(({ data }) => {
        if (data) setOnlinePlayers(data.filter((p) => p.player_id !== myPlayerId) as PresencePlayer[]);
      });
    };
    fetchPresence();

    const sub = supabase
      .channel("presence-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "presence" }, fetchPresence)
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [myPlayerId]);

  // Merge all players with presence data
  const mergedPlayers: LobbyPlayer[] = allPlayers
    .filter(p => p.player_id !== myPlayerId)
    .map(p => {
      const presence = onlinePlayers.find(op => op.player_id === p.player_id);
      return { player_id: p.player_id, pseudo: p.pseudo, status: (presence?.status ?? "offline") as LobbyPlayer["status"] };
    })
    .sort((a, b) => {
      const order = { online: 0, "in-game": 1, offline: 2 };
      return order[a.status] - order[b.status] || a.pseudo.localeCompare(b.pseudo);
    });

  // Filtered list for display
  const displayPlayers = mergedPlayers.filter(p => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || p.pseudo.toLowerCase().includes(q);
    // When searching, always show all (including offline)
    const matchesFilter = q || showOffline || p.status !== "offline";
    return matchesSearch && matchesFilter;
  });

  const onlineCount = onlinePlayers.length;
  const availableCount = onlinePlayers.filter(p => p.status === "online").length;
  const inGameCount = onlinePlayers.filter(p => p.status === "in-game").length;

  const handleChooseGame = useCallback((gameType: GameType) => {
    if (!chooseOpponent) return;
    setChallengeError(null);
    startTransition(async () => {
      const result = await sendChallenge(chooseOpponent.player_id, gameType);
      if (result?.error) setChallengeError(result.error);
    });
  }, [chooseOpponent]);

  function handleQuickMatch() {
    const available = onlinePlayers.filter(p => p.status === "online");
    if (available.length === 0) {
      setQuickMatchError(
        inGameCount > 0
          ? "Tous les joueurs sont en match en ce moment"
          : "Personne en ligne — invite un ami !"
      );
      if (quickMatchErrorTimer.current) clearTimeout(quickMatchErrorTimer.current);
      quickMatchErrorTimer.current = setTimeout(() => setQuickMatchError(null), 3500);
      return;
    }
    setChooseOpponent(available[Math.floor(Math.random() * available.length)]);
  }

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden" }}>
      {/* Dot bg */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.3,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.55) 1.4px, transparent 1.8px)",
        backgroundSize: "16px 16px",
      }} />

      <SvgBlob color={EA.pink} style={{ width: 520, height: 460, top: -220, right: -180, opacity: 0.7, animation: "ea-float 6s ease-in-out infinite" }} />
      <SvgBlob color={EA.butter} style={{ width: 420, height: 380, bottom: -180, left: -150, opacity: 0.5, animation: "ea-float 8s ease-in-out infinite reverse" }} path="M 50 30 Q 90 5 140 30 Q 195 50 180 110 Q 175 175 110 175 Q 30 180 25 120 Q 10 60 50 30 Z" />
      <SvgBlob color={EA.cyan} style={{ width: 320, height: 280, top: "38%", left: -130, opacity: 0.25, animation: "ea-float 11s ease-in-out infinite" }} />
      <Star color={EA.butter} size={38} style={{ top: "16%", left: "7%", animation: "ea-spin-slow 10s linear infinite" }} />
      <Star color={EA.cyan} size={26} style={{ top: "32%", right: "5%", animation: "ea-float 4s ease-in-out infinite" }} />
      <Star color={EA.white} size={20} style={{ bottom: "30%", left: "4%", transform: "rotate(15deg)", animation: "ea-spin-slow 16s linear infinite reverse" }} />
      <Star color={EA.pink} size={16} style={{ bottom: "14%", right: "7%", animation: "ea-float 7s ease-in-out infinite" }} />

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
            {notifPermission !== null && notifPermission !== "granted" && (
              <button
                onClick={requestNotifPermission}
                title={notifPermission === "denied" ? "Notifications bloquées — autorise-les dans les réglages du navigateur" : "Activer les notifications de défi"}
                style={{
                  width: desktop ? 44 : 38, height: desktop ? 44 : 38, borderRadius: "50%",
                  background: notifPermission === "denied" ? "rgba(255,255,255,0.04)" : "rgba(255,233,74,0.15)",
                  border: `2.5px solid ${notifPermission === "denied" ? "rgba(255,255,255,0.15)" : EA.butter}`,
                  color: notifPermission === "denied" ? "rgba(255,255,255,0.25)" : EA.butter,
                  cursor: notifPermission === "denied" ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: desktop ? 18 : 15,
                  boxShadow: notifPermission === "denied" ? "none" : `3px 3px 0 ${EA.ink}`,
                  flexShrink: 0,
                }}
              >🔔</button>
            )}
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
            <Link href="/games" title="Les jeux & règles" style={{
              width: desktop ? 44 : 38, height: desktop ? 44 : 38, borderRadius: "50%",
              background: "rgba(255,255,255,0.08)", border: `2.5px solid ${EA.ink}`,
              color: "rgba(255,255,255,0.6)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              textDecoration: "none", boxShadow: `3px 3px 0 ${EA.ink}`,
              fontFamily: "var(--font-display)", fontSize: desktop ? 18 : 15,
              transition: "transform .1s, box-shadow .1s", flexShrink: 0,
            }}
              onMouseOver={(e) => { e.currentTarget.style.transform = "translate(3px,3px)"; e.currentTarget.style.boxShadow = "none"; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = `3px 3px 0 ${EA.ink}`; }}
            >?</Link>
            <Link href="/settings" title="Paramètres" style={{
              width: desktop ? 44 : 38, height: desktop ? 44 : 38, borderRadius: "50%",
              background: "rgba(255,255,255,0.08)", border: `2.5px solid ${EA.ink}`,
              color: "rgba(255,255,255,0.6)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `3px 3px 0 ${EA.ink}`, textDecoration: "none",
              transition: "transform .1s, box-shadow .1s", flexShrink: 0,
            }}
              onMouseOver={(e) => { e.currentTarget.style.transform = "translate(3px,3px)"; e.currentTarget.style.boxShadow = "none"; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = `3px 3px 0 ${EA.ink}`; }}
            >
              <svg width={desktop ? 20 : 16} height={desktop ? 20 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
            <form action={logout}>
              <button type="submit" title="Se déconnecter" style={{
                width: desktop ? 44 : 38, height: desktop ? 44 : 38, borderRadius: "50%",
                background: "rgba(255,30,140,0.12)", border: `2.5px solid ${EA.pink}`,
                color: EA.pink, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `3px 3px 0 ${EA.ink}`, padding: 0,
                transition: "transform .1s, box-shadow .1s",
              }}
                onMouseOver={(e) => { e.currentTarget.style.transform = "translate(3px,3px)"; e.currentTarget.style.boxShadow = "none"; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = `3px 3px 0 ${EA.ink}`; }}
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
          marginTop: desktop ? 24 : 18, display: "flex", gap: 8,
          background: "rgba(26,15,94,0.55)", border: `2px solid ${EA.ink}`,
          borderRadius: 999, padding: 4,
        }}>
          {(["joueurs", "classement"] as const).map((t) => (
            <button key={t}
              onClick={() => { if (t === "classement") router.push("/ranking"); }}
              style={{
                flex: 1, textAlign: "center",
                background: t === "joueurs" ? EA.pink : "transparent",
                border: "none", borderRadius: 999, padding: desktop ? "12px 0" : "8px 0",
                fontFamily: "var(--font-display)", fontSize: desktop ? 18 : 13,
                color: t === "joueurs" ? EA.white : "rgba(255,255,255,0.65)",
                letterSpacing: 0.6, cursor: "pointer",
                boxShadow: t === "joueurs" ? `2px 2px 0 ${EA.cyan}` : "none",
              }}>
              {t === "joueurs"
                ? `JOUEURS · ${availableCount} en ligne${inGameCount > 0 ? ` · ${inGameCount} en match` : ""}`
                : "CLASSEMENT"}
            </button>
          ))}
        </div>

        {/* Search + filter */}
        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
          {/* Search input */}
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.07)", border: `2px solid ${searchQuery ? EA.cyan : "rgba(255,255,255,0.2)"}`,
            borderRadius: 14, padding: "8px 12px",
            transition: "border-color 0.15s",
          }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher un joueur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700,
                color: EA.white,
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} style={{
                background: "none", border: "none", cursor: "pointer",
                color: "rgba(255,255,255,0.45)", fontSize: 16, lineHeight: 1, padding: 0,
              }}>×</button>
            )}
          </div>

          {/* Toggle online / tous */}
          <button
            onClick={() => setShowOffline(v => !v)}
            title={showOffline ? "Masquer les joueurs hors ligne" : "Voir tous les joueurs"}
            style={{
              flexShrink: 0,
              background: showOffline ? EA.cyan : "rgba(255,255,255,0.07)",
              border: `2px solid ${showOffline ? EA.cyan : "rgba(255,255,255,0.2)"}`,
              borderRadius: 12, padding: "8px 12px",
              fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900,
              color: showOffline ? EA.ink : "rgba(255,255,255,0.55)",
              cursor: "pointer", letterSpacing: 0.5, textTransform: "uppercase",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}>
            {showOffline ? "🌐 Tous" : "🟢 En ligne"}
          </button>
        </div>
      </div>

      {/* Player list */}
      <div style={{
        position: "relative", zIndex: 10,
        maxWidth: desktop ? 680 : "100%", margin: "0 auto",
        padding: desktop ? "16px 40px 120px" : "0 16px 120px",
        marginTop: 12,
        display: "flex", flexDirection: "column", gap: desktop ? 12 : 10,
      }}>
        {displayPlayers.length === 0 ? (
          <EmptyState searchQuery={searchQuery.trim()} showOffline={showOffline} onlineCount={onlineCount} />
        ) : (
          displayPlayers.map((p, i) => (
            <PlayerRow key={p.player_id} p={p} idx={i} onChallenge={() => setChooseOpponent(p)} desktop={desktop} hasPush={pushSubscriberIds.includes(p.player_id)} />
          ))
        )}
      </div>

      {/* Match rapide sticky */}
      <div style={{
        position: "fixed", bottom: 20,
        left: desktop ? "50%" : 16, right: desktop ? "auto" : 16,
        transform: desktop ? "translateX(-50%)" : "none",
        width: desktop ? 640 : "auto",
        zIndex: 20,
      }}>
        {/* Erreur quick match */}
        {quickMatchError && (
          <div style={{
            background: "rgba(255,30,140,0.15)", border: `2px solid ${EA.pink}`,
            borderRadius: 14, padding: "10px 16px", marginBottom: 8,
            fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800,
            color: EA.white, textAlign: "center",
            boxShadow: `3px 3px 0 ${EA.ink}`,
          }}>
            😕 {quickMatchError}
          </div>
        )}

        <div style={{
          background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
          borderRadius: 22, padding: desktop ? "14px 20px" : "10px 14px",
          display: "flex", alignItems: "center", gap: desktop ? 14 : 10,
          boxShadow: `4px 4px 0 ${EA.pink}`,
        }}>
          <div style={{
            width: desktop ? 48 : 36, height: desktop ? 48 : 36, borderRadius: 10,
            background: availableCount > 0 ? EA.cyan : "rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: desktop ? 24 : 18, border: `2px solid ${EA.ink}`,
            transition: "background 0.3s",
          }}>🎲</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 20 : 14, color: EA.white, lineHeight: 1 }}>MATCH RAPIDE</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: desktop ? 14 : 11, fontWeight: 700, color: availableCount > 0 ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)", marginTop: 2 }}>
              {availableCount > 0
                ? `${availableCount} joueur${availableCount > 1 ? "s" : ""} disponible${availableCount > 1 ? "s" : ""}`
                : inGameCount > 0 ? "Tous en match en ce moment" : "Personne en ligne"}
            </div>
          </div>
          <button
            onClick={handleQuickMatch}
            style={{
              fontFamily: "var(--font-display)", fontSize: desktop ? 24 : 18,
              color: availableCount > 0 ? EA.cyan : "rgba(255,255,255,0.2)",
              background: "none", border: "none",
              cursor: availableCount > 0 ? "pointer" : "not-allowed",
              transform: "skewX(-6deg)",
              transition: "color 0.2s",
            }}>GO →</button>
        </div>
      </div>

      {/* Challenge modal */}
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
