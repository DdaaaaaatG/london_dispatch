/**
 * [목적] 방 목록 서비스(R-ROOM-001). 정렬은 SQL 이 하고 서비스는 다시 정렬하지 않는다. 설계 rooms.md §2.1
 * [공개 API] createRoomsService({ db }) -> RoomsService { listRooms }
 * [비동기] db.rooms.listSummaries() 1회 await
 * [에러] 업무 에러 없음. D1 장애는 전파
 * [설정] 없음
 * [테스트] server/test/rooms.test.ts (SRV-T-040~043)
 */
import type { Db, RoomSummary } from '../db'

export type RoomsService = {
  /** 전 방을 updatedAt 내림차순으로. 방이 없으면 빈 배열 */
  listRooms: () => Promise<RoomSummary[]>
}

export type RoomsDeps = { db: Db }

/** rooms 서비스를 만든다 */
export const createRoomsService = (deps: RoomsDeps): RoomsService => ({
  listRooms: () => deps.db.rooms.listSummaries(),
})
