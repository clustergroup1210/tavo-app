const prisma = require('../lib/prisma');

const MIN_BASE_LENGTH = 3;

const CATEGORY_PATTERNS = [
  /[\s\-－_・]*u[-－ー]?\d{1,2}s?\b/gi,
  /[\s\-－_・]*ジュニアユース/g,
  /[\s\-－_・]*ジュニア/g,
  /[\s\-－_・]*ユース/g,
  /[\s\-－_・]*シニア/g,
  /[\s\-－_・]*レディース/g,
  /[\s\-－_・]*トップチーム/g,
  /[\s\-－_・]*セカンドチーム/g,
  /[\s\-－_・]*サードチーム/g,
  /[\s\-－_・]*トップ/g,
  /[\s\-－_・]*セカンド/g,
  /[\s\-－_・]*(1st|2nd|3rd)\b/gi,
  /[\s\-－_・]*(top|second|third)\b/gi,
  /[\s\-－_・]+[a-cA-C]\b/g,
];

function normalizeName(name) {
  if (!name) return '';
  return name
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBaseName(name) {
  let s = normalizeName(name);
  let prev;
  do {
    prev = s;
    for (const p of CATEGORY_PATTERNS) {
      s = s.replace(p, '');
    }
    s = s.replace(/\s+/g, ' ').trim();
    s = s.replace(/[\s\-－_・]+$/g, '').trim();
  } while (s !== prev);
  return s;
}

function extractCategoryToken(name) {
  const norm = normalizeName(name);
  const base = extractBaseName(name);
  if (!base || norm === base) return null;
  let cat = norm;
  if (cat.startsWith(base)) {
    cat = cat.slice(base.length);
  } else {
    const idx = cat.indexOf(base);
    if (idx >= 0) {
      cat = cat.slice(0, idx) + cat.slice(idx + base.length);
    }
  }
  cat = cat.replace(/^[\s\-－_・]+|[\s\-－_・]+$/g, '').trim();
  return cat || null;
}

async function findCandidateParents(orgId, name, excludeId = null) {
  const base = extractBaseName(name);
  if (!base || base.length < MIN_BASE_LENGTH) return [];

  const category = extractCategoryToken(name);
  if (!category) return [];

  const where = {
    parentId: null,
  };
  if (orgId) where.organizationId = orgId;
  if (excludeId) where.id = { not: excludeId };

  const candidates = await prisma.team.findMany({
    where,
    select: { id: true, name: true, league: true, region: true, organizationId: true },
  });

  const baseLower = base.toLowerCase();
  return candidates
    .map(t => ({ team: t, candidateBase: extractBaseName(t.name) }))
    .filter(({ candidateBase, team }) => {
      if (!candidateBase) return false;
      if (team.name.trim() === name.trim()) return false;
      return candidateBase.toLowerCase() === baseLower;
    })
    .map(({ team }) => ({
      id: team.id,
      name: team.name,
      league: team.league,
      region: team.region,
      suggestedCategoryName: extractCategoryToken(name),
    }));
}

async function findDuplicateGroups(orgId) {
  const teams = await prisma.team.findMany({
    where: { organizationId: orgId, parentId: null },
    select: {
      id: true,
      name: true,
      league: true,
      region: true,
      _count: { select: { children: true, players: true } },
    },
    orderBy: { name: 'asc' },
  });

  const groups = new Map();
  for (const t of teams) {
    const base = extractBaseName(t.name);
    if (!base || base.length < 3) continue;
    const key = base.toLowerCase();
    if (!groups.has(key)) groups.set(key, { baseName: base, teams: [] });
    groups.get(key).teams.push({
      id: t.id,
      name: t.name,
      league: t.league,
      region: t.region,
      suggestedCategoryName: extractCategoryToken(t.name),
      childCount: t._count.children,
      playerCount: t._count.players,
    });
  }

  return Array.from(groups.values()).filter(g => g.teams.length >= 2);
}

module.exports = {
  normalizeName,
  extractBaseName,
  extractCategoryToken,
  findCandidateParents,
  findDuplicateGroups,
};
