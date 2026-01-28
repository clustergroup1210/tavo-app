const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');

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
    const { teamId, month, year } = req.query;
    const user = req.user;
    
    const userTeamIds = user.teams?.map(t => t.teamId) || [];
    const userOrgIds = user.organizations?.map(o => o.organizationId) || [];
    
    let where = {};
    
    if (teamId) {
      where.teamId = teamId;
    } else {
      const orFilters = [{ teamId: { in: userTeamIds } }];
      if (userOrgIds.length > 0) {
        orFilters.push({ organizationId: { in: userOrgIds }, teamId: null });
      }
      where.OR = orFilters;
    }
    
    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      where.startDate = { gte: startDate, lte: endDate };
    }
    
    const events = await prisma.calendarEvent.findMany({
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
      orderBy: { startDate: 'asc' }
    });
    
    res.json(events);
  } catch (error) {
    console.error('Get calendar events error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

router.get('/my', authenticate, async (req, res) => {
  try {
    const { month, year, teamId } = req.query;
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
    
    if (teamId && !userTeamIds.includes(teamId)) {
      if (isOperator(user) || hasTeamAccess(user, teamId, ['TEAM_MANAGER', 'COACH', 'COACH'])) {
        userTeamIds.push(teamId);
      }
    }
    
    const orFilters = [{ teamId: { in: userTeamIds } }];
    if (userOrgIds.length > 0) {
      orFilters.push({ organizationId: { in: userOrgIds }, teamId: null });
    }
    let where = { OR: orFilters };
    
    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      where.startDate = { gte: startDate, lte: endDate };
    }
    
    const events = await prisma.calendarEvent.findMany({
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
      orderBy: { startDate: 'asc' }
    });
    
    const filteredEvents = events.filter(event => {
      if (event.categoryTargets.length === 0) {
        return true;
      }
      
      if (!player || !player.teamCategoryId) {
        if (isOperator(user) || user.teams?.some(ut => 
          ut.teamId === event.teamId && 
          ['TEAM_MANAGER', 'COACH', 'COACH'].includes(ut.role)
        )) {
          return true;
        }
        return false;
      }
      
      return event.categoryTargets.some(
        ct => ct.teamCategoryId === player.teamCategoryId
      );
    });
    
    res.json(filteredEvents);
  } catch (error) {
    console.error('Get my calendar events error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { teamId, organizationId, title, description, startDate, endDate, allDay, eventType, location, categoryIds } = req.body;
    
    const canCreate = teamId 
      ? (hasTeamAccess(req.user, teamId, ['TEAM_MANAGER', 'COACH']) || isOperator(req.user))
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
    
    const event = await prisma.calendarEvent.create({
      data: {
        teamId,
        organizationId: organizationId || (isOperator(req.user) && !teamId ? req.user.organizations[0]?.organizationId : null),
        title,
        description,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        allDay: allDay || false,
        eventType: eventType || 'event',
        location,
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
    
    if (teamId) {
      sendCalendarNotifications(teamId, event, req.user, categoryIds, 'created');
    }
    
    res.status(201).json(event);
  } catch (error) {
    console.error('Create calendar event error:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

async function sendCalendarNotifications(teamId, event, author, categoryIds, action) {
  try {
    const players = await prisma.player.findMany({
      where: { 
        teamId,
        userId: { not: null }
      },
      include: { category: true }
    });
    
    const coaches = await prisma.userTeam.findMany({
      where: {
        teamId,
        role: { in: ['TEAM_MANAGER', 'COACH', 'GUEST_COACH'] },
        userId: { not: author.id }
      },
      select: { userId: true }
    });
    
    const startDateStr = new Date(event.startDate).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    
    const actionText = action === 'created' ? '追加' : '更新';
    const title = `カレンダーが${actionText}されました`;
    const message = `${author.name}さんが「${event.title}」（${startDateStr}）を${actionText}しました`;
    
    for (const player of players) {
      if (!player.userId) continue;
      
      if (categoryIds && categoryIds.length > 0) {
        if (!player.categoryId || !categoryIds.includes(player.categoryId)) {
          continue;
        }
      }
      
      createNotification({
        userId: player.userId,
        type: 'CALENDAR',
        title,
        message,
        linkUrl: '/calendar'
      });
    }
    
    for (const coach of coaches) {
      createNotification({
        userId: coach.userId,
        type: 'CALENDAR',
        title,
        message,
        linkUrl: '/calendar'
      });
    }
  } catch (error) {
    console.error('Failed to send calendar notifications:', error);
  }
}

router.put('/:id', authenticate, async (req, res) => {
  try {
    const event = await prisma.calendarEvent.findUnique({ where: { id: req.params.id } });
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const canEdit = event.teamId 
      ? (hasTeamAccess(req.user, event.teamId, ['TEAM_MANAGER', 'COACH']) || isOperator(req.user))
      : isOperator(req.user);
    
    if (!canEdit) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { title, description, startDate, endDate, allDay, eventType, location, categoryIds } = req.body;
    
    if (categoryIds !== undefined && event.teamId) {
      if (Array.isArray(categoryIds) && categoryIds.length > 0) {
        const categories = await prisma.teamCategory.findMany({
          where: { id: { in: categoryIds } }
        });
        const invalidCategories = categories.filter(c => c.teamId !== event.teamId);
        if (invalidCategories.length > 0) {
          return res.status(400).json({ error: 'Categories must belong to the same team' });
        }
      }
      
      await prisma.calendarEventCategoryTarget.deleteMany({
        where: { calendarEventId: req.params.id }
      });
      
      if (Array.isArray(categoryIds) && categoryIds.length > 0) {
        await prisma.calendarEventCategoryTarget.createMany({
          data: categoryIds.map(categoryId => ({
            calendarEventId: req.params.id,
            teamCategoryId: categoryId
          }))
        });
      }
    }
    
    const updated = await prisma.calendarEvent.update({
      where: { id: req.params.id },
      data: {
        title,
        description,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : null,
        allDay,
        eventType,
        location
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
    
    if (event.teamId) {
      const targetCategoryIds = updated.categoryTargets?.map(ct => ct.teamCategoryId) || [];
      sendCalendarNotifications(event.teamId, updated, req.user, targetCategoryIds, 'updated');
    }
    
    res.json(updated);
  } catch (error) {
    console.error('Update calendar event error:', error);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const event = await prisma.calendarEvent.findUnique({ where: { id: req.params.id } });
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const canDelete = event.teamId 
      ? (hasTeamAccess(req.user, event.teamId, ['TEAM_MANAGER', 'COACH']) || isOperator(req.user))
      : isOperator(req.user);
    
    if (!canDelete) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await prisma.calendarEvent.delete({ where: { id: req.params.id } });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete calendar event error:', error);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
});

module.exports = router;
