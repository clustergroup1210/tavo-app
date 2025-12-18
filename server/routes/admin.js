const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const requireOperator = (req, res, next) => {
  const isOperator = req.user.organizations?.some(o => 
    ['OPERATOR_ADMIN', 'OPERATOR_MANAGER', 'OPERATOR_STAFF'].includes(o.role)
  );
  if (!isOperator) {
    return res.status(403).json({ error: 'Operator access required' });
  }
  next();
};

router.get('/teams', authenticate, requireOperator, async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      where: { parentId: null },
      include: {
        organization: { select: { name: true } },
        children: { select: { id: true } },
        users: {
          where: { role: 'TEAM_HEAD_COACH' },
          include: { user: { select: { name: true } } },
          take: 1
        },
        _count: { select: { players: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const teamsWithStats = await Promise.all(teams.map(async (team) => {
      const childTeamIds = team.children.map(c => c.id);
      const allTeamIds = [team.id, ...childTeamIds];
      
      const totalPlayerCount = await prisma.player.count({
        where: { teamId: { in: allTeamIds } }
      });

      return {
        id: team.id,
        name: team.name,
        logoUrl: team.logoUrl,
        organization: team.organization,
        representativeName: team.users[0]?.user?.name || null,
        playerCount: totalPlayerCount,
        categoryCount: team.children.length,
        createdAt: team.createdAt
      };
    }));

    res.json(teamsWithStats);
  } catch (error) {
    console.error('Failed to fetch teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

router.get('/stats', authenticate, requireOperator, async (req, res) => {
  try {
    const [totalTeams, totalPlayers, totalUsers] = await Promise.all([
      prisma.team.count({ where: { parentId: null } }),
      prisma.player.count(),
      prisma.user.count()
    ]);

    res.json({ totalTeams, totalPlayers, totalUsers });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/teams/:id', authenticate, requireOperator, async (req, res) => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      include: {
        organization: true,
        children: {
          include: {
            _count: { select: { players: true } }
          }
        },
        users: {
          include: { user: { select: { id: true, name: true, email: true } } }
        },
        _count: { select: { players: true } }
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json(team);
  } catch (error) {
    console.error('Failed to fetch team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

module.exports = router;
