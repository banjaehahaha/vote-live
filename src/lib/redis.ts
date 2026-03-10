import { Redis } from "@upstash/redis";

/**
 * 실시간 투표/집계용 Redis 클라이언트.
 * Vercel KV(KV_REST_API_*) 또는 Upstash(UPSTASH_REDIS_REST_*) 환경변수 사용.
 */
let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    const url =
      process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
    const token =
      process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error(
        "Redis URL/token not set. Set KV_REST_API_URL + KV_REST_API_TOKEN (Vercel KV) or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (Upstash)."
      );
    }
    redisInstance = new Redis({ url, token });
  }
  return redisInstance;
}

const KEY_PREFIX = "vote:";
const UPDATED_SUFFIX = ":updated";

export function voteKey(sid: string): string {
  return `${KEY_PREFIX}${sid}`;
}

export function voteUpdatedKey(sid: string): string {
  return `${KEY_PREFIX}${sid}${UPDATED_SUFFIX}`;
}

export function voteKeyPattern(): string {
  return `${KEY_PREFIX}*`;
}

const SESSION_PREFIX = "vote-session:";

export function voteSessionKey(sid: string): string {
  return `${SESSION_PREFIX}${sid}`;
}

export type VoteSessionPhase = "idle" | "running" | "closed";
