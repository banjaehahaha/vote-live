import { NextRequest, NextResponse } from "next/server";
import { getRedis, voteSessionKey, voteKey, voteUpdatedKey } from "@/lib/redis";
import { isValidSid } from "@/lib/validation";

export const runtime = "nodejs";
const NO_STORE = "no-store";

/** 기본 투표 시간 1분 */
const DEFAULT_VOTE_DURATION_MS = 1 * 60 * 1000;

/**
 * POST /api/vote-session
 * body: { sid, action: "start" | "close" | "reset" }
 * - start: Redis vote-session:{sid}에 phase=running, closesAt 설정. 응답에 closesAt 반환.
 * - close: phase=closed 설정.
 * - reset: phase=idle로 되돌리고 해당 sid 투표 집계 초기화(다시 시작).
 */
export async function POST(request: NextRequest) {
  let sid: unknown;
  let action: unknown;
  try {
    const body = await request.json();
    sid = body?.sid;
    action = body?.action;

    if (!isValidSid(sid)) {
      return NextResponse.json(
        { error: "Invalid or missing sid" },
        { status: 400, headers: { "Cache-Control": NO_STORE } }
      );
    }
    if (action !== "start" && action !== "close" && action !== "reset") {
      return NextResponse.json(
        { error: "Invalid or missing action. Use 'start', 'close', or 'reset'." },
        { status: 400, headers: { "Cache-Control": NO_STORE } }
      );
    }

    const redis = getRedis();
    const sidStr = sid as string;
    const sessionKey = voteSessionKey(sidStr);

    if (action === "start") {
      const closesAt = Date.now() + DEFAULT_VOTE_DURATION_MS;
      await redis.hset(sessionKey, {
        phase: "running",
        closesAt: String(closesAt),
      });
      return NextResponse.json(
        { ok: true, closesAt },
        { headers: { "Cache-Control": NO_STORE } }
      );
    }

    if (action === "close") {
      await redis.hset(sessionKey, { phase: "closed" });
      return NextResponse.json(
        { ok: true },
        { headers: { "Cache-Control": NO_STORE } }
      );
    }

    if (action === "reset") {
      await redis.del(sessionKey);
      const key = voteKey(sidStr);
      const updatedKey = voteUpdatedKey(sidStr);
      await redis.del(key);
      await redis.del(updatedKey);
      return NextResponse.json(
        { ok: true },
        { headers: { "Cache-Control": NO_STORE } }
      );
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400, headers: { "Cache-Control": NO_STORE } }
    );
  } catch (err) {
    console.error("[POST /api/vote-session]", err);
    return NextResponse.json(
      { error: "Vote session update failed" },
      { status: 500, headers: { "Cache-Control": NO_STORE } }
    );
  }
}
