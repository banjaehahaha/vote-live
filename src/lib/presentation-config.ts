/**
 * 발표 모듈 전용 설정.
 * choice별 라벨, 작업 제목, 설명, 시간 배분, tie-breaker 순서.
 * UI 변경 시 이 파일만 수정하면 로직은 유지됨.
 */

import type { VoteChoice } from "@/lib/validation";
import { VALID_CHOICES } from "@/lib/validation";

/** tie-breaker: 동률 시 이 순서로 순위 결정 */
export const TIE_BREAKER_ORDER: VoteChoice[] = ["ITEM", "IMAGE", "DATA", "NEAR"];

/** 순위별 시간(초): 1위 180초, 2위 120초, 3위 120초, 4위 60초 */
export const ALLOCATION_SECONDS: Record<1 | 2 | 3 | 4, number> = {
  1: 180,
  2: 120,
  3: 120,
  4: 60,
};

export const CHOICE_LABELS: Record<VoteChoice, string> = {
  ITEM: "물건",
  IMAGE: "이미지",
  DATA: "데이터",
  NEAR: "근처에 가기",
};

/** choice별 작업 제목 (발표 본편에서 표시) */
export const CHOICE_WORK_TITLES: Record<VoteChoice, string> = {
  ITEM: "허풍선이, 촌뜨기, 익살꾼",
  IMAGE: "MAKE HOME, SWEET HOME",
  DATA: "정산없는 시장",
  NEAR: "뜻밖의 보간과 최근접 이웃 찾기",
};

/** choice별 placeholder 설명 */
export const CHOICE_DESCRIPTIONS: Record<VoteChoice, string> = {
  ITEM: "북한 이미지를 담은 물건을 주문했습니다. 부재시 픽션은 문 앞에 놔주세요.",
  IMAGE: "북한 집 이미지를 생성했습니다. HOME, SWEET HOME 시리즈.",
  DATA: "들어갈 수 없는 땅을 숫자로 계산해봤습니다. 정산없는 시장.",
  NEAR: "북한 식당에 들어갔습니다. 뜻밖의 보간과 최근접 이웃찾기.",
};

/** choice별 미디어 placeholder 개수 (슬라이드/이미지 블록 수) */
export const CHOICE_MEDIA_PLACEHOLDER_COUNT: Record<VoteChoice, number> = {
  ITEM: 3,
  IMAGE: 4,
  DATA: 2,
  NEAR: 2,
};

/** 발표 intro 단계 질문 문구 */
export const INTRO_QUESTION =
  "접근할 수 없는 장소를 이해할 때, 무엇을 가장 신뢰하십니까?";

/** vote 단계에서 발표자가 안내할 시간 규칙 문구 */
export const VOTE_STAGE_TIME_RULES = "1위 3분 / 2위 2분 / 3위 2분 / 4위 1분";

/**
 * counts 기준 내림차순 정렬, 동률은 TIE_BREAKER_ORDER 순서로 결정.
 * 반환: [1위 choice, 2위, 3위, 4위]
 */
export function getRankedChoicesFromCounts(
  counts: Record<VoteChoice, number>
): [VoteChoice, VoteChoice, VoteChoice, VoteChoice] {
  const ordered = [...TIE_BREAKER_ORDER].sort(
    (a, b) => (counts[b] ?? 0) - (counts[a] ?? 0)
  );
  return [ordered[0], ordered[1], ordered[2], ordered[3]];
}

export { VALID_CHOICES };
