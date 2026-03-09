# Vote Live — 전체 시스템 문서 (확장·챗GPT 전달용)

이 문서는 **vote-live** 실시간 투표 시스템의 구조, 데이터 흐름, 기술 스택, 확장 포인트를 세부적으로 정리한 것입니다. ChatGPT 등에 컨텍스트로 전달하거나, 시스템을 확장할 때 참고용으로 사용하세요.

---

## 1. 시스템 개요

### 1.1 목적
- **발표/이벤트용 실시간 투표**: 관객이 모바일로 4지선다 투표 → 대형 스크린에 1초 단위로 집계가 갱신되는 구조.
- **세션(sid) 단위 분리**: 한 이벤트 = 한 `sid`. 여러 발표/세션을 같은 앱으로 운영할 수 있음.
- **안정성·복구 우선**: 캐시 비활성화, 하드 리다이렉트, 폴링+백오프로 버그·운영 리스크 최소화.

### 1.2 사용 시나리오
- **관객**: QR 코드 또는 링크로 `/mobile` 또는 `/v?sid=xxx` 접속 → 4개 선택지 중 하나 클릭 → 결과 카드 페이지로 이동.
- **발표자/운영**: `/screen?sid=xxx`를 프로젝터/대형 화면에 띄워 두고, 1초마다 집계가 갱신되는 것을 확인.
- **초기화**: 다음 세션을 위해 `/api/admin/reset-votes?token=RESET_SECRET` 호출로 전체 투표 데이터 삭제 (선택 사항).

---

## 2. 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 언어 | TypeScript |
| UI | React 19 |
| DB | PostgreSQL (Prisma 7 + `@prisma/adapter-pg`, `pg`) |
| 배포 | Vercel (+ Vercel Postgres 가능) |
| 기타 | QR 코드 생성: `qrcode` (스크립트용) |

- **런타임**: API 라우트는 모두 `runtime = "nodejs"` (Prisma가 Edge 미지원).
- **캐시**: API·클라이언트 fetch 전부 `cache: "no-store"` / `Cache-Control: no-store`로 최신 데이터만 사용.

---

## 3. 프로젝트 구조

```
vote-live/
├── prisma/
│   ├── schema.prisma              # DB 스키마 (VoteEvent, VoteChoice enum)
│   └── migrations/                # 마이그레이션 SQL
├── public/
│   └── vote-qr.png                # QR 코드 이미지 (스크립트로 생성)
├── scripts/
│   └── generate-qr.mjs            # QR 코드 생성 (기본 URL: vote.banjaeha.com)
├── src/
│   ├── app/
│   │   ├── layout.tsx             # 루트 레이아웃 (Geist 폰트, metadata)
│   │   ├── page.tsx               # 홈: 발표 진입점 (sid 하드코딩 "test1", 링크만 제공)
│   │   ├── globals.css
│   │   ├── mobile/
│   │   │   └── page.tsx           # /mobile → /v?sid=test1 리다이렉트 (단축 URL)
│   │   ├── v/
│   │   │   └── page.tsx           # 투표 페이지 (클라이언트, sid 필수)
│   │   ├── r/
│   │   │   └── [choice]/
│   │   │       └── page.tsx       # 투표 결과 카드 (서버, choice별 문구)
│   │   ├── screen/
│   │   │   └── page.tsx           # 스크린 집계 페이지 (클라이언트, 1초 폴링)
│   │   └── api/
│   │       ├── vote/
│   │       │   └── route.ts       # POST /api/vote (투표 저장)
│   │       ├── state/
│   │       │   └── route.ts       # GET /api/state?sid= (집계 조회)
│   │       └── admin/
│   │           └── reset-votes/
│   │               └── route.ts   # GET /api/admin/reset-votes?token= (전체 삭제)
│   └── lib/
│       ├── db.ts                  # Prisma 클라이언트 싱글톤 (adapter-pg)
│       └── validation.ts          # sid/choice 검증 (서버·클라이언트 공용)
├── package.json
├── next.config.ts
├── DEPLOY.md                      # 배포·도메인·DATABASE_URL·RESET_SECRET 가이드
└── README.md                      # 로컬 실행·테스트 시나리오
```

---

## 4. 데이터 모델 (Prisma)

### 4.1 스키마

```prisma
enum VoteChoice {
  ITEM
  IMAGE
  DATA
  NEAR
}

model VoteEvent {
  id        String     @id @default(uuid())
  sid       String     // 세션 ID (예: test1, live1)
  choice    VoteChoice
  createdAt DateTime   @default(now())

  @@index([sid, choice])
  @@map("vote_events")
}
```

- **테이블명**: `vote_events`.
- **인덱스**: `(sid, choice)` — sid별 집계 쿼리 최적화.
- **1인 1표 제한 없음**: 같은 사용자가 여러 번 투표 가능 (추후 확장 시 쿠키/디바이스 ID 등으로 제한 가능).

### 4.2 choice 의미 (현재 이벤트 기준)
- **ITEM**: 물건  
- **IMAGE**: 이미지  
- **DATA**: 데이터  
- **NEAR**: 근처에 가기  

문구는 `src/app/r/[choice]/page.tsx`의 `CARD_TEXTS`와 `src/app/screen/page.tsx`의 `LABELS`에 하드코딩되어 있음.

---

## 5. API 명세

### 5.1 POST /api/vote

- **역할**: 투표 1건 저장.
- **요청**: `Content-Type: application/json`, body `{ sid: string, choice: "ITEM"|"IMAGE"|"DATA"|"NEAR" }`.
- **검증**: `validation.ts`의 `isValidSid`, `isValidChoice` (sid: `^[a-z0-9-]{1,32}$`).
- **동작**: `VoteEvent` 1건 insert. 트랜잭션은 단일 insert로 원자성 보장.
- **응답**: 성공 `200 { ok: true }`, 실패 `400`(검증 실패) / `500`(DB 오류). 모두 `Cache-Control: no-store`.

### 5.2 GET /api/state?sid=

- **역할**: 해당 `sid`의 choice별 투표 수 집계.
- **검증**: `isValidSid(sid)`.
- **동작**: `vote_events`에서 `sid`로 필터 후 `groupBy choice` + `_count`, `updatedAt`은 해당 sid의 최신 `createdAt`.
- **응답**:  
  `200 { sid, counts: { ITEM, IMAGE, DATA, NEAR }, updatedAt }`  
  실패 시 `400` / `500`. `Cache-Control: no-store`.

### 5.3 GET /api/admin/reset-votes?token=

- **역할**: 전체 `vote_events` 삭제 (초기화).
- **인증**: 쿼리 `token`이 환경 변수 `RESET_SECRET`과 일치해야 함.
- **동작**: `DELETE FROM vote_events` (raw SQL).
- **응답**: 성공 `200 { ok, message, deleted }`, 실패 `401`(token 불일치) / `500`(RESET_SECRET 미설정 또는 DB 오류).

---

## 6. 페이지별 동작

### 6.1 홈 `/` (page.tsx)
- **역할**: 발표용 진입점.
- **동작**: `sid = "test1"` 고정. “반재하” → `/v?sid=test1`, “Jaeha Ban” → `/screen?sid=test1` 링크만 제공.
- **확장**: sid를 환경 변수/DB/날짜 기반으로 바꾸거나, 세션 선택 UI 추가 가능.

### 6.2 /mobile (mobile/page.tsx)
- **역할**: 단축 URL. QR 코드에 `https://vote.banjaeha.com/mobile` 등으로 쓰기 위함.
- **동작**: `redirect(/v?sid=test1)`. 기본 sid는 `DEFAULT_SID = "test1"`.

### 6.3 투표 페이지 /v (v/page.tsx)
- **클라이언트 컴포넌트.** `useSearchParams()`로 `sid` 획득.
- **sid 없거나 형식 불일치**: “세션(sid) 없음” 메시지.
- **4개 버튼**: ITEM, IMAGE, DATA, NEAR. 클릭 시 `POST /api/vote` 호출 후 성공 시 `window.location.assign(/r/${choice}?sid=...)` 로 **하드 리다이렉트** (SPA 라우팅/캐시 혼선 방지).
- **에러**: 네트워크/서버 오류 시 메시지 + “다시 시도” 버튼.

### 6.4 결과 카드 /r/[choice] (r/[choice]/page.tsx)
- **서버 컴포넌트.** `choice`는 URL 세그먼트, `sid`는 쿼리.
- **유효 choice**: `ITEM` | `IMAGE` | `DATA` | `NEAR`만 허용, 아니면 `notFound()`.
- **표시**: `CARD_TEXTS[choice]`로 2줄 텍스트 + placeholder 이미지 영역 + “이제 스크린을 봐주세요.” + (선택) sid 표시.
- **확장**: 이미지 URL, 다국어, 세션별 다른 문구 등으로 확장 가능.

### 6.5 스크린 /screen (screen/page.tsx)
- **클라이언트 컴포넌트.** `sid`는 쿼리, 없거나 잘못되면 `DEFAULT_SID = "test1"`.
- **폴링**: 1초마다 `GET /api/state?sid=...` (cache: no-store). 성공 시 1초 유지, 실패 시 1s→2s→4s→8s 지수 백오프 후 재시도, 성공 시 다시 1초로.
- **표시**: 4개 choice별 카운트 + 진행 막대(비율) + “Connected”/“Reconnecting…”/“Error” + Last updated 시각. 상단에 QR 이미지 + vote.banjaeha.com/mobile 문구.
- **옵션**: `?reload30=1` 이면 30분 후 1회만 `location.reload()`. 탭 전환 후 복귀 시 `visibilitychange`로 즉시 1회 재요청.

---

## 7. 공통·인프라

### 7.1 검증 (src/lib/validation.ts)
- **sid**: `^[a-z0-9-]{1,32}$` (소문자, 숫자, 하이픈만). 인젝션·세션 혼선 방지.
- **choice**: `VALID_CHOICES = ["ITEM","IMAGE","DATA","NEAR"]` 포함 여부.
- **타입**: `VoteChoice` export. 서버(API)·클라이언트(페이지) 공용.

### 7.2 DB (src/lib/db.ts)
- **Prisma 7**: `PrismaClient` + `@prisma/adapter-pg` 사용. `DATABASE_URL` 필수.
- **싱글톤**: `globalThis`에 캐시해 개발 시 HMR에서 여러 인스턴스 생성 방지.
- **빌드**: `getPrisma()`는 런타임에만 호출되므로, 빌드 시 `DATABASE_URL` 없어도 컴파일 가능.

### 7.3 환경 변수
- **DATABASE_URL**: PostgreSQL 연결 문자열 (로컬 `.env`, Vercel Environment Variables).
- **RESET_SECRET**: (선택) `/api/admin/reset-votes`의 `token` 값. 없으면 500 반환.

---

## 8. 배포·운영 (요약)

- **배포**: Vercel + GitHub 연동. Build Command에 `prisma generate` 포함 (`npm run build`에 이미 포함).
- **DB**: Vercel Postgres 생성 후 `DATABASE_URL`을 프로젝트 환경 변수로 설정. 최초 1회 `DATABASE_URL="..." npx prisma migrate deploy`로 테이블 생성.
- **도메인**: 예) vote.banjaeha.com. DNS CNAME → Vercel.
- **QR**: `node scripts/generate-qr.mjs [URL]`로 `public/vote-qr.png` 생성. 기본 URL은 vote.banjaeha.com.
- 자세한 단계는 **DEPLOY.md** 참고.

---

## 9. 확장 시 고려 사항 (체크리스트)

- **다중 세션/이벤트**:  
  - 홈에서 sid 선택 또는 관리자 페이지에서 세션 생성.  
  - `reset`을 “전체 삭제”가 아니라 “특정 sid만 삭제”로 바꿀 수 있음.

- **선택지(choice) 변경**:  
  - `prisma/schema.prisma`의 `VoteChoice` enum 수정 → 마이그레이션.  
  - `validation.ts`의 `VALID_CHOICES`, 각 페이지의 `LABELS`/`CARD_TEXTS`/`CHOICES` 동기화.

- **1인 1표**:  
  - 쿠키 또는 디바이스/익명 ID를 저장해 동일 sid+identifier당 1건만 허용하거나, “마지막 1표만 유효”로 처리하는 로직 추가.

- **실시간성**:  
  - 폴링 대신 WebSocket/SSE로 스크린 푸시 가능. DB는 그대로 두고, 투표 시 브로드캐스트만 추가하면 됨.

- **다국어/다중 이벤트 문구**:  
  - choice/이벤트별 텍스트를 DB나 설정 테이블로 옮기고, 스크린·결과 페이지에서 동적 로딩.

- **관리자 UI**:  
  - 세션 생성/삭제, 초기화, 집계 내보내기 등을 `/admin` 페이지로 만들고, `RESET_SECRET` 또는 별도 인증으로 보호.

- **내보내기**:  
  - `GET /api/state` 또는 새 API로 `sid`별 집계/원본 이벤트를 CSV/JSON으로 제공.

---

## 10. 요약 표

| 구분 | 내용 |
|------|------|
| 프레임워크 | Next.js 16 App Router, TypeScript, React 19 |
| DB | PostgreSQL, Prisma 7, adapter-pg |
| 주요 URL | `/` 홈, `/mobile` → /v, `/v?sid=` 투표, `/r/[choice]?sid=` 결과, `/screen?sid=` 스크린 |
| API | POST /api/vote, GET /api/state?sid=, GET /api/admin/reset-votes?token= |
| 세션 | sid: `^[a-z0-9-]{1,32}$` |
| 선택지 | ITEM, IMAGE, DATA, NEAR (enum + validation 일치 유지) |
| 캐시 | 전역 no-store |
| 스크린 갱신 | 1초 폴링 + 실패 시 지수 백오프 |

이 문서를 ChatGPT 등에 붙여 넣고 “위 시스템을 바탕으로 OOO 기능을 추가해줘”처럼 지시하면, 구조를 유지한 채 확장 방향을 맞추기 쉬움.
