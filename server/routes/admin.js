const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const requireOperator = (req, res, next) => {
  const isOperator = req.user.organizations?.some(o => 
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
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
          where: { role: 'COACH' },
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

router.put('/teams/:id', authenticate, requireOperator, async (req, res) => {
  try {
    const { name } = req.body;
    const team = await prisma.team.update({
      where: { id: req.params.id },
      data: { name }
    });
    res.json(team);
  } catch (error) {
    console.error('Failed to update team:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

router.delete('/teams/:id', authenticate, requireOperator, async (req, res) => {
  try {
    const teamId = req.params.id;
    
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        children: true,
        _count: { select: { players: true } }
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (team.children.length > 0) {
      return res.status(400).json({ error: 'サブカテゴリーを含むチームは削除できません。先にサブカテゴリーを削除してください。' });
    }

    if (team._count.players > 0) {
      return res.status(400).json({ error: '選手が所属しているチームは削除できません。先に選手を移動または削除してください。' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.userTeam.deleteMany({ where: { teamId } });
      await tx.invitation.deleteMany({ where: { teamId } });
      await tx.evaluationItem.deleteMany({ where: { teamId } });
      await tx.evaluationRound.deleteMany({ where: { teamId } });
      await tx.calendarEvent.deleteMany({ where: { teamId } });
      await tx.announcement.deleteMany({ where: { teamId } });
      await tx.goalCategory.deleteMany({ where: { teamId } });
      await tx.team.delete({ where: { id: teamId } });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

module.exports = router;
