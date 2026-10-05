# 종단간 요구 추적 매트릭스 (rtm.md)

> 작성 2026-10-05 · 소유 task-manager(메인 세션 대행). **S1 완료 2026-10-05** — S1 행은 `완료(S1)`. 다중 묶음 요구(S1~S4 등)는 S1 범위만 완료. 요구는 `requirements.md`. 상태: `초안` → `설계` → `구현` → `완료`. 해당 없음은 `-`. 테스트ID는 설계 단계에서 채운다(`SRV-T-*` server · `API-T-*` contract · `TC-RM-*`/`TC-CH-*` 화면).
> 묶음(S1~S5)은 requirements.md §0.

| 요구ID | 묶음 | 요구 요약 | ui(화면·요소) | contract(엔드포인트) | server(모듈·함수) | env 키 | 테스트ID | 상태 |
|---|---|---|---|---|---|---|---|---|
| R-ENV-001 | S1 | 🔒 설정 단일 진입 parseEnv | - | - | env.parseEnv | 전체 | (설계) | 완료(S1) |
| R-ENV-002 | S1 | 🔒 키 목록·기본값·바인딩 | - | - | env.parseEnv 스키마 | 전체 | | 완료(S1) |
| R-ENV-003 | S1 | 설정 오류 → 500 CONFIG_INVALID | chat/rooms: 오류 표시 | 에러 코드 CONFIG_INVALID | env.parseEnv · routes 공통 에러 | - | | 완료(S1) |
| R-DB-001 | S1 | 🔒 D1 스키마 4테이블 | - | - | db.schema · migrations/0001 | DB | | 완료(S1) |
| R-DB-002 | S1 | 마이그레이션 파일 방식 | - | - | migrations/ | DB | | 완료(S1) |
| R-DB-003 | S1 | 바인딩·batch·cascade 삭제 | - | - | db.* · rooms.deleteRoom | DB | | 완료(S1) |
| R-DB-004 | S1 | 인덱스 | - | - | migrations/0001 | DB | | 완료(S1) |
| R-DB-005 | S1 | db 모듈 경계 | - | - | db.* | - | | 완료(S1) |
| R-AUTH-001 | S2 | 🔒 토큰 형식 | - | 토큰 형식(api.md §토큰) | auth.verifyToken | TOKEN_SECRET | | 초안 |
| R-AUTH-002 | S2 | 🔒 서명·exp·level 검증 | chat: 읽기 전용 전환(R-CHAT-011) | TOKEN_INVALID · LEVEL_TOO_LOW | auth.verifyToken | TOKEN_SECRET, TOKEN_MIN_LEVEL | | 초안 |
| R-AUTH-003 | S2 | 🔒 쓰기만 토큰 필수, Bearer 헤더 | ui/api: 헤더 부착 | requireToken 미들웨어 · TOKEN_REQUIRED | auth.requireToken | - | | 초안 |
| R-AUTH-004 | S2 | 작성자 표시 이름 규칙 | chat: 유저 말풍선 이름 | messages 응답 authorName | auth.displayName | - | | 초안 |
| R-AUTH-005 | S2 | 레이트리밋 분당 N | chat: RATE_LIMITED 안내 | RATE_LIMITED(retryAfterSec) | auth.rateLimit · db.rateLimits | RATE_LIMIT_PER_MIN | | 초안 |
| R-AUTH-006 | S2 | 🔒 토큰·SECRET 로그 금지 | - | - | auth · 공통 로거 | - | | 초안 |
| R-ROOM-001 | S1 | 🔒 방 목록 조회 | rooms: RoomList | GET /api/rooms | rooms.listRooms | - | | 완료(S1) |
| R-ROOM-002 | S2 | 🔒 방 생성 | rooms: NewRoomButton·제목 입력 | POST /api/rooms | rooms.createRoom | - | | 초안 |
| R-ROOM-003 | S2 | 🔒 방 이름 변경 | chat: ⋯ 메뉴 이름 변경 | PATCH /api/rooms/:id | rooms.renameRoom | - | | 초안 |
| R-ROOM-004 | S2 | 🔒 방 삭제(cascade) | chat: ⋯ 메뉴 삭제 confirm | DELETE /api/rooms/:id | rooms.deleteRoom | - | | 초안 |
| R-ROOM-005 | S1 | updated_at 갱신 | rooms: 날짜 표시 | 응답 updatedAt | rooms.touch | - | | 완료(S1) |
| R-MSG-001 | S1 | 🔒 히스토리 페이지 | chat: MessageList·상단 로드 | GET /api/rooms/:id/messages | messages.listMessages | - | | 완료(S1) |
| R-MSG-002 | S2 | 🔒 유저 발화/OOC 저장, AI 없음 | chat: 입력창·OOC 토글·전송 | POST /api/rooms/:id/user | messages.addUserMessage | - | | 초안 |
| R-MSG-003 | S3 | 🔒 speak 1턴 생성 | chat: SpeakButton×2 | POST /api/rooms/:id/speak | messages.speak · llm.* | LLM_* , CONTEXT_MESSAGES | | 초안 |
| R-MSG-004 | S2 | 🔒 메시지 수정 | chat: 롱프레스 메뉴 수정 | PATCH /api/messages/:id | messages.editMessage | - | | 초안 |
| R-MSG-005 | S2 | 🔒 메시지 삭제 | chat: 롱프레스 메뉴 삭제 | DELETE /api/messages/:id | messages.deleteMessage | - | | 초안 |
| R-MSG-006 | S3 | 🔒 재작성(마지막 캐릭터 메시지만) | chat: 롱프레스 메뉴 재작성 | POST /api/messages/:id/regenerate · NOT_LAST_MESSAGE · NOT_CHARACTER_MESSAGE | messages.regenerate | LLM_* | | 초안 |
| R-MSG-007 | S3 | 🔒 방당 동시 1건 잠금 | chat: SPEAK_IN_PROGRESS 안내 | SPEAK_IN_PROGRESS | messages.acquireSpeakLock · db.rooms.speaking_until | - | | 초안 |
| R-MSG-008 | S2 | 수정·삭제 권한 = 등급 통과자 | - | - | messages.edit/delete | - | | 초안 |
| R-MEM-001 | S4 | 🔒 장기기억 조회·편집 | chat: MemorySheet | GET/PUT /api/rooms/:id/memory | memory.get · memory.put | - | | 초안 |
| R-MEM-002 | S4 | 🔒 자동 요약(waitUntil) | - | - | memory.summarizeIfNeeded · llm.* | MEMORY_SUMMARY_THRESHOLD, CONTEXT_MESSAGES | | 초안 |
| R-MEM-003 | S4 | 요약 중복 방지·Cron 대체 결정 | - | - | memory.* (설계 결정) | - | | 초안 |
| R-LLM-001 | S3 | 🔒 어댑터 인터페이스·Gemini·Fake | - | - | llm.provider · llm.gemini · llm.fake | LLM_PROVIDER, LLM_API_KEY, LLM_MODEL | | 초안 |
| R-LLM-002 | S3 | 🔒 캐릭터 JSON 파일 | chat: 아바타·이름(응답 speaker→표시) | 응답 speaker 값 | llm.characters · server/characters/*.json | - | | 초안 |
| R-LLM-003 | S3 | 🔒 프롬프트 조립 | - | - | llm.buildPrompt | CONTEXT_MESSAGES | | 초안 |
| R-LLM-004 | S3 | 🔒 후처리·LLM_EMPTY | chat: 오류 안내 | LLM_EMPTY | llm.postprocess | - | | 초안 |
| R-LLM-005 | S3 | 🔒 타임아웃·재시도·LLM_FAILED | chat: 실패 + 재시도 | LLM_FAILED | llm.provider(withRetry) | LLM_TIMEOUT_MS | | 초안 |
| R-LLM-006 | S3 | 프롬프트 주입 완화 | - | - | llm.buildPrompt | - | | 초안 |
| R-API-001 | S1~S4 | 🔒 엔드포인트 집합 고정 | ui/src/api/* | api.md 전체 · shared/endpoints.ts | routes/* | - | | 완료(S1) |
| R-API-002 | S1 | 🔒 에러 형식·코드 단일 소스 | ui/src/api: 에러 파싱 | shared/errors.ts | routes 공통 에러 핸들러 · AppError | - | | 완료(S1) |
| R-API-003 | S2 | 🔒 Bearer 헤더, 토큰 메모리 보관 | ui/src/api/client · ui/src/state/token | api.md §토큰 | auth.requireToken | - | | 초안 |
| R-API-004 | S1 | camelCase·epoch ms·zod 검증 | ui/src/api 타입 | shared/types.ts · VALIDATION_ERROR | routes 스키마 | - | | 완료(S1) |
| R-API-005 | S1 | health | - | GET /api/health | routes/health | - | | 완료(S1) |
| R-API-006 | S1 | 🔒 /embed 정적 + CSP frame-ancestors | main.tsx 진입 | GET /embed | index.ts(ASSETS) · 보안 헤더 미들웨어 | ALLOWED_FRAME_ANCESTORS, ASSETS | | 완료(S1) |
| R-API-007 | S1 | 라우트 얇게 30줄 | - | routes/* | services | - | | 완료(S1) |
| R-API-008 | S1 | 🔒 shared 공유, 경로 중복 0 | ui/src/api | shared/* | routes/* | - | | 완료(S1) |
| R-TOKEN-001 | S5 | 🔒 갠홈 PHP 토큰 조각 | - | doc/handoff/token-snippet.php.md | auth.verifyToken(교차 벡터) | TOKEN_SECRET, TOKEN_MIN_LEVEL | | 초안 |
| R-HANDOFF-001 | S5 | 🔒 임베드 안내 | - | doc/handoff/embed-guide.md | - | ALLOWED_FRAME_ANCESTORS | | 초안 |
| R-HANDOFF-002 | S5 | 🔒 토큰 조각 문서 | - | doc/handoff/token-snippet.php.md | - | - | | 초안 |
| R-HANDOFF-003 | S5 | SECRET 전달 절차 | - | doc/handoff/secret-handover.md | - | TOKEN_SECRET | | 초안 |
| R-ROOMS-001 | S1 | 🔒 방 목록·탭 이동 | rooms: RoomList·RoomItem | GET /api/rooms | rooms.listRooms | - | | 완료(S1) |
| R-ROOMS-002 | S2 | 🔒 새 방(토큰 시만) | rooms: NewRoomButton·TitleDialog | POST /api/rooms | rooms.createRoom | - | | 초안 |
| R-ROOMS-003 | S1 | 로딩·빈·오류 상태 | rooms: 상태 컴포넌트 | - | - | - | | 완료(S1) |
| R-ROOMS-004 | S1 | 마지막 본 방 자동 진입 | rooms/chat: state/lastRoom(localStorage) | - | - | - | | 완료(S1) |
| R-ROOMS-005 | S1 | 🔒 390px·Rosebell | rooms: 스타일 | - | - | - | | 완료(S1) |
| R-CHAT-001 | S1(S2 메뉴) | 🔒 상단 바·⋯ 메뉴 | chat: Header·MoreMenu | PATCH/DELETE rooms · memory | rooms.* | - | | 완료(S1) |
| R-CHAT-002 | S1 | 🔒 말풍선 3종 | chat: Bubble(character/user/ooc) | messages 응답 | - | - | | 완료(S1) |
| R-CHAT-003 | S1 | 🔒 위로 페이지 로드·자동 스크롤 | chat: MessageList·useScrollAnchor | GET messages before | messages.listMessages | - | | 완료(S1) |
| R-CHAT-004 | S2(S3 버튼) | 🔒 하단 바(토큰 시만) | chat: Composer·SpeakButtons | POST user · POST speak | messages.* | - | | 초안 |
| R-CHAT-005 | S3 | 🔒 생성 중 임시 말풍선·잠금·실패 재시도 | chat: PendingBubble·state/chatReducer | POST speak · LLM_FAILED | messages.speak | - | | 초안 |
| R-CHAT-006 | S2 | 🔒 전송 = 저장만 | chat: Composer | POST user | messages.addUserMessage | - | | 초안 |
| R-CHAT-007 | S2(S3 재작성) | 🔒 롱프레스 메뉴 | chat: BubbleMenu(BottomSheet) | PATCH/DELETE message · regenerate | messages.* | - | | 초안 |
| R-CHAT-008 | S1 | 🔒 토큰 없으면 쓰기 UI 미렌더 | chat/rooms: canWrite 분기 | - | - | - | | 완료(S1) |
| R-CHAT-009 | S2 | 🔒 토큰 메모리 보관 | ui/src/state/token | api.md §토큰 | - | - | | 초안 |
| R-CHAT-010 | S1 | localStorage try/catch | ui/src/components/utils/storage | - | - | - | | 완료(S1) |
| R-CHAT-011 | S2 | 오류 코드별 안내·읽기 전용 전환 | chat: errorMessage 맵 | shared/errors.ts | - | - | | 초안 |
| R-CHAT-012 | S4 | 🔒 장기기억 시트 | chat: MemorySheet | GET/PUT memory | memory.* | - | | 초안 |
| R-CHAT-013 | S1 | 🔒 390×565·접근성 | chat: 스타일 | - | - | - | | 완료(S1) |
| R-NFR-001 | S3 | 🔒 speak ≤ 70초 종결 | - | - | llm.provider 타임아웃·재시도 | LLM_TIMEOUT_MS | | 초안 |
| R-NFR-002 | S1 | 히스토리 ≤ 1초 | - | GET messages | messages.listMessages · 인덱스 | - | | 완료(S1) |
| R-NFR-003 | S2·S3 | 🔒 동시 1건·레이트리밋 | - | 409 · 429 | messages.lock · auth.rateLimit | RATE_LIMIT_PER_MIN | | 초안 |
| R-NFR-004 | S1 | 🔒 비밀값 미노출 | ui/dist grep | - | 로거 | - | | 완료(S1) |
| R-NFR-005 | S1 | CPU 10ms 전제 | - | - | 설계 전제 | - | | 완료(S1) |

## 전건 충족 대조표 (Phase 4에서 채움)

| 묶음 | 요구 수 | 완료 | 증거 |
|---|---|---|---|
| S1 | 33 (ENV 3·DB 5·ROOM 2·MSG 1·API 8·ROOMS 4·CHAT 7·NFR 3) | 33 | vitest 240/240(`npx vitest run` 2026-10-05) · typecheck·lint·prettier 0건 · `ui/src/{rooms,chat}/test/result.md`(자동 TC 44 PASS, 수동 TC-CH-028 PASS·TC-RM-015 부분) · `doc/300_검증/screenshots/20261005-2207/`(rooms·chat 390×565, 이전 페이지 로드·뒤로 기록 삭제·CSP·토큰 로그 미출력) · api.md §12 4자 대조표 · server dry-run 빌드 exit 0 |
| S2 | | | |
| S3 | | | |
| S4 | | | |
| S5 | | | |
