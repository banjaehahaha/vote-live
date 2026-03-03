import { notFound } from "next/navigation";
import type { VoteChoice } from "@/lib/validation";

const VALID_CHOICES: VoteChoice[] = ["ITEM", "IMAGE", "DATA", "NEAR"];

const CARD_TEXTS: Record<VoteChoice, { line1: string; line2: string }> = {
  ITEM: {
    line1: "북한 이미지를 담은 물건을 주문했습니다.",
    line2: "부재시 픽션은 문 앞에 놔주세요",
  },
  IMAGE: {
    line1: "북한 집 이미지를 생성했습니다",
    line2: "HOME, SWEET HOME 시리즈",
  },
  DATA: {
    line1: "들어갈 수 없는 땅을 숫자로 계산해봤습니다.",
    line2: "정산없는 시장",
  },
  NEAR: {
    line1: "북한 식당에 들어갔습니다.",
    line2: "뜻밖의 보간과 최근접 이웃찾기",
  },
};

type Props = {
  params: Promise<{ choice: string }>;
  searchParams: Promise<{ sid?: string }>;
};

/**
 * 결과 카드 페이지. choice별 짧은 카드 텍스트 표시.
 * sid는 URL에만 유지(표시만). 나중에 확장 가능.
 */
export default async function ResultCardPage({ params, searchParams }: Props) {
  const { choice } = await params;
  const { sid } = await searchParams;

  if (!VALID_CHOICES.includes(choice as VoteChoice)) {
    notFound();
  }

  const key = choice as VoteChoice;
  const card = CARD_TEXTS[key];

  return (
    <main
      style={{
        padding: "2rem",
        maxWidth: "24rem",
        margin: "0 auto",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: "8px",
          padding: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            width: "100%",
            aspectRatio: "16/9",
            background: "#eee",
            borderRadius: "4px",
            marginBottom: "1rem",
          }}
          aria-hidden
        />
        <p style={{ marginBottom: "0.5rem" }}>{card.line1}</p>
        <p>{card.line2}</p>
      </div>
      <p style={{ fontSize: "0.95rem", color: "#666" }}>
        이제 스크린을 봐주세요.
      </p>
      {sid && (
        <p style={{ fontSize: "0.8rem", color: "#999", marginTop: "1rem" }}>
          세션: {sid}
        </p>
      )}
    </main>
  );
}
