const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, hasTeamAccess } = require('../middleware/auth');

const router = express.Router();

router.get('/:playerId', authenticate, async (req, res) => {
  try {
    const { playerId } = req.params;

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true, userId: true, teamId: true, joinedAt: true, graduationDate: true }
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const isSelf = player.userId === req.user.id;
    const isParent = await prisma.playerParent.findFirst({
      where: { playerId, userId: req.user.id }
    });
    const isCoachOrAdmin = hasTeamAccess(req.user, player.teamId, ['TEAM_MANAGER', 'COACH', 'GUEST_COACH']);
    const isOperator = req.user.organizations?.some(o =>
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );

    if (!isSelf && !isParent && !isCoachOrAdmin && !isOperator) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const records = await prisma.mentoringRecord.findMany({
      where: { playerId },
      orderBy: { targetMonth: 'asc' }
    });

    res.json({
      records,
      joinedAt: player.joinedAt,
      graduationDate: player.graduationDate
    });
  } catch (error) {
    console.error('Failed to fetch mentoring records:', error);
    res.status(500).json({ error: 'Failed to fetch mentoring records' });
  }
});

router.put('/:playerId', authenticate, async (req, res) => {
  try {
    const { playerId } = req.params;
    const { targetMonth, goal, staffComment, score } = req.body;

    if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
      return res.status(400).json({ error: 'Invalid targetMonth format (YYYY-MM)' });
    }

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true, userId: true, teamId: true }
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const isSelf = player.userId === req.user.id;
    const isCoachOrAdmin = hasTeamAccess(req.user, player.teamId, ['TEAM_MANAGER', 'COACH', 'GUEST_COACH']);
    const isOperator = req.user.organizations?.some(o =>
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );

    if (!isSelf && !isCoachOrAdmin && !isOperator) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (score !== undefined && score !== null && score !== '') {
      const scoreInt = parseInt(score);
      if (isNaN(scoreInt) || scoreInt < 1 || scoreInt > 5) {
        return res.status(400).json({ error: '評価点は1〜5の範囲で入力してください' });
      }
    }

    const updateData = {};

    if (isSelf) {
      if (goal !== undefined) updateData.goal = goal;
    }

    if (isCoachOrAdmin || isOperator) {
      if (staffComment !== undefined || score !== undefined) {
        const existingRecord = await prisma.mentoringRecord.findUnique({
          where: { playerId_targetMonth: { playerId, targetMonth } }
        });
        if (!existingRecord || !existingRecord.goal) {
          return res.status(400).json({ error: '選手が目標を入力してからコメント・評価を追加できます' });
        }
        if (staffComment !== undefined) updateData.staffComment = staffComment;
        if (score !== undefined) updateData.score = score !== null && score !== '' ? parseInt(score) : null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: '更新するデータがありません' });
    }

    const record = await prisma.mentoringRecord.upsert({
      where: {
        playerId_targetMonth: { playerId, targetMonth }
      },
      update: updateData,
      create: {
        playerId,
        targetMonth,
        ...updateData
      }
    });

    res.json(record);
  } catch (error) {
    console.error('Failed to upsert mentoring record:', error);
    res.status(500).json({ error: 'Failed to save mentoring record' });
  }
});

module.exports = router;
