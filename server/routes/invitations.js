const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { authenticate, hasTeamAccess } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

function isOperatorUser(user) {
  return user.organizations?.some(o => 
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
  );
}

router.get('/', authenticate, async (req, res) => {
  try {
    const { teamId } = req.query;
    const isOperator = isOperatorUser(req.user);

    let invitations;
    if (isOperator && !teamId) {
      invitations = await prisma.invitation.findMany({
        include: {
          team: { select: { id: true, name: true } },
          player: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else if (teamId) {
      if (!hasTeamAccess(req.user, teamId, ['TEAM_MANAGER', 'COACH', 'COACH'])) {
        return res.status(403).json({ error: 'Access denied' });
      }

      invitations = await prisma.invitation.findMany({
        where: { teamId },
        include: {
          team: { select: { id: true, name: true } },
          player: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      return res.status(400).json({ error: 'teamId required' });
    }

    const now = new Date();
    const enriched = invitations.map(inv => ({
      ...inv,
      inviteUrl: `/invite/${inv.token}`,
      isExpired: new Date(inv.expiresAt) < now,
      isUsed: !!inv.usedAt
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { teamId, role, email, playerName, playerId, expiryDays = 7 } = req.body;
    const isOperator = isOperatorUser(req.user);

    if (!isOperator && !hasTeamAccess(req.user, teamId, ['TEAM_MANAGER', 'COACH', 'COACH'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (role === 'PARENT' && !playerId) {
      return res.status(400).json({ error: '保護者招待には選手IDが必要です' });
    }

    if (role === 'PARENT' && playerId) {
      const player = await prisma.player.findUnique({ where: { id: playerId } });
      if (!player || player.teamId !== teamId) {
        return res.status(400).json({ error: '指定された選手はこのチームに所属していません' });
      }
    }

    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const invitation = await prisma.invitation.create({
      data: { 
        teamId, 
        token, 
        email, 
        playerName,
        playerId: role === 'PARENT' ? playerId : null,
        role, 
        expiresAt,
        createdBy: req.user.id
      },
      include: {
        team: { select: { id: true, name: true } },
        player: { select: { id: true, name: true } }
      }
    });

    res.json({
      ...invitation,
      inviteUrl: `/invite/${token}`
    });
  } catch (error) {
    console.error('Create invitation error:', error);
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
      include: { 
        team: { select: { id: true, name: true, logoUrl: true } },
        player: { select: { id: true, name: true } }
      }
    });

    if (!invitation) {
      return res.status(404).json({ error: 'この招待URLは無効または期限切れです' });
    }

    res.json({
      valid: true,
      team: invitation.team,
      role: invitation.role,
      playerName: invitation.playerName,
      player: invitation.player
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

    const isOperator = isOperatorUser(req.user);
    if (!isOperator && !hasTeamAccess(req.user, invitation.teamId, ['TEAM_MANAGER', 'COACH'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.invitation.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete invitation' });
  }
});

module.exports = router;
