const express = require('express');
const { authenticate, hasTeamAccess } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { transferPlayer, getTransferHistory, getTeamTransferSnapshot } = require('../services/transferService');

const router = express.Router();

function isOperator(user) {
  return user.organizations?.some(o =>
    ['OPERATOR_ADMIN', 'OPERATOR_MANAGER', 'OPERATOR_STAFF'].includes(o.role)
  );
}

router.post('/', authenticate, async (req, res) => {
  try {
    const { playerId, newTeamId, newTeamCategoryId } = req.body;

    if (!playerId || !newTeamId) {
      return res.status(400).json({ error: 'playerId and newTeamId are required' });
    }

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { teamId: true }
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const isOp = isOperator(req.user);
    const hasFromTeamAccess = hasTeamAccess(req.user, player.teamId, ['TEAM_ADMIN', 'TEAM_HEAD_COACH']);
    const hasToTeamAccess = hasTeamAccess(req.user, newTeamId, ['TEAM_ADMIN', 'TEAM_HEAD_COACH']);

    if (!isOp && (!hasFromTeamAccess || !hasToTeamAccess)) {
      return res.status(403).json({ error: 'Transfer requires admin access to both source and destination teams, or operator privileges' });
    }

    const result = await transferPlayer(playerId, newTeamId, { newTeamCategoryId });

    res.json({
      success: true,
      message: `Player transferred from ${result.transfer.fromTeam.name} to ${result.transfer.toTeam.name}`,
      player: result.player,
      transfer: result.transfer
    });
  } catch (error) {
    console.error('Transfer player error:', error);
    res.status(500).json({ error: error.message || 'Failed to transfer player' });
  }
});

router.get('/player/:playerId', authenticate, async (req, res) => {
  try {
    const { playerId } = req.params;

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true, teamId: true, userId: true }
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const isSelf = player.userId === req.user.id;
    const isOp = isOperator(req.user);
    const hasAccess = hasTeamAccess(req.user, player.teamId, ['TEAM_ADMIN', 'TEAM_HEAD_COACH', 'TEAM_COACH']);

    if (!isSelf && !isOp && !hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const history = await getTransferHistory(playerId);
    res.json(history);
  } catch (error) {
    console.error('Get transfer history error:', error);
    res.status(500).json({ error: 'Failed to fetch transfer history' });
  }
});

router.get('/:transferId', authenticate, async (req, res) => {
  try {
    const { transferId } = req.params;

    const transfer = await getTeamTransferSnapshot(transferId);

    const isOp = isOperator(req.user);
    const hasFromAccess = hasTeamAccess(req.user, transfer.fromTeamId, ['TEAM_ADMIN', 'TEAM_HEAD_COACH', 'TEAM_COACH']);
    const hasToAccess = hasTeamAccess(req.user, transfer.toTeamId, ['TEAM_ADMIN', 'TEAM_HEAD_COACH', 'TEAM_COACH']);

    if (!isOp && !hasFromAccess && !hasToAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(transfer);
  } catch (error) {
    console.error('Get transfer snapshot error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch transfer snapshot' });
  }
});

router.get('/:transferId/snapshot', authenticate, async (req, res) => {
  try {
    const { transferId } = req.params;

    const transfer = await prisma.transferHistory.findUnique({
      where: { id: transferId },
      include: {
        fromTeam: { select: { id: true, name: true } },
        toTeam: { select: { id: true, name: true } },
        player: { select: { id: true, name: true } }
      }
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer record not found' });
    }

    const isOp = isOperator(req.user);
    const hasFromAccess = hasTeamAccess(req.user, transfer.fromTeamId, ['TEAM_ADMIN', 'TEAM_HEAD_COACH', 'TEAM_COACH']);

    if (!isOp && !hasFromAccess) {
      return res.status(403).json({ error: 'Only the original team can view the snapshot' });
    }

    res.json({
      transferId: transfer.id,
      player: transfer.player,
      fromTeam: transfer.fromTeam,
      toTeam: transfer.toTeam,
      transferredAt: transfer.transferredAt,
      snapshot: transfer.snapshotData
    });
  } catch (error) {
    console.error('Get snapshot error:', error);
    res.status(500).json({ error: 'Failed to fetch snapshot' });
  }
});

module.exports = router;
