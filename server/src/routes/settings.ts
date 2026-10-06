/**
 * [목적] 캐릭터 설정 E15 · E16 (api.md §4.15 · §4.16). 갠홈 주인 전용
 * [요구] R-SET-001 · R-SET-004 · R-SET-005 · R-AUTH-003(설정 GET 토큰 예외) · R-AUTH-005
 * [에러] 서비스·미들웨어가 throw → server onError. 라우트는 변환하지 않는다
 */
import { PATHS } from '@shared/endpoints'
import { SETTINGS_BODY_MAX_BYTES } from '@shared/settings'
import type { CharacterSettingsResponse, PutCharacterSettingsBody } from '@shared/types'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { AppError } from '../app-error'
import { getPrincipal, rateLimitWrites, requireOwner, requireToken } from '../auth'
import type { AppEnv } from '../services'
import { putCharacterSettingsBody, SETTINGS_BODY_TOO_LARGE, settingsIssueMessage } from './schemas'
import { validate } from './validate'

/** 본문 128KB 초과 → 400 VALIDATION_ERROR (hono 기본 413 을 쓰지 않는다) */
const settingsBodyLimit = bodyLimit({
  maxSize: SETTINGS_BODY_MAX_BYTES,
  onError: () => {
    throw new AppError('VALIDATION_ERROR', SETTINGS_BODY_TOO_LARGE)
  },
})

export const settingsRoutes = new Hono<AppEnv>()
  /// [계약] api.md §4.15 · [요구] R-SET-004 · [에러] TOKEN_* · LEVEL_TOO_LOW · OWNER_ONLY · INTERNAL · [부수효과] 없음
  .get(PATHS.characterSettings, requireToken, requireOwner, async c => {
    const response: CharacterSettingsResponse = await c.get('services').settings.get()
    return c.json(response, 200)
  })
  /// [계약] api.md §4.16 · [요구] R-SET-005 · [에러] §4.15 + RATE_LIMITED · VALIDATION_ERROR · [부수효과] D1 1행 UPSERT · 레이트리밋 1회
  .put(
    PATHS.characterSettings,
    requireToken,
    requireOwner,
    rateLimitWrites,
    settingsBodyLimit,
    validate('json', putCharacterSettingsBody, settingsIssueMessage),
    async c => {
      const body: PutCharacterSettingsBody = c.req.valid('json')
      const response: CharacterSettingsResponse = await c
        .get('services')
        .settings.put(body.settings, getPrincipal(c))
      return c.json(response, 200)
    },
  )
