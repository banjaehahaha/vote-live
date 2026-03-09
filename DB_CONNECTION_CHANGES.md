# DB 연결 수정 요약 (burst100 실패 대응)

## 1. 수정한 파일

| 파일 | 변경 내용 |
|------|-----------|
| **prisma.config.ts** | 마이그레이션/CLI용 URL을 `DIRECT_URL` 우선 사용. 없으면 `DATABASE_URL` 사용. |
| **src/lib/db.ts** | `PrismaPg` adapter에 풀 옵션 추가: `max: 3`, `connectionTimeoutMillis: 10_000`, `idleTimeoutMillis: 20_000`. |
| **.env.example** | 신규. `DATABASE_URL`(pooled), `DIRECT_URL`(direct) 설명 추가. |
| **DEPLOY.md** | DATABASE_URL은 pooled 사용, DIRECT_URL 권장, Preview/Production 환경 변수 안내 보강. |

`prisma/schema.prisma`는 Prisma 7 규칙상 `url` 없이 유지. 연결 URL은 `prisma.config.ts`(마이그레이션)와 `db.ts`(런타임)에서만 사용.

---

## 2. 원인 정리

- **증상:** burst100 부하 테스트에서 100개 중 약 50개 실패, Vercel 로그에 `Failed to connect to upstream database`.
- **원인:**  
  - serverless에서 요청마다/인스턴스마다 DB 연결이 늘어나, **동시 연결 수 한도**를 넘김.  
  - 풀 옵션 없이 기본값(max 10 등)으로 쓰면 인스턴스가 많을 때 연결이 폭증.  
  - 마이그레이션과 앱 런타임이 같은 연결 문자열을 쓰면, 풀러(direct/pooled) 구분이 없어 부하 시 불리할 수 있음.

---

## 3. Vercel에서 할 일

1. **Vercel 대시보드** → 해당 프로젝트 → **Settings** → **Environment Variables**
2. **DATABASE_URL**
   - 값: **pooled connection string**  
   - Vercel Postgres면 Storage → 해당 DB → `.env.local` 등에서 **Pooled** URL 사용.  
   - 풀 URL이 없으면 기존에 쓰던 연결 문자열이라도 넣고, 풀 옵션(`db.ts`의 `max: 3` 등)으로 연결 수만 제한해도 도움됨.
3. **DIRECT_URL** (권장)
   - 값: **direct connection string** (마이그레이션용).  
   - Pooled/Direct가 따로 있으면 둘 다 넣기.  
   - 없으면 비워두면 됨(그때는 `prisma.config.ts`가 `DATABASE_URL`을 쓰도록 되어 있음).
4. **Environment**
   - Preview / Production에서 이 앱을 쓸 환경 모두에 위 변수 설정.
5. **재배포**
   - Deployments → 최신 배포 → **Redeploy** 해서 반영.

---

## 4. 수정 후 다시 할 명령어

배포 반영 후 부하 테스트:

```bash
BASE_URL=https://vote.banjaeha.com npm run load:burst100
```

총합 확인:

```bash
node loadtest/check-total.mjs https://vote.banjaeha.com burst100
```

총합이 100이면 성공. 여전히 실패하면 Vercel 로그에서 에러 메시지와 동시 연결 수를 확인하고, 필요 시 `src/lib/db.ts`의 `max`를 2로 더 낮추거나, DB 측 연결 한도/풀러 설정을 점검하면 됩니다.
