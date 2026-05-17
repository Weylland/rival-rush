"use client";

import { useState, useTransition } from "react";
import { EA } from "@/lib/design";
import { grantAdmin, revokeAdmin } from "./actions";

interface Player {
  id: string;
  pseudo: string;
  avatar_url: string | null;
}

interface Props {
  players: Player[];
  adminPlayerIds: string[];
  superAdminId: string | null;
}

type PendingAction =
  | { type: "grant"; player: Player }
  | { type: "revoke"; player: Player };

// ── Modale de confirmation ────────────────────────────────────────────────────

function ConfirmModal({
  action,
  onConfirm,
  onCancel,
  isPending,
}: {
  action: PendingAction;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const isRevoke = action.type === "revoke";
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
      animation: "ea-admin-fade-in .15s ease-out",
    }}>
      <div style={{
        width: "100%", maxWidth: 400,
        background: "#0e0326",
        border: `1.5px solid ${isRevoke ? "rgba(255,30,140,0.4)" : "rgba(0,212,232,0.3)"}`,
        borderRadius: 20,
        padding: "28px 24px",
        boxShadow: `0 0 60px ${isRevoke ? "rgba(255,30,140,0.15)" : "rgba(0,212,232,0.12)"}`,
        display: "flex", flexDirection: "column", gap: 20,
      }}>
        {/* Icône */}
        <div style={{ textAlign: "center", fontSize: 40 }}>
          {isRevoke ? "⚠️" : "👑"}
        </div>

        {/* Texte */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 18, color: EA.white,
            marginBottom: 10,
          }}>
            {isRevoke ? "Retirer les droits admin ?" : "Accorder les droits admin ?"}
          </div>
          <div style={{
            fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700,
            color: "rgba(255,255,255,0.6)", lineHeight: 1.5,
          }}>
            {isRevoke
              ? <>Le compte <strong style={{ color: EA.white }}>{action.player.pseudo}</strong> perdra l&apos;accès à l&apos;administration du site.</>
              : <>Le compte <strong style={{ color: EA.white }}>{action.player.pseudo}</strong> aura accès à l&apos;intégralité du panel admin.</>
            }
          </div>
        </div>

        {/* Boutons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={isPending}
            style={{
              flex: 1, padding: "11px 0",
              background: "rgba(255,255,255,0.05)",
              border: `1.5px solid rgba(255,255,255,0.12)`,
              borderRadius: 12,
              fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800,
              color: "rgba(255,255,255,0.7)", cursor: "pointer",
            }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            style={{
              flex: 1, padding: "11px 0",
              background: isRevoke ? EA.pink : EA.cyan,
              border: "none", borderRadius: 12,
              fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800,
              color: isRevoke ? EA.white : EA.ink,
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? "…" : isRevoke ? "Oui, retirer" : "Oui, accorder"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function AdminsClient({ players, adminPlayerIds: initial, superAdminId }: Props) {
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set(initial));
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isPending, startTransition] = useTransition();

  const admins = players.filter((p) => adminIds.has(p.id));
  const nonAdmins = players.filter(
    (p) =>
      !adminIds.has(p.id) &&
      p.pseudo.toLowerCase().includes(search.toLowerCase()),
  );

  function flash(id: string, msg: string, ok: boolean) {
    setFeedback({ id, msg, ok });
    setTimeout(() => setFeedback(null), 3000);
  }

  function confirmGrant(player: Player) {
    setPendingAction({ type: "grant", player });
  }

  function confirmRevoke(player: Player) {
    setPendingAction({ type: "revoke", player });
  }

  function handleConfirm() {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);

    startTransition(async () => {
      if (action.type === "grant") {
        const res = await grantAdmin(action.player.id);
        if ("ok" in res) {
          setAdminIds((prev) => new Set([...prev, action.player.id]));
          flash(action.player.id, `${action.player.pseudo} est maintenant admin ✓`, true);
        } else {
          flash(action.player.id, res.error, false);
        }
      } else {
        const res = await revokeAdmin(action.player.id);
        if ("ok" in res) {
          setAdminIds((prev) => {
            const next = new Set(prev);
            next.delete(action.player.id);
            return next;
          });
          flash(action.player.id, `Accès admin retiré ✓`, true);
        } else {
          flash(action.player.id, res.error, false);
        }
      }
    });
  }

  return (
    <>
      {pendingAction && (
        <ConfirmModal
          action={pendingAction}
          onConfirm={handleConfirm}
          onCancel={() => setPendingAction(null)}
          isPending={isPending}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {/* Admins actuels */}
        <section>
          <div style={{
            fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900,
            color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
            letterSpacing: 2, marginBottom: 14,
          }}>
            Admins actifs — {admins.length}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {admins.length === 0 && (
              <div style={{
                padding: "16px 20px",
                background: "rgba(255,255,255,0.02)",
                border: `1.5px solid rgba(255,255,255,0.06)`,
                borderRadius: 12,
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700,
                color: "rgba(255,255,255,0.35)", textAlign: "center",
              }}>Aucun admin</div>
            )}
            {admins.map((p) => {
              const fb = feedback?.id === p.id ? feedback : null;
              const isProtected = superAdminId !== null && p.id === superAdminId;
              return (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px",
                  background: isProtected
                    ? "rgba(251,191,36,0.07)"
                    : "rgba(0,212,232,0.05)",
                  border: `1.5px solid ${isProtected ? "rgba(251,191,36,0.35)" : "rgba(0,212,232,0.2)"}`,
                  borderRadius: 14,
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 999, flexShrink: 0,
                    background: `linear-gradient(135deg, ${EA.cyan}, ${EA.pink})`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-display)", fontSize: 15, color: EA.white,
                    overflow: "hidden",
                  }}>
                    {p.avatar_url
                      ? <img src={p.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : p.pseudo[0].toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 900,
                      color: EA.white, display: "flex", alignItems: "center", gap: 6,
                    }}>
                      {p.pseudo}
                      {isProtected && (
                        <span style={{
                          fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 900,
                          background: EA.butter, color: EA.ink,
                          borderRadius: 999, padding: "2px 7px",
                          textTransform: "uppercase", letterSpacing: 1,
                        }}>Protégé</span>
                      )}
                    </div>
                    <div style={{
                      fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700,
                      color: isProtected ? EA.butter : EA.cyan,
                      textTransform: "uppercase", letterSpacing: 1,
                    }}>
                      {isProtected ? "🔒 Super admin" : "👑 Admin"}
                    </div>
                  </div>

                  {fb && (
                    <span style={{
                      fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700,
                      color: fb.ok ? "#4ade80" : EA.pink,
                    }}>{fb.msg}</span>
                  )}

                  {isProtected ? (
                    <div
                      title="Compte protégé — non révocable"
                      style={{
                        padding: "7px 14px",
                        background: "rgba(251,191,36,0.08)",
                        border: `1.5px solid rgba(251,191,36,0.2)`,
                        borderRadius: 10,
                        fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800,
                        color: "rgba(251,191,36,0.4)",
                        flexShrink: 0, cursor: "not-allowed",
                      }}
                    >
                      🔒 Protégé
                    </div>
                  ) : (
                    <button
                      onClick={() => confirmRevoke(p)}
                      disabled={isPending}
                      style={{
                        padding: "7px 14px",
                        background: "rgba(255,30,140,0.1)",
                        border: `1.5px solid rgba(255,30,140,0.3)`,
                        borderRadius: 10,
                        fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800,
                        color: EA.pink, cursor: "pointer",
                        transition: "all .15s", flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = EA.pink;
                        e.currentTarget.style.color = EA.white;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(255,30,140,0.1)";
                        e.currentTarget.style.color = EA.pink;
                      }}
                    >
                      Retirer admin
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Ajouter un admin */}
        <section>
          <div style={{
            fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900,
            color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
            letterSpacing: 2, marginBottom: 14,
          }}>
            Donner les droits admin
          </div>

          <input
            type="search"
            placeholder="Rechercher un joueur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              display: "block", width: "100%", boxSizing: "border-box",
              padding: "10px 14px",
              background: "rgba(255,255,255,0.05)",
              border: `1.5px solid rgba(255,255,255,0.1)`,
              borderRadius: 12, outline: "none",
              fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700,
              color: EA.white, marginBottom: 12,
            }}
          />

          <div style={{
            display: "flex", flexDirection: "column", gap: 6,
            maxHeight: 340, overflowY: "auto",
          }} className="ea-admin-scroll">
            {nonAdmins.length === 0 && (
              <div style={{
                padding: "14px 20px",
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700,
                color: "rgba(255,255,255,0.3)", textAlign: "center",
              }}>
                {search ? "Aucun joueur trouvé" : "Tous les joueurs sont déjà admins"}
              </div>
            )}
            {nonAdmins.map((p) => {
              const fb = feedback?.id === p.id ? feedback : null;
              return (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.02)",
                  border: `1.5px solid rgba(255,255,255,0.06)`,
                  borderRadius: 12,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 999, flexShrink: 0,
                    background: "rgba(255,255,255,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-display)", fontSize: 14, color: EA.white,
                    overflow: "hidden",
                  }}>
                    {p.avatar_url
                      ? <img src={p.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : p.pseudo[0].toUpperCase()}
                  </div>

                  <span style={{
                    flex: 1,
                    fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800,
                    color: "rgba(255,255,255,0.8)",
                  }}>{p.pseudo}</span>

                  {fb && (
                    <span style={{
                      fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700,
                      color: fb.ok ? "#4ade80" : EA.pink,
                    }}>{fb.msg}</span>
                  )}

                  <button
                    onClick={() => confirmGrant(p)}
                    disabled={isPending}
                    style={{
                      padding: "6px 14px",
                      background: "rgba(0,212,232,0.1)",
                      border: `1.5px solid rgba(0,212,232,0.3)`,
                      borderRadius: 10,
                      fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800,
                      color: EA.cyan, cursor: "pointer",
                      transition: "all .15s", flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = EA.cyan;
                      e.currentTarget.style.color = EA.ink;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(0,212,232,0.1)";
                      e.currentTarget.style.color = EA.cyan;
                    }}
                  >
                    Rendre admin
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
