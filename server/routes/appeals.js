const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { authenticate, hasTeamAccess } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/', authenticate, async (req, res) => {
  try {
    const { playerId, type = 'simple', comment } = req.body;

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const isSelf = player.userId === req.user.id;
    const isCoach = hasTeamAccess(req.user, player.teamId, [
      'TEAM_ADMIN', 'TEAM_HEAD_COACH', 'TEAM_COACH'
    ]);

    if (type === 'simple' && !isSelf) {
      return res.status(403).json({ error: 'Only player can create simple appeal' });
    }

    if (type === 'recommended' && !isCoach) {
      return res.status(403).json({ error: 'Only coach can create recommended appeal' });
    }

    const token = uuidv4();
    const appealLink = await prisma.appealLink.create({
      data: {
        playerId,
        token,
        type,
        comment: type === 'recommended' ? comment : null,
        createdBy: req.user.id
      }
    });

    res.json({
      ...appealLink,
      url: `/appeal/${token}`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create appeal link' });
  }
});

router.get('/player/:playerId', authenticate, async (req, res) => {
  try {
    const appeals = await prisma.appealLink.findMany({
      where: { playerId: req.params.playerId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(appeals);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appeal links' });
  }
});

router.get('/public/:token', async (req, res) => {
  try {
    const appeal = await prisma.appealLink.findFirst({
      where: { token: req.params.token, isActive: true },
      include: {
        player: {
          include: {
            team: { select: { id: true, name: true, logoUrl: true } },
            evaluations: {
              include: { item: true, round: true },
              orderBy: { evaluatedAt: 'desc' },
              take: 50
            }
          }
        }
      }
    });

    if (!appeal) {
      return res.status(404).json({ error: 'Appeal not found or inactive' });
    }

    const byItem = {};
    appeal.player.evaluations.forEach(e => {
      if (!byItem[e.itemId]) {
        byItem[e.itemId] = { item: e.item, latestScore: e.score };
      }
    });

    res.json({
      type: appeal.type,
      comment: appeal.type === 'recommended' ? appeal.comment : null,
      player: {
        name: appeal.player.name,
        position: appeal.player.position,
        number: appeal.player.number,
        team: appeal.player.team
      },
      evaluationSummary: Object.values(byItem)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appeal' });
  }
});

router.put('/:id/deactivate', authenticate, async (req, res) => {
  try {
    const appeal = await prisma.appealLink.findUnique({
      where: { id: req.params.id },
      include: { player: true }
    });

    if (!appeal) {
      return res.status(404).json({ error: 'Appeal not found' });
    }

    const isSelf = appeal.player.userId === req.user.id;
    const isCoach = hasTeamAccess(req.user, appeal.player.teamId, [
      'TEAM_ADMIN', 'TEAM_HEAD_COACH'
    ]);

    if (!isSelf && !isCoach) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.appealLink.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate appeal' });
  }
});

module.exports = router;
