"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { acceptChallenge, declineChallenge } from "@/app/(game)/lobby/actions";
import { useGameSounds } from "@/hooks/useGameSounds";
import { EA } from "@/lib/design";
import { Avatar } from "@/components/ui/avatar";
import type { GameType } from "@/types/database";

interface Props {
  playerId: string;
}

interface IncomingChallenge {
  id: string;
  challenger_id: string;
  challenger_pseudo: string;
  challenger_avatar_url: string | null;
  game_type: GameType;
  expires_at: string;
}

// Draws a favicon matching the EA logo, with an optional pink badge
function setFaviconBadge(active: boolean) {
  const S = 64;
  const canvas = document.createElement("canvas");
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const r = 14; // corner radius

  // Background: violet deep
  ctx.fillStyle = "#1a0f5e";
  ctx.beginPath();
  ctx.roundRect(0, 0, S, S, r);
  ctx.fill();

  // Cyan border
  ctx.strokeStyle = "#00d4e8";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(2, 2, S - 4, S - 4, r - 2);
  ctx.stroke();

  // Pink diagonal slash
  ctx.strokeStyle = "#ff1e8c";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(35, 10); ctx.lineTo(29, 54);
  ctx.stroke();

  // "E" in white
  ctx.save();
  ctx.translate(32, 42);
  ctx.transform(1, 0, -0.14, 1, 0, 0); // skewX(-8deg)
  ctx.font = "900 36px 'Arial Black', Impact, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("E", -10, 0);
  // "A" in cyan
  ctx.fillStyle = "#00d4e8";
  ctx.fillText("A", 11, 0);
  ctx.restore();

  // Pink badge dot (top-right) when active
  if (active) {
    ctx.fillStyle = "#ff1e8c";
    ctx.beginPath();
    ctx.arc(S - 10, 10, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", S - 10, 10);
  }

  const link: HTMLLinkElement = document.querySelector("link[rel~='icon']") ?? document.createElement("link");
  link.type = "image/png";
  link.rel = "icon";
  link.href = canvas.toDataURL();
  if (!link.parentNode) document.head.appendChild(link);
}

export function ChallengeNotifier({ playerId }: Props) {
  const pathname = usePathname();
  const [incoming, setIncoming] = useState<IncomingChallenge | null>(null);
  const [isPending, startTransition] = useTransition();
  const [countdown, setCountdown] = useState(20);
  const { play } = useGameSounds();

  // Don't pop the modal while in a game / on the result page
  const suppress = pathname?.startsWith("/play/");

  // On mount: fetch any already-pending challenge (e.g. opened via push notification)
  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("challenges")
      .select("id, challenger_id, game_type, expires_at")
      .eq("challenged_id", playerId)
      .eq("status", "pending")
      .maybeSingle()
      .then(async ({ data: c }) => {
        if (!c || !c.expires_at) return;
        const remaining = Math.round((new Date(c.expires_at).getTime() - Date.now()) / 1000);
        if (remaining <= 0) return;
        const { data: challenger } = await supabase.from("players").select("pseudo, avatar_url").eq("id", c.challenger_id).single();
        if (!challenger) return;
        setIncoming({ id: c.id, challenger_id: c.challenger_id, challenger_pseudo: challenger.pseudo, challenger_avatar_url: challenger.avatar_url as string | null, game_type: c.game_type as GameType, expires_at: c.expires_at });
        setCountdown(remaining);
        play("notify");
      });
  }, [playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const supabase = createClient();

    const sub = supabase
      .channel(`global-challenges-${playerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "challenges",
          filter: `challenged_id=eq.${playerId}`,
        },
        async (payload) => {
          const c = payload.new as { id: string; challenger_id: string; game_type: GameType; status: string; expires_at: string };
          if (c.status !== "pending") return;
          const { data: challenger } = await supabase
            .from("players")
            .select("pseudo, avatar_url")
            .eq("id", c.challenger_id)
            .single();
          if (!challenger) return;
          const remaining = c.expires_at
            ? Math.max(10, Math.round((new Date(c.expires_at).getTime() - Date.now()) / 1000))
            : 60;
          const challenge: IncomingChallenge = {
            id: c.id,
            challenger_id: c.challenger_id,
            challenger_pseudo: challenger.pseudo,
            challenger_avatar_url: challenger.avatar_url as string | null,
            game_type: c.game_type,
            expires_at: c.expires_at,
          };
          setIncoming(challenge);
          setCountdown(remaining);
          play("notify");

          // System notification when page is hidden (screen off / other app)
          const notifEnabled = localStorage.getItem("ea_notif_enabled") !== "false";
          if (
            notifEnabled &&
            typeof Notification !== "undefined" &&
            Notification.permission === "granted" &&
            document.visibilityState === "hidden"
          ) {
            const gameLabel =
              c.game_type === "pfc" ? "Pierre Feuille Ciseaux" :
              c.game_type === "puissance4" ? "Puissance 4" :
              c.game_type === "reflexe" ? "Réflexe ⚡" :
              c.game_type === "naval" ? "Bataille Navale" :
              c.game_type === "chess" ? "Échecs" :
              c.game_type === "nim" ? "Nim 🔥" :
              c.game_type === "pig" ? "Jeu du Cochon 🐷" :
              c.game_type === "mastermind" ? "Mastermind 🎨" : "Morpion";
            const notif = new Notification(`⚔ Défi de ${challenger.pseudo} !`, {
              body: `${challenger.pseudo} te défie sur ${gameLabel}. Tu as 2 minutes pour accepter !`,
              tag: `challenge-${c.id}`,
              requireInteraction: true,
            });
            notif.onclick = () => { window.focus(); notif.close(); };
            // Vibrate via JS API (works if page comes to foreground)
            if ("vibrate" in navigator) navigator.vibrate([300, 100, 300, 100, 300]);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "challenges",
          filter: `challenged_id=eq.${playerId}`,
        },
        (payload) => {
          // If the challenger cancels or the challenge expires, dismiss the modal
          const c = payload.new as { id: string; status: string };
          setIncoming((current) => (current && current.id === c.id && c.status !== "pending" ? null : current));
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [playerId]);

  const handleDecline = useCallback(() => {
    if (!incoming) return;
    declineChallenge(incoming.id);
    setIncoming(null);
  }, [incoming]);

  const handleAccept = useCallback(() => {
    if (!incoming) return;
    startTransition(async () => {
      const result = await acceptChallenge(incoming.id);
      if (result?.error) {
        alert(`⚠ ${result.error}`);
        setIncoming(null);
      }
    });
  }, [incoming]);

  useEffect(() => {
    if (!incoming) return;
    if (countdown <= 0) { handleDecline(); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, incoming, handleDecline]);

  // Blinking tab title + favicon badge while a challenge is pending
  useEffect(() => {
    if (!incoming) {
      document.title = "Expression Arena";
      setFaviconBadge(false);
      return;
    }
    setFaviconBadge(true);
    const alert = `⚔ Défi de ${incoming.challenger_pseudo} !`;
    const original = "Expression Arena";
    let show = true;
    const interval = setInterval(() => {
      document.title = show ? alert : original;
      show = !show;
    }, 900);
    document.title = alert;
    return () => {
      clearInterval(interval);
      document.title = original;
      setFaviconBadge(false);
    };
  }, [incoming]);

  if (!incoming || suppress) return null;

  const gameLabel = incoming.game_type === "pfc" ? "PIERRE FEUILLE CISEAUX" : incoming.game_type === "puissance4" ? "PUISSANCE 4" : incoming.game_type === "reflexe" ? "RÉFLEXE" : incoming.game_type === "naval" ? "BATAILLE NAVALE" : incoming.game_type === "chess" ? "ÉCHECS" : incoming.game_type === "nim" ? "NIM 🔥" : incoming.game_type === "pig" ? "COCHON 🐷" : incoming.game_type === "mastermind" ? "MASTERMIND 🎨" : "MORPION";
  const gameIcon = incoming.game_type === "pfc" ? "✊✋✌" : incoming.game_type === "puissance4" ? "🔴🟡🔴" : incoming.game_type === "reflexe" ? "⚡⚡⚡" : incoming.game_type === "naval" ? "🚢⚓🎯" : incoming.game_type === "chess" ? "♟♔♛" : incoming.game_type === "nim" ? "🔥🔥🔥" : incoming.game_type === "pig" ? "🎲🐷🎲" : incoming.game_type === "mastermind" ? "🎨🔴🟡" : "⨯⭕⨯";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,15,94,0.7)", zIndex: 100 }}>
      <div style={{
        position: "absolute", top: 30, left: "50%", transform: "translateX(-50%) rotate(-1.5deg)",
        background: EA.butter, border: `2.5px solid ${EA.ink}`,
        borderRadius: 16, padding: "8px 18px",
        fontFamily: "var(--font-display)", fontSize: 12, color: EA.ink, letterSpacing: 1.4,
        boxShadow: `4px 4px 0 ${EA.pink}`,
      }}>
        ⚡ DÉFI ENTRANT ⚡
      </div>

      <div style={{
        position: "absolute", left: "50%", top: 100, transform: "translateX(-50%)",
        width: "min(420px, calc(100% - 32px))",
        background: EA.pink, border: `3px solid ${EA.ink}`,
        borderRadius: 28, padding: "24px 18px 20px",
        boxShadow: `6px 6px 0 ${EA.cyan}, 6px 6px 0 1px ${EA.ink}`,
      }}>
        <div aria-hidden style={{
          position: "absolute", inset: 4, borderRadius: 24,
          backgroundImage: "radial-gradient(circle, rgba(255,233,74,0.35) 1px, transparent 1.4px)",
          backgroundSize: "12px 12px", pointerEvents: "none",
        }} />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative", zIndex: 2 }}>
          <div style={{ position: "relative", marginBottom: 4 }}>
            <div style={{
              position: "absolute", inset: -8, borderRadius: "50%",
              border: `3px dashed ${EA.butter}`,
              animation: "ea-spin 6s linear infinite",
            }} />
            <Avatar name={incoming.challenger_pseudo} src={incoming.challenger_avatar_url} color={EA.cyan} ring={EA.butter} size={84} />
          </div>

          <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: EA.white, transform: "skewX(-8deg)", textShadow: `3px 3px 0 ${EA.violetDeep}` }}>
            {incoming.challenger_pseudo.toUpperCase()}
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontStyle: "italic", fontSize: 14, fontWeight: 800, color: EA.white }}>
            te défie sur
          </div>

          <div style={{
            background: EA.violetDeep, border: `2.5px solid ${EA.ink}`,
            borderRadius: 16, padding: "8px 16px", marginTop: 4,
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: `3px 3px 0 ${EA.butter}`, transform: "rotate(-1deg)",
          }}>
            <div style={{ fontSize: 22 }}>{gameIcon}</div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: EA.white, transform: "skewX(-4deg)" }}>{gameLabel}</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 800, color: EA.cyan, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>
                Duel en temps réel
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: 1 }}>
              auto-refus dans
            </div>
            <div style={{
              background: EA.white, border: `2px solid ${EA.ink}`,
              borderRadius: 10, padding: "2px 8px",
              fontFamily: "var(--font-display)", fontSize: 16, color: countdown <= 5 ? EA.pink : EA.ink,
              transform: "skewX(-8deg)", boxShadow: `2px 2px 0 ${EA.cyan}`,
            }}>{String(Math.floor(countdown / 60)).padStart(1, "0")}:{String(countdown % 60).padStart(2, "0")}</div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18, width: "100%" }}>
            <button
              onClick={handleDecline}
              disabled={isPending}
              style={{
                flex: 1, fontFamily: "var(--font-display)", fontSize: 14,
                color: EA.white, background: EA.violetDeep,
                border: `2.5px solid ${EA.ink}`, borderRadius: 999,
                padding: "12px 0", textTransform: "uppercase", letterSpacing: 0.8,
                cursor: "pointer", boxShadow: `3px 3px 0 ${EA.ink}`,
              }}>Refuser</button>
            <button
              onClick={handleAccept}
              disabled={isPending}
              style={{
                flex: 1.4, fontFamily: "var(--font-display)", fontSize: 16,
                color: EA.ink, background: EA.butter,
                border: `2.5px solid ${EA.ink}`, borderRadius: 999,
                padding: "12px 0", textTransform: "uppercase", letterSpacing: 0.8,
                cursor: isPending ? "wait" : "pointer",
                boxShadow: `4px 4px 0 ${EA.cyan}, 4px 4px 0 1px ${EA.ink}`,
                transform: "skewX(-4deg)",
                opacity: isPending ? 0.7 : 1,
              }}>
              <span style={{ display: "inline-block", transform: "skewX(4deg)" }}>⚔ J&apos;accepte !</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
