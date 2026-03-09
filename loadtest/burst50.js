/**
 * k6: 50명 동시 사용자가 각 1회씩 POST /api/vote
 * sid=burst50, choice는 ITEM|IMAGE|DATA|NEAR 랜덤
 * 실행: BASE_URL=https://your-app.vercel.app k6 run loadtest/burst50.js
 */
import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL;
if (!BASE_URL) {
  throw new Error("BASE_URL 환경변수를 설정하세요. 예: BASE_URL=https://your-app.vercel.app");
}

const CHOICES = ["ITEM", "IMAGE", "DATA", "NEAR"];
const DEFAULT_SID = "burst50";
const SID = __ENV.SID || DEFAULT_SID;

export const options = {
  vus: 50,
  iterations: 50,
};

export default function () {
  const choice = CHOICES[Math.floor(Math.random() * CHOICES.length)];
  const url = `${BASE_URL.replace(/\/$/, "")}/api/vote`;
  const payload = JSON.stringify({ sid: SID, choice });
  const res = http.post(url, payload, {
    headers: { "Content-Type": "application/json" },
  });
  check(res, { "status 200": (r) => r.status === 200 });
}
