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

router.get('/comparison/:playerId', authenticate, async (req, res) => {
  try {
    const { roundId } = req.query;
    
    const player = await prisma.player.findUnique({
      where: { id: req.params.playerId },
      include: { team: true }
    });
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const items = await prisma.evaluationItem.findMany({
      where: { teamId: player.teamId, isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    const evalWhere = { playerId: req.params.playerId };
    if (roundId) evalWhere.roundId = roundId;

    const evaluations = await prisma.evaluation.findMany({
      where: evalWhere,
      include: { item: { include: { parent: { include: { parent: true } } } }, round: true },
      orderBy: { evaluatedAt: 'desc' }
    });

    const latestRoundId = roundId || (evaluations.length > 0 ? evaluations[0].roundId : null);
    const latestEvals = evaluations.filter(e => e.roundId === latestRoundId);

    const coachEvals = {};
    const selfEvals = {};
    latestEvals.forEach(e => {
      if (e.raterType === 'COACH') {
        if (!coachEvals[e.itemId] || e.evaluatedAt > coachEvals[e.itemId].evaluatedAt) {
          coachEvals[e.itemId] = e;
        }
      } else if (e.raterType === 'SELF') {
        if (!selfEvals[e.itemId] || e.evaluatedAt > selfEvals[e.itemId].evaluatedAt) {
          selfEvals[e.itemId] = e;
        }
      }
    });

    const buildHierarchy = (items, parentId = null) => {
      return items
        .filter(item => item.parentId === parentId)
        .map(item => ({
          ...item,
          children: buildHierarchy(items, item.id)
        }));
    };

    const hierarchy = buildHierarchy(items);

    const flattenWithHierarchy = (items, category = null, subCategory = null) => {
      const result = [];
      items.forEach(item => {
        if (item.children && item.children.length > 0) {
          item.children.forEach(child => {
            if (child.children && child.children.length > 0) {
              child.children.forEach(leaf => {
                result.push({
                  itemId: leaf.id,
                  category: item.name,
                  subCategory: child.name,
                  itemName: leaf.name,
                  coachScore: coachEvals[leaf.id]?.score || null,
                  selfScore: selfEvals[leaf.id]?.score || null,
                  gap: coachEvals[leaf.id] && selfEvals[leaf.id] 
                    ? coachEvals[leaf.id].score - selfEvals[leaf.id].score 
                    : null
                });
              });
            } else {
              result.push({
                itemId: child.id,
                category: item.name,
                subCategory: null,
                itemName: child.name,
                coachScore: coachEvals[child.id]?.score || null,
                selfScore: selfEvals[child.id]?.score || null,
                gap: coachEvals[child.id] && selfEvals[child.id] 
                  ? coachEvals[child.id].score - selfEvals[child.id].score 
                  : null
              });
            }
          });
        } else {
          result.push({
            itemId: item.id,
            category: null,
            subCategory: null,
            itemName: item.name,
            coachScore: coachEvals[item.id]?.score || null,
            selfScore: selfEvals[item.id]?.score || null,
            gap: coachEvals[item.id] && selfEvals[item.id] 
              ? coachEvals[item.id].score - selfEvals[item.id].score 
              : null
          });
        }
      });
      return result;
    };

    const comparison = flattenWithHierarchy(hierarchy);

    res.json({
      roundId: latestRoundId,
      comparison,
      hasData: latestEvals.length > 0
    });
  } catch (error) {
    console.error('Comparison error:', error);
    res.status(500).json({ error: 'Failed to fetch evaluation comparison' });
  }
});

router.get('/progress/:playerId', authenticate, async (req, res) => {
  try {
    const player = await prisma.player.findUnique({
      where: { id: req.params.playerId },
      include: { team: true }
    });
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const evaluations = await prisma.evaluation.findMany({
      where: { playerId: req.params.playerId },
      include: { 
        item: { include: { parent: true } }, 
        round: true 
      },
      orderBy: { evaluatedAt: 'asc' }
    });

    const byRound = {};
    evaluations.forEach(e => {
      const roundKey = e.roundId;
      if (!byRound[roundKey]) {
        byRound[roundKey] = {
          roundId: e.roundId,
          roundName: e.round.name,
          date: e.round.startDate,
          coach: { total: 0, count: 0, categories: {} },
          self: { total: 0, count: 0, categories: {} }
        };
      }
      
      const targetType = e.raterType === 'COACH' ? 'coach' : 'self';
      byRound[roundKey][targetType].total += e.score;
      byRound[roundKey][targetType].count += 1;

      const categoryName = e.item.parent?.name || e.item.name;
      if (!byRound[roundKey][targetType].categories[categoryName]) {
        byRound[roundKey][targetType].categories[categoryName] = { total: 0, count: 0 };
      }
      byRound[roundKey][targetType].categories[categoryName].total += e.score;
      byRound[roundKey][targetType].categories[categoryName].count += 1;
    });

    const progressData = Object.values(byRound)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(r => {
        const coachTotal = r.coach.total;
        const selfTotal = r.self.total;
        const coachAvg = r.coach.count > 0 ? (r.coach.total / r.coach.count).toFixed(1) : null;
        const selfAvg = r.self.count > 0 ? (r.self.total / r.self.count).toFixed(1) : null;
        
        const categoryData = {};
        const allCategories = new Set([
          ...Object.keys(r.coach.categories),
          ...Object.keys(r.self.categories)
        ]);
        
        allCategories.forEach(cat => {
          const coachCat = r.coach.categories[cat];
          const selfCat = r.self.categories[cat];
          categoryData[cat] = {
            coach: coachCat ? (coachCat.total / coachCat.count).toFixed(1) : null,
            self: selfCat ? (selfCat.total / selfCat.count).toFixed(1) : null
          };
        });

        return {
          roundName: r.roundName,
          date: r.date,
          coachTotal: coachTotal > 0 ? coachTotal : null,
          selfTotal: selfTotal > 0 ? selfTotal : null,
          coachAvg: coachAvg ? parseFloat(coachAvg) : null,
          selfAvg: selfAvg ? parseFloat(selfAvg) : null,
          gap: coachAvg && selfAvg ? parseFloat((coachAvg - selfAvg).toFixed(1)) : null,
          categories: categoryData
        };
      });

    const allCategories = [...new Set(
      progressData.flatMap(d => Object.keys(d.categories))
    )];

    res.json({
      progressData,
      categories: allCategories
    });
  } catch (error) {
    console.error('Progress error:', error);
    res.status(500).json({ error: 'Failed to fetch progress data' });
  }
});

router.get('/heatmap/:playerId', authenticate, async (req, res) => {
  try {
    const player = await prisma.player.findUnique({
      where: { id: req.params.playerId },
      include: { team: true }
    });
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const items = await prisma.evaluationItem.findMany({
      where: { teamId: player.teamId, isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    const evaluations = await prisma.evaluation.findMany({
      where: { playerId: req.params.playerId },
      orderBy: { evaluatedAt: 'desc' }
    });

    const latestByItem = {};
    evaluations.forEach(e => {
      if (!latestByItem[e.itemId]) {
        latestByItem[e.itemId] = e;
      }
    });

    const buildHierarchy = (items, parentId = null) => {
      return items
        .filter(item => item.parentId === parentId)
        .map(item => ({
          ...item,
          children: buildHierarchy(items, item.id)
        }));
    };

    const hierarchy = buildHierarchy(items);

    const flattenForHeatmap = (items, category = null) => {
      const result = [];
      items.forEach(item => {
        if (item.children && item.children.length > 0) {
          item.children.forEach(child => {
            if (child.children && child.children.length > 0) {
              child.children.forEach(leaf => {
                const eval_ = latestByItem[leaf.id];
                result.push({
                  id: leaf.id,
                  name: leaf.name,
                  category: item.name,
                  subCategory: child.name,
                  score: eval_?.score || 0,
                  percentage: eval_ ? (eval_.score / 5) * 100 : 0
                });
              });
            } else {
              const eval_ = latestByItem[child.id];
              result.push({
                id: child.id,
                name: child.name,
                category: item.name,
                subCategory: null,
                score: eval_?.score || 0,
                percentage: eval_ ? (eval_.score / 5) * 100 : 0
              });
            }
          });
        }
      });
      return result;
    };

    const heatmapData = flattenForHeatmap(hierarchy);

    const categoryGroups = {};
    heatmapData.forEach(item => {
      if (!categoryGroups[item.category]) {
        categoryGroups[item.category] = [];
      }
      categoryGroups[item.category].push(item);
    });

    res.json({
      heatmapData,
      categoryGroups
    });
  } catch (error) {
    console.error('Heatmap error:', error);
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
});

router.get('/ranking', authenticate, async (req, res) => {
  try {
    const { teamId, roundId, category, position } = req.query;

    if (!teamId || !roundId) {
      return res.status(400).json({ error: 'teamId and roundId are required' });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { children: { select: { id: true } } }
    });
    const teamIds = [teamId];
    if (team?.children) {
      team.children.forEach(child => teamIds.push(child.id));
    }

    const playerWhere = { teamId: { in: teamIds } };
    if (position) {
      playerWhere.position = position;
    }

    const players = await prisma.player.findMany({
      where: playerWhere,
      select: { id: true, name: true, number: true, position: true }
    });

    const playerIds = players.map(p => p.id);

    let itemIds = null;
    let categories = [];

    const allItems = await prisma.evaluationItem.findMany({
      where: { teamId: { in: teamIds }, isActive: true }
    });

    const topLevelItems = allItems.filter(i => !i.parentId);
    categories = topLevelItems.map(i => ({ id: i.id, name: i.name }));

    if (category) {
      const getDescendantIds = (parentId) => {
        const children = allItems.filter(i => i.parentId === parentId);
        if (children.length === 0) {
          return [parentId];
        }
        let ids = [];
        children.forEach(c => {
          const hasChildren = allItems.some(i => i.parentId === c.id);
          if (!hasChildren) {
            ids.push(c.id);
          } else {
            ids = ids.concat(getDescendantIds(c.id));
          }
        });
        return ids;
      };
      itemIds = getDescendantIds(category);
    }

    const evalWhere = {
      playerId: { in: playerIds },
      roundId,
      raterType: 'COACH'
    };
    if (itemIds && itemIds.length > 0) {
      evalWhere.itemId = { in: itemIds };
    }

    const evaluations = await prisma.evaluation.findMany({
      where: evalWhere,
      include: { item: { select: { id: true, parentId: true } } }
    });

    const getTopLevelCategory = (itemId) => {
      const item = allItems.find(i => i.id === itemId);
      if (!item) return null;
      if (!item.parentId) return item.id;
      return getTopLevelCategory(item.parentId);
    };

    const playerScores = {};
    players.forEach(p => {
      playerScores[p.id] = {
        player: p,
        totalScore: 0,
        categoryScores: {}
      };
      categories.forEach(cat => {
        playerScores[p.id].categoryScores[cat.id] = 0;
      });
    });

    evaluations.forEach(e => {
      if (playerScores[e.playerId]) {
        playerScores[e.playerId].totalScore += e.score;
        const catId = getTopLevelCategory(e.itemId);
        if (catId && playerScores[e.playerId].categoryScores[catId] !== undefined) {
          playerScores[e.playerId].categoryScores[catId] += e.score;
        }
      }
    });

    const ranking = Object.values(playerScores)
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((item, index) => ({
        rank: index + 1,
        ...item
      }));

    res.json({ ranking, categories });
  } catch (error) {
    console.error('Ranking error:', error);
    res.status(500).json({ error: 'Failed to fetch ranking data' });
  }
});

router.post('/rounds/:id/copy-previous', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const targetRound = await prisma.evaluationRound.findUnique({
      where: { id },
      include: { team: true }
    });

    if (!targetRound) {
      return res.status(404).json({ error: 'Round not found' });
    }

    if (!hasTeamAccess(req.user, targetRound.teamId, ['TEAM_ADMIN', 'TEAM_HEAD_COACH', 'TEAM_COACH'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const previousRound = await prisma.evaluationRound.findFirst({
      where: {
        teamId: targetRound.teamId,
        startDate: { lt: targetRound.startDate }
      },
      orderBy: { startDate: 'desc' }
    });

    if (!previousRound) {
      return res.status(404).json({ error: 'No previous round found' });
    }

    const previousEvaluations = await prisma.evaluation.findMany({
      where: { roundId: previousRound.id }
    });

    if (previousEvaluations.length === 0) {
      return res.status(404).json({ error: 'No evaluations found in previous round' });
    }

    const existingEvaluations = await prisma.evaluation.findMany({
      where: { roundId: id },
      select: { playerId: true, itemId: true, raterType: true }
    });

    const existingKeys = new Set(
      existingEvaluations.map(e => `${e.playerId}-${e.itemId}-${e.raterType}`)
    );

    const newEvaluations = previousEvaluations
      .filter(e => !existingKeys.has(`${e.playerId}-${e.itemId}-${e.raterType}`))
      .map(e => ({
        playerId: e.playerId,
        itemId: e.itemId,
        roundId: id,
        score: e.score,
        raterUserId: req.user.id,
        raterType: e.raterType
      }));

    if (newEvaluations.length > 0) {
      await prisma.evaluation.createMany({ data: newEvaluations });
    }

    res.json({
      message: 'Evaluations copied successfully',
      copiedCount: newEvaluations.length,
      previousRoundName: previousRound.name
    });
  } catch (error) {
    console.error('Copy previous error:', error);
    res.status(500).json({ error: 'Failed to copy previous evaluations' });
  }
});

module.exports = router;
