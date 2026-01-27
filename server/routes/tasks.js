const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, hasTeamAccess, canEvaluatePlayer } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');

const router = express.Router();
const prisma = new PrismaClient();

function isOperator(user) {
  return user.organizations?.some(o => 
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
  );
}

router.get('/', authenticate, async (req, res) => {
  try {
    const { playerId, teamId, status } = req.query;

    const where = {};
    if (playerId) where.playerId = playerId;
    if (status) where.status = status;

    if (teamId) {
      where.player = { teamId };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        player: { select: { id: true, name: true, teamId: true, userId: true } },
        assigner: { select: { id: true, name: true } }
      },
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
    const player = await prisma.player.findFirst({
      where: { userId: req.user.id }
    });

    if (!player) {
      return res.json([]);
    }

    const tasks = await prisma.task.findMany({
      where: { 
        playerId: player.id,
        status: { not: 'CANCELLED' }
      },
      include: {
        assigner: { select: { id: true, name: true } }
      },
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
    
    const where = { playerId: req.params.playerId };
    if (status) where.status = status;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assigner: { select: { id: true, name: true } }
      },
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
    const { playerId, title, description, dueDate } = req.body;

    if (!playerId || !title?.trim()) {
      return res.status(400).json({ error: 'Player ID and title are required' });
    }

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true, name: true, userId: true, teamId: true }
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const canAssign = isOperator(req.user) || 
      await canEvaluatePlayer(req.user, playerId);

    if (!canAssign) {
      return res.status(403).json({ error: 'この選手に課題を設定する権限がありません' });
    }

    const task = await prisma.task.create({
      data: {
        playerId,
        assignedBy: req.user.id,
        title: title.trim(),
        description: description?.trim() || null,
        dueDate: dueDate ? new Date(dueDate) : null
      },
      include: {
        player: { select: { id: true, name: true } },
        assigner: { select: { id: true, name: true } }
      }
    });

    if (player.userId) {
      await createNotification({
        userId: player.userId,
        type: 'TASK',
        title: '新しい課題が設定されました',
        message: `${req.user.name}さんから課題「${title}」が設定されました`,
        linkUrl: `/player-dashboard?tab=tasks`
      });
    }

    res.json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { title, description, dueDate, status } = req.body;

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { player: { select: { id: true, userId: true, teamId: true } } }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const isAssigner = task.assignedBy === req.user.id;
    const isPlayer = task.player.userId === req.user.id;
    const isCoach = hasTeamAccess(req.user, task.player.teamId, ['TEAM_MANAGER', 'COACH']);
    const isOp = isOperator(req.user);

    if (!isAssigner && !isPlayer && !isCoach && !isOp) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date();
      } else {
        updateData.completedAt = null;
      }
    }

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        player: { select: { id: true, name: true } },
        assigner: { select: { id: true, name: true } }
      }
    });

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

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const isAssigner = task.assignedBy === req.user.id;
    const isCoach = hasTeamAccess(req.user, task.player.teamId, ['TEAM_MANAGER', 'COACH']);
    const isOp = isOperator(req.user);

    if (!isAssigner && !isCoach && !isOp) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.task.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
