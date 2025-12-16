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
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

router.get('/', authenticate, async (req, res) => {
  try {
    const { teamId } = req.query;
    
    const where = {};
    if (teamId) {
      where.teamId = teamId;
    } else {
      const isOperator = req.user.organizations?.some(o => 
        ['OPERATOR_ADMIN', 'OPERATOR_MANAGER', 'OPERATOR_STAFF'].includes(o.role)
      );
      
      if (!isOperator) {
        const teamIds = req.user.teams?.map(t => t.teamId) || [];
        where.teamId = { in: teamIds };
      }
    }

    const players = await prisma.player.findMany({
      where,
      include: {
        team: true,
        user: { select: { id: true, email: true, name: true } },
        evaluations: { take: 5, orderBy: { evaluatedAt: 'desc' } }
      }
    });

    res.json(players);
  } catch (error) {
    console.error('Get players error:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const player = await prisma.player.findUnique({
      where: { id: req.params.id },
      include: {
        team: true,
        user: { select: { id: true, email: true, name: true } },
        parents: { include: { user: { select: { id: true, email: true, name: true } } } },
        evaluations: {
          include: { item: true, round: true, rater: { select: { id: true, name: true } } },
          orderBy: { evaluatedAt: 'desc' }
        },
        videos: { orderBy: { createdAt: 'desc' } },
        appealLinks: { where: { isActive: true } }
      }
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(player);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch player' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { teamId, name, number, position, birthDate } = req.body;

    if (!hasTeamAccess(req.user, teamId, ['TEAM_ADMIN', 'TEAM_HEAD_COACH', 'TEAM_COACH'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const player = await prisma.player.create({
      data: {
        teamId,
        name,
        number,
        position,
        birthDate: birthDate ? new Date(birthDate) : null
      }
    });

    await prisma.playerTeamHistory.create({
      data: { playerId: player.id, teamId, joinedAt: new Date() }
    });

    res.json(player);
  } catch (error) {
    console.error('Create player error:', error);
    res.status(500).json({ error: 'Failed to create player' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, number, position, birthDate } = req.body;

    const player = await prisma.player.findUnique({ where: { id: req.params.id } });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    if (!hasTeamAccess(req.user, player.teamId, ['TEAM_ADMIN', 'TEAM_HEAD_COACH', 'TEAM_COACH'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.player.update({
      where: { id: req.params.id },
      data: {
        name,
        number,
        position,
        birthDate: birthDate ? new Date(birthDate) : null
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update player' });
  }
});

router.post('/:id/passport', authenticate, upload.single('passport'), async (req, res) => {
  try {
    const player = await prisma.player.findUnique({ where: { id: req.params.id } });
    
    const canUpload = 
      player.userId === req.user.id ||
      req.user.parentPlayers?.some(pp => pp.playerId === req.params.id) ||
      hasTeamAccess(req.user, player.teamId, ['TEAM_ADMIN', 'TEAM_HEAD_COACH']);

    if (!canUpload) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const passportUrl = `/uploads/logos/${req.file.filename}`;
    const updated = await prisma.player.update({
      where: { id: req.params.id },
      data: { passportUrl }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload passport' });
  }
});

module.exports = router;
