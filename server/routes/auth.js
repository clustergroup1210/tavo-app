const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { authenticate, getUserRoles, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, invitationToken } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name }
    });

    if (invitationToken) {
      const invitation = await prisma.invitation.findFirst({
        where: { token: invitationToken, usedAt: null, expiresAt: { gt: new Date() } }
      });

      if (invitation) {
        await prisma.userTeam.create({
          data: {
            userId: user.id,
            teamId: invitation.teamId,
            role: invitation.role
          }
        });

        if (invitation.role === 'PLAYER') {
          const player = await prisma.player.create({
            data: {
              userId: user.id,
              teamId: invitation.teamId,
              name: invitation.playerName || name
            }
          });

          await prisma.playerTeamHistory.create({
            data: {
              playerId: player.id,
              teamId: invitation.teamId,
              joinedAt: new Date()
            }
          });
        }

        if (invitation.role === 'PARENT' && invitation.playerId) {
          const player = await prisma.player.findUnique({ 
            where: { id: invitation.playerId } 
          });
          if (player && player.teamId === invitation.teamId) {
            await prisma.playerParent.create({
              data: {
                playerId: invitation.playerId,
                userId: user.id
              }
            });
          }
        }

        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { usedAt: new Date() }
        });
      }
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    
    res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        organizations: true,
        teams: { include: { team: true } },
        players: true,
        parentPlayers: { include: { player: true } }
      }
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

    const roles = getUserRoles(user);
    
    res.json({
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
      roles,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const roles = getUserRoles(req.user);
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        avatarUrl: req.user.avatarUrl
      },
      roles,
      teams: req.user.teams,
      organizations: req.user.organizations,
      players: req.user.players,
      parentPlayers: req.user.parentPlayers
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

module.exports = router;
