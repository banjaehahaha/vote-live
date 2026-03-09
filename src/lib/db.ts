import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * 서버 전역에서 단일 PrismaClient 인스턴스 사용.
 * Prisma 7: adapter 필수. DATABASE_URL은 반드시 pooled connection string.
 * serverless 동시 요청 시 연결 수 제한으로 "Failed to connect to upstream" 방지.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  dbConfigLogged?: boolean;
};

const POOL_MAX = 1;
const CONNECTION_TIMEOUT_MS = 10_000;
const IDLE_TIMEOUT_MS = 20_000;

function createPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaPg({
    connectionString,
    max: POOL_MAX,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** 요청 시점에만 DB 연결 생성. 빌드 시 DATABASE_URL 없어도 번들 성공. */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrisma();
    if (!globalForPrisma.dbConfigLogged) {
      globalForPrisma.dbConfigLogged = true;
      const u = process.env.DATABASE_URL ?? "";
      const pooled = /pooler|pool|pgbouncer|session/i.test(u) || u.includes(":6543");
      console.error(
        "[db][config]",
        JSON.stringify({
          pooledHint: pooled ? "likely_pooled" : "direct_or_unknown",
          poolMax: POOL_MAX,
          connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
          idleTimeoutMillis: IDLE_TIMEOUT_MS,
        })
      );
    }
  }
  return globalForPrisma.prisma;
}
