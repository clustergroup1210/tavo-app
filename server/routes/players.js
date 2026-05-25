const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const { authenticate, hasTeamAccess, getHeadCoachVisibleTeamIds, getTeamSubtreeIds } = require('../middleware/auth');
const { transferPlayer } = require('../services/transferService');
const { filterDataByVisibility } = require('../services/dataVisibilityService');
const { saveUpload } = require('../lib/uploadStorage');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', authenticate, async (req, res) => {
  try {
    const { teamId, includeChildren, includeGraduated, includeDeleted } = req.query;

    const isOperator = req.user.organizations?.some(o =>
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );

    const headCoachVisible = isOperator ? new Set() : await getHeadCoachVisibleTeamIds(req.user.id);

    const where = {};
    let scopedTeamIds = null;
    if (teamId) {
      const allowed = hasTeamAccess(req.user, teamId) || headCoachVisible.has(teamId);
      if (!allowed) {
        return res.status(403).json({ error: 'このチームへのアクセス権がありません' });
      }
      if (includeChildren === 'true') {
        const subtree = await getTeamSubtreeIds(teamId);
        const teamIds = Array.from(subtree);
        where.teamId = { in: teamIds };
        scopedTeamIds = teamIds;
      } else {
        where.teamId = teamId;
        scopedTeamIds = [teamId];
      }
    } else {
      if (!isOperator) {
        const memberTeamIds = req.user.teams?.map(t => t.teamId) || [];
        const teamIds = Array.from(new Set([...memberTeamIds, ...headCoachVisible]));
        if (teamIds.length > 0) {
          where.teamId = { in: teamIds };
          scopedTeamIds = teamIds;
        } else {
          where.userId = req.user.id;
        }
      }
    }

    if (includeDeleted === 'true') {
      let canSeeDeleted = isOperator;
      if (!canSeeDeleted && scopedTeamIds) {
        canSeeDeleted = scopedTeamIds.every(tid =>
          req.user.teams?.some(t => t.teamId === tid && ['TEAM_MANAGER', 'COACH'].includes(t.role))
        );
      }
      if (!canSeeDeleted) {
        where.deletedAt = null;
      }
    } else {
      where.deletedAt = null;
    }
    if (includeGraduated !== 'true') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where.OR = [
        { graduationDate: null },
        { graduationDate: { gt: today } },
      ];
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
    const { teamId, name, number, position, birthDate, joinedAt, graduationDate, teamCategoryId, email, password, learningType, communicationType } = req.body;

    if (!hasTeamAccess(req.user, teamId, ['TEAM_MANAGER', 'COACH', 'COACH'])) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const targetTeam = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, status: true, parentId: true, parent: { select: { status: true } } },
    });
    if (!targetTeam) {
      return res.status(404).json({ error: 'チームが見つかりません' });
    }
    const effectiveStatus = targetTeam.parentId ? (targetTeam.parent?.status || targetTeam.status) : targetTeam.status;
    if (effectiveStatus !== 'ACTIVE') {
      return res.status(403).json({ error: 'このチームは仮登録状態のため、選手を登録できません。チーム代表者の本登録手続きが必要です。' });
    }

    const createAccount = !!(email && email.trim());
    if (createAccount) {
      const trimmedEmail = email.trim().toLowerCase();
      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'パスワードは6文字以上で入力してください' });
      }
      const existing = await prisma.user.findUnique({ where: { email: trimmedEmail } });
      if (existing) {
        return res.status(400).json({ error: 'このメールアドレスは既に使用されています' });
      }
    }

    const playerJoinedAt = joinedAt ? new Date(joinedAt) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      let userId = null;

      if (createAccount) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);
        const { resolveUserCode } = require('../services/userCode');
        let user;
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const userCode = await resolveUserCode(tx, null);
            user = await tx.user.create({
              data: { email: email.trim().toLowerCase(), password: hashedPassword, name, userCode }
            });
            break;
          } catch (err) {
            const isUserCodeConflict = err?.code === 'P2002' &&
              (Array.isArray(err.meta?.target) ? err.meta.target.includes('userCode') : String(err.meta?.target || '').includes('userCode'));
            if (isUserCodeConflict && attempt < 4) continue;
            throw err;
          }
        }
        userId = user.id;

        await tx.userTeam.create({
          data: { userId: user.id, teamId, role: 'PLAYER' }
        });
      }

      const player = await tx.player.create({
        data: {
          teamId,
          name,
          number,
          position,
          birthDate: birthDate ? new Date(birthDate) : null,
          joinedAt: playerJoinedAt,
          graduationDate: graduationDate ? new Date(graduationDate) : null,
          teamCategoryId: teamCategoryId || null,
          learningType: learningType || null,
          communicationType: communicationType || null,
          userId: userId
        }
      });

      await tx.playerTeamHistory.create({
        data: { playerId: player.id, teamId, joinedAt: playerJoinedAt }
      });

      return player;
    });

    res.json(result);
  } catch (error) {
    console.error('Create player error:', error);
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      return res.status(400).json({ error: 'このメールアドレスは既に使用されています' });
    }
    res.status(500).json({ error: 'Failed to create player' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, nameRomaji, number, position, birthDate, joinedAt, graduationDate, height, weight, dominantFoot, hometown, school, previousTeam, teamId, roleModel, playStyle, learningType, communicationType, teamCategoryId } = req.body;

    const player = await prisma.player.findUnique({ where: { id: req.params.id } });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const isSelf = player.userId === req.user.id;
    const isCoachOrAdminDirect = hasTeamAccess(req.user, player.teamId, ['TEAM_MANAGER', 'COACH']);
    const isOperator = req.user.organizations?.some(o => 
      ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(o.role)
    );

    // Allow any ancestor-team TEAM_MANAGER/COACH to manage descendant-team players
    // (mirrors team-categories includeChildren scope so the assignment modal can save).
    let isCoachOrAdminViaAncestor = false;
    if (!isCoachOrAdminDirect && !isOperator) {
      const seen = new Set([player.teamId]);
      let cursor = await prisma.team.findUnique({
        where: { id: player.teamId },
        select: { parentId: true }
      });
      while (cursor?.parentId && !seen.has(cursor.parentId)) {
        seen.add(cursor.parentId);
        if (hasTeamAccess(req.user, cursor.parentId, ['TEAM_MANAGER', 'COACH'])) {
          isCoachOrAdminViaAncestor = true;
          break;
        }
        cursor = await prisma.team.findUnique({
          where: { id: cursor.parentId },
          select: { parentId: true }
        });
      }
    }
    const isCoachOrAdmin = isCoachOrAdminDirect || isCoachOrAdminViaAncestor;

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
    if (learningType !== undefined) updateData.learningType = learningType;
    if (communicationType !== undefined) updateData.communicationType = communicationType;
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

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const player = await prisma.player.findUnique({
      where: { id: req.params.id },
      select: { id: true, teamId: true, deletedAt: true },
    });
    if (!player) {
      return res.status(404).json({ error: '選手が見つかりません' });
    }
    if (!hasTeamAccess(req.user, player.teamId, ['TEAM_MANAGER', 'COACH'])) {
      return res.status(403).json({ error: 'この操作を行う権限がありません' });
    }
    if (player.deletedAt) {
      return res.status(400).json({ error: 'この選手は既に削除されています' });
    }

    await prisma.player.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Soft delete player error:', error);
    res.status(500).json({ error: '選手の削除に失敗しました' });
  }
});

router.post('/:id/restore', authenticate, async (req, res) => {
  try {
    const player = await prisma.player.findUnique({
      where: { id: req.params.id },
      select: { id: true, teamId: true, deletedAt: true },
    });
    if (!player) {
      return res.status(404).json({ error: '選手が見つかりません' });
    }
    if (!hasTeamAccess(req.user, player.teamId, ['TEAM_MANAGER', 'COACH'])) {
      return res.status(403).json({ error: 'この操作を行う権限がありません' });
    }
    if (!player.deletedAt) {
      return res.status(400).json({ error: 'この選手は削除されていません' });
    }

    await prisma.player.update({
      where: { id: req.params.id },
      data: { deletedAt: null },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Restore player error:', error);
    res.status(500).json({ error: '選手の復元に失敗しました' });
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

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'ファイルが必要です' });
    }
    const ext = path.extname(req.file.originalname) || '';
    const filename = `${uuidv4()}${ext}`;
    await saveUpload(`logos/${filename}`, req.file.buffer, req.file.mimetype);
    const photoUrl = `/uploads/logos/${filename}`;
    const updated = await prisma.player.update({
      where: { id: req.params.id },
      data: { photoUrl }
    });

    res.json(updated);
  } catch (error) {
    console.error('Upload photo error:', error);
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

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'ファイルが必要です' });
    }
    const ext = path.extname(req.file.originalname) || '';
    const filename = `${uuidv4()}${ext}`;
    await saveUpload(filename, req.file.buffer, req.file.mimetype);
    const passportUrl = `/uploads/${filename}`;
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
