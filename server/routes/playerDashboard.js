const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, hasTeamAccess } = require('../middleware/auth');

const router = express.Router();

function isOperator(user) {
  return user.organizations?.some(o => 
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
  );
}

router.get('/my-player', authenticate, async (req, res) => {
  try {
    let player = await prisma.player.findFirst({
      where: { userId: req.user.id },
      include: { 
        team: { select: { id: true, name: true } },
        teamCategory: { select: { id: true, name: true } }
      }
    });
    
    if (!player) {
      const parentPlayer = await prisma.playerParent.findFirst({
        where: { userId: req.user.id },
        include: {
          player: {
            include: {
              team: { select: { id: true, name: true } },
              teamCategory: { select: { id: true, name: true } }
            }
          }
        }
      });
      
      if (parentPlayer) {
        player = parentPlayer.player;
      }
    }
    
    if (!player) {
      return res.status(204).send();
    }
    
    res.json({
      id: player.id,
      name: player.name,
      photoUrl: player.photoUrl,
      position: player.position,
      number: player.number,
      teamId: player.teamId,
      teamName: player.team.name,
      categoryName: player.teamCategory?.name
    });
  } catch (error) {
    console.error('My player error:', error);
    res.status(500).json({ error: 'Failed to fetch player data' });
  }
});

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
      return res.status(403).json({ error: 'Access denied - use PlayerDetail for staff access' });
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
      isSelf ? prisma.notification.findMany({
        where: { userId: req.user.id, isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 5
      }) : Promise.resolve([]),
      isSelf ? prisma.notification.count({
        where: { userId: req.user.id, isRead: false }
      }) : Promise.resolve(0)
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

    const leafItems = items.filter(item => item.parentId !== null);
    const maxScore = leafItems.reduce((sum, item) => sum + (item.maxScore || 5), 0);
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

    const hasPendingSelfEval = isSelf && latestRound && selfCount === 0 && coachCount > 0;
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

router.get('/:playerId/achievement', authenticate, async (req, res) => {
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
    const isOp = isOperator(req.user);
    const isParentOfPlayer = req.user.parentPlayers?.some(pp => pp.playerId === player.id);
    const isTeamStaff = req.user.teams?.some(t => 
      [player.teamId, player.team?.parentId].filter(Boolean).includes(t.teamId)
    );
    
    if (!isSelf && !isOp && !isParentOfPlayer && !isTeamStaff) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const joinDate = player.joinedAt || player.createdAt;

    const teamIds = [player.teamId];
    if (player.team?.parentId) {
      teamIds.push(player.team.parentId);
    }

    const [evaluations, items, rounds] = await Promise.all([
      prisma.evaluation.findMany({
        where: { 
          playerId,
          evaluatedAt: { gte: joinDate }
        },
        include: { 
          item: { include: { parent: true } }, 
          round: true 
        },
        orderBy: { evaluatedAt: 'asc' }
      }),
      prisma.evaluationItem.findMany({
        where: { teamId: { in: teamIds }, isActive: true, parentId: { not: null } },
        include: { parent: true },
        orderBy: { sortOrder: 'asc' }
      }),
      prisma.evaluationRound.findMany({
        where: { teamId: { in: teamIds } },
        orderBy: { startDate: 'asc' }
      })
    ]);

    const categoryItems = {};
    items.forEach(item => {
      const catName = item.parent?.name || 'その他';
      if (!categoryItems[catName]) {
        categoryItems[catName] = [];
      }
      categoryItems[catName].push(item);
    });

    const coachEvals = evaluations.filter(e => e.raterType === 'COACH');
    const selfEvals = evaluations.filter(e => e.raterType === 'SELF');

    const categoryCumulative = {};
    let grandTotalMax = 0;
    let grandTotalActual = 0;
    let grandSelfTotalMax = 0;
    let grandSelfTotalActual = 0;

    Object.entries(categoryItems).forEach(([catName, catItems]) => {
      let coachActual = 0;
      let coachMax = 0;
      let selfActual = 0;
      let selfMax = 0;

      catItems.forEach(item => {
        const itemCoachEvals = coachEvals.filter(e => e.itemId === item.id);
        const itemSelfEvals = selfEvals.filter(e => e.itemId === item.id);
        
        itemCoachEvals.forEach(e => {
          coachActual += e.score;
          coachMax += item.maxScore;
        });
        
        itemSelfEvals.forEach(e => {
          selfActual += e.score;
          selfMax += item.maxScore;
        });
      });

      const coachRate = coachMax > 0 ? Math.round((coachActual / coachMax) * 100) : 0;
      const selfRate = selfMax > 0 ? Math.round((selfActual / selfMax) * 100) : 0;

      categoryCumulative[catName] = {
        category: catName,
        coachMax,
        coachActual,
        coachRate,
        selfMax,
        selfActual,
        selfRate,
        itemCount: catItems.length
      };

      grandTotalMax += coachMax;
      grandTotalActual += coachActual;
      grandSelfTotalMax += selfMax;
      grandSelfTotalActual += selfActual;
    });

    const overallCoachRate = grandTotalMax > 0 ? Math.round((grandTotalActual / grandTotalMax) * 100) : 0;
    const overallSelfRate = grandSelfTotalMax > 0 ? Math.round((grandSelfTotalActual / grandSelfTotalMax) * 100) : 0;

    const roundProgress = [];
    const filteredRounds = rounds.filter(r => new Date(r.startDate) >= joinDate);

    let cumulativeCoachScores = {};
    let cumulativeCoachMaxes = {};
    let cumulativeSelfScores = {};
    let cumulativeSelfMaxes = {};

    filteredRounds.forEach(round => {
      const roundEvals = evaluations.filter(e => e.roundId === round.id);
      
      roundEvals.forEach(e => {
        const catName = e.item.parent?.name || e.item.name;
        if (e.raterType === 'COACH') {
          cumulativeCoachScores[catName] = (cumulativeCoachScores[catName] || 0) + e.score;
          cumulativeCoachMaxes[catName] = (cumulativeCoachMaxes[catName] || 0) + (e.item.maxScore || 5);
        } else {
          cumulativeSelfScores[catName] = (cumulativeSelfScores[catName] || 0) + e.score;
          cumulativeSelfMaxes[catName] = (cumulativeSelfMaxes[catName] || 0) + (e.item.maxScore || 5);
        }
      });

      if (roundEvals.length === 0) return;

      const totalCoachMax = Object.values(cumulativeCoachMaxes).reduce((a, b) => a + b, 0);
      const totalCoachActual = Object.values(cumulativeCoachScores).reduce((a, b) => a + b, 0);
      const totalSelfMax = Object.values(cumulativeSelfMaxes).reduce((a, b) => a + b, 0);
      const totalSelfActual = Object.values(cumulativeSelfScores).reduce((a, b) => a + b, 0);

      const categoryRates = {};
      const allCats = new Set([...Object.keys(cumulativeCoachScores), ...Object.keys(cumulativeSelfScores)]);
      allCats.forEach(cat => {
        const cMax = cumulativeCoachMaxes[cat] || 0;
        const cActual = cumulativeCoachScores[cat] || 0;
        const sMax = cumulativeSelfMaxes[cat] || 0;
        const sActual = cumulativeSelfScores[cat] || 0;
        categoryRates[cat] = {
          coachRate: cMax > 0 ? Math.round((cActual / cMax) * 100) : null,
          selfRate: sMax > 0 ? Math.round((sActual / sMax) * 100) : null
        };
      });

      roundProgress.push({
        roundName: round.name,
        date: round.startDate,
        overallCoachRate: totalCoachMax > 0 ? Math.round((totalCoachActual / totalCoachMax) * 100) : null,
        overallSelfRate: totalSelfMax > 0 ? Math.round((totalSelfActual / totalSelfMax) * 100) : null,
        categories: categoryRates
      });
    });

    res.json({
      player: {
        id: player.id,
        name: player.name,
        joinedAt: joinDate
      },
      overall: {
        coachMax: grandTotalMax,
        coachActual: grandTotalActual,
        coachRate: overallCoachRate,
        selfMax: grandSelfTotalMax,
        selfActual: grandSelfTotalActual,
        selfRate: overallSelfRate
      },
      categories: Object.values(categoryCumulative),
      roundProgress
    });
  } catch (error) {
    console.error('Achievement calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate achievement data' });
  }
});

module.exports = router;
