/**
 * 발표 모듈 lock 이후 상태 저장/복구.
 * lock 이후 서버를 보지 않고, 새로고침 시 이 스냅샷으로 복구.
 */

import type { VoteChoice } from "@/lib/validation";

export type PresentationStage =
  | "setup"
  | "intro"
  | "vote"
  | "locked-result"
  | "present-existing-works"
  | "residency-plan"
  | "end";

/** 순위별 choice (1~4위) */
export type RankedChoices = [VoteChoice, VoteChoice, VoteChoice, VoteChoice];

/** 순위별 할당 시간(ms) [1위, 2위, 3위, 4위] */
export type AllocationsMs = [number, number, number, number];

export type CountsSnapshot = Record<VoteChoice, number>;

export type TimerStatus = "idle" | "running" | "paused" | "ended";

/** lock 이후 저장하는 스냅샷 (present-existing-works ~ end 복구용) */
export interface PresentationSnapshot {
  sid: string;
  lockedAt: string; // ISO
  countsSnapshot: CountsSnapshot;
  rankedChoices: RankedChoices;
  allocations: AllocationsMs; // ms
  currentStage: PresentationStage;
  currentWorkIndex: number; // 0..3
  timerStatus: TimerStatus;
  targetTime: number | null; // Date.now() + remainingMs (running일 때)
  pausedRemainingMs: number | null; // paused일 때 남은 시간
}

const STORAGE_KEY = "vote-live:presentation";

export function getPresentationSnapshot(): PresentationSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const d = data as Record<string, unknown>;
    if (
      typeof d.sid !== "string" ||
      typeof d.lockedAt !== "string" ||
      !d.countsSnapshot ||
      !Array.isArray(d.rankedChoices) ||
      d.rankedChoices.length !== 4 ||
      !Array.isArray(d.allocations) ||
      d.allocations.length !== 4
    ) {
      return null;
    }
    return data as PresentationSnapshot;
  } catch {
    return null;
  }
}

export function savePresentationSnapshot(snapshot: PresentationSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}

export function clearPresentationSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** 현재 sid와 일치하는 스냅샷만 유효 */
export function getSnapshotForSid(sid: string): PresentationSnapshot | null {
  const snap = getPresentationSnapshot();
  if (!snap || snap.sid !== sid) return null;
  return snap;
}
