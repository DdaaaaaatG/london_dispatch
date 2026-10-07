import { endpoints } from '@shared/endpoints'
import type { MemoryResponse, PutMemoryBody } from '@shared/types'
import { request, type Result } from './client'

/** [계약] api.md §4.17 · [요구] R-MEM-001 · R-CHAT-012 — 장기기억 읽기(토큰 필요, 200). 행이 없으면 summary '' · sourceUntilId 0 · updatedAt null */
export const getMemory = (roomId: string): Promise<Result<MemoryResponse>> =>
  request<MemoryResponse>(endpoints.roomMemory(roomId), { auth: true })

/** [계약] api.md §4.18 · [요구] R-MEM-001 · R-CHAT-012 — 장기기억 교체 저장(200). 응답 summary 가 trim 된 저장값, sourceUntilId 는 유지(빈 요약이면 0, v0.7.1) */
export const putMemory = (roomId: string, body: PutMemoryBody): Promise<Result<MemoryResponse>> =>
  request<MemoryResponse>(endpoints.roomMemory(roomId), {
    method: 'PUT',
    body: { summary: body.summary },
    auth: true,
  })
