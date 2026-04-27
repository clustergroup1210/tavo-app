const express = require('express');
const { PrismaClient } = require('@prisma/client');
const webpush = require('web-push');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@example.com';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
} else {
  console.warn('[push] VAPID keys not configured. Web push will be disabled.');
}

router.get('/vapid-public-key', (req, res) => {
  if (!VAPID_PUBLIC) return res.status(503).json({ error: 'Push not configured' });
  res.json({ publicKey: VAPID_PUBLIC });
});

const ALLOWED_PUSH_HOSTS = [
  /(^|\.)googleapis\.com$/i,
  /(^|\.)google\.com$/i,
  /(^|\.)mozilla\.com$/i,
  /(^|\.)mozilla\.org$/i,
  /(^|\.)mozaws\.net$/i,
  /(^|\.)push\.apple\.com$/i,
  /(^|\.)windows\.com$/i,
  /(^|\.)notify\.windows\.com$/i,
  /(^|\.)wns2-.*\.notify\.windows\.com$/i
];

function isAllowedPushEndpoint(endpoint) {
  try {
    const u = new URL(endpoint);
    if (u.protocol !== 'https:') return false;
    if (!u.hostname) return false;
    return ALLOWED_PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || typeof endpoint !== 'string' || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    if (!isAllowedPushEndpoint(endpoint)) {
      return res.status(400).json({ error: 'Unsupported push endpoint' });
    }
    if (typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string' ||
        keys.p256dh.length > 256 || keys.auth.length > 256 || endpoint.length > 2048) {
      return res.status(400).json({ error: 'Invalid subscription payload' });
    }

    const userAgent = req.headers['user-agent'] || null;

    const sub = await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: req.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent
      },
      update: {
        userId: req.user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent
      }
    });

    res.json({ success: true, id: sub.id });
  } catch (error) {
    console.error('Failed to save push subscription:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

router.post('/unsubscribe', authenticate, async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: req.user.id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to remove push subscription:', error);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

router.post('/test', authenticate, async (req, res) => {
  try {
    const { sendPushToUser } = require('../services/pushService');
    const result = await sendPushToUser(req.user.id, {
      title: 'テスト通知',
      message: 'プッシュ通知が正常に届いています',
      linkUrl: '/'
    });
    res.json({ success: true, sent: result.sent, failed: result.failed });
  } catch (error) {
    console.error('Failed to send test push:', error);
    res.status(500).json({ error: 'Failed to send test push' });
  }
});

module.exports = router;
