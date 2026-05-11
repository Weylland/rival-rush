"use client";

import { useState, useTransition } from "react";
import { deletePlayer, resetPlayerPassword } from "./actions";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";

const PAGE_SIZE = 15;

interface Player {
  id: string;
  pseudo: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  neverPlayed: boolean;
}

export function AdminClient({ players: initialPlayers }: { players: Player[] }) {
  const [list, setList] = useState<Player[]>(initialPlayers);
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  function handleReset(playerId: string) {
    setError(null);
    startTransition(async () => {
      const result = await resetPlayerPassword(playerId);
      if ("error" in result) setError(result.error);
      else setTempPasswords((prev) => ({ ...prev, [playerId]: result.tempPassword }));
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
        setConfirm(null);
      }
    });
  }

  const filtered = search.trim()
    ? list.filter((p) => p.pseudo.toLowerCase().includes(search.trim().toLowerCase()))
    : list;

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* Barre de recherche */}
      <div style={{ position: "relative" }}>
        <svg
          style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", opacity: 0.4, pointerEvents: "none" }}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={EA.white} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={`Rechercher parmi ${list.length} joueur${list.length !== 1 ? "s" : ""}…`}
          style={{
            width: "100%", boxSizing: "border-box",
            fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700,
            color: EA.white, background: "rgba(255,255,255,0.06)",
            border: `2px solid ${search ? EA.cyan : EA.ink}`,
            borderRadius: 12, padding: "12px 16px 12px 42px",
            outline: "none", transition: "border-color .15s",
          }}
        />
        {search && (
          <button
            onClick={() => { setSearch(""); setPage(1); }}
            style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", color: "rgba(255,255,255,0.4)",
              cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 4,
            }}
          >×</button>
        )}
      </div>

      {error && (
        <div style={{
          background: "rgba(255,30,140,0.15)", border: `2px solid ${EA.pink}`,
          borderRadius: 12, padding: "12px 16px",
          fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800, color: EA.white,
        }}>{error}</div>
      )}

      {filtered.length === 0 && (
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 18, color: "rgba(255,255,255,0.4)",
          textAlign: "center", padding: "40px 0", transform: "skewX(-4deg)",
        }}>
          {search ? `Aucun résultat pour "${search}"` : "Aucun joueur"}
        </div>
      )}

      {paginated.map((player) => (
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

      {hasMore && (
        <button
          onClick={() => setPage((p) => p + 1)}
          style={{
            width: "100%",
            fontFamily: "var(--font-display)", fontSize: 14,
            color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.06)",
            border: `2px solid rgba(255,255,255,0.15)`,
            borderRadius: 999, padding: "12px",
            cursor: "pointer", transform: "skewX(-3deg)",
          }}
        >
          <span style={{ display: "inline-block", transform: "skewX(3deg)" }}>
            Voir plus ({filtered.length - paginated.length} restants)
          </span>
        </button>
      )}
    </div>
  );
}
