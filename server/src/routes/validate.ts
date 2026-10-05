import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { ZodType } from 'zod'
import { AppError } from '../app-error'

/**
 * zod 검증 미들웨어. 실패하면 VALIDATION_ERROR(400)를 throw 하고 응답은 진입점 onError 가 만든다
 * zod-validator 기본 실패 응답은 계약 형식이 아니므로 hook 에서 throw 한다 (api.md §3.5)
 */
export const validate = <Target extends keyof ValidationTargets, Schema extends ZodType>(
  target: Target,
  schema: Schema,
) =>
  zValidator(target, schema, (result) => {
    if (!result.success) throw new AppError('VALIDATION_ERROR')
  })
