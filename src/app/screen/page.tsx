"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 1000;
const BACKOFF_MS = [1000, 2000, 4000, 8000];
const RELOAD30_MIN_MS = 30 * 60 * 1000;
type Counts = { ITEM: number; IMAGE: number; DATA: number; NEAR: number };
type Status = "connected" | "reconnecting" | "error";

const LABELS: Record<keyof Counts, string> = {
  ITEM: "물건",
  IMAGE: "이미지",
  DATA: "데이터",
  NEAR: "근처에 가기",
};

/**
 * 스크린 집계 페이지. 1초 폴링, 실패 시 exponential backoff로 재시도.
 * 성공 시 1초 폴링으로 복귀. 장시간 켜둬도 리프레시 없이 계속 반영.
 */
const DEFAULT_SID = "test1";

function ScreenContent() {
  const searchParams = useSearchParams();
  const sidParam = searchParams.get("sid");
  const sid = sidParam && /^[a-z0-9-]{1,32}$/.test(sidParam) ? sidParam : DEFAULT_SID;
  const [counts, setCounts] = useState<Counts>({
    ITEM: 0,
    IMAGE: 0,
    DATA: 0,
    NEAR: 0,
  });
  const [status, setStatus] = useState<Status>("connected");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const backoffIndexRef = useRef(0);

  const fetchState = useCallback(async (): Promise<boolean> => {
    if (!sid || !/^[a-z0-9-]{1,32}$/.test(sid)) return false;
    try {
      const res = await fetch(`/api/state?sid=${encodeURIComponent(sid)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (mountedRef.current) {
        setCounts(data.counts ?? { ITEM: 0, IMAGE: 0, DATA: 0, NEAR: 0 });
        setLastUpdated(new Date());
        setStatus("connected");
        backoffIndexRef.current = 0;
      }
      return true;
    } catch {
      if (mountedRef.current) {
        const next = Math.min(backoffIndexRef.current + 1, BACKOFF_MS.length - 1);
        backoffIndexRef.current = next;
        setStatus(next >= BACKOFF_MS.length - 1 ? "error" : "reconnecting");
      }
      return false;
    }
  }, [sid]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // 장시간 스크린 안정성: ?reload30=1 시 30분 후 1회만 새로고침. 기본 OFF. 폴링과 독립.
  const reload30 = searchParams.get("reload30") === "1";
  useEffect(() => {
    if (!reload30) return;
    const t = setTimeout(() => window.location.reload(), RELOAD30_MIN_MS);
    return () => clearTimeout(t);
  }, [reload30]);

  useEffect(() => {
    if (!sid || !/^[a-z0-9-]{1,32}$/.test(sid)) return;

    let cancelled = false;

    const run = () => {
      if (cancelled || !mountedRef.current) return;
      fetchState().then((ok) => {
        if (cancelled || !mountedRef.current) return;
        const delay = ok ? POLL_INTERVAL_MS : BACKOFF_MS[backoffIndexRef.current];
        timeoutRef.current = setTimeout(run, delay);
      });
    };

    run();

    // 백그라운드 탭에서 돌아왔을 때 즉시 한 번 다시 불러오기 (Safari 등에서 탭 전환 후 갱신 안 되는 현상 완화)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && mountedRef.current) fetchState();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [sid, fetchState]);

  const total = counts.ITEM + counts.IMAGE + counts.DATA + counts.NEAR;
  const maxCount = Math.max(1, ...Object.values(counts));

  return (
    <main
      style={{
        padding: "2rem",
        minHeight: "100vh",
        background: "#111",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "1.5rem" }}>
        <img
          src="/vote-qr.png"
          alt="투표 페이지 QR 코드"
          style={{ width: "160px", height: "160px" }}
        />
        <span style={{ marginTop: "0.5rem", fontSize: "0.95rem", opacity: 0.9 }}>
          vote.banjaeha.com/mobile
        </span>
      </div>
      <div style={{ marginBottom: "1.5rem", fontSize: "0.9rem" }}>
        <span>
          {status === "connected" && "Connected"}
          {status === "reconnecting" && "Reconnecting…"}
          {status === "error" && "Error"}
        </span>
        {lastUpdated && (
          <span style={{ marginLeft: "1rem", opacity: 0.8 }}>
            Last updated: {lastUpdated.toLocaleTimeString("ko-KR", { hour12: false })}
          </span>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1.5rem",
          maxWidth: "900px",
        }}
      >
        {(Object.keys(LABELS) as (keyof Counts)[]).map((key) => (
          <div key={key} style={{ border: "1px solid #333", borderRadius: "8px", padding: "1rem" }}>
            <div style={{ fontSize: "1rem", marginBottom: "0.5rem", opacity: 0.9 }}>
              {LABELS[key]}
            </div>
            <div style={{ fontSize: "2.5rem", fontWeight: "bold" }}>{counts[key]}</div>
            <div
              style={{
                height: "8px",
                background: "#333",
                borderRadius: "4px",
                marginTop: "0.5rem",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${maxCount ? (counts[key] / maxCount) * 100 : 0}%`,
                  height: "100%",
                  background: "#4a9",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {total > 0 && (
        <p style={{ marginTop: "1.5rem", fontSize: "1.1rem" }}>총 {total}표</p>
      )}
    </main>
  );
}

export default function ScreenPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem" }}>로딩 중…</div>}>
      <ScreenContent />
    </Suspense>
  );
}
