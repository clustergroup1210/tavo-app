const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { getOrCreateSettings } = require('../services/notificationService');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
  try {
    const { limit = 20, offset = 0, unreadOnly } = req.query;

    const where = { userId: req.user.id };
    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId: req.user.id, isRead: false }
      })
    ]);

    res.json({ notifications, total, unreadCount });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user.id, isRead: false }
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

router.put('/mark-all-read', authenticate, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await prisma.notification.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

router.get('/settings', authenticate, async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.user.id);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/settings', authenticate, async (req, res) => {
  try {
    const {
      notifyEvaluation,
      notifySelfEvaluation,
      notifyTask,
      notifyComment,
      enableEmail
    } = req.body;

    const settings = await prisma.notificationSetting.upsert({
      where: { userId: req.user.id },
      update: {
        notifyEvaluation: notifyEvaluation ?? undefined,
        notifySelfEvaluation: notifySelfEvaluation ?? undefined,
        notifyTask: notifyTask ?? undefined,
        notifyComment: notifyComment ?? undefined,
        enableEmail: enableEmail ?? undefined
      },
      create: {
        userId: req.user.id,
        notifyEvaluation: notifyEvaluation ?? true,
        notifySelfEvaluation: notifySelfEvaluation ?? true,
        notifyTask: notifyTask ?? true,
        notifyComment: notifyComment ?? true,
        enableEmail: enableEmail ?? true
      }
    });

    res.json(settings);
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
