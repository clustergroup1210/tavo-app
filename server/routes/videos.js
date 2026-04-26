const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { authenticate, hasTeamAccess } = require('../middleware/auth');
const { filterDataByVisibility, getVisibleDataWhereClause } = require('../services/dataVisibilityService');
const { isR2Configured, getUploadPresignedUrl, getDownloadPresignedUrl, deleteR2Object } = require('../lib/r2');

const router = express.Router();
const prisma = new PrismaClient();

function isOperator(user) {
  return user.organizations?.some(o => 
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
  );
}

const videoInclude = {
  player: { select: { id: true, name: true, teamId: true, userId: true } },
  playerTags: { include: { player: { select: { id: true, name: true, number: true } } } },
  categoryTags: { include: { teamCategory: { select: { id: true, name: true } } } }
};

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
      include: videoInclude,
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

router.post('/presigned-upload', authenticate, async (req, res) => {
  try {
    if (!isR2Configured()) {
      return res.status(503).json({ error: 'R2ストレージが設定されていません' });
    }

    const { title, description, playerId, teamId, contentType, fileSize, fileName, playerTagIds, categoryTagIds } = req.body;

    if (!title || !contentType || !fileName) {
      return res.status(400).json({ error: 'タイトル、ファイル名、コンテンツタイプは必須です' });
    }

    if (playerId) {
      const player = await prisma.player.findFirst({ where: { id: playerId, deletedAt: null } });
      if (!player) return res.status(404).json({ error: '選手が見つかりません' });

      const canUpload = 
        player.userId === req.user.id ||
        req.user.parentPlayers?.some(pp => pp.playerId === playerId) ||
        hasTeamAccess(req.user, player.teamId);

      if (!canUpload) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const ext = path.extname(fileName);
    const r2Key = `videos/${uuidv4()}${ext}`;

    const uploadUrl = await getUploadPresignedUrl(r2Key, contentType);

    if (playerTagIds?.length && teamId) {
      const validPlayers = await prisma.player.findMany({
        where: { id: { in: playerTagIds }, teamId, deletedAt: null }
      });
      if (validPlayers.length !== playerTagIds.length) {
        return res.status(400).json({ error: '無効な選手タグが含まれています' });
      }
    }

    if (categoryTagIds?.length && teamId) {
      const validCats = await prisma.teamCategory.findMany({
        where: { id: { in: categoryTagIds }, teamId }
      });
      if (validCats.length !== categoryTagIds.length) {
        return res.status(400).json({ error: '無効なカテゴリータグが含まれています' });
      }
    }

    const video = await prisma.video.create({
      data: {
        title,
        description,
        playerId,
        teamId,
        r2Key,
        contentType,
        fileSize: fileSize ? parseInt(fileSize) : null,
        uploadedBy: req.user.id,
        playerTags: playerTagIds?.length ? {
          create: playerTagIds.map(pid => ({ playerId: pid }))
        } : undefined,
        categoryTags: categoryTagIds?.length ? {
          create: categoryTagIds.map(cid => ({ teamCategoryId: cid }))
        } : undefined
      }
    });

    res.json({ video, uploadUrl });
  } catch (error) {
    console.error('Presigned upload error:', error);
    res.status(500).json({ error: 'Failed to create presigned upload URL' });
  }
});

router.post('/', authenticate, upload.single('video'), async (req, res) => {
  try {
    const { title, description, playerId, teamId, playerTagIds, categoryTagIds } = req.body;

    if (playerId) {
      const player = await prisma.player.findFirst({ where: { id: playerId, deletedAt: null } });
      if (!player) return res.status(404).json({ error: '選手が見つかりません' });
      const canUpload = 
        player.userId === req.user.id ||
        req.user.parentPlayers?.some(pp => pp.playerId === playerId) ||
        hasTeamAccess(req.user, player.teamId);

      if (!canUpload) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const parsedPlayerTags = playerTagIds ? JSON.parse(playerTagIds) : [];
    const parsedCategoryTags = categoryTagIds ? JSON.parse(categoryTagIds) : [];

    if (parsedPlayerTags.length && teamId) {
      const validPlayers = await prisma.player.findMany({
        where: { id: { in: parsedPlayerTags }, teamId, deletedAt: null }
      });
      if (validPlayers.length !== parsedPlayerTags.length) {
        return res.status(400).json({ error: '無効な選手タグが含まれています' });
      }
    }

    if (parsedCategoryTags.length && teamId) {
      const validCats = await prisma.teamCategory.findMany({
        where: { id: { in: parsedCategoryTags }, teamId }
      });
      if (validCats.length !== parsedCategoryTags.length) {
        return res.status(400).json({ error: '無効なカテゴリータグが含まれています' });
      }
    }

    const video = await prisma.video.create({
      data: {
        title,
        description,
        playerId,
        teamId,
        storageKey: req.file.filename,
        uploadedBy: req.user.id,
        playerTags: parsedPlayerTags.length ? {
          create: parsedPlayerTags.map(pid => ({ playerId: pid }))
        } : undefined,
        categoryTags: parsedCategoryTags.length ? {
          create: parsedCategoryTags.map(cid => ({ teamCategoryId: cid }))
        } : undefined
      }
    });

    res.json(video);
  } catch (error) {
    console.error('Upload video error:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

router.get('/r2-status', authenticate, async (req, res) => {
  res.json({ configured: isR2Configured() });
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const video = await prisma.video.findUnique({
      where: { id: req.params.id },
      include: videoInclude
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

    let url;
    if (video.r2Key && isR2Configured()) {
      url = await getDownloadPresignedUrl(video.r2Key);
    } else {
      url = `/api/videos/${video.id}/stream`;
    }

    res.json({ ...video, url });
  } catch (error) {
    console.error('Fetch video error:', error);
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

    if (video.r2Key && isR2Configured()) {
      const downloadUrl = await getDownloadPresignedUrl(video.r2Key);
      return res.redirect(downloadUrl);
    }

    if (!video.storageKey) {
      return res.status(404).json({ error: 'Video file not found' });
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
    const { title, description, playerTagIds, categoryTagIds } = req.body;
    
    const video = await prisma.video.findUnique({
      where: { id: req.params.id },
      include: { player: true }
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const isUploader = video.uploadedBy === req.user.id;
    const isCoachUser = video.player && hasTeamAccess(req.user, video.player.teamId, ['TEAM_MANAGER', 'COACH']);
    const isParent = req.user.parentPlayers?.some(pp => pp.playerId === video.playerId);

    if (isParent && !isUploader) {
      return res.status(403).json({ error: '保護者は自分がアップロードした動画のみ編集できます' });
    }
    
    if (!isUploader && !isCoachUser && !isOperator(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;

    if (playerTagIds !== undefined) {
      if (playerTagIds.length > 0 && video.teamId) {
        const validPlayers = await prisma.player.findMany({
          where: { id: { in: playerTagIds }, teamId: video.teamId, deletedAt: null }
        });
        if (validPlayers.length !== playerTagIds.length) {
          return res.status(400).json({ error: '無効な選手タグが含まれています' });
        }
      }
      await prisma.videoPlayerTag.deleteMany({ where: { videoId: video.id } });
      if (playerTagIds.length > 0) {
        await prisma.videoPlayerTag.createMany({
          data: playerTagIds.map(pid => ({ videoId: video.id, playerId: pid }))
        });
      }
    }

    if (categoryTagIds !== undefined) {
      if (categoryTagIds.length > 0 && video.teamId) {
        const validCats = await prisma.teamCategory.findMany({
          where: { id: { in: categoryTagIds }, teamId: video.teamId }
        });
        if (validCats.length !== categoryTagIds.length) {
          return res.status(400).json({ error: '無効なカテゴリータグが含まれています' });
        }
      }
      await prisma.videoCategoryTag.deleteMany({ where: { videoId: video.id } });
      if (categoryTagIds.length > 0) {
        await prisma.videoCategoryTag.createMany({
          data: categoryTagIds.map(cid => ({ videoId: video.id, teamCategoryId: cid }))
        });
      }
    }

    const updated = await prisma.video.update({
      where: { id: req.params.id },
      data: updateData,
      include: videoInclude
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
    const isCoachUser = video.player && hasTeamAccess(req.user, video.player.teamId, ['TEAM_MANAGER', 'COACH']);
    const isParent = req.user.parentPlayers?.some(pp => pp.playerId === video.playerId);

    if (isParent && !isUploader) {
      return res.status(403).json({ error: '保護者は自分がアップロードした動画のみ削除できます' });
    }

    if (!isUploader && !isCoachUser && !isOperator(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (video.r2Key && isR2Configured()) {
      try {
        await deleteR2Object(video.r2Key);
      } catch (err) {
        console.error('R2 delete error (continuing with DB delete):', err);
      }
    }

    await prisma.video.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

module.exports = router;
