/**
 * k6: 30명 동시 1회 burst를 3라운드 반복, 라운드 사이 약 3초 대기
 * sid=burst30x3, 총 기대 표 수 90
 * 실행: BASE_URL=https://your-app.vercel.app k6 run loadtest/burst30x3.js
 */
import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL;
if (!BASE_URL) {
  throw new Error("BASE_URL 환경변수를 설정하세요. 예: BASE_URL=https://your-app.vercel.app");
}

const CHOICES = ["ITEM", "IMAGE", "DATA", "NEAR"];
const DEFAULT_SID = "burst30x3";
const SID = __ENV.SID || DEFAULT_SID;

export const options = {
  scenarios: {
    round1: {
      executor: "shared-iterations",
      vus: 30,
      iterations: 30,
      maxDuration: "10s",
      startTime: "0s",
    },
    round2: {
      executor: "shared-iterations",
      vus: 30,
      iterations: 30,
      maxDuration: "10s",
      startTime: "10s",
    },
    round3: {
      executor: "shared-iterations",
      vus: 30,
      iterations: 30,
      maxDuration: "10s",
      startTime: "20s",
    },
  },
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
