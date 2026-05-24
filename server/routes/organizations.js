const express = require('express');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = require('../lib/prisma');

router.get('/', authenticate, async (req, res) => {
  try {
    const isOperator = req.user.organizations?.some(o => 
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );

    if (!isOperator) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const organizations = await prisma.organization.findMany({
      include: {
        _count: { select: { teams: true, users: true } }
      }
    });

    res.json(organizations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const isAdmin = req.user.organizations?.some(o => o.role === 'SUPER_ADMIN');
    if (!isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name } = req.body;
    const organization = await prisma.organization.create({
      data: { name }
    });

    res.json(organization);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        teams: true,
        users: { include: { user: true } }
      }
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json(organization);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

module.exports = router;
