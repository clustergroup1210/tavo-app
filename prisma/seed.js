const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const hashedPassword = await bcrypt.hash('password123', 10);
  const adminPassword = await bcrypt.hash('admin123', 10);

  const org = await prisma.organization.upsert({
    where: { id: 'org-1' },
    update: {},
    create: {
      id: 'org-1',
      name: 'スポーツ育成機構',
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { password: adminPassword },
    create: {
      email: 'admin@example.com',
      password: adminPassword,
      name: '管理者 太郎',
    },
  });

  await prisma.userOrganization.upsert({
    where: {
      userId_organizationId_role: {
        userId: adminUser.id,
        organizationId: org.id,
        role: 'SUPER_ADMIN'
      }
    },
    update: {},
    create: {
      userId: adminUser.id,
      organizationId: org.id,
      role: 'SUPER_ADMIN',
    },
  });

  const parentTeam = await prisma.team.upsert({
    where: { id: 'team-main' },
    update: {},
    create: {
      id: 'team-main',
      organizationId: org.id,
      name: 'FCヴィクトリア',
      description: '地域を代表するサッカークラブ。ジュニアからユースまで幅広い年代で活動しています。',
      sortOrder: 0,
    },
  });

  const teamU12 = await prisma.team.upsert({
    where: { id: 'team-u12' },
    update: {},
    create: {
      id: 'team-u12',
      organizationId: org.id,
      parentId: parentTeam.id,
      name: 'FCヴィクトリア U-12',
      description: '小学生年代のチーム',
      sortOrder: 1,
    },
  });

  const teamU15 = await prisma.team.upsert({
    where: { id: 'team-u15' },
    update: {},
    create: {
      id: 'team-u15',
      organizationId: org.id,
      parentId: parentTeam.id,
      name: 'FCヴィクトリア U-15',
      description: '中学生年代のチーム',
      sortOrder: 2,
    },
  });

  const catU12A = await prisma.teamCategory.upsert({
    where: { teamId_name: { teamId: teamU12.id, name: 'U-12A' } },
    update: {},
    create: { teamId: teamU12.id, name: 'U-12A', sortOrder: 0 },
  });

  const catU12B = await prisma.teamCategory.upsert({
    where: { teamId_name: { teamId: teamU12.id, name: 'U-12B' } },
    update: {},
    create: { teamId: teamU12.id, name: 'U-12B', sortOrder: 1 },
  });

  const catU15A = await prisma.teamCategory.upsert({
    where: { teamId_name: { teamId: teamU15.id, name: 'U-15A' } },
    update: {},
    create: { teamId: teamU15.id, name: 'U-15A', sortOrder: 0 },
  });

  const catU15B = await prisma.teamCategory.upsert({
    where: { teamId_name: { teamId: teamU15.id, name: 'U-15B' } },
    update: {},
    create: { teamId: teamU15.id, name: 'U-15B', sortOrder: 1 },
  });

  const coachU12User = await prisma.user.upsert({
    where: { email: 'coach-u12@example.com' },
    update: {},
    create: {
      email: 'coach-u12@example.com',
      password: hashedPassword,
      name: '田中 健太',
    },
  });

  const coachU15User = await prisma.user.upsert({
    where: { email: 'coach-u15@example.com' },
    update: {},
    create: {
      email: 'coach-u15@example.com',
      password: hashedPassword,
      name: '佐藤 大輔',
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@example.com' },
    update: {},
    create: {
      email: 'manager@example.com',
      password: hashedPassword,
      name: '鈴木 誠一',
    },
  });

  await prisma.userTeam.upsert({
    where: { userId_teamId_role: { userId: coachU12User.id, teamId: teamU12.id, role: 'COACH' } },
    update: {},
    create: { userId: coachU12User.id, teamId: teamU12.id, role: 'COACH' },
  });

  await prisma.userTeam.upsert({
    where: { userId_teamId_role: { userId: coachU15User.id, teamId: teamU15.id, role: 'COACH' } },
    update: {},
    create: { userId: coachU15User.id, teamId: teamU15.id, role: 'COACH' },
  });

  await prisma.userTeam.upsert({
    where: { userId_teamId_role: { userId: managerUser.id, teamId: parentTeam.id, role: 'TEAM_MANAGER' } },
    update: {},
    create: { userId: managerUser.id, teamId: parentTeam.id, role: 'TEAM_MANAGER' },
  });

  await prisma.userTeam.upsert({
    where: { userId_teamId_role: { userId: managerUser.id, teamId: teamU12.id, role: 'TEAM_MANAGER' } },
    update: {},
    create: { userId: managerUser.id, teamId: teamU12.id, role: 'TEAM_MANAGER' },
  });

  await prisma.userTeam.upsert({
    where: { userId_teamId_role: { userId: managerUser.id, teamId: teamU15.id, role: 'TEAM_MANAGER' } },
    update: {},
    create: { userId: managerUser.id, teamId: teamU15.id, role: 'TEAM_MANAGER' },
  });

  const u12Players = [
    { id: 'p-u12-01', name: '山田 翔太', number: '1', position: 'GK', cat: catU12A.id },
    { id: 'p-u12-02', name: '中村 蓮',   number: '2', position: 'DF', cat: catU12A.id },
    { id: 'p-u12-03', name: '小林 陽斗', number: '3', position: 'DF', cat: catU12A.id },
    { id: 'p-u12-04', name: '加藤 悠真', number: '4', position: 'DF', cat: catU12A.id },
    { id: 'p-u12-05', name: '吉田 颯太', number: '5', position: 'MF', cat: catU12A.id },
    { id: 'p-u12-06', name: '渡辺 大翔', number: '6', position: 'MF', cat: catU12A.id },
    { id: 'p-u12-07', name: '伊藤 湊',   number: '7', position: 'MF', cat: catU12A.id },
    { id: 'p-u12-08', name: '山本 樹',   number: '8', position: 'FW', cat: catU12A.id },
    { id: 'p-u12-09', name: '松本 朝陽', number: '9', position: 'FW', cat: catU12B.id },
    { id: 'p-u12-10', name: '井上 結翔', number: '10', position: 'MF', cat: catU12B.id },
    { id: 'p-u12-11', name: '木村 蒼空', number: '11', position: 'FW', cat: catU12B.id },
    { id: 'p-u12-12', name: '林 悠人',   number: '12', position: 'DF', cat: catU12B.id },
    { id: 'p-u12-13', name: '斎藤 陽翔', number: '13', position: 'MF', cat: catU12B.id },
    { id: 'p-u12-14', name: '清水 碧',   number: '14', position: 'GK', cat: catU12B.id },
    { id: 'p-u12-15', name: '森 奏太',   number: '15', position: 'DF', cat: catU12B.id },
  ];

  const u15Players = [
    { id: 'p-u15-01', name: '高橋 海翔', number: '1', position: 'GK', cat: catU15A.id },
    { id: 'p-u15-02', name: '田村 凛太朗', number: '2', position: 'DF', cat: catU15A.id },
    { id: 'p-u15-03', name: '三浦 颯真', number: '3', position: 'DF', cat: catU15A.id },
    { id: 'p-u15-04', name: '岡田 琉生', number: '4', position: 'DF', cat: catU15A.id },
    { id: 'p-u15-05', name: '藤田 瑛太', number: '5', position: 'MF', cat: catU15A.id },
    { id: 'p-u15-06', name: '原田 陸斗', number: '6', position: 'MF', cat: catU15A.id },
    { id: 'p-u15-07', name: '村上 壮真', number: '7', position: 'MF', cat: catU15A.id },
    { id: 'p-u15-08', name: '近藤 暖',   number: '8', position: 'FW', cat: catU15A.id },
    { id: 'p-u15-09', name: '石井 拓海', number: '9', position: 'FW', cat: catU15A.id },
    { id: 'p-u15-10', name: '前田 律',   number: '10', position: 'MF', cat: catU15A.id },
    { id: 'p-u15-11', name: '上田 晴',   number: '11', position: 'FW', cat: catU15B.id },
    { id: 'p-u15-12', name: '中島 翼',   number: '12', position: 'MF', cat: catU15B.id },
    { id: 'p-u15-13', name: '西村 健太', number: '13', position: 'DF', cat: catU15B.id },
    { id: 'p-u15-14', name: '福田 新',   number: '14', position: 'GK', cat: catU15B.id },
    { id: 'p-u15-15', name: '横山 遼',   number: '15', position: 'DF', cat: catU15B.id },
    { id: 'p-u15-16', name: '宮崎 駿太', number: '16', position: 'MF', cat: catU15B.id },
    { id: 'p-u15-17', name: '大野 一真', number: '17', position: 'FW', cat: catU15B.id },
    { id: 'p-u15-18', name: '安藤 悠斗', number: '18', position: 'DF', cat: catU15B.id },
  ];

  const now = new Date();
  const joinBase = new Date(now.getFullYear() - 1, 3, 1);
  const gradBase = new Date(now.getFullYear() + 2, 2, 31);

  const playerUserEmails = [];

  for (const p of u12Players) {
    const email = `${p.id}@example.com`;
    playerUserEmails.push({ email, name: p.name, playerId: p.id });
    const pUser = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, password: hashedPassword, name: p.name },
    });
    await prisma.userTeam.upsert({
      where: { userId_teamId_role: { userId: pUser.id, teamId: teamU12.id, role: 'PLAYER' } },
      update: {},
      create: { userId: pUser.id, teamId: teamU12.id, role: 'PLAYER' },
    });
    await prisma.player.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        userId: pUser.id,
        teamId: teamU12.id,
        teamCategoryId: p.cat,
        name: p.name,
        number: p.number,
        position: p.position,
        joinedAt: joinBase,
        graduationDate: gradBase,
      },
    });
  }

  for (const p of u15Players) {
    const email = `${p.id}@example.com`;
    playerUserEmails.push({ email, name: p.name, playerId: p.id });
    const pUser = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, password: hashedPassword, name: p.name },
    });
    await prisma.userTeam.upsert({
      where: { userId_teamId_role: { userId: pUser.id, teamId: teamU15.id, role: 'PLAYER' } },
      update: {},
      create: { userId: pUser.id, teamId: teamU15.id, role: 'PLAYER' },
    });
    await prisma.player.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        userId: pUser.id,
        teamId: teamU15.id,
        teamCategoryId: p.cat,
        name: p.name,
        number: p.number,
        position: p.position,
        joinedAt: joinBase,
        graduationDate: gradBase,
      },
    });
  }

  const evalCategories = [
    { name: '技術', children: [
      { name: 'ボールコントロール', description: 'ボールを自在に操る能力' },
      { name: 'パス', description: '正確なパスを出す能力' },
      { name: 'シュート', description: 'ゴールを決める能力' },
      { name: 'ドリブル', description: '相手を抜く能力' },
    ]},
    { name: 'フィジカル', children: [
      { name: 'スピード', description: '走る速さ' },
      { name: 'スタミナ', description: '持久力' },
      { name: '筋力', description: '体の強さ' },
    ]},
    { name: 'メンタル', children: [
      { name: '判断力', description: '適切な判断を下す能力' },
      { name: 'コミュニケーション', description: 'チームメイトとの連携' },
      { name: '集中力', description: '試合中の集中力' },
    ]},
  ];

  const allLeafItems = [];

  for (const teamId of [parentTeam.id]) {
    let sortOrder = 0;
    for (const category of evalCategories) {
      const parentItem = await prisma.evaluationItem.upsert({
        where: { id: `item-${teamId}-${category.name}` },
        update: {},
        create: {
          id: `item-${teamId}-${category.name}`,
          teamId: teamId,
          name: category.name,
          sortOrder: sortOrder++,
        },
      });

      for (const child of category.children) {
        const item = await prisma.evaluationItem.upsert({
          where: { id: `item-${teamId}-${child.name}` },
          update: {},
          create: {
            id: `item-${teamId}-${child.name}`,
            teamId: teamId,
            parentId: parentItem.id,
            name: child.name,
            description: child.description,
            maxScore: 5,
            sortOrder: sortOrder++,
          },
        });
        allLeafItems.push(item);
      }
    }
  }

  const roundDefs = [
    { id: 'round-2025-04', name: '2025年4月評価',  start: '2025-04-01', end: '2025-04-30' },
    { id: 'round-2025-06', name: '2025年6月評価',  start: '2025-06-01', end: '2025-06-30' },
    { id: 'round-2025-09', name: '2025年9月評価',  start: '2025-09-01', end: '2025-09-30' },
    { id: 'round-2025-12', name: '2025年12月評価', start: '2025-12-01', end: '2025-12-31' },
    { id: 'round-2026-03', name: '2026年3月評価',  start: '2026-03-01', end: '2026-03-31' },
  ];

  const allRounds = [];
  for (const teamId of [parentTeam.id]) {
    for (const rd of roundDefs) {
      const roundId = `${rd.id}-${teamId}`;
      const r = await prisma.evaluationRound.upsert({
        where: { id: roundId },
        update: {},
        create: {
          id: roundId,
          teamId: teamId,
          name: rd.name,
          startDate: new Date(rd.start),
          endDate: new Date(rd.end),
        },
      });
      allRounds.push(r);
    }
  }

  function pseudoRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  const allPlayerIds = [...u12Players, ...u15Players].map(p => p.id);
  let evalSeed = 1;

  const evalData = [];
  for (const player of allPlayerIds) {
    for (const round of allRounds) {
      for (const item of allLeafItems) {
        const r = pseudoRandom(evalSeed++);
        if (r < 0.7) {
          const score = Math.floor(pseudoRandom(evalSeed++) * 5) + 1;
          const coachId = u12Players.some(p => p.id === player) ? coachU12User.id : coachU15User.id;
          evalData.push({
            playerId: player,
            itemId: item.id,
            roundId: round.id,
            score,
            raterType: 'COACH',
            raterUserId: coachId,
            evaluatedAt: new Date(round.startDate),
          });
        }
      }
    }
  }

  await prisma.evaluation.deleteMany({});
  const BATCH = 500;
  for (let i = 0; i < evalData.length; i += BATCH) {
    await prisma.evaluation.createMany({ data: evalData.slice(i, i + BATCH) });
  }
  console.log(`評価データ: ${evalData.length}件作成`);

  const oldTeam = await prisma.team.findUnique({ where: { id: 'team-cf' } });
  if (oldTeam) {
    console.log('Migrating old CF team data...');
    const oldPlayers = await prisma.player.findMany({ where: { teamId: 'team-cf' } });
    for (const op of oldPlayers) {
      await prisma.evaluation.deleteMany({ where: { playerId: op.id } });
      await prisma.player.delete({ where: { id: op.id } });
    }
    await prisma.evaluationRound.deleteMany({ where: { teamId: 'team-cf' } });
    await prisma.evaluationItem.deleteMany({ where: { teamId: 'team-cf' } });
    await prisma.userTeam.deleteMany({ where: { teamId: 'team-cf' } });
    await prisma.team.delete({ where: { id: 'team-cf' } });
    console.log('Old CF team removed.');
  }

  const coachOldUser = await prisma.user.findUnique({ where: { email: 'coach@example.com' } });
  if (coachOldUser) {
    await prisma.userTeam.upsert({
      where: { userId_teamId_role: { userId: coachOldUser.id, teamId: teamU15.id, role: 'COACH' } },
      update: {},
      create: { userId: coachOldUser.id, teamId: teamU15.id, role: 'COACH' },
    });
  }

  const playerOldUser = await prisma.user.findUnique({ where: { email: 'player@example.com' } });
  if (playerOldUser) {
    const existingPlayer = await prisma.player.findFirst({ where: { userId: playerOldUser.id } });
    if (!existingPlayer) {
      await prisma.userTeam.upsert({
        where: { userId_teamId_role: { userId: playerOldUser.id, teamId: teamU15.id, role: 'PLAYER' } },
        update: {},
        create: { userId: playerOldUser.id, teamId: teamU15.id, role: 'PLAYER' },
      });
      await prisma.player.create({
        data: {
          userId: playerOldUser.id,
          teamId: teamU15.id,
          teamCategoryId: catU15A.id,
          name: '選手 花子',
          number: '20',
          position: 'MF',
          joinedAt: joinBase,
          graduationDate: gradBase,
        },
      });
    }
  }

  console.log('');
  console.log('Seed completed!');
  console.log('');
  console.log('=== チーム構成 ===');
  console.log(`親チーム: ${parentTeam.name}`);
  console.log(`  └ ${teamU12.name} (選手${u12Players.length}名)`);
  console.log(`  └ ${teamU15.name} (選手${u15Players.length}名)`);
  console.log('');
  console.log('=== テストアカウント ===');
  console.log('  管理者: admin@example.com / admin123');
  console.log(`  チームマネージャー: manager@example.com / password123 (${parentTeam.name})`);
  console.log(`  U-12コーチ: coach-u12@example.com / password123`);
  console.log(`  U-15コーチ: coach-u15@example.com / password123`);
  console.log(`  旧コーチ: coach@example.com / password123 (U-15に移行)`);
  console.log(`  選手: player@example.com / password123 (U-15に移行)`);
  console.log('');
  console.log(`評価ラウンド: ${roundDefs.length}回分`);
  console.log(`評価項目: ${evalCategories.length}カテゴリ, ${allLeafItems.length}項目`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
