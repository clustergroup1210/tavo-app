const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { authenticate, hasTeamAccess } = require('../middleware/auth');
const { filterDataByVisibility, getVisibleDataWhereClause } = require('../services/dataVisibilityService');

const router = express.Router();
const prisma = new PrismaClient();

function isOperator(user) {
  return user.organizations?.some(o => 
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
  );
}

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

    let videos = await prisma.video.findMany({
      where,
      include: { player: { select: { id: true, name: true, teamId: true, userId: true } } },
      orderBy: { createdAt: 'desc' }
    });

    if (playerId && !isOperator(req.user)) {
      const player = await prisma.player.findUnique({
        where: { id: playerId },
        select: { id: true, userId: true }
      });
      
      const isOwnData = player?.userId === req.user.id;
      const isParent = req.user.parentPlayers?.some(pp => pp.playerId === playerId);
      
      if (!isOwnData && !isParent) {
        videos = await filterDataByVisibility(req.user, playerId, videos, 'createdAt');
      }
    }

    res.json(videos);
  } catch (error) {
    console.error('Fetch videos error:', error);
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
      include: { player: { select: { id: true, name: true, teamId: true, userId: true } } }
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (video.player && !isOperator(req.user)) {
      const isSelf = video.player.userId === req.user.id;
      const isParent = req.user.parentPlayers?.some(pp => pp.playerId === video.playerId);
      
      if (!isSelf && !isParent) {
        const filteredVideos = await filterDataByVisibility(req.user, video.playerId, [video], 'createdAt');
        if (filteredVideos.length === 0) {
          return res.status(403).json({ error: 'この動画は閲覧期間外のため表示できません' });
        }
      }
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
      include: { player: { select: { id: true, name: true, teamId: true, userId: true } } }
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const isUploader = video.uploadedBy === req.user.id;
    const isSelf = video.player?.userId === req.user.id;
    const isParent = req.user.parentPlayers?.some(pp => pp.playerId === video.playerId);
    const isOp = isOperator(req.user);

    if (isUploader || isSelf || isParent || isOp) {
      const filePath = path.join(__dirname, '../../uploads', video.storageKey);
      return res.sendFile(filePath);
    }

    const hasAccess = (video.player && hasTeamAccess(req.user, video.player.teamId)) ||
                      (video.teamId && hasTeamAccess(req.user, video.teamId));

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (video.player) {
      const filteredVideos = await filterDataByVisibility(req.user, video.playerId, [video], 'createdAt');
      if (filteredVideos.length === 0) {
        return res.status(403).json({ error: 'この動画は閲覧期間外のため表示できません' });
      }
    }

    const filePath = path.join(__dirname, '../../uploads', video.storageKey);
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ error: 'Failed to stream video' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { title, description } = req.body;
    
    const video = await prisma.video.findUnique({
      where: { id: req.params.id },
      include: { player: true }
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const isUploader = video.uploadedBy === req.user.id;
    const isCoach = video.player && hasTeamAccess(req.user, video.player.teamId, ['TEAM_MANAGER', 'COACH', 'COACH']);
    const isParent = req.user.parentPlayers?.some(pp => pp.playerId === video.playerId);

    if (isParent && !isUploader) {
      return res.status(403).json({ error: '保護者は自分がアップロードした動画のみ編集できます' });
    }
    
    if (!isUploader && !isCoach) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.video.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description })
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update video error:', error);
    res.status(500).json({ error: 'Failed to update video' });
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

    const isUploader = video.uploadedBy === req.user.id;
    const isCoach = video.player && hasTeamAccess(req.user, video.player.teamId, ['TEAM_MANAGER', 'COACH']);
    const isParent = req.user.parentPlayers?.some(pp => pp.playerId === video.playerId);

    if (isParent && !isUploader) {
      return res.status(403).json({ error: '保護者は自分がアップロードした動画のみ削除できます' });
    }

    if (!isUploader && !isCoach) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.video.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

module.exports = router;
