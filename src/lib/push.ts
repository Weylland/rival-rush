import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

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
  await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      )
    )
  );
}
