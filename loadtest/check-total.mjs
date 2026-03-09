#!/usr/bin/env node
/**
 * /api/state?sid=... 의 ITEM+IMAGE+DATA+NEAR 총합 출력
 * 사용: node loadtest/check-total.mjs <BASE_URL> <sid>
 * sid는 부하 테스트에서 쓴 SID와 동일하게 (오염 방지: 새 SID로 테스트했으면 여기서도 그 SID 사용)
 * 예: node loadtest/check-total.mjs https://your-app.vercel.app burst50b
 */
const baseUrl = process.argv[2]?.replace(/\/$/, "");
const sid = process.argv[3];
if (!baseUrl || !sid) {
  console.error("사용법: node loadtest/check-total.mjs <BASE_URL> <sid>");
  console.error("예: node loadtest/check-total.mjs https://your-app.vercel.app burst100");
  process.exit(1);
}

const url = `${baseUrl}/api/state?sid=${encodeURIComponent(sid)}`;
const res = await fetch(url);
if (!res.ok) {
  console.error("HTTP", res.status, await res.text());
  process.exit(1);
}
const data = await res.json();
const counts = data.counts ?? {};
const total =
  (counts.ITEM ?? 0) +
  (counts.IMAGE ?? 0) +
  (counts.DATA ?? 0) +
  (counts.NEAR ?? 0);
console.log("sid:", data.sid ?? sid);
console.log("counts:", counts);
if (data.totalVotes != null) console.log("totalVotes:", data.totalVotes);
console.log("총합:", total);
