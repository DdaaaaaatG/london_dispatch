# 종단간 요구 추적 매트릭스 (rtm.md)

> 작성 2026-10-05 · 소유 task-manager(메인 세션 대행). **S1 완료 2026-10-05 · S2 완료 2026-10-06 · S3 완료 2026-10-06 · S3b 완료 2026-10-06 · S3c 완료 2026-10-06** — 행 상태 `완료(S1)`/`완료(S2)`. CR-001(R-CHAT-002 개정)은 S2에서 재검증. 다중 묶음 요구(S1~S4 등)는 S1 범위만 완료. 요구는 `requirements.md`. 상태: `초안` → `설계` → `구현` → `완료`. 해당 없음은 `-`. 테스트ID는 설계 단계에서 채운다(`SRV-T-*` server · `API-T-*` contract · `TC-RM-*`/`TC-CH-*` 화면).
> 묶음(S1~S5)은 requirements.md §0.

| 요구ID | 묶음 | 요구 요약 | ui(화면·요소) | contract(엔드포인트) | server(모듈·함수) | env 키 | 테스트ID | 상태 |
|---|---|---|---|---|---|---|---|---|
| R-ENV-001 | S1 | 🔒 설정 단일 진입 parseEnv | - | - | env.parseEnv | 전체 | (설계) | 완료(S1) |
| R-ENV-002 | S1(S3c +1키) | 🔒 키 목록·기본값·바인딩 | - | - | env.parseEnv 스키마 | 전체 (+OWNER_MB_IDS, S3c) | | 완료(S1) · S3c 완료 |
| R-ENV-003 | S1 | 설정 오류 → 500 CONFIG_INVALID | chat/rooms: 오류 표시 | 에러 코드 CONFIG_INVALID | env.parseEnv · routes 공통 에러 | - | | 완료(S1) |
| R-DB-001 | S1 | 🔒 D1 스키마 4테이블 | - | - | db.schema · migrations/0001 | DB | | 완료(S1) |
| R-DB-002 | S1 | 마이그레이션 파일 방식 | - | - | migrations/ | DB | | 완료(S1) |
| R-DB-003 | S1 | 바인딩·batch·cascade 삭제 | - | - | db.* · rooms.deleteRoom | DB | | 완료(S1) |
| R-DB-004 | S1 | 인덱스 | - | - | migrations/0001 | DB | | 완료(S1) |
| R-DB-005 | S1 | db 모듈 경계 | - | - | db.* | - | | 완료(S1) |
| R-AUTH-001 | S2 | 🔒 토큰 형식 | - | 토큰 형식(api.md §토큰) | auth.verifyToken | TOKEN_SECRET | | 완료(S2) |
| R-AUTH-002 | S2 | 🔒 서명·exp·level 검증 | chat: 읽기 전용 전환(R-CHAT-011) | TOKEN_INVALID · LEVEL_TOO_LOW | auth.verifyToken | TOKEN_SECRET, TOKEN_MIN_LEVEL | | 완료(S2) |
| R-AUTH-003 | S2(S3c 예외) | 🔒 쓰기만 토큰 필수, Bearer 헤더 · 설정 GET 예외(S3c) | ui/api: 헤더 부착 | requireToken 미들웨어 · TOKEN_REQUIRED · E15 토큰 필수 | auth.requireToken · requireOwner | - | | 완료(S2) · S3c 완료 |
| R-AUTH-004 | S2 | 작성자 표시 이름 규칙 | chat: 유저 말풍선 이름 | messages 응답 authorName | auth.displayName | - | | 완료(S2) |
| R-AUTH-005 | S2 | 레이트리밋 분당 N | chat: RATE_LIMITED 안내 | RATE_LIMITED(retryAfterSec) | auth.rateLimit · db.rateLimits | RATE_LIMIT_PER_MIN | | 완료(S2) |
| R-AUTH-006 | S2 | 🔒 토큰·SECRET 로그 금지 | - | - | auth · 공통 로거 | - | | 완료(S2) |
| R-ROOM-001 | S1 | 🔒 방 목록 조회 | rooms: RoomList | GET /api/rooms | rooms.listRooms | - | | 완료(S1) |
| R-ROOM-002 | S2 | 🔒 방 생성 | rooms: NewRoomButton·제목 입력 | POST /api/rooms | rooms.createRoom | - | | 완료(S2) |
| R-ROOM-003 | S2 | 🔒 방 이름 변경 | chat: ⋯ 메뉴 이름 변경 | PATCH /api/rooms/:id | rooms.renameRoom | - | | 완료(S2) |
| R-ROOM-004 | S2 | 🔒 방 삭제(cascade) | chat: ⋯ 메뉴 삭제 confirm | DELETE /api/rooms/:id | rooms.deleteRoom | - | | 완료(S2) |
| R-ROOM-005 | S1 | updated_at 갱신 | rooms: 날짜 표시 | 응답 updatedAt | rooms.touch | - | | 완료(S1) |
| R-MSG-001 | S1 | 🔒 히스토리 페이지 | chat: MessageList·상단 로드 | GET /api/rooms/:id/messages | messages.listMessages | - | | 완료(S1) |
| R-MSG-002 | S2 | 🔒 유저 발화/OOC 저장, AI 없음 | chat: 입력창·OOC 토글·전송 | POST /api/rooms/:id/user | messages.addUserMessage | - | | 완료(S2) |
| R-MSG-003 | S3 | 🔒 speak 1턴 생성 | chat: SpeakButton×2 | POST /api/rooms/:id/speak | messages.speak · llm.* | LLM_* , CONTEXT_MESSAGES | SRV-T-191~199 · API-T-070~077 · TC-CH-066~078 | 완료(S3) |
| R-MSG-004 | S2 | 🔒 메시지 수정 | chat: 롱프레스 메뉴 수정 | PATCH /api/messages/:id | messages.editMessage | - | | 완료(S2) |
| R-MSG-005 | S2 | 🔒 메시지 삭제 | chat: 롱프레스 메뉴 삭제 | DELETE /api/messages/:id | messages.deleteMessage | - | | 완료(S2) |
| R-MSG-006 | S3 | 🔒 재작성(마지막 캐릭터 메시지만) | chat: 롱프레스 메뉴 재작성 | POST /api/messages/:id/regenerate · NOT_LAST_MESSAGE · NOT_CHARACTER_MESSAGE | messages.regenerate | LLM_* | SRV-T-200~209 · API-T-078~084 · TC-CH-079~085 | 완료(S3) |
| R-MSG-007 | S3 | 🔒 방당 동시 1건 잠금 | chat: SPEAK_IN_PROGRESS 안내 | SPEAK_IN_PROGRESS | messages.acquireSpeakLock · db.rooms.speaking_until | - | SRV-T-187~190·199 · API-T-074·077 · TC-CH-073·080·095 | 완료(S3) |
| R-MSG-008 | S2 | 수정·삭제 권한 = 등급 통과자 | - | - | messages.edit/delete | - | | 완료(S2) |
| R-MEM-001 | S4 | 🔒 장기기억 조회·편집 | chat: MemorySheet | GET/PUT /api/rooms/:id/memory | memory.get · memory.put | - | | 초안 |
| R-MEM-002 | S4 | 🔒 자동 요약(waitUntil) | - | - | memory.summarizeIfNeeded · llm.* | MEMORY_SUMMARY_THRESHOLD, CONTEXT_MESSAGES | | 초안 |
| R-MEM-003 | S4 | 요약 중복 방지·Cron 대체 결정 | - | - | memory.* (설계 결정) | - | | 초안 |
| R-LLM-001 | S3 | 🔒 어댑터 인터페이스·Gemini·Fake | - | - | llm.provider · llm.gemini · llm.fake | LLM_PROVIDER, LLM_API_KEY, LLM_MODEL | SRV-T-174~186 (llm-gemini·llm-client) | 완료(S3) |
| R-LLM-002 | S3(S3c 개정) | 🔒 캐릭터 설정 D1 저장, JSON은 시드 | chat: 아바타·이름(응답 speaker→표시) · settings 화면 | 응답 speaker 값 · E15/E16 | llm.characters(시드) · settings.service · db.characterSettings | - | SRV-T-163~173 (characters zod·name 일치) | 완료(S3) · S3c 완료 |
| R-LLM-003 | S3(S3c 개정) | 🔒 프롬프트 조립(S3c: 11필드·빈 섹션 생략) | - | - | llm.buildPrompt · settings.loadForPrompt | CONTEXT_MESSAGES | SRV-T-163~173 (프롬프트 스냅샷) | 완료(S3) · S3c 완료 |
| R-LLM-004 | S3 | 🔒 후처리·LLM_EMPTY | chat: 오류 안내 | LLM_EMPTY | llm.postprocess | - | SRV-T-163~173 (후처리 벡터) · TC-CH-074 | 완료(S3) |
| R-LLM-005 | S3 | 🔒 타임아웃·재시도·LLM_FAILED | chat: 실패 + 재시도 | LLM_FAILED | llm.provider(withRetry) | LLM_TIMEOUT_MS | SRV-T-174~184 (재시도·타임아웃·실패 주입) · TC-CH-073·074 | 완료(S3) |
| R-LLM-006 | S3 | 프롬프트 주입 완화 | - | - | llm.buildPrompt | - | SRV-T-163~173 (구분자 존재) | 완료(S3) |
| R-LLM-007 | S3b | 🔒 월 AI 비용 상한 10만원(추정) | chat: 429 안내 문구(실패 말풍선) | 429 LLM_BUDGET_EXCEEDED(14종째) | llm.usage(누적·판정) · db.llm_usage · migrations/0002 | LLM_MONTHLY_BUDGET_KRW, LLM_PRICE_*_USD_PER_M, KRW_PER_USD | SRV-T-210~233 · API-T-085~090·048 · UI-022/023 · TC-CH-096·097 · TC-RM-029 | 완료(S3b) |
| R-API-001 | S1~S4(S3c +E15·E16) | 🔒 엔드포인트 집합 고정 | ui/src/api/* | api.md 전체 · shared/endpoints.ts | routes/* | - | | 완료(S1) · S3c 완료 |
| R-API-002 | S1(S3b·S3c 개정) | 🔒 에러 형식·코드 단일 소스(15종) | ui/src/api: 에러 파싱 | shared/errors.ts (+OWNER_ONLY) | routes 공통 에러 핸들러 · AppError | - | | 완료(S1) · S3c 완료 |
| R-API-003 | S2 | 🔒 Bearer 헤더, 토큰 메모리 보관 | ui/src/api/client · ui/src/state/token | api.md §토큰 | auth.requireToken | - | | 완료(S2) |
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
| R-ROOMS-002 | S2 | 🔒 새 방(토큰 시만) | rooms: NewRoomButton·TitleDialog | POST /api/rooms | rooms.createRoom | - | | 완료(S2) |
| R-ROOMS-003 | S1 | 로딩·빈·오류 상태 | rooms: 상태 컴포넌트 | - | - | - | | 완료(S1) |
| R-ROOMS-004 | S1 | 마지막 본 방 자동 진입 | rooms/chat: state/lastRoom(localStorage) | - | - | - | | 완료(S1) |
| R-ROOMS-005 | S1 | 🔒 390px·Rosebell | rooms: 스타일 | - | - | - | | 완료(S1) |
| R-CHAT-001 | S1(S2 메뉴) | 🔒 상단 바·⋯ 메뉴 | chat: Header·MoreMenu | PATCH/DELETE rooms · memory | rooms.* | - | | 완료(S1·S2 ⋯) |
| R-CHAT-002 | S1 | 🔒 말풍선 4종(CR-001: 세바스찬 좌·시엘 우·유저 중앙·OOC 중앙) | chat: Bubble(character/user/ooc) | messages 응답 | - | - | | 완료(S1, CR-001 S2 재검증) |
| R-CHAT-003 | S1 | 🔒 위로 페이지 로드·자동 스크롤 | chat: MessageList·useScrollAnchor | GET messages before | messages.listMessages | - | | 완료(S1) |
| R-CHAT-004 | S2(S3 버튼) | 🔒 하단 바(토큰 시만) | chat: Composer·SpeakButtons | POST user · POST speak | messages.* | - | | 완료(S2) |
| R-CHAT-005 | S3 | 🔒 생성 중 임시 말풍선·잠금·실패 재시도 | chat: PendingBubble·state/chatReducer | POST speak · LLM_FAILED | messages.speak | - | TC-CH-068~078·085·087·089·090·092~095 | 완료(S3) |
| R-CHAT-006 | S2 | 🔒 전송 = 저장만 | chat: Composer | POST user | messages.addUserMessage | - | | 완료(S2) |
| R-CHAT-007 | S2(S3 재작성) | 🔒 롱프레스 메뉴 | chat: BubbleMenu(BottomSheet) | PATCH/DELETE message · regenerate | messages.* | - | | 완료(S2) |
| R-CHAT-008 | S1 | 🔒 토큰 없으면 쓰기 UI 미렌더 | chat/rooms: canWrite 분기 | - | - | - | | 완료(S1) |
| R-CHAT-009 | S2 | 🔒 토큰 메모리 보관 | ui/src/state/token | api.md §토큰 | - | - | | 완료(S2) |
| R-CHAT-010 | S1 | localStorage try/catch | ui/src/components/utils/storage | - | - | - | | 완료(S1) |
| R-CHAT-011 | S2 | 오류 코드별 안내·읽기 전용 전환 | chat: errorMessage 맵 | shared/errors.ts | - | - | | 완료(S2) |
| R-CHAT-012 | S4 | 🔒 장기기억 시트 | chat: MemorySheet | GET/PUT memory | memory.* | - | | 초안 |
| R-CHAT-013 | S1 | 🔒 390×565·접근성 | chat: 스타일 | - | - | - | | 완료(S1) |
| R-NFR-001 | S3 | 🔒 speak ≤ 70초 종결 | - | - | llm.provider 타임아웃·재시도 | LLM_TIMEOUT_MS | SRV-T-180~184 (가짜 시계 66초 상한) · TC-CH-070 · MC-CH-18(미실행) | 완료(S3) |
| R-NFR-002 | S1 | 히스토리 ≤ 1초 | - | GET messages | messages.listMessages · 인덱스 | - | | 완료(S1) |
| R-NFR-003 | S2·S3 | 🔒 동시 1건·레이트리밋 | - | 409 · 429 | messages.lock · auth.rateLimit | RATE_LIMIT_PER_MIN | | 완료(S2) |
| R-NFR-004 | S1 | 🔒 비밀값 미노출 | ui/dist grep | - | 로거 | - | | 완료(S1) |
| R-NFR-005 | S1 | CPU 10ms 전제 | - | - | 설계 전제 | - | | 완료(S1) |
| R-SET-001 | S3c | 🔒 주인 = mbId ∈ OWNER_MB_IDS(지인만), 아니면 403 OWNER_ONLY | App isOwner | OWNER_ONLY errors.ts · api.md §3.2 | auth.isOwner · requireOwner | OWNER_MB_IDS | SRV-T-236~238 · API-T-091~103(401/403/200) · TC-RM-033~038 | 완료(S3c) |
| R-SET-002 | S3c | 🔒 설정 본체 world + 2명×11필드, strict·상한 | state/settings.ts 사전 검사 | shared/settings.ts 필드 상수·상한 | settings/schema.ts(zod) | - | API-T-105~107(shared 벡터·문구 13행) · SRV-T-240~243 · TC-ST-005~009 | 완료(S3c) |
| R-SET-003 | S3c | 🔒 D1 character_settings 1행, 시드 대체, version | settings: 하단 줄 version·isDefault | CharacterSettingsResponse | settings/service · db/character-settings · migrations/0003 · generate.ts 주입 | DB | SRV-T-239·244~248·260 · 0003 로컬 적용 · SRV-T-256~258(저장→다음 speak) | 완료(S3c) |
| R-SET-004 | S3c | 🔒 GET /api/settings/characters(토큰·주인) | api/settings.ts getCharacterSettings | E15 · PATHS.characterSettings | routes/settings.ts → settings.get | - | API-T-091~ · API-T-UI-024~027 · api.md §12.4 실물 대조 | 완료(S3c) |
| R-SET-005 | S3c | 🔒 PUT /api/settings/characters(전체 교체·400 첫 위반·429) | api/settings.ts saveCharacterSettings | E16 · PutCharacterSettingsBody | routes/settings.ts → settings.put | RATE_LIMIT_PER_MIN | API-T-09x(400 3종·128KB·429) · TC-ST-013~019 | 완료(S3c) |
| R-SET-006 | S3c | 🔒 프롬프트 조립 확장·defang·outputRules 불변 | - | - | llm/prompt.ts · llm/characters.ts | - | SRV-T-250~255 · SRV-T-163~171 무수정 통과 | 완료(S3c) |
| R-SET-007 | S3c | 🔒 내보내기 화이트리스트, 비밀값 0 | state/settingsFile.ts toExportFile · 내보내기 시트 | api.md 부록 파일 형식 | - | - | TC-ST-016·022·023·029·033·034 · 수동 TC-ST-037·038 대기 | 완료(S3c) |
| R-SET-008 | S3c | 가져오기 자체+E.No.S 부분집합, 초안만 | parseImportFile · 가져오기 시트 | api.md 부록 매핑표 | (PUT 검증이 최종) | - | TC-ST-024~027·029·035·039·041(V-1~6) | 완료(S3c) |
| R-SET-009 | S3c | 🔒 settings 화면(탭 3·저장·되돌리기·내보내기·가져오기) · rooms ⚙ 주인만 렌더 | settings/ 화면 · rooms ⚙ | - | - | - | TC-ST-001~012·020·021·028~031·040 · TC-RM-033·035·036·039 · 캡처 20261006-2033 10장 · 수동 TC-RM-040 대기 | 완료(S3c) |
| R-SET-010 | S3c | 주인 판정 GET 1회 탐침, 읽기 전용 전환 안 함 | App 판정 effect | client AUTH_FAILURE_CODES 불변 | - | - | TC-ST-017·019 · TC-RM-033~038(canWrite 유지) | 완료(S3c) |
| R-SET-011 | S3c | 인증 만료 중 저장 실패 → 초안 보존·내보내기 | settings stale 상태 | - | - | - | TC-ST-016·023·028·032 | 완료(S3c) |
| R-SET-012 | S3c | 로그에 설정 본문 미기록 | - | - | settings·auth 로그 | - | SRV-T-259(로그 본문 0건) | 완료(S3c) |

## 전건 충족 대조표 (Phase 4에서 채움)

| 묶음 | 요구 수 | 완료 | 증거 |
|---|---|---|---|
| S1 | 33 (ENV 3·DB 5·ROOM 2·MSG 1·API 8·ROOMS 4·CHAT 7·NFR 3) | 33 | vitest 240/240(`npx vitest run` 2026-10-05) · typecheck·lint·prettier 0건 · `ui/src/{rooms,chat}/test/result.md`(자동 TC 44 PASS, 수동 TC-CH-028 PASS·TC-RM-015 부분) · `doc/300_검증/screenshots/20261005-2207/`(rooms·chat 390×565, 이전 페이지 로드·뒤로 기록 삭제·CSP·토큰 로그 미출력) · api.md §12 4자 대조표 · server dry-run 빌드 exit 0 |
| S2 | 22 (AUTH 6·TOKEN 1·ROOM 3·MSG 4·API 1·ROOMS 1·CHAT 6(004·006·007·009·011 + 001 ⋯)·NFR 1) | 22 | vitest 488/488(`npx vitest run` 2026-10-06, shared 21·server 152·ui 315) · typecheck·lint·prettier 0건 · `ui/src/{rooms,chat}/test/result.md` S2 절 · `doc/300_검증/screenshots/20261006-0046/`(rooms·chat 쓰기판, CR-001 4종 배치) · API 실물 401/201/204 · api.md §12 S2 4자 대조표 · 교차 벡터 V1~V8 PASS |
| S3 | 13 (MSG 3·LLM 6·CHAT 2(005·007 재작성)·NFR 2) + CHAT-004·011·003 S3분 | 13 | vitest 709/709(`npx vitest run` 2026-10-06, shared 24·server 233·ui 452) · typecheck·lint 0건 · 빌드 dry-run exit 0 · `ui/src/chat/test/result.md` S3 절(자동 29 PASS, 수동 TC-CH-092 부분) · `doc/300_검증/screenshots/20261006-1318/`(7장: 버튼·임시 말풍선·speak 후·실패/재시도·재작성 메뉴·읽기 전용) · 종단 curl(fake): speak 201 · 무토큰 401 · regenerate 200 · api.md §12.2 S3 4자 대조표 |
| S3b | 1 (LLM-007) + API-002 개정(14종)·ENV-002 4키 | 1 | vitest 763/763(`npx vitest run` 2026-10-06, shared 25·server 276·ui 462) · typecheck·lint·build 0 · 마이그레이션 0002 로컬 적용 · 종단: speak 201 → est_krw 강제 100000 → 429 LLM_BUDGET_EXCEEDED + Retry-After → 유저 발화 201 · `ui/src/chat/test/result.md` S3b 절 · api.md §12.3 |
| S3c | 12 (SET-001~012) + 개정 LLM-002·003·API-001·002·AUTH-003·ENV-002 | 12 | vitest(`npx vitest run` 2026-10-06): shared 138 · server 318 · ui 592 · typecheck 3 워크스페이스 0 · lint 0 · 빌드 0(ui vite + server dry-run) · 0003 로컬 적용 · `ui/src/settings/test/result.md`(자동 TC 38 PASS, 수동 3 대기) · `ui/src/rooms/test/result.md` S3c 절(OwnerGate 7) · `doc/300_검증/screenshots/20261006-2033/`(10장) · 종단 curl(fake): 주인 GET 200 · 비주인 403 OWNER_ONLY · 무토큰 401 · api.md §12.4 S3c 4자 대조표 실물 · verify PASS `doc/300_검증/verify-S3c-20261006-2059.md`(C0·H0·M1·L8, vitest 1048/1048) |
| S4 | | | |
| S5 | | | |
