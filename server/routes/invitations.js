const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { authenticate, hasTeamAccess } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req, res) => {
  try {
    const { teamId } = req.query;

    if (!hasTeamAccess(req.user, teamId, ['TEAM_ADMIN', 'TEAM_HEAD_COACH'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const invitations = await prisma.invitation.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(invitations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { teamId, role, email, expiryDays = 7 } = req.body;

    if (!hasTeamAccess(req.user, teamId, ['TEAM_ADMIN', 'TEAM_HEAD_COACH'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const invitation = await prisma.invitation.create({
      data: { teamId, token, email, role, expiresAt }
    });

    res.json({
      ...invitation,
      inviteUrl: `/invite/${token}`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

router.get('/verify/:token', async (req, res) => {
  try {
    const invitation = await prisma.invitation.findFirst({
      where: {
        token: req.params.token,
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: { team: true }
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    res.json({
      valid: true,
      teamName: invitation.team.name,
      role: invitation.role
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify invitation' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { id: req.params.id }
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (!hasTeamAccess(req.user, invitation.teamId, ['TEAM_ADMIN', 'TEAM_HEAD_COACH'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.invitation.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete invitation' });
  }
});

module.exports = router;
