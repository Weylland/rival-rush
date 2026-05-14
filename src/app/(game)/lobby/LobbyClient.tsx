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
import { useChatOpen } from "@/app/(game)/chat/ChatSystem";
import { blockPlayer, unblockPlayer, reportPlayer } from "./actions";
import type { GameType } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

const GAME_LABELS: Record<string, string> = {
  pfc: "✊ Pierre Feuille Ciseaux",
  morpion: "⨯ Morpion",
  puissance4: "🔴 Puissance 4",
  reflexe: "⚡ Réflexe",
  naval: "🚢 Bataille Navale",
  chess: "♟ Échecs",
  nim: "🔥 Nim",
  pig: "🐷 Jeu du Cochon",
  mastermind: "🎨 Mastermind",
  "plus-ou-moins": "🔢 Plus ou Moins",
  "duel-des": "🎲 Duel de Dés",
};

interface PresencePlayer {
  player_id: string;
  pseudo: string;
  status: "online" | "in-game";
  game_type?: string | null;
}

interface LobbyPlayer {
  player_id: string;
  pseudo: string;
  status: "online" | "in-game" | "offline";
  avatar_url?: string | null;
  game_type?: string | null;
}

interface LobbyClientProps {
  myPlayerId: string;
  myPseudo: string;
  myAvatarUrl: string | null;
  myPoints: number;
  initialPlayers: PresencePlayer[];
  pushSubscriberIds: string[];
}

// ── Choose game modal ─────────────────────────────────────────────────────────

const TIME_CONTROLS = [
  { seconds: 60,  icon: "⚡", label: "Bullet", sub: "1 min" },
  { seconds: 180, icon: "🔥", label: "Blitz", sub: "3 min" },
  { seconds: 600, icon: "♟", label: "Rapide", sub: "10 min" },
  { seconds: null, icon: "∞", label: "Illimité", sub: "sans limite" },
] as const;

function ChooseGameModal({
  opponent, onClose, onChoose, isPending, error,
}: {
  opponent: LobbyPlayer;
  onClose: () => void;
  onChoose: (g: GameType, timeControl?: number | null) => void;
  isPending: boolean;
  error: string | null;
}) {
  const [chessStep, setChessStep] = useState(false);
  const desktop = useIsDesktop();
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(26,15,94,0.75)", backdropFilter: "blur(3px)",
      zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "16px 16px 24px", overflowY: "auto",
    }}>
      <div style={{
        width: "100%", maxWidth: desktop ? 580 : 343,
        background: EA.violet, border: `3px solid ${EA.ink}`,
        borderRadius: 28, padding: desktop ? "28px 28px 24px" : "22px 18px 20px",
        boxShadow: `6px 6px 0 ${EA.pink}, 6px 6px 0 1px ${EA.ink}`,
        position: "relative", marginTop: "auto", marginBottom: "auto",
        flexShrink: 0,
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
            <Avatar name={opponent.pseudo} src={opponent.avatar_url} color={EA.cyan} ring={EA.pink} size={36} />
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

        {/* Chess time-control sub-step */}
        {chessStep ? (
          <div style={{ marginTop: 18, position: "relative", zIndex: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => setChessStep(false)}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 20, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}
              >←</button>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: EA.white, transform: "skewX(-4deg)" }}>
                CADENCE ♟
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: desktop ? "repeat(4, 1fr)" : "1fr 1fr", gap: 10 }}>
              {TIME_CONTROLS.map(tc => (
                <button
                  key={String(tc.seconds)}
                  type="button"
                  onClick={() => !isPending && onChoose("chess", tc.seconds ?? null)}
                  disabled={isPending}
                  style={{
                    background: "#9b8ec4", border: `2.5px solid ${EA.ink}`,
                    borderRadius: 18, padding: "16px 12px",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    boxShadow: `4px 4px 0 ${EA.pink}, 4px 4px 0 1px ${EA.ink}`,
                    cursor: isPending ? "wait" : "pointer",
                    opacity: isPending ? 0.7 : 1,
                  }}
                >
                  <div style={{ fontSize: 32, lineHeight: 1 }}>{tc.icon}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: EA.ink, transform: "skewX(-4deg)" }}>{tc.label}</div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800, color: EA.ink, opacity: 0.7, textTransform: "uppercase" }}>{tc.sub}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (() => {
          const games = [
            { type: "pfc" as GameType,      icon: "✊",  title: "PIERRE\nFEUILLE\nCISEAUX", sub: "Réflexes",  color: EA.cyan,    shadow: EA.pink,   badge: "HOT 🔥" },
            { type: "morpion" as GameType,   icon: "⨯⭕", title: "MORPION",                  sub: "Tactique",  color: EA.pink,    shadow: EA.butter, badge: undefined },
            { type: "puissance4" as GameType,icon: "🔴",  title: "PUISSANCE 4",              sub: "Stratégie", color: EA.butter,  shadow: EA.cyan,   badge: undefined },
            { type: "reflexe" as GameType,   icon: "⚡",  title: "RÉFLEXE",                  sub: "Vitesse",   color: EA.pink,    shadow: EA.butter, badge: undefined },
            { type: "naval" as GameType,     icon: "🚢",  title: "BATAILLE\nNAVALE",         sub: "Stratégie", color: EA.cyan,    shadow: EA.butter, badge: undefined },
            { type: "chess" as GameType,     icon: "♟",   title: "ÉCHECS",                   sub: "Réflexion", color: "#9b8ec4",  shadow: EA.pink,   badge: undefined },
            { type: "nim" as GameType,       icon: "🔥",  title: "NIM",                      sub: "Prends la dernière allumette et tu perds", color: EA.butter, shadow: EA.cyan, badge: undefined },
            { type: "pig" as GameType,        icon: "🎲",  title: "COCHON",                    sub: "Lance le dé, mais gare au 1 !", color: EA.pink,   shadow: EA.butter, badge: undefined },
            { type: "mastermind" as GameType,     icon: "🎨",  title: "MASTER\nMIND",               sub: "Décode la combinaison",         color: "#4ADE80", shadow: EA.pink,   badge: undefined },
            { type: "plus-ou-moins" as GameType,  icon: "🔢",  title: "PLUS OU\nMOINS",             sub: "Trouve le nombre mystère",      color: EA.butter, shadow: EA.cyan,   badge: undefined },
            { type: "duel-des" as GameType,       icon: "🎲",  title: "DUEL\nDE DÉS",               sub: "Lance le dé, le plus haut gagne !",  color: EA.cyan,   shadow: EA.pink,   badge: "NEW ✨" },
          ] as { type: GameType; icon: string; title: string; sub: string; color: string; shadow: string; badge?: string }[];

          return (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: desktop ? 12 : 8,
              marginTop: 18, position: "relative", zIndex: 2,
            }}>
              {games.map((g) => (
                <button
                  key={g.type}
                  onClick={() => {
                    if (isPending) return;
                    if (g.type === "chess") { setChessStep(true); return; }
                    onChoose(g.type);
                  }}
                  disabled={isPending}
                  style={{
                    background: g.color, border: `2.5px solid ${EA.ink}`,
                    borderRadius: 20,
                    padding: desktop ? "18px 12px" : "12px 8px",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    gap: desktop ? 6 : 5,
                    boxShadow: `4px 4px 0 ${g.shadow}, 4px 4px 0 1px ${EA.ink}`,
                    cursor: isPending ? "wait" : "pointer", position: "relative",
                    opacity: isPending ? 0.7 : 1,
                  }}>
                  {g.badge && (
                    <div style={{
                      position: "absolute", top: -10, right: -8,
                      background: EA.violet, border: `2px solid ${EA.ink}`,
                      padding: "3px 8px", borderRadius: 999,
                      fontFamily: "var(--font-display)", fontSize: 9, color: EA.white,
                      letterSpacing: 0.6, transform: "rotate(8deg)",
                      boxShadow: `2px 2px 0 ${EA.ink}`,
                    }}>{g.badge}</div>
                  )}
                  <div style={{ fontSize: desktop ? 30 : 26, lineHeight: 1 }}>{g.icon}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 13 : 11, color: EA.ink, textAlign: "center", transform: "skewX(-4deg)", lineHeight: 1.1, whiteSpace: "pre-line" }}>{g.title}</div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 800, color: EA.ink, opacity: 0.65, textTransform: "uppercase", letterSpacing: 0.6 }}>{g.sub}</div>
                </button>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── Player row ────────────────────────────────────────────────────────────────

function PlayerRow({ p, idx, isBlocked, onChallenge, onDM, onBlock, onUnblock, onReport, desktop, hasPush }: {
  p: LobbyPlayer; idx: number; isBlocked: boolean;
  onChallenge: () => void; onDM: () => void;
  onBlock: () => void; onUnblock: () => void; onReport: () => void;
  desktop: boolean; hasPush: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inGame  = p.status === "in-game";
  const offline = p.status === "offline";
  const shadowColor = isBlocked ? "transparent" : offline ? "rgba(255,255,255,0.08)" : idx % 2 === 0 ? EA.cyan : EA.pink;

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  return (
    <div style={{
      background: isBlocked ? "rgba(255,255,255,0.03)" : offline ? "rgba(255,255,255,0.04)" : EA.white,
      border: `2.5px solid ${isBlocked || offline ? "rgba(255,255,255,0.1)" : EA.ink}`,
      borderRadius: 22, padding: desktop ? "16px 20px" : "12px 14px",
      display: "flex", alignItems: "center", gap: desktop ? 16 : 12,
      boxShadow: isBlocked || offline ? "none" : `4px 4px 0 ${shadowColor}`,
      transform: isBlocked || offline ? "none" : idx % 2 === 0 ? "rotate(-0.6deg)" : "rotate(0.5deg)",
      opacity: isBlocked ? 0.45 : offline ? 0.6 : 1,
      transition: "opacity 0.2s",
    }}>
      <Avatar
        name={p.pseudo}
        src={p.avatar_url}
        color={isBlocked ? "rgba(255,255,255,0.2)" : offline ? "rgba(255,255,255,0.2)" : idx % 2 === 0 ? EA.cyan : EA.pink}
        ring={isBlocked || offline ? "transparent" : idx % 2 === 0 ? EA.pink : EA.cyan}
        size={desktop ? 56 : 44}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 24 : 17, color: isBlocked || offline ? "rgba(255,255,255,0.5)" : EA.ink, transform: "skewX(-4deg)" }}>
          {p.pseudo}
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: desktop ? 15 : 12, fontWeight: 800, marginTop: 2, display: "flex", alignItems: "center", gap: 6, color: isBlocked ? "rgba(255,255,255,0.3)" : offline ? "rgba(255,255,255,0.35)" : inGame ? EA.pink : EA.violetDeep }}>
          {isBlocked ? (
            <span style={{ color: "rgba(255,255,255,0.3)" }}>🚫 Bloqué</span>
          ) : (
            <>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: offline ? "rgba(255,255,255,0.25)" : inGame ? EA.pink : "#1ee29a",
                boxShadow: offline || inGame ? "none" : "0 0 6px #1ee29a",
                flexShrink: 0,
              }} />
              {offline ? "Hors ligne" : inGame ? (p.game_type ? `En partie · ${GAME_LABELS[p.game_type] ?? p.game_type}` : "En partie") : "En ligne"}
            </>
          )}
        </div>
      </div>

      {/* Bouton DÉFIER — masqué si bloqué */}
      {!isBlocked && !inGame && (!offline || hasPush) && (
        <button
          onClick={onChallenge}
          style={{
            fontFamily: "var(--font-display)", fontSize: desktop ? 17 : 13, letterSpacing: 0.6,
            color: offline ? "rgba(255,255,255,0.7)" : EA.white,
            background: offline ? "rgba(255,255,255,0.08)" : EA.pink,
            border: `2px solid ${offline ? "rgba(255,255,255,0.2)" : EA.ink}`,
            borderRadius: 999, padding: desktop ? "12px 22px" : "8px 14px",
            textTransform: "uppercase", cursor: "pointer",
            boxShadow: offline ? "none" : `2px 2px 0 ${EA.cyan}`,
            whiteSpace: "nowrap",
          }}>
          {offline ? "Inviter 📬" : "Défier ⚔"}
        </button>
      )}

      {/* Menu ⋯ */}
      <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
        <button
          onClick={() => setMenuOpen(o => !o)}
          style={{
            width: desktop ? 36 : 30, height: desktop ? 36 : 30,
            borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            background: menuOpen ? EA.violetDeep : "rgba(0,0,0,0.12)",
            border: `2px solid ${menuOpen ? EA.ink : "rgba(0,0,0,0.15)"}`,
            color: menuOpen ? EA.white : EA.ink,
            fontSize: desktop ? 18 : 15, cursor: "pointer",
            fontWeight: 900, lineHeight: 1,
            boxShadow: menuOpen ? `2px 2px 0 ${EA.ink}` : "none",
            transition: "background 0.15s",
          }}
        >⋯</button>

        {menuOpen && (
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 50,
            background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
            borderRadius: 16, overflow: "hidden",
            boxShadow: `4px 4px 0 ${EA.ink}`,
            minWidth: 180,
          }}>
            {[
              { label: "💬 Message", action: () => { onDM(); setMenuOpen(false); }, color: EA.cyan },
              !isBlocked
                ? { label: "🚫 Bloquer", action: () => { onBlock(); setMenuOpen(false); }, color: EA.butter }
                : { label: "🔓 Débloquer", action: () => { onUnblock(); setMenuOpen(false); }, color: "#4ADE80" },
              { label: "⚠️ Signaler", action: () => { onReport(); setMenuOpen(false); }, color: EA.pink },
            ].map(({ label, action, color }) => (
              <button
                key={label}
                onClick={action}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: desktop ? "12px 16px" : "10px 14px",
                  background: "none", border: "none",
                  fontFamily: "var(--font-display)", fontSize: desktop ? 14 : 13,
                  color, cursor: "pointer",
                  borderBottom: label !== "⚠️ Signaler" ? `1px solid rgba(255,255,255,0.08)` : "none",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
              >{label}</button>
            ))}
          </div>
        )}
      </div>
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

export function LobbyClient({ myPlayerId, myPseudo, myAvatarUrl, myPoints, initialPlayers, pushSubscriberIds }: LobbyClientProps) {
  const router = useRouter();
  const desktop = useIsDesktop();
  const { openDM } = useChatOpen();

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
  const [allPlayers, setAllPlayers] = useState<{ player_id: string; pseudo: string; avatar_url?: string | null }[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [showOffline, setShowOffline] = useState(false);
  const [chooseOpponent, setChooseOpponent] = useState<LobbyPlayer | null>(null);
  const [isPending, startTransition] = useTransition();
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [quickMatchError, setQuickMatchError] = useState<string | null>(null);
  const quickMatchErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Blocks
  const [myBlocks, setMyBlocks] = useState<Set<string>>(new Set());
  const [reportTarget, setReportTarget] = useState<{ id: string; pseudo: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSent, setReportSent] = useState(false);

  // Fetch all players + subscribe to presence
  useEffect(() => {
    const supabase = createClient();

    // Load all registered players (for search + offline display)
    supabase.from("players").select("id, pseudo, avatar_url").then(({ data }) => {
      if (data) setAllPlayers(data.map(p => ({ player_id: p.id as string, pseudo: p.pseudo as string, avatar_url: (p.avatar_url as string | null) ?? null })));
    });

    supabase.from("blocks").select("blocked_id").eq("blocker_id", myPlayerId).then(({ data }) => {
      if (data) setMyBlocks(new Set(data.map(b => b.blocked_id as string)));
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
      return { player_id: p.player_id, pseudo: p.pseudo, status: (presence?.status ?? "offline") as LobbyPlayer["status"], avatar_url: p.avatar_url ?? null, game_type: presence?.game_type ?? null };
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
  const offlineWithPushCount = mergedPlayers.filter(p => p.status === "offline" && pushSubscriberIds.includes(p.player_id)).length;
  const hasChallengeable = availableCount > 0 || offlineWithPushCount > 0;

  const handleChooseGame = useCallback((gameType: GameType, timeControl?: number | null) => {
    if (!chooseOpponent) return;
    setChallengeError(null);
    startTransition(async () => {
      const result = await sendChallenge(chooseOpponent.player_id, gameType, timeControl);
      if (result?.error) setChallengeError(result.error);
    });
  }, [chooseOpponent]);

  function handleQuickMatch() {
    const online = onlinePlayers.filter(p => p.status === "online");
    if (online.length > 0) {
      setChooseOpponent(online[Math.floor(Math.random() * online.length)]);
      return;
    }

    // Fallback : offline players with push subscriptions
    const offlineWithPush = mergedPlayers.filter(
      p => p.status === "offline" && pushSubscriberIds.includes(p.player_id)
    );
    if (offlineWithPush.length > 0) {
      setChooseOpponent(offlineWithPush[Math.floor(Math.random() * offlineWithPush.length)]);
      return;
    }

    setQuickMatchError(
      inGameCount > 0
        ? "Tous les joueurs sont en match en ce moment"
        : "Personne de disponible — invite un ami !"
    );
    if (quickMatchErrorTimer.current) clearTimeout(quickMatchErrorTimer.current);
    quickMatchErrorTimer.current = setTimeout(() => setQuickMatchError(null), 3500);
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          {/* Left: title */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: desktop ? 16 : 12, fontWeight: 800, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1.4 }}>
              Salut {myPseudo}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 52 : 32, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.pink}`, lineHeight: 1, marginTop: 2 }}>
              LE LOBBY
            </div>
          </div>

          {/* Right: points + actions + avatar→settings */}
          <div style={{ display: "flex", alignItems: "center", gap: desktop ? 10 : 8 }}>
            {/* Points badge */}
            <div style={{
              background: EA.cyan, border: `2px solid ${EA.ink}`,
              borderRadius: 14, padding: desktop ? "8px 16px" : "5px 10px",
              transform: "rotate(2deg)", boxShadow: `2px 2px 0 ${EA.ink}`, flexShrink: 0,
            }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: desktop ? 11 : 9, fontWeight: 900, color: EA.violetDeep, textTransform: "uppercase", letterSpacing: 1 }}>
                Pts
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 26 : 18, color: EA.violetDeep, transform: "skewX(-8deg)", lineHeight: 1 }}>
                {myPoints.toLocaleString("fr-FR")}
              </div>
            </div>

            {/* Notif bell (conditional) */}
            {notifPermission !== null && notifPermission !== "granted" && (
              <button
                onClick={requestNotifPermission}
                title={notifPermission === "denied" ? "Notifications bloquées — autorise-les dans les réglages du navigateur" : "Activer les notifications de défi"}
                style={{
                  width: desktop ? 44 : 36, height: desktop ? 44 : 36, borderRadius: "50%",
                  background: notifPermission === "denied" ? "rgba(255,255,255,0.04)" : "rgba(255,233,74,0.15)",
                  border: `2.5px solid ${notifPermission === "denied" ? "rgba(255,255,255,0.15)" : EA.butter}`,
                  color: notifPermission === "denied" ? "rgba(255,255,255,0.25)" : EA.butter,
                  cursor: notifPermission === "denied" ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: desktop ? 18 : 14,
                  boxShadow: notifPermission === "denied" ? "none" : `3px 3px 0 ${EA.ink}`,
                  flexShrink: 0,
                }}
              >🔔</button>
            )}

            {/* Rooms */}
            <Link href="/room" title="Salles privées" style={{
              width: desktop ? 44 : 36, height: desktop ? 44 : 36, borderRadius: "50%",
              background: "rgba(255,255,255,0.08)", border: `2.5px solid ${EA.ink}`,
              color: "rgba(255,255,255,0.6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              textDecoration: "none", boxShadow: `3px 3px 0 ${EA.ink}`,
              fontFamily: "var(--font-display)", fontSize: desktop ? 18 : 14,
              transition: "transform .1s, box-shadow .1s", flexShrink: 0,
            }}
              onMouseOver={(e) => { e.currentTarget.style.transform = "translate(3px,3px)"; e.currentTarget.style.boxShadow = "none"; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = `3px 3px 0 ${EA.ink}`; }}
            >🏠</Link>

            {/* Rules */}
            <Link href="/games" title="Les jeux & règles" style={{
              width: desktop ? 44 : 36, height: desktop ? 44 : 36, borderRadius: "50%",
              background: "rgba(255,255,255,0.08)", border: `2.5px solid ${EA.ink}`,
              color: "rgba(255,255,255,0.6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              textDecoration: "none", boxShadow: `3px 3px 0 ${EA.ink}`,
              fontFamily: "var(--font-display)", fontSize: desktop ? 18 : 14,
              transition: "transform .1s, box-shadow .1s", flexShrink: 0,
            }}
              onMouseOver={(e) => { e.currentTarget.style.transform = "translate(3px,3px)"; e.currentTarget.style.boxShadow = "none"; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = `3px 3px 0 ${EA.ink}`; }}
            >?</Link>

            {/* Logout */}
            <form action={logout}>
              <button type="submit" title="Se déconnecter" style={{
                width: desktop ? 44 : 36, height: desktop ? 44 : 36, borderRadius: "50%",
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
                  <path d="M18.36 6.64A9 9 0 1 1 5.64 6.64" /><line x1="12" y1="2" x2="12" y2="12" />
                </svg>
              </button>
            </form>

            {/* Avatar → settings (remplace le gear) */}
            <Link href="/settings" title={`${myPseudo} · Paramètres`} style={{ textDecoration: "none", flexShrink: 0 }}>
              <Avatar name={myPseudo} src={myAvatarUrl} color={EA.butter} ring={EA.cyan} size={desktop ? 48 : 38} />
            </Link>
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
                ? `JOUEURS · ${availableCount}`
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
            <PlayerRow
              key={p.player_id}
              p={p}
              idx={i}
              isBlocked={myBlocks.has(p.player_id)}
              onChallenge={() => setChooseOpponent(p)}
              onDM={() => openDM(p.player_id, p.pseudo)}
              onBlock={() => {
                setMyBlocks(prev => new Set([...prev, p.player_id]));
                blockPlayer(p.player_id);
              }}
              onUnblock={() => {
                setMyBlocks(prev => { const next = new Set(prev); next.delete(p.player_id); return next; });
                unblockPlayer(p.player_id);
              }}
              onReport={() => { setReportTarget({ id: p.player_id, pseudo: p.pseudo }); setReportReason(""); setReportSent(false); }}
              desktop={desktop}
              hasPush={pushSubscriberIds.includes(p.player_id)}
            />
          ))
        )}
      </div>

      {/* Match rapide sticky */}
      <div style={{
        position: "fixed", bottom: 20,
        left: desktop ? "50%" : 80, right: desktop ? "auto" : 16,
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

        <button
          onClick={handleQuickMatch}
          style={{
            width: "100%",
            background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
            borderRadius: 22, padding: desktop ? "14px 20px" : "0 14px",
            height: desktop ? "auto" : 56,
            display: "flex", alignItems: "center", gap: desktop ? 14 : 10,
            boxShadow: `4px 4px 0 ${EA.pink}`,
            cursor: "pointer",
            textAlign: "left",
          }}>
          <div style={{
            width: desktop ? 48 : 36, height: desktop ? 48 : 36, borderRadius: 10,
            background: hasChallengeable ? EA.cyan : "rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: desktop ? 24 : 18, border: `2px solid ${EA.ink}`,
            flexShrink: 0,
            transition: "background 0.3s",
          }}>🎲</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 20 : 14, color: EA.white, lineHeight: 1 }}>MATCH RAPIDE</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: desktop ? 14 : 11, fontWeight: 700, color: hasChallengeable ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)", marginTop: 2 }}>
              {availableCount > 0
                ? `${availableCount} joueur${availableCount > 1 ? "s" : ""} disponible${availableCount > 1 ? "s" : ""}`
                : offlineWithPushCount > 0
                  ? `${offlineWithPushCount} joueur${offlineWithPushCount > 1 ? "s" : ""} à notifier`
                  : inGameCount > 0 ? "Tous en match en ce moment" : "Personne de disponible"}
            </div>
          </div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: desktop ? 24 : 18,
            color: hasChallengeable ? EA.cyan : "rgba(255,255,255,0.2)",
            transform: "skewX(-6deg)",
            flexShrink: 0,
            transition: "color 0.2s",
          }}>GO →</div>
        </button>
      </div>

      {/* Report modal */}
      {reportTarget && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(26,15,94,0.82)", backdropFilter: "blur(4px)",
          zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "16px",
        }}>
          <div style={{
            width: "100%", maxWidth: 400,
            background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
            borderRadius: 24, padding: "24px 22px",
            boxShadow: `6px 6px 0 ${EA.pink}, 6px 6px 0 1px ${EA.ink}`,
            position: "relative",
          }}>
            <button onClick={() => setReportTarget(null)} style={{
              position: "absolute", top: -12, right: -12,
              width: 34, height: 34, borderRadius: "50%",
              background: EA.white, border: `2px solid ${EA.ink}`,
              fontSize: 17, color: EA.ink, cursor: "pointer",
              boxShadow: `2px 2px 0 ${EA.ink}`,
            }}>×</button>

            {reportSent ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: EA.white }}>Signalement envoyé</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
                  Merci, nous examinerons la situation.
                </div>
                <button
                  onClick={() => setReportTarget(null)}
                  style={{
                    marginTop: 20, padding: "10px 24px", borderRadius: 999,
                    background: EA.cyan, border: `2px solid ${EA.ink}`,
                    fontFamily: "var(--font-display)", fontSize: 15, color: EA.ink,
                    cursor: "pointer", boxShadow: `2px 2px 0 ${EA.ink}`,
                  }}>
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: EA.pink, marginBottom: 4 }}>
                  ⚠️ Signaler {reportTarget.pseudo}
                </div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 16 }}>
                  Décris le problème rencontré
                </div>
                <textarea
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value)}
                  placeholder="Ex : comportement toxique, triche..."
                  maxLength={300}
                  rows={4}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "rgba(255,255,255,0.06)", border: `2px solid ${EA.ink}`,
                    borderRadius: 14, padding: "10px 12px", resize: "none",
                    fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                    color: EA.white, outline: "none",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                  <button
                    onClick={() => setReportTarget(null)}
                    style={{
                      padding: "10px 18px", borderRadius: 999,
                      background: "rgba(255,255,255,0.07)", border: `2px solid rgba(255,255,255,0.2)`,
                      fontFamily: "var(--font-display)", fontSize: 14, color: "rgba(255,255,255,0.6)",
                      cursor: "pointer",
                    }}>
                    Annuler
                  </button>
                  <button
                    onClick={async () => {
                      await reportPlayer(reportTarget.id, reportReason);
                      setReportSent(true);
                    }}
                    style={{
                      padding: "10px 22px", borderRadius: 999,
                      background: EA.pink, border: `2px solid ${EA.ink}`,
                      fontFamily: "var(--font-display)", fontSize: 14, color: EA.white,
                      cursor: "pointer", boxShadow: `2px 2px 0 ${EA.ink}`,
                    }}>
                    Envoyer ⚠️
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
