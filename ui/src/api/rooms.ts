import { endpoints } from '@shared/endpoints'
import type { RoomSummary } from '@shared/types'
import { request, type Result } from './client'

/** [계약] api.md §4.2 · [요구] R-ROOM-001 · R-ROOMS-001 — 방 목록(updatedAt 내림차순, 서버 정렬) */
export const listRooms = (): Promise<Result<RoomSummary[]>> =>
  request<RoomSummary[]>(endpoints.rooms())
