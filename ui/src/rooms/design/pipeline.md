# rooms 상세 설계 — 파이프라인 (분할 문서)

> 주 문서: `ui/src/rooms/design.md`(RTM 포함). 이 파일은 주 문서 §6의 상세다(v1.6.1, 40KB 한계로 분할). 절 번호 §6.1~§6.6은 주 문서 RTM이 그대로 가리킨다.
> 문구 표 참조(§8.2·§8.3)는 주 문서 절이다. 기능 번호(F-RM-xx)는 `design/functions.md`.

## 6.1 정상 — 첫 진입(저장된 방 없음)

```
main.tsx: initToken(location.search) → configureClient({ getToken }) → <App />
App 마운트 → viewer = viewerFromToken(getToken()) · autoOpenRoomId = loadLastRoomId() = null
 → RoomsScreen 마운트 → load=loading → StateView "불러오는 중"
 → listRooms() ok(토큰 헤더 없음) → load=ready → RoomList → resolveAutoOpen → onAutoOpenSettled → App.autoOpenRoomId=null
 → 행 탭 → onOpenRoom(room) → App.view=chat → ChatScreen 마운트(saveLastRoomId(room.id))
```

## 6.2 정상 — 재방문(저장된 방 있음, R-ROOMS-004)

```
App 마운트 → autoOpenRoomId = 'r1'
 → RoomsScreen loading → listRooms() ok → 목록에 r1 있음
 → onAutoOpenSettled → onOpenRoom(r1) → ChatScreen(r1)
 → ‹ 뒤로 → clearLastRoomId()(chat F-CH-10) → backToRooms → RoomsScreen 새 마운트(autoOpenRoomId=null) → 목록 다시 로드 → 목록에 머문다
 → 이 상태로 패널을 닫았다 다시 열면 저장된 방이 없으므로 목록에서 시작(§6.1)
```
- 목록 응답 직후 자동 진입 판정이 통과하면 chat으로 바뀐다. 목록 상태 설정과 화면 전환이 같은 비동기 이어짐 안에서 연속으로 일어나므로, React 19 자동 배칭 때문에 목록은 화면에 **커밋되지 않을 수 있다**. 목록이 보였는지는 보장하지도 검증하지도 않는다. 보장하는 것은 "판정 시점에 목록 응답이 성공 상태였다"는 것뿐이다(목록이 와야 방 정보를 안다, 단건 조회 없음).

## 6.3 저장된 방이 사라짐

```
autoOpenRoomId='gone' → listRooms() ok, 목록에 없음 → clearLastRoomId() → onAutoOpenSettled → 목록 유지
```

## 6.4 오류

| 단계 | 상황 | 화면 | 다음 |
|---|---|---|---|
| 목록 로드 | `listRooms` 실패(모든 코드) | StateView error: `목록을 불러오지 못했습니다` + 상세(주 문서 §8.2) + 「다시 시도」 | 「다시 시도」 → loading → 재요청 |
| 목록 로드 실패 + 저장된 방 있음 | 위와 같음 | 같음 | 자동 진입 보류. 재시도가 성공하면 그때 판정(F-RM-08) |
| 저장소 읽기 실패 | `localStorage` throw | 영향 없음(`autoOpenRoomId = null`과 같다) | 일반 목록 흐름 |
| 저장소 쓰기·삭제 실패 | throw | 영향 없음 | — |
| 언마운트 후 응답 | 자동 진입으로 chat 전환 뒤 늦은 응답 | 버린다(`isActiveRef`) | — |
| (S2) 방 생성 | §6.5 | | |
| (S3c) 주인 판정 실패 | §6.6 — 표시 없음 | | |

## 6.5 방 생성 (S2, R-ROOMS-002)

```
「+ 새 방」 → openCreate → B 행 열림 → 입력 포커스 (카운터 0/60, 만들기 비활성)
 → 제목 입력 → isRoomTitleValid = 1~60자(trim 후 코드 포인트) → 만들기 활성
 → 만들기 클릭 또는 Enter(IME 조합 중 제외)
   → submitInFlightRef = true · isSubmitting = true (입력 읽기 전용, 두 버튼 비활성)
   → createRoom({ title })   // Authorization: Bearer <getToken()>, 래퍼가 붙인다
   ├ 201 ok   → onOpenRoom(응답 RoomSummary) → App.view = chat → ChatScreen 마운트 → saveLastRoomId(새 id)
   │            (목록 재요청·끼워 넣기 없음. ‹ 뒤로 때 목록을 다시 불러오면 맨 위에 있다)
   └ 실패     → isSubmitting = false (B 행·입력값 유지)
               ├ isAuthFailure → App.revokeWrite → 「+ 새 방」·B 미렌더 → h1 포커스 → 토스트(전환 안내)
               └ 그 밖        → 토스트(주 문서 §8.3 코드별 문구), 다시 만들기 가능
취소 · Esc → B 닫힘, 입력 비움, 「+ 새 방」 포커스 (요청 중이면 무시)
```

- 중복 제출 방지는 상태 기반(`submitInFlightRef` + `isSubmitting`)이다. 디바운스 없음.
- 파괴 조작 없음(rooms에는 삭제·변경이 없다 — 방 이름 변경·삭제는 chat ⋯ 메뉴). confirm 대상 없음. 생성 중 상태 없음(S3 speak는 chat).

## 6.6 주인 판정·설정 진입 (S3c, R-SET-009 · R-SET-010)

```
main.tsx initToken → App 첫 렌더(⚙ 없음) → 판정 effect: getToken() 있음 → getCharacterSettings()
 ├ 200            → isOwner = true → RoomsScreen 재렌더 → ⚙ 나타남(「+ 새 방」 왼쪽)
 └ 401·403·NETWORK·5xx → 아무것도 안 함(⚙ 없음, 「+ 새 방」 유지, 토스트 없음, 토큰 유지)
⚙ → openSettings → SettingsScreen(설정은 다시 GET) → ‹ / 나가기 → leaveSettings() → RoomsScreen 새 마운트
설정 화면 OWNER_ONLY → loseOwner + leaveSettings(안내) → RoomsScreen 마운트 → 진입 안내 토스트 1회 → ⚙ 없음
설정 화면 인증 실패(열기) → revokeWrite + leaveSettings(안내) → 읽기 전용 목록 + 토스트 1회
```

- 판정 결과로 `revokeWrite`·토스트를 부르지 않는다(F-RM-24). 설정 화면 안의 흐름은 `ui/src/settings/design/functions.md` §3.
