import { endpoints } from '@shared/endpoints'
import type { CreateRoomBody, RenameRoomBody, RoomSummary } from '@shared/types'
import { request, type Result } from './client'

/** [계약] api.md §4.2 · [요구] R-ROOM-001 · R-ROOMS-001 — 방 목록(updatedAt 내림차순, 서버 정렬) */
export const listRooms = (): Promise<Result<RoomSummary[]>> =>
  request<RoomSummary[]>(endpoints.rooms())

/** [계약] api.md §4.6 · [요구] R-ROOM-002 · R-ROOMS-002 — 방 생성(201 RoomSummary) */
export const createRoom = (body: CreateRoomBody): Promise<Result<RoomSummary>> =>
  request<RoomSummary>(endpoints.rooms(), {
    method: 'POST',
    body: { title: body.title },
    auth: true,
  })

/** [계약] api.md §4.7 · [요구] R-ROOM-003 · R-CHAT-001 — 이름 변경(updatedAt 유지) */
export const renameRoom = (roomId: string, body: RenameRoomBody): Promise<Result<RoomSummary>> =>
  request<RoomSummary>(endpoints.room(roomId), {
    method: 'PATCH',
    body: { title: body.title },
    auth: true,
  })

/** [계약] api.md §4.8 · [요구] R-ROOM-004 · R-CHAT-001 — 방 삭제(204 → value undefined) */
export const deleteRoom = (roomId: string): Promise<Result<void>> =>
  request<void>(endpoints.room(roomId), { method: 'DELETE', auth: true })
