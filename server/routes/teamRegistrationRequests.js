const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');
const { resolveUserCode } = require('../services/userCode');

const router = express.Router();
const prisma = new PrismaClient();

function isOperatorUser(user) {
  return user?.organizations?.some(o =>
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
  );
}

function normalizeTeamName(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s\u3000]+/g, '')
    .replace(/[\u30FB\u00B7\.\-_/\\,'"`!?！？]/g, '');
}

// Simple in-memory throttle to mitigate public POST abuse.
// Keyed by IP+email+normalizedTeamName and by IP alone.
const throttleHits = new Map();
function throttleKey(key, windowMs, maxHits) {
  const now = Date.now();
  const entry = throttleHits.get(key);
  if (!entry || now - entry.start > windowMs) {
    throttleHits.set(key, { start: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= maxHits;
}
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [k, v] of throttleHits) if (v.start < cutoff) throttleHits.delete(k);
}, 10 * 60 * 1000).unref?.();

router.post('/', async (req, res) => {
  try {
    const {
      requesterName, requesterEmail, requesterPhone, password,
      desiredTeamName, league, region, description, message
    } = req.body || {};

    if (!requesterName || !requesterEmail || !requesterPhone || !password || !desiredTeamName) {
      return res.status(400).json({ error: '氏名・メール・電話番号・パスワード・チーム名は必須です' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'パスワードは6文字以上で入力してください' });
    }

    const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '').trim();
    const emailLc = requesterEmail.trim().toLowerCase();
    const normalized = normalizeTeamName(desiredTeamName);
    const ipOk = throttleKey(`ip:${ip}`, 60 * 60 * 1000, 20);
    const dupOk = throttleKey(`dup:${ip}|${emailLc}|${normalized}`, 60 * 60 * 1000, 3);
    if (!ipOk || !dupOk) {
      return res.status(429).json({ error: 'リクエストが多すぎます。しばらく時間をおいて再度お試しください。' });
    }

    const candidates = await prisma.team.findMany({ select: { id: true, name: true, region: true, league: true } });
    const match = candidates.find(t => normalizeTeamName(t.name) === normalized);
    if (match) {
      return res.status(409).json({
        error: '同名のチームが既に登録されています。既存チームへの参加申請をご利用ください。',
        existingTeam: match
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const request = await prisma.teamRegistrationRequest.create({
      data: {
        requesterName: requesterName.trim(),
        requesterEmail: requesterEmail.trim(),
        requesterPhone: requesterPhone.trim(),
        passwordHash,
        desiredTeamName: desiredTeamName.trim(),
        league: league?.trim() || null,
        region: region?.trim() || null,
        description: description?.trim() || null,
        message: message?.trim() || null,
      }
    });

    const operators = await prisma.userOrganization.findMany({
      where: { role: { in: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'] } },
      select: { userId: true }
    });
    const notifyIds = new Set(operators.map(o => o.userId));
    for (const userId of notifyIds) {
      createNotification({
        userId,
        type: 'TEAM_REGISTRATION_REQUEST',
        title: 'チーム新規登録申請',
        message: `${request.requesterName}（${request.requesterEmail} / ${request.requesterPhone}）が「${request.desiredTeamName}」の登録を申請しました`,
        linkUrl: '/admin/team-registration-requests'
      });
    }

    res.status(201).json({ id: request.id, status: request.status });
  } catch (error) {
    console.error('Failed to create team registration request:', error);
    res.status(500).json({ error: 'チーム登録申請の作成に失敗しました' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    if (!isOperatorUser(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { status } = req.query;
    const where = status ? { status } : {};
    const rows = await prisma.teamRegistrationRequest.findMany({
      where,
      include: { reviewer: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const emails = [...new Set(rows.filter(r => r.status === 'pending').map(r => r.requesterEmail))];
    const existingUsers = emails.length
      ? await prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true, id: true, name: true } })
      : [];
    const existingByEmail = new Map(existingUsers.map(u => [u.email, u]));

    res.json(rows.map(r => ({
      id: r.id,
      requesterName: r.requesterName,
      requesterEmail: r.requesterEmail,
      requesterPhone: r.requesterPhone,
      desiredTeamName: r.desiredTeamName,
      league: r.league,
      region: r.region,
      description: r.description,
      message: r.message,
      status: r.status,
      rejectionReason: r.rejectionReason,
      reviewedAt: r.reviewedAt,
      reviewer: r.reviewer,
      createdAt: r.createdAt,
      createdUserId: r.createdUserId,
      createdTeamId: r.createdTeamId,
      existingUser: existingByEmail.get(r.requesterEmail) || null,
    })));
  } catch (error) {
    console.error('Failed to list team registration requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

router.put('/:id/approve', authenticate, async (req, res) => {
  try {
    if (!isOperatorUser(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { organizationId, confirmReuseExistingUser } = req.body || {};
    const request = await prisma.teamRegistrationRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'この申請は既に処理されています' });
    }

    let orgId = organizationId;
    if (!orgId) {
      const op = req.user.organizations.find(o =>
        ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
      );
      orgId = op?.organizationId;
    }
    if (!orgId) {
      const fallback = await prisma.organization.findFirst();
      orgId = fallback?.id;
    }
    if (!orgId) return res.status(400).json({ error: '組織が見つかりません' });

    const existingUser = await prisma.user.findUnique({ where: { email: request.requesterEmail } });
    if (existingUser && !confirmReuseExistingUser) {
      return res.status(409).json({
        error: 'EXISTING_USER_CONFIRMATION_REQUIRED',
        message: `メール「${request.requesterEmail}」の既存ユーザー（${existingUser.name}）が見つかりました。この既存アカウントを「${request.desiredTeamName}」のTEAM_MANAGERとして紐付けて承認しますか？`,
        existingUser: { id: existingUser.id, name: existingUser.name, email: existingUser.email }
      });
    }

    const normalized = normalizeTeamName(request.desiredTeamName);

    const result = await prisma.$transaction(async (tx) => {
      // Re-check duplicate name inside the transaction (TOCTOU guard).
      const allTeams = await tx.team.findMany({ select: { id: true, name: true } });
      const conflict = allTeams.find(t => normalizeTeamName(t.name) === normalized);
      if (conflict) {
        const err = new Error('DUPLICATE_TEAM');
        err.code = 'DUPLICATE_TEAM';
        err.payload = conflict;
        throw err;
      }

      const claim = await tx.teamRegistrationRequest.updateMany({
        where: { id: request.id, status: 'pending' },
        data: { status: 'approved', reviewedBy: req.user.id, reviewedAt: new Date() }
      });
      if (claim.count === 0) {
        const err = new Error('ALREADY_PROCESSED');
        err.code = 'ALREADY_PROCESSED';
        throw err;
      }

      let user = existingUser;
      if (!user) {
        const userCode = await resolveUserCode(tx, null);
        user = await tx.user.create({
          data: {
            email: request.requesterEmail,
            password: request.passwordHash,
            name: request.requesterName,
            userCode,
          }
        });
      }

      const team = await tx.team.create({
        data: {
          name: request.desiredTeamName,
          organizationId: orgId,
          league: request.league,
          region: request.region,
          description: request.description,
          status: 'ACTIVE',
        }
      });

      await tx.userTeam.create({
        data: { userId: user.id, teamId: team.id, role: 'TEAM_MANAGER' }
      });

      await tx.teamRegistrationRequest.update({
        where: { id: request.id },
        data: { createdUserId: user.id, createdTeamId: team.id }
      });

      return { user, team };
    });

    createNotification({
      userId: result.user.id,
      type: 'TEAM_REGISTRATION_REQUEST',
      title: 'チーム登録が承認されました',
      message: `「${result.team.name}」が承認されました。ログインしてご利用ください。`,
      linkUrl: '/login'
    });

    res.json({ success: true, userId: result.user.id, teamId: result.team.id });
  } catch (error) {
    if (error.code === 'ALREADY_PROCESSED') {
      return res.status(409).json({ error: 'この申請は既に処理されています' });
    }
    if (error.code === 'DUPLICATE_TEAM') {
      return res.status(409).json({
        error: '承認処理中に同名のチームが既に作成されていることが検出されました。申請者へ既存チームへの参加申請を案内するか、申請を却下してください。',
        existingTeam: error.payload
      });
    }
    console.error('Failed to approve team registration request:', error);
    res.status(500).json({ error: 'チーム登録申請の承認に失敗しました' });
  }
});

router.put('/:id/reject', authenticate, async (req, res) => {
  try {
    if (!isOperatorUser(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { reason } = req.body || {};
    const request = await prisma.teamRegistrationRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'この申請は既に処理されています' });
    }
    await prisma.teamRegistrationRequest.update({
      where: { id: request.id },
      data: {
        status: 'rejected',
        rejectionReason: reason || null,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to reject team registration request:', error);
    res.status(500).json({ error: 'チーム登録申請の却下に失敗しました' });
  }
});

module.exports = router;
