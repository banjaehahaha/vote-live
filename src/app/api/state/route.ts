import { NextRequest, NextResponse } from "next/server";
import { getRedis, voteKey, voteUpdatedKey, voteSessionKey } from "@/lib/redis";
import { isValidSid } from "@/lib/validation";
import type { VoteChoice } from "@/lib/validation";
import type { VoteSessionPhase } from "@/lib/redis";

export const runtime = "nodejs";
const NO_STORE = "no-store";

const CHOICES: VoteChoice[] = ["ITEM", "IMAGE", "DATA", "NEAR"];

function parseVoteSession(raw: Record<string, unknown> | null): { phase: VoteSessionPhase; closesAt: number | null } {
  if (!raw || typeof raw !== "object") return { phase: "idle", closesAt: null };
  const phase = (raw.phase === "running" || raw.phase === "closed" ? raw.phase : "idle") as VoteSessionPhase;
  let closesAt: number | null = null;
  if (raw.closesAt != null && raw.closesAt !== "") {
    const n = Number(raw.closesAt);
    if (!Number.isNaN(n)) closesAt = n;
  }
  return { phase, closesAt };
}

/**
 * GET /api/state?sid=...
 * Redis vote:{sid} 집계 + vote-session:{sid} 상태. totalVotes·updatedAt·voteSession 포함.
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
    const redis = getRedis();
    const key = voteKey(sid);
    const updatedKey = voteUpdatedKey(sid);
    const sessionKey = voteSessionKey(sid);

    const raw = await redis.hgetall(key);
    const counts: Record<VoteChoice, number> = {
      ITEM: 0,
      IMAGE: 0,
      DATA: 0,
      NEAR: 0,
    };
    if (raw && typeof raw === "object") {
      for (const c of CHOICES) {
        const v = raw[c];
        if (v != null) counts[c] = Number(v) || 0;
      }
    }

    const totalVotes = counts.ITEM + counts.IMAGE + counts.DATA + counts.NEAR;
    const updatedAtRaw = await redis.get(updatedKey);
    const updatedAt =
      updatedAtRaw && typeof updatedAtRaw === "string"
        ? updatedAtRaw
        : null;

    const sessionRaw = await redis.hgetall(sessionKey);
    const voteSession = parseVoteSession(sessionRaw as Record<string, unknown> | null);

    return NextResponse.json(
      {
        sid,
        counts: {
          ITEM: counts.ITEM,
          IMAGE: counts.IMAGE,
          DATA: counts.DATA,
          NEAR: counts.NEAR,
        },
        totalVotes,
        updatedAt,
        voteSession,
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
