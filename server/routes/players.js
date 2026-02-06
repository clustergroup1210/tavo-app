const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const { authenticate, hasTeamAccess } = require('../middleware/auth');
const { transferPlayer } = require('../services/transferService');
const { filterDataByVisibility } = require('../services/dataVisibilityService');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

router.get('/', authenticate, async (req, res) => {
  try {
    const { teamId, includeChildren } = req.query;
    
    const where = {};
    if (teamId) {
      if (includeChildren === 'true') {
        const team = await prisma.team.findUnique({
          where: { id: teamId },
          include: { children: { select: { id: true } } }
        });
        const teamIds = [teamId];
        if (team?.children) {
          team.children.forEach(child => teamIds.push(child.id));
        }
        where.teamId = { in: teamIds };
      } else {
        where.teamId = teamId;
      }
    } else {
      const isOperator = req.user.organizations?.some(o => 
        ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
      );
      
      if (!isOperator) {
        const teamIds = req.user.teams?.map(t => t.teamId) || [];
        if (teamIds.length > 0) {
          where.teamId = { in: teamIds };
        } else {
          where.userId = req.user.id;
        }
      }
    }

    let players = await prisma.player.findMany({
      where,
      include: {
        team: { include: { parent: true } },
        teamCategory: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, name: true } },
        evaluations: { take: 5, orderBy: { evaluatedAt: 'desc' } }
      }
    });

    if (players.length === 0 && !req.query.teamId) {
      const ownPlayer = await prisma.player.findFirst({
        where: { userId: req.user.id },
        include: {
          team: { include: { parent: true } },
          teamCategory: { select: { id: true, name: true } },
          user: { select: { id: true, email: true, name: true } },
          evaluations: { take: 5, orderBy: { evaluatedAt: 'desc' } }
        }
      });
      if (ownPlayer) {
        players = [ownPlayer];
      }
    }

    res.json(players);
  } catch (error) {
    console.error('Get players error:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const player = await prisma.player.findUnique({
      where: { id: req.params.id },
      include: {
        team: { include: { parent: true } },
        teamCategory: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, name: true } },
        parents: { include: { user: { select: { id: true, email: true, name: true } } } },
        evaluations: {
          include: { item: true, round: true, rater: { select: { id: true, name: true } } },
          orderBy: { evaluatedAt: 'desc' }
        },
        videos: { orderBy: { createdAt: 'desc' } },
        appealLinks: { where: { isActive: true } }
      }
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(player);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch player' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { teamId, name, number, position, birthDate, joinedAt, graduationDate, teamCategoryId } = req.body;

    if (!hasTeamAccess(req.user, teamId, ['TEAM_MANAGER', 'COACH', 'COACH'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const playerJoinedAt = joinedAt ? new Date(joinedAt) : new Date();

    const player = await prisma.player.create({
      data: {
        teamId,
        name,
        number,
        position,
        birthDate: birthDate ? new Date(birthDate) : null,
        joinedAt: playerJoinedAt,
        graduationDate: graduationDate ? new Date(graduationDate) : null,
        teamCategoryId: teamCategoryId || null
      }
    });

    await prisma.playerTeamHistory.create({
      data: { playerId: player.id, teamId, joinedAt: playerJoinedAt }
    });

    res.json(player);
  } catch (error) {
    console.error('Create player error:', error);
    res.status(500).json({ error: 'Failed to create player' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, nameRomaji, number, position, birthDate, joinedAt, graduationDate, height, weight, dominantFoot, hometown, school, previousTeam, teamId, roleModel, playStyle, teamCategoryId } = req.body;

    const player = await prisma.player.findUnique({ where: { id: req.params.id } });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const isSelf = player.userId === req.user.id;
    const isCoachOrAdmin = hasTeamAccess(req.user, player.teamId, ['TEAM_MANAGER', 'COACH', 'COACH']);
    const isOperator = req.user.organizations?.some(o => 
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );
    
    if (!isSelf && !isCoachOrAdmin && !isOperator) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const canChangeTeam = isOperator;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (nameRomaji !== undefined) updateData.nameRomaji = nameRomaji;
    if (number !== undefined) updateData.number = number;
    if (position !== undefined) updateData.position = position;
    if (birthDate !== undefined) updateData.birthDate = birthDate ? new Date(birthDate) : null;
    if (joinedAt !== undefined) updateData.joinedAt = joinedAt ? new Date(joinedAt) : null;
    if (graduationDate !== undefined) updateData.graduationDate = graduationDate ? new Date(graduationDate) : null;
    if (height !== undefined) updateData.height = height ? parseInt(height) : null;
    if (weight !== undefined) updateData.weight = weight ? parseInt(weight) : null;
    if (dominantFoot !== undefined) updateData.dominantFoot = dominantFoot;
    if (hometown !== undefined) updateData.hometown = hometown;
    if (school !== undefined) updateData.school = school;
    if (previousTeam !== undefined) updateData.previousTeam = previousTeam;
    if (roleModel !== undefined) updateData.roleModel = roleModel;
    if (playStyle !== undefined) updateData.playStyle = playStyle;
    if (teamCategoryId !== undefined && (isCoachOrAdmin || isOperator)) {
      updateData.teamCategoryId = teamCategoryId || null;
    }
    
    if (teamId !== undefined && canChangeTeam && teamId !== player.teamId) {
      const transferResult = await transferPlayer(req.params.id, teamId, { 
        newTeamCategoryId: teamCategoryId || null 
      });
      
      if (Object.keys(updateData).length > 0) {
        delete updateData.teamCategoryId;
        await prisma.player.update({
          where: { id: req.params.id },
          data: updateData
        });
      }
      
      const finalPlayer = await prisma.player.findUnique({
        where: { id: req.params.id },
        include: { team: { include: { parent: true } }, teamCategory: true }
      });
      
      return res.json(finalPlayer);
    }

    const updated = await prisma.player.update({
      where: { id: req.params.id },
      data: updateData,
      include: { team: { include: { parent: true } } }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update player error:', error);
    res.status(500).json({ error: 'Failed to update player' });
  }
});

router.get('/:id/notes', authenticate, async (req, res) => {
  try {
    const player = await prisma.player.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true, teamId: true }
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    let notes = await prisma.playerNote.findMany({
      where: { playerId: req.params.id },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const isSelf = player.userId === req.user.id;
    const isParent = req.user.parentPlayers?.some(pp => pp.playerId === req.params.id);
    const isOp = req.user.organizations?.some(o => 
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );

    if (!isSelf && !isParent && !isOp) {
      notes = await filterDataByVisibility(req.user, req.params.id, notes, 'createdAt');
    }

    res.json(notes);
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

router.post('/:id/notes', authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    const player = await prisma.player.findUnique({ 
      where: { id: req.params.id },
      include: { team: { select: { parentId: true } } }
    });
    
    const isCoachOrAdmin = hasTeamAccess(req.user, player.teamId, ['TEAM_MANAGER', 'COACH', 'COACH']) ||
      (player.team?.parentId && hasTeamAccess(req.user, player.team.parentId, ['TEAM_MANAGER', 'COACH', 'COACH']));
    const isOperator = req.user.organizations?.some(o => 
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );

    if (!isCoachOrAdmin && !isOperator) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const note = await prisma.playerNote.create({
      data: {
        playerId: req.params.id,
        authorId: req.user.id,
        content
      },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } }
    });

    res.json(note);
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

router.delete('/:id/notes/:noteId', authenticate, async (req, res) => {
  try {
    const note = await prisma.playerNote.findUnique({ where: { id: req.params.noteId } });
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    if (note.authorId !== req.user.id) {
      const isOperator = req.user.organizations?.some(o => 
        ['SUPER_ADMIN', 'ADMIN'].includes(o.role)
      );
      if (!isOperator) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    await prisma.playerNote.delete({ where: { id: req.params.noteId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

router.get('/:id/history', authenticate, async (req, res) => {
  try {
    const history = await prisma.playerTeamHistory.findMany({
      where: { playerId: req.params.id },
      orderBy: { joinedAt: 'desc' }
    });

    const historyWithTeams = await Promise.all(
      history.map(async (h) => {
        const team = await prisma.team.findUnique({
          where: { id: h.teamId },
          select: { id: true, name: true, logoUrl: true }
        });
        return { ...h, team };
      })
    );

    res.json(historyWithTeams);
  } catch (error) {
    console.error('Get player history error:', error);
    res.status(500).json({ error: 'Failed to fetch player history' });
  }
});

router.get('/:id/transfers', authenticate, async (req, res) => {
  try {
    const { getTransferHistory } = require('../services/transferService');
    const transfers = await getTransferHistory(req.params.id);
    res.json(transfers);
  } catch (error) {
    console.error('Get transfer history error:', error);
    res.status(500).json({ error: 'Failed to fetch transfer history' });
  }
});

router.post('/:id/photo', authenticate, upload.single('photo'), async (req, res) => {
  try {
    const player = await prisma.player.findUnique({ where: { id: req.params.id } });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    const isOperatorUser = req.user.organizations?.some(o => 
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );
    const isSelf = player.userId === req.user.id;
    const isParent = req.user.parentPlayers?.some(pp => pp.playerId === player.id);
    
    let canUpload = isSelf || isParent || isOperatorUser;
    
    if (!canUpload) {
      const isTeamManager = hasTeamAccess(req.user, player.teamId, ['TEAM_MANAGER']);
      if (isTeamManager) {
        canUpload = true;
      } else {
        const isCoachRole = hasTeamAccess(req.user, player.teamId, ['COACH', 'GUEST_COACH']);
        if (isCoachRole) {
          const team = await prisma.team.findUnique({
            where: { id: player.teamId },
            select: { headCoachId: true }
          });
          
          if (team?.headCoachId === req.user.id) {
            canUpload = true;
          } else {
            const assignment = await prisma.coachAssignment.findUnique({
              where: {
                coachId_playerId: {
                  coachId: req.user.id,
                  playerId: player.id
                }
              }
            });
            canUpload = !!assignment;
          }
        }
      }
    }

    if (!canUpload) {
      return res.status(403).json({ error: '写真の更新権限がありません。担当選手のみ更新できます。' });
    }

    const photoUrl = `/uploads/logos/${req.file.filename}`;
    const updated = await prisma.player.update({
      where: { id: req.params.id },
      data: { photoUrl }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

router.post('/:id/passport', authenticate, upload.single('passport'), async (req, res) => {
  try {
    const player = await prisma.player.findUnique({ where: { id: req.params.id } });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    const isOperatorUser = req.user.organizations?.some(o => 
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );
    const isSelf = player.userId === req.user.id;
    
    let canUpload = isSelf || isOperatorUser;
    
    if (!canUpload) {
      const isTeamManager = hasTeamAccess(req.user, player.teamId, ['TEAM_MANAGER']);
      if (isTeamManager) {
        canUpload = true;
      } else {
        const isCoachRole = hasTeamAccess(req.user, player.teamId, ['COACH', 'GUEST_COACH']);
        if (isCoachRole) {
          const team = await prisma.team.findUnique({
            where: { id: player.teamId },
            select: { headCoachId: true }
          });
          
          if (team?.headCoachId === req.user.id) {
            canUpload = true;
          } else {
            const assignment = await prisma.coachAssignment.findUnique({
              where: {
                coachId_playerId: {
                  coachId: req.user.id,
                  playerId: player.id
                }
              }
            });
            canUpload = !!assignment;
          }
        }
      }
    }

    if (!canUpload) {
      return res.status(403).json({ error: '選手証写真の更新権限がありません。担当選手のみ更新できます。' });
    }

    const passportUrl = `/uploads/${req.file.filename}`;
    const updated = await prisma.player.update({
      where: { id: req.params.id },
      data: { passportUrl }
    });

    res.json(updated);
  } catch (error) {
    console.error('Upload passport error:', error);
    res.status(500).json({ error: 'Failed to upload passport' });
  }
});

router.post('/:id/link-user', authenticate, async (req, res) => {
  try {
    const { email } = req.body;
    const player = await prisma.player.findUnique({ where: { id: req.params.id } });
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    const isCoachOrAdmin = hasTeamAccess(req.user, player.teamId, ['TEAM_MANAGER', 'COACH']);
    const isOperator = req.user.organizations?.some(o => 
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );
    
    if (!isCoachOrAdmin && !isOperator) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (player.userId) {
      return res.status(400).json({ error: 'この選手は既にユーザーアカウントに紐付けられています' });
    }
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません。先にアカウントを作成してください。' });
    }
    
    const existingPlayer = await prisma.player.findFirst({ where: { userId: user.id } });
    if (existingPlayer) {
      return res.status(400).json({ error: 'このユーザーは既に別の選手に紐付けられています' });
    }
    
    const updated = await prisma.player.update({
      where: { id: req.params.id },
      data: { userId: user.id },
      include: { user: { select: { id: true, email: true, name: true } } }
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Link user error:', error);
    res.status(500).json({ error: 'Failed to link user' });
  }
});

router.delete('/:id/unlink-user', authenticate, async (req, res) => {
  try {
    const player = await prisma.player.findUnique({ where: { id: req.params.id } });
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    const isCoachOrAdmin = hasTeamAccess(req.user, player.teamId, ['TEAM_MANAGER', 'COACH']);
    const isOperator = req.user.organizations?.some(o => 
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );
    
    if (!isCoachOrAdmin && !isOperator) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const updated = await prisma.player.update({
      where: { id: req.params.id },
      data: { userId: null },
      include: { user: { select: { id: true, email: true, name: true } } }
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Unlink user error:', error);
    res.status(500).json({ error: 'Failed to unlink user' });
  }
});

module.exports = router;
