"use client";

import { useState, useTransition } from "react";
import {
  deletePlayer,
  resetPlayerPassword,
  updatePlayerPseudo,
  setPlayerStats,
  sendPlayerWarning,
} from "./actions";
import { RR } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";

const PAGE_SIZE = 15;

interface Player {
  id: string;
  pseudo: string;
  avatar_url: string | null;
  avatar_color: string | null;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  neverPlayed: boolean;
}

type ExpandedPanel = "rename" | "stats" | "warning" | null;

function PlayerCard({
  player,
  onDelete,
  onRename,
}: {
  player: Player;
  onDelete: (id: string) => void;
  onRename: (id: string, pseudo: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [expanded, setExpanded] = useState<ExpandedPanel>(null);
  const [tempPasswords, setTempPasswords] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Rename state
  const [newPseudo, setNewPseudo] = useState(player.pseudo);

  // Stats state
  const [statsWins, setStatsWins] = useState(String(player.wins));
  const [statsLosses, setStatsLosses] = useState(String(player.losses));
  const [statsDraws, setStatsDraws] = useState(String(player.draws));

  // Warning state
  const [warningMsg, setWarningMsg] = useState("");

  function flash(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  function handleReset() {
    setError(null);
    startTransition(async () => {
      const result = await resetPlayerPassword(player.id);
      if ("error" in result) setError(result.error);
      else setTempPasswords(result.tempPassword);
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deletePlayer(player.id);
      if (result?.error) setError(result.error);
      else onDelete(player.id);
    });
  }

  function handleRename() {
    setError(null);
    startTransition(async () => {
      const result = await updatePlayerPseudo(player.id, newPseudo);
      if ("error" in result) setError(result.error);
      else {
        onRename(player.id, newPseudo.trim());
        flash("Pseudo modifié ✓");
        setExpanded(null);
      }
    });
  }

  function handleSetStats() {
    const w = parseInt(statsWins);
    const l = parseInt(statsLosses);
    const d = parseInt(statsDraws);
    if ([w, l, d].some((n) => isNaN(n) || n < 0)) {
      setError("Valeurs invalides (entiers ≥ 0)");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await setPlayerStats(player.id, w, l, d);
      if ("error" in result) setError(result.error);
      else {
        flash("Stats mises à jour ✓");
        setExpanded(null);
      }
    });
  }

  function handleSendWarning() {
    if (!warningMsg.trim()) {
      setError("Message vide");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await sendPlayerWarning(player.id, warningMsg);
      if ("error" in result) setError(result.error);
      else {
        setWarningMsg("");
        flash("Avertissement envoyé ✓");
        setExpanded(null);
      }
    });
  }

  function togglePanel(panel: ExpandedPanel) {
    setError(null);
    setSuccess(null);
    setExpanded((prev) => (prev === panel ? null : panel));
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: "var(--font-sans)",
    fontSize: 13,
    fontWeight: 700,
    color: RR.white,
    background: "rgba(255,255,255,0.08)",
    border: `2px solid rgba(255,255,255,0.2)`,
    borderRadius: 8,
    padding: "8px 12px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  const saveBtnStyle: React.CSSProperties = {
    fontFamily: "var(--font-display)",
    fontSize: 13,
    color: RR.violetDeep,
    background: RR.cyan,
    border: `2px solid ${RR.ink}`,
    borderRadius: 999,
    padding: "8px 18px",
    cursor: pending ? "wait" : "pointer",
    boxShadow: `2px 2px 0 ${RR.ink}`,
    opacity: pending ? 0.7 : 1,
  };

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: RR.violetDeep,
        border: `2.5px solid ${RR.ink}`,
        borderRadius: 18,
        boxShadow: `2px 2px 0 ${RR.ink}`,
      }}
    >
      {/* Temp password overlay */}
      {tempPasswords && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 18,
            background: RR.violetDeep,
            border: `2.5px solid ${RR.cyan}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "12px 16px",
            zIndex: 10,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 11,
              fontWeight: 900,
              color: RR.cyan,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Mdp temporaire pour {player.pseudo}
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 28,
              color: RR.butter,
              letterSpacing: 6,
              transform: "skewX(-4deg)",
            }}
          >
            {tempPasswords}
          </div>
          <button
            onClick={() => setTempPasswords(null)}
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 11,
              fontWeight: 800,
              background: "rgba(255,255,255,0.1)",
              border: `1.5px solid ${RR.ink}`,
              borderRadius: 999,
              padding: "5px 12px",
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
            }}
          >
            OK, noté
          </button>
        </div>
      )}

      {/* Main row */}
      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Avatar
          name={player.pseudo}
          src={player.avatar_url}
          color={player.avatar_color ?? RR.pink}
          ring="transparent"
          size={42}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 17,
              color: RR.white,
              transform: "skewX(-4deg)",
            }}
          >
            {player.pseudo}
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 700,
              color: "rgba(255,255,255,0.45)",
              marginTop: 2,
            }}
          >
            {player.neverPlayed
              ? "Aucune partie"
              : `${player.wins}V · ${player.losses}D · ${player.draws}= · ${player.points}pts`}
          </div>
        </div>

        {/* Action buttons */}
        {!confirm ? (
          <div
            style={{ display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}
          >
            <button
              onClick={() => togglePanel("rename")}
              disabled={pending}
              title="Renommer"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 13,
                background:
                  expanded === "rename"
                    ? RR.cyan
                    : "rgba(0,212,232,0.12)",
                border: `2px solid ${RR.cyan}`,
                borderRadius: 999,
                padding: "7px 12px",
                color: expanded === "rename" ? RR.violetDeep : RR.cyan,
                cursor: "pointer",
              }}
            >
              ✏️
            </button>
            <button
              onClick={() => togglePanel("stats")}
              disabled={pending}
              title="Modifier stats"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 13,
                background:
                  expanded === "stats"
                    ? RR.butter
                    : "rgba(255,233,74,0.1)",
                border: `2px solid ${RR.butter}`,
                borderRadius: 999,
                padding: "7px 12px",
                color: expanded === "stats" ? RR.violetDeep : RR.butter,
                cursor: "pointer",
              }}
            >
              📊
            </button>
            <button
              onClick={() => togglePanel("warning")}
              disabled={pending}
              title="Envoyer un avertissement"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 13,
                background:
                  expanded === "warning"
                    ? RR.pink
                    : "rgba(255,30,140,0.1)",
                border: `2px solid ${RR.pink}`,
                borderRadius: 999,
                padding: "7px 12px",
                color: expanded === "warning" ? RR.white : RR.pink,
                cursor: "pointer",
              }}
            >
              ⚠️
            </button>
            <button
              onClick={handleReset}
              disabled={pending}
              title="Réinitialiser mdp"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 13,
                background: "rgba(255,233,74,0.1)",
                border: `2px solid ${RR.butter}`,
                borderRadius: 999,
                padding: "7px 12px",
                color: RR.butter,
                cursor: pending ? "wait" : "pointer",
                opacity: pending ? 0.6 : 1,
              }}
            >
              🔑
            </button>
            <button
              onClick={() => setConfirm(true)}
              title="Supprimer"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 13,
                background: "rgba(255,30,140,0.1)",
                border: `2px solid ${RR.pink}`,
                borderRadius: 999,
                padding: "7px 12px",
                color: RR.pink,
                cursor: "pointer",
              }}
            >
              🗑
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => setConfirm(false)}
              disabled={pending}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 12,
                background: "rgba(255,255,255,0.1)",
                border: `2px solid ${RR.ink}`,
                borderRadius: 999,
                padding: "8px 14px",
                color: RR.white,
                cursor: "pointer",
              }}
            >
              Annuler
            </button>
            <button
              onClick={handleDelete}
              disabled={pending}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 12,
                background: RR.pink,
                border: `2px solid ${RR.ink}`,
                borderRadius: 999,
                padding: "8px 14px",
                color: RR.white,
                cursor: pending ? "wait" : "pointer",
                boxShadow: `2px 2px 0 ${RR.ink}`,
                opacity: pending ? 0.7 : 1,
              }}
            >
              Confirmer
            </button>
          </div>
        )}
      </div>

      {/* Error / success feedback */}
      {(error || success) && (
        <div
          style={{
            padding: "0 16px 10px",
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 800,
            color: error ? RR.pink : "#4ade80",
          }}
        >
          {error ? `⚠ ${error}` : `✓ ${success}`}
        </div>
      )}

      {/* Expanded panels */}
      {expanded === "rename" && (
        <div
          style={{
            borderTop: `1.5px solid rgba(255,255,255,0.08)`,
            padding: "14px 16px",
            background: "rgba(0,212,232,0.06)",
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            value={newPseudo}
            onChange={(e) => setNewPseudo(e.target.value)}
            maxLength={20}
            placeholder="Nouveau pseudo"
            style={{ ...inputStyle, flex: 1, minWidth: 120 }}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          <button onClick={handleRename} disabled={pending} style={saveBtnStyle}>
            Renommer
          </button>
        </div>
      )}

      {expanded === "stats" && (
        <div
          style={{
            borderTop: `1.5px solid rgba(255,255,255,0.08)`,
            padding: "14px 16px",
            background: "rgba(255,233,74,0.04)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 11,
              fontWeight: 900,
              color: "rgba(255,255,255,0.4)",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 10,
            }}
          >
            Modifier les stats manuellement
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            {[
              {
                label: "Victoires",
                value: statsWins,
                set: setStatsWins,
                color: "#4ade80",
              },
              {
                label: "Défaites",
                value: statsLosses,
                set: setStatsLosses,
                color: RR.pink,
              },
              {
                label: "Nuls",
                value: statsDraws,
                set: setStatsDraws,
                color: RR.butter,
              },
            ].map(({ label, value, set, color }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <label
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 9,
                    fontWeight: 900,
                    color,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {label}
                </label>
                <input
                  type="number"
                  min="0"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  style={{
                    width: 60,
                    fontFamily: "var(--font-display)",
                    fontSize: 20,
                    color,
                    background: "rgba(255,255,255,0.07)",
                    border: `2px solid rgba(255,255,255,0.15)`,
                    borderRadius: 8,
                    padding: "4px 0",
                    textAlign: "center",
                    outline: "none",
                  }}
                />
              </div>
            ))}
            <button
              onClick={handleSetStats}
              disabled={pending}
              style={{ ...saveBtnStyle, marginBottom: 0 }}
            >
              Sauver
            </button>
          </div>
        </div>
      )}

      {expanded === "warning" && (
        <div
          style={{
            borderTop: `1.5px solid rgba(255,255,255,0.08)`,
            padding: "14px 16px",
            background: "rgba(255,30,140,0.06)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 11,
              fontWeight: 900,
              color: "rgba(255,255,255,0.4)",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 10,
            }}
          >
            Envoyer un avertissement à {player.pseudo}
          </div>
          <textarea
            value={warningMsg}
            onChange={(e) => setWarningMsg(e.target.value)}
            placeholder="Message d'avertissement visible par le joueur…"
            rows={3}
            style={{
              ...inputStyle,
              resize: "vertical",
              lineHeight: 1.5,
              marginBottom: 10,
            }}
          />
          <button
            onClick={handleSendWarning}
            disabled={pending}
            style={{
              ...saveBtnStyle,
              background: RR.pink,
              border: `2px solid ${RR.ink}`,
              color: RR.white,
              boxShadow: `2px 2px 0 ${RR.ink}`,
            }}
          >
            ⚠️ Envoyer l&apos;avertissement
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminClient({ players: initialPlayers }: { players: Player[] }) {
  const [list, setList] = useState<Player[]>(initialPlayers);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = search.trim()
    ? list.filter((p) =>
        p.pseudo.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : list;

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Search */}
      <div style={{ position: "relative" }}>
        <svg
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            opacity: 0.4,
            pointerEvents: "none",
          }}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={RR.white}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={`Rechercher parmi ${list.length} joueur${list.length !== 1 ? "s" : ""}…`}
          style={{
            width: "100%",
            boxSizing: "border-box",
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            fontWeight: 700,
            color: RR.white,
            background: "rgba(255,255,255,0.06)",
            border: `2px solid ${search ? RR.cyan : RR.ink}`,
            borderRadius: 12,
            padding: "12px 16px 12px 42px",
            outline: "none",
            transition: "border-color .15s",
          }}
        />
        {search && (
          <button
            onClick={() => {
              setSearch("");
              setPage(1);
            }}
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.4)",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        )}
      </div>

      {filtered.length === 0 && (
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            color: "rgba(255,255,255,0.4)",
            textAlign: "center",
            padding: "40px 0",
            transform: "skewX(-4deg)",
          }}
        >
          {search ? `Aucun résultat pour "${search}"` : "Aucun joueur"}
        </div>
      )}

      {paginated.map((player) => (
        <PlayerCard
          key={player.id}
          player={player}
          onDelete={(id) => setList((prev) => prev.filter((p) => p.id !== id))}
          onRename={(id, pseudo) =>
            setList((prev) =>
              prev.map((p) => (p.id === id ? { ...p, pseudo } : p)),
            )
          }
        />
      ))}

      {hasMore && (
        <button
          onClick={() => setPage((p) => p + 1)}
          style={{
            width: "100%",
            fontFamily: "var(--font-display)",
            fontSize: 14,
            color: "rgba(255,255,255,0.6)",
            background: "rgba(255,255,255,0.06)",
            border: `2px solid rgba(255,255,255,0.15)`,
            borderRadius: 999,
            padding: "12px",
            cursor: "pointer",
            transform: "skewX(-3deg)",
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
