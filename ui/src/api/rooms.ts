import { endpoints } from '@shared/endpoints'
import type {
  CreateRoomBody,
  CreateRoomResponse,
  EnterRoomResponse,
  RenameRoomBody,
  RoomSummary,
  SetRoomPasswordResponse,
} from '@shared/types'
import { request, type Result } from './client'

/** [계약] api.md §4.2 · [요구] R-ROOM-001 · R-ROOMS-001 — 방 목록(updatedAt 내림차순, 서버 정렬). locked 포함 */
export const listRooms = (): Promise<Result<RoomSummary[]>> =>
  request<RoomSummary[]>(endpoints.rooms())

/** [계약] api.md §4.6 · [요구] R-ROOM-002 · R-LOCK-001 — 방 생성(201 CreateRoomResponse). 비밀번호를 걸면 entryKey 가 온다 */
export const createRoom = (body: CreateRoomBody): Promise<Result<CreateRoomResponse>> =>
  request<CreateRoomResponse>(endpoints.rooms(), {
    method: 'POST',
    body:
      body.password === undefined
        ? { title: body.title }
        : { title: body.title, password: body.password },
    auth: true,
  })

/** [계약] api.md §4.7 · [요구] R-ROOM-003 · R-CHAT-001 — 이름 변경(updatedAt 유지) */
export const renameRoom = (roomId: string, body: RenameRoomBody): Promise<Result<RoomSummary>> =>
  request<RoomSummary>(endpoints.room(roomId), {
    method: 'PATCH',
    body: { title: body.title },
    auth: true,
    roomId,
  })

/** [계약] api.md §4.8 · [요구] R-ROOM-004 · R-CHAT-001 — 방 삭제(204 → value undefined) */
export const deleteRoom = (roomId: string): Promise<Result<void>> =>
  request<void>(endpoints.room(roomId), { method: 'DELETE', auth: true, roomId })

/** [계약] api.md §4.19 · [요구] R-LOCK-004 · R-LOCK-005 — 방 입장(200). 비밀번호 없으면 본문 {}. 토큰은 선택, 증명 헤더는 붙이지 않는다 */
export const enterRoom = (roomId: string, password?: string): Promise<Result<EnterRoomResponse>> =>
  request<EnterRoomResponse>(endpoints.roomEnter(roomId), {
    method: 'POST',
    body: password === undefined ? {} : { password },
    auth: true,
  })

/** [계약] api.md §4.20 · [요구] R-LOCK-002 · R-LOCK-006 — 잠금 설정·비밀번호 변경(200, 새 entryKey) */
export const setRoomPassword = (
  roomId: string,
  password: string,
): Promise<Result<SetRoomPasswordResponse>> =>
  request<SetRoomPasswordResponse>(endpoints.roomPassword(roomId), {
    method: 'PUT',
    body: { password },
    auth: true,
    roomId,
  })

/** [계약] api.md §4.21 · [요구] R-LOCK-002 · R-LOCK-006 — 잠금 해제(200 RoomSummary, 멱등) */
export const clearRoomPassword = (roomId: string): Promise<Result<RoomSummary>> =>
  request<RoomSummary>(endpoints.roomPassword(roomId), { method: 'DELETE', auth: true, roomId })
