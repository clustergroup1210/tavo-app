const prisma = require('../lib/prisma');

async function getPlayerTeamHistory(playerId) {
  const histories = await prisma.playerTeamHistory.findMany({
    where: { playerId },
    orderBy: { joinedAt: 'asc' }
  });

  if (histories.length > 0) return histories;

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { teamId: true, joinedAt: true }
  });

  if (player) {
    return [{
      playerId,
      teamId: player.teamId,
      joinedAt: player.joinedAt || new Date('2000-01-01'),
      leftAt: null
    }];
  }

  return [];
}

async function getVisibleDateRange(viewerTeamId, playerId) {
  const histories = await getPlayerTeamHistory(playerId);
  
  if (!histories || histories.length === 0) {
    return null;
  }
  
  const team = await prisma.team.findUnique({
    where: { id: viewerTeamId },
    select: { id: true, parentId: true }
  });
  
  if (!team) return null;
  
  const relatedTeamIds = [viewerTeamId];
  if (team.parentId) {
    relatedTeamIds.push(team.parentId);
  }
  const childTeams = await prisma.team.findMany({
    where: { parentId: viewerTeamId },
    select: { id: true }
  });
  childTeams.forEach(ct => relatedTeamIds.push(ct.id));
  
  const relevantPeriods = histories.filter(h => relatedTeamIds.includes(h.teamId));
  
  if (relevantPeriods.length === 0) {
    return null;
  }
  
  const periods = relevantPeriods.map(h => ({
    startDate: h.joinedAt,
    endDate: h.leftAt || null
  }));
  
  return periods;
}

function buildDateRangeWhereClause(periods, dateField = 'createdAt') {
  if (!periods || periods.length === 0) {
    return { [dateField]: { equals: new Date(0) } };
  }
  
  const orConditions = periods.map(period => {
    const condition = { [dateField]: { gte: period.startDate } };
    if (period.endDate) {
      condition[dateField].lte = period.endDate;
    }
    return condition;
  });
  
  if (orConditions.length === 1) {
    return orConditions[0];
  }
  
  return { OR: orConditions };
}

function isWithinVisiblePeriods(dataDate, periods) {
  if (!periods || periods.length === 0) return false;
  
  const date = new Date(dataDate);
  
  return periods.some(period => {
    if (date < period.startDate) return false;
    if (period.endDate && date > period.endDate) return false;
    return true;
  });
}

async function canViewPlayerData(viewer, player, dataCreatedAt) {
  const isOwnData = player.userId === viewer.id;
  const isParent = viewer.parentPlayers?.some(pp => pp.playerId === player.id);
  
  if (isOwnData || isParent) {
    return true;
  }
  
  const isOperator = viewer.organizations?.some(o => 
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
  );
  
  if (isOperator) {
    return true;
  }
  
  const viewerTeamRoles = viewer.teams || [];
  const playerCurrentTeamId = player.teamId;
  
  const hasTeamAccess = viewerTeamRoles.some(t => t.teamId === playerCurrentTeamId);
  
  if (hasTeamAccess) {
    const viewerTeam = viewerTeamRoles.find(t => t.teamId === playerCurrentTeamId);
    if (viewerTeam) {
      const periods = await getVisibleDateRange(playerCurrentTeamId, player.id);
      if (periods) {
        return isWithinVisiblePeriods(dataCreatedAt, periods);
      }
    }
  }
  
  const accessibleTeamIds = viewerTeamRoles.map(t => t.teamId);
  for (const teamId of accessibleTeamIds) {
    const periods = await getVisibleDateRange(teamId, player.id);
    if (periods && isWithinVisiblePeriods(dataCreatedAt, periods)) {
      return true;
    }
  }
  
  return false;
}

async function filterDataByVisibility(viewer, playerId, data, dateField = 'createdAt') {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, teamId: true, userId: true }
  });
  
  if (!player) return [];
  
  const isOwnData = player.userId === viewer.id;
  const isParent = viewer.parentPlayers?.some(pp => pp.playerId === playerId);
  
  if (isOwnData || isParent) {
    return data;
  }
  
  const isOperator = viewer.organizations?.some(o => 
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
  );
  
  if (isOperator) {
    return data;
  }
  
  const viewerTeamRoles = viewer.teams || [];
  const accessibleTeamIds = viewerTeamRoles.map(t => t.teamId);
  
  let allPeriods = [];
  for (const teamId of accessibleTeamIds) {
    const periods = await getVisibleDateRange(teamId, playerId);
    if (periods) {
      allPeriods = allPeriods.concat(periods);
    }
  }
  
  if (allPeriods.length === 0) {
    return [];
  }
  
  return data.filter(item => {
    const itemDate = new Date(item[dateField]);
    return isWithinVisiblePeriods(itemDate, allPeriods);
  });
}

async function getVisibleDataWhereClause(viewer, playerId, dateField = 'createdAt') {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, teamId: true, userId: true }
  });
  
  if (!player) {
    return { [dateField]: { equals: new Date(0) } };
  }
  
  const isOwnData = player.userId === viewer.id;
  const isParent = viewer.parentPlayers?.some(pp => pp.playerId === playerId);
  
  if (isOwnData || isParent) {
    return {};
  }
  
  const isOperator = viewer.organizations?.some(o => 
    ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
  );
  
  if (isOperator) {
    return {};
  }
  
  const viewerTeamRoles = viewer.teams || [];
  const accessibleTeamIds = viewerTeamRoles.map(t => t.teamId);
  
  let allPeriods = [];
  for (const teamId of accessibleTeamIds) {
    const periods = await getVisibleDateRange(teamId, playerId);
    if (periods) {
      allPeriods = allPeriods.concat(periods);
    }
  }
  
  return buildDateRangeWhereClause(allPeriods, dateField);
}

module.exports = {
  getVisibleDateRange,
  buildDateRangeWhereClause,
  isWithinVisiblePeriods,
  canViewPlayerData,
  filterDataByVisibility,
  getVisibleDataWhereClause,
  getPlayerTeamHistory
};
