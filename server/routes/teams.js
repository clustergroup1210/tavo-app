const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { authenticate, hasTeamAccess } = require('../middleware/auth');
const { findCandidateParents } = require('../services/teamNameMatcher');

const router = express.Router();
const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

router.get('/public', async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      where: { parentId: null },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        description: true
      },
      orderBy: { sortOrder: 'asc' }
    });
    res.json(teams);
  } catch (error) {
    console.error('Get public teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const isOperator = req.user.organizations?.some(o => 
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );

    let teams;
    if (isOperator) {
      teams = await prisma.team.findMany({
        where: { parentId: null },
        include: { 
          organization: true, 
          _count: { select: { players: { where: { deletedAt: null } }, users: true } },
          children: {
            include: {
              _count: { select: { players: { where: { deletedAt: null } }, users: true } }
            },
            orderBy: { sortOrder: 'asc' }
          }
        },
        orderBy: { sortOrder: 'asc' }
      });
    } else {
      const teamIds = req.user.teams?.map(t => t.teamId) || [];
      teams = await prisma.team.findMany({
        where: { id: { in: teamIds }, parentId: null },
        include: { 
          organization: true, 
          _count: { select: { players: { where: { deletedAt: null } }, users: true } },
          children: {
            where: { id: { in: teamIds } },
            include: {
              _count: { select: { players: { where: { deletedAt: null } }, users: true } }
            },
            orderBy: { sortOrder: 'asc' }
          }
        },
        orderBy: { sortOrder: 'asc' }
      });
    }

    res.json(teams);
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

router.get('/suggestions', authenticate, async (req, res) => {
  try {
    const name = (req.query.name || '').toString().trim();
    if (!name || name.length < 2) {
      return res.json({ candidates: [] });
    }

    const operatorOrgs = (req.user.organizations || []).filter(o =>
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );
    const managerTeamIds = (req.user.teams || [])
      .filter(t => ['TEAM_MANAGER', 'COACH'].includes(t.role))
      .map(t => t.teamId);

    if (operatorOrgs.length === 0 && managerTeamIds.length === 0) {
      return res.json({ candidates: [] });
    }

    let orgId;
    if (operatorOrgs.length > 0) {
      orgId = operatorOrgs[0].organizationId;
    } else {
      const team = await prisma.team.findFirst({
        where: { id: { in: managerTeamIds } },
        select: { organizationId: true },
      });
      orgId = team?.organizationId;
    }
    if (!orgId) return res.json({ candidates: [] });

    const candidates = await findCandidateParents(orgId, name);
    res.json({ candidates });
  } catch (error) {
    console.error('Get team suggestions error:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      include: {
        organization: true,
        parent: true,
        children: {
          include: { _count: { select: { players: { where: { deletedAt: null } } } } },
          orderBy: { sortOrder: 'asc' }
        },
        players: { where: { deletedAt: null } },
        users: { include: { user: true } },
        evaluationItems: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } }
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (team.children?.length > 0 && team.players.length === 0) {
      const childTeamIds = team.children.map(c => c.id);
      const childPlayers = await prisma.player.findMany({
        where: { teamId: { in: childTeamIds }, deletedAt: null }
      });
      team.players = childPlayers;
    }

    res.json(team);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { name, organizationId, description, parentId, league, region, teamCode } = req.body;
    const { resolveTeamCode } = require('../services/teamCode');

    let orgId = organizationId;

    if (parentId) {
      const parent = await prisma.team.findUnique({ where: { id: parentId } });
      if (!parent) {
        return res.status(400).json({ error: '指定された親チームが見つかりません' });
      }

      const isOperator = req.user.organizations?.some(o =>
        ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role) && o.organizationId === parent.organizationId
      );
      const isParentManager = req.user.teams?.some(t =>
        t.teamId === parentId && ['TEAM_MANAGER', 'COACH'].includes(t.role)
      );
      if (!isOperator && !isParentManager) {
        return res.status(403).json({ error: 'この親チームの下にチームを作成する権限がありません' });
      }
      orgId = parent.organizationId;
    }

    if (!orgId) {
      const userOrg = req.user.organizations?.[0];
      if (userOrg) {
        orgId = userOrg.organizationId;
      } else {
        let defaultOrg = await prisma.organization.findFirst();
        if (!defaultOrg) {
          defaultOrg = await prisma.organization.create({
            data: { name: 'Default Organization' }
          });
        }
        orgId = defaultOrg.id;
      }
    }

    const userProvidedCode = teamCode !== undefined && teamCode !== null && String(teamCode).trim() !== '';
    const maxAttempts = userProvidedCode ? 1 : 5;
    let team;
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let resolvedCode;
      try {
        resolvedCode = await resolveTeamCode(prisma, teamCode);
      } catch (e) {
        return res.status(e.statusCode || 500).json({ error: e.message || 'チームIDの解決に失敗しました' });
      }
      try {
        team = await prisma.team.create({
          data: { name, organizationId: orgId, description, parentId: parentId || null, league: league?.trim() || null, region: region?.trim() || null, teamCode: resolvedCode }
        });
        break;
      } catch (e) {
        if (e?.code === 'P2002' && Array.isArray(e?.meta?.target) && e.meta.target.includes('teamCode')) {
          if (userProvidedCode) {
            return res.status(409).json({ error: '指定されたチームIDは既に使用されています' });
          }
          lastError = e;
          continue;
        }
        throw e;
      }
    }
    if (!team) {
      console.error('Auto-generated team code conflict after retries:', lastError);
      return res.status(503).json({ error: 'チームIDの発行に失敗しました。もう一度お試しください' });
    }

    await prisma.userTeam.create({
      data: { userId: req.user.id, teamId: team.id, role: 'TEAM_MANAGER' }
    });

    res.json(team);
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

router.get('/:id/stats', authenticate, async (req, res) => {
  try {
    const teamId = req.params.id;
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { children: { select: { id: true } } }
    });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const allTeamIds = [teamId, ...team.children.map(c => c.id)];

    const [playerCount, evaluationItemCount, roundCount, evaluationCount, videoCount, calendarEventCount, announcementCount, goalCategoryCount] = await Promise.all([
      prisma.player.count({ where: { teamId: { in: allTeamIds }, deletedAt: null } }),
      prisma.evaluationItem.count({ where: { teamId: { in: allTeamIds } } }),
      prisma.evaluationRound.count({ where: { teamId: { in: allTeamIds } } }),
      prisma.evaluation.count({ where: { player: { teamId: { in: allTeamIds }, deletedAt: null } } }),
      prisma.video.count({ where: { teamId: { in: allTeamIds } } }),
      prisma.calendarEvent.count({ where: { teamId: { in: allTeamIds } } }),
      prisma.announcement.count({ where: { teamId: { in: allTeamIds } } }),
      prisma.goalCategory.count({ where: { teamId: { in: allTeamIds } } }),
    ]);

    res.json({ playerCount, evaluationItemCount, roundCount, evaluationCount, videoCount, calendarEventCount, announcementCount, goalCategoryCount });
  } catch (error) {
    console.error('Failed to fetch team stats:', error);
    res.status(500).json({ error: 'Failed to fetch team stats' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!hasTeamAccess(req.user, req.params.id, ['TEAM_MANAGER', 'COACH'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const team = await prisma.team.update({
      where: { id: req.params.id },
      data: { name, description }
    });

    res.json(team);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update team' });
  }
});

router.post('/:id/logo', authenticate, upload.single('logo'), async (req, res) => {
  try {
    if (!hasTeamAccess(req.user, req.params.id, ['TEAM_MANAGER', 'COACH'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`;
    const team = await prisma.team.update({
      where: { id: req.params.id },
      data: { logoUrl }
    });

    res.json(team);
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

router.get('/:id/staff', authenticate, async (req, res) => {
  try {
    const isOperator = req.user.organizations?.some(o => 
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );
    
    if (!isOperator && !hasTeamAccess(req.user, req.params.id, ['TEAM_MANAGER', 'COACH'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const staff = await prisma.userTeam.findMany({
      where: {
        teamId: req.params.id,
        role: { in: ['TEAM_MANAGER', 'COACH', 'COACH', 'GUEST_COACH'] }
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(staff);
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: 'スタッフの取得に失敗しました' });
  }
});

router.post('/:id/members', authenticate, async (req, res) => {
  try {
    if (!hasTeamAccess(req.user, req.params.id, ['TEAM_MANAGER', 'COACH'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { email, role } = req.body;

    let user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    const existing = await prisma.userTeam.findFirst({
      where: { userId: user.id, teamId: req.params.id }
    });

    if (existing) {
      return res.status(400).json({ error: 'このユーザーは既にチームメンバーです' });
    }

    const userTeam = await prisma.userTeam.create({
      data: {
        userId: user.id,
        teamId: req.params.id,
        role: role
      },
      include: { user: true }
    });

    res.json(userTeam);
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'メンバーの追加に失敗しました' });
  }
});

router.delete('/:id/members/:userId', authenticate, async (req, res) => {
  try {
    if (!hasTeamAccess(req.user, req.params.id, ['TEAM_MANAGER', 'COACH'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.userTeam.deleteMany({
      where: {
        userId: req.params.userId,
        teamId: req.params.id
      }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'メンバーの削除に失敗しました' });
  }
});

router.put('/:id/head-coach', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const isOperator = req.user.organizations?.some(o => 
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );

    if (!hasTeamAccess(req.user, id, ['TEAM_MANAGER']) && !isOperator) {
      return res.status(403).json({ error: '代表監督を設定する権限がありません' });
    }

    const userTeam = await prisma.userTeam.findFirst({
      where: {
        userId,
        teamId: id,
        role: { in: ['COACH', 'GUEST_COACH', 'TEAM_MANAGER'] },
        isActive: true
      },
      include: { user: { select: { id: true, name: true, email: true } } }
    });

    if (!userTeam) {
      return res.status(400).json({ error: '指定されたユーザーはこのチームのスタッフではありません' });
    }

    const team = await prisma.team.update({
      where: { id },
      data: { headCoachId: userId },
      include: {
        headCoach: { select: { id: true, name: true, email: true } }
      }
    });

    res.json({
      success: true,
      headCoach: team.headCoach
    });
  } catch (error) {
    console.error('Set head coach error:', error);
    res.status(500).json({ error: '代表監督の設定に失敗しました' });
  }
});

router.delete('/:id/head-coach', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const isOperator = req.user.organizations?.some(o => 
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );

    if (!hasTeamAccess(req.user, id, ['TEAM_MANAGER']) && !isOperator) {
      return res.status(403).json({ error: '代表監督を解除する権限がありません' });
    }

    await prisma.team.update({
      where: { id },
      data: { headCoachId: null }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Remove head coach error:', error);
    res.status(500).json({ error: '代表監督の解除に失敗しました' });
  }
});

module.exports = router;
