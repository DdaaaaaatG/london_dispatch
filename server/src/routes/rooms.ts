import { PATHS } from '@shared/endpoints'
import type { RoomSummary } from '@shared/types'
import { Hono } from 'hono'
import type { AppEnv } from '../services'

/// [계약] api.md §4.2 · [요구] R-ROOM-001 · R-AUTH-003(읽기 토큰 불필요) · [에러] CONFIG_INVALID · INTERNAL · [부수효과] 없음
export const roomsRoutes = new Hono<AppEnv>().get(PATHS.rooms, async c => {
  const rooms: RoomSummary[] = await c.get('services').rooms.listRooms()
  return c.json(rooms, 200)
})
