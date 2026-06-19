import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { GameType } from "@/types/database";

interface Options {
  gameId: string;
  myId: string;
  myPseudo: string;
  gameType: GameType;
  /** True when the page mounts on an already-finished game (immediate redirect). */
  initialFinished: boolean;
  isFinishedRef: React.MutableRefObject<boolean>;
}

const HEARTBEAT_MS = 15_000;
// Delay the self-forfeit so React Strict Mode's fake unmount (which re-mounts
// immediately and clears the timer) doesn't trigger it; real navigation does.
const FORFEIT_DELAY_MS = 5_000;

/**
 * Shared game-page lifecycle, identical across every game:
 * - presence heartbeat (status "in-game") while mounted
 * - self-forfeit on real navigation away
 * - immediate redirect to /result when landing on a finished game
 *
 * Game-specific realtime subscriptions stay in each client.
 */
export function useGamePresence({ gameId, myId, myPseudo, gameType, initialFinished, isFinishedRef }: Options) {
  const router = useRouter();
  const forfeitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (forfeitTimerRef.current) {
      clearTimeout(forfeitTimerRef.current);
      forfeitTimerRef.current = null;
    }

    const supabase = createClient();
    const updatePresence = () =>
      supabase
        .from("presence")
        .upsert({ player_id: myId, pseudo: myPseudo, status: "in-game", game_type: gameType, updated_at: new Date().toISOString() })
        .then(() => {});
    updatePresence();
    const heartbeat = setInterval(updatePresence, HEARTBEAT_MS);

    return () => {
      clearInterval(heartbeat);
      supabase.from("presence").update({ status: "online", updated_at: new Date().toISOString() }).eq("player_id", myId).then(() => {});
      if (!isFinishedRef.current) {
        forfeitTimerRef.current = setTimeout(() => {
          forfeitTimerRef.current = null;
          fetch("/api/forfeit", {
            method: "POST",
            body: JSON.stringify({ gameId }),
            headers: { "Content-Type": "application/json" },
            keepalive: true,
          });
        }, FORFEIT_DELAY_MS);
      }
    };
  }, [myId, gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialFinished) {
      isFinishedRef.current = true;
      router.replace(`/result?game_id=${gameId}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
