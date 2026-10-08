/**
 * [목적] rooms 모듈 공개 진입. 방 목록·생성·이름 변경·삭제(R-ROOM-001~004)와 S6 방 비밀번호 잠금(R-LOCK-001·002·004~009). R-ROOM-005 갱신 규칙은 db 메시지 쓰기 함수 안에서 처리. 설계 rooms.md §12
 * [공개 API] createRoomsService, normalizeTitle, ROOM_TITLE_MAX, deriveEntrySecret(S6, 컨테이너용), 타입 RoomsService·RoomsDeps·RoomTitleInput·RoomSummary·EntryTarget·EntryAccess. 비밀번호·증명 순수 함수는 password.ts·entry-key.ts 에서 직접(테스트용)
 * [비동기] 모든 서비스 함수 async
 * [에러] VALIDATION_ERROR(제목·비밀번호), NOT_FOUND(없는 방), ROOM_LOCKED·ROOM_PASSWORD_WRONG(S6), RATE_LIMITED(S6, auth 가 던짐). D1 장애는 전파되어 onError 가 INTERNAL 로 닫는다
 * [설정] 없음. TOKEN_SECRET 은 컨테이너가 파생한 CryptoKey(deps.entrySecret)로만, ROOM_ENTER_LIMIT_PER_MIN 은 auth(deps.hitEnterLimit) 안에서만 쓰인다
 * [테스트] server/test/rooms.test.ts (SRV-T-040~043·130~135), rooms-password.test.ts (360~367), rooms-lock.test.ts (368~389)
 */
export type { RoomSummary } from '../db'
export { deriveEntrySecret } from './entry-key'
export { createRoomsService } from './service'
export type { EntryAccess, EntryTarget, RoomsDeps, RoomsService, RoomTitleInput } from './service'
export { normalizeTitle, ROOM_TITLE_MAX } from './title'
