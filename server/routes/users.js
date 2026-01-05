const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authenticate, hasTeamAccess } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

function isOperatorUser(user) {
  return user.organizations?.some(o => 
    ['OPERATOR_ADMIN', 'OPERATOR_MANAGER', 'OPERATOR_STAFF'].includes(o.role)
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
          players: { select: { id: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.json(users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        avatarUrl: u.avatarUrl,
        organizations: u.organizations,
        teams: u.teams,
        players: u.players,
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
      if (!hasTeamAccess(req.user, teamId, ['TEAM_ADMIN', 'TEAM_HEAD_COACH'])) {
        return res.status(403).json({ error: 'Access denied' });
      }

      users = await prisma.user.findMany({
        where: {
          teams: { some: { teamId } }
        },
        include: {
          teams: { where: { teamId }, include: { team: true } }
        }
      });
    } else {
      return res.status(400).json({ error: 'teamId or organizationId required' });
    }

    res.json(users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl,
      organizations: u.organizations,
      teams: u.teams
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

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'このメールアドレスは既に登録されています' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword
      }
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'ユーザーの作成に失敗しました' });
  }
});

router.put('/:id/role', authenticate, async (req, res) => {
  try {
    const { teamId, role } = req.body;

    if (!hasTeamAccess(req.user, teamId, ['TEAM_ADMIN'])) {
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

module.exports = router;
