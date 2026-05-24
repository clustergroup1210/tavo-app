const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { authenticate, getUserRoles, JWT_SECRET } = require('../middleware/auth');
const { resolveUserCode } = require('../services/userCode');

const router = express.Router();
const prisma = require('../lib/prisma');

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, invitationToken } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let user;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const userCode = await resolveUserCode(prisma, null);
        user = await prisma.user.create({
          data: { email, password: hashedPassword, name, userCode }
        });
        break;
      } catch (err) {
        const isUserCodeConflict = err?.code === 'P2002' &&
          (Array.isArray(err.meta?.target) ? err.meta.target.includes('userCode') : String(err.meta?.target || '').includes('userCode'));
        if (isUserCodeConflict && attempt < 4) continue;
        throw err;
      }
    }

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
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'none', secure: true });
    
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
        teams: { where: { isActive: true }, include: { team: true } },
        players: true,
        parentPlayers: { include: { player: true } }
      }
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    }).catch((err) => console.error('Failed to update lastLoginAt:', err));

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'none', secure: true });

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
  res.clearCookie('token', { sameSite: 'none', secure: true });
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

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'メールアドレスを入力してください' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetExpiresAt }
      });

      const baseUrl = process.env.APP_URL
        || (process.env.NODE_ENV === 'production'
          ? 'https://ta-vo.jp'
          : process.env.REPLIT_DEV_DOMAIN
            ? `https://${process.env.REPLIT_DEV_DOMAIN}`
            : process.env.REPL_SLUG
              ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
              : 'http://localhost:5000');
      const resetUrl = `${baseUrl}/reset-password/${resetToken}`;
      
      console.log(`[PASSWORD RESET] To: ${user.email}`);
      console.log(`[PASSWORD RESET] URL: ${resetUrl}`);
      console.log(`[PASSWORD RESET] Token: ${resetToken}`);
      console.log(`[PASSWORD RESET] Expires: ${resetExpiresAt.toISOString()}`);
    }

    res.json({ message: 'パスワードリセットのメールを送信しました。メールをご確認ください。' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'パスワードリセットの処理に失敗しました' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'トークンとパスワードが必要です' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'パスワードは6文字以上で入力してください' });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetExpiresAt: { gt: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'リセットリンクが無効または期限切れです。再度リセットを申請してください。' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetExpiresAt: null
      }
    });

    res.json({ message: 'パスワードが正常にリセットされました。新しいパスワードでログインしてください。' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'パスワードリセットに失敗しました' });
  }
});

module.exports = router;
