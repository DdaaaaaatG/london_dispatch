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
