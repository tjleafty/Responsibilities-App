/* Push reminders, loaded into the app's service worker (workbox importScripts in vite.config.ts). */
self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: "Responsibilities App", body: event.data ? event.data.text() : "" }
  }
  event.waitUntil(self.registration.showNotification(data.title || "Responsibilities App", {
    body: data.body || "",
    tag: data.tag || "reminder",
    renotify: true,
    icon: "/icon.svg",
    badge: "/icon.svg",
    data: { url: data.url || "/dashboard" },
  }))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || "/dashboard"
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const open = windows.find((client) => client.url.includes(self.location.origin))
    if (open) return open.focus().then((client) => client.navigate ? client.navigate(url) : client)
    return self.clients.openWindow(url)
  }))
})
