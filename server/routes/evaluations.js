const express = require('express');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const Papa = require('papaparse');
const { authenticate, hasTeamAccess, canEvaluatePlayer } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');
const { filterDataByVisibility } = require('../services/dataVisibilityService');

const router = express.Router();
const prisma = new PrismaClient();

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const mt = file.mimetype || '';
    if (
      name.endsWith('.csv') ||
      mt === 'text/csv' ||
      mt === 'application/csv' ||
      mt === 'application/vnd.ms-excel' ||
      mt.startsWith('text/')
    ) {
      cb(null, true);
    } else {
      cb(new Error('CSVファイルのみアップロードできます'), false);
    }
  }
});

function csvUploadMiddleware(req, res, next) {
  csvUpload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'ファイルアップロードに失敗しました' });
    }
    next();
  });
}

async function getPlayerTeamMembershipPeriods(playerId, teamId) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, parentId: true }
  });
  
  if (!team) return [];
  
  const teamIds = [teamId];
  if (team.parentId) {
    teamIds.push(team.parentId);
  }
  
  const childTeams = await prisma.team.findMany({
    where: { parentId: teamId },
    select: { id: true }
  });
  childTeams.forEach(ct => teamIds.push(ct.id));
  
  const histories = await prisma.playerTeamHistory.findMany({
    where: { 
      playerId, 
      teamId: { in: teamIds }
    },
    orderBy: { joinedAt: 'asc' }
  });
  
  if (histories.length > 0) {
    return histories.map(h => ({
      joinedAt: h.joinedAt,
      leftAt: h.leftAt
    }));
  }

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { teamId: true, joinedAt: true }
  });

  if (player && teamIds.includes(player.teamId)) {
    return [{
      joinedAt: player.joinedAt || new Date('2000-01-01'),
      leftAt: null
    }];
  }

  return [];
}

function isWithinMembershipPeriods(evalDate, periods) {
  if (!periods || periods.length === 0) return false;
  
  return periods.some(period => {
    if (evalDate < period.joinedAt) return false;
    if (period.leftAt && evalDate > period.leftAt) return false;
    return true;
  });
}

function isOperator(user) {
  return user.organizations?.some(o => 
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
  );
}

router.get('/', authenticate, async (req, res) => {
  try {
    const { playerId, roundId, evaluatorType } = req.query;

    if (!playerId || !roundId) {
      return res.status(400).json({ error: 'playerId and roundId are required' });
    }

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true, userId: true, teamId: true }
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const where = { playerId, roundId };
    if (evaluatorType) {
      where.raterType = evaluatorType;
    }

    const evaluations = await prisma.evaluation.findMany({
      where,
      include: {
        item: { include: { parent: true } },
        round: true,
        rater: { select: { id: true, name: true } }
      },
      orderBy: { evaluatedAt: 'desc' }
    });

    res.json(evaluations);
  } catch (error) {
    console.error('Fetch evaluations error:', error);
    res.status(500).json({ error: 'Failed to fetch evaluations' });
  }
});

router.get('/evaluable-players', authenticate, async (req, res) => {
  try {
    const { teamId } = req.query;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    const isOp = req.user.organizations?.some(o =>
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'EXTERNAL'].includes(o.role)
    );

    const teamRole = req.user.teams?.find(t => t.teamId === teamId);

    if (isOp || teamRole?.role === 'TEAM_MANAGER') {
      return res.json({ all: true, playerIds: [] });
    }

    if (['COACH', 'GUEST_COACH'].includes(teamRole?.role)) {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { headCoachId: true }
      });

      if (team?.headCoachId === req.user.id) {
        return res.json({ all: true, playerIds: [] });
      }

      const childTeams = await prisma.team.findMany({
        where: { parentId: teamId },
        select: { id: true }
      });
      const allTeamIds = [teamId, ...childTeams.map(t => t.id)];

      const assignments = await prisma.coachAssignment.findMany({
        where: { coachId: req.user.id, teamId: { in: allTeamIds } },
        select: { playerId: true }
      });

      return res.json({ all: false, playerIds: assignments.map(a => a.playerId) });
    }

    res.json({ all: false, playerIds: [] });
  } catch (error) {
    console.error('Evaluable players error:', error);
    res.status(500).json({ error: 'Failed to fetch evaluable players' });
  }
});

router.get('/items', authenticate, async (req, res) => {
  try {
    const { teamId, position, includeInactive } = req.query;
    
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, parentId: true }
    });
    
    const teamIds = [teamId];
    if (team?.parentId) {
      teamIds.push(team.parentId);
    }
    
    const where = { teamId: { in: teamIds } };
    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    const items = await prisma.evaluationItem.findMany({
      where,
      orderBy: { sortOrder: 'asc' }
    });

    const itemsById = {};
    items.forEach(item => { itemsById[item.id] = item; });

    const isPositionAllowed = (item, pos) => {
      if (item.targetPositions && item.targetPositions.length > 0) {
        if (!item.targetPositions.includes(pos)) return false;
      }
      if (item.parentId && itemsById[item.parentId]) {
        return isPositionAllowed(itemsById[item.parentId], pos);
      }
      return true;
    };

    const buildHierarchy = (items, parentId = null) => {
      return items
        .filter(item => item.parentId === parentId)
        .filter(item => !position || isPositionAllowed(item, position))
        .map(item => ({
          ...item,
          children: buildHierarchy(items, item.id)
        }));
    };

    res.json(buildHierarchy(items));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch evaluation items' });
  }
});

router.post('/items', authenticate, async (req, res) => {
  try {
    const { teamId, parentId, name, description, targetPositions, sortOrder } = req.body;

    if (!hasTeamAccess(req.user, teamId, ['TEAM_MANAGER', 'COACH']) && !isOperator(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const item = await prisma.evaluationItem.create({
      data: { 
        teamId, 
        parentId, 
        name, 
        description, 
        targetPositions: targetPositions || [],
        sortOrder: sortOrder || 0 
      }
    });

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create evaluation item' });
  }
});

router.post('/items/import-csv', authenticate, csvUploadMiddleware, async (req, res) => {
  try {
    const { teamId } = req.query;
    const mode = (req.query.mode || 'append').toLowerCase();

    if (!teamId) return res.status(400).json({ error: 'teamId is required' });
    if (!req.file) return res.status(400).json({ error: 'CSVファイルを添付してください' });
    if (!['append', 'replace'].includes(mode)) {
      return res.status(400).json({ error: 'mode must be append or replace' });
    }

    if (!hasTeamAccess(req.user, teamId, ['TEAM_MANAGER', 'COACH']) && !isOperator(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const csvText = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() });
    if (parsed.errors && parsed.errors.length > 0) {
      return res.status(400).json({ error: 'CSV解析に失敗しました', details: parsed.errors.slice(0, 5) });
    }

    const required = ['category', 'subCategory', 'name'];
    const headers = parsed.meta?.fields || [];
    const missing = required.filter(c => !headers.includes(c));
    if (missing.length) {
      return res.status(400).json({ error: `必須列が不足しています: ${missing.join(', ')}` });
    }

    const rowErrors = [];
    const cleanedRows = [];
    parsed.data.forEach((row, idx) => {
      const lineNo = idx + 2;
      const category = (row.category || '').trim();
      const subCategory = (row.subCategory || '').trim();
      const name = (row.name || '').trim();
      const description = (row.description || '').trim();
      if (!category || !subCategory || !name) {
        rowErrors.push({ line: lineNo, error: 'category/subCategory/name はいずれも必須です' });
        return;
      }
      cleanedRows.push({ category, subCategory, name, description });
    });

    if (cleanedRows.length === 0) {
      return res.status(400).json({ error: '有効な行が1件もありません', rowErrors });
    }

    const created = await prisma.$transaction(async (tx) => {
      // Long timeout: large CSVs loop many awaits inside the tx

      if (mode === 'replace') {
        const existing = await tx.evaluationItem.findMany({
          where: { teamId },
          select: { id: true }
        });
        const ids = existing.map(e => e.id);
        if (ids.length > 0) {
          const inUse = await tx.evaluation.count({ where: { itemId: { in: ids } } });
          if (inUse > 0) {
            throw Object.assign(new Error('既存の評価データがあるため全件入れ替えできません。append モードを使うか、既存評価を整理してください。'), { httpStatus: 409 });
          }
          await tx.evaluationItem.deleteMany({ where: { teamId } });
        }
      }

      const existingItems = await tx.evaluationItem.findMany({
        where: { teamId, isActive: true },
        select: { id: true, name: true, parentId: true }
      });
      const topByName = new Map();
      const subByParentName = new Map();
      existingItems.forEach(it => {
        if (!it.parentId) topByName.set(it.name, it.id);
      });
      existingItems.forEach(it => {
        if (it.parentId) subByParentName.set(`${it.parentId}::${it.name}`, it.id);
      });

      let topOrder = topByName.size;
      const subOrderByParent = new Map();
      const leafOrderByParent = new Map();

      let leafCount = 0;

      for (const row of cleanedRows) {
        let topId = topByName.get(row.category);
        if (!topId) {
          const top = await tx.evaluationItem.create({
            data: { teamId, parentId: null, name: row.category, sortOrder: topOrder++ }
          });
          topId = top.id;
          topByName.set(row.category, topId);
        }

        const subKey = `${topId}::${row.subCategory}`;
        let subId = subByParentName.get(subKey);
        if (!subId) {
          const order = subOrderByParent.get(topId) ?? 0;
          const sub = await tx.evaluationItem.create({
            data: { teamId, parentId: topId, name: row.subCategory, sortOrder: order }
          });
          subOrderByParent.set(topId, order + 1);
          subId = sub.id;
          subByParentName.set(subKey, subId);
        }

        const leafKey = `${subId}::${row.name}`;
        if (!subByParentName.has(leafKey)) {
          const order = leafOrderByParent.get(subId) ?? 0;
          await tx.evaluationItem.create({
            data: {
              teamId,
              parentId: subId,
              name: row.name,
              description: row.description || null,
              maxScore: 5,
              sortOrder: order
            }
          });
          leafOrderByParent.set(subId, order + 1);
          subByParentName.set(leafKey, true);
          leafCount++;
        }
      }

      return { leafCount };
    }, { timeout: 60000, maxWait: 10000 });

    res.json({
      success: true,
      mode,
      imported: created.leafCount,
      processedRows: cleanedRows.length,
      rowErrors
    });
  } catch (error) {
    if (error.httpStatus) return res.status(error.httpStatus).json({ error: error.message });
    console.error('Import CSV error:', error);
    res.status(500).json({ error: error.message || 'CSVインポートに失敗しました' });
  }
});

router.put('/items/:id', authenticate, async (req, res) => {
  try {
    const { name, description, targetPositions, sortOrder, isActive } = req.body;

    const item = await prisma.evaluationItem.findUnique({ where: { id: req.params.id } });
    if (!hasTeamAccess(req.user, item.teamId, ['TEAM_MANAGER', 'COACH']) && !isOperator(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (targetPositions !== undefined) updateData.targetPositions = targetPositions;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await prisma.evaluationItem.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update evaluation item' });
  }
});

router.get('/rounds', authenticate, async (req, res) => {
  try {
    const { teamId } = req.query;
    
    // Get team and check for parent team
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, parentId: true }
    });
    
    // Build list of team IDs to check (team + parent)
    const teamIds = [teamId];
    if (team?.parentId) {
      teamIds.push(team.parentId);
    }
    
    const rounds = await prisma.evaluationRound.findMany({
      where: { teamId: { in: teamIds } },
      orderBy: { startDate: 'desc' }
    });

    res.json(rounds);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch evaluation rounds' });
  }
});

router.post('/rounds', authenticate, async (req, res) => {
  try {
    const { teamId, name, startDate, endDate } = req.body;

    if (!hasTeamAccess(req.user, teamId, ['TEAM_MANAGER', 'COACH'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const round = await prisma.evaluationRound.create({
      data: {
        teamId,
        name,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null
      }
    });

    res.json(round);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create evaluation round' });
  }
});

router.get('/history/:playerId', authenticate, async (req, res) => {
  try {
    const player = await prisma.player.findUnique({
      where: { id: req.params.playerId },
      include: { team: { include: { parent: true } } }
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const isSelf = player.userId === req.user.id;
    const isParentUser = req.user.parentPlayers?.some(pp => pp.playerId === req.params.playerId);
    const isOp = isOperator(req.user);
    const hasAccess = hasTeamAccess(req.user, player.teamId, ['TEAM_MANAGER', 'COACH', 'GUEST_COACH']);

    if (!isSelf && !isParentUser && !isOp && !hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const teamIds = [player.teamId];
    if (player.team?.parentId) {
      teamIds.push(player.team.parentId);
    }

    const [allItems, rounds, evaluations] = await Promise.all([
      prisma.evaluationItem.findMany({
        where: { teamId: { in: teamIds }, isActive: true },
        orderBy: { sortOrder: 'asc' }
      }),
      prisma.evaluationRound.findMany({
        where: { teamId: { in: teamIds } },
        orderBy: { startDate: 'asc' }
      }),
      prisma.evaluation.findMany({
        where: { playerId: req.params.playerId },
        select: { itemId: true, roundId: true, score: true, raterType: true }
      })
    ]);

    const scoreMap = {};
    evaluations.forEach(e => {
      const key = `${e.roundId}_${e.itemId}_${e.raterType}`;
      scoreMap[key] = e.score;
    });

    const itemsById = {};
    allItems.forEach(item => { itemsById[item.id] = item; });

    const isPositionAllowed = (item, pos) => {
      if (item.targetPositions && item.targetPositions.length > 0) {
        if (!item.targetPositions.includes(pos)) return false;
      }
      if (item.parentId && itemsById[item.parentId]) {
        return isPositionAllowed(itemsById[item.parentId], pos);
      }
      return true;
    };

    const buildHierarchy = (items, parentId = null) => {
      return items
        .filter(item => item.parentId === parentId)
        .filter(item => !player.position || isPositionAllowed(item, player.position))
        .map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          maxScore: item.maxScore,
          parentId: item.parentId,
          children: buildHierarchy(items, item.id)
        }));
    };

    res.json({
      items: buildHierarchy(allItems),
      rounds: rounds.map(r => ({ id: r.id, name: r.name, startDate: r.startDate, endDate: r.endDate })),
      scoreMap
    });
  } catch (error) {
    console.error('Fetch evaluation history error:', error);
    res.status(500).json({ error: 'Failed to fetch evaluation history' });
  }
});

router.get('/player/:playerId', authenticate, async (req, res) => {
  try {
    const { roundId } = req.query;
    
    const player = await prisma.player.findUnique({
      where: { id: req.params.playerId },
      select: { id: true, userId: true, teamId: true }
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const where = { playerId: req.params.playerId };
    if (roundId) where.roundId = roundId;

    let evaluations = await prisma.evaluation.findMany({
      where,
      include: {
        item: true,
        round: true,
        rater: { select: { id: true, name: true } }
      },
      orderBy: { evaluatedAt: 'desc' }
    });

    const isSelf = player.userId === req.user.id;
    const isParent = req.user.parentPlayers?.some(pp => pp.playerId === req.params.playerId);
    const isOp = isOperator(req.user);

    if (!isSelf && !isParent && !isOp) {
      evaluations = await filterDataByVisibility(req.user, req.params.playerId, evaluations, 'evaluatedAt');
    }

    res.json(evaluations);
  } catch (error) {
    console.error('Fetch player evaluations error:', error);
    res.status(500).json({ error: 'Failed to fetch evaluations' });
  }
});

router.get('/form/:playerId', authenticate, async (req, res) => {
  try {
    const { roundId } = req.query;
    
    const player = await prisma.player.findUnique({
      where: { id: req.params.playerId },
      include: { team: { include: { parent: true } } }
    });
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const teamIds = [player.teamId];
    if (player.team?.parentId) {
      teamIds.push(player.team.parentId);
    }
    
    const allItems = await prisma.evaluationItem.findMany({
      where: { teamId: { in: teamIds }, isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    const itemsById = {};
    allItems.forEach(item => { itemsById[item.id] = item; });

    const isPositionAllowed = (item, pos) => {
      if (item.targetPositions && item.targetPositions.length > 0) {
        if (!item.targetPositions.includes(pos)) return false;
      }
      if (item.parentId && itemsById[item.parentId]) {
        return isPositionAllowed(itemsById[item.parentId], pos);
      }
      return true;
    };

    const buildHierarchy = (allList, parentId = null) => {
      return allList
        .filter(item => item.parentId === parentId)
        .filter(item => !player.position || isPositionAllowed(item, player.position))
        .map(item => ({
          ...item,
          children: buildHierarchy(allList, item.id)
        }));
    };

    const items = buildHierarchy(allItems);

    let existingEvaluations = { coach: {}, self: {} };
    let canSubmitCoach = true;
    let canSubmitSelf = true;
    let existingCoachRater = null;

    if (roundId) {
      const evaluations = await prisma.evaluation.findMany({
        where: { playerId: req.params.playerId, roundId },
        include: { rater: { select: { id: true, name: true } } }
      });

      evaluations.forEach(e => {
        if (e.raterType === 'COACH') {
          existingEvaluations.coach[e.itemId] = e.score;
          canSubmitCoach = false;
          existingCoachRater = e.rater;
        } else if (e.raterType === 'SELF') {
          existingEvaluations.self[e.itemId] = e.score;
          canSubmitSelf = false;
        }
      });
    }

    const canEval = await canEvaluatePlayer(req.user, req.params.playerId, player.teamId);
    const isCoach = canEval;
    const isSelf = player.userId === req.user.id;

    res.json({
      player: {
        id: player.id,
        name: player.name,
        position: player.position,
        teamId: player.teamId
      },
      items,
      existingEvaluations,
      permissions: {
        canSubmitCoach: isCoach && canSubmitCoach,
        canSubmitSelf: isSelf && canSubmitSelf,
        existingCoachRater
      }
    });
  } catch (error) {
    console.error('Evaluation form error:', error);
    res.status(500).json({ error: 'Failed to fetch evaluation form data' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { playerId, roundId, evaluations } = req.body;

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const isSelf = player.userId === req.user.id;
    const canEvaluate = await canEvaluatePlayer(req.user, playerId, player.teamId);
    const isCoach = canEvaluate;

    if (!isCoach && !isSelf) {
      return res.status(403).json({ error: 'この選手を評価する権限がありません' });
    }

    const raterType = isSelf && !isCoach ? 'SELF' : 'COACH';

    if (raterType === 'COACH') {
      const existingCoachEval = await prisma.evaluation.findFirst({
        where: {
          playerId,
          roundId,
          raterType: 'COACH'
        },
        include: { rater: { select: { id: true, name: true } } }
      });

      if (existingCoachEval && existingCoachEval.rater.id !== req.user.id) {
        return res.status(400).json({ 
          error: `このラウンドで既に${existingCoachEval.rater.name}が評価を行っています。1ラウンドにつき指導者評価は1名のみです。`
        });
      }
    }

    const existingEvals = await prisma.evaluation.findMany({
      where: {
        playerId,
        roundId,
        raterType
      }
    });

    const isUpdate = existingEvals.length > 0;

    if (isUpdate) {
      await prisma.$transaction([
        prisma.evaluation.deleteMany({
          where: {
            playerId,
            roundId,
            raterType
          }
        }),
        ...evaluations.map(e => prisma.evaluation.create({
          data: {
            playerId,
            itemId: e.itemId,
            roundId,
            score: e.score,
            raterUserId: req.user.id,
            raterType
          }
        }))
      ]);
    } else {
      await prisma.$transaction(
        evaluations.map(e => prisma.evaluation.create({
          data: {
            playerId,
            itemId: e.itemId,
            roundId,
            score: e.score,
            raterUserId: req.user.id,
            raterType
          }
        }))
      );
    }

    if (raterType === 'COACH' && player.userId) {
      createNotification({
        userId: player.userId,
        type: 'EVALUATION',
        title: '評価が完了しました',
        message: `${req.user.name}があなたの評価を行いました`,
        linkUrl: `/players/${playerId}?tab=evaluations`
      });
    } else if (raterType === 'SELF') {
      const coaches = await prisma.userTeam.findMany({
        where: {
          teamId: player.teamId,
          role: { in: ['TEAM_MANAGER', 'COACH', 'COACH'] },
          isActive: true
        },
        select: { userId: true }
      });
      for (const coach of coaches) {
        createNotification({
          userId: coach.userId,
          type: 'SELF_EVALUATION',
          title: '自己評価が提出されました',
          message: `${player.name}が自己評価を提出しました`,
          linkUrl: `/players/${playerId}?tab=evaluations`
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Create evaluation error:', error);
    res.status(500).json({ error: 'Failed to save evaluations' });
  }
});

router.delete('/', authenticate, async (req, res) => {
  try {
    const { playerId, roundId, raterType } = req.body;

    if (!playerId || !roundId || !raterType) {
      return res.status(400).json({ error: 'playerId, roundId, raterType are required' });
    }

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const isSelf = player.userId === req.user.id;
    const canEval = await canEvaluatePlayer(req.user, playerId, player.teamId);

    if (raterType === 'COACH' && !canEval) {
      return res.status(403).json({ error: 'この評価を削除する権限がありません' });
    }
    if (raterType === 'SELF' && !isSelf) {
      return res.status(403).json({ error: 'この評価を削除する権限がありません' });
    }

    if (raterType === 'COACH') {
      const existing = await prisma.evaluation.findFirst({
        where: { playerId, roundId, raterType: 'COACH' }
      });
      if (existing && existing.raterUserId !== req.user.id) {
        const isOp = isOperator(req.user);
        if (!isOp) {
          return res.status(403).json({ error: '他の指導者の評価は削除できません' });
        }
      }
    }

    const deleted = await prisma.evaluation.deleteMany({
      where: { playerId, roundId, raterType }
    });

    res.json({ deleted: deleted.count });
  } catch (error) {
    console.error('Delete evaluation error:', error);
    res.status(500).json({ error: 'Failed to delete evaluations' });
  }
});

router.get('/summary/:playerId', authenticate, async (req, res) => {
  try {
    const { raterType } = req.query;
    
    const where = { playerId: req.params.playerId };
    if (raterType) {
      where.raterType = raterType;
    }
    
    const evaluations = await prisma.evaluation.findMany({
      where,
      include: { item: true, round: true, rater: { select: { id: true, name: true } } },
      orderBy: { evaluatedAt: 'desc' }
    });

    const byItem = {};
    evaluations.forEach(e => {
      if (!byItem[e.itemId]) {
        byItem[e.itemId] = { item: e.item, evaluations: [] };
      }
      byItem[e.itemId].evaluations.push(e);
    });

    const summary = Object.values(byItem).map(({ item, evaluations }) => {
      const coachEvals = evaluations.filter(e => e.raterType === 'COACH');
      const selfEvals = evaluations.filter(e => e.raterType === 'SELF');
      
      const latestCoach = coachEvals[0];
      const latestSelf = selfEvals[0];
      const latest = latestCoach || latestSelf || evaluations[0];
      
      const progress = evaluations.length > 1 
        ? latest.score - evaluations[evaluations.length - 1].score 
        : 0;
      
      return {
        item,
        latestScore: latest?.score || 0,
        latestCoachScore: latestCoach?.score || null,
        latestSelfScore: latestSelf?.score || null,
        latestRound: latest?.round,
        progress,
        history: evaluations.slice(0, 10)
      };
    });

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch evaluation summary' });
  }
});

router.get('/comparison/:playerId', authenticate, async (req, res) => {
  try {
    const { roundId, mode } = req.query;
    const isCumulative = mode === 'cumulative';
    
    const player = await prisma.player.findUnique({
      where: { id: req.params.playerId },
      include: { team: { include: { parent: true } } }
    });
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const isSelf = player.userId === req.user.id;
    const isOp = isOperator(req.user);
    const isParentOfPlayer = req.user.parentPlayers?.some(pp => pp.playerId === player.id);
    
    let membershipPeriods = null;
    if (!isSelf && !isOp && !isParentOfPlayer) {
      const userTeamIds = req.user.teams?.map(t => t.teamId) || [];
      const playerTeamIds = [player.teamId, player.team?.parentId].filter(Boolean);
      const sharedTeamId = userTeamIds.find(tid => playerTeamIds.includes(tid));
      
      if (!sharedTeamId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      membershipPeriods = await getPlayerTeamMembershipPeriods(req.params.playerId, sharedTeamId);
      
      if (membershipPeriods.length === 0) {
        return res.status(403).json({ error: 'Access denied - no team membership found' });
      }
    }

    const itemTeamIds = [player.teamId];
    if (player.team?.parentId) itemTeamIds.push(player.team.parentId);

    const items = await prisma.evaluationItem.findMany({
      where: { teamId: { in: itemTeamIds }, isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    let allEvaluations = await prisma.evaluation.findMany({
      where: { playerId: req.params.playerId },
      include: { item: { include: { parent: { include: { parent: true } } } }, round: true },
      orderBy: { evaluatedAt: 'desc' }
    });

    if (membershipPeriods) {
      allEvaluations = allEvaluations.filter(e => 
        isWithinMembershipPeriods(new Date(e.evaluatedAt), membershipPeriods)
      );
    }

    const roundsMap = {};
    allEvaluations.forEach(e => {
      if (e.round && !roundsMap[e.roundId]) {
        roundsMap[e.roundId] = { id: e.roundId, name: e.round.name, startDate: e.round.startDate };
      }
    });
    const availableRounds = Object.values(roundsMap).sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    const evaluations = (!isCumulative && roundId)
      ? allEvaluations.filter(e => e.roundId === roundId)
      : allEvaluations;

    let coachEvals = {};
    let selfEvals = {};

    if (isCumulative) {
      const coachByItem = {};
      const selfByItem = {};
      allEvaluations.forEach(e => {
        if (e.raterType === 'COACH') {
          if (!coachByItem[e.itemId]) coachByItem[e.itemId] = { total: 0, count: 0 };
          coachByItem[e.itemId].total += e.score;
          coachByItem[e.itemId].count += 1;
        } else if (e.raterType === 'SELF') {
          if (!selfByItem[e.itemId]) selfByItem[e.itemId] = { total: 0, count: 0 };
          selfByItem[e.itemId].total += e.score;
          selfByItem[e.itemId].count += 1;
        }
      });
      Object.entries(coachByItem).forEach(([itemId, data]) => {
        coachEvals[itemId] = { score: Math.round((data.total / data.count) * 10) / 10 };
      });
      Object.entries(selfByItem).forEach(([itemId, data]) => {
        selfEvals[itemId] = { score: Math.round((data.total / data.count) * 10) / 10 };
      });
    } else {
      const latestRoundId = roundId || (evaluations.length > 0 ? evaluations[0].roundId : null);
      const latestEvals = evaluations.filter(e => e.roundId === latestRoundId);
      latestEvals.forEach(e => {
        if (e.raterType === 'COACH') {
          if (!coachEvals[e.itemId] || e.evaluatedAt > coachEvals[e.itemId].evaluatedAt) {
            coachEvals[e.itemId] = e;
          }
        } else if (e.raterType === 'SELF') {
          if (!selfEvals[e.itemId] || e.evaluatedAt > selfEvals[e.itemId].evaluatedAt) {
            selfEvals[e.itemId] = e;
          }
        }
      });
    }

    const selectedRoundId = isCumulative ? null : (roundId || (evaluations.length > 0 ? evaluations[0].roundId : null));

    const buildHierarchy = (items, parentId = null) => {
      return items
        .filter(item => item.parentId === parentId)
        .map(item => ({
          ...item,
          children: buildHierarchy(items, item.id)
        }));
    };

    const hierarchy = buildHierarchy(items);

    const flattenWithHierarchy = (items, category = null, subCategory = null) => {
      const result = [];
      items.forEach(item => {
        if (item.children && item.children.length > 0) {
          item.children.forEach(child => {
            if (child.children && child.children.length > 0) {
              child.children.forEach(leaf => {
                const coachScore = coachEvals[leaf.id]?.score ?? null;
                const selfScore = selfEvals[leaf.id]?.score ?? null;
                result.push({
                  itemId: leaf.id,
                  category: item.name,
                  subCategory: child.name,
                  itemName: leaf.name,
                  coachScore,
                  selfScore,
                  gap: coachScore !== null && selfScore !== null 
                    ? Math.round((coachScore - selfScore) * 10) / 10
                    : null
                });
              });
            } else {
              const coachScore = coachEvals[child.id]?.score ?? null;
              const selfScore = selfEvals[child.id]?.score ?? null;
              result.push({
                itemId: child.id,
                category: item.name,
                subCategory: null,
                itemName: child.name,
                coachScore,
                selfScore,
                gap: coachScore !== null && selfScore !== null 
                  ? Math.round((coachScore - selfScore) * 10) / 10
                  : null
              });
            }
          });
        } else {
          const coachScore = coachEvals[item.id]?.score ?? null;
          const selfScore = selfEvals[item.id]?.score ?? null;
          result.push({
            itemId: item.id,
            category: null,
            subCategory: null,
            itemName: item.name,
            coachScore,
            selfScore,
            gap: coachScore !== null && selfScore !== null 
              ? Math.round((coachScore - selfScore) * 10) / 10
              : null
          });
        }
      });
      return result;
    };

    const comparison = flattenWithHierarchy(hierarchy);

    res.json({
      roundId: selectedRoundId,
      comparison,
      hasData: evaluations.length > 0,
      availableRounds,
      mode: isCumulative ? 'cumulative' : 'round'
    });
  } catch (error) {
    console.error('Comparison error:', error);
    res.status(500).json({ error: 'Failed to fetch evaluation comparison' });
  }
});

router.get('/progress/:playerId', authenticate, async (req, res) => {
  try {
    const player = await prisma.player.findUnique({
      where: { id: req.params.playerId },
      include: { team: { include: { parent: true } } }
    });
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const isSelf = player.userId === req.user.id;
    const isOp = isOperator(req.user);
    const isParentOfPlayer = req.user.parentPlayers?.some(pp => pp.playerId === player.id);
    
    let membershipPeriods = null;
    if (!isSelf && !isOp && !isParentOfPlayer) {
      const userTeamIds = req.user.teams?.map(t => t.teamId) || [];
      const playerTeamIds = [player.teamId, player.team?.parentId].filter(Boolean);
      const sharedTeamId = userTeamIds.find(tid => playerTeamIds.includes(tid));
      
      if (!sharedTeamId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      membershipPeriods = await getPlayerTeamMembershipPeriods(req.params.playerId, sharedTeamId);
      
      if (membershipPeriods.length === 0) {
        return res.status(403).json({ error: 'Access denied - no team membership found' });
      }
    }

    let evaluations = await prisma.evaluation.findMany({
      where: { playerId: req.params.playerId },
      include: { 
        item: { include: { parent: true } }, 
        round: true 
      },
      orderBy: { evaluatedAt: 'asc' }
    });

    if (membershipPeriods) {
      evaluations = evaluations.filter(e => 
        isWithinMembershipPeriods(new Date(e.evaluatedAt), membershipPeriods)
      );
    }

    const byRound = {};
    evaluations.forEach(e => {
      const roundKey = e.roundId;
      if (!byRound[roundKey]) {
        byRound[roundKey] = {
          roundId: e.roundId,
          roundName: e.round.name,
          date: e.round.startDate,
          coach: { total: 0, count: 0, maxTotal: 0, categories: {} },
          self: { total: 0, count: 0, maxTotal: 0, categories: {} }
        };
      }
      
      const targetType = e.raterType === 'COACH' ? 'coach' : 'self';
      byRound[roundKey][targetType].total += e.score;
      byRound[roundKey][targetType].count += 1;
      byRound[roundKey][targetType].maxTotal += (e.item.maxScore || 5);

      const categoryName = e.item.parent?.name || e.item.name;
      if (!byRound[roundKey][targetType].categories[categoryName]) {
        byRound[roundKey][targetType].categories[categoryName] = { total: 0, count: 0, maxTotal: 0 };
      }
      byRound[roundKey][targetType].categories[categoryName].total += e.score;
      byRound[roundKey][targetType].categories[categoryName].count += 1;
      byRound[roundKey][targetType].categories[categoryName].maxTotal += (e.item.maxScore || 5);
    });

    const progressData = Object.values(byRound)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(r => {
        const coachTotal = r.coach.total;
        const selfTotal = r.self.total;
        const coachMaxTotal = r.coach.maxTotal;
        const selfMaxTotal = r.self.maxTotal;
        const coachAvg = r.coach.count > 0 ? (r.coach.total / r.coach.count).toFixed(1) : null;
        const selfAvg = r.self.count > 0 ? (r.self.total / r.self.count).toFixed(1) : null;
        
        const categoryData = {};
        const allCategories = new Set([
          ...Object.keys(r.coach.categories),
          ...Object.keys(r.self.categories)
        ]);
        
        allCategories.forEach(cat => {
          const coachCat = r.coach.categories[cat];
          const selfCat = r.self.categories[cat];
          categoryData[cat] = {
            coach: coachCat ? (coachCat.total / coachCat.count).toFixed(1) : null,
            self: selfCat ? (selfCat.total / selfCat.count).toFixed(1) : null,
            coachTotal: coachCat ? coachCat.total : 0,
            coachMaxTotal: coachCat ? coachCat.maxTotal : 0
          };
        });

        return {
          roundName: r.roundName,
          date: r.date,
          coachTotal: coachTotal > 0 ? coachTotal : null,
          selfTotal: selfTotal > 0 ? selfTotal : null,
          coachMaxTotal: coachMaxTotal > 0 ? coachMaxTotal : null,
          selfMaxTotal: selfMaxTotal > 0 ? selfMaxTotal : null,
          coachAvg: coachAvg ? parseFloat(coachAvg) : null,
          selfAvg: selfAvg ? parseFloat(selfAvg) : null,
          gap: coachAvg && selfAvg ? parseFloat((coachAvg - selfAvg).toFixed(1)) : null,
          categories: categoryData
        };
      });

    const allCategories = [...new Set(
      progressData.flatMap(d => Object.keys(d.categories))
    )];

    res.json({
      progressData,
      categories: allCategories
    });
  } catch (error) {
    console.error('Progress error:', error);
    res.status(500).json({ error: 'Failed to fetch progress data' });
  }
});

router.get('/heatmap/:playerId', authenticate, async (req, res) => {
  try {
    const player = await prisma.player.findUnique({
      where: { id: req.params.playerId },
      include: { team: { include: { parent: true } } }
    });
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const isSelf = player.userId === req.user.id;
    const isOp = isOperator(req.user);
    const isParentOfPlayer = req.user.parentPlayers?.some(pp => pp.playerId === player.id);
    
    let membershipPeriods = null;
    if (!isSelf && !isOp && !isParentOfPlayer) {
      const userTeamIds = req.user.teams?.map(t => t.teamId) || [];
      const playerTeamIds = [player.teamId, player.team?.parentId].filter(Boolean);
      const sharedTeamId = userTeamIds.find(tid => playerTeamIds.includes(tid));
      
      if (!sharedTeamId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      membershipPeriods = await getPlayerTeamMembershipPeriods(req.params.playerId, sharedTeamId);
      
      if (membershipPeriods.length === 0) {
        return res.status(403).json({ error: 'Access denied - no team membership found' });
      }
    }

    const heatmapItemTeamIds = [player.teamId];
    if (player.team?.parentId) heatmapItemTeamIds.push(player.team.parentId);

    const items = await prisma.evaluationItem.findMany({
      where: { teamId: { in: heatmapItemTeamIds }, isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    let evaluations = await prisma.evaluation.findMany({
      where: { playerId: req.params.playerId },
      orderBy: { evaluatedAt: 'desc' }
    });

    if (membershipPeriods) {
      evaluations = evaluations.filter(e => 
        isWithinMembershipPeriods(new Date(e.evaluatedAt), membershipPeriods)
      );
    }

    const latestByItem = {};
    evaluations.forEach(e => {
      if (!latestByItem[e.itemId]) {
        latestByItem[e.itemId] = e;
      }
    });

    const buildHierarchy = (items, parentId = null) => {
      return items
        .filter(item => item.parentId === parentId)
        .map(item => ({
          ...item,
          children: buildHierarchy(items, item.id)
        }));
    };

    const hierarchy = buildHierarchy(items);

    const flattenForHeatmap = (items, category = null) => {
      const result = [];
      items.forEach(item => {
        if (item.children && item.children.length > 0) {
          item.children.forEach(child => {
            if (child.children && child.children.length > 0) {
              child.children.forEach(leaf => {
                const eval_ = latestByItem[leaf.id];
                result.push({
                  id: leaf.id,
                  name: leaf.name,
                  category: item.name,
                  subCategory: child.name,
                  score: eval_?.score || 0,
                  percentage: eval_ ? (eval_.score / 5) * 100 : 0
                });
              });
            } else {
              const eval_ = latestByItem[child.id];
              result.push({
                id: child.id,
                name: child.name,
                category: item.name,
                subCategory: null,
                score: eval_?.score || 0,
                percentage: eval_ ? (eval_.score / 5) * 100 : 0
              });
            }
          });
        }
      });
      return result;
    };

    const heatmapData = flattenForHeatmap(hierarchy);

    const categoryGroups = {};
    heatmapData.forEach(item => {
      if (!categoryGroups[item.category]) {
        categoryGroups[item.category] = [];
      }
      categoryGroups[item.category].push(item);
    });

    res.json({
      heatmapData,
      categoryGroups
    });
  } catch (error) {
    console.error('Heatmap error:', error);
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
});

router.get('/ranking', authenticate, async (req, res) => {
  try {
    const { teamId, position, teamCategoryId } = req.query;

    if (!teamId) {
      return res.status(400).json({ error: 'teamId is required' });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { parent: true }
    });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const itemTeamIds = [teamId];
    if (team.parentId) itemTeamIds.push(team.parentId);

    const childTeams = await prisma.team.findMany({
      where: { parentId: teamId },
      select: { id: true }
    });
    const childTeamIds = childTeams.map(ct => ct.id);
    const playerTeamIds = childTeamIds.length > 0 ? [teamId, ...childTeamIds] : [teamId];

    const playerWhere = { teamId: { in: playerTeamIds }, deletedAt: null };
    if (position) playerWhere.position = position;
    if (teamCategoryId) playerWhere.teamCategoryId = teamCategoryId;

    const [players, leafItems, teamCategories] = await Promise.all([
      prisma.player.findMany({
        where: playerWhere,
        select: {
          id: true, name: true, number: true, position: true, photoUrl: true,
          joinedAt: true, graduationDate: true, createdAt: true,
          teamCategory: { select: { id: true, name: true } }
        }
      }),
      prisma.evaluationItem.findMany({
        where: { teamId: { in: itemTeamIds }, isActive: true, parentId: { not: null } },
        include: { parent: { include: { parent: true } } },
        orderBy: { sortOrder: 'asc' }
      }),
      prisma.teamCategory.findMany({
        where: { teamId: { in: playerTeamIds } },
        select: { id: true, name: true },
        orderBy: { sortOrder: 'asc' }
      })
    ]);

    const playerIds = players.map(p => p.id);
    const leafItemIds = leafItems.map(i => i.id);

    const evaluations = await prisma.evaluation.findMany({
      where: {
        playerId: { in: playerIds },
        itemId: { in: leafItemIds },
        raterType: 'COACH'
      },
      select: { playerId: true, itemId: true, score: true }
    });

    const allItemsById = {};
    leafItems.forEach(item => {
      allItemsById[item.id] = item;
      if (item.parent) {
        allItemsById[item.parent.id] = item.parent;
        if (item.parent.parent) {
          allItemsById[item.parent.parent.id] = item.parent.parent;
        }
      }
    });

    const isPositionAllowed = (item, pos) => {
      if (item.targetPositions && item.targetPositions.length > 0) {
        if (!item.targetPositions.includes(pos)) return false;
      }
      if (item.parentId && allItemsById[item.parentId]) {
        return isPositionAllowed(allItemsById[item.parentId], pos);
      }
      return true;
    };

    const filterItemsForPosition = (pos) => {
      return leafItems.filter(item => isPositionAllowed(item, pos));
    };

    const buildCategoryInfo = (filteredItems) => {
      const catItems = {};
      let maxTotal = 0;
      filteredItems.forEach(item => {
        const catName = item.parent?.name || 'その他';
        const catId = item.parentId;
        if (!catItems[catId]) {
          catItems[catId] = { id: catId, name: catName, items: [], monthlyMax: 0 };
        }
        catItems[catId].items.push(item);
        catItems[catId].monthlyMax += (item.maxScore || 5);
        maxTotal += (item.maxScore || 5);
      });
      return { categories: Object.values(catItems), monthlyMaxScoreTotal: maxTotal };
    };

    const evalByPlayer = {};
    evaluations.forEach(e => {
      if (!evalByPlayer[e.playerId]) evalByPlayer[e.playerId] = [];
      evalByPlayer[e.playerId].push(e);
    });

    const ranking = players.map(player => {
      const playerItems = filterItemsForPosition(player.position);
      const playerItemIds = new Set(playerItems.map(i => i.id));
      const { categories: playerCategories, monthlyMaxScoreTotal } = buildCategoryInfo(playerItems);

      const hasPeriod = !!(player.joinedAt && player.graduationDate);
      let totalMonths = null;
      let careerDenominator = 0;

      if (hasPeriod) {
        const joinDate = new Date(player.joinedAt);
        const gradDate = new Date(player.graduationDate);
        totalMonths = Math.max(1, (gradDate.getFullYear() - joinDate.getFullYear()) * 12 + (gradDate.getMonth() - joinDate.getMonth()) + 1);
        careerDenominator = totalMonths * monthlyMaxScoreTotal;
      }

      const playerEvals = (evalByPlayer[player.id] || []).filter(e => playerItemIds.has(e.itemId));
      let totalActual = 0;
      const catActuals = {};
      playerCategories.forEach(cat => { catActuals[cat.id] = 0; });

      playerEvals.forEach(e => {
        totalActual += e.score;
        const item = playerItems.find(i => i.id === e.itemId);
        if (item && catActuals[item.parentId] !== undefined) {
          catActuals[item.parentId] += e.score;
        }
      });

      const achievementRate = hasPeriod && careerDenominator > 0
        ? Math.round((totalActual / careerDenominator) * 1000) / 10
        : null;

      const categoryRates = {};
      playerCategories.forEach(cat => {
        if (hasPeriod && totalMonths) {
          const catDenom = totalMonths * cat.monthlyMax;
          categoryRates[cat.id] = {
            name: cat.name,
            actual: catActuals[cat.id],
            denominator: catDenom,
            rate: catDenom > 0 ? Math.round((catActuals[cat.id] / catDenom) * 1000) / 10 : 0
          };
        } else {
          categoryRates[cat.id] = {
            name: cat.name,
            actual: catActuals[cat.id],
            denominator: null,
            rate: null
          };
        }
      });

      return {
        player: {
          id: player.id, name: player.name, number: player.number,
          position: player.position, photoUrl: player.photoUrl,
          teamCategory: player.teamCategory
        },
        totalActual,
        careerDenominator,
        achievementRate,
        totalMonths,
        hasPeriod,
        categoryRates
      };
    });

    const gkRanking = ranking.filter(r => r.player.position === 'GK');
    const fpRanking = ranking.filter(r => r.player.position !== 'GK');

    fpRanking.sort((a, b) => {
      const aRate = a.achievementRate !== null ? a.achievementRate : -1;
      const bRate = b.achievementRate !== null ? b.achievementRate : -1;
      return bRate - aRate;
    });
    fpRanking.forEach((item, idx) => { item.rank = idx + 1; });

    gkRanking.sort((a, b) => {
      const aRate = a.achievementRate !== null ? a.achievementRate : -1;
      const bRate = b.achievementRate !== null ? b.achievementRate : -1;
      return bRate - aRate;
    });
    gkRanking.forEach((item, idx) => { item.rank = idx + 1; });

    const fpItems = filterItemsForPosition('FW');
    const gkItems = filterItemsForPosition('GK');
    const fpCategoryInfo = buildCategoryInfo(fpItems);
    const gkCategoryInfo = buildCategoryInfo(gkItems);

    res.json({
      ranking: fpRanking,
      gkRanking,
      categories: fpCategoryInfo.categories.map(c => ({ id: c.id, name: c.name })),
      gkCategories: gkCategoryInfo.categories.map(c => ({ id: c.id, name: c.name })),
      teamCategories
    });
  } catch (error) {
    console.error('Ranking error:', error);
    res.status(500).json({ error: 'Failed to fetch ranking data' });
  }
});

router.post('/rounds/:id/copy-previous', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const targetRound = await prisma.evaluationRound.findUnique({
      where: { id },
      include: { team: true }
    });

    if (!targetRound) {
      return res.status(404).json({ error: 'Round not found' });
    }

    if (!hasTeamAccess(req.user, targetRound.teamId, ['TEAM_MANAGER', 'COACH', 'COACH'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const previousRound = await prisma.evaluationRound.findFirst({
      where: {
        teamId: targetRound.teamId,
        startDate: { lt: targetRound.startDate }
      },
      orderBy: { startDate: 'desc' }
    });

    if (!previousRound) {
      return res.status(404).json({ error: 'No previous round found' });
    }

    const previousEvaluations = await prisma.evaluation.findMany({
      where: { roundId: previousRound.id }
    });

    if (previousEvaluations.length === 0) {
      return res.status(404).json({ error: 'No evaluations found in previous round' });
    }

    const existingEvaluations = await prisma.evaluation.findMany({
      where: { roundId: id },
      select: { playerId: true, itemId: true, raterType: true }
    });

    const existingKeys = new Set(
      existingEvaluations.map(e => `${e.playerId}-${e.itemId}-${e.raterType}`)
    );

    const newEvaluations = previousEvaluations
      .filter(e => !existingKeys.has(`${e.playerId}-${e.itemId}-${e.raterType}`))
      .map(e => ({
        playerId: e.playerId,
        itemId: e.itemId,
        roundId: id,
        score: e.score,
        raterUserId: req.user.id,
        raterType: e.raterType
      }));

    if (newEvaluations.length > 0) {
      await prisma.evaluation.createMany({ data: newEvaluations });
    }

    res.json({
      message: 'Evaluations copied successfully',
      copiedCount: newEvaluations.length,
      previousRoundName: previousRound.name
    });
  } catch (error) {
    console.error('Copy previous error:', error);
    res.status(500).json({ error: 'Failed to copy previous evaluations' });
  }
});

module.exports = router;
