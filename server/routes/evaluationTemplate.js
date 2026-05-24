const express = require('express');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = require('../lib/prisma');

const TEMPLATE_TEAM_NAME = 'VEDIALO CF';

router.get('/templates', authenticate, async (req, res) => {
  try {
    const templateTeams = await prisma.team.findMany({
      where: {
        evaluationItems: { some: {} },
        players: { none: {} },
        children: { none: {} }
      },
      select: {
        id: true,
        name: true,
        description: true,
        _count: { select: { evaluationItems: true } }
      }
    });

    const result = [];
    for (const tt of templateTeams) {
      const categories = await prisma.evaluationItem.findMany({
        where: { teamId: tt.id, parentId: null, isActive: true },
        include: {
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' }
          }
        },
        orderBy: { sortOrder: 'asc' }
      });
      result.push({
        id: tt.id,
        name: tt.name,
        description: tt.description,
        totalItems: tt._count.evaluationItems,
        categories: categories.map(c => ({
          id: c.id,
          name: c.name,
          children: c.children.map(ch => ({
            id: ch.id,
            name: ch.name,
            maxScore: ch.maxScore,
            description: ch.description
          }))
        }))
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Template list error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

router.post('/apply', authenticate, async (req, res) => {
  try {
    const { templateTeamId, targetTeamId } = req.body;

    if (!templateTeamId || !targetTeamId) {
      return res.status(400).json({ error: 'templateTeamId and targetTeamId are required' });
    }

    const isOp = req.user.organizations?.some(o =>
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );
    const isTeamAdmin = req.user.teams?.some(t =>
      t.teamId === targetTeamId && ['TEAM_MANAGER'].includes(t.role)
    );
    if (!isOp && !isTeamAdmin) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const templateCategories = await prisma.evaluationItem.findMany({
      where: { teamId: templateTeamId, parentId: null, isActive: true },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' }
        }
      },
      orderBy: { sortOrder: 'asc' }
    });

    if (templateCategories.length === 0) {
      return res.status(404).json({ error: 'No template items found' });
    }

    const existingItems = await prisma.evaluationItem.findMany({
      where: { teamId: targetTeamId }
    });

    if (existingItems.length > 0) {
      return res.status(400).json({
        error: 'Target team already has evaluation items. Delete existing items first or use manual management.',
        existingCount: existingItems.length
      });
    }

    const created = [];
    for (const cat of templateCategories) {
      const newCat = await prisma.evaluationItem.create({
        data: {
          teamId: targetTeamId,
          name: cat.name,
          description: cat.description,
          maxScore: cat.maxScore,
          sortOrder: cat.sortOrder,
          isActive: true,
          originalItemId: cat.id,
          targetPositions: cat.targetPositions
        }
      });
      created.push(newCat);

      for (const child of cat.children) {
        const newChild = await prisma.evaluationItem.create({
          data: {
            teamId: targetTeamId,
            parentId: newCat.id,
            name: child.name,
            description: child.description,
            maxScore: child.maxScore,
            sortOrder: child.sortOrder,
            isActive: true,
            originalItemId: child.id,
            targetPositions: child.targetPositions
          }
        });
        created.push(newChild);
      }
    }

    res.json({
      message: `${created.length} evaluation items imported successfully`,
      count: created.length
    });
  } catch (error) {
    console.error('Template apply error:', error);
    res.status(500).json({ error: 'Failed to apply template' });
  }
});

router.patch('/items/:id/toggle', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const item = await prisma.evaluationItem.findUnique({
      where: { id },
      select: { id: true, teamId: true, parentId: true }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const isOp = req.user.organizations?.some(o =>
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );
    const isTeamAdmin = req.user.teams?.some(t =>
      t.teamId === item.teamId && ['TEAM_MANAGER'].includes(t.role)
    );
    if (!isOp && !isTeamAdmin) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const updated = await prisma.evaluationItem.update({
      where: { id },
      data: { isActive }
    });

    if (item.parentId === null && isActive === false) {
      await prisma.evaluationItem.updateMany({
        where: { parentId: id },
        data: { isActive: false }
      });
    }

    res.json(updated);
  } catch (error) {
    console.error('Toggle item error:', error);
    res.status(500).json({ error: 'Failed to toggle item' });
  }
});

module.exports = router;
