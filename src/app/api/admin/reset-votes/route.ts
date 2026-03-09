import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/admin/reset-votes?token=YOUR_SECRET
 *
 * 투표 데이터(vote_events) 전체 삭제.
 * RESET_SECRET 환경 변수와 일치하는 token 쿼리만 허용.
 * 외부(다른 PC, 휴대폰)에서 브라우저로 접속해 초기화할 때 사용.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const secret = process.env.RESET_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "RESET_SECRET is not configured" },
      { status: 500 }
    );
  }

  if (!token || token !== secret) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  try {
    const prisma = getPrisma();
    const result = await prisma.$executeRawUnsafe("DELETE FROM vote_events");
    return NextResponse.json({
      ok: true,
      message: "투표가 초기화되었습니다.",
      deleted: result,
    });
  } catch (err) {
    console.error("[GET /api/admin/reset-votes]", err);
    return NextResponse.json(
      { error: "Reset failed" },
      { status: 500 }
    );
  }
}
