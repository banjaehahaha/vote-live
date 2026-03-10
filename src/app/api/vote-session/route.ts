import { NextRequest, NextResponse } from "next/server";
import { getRedis, voteSessionKey } from "@/lib/redis";
import { isValidSid } from "@/lib/validation";

export const runtime = "nodejs";
const NO_STORE = "no-store";

/** 기본 투표 시간 5분 */
const DEFAULT_VOTE_DURATION_MS = 5 * 60 * 1000;

/**
 * POST /api/vote-session
 * body: { sid, action: "start" | "close" }
 * - start: Redis vote-session:{sid}에 phase=running, closesAt=타임스탬프 설정. 응답에 closesAt 반환.
 * - close: phase=closed 설정.
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
    if (action !== "start" && action !== "close") {
      return NextResponse.json(
        { error: "Invalid or missing action. Use 'start' or 'close'." },
        { status: 400, headers: { "Cache-Control": NO_STORE } }
      );
    }

    const redis = getRedis();
    const sessionKey = voteSessionKey(sid as string);

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
