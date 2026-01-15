const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/:playerId', authenticate, async (req, res) => {
  try {
    const { playerId } = req.params;
    
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: { 
        team: { include: { parent: true } },
        teamCategory: true
      }
    });
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const isSelf = player.userId === req.user.id;
    const isParentOfPlayer = req.user.parentPlayers?.some(pp => pp.playerId === player.id);
    
    if (!isSelf && !isParentOfPlayer) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const teamIds = [player.teamId];
    if (player.team?.parentId) {
      teamIds.push(player.team.parentId);
    }

    const [evaluations, rounds, items, notifications, unreadCount] = await Promise.all([
      prisma.evaluation.findMany({
        where: { playerId },
        include: { 
          item: { include: { parent: true } }, 
          round: true 
        },
        orderBy: { evaluatedAt: 'desc' }
      }),
      prisma.evaluationRound.findMany({
        where: { teamId: { in: teamIds }, isActive: true },
        orderBy: { startDate: 'desc' }
      }),
      prisma.evaluationItem.findMany({
        where: { teamId: { in: teamIds }, isActive: true },
        orderBy: { sortOrder: 'asc' }
      }),
      prisma.notification.findMany({
        where: { userId: req.user.id, isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      prisma.notification.count({
        where: { userId: req.user.id, isRead: false }
      })
    ]);

    const latestRound = rounds[0] || null;
    const latestRoundEvals = latestRound 
      ? evaluations.filter(e => e.roundId === latestRound.id)
      : [];

    let coachTotal = 0, coachCount = 0;
    let selfTotal = 0, selfCount = 0;
    const categoryScores = {};

    latestRoundEvals.forEach(e => {
      const categoryName = e.item.parent?.name || e.item.name;
      if (!categoryScores[categoryName]) {
        categoryScores[categoryName] = { coach: { total: 0, count: 0 }, self: { total: 0, count: 0 } };
      }
      
      if (e.raterType === 'COACH') {
        coachTotal += e.score;
        coachCount += 1;
        categoryScores[categoryName].coach.total += e.score;
        categoryScores[categoryName].coach.count += 1;
      } else {
        selfTotal += e.score;
        selfCount += 1;
        categoryScores[categoryName].self.total += e.score;
        categoryScores[categoryName].self.count += 1;
      }
    });

    const totalItems = items.filter(item => item.parentId !== null).length;
    const maxScore = totalItems * 5;
    const currentScore = coachTotal || selfTotal;
    const achievementRate = maxScore > 0 ? Math.round((currentScore / maxScore) * 100) : 0;

    const radarData = Object.entries(categoryScores).map(([category, scores]) => ({
      category,
      coach: scores.coach.count > 0 ? Math.round((scores.coach.total / scores.coach.count) * 10) / 10 : 0,
      self: scores.self.count > 0 ? Math.round((scores.self.total / scores.self.count) * 10) / 10 : 0,
      fullMark: 5
    }));

    const gapAnalysis = Object.entries(categoryScores)
      .map(([category, scores]) => {
        const coachAvg = scores.coach.count > 0 ? scores.coach.total / scores.coach.count : null;
        const selfAvg = scores.self.count > 0 ? scores.self.total / scores.self.count : null;
        const gap = coachAvg !== null && selfAvg !== null ? Math.round((coachAvg - selfAvg) * 10) / 10 : null;
        return { category, coachAvg, selfAvg, gap };
      })
      .filter(item => item.gap !== null)
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

    const roundProgress = {};
    evaluations.forEach(e => {
      if (!roundProgress[e.roundId]) {
        roundProgress[e.roundId] = {
          roundId: e.roundId,
          roundName: e.round.name,
          date: e.round.startDate,
          coachTotal: 0,
          coachCount: 0,
          selfTotal: 0,
          selfCount: 0,
          categories: {}
        };
      }
      const rp = roundProgress[e.roundId];
      const categoryName = e.item.parent?.name || e.item.name;
      
      if (!rp.categories[categoryName]) {
        rp.categories[categoryName] = { coach: { total: 0, count: 0 }, self: { total: 0, count: 0 } };
      }
      
      if (e.raterType === 'COACH') {
        rp.coachTotal += e.score;
        rp.coachCount += 1;
        rp.categories[categoryName].coach.total += e.score;
        rp.categories[categoryName].coach.count += 1;
      } else {
        rp.selfTotal += e.score;
        rp.selfCount += 1;
        rp.categories[categoryName].self.total += e.score;
        rp.categories[categoryName].self.count += 1;
      }
    });

    const progressData = Object.values(roundProgress)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(r => {
        const coachAvg = r.coachCount > 0 ? Math.round((r.coachTotal / r.coachCount) * 10) / 10 : null;
        const selfAvg = r.selfCount > 0 ? Math.round((r.selfTotal / r.selfCount) * 10) / 10 : null;
        
        const categoryData = {};
        Object.entries(r.categories).forEach(([cat, scores]) => {
          categoryData[cat] = {
            coach: scores.coach.count > 0 ? Math.round((scores.coach.total / scores.coach.count) * 10) / 10 : null,
            self: scores.self.count > 0 ? Math.round((scores.self.total / scores.self.count) * 10) / 10 : null
          };
        });
        
        return {
          roundName: r.roundName,
          date: r.date,
          coachTotal: r.coachTotal > 0 ? r.coachTotal : null,
          selfTotal: r.selfTotal > 0 ? r.selfTotal : null,
          coachAvg,
          selfAvg,
          categories: categoryData
        };
      });

    const allCategories = [...new Set(progressData.flatMap(d => Object.keys(d.categories)))];

    const hasPendingSelfEval = latestRound && selfCount === 0 && coachCount > 0;
    const nextActions = [];
    if (hasPendingSelfEval) {
      nextActions.push({
        type: 'self_evaluation',
        title: '自己評価を入力してください',
        description: `${latestRound.name}の自己評価がまだ完了していません`,
        linkUrl: `/mypage`
      });
    }

    res.json({
      player: {
        id: player.id,
        name: player.name,
        photoUrl: player.photoUrl,
        position: player.position,
        number: player.number,
        teamName: player.team.name,
        categoryName: player.teamCategory?.name
      },
      summary: {
        currentScore,
        maxScore,
        achievementRate,
        latestRound: latestRound ? { id: latestRound.id, name: latestRound.name } : null,
        coachAvg: coachCount > 0 ? Math.round((coachTotal / coachCount) * 10) / 10 : null,
        selfAvg: selfCount > 0 ? Math.round((selfTotal / selfCount) * 10) / 10 : null
      },
      evaluation: {
        radarData,
        gapAnalysis,
        hasData: latestRoundEvals.length > 0
      },
      progress: {
        progressData,
        categories: allCategories
      },
      notifications: {
        unreadCount,
        recent: notifications
      },
      nextActions
    });
  } catch (error) {
    console.error('Player dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch player dashboard data' });
  }
});

module.exports = router;
