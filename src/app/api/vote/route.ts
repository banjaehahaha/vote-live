import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { isValidSid, isValidChoice, type VoteChoice } from "@/lib/validation";

export const runtime = "nodejs";
const NO_STORE = "no-store";
const DEBUG_VOTE = process.env.DEBUG_VOTE_LOGS === "true";
const IS_DEV_OR_PREVIEW =
  process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview";

function logDebug(
  type: "validation_error" | "db_connection_error" | "unknown_error" | "success",
  data: Record<string, unknown>
) {
  const ts = new Date().toISOString();
  console.error(`[POST /api/vote][debug] ${ts} type=${type}`, JSON.stringify(data));
}

/**
 * POST /api/vote
 * body: { sid, choice }
 * 캐시 비활성화로 항상 최신 상태 반영. 트랜잭션은 단일 insert로 원자성 보장.
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

    await getPrisma().voteEvent.create({
      data: { sid: sid as string, choice: choice as VoteChoice },
    });

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
    const isDbConnection =
      /connect|upstream|ECONNREFUSED|ETIMEDOUT|connection/i.test(msg) ||
      e?.code === "P1001" ||
      e?.code === "P1017";
    const errorType = isDbConnection ? "db_connection_error" : "unknown_error";

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
