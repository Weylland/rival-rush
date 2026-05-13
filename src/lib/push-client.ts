export const NOTIF_KEY = "ea_notif_enabled";

export function isPushEnabled(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(NOTIF_KEY) !== "false";
}

export async function subscribePush(): Promise<{ ok: boolean; error?: string }> {
  if (typeof navigator === "undefined") return { ok: false, error: "ssr" };
  if (!("serviceWorker" in navigator)) return { ok: false, error: "unsupported" };
  if (!("PushManager" in window)) return { ok: false, error: "unsupported" };

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return { ok: false, error: "no-vapid" };

  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return { ok: false, error: "no-permission" };
  }

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const key = sub.getKey("p256dh");
    const auth = sub.getKey("auth");
    if (!key || !auth) return { ok: false, error: "missing-keys" };

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

    return { ok: res.ok, error: res.ok ? undefined : await res.text() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function unsubscribePush(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) return;

  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe();

  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ endpoint }),
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0))).buffer as ArrayBuffer;
}
