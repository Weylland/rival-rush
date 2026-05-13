"use client";

import { useEffect, useState } from "react";

interface Props {
  playerId: string;
}

type Status =
  | { kind: "idle" }
  | { kind: "unsupported"; reason: string }
  | { kind: "no-vapid" }
  | { kind: "no-permission" }
  | { kind: "registering" }
  | { kind: "subscribing" }
  | { kind: "syncing" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

export function PushProvider({ playerId }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    const setIfActive = (s: Status) => { if (!cancelled) setStatus(s); };

    async function attempt() {
      if (typeof navigator === "undefined") return;
      if (!("serviceWorker" in navigator)) {
        setIfActive({ kind: "unsupported", reason: "serviceWorker absent" });
        return;
      }
      if (!("PushManager" in window)) {
        setIfActive({ kind: "unsupported", reason: "PushManager absent (iOS sans PWA ?)" });
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setIfActive({ kind: "no-vapid" });
        return;
      }

      const permission = typeof Notification !== "undefined" ? Notification.permission : "default";
      if (permission !== "granted") {
        setIfActive({ kind: "no-permission" });
        return;
      }

      try {
        setIfActive({ kind: "registering" });
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          setIfActive({ kind: "subscribing" });
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
        }

        setIfActive({ kind: "syncing" });
        const res = await syncSubscription(sub);
        if (!res.ok) {
          setIfActive({ kind: "error", message: `API ${res.status}: ${res.text}` });
          return;
        }

        setIfActive({ kind: "ready" });
      } catch (e) {
        setIfActive({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      }
    }

    attempt();

    // Re-run every 5s while not ready (catches permission grants from the lobby button)
    const interval = setInterval(() => {
      setStatus((s) => {
        if (s.kind === "ready") {
          clearInterval(interval);
          return s;
        }
        attempt();
        return s;
      });
    }, 5000);

    return () => { cancelled = true; clearInterval(interval); };
  }, [playerId]);

  // Show a debug badge unless ready or no permission yet (which is normal)
  if (status.kind === "ready" || status.kind === "no-permission" || status.kind === "idle") return null;

  const isError = status.kind === "error" || status.kind === "unsupported" || status.kind === "no-vapid";
  return (
    <div style={{
      position: "fixed", bottom: 60, right: 16, zIndex: 199,
      maxWidth: 280,
      background: isError ? "rgba(255,30,140,0.95)" : "rgba(0,212,232,0.95)",
      border: "2.5px solid #1a0f5e",
      borderRadius: 12, padding: "8px 12px",
      fontFamily: "system-ui, sans-serif", fontSize: 11, fontWeight: 700,
      color: "#1a0f5e",
      boxShadow: "3px 3px 0 #1a0f5e",
    }}>
      <div style={{ fontWeight: 900, marginBottom: 2 }}>Push: {status.kind}</div>
      {status.kind === "error" && <div style={{ wordBreak: "break-word" }}>{status.message}</div>}
      {status.kind === "unsupported" && <div>{status.reason}</div>}
      {status.kind === "no-vapid" && <div>NEXT_PUBLIC_VAPID_PUBLIC_KEY absent du bundle</div>}
    </div>
  );
}

async function syncSubscription(sub: globalThis.PushSubscription): Promise<{ ok: boolean; status: number; text: string }> {
  const key = sub.getKey("p256dh");
  const auth = sub.getKey("auth");
  if (!key || !auth) return { ok: false, status: 0, text: "missing keys" };

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh: arrayBufferToBase64(key),
      auth: arrayBufferToBase64(auth),
    }),
  });

  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0))).buffer as ArrayBuffer;
}
