"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  playerId: string;
  pseudo: string;
}

const HEARTBEAT_MS = 25_000;

export function PresenceProvider({ playerId, pseudo }: Props) {
  useEffect(() => {
    const supabase = createClient();

    supabase.from("presence").upsert({
      player_id: playerId,
      pseudo,
      status: "online",
      updated_at: new Date().toISOString(),
    }).then(() => {});

    const timer = setInterval(() => {
      supabase.from("presence")
        .update({ updated_at: new Date().toISOString() })
        .eq("player_id", playerId)
        .then(() => {});
    }, HEARTBEAT_MS);

    const leave = () => {
      // sendBeacon is reliable during page unload; fetch with keepalive as fallback
      const payload = JSON.stringify({ playerId });
      const blob = new Blob([payload], { type: "application/json" });
      const sent = navigator.sendBeacon("/api/presence/leave", blob);
      if (!sent) {
        fetch("/api/presence/leave", {
          method: "POST",
          body: payload,
          headers: { "Content-Type": "application/json" },
          keepalive: true,
        }).catch(() => {});
      }
    };

    // pagehide fires more reliably than beforeunload on mobile / iOS Safari
    window.addEventListener("pagehide", leave);
    window.addEventListener("beforeunload", leave);

    // When the tab becomes visible again, touch updated_at. If the row was
    // deleted during a prior hide, recreate it.
    const handleVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      const { data: existing } = await supabase
        .from("presence")
        .select("player_id, status")
        .eq("player_id", playerId)
        .maybeSingle();

      if (existing) {
        await supabase.from("presence")
          .update({ updated_at: new Date().toISOString() })
          .eq("player_id", playerId);
      } else {
        await supabase.from("presence").upsert({
          player_id: playerId,
          pseudo,
          status: "online",
          updated_at: new Date().toISOString(),
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [playerId, pseudo]);

  return null;
}
