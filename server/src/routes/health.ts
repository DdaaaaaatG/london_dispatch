import { PATHS } from '@shared/endpoints'
import type { HealthResponse } from '@shared/types'
import { Hono } from 'hono'
import type { AppEnv } from '../services'

/// [계약] api.md §4.1 · [요구] R-API-005 · [에러] CONFIG_INVALID(부트스트랩) · INTERNAL · [부수효과] 없음(DB 미접근)
export const healthRoutes = new Hono<AppEnv>().get(PATHS.health, c => {
  const body: HealthResponse = c.get('services').getHealth()
  return c.json(body, 200)
})
