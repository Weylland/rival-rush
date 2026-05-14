"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import { SvgBlob } from "@/components/ui/blob";
import { Star } from "@/components/ui/star";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useChatOpen } from "@/app/(game)/chat/ChatSystem";
import { sendChallenge } from "@/app/(game)/lobby/actions";
import { leaveRoom, inviteToRoom, kickMember, transferHost, deleteRoom } from "../actions";
import type { GameType } from "@/types/database";

const GAME_LABELS: Record<string, string> = {
  pfc: "✊ PFC", morpion: "⨯ Morpion", puissance4: "🔴 P4",
  reflexe: "⚡ Réflexe", naval: "🚢 Naval", chess: "♟ Échecs",
  nim: "🔥 Nim", pig: "🐷 Cochon", mastermind: "🎨 Mastermind",
  "plus-ou-moins": "🔢 +/-", "duel-des": "🎲 Dés",
};

interface RoomInfo {
  id: string; name: string; code: string; hostId: string;
  isPublic: boolean; hasPassword: boolean;
  maxMembers: number | null; allowedGames: string[] | null;
  expiresAt: string | null; isOpen: boolean;
}

interface Member {
  player_id: string; pseudo: string; avatar_url: string | null;
  joined_at: string; status: "online" | "in-game" | "offline";
  game_type: string | null;
  globalWins: number; globalLosses: number; globalPoints: number;
  roomWins: number; roomLosses: number; roomDraws: number; roomPoints: number;
}

// ── Countdown ─────────────────────────────────────────────────────────────────

function useCountdown(expiresAt: string | null) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setLabel("Expirée"); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      if (h > 24) setLabel(`${Math.floor(h / 24)}j ${h % 24}h`);
      else if (h > 0) setLabel(`${h}h ${m}min`);
      else setLabel(`${m}min`);
    };
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return expiresAt ? label : null;
}

// ── Choose game modal (adapted from LobbyClient) ──────────────────────────────

const TIME_CONTROLS = [
  { seconds: 60, icon: "⚡", label: "Bullet", sub: "1 min" },
  { seconds: 180, icon: "🔥", label: "Blitz", sub: "3 min" },
  { seconds: 600, icon: "♟", label: "Rapide", sub: "10 min" },
  { seconds: null, icon: "∞", label: "Illimité", sub: "sans limite" },
] as const;

function ChooseGameModal({ opponent, allowedGames, onClose, onChoose, isPending, error }: {
  opponent: Member;
  allowedGames: string[] | null;
  onClose: () => void;
  onChoose: (g: GameType, tc?: number | null) => void;
  isPending: boolean;
  error: string | null;
}) {
  const [chessStep, setChessStep] = useState(false);
  const desktop = useIsDesktop();

  const allGames = [
    { type: "pfc" as GameType, icon: "✊", title: "PFC", sub: "Réflexes", color: EA.cyan, shadow: EA.pink },
    { type: "morpion" as GameType, icon: "⨯⭕", title: "MORPION", sub: "Tactique", color: EA.pink, shadow: EA.butter },
    { type: "puissance4" as GameType, icon: "🔴", title: "PUISSANCE 4", sub: "Stratégie", color: EA.butter, shadow: EA.cyan },
    { type: "reflexe" as GameType, icon: "⚡", title: "RÉFLEXE", sub: "Vitesse", color: EA.pink, shadow: EA.butter },
    { type: "naval" as GameType, icon: "🚢", title: "NAVAL", sub: "Stratégie", color: EA.cyan, shadow: EA.butter },
    { type: "chess" as GameType, icon: "♟", title: "ÉCHECS", sub: "Réflexion", color: "#9b8ec4", shadow: EA.pink },
    { type: "nim" as GameType, icon: "🔥", title: "NIM", sub: "Allumettes", color: EA.butter, shadow: EA.cyan },
    { type: "pig" as GameType, icon: "🎲", title: "COCHON", sub: "Dé", color: EA.pink, shadow: EA.butter },
    { type: "mastermind" as GameType, icon: "🎨", title: "MASTERMIND", sub: "Code", color: "#4ADE80", shadow: EA.pink },
    { type: "plus-ou-moins" as GameType, icon: "🔢", title: "PLUS/MOINS", sub: "Nombre", color: EA.butter, shadow: EA.cyan },
    { type: "duel-des" as GameType, icon: "🎲", title: "DUEL DÉS", sub: "Simultané", color: EA.cyan, shadow: EA.pink },
  ];

  const games = allowedGames
    ? allGames.filter(g => allowedGames.includes(g.type))
    : allGames;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,15,94,0.8)", backdropFilter: "blur(3px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 520, background: EA.violet, border: `3px solid ${EA.ink}`, borderRadius: 28, padding: "24px 20px", boxShadow: `6px 6px 0 ${EA.pink}, 6px 6px 0 1px ${EA.ink}`, position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: -12, right: -12, width: 34, height: 34, borderRadius: "50%", background: EA.white, border: `2.5px solid ${EA.ink}`, fontSize: 18, color: EA.ink, cursor: "pointer", boxShadow: `2px 2px 0 ${EA.ink}` }}>×</button>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1.4 }}>Défier</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: EA.white }}>{opponent.pseudo.toUpperCase()}</div>
        </div>
        {error && <div style={{ background: "rgba(255,30,140,0.15)", border: `2px solid ${EA.pink}`, borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800, color: EA.white, textAlign: "center" }}>⚠ {error}</div>}
        {chessStep ? (
          <div>
            <button type="button" onClick={() => setChessStep(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 20, cursor: "pointer", marginBottom: 10 }}>← Cadence</button>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
              {TIME_CONTROLS.map(tc => (
                <button key={String(tc.seconds)} type="button" onClick={() => !isPending && onChoose("chess", tc.seconds ?? null)} disabled={isPending}
                  style={{ background: "#9b8ec4", border: `2.5px solid ${EA.ink}`, borderRadius: 16, padding: "14px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, boxShadow: `3px 3px 0 ${EA.pink}`, cursor: "pointer" }}>
                  <div style={{ fontSize: 28 }}>{tc.icon}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: EA.ink }}>{tc.label}</div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 800, color: EA.ink, opacity: 0.7 }}>{tc.sub}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: desktop ? "repeat(4,1fr)" : "repeat(3,1fr)", gap: 8 }}>
            {games.map(g => (
              <button key={g.type} onClick={() => { if (isPending) return; if (g.type === "chess") { setChessStep(true); return; } onChoose(g.type); }} disabled={isPending}
                style={{ background: g.color, border: `2.5px solid ${EA.ink}`, borderRadius: 16, padding: "12px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, boxShadow: `3px 3px 0 ${g.shadow}, 3px 3px 0 1px ${EA.ink}`, cursor: "pointer", opacity: isPending ? 0.7 : 1 }}>
                <div style={{ fontSize: 24 }}>{g.icon}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 11, color: EA.ink, textAlign: "center" }}>{g.title}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RoomClient({ room, members: initialMembers, myPlayerId, myPseudo, pendingInvitations }: {
  room: RoomInfo;
  members: Member[];
  myPlayerId: string;
  myPseudo: string;
  pendingInvitations: { id: string; invited_player_id: string; invited_by_id: string; expires_at: string }[];
}) {
  const desktop = useIsDesktop();
  const router = useRouter();
  const { openDM } = useChatOpen();
  const countdown = useCountdown(room.expiresAt);
  const isHost = room.hostId === myPlayerId;

  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [tab, setTab] = useState<"members" | "ranking">("members");
  const [chooseOpponent, setChooseOpponent] = useState<Member | null>(null);
  const [isPending, startTransition] = useTransition();
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [leavePending, startLeave] = useTransition();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Invite players panel
  const [showInvite, setShowInvite] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState<{ player_id: string; pseudo: string; avatar_url?: string | null }[]>([]);
  const [invitePending, setInvitePending] = useState<Set<string>>(new Set());
  const [inviteSent, setInviteSent] = useState<Set<string>>(new Set());

  // Member menu
  const [memberMenu, setMemberMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Copied code
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!memberMenu) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMemberMenu(null);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [memberMenu]);

  // Realtime: member joins/leaves
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(`room-members-${room.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${room.id}` }, () => {
        router.refresh();
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [room.id, router]);

  // Fetch online players for invite
  useEffect(() => {
    if (!showInvite) return;
    const supabase = createClient();
    const memberIds = new Set(members.map(m => m.player_id));
    supabase.from("presence").select("player_id, pseudo").neq("player_id", myPlayerId).then(({ data }) => {
      if (data) {
        setOnlinePlayers(data.filter(p => !memberIds.has(p.player_id as string)).map(p => ({ player_id: p.player_id as string, pseudo: p.pseudo as string })));
      }
    });
  }, [showInvite, members, myPlayerId]);

  function handleChooseGame(gameType: GameType, timeControl?: number | null) {
    if (!chooseOpponent) return;
    setChallengeError(null);
    startTransition(async () => {
      const result = await sendChallenge(chooseOpponent.player_id, gameType, timeControl);
      if (result?.error) setChallengeError(result.error);
    });
  }

  async function handleInvite(playerId: string) {
    setInvitePending(prev => new Set([...prev, playerId]));
    await inviteToRoom(room.id, playerId);
    setInvitePending(prev => { const n = new Set(prev); n.delete(playerId); return n; });
    setInviteSent(prev => new Set([...prev, playerId]));
  }

  function copyCode() {
    navigator.clipboard.writeText(room.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const me = members.find(m => m.player_id === myPlayerId);
  const rankedMembers = [...members].sort((a, b) => b.roomPoints - a.roomPoints || b.roomWins - a.roomWins);

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: EA.violet, overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.3, backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.55) 1.4px, transparent 1.8px)", backgroundSize: "16px 16px" }} />
      <SvgBlob color={EA.pink} style={{ width: 480, height: 420, top: -200, right: -150, opacity: 0.6, animation: "ea-float 6s ease-in-out infinite" }} />
      <SvgBlob color={EA.butter} style={{ width: 360, height: 320, bottom: -160, left: -120, opacity: 0.4, animation: "ea-float 9s ease-in-out infinite reverse" }} />
      <Star color={EA.cyan} size={28} style={{ top: "14%", left: "5%", animation: "ea-spin-slow 12s linear infinite" }} />
      <Star color={EA.pink} size={18} style={{ top: "38%", right: "4%", animation: "ea-float 5s ease-in-out infinite" }} />

      <div style={{ position: "relative", zIndex: 10, maxWidth: desktop ? 700 : "100%", margin: "0 auto", padding: desktop ? "28px 40px 100px" : "12px 16px 100px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: desktop ? 20 : 14 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: desktop ? 11 : 9, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 2 }}>
              {room.isPublic ? "🌐 Salle publique" : "🔒 Salle privée"}{room.hasPassword ? " · 🔑" : ""}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 36 : 24, color: EA.white, transform: "skewX(-6deg)", textShadow: `3px 3px 0 ${EA.pink}`, lineHeight: 1.1 }}>
              {room.name.toUpperCase()}
            </div>
            {countdown && (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800, color: EA.butter, marginTop: 4 }}>
                ⏱ Expire dans {countdown}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
            {/* Code badge — click to copy */}
            <button onClick={copyCode} title="Copier le code" style={{
              background: copied ? "#4ADE80" : EA.butter, border: `2px solid ${EA.ink}`,
              borderRadius: 12, padding: desktop ? "8px 14px" : "6px 10px",
              fontFamily: "var(--font-display)", fontSize: desktop ? 18 : 13,
              color: EA.ink, cursor: "pointer", letterSpacing: 3,
              boxShadow: `2px 2px 0 ${EA.ink}`, transition: "background .2s",
              transform: "rotate(1deg)",
            }}>
              {copied ? "✓ Copié !" : room.code}
            </button>

            {/* Back */}
            <Link href="/lobby" style={{
              textDecoration: "none", width: desktop ? 40 : 34, height: desktop ? 40 : 34,
              borderRadius: "50%", background: "rgba(255,255,255,0.08)",
              border: `2px solid rgba(255,255,255,0.2)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-display)", fontSize: desktop ? 16 : 13,
              color: "rgba(255,255,255,0.6)",
            }}>←</Link>
          </div>
        </div>

        {/* Stats bar (my room stats) */}
        {me && (
          <div style={{
            background: EA.violetDeep, border: `2px solid ${EA.ink}`,
            borderRadius: 16, padding: desktop ? "12px 18px" : "10px 14px",
            display: "flex", gap: desktop ? 20 : 12, alignItems: "center",
            marginBottom: 16,
            boxShadow: `3px 3px 0 ${EA.cyan}`,
          }}>
            <Avatar name={myPseudo} src={me.avatar_url} color={EA.cyan} ring={EA.pink} size={desktop ? 40 : 32} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1 }}>Mes stats dans cette salle</div>
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                {[
                  { label: "V", value: me.roomWins, color: "#4ADE80" },
                  { label: "D", value: me.roomLosses, color: EA.pink },
                  { label: "=", value: me.roomDraws, color: EA.butter },
                  { label: "pts", value: me.roomPoints, color: EA.cyan },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 20 : 16, color: s.color }}>{s.value}</div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {isHost && (
              <Link href={`/room/${room.code}/settings`} style={{
                textDecoration: "none", background: "rgba(255,255,255,0.08)",
                border: `2px solid rgba(255,255,255,0.2)`, borderRadius: 10,
                padding: desktop ? "8px 14px" : "6px 10px",
                fontFamily: "var(--font-display)", fontSize: desktop ? 13 : 11,
                color: "rgba(255,255,255,0.7)",
              }}>⚙ Gérer</Link>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", background: "rgba(26,15,94,0.55)", border: `2px solid ${EA.ink}`, borderRadius: 999, padding: 4, marginBottom: 16 }}>
          {(["members", "ranking"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, background: tab === t ? EA.pink : "transparent",
              border: "none", borderRadius: 999, padding: desktop ? "11px 0" : "8px 0",
              fontFamily: "var(--font-display)", fontSize: desktop ? 16 : 13,
              color: tab === t ? EA.white : "rgba(255,255,255,0.55)",
              cursor: "pointer", boxShadow: tab === t ? `2px 2px 0 ${EA.cyan}` : "none",
            }}>
              {t === "members" ? `👥 MEMBRES · ${members.length}${room.maxMembers ? `/${room.maxMembers}` : ""}` : "🏆 CLASSEMENT"}
            </button>
          ))}
        </div>

        {/* ── MEMBERS TAB ── */}
        {tab === "members" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {members.filter(m => m.player_id !== myPlayerId).map((m, i) => {
              const inGame = m.status === "in-game";
              const offline = m.status === "offline";
              const shadowColor = offline ? "transparent" : i % 2 === 0 ? EA.cyan : EA.pink;

              // Menu items: everyone gets Message; host also gets Transfer + Kick
              const menuItems = [
                { label: "💬 Message", action: () => { openDM(m.player_id, m.pseudo); setMemberMenu(null); }, color: EA.cyan },
                ...(isHost ? [
                  { label: "👑 Passer hôte", action: () => { startTransition(async () => { await transferHost(room.id, m.player_id); router.refresh(); }); setMemberMenu(null); }, color: EA.butter },
                  { label: "🚫 Exclure", action: () => { startTransition(async () => { await kickMember(room.id, m.player_id); setMembers(prev => prev.filter(x => x.player_id !== m.player_id)); }); setMemberMenu(null); }, color: EA.pink },
                ] : []),
              ];

              return (
                <div key={m.player_id} style={{
                  background: offline ? "rgba(255,255,255,0.04)" : EA.white,
                  border: `2.5px solid ${offline ? "rgba(255,255,255,0.1)" : EA.ink}`,
                  borderRadius: 20, padding: desktop ? "14px 18px" : "11px 14px",
                  display: "flex", alignItems: "center", gap: 12,
                  boxShadow: offline ? "none" : `4px 4px 0 ${shadowColor}`,
                  transform: offline ? "none" : i % 2 === 0 ? "rotate(-0.5deg)" : "rotate(0.4deg)",
                  opacity: offline ? 0.6 : 1,
                }}>
                  <Avatar
                    name={m.pseudo} src={m.avatar_url}
                    color={offline ? "rgba(255,255,255,0.2)" : i % 2 === 0 ? EA.cyan : EA.pink}
                    ring={offline ? "transparent" : i % 2 === 0 ? EA.pink : EA.cyan}
                    size={desktop ? 50 : 40}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 20 : 15, color: offline ? "rgba(255,255,255,0.5)" : EA.ink, transform: "skewX(-3deg)" }}>
                        {m.pseudo}
                      </div>
                      {m.player_id === room.hostId && (
                        <span style={{ background: EA.butter, border: `1.5px solid ${EA.ink}`, borderRadius: 999, padding: "1px 7px", fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900, color: EA.ink, letterSpacing: 0.5 }}>HÔTE</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: desktop ? 12 : 10, fontWeight: 800, color: offline ? "rgba(255,255,255,0.35)" : inGame ? EA.pink : EA.violetDeep, display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: offline ? "rgba(255,255,255,0.2)" : inGame ? EA.pink : "#1ee29a", flexShrink: 0 }} />
                        {offline ? "Hors ligne" : inGame ? (m.game_type ? `En partie · ${GAME_LABELS[m.game_type] ?? m.game_type}` : "En partie") : "En ligne"}
                      </div>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: desktop ? 11 : 9, fontWeight: 800, color: offline ? "rgba(255,255,255,0.25)" : "rgba(26,15,94,0.55)" }}>
                        {m.roomWins}V · {m.roomLosses}D · {m.roomPoints}pts
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {!inGame && (
                      <button onClick={() => { setChallengeError(null); setChooseOpponent(m); }} style={{
                        fontFamily: "var(--font-display)", fontSize: desktop ? 14 : 11,
                        color: offline ? "rgba(255,255,255,0.7)" : EA.white,
                        background: offline ? "rgba(255,255,255,0.08)" : EA.pink,
                        border: `2px solid ${offline ? "rgba(255,255,255,0.2)" : EA.ink}`,
                        borderRadius: 999, padding: desktop ? "9px 18px" : "7px 12px",
                        cursor: "pointer", whiteSpace: "nowrap",
                        boxShadow: offline ? "none" : `2px 2px 0 ${EA.cyan}`,
                      }}>Défier ⚔</button>
                    )}

                    {/* ⋯ menu — tous les membres */}
                    <div ref={m.player_id === memberMenu ? menuRef : undefined} style={{ position: "relative" }}>
                      <button
                        onClick={() => setMemberMenu(prev => prev === m.player_id ? null : m.player_id)}
                        style={{
                          width: desktop ? 34 : 30, height: desktop ? 34 : 30,
                          borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                          background: memberMenu === m.player_id ? EA.violetDeep : "rgba(0,0,0,0.1)",
                          border: `2px solid ${memberMenu === m.player_id ? EA.ink : "rgba(0,0,0,0.15)"}`,
                          color: memberMenu === m.player_id ? EA.white : EA.ink,
                          fontSize: desktop ? 18 : 15, cursor: "pointer", fontWeight: 900,
                        }}>⋯</button>
                      {memberMenu === m.player_id && (
                        <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 60, background: EA.violetDeep, border: `2.5px solid ${EA.ink}`, borderRadius: 14, overflow: "hidden", boxShadow: `4px 4px 0 ${EA.ink}`, minWidth: 170 }}>
                          {menuItems.map(({ label, action, color }) => (
                            <button key={label} onClick={action}
                              style={{ display: "block", width: "100%", textAlign: "left", padding: "11px 14px", background: "none", border: "none", fontFamily: "var(--font-display)", fontSize: 13, color, cursor: "pointer", borderBottom: label !== menuItems[menuItems.length - 1].label ? "1px solid rgba(255,255,255,0.07)" : "none" }}
                              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── RANKING TAB ── */}
        {tab === "ranking" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 4 }}>
              Classement dans {room.name}
            </div>
            {rankedMembers.map((m, i) => {
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
              const isMe = m.player_id === myPlayerId;
              return (
                <div key={m.player_id} style={{
                  background: isMe ? `rgba(0,212,232,0.12)` : EA.violetDeep,
                  border: `2.5px solid ${isMe ? EA.cyan : EA.ink}`,
                  borderRadius: 18, padding: desktop ? "14px 18px" : "10px 14px",
                  display: "flex", alignItems: "center", gap: 12,
                  boxShadow: i === 0 ? `4px 4px 0 ${EA.butter}` : `2px 2px 0 ${EA.ink}`,
                }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 24 : 18, minWidth: 36, textAlign: "center" }}>{medal}</div>
                  <Avatar name={m.pseudo} src={m.avatar_url} color={EA.pink} ring="transparent" size={desktop ? 40 : 32} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 18 : 14, color: EA.white, transform: "skewX(-3deg)" }}>{m.pseudo}</div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: desktop ? 11 : 9, fontWeight: 700, color: "rgba(255,255,255,0.45)" }}>
                      {m.roomWins}V · {m.roomLosses}D · {m.roomDraws}= · {m.roomPoints} pts
                    </div>
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 26 : 20, color: i === 0 ? EA.butter : EA.cyan }}>
                    {m.roomPoints}
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.4)", marginLeft: 3 }}>pts</span>
                  </div>
                </div>
              );
            })}
            {rankedMembers.every(m => m.roomPoints === 0) && (
              <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-sans)", fontSize: 13 }}>
                Aucune partie jouée dans cette salle pour l'instant.<br />Défiez-vous !
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{ position: "fixed", bottom: 20, left: desktop ? "50%" : 80, right: desktop ? "auto" : 16, transform: desktop ? "translateX(-50%)" : "none", width: desktop ? 660 : "auto", zIndex: 20, display: "flex", gap: 8 }}>
        {/* Invite button */}
        <button onClick={() => setShowInvite(true)} style={{
          background: EA.cyan, border: `2.5px solid ${EA.ink}`,
          borderRadius: 18, padding: desktop ? "14px 22px" : "0 16px",
          height: 56, display: "flex", alignItems: "center", gap: 8,
          fontFamily: "var(--font-display)", fontSize: desktop ? 16 : 13, color: EA.ink,
          cursor: "pointer", boxShadow: `4px 4px 0 ${EA.ink}`, whiteSpace: "nowrap", flexShrink: 0,
        }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          {desktop && "INVITER"}
        </button>

        {/* Leave / quit */}
        <button onClick={() => setConfirmLeave(true)} style={{
          flex: 1, background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
          borderRadius: 18, padding: desktop ? "14px 20px" : "0 16px",
          height: 56, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          fontFamily: "var(--font-display)", fontSize: desktop ? 16 : 13, color: "rgba(255,255,255,0.7)",
          cursor: "pointer", boxShadow: `4px 4px 0 ${EA.pink}`,
        }}>
          Quitter la salle →
        </button>
      </div>

      {/* ── Invite panel ── */}
      {showInvite && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(26,15,94,0.8)", backdropFilter: "blur(4px)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 400, background: EA.violetDeep, border: `2.5px solid ${EA.ink}`, borderRadius: 24, padding: "22px 20px", boxShadow: `6px 6px 0 ${EA.cyan}, 6px 6px 0 1px ${EA.ink}`, position: "relative" }}>
            <button onClick={() => setShowInvite(false)} style={{ position: "absolute", top: -12, right: -12, width: 32, height: 32, borderRadius: "50%", background: EA.white, border: `2px solid ${EA.ink}`, fontSize: 16, color: EA.ink, cursor: "pointer", boxShadow: `2px 2px 0 ${EA.ink}` }}>×</button>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: EA.white, marginBottom: 4 }}>👥 Inviter des joueurs</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>Code de la salle : <strong style={{ color: EA.butter, letterSpacing: 2 }}>{room.code}</strong></div>
            {onlinePlayers.length === 0 && (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-sans)", fontSize: 13, padding: "24px 0" }}>
                Aucun joueur en ligne disponible
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
              {onlinePlayers.map(p => (
                <div key={p.player_id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={p.pseudo} src={null} color={EA.cyan} size={34} />
                  <div style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 14, color: EA.white }}>{p.pseudo}</div>
                  <button
                    onClick={() => handleInvite(p.player_id)}
                    disabled={invitePending.has(p.player_id) || inviteSent.has(p.player_id)}
                    style={{
                      background: inviteSent.has(p.player_id) ? "#4ADE80" : EA.pink,
                      border: `2px solid ${EA.ink}`, borderRadius: 999,
                      padding: "7px 14px", fontFamily: "var(--font-display)", fontSize: 12,
                      color: inviteSent.has(p.player_id) ? EA.ink : EA.white,
                      cursor: invitePending.has(p.player_id) || inviteSent.has(p.player_id) ? "default" : "pointer",
                      opacity: invitePending.has(p.player_id) ? 0.6 : 1,
                      boxShadow: `2px 2px 0 ${EA.ink}`,
                    }}>
                    {inviteSent.has(p.player_id) ? "✓ Envoyé" : invitePending.has(p.player_id) ? "…" : "Inviter"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm leave ── */}
      {confirmLeave && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(26,15,94,0.8)", backdropFilter: "blur(4px)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 340, background: EA.violetDeep, border: `2.5px solid ${EA.ink}`, borderRadius: 22, padding: "24px 20px", boxShadow: `6px 6px 0 ${EA.pink}, 6px 6px 0 1px ${EA.ink}`, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👋</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: EA.white, marginBottom: 6 }}>Quitter la salle ?</div>
            {isHost && members.length > 1 && (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 14 }}>
                Tu es l'hôte. Le rôle sera transféré automatiquement.
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
              <button onClick={() => setConfirmLeave(false)} style={{ padding: "10px 20px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: `2px solid rgba(255,255,255,0.2)`, fontFamily: "var(--font-display)", fontSize: 14, color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>Annuler</button>
              <button onClick={() => { startLeave(async () => { await leaveRoom(room.id); }); }} disabled={leavePending}
                style={{ padding: "10px 20px", borderRadius: 999, background: EA.pink, border: `2px solid ${EA.ink}`, fontFamily: "var(--font-display)", fontSize: 14, color: EA.white, cursor: "pointer", boxShadow: `2px 2px 0 ${EA.ink}`, opacity: leavePending ? 0.6 : 1 }}>
                {leavePending ? "Sortie…" : "Quitter →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Challenge modal ── */}
      {chooseOpponent && (
        <ChooseGameModal
          opponent={chooseOpponent}
          allowedGames={room.allowedGames}
          onClose={() => { setChooseOpponent(null); setChallengeError(null); }}
          onChoose={handleChooseGame}
          isPending={isPending}
          error={challengeError}
        />
      )}
    </div>
  );
}
