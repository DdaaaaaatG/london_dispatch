# API 계약 (api.md)

- 상태: **초안 v0.9** · 최종 갱신 2026-10-08 · 소유 contract-designer
- (v0.9) **S6 상세 확정**(구현 전) = 방 비밀번호 잠금. 신규 E17 `POST /api/rooms/:id/enter`(입장, 토큰 선택, §4.19) · E18 `PUT /api/rooms/:id/password`(잠금 설정·변경, §4.20) · E19 `DELETE /api/rooms/:id/password`(잠금 해제, §4.21) · E4 확장(본문 `password?`, 응답 `CreateRoomResponse` = `RoomSummary & { entryKey }`, §4.6) · `RoomSummary.locked`(E3·E4·E5·E18·E19, §4.2) · 방 입장 증명 규약(헤더 `X-Room-Key` 전용·형식 `e1.`·만료 없음·무효 조건 3·화면 `ld:roomKeys` 보관·관문 적용 표·주인 프리패스, §2.8) · 에러 코드 16·17종째 `ROOM_LOCKED`·`ROOM_PASSWORD_WRONG`(둘 다 403, `isAuthFailure` 제외, §3.2) · 방 단위 입장 시도 상한(`ROOM_ENTER_LIMIT_PER_MIN` 기본 5, §6.2) · §5.10 shared 추가분 · §11.18 · §12.8(틀) · §13.8 · §14.22 · §15.16 · 「ui 인계 메모」 S6 · 「contract-implementer 인계 목록」 S6. 엔드포인트 16 → 19 · 에러 코드 15 → 17 · `PATHS` 11 → 13. 토큰 형식·`?t=`·PHP 조각 불변 → **저쪽 재배포 없음**. 분류는 전부 추가(비파괴)이고 E5~E14의 "잠긴 방이면 403"은 의미 추가(기존 방은 모두 잠기지 않음, R-LOCK-009). 입력: `doc/200_설계/architecture/s6-02-전반설계.md` §1~§5·§7·§8·§10·§12, `s6-03-인계패킷.md` §1.2·§2, 사용자 결정 2026-10-08 저녁(🔒 비밀번호 4~32자 · 방마다 분당 5회 · 주인 프리패스 · 비주인 쓰기 권한자는 증명 보유 방만 E18·E19 · 잠긴 방 목록 날짜 숨김은 화면 몫).
- (v0.8.2) 2026-10-08 저녁 등급 개편(🔒 사용자 결정, 갠홈 등급: 방문자·가입만 1 이하 / 일반 회원 2 / 관리자 10). 글쓰기(토큰 발급) 등급 5 → **10**(갠홈 PHP `RB_CHATBOT_LEVEL` = 서버 `TOKEN_MIN_LEVEL`, 양쪽 10) · 열람 등급 **2**(`RB_CHATBOT_VIEW_LEVEL`, 갠홈 PHP만 앎 — 미만·비로그인은 PHP가 임베드 주소를 비워 iframe을 띄우지 않고 패널 자리표시에 가입 안내). §2.3 검증 6단계 운영값 · §2.6 PHP 분기 · §7 행 · §9. 서버 코드·엔드포인트·타입·에러 코드·토큰 형식·`?t=` 불변. 저쪽은 새 완성 파일 1회 덮어쓰기(조각 + 자리표시 3줄).
- (v0.8.1) 2026-10-08 운영 배포 반영(§7 운영 주소 행 · §8 전달 방식 메모 · §9). 운영 주소 `https://london-dispatch.pora.workers.dev`(임베드 `…/embed`). 갠홈 전달은 완성 `rosebell-chatbot.php` 1개 카톡 덮어쓰기로 바뀌고(1회성 링크 폐기), Cloudflare 접근은 사용자 직접 로그인. 계약 내용(엔드포인트·타입·에러 코드·토큰 형식·PHP 조각 코드) 변경 없음.
- (v0.8) **S3f 상세 확정**(구현 전) = 설정 화면에서 AI 모델(Pro / Flash) 선택. E15·E16 **확장**: 응답 `model: LlmModelKey | null`(지금 실제로 쓰는 모델의 키, 서버 기본 모델이 두 후보 밖이면 `null`, §4.15) · 본문 `model?`(없으면 저장값 유지, `null`·그 밖 값은 `400` `공통 · AI 모델 값이 올바르지 않습니다.`, `settings` 검사 뒤, §4.16) · shared `LlmModelKey`·`LLM_MODEL_KEYS`·`SETTINGS_MODEL_INVALID_MESSAGE`(§5.8.6) · 내보내기 파일 제외(§16.1) · §1.4 · §8 · §10 · §11.17 · §12.7(예정) · §13.7 · §14.21 · §15.15 · 「ui 인계 메모」 S3f · 「contract-implementer 인계 목록」 S3f. 모델명·단가는 계약에 싣지 않는다(server만 안다). 엔드포인트 16개·에러 코드 15종·토큰 형식·PHP 조각 불변이고 분류는 전부 추가(비파괴). 입력: `requirements.md` R-SET-004·005·007·012(2026-10-08 S3f 개정) · R-SET-013 · R-LLM-009(신규), `doc/200_설계/architecture/s3f-02-전반설계.md` §2·§4·§6·§9·§10, `s3f-03-인계패킷.md` §1.2·§2.
- (v0.7.2) S5 handoff 4문서 작성·보정(§8 · §9). 계약 내용 변경 없음.
- (v0.7.1) R-MEM-001 🔒 개정(2026-10-07 사용자 지정) 반영: E14 PUT에서 trim 결과가 빈 요약(`''`)이면 서버가 `sourceUntilId`를 0으로 되돌린다(요약 삭제 = 처음부터 재요약). 비어 있지 않은 편집은 기존대로 유지. §4.18 의미·성공·부수 효과·예시·경합, §4.17 설명 1구절, §5.9.1 주석, §10, §11.16 래퍼 주석, §14.19 API-T-125, §15.14(server 변경 요구 1건·확인 필요 3 해소), 「ui 인계 메모」 S4, 인계 목록 S4. §4.13 영향 없음. 엔드포인트·타입 모양·에러 코드 불변.
- (v0.7) **S4 상세 확정**(구현 전) = 장기기억 보기·편집. `GET /api/rooms/:id/memory`(E13, §4.17) · `PUT /api/rooms/:id/memory`(E14, §4.18). 두 행은 v0.1부터 §4.0 표에 있었으므로 엔드포인트 수는 16개 그대로다. 타입 2개(`MemoryResponse`·`PutMemoryBody`)·경로 1개(`PATHS.roomMemory`, §5.9) · E9 부수 효과 1줄(응답 뒤 자동 요약, §4.12·§4.13) · §6.1 S4 카운트(GET 미카운트·PUT 1회) · 본문 상한 32KiB(§4.18) · §11.16 · §12.6(예정) · §13.6 · §14.19·§14.20 · §15.14 · 「ui 인계 메모」 S4 · 「contract-implementer 인계 목록」 S4. 에러 코드·env·마이그레이션·토큰 형식·handoff 불변. §4.15·§4.16은 S3c E15·E16이 쓰고 있어 절 번호를 바꾸지 않고 §4.17·§4.18에 둔다. 입력: `requirements.md` R-MEM-001~003 · R-CHAT-012 · R-NFR-003, `doc/200_설계/server/memory.md`(2026-10-07 S4 초안) 「contract 인계 요구 명세」·「ui 인계 메모」·§4.4·§11, `db.md` §13, `messages.md` §13, `index.md` §13, `ui/src/chat/design.md` §14.
- (v0.6) **S3d 상세 확정**(구현 전) = 고정 명칭 「어떠한 의지」 + 전송 시 자동 응답. 새 엔드포인트·에러 코드 0. E9 speak 본문 `character`에 `'auto'` 추가(`SpeakTarget`, §4.13·§5.2) · 유저 메시지 응답 `authorName` = `USER_DISPLAY_NAME`(서버 투영, §2.3·§4.3·§4.9·§4.10·§5.5) · 생성 공통 AI 호출 수·시간 내역(§4.12) · §6.1 S3d 카운트 · §11.15 · §12.5 · §13.5 · §14.17·§14.18 · §15.13 · 「ui 인계 메모」 S3d · 「contract-implementer 인계 목록」 S3d. handoff 불변. 입력: `requirements.md` R-MSG-003·009 · R-AUTH-004 · R-CHAT-002·006·014 · R-LLM-003·008 · R-NFR-001(2026-10-06 S3d 개정), `doc/200_설계/architecture/s3d-02-전반설계.md` §1·§2·§4·§5, `s3d-03-인계패킷.md` §0·§1·§2.
- (v0.6 복구) S3c 커밋(0be2f4c)의 §12.4 교체 스크립트가 §13~§16·「ui 인계 메모」·「contract-implementer 인계 목록」을 잘라 냈다. S3·S3b분은 git `11125c2` 원문으로, S3c분(§13.4 · §14.14~§14.16 · §15.12 · §16 · 인계 메모·목록 S3c)은 메인 세션이 s3c-contract-designer 편집 기록으로 재조립한 원문(`.claude/reports/api-v05-recovered-tail.md`)으로 되살렸다. 배치는 절 번호·묶음 순(S3·S3b → S3c → S3d)이다.
- (v0.5) **S3c 상세 확정**(구현 전) = 캐릭터 설정(갠홈 주인 전용) — 설정 엔드포인트 예외·주인 판정 규약(§2.7) · 에러 코드 15종째 `OWNER_ONLY` 403(§3.2) · `GET /api/settings/characters`(E15, §4.15) · `PUT /api/settings/characters`(E16, §4.16) · 설정 타입 4종·`shared/src/settings.ts` 전문(§5.8) · 내보내기 파일 형식·가져오기 매핑(§16). 엔드포인트 14 → 16개. 토큰 형식·handoff 불변. 입력: `requirements.md` §11-1 R-SET-001~012 · R-API-001·002 · R-AUTH-003(2026-10-06 개정), `doc/200_설계/architecture/s3c-02-전반설계.md` §2.1·§4·§6, `s3c-03-인계패킷.md` §0·§1.3·§2.
- 묶음: **S1 상세 확정**(구현 완료) = `GET /api/health` · `GET /api/rooms` · `GET /api/rooms/:id/messages` · `GET /embed`. **S2 상세 확정**(구현 전) = 토큰 규약(§2) · `POST /api/rooms` · `PATCH`·`DELETE /api/rooms/:id` · `POST /api/rooms/:id/user` · `PATCH`·`DELETE /api/messages/:id` · 쓰기 레이트리밋(§6). **S3 상세 확정**(구현 전, v0.4) = 생성 공통 규칙(§4.12) · `POST /api/rooms/:id/speak`(E9, §4.13) · `POST /api/messages/:id/regenerate`(E12, §4.14). **S3b 상세 확정**(구현 전, v0.4.1) = 월 AI 비용 상한(R-LLM-007 🔒) — 에러 코드 14종째 `LLM_BUDGET_EXCEEDED`(§3.2) · 429 두 종류 구분(§3.4) · E9·E12 판정 순서(§4.12~§4.14) · 레이트리밋 카운트(§6.1). 엔드포인트·타입·경로 추가 없음. 나머지(S4 memory)는 §4.0 표에 행만 두고 S4에서 상세를 정한다 — (v0.7) §4.17·§4.18에서 확정했다.
- 이 문서가 단일 소스다: **api.md → `shared/src/*` → `server/src/routes/*` → `ui/src/api/*` → `doc/handoff/*`(S5)**. 넷이 어긋나면 contract 결함이다(확정사항 §3).
- 입력: `doc/000_프로젝트_확정사항.md` §1·§2·§3·§5.2~§5.4·§6, `doc/100_요구조건/requirements.md` §3·§4·§5·§7(R-LLM-002)·§8·§9, `doc/200_설계/server/{index,env,db,rooms,messages}.md`, `doc/200_설계/architecture/ui-layout-01-rooms-chat.md`. (v0.4) `doc/200_설계/server/llm.md` 「contract 인계 요구 명세」·§2.3·§2.6·§4.2·§5, `messages.md` §2.3·§4.2·§4.3·§5·§9, `db.md` §2.3, `ui/src/chat/design.md` §8.3·§14. (v0.4.1) `requirements.md` R-LLM-007·R-API-002(2026-10-06 개정), `llm.md` §11 D-LLM-16~23·§12·「contract 인계」 S3b 절, `messages.md` §4.2·§5, `index.md` §2.4·§5.1·§5.2.
- 절 구성: §1~§10은 contract-design-strategy §13 고정 절이다(번호 변경 금지). §11~§15는 구현 설계 부록이다.

---

## 1. 개요·위상

계약은 식당 메뉴판이다. 손님(화면)은 메뉴판에 적힌 이름으로만 주문하고, 주방(server)은 메뉴판에 적힌 모양으로만 음식을 내놓는다. 메뉴판 사본(`shared/`)이 주방과 홀에 똑같이 걸려 있어서 한쪽만 바뀌면 컴파일러가 바로 알려 준다.

```
ui (React, iframe /embed)  ──▶  contract  ──▶  server (Workers + Hono + D1)
   ui/src/api/* 래퍼만 호출          │             c.get('services') 의 서비스 함수
                                     │
            api.md · shared/src/{types,errors,endpoints,characters}.ts
            server/src/routes/* · ui/src/api/* · doc/handoff/*(S5)
                                     ↑
                    갠홈 PHP(저쪽) — 토큰 발급·임베드 주소 (S2·S5)
```

### 1.1 소유 파일

| 당사자 | 파일 | S1 내용 | S2 추가(v0.3) |
|---|---|---|---|
| 문서(정본) | `doc/200_설계/contract/api.md` | 이 문서 | §2 토큰 · §4.5~§4.11 · §6 |
| 공용 타입 | `shared/src/types.ts` | `CharacterId` · `Speaker` · `MessageKind` · `RoomSummary` · `Message` · `MessagesQuery` · `MessagesPage` · `HealthResponse` · `ApiErrorBody` | `CreateRoomBody` · `RenameRoomBody` · `UserMessageBody` · `EditMessageBody` · `ApiErrorBody.error.retryAfterSec?` |
| 에러 코드 | `shared/src/errors.ts` | 13종 전체(`ERROR_CODES` · `ErrorCode` · `ErrorStatus` · `ERROR_STATUS` · `ERROR_MESSAGES` · `isErrorCode`) | 변경 없음(13종 그대로) |
| 경로 | `shared/src/endpoints.ts` | `PATHS`(embed·health·rooms·roomMessages) · `endpoints` 빌더 | `PATHS.room` · `PATHS.roomUser` · `PATHS.message` · `endpoints.room/roomUser/message` |
| 캐릭터 표시 메타 | `shared/src/characters.ts` | `CharacterMeta` · `CHARACTERS`(R-LLM-002) | 변경 없음 |
| 길이 규칙 (v0.3.1) | `shared/src/limits.ts` | — | **신규** `ROOM_TITLE_MAX` · `MESSAGE_TEXT_MAX` · `MEMORY_SUMMARY_MAX` · `countCodePoints` · `normalizeText`(§5.7) |
| 서버 쪽 | `server/src/routes/{index,validate,schemas,health,rooms,messages}.ts` | `apiRoutes` 조립 · zod 검증 · GET 3종 | `rooms.ts` POST·PATCH·DELETE · `messages.ts` POST user·PATCH·DELETE · `schemas.ts` 본문·메시지 id 스키마 |
| 화면 쪽 | `ui/src/api/{client,health,rooms,messages,index}.ts` | `request` · `getHealth` · `listRooms` · `listMessages` | `configureClient` · `isAuthFailure` · `createRoom` · `renameRoom` · `deleteRoom` · `appendUser` · `editMessage` · `deleteMessage` |
| 갠홈 쪽 | `doc/handoff/*` | S5(쓰지 않음) | S5(쓰지 않음). §2.6이 참조 규약 |

S3 추가(v0.4):

| 당사자 | 파일 | S3 추가 |
|---|---|---|
| 문서(정본) | `doc/200_설계/contract/api.md` | §4.12~§4.14 · §11.8~§11.10 · §12.2 · §13.2 · §14.9~§14.11 · §15.8~§15.10 · 「ui 인계 메모」 |
| 공용 타입 | `shared/src/types.ts` | `SpeakBody` |
| 에러 코드 | `shared/src/errors.ts` | 변경 없음(S3 코드 5종은 S1부터 13종 안에 있다) |
| 경로 | `shared/src/endpoints.ts` | `PATHS.roomSpeak` · `PATHS.messageRegenerate` · `endpoints.roomSpeak/messageRegenerate` |
| 캐릭터 표시 메타 · 길이 규칙 | `shared/src/characters.ts` · `limits.ts` | 변경 없음 |
| 서버 쪽 | `server/src/routes/{schemas,messages}.ts` | `speakBody` · `messages.ts` POST speak(E9) · POST regenerate(E12) |
| 화면 쪽 | `ui/src/api/{messages,index}.ts` | `speak` · `regenerate` |
| 갠홈 쪽 | `doc/handoff/*` | 영향 없음 |

S3b 추가(v0.4.1):

| 당사자 | 파일 | S3b 추가 |
|---|---|---|
| 문서(정본) | `doc/200_설계/contract/api.md` | §3.2 14행째 · §3.1·§3.4·§3.5 · §4.12~§4.14 판정·에러 행 · §5.2·§5.3 · §6.1 S3b 행 · §8 handoff 예정 · §11.11 · §12.3 · §13.3 · §14.12·§14.13 · §15.11 · 「ui 인계 메모」 S3b · 「contract-implementer 인계 목록」 |
| 공용 타입 | `shared/src/types.ts` | **타입 변경 없음.** `ApiErrorBody.error.retryAfterSec?` 문서주석만 두 코드로 넓힌다 |
| 에러 코드 | `shared/src/errors.ts` | `LLM_BUDGET_EXCEEDED` — `ERROR_CODES` · `ERROR_STATUS` · `ERROR_MESSAGES` 3곳 |
| 경로 · 캐릭터 · 길이 | `endpoints.ts` · `characters.ts` · `limits.ts` | 변경 없음 |
| 서버 쪽 | `server/src/routes/*` | 변경 없음(서비스가 throw, server `onError`가 변환) |
| 화면 쪽 | `ui/src/api/*` | 코드·시그니처 변경 없음. `isErrorCode`가 shared를 따라 14종을 받는다. `retryAfterSec`는 계속 `RATE_LIMITED`에만 싣는다(§3.4) |
| 갠홈 쪽 | `doc/handoff/*` | S5에 AI 비용 추정 안내 1단락(§8) |

S3c 추가(v0.5):

| 당사자 | 파일 | S3c 추가 |
|---|---|---|
| 문서(정본) | `doc/200_설계/contract/api.md` | §2.7 · §3.2 15행째 · §3.4 · §4.0 E15·E16 · §4.15 · §4.16 · §5.8 · §6.1 S3c 행 · §8 TODO · §11.12~§11.14 · §12.4 · §13.4 · §14.14~§14.16 · §15.12 · §16 · 「ui 인계 메모」 S3c · 「contract-implementer 인계 목록」 S3c |
| 공용 타입 | `shared/src/types.ts` | `CharacterSettingFields` · `CharacterSettings` · `CharacterSettingsResponse` · `PutCharacterSettingsBody` |
| 에러 코드 | `shared/src/errors.ts` | `OWNER_ONLY`(403) — `ERROR_CODES` · `ERROR_STATUS` · `ERROR_MESSAGES` 3곳 |
| 경로 | `shared/src/endpoints.ts` | `PATHS.characterSettings` · `endpoints.characterSettings()` |
| 설정 규칙 | **신규** `shared/src/settings.ts` | 필드 화면 이름·필수·상한 표, 파일 형식 상수, 본문·가져오기 바이트 상한, 사전 검사 `checkCharacterSettings`(zod 없음) |
| 캐릭터 표시 메타 · 길이 규칙 | `characters.ts` · `limits.ts` | **변경 없음.** `settings.ts`가 `CHARACTERS`·`countCodePoints`·`normalizeText`를 import한다 |
| 서버 쪽 | `server/src/routes/{settings(신규),index,schemas,validate}.ts` | E15·E16 · `putCharacterSettingsBody` · `settingsIssueMessage` · `validate`의 선택 인자 `toMessage` |
| 화면 쪽 | `ui/src/api/{settings(신규),client,index}.ts` | `getCharacterSettings` · `saveCharacterSettings` · `RequestOptions.method`에 `'PUT'` |
| 갠홈 쪽 | `doc/handoff/*` | **변경 없음**(토큰 형식 불변). S5 embed-guide TODO 1줄(§8) |

S4 추가(v0.7):

| 당사자 | 파일 | S4 추가 |
|---|---|---|
| 문서(정본) | `doc/200_설계/contract/api.md` | §4.0 E13·E14 · §4.17 · §4.18 · §2.1·§2.2·§3.5·§4.12·§4.13 S4 문구 · §5.6·§5.7 행 · §5.9 · §6·§6.1 S4 행 · §8 TODO · §11.16 · §12.6 · §13.6 · §14.19·§14.20 · §15.14 · 「ui 인계 메모」 S4 · 「contract-implementer 인계 목록」 S4 |
| 공용 타입 | `shared/src/types.ts` | `MemoryResponse` · `PutMemoryBody` |
| 에러 코드 | `shared/src/errors.ts` | **변경 없음**(15종 그대로) |
| 경로 | `shared/src/endpoints.ts` | `PATHS.roomMemory` · `endpoints.roomMemory` |
| 캐릭터 · 길이 · 설정 | `characters.ts` · `limits.ts` · `settings.ts` | **변경 없음.** 서버 서비스와 화면이 `MEMORY_SUMMARY_MAX`·`countCodePoints`·`normalizeText`를 그대로 쓴다 |
| 서버 쪽 | `server/src/routes/{memory(신규),index,schemas}.ts` | E13·E14 · `putMemoryBody` · `MEMORY_BODY_MAX_BYTES` |
| 화면 쪽 | `ui/src/api/{memory(신규),index}.ts` | `getMemory` · `putMemory`. `client.ts` 변경 없음(`'PUT'`은 S3c에 있다) |
| 갠홈 쪽 | `doc/handoff/*` | **변경 없음**(토큰·임베드 주소 불변). S5 비용 안내에 요약 호출 1줄(§8 TODO) |

### 1.2 경계 규칙

- **단방향.** 화면·컴포넌트·state는 `@/api`(= `ui/src/api/index.ts`)만 import한다. `fetch`를 `ui/src/api/` 밖에서 쓰면 경계 위반이다.
- **라우트는 얇다.** 핸들러는 zod 검증 → `c.get('services')`의 서비스 호출 → `c.json()`만 한다(30줄 이내, R-API-007). 범위·존재 판정은 서비스가 한다.
- **진입점 소유(server).** `/embed` 서빙, `onError`·`notFound`, CSP 헤더, 요청 로그는 server 진입점(`server/src/app.ts`)이 갖는다. 라우트는 이것들을 정의하지 않는다(server index.md §9.1).
- **경로 리터럴은 `shared/src/endpoints.ts` 한 곳에만** 둔다(R-API-008).

### 1.3 현황 메모 (2026-10-05, v0.3 작성 시점)

- S1 4자(문서·shared·routes·ui/api)는 구현돼 있고 계약 값은 일치한다(v0.2.1).
- 문서 초안과 코드 표기 차이(계약 영향 없음, analyst 확인용): `validate.ts`가 `new AppError('VALIDATION_ERROR')`(status·문구는 `AppError`가 코드에서 정함)를 쓰고, §3.5·§11.2 초안은 옛 3인자 표기다. server index.md의 S1 동기화(`AppError(code, message?, options?)`)가 정본이다.
- S2 server 쪽(`server/src/auth/`, `rooms`·`messages`의 쓰기 함수, `AppError`의 `retryAfterSec`, `toErrorBody` 3번째 인자)은 **아직 없다**. S2 routes 구현은 server S2 구현 뒤에 한다(§11.4).
- `ui/src/state/token.ts`는 아직 없다. `viewer.ts`는 S1 상수 `READ_ONLY_VIEWER`뿐이다.
- 구현 순서는 §11.4를 따른다.
- (v0.4, 2026-10-06) S3 4자는 **전부 아직 없다.** `shared/src/endpoints.ts`에 speak·regenerate 경로가 없고 routes에 핸들러가 없어 두 경로는 지금 `404 NOT_FOUND`다. server 쪽도 `server/src/llm/`·`messages.speak`·`regenerate`가 없다(설계만 있음).
- (v0.4) S2 routes 테스트의 실제 파일은 `server/test/routes-write.test.ts`다. §14.5 제목의 `routes.test.ts` 표기와 다르다(계약 영향 없음, analyst 확인용).
- (v0.4.1, 2026-10-06) S3 4자는 구현됐다(§12.2). **S3b 4자는 전부 아직 없다.** `shared/src/errors.ts`는 13종이고(`shared/test/errors.test.ts` API-T-040이 `toHaveLength(13)`), `server/src/llm/usage.ts`·`Llm.ensureBudget`도 없다. `shared/src/types.ts`·`server/src/app-error.ts`·`server/src/app.ts`·`ui/src/api/client.ts`의 `retryAfterSec` 주석은 "RATE_LIMITED 전용"이다. 다만 `app.ts` `errorResponse`는 코드 종류를 보지 않고 `err.retryAfterSec`이 있으면 본문·`Retry-After`를 붙인다. routes 테스트 `expectContractError`(`routes-write.test.ts`·`routes-generate.test.ts` 두 벌)는 `RATE_LIMITED`만 3키를 허용한다(§14.12에서 갱신).
- (v0.7, 2026-10-07) S4 4자는 **전부 아직 없다.** `shared/src/endpoints.ts`의 `PATHS`는 10개이고 `roomMemory`가 없으며, routes에 핸들러가 없어 E13·E14는 지금 `404 NOT_FOUND`다. `shared/src/limits.ts`의 `MEMORY_SUMMARY_MAX`(4000)·`countCodePoints`·`normalizeText`는 있다. server 쪽은 `server/src/memory/`가 없고 `server/src/services.ts`에 `memory`·`afterSpeak` 배선이 없다(memory.md 설계만 있음). `server/test/routes-generate.test.ts`의 `call` 도우미는 `createExecutionContext()`를 만들기만 하고 `waitOnExecutionContext`를 부르지 않는다. `ui/src/api/client.ts`의 `RequestOptions.method`에는 `'PUT'`이 이미 있다(S3c).

### 1.4 묶음별 범위

| 묶음 | 이 문서에서 정하는 것 |
|---|---|
| S1 | §3 에러 코드 13종 전부, §4.1~§4.4, §5 shared 4파일, §11 routes·ui/api, §12~§14 |
| S2 (**v0.3 확정**) | §2 토큰 상세(형식·전달·검증 순서·`TokenPayload`·화면 보관·전환·교차 벡터), §4.5~§4.11 쓰기 엔드포인트(방 생성·변경·삭제, user 저장, 메시지 수정·삭제), §6 레이트리밋, §11.5~§11.6 routes·ui/api 설계 |
| S3 (**v0.4 확정**) | §4.12 생성 공통(70초 상한·화면 타임아웃 규약·잠금·레이트리밋 카운트), §4.13 speak, §4.14 regenerate, §5.2·§5.4 델타(`SpeakBody`·경로 2개), §11.8~§11.10 routes·ui/api 설계, 「ui 인계 메모」 |
| S3b (**v0.4.1 확정**) | §3.2 14종째 코드, §3.4 429 두 종류 구분, §4.12~§4.14 판정 순서·에러 행, §6.1 카운트, §8 handoff 메모 예정, §11.11 구현 부록, 「ui 인계 메모」 S3b. 엔드포인트 추가 0 |
| S3c (**v0.5 확정**) | §2.7 설정 엔드포인트 예외·주인 판정, §3.2 15종째 `OWNER_ONLY`, §4.15 E15·§4.16 E16, §5.8 타입·`settings.ts`, §6.1 S3c 카운트, §11.12~§11.14 routes·ui/api, §16 파일 형식·가져오기 매핑. 엔드포인트 2개 추가 |
| S4 (**v0.7 확정**) | §4.17 E13 · §4.18 E14(본문 32KiB·경합), §4.12·§4.13 E9 응답 뒤 자동 요약 부수 효과, §5.9 타입 2·경로 1, §6.1 S4 카운트, §11.16 routes·ui/api, §12.6 대조표(예정), 「ui 인계 메모」 S4. 엔드포인트 추가 0(§4.0 행 상세화)·에러 코드 0 |
| S5 | §8 handoff 3종 |
| S3f (**v0.8 확정**) | §4.15 E15 응답 `model` · §4.16 E16 본문 `model?`·판정 순서·400 문구 1행·부수 효과, §5.8.6 shared 추가분, §16.1 내보내기 제외, §11.17 routes·ui/api, §12.7 대조표(예정), §8 handoff 설정값 안내. 엔드포인트·에러 코드·경로 추가 0 |
| S6 (**v0.9 확정**) | §2.8 방 입장 증명·관문·주인 프리패스·E17 토큰 선택, §2.1 행, §3.2 16·17종째, §4.0 E17~E19, §4.2 `locked`, §4.3 E7 관문, §4.5 공통 관문·에러 행, §4.6 E4 `password?`·`CreateRoomResponse`, §4.17·§4.18 관문, §4.19~§4.21 E17·E18·E19, §5.10 shared 추가분, §6.2 입장 시도 상한, §11.18 routes·ui/api, §12.8 대조표(틀), §13.8, §14.22, §15.16. 엔드포인트 3개·에러 코드 2개·경로 2개 추가. 소유 파일 변경 목록은 「contract-implementer 인계 목록」 S6 |

---

## 2. 인증·토큰

토큰은 갠홈이 써 준 출입증이다. 서버는 도장(서명)이 진짜인지, 유효기간이 지났는지, 등급이 충분한지만 본다. 회원 명부는 갠홈이 갖고 있다.

### 2.1 S1 확정 규칙 (R-AUTH-003의 읽기 쪽)

| 규칙 | 값 |
|---|---|
| S1 엔드포인트 토큰 | 전부 **불필요** |
| 읽기 엔드포인트에 `Authorization` 헤더가 있을 때 | **무시한다.** 검증하지 않고, 잘못된 토큰이어도 읽기를 거절하지 않는다(401·403 없음) |
| S2 이후 유지 약속 | 토큰 미들웨어는 쓰기 엔드포인트에만 붙는다. `GET /api/health`·`GET /api/rooms`·`GET /api/rooms/:id/messages`는 계속 토큰 불필요 |
| 예외(요구 명시) | `GET /api/rooms/:id/memory`는 읽기지만 **토큰 필요**(확정사항 §5.2, R-MEM-001). (v0.7) 상세는 §4.17 — `requireToken`만 붙고 주인 판정은 없다. 이 경로는 헤더를 무시하지 않고 검증하며, 래퍼 `getMemory`는 `auth: true`로 헤더를 붙인다. (v0.5) `GET /api/settings/characters`(E15)도 읽기지만 **토큰 + 주인 판정 필요**(R-AUTH-003 2026-10-06 개정 · R-SET-004, §2.7). 이 경로는 헤더를 무시하지 않고 검증하며, 래퍼 `getCharacterSettings`는 `auth: true`로 헤더를 붙인다 |
| S1 화면 | **항상 읽기 전용**이다. R-CHAT-009(토큰 메모리 보관)는 S2로 옮겨졌다(requirements §0, 2026-10-05) |
| 토큰 보관(S2 확정) | §2.4. 보관은 `ui/src/state/token.ts`가 소유한다. `ui/src/api/client.ts`는 `configureClient({ getToken })`로 getter를 주입받아 **쓰기 요청에만** 헤더를 붙인다 |
| S2 이후 읽기 | 화면이 토큰을 가지고 있어도 읽기 래퍼(`getHealth`·`listRooms`·`listMessages`)는 `Authorization`을 붙이지 않는다. 서버도 읽기 경로에서 헤더를 보지 않는다 |
| 잠긴 방 읽기 (S6, v0.9 — R-AUTH-003 개정 L3) | 읽기 엔드포인트는 계속 **토큰 불필요**이고 `Authorization`을 보지 않는다. 단 **잠긴 방의 E7은 입장 증명 헤더 `X-Room-Key`가 필요**하다(§2.8). E7은 주인 판정도 하지 않는다 — 주인도 증명으로 연다(§2.8.4). E3(목록)은 잠긴 방도 누구나 본다(`locked` 표시만, §4.2). E17(입장)은 POST이고 토큰 **선택**이다(있으면 검증, 실패는 익명으로 본다 — §2.8.5) |

### 2.2 전달 규약 (S2 확정 — R-API-003 🔒 · R-AUTH-003 🔒)

| 항목 | 규칙 |
|---|---|
| 받는 곳 | `Authorization: Bearer <t>` 헤더 **하나뿐**. scheme 대소문자 무시(`bearer`도 됨), scheme 뒤 공백 1개 이상, 토큰 앞뒤 공백은 버린다(server auth.md §2.4 `readBearer`) |
| 보지 않는 곳 | 쿼리 `?t=`·쿠키·본문. 헤더 없이 `?t=<유효 토큰>`만 붙인 쓰기 요청은 `401 TOKEN_REQUIRED`다 |
| 꺼낼 수 없음 | 헤더 없음 · 빈 값 · 공백뿐 · `Bearer`만 있고 토큰 자리 빔 · 다른 scheme(`Basic …`) → `401 TOKEN_REQUIRED` |
| 꺼냈는데 실패 | §2.3 검증 실패 → `401 TOKEN_INVALID` 또는 `403 LEVEL_TOO_LOW` |
| 적용 범위 | **쓰기 라우트마다** `requireToken → rateLimitWrites → validate → 핸들러` 순서로 붙인다. 전역·라우터 단위(`apiRoutes.use`) 금지(server auth.md §9.1, index.md D-IDX-9) |
| S2 적용 대상 | E4 · E5 · E6 · E8 · E10 · E11(§4.0) 6개 전부. S3 E9·E12도 같다. (v0.7) S4 E13(GET memory)은 `requireToken`만, E14(PUT memory)는 `requireToken` → `rateLimitWrites`를 붙인다(§4.17·§4.18) |
| 순서의 결과 | 인증 실패가 본문 검증 실패보다 먼저 나온다. 토큰 없이 잘못된 본문을 보내면 `400`이 아니라 `401 TOKEN_REQUIRED`다 |
| 화면 쪽 | 쓰기 래퍼만 `Authorization: Bearer <getToken()>`을 붙인다. getter가 `null`이면 헤더 없이 보낸다(서버가 `TOKEN_REQUIRED`로 답하고 래퍼는 그대로 돌려준다). API 호출 URL에 `?t=`를 붙이지 않는다 |

### 2.3 토큰 형식 (S2 확정 — R-AUTH-001 🔒 · R-AUTH-002 🔒)

server auth.md §2.1~§2.3과 같은 문구다. 둘이 어긋나면 contract 결함이다.

```
token     = seg1 "." seg2
seg1      = base64url( JSON 바이트 )                                         ← PHP json_encode 결과 문자열의 UTF-8 바이트
seg2      = base64url( HMAC-SHA256( key = UTF-8(SECRET), data = JSON 바이트 ) )   ← 32바이트
base64url = RFC 4648 §5 알파벳(A–Z a–z 0–9 - _), 패딩 '=' 없음, 정규 인코딩만
```

- **서명 입력은 JSON 바이트**(seg1을 디코드한 바이트)다. seg1 문자열이 아니다(JWT와 다르다, auth.md D-AUTH-1). PHP 기준식: `$json = json_encode($payload, FLAGS); $token = b64u($json) . '.' . b64u(hash_hmac('sha256', $json, SECRET, true));`
- 토큰 원문은 4096자 이하다(`TOKEN_MAX_LENGTH`). 실제 토큰은 300자 안팎이다.

`TokenPayload` — 문서용 표기다. **shared에 두지 않는다**(화면은 토큰을 해석하지 않고, 서버는 auth 모듈의 zod 스키마가 정본이다). 필드 이름은 R-AUTH-001대로 snake_case이며 API 본문 camelCase 규칙(§5.1)의 유일한 예외다(갠홈 PHP 산출물).

```ts
type TokenPayload = {
  mb_id: string           // 그누보드 로그인 id. 1자 이상. 서버는 trim 하지 않는다(레이트리밋 키·author_mb_id)
  nick: string            // 닉네임. trim 후 1자 이상
  ch_name: string | null  // 캐릭터명. 키는 항상 있어야 한다. '' · 공백뿐 · null 이면 "캐릭터명 없음"
  level: number           // JSON 정수 1~10. 문자열 "5" 거부 → PHP 는 (int)$member['mb_level']
  exp: number             // JSON 정수, epoch 초 = 발급 시각 + 43200(12h). 문자열 거부 → PHP 는 time() + 43200
}
```

```json
{"mb_id":"tester01","nick":"테스터","ch_name":"시엘 팬텀하이브","level":5,"exp":1767268800}
```

- 모르는 키는 무시한다(`iat` 등을 넣어도 통과).
- JSON 직렬화 플래그는 **검증 결과와 무관하다.** 서버는 seg1을 디코드한 바이트에 그대로 HMAC을 계산하고 다시 직렬화하지 않는다. 그래서 PHP 기본 `json_encode`(한글 `\uXXXX`)로 만든 토큰도 통과한다(§2.5 V7).
- 다만 handoff·교차 벡터의 바이트 일치를 위해 **권장값을 `JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES`, 키 순서 `mb_id, nick, ch_name, level, exp`로 고정한다**(§2.5 V1과 같은 바이트).

검증 순서와 실패 코드(R-AUTH-002, auth.md §2.2):

| 단계 | 검사 | 실패 |
|---|---|---|
| 1 | 길이 1~4096, `.` 정확히 1개, 두 조각 모두 비어 있지 않음 | `401 TOKEN_INVALID` |
| 2 | base64url 알파벳·정규 인코딩, seg2 디코드 길이 32 | `401 TOKEN_INVALID` |
| 3 | **서명**: Web Crypto HMAC-SHA256 계산 후 상수시간 비교(`timingSafeEqual`) | `401 TOKEN_INVALID` |
| 4 | UTF-8(fatal) → `JSON.parse` → payload 스키마(위 표). 서명 전에는 JSON을 해석하지 않는다 | `401 TOKEN_INVALID` |
| 5 | **만료**: `nowMs < exp × 1000`일 때만 유효(같으면 만료). 시계 여유 없음 | `401 TOKEN_INVALID` |
| 6 | **등급**: `level >= TOKEN_MIN_LEVEL`(코드 기본 5, `wrangler.toml [vars]`. (v0.8.2) **운영값 10** — 2026-10-08 저녁 사용자 결정, 갠홈 PHP `RB_CHATBOT_LEVEL`과 같은 값) | `403 LEVEL_TOO_LOW` |

- 응답 문구는 실패 단계와 무관하게 코드별 기본 문구 하나다(§3.2). 어느 단계에서 실패했는지 응답에 싣지 않는다.
- 만료가 등급보다 먼저다. 만료된 저등급 토큰은 `TOKEN_INVALID`다.
- 통과하면 서버는 `Principal { mbId, nick, chName, level, displayName }`을 만든다. `displayName = chName ?? nick`(R-AUTH-004)이고 유저 메시지의 D1 `author_name`에 **저장만** 한다(감사용). (v0.6, S3d) 응답 `authorName`에는 쓰지 않는다 — 유저 메시지 `authorName`은 항상 `USER_DISPLAY_NAME`(「어떠한 의지」, §5.5)이고 서버 행 변환 한 곳에서 투영한다(R-AUTH-004 2026-10-06 개정). `mbId`도 저장만 하고 응답에 내지 않는다(§4.3, db.md D-DB-5).

### 2.4 화면 보관·전환 (S2 확정 — R-API-003 🔒 · R-CHAT-009 🔒 · R-CHAT-011)

| 항목 | 규칙 |
|---|---|
| 읽는 시점·곳 | `main.tsx`가 렌더 전에 한 번, `ui/src/state/token.ts`의 함수로 `location.search`의 `t`를 읽는다. 값이 없거나 trim 후 빈 문자열이면 "토큰 없음" |
| 보관 | `ui/src/state/token.ts`의 **메모리(클로저)만**. `localStorage`·`sessionStorage`·쿠키·IndexedDB 저장 금지 |
| URL | 고치지 않는다(R-CHAT-009 "제거하지 않아도 된다"). `?t=`는 서버가 읽지 않고 로그에 남기지 않는다(§4.4) |
| 해석 | 화면은 토큰을 디코드·검사하지 않는다. 만료·등급 판단은 서버 응답 코드로만 한다 |
| 헤더 부착 | `main.tsx`가 렌더 전에 `configureClient({ getToken })`를 **한 번** 부른다. `getToken`은 `token.ts`가 제공한다. `client.ts`는 쓰기 요청 때마다 getter를 불러 헤더만 만들고 토큰을 보관하지 않는다 |
| 쓰기 가능 | `viewer.canWrite = 토큰 있음`. `false`이면 쓰기 UI를 렌더하지 않는다(R-CHAT-008, R-ROOMS-002, R-CHAT-004) |
| 읽기 전용 전환 | 쓰기 래퍼 결과가 `isAuthFailure(error)`(= `TOKEN_REQUIRED` · `TOKEN_INVALID` · `LEVEL_TOO_LOW`)이면 화면 state가 토큰을 버리고 `canWrite = false`로 바꾼다. 쓰기 UI가 언마운트되고 읽기 전용 안내가 뜬다(R-CHAT-011). 되돌리기는 새로 고침뿐이다(갠홈이 새 토큰을 발급) |
| `RATE_LIMITED` | 전환하지 않는다. "잠시 후" 안내만 한다. `error.retryAfterSec`가 있으면 화면이 쓸 수 있다(§3.4) |
| `LLM_BUDGET_EXCEEDED` (S3b) | 전환하지 않는다. 이번 달 한도 안내만 한다. 래퍼는 이 코드에 `retryAfterSec`를 싣지 않는다(§3.4 429 구분) |
| `OWNER_ONLY` (S3c, v0.5) | 전환하지 않는다. 주인 판정은 쓰기 권한과 별개다. `isAuthFailure`의 3코드에 넣지 않는다(§2.7 · R-SET-010) |
| 주인 판정 탐침 결과 (S3c) | E15 판정 호출의 결과로는 **어떤 코드든 전환하지 않는다**(401·`LEVEL_TOO_LOW` 포함, R-SET-010). 전환은 지금처럼 실제 쓰기 실패가 결정한다. 설정 화면 안 저장 실패의 인증 코드는 위 「읽기 전용 전환」 행을 따르되 초안을 보존한다(R-SET-011, ui 설계 몫) |
| 그 밖의 에러 | 전환하지 않는다(`VALIDATION_ERROR`·`NOT_FOUND`·`NETWORK`·`INTERNAL` 등) |
| 노출 금지 | 토큰을 `console`·화면·에러 문구·저장소에 남기지 않는다(R-AUTH-006) |

- `TOKEN_REQUIRED`를 전환 목록에 넣은 이유: 쓰기 UI가 보이는데 서버가 "토큰 없음"이라고 답하면 화면 판단이 틀린 것이다. 읽기 전용으로 닫는 쪽이 안전하다. R-CHAT-011은 `TOKEN_INVALID`·`LEVEL_TOO_LOW`를 적었고, 이 줄은 같은 규칙을 세 번째 인증 코드에 넓힌 계약 결정이다(auth.md D-AUTH-6 "화면은 두 코드 모두 읽기 전용 전환"과 같은 취지).
- 계약이 정하는 것은 위 규칙과 `ClientConfig.getToken` 타입(§11.6), `isAuthFailure` 판정이다. `token.ts`의 함수 이름·강등 방식·`viewer` 계산 위치는 ui 설계가 정한다.

### 2.5 교차 테스트 벡터 V1~V8 (R-AUTH-001 · R-TOKEN-001 — server auth.md §2.6 전사)

server 테스트(SRV-T-100~109), contract 라우트 테스트(§14.5 — 토큰은 `signTestToken`으로 만든다), S5 handoff(`token-snippet.php.md` 자가 점검)가 **같이 쓰는 단일 벡터**다. 아래는 auth.md §2.6을 그대로 옮긴 것이다. 값이 다르면 auth.md가 정본이고 이 절을 고친다.

**테스트 전용 SECRET**: `london-dispatch-test-secret-v1` — 운영 SECRET이 아니다. 운영 값은 문서·코드에 남기지 않는다.
공통: `minLevel = 5`, 기준 시각 `nowMs = 1767225600000`(2026-01-01T00:00:00Z), `exp = 1767268800`(기준 + 12h). JSON은 키 순서 `mb_id, nick, ch_name, level, exp`, `level`·`exp`는 정수, 한글은 UTF-8 그대로(`JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES`와 같은 바이트).

| ID | payload JSON(바이트 수) | 기대 |
|---|---|---|
| V1 | `{"mb_id":"tester01","nick":"테스터","ch_name":"시엘 팬텀하이브","level":5,"exp":1767268800}` (101) | ok. `{ mbId: 'tester01', nick: '테스터', chName: '시엘 팬텀하이브', level: 5, displayName: '시엘 팬텀하이브' }` |
| V2 | `{"mb_id":"tester02","nick":"닉네임","ch_name":"","level":10,"exp":1767268800}` (80) | ok. `chName: null`, `displayName: '닉네임'`, `level: 10` |
| V3 | `{"mb_id":"tester03","nick":"하급","ch_name":"","level":4,"exp":1767268800}` (76) | `LEVEL_TOO_LOW` / `level` |
| V4 | `{"mb_id":"ascii_only","nick":"Tester","ch_name":"Ciel","level":5,"exp":1767268800}` (82) | ok. `displayName: 'Ciel'` |
| V5 | V1의 seg2 **첫 글자** `E`→`F` | `TOKEN_INVALID` / `signature` |
| V5b | V1의 seg2 **마지막 글자** `4`→`5`(패딩 비트만 다름 — 디코드 바이트는 같다) | `TOKEN_INVALID` / `format`(비정규 인코딩) |
| V6 | V1 payload를 SECRET `wrong-secret`으로 서명 | `TOKEN_INVALID` / `signature` |
| V7 | V1과 같은 값, PHP 기본 `json_encode`(한글 `\uXXXX` 이스케이프, 131바이트) | ok. Principal은 V1과 같다 |
| V8 | V1을 `nowMs = 1767268800000`(= exp × 1000)에 검증 | `TOKEN_INVALID` / `expired`. `1767268799999`이면 ok |

토큰 전문(테스트 SECRET 기준, Node `crypto.createHmac`으로 산출):

```text
V1  eyJtYl9pZCI6InRlc3RlcjAxIiwibmljayI6Iu2FjOyKpO2EsCIsImNoX25hbWUiOiLsi5zsl5gg7Yys7YWA7ZWY7J2067iMIiwibGV2ZWwiOjUsImV4cCI6MTc2NzI2ODgwMH0.EWYxcZixnZzWnIjEmFZFc1-_DrqQ8gfOQEOFm3xzMu4
V2  eyJtYl9pZCI6InRlc3RlcjAyIiwibmljayI6IuuLieuEpOyehCIsImNoX25hbWUiOiIiLCJsZXZlbCI6MTAsImV4cCI6MTc2NzI2ODgwMH0.jWSaBGh1d4nF9M5kKORFq2V2sss6O2YWTGvAGi4C15s
V3  eyJtYl9pZCI6InRlc3RlcjAzIiwibmljayI6Iu2VmOq4iSIsImNoX25hbWUiOiIiLCJsZXZlbCI6NCwiZXhwIjoxNzY3MjY4ODAwfQ.X3DOlOqHWy4fJbzpuYxO1TKYegyRQj2Q9udNSsagvXI
V4  eyJtYl9pZCI6ImFzY2lpX29ubHkiLCJuaWNrIjoiVGVzdGVyIiwiY2hfbmFtZSI6IkNpZWwiLCJsZXZlbCI6NSwiZXhwIjoxNzY3MjY4ODAwfQ.bZ5o0FN-_veyz6bFb6gbVejYdIpqhkehp2XuzudLahI
V6  eyJtYl9pZCI6InRlc3RlcjAxIiwibmljayI6Iu2FjOyKpO2EsCIsImNoX25hbWUiOiLsi5zsl5gg7Yys7YWA7ZWY7J2067iMIiwibGV2ZWwiOjUsImV4cCI6MTc2NzI2ODgwMH0.3xEoW7yPl5OjkrJJqXh6huMbZ4p1Lzk55AVgoBtyWX8
V7  eyJtYl9pZCI6InRlc3RlcjAxIiwibmljayI6Ilx1ZDE0Y1x1YzJhNFx1ZDEzMCIsImNoX25hbWUiOiJcdWMyZGNcdWM1ZDggXHVkMzJjXHVkMTQwXHVkNTU4XHVjNzc0XHViZTBjIiwibGV2ZWwiOjUsImV4cCI6MTc2NzI2ODgwMH0.Ppc6_c3yRi28H05QHEZ_gvQMF-neidGMOwQ3a6ukWKs
```

- 테스트 SECRET은 운영 값이 아니다. 운영 SECRET은 문서·코드에 남기지 않는다(R-NFR-004, S5 `secret-handover.md`).
- R-TOKEN-001 수용 기준: S5 PHP 조각을 테스트 SECRET·V1 입력으로 돌려 V1 토큰 문자열이 바이트 단위로 같으면 충족이다. 기본 플래그를 쓴 PHP라면 V7과 같아야 한다(서버는 둘 다 통과).

### 2.6 handoff 참조 (S5에서 작성)

- `doc/handoff/token-snippet.php.md`는 **이 절(§2.2·§2.3·§2.5)을 따른다.** 붙일 위치는 `theme/victorian/inc/rosebell-chatbot.php`, iframe src는 `$rb_chatbot_embed_url . '?t=' . $token`이다(R-TOKEN-001).
- PHP 조각이 지킬 것: 로그인 회원이고 `$member['mb_level'] >= LEVEL`일 때만 발급, `level`은 `(int)` 캐스트, `exp = time() + 43200`, `ch_name` 키는 값이 없어도 `''`로 넣는다, 권장 플래그 `JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES`, base64url 무패딩, 비회원·저등급이면 `?t=` 없이 임베드 주소만.
- 이 절의 형식·payload 필드·`?t=` 이름을 바꾸면 저쪽 PHP 재적용이 필요한 **파괴 변경**이다(§8·§13).
- (v0.8.2, 2026-10-08 저녁 🔒 사용자 결정) PHP 조각은 보는 사람 등급으로 **세 갈래**를 나눈다. 비로그인이면 등급 0으로 본다(`$is_member` 비어 있음).

| 보는 사람 | PHP 조각 | iframe | 서버가 보는 것 |
|---|---|---|---|
| 비로그인 · `mb_level < RB_CHATBOT_VIEW_LEVEL`(2) | `$rb_chatbot_embed_url = ''` + 패널 자리표시 문구를 가입 안내로(`$rb_chatbot_notice_title/body/small`) | 만들지 않는다(테마 JS가 빈 주소면 생략) | 요청 없음 |
| 2 이상 `RB_CHATBOT_LEVEL`(10) 미만 | 주소만(`?t=` 없음) | 읽기 전용 | 토큰 없는 읽기(§2.1) |
| 로그인 · `mb_level >= RB_CHATBOT_LEVEL`(10) | 토큰 발급 → `?t=` 부착(조건·형식은 위 bullet 그대로) | 글쓰기 가능 | §2.3 검증, `TOKEN_MIN_LEVEL` 10 |

- 열람 등급(`RB_CHATBOT_VIEW_LEVEL`)은 **갠홈 PHP만** 안다. 토큰 payload·서명·`?t=`·서버 설정에 들어가지 않으므로 이 분기는 토큰 형식 변경이 아니다(파괴 변경 아님). 서버 `/embed`·읽기 엔드포인트는 계속 토큰 없이 열린다(§2.1, R-AUTH-003) — 갠홈 패널의 표시 제한이지 서버 접근 통제가 아니다.
- `RB_CHATBOT_LEVEL`과 `TOKEN_MIN_LEVEL`은 같은 값(10)이어야 한다. 어긋날 때의 결과는 handoff `token-snippet.php.md` §3. 조각 전문·조립 순서(자리표시 3줄 치환 포함)는 같은 문서 §1·§2가 원문이다.

### 2.7 설정 엔드포인트 예외·주인 판정 (S3c 확정 — R-AUTH-003 🔒 개정 · R-SET-001 🔒 · R-SET-004 🔒 · R-SET-010)

설정 화면은 집 열쇠 보관함이다. 출입증(토큰)이 있어야 문 앞까지 가고, 집주인 명단에 이름이 있어야 보관함이 열린다. 명단은 서버만 갖고 있고 출입증 모양은 그대로다.

| 항목 | 규칙 |
|---|---|
| 대상 | E15 `GET /api/settings/characters` · E16 `PUT /api/settings/characters`(§4.0). 이 밖의 엔드포인트는 주인 판정을 하지 않는다 |
| 토큰 | 두 엔드포인트 모두 **필수**. E15는 읽기지만 토큰이 필요하다(R-AUTH-003 예외, §2.1). 받는 곳은 §2.2와 같다(Bearer 헤더만, `?t=` 무시) |
| 주인 정의 | `requireToken`을 통과한 principal의 `mbId`가 서버 설정 `OWNER_MB_IDS` 목록에 있을 때만 주인이다(R-SET-001). 목록에는 **지인(갠홈 주인) 회원 ID만** 둔다. 사용자 본인 ID는 넣지 않는다(2026-10-06 사용자 결정). 목록이 비면 모두 주인이 아니다(닫힌 쪽 실패) |
| 목록 위치 | `OWNER_MB_IDS` 한 키. 파싱·형식 규칙과 위치(Secrets 또는 `[vars]`)는 server env.md가 정한다. 형식 위반이면 모든 경로가 `500 CONFIG_INVALID`다(R-ENV-003). **이 문서와 handoff에는 실제 회원 ID를 쓰지 않는다** |
| 미들웨어 순서 | E15: `requireToken → requireOwner → 핸들러`. E16: `requireToken → requireOwner → rateLimitWrites → 본문 상한 → validate('json') → 핸들러`. 라우트 단위로 붙인다(전역 금지, §2.2) |
| 순서의 결과 | 등급 미달이면 주인이어도 `403 LEVEL_TOO_LOW`다(토큰 검증이 먼저). 주인이 아니면 `403 OWNER_ONLY`이고 레이트리밋을 세지 않는다(`rateLimitWrites`보다 앞) |
| 실패 응답 | `403 OWNER_ONLY` + 기본 문구만. 주인 목록·판정 이유·요청자 `mbId`를 싣지 않는다 |
| 화면이 아는 방법 | 화면은 토큰을 해석하지 않는다(§2.4). 주인 여부는 **E15 응답 status로만** 안다 — `200`이면 주인, 그 밖(`403 OWNER_ONLY`·401·`403 LEVEL_TOO_LOW`·`NETWORK`·`500`)은 주인 아님으로 본다(R-SET-010). 주인 여부를 알려 주는 별도 엔드포인트(`/api/me` 등)는 없다(R-API-001) |
| 판정 시점 | 토큰이 있을 때 App이 첫 렌더 뒤 1회 E15를 부른다. 판정 응답 본문은 버리고 설정 화면은 열 때 다시 읽는다(ui 설계 몫) |
| 읽기 전용 전환 | `OWNER_ONLY`는 `isAuthFailure` 3코드에 넣지 않는다. 판정 탐침 결과로는 어떤 코드든 전환하지 않는다(§2.4 S3c 행, R-SET-010) |
| 토큰 형식·handoff | **변경 없음.** payload·서명·`?t=`·PHP 조각이 그대로라 저쪽 재적용이 없다(R-AUTH-001 개정 없음) |

### 2.8 방 입장 증명·관문 (S6 확정 v0.9 — R-LOCK-004 🔒 · R-LOCK-005 🔒 · R-LOCK-006 🔒 · R-LOCK-007 🔒 · R-AUTH-003 🔒 개정 L3 · R-CHAT-010 개정 L12)

입장 증명은 잠긴 방 문 앞에서 받는 **그 방 전용 도장**이다. 비밀번호를 맞히면 서버가 찍어 주고, 브라우저는 수첩(`localStorage`)에 적어 둔다. 자물쇠 번호(비밀번호)를 바꾸면 옛 도장은 모두 무효다. 회원 출입증(토큰)과는 다른 물건이다.

#### 2.8.1 형식·전달

| 항목 | 규칙 |
|---|---|
| 이름 | 응답 필드 `entryKey` · 요청 헤더 `X-Room-Key`(상수 `ROOM_KEY_HEADER`, §5.10.3) |
| 형식 | `"e1." + base64url(HMAC-SHA256(K, roomId + "\n" + pass_hash))`(46자), `K = HMAC-SHA256(key = TOKEN_SECRET, msg = "london_dispatch/room-entry/v1")`. 정본은 server rooms.md S6 절(s6-02 §2.1)이고 이 식은 참고다. **계약상 불투명 문자열** — 화면은 해석·검사·생성하지 않고 받은 그대로 저장·전송한다. `e1.`은 형식 버전이다(형식을 바꾸면 `e2.`, 옛 증명은 무효 → 다시 묻는다) |
| 받는 곳 | 요청 헤더 `X-Room-Key` **하나뿐**. 쿼리·본문·쿠키는 보지 않는다(접근 로그·Referer 노출 방지). 헤더 없이 쿼리·본문에 실어 보낸 요청은 "증명 없음"과 같다 |
| 무효 판정 | 대상 방의 **현재** `pass_hash`로 다시 계산해 상수시간 비교. 빈 값 · `ROOM_KEY_MAX_LENGTH`(128자) 초과 · 형식 불일치 · 다른 방의 증명은 **무효**다(`400`이 아니다). 무효의 결과는 관문의 `403 ROOM_LOCKED`(잠긴 방일 때)뿐이다 |
| 수명 | **만료 없음**(결정 ②). 무효가 되는 경우는 셋: ① 비밀번호 변경(E18 — 같은 비밀번호로 다시 걸어도 새 salt라 무효) ② 잠금 해제(E19, 뒤에 다시 잠가도 해제 전 증명은 무효) ③ `TOKEN_SECRET` 교체(모든 방, handoff `secret-handover.md` §6) |
| 범위 | 방 하나. 다른 방 요청에 붙이면 무효 |
| 안 잠긴 방 | 헤더가 있어도 보지 않는다. 결과가 지금과 같다 |
| 내주는 곳 | E4(비밀번호를 건 생성, §4.6) · E17(§4.19) · E18(§4.20) 응답뿐. 그 밖 응답·에러 본문에는 없다 |
| 서버 저장·로그 | 서버는 증명을 저장하지 않는다(요청마다 다시 계산, 무상태). 증명·해시·비밀번호 원문을 로그·응답·에러 문구에 남기지 않는다(R-LOCK-007) |

#### 2.8.2 화면 보관 (R-CHAT-010 개정 L12 · R-CHAT-009 🔒 불변 L13)

| 항목 | 규칙 |
|---|---|
| 위치 | `localStorage` 키 `ld:roomKeys` 하나(방 id·증명 쌍 배열, 상한 50쌍, `try/catch`, 실패 시 같은 세션 메모리). 소유는 `ui/src/state/roomKeys.ts`(ui 설계 몫 — s6-02 §2.3) |
| ui/api 연결 | `main.tsx`가 `configureClient({ getToken, getRoomKey })`로 getter를 한 번 주입한다. `client.ts`는 증명을 보관하지 않고 `roomId`가 있는 요청 때마다 `getRoomKey(roomId)`를 불러 헤더만 만든다(§11.18) |
| 지우는 때 | 그 방 요청이 `ROOM_LOCKED`로 끝남 · 방 삭제 성공 · 잠금 해제 성공(화면 몫) |
| 토큰과의 관계 | **증명은 토큰이 아니다.** 회원 토큰은 계속 메모리에만 둔다(§2.4, R-CHAT-009 🔒). 토큰을 `ld:roomKeys`나 다른 저장소에 넣으면 결함이다 |
| 비밀번호 원문 | 요청 본문(E4·E17·E18)으로만 보낸다. 화면 상태·저장소·로그·URL에 남기지 않는다 |

#### 2.8.3 관문 (방 입장 판정 — 서버 한 곳)

```
대상 방을 찾는다(경로 :id, 또는 메시지 id → 그 메시지의 방)
  ├ 방 없음 / 메시지 없음        → 통과(뒤에서 기존 404)
  ├ 잠기지 않음(pass_hash NULL)  → 통과
  ├ 토큰 경로 && 요청자가 주인    → 통과(§2.8.4)
  ├ X-Room-Key 가 현재 해시로 맞음 → 통과
  └ 그 밖                         → 403 ROOM_LOCKED
```

- 판정은 server rooms `assertEntry` 하나이고, 라우트는 미들웨어 `requireRoomEntry('room' | 'message')`(server auth 제공)를 `validate('param')` 바로 뒤에 한 줄 붙인다. 서비스 시그니처는 바뀌지 않는다. 화면은 판정하지 않고 응답 코드로만 반응한다.

적용 표(★ = `requireRoomEntry`. 이 표가 각 엔드포인트 절의 「처리 순서」보다 우선한다):

| # | 경로 | 처리 순서 | 주인 통과 |
|---|---|---|---|
| E5 · E6 | `PATCH`·`DELETE /api/rooms/:id` | `requireToken` → `rateLimitWrites` → `validate('param')` → ★room → (E5) `validate('json')` | ○ |
| E7 | `GET /api/rooms/:id/messages` | `validate('param')` → ★room → `validate('query')` | ✕ — 토큰을 보지 않는다. 주인도 증명으로 |
| E8 · E9 | `POST /api/rooms/:id/user` · `/speak` | `requireToken` → `rateLimitWrites` → `validate('param')` → ★room → `validate('json')` | ○ |
| E10 · E11 · E12 | `PATCH`·`DELETE /api/messages/:id` · `POST …/regenerate` | `requireToken` → `rateLimitWrites` → `validate('param')` → ★message → (E10) `validate('json')` | ○ |
| E13 | `GET /api/rooms/:id/memory` | `requireToken` → `validate('param')` → ★room | ○ |
| E14 | `PUT /api/rooms/:id/memory` | `requireToken` → `rateLimitWrites` → `validate('param')` → ★room → 본문 상한 → `validate('json')` | ○ |
| E18 · E19 | `PUT`·`DELETE /api/rooms/:id/password` | `requireToken` → `rateLimitWrites` → `validate('param')` → ★room → (E18) 본문 상한 → `validate('json')` | ○ |

- **관문 없음:** E1 · E2 · E3 · E4(새 방) · E15 · E16 · E17(입장 자체 — 판정 순서는 §4.19).
- 순서의 결과 ①: 잠긴 방에 잘못된 쿼리·본문을 보내면 `400`보다 **`403 ROOM_LOCKED`가 먼저**다(내용 형식 힌트를 주지 않는다). 경로 형식(`validate('param')`) 위반은 관문 전이라 그대로 `400`이다.
- 순서의 결과 ②: 토큰 실패(`401`·`LEVEL_TOO_LOW`)는 관문보다 먼저다. 토큰 없이 잠긴 방에 쓰면 `401 TOKEN_REQUIRED`다.
- 순서의 결과 ③: 쓰기 경로의 `403 ROOM_LOCKED`는 `rateLimitWrites` 뒤라 회원 쓰기 한도를 1회 쓴다(§4.5 "인증 통과 뒤 `400`·`404`도 센다"와 같은 원리, §6.1).
- 메시지 경로의 `:id`가 숫자가 아니거나(`NaN`, §4.5) 없는 메시지면 관문을 통과하고 서비스가 기존 `404`로 닫는다.

#### 2.8.4 주인 프리패스 (결정 ③ — R-LOCK-005 🔒)

| 경로 | 주인 처리 |
|---|---|
| E17 입장 | 토큰이 주인이면 **비밀번호 없이** `200 { entryKey }`. 비밀번호를 보내도 보지 않고, 입장 시도 상한(§6.2)을 세지 않는다 |
| 토큰 경로(E5·E6·E8~E14·E18·E19) | 관문이 주인이면 증명 없이 통과시킨다 |
| E7(읽기) | 주인 판정 없음(토큰을 보지 않는다, §2.1). 화면은 토큰이 있으면 잠긴 방을 열기 전에 E17을 비밀번호 없이 먼저 부르고(s6-02 §6.1 ③), 받은 증명으로 E7을 부른다 |
| 주인 정의 | §2.7과 같다(`mbId ∈ OWNER_MB_IDS`, 등급 통과 토큰). 목록이 비면 프리패스 없음 |
| 화면 | 주인 여부(E15 탐침 결과)를 이 흐름에 쓰지 않는다. "주인이면 통과"는 서버 한 곳이 판정한다 |
| 비주인 쓰기 권한자 | 증명을 가진(= 비밀번호를 아는) 잠긴 방만 바꾸거나 풀 수 있다(E18·E19, 사용자 결정 Q4) |

#### 2.8.5 E17의 토큰 선택 규칙 (`optionalToken` — R-AUTH-003 개정 L3)

| 상황 | 결과 |
|---|---|
| `Authorization` 헤더 없음 | 익명 |
| 헤더가 있고 §2.3 검증 통과 | principal 있음(주인 판정 가능) |
| 헤더가 있으나 `TOKEN_REQUIRED`(꺼낼 수 없음, 예: `Basic …`) · `TOKEN_INVALID`(형식·서명·만료) · `LEVEL_TOO_LOW` 사유 | **삼키고 익명으로 본다.** `401`·`403 LEVEL_TOO_LOW`를 내지 않는다 |
| 그 밖의 오류(`CONFIG_INVALID`·`INTERNAL`) | 그대로 전파 |

- 그래서 E17 결과로 화면이 읽기 전용으로 전환되는 일은 없다(E17은 인증 3코드를 내지 않는다).
- 래퍼 `enterRoom`은 `auth: true`다 — 토큰이 있으면 쓰기 래퍼와 같은 getter로 `Bearer`를 붙이고, 없으면 헤더 없이 보낸다(§11.18). `X-Room-Key`는 붙이지 않는다(E17에는 관문이 없다).

---

## 3. 공통 응답·에러 코드

### 3.1 응답 형태

| 구분 | 형태 |
|---|---|
| 성공 | 엔드포인트별 본문(§4). `error` 키가 없다 |
| 실패 | `{ "error": { "code": ErrorCode, "message": string } }` + 코드의 HTTP status(§3.2) |
| Content-Type | `application/json`(`/embed` 정적 파일 제외) |
| `message` | 사용자에게 그대로 보여도 되는 **한국어 한 문장**. 내부 경로·SQL·스택·키 이름·제공사 원문 금지 |
| 코드↔status | **코드 1개 = status 1개.** 같은 코드가 다른 status로 나가면 결함 |
| `error`의 키 (S2) | 정확히 `code`·`message` 둘이다. **예외는 429 두 코드**(v0.4.1): `RATE_LIMITED`(다음 분 창까지 남은 초, R-AUTH-005)와 `LLM_BUDGET_EXCEEDED`(다음 달 1일 00:00 KST까지 남은 초, R-LLM-007)에는 `retryAfterSec`(정수 ≥ 1)가 더 붙고, 같은 값이 응답 헤더 `Retry-After`에도 실린다(server index.md §5.1). 그 밖의 코드에는 붙지 않는다 |
| 성공 본문 없음 (S2) | `DELETE` 두 개(E6·E11)는 `204 No Content`로 답하고 본문·`Content-Type`이 없다. 나머지 성공 응답은 전부 JSON 본문이 있다 |

```json
{ "error": { "code": "RATE_LIMITED", "message": "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", "retryAfterSec": 40 } }
```

```json
{ "error": { "code": "LLM_BUDGET_EXCEEDED", "message": "이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요.", "retryAfterSec": 2196000 } }
```

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "불러올 개수(limit)는 1~100 사이의 정수여야 합니다." } }
```

- 서버는 상황별 문구를 쓸 수 있다(예: `NOT_FOUND` → `방을 찾을 수 없습니다.`). `ERROR_MESSAGES`는 상황 문구가 없을 때 쓰는 **기본 문구**이자 화면의 폴백이다.
- 화면에 보일 문구는 화면의 `labels.ts`가 `code`로 정한다(R-CHAT-011, ts-rules 에러 처리). 서버 `message`는 참고값이다.
- (v0.4.1) **모르는 코드를 받은 옛 화면.** 14종째 코드를 모르는 화면 번들은 `LLM_BUDGET_EXCEEDED`를 §3.4 "모르는 코드" 행대로 `INTERNAL`(`ERROR_MESSAGES.INTERNAL`)로 정규화한다. 깨지거나 reject하지 않는다. 화면 번들은 같은 Worker의 Static Assets(`/embed`)로 서버와 함께 배포되므로, 이 상황은 배포 직전에 열어 둔 iframe에서만 생기고 새로 고치면 사라진다.

- (v0.5) 15종째 `OWNER_ONLY`도 같다. 다만 옛 화면 번들에는 설정 화면·E15 호출이 없어 이 코드를 받을 경로가 없다. 받더라도 §3.4대로 `INTERNAL`로 정규화된다.

- (v0.9) 16·17종째 `ROOM_LOCKED`·`ROOM_PASSWORD_WRONG`도 같다. 배포 직전에 열어 둔 옛 번들이 잠긴 방 요청에서 이 코드를 받으면 §3.4대로 `INTERNAL`로 정규화된다. 새로 고치면 사라진다.

### 3.2 에러 코드 17종 (R-API-002 🔒, 2026-10-06 개정 13→14→15 · (v0.9) 2026-10-08 개정 15→17 L2 — `shared/src/errors.ts`가 정본, 이 표는 전사)

| 코드 | status | 기본 message | 발생 조건 | 내는 곳 | 처음 쓰는 묶음 |
|---|---|---|---|---|---|
| `VALIDATION_ERROR` | 400 | 요청 형식이 올바르지 않습니다. | 경로·쿼리·본문 스키마 위반, 범위·정수 위반, 본문 JSON 파싱 실패 | routes `validate` · 서비스 · onError(HTTPException 400) | S1 |
| `TOKEN_REQUIRED` | 401 | 로그인한 회원만 사용할 수 있습니다. | 쓰기 요청에 토큰 없음(R-AUTH-003) | auth 미들웨어 | S2 |
| `TOKEN_INVALID` | 401 | 인증 정보가 올바르지 않거나 만료되었습니다. 페이지를 새로 고쳐 주세요. | 형식·서명·만료 실패(R-AUTH-002) | auth 미들웨어 | S2 |
| `LEVEL_TOO_LOW` | 403 | 대화에 참여할 수 있는 회원 등급이 아닙니다. | `level < TOKEN_MIN_LEVEL`(R-AUTH-002) | auth 미들웨어 | S2 |
| `RATE_LIMITED` | 429 | 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요. | `mb_id` 분당 쓰기 초과(R-AUTH-005) | 레이트리밋 미들웨어 | S2 |
| `NOT_FOUND` | 404 | 요청한 대상을 찾을 수 없습니다. | 없는 방·메시지, 매칭 없는 경로·메서드, `/embed` 파일 없음 | 서비스 · notFound · `/embed` | S1 |
| `SPEAK_IN_PROGRESS` | 409 | 이 방에서 이미 대사를 만들고 있습니다. 잠시 후 다시 시도해 주세요. | 방 생성 잠금 선점 실패 — 같은 방 speak·regenerate 진행 중(R-MSG-007) | messages.speak · regenerate | S3(v0.4 확정) |
| `NOT_LAST_MESSAGE` | 409 | 방의 마지막 메시지만 다시 생성할 수 있습니다. | 재작성 대상이 마지막 메시지가 아님 — 잠금을 잡은 뒤 판정(R-MSG-006) | messages.regenerate | S3(v0.4 확정) |
| `NOT_CHARACTER_MESSAGE` | 400 | 캐릭터 메시지만 다시 생성할 수 있습니다. | 재작성 대상이 유저 메시지(R-MSG-006) | messages.regenerate | S3(v0.4 확정) |
| `LLM_FAILED` | 502 | AI 응답을 받지 못했습니다. 다시 시도해 주세요. | 제공사 호출 최종 실패 — 네트워크·타임아웃·5xx는 1회 재시도 뒤, 429·그 밖 4xx·응답 형식 오류는 즉시, 재시도 예산 부족(R-LLM-005) | llm → messages가 그대로 전파 | S3(v0.4 확정) |
| `LLM_EMPTY` | 502 | AI 응답이 비어 있습니다. 다시 시도해 주세요. | 후처리 결과가 빈 문자열(R-LLM-004), 또는 제공사가 차단·후보 없음으로 답함(llm.md D-LLM-6) | llm → messages가 그대로 전파 | S3(v0.4 확정) |
| `LLM_BUDGET_EXCEEDED` | 429 | 이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요. | 이번 달(KST, 월 키 `YYYY-MM`) 추정 AI 비용 누적 ≥ `LLM_MONTHLY_BUDGET_KRW`(기본 100000원). speak·regenerate에서 **잠금 선점·제공사 호출 전**에 판정. 본문 `retryAfterSec` + 헤더 `Retry-After`(§3.1)(R-LLM-007) | llm `usage.ts`(`Llm.ensureBudget`) → messages가 그대로 전파 | S3b(v0.4.1 확정) |
| `CONFIG_INVALID` | 500 | 서버 설정이 올바르지 않습니다. 관리자에게 알려 주세요. | `parseEnv` 실패(모든 경로, `/embed`·health 포함). `LLM_API_KEY` 누락(speak·regenerate만)(R-ENV-003) | env · 부트스트랩 | S1 |
| `OWNER_ONLY` | 403 | 캐릭터 설정은 갠홈 주인만 열 수 있습니다. | 유효 토큰(등급 통과)이지만 `mbId ∉ OWNER_MB_IDS`, 또는 목록이 비어 있음. 설정 엔드포인트(E15·E16)에서만(R-SET-001) | auth `requireOwner` | S3c(v0.5 확정) |
| `ROOM_LOCKED` | 403 | 이 방은 비밀번호로 잠겨 있습니다. | ① 잠긴 방의 E5~E14·E18·E19에 유효한 입장 증명(`X-Room-Key`)이 없고 토큰 경로 주인도 아님(R-LOCK-006, §2.8.3) ② E17에 `password` 없이 온 비주인 요청(§4.19 판정 ④) | auth `requireRoomEntry` → rooms `assertEntry` · rooms `enter` | S6(v0.9 확정) |
| `ROOM_PASSWORD_WRONG` | 403 | 비밀번호가 맞지 않습니다. | E17 비밀번호 불일치(입장 시도 계수 뒤, §4.19 판정 ⑥). **E17에서만**(R-LOCK-004) | rooms `enter` | S6(v0.9 확정) |
| `INTERNAL` | 500 | 서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. | 그 밖의 예상 못 한 오류(D1 장애 등) | onError | S1 |

- (v0.9) 16·17종째 `ROOM_LOCKED`·`ROOM_PASSWORD_WRONG`은 R-API-002 개정 L2(2026-10-08 승인 ①)로 더했다. 순서는 `OWNER_ONLY` 다음·`INTERNAL` 앞이다. 둘 다 403이고 서버는 기본 문구만 보낸다(판정 이유·해시·증명을 드러내지 않는다). **`ui/src/api/client.ts`의 `AUTH_FAILURE_CODES`(= `isAuthFailure` 3코드)에 넣지 않는다** — 잠긴 방은 회원 권한 상실이 아니므로 읽기 전용 전환 대상이 아니다(§2.4 「그 밖의 에러」 행, s6-02 D-S6-9). 401을 쓰지 않는 이유도 같다(401은 토큰 실패 전용으로 화면이 전환에 쓴다). 화면 처리: `ROOM_LOCKED` → 그 방 증명 삭제 → 입장 재요구, `ROOM_PASSWORD_WRONG` → 입장 시트 안 문구(ui 설계 몫).
- (v0.9) E17의 입장 시도 상한 초과는 새 코드가 아니라 **`RATE_LIMITED`(429) 재사용**이다. 상황 문구 `비밀번호를 너무 자주 입력했습니다. 잠시 후 다시 시도해 주세요.` + `retryAfterSec` + `Retry-After`(§6.2). ui/api는 지금처럼 `RATE_LIMITED`의 `retryAfterSec`를 싣는다(§3.4). §3.4 표의 "15종"은 v0.9부터 17종으로 읽는다(`isErrorCode`가 shared를 따른다). 15종의 status·문구는 바뀌지 않았다.
- (v0.5) 15종째 `OWNER_ONLY`는 R-API-002 개정(2026-10-06 사용자 승인, R-SET-001)으로 더했다. 순서는 요구 나열대로 `CONFIG_INVALID` 다음·`INTERNAL` 앞이다. 서버는 기본 문구만 보낸다(판정 이유·목록을 드러내지 않음). `LEVEL_TOO_LOW`를 재사용하지 않는 이유: 그 코드는 화면 공통 규칙에서 "쓰기 권한 상실 → 읽기 전용 전환"이라, 주인이 아닌 등급 회원이 판정 한 번에 쓰기 UI를 잃게 된다. **`ui/src/api/client.ts`의 `AUTH_FAILURE_CODES`에 넣지 않는다** — 넣으면 주인 판정 탐침(R-SET-010)이 모든 등급 회원을 읽기 전용으로 떨어뜨린다. 14종의 status·문구는 바뀌지 않았다.
- 13종은 S1에 한 번에 확정한다. S2~S4의 기본 문구는 착수 시 다듬을 수 있다(문구 변경 = 비파괴).
- (v0.4.1) 14종째 `LLM_BUDGET_EXCEEDED`는 R-API-002 개정(2026-10-06 사용자 승인, R-LLM-007)으로 더했다. 문구는 요구 원문 그대로이고 서버는 상황 문구 없이 기본 문구만 보낸다(llm.md §12.10). 내는 엔드포인트는 E9·E12뿐이다. 읽기·방 쓰기·유저 발화·수정·삭제는 이 코드를 내지 않는다. 13종의 status·문구는 바뀌지 않았다.
- (v0.4) S3 5코드의 문구는 v0.1 기본 문구를 **그대로 확정**한다. 다섯 문구 모두 화면이 그대로 띄울 수 있는 한 문장이고 제공사 이름·HTTP 상태·차단 사유·키 이름이 없다(R-LLM-005). 서버는 이 다섯 코드에 상황 문구를 쓰지 않고 기본 문구만 보낸다(llm.md §5, messages.md §5).
- `CONFIG_INVALID`·`INTERNAL`·`VALIDATION_ERROR` 기본 문구는 server env.md §5와 index.md §5.1의 문구와 같다.

### 3.3 클라이언트 전용 코드 `NETWORK`

- 서버가 내지 않으므로 `ErrorCode`에 넣지 않는다. `ui/src/api/client.ts`의 `ApiErrorCode = ErrorCode | 'NETWORK'`에만 있다.
- 문구: `서버에 연결할 수 없습니다.`(ts-rules 에러 처리와 같다).

### 3.4 화면 쪽 정규화 규칙 (`ui/src/api/client.ts`)

| 상황 | `Result` |
|---|---|
| 2xx + JSON 본문 | `{ ok: true, value: 본문 }` |
| `204`(S2, 본문 없음) | `{ ok: true, value: undefined }` — 본문을 읽지 않는다. `DELETE` 래퍼만 `Result<void>`로 받는다 |
| 2xx(204 제외) + 본문이 JSON이 아님 | `{ ok: false, error: { code: 'INTERNAL', message: ERROR_MESSAGES.INTERNAL } }` |
| 4xx·5xx + 계약 형식 본문(`code`가 15종(v0.5), `message`가 빈 문자열이 아님) | `{ ok: false, error: { code, message } }`(본문 값 그대로) |
| (S2) 위 경우 + `code === 'RATE_LIMITED'` + `retryAfterSec`가 1 이상 정수 | `error`에 `retryAfterSec`를 함께 싣는다. 값이 없거나 형식이 틀리면 키를 빼고, 다른 코드에 붙어 오면 버린다. (v0.4.1) `LLM_BUDGET_EXCEEDED`에 붙어 온 값도 **버린다**(아래 429 구분). `Retry-After` 헤더는 읽지 않는다(본문이 단일 소스) |
| 4xx·5xx + `code`는 15종인데 `message`가 없거나 비어 있음 | `{ code, message: ERROR_MESSAGES[code] }` |
| 4xx·5xx + 계약 형식이 아님(HTML 오류 페이지, 모르는 코드) | `{ code: 'INTERNAL', message: ERROR_MESSAGES.INTERNAL }`. (v0.5) `OWNER_ONLY`를 모르는 옛 번들도 이 행으로 `INTERNAL`이 된다 |
| `fetch` 자체 실패(오프라인·DNS·연결 거부) | `{ code: 'NETWORK', message: '서버에 연결할 수 없습니다.' }` |

- 래퍼는 **어떤 경우에도 throw·reject하지 않는다.** 화면은 `result.ok` 분기만 쓰고 `try/catch`를 쓰지 않는다.
- (v0.4) **요청 타임아웃은 없다.** `request`는 `AbortSignal`·타이머를 쓰지 않고 응답이 올 때까지 기다린다. speak·regenerate는 서버가 70초 안에 성공·실패로 끝내므로(R-NFR-001) 화면은 서버 종결에 의존한다. 나중에 타임아웃을 넣으면 두 호출은 **75초 이상**이어야 한다(§4.12).

429 두 종류 구분 (v0.4.1 — R-CHAT-011 · R-LLM-007):

| 코드 | 뜻 | 서버 본문 `retryAfterSec` | ui/api `ApiError.retryAfterSec` | 화면 처리 |
|---|---|---|---|---|
| `RATE_LIMITED` | 이 회원(`mb_id`)이 1분에 너무 많이 썼다 | 1~60초 | 싣는다 | "잠시 후" 안내. 자동 재시도 없음(§6.1) |
| `LLM_BUDGET_EXCEEDED` | 서버 전체가 이번 달 AI 비용 한도에 닿았다 | 1초~최대 2678400초(31일) | **싣지 않는다** | 실패 말풍선 + 한도 문구. 「재시도」를 눌러도 다음 달 전에는 같은 429다. **카운트다운·자동 재시도 금지** |

- 둘은 status가 같으므로 **`code`로 구분한다.** status 429만 보고 분기하면 결함이다.
- 래퍼가 `LLM_BUDGET_EXCEEDED`의 `retryAfterSec`를 버리는 이유: 화면에서 이 값을 쓸 곳은 카운트다운·자동 재시도뿐인데 둘 다 금지다. 래퍼에서 버리면 화면이 잘못 쓸 수 없다. 해제 날짜 안내가 요구되면 ui 요구로 올리고 `toRetryAfter` 허용 코드를 넓힌다(선택 필드라 비파괴).
- `isAuthFailure`는 두 코드 모두 `false`다. 읽기 전용 전환 대상이 아니다.

### 3.5 에러 변환 위치

- 라우트와 서비스는 `AppError`를 throw만 한다. 응답 본문은 server 진입점의 `onError` 한 곳이 `{ error: { code, message } }`로 만든다(index.md §5.1).
- zod 검증 실패는 라우트의 `validate` 훅이 `AppError('VALIDATION_ERROR', 400, ERROR_MESSAGES.VALIDATION_ERROR)`를 throw한다(§11.2). zod-validator 기본 실패 응답은 계약 형식이 아니라서 쓰지 않는다.
- 매칭 없는 경로와 메서드는 `notFound`가 `404 NOT_FOUND`(`요청한 주소를 찾을 수 없습니다.`)로 닫는다. S1 시점에 `POST /api/rooms` 같은 미구현 쓰기 경로도 이 응답이다.
- (S2) `GET /api/rooms/:id`·`PUT /api/rooms/:id`·`GET /api/messages/:id`처럼 경로는 있으나 메서드가 등록되지 않은 요청도 `404 NOT_FOUND`다(405를 쓰지 않는다). S4 경로(memory)는 그 묶음 전까지 이 응답이다((v0.7) 구현 뒤에도 `POST`·`PATCH`·`DELETE /api/rooms/:id/memory`는 `404`다). (v0.4) S3 경로도 구현 전까지는 `404`이고, 구현 뒤에도 `GET`·`PUT /api/rooms/:id/speak`, `GET /api/messages/:id/regenerate`처럼 POST가 아닌 메서드는 `404`다.
- (S2) `RATE_LIMITED`의 `retryAfterSec`·`Retry-After`도 `onError`가 `AppError`의 선택 필드에서 옮긴다. 라우트·미들웨어는 헤더를 만들지 않는다(server index.md D-IDX-11). (v0.4.1) `LLM_BUDGET_EXCEEDED`도 같은 경로다 — 서비스가 `new AppError('LLM_BUDGET_EXCEEDED', undefined, { retryAfterSec })`를 throw하고 `onError`가 옮긴다. `onError`는 코드 종류를 보지 않으므로 server 진입점 코드는 바뀌지 않는다(index.md §2.4 S3b · SRV-T-233).
- (S2) 본문 JSON이 깨졌으면 Hono가 `HTTPException(400)`을 던지고 `onError`가 `400 VALIDATION_ERROR`(기본 문구)로 바꾼다. `Content-Type`이 JSON이 아니면 본문을 `{}`로 보고 zod가 실패해 같은 `400`이 나간다(hono 4.13 validator 동작).

---

## 4. 엔드포인트별 명세

### 4.0 전체 엔드포인트 (R-API-001 🔒 — 이 밖의 엔드포인트는 만들지 않는다)

| # | 메서드·경로 | 토큰 | 역할 | 묶음 | 상태 | 요구ID | 상세 |
|---|---|---|---|---|---|---|---|
| E1 | `GET /embed` · `GET /embed?t=` | ✕ | 화면(정적 파일) | S1 | **확정** | R-API-006 · R-API-001 | §4.4 · §7 |
| E2 | `GET /api/health` | ✕ | 상태 | S1 | **확정** | R-API-005 | §4.1 |
| E3 | `GET /api/rooms` | ✕ | 방 목록 | S1 | **확정** | R-ROOM-001 | §4.2 |
| E4 | `POST /api/rooms` | ○ | 방 생성 | S2 | **확정** | R-ROOM-002 | §4.6 |
| E5 | `PATCH /api/rooms/:id` | ○ | 방 이름 변경 | S2 | **확정** | R-ROOM-003 | §4.7 |
| E6 | `DELETE /api/rooms/:id` | ○ | 방 삭제 | S2 | **확정** | R-ROOM-004 | §4.8 |
| E7 | `GET /api/rooms/:id/messages?before&limit` | ✕ | 히스토리 한 페이지 | S1 | **확정** | R-MSG-001 | §4.3 |
| E8 | `POST /api/rooms/:id/user` | ○ | 유저 발화·지시 저장(AI 호출 없음) | S2 | **확정** | R-MSG-002 | §4.9 |
| E9 | `POST /api/rooms/:id/speak` | ○ | 해당 캐릭터 1턴 생성 | S3 | **확정**(구현 전) | R-MSG-003 · R-MSG-007 | §4.12 · §4.13 |
| E10 | `PATCH /api/messages/:id` | ○ | 메시지 수정 | S2 | **확정** | R-MSG-004 · R-MSG-008 | §4.10 |
| E11 | `DELETE /api/messages/:id` | ○ | 메시지 삭제 | S2 | **확정** | R-MSG-005 · R-MSG-008 | §4.11 |
| E12 | `POST /api/messages/:id/regenerate` | ○ | 같은 캐릭터로 재생성 | S3 | **확정**(구현 전) | R-MSG-006 · R-MSG-007 | §4.12 · §4.14 |
| E13 | `GET /api/rooms/:id/memory` | ○ | 장기기억 보기 | S4 | **확정**(구현 전, v0.7) | R-MEM-001 · R-AUTH-003 | §4.17 |
| E14 | `PUT /api/rooms/:id/memory` | ○ | 장기기억 편집 | S4 | **확정**(구현 전, v0.7) | R-MEM-001 · R-AUTH-005 | §4.18 |
| E15 | `GET /api/settings/characters` | ○ + 주인 | 캐릭터 설정 읽기(주인 판정 탐침 겸용) | S3c | **확정**(구현 전) | R-SET-004 · R-SET-001 · R-AUTH-003 | §2.7 · §4.15 |
| E16 | `PUT /api/settings/characters` | ○ + 주인 | 캐릭터 설정 전체 교체 저장 | S3c | **확정**(구현 전) | R-SET-005 · R-SET-001 · R-SET-002 | §2.7 · §4.16 |
| E17 | `POST /api/rooms/:id/enter` | △ 선택 | 방 입장 — 비밀번호 확인(주인은 생략) → 입장 증명 | S6 | **확정**(구현 전, v0.9) | R-LOCK-004 · R-LOCK-005 · R-LOCK-008 · R-AUTH-003(L3) | §2.8 · §4.19 · §6.2 |
| E18 | `PUT /api/rooms/:id/password` | ○ + 관문 | 잠금 설정·비밀번호 변경 | S6 | **확정**(구현 전, v0.9) | R-LOCK-002 · R-LOCK-005 · R-LOCK-006 | §2.8 · §4.20 |
| E19 | `DELETE /api/rooms/:id/password` | ○ + 관문 | 잠금 해제 | S6 | **확정**(구현 전, v0.9) | R-LOCK-002 · R-LOCK-005 · R-LOCK-006 | §2.8 · §4.21 |

- (v0.9) 엔드포인트는 **19개**다(R-API-001 개정 L1, 2026-10-08 승인 ①). E18·E19는 경로 하나를 두 메서드가 쓴다(`PATHS.roomPassword`). E17은 `PATHS.roomEnter` POST 하나다. 그 밖 메서드(`GET /api/rooms/:id/password`·`GET`·`PUT /api/rooms/:id/enter` 등)는 `404 NOT_FOUND`다(§3.5). 기존 행의 S6 변화: E3·E4·E5 응답에 `locked`(§4.2·§4.6), E4 본문 `password?`·응답 `entryKey`(§4.6), E5~E14 잠긴 방 관문(§2.8.3). 비밀번호 확인·잠금 상태 조회 전용 엔드포인트는 없다(상태는 E3 `locked`).
- (v0.5) 엔드포인트는 **16개**다(R-API-001 2026-10-06 개정). E15·E16은 경로 하나를 두 메서드가 쓴다(`PATHS.characterSettings`). 내보내기·가져오기·시드 복원·주인 여부 조회 엔드포인트는 없다 — 내보내기·가져오기는 화면이 E15 응답과 E16 요청으로 처리한다(§16).

- **방 단건 조회(`GET /api/rooms/:id`)는 없다.** 대화 화면 상단 바의 방 제목·생성일(R-CHAT-001)은 `listRooms()` 결과에서 찾는다. 마지막 본 방 복원(R-ROOMS-004)도 `listRooms()`를 먼저 부른 뒤 id로 찾는다.
- (v0.7) S4 행(E13·E14)을 확정했다(§4.17·§4.18). 두 행은 v0.1부터 표에 있었으므로 엔드포인트 수는 16개 그대로다(R-API-001 불변). 경로 하나를 두 메서드가 쓴다(`PATHS.roomMemory` — GET E13 · PUT E14). (v0.4) S3 행(E9·E12)은 확정했다.
- 같은 경로 패턴을 여러 메서드가 쓴다: `PATHS.rooms`(GET E3 · POST E4), `PATHS.room`(PATCH E5 · DELETE E6), `PATHS.message`(PATCH E10 · DELETE E11). (v0.4) E9·E12는 경로마다 메서드가 하나다(`PATHS.roomSpeak` POST · `PATHS.messageRegenerate` POST).

### 4.1 `GET /api/health` (E2)

| 항목 | 값 |
|---|---|
| 토큰 | ✕ |
| 요청 | 경로·쿼리·본문 없음(쿼리가 있어도 무시) |
| 성공 | `200` · `HealthResponse` = `{ ok: true, version: string }` |
| 에러 | `500 CONFIG_INVALID`(부트스트랩) · `500 INTERNAL` |
| 부수 효과 | 없음. **DB에 접근하지 않는다**(R-API-005) |
| 레이트리밋 | 없음 |
| server | `c.get('services').getHealth(): HealthStatus`(index.md §2.3) |
| 요구ID | R-API-005 |
| 테스트 | API-T-001 · 002 · 003 |

```json
{ "ok": true, "version": "0.1.0" }
```

- `version`은 `server/package.json`의 `version`이다(index.md D-IDX-8). `/deploy` 헬스체크 대상이다.
- 부트스트랩이 health에도 적용되므로 Secrets 누락은 배포 직후 health가 `500 CONFIG_INVALID`로 알려 준다(index.md D-IDX-3).

### 4.2 `GET /api/rooms` (E3)

| 항목 | 값 |
|---|---|
| 토큰 | ✕(헤더가 있어도 무시, §2.1) |
| 요청 | 경로·쿼리·본문 없음(쿼리가 있어도 무시) |
| 성공 | `200` · `RoomSummary[]`(배열 그대로, 감싸지 않음). `updatedAt` 내림차순, 같으면 `id` 오름차순. 방이 없으면 `[]` |
| 에러 | `500 CONFIG_INVALID` · `500 INTERNAL`(D1 장애) |
| 부수 효과 | 없음 |
| 레이트리밋 | 없음 |
| 페이지네이션 | 없음(요구 없음) |
| server | `c.get('services').rooms.listRooms(): Promise<RoomSummary[]>`(rooms.md §2.1) |
| 요구ID | R-ROOM-001 · R-ROOMS-001 · R-AUTH-003(읽기) |
| 테스트 | API-T-010 ~ 014 · (v0.9) API-T-140 |
| 잠금 표시 (S6, v0.9) | 행마다 `locked: boolean`(필수) — 비밀번호가 걸린 방이면 `true`(R-LOCK-003). 비밀번호·해시·증명은 응답에 없다(R-LOCK-007). 잠긴 방도 다른 키(`title`·`createdAt`·`updatedAt`·`messageCount`)가 그대로 나가고 정렬도 같다. **잠긴 방의 날짜 숨김은 화면 표시 규칙**이다(사용자 결정 2026-10-08 — 응답은 `locked`만 더한다, 비파괴). 관문 없음(목록은 누구나) |

```json
[
  { "id": "00000000-0000-4000-8000-000000000001", "title": "안개 낀 런던의 아침", "createdAt": 1767225600000, "updatedAt": 1767229800000, "messageCount": 70, "locked": false },
  { "id": "00000000-0000-4000-8000-000000000002", "title": "팬텀하이브 저택의 저녁", "createdAt": 1767225600000, "updatedAt": 1767226800000, "messageCount": 2, "locked": true },
  { "id": "00000000-0000-4000-8000-000000000003", "title": "아직 아무도 없는 방", "createdAt": 1767225600000, "updatedAt": 1767225600000, "messageCount": 0, "locked": false }
]
```

- (v0.9) `RoomSummary`를 돌려주는 모든 응답(E3·E4·E5·E18의 `room`·E19)에 `locked`가 있다. §4.7 예시는 v0.9 이전 형태라 `locked` 키를 생략해 적었다 — 실제 응답에는 있다(§4.6 예시는 v0.9 형태).

- 정렬은 서버가 보장한다. 화면은 다시 정렬하지 않는다.
- 방 목록 행의 날짜는 `updatedAt`(R-ROOMS-001), 대화 화면 상단 날짜는 `createdAt`(R-CHAT-001)이다.

### 4.3 `GET /api/rooms/:id/messages?before&limit` (E7)

| 항목 | 값 |
|---|---|
| 토큰 | ✕(헤더가 있어도 무시, §2.1) |
| 입장 관문 (S6, v0.9) | 잠긴 방이면 요청 헤더 `X-Room-Key`가 그 방의 현재 입장 증명이어야 한다(§2.8). 순서 `validate('param')` → ★`requireRoomEntry('room')` → `validate('query')` → 핸들러. 증명 없음·무효 → `403 ROOM_LOCKED`(기본 문구) — 잘못된 쿼리(`limit=0`)여도 `403`이 먼저다. 토큰은 여전히 보지 않는다(주인도 증명으로, §2.8.4). 안 잠긴 방은 헤더 유무와 관계없이 지금과 같고, 없는 방은 관문을 통과해 아래 검사 순서대로 `400`/`404`다. 요구 R-LOCK-006 · R-MSG-001 개정 L7. 테스트 API-T-159 · 160 · 161 |
| 경로 | `id: string` — 방 id 문자열 그대로(1자 이상). 형식(UUID) 검사는 하지 않고 없으면 `404` |
| 쿼리 | `before?: number` · `limit?: number`(아래 규칙) |
| 본문 | 없음 |
| 성공 | `200` · `MessagesPage` = `{ messages: Message[], hasMore: boolean }` |
| 에러 | 아래 표 |
| 부수 효과 | 없음 |
| 레이트리밋 | 없음 |
| server | `c.get('services').messages.listMessages(roomId: string, query: MessagePageQuery): Promise<MessagePage>`(messages.md §2.1) |
| 요구ID | R-MSG-001 · R-CHAT-003 · R-API-004 · R-AUTH-003(읽기) |
| 테스트 | API-T-020 ~ 024, API-T-030 ~ 034 |

쿼리·페이지 규칙(messages.md §2.1 페이지 규칙과 같다):

| 규칙 | 값 |
|---|---|
| 쿼리 변환 | 라우트는 문자열을 `Number()`로만 바꾼다. 키가 없거나 값이 빈 문자열(공백만 포함)이면 **생략**으로 본다(`?before=&limit=` = 쿼리 없음) |
| 같은 키 반복(`?limit=1&limit=2`) | 라우트 zod가 거절 → `400 VALIDATION_ERROR`(기본 문구) |
| `limit` 생략 | **30** |
| `limit` 허용 | 정수 **1~100**. 넘으면 잘라 주지 않고 `400`(messages.md D-MSG-2) |
| `before` 생략 | 가장 최신부터 |
| `before` 의미 | `id < before`인 메시지만(엄격히 작음). 메시지 id 커서 |
| `before` 허용 | 1 이상 안전 정수(`Number.isSafeInteger`) |
| 정렬 | `messages`는 id 오름차순(오래된 → 새) |
| `hasMore` | 이 페이지보다 더 오래된 메시지가 있으면 `true` |
| 다음(더 오래된) 페이지 | `hasMore === true`이면 `before = messages[0].id`로 다시 부른다. 별도 커서 필드는 없다 |
| 빈 방 | `{ "messages": [], "hasMore": false }` |
| 검사 순서 | zod 형태 → `limit`·`before` 범위(서비스) → 방 존재 → 페이지. 그래서 없는 방에 `limit=0`을 보내면 `404`가 아니라 `400`이다 |

에러:

| 코드 | status | message | 조건 |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | 불러올 개수(limit)는 1~100 사이의 정수여야 합니다. | `limit`이 1~100 정수가 아님(`0`·`101`·`1.5`·`abc`) |
| `VALIDATION_ERROR` | 400 | 기준 메시지 번호(before)가 올바르지 않습니다. | `before`가 1 이상 안전 정수가 아님(`0`·`-1`·`abc`·`2^53`) |
| `VALIDATION_ERROR` | 400 | 요청 형식이 올바르지 않습니다. | 같은 쿼리 키 반복 등 zod 형태 위반 |
| `NOT_FOUND` | 404 | 방을 찾을 수 없습니다. | 없는 방(삭제된 방 포함) |
| `CONFIG_INVALID` | 500 | 서버 설정이 올바르지 않습니다. 관리자에게 알려 주세요. | 부트스트랩 |
| `INTERNAL` | 500 | 서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. | D1 장애 등 |

- `limit`과 `before`가 둘 다 틀리면 서비스 검사 순서(`normalizePageQuery`)의 첫 위반 문구가 나간다.

응답 예시(시드 방 1의 첫 페이지 30건 중 앞 4건만 보인다. id 값은 설명용이다):

```json
{
  "messages": [
    { "id": 41, "roomId": "00000000-0000-4000-8000-000000000001", "speaker": "sebastian", "kind": "line", "text": "도련님, 홍차를 준비해 두었습니다. (41)", "authorName": null, "createdAt": 1767228060000 },
    { "id": 42, "roomId": "00000000-0000-4000-8000-000000000001", "speaker": "ciel", "kind": "line", "text": "늦었군, 세바스찬. 오늘 일정부터 말해. (42)", "authorName": null, "createdAt": 1767228120000 },
    { "id": 43, "roomId": "00000000-0000-4000-8000-000000000001", "speaker": "user", "kind": "line", "text": "창밖으로 안개가 한층 짙어진다. (43)", "authorName": "어떠한 의지", "createdAt": 1767228180000 },
    { "id": 44, "roomId": "00000000-0000-4000-8000-000000000001", "speaker": "user", "kind": "ooc", "text": "분위기를 조금 더 어둡게 이어 가 줘. (44)", "authorName": "어떠한 의지", "createdAt": 1767228240000 }
  ],
  "hasMore": true
}
```

- 응답에 `authorMbId`(그누보드 로그인 id)는 **없다**(db.md D-DB-5, 공개 응답 노출 방지).
- (v0.6, S3d — R-AUTH-004 · R-CHAT-002) `authorName` 값 규칙: `speaker === 'user'`(`kind` `line`·`ooc` 모두)이면 **항상 `USER_DISPLAY_NAME`**(`"어떠한 의지"`, §5.5), 캐릭터 메시지는 `null`. D1 `author_name`에 저장된 실명은 응답에 없다. S3d 이전에 쌓인 메시지도 같은 규칙으로 나간다(서버 `db/messages.ts` `toMessage` 투영 — db.md S3d 절). 타입은 그대로 `string | null`이다. 이 규칙은 `Message`를 돌려주는 모든 엔드포인트(E7·E8·E9·E10·E12)에 같다.

### 4.4 `GET /embed` (E1) — server 진입점 소유

| 항목 | 값 |
|---|---|
| 처리 주체 | server `app.ts`의 `/embed` 처리(index.md §3.2). **routes에 정의하지 않는다** |
| 토큰 | ✕ |
| 요청 | `GET /embed` · `GET /embed/` · `GET /embed?t=<토큰>` → 화면 `index.html`. `GET /embed/<파일>` → 빌드 산출물(JS·CSS·폰트·이미지) |
| `?t=` | 서버는 **읽지 않고 통과**시킨다. `ASSETS`에 넘길 때 쿼리를 떼고, 요청 로그에도 쿼리를 남기지 않는다(R-AUTH-006). 화면 JS가 읽는다(S2) |
| 성공 | `200` · `text/html`(또는 파일 MIME) |
| 헤더 | `Content-Security-Policy: frame-ancestors <ALLOWED_FRAME_ANCESTORS>`. `X-Frame-Options` 없음(§7) |
| 에러 | `404 NOT_FOUND`(파일 없음, JSON 본문) · `500 CONFIG_INVALID`(이때 CSP는 `frame-ancestors 'none'`) |
| 부수 효과 | 없음 |
| 경로 상수 | `PATHS.embed`(shared) — server `app.ts`가 import한다 |
| 요구ID | R-API-006 · R-API-001 · R-AUTH-006 |
| 테스트 | server SRV-T-080 · 086 · 088, contract API-T-004 · 005 |

- `/embed` 아래에 클라이언트 라우팅은 없다(SPA 단일 화면). `/embed/<경로>`는 정적 파일만 뜻한다.

### 4.5 쓰기 공통 규칙 (S2 — E4 · E5 · E6 · E8 · E10 · E11)

| 항목 | 값 |
|---|---|
| 토큰 | ○ — `Authorization: Bearer <t>`(§2.2) |
| 처리 순서 | 부트스트랩(server) → `requireToken` → `rateLimitWrites` → `validate('param')` → `validate('json')` → 핸들러 → 서비스 |
| 요청 본문 | `Content-Type: application/json`인 JSON 객체. 모르는 키는 버린다. zod는 **타입만** 본다. trim·길이(코드 포인트)·범위 판정은 서비스가 단일 소스다(rooms.md §9, messages.md §9, D-MSG-4) |
| 방 id(`:id`, E5·E6·E8) | 문자열 그대로(`roomIdParam`, §4.3과 같다). 형식 검사 없이 없으면 `404` |
| 메시지 id(`:id`, E10·E11) | 10진 숫자로만 된 문자열이면 `Number()`로, 아니면 `NaN`으로 바꿔 서비스에 넘긴다(`messageIdParam`). 서비스가 1 이상 안전 정수가 아니면 DB 전에 `404`로 닫는다. 그래서 `abc`·`1.5`·`0x10`·`1e1`·`0`은 전부 `404`다 |
| 레이트리밋 | 요청 1건 = 1회 소모(§6). 인증을 통과한 뒤 세므로 `400`·`404`로 끝난 요청도 센다. `401`·`403`은 세지 않는다 |
| 성공 응답 | 생성(E4·E8) `201` + 만든 자원 · 변경(E5·E10) `200` + 바뀐 자원 · 삭제(E6·E11) `204` 본문 없음 |
| 응답 필드 | §5.1 규칙. `Message`에 `authorMbId`는 쓰기 응답에도 없다 |
| 권한 | 등급 통과자 **누구나**. 작성자·방 생성자 검사 없음(R-ROOM-003·004 · R-MSG-008, 확정사항 §9-5 기본값) |

공통 에러(엔드포인트별 표에는 이 표 밖의 것만 적는다):

| 코드 | status | message | 조건 | 판정 위치 |
|---|---|---|---|---|
| `CONFIG_INVALID` | 500 | 기본 문구 | 설정 오류(가장 먼저) | server 부트스트랩 |
| `TOKEN_REQUIRED` | 401 | 기본 문구 | Bearer 토큰을 꺼낼 수 없음(§2.2) | `requireToken` |
| `TOKEN_INVALID` | 401 | 기본 문구 | 형식·서명·payload·만료 실패(§2.3) | `requireToken` |
| `LEVEL_TOO_LOW` | 403 | 기본 문구 | `level < TOKEN_MIN_LEVEL` | `requireToken` |
| `RATE_LIMITED` | 429 | 기본 문구 + `retryAfterSec` + `Retry-After` 헤더 | `mb_id` 분 창 한도 초과(§6) | `rateLimitWrites` |
| `VALIDATION_ERROR` | 400 | `요청 형식이 올바르지 않습니다.` | 본문 JSON 깨짐 · `Content-Type`이 JSON 아님 · 필수 키 없음 · 타입 틀림 | `validate` · onError(HTTPException 400) |
| `ROOM_LOCKED` | 403 | 기본 문구 | (v0.9) 잠긴 방인데 입장 증명 없음·무효이고 토큰 주인도 아님(§2.8.3). 방·메시지 대상 쓰기(E5·E6·E8~E12·E14·E18·E19)와 E13에서. E4는 해당 없음 | `requireRoomEntry` |
| `INTERNAL` | 500 | 기본 문구 | D1 장애 등 | onError |

- (v0.9, S6 — R-LOCK-006 · R-ROOM-003·004 개정 L6 · R-MSG-002·004·005·006·003 · R-MEM-001 개정 L7) 방·메시지 대상 쓰기 경로는 `validate('param')` 바로 뒤에 입장 관문 ★`requireRoomEntry`가 붙는다. **경로별 처리 순서의 정본은 §2.8.3 표**이고, 이 절·§4.12·§4.17·§4.18의 「처리 순서」 행은 그 자리에 ★을 끼워 읽는다. `ROOM_LOCKED`는 위 공통 에러 1행으로 갈음하고 엔드포인트별 표에 다시 적지 않는다. 쓰기 경로의 `403 ROOM_LOCKED`도 레이트리밋 1회다(관문이 `rateLimitWrites` 뒤). 서비스 시그니처·성공 응답은 바뀌지 않는다(E5 응답 `RoomSummary`에 `locked` 추가만).
- (v0.9) 권한 행 보충: 안 잠긴 방은 지금처럼 등급 통과자 누구나다. **잠긴 방은 주인 또는 그 방 증명 보유자만** 쓰고 바꾸고 지울 수 있다(사용자 결정 2026-10-08, s6-02 D-S6-14).

### 4.6 `POST /api/rooms` (E4) — 방 생성

| 항목 | 값 |
|---|---|
| 토큰 | ○ |
| 경로·쿼리 | 없음 |
| 본문 | `CreateRoomBody` = `{ title: string; password?: string }`. (v0.9) `password`는 **선택** — 키가 있으면 코드 포인트 `ROOM_PASSWORD_MIN`~`ROOM_PASSWORD_MAX`(4~32, `Array.from(s).length`), trim·정규화 없음, 문자 제한 없음, **빈 문자열도 위반**. zod는 타입(문자열)만 보고 길이는 서비스가 판정한다(제목과 같은 원칙). 검사 순서 제목 → 비밀번호(둘 다 DB 전) |
| 성공 | `201` · (v0.9) `CreateRoomResponse` = `RoomSummary & { entryKey: string \| null }`. `title`은 trim한 값, `id`는 UUID v4, `createdAt === updatedAt ===` 서버 시각, `messageCount: 0`, `locked` = 비밀번호를 걸었으면 `true`. `entryKey` = 비밀번호를 걸었으면 이 방의 입장 증명(§2.8 — 만든 사람의 브라우저는 다시 묻지 않는다), 아니면 `null` |
| 에러 | 공통(§4.5) + 아래 |
| 부수 효과 | `rooms` 1행. `updatedAt`이 최신이라 `GET /api/rooms` 맨 위에 온다. (v0.9) 비밀번호가 있으면 해시를 **같은 INSERT 한 문장**에 넣는다 — 잠기지 않은 채 잠깐 존재하는 틈이 없다(R-LOCK-001 원자) |
| 레이트리밋 | 1회(회원 쓰기 한도. 입장 시도 상한 §6.2와 무관) |
| 관문 | 없음(새 방) |
| server | `c.get('services').rooms.createRoom(input: CreateRoomBody): Promise<CreateRoomResponse>`(s6-03 §1.2 — v0.9 이전 `RoomTitleInput → RoomSummary`) |
| 요구ID | R-ROOM-002(L5) · R-ROOMS-002 · R-AUTH-003 · R-AUTH-005 · (v0.9) R-LOCK-001 · R-LOCK-007 |
| 테스트 | API-T-050 ~ 055 · 057 · 058 · (v0.9) 141 ~ 143 |

| 코드 | status | message | 조건 |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | 방 제목은 1~60자로 입력해 주세요. | trim 후 코드 포인트 0자 또는 61자 이상(이모지 1개 = 1자). 비밀번호도 틀렸어도 이 문구가 먼저다 |
| `VALIDATION_ERROR` | 400 | 비밀번호는 4~32자로 입력해 주세요. | (v0.9) `password` 키가 있고 코드 포인트 3 이하(빈 문자열 포함) 또는 33 이상 |
| `VALIDATION_ERROR` | 400 | 요청 형식이 올바르지 않습니다. | (v0.9) `password`가 문자열이 아님(숫자·`null`) — zod 형태 위반 |

```json
{ "title": "  안개 낀 런던  " }
```

```json
{ "id": "6f1c2a0e-4b7d-4c1e-9a3f-2d5b8e7c1a90", "title": "안개 낀 런던", "createdAt": 1767225600000, "updatedAt": 1767225600000, "messageCount": 0, "locked": false, "entryKey": null }
```

(v0.9) 비밀번호를 건 생성 — 요청·응답(`entryKey`는 설명용 가짜 값, 실제 길이 46자):

```json
{ "title": "비밀 다과회", "password": "earl grey 7" }
```

```json
{ "id": "0b9d4c2e-7a1f-4e3b-8c5d-1f2e3a4b5c6d", "title": "비밀 다과회", "createdAt": 1767225600000, "updatedAt": 1767225600000, "messageCount": 0, "locked": true, "entryKey": "e1.Zm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9" }
```

- 화면은 응답의 `id`로 바로 대화 화면으로 간다(R-ROOMS-002). 목록은 응답을 앞에 끼워 넣거나 다시 불러온다(ui 설계 몫).

### 4.7 `PATCH /api/rooms/:id` (E5) — 방 이름 변경

| 항목 | 값 |
|---|---|
| 토큰 | ○ |
| 경로 | `id: string`(§4.5) |
| 본문 | `RenameRoomBody` = `{ title: string }` |
| 성공 | `200` · `RoomSummary`. `title`만 바뀐다. **`updatedAt`은 그대로**라 목록 순서가 바뀌지 않는다(R-ROOM-005 목록에 없음, rooms.md D-ROOM-4) |
| 에러 | 공통 + 아래 |
| 검사 순서 | 제목 규칙(DB 전) → 방 존재. 없는 방에 61자 제목을 보내면 `400`이다 |
| 부수 효과 | `rooms.title` 갱신 |
| 레이트리밋 | 1회 |
| 권한 | 등급 통과자 누구나(방을 만든 사람이 아니어도 된다) |
| server | `rooms.renameRoom(id: string, input: RoomTitleInput): Promise<RoomSummary>` |
| 요구ID | R-ROOM-003 · R-CHAT-001(⋯ 메뉴 이름 변경) |
| 테스트 | API-T-050 ~ 053 · 059 · 066 |

| 코드 | status | message | 조건 |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | 방 제목은 1~60자로 입력해 주세요. | E4와 같다 |
| `NOT_FOUND` | 404 | 방을 찾을 수 없습니다. | 없는 방(삭제된 방 포함) |

```json
{ "title": "팬텀하이브 저택의 밤" }
```

```json
{ "id": "00000000-0000-4000-8000-000000000002", "title": "팬텀하이브 저택의 밤", "createdAt": 1767225600000, "updatedAt": 1767226800000, "messageCount": 2 }
```

### 4.8 `DELETE /api/rooms/:id` (E6) — 방 삭제

| 항목 | 값 |
|---|---|
| 토큰 | ○ |
| 경로 | `id: string`(§4.5) |
| 본문 | 없음(보내도 읽지 않는다) |
| 성공 | `204` · 본문 없음 |
| 에러 | 공통 + `NOT_FOUND` 404 `방을 찾을 수 없습니다.`(없는 방, 이미 삭제한 방) |
| 부수 효과 | 그 방의 `memory`·`messages`·`rooms`를 한 batch로 **실삭제**(R-DB-003). 이후 `GET /api/rooms/:id/messages`는 `404`, 목록에서 빠진다 |
| 레이트리밋 | 1회 |
| 권한 | 등급 통과자 누구나 |
| 경합 | S3 speak 진행 중이어도 막지 않는다. speak 결과 저장은 `404`가 된다(rooms.md §11, S3 인계) |
| server | `rooms.deleteRoom(id: string): Promise<void>` |
| 요구ID | R-ROOM-004 · R-CHAT-001(⋯ 메뉴 방 삭제, confirm은 화면) |
| 테스트 | API-T-050 ~ 053 · 060 · 066 |

### 4.9 `POST /api/rooms/:id/user` (E8) — 유저 발화·지시 저장

| 항목 | 값 |
|---|---|
| 토큰 | ○ |
| 경로 | `id: string`(방 id, §4.5) |
| 본문 | `UserMessageBody` = `{ text: string, ooc: boolean }`. **`ooc`는 필수**다(기본값 없음 — 화면의 OOC 토글 값을 항상 보낸다) |
| 성공 | `201` · `Message`. `speaker: 'user'`, `kind: ooc ? 'ooc' : 'line'`, `text`는 앞뒤 trim(중간 줄바꿈 유지), (v0.6) `authorName` = **`USER_DISPLAY_NAME`(「어떠한 의지」) 고정**(누가 보냈든 같다 — R-AUTH-004 · R-CHAT-002 S3d 개정). 토큰의 표시 이름(`ch_name`이 비어 있지 않으면 `ch_name`, 아니면 `nick`)은 D1 `author_name`에 저장만 하고 응답하지 않는다. `createdAt` = 서버 시각 |
| 에러 | 공통 + 아래 |
| 검사 순서 | 본문 규칙(DB 전) → 방 존재 |
| 부수 효과 | `messages` 1행(작성자 `mb_id`는 저장만 하고 응답하지 않는다) + 방 `updatedAt` = 서버 시각(같은 batch, R-ROOM-005). **AI를 호출하지 않는다**(R-MSG-002) |
| 레이트리밋 | 1회 |
| server | `messages.addUserMessage(roomId: string, input: UserMessageInput, author: MessageAuthor): Promise<Message>` — `author`는 `getPrincipal(c)` |
| 요구ID | R-MSG-002 · R-AUTH-004 · R-ROOM-005 · R-CHAT-004 · R-CHAT-006 · (v0.6) R-CHAT-002 |
| 테스트 | API-T-050 ~ 053 · 061 · 062(v0.6 갱신 — §14.17) · (v0.6) 108 |
| 이어지는 호출 (v0.6) | 화면은 이 응답이 `201`이면 곧바로 E9 `speak(roomId, { character: 'auto' })`를 부른다(R-CHAT-006 · R-CHAT-014). **이 엔드포인트 자체는 여전히 AI를 호출하지 않는다**(R-MSG-002 🔒 불변). 저장과 생성은 별도 요청 2건이고 레이트리밋도 2회다(§6.1 S3d 행) |

| 코드 | status | message | 조건 |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | 메시지는 1~2000자로 입력해 주세요. | trim 후 코드 포인트 0자 또는 2001자 이상 |
| `VALIDATION_ERROR` | 400 | 요청 형식이 올바르지 않습니다. | `ooc` 없음 · `ooc`가 boolean 아님(`"true"` 포함) · `text`가 문자열 아님 |
| `NOT_FOUND` | 404 | 방을 찾을 수 없습니다. | 없는 방(삭제와 경합해도 고아 없이 `404`) |

```json
{ "text": "둘이 체스를 둔다.", "ooc": true }
```

```json
{ "id": 71, "roomId": "00000000-0000-4000-8000-000000000001", "speaker": "user", "kind": "ooc", "text": "둘이 체스를 둔다.", "authorName": "어떠한 의지", "createdAt": 1767230000000 }
```

- 위 요청을 토큰 `ch_name: "시엘 팬텀하이브"`로 보내도, `ch_name: null`·`nick: "테스터"`로 보내도 응답 `authorName`은 같다. 두 경우의 차이는 D1 `author_name`(각각 `시엘 팬텀하이브`·`테스터`)에만 남는다.

### 4.10 `PATCH /api/messages/:id` (E10) — 메시지 수정

| 항목 | 값 |
|---|---|
| 토큰 | ○ |
| 경로 | `id`: 메시지 id(§4.5 변환 규칙) |
| 본문 | `EditMessageBody` = `{ text: string }` |
| 성공 | `200` · `Message`. `text`만 바뀐다(trim). `speaker`·`kind`·`authorName`·`createdAt`은 그대로다. 캐릭터 메시지도 같은 규칙이다 |
| 에러 | 공통 + 아래 |
| 검사 순서 | id 형식(DB 전 `404`) → 본문 규칙(DB 전 `400`) → 메시지 존재(`404`). 그래서 `abc` id에 빈 본문을 보내면 `404`다 |
| 부수 효과 | 메시지 `text` 갱신 + 그 방 `updatedAt` = 서버 시각(같은 batch) |
| 레이트리밋 | 1회 |
| 권한 | 등급 통과자 누구나. 다른 `mb_id`가 쓴 메시지도 고칠 수 있다(R-MSG-008) |
| server | `messages.editMessage(messageId: number, input: MessageTextInput): Promise<Message>` |
| 요구ID | R-MSG-004 · R-MSG-008 · R-ROOM-005 · R-CHAT-007(인라인 수정) |
| 테스트 | API-T-050 ~ 053 · 063 · 064 · 066 |

| 코드 | status | message | 조건 |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | 메시지는 1~2000자로 입력해 주세요. | E8과 같다 |
| `NOT_FOUND` | 404 | 메시지를 찾을 수 없습니다. | id 형식 위반(§4.5) · 없는 메시지 · 이미 삭제한 메시지 |

```json
{ "text": "도련님, 홍차가 식기 전에 드시지요." }
```

```json
{ "id": 41, "roomId": "00000000-0000-4000-8000-000000000001", "speaker": "sebastian", "kind": "line", "text": "도련님, 홍차가 식기 전에 드시지요.", "authorName": null, "createdAt": 1767228060000 }
```

- "수정됨" 표시 필드는 요구가 없어 두지 않는다(§13).
- (v0.6) 유저 메시지를 고쳐도 응답 `authorName`은 `USER_DISPLAY_NAME`이다(§4.3 값 규칙). 수정은 D1 `author_name`도 바꾸지 않는다.

### 4.11 `DELETE /api/messages/:id` (E11) — 메시지 삭제

| 항목 | 값 |
|---|---|
| 토큰 | ○ |
| 경로 | `id`: 메시지 id(§4.5 변환 규칙) |
| 본문 | 없음 |
| 성공 | `204` · 본문 없음 |
| 에러 | 공통 + `NOT_FOUND` 404 `메시지를 찾을 수 없습니다.`(id 형식 위반 · 없는 메시지 · 이미 삭제) |
| 부수 효과 | 메시지 실삭제(id는 재사용되지 않는다) + 그 방 `updatedAt` = 서버 시각(같은 batch). 히스토리 커서는 id 기준이라 이후 페이지는 빠진 id를 건너뛰어 이어진다 |
| 레이트리밋 | 1회 |
| 권한 | 등급 통과자 누구나(R-MSG-008) |
| server | `messages.deleteMessage(messageId: number): Promise<void>` |
| 요구ID | R-MSG-005 · R-MSG-008 · R-ROOM-005 · R-CHAT-007(삭제, confirm은 화면) |
| 테스트 | API-T-050 ~ 053 · 064 · 065 · 066 |

### 4.12 생성 공통 규칙 (S3 — E9 · E12)

AI가 대사를 만드는 두 쓰기다. 주방에 화구가 방마다 하나뿐이라 한 방에서는 한 번에 한 접시만 굽는다고 보면 된다. §4.5 쓰기 공통 규칙을 그대로 따르고 아래만 더한다.

| 항목 | 값 |
|---|---|
| 토큰 | ○ — §2.2. 두 엔드포인트 모두 라우트 단위로 `requireToken → rateLimitWrites → validate → 핸들러` |
| 처리 순서 | 부트스트랩 → `requireToken` → `rateLimitWrites` → `validate('param')` → (E9만) `validate('json')` → 핸들러 → 서비스. 서비스 안 판정 순서는 각 절의 「판정 순서」 표(server 설계 고정) |
| 시간 상한 (R-NFR-001 🔒) | 서버는 요청을 받은 뒤 **70초 안에** 성공 또는 실패 응답으로 끝난다. 내역: LLM 단계 최대 66초(1차 최대 60초 + 대기 1초 + 남은 예산 안의 재시도) + D1 왕복 여유 4초(llm.md §4.2). 정상 응답은 보통 수 초다 |
| 화면 타임아웃 | `ui/src/api/client.ts`에는 요청 타임아웃이 **없다 — 서버 종결에 의존한다**(§3.4). 타임아웃을 두게 되면 이 두 호출은 **75초 이상**(70초 + 망 여유 5초)이어야 한다. 그보다 짧으면 서버는 저장했는데 화면은 실패로 보고, 「재시도」가 대사를 하나 더 만든다 |
| 진행 상태 | 응답은 끝날 때 한 번에 온다. 스트리밍·진행 상태 조회·취소 엔드포인트는 없다(R-API-001) |
| 동시 1건 (R-MSG-007 🔒 · R-NFR-003 🔒) | 같은 방의 speak·regenerate는 **하나의 잠금**(`rooms.speaking_until`, 만료 90초)을 나눠 쓴다. 이미 생성 중이면 `409 SPEAK_IN_PROGRESS`. 다른 방끼리는 막지 않는다. 유저 발화·수정·삭제(E8·E10·E11)와 방 삭제(E6)는 잠금을 보지 않는다 |
| 잠금 해제 | 서버가 성공·실패와 무관하게 응답 전에 푼다. 해제 실패나 연결 끊김으로 남은 잠금은 최대 90초 뒤 저절로 풀린다(messages.md §4.3). 그동안 그 방의 생성 요청은 `409`다 |
| 레이트리밋 | 요청 1건 = 1회. 쓰기 6종과 **같은 분당 한도**를 나눠 쓴다. 인증 통과 뒤 세므로 `400`·`404`·`409`·`500 CONFIG_INVALID`·`502`·(v0.4.1) `429 LLM_BUDGET_EXCEEDED`로 끝나도 1회다. `401`·`403`은 세지 않는다(§6.1 S3 행) |
| AI 호출 | 요청당 제공사 호출 1~2회(1회 재시도, R-LLM-005). (v0.6) E9 `'auto'`는 2~3회 — 화자 선택 1회(최대 8초, 재시도 없음) + 발화 1~2회. 「시간 상한」 행의 LLM 단계 66초는 선택·발화를 합친 값이고 70초 상한은 그대로다(R-NFR-001 🔒 · R-LLM-008). 선택 호출 사용량도 월 비용 누적에 더한다(R-LLM-007). 래퍼는 자동 재시도하지 않는다. 「재시도」는 사용자가 누르는 새 요청이다(R-CHAT-005) |
| 월 비용 상한 (R-LLM-007 🔒, v0.4.1) | 서버가 제공사 응답의 토큰 사용량 × 단가 × 환율로 **추정 원화**를 월(KST) 단위로 누적한다. 누적이 `LLM_MONTHLY_BUDGET_KRW`(기본 100000) 이상이면 이 두 엔드포인트만 **키 확인 다음·잠금 선점 전·제공사 호출 전**에 `429 LLM_BUDGET_EXCEEDED`로 거절한다. 다음 달 1일 00:00 KST에 저절로 풀린다. 읽기·다른 쓰기는 영향이 없다. 사용량·예산을 보는 엔드포인트는 없고 health에도 싣지 않는다(R-API-001). 성공 응답 모양은 바뀌지 않는다 |
| 응답 메시지 | 기존 `Message` 그대로. `speaker`는 `'sebastian'`·`'ciel'`, `kind: 'line'`, `authorName: null`. 누가 눌렀는지는 저장·응답하지 않는다(messages.md D-MSG-12). 이름·아바타는 화면이 `CHARACTERS[speaker]`로 그린다(R-LLM-002, §5.5) |
| `text` | 제공사 응답의 후처리 결과(앞머리 이름표 제거·양끝 공백·연속 빈 줄 정리, R-LLM-004). 최대 2000자(코드 포인트, llm.md D-LLM-9). 빈 결과면 `502 LLM_EMPTY` |
| 응답 뒤 작업 | S3에는 없다. (v0.7) S4부터 **E9 성공 응답 뒤에만** 장기기억 자동 요약(R-MEM-002 🔒)이 백그라운드(`waitUntil`)로 붙는다(§4.13 부수 효과). 응답 형태·status·소요(70초 상한)·레이트리밋은 바뀌지 않는다. E12와 실패한 E9에는 붙지 않는다 |

공통 에러(§4.5 공통에 더함):

| 코드 | status | message | 조건 | 판정 위치 |
|---|---|---|---|---|
| `CONFIG_INVALID` | 500 | 기본 문구 | `LLM_PROVIDER = google`인데 `LLM_API_KEY`가 없음. **이 두 엔드포인트만** 실패하고 읽기·다른 쓰기는 정상이다(R-ENV-003). `fake` 제공사는 키가 없어도 된다 | 서비스(`deps.llm()`, 잠금 전) |
| `LLM_BUDGET_EXCEEDED` (v0.4.1) | 429 | 기본 문구 + 본문 `retryAfterSec` + 헤더 `Retry-After` | 이번 달 추정 누적 ≥ 예산(§3.2). `retryAfterSec` = 다음 달 1일 00:00 KST까지 초(올림, 최소 1). 예: `2026-10-06T05:00:00Z` → `2196000` | 서비스(`llm.ensureBudget()`, `CONFIG_INVALID` 다음·잠금 전) |
| `SPEAK_IN_PROGRESS` | 409 | 기본 문구 | 같은 방에서 speak·regenerate가 진행 중(잠금 만료 전) | 서비스(잠금 선점) |
| `LLM_FAILED` | 502 | 기본 문구 | 제공사 호출 최종 실패(§3.2 표) | llm |
| `LLM_EMPTY` | 502 | 기본 문구 | 제공사 차단·후보 없음, 또는 후처리 결과가 빈 문자열 | llm |

- `502`이면 저장하지 않는다. 메시지 수·방 `updatedAt`이 그대로이고 잠금은 풀린다(server SRV-T-198).
- 응답 `message`에 제공사 이름·HTTP 상태·차단 사유·키 이름을 싣지 않는다. 원인은 서버 로그(`llm_failed`)에만 있다(R-LLM-005 · R-NFR-004).
- (v0.4.1) `429 LLM_BUDGET_EXCEEDED`이면 잠금·제공사 호출·저장이 모두 0회다. 메시지 수·방 `updatedAt`·`speaking_until`이 그대로다(server SRV-T-225·226). 응답 본문에 누적액·예산·사용률을 싣지 않는다.
- (v0.4.1) 게이트의 D1 읽기가 실패하면 통과시키지 않고 `500 INTERNAL`이다(llm.md D-LLM-22, 닫힌 실패).
- (v0.4.1) 예산 직전에 다른 방의 생성 여러 건이 동시에 게이트를 지나면 모두 진행해 예산을 조금 넘을 수 있다(llm.md §12.8, 수용). 추정은 실제 청구와 다를 수 있다(§8).

### 4.13 `POST /api/rooms/:id/speak` (E9) — 캐릭터 1턴 생성

| 항목 | 값 |
|---|---|
| 토큰 | ○ |
| 경로 | `id: string`(방 id, §4.5 `roomIdParam`) |
| 본문 | `SpeakBody` = `{ character: SpeakTarget }` — (v0.6) `SpeakTarget = CharacterId \| 'auto'` = `'sebastian' \| 'ciel' \| 'auto'`(§5.2). 필수. 모르는 키는 버린다. 값은 소문자 그대로만 받는다 |
| 성공 | `201` · `Message`. `speaker` = 캐릭터를 지정했으면 `character`, (v0.6) `'auto'`면 **서버가 고른 캐릭터**(`'sebastian'`·`'ciel'` 중 하나 — 응답 어디에도 `'auto'`는 나오지 않는다). `kind: 'line'`, `authorName: null`, `text` = 후처리 결과, `createdAt` = **저장 시각**(생성이 끝난 시각이지 요청 시각이 아니다). 저장 순서대로 id가 붙어 히스토리 끝에 온다 |
| `'auto'` (v0.6) | 서버가 최근 대화를 보고 세바스찬·시엘 중 **정확히 1명**을 고른 뒤, 그 캐릭터를 지정한 요청과 **같은 발화 프롬프트**로 1턴 생성·저장한다(R-MSG-009 🔒 · 2단계 R-LLM-008). 선택 호출이 실패·타임아웃·파싱 불가여도 요청은 실패하지 않고 기본 화자(컨텍스트 안 마지막 캐릭터 발화자의 상대, 없으면 `sebastian`)로 이어 간다. 유저 발화 뒤든 지시(OOC) 뒤든 같다. 자동 여부는 D1·응답에 남지 않는다 — 응답만으로는 버튼 생성과 구별되지 않고 구별할 필요도 없다. 그 대사의 재작성(E12)은 저장된 `speaker`로 다시 쓴다(R-MSG-006 불변) |
| 직전 발화자 | 무관. 같은 캐릭터가 연속으로 말해도 된다(R-MSG-003). (v0.6) `'auto'`의 기본 화자 규칙만 직전 캐릭터 발화자를 본다 |
| 컨텍스트 | 서버가 그 방의 최근 메시지(`CONTEXT_MESSAGES`개, 기본 40)와 장기기억 요약을 읽어 프롬프트를 만든다. 화면은 대화 내용을 보내지 않는다. 프롬프트의 유저 줄은 `[어떠한 의지] …`이고 저장 실명은 쓰지 않는다(R-LLM-003 S3d 개정, server 소관) |
| 에러 | §4.5 공통 + §4.12 공통 + 아래. (v0.6) `'auto'`도 **같은 표**를 쓴다 — 새 코드·새 status 없음(R-API-002 불변) |
| 부수 효과 | `messages` 1행 + 방 `updatedAt` = 저장 시각(같은 batch, R-ROOM-005). 잠금 선점·해제(`updatedAt`은 바꾸지 않는다). 제공사 호출 **최대 3회**(v0.6.1 — `'auto'`: 선택 1 + 생성 1~2 · 지정 캐릭터: 1~2, 생성의 1회 재시도 포함) — 선택 호출 사용량도 월 비용 누적에 더한다(R-LLM-007). 호출 수와 무관하게 레이트리밋 소모는 요청당 1회이고, 월 비용 상한 게이트(판정 4b)도 선택 호출 **앞** 1회뿐이다(선택 뒤·재시도 전에 다시 보지 않는다). 실패면 아무것도 저장하지 않는다. (v0.7) **성공 응답 뒤** 서버가 그 방의 장기기억 자동 요약을 백그라운드(`waitUntil`)로 1회 등록한다(R-MEM-002 🔒). 미요약 메시지가 `MEMORY_SUMMARY_THRESHOLD`(기본 60)를 넘을 때만 제공사를 1~2회(재시도 포함) 더 부르고(월 비용 누적·게이트 대상, R-LLM-007) `memory` 행을 바꾼다. 요약의 성공·실패·건너뜀은 이 요청의 응답 본문·status·소요에 영향이 없고(실패는 서버 로그만), 레이트리밋을 더 쓰지 않는다. 판정·구간·동시성은 server 몫(memory.md §4). 그래서 E9 응답 직후의 E13은 아직 이전 요약을 줄 수 있다(§4.17) |
| 레이트리밋 | 1회(`'auto'`도 1회 — v0.6.1 제공사 호출 최대 3회와 무관). (v0.6) 화면의 **전송 1회 = E8 1회 + E9 `'auto'` 1회 = 2회**를 같은 분당 한도에서 쓴다. 기본 20/분이면 전송은 최대 10/분이다(§6.1 규칙 그대로, S3d로 바뀌는 규칙 없음) |
| 소요 | 최대 70초(§4.12). (v0.6) `'auto'`의 선택 호출(최대 8초)은 LLM 단계 66초 안에 들어간다 — 상한 불변(R-NFR-001 🔒) |
| server | `messages.speak(roomId: string, input: SpeakInput, background: Background): Promise<Message>` — `SpeakInput = SpeakBody`(v0.6 `character: SpeakTarget`). 반환 `speaker`는 늘 `CharacterId`다. 라우트가 `background = { waitUntil: task => c.executionCtx.waitUntil(task) }`를 넘긴다(messages.md §2.3). 서비스 이름·인자 개수는 S3d에서 바뀌지 않는다 |
| 요구ID | R-MSG-003 · R-MSG-007 · R-ROOM-005 · R-NFR-001 · R-NFR-003 · R-LLM-002 · R-LLM-004 · R-LLM-005 · R-CHAT-005 · (v0.4.1) R-LLM-007 · (v0.6) R-MSG-009 · R-LLM-008 · R-CHAT-006 · R-CHAT-014 · (v0.7) R-MEM-002 |
| 테스트 | API-T-050 ~ 053(쓰기 표에 추가) · 070 ~ 077 · 084 · (v0.4.1) 085 · 086 · 088 ~ 090 · (v0.6) 109 ~ 111 · (v0.7) 123 |

판정 순서(server 설계 고정 — messages.md §4.2. 앞 단계에서 실패하면 뒤 단계는 보지 않는다):

| 순서 | 검사 | 실패 |
|---|---|---|
| 1 | 토큰(§2.3) | `401 TOKEN_REQUIRED`·`TOKEN_INVALID` / `403 LEVEL_TOO_LOW` |
| 2 | 레이트리밋(§6.1) — 여기서 1회 소모 | `429 RATE_LIMITED` |
| 3 | 본문 `character`(라우트 zod) | `400 VALIDATION_ERROR` |
| 4 | LLM 설정(`LLM_API_KEY`) | `500 CONFIG_INVALID` |
| 4b | (S3b) 월 비용 상한 — D1 읽기 1행. 잠금·제공사 호출 0회 | `429 LLM_BUDGET_EXCEEDED` |
| 5 | 방 존재 · 잠금 선점(한 batch) | `404 NOT_FOUND` / `409 SPEAK_IN_PROGRESS` |
| 5b | (v0.6, `'auto'`만) 화자 선택 호출 — 최대 8초·재시도 없음·최근 기록 12개. 실패·타임아웃·차단·파싱 불가면 기본 화자 | **없음**(요청을 실패시키지 않는다, R-LLM-008) |
| 6 | 제공사 호출 · 후처리(`'auto'`면 5b에서 정한 캐릭터, 남은 예산 안에서 기존 재시도) | `502 LLM_FAILED` / `502 LLM_EMPTY` |
| 7 | 저장(생성 중 방이 삭제됐으면 저장하지 않는다) | `404 NOT_FOUND` |

- (v0.6) `'auto'`의 판정 1~5는 캐릭터 지정과 **같은 순서·같은 결과**다. 그래서 예산 초과면 선택 호출도 0회(`429 LLM_BUDGET_EXCEEDED`), 같은 방이 생성 중이면 선택 전에 `409 SPEAK_IN_PROGRESS`다. 선택은 잠금을 잡은 뒤에만 한다.
- (v0.6) `'auto'` 요청·응답 예시(선택 결과가 시엘인 경우):

```json
{ "character": "auto" }
```

```json
{ "id": 73, "roomId": "00000000-0000-4000-8000-000000000001", "speaker": "ciel", "kind": "line", "text": "체스라면 사양하지 않겠다. 네가 먼저 둬라.", "authorName": null, "createdAt": 1767230015000 }
```

- 그래서 없는 방에 잘못된 `character`를 보내면 `400`이고, 키가 없는 서버에 없는 방으로 보내면 `500 CONFIG_INVALID`다.
- (v0.4.1) 예산 초과 중에는 없는 방이나 잠긴 방으로 보내도 `429 LLM_BUDGET_EXCEEDED`다(방 존재 확인·잠금 선점이 한 batch라 게이트 뒤에 있다). 잘못된 `character`는 여전히 `400`, 키 없는 서버는 여전히 `500 CONFIG_INVALID`다.

에러(이 엔드포인트만):

| 코드 | status | message | 조건 |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | `요청 형식이 올바르지 않습니다.` | `character` 없음 · (v0.6) 세 값(`sebastian`·`ciel`·`auto`)이 아닌 문자열(`'Sebastian'`·`'meirin'`·`''`·`'Auto'`·`'AUTO'`·`' auto'` 포함 — 대소문자·공백을 고쳐 주지 않는다) · 문자열이 아님(`1`·`null`·`true`) · 본문 JSON 깨짐 · `Content-Type`이 JSON 아님 |
| `NOT_FOUND` | 404 | `방을 찾을 수 없습니다.` | 없는 방(삭제된 방 포함) · 생성 중 방이 삭제됨(고아 메시지 없음) |
| `LLM_BUDGET_EXCEEDED` (v0.4.1) | 429 | 기본 문구 | 판정 4b. 저장 없음. `retryAfterSec`·`Retry-After`는 §4.12 공통 |

```json
{ "character": "sebastian" }
```

```json
{ "id": 72, "roomId": "00000000-0000-4000-8000-000000000001", "speaker": "sebastian", "kind": "line", "text": "분부대로 하겠습니다, 도련님.", "authorName": null, "createdAt": 1767230012000 }
```

경합(messages.md §4.3):

| 상황 | 결과 |
|---|---|
| 같은 방 speak 2건 동시 | 1건 `201`, 나머지 `409 SPEAK_IN_PROGRESS` |
| 같은 방 speak와 regenerate 동시 | 같은 잠금이라 한쪽 `409 SPEAK_IN_PROGRESS` |
| 다른 방 speak 2건 | 둘 다 진행 |
| speak 중 유저 발화(E8) | 둘 다 성공. 이번 대사는 잠금 직후까지의 대화만 보고, 그 유저 발화보다 뒤(큰 id)에 저장된다 |
| speak 중 방 삭제(E6) | 방 삭제는 `204`, speak는 `404 NOT_FOUND` |
| 연결 끊김(탭 닫기 등) | 서버 실행이 취소될 수 있다. 대사 저장 여부는 취소 시점에 따른다. 남은 잠금은 최대 90초 뒤 풀린다 |

### 4.14 `POST /api/messages/:id/regenerate` (E12) — 같은 캐릭터로 다시 생성

| 항목 | 값 |
|---|---|
| 토큰 | ○ |
| 경로 | `id`: 메시지 id(§4.5 `messageIdParam` — 10진 숫자 문자열만 `Number()`, 그 밖은 `404`) |
| 본문 | **없음.** 보내도 읽지 않는다(`validate('json')` 없음). 깨진 JSON·다른 `Content-Type`도 무시하고 진행한다 |
| 대상 조건 (R-MSG-006 🔒) | 캐릭터 메시지(`speaker`가 `'sebastian'`·`'ciel'`)이고 **그 방의 마지막 메시지**(그 방에서 id가 가장 큼)일 때만 |
| 성공 | `200` · `Message`. `text`만 새 대사로 바뀐다. `id`·`roomId`·`speaker`·`kind`·`authorName`(`null`)·`createdAt`은 그대로다. 캐릭터는 대상의 `speaker`이며 요청으로 바꿀 수 없다 |
| 컨텍스트 | 대상을 뺀 그 앞의 최근 메시지(`CONTEXT_MESSAGES`개)와 장기기억 요약. 대상의 원래 대사는 프롬프트에 넣지 않는다 |
| 에러 | §4.5 공통 + §4.12 공통 + 아래 |
| 부수 효과 | 대상 `text` 교체 + 그 방 `updatedAt` = 교체 시각(같은 batch, R-ROOM-005). 잠금 선점·해제. 제공사 호출 1~2회. 실패면 원래 대사가 그대로 남는다 |
| 레이트리밋 | 1회 |
| 소요 | 최대 70초(§4.12) |
| server | `messages.regenerate(messageId: number): Promise<Message>`(messages.md §2.3) |
| 요구ID | R-MSG-006 · R-MSG-007 · R-ROOM-005 · R-NFR-001 · R-NFR-003 · R-LLM-004 · R-LLM-005 · R-CHAT-007(재작성) · (v0.4.1) R-LLM-007 |
| 테스트 | API-T-050 ~ 053(쓰기 표에 추가) · 074 · 075 · 078 ~ 084 · (v0.4.1) 087 · 088 |

판정 순서(server 설계 고정 — messages.md §4.2):

| 순서 | 검사 | 실패 |
|---|---|---|
| 1 | 토큰 | `401` / `403` |
| 2 | 레이트리밋 — 1회 소모 | `429` |
| 3 | id 형식(1 이상 안전 정수) · 메시지 존재 | `404 NOT_FOUND` |
| 4 | 대상이 유저 메시지 | `400 NOT_CHARACTER_MESSAGE` |
| 5 | LLM 설정 | `500 CONFIG_INVALID` |
| 5b | (S3b) 월 비용 상한 — 잠금·제공사 호출 0회 | `429 LLM_BUDGET_EXCEEDED` |
| 6 | 잠금 선점 → (잡았으면) 마지막 메시지 확인 | `409 SPEAK_IN_PROGRESS` → `409 NOT_LAST_MESSAGE` / 그사이 대상이 삭제됨 `404 NOT_FOUND` |
| 7 | 제공사 호출 · 후처리 | `502 LLM_FAILED` / `502 LLM_EMPTY` |
| 8 | 교체(생성 중 대상이 삭제됐으면 교체하지 않는다) | `404 NOT_FOUND` |

- **두 409의 우선순위는 잠금이 먼저다.** 다른 생성이 진행 중이면 대상이 마지막이 아니어도 `SPEAK_IN_PROGRESS`다. 마지막 여부는 잠금을 잡은 뒤에만 본다.
- 유저 메시지는 마지막이든 아니든 `400 NOT_CHARACTER_MESSAGE`다(4가 6보다 먼저). 키가 없는 서버에서도 유저 메시지는 `400`이다.
- (v0.4.1) 예산 게이트(5b)는 대상 검사(3·4)와 키 확인(5) 뒤, 잠금(6) 앞이다. 예산 초과 중에도 없는 id는 `404`, 유저 메시지는 `400 NOT_CHARACTER_MESSAGE`다. 대상이 마지막이 아니거나 방이 잠겨 있어도 예산 초과면 `429 LLM_BUDGET_EXCEEDED`다(두 409는 잠금을 잡을 때 본다).
- 마지막 여부는 잠금을 잡은 시점에 한 번 본다. 생성 중에 유저 발화가 뒤에 붙어도 교체는 된다(messages.md §4.3의 확인 필요 항목).

에러(이 엔드포인트만):

| 코드 | status | message | 조건 |
|---|---|---|---|
| `NOT_FOUND` | 404 | `메시지를 찾을 수 없습니다.` | id 형식 위반(`abc`·`0`·`1.5`·`0x10`·`1e1`) · 없는 메시지 · 이미 삭제 · 생성 중 대상(또는 그 방) 삭제 |
| `NOT_CHARACTER_MESSAGE` | 400 | `캐릭터 메시지만 다시 생성할 수 있습니다.` | 대상 `speaker === 'user'`(`kind` `line`·`ooc` 모두) |
| `NOT_LAST_MESSAGE` | 409 | `방의 마지막 메시지만 다시 생성할 수 있습니다.` | 그 방에 대상보다 큰 id의 메시지가 있음 |
| `LLM_BUDGET_EXCEEDED` (v0.4.1) | 429 | 기본 문구 | 판정 5b. 원래 대사가 그대로 남는다. `retryAfterSec`·`Retry-After`는 §4.12 공통 |

요청: `POST /api/messages/72/regenerate`(본문 없음). 응답:

```json
{ "id": 72, "roomId": "00000000-0000-4000-8000-000000000001", "speaker": "sebastian", "kind": "line", "text": "물론입니다. 오늘 일정부터 말씀드리지요.", "authorName": null, "createdAt": 1767230012000 }
```

경합(messages.md §4.3):

| 상황 | 결과 |
|---|---|
| regenerate와 같은 방 speak 동시 | 한쪽 `409 SPEAK_IN_PROGRESS` |
| regenerate 중 같은 메시지 수정(E10) | 둘 다 성공할 수 있고 나중에 쓴 쪽이 남는다(수정은 잠금을 보지 않는다) |
| regenerate 중 대상 삭제(E11)·방 삭제(E6) | 삭제는 `204`, regenerate는 `404 NOT_FOUND` |
| regenerate 중 유저 발화(E8) | 둘 다 성공. 교체된 대사는 이제 마지막이 아니다 |

### 4.15 `GET /api/settings/characters` (E15) — 캐릭터 설정 읽기 (갠홈 주인 전용)

| 항목 | 값 |
|---|---|
| 토큰 | ○ + 주인(§2.7). 읽기지만 토큰이 필요하다(R-AUTH-003 예외) |
| 처리 순서 | 부트스트랩(server) → `requireToken` → `requireOwner` → 핸들러 → `services.settings.get()` |
| 요청 | 경로·쿼리·본문 없음(쿼리가 있어도 무시) |
| 성공 | `200` · `CharacterSettingsResponse`(§5.8). D1에 저장된 적이 없거나 저장 행이 재검증에 실패하면 **시드**를 준다: `isDefault: true` · `version: 0` · `updatedAt: null`. (v0.8) 시드일 때도 `model`은 아래 규칙대로 채운다 |
| 응답 필드 | 정확히 `settings` · `version` · `updatedAt` · `isDefault` · `model` 다섯((v0.8) 넷 → 다섯). `settings`는 키가 전부 있는 정규화 값이다(필드 11개 × 2명 + `world`). 저장자 `mbId`·`updatedBy`·토큰·설정 키·`outputRules`·GUARD_RULES는 싣지 않는다(R-AUTH-006 · R-SET-006 · R-SET-007). (v0.8) 모델명(`gemini-…`)·단가도 싣지 않는다(R-LLM-009 — server만 안다) |
| `model` (v0.8) | `LlmModelKey \| null`(§5.8.6). 뜻 = **지금 실제로 쓰는 모델의 키**다. ① 주인이 저장한 키가 `'pro'`·`'flash'`면 그 키 ② 저장한 적이 없거나 저장값이 두 키 밖이면 서버 기본 모델(env `LLM_MODEL`)과 이름이 같은 키 ③ 서버 기본 모델이 두 후보 어느 것과도 같지 않으면 `null`. 해석은 server `resolveLlmModel`(R-LLM-009, s3f-02 §2.2)이고 라우트는 그대로 싣는다. 응답만으로는 "저장된 Pro"와 "고른 적 없어 기본값 Pro"를 구분하지 않는다(§15.15 확인 필요 1) |
| 부수 효과 | 없음(D1 PK 1행 읽기 — (v0.8) 같은 행의 `llm_model` 칸 포함). 응답 캐시 없음 — 화면은 설정 화면을 열 때마다 다시 읽는다 |
| 레이트리밋 | 없음(읽기). 주인 판정 탐침이 첫 로드마다 1회 오므로 세지 않는다 |
| 주인 판정 탐침 | 화면 App이 토큰이 있을 때 1회 부른다. `200`만 주인이다(§2.7 · R-SET-010) |
| server | `services.settings.get(): Promise<CharacterSettingsResponse>`(s3c-03 §1.3, settings.md). (v0.8) 시그니처 불변, 응답에 `model`(s3f-03 §1.2) |
| 요구ID | R-SET-004 · R-SET-001 · R-SET-003 · R-SET-010 · R-AUTH-003 · R-AUTH-006 · (v0.8) R-SET-013 · R-LLM-009 |
| 테스트 | API-T-091 · 092 · 093 · 094 · 102 · 103 · (v0.8) 094(갱신) · 126 |

에러:

| 코드 | status | message | 조건 | 판정 위치 |
|---|---|---|---|---|
| `CONFIG_INVALID` | 500 | 기본 문구 | 설정 오류(`OWNER_MB_IDS` 형식 위반 포함, 가장 먼저) | server 부트스트랩 |
| `TOKEN_REQUIRED` | 401 | 기본 문구 | Bearer 토큰을 꺼낼 수 없음(§2.2) | `requireToken` |
| `TOKEN_INVALID` | 401 | 기본 문구 | 형식·서명·payload·만료 실패(§2.3) | `requireToken` |
| `LEVEL_TOO_LOW` | 403 | 기본 문구 | `level < TOKEN_MIN_LEVEL`(주인 ID여도) | `requireToken` |
| `OWNER_ONLY` | 403 | 기본 문구만 | `mbId ∉ OWNER_MB_IDS` 또는 목록 비어 있음 | `requireOwner` |
| `INTERNAL` | 500 | 기본 문구 | D1 읽기 실패(테이블 없음 포함 — (v0.8) `llm_model` 칸이 없는 경우, 즉 마이그레이션 0004 미적용도 여기). 시드로 대체하지 않는다 | onError |

응답 예(값은 예시 문구이며 실제 시드 내용이 아니다):

```json
{
  "settings": {
    "world": "19세기 말 런던. 팬텀하이브 저택과 그 주변이 무대다.",
    "characters": {
      "sebastian": {
        "sourceMaterial": "흑집사",
        "age": "",
        "gender": "남성",
        "role": "팬텀하이브 가 집사",
        "persona": "무엇이든 완벽하게 해내는 집사.",
        "personalityTags": "",
        "appearance": "",
        "relationships": "",
        "speech": "정중한 존댓말을 쓴다.",
        "sampleDialogue": [],
        "rules": ["자신의 정체를 먼저 밝히지 않는다."]
      },
      "ciel": {
        "sourceMaterial": "흑집사",
        "age": "13",
        "gender": "남성",
        "role": "팬텀하이브 백작",
        "persona": "어린 나이에 가문을 이끄는 백작.",
        "personalityTags": "",
        "appearance": "",
        "relationships": "",
        "speech": "짧고 단호한 반말.",
        "sampleDialogue": ["쓸데없는 소리는 그만둬."],
        "rules": []
      }
    }
  },
  "version": 0,
  "updatedAt": null,
  "isDefault": true,
  "model": "pro"
}
```

(v0.8) `model` 세 판: 저장값 `flash` → `"model": "flash"` · 저장한 적 없고 서버 기본 모델이 Pro → `"model": "pro"`(위 예) · 서버 기본 모델이 두 후보 밖 → `"model": null`.

### 4.16 `PUT /api/settings/characters` (E16) — 캐릭터 설정 전체 교체 저장 (갠홈 주인 전용)

| 항목 | 값 |
|---|---|
| 토큰 | ○ + 주인(§2.7) |
| 처리 순서 | 부트스트랩 → `requireToken` → `requireOwner` → `rateLimitWrites` → 본문 상한(128KB) → `validate('json', putCharacterSettingsBody, settingsIssueMessage)` → 핸들러 → `services.settings.put(body.settings, getPrincipal(c), body.model)`((v0.8) 셋째 인자) |
| 본문 | `PutCharacterSettingsBody` = `{ settings: CharacterSettings, model?: LlmModelKey }`(§5.8 · (v0.8) §5.8.6), `Content-Type: application/json`. **봉투**(`settings` 바깥)의 모르는 키는 버린다(§4.5 규칙). **`settings` 안은 strict** — 모르는 키·세 번째 캐릭터·빠진 키는 `400`(R-SET-002). 필드 11개는 전부 있어야 한다(선택 필드는 `''`·`[]`로 보낸다). (v0.8) **`model`은 봉투 키**다(`settings` 안이 아니다). 값은 `'pro'`·`'flash'` 둘 중 하나이거나 **키 자체가 없어야** 한다. 키가 없으면 저장된 모델을 유지한다. `null`·빈 문자열·대소문자가 다른 값(`'Pro'`)·숫자·배열은 `400`이다(고쳐 주지 않는다 — `speak`의 `character`와 같은 방식) |
| 의미 | **전체 교체.** 부분 갱신·병합 없음. 낙관적 잠금 없음 — 동시 저장은 마지막 쓰기가 남는다. (v0.8) 예외는 `model` 하나다 — 보내면 바꾸고 빼면 유지한다(본체 `settings`는 여전히 전체 교체) |
| 검증 규칙 | `shared/src/settings.ts`의 `WORLD_FIELD_SPEC`·`CHARACTER_FIELD_SPECS`(§5.8). 글 필드는 앞뒤 trim 뒤 코드 포인트로 세고, 필수 3종(`world`·`persona`·`speech`)은 1자 이상. 목록 필드는 항목마다 trim → 빈 항목 제거 → 개수 상한 → 항목 길이 상한 |
| 본문 상한 | **131072바이트(128KB, `SETTINGS_BODY_MAX_BYTES`)**. `Content-Length`가 있으면 그 값으로, 없으면 실제로 읽은 바이트로 판정한다. 넘으면 `400 VALIDATION_ERROR`(`413`을 쓰지 않는다). 일반 글(한글·이모지·줄바꿈)로 필드 상한을 모두 채운 본문은 이 값 안에 든다. 제어 문자 이스케이프(`\u00XX`, 1자 = 6바이트)로만 채운 비정상 본문은 넘을 수 있고 그때도 이 `400`이다. 저장 행 CHECK(200000자)는 server 몫(db.md §7.6) |
| 성공 | `200` · `CharacterSettingsResponse`. `settings` = 서버가 정규화한 값(= `checkCharacterSettings(요청 settings).value`), `version` = 직전 저장 행의 version + 1(처음이면 1), `updatedAt` = 저장 시각(epoch ms), `isDefault: false`, (v0.8) `model` = 저장 뒤 지금 쓰는 모델 키(§4.15 `model` 규칙 — 보냈으면 그 키, 뺐으면 유지된 저장값의 키, 저장값이 없으면 서버 기본 모델의 키 또는 `null`). 화면은 이 응답으로 초안과 기준값을 다시 맞춘다 |
| 부수 효과 | `character_settings` 1행 UPSERT. 다음 speak·regenerate부터 새 값으로 프롬프트를 만든다(캐시 없음, R-SET-003). 이미 진행 중인 생성은 이전 값을 쓴다. (v0.8) 같은 UPSERT 한 문장이 같은 행의 `llm_model` 칸을 갱신한다(`model`을 빼면 칸 유지). 고른 모델은 **다음에 시작하는** 생성(발화·`'auto'` 화자 선택)·장기기억 자동 요약 호출부터 쓰이고, 진행 중인 호출은 시작 때 읽은 모델로 끝난다(R-SET-013 · R-LLM-009). 모델만 바꿔 저장해도 본체가 같은 값으로 다시 저장되어 `version` +1이고, 시드 상태였다면 `isDefault: false`가 된다. 서버 로그 `settings_saved { mbId, version, model }`((v0.8) `model`은 키)만 남고 본문은 남지 않는다(R-SET-012) |
| 레이트리밋 | 1회 — 쓰기 공용 분당 한도를 나눠 쓴다(§6.1 S3c 행). `401`·`403`(`OWNER_ONLY` 포함)은 세지 않고, 본문 상한·검증 `400`((v0.8) `model` 위반 포함)은 센다 |
| version | 단조 증가만 약속한다. 저장 행이 깨져 시드(`version 0`)로 보이던 상태에서 저장하면 1이 아니라 깨진 행의 version + 1일 수 있다. 화면은 표시에만 쓴다 |
| server | `services.settings.put(settings: CharacterSettings, by: Principal, model?: LlmModelKey): Promise<CharacterSettingsResponse>`(s3c-03 §1.3 · (v0.8) s3f-03 §1.2 셋째 인자) |
| 요구ID | R-SET-005 · R-SET-002 · R-SET-001 · R-SET-003 · R-SET-012 · R-AUTH-005 · R-AUTH-006 · R-API-004 · (v0.8) R-SET-013 · R-LLM-009 |
| 테스트 | API-T-091 · 092 · 093 · 095 ~ 103 · (v0.8) 127 ~ 130 |

판정 순서(앞 단계에서 실패하면 뒤 단계는 보지 않는다):

| 순서 | 검사 | 실패 |
|---|---|---|
| 1 | 토큰(§2.3) | `401 TOKEN_REQUIRED`·`TOKEN_INVALID` / `403 LEVEL_TOO_LOW` |
| 2 | 주인(§2.7) | `403 OWNER_ONLY` — 레이트리밋 소모 없음 |
| 3 | 레이트리밋(§6.1) — 여기서 1회 소모 | `429 RATE_LIMITED` |
| 4 | 본문 크기 | `400 VALIDATION_ERROR` `공통 · 설정 본문은 128KB 이하여야 합니다.` |
| 5 | 본문 JSON 파싱 | `400 VALIDATION_ERROR` 기본 문구(onError, HTTPException 400) |
| 6 | 본문 검증 — 통과 여부는 routes zod(`putCharacterSettingsBody` = server `characterSettingsSchema` + (v0.8) `model` enum), 문구는 ① shared `checkCharacterSettings`의 첫 위반 ② (v0.8) `settings`가 통과했을 때만 봉투 `model` 위반. **`settings` 검사가 먼저다** | `400 VALIDATION_ERROR` + 아래 표 문구 |
| 7 | 저장 | `500 INTERNAL`(D1 장애) |

400 문구 규칙(R-SET-005 — **첫 위반 1건**, 형식 `{캐릭터 shortName 또는 공통} · {필드 화면 이름}은(는) …`):

| 위반 | path(사전 검사 `issue.path`) | message |
|---|---|---|
| `settings`가 객체가 아님·없음(`Content-Type`이 JSON이 아니어서 본문이 `{}`로 읽힌 경우 포함) | `[]` | `공통 · 설정 형식이 올바르지 않습니다.` |
| `settings`에 `world`·`characters` 밖의 키 | `[]` | `공통 · 알 수 없는 항목이 있습니다.` |
| `world` 문자열 아님·없음 | `['world']` | `공통 · 세계관 값의 형식이 올바르지 않습니다.` |
| `world` trim 후 0자 또는 2001자 이상 | `['world']` | `공통 · 세계관은 1~2000자여야 합니다.` |
| `characters`가 객체가 아님·없음 | `['characters']` | `공통 · 캐릭터 설정 형식이 올바르지 않습니다.` |
| `characters`에 `sebastian`·`ciel` 밖의 키 | `['characters']` | `공통 · 알 수 없는 캐릭터가 있습니다.` |
| 캐릭터 값이 객체가 아님·없음 | `['characters', id]` | `{shortName} · 설정 형식이 올바르지 않습니다.` |
| 캐릭터 안에 필드 11개 밖의 키 | `['characters', id]` | `{shortName} · 알 수 없는 항목이 있습니다.` |
| 필드 없음·형 틀림(글 필드에 문자열 아님, 목록 필드에 문자열 배열 아님) | `['characters', id, key]` | `{shortName} · {label} 값의 형식이 올바르지 않습니다.` |
| 필수 글 필드 trim 후 0자 또는 상한 초과 | 〃 | `{shortName} · {label}{은/는} 1~{max}자여야 합니다.` 예: `시엘 · 말투는 1~800자여야 합니다.` |
| 선택 글 필드 상한 초과 | 〃 | `{shortName} · {label}{은/는} {max}자 이하여야 합니다.` 예: `세바스찬 · 외형은 800자 이하여야 합니다.` |
| 목록 필드 빈 항목 제거 뒤 개수 초과 | 〃 | `{shortName} · {label}{은/는} {maxItems}개 이하여야 합니다.` 예: `시엘 · 샘플 대사는 10개 이하여야 합니다.` |
| 목록 항목 하나라도 길이 초과 | 〃 | `{shortName} · {label}{은/는} 한 줄에 {itemMax}자 이하여야 합니다.` |
| (v0.8) 봉투 `model`이 있는데 `'pro'`·`'flash'`가 아님(`null`·`''`·`'Pro'`·숫자·배열 등). `settings`에 위반이 없을 때만 | `['model']`(봉투 — shared 사전 검사 밖, routes `settingsIssueMessage`가 판정) | `공통 · AI 모델 값이 올바르지 않습니다.`(= `SETTINGS_MODEL_INVALID_MESSAGE`) |

- **검사 순서**(첫 위반이 무엇인지): `settings` 객체 → 모르는 키 → `world` → `characters` 객체 → 모르는 캐릭터 → `sebastian` → `ciel` → (v0.8) 봉투 `model`. 캐릭터 안은 객체 → 모르는 키 → 필드를 `CHARACTER_FIELD_KEYS` 순서로(각 필드는 형 → 길이·개수). 문구 단일 소스는 shared `checkCharacterSettings`이고 화면 사전 검사와 서버 `400`이 같은 문장을 낸다.
- `{은/는}`은 화면 이름 끝 글자의 받침으로 정한다(`settings.ts` `withTopic`). 응답 `error`의 키는 `code`·`message` 둘뿐이다. `path`·`details` 키는 응답에 없다(§3.1). 경로는 화면 사전 검사에서만 쓴다.
- 모르는 키 문구에 키 이름을 싣지 않는다. 가져오기 파일의 `apiKey` 같은 이름이 응답·화면에 되비치지 않게 한다(§3.1 "키 이름 금지").
- (v0.8) `model` 문구의 단일 소스는 shared `SETTINGS_MODEL_INVALID_MESSAGE`다. 문구에 입력값을 싣지 않는다. 화면은 라디오로 두 키만 보내므로 `model` 사전 검사를 하지 않는다.
- zod 판정과 shared 사전 검사가 어긋나 zod만 실패하면 기본 문구 `요청 형식이 올바르지 않습니다.`가 나간다(안전망). 두 판정은 같은 경계값 벡터로 테스트한다(API-T-106·107 + server SRV-T).

에러(§4.15 표에 더함):

| 코드 | status | message | 조건 |
|---|---|---|---|
| `RATE_LIMITED` | 429 | 기본 문구 + `retryAfterSec` + `Retry-After` | 판정 3. 쓰기 공용 분당 한도 |
| `VALIDATION_ERROR` | 400 | 판정 4·6은 위 문구, 판정 5는 기본 문구 | 본문 상한 · JSON 깨짐 · 형식·필수·길이·개수·모르는 키 · (v0.8) `model` 값 |

요청 예(필드 일부는 지면상 생략했다. 실제 요청은 11필드 × 2명이 모두 있어야 한다):

```json
{ "settings": { "world": "  19세기 말 런던.  ", "characters": { "sebastian": { "sourceMaterial": "흑집사", "age": "", "gender": "남성", "role": "집사", "persona": "완벽한 집사.", "personalityTags": "", "appearance": "", "relationships": "", "speech": "정중한 존댓말.", "sampleDialogue": ["  분부대로.  ", "", "   "], "rules": [] }, "ciel": { "…": "…" } } } }
```

응답 예(`world` trim, `sampleDialogue` 빈 항목 제거):

```json
{ "settings": { "world": "19세기 말 런던.", "characters": { "sebastian": { "sourceMaterial": "흑집사", "age": "", "gender": "남성", "role": "집사", "persona": "완벽한 집사.", "personalityTags": "", "appearance": "", "relationships": "", "speech": "정중한 존댓말.", "sampleDialogue": ["분부대로."], "rules": [] }, "ciel": { "…": "…" } } }, "version": 3, "updatedAt": 1767231000000, "isDefault": false, "model": "flash" }
```

(v0.8) 모델 키를 함께 보내는 요청(봉투 `model`):

```json
{ "settings": { "world": "19세기 말 런던.", "characters": { "…": "…" } }, "model": "flash" }
```

- 위 응답 예처럼 `model` 키가 없는 요청은 저장된 모델(`flash`)을 그대로 두고 응답 `model`도 그 키다.
- `"model": null`은 `400`이다. 저장된 선택을 지우고 서버 기본값으로 되돌리는 요청은 요구에 없다.

### 4.17 `GET /api/rooms/:id/memory` (E13) — 장기기억 보기 (S4, v0.7)

장기기억은 두꺼운 일기장 맨 앞에 끼워 둔 "지난 줄거리" 쪽지다. E13은 쪽지를 읽고, E14는 쪽지 글을 통째로 새로 쓴다. 쪽지 귀퉁이의 "몇 번 장까지 옮겼는지"(`sourceUntilId`)는 서버의 서기(자동 요약)만 고친다.

| 항목 | 값 |
|---|---|
| 토큰 | ○ — 읽기지만 **토큰 필요**(R-MEM-001 · R-AUTH-003 예외, §2.1). 등급 통과자 누구나이고 주인 판정은 없다(§2.7 대상 아님). 받는 곳은 §2.2와 같다(Bearer 헤더만, `?t=` 무시) |
| 처리 순서 | 부트스트랩(server) → `requireToken` → `validate('param', roomIdParam)` → 핸들러 → `services.memory.get(id)` |
| 경로 | `id: string`(방 id, §4.5 `roomIdParam`). 형식 검사 없이 없으면 `404` |
| 요청 | 쿼리·본문 없음(쿼리가 있어도 무시) |
| 성공 | `200` · `MemoryResponse`(§5.9) |
| 행 없음 | 방은 있는데 자동 요약·편집이 한 번도 없으면 `200` `{ "summary": "", "sourceUntilId": 0, "updatedAt": null }`. `404`가 아니다(memory.md D-MEM-12) |
| 응답 필드 | 정확히 `summary` · `sourceUntilId` · `updatedAt` 셋. `roomId`·저장자 `mbId`·요약 이력·프롬프트는 싣지 않는다 |
| 부수 효과 | 없음(D1 읽기: 방 존재 1행 + `memory` PK 1행). 응답 캐시 없음 — 자동 요약(§4.13)이 언제든 값을 바꾸므로 화면은 시트를 열 때마다 다시 읽는다 |
| 레이트리밋 | 없음(세지 않는다, §6.1 S4 행) |
| server | `services.memory.get(roomId: string): Promise<MemoryResponse>`(memory.md §2 — `MemoryState = MemoryResponse`) |
| 요구ID | R-MEM-001 · R-AUTH-003 · R-CHAT-012 · R-API-004 |
| 테스트 | API-T-113 · 114 · 115 · 116 · 121 · 122 |

판정 순서:

| 순서 | 검사 | 실패 |
|---|---|---|
| 1 | 토큰(§2.3) | `401 TOKEN_REQUIRED`·`TOKEN_INVALID` / `403 LEVEL_TOO_LOW` |
| 2 | 방 존재 | `404 NOT_FOUND` |
| 3 | 읽기 | `500 INTERNAL`(D1 장애) |

에러:

| 코드 | status | message | 조건 | 판정 위치 |
|---|---|---|---|---|
| `CONFIG_INVALID` | 500 | 기본 문구 | 설정 오류(가장 먼저) | server 부트스트랩 |
| `TOKEN_REQUIRED` | 401 | 기본 문구 | Bearer 토큰을 꺼낼 수 없음(§2.2). 토큰 없는 읽기 전용 화면은 이 엔드포인트를 부르지 않는다 | `requireToken` |
| `TOKEN_INVALID` | 401 | 기본 문구 | 형식·서명·payload·만료 실패(§2.3) | `requireToken` |
| `LEVEL_TOO_LOW` | 403 | 기본 문구 | `level < TOKEN_MIN_LEVEL` | `requireToken` |
| `NOT_FOUND` | 404 | `방을 찾을 수 없습니다.` | 없는 방(삭제된 방 포함) | `memory.get` |
| `INTERNAL` | 500 | 기본 문구 | D1 읽기 실패 | onError |

응답 예:

```json
{ "summary": "시엘은 체스 시합에서 세바스찬에게 졌고, 다음 주 런던 출장을 약속받았다.\n어떠한 의지는 저택의 새 하인으로 들어왔다.", "sourceUntilId": 21, "updatedAt": 1767231000000 }
```

```json
{ "summary": "", "sourceUntilId": 0, "updatedAt": null }
```

- `sourceUntilId`는 "요약에 반영된 마지막 메시지 id"다. 0이면 자동 요약이 아직 한 번도 없었다는 뜻이고, 편집(E14)만 한 방, (v0.7.1) 요약을 비운 방도 0이다. 화면은 표시하지 않아도 된다(요구 없음).
- `updatedAt`은 마지막 저장(자동 요약 반영 또는 편집) 시각이다. 방 목록의 `RoomSummary.updatedAt`과 별개다 — 장기기억 저장은 방 `updatedAt`을 바꾸지 않는다(§4.18).

### 4.18 `PUT /api/rooms/:id/memory` (E14) — 장기기억 편집 (S4, v0.7)

| 항목 | 값 |
|---|---|
| 토큰 | ○ — 등급 통과자 누구나(§4.5 권한 규칙과 같다. 주인 판정 없음) |
| 처리 순서 | 부트스트랩 → `requireToken` → `rateLimitWrites` → `validate('param', roomIdParam)` → 본문 상한(32KiB) → `validate('json', putMemoryBody)` → 핸들러 → `services.memory.put(id, body)` |
| 경로 | `id: string`(§4.17과 같다) |
| 본문 | `PutMemoryBody` = `{ summary: string }`(§5.9), `Content-Type: application/json`. 필수. 모르는 키는 버린다(§4.5). zod는 **타입만** 본다(`z.string()`) |
| 길이 규칙 | `normalizeText`(앞뒤 공백·줄바꿈 trim) 뒤 `countCodePoints` **0~4000**(`MEMORY_SUMMARY_MAX`, §5.7). 0자 허용 = 요약 비우기. 중간 줄바꿈·공백은 그대로. 이모지 1개 = 1자. 판정은 서비스가 DB 전에 한다(memory.md §2.1 · D-MEM-11) |
| 의미 | `summary` **전체 교체**. 부분 수정·이어 붙이기 없음. `sourceUntilId`는 **바꾸지 않는다**(R-MEM-001 🔒) — 행이 없으면 0으로 새로 만든다. **예외(v0.7.1, R-MEM-001 🔒 2026-10-07 개정): trim 결과가 빈 문자열이면 `sourceUntilId`를 0으로 되돌린다**(요약 삭제 = 처음부터 재요약). 낙관적 잠금 없음: 마지막 저장이 남는다(아래 경합 표) |
| 본문 상한 | **32768바이트(32KiB)**, routes 상수 `MEMORY_BODY_MAX_BYTES`(§11.16). `Content-Length`가 있으면 그 값으로, 없으면 실제로 읽은 바이트로 판정한다(§4.16과 같은 hono `bodyLimit`). 넘으면 `400 VALIDATION_ERROR` 기본 문구(`413`을 쓰지 않는다). 근거: 4000 코드 포인트 × `JSON.stringify` 최악 6바이트(제어 문자 `\u00XX`) + 봉투 `{"summary":""}` 14바이트 = 24014바이트라, 앞뒤 공백을 덧붙이지 않은 유효한 요약은 늘 상한 안이다(이모지 4000개 = 16014바이트). 상한은 trim 전 원문 기준이라 앞뒤 공백을 수천 자 덧붙인 본문은 걸릴 수 있다 |
| 성공 | `200` · `MemoryResponse`. `summary` = 저장값(trim 결과), `sourceUntilId` = 기존 값(행이 없었으면 0, (v0.7.1) 저장값이 `''`이면 0), `updatedAt` = 저장 시각(서버 시계, epoch ms). 화면은 이 응답으로 입력을 다시 맞춘다 |
| 부수 효과 | `memory` 1행 UPSERT(방 존재 확인을 포함한 한 문장, db.md §13 `memory.putSummary`). **방 `updatedAt`은 바꾸지 않는다** — 방 목록(E3) 순서 불변(memory.md D-MEM-5). AI 호출 없음. 저장한 요약은 다음 speak·regenerate부터 프롬프트의 "지난 이야기 요약"으로 들어간다(이미 진행 중인 생성은 이전 값). 로그에 요약 본문을 남기지 않는다(R-NFR-004). (v0.7.1) 저장값이 `''`이면 같은 문장에서 `source_until_id`를 0으로 되돌린다. 그래서 다음 speak 뒤 미요약 수가 방 전체 메시지 수가 되고, 기준(기본 60)을 넘으면 방의 처음부터 다시 요약한다(R-MEM-002 경로 그대로, 1회 최대 100개씩 이어서) |
| 레이트리밋 | 1회 — 쓰기 공용 분당 한도(§6.1 S4 행). `401`·`403`은 세지 않고, 본문 상한·형식·길이 `400`과 `404`는 센다(S2 규칙 그대로) |
| server | `services.memory.put(roomId: string, input: PutMemoryBody): Promise<MemoryResponse>`(memory.md §2 — `PutMemoryInput = PutMemoryBody`) |
| 요구ID | R-MEM-001 · R-AUTH-005 · R-NFR-003 · R-CHAT-012 · R-API-004 |
| 테스트 | API-T-113 · 116 ~ 122 |

판정 순서(앞 단계에서 실패하면 뒤 단계는 보지 않는다):

| 순서 | 검사 | 실패 |
|---|---|---|
| 1 | 토큰(§2.3) | `401 TOKEN_REQUIRED`·`TOKEN_INVALID` / `403 LEVEL_TOO_LOW` |
| 2 | 레이트리밋(§6.1) — 여기서 1회 소모 | `429 RATE_LIMITED` |
| 3 | 본문 크기(32KiB) | `400 VALIDATION_ERROR` 기본 문구 |
| 4 | 본문 JSON 파싱 | `400 VALIDATION_ERROR` 기본 문구(onError, HTTPException 400) |
| 5 | 본문 형식(라우트 zod — `summary`가 문자열) | `400 VALIDATION_ERROR` 기본 문구 |
| 6 | 길이(서비스, DB 전) — trim 후 4001 코드 포인트 이상 | `400 VALIDATION_ERROR` `장기기억은 0~4000자로 입력해 주세요.` |
| 7 | 방 존재 + 저장(한 문장) | `404 NOT_FOUND` |
| 8 | D1 장애 | `500 INTERNAL` |

- 그래서 없는 방에 4001자를 보내면 `400`이고, 없는 방에 유효한 요약을 보내면 `404`다.
- 비문자열 `summary`(`1`·`null`·`[]`)는 라우트 zod가 먼저 막으므로 HTTP로는 기본 문구다. 서비스의 비문자열 검사는 라우트를 거치지 않는 호출의 안전망이다(§15.14 어긋난 점 1).

에러(§4.5 공통 표에 더함):

| 코드 | status | message | 조건 |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | `요청 형식이 올바르지 않습니다.` | 판정 3·4·5: 본문 32KiB 초과 · JSON 깨짐 · `Content-Type`이 JSON 아님 · `summary` 없음 · 문자열 아님 · 본문이 객체 아님 |
| `VALIDATION_ERROR` | 400 | `장기기억은 0~4000자로 입력해 주세요.` | 판정 6 |
| `NOT_FOUND` | 404 | `방을 찾을 수 없습니다.` | 판정 7. 없는 방(삭제된 방 포함) |

요청·응답 예(앞뒤 공백은 지우고 중간 줄바꿈은 남긴다. `sourceUntilId`는 기존 값 21 유지):

```json
{ "summary": "  시엘은 체스 시합에서 세바스찬에게 졌다.\n다음 주 런던 출장이 잡혀 있다.  " }
```

```json
{ "summary": "시엘은 체스 시합에서 세바스찬에게 졌다.\n다음 주 런던 출장이 잡혀 있다.", "sourceUntilId": 21, "updatedAt": 1767231000000 }
```

비우기:

```json
{ "summary": "" }
```

```json
{ "summary": "", "sourceUntilId": 0, "updatedAt": 1767231060000 }
```

- (v0.7.1) 비우면 `sourceUntilId`가 0으로 돌아간다(위 예에서 21 → 0). 다음 speak 뒤 미요약 메시지가 기준을 넘으면 방의 처음부터 다시 요약한다(요약 삭제 = 재요약, R-MEM-001 🔒 개정). 공백만 보낸 경우(`'   '`)도 trim 뒤 빈 문자열이라 같다. 비어 있지 않은 편집은 기존대로 `sourceUntilId`를 유지한다.

경합(memory.md §4.4 · D-MEM-2 · D-MEM-10 — `409` 없음):

| 상황 | 결과 |
|---|---|
| 같은 방 PUT 2건 동시 | 둘 다 `200`. 나중에 실행된 저장이 남는다. 각 응답은 자기 저장값이다 |
| 자동 요약(E9 뒤 백그라운드)이 도는 중 PUT | PUT `200`, 편집이 남는다. 그 자동 요약은 반영되지 않고 버려진다. `sourceUntilId`가 그대로라 다음 speak 뒤 **편집본을 기준으로** 같은 구간을 다시 요약한다. (v0.7.1) 빈 요약 PUT이면 `sourceUntilId`가 0이 되어 다음 speak 뒤 처음부터 다시 요약한다 |
| 자동 요약이 끝난 뒤 PUT(시트를 미리 열어 둔 경우) | PUT이 이긴다(마지막 저장). 자동 요약이 더한 내용은 사라지고 `sourceUntilId`는 요약이 전진시킨 값 그대로다((v0.7.1) 빈 요약 PUT이면 0). 충돌 감지·`409`는 없다(요구·에러 코드 밖, §15.14 확인 필요 2) |
| speak·regenerate 진행 중 PUT | 둘 다 진행한다. PUT은 생성 잠금을 보지 않는다(`409 SPEAK_IN_PROGRESS` 없음). 진행 중 생성은 잠금 직후 읽은 요약을 쓴다 |
| PUT과 방 삭제(E6) 동시 | 삭제가 먼저면 PUT `404`. PUT이 먼저면 `200` 뒤 삭제가 `memory` 행도 지운다(고아 행 없음, §4.8) |
| E9 직후 E13 | 자동 요약이 아직 끝나지 않았으면 이전 값이다(응답 뒤 최대 약 30초) |

### 4.19 `POST /api/rooms/:id/enter` (E17) — 방 입장 (S6, v0.9)

| 항목 | 값 |
|---|---|
| 토큰 | △ **선택**(§2.8.5 `optionalToken`). 헤더가 있으면 검증하고, 실패 사유는 삼켜 익명으로 본다 — 이 엔드포인트는 `401`·`403 LEVEL_TOO_LOW`를 내지 않는다 |
| 처리 순서 | 부트스트랩 → `optionalToken` → `validate('param', roomIdParam)` → 본문 상한(1KiB) → `validate('json', enterRoomBody)` → 핸들러 → `rooms.enter`. 관문(★) 없음 |
| 경로 | `id: string`(§4.3과 같다) |
| 본문 | `EnterRoomBody` = `{ password?: string }`. `password`는 문자열이고 코드 포인트 `ROOM_ENTER_PASSWORD_MAX`(64) 이하(해시 비용 상한). 4~32 규칙은 여기서 보지 않는다(틀린 비밀번호로 판정된다). `password` **키가 없을 때만** "없음"이다 — 래퍼는 비밀번호 없는 호출에 본문 `{}`를 보낸다. 본문 상한 **1024바이트**(routes 상수 `ROOM_PASSWORD_BODY_MAX_BYTES`, §4.18과 같은 `bodyLimit`, 넘으면 `400` 기본 문구) |
| 판정 순서 | ① 없는 방 → `404 NOT_FOUND` ② 잠기지 않은 방 → `200 { entryKey: null }` ③ 요청자가 주인 → `200 { entryKey }`(비밀번호를 보지 않고 시도 미계수) ④ `password` 없음 → `403 ROOM_LOCKED` ⑤ 입장 시도 상한 계수(§6.2) 초과 → `429 RATE_LIMITED` ⑥ 해시 불일치 → `403 ROOM_PASSWORD_WRONG` ⑦ 일치 → `200 { entryKey }`. 본문 형태 `400`은 ①보다 먼저다(없는 방에 65자 비밀번호 → `400`) |
| 성공 | `200` · `EnterRoomResponse` = `{ entryKey: string \| null }`. `null` = 잠기지 않은 방(증명 불필요 — 화면은 저장하지 않는다) |
| 에러 | 아래 표. `TOKEN_REQUIRED`·`TOKEN_INVALID`·`LEVEL_TOO_LOW`는 **없다** |
| 부수 효과 | ⑤에 닿은 요청만 D1 `rate_limits` 키 `enter:{roomId}`를 1 소모한다(해시 계산 앞). 로그 `room_enter_failed{roomId}`(⑥) · `room_enter_limited{roomId}`(⑤) — 비밀번호·증명·`mbId` 없음. `rooms` 행은 바꾸지 않는다 |
| 레이트리밋 | 회원 쓰기 한도(`rateLimitWrites`)는 **걸지 않는다**(토큰이 없을 수 있다). 방 단위 입장 시도 상한만(§6.2) |
| server | `rooms.enter(roomId: string, input: { password?: string; isOwner: boolean }): Promise<EnterRoomResponse>` — 라우트가 `isOwner: isOwnerRequest(c)`를 넘긴다(s6-03 §1.2) |
| 요구ID | R-LOCK-004 · R-LOCK-005 · R-LOCK-007 · R-LOCK-008 · R-AUTH-003(L3) · R-API-001(L1) |
| 테스트 | API-T-144 ~ 152 |

| 코드 | status | message | 조건 |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | 요청 형식이 올바르지 않습니다. | `password`가 문자열이 아님(`null`·숫자) · 코드 포인트 65 이상 · 본문 1KiB 초과 · JSON 깨짐 |
| `NOT_FOUND` | 404 | 방을 찾을 수 없습니다. | ① 없는 방 |
| `ROOM_LOCKED` | 403 | 기본 문구 | ④ 잠긴 방 · 비주인 · `password` 키 없음(화면의 "조용한 입장" 시도가 실패한 경우) |
| `RATE_LIMITED` | 429 | 비밀번호를 너무 자주 입력했습니다. 잠시 후 다시 시도해 주세요. | ⑤ 이 방 이번 분 창 시도 > `ROOM_ENTER_LIMIT_PER_MIN`. 본문 `retryAfterSec` + 헤더 `Retry-After` |
| `ROOM_PASSWORD_WRONG` | 403 | 기본 문구 | ⑥ 비밀번호 불일치 |
| `CONFIG_INVALID` · `INTERNAL` | 500 | 기본 문구 | 부트스트랩 · D1 장애(저장된 해시 문자열이 깨진 경우는 불일치 = ⑥, 서버 error 로그) |

```json
{ "password": "earl grey 7" }
```

```json
{ "entryKey": "e1.Zm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9" }
```

```json
{ "entryKey": null }
```

### 4.20 `PUT /api/rooms/:id/password` (E18) — 잠금 설정·비밀번호 변경 (S6, v0.9)

| 항목 | 값 |
|---|---|
| 토큰 | ○(§2.2). 잠긴 방이면 관문(주인 또는 증명, §2.8.3) |
| 처리 순서 | 부트스트랩 → `requireToken` → `rateLimitWrites` → `validate('param', roomIdParam)` → ★`requireRoomEntry('room')` → 본문 상한(1KiB) → `validate('json', setRoomPasswordBody)` → 핸들러 → `rooms.setPassword` |
| 본문 | `SetRoomPasswordBody` = `{ password: string }`(**필수**). 규칙은 E4와 같다(코드 포인트 4~32, trim 없음). zod는 타입만, 길이는 서비스 |
| 검사 순서 | 관문 → 본문 형태 → 비밀번호 규칙(DB 전) → 방 존재. 없는 방에 3자 비밀번호 → `400`(E5와 같은 원칙) |
| 성공 | `200` · `SetRoomPasswordResponse` = `{ room: RoomSummary, entryKey: string }`. `room.locked === true`, `room.updatedAt` **불변**. `entryKey` = 새 증명(바꾼 사람의 브라우저는 다시 묻지 않는다). 안 잠긴 방 = 잠금 설정, 잠긴 방 = 비밀번호 변경 — 같은 동작이다 |
| 에러 | 공통(§4.5, `ROOM_LOCKED` 포함) + `400` `비밀번호는 4~32자로 입력해 주세요.`(규칙 위반) · `400` 기본 문구(`password` 없음·문자열 아님·본문 1KiB 초과) · `404` `방을 찾을 수 없습니다.` |
| 부수 효과 | `pass_hash`를 새 salt 해시로 교체 → **그 방의 옛 증명 전부 무효**(같은 비밀번호로 다시 걸어도). `updated_at` 불변(목록 순서 = 대화 움직임, D-ROOM-4 원칙). 로그 `room_password_set{roomId, mbId, wasLocked}` |
| 레이트리밋 | 회원 쓰기 한도 1회. 입장 시도 상한(§6.2)은 쓰지 않는다 |
| 권한 | 안 잠긴 방: 등급 통과자 누구나 · 잠긴 방: 주인 또는 증명 보유자(사용자 결정 Q4) |
| server | `rooms.setPassword(roomId: string, password: string, by: { mbId: string }): Promise<SetRoomPasswordResponse>` — `by = { mbId: getPrincipal(c).mbId }`(로그용) |
| 요구ID | R-LOCK-002 · R-LOCK-005 · R-LOCK-006 · R-LOCK-007 · R-API-001(L1) |
| 테스트 | API-T-153 ~ 156 |

```json
{ "password": "darjeeling 2nd" }
```

```json
{ "room": { "id": "0b9d4c2e-7a1f-4e3b-8c5d-1f2e3a4b5c6d", "title": "비밀 다과회", "createdAt": 1767225600000, "updatedAt": 1767225600000, "messageCount": 4, "locked": true }, "entryKey": "e1.YmF6cXV4YmF6cXV4YmF6cXV4YmF6cXV4YmF6cXV4YmF" }
```

### 4.21 `DELETE /api/rooms/:id/password` (E19) — 잠금 해제 (S6, v0.9)

| 항목 | 값 |
|---|---|
| 토큰 | ○. 잠긴 방이면 관문(§2.8.3) |
| 처리 순서 | 부트스트랩 → `requireToken` → `rateLimitWrites` → `validate('param', roomIdParam)` → ★`requireRoomEntry('room')` → 핸들러 → `rooms.clearPassword`. 본문 없음(보내도 읽지 않는다) |
| 성공 | `200` · `RoomSummary`(`locked: false`, `updatedAt` 불변). **이미 풀린 방도 `200`**(멱등). E6·E11의 `204`와 달리 본문이 있다 — 화면이 방 표시를 바로 갱신한다 |
| 에러 | 공통(§4.5, `ROOM_LOCKED` 포함) + `404` `방을 찾을 수 없습니다.` |
| 부수 효과 | `pass_hash = NULL` → 그 방의 증명 전부 무효(뒤에 다시 잠가도 되살아나지 않는다). `updated_at` 불변. 로그 `room_password_cleared{roomId, mbId}` |
| 레이트리밋 | 회원 쓰기 한도 1회 |
| 권한 | E18과 같다 |
| server | `rooms.clearPassword(roomId: string, by: { mbId: string }): Promise<RoomSummary>` |
| 요구ID | R-LOCK-002 · R-LOCK-005 · R-LOCK-006 · R-API-001(L1) |
| 테스트 | API-T-157 · 158 |

```json
{ "id": "0b9d4c2e-7a1f-4e3b-8c5d-1f2e3a4b5c6d", "title": "비밀 다과회", "createdAt": 1767225600000, "updatedAt": 1767225600000, "messageCount": 4, "locked": false }
```

---

## 5. 타입 (TS + JSON 예시 + 스키마 방식)

### 5.1 페이로드 원칙 (R-API-004)

| 항목 | 규칙 |
|---|---|
| 필드 | camelCase. TS 타입과 JSON이 1:1. DB snake_case는 server db 모듈 안에서만 |
| 시각 | `number` = Unix epoch **밀리초**(`createdAt`, `updatedAt`) |
| 식별자 | 방 `id: string`(UUID), 메시지 `id: number`(INTEGER PK) |
| 열거 | 문자열 리터럴 유니온(`speaker`, `kind`) |
| 없음 | `null`(`authorName: string \| null`). 빈 문자열·`undefined`로 없음을 표현하지 않는다 |
| 요청 선택 필드 | TS `?:`(`MessagesQuery.before?`) |

### 5.2 `shared/src/types.ts` 전문 초안

```ts
/**
 * 계약 타입 — 단일 소스 doc/200_설계/contract/api.md §5
 * server(routes·서비스)와 ui(api 래퍼·화면)가 함께 import 한다 (R-API-008)
 * 규칙: camelCase · 시각 epoch ms · room id 문자열 · message id 정수 · 없음은 null (R-API-004)
 */
import type { ErrorCode } from './errors'

/** 캐릭터 id. 두 명 고정 (확정사항 §1, R-LLM-002) */
export type CharacterId = 'sebastian' | 'ciel'

/** 메시지 화자 */
export type Speaker = CharacterId | 'user'

/** 메시지 종류. ooc = 유저의 지시 */
export type MessageKind = 'line' | 'ooc'

/** 방 목록 한 줄 — GET /api/rooms (R-ROOM-001) */
export type RoomSummary = {
  id: string
  title: string
  /** epoch ms */
  createdAt: number
  /** epoch ms. 메시지 추가·수정·삭제·재작성 시 갱신 (R-ROOM-005) */
  updatedAt: number
  messageCount: number
}

/** 메시지 한 건 (R-MSG-001). 작성자 로그인 id 는 싣지 않는다 */
export type Message = {
  id: number
  roomId: string
  speaker: Speaker
  kind: MessageKind
  text: string
  /** 유저 메시지의 작성자 표시 이름. 캐릭터 메시지는 null */
  authorName: string | null
  /** epoch ms */
  createdAt: number
}

/** GET /api/rooms/:id/messages 쿼리. 생략 시 최신부터 30건 */
export type MessagesQuery = {
  /** 이 id 보다 작은(더 오래된) 메시지만. 1 이상 정수 */
  before?: number | undefined
  /** 1~100 정수 */
  limit?: number | undefined
}

/** 히스토리 한 페이지. messages 는 오래된→새 순. 다음 페이지 before = messages[0].id */
export type MessagesPage = {
  messages: Message[]
  hasMore: boolean
}

/** GET /api/health (R-API-005) */
export type HealthResponse = {
  ok: true
  version: string
}

/** POST /api/rooms 본문 (R-ROOM-002). trim·1~60자 판정은 서버 (S2) */
export type CreateRoomBody = {
  title: string
}

/** PATCH /api/rooms/:id 본문 (R-ROOM-003). 규칙은 CreateRoomBody 와 같다 (S2) */
export type RenameRoomBody = {
  title: string
}

/** POST /api/rooms/:id/user 본문 (R-MSG-002). ooc = true 이면 지시(kind 'ooc'). 둘 다 필수 (S2) */
export type UserMessageBody = {
  text: string
  ooc: boolean
}

/** PATCH /api/messages/:id 본문 (R-MSG-004). trim·1~2000자 판정은 서버 (S2) */
export type EditMessageBody = {
  text: string
}

/** 모든 실패 응답 본문 (R-API-002) */
export type ApiErrorBody = {
  error: {
    code: ErrorCode
    message: string
    /** 429 두 코드에만 붙는다. RATE_LIMITED = 다음 분 창까지, LLM_BUDGET_EXCEEDED = 다음 달 1일 00:00 KST까지 남은 초(정수 ≥ 1). 같은 값이 Retry-After 헤더에도 실린다 (R-AUTH-005 · R-LLM-007) */
    retryAfterSec?: number
  }
}
```

- (S2) 추가는 본문 타입 4개와 `ApiErrorBody.error.retryAfterSec?` 하나다. 기존 타입·필드는 바꾸지 않았다.
- (v0.4.1, S3b) **타입 변경 없음.** 위 `retryAfterSec?` 문서주석만 두 코드로 넓혔다. `ErrorCode`는 `ERROR_CODES`에서 유도되므로 저절로 14개가 된다.
- `CreateRoomBody`와 `RenameRoomBody`는 모양이 같지만 엔드포인트별 계약이라 따로 둔다. 한쪽만 바뀌어도 다른 쪽에 번지지 않는다.
- `TokenPayload`는 shared에 두지 않는다(§2.3).
- `Message`·`RoomSummary`는 쓰기 응답에 그대로 쓴다. 새 응답 타입은 없다. `DELETE` 성공은 본문이 없다(`204`).

S3 추가분(v0.4 — `shared/src/types.ts`의 `EditMessageBody` 다음):

```ts
/** speak 대상 (R-MSG-003 · R-MSG-009, v0.6 S3d). 'auto' = 서버가 세바스찬·시엘 중 1명을 고른다. 응답 speaker 는 늘 CharacterId */
export type SpeakTarget = CharacterId | 'auto'

/** POST /api/rooms/:id/speak 본문 (R-MSG-003). 세 값 밖이면 400 VALIDATION_ERROR (S3, v0.6 'auto' 추가) */
export type SpeakBody = {
  character: SpeakTarget
}
```

```json
{ "character": "ciel" }
```

```json
{ "character": "auto" }
```

- (S3) 추가는 `SpeakBody` 하나다. E12는 본문이 없어 타입이 없다. 두 엔드포인트 응답은 기존 `Message`다(새 응답 타입 없음).
- `CharacterId`를 그대로 쓴다. 캐릭터 문자열 유니온을 새로 만들지 않는다.
- (v0.6, S3d) 추가는 `SpeakTarget` 하나이고 `SpeakBody.character`의 타입이 `CharacterId` → `SpeakTarget`(값 1개 추가)로 넓어진다. `SpeakTarget`은 `SpeakBody` 바로 위에 둔다. `CharacterId`·`Speaker`·`Message`는 그대로다 — `'auto'`는 요청에만 있고 저장·응답 `speaker`에는 없다. 화면 상태(`PendingSpeak` 등)도 이 타입을 import한다(ui 설계 몫, 같은 뜻의 다른 이름을 만들지 않는다).
- (v0.6, S3d) `Message.authorName` 문서주석을 `/** 유저 메시지면 항상 USER_DISPLAY_NAME(「어떠한 의지」 — 서버 투영, R-AUTH-004 S3d). 캐릭터 메시지는 null */`로 바꾼다. 타입 `string | null`은 그대로다. 위 전문 초안의 옛 주석("작성자 표시 이름")은 이 줄이 대체한다.

JSON 예시(열거·nullable):

```json
{ "id": 7, "roomId": "00000000-0000-4000-8000-000000000002", "speaker": "ciel", "kind": "line", "text": "오늘 저녁은 조용히 보내고 싶군.", "authorName": null, "createdAt": 1767226740000 }
```

```json
{ "id": 8, "roomId": "00000000-0000-4000-8000-000000000002", "speaker": "user", "kind": "ooc", "text": "둘이 체스를 둔다.", "authorName": "어떠한 의지", "createdAt": 1767226800000 }
```

### 5.3 `shared/src/errors.ts` 전문 초안

```ts
/**
 * 에러 코드 — 단일 소스 doc/200_설계/contract/api.md §3.2 (R-API-002)
 * 코드 1개 = HTTP status 1개. ERROR_MESSAGES 는 기본 문구(서버는 상황별 문구를 쓸 수 있다)
 */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'TOKEN_REQUIRED',
  'TOKEN_INVALID',
  'LEVEL_TOO_LOW',
  'RATE_LIMITED',
  'NOT_FOUND',
  'SPEAK_IN_PROGRESS',
  'NOT_LAST_MESSAGE',
  'NOT_CHARACTER_MESSAGE',
  'LLM_FAILED',
  'LLM_EMPTY',
  'LLM_BUDGET_EXCEEDED',
  'CONFIG_INVALID',
  'INTERNAL',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502

/** 코드별 HTTP status */
export const ERROR_STATUS: Readonly<Record<ErrorCode, ErrorStatus>> = {
  VALIDATION_ERROR: 400,
  TOKEN_REQUIRED: 401,
  TOKEN_INVALID: 401,
  LEVEL_TOO_LOW: 403,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  SPEAK_IN_PROGRESS: 409,
  NOT_LAST_MESSAGE: 409,
  NOT_CHARACTER_MESSAGE: 400,
  LLM_FAILED: 502,
  LLM_EMPTY: 502,
  LLM_BUDGET_EXCEEDED: 429,
  CONFIG_INVALID: 500,
  INTERNAL: 500,
}

/** 코드별 기본 한국어 문구 */
export const ERROR_MESSAGES: Readonly<Record<ErrorCode, string>> = {
  VALIDATION_ERROR: '요청 형식이 올바르지 않습니다.',
  TOKEN_REQUIRED: '로그인한 회원만 사용할 수 있습니다.',
  TOKEN_INVALID: '인증 정보가 올바르지 않거나 만료되었습니다. 페이지를 새로 고쳐 주세요.',
  LEVEL_TOO_LOW: '대화에 참여할 수 있는 회원 등급이 아닙니다.',
  RATE_LIMITED: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  NOT_FOUND: '요청한 대상을 찾을 수 없습니다.',
  SPEAK_IN_PROGRESS: '이 방에서 이미 대사를 만들고 있습니다. 잠시 후 다시 시도해 주세요.',
  NOT_LAST_MESSAGE: '방의 마지막 메시지만 다시 생성할 수 있습니다.',
  NOT_CHARACTER_MESSAGE: '캐릭터 메시지만 다시 생성할 수 있습니다.',
  LLM_FAILED: 'AI 응답을 받지 못했습니다. 다시 시도해 주세요.',
  LLM_EMPTY: 'AI 응답이 비어 있습니다. 다시 시도해 주세요.',
  LLM_BUDGET_EXCEEDED: '이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요.',
  CONFIG_INVALID: '서버 설정이 올바르지 않습니다. 관리자에게 알려 주세요.',
  INTERNAL: '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
}

/** 값이 계약 에러 코드인지 (화면이 응답 본문을 정규화할 때 쓴다) */
export const isErrorCode = (value: unknown): value is ErrorCode =>
  typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value)
```

- `Record<ErrorCode, …>`라서 코드를 추가하고 status·문구를 빠뜨리면 tsc가 실패한다.
- (v0.4.1) `LLM_BUDGET_EXCEEDED`는 `LLM_EMPTY` 다음(요구 R-API-002 나열 순서)에 둔다. `ErrorStatus`에 429가 이미 있어 유니온은 그대로다. 파일 머리 주석의 "(R-API-002)"도 그대로다.

### 5.4 `shared/src/endpoints.ts` 전문 초안

```ts
/**
 * 경로 상수 — 단일 소스 doc/200_설계/contract/api.md §4 (R-API-001 · R-API-008)
 * PATHS = 서버 등록용 패턴(Hono), endpoints = 화면 호출용 빌더. 경로 리터럴은 이 파일에만 둔다
 */
import type { MessagesQuery } from './types'

const API = '/api'

export const PATHS = {
  /** 화면(정적). server 진입점이 처리하며 routes 에 등록하지 않는다 (R-API-006) */
  embed: '/embed',
  health: `${API}/health`,
  rooms: `${API}/rooms`,
  roomMessages: `${API}/rooms/:id/messages`,
  /** PATCH·DELETE 방 (S2) */
  room: `${API}/rooms/:id`,
  /** POST 유저 발화·지시 (S2) */
  roomUser: `${API}/rooms/:id/user`,
  /** PATCH·DELETE 메시지 (S2). :id 는 메시지 id(정수) */
  message: `${API}/messages/:id`,
} as const

/** :id 자리에 인코딩한 값을 넣는다 */
const withId = (pattern: string, id: string): string => pattern.replace(':id', encodeURIComponent(id))

/** 쿼리 객체 → '?a=1&b=2'. undefined 는 뺀다. 값이 숫자뿐이라 인코딩하지 않는다 */
const toQueryString = (query: Readonly<Record<string, number | undefined>>): string => {
  const pairs = Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
  return pairs.length === 0 ? '' : `?${pairs.join('&')}`
}

export const endpoints = {
  health: (): string => PATHS.health,
  rooms: (): string => PATHS.rooms,
  roomMessages: (roomId: string, query: MessagesQuery = {}): string =>
    withId(PATHS.roomMessages, roomId) + toQueryString(query),
  /** (S2) */
  room: (roomId: string): string => withId(PATHS.room, roomId),
  /** (S2) */
  roomUser: (roomId: string): string => withId(PATHS.roomUser, roomId),
  /** (S2) 메시지 id 는 정수라 String() 으로 넣는다 */
  message: (messageId: number): string => withId(PATHS.message, String(messageId)),
} as const
```

- (S2) `endpoints.rooms()`는 GET(E3)과 POST(E4)가 같이 쓴다. `endpoints.room()`·`endpoints.message()`도 PATCH·DELETE가 같이 쓴다.

S3 추가분(v0.4):

```ts
// PATHS 에 추가 (message 다음)
  /** POST 캐릭터 1턴 생성 (S3) */
  roomSpeak: `${API}/rooms/:id/speak`,
  /** POST 같은 캐릭터로 재생성 (S3). :id 는 메시지 id(정수) */
  messageRegenerate: `${API}/messages/:id/regenerate`,

// endpoints 에 추가 (message 다음)
  /** (S3) */
  roomSpeak: (roomId: string): string => withId(PATHS.roomSpeak, roomId),
  /** (S3) 메시지 id 는 정수라 String() 으로 넣는다 */
  messageRegenerate: (messageId: number): string =>
    withId(PATHS.messageRegenerate, String(messageId)),
```

- 이름은 기존 규칙(자원 + 하위 경로: `roomMessages`·`roomUser`)을 따른다. 방 아래 경로는 `room…`, 메시지 아래 경로는 `message…`다.
- `PATHS` 값은 9개가 된다(shared 테스트 API-T-042 기대 갱신).

- `PATHS`는 `as const`라 Hono가 `'/api/rooms/:id/messages'` 리터럴 타입을 그대로 받는다.
- S2~S4는 `PATHS`·`endpoints`에 키를 **추가**한다(기존 키 변경 없음).
- `URLSearchParams`를 쓰지 않는 이유: shared는 런타임 중립이어야 한다(브라우저·workerd 공용, lib 설정 의존 제거).

### 5.5 `shared/src/characters.ts` 전문 초안

```ts
/**
 * 캐릭터 표시 메타 — 단일 소스 (R-LLM-002). 화면은 speaker → 이름·아바타를 이것으로 그린다
 * 별도 조회 엔드포인트는 없다 (R-API-001). server/characters/{id}.json 의 name 은 여기 name 과 같아야 한다 (S3 검증)
 * 아바타 파일은 ui/public/img/{id}.png → 배포 경로 /embed/img/{id}.png
 */
import { PATHS } from './endpoints'
import type { CharacterId } from './types'

export type CharacterMeta = {
  id: CharacterId
  /** 전체 표시명 (확정사항 §1). server/characters/{id}.json 의 name 과 같아야 한다 */
  name: string
  /** 짧은 이름. 말풍선 이름표·버튼 등 좁은 자리에 쓴다 (R-LLM-002 개정 2026-10-05) */
  shortName: string
  /** 아바타 이미지 경로(동일 출처 절대 경로) */
  avatar: string
}

export const CHARACTERS: { readonly [K in CharacterId]: CharacterMeta & { readonly id: K } } = {
  sebastian: {
    id: 'sebastian',
    name: '세바스찬 미카엘리스',
    shortName: '세바스찬',
    avatar: `${PATHS.embed}/img/sebastian.png`,
  },
  ciel: {
    id: 'ciel',
    name: '시엘 팬텀하이브',
    shortName: '시엘',
    avatar: `${PATHS.embed}/img/ciel.png`,
  },
}
```

- 화면 사용: `message.speaker === 'user'`이면 유저 말풍선, 아니면 `CHARACTERS[message.speaker]`(타입 좁히기로 `CharacterId`).
- 말풍선 이름표는 `shortName`을 쓴다(화면 구성안의 "시엘"·"세바스찬"). 전체 이름 `name`은 그대로 유지한다.
- 버튼의 접근성 레이블 문구는 화면 `labels.ts` 몫이다. 버튼에 보이는 이름은 `shortName`을 쓸 수 있다.
- S3 `server/src/llm/characters.ts`가 대조하는 값은 `name`뿐이다. `shortName`은 표시 전용이라 server JSON에 두지 않는다.

(v0.6, S3d) 추가분 — `CHARACTERS` 다음:

```ts
/**
 * 유저 메시지 고정 표시 이름 (R-AUTH-004 · R-CHAT-002, S3d 사용자 지정 2026-10-06)
 * server: 응답 authorName 투영(db/messages.ts toMessage)·프롬프트 유저 줄 라벨. ui: authorName 이 비었을 때의 대체 표시
 * 작성자 실명(ch_name ?? nick)은 D1 author_name 에만 저장한다. 설정 화면에서 바꾸지 않는다
 */
export const USER_DISPLAY_NAME = '어떠한 의지'
```

- 위치는 이 파일이다. server(투영·프롬프트)와 ui(대체 표시)가 함께 쓰는 speaker → 표시 이름의 단일 소스이기 때문이다(s3d-02 §1). ui 전용 `labels.ts`에 두지 않는다.
- `const` 선언이라 타입이 리터럴 `'어떠한 의지'`로 좁혀진다. 같은 문자열을 소스 다른 곳에 다시 쓰지 않는다(테스트 기대값만 예외).
- **화면은 응답 `authorName`을 그대로 표시한다.** 유저 말풍선에서 `authorName`을 버리고 상수로 바꿔 그리지 않는다(서버 투영이 정본). 상수는 `authorName`이 `null`·빈 문자열일 때 옛 '이름 없음' 자리를 대신하는 대체 표시에만 쓴다.

### 5.6 스키마 방식 (확정)

| 항목 | 결정 | 이유 |
|---|---|---|
| 검증 도구 | zod 하나 + `@hono/zod-validator`(확정사항 §2) | 스킬 §8 |
| 스키마 위치 | `server/src/routes/schemas.ts` | ui는 런타임 검증이 필요 없다. shared에 zod를 넣으면 화면 번들 의존이 생긴다 |
| 타입과 묶기 | 핸들러에서 `const query: MessagesQuery = c.req.valid('query')`, `const page: MessagesPage = await …`로 **대입 시점에 tsc가 대조**한다 | 별도 단언 타입 없이 어긋나면 컴파일 실패 |
| 범위·정수 규칙 | 서비스(`normalizePageQuery`)가 단일 소스. zod는 형태와 `Number()` 변환만 | messages.md D-MSG-4, R-API-007 |
| 실패 처리 | `validate` 훅이 `AppError('VALIDATION_ERROR', 400, ERROR_MESSAGES.VALIDATION_ERROR)` throw | §3.5 |
| 본문 스키마(S2) | `roomTitleBody`(`{ title: z.string() }`, E4·E5 공용) · `userMessageBody`(`{ text: z.string(), ooc: z.boolean() }`) · `editMessageBody`(`{ text: z.string() }`). `.min()`·`.max()`·`.trim()`을 쓰지 않는다 | zod 길이는 UTF-16 단위라 서비스·DB CHECK(코드 포인트)와 어긋난다. 같은 입력에 문구가 두 가지 나오지 않게 한다(rooms.md §9) |
| 메시지 id(S2) | `messageIdParam`이 10진 숫자 문자열만 `Number()`로, 나머지는 `NaN`으로 바꾼다. 범위 판정·`404`는 서비스 | 경로 식별자는 정규 표기 하나만 인정한다(`0x10`·`1e1`이 다른 메시지를 가리키지 않게) |
| 타입 대조(S2) | 핸들러에서 `const body: CreateRoomBody = c.req.valid('json')`처럼 shared 본문 타입에 대입한다 | S1과 같은 방식 |
| 길이 규칙(v0.3.1) | 상수·정규화·세기 함수는 `@shared/limits`(§5.7) 하나. 서버 서비스가 판정에, 화면이 입력 제한·글자 수 표시에 같은 것을 쓴다 | 화면과 서버가 같은 입력을 다르게 세지 않게 한다 |
| 생성 본문(S3) | `speakBody = z.object({ character: z.enum(CHARACTER_IDS) })`. `CHARACTER_IDS = ['sebastian', 'ciel'] as const satisfies readonly CharacterId[]`(schemas.ts 내부 상수). E12는 본문 스키마가 없다 | 값 두 개뿐인 열거라 타입 검사의 일부로 zod가 끝낸다. 서비스의 `isCharacterId` 재검사는 라우트를 거치지 않는 호출을 위한 안전망이라 HTTP로는 닿지 않는다(§15.9 S3-R1) |
| 장기기억 본문(S4, v0.7) | `putMemoryBody = z.object({ summary: z.string() })`. `.min()`·`.max()`·`.trim()`을 쓰지 않는다. 본문 상한 `MEMORY_BODY_MAX_BYTES`(32768)는 routes 상수다(shared에 두지 않는다) | S2 본문 스키마와 같은 이유(zod 길이는 UTF-16 단위). 상한은 화면이 쓸 일이 없다 — 4000자 안의 유효한 요약은 늘 32KiB 안이다(§4.18) |

### 5.7 `shared/src/limits.ts` 전문 초안 (v0.3.1 신규)

```ts
/**
 * 길이 상수·규칙 — 단일 소스 doc/200_설계/contract/api.md §5.7
 * 서버 서비스(trim·길이 판정)와 화면(입력 제한·글자 수 표시)이 같이 import 한다
 * 규칙: 앞뒤 trim 후 코드 포인트 수로 센다. DB CHECK length() 와 같은 단위다(이모지 1개 = 1자)
 */

/** 방 제목 최대 글자 수. 최소 1 (R-ROOM-002 · R-ROOM-003) */
export const ROOM_TITLE_MAX = 60

/** 메시지 본문 최대 글자 수. 최소 1 (R-MSG-002 · R-MSG-004 · R-CHAT-004) */
export const MESSAGE_TEXT_MAX = 2000

/** 장기기억 요약 최대 글자 수. 최소 0 — 빈 요약 허용 (R-MEM-001 · R-CHAT-012, S4에서 사용) */
export const MEMORY_SUMMARY_MAX = 4000

/** 코드 포인트 수. UTF-16 길이와 다르다('😀'.length === 2, countCodePoints('😀') === 1) */
export const countCodePoints = (s: string): number => [...s].length

/** 판정·저장 전 정규화. 앞뒤 공백·줄바꿈만 지우고 중간은 그대로 둔다 */
export const normalizeText = (s: string): string => s.trim()
```

| 쓰는 곳 | 쓰는 방식 |
|---|---|
| server `rooms.normalizeTitle` | `t = normalizeText(raw)` → `1 <= countCodePoints(t) <= ROOM_TITLE_MAX` 아니면 `VALIDATION_ERROR`(§4.6 문구). 상수는 rooms 모듈이 새로 정의하지 않는다 |
| server `messages.normalizeMessageText` | 같은 방식, 상한 `MESSAGE_TEXT_MAX`(§4.9 문구) |
| server memory(S4) | 하한 0, 상한 `MEMORY_SUMMARY_MAX`. (v0.7) **앞뒤 trim 후** 코드 포인트로 센다. 0자 허용, 중간 줄바꿈 유지(memory.md D-MEM-11, §4.18) |
| ui `limits.ts`(화면) | 상수·함수를 재노출하거나 그대로 import한다. 전송 비활성 판정(`countCodePoints(normalizeText(s)) === 0`)과 글자 수 표시에 쓴다 |
| routes zod | 쓰지 않는다. zod는 타입만 본다(§5.6) |

- 화면 판정은 편의일 뿐이다. 최종 판정과 에러 문구는 서버가 낸다. 같은 함수를 쓰므로 화면이 통과시킨 입력이 서버에서 길이 때문에 거부되는 일은 없다.
- 세는 단위는 코드 포인트다. 결합 이모지(`👨‍👩‍👧`)는 화면에 한 글자로 보여도 5로 센다. SQLite `length()`와 같은 단위라 서비스 통과 후 CHECK 실패(500)가 생기지 않는다(rooms.md D-ROOM-6).
- `String.prototype.trim`은 전각 공백(`U+3000`)도 지운다. 서버와 화면이 같은 함수를 쓰므로 결과가 같다.
- shared 규칙(런타임 중립)을 지킨다. 브라우저·workerd 전용 API를 쓰지 않는다.
- (v0.5, S3c) **`limits.ts`는 바꾸지 않는다.** 설정 필드 상한·본문 바이트 상한·가져오기 파일 상한은 필드 표와 한 몸이라 `shared/src/settings.ts`(§5.8)에 모은다. `settings.ts`가 이 파일의 `countCodePoints`·`normalizeText`를 import해 같은 세기 규칙을 쓴다.

### 5.8 S3c 추가분 (v0.5 — 캐릭터 설정)

§5.2·§5.3·§5.4 전문 초안에 아래 추가분을 합친 것이 v0.5 전문이다. `shared/src/settings.ts`는 신규 파일 전문이다.

#### 5.8.1 `shared/src/types.ts` 추가분 (`SpeakBody` 다음)

```ts
/** 캐릭터 1명의 설정 필드 (R-SET-002). id·표시명·아바타는 없다(CHARACTERS 가 단일 소스). 화면 이름·상한은 shared/src/settings.ts */
export type CharacterSettingFields = {
  /** 원작·장르. 선택 */
  sourceMaterial: string
  /** 나이. 선택 */
  age: string
  /** 성별. 선택 */
  gender: string
  /** 신분·직업. 선택 */
  role: string
  /** 성격·배경. 필수 */
  persona: string
  /** 성격 태그. 선택 */
  personalityTags: string
  /** 외형. 선택 */
  appearance: string
  /** 관계 메모. 선택 */
  relationships: string
  /** 말투. 필수 */
  speech: string
  /** 샘플 대사(한 줄에 하나). 빈 배열 허용 */
  sampleDialogue: string[]
  /** 규칙·금기(한 줄에 하나). 빈 배열 허용 */
  rules: string[]
}

/** 캐릭터 설정 본체 — API·D1·내보내기 파일 공통, 전체 교체 단위 (R-SET-002). outputRules 는 없다(편집 불가, R-SET-006) */
export type CharacterSettings = {
  /** 공통 세계관. 필수 */
  world: string
  /** 정확히 두 키(sebastian · ciel) */
  characters: Record<CharacterId, CharacterSettingFields>
}

/** GET · PUT /api/settings/characters 응답 (R-SET-004 · R-SET-005). 저장자 mbId 는 싣지 않는다 (R-AUTH-006) */
export type CharacterSettingsResponse = {
  /** 정규화된 본체(앞뒤 trim · 목록 빈 항목 제거) */
  settings: CharacterSettings
  /** 0 = 시드 사용 중. 저장할 때마다 증가(단조 증가만 약속) */
  version: number
  /** epoch ms. 시드면 null */
  updatedAt: number | null
  /** true = 저장값이 없거나 저장 행이 깨져 시드를 쓰는 중 */
  isDefault: boolean
}

/** PUT /api/settings/characters 본문 (R-SET-005). settings 안은 strict, 바깥 모르는 키는 버린다 */
export type PutCharacterSettingsBody = {
  settings: CharacterSettings
}
```

- `Record<CharacterId, …>`라서 캐릭터가 늘면 tsc가 모든 사용처를 잡는다. 캐릭터 문자열 유니온을 새로 만들지 않는다.
- 시각은 epoch ms(R-API-004). 없음은 `null`. `version`은 정수.
- 선택 필드도 키는 필수다(빈 문자열·빈 배열). 없음을 `undefined`·키 생략으로 나타내지 않는다(§5.1).
- (v0.8) `LlmModelKey`·`CharacterSettingsResponse.model`·`PutCharacterSettingsBody.model?`은 §5.8.6이 이 블록에 더한다.

#### 5.8.2 `shared/src/errors.ts` 추가분 (3곳)

```ts
// ERROR_CODES — 'CONFIG_INVALID' 다음, 'INTERNAL' 앞 (R-API-002 나열 순서)
  'OWNER_ONLY',
// ERROR_STATUS
  OWNER_ONLY: 403,
// ERROR_MESSAGES
  OWNER_ONLY: '캐릭터 설정은 갠홈 주인만 열 수 있습니다.',
```

- `ErrorStatus`에 403이 이미 있어 유니온은 그대로다. 파일 머리 주석은 그대로 둔다.

#### 5.8.3 `shared/src/endpoints.ts` 추가분

```ts
// PATHS 에 추가 (messageRegenerate 다음)
  /** GET · PUT 캐릭터 설정 (S3c, R-SET-004 · R-SET-005). 갠홈 주인 전용 */
  characterSettings: `${API}/settings/characters`,

// endpoints 에 추가 (messageRegenerate 다음)
  /** (S3c) GET · PUT 이 같이 쓴다 */
  characterSettings: (): string => PATHS.characterSettings,
```

- 이름은 자원 기준이다(`settings/characters` = 캐릭터 설정). `PATHS` 값은 10개가 된다(API-T-042 기대 갱신).

#### 5.8.4 `shared/src/settings.ts` 전문 초안 (신규)

```ts
/**
 * 캐릭터 설정 규칙 — 단일 소스 doc/200_설계/contract/api.md §5.8 · §16 (R-SET-002 · R-SET-005 · R-SET-007 · R-SET-008)
 * 필드 화면 이름·필수·상한, 파일 형식 상수, 바이트 상한, 저장 전 사전 검사(400 문구 단일 소스)
 * server(zod 스키마가 상한을 import, routes 400 문구)와 ui(입력 제한·사전 검사·내보내기·가져오기)가 같이 쓴다
 * zod 를 쓰지 않는다(화면 번들 의존 금지, §5.6). 런타임 중립(브라우저·workerd 공용)
 */
import { CHARACTERS } from './characters'
import { countCodePoints, normalizeText } from './limits'
import type { CharacterId, CharacterSettingFields, CharacterSettings } from './types'

/** 내보내기 파일 식별자 (§16.1) */
export const SETTINGS_FILE_FORMAT = 'london-dispatch/character-settings'

/** 내보내기 파일 형식 버전. 가져오기는 이 값만 받는다 (§16.2) */
export const SETTINGS_FILE_FORMAT_VERSION = 1

/** PUT 본문 상한(바이트, 128KB). 넘으면 400 (R-SET-005, §4.16) */
export const SETTINGS_BODY_MAX_BYTES = 128 * 1024

/** 가져오기 파일 상한(바이트, 5MB). 화면이 읽기 전에 거부한다 (R-SET-008, §16.2) */
export const SETTINGS_IMPORT_MAX_BYTES = 5 * 1024 * 1024

/** 400 문구 앞머리 — 캐릭터 밖 항목 (§4.16) */
export const SETTINGS_COMMON_SCOPE = '공통'

/** 캐릭터 순서 — 검사·파일 직렬화가 이 순서를 쓴다. 집합 = CHARACTERS 의 키 (API-T-105) */
export const SETTINGS_CHARACTER_IDS = ['sebastian', 'ciel'] as const satisfies readonly CharacterId[]

/** 내보내기 파일 (§16.1). API 페이로드가 아니므로 exportedAt 은 ISO 8601 문자열이다 */
export type CharacterSettingsFile = {
  format: typeof SETTINGS_FILE_FORMAT
  formatVersion: typeof SETTINGS_FILE_FORMAT_VERSION
  exportedAt: string
  settings: CharacterSettings
}

type FieldKey = keyof CharacterSettingFields

/** 값이 string[] 인 필드(sampleDialogue · rules) */
export type ListFieldKey = {
  [K in FieldKey]: CharacterSettingFields[K] extends string[] ? K : never
}[FieldKey]

/** 값이 string 인 필드 */
export type TextFieldKey = Exclude<FieldKey, ListFieldKey>

/** 글 필드. 앞뒤 trim 후 코드 포인트로 센다. required 면 1자 이상 */
export type TextFieldSpec = { kind: 'text'; label: string; required: boolean; max: number }

/** 목록 필드(화면은 "한 줄에 하나"). 항목 trim → 빈 항목 제거 → 개수 · 항목 길이 */
export type ListFieldSpec = { kind: 'list'; label: string; maxItems: number; itemMax: number }

/** 공통 세계관 필드 (R-SET-002). 화면 이름은 '세계관' — 탭 이름은 화면 labels 몫 (api.md §15.12 결정 2) */
export const WORLD_FIELD_SPEC: TextFieldSpec = {
  kind: 'text',
  label: '세계관',
  required: true,
  max: 2000,
}

/** 캐릭터 필드 11개의 화면 이름·필수·상한 (R-SET-002 — s3c-02 §2.1 표 그대로) */
export const CHARACTER_FIELD_SPECS: { readonly [K in TextFieldKey]: TextFieldSpec } & {
  readonly [K in ListFieldKey]: ListFieldSpec
} = {
  sourceMaterial: { kind: 'text', label: '원작·장르', required: false, max: 60 },
  age: { kind: 'text', label: '나이', required: false, max: 40 },
  gender: { kind: 'text', label: '성별', required: false, max: 20 },
  role: { kind: 'text', label: '신분·직업', required: false, max: 80 },
  persona: { kind: 'text', label: '성격·배경', required: true, max: 1500 },
  personalityTags: { kind: 'text', label: '성격 태그', required: false, max: 200 },
  appearance: { kind: 'text', label: '외형', required: false, max: 800 },
  relationships: { kind: 'text', label: '관계 메모', required: false, max: 800 },
  speech: { kind: 'text', label: '말투', required: true, max: 800 },
  sampleDialogue: { kind: 'list', label: '샘플 대사', maxItems: 10, itemMax: 200 },
  rules: { kind: 'list', label: '규칙·금기', maxItems: 20, itemMax: 200 },
}

/** 필드 순서 — 검사·폼·파일 직렬화(화이트리스트)가 이 순서를 쓴다. 집합 = CHARACTER_FIELD_SPECS 의 키 (API-T-105) */
export const CHARACTER_FIELD_KEYS = [
  'sourceMaterial',
  'age',
  'gender',
  'role',
  'persona',
  'personalityTags',
  'appearance',
  'relationships',
  'speech',
  'sampleDialogue',
  'rules',
] as const satisfies readonly FieldKey[]

/** 위반 한 건. path 는 필드 위치(['world'] · ['characters', 'ciel', 'speech']). 객체 단위 위반은 그 객체까지 */
export type SettingsIssue = { path: readonly string[]; message: string }

export type SettingsCheckResult =
  | { ok: true; value: CharacterSettings }
  | { ok: false; issue: SettingsIssue }

/** 400 문구 앞머리: 캐릭터면 shortName, 아니면 '공통' */
export const settingsScopeOf = (id?: CharacterId): string =>
  id === undefined ? SETTINGS_COMMON_SCOPE : CHARACTERS[id].shortName

/** 끝 글자 받침이 있으면 '은', 없으면 '는'. 한글 음절이 아니면 '은(는)' */
const withTopic = (word: string): string => {
  const offset = word.charCodeAt(word.length - 1) - 0xac00
  if (!(offset >= 0 && offset <= 11171)) return `${word}은(는)`
  return `${word}${offset % 28 === 0 ? '는' : '은'}`
}

type Checked<T> = { ok: true; value: T } | { ok: false; message: string }
type Failed = { ok: false; issue: SettingsIssue }

const fail = (path: readonly string[], message: string): Failed => ({ ok: false, issue: { path, message } })

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasUnknownKey = (obj: Record<string, unknown>, known: readonly string[]): boolean =>
  Object.keys(obj).some(key => !known.includes(key))

const typeMessage = (scope: string, label: string): string =>
  `${scope} · ${label} 값의 형식이 올바르지 않습니다.`

const checkText = (raw: unknown, spec: TextFieldSpec, scope: string): Checked<string> => {
  if (typeof raw !== 'string') return { ok: false, message: typeMessage(scope, spec.label) }
  const value = normalizeText(raw)
  const length = countCodePoints(value)
  if (spec.required && (length < 1 || length > spec.max))
    return { ok: false, message: `${scope} · ${withTopic(spec.label)} 1~${spec.max}자여야 합니다.` }
  if (length > spec.max)
    return { ok: false, message: `${scope} · ${withTopic(spec.label)} ${spec.max}자 이하여야 합니다.` }
  return { ok: true, value }
}

const checkList = (raw: unknown, spec: ListFieldSpec, scope: string): Checked<string[]> => {
  if (!Array.isArray(raw)) return { ok: false, message: typeMessage(scope, spec.label) }
  const items: unknown[] = raw
  if (!items.every((item): item is string => typeof item === 'string'))
    return { ok: false, message: typeMessage(scope, spec.label) }
  const value = items.map(normalizeText).filter(item => item !== '')
  if (value.length > spec.maxItems)
    return { ok: false, message: `${scope} · ${withTopic(spec.label)} ${spec.maxItems}개 이하여야 합니다.` }
  if (value.some(item => countCodePoints(item) > spec.itemMax))
    return { ok: false, message: `${scope} · ${withTopic(spec.label)} 한 줄에 ${spec.itemMax}자 이하여야 합니다.` }
  return { ok: true, value }
}

const checkCharacter = (
  raw: unknown,
  id: CharacterId,
): { ok: true; value: CharacterSettingFields } | Failed => {
  const scope = settingsScopeOf(id)
  const base = ['characters', id]
  if (!isRecord(raw)) return fail(base, `${scope} · 설정 형식이 올바르지 않습니다.`)
  if (hasUnknownKey(raw, CHARACTER_FIELD_KEYS)) return fail(base, `${scope} · 알 수 없는 항목이 있습니다.`)
  const value: Record<string, string | string[]> = {}
  for (const key of CHARACTER_FIELD_KEYS) {
    const spec = CHARACTER_FIELD_SPECS[key]
    const checked = spec.kind === 'text' ? checkText(raw[key], spec, scope) : checkList(raw[key], spec, scope)
    if (!checked.ok) return fail([...base, key], checked.message)
    value[key] = checked.value
  }
  // 키 집합이 CharacterSettingFields 와 같다는 것은 CHARACTER_FIELD_KEYS 의 satisfies 와 API-T-105 가 보장한다
  return { ok: true, value: value as CharacterSettingFields }
}

/**
 * 저장 전 사전 검사 (R-SET-002 · R-SET-005). 서버 400 과 같은 판정·같은 문구(첫 위반 1건, api.md §4.16 표)
 * 순서: 본체 → 본체의 모르는 키 → world → characters → 모르는 캐릭터 → sebastian → ciel
 * 통과하면 정규화 값(앞뒤 trim · 목록 빈 항목 제거)을 돌려준다. 서버 PUT 응답의 settings 와 같다
 */
export const checkCharacterSettings = (value: unknown): SettingsCheckResult => {
  const common = SETTINGS_COMMON_SCOPE
  if (!isRecord(value)) return fail([], `${common} · 설정 형식이 올바르지 않습니다.`)
  if (hasUnknownKey(value, ['world', 'characters'])) return fail([], `${common} · 알 수 없는 항목이 있습니다.`)
  const world = checkText(value.world, WORLD_FIELD_SPEC, common)
  if (!world.ok) return fail(['world'], world.message)
  const characters = value.characters
  if (!isRecord(characters)) return fail(['characters'], `${common} · 캐릭터 설정 형식이 올바르지 않습니다.`)
  if (hasUnknownKey(characters, SETTINGS_CHARACTER_IDS))
    return fail(['characters'], `${common} · 알 수 없는 캐릭터가 있습니다.`)
  const sebastian = checkCharacter(characters.sebastian, 'sebastian')
  if (!sebastian.ok) return sebastian
  const ciel = checkCharacter(characters.ciel, 'ciel')
  if (!ciel.ok) return ciel
  return {
    ok: true,
    value: { world: world.value, characters: { sebastian: sebastian.value, ciel: ciel.value } },
  }
}
```

| 쓰는 곳 | 쓰는 방식 |
|---|---|
| server `settings/schema.ts`(zod) | 상한·필수는 `WORLD_FIELD_SPEC`·`CHARACTER_FIELD_SPECS`에서 읽는다. 상수를 다시 정의하지 않는다. 길이는 `countCodePoints(normalizeText(v))`로 세고 zod `.max()`(UTF-16 단위)를 쓰지 않는다. strict 3단(본체·`characters`·캐릭터), 두 캐릭터·11필드 키 필수 |
| server `settings.put` | 정규화 결과가 `checkCharacterSettings(input).value`와 같아야 한다(같은 함수를 써도 된다). 응답 `settings`가 이 값이다 |
| routes `schemas.ts` | `settingsIssueMessage`가 400 문구를 이 함수의 `issue.message`에서 가져온다(§11.12) |
| ui `state/settings.ts` | 저장 버튼 활성 조건·필드 안내(`issue.path`로 탭·필드를 찾는다), 글자 수 표시(`countCodePoints(normalizeText(v))` / `max`) |
| ui `state/settingsFile.ts` | 내보내기 화이트리스트(`SETTINGS_CHARACTER_IDS`·`CHARACTER_FIELD_KEYS` 순서), 형식 상수, 가져오기 상한·후보 분류(후보·무시·없음)·후보 필드만 검사(저장값 위에 후보를 덮어 이 함수로, §16.2) |

#### 5.8.5 스키마 방식 (S3c 예외)

| 항목 | S1~S3 규칙(§5.6) | E16 |
|---|---|---|
| 스키마 위치 | `server/src/routes/schemas.ts` | 본체 스키마는 server `settings/schema.ts`의 `characterSettingsSchema`(server 소유, s3c-03 §1.3). routes `schemas.ts`는 봉투만 `putCharacterSettingsBody = z.object({ settings: characterSettingsSchema })`로 감싼다(정의 1곳) |
| zod가 보는 것 | 타입만. 길이·범위는 서비스 | **타입 + strict + 필수 + 코드 포인트 상한 + 개수.** server `put`이 "이미 검증된 값"을 받기 때문이다(s3c-03 §1.3) |
| 실패 문구 | 기본 문구 | shared `checkCharacterSettings`의 첫 위반 문구(§4.16 표). zod 문구는 쓰지 않는다 |
| 타입 대조 | `const body: X = c.req.valid('json')` | 같다 — `const body: PutCharacterSettingsBody = c.req.valid('json')`가 zod 출력과 shared 타입을 tsc로 대조한다 |

#### 5.8.6 S3f 추가분 (v0.8 — AI 모델 키, R-SET-004 · R-SET-005 · R-SET-013 · R-LLM-009)

`shared/src/types.ts`:

```ts
// 추가 — CharacterSettings 다음, CharacterSettingsResponse 앞
/** AI 모델 키 (S3f, R-SET-013 · R-LLM-009). 실제 모델명·단가는 server llm/models.ts 에만 있다. 목록·순서는 settings.ts LLM_MODEL_KEYS */
export type LlmModelKey = 'pro' | 'flash'

// CharacterSettingsResponse — isDefault 다음에 필드 1개 추가
  /** 지금 실제로 쓰는 모델의 키(§4.15). 저장값이 두 키 중 하나면 그 키, 아니면 서버 기본 모델(env LLM_MODEL)과 이름이 같은 키, 그것도 없으면 null */
  model: LlmModelKey | null

// PutCharacterSettingsBody — settings 다음에 필드 1개 추가
  /** 고른 모델 키. 키가 없으면 저장값 유지, null·그 밖의 값은 400(§4.16). `| undefined` 는 exactOptionalPropertyTypes 에서 zod .optional() 출력과 맞추기 위한 것이고 JSON 에는 나타나지 않는다 */
  model?: LlmModelKey | undefined
```

`shared/src/settings.ts`(`import type`에 `LlmModelKey` 추가):

```ts
// 추가 — SETTINGS_CHARACTER_IDS 다음
/** AI 모델 키 목록 — 화면 선택지 순서이자 routes zod enum 값 (R-SET-013 · R-LLM-009). 집합 = LlmModelKey (API-T-131) */
export const LLM_MODEL_KEYS = ['pro', 'flash'] as const satisfies readonly LlmModelKey[]

/** E16 본문 model 위반 400 문구 (R-SET-005, §4.16). 입력값을 싣지 않는다 */
export const SETTINGS_MODEL_INVALID_MESSAGE = `${SETTINGS_COMMON_SCOPE} · AI 모델 값이 올바르지 않습니다.`
```

JSON 예(응답, `settings` 생략 — 세 판):

```json
{ "settings": { "…": "…" }, "version": 4, "updatedAt": 1767231000000, "isDefault": false, "model": "flash" }
{ "settings": { "…": "…" }, "version": 0, "updatedAt": null, "isDefault": true, "model": "pro" }
{ "settings": { "…": "…" }, "version": 0, "updatedAt": null, "isDefault": true, "model": null }
```

- 둘째 줄은 저장한 적이 없고 서버 기본 모델이 Pro인 판이다. 셋째 줄은 서버 기본 모델이 두 후보 밖인 판이다.
- `model`은 **본체(`settings`) 밖 봉투**에 있다. `CharacterSettings`·`checkCharacterSettings`·`CHARACTER_FIELD_*`·파일 형식 상수는 바뀌지 않는다. `settings` 안에 `model` 키를 넣으면 기존대로 모르는 키 `400`(`공통 · 알 수 없는 항목이 있습니다.`)이다.
- `satisfies`는 부분집합만 확인한다. 집합이 정확히 두 키인지는 API-T-131이 본다. 키를 더하거나 빼려면 R-SET-005 🔒 개정이 먼저이고, `LlmModelKey`·`LLM_MODEL_KEYS`·server 상수표(`LLM_MODEL_OPTIONS`)를 함께 바꾼다.
- 모델명 문자열(`gemini-…`)·단가는 shared에 두지 않는다. 화면이 이름·숫자를 모르게 하는 것이 R-LLM-009의 "키만" 규칙이다.
- `errors.ts`·`endpoints.ts`·`limits.ts`·`characters.ts`는 **변경 없음**. `PATHS`는 11개 그대로다.

| 쓰는 곳 | 쓰는 방식 |
|---|---|
| routes `schemas.ts` | `model: z.enum(LLM_MODEL_KEYS).optional()`, `settingsIssueMessage`의 `model` 문구(§11.17) |
| ui `api/settings.ts` | `saveCharacterSettings(settings, model?: LlmModelKey)` 인자 타입(§11.17) |
| ui 설정 화면 | 선택지 순서 = `LLM_MODEL_KEYS`. 화면 이름·설명 문구는 ui `labels.ts`(ui 설계 몫) |
| server `llm/models.ts` · `settings` | `LLM_MODEL_OPTIONS`의 키 타입 `{ [K in LlmModelKey]: … }`, `loadModelKey` 판정(s3f-03 §1.2) |

### 5.9 S4 추가분 (v0.7 — 장기기억)

`errors.ts`·`limits.ts`·`characters.ts`·`settings.ts`는 **변경 없음**. 서버 서비스와 화면 카운터가 `MEMORY_SUMMARY_MAX`·`countCodePoints`·`normalizeText`(§5.7)를 그대로 import한다. JSON 예시는 §4.17·§4.18.

#### 5.9.1 `shared/src/types.ts` 추가분 (`PutCharacterSettingsBody` 다음, `ApiErrorBody` 앞)

```ts
/** GET · PUT /api/rooms/:id/memory 응답 (R-MEM-001). 행이 없으면 { summary: '', sourceUntilId: 0, updatedAt: null } */
export type MemoryResponse = {
  /** 장기기억 요약. 앞뒤 trim 된 0~4000 코드 포인트(MEMORY_SUMMARY_MAX). 없으면 '' */
  summary: string
  /** 요약에 반영된 마지막 메시지 id(정수 ≥ 0). 0 = 자동 요약 전. PUT 은 바꾸지 않는다 — 단 빈 요약('') 저장이면 0 으로 되돌린다(v0.7.1). 화면은 표시하지 않아도 된다 */
  sourceUntilId: number
  /** epoch ms. 마지막 저장(자동 요약·편집) 시각. 한 번도 저장되지 않았으면 null. 방 updatedAt 과 별개 */
  updatedAt: number | null
}

/** PUT /api/rooms/:id/memory 본문 (R-MEM-001). 모르는 키는 버린다. trim·0~4000자 판정은 서버 */
export type PutMemoryBody = {
  summary: string
}
```

- 이름은 S3c 선례(`CharacterSettingsResponse`·`PutCharacterSettingsBody`)와 server 요청안(memory.md 「contract 인계」)을 따른다. server는 `MemoryState = MemoryResponse`·`PutMemoryInput = PutMemoryBody` 별칭으로 재노출한다.
- `updatedAt: number | null`의 `null`은 "한 번도 저장 안 됨"이다. 설정 시드의 `updatedAt: null`과 같은 규칙이다(R-API-004 "없음은 null").

#### 5.9.2 `shared/src/endpoints.ts` 추가분

```ts
// PATHS 에 추가 (characterSettings 다음)
  /** GET · PUT 장기기억 (S4, R-MEM-001). GET 도 토큰 필요 */
  roomMemory: `${API}/rooms/:id/memory`,

// endpoints 에 추가 (characterSettings 다음)
  /** (S4) GET · PUT 이 같이 쓴다 */
  roomMemory: (roomId: string): string => withId(PATHS.roomMemory, roomId),
```

- 이름은 방 하위 경로 규칙(`roomMessages`·`roomUser`·`roomSpeak`)을 따른다. `PATHS` 값은 **11개**가 된다(API-T-042 기대 갱신).

### 5.10 S6 추가분 (v0.9 — 방 비밀번호 잠금, s6-03 §1.2 shared 블록 그대로)

#### 5.10.1 `shared/src/types.ts`

```ts
// RoomSummary 에 추가 (messageCount 다음) — 필수 필드
  /** (S6) 비밀번호 잠금 여부. 비밀번호·해시·입장 증명은 어느 응답에도 없다 (R-LOCK-003 · R-LOCK-007) */
  locked: boolean

// CreateRoomBody 교체 (RenameRoomBody 는 { title: string } 그대로 — 이름 변경은 password 를 받지 않는다)
export type CreateRoomBody = {
  title: string
  /** (S6) 선택. 있으면 코드 포인트 ROOM_PASSWORD_MIN~MAX, trim 없음, 빈 문자열도 위반 (R-LOCK-001) */
  password?: string | undefined
}

/** (S6) E4 응답 — 비밀번호를 걸었으면 그 방의 입장 증명, 아니면 null (R-LOCK-001 · R-LOCK-004) */
export type CreateRoomResponse = RoomSummary & { entryKey: string | null }

/** (S6) E17 본문 — password 키가 없을 때만 "없음"(주인 프리패스·조용한 입장) */
export type EnterRoomBody = { password?: string | undefined }

/** (S6) E17 응답 — null = 잠기지 않은 방 */
export type EnterRoomResponse = { entryKey: string | null }

/** (S6) E18 본문 */
export type SetRoomPasswordBody = { password: string }

/** (S6) E18 응답 — 새 증명(옛 증명은 무효) */
export type SetRoomPasswordResponse = { room: RoomSummary; entryKey: string }
```

- `password?: string | undefined`는 기존 선택 필드 표기(exactOptionalPropertyTypes, `MessagesQuery`·`PutCharacterSettingsBody.model?`)를 따른다. `null`은 허용하지 않는다(→ `400`).
- E19 응답은 `RoomSummary` 그대로라 새 타입이 없다.

#### 5.10.2 `shared/src/errors.ts` (3곳, `OWNER_ONLY` 다음 · `INTERNAL` 앞)

```ts
// ERROR_CODES
  'ROOM_LOCKED',
  'ROOM_PASSWORD_WRONG',
// ERROR_STATUS
  ROOM_LOCKED: 403,
  ROOM_PASSWORD_WRONG: 403,
// ERROR_MESSAGES
  ROOM_LOCKED: '이 방은 비밀번호로 잠겨 있습니다.',
  ROOM_PASSWORD_WRONG: '비밀번호가 맞지 않습니다.',
```

- `ERROR_CODES` 길이 17(API-T-040 기대 갱신). `ErrorStatus`의 status 유니온은 403이 이미 있어 바뀌지 않는다. E17 429 상황 문구는 server(`auth.hitEnterLimit`)가 갖고 shared에 두지 않는다(§3.1 "상황 문구").

#### 5.10.3 `shared/src/endpoints.ts`

```ts
// PATHS 에 추가 (roomMemory 다음)
  /** POST 방 입장 (S6, R-LOCK-004). 토큰 선택, 관문 없음 */
  roomEnter: `${API}/rooms/:id/enter`,
  /** PUT 잠금 설정·변경 · DELETE 잠금 해제 (S6, R-LOCK-002). 토큰 필수 + 관문 */
  roomPassword: `${API}/rooms/:id/password`,

// endpoints 에 추가 (roomMemory 다음)
  roomEnter: (roomId: string): string => withId(PATHS.roomEnter, roomId),
  /** (S6) PUT · DELETE 가 같이 쓴다 */
  roomPassword: (roomId: string): string => withId(PATHS.roomPassword, roomId),

// 파일 끝에 추가
/** (S6) 입장 증명 요청 헤더 이름. 증명은 이 헤더로만 보낸다 — 쿼리·본문 금지 (api.md §2.8.1) */
export const ROOM_KEY_HEADER = 'X-Room-Key'
```

- `PATHS` 값은 **13개**(API-T-042 기대 갱신). 헤더 이름 리터럴 `'X-Room-Key'`는 이 상수 한 곳에만 둔다 — routes(server `requireRoomEntry`)·ui/api `client.ts`는 import한다(경로 리터럴과 같은 규칙, R-API-008).

#### 5.10.4 `shared/src/limits.ts`

```ts
/** (S6) 방 비밀번호 코드 포인트 범위 — 화면 카운터·서버 판정 공용 (R-LOCK-001 · 사용자 결정 4~32) */
export const ROOM_PASSWORD_MIN = 4
export const ROOM_PASSWORD_MAX = 32
/** (S6) E17 입장 시도 비밀번호 상한 — 해시 비용 상한, 넘으면 400 (s6-02 §4.2) */
export const ROOM_ENTER_PASSWORD_MAX = 64
/** (S6) X-Room-Key 값 길이 상한 — 넘으면 무효(400 아님, 관문 결과 ROOM_LOCKED) */
export const ROOM_KEY_MAX_LENGTH = 128
```

- 길이 판정은 기존 `countCodePoints`를 쓴다. 비밀번호에는 `normalizeText`(trim)를 쓰지 않는다.

#### 5.10.5 스키마 방식

- §5.6 확정 방식 그대로: zod 스키마는 `server/src/routes/schemas.ts`에 두고 shared 타입과 `satisfies`·대입으로 묶는다(§11.18). 새 스키마 `createRoomBody` · `enterRoomBody` · `setRoomPasswordBody`.

---

## 6. 레이트리밋·페이지네이션

| 항목 | S1 | 이후 |
|---|---|---|
| 읽기 레이트리밋 | 없음(E2·E3·E7) | 없음. (v0.5) E15 · (v0.7) E13도 없음 |
| 쓰기 레이트리밋 | 해당 없음 | **S2 확정** — §6.1. (S3) speak·regenerate도 같은 한도. (v0.7) E14 PUT memory도 같은 한도 |
| 방 목록 페이지네이션 | 없음(요구 없음) | 요구가 생기면 §13 참고 |
| 히스토리 페이지네이션 | `before` 커서 + `limit`(기본 30, 최대 100), `hasMore`(§4.3) | 변경 없음 |

- 기본·최대 개수(30·100)의 코드 단일 소스는 server 상수 `MESSAGE_PAGE_LIMIT_DEFAULT`·`MESSAGE_PAGE_LIMIT_MAX`다(messages.md §2.1). 화면은 `limit`을 보내지 않고 기본값을 쓰므로 shared로 옮기지 않는다.

### 6.1 쓰기 레이트리밋 (S2 확정 — R-AUTH-005 · R-NFR-003 🔒, server auth.md §2.5)

| 항목 | 값 |
|---|---|
| 단위 | 토큰의 `mb_id` 하나. 같은 사람이 여러 탭·방에서 써도 합산한다 |
| 창 | 고정 1분 창. `windowStart = floor(nowMs / 60000) × 60000` |
| 한도 | 창당 `RATE_LIMIT_PER_MIN`회(기본 **20**, `wrangler.toml [vars]`, 1~600). 1~20번째 통과, **21번째부터 `429`** |
| 대상 | `rateLimitWrites`가 붙은 요청 전부. S2는 E4·E5·E6·E8·E10·E11. S3 speak·regenerate도 같은 한도를 나눠 쓴다 |
| 세는 시점 | `requireToken` 통과 직후, 본문 검증 전. 그래서 `400`·`404`로 끝난 요청도 1회다. 인증 실패(`401`·`403`)는 세지 않는다 |
| S3 카운트 (v0.4) | speak·regenerate도 요청 1건 = 1회. `409 SPEAK_IN_PROGRESS`·`409 NOT_LAST_MESSAGE`·`400 NOT_CHARACTER_MESSAGE`·`500 CONFIG_INVALID`·`502 LLM_FAILED`·`502 LLM_EMPTY`로 끝나도 센다. 근거: ① 세는 시점이 핸들러 전이라 결과를 보고 되돌리는 경로가 없다(S2 규칙 그대로) ② `502`는 이미 제공사 호출을 1~3회 썼다 ③ 실패 뒤 연타가 제공사 할당량을 태우는 것을 분당 한도가 막는다. `401`·`403`은 여전히 세지 않는다 |
| S3b 카운트 (v0.4.1) | `429 LLM_BUDGET_EXCEEDED`로 끝난 speak·regenerate도 1회다. 레이트리밋 미들웨어가 서비스(예산 게이트)보다 먼저 돌아 되돌릴 경로가 없다(S3 규칙 그대로). 분 한도를 넘긴 요청은 예산 상태와 무관하게 `429 RATE_LIMITED`다(미들웨어가 먼저). 예산 초과 중 버튼을 연타하면 `LLM_BUDGET_EXCEEDED`가 이어지다가 `RATE_LIMITED`로 바뀐다 — 두 429는 코드로 구분한다(§3.4) |
| S3c 카운트 (v0.5) | E16(PUT 설정)은 요청 1건 = 1회이고 쓰기 공용 분당 한도를 나눠 쓴다. `rateLimitWrites`가 `requireOwner` **뒤**라 `403 OWNER_ONLY`는 세지 않는다(주인 아닌 회원의 저장 시도가 한도를 태우지 않고, 주인 판정은 설정값만 보는 싼 검사다). 본문 상한·검증 `400`은 센다(S2 규칙 그대로). E15(GET 설정)는 읽기라 세지 않는다 — 주인 판정 탐침이 첫 로드마다 오기 때문이다 |
| S4 카운트 (v0.7) | E14(PUT memory)는 요청 1건 = 1회이고 쓰기 공용 분당 한도를 나눠 쓴다. 세는 시점은 S2 규칙 그대로다(`requireToken` 직후 — 본문 상한·형식·길이 `400`과 `404`도 센다). E13(GET memory)은 토큰이 필요한 읽기지만 세지 않는다 — 시트를 열 때마다 1회 오고 D1 읽기 2행뿐이다. speak 뒤 자동 요약은 서버 백그라운드 작업이라 레이트리밋을 쓰지 않는다(E9 1회 그대로) |
| 읽기 | 세지 않는다(E2·E3·E7). (v0.5) E15도 세지 않는다. (v0.7) E13도 세지 않는다 |
| 초과 응답 | `429 RATE_LIMITED`, 본문 `error.retryAfterSec`(정수 ≥ 1) + 헤더 `Retry-After`(같은 값). 핸들러·서비스는 실행되지 않는다 |
| `retryAfterSec` | `max(1, ceil((windowStart + 60000 − nowMs) / 1000))`. 예: 창 시작 후 20초 → `40` |
| 동시성 | D1 조건부 UPSERT 한 문장이라 동시 요청에도 한도를 넘지 않는다 |
| 경계 | 고정 창이라 창 경계를 걸치면 짧은 시간에 최대 2배까지 통과할 수 있다(auth.md D-AUTH-8, 수용) |
| 화면 | 전환 없이 안내만 한다(§2.4). 자동 재시도는 하지 않는다(요구 없음) |
| S6 카운트 (v0.9) | E18·E19는 요청 1건 = 1회(쓰기 공용 한도). 방·메시지 대상 쓰기의 `403 ROOM_LOCKED`도 1회다(관문이 `rateLimitWrites` 뒤, §2.8.3). E17(입장)은 이 한도를 쓰지 않는다 — §6.2 |

### 6.2 입장 시도 상한 (S6 확정 v0.9 — R-LOCK-008 · 사용자 결정 2026-10-08 "방마다 분당 5회")

| 항목 | 값 |
|---|---|
| 대상 | E17의 판정 ⑤에 닿은 요청 = 잠긴 방 · 비주인 · `password` 있음. **해시 계산 앞**에서 센다(CPU 남용도 함께 막는다) |
| 세지 않는 것 | 없는 방(①) · 안 잠긴 방(②) · 주인(③) · `password` 없음(④) · 본문 `400` |
| 단위 | **방 하나**(D1 `rate_limits` 키 `enter:{roomId}` — 테이블 재사용, 새 테이블 없음). 회원·익명·브라우저 구분 없이 합산 |
| 창 | §6.1과 같은 고정 1분 창(`windowStart = floor(nowMs / 60000) × 60000`) |
| 한도 | 창당 `ROOM_ENTER_LIMIT_PER_MIN`회(기본 **5**, 정수 1~60, `wrangler.toml [vars]`, 위반 시 `500 CONFIG_INVALID`). 1~5번째 판정, **6번째부터 `429`** |
| 초과 응답 | `429 RATE_LIMITED`, 상황 문구 `비밀번호를 너무 자주 입력했습니다. 잠시 후 다시 시도해 주세요.`, 본문 `retryAfterSec` + 헤더 `Retry-After`(§6.1과 같은 계산). 해시 계산·증명 발급 없음 |
| 회원 쓰기 한도와의 관계 | 별개다. E17에는 `rateLimitWrites`가 없고, E18·E19는 회원 쓰기 한도만 쓴다 |
| 부작용 | 공격 중에는 그 방의 정상 열람자도 남은 창 동안 `429`를 본다. 주인은 영향 없음(③이 ⑤보다 먼저). 하루 누적 잠금은 두지 않는다(요구 밖, 장난으로 남의 입장을 막는 것을 피함) |
| 감시 | 로그 `room_enter_failed`·`room_enter_limited`(방 id만)를 `wrangler tail`로 본다 |
| 화면 | 입장 시트 안 문구(`retryAfterSec` 초 표시 가능). 자동 재시도 없음 |

---

## 7. 임베드·CSP

| 항목 | 값 | 근거 |
|---|---|---|
| 서빙 | Workers Static Assets(`ui/dist`, 바인딩 `ASSETS`, `run_worker_first = true`) | R-API-006, index.md D-IDX-1 |
| 경로 매핑 | `/embed`·`/embed/`(+`?t=`) → `ASSETS` `/` · `/embed/<파일>` → `ASSETS` `/<파일>` · 쿼리 제거 | index.md §3.2 |
| CSP | (v0.6.1 — verify-S3c SEC-003) 경로로 나눈다. **`/embed`·그 밖 비 API 경로**(에러 포함)는 `Content-Security-Policy: frame-ancestors <ALLOWED_FRAME_ANCESTORS>`(기존 그대로). **`/api/*`**(에러 포함)는 `frame-ancestors 'none'` — JSON 응답은 어느 출처의 iframe에도 넣지 않는다. 설정 실패 응답은 경로와 무관하게 `frame-ancestors 'none'`. 붙이는 곳은 server 진입점(`server/src/app.ts`) 한 곳 | R-API-006 🔒(원문 "모든 응답에 허용 출처" — `/api/*` 예외로 개정 필요, 메인 세션) · index.md §3.1 ② · verify-S3c SEC-003 |
| 기본 보안 헤더 (v0.6.1) | `/api/*`에만 hono 4 `secureHeaders()` 기본값을 건다: `X-Content-Type-Options: nosniff` · `Referrer-Policy: no-referrer` · `Strict-Transport-Security` · `Cross-Origin-Opener-Policy: same-origin` · `Cross-Origin-Resource-Policy: same-origin` 등. 기본값에 든 `X-Frame-Options: SAMEORIGIN`은 진입점이 마지막에 지운다(아래 `X-Frame-Options` 행 그대로). `/embed` 정적 자산 응답에는 걸지 않는다. 화면은 같은 출처에서 `/api`를 부르므로 `same-origin` 계열 헤더의 영향이 없다. 라우트는 여전히 헤더를 다루지 않는다 | verify-S3c SEC-003 · `server/src/app.ts` |
| `X-Frame-Options` | 보내지 않는다(받은 응답에 있으면 제거) | R-API-006 |
| 허용 출처 | `ALLOWED_FRAME_ANCESTORS` 기본 `http://london-gossip.my https://london-gossip.my`(단일 소스 `server/src/env.ts`) | R-ENV-002, 확정사항 §9-7 |
| 운영 주소 (v0.8.1) | `https://london-dispatch.pora.workers.dev` — 임베드 `…/embed`(갠홈 `$rb_chatbot_embed_url` 값), 헬스 `…/api/health`. 2026-10-08 배포 후 `/api/health` 200 · `/embed` 200 · `/embed` 응답 `frame-ancestors http://london-gossip.my https://london-gossip.my` 확인. 비밀값 아님 | R-HANDOFF-001 · R-API-006 · 확정사항 §6 |
| CORS | 없음. 화면이 서버와 같은 출처에서 내려온다 | 확정사항 §6 |
| 화면 빌드 | Vite `base: '/embed/'` | index.md §9.4 |
| 아바타 | `ui/public/img/{id}.png` → `/embed/img/{id}.png`(`CHARACTERS.*.avatar`) | R-LLM-002 |
| 로컬 개발 | Vite(5173)가 `/embed/`를 서빙하고 `/api`를 Worker(3000)로 프록시. CSP 확인은 `wrangler dev`·운영에서 | index.md §9.4 |
| 라우트 금지 | routes는 CSP·`X-Frame-Options`를 다루지 않고 `hono/secure-headers`·`hono/cors`·`hono/logger`를 쓰지 않는다 | index.md §9.1 |
| `?t=` (S2) | 서버는 읽지 않는다. 화면 `ui/src/state/token.ts`가 시작 시 한 번 읽어 메모리에 둔다(§2.4). 파라미터 이름 `t`는 저쪽 PHP와의 계약이다 | R-API-003 · R-CHAT-009 · R-TOKEN-001 |
| 갠홈 패널 표시 분기 (v0.8.2) | 갠홈 PHP가 등급으로 정한다(§2.6 표): 비로그인·등급 2 미만 → 임베드 주소를 비워 **iframe 없음** + 패널 자리표시에 가입 안내(「회원 전용」, 문구는 handoff 소유) / 2 이상 10 미만 → `/embed`(읽기 전용) / 10 이상 → `/embed?t=…`. 서버·`/embed`·CSP는 이 분기를 모르고 바뀌지 않는다. `/embed` 주소를 직접 여는 사람은 등급과 무관하게 읽기 전용으로 본다 | 2026-10-08 저녁 사용자 결정 🔒 · R-TOKEN-001 · R-HANDOFF-001·002 |

---

## 8. handoff (저쪽 전달물) — **S5 작성 2026-10-07 (v0.7.2)**

| 파일 | 내용(요구) | 요구ID |
|---|---|---|
| `doc/handoff/embed-guide.md` | https 임베드 주소 입력 위치(`$rb_chatbot_embed_url`), 패널 390×640 전제, `?t=` 전달 방식, 허용 출처 | R-HANDOFF-001 |
| `doc/handoff/token-snippet.php.md` | R-TOKEN-001 PHP 조각 전문, 붙이는 위치, LEVEL 바꾸는 법 | R-HANDOFF-002 · R-TOKEN-001 |
| `doc/handoff/secret-handover.md` | SECRET 생성(32자 이상 랜덤)·전달 경로·양쪽 입력 위치·교체 절차. 실값 없음 | R-HANDOFF-003 |
| `doc/handoff/cloudflare-setup.md` | (v0.7.2) 지인 몫(구성원 초대 · Google 예산 알림 선택)과 우리 몫(플랜 Free · D1 · Secrets 3개 · `[vars]` · 마이그레이션 0001~0003 · 배포 · 배포 뒤 확인), 대안 API 토큰. 실값 없음 | 확정사항 §6·§9-8 · R-ENV-002 · R-SET-001 · R-LLM-007 |
| 링크 (v0.7.2 작성 완료) | [embed-guide.md](../../handoff/embed-guide.md) · [token-snippet.php.md](../../handoff/token-snippet.php.md) · [secret-handover.md](../../handoff/secret-handover.md) · [cloudflare-setup.md](../../handoff/cloudflare-setup.md). S5 TODO 반영 위치: AI 비용 상한·장기기억 요약 포함 → embed-guide §7 · `sandbox` `allow-downloads` → embed-guide §5.2 · 운영 `TOKEN_SECRET` 32자 이상·개발 값과 다름 → secret-handover §1 · `OWNER_MB_IDS` Secrets → secret-handover §5 · cloudflare-setup §5. 교차 벡터 V1·V4·V7·V3는 §2.5 원문 그대로(token-snippet §4). 토큰 형식·payload·`?t=`·12h는 §2.3~§2.6 그대로이고 첫 전달이라 재적용 대상 없음 | R-TOKEN-001 · R-HANDOFF-001~003 |

- 저쪽 재적용이 필요한 변경: 토큰 payload 필드·서명 방식·`?t=` 파라미터 이름·임베드 주소. 이런 변경은 파괴 변경이며 §9에 "저쪽 재적용 필요"로 남긴다.
- S1 변경은 handoff에 영향이 없다.
- (v0.3) 토큰 형식·payload·`?t=` 이름이 §2.3·§2.5에서 확정됐다. `token-snippet.php.md`는 그 절을 그대로 따른다(§2.6). 아직 저쪽에 전달한 것이 없으므로 재적용 대상도 없다.
- (v0.4.1, S3b — R-LLM-007) S5에서 handoff에 **AI 비용 상한 안내** 한 단락을 넣는다(위치는 `embed-guide.md` 운영 메모 절 예정, S5에서 확정). 원문은 llm.md 「contract 인계」 S3b 절의 handoff 메모다. 요지: ① 한도는 토큰 수 × 공개 단가 × 환율로 낸 **추정**이며 실제 청구와 다를 수 있다(단가 변경·환율·캐시 할인·무료 등급·부가세 미반영). ② 키를 발급한 Google 계정의 Cloud Billing에서 **월 10만원 예산 알림**을 따로 설정하기를 권고한다. 예산 알림은 메일만 보내고 사용을 막지 않는다. ③ 한도·단가·환율은 `wrangler.toml [vars]`의 `LLM_MONTHLY_BUDGET_KRW`·`LLM_PRICE_INPUT_USD_PER_M`·`LLM_PRICE_OUTPUT_USD_PER_M`·`KRW_PER_USD`를 고쳐 재배포하면 바뀐다(비밀값 아님). ④ 현황은 `wrangler tail`의 `llm_usage` 로그와 D1 `llm_usage` 테이블 조회로 본다. 토큰·`?t=`·임베드 주소가 그대로라 저쪽 재적용은 없다.
- (v0.5, S3c) **handoff 변경 없음**(토큰 형식·PHP 조각 불변). S5 TODO 2건: ① `embed-guide.md`에 "갠홈 iframe에 `sandbox` 속성을 쓰면 `allow-downloads`를 넣어야 설정 화면 「파일로 저장」이 된다(없어도 복사로 내보낼 수 있다)" 한 줄. ② 갠홈 주인 회원 ID(`OWNER_MB_IDS`)를 지인에게 받는 절차는 server 셋팅 절차 몫이다. handoff·이 문서에는 실제 회원 ID를 쓰지 않는다.
- (v0.6.1, S5 TODO 추가 — verify-S3c SEC-001) `secret-handover.md`에 "운영 `TOKEN_SECRET`은 32자 이상 랜덤이고 개발(`server/.dev.vars`) 값과 달라야 한다"를 적는다. 주인 설정 쓰기(E16) 권한이 이 비밀값 하나에 걸려 있기 때문이다(`mb_id`는 공개값).
- (v0.6.1, S5 TODO 추가) 운영 Secrets 목록(`wrangler secret put`)에 `TOKEN_SECRET`·`LLM_API_KEY`와 함께 `OWNER_MB_IDS`를 넣는다. 값은 지인(갠홈 주인) 회원 ID만이며, 비우면 설정 화면(E15·E16)은 전원 `403 OWNER_ONLY`다. 실제 회원 ID는 handoff·이 문서에 쓰지 않는다.
- (v0.7, S4) **handoff 변경 없음**(토큰·`?t=`·임베드 주소 불변). S5 TODO 1건: 위 AI 비용 상한 안내 단락에 "장기기억 자동 요약 호출(대화가 길어지면 캐릭터 발화 뒤 가끔 1회)도 같은 월 AI 비용에 포함된다"를 한 줄 더한다(R-LLM-007 · R-MEM-002).
- (v0.8, S3f) handoff 설정값 안내를 고쳤다(쉬운 말, 실값 없음): `cloudflare-setup.md` §6 `LLM_MODEL`(주인이 고르기 전 기본 모델 = Pro)·`LLM_PRICE_*`(단가표에 없는 모델용 예비 단가) 뜻, §0·§7·§10 마이그레이션 0004와 적용 순서 · `secret-handover.md` §5 모델·단가 설명 · `embed-guide.md` §7 운영 메모 1줄(주인이 Pro·Flash를 고름, 비용 차이, 테마 파일 변경 없음). **PHP 조각·토큰 형식·`?t=`·임베드 주소 변경 없음 → 저쪽 재적용 없음.**
- (v0.8.1, 2026-10-08 배포 반영) 전달 방식 변경(사용자 결정): 갠홈 패치(head.php·css·js·inc)는 이미 설치돼 있어 지인이 손대는 파일은 `theme/victorian/inc/rosebell-chatbot.php` 하나뿐이다. 우리가 운영 주소(§7)와 SECRET 채운 토큰 조각을 넣은 **완성 파일 1개**를 저장소 밖에서 조립해 카톡 파일로 보내고 지인은 같은 자리에 덮어쓰기만 한다(1회성 비밀 링크 폐기, 조립 규칙 `token-snippet.php.md` §1, 전달 규칙 `secret-handover.md` §2). Cloudflare 접근은 사용자 직접 로그인이 기본이고 구성원 초대는 대안(`cloudflare-setup.md` §1·§1.1). 토큰 형식·PHP 조각 코드·`?t=` 불변이고, 임베드 주소는 빈 값에서 처음 채우는 것이라 재적용 대상이 아니다(첫 적용).
- (v0.9, S6) **PHP 조각·토큰 형식·`?t=`·임베드 주소 변경 없음 → 저쪽 재배포·재적용 없음.** handoff는 우리 몫 안내 두 줄만 더한다: `secret-handover.md` §6 "`TOKEN_SECRET`을 바꾸면 방 비밀번호 기억(입장 증명)도 모두 풀려 잠긴 방 열람자가 비밀번호를 다시 입력해야 한다"(§2.8.1 무효 조건 ③) · `cloudflare-setup.md` §6 `[vars]` `ROOM_ENTER_LIMIT_PER_MIN`(방마다 1분에 비밀번호 입력 5번까지, §6.2) 뜻. 마이그레이션 0005 적용 순서(코드 배포 전)는 server·`/deploy` 몫이다.

---

## 9. 변경 이력

| 버전 | 일자 | 변경 | 호환성 | 저쪽 재적용 |
|---|---|---|---|---|
| v0.1 | 2026-10-05 | 최초 작성(S1). 전체 엔드포인트 표, 에러 코드 13종, S1 엔드포인트 4종 상세, shared 4파일·routes·ui/api 설계 | 추가(신규) | 아니오 |
| v0.2 | 2026-10-05 | §15.4 결정 반영. `CharacterMeta.shortName` 추가(R-LLM-002 개정). S1 화면은 항상 읽기 전용이고 R-CHAT-009는 S2로 이동. 토큰 보관은 `ui/src/state/token.ts`, `client.ts`는 getter 주입(S2 상세 예정). 방 목록 배열 응답과 §10 위치는 유지 | 추가(구현 전이라 영향 없음) | 아니오 |
| v0.2.1 | 2026-10-05 | 구현 완료(S1 routes·ui/api). `MessagesQuery`의 `before?`·`limit?`에 `undefined` 유니온 추가(exactOptionalPropertyTypes 대응). routes 는 서비스 `MessagePageQuery`가 undefined 값을 못 받아 `toPageQuery`로 키를 뺀다 | 비파괴(타입 완화) | 아니오 |
| v0.3 | 2026-10-05 | S2 상세 확정. §2 토큰(전달·형식·`TokenPayload`·검증 순서·화면 보관·읽기 전용 전환·교차 벡터 V1~V8·handoff 참조), §4.5 쓰기 공통, §4.6~§4.11 E4·E5·E6·E8·E10·E11, §6.1 레이트리밋, shared 본문 타입 4개·`ApiErrorBody.error.retryAfterSec?`·`PATHS.room/roomUser/message`, `204` 정규화, ui/api `configureClient`·`isAuthFailure`·쓰기 래퍼 6개, §14.5~§14.7 테스트 | 추가(기존 엔드포인트·타입·필드 변경 없음. `retryAfterSec`는 선택 필드 추가 = 비파괴) | 아니오(handoff 미전달) |
| v0.3.1 | 2026-10-05 | ui-designer 요청(메인 세션 승인). `shared/src/limits.ts` 신규: `ROOM_TITLE_MAX`·`MESSAGE_TEXT_MAX`·`MEMORY_SUMMARY_MAX`·`countCodePoints`·`normalizeText`(§5.7). 서버 서비스와 화면이 같은 길이 규칙을 import. §12.1 행, §13.1 행, API-T-046, S2-R4 | 추가(새 파일, 기존 export 변경 없음) | 아니오 |
| v0.3.1 구현 | 2026-10-05 | S2 구현 완료(routes 쓰기 6종 · ui/api 쓰기 래퍼 6종 · `configureClient` · `isAuthFailure` · `retryAfterSec`). 테스트 API-T-050~066 · API-T-UI-011~018. 계약 내용 변경 없음 | 변경 없음 | 아니오 |
| v0.4 | 2026-10-06 | S3 상세 확정. §4.12 생성 공통(70초 상한·화면 타임아웃 없음/두면 75초 이상·잠금·레이트리밋 카운트), §4.13 E9 speak, §4.14 E12 regenerate, §3.2 S3 5코드 문구 확정(v0.1 문구 유지), `SpeakBody`·`PATHS.roomSpeak/messageRegenerate`·`endpoints` 빌더 2개, routes `speakBody`·`messages.ts` 핸들러 2개, ui/api `speak`·`regenerate`, §12.2·§13.2·§14.9~§14.11·§15.8~§15.10, 「ui 인계 메모」 | 추가(기존 엔드포인트·타입·필드·에러 코드 변경 없음) | 아니오 |
| v0.4.1 | 2026-10-06 | S3b 상세 확정(R-LLM-007 🔒 · R-API-002 개정 13→14종). §3.2 14종째 `LLM_BUDGET_EXCEEDED`(429, 요구 원문 문구, E9·E12만), §3.1·§3.4 `retryAfterSec` 대상 429 두 코드·429 두 종류 구분(ui/api는 `RATE_LIMITED`에만 싣는 현 동작 유지), §3.5, §4.12 월 비용 상한 행·공통 에러, §4.13 판정 4b·§4.14 판정 5b, §5.2 주석·§5.3 errors.ts 3곳, §6.1 S3b 카운트, §8 handoff 메모 예정, §11.11·§12.3·§13.3·§14.12·§14.13·§15.11, 「ui 인계 메모」 S3b, 「contract-implementer 인계 목록」. 엔드포인트·타입·경로 추가 없음 | 추가(에러 코드 1개 추가 = 비파괴. 옛 화면 번들은 §3.4대로 `INTERNAL`로 정규화) | 아니오 |
| v0.4.1 구현 | 2026-10-06 | S3b 구현 완료. shared `errors.ts` 14종, routes·ui/api 소스 변경 없음(재사용), 테스트 API-T-040(갱신)·048·085~090·API-T-UI-022·023, `expectContractError` 두 벌 코드별 `retryAfterSec`(40 / 1356400). 계약 내용 변경 없음 | 변경 없음 | 아니오 |
| v0.5 | 2026-10-06 | S3c 상세 확정(R-SET-001~012 중 contract 몫 · R-API-001 개정 14→16개 · R-API-002 개정 14→15종 · R-AUTH-003 개정). §2.7 설정 엔드포인트 예외·주인 판정, §2.1·§2.4 행, §3.2 15종째 `OWNER_ONLY` 403, §3.1·§3.4 정규화, §4.0 E15·E16, §4.15 GET·§4.16 PUT(본문 128KB·400 첫 위반 문구 규칙·판정 순서), §5.8 타입 4종·errors·endpoints 추가분·`shared/src/settings.ts` 전문·스키마 예외, §6.1 S3c 카운트, §8 S5 TODO, §11.12~§11.14, §12.4, §13.4, §14.14~§14.16, §15.12, §16 파일 형식·가져오기 매핑·비밀값 규칙, 인계 2종 | 추가(엔드포인트 2·에러 코드 1·타입 4·경로 1·shared 파일 1. 기존 요청·응답·status·문구 불변. `validate`·`request` 선택 인자 확장은 내부) | 아니오 |
| v0.5 보정 | 2026-10-06 | server `settings.md`·`auth.md` §12·`env.md` S3c·`db.md` §7.6 대조(시그니처·정규화·에러 매핑 불일치 0건). 메인 세션 결정 5건 반영: `WORLD_FIELD_SPEC.label` `'공통 세계관'` → `'세계관'`(400 문구 `공통 · 세계관은 …`), 나머지 4건 승인 확정. §4.16 본문 상한 설명 보정, §14.14·§14.15 문구 기대값, §15.12 대조 결과·결정 표·남은 불일치(settings.md 쪽 M1~M6), 「ui 인계 메모」 S3c 라벨 행 | 비파괴(구현 전 라벨·문구 변경, 이름 변경 없음) | 아니오 |
| v0.5 보정 2 | 2026-10-06 | ui-design-checker 지적 2건 반영(메인 세션 결정). ① "무시한 항목" = 출처에 값이 있으나 형이 달라 쓸 수 없는 위치만, 출처에 없는 키·매핑 없는 필드·`null`·E.No.S 빈 값은 "없음", 계수는 후보 만들기 한 곳(§16.2 분류 표·§16.3). ② 가져오기는 파일이 준 후보 필드만 검사(저장값 위에 후보를 덮어 `checkCharacterSettings`), 초안 전체 검사는 저장 버튼 활성 조건에서만(§16.2). §16.3 가져오기 단위 테스트 기대값 6행 추가, §5.8.4 쓰는 곳 표·§10 R-SET-008 행·§15.12 결정 6·7 | 비파괴(구현 전 화면 규칙 보정. API·shared 이름·서버 영향 없음) | 아니오 |
| v0.5 구현 | 2026-10-06 | S3c 구현 완료(routes E15·E16 · `validate` `toMessage` · ui/api `getCharacterSettings`·`saveCharacterSettings` · `client` `'PUT'`). 테스트 API-T-091~103 · API-T-UI-024~027. 계약 내용 변경 없음 | 변경 없음 | 아니오 |
| v0.6 | 2026-10-06 | S3d 상세 확정(R-MSG-003·R-AUTH-004·R-CHAT-002·R-CHAT-006·R-NFR-001 개정, R-MSG-009·R-LLM-008·R-CHAT-014 신규). E9 본문 `SpeakTarget`(`'auto'` 추가, §4.13·§5.2), 유저 메시지 `authorName` = `USER_DISPLAY_NAME` 서버 투영(§2.3·§4.3·§4.9·§4.10·§5.5), §4.12 AI 호출 2~3회, §11.15 · §12.5 · §13.5 · §14.17 · §14.18 · §15.13 · 인계 2종 S3d. 엔드포인트·에러 코드·경로·env·마이그레이션 0 | 추가(`'auto'` 값 추가 = 비파괴) + `authorName` **값 규칙 변경**(타입·키 불변, 소비자는 우리 화면 1개이고 server와 동시 배포 — 비파괴로 분류, 근거 §13.5) | 아니오(토큰·`?t=`·임베드 주소·handoff 불변) |
| v0.6 구현 | 2026-10-06 | S3d 구현 완료(routes `speakBody` `SPEAK_TARGETS` 세 값 enum · ui/api `speak` 변경 없음 확인). 테스트 API-T-072(보강) · 108 ~ 111 · API-T-UI-028 · 029, §12.5 실물 파일:줄 | 구현 반영(계약 변경 없음) | 아니오 |
| v0.6 복구 | 2026-10-06 | 0be2f4c에서 지워진 §13~§15·「ui 인계 메모」·「contract-implementer 인계 목록」(S3·S3b분)을 git `11125c2` 원문 그대로 되살렸다 | 변경 없음(문서 복구) | 아니오 |
| v0.6 | 2026-10-06 | S3c 유실분 복원(0be2f4c 절단, 메인 세션 재조립). §13.4 · §14.14~§14.16 · §15.12 · §16(16.1~16.4) · 「ui 인계 메모」 S3c · 「contract-implementer 인계 목록」 S3c를 `.claude/reports/api-v05-recovered-tail.md` 원문 그대로 병합하고 자리표시 7곳을 지웠다. 복원본의 S3·S3b 앵커 줄은 이미 있는 한 벌만 남겼다. §12.4는 contract-implementer 실물 대조표 유지 | 변경 없음(문서 복원) | 아니오 |
| v0.6.1 | 2026-10-07 | S3d verify SEC-002(LOW) 후속. §4.13 부수 효과를 "제공사 호출 최대 3회(`'auto'`: 선택 1 + 생성 1~2 · 지정 캐릭터: 1~2)"로 고치고, 레이트리밋 요청당 1회·월 비용 게이트 선택 앞 1회를 같은 행과 레이트리밋 행에 명시(실물 `server/src/messages/generate.ts` speak 대조). §8 S5 TODO 2건 추가(운영 `TOKEN_SECRET` 32자 이상·개발 값과 다름 — verify-S3c SEC-001 / 운영 Secrets에 `OWNER_MB_IDS`). 같은 기준으로 §6.1 S3 카운트 행 `502` 호출 수 1~3회, §11.8 speak 주석 초안 부수효과 정정. §7 CSP 행을 `/embed` 허용 출처 · `/api/*` `frame-ancestors 'none'`으로 나누고 「기본 보안 헤더」 행 추가(hono `secureHeaders` 기본값, `/api/*`만), §14.1 API-T-004 기대값 갱신 — verify-S3c SEC-003 server 반영분, R-API-006 🔒 원문 개정 필요 | 문구 정정 + `/api/*` 응답 헤더 변경(비파괴 — 소비자는 같은 출처 화면의 fetch뿐이고 JSON을 iframe에 넣지 않는다. `/embed` 헤더 불변) | 아니오 |
| v0.7 | 2026-10-07 | S4 상세 확정(R-MEM-001 🔒 · R-MEM-002 🔒 contract 몫 · R-CHAT-012 🔒 contract 몫 · R-AUTH-003 · R-AUTH-005 · R-NFR-003 🔒). §4.17 E13 `GET /api/rooms/:id/memory`(토큰 필요·주인 판정 없음·레이트리밋 미카운트·행 없음 기본값) · §4.18 E14 `PUT`(trim 후 0~4000 코드 포인트·`sourceUntilId` 유지·본문 32KiB·판정 순서·마지막 저장 승리 경합), §4.0 E13·E14 확정, §2.1·§2.2·§3.5·§4.12·§4.13(응답 뒤 자동 요약 부수 효과)·§5.6·§5.7 행, §5.9 `MemoryResponse`·`PutMemoryBody`·`PATHS.roomMemory`, §6·§6.1 S4 카운트, §8 S5 TODO, §11.16(라우트 `routes/memory.ts`·래퍼 `ui/src/api/memory.ts` 신규), §12.6(예정), §13.6, §14.19·§14.20(API-T-113~124 · API-T-UI-030~032, speak 테스트 `waitOnExecutionContext`), §15.14, 인계 2종 S4. 엔드포인트 16·에러 코드 15·env·마이그레이션 불변 | 추가(타입 2·경로 1·래퍼 2. 기존 요청·응답·status·문구 불변. E9 응답 형태 불변) | 아니오 |
| v0.7 구현 | 2026-10-07 | S4 구현 완료(shared 타입 2·경로 1 · routes `memory.ts` E13·E14 · `schemas.ts` `putMemoryBody`·`MEMORY_BODY_MAX_BYTES` · ui/api `getMemory`·`putMemory`). 테스트 API-T-042(갱신)·113~124 · API-T-UI-030~032, speak 호출 테스트 도우미 `waitOnExecutionContext`, §12.6 실물 파일:줄. 계약 내용 변경 없음 | 구현 반영(계약 변경 없음) | 아니오 |
| v0.7.1 | 2026-10-07 | R-MEM-001 🔒 개정(사용자 지정): E14 PUT에서 trim 결과가 빈 요약이면 `sourceUntilId`를 0으로 되돌린다(요약 삭제 = 처음부터 재요약, 비어 있지 않은 편집은 유지). §4.18 의미·성공·부수 효과·비우기 예시·경합 2행, §4.17 설명, §5.9.1 `sourceUntilId` 주석, §10 R-MEM-001 행, §11.16 `putMemory` 주석, §14.19 API-T-125, §15.14 server 변경 요구 1건(`memory.put`·`memory.putSummary`)·확인 필요 3 해소, 「ui 인계 메모」 S4 비우기 행, 인계 목록 S4 1행. §4.13·§4.17 동작 영향 없음 | 비파괴(응답 `sourceUntilId` 값 규칙 변경 — 타입·키 불변, 화면은 이 값을 표시·분기하지 않는다. 요청·status·문구 불변) | 아니오 |
| v0.7.1 구현 | 2026-10-07 | contract 몫 구현 반영: `routes-memory.test.ts` API-T-125(① `''` ② 공백만 → `sourceUntilId` 0 ③ `'a'` → 21 유지), `types.ts` `MemoryResponse.sourceUntilId` 주석 · `ui/src/api/memory.ts` `putMemory` 주석에 "빈 요약이면 0", §12.6 갱신. 라우트·shared 모양 변경 없음 | 구현 반영(계약 변경 없음) | 아니오 |
| v0.7.2 | 2026-10-07 | S5 handoff 4문서 작성(R-TOKEN-001 🔒 · R-HANDOFF-001 🔒 · R-HANDOFF-002 🔒 · R-HANDOFF-003): `embed-guide.md`(주소 위치·패널 390×640·`?t=`·허용 출처·sandbox·캐시·AI 비용 운영 메모) · `token-snippet.php.md`(조각 전문·위치·LEVEL·교차 벡터 V1·V4·V7·V3·자가 점검) · `secret-handover.md` · `cloudflare-setup.md`. §8 제목·표 2행. PHP 조각은 §2.6 규칙 그대로이고 SECRET 32자 미만이면 발급하지 않는다(서버 하한과 같음, 토큰 형식 무관). 사용자 결정 2026-10-07 반영: `OWNER_MB_IDS` = 지인 회원 ID 1개(실값 미기재) · 모델은 설정 화면 Pro/Flash 선택 예정(설계 중)이라 `LLM_MODEL`·`LLM_PRICE_*`는 폴백 기본값으로 기술 · Cloudflare 접근 방식·플랜은 두 선택지와 권고만(지인 선택) · LEVEL 5 유지. 엔드포인트·타입·에러 코드·토큰 형식 불변 | 추가(문서만) | 아니오(첫 전달 — 저쪽 최초 적용) |
| v0.7.2 보정 | 2026-10-07 | 사용자 결정(지인은 비개발자): handoff 4종을 "지인 최소·나머지 우리" 기준으로 재정렬. SECRET은 우리가 생성·Cloudflare 입력하고 지인에게는 SECRET을 채운 PHP 덩어리를 1회성 비밀 링크로 전달(지인 직접 생성은 대안 강등, secret-handover §2·§7). Cloudflare는 구성원 초대가 기본·API 토큰은 대안, 플랜 Free로 우리가 시작, D1·Secrets·`[vars]`·마이그레이션·배포는 우리 몫(cloudflare-setup §0~§9). embed-guide 지인 할 일 = 주소 한 줄 교체·덩어리 붙이기·확인표, 캐시는 질문 대신 안내(§5.3). token-snippet 머리에 지인용 요약 3줄, §7 `npm run token:test -w server` 실물 사용법(sign·verify·vectors). §8 cloudflare-setup 행 문구 정정. 토큰 형식·PHP 조각 코드·교차 벡터 불변 | 변경 없음(전달 절차·문서만) | 아니오 |
| v0.8 | 2026-10-08 | S3f 상세 확정(R-SET-004·005·007·012 S3f 개정 · R-SET-013 · R-LLM-009 신규의 contract 몫, 승인 ① 2026-10-08). E15 응답 `model: LlmModelKey \| null`(지금 쓰는 모델 키, 후보 밖 `null`, 응답 키 4 → 5, §4.15), E16 본문 `model?`(없으면 유지, `null`·그 밖 `400` `공통 · AI 모델 값이 올바르지 않습니다.`, 판정 6 안 `settings` 다음)·부수 효과(같은 행 `llm_model`, 다음에 시작하는 생성·화자 선택·요약부터)·로그 `settings_saved{mbId, version, model}`(§4.16), §5.8.6 `LlmModelKey`·`LLM_MODEL_KEYS`·`SETTINGS_MODEL_INVALID_MESSAGE`·타입 2곳, §16.1·§16.4 내보내기 제외, §1.4 · §8 · §10 · §11.17 · §12.7(예정) · §13.7 · §14.21(API-T-094 갱신 · 126 ~ 131 · API-T-UI-033 · 034) · §15.15 · 인계 2종 S3f. handoff 설정값 안내(`cloudflare-setup.md` · `secret-handover.md` · `embed-guide.md`). 모델명·단가 비노출. 엔드포인트 16·에러 코드 15·경로·토큰 형식·PHP 조각 불변 | 추가(응답 필드 1·선택 본문 필드 1·shared export 3·400 문구 1. 기존 요청은 그대로 통과하고 기존 응답 키·status·문구 불변 — 근거 §13.7) | 아니오(PHP 조각·토큰·`?t=`·임베드 주소 불변) |
| v0.8 구현 | 2026-10-08 | contract 몫 구현 반영: shared `LlmModelKey` · `LLM_MODEL_KEYS` · `SETTINGS_MODEL_INVALID_MESSAGE`, `schemas.ts` `model` 필드 · `settingsIssueMessage` 순서, `routes/settings.ts` 셋째 인자, `ui/api/settings.ts` `saveCharacterSettings(settings, model?)`, 테스트 API-T-126 ~ 131 · UI-033 · 034, §12.7 갱신. 엔드포인트·에러 코드·토큰 형식 변경 없음 | 구현 반영(계약 변경 없음) | 아니오 |
| v0.8.1 | 2026-10-08 | 운영 배포 반영. §7 운영 주소 행(`https://london-dispatch.pora.workers.dev`, 헬스·`/embed` 200·CSP 확인), §8 전달 방식 메모(완성 `rosebell-chatbot.php` 1개 카톡 덮어쓰기·1회성 링크 폐기·Cloudflare 직접 로그인). handoff 4문서 갱신(`embed-guide.md` 지인 요약·§1·§2 · `token-snippet.php.md` 지인 요약·§1 조립 순서·§3·§6·§7 · `secret-handover.md` 지인 요약·§2 카톡 전달 규칙·§5 API 키 직접 입력·§6·§7·§8 · `cloudflare-setup.md` §0·§1 직접 로그인·§1.1 초대 대안·§3~§8 완료 표시·§9·§10). 엔드포인트·타입·에러 코드·토큰 형식·PHP 조각 코드 불변 | 변경 없음(운영값 기록·전달 절차) | 아니오(첫 적용 — 완성 파일 1회 덮어쓰기) |
| v0.8.2 | 2026-10-08 | 등급 개편(🔒 사용자 결정, 갠홈 등급 1 이하 / 2 / 10). 글쓰기 등급 5 → 10(PHP `RB_CHATBOT_LEVEL` = 서버 `TOKEN_MIN_LEVEL` 운영값, §2.3 6단계) · PHP 조각 3갈래 분기 신설(`RB_CHATBOT_VIEW_LEVEL` 2 — 미만·비로그인은 주소를 비워 iframe 없음 + 패널 가입 안내, §2.6 · §7). handoff `token-snippet.php.md` §1 조립 순서(자리표시 3줄 치환 추가, 조립 뒤 88줄)·§2 조각 전문(55줄)·§2.1·§3·§6·§7, `embed-guide.md` §1·§4·§5.1·§6(세 등급 확인표), `secret-handover.md` §2, `cloudflare-setup.md` §6·§10. 서버 코드·엔드포인트·타입·에러 코드·토큰 형식(payload·서명·`?t=`)·교차 벡터 불변 | 비파괴(계약 값 변경 — 등급 운영값, 서버 설정만. 토큰 형식 불변) | **예 — 새 완성 파일 1회 덮어쓰기**(조각 + 자리표시 3줄. 토큰 형식 변경이 아니라 등급·열람 분기 때문) |
| v0.9 | 2026-10-08 | S6 상세 확정(방 비밀번호 잠금, 승인 ① 2026-10-08 저녁 — R-LOCK-001~009 contract 몫 · 개정 L1 R-API-001 16→19 · L2 R-API-002 15→17 · L3 R-AUTH-003 · L4~L6 R-ROOM-001~004 · L7 R-MSG-001~006·R-MEM-001 · L12 R-CHAT-010). §2.8 방 입장 증명(`e1.` 불투명 문자열·헤더 `X-Room-Key` 전용·만료 없음·무효 조건 3·`ld:roomKeys`·토큰 보관 불변)·관문 적용 표·주인 프리패스·E17 `optionalToken`, §2.1 행, §3.1·§3.2 `ROOM_LOCKED`·`ROOM_PASSWORD_WRONG`(403, `isAuthFailure` 제외), §4.0 E17~E19, §4.2 `locked`, §4.3 E7 관문, §4.5 공통 관문·에러 행·권한 보충, §4.6 E4 `password?`·`CreateRoomResponse`, §4.19 E17(판정 7단계)·§4.20 E18·§4.21 E19, §5.10 shared(타입 6·코드 2·경로 2·헤더 상수·길이 상수 4), §6.1 S6 행·§6.2 입장 시도 상한(방 단위·해시 앞·주인 미계수, `ROOM_ENTER_LIMIT_PER_MIN` 기본 5), §8, §10, §11.18, §12.8(틀), §13.8, §14.22, §15.16, 인계 2종 S6. handoff 두 줄(`secret-handover.md` §6 · `cloudflare-setup.md` §6) | 추가(엔드포인트 3·응답 필드 2·선택 본문 필드 1·선택 헤더 1·에러 코드 2·경로 2) + E5~E14 의미 추가(잠긴 방만 403 — 기존 방은 모두 잠기지 않음, R-LOCK-009). HTTP 파괴 0. ui/api 래퍼 3개(`editMessage`·`deleteMessage`·`regenerate`)에 필수 인자 `roomId` 추가 = ui 내부 호출부 수정(§13.8) | **아니오**(PHP 조각·토큰·`?t=`·임베드 주소 불변) |

---

## 10. 요구 추적표

| 요구ID | 계약 항목 | 절 | 판정 | 호환성 | 테스트ID | 상태 |
|---|---|---|---|---|---|---|
| R-API-001 🔒 | 엔드포인트 집합 14행, `PATHS`, 단건 방 조회 없음, 미등록 메서드 404 | §4.0 · §3.5 · §5.4 · §12 | 신규(S2·S3 확장) | 추가 | API-T-013 · 042 · 045 · 047 · 084 | S1~S3 행 확정, S4 행 예정 |
| R-API-002 🔒 | `{ error: { code, message } }`, 13종 status·문구, (S2) `RATE_LIMITED`만 `retryAfterSec` 추가 | §3 · §5.2 · §5.3 | 신규(S2 확장) | 추가 | API-T-040 · 041 · 054, 모든 에러 테스트의 `expectContractError`, API-T-UI-002·004·005·014 | 확정 |
| R-API-003 🔒 | Bearer 헤더만, `?t=` → `state/token.ts` 메모리, `configureClient` getter 주입, 쓰기 래퍼만 헤더 부착 | §2.2 · §2.4 · §11.6 | 신규 | 추가 | API-T-051, API-T-UI-011 · 012 · 013 · 018 | 확정(S2) |
| R-API-004 | camelCase · epoch ms · id 타입 · zod 검증 · `400 VALIDATION_ERROR` | §5.1 · §5.6 · §4.3 | 신규 | 추가 | API-T-011 · 023 · 030 ~ 032 | 확정 |
| R-API-005 | `GET /api/health` `{ ok: true, version }`, DB 미접근 | §4.1 | 신규 | 추가 | API-T-001 · 002 | 확정 |
| R-API-006 🔒 | `/embed` 정적 서빙, 모든 응답 CSP, `X-Frame-Options` 없음 | §4.4 · §7 | 신규 | 추가 | API-T-004 · 005, SRV-T-080 · 086 | 확정 |
| R-API-007 | 라우트 30줄 이내, 검증 → 서비스 → 응답 | §1.2 · §11.1 | 신규 | 추가 | 리뷰(§14.4) | 확정 |
| R-API-008 🔒 | shared 공유, 경로 리터럴 중복 0 | §5.4 · §11 · §12 | 신규 | 추가 | API-T-042 · 044 | 확정 |
| R-ROOM-001 🔒 | `GET /api/rooms` → `RoomSummary[]` 정렬 보장 | §4.2 · §5.2 | 신규 | 추가 | API-T-010 · 011 · 014 | 확정 |
| R-MSG-001 🔒 | `GET …/messages?before&limit` → `MessagesPage` | §4.3 · §5.2 | 신규 | 추가 | API-T-020 ~ 024 · 030 ~ 034, API-T-UI-008 | 확정 |
| R-AUTH-003 🔒 | 읽기 경로 토큰 불필요·헤더 무시, 쓰기 6개 전건 `requireToken`(라우트 단위), 없으면 `401 TOKEN_REQUIRED` | §2.1 · §2.2 · §4.5 · §11.5 | 신규 | 추가 | API-T-012 · 024 · 050 · 051 · 056 | 확정(S1 읽기 · S2 쓰기) |
| R-AUTH-001 🔒 | 형식·`TokenPayload`·서명 입력 = JSON 바이트·base64url 무패딩, 교차 벡터 V1~V8 | §2.3 · §2.5 | 신규 | 추가 | server SRV-T-100~108, API-T-052 · 061 | 확정(S2) |
| R-AUTH-002 🔒 | 검증 순서 서명 → exp → level, `401 TOKEN_INVALID` / `403 LEVEL_TOO_LOW`, 단계 무관 기본 문구 | §2.3 · §4.5 | 신규 | 추가 | API-T-052 · 053, server SRV-T-103~107 | 확정(S2) |
| R-AUTH-004 (확인 필요 §9-2) | `authorName` = `ch_name` 있으면 `ch_name`, 없으면 `nick` | §2.3 · §4.9 | 신규 | 추가 | API-T-061 | 확정(기본값) |
| R-AUTH-005 (확인 필요 §9-6) | `mb_id` 분 창 20회, `429` + `retryAfterSec` + `Retry-After` | §3.1 · §4.5 · §6.1 | 신규 | 추가 | API-T-054 · 055 · 056, API-T-UI-014 | 확정(기본값) |
| R-AUTH-006 🔒 | 응답에 토큰·payload·`mb_id` 없음, 화면이 토큰을 로그·저장소에 남기지 않음 | §2.3 · §2.4 · §4.5 | 신규 | 추가 | API-T-061(키 대조), API-T-UI-018, server SRV-T-120 | 확정(S2) |
| R-TOKEN-001 🔒 (contract 몫) | handoff가 따를 형식·플래그·벡터, `?t=` 이름 | §2.5 · §2.6 · §8 | 신규 | 추가 | S5 PHP 대조(V1·V7) | 계약 확정, PHP 조각은 S5 |
| R-ROOM-002 🔒 | `POST /api/rooms` `CreateRoomBody` → `201 RoomSummary`, 0·61자 `400` | §4.6 · §5.2 | 신규 | 추가 | API-T-057 · 058 | 확정(S2) |
| R-ROOM-003 🔒 (확인 필요 §9-5) | `PATCH /api/rooms/:id` → `200 RoomSummary`, `updatedAt` 유지, 누구나 | §4.7 | 신규 | 추가 | API-T-059 · 066 | 확정(기본값) |
| R-ROOM-004 🔒 (확인 필요 §9-5) | `DELETE /api/rooms/:id` → `204`, 연쇄 실삭제, 이후 `404`, 누구나 | §4.8 | 신규 | 추가 | API-T-060 · 066 | 확정(기본값) |
| R-MSG-002 🔒 | `POST /api/rooms/:id/user` `UserMessageBody` → `201 Message`, AI 호출 없음 | §4.9 · §5.2 | 신규 | 추가 | API-T-061 · 062, server SRV-T-145 | 확정(S2) |
| R-MSG-004 🔒 | `PATCH /api/messages/:id` `EditMessageBody` → `200 Message` | §4.10 · §5.2 | 신규 | 추가 | API-T-063 · 064 | 확정(S2) |
| R-MSG-005 🔒 | `DELETE /api/messages/:id` → `204` | §4.11 | 신규 | 추가 | API-T-064 · 065 | 확정(S2) |
| R-ROOM-002 · R-MSG-002 · R-MSG-004 · R-MEM-001 (길이 규칙, v0.3.1) | 상한 60·2000·4000, trim 후 코드 포인트 세기를 `@shared/limits` 한 곳에 | §5.7 | 신규 | 추가 | API-T-046 · 058 · 062 | 확정(MEMORY는 S4에서 사용) |
| R-MSG-008 (확인 필요) | 수정·삭제 작성자 제한 없음 | §4.5 · §4.10 · §4.11 | 신규 | 추가 | API-T-066 | 확정(기본값) |
| R-ROOM-005 | 발화 저장·수정·삭제 시 방 `updatedAt` 갱신, 이름 변경은 유지 | §4.7 · §4.9 ~ §4.11 | 신규 | 추가 | API-T-059 · 061 · 063 · 065 | 확정(S2 경로) |
| R-NFR-003 🔒 (레이트리밋 몫) | 초과 `429` | §6.1 | 신규 | 추가 | API-T-054, server SRV-T-114 | 확정(S2 429 · S3 409 — 아래 S3 행) |
| R-ROOMS-002 🔒 | 「+ 새 방」이 쓰는 `createRoom`, 토큰 있을 때만 | §2.4 · §4.6 · §11.6 | 신규 | 추가 | API-T-UI-011, 화면 TC | 계약 확정 |
| R-CHAT-004 🔒 · R-CHAT-006 🔒 | 하단 바 전송이 쓰는 `appendUser`(OOC 토글 = `ooc`), AI 미호출 | §4.9 · §11.6 | 신규 | 추가 | API-T-UI-011, 화면 TC | 계약 확정 |
| R-CHAT-007 🔒 (수정·삭제) | 말풍선 메뉴가 쓰는 `editMessage`·`deleteMessage` | §4.10 · §4.11 · §11.6 | 신규 | 추가 | API-T-UI-011 · 015, 화면 TC | 계약 확정(재작성은 아래 S3 행) |
| R-CHAT-001 🔒 (⋯ 메뉴) | 이름 변경·방 삭제가 쓰는 `renameRoom`·`deleteRoom` | §4.7 · §4.8 · §11.6 | 신규 | 추가 | API-T-UI-011 · 015, 화면 TC | 계약 확정(장기기억은 S4) |
| R-CHAT-009 🔒 | `?t=` 1회 읽기, 메모리만, 쓰기 헤더 부착 | §2.4 · §11.6 | 신규 | 추가 | API-T-UI-011 · 018 | 계약 확정 |
| R-CHAT-011 | 인증 실패 3코드 → 읽기 전용 전환(`isAuthFailure`), `RATE_LIMITED` 안내·`retryAfterSec` | §2.4 · §3.4 · §11.6 | 신규 | 추가 | API-T-UI-014 · 016, 화면 TC | 계약 확정 |
| R-ENV-003 | 모든 경로 `500 CONFIG_INVALID` | §3.2 · §4.1 | 신규 | 추가 | API-T-003 | 확정 |
| R-LLM-002 🔒 (표시 메타, 2026-10-05 개정) | `CHARACTERS`(id·name·shortName·avatar) | §5.5 | 신규 | 추가 | API-T-043 | 확정 |
| R-CHAT-002 🔒 | 말풍선이 쓰는 `speaker`·`kind`·`authorName`·`createdAt`, 캐릭터 메타 | §5.2 · §5.5 | 신규 | 추가 | 화면 TC | 계약 확정 |
| R-CHAT-003 🔒 | 위로 스크롤 시 `before` 페이지, `hasMore` | §4.3 | 신규 | 추가 | API-T-021, 화면 TC | 계약 확정 |
| R-ROOMS-001 🔒 | 방 목록 데이터 | §4.2 | 신규 | 추가 | 화면 TC | 계약 확정 |
| R-NFR-004 🔒 | 응답·로그에 토큰 없음(`?t=` 미기록), 에러 본문에 내부 정보 없음 | §3.1 · §4.4 | 신규 | 추가 | API-T-014, SRV-T-083 · 088 | 확정 |
| R-MSG-003 🔒 (S3) | `POST /api/rooms/:id/speak` `SpeakBody` → `201 Message`(`speaker = character`, `kind 'line'`, `authorName null`), 직전 발화자 무관 | §4.13 · §5.2 · §5.4 | 신규 | 추가 | API-T-070 · 071 · 072 · 073, API-T-UI-019 | 확정(S3, 구현 전) |
| R-MSG-006 🔒 (S3) | `POST /api/messages/:id/regenerate` 본문 없음 → `200 Message`(`text`만 교체), `400 NOT_CHARACTER_MESSAGE` · `409 NOT_LAST_MESSAGE` · `404` | §4.14 · §5.4 | 신규 | 추가 | API-T-078 ~ 083, API-T-UI-019 | 확정(S3, 구현 전) |
| R-MSG-007 🔒 (S3) | 방당 1건, speak·regenerate 같은 잠금, `409 SPEAK_IN_PROGRESS`, 우선순위(잠금 → 마지막 판정) | §4.12 · §4.13 · §4.14 | 신규 | 추가 | API-T-075, server SRV-T-196 · 199 · 207 | 확정(S3) |
| R-NFR-001 🔒 (S3) | 서버 70초 종결, 화면 요청 타임아웃 없음(두면 75초 이상) | §3.4 · §4.12 · §11.9 | 신규 | 추가 | server SRV-T-208, API-T-UI-021 | 확정(S3) |
| R-NFR-003 🔒 (S3 409 몫) | 동시 생성 `409`, 실패한 생성도 레이트리밋 1회 | §4.12 · §6.1 | 확장 | 추가 | API-T-075 · 077, server SRV-T-199 | 확정(S3) |
| R-LLM-002 🔒 (S3 응답 쪽) | 생성 응답 `speaker`는 `CharacterId`, 표시 메타는 화면이 `CHARACTERS[speaker]`(shared). 조회 엔드포인트 없음 | §4.12 · §5.5 | 확장 | 추가 | API-T-070 · 043 | 확정(S3) |
| R-LLM-004 🔒 | 후처리된 `text`(최대 2000자), 빈 결과 `502 LLM_EMPTY` | §3.2 · §4.12 | 신규 | 추가 | API-T-076, server SRV-T-172 · 198 | 확정(S3) |
| R-LLM-005 🔒 | 최종 실패 `502 LLM_FAILED`, 응답은 기본 문구만(제공사 정보 없음), 저장 없음 | §3.2 · §4.12 | 신규 | 추가 | API-T-076 · 083 | 확정(S3) |
| R-API-002 🔒 (S3) | 13종 안 5코드(`SPEAK_IN_PROGRESS`·`NOT_LAST_MESSAGE`·`NOT_CHARACTER_MESSAGE`·`LLM_FAILED`·`LLM_EMPTY`) + `CONFIG_INVALID`, 형식 `{ error: { code, message } }`, 문구 확정 | §3.2 · §4.12 ~ §4.14 | 확장 | 추가 | API-T-072 ~ 083의 `expectContractError`, API-T-UI-020 | 확정(S3) |
| R-ROOM-005 (S3) | speak 저장·regenerate 교체 시 방 `updatedAt` 갱신, 실패 시 불변 | §4.13 · §4.14 | 확장 | 추가 | API-T-070 · 076 · 078 · 083 | 확정(S3) |
| R-ENV-003 (S3) | 키 없음 → speak·regenerate만 `500 CONFIG_INVALID` | §4.12 | 확장 | 추가 | API-T-073 · 074 · 081 | 확정(S3) |
| R-CHAT-005 🔒 | 캐릭터 버튼이 쓰는 `speak`, 「재시도」는 같은 호출, 소요 최대 70초 | §4.13 · §11.9 · 「ui 인계 메모」 | 신규 | 추가 | API-T-UI-019 · 020, 화면 TC | 계약 확정(S3) |
| R-CHAT-007 🔒 (재작성) | 메뉴 재작성이 쓰는 `regenerate`, 표시 조건(캐릭터·마지막)과 `409 NOT_LAST_MESSAGE`의 관계 | §4.14 · 「ui 인계 메모」 | 신규 | 추가 | API-T-UI-019, 화면 TC | 계약 확정(S3) |
| R-CHAT-011 (S3) | `SPEAK_IN_PROGRESS`(생성 중)·`LLM_FAILED`·`LLM_EMPTY`(재시도)·`CONFIG_INVALID`(관리자) 안내의 근거 코드. 생성 실패 코드는 읽기 전용 전환 대상 아님 | §2.4 · §4.12 · 「ui 인계 메모」 | 확장 | 추가 | API-T-UI-020, 화면 TC | 계약 확정(S3) |
| R-API-002 🔒 (S3b 개정, 14종) | 14종째 `LLM_BUDGET_EXCEEDED` 429·요구 원문 문구, `retryAfterSec`가 붙는 코드는 429 두 개 | §3.1 · §3.2 · §3.4 · §5.2 · §5.3 | 확장 | 추가 | API-T-040(갱신) · 048 · 085, API-T-UI-022 · 023 | 확정(S3b) |
| R-LLM-007 🔒 | E9·E12만 키 확인 다음·잠금·제공사 호출 전 `429 LLM_BUDGET_EXCEEDED`, `retryAfterSec` = 다음 달 1일 00:00 KST까지, 다른 엔드포인트 영향 없음, 조회 엔드포인트·health 노출 없음, handoff 추정 안내 | §3.2 · §4.12 · §4.13 · §4.14 · §8 | 확장 | 추가 | API-T-085 ~ 088 · 090, server SRV-T-210~233 | 확정(S3b) |
| R-NFR-003 🔒 (S3b 몫) | 예산 거절도 레이트리밋 1회, 분 한도 초과가 먼저 | §6.1 | 확장 | 추가 | API-T-089 | 확정(S3b) |
| R-CHAT-011 (S3b) | `LLM_BUDGET_EXCEEDED` 안내의 근거 코드, `RATE_LIMITED`와 코드로 구분, 카운트다운·자동 재시도 없음, 읽기 전용 전환 대상 아님 | §2.4 · §3.4 · 「ui 인계 메모」 | 확장 | 추가 | API-T-UI-022 · 023, 화면 TC | 계약 확정(S3b) |
| R-SET-001 🔒 (S3c) | 주인 = 토큰 통과 + `mbId ∈ OWNER_MB_IDS`(지인 ID만), 아니면 `403 OWNER_ONLY`, 빈 목록 전원 403, 등급 검사가 먼저 | §2.7 · §3.2 · §4.15 · §4.16 | 신규 | 추가 | API-T-091 · 092 · 093 · 049 | 계약 확정(S3c) |
| R-SET-002 🔒 (S3c) | 본체 타입(`world` + 2명 × 11필드), strict, trim·코드 포인트 상한·필수 3종·목록 개수, 화면 이름·상한 단일 소스 `settings.ts` | §4.16 · §5.8 | 신규 | 추가 | API-T-096 · 097 · 098 · 105 · 106 · 107 | 계약 확정(S3c) |
| R-SET-003 🔒 (contract 몫) | 응답 `version`·`updatedAt`·`isDefault`(시드 = 0·null·true), 저장 뒤 다음 생성 반영은 부수 효과로 명시 | §4.15 · §4.16 · §5.8 | 신규 | 추가 | API-T-094 · 095 | 계약 확정(S3c) |
| R-SET-004 🔒 | E15 GET, 토큰·주인 필수, `CharacterSettingsResponse`, 레이트리밋 없음 | §4.0 · §4.15 · §11.12 · §11.13 · §12.4 | 신규 | 추가 | API-T-091 ~ 094 · 102 · 103 · 104, API-T-UI-024 · 026 · 027 | 계약 확정(S3c) |
| R-SET-005 🔒 | E16 PUT 전체 교체, 정규화 값 반환, 레이트리밋 1회, 본문 128KB, 400 첫 위반 1건 문구 규칙 | §4.0 · §4.16 · §5.8 · §6.1 · §11.12 · §11.13 | 신규 | 추가 | API-T-095 ~ 103, API-T-UI-025 · 026 | 계약 확정(S3c) |
| R-SET-007 🔒 (contract 몫) | 내보내기 파일 형식(`format`·`formatVersion`·`exportedAt`·`settings`), 화이트리스트, 금지 문자열 | §5.8 · §16.1 · §16.4 | 신규 | 추가 | ui 단위(`toExportFile`) · API-T-105 | 계약 확정(S3c, 구현은 ui) |
| R-SET-008 (contract 몫) | 가져오기 판별·E.No.S 매핑표·5MB·읽지 않는 키·후보 분류(무시 = 값은 있으나 형이 다른 위치만)·후보 필드만 상한 검사, 서버 strict가 마지막 방어 | §16.2 · §16.3 · §16.4 · §4.16 | 신규 | 추가 | ui 단위(`parseImportFile` 벡터 5종) · API-T-096 | 계약 확정(S3c, 구현은 ui) |
| R-SET-010 (contract 몫) | 주인 여부는 E15 status로만, `OWNER_ONLY`는 `isAuthFailure` 밖, 탐침 결과로 전환하지 않음 | §2.4 · §2.7 · §3.2 | 신규 | 추가 | API-T-UI-026, 화면 TC | 계약 확정(S3c) |
| R-API-001 🔒 (S3c 개정) | 엔드포인트 16개, `PATHS.characterSettings`, 미등록 메서드 404 | §4.0 · §5.8 · §12.4 | 확장 | 추가 | API-T-042(갱신) · 103 · 104 | 계약 확정(S3c) |
| R-API-002 🔒 (S3c 개정, 15종) | 15종째 `OWNER_ONLY` 403·문구, 순서 `CONFIG_INVALID` 다음 | §3.2 · §5.8 | 확장 | 추가 | API-T-040(갱신) · 049 · 093 | 계약 확정(S3c) |
| R-AUTH-003 🔒 (S3c 개정) | 설정 GET도 토큰 필요(예외), 두 엔드포인트 라우트 단위 미들웨어 | §2.1 · §2.7 · §4.15 · §11.12 | 확장 | 추가 | API-T-091 | 계약 확정(S3c) |
| R-AUTH-005 (S3c) | E16도 쓰기 공용 분당 한도, `OWNER_ONLY`는 세지 않음, E15는 세지 않음 | §6.1 · §4.16 | 확장 | 추가 | API-T-093 · 102 | 계약 확정(S3c) |
| R-AUTH-006 🔒 (S3c) | 설정 응답·403 본문에 `mbId`·주인 목록·토큰 없음 | §2.7 · §4.15 | 확장 | 추가 | API-T-093 · 094 | 계약 확정(S3c) |
| R-API-003 🔒 · R-API-004 · R-API-007 · R-API-008 (S3c) | 설정 래퍼도 Bearer 헤더만 · camelCase·epoch ms·`null` · 라우트 30줄 이내 · 경로 리터럴은 `endpoints.ts`만 | §2.7 · §5.8 · §11.12 · §11.13 | 확장 | 추가 | API-T-UI-024 · 027, 리뷰 grep(§14.16) | 계약 확정(S3c) |
| R-MSG-003 🔒 (S3d 개정) | `SpeakBody.character: SpeakTarget`(`'sebastian' \| 'ciel' \| 'auto'`), 세 값 밖 `400` | §4.13 · §5.2 · §11.15 | 확장 | 추가 | API-T-110 | 계약 확정(S3d, 구현 전) |
| R-MSG-009 🔒 (S3d 신규) | `'auto'` → `201 Message`, `speaker` = 고른 `CharacterId`, 잠금·월 상한·레이트리밋·에러 표 공유, 판정 5b | §4.12 · §4.13 | 확장 | 추가 | API-T-109 · 111 | 계약 확정(S3d) |
| R-LLM-008 (S3d 신규) | 선택 실패는 계약상 에러 없음(판정 5b), AI 호출 2~3회, 66초 안. 선택 로직은 server 몫 | §4.12 · §4.13 | 확장 | 추가 | server `llm-select.test.ts` | 계약 확정(S3d) |
| R-AUTH-004 🔒 (S3d 개정) | 유저 메시지 `authorName` = `USER_DISPLAY_NAME`, 실명은 D1 `author_name` 저장만, E7·E8·E10 모두 | §2.3 · §4.3 · §4.9 · §4.10 · §5.5 | 확장 | 비파괴(값 규칙 변경, §13.5) | API-T-062(갱신) · 108 · 112 | 계약 확정(S3d) |
| R-CHAT-002 🔒 (S3d 개정) | 화면은 `authorName`을 그대로 표시, `USER_DISPLAY_NAME`은 대체 표시에만 | §5.5 · 「ui 인계 메모」 S3d | 확장 | 비파괴 | API-T-UI-029, 화면 TC | 계약 확정(S3d) |
| R-CHAT-006 🔒 · R-CHAT-014 🔒 (S3d) | 전송 = `appendUser` `201` → `speak(roomId, { character: 'auto' })`. E8은 AI 0회 그대로(R-MSG-002) | §4.9 · §4.13 · §11.15 · 「ui 인계 메모」 S3d | 확장 | 추가 | API-T-UI-028, 화면 TC | 계약 확정(S3d) |
| R-NFR-001 🔒 (S3d 개정) | `'auto'`도 70초, 선택 8초는 LLM 단계 66초 안 | §4.12 · §4.13 | 확장 | 추가 | server fake timer | 계약 확정(S3d) |
| R-API-001 🔒 · R-API-002 🔒 (S3d 확인) | 엔드포인트 16개·에러 코드 15종 그대로 | §4.0 · §3.2 | 변경 없음 | — | API-T-040 · 042 무수정 통과 | 확인(S3d) |
| R-API-004 (S3d) | `'auto'`는 문자열 리터럴 유니온, `authorName`은 `string \| null` 유지 | §5.1 · §5.2 | 확장 | 추가 | tsc | 확인(S3d) |
| R-MEM-001 🔒 (S4) | E13 GET·E14 PUT, `MemoryResponse`(`summary`·`sourceUntilId`·`updatedAt`, 행 없음 = `''`·0·`null`), `PutMemoryBody`, trim 후 코드 포인트 0~4000, PUT은 `sourceUntilId` 유지((v0.7.1) 빈 요약이면 0), 둘 다 토큰 필요, 본문 32KiB, `PATHS.roomMemory` | §2.1 · §4.0 · §4.17 · §4.18 · §5.9 · §11.16 | 확장(§4.0 행 상세화) | 추가 | API-T-113 ~ 122 · 124 · (v0.7.1) 125, API-T-UI-030 ~ 032 | 계약 확정(S4, 구현 전) |
| R-MEM-002 🔒 (contract 몫) | E9 부수 효과: 성공 응답 뒤 백그라운드 자동 요약, 응답·status·소요·레이트리밋 불변, 실패는 로그만. E12·실패한 E9에는 없음 | §4.12 · §4.13 · §6.1 | 확장(부수 효과 명시) | 추가(응답 불변) | API-T-123, server SRV-T-326 · 327 | 계약 확정(S4) |
| R-AUTH-003 🔒 (S4) | E13은 읽기지만 토큰 필요(주인 판정 없음), 라우트 단위 미들웨어 | §2.1 · §2.2 · §4.17 · §11.16 | 확장 | 추가 | API-T-113 · 114 | 계약 확정(S4) |
| R-AUTH-005 · R-NFR-003 🔒 (S4) | E14는 쓰기 공용 분당 한도 1회, E13·자동 요약은 세지 않음 | §6.1 · §4.18 | 확장 | 추가 | API-T-120 · 121 | 계약 확정(S4) |
| R-CHAT-012 🔒 (contract 몫) | 래퍼 `getMemory`·`putMemory`(`Result`, throw 없음, 둘 다 헤더 부착), 시트 열 때마다 GET·경합·비우기 안내 | §11.16 · 「ui 인계 메모」 S4 | 신규(래퍼) | 추가 | API-T-UI-030 ~ 032, 화면 TC | 계약 확정(S4) |
| R-API-001 🔒 · R-API-002 🔒 (S4 확인) | 엔드포인트 16개(E13·E14는 v0.1부터 표에 있음)·에러 코드 15종 그대로 | §4.0 · §3.2 | 변경 없음 | — | API-T-040 무수정 · 042(갱신: `PATHS` 11) · 122 | 확인(S4) |
| R-API-004 (S4) | camelCase · `updatedAt: number \| null` · `sourceUntilId` 정수 | §5.1 · §5.9 | 확장 | 추가 | API-T-114 · 115 · 119 | 확인(S4) |
| R-SET-013 🔒 (S3f, contract 몫) | E16 본문 `model?`로 저장, 응답 `model`, 다음에 시작하는 생성부터 적용(부수 효과), 모델만 저장해도 `version` +1·`isDefault false`, 키는 `LLM_MODEL_KEYS` | §4.15 · §4.16 · §5.8.6 · §11.17 | 확장 | 추가 | API-T-127 · 128, API-T-UI-033 | 계약 확정(S3f, 구현 전) |
| R-LLM-009 🔒 (S3f, contract 몫 — 키만 노출) | `LlmModelKey`·`LLM_MODEL_KEYS`, 응답·본문은 키만, 모델명·단가 비노출 | §4.15 · §5.8.6 · §16.4 | 확장 | 추가 | API-T-126 · 131 | 계약 확정(S3f) |
| R-SET-004 🔒 (S3f 개정) | E15 응답 키 5(`model` = 지금 쓰는 모델 키, 후보 밖 `null`) | §4.15 · §5.8.6 | 확장 | 추가 | API-T-094(갱신) · 126, API-T-UI-034 | 계약 확정(S3f) |
| R-SET-005 🔒 (S3f 개정) | 본문 `model?`(없으면 유지, `null`·그 밖 `400` `공통 · AI 모델 값이 올바르지 않습니다.`), 판정 `settings` → `model`, 모델 400도 레이트리밋 1회 | §4.16 · §5.8.6 · §11.17 | 확장 | 추가 | API-T-127 ~ 130, API-T-UI-033 · 034 | 계약 확정(S3f) |
| R-SET-007 🔒 (S3f 개정, contract 몫) | 모델 키는 내보내기 파일에 없고 가져오기로 바뀌지 않음(파일 형식·`formatVersion 1` 불변) | §16.1 · §16.4 | 확장(명시) | 변경 없음 | ui 단위(내보내기 `model` 0건) · API-T-130 ② | 계약 확정(S3f) |
| R-SET-012 (S3f 개정, contract 몫) | E16 부수 효과의 로그 `settings_saved { mbId, version, model }`(키) | §4.16 | 확장 | 추가(서버 로그) | server SRV-T | 계약 확정(S3f) |
| R-API-001 🔒 · R-API-002 🔒 (S3f 확인) | 엔드포인트 16개·에러 코드 15종·토큰 형식 그대로 | §4.0 · §3.2 · §2.3 | 변경 없음 | — | API-T-040 · 042 무수정 | 확인(S3f) |
| R-API-004 (S3f) | `model`은 문자열 리터럴 유니온, 없음 `null` | §5.1 · §5.8.6 | 확장 | 추가 | tsc | 확인(S3f) |
| R-LOCK-001 🔒 (S6) | E4 본문 `password?`(4~32 코드 포인트, trim 없음, 빈 문자열 위반, 제목 → 비밀번호 순), 응답 `CreateRoomResponse`(`locked`·`entryKey`), INSERT 1문장 원자 | §4.6 · §5.10.1 · §5.10.4 | 확장(E4) | 추가 | API-T-141 ~ 143 | 계약 확정(S6, 구현 전) |
| R-LOCK-002 🔒 (S6) | E18 `PUT`·E19 `DELETE /api/rooms/:id/password`, 토큰 필수 + 관문, E18 응답 `{ room, entryKey }`, E19 `200 RoomSummary` 멱등, `updatedAt` 불변, 변경·해제 뒤 옛 증명 무효 | §4.20 · §4.21 · §5.10 | 신규 | 추가 | API-T-153 ~ 158 | 계약 확정(S6) |
| R-LOCK-003 🔒 (S6) | `RoomSummary.locked`(E3·E4·E5·E18·E19), 해시·증명 비노출. 잠긴 방 날짜 숨김은 화면 몫(응답 불변) | §4.2 · §5.10.1 | 확장 | 추가 | API-T-140 | 계약 확정(S6) |
| R-LOCK-004 🔒 (S6) | E17 입장(판정 7단계, `EnterRoomResponse`), 입장 증명 형식·헤더·만료 없음·무효 조건 3, `ld:roomKeys` 보관 규칙, `ROOM_LOCKED`·`ROOM_PASSWORD_WRONG` | §2.8.1 · §2.8.2 · §3.2 · §4.19 | 신규 | 추가 | API-T-144 ~ 152 · 154 · 157, API-T-UI-035 · 037 | 계약 확정(S6) |
| R-LOCK-005 🔒 (S6) | 주인 프리패스: E17 무비밀번호 증명(미계수) · 토큰 경로 관문 통과 · E7은 증명으로 · 빈 `OWNER_MB_IDS`면 없음 | §2.8.4 · §4.19 ③ | 확장(관문 규칙) | 추가 | API-T-146 · 155 · 159 · 160 | 계약 확정(S6) |
| R-LOCK-006 🔒 (S6) | 관문 적용 표(E5~E14·E18·E19, 방·메시지 대상), `403 ROOM_LOCKED`, 순서(관문 > 본문 `400`, 토큰 실패 > 관문) | §2.8.3 · §4.3 · §4.5 | 확장(의미 추가) | 추가(기존 방 영향 없음) | API-T-159 ~ 163 | 계약 확정(S6) |
| R-LOCK-007 🔒 (S6) | 증명은 `X-Room-Key` 헤더로만(쿼리·본문·쿠키 금지), 응답·로그·에러 문구에 비밀번호·해시·증명 없음, 토큰 보관 규칙 불변 | §2.8.1 · §2.8.2 · §5.10.3 | 확장 | 추가 | API-T-140 · 162, API-T-UI-040, 리뷰 grep | 계약 확정(S6) |
| R-LOCK-008 (S6) | 방 단위 입장 시도 상한(`enter:{roomId}`, 분당 `ROOM_ENTER_LIMIT_PER_MIN` 기본 5, 해시 앞, 주인·비밀번호 없음 미계수), `429 RATE_LIMITED` 상황 문구 + `retryAfterSec` | §6.2 · §4.19 ⑤ | 확장(한도 추가) | 추가 | API-T-148 | 계약 확정(S6) |
| R-LOCK-009 🔒 (S6) | 계약은 추가만(엔드포인트·필드·헤더·코드), 기존 방은 잠기지 않음, 토큰·handoff 형식 불변 | §13.8 | 변경 분류 | 추가 · 의미 추가 | 기존 routes·ui/api 테스트 무수정 통과(`locked` 픽스처·래퍼 셋째 인자 제외) | 계약 확정(S6) |
| R-API-001 🔒 · R-API-002 🔒 (S6 개정 L1·L2) | 엔드포인트 19개(E17~E19)·에러 코드 17종(`ROOM_LOCKED`·`ROOM_PASSWORD_WRONG` 403)·`PATHS` 13 | §4.0 · §3.2 · §5.10.2 · §5.10.3 | 신규 | 추가 | API-T-040(17) · 042(13) | 계약 확정(S6) |
| R-AUTH-003 🔒 (S6 개정 L3) | 읽기는 토큰 불필요 유지, 잠긴 방 E7은 증명 필요, E17 토큰 선택(실패 = 익명) | §2.1 · §2.8.5 · §4.3 · §4.19 | 확장 | 추가 | API-T-151 · 160 | 계약 확정(S6) |
| R-ROOM-001~004 🔒 (S6 개정 L4~L6) | 목록 `locked` · 생성 `password?`·`entryKey` · 잠긴 방 이름 변경·삭제는 증명 또는 주인 | §4.2 · §4.5 · §4.6 | 확장 | 추가 | API-T-140 ~ 143 · 159 | 계약 확정(S6) |
| R-MSG-001~006 · R-MEM-001 (S6 개정 L7) | 잠긴 방이면 관문 먼저(E7~E14) | §2.8.3 · §4.3 · §4.5 | 확장(의미 추가) | 추가(기존 방 영향 없음) | API-T-159 · 160 | 계약 확정(S6) |
| R-CHAT-010 (S6 개정 L12, contract 몫) · R-CHAT-009 🔒 (확인 L13) | `ld:roomKeys` 증명 보관 허용(토큰 아님), `configureClient({ getToken, getRoomKey })`, 토큰 메모리 보관 불변 | §2.8.2 · §11.18 | 확장 | 추가 | API-T-UI-035 · 040 | 계약 확정(S6) |
| R-API-004 (S6) | camelCase(`locked`·`entryKey`), 없음 `null`(`entryKey`), boolean 필드 | §5.10.1 | 확장 | 추가 | tsc | 확인(S6) |

---

## 11. 구현 설계 — routes · ui/api (부록)

### 11.1 `server/src/routes/` 파일 표

| 파일 | 책임 | S1 크기 |
|---|---|---|
| `index.ts` | `apiRoutes = new Hono<AppEnv>()` 조립. 하위 라우터를 `route('/', …)`로 붙인다 | ~15줄 |
| `validate.ts` | zod-validator 래퍼(실패 → `AppError` throw) | ~20줄 |
| `schemas.ts` | `roomIdParam` · `messagesQuery` | ~20줄 |
| `health.ts` | `GET PATHS.health` | ~15줄 |
| `rooms.ts` | `GET PATHS.rooms`(S2에서 POST·PATCH·DELETE 추가) | ~15줄 |
| `messages.ts` | `GET PATHS.roomMessages`(S2·S3에서 user·speak·수정·삭제·재작성 추가) | ~25줄 |

공통 규약(server index.md §9.1):

- 경로는 `PATHS`의 **전체 경로**로 등록한다. `server/src/index.ts`가 `createApp({ routes: apiRoutes })`로 주입하고 `app.route('/', apiRoutes)`로 붙인다.
- 서비스는 `c.get('services')`로만 얻는다. `AppEnv`는 `import type { AppEnv } from '../services'`.
- `c.env`의 설정 키를 읽지 않는다(R-ENV-001). `/embed`·`onError`·`notFound`·CSP를 정의하지 않는다.
- 핸들러 위에 자기문서화 주석 `[계약] · [요구] · [에러] · [부수효과]`를 단다.

### 11.2 routes 초안

```ts
// server/src/routes/index.ts
/**
 * contract 라우트 묶음 — 단일 소스 doc/200_설계/contract/api.md §4 · §11
 * server/src/index.ts 가 createApp({ routes: apiRoutes }) 로 주입한다
 * /embed · onError · notFound · CSP 는 여기 두지 않는다 (server 진입점 소유)
 */
import { Hono } from 'hono'
import type { AppEnv } from '../services'
import { healthRoutes } from './health'
import { messagesRoutes } from './messages'
import { roomsRoutes } from './rooms'

export const apiRoutes = new Hono<AppEnv>()
apiRoutes.route('/', healthRoutes)
apiRoutes.route('/', roomsRoutes)
apiRoutes.route('/', messagesRoutes)
```

- 체인 대신 문장으로 붙인다. 그래야 `apiRoutes`의 타입이 `Hono<AppEnv>` 그대로 남아 `CreateAppOptions.routes`와 맞는다(RPC 타입 추론은 쓰지 않는다).

```ts
// server/src/routes/validate.ts
import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { ZodTypeAny } from 'zod'
import { ERROR_MESSAGES } from '@shared/errors'
import { AppError } from '../app-error'

/**
 * zod 검증 미들웨어. 실패하면 VALIDATION_ERROR(400)를 throw 하고 응답은 진입점 onError 가 만든다
 * zod-validator 기본 실패 응답은 계약 형식이 아니므로 hook 에서 throw 한다 (api.md §3.5)
 */
export const validate = <Target extends keyof ValidationTargets, Schema extends ZodTypeAny>(
  target: Target,
  schema: Schema,
) =>
  zValidator(target, schema, result => {
    if (!result.success) throw new AppError('VALIDATION_ERROR', 400, ERROR_MESSAGES.VALIDATION_ERROR)
  })
```

- 구현 시 제네릭 래퍼 때문에 `c.req.valid()` 타입 추론이 깨지면, 훅만 `onInvalid`로 export하고 `zValidator(target, schema, onInvalid)`를 직접 쓴다. 동작은 같다.
- 설치된 zod 메이저 버전에 따라 `ZodTypeAny`를 `ZodType`으로 바꾼다.

```ts
// server/src/routes/schemas.ts
import { z } from 'zod'

/** 경로 :id — 문자열 그대로. 존재 판정은 서비스(NOT_FOUND) */
export const roomIdParam = z.object({ id: z.string().min(1) })

/** 없음·빈 값 → undefined, 나머지는 Number() 변환만. 정수·범위 판정은 서비스 (messages.md D-MSG-4) */
const numberLike = z
  .string()
  .optional()
  .transform(value => (value === undefined || value.trim() === '' ? undefined : Number(value)))

/** GET /api/rooms/:id/messages 쿼리 (api.md §4.3). 모르는 키는 버린다 */
export const messagesQuery = z.object({ before: numberLike, limit: numberLike })
```

- `Number('abc')`는 `NaN`이 되어 서비스가 `limit`·`before` 문구로 `400`을 낸다(SRV-T-062·064). 같은 키가 반복되면 값이 배열이라 `z.string()`이 실패해 기본 문구 `400`이 나간다.

```ts
// server/src/routes/health.ts
import { Hono } from 'hono'
import { PATHS } from '@shared/endpoints'
import type { HealthResponse } from '@shared/types'
import type { AppEnv } from '../services'

// [계약] api.md §4.1 · [요구] R-API-005 · [에러] CONFIG_INVALID(부트스트랩) · INTERNAL · [부수효과] 없음(DB 미접근)
export const healthRoutes = new Hono<AppEnv>().get(PATHS.health, c => {
  const body: HealthResponse = c.get('services').getHealth()
  return c.json(body, 200)
})
```

```ts
// server/src/routes/rooms.ts
import { Hono } from 'hono'
import { PATHS } from '@shared/endpoints'
import type { RoomSummary } from '@shared/types'
import type { AppEnv } from '../services'

// [계약] api.md §4.2 · [요구] R-ROOM-001 · R-AUTH-003(읽기 토큰 불필요) · [에러] CONFIG_INVALID · INTERNAL · [부수효과] 없음
export const roomsRoutes = new Hono<AppEnv>().get(PATHS.rooms, async c => {
  const rooms: RoomSummary[] = await c.get('services').rooms.listRooms()
  return c.json(rooms, 200)
})
```

```ts
// server/src/routes/messages.ts
import { Hono } from 'hono'
import { PATHS } from '@shared/endpoints'
import type { MessagesPage, MessagesQuery } from '@shared/types'
import type { AppEnv } from '../services'
import { messagesQuery, roomIdParam } from './schemas'
import { validate } from './validate'

// [계약] api.md §4.3 · [요구] R-MSG-001 · R-AUTH-003(읽기 토큰 불필요)
// [에러] VALIDATION_ERROR 400 · NOT_FOUND 404 · CONFIG_INVALID · INTERNAL · [부수효과] 없음
export const messagesRoutes = new Hono<AppEnv>().get(
  PATHS.roomMessages,
  validate('param', roomIdParam),
  validate('query', messagesQuery),
  async c => {
    const { id } = c.req.valid('param')
    const query: MessagesQuery = c.req.valid('query')
    const page: MessagesPage = await c.get('services').messages.listMessages(id, query)
    return c.json(page, 200)
  },
)
```

### 11.3 `ui/src/api/` 초안

| 파일 | export | 비고 |
|---|---|---|
| `client.ts` | `type ApiErrorCode` · `type ApiError` · `type Result<T>` · `NETWORK_ERROR` · `toApiError` · `request` | `request`는 api 폴더 내부 전용(index에서 내보내지 않는다) |
| `health.ts` | `getHealth(): Promise<Result<HealthResponse>>` | 화면에서 쓰지 않아도 4자 대조를 위해 둔다(R-API-001) |
| `rooms.ts` | `listRooms(): Promise<Result<RoomSummary[]>>` | S2: `createRoom`·`renameRoom`·`deleteRoom` 추가 |
| `messages.ts` | `listMessages(roomId: string, query?: MessagesQuery): Promise<Result<MessagesPage>>` | S2·S3: 쓰기 래퍼 추가 |
| `index.ts` | 위 래퍼 함수와 `Result`·`ApiError`·`ApiErrorCode` 타입 재노출 | 화면은 `@/api`만 import |

```ts
// ui/src/api/client.ts
/**
 * fetch 래퍼 — 단일 소스 doc/200_설계/contract/api.md §3.4 · §11.3
 * 모든 래퍼는 throw 하지 않고 Result<T> 를 돌려준다 (ts-rules 에러 처리)
 * 화면·컴포넌트·state 는 fetch 를 직접 쓰지 않는다 (확정사항 §3)
 */
import { ERROR_MESSAGES, isErrorCode, type ErrorCode } from '@shared/errors'

export type ApiErrorCode = ErrorCode | 'NETWORK'
export type ApiError = { code: ApiErrorCode; message: string }
export type Result<T> = { ok: true; value: T } | { ok: false; error: ApiError }

/** 서버가 내지 않는 클라이언트 전용 실패 (api.md §3.3) */
export const NETWORK_ERROR: ApiError = { code: 'NETWORK', message: '서버에 연결할 수 없습니다.' }
const INTERNAL_ERROR: ApiError = { code: 'INTERNAL', message: ERROR_MESSAGES.INTERNAL }

/** 동일 출처. 화면은 서버가 /embed 로 내려주고, dev 는 Vite 가 /api 를 프록시한다 */
const BASE_URL = ''

const buildHeaders = (): Headers => new Headers({ Accept: 'application/json' })
// TODO(R-API-003): S2 상세 예정 — 토큰은 ui/src/state/token.ts 가 보관한다. client.ts 는 getter 를 주입받아
//   쓰기 요청에 Authorization: Bearer 헤더만 붙인다(토큰을 직접 읽거나 저장하지 않는다)

const readJson = async (res: Response): Promise<unknown> => {
  try {
    return await res.json()
  } catch {
    return undefined
  }
}

/** 실패 응답 본문을 계약 형식으로 맞춘다. 계약 형식이 아니면 INTERNAL (api.md §3.4) */
export const toApiError = (body: unknown): ApiError => {
  const error = (body as { error?: { code?: unknown; message?: unknown } } | null | undefined)?.error
  const code = error?.code
  if (!isErrorCode(code)) return INTERNAL_ERROR
  const message = error?.message
  return { code, message: typeof message === 'string' && message !== '' ? message : ERROR_MESSAGES[code] }
}

/** 계약 경로로 GET 요청을 보내고 Result 로 정규화한다. S2 에서 method·body 옵션을 추가한다 */
export const request = async <T>(path: string): Promise<Result<T>> => {
  let res: Response
  try {
    res = await fetch(BASE_URL + path, { method: 'GET', headers: buildHeaders() })
  } catch {
    return { ok: false, error: NETWORK_ERROR }
  }
  const body = await readJson(res)
  if (!res.ok) return { ok: false, error: toApiError(body) }
  return body === undefined ? { ok: false, error: INTERNAL_ERROR } : { ok: true, value: body as T }
}
```

- `fetch`를 `try/catch`로 감싼다. 그래야 동기 throw(테스트 스텁)와 reject(오프라인)를 모두 `NETWORK`로 닫는다. `.catch()`만으로는 동기 throw를 놓친다.
- 성공 본문은 런타임 검증 없이 `T`로 본다. 동일 출처 서버이고 tsc가 양쪽 타입을 같은 shared 타입으로 묶는다.

```ts
// ui/src/api/health.ts
import { endpoints } from '@shared/endpoints'
import type { HealthResponse } from '@shared/types'
import { request, type Result } from './client'

/** [계약] api.md §4.1 · [요구] R-API-005 — 서버 상태 */
export const getHealth = (): Promise<Result<HealthResponse>> => request<HealthResponse>(endpoints.health())
```

```ts
// ui/src/api/rooms.ts
import { endpoints } from '@shared/endpoints'
import type { RoomSummary } from '@shared/types'
import { request, type Result } from './client'

/** [계약] api.md §4.2 · [요구] R-ROOM-001 · R-ROOMS-001 — 방 목록(updatedAt 내림차순, 서버 정렬) */
export const listRooms = (): Promise<Result<RoomSummary[]>> => request<RoomSummary[]>(endpoints.rooms())
```

```ts
// ui/src/api/messages.ts
import { endpoints } from '@shared/endpoints'
import type { MessagesPage, MessagesQuery } from '@shared/types'
import { request, type Result } from './client'

/** [계약] api.md §4.3 · [요구] R-MSG-001 · R-CHAT-003 — 히스토리 한 페이지(오래된→새 순) */
export const listMessages = (roomId: string, query: MessagesQuery = {}): Promise<Result<MessagesPage>> =>
  request<MessagesPage>(endpoints.roomMessages(roomId, query))
```

```ts
// ui/src/api/index.ts
export type { ApiError, ApiErrorCode, Result } from './client'
export { getHealth } from './health'
export { listMessages } from './messages'
export { listRooms } from './rooms'
```

- 화면은 계약 타입(`RoomSummary`·`Message`·`MessagesPage`)을 `@shared/types`에서, 캐릭터 메타를 `@shared/characters`에서 직접 import한다(ts-rules alias 예시와 같다).
- 화면 테스트는 `vi.mock('@/api/rooms')`처럼 래퍼를 모킹한다(tsx-rules). `fetch` 모킹은 `ui/src/api/` 테스트에서만 한다.

### 11.4 구현 순서 (server index.md 확인 필요 항목과 맞춤)

1. contract-implementer: `shared/src/{errors,types,endpoints,characters}.ts` + shared 단위 테스트(API-T-040~043).
2. server-implementer: env·db·rooms·messages·app·services·logger·app-error·`index.ts`(server 테스트는 시험용 라우트로 돈다).
3. contract-implementer: `server/src/routes/*` + `server/test/routes/*`(API-T-001~034), `ui/src/api/*` + `ui/src/api/__tests__/*`(API-T-UI-001~010).
4. 증거: `npx vitest run server/test/routes ui/src/api shared` 결과와 세 워크스페이스 `tsc --noEmit` exit 0.

### 11.5 S2 routes 설계 (`server/src/routes/`)

| 파일 | S2 변경 | 크기(예상) |
|---|---|---|
| `schemas.ts` | `messageIdParam` · `roomTitleBody` · `userMessageBody` · `editMessageBody` 추가 | ~45줄 |
| `rooms.ts` | POST(E4) · PATCH(E5) · DELETE(E6) 추가 | ~45줄 |
| `messages.ts` | POST user(E8) · PATCH(E10) · DELETE(E11) 추가 | ~65줄 |
| `index.ts` · `validate.ts` · `health.ts` | 변경 없음 | — |

규약(server auth.md §9.1, index.md §9.1):

- 쓰기 핸들러마다 `requireToken, rateLimitWrites`를 `validate`보다 **앞에** 붙인다. 둘은 `server/src/auth`에서 import한다. 전역·`apiRoutes.use()` 금지.
- principal은 `getPrincipal(c)`로만 읽는다(`c.get('principal')` 직접 읽기·`!` 단언 금지). S2에서 principal을 넘기는 곳은 E8 하나다.
- `services.auth`·`Authorization` 헤더·`?t=`·쿠키를 라우트가 직접 다루지 않는다. `Retry-After` 헤더도 만들지 않는다(onError 몫).
- `204`는 `c.body(null, 204)`로 답한다. CSP는 진입점 미들웨어가 붙인다.

```ts
// server/src/routes/schemas.ts — S2 추가분 (S1 내용은 그대로)
/** 10진 숫자만 Number(), 그 밖은 NaN. 범위 판정·NOT_FOUND 는 서비스 isMessageId (api.md §4.5) */
const toMessageId = (raw: string): number => (/^[0-9]+$/.test(raw) ? Number(raw) : Number.NaN)

/** 경로 :id — 메시지 id */
export const messageIdParam = z.object({ id: z.string().transform(toMessageId) })

/** POST /api/rooms · PATCH /api/rooms/:id 본문. 타입만 — trim·1~60자는 rooms.normalizeTitle */
export const roomTitleBody = z.object({ title: z.string() })

/** POST /api/rooms/:id/user 본문. ooc 필수 — trim·1~2000자는 messages.normalizeMessageText */
export const userMessageBody = z.object({ text: z.string(), ooc: z.boolean() })

/** PATCH /api/messages/:id 본문 */
export const editMessageBody = z.object({ text: z.string() })
```

```ts
// server/src/routes/rooms.ts — S2 전문
import { PATHS } from '@shared/endpoints'
import type { CreateRoomBody, RenameRoomBody, RoomSummary } from '@shared/types'
import { Hono } from 'hono'
import { rateLimitWrites, requireToken } from '../auth'
import type { AppEnv } from '../services'
import { roomIdParam, roomTitleBody } from './schemas'
import { validate } from './validate'

export const roomsRoutes = new Hono<AppEnv>()
  /// [계약] api.md §4.2 · [요구] R-ROOM-001 · R-AUTH-003(읽기 토큰 불필요) · [에러] CONFIG_INVALID · INTERNAL · [부수효과] 없음
  .get(PATHS.rooms, async c => {
    const rooms: RoomSummary[] = await c.get('services').rooms.listRooms()
    return c.json(rooms, 200)
  })
  /// [계약] api.md §4.6 · [요구] R-ROOM-002 · R-AUTH-003·005 · [에러] §4.5 공통 + VALIDATION_ERROR(제목) · [부수효과] rooms 1행 · 레이트리밋 1회
  .post(PATHS.rooms, requireToken, rateLimitWrites, validate('json', roomTitleBody), async c => {
    const body: CreateRoomBody = c.req.valid('json')
    const room: RoomSummary = await c.get('services').rooms.createRoom(body)
    return c.json(room, 201)
  })
  /// [계약] api.md §4.7 · [요구] R-ROOM-003 · [에러] §4.5 공통 + VALIDATION_ERROR · NOT_FOUND · [부수효과] title 갱신(updatedAt 유지) · 레이트리밋 1회
  .patch(
    PATHS.room,
    requireToken,
    rateLimitWrites,
    validate('param', roomIdParam),
    validate('json', roomTitleBody),
    async c => {
      const { id } = c.req.valid('param')
      const body: RenameRoomBody = c.req.valid('json')
      const room: RoomSummary = await c.get('services').rooms.renameRoom(id, body)
      return c.json(room, 200)
    },
  )
  /// [계약] api.md §4.8 · [요구] R-ROOM-004 · R-DB-003 · [에러] §4.5 공통 + NOT_FOUND · [부수효과] memory·messages·rooms 실삭제 · 레이트리밋 1회
  .delete(PATHS.room, requireToken, rateLimitWrites, validate('param', roomIdParam), async c => {
    const { id } = c.req.valid('param')
    await c.get('services').rooms.deleteRoom(id)
    return c.body(null, 204)
  })
```

```ts
// server/src/routes/messages.ts — S2 전문
import { PATHS } from '@shared/endpoints'
import type { EditMessageBody, Message, MessagesPage, MessagesQuery, UserMessageBody } from '@shared/types'
import { Hono } from 'hono'
import { getPrincipal, rateLimitWrites, requireToken } from '../auth'
import type { AppEnv } from '../services'
import {
  editMessageBody,
  messageIdParam,
  messagesQuery,
  roomIdParam,
  toPageQuery,
  userMessageBody,
} from './schemas'
import { validate } from './validate'

export const messagesRoutes = new Hono<AppEnv>()
  /// [계약] api.md §4.3 · (S1 그대로)
  .get(PATHS.roomMessages, validate('param', roomIdParam), validate('query', messagesQuery), async c => {
    const { id } = c.req.valid('param')
    const query: MessagesQuery = c.req.valid('query')
    const page: MessagesPage = await c.get('services').messages.listMessages(id, toPageQuery(query))
    return c.json(page, 200)
  })
  /// [계약] api.md §4.9 · [요구] R-MSG-002 · R-AUTH-004 · [에러] §4.5 공통 + VALIDATION_ERROR · NOT_FOUND · [부수효과] messages 1행 + 방 updatedAt · AI 호출 없음 · 레이트리밋 1회
  .post(
    PATHS.roomUser,
    requireToken,
    rateLimitWrites,
    validate('param', roomIdParam),
    validate('json', userMessageBody),
    async c => {
      const { id } = c.req.valid('param')
      const body: UserMessageBody = c.req.valid('json')
      const message: Message = await c.get('services').messages.addUserMessage(id, body, getPrincipal(c))
      return c.json(message, 201)
    },
  )
  /// [계약] api.md §4.10 · [요구] R-MSG-004 · R-MSG-008 · [에러] §4.5 공통 + VALIDATION_ERROR · NOT_FOUND · [부수효과] text 갱신 + 방 updatedAt · 레이트리밋 1회
  .patch(
    PATHS.message,
    requireToken,
    rateLimitWrites,
    validate('param', messageIdParam),
    validate('json', editMessageBody),
    async c => {
      const { id } = c.req.valid('param')
      const body: EditMessageBody = c.req.valid('json')
      const message: Message = await c.get('services').messages.editMessage(id, body)
      return c.json(message, 200)
    },
  )
  /// [계약] api.md §4.11 · [요구] R-MSG-005 · R-MSG-008 · [에러] §4.5 공통 + NOT_FOUND · [부수효과] 실삭제 + 방 updatedAt · 레이트리밋 1회
  .delete(PATHS.message, requireToken, rateLimitWrites, validate('param', messageIdParam), async c => {
    const { id } = c.req.valid('param')
    await c.get('services').messages.deleteMessage(id)
    return c.body(null, 204)
  })
```

- 핸들러 본문은 전부 5줄 이내다(R-API-007). 로직은 서비스에 있다.
- 체인에 미들웨어를 앞에 두어도 `c.req.valid()` 타입 추론은 유지된다. 깨지면 S1 §11.2 메모처럼 `onInvalid` 훅을 직접 쓴다.
- `getPrincipal(c)`가 돌려주는 `Principal`은 서비스 인자 `MessageAuthor`(`Pick<Principal, 'mbId' | 'displayName'>`)에 그대로 들어간다.

### 11.6 S2 ui/api 설계 (`ui/src/api/`)

| 파일 | S2 추가 export | 비고 |
|---|---|---|
| `client.ts` | `type ClientConfig` · `configureClient` · `isAuthFailure` · `ApiError.retryAfterSec?` · `request(path, options?)`(`RequestOptions`) | 토큰은 getter로만 읽는다 |
| `rooms.ts` | `createRoom(body: CreateRoomBody): Promise<Result<RoomSummary>>` · `renameRoom(roomId: string, body: RenameRoomBody): Promise<Result<RoomSummary>>` · `deleteRoom(roomId: string): Promise<Result<void>>` | |
| `messages.ts` | `appendUser(roomId: string, body: UserMessageBody): Promise<Result<Message>>` · `editMessage(messageId: number, body: EditMessageBody): Promise<Result<Message>>` · `deleteMessage(messageId: number): Promise<Result<void>>` | `appendUser` = server `addUserMessage`(이름은 화면 구성안을 따른다) |
| `index.ts` | 위 함수 전부와 `ClientConfig` 타입 재노출 | 화면은 `@/api`만 import |

```ts
// ui/src/api/client.ts — S2 전문
/**
 * fetch 래퍼 — 단일 소스 doc/200_설계/contract/api.md §2.4 · §3.4 · §11.6
 * 모든 래퍼는 throw 하지 않고 Result<T> 를 돌려준다 (ts-rules 에러 처리)
 * 토큰은 보관하지 않는다. main.tsx 가 configureClient 로 넘긴 getter 를 쓰기 요청 때만 부른다 (R-API-003)
 */
import { ERROR_MESSAGES, isErrorCode, type ErrorCode } from '@shared/errors'

export type ApiErrorCode = ErrorCode | 'NETWORK'
export type ApiError = {
  code: ApiErrorCode
  message: string
  /** RATE_LIMITED 에만. 다음 시도까지 기다릴 초(정수 ≥ 1) (api.md §3.4) */
  retryAfterSec?: number
}
export type Result<T> = { ok: true; value: T } | { ok: false; error: ApiError }

/** 토큰 getter 주입. 보관은 ui/src/state/token.ts (api.md §2.4) */
export type ClientConfig = { getToken: () => string | null }

/** 서버가 내지 않는 클라이언트 전용 실패 (api.md §3.3) */
export const NETWORK_ERROR: ApiError = { code: 'NETWORK', message: '서버에 연결할 수 없습니다.' }
const INTERNAL_ERROR: ApiError = { code: 'INTERNAL', message: ERROR_MESSAGES.INTERNAL }

/** 동일 출처. 화면은 서버가 /embed 로 내려주고, dev 는 Vite 가 /api 를 프록시한다 */
const BASE_URL = ''

/** getter 슬롯 하나. 바꾸는 곳은 configureClient 뿐이다 (ts-rules 클로저 캡슐화) */
const createTokenSlot = () => {
  let getToken: ClientConfig['getToken'] = () => null
  return {
    set: (next: ClientConfig['getToken']): void => {
      getToken = next
    },
    read: (): string | null => getToken(),
  }
}
const tokenSlot = createTokenSlot()

/** main.tsx 가 렌더 전에 한 번 부른다 (api.md §2.4). 테스트는 매번 다시 불러 바꾼다 */
export const configureClient = (config: ClientConfig): void => tokenSlot.set(config.getToken)

/** 읽기 전용으로 전환해야 하는 인증 실패인가 (api.md §2.4, R-CHAT-011) */
const AUTH_FAILURE_CODES: readonly ApiErrorCode[] = ['TOKEN_REQUIRED', 'TOKEN_INVALID', 'LEVEL_TOO_LOW']
export const isAuthFailure = (error: ApiError): boolean => AUTH_FAILURE_CODES.includes(error.code)

/** api 폴더 내부 전용. auth = 쓰기 요청(토큰 헤더 부착). index 에서 내보내지 않는다 */
export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  auth?: boolean
}

const buildHeaders = ({ body, auth }: RequestOptions): Headers => {
  const headers = new Headers({ Accept: 'application/json' })
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  const token = auth === true ? tokenSlot.read() : null
  if (token !== null && token !== '') headers.set('Authorization', `Bearer ${token}`)
  return headers
}

const readJson = async (res: Response): Promise<unknown> => {
  try {
    return await res.json()
  } catch {
    return undefined
  }
}

/** RATE_LIMITED 이고 1 이상 정수일 때만 retryAfterSec 를 싣는다 (api.md §3.4) */
const toRetryAfter = (code: ErrorCode, value: unknown): { retryAfterSec?: number } =>
  code === 'RATE_LIMITED' && typeof value === 'number' && Number.isInteger(value) && value >= 1
    ? { retryAfterSec: value }
    : {}

/** 실패 응답 본문을 계약 형식으로 맞춘다. 계약 형식이 아니면 INTERNAL (api.md §3.4) */
export const toApiError = (body: unknown): ApiError => {
  const error = (
    body as { error?: { code?: unknown; message?: unknown; retryAfterSec?: unknown } } | null | undefined
  )?.error
  const code = error?.code
  if (!isErrorCode(code)) return INTERNAL_ERROR
  const message = error?.message
  return {
    code,
    message: typeof message === 'string' && message !== '' ? message : ERROR_MESSAGES[code],
    ...toRetryAfter(code, error?.retryAfterSec),
  }
}

/** 계약 경로로 요청을 보내고 Result 로 정규화한다. 204 는 value undefined (api.md §3.4) */
export const request = async <T>(path: string, options: RequestOptions = {}): Promise<Result<T>> => {
  const { method = 'GET', body } = options
  let res: Response
  try {
    res = await fetch(BASE_URL + path, {
      method,
      headers: buildHeaders(options),
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
  } catch {
    return { ok: false, error: NETWORK_ERROR }
  }
  if (!res.ok) return { ok: false, error: toApiError(await readJson(res)) }
  if (res.status === 204) return { ok: true, value: undefined as T }
  const parsed = await readJson(res)
  return parsed === undefined ? { ok: false, error: INTERNAL_ERROR } : { ok: true, value: parsed as T }
}
```

```ts
// ui/src/api/rooms.ts — S2 추가분
import type { CreateRoomBody, RenameRoomBody } from '@shared/types'

/** [계약] api.md §4.6 · [요구] R-ROOM-002 · R-ROOMS-002 — 방 생성(201 RoomSummary) */
export const createRoom = (body: CreateRoomBody): Promise<Result<RoomSummary>> =>
  request<RoomSummary>(endpoints.rooms(), { method: 'POST', body: { title: body.title }, auth: true })

/** [계약] api.md §4.7 · [요구] R-ROOM-003 · R-CHAT-001 — 이름 변경(updatedAt 유지) */
export const renameRoom = (roomId: string, body: RenameRoomBody): Promise<Result<RoomSummary>> =>
  request<RoomSummary>(endpoints.room(roomId), { method: 'PATCH', body: { title: body.title }, auth: true })

/** [계약] api.md §4.8 · [요구] R-ROOM-004 · R-CHAT-001 — 방 삭제(204 → value undefined) */
export const deleteRoom = (roomId: string): Promise<Result<void>> =>
  request<void>(endpoints.room(roomId), { method: 'DELETE', auth: true })
```

```ts
// ui/src/api/messages.ts — S2 추가분
import type { EditMessageBody, Message, UserMessageBody } from '@shared/types'

/** [계약] api.md §4.9 · [요구] R-MSG-002 · R-CHAT-004 · R-CHAT-006 — 유저 발화·지시 저장(201 Message). AI 호출 없음 */
export const appendUser = (roomId: string, body: UserMessageBody): Promise<Result<Message>> =>
  request<Message>(endpoints.roomUser(roomId), {
    method: 'POST',
    body: { text: body.text, ooc: body.ooc },
    auth: true,
  })

/** [계약] api.md §4.10 · [요구] R-MSG-004 · R-CHAT-007 — 메시지 수정(200 Message) */
export const editMessage = (messageId: number, body: EditMessageBody): Promise<Result<Message>> =>
  request<Message>(endpoints.message(messageId), { method: 'PATCH', body: { text: body.text }, auth: true })

/** [계약] api.md §4.11 · [요구] R-MSG-005 · R-CHAT-007 — 메시지 삭제(204 → value undefined) */
export const deleteMessage = (messageId: number): Promise<Result<void>> =>
  request<void>(endpoints.message(messageId), { method: 'DELETE', auth: true })
```

```ts
// ui/src/api/index.ts — S2 전문
export type { ApiError, ApiErrorCode, ClientConfig, Result } from './client'
export { configureClient, isAuthFailure } from './client'
export { getHealth } from './health'
export { appendUser, deleteMessage, editMessage, listMessages } from './messages'
export { createRoom, deleteRoom, listRooms, renameRoom } from './rooms'
```

- 쓰기 래퍼는 본문을 **계약 키로 다시 만든다**(`{ title: body.title }`). 변수로 넘긴 객체에 남는 여분 키가 서버로 새지 않는다. trim은 하지 않는다(서버 몫).
- 읽기 래퍼(`getHealth`·`listRooms`·`listMessages`)는 `auth`를 주지 않는다. 그래서 토큰이 있어도 헤더가 붙지 않는다(§2.1).
- `request`·`RequestOptions`·`toApiError`·`NETWORK_ERROR`는 api 폴더 내부용이다. index에서 내보내지 않는다.
- 화면 쪽 연결(ui 설계 몫, 계약이 요구하는 것만): `main.tsx`가 렌더 전에 `ui/src/state/token.ts`로 `?t=`를 읽고 `configureClient({ getToken })`를 부른다. 화면은 쓰기 결과가 `isAuthFailure(result.error)`이면 토큰 state를 버려 읽기 전용으로 바꾼다(§2.4).

### 11.7 S2 구현 순서

1. contract-implementer: `shared/src/types.ts`(본문 타입 4개 · `retryAfterSec?`) · `endpoints.ts`(경로 3개 · 빌더 3개) + shared 테스트(API-T-042 갱신 · 045). server `toErrorBody`가 `ApiErrorBody`를 쓰려면 이것이 먼저다.
2. server-implementer: `auth/` · rooms·messages S2 함수 · `services.ts` · `app-error.ts`(`retryAfterSec`) · onError(server index.md §484 순서).
3. contract-implementer: routes S2(§11.5) + `server/test/routes.test.ts`의 API-T-050~066(§14.5). `signTestToken`은 server가 만든 `server/test/token.ts`를 쓴다.
4. contract-implementer: ui/api S2(§11.6) + API-T-UI-011~018(§14.7). 3과 서로 의존하지 않는다(shared만 필요).
5. ui-implementer: `ui/src/state/token.ts` · `main.tsx`의 `configureClient` 호출 · `viewer` 계산 · 쓰기 화면.
6. 증거: `npx vitest run server shared ui/src/api` 결과와 세 워크스페이스 `tsc --noEmit` exit 0.

### 11.8 S3 routes 설계 (`server/src/routes/`)

| 파일 | S3 변경 | 크기(예상) |
|---|---|---|
| `schemas.ts` | `CHARACTER_IDS`(내부 상수) · `speakBody` 추가 | ~48줄 |
| `messages.ts` | POST speak(E9) · POST regenerate(E12) 추가 | ~110줄 |
| `rooms.ts` · `index.ts` · `validate.ts` · `health.ts` | 변경 없음 | — |

- **E9를 `messages.ts`에 두는 이유:** 라우트 파일은 경로 접두어가 아니라 **부르는 서비스**로 나눈다. S2의 `POST /api/rooms/:id/user`(E8)도 `messages.addUserMessage`를 불러 `messages.ts`에 있다. E9는 `messages.speak`를 부르고, `rooms.ts`는 `rooms` 서비스만 부른다. 합쳐도 ~110줄로 400줄 한계 안이다.
- 미들웨어 순서는 S2와 같다: `requireToken, rateLimitWrites, validate('param', …), validate('json', …)`. E12는 `validate('json')`을 붙이지 않는다(본문 무시).
- `background`는 `{ waitUntil: task => c.executionCtx.waitUntil(task) }`로 만든다. `c.executionCtx`는 **콜백 안에서만** 읽는다. 핸들러 본문에서 미리 읽어 변수에 두지 않는다. S3에는 훅이 없어 콜백이 불리지 않는다(llm.md 「contract 인계 요구 명세」).
- 에러 변환은 S2와 같다. 서비스가 던진 `AppError`·`ConfigError`를 server `onError`가 `{ error: { code, message } }`로 바꾼다. 라우트는 try/catch·`c.json({ error })`를 쓰지 않는다.
- principal을 쓰지 않는다. `getPrincipal(c)`를 부르지 않는다(서비스가 작성자를 받지 않는다, messages.md D-MSG-12). 인증·레이트리밋은 미들웨어가 끝낸다.

```ts
// server/src/routes/schemas.ts — S3 추가분
import type { CharacterId } from '@shared/types'

/** CharacterId 와 같은 두 값. 캐릭터는 2명 고정(확정사항 §1) */
const CHARACTER_IDS = ['sebastian', 'ciel'] as const satisfies readonly CharacterId[]

/** POST /api/rooms/:id/speak 본문. 두 값 밖 → 400 VALIDATION_ERROR(기본 문구) (api.md §4.13) */
export const speakBody = z.object({ character: z.enum(CHARACTER_IDS) })
```

```ts
// server/src/routes/messages.ts — S3 추가분 (S2 체인의 .delete 다음에 잇는다)
// import: SpeakBody 는 '@shared/types' 목록에, speakBody 는 './schemas' 목록에 합친다

  /// [계약] api.md §4.13 · [요구] R-MSG-003 · R-MSG-007 · R-NFR-001 · [에러] §4.5·§4.12 공통 + VALIDATION_ERROR · NOT_FOUND · [부수효과] messages 1행 + 방 updatedAt · 잠금 · 제공사 호출 최대 3회(auto 선택 1 + 생성 1~2) · 레이트리밋 1회
  .post(
    PATHS.roomSpeak,
    requireToken,
    rateLimitWrites,
    validate('param', roomIdParam),
    validate('json', speakBody),
    async c => {
      const { id } = c.req.valid('param')
      const body: SpeakBody = c.req.valid('json')
      const message: Message = await c
        .get('services')
        .messages.speak(id, body, { waitUntil: task => c.executionCtx.waitUntil(task) })
      return c.json(message, 201)
    },
  )
  /// [계약] api.md §4.14 · [요구] R-MSG-006 · R-MSG-007 · R-NFR-001 · [에러] §4.5·§4.12 공통 + NOT_FOUND · NOT_CHARACTER_MESSAGE · NOT_LAST_MESSAGE · [부수효과] text 교체 + 방 updatedAt · 잠금 · AI 1~2회 · 레이트리밋 1회
  .post(
    PATHS.messageRegenerate,
    requireToken,
    rateLimitWrites,
    validate('param', messageIdParam),
    async c => {
      const { id } = c.req.valid('param')
      const message: Message = await c.get('services').messages.regenerate(id)
      return c.json(message, 200)
    },
  )
```

- 핸들러 본문은 5줄 이내다(R-API-007).
- `const body: SpeakBody = c.req.valid('json')` 대입이 zod 결과와 shared 타입을 tsc로 대조한다(§5.6).

### 11.9 S3 ui/api 설계 (`ui/src/api/`)

| 파일 | S3 추가 export | 비고 |
|---|---|---|
| `messages.ts` | `speak(roomId: string, body: SpeakBody): Promise<Result<Message>>` · `regenerate(messageId: number): Promise<Result<Message>>` | 이름은 서버 서비스와 같다 |
| `index.ts` | `speak` · `regenerate` 재노출 | 화면은 `@/api`만 import |
| `client.ts` | **변경 없음** | 타임아웃·재시도를 넣지 않는다 |

```ts
// ui/src/api/messages.ts — S3 추가분
// import: SpeakBody 를 '@shared/types' 목록에 합친다

/** [계약] api.md §4.13 · [요구] R-MSG-003 · R-CHAT-005 — 캐릭터 1턴 생성(201 Message). 최대 70초 */
export const speak = (roomId: string, body: SpeakBody): Promise<Result<Message>> =>
  request<Message>(endpoints.roomSpeak(roomId), {
    method: 'POST',
    body: { character: body.character },
    auth: true,
  })

/** [계약] api.md §4.14 · [요구] R-MSG-006 · R-CHAT-007 — 같은 캐릭터로 재생성(200 Message). 본문 없음. 최대 70초 */
export const regenerate = (messageId: number): Promise<Result<Message>> =>
  request<Message>(endpoints.messageRegenerate(messageId), { method: 'POST', auth: true })
```

```ts
// ui/src/api/index.ts — S3 변경 줄
export { appendUser, deleteMessage, editMessage, listMessages, regenerate, speak } from './messages'
```

래퍼 규약(S3):

| 항목 | 규칙 |
|---|---|
| 반환 | `Result<Message>`. throw·reject 없음(§3.4). 실패는 `error.code`로만 분기한다 |
| 토큰 | `auth: true` — 쓰기 래퍼 규칙 그대로(§2.2). getter가 `null`이면 헤더 없이 보내고 서버의 `TOKEN_REQUIRED`를 그대로 돌려준다 |
| 본문 | `speak`는 `{ character }`만 다시 만들어 보낸다. `regenerate`는 본문·`Content-Type`을 보내지 않는다 |
| 타임아웃 | **없음 — 서버 종결(70초)에 의존한다.** `client.ts`에 `AbortSignal`·타이머가 없고 S3에서도 넣지 않는다. 넣게 되면 이 두 래퍼는 75초 이상이어야 한다(§4.12) |
| 자동 재시도 | 없음. 「재시도」는 화면이 같은 래퍼를 다시 부르는 것이다(R-CHAT-005) |
| 동시 호출 | 래퍼는 막지 않는다. 생성 중 두 버튼·전송 잠금은 화면 몫이다(R-CHAT-005). 다른 탭·다른 사람과 겹치면 서버가 `409`로 막는다 |
| 인증 실패 | `isAuthFailure(error)`이면 S2와 같이 읽기 전용 전환(§2.4). 생성 실패 코드(`409`·`400 NOT_CHARACTER_MESSAGE`·`500`·`502`)는 전환하지 않는다 |

### 11.10 S3 구현 순서

1. contract-implementer: `shared/src/types.ts`(`SpeakBody`) · `endpoints.ts`(경로 2개 · 빌더 2개) + shared 테스트(API-T-042 갱신 · 047). server `messages/generate.ts`가 `SpeakBody`를 import하므로 이것이 먼저다(messages.md §2.3).
2. server-implementer: `server/src/llm/` · `messages.speak`·`regenerate` · db 잠금 함수 · `services.ts` 배선(llm.md §3.3).
3. contract-implementer: routes S3(§11.8) + `server/test/routes-generate.test.ts`의 API-T-070~084 + `server/test/routes-write.test.ts`의 쓰기 표에 E9·E12 추가(API-T-050~053이 8개를 돈다).
4. contract-implementer: ui/api S3(§11.9) + API-T-UI-019~021(§14.11). 3과 서로 의존하지 않는다(shared만 필요).
5. ui-implementer: 캐릭터 버튼·임시 말풍선·재작성 메뉴·S3 오류 문구(ui 설계 몫).
6. 증거: `npx vitest run --project shared` · `--project server` · `--project ui` 결과와 세 워크스페이스 `tsc --noEmit` exit 0.

### 11.11 S3b 구현 부록 (v0.4.1 — 엔드포인트·래퍼 추가 없음)

| 파일 | 소유 | 변경 |
|---|---|---|
| `shared/src/errors.ts` | contract | `ERROR_CODES`에 `'LLM_BUDGET_EXCEEDED'`(`'LLM_EMPTY'` 다음) · `ERROR_STATUS.LLM_BUDGET_EXCEEDED = 429` · `ERROR_MESSAGES.LLM_BUDGET_EXCEEDED` = 요구 원문(§5.3). 3곳 |
| `shared/src/types.ts` | contract | `ApiErrorBody.error.retryAfterSec?` 문서주석만(§5.2). 타입 변경 없음 |
| `server/src/routes/*` | contract | **변경 없음.** 라우트는 판정 순서를 모른다. 미들웨어 순서(`requireToken → rateLimitWrites → validate`)가 §6.1 S3b 카운트를 이미 만족한다 |
| `server/src/app.ts` · `app-error.ts` | server | 주석만 두 코드로 넓힘(index.md §2.4 S3b). `errorResponse`는 코드 종류를 보지 않으므로 코드 변경 없음 — contract는 재사용만 한다 |
| `ui/src/api/client.ts` | contract | **코드 변경 없음.** `isErrorCode`가 shared를 따라 14종을 받고, `toRetryAfter`는 `RATE_LIMITED`에만 싣는다(§3.4 429 구분). `ApiError.retryAfterSec?` 주석 "RATE_LIMITED 에만"은 그대로 맞다 |
| `ui/src/api/{messages,index}.ts` | contract | 변경 없음. `speak`·`regenerate` 시그니처·`Result<Message>` 그대로 |

구현 순서:

1. contract-implementer: `shared/src/errors.ts` 3곳 + `types.ts` 주석 + shared 테스트(API-T-040 갱신 · 048). server `AppError`가 `ErrorCode`로 이 코드를 받으려면 이것이 먼저다(llm.md §12.10).
2. server-implementer: S3b(llm `usage.ts`·`ensureBudget`, db `llm_usage`·`0002_llm_usage.sql`·`helpers.ts insertUsage`, env 4키, messages 게이트 2줄, app 주석).
3. contract-implementer: `server/test/routes-generate.test.ts` API-T-085~090 + `expectContractError` 두 벌(`routes-write.test.ts`·`routes-generate.test.ts`) 갱신(§14.12). 2 뒤.
4. contract-implementer: `ui/src/api/api.test.ts` API-T-UI-022·023(§14.13). 1 뒤면 2·3과 무관.
5. ui-implementer: `labels.ts` 문구 · 실패 말풍선 처리(ui 설계 몫).
6. 증거: `npx vitest run --project shared` · `--project server` · `--project ui` 결과와 세 워크스페이스 `tsc --noEmit` exit 0.


### 11.12 S3c routes 설계 (`server/src/routes/`)

| 파일 | S3c 변경 | 크기(예상) |
|---|---|---|
| `validate.ts` | 세 번째 선택 인자 `toMessage?: (data: unknown) => string \| undefined`. 기존 호출은 그대로(기본 문구) | ~20줄 |
| `schemas.ts` | `putCharacterSettingsBody` · `settingsIssueMessage` · `SETTINGS_BODY_TOO_LARGE` 추가 | ~70줄 |
| **신규** `settings.ts` | `settingsRoutes` — E15 GET · E16 PUT · 본문 상한 미들웨어 | ~45줄 |
| `index.ts` | `apiRoutes.route('/', settingsRoutes)` 한 줄 | ~16줄 |
| `rooms.ts` · `messages.ts` · `health.ts` | 변경 없음 | — |

- **파일을 따로 두는 이유:** 라우트 파일은 부르는 서비스로 나눈다(§11.8). E15·E16은 `services.settings`만 부른다.
- 미들웨어 순서는 §2.7 · §4.16 판정 순서 그대로다. `requireOwner`는 server `auth`가 내보낸다(s3c-03 §1.3). 라우트는 `isOwner`를 직접 부르지 않는다.
- 본문 상한은 `hono/body-limit`의 `bodyLimit`(hono 4.13 내장, 새 패키지 아님)이다. 기본 실패는 `413` 텍스트라 `onError` 옵션에서 `AppError('VALIDATION_ERROR', SETTINGS_BODY_TOO_LARGE)`를 throw한다. throw는 server `onError`로 간다(본문 형식·CSP 그대로). §7의 라우트 금지 목록(secure-headers·cors·logger)에 들지 않는다.
- 에러 변환·try/catch 금지·principal 규칙은 S2·S3와 같다. principal은 E16에서만 `getPrincipal(c)`로 꺼내 `put`에 넘긴다(저장자 기록 = `mbId`만, server 몫).

```ts
// server/src/routes/validate.ts — S3c 변경 (선택 인자 추가, 기존 호출 영향 없음)
export const validate = <Target extends keyof ValidationTargets, Schema extends ZodType>(
  target: Target,
  schema: Schema,
  /** 실패 문구를 정하는 함수(E16). undefined 를 돌려주거나 생략하면 기본 문구 (api.md §4.16) */
  toMessage?: (data: unknown) => string | undefined,
) =>
  zValidator(target, schema, result => {
    if (!result.success) throw new AppError('VALIDATION_ERROR', toMessage?.(result.data))
  })
```

```ts
// server/src/routes/schemas.ts — S3c 추가분
// import 추가: checkCharacterSettings 는 '@shared/settings', characterSettingsSchema 는 '../settings'(server 소유)

/** PUT /api/settings/characters 본문. 봉투 모르는 키는 버리고, settings 안은 server 스키마가 strict (api.md §4.16) */
export const putCharacterSettingsBody = z.object({ settings: characterSettingsSchema })

/** E16 400 문구 — 판정은 zod, 문구는 shared 사전 검사의 첫 위반 1건. 둘이 어긋나면 undefined → 기본 문구 */
export const settingsIssueMessage = (data: unknown): string | undefined => {
  const settings = typeof data === 'object' && data !== null && 'settings' in data ? data.settings : undefined
  const checked = checkCharacterSettings(settings)
  return checked.ok ? undefined : checked.issue.message
}

/** E16 본문 상한 초과 문구 (api.md §4.16 판정 4) */
export const SETTINGS_BODY_TOO_LARGE = '공통 · 설정 본문은 128KB 이하여야 합니다.'
```

```ts
// server/src/routes/settings.ts — 신규
/**
 * [목적] 캐릭터 설정 E15 · E16 (api.md §4.15 · §4.16). 갠홈 주인 전용
 * [요구] R-SET-001 · R-SET-004 · R-SET-005 · R-AUTH-003(설정 GET 토큰 예외) · R-AUTH-005
 * [에러] 서비스·미들웨어가 throw → server onError. 라우트는 변환하지 않는다
 */
import { PATHS } from '@shared/endpoints'
import { SETTINGS_BODY_MAX_BYTES } from '@shared/settings'
import type { CharacterSettingsResponse, PutCharacterSettingsBody } from '@shared/types'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { AppError } from '../app-error'
import { getPrincipal, rateLimitWrites, requireOwner, requireToken } from '../auth'
import type { AppEnv } from '../services'
import { putCharacterSettingsBody, SETTINGS_BODY_TOO_LARGE, settingsIssueMessage } from './schemas'
import { validate } from './validate'

/** 본문 128KB 초과 → 400 VALIDATION_ERROR (hono 기본 413 을 쓰지 않는다) */
const settingsBodyLimit = bodyLimit({
  maxSize: SETTINGS_BODY_MAX_BYTES,
  onError: () => {
    throw new AppError('VALIDATION_ERROR', SETTINGS_BODY_TOO_LARGE)
  },
})

export const settingsRoutes = new Hono<AppEnv>()
  /// [계약] api.md §4.15 · [요구] R-SET-004 · [에러] TOKEN_* · LEVEL_TOO_LOW · OWNER_ONLY · INTERNAL · [부수효과] 없음
  .get(PATHS.characterSettings, requireToken, requireOwner, async c => {
    const response: CharacterSettingsResponse = await c.get('services').settings.get()
    return c.json(response, 200)
  })
  /// [계약] api.md §4.16 · [요구] R-SET-005 · [에러] §4.15 + RATE_LIMITED · VALIDATION_ERROR · [부수효과] D1 1행 UPSERT · 레이트리밋 1회
  .put(
    PATHS.characterSettings,
    requireToken,
    requireOwner,
    rateLimitWrites,
    settingsBodyLimit,
    validate('json', putCharacterSettingsBody, settingsIssueMessage),
    async c => {
      const body: PutCharacterSettingsBody = c.req.valid('json')
      const response: CharacterSettingsResponse = await c
        .get('services')
        .settings.put(body.settings, getPrincipal(c))
      return c.json(response, 200)
    },
  )
```

- 핸들러 본문은 5줄 이내, 파일 전체도 30줄 한계(R-API-007)를 핸들러 기준으로 지킨다. 로직(정규화·저장·시드 대체)은 전부 server다.
- `const body: PutCharacterSettingsBody = c.req.valid('json')` 대입이 server zod 출력과 shared 타입을 tsc로 대조한다. zod 출력이 맞지 않으면 컴파일이 실패한다(§15.12 N2).
- `'settings' in data`로 좁히므로 타입 단언(`as`)이 없다.

### 11.13 S3c ui/api 설계 (`ui/src/api/`)

| 파일 | S3c 변경 | 비고 |
|---|---|---|
| `client.ts` | `RequestOptions.method`에 `'PUT'` 추가. `auth` 주석을 "토큰 헤더 부착(쓰기 + 설정 GET)"으로 | S4 memory PUT과 같은 변경 — 먼저 하는 쪽이 넣고 나중 쪽은 재사용(s3c-03 §0.2). `AUTH_FAILURE_CODES`·`isAuthFailure`는 **바꾸지 않는다** |
| **신규** `settings.ts` | `getCharacterSettings` · `saveCharacterSettings` | 이름은 화면 동작 기준(서버 서비스 이름 `get`·`put`은 너무 일반적이다) |
| `index.ts` | 두 래퍼 재노출 | 화면은 `@/api`만 import |

```ts
// ui/src/api/client.ts — S3c 변경 줄
/** api 폴더 내부 전용. auth = 토큰 헤더 부착(쓰기 + 설정 GET). index 에서 내보내지 않는다 */
export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  auth?: boolean
}
```

```ts
// ui/src/api/settings.ts — 신규
import { endpoints } from '@shared/endpoints'
import type {
  CharacterSettings,
  CharacterSettingsResponse,
  PutCharacterSettingsBody,
} from '@shared/types'
import { request, type Result } from './client'

/** [계약] api.md §4.15 · [요구] R-SET-004 · R-SET-010 — 설정 읽기(토큰 필요). 200 = 주인, 403 OWNER_ONLY = 주인 아님 */
export const getCharacterSettings = (): Promise<Result<CharacterSettingsResponse>> =>
  request<CharacterSettingsResponse>(endpoints.characterSettings(), { auth: true })

/** [계약] api.md §4.16 · [요구] R-SET-005 — 전체 교체 저장(200). 응답 settings 가 정규화 값이다 */
export const saveCharacterSettings = (
  settings: CharacterSettings,
): Promise<Result<CharacterSettingsResponse>> => {
  const body: PutCharacterSettingsBody = { settings }
  return request<CharacterSettingsResponse>(endpoints.characterSettings(), {
    method: 'PUT',
    body,
    auth: true,
  })
}
```

```ts
// ui/src/api/index.ts — S3c 추가 줄
export { getCharacterSettings, saveCharacterSettings } from './settings'
```

래퍼 규약(S3c):

| 항목 | 규칙 |
|---|---|
| 반환 | `Result<CharacterSettingsResponse>`. throw·reject 없음(§3.4) |
| 토큰 | 둘 다 `auth: true`. getter가 `null`이면 헤더 없이 보내고 서버의 `401 TOKEN_REQUIRED`를 그대로 돌려준다 |
| 본문 | `saveCharacterSettings`는 `{ settings }`만 보낸다. 래퍼는 사전 검사·정규화를 하지 않는다 — 화면 state가 `checkCharacterSettings`로 한다. 초안에 모르는 키가 섞이면 서버가 `400`으로 거절한다 |
| 오류 판정 | `OWNER_ONLY`는 `isAuthFailure` false. 401·`LEVEL_TOO_LOW`는 true지만 **판정 탐침에서는 화면이 전환하지 않는다**(§2.7, R-SET-010) — 래퍼는 판정만 돌려주고 상태를 바꾸지 않는다 |
| 타임아웃·재시도 | 없음(§3.4). 저장 「재시도」는 화면이 같은 래퍼를 다시 부른다 |

### 11.14 S3c 구현 순서

1. contract-implementer(4단계): `shared/src/errors.ts`(`OWNER_ONLY`) · `types.ts`(4타입) · 신규 `settings.ts` · `endpoints.ts` + shared 테스트(API-T-040·042 갱신, 049, 104~107)와 벡터 파일 `shared/test/settings-vectors.ts`. server `settings/schema.ts`가 `@shared/settings` 상수를 import하므로 이것이 먼저다.
2. server-implementer(5단계): env `OWNER_MB_IDS` · auth `isOwner`·`requireOwner` · `settings/` · db · `0003` · llm · generate · services(s3c-03 §1.2).
3. contract-implementer(6단계): routes S3c(§11.12) + `server/test/routes-settings.test.ts` API-T-091~103(§14.14). 2 뒤 — `requireOwner`·`characterSettingsSchema`·`services.settings`가 있어야 컴파일된다.
4. contract-implementer(6단계): ui/api S3c(§11.13) + API-T-UI-024~027(§14.16). 1 뒤면 2·3과 무관하다.
5. ui-implementer: App 주인 판정·rooms ⚙·설정 화면·`state/settings.ts`·`state/settingsFile.ts`(ui 설계 몫).
6. 증거: `npx vitest run --project shared` · `--project server` · `--project ui` 결과와 세 워크스페이스 `tsc --noEmit` exit 0.

### 11.15 S3d routes · ui/api 설계 (v0.6 — 엔드포인트·래퍼 추가 없음)

| 파일 | 변경 | 근거 |
|---|---|---|
| `shared/src/types.ts` | `SpeakTarget` 추가, `SpeakBody.character: SpeakTarget`, `Message.authorName` 주석 | §5.2 |
| `shared/src/characters.ts` | `USER_DISPLAY_NAME` 추가 | §5.5 |
| `server/src/routes/schemas.ts` | `speakBody`를 세 값 열거로 | 아래 |
| `server/src/routes/messages.ts` | **변경 없음.** `const body: SpeakBody = c.req.valid('json')`가 그대로 넓어진 타입을 받는다 | — |
| `ui/src/api/messages.ts` | `speak` 시그니처 그대로(`body: SpeakBody`), 문서주석만 | 아래 |
| `ui/src/api/client.ts` · `index.ts` · `endpoints.ts` · `errors.ts` | 변경 없음 | — |

routes `schemas.ts`:

```ts
/** speak 대상 — SpeakTarget 과 같은 집합 (api.md §4.13 · §5.2, v0.6 'auto') */
const SPEAK_TARGETS = ['sebastian', 'ciel', 'auto'] as const satisfies readonly SpeakTarget[]

/** POST /api/rooms/:id/speak 본문. 세 값 밖은 400 — 대소문자·공백을 고쳐 주지 않는다 */
export const speakBody = z.object({ character: z.enum(SPEAK_TARGETS) })
```

- `speakBody`만 바꾼다. 기존 `CHARACTER_IDS` 상수는 다른 곳에서 쓰지 않으면 지우고, 쓰면 그대로 둔다(contract-implementer가 grep으로 확인).
- zod 출력 타입이 `SpeakTarget`과 같아서 핸들러 대입이 그대로 컴파일된다. `satisfies`는 값이 shared에 없으면 잡지만 shared에 값이 늘어난 것은 못 잡는다. 그래서 API-T-110이 세 값 통과와 그 밖 거절을 직접 본다.
- §5.6 표 「생성 본문(S3)」 행의 `z.enum(CHARACTER_IDS)`는 이 절이 대체한다.

ui/api `messages.ts`:

```ts
/** [계약] api.md §4.13 · [요구] R-MSG-003 · R-MSG-009 · R-CHAT-005 · R-CHAT-014 — 1턴 생성(201 Message). character 'auto' = 서버가 화자를 고르고 응답 speaker 가 고른 캐릭터. 최대 70초, 타임아웃 없음 */
export const speak = (roomId: string, body: SpeakBody): Promise<Result<Message>> =>
  request<Message>(endpoints.roomSpeak(roomId), {
    method: 'POST',
    body: { character: body.character },
    auth: true,
  })
```

- **함수 이름은 `speak` 그대로다.** 새 이름(`speakAs` 등)을 만들지 않는다. 화면은 `speak(roomId, { character: 'auto' })`로 부른다(s3d-03 §3).
- 래퍼는 `authorName`을 치환하지 않는다. 받은 `Message`를 그대로 돌려준다.

구현 순서:

1. contract-implementer(4단계): shared `types.ts`·`characters.ts` + API-T-112. server·ui가 import하므로 먼저다.
2. server-implementer(5단계): `toMessage` 투영 · `llm/select.ts` · generate `'auto'` 분기.
3. contract-implementer(6단계): `schemas.ts` + routes 테스트 API-T-062 갱신·108·110(1 뒤면 된다)·109·111(2 뒤 — 서버 분기가 있어야 201).
4. contract-implementer(6단계): ui/api 주석 + API-T-UI-028·029.
5. 증거: 세 워크스페이스 `npx tsc --noEmit` exit 0, `npx vitest run --project shared`·`--project server`·`--project ui ui/src/api` 결과.

### 11.16 S4 routes · ui/api 설계 (v0.7)

| 파일 | 변경 | 근거 |
|---|---|---|
| `shared/src/types.ts` | `MemoryResponse` · `PutMemoryBody` 추가 | §5.9.1 |
| `shared/src/endpoints.ts` | `PATHS.roomMemory` · `endpoints.roomMemory` | §5.9.2 |
| `server/src/routes/schemas.ts` | `putMemoryBody` · `MEMORY_BODY_MAX_BYTES` 추가 | 아래 |
| `server/src/routes/memory.ts` | **신규** — E13 · E14 | 아래 |
| `server/src/routes/index.ts` | `import { memoryRoutes } from './memory'` · `apiRoutes.route('/', memoryRoutes)`(`settingsRoutes` 다음) | — |
| `ui/src/api/memory.ts` | **신규** — `getMemory` · `putMemory` | 아래 |
| `ui/src/api/index.ts` | `export { getMemory, putMemory } from './memory'` | — |
| `ui/src/api/client.ts` · `shared/src/errors.ts` · `limits.ts` · `server/src/routes/{rooms,messages,settings,validate}.ts` | **변경 없음.** `RequestOptions.method`의 `'PUT'`은 S3c에 이미 있다(§11.13) | — |
| `server/test/routes-generate.test.ts` | `call` 도우미가 `waitOnExecutionContext(ctx)`를 기다린다 + API-T-123 | §14.19 |

- **라우트 파일 판정: 신규 `routes/memory.ts`.** E13·E14는 `services.memory`만 부른다. 경로가 `/api/rooms/…`로 시작해도 `rooms.ts`에 넣지 않는다 — routes 파일은 URL 접두어가 아니라 **부르는 서비스** 기준으로 나눈다(`/rooms/:id/user`·`/rooms/:id/speak`가 `messages.ts`에 있는 것과 같다).
- **래퍼 파일 판정: 신규 `ui/src/api/memory.ts`.** 같은 기준이고 S3c `settings.ts` 선례와 같다.

routes `schemas.ts` 추가분:

```ts
/** PUT /api/rooms/:id/memory 본문. 타입만 — trim·0~4000자는 서비스 (api.md §4.18) */
export const putMemoryBody = z.object({ summary: z.string() })

/** E14 본문 상한(바이트). 4000 코드 포인트 × JSON.stringify 최악 6바이트 + 봉투 = 24014 < 32768 (api.md §4.18) */
export const MEMORY_BODY_MAX_BYTES = 32_768
```

routes `memory.ts`(신규):

```ts
/**
 * [목적] 장기기억 E13 · E14 (api.md §4.17 · §4.18)
 * [요구] R-MEM-001 · R-AUTH-003(memory GET 토큰 예외) · R-AUTH-005
 * [에러] 서비스·미들웨어가 throw → server onError. 라우트는 변환하지 않는다
 */
import { PATHS } from '@shared/endpoints'
import type { MemoryResponse, PutMemoryBody } from '@shared/types'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { AppError } from '../app-error'
import { rateLimitWrites, requireToken } from '../auth'
import type { AppEnv } from '../services'
import { MEMORY_BODY_MAX_BYTES, putMemoryBody, roomIdParam } from './schemas'
import { validate } from './validate'

/** 본문 32KiB 초과 → 400 VALIDATION_ERROR 기본 문구 (hono 기본 413 을 쓰지 않는다) */
const memoryBodyLimit = bodyLimit({
  maxSize: MEMORY_BODY_MAX_BYTES,
  onError: () => {
    throw new AppError('VALIDATION_ERROR')
  },
})

export const memoryRoutes = new Hono<AppEnv>()
  /// [계약] api.md §4.17 · [요구] R-MEM-001 · [에러] TOKEN_* · LEVEL_TOO_LOW · NOT_FOUND · INTERNAL · [부수효과] 없음(레이트리밋 미소모)
  .get(PATHS.roomMemory, requireToken, validate('param', roomIdParam), async c => {
    const { id } = c.req.valid('param')
    const memory: MemoryResponse = await c.get('services').memory.get(id)
    return c.json(memory, 200)
  })
  /// [계약] api.md §4.18 · [요구] R-MEM-001 · R-AUTH-005 · [에러] §4.5 공통 + VALIDATION_ERROR · NOT_FOUND · [부수효과] memory 1행 UPSERT · 레이트리밋 1회 · 방 updatedAt 불변
  .put(
    PATHS.roomMemory,
    requireToken,
    rateLimitWrites,
    validate('param', roomIdParam),
    memoryBodyLimit,
    validate('json', putMemoryBody),
    async c => {
      const { id } = c.req.valid('param')
      const body: PutMemoryBody = c.req.valid('json')
      const memory: MemoryResponse = await c.get('services').memory.put(id, body)
      return c.json(memory, 200)
    },
  )
```

- 핸들러는 각 3~4줄이다(30줄 한계 안, R-API-007). 존재·길이 판정은 서비스다.
- `memoryBodyLimit`는 `settingsBodyLimit`와 같은 모양이고 문구만 기본 문구다. 정상 화면은 4000자 초과면 저장을 막으므로 이 경로에 닿지 않는다.
- 미들웨어는 라우트 단위로 붙인다(전역 금지, §2.2). GET에는 `rateLimitWrites`를 붙이지 않는다(§6.1 S4 행).

ui/api `memory.ts`(신규):

```ts
import { endpoints } from '@shared/endpoints'
import type { MemoryResponse, PutMemoryBody } from '@shared/types'
import { request, type Result } from './client'

/** [계약] api.md §4.17 · [요구] R-MEM-001 · R-CHAT-012 — 장기기억 읽기(토큰 필요, 200). 행이 없으면 summary '' · sourceUntilId 0 · updatedAt null */
export const getMemory = (roomId: string): Promise<Result<MemoryResponse>> =>
  request<MemoryResponse>(endpoints.roomMemory(roomId), { auth: true })

/** [계약] api.md §4.18 · [요구] R-MEM-001 · R-CHAT-012 — 장기기억 교체 저장(200). 응답 summary 가 trim 된 저장값, sourceUntilId 는 유지(빈 요약이면 0, v0.7.1) */
export const putMemory = (roomId: string, body: PutMemoryBody): Promise<Result<MemoryResponse>> =>
  request<MemoryResponse>(endpoints.roomMemory(roomId), {
    method: 'PUT',
    body: { summary: body.summary },
    auth: true,
  })
```

- 둘 다 `auth: true`다 — GET도 헤더를 붙인다(§2.1 예외). `Result`로만 끝나고 throw·reject하지 않는다(`request` 규약).
- 래퍼는 `summary`를 trim·검사하지 않는다. 서버가 정규화하고 응답이 저장값이다. 화면 카운터·버튼 비활성은 ui 몫(`@shared/limits`).
- 본문은 `{ summary: body.summary }`로 다시 만든다. 화면 상태 객체의 다른 키가 섞여 나가지 않게 한다(`speak`와 같은 방식).

구현 순서:

1. contract-implementer(4단계): shared `types.ts`·`endpoints.ts` + API-T-042 갱신·124. server memory 서비스가 `@shared/types`의 두 타입을 import하므로 먼저다.
2. server-implementer(5단계): `server/src/memory/`·db 저장소 확장·`services.memory`·`afterSpeak` 배선(memory.md · db.md §13 · index.md §13 · messages.md §13).
3. contract-implementer(6단계): `schemas.ts` · `routes/memory.ts` · `routes/index.ts` + 신규 `server/test/routes-memory.test.ts`(API-T-113 ~ 122), `routes-generate.test.ts` 도우미 갱신 + API-T-123(2 뒤).
4. contract-implementer(6단계): `ui/src/api/memory.ts` · `index.ts` + 신규 `ui/src/api/memory.test.ts`(API-T-UI-030 ~ 032).
5. 증거: 세 워크스페이스 `npx tsc --noEmit` exit 0, `npx vitest run --project shared`·`--project server`·`--project ui ui/src/api` 결과. §12.6을 실물 파일:줄로 다시 채우고 §9에 "v0.7 구현" 행.

### 11.17 S3f routes · ui/api 설계 (v0.8 — 엔드포인트·래퍼 추가 없음)

| 파일 | 변경 | 근거 |
|---|---|---|
| `shared/src/types.ts` | `LlmModelKey` 추가, `CharacterSettingsResponse.model`, `PutCharacterSettingsBody.model?` | §5.8.6 |
| `shared/src/settings.ts` | `LLM_MODEL_KEYS` · `SETTINGS_MODEL_INVALID_MESSAGE` 추가. `checkCharacterSettings`는 손대지 않는다 | §5.8.6 |
| `server/src/routes/schemas.ts` | `putCharacterSettingsBody`에 `model`, `settingsIssueMessage`가 `settings` 다음에 `model` 문구 | 아래 |
| `server/src/routes/settings.ts` | PUT 핸들러가 `body.model`을 셋째 인자로 넘긴다. 주석 [요구]·[부수효과] | 아래 |
| `ui/src/api/settings.ts` | `saveCharacterSettings(settings, model?)` | 아래 |
| `server/src/routes/{index,validate,rooms,messages,memory,health}.ts` · `ui/src/api/{client,index}.ts` | **변경 없음** | — |

```ts
// server/src/routes/schemas.ts — import 에 LLM_MODEL_KEYS · SETTINGS_MODEL_INVALID_MESSAGE 추가
import { checkCharacterSettings, LLM_MODEL_KEYS, SETTINGS_MODEL_INVALID_MESSAGE } from '@shared/settings'

/** E16 본문(PUT 캐릭터 설정). 봉투 모르는 키는 버리고, settings 안은 server 스키마가 strict. model 은 두 키 중 하나 또는 키 없음 — null 불가 (api.md §4.16) */
export const putCharacterSettingsBody = z.object({
  settings: characterSettingsSchema,
  model: z.enum(LLM_MODEL_KEYS).optional(),
})

/**
 * E16 400 문구 — 판정은 zod. 문구는 ① settings 의 첫 위반(shared 사전 검사) ② settings 가 통과했을 때만 봉투 model 위반
 * 둘 다 아니면 undefined → 기본 문구(zod 와 사전 검사가 어긋난 경우의 안전망)
 */
export const settingsIssueMessage = (data: unknown): string | undefined => {
  const envelope: object = typeof data === 'object' && data !== null ? data : {}
  const checked = checkCharacterSettings('settings' in envelope ? envelope.settings : undefined)
  if (!checked.ok) return checked.issue.message
  if (!('model' in envelope)) return undefined
  const model: unknown = envelope.model
  return LLM_MODEL_KEYS.some(key => key === model) ? undefined : SETTINGS_MODEL_INVALID_MESSAGE
}
```

```ts
// server/src/routes/settings.ts — PUT 핸들러만 (GET · 미들웨어 · 본문 상한 불변)
  /// [계약] api.md §4.16 · [요구] R-SET-005 · R-SET-013 · [에러] §4.15 + RATE_LIMITED · VALIDATION_ERROR · [부수효과] D1 1행 UPSERT(본체 + llm_model) · 레이트리밋 1회
    async c => {
      const body: PutCharacterSettingsBody = c.req.valid('json')
      const response: CharacterSettingsResponse = await c
        .get('services')
        .settings.put(body.settings, getPrincipal(c), body.model)
      return c.json(response, 200)
    },
```

```ts
// ui/src/api/settings.ts — saveCharacterSettings 만 (getCharacterSettings 불변 — 응답 타입에 model 이 들어올 뿐)
import type {
  CharacterSettings,
  CharacterSettingsResponse,
  LlmModelKey,
  PutCharacterSettingsBody,
} from '@shared/types'

/**
 * [계약] api.md §4.16 · [요구] R-SET-005 · R-SET-013 — 전체 교체 저장(200). 응답 settings 가 정규화 값, model 이 지금 쓰는 모델 키
 * model 을 주면 함께 저장한다. 생략(undefined)하면 본문에 model 키가 없고 서버 저장값이 유지된다
 */
export const saveCharacterSettings = (
  settings: CharacterSettings,
  model?: LlmModelKey,
): Promise<Result<CharacterSettingsResponse>> => {
  const body: PutCharacterSettingsBody = model === undefined ? { settings } : { settings, model }
  return request<CharacterSettingsResponse>(endpoints.characterSettings(), {
    method: 'PUT',
    body,
    auth: true,
  })
}
```

- `envelope: object` 좁히기와 `'settings' in envelope`라 타입 단언(`as`)이 없다(S3c와 같다). `model`은 지역 상수로 꺼낸 뒤 비교한다(콜백 안 좁히기 손실 방지).
- `z.enum(LLM_MODEL_KEYS)`는 `'pro'`·`'flash'`만 통과한다. `.optional()`은 키 없음만 통과시키고 `null`은 실패한다. `.nullable()`·`.catch()`·대소문자 정규화를 붙이지 않는다.
- `const body: PutCharacterSettingsBody = c.req.valid('json')`가 zod 출력(`model?: 'pro' | 'flash' | undefined`)과 shared 타입을 tsc로 대조한다. shared 쪽 `| undefined`가 빠지면 exactOptionalPropertyTypes 때문에 이 줄이 실패한다(§5.8.6 · §15.15 제안 1).
- 핸들러는 `body.model`의 뜻(유지·교체)을 해석하지 않고 넘긴다. 유지·해석·로그는 server `settings.put`(s3f-03 §1.2) 몫이다. 라우트 줄 수는 S3c와 같다(R-API-007).
- 래퍼는 `model`을 검사하지 않는다(타입이 두 키만 허용하고 `null`은 컴파일 오류). 서버 `400` 문구는 `error.message` 그대로 돌아온다(§3.4).
- 래퍼가 `undefined`를 키째 빼는 이유: `JSON.stringify`도 `undefined` 값을 지우지만, "키 없음 = 유지"를 래퍼 코드에서 명시하고 API-T-UI-034가 본문 키 집합을 본다.

구현 순서:

1. contract-implementer(4단계): shared `types.ts`·`settings.ts` + API-T-131. server `llm/models.ts`·`settings` 서비스가 `LlmModelKey`·`LLM_MODEL_KEYS`를 import하므로 먼저다. `CharacterSettingsResponse.model`이 필수 필드가 되는 순간 server `settings` 서비스와 응답 픽스처를 만드는 테스트의 tsc가 깨진다 — 5단계(server)·6단계(contract)·7단계(ui)가 메운다. 4단계 증거는 `npx tsc --noEmit -p shared` · `npx vitest run --project shared`.
2. server-implementer(5단계): s3f-03 §1.3(0004 · `settings.put` 셋째 인자 · `get` 응답 `model`).
3. contract-implementer(6단계): `schemas.ts` · `routes/settings.ts` + `server/test/routes-settings.test.ts` API-T-094 갱신 · 126 ~ 130(2 뒤).
4. contract-implementer(6단계): `ui/src/api/settings.ts` + `ui/src/api/settings.test.ts` 응답 픽스처 `model` 추가 · API-T-UI-033 · 034. 1 뒤면 2·3과 무관하다.
5. 증거: 세 워크스페이스 `npx tsc --noEmit` exit 0(ui는 7단계 픽스처 갱신 뒤), `npx vitest run --project shared`·`--project server`·`--project ui ui/src/api` 결과. §12.7을 실물 파일:줄로 다시 채우고 §9에 "v0.8 구현" 행.

### 11.18 S6 routes · ui/api 설계 (v0.9 — 방 비밀번호 잠금)

routes(`server/src/routes/`). `optionalToken`·`isOwnerRequest`·`requireRoomEntry`는 server auth가 export하고(s6-03 §1.2) routes는 import만 한다.

| 파일 | 변경 |
|---|---|
| `schemas.ts` | `createRoomBody = z.object({ title: z.string(), password: z.string().optional() })` — **E4 전용 새 스키마**. `roomTitleBody`는 E5용으로 그대로 둔다(이름 변경이 `password`를 받지 않게). `enterRoomBody = z.object({ password: z.string().refine(s => countCodePoints(s) <= ROOM_ENTER_PASSWORD_MAX).optional() })`(실패는 `validate` 훅의 기본 문구 `400`). `setRoomPasswordBody = z.object({ password: z.string() })`. 상수 `ROOM_PASSWORD_BODY_MAX_BYTES = 1024`(E17·E18 본문 상한, `MEMORY_BODY_MAX_BYTES`와 같은 위치·같은 `bodyLimit` 실패 처리 — `AppError('VALIDATION_ERROR')` throw) |
| `rooms.ts` | E4 `.post(PATHS.rooms, requireToken, rateLimitWrites, validate('json', createRoomBody), …)` → `const body: CreateRoomBody = c.req.valid('json')` → `c.json(created satisfies CreateRoomResponse, 201)` · E5 `…validate('param', roomIdParam), requireRoomEntry('room'), validate('json', roomTitleBody)` · E6 `…validate('param', roomIdParam), requireRoomEntry('room')` · **E17** `.post(PATHS.roomEnter, optionalToken, validate('param', roomIdParam), bodyLimit(…), validate('json', enterRoomBody), h)` → `rooms.enter(id, body.password === undefined ? { isOwner } : { password: body.password, isOwner })`(`isOwner = isOwnerRequest(c)`) → `200` · **E18** `.put(PATHS.roomPassword, requireToken, rateLimitWrites, validate('param', roomIdParam), requireRoomEntry('room'), bodyLimit(…), validate('json', setRoomPasswordBody), h)` → `rooms.setPassword(id, body.password, { mbId: getPrincipal(c).mbId })` → `200` · **E19** `.delete(PATHS.roomPassword, requireToken, rateLimitWrites, validate('param', roomIdParam), requireRoomEntry('room'), h)` → `rooms.clearPassword(id, by)` → `c.json(room, 200)` |
| `messages.ts` | E7 `validate('param', roomIdParam)` 뒤 `requireRoomEntry('room')`, 그 뒤 `validate('query', …)` · E8·E9 `requireRoomEntry('room')` · E10·E11·E12 `requireRoomEntry('message')`(검증된 `messageIdParam`의 `id` — `NaN`이면 관문 통과 → 서비스 `404`) |
| `memory.ts` | E13·E14 `validate('param', roomIdParam)` 뒤 `requireRoomEntry('room')`(E14는 본문 상한 앞) |
| `index.ts` | 변경 없음(`rooms.ts`에 경로가 더해질 뿐) |

- 핸들러는 30줄 이내, 자기문서화 주석 형식(`// [계약] api.md §4.19 · [요구] R-LOCK-004 · [에러] ROOM_LOCKED, ROOM_PASSWORD_WRONG, RATE_LIMITED · [부수효과] rate_limits enter:{roomId}`). 응답 본문에 증명 외 비밀값을 싣지 않는다. 라우트는 증명·비밀번호를 로그에 남기지 않는다(요청 로그는 진입점 소유, 헤더를 찍지 않는다).
- 관문 미들웨어는 `validate('param')` **뒤**에만 둔다(검증된 id를 읽는다). 라우터 전역(`apiRoutes.use`) 금지 — 라우트 단위(§2.2와 같은 규칙).

ui/api(`ui/src/api/`):

| 파일 | 변경 |
|---|---|
| `client.ts` | `ClientConfig = { getToken: () => string \| null; getRoomKey?: (roomId: string) => string \| null }` — `configureClient`가 두 슬롯을 같은 클로저 패턴으로 채운다(`getRoomKey` 없으면 항상 `null`). `RequestOptions.roomId?: string` — 값이 있으면 요청 때마다 `getRoomKey(roomId)`를 불러 **비어 있지 않은 문자열일 때만** `headers[ROOM_KEY_HEADER]`를 붙인다. `auth`와 독립(읽기 E7에도 붙는다). 증명을 URL·쿼리·본문에 넣지 않고 보관·로그하지 않는다. `AUTH_FAILURE_CODES`·`isAuthFailure` **변경 없음** |
| `rooms.ts` | `createRoom(body: CreateRoomBody): Promise<Result<CreateRoomResponse>>`(반환 타입만 넓어짐) · `renameRoom(roomId, body)`·`deleteRoom(roomId)`에 `roomId` 옵션 · 신규 `enterRoom(roomId: string, password?: string): Promise<Result<EnterRoomResponse>>`(`POST endpoints.roomEnter`, 본문 `password === undefined ? {} : { password }`, `auth: true`, `roomId` 옵션 **없음**) · 신규 `setRoomPassword(roomId: string, password: string): Promise<Result<SetRoomPasswordResponse>>`(`PUT endpoints.roomPassword`, `auth: true`, `roomId`) · 신규 `clearRoomPassword(roomId: string): Promise<Result<RoomSummary>>`(`DELETE endpoints.roomPassword`, `auth: true`, `roomId` — `200` JSON이라 `204` 분기를 타지 않는다) |
| `messages.ts` | `listMessages(roomId, query)`·`appendUser(roomId, body)`·`speak(roomId, body)`에 `roomId` 옵션. 메시지 id 래퍼는 **마지막 인자 `roomId: string`(필수)**: `editMessage(messageId, body, roomId)` · `deleteMessage(messageId, roomId)` · `regenerate(messageId, roomId)` — URL은 그대로 메시지 id, `roomId`는 헤더 조회용. 빠뜨리면 tsc가 잡는다 |
| `memory.ts` | `getMemory(roomId)`·`putMemory(roomId, body)`에 `roomId` 옵션 |
| `index.ts` | `enterRoom` · `setRoomPassword` · `clearRoomPassword` 재노출(+ 기존 타입 재노출 규칙대로 새 타입) |

- 래퍼는 throw·reject하지 않는다(§3.4). 새 코드 2종은 계약 형식 본문 그대로 `Result.error`로 나가고 `isAuthFailure`는 `false`다. E17의 `RATE_LIMITED`에는 지금 규칙대로 `retryAfterSec`가 실린다.
- 화면이 `getRoomKey`를 어떻게 구현하는지(`state/roomKeys.ts`), 언제 증명을 저장·삭제하는지는 ui 설계 몫이다(「ui 인계 메모」 S6).

---

## 12. 4자 대조표 (S1)

판정은 설계 기준이다. 구현 후 contract-implementer가 실제 파일로 다시 채운다.

| 계약 항목 | api.md | shared | routes | ui/api | 판정 |
|---|---|---|---|---|---|
| `GET /api/health` → `HealthResponse` | §4.1 | `PATHS.health` · `endpoints.health` · `HealthResponse` | `health.ts` `healthRoutes` | `health.ts` `getHealth()` | 설계 일치 |
| `GET /api/rooms` → `RoomSummary[]` | §4.2 | `PATHS.rooms` · `endpoints.rooms` · `RoomSummary` | `rooms.ts` `roomsRoutes` | `rooms.ts` `listRooms()` | 설계 일치 |
| `GET /api/rooms/:id/messages` 경로 `id: string` | §4.3 | `PATHS.roomMessages` · `endpoints.roomMessages(roomId)`(인코딩) | `schemas.ts` `roomIdParam` | `listMessages(roomId, …)` | 설계 일치 |
| 같은 엔드포인트 쿼리 `before?` · `limit?` | §4.3 | `MessagesQuery` · `toQueryString` | `schemas.ts` `messagesQuery` → `const query: MessagesQuery` | `listMessages(…, query?: MessagesQuery)` | 설계 일치 |
| 같은 엔드포인트 응답 `MessagesPage` · `Message` · `Speaker` · `MessageKind` | §4.3 · §5.2 | `types.ts` | `const page: MessagesPage` | `Result<MessagesPage>` | 설계 일치 |
| `GET /embed`(+`?t=`) | §4.4 · §7 | `PATHS.embed` | 정의 없음(server `app.ts` 소유) | 해당 없음(`main.tsx` 진입) | 설계 일치 |
| 에러 본문 `{ error: { code, message } }` | §3.1 | `ApiErrorBody` | `validate` throw → server `onError` | `toApiError` → `Result.error` | 설계 일치 |
| 에러 코드 13종·status | §3.2 | `ERROR_CODES` · `ERROR_STATUS` · `ERROR_MESSAGES` · `isErrorCode` | `AppError(code, status, …)` | `ApiErrorCode = ErrorCode \| 'NETWORK'` | 설계 일치(server 권고 §15.2 R2) |
| `NETWORK` | §3.3 | 없음(의도) | 없음 | `NETWORK_ERROR` | 설계 일치 |
| 읽기 토큰 불필요 | §2.1 | — | 토큰 미들웨어 없음 | `Authorization` 헤더 안 붙임 | 설계 일치 |
| 캐릭터 표시 메타 `id`·`name`·`shortName`·`avatar` | §5.5 | `CHARACTERS` · `CharacterMeta`(`shortName` 포함) · `CharacterId` | 없음(S3 `llm/characters.ts`가 `name`만 대조) | 없음(화면이 shared 직접 import, 이름표는 `shortName`) | 설계 일치 |
| 토큰 형식·전달 | §2.2 · §2.3 | S2 | S2 | S2(`buildHeaders` TODO) | S2 행으로 이동(아래) |
| 경로 리터럴 | §5.4 | `endpoints.ts`에만 | `PATHS.*`만 | `endpoints.*`만 | 설계 일치(API-T-044로 검사) |

### 12.1 4자 대조표 (S2 — 설계 기준, 구현 후 contract-implementer가 다시 채운다)

| 계약 항목 | api.md | shared | routes | ui/api | 판정 |
|---|---|---|---|---|---|
| `POST /api/rooms` `{ title }` → `201 RoomSummary` | §4.6 | `PATHS.rooms` · `endpoints.rooms` · `CreateRoomBody` · `RoomSummary` | `rooms.ts` `.post` · `roomTitleBody` → `const body: CreateRoomBody` | `createRoom(body: CreateRoomBody)` → `Result<RoomSummary>` | 설계 일치 |
| `PATCH /api/rooms/:id` `{ title }` → `200 RoomSummary` | §4.7 | `PATHS.room` · `endpoints.room` · `RenameRoomBody` | `rooms.ts` `.patch` · `roomIdParam` · `roomTitleBody` | `renameRoom(roomId, body)` | 설계 일치 |
| `DELETE /api/rooms/:id` → `204` | §4.8 | `PATHS.room` · `endpoints.room` | `rooms.ts` `.delete` → `c.body(null, 204)` | `deleteRoom(roomId)` → `Result<void>` · `request`의 204 분기 | 설계 일치 |
| `POST /api/rooms/:id/user` `{ text, ooc }` → `201 Message` | §4.9 | `PATHS.roomUser` · `endpoints.roomUser` · `UserMessageBody` · `Message` | `messages.ts` `.post` · `userMessageBody` · `getPrincipal(c)` | `appendUser(roomId, body)` | 설계 일치 |
| `PATCH /api/messages/:id` `{ text }` → `200 Message` | §4.10 | `PATHS.message` · `endpoints.message(messageId: number)` · `EditMessageBody` | `messages.ts` `.patch` · `messageIdParam` · `editMessageBody` | `editMessage(messageId: number, body)` | 설계 일치 |
| `DELETE /api/messages/:id` → `204` | §4.11 | `PATHS.message` · `endpoints.message` | `messages.ts` `.delete` · `messageIdParam` | `deleteMessage(messageId: number)` → `Result<void>` | 설계 일치 |
| 메시지 id 표기(10진 숫자) | §4.5 | `endpoints.message`가 `String(number)` | `messageIdParam`(`toMessageId`) | `messageId: number` | 설계 일치 |
| 길이 규칙 60·2000·4000, trim 후 코드 포인트 (v0.3.1) | §5.7 | `limits.ts` `ROOM_TITLE_MAX` · `MESSAGE_TEXT_MAX` · `MEMORY_SUMMARY_MAX` · `countCodePoints` · `normalizeText` | 쓰지 않음(zod는 타입만). 판정은 server 서비스가 `@shared/limits`로 | 쓰지 않음(api 래퍼는 trim하지 않음). 화면 `limits.ts`가 import | 설계 일치(server 쪽은 S2-R4 반영 후) |
| 토큰 전달 `Authorization: Bearer` | §2.2 | — | `requireToken`(server auth) 라우트 단위 6개 | `buildHeaders` — `auth: true`이고 getter 값이 있을 때만 | 설계 일치 |
| 토큰 보관 `?t=` → 메모리 | §2.4 | — | — | `configureClient({ getToken })` · `ClientConfig`(보관은 `state/token.ts`) | 설계 일치(보관 구현은 ui) |
| 토큰 형식·payload·벡터 | §2.3 · §2.5 | 없음(의도 — `TokenPayload`는 문서 표기) | 없음(server auth zod가 정본) | 없음(화면은 해석하지 않음) | 설계 일치(server auth.md §2와 대조) |
| `RATE_LIMITED` `retryAfterSec` | §3.1 · §6.1 | `ApiErrorBody.error.retryAfterSec?` | 없음(server onError가 본문·헤더) | `ApiError.retryAfterSec?` · `toRetryAfter` | 설계 일치 |
| 인증 실패 → 읽기 전용 | §2.4 | `ErrorCode`(3코드) | — | `isAuthFailure` | 설계 일치 |
| 레이트리밋 적용 | §6.1 | — | `rateLimitWrites` 라우트 단위 6개 | — | 설계 일치 |

### 12.2 4자 대조표 (S3 — 구현 완료 2026-10-06, contract-implementer 실물 기준)

| 계약 항목 | api.md | shared | routes | ui/api | 판정 |
|---|---|---|---|---|---|
| `POST /api/rooms/:id/speak` `{ character }` → `201 Message` | §4.13 | `endpoints.ts` `PATHS.roomSpeak` · `endpoints.roomSpeak(roomId)` · `types.ts` `SpeakBody` · 기존 `CharacterId` · `Message` | `routes/messages.ts` `.post(PATHS.roomSpeak, requireToken, rateLimitWrites, validate('param', roomIdParam), validate('json', speakBody))` → `const body: SpeakBody` → `messages.speak(id, body, { waitUntil })` | `api/messages.ts` `speak(roomId, body: SpeakBody)` → `Result<Message>` | 구현 일치. 테스트 API-T-070~077 · 084 · T-UI-019~021 |
| `POST /api/messages/:id/regenerate` 본문 없음 → `200 Message` | §4.14 | `PATHS.messageRegenerate` · `endpoints.messageRegenerate(messageId: number)` | `routes/messages.ts` `.post(PATHS.messageRegenerate, requireToken, rateLimitWrites, validate('param', messageIdParam))` · json 검증 없음 → `messages.regenerate(id)` | `api/messages.ts` `regenerate(messageId: number)` 본문·`Content-Type` 없음 | 구현 일치. 테스트 API-T-074 · 075 · 078~084 · T-UI-019~021 |
| 생성 에러 5코드 + `CONFIG_INVALID` | §3.2 · §4.12 | `ERROR_CODES` 변경 없음 | 서비스 throw → server `onError`(라우트 변환 없음) | `toApiError` 변경 없음 | 구현 일치. API-T-073~083 · T-UI-020 |
| 시간 상한 70초 · 화면 타임아웃 없음 | §4.12 | — | 없음(서비스·llm 예산) | `request` 타임아웃 없음, 래퍼 `signal` 없음 | 구현 일치. T-UI-021 + grep 0건 |
| 토큰·레이트리밋 | §4.12 · §6.1 | — | `requireToken` · `rateLimitWrites` 2개 추가(라우트 단위 총 8개) | `auth: true` | 구현 일치. API-T-050~053(8개) · 077 |
| 캐릭터 값 두 개 | §5.2 · §5.6 | `CharacterId` | `routes/schemas.ts` `CHARACTER_IDS` `satisfies readonly CharacterId[]` · `speakBody` | `SpeakBody` | 구현 일치. API-T-072 |

### 12.3 4자 대조표 (S3b — 구현 완료 2026-10-06, contract-implementer 실물 기준)

| 계약 항목 | api.md | shared | routes | ui/api | 판정 |
|---|---|---|---|---|---|
| `LLM_BUDGET_EXCEEDED` 429 · 요구 원문 문구 | §3.2 | `shared/src/errors.ts` `ERROR_CODES`(17) · `ERROR_STATUS`(39) · `ERROR_MESSAGES`(57) | 변경 없음(서비스 throw → server `onError`). 테스트 `routes-generate.test.ts` API-T-085 | `client.ts` `isErrorCode`·`toApiError` 자동 수용. 테스트 `api.test.ts` API-T-UI-022 | ✅ |
| 본문 `retryAfterSec` + `Retry-After` | §3.1 · §4.12 | `ApiErrorBody.error.retryAfterSec?`(`types.ts`) | 변경 없음. `expectContractError` 두 벌이 코드별 값(40 / 1356400)과 헤더 검증 | `toRetryAfter`(`client.ts` 75)가 `RATE_LIMITED`에만 싣는다. API-T-UI-022가 버림을 검증 | ✅ |
| 판정 순서 4b(E9) · 5b(E12) | §4.13 · §4.14 | — | 변경 없음. API-T-086(speak 순서) · API-T-087(regenerate 순서·원문 유지) | — | ✅ |
| 예산 거절도 레이트리밋 1회 · 분 한도 우선 | §6.1 | — | 기존 미들웨어 순서. API-T-089 | API-T-UI-023(두 429를 `code`로 구분) | ✅ |
| 다른 엔드포인트·health 영향 없음 | §4.12 | — | 변경 없음. API-T-088 | 변경 없음 | ✅ |
| 이번 달(KST)만 집계 | §4.12 | — | API-T-090 · 임계 직전(99999.9) 허용은 API-T-085 후반 | — | ✅ |

### 12.4 4자 대조표 (S3c — 구현 완료 2026-10-06, 실물 파일:줄)

| 계약 항목 | api.md | shared | routes | ui/api | 판정 |
|---|---|---|---|---|---|
| E15 `GET /api/settings/characters` → `200 CharacterSettingsResponse` | §4.0 · §4.15 | `endpoints.ts:26` `PATHS.characterSettings` · `endpoints.ts:58` · `types.ts:122` | `routes/settings.ts:27` `.get(PATHS.characterSettings, requireToken, requireOwner)` → `settings.get()`(:28) | `api/settings.ts:10` `getCharacterSettings()` `auth: true`(:11) | ✅ |
| E16 `PUT` `{ settings }` → `200 CharacterSettingsResponse` | §4.0 · §4.16 | 같은 경로 · `types.ts:114` `CharacterSettings` · `types.ts:134` `PutCharacterSettingsBody` | `settings.ts:32~46` `.put(…, requireToken, requireOwner, rateLimitWrites, settingsBodyLimit, validate('json', putCharacterSettingsBody, settingsIssueMessage))` → `const body: PutCharacterSettingsBody` → `settings.put(body.settings, getPrincipal(c))`(:43) | `api/settings.ts:14` `saveCharacterSettings(settings)` → `method: 'PUT'`(:19) `body: { settings }` `auth: true`(:21) | ✅ |
| 경로 집합 16개 · 리터럴 1곳 | §4.0 | `PATHS` 값 10개 | `routes/index.ts:11·17` `route('/', settingsRoutes)` | `ui/api/index.ts:6` · `endpoints.*`만 | ✅ (리터럴 grep: 소스 0건, 주석·테스트 기대값만) |
| `OWNER_ONLY` 403 · 문구 | §3.2 · §5.8.2 | `errors.ts:19` · `:42` · `:61` | server `requireOwner` throw → `onError`(API-T-093) | `isErrorCode` 자동 수용, `AUTH_FAILURE_CODES` 불변(`client.ts` grep 0건, UI-026) | ✅ |
| 주인 판정 순서 · 토큰 예외 | §2.7 | — | 라우트 단위 미들웨어 2종, `requireOwner`가 `rateLimitWrites` 앞(`settings.ts:27·34~36`) | `auth: true`(GET 포함) | ✅ (API-T-091·092·093, UI-024·027) |
| 필드·상한·필수 · 400 문구 | §4.16 · §5.8.4 | `settings.ts` `checkCharacterSettings`(:173) | `schemas.ts:52` `putCharacterSettingsBody` · `:55` `settingsIssueMessage` · `validate.ts:14·17` `toMessage` | 없음 | ✅ (API-T-096~099·101) |
| 본문 상한 128KB → 400 | §4.16 | `settings.ts:18` `SETTINGS_BODY_MAX_BYTES` | `settings.ts:18~23` `bodyLimit` onError → `AppError('VALIDATION_ERROR', SETTINGS_BODY_TOO_LARGE)`(`schemas.ts:63`) | 없음 | ✅ (API-T-100) |
| 레이트리밋 | §6.1 | — | E16만 `rateLimitWrites`(`settings.ts:36`), 비주인 403 미카운트 | — | ✅ (API-T-093③·102) |
| 파일 형식 · 가져오기 | §16 | `SETTINGS_FILE_FORMAT` 외 | 없음(서버 엔드포인트 없음) | 없음(화면 `state/settingsFile.ts`, ui-implementer) | 해당 없음 |
| `request` method `'PUT'` | §11.13 | — | — | `client.ts:53` `RequestOptions.method` | ✅ |

실행 증거(2026-10-06): `npx tsc --noEmit -p server` exit 0 · `-p ui`의 `ui/src/api` 오류 0건 · `vitest run --project server` 18파일 318/318(305 + API-T-091~103 13건) · `vitest run --project ui ui/src/api` 2파일 27/27(API-T-UI-024~027 4건 포함). ui 전체의 실패 17건은 ui-implementer 미구현 화면(`OwnerGate`·`settings/`)용 선작성 테스트다.

### 12.5 4자 대조표 (S3d — 구현 완료 2026-10-06, 실물 파일:줄)

| 계약 항목 | api.md | shared | routes | ui/api | 판정 |
|---|---|---|---|---|---|
| E9 본문 `SpeakTarget` 세 값 | §4.13 · §5.2 | `shared/src/types.ts:83` `SpeakTarget` · `:86` `SpeakBody` | `server/src/routes/schemas.ts:49` `SPEAK_TARGETS` · `:55` `speakBody` | `ui/src/api/messages.ts:39` `speak(roomId, body: SpeakBody)` 변경 없음 | ✅ |
| `'auto'` → `201`, `speaker` = `CharacterId` | §4.13 | `Message.speaker: Speaker` 불변 | `routes/messages.ts:88` 핸들러 불변(서비스 반환 그대로) | 변경 없음 | ✅ API-T-109 · API-T-UI-028 |
| 세 값 밖 `400` | §4.13 | — | `schemas.ts:55` zod enum | `api.test.ts:339` `@ts-expect-error` | ✅ API-T-072(`'auto '` 추가) · API-T-110 |
| 잠금·예산·레이트리밋 공유 | §4.12 · §4.13 | — | 미들웨어 순서 불변 | — | ✅ API-T-111 |
| `USER_DISPLAY_NAME` | §5.5 | `shared/src/characters.ts:40` | routes 무관(`server/src/db/messages.ts:45`가 import) | 래퍼는 쓰지 않음 | ✅ API-T-112(`shared/test/characters.test.ts:30`) |
| 유저 `authorName` 투영 | §2.3 · §4.3 · §4.9 · §4.10 | `types.ts:35` 주석 | 라우트 변경 없음 | `api.test.ts:353` 치환 없음 확인 | ✅ API-T-061(실명 0회 단언 추가) · API-T-108 · API-T-UI-029 |
| 엔드포인트 16 · 에러 15 불변 | §4.0 · §3.2 | `PATHS` · `ERROR_CODES` 불변 | — | — | ✅ API-T-040 · 042 무수정 통과 |

테스트 위치: `server/test/routes-generate.test.ts:217`(072) · `:460`(109) · `:476`(110) · `:496`(111), `server/test/routes-write.test.ts:297`(061, 설계표의 "062 갱신"에 해당하는 authorName 단언) · `:411`(108), `ui/src/api/api.test.ts:339`(UI-028) · `:353`(UI-029).
증거: `tsc --noEmit -p server` · `-p ui` exit 0, `vitest run --project server` 340 passed, `vitest run --project ui ui/src/api` 29 passed.

### 12.6 4자 대조표 (S4 — 구현 완료 2026-10-07, 실물 파일:줄)

| 계약 항목 | api.md | shared | routes | ui/api | 판정 |
|---|---|---|---|---|---|
| E13 `GET /api/rooms/:id/memory` | §4.17 | `endpoints.ts:28` `PATHS.roomMemory` · `:62` `endpoints.roomMemory` | `routes/memory.ts:26` `.get` — `requireToken` → `validate('param')` → `memory.get(id)` | `ui/src/api/memory.ts:6` `getMemory(roomId)` `auth: true` (`:7`) | ✅ |
| E14 `PUT /api/rooms/:id/memory` | §4.18 | 〃 | `routes/memory.ts:32~45` `.put` — `requireToken` → `rateLimitWrites` → `validate('param')` → `memoryBodyLimit` → `validate('json', putMemoryBody)` → `memory.put(id, body)` | `memory.ts:10` `putMemory(roomId, body)` `method: 'PUT'`(`:12`) · `auth: true`(`:14`) · 주석 `:9` 빈 요약이면 0(v0.7.1) | ✅ |
| 응답 `MemoryResponse` | §4.17 · §5.9.1 | `types.ts:142`(`sourceUntilId` 주석 `:145` v0.7.1 빈 요약 0) | `memory.ts:28` · `:42` `const memory: MemoryResponse` | `memory.ts:6` · `:10` `Result<MemoryResponse>` | ✅ |
| 본문 `PutMemoryBody` | §4.18 · §5.9.1 | `types.ts:152` | `schemas.ts:69` `putMemoryBody` → `memory.ts:41` `const body: PutMemoryBody` | `memory.ts:10` `body: PutMemoryBody`(`:13` `{ summary: body.summary }`) | ✅ |
| trim 후 0~4000 코드 포인트 | §4.18 · §5.7 | `limits.ts` 기존 3개(변경 없음) | 서비스 판정(라우트는 타입만 — API-T-118) | 화면 카운터(ui 몫) | ✅ |
| 본문 상한 32KiB | §4.18 | — | `schemas.ts:72` `MEMORY_BODY_MAX_BYTES` · `memory.ts:17` `memoryBodyLimit`(`throw new AppError('VALIDATION_ERROR')` 기본 문구) | — | ✅ |
| 레이트리밋 GET 0 · PUT 1 | §6.1 | — | GET 에 `rateLimitWrites` 없음(`memory.ts:26`) · PUT 에 있음(`:35`) — API-T-121 | — | ✅ |
| E9 응답 뒤 자동 요약 | §4.12 · §4.13 | — | `routes/messages.ts:94` `waitUntil` 주입 불변 — API-T-123 | `speak` 불변 | ✅ |
| 엔드포인트 16 · 에러 15 불변 | §4.0 · §3.2 | `PATHS` 11(API-T-042) · `ERROR_CODES` 15(API-T-040 무수정) | `routes/index.ts:19` 등록 1줄 외 변경 없음 | `ui/src/api/index.ts:5` export 1줄 | ✅ |

요구ID 반영: R-MEM-001 ✅ · R-AUTH-003 ✅(GET 토큰 필요) · R-AUTH-005 ✅ · R-NFR-003 ✅ · R-CHAT-012 ✅(래퍼) · R-API-004 ✅ · R-API-001 ✅(API-T-122) · R-MEM-002 ✅(API-T-123, 요약 실패에도 speak 201). 누락 0.

테스트 실물: `server/test/routes-memory.test.ts`(API-T-113~122 · API-T-125 `memory_put_empty_resets_source` — 빈 요약·공백만 → `sourceUntilId` 0, `'a'` → 21 유지) · `routes-generate.test.ts`(`call` 도우미 `waitOnExecutionContext` + API-T-123) · `routes-write.test.ts`(`send` 도우미 같은 대기) · `shared/test/endpoints.test.ts`(API-T-042 갱신·124, 1단계) · `ui/src/api/memory.test.ts`(API-T-UI-030~032).

---|---|---|---|---|---|
| E13 `GET /api/rooms/:id/memory` | §4.17 | `PATHS.roomMemory` · `endpoints.roomMemory` | `routes/memory.ts` `.get` — `requireToken` → `validate('param')` | `getMemory(roomId)` `auth: true` | 예정 |
| E14 `PUT /api/rooms/:id/memory` | §4.18 | 〃 | `.put` — `requireToken` → `rateLimitWrites` → `validate('param')` → `memoryBodyLimit` → `validate('json', putMemoryBody)` | `putMemory(roomId, body)` `method: 'PUT'` · `auth: true` | 예정 |
| 응답 `MemoryResponse` | §4.17 · §5.9.1 | `types.ts` `MemoryResponse` | `const memory: MemoryResponse = await …memory.get/put` | `Result<MemoryResponse>` | 예정 |
| 본문 `PutMemoryBody` | §4.18 · §5.9.1 | `types.ts` `PutMemoryBody` | `schemas.ts` `putMemoryBody` → `const body: PutMemoryBody` | `body: PutMemoryBody` | 예정 |
| trim 후 0~4000 코드 포인트 | §4.18 · §5.7 | `limits.ts` 기존 3개 | 서비스 판정(라우트는 타입만) | 화면 카운터(ui 몫) | 예정 |
| 본문 상한 32KiB | §4.18 | — | `schemas.ts` `MEMORY_BODY_MAX_BYTES` | — | 예정 |
| 레이트리밋 GET 0 · PUT 1 | §6.1 | — | 미들웨어 유무 | — | 예정 |
| E9 응답 뒤 자동 요약 | §4.12 · §4.13 | — | `routes/messages.ts` 불변(`background` 그대로) | `speak` 불변 | 예정 |
| 엔드포인트 16 · 에러 15 불변 | §4.0 · §3.2 | `PATHS` 11 · `ERROR_CODES` 15 | — | — | 예정 |

### 12.7 4자 대조표 (S3f — 구현 완료 2026-10-08, 실물 파일:줄)

| 계약 항목 | api.md | shared | routes | ui/api | 판정 |
|---|---|---|---|---|---|
| 모델 키 타입·목록 | §5.8.6 | `types.ts:125` `LlmModelKey = 'pro' \| 'flash'` · `settings.ts:30` `LLM_MODEL_KEYS = ['pro', 'flash'] as const satisfies …` | `schemas.ts:64` `z.enum(LLM_MODEL_KEYS)` | `settings.ts:20` 인자 타입 `LlmModelKey` | ✅ (API-T-131) |
| E15 응답 `model` | §4.15 · §5.8.6 | `types.ts:138` `model: LlmModelKey \| null`(필수) | `routes/settings.ts:28` `.get` 불변 — `const response: CharacterSettingsResponse`가 tsc 대조 | `getCharacterSettings` 불변 | ✅ (API-T-094 갱신 · 126 · UI-034②) |
| E16 본문 `model?` | §4.16 · §5.8.6 | `types.ts:145` `model?: LlmModelKey \| undefined` | `schemas.ts:62~65` `putCharacterSettingsBody` → `routes/settings.ts:41` `const body: PutCharacterSettingsBody = c.req.valid('json')` | `ui/api/settings.ts:22` `model === undefined ? { settings } : { settings, model }` | ✅ (API-T-127 · UI-033) |
| optional 뜻(키 없음 = 유지, `null` = 400) | §4.16 | `?`(`null` 불포함) | `schemas.ts:64` `.optional()`만(`.nullable()` 없음) | 키 생략 · `null`은 컴파일 오류(`@ts-expect-error`) | ✅ (API-T-128 · 129 · UI-033 · 034①) |
| E16 서비스 호출 | §4.16 | — | `routes/settings.ts:43` `settings.put(body.settings, getPrincipal(c), body.model)` | — | ✅ (API-T-127 · 128) |
| 400 문구 · 판정 순서 | §4.16 | `settings.ts:33` `SETTINGS_MODEL_INVALID_MESSAGE` = `공통 · AI 모델 값이 올바르지 않습니다.` | `schemas.ts:71~78` `settingsIssueMessage` — `settings` 첫 위반 → `model` 순 | 서버 `message` 그대로(래퍼 미검사) | ✅ (API-T-129 · 130 · UI-034③) |
| 응답 키 5 · 모델명 비노출 | §4.15 · §16.4 | `src`·`ui/api`·`routes`에 `gemini-` 문자열 0(grep) | API-T-094 키 5 · API-T-126 응답 문자열에 모델명 없음 | — | ✅ |
| 엔드포인트 16 · 에러 코드 15 · 토큰 형식 불변 | §4.0 · §3.2 · §2.3 | `endpoints.ts`·`errors.ts` 변경 0(`ERROR_CODES` 15) | `routes/index.ts` 변경 0 | `ui/api/index.ts` 변경 0 | ✅ |

요구ID 반영: R-SET-004 ✅ · R-SET-005 ✅ · R-SET-013 ✅ · R-LLM-009(키만) ✅ · R-SET-007(§16.1 명시, 코드 변경 없음) ✅ · R-SET-012(부수 효과 문장, server 몫).

실행 증거(2026-10-08): `npx tsc --noEmit -p shared` exit 0 · `-p server` exit 0 · `-p ui`의 `ui/src/api` 오류 0건(화면 쪽 픽스처·상태는 ui 단계 몫) · `vitest run --project shared` 145/145 · `--project server` 24파일 439/439(routes-settings에 API-T-126 ~ 130 추가, 094 갱신) · `--project ui ui/src/api` 34/34(API-T-UI-033 · 034 추가).

### 12.8 4자 대조표 (S6 — 틀, 구현 후 contract-implementer가 실물 파일:줄로 채운다)

| 계약 항목 | api.md | shared | routes | ui/api | 판정 |
|---|---|---|---|---|---|
| `RoomSummary.locked: boolean`(E3·E4·E5·E18·E19) | §4.2 · §5.10.1 | `types.ts` — | `rooms.ts` 응답 타입 대입 — | `listRooms` 등 반환 타입 — | (구현 후) |
| E4 본문 `password?` · 응답 `CreateRoomResponse` | §4.6 · §5.10.1 | `CreateRoomBody` · `CreateRoomResponse` — | `schemas.ts` `createRoomBody` — · `roomTitleBody` 불변(E5) — | `createRoom` 반환 — | (구현 후) |
| E17 `POST /api/rooms/:id/enter` · `EnterRoomBody` · `EnterRoomResponse` · 토큰 선택 | §4.19 · §2.8.5 | `PATHS.roomEnter` · 타입 2 — | `rooms.ts` `optionalToken` · `enterRoomBody`(64) · 본문 1KiB — | `enterRoom(roomId, password?)` `auth: true` · `roomId` 없음 — | (구현 후) |
| E18 `PUT /api/rooms/:id/password` · `SetRoomPasswordBody` · `SetRoomPasswordResponse` | §4.20 | `PATHS.roomPassword` · 타입 2 — | `rooms.ts` ★room · `setRoomPasswordBody` · 본문 1KiB — | `setRoomPassword` — | (구현 후) |
| E19 `DELETE /api/rooms/:id/password` → `200 RoomSummary` | §4.21 | `PATHS.roomPassword`(공용) — | `rooms.ts` ★room — | `clearRoomPassword` `Result<RoomSummary>` — | (구현 후) |
| 헤더 `X-Room-Key`(헤더 전용, 쿼리·본문 금지) | §2.8.1 | `endpoints.ts` `ROOM_KEY_HEADER` — | server `requireRoomEntry`가 import(리터럴 0) — | `client.ts` `getRoomKey` · `RequestOptions.roomId` — | (구현 후) |
| 관문 적용 경로(E5·E6·E8·E9·E13·E14·E18·E19 room · E7 room(토큰 안 봄) · E10·E11·E12 message) · 관문 없음(E3·E4·E17) | §2.8.3 | — | `rooms.ts`·`messages.ts`·`memory.ts` 줄 — | 래퍼별 `roomId` 전달(메시지 id 래퍼 셋째·둘째 인자) — | (구현 후) |
| `ROOM_LOCKED` 403 · `ROOM_PASSWORD_WRONG` 403 · `isAuthFailure` 3코드 불변 | §3.2 | `errors.ts` 3곳 — | server `assertEntry`·`enter` throw(routes 변경 없음) | `AUTH_FAILURE_CODES` 불변 — | (구현 후) |
| E17 `429 RATE_LIMITED` 상황 문구 + `retryAfterSec` | §4.19 · §6.2 | — | server `hitEnterLimit` | `toRetryAfter` 불변 — | (구현 후) |
| 길이 상수 4 | §5.10.4 | `limits.ts` — | `enterRoomBody` refine(64) — | 화면 카운터(ui 몫) | (구현 후) |
| 엔드포인트 19 · 에러 코드 17 · `PATHS` 13 · 토큰 형식 불변 | §4.0 · §3.2 · §2.3 | `ERROR_CODES` 17 · `PATHS` 13 — | `routes/index.ts` 변경 0 — | — | (구현 후) |

---

## 13. 호환성 분류

S1은 처음 만드는 계약이라 **전부 「추가」**다. ui·갠홈 영향은 없다.

이후 묶음에서 바뀔 수 있는 자리:

| 자리 | 예상 변경 | 분류 | 대비 |
|---|---|---|---|
| `GET /api/rooms` 응답이 배열 그대로 | 방 목록 페이지네이션·부가 정보가 요구되면 응답 형태 변경 | **파괴** | 요구가 생기면 기존 경로 형태는 유지하고 쿼리 추가로 해결하는 쪽을 먼저 검토(§15.4) |
| `Message` | S2 수정 기능에 "수정됨" 표시 등이 요구되면 선택 필드 추가 | 추가 | 화면은 모르는 필드를 무시한다 |
| `MessagesPage` | 커서 필드 추가 | 추가 | — |
| `ERROR_MESSAGES` 문구 | S2~S4 착수 시 다듬기 | 비파괴 | 화면 표시는 `labels.ts`라 영향 없음 |
| `PATHS`·`endpoints` | S2~S4 키 추가 | 추가 | 기존 키는 바꾸지 않는다 |
| `ui/src/api/client.ts` `request` | S2에서 method·body·토큰 옵션 추가 | 추가(api 폴더 내부) | 화면은 `request`를 쓰지 않는다 |
| `limit` 기본·최대(30·100) | 값 변경 | 완화는 비파괴, 강화는 파괴 | server 상수가 단일 소스 |
| 토큰 형식(S2 확정 후) | payload·서명·`?t=` 이름 변경 | **파괴 + 저쪽 PHP 재적용** | §8 |
| `CHARACTERS.*.name` | 표시명 변경 | 비파괴(표시만) | S3부터는 `server/characters/*.json` name도 함께 바꾼다 |

### 13.1 S2 변경 분류 (v0.3)

| 변경 | 분류 | 영향 받는 곳 | 비고 |
|---|---|---|---|
| 엔드포인트 E4·E5·E6·E8·E10·E11 상세 확정 | 추가 | 없음(이전에는 `404`) | §4.0 집합은 S1부터 같다(R-API-001) |
| `PATHS.room` · `roomUser` · `message`, `endpoints.room/roomUser/message` | 추가 | 없음(기존 키 그대로) | shared 테스트 API-T-042의 "PATHS 값 4개" 기대를 7개로 고친다(테스트 갱신, 소비자 영향 없음) |
| `CreateRoomBody` · `RenameRoomBody` · `UserMessageBody` · `EditMessageBody` | 추가 | 없음 | |
| `ApiErrorBody.error.retryAfterSec?` | 추가(선택 필드) = **비파괴** | 없음. 기존 소비자는 모르는 키를 무시한다 | routes 테스트 `expectContractError`가 "키 정확히 2개"를 검사하므로 `RATE_LIMITED`만 3개로 허용하도록 고친다(테스트 갱신) |
| `ApiError.retryAfterSec?`(ui) | 추가(선택 필드) | 없음 | 화면은 아직 쓰지 않는다 |
| `request(path)` → `request(path, options?)` | 추가(선택 인자) | api 폴더 내부만. 기존 호출 그대로 동작 | 화면은 `request`를 쓰지 않는다 |
| `204` 정규화 규칙 | 추가 | 없음(기존 엔드포인트는 204를 내지 않는다) | |
| `configureClient` · `isAuthFailure` | 추가 | 없음 | `configureClient`를 부르지 않으면 getter가 `null`이라 S1 동작과 같다 |
| 토큰 형식·payload·`?t=` 확정 | 추가(처음 확정) | 저쪽 PHP — **아직 전달 전**이라 재적용 없음 | 이후 바꾸면 **파괴 + 저쪽 PHP 재적용**(§8) |
| `ERROR_CODES`·status·문구 | 변경 없음 | — | 13종 그대로 |
| `shared/src/limits.ts` 신규(v0.3.1) | 추가 | 없음(새 파일). server rooms·messages의 모듈 상수는 shared 재노출로 바뀐다(값 같음, S2-R4) | 상한 값을 바꾸면 화면·서버가 함께 바뀐다. 완화는 비파괴, 강화는 기존 데이터·화면 입력에 대해 파괴 |

- **파괴 변경 0건.** S1 엔드포인트(E1·E2·E3·E7)의 요청·응답·에러는 바뀌지 않았다. `GET /api/rooms/:id`는 여전히 `404`다(API-T-013).
- 이후 바뀔 수 있는 자리: 확정사항 §9-5(권한 "누구나")가 "작성자만"·"관리자만"으로 바뀌면 E5·E6·E10·E11에 `403` 계열 조건이 생긴다. 새 코드가 필요하면 13종 밖이라 R-API-002 개정이 필요하다(파괴는 아니지만 화면 안내 추가).

### 13.2 S3 변경 분류 (v0.4)

| 변경 | 분류 | 영향 받는 곳 | 비고 |
|---|---|---|---|
| E9·E12 상세 확정 | 추가 | 없음(이전에는 `404`) | §4.0 집합은 S1부터 같다(R-API-001) |
| `PATHS.roomSpeak` · `messageRegenerate`, `endpoints` 빌더 2개 | 추가 | 없음(기존 키 그대로) | API-T-042의 "PATHS 값 7개"를 9개로 고친다(테스트 갱신) |
| `SpeakBody` | 추가 | 없음 | |
| ui/api `speak` · `regenerate` | 추가 | 없음(화면은 S3에서 처음 쓴다) | |
| `ERROR_CODES`·status·문구 | 변경 없음 | — | S3 5코드 문구는 v0.1 그대로 확정 |
| `client.ts` | 변경 없음 | — | 타임아웃을 넣지 않는다 |
| routes 쓰기 표 6개 → 8개 | 테스트 갱신 | `server/test/routes-write.test.ts` | 소비자 영향 없음 |

- **파괴 변경 0건.** 기존 엔드포인트(E1~E8·E10·E11)의 요청·응답·에러·레이트리밋 한도 값은 바뀌지 않았다. speak·regenerate가 같은 분당 한도를 나눠 쓰므로 한 사람이 쓸 수 있는 다른 쓰기 횟수는 그만큼 준다.
- 저쪽 재적용 없음. 토큰·`?t=`·임베드 주소는 그대로다.
- 이후 바뀔 수 있는 자리: 생성 진행 상태·스트리밍이 요구되면 새 엔드포인트가 필요하다(R-API-001 개정). `Message`에 "생성 중" 같은 필드를 넣지 않는다.

### 13.3 S3b 변경 분류 (v0.4.1)

| 변경 | 분류 | 영향 받는 곳 | 비고 |
|---|---|---|---|
| 에러 코드 `LLM_BUDGET_EXCEEDED` 추가 | 추가(비파괴) | 옛 화면 번들은 `INTERNAL`로 정규화(§3.1) | 같은 Worker 배포라 새로 고치면 해소 |
| `retryAfterSec`가 붙는 코드 1개 확대(서버 본문) | 추가(선택 필드) | 없음 — ui/api는 이 코드의 값을 버린다 | |
| E9·E12 새 실패 경로(429) | 추가 | 기존 응답 불변 | 예산 미만이면 동작이 S3와 같다 |
| `shared/test/errors.test.ts` 13 → 14 | 테스트 갱신 | API-T-040 | |
| `expectContractError` 3키 허용 코드 확대 | 테스트 갱신 | `server/test/routes-write.test.ts` · `routes-generate.test.ts` | 소비자 영향 없음 |

- **파괴 변경 0건.** 엔드포인트·경로·요청·성공 응답·기존 13종의 status·문구·레이트리밋 한도 값은 바뀌지 않았다.
- 저쪽 재적용 없음. 토큰·`?t=`·임베드 주소는 그대로다. handoff는 S5에 안내 단락만 더한다(§8).

### 13.4 S3c 변경 분류 (v0.5)

| 변경 | 분류 | 영향 받는 곳 | 비고 |
|---|---|---|---|
| E15 · E16 신설(R-API-001 개정) | 추가 | 없음(이전에는 `404`) | 기존 14개 엔드포인트의 요청·응답·에러·레이트리밋 불변 |
| 에러 코드 `OWNER_ONLY` 추가(R-API-002 개정) | 추가(비파괴) | 옛 화면 번들은 `INTERNAL`로 정규화(§3.4). 옛 번들에는 설정 호출이 없어 실제로 받을 일이 없다 | `AUTH_FAILURE_CODES` 불변 — 기존 화면의 읽기 전용 전환 규칙이 바뀌지 않는다 |
| R-AUTH-003 예외(설정 GET 토큰 필요) | 추가 | 없음(새 경로에만 적용) | 기존 읽기 3종은 계속 토큰 불필요·헤더 무시 |
| 타입 4종 · `PATHS.characterSettings` · `endpoints.characterSettings` | 추가 | 없음(기존 키·타입 그대로) | API-T-042 "PATHS 값 9개" → 10개(테스트 갱신) |
| 신규 `shared/src/settings.ts` | 추가 | 없음 | `limits.ts`·`characters.ts` 불변 |
| routes `validate(target, schema, toMessage?)` | 추가(선택 인자) | routes 내부. 기존 호출은 기본 문구 그대로 | |
| ui/api `RequestOptions.method`에 `'PUT'` | 추가(api 폴더 내부) | 없음 | 화면은 `request`를 쓰지 않는다 |
| `shared/test/errors.test.ts` 14 → 15 | 테스트 갱신 | API-T-040 | |

- **파괴 변경 0건.** 엔드포인트 14개·에러 코드 14종의 status·문구·토큰 규칙·레이트리밋 한도 값은 바뀌지 않았다. E16이 쓰기 공용 분당 한도를 나눠 쓰므로 주인이 설정을 자주 저장하면 그 분의 다른 쓰기 횟수가 그만큼 준다.
- **토큰 형식·handoff 불변.** payload·서명·`?t=`·임베드 주소·PHP 조각이 그대로라 저쪽 재적용이 없다(R-AUTH-001 개정 없음, §2.7). `doc/handoff/**`는 이번에 고치지 않는다.
- 이후 바뀔 수 있는 자리:
  - 설정 필드를 더하면 E16 본문이 strict·키 필수라 **옛 화면 번들의 PUT이 `400`**이 된다(파괴). 같은 Worker로 함께 배포되므로 새로 고치면 풀린다. 내보내기 파일은 가져오기가 없는 키를 현 초안 값으로 채우므로(§16.2) `formatVersion`을 올리지 않아도 된다. 키 이름을 바꾸거나 형을 바꿀 때만 `formatVersion`을 올린다.
  - 상한 완화는 비파괴, 강화는 저장된 값·내보낸 파일에 대해 파괴다(저장 행 재검증 실패 → 시드 대체).
  - 낙관적 잠금(`baseVersion` + `409`)이 요구되면 선택 필드 추가 + 새 에러 코드(R-API-002 개정)가 필요하다.

### 13.5 S3d 변경 분류 (v0.6)

| 변경 | 분류 | 영향 받는 곳 | 비고 |
|---|---|---|---|
| `SpeakBody.character`에 `'auto'` 추가(`SpeakTarget`) | 추가(비파괴) | 없음 — 옛 화면 번들은 `'auto'`를 보내지 않고, 두 캐릭터 값의 동작은 그대로다 | 요청 쪽 열거 확장이라 소비자가 받는 값이 늘지 않는다 |
| `'auto'` 응답 | 추가 | 없음 — 응답 `speaker`는 기존 두 값 안 | `Speaker` 타입 불변 |
| 유저 메시지 `authorName` 값 규칙(실명 → 「어떠한 의지」) | **값 의미 변경 — 비파괴로 분류** | 우리 화면 1개. 이 필드를 문자열 그대로 표시만 한다(분기·파싱 없음). 타입·키·nullable 불변 | 근거 ① 소비자가 server와 같은 Worker로 함께 배포돼 호환 창이 없다 ② 화면은 값을 해석하지 않는다 ③ 저쪽(갠홈)은 이 응답을 읽지 않는다. 옛 메시지도 바뀐다(사용자 결정 Q6) |
| `USER_DISPLAY_NAME` | 추가 | 없음 | 새 export |
| E9 `'auto'` AI 호출 2~3회 | 추가(비용·시간 성질) | 월 비용 상한에 더 빨리 닿을 수 있다 | 70초 상한 불변 |
| 전송 1회 = E8 + E9로 레이트리밋 2회 | 화면 사용 방식 변화 | 한 사람의 분당 전송이 최대 10회(기본 20/분) | 한도 값·규칙 불변 |
| `routes-write.test.ts` 유저 `authorName` 단언 | 테스트 갱신 | API-T-062 | 소비자 영향 없음 |

- **파괴 변경 0건.** 엔드포인트·경로·에러 코드·status·문구·레이트리밋 한도는 그대로다.
- 파괴로 볼 여지가 있는 것은 `authorName` 값 변경 하나다. 화면이 실명을 기대해 분기하면 파괴지만, s3d-03 §3 기준 ui는 이 값을 표시와 대체 이름에만 쓴다(Bubble · MessageMenuSheet).
- **handoff 변경 없음.** 토큰 payload·서명·`?t=`·임베드 주소가 그대로라 `doc/handoff/*` 갱신도 저쪽 PHP 재적용도 없다. 토큰의 `ch_name`·`nick`은 계속 필요하다(D1 저장용).


### 13.6 S4 변경 분류 (v0.7)

| 변경 | 분류 | 영향 받는 곳 | 비고 |
|---|---|---|---|
| E13·E14 상세 확정 | 추가 | 없음 — 두 경로는 지금 `404`이고 부르는 화면 코드가 없다 | §4.0 행은 v0.1부터 있었다(엔드포인트 수 불변) |
| `MemoryResponse`·`PutMemoryBody` | 추가 | 없음 | 새 export |
| `PATHS.roomMemory`·`endpoints.roomMemory` | 추가 | `shared/test/endpoints.test.ts` API-T-042 기대값(10 → 11) | 기존 키 불변 |
| `getMemory`·`putMemory` | 추가 | 없음 | 새 export |
| E9 응답 뒤 자동 요약 | 추가(서버 동작) | 응답·status·소요·레이트리밋 불변. 월 AI 비용이 요약 호출만큼 늘 수 있다(R-LLM-007 누적) | 응답 직후 E13이 이전 값을 줄 수 있다 |
| `routes-generate.test.ts` `call` 도우미 | 테스트 갱신 | 소비자 영향 없음 | `waitOnExecutionContext` |

- **파괴 변경 0건.** 기존 엔드포인트·타입·필드·에러 코드·status·문구·레이트리밋 한도는 그대로다.
- **handoff 변경 없음.** 토큰 payload·서명·`?t=`·임베드 주소가 그대로라 저쪽 PHP 재적용이 없다. S5 비용 안내에 한 줄을 더한다(§8 TODO).

### 13.7 S3f 변경 분류 (v0.8)

| 변경 | 분류 | 영향 받는 곳 | 비고 |
|---|---|---|---|
| `CharacterSettingsResponse.model`(E15·E16 응답) | 추가(비파괴) | 배포된 화면 번들은 모르는 키를 무시한다. 타입은 필수 필드라 응답 픽스처를 만드는 코드가 tsc에서 잡힌다: `server/test/routes-settings.test.ts`(API-T-094 키 4 → 5) · `ui/src/api/settings.test.ts` · `ui/src/settings/test/fixtures.ts` · `ui/src/rooms/test/OwnerGate.test.tsx` 등(s3f-02 §8) | 화면 소비는 ui 설계 몫 |
| `PutCharacterSettingsBody.model?`(E16 본문) | 추가(비파괴) | 기존 호출 `ui/src/settings/useSettingsEditor.ts:122` `saveCharacterSettings(check.value)`는 키를 보내지 않으므로 그대로 통과하고 저장값을 유지한다 | 이전에는 봉투의 모르는 키라 버려졌다. 이제 `model`만 알려진 키라 `null`·그 밖 값이 `400`이다. 그런 본문을 보내는 소비자는 없다(우리 화면 1개, 같은 배포) |
| E16 `400` 문구 1행 `공통 · AI 모델 값이 올바르지 않습니다.` | 추가 | 없음 | 코드는 `VALIDATION_ERROR` 그대로. 판정 6 안에서 `settings` 다음이라 기존 문구·순서 불변 |
| E16 부수 효과(같은 행 `llm_model`·모델 적용 시점)·로그 `model` 필드 | 추가(서버 동작) | 응답 형태·status·레이트리밋 불변. 모델만 바꿔 저장해도 `version` +1(기존 "저장 = +1" 규칙 그대로) | — |
| `LlmModelKey` · `LLM_MODEL_KEYS` · `SETTINGS_MODEL_INVALID_MESSAGE` | 추가 | 없음 | 새 export |
| `saveCharacterSettings(settings, model?)` | 추가(선택 인자) | 기존 호출부 무수정 컴파일 | — |
| 내보내기 파일(§16.1) | 변경 없음(명시만) | 없음 | `formatVersion` 1 |

- **파괴 변경 0건.** 엔드포인트 16개·에러 코드 15종·경로(`PATHS` 11)·status·기존 문구·레이트리밋 한도·본문 상한이 그대로다.
- **handoff: PHP 조각·토큰 형식·`?t=`·임베드 주소 불변 → 저쪽 재적용 없음.** 설정값 안내 문구만 고친다(§8).
- **배포 순서(server 몫, s3f-02 §12):** D1 마이그레이션 0004를 먼저 적용하고 코드를 배포한다. 거꾸로면 E15·E16과 speak가 `500 INTERNAL`이다(§4.15 에러 표). 코드만 이전 커밋으로 되돌리는 것은 안전하다(칸이 NULL 허용).

### 13.8 S6 변경 분류 (v0.9)

| 변경 | 분류 | 영향 받는 곳 | 비고 |
|---|---|---|---|
| E17 · E18 · E19 신규 | 추가 | 없음 | 새 경로 2·메서드 3 |
| `RoomSummary.locked`(응답 키 추가) | 추가(비파괴) | 배포된 화면 번들은 모르는 키를 무시한다. 타입은 **필수** 필드라 `RoomSummary`를 만드는 픽스처가 tsc에서 잡힌다 — server 테스트 키 집합 단언(SRV-T-042 등)·routes 테스트(E3 키 집합)·ui `RoomSummary` 픽스처(rooms·chat 테스트 약 18파일, s6-02 §13) | 공용 픽스처 도우미 권고(ui 몫) |
| `CreateRoomBody.password?` · E4 응답 `entryKey` | 추가(선택 요청 필드 · 응답 키) | 기존 `createRoom(body)` 호출은 그대로 통과(`locked: false`, `entryKey: null`). 반환 타입이 `CreateRoomResponse`(상위 집합)로 넓어져 호출부 무수정 컴파일 | — |
| 요청 헤더 `X-Room-Key` | 추가(선택 헤더) | 없음 — 안 잠긴 방은 헤더를 보지 않는다 | — |
| E5~E14 "잠긴 방이면 `403 ROOM_LOCKED`" | **의미 추가 — 기존 방 영향 없음** | 0005 이후 기존 방은 전부 `pass_hash NULL`(R-LOCK-009). 누군가 방을 잠근 뒤에만 나온다. 옛 번들은 `INTERNAL`로 정규화(§3.1) | 검증 강화가 아니다 — 기존 요청이 기존 방에서 다르게 끝나는 경우 0 |
| 에러 코드 2개(`ROOM_LOCKED`·`ROOM_PASSWORD_WRONG`) | 추가(비파괴) | `isAuthFailure` 불변. `ERROR_CODES` 길이 단언(API-T-040) 갱신 | — |
| `PATHS` 2개 · `ROOM_KEY_HEADER` · 길이 상수 4 · 타입 6 | 추가 | API-T-042(`PATHS` 13) 갱신 | 새 export |
| `ClientConfig.getRoomKey?` · `RequestOptions.roomId?` | 추가(선택) | 기존 `configureClient({ getToken })` 무수정 컴파일 | — |
| `editMessage` · `deleteMessage` · `regenerate`에 **필수 마지막 인자 `roomId`** | **ui 내부 파괴(TS 시그니처)** — HTTP 계약 무관 | 화면 호출부 `ui/src/chat/useMessageWrites.ts:142`(`editMessage`) · `:165`(`deleteMessage`) · `:264`(`regenerate`). 래퍼 테스트 `ui/src/api/api.test.ts:158 · 159 · 221 · 249 · 250 · 288 · 318 · 370 · 382`. 화면 테스트의 인자 단언(`regenerate(72)` "인자 하나" — `ui/src/chat/test/MessageActions.test.tsx:768` · `Regenerate.test.tsx:233` · `AutoReply.test.tsx:417`, `ui/src/chat/design/tc.md` TC-CH-043·045·080 · `actions-tests.md` TC-CH-115~117) | 의도된 컴파일 오류(빠뜨림 방지, s6-02 §4.7). 구축 흐름 안에서 contract 8단계 → ui 9단계가 같은 S6으로 고친다(s6-03 §0). 그 사이 `tsc -p ui`의 화면 쪽 오류는 ui 단계 몫 |
| 토큰 payload·서명·`?t=`·PHP 조각·임베드 주소 | 변경 없음 | 없음 | `TOKEN_SECRET`에 "입장 증명 파생" 용도만 추가(값·형식 불변) |

- **HTTP·토큰 파괴 변경 0건.** 엔드포인트 16 → 19 · 에러 코드 15 → 17 · `PATHS` 11 → 13. 기존 요청·응답 키·status·문구·레이트리밋 한도(회원 쓰기)가 그대로다.
- **handoff: 저쪽 재배포·재적용 없음.** 우리 몫 안내 2줄만(§8).
- **배포 순서(server 몫, s6-02 §12):** D1 마이그레이션 0005를 먼저 적용하고 코드를 배포한다. 거꾸로면 `pass_hash`를 읽는 E3부터 `500 INTERNAL`이다. **코드만 이전 커밋으로 되돌리면 잠긴 방이 모두 열린다**(이전 코드는 `pass_hash`를 모른다) — 되돌리기 전 사용자 확인(s6-02 §13).

---

## 14. 테스트 계획

### 14.1 routes — `server/test/routes/*.test.ts`

- 실행: `@cloudflare/vitest-pool-workers`(workerd, D1 바인딩, 마이그레이션 적용 — db.md §8).
- 앱: `const app = createApp({ routes: apiRoutes, now: () => 1_700_000_000_000 })`. 호출: `app.request(path, init, testEnv, createExecutionContext())`.
- `testEnv`: `cloudflare:test`의 `env`를 펼치고 필요한 키만 바꾼다(index.md §8 방식). `ASSETS`는 index.md 픽스처의 가짜 Fetcher를 쓴다.
- 데이터: 직접 `INSERT`로 넣는다. 메시지 id는 INSERT 결과에서 얻고 절대값을 가정하지 않는다.
- 공용 단언 `expectContractError(res, code)`: status가 `ERROR_STATUS[code]`이고, 본문 키가 정확히 `error` 하나이며, `error` 키가 정확히 `code`·`message`이고, `message`가 비어 있지 않음을 확인한다(R-API-002). 모든 에러 테스트가 이 단언을 쓴다.

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| API-T-001 | `health_returns_ok_and_version` | `GET /api/health` | 200, 본문 키가 정확히 `ok`·`version`, `ok === true`, `version`이 빈 문자열 아님 | R-API-005 |
| API-T-002 | `health_ok_even_if_db_unusable` | `DB`를 모든 `prepare`가 throw하는 가짜로 교체 | 200(DB 미접근) | R-API-005 |
| API-T-003 | `health_returns_CONFIG_INVALID_when_secret_missing` | `TOKEN_SECRET` 제거 | `expectContractError(res, 'CONFIG_INVALID')`, 본문에 키 이름 없음 | R-ENV-003 · R-API-002 |
| API-T-004 | `api_responses_carry_csp_without_x_frame_options` | `GET /api/rooms` | (v0.6.1 SEC-003) `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options` 없음 | R-API-006 |
| API-T-005 | `embed_is_not_shadowed_by_api_routes` | `GET /embed?t=x`(실제 `apiRoutes` 장착) | 가짜 `ASSETS`가 `/`를 받고 200 | R-API-006 · R-API-001 |
| API-T-010 | `rooms_returns_empty_array` | 빈 DB | 200 `[]` | R-ROOM-001 |
| API-T-011 | `rooms_sorted_desc_with_contract_fields` | `updated_at` 100·300·200, 메시지 0·2·5 | 300·200·100 순, 각 항목 키가 정확히 `id,title,createdAt,updatedAt,messageCount`, 시각·개수가 number | R-ROOM-001 · R-API-004 |
| API-T-012 | `rooms_ignores_authorization_header` | `Authorization: Bearer garbage` | 200, API-T-011과 같은 본문 | R-AUTH-003 |
| API-T-013 | `single_room_get_does_not_exist` | `GET /api/rooms/<존재하는 id>` | `expectContractError(res, 'NOT_FOUND')` | R-API-001 |
| API-T-014 | `rooms_hides_db_failure_as_INTERNAL` | `prepare`가 `Error('SENTINEL_DB')`를 throw하는 `DB` | `expectContractError(res, 'INTERNAL')`, 본문에 `SENTINEL_DB`·`stack` 없음 | R-API-002 · R-NFR-004 |
| API-T-020 | `messages_first_page_defaults_to_30_ascending` | 70건 방, 쿼리 없음 | 200, 30건, id 오름차순, 최신 30건, `hasMore === true` | R-MSG-001 |
| API-T-021 | `messages_three_pages_via_before_cursor` | 70건, `before = messages[0].id`로 2회 더 | 30·30·10건, `hasMore` true·true·false, 쪽 사이 중복·누락 없음 | R-MSG-001 · R-CHAT-003 |
| API-T-022 | `messages_accepts_limit_bounds_and_empty_values` | `limit=1` · `limit=100` · `?before=&limit=` | 1건 · 70건(전부) · 쿼리 없음과 같은 결과 | R-MSG-001 |
| API-T-023 | `messages_item_shape_has_no_authorMbId` | 캐릭터·유저 line·유저 ooc 각 1건 | 키가 정확히 `id,roomId,speaker,kind,text,authorName,createdAt`, `id`·`createdAt` number, 캐릭터 `authorName === null` | R-API-004 · R-MSG-001 |
| API-T-024 | `messages_ignores_authorization_header` | `Authorization: Bearer garbage` | 200 | R-AUTH-003 |
| API-T-030 | `messages_rejects_invalid_limit` | `limit` = `0` · `101` · `1.5` · `abc` | 각 `expectContractError(res, 'VALIDATION_ERROR')`, message = `불러올 개수(limit)는 1~100 사이의 정수여야 합니다.` | R-MSG-001 · R-API-004 |
| API-T-031 | `messages_rejects_invalid_before` | `before` = `0` · `-1` · `abc` · `9007199254740992` | 각 400 `VALIDATION_ERROR`, message = `기준 메시지 번호(before)가 올바르지 않습니다.` | R-MSG-001 · R-API-004 |
| API-T-032 | `messages_rejects_repeated_query_key` | `?limit=1&limit=2` | 400 `VALIDATION_ERROR`, message = `요청 형식이 올바르지 않습니다.` | R-API-004 |
| API-T-033 | `messages_unknown_room_returns_NOT_FOUND` | 없는 id(`before` 유무 둘 다) | `expectContractError(res, 'NOT_FOUND')`, message = `방을 찾을 수 없습니다.` | R-MSG-001 |
| API-T-034 | `messages_validates_before_room_lookup` | 없는 id + `limit=0` | 400 `VALIDATION_ERROR`(404 아님) | R-MSG-001 |

- 정상 경로는 12건이다(001·002·004·005·010·011·012·020~024). 에러 경로는 8개 테스트에 입력 15건이다(030·031은 입력 4개씩, 033은 2개). 에러 입력 수가 정상 경로 수보다 많다(스킬 §10).

### 14.2 shared — `shared/test/*.test.ts`

| 테스트ID | 이름 | 기대 | 요구 |
|---|---|---|---|
| API-T-040 | `error_table_matches_contract` | `ERROR_CODES` 집합이 R-API-002 13종과 같음, 모든 코드에 `ERROR_STATUS`·`ERROR_MESSAGES`가 있음, status가 §3.2 표와 같음, 문구가 비어 있지 않음 | R-API-002 |
| API-T-041 | `isErrorCode_accepts_only_contract_codes` | `'NOT_FOUND'` true · `'NETWORK'`·`'not_found'`·`1`·`undefined` false | R-API-002 |
| API-T-042 | `endpoints_build_paths_and_queries` | `PATHS` 값 4개, `roomMessages('a b/c')` → `/api/rooms/a%20b%2Fc/messages`, `{ before: 41 }` → `?before=41`, `{ before: 41, limit: 30 }` → `?before=41&limit=30`, `{}`·`{ limit: undefined }` → 물음표 없음 | R-API-001 · R-API-008 |
| API-T-043 | `characters_meta_matches_contract` | 키가 정확히 `sebastian`·`ciel`, 각 `id`가 키와 같음, `name`이 확정사항 §1 전체 이름, `shortName`이 `세바스찬`·`시엘`, `avatar === '/embed/img/{id}.png'` | R-LLM-002 · R-CHAT-002 |
| API-T-044 | `no_path_literals_outside_shared`(리뷰 grep) | §14.4 경로 리터럴 grep 결과 0건 | R-API-008 |

### 14.3 ui/api — `ui/src/api/__tests__/*.test.ts` (`vi.stubGlobal('fetch', …)`)

| 테스트ID | 이름 | 기대 | 요구 |
|---|---|---|---|
| API-T-UI-001 | `request_returns_ok_value_on_2xx_json` | 200 JSON → `{ ok: true, value }` | R-API-002 |
| API-T-UI-002 | `request_passes_contract_error_body_through` | 404 `{ error: { code: 'NOT_FOUND', message: '방을 찾을 수 없습니다.' } }` → 같은 `code`·`message` | R-API-002 |
| API-T-UI-003 | `request_maps_fetch_failure_to_NETWORK` | `fetch`가 reject / 동기 throw → `{ code: 'NETWORK', message: '서버에 연결할 수 없습니다.' }` | R-API-002 |
| API-T-UI-004 | `request_maps_non_contract_error_body_to_INTERNAL` | 502 HTML 본문 → `INTERNAL` + `ERROR_MESSAGES.INTERNAL` | R-API-002 |
| API-T-UI-005 | `request_handles_unknown_code_and_missing_message` | 모르는 code → `INTERNAL`. `{ code: 'RATE_LIMITED' }`(message 없음) → `ERROR_MESSAGES.RATE_LIMITED` | R-API-002 |
| API-T-UI-006 | `request_maps_non_json_success_to_INTERNAL` | 200 + 본문 `'not json'` → `INTERNAL` | R-API-002 |
| API-T-UI-007 | `listRooms_calls_GET_api_rooms_without_auth` | URL `/api/rooms`, method `GET`, `Authorization` 헤더 없음 | R-ROOM-001 · R-AUTH-003 |
| API-T-UI-008 | `listMessages_builds_path_and_query` | `('r1')` → `/api/rooms/r1/messages`, `('r1', { before: 41 })` → `…?before=41`, `('a b', { limit: 10 })` → `/api/rooms/a%20b/messages?limit=10` | R-MSG-001 · R-API-008 |
| API-T-UI-009 | `getHealth_calls_GET_api_health` | URL `/api/health` | R-API-005 |
| API-T-UI-010 | `wrappers_never_reject` | `fetch` throw · `json()` throw · 500 등 모든 경우에 `await`가 reject하지 않음 | R-API-002 |

### 14.4 리뷰·수동

- 라우트 핸들러 30줄 이내, try/catch·`c.env` 설정 키·`c.json({ error … })` 직접 생성 0건(R-API-007·R-ENV-001·R-API-002).
- `fetch(` 사용이 `ui/src/api/` 밖에서 0건이어야 한다(경계). 경로 리터럴은 `shared/src/endpoints.ts` 밖에서 0건이어야 한다(API-T-044, R-API-008).

```bash
grep -rn "fetch(" ui/src --include=*.ts --include=*.tsx | grep -v "^ui/src/api/"
grep -rnE "[\"'\`]/(api|embed)" server/src/routes ui/src/api
```
- 시드 적용 후 `curl -i http://localhost:3000/api/rooms/00000000-0000-4000-8000-000000000001/messages`가 30건·오름차순·`hasMore: true`, `authorMbId` 없음.

### 14.5 S2 routes — `server/test/routes.test.ts` (API-T-050 ~ 066)

준비:

- 토큰: server가 만드는 `server/test/token.ts`의 `signTestToken(payload, 'test-secret')`(vitest 바인딩 `TOKEN_SECRET`과 같은 값, auth.md §3·§9.1). 기본 payload는 `{ mb_id: 'writer_a', nick: '테스터', ch_name: '시엘 팬텀하이브', level: 5, exp: NOW / 1000 + 43200 }`이고 테스트마다 필요한 키만 바꾼다.
- 시각: 기존 `NOW = 1_700_000_000_000` 그대로. 분 창 시작이 `1_699_999_980_000`이라 `retryAfterSec`는 항상 **40**이다.
- 설정: `TOKEN_MIN_LEVEL`·`RATE_LIMIT_PER_MIN`은 기본값(5·20)을 쓰고, 한도 테스트만 `baseEnv({ RATE_LIMIT_PER_MIN: '2' })`처럼 바꾼다. `resetDb`가 `rate_limits`도 비운다(이미 구현됨).
- `WRITES` 표: 6개 엔드포인트의 `{ method, path, body }`를 시드 방·메시지로 채워 050~053이 같은 표를 돈다.
- `expectContractError(res, code)` 갱신: `RATE_LIMITED`만 `error` 키가 정확히 `code`·`message`·`retryAfterSec`이고 `Retry-After` 헤더가 같은 값이다. 나머지 코드는 S1처럼 정확히 `code`·`message`다.

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| API-T-050 | `writes_require_token_on_all_six_endpoints` | `WRITES` 6개, `Authorization` 없음 | 전부 `expectContractError(res, 'TOKEN_REQUIRED')`. 방 수·메시지 본문 불변 | R-AUTH-003(라우트 표 전건 대조) |
| API-T-051 | `writes_ignore_query_cookie_and_non_bearer_token` | `POST /api/rooms`에 유효 토큰을 `?t=`로만 · `Cookie: t=`로만 · `Authorization: Basic <t>` · `Authorization: Bearer ` | 전부 401 `TOKEN_REQUIRED` | R-AUTH-003 · R-API-003 |
| API-T-052 | `writes_reject_forged_or_expired_token` | `WRITES` 6개 × SECRET `wrong-secret` 토큰. 추가로 `exp = NOW / 1000`(경계) · `level: "5"`(문자열) | 전부 401 `TOKEN_INVALID`, message = 기본 문구(단계 정보 없음) | R-AUTH-001 · R-AUTH-002 |
| API-T-053 | `writes_reject_low_level_with_LEVEL_TOO_LOW` | `WRITES` 6개 × `level: 4`. 추가로 만료된 `level: 4` | 6개 403 `LEVEL_TOO_LOW`. 만료+저등급은 401 `TOKEN_INVALID`(만료 우선) | R-AUTH-002 |
| API-T-054 | `writes_rate_limited_on_21st_request` | 같은 토큰으로 `POST /api/rooms` 21회, 이어서 다른 `mb_id`로 1회 | 1~20번째 201, 21번째 `expectContractError(res, 'RATE_LIMITED')` + `retryAfterSec === 40` + `Retry-After: 40`, 방 20개. 다른 `mb_id`는 201 | R-AUTH-005 · R-NFR-003 · R-API-002 |
| API-T-055 | `auth_precedes_validation_and_failed_writes_are_counted` | 한도 2. ① 토큰 없이 `{}` ② 위조 토큰 3회 ③ 유효 토큰으로 `{}` 2회 ④ 유효 토큰으로 정상 본문 | ① 401(400 아님) ② 401 ×3(세지 않음) ③ 400 ×2(셈) ④ 429 | R-AUTH-003 · R-AUTH-005 |
| API-T-056 | `reads_stay_open_and_do_not_count` | 한도 1. 쓰기 1회(201) 뒤 `GET /api/rooms`·`GET …/messages`를 헤더 없음·위조 토큰·유효 토큰으로 | 읽기 전부 200. `rate_limits.count` = 1 그대로 | R-AUTH-003 |
| API-T-057 | `create_room_returns_201_summary` | `{ title: '  안개 낀 런던  ' }` · `{ title: 'x', foo: 1 }` | 201. 키가 정확히 `id,title,createdAt,updatedAt,messageCount`, `title === '안개 낀 런던'`, `id`가 UUID v4, `createdAt === updatedAt === NOW`, `messageCount === 0`. `GET /api/rooms` 첫 항목과 같음. 모르는 키는 무시하고 201 | R-ROOM-002 · R-API-004 |
| API-T-058 | `create_room_rejects_bad_title_or_body` | 제목 `''`·`'   '`·61자·이모지 61개 / 통과 60자·이모지 60개 / 본문 `{}`·`{ title: 1 }`·깨진 JSON·`Content-Type` 없는 JSON | 제목 위반 400 `방 제목은 1~60자로 입력해 주세요.`, 통과 201, 형식 위반 400 `요청 형식이 올바르지 않습니다.` | R-ROOM-002 · R-API-004 |
| API-T-059 | `rename_room_keeps_updatedAt_and_validates` | 메시지 2개·`updated_at` 100인 방 → `{ title: '새 이름' }` / 61자 / 없는 id / 없는 id + 61자 | 200 `title` 변경·`updatedAt === 100`·`messageCount === 2`, 목록 순서 불변 / 400 / 404 `방을 찾을 수 없습니다.` / 400 | R-ROOM-003 · R-ROOM-005 |
| API-T-060 | `delete_room_returns_204_and_cascades` | 메시지 3개 방 삭제, 같은 방 다시 삭제 | 204·본문 빈 문자열. 이어 `GET …/messages` 404, 목록에서 빠짐, 두 번째 삭제 404 | R-ROOM-004 · R-DB-003 |
| API-T-061 | `append_user_returns_201_message` | `{ text: ' 안녕 ', ooc: false }` · `ooc: true` · `ch_name: ''` 토큰 | 201. 키가 정확히 `id,roomId,speaker,kind,text,authorName,createdAt`(`authorMbId` 없음), `speaker 'user'`, `kind` `line`/`ooc`, `text '안녕'`, `authorName` `'시엘 팬텀하이브'` / nick `'테스터'`, `createdAt === NOW`. 방 `updatedAt === NOW`, DB `author_mb_id === 'writer_a'` | R-MSG-002 · R-AUTH-004 · R-ROOM-005 · R-AUTH-006 |
| API-T-062 | `append_user_rejects_bad_body_or_room` | `text` `''`·`'  \n '`·2001자 / `{ text: 'x' }`·`{ text: 'x', ooc: 'true' }`·`{ text: 1, ooc: false }` / 없는 방 | 400 `메시지는 1~2000자로 입력해 주세요.` / 400 기본 문구 / 404 `방을 찾을 수 없습니다.`. 메시지 0건 추가 | R-MSG-002 |
| API-T-063 | `edit_message_returns_200_and_keeps_meta` | 유저 메시지·캐릭터 메시지에 `{ text: ' 고침 ' }` | 200, `text '고침'`, `speaker`·`kind`·`authorName`·`createdAt` 그대로, 방 `updatedAt === NOW` | R-MSG-004 · R-ROOM-005 |
| API-T-064 | `message_id_and_text_errors` | PATCH·DELETE에 id `abc`·`0`·`1.5`·`0x10`·`1e1`·없는 큰 수 / 있는 id에 2001자 / `abc` + 빈 본문 | 404 `메시지를 찾을 수 없습니다.` / 400 / 404(id 판정이 먼저) | R-MSG-004 · R-MSG-005 |
| API-T-065 | `delete_message_returns_204` | 메시지 3개 중 가운데 삭제, 같은 id 다시 삭제 | 204, 페이지에 2건, 방 `updatedAt === NOW`, 두 번째 404 | R-MSG-005 · R-ROOM-005 |
| API-T-066 | `other_mb_id_can_modify_rooms_and_messages` | `writer_a`가 방·유저 메시지 생성 → `writer_b` 토큰으로 방 이름 변경·메시지 수정·메시지 삭제·방 삭제 | 200 · 200 · 204 · 204 | R-ROOM-003 · R-ROOM-004 · R-MSG-008 |

- 정상 경로 9개(054 일부·056·057·059 일부·060·061·063·065·066)보다 에러 입력이 많다(050~053만 27건).

### 14.6 S2 shared — `shared/test/*.test.ts`

| 테스트ID | 이름 | 기대 | 요구 |
|---|---|---|---|
| API-T-042(갱신) | `endpoints_build_paths_and_queries` | `PATHS` 값 **7개**. 나머지 기대는 S1 그대로 | R-API-001 · R-API-008 |
| API-T-045 | `endpoints_build_write_paths` | `PATHS.room === '/api/rooms/:id'`, `roomUser === '/api/rooms/:id/user'`, `message === '/api/messages/:id'`. `room('a b/c')` → `/api/rooms/a%20b%2Fc`, `roomUser('r1')` → `/api/rooms/r1/user`, `message(41)` → `/api/messages/41` | R-API-001 · R-API-008 |
| API-T-046 | `limits_match_requirements_and_count_code_points` (v0.3.1) | 상수 `60`·`2000`·`4000`. `countCodePoints`: `''` → 0, `'abc'` → 3, `'한글'` → 2, `'😀'` → 1(`.length`는 2), `'👨‍👩‍👧'` → 5, 이모지 60개 → 60. `normalizeText`: `'  a \n b \n'` → `'a \n b'`(중간 유지), `'　x　'` → `'x'`, `'   '` → `''` | R-ROOM-002 · R-MSG-002 · R-MSG-004 · R-MEM-001 |

### 14.7 S2 ui/api — `ui/src/api/api.test.ts` (`vi.stubGlobal('fetch', …)`, 각 테스트 전에 `configureClient({ getToken: () => null })`)

| 테스트ID | 이름 | 기대 | 요구 |
|---|---|---|---|
| API-T-UI-011 | `write_wrappers_send_method_url_body_and_bearer` | getter `'tok'`. `createRoom({ title: 't' })` POST `/api/rooms` 본문 `{"title":"t"}` · `renameRoom('a b', …)` PATCH `/api/rooms/a%20b` · `deleteRoom('r1')` DELETE `/api/rooms/r1`(본문·`Content-Type` 없음) · `appendUser('r1', { text: 'x', ooc: true })` POST `/api/rooms/r1/user` · `editMessage(41, { text: 'y' })` PATCH `/api/messages/41` · `deleteMessage(41)` DELETE `/api/messages/41`. 6개 모두 `Authorization: Bearer tok`, 본문이 있으면 `Content-Type: application/json` | R-API-003 · R-CHAT-009 · R-ROOMS-002 · R-CHAT-006 · R-CHAT-007 |
| API-T-UI-012 | `read_wrappers_never_send_authorization` | getter `'tok'`인데 `listRooms`·`listMessages`·`getHealth`에 `Authorization`·`Content-Type` 없음, method GET | R-AUTH-003 · R-API-003 |
| API-T-UI-013 | `write_without_token_sends_no_authorization` | getter `null` · `''` 각각 `createRoom` → 헤더 없음. 서버 401 `TOKEN_REQUIRED` 본문을 그대로 `Result.error`로 | R-API-003 |
| API-T-UI-014 | `rate_limited_carries_retryAfterSec` | 429 `{ error: { code: 'RATE_LIMITED', message, retryAfterSec: 40 } }` → `error.retryAfterSec === 40`. 값이 `0`·`'40'`·`1.5`·없음이면 키 없음(`'retryAfterSec' in error === false`). `NOT_FOUND`에 붙어 오면 버림 | R-AUTH-005 · R-CHAT-011 |
| API-T-UI-015 | `delete_wrappers_map_204_to_ok_undefined` | 204 본문 없음 → `{ ok: true, value: undefined }`, `json()` 미호출. 201 빈 본문(`createRoom`)은 S1 규칙대로 `INTERNAL` | R-ROOM-004 · R-MSG-005 · R-API-002 |
| API-T-UI-016 | `isAuthFailure_matches_three_auth_codes` | `TOKEN_REQUIRED`·`TOKEN_INVALID`·`LEVEL_TOO_LOW` → true. `RATE_LIMITED`·`VALIDATION_ERROR`·`NOT_FOUND`·`NETWORK`·`INTERNAL` → false | R-CHAT-011 |
| API-T-UI-017 | `write_wrappers_send_contract_keys_only_and_never_reject` | `createRoom({ title: 't', extra: 1 } as CreateRoomBody)` → 본문 `{"title":"t"}`. `appendUser`도 `text`·`ooc`만. 6개 쓰기 래퍼가 `fetch` throw·500 HTML에서도 reject하지 않음(`NETWORK`·`INTERNAL`) | R-API-002 · R-API-004 |
| API-T-UI-018 | `token_never_persisted_or_sent_in_query`(리뷰 grep) | §14.8의 grep 결과 0건 | R-API-003 · R-CHAT-009 · R-AUTH-006 |

### 14.8 S2 리뷰·수동

```bash
# 토큰 저장 금지 (API-T-UI-018) — token.ts 는 ui 구현 후 대상에 포함
grep -rnE "localStorage|sessionStorage|document\.cookie|indexedDB" ui/src/api ui/src/state/token.ts
# API 호출에 ?t= 금지
grep -rn "?t=" ui/src/api
# 인증 미들웨어 전역 적용·principal 직접 읽기 금지
grep -rnE "\.use\(|get\('principal'\)" server/src/routes
```

- 라우트 핸들러 30줄 이내, 쓰기 핸들러 6개 모두 `requireToken`·`rateLimitWrites`가 `validate` 앞(R-API-007, API-T-050이 자동 대조).
- 수동: `wrangler dev`에서 토큰 없이 `curl -i -X POST http://localhost:3000/api/rooms -H 'content-type: application/json' -d '{"title":"x"}'` → 401 `TOKEN_REQUIRED`. 로컬 SECRET으로 만든 토큰으로 21회 → 21번째 `429`·`Retry-After`.

### 14.9 S3 routes — `server/test/routes-generate.test.ts` (API-T-070 ~ 084)

준비:

- 앱·토큰·시각은 §14.5와 같다(`signTestToken`, `NOW`). 성공 경로는 `testEnv`에 `LLM_PROVIDER: 'fake'`를 넣는다. 각본 없는 `FakeProvider`는 `FAKE_DEFAULT_TEXT`를 돌려준다(llm.md §2).
- `502` 경로는 `LLM_PROVIDER: 'google'` + 테스트용 가짜 키 문자열(실값 아님)로 두고 `vi.stubGlobal('fetch', …)`로 제공사 응답을 흉내 낸다. `GeminiProvider`의 기본 `fetchFn`은 전역 `fetch`이고 요청마다 새로 만든다(llm.md §2.2). 재시도 없는 실패(HTTP 400)·차단(`promptFeedback.blockReason`)·이름표만 있는 텍스트(후처리 뒤 빈 결과)를 쓴다. 재시도가 걸리는 5xx·타임아웃은 server 테스트(SRV-T-198·208)에 맡긴다. 이 방식이 workerd에서 막히면 §15.9 S3-R3.
- 잠금 상태는 `UPDATE rooms SET speaking_until = ?`로 직접 만든다. 동시 요청 경합은 server SRV-T-199가 맡는다.
- `expectContractError`는 §14.5 그대로다.

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| API-T-070 | `speak_returns_201_character_message` | 시드 방, `{ character: 'sebastian' }` · `{ character: 'ciel', foo: 1 }` | 201. 키가 정확히 `id,roomId,speaker,kind,text,authorName,createdAt`, `speaker` = 보낸 값, `kind 'line'`, `authorName null`, `text` 비어 있지 않음, `createdAt === NOW`. 방 `updatedAt === NOW`, `speaking_until` NULL, DB `author_mb_id` NULL. 모르는 키 무시 | R-MSG-003 · R-ROOM-005 · R-LLM-002 |
| API-T-071 | `speak_allows_same_character_twice` | `ciel` 2회 연속 | 둘 다 201, 두 번째 id가 더 큼, 히스토리 마지막 2건이 `ciel` | R-MSG-003 |
| API-T-072 | `speak_rejects_bad_character` | `{}` · `'meirin'` · `'Sebastian'` · `''` · `1` · `null` · 깨진 JSON · `Content-Type` 없음 | 전부 400 `VALIDATION_ERROR` `요청 형식이 올바르지 않습니다.`, 메시지 0건 추가 | R-MSG-003 · R-API-002 |
| API-T-073 | `speak_checks_validation_then_config_then_room` | ① 없는 방 + `'meirin'` ② `google`·키 없음 + 없는 방 ③ `fake` + 없는 방 | ① 400 ② 500 `CONFIG_INVALID`(본문에 키 이름 없음) ③ 404 `방을 찾을 수 없습니다.` | R-ENV-003 · R-API-002 |
| API-T-074 | `config_invalid_only_on_generate_paths` | `google`·키 없음에서 `GET /api/rooms` · `POST …/user` · speak · regenerate(마지막 캐릭터 메시지) | 200 · 201 · 500 `CONFIG_INVALID` · 500 `CONFIG_INVALID` | R-ENV-003 |
| API-T-075 | `generate_returns_409_while_locked` | `speaking_until = NOW + 1`인 방에 speak · 그 방 마지막 캐릭터 메시지 regenerate · 그 방 마지막이 아닌 캐릭터 메시지 regenerate / `speaking_until = NOW`(만료 경계) speak | 409 `SPEAK_IN_PROGRESS` ×3(마지막 아님도 `SPEAK_IN_PROGRESS`), 메시지 불변 / 201 | R-MSG-007 · R-NFR-003 |
| API-T-076 | `speak_maps_provider_failures_to_502` | 제공사 HTTP 400 · 차단 응답 · 이름표만 있는 텍스트 | 502 `LLM_FAILED` · 502 `LLM_EMPTY` · 502 `LLM_EMPTY`, message = 기본 문구, 본문에 `gemini`·`google`·HTTP 상태·`blockReason` 없음. 메시지 0건, 방 `updatedAt` 불변, `speaking_until` NULL | R-LLM-004 · R-LLM-005 · R-NFR-004 |
| API-T-077 | `failed_generates_count_toward_rate_limit` | 한도 2. 같은 토큰으로 ① speak 502 ② 잠긴 방 speak 409 ③ 정상 speak | ① 502 ② 409 ③ 429(앞 두 건이 셌다) | R-AUTH-005 · R-NFR-003 |
| API-T-078 | `regenerate_returns_200_and_keeps_meta` | 유저 발화 → 세바스찬(마지막, `created_at` 500). 본문 없음 / 본문 `{"x":1}` / 깨진 JSON 본문 | 전부 200. `id`·`roomId`·`speaker`·`kind`·`authorName`·`createdAt(500)` 그대로, `text` 바뀜, 방 `updatedAt === NOW`, 메시지 수 불변 | R-MSG-006 · R-ROOM-005 |
| API-T-079 | `regenerate_rejects_user_message` | 마지막 유저 `line` · 마지막 유저 `ooc` · 마지막이 아닌 유저 메시지 | 전부 400 `NOT_CHARACTER_MESSAGE`, 기본 문구 | R-MSG-006 |
| API-T-080 | `regenerate_rejects_non_last_character_message` | 세바스찬 → 유저 발화, 세바스찬 id | 409 `NOT_LAST_MESSAGE`, 원문 불변, `speaking_until` NULL | R-MSG-006 |
| API-T-081 | `regenerate_checks_target_then_config` | `google`·키 없음에서 ① 유저 메시지 ② 없는 id ③ 마지막 캐릭터 메시지 | ① 400 `NOT_CHARACTER_MESSAGE` ② 404 ③ 500 `CONFIG_INVALID` | R-MSG-006 · R-ENV-003 |
| API-T-082 | `regenerate_message_id_errors` | id `abc`·`0`·`1.5`·`0x10`·`1e1`·없는 큰 수 | 전부 404 `메시지를 찾을 수 없습니다.` | R-MSG-006 · R-API-004 |
| API-T-083 | `regenerate_failure_keeps_text` | 제공사 HTTP 400 | 502 `LLM_FAILED`, 원문 불변, 방 `updatedAt` 불변, `speaking_until` NULL | R-LLM-005 · R-MSG-007 · R-ROOM-005 |
| API-T-084 | `generate_paths_reject_other_methods` | `GET`·`PUT /api/rooms/:id/speak`, `GET /api/messages/:id/regenerate` | 전부 404 `NOT_FOUND` | R-API-001 |

- (갱신) API-T-050 ~ 053: 쓰기 표에 E9(`{ character: 'sebastian' }`)·E12(시드의 마지막 캐릭터 메시지)를 더해 8개를 돈다. 인증이 먼저라 제공사는 불리지 않는다. 테스트 이름의 "six"는 "all"로 바꾼다.
- 정상 경로 3개(070·071·078)보다 에러 입력이 많다(072만 8건).

### 14.10 S3 shared — `shared/test/*.test.ts`

| 테스트ID | 이름 | 기대 | 요구 |
|---|---|---|---|
| API-T-042(갱신) | `endpoints_build_paths_and_queries` | `PATHS` 값 **9개**. 나머지 기대는 S1·S2 그대로 | R-API-001 · R-API-008 |
| API-T-047 | `endpoints_build_generate_paths` | `PATHS.roomSpeak === '/api/rooms/:id/speak'`, `messageRegenerate === '/api/messages/:id/regenerate'`. `roomSpeak('a b/c')` → `/api/rooms/a%20b%2Fc/speak`, `messageRegenerate(72)` → `/api/messages/72/regenerate` | R-API-001 · R-API-008 |

### 14.11 S3 ui/api — `ui/src/api/api.test.ts` (§14.7 준비 그대로)

| 테스트ID | 이름 | 기대 | 요구 |
|---|---|---|---|
| API-T-UI-019 | `generate_wrappers_send_method_url_body_and_bearer` | getter `'tok'`. `speak('r1', { character: 'ciel' })` POST `/api/rooms/r1/speak` 본문 `{"character":"ciel"}` + `Content-Type: application/json` · `speak('a b', …)` → `/api/rooms/a%20b/speak` · `regenerate(72)` POST `/api/messages/72/regenerate` 본문·`Content-Type` 없음. 모두 `Authorization: Bearer tok`. `speak('r1', { character: 'ciel', extra: 1 } as SpeakBody)` → 본문 `{"character":"ciel"}` | R-MSG-003 · R-MSG-006 · R-API-003 · R-CHAT-005 · R-CHAT-007 |
| API-T-UI-020 | `generate_wrappers_pass_s3_codes_and_never_reject` | 409 `SPEAK_IN_PROGRESS` · 409 `NOT_LAST_MESSAGE` · 400 `NOT_CHARACTER_MESSAGE` · 502 `LLM_FAILED` · 502 `LLM_EMPTY` · 500 `CONFIG_INVALID` 본문 → 같은 `code`·`message`, `isAuthFailure` 6개 모두 false. `fetch` throw → `NETWORK`, 502 HTML → `INTERNAL`. 어느 경우도 reject 없음 | R-API-002 · R-CHAT-011 |
| API-T-UI-021 | `generate_wrappers_set_no_timeout`(단위 + 리뷰 grep) | 두 래퍼의 `fetch` 두 번째 인자에 `signal` 키 없음. `grep -nE "AbortController\|AbortSignal\|setTimeout" ui/src/api --include=*.ts`(테스트 파일 제외) 0건 | R-NFR-001 |

### 14.12 S3b routes — `server/test/routes-generate.test.ts` (API-T-085 ~ 090)

준비:

- §14.9 준비 그대로(`LLM_PROVIDER: 'fake'`, `NOW = 1_700_000_000_000`). `NOW`는 KST `2023-11-15 07:13:20`이라 월 키는 `'2023-11'`이고, `retryAfterSec`는 `2023-12-01 00:00 KST`(= `2023-11-30T15:00:00Z`)까지라 항상 **1356400**이다.
- 예산 초과 상태는 server `helpers.ts`의 `insertUsage('2023-11', 100000)`(db.md §2.4 · 기본 예산 100000)로 만든다. 직전 허용은 `insertUsage('2023-11', 99999.9)`.
- `expectContractError(res, code)` 갱신(두 벌 모두): `RATE_LIMITED`·`LLM_BUDGET_EXCEEDED`만 `error` 키가 정확히 `code`·`message`·`retryAfterSec`이고 `Retry-After` 헤더가 같은 값이다. 값 검사는 코드별(`RATE_LIMITED` → 40, `LLM_BUDGET_EXCEEDED` → 1356400). 나머지 코드는 그대로 두 키다.

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| API-T-085 | `speak_returns_429_budget_exceeded_with_retry_after` | 초과 시드, speak `sebastian` / 직전 시드(99999.9), speak | `expectContractError(res, 'LLM_BUDGET_EXCEEDED')`, message = 요구 원문, `retryAfterSec === 1356400`, `Retry-After: 1356400`, CSP 있음, 본문에 누적액·예산 키 없음. 메시지 0건 추가, 방 `updatedAt` 불변, `speaking_until` NULL, `llm_usage` `calls` 불변(제공사 0회) / 201 | R-LLM-007 · R-API-002 |
| API-T-086 | `speak_budget_gate_order` | 초과 시드에서 ① `'meirin'` ② `google`·키 없음 + 시드 방 ③ 없는 방 ④ `speaking_until = NOW + 1`인 방 | ① 400 `VALIDATION_ERROR` ② 500 `CONFIG_INVALID` ③ 429 `LLM_BUDGET_EXCEEDED`(404 아님) ④ 429 `LLM_BUDGET_EXCEEDED`(409 아님) | R-LLM-007 · R-MSG-007 |
| API-T-087 | `regenerate_budget_gate_order_and_keeps_text` | 초과 시드에서 ① 없는 id ② 유저 메시지 ③ 마지막 캐릭터 메시지 ④ 마지막이 아닌 캐릭터 메시지 ⑤ `google`·키 없음 + 마지막 캐릭터 메시지 | ① 404 ② 400 `NOT_CHARACTER_MESSAGE` ③ 429 `LLM_BUDGET_EXCEEDED`, 원문·방 `updatedAt` 불변, `speaking_until` NULL ④ 429(409 `NOT_LAST_MESSAGE` 아님) ⑤ 500 `CONFIG_INVALID` | R-LLM-007 · R-MSG-006 |
| API-T-088 | `budget_exceeded_only_on_generate_paths` | 초과 시드에서 `GET /api/health` · `GET /api/rooms` · `GET …/messages` · `POST /api/rooms` · `POST …/user` · `PATCH /api/messages/:id` · `DELETE /api/messages/:id` | 200 · 200 · 200 · 201 · 201 · 200 · 204. health 본문 키는 S1과 같다(사용량·예산 키 없음) | R-LLM-007 · R-API-001 |
| API-T-089 | `budget_rejections_count_toward_rate_limit` | `RATE_LIMIT_PER_MIN: '2'`, 초과 시드. 같은 토큰으로 speak 3회 | 429 `LLM_BUDGET_EXCEEDED` · 429 `LLM_BUDGET_EXCEEDED` · 429 `RATE_LIMITED`(`retryAfterSec` 40). 같은 429를 `code`로 구분 | R-NFR-003 · R-AUTH-005 · R-LLM-007 |
| API-T-090 | `budget_uses_current_kst_month_only` | 지난달 행만 `insertUsage('2023-10', 100000)` | speak 201 | R-LLM-007 |

- 정상 경로 2건(085 후반 · 090)보다 에러 입력이 많다(086·087만 9건).
- 월 경계 정각·윤년·12월 넘김은 server SRV-T-210·211·214가 맡는다(라우트에서 시계를 바꾸지 않는다).

### 14.13 S3b shared · ui/api

| 테스트ID | 파일 | 이름 | 기대 | 요구 |
|---|---|---|---|---|
| API-T-040(갱신) | `shared/test/errors.test.ts` | `error_table_matches_contract` | 기대 표에 `LLM_BUDGET_EXCEEDED: 429` 추가, `toHaveLength(14)`, 설명 "계약 14종" | R-API-002 |
| API-T-048 | `shared/test/errors.test.ts` | `errors_include_budget_exceeded` | `ERROR_CODES.indexOf('LLM_BUDGET_EXCEEDED') === ERROR_CODES.indexOf('LLM_EMPTY') + 1`, `ERROR_STATUS` 429, `ERROR_MESSAGES` = 요구 원문, `isErrorCode('LLM_BUDGET_EXCEEDED') === true` | R-API-002 · R-LLM-007 |
| API-T-UI-022 | `ui/src/api/api.test.ts` | `budget_exceeded_passes_code_and_drops_retryAfterSec` | `speak`·`regenerate`에 429 `{ error: { code: 'LLM_BUDGET_EXCEEDED', message, retryAfterSec: 1356400 } }` → `ok: false`, 같은 `code`·`message`, `'retryAfterSec' in error === false`, `isAuthFailure` false, reject 없음. `message`가 빈 문자열이면 `ERROR_MESSAGES.LLM_BUDGET_EXCEEDED` | R-API-002 · R-CHAT-011 · R-LLM-007 |
| API-T-UI-023 | `ui/src/api/api.test.ts` | `two_429_codes_are_distinguished_by_code` | 같은 status 429에 `RATE_LIMITED`+`40` → `retryAfterSec === 40`, `LLM_BUDGET_EXCEEDED`+`40` → 키 없음. 두 `error.code`가 다르다 | R-CHAT-011 · R-AUTH-005 |

### 14.14 S3c routes — `server/test/routes-settings.test.ts` (API-T-091 ~ 103)

준비:

- §14.9 준비 그대로(`NOW = 1_700_000_000_000`, `signTestToken`, env 덮어쓰기 방식). 추가 바인딩 `OWNER_MB_IDS: 'owner01'`(테스트 자리표시자 — 실제 회원 ID 금지).
- 토큰 3종: 주인 `mb_id 'owner01'`·통과 등급, 비주인 `mb_id 'member01'`·통과 등급, 등급 미달 주인 `mb_id 'owner01'`·`TOKEN_MIN_LEVEL - 1`.
- 유효 본문은 `shared/test/settings-vectors.ts`의 `validSettings()`(§14.15)로 만든다. D1 `character_settings`는 server 0003 마이그레이션이 만든다.
- `expectContractError(res, code)`는 S3b 판 그대로 쓴다(`OWNER_ONLY`·`VALIDATION_ERROR`는 `code`·`message` 두 키).

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| API-T-091 | `settings_require_token` | GET·PUT 각각 ① 헤더 없음 ② `Bearer garbage` ③ 헤더 없이 `?t=<주인 토큰>` ④ 헤더 없이 깨진 JSON PUT | ① 401 `TOKEN_REQUIRED` ② 401 `TOKEN_INVALID` ③ 401 `TOKEN_REQUIRED` ④ 401(400 아님) | R-AUTH-003 · R-SET-004 |
| API-T-092 | `settings_level_checked_before_owner` | 등급 미달 주인 토큰으로 GET·PUT | 403 `LEVEL_TOO_LOW`(`OWNER_ONLY` 아님) | R-AUTH-002 · R-SET-001 |
| API-T-093 | `settings_non_owner_gets_owner_only` | ① 비주인 GET·PUT ② `OWNER_MB_IDS: ''`에서 주인 토큰 GET ③ `RATE_LIMIT_PER_MIN: '1'`에서 비주인 PUT 3회 | ① 403 `OWNER_ONLY`, message = 기본 문구, 응답 문자열에 `owner01`·`member01` 없음 ② 403 `OWNER_ONLY` ③ 403 × 3(429 없음), D1 행 없음 | R-SET-001 · R-AUTH-006 · R-AUTH-005 |
| API-T-094 | `settings_get_returns_seed_when_never_saved` | 빈 D1, 주인 GET | 200, 키 정확히 `settings`·`version`·`updatedAt`·`isDefault`, `isDefault true`·`version 0`·`updatedAt null`, `checkCharacterSettings(body.settings).ok`, 캐릭터 키 `sebastian`·`ciel`, 각 11키. 응답 문자열에 `owner01`·`updatedBy`·`mbId`·`outputRules` 없음 | R-SET-004 · R-SET-003 · R-AUTH-006 |
| API-T-095 | `settings_put_replaces_and_normalizes` | 주인 PUT(앞뒤 공백 값, `sampleDialogue: ['  a ', '', '   ']`) → GET → 두 번째 PUT | 200, `settings` = `checkCharacterSettings(input).value`, `version 1`, `updatedAt === NOW`, `isDefault false` / GET이 같은 값 / 두 번째 `version 2` | R-SET-005 · R-SET-003 |
| API-T-096 | `settings_put_rejects_unknown_keys` | ① `sebastian.apiKey` ② `characters.meirin` ③ `settings.outputRules` ④ 봉투에 `extra: 1` + 유효 `settings` | ①~③ 400 `VALIDATION_ERROR`, 문구 = §4.16 표(`세바스찬 · 알 수 없는 항목이 있습니다.` / `공통 · 알 수 없는 캐릭터가 있습니다.` / `공통 · 알 수 없는 항목이 있습니다.`), 문구에 `apiKey` 없음, D1 불변 ④ 200 | R-SET-002 · R-SET-008 |
| API-T-097 | `settings_put_limits_by_code_points` | ① `ciel.speech` 800자 / 801자 ② 이모지 800개(UTF-16 1600) ③ `sebastian.sampleDialogue` 10개 / 11개 ④ `ciel.rules` 항목 200자 / 201자 ⑤ `world` 2000자 / 2001자 | 상한은 200, 상한+1은 400과 문구(`시엘 · 말투는 1~800자여야 합니다.` · `세바스찬 · 샘플 대사는 10개 이하여야 합니다.` · `시엘 · 규칙·금기는 한 줄에 200자 이하여야 합니다.` · `공통 · 세계관은 1~2000자여야 합니다.`) ② 200 | R-SET-002 · R-SET-005 |
| API-T-098 | `settings_put_rejects_empty_required_and_bad_types` | ① `world: '   '` ② `sebastian.persona: ''` ③ `ciel.speech` 키 없음 ④ `ciel.rules: 'a'` ⑤ `characters.ciel` 없음 | 400 각각 `공통 · 세계관은 1~2000자여야 합니다.` · `세바스찬 · 성격·배경은 1~1500자여야 합니다.` · `시엘 · 말투 값의 형식이 올바르지 않습니다.` · `시엘 · 규칙·금기 값의 형식이 올바르지 않습니다.` · `시엘 · 설정 형식이 올바르지 않습니다.` | R-SET-002 |
| API-T-099 | `settings_put_reports_first_violation_only` | `world` 빈 값 + `ciel.speech` 801자 + `ciel.apiKey` | 400, message = `공통 · 세계관은 1~2000자여야 합니다.` 하나. `error` 키 `code`·`message` 둘 | R-SET-005 · R-API-002 |
| API-T-100 | `settings_put_body_over_128kb` | ① 유효 JSON + 공백 패딩으로 131073바이트 ② 131072바이트 이하 유효 본문 ③ `RATE_LIMIT_PER_MIN: '1'`에서 ① 다음 유효 PUT | ① 400 `VALIDATION_ERROR` `공통 · 설정 본문은 128KB 이하여야 합니다.`(413 아님), D1 불변 ② 200 ③ 429 `RATE_LIMITED`(① 이 1회 소모) | R-SET-005 · R-AUTH-005 |
| API-T-101 | `settings_put_malformed_body` | ① 깨진 JSON ② `Content-Type: text/plain` ③ `{}` ④ `{ "settings": null }` | ① 400 기본 문구 ②③④ 400 `공통 · 설정 형식이 올바르지 않습니다.` | R-API-004 · R-SET-005 |
| API-T-102 | `settings_put_rate_limited_get_not` | `RATE_LIMIT_PER_MIN: '2'`: ① 주인 PUT 3회 ② 주인 GET 3회 ③ (새 분 창) PUT · `POST /api/rooms` · PUT | ① 200 · 200 · 429 `RATE_LIMITED`(`retryAfterSec` 40) ② 200 × 3 ③ 200 · 201 · 429(쓰기 공용 한도) | R-AUTH-005 · R-SET-004 · R-SET-005 |
| API-T-103 | `settings_unregistered_routes_404` | 주인 토큰으로 `POST`·`PATCH`·`DELETE /api/settings/characters`, `GET /api/settings`, `GET /api/settings/characters/sebastian` | 404 `NOT_FOUND` | R-API-001 |

- 정상 경로 3건(094·095·097 일부)보다 에러 입력이 많다(091~093·096~101만 30건 이상).
- 저장 직후 speak 프롬프트 반영·행 훼손 시 시드 대체·로그 grep은 server SRV-T가 맡는다(s3c-03 §1.4).

### 14.15 S3c shared — `shared/test/*.test.ts`

| 테스트ID | 파일 | 이름 | 기대 | 요구 |
|---|---|---|---|---|
| API-T-040(갱신) | `errors.test.ts` | `error_table_matches_contract` | 기대 표에 `OWNER_ONLY: 403`, `toHaveLength(15)`, 설명 "계약 15종" | R-API-002 |
| API-T-049 | `errors.test.ts` | `errors_include_owner_only` | `indexOf('OWNER_ONLY') === indexOf('CONFIG_INVALID') + 1`, 바로 다음이 `INTERNAL`, `ERROR_STATUS` 403, 문구 = §3.2, `isErrorCode('OWNER_ONLY')` true | R-API-002 · R-SET-001 |
| API-T-042(갱신) | `endpoints.test.ts` | `endpoints_build_paths_and_queries` | `PATHS` 값 10개 | R-API-001 · R-API-008 |
| API-T-104 | `endpoints.test.ts` | `endpoints_build_settings_path` | `PATHS.characterSettings === '/api/settings/characters'`, `endpoints.characterSettings()` 같은 값 | R-API-001 · R-SET-004 |
| API-T-105 | 신규 `settings.test.ts` | `settings_specs_match_contract` | `CHARACTER_FIELD_KEYS` 11개·중복 없음·`Object.keys(CHARACTER_FIELD_SPECS)`와 같은 순서, 라벨·상한·필수가 s3c-02 §2.1 표와 같음(예외 1건: `WORLD_FIELD_SPEC.label === '세계관'`, §15.12 결정 2. 필수는 `persona`·`speech` + `WORLD_FIELD_SPEC`), `SETTINGS_CHARACTER_IDS`와 `Object.keys(CHARACTERS)` 집합 같음, 상수 4개 값(`'london-dispatch/character-settings'` · 1 · 131072 · 5242880) | R-SET-002 · R-SET-005 · R-SET-007 · R-SET-008 |
| API-T-106 | `settings.test.ts` | `check_accepts_boundaries_and_normalizes` | 벡터 `accept` 전부 `ok`. 값은 trim·목록 빈 항목 제거, 이모지 800개 통과, 입력 객체를 바꾸지 않는다 | R-SET-002 |
| API-T-107 | `settings.test.ts` | `check_rejects_with_contract_messages` | 벡터 `reject` 전부 `ok: false`, `issue.path`·`issue.message`가 §4.16 표와 정확히 같다(13행 전부 + 첫 위반 순서 + 라벨 12개의 은/는) | R-SET-002 · R-SET-005 |

- 벡터 파일 `shared/test/settings-vectors.ts`: `validSettings(): CharacterSettings`와 `SETTINGS_VECTORS: { name; input; expect: { ok: true } | { ok: false; path; message } }[]`. server 스키마 테스트(SRV-T, server-designer 번호)가 같은 파일을 상대 경로로 import해 zod 통과 여부가 `expect.ok`와 같은지 본다(s3c-03 §2.3). workerd 풀에서 import가 막히면 server 쪽 사본을 두고 리뷰로 동일성을 본다.

### 14.16 S3c ui/api — `ui/src/api/api.test.ts` (§14.7 준비 그대로)

| 테스트ID | 이름 | 기대 | 요구 |
|---|---|---|---|
| API-T-UI-024 | `get_character_settings_sends_token_get` | `configureClient({ getToken: () => 'tok' })` → `fetch`가 `GET /api/settings/characters`, `Authorization: Bearer tok`, 본문·`Content-Type` 없음. 200 본문 → `ok: true`, `value` 그대로 | R-SET-004 · R-API-003 |
| API-T-UI-025 | `save_character_settings_sends_put_body` | `PUT` 같은 경로, `Content-Type: application/json`, `JSON.parse(body)` 키 정확히 `['settings']`, `Authorization` 있음. 200 → `value` 그대로 | R-SET-005 · R-API-003 |
| API-T-UI-026 | `owner_only_is_not_auth_failure` | 두 래퍼에 403 `OWNER_ONLY` → `ok: false`, `code`·`message` 그대로, `isAuthFailure(error) === false`. 같은 래퍼에 401 `TOKEN_INVALID` → `isAuthFailure` true(판정만 돌려준다). reject 없음. `message`가 빈 문자열이면 `ERROR_MESSAGES.OWNER_ONLY` | R-SET-010 · R-API-002 |
| API-T-UI-027 | `settings_wrappers_without_token` | getter가 `null` → `Authorization` 없음, 서버 401 `TOKEN_REQUIRED`를 그대로 돌려준다 | R-AUTH-003 · R-API-003 |

리뷰 grep(S3c):

```bash
# 경로 리터럴은 shared/src/endpoints.ts 에만
grep -rn "/api/settings" shared/src server/src ui/src --include=*.ts --include=*.tsx | grep -v "shared/src/endpoints.ts"
# 화면 코드의 fetch 0건, 토큰 저장 0건(§14.8 그대로)
# AUTH_FAILURE_CODES 에 OWNER_ONLY 없음
grep -n "OWNER_ONLY" ui/src/api/client.ts
```

- 첫 grep과 셋째 grep은 결과가 0줄이어야 한다.

### 14.17 S3d routes — `server/test/routes-write.test.ts` · `routes-generate.test.ts` (API-T-062 갱신 · 108 ~ 111)

준비: §14.9 준비 그대로(`LLM_PROVIDER: 'fake'`, `NOW = 1_700_000_000_000`, `RATE_LIMIT_PER_MIN` 기본). 기대 상수는 `@shared/characters`의 `USER_DISPLAY_NAME`을 import하고, 실명 기대값만 리터럴로 쓴다.

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| API-T-062(갱신) | (기존 이름 유지) | E8을 `ch_name: '시엘 팬텀하이브'` 토큰 / `ch_name: null`·`nick: '테스터'` 토큰으로 | 두 응답 `authorName === USER_DISPLAY_NAME`. D1 직접 SELECT `author_name`은 `'시엘 팬텀하이브'` / `'테스터'`. 응답 본문 문자열에 실명 0회 | R-AUTH-004 |
| API-T-108 | `user_author_name_is_projected_everywhere` | D1에 `author_name = '시드 유저'`인 유저 행(line·ooc 각 1)을 직접 넣은 방에 `GET …/messages` · 그 행에 `PATCH /api/messages/:id` | 유저 행 `authorName === USER_DISPLAY_NAME`, 캐릭터 행 `null`. 응답 본문에 `'시드 유저'` 0회. PATCH 응답도 같고 D1 `author_name`은 그대로 | R-AUTH-004 · R-CHAT-002 |
| API-T-109 | `speak_auto_returns_201_with_character_speaker` | `{ character: 'auto' }` | `201`, `speaker`는 `'sebastian'`·`'ciel'` 중 하나, `kind 'line'`, `authorName null`, 응답 JSON 문자열에 `"auto"` 0회. D1 새 행의 `speaker`가 응답과 같고 메시지 1건 증가 | R-MSG-009 · R-MSG-003 |
| API-T-110 | `speak_rejects_invalid_targets` | `'Auto'` · `'AUTO'` · `' auto'` · `''` · `null` · `true` · `character` 없음 | 모두 `400 VALIDATION_ERROR` 기본 문구, 저장 0건. 같은 표에서 `'sebastian'`·`'ciel'`·`'auto'`는 `201` | R-MSG-003 · R-API-002 |
| API-T-111 | `speak_auto_shares_lock_budget_rate_limit` | ① `speaking_until = NOW + 1` 방에 `'auto'` ② 예산 초과 시드(§14.12)에서 `'auto'` ③ `RATE_LIMIT_PER_MIN: '2'`로 E8 1회 → E9 `'auto'` 1회 → E9 `'auto'` 1회 | ① `409 SPEAK_IN_PROGRESS` ② `429 LLM_BUDGET_EXCEEDED`, `llm_usage.calls` 불변(선택 호출도 0회) ③ `201` · `201` · `429 RATE_LIMITED`(`retryAfterSec` 40) | R-MSG-009 · R-MSG-007 · R-LLM-007 · R-AUTH-005 |

- `'auto'` 201이 fake 제공사에서 결정적이어야 한다. 선택 응답을 파싱하지 못해도 기본 화자로 끝나므로 각본 없이도 `201`이다. **어느 캐릭터가 골라지는지는 이 표가 보지 않는다**(server `llm-select.test.ts` 몫).
- 정상 2건(109 · 110 후반)보다 에러 입력이 많다(110 7건 · 111 3건).

### 14.18 S3d shared · ui/api

| 테스트ID | 파일 | 이름 | 기대 | 요구 |
|---|---|---|---|---|
| API-T-112 | `shared/test/characters.test.ts`(없으면 신규) | `user_display_name_is_fixed_constant` | `USER_DISPLAY_NAME === '어떠한 의지'`, `CHARACTERS`의 `name`·`shortName` 어느 것과도 다르다 | R-AUTH-004 · R-CHAT-002 |
| API-T-UI-028 | `ui/src/api/api.test.ts` | `speak_auto_sends_auto_body` | `speak('r1', { character: 'auto' })` → `POST /api/rooms/r1/speak`, 본문 정확히 `{"character":"auto"}`, `Authorization: Bearer` 있음. 201 `speaker: 'ciel'` 응답 → `ok: true`, `value.speaker === 'ciel'` | R-MSG-009 · R-CHAT-014 |
| API-T-UI-029 | `ui/src/api/api.test.ts` | `author_name_passes_through_unchanged` | `listMessages`·`appendUser` 응답의 `authorName: '어떠한 의지'`·`null`이 값 그대로 나온다(래퍼가 치환하지 않는다) | R-CHAT-002 |

- 타입 확인: `SpeakBody`에 `'auto'` 대입이 컴파일되고 `'Auto'` 대입은 `tsc` 오류다(`// @ts-expect-error` 한 줄, API-T-UI-028 안).


### 14.19 S4 routes — `server/test/routes-memory.test.ts`(신규, API-T-113 ~ 122) · `routes-generate.test.ts`(API-T-123 · 도우미 갱신)

준비:

- §14.9 준비 그대로(`NOW = 1_700_000_000_000`, `signTestToken`, env 덮어쓰기 방식, `LLM_PROVIDER: 'fake'`). 토큰 2종: 통과 등급 `mb_id 'writer_a'`, 등급 미달 `TOKEN_MIN_LEVEL - 1`. 주인 바인딩은 넣지 않는다(주인 판정이 없음을 보인다).
- 방·`memory` 행은 D1에 직접 INSERT한다(`memory` 테이블은 0001에 있고 S4 마이그레이션은 없다).
- `expectContractError(res, code)`는 S3b 판 그대로 쓴다(`RATE_LIMITED`만 3키, `NOT_FOUND`·`VALIDATION_ERROR`는 `code`·`message` 두 키).
- 요청 도우미는 `createExecutionContext()`로 만든 `ctx`를 `waitOnExecutionContext(ctx)`로 기다린 뒤 응답을 돌려준다(아래 도우미 갱신과 같은 모양).

| 테스트ID | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|
| API-T-113 | `memory_require_token` | GET·PUT 각각 ① 헤더 없음 ② `Bearer garbage` ③ 헤더 없이 `?t=<유효 토큰>` ④ 등급 미달 토큰 ⑤ 헤더 없이 깨진 JSON PUT | ① 401 `TOKEN_REQUIRED` ② 401 `TOKEN_INVALID` ③ 401 `TOKEN_REQUIRED` ④ 403 `LEVEL_TOO_LOW` ⑤ 401(400 아님). `memory` 행 불변 | R-MEM-001 · R-AUTH-003 |
| API-T-114 | `memory_get_default_without_row` | 방 있음·`memory` 행 없음, 일반 회원 토큰(`OWNER_MB_IDS` 비어 있음) | 200, 키 정확히 `summary`·`sourceUntilId`·`updatedAt`, 값 `''`·`0`·`null`. `memory` 행이 생기지 않는다 | R-MEM-001 · R-API-004 |
| API-T-115 | `memory_get_returns_row` | `memory(room, '지난 요약\n둘째 줄', 21, NOW - 1000)` | 200 `{ summary: '지난 요약\n둘째 줄', sourceUntilId: 21, updatedAt: NOW - 1000 }`. 응답 문자열에 `writer_a`·`roomId` 없음 | R-MEM-001 · R-API-004 |
| API-T-116 | `memory_404_for_missing_room` | ① 없는 방 GET ② 없는 방 PUT `{ summary: 'a' }` ③ 방 삭제(E6) 뒤 GET ④ 없는 방 PUT 4001자 | ①②③ 404 `NOT_FOUND` `방을 찾을 수 없습니다.`, `memory` 행 0 ④ 400 `장기기억은 0~4000자로 입력해 주세요.`(길이가 방 존재보다 먼저) | R-MEM-001 |
| API-T-117 | `memory_put_replaces_and_keeps_source` | ① 행(`'old'`, 7)이 있는 방에 PUT `{ summary: '  새 요약\n둘째 줄  ' }` → GET ② 행 없는 방에 PUT `{ summary: 'a' }` ③ 두 경우 방 `updated_at`과 `GET /api/rooms` 순서를 전후 비교 | ① 200 `{ summary: '새 요약\n둘째 줄', sourceUntilId: 7, updatedAt: NOW }`, GET이 같은 값, D1 `source_until_id` 7 ② 200 `sourceUntilId: 0`, 행 생성 ③ 방 `updated_at` 불변, 목록 순서 불변 | R-MEM-001 |
| API-T-118 | `memory_put_length_by_code_points` | `''` · `'   '` · `'a'`×4000 · 이모지×4000(UTF-16 8000) · `'  '` + `'a'`×4000 + `'  '` · `'a'`×4001 · 이모지×4001 | 앞 다섯은 200(저장값 `''`·`''`·그대로·그대로·`'a'`×4000) / 뒤 둘은 400 `장기기억은 0~4000자로 입력해 주세요.`, D1 불변 | R-MEM-001 |
| API-T-119 | `memory_put_rejects_bad_body` | ① `{ summary: 1 }` ② `{ summary: null }` ③ `{}` ④ `[]` ⑤ 깨진 JSON ⑥ `Content-Type: text/plain` ⑦ `{ summary: 'x', extra: 1 }` | ①~⑥ 400 `VALIDATION_ERROR` `요청 형식이 올바르지 않습니다.`, D1 불변 ⑦ 200(모르는 키는 버림), 응답에 `extra` 없음 | R-API-004 · R-MEM-001 |
| API-T-120 | `memory_put_body_over_32kib` | ① 유효 JSON + 공백 패딩으로 32769바이트 ② 공백 패딩으로 정확히 32768바이트인 유효 본문 ③ `'\u0001'`×4000(`JSON.stringify` 24014바이트) ④ `RATE_LIMIT_PER_MIN: '1'`에서 ① 다음 유효 PUT | ① 400 기본 문구(413 아님), D1 불변 ② 200 ③ 200(4000 코드 포인트) ④ 429 `RATE_LIMITED`(①이 1회 소모) | R-MEM-001 · R-AUTH-005 |
| API-T-121 | `memory_put_rate_limited_get_not` | `RATE_LIMIT_PER_MIN: '2'`: ① PUT 3회 ② 같은 창에서 GET 3회 ③ (새 분 창) PUT · `POST /api/rooms` · PUT ④ (새 분 창) 무토큰 PUT 3회 뒤 유효 PUT 2회 | ① 200 · 200 · 429 `RATE_LIMITED`(`retryAfterSec` 40) ② 200 × 3 ③ 200 · 201 · 429(쓰기 공용 한도) ④ 401 × 3 뒤 200 · 200(인증 실패는 세지 않는다) | R-AUTH-005 · R-NFR-003 · R-MEM-001 |
| API-T-122 | `memory_unregistered_methods_404` | 유효 토큰으로 `POST`·`PATCH`·`DELETE /api/rooms/:id/memory`, `GET /api/rooms/:id/memory/x` | 404 `NOT_FOUND` | R-API-001 |
| API-T-123 | `speak_ok_even_if_summary_fails`(`routes-generate.test.ts`) | env `CONTEXT_MESSAGES: '1'`·`MEMORY_SUMMARY_THRESHOLD: '2'`, 메시지 2개인 방에 `{ character: 'ciel' }`. ① `LLM_PROVIDER: 'fake'` ② §14.9의 google + 가짜 키 + 전역 `fetch` 대체: 1번째 호출(생성)은 정상 200 응답, 2번째(요약)부터 HTTP 400 | 두 경우 모두 `201`·같은 응답 형태(`speaker 'ciel'`·`kind 'line'`·`authorName null`)이고 응답 본문에 요약 관련 키가 없다. `waitOnExecutionContext` 뒤 ① E13 GET `sourceUntilId` = 방의 2번째 메시지 id, `summary` 비어 있지 않음 ② E13 GET `{ summary: '', sourceUntilId: 0, updatedAt: null }`(요약 실패 — 행 없음), 방 메시지 3개 | R-MEM-002 · R-NFR-001 |
| API-T-125 | `memory_put_empty_resets_source`(`routes-memory.test.ts`, v0.7.1) | ① 행(`'old'`, 21)이 있는 방에 PUT `{ summary: '' }` → GET ② 같은 행 상태에서 PUT `{ summary: '   ' }` ③ 같은 행 상태에서 PUT `{ summary: 'a' }` | ① 200 `{ summary: '', sourceUntilId: 0, updatedAt: NOW }`, GET이 같은 값, D1 `source_until_id` 0 ② ①과 같다 ③ 200 `sourceUntilId: 21` 유지(대조) | R-MEM-001 |

- 정상 경로(114·115·117·118 앞부분·123)보다 에러 입력이 많다(113 10건 · 116 · 118 뒤 2건 · 119 6건 · 120 · 121 · 122).
- API-T-123은 R-MEM-002 검증 방법 "실패 주입 시 응답 성공 확인"의 계약 쪽이다. 요약 판정·구간·동시성 자체는 server SRV-T-296 ~ 315·327이 본다.

도우미 갱신(`routes-generate.test.ts`의 `call`):

```ts
  const ctx = createExecutionContext()
  const res = await app.fetch(new Request(`http://test${path}`, init), opts.e ?? baseEnv(), ctx)
  await waitOnExecutionContext(ctx) // S4: speak 성공이 waitUntil 로 자동 요약을 등록한다
  return res
```

- 이유: S4부터 speak 성공이 백그라운드 작업을 등록한다. 기다리지 않으면 그 작업이 다음 테스트의 `resetDb`와 겹쳐 D1 상태가 섞인다(memory.md 「contract 인계」 speak 절).
- 기존 speak 성공 테스트의 방이 메시지 60개(기본 기준) 이하면 요약은 LLM을 부르지 않으므로 `fake` 호출 수·`llm_usage` 단언이 그대로다. contract-implementer는 `/speak`를 부르는 테스트 파일을 grep으로 모두 찾아 같은 대기를 넣고, 61개 이상을 만드는 테스트가 있으면 호출 수 단언을 다시 본다.

### 14.20 S4 shared · ui/api — `shared/test/endpoints.test.ts` · `ui/src/api/memory.test.ts`(신규, §14.7 준비 그대로)

| 테스트ID | 파일 | 이름 | 기대 | 요구 |
|---|---|---|---|---|
| API-T-042(갱신) | `shared/test/endpoints.test.ts` | (기존 이름 유지) | `PATHS` 값 11개, `roomMemory: '/api/rooms/:id/memory'` 포함 | R-API-001 · R-API-008 |
| API-T-124 | `shared/test/endpoints.test.ts` | `room_memory_builder_encodes_id` | `endpoints.roomMemory('r1') === '/api/rooms/r1/memory'`, `endpoints.roomMemory('a b/c') === '/api/rooms/a%20b%2Fc/memory'` | R-MEM-001 · R-API-008 |
| API-T-UI-030 | `ui/src/api/memory.test.ts` | `get_memory_sends_bearer` | `configureClient({ getToken: () => 'tok' })` 뒤 `getMemory('r 1')` → `GET /api/rooms/r%201/memory`, `Authorization: Bearer tok`, 본문·`Content-Type` 없음. 200 응답 → `ok: true`, `value`가 응답과 같다(`updatedAt: null` 포함) | R-MEM-001 · R-API-003 |
| API-T-UI-031 | `ui/src/api/memory.test.ts` | `put_memory_sends_summary_only` | `putMemory('r1', { summary: '  a  ', extra: 1 } as PutMemoryBody)` → `PUT /api/rooms/r1/memory`, 본문 정확히 `{"summary":"  a  "}`(trim하지 않는다, `extra` 없음), `Authorization` 있음, `Content-Type: application/json`. 200 `{ summary: 'a', sourceUntilId: 7, updatedAt: 1 }` → `value` 그대로. `putMemory('r1', { summary: 1 })`는 `// @ts-expect-error` | R-MEM-001 · R-CHAT-012 |
| API-T-UI-032 | `ui/src/api/memory.test.ts` | `memory_errors_normalized` | ① GET 401 `TOKEN_INVALID` → `ok: false`, `isAuthFailure` true ② PUT 400 `장기기억은 0~4000자로 입력해 주세요.` → `error.message` 그대로 ③ PUT 429 `RATE_LIMITED` `retryAfterSec: 40` → `error.retryAfterSec === 40` ④ 404 `NOT_FOUND` ⑤ `fetch` reject → `NETWORK`. 어느 경우도 throw·reject 없음 | R-API-002 · R-CHAT-012 |

- `errors.test.ts` API-T-040(15종)은 무수정 통과해야 한다.

### 14.21 S3f — `server/test/routes-settings.test.ts`(API-T-094 갱신 · 126 ~ 130) · `shared/test/settings.test.ts`(API-T-131) · `ui/src/api/settings.test.ts`(API-T-UI-033 · 034)

준비:

- §14.14 준비 그대로. env `LLM_MODEL`은 S3f 기본값(Pro 모델명)을 쓴다. 다른 판은 env 덮어쓰기로 만든다 — Flash 판 `LLM_MODEL: LLM_MODEL_OPTIONS.flash.model`(server `llm/models.ts` import, 모델명을 테스트에 다시 쓰지 않는다) · 후보 밖 판 `LLM_MODEL: 'gemini-2.5-flash'`(env 형식은 통과하고 두 후보와 다른 이름. GET·PUT만 부르므로 제공사 호출 없음).
- 유효 본문은 `validSettings()`(§14.15). D1 `llm_model` 칸은 server 0004 마이그레이션이 만든다. 저장값 기대는 `SELECT llm_model FROM character_settings`로 직접 본다.
- `expectContractError`는 그대로(`VALIDATION_ERROR`는 `code`·`message` 두 키).

| 테스트ID | 파일 | 이름 | 입력 | 기대 | 요구 |
|---|---|---|---|---|---|
| API-T-094(갱신) | routes-settings | (기존 이름 유지) | 빈 D1, 주인 GET | 키 정확히 `isDefault`·`model`·`settings`·`updatedAt`·`version`(정렬 비교), `model: 'pro'`. 나머지 기대는 그대로 | R-SET-004 |
| API-T-126 | routes-settings | `settings_get_model_is_effective_key` | 빈 D1에서 ① 기본 env ② Flash 판 env ③ 후보 밖 판 env로 GET ④ ③ 앱에서 `{ settings, model: 'pro' }` PUT 뒤 GET | ① `'pro'` ② `'flash'` ③ `null`(`isDefault true`·`version 0` 그대로) ④ `'pro'`. 네 응답 문자열 어디에도 `LLM_MODEL_OPTIONS.pro.model`·`LLM_MODEL_OPTIONS.flash.model`·`gemini-2.5-flash`가 없다 | R-SET-004 · R-LLM-009 |
| API-T-127 | routes-settings | `settings_put_saves_model` | 빈 D1 → `{ settings, model: 'flash' }` PUT → GET → `{ settings, model: 'pro' }` PUT | 200 `model: 'flash'`·`version 1`·`isDefault false`(시드에서 모델만 바꿔도 행이 생긴다) / GET `'flash'` / 200 `model: 'pro'`·`version 2`. D1 `llm_model` `'flash'` → `'pro'` | R-SET-005 · R-SET-013 |
| API-T-128 | routes-settings | `settings_put_without_model_keeps_saved` | ① `flash` 저장 뒤 `{ settings }` PUT(키 없음) ② 새 빈 D1에서 `{ settings }` PUT | ① 200 `model: 'flash'`, `version` +1, D1 `llm_model` `'flash'` 그대로 ② 200 `model: 'pro'`(env 키), D1 `llm_model IS NULL` | R-SET-005 |
| API-T-129 | routes-settings | `settings_put_rejects_invalid_model` | `flash` 저장 뒤 본문은 유효하고 `model`만 ① `'turbo'` ② `null` ③ `''` ④ `'Pro'` ⑤ `1` ⑥ `['pro']` ⑦ `RATE_LIMIT_PER_MIN: '1'` 앱에서 ① 다음 유효 PUT | ①~⑥ 400 `VALIDATION_ERROR`, message = `SETTINGS_MODEL_INVALID_MESSAGE`(`공통 · AI 모델 값이 올바르지 않습니다.`), 응답 문자열에 `turbo` 없음, 이어서 GET `model 'flash'`·`version` 불변 ⑦ 429 `RATE_LIMITED`(모델 400도 1회 소모) | R-SET-005 · R-AUTH-005 |
| API-T-130 | routes-settings | `settings_violation_reported_before_model` | ① `world: '   '` + `model: 'turbo'` ② `settings` 안에 `model: 'pro'`(봉투 `model` 없음) ③ 유효 `settings` + `model: 'turbo'` + 봉투 `extra: 1` | ① 400 `공통 · 세계관은 1~2000자여야 합니다.`(모델 문구 아님) ② 400 `공통 · 알 수 없는 항목이 있습니다.`(모델은 본체에 들어가지 못한다) ③ 400 모델 문구(`extra`는 버려지고 판정에 영향 없음). 모두 D1 불변 | R-SET-005 · R-SET-002 · R-SET-007 |
| API-T-131 | `shared/test/settings.test.ts` | `llm_model_keys_match_contract` | — | `LLM_MODEL_KEYS`가 `['pro', 'flash']`와 순서까지 같다. `SETTINGS_MODEL_INVALID_MESSAGE === '공통 · AI 모델 값이 올바르지 않습니다.'`이고 `SETTINGS_COMMON_SCOPE + ' · '`로 시작한다. `checkCharacterSettings({ ...validSettings(), model: 'pro' })` → `ok: false`·path `[]`·`공통 · 알 수 없는 항목이 있습니다.`. 타입: `const k: LlmModelKey = 'flash'` 통과, `'turbo'` 대입은 `// @ts-expect-error` | R-SET-013 · R-LLM-009 · R-SET-005 |
| API-T-UI-025(무수정) | `ui/src/api/settings.test.ts` | (기존) | `saveCharacterSettings(settings)` | 본문 키 정확히 `['settings']` — "model 없음" 판의 증거. 응답 픽스처에만 `model` 추가 | R-SET-005 |
| API-T-UI-033 | `ui/src/api/settings.test.ts` | `save_character_settings_sends_model` | `saveCharacterSettings(settings, 'flash')` | `PUT /api/settings/characters`, `JSON.parse(body)` 키 정확히 `['settings', 'model']`, `model === 'flash'`, `Authorization` 있음. 200 `{ …, model: 'flash' }` → `value.model === 'flash'`. `saveCharacterSettings(settings, null)`은 `// @ts-expect-error` | R-SET-005 · R-SET-013 |
| API-T-UI-034 | `ui/src/api/settings.test.ts` | `settings_model_passthrough` | ① `saveCharacterSettings(settings, undefined)` ② GET 200 `model: null` ③ PUT 400 `VALIDATION_ERROR` 모델 문구 | ① 본문 문자열에 `"model"` 없음·키 `['settings']` ② `value.model === null`(정규화·기본값 채우기 없음) ③ `ok: false`, `error.message` 그대로, `isAuthFailure` false. throw·reject 없음 | R-SET-004 · R-SET-005 |

- 정상 경로(094·126·127·128·UI-033)보다 에러 입력이 많다(129·130·UI-034만 12건).
- 모델 적용 시점(저장 뒤 다음 speak URL·단가·요약·자동 전환 금지)과 로그 `settings_saved`의 `model` 키는 server SRV-T가 맡는다(s3f-03 §1.4).
- API-T-040(15종)·042(`PATHS` 11)·091~093·095~103·105~107·API-T-UI-024·026·027은 응답 기대·픽스처에 `model`을 더하는 것 외에는 무수정 통과해야 한다.
- 리뷰 grep: `grep -rn "gemini-" shared/src ui/src --include=*.ts --include=*.tsx` 0건(모델명은 server만).

### 14.22 S6 — `server/test/routes-room-lock.test.ts`(신규, API-T-140 ~ 163) · shared(API-T-040 · 042 갱신 · 164) · `ui/src/api/room-lock.test.ts`(신규, API-T-UI-035 ~ 040)

준비: 기존 routes 테스트 도우미(`signTestToken`, 테스트 `TOKEN_SECRET`, 격리 D1, FakeProvider)를 쓴다. 주인 토큰은 테스트 바인딩 `OWNER_MB_IDS`에 든 `mb_id`로 만든다. 잠긴 방은 E4(비밀번호 포함)나 E18로 만들어 응답의 `entryKey`를 쓴다(증명을 테스트에서 직접 계산하지 않는다 — 형식은 불투명). 분 창 기준 `NOW`는 기존 상수(§6.1 예시 `retryAfterSec` 40).

| ID | 요청 | 기대 |
|---|---|---|
| API-T-140 | E3 — 안 잠긴 방·잠긴 방 | 각 행 키 집합 6(`id`·`title`·`createdAt`·`updatedAt`·`messageCount`·`locked`) · `locked` 참/거짓 · 응답 문자열에 `pbkdf2-sha256$`·`e1.` 0건 |
| API-T-141 | E4 `{ title }` | `201` · `locked: false` · `entryKey: null` |
| API-T-142 | E4 `{ title, password: '1234' }`(4자) · 이모지 4개 | `201` · `locked: true` · `entryKey` `e1.`로 시작 46자 → 그 값으로 E7 `200` |
| API-T-143 | E4 제목 61자 + 비밀번호 3자 · 비밀번호 `''`·3자·33자 · `password: 123`·`null` | 제목 문구 먼저 · `비밀번호는 4~32자로 입력해 주세요.` · 기본 문구 `400`. 모두 `rooms` 행 수 불변 |
| API-T-144 | E17 없는 방 | `404 NOT_FOUND` |
| API-T-145 | E17 안 잠긴 방(본문 `{}`·비밀번호 포함 둘 다) | `200 { entryKey: null }` |
| API-T-146 | E17 잠긴 방 + 주인 토큰 · 본문 `{}` / 틀린 비밀번호 | 둘 다 `200 { entryKey }`(유효 증명) · `rate_limits` `enter:` 행 불변 |
| API-T-147 | E17 잠긴 방 · 토큰 없음 · 본문 `{}` | `403 ROOM_LOCKED` · `enter:` 계수 불변 |
| API-T-148 | E17 잠긴 방 틀린 비밀번호 5회 → 6번째(맞는 비밀번호) → 다음 분 창 | 1~5 `403 ROOM_PASSWORD_WRONG` · 6번째 `429 RATE_LIMITED` 상황 문구 + `retryAfterSec` 40 + `Retry-After` · 다음 창 맞는 비밀번호 `200` |
| API-T-149 | E17 틀린 비밀번호 | `403 ROOM_PASSWORD_WRONG` 기본 문구 |
| API-T-150 | E17 맞는 비밀번호 | `200 { entryKey }` → `X-Room-Key`로 E7 `200` |
| API-T-151 | E17 잘못된 토큰 헤더(위조 V5 · 만료 V8 · 등급 미달 V3 · `Basic x`) + 본문 `{}` / + 맞는 비밀번호 | `401`·`403 LEVEL_TOO_LOW` 없음 → 익명 처리(`403 ROOM_LOCKED` / `200`) |
| API-T-152 | E17 `password` 65자 · `null` · 본문 1025바이트 · 없는 방 + 65자 | `400 VALIDATION_ERROR` 기본 문구(없는 방이어도 `400`) |
| API-T-153 | E18 안 잠긴 방 `{ password: 'abcd' }` | `200` · `room.locked: true` · `room.updatedAt` 불변 · `entryKey`로 E7 `200` |
| API-T-154 | E18 비밀번호 변경 · 같은 비밀번호로 재설정 | 옛 증명 → E7 `403 ROOM_LOCKED` · 새 증명 `200` (두 경우 모두) |
| API-T-155 | E18 잠긴 방 — 비주인 증명 없음 / 비주인 증명 있음 / 주인 증명 없음 | `403 ROOM_LOCKED` / `200` / `200` |
| API-T-156 | E18 3자·33자 · `password` 없음 · 없는 방 · 토큰 없음 + 잠긴 방 | `400` 문구 · `400` 기본 · `404` · `401 TOKEN_REQUIRED`(관문보다 먼저) |
| API-T-157 | E19 잠긴 방(증명) → 다시 E19 → E18 재설정 | `200 locked: false`(본문 있음) · 멱등 `200` · 해제 전 증명 → `403` |
| API-T-158 | E19 잠긴 방 증명 없음 비주인 · 없는 방 | `403 ROOM_LOCKED` · `404` |
| API-T-159 | **관문 전수** E5·E6·E8·E9·E10·E11·E12·E13·E14 — 잠긴 방 + 증명 없음(쓰기 등급 토큰) / 증명 있음 / 주인 토큰 증명 없음 | 각각 `403 ROOM_LOCKED` / 기존 성공 status(E6 `204` 등) / 기존 성공 status |
| API-T-160 | E7 잠긴 방 — 주인 토큰만 · 증명 · 아무것도 없음 | `403` · `200` · `403` |
| API-T-161 | 순서 — 잠긴 방 E7 `?limit=0` · E8 깨진 JSON(증명 없음) · 토큰 없는 E8 · 잠긴 방 E8 `403` 뒤 회원 쓰기 계수 | `403`(400 아님) · `403` · `401` · 계수 +1 |
| API-T-162 | 증명 무효 형태 — 다른 방 증명 · 129자 · `e1.` 한 글자 변조 · 쿼리 `?k=<유효 증명>`만 | 모두 `403 ROOM_LOCKED`(`400` 아님) |
| API-T-163 | 안 잠긴 방 + 쓰레기 `X-Room-Key` · 메시지 경로 없는 id(`999999`·`abc`) | 기존 결과 그대로 · `404 NOT_FOUND` |
| API-T-040 (갱신) | shared `ERROR_CODES` | 길이 17 · 두 코드 status 403 · 기본 문구 |
| API-T-042 (갱신) | shared `PATHS` · `endpoints` | 값 13 · `endpoints.roomEnter('a b')` → `/api/rooms/a%20b/enter` · `roomPassword` 같음 |
| API-T-164 | shared `limits.ts` · `ROOM_KEY_HEADER` | 4 · 32 · 64 · 128 · `'X-Room-Key'` |

ui/api(§14.7 준비 + `configureClient({ getToken, getRoomKey })`):

| ID | 기대 |
|---|---|
| API-T-UI-035 | `roomId` 있는 요청 + getter 값 → `X-Room-Key` 헤더 · getter `null`·`''` → 헤더 없음 · `getRoomKey` 미주입 → 헤더 없음 · `roomId` 없는 요청(`listRooms`·`createRoom`·`enterRoom`) → getter 호출 0회 |
| API-T-UI-036 | `listMessages`·`appendUser`·`speak`·`renameRoom`·`deleteRoom`·`getMemory`·`putMemory` → 헤더 · `editMessage(41, body, 'r1')`·`deleteMessage(41, 'r1')`·`regenerate(72, 'r1')` → URL은 메시지 id, getter 인자 `'r1'`, 헤더 있음 · `listMessages`에는 `Authorization` 여전히 없음 |
| API-T-UI-037 | `enterRoom('r1')` → `POST /api/rooms/r1/enter` 본문 `{}` · `enterRoom('r1', 'pw')` → `{"password":"pw"}` · 토큰 있으면 `Bearer`, 없으면 없음 · `X-Room-Key` 없음 · `200 { entryKey }` → `ok` |
| API-T-UI-038 | `setRoomPassword` `PUT` 본문·`Bearer`·`X-Room-Key` · `clearRoomPassword` `DELETE` `200` JSON → `{ ok: true, value: RoomSummary }`(204 분기 아님) |
| API-T-UI-039 | `ROOM_LOCKED`·`ROOM_PASSWORD_WRONG` 응답 → `Result.error` 그대로 · `isAuthFailure` `false` · E17 `429 RATE_LIMITED` → `retryAfterSec` 실림 |
| API-T-UI-040 | 요청 URL·쿼리·본문에 증명 문자열 0건(`e1.` 검색) · 래퍼가 `console`에 증명·비밀번호를 찍지 않음 |

리뷰 grep: `grep -rn "X-Room-Key" server/src ui/src --include=*.ts` → 0건(리터럴은 `shared/src/endpoints.ts`에만) · `grep -rn "roomKey\|entryKey" ui/src/api` 결과에 저장소 접근(`localStorage`) 0건 · `AUTH_FAILURE_CODES` 3코드 불변(diff).

---

## 15. server 의존 · 변경 요청 · 확인 필요

### 15.1 사용하는 server 함수·타입 (모두 server 설계에 있음)

| 사용처 | server 쪽 | 출처 |
|---|---|---|
| `health.ts` | `Services.getHealth(): HealthStatus` | index.md §2.3 |
| `rooms.ts` | `RoomsService.listRooms(): Promise<RoomSummary[]>` | rooms.md §2.1 |
| `messages.ts` | `MessagesService.listMessages(roomId: string, query: MessagePageQuery): Promise<MessagePage>` | messages.md §2.1 |
| `validate.ts` | `AppError(code: ErrorCode, status: AppErrorStatus, message: string)` | index.md §2.4 |
| 모든 라우트 | `type AppEnv`(`Variables.services`) | index.md §2.3 |
| 테스트 | `createApp({ routes, logSink?, now? })` | index.md §2.2 |

- env 바인딩·설정 추가: **없음**(`ALLOWED_FRAME_ANCESTORS`·`DB`·`ASSETS`는 이미 R-ENV-002에 있다).

### 15.2 server 설계 변경 요청 (막는 것 없음 — 권고 3건)

| # | 대상 | 요청 | 이유 |
|---|---|---|---|
| R1 | db.md §2.1 · messages.md §2.1 · index.md §2.3 | 계약 타입을 server에서 다시 정의하지 말고 `@shared/types`에서 import해 재노출한다. 대상: `Speaker`·`MessageKind`·`RoomSummary`·`Message`(db), `MessagePage`→`MessagesPage`·`MessagePageQuery`→`MessagesQuery`(messages), `HealthStatus`→`HealthResponse`(services). 서버 내부 이름을 유지하려면 `export type MessagePage = MessagesPage`처럼 별칭으로 둔다 | 지금도 구조가 같아 tsc는 통과한다. 하지만 같은 모양을 두 곳에서 정의하면 한쪽만 바뀔 여지가 남는다. 라우트의 대입 검사(§5.6)가 안전망이다 |
| R2 | index.md §2.4 `AppError` | status 인자를 받지 않고 `ERROR_STATUS[code]`로 정하거나, 최소한 server 테스트에서 `status === ERROR_STATUS[code]`를 검사한다. `AppErrorStatus`는 shared `ErrorStatus`로 대체할 수 있다 | §3.1 "코드 1개 = status 1개". 지금 시그니처는 다른 status를 넣을 수 있다 |
| R3 | index.md §5.1 · env.md §5 | `CONFIG_INVALID`·`INTERNAL`·`VALIDATION_ERROR`(HTTPException 400) 응답 문구를 `ERROR_MESSAGES`에서 가져온다 | 문구가 이미 같으니 상수로 묶으면 단일 소스가 된다. `notFound` 문구(`요청한 주소를 찾을 수 없습니다.`)는 상황 문구라 그대로 둔다 |

### 15.3 스킬·에이전트 문구와 다른 결정 (요구가 우선, 메인 세션이 문구 갱신 필요)

| 문서 | 옛 문구 | 이 계약(근거) |
|---|---|---|
| contract-design-strategy §3 · §7 | 페이지 `{ items, nextBefore }`, 기본 40 | `{ messages, hasMore }`, 기본 30(R-MSG-001) |
| contract-design-strategy §3 · §4.1 · §4.2 | `VALIDATION_FAILED` · `AUTH_REQUIRED` · `TOKEN_EXPIRED` · `ROOM_NOT_FOUND` · `LLM_TIMEOUT` 등 | R-API-002 13종(만료는 `TOKEN_INVALID`, 없음은 `NOT_FOUND`) |
| contract-design-strategy §4.1 | payload `{ mbId, nick, chName, level, exp }` | `{ mb_id, nick, ch_name, level, exp }`(R-AUTH-001) |
| contract-design-strategy §7 | `/api/*`에는 `frame-ancestors 'none'` | 모든 응답에 같은 허용 출처(R-API-006, index.md §3.1) |
| contract-design-strategy §9 | routes에 `embed.ts`, `app.onError`는 routes/index.ts | `/embed`·`onError`는 server 진입점(index.md D-IDX-6, §9.1) |
| contract-designer 에이전트 본문 | 시각은 ISO 8601 문자열 | epoch ms(R-API-004, R-DB-001) |
| 위임문 | ui/api `ApiError` **클래스**로 정규화 | `ApiError`는 **타입**, 래퍼는 `Result<T>` 반환·throw 금지(ts-rules 에러 처리, contract-design-strategy §11) |

### 15.4 확인 필요: 결정 완료 (v0.2, 2026-10-05 메인 세션 결정)

| # | 결정 | 반영 절 |
|---|---|---|
| 1 | R-LLM-002를 개정해 `CharacterMeta`에 `shortName`(세바스찬 / 시엘)을 추가한다. `name`은 전체 이름을 유지한다 | §5.5 · §10 · §12 · §14.2 |
| 2 | R-CHAT-009는 S2로 이동했다. S1 화면은 항상 읽기 전용이다. 토큰 보관은 `ui/src/state/token.ts`, `client.ts`는 getter 주입으로 헤더만 붙인다(S2 상세 예정) | §2.1 · §2.2 · §11.3 |
| 3 | `GET /api/rooms` 응답은 배열 그대로 유지한다(방 목록 페이지네이션 요구 없음) | 변경 없음 |
| 4 | 요구 추적표는 §10 위치를 유지한다 | 변경 없음 |

아래는 v0.1 당시 질문 원문이다(기록용).

1. **캐릭터 표시명.** 확정사항 §1과 위임문대로 `name`은 전체 이름(`세바스찬 미카엘리스`·`시엘 팬텀하이브`)이다. 화면 구성안은 말풍선에 짧은 이름(`시엘`·`세바스찬`)을 그린다. 짧은 이름이 필요하면 R-LLM-002의 표시 메타에 필드를 추가하는 요구 개정이 필요하다. 그전까지 화면은 `name`을 그대로 쓴다.
2. **R-CHAT-009 묶음과 토큰 보관 위치.** requirements.md §0은 CHAT-009를 S1에, rtm.md는 S2(`ui/src/state/token`)에 둔다. ui-design-strategy는 `ui/src/api/client.ts` 보관을 말한다. 이 계약은 S1에서 토큰을 다루지 않는다고 가정했다. 그러면 S1 화면은 언제나 읽기 전용이고, 쓰기 UI가 아직 없으니 R-CHAT-008은 자연히 충족된다. 보관 위치는 S2에서 정해야 한다.
3. **`GET /api/rooms` 응답 형태.** 위임문대로 배열 그대로 둔다. 방 목록에 페이지네이션이나 부가 정보가 요구되면 응답 형태 변경(파괴)이 된다. 지금 `{ rooms: [...] }`로 감싸면 그 위험이 없다. 다만 위임문과 다르므로 바꾸려면 결정이 필요하다.
4. **절 배치.** 위임문은 요구 추적표를 끝에 두라고 했다. 스킬 §13의 고정 절 번호에 따라 §10에 두었고, 구현 설계는 §11~§15 부록으로 붙였다.

### 15.5 S2에서 쓰는 server 함수·타입 (모두 server S2 설계에 있음, 구현 전)

| 사용처 | server 쪽 | 출처 |
|---|---|---|
| 쓰기 라우트 6개 | `requireToken: MiddlewareHandler<AppEnv>` · `rateLimitWrites: MiddlewareHandler<AppEnv>` (`server/src/auth`) | auth.md §2 · §9.1 |
| E8 | `getPrincipal(c: Context<AppEnv>): Principal` | auth.md §2 |
| E4 | `RoomsService.createRoom(input: RoomTitleInput): Promise<RoomSummary>` | rooms.md §2 |
| E5 | `RoomsService.renameRoom(id: string, input: RoomTitleInput): Promise<RoomSummary>` | rooms.md §2 |
| E6 | `RoomsService.deleteRoom(id: string): Promise<void>` | rooms.md §2 |
| E8 | `MessagesService.addUserMessage(roomId: string, input: UserMessageInput, author: MessageAuthor): Promise<Message>` | messages.md §2 |
| E10 | `MessagesService.editMessage(messageId: number, input: MessageTextInput): Promise<Message>` | messages.md §2 |
| E11 | `MessagesService.deleteMessage(messageId: number): Promise<void>` | messages.md §2 |
| `RATE_LIMITED` 응답 | `AppError(code, message?, { retryAfterSec })` → onError가 본문 `error.retryAfterSec` + `Retry-After` | index.md §2.4 · §5.1 |
| 라우트 테스트 | `signTestToken(payload, secret)`(`server/test/token.ts`) | auth.md §3 |

- env 바인딩·설정 추가: **없음.** `TOKEN_SECRET`(Secrets)·`TOKEN_MIN_LEVEL`·`RATE_LIMIT_PER_MIN`(`wrangler.toml [vars]`)은 이미 있다.

### 15.6 server 설계 변경 요청 (S2 — 막는 것 없음, 권고·문구 정리)

| # | 대상 | 요청 | 이유 |
|---|---|---|---|
| S2-R1 | messages.md §9 "메시지 경로 `:id`는 라우트가 `Number(문자열)`로만 바꿔 넘긴다" | 문구를 "10진 숫자 문자열만 `Number()`, 그 밖은 `NaN`"(§4.5 `messageIdParam`)으로 맞춘다. **서비스 변경 없음**(`isMessageId(NaN)` → `NOT_FOUND` 그대로) | `Number('0x10') = 16`·`Number('1e1') = 10`이라 한 메시지에 여러 URL이 생긴다. 라우트 변환은 contract 소관이라 계약에서 좁혔다 |
| S2-R2 | index.md §2.4 `toErrorBody` | 반환 타입을 `@shared/types`의 `ApiErrorBody`로 둔다(`import type`) | `retryAfterSec` 위치·이름이 바뀌면 server가 컴파일에서 바로 알게 한다(auth.md §9.2·index.md §9 "contract가 다르게 정하면 맞춘다"에 대한 답: **위치는 `error.retryAfterSec`, 이름 그대로**) |
| S2-R3 | rooms.md §9 · messages.md §9의 "contract가 정한다" 항목 | 결정값을 반영한다: 성공 status 생성 `201`·변경 `200`·삭제 `204`(본문 없음), `ooc`는 필수(기본값 없음) | 문서 간 미결 표시 정리 |
| S2-R4 (v0.3.1) | rooms.md §2·§2.1 · messages.md §2·§2.2 | rooms·messages 서비스가 `@shared/limits`를 쓴다. `normalizeTitle`·`normalizeMessageText`는 `normalizeText`·`countCodePoints`·`ROOM_TITLE_MAX`·`MESSAGE_TEXT_MAX`로 판정하고, 모듈의 `ROOM_TITLE_MAX`·`MESSAGE_TEXT_MAX`는 새로 정의하지 않고 shared에서 재노출한다(S4 memory는 `MEMORY_SUMMARY_MAX`) | 화면과 서버가 같은 상수·같은 세기 함수를 써서 길이 판정이 어긋나지 않게 한다(메인 세션 승인, 2026-10-05) |

### 15.7 확인 필요 (S2)

계약이 정한 것(되돌리려면 알려 달라, 지금은 막지 않음):

1. **`TOKEN_REQUIRED`도 읽기 전용 전환**(§2.4). R-CHAT-011은 `TOKEN_INVALID`·`LEVEL_TOO_LOW` 두 개만 적었다. 쓰기 UI가 보이는데 서버가 토큰 없음으로 답하는 경우도 같은 처리로 닫았다.
2. **삭제 성공은 `204` 본문 없음.** `{ ok: true }` 대신 택했다. 요구에 없는 필드를 만들지 않고, 화면은 `Result<void>`만 본다.
3. **`ooc`는 필수.** 기본값 `false`를 두면 같은 요청에 두 표기가 생긴다.
4. **`?t=`는 URL에서 지우지 않는다**(R-CHAT-009가 요구하지 않음).

사용자 확인이 남은 기본값(확정사항 §9, 값이 바뀌어도 계약 구조는 같다):

- §9-1 `TOKEN_MIN_LEVEL` = 5 · §9-2 표시 이름(`ch_name` 우선) · §9-5 이름 변경·삭제·메시지 수정·삭제 권한 "등급 통과자 누구나" · §9-6 분당 20회.

### 15.8 S3에서 쓰는 server 함수·타입 (모두 server S3 설계에 있음, 구현 전)

| 사용처 | server 쪽 | 출처 |
|---|---|---|
| E9 | `MessagesService.speak(roomId: string, input: SpeakInput, background: Background): Promise<Message>` — `SpeakInput = SpeakBody` | messages.md §2.3 |
| E9 | `type Background = { waitUntil: (task: Promise<unknown>) => void }` | messages.md §2.3 |
| E12 | `MessagesService.regenerate(messageId: number): Promise<Message>` | messages.md §2.3 |
| E9 · E12 | `requireToken` · `rateLimitWrites`(S2 그대로) | auth.md §9.1 |
| 라우트 테스트 | `FAKE_DEFAULT_TEXT`(`server/src/llm`) · `signTestToken`(`server/test/token.ts`) | llm.md §2 · auth.md §3 |

- env 바인딩·설정 추가: **없음.** `LLM_PROVIDER`·`LLM_MODEL`·`LLM_TIMEOUT_MS`·`CONTEXT_MESSAGES`(`wrangler.toml [vars]`)와 `LLM_API_KEY`(Secrets)는 server 설계에 이미 있다(llm.md §6). 라우트는 이 값을 읽지 않는다.

### 15.9 server 설계와 어긋나 보이는 점·변경 요청 (S3 — 막는 것 없음, 고치지 않고 보고)

| # | 대상 | 내용 | 요청 |
|---|---|---|---|
| S3-R1 | messages.md §5 `VALIDATION_ERROR` 행 `캐릭터는 sebastian 또는 ciel 중 하나여야 합니다.` | 라우트 zod `enum`이 먼저 거르므로 HTTP 응답으로는 이 문구가 나가지 않는다. 계약 응답은 기본 문구 `요청 형식이 올바르지 않습니다.`다(§4.13). 이 문구는 내부 id(`sebastian`)를 사용자 문장에 드러내기도 한다 | messages.md §5 해당 행에 "HTTP로는 닿지 않음(라우트 zod 선검사)"을 적는다. 문구를 남긴다면 내부 id 없는 문장을 권고 |
| S3-R2 | messages.md §9 `messages.regenerate(Number(id))` · llm.md 인계 표 "`messageIdParam`의 `Number()` 변환 결과" | 실제 라우트 변환은 10진 숫자 문자열만 `Number()`, 그 밖은 `NaN`이다(§4.5). 서비스 변경 없음 | 문구 정리(S2-R1과 같은 건) |
| S3-R3 | 라우트 테스트의 `502` 주입 | 서비스 컨테이너가 요청마다 env로 provider를 만들어, 라우트 테스트가 `FakeProvider` 각본을 넣을 길이 없다. §14.9는 `google` + 전역 `fetch` 대체로 우회한다 | 우회가 workerd에서 막히면 그때 `createApp`에 테스트 전용 llm 주입 옵션을 server에 요청한다. 지금은 요청하지 않는다 |
| S3-R4 | R-NFR-001 70초 | 서버 상한 70초는 D1 왕복 합 4초 가정 위에 있다(llm.md §4.2, 메인 세션 보고 사항 1-③) | 실측 뒤 4초를 넘으면 `LLM_BUDGET_MS` 조정(server 몫). 화면 타임아웃이 없어 계약 문구는 그대로다 |

### 15.10 확인 필요 (S3)

계약이 정한 것(되돌리려면 알려 달라, 지금은 막지 않음):

1. **실패한 생성도 레이트리밋 1회.** `409`·`502`·`500 CONFIG_INVALID`로 끝나도 센다(§6.1 S3 행). `502` 뒤 「재시도」를 연타하면 분당 20회에서 막힌다.
2. **화면 요청 타임아웃 없음.** 서버 70초 종결에 의존한다. 화면 쪽 시간 제한 안내가 필요하면 ui 요구로 올린다(두면 75초 이상).
3. **E12 본문은 깨진 JSON이어도 무시하고 진행한다**(본문을 읽지 않는다).
4. **E9 `character` 오류 문구는 기본 문구**(`요청 형식이 올바르지 않습니다.`)다. 화면은 버튼 두 개로만 값을 보내므로 사용자에게 보일 일이 없다.

사용자 확인이 남은 server 쪽 사항(계약 구조는 같다): R-MSG-006 "마지막" 판정을 잠금 시점 1회로 하는 것(생성 중 유저 발화가 붙어도 교체된다 — messages.md §4.3 확인 필요).

### 15.11 S3b server 의존 · 어긋난 점 · 확인 필요 (v0.4.1)

사용하는 server 함수·타입(모두 server S3b 설계에 있음, 구현 전 — routes는 직접 부르지 않는다):

| 항목 | 시그니처·형태 | 근거 |
|---|---|---|
| 예산 게이트 | `Llm.ensureBudget(): Promise<void>` — messages `speak`·`regenerate`가 `deps.llm()` 다음 줄에서 부른다 | llm.md §12.2·§12.7, messages.md §4.2 |
| 거절 에러 | `new AppError('LLM_BUDGET_EXCEEDED', undefined, { retryAfterSec })` | llm.md §12.10 |
| 응답 변환 | 기존 `onError`/`errorResponse`(본문 `error.retryAfterSec` + `Retry-After`) | index.md §2.4 · §5.1 · SRV-T-233 |
| 설정 | `[vars]` 4키 `LLM_MONTHLY_BUDGET_KRW`·`LLM_PRICE_INPUT_USD_PER_M`·`LLM_PRICE_OUTPUT_USD_PER_M`·`KRW_PER_USD`(비밀값 아님) | env.md §3.1 · llm.md §6 |
| 테스트 시드 | `helpers.ts` `insertUsage(month, estKrw, calls = 1)` | db.md §6 파일 표 |

server 설계 변경 요청: **없음.** 판정 순서·문구·`retryAfterSec` 계산이 계약과 같다. 표기 차이만 있다 — llm.md 「contract 인계」 S3b 절은 판정 순서를 에러 묶음 번호(speak 2b, regenerate 3b)로 적고, 이 문서는 §4.13·§4.14 판정 표 번호(4b·5b)로 적는다. 순서 자체는 같다.

확인 필요(계약이 정한 것 — 되돌리려면 알려 달라, 지금은 막지 않음):

1. **ui/api가 `LLM_BUDGET_EXCEEDED`의 `retryAfterSec`를 버린다**(§3.4). 화면에 "N월 1일에 풀립니다" 같은 해제 날짜를 보이려면 ui 요구로 올려야 한다.
2. **「재시도」는 눌러도 같은 429이고 레이트리밋 1회를 쓴다**(사전 확정 2 · §6.1 S3b 행). 연타하면 `RATE_LIMITED`로 바뀐다.
3. **handoff 안내 단락의 위치·수신자**는 S5에서 정한다. 비용 설정을 고치는 사람은 Cloudflare·Gemini 키 소유자(지인)이고 갠홈 운영자와 다를 수 있다.

### 15.12 S3c server 의존 · 통보 · 현황 · 확인 필요 (v0.5)

사용하는 server 함수·타입(s3c-03 §1.3 전제, 모두 구현 전):

| 사용처 | server 쪽 | 출처 |
|---|---|---|
| E15 · E16 | `requireOwner: MiddlewareHandler<AppEnv>` — `server/src/auth/index.ts`에서 export, `requireToken` 뒤, 아니면 `AppError('OWNER_ONLY')` | s3c-03 §1.3 · auth.md(S3c) |
| E15 | `SettingsService.get(): Promise<CharacterSettingsResponse>` | s3c-03 §1.3 · settings.md |
| E16 | `SettingsService.put(settings: CharacterSettings, by: Principal): Promise<CharacterSettingsResponse>` | 같음 |
| E16 스키마 | `characterSettingsSchema`(zod) — `server/src/settings/index.ts`에서 export | 같음 |
| 서비스 접근 | `Services.settings`(`c.get('services').settings`) | s3c-03 §1.2 · index.md |
| 기존 | `requireToken` · `rateLimitWrites` · `getPrincipal` · `Principal` · `AppError` | auth.md §9.1 · index.md §2.4 |

- `AuthService.isOwner`는 routes가 직접 부르지 않는다. env 바인딩 추가는 server 몫 `OWNER_MB_IDS` 하나이고 contract가 더하는 설정은 없다.

server에 통보할 것(s3c-03 §1.3 **시그니처와 어긋나는 것은 없다.** 아래는 시그니처 밖에서 계약이 정한 값이다):

| # | 대상 | 계약이 정한 것 | 이유 |
|---|---|---|---|
| N1 | `settings/schema.ts` zod | 상한·필수는 `@shared/settings`(`WORLD_FIELD_SPEC`·`CHARACTER_FIELD_SPECS`)에서 import. 길이는 `countCodePoints(normalizeText(v))`(zod `.max()` 금지). 목록은 항목 trim → 빈 항목 제거 → 개수 → 항목 길이. strict 3단(본체·`characters`·캐릭터), 두 캐릭터·11필드 키 필수(선택 필드도 키는 있어야 함) | 화면 사전 검사·서버 판정이 같은 벡터에서 같아야 한다(s3c-03 §2.3) |
| N2 | 같은 스키마 | 출력 타입이 shared `CharacterSettings`에 대입 가능해야 한다(routes가 `const body: PutCharacterSettingsBody = c.req.valid('json')`로 대조) | tsc 대조(§5.8.5) |
| N3 | 400 문구 | 문구는 routes가 shared `checkCharacterSettings`에서 만든다. zod에 한국어 문구를 둘 필요가 없다. `put`이 라우트를 거치지 않는 호출을 위해 다시 검증한다면 문구도 같은 함수에서 가져온다 | 문구 단일 소스(§4.16) |
| N4 | `settings.put` 정규화 | 결과가 `checkCharacterSettings(input).value`와 같아야 한다(같은 함수 사용 권고). 응답 `settings`가 이 값이다 | API-T-095 |
| N5 | `settings.get` | 시드 대체는 "행 없음 · 재검증 실패"만. D1 읽기가 throw하면 `500 INTERNAL`(§4.15) | 장애를 시드로 숨기지 않는다 |
| N6 | `requireOwner` | D1에 접근하지 않고, 403 본문은 기본 문구만(목록·`mbId` 없음). `rateLimitWrites`보다 앞에 붙는 것을 전제로 계약이 "`OWNER_ONLY`는 세지 않음"을 약속했다 | §2.7 · §6.1 |
| N7 | `version` | 재검증 실패 행 위에 저장하면 응답 version = 그 행 version + 1(s3c-02 §3 UPSERT 그대로). 계약은 "단조 증가"만 약속한다 | §4.16 |

현황 메모(v0.5 작성 시점, 2026-10-06):

- S3c 4자는 **전부 없다.** `shared/src/errors.ts`는 14종(`OWNER_ONLY` 없음), `PATHS` 값 9개, `shared/src/settings.ts` 없음, routes에 `settings.ts` 없음, `validate.ts`는 2인자, `ui/src/api/client.ts` `method`는 `'GET' | 'POST' | 'PATCH' | 'DELETE'`다.
- server 쪽 `server/src/settings/`·`requireOwner`·`Services.settings` 소스도 없다(설계만 있음).

settings.md 대조 결과(v0.5 보정, 2026-10-06 — `server/settings.md` · `auth.md` §12 · `env.md` S3c 델타 · `db.md` §7.6):

| 항목 | 계약 | server 설계 | 판정 |
|---|---|---|---|
| `SettingsService` `get`·`put`·`loadForPrompt` 시그니처 | §4.15 · §4.16 · 이 절 | settings.md §2 그대로(`loadForPrompt` 반환형에 llm 별칭 `PromptSettings`만 붙음, 구조 같음) | 일치 |
| `characterSettingsSchema` 위치·이름·재노출 | §5.8.5 · §11.12 | settings.md §2·§3(`schema.ts`, `settings/index.ts` 재노출) | 일치 |
| `requireOwner` 위치·순서·I/O 없음 | §2.7 · N6 | auth.md §12.1·§12.2(`requireToken` 뒤·`rateLimitWrites` 앞, 대소문자 정확 일치, 동기 판정) | 일치 |
| `OWNER_ONLY` 403·기본 문구만·`owner_denied` info | §3.2 · §2.7 | auth.md §12.3 | 일치 |
| 정규화(trim · 목록 trim → 빈 항목 제거 → 개수 → 항목 길이, 순서·중복 유지) | §4.16 · §5.8.4 · N4 | settings.md §2.3 | 일치 |
| 시드 대체(행 없음·재검증 실패 → `version 0`·`null`·`true`), D1 throw → `INTERNAL` | §4.15 · N5 | settings.md §2.4·§5 | 일치 |
| version 단조 증가(훼손 행 위 저장 = 그 행 + 1) | §4.16 · N7 | settings.md §2.4 · db.md §7.6 | 일치 |
| 본문 128KB → 400 · 비주인 레이트리밋 미소모 | §4.16 · §6.1 | settings.md §9 · auth.md D-AUTH-17 | 일치 |
| 에러 매핑(`VALIDATION_ERROR`·`OWNER_ONLY`·`INTERNAL`·`CONFIG_INVALID`) | §4.15 · §4.16 | settings.md §5·§9 · env.md S3c(형식 위반 → `CONFIG_INVALID`) | 일치 |
| 로그 3종·본문 미기록 | §4.16 부수 효과 | settings.md §5.2 | 일치 |

- **server 내부, 계약 영향 없음:** `assertOwner`(auth.md §12.1) · `PromptSettings`(llm 별칭) · `parseCharacterSettings`·`firstSettingsIssue`(서비스 재검증·로그 경로용) · 0003 `json` CHECK 상한 200000(db.md §7.6, s3c-02 초안 100000에서 올림) · `OWNER_MB_IDS` 파싱 상세(env.md S3c).
- **server 400 문구는 §4.16 참조, 서버 zod는 판정만 한다.** (확정 — 2026-10-06 메인 세션 결정) 라우트 경유 400 문구는 routes `settingsIssueMessage`(= shared `checkCharacterSettings`)가 만든다. `put`을 라우트 없이 부른 경우의 400 문구도 같은 shared 함수에서 가져온다.

남은 불일치(전부 settings.md 쪽 문구·이름이다. server-designer가 고치는 중이고 계약은 바꾸지 않는다):

| # | settings.md 위치 | 지금 적힌 것 | 계약 기준 |
|---|---|---|---|
| M1 | §5.1 문구 표 · SRV-T-243·244 | 자체 문구(`최대 10개까지 넣을 수 있습니다` · `{이름}의 각 줄은` · `{이름} 형식이…` · 모르는 키·세 번째 id·캐릭터 누락은 범위 접두 없는 `설정 형식이 올바르지 않습니다.`) | §4.16 표 13행(범위 접두 항상 있음) |
| M2 | §9 라우트 규약 · §5 표 · D-SET-6 | 라우트가 `firstSettingsIssue(error, ['settings'])`로 400 문구를 만든다 | routes `settingsIssueMessage`(shared 함수, §11.12) |
| M3 | §9 라우트 규약 | 봉투 `z.strictObject({ settings })` | 봉투는 `z.object` — 바깥 모르는 키는 버린다(§4.16, 결정 4) |
| M4 | §2.2 가칭 명세 | `CHARACTER_SETTING_FIELDS`(배열, `key` 포함) · `WORLD_FIELD` · `issue.path` 문자열 | `CHARACTER_FIELD_SPECS`(키별 객체) + `CHARACTER_FIELD_KEYS`(순서) · `WORLD_FIELD_SPEC` · `SettingsIssue.path: readonly string[]`(§5.8.4) |
| M5 | §2.2 화면 이름 표 | `world` 화면 이름 `공통 세계관` | `세계관`(결정 2) |
| M6 (권고) | §2 · §3 server 타입 `SettingsIssue { path: string }` | shared `SettingsIssue`와 이름이 같고 모양이 다르다 | server 내부 타입 이름을 바꾸거나(예: `SchemaIssue`) shared 타입을 쓴다. 한 파일에서 둘을 import하면 충돌한다 |
- `hono/body-limit`(hono 4.13.13)은 `Content-Length`가 있으면 그 값으로, 없으면 스트림을 세어 `onError(c)`를 부른다. `onError`에서 throw하면 server `onError`가 받는다. `@hono/zod-validator` 0.9.1 훅은 실패 때도 `result.data`에 원래 입력을 준다 — `settingsIssueMessage`가 이것을 쓴다.

v0.5 확인 필요 5건은 모두 결정됐다.

결정 완료(2026-10-06 메인 세션 결정, 출처 `doc/state.json` decisions):

| # | 항목 | 결정 | 반영 |
|---|---|---|---|
| 1 | 필드 11개 키 전부 필수, 선택 필드는 `''`·`[]` | 승인 | §4.16 · §5.8.1 |
| 2 | 공통 탭 400 문구에 "공통"이 두 번 나옴 | `world` 필드의 **화면 이름을 `세계관`**으로 한다. 문구는 `공통 · 세계관은 …`. 탭 이름("공통 세계관")은 화면 `labels.ts` 몫이라 그대로다. s3c-02 §2.1 표(화면 이름 `공통 세계관`)는 system-architect 소유라 고치지 않았고, 이 결정이 그 칸보다 우선한다 | §4.16 문구 표 · §5.8.4 `WORLD_FIELD_SPEC.label` · §14.14 · §14.15 · 「ui 인계 메모」 S3c |
| 3 | 내보내기 `exportedAt` ISO 8601 문자열(epoch ms 규칙 예외) | 승인 | §16.1 |
| 4 | PUT 봉투 바깥 모르는 키 버림, `settings` 안만 strict | 승인 | §4.16 · §11.12 |
| 5 | E.No.S 매핑에서 문자열·문자열 배열 둘 다 수용 | 승인 | §16.3 |
| 6 | 가져오기 "무시한 항목" 정의(ui-design-checker 지적, v0.5 보정 2) | 출처에 값이 있으나 형이 달라 쓸 수 없는 위치만 센다. 출처에 없는 키·매핑 없는 필드(`persona`·`relationships`·`rules`)·`null`·E.No.S 빈 값은 "없음"이고 세지 않는다. 계수는 후보 만들기 단계 한 곳에서만 한다 | §16.2 · §16.3 |
| 7 | 가져오기 검사 범위(ui-design-checker 지적, v0.5 보정 2) | 파일이 준 후보 필드만 각 spec으로 검사하고, 상한 초과면 가져오기를 거부한다. 초안 전체 검사는 저장 버튼 활성 조건에서만 한다. 파일과 무관한 기존 초안 오류는 가져오기를 막지 않는다 | §16.2 · §5.8.4 쓰는 곳 표 |

남은 확인(막지 않음): 설정 상한을 `limits.ts`가 아니라 `settings.ts`에 둔 것(§5.7 메모). E.No.S 실물 백업 파일 1개로 §16.3 키 이름을 확인하면 좋다.

### 15.13 S3d server 의존 · 어긋난 점 (v0.6)

사용하는 server 함수·타입(routes는 `speak`만 직접 부른다):

| 항목 | 시그니처·형태 | 근거 |
|---|---|---|
| speak | `messages.speak(roomId: string, input: SpeakInput, background: Background): Promise<Message>`, `SpeakInput = SpeakBody`(`character: SpeakTarget`). 반환 `speaker`는 늘 `CharacterId` | s3d-03 §1 · messages.md S3d |
| 투영 | `db/messages.ts` `toMessage` — `speaker === 'user'`면 `authorName = USER_DISPLAY_NAME`, 그 밖 `null`. `author_name` 열은 저장만 | s3d-03 §1 · db.md S3d |
| 화자 선택 | `llm/select.ts` `buildSelectPrompt` · `parseSpeakerChoice` · `fallbackSpeaker` — routes·ui는 부르지 않는다 | llm.md S3d |

server 변경 요구 명세: **없음.** 새 서비스 메서드·에러 코드·env 키·마이그레이션이 0이고 시그니처가 s3d-03 §1과 같다.

server-designer에게 알릴 점(막지 않음):

1. s3d-03 §1은 `messages.speak(roomId, input: SpeakBody, background)`로 적었다. 현 코드는 `SpeakInput = SpeakBody` 별칭이라 같은 뜻이다. 별칭을 유지한다.
2. 서비스의 `isCharacterId` 재검사(§5.6 · §15.9 S3-R1)는 `'auto'` 분기 **뒤**에 두어야 한다. 앞에 있으면 `'auto'`가 서비스에서 거절된다.
3. 라우트 테스트 API-T-109는 fake 제공사에서 각본 없이 `201`을 기대한다. 선택 응답 파싱 불가 → 기본 화자 경로가 fake 기본 응답에서도 성립해야 한다.
4. API-T-111②는 예산 초과면 선택 호출도 0회(`llm_usage.calls` 불변)라고 본다. 예산 게이트가 선택 호출보다 앞이어야 한다(s3d-02 §4 순서와 같다).

### 15.14 S4 server 의존 · 어긋난 점 · 확인 필요 (v0.7)

사용하는 server 함수·타입(모두 server S4 설계에 있음, **구현 전** — `server/src/memory/` 없음):

| 항목 | 시그니처·형태 | 근거 |
|---|---|---|
| 장기기억 읽기 | `services.memory.get(roomId: string): Promise<MemoryState>`, `MemoryState = MemoryResponse` | memory.md §2 |
| 장기기억 편집 | `services.memory.put(roomId: string, input: PutMemoryInput): Promise<MemoryState>`, `PutMemoryInput = PutMemoryBody` | memory.md §2 |
| 컨테이너 | `Services.memory: MemoryService` | index.md §13.1 |
| speak 훅 | `messages.speak(roomId, input, background)` 불변. 컨테이너가 `afterSpeak`로 `memory.summarizeIfNeeded`를 연결한다 — routes는 부르지 않는다 | messages.md §13 · index.md §13.1 |
| 미들웨어 | `requireToken` · `rateLimitWrites`(기존) | auth.md |
| 저장소 | `memory.getState`·`memory.putSummary` 등 — routes는 부르지 않는다 | db.md §13 |

server 변경 요구 명세: **없음.** 새 서비스 메서드·에러 코드·env 키·마이그레이션이 0이고, 이름·입출력이 memory.md 「contract 인계 요구 명세」와 같다.

(v0.7.1) **server 변경 요구 명세 1건** — R-MEM-001 🔒 개정:

| 항목 | 내용 |
|---|---|
| 대상 | `services.memory.put`(memory.md §2·§2.1)과 저장소 `memory.putSummary`(db.md §13, `SQL_MEMORY_PUT_SUMMARY`). 현 구현 `server/src/db/memory.ts`의 `putSummary`는 `source_until_id`를 유지만 한다 |
| 입력·출력 | 시그니처 불변. trim 결과 `''`이면 `source_until_id = 0`으로 저장하고 `MemoryState.sourceUntilId: 0`을 돌려준다. 비어 있지 않으면 기존대로 유지(행이 없으면 0) |
| 원자성 | 방 존재 확인을 포함한 기존 한 문장 UPSERT 안에서 정한다(예: `source_until_id = CASE WHEN ?summary = '' THEN 0 ELSE memory.source_until_id END`). 진행 중 자동 요약은 기대값(`summary`·`source_until_id`)이 달라져 `conflict`로 버려진다(memory.md §4.4 그대로) |
| 에러·env·마이그레이션 | 변경 없음 |
| 이유 | 사용자 지정: 요약 삭제 = 처음부터 재요약 |
| 테스트 | server SRV-T-314 기대 갱신(`''` 저장 시 source 0) + 비운 뒤 `summarizeIfNeeded`가 방 첫 메시지부터 요약하는지. contract 쪽 API-T-125 |

server 설계와 어긋나 보이는 점(막지 않음, server-designer에게 알릴 것):

1. memory.md §2 표 `put` 실패 조건 ①은 "문자열 아님·4000 초과 → `장기기억은 0~4000자로 입력해 주세요.`"다. HTTP로는 라우트 zod `z.string()`이 비문자열을 먼저 막아 **기본 문구**가 나간다(§4.18 판정 5, S2 본문 규칙과 같다). 서비스의 비문자열 분기는 라우트를 거치지 않는 호출의 안전망이고, SRV-T-314 `summary: 1` 기대는 서비스 직접 호출이라 그대로 맞다.
2. 본문 상한: memory.md는 "32KiB 이상 권고, 값은 contract 확정"이었다. contract는 **정확히 32768바이트, 400 기본 문구**로 정했다(§4.18). 상수는 routes에 두고 shared·server 서비스에는 두지 않는다.
3. E13 미들웨어: memory.md는 "`requireToken`만"이라 했다. contract는 기존 방 경로 관례대로 `validate('param', roomIdParam)`을 함께 붙인다. 동작 차이는 없다(빈 id는 경로가 매칭되지 않는다).
4. E13·E14 상세는 §4.17·§4.18이다(§4.15·§4.16은 S3c E15·E16). server 문서·화면 설계가 api.md 절을 인용할 때 이 번호를 쓴다.
5. API-T-123은 `CONTEXT_MESSAGES: '1'`·`MEMORY_SUMMARY_THRESHOLD: '2'`를 쓴다. parseEnv가 이 조합(1~100 · 2~1000 · 기준 > 컨텍스트)을 받아야 한다(env.md 기존 범위 안).

확인 필요:

1. (server 열린 질문 1 연동) 자동 요약 기준은 "미요약 메시지 수"다(memory.md D-MEM-1). §4.13 부수 효과 문구가 이 해석을 따른다. 요구 문구 그대로("방 메시지 수")로 정해지면 그 한 줄만 고친다(비파괴).
2. (server 열린 질문 2 연동) 편집 경합은 마지막 저장 승리이고 `409`가 없다(§4.18 경합 표). 시트를 연 채 자동 요약이 끝난 뒤 저장하면 그 요약을 덮는다. 충돌 감지가 필요하면 R-API-002 개정(16종째 코드)과 `PutMemoryBody`의 기대 버전 필드가 필요하다. 요구로 승격되기 전에는 만들지 않는다.
3. **(v0.7.1 해소 — 2026-10-07 사용자 결정, R-MEM-001 🔒 개정)** 요약 비우기(`summary: ''`, trim 결과 기준)는 `sourceUntilId`를 0으로 되돌린다. 다음 speak 뒤 방의 처음부터 다시 요약한다. 비어 있지 않은 편집은 유지. 반영 §4.18.

### 15.15 S3f server 의존 · 03과 다르게 정한 점 · 현황 · 확인 필요 (v0.8)

사용하는 server 함수·타입(모두 s3f-03 §1.2 공개 시그니처, **구현 전**):

| 항목 | 시그니처·형태 | 근거 |
|---|---|---|
| 설정 읽기 | `services.settings.get(): Promise<CharacterSettingsResponse>` — 응답에 `model`(지금 쓰는 키) | s3f-03 §1.2 · s3f-02 §2.2 |
| 설정 저장 | `services.settings.put(settings: CharacterSettings, by: Principal, model?: LlmModelKey): Promise<CharacterSettingsResponse>` — `model` 생략 = 저장값 유지(UPSERT `COALESCE`) | s3f-03 §1.2 · s3f-02 §1 |
| 키 → 모델명 | `LLM_MODEL_OPTIONS`(server `llm/models.ts`) — routes는 부르지 않는다. 라우트 테스트(API-T-126)가 env 덮어쓰기 값으로만 import | s3f-03 §1.2 |
| 해석·폴백·로그 | `resolveLlmModel` · `modelKeyOf` · `loadModelKey` · `fallbackModelKey` 주입 — routes는 부르지 않는다 | s3f-03 §1.2 |
| 미들웨어 | `requireToken` · `requireOwner` · `rateLimitWrites`(기존) | auth.md |

server 변경 요구 명세: **없음.** s3f-03 §1.2 시그니처를 그대로 쓴다. 새 에러 코드·env 키는 0이다(마이그레이션 0004는 s3f-03 §1.3 server 몫).

03과 다르게 정한 점(제안 — 막지 않음):

1. `PutCharacterSettingsBody.model`은 `model?: LlmModelKey | undefined`다(s3f-03 §2.2는 `model?: LlmModelKey`). `tsconfig.base.json`에 `exactOptionalPropertyTypes`가 켜져 있고 zod 4 `.optional()` 출력이 `?: T | undefined`라, `const body: PutCharacterSettingsBody = c.req.valid('json')` 대조가 tsc를 통과하려면 필요하다. 선례는 `MessagesQuery`(v0.2.1)다. JSON에는 `undefined`가 없으므로 계약 뜻은 같다. server `put`의 셋째 인자는 매개변수라 그대로 맞는다.
2. `LLM_MODEL_KEYS`는 `['pro', 'flash'] as const satisfies readonly LlmModelKey[]`(튜플)다. s3f-03 §1.2의 `readonly LlmModelKey[]`보다 좁고 그 자리에 그대로 대입된다. `z.enum`이 리터럴 튜플을 받기 때문이고 `SPEAK_TARGETS`·`SETTINGS_CHARACTER_IDS`와 같은 방식이다.
3. 로그 `settings_saved`의 `model` 값은 server settings.md §13.5가 "저장 뒤 지금 쓰는 키(응답 `model`과 같은 값, `null` 가능)"로 정했다. 계약은 "키만, 본문 없음"만 요구하므로 어긋남이 없다.

현황 메모(고치지 않음):

1. §12.6 표 뒤에 S4 「예정」 표의 머리 없는 잔여 10줄(`---|---|…`로 시작)이 남아 있다. v0.7 구현 때 표를 바꾸며 남은 것으로 보인다. 계약 내용과는 무관하며, 지울지는 메인 세션이 정한다.
2. §14.16 제목의 테스트 파일은 `ui/src/api/api.test.ts`지만 실물은 `ui/src/api/settings.test.ts`다(머리 주석이 §14.16을 가리킨다). §14.21은 실물 파일명을 쓴다.

확인 필요:

1. R-SET-013의 "고른 적 없으면 … 화면은 미선택 안내 문구"와 응답 `model`(지금 쓰는 키)의 관계. 서버 기본 모델이 Pro이면 고른 적 없는 상태도 `model: 'pro'`로 와서, 화면은 "저장된 Pro"와 "기본값 Pro"를 구분하지 못한다. 미선택 안내는 `model: null`(서버 기본 모델이 두 후보 밖)일 때만 나온다. 승인 ① 결정("지금 실제로 쓰는 모델의 키")대로 두었다. 둘을 구분해야 하면 요구 승격 뒤 응답에 선택 필드를 더한다(비파괴).

### 15.16 S6 server 의존 · 03과 다르게 정한 점 · 현황 · 확인 필요 (v0.9)

사용하는 server 함수·타입(전부 s6-03 §1.2 공개 시그니처 — server-designer 설계 중, 구현 전):

| 대상 | 시그니처 | 쓰는 곳 |
|---|---|---|
| rooms | `listRooms(): Promise<RoomSummary[]>`(+`locked`) · `createRoom(input: CreateRoomBody): Promise<CreateRoomResponse>` · `renameRoom`·`deleteRoom`(불변) | E3 · E4 · E5 · E6 |
| rooms | `enter(roomId, { password?, isOwner }): Promise<EnterRoomResponse>` | E17 |
| rooms | `setPassword(roomId, password, by: { mbId }): Promise<SetRoomPasswordResponse>` · `clearPassword(roomId, by): Promise<RoomSummary>` | E18 · E19 |
| rooms | `assertEntry(target: EntryTarget, access: EntryAccess): Promise<void>`(`ROOM_LOCKED`) | `requireRoomEntry` 안(라우트는 직접 부르지 않는다) |
| auth | `optionalToken` · `isOwnerRequest(c)` · `requireRoomEntry(kind)` · `hitEnterLimit(roomId)`(`rooms.enter` 안) | E17 · E5~E14 · E18 · E19 |
| env | `Config.roomEnterLimitPerMin`(`ROOM_ENTER_LIMIT_PER_MIN`) | §6.2(server만 읽는다) |

- **server 변경 요구 명세: 없음**(시그니처 집합 그대로 쓴다). 확인 요청 3건(막지 않음, server-designer rooms.md·auth.md에서 맞춰 주면 된다): ① `requireRoomEntry`는 헤더 값이 빈 문자열이면 `null`로, 128자 초과면 HMAC 계산 없이 무효로 본다(§2.8.1) ② E17에서 `password: ''`(키 있음)은 "없음"이 아니라 **시도**로 센다(⑤ → ⑥) — 계약은 "키가 없을 때만 없음"(§4.19) ③ `optionalToken`이 삼키는 사유에 `TOKEN_REQUIRED`(헤더는 있으나 꺼낼 수 없음)도 든다(§2.8.5, s6-03 §1.1 문구와 같음).

s6-03과 다르게 정한 점(시그니처·엔드포인트 집합 불변, contract 내부 결정):

| # | 03 문구 | 이 문서 | 이유 |
|---|---|---|---|
| 1 | `roomTitleBody`에 `password: z.string().optional()` | E4 전용 `createRoomBody` 신설, `roomTitleBody`(E5) 불변 | 지금 E4·E5가 `roomTitleBody`를 같이 쓴다(`server/src/routes/rooms.ts:16 · 27`). 그대로 넓히면 이름 변경 본문이 `password`를 받아 버린다(요구 없음) |
| 2 | (본문 상한 1KiB만) | 상수 이름 `ROOM_PASSWORD_BODY_MAX_BYTES = 1024`(routes) · 초과 `400` 기본 문구 | 기존 `MEMORY_BODY_MAX_BYTES`와 같은 위치·처리 |
| 3 | `enterRoom`은 `auth: true` | `roomId` 옵션은 붙이지 않는다(`X-Room-Key` 없음) | E17에는 관문이 없다. 증명을 필요 없는 곳에 보내지 않는다 |

현황(2026-10-08, grep): S6 4자는 **전부 아직 없다** — `shared/src`·`server/src`·`ui/src`에 `ROOM_LOCKED`·`roomEnter`·`pass_hash`·`ROOM_ENTER` 0건. `shared/src/errors.ts`는 15종, `PATHS` 11. `ui/src/api/client.ts:19` `ClientConfig = { getToken }`, `:41` `configureClient`가 토큰 슬롯 하나만 채운다.

확인 필요(메인 세션):

| # | 내용 | 기본값(이 문서) |
|---|---|---|
| C1 | `doc/100_요구조건/requirements.md`에 **R-LOCK-001~009와 개정 L1~L15가 아직 없다**(grep 0건). 이 문서는 승인 ①을 받은 s6-02 §9·§10 문안을 요구 원문으로 썼다 | 메인 세션이 requirements·rtm에 옮긴 뒤 문구가 다르면 §10 행을 맞춘다 |
| C2 | 잠긴 방 날짜 숨김은 화면 몫(사용자 결정)이라 E3 응답에는 `updatedAt`·`createdAt`·`messageCount`가 그대로 있다 — 개발자 도구로는 보인다 | 비파괴 유지. "응답에서도 숨김"을 원하면 별도 요구로 올린다(응답 값 규칙 변경) |
| C3 | E17 `password: ''` 처리(위 확인 요청 ②) | 시도로 센다 |

---

## 16. 부록 — 캐릭터 설정 파일 형식 · 가져오기 매핑 (S3c — R-SET-007 🔒 · R-SET-008)

서버 엔드포인트가 없는 화면 쪽 규칙이다. 구현은 ui `state/settingsFile.ts`(ui 설계 몫)이고 형식·매핑·금지 규칙의 정본은 이 절이다. 상수는 `shared/src/settings.ts`(§5.8.4)에 있다.

### 16.1 내보내기 파일 형식

```json
{
  "format": "london-dispatch/character-settings",
  "formatVersion": 1,
  "exportedAt": "2026-10-06T14:20:00.000Z",
  "settings": { "world": "…", "characters": { "sebastian": { "sourceMaterial": "…", "…": "…" }, "ciel": { "…": "…" } } }
}
```

| 키 | 값 |
|---|---|
| `format` | `SETTINGS_FILE_FORMAT` |
| `formatVersion` | `SETTINGS_FILE_FORMAT_VERSION`(1) |
| `exportedAt` | 내보낸 시각, ISO 8601 UTC 문자열(`new Date().toISOString()`). 사람이 파일을 열어 읽는 용도다 |
| `settings` | `CharacterSettings`. 응답 객체를 펼치지 않고 `world` + `SETTINGS_CHARACTER_IDS` 순서 × `CHARACTER_FIELD_KEYS` 순서로 **새로 만든다**(화이트리스트) |

- 최상위 키는 정확히 위 4개다. `version`·`updatedAt`·`isDefault`·`updatedBy`·`mbId`·토큰·설정 키(`LLM_API_KEY` 등)·`outputRules`·(v0.8) `model`은 넣지 않는다.
- (v0.8, R-SET-007 🔒 S3f 개정) **모델 키는 파일에 넣지 않고 가져오기로 바뀌지 않는다.** 파일은 캐릭터를 옮기는 원고이고, 모델은 이 갠홈의 비용·속도를 정하는 운영 스위치다. 남이 만든 파일을 가져와서 모델(비용)이 바뀌는 일을 막는다. 화이트리스트가 이미 모르는 키를 쓰지 않으므로 `formatVersion`은 1 그대로이고, 파일에 `model` 키가 있어도 읽지 않는다(§16.3 표 밖 키). 가져오기는 화면의 모델 선택을 바꾸지 않는다(s3f-02 §6).
- 대상은 **마지막으로 읽거나 저장한 값**(E15·E16 응답의 `settings`)이다. 인증 만료로 저장할 수 없는 상태(stale)일 때만 현재 초안을 내보낸다(R-SET-007 · R-SET-011).
- 직렬화는 `JSON.stringify(file, null, 2)`, UTF-8, MIME `application/json`. 파일명은 `london-dispatch-characters-YYYYMMDD-HHmm.json`(브라우저 현지 시각)이다.
- 전달 수단은 둘이고 내용은 같은 문자열이다: Blob 다운로드(`URL.createObjectURL` + `a.download`)와 복사용 읽기 전용 텍스트 영역. iframe `sandbox`가 다운로드를 막아도 복사로 내보낼 수 있다(§8 TODO).

### 16.2 가져오기 판별·병합

| 순서 | 입력 | 판별 | 처리 |
|---|---|---|---|
| 0 | 파일 크기 | `> SETTINGS_IMPORT_MAX_BYTES`(5MB) | 읽지 않고 거부. 붙여넣기 텍스트도 같은 상한(UTF-8 바이트) |
| 1 | `JSON.parse` 실패 · 최상위가 객체가 아님 | — | 거부(알 수 없는 파일 형식) |
| 2 | 자체 형식 | `format === SETTINGS_FILE_FORMAT` | `formatVersion !== SETTINGS_FILE_FORMAT_VERSION`이면 거부(버전). 같으면 `settings`를 매핑 없이 후보로 쓴다 |
| 3 | E.No.S 백업 | 최상위 `DB` 객체에 `worlds` 배열 | §16.3 매핑. `SETTINGS`·`DB.chats`는 열지 않는다 |
| 4 | E.No.S world 단독 | 최상위 `characters` 배열 + `description` 문자열 | §16.3 매핑(그 파일 자체가 world) |
| 5 | 그 밖 | — | 거부 — `알 수 없는 파일 형식입니다.` |

- **후보 만들기(계수는 여기 한 곳).** 판별한 파일에서 화이트리스트 위치(`world`, `characters.{sebastian|ciel}.{CHARACTER_FIELD_KEYS}`)만 읽는다. 그 밖의 키는 읽지 않는다. 위치마다 아래 셋 중 하나로 나눈다(v0.5 보정 2).

| 분류 | 조건 | 처리 | 무시한 항목 수 |
|---|---|---|---|
| 후보 | 값이 있고 형이 맞다. 글 필드는 문자열, 목록 필드는 문자열 배열이다. E.No.S는 §16.3 변환을 거친 값이다 | 초안에 덮을 값 | 세지 않음 |
| 무시 | 값이 있으나(`undefined`·`null`이 아님) 형이 달라 쓸 수 없다. 예: 글 필드에 객체, 목록 필드에 숫자가 섞인 배열 | 현 초안 값 유지 | **1건** |
| 없음 | 키가 없다, 값이 `undefined`·`null`이다, E.No.S에 출처가 없는 우리 필드다(`persona`·`relationships`·`rules`), 대응 캐릭터가 없다, E.No.S 출처가 trim 뒤 빈 값이다 | 현 초안 값 유지 | 세지 않음 |

- "무시한 항목" 수는 **후보 만들기 단계에서만** 센다. 검사·덮기 단계는 다시 세지 않는다. 그래서 E.No.S 가져오기에서 매핑이 없는 필드는 매번 "없음"이고 요약에 무시로 잡히지 않는다.
- **후보 검사(파일이 준 후보 필드만).** 마지막으로 읽거나 저장한 값(E15·E16 응답 `settings`, 서버가 검증해 언제나 통과하는 값)을 기준으로 삼는다. 그 위에 후보만 덮은 객체를 `checkCharacterSettings`로 검사한다. 기준이 통과하는 값이므로 위반은 반드시 후보 필드에서 나온다. 결과는 각 후보 필드를 그 spec(형·필수·상한·개수)으로 검사한 것과 같고 문구는 §4.16 표 그대로다. 실패하면 초안을 바꾸지 않고 가져오기 전체를 거부한다. `issue.message`로 어느 필드인지 알리고, 상한을 넘은 값을 잘라 넣지 않는다(R-SET-008, s3c-02 Q5).
- **덮기.** 검사를 통과하면 결과 `value`에서 후보 위치의 값(정규화된 값)만 꺼내 현 초안에 덮는다. 후보가 아닌 위치는 초안 값을 그대로 둔다.
- **초안 전체 검사는 가져오기에서 하지 않는다.** 파일과 무관한 기존 초안 오류(미저장 입력의 상한 초과 등)는 가져오기를 막지 않는다. 초안 전체 사전 검사는 저장 버튼 활성 조건(「ui 인계 메모」 S3c 사전 검사 행)에서 그대로 한다. 가져온 뒤에도 기존 오류가 남아 있으면 저장 버튼은 비활성이다.
- **저장하지 않는다.** 가져오기는 초안만 바꾸고, 저장은 사용자가 「저장」(E16)을 눌러야 한다. 「변경 되돌리기」로 취소할 수 있다.
- 결과 요약은 반영한 범위(후보가 1개 이상인 세바스찬·시엘·공통)와 무시한 항목 수를 알린다. 후보가 0개면 초안을 바꾸지 않고 그 사실을 알린다. 문구는 화면 `labels.ts` 몫이다.
- 옛 `formatVersion` 1 파일에 나중에 더한 필드가 없으면 그 위치는 "없음"이라 초안 값이 남는다. 그래서 필드 추가만으로는 `formatVersion`을 올리지 않는다(§13.4).

### 16.3 E.No.S 매핑표 (읽는 키 = 아래 표뿐)

world 고르기: 백업은 `DB.worlds`를 앞에서부터 보고, `characters` 배열에 `name`이 shortName(`세바스찬` · `시엘`)을 포함하는 항목이 있는 **첫 world**를 고른다. 없으면 거부한다. world 단독 파일은 그 world를 쓰고, 맞는 캐릭터가 없으면 `world`만 반영한다. 캐릭터는 그 world의 `characters`에서 `name`에 shortName이 들어간 **첫 항목**이다.

| 우리 필드 | E.No.S 출처 | 변환 |
|---|---|---|
| `world` | `world.description` | 문자열이면 그대로 |
| `sourceMaterial` | `source_material` | 문자열 |
| `age` | `age` | 문자열. 숫자면 `String()` |
| `gender` | `gender` | 문자열 |
| `role` | `job` | 문자열 |
| `persona` | (없음) | 현 초안 유지 |
| `personalityTags` | `personality_tags` | 문자열이면 그대로, 문자열 배열이면 `', '`로 잇는다 |
| `appearance` | `appearance_desc` + `hair_style` + `eyes` + `accessories` | 넷 중 문자열만 trim, 빈 것 제외, 이 순서로 `'\n'`으로 잇는다 |
| `relationships` | (없음) | 현 초안 유지 |
| `speech` | `voice` | 문자열 |
| `sampleDialogue` | `sample_dialogue` | 문자열이면 줄(`\r?\n`)로 나눠 trim·빈 줄 제거, 문자열 배열이면 그대로 |
| `rules` | (없음) | 현 초안 유지 |

- 분류는 §16.2 표를 따른다(v0.5 보정 2). 출처 키가 없거나 값이 `null`이거나 trim 뒤 빈 값이면 "없음"이다. 값이 있으나 위 표가 받는 형(문자열, 표가 허용한 문자열 배열, `age`의 숫자)이 아니면 "무시" 1건이다.
- `persona`·`relationships`·`rules`는 E.No.S에 출처가 없어 늘 "없음"이고 세지 않는다. 대응 캐릭터가 없으면 그 캐릭터의 11필드가 모두 "없음"이다.
- `appearance`는 출처 4개를 각각 나눈다. 형이 다른 출처 1개가 무시 1건이다. 쓸 수 있는 출처가 하나도 없으면 `appearance`는 "없음"이다. `sampleDialogue`·`personalityTags`의 배열 출처에 문자열이 아닌 항목이 하나라도 있으면 그 출처가 무시 1건이다.
- world·캐릭터를 고르는 데 쓰는 판별 키(`DB.worlds`·`characters`·`name`)는 매핑 출처가 아니므로 세지 않는다.

가져오기 단위 테스트 기대값(ui `state/settingsFile.ts` — 기존 벡터 5종에 더한다, v0.5 보정 2):

| 벡터 | 기대 |
|---|---|
| E.No.S 백업, 매핑 출처가 모두 문자열 | 무시 0. `persona`·`relationships`·`rules`는 초안 값 그대로 |
| E.No.S 백업, `age: 13` · `gender: {}` · `sample_dialogue: ['a', 1]` | `age` 후보 `'13'`, 무시 2(`gender`·`sample_dialogue`), 두 필드 초안 값 유지 |
| E.No.S 백업, `voice: ''` · `job: null` | 둘 다 "없음", 무시 0, 초안 값 유지 |
| 자체 형식, `characters.ciel.speech` 801자 | 가져오기 거부, 메시지 `시엘 · 말투는 1~800자여야 합니다.`, 초안 불변 |
| 자체 형식, `characters.sebastian.rules: 'a'`(문자열) | `rules`만 무시 1, 나머지 후보 반영 |
| world 단독 파일(`description`만 유효) + 현 초안 `sebastian.appearance` 801자(미저장 입력) | 가져오기 성공(`world`만 덮음), 무시 0. 이어서 초안 전체 사전 검사는 `세바스찬 · 외형은 800자 이하여야 합니다.`로 실패해 저장 버튼 비활성 |
- **읽지 않는다:** `SETTINGS`(키 저장소), `DB.chats`, 성인용 필드 8종, 신체 치수, `entries`, `lorebook`, 그리고 위 표에 없는 모든 키.

### 16.4 비밀값 금지 규칙 (R-SET-007 · R-SET-008 · R-NFR-004)

| 단계 | 규칙 | 확인 |
|---|---|---|
| 서버 응답 | E15·E16 응답은 `settings`·`version`·`updatedAt`·`isDefault`·(v0.8) `model`(키 `'pro'`·`'flash'`·`null`, 모델명 없음)뿐이다 | API-T-094 · 126 |
| 내보내기 | 화이트리스트로 새 객체를 만든다. 출력 키 집합 = 최상위 4개 + `world` + 2명 × 11필드. (v0.8) `model` 없음 | ui 단위: 키 집합 일치, 출력 문자열에 `apiKey`·`API_KEY`·`SECRET`·`token`·(v0.8) `"model"` 0건 |
| 가져오기 | 화이트리스트로만 읽는다. `SETTINGS`를 열지 않는다. 파일 내용을 `console`·로그에 남기지 않는다 | ui 단위 벡터 5종(자체 · E.No.S 백업 · world 단독 · 잘못된 형식 · `SETTINGS`에 `apiKey`가 있는 파일 → 초안에 키 0) |
| 서버 저장 | strict가 모르는 키를 거부한다(마지막 방어). 400 문구에 키 이름을 싣지 않는다 | API-T-096 |
| 로그 | 설정 본문·필드 값을 남기지 않는다 | server SRV-T(R-SET-012) |

---

## 「ui 인계 메모」 (S3 · S3b — 화면이 계약에서 알아야 할 것만)

| 주제 | 계약 |
|---|---|
| 호출 | 캐릭터 버튼 → `speak(roomId, { character })`, 메뉴 재작성 → `regenerate(messageId)`. 둘 다 `@/api`에서 import한다. 성공 값은 `Message`다 |
| 소요 상한 | 두 호출 모두 **최대 70초**(보통 수 초). 래퍼에 타임아웃이 없어 서버가 끝낼 때까지 기다린다. 화면이 자체 타이머로 실패 처리하지 않는다. 서버가 저장했는데 화면이 실패로 보면 「재시도」가 대사를 하나 더 만든다 |
| 성공 반영 | speak `201` → 새 메시지를 끝에 붙인다(S2 `messagesAppended`와 같은 흐름). regenerate `200` → 같은 `id`의 메시지를 통째로 바꾼다(`text`만 다르다, `messageReplaced`와 같은 흐름) |
| `SPEAK_IN_PROGRESS` (409) | 이 방에서 다른 생성(다른 탭·다른 사람)이 진행 중이다. **잠시 후 다시 누르면 될 수 있다.** 생성은 최대 70초, 남은 잠금은 최대 90초다 |
| `NOT_LAST_MESSAGE` (409) | 대상이 이제 마지막 메시지가 아니다. **다시 눌러도 안 된다.** 재작성 메뉴 항목은 "캐릭터 메시지이고 마지막"일 때만 보인다(R-CHAT-007). 화면 목록 기준으로 숨겨도 그사이 다른 사람이 글을 쓰면 서버가 이 코드로 거절한다. 받으면 최신 메시지를 다시 반영하는 것을 권장한다(ui 판단) |
| `NOT_CHARACTER_MESSAGE` (400) | 유저 메시지에 재작성을 요청했다. 메뉴를 캐릭터 메시지에만 보이면 나오지 않는다(나오면 화면 결함) |
| `LLM_FAILED` · `LLM_EMPTY` (502) | AI가 대사를 만들지 못했다. 저장된 것이 없다(regenerate는 원래 대사 유지). **「재시도」 버튼**으로 같은 호출을 다시 하면 된다(R-CHAT-005). 두 코드의 화면 처리는 같아도 된다 |
| `CONFIG_INVALID` (500) | 서버에 AI 설정이 없다. 재시도해도 안 된다. **관리자 안내**를 띄운다(`ERROR_MESSAGES.CONFIG_INVALID`). 읽기·유저 발화는 계속 된다 |
| `NOT_FOUND` (404) | speak: 방이 사라졌다(생성 중 삭제 포함). regenerate: 대상 메시지가 사라졌다 |
| `RATE_LIMITED` (429) | S2와 같다(`retryAfterSec`). 실패한 생성도 1회로 센다 |
| `LLM_BUDGET_EXCEEDED` (429, S3b) | 이번 달 AI 사용 한도(서버 전체 공용)에 닿았다. 저장된 것이 없다(regenerate는 원래 대사 유지). **실패 말풍선 + 한도 문구**를 띄운다(`labels.ts`가 `code`로, 폴백 `ERROR_MESSAGES.LLM_BUDGET_EXCEEDED`). 「재시도」는 남겨도 되지만 다음 달 1일 00:00 KST 전까지는 같은 429이고 누를 때마다 레이트리밋 1회를 쓴다. **카운트다운·자동 재시도를 만들지 않는다** — 래퍼는 이 코드에 `retryAfterSec`를 싣지 않는다(§3.4). `RATE_LIMITED`와 status가 같으므로 **`code`로 구분**한다. 읽기 전용 전환 대상이 아니다(`isAuthFailure` false). 읽기·유저 발화·수정·삭제는 계속 된다 |
| 인증 3코드 (401·403) | S2와 같다. `isAuthFailure`면 읽기 전용으로 전환한다 |
| `NETWORK` · `INTERNAL` | 연결이 끊겼거나 서버 오류다. **speak는 서버에서 저장됐을 수도 있다**(응답만 못 받은 경우). 「재시도」 전에 최신 페이지를 다시 읽으면 중복을 피할 수 있다(ui 판단) |
| 표시 | 응답 `speaker`로 `CHARACTERS[speaker]`의 `shortName`·`avatar`를 그린다. `authorName`은 `null`이다 |
| 문구 | 화면 문구는 `labels.ts`가 `code`로 정한다. 서버 `message`는 폴백이다(§3.1) |

---

## 「ui 인계 메모」 S3c (v0.5 — 설정 화면·주인 판정)

| 주제 | 계약 |
|---|---|
| 호출 | 주인 판정·설정 화면 열기 → `getCharacterSettings()`, 저장 → `saveCharacterSettings(settings)`. 둘 다 `@/api`에서 import한다. 성공 값은 `CharacterSettingsResponse`다 |
| 주인 판정 | 토큰이 있을 때 App이 1회 `getCharacterSettings()`. `ok`면 `isOwner = true`, 그 밖은 모두 `false`. **판정 결과로 `revokeWrite`·`onAuthFailure`를 부르지 않는다**, 토스트도 없다(R-SET-010). 본문은 버린다 |
| `OWNER_ONLY` (403) | 설정 화면을 열거나 저장하다 받으면 안내 후 rooms로 가고 `isOwner = false`. 읽기 전용 전환 대상이 아니다(`isAuthFailure` false) |
| 인증 3코드 (설정 화면 안) | 여는 중이면 S2 규칙대로 전환 후 rooms. 저장 중이면 전환하되 **초안을 남기고** 저장 비활성·내보내기 허용(stale, R-SET-011) |
| `VALIDATION_ERROR` (400) | `message`가 §4.16 표의 첫 위반 1건이다. 이 코드는 `labels.ts` 고정 문구 대신 `message`를 그대로 보여도 된다(계약 문구). 사전 검사를 통과한 초안이면 정상적으로는 나오지 않는다 |
| `RATE_LIMITED` (429) | S2와 같다. 저장 1회 = 1회 소모. 판정 GET은 세지 않는다 |
| 사전 검사 | `checkCharacterSettings(draft)` — `issue.path`로 탭·필드를 찾고 `issue.message`를 보인다. 저장 버튼 활성 = dirty && 검사 통과 && !saving && !stale |
| 글자 수 | `countCodePoints(normalizeText(v))` / `max`(`WORLD_FIELD_SPEC`·`CHARACTER_FIELD_SPECS`). 목록 필드는 "한 줄에 하나" — 줄 나눔 뒤 trim·빈 줄 제거한 개수 / `maxItems`, 줄마다 `itemMax` |
| 저장 성공 | 응답 `settings`로 초안·기준값을 함께 바꾼다(서버가 정규화했다). `version`·`updatedAt`은 하단 줄 표시용이다. `isDefault`(= `version 0`)면 "기본값 사용 중" |
| 화면 이름 | 필드 라벨은 `CHARACTER_FIELD_SPECS[key].label`·`WORLD_FIELD_SPEC.label`을 쓴다(서버 400 문구와 같은 이름). `world` 필드 라벨은 `세계관`이고, 탭 이름("공통 세계관")은 `labels.ts` 몫이다(§15.12 결정 2) |
| 내보내기·가져오기 | §16 전부. 상수는 `@shared/settings` |

---

## 「ui 인계 메모」 (S3d — v0.6, 화면이 계약에서 알아야 할 것만)

| 주제 | 계약 |
|---|---|
| 전송 | `appendUser(roomId, { text, ooc })`가 `201`이면 곧바로 `speak(roomId, { character: 'auto' })`. `appendUser` 실패면 `speak` 0회. 둘 다 `@/api`에서 import한다 |
| `'auto'` 결과 | `201 Message`. `speaker`가 서버가 고른 캐릭터(`'sebastian'`·`'ciel'`)다. 결과 말풍선 자리는 이 값으로 정한다(세바스찬 왼쪽·시엘 오른쪽). 응답에 `'auto'`나 선택 근거는 없다 |
| 에러 | 캐릭터 버튼 `speak`와 같은 표(§4.12 · §4.13 · S3·S3b 메모). 새 코드 없음. `409`·`429`·`500`·`502` → 실패 표시 + 「재시도」 = `speak(roomId, { character: 'auto' })` 재호출(선택부터 다시). `401`·`403` → `isAuthFailure`로 읽기 전용 전환. `404` → 방이 사라짐 |
| 저장된 유저 메시지 | 자동 응답이 실패해도 유저 메시지는 이미 저장돼 있다(`appendUser` 결과). 실패가 유저 메시지를 지우지 않는다 |
| 레이트리밋 | 전송 1회 = 2회 소모. `appendUser`는 성공하고 이어진 `speak`가 `RATE_LIMITED`일 수 있다 |
| 소요 | 최대 70초(선택 포함). 래퍼에 타임아웃이 없다 |
| `authorName` | 유저 메시지는 서버가 항상 「어떠한 의지」로 준다. **값을 그대로 표시한다.** `USER_DISPLAY_NAME`(`@shared/characters`)은 `authorName`이 `null`·빈 문자열일 때의 대체 표시에만 쓴다 |
| 타입 | 화면 상태의 생성 대상은 `SpeakTarget`(`@shared/types`)이다. 같은 뜻의 화면 전용 타입을 만들지 않는다 |
| 재작성 | 자동으로 고른 대사도 `regenerate(messageId)` 그대로다(저장된 캐릭터로 다시 쓴다) |

---

## 「ui 인계 메모」 (S4 — v0.7, 장기기억 시트가 계약에서 알아야 할 것만)

| 주제 | 계약 |
|---|---|
| 래퍼 | `getMemory(roomId)` · `putMemory(roomId, { summary })` — `@/api`에서 import한다. 둘 다 `Result<MemoryResponse>`이고 throw하지 않는다 |
| 권한 | 두 래퍼 모두 토큰이 필요하다. **토큰 없는 읽기 전용 화면에서는 ⋯ 메뉴의 "장기기억" 항목을 렌더하지 않는다**(보기만 하는 경로도 없다, R-MEM-001). 주인 판정은 없다 — 등급 통과자 누구나 보고 고친다 |
| 열 때 | 시트를 **열 때마다 `getMemory`**(캐시 금지). speak 직후 최대 약 30초는 자동 요약 전의 이전 값일 수 있다 |
| 빈 상태 | `summary === ''`(특히 `updatedAt === null`)이면 빈 입력창과 안내. 자동 요약은 미요약 메시지가 60개(기본)를 넘은 뒤 캐릭터 발화가 끝나면 생긴다 |
| 길이 | 앞뒤 trim 후 코드 포인트 0~4000. 카운터는 `countCodePoints(normalizeText(v))`와 `MEMORY_SUMMARY_MAX`(`@shared/limits`). 4000 초과면 저장 비활성. 0자 저장 허용 |
| 저장 | `putMemory` 동안 입력·저장 버튼 비활성(중복 제출 방지). 성공하면 응답 `summary`(trim된 저장값)로 입력을 다시 맞춘다 |
| 실패 | 입력 내용을 보존한다. `400`은 서버 `message`를 그대로 보인다(길이 위반 = `장기기억은 0~4000자로 입력해 주세요.`). `429 RATE_LIMITED`는 기존 쓰기와 같은 안내, `404`는 방이 사라짐, `NETWORK`·`500`은 재시도 안내. `isAuthFailure`(401·`LEVEL_TOO_LOW`)면 기존 규칙대로 읽기 전용 전환(§2.4) — 항목이 사라지므로 시트 처리는 ui 결정 |
| 자동 요약과 경합 | 시트를 연 채 자동 요약이 끝난 뒤 저장하면 저장한 내용이 그 요약을 **대체**한다(마지막 저장 승리, `409` 없음). 자동 요약 도중에 저장하면 편집이 남고, 다음 캐릭터 발화 뒤 편집본을 기준으로 다시 요약된다. 안내 문구·위치는 ui 결정(memory.md 「ui 인계 메모」 후보 문구 참고) |
| 비우기 | (v0.7.1) 비우면 서버가 `sourceUntilId`를 0으로 되돌린다. 대화가 기준(기본 60개)보다 길면 다음 캐릭터 발화 뒤 **처음부터 다시 요약**한다(요약 삭제 = 재요약). 화면 동작·래퍼 호출은 바뀌지 않는다 — 매뉴얼·안내 문구만 이 뜻에 맞춘다(예: "비우면 다음 발화 뒤 대화 처음부터 다시 요약합니다") |
| 표시 필드 | `sourceUntilId`는 표시하지 않아도 된다. `updatedAt` 표시 여부는 ui 결정(요구 없음). 저장해도 방 목록 순서는 바뀌지 않는다 |
| 요구 밖 | 요약 이력·여러 요약본·"지금 요약" 버튼·처음부터 다시 요약은 없다 |
| AI 반영 | 저장한 요약은 다음 캐릭터 발화부터 쓰인다. 요약 안의 지시 문장은 설정을 바꾸지 못한다(서버 처리, 화면 안내 불필요) |

---

## 「ui 인계 메모」 (S3f — v0.8, 설정 화면 AI 모델 선택이 계약에서 알아야 할 것만)

| 주제 | 계약 |
|---|---|
| 읽기 | `getCharacterSettings()` 응답의 `model: LlmModelKey \| null`. `'pro'`·`'flash'` = 지금 쓰는 모델, `null` = 서버 기본 모델이 두 후보 밖(미선택 판). 저장한 적 없는 Pro와 저장한 Pro는 응답으로 구분되지 않는다(§15.15 확인 필요 1) |
| 저장 | `saveCharacterSettings(settings, model?)`. 모델을 바꿨을 때만 둘째 인자를 넘긴다. 넘기지 않으면 본문에 키가 없고 서버 저장값이 유지된다. `null`은 넘길 수 없다(타입) |
| 선택지 | `LLM_MODEL_KEYS` 순서(`pro` → `flash`). 화면 이름·설명은 ui `labels.ts`. 모델명·가격 숫자는 계약에 없다 |
| 응답 반영 | 저장 성공 응답의 `model`·`version`·`isDefault`로 기준값을 맞춘다. 모델만 바꿔도 `version` +1이고, 시드 상태였으면 `isDefault: false` |
| 400 | `공통 · AI 모델 값이 올바르지 않습니다.`는 정상 화면에서는 나오지 않는다(라디오가 두 키만 보낸다). 오면 서버 `message`를 그대로 보인다. `settings` 위반이 있으면 그 문구가 먼저 온다 |
| 내보내기·가져오기 | 파일에 `model`을 넣지 않고, 가져오기가 모델 선택을 바꾸지 않는다(§16.1) |
| 적용 시점 | 저장 뒤 **다음에 시작하는** 캐릭터 발화·자동 응답의 화자 선택·장기기억 요약부터. 진행 중인 대답은 이전 모델로 끝난다 |

---

## 「contract-implementer 인계 목록」 (S3b — v0.4.1)

| 순서 | 파일 | 식별자 | 할 일 | 테스트 |
|---|---|---|---|---|
| 1 | `shared/src/errors.ts` | `ERROR_CODES` · `ERROR_STATUS` · `ERROR_MESSAGES` | `LLM_BUDGET_EXCEEDED`를 `LLM_EMPTY` 다음에 추가, 429, 요구 원문 문구(§5.3) | API-T-040(갱신) · 048 |
| 1 | `shared/src/types.ts` | `ApiErrorBody.error.retryAfterSec?` | 문서주석만 두 코드로(§5.2). 타입 불변 | tsc |
| 3 | `server/test/routes-write.test.ts` · `server/test/routes-generate.test.ts` | `expectContractError` | 3키 허용을 `RATE_LIMITED`·`LLM_BUDGET_EXCEEDED`로, 값은 코드별(40 / 1356400)(§14.12) | 기존 전부 회귀 |
| 3 | `server/test/routes-generate.test.ts` | — | API-T-085 ~ 090 추가(server S3b 구현 뒤 — `insertUsage`·`llm_usage` 필요) | API-T-085 ~ 090 |
| 4 | `ui/src/api/api.test.ts` | `toRetryAfter`(변경 없음) | API-T-UI-022 · 023 추가 | API-T-UI-022 · 023 |
| — | `server/src/routes/*` · `ui/src/api/*.ts` | — | **소스 변경 없음.** 바꾸면 계약 위반 | 리뷰: `git diff --stat server/src/routes ui/src/api` 에 `*.test.ts` 외 0건 |
| 끝 | `doc/200_설계/contract/api.md` | §12.3 | 구현 후 실물 기준으로 대조표를 다시 채우고 §9에 "v0.4.1 구현" 행 | — |

---

## 「contract-implementer 인계 목록」 (S3c — v0.5)

| 순서 | 파일 | 식별자 | 할 일 | 테스트 |
|---|---|---|---|---|
| 4a | `shared/src/errors.ts` · `shared/test/errors.test.ts` | `ERROR_CODES` · `ERROR_STATUS` · `ERROR_MESSAGES` | `OWNER_ONLY` 403·문구, `CONFIG_INVALID` 다음(§5.8.2) | API-T-040(갱신) · 049 |
| 4b | `shared/src/types.ts` | `CharacterSettingFields` · `CharacterSettings` · `CharacterSettingsResponse` · `PutCharacterSettingsBody` | §5.8.1 그대로 | tsc |
| 4c | 신규 `shared/src/settings.ts` · `shared/test/settings.test.ts` · `shared/test/settings-vectors.ts` | §5.8.4 전 식별자 | 전문 그대로. 벡터는 §4.16 표 13행 + 경계값(상한·상한+1·이모지·빈 필수·모르는 키·3번째 id) | API-T-105 ~ 107 |
| 4d | `shared/src/limits.ts` | — | **변경 없음** | — |
| 4e | `shared/src/endpoints.ts` · `shared/test/endpoints.test.ts` | `PATHS.characterSettings` · `endpoints.characterSettings` | §5.8.3 | API-T-042(갱신) · 104 |
| 6a | `server/src/routes/validate.ts` | `validate` | 선택 인자 `toMessage`(§11.12) | 기존 routes 테스트 회귀 |
| 6a | `server/src/routes/schemas.ts` | `putCharacterSettingsBody` · `settingsIssueMessage` · `SETTINGS_BODY_TOO_LARGE` | §11.12 | API-T-096 ~ 101 |
| 6a | 신규 `server/src/routes/settings.ts` · `routes/index.ts` · 신규 `server/test/routes-settings.test.ts` | `settingsRoutes` | §11.12. server 5단계(`requireOwner`·`characterSettingsSchema`·`services.settings`) 뒤 | API-T-091 ~ 103 |
| 6b | `ui/src/api/client.ts` | `RequestOptions` | `method`에 `'PUT'`, `auth` 주석. `AUTH_FAILURE_CODES` 불변 | 기존 ui/api 회귀 |
| 6c | 신규 `ui/src/api/settings.ts` · `ui/src/api/index.ts` · `ui/src/api/api.test.ts` | `getCharacterSettings` · `saveCharacterSettings` | §11.13 | API-T-UI-024 ~ 027 |
| 끝 | `doc/200_설계/contract/api.md` | §12.4 · §9 | 구현 후 실물로 대조표를 다시 채우고 §9에 "v0.5 구현" 행 | 리뷰 grep(§14.16) |

---

## 「contract-implementer 인계 목록」 (S3d — v0.6)

| 순서 | 파일 | 식별자 | 할 일 | 테스트 |
|---|---|---|---|---|
| 4 | `shared/src/types.ts` | `SpeakTarget` · `SpeakBody` · `Message.authorName` 주석 | §5.2 | tsc · API-T-UI-028 |
| 4 | `shared/src/characters.ts` | `USER_DISPLAY_NAME` | §5.5 | API-T-112 |
| 6 | `server/src/routes/schemas.ts` | `SPEAK_TARGETS` · `speakBody` | §11.15 | API-T-110 |
| 6 | `server/test/routes-write.test.ts` | API-T-062 · 108 | 유저 `authorName` 기대값 → `USER_DISPLAY_NAME`, D1 `author_name` 실명은 직접 SELECT(§14.17) | API-T-062 · 108 |
| 6 | `server/test/routes-generate.test.ts` | — | API-T-109 ~ 111 추가(109·111은 server 5단계 뒤) | API-T-109 ~ 111 |
| 6 | `ui/src/api/messages.ts` | `speak` 문서주석 | §11.15. 시그니처 변경 없음 | API-T-UI-028 · 029 |
| — | `server/src/routes/messages.ts` · `ui/src/api/client.ts` | — | **소스 변경 없음** | 리뷰 diff |
| 끝 | `doc/200_설계/contract/api.md` | §12.5 | 구현 후 실물 기준으로 다시 채우고 §9에 "v0.6 구현" 행 | — |

---

## 「contract-implementer 인계 목록」 (S4 — v0.7)

| 순서 | 파일 | 식별자 | 할 일 | 테스트 |
|---|---|---|---|---|
| 4 | `shared/src/types.ts` | `MemoryResponse` · `PutMemoryBody` | §5.9.1 그대로(`PutCharacterSettingsBody` 다음) | tsc |
| 4 | `shared/src/endpoints.ts` · `shared/test/endpoints.test.ts` | `PATHS.roomMemory` · `endpoints.roomMemory` | §5.9.2 | API-T-042(갱신) · 124 |
| 4 | `shared/src/errors.ts` · `limits.ts` | — | **변경 없음** | API-T-040 무수정 |
| 6 | `server/src/routes/schemas.ts` | `putMemoryBody` · `MEMORY_BODY_MAX_BYTES` | §11.16 | API-T-119 · 120 |
| 6 | 신규 `server/src/routes/memory.ts` · `routes/index.ts` · 신규 `server/test/routes-memory.test.ts` | `memoryRoutes` | §11.16. server 5단계(`services.memory`) 뒤 | API-T-113 ~ 122 |
| 6 | `server/test/routes-generate.test.ts`(+ `/speak`를 부르는 다른 테스트 파일) | `call` | `waitOnExecutionContext(ctx)` 대기(§14.19) + API-T-123 | 기존 전부 회귀 · API-T-123 |
| 6 | 신규 `ui/src/api/memory.ts` · `ui/src/api/index.ts` · 신규 `ui/src/api/memory.test.ts` | `getMemory` · `putMemory` | §11.16 | API-T-UI-030 ~ 032 |
| — | `server/src/routes/{rooms,messages,settings,validate}.ts` · `ui/src/api/client.ts` | — | **소스 변경 없음** | 리뷰 diff |
| 끝 | `doc/200_설계/contract/api.md` | §12.6 · §9 | 구현 후 실물 파일:줄로 대조표를 다시 채우고 §9에 "v0.7 구현" 행 | — |
| v0.7.1 | `shared/src/types.ts` · `ui/src/api/memory.ts` · `server/test/routes-memory.test.ts` | `MemoryResponse.sourceUntilId` 주석 · `putMemory` 주석 | 빈 요약 예외 문구(§5.9.1 · §11.16). API-T-125 추가 — server 변경(§15.14 v0.7.1) 뒤 | API-T-125 |

---

## 「contract-implementer 인계 목록」 (S3f — v0.8)

| 순서 | 파일 | 식별자 | 할 일 | 테스트 |
|---|---|---|---|---|
| 4 | `shared/src/types.ts` | `LlmModelKey` · `CharacterSettingsResponse.model` · `PutCharacterSettingsBody.model?` | §5.8.6 그대로(`model?: LlmModelKey \| undefined`) | tsc |
| 4 | `shared/src/settings.ts` · `shared/test/settings.test.ts` | `LLM_MODEL_KEYS` · `SETTINGS_MODEL_INVALID_MESSAGE` | §5.8.6(`SETTINGS_CHARACTER_IDS` 다음). `checkCharacterSettings`·벡터 파일 불변 | API-T-131 |
| 4 | `shared/src/{errors,endpoints,limits,characters}.ts` | — | **변경 없음** | API-T-040 · 042 무수정 |
| 6 | `server/src/routes/schemas.ts` | `putCharacterSettingsBody` · `settingsIssueMessage` | §11.17 | API-T-129 · 130 |
| 6 | `server/src/routes/settings.ts` · `server/test/routes-settings.test.ts` | PUT 핸들러 | 셋째 인자 `body.model`(§11.17). server 5단계(`settings.put` 셋째 인자 · 0004) 뒤 | API-T-094(갱신) · 126 ~ 130 |
| 6 | `ui/src/api/settings.ts` · `ui/src/api/settings.test.ts` | `saveCharacterSettings` | §11.17. 테스트 응답 픽스처에 `model` 추가 | API-T-UI-025(무수정) · 033 · 034 |
| — | `server/src/routes/{index,validate,rooms,messages,memory,health}.ts` · `ui/src/api/{client,index}.ts` | — | **소스 변경 없음** | 리뷰 diff |
| 끝 | `doc/200_설계/contract/api.md` | §12.7 · §9 | 구현 후 실물 파일:줄로 대조표를 다시 채우고 §9에 "v0.8 구현" 행 | — |

---

## 「ui 인계 메모」 (S6 — v0.9, rooms·chat 화면이 계약에서 알아야 할 것만)

| 항목 | 계약 |
|---|---|
| 목록 | E3 행 `locked`. 날짜 숨김·자물쇠 표시는 화면 규칙(응답에는 날짜가 있다) |
| 새 방 | `createRoom({ title, password? })` — 빈칸이면 `password` 키를 보내지 않는다. 응답 `entryKey`가 문자열이면 저장 후 바로 진입 |
| 입장 | `enterRoom(roomId)`(조용한 시도, 토큰 있을 때) · `enterRoom(roomId, pw)`(시트). 결과: `200` `entryKey` 문자열 → 저장 · `null` → 안 잠긴 방(저장 안 함) · `ROOM_LOCKED` → 시트 · `ROOM_PASSWORD_WRONG` → 시트 문구 · `RATE_LIMITED`(+`retryAfterSec`) → 시트 문구 · `NOT_FOUND` → 목록 새로 고침 · `NETWORK` → 시트 문구. **E17은 401·`LEVEL_TOO_LOW`를 내지 않는다** |
| 증명 전달 | 화면은 `configureClient`에 `getRoomKey(roomId)`만 준다. 헤더는 래퍼가 붙인다. 메시지 id 래퍼는 마지막 인자로 `room.id`를 꼭 넘긴다 |
| `ROOM_LOCKED` | 어느 래퍼에서든 오면 그 방 증명을 지우고 입장 재요구. `isAuthFailure`는 `false` — 읽기 전용으로 전환하지 않는다. 실패한 쓰기를 자동 재시도하지 않는다 |
| 잠금 관리 | `setRoomPassword(roomId, pw)` → `{ room, entryKey }`(새 증명 저장 · `room`으로 표시 갱신) · `clearRoomPassword(roomId)` → `RoomSummary`(`locked: false`, 증명 삭제). 메뉴는 토큰 있을 때만(지금 규칙) |
| 규칙 값 | `ROOM_PASSWORD_MIN`·`MAX`(4·32)는 shared `limits.ts` import. 비밀번호 원문은 상태·저장소·로그에 두지 않는다 |
| 보관 | `ld:roomKeys`(증명만). 토큰은 계속 메모리만 — 저장소 단언 대상 |

---

## 「contract-implementer 인계 목록」 (S6 — v0.9)

순서 번호는 s6-03 §0(6 = 승인 ② 직후 shared, 8 = server-implementer 완료 마커 뒤 routes·ui/api).

| 순서 | 파일 | 식별자 | 할 일 | 테스트 |
|---|---|---|---|---|
| 6 | `shared/src/types.ts` | `RoomSummary.locked` · `CreateRoomBody.password?` · `CreateRoomResponse` · `EnterRoomBody` · `EnterRoomResponse` · `SetRoomPasswordBody` · `SetRoomPasswordResponse` | §5.10.1 그대로. `RenameRoomBody` 불변 | tsc |
| 6 | `shared/src/errors.ts` · `shared/test/errors.test.ts` | `ROOM_LOCKED` · `ROOM_PASSWORD_WRONG` | §5.10.2(3곳, `OWNER_ONLY` 다음) | API-T-040(17) |
| 6 | `shared/src/endpoints.ts` · `shared/test/endpoints.test.ts` | `PATHS.roomEnter` · `PATHS.roomPassword` · `endpoints` 2 · `ROOM_KEY_HEADER` | §5.10.3 | API-T-042(13) |
| 6 | `shared/src/limits.ts` · 테스트 | 상수 4 | §5.10.4 | API-T-164 |
| 8 | `server/src/routes/schemas.ts` | `createRoomBody` · `enterRoomBody` · `setRoomPasswordBody` · `ROOM_PASSWORD_BODY_MAX_BYTES` | §11.18(`roomTitleBody` 불변) | API-T-143 · 152 · 156 |
| 8 | `server/src/routes/rooms.ts` | E4 · E5 · E6 · E17 · E18 · E19 | §11.18 · §2.8.3 순서. server 7단계(`rooms.enter`·`setPassword`·`clearPassword`·auth 미들웨어 3·0005) 완료 뒤 | API-T-141 ~ 158 |
| 8 | `server/src/routes/messages.ts` · `memory.ts` | E7 ~ E14 | ★ 한 줄씩(§2.8.3) | API-T-159 ~ 163 |
| 8 | `server/test/routes-room-lock.test.ts`(신규) · 기존 routes 테스트 | — | §14.22. 기존 E3·E4·E5 응답 키 단언에 `locked`(·E4 `entryKey`) 추가 | API-T-010 ~ 014 · 050 ~ 066 무수정 통과(키 단언 제외) |
| 8 | `ui/src/api/client.ts` | `ClientConfig.getRoomKey?` · `RequestOptions.roomId?` · `configureClient` | §11.18. `AUTH_FAILURE_CODES` 불변 | API-T-UI-035 |
| 8 | `ui/src/api/{rooms,messages,memory,index}.ts` | `createRoom` 반환 · `enterRoom` · `setRoomPassword` · `clearRoomPassword` · `roomId` 옵션 · 메시지 id 래퍼 마지막 인자 `roomId` | §11.18 | API-T-UI-036 ~ 040 |
| 8 | `ui/src/api/api.test.ts` · `ui/src/api/room-lock.test.ts`(신규) | 기존 메시지 id 래퍼 호출 9곳(§13.8) | 마지막 인자 추가. 화면 호출부(`useMessageWrites.ts`)·화면 테스트는 **ui 단계 몫**이라 고치지 않는다 | 기존 UI 테스트 통과 |
| — | `server/src/routes/{index,validate,health,settings}.ts` | — | **소스 변경 없음** | 리뷰 diff |
| 끝 | `doc/200_설계/contract/api.md` | §12.8 · §9 | 구현 후 실물 파일:줄로 대조표를 채우고 §9에 "v0.9 구현" 행. 증명·비밀번호 실값을 문서에 적지 않는다 | — |
