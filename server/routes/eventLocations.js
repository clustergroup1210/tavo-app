const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

const prisma = require('../lib/prisma');

function hasTeamAccess(user, teamId, roles) {
  return user.teams?.some(ut => ut.teamId === teamId && (!roles || roles.includes(ut.role)));
}

function isOperator(user) {
  return user.organizations?.some(o => ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role));
}

function canManage(user, teamId) {
  if (isOperator(user)) return true;
  if (!teamId) return false;
  return hasTeamAccess(user, teamId, ['TEAM_MANAGER', 'COACH']);
}

router.get('/', authenticate, async (req, res) => {
  try {
    const { teamId } = req.query;
    if (!teamId) return res.status(400).json({ error: 'teamId required' });
    if (!hasTeamAccess(req.user, teamId) && !isOperator(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const locations = await prisma.eventLocation.findMany({
      where: { teamId },
      orderBy: { name: 'asc' },
    });
    res.json(locations);
  } catch (error) {
    console.error('List event locations error:', error);
    res.status(500).json({ error: 'Failed to list locations' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { teamId, name, address } = req.body;
    if (!teamId || !name || !name.trim()) {
      return res.status(400).json({ error: 'teamId and name are required' });
    }
    if (!canManage(req.user, teamId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const trimmedName = name.trim();
    const trimmedAddress = typeof address === 'string' ? address.trim() : '';
    const existing = await prisma.eventLocation.findUnique({
      where: { teamId_name: { teamId, name: trimmedName } },
    }).catch(() => null);
    if (existing) {
      const updated = trimmedAddress && trimmedAddress !== (existing.address || '')
        ? await prisma.eventLocation.update({
            where: { id: existing.id },
            data: { address: trimmedAddress },
          })
        : existing;
      return res.json(updated);
    }
    const created = await prisma.eventLocation.create({
      data: {
        teamId,
        name: trimmedName,
        address: trimmedAddress || null,
        createdBy: req.user.id,
      },
    });
    res.status(201).json(created);
  } catch (error) {
    if (error.code === 'P2002') {
      const trimmedName = (req.body.name || '').trim();
      const existing = await prisma.eventLocation.findUnique({
        where: { teamId_name: { teamId: req.body.teamId, name: trimmedName } },
      }).catch(() => null);
      if (existing) return res.json(existing);
      return res.status(409).json({ error: 'この名称はすでに登録されています' });
    }
    console.error('Create event location error:', error);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.eventLocation.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!canManage(req.user, existing.teamId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { name, address } = req.body;
    const trimmedAddress = typeof address === 'string' ? address.trim() : '';
    const updated = await prisma.eventLocation.update({
      where: { id: req.params.id },
      data: {
        ...(name && name.trim() && { name: name.trim() }),
        ...(address !== undefined && { address: trimmedAddress || null }),
      },
    });
    res.json(updated);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'この名称はすでに登録されています' });
    }
    console.error('Update event location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.eventLocation.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!canManage(req.user, existing.teamId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await prisma.eventLocation.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete event location error:', error);
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

module.exports = router;
