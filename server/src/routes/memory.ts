/**
 * [목적] 장기기억 E13 · E14 (api.md §4.17 · §4.18)
 * [요구] R-MEM-001 · R-AUTH-003(memory GET 토큰 예외) · R-AUTH-005
 * [에러] 서비스·미들웨어가 throw → server onError. 라우트는 변환하지 않는다
 */
import { PATHS } from '@shared/endpoints'
import type { MemoryResponse, PutMemoryBody } from '@shared/types'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { AppError } from '../app-error'
import { rateLimitWrites, requireToken } from '../auth'
import type { AppEnv } from '../services'
import { MEMORY_BODY_MAX_BYTES, putMemoryBody, roomIdParam } from './schemas'
import { validate } from './validate'

/** 본문 32KiB 초과 → 400 VALIDATION_ERROR 기본 문구 (hono 기본 413 을 쓰지 않는다) */
const memoryBodyLimit = bodyLimit({
  maxSize: MEMORY_BODY_MAX_BYTES,
  onError: () => {
    throw new AppError('VALIDATION_ERROR')
  },
})

export const memoryRoutes = new Hono<AppEnv>()
  /// [계약] api.md §4.17 · [요구] R-MEM-001 · [에러] TOKEN_* · LEVEL_TOO_LOW · NOT_FOUND · INTERNAL · [부수효과] 없음(레이트리밋 미소모)
  .get(PATHS.roomMemory, requireToken, validate('param', roomIdParam), async c => {
    const { id } = c.req.valid('param')
    const memory: MemoryResponse = await c.get('services').memory.get(id)
    return c.json(memory, 200)
  })
  /// [계약] api.md §4.18 · [요구] R-MEM-001 · R-AUTH-005 · [에러] §4.5 공통 + VALIDATION_ERROR · NOT_FOUND · [부수효과] memory 1행 UPSERT · 레이트리밋 1회 · 방 updatedAt 불변
  .put(
    PATHS.roomMemory,
    requireToken,
    rateLimitWrites,
    validate('param', roomIdParam),
    memoryBodyLimit,
    validate('json', putMemoryBody),
    async c => {
      const { id } = c.req.valid('param')
      const body: PutMemoryBody = c.req.valid('json')
      const memory: MemoryResponse = await c.get('services').memory.put(id, body)
      return c.json(memory, 200)
    },
  )
