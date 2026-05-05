const TEAM_CODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/;

function normalizeTeamCode(input) {
  if (input === undefined || input === null) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}

function isValidTeamCode(code) {
  return typeof code === 'string' && TEAM_CODE_REGEX.test(code);
}

async function generateNextAutoCode(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COALESCE(MAX(CAST(SUBSTRING("teamCode" FROM 'T-([0-9]+)$') AS INTEGER)), 0) AS max FROM "Team" WHERE "teamCode" ~ '^T-[0-9]+$'`
  );
  const next = Number(rows[0].max) + 1;
  return 'T-' + String(next).padStart(6, '0');
}

async function resolveTeamCode(prisma, requestedCode, { excludeId } = {}) {
  const normalized = normalizeTeamCode(requestedCode);
  if (!normalized) {
    for (let i = 0; i < 5; i++) {
      const candidate = await generateNextAutoCode(prisma);
      const existing = await prisma.team.findUnique({ where: { teamCode: candidate }, select: { id: true } });
      if (!existing) return candidate;
    }
    throw new Error('Failed to generate unique team code');
  }
  if (!isValidTeamCode(normalized)) {
    const err = new Error('チームIDは半角英数・ハイフン・アンダースコアで2〜32文字、先頭は英数字にしてください');
    err.statusCode = 400;
    throw err;
  }
  const existing = await prisma.team.findUnique({ where: { teamCode: normalized }, select: { id: true } });
  if (existing && existing.id !== excludeId) {
    const err = new Error('指定されたチームIDは既に使用されています');
    err.statusCode = 409;
    throw err;
  }
  return normalized;
}

module.exports = { normalizeTeamCode, isValidTeamCode, generateNextAutoCode, resolveTeamCode };
