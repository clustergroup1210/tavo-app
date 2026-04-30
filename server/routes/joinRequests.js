const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, hasTeamAccess } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');

const router = express.Router();
const prisma = new PrismaClient();

function isOperatorUser(user) {
  return user.organizations?.some(o => 
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
  );
}

router.get('/', authenticate, async (req, res) => {
  try {
    const { teamId, status } = req.query;
    const isOperator = isOperatorUser(req.user);

    let whereClause = {};

    if (status) {
      whereClause.status = status;
    }

    if (isOperator && !teamId) {
      const requests = await prisma.teamJoinRequest.findMany({
        where: whereClause,
        include: {
          user: { select: { id: true, name: true, email: true } },
          team: { select: { id: true, name: true } },
          reviewer: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.json(requests);
    }

    if (teamId) {
      if (!hasTeamAccess(req.user, teamId, ['TEAM_MANAGER', 'COACH'])) {
        return res.status(403).json({ error: 'Access denied' });
      }

      whereClause.teamId = teamId;
      const requests = await prisma.teamJoinRequest.findMany({
        where: whereClause,
        include: {
          user: { select: { id: true, name: true, email: true } },
          team: { select: { id: true, name: true } },
          reviewer: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.json(requests);
    }

    return res.status(400).json({ error: 'teamId required for non-operators' });
  } catch (error) {
    console.error('Failed to fetch join requests:', error);
    res.status(500).json({ error: 'Failed to fetch join requests' });
  }
});

router.get('/my', authenticate, async (req, res) => {
  try {
    const requests = await prisma.teamJoinRequest.findMany({
      where: { userId: req.user.id },
      include: {
        team: { select: { id: true, name: true, logoUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (error) {
    console.error('Failed to fetch my join requests:', error);
    res.status(500).json({ error: 'Failed to fetch join requests' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { teamId, playerName, message, requestType: rawType } = req.body;
    const requestType = rawType === 'STAFF' ? 'STAFF' : 'PLAYER';

    if (!teamId || !playerName) {
      return res.status(400).json({ error: 'チームと名前は必須です' });
    }

    const existingRequest = await prisma.teamJoinRequest.findUnique({
      where: { userId_teamId: { userId: req.user.id, teamId } }
    });

    if (existingRequest) {
      return res.status(400).json({ error: 'このチームへの参加申請は既に存在します' });
    }

    if (requestType === 'PLAYER') {
      const existingPlayer = await prisma.player.findFirst({
        where: { userId: req.user.id, teamId }
      });
      if (existingPlayer) {
        return res.status(400).json({ error: '既にこのチームに所属しています' });
      }
    } else {
      const existingMembership = await prisma.userTeam.findFirst({
        where: { userId: req.user.id, teamId, role: { in: ['TEAM_MANAGER', 'COACH', 'GUEST_COACH'] } }
      });
      if (existingMembership) {
        return res.status(400).json({ error: '既にこのチームのスタッフです' });
      }
    }

    const request = await prisma.teamJoinRequest.create({
      data: {
        userId: req.user.id,
        teamId,
        playerName,
        message,
        requestType,
      },
      include: {
        team: { select: { id: true, name: true } }
      }
    });

    const teamStaff = await prisma.userTeam.findMany({
      where: {
        teamId,
        role: { in: ['TEAM_MANAGER', 'COACH'] }
      },
      select: { userId: true }
    });

    const operators = await prisma.userOrganization.findMany({
      where: {
        role: { in: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'] }
      },
      select: { userId: true }
    });

    const notifyUserIds = new Set([
      ...teamStaff.map(s => s.userId),
      ...operators.map(o => o.userId)
    ]);

    for (const userId of notifyUserIds) {
      createNotification({
        userId,
        type: 'JOIN_REQUEST',
        title: '参加申請がありました',
        message: `${playerName}さんが${request.team.name}への参加を申請しました`,
        linkUrl: '/join-requests'
      });
    }

    res.status(201).json(request);
  } catch (error) {
    console.error('Failed to create join request:', error);
    res.status(500).json({ error: '参加申請の作成に失敗しました' });
  }
});

router.put('/:id/approve', authenticate, async (req, res) => {
  try {
    const request = await prisma.teamJoinRequest.findUnique({
      where: { id: req.params.id },
      include: { user: true }
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const isOperator = isOperatorUser(req.user);
    const requiredTeamRoles = request.requestType === 'STAFF'
      ? ['TEAM_MANAGER']
      : ['TEAM_MANAGER', 'COACH'];
    if (!isOperator && !hasTeamAccess(req.user, request.teamId, requiredTeamRoles)) {
      return res.status(403).json({
        error: request.requestType === 'STAFF'
          ? 'スタッフ申請の承認はチーム管理者または運営者のみ可能です'
          : 'Access denied'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'この申請は既に処理されています' });
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      const claim = await tx.teamJoinRequest.updateMany({
        where: { id: req.params.id, status: 'pending' },
        data: {
          status: 'approved',
          reviewedBy: req.user.id,
          reviewedAt: new Date()
        }
      });

      if (claim.count === 0) {
        const err = new Error('ALREADY_PROCESSED');
        err.code = 'ALREADY_PROCESSED';
        throw err;
      }

      if (request.requestType === 'STAFF') {
        await tx.userTeam.upsert({
          where: {
            userId_teamId_role: {
              userId: request.userId,
              teamId: request.teamId,
              role: 'COACH'
            }
          },
          update: { isActive: true },
          create: {
            userId: request.userId,
            teamId: request.teamId,
            role: 'COACH'
          }
        });
      } else {
        const existingPlayer = await tx.player.findFirst({
          where: {
            userId: request.userId,
            teamId: request.teamId,
            deletedAt: null
          }
        });

        const player = existingPlayer || await tx.player.create({
          data: {
            userId: request.userId,
            teamId: request.teamId,
            name: request.playerName
          }
        });

        if (!existingPlayer) {
          await tx.playerTeamHistory.create({
            data: {
              playerId: player.id,
              teamId: request.teamId,
              joinedAt: new Date()
            }
          });
        }

        await tx.userTeam.upsert({
          where: {
            userId_teamId_role: {
              userId: request.userId,
              teamId: request.teamId,
              role: 'PLAYER'
            }
          },
          update: {},
          create: {
            userId: request.userId,
            teamId: request.teamId,
            role: 'PLAYER'
          }
        });
      }

      return await tx.teamJoinRequest.findUnique({
        where: { id: req.params.id },
        include: {
          user: { select: { id: true, name: true, email: true } },
          team: { select: { id: true, name: true } },
          reviewer: { select: { id: true, name: true } }
        }
      });
    });

    res.json(updatedRequest);
  } catch (error) {
    if (error.code === 'ALREADY_PROCESSED') {
      return res.status(409).json({ error: 'この申請は既に処理されています' });
    }
    console.error('Failed to approve join request:', error);
    res.status(500).json({ error: '申請の承認に失敗しました' });
  }
});

router.put('/:id/reject', authenticate, async (req, res) => {
  try {
    const request = await prisma.teamJoinRequest.findUnique({
      where: { id: req.params.id }
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const isOperator = isOperatorUser(req.user);
    const requiredTeamRoles = request.requestType === 'STAFF'
      ? ['TEAM_MANAGER']
      : ['TEAM_MANAGER', 'COACH'];
    if (!isOperator && !hasTeamAccess(req.user, request.teamId, requiredTeamRoles)) {
      return res.status(403).json({
        error: request.requestType === 'STAFF'
          ? 'スタッフ申請の処理はチーム管理者または運営者のみ可能です'
          : 'Access denied'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'この申請は既に処理されています' });
    }

    const updatedRequest = await prisma.teamJoinRequest.update({
      where: { id: req.params.id },
      data: {
        status: 'rejected',
        reviewedBy: req.user.id,
        reviewedAt: new Date()
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        team: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } }
      }
    });

    res.json(updatedRequest);
  } catch (error) {
    console.error('Failed to reject join request:', error);
    res.status(500).json({ error: '申請の却下に失敗しました' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const request = await prisma.teamJoinRequest.findUnique({
      where: { id: req.params.id }
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.userId !== req.user.id && !isOperatorUser(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.teamJoinRequest.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete join request:', error);
    res.status(500).json({ error: '申請の削除に失敗しました' });
  }
});

module.exports = router;
