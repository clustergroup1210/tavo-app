const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

router.get('/:token', async (req, res) => {
  try {
    const invitation = await prisma.teamInvitation.findUnique({
      where: { token: req.params.token },
      include: {
        team: {
          select: { id: true, name: true, logoUrl: true, league: true, region: true, status: true },
        },
      },
    });

    if (!invitation) {
      return res.status(404).json({ error: '招待リンクが見つかりません' });
    }
    if (invitation.usedAt) {
      return res.status(410).json({ error: 'この招待リンクは既に使用されています' });
    }
    if (invitation.expiresAt < new Date()) {
      return res.status(410).json({ error: 'この招待リンクは有効期限が切れています' });
    }

    res.json({
      teamId: invitation.team.id,
      teamName: invitation.team.name,
      teamLogoUrl: invitation.team.logoUrl,
      teamLeague: invitation.team.league,
      teamRegion: invitation.team.region,
      teamStatus: invitation.team.status,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    console.error('Failed to fetch invitation:', error);
    res.status(500).json({ error: '招待情報の取得に失敗しました' });
  }
});

router.post('/:token/activate', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'お名前を入力してください' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'メールアドレスを入力してください' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'パスワードは6文字以上で入力してください' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const invitation = await prisma.teamInvitation.findUnique({
      where: { token: req.params.token },
      include: { team: true },
    });

    if (!invitation) {
      return res.status(404).json({ error: '招待リンクが見つかりません' });
    }
    if (invitation.usedAt) {
      return res.status(410).json({ error: 'この招待リンクは既に使用されています' });
    }
    if (invitation.expiresAt < new Date()) {
      return res.status(410).json({ error: 'この招待リンクは有効期限が切れています' });
    }
    if (invitation.team.status !== 'PENDING') {
      return res.status(409).json({ error: 'このチームは既に本登録済みです' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: trimmedEmail } });
    if (existingUser) {
      return res.status(400).json({ error: 'このメールアドレスは既に使用されています' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const consumed = await tx.teamInvitation.updateMany({
        where: {
          id: invitation.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) {
        const err = new Error('INVITATION_ALREADY_USED');
        err.code = 'INVITATION_ALREADY_USED';
        throw err;
      }

      const teamConsumed = await tx.team.updateMany({
        where: { id: invitation.teamId, status: 'PENDING' },
        data: { status: 'ACTIVE' },
      });
      if (teamConsumed.count !== 1) {
        const err = new Error('TEAM_ALREADY_ACTIVE');
        err.code = 'TEAM_ALREADY_ACTIVE';
        throw err;
      }

      const user = await tx.user.create({
        data: { name: name.trim(), email: trimmedEmail, password: hashedPassword },
      });

      await tx.userTeam.create({
        data: { userId: user.id, teamId: invitation.teamId, role: 'TEAM_MANAGER' },
      });

      return user;
    });

    const token = jwt.sign({ userId: result.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'none',
      secure: true,
    });

    res.json({
      success: true,
      user: { id: result.id, email: result.email, name: result.name },
      teamId: invitation.teamId,
    });
  } catch (error) {
    console.error('Failed to activate team:', error);
    if (error.code === 'INVITATION_ALREADY_USED') {
      return res.status(410).json({ error: 'この招待リンクは既に使用されています' });
    }
    if (error.code === 'TEAM_ALREADY_ACTIVE') {
      return res.status(409).json({ error: 'このチームは既に本登録済みです' });
    }
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      return res.status(400).json({ error: 'このメールアドレスは既に使用されています' });
    }
    res.status(500).json({ error: 'チームの本登録に失敗しました' });
  }
});

module.exports = router;
