import { PATHS } from '@shared/endpoints'
import type {
  CreateRoomBody,
  CreateRoomResponse,
  EnterRoomBody,
  EnterRoomResponse,
  RenameRoomBody,
  RoomSummary,
  SetRoomPasswordBody,
  SetRoomPasswordResponse,
} from '@shared/types'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { AppError } from '../app-error'
import {
  getPrincipal,
  isOwnerRequest,
  optionalToken,
  rateLimitWrites,
  requireRoomEntry,
  requireToken,
} from '../auth'
import type { AppEnv } from '../services'
import {
  createRoomBody,
  enterRoomBody,
  ROOM_PASSWORD_BODY_MAX_BYTES,
  roomIdParam,
  roomTitleBody,
  setRoomPasswordBody,
} from './schemas'
import { validate } from './validate'

/** E17·E18 본문 1KiB 초과 → 400 VALIDATION_ERROR 기본 문구 (hono 기본 413 을 쓰지 않는다) */
const passwordBodyLimit = bodyLimit({
  maxSize: ROOM_PASSWORD_BODY_MAX_BYTES,
  onError: () => {
    throw new AppError('VALIDATION_ERROR')
  },
})

export const roomsRoutes = new Hono<AppEnv>()
  /// [계약] api.md §4.2 · [요구] R-ROOM-001 · R-AUTH-003(읽기 토큰 불필요) · [에러] CONFIG_INVALID · INTERNAL · [부수효과] 없음
  .get(PATHS.rooms, async c => {
    const rooms: RoomSummary[] = await c.get('services').rooms.listRooms()
    return c.json(rooms, 200)
  })
  /// [계약] api.md §4.6 · [요구] R-ROOM-002 · R-LOCK-001 · R-AUTH-003·005 · [에러] §4.5 공통 + VALIDATION_ERROR(제목·비밀번호) · [부수효과] rooms 1행(+pass_hash) · 레이트리밋 1회 · 관문 없음
  .post(PATHS.rooms, requireToken, rateLimitWrites, validate('json', createRoomBody), async c => {
    const body: CreateRoomBody = c.req.valid('json')
    const created: CreateRoomResponse = await c.get('services').rooms.createRoom(body)
    return c.json(created, 201)
  })
  /// [계약] api.md §4.7 · [요구] R-ROOM-003 · R-LOCK-006 · [에러] §4.5 공통 + VALIDATION_ERROR · NOT_FOUND · ROOM_LOCKED · [부수효과] title 갱신(updatedAt 유지) · 레이트리밋 1회
  .patch(
    PATHS.room,
    requireToken,
    rateLimitWrites,
    validate('param', roomIdParam),
    requireRoomEntry('room'),
    validate('json', roomTitleBody),
    async c => {
      const { id } = c.req.valid('param')
      const body: RenameRoomBody = c.req.valid('json')
      const room: RoomSummary = await c.get('services').rooms.renameRoom(id, body)
      return c.json(room, 200)
    },
  )
  /// [계약] api.md §4.8 · [요구] R-ROOM-004 · R-DB-003 · R-LOCK-006 · [에러] §4.5 공통 + NOT_FOUND · ROOM_LOCKED · [부수효과] memory·messages·rooms 실삭제 · 레이트리밋 1회
  .delete(
    PATHS.room,
    requireToken,
    rateLimitWrites,
    validate('param', roomIdParam),
    requireRoomEntry('room'),
    async c => {
      const { id } = c.req.valid('param')
      await c.get('services').rooms.deleteRoom(id)
      return c.body(null, 204)
    },
  )
  /// [계약] api.md §4.19 · [요구] R-LOCK-004 · R-LOCK-005 · R-LOCK-007 · R-AUTH-003(L3) · [에러] VALIDATION_ERROR · NOT_FOUND · ROOM_LOCKED · ROOM_PASSWORD_WRONG · RATE_LIMITED · [부수효과] rate_limits enter:{roomId} · 관문·회원 한도 없음
  .post(
    PATHS.roomEnter,
    optionalToken,
    validate('param', roomIdParam),
    passwordBodyLimit,
    validate('json', enterRoomBody),
    async c => {
      const { id } = c.req.valid('param')
      const body: EnterRoomBody = c.req.valid('json')
      const entered: EnterRoomResponse = await c
        .get('services')
        .rooms.enter(id, { password: body.password, isOwner: isOwnerRequest(c) })
      return c.json(entered, 200)
    },
  )
  /// [계약] api.md §4.20 · [요구] R-LOCK-002 · R-LOCK-005 · R-LOCK-006 · R-LOCK-007 · [에러] §4.5 공통 + VALIDATION_ERROR · NOT_FOUND · ROOM_LOCKED · [부수효과] pass_hash 교체(옛 증명 전부 무효) · updatedAt 불변 · 레이트리밋 1회
  .put(
    PATHS.roomPassword,
    requireToken,
    rateLimitWrites,
    validate('param', roomIdParam),
    requireRoomEntry('room'),
    passwordBodyLimit,
    validate('json', setRoomPasswordBody),
    async c => {
      const { id } = c.req.valid('param')
      const body: SetRoomPasswordBody = c.req.valid('json')
      const done: SetRoomPasswordResponse = await c
        .get('services')
        .rooms.setPassword(id, body.password, { mbId: getPrincipal(c).mbId })
      return c.json(done, 200)
    },
  )
  /// [계약] api.md §4.21 · [요구] R-LOCK-002 · R-LOCK-005 · R-LOCK-006 · [에러] §4.5 공통 + NOT_FOUND · ROOM_LOCKED · [부수효과] pass_hash NULL(증명 전부 무효, 멱등 200) · updatedAt 불변 · 레이트리밋 1회
  .delete(
    PATHS.roomPassword,
    requireToken,
    rateLimitWrites,
    validate('param', roomIdParam),
    requireRoomEntry('room'),
    async c => {
      const { id } = c.req.valid('param')
      const room: RoomSummary = await c
        .get('services')
        .rooms.clearPassword(id, { mbId: getPrincipal(c).mbId })
      return c.json(room, 200)
    },
  )
