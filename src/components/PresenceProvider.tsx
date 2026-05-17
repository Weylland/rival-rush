"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  playerId: string;
  pseudo: string;
  isInvisible?: boolean;
}

// Heartbeat every 25s — browsers throttle background tabs but don't stop them
// entirely on desktop. On mobile the JS can be fully suspended; that's why the
// lobby uses a 3-minute cutoff (STALE_MS) instead of 90 s.
const HEARTBEAT_MS = 25_000;

export function PresenceProvider({ playerId, pseudo, isInvisible = false }: Props) {
  useEffect(() => {
    // Invisible mode: don't publish presence at all
    if (isInvisible) return;

    const supabase = createClient();

    // Always upsert so the row is (re)created if it was deleted
    const beat = () =>
      supabase.from("presence").upsert({
        player_id: playerId,
        pseudo,
        status: "online",
        updated_at: new Date().toISOString(),
      }).then(() => {});

    // Initial beat
    beat();

    // Periodic beat — keeps running even when tab is hidden so the row stays
    // fresh. Mobile browsers may suspend it; the wide lobby cutoff compensates.
    const timer = setInterval(beat, HEARTBEAT_MS);

    // Immediate beat when the user comes back to the tab (screen on, tab focus)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Mark offline on actual page unload (tab close, browser close, hard nav away)
    const leave = () => {
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

    // pagehide is more reliable than beforeunload on mobile / iOS Safari
    window.addEventListener("pagehide", leave);
    window.addEventListener("beforeunload", leave);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("beforeunload", leave);
    };
  }, [playerId, pseudo, isInvisible]);

  return null;
}
