"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RR } from "@/lib/design";
import { SvgBlob } from "@/components/ui/blob";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { updateRoomSettings, deleteRoom } from "../../actions";
import { PasswordInput } from "@/components/ui/password-input";
import type { GameType } from "@/types/database";
import { GAME_LABELS, ALL_GAME_TYPES } from "@/lib/game-labels";

interface RoomInfo {
  id: string; name: string; code: string;
  isPublic: boolean; hasPassword: boolean;
  maxMembers: number | null; allowedGames: string[] | null;
  expiresAt: string | null; isOpen: boolean;
}

export function RoomSettingsClient({ room: initial }: { room: RoomInfo }) {
  const desktop = useIsDesktop();
  const router = useRouter();

  const [name, setName]             = useState(initial.name);
  const [isPublic, setIsPublic]     = useState(initial.isPublic);
  const [isOpen, setIsOpen]         = useState(initial.isOpen);
  const [newPassword, setNewPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [maxMembers, setMaxMembers] = useState<string>(initial.maxMembers?.toString() ?? "");
  const [allowedGames, setAllowedGames] = useState<GameType[]>(
    initial.allowedGames ? initial.allowedGames as GameType[] : []
  );
  const [useGameFilter, setUseGameFilter] = useState(!!initial.allowedGames?.length);
  const [error, setError]           = useState<string | null>(null);
  const [saved, setSaved]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [savePending, startSave]   = useTransition();
  const [deletePending, startDelete] = useTransition();

  function toggleGame(g: GameType) {
    setAllowedGames(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Le nom ne peut pas être vide"); return; }
    setError(null);
    setSaved(false);
    startSave(async () => {
      const res = await updateRoomSettings(initial.id, {
        name,
        isPublic,
        isOpen,
        password: clearPassword ? null : newPassword || undefined,
        maxMembers: maxMembers ? parseInt(maxMembers) : null,
        allowedGames: useGameFilter && allowedGames.length > 0 ? allowedGames : null,
      });
      if (res?.error) setError(res.error);
      else { setSaved(true); router.refresh(); }
    });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,0.07)", border: `2px solid rgba(255,255,255,0.2)`,
    borderRadius: 12, padding: "12px 16px",
    fontFamily: "var(--font-sans)", fontSize: 14, color: "white", outline: "none",
  };

  return (
    <div style={{ position: "relative", minHeight: "100dvh", background: RR.violet, overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.25, backgroundImage: "radial-gradient(circle, rgba(0,212,232,0.55) 1.4px, transparent 1.8px)", backgroundSize: "16px 16px" }} />
      <SvgBlob color={RR.pink} style={{ width: 400, height: 360, top: -150, right: -100, opacity: 0.5, animation: "rr-float 7s ease-in-out infinite" }} />

      <div style={{ position: "relative", zIndex: 10, maxWidth: desktop ? 580 : "100%", margin: "0 auto", padding: desktop ? "28px 40px 80px" : "16px 16px 80px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: RR.cyan, textTransform: "uppercase", letterSpacing: 1.6 }}>Paramètres</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: desktop ? 30 : 22, color: RR.white, transform: "skewX(-6deg)", textShadow: `2px 2px 0 ${RR.pink}` }}>
              {initial.name.toUpperCase()}
            </div>
          </div>
          <Link href={`/room/${initial.code}`} style={{
            textDecoration: "none", fontFamily: "var(--font-display)", fontSize: 13,
            color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.07)",
            border: `2px solid rgba(255,255,255,0.15)`, borderRadius: 999, padding: "9px 18px",
          }}>← Salle</Link>
        </div>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Nom */}
          <Section label="Nom de la salle">
            <input value={name} onChange={e => setName(e.target.value)} maxLength={40} style={inputStyle} />
          </Section>

          {/* Visibilité */}
          <Section label="Visibilité">
            <div style={{ display: "flex", gap: 8 }}>
              {([true, false] as const).map(pub => (
                <button key={String(pub)} type="button" onClick={() => setIsPublic(pub)} style={{
                  flex: 1, padding: "12px 0", borderRadius: 14,
                  background: isPublic === pub ? (pub ? RR.cyan : RR.butter) : "rgba(255,255,255,0.06)",
                  border: `2px solid ${isPublic === pub ? RR.ink : "rgba(255,255,255,0.15)"}`,
                  fontFamily: "var(--font-display)", fontSize: 14,
                  color: isPublic === pub ? RR.ink : "rgba(255,255,255,0.55)", cursor: "pointer",
                  boxShadow: isPublic === pub ? `2px 2px 0 ${RR.ink}` : "none",
                }}>{pub ? "🌐 Publique" : "🔒 Privée"}</button>
              ))}
            </div>
          </Section>

          {/* Inscriptions ouvertes */}
          <Toggle
            label="Inscriptions ouvertes"
            description={isOpen ? "Les nouveaux joueurs peuvent rejoindre" : "Aucun nouveau joueur ne peut rejoindre"}
            checked={isOpen}
            onChange={setIsOpen}
          />

          {/* Mot de passe */}
          <Section label="Mot de passe">
            {initial.hasPassword && (
              <Toggle
                label="Supprimer le mot de passe actuel"
                description="La salle sera accessible sans mot de passe"
                checked={clearPassword}
                onChange={v => { setClearPassword(v); if (v) setNewPassword(""); }}
              />
            )}
            {!clearPassword && (
              <PasswordInput
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder={initial.hasPassword ? "Nouveau mot de passe (laisser vide = inchangé)" : "Ajouter un mot de passe (optionnel)"}
                style={{ ...inputStyle, marginTop: initial.hasPassword ? 8 : 0 }}
              />
            )}
          </Section>

          {/* Max membres */}
          <Section label="Limite de membres">
            <input
              value={maxMembers}
              onChange={e => setMaxMembers(e.target.value)}
              type="number" min="2" max="50"
              placeholder="Laisser vide = illimité"
              style={inputStyle}
            />
          </Section>

          {/* Jeux autorisés */}
          <Toggle
            label="Restreindre les jeux"
            description="Autoriser uniquement certains jeux dans cette salle"
            checked={useGameFilter}
            onChange={v => { setUseGameFilter(v); if (!v) setAllowedGames([]); }}
          >
            {useGameFilter && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {ALL_GAME_TYPES.map(g => {
                  const selected = allowedGames.includes(g);
                  return (
                    <button key={g} type="button" onClick={() => toggleGame(g)} style={{
                      padding: "7px 12px", borderRadius: 999,
                      background: selected ? "#4ADE80" : "rgba(255,255,255,0.06)",
                      border: `2px solid ${selected ? RR.ink : "rgba(255,255,255,0.15)"}`,
                      fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800,
                      color: selected ? RR.ink : "rgba(255,255,255,0.55)", cursor: "pointer",
                    }}>{GAME_LABELS[g]}</button>
                  );
                })}
              </div>
            )}
          </Toggle>

          {error && <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800, color: RR.pink }}>⚠ {error}</div>}
          {saved && <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800, color: "#4ADE80" }}>✓ Paramètres sauvegardés</div>}

          <button type="submit" disabled={savePending} style={{
            background: RR.cyan, border: `2.5px solid ${RR.ink}`, borderRadius: 14, padding: "16px",
            fontFamily: "var(--font-display)", fontSize: 17, color: RR.ink,
            cursor: savePending ? "wait" : "pointer", opacity: savePending ? 0.7 : 1,
            boxShadow: `4px 4px 0 ${RR.ink}`,
          }}>
            {savePending ? "Sauvegarde…" : "💾 SAUVEGARDER"}
          </button>
        </form>

        {/* Danger zone */}
        <div style={{ marginTop: 32, borderTop: `2px solid rgba(255,30,140,0.2)`, paddingTop: 24 }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: RR.pink, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 12 }}>
            Zone dangereuse
          </div>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} style={{
              background: "rgba(255,30,140,0.1)", border: `2px solid ${RR.pink}`,
              borderRadius: 12, padding: "12px 20px",
              fontFamily: "var(--font-display)", fontSize: 15, color: RR.pink,
              cursor: "pointer",
            }}>🗑 Supprimer la salle</button>
          ) : (
            <div style={{ background: "rgba(255,30,140,0.12)", border: `2px solid ${RR.pink}`, borderRadius: 16, padding: "18px 20px" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: RR.white, marginBottom: 6 }}>Supprimer définitivement ?</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>
                Tous les membres seront expulsés. Cette action est irréversible.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmDelete(false)} style={{ padding: "10px 18px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: `2px solid rgba(255,255,255,0.2)`, fontFamily: "var(--font-display)", fontSize: 13, color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>Annuler</button>
                <button onClick={() => startDelete(async () => { await deleteRoom(initial.id); })} disabled={deletePending}
                  style={{ padding: "10px 18px", borderRadius: 999, background: RR.pink, border: `2px solid ${RR.ink}`, fontFamily: "var(--font-display)", fontSize: 13, color: RR.white, cursor: "pointer", boxShadow: `2px 2px 0 ${RR.ink}`, opacity: deletePending ? 0.6 : 1 }}>
                  {deletePending ? "Suppression…" : "Supprimer définitivement"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function Toggle({ label, description, checked, onChange, children }: {
  label: string; description: string; checked: boolean;
  onChange: (v: boolean) => void; children?: React.ReactNode;
}) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: `2px solid ${checked ? RR.cyan : "rgba(255,255,255,0.1)"}`, borderRadius: 14, padding: "14px 16px", transition: "border-color .15s" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: RR.white }}>{label}</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{description}</div>
        </div>
        <button type="button" onClick={() => onChange(!checked)} style={{ width: 44, height: 24, borderRadius: 12, flexShrink: 0, background: checked ? RR.cyan : "rgba(255,255,255,0.15)", border: `2px solid ${RR.ink}`, cursor: "pointer", position: "relative", transition: "background .2s" }}>
          <span style={{ position: "absolute", top: 2, left: checked ? "calc(100% - 20px)" : 2, width: 16, height: 16, borderRadius: "50%", background: RR.white, transition: "left .2s" }} />
        </button>
      </div>
      {checked && children}
    </div>
  );
}
