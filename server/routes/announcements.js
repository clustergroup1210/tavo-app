const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();

function hasTeamAccess(user, teamId, roles) {
  return user.teams?.some(ut => ut.teamId === teamId && roles.includes(ut.role));
}

function isOperator(user) {
  return user.organizations?.some(o => 
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
  );
}

router.get('/', authenticate, async (req, res) => {
  try {
    const { teamId, limit } = req.query;
    const user = req.user;
    
    const userTeamIds = user.teams?.map(t => t.teamId) || [];
    const userOrgIds = user.organizations?.map(o => o.organizationId) || [];
    
    let where = { isPublished: true };
    
    if (teamId) {
      if (!userTeamIds.includes(teamId) && !isOperator(user)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      where.teamId = teamId;
    } else {
      const orFilters = [{ teamId: { in: userTeamIds } }];
      if (userOrgIds.length > 0) {
        orFilters.push({ organizationId: { in: userOrgIds }, teamId: null });
      }
      where.OR = orFilters;
    }
    
    where.AND = [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }
    ];
    
    const announcements = await prisma.announcement.findMany({
      where,
      include: {
        team: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
        categoryTargets: {
          include: {
            teamCategory: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: limit ? parseInt(limit) : undefined
    });
    
    res.json(announcements);
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

router.get('/my', authenticate, async (req, res) => {
  try {
    const { limit } = req.query;
    const user = req.user;
    
    const userTeamIds = user.teams?.map(t => t.teamId) || [];
    const userOrgIds = user.organizations?.map(o => o.organizationId) || [];
    
    const player = await prisma.player.findFirst({
      where: { userId: user.id },
      include: { team: { include: { parent: true } } }
    });
    
    if (player) {
      if (player.teamId && !userTeamIds.includes(player.teamId)) {
        userTeamIds.push(player.teamId);
      }
      if (player.team?.parentId && !userTeamIds.includes(player.team.parentId)) {
        userTeamIds.push(player.team.parentId);
      }
    }
    
    const orFilters = [{ teamId: { in: userTeamIds } }];
    if (userOrgIds.length > 0) {
      orFilters.push({ organizationId: { in: userOrgIds }, teamId: null });
    }
    let where = {
      isPublished: true,
      OR: orFilters,
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }
      ]
    };
    
    const announcements = await prisma.announcement.findMany({
      where,
      include: {
        team: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
        categoryTargets: {
          include: {
            teamCategory: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: limit ? parseInt(limit) : 20
    });
    
    const filteredAnnouncements = announcements.filter(announcement => {
      if (announcement.categoryTargets.length === 0) {
        return true;
      }
      
      if (!player || !player.teamCategoryId) {
        if (isOperator(user) || user.teams?.some(ut => 
          ut.teamId === announcement.teamId && 
          ['TEAM_MANAGER', 'COACH', 'COACH'].includes(ut.role)
        )) {
          return true;
        }
        return false;
      }
      
      return announcement.categoryTargets.some(
        ct => ct.teamCategoryId === player.teamCategoryId
      );
    });
    
    res.json(filteredAnnouncements);
  } catch (error) {
    console.error('Get my announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

router.get('/manage', authenticate, async (req, res) => {
  try {
    const { teamId } = req.query;
    
    const canManage = teamId 
      ? hasTeamAccess(req.user, teamId, ['TEAM_MANAGER', 'COACH'])
      : isOperator(req.user);
    
    if (!canManage) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    let where = {};
    if (teamId) {
      where.teamId = teamId;
    } else if (isOperator(req.user)) {
      const userOrgIds = req.user.organizations?.map(o => o.organizationId) || [];
      if (userOrgIds.length > 0) {
        where.organizationId = { in: userOrgIds };
        where.teamId = null;
      }
    }
    
    const announcements = await prisma.announcement.findMany({
      where,
      include: {
        team: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
        categoryTargets: {
          include: {
            teamCategory: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(announcements);
  } catch (error) {
    console.error('Get manage announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { teamId, organizationId, title, content, priority, isPublished, publishedAt, expiresAt, categoryIds } = req.body;
    
    const canCreate = teamId 
      ? hasTeamAccess(req.user, teamId, ['TEAM_MANAGER', 'COACH'])
      : isOperator(req.user);
    
    if (!canCreate) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (categoryIds && categoryIds.length > 0 && teamId) {
      const categories = await prisma.teamCategory.findMany({
        where: { id: { in: categoryIds } }
      });
      const invalidCategories = categories.filter(c => c.teamId !== teamId);
      if (invalidCategories.length > 0) {
        return res.status(400).json({ error: 'Categories must belong to the same team' });
      }
    }
    
    const announcement = await prisma.announcement.create({
      data: {
        teamId,
        organizationId: organizationId || (isOperator(req.user) && !teamId ? req.user.organizations[0]?.organizationId : null),
        title,
        content,
        priority: priority || 'normal',
        isPublished: isPublished !== false,
        publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: req.user.id,
        categoryTargets: categoryIds && categoryIds.length > 0 ? {
          create: categoryIds.map(categoryId => ({ teamCategoryId: categoryId }))
        } : undefined
      },
      include: {
        team: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
        categoryTargets: {
          include: {
            teamCategory: { select: { id: true, name: true } }
          }
        }
      }
    });
    
    res.status(201).json(announcement);
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const announcement = await prisma.announcement.findUnique({ 
      where: { id: req.params.id },
      include: { categoryTargets: true }
    });
    
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    
    const canEdit = announcement.teamId 
      ? hasTeamAccess(req.user, announcement.teamId, ['TEAM_MANAGER', 'COACH'])
      : isOperator(req.user);
    
    if (!canEdit) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { title, content, priority, isPublished, expiresAt, categoryIds } = req.body;
    
    if (categoryIds !== undefined && announcement.teamId) {
      if (Array.isArray(categoryIds) && categoryIds.length > 0) {
        const categories = await prisma.teamCategory.findMany({
          where: { id: { in: categoryIds } }
        });
        const invalidCategories = categories.filter(c => c.teamId !== announcement.teamId);
        if (invalidCategories.length > 0) {
          return res.status(400).json({ error: 'Categories must belong to the same team' });
        }
      }
      
      await prisma.announcementCategoryTarget.deleteMany({
        where: { announcementId: req.params.id }
      });
      
      if (Array.isArray(categoryIds) && categoryIds.length > 0) {
        await prisma.announcementCategoryTarget.createMany({
          data: categoryIds.map(categoryId => ({
            announcementId: req.params.id,
            teamCategoryId: categoryId
          }))
        });
      }
    }
    
    const updated = await prisma.announcement.update({
      where: { id: req.params.id },
      data: {
        title,
        content,
        priority,
        isPublished,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      },
      include: {
        team: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
        categoryTargets: {
          include: {
            teamCategory: { select: { id: true, name: true } }
          }
        }
      }
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const announcement = await prisma.announcement.findUnique({ where: { id: req.params.id } });
    
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    
    const canDelete = announcement.teamId 
      ? hasTeamAccess(req.user, announcement.teamId, ['TEAM_MANAGER', 'COACH'])
      : isOperator(req.user);
    
    if (!canDelete) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await prisma.announcement.delete({ where: { id: req.params.id } });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

module.exports = router;
