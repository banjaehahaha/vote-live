# vote-live 동시 부하 테스트

배포된 **Vercel URL**을 대상으로 `/api/vote`에 동시 요청을 보내, 100명/200명이 각 1표씩 넣었을 때 서버·DB가 정상 처리하는지 검증합니다. 로컬이 아니라 **실제 배포 환경**에서 테스트해야 Vercel/DB 한계와 네트워크 지연이 반영됩니다.

---

## k6 설치 (맥)

```bash
brew install k6
```

---

## SID(세션 ID)와 오염 방지

- 각 burst 스크립트는 **기본 SID**를 사용합니다 (burst10, burst30, burst50, burst30x3, burst100, stress200).
- **환경변수 `SID`**가 있으면 그 값을 우선 사용합니다. 예: `SID=burst50b npm run load:burst50`
- **매 테스트마다 새로운 SID를 쓰는 것이 안전합니다.** 이전 테스트 데이터와 섞이지 않고, `/api/state?sid=...`로 해당 run만 검증할 수 있습니다.
- 총합 확인 시 같은 SID를 넘기세요. 예: `node loadtest/check-total.mjs https://... burst50b`

---

## 실행 전 체크

1. **Vercel에 최신 코드 배포**
2. **Preview 또는 Production URL 확인** (예: `https://vote-xxx.vercel.app` 또는 `https://vote.banjaeha.com`)
3. **DATABASE_URL**이 해당 배포 환경(Production/Preview)에 설정되어 있는지 Vercel 대시보드에서 확인

---

## 실행 방법

`BASE_URL`에 실제 배포 URL을 넣고 실행하세요.

```bash
BASE_URL=https://your-deployment.vercel.app npm run load:burst100
```

```bash
BASE_URL=https://your-deployment.vercel.app npm run load:stress200
```

예시 (실제 URL로 교체):

```bash
BASE_URL=https://vote.banjaeha.com npm run load:burst100
BASE_URL=https://vote.banjaeha.com npm run load:stress200
```

---

## 발표 실전에 가까운 burst (30명 / 50명 / 30×3라운드)

소규모 발표(30~50명)에서 “QR 보여주고 동시에 한 번 투표”하는 상황을 재현합니다. 30명·50명 동시 1회는 실전 규모에 가깝고, **burst30x3**은 같은 burst를 3라운드(라운드 사이 약 3초) 반복해 안정성을 확인할 때 씁니다.

**실행 예시:**

```bash
BASE_URL=https://your-deployment.vercel.app npm run load:burst30
```

```bash
BASE_URL=https://your-deployment.vercel.app npm run load:burst50
```

```bash
BASE_URL=https://your-deployment.vercel.app npm run load:burst30x3
```

**결과 확인 URL (브라우저 또는 check-total.mjs):**

- burst30: `https://your-deployment.vercel.app/api/state?sid=burst30`
- burst50: `https://your-deployment.vercel.app/api/state?sid=burst50`
- burst30x3: `https://your-deployment.vercel.app/api/state?sid=burst30x3`

**check-total.mjs로 확인:**

```bash
node loadtest/check-total.mjs https://your-deployment.vercel.app burst30
node loadtest/check-total.mjs https://your-deployment.vercel.app burst50
node loadtest/check-total.mjs https://your-deployment.vercel.app burst30x3
```

**기대 총합:**

- burst30 → **30**
- burst50 → **50**
- burst30x3 → **90**

---

## 결과 확인

- **burst100** 후 총합 100 확인:
  - 브라우저: `https://your-deployment.vercel.app/api/state?sid=burst100`
  - 또는 터미널:
    ```bash
    node loadtest/check-total.mjs https://your-deployment.vercel.app burst100
    ```
  - **총합이 100이면 성공.**

- **stress200** 후 총합 200 확인:
  - `https://your-deployment.vercel.app/api/state?sid=stress200`
  - 또는:
    ```bash
    node loadtest/check-total.mjs https://your-deployment.vercel.app stress200
    ```
  - **총합이 200이면 성공.**

---

## 왜 계속 실패하는가 (50% / 0% 등)

부하 테스트에서 `checks_failed`가 나오거나 `http_req_failed`가 높으면, 대부분 **DB 동시 연결 한도** 때문입니다.

- **원인:** 요청이 동시에 많이 들어오면 Vercel이 **여러 serverless 인스턴스**를 띄웁니다. 인스턴스마다 DB 연결을 열려고 하면, **Vercel Postgres(또는 사용 중인 DB)의 동시 연결 수 한도**를 넘깁니다. 한도 초과 시 `Failed to connect to upstream database` → API가 500을 반환합니다.
- **앱에서 한 일:** 인스턴스당 연결 풀을 `max: 1`로 줄여서, 인스턴스 하나가 최대 1개 연결만 쓰도록 했습니다. 그래도 **인스턴스 개수 × 1**이 DB 한도를 넘으면 여전히 실패합니다.
- **확인할 것:**
  1. **DATABASE_URL이 Pooled 연결인지**  
     Vercel Storage → Postgres에서 **Pooled** / **Connection pool** 용 URL이 있으면 그걸 쓰면 좋습니다. 풀러가 연결을 재사용해서 실제 DB 연결 수를 줄여 줍니다.
  2. **Vercel Postgres 플랜**  
     무료/스타터 플랜은 동시 연결 수가 적을 수 있습니다. 사용량·한도는 Vercel 대시보드에서 확인하세요.
  3. **한 번에 덜 쏘기**  
     burst50, burst100 대신 **burst10**처럼 동시 수를 줄여 보거나, k6에서 `stages`로 서서히 올리면 성공률이 나아질 수 있습니다.

정리하면, **실패 = DB 쪽 동시 연결 한도 초과** 가능성이 크고, Pooled URL 사용 + 플랜 한도 확인 + 동시 요청 수 줄이기로 완화할 수 있습니다.

---

## 실패 시 점검

- k6 결과에 **500 에러**가 있는지 확인
- Vercel **Environment Variables**에서 **Preview** 환경에도 **DATABASE_URL**이 설정되어 있는지 확인 (Production만 있으면 Preview URL로 테스트 시 DB 연결 실패 가능)
- Vercel 배포가 **최신 커밋** 기준인지 확인
- DB(Vercel Postgres 등) **연결 한도** 확인 (위 "왜 계속 실패하는가" 참고)
- **401 응답**이 나오면: Vercel 대시보드 → 프로젝트 → **Settings** → **Deployment Protection**에서 해당 환경 인증을 끄거나, 부하 테스트용으로 Bypass 토큰을 사용하세요. (인증이 켜져 있으면 `/api/vote`, `/api/state`도 401을 반환합니다.)
