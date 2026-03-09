# vote-live 배포 가이드 (vote.banjaeha.com)

## 1. GitHub에 코드 push

### 1-1. GitHub에서 저장소 생성
- https://github.com/new 접속
- Repository name: `vote-live` (또는 원하는 이름)
- Public 선택 후 **Create repository** (README 추가 안 해도 됨)

### 1-2. 로컬에서 원격 추가 후 push
저장소 생성 후 나오는 URL을 사용합니다. **본인 GitHub 사용자명**으로 바꿔서 실행하세요.

```bash
cd /Users/banjaeha/vote-live
git remote add origin https://github.com/본인사용자명/vote-live.git
git push -u origin main
```

(SSH 사용 시: `git@github.com:본인사용자명/vote-live.git`)

---

## 2. Vercel에서 프로젝트 import + 배포

1. https://vercel.com 로그인
2. **Add New** → **Project**
3. **Import** 할 GitHub 저장소 선택 (`vote-live`)
4. **Configure Project**:
   - Framework Preset: Next.js (자동 감지)
   - Build Command: `prisma generate && next build` (또는 비워두고 기본값)
   - Output Directory: 비워두기
5. **Environment Variables** 추가 (반드시 설정):
   - **DATABASE_URL**: 앱 런타임용. **반드시 pooled connection string**을 넣으세요.  
     (Vercel Storage → Postgres → **.env.local** 탭에서 **Pooled** 또는 기본 연결 문자열 복사)
   - **DIRECT_URL** (권장): 마이그레이션/CLI용 direct connection.  
     Vercel에서 Pooled/Direct가 따로 주어지면 둘 다 설정. 없으면 DATABASE_URL만 있어도 동작.
   - **Production / Preview** 둘 다 사용할 경우 해당 환경에 모두 설정해야 합니다.
6. **Deploy** 클릭

배포가 끝나면 `xxx.vercel.app` 주소로 접속 가능합니다.

---

## 3. 커스텀 도메인 추가 (vote.banjaeha.com)

1. Vercel 프로젝트 대시보드 → **Settings** → **Domains**
2. **Add** 입력란에 `vote.banjaeha.com` 입력 후 **Add**
3. Vercel이 안내하는 **DNS 설정 방법** 확인 (아래 4단계에서 사용)

---

## 4. 도메인 관리 페이지에서 DNS 설정

`banjaeha.com`을 관리하는 곳(가비아, Cloudflare, Route53, Vercel DNS 등)에 접속합니다.

**추가할 레코드:**
- **타입**: CNAME
- **이름/호스트**: `vote` (서브도메인만)
- **값/대상**: Vercel이 안내한 값 (예: `cname.vercel-dns.com`)

저장 후 수 분~몇 시간 내 전파됩니다.

---

## 5. 확인

- DNS 전파 후 https://vote.banjaeha.com 접속
- Vercel이 자동으로 SSL(HTTPS) 발급

---

---

## DATABASE_URL이 뭔지, Vercel에서 어디서 어떻게 추가하는지

### DATABASE_URL이란?

- **역할:** 앱이 **PostgreSQL 데이터베이스에 접속할 때 쓰는 연결 주소**입니다.
- **형식:** `postgresql://사용자:비밀번호@호스트:5432/DB이름` 같은 한 줄 문자열입니다.
- **이 프로젝트에서:** 투표 데이터(`vote_events` 테이블)를 저장·조회하는 API(`/api/state`, `/api/vote`)가 이 주소로 DB에 접속합니다.
- **로컬:** `.env` 파일에 넣어 두고, 배포 환경(Vercel)에서는 **환경 변수**로 넣어야 합니다. Vercel 쪽에는 `.env`가 없으므로 **Vercel 대시보드에서 직접 추가**해야 합니다.

---

### 1단계: Vercel에서 Postgres DB 만들기 (이미 있으면 생략)

1. https://vercel.com 로그인 후, **vote-live 프로젝트** 들어가기.
2. 상단 탭에서 **Storage** 클릭.
3. **Create Database** → **Postgres** 선택 → 이름 적고 **Create**.
4. DB가 생성되면 해당 DB 카드를 클릭해서 상세 화면으로 들어갑니다.

---

### 2단계: DATABASE_URL / DIRECT_URL 값 복사하기

1. Storage에서 방금 만든 **Postgres DB** 클릭.
2. 상단 탭 중 **`.env.local`** (또는 **Connect** / **Connection string**) 탭 클릭.
3. **DATABASE_URL**: 앱 런타임용이므로 **pooled connection**이 있으면 그걸 사용하고, 없으면 나오는 연결 문자열을 사용.
   - `POSTGRES_URL` / `DATABASE_URL` / Pooled URL 등 중 하나를 복사.
4. **DIRECT_URL** (선택): 마이그레이션용 direct connection이 따로 있으면 복사해 두고, Vercel 환경 변수에 추가.
5. 예: `postgresql://default:xxxxx@ep-xxx.us-east-1.postgres.vercel-storage.com:5432/vercel?sslmode=require`

**요약:** DATABASE_URL에는 반드시 **pooled** 연결 문자열을 넣어야 serverless 동시 요청 시 "Failed to connect to upstream"을 줄일 수 있습니다. DIRECT_URL은 마이그레이션용으로 두면 좋고, 없으면 DATABASE_URL을 쓰면 됩니다.

---

### DATABASE_URL / DIRECT_URL — 뭘 어떻게 하라는 건지 자세히

#### 1) 이 두 개가 뭔지

- **DATABASE_URL**  
  - **앱이 실제로 DB에 접속할 때 쓰는 주소**입니다.  
  - `/api/vote`, `/api/state` 등이 이 주소로 접속해서 투표를 저장·조회합니다.  
  - **가능하면 “풀(pool) 연결” 주소**를 넣어야 합니다.  
    - 풀 = 여러 요청이 **연결을 나눠 쓰는** 방식이라, 동시에 100명이 들어와도 DB 연결 수를 적게 유지할 수 있습니다.  
    - 풀 주소가 없으면, 지금 쓰는 일반 연결 주소라도 넣고, 코드에서 연결 개수(max)를 낮춰 둔 상태입니다.

- **DIRECT_URL**  
  - **마이그레이션(테이블 생성/수정)할 때만** 쓰는 주소입니다.  
  - `npx prisma migrate deploy` 같은 걸 돌릴 때 사용합니다.  
  - Vercel에서 “Direct” / “Non-pooled” 같은 게 따로 있으면 그걸 쓰고, **없으면 비워두면 됩니다.**  
    - 비워두면 마이그레이션은 DATABASE_URL을 그대로 씁니다.

#### 2) Vercel 화면에서 “어디서” 값을 가져오는지

1. **Vercel 대시보드** → 왼쪽에서 **Storage** 클릭.
2. 사용 중인 **Postgres DB** 카드 클릭해서 들어갑니다.
3. 상단 탭 중 **`.env.local`** 또는 **Connect** / **Connection string** 탭을 엽니다.
4. 그 안에 **여러 개의 연결 문자열**이 보일 수 있습니다. Vercel 화면에 따라 이름이 다릅니다:
   - 예: `DATABASE_URL`, `DATABASE_POSTGRES_URL`, `DATABASE_PRISMA_DATABASE_URL` 등
   - 또는 예: `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING` (구 화면)

   **어떤 걸 쓰면 되는지:**
   - **우리 앱의 DATABASE_URL(환경 변수)**에는 → **풀(Pooled) 연결**이 있으면 그걸 쓰고, 없으면 나오는 것 중 **아무거나 하나**를 복사해서 넣으면 됩니다.  
     (예: `DATABASE_PRISMA_DATABASE_URL` 또는 `DATABASE_URL` 값 전체를 복사.)
   - **지금 화면에 `DATABASE_URL`, `DATABASE_POSTGRES_URL`, `DATABASE_PRISMA_DATABASE_URL` 세 개만 있다면:**  
     그중 **한 개**의 **등호 뒤 연결 문자열 전체**를 복사해서, 프로젝트 **Settings → Environment Variables**에서 Key `DATABASE_URL`인 곳의 Value에 붙여넣으면 됩니다. (보통 `DATABASE_PRISMA_DATABASE_URL` 또는 `DATABASE_URL` 값 쓰면 됨.)
   - **이미 프로젝트 Environment Variables에 `DATABASE_URL`이 들어가 있다면** → **그대로 두면 됩니다.** Storage에서 보이는 연결 문자열 중 하나와 같은 값이면 수정할 필요 없음.
   - **DIRECT_URL**은 Vercel Storage 화면에 "Non-pooling" / "Direct" 같은 게 **따로 있으면** 그걸 복사해서 넣고, **없거나 구분이 없으면** DIRECT_URL 환경 변수는 안 만들어도 됩니다.

#### 3) “어디에” 어떻게 넣는지 (Vercel 환경 변수)

1. **프로젝트 대시보드** (Storage 말고, vote-live 같은 **프로젝트** 화면)로 돌아갑니다.
2. 상단 **Settings** → 왼쪽 **Environment Variables** 클릭.
3. **Add New** (또는 Key/Value 추가)를 누릅니다.
4. **첫 번째 변수**
   - **Key:** `DATABASE_URL` (그대로 입력)
   - **Value:** 위에서 복사한 **Pooled URL** 전체 붙여넣기.  
     (따옴표 없이 `postgresql://...` 만 넣어도 됩니다.)
   - **Environment:**  
     - Production URL로 서비스하면 **Production** 체크.  
     - Preview(배포 전 미리보기) URL도 DB 쓸 거면 **Preview**도 체크.
   - **Save** 클릭.
5. **두 번째 변수 (선택)**
   - **Key:** `DIRECT_URL`
   - **Value:** 위에서 복사한 **Direct URL** 전체.  
     (Direct URL이 없으면 이 변수는 아예 안 만들어도 됩니다.)
   - **Environment:** DATABASE_URL이랑 똑같이 Production/Preview 필요한 것만 체크.
   - **Save** 클릭.

#### 4) 정리

- **DATABASE_URL** = 앱이 매 요청마다 DB 접속할 때 쓰는 주소 → **Pooled URL** 넣기 (없으면 있는 URL 하나 넣기).  
- **DIRECT_URL** = 마이그레이션할 때만 쓰는 주소 → **Direct URL** 있으면 넣고, 없으면 생략.  
- **Production / Preview** 둘 다 쓰는 환경이면, 두 환경 모두에 위 변수들이 들어가 있어야 합니다.  
- 값을 바꾼 뒤에는 **Deployments**에서 **Redeploy** 한 번 해야 반영됩니다.

---

### 3단계: Vercel 프로젝트에 환경 변수로 추가하기

1. **vote-live 프로젝트** 대시보드로 돌아가기 (왼쪽 메뉴 **Project** 등으로).
2. 상단 탭에서 **Settings** 클릭.
3. 왼쪽 메뉴에서 **Environment Variables** 클릭.
4. **Add New** (또는 **Add**) 클릭.
5. 입력:
   - **Key:** `DATABASE_URL` → **Value:** 2단계에서 복사한 **pooled** 연결 문자열
   - (선택) **Key:** `DIRECT_URL` → **Value:** direct 연결 문자열 (마이그레이션용)
   - **Environment:** **Production**과 **Preview** 모두 사용할 경우 둘 다 체크
6. **Save** 클릭.

이제 **배포할 때마다** Vercel이 이 값을 읽어서 DB에 접속합니다.

---

### 4단계: 재배포해서 환경 변수 적용하기

환경 변수는 **새로 배포할 때**만 반영됩니다.

1. 상단 탭에서 **Deployments** 클릭.
2. 맨 위(최신) 배포 오른쪽 **⋯** (세 점) 클릭.
3. **Redeploy** 선택 → **Redeploy** 확인.

재배포가 끝나면 `DATABASE_URL`이 적용된 상태로 동작합니다.

---

### 5단계: 프로덕션 DB에 테이블 만들기 (마이그레이션)

처음 한 번만 하면 됩니다. **vote_events** 테이블이 없으면 API가 500 에러를 냅니다.

1. 2단계에서 복사한 연결 문자열 준비 (DIRECT_URL이 있으면 그걸, 없으면 DATABASE_URL 값 사용).
2. 로컬 터미널에서 프로젝트 폴더로 이동한 뒤:

```bash
cd /Users/banjaeha/vote-live
DIRECT_URL="postgresql://..." npx prisma migrate deploy
# 또는 DIRECT_URL 없이: DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

3. 에러 없이 끝나면 **“Applied 1 migration”** 같은 메시지가 나옵니다.  
   이제 vote.banjaeha.com 스크린/투표가 DB와 연결됩니다.

---

### 정리

| 순서 | 할 일 |
|------|--------|
| 1 | Vercel Storage에서 Postgres 생성 → `.env.local` 탭에서 연결 문자열 복사 |
| 2 | 프로젝트 **Settings** → **Environment Variables**에서 Key `DATABASE_URL`, Value에 붙여넣기 → Save |
| 3 | **Deployments** → 최신 배포 **Redeploy** |
| 4 | 로컬에서 `DATABASE_URL="..." npx prisma migrate deploy` 한 번 실행 |

이후 스키마를 바꾸면 새 마이그레이션을 만든 뒤, 같은 방식으로 `prisma migrate deploy`를 다시 실행하면 됩니다.

---

## 외부에서 투표 초기화 (컴퓨터 없이)

터미널 대신 **어디서든 브라우저나 링크 한 번**으로 초기화하려면:

1. **Vercel 환경 변수 추가**  
   프로젝트 **Settings** → **Environment Variables**에서  
   - Key: `RESET_SECRET`  
   - Value: 본인이 정한 긴 랜덤 문자열 (예: `openssl rand -hex 32` 결과)  
   - Environment: Production 체크 → Save

2. **재배포** 한 번 (환경 변수 반영)

3. **초기화할 때**  
   아무 기기(휴대폰, 다른 PC)에서 브라우저로 아래 주소 접속:
   ```
   https://vote.banjaeha.com/api/admin/reset-votes?token=여기에_RESET_SECRET_값
   ```
   - `token` 값이 `RESET_SECRET`과 일치하면 투표 데이터가 삭제됨.
   - 북마크해 두거나 메모해 두면, Cursor/이 컴퓨터 없이도 언제든 초기화 가능.
