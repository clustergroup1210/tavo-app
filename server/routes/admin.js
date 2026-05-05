const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Papa = require('papaparse');
const { findCandidateParents, extractCategoryToken, extractBaseName, findDuplicateGroups } = require('../services/teamNameMatcher');

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
        _count: { select: { players: { where: { deletedAt: null } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const teamsWithStats = await Promise.all(teams.map(async (team) => {
      const childTeamIds = team.children.map(c => c.id);
      const allTeamIds = [team.id, ...childTeamIds];
      
      const totalPlayerCount = await prisma.player.count({
        where: { teamId: { in: allTeamIds }, deletedAt: null }
      });

      return {
        id: team.id,
        name: team.name,
        teamCode: team.teamCode,
        logoUrl: team.logoUrl,
        league: team.league,
        region: team.region,
        status: team.status,
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
      prisma.player.count({ where: { deletedAt: null } }),
      prisma.user.count()
    ]);

    res.json({ totalTeams, totalPlayers, totalUsers });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/teams/duplicate-groups', authenticate, requireOperator, async (req, res) => {
  try {
    const operatorOrgs = (req.user.organizations || []).filter(o =>
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );
    if (operatorOrgs.length === 0) {
      return res.status(403).json({ error: 'この操作には権限がありません' });
    }
    const orgId = operatorOrgs[0].organizationId;
    const groups = await findDuplicateGroups(orgId);
    res.json({ groups });
  } catch (error) {
    console.error('Duplicate groups error:', error);
    res.status(500).json({ error: '重複検出に失敗しました' });
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
            _count: { select: { players: { where: { deletedAt: null } } } }
          }
        },
        users: {
          include: { user: { select: { id: true, name: true, email: true } } }
        },
        _count: { select: { players: { where: { deletedAt: null } } } }
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
    const { name, league, region, teamCode } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (league !== undefined) updateData.league = league?.trim() || null;
    if (region !== undefined) updateData.region = region?.trim() || null;
    if (teamCode !== undefined && teamCode !== null && String(teamCode).trim() !== '') {
      const { resolveTeamCode } = require('../services/teamCode');
      try {
        updateData.teamCode = await resolveTeamCode(prisma, teamCode, { excludeId: req.params.id });
      } catch (e) {
        return res.status(e.statusCode || 500).json({ error: e.message || 'チームIDの解決に失敗しました' });
      }
    }
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
      include: { children: true }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (team.children.length > 0) {
      return res.status(400).json({ error: 'サブカテゴリーを含むチームは削除できません。先にサブカテゴリーを削除してください。' });
    }

    const activePlayerCount = await prisma.player.count({
      where: { teamId, deletedAt: null }
    });
    if (activePlayerCount > 0) {
      return res.status(400).json({ error: '選手が所属しているチームは削除できません。先に選手を移動または削除してください。' });
    }

    await prisma.$transaction(async (tx) => {
      const softDeletedPlayers = await tx.player.findMany({
        where: { teamId, deletedAt: { not: null } },
        select: { id: true }
      });
      const softDeletedIds = softDeletedPlayers.map(p => p.id);
      if (softDeletedIds.length > 0) {
        const playerFilter = { playerId: { in: softDeletedIds } };
        await tx.evaluation.deleteMany({ where: playerFilter });
        await tx.appealLink.deleteMany({ where: playerFilter });
        await tx.invitation.deleteMany({ where: playerFilter });
        await tx.goal.deleteMany({ where: playerFilter });
        await tx.playerTeamHistory.deleteMany({ where: playerFilter });
        await tx.video.deleteMany({ where: playerFilter });
        await tx.player.deleteMany({ where: { id: { in: softDeletedIds } } });
      }
      await tx.userTeam.deleteMany({ where: { teamId } });
      await tx.invitation.deleteMany({ where: { teamId } });
      await tx.evaluationItem.deleteMany({ where: { teamId } });
      await tx.evaluationRound.deleteMany({ where: { teamId } });
      await tx.calendarEvent.deleteMany({ where: { teamId } });
      await tx.announcement.deleteMany({ where: { teamId } });
      await tx.goalCategory.deleteMany({ where: { teamId } });
      await tx.video.deleteMany({ where: { teamId } });
      await tx.transferHistory.deleteMany({
        where: { OR: [{ fromTeamId: teamId }, { toTeamId: teamId }] }
      });
      await tx.teamCategory.deleteMany({ where: { teamId } });
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
      prisma.player.count({ where: { deletedAt: null } }),
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

async function parseTeamCsvRows(req) {
  const isSuperAdmin = req.user.organizations?.some(o => o.role === 'SUPER_ADMIN');
  if (!isSuperAdmin) {
    const isAdmin = req.user.organizations?.some(o => ['ADMIN', 'OPERATOR'].includes(o.role));
    if (!isAdmin) {
      return { error: { status: 403, body: { error: 'この操作にはスーパー管理者権限が必要です' } } };
    }
  }

  if (!req.file) {
    return { error: { status: 400, body: { error: 'CSVファイルが選択されていません' } } };
  }

  const csvText = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    return {
      error: {
        status: 400,
        body: {
          error: 'CSVの解析に失敗しました',
          details: parsed.errors.slice(0, 5).map(e => e.message),
        },
      },
    };
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

  const skipped = [];
  const validRows = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const teamName = (row.team || row.name || row['チーム名'] || '').trim();

    if (!teamName) {
      skipped.push({ row: i + 2, reason: 'チーム名が空です' });
      continue;
    }

    const descriptionValue = (row.description || row['説明'] || row.category || row['カテゴリー'] || '').trim();
    const leagueValue = (row.league || row['リーグ'] || '').trim();
    const regionValue = (row.region || row['拠点地域'] || row['地域'] || '').trim();
    const teamCodeValue = (row.teamCode || row.team_code || row['チームID'] || row['チームコード'] || row['コード'] || '').trim();

    if (teamCodeValue && !/^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/.test(teamCodeValue)) {
      skipped.push({ row: i + 2, reason: `「${teamName}」のチームID「${teamCodeValue}」は形式が不正です` });
      continue;
    }

    validRows.push({
      rowNumber: i + 2,
      name: teamName,
      description: descriptionValue || null,
      league: leagueValue || null,
      region: regionValue || null,
      teamCode: teamCodeValue ? teamCodeValue.toUpperCase() : null,
      organizationId: orgId,
      status: 'PENDING',
      hasDescription: !!descriptionValue,
      hasLeague: !!leagueValue,
      hasRegion: !!regionValue,
      hasTeamCode: !!teamCodeValue,
    });
  }

  return { orgId, totalRowCount: parsed.data.length, validRows, skipped };
}

router.post('/teams/import-csv/analyze', authenticate, requireOperator, csvUpload.single('file'), async (req, res) => {
  try {
    const parseResult = await parseTeamCsvRows(req);
    if (parseResult.error) {
      return res.status(parseResult.error.status).json(parseResult.error.body);
    }
    const { orgId, totalRowCount, validRows, skipped } = parseResult;

    if (validRows.length === 0) {
      return res.json({ total: totalRowCount, rows: [], skipped });
    }

    const existingTeams = await prisma.team.findMany({
      where: {
        organizationId: orgId,
        name: { in: validRows.map(r => r.name) },
        parentId: null,
      },
      select: { id: true, name: true, description: true, league: true, region: true, teamCode: true },
    });
    const existingByName = new Map(existingTeams.map(t => [t.name, t]));

    const codesInRows = validRows.map(r => r.teamCode).filter(Boolean);
    const teamsByCode = codesInRows.length
      ? await prisma.team.findMany({
          where: { teamCode: { in: codesInRows } },
          select: { id: true, name: true, teamCode: true, organizationId: true },
        })
      : [];
    const existingByCode = new Map(teamsByCode.map(t => [t.teamCode, t]));

    const csvCodeCounts = new Map();
    for (const r of validRows) {
      if (r.hasTeamCode) csvCodeCounts.set(r.teamCode, (csvCodeCounts.get(r.teamCode) || 0) + 1);
    }

    const rows = [];
    for (const row of validRows) {
      const existing = existingByName.get(row.name);
      let codeConflict = null;
      if (row.hasTeamCode) {
        const codeOwner = existingByCode.get(row.teamCode);
        if (codeOwner && (!existing || codeOwner.id !== existing.id)) {
          codeConflict = {
            teamId: codeOwner.id,
            teamName: codeOwner.name,
            sameOrg: codeOwner.organizationId === orgId,
          };
        } else if (csvCodeCounts.get(row.teamCode) > 1) {
          codeConflict = { duplicateInCsv: true };
        }
      }
      if (existing) {
        rows.push({
          rowNumber: row.rowNumber,
          name: row.name,
          league: row.league,
          region: row.region,
          teamCode: row.teamCode,
          status: 'update',
          existingTeamId: existing.id,
          existingTeamCode: existing.teamCode,
          codeConflict,
          candidates: [],
        });
        continue;
      }

      const candidates = await findCandidateParents(orgId, row.name);
      rows.push({
        rowNumber: row.rowNumber,
        name: row.name,
        league: row.league,
        region: row.region,
        teamCode: row.teamCode,
        status: candidates.length > 0 ? 'merge_candidate' : 'new',
        codeConflict,
        candidates,
      });
    }

    res.json({ total: totalRowCount, rows, skipped });
  } catch (error) {
    console.error('CSV analyze error:', error);
    res.status(500).json({ error: 'CSV解析に失敗しました' });
  }
});

router.post('/teams/import-csv', authenticate, requireOperator, csvUpload.single('file'), async (req, res) => {
  try {
    const parseResult = await parseTeamCsvRows(req);
    if (parseResult.error) {
      return res.status(parseResult.error.status).json(parseResult.error.body);
    }
    const { orgId, totalRowCount, validRows, skipped } = parseResult;

    let mergeDecisions = {};
    if (req.body && req.body.mergeDecisions) {
      try {
        mergeDecisions = typeof req.body.mergeDecisions === 'string'
          ? JSON.parse(req.body.mergeDecisions)
          : req.body.mergeDecisions;
      } catch (e) {
        mergeDecisions = {};
      }
    }

    const results = { success: 0, updated: 0, skipped: 0, errors: [...skipped] };
    results.skipped = results.errors.length;

    if (validRows.length === 0) {
      return res.json({
        success: 0,
        updated: 0,
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
      select: { id: true, name: true, description: true, league: true, region: true, teamCode: true },
    });
    const existingByName = new Map(existingTeams.map(t => [t.name, t]));

    const { resolveTeamCode } = require('../services/teamCode');

    const isTeamCodeP2002 = (err) => {
      if (err?.code !== 'P2002') return false;
      const target = err?.meta?.target;
      if (Array.isArray(target)) return target.includes('teamCode');
      if (typeof target === 'string') return target.includes('teamCode');
      return false;
    };

    const createTeamWithCodeRetry = async (data, userProvidedCode) => {
      const maxAttempts = userProvidedCode ? 1 : 5;
      let lastErr;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const code = await resolveTeamCode(prisma, userProvidedCode || null);
          return await prisma.team.create({ data: { ...data, teamCode: code } });
        } catch (err) {
          lastErr = err;
          if (isTeamCodeP2002(err) && !userProvidedCode) continue;
          throw err;
        }
      }
      throw lastErr;
    };

    for (const row of validRows) {
      const decision = mergeDecisions[String(row.rowNumber)];

      if (decision === 'skip') {
        results.skipped++;
        results.errors.push({ row: row.rowNumber, reason: `「${row.name}」はスキップしました` });
        continue;
      }

      const existing = existingByName.get(row.name);

      if (decision && decision !== 'new') {
        const parent = await prisma.team.findFirst({
          where: { id: decision, organizationId: orgId, parentId: null },
          select: { id: true, organizationId: true },
        });
        if (!parent) {
          results.skipped++;
          results.errors.push({ row: row.rowNumber, reason: `「${row.name}」の親チームが見つかりません` });
          continue;
        }
        try {
          await createTeamWithCodeRetry({
            name: row.name,
            description: row.description,
            league: row.league,
            region: row.region,
            organizationId: parent.organizationId,
            parentId: parent.id,
            status: 'PENDING',
          }, row.hasTeamCode ? row.teamCode : null);
          results.success++;
        } catch (err) {
          results.skipped++;
          const reason = (err?.statusCode === 409 || isTeamCodeP2002(err))
            ? `「${row.name}」のチームID「${row.teamCode || ''}」は既に使用されています`
            : err?.statusCode === 400
              ? `「${row.name}」のチームIDの形式が不正です`
              : `「${row.name}」のサブチーム作成に失敗しました`;
          results.errors.push({ row: row.rowNumber, reason });
        }
        continue;
      }

      if (existing) {
        const updateData = {};
        if (row.hasDescription && row.description !== existing.description) {
          updateData.description = row.description;
        }
        if (row.hasLeague && row.league !== existing.league) {
          updateData.league = row.league;
        }
        if (row.hasRegion && row.region !== existing.region) {
          updateData.region = row.region;
        }
        if (row.hasTeamCode && row.teamCode !== existing.teamCode) {
          try {
            updateData.teamCode = await resolveTeamCode(prisma, row.teamCode, { excludeId: existing.id });
          } catch (err) {
            results.skipped++;
            results.errors.push({
              row: row.rowNumber,
              reason: err?.statusCode === 409
                ? `「${row.name}」のチームID「${row.teamCode}」は既に使用されています`
                : `「${row.name}」のチームIDの形式が不正です`,
            });
            continue;
          }
        }

        if (Object.keys(updateData).length > 0) {
          try {
            await prisma.team.update({
              where: { id: existing.id },
              data: updateData,
            });
            results.updated++;
          } catch (err) {
            results.skipped++;
            results.errors.push({ row: row.rowNumber, reason: `「${row.name}」の更新に失敗しました` });
          }
        } else {
          results.skipped++;
          results.errors.push({ row: row.rowNumber, reason: `「${row.name}」は変更がありません` });
        }
      } else {
        try {
          await createTeamWithCodeRetry({
            name: row.name,
            description: row.description,
            league: row.league,
            region: row.region,
            organizationId: row.organizationId,
            status: row.status,
          }, row.hasTeamCode ? row.teamCode : null);
          results.success++;
        } catch (err) {
          results.skipped++;
          const reason = (err?.statusCode === 409 || isTeamCodeP2002(err))
            ? `「${row.name}」のチームID「${row.teamCode || ''}」は既に使用されています`
            : err?.statusCode === 400
              ? `「${row.name}」のチームIDの形式が不正です`
              : err?.code === 'P2002'
                ? `「${row.name}」は既に登録されています`
                : `「${row.name}」の登録に失敗しました`;
          results.errors.push({ row: row.rowNumber, reason });
        }
      }
    }

    const messageParts = [];
    if (results.success > 0) messageParts.push(`${results.success}件登録`);
    if (results.updated > 0) messageParts.push(`${results.updated}件更新`);
    if (results.skipped > 0) messageParts.push(`${results.skipped}件スキップ`);

    res.json({
      success: results.success,
      updated: results.updated,
      skipped: results.skipped,
      total: totalRowCount,
      errors: results.errors.slice(0, 20),
      message: messageParts.length > 0 ? messageParts.join('、') : '処理対象がありませんでした',
    });
  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ error: 'CSVインポートに失敗しました' });
  }
});

router.post('/teams/merge-as-children', authenticate, requireOperator, async (req, res) => {
  try {
    const { parentId, childIds } = req.body || {};
    if (!parentId || !Array.isArray(childIds) || childIds.length === 0) {
      return res.status(400).json({ error: 'parentId と childIds が必要です' });
    }
    if (childIds.includes(parentId)) {
      return res.status(400).json({ error: '親チームを子チームに含めることはできません' });
    }

    const operatorOrgs = (req.user.organizations || []).filter(o =>
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );
    if (operatorOrgs.length === 0) {
      return res.status(403).json({ error: 'この操作には権限がありません' });
    }
    const operatorOrgIds = new Set(operatorOrgs.map(o => o.organizationId));

    const parent = await prisma.team.findUnique({
      where: { id: parentId },
      select: { id: true, organizationId: true, parentId: true },
    });
    if (!parent) return res.status(404).json({ error: '親チームが見つかりません' });
    if (parent.parentId) return res.status(400).json({ error: '親チームはトップレベルチームである必要があります' });
    if (!operatorOrgIds.has(parent.organizationId)) {
      return res.status(403).json({ error: 'この組織に対する権限がありません' });
    }

    const { errors, updatedCount } = await prisma.$transaction(async (tx) => {
      const parentLatest = await tx.team.findUnique({
        where: { id: parent.id },
        select: { id: true, organizationId: true, parentId: true },
      });
      if (!parentLatest || parentLatest.parentId) {
        throw Object.assign(new Error('親チームの状態が変更されました'), { httpStatus: 409 });
      }

      const children = await tx.team.findMany({
        where: { id: { in: childIds } },
        select: {
          id: true,
          name: true,
          organizationId: true,
          parentId: true,
          _count: { select: { children: true } },
        },
      });

      const errs = [];
      const eligibleIds = [];
      for (const id of childIds) {
        const c = children.find(x => x.id === id);
        if (!c) { errs.push({ id, reason: 'チームが見つかりません' }); continue; }
        if (c.organizationId !== parentLatest.organizationId) {
          errs.push({ id, reason: '親チームと異なる組織のため統合できません' }); continue;
        }
        if (c.parentId) { errs.push({ id, reason: 'すでにサブチームのため統合できません' }); continue; }
        if (c._count.children > 0) { errs.push({ id, reason: 'サブチームを持つチームは統合できません' }); continue; }
        eligibleIds.push(id);
      }

      let count = 0;
      if (eligibleIds.length > 0) {
        const result = await tx.team.updateMany({
          where: {
            id: { in: eligibleIds },
            parentId: null,
            organizationId: parentLatest.organizationId,
            children: { none: {} },
          },
          data: { parentId: parentLatest.id },
        });
        count = result.count;
        if (count !== eligibleIds.length) {
          throw Object.assign(
            new Error('統合中に他のユーザーがチーム構造を変更しました。やり直してください。'),
            { httpStatus: 409 }
          );
        }
      }
      return { errors: errs, updatedCount: count };
    });

    res.json({ merged: updatedCount, errors });
  } catch (error) {
    console.error('Merge teams error:', error);
    if (error.httpStatus) {
      return res.status(error.httpStatus).json({ error: error.message });
    }
    res.status(500).json({ error: 'チーム統合に失敗しました' });
  }
});

function requireSuperAdmin(req, res, next) {
  const isSuperAdmin = (req.user?.organizations || []).some(
    (o) => o.role === 'SUPER_ADMIN'
  );
  if (!isSuperAdmin) {
    return res.status(403).json({ error: 'この操作にはSUPER_ADMIN権限が必要です' });
  }
  next();
}

router.post('/teams/:id/invitation', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const team = await prisma.team.findUnique({ where: { id: req.params.id } });
    if (!team) {
      return res.status(404).json({ error: 'チームが見つかりません' });
    }
    if (team.status !== 'PENDING') {
      return res.status(400).json({ error: 'このチームは既に本登録済みのため、招待リンクは発行できません' });
    }

    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.teamInvitation.deleteMany({
      where: { teamId: team.id, usedAt: null },
    });

    const invitation = await prisma.teamInvitation.create({
      data: { teamId: team.id, token, expiresAt },
    });

    res.json({
      id: invitation.id,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      url: `/invite/team/${invitation.token}`,
    });
  } catch (error) {
    console.error('Failed to create team invitation:', error);
    res.status(500).json({ error: '招待リンクの作成に失敗しました' });
  }
});

router.get('/teams/:id/invitation', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const invitation = await prisma.teamInvitation.findFirst({
      where: { teamId: req.params.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!invitation) {
      return res.json(null);
    }
    res.json({
      id: invitation.id,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      url: `/invite/team/${invitation.token}`,
    });
  } catch (error) {
    console.error('Failed to fetch team invitation:', error);
    res.status(500).json({ error: '招待リンクの取得に失敗しました' });
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
