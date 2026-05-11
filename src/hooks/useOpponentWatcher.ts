import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface Options {
  gameId: string;
  opponentId: string;
  isFinishedRef: React.MutableRefObject<boolean>;
}

const OPPONENT_GONE_GRACE_MS = 8_000;
const STALE_CHECK_INTERVAL_MS = 20_000;
const STALE_THRESHOLD_MS = 60_000;
// Don't start watching until both players have had time to land on the game page
const STARTUP_DELAY_MS = 15_000;

/**
 * Watches the opponent's presence row during a game.
 * If the opponent disappears or stops heartbeating, asks the server to forfeit
 * the game in our favour after a grace period.
 */
export function useOpponentWatcher({ gameId, opponentId, isFinishedRef }: Options) {
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const requestForfeit = () => {
      if (isFinishedRef.current) return;
      fetch("/api/forfeit", {
        method: "POST",
        body: JSON.stringify({ gameId, mode: "check-opponent" }),
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => {});
    };

    const armGraceTimer = () => {
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
      graceTimerRef.current = setTimeout(requestForfeit, OPPONENT_GONE_GRACE_MS);
    };

    const cancelGraceTimer = () => {
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
      }
    };

    let watcherActive = false;

    const sub = supabase
      .channel(`opponent-${opponentId}-${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "presence", filter: `player_id=eq.${opponentId}` },
        (payload) => {
          if (!watcherActive) return;
          if (payload.eventType === "DELETE") {
            armGraceTimer();
          } else if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            cancelGraceTimer();
          }
        },
      )
      .subscribe();

    // Periodic stale check — catches the case where the row is still there
    // but hasn't been heartbeated (browser crash, network drop)
    const stalePoll = setInterval(async () => {
      if (!watcherActive || isFinishedRef.current) return;
      const { data } = await supabase
        .from("presence")
        .select("updated_at")
        .eq("player_id", opponentId)
        .maybeSingle();

      const isStale = !data || (Date.now() - new Date(data.updated_at).getTime() > STALE_THRESHOLD_MS);
      if (isStale) requestForfeit();
    }, STALE_CHECK_INTERVAL_MS);

    // Give both players time to land on the game page before activating
    startupTimerRef.current = setTimeout(() => {
      watcherActive = true;
      startupTimerRef.current = null;
    }, STARTUP_DELAY_MS);

    return () => {
      supabase.removeChannel(sub);
      clearInterval(stalePoll);
      cancelGraceTimer();
      if (startupTimerRef.current) {
        clearTimeout(startupTimerRef.current);
        startupTimerRef.current = null;
      }
    };
  }, [gameId, opponentId, isFinishedRef]);
}
