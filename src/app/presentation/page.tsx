"use client";

import {
  ALLOCATION_SECONDS,
  CHOICE_LABELS,
  CHOICE_WORK_TITLES,
  getRankedChoicesFromCounts,
  INTRO_QUESTION,
  VOTE_STAGE_TIME_RULES,
} from "@/lib/presentation-config";
import type { VoteChoice } from "@/lib/validation";
import {
  clearPresentationSnapshot,
  getSnapshotForSid,
  savePresentationSnapshot,
  type AllocationsMs,
  type CountsSnapshot,
  type PresentationSnapshot,
  type PresentationStage,
  type RankedChoices,
} from "@/lib/presentation-storage";
import { isValidSid } from "@/lib/validation";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  Suspense,
} from "react";

const DEFAULT_SID = "test1";
const POLL_INTERVAL_MS = 1000;
const BACKOFF_MS = [1000, 2000, 4000, 8000];
const VALID_CHOICES: VoteChoice[] = ["ITEM", "IMAGE", "DATA", "NEAR"];

const baseStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "2rem",
  fontFamily: "system-ui, sans-serif",
  background: "#111",
  color: "#fff",
};

const ALLOCATIONS_MS: AllocationsMs = [
  ALLOCATION_SECONDS[1] * 1000,
  ALLOCATION_SECONDS[2] * 1000,
  ALLOCATION_SECONDS[3] * 1000,
  ALLOCATION_SECONDS[4] * 1000,
];

function PresentationContent() {
  const searchParams = useSearchParams();
  const sidParam = searchParams.get("sid");
  const sid =
    sidParam && isValidSid(sidParam) ? sidParam : DEFAULT_SID;

  const [stage, setStage] = useState<PresentationStage>("setup");
  const [snapshot, setSnapshot] = useState<PresentationSnapshot | null>(null);

  const [counts, setCounts] = useState<CountsSnapshot>({
    ITEM: 0,
    IMAGE: 0,
    DATA: 0,
    NEAR: 0,
  });
  const [fetchStatus, setFetchStatus] = useState<
    "idle" | "connected" | "reconnecting" | "error"
  >("idle");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const backoffIndexRef = useRef(0);

  const [planBOpen, setPlanBOpen] = useState(false);
  const [manualRank, setManualRank] = useState<(VoteChoice | null)[]>([
    null,
    null,
    null,
    null,
  ]);

  const [currentWorkIndex, setCurrentWorkIndex] = useState(0);
  const [timerStatus, setTimerStatus] = useState<
    "idle" | "running" | "paused" | "ended"
  >("idle");
  const [targetTime, setTargetTime] = useState<number | null>(null);
  const [pausedRemainingMs, setPausedRemainingMs] = useState<number | null>(
    null
  );
  const [displayRemainingMs, setDisplayRemainingMs] = useState<number | null>(
    null
  );
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchState = useCallback(async (): Promise<boolean> => {
    if (!sid || !isValidSid(sid)) return false;
    try {
      const res = await fetch(`/api/state?sid=${encodeURIComponent(sid)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (mountedRef.current) {
        setCounts(
          data.counts ?? { ITEM: 0, IMAGE: 0, DATA: 0, NEAR: 0 }
        );
        setLastUpdated(new Date());
        setFetchStatus("connected");
        backoffIndexRef.current = 0;
      }
      return true;
    } catch {
      if (mountedRef.current) {
        const next = Math.min(
          backoffIndexRef.current + 1,
          BACKOFF_MS.length - 1
        );
        backoffIndexRef.current = next;
        setFetchStatus(next >= BACKOFF_MS.length - 1 ? "error" : "reconnecting");
      }
      return false;
    }
  }, [sid]);

  useEffect(() => {
    mountedRef.current = true;
    const existing = getSnapshotForSid(sid);
    if (existing && existing.currentStage !== "setup" && existing.currentStage !== "intro" && existing.currentStage !== "vote") {
      setSnapshot(existing);
      setStage(existing.currentStage);
      setCurrentWorkIndex(existing.currentWorkIndex);
      setTimerStatus(existing.timerStatus);
      setPausedRemainingMs(existing.pausedRemainingMs);
      if (existing.timerStatus === "running" && existing.pausedRemainingMs != null) {
        setTargetTime(Date.now() + existing.pausedRemainingMs);
      } else {
        setTargetTime(existing.targetTime);
      }
    }
    return () => {
      mountedRef.current = false;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [sid]);

  useEffect(() => {
    if (stage !== "vote" || !sid || !isValidSid(sid)) return;
    let cancelled = false;
    const run = () => {
      if (cancelled || !mountedRef.current) return;
      fetchState().then((ok) => {
        if (cancelled || !mountedRef.current) return;
        const delay = ok ? POLL_INTERVAL_MS : BACKOFF_MS[backoffIndexRef.current];
        pollTimeoutRef.current = setTimeout(run, delay);
      });
    };
    run();
    const onVis = () => {
      if (document.visibilityState === "visible" && mountedRef.current)
        fetchState();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [stage, sid, fetchState]);

  useEffect(() => {
    if (timerStatus !== "running" || targetTime == null) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, targetTime - Date.now());
      setDisplayRemainingMs(remaining);
      if (remaining <= 0 && tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
    tick();
    tickRef.current = setInterval(tick, 200);
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [timerStatus, targetTime]);

  useEffect(() => {
    if (timerStatus !== "running" || targetTime == null) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, targetTime - Date.now());
      const current = getSnapshotForSid(sid);
      if (current) {
        savePresentationSnapshot({ ...current, pausedRemainingMs: remaining });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [timerStatus, targetTime, sid]);

  const persistSnapshot = useCallback(
    (next: Partial<PresentationSnapshot>) => {
      if (!snapshot) return;
      const merged: PresentationSnapshot = {
        ...snapshot,
        ...next,
      };
      setSnapshot(merged);
      savePresentationSnapshot(merged);
    },
    [snapshot]
  );

  const lockResult = useCallback(
    (countsOrManual: CountsSnapshot | RankedChoices, isManual: boolean) => {
      const ranked: RankedChoices = isManual
        ? (countsOrManual as RankedChoices)
        : getRankedChoicesFromCounts(countsOrManual as CountsSnapshot);
      const countsSnapshot: CountsSnapshot = isManual
        ? { ITEM: 0, IMAGE: 0, DATA: 0, NEAR: 0 }
        : (countsOrManual as CountsSnapshot);
      const newSnapshot: PresentationSnapshot = {
        sid,
        lockedAt: new Date().toISOString(),
        countsSnapshot,
        rankedChoices: ranked,
        allocations: ALLOCATIONS_MS,
        currentStage: "locked-result",
        currentWorkIndex: 0,
        timerStatus: "idle",
        targetTime: null,
        pausedRemainingMs: null,
      };
      setSnapshot(newSnapshot);
      savePresentationSnapshot(newSnapshot);
      setStage("locked-result");
      setPlanBOpen(false);
    },
    [sid]
  );

  const startTimer = useCallback(() => {
    if (!snapshot) return;
    const alloc = snapshot.allocations[currentWorkIndex];
    const t = Date.now() + alloc;
    setTargetTime(t);
    setTimerStatus("running");
    setPausedRemainingMs(null);
    persistSnapshot({
      timerStatus: "running",
      targetTime: t,
      pausedRemainingMs: alloc,
    });
  }, [snapshot, currentWorkIndex, persistSnapshot]);

  const pauseTimer = useCallback(() => {
    if (targetTime == null) return;
    const remaining = Math.max(0, targetTime - Date.now());
    setPausedRemainingMs(remaining);
    setTimerStatus("paused");
    setTargetTime(null);
    persistSnapshot({
      timerStatus: "paused",
      targetTime: null,
      pausedRemainingMs: remaining,
    });
  }, [targetTime, persistSnapshot]);

  const resumeTimer = useCallback(() => {
    if (pausedRemainingMs == null) return;
    const t = Date.now() + pausedRemainingMs;
    setTargetTime(t);
    setTimerStatus("running");
    setPausedRemainingMs(null);
    persistSnapshot({
      timerStatus: "running",
      targetTime: t,
      pausedRemainingMs: pausedRemainingMs,
    });
  }, [pausedRemainingMs, persistSnapshot]);

  const goNextWork = useCallback(() => {
    if (!snapshot) return;
    if (currentWorkIndex >= 3) {
      setStage("residency-plan");
      persistSnapshot({ currentStage: "residency-plan" });
      return;
    }
    const next = currentWorkIndex + 1;
    setCurrentWorkIndex(next);
    setTimerStatus("idle");
    setTargetTime(null);
    setPausedRemainingMs(null);
    setDisplayRemainingMs(null);
    persistSnapshot({
      currentWorkIndex: next,
      timerStatus: "idle",
      targetTime: null,
      pausedRemainingMs: null,
    });
  }, [snapshot, currentWorkIndex, persistSnapshot]);

  const restartCurrent = useCallback(() => {
    if (!snapshot) return;
    const alloc = snapshot.allocations[currentWorkIndex];
    const t = Date.now() + alloc;
    setTargetTime(t);
    setTimerStatus("running");
    setPausedRemainingMs(null);
    persistSnapshot({
      timerStatus: "running",
      targetTime: t,
      pausedRemainingMs: alloc,
    });
  }, [snapshot, currentWorkIndex, persistSnapshot]);

  const endCurrent = useCallback(() => {
    setTimerStatus("ended");
    setDisplayRemainingMs(0);
    setTargetTime(null);
    setPausedRemainingMs(0);
    persistSnapshot({
      timerStatus: "ended",
      targetTime: null,
      pausedRemainingMs: 0,
    });
  }, [persistSnapshot]);

  if (!sid || !isValidSid(sid)) {
    return (
      <main style={baseStyle}>
        <h1>세션(sid) 없음</h1>
        <p>URL에 세션 ID가 필요합니다. 예: /presentation?sid=test1</p>
      </main>
    );
  }

  if (stage === "setup") {
    return (
      <main style={{ ...baseStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>발표 준비</h1>
        <p style={{ marginBottom: "0.5rem" }}>세션: {sid}</p>
        <p style={{ marginBottom: "1rem", opacity: 0.8 }}>
          네트워크 확인 후 시작하세요.
        </p>
        <button
          type="button"
          onClick={() => {
            fetchState().then(() => setStage("intro"));
          }}
          style={{
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          시작
        </button>
        <button
          type="button"
          onClick={() => setStage("intro")}
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 1rem",
            fontSize: "0.9rem",
            cursor: "pointer",
            opacity: 0.8,
          }}
        >
          수동 모드 (네트워크 없이 진행)
        </button>
      </main>
    );
  }

  if (stage === "intro") {
    return (
      <main style={baseStyle}>
        <h1 style={{ fontSize: "1.4rem", marginBottom: "1.5rem" }}>
          {INTRO_QUESTION}
        </h1>
        <ul style={{ listStyle: "none", padding: 0, marginBottom: "2rem" }}>
          {VALID_CHOICES.map((c) => (
            <li key={c} style={{ marginBottom: "0.5rem" }}>
              {CHOICE_LABELS[c]}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setStage("vote")}
          style={{ padding: "0.75rem 1.5rem", fontSize: "1rem", cursor: "pointer" }}
        >
          다음 (투표)
        </button>
      </main>
    );
  }

  if (stage === "vote") {
    const total = counts.ITEM + counts.IMAGE + counts.DATA + counts.NEAR;
    const voteUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/v?sid=${encodeURIComponent(sid)}`
        : "";
    return (
      <main style={baseStyle}>
        <h1 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>
          {INTRO_QUESTION}
        </h1>
        <p style={{ marginBottom: "0.5rem", opacity: 0.9 }}>
          {VOTE_STAGE_TIME_RULES}
        </p>
        <div style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
          {fetchStatus === "connected" && "Connected"}
          {fetchStatus === "reconnecting" && "Reconnecting…"}
          {fetchStatus === "error" && "Error"}
          {lastUpdated && (
            <span style={{ marginLeft: "1rem" }}>
              {lastUpdated.toLocaleTimeString("ko-KR", { hour12: false })}
            </span>
          )}
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <img
            src={`/api/presentation/qr?sid=${encodeURIComponent(sid)}`}
            alt="투표 QR"
            style={{ width: 160, height: 160 }}
          />
          <p style={{ fontSize: "0.9rem" }}>{voteUrl || "(투표 URL)"}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", maxWidth: 400, marginBottom: "1.5rem" }}>
          {(VALID_CHOICES as readonly VoteChoice[]).map((c) => (
            <div key={c} style={{ border: "1px solid #333", padding: "0.5rem" }}>
              <span>{CHOICE_LABELS[c]}</span>
              <span style={{ marginLeft: "0.5rem", fontWeight: "bold" }}>
                {counts[c]}
              </span>
            </div>
          ))}
        </div>
        <p style={{ marginBottom: "1rem" }}>총 {total}표</p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => lockResult(counts, false)}
            style={{ padding: "0.75rem 1.5rem", fontSize: "1rem", cursor: "pointer" }}
          >
            결과 확정
          </button>
          <button
            type="button"
            onClick={() => setPlanBOpen((o) => !o)}
            style={{ padding: "0.75rem 1rem", fontSize: "0.95rem", cursor: "pointer" }}
          >
            플랜B 수동 순위 입력
          </button>
        </div>
        {planBOpen && (
          <div style={{ marginTop: "1.5rem", border: "1px solid #444", padding: "1rem", maxWidth: 400 }}>
            <p style={{ marginBottom: "0.75rem" }}>
              1위~4위 선택 (중복 불가, 선택 안 함으로 비우고 다시 선택 가능)
            </p>
            {([0, 1, 2, 3] as const).map((i) => {
              const usedElsewhere = (c: VoteChoice) =>
                manualRank.some((val, j) => j !== i && val === c);
              const options = VALID_CHOICES.filter(
                (c) => c === manualRank[i] || !usedElsewhere(c)
              );
              return (
                <div key={i} style={{ marginBottom: "0.5rem" }}>
                  <label>
                    {i + 1}위:{" "}
                    <select
                      value={manualRank[i] ?? ""}
                      onChange={(e) => {
                        const next = [...manualRank];
                        next[i] = e.target.value === "" ? null : (e.target.value as VoteChoice);
                        setManualRank(next);
                      }}
                      style={{ padding: "0.25rem", minWidth: 120 }}
                    >
                      <option value="">선택 안 함</option>
                      {options.map((c) => (
                        <option key={c} value={c}>
                          {CHOICE_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              );
            })}
            {(() => {
              const filled = manualRank.every((v) => v !== null);
              const distinct = filled && new Set(manualRank).size === 4;
              const canApply = filled && distinct;
              return (
                <button
                  type="button"
                  disabled={!canApply}
                  onClick={() => canApply && lockResult(manualRank as RankedChoices, true)}
                  style={{
                    marginTop: "0.5rem",
                    padding: "0.5rem 1rem",
                    cursor: canApply ? "pointer" : "not-allowed",
                    opacity: canApply ? 1 : 0.6,
                  }}
                >
                  적용 후 결과 확정
                </button>
              );
            })()}
          </div>
        )}
      </main>
    );
  }

  if (stage === "locked-result" && snapshot) {
    return (
      <main style={baseStyle}>
        <h1 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>최종 순위</h1>
        <ul style={{ listStyle: "none", padding: 0, marginBottom: "1.5rem" }}>
          {snapshot.rankedChoices.map((choice, i) => (
            <li key={`${i}-${choice}`} style={{ marginBottom: "0.5rem" }}>
              {i + 1}위: {CHOICE_LABELS[choice]} —{" "}
              {snapshot.allocations[i] / 1000}초
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            setStage("present-existing-works");
            setCurrentWorkIndex(0);
            setTimerStatus("idle");
            setTargetTime(null);
            setPausedRemainingMs(null);
            setDisplayRemainingMs(null);
            persistSnapshot({
              currentStage: "present-existing-works",
              currentWorkIndex: 0,
              timerStatus: "idle",
              targetTime: null,
              pausedRemainingMs: null,
            });
          }}
          style={{ padding: "0.75rem 1.5rem", fontSize: "1rem", cursor: "pointer" }}
        >
          발표 시작
        </button>
      </main>
    );
  }

  if (stage === "present-existing-works" && snapshot) {
    const choice = snapshot.rankedChoices[currentWorkIndex];
    const allocMs = snapshot.allocations[currentWorkIndex];
    const remaining =
      timerStatus === "running" && displayRemainingMs != null
        ? displayRemainingMs
        : timerStatus === "paused" && pausedRemainingMs != null
          ? pausedRemainingMs
          : timerStatus === "ended"
            ? 0
            : allocMs;
    const sec = Math.ceil(remaining / 1000);
    const mm = Math.floor(sec / 60);
    const ss = sec % 60;
    return (
      <main style={baseStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: "0.95rem", opacity: 0.9 }}>
              현재: {currentWorkIndex + 1}위 — {CHOICE_LABELS[choice]}
            </p>
            <h1 style={{ fontSize: "1.5rem" }}>
              {CHOICE_WORK_TITLES[choice]}
            </h1>
          </div>
          <div style={{ fontSize: "2.5rem", fontWeight: "bold" }}>
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </div>
        </div>
        <div style={{ marginBottom: "1rem", minHeight: 200, background: "#222", borderRadius: 8, padding: "1rem" }}>
          <p style={{ opacity: 0.8 }}>콘텐츠 영역 (placeholder)</p>
          <p>{CHOICE_LABELS[choice]} — {CHOICE_WORK_TITLES[choice]}</p>
        </div>
        <div style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
          순위 요약: 1위 {CHOICE_LABELS[snapshot.rankedChoices[0]]} (
          {snapshot.allocations[0] / 1000}초) / 2위{" "}
          {CHOICE_LABELS[snapshot.rankedChoices[1]]} (
          {snapshot.allocations[1] / 1000}초) / 3위{" "}
          {CHOICE_LABELS[snapshot.rankedChoices[2]]} (
          {snapshot.allocations[2] / 1000}초) / 4위{" "}
          {CHOICE_LABELS[snapshot.rankedChoices[3]]} (
          {snapshot.allocations[3] / 1000}초)
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={startTimer}
            disabled={timerStatus === "running"}
            style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
          >
            START
          </button>
          <button
            type="button"
            onClick={pauseTimer}
            disabled={timerStatus !== "running"}
            style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
          >
            PAUSE
          </button>
          <button
            type="button"
            onClick={resumeTimer}
            disabled={timerStatus !== "paused"}
            style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
          >
            RESUME
          </button>
          <button
            type="button"
            onClick={restartCurrent}
            style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
          >
            RESTART CURRENT
          </button>
          <button
            type="button"
            onClick={goNextWork}
            style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
          >
            NEXT
          </button>
          <button
            type="button"
            onClick={endCurrent}
            style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
          >
            END CURRENT
          </button>
        </div>
      </main>
    );
  }

  if (stage === "residency-plan") {
    return (
      <main style={baseStyle}>
        <h1 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>
          올해 레지던시 계획
        </h1>
        <p style={{ marginBottom: "1.5rem", opacity: 0.9 }}>
          (고정 파트 — placeholder)
        </p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => {
              setStage("end");
              if (snapshot)
                persistSnapshot({ currentStage: "end" });
            }}
            style={{ padding: "0.75rem 1.5rem", cursor: "pointer" }}
          >
            END PRESENTATION
          </button>
        </div>
      </main>
    );
  }

  if (stage === "end") {
    return (
      <main style={{ ...baseStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
          발표 종료
        </h1>
        <p style={{ marginBottom: "1rem" }}>Q&A로 전환하세요.</p>
        <button
          type="button"
          onClick={() => {
            clearPresentationSnapshot();
            setStage("setup");
            setSnapshot(null);
            setCurrentWorkIndex(0);
            setTimerStatus("idle");
            setTargetTime(null);
            setPausedRemainingMs(null);
            setDisplayRemainingMs(null);
          }}
          style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
        >
          새 발표 시작
        </button>
      </main>
    );
  }

  return (
    <main style={baseStyle}>
      <p>잘못된 상태입니다. 세션: {sid}</p>
      <button
        type="button"
        onClick={() => setStage("setup")}
        style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
      >
        처음으로
      </button>
    </main>
  );
}

export default function PresentationPage() {
  return (
    <Suspense
      fallback={
        <div style={baseStyle}>
          <p>로딩 중…</p>
        </div>
      }
    >
      <PresentationContent />
    </Suspense>
  );
}
