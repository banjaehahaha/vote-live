import { NextRequest, NextResponse } from "next/server";
import { getRedis, voteKey, voteUpdatedKey, voteSessionKey } from "@/lib/redis";
import { isValidSid, isValidChoice, type VoteChoice } from "@/lib/validation";

export const runtime = "nodejs";
const NO_STORE = "no-store";
const DEBUG_VOTE = process.env.DEBUG_VOTE_LOGS === "true";
const IS_DEV_OR_PREVIEW =
  process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview";

function logDebug(
  type: "validation_error" | "redis_error" | "unknown_error" | "success",
  data: Record<string, unknown>
) {
  const ts = new Date().toISOString();
  console.error(`[POST /api/vote][debug] ${ts} type=${type}`, JSON.stringify(data));
}

/**
 * POST /api/vote
 * body: { sid, choice }
 * Redis hash vote:{sid} 의 choice 필드를 atomic increment.
 */
export async function POST(request: NextRequest) {
  let sid: unknown;
  let choice: unknown;
  try {
    const body = await request.json();
    sid = body?.sid;
    choice = body?.choice;

    if (!isValidSid(sid)) {
      logDebug("validation_error", { sid: String(sid ?? "").slice(0, 32), reason: "invalid_or_missing_sid" });
      return NextResponse.json(
        { error: "Invalid or missing sid" },
        { status: 400, headers: { "Cache-Control": NO_STORE } }
      );
    }
    if (!isValidChoice(choice)) {
      logDebug("validation_error", { sid, choice: String(choice ?? "").slice(0, 16), reason: "invalid_or_missing_choice" });
      return NextResponse.json(
        { error: "Invalid or missing choice" },
        { status: 400, headers: { "Cache-Control": NO_STORE } }
      );
    }

    const redis = getRedis();
    const sessionKey = voteSessionKey(sid as string);
    const sessionRaw = await redis.hgetall(sessionKey);
    const phase = sessionRaw && typeof sessionRaw === "object" && sessionRaw.phase === "running" ? "running" : sessionRaw && typeof sessionRaw === "object" && sessionRaw.phase === "closed" ? "closed" : "idle";
    if (phase !== "running") {
      return NextResponse.json(
        { error: phase === "closed" ? "Vote has ended" : "Vote has not started" },
        { status: 409, headers: { "Cache-Control": NO_STORE } }
      );
    }

    const key = voteKey(sid as string);
    const updatedKey = voteUpdatedKey(sid as string);
    await redis.hincrby(key, choice as string, 1);
    await redis.set(updatedKey, new Date().toISOString());

    if (DEBUG_VOTE) {
      logDebug("success", { sid, choice });
    }

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { "Cache-Control": NO_STORE } }
    );
  } catch (err) {
    const e = err as Error & { code?: string };
    const msg = e?.message ?? String(err);
    const isRedis =
      /redis|upstash|ECONNREFUSED|ETIMEDOUT|connection/i.test(msg) || e?.code != null;
    const errorType = isRedis ? "redis_error" : "unknown_error";

    const stackFirst = e?.stack?.split("\n")[1]?.trim() ?? "";

    logDebug(errorType, {
      timestamp: new Date().toISOString(),
      sid: sid ?? "(none)",
      choice: choice ?? "(none)",
      errorName: e?.name,
      errorMessage: msg.slice(0, 200),
      errorCode: e?.code,
      stackFirst: stackFirst.slice(0, 120),
    });

    const body: { error: string; errorType?: string; detail?: string } = {
      error: "Vote failed",
    };
    if (IS_DEV_OR_PREVIEW) {
      body.errorType = errorType;
      body.detail = msg.slice(0, 100);
    }

    return NextResponse.json(body, {
      status: 500,
      headers: { "Cache-Control": NO_STORE },
    });
  }
}
