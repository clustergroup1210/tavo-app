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

    const teamIds = [teamId];
    if (team.parentId) teamIds.push(team.parentId);

    const [players, items, rounds, evaluations] = await Promise.all([
      prisma.player.findMany({
        where: { teamId },
        select: { id: true, name: true, number: true },
        orderBy: { number: 'asc' }
      }),
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
          player: { teamId },
          item: { teamId: { in: teamIds } },
          raterType: 'COACH'
        },
        select: {
          playerId: true,
          itemId: true,
          roundId: true,
          score: true
        }
      })
    ]);

    const categories = items.filter(i => i.parentId === null);
    const leafItems = items.filter(i => i.parentId !== null);

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
      const rows = categories.length > 0
        ? categories.map(cat => {
            const catItems = categoryItemsMap[cat.id] || [];
            const maxPerRound = catItems.reduce((sum, item) => sum + (item.maxScore || 5), 0);

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
              return hasAny ? total : null;
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
        rows
      };
    });

    res.json({
      months: monthLabels,
      players: playersData
    });
  } catch (error) {
    console.error('Evaluation matrix error:', error);
    res.status(500).json({ error: 'Failed to fetch evaluation matrix' });
  }
});

module.exports = router;
