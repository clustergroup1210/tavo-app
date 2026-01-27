const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, hasTeamAccess } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/:videoId', authenticate, async (req, res) => {
  try {
    const comments = await prisma.videoComment.findMany({
      where: { videoId: req.params.videoId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(comments);
  } catch (error) {
    console.error('Fetch video comments error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

router.post('/:videoId', authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    const { videoId } = req.params;

    if (!content?.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: { 
        player: { 
          select: { id: true, name: true, userId: true, teamId: true } 
        } 
      }
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const comment = await prisma.videoComment.create({
      data: {
        videoId,
        userId: req.user.id,
        content: content.trim()
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } }
      }
    });

    if (video.uploadedBy && video.uploadedBy !== req.user.id) {
      await createNotification({
        userId: video.uploadedBy,
        type: 'VIDEO_COMMENT',
        title: '動画にコメントがつきました',
        message: `${req.user.name}さんが「${video.title}」にコメントしました`,
        linkUrl: `/videos?id=${videoId}`
      });
    }

    if (video.player?.userId && video.player.userId !== req.user.id && video.player.userId !== video.uploadedBy) {
      await createNotification({
        userId: video.player.userId,
        type: 'VIDEO_COMMENT',
        title: '動画にコメントがつきました',
        message: `${req.user.name}さんがあなたの動画「${video.title}」にコメントしました`,
        linkUrl: `/videos?id=${videoId}`
      });
    }

    res.json(comment);
  } catch (error) {
    console.error('Create video comment error:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

router.put('/:commentId', authenticate, async (req, res) => {
  try {
    const { content } = req.body;

    const comment = await prisma.videoComment.findUnique({
      where: { id: req.params.commentId }
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.videoComment.update({
      where: { id: req.params.commentId },
      data: { content: content.trim() },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update video comment error:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

router.delete('/:commentId', authenticate, async (req, res) => {
  try {
    const comment = await prisma.videoComment.findUnique({
      where: { id: req.params.commentId },
      include: { video: { include: { player: true } } }
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const isOwner = comment.userId === req.user.id;
    const isVideoUploader = comment.video.uploadedBy === req.user.id;
    const isTeamCoach = comment.video.player && 
      hasTeamAccess(req.user, comment.video.player.teamId, ['TEAM_MANAGER', 'COACH']);

    if (!isOwner && !isVideoUploader && !isTeamCoach) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.videoComment.delete({
      where: { id: req.params.commentId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete video comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;
