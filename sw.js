// ─── Service Worker - 메모앱 ───────────────────────────────────
const CACHE_NAME = "memoapp-v3";
const ASSETS = [
  "/memoapp/",
  "/memoapp/index.html",
  "/memoapp/manifest.json",
  "/memoapp/icons/icon-192x192.png",
  "/memoapp/icons/icon-512x512.png",
];

// ── 설치 ──
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ── 활성화 ──
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── 네트워크 요청 캐시 ──
self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// ── 알림 스케줄 저장소 ──
const scheduledNotifs = new Map(); // id → timeoutId

// ── 앱에서 postMessage 수신 ──
self.addEventListener("message", e => {
  const data = e.data;
  if (!data || !data.type) return;

  if (data.type === "SCHEDULE_NOTIFICATION") {
    const delay = data.notifTime - Date.now();
    if (delay <= 0) return;

    // 기존 같은 id 있으면 취소
    if (scheduledNotifs.has(data.id)) {
      clearTimeout(scheduledNotifs.get(data.id));
    }

    const tid = setTimeout(() => {
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/memoapp/icons/icon-192x192.png",
        badge: "/memoapp/icons/icon-192x192.png",
        vibrate: [200, 100, 200],
        tag: `appt-${data.id}`,
        renotify: true,
      });
      scheduledNotifs.delete(data.id);
    }, delay);

    scheduledNotifs.set(data.id, tid);
  }

  if (data.type === "SHOW_NOW") {
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/memoapp/icons/icon-192x192.png",
      vibrate: [200, 100, 200],
    });
  }

  // 알림 취소 (메모 삭제 시)
  if (data.type === "CANCEL_NOTIFICATION") {
    if (scheduledNotifs.has(data.id)) {
      clearTimeout(scheduledNotifs.get(data.id));
      scheduledNotifs.delete(data.id);
    }
  }
});

// ── 알림 클릭 시 앱 열기 ──
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes("/memoapp") && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow("/memoapp/");
    })
  );
});
