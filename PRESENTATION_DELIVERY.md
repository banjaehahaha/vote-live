# 발표 모듈 납품 요약

## 1) 새로 추가/수정한 파일 목록

### 새로 추가
- **src/lib/presentation-config.ts**  
  choice별 라벨, 작업 제목, 설명, 시간 배분(180/120/120/60초), tie-breaker 순서, `getRankedChoicesFromCounts()` 헬퍼.
- **src/lib/presentation-storage.ts**  
  lock 스냅샷 타입(`PresentationSnapshot`), `getPresentationSnapshot` / `savePresentationSnapshot` / `clearPresentationSnapshot` / `getSnapshotForSid`.
- **src/app/api/presentation/qr/route.ts**  
  `GET /api/presentation/qr?sid=xxx` — `/v?sid=xxx` URL용 QR 코드 PNG 반환.
- **src/app/presentation/page.tsx**  
  발표 단일 라우트. 내부 state machine으로 setup → intro → vote → locked-result → present-existing-works → residency-plan → end.

### 수정
- **src/app/mobile/page.tsx**  
  `searchParams.sid` 지원. `/mobile?sid=xxx` → `/v?sid=xxx`, sid 없거나 유효하지 않으면 기존처럼 `test1` fallback.

---

## 2) 발표 모듈의 상태 흐름 설명

단일 라우트 `/presentation?sid=...` 안에서 **클라이언트 state**로만 전환되는 7단계:

1. **setup**  
   세션(sid) 표시, 네트워크 확인(시작 버튼 클릭 시 `/api/state` 1회 호출).  
   "시작" → intro. "수동 모드" → 네트워크 없이 intro로 진입.

2. **intro**  
   질문 + 4개 선택지 텍스트만 표시. "다음 (투표)" → vote.

3. **vote**  
   기존 `/api/state?sid=...` 1초 폴링, 실패 시 1/2/4/8초 백오프.  
   질문, 선택지별 득표, 시간 규칙(1위 3분/2위 2분/…), QR(`/api/presentation/qr?sid=...`), 투표 URL 표시.  
   "결과 확정" → 현재 counts로 순위 계산 후 locked-result.  
   "플랜B 수동 순위 입력" 토글 시 1~4위를 직접 선택 후 "적용 후 결과 확정" → locked-result(수동 순위).

4. **locked-result**  
   결과 확정 시점의 스냅샷(rankedChoices, allocations)을 **한 번만** 사용.  
   순위·할당 시간 표시. "발표 시작" → present-existing-works.  
   이 단계부터 스냅샷을 localStorage에 저장하고, 이후에는 서버를 사용하지 않음.

5. **present-existing-works**  
   1~4위 작업을 순서대로 발표.  
   현재 순위/choice/제목, **targetTime 기반** 큰 카운트다운, 전체 순위 요약.  
   START / PAUSE / RESUME / RESTART CURRENT / NEXT / END CURRENT.  
   NEXT로 다음 작업으로 이동, 4번째에서 NEXT → residency-plan.

6. **residency-plan**  
   고정 파트(레지던시 계획). "END PRESENTATION" → end.

7. **end**  
   발표 종료·Q&A 안내. "새 발표 시작" 시 스냅샷 삭제 후 setup으로.

---

## 3) lock 이후 오프라인 진행 방식

- **lock 시점**: "결과 확정"(또는 플랜B "적용 후 결과 확정") 시,  
  `sid`, `lockedAt`, `countsSnapshot`, `rankedChoices`, `allocations`, `currentStage`, `currentWorkIndex`, `timerStatus`, `targetTime`, `pausedRemainingMs` 를 **PresentationSnapshot** 형태로 **localStorage**에 저장.
- **이후 동작**:  
  - locked-result / present-existing-works / residency-plan / end 는 **모두 이 스냅샷만** 사용.  
  - `/api/state`, `/api/vote` 등 서버 호출 없음.  
  - 타이머는 `targetTime = now + remaining` 방식으로만 계산.  
  - running 중에는 1초마다 localStorage에 `pausedRemainingMs`(현재 남은 시간)만 갱신.
- **새로고침 복구**:  
  페이지 로드 시 `getSnapshotForSid(sid)`로 같은 sid의 스냅샷을 읽음.  
  stage가 vote 이전이 아니면, 저장된 `currentStage`, `currentWorkIndex`, `timerStatus`, `pausedRemainingMs` 등으로 복구.  
  `timerStatus === "running"` 이면 `targetTime = Date.now() + pausedRemainingMs` 로 다시 시작해 타이머 정확도 유지.
- **정리**: end에서 "새 발표 시작" 시 `clearPresentationSnapshot()` 호출로 스냅샷 삭제.

---

## 4) 플랜B 수동 입력 모드

- **진입**: vote 단계에서 "플랜B 수동 순위 입력" 버튼으로 패널 열기.
- **동작**: 1위~4위에 대해 각각 드롭다운으로 ITEM / IMAGE / DATA / NEAR 중 하나 선택.  
  "적용 후 결과 확정" 클릭 시, 이 순서를 **rankedChoices**로 사용해 **locked-result**와 동일한 스냅샷 생성 후 저장.
- **이후**: 정상 모드(서버 투표 결과로 확정)와 **완전히 동일**: locked-result → present-existing-works → … → end.  
  입력 방식만 다르고, 순위·시간 배분·타이머·복구 로직은 동일.

---

## 5) 직접 테스트할 체크리스트

- [ ] **vote 단계 정상 투표**  
  `/presentation?sid=test1` → setup → intro → vote.  
  다른 기기/탭에서 `/v?sid=test1`로 투표.  
  발표 화면에서 1초마다 득표 수 갱신되는지 확인.

- [ ] **결과 확정**  
  vote에서 "결과 확정" 클릭 → locked-result에서 순위·시간 표시 확인.  
  "발표 시작" → present-existing-works 진입.

- [ ] **타이머**  
  present-existing-works에서 START → 카운트다운 감소.  
  PAUSE → 정지. RESUME → 이어서 감소.  
  RESTART CURRENT → 현재 작업 시간 처음부터 다시.  
  NEXT → 다음 작업으로 이동(4번째에서 NEXT 시 residency-plan).

- [ ] **NEXT로 다음 작업 이동**  
  1~4위 순서대로 화면·제목·시간이 바뀌는지, 4번째 다음은 residency-plan으로 넘어가는지 확인.

- [ ] **lock 이후 네트워크 끊김**  
  locked-result 또는 present-existing-works에서 네트워크 차단 후에도 발표 진행(타이머, NEXT, residency-plan, end) 가능한지 확인.

- [ ] **lock 이후 새로고침 복구**  
  present-existing-works 또는 타이머 running 중에 브라우저 새로고침.  
  같은 stage·작업 인덱스·타이머 상태로 복구되는지 확인.

- [ ] **플랜B**  
  vote에서 "플랜B 수동 순위 입력" → 1~4위 수동 선택 → "적용 후 결과 확정".  
  locked-result 이후 흐름이 정상 모드와 동일한지 확인.

- [ ] **기존 기능 유지**  
  `/v?sid=test1`, `/r/ITEM?sid=test1`, `/screen?sid=test1`, `/api/vote`, `/api/state`, `/api/admin/reset-votes` 동작이 기존과 동일한지 확인.

- [ ] **/mobile**  
  `/mobile` → `/v?sid=test1`.  
  `/mobile?sid=live1` → `/v?sid=live1` 리다이렉트 확인.
