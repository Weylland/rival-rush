"use client";

import { useCallback, useRef } from "react";

export type SoundType = "move" | "win" | "lose" | "notify" | "tick" | "reveal";

function tone(ctx: AudioContext, freq: number, dur: number, vol = 0.25, type: OscillatorType = "sine") {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  } catch {
    // ignore
  }
}

export function useGameSounds() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    try {
      if (!ctxRef.current) ctxRef.current = new AudioContext();
      if (ctxRef.current.state === "suspended") ctxRef.current.resume();
      return ctxRef.current;
    } catch {
      return null;
    }
  }, []);

  const play = useCallback((sound: SoundType) => {
    if (typeof window !== "undefined" && localStorage.getItem("ea_sounds_enabled") === "false") return;
    const ctx = getCtx();
    if (!ctx) return;

    switch (sound) {
      case "move":
        tone(ctx, 440, 0.08, 0.2, "square");
        break;

      case "reveal":
        tone(ctx, 520, 0.12, 0.22);
        setTimeout(() => tone(ctx, 620, 0.12, 0.22), 100);
        break;

      case "win":
        tone(ctx, 523, 0.12, 0.3);
        setTimeout(() => tone(ctx, 659, 0.12, 0.3), 120);
        setTimeout(() => tone(ctx, 784, 0.12, 0.35), 240);
        setTimeout(() => tone(ctx, 1047, 0.25, 0.45), 360);
        break;

      case "lose":
        tone(ctx, 440, 0.15, 0.28);
        setTimeout(() => tone(ctx, 370, 0.15, 0.28), 160);
        setTimeout(() => tone(ctx, 311, 0.3, 0.32), 340);
        break;

      case "notify":
        tone(ctx, 880, 0.07, 0.28, "sine");
        setTimeout(() => tone(ctx, 1108, 0.12, 0.32, "sine"), 90);
        break;

      case "tick":
        tone(ctx, 880, 0.04, 0.12, "square");
        break;
    }
  }, [getCtx]);

  return { play };
}
