const prisma = require('../lib/prisma');

const RoleCategory = {
  OPERATIONS: 'OPERATIONS',
  TEAM: 'TEAM',
  USER: 'USER'
};

const RoleHierarchy = {
  SUPER_ADMIN: { category: RoleCategory.OPERATIONS, level: 100 },
  ADMIN: { category: RoleCategory.OPERATIONS, level: 90 },
  OPERATOR: { category: RoleCategory.OPERATIONS, level: 80 },
  EXTERNAL: { category: RoleCategory.OPERATIONS, level: 10 },
  TEAM_MANAGER: { category: RoleCategory.TEAM, level: 70 },
  COACH: { category: RoleCategory.TEAM, level: 60 },
  GUEST_COACH: { category: RoleCategory.TEAM, level: 50 },
  PLAYER: { category: RoleCategory.USER, level: 20 },
  PARENT: { category: RoleCategory.USER, level: 15 }
};

const Permission = {
  SYSTEM_SETTINGS: 'system:settings',
  AUDIT_LOGS: 'audit:logs',
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_DELETE_HARD: 'user:delete:hard',
  TEAM_CREATE: 'team:create',
  TEAM_READ: 'team:read',
  TEAM_UPDATE: 'team:update',
  TEAM_DELETE: 'team:delete',
  TEAM_DELETE_HARD: 'team:delete:hard',
  PLAYER_CREATE: 'player:create',
  PLAYER_READ: 'player:read',
  PLAYER_READ_OWN: 'player:read:own',
  PLAYER_UPDATE: 'player:update',
  PLAYER_UPDATE_OWN: 'player:update:own',
  PLAYER_DELETE: 'player:delete',
  PLAYER_DELETE_HARD: 'player:delete:hard',
  EVALUATION_CREATE: 'evaluation:create',
  EVALUATION_READ: 'evaluation:read',
  EVALUATION_READ_OWN: 'evaluation:read:own',
  EVALUATION_UPDATE: 'evaluation:update',
  EVALUATION_DELETE: 'evaluation:delete',
  EVALUATION_SELF: 'evaluation:self',
  VIDEO_CREATE: 'video:create',
  VIDEO_READ: 'video:read',
  VIDEO_UPDATE: 'video:update',
  VIDEO_DELETE: 'video:delete',
  VIDEO_COMMENT: 'video:comment',
  GOAL_CREATE: 'goal:create',
  GOAL_READ: 'goal:read',
  GOAL_READ_OWN: 'goal:read:own',
  GOAL_UPDATE: 'goal:update',
  GOAL_DELETE: 'goal:delete',
  CALENDAR_CREATE: 'calendar:create',
  CALENDAR_READ: 'calendar:read',
  CALENDAR_UPDATE: 'calendar:update',
  CALENDAR_DELETE: 'calendar:delete',
  ANNOUNCEMENT_CREATE: 'announcement:create',
  ANNOUNCEMENT_READ: 'announcement:read',
  ANNOUNCEMENT_UPDATE: 'announcement:update',
  ANNOUNCEMENT_DELETE: 'announcement:delete',
  INVITATION_CREATE: 'invitation:create',
  INVITATION_READ: 'invitation:read',
  INVITATION_DELETE: 'invitation:delete',
  STAFF_MANAGE: 'staff:manage',
  APPEAL_CREATE: 'appeal:create',
  APPEAL_READ: 'appeal:read',
  APPEAL_UPDATE: 'appeal:update',
  APPEAL_DELETE: 'appeal:delete',
  TRANSFER_EXECUTE: 'transfer:execute',
  NOTES_CREATE: 'notes:create',
  NOTES_READ: 'notes:read',
  NOTES_UPDATE: 'notes:update',
  NOTES_DELETE: 'notes:delete'
};

const RolePermissions = {
  SUPER_ADMIN: Object.values(Permission),

  ADMIN: [
    Permission.USER_CREATE, Permission.USER_READ, Permission.USER_UPDATE, Permission.USER_DELETE,
    Permission.TEAM_CREATE, Permission.TEAM_READ, Permission.TEAM_UPDATE, Permission.TEAM_DELETE,
    Permission.PLAYER_CREATE, Permission.PLAYER_READ, Permission.PLAYER_UPDATE, Permission.PLAYER_DELETE,
    Permission.EVALUATION_CREATE, Permission.EVALUATION_READ, Permission.EVALUATION_UPDATE, Permission.EVALUATION_DELETE,
    Permission.VIDEO_CREATE, Permission.VIDEO_READ, Permission.VIDEO_UPDATE, Permission.VIDEO_DELETE, Permission.VIDEO_COMMENT,
    Permission.GOAL_CREATE, Permission.GOAL_READ, Permission.GOAL_UPDATE, Permission.GOAL_DELETE,
    Permission.CALENDAR_CREATE, Permission.CALENDAR_READ, Permission.CALENDAR_UPDATE, Permission.CALENDAR_DELETE,
    Permission.ANNOUNCEMENT_CREATE, Permission.ANNOUNCEMENT_READ, Permission.ANNOUNCEMENT_UPDATE, Permission.ANNOUNCEMENT_DELETE,
    Permission.INVITATION_CREATE, Permission.INVITATION_READ, Permission.INVITATION_DELETE,
    Permission.STAFF_MANAGE,
    Permission.APPEAL_CREATE, Permission.APPEAL_READ, Permission.APPEAL_UPDATE, Permission.APPEAL_DELETE,
    Permission.TRANSFER_EXECUTE,
    Permission.NOTES_CREATE, Permission.NOTES_READ, Permission.NOTES_UPDATE, Permission.NOTES_DELETE
  ],

  OPERATOR: [
    Permission.USER_CREATE, Permission.USER_READ, Permission.USER_UPDATE, Permission.USER_DELETE,
    Permission.TEAM_CREATE, Permission.TEAM_READ, Permission.TEAM_UPDATE, Permission.TEAM_DELETE,
    Permission.PLAYER_CREATE, Permission.PLAYER_READ, Permission.PLAYER_UPDATE, Permission.PLAYER_DELETE,
    Permission.EVALUATION_CREATE, Permission.EVALUATION_READ, Permission.EVALUATION_UPDATE, Permission.EVALUATION_DELETE,
    Permission.VIDEO_CREATE, Permission.VIDEO_READ, Permission.VIDEO_UPDATE, Permission.VIDEO_DELETE, Permission.VIDEO_COMMENT,
    Permission.GOAL_CREATE, Permission.GOAL_READ, Permission.GOAL_UPDATE, Permission.GOAL_DELETE,
    Permission.CALENDAR_CREATE, Permission.CALENDAR_READ, Permission.CALENDAR_UPDATE, Permission.CALENDAR_DELETE,
    Permission.ANNOUNCEMENT_CREATE, Permission.ANNOUNCEMENT_READ, Permission.ANNOUNCEMENT_UPDATE, Permission.ANNOUNCEMENT_DELETE,
    Permission.INVITATION_CREATE, Permission.INVITATION_READ, Permission.INVITATION_DELETE,
    Permission.STAFF_MANAGE,
    Permission.APPEAL_CREATE, Permission.APPEAL_READ, Permission.APPEAL_UPDATE, Permission.APPEAL_DELETE,
    Permission.NOTES_CREATE, Permission.NOTES_READ, Permission.NOTES_UPDATE, Permission.NOTES_DELETE
  ],

  EXTERNAL: [
    Permission.TEAM_READ,
    Permission.PLAYER_READ,
    Permission.EVALUATION_READ, Permission.EVALUATION_CREATE,
    Permission.VIDEO_READ,
    Permission.CALENDAR_READ,
    Permission.ANNOUNCEMENT_READ
  ],

  TEAM_MANAGER: [
    Permission.PLAYER_CREATE, Permission.PLAYER_READ, Permission.PLAYER_UPDATE, Permission.PLAYER_DELETE,
    Permission.EVALUATION_CREATE, Permission.EVALUATION_READ, Permission.EVALUATION_UPDATE, Permission.EVALUATION_DELETE,
    Permission.VIDEO_CREATE, Permission.VIDEO_READ, Permission.VIDEO_UPDATE, Permission.VIDEO_DELETE, Permission.VIDEO_COMMENT,
    Permission.GOAL_CREATE, Permission.GOAL_READ, Permission.GOAL_UPDATE, Permission.GOAL_DELETE,
    Permission.CALENDAR_CREATE, Permission.CALENDAR_READ, Permission.CALENDAR_UPDATE, Permission.CALENDAR_DELETE,
    Permission.ANNOUNCEMENT_CREATE, Permission.ANNOUNCEMENT_READ, Permission.ANNOUNCEMENT_UPDATE, Permission.ANNOUNCEMENT_DELETE,
    Permission.INVITATION_CREATE, Permission.INVITATION_READ, Permission.INVITATION_DELETE,
    Permission.STAFF_MANAGE,
    Permission.APPEAL_CREATE, Permission.APPEAL_READ, Permission.APPEAL_UPDATE, Permission.APPEAL_DELETE,
    Permission.NOTES_CREATE, Permission.NOTES_READ, Permission.NOTES_UPDATE, Permission.NOTES_DELETE
  ],

  COACH: [
    Permission.PLAYER_READ, Permission.PLAYER_UPDATE,
    Permission.EVALUATION_CREATE, Permission.EVALUATION_READ, Permission.EVALUATION_UPDATE,
    Permission.VIDEO_CREATE, Permission.VIDEO_READ, Permission.VIDEO_UPDATE, Permission.VIDEO_COMMENT,
    Permission.GOAL_READ, Permission.GOAL_UPDATE,
    Permission.CALENDAR_CREATE, Permission.CALENDAR_READ, Permission.CALENDAR_UPDATE,
    Permission.ANNOUNCEMENT_READ,
    Permission.APPEAL_READ, Permission.APPEAL_UPDATE,
    Permission.NOTES_CREATE, Permission.NOTES_READ, Permission.NOTES_UPDATE
  ],

  GUEST_COACH: [
    Permission.PLAYER_READ,
    Permission.EVALUATION_CREATE, Permission.EVALUATION_READ,
    Permission.VIDEO_READ, Permission.VIDEO_COMMENT,
    Permission.GOAL_READ,
    Permission.CALENDAR_READ,
    Permission.ANNOUNCEMENT_READ
  ],

  PLAYER: [
    Permission.PLAYER_READ_OWN, Permission.PLAYER_UPDATE_OWN,
    Permission.EVALUATION_READ_OWN, Permission.EVALUATION_SELF,
    Permission.VIDEO_READ,
    Permission.GOAL_READ_OWN, Permission.GOAL_CREATE, Permission.GOAL_UPDATE,
    Permission.CALENDAR_READ,
    Permission.ANNOUNCEMENT_READ,
    Permission.APPEAL_CREATE, Permission.APPEAL_READ, Permission.APPEAL_UPDATE
  ],

  PARENT: [
    Permission.PLAYER_READ_OWN,
    Permission.EVALUATION_READ_OWN,
    Permission.VIDEO_READ,
    Permission.GOAL_READ_OWN,
    Permission.CALENDAR_READ,
    Permission.ANNOUNCEMENT_READ
  ]
};

function isOperationsRole(role) {
  return RoleHierarchy[role]?.category === RoleCategory.OPERATIONS;
}

function isTeamRole(role) {
  return RoleHierarchy[role]?.category === RoleCategory.TEAM;
}

function isUserRole(role) {
  return RoleHierarchy[role]?.category === RoleCategory.USER;
}

function getRoleLevel(role) {
  return RoleHierarchy[role]?.level || 0;
}

function hasPermission(role, permission) {
  if (!role || !RolePermissions[role]) return false;
  return RolePermissions[role].includes(permission);
}

function hasAnyPermission(role, permissions) {
  return permissions.some(p => hasPermission(role, p));
}

function hasAllPermissions(role, permissions) {
  return permissions.every(p => hasPermission(role, p));
}

async function getUserHighestRole(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organizations: true,
      teams: true,
      players: true,
      parentPlayers: true
    }
  });

  if (!user) return null;

  let highestRole = null;
  let highestLevel = -1;

  for (const org of user.organizations || []) {
    const level = getRoleLevel(org.role);
    if (level > highestLevel) {
      highestLevel = level;
      highestRole = org.role;
    }
  }

  for (const team of user.teams || []) {
    const level = getRoleLevel(team.role);
    if (level > highestLevel) {
      highestLevel = level;
      highestRole = team.role;
    }
  }

  if (user.players?.length > 0 && getRoleLevel('PLAYER') > highestLevel) {
    highestRole = 'PLAYER';
  }

  if (user.parentPlayers?.length > 0 && getRoleLevel('PARENT') > highestLevel) {
    highestRole = 'PARENT';
  }

  return highestRole;
}

async function getUserRolesForTeam(userId, teamId) {
  const teamRoles = await prisma.userTeam.findMany({
    where: { userId, teamId, isActive: true }
  });
  return teamRoles.map(t => t.role);
}

async function getUserOrganizationRoles(userId) {
  const orgRoles = await prisma.userOrganization.findMany({
    where: { userId }
  });
  return orgRoles.map(o => o.role);
}

function canAccessPlayer(userRoles, playerId, userId, teamId) {
  const highestRole = userRoles.reduce((highest, role) => {
    return getRoleLevel(role) > getRoleLevel(highest) ? role : highest;
  }, userRoles[0]);

  if (isOperationsRole(highestRole)) {
    return true;
  }

  if (isTeamRole(highestRole)) {
    return true;
  }

  return false;
}

const requirePermission = (...permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userRoles = [];

      if (req.user.organizations) {
        for (const org of req.user.organizations) {
          userRoles.push(org.role);
        }
      }

      if (req.user.teams) {
        for (const team of req.user.teams) {
          userRoles.push(team.role);
        }
      }

      if (req.user.players?.length > 0) {
        userRoles.push('PLAYER');
      }

      if (req.user.parentPlayers?.length > 0) {
        userRoles.push('PARENT');
      }

      const hasRequired = userRoles.some(role => 
        hasAnyPermission(role, permissions)
      );

      if (!hasRequired) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: permissions
        });
      }

      req.userRoles = userRoles;
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

const requireRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userRoles = [];

      if (req.user.organizations) {
        for (const org of req.user.organizations) {
          userRoles.push(org.role);
        }
      }

      if (req.user.teams) {
        for (const team of req.user.teams) {
          userRoles.push(team.role);
        }
      }

      if (req.user.players?.length > 0) {
        userRoles.push('PLAYER');
      }

      if (req.user.parentPlayers?.length > 0) {
        userRoles.push('PARENT');
      }

      const hasRole = userRoles.some(role => allowedRoles.includes(role));

      if (!hasRole) {
        return res.status(403).json({ 
          error: 'Insufficient role privileges',
          required: allowedRoles,
          userRoles
        });
      }

      req.userRoles = userRoles;
      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({ error: 'Role check failed' });
    }
  };
};

const requireOperator = () => requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'EXTERNAL');

const requireTeamAccess = (teamIdParam = 'teamId') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const teamId = req.params[teamIdParam] || req.body[teamIdParam] || req.query[teamIdParam];

      const isOpsRole = req.user.organizations?.some(org => 
        isOperationsRole(org.role)
      );

      if (isOpsRole) {
        return next();
      }

      if (!teamId) {
        return res.status(400).json({ error: 'Team ID required' });
      }

      const teamAccess = req.user.teams?.find(t => t.team.id === teamId);
      if (!teamAccess) {
        return res.status(403).json({ error: 'No access to this team' });
      }

      req.teamRole = teamAccess.role;
      next();
    } catch (error) {
      console.error('Team access check error:', error);
      res.status(500).json({ error: 'Team access check failed' });
    }
  };
};

const requireSuperAdmin = () => requireRole('SUPER_ADMIN');
const requireAdmin = () => requireRole('SUPER_ADMIN', 'ADMIN');
const requireTeamManager = () => requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'TEAM_MANAGER');
const requireCoach = () => requireRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'TEAM_MANAGER', 'COACH');
const requirePlayer = () => requireRole('PLAYER');
const requireParent = () => requireRole('PARENT');

const LEGACY_ROLE_MAP = {
  'SUPER_ADMIN': 'SUPER_ADMIN',
  'ADMIN': 'ADMIN',
  'OPERATOR': 'OPERATOR',
  'EXTERNAL': 'EXTERNAL',
  'TEAM_MANAGER': 'TEAM_MANAGER',
  'COACH': 'COACH',
  'COACH': 'COACH',
  'GUEST_COACH': 'GUEST_COACH',
  'PLAYER': 'PLAYER',
  'PARENT': 'PARENT'
};

function mapLegacyRole(legacyRole) {
  return LEGACY_ROLE_MAP[legacyRole] || legacyRole;
}

module.exports = {
  RoleCategory,
  RoleHierarchy,
  Permission,
  RolePermissions,
  isOperationsRole,
  isTeamRole,
  isUserRole,
  getRoleLevel,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getUserHighestRole,
  getUserRolesForTeam,
  getUserOrganizationRoles,
  canAccessPlayer,
  requirePermission,
  requireRole,
  requireOperator,
  requireTeamAccess,
  requireSuperAdmin,
  requireAdmin,
  requireTeamManager,
  requireCoach,
  requirePlayer,
  requireParent,
  mapLegacyRole,
  LEGACY_ROLE_MAP
};
