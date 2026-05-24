const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');

const prisma = require('../lib/prisma');

function hasTeamAccess(user, teamId, roles) {
  return user.teams?.some(ut => ut.teamId === teamId && roles.includes(ut.role));
}

function isOperator(user) {
  return user.organizations?.some(o => 
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
  );
}

async function rememberEventLocation(teamId, location, locationAddress, userId) {
  if (!teamId) return;
  const name = typeof location === 'string' ? location.trim() : '';
  if (!name) return;
  const address = typeof locationAddress === 'string' ? locationAddress.trim() : '';
  try {
    const existing = await prisma.eventLocation.findUnique({
      where: { teamId_name: { teamId, name } },
    }).catch(() => null);
    if (existing) {
      if (address && address !== (existing.address || '')) {
        await prisma.eventLocation.update({
          where: { id: existing.id },
          data: { address },
        });
      }
      return;
    }
    await prisma.eventLocation.create({
      data: { teamId, name, address: address || null, createdBy: userId },
    });
  } catch (err) {
    if (err?.code !== 'P2002') {
      console.warn('rememberEventLocation failed:', err?.message || err);
    }
  }
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
    
    const orFilters = [
      { teamId: { in: userTeamIds }, isPersonal: false },
      { isPersonal: true, createdBy: user.id }
    ];
    if (userOrgIds.length > 0) {
      orFilters.push({ organizationId: { in: userOrgIds }, teamId: null, isPersonal: false });
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
      if (event.isPersonal) {
        return true;
      }
      
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

router.get('/personal', authenticate, async (req, res) => {
  try {
    const { month, year } = req.query;
    
    let where = { isPersonal: true, createdBy: req.user.id };
    
    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      where.startDate = { gte: startDate, lte: endDate };
    }
    
    const events = await prisma.calendarEvent.findMany({
      where,
      include: {
        author: { select: { id: true, name: true } }
      },
      orderBy: { startDate: 'asc' }
    });
    
    res.json(events);
  } catch (error) {
    console.error('Get personal calendar events error:', error);
    res.status(500).json({ error: 'Failed to fetch personal events' });
  }
});

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function generateRecurrenceDates(startDate, endDate, recurrence) {
  if (!recurrence || !recurrence.freq || recurrence.freq === 'none') {
    return [{ start: startDate, end: endDate }];
  }
  const freq = recurrence.freq;
  if (!['daily', 'weekly', 'monthly'].includes(freq)) {
    return [{ start: startDate, end: endDate }];
  }
  const until = recurrence.until ? new Date(recurrence.until) : null;
  if (!until || isNaN(until.getTime())) {
    return [{ start: startDate, end: endDate }];
  }
  until.setHours(23, 59, 59, 999);
  if (until < startDate) {
    return [{ start: startDate, end: endDate }];
  }
  const MAX_OCC = 366;
  const out = [];
  const durationMs = endDate ? (endDate.getTime() - startDate.getTime()) : 0;
  let cursor = new Date(startDate);
  while (cursor <= until && out.length < MAX_OCC) {
    const s = new Date(cursor);
    const e = endDate ? new Date(s.getTime() + durationMs) : null;
    out.push({ start: s, end: e });
    if (freq === 'daily') cursor.setDate(cursor.getDate() + 1);
    else if (freq === 'weekly') cursor.setDate(cursor.getDate() + 7);
    else if (freq === 'monthly') cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

router.post('/', authenticate, async (req, res) => {
  try {
    const { teamId, organizationId, title, description, startDate, endDate, allDay, eventType, location, locationAddress, categoryIds, isPersonal, color, recurrence } = req.body;

    const safeColor = (typeof color === 'string' && HEX_RE.test(color)) ? color : null;
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    const occurrences = generateRecurrenceDates(start, end, recurrence);
    const seriesId = occurrences.length > 1 ? require('crypto').randomUUID() : null;

    if (isPersonal) {
      const created = await prisma.$transaction(
        occurrences.map(occ => prisma.calendarEvent.create({
          data: {
            title,
            description,
            startDate: occ.start,
            endDate: occ.end,
            allDay: allDay || false,
            eventType: eventType || 'personal',
            location,
            locationAddress: locationAddress || null,
            isPersonal: true,
            color: safeColor,
            seriesId,
            createdBy: req.user.id
          },
          include: { author: { select: { id: true, name: true } } }
        }))
      );
      return res.status(201).json(created[0]);
    }
    
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

    const orgIdResolved = organizationId || (isOperator(req.user) && !teamId ? req.user.organizations[0]?.organizationId : null);

    const created = await prisma.$transaction(
      occurrences.map(occ => prisma.calendarEvent.create({
        data: {
          teamId,
          organizationId: orgIdResolved,
          title,
          description,
          startDate: occ.start,
          endDate: occ.end,
          allDay: allDay || false,
          eventType: eventType || 'event',
          location,
          locationAddress: locationAddress || null,
          color: safeColor,
          seriesId,
          createdBy: req.user.id,
          categoryTargets: categoryIds && categoryIds.length > 0 ? {
            create: categoryIds.map(categoryId => ({ teamCategoryId: categoryId }))
          } : undefined
        },
        include: {
          team: { select: { id: true, name: true } },
          author: { select: { id: true, name: true } },
          categoryTargets: {
            include: { teamCategory: { select: { id: true, name: true } } }
          }
        }
      }))
    );

    if (teamId) {
      sendCalendarNotifications(teamId, created[0], req.user, categoryIds, 'created');
      rememberEventLocation(teamId, location, locationAddress, req.user.id);
    }

    res.status(201).json({ event: created[0], count: created.length, seriesId });
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
        userId: { not: null },
        deletedAt: null
      },
      select: { userId: true, teamCategoryId: true }
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
        if (!player.teamCategoryId || !categoryIds.includes(player.teamCategoryId)) {
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
    
    const canEdit = event.isPersonal 
      ? event.createdBy === req.user.id
      : (event.teamId 
        ? (hasTeamAccess(req.user, event.teamId, ['TEAM_MANAGER', 'COACH']) || isOperator(req.user))
        : isOperator(req.user));
    
    if (!canEdit) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { title, description, startDate, endDate, allDay, eventType, location, locationAddress, categoryIds, color } = req.body;
    const scope = req.query.scope === 'series' && event.seriesId ? 'series' : 'single';
    const safeColor = color === null ? null : (typeof color === 'string' && HEX_RE.test(color)) ? color : undefined;

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

      const seriesScopeWhere = event.isPersonal
        ? { seriesId: event.seriesId, isPersonal: true, createdBy: req.user.id }
        : { seriesId: event.seriesId, teamId: event.teamId };
      const targetIds = scope === 'series'
        ? (await prisma.calendarEvent.findMany({ where: seriesScopeWhere, select: { id: true } })).map(e => e.id)
        : [req.params.id];

      await prisma.calendarEventCategoryTarget.deleteMany({
        where: { calendarEventId: { in: targetIds } }
      });

      if (Array.isArray(categoryIds) && categoryIds.length > 0) {
        await prisma.calendarEventCategoryTarget.createMany({
          data: targetIds.flatMap(eid => categoryIds.map(categoryId => ({
            calendarEventId: eid,
            teamCategoryId: categoryId
          })))
        });
      }
    }

    if (scope === 'series') {
      await prisma.calendarEvent.updateMany({
        where: event.isPersonal
          ? { seriesId: event.seriesId, isPersonal: true, createdBy: req.user.id }
          : { seriesId: event.seriesId, teamId: event.teamId },
        data: {
          title,
          description,
          allDay,
          eventType,
          location,
          ...(locationAddress !== undefined && { locationAddress: locationAddress || null }),
          ...(safeColor !== undefined && { color: safeColor })
        }
      });
    }

    const updated = await prisma.calendarEvent.update({
      where: { id: req.params.id },
      data: {
        title,
        description,
        ...(scope === 'series'
          ? {}
          : {
              startDate: startDate ? new Date(startDate) : undefined,
              endDate: endDate ? new Date(endDate) : null,
            }),
        allDay,
        eventType,
        location,
        ...(locationAddress !== undefined && { locationAddress: locationAddress || null }),
        ...(safeColor !== undefined && { color: safeColor })
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
      rememberEventLocation(event.teamId, location, locationAddress, req.user.id);
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
    
    const canDelete = event.isPersonal
      ? event.createdBy === req.user.id
      : (event.teamId 
        ? (hasTeamAccess(req.user, event.teamId, ['TEAM_MANAGER', 'COACH']) || isOperator(req.user))
        : isOperator(req.user));
    
    if (!canDelete) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.query.scope === 'series' && event.seriesId) {
      const where = event.isPersonal
        ? { seriesId: event.seriesId, isPersonal: true, createdBy: req.user.id }
        : { seriesId: event.seriesId, teamId: event.teamId };
      const result = await prisma.calendarEvent.deleteMany({ where });
      return res.json({ success: true, deleted: result.count });
    }

    await prisma.calendarEvent.delete({ where: { id: req.params.id } });

    res.json({ success: true, deleted: 1 });
  } catch (error) {
    console.error('Delete calendar event error:', error);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
});

module.exports = router;
