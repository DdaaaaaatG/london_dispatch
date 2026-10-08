# rooms 상세 설계 — 소급 델타 기록 (분할 문서)

> 주 문서: `ui/src/rooms/design.md`. 이 파일은 주 문서 옛 §11.3(S1 실물 소급 델타, v1.4)을 40KB 한계 때문에 v1.8.2에서 **내용 그대로** 옮긴 것이다.

## 11.3 S1 실물 소급 델타 (v1.4)

| # | 설계 v1.3 | S1 실물(`ui/src/**`) → 설계 반영 |
|---|---|---|
| R-1 | 목록 요청·자동 진입을 RoomsScreen이 직접 소유 | `ui/src/rooms/useRoomsLoader.ts`가 `load`·`autoOpenSettledRef`·`isActiveRef`·`latestRef`와 `loadRooms`·`retry`를 소유. RoomsScreen은 조립만(functions.md §1.2) |
| R-2 | `loadRooms`가 먼저 `setLoad(loading)` | 설정하지 않는다. 마운트 초기값이 loading이고 재시도는 `retry`가 loading을 먼저 건다(F-RM-06·07) |
| R-3 | 지역 함수 `renderListArea(load)` | 지역 컴포넌트 `ListArea`(components.md §2.3) |
| R-4 | `selectRoom(room)` 함수 | 없음. `onOpenRoom`을 그대로 `onSelect`로 넘긴다(F-RM-09) |
| R-5 | `resolveAutoOpen`이 `autoOpenSettledRef`를 직접 확인 | 모듈 함수 `resolveAutoOpen(rooms, handlers)`. "이미 판정함" 검사는 `loadRooms`가 한다. 콜백은 `latestRef`(매 렌더 `useLayoutEffect`)로 읽어 부모 콜백이 바뀌어도 목록을 다시 요청하지 않는다 |
| R-6 | App 콜백 형태 미지정 · `READ_ONLY_VIEWER` 리터럴 | App 콜백은 `useCallback([])`. `READ_ONLY_VIEWER = Object.freeze({ canWrite: false })` |
