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

    const totalMaxScore = leafItems.reduce((sum, item) => sum + (item.maxScore || 5), 0);

    const categoryMaxScores = {};
    leafItems.forEach(item => {
      const catName = items.find(i => i.id === item.parentId)?.name || item.name;
      if (!categoryMaxScores[catName]) categoryMaxScores[catName] = 0;
      categoryMaxScores[catName] += (item.maxScore || 5);
    });

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
        rp.categories[categoryName] = { 
          coach: { total: 0, count: 0 }, 
          self: { total: 0, count: 0 }
        };
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
          const catMax = categoryMaxScores[cat] || 0;
          categoryData[cat] = {
            coach: scores.coach.count > 0 ? Math.round((scores.coach.total / scores.coach.count) * 10) / 10 : null,
            self: scores.self.count > 0 ? Math.round((scores.self.total / scores.self.count) * 10) / 10 : null,
            coachTotal: scores.coach.total > 0 ? scores.coach.total : null,
            selfTotal: scores.self.total > 0 ? scores.self.total : null,
            maxScore: catMax
          };
        });
        
        return {
          roundName: r.roundName,
          date: r.date,
          coachTotal: r.coachTotal > 0 ? r.coachTotal : null,
          selfTotal: r.selfTotal > 0 ? r.selfTotal : null,
          maxScore: totalMaxScore,
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

    const hasPeriod = !!(player.joinedAt && player.graduationDate);
    const joinDate = player.joinedAt || player.createdAt;
    const now = new Date();
    let totalMonths = null;
    let elapsedMonths = 0;
    const graduationDate = player.graduationDate || null;

    if (hasPeriod) {
      const jd = new Date(player.joinedAt);
      const gd = new Date(player.graduationDate);
      totalMonths = Math.max(1, (gd.getFullYear() - jd.getFullYear()) * 12 + (gd.getMonth() - jd.getMonth()) + 1);
      const elapsedMs = now.getTime() - jd.getTime();
      elapsedMonths = Math.max(Math.round(elapsedMs / (1000 * 60 * 60 * 24 * 30.44)), 0);
    }

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
    let monthlyMaxScoreTotal = 0;
    items.forEach(item => {
      const catName = item.parent?.name || 'その他';
      if (!categoryItems[catName]) {
        categoryItems[catName] = { items: [], monthlyMax: 0 };
      }
      categoryItems[catName].items.push(item);
      categoryItems[catName].monthlyMax += (item.maxScore || 5);
      monthlyMaxScoreTotal += (item.maxScore || 5);
    });

    const careerDenominator = hasPeriod ? totalMonths * monthlyMaxScoreTotal : 0;

    const coachEvals = evaluations.filter(e => e.raterType === 'COACH');
    const selfEvals = evaluations.filter(e => e.raterType === 'SELF');

    const categories = [];
    let grandCoachActual = 0;
    let grandSelfActual = 0;
    let grandCareerDenominator = 0;
    let totalElements = 0;

    Object.entries(categoryItems).forEach(([catName, catData]) => {
      const { items: catItems, monthlyMax } = catData;
      const catDenominator = hasPeriod ? totalMonths * monthlyMax : 0;

      let coachActual = 0;
      let selfActual = 0;

      catItems.forEach(item => {
        coachEvals.filter(e => e.itemId === item.id).forEach(e => {
          coachActual += e.score;
        });
        selfEvals.filter(e => e.itemId === item.id).forEach(e => {
          selfActual += e.score;
        });
      });

      const coachRate = catDenominator > 0 ? Math.round((coachActual / catDenominator) * 1000) / 10 : 0;
      const selfRate = catDenominator > 0 ? Math.round((selfActual / catDenominator) * 1000) / 10 : 0;

      categories.push({
        category: catName,
        elementCount: catItems.length,
        monthlyMaxScore: monthlyMax,
        stepsMax: catDenominator,
        coachActual,
        selfActual,
        coachRate,
        selfRate
      });

      grandCoachActual += coachActual;
      grandSelfActual += selfActual;
      grandCareerDenominator += catDenominator;
      totalElements += catItems.length;
    });

    const overallCoachRate = grandCareerDenominator > 0 
      ? Math.round((grandCoachActual / grandCareerDenominator) * 1000) / 10 : 0;
    const overallSelfRate = grandCareerDenominator > 0 
      ? Math.round((grandSelfActual / grandCareerDenominator) * 1000) / 10 : 0;

    const monthlyProgress = [];
    let cumCoachScore = 0;
    let cumSelfScore = 0;
    const cumCatCoach = {};
    const cumCatSelf = {};

    const filteredRounds = rounds.filter(r => new Date(r.startDate) >= joinDate);

    filteredRounds.forEach(round => {
      const roundEvals = evaluations.filter(e => e.roundId === round.id);
      if (roundEvals.length === 0) return;

      roundEvals.forEach(e => {
        const catName = e.item.parent?.name || e.item.name;
        if (e.raterType === 'COACH') {
          cumCoachScore += e.score;
          cumCatCoach[catName] = (cumCatCoach[catName] || 0) + e.score;
        } else {
          cumSelfScore += e.score;
          cumCatSelf[catName] = (cumCatSelf[catName] || 0) + e.score;
        }
      });

      const roundDate = new Date(round.startDate);
      const label = `${roundDate.getFullYear()}/${String(roundDate.getMonth() + 1).padStart(2, '0')}`;

      const categoryRates = {};
      Object.entries(categoryItems).forEach(([catName, catData]) => {
        const catDenom = hasPeriod ? totalMonths * catData.monthlyMax : 0;
        categoryRates[catName] = {
          coachRate: catDenom > 0 ? Math.round(((cumCatCoach[catName] || 0) / catDenom) * 1000) / 10 : 0,
          selfRate: catDenom > 0 ? Math.round(((cumCatSelf[catName] || 0) / catDenom) * 1000) / 10 : 0
        };
      });

      monthlyProgress.push({
        label,
        date: round.startDate,
        roundName: round.name,
        overallCoachRate: grandCareerDenominator > 0 
          ? Math.round((cumCoachScore / grandCareerDenominator) * 1000) / 10 : 0,
        overallSelfRate: grandCareerDenominator > 0 
          ? Math.round((cumSelfScore / grandCareerDenominator) * 1000) / 10 : 0,
        categories: categoryRates
      });
    });

    res.json({
      player: {
        id: player.id,
        name: player.name,
        joinedAt: joinDate,
        graduationDate: graduationDate
      },
      period: {
        joinDate,
        graduationDate,
        totalMonths,
        elapsedMonths,
        monthlyMaxScore: monthlyMaxScoreTotal,
        hasPeriod
      },
      overall: {
        totalElements,
        careerDenominator: grandCareerDenominator,
        coachActual: grandCoachActual,
        coachRate: overallCoachRate,
        selfActual: grandSelfActual,
        selfRate: overallSelfRate
      },
      categories,
      monthlyProgress
    });
  } catch (error) {
    console.error('Achievement calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate achievement data' });
  }
});

module.exports = router;
