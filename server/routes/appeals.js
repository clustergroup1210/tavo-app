const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { authenticate, hasTeamAccess } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/', authenticate, async (req, res) => {
  try {
    const { playerId, type = 'simple', comment, expiresAt } = req.body;

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
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: req.user.id
      },
      include: {
        creator: { select: { id: true, name: true } }
      }
    });

    res.json({
      ...appealLink,
      url: `/appeal/${token}`
    });
  } catch (error) {
    console.error('Create appeal error:', error);
    res.status(500).json({ error: 'Failed to create appeal link' });
  }
});

router.get('/player/:playerId', authenticate, async (req, res) => {
  try {
    const appeals = await prisma.appealLink.findMany({
      where: { playerId: req.params.playerId },
      include: {
        creator: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const now = new Date();
    const enriched = appeals.map(a => ({
      ...a,
      url: `/appeal/${a.token}`,
      isExpired: a.expiresAt ? new Date(a.expiresAt) < now : false,
      issuerType: a.type === 'recommended' ? 'club' : 'player'
    }));

    res.json(enriched);
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
              include: { 
                item: { include: { parent: { include: { parent: true } } } }, 
                round: true 
              },
              orderBy: { evaluatedAt: 'desc' },
              take: 100
            }
          }
        },
        creator: { select: { id: true, name: true } }
      }
    });

    if (!appeal) {
      return res.status(404).json({ error: 'Appeal not found or inactive' });
    }

    if (appeal.expiresAt && new Date(appeal.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'このアピールページは有効期限が切れています' });
    }

    const coachEvals = {};
    const selfEvals = {};
    appeal.player.evaluations.forEach(e => {
      if (e.raterType === 'COACH') {
        if (!coachEvals[e.itemId] || e.evaluatedAt > coachEvals[e.itemId].evaluatedAt) {
          coachEvals[e.itemId] = { item: e.item, score: e.score, round: e.round };
        }
      } else if (e.raterType === 'SELF') {
        if (!selfEvals[e.itemId] || e.evaluatedAt > selfEvals[e.itemId].evaluatedAt) {
          selfEvals[e.itemId] = { item: e.item, score: e.score, round: e.round };
        }
      }
    });

    const items = Object.keys(coachEvals).map(itemId => ({
      item: coachEvals[itemId].item,
      coachScore: coachEvals[itemId]?.score || null,
      selfScore: selfEvals[itemId]?.score || null,
      round: coachEvals[itemId]?.round || selfEvals[itemId]?.round
    }));

    const categories = {};
    items.forEach(({ item, coachScore, selfScore }) => {
      const categoryName = item.parent?.parent?.name || item.parent?.name || 'その他';
      if (!categories[categoryName]) {
        categories[categoryName] = { items: [], totalCoach: 0, totalSelf: 0, count: 0 };
      }
      categories[categoryName].items.push({ name: item.name, coachScore, selfScore });
      if (coachScore) {
        categories[categoryName].totalCoach += coachScore;
        categories[categoryName].count++;
      }
      if (selfScore) {
        categories[categoryName].totalSelf += selfScore;
      }
    });

    const issuerType = appeal.type === 'recommended' ? 'club' : 'player';
    const issuerName = appeal.type === 'recommended' 
      ? (appeal.creator?.name || appeal.player.team?.name || 'クラブ')
      : appeal.player.name;

    res.json({
      type: appeal.type,
      comment: appeal.type === 'recommended' ? appeal.comment : null,
      issuer: {
        type: issuerType,
        name: issuerName
      },
      player: {
        name: appeal.player.name,
        nameRomaji: appeal.player.nameRomaji,
        position: appeal.player.position,
        number: appeal.player.number,
        birthDate: appeal.player.birthDate,
        height: appeal.player.height,
        weight: appeal.player.weight,
        dominantFoot: appeal.player.dominantFoot,
        photoUrl: appeal.player.photoUrl || appeal.player.passportUrl,
        roleModel: appeal.type === 'recommended' ? appeal.player.roleModel : null,
        playStyle: appeal.type === 'recommended' ? appeal.player.playStyle : null,
        team: appeal.player.team
      },
      evaluationCategories: Object.entries(categories).map(([name, data]) => ({
        name,
        avgCoachScore: data.count > 0 ? (data.totalCoach / data.count).toFixed(1) : null,
        avgSelfScore: data.count > 0 ? (data.totalSelf / data.count).toFixed(1) : null,
        items: data.items
      })),
      createdAt: appeal.createdAt,
      expiresAt: appeal.expiresAt
    });
  } catch (error) {
    console.error('Fetch public appeal error:', error);
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
