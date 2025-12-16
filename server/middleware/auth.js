const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        organizations: true,
        teams: {
          include: { team: true }
        },
        players: true,
        parentPlayers: { include: { player: true } }
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const getUserRoles = (user) => {
  const roles = {
    organizationRoles: user.organizations || [],
    teamRoles: user.teams || [],
    isPlayer: user.players?.length > 0,
    isParent: user.parentPlayers?.length > 0
  };

  const isOperator = user.organizations?.some(o => 
    ['OPERATOR_ADMIN', 'OPERATOR_MANAGER', 'OPERATOR_STAFF', 'OPERATOR_EXTERNAL'].includes(o.role)
  );

  const teamAdminTeams = user.teams?.filter(t => 
    ['TEAM_ADMIN', 'TEAM_HEAD_COACH'].includes(t.role)
  ) || [];

  const coachTeams = user.teams?.filter(t => 
    ['TEAM_COACH', 'TEAM_EXTERNAL_COACH'].includes(t.role)
  ) || [];

  return {
    ...roles,
    isOperator,
    teamAdminTeams,
    coachTeams
  };
};

const hasTeamAccess = (user, teamId, requiredRoles = []) => {
  const isOperator = user.organizations?.some(o => 
    ['OPERATOR_ADMIN', 'OPERATOR_MANAGER'].includes(o.role)
  );
  if (isOperator) return true;

  const teamRole = user.teams?.find(t => t.teamId === teamId);
  if (!teamRole) return false;

  if (requiredRoles.length === 0) return true;
  return requiredRoles.includes(teamRole.role);
};

module.exports = { authenticate, getUserRoles, hasTeamAccess, JWT_SECRET };
