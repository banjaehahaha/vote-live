"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import type { VoteChoice } from "@/lib/validation";

const CHOICES: { value: VoteChoice; label: string }[] = [
  { value: "ITEM", label: "물건" },
  { value: "IMAGE", label: "이미지" },
  { value: "DATA", label: "데이터" },
  { value: "NEAR", label: "근처에 가기" },
];

/**
 * 투표 페이지. sid 필수. 성공 시 같은 페이지에 머물며 투표한 항목만 비활성화된 상태로 마무리.
 */
function VoteContent() {
  const searchParams = useSearchParams();
  const sid = searchParams.get("sid");
  const [submitting, setSubmitting] = useState<VoteChoice | null>(null);
  const [votedChoice, setVotedChoice] = useState<VoteChoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVote = useCallback(
    async (choice: VoteChoice) => {
      if (!sid) return;
      setError(null);
      setSubmitting(choice);
      try {
        const res = await fetch("/api/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sid, choice }),
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error ?? `오류 (${res.status})`);
          setSubmitting(null);
          return;
        }
        setVotedChoice(choice);
        setSubmitting(null);
      } catch {
        setError("네트워크 오류입니다. 다시 시도해 주세요.");
        setSubmitting(null);
      }
    },
    [sid]
  );

  if (!sid || !/^[a-z0-9-]{1,32}$/.test(sid)) {
    return (
      <main style={{ padding: "2rem", textAlign: "center" }}>
        <h1>세션(sid) 없음</h1>
        <p>URL에 세션 ID가 필요합니다. 예: /v?sid=test-0311</p>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", maxWidth: "28rem", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1.5rem", fontSize: "1.25rem" }}>
         접근 불가능한 곳을 알기 위해서는 무엇을 보는게 좋을까요?
      </h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {CHOICES.map(({ value, label }) => {
          const isVoted = votedChoice === value;
          const isDisabled = !!votedChoice || !!submitting;
          return (
            <button
              key={value}
              type="button"
              disabled={isDisabled}
              onClick={() => handleVote(value)}
              style={{
                padding: "1rem",
                fontSize: "1rem",
                cursor: isDisabled ? "default" : "pointer",
                opacity: submitting && submitting !== value ? 0.6 : isVoted ? 0.85 : 1,
              }}
              aria-label={isVoted ? `${label} 투표 완료` : `${label} 선택`}
            >
              {submitting === value ? "전송중…" : isVoted ? `${label} · 투표 완료` : label}
            </button>
          );
        })}
      </div>
      {error && (
        <p style={{ marginTop: "1rem", color: "crimson" }}>{error}</p>
      )}
      {error && (
        <button
          type="button"
          onClick={() => setError(null)}
          style={{ marginTop: "0.5rem" }}
        >
          다시 시도
        </button>
      )}
    </main>
  );
}

export default function VotePage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem" }}>로딩 중…</div>}>
      <VoteContent />
    </Suspense>
  );
}
