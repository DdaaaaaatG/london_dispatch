import { endpoints } from '@shared/endpoints'
import type { HealthResponse } from '@shared/types'
import { request, type Result } from './client'

/** [계약] api.md §4.1 · [요구] R-API-005 — 서버 상태 */
export const getHealth = (): Promise<Result<HealthResponse>> => request<HealthResponse>(endpoints.health())
