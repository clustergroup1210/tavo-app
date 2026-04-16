const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Papa = require('papaparse');

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('CSVファイルのみアップロードできます'), false);
    }
  }
});

const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'system-settings.json');

function readSystemSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function writeSystemSettings(settings) {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
}

const requireOperator = (req, res, next) => {
  const isOperator = req.user.organizations?.some(o => 
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
  );
  if (!isOperator) {
    return res.status(403).json({ error: 'Operator access required' });
  }
  next();
};

router.get('/teams', authenticate, requireOperator, async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      where: { parentId: null },
      include: {
        organization: { select: { name: true } },
        children: { select: { id: true } },
        users: {
          where: { role: 'COACH' },
          include: { user: { select: { name: true } } },
          take: 1
        },
        _count: { select: { players: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const teamsWithStats = await Promise.all(teams.map(async (team) => {
      const childTeamIds = team.children.map(c => c.id);
      const allTeamIds = [team.id, ...childTeamIds];
      
      const totalPlayerCount = await prisma.player.count({
        where: { teamId: { in: allTeamIds } }
      });

      return {
        id: team.id,
        name: team.name,
        logoUrl: team.logoUrl,
        league: team.league,
        region: team.region,
        organization: team.organization,
        representativeName: team.users[0]?.user?.name || null,
        playerCount: totalPlayerCount,
        categoryCount: team.children.length,
        createdAt: team.createdAt
      };
    }));

    res.json(teamsWithStats);
  } catch (error) {
    console.error('Failed to fetch teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

router.get('/teams-all', authenticate, requireOperator, async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      select: { id: true, name: true, parentId: true },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }]
    });
    res.json(teams);
  } catch (error) {
    console.error('Failed to fetch all teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

router.get('/stats', authenticate, requireOperator, async (req, res) => {
  try {
    const [totalTeams, totalPlayers, totalUsers] = await Promise.all([
      prisma.team.count({ where: { parentId: null } }),
      prisma.player.count(),
      prisma.user.count()
    ]);

    res.json({ totalTeams, totalPlayers, totalUsers });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/teams/:id', authenticate, requireOperator, async (req, res) => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      include: {
        organization: true,
        children: {
          include: {
            _count: { select: { players: true } }
          }
        },
        users: {
          include: { user: { select: { id: true, name: true, email: true } } }
        },
        _count: { select: { players: true } }
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json(team);
  } catch (error) {
    console.error('Failed to fetch team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

router.put('/teams/:id', authenticate, requireOperator, async (req, res) => {
  try {
    const { name, league, region } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (league !== undefined) updateData.league = league?.trim() || null;
    if (region !== undefined) updateData.region = region?.trim() || null;
    const team = await prisma.team.update({
      where: { id: req.params.id },
      data: updateData
    });
    res.json(team);
  } catch (error) {
    console.error('Failed to update team:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

router.delete('/teams/:id', authenticate, requireOperator, async (req, res) => {
  try {
    const teamId = req.params.id;
    const { confirmPassword } = req.body || {};

    if (!confirmPassword) {
      return res.status(400).json({ error: '削除確認のためパスワードを入力してください' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(401).json({ error: '認証エラー' });
    }

    const bcrypt = require('bcryptjs');
    const validPassword = await bcrypt.compare(confirmPassword, user.password);
    if (!validPassword) {
      return res.status(403).json({ error: 'パスワードが正しくありません' });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        children: true,
        _count: { select: { players: true } }
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (team.children.length > 0) {
      return res.status(400).json({ error: 'サブカテゴリーを含むチームは削除できません。先にサブカテゴリーを削除してください。' });
    }

    if (team._count.players > 0) {
      return res.status(400).json({ error: '選手が所属しているチームは削除できません。先に選手を移動または削除してください。' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.userTeam.deleteMany({ where: { teamId } });
      await tx.invitation.deleteMany({ where: { teamId } });
      await tx.evaluationItem.deleteMany({ where: { teamId } });
      await tx.evaluationRound.deleteMany({ where: { teamId } });
      await tx.calendarEvent.deleteMany({ where: { teamId } });
      await tx.announcement.deleteMany({ where: { teamId } });
      await tx.goalCategory.deleteMany({ where: { teamId } });
      await tx.team.delete({ where: { id: teamId } });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

router.get('/system-settings', authenticate, requireOperator, async (req, res) => {
  try {
    res.json(readSystemSettings());
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch system settings' });
  }
});

router.put('/system-settings', authenticate, requireOperator, async (req, res) => {
  try {
    const current = readSystemSettings();
    const updated = { ...current, ...req.body, updatedAt: new Date().toISOString() };
    writeSystemSettings(updated);
    res.json(updated);
  } catch (error) {
    console.error('Failed to save system settings:', error);
    res.status(500).json({ error: 'Failed to save system settings' });
  }
});

router.get('/system-stats', authenticate, requireOperator, async (req, res) => {
  try {
    const [totalTeams, totalUsers, totalPlayers, totalEvaluations, totalVideos, totalNotifications, totalAnnouncements, totalCalendarEvents, totalGoals, totalTasks] = await Promise.all([
      prisma.team.count({ where: { parentId: null } }),
      prisma.user.count(),
      prisma.player.count(),
      prisma.evaluation.count(),
      prisma.video.count(),
      prisma.notification.count(),
      prisma.announcement.count(),
      prisma.calendarEvent.count(),
      prisma.goal.count(),
      prisma.task.count(),
    ]);
    res.json({ totalTeams, totalUsers, totalPlayers, totalEvaluations, totalVideos, totalNotifications, totalAnnouncements, totalCalendarEvents, totalGoals, totalTasks });
  } catch (error) {
    console.error('Failed to fetch system stats:', error);
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
});

router.get('/notification-stats', authenticate, requireOperator, async (req, res) => {
  try {
    const [totalNotifications, readNotifications, usersWithSettings] = await Promise.all([
      prisma.notification.count(),
      prisma.notification.count({ where: { isRead: true } }),
      prisma.notificationSetting.count(),
    ]);
    const readRate = totalNotifications > 0 ? Math.round((readNotifications / totalNotifications) * 100) : 0;
    res.json({ totalNotifications, readRate, usersWithSettings });
  } catch (error) {
    console.error('Failed to fetch notification stats:', error);
    res.status(500).json({ error: 'Failed to fetch notification stats' });
  }
});

router.get('/recent-notifications', authenticate, requireOperator, async (req, res) => {
  try {
    const broadcasts = await prisma.$queryRaw`
      SELECT 
        "broadcastId",
        MIN(id) as id,
        MIN(title) as title,
        MIN(message) as message,
        MIN("createdAt") as "createdAt",
        MIN("targetType") as "targetType",
        MIN("targetTeamName") as "targetTeamName",
        MIN("senderName") as "senderName",
        COUNT(*)::int as "recipientCount"
      FROM "Notification"
      WHERE type = 'BROADCAST' AND "broadcastId" IS NOT NULL
      GROUP BY "broadcastId"
      ORDER BY MIN("createdAt") DESC
      LIMIT 20
    `;
    res.json(broadcasts);
  } catch (error) {
    console.error('Failed to fetch recent notifications:', error);
    res.json([]);
  }
});

router.post('/broadcast-notification', authenticate, requireOperator, async (req, res) => {
  try {
    const { title, message, targetType, targetTeamId } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'タイトルとメッセージは必須です' });
    }

    const { v4: uuidv4 } = require('uuid');
    const broadcastId = uuidv4();
    let targetUserIds;
    let targetTeamName = null;

    if (targetType === 'team' && targetTeamId) {
      const team = await prisma.team.findUnique({
        where: { id: targetTeamId },
        select: { name: true }
      });
      targetTeamName = team?.name;

      const userTeams = await prisma.userTeam.findMany({
        where: { teamId: targetTeamId },
        select: { userId: true },
        distinct: ['userId'],
      });
      targetUserIds = userTeams.map(ut => ut.userId);
    } else {
      const users = await prisma.user.findMany({ select: { id: true } });
      targetUserIds = users.map(u => u.id);
    }

    const uniqueUserIds = [...new Set(targetUserIds)];

    if (uniqueUserIds.length === 0) {
      return res.status(400).json({ error: '対象ユーザーがいません' });
    }

    await prisma.notification.createMany({
      data: uniqueUserIds.map(userId => ({
        userId,
        type: 'BROADCAST',
        title,
        message,
        isRead: false,
        broadcastId,
        targetType: targetType || 'all',
        targetTeamName: targetTeamName,
        senderName: req.user.name || '管理者',
      })),
    });

    res.json({ count: uniqueUserIds.length });
  } catch (error) {
    console.error('Failed to send broadcast notification:', error);
    res.status(500).json({ error: '通知の送信に失敗しました' });
  }
});

router.post('/teams/import-csv', authenticate, requireOperator, csvUpload.single('file'), async (req, res) => {
  try {
    const isSuperAdmin = req.user.organizations?.some(o => o.role === 'SUPER_ADMIN');
    if (!isSuperAdmin) {
      const isAdmin = req.user.organizations?.some(o => ['ADMIN', 'OPERATOR'].includes(o.role));
      if (!isAdmin) {
        return res.status(403).json({ error: 'この操作にはスーパー管理者権限が必要です' });
      }
    }

    if (!req.file) {
      return res.status(400).json({ error: 'CSVファイルが選択されていません' });
    }

    const csvText = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return res.status(400).json({
        error: 'CSVの解析に失敗しました',
        details: parsed.errors.slice(0, 5).map(e => e.message),
      });
    }

    const userOrg = req.user.organizations?.[0];
    let orgId;
    if (userOrg) {
      orgId = userOrg.organizationId;
    } else {
      let defaultOrg = await prisma.organization.findFirst();
      if (!defaultOrg) {
        defaultOrg = await prisma.organization.create({ data: { name: 'Default Organization' } });
      }
      orgId = defaultOrg.id;
    }

    const results = { success: 0, skipped: 0, errors: [] };
    const validRows = [];

    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i];
      const teamName = (row.name || row['チーム名'] || '').trim();

      if (!teamName) {
        results.skipped++;
        results.errors.push({ row: i + 2, reason: 'チーム名が空です' });
        continue;
      }

      validRows.push({
        name: teamName,
        description: (row.description || row['説明'] || row.category || row['カテゴリー'] || '').trim() || null,
        league: (row.league || row['リーグ'] || '').trim() || null,
        region: (row.region || row['拠点地域'] || row['地域'] || '').trim() || null,
        organizationId: orgId,
      });
    }

    if (validRows.length === 0) {
      return res.json({
        success: 0,
        skipped: results.skipped,
        errors: results.errors,
        message: '有効なデータがありませんでした',
      });
    }

    const existingTeams = await prisma.team.findMany({
      where: {
        organizationId: orgId,
        name: { in: validRows.map(r => r.name) },
        parentId: null,
      },
      select: { name: true },
    });
    const existingNames = new Set(existingTeams.map(t => t.name));

    const newRows = [];
    for (const row of validRows) {
      if (existingNames.has(row.name)) {
        results.skipped++;
        results.errors.push({ row: 0, reason: `「${row.name}」は既に登録済みです` });
      } else {
        newRows.push(row);
      }
    }

    if (newRows.length > 0) {
      const created = await prisma.team.createMany({
        data: newRows,
        skipDuplicates: true,
      });
      results.success = created.count;
    }

    res.json({
      success: results.success,
      skipped: results.skipped,
      total: parsed.data.length,
      errors: results.errors.slice(0, 20),
      message: `${results.success}件のチームを登録しました`,
    });
  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ error: 'CSVインポートに失敗しました' });
  }
});

router.delete('/notifications/:id', authenticate, requireOperator, async (req, res) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.type === 'BROADCAST' && notification.broadcastId) {
      await prisma.notification.deleteMany({
        where: { broadcastId: notification.broadcastId },
      });
    } else {
      await prisma.notification.delete({ where: { id: req.params.id } });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;
