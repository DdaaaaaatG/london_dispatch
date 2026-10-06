# S3c 코드 리뷰 (verify-code-reviewer 최종 보고 원문) — 2026-10-06

> 메인 세션이 리뷰어 hand-back 원문을 그대로 보존한 기록. 판정은 리뷰어의 것이다.

요약: C 0 / H 0 / M 0 / L 2
판정: APPROVE — S3c 변경분에서 커밋을 막을 결함 없음. LOW 2건은 COMMENT로 첨부.

## Stage1: design.md 대비 — 누락 0, 과잉 0, 계약 불일치 0

| 구분 | 결과 | 근거 |
|---|---|---|
| 누락 | 0 | F-ST-01~21(index.tsx·useSettingsEditor.ts·useSettingsUi.ts·useImportForm.ts·labels.ts·download.ts), F-RM-24~29(App.tsx useOwner·useSettingsNav, rooms/index.tsx TopActions, useEntryNotice.ts) 전부 구현. functions.md §1 실물 매핑표와 일치 |
| 과잉 | 0 | 시트 4종·탭 3개·버튼 모두 R-SET-007~011로 역추적. ToastTone success는 design §12에 메인 세션 승인 기록 |
| 토큰·주인 분기(§10) | 일치 | ⚙는 viewer.canWrite && isOwner일 때만 DOM 렌더(rooms/index.tsx:144-147). stale에서 가져오기만 비활성·내보내기 허용(SheetLayer.tsx:47) |
| 계약 | 일치 | ui/src/api/settings.ts GET·PUT /api/settings/characters(auth:true), PutCharacterSettingsBody·CharacterSettingsResponse(필드 4개, updatedAt number\|null) = shared/src/types.ts:122-134 = api.md §4.15·§4.16·§5.8. OWNER_ONLY 403 shared/src/errors.ts 추가 |
| RTM→테스트 | 연결 | R-SET-007(TC-ST-022·023·034), 008(024~027·035·039·041), 009(001~012·020·021·028~031·040, TC-RM-036·039), 010(TC-ST-017·019, TC-RM-033·034·035·037·038), 011(TC-ST-016·023) 모두 테스트 파일에 존재. TC-ST-036 grep은 리뷰에서 0건 확인. TC-ST-037·038·TC-RM-040은 수동/스크린샷 항목 |

## Stage2: ts 1 / tsx 0 / golden 0 / 경계 0 / 토큰 0 / 390px 0 / 접근성 0

- 경계: fetch( 는 ui/src/api/client.ts:104 한 곳(래퍼, 정상). 화면 '/api/ 조립·console.·any 0건.
- 토큰: ui/src/settings/**·state/settings*.ts에 getToken·localStorage·sessionStorage·document.cookie 0건.
- R-SET-010: App.tsx:106-113 판정 실패 시 revokeWrite·토스트 없음(성공 시 markOwner만). revokeWrite는 설정 열기·저장 인증 3코드에서만(useSettingsEditor.ts:60-62, 100-104), OWNER_ONLY는 먼저 분기해 loseOwner만.
- 상태 모듈: React·DOM import 없음(ApiError 타입 import만), 리듀서 전개 복사·불일치 조합 같은 참조 반환, checkPatchedSettings 입력 불변.
- 줄 수: 최대 파일 state/settings.ts 373줄, TSX 최대 175줄, 최장 함수 useSaveAction 약 47줄.
- Hook cleanup: isActiveRef·inputIdRef·saveInFlightRef·shownRef·probeStartedRef로 늦은 응답·연타·StrictMode 방어.
- 공용 컴포넌트 순수 추가: IconButton 'settings' 분기만, Toast 'success'·.success(--color-success, global.css:20), client.ts 'PUT', useNewRoomUi showToast 반환.
- 390px: 고정 폭 없음, min-width:0, 말줄임은 하단줄·탭·파일명·시트 제목만(design §2.1 명시), .error 줄바꿈.
- 접근성: ⚙·‹·⋯ aria-label, tablist 로빙 tabindex·키보드, 탭 ! 접근성 이름 접미사, StatusBar role=status aria-live=polite, stale·③ 오류 role=alert.
- server(ts-rules만): routes/settings.ts·settings/service.ts·db/character-settings.ts 위반 없음.

## 이슈 (심각도순)

- [LOW] CR-001 `ui/src/state/settingsCandidate.ts:50` — 주석과 코드 불일치. 근거: `/** 모듈 내부 타입(export 안 함). … */ export type Candidate = {`. 권고: 주석 수정 또는 export 제거(settingsFile.ts는 이 타입을 import하지 않음). 라우팅: ui-postprocessor
- [LOW] CR-002 `ui/src/settings/labels.ts:14-21` — 인증 3코드·NETWORK 문구가 rooms/labels.ts와 중복. 근거: `const AUTH_TEXT … TOKEN_REQUIRED: '로그인 정보가 없어 …'`(주석에도 "rooms writeErrorText 와 같은 문장"). 권고: design.md §13 공용화 후보로 이미 표시, 현재 TC-ST-031이 일치 보장. 후속 공용화 때 처리. 라우팅: ui-debug(후속)

## False Positive 제외

client.ts 내부 fetch, state의 ApiError 타입 전용 import, download.ts setTimeout revoke, useImportForm FileReader 미abort(결과 ref로 폐기), dev StrictMode GET 2회(기존 rooms 패턴, 리듀서가 두 번째 무시).

## 미확인 범위

server/src/settings/schema.ts·shared/src/settings.ts 정독 안 함(예산). 빌드·테스트 미실행(지시대로). 서버 쪽(PUT bodyLimit이 rateLimitWrites 뒤인 순서 등)은 verify-server-reviewer 참조.

도구 호출 약 25회, 예산 안에서 완료.
