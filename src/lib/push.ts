export interface PushPayload {
  title: string;
  body: string;
  tag: string;
  url?: string;
}

export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendPushToSubscriptions(
  subscriptions: PushSubscription[],
  payload: PushPayload,
): Promise<void> {
  if (subscriptions.length === 0) return;

  // Dynamic import: web-push is a Node.js-only module, Turbopack cannot bundle it.
  // Loading it at runtime avoids build-time resolution.
  const webpush = (await import("web-push")).default;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:samiernicolas62@gmail.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      )
    )
  );
}
