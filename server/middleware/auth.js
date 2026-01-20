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

const OPERATIONS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'EXTERNAL'];
const TEAM_MANAGER_ROLES = ['TEAM_MANAGER'];
const COACH_ROLES = ['COACH'];
const GUEST_COACH_ROLES = ['GUEST_COACH'];

const ROLE_HIERARCHY = {
  SUPER_ADMIN: 100,
  ADMIN: 90,
  OPERATOR: 80,
  EXTERNAL: 10,
  TEAM_MANAGER: 70,
  COACH: 60,
  GUEST_COACH: 50,
  PLAYER: 20,
  PARENT: 15
};

const getUserRoles = (user) => {
  const roles = {
    organizationRoles: user.organizations || [],
    teamRoles: user.teams || [],
    isPlayer: user.players?.length > 0,
    isParent: user.parentPlayers?.length > 0
  };

  const isOperator = user.organizations?.some(o => 
    OPERATIONS_ROLES.includes(o.role)
  );

  const teamManagerTeams = user.teams?.filter(t => 
    TEAM_MANAGER_ROLES.includes(t.role)
  ) || [];

  const coachTeams = user.teams?.filter(t => 
    COACH_ROLES.includes(t.role)
  ) || [];

  const guestCoachTeams = user.teams?.filter(t => 
    GUEST_COACH_ROLES.includes(t.role)
  ) || [];

  let highestRole = null;
  let highestLevel = -1;

  for (const org of user.organizations || []) {
    const level = ROLE_HIERARCHY[org.role] || 0;
    if (level > highestLevel) {
      highestLevel = level;
      highestRole = org.role;
    }
  }

  for (const team of user.teams || []) {
    const level = ROLE_HIERARCHY[team.role] || 0;
    if (level > highestLevel) {
      highestLevel = level;
      highestRole = team.role;
    }
  }

  if (user.players?.length > 0 && ROLE_HIERARCHY['PLAYER'] > highestLevel) {
    highestLevel = ROLE_HIERARCHY['PLAYER'];
    highestRole = 'PLAYER';
  }

  if (user.parentPlayers?.length > 0 && ROLE_HIERARCHY['PARENT'] > highestLevel) {
    highestRole = 'PARENT';
  }

  return {
    ...roles,
    isOperator,
    teamManagerTeams,
    teamAdminTeams: teamManagerTeams,
    coachTeams,
    guestCoachTeams,
    highestRole
  };
};

const hasTeamAccess = (user, teamId, requiredRoles = []) => {
  const isOperator = user.organizations?.some(o => 
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
  );
  if (isOperator) return true;

  const teamRole = user.teams?.find(t => t.teamId === teamId);
  if (!teamRole) return false;

  if (requiredRoles.length === 0) return true;
  return requiredRoles.includes(teamRole.role);
};

module.exports = { authenticate, getUserRoles, hasTeamAccess, JWT_SECRET };
