const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, hasTeamAccess } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/items', authenticate, async (req, res) => {
  try {
    const { teamId } = req.query;
    
    const items = await prisma.evaluationItem.findMany({
      where: { teamId, isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    const buildHierarchy = (items, parentId = null) => {
      return items
        .filter(item => item.parentId === parentId)
        .map(item => ({
          ...item,
          children: buildHierarchy(items, item.id)
        }));
    };

    res.json(buildHierarchy(items));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch evaluation items' });
  }
});

router.post('/items', authenticate, async (req, res) => {
  try {
    const { teamId, parentId, name, description, position, sortOrder } = req.body;

    if (!hasTeamAccess(req.user, teamId, ['TEAM_ADMIN', 'TEAM_HEAD_COACH'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const item = await prisma.evaluationItem.create({
      data: { teamId, parentId, name, description, position, sortOrder: sortOrder || 0 }
    });

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create evaluation item' });
  }
});

router.put('/items/:id', authenticate, async (req, res) => {
  try {
    const { name, description, position, sortOrder, isActive } = req.body;

    const item = await prisma.evaluationItem.findUnique({ where: { id: req.params.id } });
    if (!hasTeamAccess(req.user, item.teamId, ['TEAM_ADMIN', 'TEAM_HEAD_COACH'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.evaluationItem.update({
      where: { id: req.params.id },
      data: { name, description, position, sortOrder, isActive }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update evaluation item' });
  }
});

router.get('/rounds', authenticate, async (req, res) => {
  try {
    const { teamId } = req.query;
    
    const rounds = await prisma.evaluationRound.findMany({
      where: { teamId },
      orderBy: { startDate: 'desc' }
    });

    res.json(rounds);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch evaluation rounds' });
  }
});

router.post('/rounds', authenticate, async (req, res) => {
  try {
    const { teamId, name, startDate, endDate } = req.body;

    if (!hasTeamAccess(req.user, teamId, ['TEAM_ADMIN', 'TEAM_HEAD_COACH'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const round = await prisma.evaluationRound.create({
      data: {
        teamId,
        name,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null
      }
    });

    res.json(round);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create evaluation round' });
  }
});

router.get('/player/:playerId', authenticate, async (req, res) => {
  try {
    const { roundId } = req.query;
    
    const where = { playerId: req.params.playerId };
    if (roundId) where.roundId = roundId;

    const evaluations = await prisma.evaluation.findMany({
      where,
      include: {
        item: true,
        round: true,
        rater: { select: { id: true, name: true } }
      },
      orderBy: { evaluatedAt: 'desc' }
    });

    res.json(evaluations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch evaluations' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { playerId, roundId, evaluations } = req.body;

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const isCoach = hasTeamAccess(req.user, player.teamId, [
      'TEAM_ADMIN', 'TEAM_HEAD_COACH', 'TEAM_COACH', 'TEAM_EXTERNAL_COACH'
    ]);
    const isSelf = player.userId === req.user.id;

    if (!isCoach && !isSelf) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const raterType = isSelf && !isCoach ? 'SELF' : 'COACH';

    const existingEvaluations = await prisma.evaluation.findMany({
      where: {
        playerId,
        roundId,
        raterUserId: req.user.id,
        raterType
      }
    });

    if (existingEvaluations.length > 0) {
      return res.status(400).json({ 
        error: raterType === 'SELF' 
          ? 'このラウンドで既に自己評価を提出しています' 
          : 'このラウンドで既にこの選手を評価しています'
      });
    }

    const created = await prisma.$transaction(
      evaluations.map(e => prisma.evaluation.create({
        data: {
          playerId,
          itemId: e.itemId,
          roundId,
          score: e.score,
          raterUserId: req.user.id,
          raterType
        }
      }))
    );

    res.json(created);
  } catch (error) {
    console.error('Create evaluation error:', error);
    res.status(500).json({ error: 'Failed to save evaluations' });
  }
});

router.get('/summary/:playerId', authenticate, async (req, res) => {
  try {
    const evaluations = await prisma.evaluation.findMany({
      where: { playerId: req.params.playerId },
      include: { item: true, round: true },
      orderBy: { evaluatedAt: 'desc' }
    });

    const byItem = {};
    evaluations.forEach(e => {
      if (!byItem[e.itemId]) {
        byItem[e.itemId] = { item: e.item, evaluations: [] };
      }
      byItem[e.itemId].evaluations.push(e);
    });

    const summary = Object.values(byItem).map(({ item, evaluations }) => {
      const latest = evaluations[0];
      const progress = evaluations.length > 1 
        ? latest.score - evaluations[evaluations.length - 1].score 
        : 0;
      
      return {
        item,
        latestScore: latest.score,
        latestRound: latest.round,
        progress,
        history: evaluations.slice(0, 10)
      };
    });

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch evaluation summary' });
  }
});

module.exports = router;
