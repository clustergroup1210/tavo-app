const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TEMPLATE_TEAM_NAME = 'VEDIALO CF';

async function main() {
  const template = await prisma.team.findFirst({ where: { name: TEMPLATE_TEAM_NAME } });
  if (!template) {
    console.error(`Template team "${TEMPLATE_TEAM_NAME}" not found.`);
    process.exit(1);
  }

  const templateTops = await prisma.evaluationItem.findMany({
    where: { teamId: template.id, parentId: null },
    select: { id: true, name: true, targetPositions: true },
  });
  console.log(`VEDIALO template top categories: ${templateTops.length}`);

  const tplToUpdate = templateTops.filter(t => !t.targetPositions || t.targetPositions.length === 0);
  if (tplToUpdate.length > 0) {
    const r = await prisma.evaluationItem.updateMany({
      where: { id: { in: tplToUpdate.map(t => t.id) } },
      data: { targetPositions: ['GK'] },
    });
    console.log(`Updated template top categories: ${r.count}`);
  } else {
    console.log('Template top categories already tagged.');
  }

  const templateAllIds = (await prisma.evaluationItem.findMany({
    where: { teamId: template.id },
    select: { id: true },
  })).map(x => x.id);

  const downstreamTops = await prisma.evaluationItem.findMany({
    where: {
      parentId: null,
      originalItemId: { in: templateAllIds },
      teamId: { not: template.id },
    },
    select: { id: true, teamId: true, targetPositions: true },
  });
  const toUpdate = downstreamTops.filter(t => !t.targetPositions || t.targetPositions.length === 0);
  console.log(`Downstream top categories needing tag: ${toUpdate.length} / ${downstreamTops.length}`);

  if (toUpdate.length > 0) {
    const r = await prisma.evaluationItem.updateMany({
      where: { id: { in: toUpdate.map(t => t.id) } },
      data: { targetPositions: ['GK'] },
    });
    console.log(`Updated downstream top categories: ${r.count}`);
  }

  console.log('Done.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
