const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, hasTeamAccess } = require('../middleware/auth');

const router = express.Router();

function isOperator(user) {
  return user.organizations?.some(o => 
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
  );
}

router.get('/:teamId', authenticate, async (req, res) => {
  try {
    const { teamId } = req.params;

    if (!hasTeamAccess(req.user, teamId, ['TEAM_MANAGER', 'COACH', 'GUEST_COACH']) && !isOperator(req.user)) {
      return res.status(403).json({ error: 'アクセス権限がありません' });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        headCoachId: true,
        headCoach: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'チームが見つかりません' });
    }

    const assignments = await prisma.coachAssignment.findMany({
      where: { teamId },
      include: {
        coach: { select: { id: true, name: true, email: true } },
        player: { select: { id: true, name: true, number: true, position: true, photoUrl: true } }
      },
      orderBy: [
        { coach: { name: 'asc' } },
        { player: { name: 'asc' } }
      ]
    });

    const coaches = await prisma.userTeam.findMany({
      where: {
        teamId,
        role: { in: ['COACH', 'GUEST_COACH'] },
        isActive: true
      },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    const players = await prisma.player.findMany({
      where: { teamId },
      select: { id: true, name: true, number: true, position: true, photoUrl: true },
      orderBy: [{ number: 'asc' }, { name: 'asc' }]
    });

    res.json({
      team,
      headCoach: team.headCoach,
      assignments,
      coaches: coaches.map(c => ({ ...c.user, role: c.role })),
      players
    });
  } catch (error) {
    console.error('Coach assignments fetch error:', error);
    res.status(500).json({ error: 'コーチ割り当て情報の取得に失敗しました' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { coachId, playerId, teamId } = req.body;

    if (!hasTeamAccess(req.user, teamId, ['TEAM_MANAGER']) && !isOperator(req.user)) {
      return res.status(403).json({ error: 'コーチ割り当ての権限がありません' });
    }

    const coach = await prisma.userTeam.findFirst({
      where: {
        userId: coachId,
        teamId,
        role: { in: ['COACH', 'GUEST_COACH'] },
        isActive: true
      }
    });

    if (!coach) {
      return res.status(400).json({ error: '指定されたユーザーはこのチームのコーチではありません' });
    }

    const player = await prisma.player.findFirst({
      where: { id: playerId, teamId }
    });

    if (!player) {
      return res.status(400).json({ error: '指定された選手はこのチームに所属していません' });
    }

    const existing = await prisma.coachAssignment.findUnique({
      where: {
        coachId_playerId: { coachId, playerId }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'この割り当ては既に存在します' });
    }

    const assignment = await prisma.coachAssignment.create({
      data: { coachId, playerId, teamId },
      include: {
        coach: { select: { id: true, name: true, email: true } },
        player: { select: { id: true, name: true, number: true, position: true, photoUrl: true } }
      }
    });

    res.status(201).json(assignment);
  } catch (error) {
    console.error('Coach assignment create error:', error);
    res.status(500).json({ error: 'コーチ割り当ての作成に失敗しました' });
  }
});

router.post('/bulk', authenticate, async (req, res) => {
  try {
    const { coachId, playerIds, teamId } = req.body;

    if (!hasTeamAccess(req.user, teamId, ['TEAM_MANAGER']) && !isOperator(req.user)) {
      return res.status(403).json({ error: 'コーチ割り当ての権限がありません' });
    }

    const coach = await prisma.userTeam.findFirst({
      where: {
        userId: coachId,
        teamId,
        role: { in: ['COACH', 'GUEST_COACH'] },
        isActive: true
      }
    });

    if (!coach) {
      return res.status(400).json({ error: '指定されたユーザーはこのチームのコーチではありません' });
    }

    const players = await prisma.player.findMany({
      where: { id: { in: playerIds }, teamId }
    });

    if (players.length !== playerIds.length) {
      return res.status(400).json({ error: '一部の選手がこのチームに所属していません' });
    }

    const existingAssignments = await prisma.coachAssignment.findMany({
      where: {
        coachId,
        playerId: { in: playerIds }
      }
    });

    const existingPlayerIds = new Set(existingAssignments.map(a => a.playerId));
    const newPlayerIds = playerIds.filter(id => !existingPlayerIds.has(id));

    if (newPlayerIds.length > 0) {
      await prisma.coachAssignment.createMany({
        data: newPlayerIds.map(playerId => ({ coachId, playerId, teamId }))
      });
    }

    const assignments = await prisma.coachAssignment.findMany({
      where: { coachId, teamId },
      include: {
        coach: { select: { id: true, name: true, email: true } },
        player: { select: { id: true, name: true, number: true, position: true, photoUrl: true } }
      }
    });

    res.status(201).json({
      created: newPlayerIds.length,
      skipped: existingPlayerIds.size,
      assignments
    });
  } catch (error) {
    console.error('Bulk coach assignment error:', error);
    res.status(500).json({ error: 'コーチ割り当ての一括作成に失敗しました' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const assignment = await prisma.coachAssignment.findUnique({
      where: { id }
    });

    if (!assignment) {
      return res.status(404).json({ error: '割り当てが見つかりません' });
    }

    if (!hasTeamAccess(req.user, assignment.teamId, ['TEAM_MANAGER']) && !isOperator(req.user)) {
      return res.status(403).json({ error: '削除権限がありません' });
    }

    await prisma.coachAssignment.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Coach assignment delete error:', error);
    res.status(500).json({ error: 'コーチ割り当ての削除に失敗しました' });
  }
});

router.delete('/coach/:coachId/team/:teamId', authenticate, async (req, res) => {
  try {
    const { coachId, teamId } = req.params;

    if (!hasTeamAccess(req.user, teamId, ['TEAM_MANAGER']) && !isOperator(req.user)) {
      return res.status(403).json({ error: '削除権限がありません' });
    }

    const result = await prisma.coachAssignment.deleteMany({
      where: { coachId, teamId }
    });

    res.json({ success: true, deleted: result.count });
  } catch (error) {
    console.error('Coach assignments delete error:', error);
    res.status(500).json({ error: 'コーチ割り当ての削除に失敗しました' });
  }
});

module.exports = router;
