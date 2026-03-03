import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { isValidSid, isValidChoice, type VoteChoice } from "@/lib/validation";

export const runtime = "nodejs";
const NO_STORE = "no-store";

/**
 * POST /api/vote
 * body: { sid, choice }
 * 캐시 비활성화로 항상 최신 상태 반영. 트랜잭션은 단일 insert로 원자성 보장.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sid = body?.sid;
    const choice = body?.choice;

    if (!isValidSid(sid)) {
      return NextResponse.json(
        { error: "Invalid or missing sid" },
        { status: 400, headers: { "Cache-Control": NO_STORE } }
      );
    }
    if (!isValidChoice(choice)) {
      return NextResponse.json(
        { error: "Invalid or missing choice" },
        { status: 400, headers: { "Cache-Control": NO_STORE } }
      );
    }

    await getPrisma().voteEvent.create({
      data: { sid, choice: choice as VoteChoice },
    });

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { "Cache-Control": NO_STORE } }
    );
  } catch (err) {
    console.error("[POST /api/vote]", err);
    return NextResponse.json(
      { error: "Vote failed" },
      { status: 500, headers: { "Cache-Control": NO_STORE } }
    );
  }
}
