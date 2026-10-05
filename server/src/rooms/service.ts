/**
 * [목적] 방 목록·생성·이름 변경·삭제 서비스(R-ROOM-001~004). 정렬은 SQL, 제목 판정은 normalizeTitle. 설계 rooms.md §2·§4
 * [공개 API] createRoomsService({ db, now }) -> RoomsService { listRooms, createRoom, renameRoom, deleteRoom }, 타입 RoomsDeps·RoomsService·RoomTitleInput
 * [비동기] db 호출 1회씩 await. 삭제는 db 가 batch(memory → messages → rooms)로 원자 처리
 * [에러] VALIDATION_ERROR(제목, DB 접근 전), NOT_FOUND(없는 방 이름 변경·삭제). D1 장애는 전파
 * [설정] 없음. now 는 컨테이너가 주입하는 시계
 * [테스트] server/test/rooms.test.ts (SRV-T-040~043·130~135)
 */
import { AppError } from '../app-error'
import type { Db, RoomSummary } from '../db'
import { normalizeTitle } from './title'

export type RoomTitleInput = { title: string }

export type RoomsService = {
  /** 전 방을 updatedAt 내림차순으로. 방이 없으면 빈 배열 */
  listRooms: () => Promise<RoomSummary[]>
  /** 방을 만든다. createdAt = updatedAt = now, messageCount 0 */
  createRoom: (input: RoomTitleInput) => Promise<RoomSummary>
  /** 제목만 바꾼다. updatedAt 은 그대로 */
  renameRoom: (id: string, input: RoomTitleInput) => Promise<RoomSummary>
  /** memory·messages·rooms 를 한 batch 로 실삭제 */
  deleteRoom: (id: string) => Promise<void>
}

export type RoomsDeps = { db: Db; now: () => number }

const ROOM_NOT_FOUND_MESSAGE = '방을 찾을 수 없습니다.'

/** rooms 서비스를 만든다 */
export const createRoomsService = ({ db, now }: RoomsDeps): RoomsService => ({
  listRooms: () => db.rooms.listSummaries(),
  createRoom: async input => {
    const title = normalizeTitle(input.title)
    const id = crypto.randomUUID()
    const nowMs = now()
    await db.rooms.insert({ id, title, nowMs })
    return { id, title, createdAt: nowMs, updatedAt: nowMs, messageCount: 0 }
  },
  renameRoom: async (id, input) => {
    const title = normalizeTitle(input.title)
    const summary = await db.rooms.updateTitle(id, title)
    if (summary === null) throw new AppError('NOT_FOUND', ROOM_NOT_FOUND_MESSAGE)
    return summary
  },
  deleteRoom: async id => {
    const deleted = await db.rooms.deleteCascade(id)
    if (!deleted) throw new AppError('NOT_FOUND', ROOM_NOT_FOUND_MESSAGE)
  },
})
