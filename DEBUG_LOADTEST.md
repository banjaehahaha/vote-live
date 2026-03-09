# 부하 테스트 디버깅 가이드

burst50 / burst100 실패 원인을 좁히기 위한 실행 방법과 로그 검색 요약.

---

## A. 새 SID로 burst50 실행

이전 테스트 데이터와 섞이지 않게 새 SID를 씁니다.

```bash
BASE_URL=https://your-deployment.vercel.app SID=burst50b npm run load:burst50
```

---

## B. 총합 확인

같은 SID로 `/api/state` 총합을 확인합니다. `totalVotes`와 기대치를 비교하세요.

```bash
node loadtest/check-total.mjs https://your-deployment.vercel.app burst50b
```

(응답에 `totalVotes`가 있으면 그 값이 총합입니다.)

---

## C. Vercel 로그에서 검색할 prefix

- **투표 실패 상세:** `[POST /api/vote][debug]`
- **DB 연결 설정(1회만):** `[db][config]`

---

## D. 성공/실패 기준

- **k6:** 50 중 몇 개가 `status 200`인지 (`checks_succeeded` / `checks_failed`).
- **총합:** `/api/state?sid=burst50b` 의 `totalVotes`(또는 counts 합)가 **50**이면 성공. 50 미만이면 일부 요청이 500 등으로 실패한 것.

---

## E. 다음으로 볼 것

로그에 찍힌 **type**으로 구분합니다.

- **`type=db_connection_error`** → DB 연결 한도 초과, 타임아웃, upstream 연결 실패. Pooled URL·플랜 한도·풀 설정 확인.
- **`type=validation_error`** → sid/choice 형식 문제. 부하와 무관하면 스크립트/요청 body 확인.
- **`type=unknown_error`** → 그 외(예: DB 제약, 디스크 등). `errorMessage`, `stackFirst` 확인.

---

## burst100 새 SID 예시

```bash
BASE_URL=https://your-deployment.vercel.app SID=burst100b npm run load:burst100
node loadtest/check-total.mjs https://your-deployment.vercel.app burst100b
```

기대 총합: **100**.
