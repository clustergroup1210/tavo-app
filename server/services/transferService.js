const prisma = require('../lib/prisma');

async function getPlayerSnapshot(playerId, txClient = prisma) {
  const player = await txClient.player.findUnique({
    where: { id: playerId },
    include: {
      team: { select: { id: true, name: true } },
      teamCategory: { select: { id: true, name: true } },
      evaluations: {
        include: {
          item: { select: { id: true, name: true, parentId: true } },
          round: { select: { id: true, name: true } }
        },
        orderBy: { evaluatedAt: 'desc' }
      },
      goals: {
        include: {
          category: { select: { id: true, name: true } }
        }
      }
    }
  });

  if (!player) return null;

  const coachEvals = player.evaluations.filter(e => e.raterType === 'coach');
  const selfEvals = player.evaluations.filter(e => e.raterType === 'self');
  
  const latestRound = player.evaluations[0]?.round;
  
  const latestCoachEvals = latestRound 
    ? coachEvals.filter(e => e.roundId === latestRound.id)
    : [];
  const latestSelfEvals = latestRound
    ? selfEvals.filter(e => e.roundId === latestRound.id)
    : [];

  const totalCoachScore = latestCoachEvals.reduce((sum, e) => sum + e.score, 0);
  const totalSelfScore = latestSelfEvals.reduce((sum, e) => sum + e.score, 0);
  const maxPossibleScore = latestCoachEvals.length * 5;
  const achievementRate = maxPossibleScore > 0 
    ? Math.round((totalCoachScore / maxPossibleScore) * 100) 
    : 0;

  const categoryScores = {};
  latestCoachEvals.forEach(e => {
    const categoryId = e.item.parentId || e.item.id;
    if (!categoryScores[categoryId]) {
      categoryScores[categoryId] = { coach: 0, self: 0, count: 0, name: e.item.parentId ? null : e.item.name };
    }
    categoryScores[categoryId].coach += e.score;
    categoryScores[categoryId].count++;
  });
  latestSelfEvals.forEach(e => {
    const categoryId = e.item.parentId || e.item.id;
    if (categoryScores[categoryId]) {
      categoryScores[categoryId].self += e.score;
    }
  });

  const goalStats = {
    total: player.goals.length,
    completed: player.goals.filter(g => g.status === 'completed').length,
    active: player.goals.filter(g => g.status === 'active').length
  };

  return {
    capturedAt: new Date().toISOString(),
    playerInfo: {
      id: player.id,
      name: player.name,
      nameRomaji: player.nameRomaji,
      number: player.number,
      position: player.position,
      birthDate: player.birthDate,
      height: player.height,
      weight: player.weight,
      photoUrl: player.photoUrl
    },
    teamInfo: {
      teamId: player.team.id,
      teamName: player.team.name,
      categoryId: player.teamCategory?.id,
      categoryName: player.teamCategory?.name
    },
    evaluationSummary: {
      latestRoundId: latestRound?.id,
      latestRoundName: latestRound?.name,
      totalCoachScore,
      totalSelfScore,
      maxPossibleScore,
      achievementRate,
      evaluationCount: latestCoachEvals.length,
      categoryScores
    },
    goalStats,
    allEvaluationsCount: player.evaluations.length,
    allGoalsCount: player.goals.length
  };
}

async function transferPlayer(playerId, newTeamId, options = {}) {
  const { newTeamCategoryId = null } = options;

  return await prisma.$transaction(async (tx) => {
    const player = await tx.player.findUnique({
      where: { id: playerId },
      include: { team: { select: { id: true, name: true } } }
    });

    if (!player) {
      throw new Error('Player not found');
    }

    if (player.teamId === newTeamId) {
      throw new Error('Player is already on this team');
    }

    const newTeam = await tx.team.findUnique({
      where: { id: newTeamId },
      select: { id: true, name: true }
    });

    if (!newTeam) {
      throw new Error('Target team not found');
    }

    const snapshot = await getPlayerSnapshot(playerId, tx);

    await tx.transferHistory.create({
      data: {
        playerId,
        fromTeamId: player.teamId,
        toTeamId: newTeamId,
        snapshotData: snapshot
      }
    });

    await tx.playerTeamHistory.updateMany({
      where: {
        playerId,
        teamId: player.teamId,
        leftAt: null
      },
      data: { leftAt: new Date() }
    });

    await tx.playerTeamHistory.create({
      data: {
        playerId,
        teamId: newTeamId,
        joinedAt: new Date()
      }
    });

    const updatedPlayer = await tx.player.update({
      where: { id: playerId },
      data: {
        teamId: newTeamId,
        teamCategoryId: newTeamCategoryId
      },
      include: {
        team: { select: { id: true, name: true } },
        teamCategory: { select: { id: true, name: true } }
      }
    });

    return {
      player: updatedPlayer,
      transfer: {
        fromTeam: player.team,
        toTeam: newTeam,
        transferredAt: new Date()
      }
    };
  });
}

async function getTransferHistory(playerId) {
  return await prisma.transferHistory.findMany({
    where: { playerId },
    include: {
      fromTeam: { select: { id: true, name: true, logoUrl: true } },
      toTeam: { select: { id: true, name: true, logoUrl: true } }
    },
    orderBy: { transferredAt: 'desc' }
  });
}

async function getTeamTransferSnapshot(transferId) {
  const transfer = await prisma.transferHistory.findUnique({
    where: { id: transferId },
    include: {
      player: { select: { id: true, name: true } },
      fromTeam: { select: { id: true, name: true } },
      toTeam: { select: { id: true, name: true } }
    }
  });

  if (!transfer) {
    throw new Error('Transfer record not found');
  }

  return transfer;
}

module.exports = {
  transferPlayer,
  getPlayerSnapshot,
  getTransferHistory,
  getTeamTransferSnapshot
};
