"use client";

import { useEffect } from "react";

interface Props {
  playerId: string;
}

export function PushProvider({ playerId }: Props) {
  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) return;

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    async function register() {
      const permission = typeof Notification !== "undefined" ? Notification.permission : "default";
      if (permission !== "granted") return;

      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;

        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          // Re-sync with server in case it was lost
          await syncSubscription(existing);
          return;
        }

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey!),
        });
        await syncSubscription(sub);
      } catch {
        // Push not supported or user denied
      }
    }

    register();
  }, [playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-run when permission changes (user grants from lobby or settings)
  useEffect(() => {
    if (typeof Notification === "undefined") return;

    const check = async () => {
      if (Notification.permission !== "granted") return;
      if (!("serviceWorker" in navigator)) return;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;

      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) { await syncSubscription(existing); return; }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
        await syncSubscription(sub);
      } catch { /* ignore */ }
    };

    // Poll permission state (no event API for permission changes)
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

async function syncSubscription(sub: globalThis.PushSubscription) {
  const key = sub.getKey("p256dh");
  const auth = sub.getKey("auth");
  if (!key || !auth) return;

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh: btoa(String.fromCharCode(...new Uint8Array(key))),
      auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
    }),
  });
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0))).buffer as ArrayBuffer;
}
