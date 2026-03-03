# 발표용 투표 시스템 (Vote Live)

Next.js (App Router) + TypeScript 기반. 1회 발표에서 버그/운영 리스크를 최소화하기 위해 **기능 안정성, 복구 가능성, 캐시/라우팅/동시성 방지**를 우선으로 설계했습니다.

- **세션 분리**: 모든 투표는 `sid`(session id)에 귀속. 초기화는 삭제가 아니라 새 sid 사용.
- **캐시 비활성화**: API·fetch 전부 `no-store`. 항상 최신 집계 반영.
- **하드 리다이렉트**: 투표 후 `window.location.assign()`으로 결과 페이지 이동 (SPA 라우팅 오류 방지).
- **폴링 + 백오프**: 스크린은 1초 폴링, 실패 시 1s→2s→4s→8s 지수 백오프 후 재시도, 성공 시 1초 폴링 복귀.

---

## 요구사항

- Node.js 18+
- **PostgreSQL** (로컬 또는 Vercel Postgres). SQLite 미지원.

---

## 로컬 실행 방법

### 1. 저장소 클론 및 의존성 설치

```bash
cd vote-live
npm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
```

`.env`에서 `DATABASE_URL`을 실제 Postgres 연결 문자열로 수정합니다.

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/vote_live"
```

### 3. DB 연결 및 마이그레이션

**Prisma 클라이언트 생성 (스키마 변경 시마다 실행):**

```bash
npm run db:generate
```

**로컬 개발 시 마이그레이션 적용 (최초 1회):**

```bash
npm run db:migrate:dev
```

프롬프트에서 마이그레이션 이름 입력 시 예: `init` 입력. 이 명령으로 `prisma/migrations` 폴더와 초기 SQL이 생성·적용됩니다.

**배포/프로덕션 환경에서 마이그레이션 적용:**

```bash
npm run db:migrate
```

**스키마만 빠르게 DB에 반영 (프로토타입용):**

```bash
npm run db:push
```

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

---

## DB 연결 방법

- **로컬**: Postgres 설치 후 `DATABASE_URL`에 `postgresql://user:password@localhost:5432/DB명` 형식으로 설정.
- **Vercel Postgres**: Vercel 대시보드 → 프로젝트 → Storage → Create Database → Postgres 선택 후 연결. 연결 정보에서 `DATABASE_URL`을 환경 변수로 프로젝트에 추가. 배포 후 `npm run db:migrate` 또는 Vercel 빌드 시 자동 마이그레이션 스크립트 실행.

---

## URL 및 sid 사용법

- **sid 규칙**: 서버 검증 `^[a-z0-9-]{1,32}$` (소문자, 숫자, 하이픈만).

| 용도           | URL 예시                    |
|----------------|-----------------------------|
| 투표(관객)     | `/v?sid=test1`              |
| 결과 카드      | `/r/ITEM?sid=test1`         |
| 스크린 집계    | `/screen?sid=test1`         |

**choice 값**: `ITEM` | `IMAGE` | `DATA` | `NEAR`

예: 같은 세션으로 투표·결과·스크린을 쓰려면 모두 `sid=test1`로 통일.

---

## 테스트 시나리오

1. **스크린 1시간 켜두기**  
   `/screen?sid=live1` 열어두고, 다른 기기에서 `/v?sid=live1`로 투표. 1초마다 폴링되므로 리프레시 없이 카운트가 계속 갱신되는지 확인.

2. **와이파이 끊었다가 복구**  
   스크린 페이지 연 상태에서 네트워크 차단 → "Reconnecting…" 표시 확인 → 네트워크 복구 후 "Connected" 및 "Last updated" 갱신 확인.

3. **다중 투표**  
   폰 여러 대에서 동시에 `/v?sid=test1`로 서로 다른/같은 항목 투표. 스크린에서 모든 표가 누락 없이 반영되는지 확인.

---

## 로컬 동작 확인 체크리스트

- [ ] `npm run db:generate` 성공
- [ ] `.env`에 `DATABASE_URL` 설정 후 `npm run db:migrate:dev` 성공 (또는 `db:push`)
- [ ] `npm run dev` 후 `http://localhost:3000` 접속
- [ ] `/v?sid=test1` 접속 → 4개 버튼 표시, 한 항목 클릭 시 "전송중…" 후 `/r/[choice]?sid=test1`로 이동
- [ ] `/r/ITEM?sid=test1` 등에서 카드 문구·이미지 placeholder·"이제 스크린을 봐주세요." 표시
- [ ] `/screen?sid=test1` 접속 → 4개 카운트·막대·"Connected"·"Last updated" 표시
- [ ] 같은 sid로 여러 번 투표 시 스크린 숫자 증가
- [ ] `sid` 없이 `/v` 또는 `/screen` 접속 시 "세션(sid) 없음" 메시지
- [ ] `npm run build` 성공 (Prisma generate 포함)

---

## 프로젝트 구조 요약

- `src/app/v/page.tsx` — 투표 페이지 (클라이언트)
- `src/app/r/[choice]/page.tsx` — 결과 카드 (서버)
- `src/app/screen/page.tsx` — 스크린 집계 (클라이언트, 폴링)
- `src/app/api/vote/route.ts` — POST 투표
- `src/app/api/state/route.ts` — GET sid별 집계
- `src/lib/validation.ts` — sid/choice 검증
- `src/lib/db.ts` — Prisma 클라이언트 (nodejs, adapter-pg)
- `prisma/schema.prisma` — VoteEvent 테이블

도메인 연결은 별도 설정. 현재는 로컬 및 Vercel 기본 URL로 테스트 가능합니다.
