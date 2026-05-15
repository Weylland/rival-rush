"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { EA } from "@/lib/design";
import { deleteRoom, updateRoom } from "./actions";
import { GAME_LABELS } from "@/lib/game-labels";

interface RoomEntry {
  id: string;
  name: string;
  code: string;
  host_id: string;
  host_pseudo: string;
  is_open: boolean;
  is_public: boolean;
  memberCount: number;
  created_at: string;
  expires_at: string | null;
  allowed_games: string[] | null;
  max_members: number | null;
}

interface Member {
  player_id: string;
  pseudo: string;
  joined_at: string;
}

const ALL_GAMES = [
  { key: "pfc", label: "PFC ✊" },
  { key: "morpion", label: "Morpion ⭕" },
  { key: "puissance4", label: "Puissance 4 🔴" },
  { key: "reflexe", label: "Réflexe ⚡" },
  { key: "naval", label: "Naval 🚢" },
  { key: "chess", label: "Échecs ♟️" },
  { key: "nim", label: "Nim 🔢" },
  { key: "pig", label: "Pig 🐷" },
  { key: "mastermind", label: "Mastermind 🎯" },
  { key: "plus-ou-moins", label: "Plus ou Moins 🔢" },
  { key: "duel-des", label: "Duel des Dés 🎲" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ─── Toggle ──────────────────────────────────────────────────────── */
function Toggle({
  value, onChange, colorOn = "#4ade80", disabled,
}: {
  value: boolean; onChange: (v: boolean) => void; colorOn?: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      disabled={disabled}
      style={{
        width: 44, height: 24, borderRadius: 999, border: `2px solid ${value ? colorOn : "rgba(255,255,255,0.2)"}`,
        background: value ? colorOn : "rgba(255,255,255,0.1)",
        cursor: disabled ? "wait" : "pointer", position: "relative", flexShrink: 0,
        transition: "background .2s, border-color .2s", padding: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: value ? 22 : 2,
        width: 16, height: 16, borderRadius: "50%", background: EA.white,
        transition: "left .2s", display: "block",
      }} />
    </button>
  );
}

/* ─── Room detail / edit panel ────────────────────────────────────── */
function RoomDetailPanel({
  room, members, membersLoaded, onClose, onSaved, onDeleted,
}: {
  room: RoomEntry;
  members: Member[];
  membersLoaded: boolean;
  onClose: () => void;
  onSaved: (updated: Partial<RoomEntry>) => void;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Editable state
  const [name, setName] = useState(room.name);
  const [isOpen, setIsOpen] = useState(room.is_open);
  const [isPublic, setIsPublic] = useState(room.is_public);
  const [maxMembers, setMaxMembers] = useState(
    room.max_members !== null ? String(room.max_members) : "",
  );
  const [allowedGames, setAllowedGames] = useState<string[]>(
    room.allowed_games ?? [],
  );

  const hasChanges =
    name !== room.name ||
    isOpen !== room.is_open ||
    isPublic !== room.is_public ||
    maxMembers !== (room.max_members !== null ? String(room.max_members) : "") ||
    JSON.stringify([...allowedGames].sort()) !==
      JSON.stringify([...(room.allowed_games ?? [])].sort());

  function toggleGame(key: string) {
    setAllowedGames((prev) =>
      prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key],
    );
  }

  function handleSave() {
    setError(null);
    const maxVal = maxMembers.trim() === "" ? null : parseInt(maxMembers);
    if (maxMembers.trim() !== "" && (isNaN(maxVal!) || maxVal! < 2 || maxVal! > 50)) {
      setError("Max membres : nombre entre 2 et 50, ou vide pour illimité");
      return;
    }
    startTransition(async () => {
      const res = await updateRoom(room.id, {
        name: name.trim(),
        is_open: isOpen,
        is_public: isPublic,
        max_members: maxVal,
        allowed_games: allowedGames.length > 0 ? allowedGames : null,
      });
      if ("error" in res) {
        setError(res.error);
      } else {
        onSaved({
          name: name.trim(),
          is_open: isOpen,
          is_public: isPublic,
          max_members: maxVal,
          allowed_games: allowedGames.length > 0 ? allowedGames : null,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteRoom(room.id);
      if ("error" in res) setError(res.error);
      else onDeleted();
    });
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    fontWeight: 700,
    color: EA.white,
    background: "rgba(255,255,255,0.06)",
    border: "1.5px solid rgba(255,255,255,0.15)",
    borderRadius: 10,
    padding: "9px 12px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-sans)",
    fontSize: 10,
    fontWeight: 900,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    display: "block",
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  };

  return (
    <div
      style={{
        borderTop: "1.5px solid rgba(255,255,255,0.1)",
        background: "rgba(0,0,0,0.3)",
        padding: "20px",
      }}
    >
      {/* Header detail */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1 }}>
          ⚙ Paramètres du salon
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.12)",
            borderRadius: 8, padding: "4px 10px", color: "rgba(255,255,255,0.5)",
            fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}
        >
          ✕ Fermer
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>

        {/* LEFT: editable fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Nom */}
          <div>
            <label style={labelStyle}>Nom du salon</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              style={inputStyle}
            />
          </div>

          {/* Toggles */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "4px 14px" }}>
            <div style={rowStyle}>
              <div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: EA.white }}>
                  Salon ouvert
                </div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                  Les joueurs peuvent rejoindre
                </div>
              </div>
              <Toggle value={isOpen} onChange={setIsOpen} colorOn="#4ade80" disabled={pending} />
            </div>
            <div style={{ ...rowStyle, borderBottom: "none" }}>
              <div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700, color: EA.white }}>
                  Salon public
                </div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                  Visible dans la liste des salons
                </div>
              </div>
              <Toggle value={isPublic} onChange={setIsPublic} colorOn={EA.cyan} disabled={pending} />
            </div>
          </div>

          {/* Max membres */}
          <div>
            <label style={labelStyle}>Membres max <span style={{ opacity: 0.5, fontWeight: 600 }}>(vide = illimité)</span></label>
            <input
              type="number"
              min={2}
              max={50}
              value={maxMembers}
              onChange={(e) => setMaxMembers(e.target.value)}
              placeholder="Illimité"
              style={inputStyle}
            />
          </div>

          {/* Jeux autorisés */}
          <div>
            <label style={labelStyle}>Jeux autorisés <span style={{ opacity: 0.5, fontWeight: 600 }}>(vide = tous)</span></label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ALL_GAMES.map(({ key, label }) => {
                const active = allowedGames.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleGame(key)}
                    style={{
                      fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800,
                      color: active ? EA.violetDeep : "rgba(255,255,255,0.5)",
                      background: active ? EA.cyan : "rgba(255,255,255,0.05)",
                      border: `1.5px solid ${active ? EA.cyan : "rgba(255,255,255,0.12)"}`,
                      borderRadius: 999, padding: "5px 12px", cursor: "pointer",
                      transition: "all .15s",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div style={{ background: "rgba(255,30,140,0.12)", border: `1.5px solid ${EA.pink}`, borderRadius: 10, padding: "10px 14px", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800, color: EA.pink }}>
              ⚠ {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={handleSave}
              disabled={!hasChanges || pending}
              style={{
                fontFamily: "var(--font-display)", fontSize: 14,
                color: EA.violetDeep, background: hasChanges ? EA.cyan : "rgba(255,255,255,0.15)",
                border: `2px solid ${hasChanges ? EA.ink : "transparent"}`,
                borderRadius: 999, padding: "10px 24px",
                cursor: !hasChanges || pending ? "default" : "pointer",
                boxShadow: hasChanges ? `3px 3px 0 ${EA.ink}` : "none",
                opacity: pending ? 0.6 : 1,
                transition: "all .2s",
              }}
            >
              {pending ? "…" : saved ? "✓ Sauvegardé" : "Sauvegarder"}
            </button>

            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  fontFamily: "var(--font-display)", fontSize: 14,
                  color: EA.pink, background: "rgba(255,30,140,0.1)",
                  border: `2px solid ${EA.pink}`, borderRadius: 999,
                  padding: "10px 20px", cursor: "pointer",
                }}
              >
                🗑 Supprimer
              </button>
            ) : (
              <>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{ fontFamily: "var(--font-display)", fontSize: 13, color: EA.white, background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.2)", borderRadius: 999, padding: "10px 16px", cursor: "pointer" }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  disabled={pending}
                  style={{ fontFamily: "var(--font-display)", fontSize: 13, color: EA.white, background: EA.pink, border: `2px solid ${EA.ink}`, borderRadius: 999, padding: "10px 16px", cursor: pending ? "wait" : "pointer", boxShadow: `2px 2px 0 ${EA.ink}` }}
                >
                  Confirmer la suppression
                </button>
              </>
            )}
          </div>
        </div>

        {/* RIGHT: infos + membres */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Infos lecture seule */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
              Informations
            </div>
            {[
              { label: "Code", value: `#${room.code}` },
              { label: "Hôte", value: room.host_pseudo },
              { label: "Créé le", value: formatDate(room.created_at) },
              { label: "Expire le", value: room.expires_at ? formatDate(room.expires_at) : "Jamais" },
              { label: "Membres actuels", value: `${room.memberCount}${room.max_members ? ` / ${room.max_members}` : ""}` },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>{label}</span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800, color: EA.white }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Membres */}
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
              Membres ({members.length})
            </div>
            {!membersLoaded ? (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Chargement…</div>
            ) : members.length === 0 ? (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Aucun membre</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {members.map((m) => (
                  <div
                    key={m.player_id}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10, padding: "8px 12px",
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 800, color: EA.white }}>
                      {m.player_id === room.host_id ? "👑 " : ""}{m.pseudo}
                    </span>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>
                      {new Date(m.joined_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────── */
export function RoomsAdminClient() {
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, Member[]>>({});
  const [membersLoaded, setMembersLoaded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data: rawRooms } = await supabase
      .from("rooms")
      .select("id, name, code, host_id, is_open, is_public, created_at, expires_at, allowed_games, max_members")
      .order("created_at", { ascending: false });

    if (!rawRooms || rawRooms.length === 0) {
      setRooms([]);
      setLoading(false);
      return;
    }

    const hostIds = [...new Set(rawRooms.map((r) => r.host_id as string))];
    const roomIds = rawRooms.map((r) => r.id as string);

    const [{ data: players }, { data: memberRows }] = await Promise.all([
      supabase.from("players").select("id, pseudo").in("id", hostIds),
      supabase.from("room_members").select("room_id").in("room_id", roomIds),
    ]);

    const pseudoMap = Object.fromEntries(
      (players ?? []).map((p) => [p.id, p.pseudo as string]),
    );
    const countMap: Record<string, number> = {};
    for (const m of memberRows ?? []) {
      const rid = m.room_id as string;
      countMap[rid] = (countMap[rid] ?? 0) + 1;
    }

    setRooms(
      rawRooms.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        code: r.code as string,
        host_id: r.host_id as string,
        host_pseudo: pseudoMap[r.host_id as string] ?? "?",
        is_open: r.is_open as boolean,
        is_public: r.is_public as boolean,
        memberCount: countMap[r.id as string] ?? 0,
        created_at: r.created_at as string,
        expires_at: (r.expires_at as string | null) ?? null,
        allowed_games: r.allowed_games as string[] | null,
        max_members: r.max_members as number | null,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleExpand(roomId: string) {
    if (expanded === roomId) {
      setExpanded(null);
      return;
    }
    setExpanded(roomId);
    if (!membersLoaded[roomId]) {
      const supabase = createClient();
      const { data: roomMembers } = await supabase
        .from("room_members")
        .select("player_id, joined_at")
        .eq("room_id", roomId)
        .order("joined_at");

      const pids = (roomMembers ?? []).map((m) => m.player_id as string);
      let pseudoMap: Record<string, string> = {};
      if (pids.length > 0) {
        const { data: players } = await supabase.from("players").select("id, pseudo").in("id", pids);
        pseudoMap = Object.fromEntries((players ?? []).map((p) => [p.id, p.pseudo as string]));
      }

      setMembers((prev) => ({
        ...prev,
        [roomId]: (roomMembers ?? []).map((m) => ({
          player_id: m.player_id as string,
          pseudo: pseudoMap[m.player_id as string] ?? "?",
          joined_at: m.joined_at as string,
        })),
      }));
      setMembersLoaded((prev) => ({ ...prev, [roomId]: true }));
    }
  }

  const filtered = search.trim()
    ? rooms.filter(
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.code.toLowerCase().includes(search.toLowerCase()) ||
          r.host_pseudo.toLowerCase().includes(search.toLowerCase()),
      )
    : rooms;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)" }}>
          {rooms.length} salle{rooms.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={load}
          disabled={loading}
          style={{
            fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800,
            color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)",
            border: "1.5px solid rgba(255,255,255,0.12)", borderRadius: 999,
            padding: "5px 12px", cursor: "pointer",
          }}
        >
          ↻ Rafraîchir
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher par nom, code, hôte…"
        style={{
          width: "100%", boxSizing: "border-box",
          fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700,
          color: EA.white, background: "rgba(255,255,255,0.06)",
          border: "2px solid rgba(255,255,255,0.15)", borderRadius: 10,
          padding: "10px 14px", outline: "none", marginBottom: 12,
        }}
      />

      {error && (
        <div style={{ background: "rgba(255,30,140,0.12)", border: `2px solid ${EA.pink}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800, color: EA.pink }}>
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "40px 0" }}>
          Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "40px 0" }}>
          Aucune salle
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((room) => {
            const isExpanded = expanded === room.id;
            return (
              <div
                key={room.id}
                style={{
                  background: isExpanded ? "rgba(45,27,142,0.5)" : EA.violetDeep,
                  border: `2px solid ${isExpanded ? EA.cyan + "60" : EA.ink}`,
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow: isExpanded ? `0 0 30px rgba(0,212,232,0.1)` : `2px 2px 0 ${EA.ink}`,
                  transition: "all .2s",
                }}
              >
                {/* Clickable header row */}
                <button
                  onClick={() => handleExpand(room.id)}
                  style={{
                    width: "100%", background: "none", border: "none",
                    cursor: "pointer", padding: "14px 16px", textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Name + badges */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: EA.white }}>
                          {room.name}
                        </span>
                        <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 900, color: EA.cyan, background: "rgba(0,212,232,0.12)", borderRadius: 999, padding: "2px 8px" }}>
                          #{room.code}
                        </span>
                        <span style={{
                          fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900,
                          color: room.is_open ? "#4ade80" : EA.pink,
                          background: room.is_open ? "rgba(74,222,128,0.12)" : "rgba(255,30,140,0.12)",
                          border: `1.5px solid ${room.is_open ? "#4ade80" : EA.pink}`,
                          borderRadius: 999, padding: "2px 8px", textTransform: "uppercase",
                        }}>
                          {room.is_open ? "Ouverte" : "Fermée"}
                        </span>
                        {!room.is_public && (
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 900, color: EA.butter, background: "rgba(255,233,74,0.1)", border: `1.5px solid ${EA.butter}`, borderRadius: 999, padding: "2px 8px" }}>
                            🔒 Privée
                          </span>
                        )}
                      </div>

                      {/* Meta */}
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                        Hôte : {room.host_pseudo} · {room.memberCount}{room.max_members ? `/${room.max_members}` : ""} membre{room.memberCount !== 1 ? "s" : ""} · {formatDate(room.created_at)}
                      </div>

                      {/* Games */}
                      {room.allowed_games && room.allowed_games.length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                          {room.allowed_games.map((g) => (
                            <span
                              key={g}
                              style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: 999, padding: "1px 7px" }}
                            >
                              {GAME_LABELS[g] ?? g}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Chevron */}
                    <span style={{
                      fontFamily: "var(--font-sans)", fontSize: 18,
                      color: isExpanded ? EA.cyan : "rgba(255,255,255,0.3)",
                      transform: isExpanded ? "rotate(180deg)" : "none",
                      transition: "transform .2s, color .2s",
                      flexShrink: 0, marginTop: 2,
                    }}>
                      ⌄
                    </span>
                  </div>
                </button>

                {/* Detail panel */}
                {isExpanded && (
                  <RoomDetailPanel
                    room={room}
                    members={members[room.id] ?? []}
                    membersLoaded={!!membersLoaded[room.id]}
                    onClose={() => setExpanded(null)}
                    onSaved={(updated) => {
                      setRooms((prev) =>
                        prev.map((r) => r.id === room.id ? { ...r, ...updated } : r),
                      );
                    }}
                    onDeleted={() => {
                      setRooms((prev) => prev.filter((r) => r.id !== room.id));
                      setExpanded(null);
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
