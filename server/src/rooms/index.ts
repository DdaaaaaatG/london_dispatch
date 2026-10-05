/**
 * [목적] rooms 모듈 공개 진입. 방 목록·생성·이름 변경·삭제(R-ROOM-001~004). R-ROOM-005 갱신 규칙은 db 메시지 쓰기 함수 안에서 처리. 설계 rooms.md
 * [공개 API] createRoomsService, normalizeTitle, ROOM_TITLE_MAX, 타입 RoomsService·RoomsDeps·RoomTitleInput·RoomSummary
 * [비동기] 모든 서비스 함수 async
 * [에러] VALIDATION_ERROR(제목), NOT_FOUND(없는 방). D1 장애는 전파되어 onError 가 INTERNAL 로 닫는다
 * [설정] 없음
 * [테스트] server/test/rooms.test.ts (SRV-T-040~043·130~135)
 */
export type { RoomSummary } from '../db'
export { createRoomsService } from './service'
export type { RoomsDeps, RoomsService, RoomTitleInput } from './service'
export { normalizeTitle, ROOM_TITLE_MAX } from './title'
