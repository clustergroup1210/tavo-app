const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authenticate, hasTeamAccess } = require('../middleware/auth');
const { resolveUserCode } = require('../services/userCode');

const router = express.Router();
const prisma = new PrismaClient();

function isOperatorUser(user) {
  return user.organizations?.some(o => 
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
  );
}

router.get('/', authenticate, async (req, res) => {
  try {
    const { teamId, organizationId } = req.query;

    const isOperator = isOperatorUser(req.user);

    if (isOperator && !teamId && !organizationId) {
      const users = await prisma.user.findMany({
        include: {
          organizations: true,
          teams: { include: { team: true } },
          players: { select: { id: true, name: true, teamId: true, team: { select: { id: true, name: true } } } },
          parentPlayers: { include: { player: { include: { team: true } } } }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.json(users.map(u => ({
        id: u.id,
        email: u.email,
        userCode: u.userCode,
        name: u.name,
        avatarUrl: u.avatarUrl,
        organizations: u.organizations,
        teams: u.teams,
        players: u.players,
        parentPlayers: u.parentPlayers,
        createdAt: u.createdAt
      })));
    }

    let users;
    if (isOperator && organizationId) {
      users = await prisma.user.findMany({
        where: {
          organizations: { some: { organizationId } }
        },
        include: {
          organizations: true,
          teams: { include: { team: true } }
        }
      });
    } else if (teamId) {
      if (!hasTeamAccess(req.user, teamId, ['TEAM_MANAGER', 'COACH'])) {
        return res.status(403).json({ error: 'Access denied' });
      }

      users = await prisma.user.findMany({
        where: {
          teams: { some: { teamId } }
        },
        include: {
          teams: { where: { teamId }, include: { team: true } },
          players: { where: { teamId }, select: { id: true, name: true, deletedAt: true } }
        }
      });
    } else {
      return res.status(400).json({ error: 'teamId or organizationId required' });
    }

    res.json(users.map(u => ({
      id: u.id,
      email: u.email,
      userCode: u.userCode,
      name: u.name,
      avatarUrl: u.avatarUrl,
      lastLoginAt: u.lastLoginAt,
      organizations: u.organizations,
      teams: u.teams,
      players: u.players,
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    if (!isOperatorUser(req.user)) {
      return res.status(403).json({ error: 'Operator access required' });
    }

    const { name, email, password, role, teamId, teamRole, playerId, userCode } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const isOperatorRole = ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'EXTERNAL'].includes(role);
    const isTeamRole = ['TEAM_MANAGER', 'COACH', 'GUEST_COACH', 'PLAYER'].includes(teamRole);
    const isParentRole = teamRole === 'PARENT';

    if (!isOperatorRole && isTeamRole && !teamId) {
      return res.status(400).json({ error: 'チーム役割を選択した場合、チームの選択は必須です' });
    }

    if (isParentRole && !playerId) {
      return res.status(400).json({ error: '保護者の場合、対象選手の選択は必須です' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'このメールアドレスは既に登録されています' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const userProvidedCode = userCode !== undefined && userCode !== null && String(userCode).trim() !== '';
    const userData = {
      name,
      email,
      password: hashedPassword
    };

    const maxAttempts = userProvidedCode ? 1 : 5;
    let resolvedCode;
    let lastErr;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        resolvedCode = await resolveUserCode(prisma, userProvidedCode ? userCode : null);
        break;
      } catch (e) {
        lastErr = e;
        if (e.statusCode === 400 || e.statusCode === 409) {
          return res.status(e.statusCode).json({ error: e.message });
        }
      }
    }
    if (!resolvedCode) {
      return res.status(500).json({ error: lastErr?.message || 'ユーザーIDの生成に失敗しました' });
    }
    userData.userCode = resolvedCode;

    if (isOperatorRole) {
      const operatorOrg = req.user.organizations?.find(o => 
        ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
      );
      
      if (operatorOrg) {
        userData.organizations = {
          create: {
            organizationId: operatorOrg.organizationId,
            role: role
          }
        };
      }
    }

    if (teamId && teamRole && !isParentRole) {
      userData.teams = {
        create: {
          teamId: teamId,
          role: teamRole
        }
      };
    }

    if (isParentRole && playerId) {
      userData.parentPlayers = {
        create: {
          playerId: playerId
        }
      };
    }

    let user;
    const createMaxAttempts = userProvidedCode ? 1 : 5;
    for (let attempt = 0; attempt < createMaxAttempts; attempt++) {
      try {
        user = await prisma.user.create({
          data: userData,
          include: {
            organizations: true,
            teams: { include: { team: true } },
            parentPlayers: { include: { player: true } }
          }
        });
        break;
      } catch (err) {
        const isUserCodeConflict = err?.code === 'P2002' &&
          (Array.isArray(err.meta?.target) ? err.meta.target.includes('userCode') : String(err.meta?.target || '').includes('userCode'));
        if (isUserCodeConflict && !userProvidedCode && attempt < createMaxAttempts - 1) {
          userData.userCode = await resolveUserCode(prisma, null);
          continue;
        }
        if (isUserCodeConflict) {
          return res.status(409).json({ error: '指定されたユーザーIDは既に使用されています' });
        }
        throw err;
      }
    }

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      userCode: user.userCode,
      organizations: user.organizations,
      teams: user.teams,
      parentPlayers: user.parentPlayers,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'ユーザーの作成に失敗しました' });
  }
});

// Mark a user as having left a team (soft removal). Their team data is preserved
// but they lose all team access. Optionally accepts `leftAt` (ISO date).
router.post('/:id/leave-team', authenticate, async (req, res) => {
  try {
    const { teamId, leftAt } = req.body;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    if (!hasTeamAccess(req.user, teamId, ['TEAM_MANAGER'])) {
      return res.status(403).json({ error: '退団処理はチーム管理者または運営者のみ実行できます' });
    }

    const userId = req.params.id;
    if (userId === req.user.id) {
      return res.status(400).json({ error: '自分自身を退団させることはできません' });
    }

    const leftDate = leftAt ? new Date(leftAt) : new Date();
    if (isNaN(leftDate.getTime())) {
      return res.status(400).json({ error: '退団日が不正です' });
    }

    const memberships = await prisma.userTeam.findMany({
      where: { userId, teamId }
    });
    if (memberships.length === 0) {
      return res.status(404).json({ error: 'このユーザーはチームに所属していません' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.userTeam.updateMany({
        where: { userId, teamId },
        data: { isActive: false, leftAt: leftDate }
      });

      // If this user has Player records on this team, soft-delete them too
      // so they disappear from rosters but data is preserved.
      await tx.player.updateMany({
        where: { userId, teamId, deletedAt: null },
        data: { deletedAt: leftDate }
      });

      // If they were head coach, clear that link.
      const team = await tx.team.findUnique({ where: { id: teamId }, select: { headCoachId: true } });
      if (team?.headCoachId === userId) {
        await tx.team.update({ where: { id: teamId }, data: { headCoachId: null } });
      }
    });

    res.json({ success: true, leftAt: leftDate });
  } catch (error) {
    console.error('Leave team error:', error);
    res.status(500).json({ error: '退団処理に失敗しました' });
  }
});

// Reverse a 退団 — restores membership and undeletes any linked Player.
router.post('/:id/restore-team', authenticate, async (req, res) => {
  try {
    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    if (!hasTeamAccess(req.user, teamId, ['TEAM_MANAGER'])) {
      return res.status(403).json({ error: 'チーム管理者または運営者のみ実行できます' });
    }

    const userId = req.params.id;

    await prisma.$transaction(async (tx) => {
      await tx.userTeam.updateMany({
        where: { userId, teamId },
        data: { isActive: true, leftAt: null }
      });
      await tx.player.updateMany({
        where: { userId, teamId, deletedAt: { not: null } },
        data: { deletedAt: null }
      });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Restore team error:', error);
    res.status(500).json({ error: '復帰処理に失敗しました' });
  }
});

router.put('/:id/role', authenticate, async (req, res) => {
  try {
    const { teamId, role } = req.body;

    if (!hasTeamAccess(req.user, teamId, ['TEAM_MANAGER'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const existing = await prisma.userTeam.findFirst({
      where: { userId: req.params.id, teamId }
    });

    if (existing) {
      await prisma.userTeam.update({
        where: { id: existing.id },
        data: { role }
      });
    } else {
      await prisma.userTeam.create({
        data: { userId: req.params.id, teamId, role }
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password required' });
      }

      const valid = await bcrypt.compare(currentPassword, req.user.password);
      if (!valid) {
        return res.status(400).json({ error: 'Invalid current password' });
      }

      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData
    });

    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    if (!isOperatorUser(req.user)) {
      return res.status(403).json({ error: 'Operator access required' });
    }

    const { name, email, password, organizationRole, teamRoles, userCode } = req.body;
    const userId = req.params.id;

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organizations: true,
        teams: true
      }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email }
      });
      if (emailExists) {
        return res.status(400).json({ error: 'このメールアドレスは既に使用されています' });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'パスワードは6文字以上である必要があります' });
      }
      updateData.password = await bcrypt.hash(password, 10);
    }
    if (userCode !== undefined && userCode !== null && String(userCode).trim() !== '') {
      try {
        updateData.userCode = await resolveUserCode(prisma, userCode, { excludeId: userId });
      } catch (e) {
        return res.status(e.statusCode || 500).json({ error: e.message || 'ユーザーIDの解決に失敗しました' });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: updateData
      });

      if (organizationRole !== undefined) {
        const org = await tx.organization.findFirst();
        if (org) {
          await tx.userOrganization.deleteMany({
            where: { userId }
          });

          if (organizationRole && ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'EXTERNAL'].includes(organizationRole)) {
            await tx.userOrganization.create({
              data: {
                userId,
                organizationId: org.id,
                role: organizationRole
              }
            });
          }
        }
      }

      if (teamRoles && Array.isArray(teamRoles)) {
        const oldTeamIds = existingUser.teams.map(t => t.teamId);

        await tx.userTeam.deleteMany({ where: { userId } });

        const newTeamIds = [];
        for (const tr of teamRoles) {
          if (!tr.teamId || !tr.role) continue;
          newTeamIds.push(tr.teamId);

          await tx.userTeam.create({
            data: { userId, teamId: tr.teamId, role: tr.role }
          });

          if (tr.isHeadCoach !== undefined) {
            const team = await tx.team.findUnique({ where: { id: tr.teamId } });
            if (team) {
              if (tr.isHeadCoach) {
                await tx.team.update({
                  where: { id: tr.teamId },
                  data: { headCoachId: userId }
                });
              } else if (team.headCoachId === userId) {
                await tx.team.update({
                  where: { id: tr.teamId },
                  data: { headCoachId: null }
                });
              }
            }
          }
        }

        const removedTeamIds = oldTeamIds.filter(id => !newTeamIds.includes(id));
        for (const teamId of removedTeamIds) {
          const team = await tx.team.findUnique({ where: { id: teamId } });
          if (team && team.headCoachId === userId) {
            await tx.team.update({
              where: { id: teamId },
              data: { headCoachId: null }
            });
          }
        }
      }
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organizations: true,
        teams: { include: { team: true } },
        players: { select: { id: true, name: true, teamId: true, team: { select: { id: true, name: true } } } },
        parentPlayers: { include: { player: { include: { team: true } } } }
      }
    });

    res.json({
      id: user.id,
      email: user.email,
      userCode: user.userCode,
      name: user.name,
      avatarUrl: user.avatarUrl,
      organizations: user.organizations,
      teams: user.teams,
      players: user.players,
      parentPlayers: user.parentPlayers,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

module.exports = router;
