const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const LEGACY_ROLE_MAP = {
  'OPERATOR_ADMIN': 'SUPER_ADMIN',
  'OPERATOR_MANAGER': 'ADMIN',
  'OPERATOR_STAFF': 'OPERATOR',
  'OPERATOR_EXTERNAL': 'EXTERNAL',
  'TEAM_ADMIN': 'TEAM_MANAGER',
  'TEAM_HEAD_COACH': 'COACH',
  'TEAM_COACH': 'COACH',
  'TEAM_EXTERNAL_COACH': 'GUEST_COACH',
  'PLAYER': 'PLAYER',
  'PARENT': 'PARENT'
};

async function migrateRoles() {
  console.log('Starting role migration...');

  try {
    const orgRoles = await prisma.$queryRaw`
      SELECT DISTINCT role FROM "UserOrganization"
    `;
    console.log('Current organization roles:', orgRoles);

    const teamRoles = await prisma.$queryRaw`
      SELECT DISTINCT role FROM "UserTeam"
    `;
    console.log('Current team roles:', teamRoles);

    const invitationRoles = await prisma.$queryRaw`
      SELECT DISTINCT role FROM "Invitation"
    `;
    console.log('Current invitation roles:', invitationRoles);

    for (const [oldRole, newRole] of Object.entries(LEGACY_ROLE_MAP)) {
      if (oldRole === newRole) continue;

      console.log(`Migrating ${oldRole} -> ${newRole}...`);

      const orgUpdated = await prisma.$executeRaw`
        UPDATE "UserOrganization" SET role = ${newRole}::"RoleType" 
        WHERE role = ${oldRole}::"RoleType"
      `;
      if (orgUpdated > 0) {
        console.log(`  Updated ${orgUpdated} UserOrganization records`);
      }

      const teamUpdated = await prisma.$executeRaw`
        UPDATE "UserTeam" SET role = ${newRole}::"RoleType" 
        WHERE role = ${oldRole}::"RoleType"
      `;
      if (teamUpdated > 0) {
        console.log(`  Updated ${teamUpdated} UserTeam records`);
      }

      const invUpdated = await prisma.$executeRaw`
        UPDATE "Invitation" SET role = ${newRole}::"RoleType" 
        WHERE role = ${oldRole}::"RoleType"
      `;
      if (invUpdated > 0) {
        console.log(`  Updated ${invUpdated} Invitation records`);
      }
    }

    console.log('Role migration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateRoles().catch(console.error);
