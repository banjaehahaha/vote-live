import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * 서버 전역에서 단일 PrismaClient 인스턴스 사용.
 * Prisma 7: adapter 필수. pg 풀은 한 번만 생성해 연결 누수 방지.
 * getPrisma()는 첫 사용 시에만 연결하므로 빌드 시 DATABASE_URL 없어도 컴파일 가능.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** 요청 시점에만 DB 연결 생성. 빌드 시 DATABASE_URL 없어도 번들 성공. */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrisma();
  }
  return globalForPrisma.prisma;
}
