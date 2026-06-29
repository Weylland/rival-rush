"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { RR } from "@/lib/design";
import { SvgBlob } from "@/components/ui/blob";
import { Star } from "@/components/ui/star";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { createRoom, joinRoom } from "./actions";
import { PasswordInput } from "@/components/ui/password-input";
import type { GameType, RoomExpiration } from "@/types/database";
import { GAME_LABELS, ALL_GAME_TYPES } from "@/lib/game-labels";

const EXPIRATION_OPTIONS: { value: RoomExpiration; label: string }[] = [
  { value: "6h",       label: "6 heures" },
  { value: "12h",      label: "12 heures" },
  { value: "24h",      label: "24 heures" },
  { value: "7d",       label: "7 jours" },
  { value: "permanent", label: "Permanente ♾" },
];

interface PublicRoom {
  id: string; name: string; code: string;
  isPublic: boolean; maxMembers: number | null;
  allowedGames: string[] | null;
  expiresAt: string | null;
  memberCount: number; hostPseudo: string;
}

export function RoomLanding({ publicRooms }: { myPlayerId: string; publicRooms: PublicRoom[] }) {
  const desktop = useIsDesktop();
  const [tab, setTab] = useState<"join" | "create">("join");

  // Join state
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joiningPending, startJoining] = useTransition();

  // Create state
  const [roomName, setRoomName]         = useState("");
  const [isPublic, setIsPublic]         = useState(true);
  const [password, setPassword]         = useState("");
  const [usePassword, setUsePassword]   = useState(false);
  const [maxMembers, setMaxMembers]     = useState<string>("");
  const [useMaxMembers, setUseMaxMembers] = useState(false);
  const [expiration, setExpiration]     = useState<RoomExpiration>("24h");
  const [allowedGames, setAllowedGames] = useState<GameType[]>([]);
  const [useGameFilter, setUseGameFilter] = useState(false);
  const [createError, setCreateError]   = useState<string | null>(null);
  const [createPending, startCreate]    = useTransition();

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError(null);
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { setJoinError("Le code doit faire 6 caractères"); return; }
    startJoining(async () => {
      const res = await joinRoom(code, needsPassword ? joinPassword : undefined);
      if (res?.needsPassword) { setNeedsPassword(true); return; }
      if (res?.error) setJoinError(res.error);
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!roomName.trim()) { setCreateError("Donne un nom à ta salle"); return; }
    setCreateError(null);
    startCreate(async () => {
      const res = await createRoom({
        name: roomName,
        isPublic,
        password: usePassword && password ? password : undefined,
        maxMembers: useMaxMembers && maxMembers ? parseInt(maxMembers) : null,
        allowedGames: useGameFilter && allowedGames.length > 0 ? allowedGames : null,
        expiration,
      });
      if (res?.error) setCreateError(res.error);
    });
  }

  function toggleGame(g: GameType) {
    setAllowedGames(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  }

  function expirationLabel(expiresAt: string | null): string {
    if (!expiresAt) return "Permanente";
    const d = new Date(expiresAt);
    const now = new Date();
    const diffH = Math.round((d.getTime() - now.getTime()) / 3_600_000);
    if (diffH < 1) return "Expire bientôt";
    if (diffH < 24) return `Expire dans ${diffH}h`;
    return `Expire dans ${Math.round(diffH / 24)}j`;
  }

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: RR.violet, overflow: "hidden" }}>
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.3,
        backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.55) 1.4px, transparent 1.8px)",
        backgroundSize: "16px 16px",
      }} />
      <SvgBlob color={RR.pink} style={{ width: 500, height: 440, top: -200, right: -160, opacity: 0.65, animation: "rr-float 6s ease-in-out infinite" }} />
      <SvgBlob color={RR.butter} style={{ width: 380, height: 340, bottom: -160, left: -130, opacity: 0.45, animation: "rr-float 8s ease-in-out infinite reverse" }} />
      <Star color={RR.cyan} size={32} style={{ top: "12%", left: "6%", animation: "rr-spin-slow 12s linear infinite" }} />
      <Star color={RR.pink} size={20} style={{ top: "40%", right: "4%", animation: "rr-float 5s ease-in-out infinite" }} />

      <div style={{ position: "relative", zIndex: 10, maxWidth: desktop ? 680 : "100%", margin: "0 auto", padding: desktop ? "32px 40px 80px" : "16px 16px 80px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: desktop ? 28 : 18 }}>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: desktop ? 13 : 10, fontWeight: 900, color: RR.cyan, textTransform: "uppercase", letterSpacing: 1.6 }}>
              Salles privées
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 48 : 30, color: RR.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${RR.pink}`, lineHeight: 1 }}>
              LES SALLES
            </div>
          </div>
          <Link href="/lobby" style={{
            textDecoration: "none", fontFamily: "var(--font-display)", fontSize: desktop ? 15 : 12,
            color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.07)",
            border: `2px solid rgba(255,255,255,0.15)`,
            borderRadius: 999, padding: desktop ? "10px 20px" : "7px 14px",
          }}>← Lobby</Link>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", background: "rgba(26,15,94,0.55)",
          border: `2px solid ${RR.ink}`, borderRadius: 999, padding: 4, marginBottom: 20,
        }}>
          {(["join", "create"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, background: tab === t ? (t === "create" ? RR.cyan : RR.pink) : "transparent",
              border: "none", borderRadius: 999, padding: desktop ? "12px 0" : "9px 0",
              fontFamily: "var(--font-display)", fontSize: desktop ? 17 : 13,
              color: tab === t ? (t === "create" ? RR.ink : RR.white) : "rgba(255,255,255,0.55)",
              cursor: "pointer",
              boxShadow: tab === t ? `2px 2px 0 ${RR.ink}` : "none",
            }}>
              {t === "join" ? "🔍 REJOINDRE" : "✨ CRÉER"}
            </button>
          ))}
        </div>

        {/* ── JOIN ── */}
        {tab === "join" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Join by code */}
            <div style={{
              background: RR.violetDeep, border: `2.5px solid ${RR.ink}`,
              borderRadius: 22, padding: desktop ? "22px 24px" : "16px 18px",
              boxShadow: `4px 4px 0 ${RR.pink}`,
            }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 20 : 16, color: RR.white, marginBottom: 14 }}>
                🔑 Rejoindre par code
              </div>
              <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  value={joinCode}
                  onChange={e => { setJoinCode(e.target.value.toUpperCase()); setNeedsPassword(false); setJoinError(null); }}
                  placeholder="Ex : ARENA7"
                  maxLength={6}
                  style={{
                    background: "rgba(255,255,255,0.07)", border: `2px solid ${RR.ink}`,
                    borderRadius: 14, padding: "12px 16px",
                    fontFamily: "var(--font-display)", fontSize: 22, color: RR.white,
                    textAlign: "center", letterSpacing: 6, textTransform: "uppercase",
                    outline: "none", width: "100%", boxSizing: "border-box",
                  }}
                />
                {needsPassword && (
                  <PasswordInput
                    value={joinPassword}
                    onChange={e => setJoinPassword(e.target.value)}
                    placeholder="Mot de passe de la salle"
                    style={{
                      background: "rgba(255,255,255,0.07)", border: `2px solid ${RR.butter}`,
                      borderRadius: 14, padding: "12px 16px",
                      fontFamily: "var(--font-sans)", fontSize: 15, color: RR.white,
                      outline: "none", width: "100%", boxSizing: "border-box",
                    }}
                  />
                )}
                {joinError && (
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800, color: RR.pink }}>
                    ⚠ {joinError}
                  </div>
                )}
                <button type="submit" disabled={joiningPending || joinCode.length !== 6}
                  style={{
                    background: RR.pink, border: `2.5px solid ${RR.ink}`,
                    borderRadius: 14, padding: "14px",
                    fontFamily: "var(--font-display)", fontSize: 17, color: RR.white,
                    cursor: joiningPending || joinCode.length !== 6 ? "default" : "pointer",
                    opacity: joinCode.length !== 6 ? 0.45 : 1,
                    boxShadow: `3px 3px 0 ${RR.ink}`, transition: "opacity .15s",
                  }}>
                  {joiningPending ? "Connexion…" : needsPassword ? "Entrer avec le mot de passe →" : "Rejoindre →"}
                </button>
              </form>
            </div>

            {/* Public rooms list */}
            {publicRooms.length > 0 && (
              <div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 10 }}>
                  Salles publiques ({publicRooms.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {publicRooms.map(r => (
                    <Link key={r.id} href={`/room/${r.code}`} style={{ textDecoration: "none" }}>
                      <div style={{
                        background: RR.white, border: `2.5px solid ${RR.ink}`,
                        borderRadius: 18, padding: desktop ? "14px 18px" : "12px 14px",
                        boxShadow: `3px 3px 0 ${RR.cyan}`,
                        display: "flex", alignItems: "center", gap: 12,
                        transition: "transform .1s, box-shadow .1s",
                        cursor: "pointer",
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translate(3px,3px)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = `3px 3px 0 ${RR.cyan}`; }}
                      >
                        <div style={{
                          width: 44, height: 44, borderRadius: 12,
                          background: RR.cyan, border: `2px solid ${RR.ink}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontFamily: "var(--font-display)", fontSize: 11, color: RR.ink,
                          letterSpacing: 1, fontWeight: 900, flexShrink: 0,
                        }}>{r.code}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 18 : 15, color: RR.ink, transform: "skewX(-3deg)" }}>
                            {r.name}
                          </div>
                          <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, color: RR.violetDeep, marginTop: 2 }}>
                            🏠 {r.hostPseudo} · {r.memberCount} joueur{r.memberCount > 1 ? "s" : ""}{r.maxMembers ? ` / ${r.maxMembers}` : ""}
                          </div>
                        </div>
                        <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 800, color: "rgba(26,15,94,0.45)", textAlign: "right", flexShrink: 0 }}>
                          {expirationLabel(r.expiresAt)}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {publicRooms.length === 0 && (
              <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-sans)", fontSize: 13 }}>
                Aucune salle publique en ce moment.<br />Crée la tienne !
              </div>
            )}
          </div>
        )}

        {/* ── CREATE ── */}
        {tab === "create" && (
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Name */}
            <Field label="Nom de la salle *">
              <input
                value={roomName} onChange={e => setRoomName(e.target.value)}
                placeholder="Ex : Soirée du vendredi"
                maxLength={40}
                style={inputStyle}
              />
            </Field>

            {/* Public / Private */}
            <Field label="Visibilité">
              <div style={{ display: "flex", gap: 8 }}>
                {([true, false] as const).map(pub => (
                  <button key={String(pub)} type="button" onClick={() => setIsPublic(pub)}
                    style={{
                      flex: 1, padding: "12px 0", borderRadius: 14,
                      background: isPublic === pub ? (pub ? RR.cyan : RR.butter) : "rgba(255,255,255,0.06)",
                      border: `2px solid ${isPublic === pub ? RR.ink : "rgba(255,255,255,0.15)"}`,
                      fontFamily: "var(--font-display)", fontSize: 14,
                      color: isPublic === pub ? RR.ink : "rgba(255,255,255,0.55)",
                      cursor: "pointer",
                      boxShadow: isPublic === pub ? `2px 2px 0 ${RR.ink}` : "none",
                    }}>
                    {pub ? "🌐 Publique" : "🔒 Privée"}
                  </button>
                ))}
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                {isPublic ? "Apparaît dans la liste des salles publiques" : "Accessible uniquement par code ou invitation"}
              </div>
            </Field>

            {/* Password toggle */}
            <ToggleField
              label="Mot de passe"
              checked={usePassword}
              onChange={setUsePassword}
              description="Protéger la salle avec un mot de passe"
            >
              {usePassword && (
                <PasswordInput
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Mot de passe"
                  style={inputStyle}
                />
              )}
            </ToggleField>

            {/* Max members toggle */}
            <ToggleField
              label="Limite de membres"
              checked={useMaxMembers}
              onChange={setUseMaxMembers}
              description="Définir un nombre maximum de joueurs"
            >
              {useMaxMembers && (
                <input
                  value={maxMembers} onChange={e => setMaxMembers(e.target.value)}
                  type="number" min="2" max="50" placeholder="Ex : 10"
                  style={inputStyle}
                />
              )}
            </ToggleField>

            {/* Expiration */}
            <Field label="Durée de la salle">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {EXPIRATION_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setExpiration(opt.value)}
                    style={{
                      padding: "9px 16px", borderRadius: 999,
                      background: expiration === opt.value ? RR.pink : "rgba(255,255,255,0.06)",
                      border: `2px solid ${expiration === opt.value ? RR.ink : "rgba(255,255,255,0.15)"}`,
                      fontFamily: "var(--font-display)", fontSize: 13,
                      color: expiration === opt.value ? RR.white : "rgba(255,255,255,0.55)",
                      cursor: "pointer",
                      boxShadow: expiration === opt.value ? `2px 2px 0 ${RR.ink}` : "none",
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>

            {/* Game filter toggle */}
            <ToggleField
              label="Jeux autorisés"
              checked={useGameFilter}
              onChange={v => { setUseGameFilter(v); if (!v) setAllowedGames([]); }}
              description="Restreindre quels jeux peuvent être joués dans cette salle"
            >
              {useGameFilter && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {ALL_GAME_TYPES.map(g => {
                    const selected = allowedGames.includes(g);
                    return (
                      <button key={g} type="button" onClick={() => toggleGame(g)}
                        style={{
                          padding: "7px 12px", borderRadius: 999,
                          background: selected ? "#4ADE80" : "rgba(255,255,255,0.06)",
                          border: `2px solid ${selected ? RR.ink : "rgba(255,255,255,0.15)"}`,
                          fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800,
                          color: selected ? RR.ink : "rgba(255,255,255,0.55)",
                          cursor: "pointer",
                        }}>
                        {GAME_LABELS[g]}
                      </button>
                    );
                  })}
                </div>
              )}
            </ToggleField>

            {createError && (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800, color: RR.pink }}>
                ⚠ {createError}
              </div>
            )}

            <button type="submit" disabled={createPending || !roomName.trim()}
              style={{
                background: RR.cyan, border: `2.5px solid ${RR.ink}`,
                borderRadius: 16, padding: "16px",
                fontFamily: "var(--font-display)", fontSize: 18, color: RR.ink,
                cursor: createPending || !roomName.trim() ? "default" : "pointer",
                opacity: !roomName.trim() ? 0.45 : 1,
                boxShadow: `4px 4px 0 ${RR.ink}`,
                transition: "opacity .15s, transform .1s",
              }}>
              {createPending ? "Création…" : "✨ CRÉER LA SALLE"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ToggleField({ label, description, checked, onChange, children }: {
  label: string; description: string; checked: boolean;
  onChange: (v: boolean) => void; children?: React.ReactNode;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: `2px solid ${checked ? RR.cyan : "rgba(255,255,255,0.1)"}`,
      borderRadius: 16, padding: "14px 16px", transition: "border-color .15s",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: RR.white }}>{label}</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{description}</div>
        </div>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          style={{
            width: 44, height: 24, borderRadius: 12, flexShrink: 0,
            background: checked ? RR.cyan : "rgba(255,255,255,0.15)",
            border: `2px solid ${RR.ink}`, cursor: "pointer",
            position: "relative", transition: "background .2s",
          }}
        >
          <span style={{
            position: "absolute", top: 2,
            left: checked ? "calc(100% - 20px)" : 2,
            width: 16, height: 16, borderRadius: "50%",
            background: RR.white, transition: "left .2s",
          }} />
        </button>
      </div>
      {checked && children && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "rgba(255,255,255,0.07)", border: `2px solid rgba(255,255,255,0.2)`,
  borderRadius: 12, padding: "12px 16px",
  fontFamily: "var(--font-sans)", fontSize: 14, color: "white",
  outline: "none",
};
