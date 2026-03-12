/**
 * Send FCM push notifications. Requires FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL.
 */
let messaging: import('firebase-admin').messaging.Messaging | null = null;

function getMessaging(): import('firebase-admin').messaging.Messaging | null {
  if (messaging) return messaging;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  if (!projectId || !privateKey || !clientEmail) return null;
  try {
    const admin = require('firebase-admin');
    if (!admin.apps?.length) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, privateKey, clientEmail }),
      });
    }
    messaging = admin.messaging();
    return messaging;
  } catch {
    return null;
  }
}

/** Send a push notification to the given FCM tokens. Returns number of successful sends. */
export async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<number> {
  const validTokens = tokens.filter((t) => typeof t === 'string' && t.length > 0);
  if (validTokens.length === 0) return 0;
  const m = getMessaging();
  if (!m) return 0;
  try {
    const result = await m.sendEachForMulticast({
      tokens: validTokens,
      notification: { title, body },
      data: data ?? {},
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
    return result.successCount;
  } catch (e) {
    console.warn('[send-push] FCM error:', e);
    return 0;
  }
}
