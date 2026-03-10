import { NextRequest, NextResponse } from "next/server";
import { getRedis, voteKey, voteUpdatedKey, voteSessionKey, voteKeyPattern } from "@/lib/redis";
import { isValidSid } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * GET /api/admin/reset-votes?token=YOUR_SECRET
 * GET /api/admin/reset-votes?token=YOUR_SECRET&sid=xxx
 *
 * Redis 투표 데이터 삭제.
 * - sid 있으면 해당 sid만 삭제 (vote:{sid}, vote:{sid}:updated)
 * - sid 없으면 vote:* 패턴 전체 삭제
 * RESET_SECRET 환경변수와 token 일치 시에만 실행.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const sidParam = request.nextUrl.searchParams.get("sid");
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
    const redis = getRedis();

    if (sidParam && isValidSid(sidParam)) {
      const key = voteKey(sidParam);
      const updatedKey = voteUpdatedKey(sidParam);
      const sessionKey = voteSessionKey(sidParam);
      await redis.del(key, updatedKey, sessionKey);
      return NextResponse.json({
        ok: true,
        message: `세션 "${sidParam}" 투표가 초기화되었습니다.`,
        deleted: sidParam,
      });
    }

    let cursor: string | number = "0";
    const keysToDelete: string[] = [];
    do {
      const [next, keys] = await redis.scan(cursor, { match: voteKeyPattern(), count: 100 });
      cursor = next as string;
      keysToDelete.push(...(keys as string[]));
    } while (cursor !== "0");

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
    }

    return NextResponse.json({
      ok: true,
      message: "투표가 전체 초기화되었습니다.",
      deleted: keysToDelete.length,
    });
  } catch (err) {
    console.error("[GET /api/admin/reset-votes]", err);
    return NextResponse.json(
      { error: "Reset failed" },
      { status: 500 }
    );
  }
}
