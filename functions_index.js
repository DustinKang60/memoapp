// ── Firebase Cloud Functions ──
// 위치: functions/index.js
// 배포: firebase deploy --only functions

const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// ── CORS 허용 헤더 ──
function setCORS(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

// ────────────────────────────────────────────────
// 1. 알림 예약 API
//    앱에서 약속 저장 시 호출 → Firestore에 저장
//    POST /scheduleNotification
//    body: { token, title, body, sendAt(ms), memoId }
// ────────────────────────────────────────────────
exports.scheduleNotification = onRequest(
  { region: "us-central1", cors: true },
  async (req, res) => {
    setCORS(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST")    { res.status(405).send("Method Not Allowed"); return; }

    try {
      const { token, title, body, sendAt, memoId } = req.body;

      if (!token || !title || !sendAt || !memoId) {
        res.status(400).json({ error: "token, title, sendAt, memoId 필수" });
        return;
      }

      // Firestore 'scheduled_notifications' 컬렉션에 저장
      // memoId를 문서 ID로 사용 → 같은 약속 재저장 시 덮어씀
      await db.collection("scheduled_notifications").doc(memoId).set({
        token,
        title,
        body: body || "",
        sendAt: admin.firestore.Timestamp.fromMillis(sendAt),
        sent: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).json({ success: true, memoId });
    } catch (e) {
      console.error("scheduleNotification 오류:", e);
      res.status(500).json({ error: e.message });
    }
  }
);

// ────────────────────────────────────────────────
// 2. 알림 발송 스케줄러
//    매 1분마다 실행 → 시간 된 알림 찾아서 FCM 발송
// ────────────────────────────────────────────────
exports.sendScheduledNotifications = onSchedule(
  { schedule: "every 1 minutes", region: "us-central1" },
  async () => {
    const now = admin.firestore.Timestamp.now();

    // 아직 안 보낸 것 중 sendAt이 지난 것
    const snap = await db.collection("scheduled_notifications")
      .where("sent", "==", false)
      .where("sendAt", "<=", now)
      .get();

    if (snap.empty) return;

    const batch = db.batch();
    const promises = [];

    snap.forEach(doc => {
      const { token, title, body } = doc.data();

      // FCM 발송
      promises.push(
        messaging.send({
          token,
          notification: { title, body },
          android: {
            notification: {
              icon: "ic_notification",
              color: "#3B82F6",
              sound: "default",
              channelId: "memoapp_appt",
            },
            priority: "high",
          },
          webpush: {
            notification: {
              title,
              body,
              icon: "/memoapp/icons/icon-192x192.png",
              badge: "/memoapp/icons/icon-192x192.png",
              vibrate: [200, 100, 200],
              requireInteraction: true,
            },
            fcmOptions: { link: "/memoapp/" },
          },
          data: { memoId: doc.id },
        }).catch(err => {
          console.error(`FCM 발송 실패 (${doc.id}):`, err.message);
          // 토큰 만료 등 오류 시 해당 문서 삭제
          if (err.code === "messaging/registration-token-not-registered") {
            batch.delete(doc.ref);
          }
        })
      );

      // 발송 완료 표시
      batch.update(doc.ref, { sent: true, sentAt: now });
    });

    await Promise.all(promises);
    await batch.commit();

    console.log(`${promises.length}건 알림 발송 완료`);
  }
);

// ────────────────────────────────────────────────
// 3. 알림 취소 API
//    메모 삭제 시 호출
//    POST /cancelNotification
//    body: { memoId }
// ────────────────────────────────────────────────
exports.cancelNotification = onRequest(
  { region: "us-central1", cors: true },
  async (req, res) => {
    setCORS(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }

    try {
      const { memoId } = req.body;
      if (!memoId) { res.status(400).json({ error: "memoId 필수" }); return; }

      await db.collection("scheduled_notifications").doc(memoId).delete();
      res.status(200).json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);
