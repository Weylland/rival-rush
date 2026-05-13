"use client";

import { useEffect } from "react";
import { subscribePush, isPushEnabled, NOTIF_KEY } from "@/lib/push-client";

interface Props {
  playerId: string;
}

export function PushProvider({ playerId }: Props) {
  useEffect(() => {
    let cancelled = false;

    async function attempt() {
      if (!isPushEnabled()) return;
      if (!cancelled) await subscribePush();
    }

    attempt();

    // Re-run every 5s while not subscribed (catches permission grants)
    const interval = setInterval(attempt, 5000);

    // Also react to storage changes (settings page toggles the key)
    function onStorage(e: StorageEvent) {
      if (e.key !== NOTIF_KEY) return;
      if (e.newValue !== "false") attempt();
    }
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("storage", onStorage);
    };
  }, [playerId]);

  return null;
}
