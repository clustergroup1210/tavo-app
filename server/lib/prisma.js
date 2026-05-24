const { PrismaClient } = require('@prisma/client');

// シングルトン: 全リクエスト/ルートで同一の PrismaClient を共有し、
// RDS への接続数増加を防ぐ。dev のホットリロード対策として globalThis にキャッシュ。
const globalForPrisma = globalThis;

const prisma = globalForPrisma.__tavoPrisma || new PrismaClient({
  log: process.env.PRISMA_LOG === 'query'
    ? ['query', 'info', 'warn', 'error']
    : ['warn', 'error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__tavoPrisma = prisma;
}

module.exports = prisma;
