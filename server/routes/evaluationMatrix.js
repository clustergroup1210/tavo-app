const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

function generateRecentMonths(count = 6) {
  const months = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

router.get('/:teamId', authenticate, async (req, res) => {
  try {
    const { teamId } = req.params;

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, parentId: true }
    });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const itemTeamIds = [teamId];
    if (team.parentId) itemTeamIds.push(team.parentId);

    const childTeams = await prisma.team.findMany({
      where: { parentId: teamId },
      select: { id: true }
    });
    const childTeamIds = childTeams.map(ct => ct.id);

    const playerTeamIds = childTeamIds.length > 0 ? [teamId, ...childTeamIds] : [teamId];

    const [players, items, rounds, evaluations, teamCategories] = await Promise.all([
      prisma.player.findMany({
        where: { teamId: { in: playerTeamIds }, deletedAt: null },
        select: { id: true, name: true, number: true, teamCategoryId: true, position: true, joinedAt: true, graduationDate: true },
        orderBy: { number: 'asc' }
      }),
      prisma.evaluationItem.findMany({
        where: { teamId: { in: itemTeamIds }, isActive: true },
        include: { parent: true },
        orderBy: { sortOrder: 'asc' }
      }),
      prisma.evaluationRound.findMany({
        where: { teamId: { in: itemTeamIds }, isActive: true },
        orderBy: { startDate: 'asc' }
      }),
      prisma.evaluation.findMany({
        where: {
          player: { teamId: { in: playerTeamIds } },
          item: { teamId: { in: itemTeamIds } },
          raterType: 'COACH'
        },
        select: {
          playerId: true,
          itemId: true,
          roundId: true,
          score: true
        }
      }),
      prisma.teamCategory.findMany({
        where: { teamId: { in: playerTeamIds } },
        select: { id: true, name: true },
        orderBy: { sortOrder: 'asc' }
      })
    ]);

    const categories = items.filter(i => i.parentId === null);
    const leafItems = items.filter(i => i.parentId !== null);

    const itemsById = {};
    items.forEach(it => { itemsById[it.id] = it; });
    const isPositionAllowed = (item, pos) => {
      if (item.targetPositions && item.targetPositions.length > 0) {
        if (!item.targetPositions.includes(pos)) return false;
      }
      if (item.parentId && itemsById[item.parentId]) {
        return isPositionAllowed(itemsById[item.parentId], pos);
      }
      return true;
    };

    let monthLabels;
    let roundLabels;

    if (rounds.length > 0) {
      roundLabels = rounds.map(r => {
        const d = new Date(r.startDate);
        return {
          id: r.id,
          label: `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`
        };
      });
      monthLabels = roundLabels.map(r => r.label);
    } else {
      monthLabels = generateRecentMonths(6);
      roundLabels = [];
    }

    const evalMap = {};
    evaluations.forEach(e => {
      const key = `${e.playerId}_${e.itemId}_${e.roundId}`;
      evalMap[key] = e.score;
    });

    const categoryItemsMap = {};
    categories.forEach(cat => {
      categoryItemsMap[cat.id] = leafItems
        .filter(li => li.parentId === cat.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    });

    const playersData = players.map(player => {
      let totalMonths = null;
      if (player.joinedAt && player.graduationDate) {
        const joinDate = new Date(player.joinedAt);
        const gradDate = new Date(player.graduationDate);
        totalMonths = Math.max(1, (gradDate.getFullYear() - joinDate.getFullYear()) * 12 + (gradDate.getMonth() - joinDate.getMonth()) + 1);
      }

      // 選手のポジションで評価項目をフィルタ（ポジション未設定の選手は全項目表示）
      const playerCategories = player.position
        ? categories.filter(cat => isPositionAllowed(cat, player.position))
        : categories;

      const rows = playerCategories.length > 0
        ? playerCategories.map(cat => {
            const baseItems = categoryItemsMap[cat.id] || [];
            const catItems = player.position
              ? baseItems.filter(it => isPositionAllowed(it, player.position))
              : baseItems;
            const maxPerRound = catItems.reduce((sum, item) => sum + (item.maxScore || 5), 0);
            const fullMax = totalMonths !== null ? totalMonths * maxPerRound : null;

            let cumulative = 0;
            const scores = roundLabels.map(round => {
              let total = 0;
              let hasAny = false;
              catItems.forEach(item => {
                const key = `${player.id}_${item.id}_${round.id}`;
                if (evalMap[key] !== undefined) {
                  total += evalMap[key];
                  hasAny = true;
                }
              });
              if (hasAny) {
                cumulative += total;
                return { score: cumulative, max: fullMax, hasPeriod: totalMonths !== null };
              }
              return null;
            });

            if (roundLabels.length === 0) {
              return {
                category: cat.name,
                maxScore: maxPerRound,
                scores: monthLabels.map(() => null)
              };
            }

            return {
              category: cat.name,
              maxScore: maxPerRound,
              scores
            };
          })
        : [{
            category: '-',
            maxScore: 0,
            scores: monthLabels.map(() => null)
          }];

      return {
        id: player.id,
        number: player.number,
        name: player.name,
        teamCategoryId: player.teamCategoryId,
        position: player.position,
        rows
      };
    });

    res.json({
      months: monthLabels,
      players: playersData,
      evalCategories: categories.map(c => ({ id: c.id, name: c.name })),
      teamCategories: teamCategories
    });
  } catch (error) {
    console.error('Evaluation matrix error:', error);
    res.status(500).json({ error: 'Failed to fetch evaluation matrix' });
  }
});

router.get('/player/:playerId', authenticate, async (req, res) => {
  try {
    const { playerId } = req.params;

    const player = await prisma.player.findFirst({
      where: { id: playerId, deletedAt: null },
      select: { id: true, teamId: true, name: true, position: true, joinedAt: true, graduationDate: true }
    });
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const team = await prisma.team.findUnique({
      where: { id: player.teamId },
      select: { id: true, parentId: true }
    });
    const teamIds = [player.teamId];
    if (team?.parentId) teamIds.push(team.parentId);

    const [items, rounds, evaluations] = await Promise.all([
      prisma.evaluationItem.findMany({
        where: { teamId: { in: teamIds }, isActive: true },
        include: { parent: true },
        orderBy: { sortOrder: 'asc' }
      }),
      prisma.evaluationRound.findMany({
        where: { teamId: { in: teamIds }, isActive: true },
        orderBy: { startDate: 'asc' }
      }),
      prisma.evaluation.findMany({
        where: {
          playerId,
          item: { teamId: { in: teamIds } },
          raterType: 'COACH'
        },
        select: { itemId: true, roundId: true, score: true }
      })
    ]);

    const allCategories = items.filter(i => i.parentId === null);
    const allLeafItems = items.filter(i => i.parentId !== null);

    const itemsById = {};
    items.forEach(it => { itemsById[it.id] = it; });
    const isPositionAllowed = (item, pos) => {
      if (item.targetPositions && item.targetPositions.length > 0) {
        if (!item.targetPositions.includes(pos)) return false;
      }
      if (item.parentId && itemsById[item.parentId]) {
        return isPositionAllowed(itemsById[item.parentId], pos);
      }
      return true;
    };

    // 選手のポジションで評価項目をフィルタ（未設定なら全項目）
    const categories = player.position
      ? allCategories.filter(cat => isPositionAllowed(cat, player.position))
      : allCategories;
    const leafItems = player.position
      ? allLeafItems.filter(it => isPositionAllowed(it, player.position))
      : allLeafItems;

    const roundLabels = rounds.map(r => {
      const d = new Date(r.startDate);
      return { id: r.id, label: `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}` };
    });
    const monthLabels = roundLabels.length > 0 ? roundLabels.map(r => r.label) : generateRecentMonths(6);

    const evalMap = {};
    evaluations.forEach(e => {
      const key = `${e.itemId}_${e.roundId}`;
      evalMap[key] = e.score;
    });

    const categoryItemsMap = {};
    categories.forEach(cat => {
      categoryItemsMap[cat.id] = leafItems
        .filter(li => li.parentId === cat.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    });

    let totalMonths = null;
    if (player.joinedAt && player.graduationDate) {
      const joinDate = new Date(player.joinedAt);
      const gradDate = new Date(player.graduationDate);
      totalMonths = Math.max(1, (gradDate.getFullYear() - joinDate.getFullYear()) * 12 + (gradDate.getMonth() - joinDate.getMonth()) + 1);
    }

    const rows = categories.map(cat => {
      const catItems = categoryItemsMap[cat.id] || [];
      const maxPerRound = catItems.reduce((sum, item) => sum + (item.maxScore || 5), 0);
      const fullMax = totalMonths !== null ? totalMonths * maxPerRound : null;

      let cumulative = 0;
      const scores = roundLabels.map(round => {
        let total = 0;
        let hasAny = false;
        catItems.forEach(item => {
          const key = `${item.id}_${round.id}`;
          if (evalMap[key] !== undefined) {
            total += evalMap[key];
            hasAny = true;
          }
        });
        if (hasAny) {
          cumulative += total;
          return { score: cumulative, max: fullMax, hasPeriod: totalMonths !== null };
        }
        return null;
      });

      return { category: cat.name, maxScore: maxPerRound, scores };
    });

    res.json({
      months: monthLabels,
      rows,
      evalCategories: categories.map(c => ({ id: c.id, name: c.name })),
      period: {
        joinedAt: player.joinedAt,
        graduationDate: player.graduationDate,
        totalMonths
      }
    });
  } catch (error) {
    console.error('Player matrix error:', error);
    res.status(500).json({ error: 'Failed to fetch player matrix' });
  }
});

module.exports = router;
