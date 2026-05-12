// Expression Arena — Service Worker (Web Push)

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Expression Arena", {
      body: data.body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: data.tag ?? "ea-challenge",
      requireInteraction: true,
      data: { url: data.url ?? "/lobby" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        return clients.openWindow(event.notification.data?.url ?? "/lobby");
      })
  );
});
