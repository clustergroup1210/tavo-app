const express = require('express');
const { authenticate } = require('../middleware/auth');
const { filterDataByVisibility } = require('../services/dataVisibilityService');

const router = express.Router();
const prisma = require('../lib/prisma');

function hasTeamAccess(user, teamId, allowedRoles = []) {
  const teamRole = user.teams?.find(t => t.teamId === teamId);
  if (!teamRole) return false;
  if (allowedRoles.length === 0) return true;
  return allowedRoles.includes(teamRole.role);
}

function isOperator(user) {
  return user.organizations?.some(o => 
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
  );
}

router.get('/categories', authenticate, async (req, res) => {
  try {
    const { teamId } = req.query;
    
    if (!teamId) {
      return res.status(400).json({ error: 'teamId is required' });
    }

    if (!isOperator(req.user)) {
      const userTeams = await prisma.userTeam.findMany({
        where: { userId: req.user.id },
        include: { team: { select: { id: true, parentId: true } } }
      });
      
      const userTeamIds = userTeams.map(ut => ut.teamId);
      const userParentTeamIds = userTeams.map(ut => ut.team?.parentId).filter(Boolean);
      
      const isDirectMember = userTeamIds.includes(teamId);
      const isParentTeamMember = userParentTeamIds.includes(teamId);
      
      if (!isDirectMember && !isParentTeamMember) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const categories = await prisma.goalCategory.findMany({
      where: { teamId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { team: { select: { id: true, name: true } } }
    });

    res.json(categories);
  } catch (error) {
    console.error('Get goal categories error:', error);
    res.status(500).json({ error: 'Failed to fetch goal categories' });
  }
});

router.post('/categories', authenticate, async (req, res) => {
  try {
    const { teamId, name, description } = req.body;

    const canManage = isOperator(req.user) || 
      hasTeamAccess(req.user, teamId, ['TEAM_MANAGER', 'COACH']);
    
    if (!canManage) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const maxOrder = await prisma.goalCategory.aggregate({
      where: { teamId },
      _max: { sortOrder: true }
    });

    const category = await prisma.goalCategory.create({
      data: {
        teamId,
        name,
        description,
        sortOrder: (maxOrder._max.sortOrder || 0) + 1
      }
    });

    res.json(category);
  } catch (error) {
    console.error('Create goal category error:', error);
    res.status(500).json({ error: 'Failed to create goal category' });
  }
});

router.put('/categories/:id', authenticate, async (req, res) => {
  try {
    const { name, description, sortOrder, isActive } = req.body;

    const category = await prisma.goalCategory.findUnique({
      where: { id: req.params.id }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const canManage = isOperator(req.user) || 
      hasTeamAccess(req.user, category.teamId, ['TEAM_MANAGER', 'COACH']);
    
    if (!canManage) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.goalCategory.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive })
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update goal category error:', error);
    res.status(500).json({ error: 'Failed to update goal category' });
  }
});

router.delete('/categories/:id', authenticate, async (req, res) => {
  try {
    const category = await prisma.goalCategory.findUnique({
      where: { id: req.params.id }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const canManage = isOperator(req.user) || 
      hasTeamAccess(req.user, category.teamId, ['TEAM_MANAGER', 'COACH']);
    
    if (!canManage) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.goalCategory.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete goal category error:', error);
    res.status(500).json({ error: 'Failed to delete goal category' });
  }
});

router.get('/player/:playerId', authenticate, async (req, res) => {
  try {
    const player = await prisma.player.findUnique({
      where: { id: req.params.playerId }
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const isSelf = player.userId === req.user.id;
    const isParent = req.user.parentPlayers?.some(pp => pp.playerId === req.params.playerId);
    const hasAccess = isSelf || isParent ||
      isOperator(req.user) || 
      hasTeamAccess(req.user, player.teamId, ['TEAM_MANAGER', 'COACH', 'COACH']);
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let goals = await prisma.goal.findMany({
      where: { playerId: req.params.playerId },
      include: { 
        category: { select: { id: true, name: true, teamId: true } }
      },
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { createdAt: 'desc' }
      ]
    });

    if (!isSelf && !isParent && !isOperator(req.user)) {
      goals = await filterDataByVisibility(req.user, req.params.playerId, goals, 'createdAt');
    }

    res.json(goals);
  } catch (error) {
    console.error('Get player goals error:', error);
    res.status(500).json({ error: 'Failed to fetch player goals' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { playerId, categoryId, content } = req.body;

    const player = await prisma.player.findUnique({
      where: { id: playerId }
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const isSelf = player.userId === req.user.id;
    const isCoachOrAdmin = hasTeamAccess(req.user, player.teamId, ['TEAM_MANAGER', 'COACH', 'COACH']);
    
    if (!isSelf && !isCoachOrAdmin && !isOperator(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const goal = await prisma.goal.create({
      data: {
        playerId,
        categoryId,
        content
      },
      include: { category: true }
    });

    res.json(goal);
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { content, progress, status } = req.body;

    const goal = await prisma.goal.findUnique({
      where: { id: req.params.id },
      include: { player: true }
    });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const isSelf = goal.player.userId === req.user.id;
    const isCoachOrAdmin = hasTeamAccess(req.user, goal.player.teamId, ['TEAM_MANAGER', 'COACH', 'COACH']);
    
    if (!isSelf && !isCoachOrAdmin && !isOperator(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.goal.update({
      where: { id: req.params.id },
      data: {
        ...(content !== undefined && { content }),
        ...(progress !== undefined && { progress }),
        ...(status !== undefined && { status })
      },
      include: { category: true }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const goal = await prisma.goal.findUnique({
      where: { id: req.params.id },
      include: { player: true }
    });

    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const isSelf = goal.player.userId === req.user.id;
    const isCoachOrAdmin = hasTeamAccess(req.user, goal.player.teamId, ['TEAM_MANAGER', 'COACH', 'COACH']);
    
    if (!isSelf && !isCoachOrAdmin && !isOperator(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.goal.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

module.exports = router;
