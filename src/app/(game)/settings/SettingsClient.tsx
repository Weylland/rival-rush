"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updatePseudo, updatePassword, deleteAccount } from "./actions";
import { EA } from "@/lib/design";
import type { SettingsState } from "./actions";
import { subscribePush, unsubscribePush, NOTIF_KEY } from "@/lib/push-client";

const SOUND_KEY = "ea_sounds_enabled";

function inputStyle(focused: boolean): React.CSSProperties {
  return {
    fontFamily: "var(--font-sans)",
    fontSize: 15,
    fontWeight: 700,
    color: EA.white,
    background: "rgba(255,255,255,0.07)",
    border: `2px solid ${focused ? EA.cyan : EA.ink}`,
    borderRadius: 12,
    padding: "12px 16px",
    width: "100%",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color .15s",
  };
}

function SectionCard({ children, accent = EA.cyan }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      background: EA.violetDeep,
      border: `2.5px solid ${EA.ink}`,
      borderRadius: 20,
      padding: "24px 20px",
      boxShadow: `4px 4px 0 ${accent}`,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "var(--font-display)",
      fontSize: 18,
      color: EA.white,
      transform: "skewX(-4deg)",
      marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

function Feedback({ state }: { state: SettingsState }) {
  if (!state) return null;
  const isError = !!state.error;
  return (
    <div style={{
      marginTop: 10,
      padding: "10px 14px",
      borderRadius: 10,
      background: isError ? "rgba(255,30,140,0.15)" : "rgba(0,212,232,0.15)",
      border: `2px solid ${isError ? EA.pink : EA.cyan}`,
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      fontWeight: 800,
      color: EA.white,
    }}>
      {state.error ?? state.success}
    </div>
  );
}

function FocusInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      style={inputStyle(focused)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

function SubmitButton({ pending, label, color = EA.cyan }: { pending: boolean; label: string; color?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        marginTop: 12,
        fontFamily: "var(--font-display)",
        fontSize: 14,
        color: EA.violetDeep,
        background: pending ? "rgba(255,255,255,0.2)" : color,
        border: `2px solid ${EA.ink}`,
        borderRadius: 999,
        padding: "11px 24px",
        cursor: pending ? "wait" : "pointer",
        boxShadow: pending ? "none" : `3px 3px 0 ${EA.ink}`,
        transform: "skewX(-4deg)",
        textTransform: "uppercase",
        transition: "all .1s",
        opacity: pending ? 0.6 : 1,
      }}
    >
      <span style={{ display: "inline-block", transform: "skewX(4deg)" }}>
        {pending ? "..." : label}
      </span>
    </button>
  );
}

const MAX_PX = 400;
const MAX_BYTES = 300_000;

function cropAndCompress(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Center-crop to square
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      const sy = (img.naturalHeight - side) / 2;

      // Target size: cap at MAX_PX
      const out = Math.min(side, MAX_PX);

      const canvas = document.createElement("canvas");
      canvas.width = out;
      canvas.height = out;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);

      // Try quality from 0.85 down until under MAX_BYTES
      let quality = 0.85;
      const tryEncode = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error("Canvas toBlob failed")); return; }
            if (blob.size <= MAX_BYTES || quality <= 0.3) {
              resolve(blob);
            } else {
              quality = Math.max(quality - 0.1, 0.3);
              tryEncode();
            }
          },
          "image/jpeg",
          quality,
        );
      };
      tryEncode();
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

const PRESETS = ["🎲","⚡","🔥","💀","👾","🤖","🐉","🦊","🦁","🐺","🦈","🦄","🐸","🎯","🌟","🃏","🦅","🐧","🎮","🍄"];

interface Props {
  initialPseudo: string;
  initialAvatarUrl: string | null;
}

export function SettingsClient({ initialPseudo, initialAvatarUrl }: Props) {
  const router = useRouter();
  const [pseudoState, pseudoAction, pseudoPending] = useActionState<SettingsState, FormData>(updatePseudo, null);
  const [pwState, pwAction, pwPending] = useActionState<SettingsState, FormData>(updatePassword, null);
  const [deleteState, deleteAction, deletePending] = useActionState<SettingsState, FormData>(deleteAccount as unknown as (s: SettingsState, f: FormData) => Promise<SettingsState>, null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSoundEnabled(localStorage.getItem(SOUND_KEY) !== "false");
    setNotifEnabled(localStorage.getItem(NOTIF_KEY) !== "false");
    if (typeof Notification !== "undefined") setNotifPermission(Notification.permission);
  }, []);

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem(SOUND_KEY, next ? "true" : "false");
  }

  async function toggleNotif() {
    const next = !notifEnabled;
    setNotifEnabled(next);
    localStorage.setItem(NOTIF_KEY, next ? "true" : "false");
    if (next) {
      await subscribePush();
    } else {
      await unsubscribePush();
    }
  }

  async function requestNotifPermission() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === "granted") setNotifEnabled(true);
  }

  async function saveAvatar(formData: FormData) {
    setAvatarSaving(true);
    setAvatarError(null);
    try {
      const res = await fetch("/api/avatar", { method: "POST", body: formData, credentials: "include" });
      const json = await res.json();
      if (!res.ok) { setAvatarError(json.error ?? "Erreur"); return; }
      setAvatarUrl(json.avatarUrl ?? null);
    } catch {
      setAvatarError("Erreur réseau");
    } finally {
      setAvatarSaving(false);
    }
  }

  async function handlePreset(emoji: string) {
    const fd = new FormData();
    fd.append("type", "preset");
    fd.append("emoji", emoji);
    await saveAvatar(fd);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected after an error
    e.target.value = "";

    const processedBlob = await cropAndCompress(file);

    const fd = new FormData();
    fd.append("type", "upload");
    fd.append("file", processedBlob, "avatar.jpg");
    await saveAvatar(fd);
  }

  async function handleRemoveAvatar() {
    const fd = new FormData();
    fd.append("type", "remove");
    await saveAvatar(fd);
  }

  const currentEmoji = avatarUrl?.startsWith("preset:") ? avatarUrl.slice(7) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Avatar */}
      <SectionCard accent={EA.pink}>
        <SectionTitle>🖼 Photo de profil</SectionTitle>

        {/* Preview + boutons actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: avatarUrl && !avatarUrl.startsWith("preset:") ? "transparent" : EA.violetDeep,
            border: `2.5px solid ${EA.ink}`, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: avatarUrl?.startsWith("preset:") ? 36 : 28,
            overflow: "hidden", boxShadow: `3px 3px 0 ${EA.cyan}`,
          }}>
            {avatarUrl?.startsWith("preset:") ? avatarUrl.slice(7)
              : avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : <span style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "rgba(255,255,255,0.4)" }}>{initialPseudo.charAt(0).toUpperCase()}</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarSaving}
              style={{
                fontFamily: "var(--font-display)", fontSize: 13,
                color: EA.ink, background: EA.cyan,
                border: `2px solid ${EA.ink}`, borderRadius: 999,
                padding: "8px 16px", cursor: "pointer",
                boxShadow: `2px 2px 0 ${EA.ink}`, textTransform: "uppercase",
              }}>
              📷 Uploader
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={avatarSaving}
                style={{
                  fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700,
                  color: "rgba(255,255,255,0.5)", background: "none",
                  border: "none", cursor: "pointer", textAlign: "left",
                }}>
                Supprimer
              </button>
            )}
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={handleUpload}
        />

        {/* Preset grid */}
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          Ou choisis un avatar
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {PRESETS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => handlePreset(emoji)}
              disabled={avatarSaving}
              style={{
                fontSize: 26, padding: "8px 0",
                background: currentEmoji === emoji ? EA.butter : "rgba(255,255,255,0.08)",
                border: `2px solid ${currentEmoji === emoji ? EA.ink : "rgba(255,255,255,0.15)"}`,
                borderRadius: 12, cursor: "pointer",
                boxShadow: currentEmoji === emoji ? `2px 2px 0 ${EA.ink}` : "none",
                transition: "all 0.1s",
              }}>
              {emoji}
            </button>
          ))}
        </div>

        {avatarSaving && (
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: EA.cyan, marginTop: 10 }}>
            Sauvegarde...
          </div>
        )}
        {avatarError && (
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: EA.pink, marginTop: 10 }}>
            {avatarError}
          </div>
        )}
      </SectionCard>

      {/* Pseudo */}
      <SectionCard accent={EA.cyan}>
        <SectionTitle>Changer de pseudo</SectionTitle>
        <form action={pseudoAction}>
          <FocusInput
            name="pseudo"
            placeholder={initialPseudo}
            defaultValue=""
            autoComplete="off"
            maxLength={20}
          />
          <SubmitButton pending={pseudoPending} label="Mettre à jour" />
          <Feedback state={pseudoState} />
        </form>
      </SectionCard>

      {/* Password */}
      <SectionCard accent={EA.butter}>
        <SectionTitle>Changer de mot de passe</SectionTitle>
        <form action={pwAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FocusInput
            name="current_password"
            type="password"
            placeholder="Mot de passe actuel"
            autoComplete="current-password"
          />
          <FocusInput
            name="new_password"
            type="password"
            placeholder="Nouveau mot de passe (min 4 car.)"
            autoComplete="new-password"
          />
          <SubmitButton pending={pwPending} label="Mettre à jour" color={EA.butter} />
          <Feedback state={pwState} />
        </form>
      </SectionCard>

      {/* Sons */}
      <SectionCard accent={EA.pink}>
        <SectionTitle>Sons du jeu</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
            {soundEnabled ? "🔊 Sons activés" : "🔇 Sons désactivés"}
          </span>
          <button
            type="button"
            onClick={toggleSound}
            style={{
              width: 52, height: 28,
              borderRadius: 999,
              background: soundEnabled ? EA.cyan : "rgba(255,255,255,0.15)",
              border: `2px solid ${EA.ink}`,
              cursor: "pointer",
              position: "relative",
              transition: "background .2s",
              padding: 0,
            }}
          >
            <span style={{
              position: "absolute",
              top: 2,
              left: soundEnabled ? 26 : 2,
              width: 20, height: 20,
              borderRadius: "50%",
              background: EA.white,
              border: `2px solid ${EA.ink}`,
              transition: "left .2s",
              display: "block",
            }} />
          </button>
        </div>
      </SectionCard>

      {/* Notifications */}
      {notifPermission !== null && (
        <SectionCard accent={EA.butter}>
          <SectionTitle>🔔 Notifications de défi</SectionTitle>

          {notifPermission === "default" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                Reçois une notification même écran éteint quand quelqu'un te défie.
              </div>
              <button
                type="button"
                onClick={requestNotifPermission}
                style={{
                  alignSelf: "flex-start",
                  fontFamily: "var(--font-display)", fontSize: 14,
                  color: EA.violetDeep, background: EA.butter,
                  border: `2px solid ${EA.ink}`, borderRadius: 999,
                  padding: "11px 24px", cursor: "pointer",
                  boxShadow: `3px 3px 0 ${EA.ink}`,
                  transform: "skewX(-4deg)", textTransform: "uppercase",
                }}
              >
                <span style={{ display: "inline-block", transform: "skewX(4deg)" }}>
                  Activer les notifications
                </span>
              </button>
            </div>
          )}

          {notifPermission === "granted" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
                  {notifEnabled ? "🟢 Notifications activées" : "⭕ Notifications désactivées"}
                </div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>
                  {notifEnabled ? "Tu seras alerté même écran éteint" : "Tu ne recevras pas d'alerte en arrière-plan"}
                </div>
              </div>
              <button
                type="button"
                onClick={toggleNotif}
                style={{
                  width: 52, height: 28, borderRadius: 999,
                  background: notifEnabled ? EA.butter : "rgba(255,255,255,0.15)",
                  border: `2px solid ${EA.ink}`,
                  cursor: "pointer", position: "relative",
                  transition: "background .2s", padding: 0, flexShrink: 0,
                }}
              >
                <span style={{
                  position: "absolute", top: 2,
                  left: notifEnabled ? 26 : 2,
                  width: 20, height: 20, borderRadius: "50%",
                  background: EA.white, border: `2px solid ${EA.ink}`,
                  transition: "left .2s", display: "block",
                }} />
              </button>
            </div>
          )}

          {notifPermission === "denied" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(255,30,140,0.1)", border: `2px solid ${EA.pink}`,
                borderRadius: 12, padding: "12px 14px",
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>🚫</span>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
                  Notifications bloquées par le navigateur.
                  <br />
                  <span style={{ color: "rgba(255,255,255,0.45)" }}>
                    Pour les réactiver : réglages du navigateur → Site → Notifications → Autoriser.
                  </span>
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* Danger zone */}
      <SectionCard accent="rgba(255,30,140,0.5)">
        <SectionTitle>Zone danger</SectionTitle>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 14,
              background: "rgba(255,30,140,0.15)",
              border: `2px solid ${EA.pink}`,
              borderRadius: 999,
              padding: "11px 24px",
              color: EA.pink,
              cursor: "pointer",
              transform: "skewX(-4deg)",
              textTransform: "uppercase",
            }}
          >
            <span style={{ display: "inline-block", transform: "skewX(4deg)" }}>
              🗑 Supprimer mon compte
            </span>
          </button>
        ) : (
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: 12 }}>
              Toutes tes parties et ton score seront supprimés. Irréversible.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                style={{
                  fontFamily: "var(--font-display)", fontSize: 13,
                  background: "rgba(255,255,255,0.1)", border: `2px solid ${EA.ink}`,
                  borderRadius: 999, padding: "10px 18px",
                  color: EA.white, cursor: "pointer",
                }}
              >
                Annuler
              </button>
              <form action={deleteAction}>
                <button
                  type="submit"
                  disabled={deletePending}
                  style={{
                    fontFamily: "var(--font-display)", fontSize: 13,
                    background: EA.pink, border: `2px solid ${EA.ink}`,
                    borderRadius: 999, padding: "10px 18px",
                    color: EA.white, cursor: deletePending ? "wait" : "pointer",
                    boxShadow: `3px 3px 0 ${EA.ink}`,
                    opacity: deletePending ? 0.7 : 1,
                  }}
                >
                  {deletePending ? "..." : "Confirmer la suppression"}
                </button>
              </form>
            </div>
            {deleteState?.error && <Feedback state={deleteState} />}
          </div>
        )}
      </SectionCard>

      {/* Contact */}
      <Link
        href="/contact"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: EA.violetDeep, border: `2.5px solid ${EA.cyan}`,
          borderRadius: 20, padding: "18px 20px",
          boxShadow: `4px 4px 0 ${EA.cyan}`,
          textDecoration: "none",
        }}
      >
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: EA.white, transform: "skewX(-4deg)" }}>
            Nous contacter
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
            Bug, suggestion, question ?
          </div>
        </div>
        <span style={{ fontSize: 22 }}>✉️</span>
      </Link>

      {/* Liens légaux */}
      <div style={{ display: "flex", gap: 16, justifyContent: "center", paddingTop: 4, flexWrap: "wrap" }}>
        {[
          { href: "/legal/mentions", label: "Mentions légales" },
          { href: "/legal/privacy", label: "Confidentialité" },
          { href: "/legal/cgu", label: "CGU" },
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            style={{
              fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700,
              color: "rgba(255,255,255,0.35)", textDecoration: "underline", textUnderlineOffset: 3,
            }}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
