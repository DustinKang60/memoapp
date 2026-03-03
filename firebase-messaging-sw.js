// ── Firebase Cloud Messaging Service Worker ──
// 이 파일은 반드시 GitHub 저장소 루트(/)에 위치해야 합니다.
// 경로: dustinkang60.github.io/firebase-messaging-sw.js
// (memoapp 폴더 안이 아니라 최상위!)

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBC5y1B592zfv2ROD7HifmdujH-SUkJSFk",
  authDomain: "baby-diary-9f808.firebaseapp.com",
  projectId: "baby-diary-9f808",
  storageBucket: "baby-diary-9f808.firebasestorage.app",
  messagingSenderId: "1037211823707",
  appId: "1:1037211823707:web:a4e974c58d9df3c92c597e",
});

const messaging = firebase.messaging();

// 앱이 백그라운드/종료 상태일 때 FCM 메시지 수신 → 알림 표시
messaging.onBackgroundMessage(payload => {
  console.log("FCM 백그라운드 메시지 수신:", payload);

  const title = payload.notification?.title || payload.data?.title || "📅 약속 알림";
  const body  = payload.notification?.body  || payload.data?.body  || "";

  self.registration.showNotification(title, {
    body,
    icon: "/memoapp/icons/icon-192x192.png",
    badge: "/memoapp/icons/icon-192x192.png",
    vibrate: [200, 100, 200],
    tag: payload.data?.memoId || "memoapp-notif",
    renotify: true,
    data: { url: "/memoapp/" },
  });
});

// 알림 클릭 시 앱 열기
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = e.notification.data?.url || "/memoapp/";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes("/memoapp") && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
