"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RR } from "@/lib/design";

interface Props {
  playerId: string;
}

interface Warning {
  id: string;
  message: string;
}

export function WarningNotifier({ playerId }: Props) {
  const [queue, setQueue] = useState<Warning[]>([]);

  useEffect(() => {
    const supabase = createClient();

    // Load any unseen warnings already in DB (e.g. sent while player was offline)
    supabase
      .from("player_notifications")
      .select("id, message")
      .eq("player_id", playerId)
      .eq("seen", false)
      .eq("type", "warning")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setQueue(data.map((r) => ({ id: r.id as string, message: r.message as string })));
        }
      });

    // Realtime: new warnings arriving while player is online
    const ch = supabase
      .channel(`warnings-${playerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "player_notifications",
          filter: `player_id=eq.${playerId}`,
        },
        (payload) => {
          const row = payload.new as { id: string; type: string; message: string; seen: boolean };
          if (row.type === "warning" && !row.seen) {
            setQueue((prev) => [...prev, { id: row.id, message: row.message }]);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [playerId]);

  function dismiss() {
    const current = queue[0];
    if (!current) return;

    // Mark seen in DB (fire-and-forget)
    const supabase = createClient();
    supabase
      .from("player_notifications")
      .update({ seen: true })
      .eq("id", current.id)
      .then(() => {});

    setQueue((prev) => prev.slice(1));
  }

  if (queue.length === 0) return null;

  const warning = queue[0];

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Avertissement administrateur"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(26,15,94,0.75)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        padding: "16px",
      }}
    >
      {/* Label */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 28,
          left: "50%",
          transform: "translateX(-50%) rotate(-1.5deg)",
          background: RR.pink,
          border: `2.5px solid ${RR.ink}`,
          borderRadius: 16,
          padding: "7px 18px",
          fontFamily: "var(--font-display)",
          fontSize: 12,
          color: RR.white,
          letterSpacing: 1.4,
          boxShadow: `4px 4px 0 ${RR.ink}`,
          whiteSpace: "nowrap",
          textTransform: "uppercase",
        }}
      >
        ⚠️ Avertissement admin
      </div>

      {/* Card */}
      <div
        style={{
          width: "min(460px, calc(100% - 32px))",
          background: RR.violetDeep,
          border: `3px solid ${RR.ink}`,
          borderRadius: 28,
          padding: "28px 24px 22px",
          boxShadow: `6px 6px 0 ${RR.pink}, 6px 6px 0 1px ${RR.ink}`,
          position: "relative",
        }}
      >
        {/* Dot pattern */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 4,
            borderRadius: 24,
            backgroundImage:
              "radial-gradient(circle, rgba(255,30,140,0.15) 1px, transparent 1.4px)",
            backgroundSize: "12px 12px",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "rgba(255,30,140,0.15)",
              border: `3px solid ${RR.pink}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              boxShadow: `0 0 24px rgba(255,30,140,0.3), 4px 4px 0 ${RR.ink}`,
            }}
          >
            🚨
          </div>

          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              color: RR.white,
              transform: "skewX(-6deg)",
              textShadow: `2px 2px 0 ${RR.pink}`,
              textAlign: "center",
            }}
          >
            MESSAGE DE L'ADMIN
          </div>

          {/* Message box */}
          <div
            style={{
              width: "100%",
              background: "rgba(255,30,140,0.1)",
              border: `2px solid ${RR.pink}40`,
              borderRadius: 16,
              padding: "16px 18px",
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              fontWeight: 700,
              color: "rgba(255,255,255,0.9)",
              lineHeight: 1.6,
              wordBreak: "break-word",
              textAlign: "center",
            }}
          >
            {warning.message}
          </div>

          {queue.length > 1 && (
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 11,
                fontWeight: 800,
                color: "rgba(255,255,255,0.4)",
              }}
            >
              +{queue.length - 1} autre{queue.length - 1 > 1 ? "s" : ""} avertissement
              {queue.length - 1 > 1 ? "s" : ""}
            </div>
          )}

          {/* CTA */}
          <button
            onClick={dismiss}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 16,
              color: RR.ink,
              background: RR.butter,
              border: `2.5px solid ${RR.ink}`,
              borderRadius: 999,
              padding: "12px 32px",
              textTransform: "uppercase",
              letterSpacing: 0.8,
              cursor: "pointer",
              boxShadow: `4px 4px 0 ${RR.pink}, 4px 4px 0 1px ${RR.ink}`,
              transform: "skewX(-4deg)",
            }}
          >
            <span style={{ display: "inline-block", transform: "skewX(4deg)" }}>
              ✓ J&apos;ai compris
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
