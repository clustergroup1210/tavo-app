const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { authenticate, hasTeamAccess } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `video_${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

router.get('/', authenticate, async (req, res) => {
  try {
    const { teamId, playerId } = req.query;

    const where = {};
    if (playerId) where.playerId = playerId;
    if (teamId) where.teamId = teamId;

    const videos = await prisma.video.findMany({
      where,
      include: { player: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });

    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

router.post('/', authenticate, upload.single('video'), async (req, res) => {
  try {
    const { title, description, playerId, teamId } = req.body;

    if (playerId) {
      const player = await prisma.player.findUnique({ where: { id: playerId } });
      const canUpload = 
        player.userId === req.user.id ||
        req.user.parentPlayers?.some(pp => pp.playerId === playerId) ||
        hasTeamAccess(req.user, player.teamId);

      if (!canUpload) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const video = await prisma.video.create({
      data: {
        title,
        description,
        playerId,
        teamId,
        storageKey: req.file.filename,
        uploadedBy: req.user.id
      }
    });

    res.json(video);
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const video = await prisma.video.findUnique({
      where: { id: req.params.id },
      include: { player: true }
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({
      ...video,
      url: `/api/videos/${video.id}/stream`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

router.get('/:id/stream', authenticate, async (req, res) => {
  try {
    const video = await prisma.video.findUnique({
      where: { id: req.params.id },
      include: { player: true }
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const canView = 
      video.uploadedBy === req.user.id ||
      (video.player && (
        video.player.userId === req.user.id ||
        hasTeamAccess(req.user, video.player.teamId)
      )) ||
      (video.teamId && hasTeamAccess(req.user, video.teamId));

    if (!canView) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const filePath = path.join(__dirname, '../../uploads', video.storageKey);
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ error: 'Failed to stream video' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const video = await prisma.video.findUnique({
      where: { id: req.params.id },
      include: { player: true }
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const canDelete = 
      video.uploadedBy === req.user.id ||
      (video.player && hasTeamAccess(req.user, video.player.teamId, ['TEAM_ADMIN', 'TEAM_HEAD_COACH']));

    if (!canDelete) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.video.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

module.exports = router;
