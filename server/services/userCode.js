const USER_CODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/;

function normalizeUserCode(input) {
  if (input === undefined || input === null) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}

function isValidUserCode(code) {
  return typeof code === 'string' && USER_CODE_REGEX.test(code);
}

async function generateNextAutoCode(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COALESCE(MAX(CAST(SUBSTRING("userCode" FROM 'U-([0-9]+)$') AS INTEGER)), 0) AS max FROM "User" WHERE "userCode" ~ '^U-[0-9]+$'`
  );
  const next = Number(rows[0].max) + 1;
  return 'U-' + String(next).padStart(6, '0');
}

async function resolveUserCode(prisma, requestedCode, { excludeId } = {}) {
  const normalized = normalizeUserCode(requestedCode);
  if (!normalized) {
    for (let i = 0; i < 5; i++) {
      const candidate = await generateNextAutoCode(prisma);
      const existing = await prisma.user.findUnique({ where: { userCode: candidate }, select: { id: true } });
      if (!existing) return candidate;
    }
    throw new Error('Failed to generate unique user code');
  }
  if (!isValidUserCode(normalized)) {
    const err = new Error('ユーザーIDは半角英数・ハイフン・アンダースコアで2〜32文字、先頭は英数字にしてください');
    err.statusCode = 400;
    throw err;
  }
  const existing = await prisma.user.findUnique({ where: { userCode: normalized }, select: { id: true } });
  if (existing && existing.id !== excludeId) {
    const err = new Error('指定されたユーザーIDは既に使用されています');
    err.statusCode = 409;
    throw err;
  }
  return normalized;
}

module.exports = { normalizeUserCode, isValidUserCode, generateNextAutoCode, resolveUserCode };
