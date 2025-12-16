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
        role: 'OPERATOR_ADMIN'
      }
    },
    update: {},
    create: {
      userId: adminUser.id,
      organizationId: org.id,
      role: 'OPERATOR_ADMIN',
    },
  });

  const team = await prisma.team.upsert({
    where: { id: 'team-cf' },
    update: {},
    create: {
      id: 'team-cf',
      organizationId: org.id,
      name: 'CF ユースアカデミー',
      description: '次世代の選手を育成するチームです',
    },
  });

  const coachUser = await prisma.user.upsert({
    where: { email: 'coach@example.com' },
    update: {},
    create: {
      email: 'coach@example.com',
      password: hashedPassword,
      name: '監督 一郎',
    },
  });

  await prisma.userTeam.upsert({
    where: { 
      userId_teamId_role: {
        userId: coachUser.id,
        teamId: team.id,
        role: 'TEAM_HEAD_COACH'
      }
    },
    update: {},
    create: {
      userId: coachUser.id,
      teamId: team.id,
      role: 'TEAM_HEAD_COACH',
    },
  });

  const playerUser = await prisma.user.upsert({
    where: { email: 'player@example.com' },
    update: {},
    create: {
      email: 'player@example.com',
      password: hashedPassword,
      name: '選手 花子',
    },
  });

  await prisma.userTeam.upsert({
    where: { 
      userId_teamId_role: {
        userId: playerUser.id,
        teamId: team.id,
        role: 'PLAYER'
      }
    },
    update: {},
    create: {
      userId: playerUser.id,
      teamId: team.id,
      role: 'PLAYER',
    },
  });

  const player = await prisma.player.upsert({
    where: { id: 'player-1' },
    update: {},
    create: {
      id: 'player-1',
      userId: playerUser.id,
      teamId: team.id,
      name: '選手 花子',
      number: '10',
      position: 'MF',
    },
  });

  const categories = [
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

  let sortOrder = 0;
  for (const category of categories) {
    const parentItem = await prisma.evaluationItem.upsert({
      where: { id: `item-${category.name}` },
      update: {},
      create: {
        id: `item-${category.name}`,
        teamId: team.id,
        name: category.name,
        sortOrder: sortOrder++,
      },
    });

    for (const child of category.children) {
      await prisma.evaluationItem.upsert({
        where: { id: `item-${child.name}` },
        update: {},
        create: {
          id: `item-${child.name}`,
          teamId: team.id,
          parentId: parentItem.id,
          name: child.name,
          description: child.description,
          sortOrder: sortOrder++,
        },
      });
    }
  }

  const round = await prisma.evaluationRound.upsert({
    where: { id: 'round-2024-12' },
    update: {},
    create: {
      id: 'round-2024-12',
      teamId: team.id,
      name: '2024年12月評価',
      startDate: new Date('2024-12-01'),
      endDate: new Date('2024-12-31'),
    },
  });

  console.log('Seed completed!');
  console.log('Test accounts:');
  console.log('  Admin: admin@example.com / admin123');
  console.log('  Coach: coach@example.com / password123');
  console.log('  Player: player@example.com / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
