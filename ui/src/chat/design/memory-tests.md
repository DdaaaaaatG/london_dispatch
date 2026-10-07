# chat 상세 설계 — S4 장기기억 TC 예정 · 기존 TC 영향 · 인계 (분할 문서, v2.1.1)

> 주 문서: `ui/src/chat/design.md`. 본문 델타: `design/memory.md`(절 표기 `ME`). v2.1.1(2026-10-07)에 40KB 한계 때문에 옛 ME §11(TC 예정 · 기존 TC 영향)·§12(인계)를 이 파일로 옮겼다(`design/auto-tests.md`·`actions-tests.md` 선례). 절 번호 `§11`·`§12`는 그대로 쓴다. 내용 변경 없음.

## 11. TC 예정 (TC-CH-122~139)

공통 준비: `viewer=WRITER_VIEWER`(App 통합 TC는 `initToken('?t=test-token')`), `vi.mock('@/api')`에 `getMemory`·`putMemory`. 대기는 resolve하지 않은 Promise. 질의 이름: 방 메뉴 dialog `방 메뉴` · 항목 button `장기기억` · 시트 dialog `장기기억` · textbox `장기기억 요약` · 버튼 `닫기`·`취소`·`저장`·`다시 시도` · alertdialog `고친 내용을 버릴까요?` · 버튼 `계속 고치기`·`버리기`.

| TC | 제목 | 요구ID | 방식 | 기대 |
|---|---|---|---|---|
| TC-CH-122 | 방 메뉴 항목 순서 | R-CHAT-001 🔒 · 012 | 자동 | ⋯ → `방 메뉴` 안 button 순서 `이름 변경`·`장기기억`·`방 삭제`·`취소`(4개) |
| TC-CH-123 | 열기 · 조회 중 | 012 | 자동 | `장기기억` → 방 메뉴 없음 · dialog `장기기억` · `getMemory(room.id)` 1회 · status `장기기억을 불러오는 중` · `저장` disabled · 포커스 `닫기` |
| TC-CH-124 | 조회 성공 표시 | 012 · R-MEM-001 | 자동 | `{ summary: 'A\nB', sourceUntilId: 21, updatedAt: t }` → textbox 값 `A\nB` · 카운터 `3/4000` · `마지막 갱신` + `<time>` `MM.DD HH:mm`(`dateTime` ISO) · 안내 문구 · textbox 포커스 · `sourceUntilId` 숫자 미표시 · `저장` disabled(변경 없음) |
| TC-CH-125 | 빈 요약 | 012 | 자동 | `{ '', 0, null }` → textbox `''` · placeholder `아직 요약이 없습니다` · 갱신 줄 없음 · `0/4000` |
| TC-CH-126 | 조회 실패 · 재시도 | 012 · 011 | 자동 | `NETWORK` → alert `장기기억을 불러오지 못했습니다` + `서버에 연결할 수 없습니다.` · textbox 없음 · `다시 시도` → `getMemory` 2회 → 성공 → textbox |
| TC-CH-127 | 열 때마다 재조회 | 012 | 자동 | 닫기 → 다시 열기 → `getMemory` 2회 · 두 번째 응답 값 표시 |
| TC-CH-128 | 편집 · 카운터 · 변경 판정 | 012 · R-MEM-001 | 자동 | 입력 → 카운터 갱신 · `'  x  '` = `1/4000` · 이모지 1개 = 1 · 원문에 앞뒤 공백만 추가 → `저장` disabled · 글자 변경 → enabled |
| TC-CH-129 | 4000 / 4001자 | 012 | 자동 | 4000자 → `저장` enabled · 안내 없음 / 4001자 → 카운터 over 클래스 · textbox `aria-invalid=true` · `4000자 이하로 줄여 주세요.` · `저장` disabled · `저장`의 `aria-describedby`가 안내 id |
| TC-CH-130 | 비우기 저장 | 012 · R-MEM-001 | 자동 | 요약 있음 → 전부 지움 → `저장` enabled → `putMemory(room.id, { summary: '' })` 1회 |
| TC-CH-131 | 저장 성공 | 012 | 자동 | 수정 → `저장` → `putMemory(room.id, { summary: 초안 원문 })`(trim 안 함) 1회 · 대기 중 textbox readOnly · `닫기`·`취소`·`저장` disabled · Esc·덮개로 안 닫힘 · `저장` 연타 → 1회 · resolve → dialog 없음 · 토스트 `장기기억을 저장했습니다`(success) · ⋯ 포커스 · 채팅 상태 불변 |
| TC-CH-132 | 저장 실패(시트 안) | 012 · 011 | 자동 | `INTERNAL` → dialog 유지 · 입력 유지 · alert `ERROR_MESSAGES.INTERNAL` · 버튼 활성 · E 토스트 없음 / `RATE_LIMITED`+`retryAfterSec: 12` → `요청이 너무 많습니다. 12초 후 다시 시도해 주세요.` / `VALIDATION_ERROR` → `장기기억은 0~4000자로 입력해 주세요.` / `NETWORK` → `서버에 연결할 수 없습니다.` · 다시 `저장` → alert 사라짐(요청 시작 시 비움) |
| TC-CH-133 | 방 사라짐(404) | 012 · 011 | 자동 | GET `NOT_FOUND` · PUT `NOT_FOUND` 각각 → `ld:lastRoomId` 삭제 · `onBack` 1회 · 토스트 없음 |
| TC-CH-134 | 인증 실패 전환 | 012 · 008 · 011 | 자동(App 통합) | PUT `TOKEN_INVALID` → 같은 흐름에서 dialog 없음 · ⋯·Composer 없음 · `role=note` · 전환 토스트 · ‹ 포커스 · 입력 내용 버림 / GET `LEVEL_TOO_LOW` 같음 |
| TC-CH-135 | 변경 후 닫기 confirm | 012 | 자동 | 수정 → `취소` → alertdialog `고친 내용을 버릴까요?` · 첫 포커스 `계속 고치기` → `계속 고치기` → dialog `장기기억` · 초안 유지 · textbox 포커스 · `getMemory` 1회 그대로 → `닫기`·Esc·덮개도 같은 확인 → `버리기` → 시트 없음 · `putMemory` 0회 · ⋯ 포커스 / 변경 없이 `취소` → 확인 없이 닫힘 |
| TC-CH-136 | 토큰 없음 미렌더 | 008 · 012 · R-NFR-004 | 자동 | `READ_ONLY` → ⋯·`장기기억` button·dialog 없음 · `getMemory`·`putMemory` 0회(TC-CH-003·122와 쌍) |
| TC-CH-137 | 늦은 응답 무시 | 012 | 자동 | 조회 대기 중 `닫기` → 시트 없음 → resolve(성공·실패 각각) → 시트·토스트·`onBack` 변화 없음 |
| TC-CH-138 | 접근성 | 013 · 012 | 자동 | dialog `aria-modal=true` · Tab 순환 `닫기`→textbox→`취소`→`저장`(enabled일 때)→`닫기` · textbox Enter = 줄바꿈(`putMemory` 0회) · 조회 중 status · 저장 실패 alert |
| TC-CH-139 | 390×565 스크린샷(수동) | 013 · 012 | 수동 | 준비됨 · 빈 요약 · 4001자 초과 · 버림 확인 4장 · 시트 높이 ≤ 70% · 가로 스크롤 없음 · 안내·오류 글자 대비 4.5:1 |

### 11.1 기존 TC 영향

| TC | 구분 | 변경 |
|---|---|---|
| TC-CH-047 | **개정** | 방 메뉴 항목 `이름 변경`·`장기기억`·`방 삭제`·`취소`(옛 "`장기기억` 없음(S4)" 삭제). 순서 단언은 TC-CH-122 |
| TC-CH-061 | 개정 | 시트 스크린샷 장면에 장기기억 시트는 TC-CH-139로 |
| TC-CH-003 · 021 · 023 | 유지 명시 | 읽기 전용 판 DOM 불변(⋯ 없음 → 항목 없음). 쌍 단언은 TC-CH-136 |
| TC-CH-015 · 053 | 유지 명시 | `initialChatState`·전이표 불변(ME D-33) |
| TC-CH-048 · 049 · 050 | 유지 | 이름 변경·방 삭제 흐름 불변(항목 위치만 한 칸 밀림 — 질의는 이름으로 한다) |
| useWriteFailure 단위 스펙(있으면) | 유지 | 반환에 `showNotice`가 늘 뿐 `handleWriteFailure` 동작 불변 |

---

## 12. 인계

**ui-implementer** — 새 파일·export:

| 파일 | export | 비고 |
|---|---|---|
| `ui/src/chat/components/MemorySheet.tsx`(신규) | `MemorySheet` · `type MemorySheetProps` | 지역 `MemoryEditor`·`useFocusWhenReady`. ME §1.2·§1.3 |
| `ui/src/chat/useMemorySheet.ts`(신규) | `useMemorySheet` · `type UseMemorySheetResult` | ME §2·§3 F-CH-55~59 |
| `ui/src/state/memory.ts`(신규) | `type MemoryLoad` · `MEMORY_SUMMARY_MAX_CHARS` · `isMemoryOver` · `isMemoryDirty` · `canSaveMemory` | 순수 |
| `RoomMenuSheet.tsx` · `ChatSheets.tsx` · `index.tsx` · `useChatSheets.ts` · `useChatScreen.ts` · `useWriteFailure.ts` · `labels.ts` · `MenuSheets.module.css` | ME §1.4~§1.6 · §3 배선 · §6 | 공용 부품 변경 0 |

**ui-test-designer** — 모킹 `vi.mock('@/api')`(또는 `@/api/memory`)의 `getMemory`·`putMemory`. 질의 이름은 §11 머리. 픽스처: `MemoryResponse` 3종(요약 있음 `updatedAt` 숫자 · 빈 `{ '', 0, null }` · 4001자 입력용 문자열). 토스트 톤 `success`.

---

## 변경이력 (이 분할 문서)

| 버전 | 일자 | 변경 | 근거 |
|---|---|---|---|
| v2.1.1 | 2026-10-07 | 옛 ME §11·§11.1·§12 이전(내용 그대로) | 메인 세션 실측 memory.md 44,268바이트 |
