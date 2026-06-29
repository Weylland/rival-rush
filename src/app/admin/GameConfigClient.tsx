"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { RR } from "@/lib/design";
import { updateGameSetting } from "./actions";

interface GameSetting {
  game_type: string;
  is_active: boolean;
  win_pts: number;
  draw_pts: number;
  loss_pts: number;
}

const GAME_META: Record<string, { name: string; emoji: string }> = {
  pfc: { name: "Pierre-Feuille-Ciseaux", emoji: "✊" },
  morpion: { name: "Morpion", emoji: "⭕" },
  puissance4: { name: "Puissance 4", emoji: "🔴" },
  reflexe: { name: "Réflexe", emoji: "⚡" },
  naval: { name: "Bataille Navale", emoji: "🚢" },
  chess: { name: "Échecs", emoji: "♟️" },
  nim: { name: "Nim", emoji: "🔢" },
  pig: { name: "Pig", emoji: "🐷" },
  mastermind: { name: "Mastermind", emoji: "🎯" },
  "plus-ou-moins": { name: "Plus ou Moins", emoji: "🔢" },
  "duel-des": { name: "Duel des Dés", emoji: "🎲" },
};

export function GameConfigClient() {
  const [settings, setSettings] = useState<GameSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<
    Record<string, { win_pts: string; draw_pts: string; loss_pts: string }>
  >({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setDbError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("game_settings")
      .select("game_type, is_active, win_pts, draw_pts, loss_pts")
      .order("game_type");

    if (err) {
      setDbError(
        "La table game_settings n'existe pas encore. Exécutez le SQL ci-dessous dans votre projet Supabase.",
      );
    } else {
      const rows = (data ?? []) as GameSetting[];
      setSettings(rows);
      const initEdit: Record<string, { win_pts: string; draw_pts: string; loss_pts: string }> =
        {};
      for (const s of rows) {
        initEdit[s.game_type] = {
          win_pts: String(s.win_pts),
          draw_pts: String(s.draw_pts),
          loss_pts: String(s.loss_pts),
        };
      }
      setEditing(initEdit);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleToggleActive(gameType: string, current: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await updateGameSetting(gameType, "is_active", !current);
      if ("error" in res) setError(res.error);
      else
        setSettings((prev) =>
          prev.map((s) =>
            s.game_type === gameType ? { ...s, is_active: !current } : s,
          ),
        );
    });
  }

  function handleSavePts(gameType: string) {
    const edit = editing[gameType];
    if (!edit) return;
    const winPts = parseInt(edit.win_pts);
    const drawPts = parseInt(edit.draw_pts);
    const lossPts = parseInt(edit.loss_pts);
    if (
      isNaN(winPts) || isNaN(drawPts) || isNaN(lossPts) ||
      winPts < 0 || drawPts < 0 || lossPts < 0 ||
      winPts > 99 || drawPts > 99 || lossPts > 99
    ) {
      setError("Valeurs invalides (entiers entre 0 et 99)");
      return;
    }
    setError(null);
    startTransition(async () => {
      const [r1, r2, r3] = await Promise.all([
        updateGameSetting(gameType, "win_pts", winPts),
        updateGameSetting(gameType, "draw_pts", drawPts),
        updateGameSetting(gameType, "loss_pts", lossPts),
      ]);
      if ("error" in r1) { setError(r1.error); return; }
      if ("error" in r2) { setError(r2.error); return; }
      if ("error" in r3) { setError(r3.error); return; }
      setSettings((prev) =>
        prev.map((s) =>
          s.game_type === gameType
            ? { ...s, win_pts: winPts, draw_pts: drawPts, loss_pts: lossPts }
            : s,
        ),
      );
      setSaved((prev) => ({ ...prev, [gameType]: true }));
      setTimeout(
        () => setSaved((prev) => ({ ...prev, [gameType]: false })),
        2000,
      );
    });
  }

  if (loading)
    return (
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 16,
          color: "rgba(255,255,255,0.3)",
          textAlign: "center",
          padding: "40px 0",
        }}
      >
        Chargement…
      </div>
    );

  if (dbError) {
    return (
      <div>
        <div
          style={{
            background: "rgba(255,30,140,0.12)",
            border: `2px solid ${RR.pink}`,
            borderRadius: 14,
            padding: "20px 24px",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              color: RR.pink,
              marginBottom: 10,
            }}
          >
            ⚠ Tables manquantes
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 700,
              color: "rgba(255,255,255,0.7)",
              lineHeight: 1.7,
            }}
          >
            {dbError}
            <br />
            <br />
            Collez ce SQL dans l&apos;éditeur SQL de Supabase, puis rechargez
            la page :
          </div>
        </div>

        <pre
          style={{
            background: "rgba(0,0,0,0.4)",
            border: `1.5px solid rgba(255,255,255,0.12)`,
            borderRadius: 12,
            padding: "16px 20px",
            fontFamily: "monospace",
            fontSize: 11,
            color: "rgba(255,255,255,0.75)",
            overflowX: "auto",
            lineHeight: 1.7,
            whiteSpace: "pre",
          }}
        >
          {`-- Table de configuration des jeux
CREATE TABLE IF NOT EXISTS public.game_settings (
  game_type  text PRIMARY KEY CHECK (game_type IN (
    'pfc','morpion','puissance4','reflexe','naval','chess',
    'nim','pig','mastermind','plus-ou-moins','duel-des'
  )),
  is_active  bool NOT NULL DEFAULT true,
  win_pts    int  NOT NULL DEFAULT 3,
  draw_pts   int  NOT NULL DEFAULT 1,
  loss_pts   int  NOT NULL DEFAULT 0
);
ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gs read"   ON public.game_settings FOR SELECT USING (true);
CREATE POLICY "gs insert" ON public.game_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "gs update" ON public.game_settings FOR UPDATE USING (true);
CREATE POLICY "gs delete" ON public.game_settings FOR DELETE USING (true);

INSERT INTO public.game_settings (game_type,is_active,win_pts,draw_pts) VALUES
  ('pfc',true,3,1),('morpion',true,3,1),('puissance4',true,3,1),
  ('reflexe',true,3,1),('naval',true,3,1),('chess',true,3,1),
  ('nim',true,3,1),('pig',true,3,1),('mastermind',true,3,1),
  ('plus-ou-moins',true,3,1),('duel-des',true,3,1)
ON CONFLICT (game_type) DO NOTHING;

-- Table de notifications joueurs (avertissements admin)
CREATE TABLE IF NOT EXISTS public.player_notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  type       text NOT NULL DEFAULT 'warning',
  message    text NOT NULL,
  seen       bool NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.player_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pn read"   ON public.player_notifications FOR SELECT USING (true);
CREATE POLICY "pn insert" ON public.player_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "pn update" ON public.player_notifications FOR UPDATE USING (true);
CREATE POLICY "pn delete" ON public.player_notifications FOR DELETE USING (true);`}
        </pre>

        <button
          onClick={load}
          style={{
            marginTop: 16,
            fontFamily: "var(--font-display)",
            fontSize: 14,
            color: RR.violetDeep,
            background: RR.cyan,
            border: `2.5px solid ${RR.ink}`,
            borderRadius: 999,
            padding: "10px 24px",
            cursor: "pointer",
            boxShadow: `3px 3px 0 ${RR.ink}`,
          }}
        >
          ↻ Réessayer
        </button>
      </div>
    );
  }

  const activeCount = settings.filter((s) => s.is_active).length;

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 700,
            color: "rgba(255,255,255,0.45)",
          }}
        >
          {activeCount} jeu{activeCount !== 1 ? "x" : ""} actif
          {activeCount !== 1 ? "s" : ""} sur {settings.length}
        </span>
        <button
          onClick={load}
          disabled={loading}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            fontWeight: 800,
            color: "rgba(255,255,255,0.5)",
            background: "rgba(255,255,255,0.06)",
            border: `1.5px solid rgba(255,255,255,0.12)`,
            borderRadius: 999,
            padding: "5px 12px",
            cursor: "pointer",
          }}
        >
          ↻ Rafraîchir
        </button>
      </div>

      {error && (
        <div
          style={{
            background: "rgba(255,30,140,0.12)",
            border: `2px solid ${RR.pink}`,
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 12,
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 800,
            color: RR.pink,
          }}
        >
          ⚠ {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {settings.map((s) => {
          const meta = GAME_META[s.game_type] ?? {
            name: s.game_type,
            emoji: "🎮",
          };
          const edit = editing[s.game_type] ?? {
            win_pts: String(s.win_pts),
            draw_pts: String(s.draw_pts),
            loss_pts: String(s.loss_pts),
          };
          const changed =
            edit.win_pts !== String(s.win_pts) ||
            edit.draw_pts !== String(s.draw_pts) ||
            edit.loss_pts !== String(s.loss_pts);

          return (
            <div
              key={s.game_type}
              style={{
                background: s.is_active
                  ? RR.violetDeep
                  : "rgba(255,255,255,0.03)",
                border: `2.5px solid ${s.is_active ? RR.ink : "rgba(255,255,255,0.1)"}`,
                borderRadius: 14,
                padding: "12px 16px",
                boxShadow: s.is_active ? `2px 2px 0 ${RR.ink}` : "none",
                opacity: s.is_active ? 1 : 0.55,
                transition: "all .2s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                {/* Toggle switch */}
                <button
                  onClick={() =>
                    handleToggleActive(s.game_type, s.is_active)
                  }
                  disabled={pending}
                  aria-label={s.is_active ? "Désactiver" : "Activer"}
                  style={{
                    width: 46,
                    height: 26,
                    borderRadius: 999,
                    border: `2px solid ${s.is_active ? RR.cyan : "rgba(255,255,255,0.2)"}`,
                    background: s.is_active
                      ? RR.cyan
                      : "rgba(255,255,255,0.1)",
                    cursor: pending ? "wait" : "pointer",
                    flexShrink: 0,
                    position: "relative",
                    transition: "background .2s, border-color .2s",
                    padding: 0,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 3,
                      left: s.is_active ? 23 : 3,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: RR.white,
                      transition: "left .2s",
                      display: "block",
                    }}
                  />
                </button>

                {/* Name */}
                <div style={{ flex: 1, minWidth: 140 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 16,
                      color: RR.white,
                      display: "inline-block",
                      transform: "skewX(-4deg)",
                    }}
                  >
                    {meta.emoji} {meta.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 10,
                      fontWeight: 900,
                      color: s.is_active ? RR.cyan : "rgba(255,255,255,0.3)",
                      marginLeft: 8,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {s.is_active ? "Actif" : "Inactif"}
                  </span>
                </div>

                {/* Points */}
                <div
                  style={{ display: "flex", alignItems: "flex-end", gap: 8 }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <label
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 9,
                        fontWeight: 900,
                        color: "#4ade80",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Victoire
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={edit.win_pts}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [s.game_type]: { ...edit, win_pts: e.target.value },
                        }))
                      }
                      style={{
                        width: 54,
                        fontFamily: "var(--font-display)",
                        fontSize: 20,
                        fontWeight: 700,
                        color: "#4ade80",
                        background: "rgba(74,222,128,0.1)",
                        border: `2px solid ${edit.win_pts !== String(s.win_pts) ? "#4ade80" : "rgba(74,222,128,0.25)"}`,
                        borderRadius: 8,
                        padding: "4px 0",
                        textAlign: "center",
                        outline: "none",
                        transition: "border-color .15s",
                      }}
                    />
                  </div>

                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 10,
                      color: "rgba(255,255,255,0.25)",
                      marginBottom: 6,
                    }}
                  >
                    pts
                  </span>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <label
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 9,
                        fontWeight: 900,
                        color: RR.butter,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Nul
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={edit.draw_pts}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [s.game_type]: { ...edit, draw_pts: e.target.value },
                        }))
                      }
                      style={{
                        width: 54,
                        fontFamily: "var(--font-display)",
                        fontSize: 20,
                        fontWeight: 700,
                        color: RR.butter,
                        background: "rgba(255,233,74,0.1)",
                        border: `2px solid ${edit.draw_pts !== String(s.draw_pts) ? RR.butter : "rgba(255,233,74,0.25)"}`,
                        borderRadius: 8,
                        padding: "4px 0",
                        textAlign: "center",
                        outline: "none",
                        transition: "border-color .15s",
                      }}
                    />
                  </div>

                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 10,
                      color: "rgba(255,255,255,0.25)",
                      marginBottom: 6,
                    }}
                  >
                    pts
                  </span>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <label
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 9,
                        fontWeight: 900,
                        color: RR.pink,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Défaite
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={edit.loss_pts}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [s.game_type]: { ...edit, loss_pts: e.target.value },
                        }))
                      }
                      style={{
                        width: 54,
                        fontFamily: "var(--font-display)",
                        fontSize: 20,
                        fontWeight: 700,
                        color: RR.pink,
                        background: "rgba(255,30,140,0.1)",
                        border: `2px solid ${edit.loss_pts !== String(s.loss_pts) ? RR.pink : "rgba(255,30,140,0.25)"}`,
                        borderRadius: 8,
                        padding: "4px 0",
                        textAlign: "center",
                        outline: "none",
                        transition: "border-color .15s",
                      }}
                    />
                  </div>

                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 10,
                      color: "rgba(255,255,255,0.25)",
                      marginBottom: 6,
                    }}
                  >
                    pts
                  </span>

                  {changed ? (
                    <button
                      onClick={() => handleSavePts(s.game_type)}
                      disabled={pending}
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 12,
                        color: RR.violetDeep,
                        background: RR.cyan,
                        border: `2px solid ${RR.ink}`,
                        borderRadius: 999,
                        padding: "7px 14px",
                        cursor: pending ? "wait" : "pointer",
                        boxShadow: `2px 2px 0 ${RR.ink}`,
                        opacity: pending ? 0.7 : 1,
                        transition: "opacity .15s",
                        marginBottom: 0,
                      }}
                    >
                      Sauver
                    </button>
                  ) : saved[s.game_type] ? (
                    <span
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 12,
                        fontWeight: 800,
                        color: "#4ade80",
                      }}
                    >
                      ✓ Sauvé
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 24,
          padding: "14px 18px",
          background: "rgba(255,255,255,0.03)",
          border: "1.5px dashed rgba(255,255,255,0.1)",
          borderRadius: 12,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 10,
            fontWeight: 900,
            color: "rgba(255,255,255,0.3)",
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 6,
          }}
        >
          Note
        </div>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 600,
            color: "rgba(255,255,255,0.4)",
            lineHeight: 1.7,
          }}
        >
          Désactiver un jeu le masque dans le lobby principal (si intégré).
          <br />
          Les points ne sont pas recalculés rétrospectivement.
          <br />
          Les nuls ne sont pas possibles dans tous les jeux.
        </div>
      </div>
    </div>
  );
}
