/**
 * sid/choice 검증: 서버·클라이언트 공통.
 * sid는 소문자/숫자/하이픈만 허용해 인젝션·예기치 않은 세션 혼선 방지.
 */

const SID_REGEX = /^[a-z0-9-]{1,32}$/;

export const VALID_CHOICES = ["ITEM", "IMAGE", "DATA", "NEAR"] as const;
export type VoteChoice = (typeof VALID_CHOICES)[number];

export function isValidSid(sid: unknown): sid is string {
  return typeof sid === "string" && SID_REGEX.test(sid);
}

export function isValidChoice(choice: unknown): choice is VoteChoice {
  return typeof choice === "string" && VALID_CHOICES.includes(choice as VoteChoice);
}

export function parseSidFromSearchParams(params: URLSearchParams): string | null {
  const sid = params.get("sid");
  return sid && isValidSid(sid) ? sid : null;
}
