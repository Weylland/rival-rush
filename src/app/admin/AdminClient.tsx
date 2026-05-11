"use client";

import { useState, useTransition } from "react";
import { deletePlayer, resetPlayerPassword } from "./actions";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";

interface Player {
  id: string;
  pseudo: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  neverPlayed: boolean;
}

export function AdminClient({ players }: { players: Player[] }) {
  const [list, setList] = useState<Player[]>(players);
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({});

  function handleReset(playerId: string) {
    setError(null);
    startTransition(async () => {
      const result = await resetPlayerPassword(playerId);
      if ("error" in result) {
        setError(result.error);
      } else {
        setTempPasswords((prev) => ({ ...prev, [playerId]: result.tempPassword }));
      }
    });
  }

  function handleDelete(playerId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deletePlayer(playerId);
      if (result?.error) {
        setError(result.error);
      } else {
        setList((prev) => prev.filter((p) => p.id !== playerId));
      }
      setConfirm(null);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {error && (
        <div style={{
          background: "rgba(255,30,140,0.15)", border: `2px solid ${EA.pink}`,
          borderRadius: 12, padding: "12px 16px",
          fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800, color: EA.white,
        }}>{error}</div>
      )}

      {list.length === 0 && (
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 18, color: "rgba(255,255,255,0.4)",
          textAlign: "center", padding: "40px 0", transform: "skewX(-4deg)",
        }}>
          Aucun joueur
        </div>
      )}

      {list.map((player) => (
        <div key={player.id} style={{
          position: "relative", overflow: "hidden",
          background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
          borderRadius: 18, padding: "14px 16px",
          boxShadow: `2px 2px 0 ${EA.ink}`,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <Avatar name={player.pseudo} color={EA.pink} ring="transparent" size={42} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: EA.white, transform: "skewX(-4deg)" }}>
              {player.pseudo}
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
              {player.neverPlayed
                ? "Aucune partie jouée"
                : `${player.wins}V · ${player.losses}D · ${player.draws}= · ${player.points}pts`}
            </div>
          </div>

          {tempPasswords[player.id] && (
            <div style={{
              position: "absolute", inset: 0, borderRadius: 18,
              background: EA.violetDeep, border: `2.5px solid ${EA.cyan}`,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 8, padding: "12px 16px",
            }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1 }}>
                Mdp temporaire pour {player.pseudo}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: EA.butter, letterSpacing: 6, transform: "skewX(-4deg)" }}>
                {tempPasswords[player.id]}
              </div>
              <button
                onClick={() => setTempPasswords((prev) => { const n = { ...prev }; delete n[player.id]; return n; })}
                style={{
                  fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800,
                  background: "rgba(255,255,255,0.1)", border: `1.5px solid ${EA.ink}`,
                  borderRadius: 999, padding: "5px 12px", color: "rgba(255,255,255,0.6)", cursor: "pointer",
                }}
              >
                OK, j'ai noté
              </button>
            </div>
          )}

          {confirm === player.id ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setConfirm(null)}
                disabled={pending}
                style={{
                  fontFamily: "var(--font-display)", fontSize: 12,
                  background: "rgba(255,255,255,0.15)", border: `2px solid ${EA.ink}`,
                  borderRadius: 999, padding: "8px 14px",
                  color: EA.white, cursor: "pointer",
                }}>Annuler</button>
              <button
                onClick={() => handleDelete(player.id)}
                disabled={pending}
                style={{
                  fontFamily: "var(--font-display)", fontSize: 12,
                  background: EA.pink, border: `2px solid ${EA.ink}`,
                  borderRadius: 999, padding: "8px 14px",
                  color: EA.white, cursor: pending ? "wait" : "pointer",
                  boxShadow: `2px 2px 0 ${EA.ink}`,
                  opacity: pending ? 0.7 : 1,
                }}>Confirmer</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => handleReset(player.id)}
                disabled={pending}
                style={{
                  fontFamily: "var(--font-display)", fontSize: 13,
                  background: "rgba(255,233,74,0.15)", border: `2px solid ${EA.butter}`,
                  borderRadius: 999, padding: "8px 14px",
                  color: EA.butter, cursor: pending ? "wait" : "pointer",
                  opacity: pending ? 0.6 : 1,
                }}>🔑 Reset</button>
              <button
                onClick={() => setConfirm(player.id)}
                style={{
                  fontFamily: "var(--font-display)", fontSize: 13,
                  background: "rgba(255,30,140,0.15)", border: `2px solid ${EA.pink}`,
                  borderRadius: 999, padding: "8px 14px",
                  color: EA.pink, cursor: "pointer",
                }}>🗑</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
