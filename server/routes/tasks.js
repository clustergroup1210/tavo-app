const express = require('express');
const { authenticate, hasTeamAccess, canEvaluatePlayer } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');

const router = express.Router();
const prisma = require('../lib/prisma');

const ALLOWED_TYPES = ['EVALUATION', 'VIDEO', 'MEETING', 'GOAL', 'MENTORING', 'OTHER'];
const STAFF_ROLES = ['TEAM_MANAGER', 'COACH', 'GUEST_COACH'];
const RECURRENCE_FREQS = ['weekly', 'monthly'];
const MAX_RECURRENCE_OCCURRENCES = 24;

function generateRecurrenceDueDates(firstDueDate, recurrence) {
  if (!firstDueDate || !recurrence || !recurrence.freq || recurrence.freq === 'none') {
    return [firstDueDate];
  }
  const out = [];
  const cursor = new Date(firstDueDate);
  const until = new Date(recurrence.until);
  until.setHours(23, 59, 59, 999);
  while (cursor <= until && out.length < MAX_RECURRENCE_OCCURRENCES) {
    out.push(new Date(cursor));
    if (recurrence.freq === 'weekly') cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return out.length > 0 ? out : [firstDueDate];
}

function validateRecurrence(recurrence, dueDate) {
  if (!recurrence || !recurrence.freq || recurrence.freq === 'none') return null;
  if (!dueDate) return '繰り返しを設定するには期限の指定が必要です';
  if (!RECURRENCE_FREQS.includes(recurrence.freq)) return 'Invalid recurrence frequency';
  if (!recurrence.until) return '繰り返しの終了日を指定してください';
  const until = new Date(recurrence.until);
  if (isNaN(until.getTime())) return '繰り返しの終了日が不正です';
  const due = new Date(dueDate);
  until.setHours(23, 59, 59, 999);
  if (until < due) return '繰り返しの終了日は期限日以降にしてください';
  return null;
}

function recurrenceLabel(recurrence, count) {
  if (!recurrence || !recurrence.freq || count <= 1) return '';
  if (recurrence.freq === 'weekly') return `（毎週・全${count}回）`;
  if (recurrence.freq === 'monthly') return `（毎月・全${count}回）`;
  return '';
}

function isOperator(user) {
  return user.organizations?.some(o =>
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
  );
}

function safeTargetUrl(targetUrl) {
  return (typeof targetUrl === 'string' && targetUrl.startsWith('/') && !targetUrl.startsWith('//')) ? targetUrl : null;
}

const TASK_INCLUDE = {
  player: { select: { id: true, name: true, teamId: true, userId: true } },
  assignee: { select: { id: true, name: true } },
  team: { select: { id: true, name: true } },
  assigner: { select: { id: true, name: true } }
};

router.get('/', authenticate, async (req, res) => {
  try {
    const { playerId, teamId, status } = req.query;

    if (!isOperator(req.user) && !teamId && !playerId) {
      return res.status(400).json({ error: 'teamId or playerId is required' });
    }

    const where = {};
    if (playerId) where.playerId = playerId;
    if (status) where.status = status;

    if (teamId) {
      if (!isOperator(req.user) && !hasTeamAccess(req.user, teamId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      where.OR = [
        { player: { teamId } },
        { teamId }
      ];
    }

    if (playerId && !isOperator(req.user)) {
      const player = await prisma.player.findUnique({
        where: { id: playerId },
        select: { userId: true, teamId: true }
      });
      if (!player) return res.status(404).json({ error: 'Player not found' });
      const isSelf = player.userId === req.user.id;
      const isParent = req.user.parentPlayers?.some(pp => pp.playerId === playerId);
      const hasAccess = hasTeamAccess(req.user, player.teamId);
      if (!isSelf && !isParent && !hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: { createdAt: 'desc' }
    });

    res.json(tasks);
  } catch (error) {
    console.error('Fetch tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.get('/my-tasks', authenticate, async (req, res) => {
  try {
    const ownPlayers = await prisma.player.findMany({
      where: { userId: req.user.id },
      select: { id: true }
    });
    const childPlayerIds = (req.user.parentPlayers || []).map(pp => pp.playerId).filter(Boolean);
    const playerIds = Array.from(new Set([...ownPlayers.map(p => p.id), ...childPlayerIds]));

    const orClauses = [{ assigneeUserId: req.user.id }];
    if (playerIds.length > 0) orClauses.push({ playerId: { in: playerIds } });

    const tasks = await prisma.task.findMany({
      where: {
        OR: orClauses,
        status: { not: 'CANCELLED' }
      },
      include: TASK_INCLUDE,
      orderBy: [
        { status: 'asc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    res.json(tasks);
  } catch (error) {
    console.error('Fetch my tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.get('/player/:playerId', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    const { playerId } = req.params;

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { userId: true, teamId: true }
    });
    if (!player) return res.status(404).json({ error: 'Player not found' });

    if (!isOperator(req.user)) {
      const isSelf = player.userId === req.user.id;
      const isParent = req.user.parentPlayers?.some(pp => pp.playerId === playerId);
      const hasAccess = hasTeamAccess(req.user, player.teamId);
      if (!isSelf && !isParent && !hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const where = { playerId };
    if (status) where.status = status;

    const tasks = await prisma.task.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: [
        { status: 'asc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    res.json(tasks);
  } catch (error) {
    console.error('Fetch player tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { playerId, assigneeUserId, teamId, title, description, dueDate, targetType, targetUrl, recurrence } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if ((!playerId && !assigneeUserId) || (playerId && assigneeUserId)) {
      return res.status(400).json({ error: 'Provide exactly one of playerId or assigneeUserId' });
    }
    if (targetType && !ALLOWED_TYPES.includes(targetType)) {
      return res.status(400).json({ error: 'Invalid targetType' });
    }
    const recurrenceError = validateRecurrence(recurrence, dueDate);
    if (recurrenceError) return res.status(400).json({ error: recurrenceError });
    const safeUrl = safeTargetUrl(targetUrl);

    let createData = {
      assignedBy: req.user.id,
      title: title.trim(),
      description: description?.trim() || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      targetType: targetType || null,
      targetUrl: safeUrl
    };
    let notifyUserId = null;

    if (playerId) {
      const player = await prisma.player.findUnique({
        where: { id: playerId },
        select: { id: true, name: true, userId: true, teamId: true }
      });
      if (!player) return res.status(404).json({ error: 'Player not found' });

      const canAssign = isOperator(req.user) || await canEvaluatePlayer(req.user, playerId, player.teamId);
      if (!canAssign) {
        return res.status(403).json({ error: 'この選手にタスクを設定する権限がありません' });
      }
      createData.playerId = playerId;
      notifyUserId = player.userId;
    } else if (assigneeUserId === req.user.id) {
      createData.assigneeUserId = req.user.id;
      if (teamId) {
        if (!isOperator(req.user) && !hasTeamAccess(req.user, teamId)) {
          return res.status(403).json({ error: 'このチームへのアクセス権がありません' });
        }
        createData.teamId = teamId;
      }
      notifyUserId = null;
    } else {
      if (!teamId) {
        return res.status(400).json({ error: 'teamId is required when assigning to a staff user' });
      }
      const assignee = await prisma.user.findUnique({
        where: { id: assigneeUserId },
        select: { id: true, name: true, teams: { select: { teamId: true, role: true } } }
      });
      if (!assignee) return res.status(404).json({ error: 'Assignee not found' });

      const assigneeTeamRole = (assignee.teams || []).find(t => t.teamId === teamId);
      if (!assigneeTeamRole || !STAFF_ROLES.includes(assigneeTeamRole.role)) {
        return res.status(400).json({ error: '担当者はそのチームのスタッフである必要があります' });
      }

      const canAssign = isOperator(req.user) || hasTeamAccess(req.user, teamId, ['TEAM_MANAGER', 'COACH']);
      if (!canAssign) {
        return res.status(403).json({ error: 'このチームのスタッフにタスクを設定する権限がありません' });
      }
      createData.assigneeUserId = assigneeUserId;
      createData.teamId = teamId;
      notifyUserId = assigneeUserId;
    }

    const occurrences = generateRecurrenceDueDates(createData.dueDate, recurrence);
    const seriesId = occurrences.length > 1 ? require('crypto').randomUUID() : null;

    const created = await prisma.$transaction(
      occurrences.map((due) =>
        prisma.task.create({
          data: { ...createData, dueDate: due, seriesId },
          include: TASK_INCLUDE,
        })
      )
    );

    if (notifyUserId) {
      const suffix = recurrenceLabel(recurrence, occurrences.length);
      await createNotification({
        userId: notifyUserId,
        type: 'TASK',
        title: '新しいタスクが設定されました',
        message: `${req.user.name}さんからタスク「${title}」が設定されました${suffix}`,
        linkUrl: playerId ? `/player-dashboard?tab=tasks` : `/dashboard`
      }).catch((err) => console.error('Notify failed:', err));
    }

    if (seriesId) {
      res.json({ ...created[0], _series: { count: created.length, seriesId } });
    } else {
      res.json(created[0]);
    }
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.post('/bulk-by-category', authenticate, async (req, res) => {
  try {
    const { teamCategoryId, title, description, dueDate, targetType, targetUrl, recurrence } = req.body;

    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    if (!teamCategoryId) return res.status(400).json({ error: 'teamCategoryId is required' });
    if (targetType && !ALLOWED_TYPES.includes(targetType)) {
      return res.status(400).json({ error: 'Invalid targetType' });
    }
    const recurrenceError = validateRecurrence(recurrence, dueDate);
    if (recurrenceError) return res.status(400).json({ error: recurrenceError });

    const category = await prisma.teamCategory.findUnique({
      where: { id: teamCategoryId },
      select: { id: true, name: true, teamId: true, isActive: true },
    });
    if (!category || !category.isActive) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const canAssign =
      isOperator(req.user) ||
      hasTeamAccess(req.user, category.teamId, ['TEAM_MANAGER', 'COACH']);
    if (!canAssign) {
      return res.status(403).json({ error: 'このカテゴリーにタスクを設定する権限がありません' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const players = await prisma.player.findMany({
      where: {
        teamCategoryId,
        deletedAt: null,
        OR: [{ graduationDate: null }, { graduationDate: { gt: today } }],
      },
      select: { id: true, name: true, userId: true },
    });

    if (players.length === 0) {
      return res.status(400).json({ error: 'このカテゴリーに在籍中の選手がいません' });
    }

    const baseData = {
      assignedBy: req.user.id,
      title: title.trim(),
      description: description?.trim() || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      targetType: targetType || null,
      targetUrl: safeTargetUrl(targetUrl),
    };

    const occurrences = generateRecurrenceDueDates(baseData.dueDate, recurrence);
    const totalToCreate = players.length * occurrences.length;
    if (totalToCreate > 1000) {
      return res.status(400).json({ error: `作成タスク数が多すぎます（${totalToCreate}件）。期間を短くするか選手を絞ってください。` });
    }
    const isRecurring = occurrences.length > 1;

    const ops = [];
    for (const p of players) {
      // Distinct seriesId per player so PUT/DELETE ?scope=series only affects
      // that player's series, not the entire bulk-created cohort.
      const playerSeriesId = isRecurring ? require('crypto').randomUUID() : null;
      for (const due of occurrences) {
        ops.push(
          prisma.task.create({
            data: { ...baseData, dueDate: due, playerId: p.id, seriesId: playerSeriesId },
            include: TASK_INCLUDE,
          })
        );
      }
    }
    const created = await prisma.$transaction(ops);

    const suffix = recurrenceLabel(recurrence, occurrences.length);
    const notifyTargets = players.filter((p) => p.userId);
    await Promise.all(
      notifyTargets.map((p) =>
        createNotification({
          userId: p.userId,
          type: 'TASK',
          title: '新しいタスクが設定されました',
          message: `${req.user.name}さんからタスク「${title.trim()}」が設定されました（${category.name}）${suffix}`,
          linkUrl: '/player-dashboard?tab=tasks',
        }).catch((err) => console.error('Notify failed:', err))
      )
    );

    res.json({ count: created.length, categoryName: category.name, tasks: created });
  } catch (error) {
    console.error('Bulk create tasks by category error:', error);
    res.status(500).json({ error: 'Failed to create tasks' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { title, description, dueDate, status, targetType, targetUrl } = req.body;
    if (targetType !== undefined && targetType !== null && !ALLOWED_TYPES.includes(targetType)) {
      return res.status(400).json({ error: 'Invalid targetType' });
    }

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        player: { select: { id: true, userId: true, teamId: true } }
      }
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const isAssigner = task.assignedBy === req.user.id;
    const isAssigneePlayer = task.player?.userId === req.user.id;
    const isAssigneeUser = task.assigneeUserId === req.user.id;
    const isParent = task.player && (req.user.parentPlayers || []).some(pp => pp.playerId === task.player.id);
    const scopeTeamId = task.player?.teamId || task.teamId;
    const isCoach = scopeTeamId && hasTeamAccess(req.user, scopeTeamId, ['TEAM_MANAGER', 'COACH']);
    const isOp = isOperator(req.user);
    const canEditMeta = isAssigner || isCoach || isOp;
    const canChangeStatus = canEditMeta || isAssigneePlayer || isAssigneeUser || isParent;

    if (!canChangeStatus) return res.status(403).json({ error: 'Access denied' });

    const seriesScope = req.query.scope === 'series' && task.seriesId;
    if (seriesScope && !canEditMeta) {
      return res.status(403).json({ error: 'シリーズ全体を編集する権限がありません' });
    }

    const metaUpdate = {};
    if (canEditMeta) {
      if (title !== undefined) metaUpdate.title = title.trim();
      if (description !== undefined) metaUpdate.description = description?.trim() || null;
      if (targetType !== undefined) metaUpdate.targetType = targetType || null;
      if (targetUrl !== undefined) metaUpdate.targetUrl = safeTargetUrl(targetUrl);
    }
    const singleUpdate = { ...metaUpdate };
    if (canEditMeta && dueDate !== undefined) singleUpdate.dueDate = dueDate ? new Date(dueDate) : null;
    if (status !== undefined) {
      singleUpdate.status = status;
      if (status === 'COMPLETED' && !task.completedAt) {
        singleUpdate.completedAt = new Date();
      }
    }

    if (Object.keys(singleUpdate).length === 0) {
      return res.status(400).json({ error: 'No updatable fields' });
    }

    if (seriesScope) {
      // Apply meta to all open siblings; status changes are NOT propagated across series.
      if (Object.keys(metaUpdate).length > 0) {
        await prisma.task.updateMany({
          where: { seriesId: task.seriesId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
          data: metaUpdate,
        });
      }
      // Always apply the single-task update (including status) to the targeted task.
      const updated = await prisma.task.update({
        where: { id: req.params.id },
        data: singleUpdate,
        include: TASK_INCLUDE,
      });
      return res.json(updated);
    }

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: singleUpdate,
      include: TASK_INCLUDE
    });

    if (
      status === 'COMPLETED' &&
      !task.completedAt &&
      task.assignedBy &&
      task.assignedBy !== req.user.id
    ) {
      const completerName = updated.assignee?.name || updated.player?.name || req.user.name;
      await createNotification({
        userId: task.assignedBy,
        type: 'TASK',
        title: 'タスクが完了しました',
        message: `${completerName}さんが「${updated.title}」を完了しました`,
        linkUrl: '/dashboard'
      });
    }

    res.json(updated);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { player: { select: { teamId: true } } }
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const isAssigner = task.assignedBy === req.user.id;
    const scopeTeamId = task.player?.teamId || task.teamId;
    const isCoach = scopeTeamId && hasTeamAccess(req.user, scopeTeamId, ['TEAM_MANAGER', 'COACH']);
    const isOp = isOperator(req.user);

    if (!isAssigner && !isCoach && !isOp) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.query.scope === 'series' && task.seriesId) {
      const result = await prisma.task.deleteMany({ where: { seriesId: task.seriesId } });
      return res.json({ success: true, deletedCount: result.count });
    }

    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
