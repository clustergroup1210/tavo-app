const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { authenticate, hasTeamAccess } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

router.get('/', authenticate, async (req, res) => {
  try {
    const isOperator = req.user.organizations?.some(o => 
      ['OPERATOR_ADMIN', 'OPERATOR_MANAGER', 'OPERATOR_STAFF'].includes(o.role)
    );

    let teams;
    if (isOperator) {
      teams = await prisma.team.findMany({
        include: { organization: true, _count: { select: { players: true, users: true } } }
      });
    } else {
      const teamIds = req.user.teams?.map(t => t.teamId) || [];
      teams = await prisma.team.findMany({
        where: { id: { in: teamIds } },
        include: { organization: true, _count: { select: { players: true, users: true } } }
      });
    }

    res.json(teams);
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      include: {
        organization: true,
        players: true,
        users: { include: { user: true } },
        evaluationItems: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } }
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json(team);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { name, organizationId, description } = req.body;

    const team = await prisma.team.create({
      data: { name, organizationId, description }
    });

    await prisma.userTeam.create({
      data: { userId: req.user.id, teamId: team.id, role: 'TEAM_ADMIN' }
    });

    res.json(team);
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!hasTeamAccess(req.user, req.params.id, ['TEAM_ADMIN', 'TEAM_HEAD_COACH'])) {
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
    if (!hasTeamAccess(req.user, req.params.id, ['TEAM_ADMIN', 'TEAM_HEAD_COACH'])) {
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

module.exports = router;
