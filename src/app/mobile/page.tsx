import { redirect } from "next/navigation";
import { isValidSid } from "@/lib/validation";

const DEFAULT_SID = "test-0311";

type Props = { searchParams: Promise<{ sid?: string }> };

/**
 * /mobile → 투표 페이지 단축 URL.
 * /mobile?sid=xxx 이면 /v?sid=xxx, sid 없으면 test1 fallback.
 */
export default async function MobilePage({ searchParams }: Props) {
  const { sid } = await searchParams;
  const validSid = sid && isValidSid(sid) ? sid : DEFAULT_SID;
  redirect(`/v?sid=${encodeURIComponent(validSid)}`);
}
