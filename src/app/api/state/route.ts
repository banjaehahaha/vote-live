import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { isValidSid } from "@/lib/validation";
import { VoteChoice } from "@prisma/client";

export const runtime = "nodejs";
const NO_STORE = "no-store";

/**
 * GET /api/state?sid=...
 * sid별 choice COUNT 집계. 캐시 없이 항상 DB 기준 최신값 반환.
 */
export async function GET(request: NextRequest) {
  const sid = request.nextUrl.searchParams.get("sid");
  if (!isValidSid(sid)) {
    return NextResponse.json(
      { error: "Invalid or missing sid" },
      { status: 400, headers: { "Cache-Control": NO_STORE } }
    );
  }

  try {
    const prisma = getPrisma();
    const groups = await prisma.voteEvent.groupBy({
      by: ["choice"],
      where: { sid },
      _count: { choice: true },
    });

    const counts: Record<VoteChoice, number> = {
      ITEM: 0,
      IMAGE: 0,
      DATA: 0,
      NEAR: 0,
    };
    for (const g of groups) {
      counts[g.choice] = g._count.choice;
    }

    const latest = await prisma.voteEvent.findFirst({
      where: { sid },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    return NextResponse.json(
      {
        sid,
        counts: {
          ITEM: counts.ITEM,
          IMAGE: counts.IMAGE,
          DATA: counts.DATA,
          NEAR: counts.NEAR,
        },
        updatedAt: latest?.createdAt?.toISOString() ?? new Date().toISOString(),
      },
      { headers: { "Cache-Control": NO_STORE } }
    );
  } catch (err) {
    console.error("[GET /api/state]", err);
    return NextResponse.json(
      { error: "State fetch failed" },
      { status: 500, headers: { "Cache-Control": NO_STORE } }
    );
  }
}
