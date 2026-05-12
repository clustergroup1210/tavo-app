const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TEMPLATE_TEAM_NAME = 'VEDIALO CF';

async function main() {
  const force = process.argv.includes('--force');

  const template = await prisma.team.findFirst({ where: { name: TEMPLATE_TEAM_NAME } });
  if (!template) {
    console.error(`Template team "${TEMPLATE_TEAM_NAME}" not found. Run scripts/seed-vedialo.js first.`);
    process.exit(1);
  }

  const templateCategories = await prisma.evaluationItem.findMany({
    where: { teamId: template.id, parentId: null, isActive: true },
    include: {
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      }
    },
    orderBy: { sortOrder: 'asc' }
  });

  if (templateCategories.length === 0) {
    console.error('Template has no items. Run scripts/seed-vedialo.js first.');
    process.exit(1);
  }

  const allTeams = await prisma.team.findMany({
    where: { id: { not: template.id } },
    select: { id: true, name: true }
  });
  console.log(`Found ${allTeams.length} target teams. Template has ${templateCategories.length} categories.`);

  let applied = 0;
  let skipped = 0;
  let failed = 0;

  for (const team of allTeams) {
    try {
      const existingCount = await prisma.evaluationItem.count({ where: { teamId: team.id } });
      if (existingCount > 0 && !force) {
        skipped++;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        if (force && existingCount > 0) {
          const evalCount = await tx.evaluation.count({
            where: { item: { teamId: team.id } }
          });
          if (evalCount > 0) {
            throw new Error(`team has ${evalCount} evaluation rows; refusing to wipe`);
          }
          await tx.evaluationItem.deleteMany({ where: { teamId: team.id } });
        }

        for (const cat of templateCategories) {
          const newCat = await tx.evaluationItem.create({
            data: {
              teamId: team.id,
              name: cat.name,
              description: cat.description,
              maxScore: cat.maxScore,
              sortOrder: cat.sortOrder,
              isActive: true,
              originalItemId: cat.id,
              targetPositions: cat.targetPositions
            }
          });
          for (const child of cat.children) {
            await tx.evaluationItem.create({
              data: {
                teamId: team.id,
                parentId: newCat.id,
                name: child.name,
                description: child.description,
                maxScore: child.maxScore,
                sortOrder: child.sortOrder,
                isActive: true,
                originalItemId: child.id,
                targetPositions: child.targetPositions
              }
            });
          }
        }
      }, { timeout: 60000, maxWait: 10000 });

      applied++;
      if (applied % 20 === 0) console.log(`  applied: ${applied}/${allTeams.length}`);
    } catch (e) {
      failed++;
      console.warn(`  skip ${team.name}: ${e.message}`);
    }
  }

  console.log(`\nDone. applied=${applied} skipped(existing)=${skipped} failed=${failed}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
