# rooms 상세 설계 — 소급 델타 기록 (분할 문서)

> 주 문서: `ui/src/rooms/design.md`. 이 파일은 주 문서 옛 §11.3(S1 실물 소급 델타, v1.4)을 40KB 한계 때문에 v1.8.2에서 **내용 그대로** 옮긴 것이다.

## 11.2 설계 결정·가정 (v1.8.4에 주 문서에서 옮김, 내용 그대로)

| # | 내용 | 이유 |
|---|---|---|
| D-1(결정) | 방에 들어갈 때 마지막 본 방을 기록하고(chat F-CH-02), ‹ 뒤로로 목록에 돌아오면 기록을 지운다(chat F-CH-10). 목록에 없는 방이면 자동 진입 판정에서도 지운다(F-RM-08). 저장 불가 환경은 try/catch로 무시 | 메인 세션 결정 2026-10-05 |
| D-2(결정) | `ui/src/main.tsx`는 `global.css` import, 토큰 초기화(`initToken`·`configureClient`)와 `<App />` 렌더만 하고, 화면 분기는 `ui/src/App.tsx`가 한다 | App을 테스트할 수 있게 분리(메인 세션 승인). S2에서 토큰 두 줄이 더해졌다(api.md §2.4 "main.tsx가 렌더 전에 한 번") |
| A-2(가정) | 목록 로드가 실패하면 자동 진입을 미루고, 재시도가 성공한 시점에 판정한다 | 방 정보는 목록으로만 얻는다(단건 조회 없음) |
| D-3(결정, S2) | 생성 성공 시 목록을 갱신하지 않고 응답 `RoomSummary`로 바로 chat에 들어간다 | R-ROOMS-002 "생성 → 그 방의 대화 화면으로 이동", api.md §4.6 "목록 갱신 방식은 ui 몫". 돌아올 때 목록을 다시 불러온다(F-RM-03) |
| D-4(결정, S2) | `viewer`는 App 상태 하나다. 쓰기 실패가 `isAuthFailure`면 어느 화면에서든 App이 토큰을 비우고 읽기 전용으로 바꾼다. 안내 토스트는 실패를 받은 화면이 띄운다 | api.md §2.4가 "강등 방식·viewer 계산 위치는 ui 설계" |
| A-3(가정, S2) | rooms 토스트 줄은 화면 맨 아래 in-flow 28px다. 구성안 §1 그림에는 없고 §3이 Toast를 "두 화면" 공용으로 적었다. chat E 줄(하단 바 바로 위)과 같은 "화면 아래쪽 한 줄" 규칙을 따른다 | 생성 실패 안내 자리가 필요하다. 구조 변경이 아니라 상태 조각 배치로 본다. 다르게 원하면 ui-layout-designer 확인 |

## 11.3 S1 실물 소급 델타 (v1.4)

| # | 설계 v1.3 | S1 실물(`ui/src/**`) → 설계 반영 |
|---|---|---|
| R-1 | 목록 요청·자동 진입을 RoomsScreen이 직접 소유 | `ui/src/rooms/useRoomsLoader.ts`가 `load`·`autoOpenSettledRef`·`isActiveRef`·`latestRef`와 `loadRooms`·`retry`를 소유. RoomsScreen은 조립만(functions.md §1.2) |
| R-2 | `loadRooms`가 먼저 `setLoad(loading)` | 설정하지 않는다. 마운트 초기값이 loading이고 재시도는 `retry`가 loading을 먼저 건다(F-RM-06·07) |
| R-3 | 지역 함수 `renderListArea(load)` | 지역 컴포넌트 `ListArea`(components.md §2.3) |
| R-4 | `selectRoom(room)` 함수 | 없음. `onOpenRoom`을 그대로 `onSelect`로 넘긴다(F-RM-09) |
| R-5 | `resolveAutoOpen`이 `autoOpenSettledRef`를 직접 확인 | 모듈 함수 `resolveAutoOpen(rooms, handlers)`. "이미 판정함" 검사는 `loadRooms`가 한다. 콜백은 `latestRef`(매 렌더 `useLayoutEffect`)로 읽어 부모 콜백이 바뀌어도 목록을 다시 요청하지 않는다 |
| R-6 | App 콜백 형태 미지정 · `READ_ONLY_VIEWER` 리터럴 | App 콜백은 `useCallback([])`. `READ_ONLY_VIEWER = Object.freeze({ canWrite: false })` |
