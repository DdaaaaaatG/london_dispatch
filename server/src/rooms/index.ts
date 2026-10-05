/**
 * [목적] rooms 모듈 공개 진입. 방 목록(R-ROOM-001). R-ROOM-005 갱신 규칙은 db.rooms.touchStmt 로 제공. 설계 rooms.md
 * [공개 API] createRoomsService, 타입 RoomsService·RoomsDeps·RoomSummary
 * [비동기] listRooms 는 async
 * [에러] 업무 에러 없음(S1). D1 장애는 전파되어 onError 가 INTERNAL 로 닫는다
 * [설정] 없음
 * [테스트] server/test/rooms.test.ts (SRV-T-040~043)
 */
export type { RoomSummary } from '../db'
export { createRoomsService } from './service'
export type { RoomsDeps, RoomsService } from './service'
