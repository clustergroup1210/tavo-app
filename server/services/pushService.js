const { PrismaClient } = require('@prisma/client');
const webpush = require('web-push');

const prisma = new PrismaClient();

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@example.com';

let configured = false;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
}

async function sendPushToUser(userId, { title, message, linkUrl, type }) {
  if (!configured) return { sent: 0, failed: 0 };

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return { sent: 0, failed: 0 };

  const payload = JSON.stringify({
    title: title || 'お知らせ',
    body: message || '',
    url: linkUrl || '/',
    type: type || 'GENERIC'
  });

  let sent = 0;
  let failed = 0;
  const stale = [];

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      );
      sent++;
    } catch (err) {
      failed++;
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        stale.push(s.endpoint);
      } else {
        console.error('[push] send error:', err?.statusCode, err?.body || err?.message);
      }
    }
  }));

  if (stale.length) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: stale } } });
  }

  return { sent, failed };
}

module.exports = { sendPushToUser };
