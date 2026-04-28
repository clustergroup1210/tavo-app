const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, getHeadCoachVisibleTeamIds, getTeamSubtreeIds } = require('../middleware/auth');

const prisma = new PrismaClient();

function hasTeamAccess(user, teamId, roles) {
  return user.teams?.some(ut => ut.teamId === teamId && roles.includes(ut.role));
}

function isOperator(user) {
  return user.organizations?.some(o => 
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
  );
}

async function hasTeamMembershipOrParent(user, teamId) {
  if (user.teams?.some(ut => ut.teamId === teamId)) {
    return true;
  }
  
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { parentId: true }
  });
  
  if (team?.parentId && user.teams?.some(ut => ut.teamId === team.parentId)) {
    return true;
  }

  const headCoachVisible = await getHeadCoachVisibleTeamIds(user.id);
  if (headCoachVisible.has(teamId)) {
    return true;
  }
  
  return false;
}

router.get('/', authenticate, async (req, res) => {
  try {
    const { teamId } = req.query;
    
    if (!teamId) {
      return res.status(400).json({ error: 'teamId is required' });
    }
    
    const hasAccess = await hasTeamMembershipOrParent(req.user, teamId);
    if (!hasAccess && !isOperator(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const subtree = await getTeamSubtreeIds(teamId);
    const teamIds = Array.from(subtree);
    
    const categories = await prisma.teamCategory.findMany({
      where: { teamId: { in: teamIds }, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { players: { where: { deletedAt: null } } } }
      }
    });
    
    res.json(categories);
  } catch (error) {
    console.error('Get team categories error:', error);
    res.status(500).json({ error: 'Failed to fetch team categories' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { teamId, name, sortOrder } = req.body;
    
    const canCreate = hasTeamAccess(req.user, teamId, ['TEAM_MANAGER', 'COACH']) || isOperator(req.user);
    
    if (!canCreate) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const category = await prisma.teamCategory.create({
      data: {
        teamId,
        name,
        sortOrder: sortOrder || 0
      }
    });
    
    res.status(201).json(category);
  } catch (error) {
    console.error('Create team category error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Category with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create team category' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const category = await prisma.teamCategory.findUnique({ where: { id: req.params.id } });
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    const canEdit = hasTeamAccess(req.user, category.teamId, ['TEAM_MANAGER', 'COACH']) || isOperator(req.user);
    
    if (!canEdit) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { name, sortOrder, isActive } = req.body;
    
    const updated = await prisma.teamCategory.update({
      where: { id: req.params.id },
      data: { name, sortOrder, isActive }
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Update team category error:', error);
    res.status(500).json({ error: 'Failed to update team category' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const category = await prisma.teamCategory.findUnique({ where: { id: req.params.id } });
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    const canDelete = hasTeamAccess(req.user, category.teamId, ['TEAM_MANAGER', 'COACH']) || isOperator(req.user);
    
    if (!canDelete) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await prisma.teamCategory.delete({ where: { id: req.params.id } });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete team category error:', error);
    res.status(500).json({ error: 'Failed to delete team category' });
  }
});

module.exports = router;
